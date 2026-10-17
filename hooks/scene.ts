import type { AgentStyle, FactoryAgent } from '../types'
import {
  ACCESSORIES,
  BANG,
  BIG_Z,
  CHECK,
  COLORS,
  HATS,
  ICONS,
  INK,
  SMALL_Z,
  shade,
  type IconName,
  type Sprite,
} from './sprites'

/** A grid of opaque 0xRRGGBB pixels. */
export class Canvas {
  readonly px: Uint32Array

  constructor(
    readonly width: number,
    readonly height: number,
    fill = 0,
  ) {
    this.px = new Uint32Array(width * height).fill(fill)
  }

  get(x: number, y: number): number {
    return this.px[y * this.width + x] ?? 0
  }

  set(x: number, y: number, color: number): void {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      this.px[y * this.width + x] = color
    }
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, color)
      }
    }
  }

  /** Draws a sprite, each letter through `paint`; `.` and unknown letters are see-through. */
  sprite(x: number, y: number, rows: Sprite, paint: (ch: string) => number | undefined = ch => INK[ch]): void {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx]!
        const color = ch === '.' ? undefined : paint(ch)
        if (color !== undefined) {
          this.set(x + dx, y + dy, color)
        }
      }
    })
  }
}

/** Text laid over the picture: one glyph per pixel column, on an even pixel row. */
export type Label = { x: number; y: number; width: number; text: string; color: number }

/** A desk's rectangle, for the hover text the remote surfaces show. */
export type Hotspot = { x: number; y: number; width: number; height: number; title: string }

export type SceneAgent = { agent: FactoryAgent; style: AgentStyle }

export const STATION_W = 22
export const STATION_H = 22
const WALL_H = 10
const FLAT_WALL_H = 2

/**
 * Floor between the desks: snug on the terminal, where a pixel is a cell,
 * roomy where the picture is scaled. Vertical gaps stay even, so the name
 * tags keep to whole terminal rows.
 */
export type Spacing = 'snug' | 'roomy'

const SPACINGS: Record<Spacing, { gapX: number; gapY: number; margin: number; bottom: number }> = {
  snug: { gapX: 4, gapY: 2, margin: 3, bottom: 2 },
  roomy: { gapX: 10, gapY: 6, margin: 8, bottom: 6 },
}
/** Frames in one loop of every animation; the SVG plays them at 4 a second. */
export const FRAMES = 8

export type Layout = {
  cols: number
  rows: number
  /** Pixel rows of wall above the desks. */
  wall: number
  spacing: Spacing
  /** Cell of each seat: seat 0, the manager's, sits in the middle. */
  cells: { col: number; row: number }[]
  width: number
  height: number
}

/** How wide `cols` desks across are, in pixels. */
export function sceneWidth(cols: number, spacing: Spacing = 'snug'): number {
  const { gapX, margin } = SPACINGS[spacing]

  return margin * 2 + cols * STATION_W + (cols - 1) * gapX
}

/** How many desks fit across `width` pixels. */
export function colsFor(width: number, spacing: Spacing = 'snug'): number {
  const { gapX, margin } = SPACINGS[spacing]

  return Math.max(1, Math.floor((width - margin * 2 + gapX) / (STATION_W + gapX)))
}

/**
 * The desks of `seatCount` seats: the manager's in the middle of an odd grid
 * and the others ringed around it, nearest first; on a narrow floor, a column.
 * `isFlat` spends width before height and lowers the wall, for a pane above
 * the prompt.
 */
