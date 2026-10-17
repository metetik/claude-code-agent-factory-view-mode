import { atom, read, update } from 'claude-code'
import type { AgentInfo, Elements, EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { AccessoryName, AgentStatus, AgentStyle, ColorName, FactoryAgent, HatName, LooksMode } from '../types'
import {
  MAIN_ID,
  STYLE_CHOICES,
  addAgent,
  baseStyle,
  clearFinished,
  cycle,
  describeAgent,
  endTool,
  labelFor,
  mainAgent,
  parseStyle,
  patchAgent,
  lastingStyles,
  randomStyle,
  setStatus,
  settle,
  startTool,
  styleKey,
  styleOf,
  toolDetail,
  withMain,
  type NewAgent,
  type StyleScope,
} from './model'
import { rasterCells, sceneSvg } from './paint'
import {
  FRAMES,
  STATION_W,
  clip,
  colsFor,
  drawScene,
  layout,
  sceneHotspots,
  sceneLabels,
  seatsNeeded,
  type SceneAgent,
} from './scene'
import { ACCESSORY_NAMES, COLORS, COLOR_NAMES, HAT_NAMES, hex, prettyName } from './sprites'

const PANE = 'agent-factory'
const TITLE = 'Agent Factory'
const RASTER = 'floor'
/** One animation frame; the SVG plays its frames at the same pace. */
const TICK_MS = 250
const RECONCILE_MS = 2000
/** Desks across on the remote surfaces, which scale the picture to fit. */
const REMOTE_COLS = 7
/** CSS pixels per picture pixel on the remote surfaces. */
const REMOTE_SCALE = 3

const AGENTS = { plugin: 'agent-factory', key: 'agents' } as const
const agentsAtom = atom(AGENTS, [])
const stylesAtom = atom({ plugin: 'agent-factory', key: 'styles' } as const, {})
const looksAtom = atom({ plugin: 'agent-factory', key: 'looks' } as const, 'random')
const selectedAtom = atom({ plugin: 'agent-factory', key: 'selected' } as const, null)
const scopeAtom = atom({ plugin: 'agent-factory', key: 'scope' } as const, 'agent')
const demoAtom = atom({ plugin: 'agent-factory', key: 'isDemo' } as const, false)

type Engine = EngineInterface
/** What every surface draws with; `Select` where the surface has one (not mobile yet). */
type Table = Pick<Elements['mobile'], 'Box' | 'Text' | 'Button'> & { Select?: Elements['desktop']['Select'] }
/** The choices that decide how every agent looks. */
type Wardrobe = { styles: Record<string, AgentStyle>; looks: LooksMode }

/** The terminal picture's frame; a reload starts it over, which nobody sees. */
let frame = 0
/** The terminal Raster as last drawn, which the ticker repaints in place. */
let mounted: { columns: number; rows: number; maxCols: number; isFlat: boolean } | null = null
let isShown = true
let isTicking = false
/** The selected agent's id as last drawn, so the ticker highlights the same desk. */
let selectedId: string | null = null
/** Loop ids no agent list named lately (the engine's own forks), by when to ask again. */
const unknownUntil = new Map<string, number>()

async function quietly($: Engine, what: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work()
  } catch (error) {
    $.ui.log(`agent-factory: ${what} failed: ${String(error)}`, { to: 'debug' })
  }
}

/** Changes the agents in one write, or none when nothing changed. */
async function mutate($: Engine, change: (agents: FactoryAgent[], now: number) => FactoryAgent[]): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const now = await $.clock.now()
    const held = await $.state.get(AGENTS)
    const before = held.value ?? []
    const after = change(withMain(before, now), now)
    if (JSON.stringify(after) === JSON.stringify(before)) return
    const { isSet } = await $.state.set(AGENTS, after, { ifVersion: held.version })
    if (isSet) return
  }
}

