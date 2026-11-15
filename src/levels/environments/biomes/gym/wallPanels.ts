import { createRng, hashString } from '@/utils/rng'
import { DEFAULT_BACK, profileExtent, type Panel, type PieceOf } from './blockout'

/**
 * A climbing wall's face broken into rugged panels (#519, pure, seeded): the profile's rows cut into
 * irregular quads and triangles, each pushed in or out along the face's normal (facets, arêtes, dihedrals,
 * small roofs, bulges), every panel framed by a sunken seam, and the shell (ends, top, back) closed round it.
 * Everything stays inside the wall's footprint (`pieceBoxes`): relief is clamped to the profile's own extent.
 * Local frame as `hallGeometry`'s `frame()`: x along the wall, y up from its foot, z the way it faces.
 */

export type V3 = [number, number, number]

/** A bump in the face: centred `along` / `y`, `halfW` × `halfH` metres, `amp` out. `shield` narrows it to a point at the bottom. */
export interface Bulge {
  along: number
  y: number
  halfW: number
  halfH: number
  amp: number
  shield?: boolean
}

export interface PanelSpec {
  length: number
  profile: readonly Panel[]
  /** Depth behind the face's deepest point (the shell's back). */
  back: number
  seed: number
  bulge?: Bulge
  /** Close the underside too (a headwall that starts in mid-air). */
  bottom?: boolean
  /** Share of panels split into two triangles. */
  triangles?: number
}

export interface PanelInfo {
  along: number
  y: number
  /** Profile panel (paint band) it sits on. */
  row: number
  col: number
  /** 0 / 1 for the two halves of a split cell, −1 for a whole quad. */
  half: number
}

/** Triangle parts: a panel's face, the seam round it, the shell. */
export const FACE = 0
export const SEAM = 1
export const SHELL = 2

export interface WallPanels {
  /** Non-indexed triangles, 9 numbers each, wound to face out. */
  positions: number[]
  /** Per triangle: FACE / SEAM / SHELL. */
  part: number[]
  /** Per triangle: its panel (−1 on the shell). */
  panel: number[]
  panels: PanelInfo[]
}

const DEG = Math.PI / 180
/** Seam width round each panel, and how far a panel stands proud of its seams. */
const SEAM_W = 0.09
const PROUD = 0.05
/** Relief keeps this far inside the footprint (the proud panels fit in it). */
const MARGIN = 0.08
/** The shell keeps at least this much behind the face. */
const MIN_SHELL = 0.15

/** Push triangle a, b, c onto `out`, wound so its normal agrees with `hint`. */
export function pushTri(out: number[], a: V3, b: V3, c: V3, hint: V3): void {
  const u0 = b[0] - a[0]
  const u1 = b[1] - a[1]
  const u2 = b[2] - a[2]
  const v0 = c[0] - a[0]
  const v1 = c[1] - a[1]
  const v2 = c[2] - a[2]
  const dot = (u1 * v2 - u2 * v1) * hint[0] + (u2 * v0 - u0 * v2) * hint[1] + (u0 * v1 - u1 * v0) * hint[2]
  if (dot < 0) out.push(...a, ...c, ...b)
  else out.push(...a, ...b, ...c)
}

interface RowLine {
  /** Profile panel this boundary's row above belongs to (the last panel for the top). */
  row: number
  /** Panel start (f, y), direction, length; `s` the boundary's distance along it. */
  f0: number
  y0: number
  df: number
  dy: number
  s: number
  /** Outward unit normal (y, f) here: averaged at a kink. */
  ny: number
  nf: number
  fixed: boolean
  roof: boolean
}

/** Row boundaries up the profile: every kink, the panels cut into 1.4–2.4 m rows, now and then a thin roof row. */
function rowLines(profile: readonly Panel[], rng: () => number): RowLine[] {
  const lines: RowLine[] = []
  let f = 0
  let y = 0
  profile.forEach((panel, k) => {
    const a = panel.angle * DEG
    const df = Math.sin(a)
    const dy = Math.cos(a)
    const line = (s: number, fixed: boolean, roof = false, ny = -df, nf = dy): RowLine => ({ row: k, f0: f, y0: y, df, dy, s, ny, nf, fixed, roof })
    // The foot and top rows move only in and out, so they stay on the floor and at the top.
    if (k === 0) {
      lines.push(line(0, true, false, 0, 1))
    } else {
      // A kink: the normal halfway between the two panels'.
      const pa = profile[k - 1].angle * DEG
      const ny = -Math.sin(pa) - df
      const nf = Math.cos(pa) + dy
      const n = Math.hypot(ny, nf)
      lines.push(line(0, true, false, ny / n, nf / n))
    }
    const rows = Math.max(1, Math.round(panel.len / (1.4 + rng() * 1.0)))
    const cuts = Array.from({ length: rows - 1 }, (_, r) => ((r + 1) / rows) * panel.len)
    const roof = panel.len > 3 && rng() < 0.4 ? (cuts.length ? cuts[Math.floor(rng() * cuts.length)] : panel.len / 2) : -1
    for (const s of cuts) if (s !== roof) lines.push(line(s, false))
    if (roof > 0) lines.push(line(roof - 0.4, true), line(roof, true, true))
    if (k === profile.length - 1) lines.push(line(panel.len, true, false, 0, 1))
    f += panel.len * df
    y += panel.len * dy
  })
  return lines.sort((p, q) => p.row - q.row || p.s - q.s)
}