export function layout(
  seatCount: number,
  maxCols: number,
  { isFlat = false, spacing = 'snug' }: { isFlat?: boolean; spacing?: Spacing } = {},
): Layout {
  let cols: number
  let rows: number
  let cells: { col: number; row: number }[]

  if (maxCols < 3) {
    cols = Math.max(1, maxCols)
    rows = Math.max(1, Math.ceil(seatCount / cols))
    cells = []
    for (let i = 0; i < cols * rows; i++) {
      cells.push({ col: i % cols, row: Math.floor(i / cols) })
    }
  } else {
    const seats = Math.max(3, seatCount)
    cols = 3
    rows = 1
    for (let r = 1; r < 64; r += 2) {
      let c = Math.max(3, Math.ceil(seats / r))
      if (c % 2 === 0) c++
      if (c <= maxCols && (isFlat || c <= r + 2)) {
        cols = c
        rows = r
        break
      }
    }
    const cx = (cols - 1) / 2
    const cy = (rows - 1) / 2
    cells = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        cells.push({ col, row })
      }
    }
    const rank = (cell: { col: number; row: number }) => {
      const dx = cell.col - cx
      const dy = cell.row - cy
      return [Math.max(Math.abs(dx), Math.abs(dy)), Math.abs(dy), Math.abs(dx), dy, dx]
    }
    cells.sort((a, b) => {
      const ra = rank(a)
      const rb = rank(b)
      for (let i = 0; i < ra.length; i++) {
        if (ra[i] !== rb[i]) return ra[i]! - rb[i]!
      }
      return 0
    })
  }

  const wall = isFlat ? FLAT_WALL_H : WALL_H
  const { gapY, bottom } = SPACINGS[spacing]

  return {
    cols,
    rows,
    wall,
    spacing,
    cells,
    width: sceneWidth(cols, spacing),
    height: wall + rows * STATION_H + (rows - 1) * gapY + bottom,
  }
}

export function stationOrigin(lay: Layout, seat: number): { x: number; y: number } | undefined {
  const cell = lay.cells[seat]
  if (cell === undefined) return undefined

  const { gapX, gapY, margin } = SPACINGS[lay.spacing]

  return { x: margin + cell.col * (STATION_W + gapX), y: lay.wall + cell.row * (STATION_H + gapY) }
}

/** A small number per agent, so desks side by side do not move in step. */
export function phaseOf(id: string): number {
  let h = 7
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }

  return h % FRAMES
}

export function iconFor(tool: string | null): IconName {
  if (tool === null) return 'think'
  if (/^(Read|Grep|Glob|LS|LSP|NotebookRead|ToolSearch)$/.test(tool)) return 'search'
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'edit'
  if (/^(Bash|BashOutput|KillShell|KillBash|PowerShell|Monitor|TaskOutput|TaskStop)$/.test(tool)) return 'shell'
  if (/^(WebFetch|WebSearch)$/.test(tool) || /browser|chrome|fetch/i.test(tool)) return 'web'
  if (/^(Agent|Task|SendMessage|Skill|TeamCreate)$/.test(tool)) return 'delegate'
  if (/^(TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet|EnterPlanMode|ExitPlanMode)$/.test(tool)) return 'todo'
  if (tool === 'AskUserQuestion') return 'ask'

  return 'tool'
}

const FLOOR_A = 0x353c4b
const FLOOR_B = 0x3a4253
const WALL = 0x4b5468
const WALL_DARK = 0x404859
const BASEBOARD = 0x2b303b
const RUG = 0x7a2e3a
const RUG_EDGE = 0xd4a73c
const CHAIR = 0x2f343f
const CHAIR_LIGHT = 0x454c59
const SCREEN_OFF = 0x14171d
const MONITOR = 0x23272f

function drawFloor(c: Canvas, wall: number): void {
  for (let y = wall; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const isA = (Math.floor(x / 6) + Math.floor((y - wall) / 6)) % 2 === 0
      c.set(x, y, isA ? FLOOR_A : FLOOR_B)
    }
  }
}

function drawWall(c: Canvas, wall: number): void {
  c.rect(0, 0, c.width, wall, WALL)
  c.rect(0, 0, c.width, 1, WALL_DARK)
  c.rect(0, wall - 2, c.width, 2, BASEBOARD)
  if (wall < WALL_H) return
  const windows = Math.max(1, Math.floor((c.width - 8) / 26))
  const step = c.width / windows
  for (let i = 0; i < windows; i++) {
    const x = Math.round(step * i + step / 2) - 5
    c.rect(x, 2, 10, 5, 0x8892a6)
    c.rect(x + 1, 3, 8, 3, 0x8ccbea)
    c.set(x + 2, 3, 0xd8f0ff)
    c.set(x + 3, 3, 0xd8f0ff)
    c.set(x + 2, 4, 0xd8f0ff)
    c.rect(x + 5, 3, 1, 3, 0x8892a6)
  }
}

function drawRug(c: Canvas, x: number, y: number): void {
  c.rect(x - 2, y + 4, STATION_W + 4, STATION_H - 4, RUG_EDGE)
  c.rect(x - 1, y + 5, STATION_W + 2, STATION_H - 6, RUG)
}