function statusFromList(status: AgentInfo['status']): AgentStatus {
  switch (status) {
    case 'running':
      return 'working'
    case 'completed':
      return 'done'
    case 'failed':
    case 'killed':
      return 'failed'
    default:
      return 'waiting'
  }
}

function newAgentFrom(info: AgentInfo): NewAgent {
  return {
    id: info.id,
    type: info.type,
    label: labelFor(info.name, info.description, info.type),
    description: info.description,
    status: statusFromList(info.status),
    isTeammate: info.teammateId !== undefined,
  }
}

/** Seats the agent a loop id belongs to, if the session lists one; false for the engine's own forks. */
async function ensureAgent($: Engine, id: string): Promise<boolean> {
  if (id === MAIN_ID) return true
  if ((await read($, agentsAtom)).some(a => a.id === id)) return true
  const now = await $.clock.now()
  if ((unknownUntil.get(id) ?? 0) > now) return false
  const info = (await $.agent.list()).find(one => one.id === id)
  if (info === undefined) {
    unknownUntil.set(id, now + 5000)
    return false
  }
  await mutate($, (agents, at) => addAgent(agents, newAgentFrom(info), at))

  return true
}

/** Follows the session's agent list: new agents get desks, ended ones put their feet up. */
async function reconcile($: Engine): Promise<void> {
  await mutate($, (agents, now) => settle(agents, now) ?? agents)

  const listed = await $.agent.list()
  await mutate($, (agents, now) => {
    let next = agents
    for (const info of listed) {
      const mine = next.find(a => a.id === info.id)
      const status = statusFromList(info.status)
      if (mine === undefined) {
        if (status === 'working' || status === 'waiting') next = addAgent(next, newAgentFrom(info), now)
        continue
      }
      const isFresh = now - mine.since < 5000
      const isEnded = status === 'done' || status === 'failed'
      const isMineEnded = mine.status === 'done' || mine.status === 'failed' || mine.status === 'sleeping'
      if ((isEnded && !isMineEnded) || (status === 'working' && mine.status !== 'working' && !isFresh && !isMineEnded)) {
        next = patchAgent(next, mine.id, a => setStatus(a, status, now))
      }
    }
    const ids = new Set(listed.map(info => info.id))
    for (const mine of next) {
      const isGone = !mine.isMain && !mine.isDemo && !ids.has(mine.id) && now - mine.since > 10_000
      if (isGone && (mine.status === 'working' || mine.status === 'waiting')) {
        next = patchAgent(next, mine.id, a => setStatus(a, 'done', now))
      }
    }

    return next
  })

  const pane = (await $.ui.panes()).find(one => one.id === PANE)
  isShown = pane?.isShown === true
  if (await read($, demoAtom)) await demoStep($)
}

/** Repaints the terminal's Raster with the next frame, no render pass. */
async function tick($: Engine): Promise<void> {
  const at = mounted
  if (at === null || !isShown || isTicking) return
  isTicking = true
  try {
    frame = (frame + 1) % (FRAMES * 1000)
    const agents = withMain(await read($, agentsAtom), 0)
    const scene = sceneOf(agents, await wardrobeOf($))
    const selected = agents.find(a => a.id === selectedId)
    const lay = layout(seatsNeeded(scene), at.maxCols, { isFlat: at.isFlat, spacing: 'snug' })
    const picture = rasterCells(drawScene(lay, scene, frame, selected?.seat), sceneLabels(lay, scene, STATION_W - 2))
    if (picture.columns !== at.columns || picture.rows !== at.rows) return
    await $.ui.blit({ requestId: PANE, key: RASTER, cells: picture.cells, columns: picture.columns, rows: picture.rows })
  } finally {
    isTicking = false
  }
}

async function wardrobeOf($: Engine): Promise<Wardrobe> {
  return { styles: await read($, stylesAtom), looks: await read($, looksAtom) }
}

function sceneOf(agents: readonly FactoryAgent[], { styles, looks }: Wardrobe): SceneAgent[] {
  return agents.map(agent => ({ agent, style: styleOf(agent, styles, looks) }))
}

