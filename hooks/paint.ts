import { hex } from './sprites'
import type { Canvas, Hotspot, Label } from './scene'

const UPPER_HALF = 0x2580
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64(bytes: Uint8Array): string {
  const out: string[] = []
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!
    out.push(B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!)
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i]! << 16
    out.push(`${B64[(n >> 18) & 63]!}${B64[(n >> 12) & 63]!}==`)
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8)
    out.push(`${B64[(n >> 18) & 63]!}${B64[(n >> 12) & 63]!}${B64[(n >> 6) & 63]!}=`)
  }

  return out.join('')
}

/** A label's text centered in its width, one glyph per column. */
function labelCells(labels: readonly Label[], columns: number): Map<number, { ch: number; color: number }> {
  const cells = new Map<number, { ch: number; color: number }>()
  for (const label of labels) {
    const chars = Array.from(label.text)
    const left = label.x + Math.floor((label.width - chars.length) / 2)
    const row = label.y >> 1
    chars.forEach((ch, i) => {
      const code = ch.codePointAt(0) ?? 32
      const isPrintable = code >= 32 && code <= 0xffff && code !== 0x7f
      cells.set(row * columns + left + i, { ch: isPrintable ? code : 0x3f, color: label.color })
    })
  }

  return cells
}

/**
 * The terminal's picture: every cell an upper half block, its foreground the
 * pixel above and its background the pixel below, so pixels come out square.
 */
export function rasterCells(canvas: Canvas, labels: readonly Label[]): { columns: number; rows: number; cells: string } {
  const columns = canvas.width
  const rows = Math.ceil(canvas.height / 2)
  const bytes = new Uint8Array(columns * rows * 12)
  const view = new DataView(bytes.buffer)
  const text = labelCells(labels, columns)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const top = canvas.get(col, row * 2)
      const bottom = row * 2 + 1 < canvas.height ? canvas.get(col, row * 2 + 1) : top
      const index = row * columns + col
      const glyph = text.get(index)
      const at = index * 12
      view.setUint32(at, glyph?.ch ?? UPPER_HALF, true)
      view.setUint32(at + 4, glyph?.color ?? top, true)
      view.setUint32(at + 8, glyph === undefined ? bottom : top, true)
    }
  }

  return { columns, rows, cells: base64(bytes) }
}

/** Rectangles covering every pixel `colorAt` gives, runs merged down the rows, as one path per color. */
function paths(width: number, height: number, colorAt: (x: number, y: number) => number | undefined): string {
  type Run = { x: number; y: number; w: number; h: number; color: number }
  const done: Run[] = []
  let open = new Map<string, Run>()
  for (let y = 0; y < height; y++) {
    const next = new Map<string, Run>()
    let x = 0
    while (x < width) {
      const color = colorAt(x, y)
      if (color === undefined) {
        x++
        continue
      }
      let w = 1
      while (x + w < width && colorAt(x + w, y) === color) w++
      const key = `${x},${w},${color}`
      const run = open.get(key)
      if (run !== undefined) {
        run.h++
        open.delete(key)
        next.set(key, run)
      } else {
        next.set(key, { x, y, w, h: 1, color })
      }
      x += w
    }
    for (const run of open.values()) done.push(run)
    open = next
  }
  for (const run of open.values()) done.push(run)

  const byColor = new Map<number, string[]>()
  for (const run of done) {
    const list = byColor.get(run.color) ?? []
    list.push(`M${run.x} ${run.y}h${run.w}v${run.h}h-${run.w}z`)
    byColor.set(run.color, list)
  }

  return [...byColor].map(([color, d]) => `<path fill="${hex(color)}" d="${d.join('')}"/>`).join('')
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, ch => `&#${ch.charCodeAt(0)};`)
}

/** The color most pixels have, painted once as the backdrop. */
function commonest(canvas: Canvas): number {
  const counts = new Map<number, number>()
  let best = canvas.px[0] ?? 0
  let bestCount = 0
  for (const color of canvas.px) {
    const n = (counts.get(color) ?? 0) + 1
    counts.set(color, n)
    if (n > bestCount) {
      best = color
      bestCount = n
    }
  }

  return best
}

export const SVG_LIMIT = 131072

/**
 * The remote surfaces' picture: the first frame whole, and for each later
 * frame only the pixels that change, shown in turn by SMIL so it plays with
 * no redraw. Falls back to fewer frames, then one, past the size limit.
 */
export function sceneSvg(
  frames: readonly Canvas[],
  labels: readonly Label[],
  hotspots: readonly Hotspot[],
  options: { scale: number; secondsPerFrame: number },
): string {
  const first = frames[0]!
  const { width, height } = first
  const backdrop = commonest(first)
  const base = paths(width, height, (x, y) => {
    const color = first.get(x, y)
    return color === backdrop ? undefined : color
  })
  const texts = labels
    .map(label => {
      const x = label.x + label.width / 2
      return `<text x="${x}" y="${label.y + 1.6}" fill="${hex(label.color)}">${escapeXml(label.text)}</text>`
    })
    .join('')
  const spots = hotspots
    .map(
      spot =>
        `<rect x="${spot.x}" y="${spot.y}" width="${spot.width}" height="${spot.height}" fill="#000" fill-opacity="0" pointer-events="all"><title>${escapeXml(spot.title)}</title></rect>`,
    )
    .join('')
  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * options.scale}" height="${height * options.scale}">` +
    `<rect width="${width}" height="${height}" fill="${hex(backdrop)}"/>` +
    `<g shape-rendering="crispEdges">${base}</g>`
  const tail =
    `<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="3.4" font-weight="700" text-anchor="middle" dominant-baseline="middle">${texts}</g>` +
    `${spots}</svg>`

  const build = (step: number) => {
    const shown = frames.filter((_, i) => i % step === 0)
    if (shown.length < 2) return head + tail
    const dur = (frames.length * options.secondsPerFrame).toFixed(2)
    const overlays = shown.slice(1).map((frame, k) => {
      const diff = paths(width, height, (x, y) => {
        const color = frame.get(x, y)
        return color === first.get(x, y) ? undefined : color
      })
      if (diff === '') return ''
      const values = shown.map((_, i) => (i === k + 1 ? 'visible' : 'hidden')).join(';')
      return `<g visibility="hidden" shape-rendering="crispEdges"><animate attributeName="visibility" values="${values}" dur="${dur}s" calcMode="discrete" repeatCount="indefinite"/>${diff}</g>`
    })

    return head + overlays.join('') + tail
  }

  for (const step of [1, 2, 4, frames.length]) {
    const svg = build(step)
    if (svg.length <= SVG_LIMIT) return svg
  }

  return head + tail
}