type Look = 'open' | 'left' | 'right' | 'closed' | 'happy' | 'dead'

const EYES: Record<Look, [number, number][]> = {
  open: [[3, 2], [3, 3], [8, 2], [8, 3]],
  left: [[2, 2], [2, 3], [7, 2], [7, 3]],
  right: [[4, 2], [4, 3], [9, 2], [9, 3]],
  closed: [[2, 3], [3, 3], [8, 3], [9, 3]],
  happy: [[2, 3], [3, 2], [4, 3], [7, 3], [8, 2], [9, 3]],
  dead: [[2, 1], [4, 1], [3, 2], [2, 3], [4, 3], [7, 1], [9, 1], [8, 2], [7, 3], [9, 3]],
}

/**
 * The Claude Code mascot, its top-left at (x, y): a body 10 wide and 7 tall,
 * eyes on rows 2 and 3, an arm each side on row 4, four legs under it.
 */
function drawCharacter(
  c: Canvas,
  x: number,
  y: number,
  style: AgentStyle,
  look: Look,
  arms: [number, number],
  t: number,
): void {
  const body = COLORS[style.color]
  const dark = shade(body, 0.72)
  c.rect(x + 1, y, 10, 6, body)
  c.rect(x + 1, y + 6, 10, 1, dark)
  for (const lx of [2, 4, 7, 9]) c.set(x + lx, y + 7, dark)
  c.set(x, y + 4 + arms[0], body)
  c.set(x + 11, y + 4 + arms[1], body)

  // Glasses and the like frame the eyes; shades hide them.
  const isOverEyes = style.accessory === 'shades'
  if (style.accessory !== 'none' && !isOverEyes) c.sprite(x, y, ACCESSORIES[style.accessory])
  for (const [ex, ey] of EYES[look]) c.set(x + ex, y + ey, INK.E!)
  if (isOverEyes) c.sprite(x, y, ACCESSORIES.shades)
  if (style.hat !== 'none') {
    const hat = HATS[style.hat]
    const frame = hat.frames[Math.floor(t / 2) % hat.frames.length]!
    c.sprite(x, y - frame.length + hat.overlap, frame)
  }
}

function drawChair(c: Canvas, x: number, y: number): void {
  c.rect(x + 1, y + 6, 12, 8, CHAIR)
  c.rect(x + 2, y + 6, 10, 1, CHAIR_LIGHT)
}

function drawDesk(c: Canvas, x: number, y: number, isManager: boolean): void {
  const top = isManager ? 0x9c4a2c : 0xc68e5c
  const edge = isManager ? RUG_EDGE : 0xdba673
  const front = isManager ? 0x6b2c1a : 0x8f5d38
  const foot = isManager ? 0x4e1f12 : 0x6e4529
  c.rect(x, y + 14, STATION_W, 2, top)
  c.rect(x, y + 14, STATION_W, 1, edge)
  c.rect(x, y + 16, STATION_W, 3, front)
  c.rect(x, y + 18, STATION_W, 1, foot)
  c.rect(x + 1, y + 19, STATION_W - 2, 1, shade(FLOOR_A, 0.75))
  if (isManager) {
    c.rect(x + 8, y + 16, 6, 2, RUG_EDGE)
    c.rect(x + 9, y + 16, 4, 1, 0xf6e7a8)
  } else {
    c.rect(x + 10, y + 17, 2, 1, INK.G!)
  }
}

function drawKeyboard(c: Canvas, x: number, y: number): void {
  c.rect(x + 3, y + 14, 8, 1, 0xe6e8ec)
  c.rect(x + 3, y + 15, 8, 1, 0xa3a9b3)
  c.set(x + 12, y + 15, 0xe6e8ec)
}

const CODE_ROWS: [number, number, number][] = [
  [0, 4, 0x7fd4ff],
  [1, 3, 0xffcb6b],
  [1, 4, 0xc792ea],
  [2, 2, 0x89dd7f],
  [0, 3, 0xf78c6c],
  [1, 2, 0x7fd4ff],
  [2, 3, 0xffcb6b],
  [0, 2, 0xc792ea],
]