const DEMO_TYPES = ['Explore', 'general-purpose', 'Plan', 'code-reviewer', 'test-runner', 'docs-writer']
const DEMO_TASKS = ['Map the repo', 'Fix the parser', 'Plan the API', 'Review the diff', 'Run the tests', 'Write the docs']
const DEMO_TOOLS = ['Read', 'Grep', 'Edit', 'Bash', 'WebFetch', 'TodoWrite', 'Glob', 'Write']

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

async function startDemo($: Engine): Promise<void> {
  await update($, demoAtom, () => true)
  await mutate($, (agents, now) =>
    DEMO_TYPES.reduce(
      (list, type, i) =>
        addAgent(
          list,
          {
            id: `demo-${i + 1}`,
            type,
            label: labelFor(undefined, DEMO_TASKS[i]!, type),
            description: DEMO_TASKS[i]!,
            status: i < 3 ? 'working' : i === 3 ? 'waiting' : 'done',
            isDemo: true,
          },
          now,
        ),
      agents,
    ).map(a => (a.isDemo && a.status === 'working' ? { ...a, tool: pick(DEMO_TOOLS), detail: 'demo' } : a)),
  )
}

async function stopDemo($: Engine): Promise<void> {
  await update($, demoAtom, () => false)
  await mutate($, agents => agents.filter(a => !a.isDemo))
}

/** Moves one or two pretend agents along: a new tool, a finished task, a fresh one. */
async function demoStep($: Engine): Promise<void> {
  await mutate($, (agents, now) => {
    const demo = agents.filter(a => a.isDemo)
    if (demo.length === 0) return agents
    let next = agents
    for (let i = 0; i < 2; i++) {
      const one = pick(demo)
      const roll = Math.random()
      next = patchAgent(next, one.id, a => {
        if (a.status !== 'working') return roll < 0.5 ? setStatus(a, 'working', now) : a
        if (roll < 0.15) return setStatus(a, 'done', now)
        if (roll < 0.2) return setStatus(a, 'failed', now)
        if (roll < 0.3) return { ...a, tool: null, toolId: null, detail: null }

        return startTool(a, pick(DEMO_TOOLS), `demo-${now}-${i}`, 'demo', now)
      })
    }

    return next
  })
}

async function select($: Engine, id: string | null): Promise<void> {
  await update($, selectedAtom, current => (current === id ? null : id))
}

/**
 * Changes the look of one agent, or of every agent of its type; a look for
 * the type takes the place of the agent's own, so the picked one shows it.
 * `null` takes the choice back. Choices for types and the manager are kept
 * for later sessions.
 */
async function restyle(
  $: Engine,
  agent: Pick<FactoryAgent, 'id' | 'isMain' | 'type'>,
  scope: StyleScope,
  change: (style: AgentStyle) => AgentStyle | null,
): Promise<void> {
  const key = styleKey(agent, scope)
  const looks = await read($, looksAtom)
  const styles = await update($, stylesAtom, all => {
    const next = { ...all }
    const style = change(baseStyle(agent, scope, all, looks))
    if (scope === 'type') delete next[styleKey(agent, 'agent')]
    if (style === null) delete next[key]
    else next[key] = style

    return next
  })
  await $.store.set('styles', lastingStyles(styles))
}

async function setLooks($: Engine, looks: LooksMode): Promise<void> {
  await update($, looksAtom, () => looks)
  await $.store.set('looks', looks)
}

const STATUS_THEME: Record<AgentStatus, string> = {
  working: 'claude',
  waiting: 'warning',
  sleeping: 'inactive',
  done: 'success',
  failed: 'error',
}