/** The d range along (ny, nf) that keeps (y, f) inside [yLo, yHi] × [fLo, fHi]. */
function reliefRange(y: number, f: number, ny: number, nf: number, yLo: number, yHi: number, fLo: number, fHi: number): [number, number] {
  let lo = -Infinity
  let hi = Infinity
  for (const [v, k, a, b] of [[y, ny, yLo, yHi], [f, nf, fLo, fHi]]) {
    if (Math.abs(k) < 1e-6) continue
    const d0 = (a - v) / k
    const d1 = (b - v) / k
    lo = Math.max(lo, Math.min(d0, d1))
    hi = Math.min(hi, Math.max(d0, d1))
  }
  return lo > hi ? [0, 0] : [lo, hi]
}

export interface WallStyle {
  bulge?: Bulge
  pattern?: 'wave' | 'triangles'
  triangles?: number
}

/** A sport / boulder wall's spec, seeded by its id: its style's bulge, or a small one on about half the walls. */
export function wallSpec(p: PieceOf<'sport' | 'boulder'>, style: WallStyle = {}): PanelSpec {
  const seed = hashString(p.id)
  const rng = createRng(seed)
  const { height } = profileExtent(p.profile)
  const bulge = style.bulge ?? (rng() < 0.5 ? { along: (rng() - 0.5) * p.length * 0.6, y: height * (0.3 + rng() * 0.4), halfW: 1.5 + rng() * 1.5, halfH: 1.5 + rng() * 1.5, amp: 0.6 } : undefined)
  return { length: p.length, profile: p.profile, back: p.back ?? DEFAULT_BACK, seed, bulge, triangles: style.triangles }
}