/** The monitor beside the desk: its screen says what the agent is up to. */
function drawMonitor(c: Canvas, x: number, y: number, agent: FactoryAgent | undefined, t: number): void {
  const mx = x + 14
  const my = y + 7
  c.rect(mx, my, 7, 6, MONITOR)
  c.set(x + 17, y + 13, MONITOR)
  c.rect(x + 16, y + 14, 3, 1, MONITOR)
  const sx = mx + 1
  const sy = my + 1
  c.rect(sx, sy, 5, 4, SCREEN_OFF)
  if (agent === undefined) return

  switch (agent.status) {
    case 'working': {
      const icon = iconFor(agent.tool)
      if (icon === 'web') {
        c.rect(sx, sy, 5, 4, 0xf3f4f6)
        c.rect(sx, sy, 5, 1, 0x3f6fd8)
        c.rect(sx + 1, sy + 2 + (t % 2), 3, 1, 0xa3a9b3)
        return
      }
      const isShell = icon === 'shell'
      c.rect(sx, sy, 5, 4, isShell ? 0x0b0f14 : 0x1e2533)
      for (let i = 0; i < 4; i++) {
        const [indent, len, color] = CODE_ROWS[(t + i) % CODE_ROWS.length]!
        c.rect(sx + indent, sy + i, Math.min(len, 5 - indent), 1, isShell ? 0x6cc24a : color)
      }
      if (icon === 'search') c.rect(sx, sy + 1, 5, 1, 0xf7d84a)
      return
    }
    case 'waiting':
      c.rect(sx, sy, 5, 4, 0x1f2b44)
      if (t % 4 < 2) c.set(sx, sy, 0xd7e6ff)
      return
    case 'failed':
      c.rect(sx, sy, 5, 4, 0x5a1f22)
      c.rect(sx + 2, sy, 1, 2, INK.W!)
      c.set(sx + 2, sy + 3, INK.W!)
      return
    case 'done':
      c.sprite(sx, sy, CHECK)
      return
    case 'sleeping':
      c.set(sx + (t < 4 ? t : 7 - t), sy + (t % 4 < 2 ? 1 : 2), 0x26324a)
      return
  }
}

/** A thought bubble over the monitor, its tail toward the agent's head. */
function drawBubble(c: Canvas, x: number, y: number, icon: IconName, t: number): void {
  const bx = x + 14
  const by = y
  c.rect(bx + 1, by, 5, 7, INK.W!)
  c.rect(bx, by + 1, 7, 5, INK.W!)
  c.set(bx, by + 6, INK.W!)
  c.set(bx - 1, by + 7, INK.W!)
  const frames = ICONS[icon]
  c.sprite(bx + 1, by + 1, frames[t % frames.length]!)
}

function drawSleep(c: Canvas, x: number, y: number, t: number): void {
  for (const offset of [0, 4]) {
    const s = (t + offset) % FRAMES
    if (s > 6) continue
    const zx = x + 12 + Math.floor(s / 2)
    const zy = y + 6 - s
    c.sprite(zx, Math.max(y, zy), s >= 3 ? BIG_Z : SMALL_Z)
  }
}

/** One desk: chair, agent, desk, monitor and what floats over the agent's head. */
function drawStation(c: Canvas, x: number, y: number, seat: number, sceneAgent: SceneAgent | undefined, frame: number) {
  const isManager = seat === 0
  drawChair(c, x, y)
  const agent = sceneAgent?.agent
  const t = agent === undefined ? 0 : (frame + phaseOf(agent.id)) % FRAMES

  if (sceneAgent !== undefined && agent !== undefined) {
    let look: Look = 'open'
    let arms: [number, number] = [0, 0]
    let dy = 0
    switch (agent.status) {
      case 'working':
        look = t === 5 ? 'closed' : 'right'
        arms = t % 2 === 0 ? [1, 0] : [0, 1]
        break
      case 'waiting':
        look = t < 3 ? 'open' : t < 5 ? 'left' : t < 6 ? 'open' : 'right'
        break
      case 'sleeping':
        look = 'closed'
        dy = t < 4 ? 0 : 1
        break
      case 'done':
        look = 'happy'
        arms = t % 4 < 2 ? [-1, -1] : [0, 0]
        break
      case 'failed':
        look = 'dead'
        arms = t % 2 === 0 ? [-1, 0] : [0, -1]
        break
    }
    drawCharacter(c, x + 1, y + 8 + dy, sceneAgent.style, look, arms, t)
  }

  drawDesk(c, x, y, isManager)
  drawKeyboard(c, x, y)
  drawMonitor(c, x, y, agent, t)

  if (agent === undefined) {
    // An empty desk keeps a plant for company.
    c.rect(x + 1, y + 12, 3, 2, 0x9c5a3c)
    c.set(x + 1, y + 11, INK.L!)
    c.set(x + 3, y + 10, INK.L!)
    c.set(x + 2, y + 11, INK.l!)
    return
  }

  if (agent.status === 'working') drawBubble(c, x, y, iconFor(agent.tool), t)
  if (agent.status === 'waiting') drawBubble(c, x, y, 'think', Math.floor(t / 2))
  if (agent.status === 'sleeping') drawSleep(c, x, y, t)
  if (agent.outcome === 'ok' && agent.status !== 'working') c.sprite(x + 1, y + 1, CHECK)
  if (agent.outcome === 'failed' && agent.status !== 'working') c.sprite(x + 2, y + 1, BANG)
}