function summary(agents: readonly FactoryAgent[]): string {
  const count = (test: (a: FactoryAgent) => boolean) => agents.filter(test).length
  const parts = [
    `${count(a => a.status === 'working')} working`,
    `${count(a => a.status === 'waiting')} waiting`,
    `${count(a => a.status === 'sleeping' || a.status === 'done')} resting`,
  ]
  const failed = count(a => a.status === 'failed')
  if (failed > 0) parts.push(`${failed} failed`)

  return parts.join(' · ')
}

function altText(agents: readonly FactoryAgent[]): string {
  return `${TITLE}: ${agents.map(describeAgent).join('; ')}`.slice(0, 1000)
}

const options = (names: readonly string[]) => names.map(value => ({ value, label: prettyName(value) }))

/** Pickers for color, hat and extra: lists where the surface has them, else buttons that step through. */
function pickers(
  $: Engine,
  { Box, Button, Select }: Table,
  selected: FactoryAgent,
  scope: StyleScope,
  shown: AgentStyle,
) {
  const set = (change: Partial<AgentStyle>) => restyle($, selected, scope, style => ({ ...style, ...change }))
  if (Select !== undefined) {
    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Select
          key="pick-color"
          label="Color"
          options={options(COLOR_NAMES)}
          value={shown.color}
          onSelect={value => void set({ color: value as ColorName })}
        />
        <Select
          key="pick-hat"
          label="Hat"
          options={options(HAT_NAMES)}
          value={shown.hat}
          onSelect={value => void set({ hat: value as HatName })}
        />
        <Select
          key="pick-extra"
          label="Extra"
          options={options(ACCESSORY_NAMES)}
          value={shown.accessory}
          onSelect={value => void set({ accessory: value as AccessoryName })}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
      <Button
        key="style-color"
        label={`Color: ${prettyName(shown.color)}`}
        onPress={() => set({ color: cycle(STYLE_CHOICES.color, shown.color) })}
      />
      <Button key="style-hat" label={`Hat: ${prettyName(shown.hat)}`} onPress={() => set({ hat: cycle(STYLE_CHOICES.hat, shown.hat) })} />
      <Button
        key="style-extra"
        label={`Extra: ${prettyName(shown.accessory)}`}
        onPress={() => set({ accessory: cycle(STYLE_CHOICES.accessory, shown.accessory) })}
      />
    </Box>
  )
}

/** The legend under the picture, and the style controls of the agent picked from it. */
function controls(
  $: Engine,
  ui: Table,
  agents: readonly FactoryAgent[],
  { styles, looks }: Wardrobe,
  selected: FactoryAgent | undefined,
  scope: StyleScope,
  width: number,
) {
  const { Box, Text, Button } = ui
  const sorted = [...agents].sort((a, b) => a.seat - b.seat)
  const hasFinished = agents.some(a => !a.isMain && (a.status === 'done' || a.status === 'failed' || a.status === 'sleeping'))
  const reach: StyleScope = selected?.isMain ? 'type' : scope

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {summary(agents)} · pick an agent to dress it up
      </Text>
      {sorted.map(agent => {
        const doing = describeAgent(agent).split(' · ')[1] ?? agent.status
        return (
          <Button key={`agent-${agent.id}`} plain onPress={() => select($, agent.id)}>
            <Text color={hex(COLORS[styleOf(agent, styles, looks).color])}>■ </Text>
            {clip(agent.label, 16)}{' '}
            <Text color={STATUS_THEME[agent.status]}>{clip(doing, Math.max(10, width - 22))}</Text>
          </Button>
        )
      })}
      {selected !== undefined && (
        <Box flexDirection="column" marginTop={1} rowGap={1}>
          <Text weight="bold">Dressing {selected.isMain ? 'the manager' : selected.label}</Text>
          {!selected.isMain && (
            <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
              <Text dimColor>For</Text>
              <Button
                key="scope-agent"
                label="this agent"
                variant={reach === 'agent' ? 'primary' : 'secondary'}
                onPress={() => update($, scopeAtom, () => 'agent')}
              />
              <Button
                key="scope-type"
                label={`every ${selected.type} agent`}
                variant={reach === 'type' ? 'primary' : 'secondary'}
                onPress={() => update($, scopeAtom, () => 'type')}
              />
            </Box>
          )}
          {pickers($, ui, selected, reach, baseStyle(selected, reach, styles, looks))}
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Button
              key="style-random"
              label="Random"
              onPress={async () => {
                const seed = await $.clock.now()
                await restyle($, selected, reach, () => randomStyle(seed))
              }}
            />
            <Button key="style-reset" label="Reset" onPress={() => restyle($, selected, reach, () => null)} />
            {!selected.isMain && !selected.isDemo && (
              <Button key="style-view" label="Transcript" onPress={() => $.ui.view({ agentId: selected.id })} />
            )}
            <Button key="style-done" label="Done" variant="primary" onPress={() => select($, null)} />
          </Box>
        </Box>
      )}
      {selected === undefined && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Button
            key="looks"
            label={looks === 'random' ? 'Undressed agents: random looks' : 'Undressed agents: looks by type'}
            onPress={() => setLooks($, looks === 'random' ? 'type' : 'random')}
          />
          {hasFinished && (
            <Button key="clear-finished" label="Send finished agents home" onPress={() => mutate($, list => clearFinished(list))} />
          )}
        </Box>
      )}
    </Box>
  )
}

