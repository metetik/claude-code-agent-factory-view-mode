import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, On } from 'claude-code'

import type { FactoryAgent } from '../types'
import {
  addAgent,
  clearFinished,
  defaultStyle,
  mainAgent,
  parseStyle,
  randomStyle,
  settle,
  styleOf,
  DONE_DOZE_MS,
  MAIN_DOZE_MS,
} from '../hooks/model'
import { drawScene, layout, stationOrigin } from '../hooks/scene'
import { quadrantCell, rasterCells, sceneSvg, SVG_LIMIT } from '../hooks/paint'

const PLUGIN = 'factory-view'

const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'factory-view',
  props: {
    title: 'Factory View',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const explorer: AgentInfo = {
  id: 'agent-1',
  description: 'Map the repository',
  type: 'Explore',
  status: 'running',
}

describe('the floor plan', () => {
  test('the manager sits in the middle and the others ring around it', () => {
    const lay = layout(9, 7)
    expect(lay.cols).toBe(3)
    expect(lay.rows).toBe(3)
    expect(lay.cells[0]).toEqual({ col: 1, row: 1 })
    expect(lay.cells[1]).toEqual({ col: 0, row: 1 })
    expect(lay.cells[2]).toEqual({ col: 2, row: 1 })
  })

  test('a narrow pane stacks the desks in a column', () => {
    const lay = layout(3, 1)
    expect(lay.cols).toBe(1)
    expect(lay.rows).toBe(3)
  })

  test('each terminal size takes less room than the one above it', () => {
    const cells = (art: 'large' | 'medium' | 'small') => {
      const lay = layout(9, 3, { art })
      return { columns: lay.isQuad ? lay.width / 2 : lay.width, rows: lay.height / 2, lay }
    }
    const [large, medium, small] = [cells('large'), cells('medium'), cells('small')]
    expect(medium.columns).toBeLessThan(large.columns)
    expect(small.columns).toBeLessThan(medium.columns)
    expect(medium.rows).toBeLessThan(large.rows)
    expect(small.rows).toBeLessThan(medium.rows)
    for (const { lay } of [large, medium, small]) {
      // Desks start on even rows so name tags keep to whole cells, and on
      // even columns too where a cell is two pixels wide.
      expect(stationOrigin(lay, 8)!.y % 2).toBe(0)
      if (lay.isQuad) expect(stationOrigin(lay, 8)!.x % 2).toBe(0)
    }
  })

  test('a quarter-block cell paints its two commonest colors', () => {
    const [a, b, c] = [0x111111, 0xeeeeee, 0xdddddd]
    expect(quadrantCell([a, a, b, b])).toEqual({ ch: 0x2584, fg: b, bg: a })
    expect(quadrantCell([a, a, a, b])).toEqual({ ch: 0x2597, fg: b, bg: a })
    expect(quadrantCell([a, a, a, a]).ch).toBe(0x20)
    expect(quadrantCell([a, b, c, a]).ch).toBe(0x259e)
  })

  test('a flat pane spends width before height', () => {
    expect(layout(7, 7, { isFlat: true }).rows).toBe(1)
    expect(layout(7, 7).rows).toBe(3)
  })

  test('the terminal picture is two pixels a cell and the SVG stays in bounds', () => {
    let agents: FactoryAgent[] = [mainAgent(0)]
    for (let i = 1; i <= 24; i++) agents = addAgent(agents, { id: `a${i}`, type: `type${i}`, label: `a${i}`, description: '' }, 0)
    const scene = agents.map(agent => ({ agent, style: { color: 'clay', hat: 'wizard', accessory: 'scarf' } as const }))
    const lay = layout(25, 7)
    const canvas = drawScene(lay, scene, 0)
    const picture = rasterCells(canvas, [])
    expect(picture.columns).toBe(lay.width)
    expect(picture.rows).toBe(Math.ceil(lay.height / 2))
    const frames = Array.from({ length: 8 }, (_, f) => drawScene(lay, scene, f))
    expect(sceneSvg(frames, [], [], { scale: 4, secondsPerFrame: 0.25 }).length).toBeLessThanOrEqual(SVG_LIMIT)
    expect(stationOrigin(lay, 24)).toBeDefined()
  })
})

describe('the agents', () => {
  test('a new agent takes the nearest free desk, and a full floor sends the oldest finished one home', () => {
    let agents: FactoryAgent[] = [mainAgent(0)]
    for (let i = 1; i <= 24; i++) agents = addAgent(agents, { id: `a${i}`, type: 'Explore', label: '', description: '' }, i)
    expect(agents.map(a => a.seat)).toEqual(Array.from({ length: 25 }, (_, i) => i))
    agents = agents.map(a => (a.id === 'a3' ? { ...a, status: 'done' as const, since: 1 } : a))
    agents = addAgent(agents, { id: 'late', type: 'Plan', label: '', description: '' }, 100)
    expect(agents.find(a => a.id === 'a3')).toBeUndefined()
    expect(agents.find(a => a.id === 'late')?.seat).toBe(3)
  })

  test('waiting and finished agents doze off, and finished ones can be sent home', () => {
    const agents = addAgent([mainAgent(0)], { id: 'a1', type: 'Explore', label: '', description: '', status: 'done' }, 0)
    expect(settle(agents, 1000)).toBeNull()
    const later = settle(agents, MAIN_DOZE_MS + DONE_DOZE_MS) ?? []
    expect(later.map(a => a.status)).toEqual(['sleeping', 'sleeping'])
    expect(clearFinished(later).map(a => a.id)).toEqual(['main'])
  })

  test('undressed agents draw a look of their own by lot, or dress for their type', () => {
    const one = { id: 'agent-1', isMain: false, type: 'Explore' }
    const two = { id: 'agent-2', isMain: false, type: 'Explore' }
    expect(defaultStyle(one, 'random')).toEqual(defaultStyle(one, 'random'))
    expect(defaultStyle(one, 'random')).not.toEqual(defaultStyle(two, 'random'))
    expect(defaultStyle(one, 'type')).toEqual(defaultStyle(two, 'type'))
    expect(defaultStyle(mainAgent(0), 'random')).toEqual({ color: 'clay', hat: 'crown', accessory: 'tie' })
    for (let seed = 0; seed < 300; seed++) {
      const style = randomStyle(seed)
      expect(style.color).not.toBe('clay')
      expect(style.hat).not.toBe('crown')
    }
  })

  test("an agent's own look wins over its type's, and its type's over the default", () => {
    const one = { id: 'agent-1', isMain: false, type: 'Explore' }
    const viking = { color: 'snow', hat: 'viking', accessory: 'none' } as const
    const chef = { color: 'sun', hat: 'chef', accessory: 'mustache' } as const
    expect(styleOf(one, { 'type:Explore': chef })).toEqual(chef)
    expect(styleOf(one, { 'type:Explore': chef, 'agent:agent-1': viking })).toEqual(viking)
  })

  test('style words parse, and an unknown one is named', () => {
    expect(parseStyle(['color=sky', 'hat=crown', 'extra=tie'])).toEqual({ change: { color: 'sky', hat: 'crown', accessory: 'tie' } })
    expect(parseStyle(['hat=sombrero'])).toEqual({ error: 'hat=sombrero' })
  })
})

/** The engine beneath the plugins: the agent list, and turns that just end. */
function engine(on: On, agents: AgentInfo[]): void {
  mock.clock(on, { now: 1000 })
  mock.store(on)
  on('agent.list', () => ({ value: agents }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
}

/** `/factory-view <args>` typed at the prompt. */
const factory = (args: string) =>
  ({ command: 'factory-view', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } }) as const

/** What the legend says of one agent: its line's text, every part of it. */
async function legendLine(ui: { find: (q: { key: string }) => Promise<{ children: unknown[] } | undefined> }, id: string) {
  const button = await ui.find({ key: `agent-${id}` })
  const flat = (node: unknown): string =>
    typeof node === 'string'
      ? node
      : typeof node === 'object' && node !== null && 'children' in node
        ? ((node as { children: unknown[] }).children ?? []).map(flat).join('')
        : ''

  return button === undefined ? undefined : flat(button)
}

describe('the session', () => {
  test("a subagent's turn seats it at work, and its end marks it done", async ($, on) => {
    engine(on, [explorer])
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await $.turn.start({ text: 'Map it', turnId: 't1', agentId: 'agent-1' })
    expect(await legendLine(ui, 'agent-1')).toContain('thinking')

    await $.turn.complete({ answer: 'done', durationMs: 5, isAborted: false, turnId: 't1', agentId: 'agent-1', reason: 'answer' })
    expect(await legendLine(ui, 'agent-1')).toContain('done')
    await ui.unmount()
  })

  test('a tool call shows on the agent while it runs and clears after', async ($, on) => {
    engine(on, [])
    let during: string | undefined
    let read = async (): Promise<string | undefined> => undefined
    on('tool.call', async () => {
      during = await read()
      return { result: 'ok' }
    })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    read = () => legendLine(ui, 'main')
    await $.tool.call({ tool: 'Read', file_path: '/repo/src/parser.ts' })
    expect(during).toContain('Read: parser.ts')
    expect(await legendLine(ui, 'main')).toContain('thinking')
    await ui.unmount()
  })

  test('a loop the agent list does not name is left off the floor', async ($, on) => {
    engine(on, [])
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await $.turn.start({ text: '', turnId: 't2', agentId: 'compaction-fork' })
    expect(await legendLine(ui, 'compaction-fork')).toBeUndefined()
    expect(await legendLine(ui, 'main')).toBeDefined()
    await ui.unmount()
  })

  test('/factory-view style dresses every agent of a type', async ($, on) => {
    engine(on, [explorer])
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    await $.turn.start({ text: 'Map it', turnId: 't1', agentId: 'agent-1' })
    const { text } = await $.command.run(factory('style Explore color=rose hat=crown extra=shades'))
    expect(text).toContain('Every Explore agent')
    const swatches = (await ui.findAll({ type: 'Text' })).map(found => found.props.color)
    expect(swatches).toContain('#ee7e9b')
    const { text: refused } = await $.command.run(factory('style Explore hat=sombrero'))
    expect(refused).toContain('hat=sombrero')
    await ui.unmount()
  })
})

describe('the pane', () => {
  test('draws a Raster on the terminal and an SVG elsewhere, with a legend', async ($, on) => {
    engine(on, [])
    for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      const picture = surface === 'terminal' ? await ui.find({ type: 'Raster' }) : await ui.find({ type: 'Svg' })
      expect(picture).toBeDefined()
      expect(await ui.find({ key: 'agent-main' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('picking an agent lets you choose its color, hat and extra from lists', async ($, on) => {
    engine(on, [])
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      await ui.press({ key: 'agent-main' })
      expect((await ui.find({ key: 'pick-color' }))?.props.value).toBe('clay')
      await ui.select({ key: 'pick-color', value: 'sky' })
      await ui.select({ key: 'pick-hat', value: 'wizard' })
      expect((await ui.find({ key: 'pick-color' }))?.props.value).toBe('sky')
      expect((await ui.find({ key: 'pick-hat' }))?.props.value).toBe('wizard')
      await ui.press({ key: 'style-reset' })
      expect((await ui.find({ key: 'pick-color' }))?.props.value).toBe('clay')
      await ui.press({ key: 'style-done' })
      expect(await ui.find({ key: 'pick-color' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('mobile, with no lists, steps through the choices with buttons', async ($, on) => {
    engine(on, [])
    const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
    await ui.press({ key: 'agent-main' })
    expect((await ui.find({ key: 'style-color' }))?.props.label).toBe('Color: clay')
    await ui.press({ key: 'style-color' })
    expect((await ui.find({ key: 'style-color' }))?.props.label).toBe('Color: tangerine')
    await ui.unmount()
  })

  test('a look goes to the picked agent alone, or to every agent of its type', async ($, on) => {
    engine(on, [
      explorer,
      { id: 'agent-2', description: 'Find the tests', type: 'Explore', status: 'running' },
    ])
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    await $.turn.start({ text: 'a', turnId: 't1', agentId: 'agent-1' })
    await $.turn.start({ text: 'b', turnId: 't2', agentId: 'agent-2' })
    const hatOf = async (id: string) => {
      await ui.press({ key: `agent-${id}` })
      const hat = (await ui.find({ key: 'pick-hat' }))?.props.value
      await ui.press({ key: 'style-done' })
      return hat
    }

    await ui.press({ key: 'agent-agent-1' })
    await ui.select({ key: 'pick-hat', value: 'viking' })
    await ui.press({ key: 'style-done' })
    expect(await hatOf('agent-1')).toBe('viking')
    expect(await hatOf('agent-2')).not.toBe('viking')

    await ui.press({ key: 'agent-agent-1' })
    await ui.press({ key: 'scope-type' })
    await ui.select({ key: 'pick-hat', value: 'chef' })
    await ui.press({ key: 'style-done' })
    expect(await hatOf('agent-1')).toBe('chef')
    expect(await hatOf('agent-2')).toBe('chef')
    await ui.unmount()
  })

  test('the terminal draws medium agents unless asked for small or large ones', async ($, on) => {
    engine(on, [])
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const columns = async () => (await ui.find({ type: 'Raster' }))?.props.columns
    expect(await columns()).toBe(54)
    expect((await ui.find({ key: 'size' }))?.props.label).toBe('Size: medium')
    const { text } = await $.command.run(factory('size small'))
    expect(text).toContain('small')
    expect(await columns()).toBe(42)
    await ui.press({ key: 'size' })
    expect(await columns()).toBe(54)
    await ui.press({ key: 'size' })
    expect(await columns()).toBe(66)
    expect((await $.command.run(factory('size huge'))).text).toContain('Usage')
    await ui.unmount()
  })

  test('/factory-view looks switches how undressed agents look', async ($, on) => {
    engine(on, [])
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect((await ui.find({ key: 'looks' }))?.props.label).toBe('Undressed agents: random looks')
    const { text } = await $.command.run(factory('looks type'))
    expect(text).toContain('type')
    expect((await ui.find({ key: 'looks' }))?.props.label).toBe('Undressed agents: looks by type')
    await ui.press({ key: 'looks' })
    expect((await ui.find({ key: 'looks' }))?.props.label).toBe('Undressed agents: random looks')
    await ui.unmount()
  })
})
