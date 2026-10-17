import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, On } from 'claude-code'

import type { FactoryAgent } from '../types'
import { addAgent, clearFinished, mainAgent, parseStyle, settle, DONE_DOZE_MS, MAIN_DOZE_MS } from '../hooks/model'
import { drawScene, layout, stationOrigin } from '../hooks/scene'
import { rasterCells, sceneSvg, SVG_LIMIT } from '../hooks/paint'

const PLUGIN = 'agent-factory'

const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'agent-factory',
  props: {
    title: 'Agent Factory',
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

  test('a flat pane spends width before height', () => {
    expect(layout(7, 7, true).rows).toBe(1)
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

/** `/factory <args>` typed at the prompt. */
const factory = (args: string) =>
  ({ command: 'factory', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } }) as const

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

  test('/factory style dresses every agent of a type', async ($, on) => {
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

  test('picking an agent shows its style, and Color moves to the next one', async ($, on) => {
    engine(on, [])
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      await ui.press({ key: 'agent-main' })
      const before = (await ui.find({ key: 'style-color' }))?.props.label
      await ui.press({ key: 'style-color' })
      const after = (await ui.find({ key: 'style-color' }))?.props.label
      expect(before).not.toBe(after)
      await ui.press({ key: 'style-reset' })
      expect((await ui.find({ key: 'style-color' }))?.props.label).toBe('Color: clay')
      await ui.press({ key: 'style-done' })
      expect(await ui.find({ key: 'style-color' })).toBeUndefined()
      await ui.unmount()
    }
  })
})