const HELP = [
  '/factory — open or close the Agent Factory pane',
  '/factory style <who> color=<c> hat=<h> extra=<e> — dress the manager (main), every agent of a type, or one agent by its name tag',
  '/factory reset [who] — back to the default looks',
  '/factory looks random|type — how agents nobody dressed look: each its own by lot, or dressed for their type',
  '/factory clear — send finished agents home',
  '/factory demo — add or remove pretend agents, to see the floor busy',
  '/factory options — list the colors, hats and extras',
].join('\n')

type Target = { agent: Pick<FactoryAgent, 'id' | 'isMain' | 'type'>; scope: StyleScope; name: string }

/** Who a `/factory style` names: the manager, a type on the floor, an agent by its name tag, or any type. */
function targetOf(word: string, agents: readonly FactoryAgent[]): Target {
  if (/^(main|manager|claude|boss)$/i.test(word)) return { agent: mainAgent(0), scope: 'type', name: 'The manager' }
  const lower = word.toLowerCase()
  const ofType = agents.find(a => !a.isMain && a.type.toLowerCase() === lower)
  if (ofType !== undefined) return { agent: ofType, scope: 'type', name: `Every ${ofType.type} agent` }
  const tagged = agents.find(a => !a.isMain && a.label.toLowerCase() === lower)
  if (tagged !== undefined) return { agent: tagged, scope: 'agent', name: tagged.label }

  return { agent: { id: '', isMain: false, type: word }, scope: 'type', name: `Every ${word} agent` }
}

