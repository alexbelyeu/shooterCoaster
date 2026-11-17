import { createRng } from '@/utils/rng'

/**
 * Street pieces on the hall's high walls (#593): a graffiti "piece" (chunky skewed letters with a dark outline,
 * a highlight and drips, over a pale cloud) and quick tags, as flat polygons in a wall's own metres: x along the
 * wall from the rect's centre, y up from its foot. `layer` stacks them off the wall, 0 nearest. Pure, seeded.
 */

export type Pt = [number, number]

export interface MuralShape {
  points: Pt[]
  colour: string
  layer: number
}

export interface PieceStyle {
  fill: readonly string[]
  outline: string
  cloud: string
  highlight: string
}

/** A closed blob: an ellipse whose radius wanders. */
function cloud(cx: number, cy: number, rx: number, ry: number, rng: () => number): Pt[] {
  const n = 18
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 0.85 + 0.3 * rng()
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r])
  }
  return pts
}

/** Grow a convex-ish polygon about its centroid. */
function grow(points: Pt[], by: number): Pt[] {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length
  return points.map(([x, y]) => {
    const dx = x - cx
    const dy = y - cy
    const d = Math.hypot(dx, dy) || 1
    return [x + (dx / d) * by, y + (dy / d) * by]
  })
}

/** One letter: a skewed slab with a notch or an arrow, leaning like a wildstyle letter. */
function letter(x0: number, w: number, h: number, lean: number, rng: () => number): Pt[] {
  const top = h * (0.85 + 0.15 * rng())
  const s = lean * h
  const notch = rng()
  const pts: Pt[] = [
    [x0, 0],
    [x0 + w, 0],
    [x0 + w + s, top * 0.55],
  ]
  // Every other letter gets a pointed arm off its right side.
  if (notch < 0.5) pts.push([x0 + w + s + w * 0.45, top * 0.7])
  pts.push([x0 + w + s * 1.1, top], [x0 + s * 1.1 + w * 0.1, top + h * 0.08 * rng()], [x0 + s * 0.6 - w * 0.15, top * 0.6])
  return pts
}

/** A graffiti piece `width` × `height` m: cloud, then per letter its outline, fill, highlight and drips. */
export function graffitiPiece(seed: number, width: number, height: number, style: PieceStyle): MuralShape[] {
  const rng = createRng(seed)
  const shapes: MuralShape[] = [{ points: cloud(0, height / 2, width / 2, height / 2, rng), colour: style.cloud, layer: 0 }]
  const count = 4 + Math.floor(rng() * 2)
  const pitch = (width * 0.86) / count
  const h = height * 0.62
  const base = height * 0.18
  for (let i = 0; i < count; i++) {
    const x0 = -width * 0.43 + i * pitch
    const w = pitch * (0.55 + 0.15 * rng())
    const lean = 0.12 + 0.1 * rng()
    const body = letter(x0, w, h, lean, rng).map(([x, y]): Pt => [x, y + base + (rng() - 0.5) * height * 0.06])
    const fill = style.fill[i % style.fill.length]
    shapes.push({ points: grow(body, height * 0.05), colour: style.outline, layer: 1 })
    shapes.push({ points: body, colour: fill, layer: 2 })
    const [bx, by] = body[0]
    const hl = h * 0.08
    shapes.push({ points: [[bx + w * 0.1, by + h * 0.62], [bx + w * 0.75, by + h * 0.62], [bx + w * 0.8, by + h * 0.62 + hl], [bx + w * 0.15, by + h * 0.62 + hl]], colour: style.highlight, layer: 3 })
    // Drips run down from the letter's foot.
    const drips = 1 + Math.floor(rng() * 2)
    for (let d = 0; d < drips; d++) {
      const dx = bx + w * (0.2 + 0.6 * rng())
      const len = height * (0.08 + 0.18 * rng())
      const dw = width * 0.006
      shapes.push({ points: [[dx - dw, by], [dx + dw, by], [dx + dw, by - len], [dx, by - len - dw], [dx - dw, by - len]], colour: fill, layer: 2 })
    }
  }
  return shapes
}

/** A quick tag: a looping zigzag scrawl as thin strokes, plus an underline swoosh. */
export function tag(seed: number, width: number, height: number, colour: string): MuralShape[] {
  const rng = createRng(seed)
  const shapes: MuralShape[] = []
  const stroke = height * 0.07
  const strokes = 6 + Math.floor(rng() * 4)
  let prev: Pt = [-width / 2, height * (0.3 + 0.4 * rng())]
  for (let i = 1; i <= strokes; i++) {
    const next: Pt = [-width / 2 + (i / strokes) * width * 0.85, height * (0.25 + 0.7 * (i % 2 === 0 ? rng() * 0.4 : 0.6 + rng() * 0.4))]
    shapes.push({ points: segment(prev, next, stroke), colour, layer: 0 })
    prev = next
  }
  shapes.push({ points: segment([-width / 2, height * 0.12], [width / 2, height * 0.02], stroke * 0.8), colour, layer: 0 })
  return shapes
}

/** A thick line from `a` to `b` as a quad. */
function segment(a: Pt, b: Pt, thick: number): Pt[] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const d = Math.hypot(dx, dy) || 1
  const nx = (-dy / d) * (thick / 2)
  const ny = (dx / d) * (thick / 2)
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]
}