/** Build one wall's rugged face and shell. */
export function buildWallPanels(spec: PanelSpec): WallPanels {
  const rng = createRng(spec.seed)
  const half = spec.length / 2
  const lines = rowLines(spec.profile, rng)

  // Profile extent: the footprint the relief must stay in.
  let fMin = 0
  let fMax = 0
  for (const l of lines) {
    const f = l.f0 + l.s * l.df
    fMin = Math.min(fMin, f)
    fMax = Math.max(fMax, f)
  }
  const height = lines[lines.length - 1].y0 + lines[lines.length - 1].s * lines[lines.length - 1].dy
  const fBack = fMin - spec.back

  // Columns: 1.1–2.6 m wide, the remainder folded into the last.
  const xs = [-half]
  while (spec.length / 2 - xs[xs.length - 1] > 3.4) xs.push(xs[xs.length - 1] + 1.1 + rng() * 1.5)
  xs.push(half)

  // Per-column features: an arête (out) or a dihedral (in) over a run of rows.
  const colOut = xs.map((_, i) => {
    if (i === 0 || i === xs.length - 1) return null
    const r = rng()
    if (r > 0.4) return null
    const from = Math.floor(rng() * lines.length * 0.6)
    return { amount: r < 0.22 ? 0.4 : -0.3, from, to: from + 2 + Math.floor(rng() * lines.length * 0.6) }
  })

  const bulge = (x: number, y: number): number => {
    const b = spec.bulge
    if (!b) return 0
    const t = (y - (b.y - b.halfH)) / (2 * b.halfH)
    const hw = b.shield ? b.halfW * Math.min(1, Math.max(0.15, t * 1.4)) : b.halfW
    const s = 1 - ((x - b.along) / hw) ** 2 - ((y - b.y) / b.halfH) ** 2
    return s > 0 ? b.amp * Math.sqrt(s) : 0
  }

  // Grid vertices.
  const grid: V3[][] = lines.map((l, j) => {
    const prev = lines[j - 1]
    const next = lines[j + 1]
    const room = Math.min(prev && prev.row === l.row ? l.s - prev.s : 0, next && next.row === l.row ? next.s - l.s : 0)
    const s = l.fixed || l.roof || (next && next.roof) ? l.s : l.s + (rng() - 0.5) * 0.5 * room
    const y = l.y0 + s * l.dy
    const f = l.f0 + s * l.df
    const roofFrom = Math.floor(rng() * xs.length)
    const roofTo = roofFrom + 2 + Math.floor(rng() * 3)
    return xs.map((x0, i) => {
      const edge = i === 0 || i === xs.length - 1
      const w = Math.min(x0 - (xs[i - 1] ?? x0), (xs[i + 1] ?? x0) - x0)
      const x = edge ? x0 : x0 + (rng() - 0.5) * 0.6 * w
      let d = (rng() - 0.5) * 0.36
      const col = colOut[i]
      if (col && j >= col.from && j <= col.to) d += col.amount
      if (l.roof && i >= roofFrom && i <= roofTo) d += 0.45
      d += bulge(x, y)
      const [lo, hi] = reliefRange(y, f, l.ny, l.nf, 0, height, fBack + MIN_SHELL, fMax - MARGIN)
      d = Math.min(hi, Math.max(lo, d))
      return [x, y + d * l.ny, f + d * l.nf]
    })
  })

  const out: WallPanels = { positions: [], part: [], panel: [], panels: [] }
  const tri = (a: V3, b: V3, c: V3, hint: V3, part: number, panel: number) => {
    pushTri(out.positions, a, b, c, hint)
    out.part.push(part)
    out.panel.push(panel)
  }

  /** One panel: its corners inset by the seam and raised proud, the seam ring round it. */
  const panel = (corners: V3[], hint: V3, info: PanelInfo) => {
    const id = out.panels.push(info) - 1
    const n = corners.length
    const c = corners.reduce<V3>((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n, m[2] + p[2] / n], [0, 0, 0])
    const inner = corners.map((p): V3 => {
      const dx = c[0] - p[0]
      const dy = c[1] - p[1]
      const dz = c[2] - p[2]
      const len = Math.hypot(dx, dy, dz)
      const t = len > 0 ? Math.min(SEAM_W, 0.3 * len) / len : 0
      return [p[0] + dx * t, p[1] + dy * t + hint[1] * PROUD, p[2] + dz * t + hint[2] * PROUD]
    })
    for (let k = 1; k + 1 < n; k++) tri(inner[0], inner[k], inner[k + 1], hint, FACE, id)
    for (let k = 0; k < n; k++) {
      const m = (k + 1) % n
      tri(corners[k], corners[m], inner[m], hint, SEAM, id)
      tri(corners[k], inner[m], inner[k], hint, SEAM, id)
    }
  }

  const split = spec.triangles ?? 0.35
  for (let j = 0; j + 1 < lines.length; j++) {
    const l = lines[j]
    const ny = l.ny + lines[j + 1].ny
    const nf = l.nf + lines[j + 1].nf
    const n = Math.hypot(ny, nf)
    const hint: V3 = [0, ny / n, nf / n]
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = grid[j][i]
      const b = grid[j][i + 1]
      const c = grid[j + 1][i + 1]
      const d = grid[j + 1][i]
      const info = { along: (a[0] + b[0] + c[0] + d[0]) / 4, y: (a[1] + b[1] + c[1] + d[1]) / 4, row: l.row, col: i }
      if (rng() < split) {
        const flip = rng() < 0.5
        panel(flip ? [a, b, c] : [a, b, d], hint, { ...info, half: 0 })
        panel(flip ? [a, c, d] : [b, c, d], hint, { ...info, half: 1 })
      } else {
        panel([a, b, c, d], hint, { ...info, half: -1 })
      }
    }
  }

  // Shell: both ends, the top (and bottom), the back.
  const top = grid[grid.length - 1]
  const bottom = grid[0]
  for (const [i, sx] of [[0, -1], [xs.length - 1, 1]] as const) {
    for (let j = 0; j + 1 < grid.length; j++) {
      const p = grid[j][i]
      const q = grid[j + 1][i]
      const pb: V3 = [p[0], p[1], fBack]
      const qb: V3 = [q[0], q[1], fBack]
      tri(p, q, qb, [sx, 0, 0], SHELL, -1)
      tri(p, qb, pb, [sx, 0, 0], SHELL, -1)
    }
  }
  for (let i = 0; i + 1 < xs.length; i++) {
    const strip = (row: V3[], y: number) => {
      const p = row[i]
      const q = row[i + 1]
      const pb: V3 = [p[0], p[1], fBack]
      const qb: V3 = [q[0], q[1], fBack]
      tri(p, q, qb, [0, y, 0], SHELL, -1)
      tri(p, qb, pb, [0, y, 0], SHELL, -1)
    }
    strip(top, 1)
    if (spec.bottom) strip(bottom, -1)
    const at = (p: V3): V3 => [p[0], p[1], fBack]
    tri(at(bottom[i]), at(bottom[i + 1]), at(top[i + 1]), [0, 0, -1], SHELL, -1)
    tri(at(bottom[i]), at(top[i + 1]), at(top[i]), [0, 0, -1], SHELL, -1)
  }
  return out
}