async function runCommand($: Engine, args: string): Promise<string> {
  const words = args.trim().split(/\s+/).filter(Boolean)
  const verb = words[0]?.toLowerCase()

  if (verb === undefined || verb === 'open' || verb === 'close') {
    const pane = (await $.ui.panes()).find(one => one.id === PANE)
    if (verb !== 'open' && pane?.isShown === true) {
      await $.store.set('isClosed', true)
      await $.ui.close({ id: PANE })
      return 'Agent Factory closed; /factory opens it again.'
    }
    await $.store.set('isClosed', false)
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    return opened.isPlaced ? 'Agent Factory is open.' : `Agent Factory could not open: ${opened.reason}`
  }

  const agents = withMain(await read($, agentsAtom), await $.clock.now())

  switch (verb) {
    case 'style': {
      const who = words[1]
      if (who === undefined || words.length < 3) return `Usage: /factory style <who> color=<c> hat=<h> extra=<e>\n\n${HELP}`
      const parsed = parseStyle(words.slice(2))
      if ('error' in parsed) return `Unknown style "${parsed.error}". /factory options lists them.`
      const target = targetOf(who, agents)
      await restyle($, target.agent, target.scope, style => ({ ...style, ...parsed.change }))
      const { styles, looks } = await wardrobeOf($)
      const style = baseStyle(target.agent, target.scope, styles, looks)
      return `${target.name} now wears: ${prettyName(style.color)}, ${prettyName(style.hat)} hat, ${prettyName(style.accessory)}.`
    }
    case 'reset': {
      const who = words[1]
      if (who === undefined) {
        await update($, stylesAtom, () => ({}))
        await $.store.set('styles', {})
        return 'Every agent is back to its default look.'
      }
      const target = targetOf(who, agents)
      await restyle($, target.agent, target.scope, () => null)
      return `${target.name}: back to the default look.`
    }
    case 'looks': {
      const mode = words[1]?.toLowerCase()
      if (mode !== 'random' && mode !== 'type') return 'Usage: /factory looks random|type'
      await setLooks($, mode)
      return mode === 'random'
        ? 'Agents nobody dressed now each get a look by lot.'
        : 'Agents nobody dressed now dress for their type.'
    }
    case 'clear':
      await mutate($, list => clearFinished(list))
      return 'Finished agents went home.'
    case 'demo':
      if (await read($, demoAtom)) {
        await stopDemo($)
        return 'The pretend agents went home.'
      }
      await startDemo($)
      await $.ui.open({ id: PANE, title: TITLE })
      return 'Six pretend agents joined the floor; /factory demo sends them home.'
    case 'options':
      return [
        `Colors: ${COLOR_NAMES.join(', ')}`,
        `Hats: ${HAT_NAMES.join(', ')}`,
        `Extras: ${ACCESSORY_NAMES.join(', ')}`,
      ].join('\n')
    default:
      return HELP
  }
}

function isStyles(value: unknown): value is Record<string, AgentStyle> {
  if (typeof value !== 'object' || value === null) return false

  return Object.values(value).every(
    style =>
      typeof style === 'object' &&
      style !== null &&
      (COLOR_NAMES as string[]).includes((style as AgentStyle).color) &&
      (HAT_NAMES as string[]).includes((style as AgentStyle).hat) &&
      (ACCESSORY_NAMES as string[]).includes((style as AgentStyle).accessory),
  )
}