/** Seats sorted by number, each with the agent at it. */
function seatMap(agents: readonly SceneAgent[]): Map<number, SceneAgent> {
  return new Map(agents.map(one => [one.agent.seat, one]))
}

/** How many seats the floor needs for these agents. */
export function seatsNeeded(agents: readonly SceneAgent[]): number {
  return agents.reduce((most, one) => Math.max(most, one.agent.seat + 1), 1)
}

/** Corner brackets around the desk being styled. */
function drawHighlight(c: Canvas, x: number, y: number, t: number): void {
  const color = t % 4 < 2 ? INK.Y! : INK.y!
  const right = x + STATION_W - 1
  const bottom = y + STATION_H - 1
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [right, y, -1, 1],
    [x, bottom, 1, -1],
    [right, bottom, -1, -1],
  ] as const) {
    c.rect(Math.min(cx, cx + dx * 2), cy, 3, 1, color)
    c.rect(cx, Math.min(cy, cy + dy * 2), 1, 3, color)
  }
}

export function drawScene(lay: Layout, agents: readonly SceneAgent[], frame: number, highlightSeat?: number): Canvas {
  const c = new Canvas(lay.width, lay.height, FLOOR_A)
  drawFloor(c, lay.wall)
  drawWall(c, lay.wall)
  const bySeat = seatMap(agents)
  const manager = stationOrigin(lay, 0)
  if (manager !== undefined) drawRug(c, manager.x, manager.y)
  for (let seat = 0; seat < lay.cells.length; seat++) {
    const origin = stationOrigin(lay, seat)
    if (origin !== undefined) drawStation(c, origin.x, origin.y, seat, bySeat.get(seat), frame)
  }
  const highlight = highlightSeat === undefined ? undefined : stationOrigin(lay, highlightSeat)
  if (highlight !== undefined) drawHighlight(c, highlight.x, highlight.y, frame % FRAMES)

  return c
}

const STATUS_COLORS: Record<FactoryAgent['status'], number> = {
  working: 0xffffff,
  waiting: 0xf7e08a,
  sleeping: 0x9aa3b5,
  done: 0x8fe08a,
  failed: 0xff8a8a,
}

export function statusColor(status: FactoryAgent['status']): number {
  return STATUS_COLORS[status]
}

/** Each desk's name tag, `maxChars` wide at most. */
export function sceneLabels(lay: Layout, agents: readonly SceneAgent[], maxChars: number): Label[] {
  const labels: Label[] = []
  for (const { agent } of agents) {
    const origin = stationOrigin(lay, agent.seat)
    if (origin === undefined) continue
    const text = clip(agent.label, maxChars)
    labels.push({ x: origin.x, y: origin.y + 20, width: STATION_W, text, color: statusColor(agent.status) })
  }

  return labels
}

export function sceneHotspots(lay: Layout, agents: readonly SceneAgent[], describe: (a: FactoryAgent) => string): Hotspot[] {
  const spots: Hotspot[] = []
  for (const { agent } of agents) {
    const origin = stationOrigin(lay, agent.seat)
    if (origin === undefined) continue
    spots.push({ ...origin, width: STATION_W, height: STATION_H, title: describe(agent) })
  }

  return spots
}

export function clip(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : `${chars.slice(0, Math.max(1, max - 1)).join('')}…`
}