/** Shows an agent at work with a tool, and back to thinking once the tool is done. */
async function watchTool<E extends ToolCallInput, R>($: Engine, e: E, next: (e: E) => Promise<R>): Promise<R> {
  const id = e.agentId ?? MAIN_ID
  const toolId = e.tool_use_id ?? `${e.tool}-${Math.random()}`
  let isSeated = false
  await quietly($, 'tool start', async () => {
    isSeated = await ensureAgent($, id)
    if (!isSeated) return
    const detail = toolDetail(e.tool, e as unknown as Record<string, unknown>)
    await mutate($, (agents, now) => patchAgent(agents, id, a => startTool(a, e.tool, toolId, detail, now)))
  })
  const ran = await next(e)
  if (isSeated) {
    await quietly($, 'tool end', () => mutate($, agents => patchAgent(agents, id, a => endTool(a, toolId))))
  }

  return ran
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(TICK_MS, () => void tick($).catch(() => undefined))
    $.clock.every(RECONCILE_MS, () => void quietly($, 'reconcile', () => reconcile($)))
    await quietly($, 'styles', async () => {
      const stored = await $.store.get('styles')
      if (isStyles(stored)) await update($, stylesAtom, current => ({ ...stored, ...current }))
      const looks = await $.store.get('looks')
      if (looks === 'random' || looks === 'type') await update($, looksAtom, () => looks)
      await mutate($, agents => agents)
    })
    await quietly($, 'command', () =>
      $.command.register({
        name: 'factory',
        description: 'Agent Factory: watch your agents work at their desks, and dress them up',
        argumentHint: '[style <who> color=… hat=… extra=… | reset | clear | demo | options]',
      }),
    )
    await quietly($, 'open', async () => {
      if ((await $.store.get('isClosed')) !== true) void $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
    })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await quietly($, 'clear', async () => {
        const now = await $.clock.now()
        await mutate($, () => [mainAgent(now)])
        await update($, demoAtom, () => false)
        await update($, stylesAtom, lastingStyles)
      })
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const id = e.agentId ?? MAIN_ID
    await quietly($, 'turn start', async () => {
      if (await ensureAgent($, id)) await mutate($, (agents, now) => patchAgent(agents, id, a => setStatus(a, 'working', now)))
    })

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? MAIN_ID
    await quietly($, 'turn end', () =>
      mutate($, (agents, now) =>
        patchAgent(agents, id, a => {
          const isError = e.reason === 'error' || e.reason === 'refusal'
          if (isError) return setStatus(a, 'failed', now)
          if (a.isMain || a.isTeammate) return setStatus(a, 'waiting', now)
          if (e.reason === 'aborted') return { ...setStatus(a, 'sleeping', now), outcome: null }

          return setStatus(a, 'done', now)
        }),
      ),
    )

    return next(e)
  })

  // Two hooks, so a subagent's own tool calls, made while the Agent call that
  // started it is still running, do not land in the hook that is waiting on it.
  on('tool.call', { tool: 'Agent' }, ($, e, next) => watchTool($, e, next))
  on('tool.call', { tool: /^(?!Agent$)/ }, ($, e, next) => watchTool($, e, next))

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') await quietly($, 'close', () => $.store.set('isClosed', true))
    mounted = null

    return next(e)
  })

  on('command.run', { command: 'factory' }, async ($, e) => ({ text: await runCommand($, e.args) }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const agents = withMain(await read($, agentsAtom), 0)
    const wardrobe = await wardrobeOf($)
    const picked = await read($, selectedAtom)
    const scope = await read($, scopeAtom)
    const selected = agents.find(a => a.id === picked)
    selectedId = selected?.id ?? null
    const scene = sceneOf(agents, wardrobe)
    const seats = seatsNeeded(scene)
    const width = e.props.bodyColumns

    if (e.surface === 'terminal') {
      const ui = $.ui.resolve(e)
      const { Box, Raster } = ui
      const isFlat = e.props.placement === 'inline'
      const maxCols = colsFor(width, 'snug')
      const lay = layout(seats, maxCols, { isFlat, spacing: 'snug' })
      const picture = rasterCells(drawScene(lay, scene, frame, selected?.seat), sceneLabels(lay, scene, STATION_W - 2))
      mounted = { columns: picture.columns, rows: picture.rows, maxCols, isFlat }

      return (
        <Box flexDirection="column">
          <Raster key={RASTER} columns={picture.columns} rows={picture.rows} cells={picture.cells} />
          {controls($, ui, agents, wardrobe, selected, scope, width)}
        </Box>
      )
    }

    // The remote surfaces draw an SVG that plays its own frames.
    const ui = $.ui.resolve(e)
    const { Box, Svg } = ui
    // The mobile app draws no lists yet: its pickers are buttons.
    const table: Table = e.surface === 'mobile' ? { Box, Text: ui.Text, Button: ui.Button } : ui
    const lay = layout(seats, REMOTE_COLS, { spacing: 'roomy' })
    const frames = Array.from({ length: FRAMES }, (_, f) => drawScene(lay, scene, f, selected?.seat))
    const source = sceneSvg(frames, sceneLabels(lay, scene, 10), sceneHotspots(lay, scene, describeAgent), {
      scale: REMOTE_SCALE,
      secondsPerFrame: TICK_MS / 1000,
    })

    return (
      <Box flexDirection="column" rowGap={1}>
        <Svg source={source} alt={altText(agents)} isInteractive />
        {controls($, table, agents, wardrobe, selected, scope, width)}
      </Box>
    )
  })
}
