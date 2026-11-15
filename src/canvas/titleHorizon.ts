/** The world beyond the title park (#459): hill ridges, ride silhouettes, a far skyline and their lights, from a fixed seed so the poster matches. */
import * as THREE from 'three'
import { createRng, type Rng } from '@/utils/rng'

export interface HillRow {
  r: number
  base: number
  amp: number
  /** Noise cells round the ring: fewer is broader hills. */
  cells: number
  color: string
}

/** Valleys and ridges outward: each ridge stands higher than the last seen from the park, so they stack to the sky. */
export const HILL_ROWS: readonly HillRow[] = [
  { r: 950, base: -3, amp: 0, cells: 1, color: '#4f7d2f' },
  { r: 1150, base: 18, amp: 12, cells: 22, color: '#4f7a33' },
  { r: 1350, base: 70, amp: 55, cells: 13, color: '#477238' },
  { r: 1620, base: 34, amp: 20, cells: 12, color: '#4c6e40' },
  { r: 1950, base: 140, amp: 80, cells: 10, color: '#46664c' },
  { r: 2320, base: 80, amp: 30, cells: 9, color: '#4f6a5a' },
  { r: 2750, base: 400, amp: 190, cells: 10, color: '#5a6e80' },
]
export const HILL_SEGMENTS = 128
/** The rides stand in the valley behind the first ridge, the skyline in the one behind the second. */
const RIDE_RING = 1620
const SKYLINE_RING = 2320
/** Its colour is the sky's horizon; each band out reads a step paler. */
export const HORIZON_FOG = { color: '#aab6c3', near: 350, far: 4200 }
export const CAMERA_FAR = 3500

function lattice(i: number, seed: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(seed, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** 1D value noise round the ring in [0, 1], wrapping at 2π. */
function ringNoise(angle: number, cells: number, seed: number): number {
  const f = ((((angle / (Math.PI * 2)) % 1) + 1) % 1) * cells
  const i = Math.floor(f)
  const t = f - i
  const s = t * t * (3 - 2 * t)
  const a = lattice(i % cells, seed)
  return a + (lattice((i + 1) % cells, seed) - a) * s
}

export function hillHeight(row: number, angle: number): number {
  const { base, amp, cells } = HILL_ROWS[row]
  const n = 0.7 * ringNoise(angle, cells, row * 31 + 7) + 0.3 * ringNoise(angle, cells * 3, row * 31 + 19)
  return base + amp * (2 * n - 1)
}

/** The hills as drawn: linear between rows. */
function hillSurface(r: number, angle: number): number {
  const last = HILL_ROWS.length - 1
  if (r <= HILL_ROWS[0].r) return hillHeight(0, angle)
  if (r >= HILL_ROWS[last].r) return hillHeight(last, angle)
  let k = 0
  while (HILL_ROWS[k + 1].r < r) k++
  const t = (r - HILL_ROWS[k].r) / (HILL_ROWS[k + 1].r - HILL_ROWS[k].r)
  return hillHeight(k, angle) + (hillHeight(k + 1, angle) - hillHeight(k, angle)) * t
}

export interface HillGrid {
  positions: Float32Array
  colors: Float32Array
  index: number[]
}

/** One indexed grid, wrapping round without a seam so the normals stay smooth. */
export function buildHillGrid(): HillGrid {
  const n = HILL_SEGMENTS
  const positions = new Float32Array(HILL_ROWS.length * n * 3)
  const colors = new Float32Array(HILL_ROWS.length * n * 3)
  const c = new THREE.Color()
  HILL_ROWS.forEach((row, k) => {
    c.set(row.color)
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2
      const v = (k * n + j) * 3
      positions[v] = Math.cos(a) * row.r
      positions[v + 1] = hillHeight(k, a)
      positions[v + 2] = Math.sin(a) * row.r
      c.toArray(colors, v)
    }
  })
  const index: number[] = []
  for (let k = 0; k + 1 < HILL_ROWS.length; k++) {
    for (let j = 0; j < n; j++) {
      const a = k * n + j
      const b = k * n + ((j + 1) % n)
      const d = a + n
      const e = b + n
      index.push(a, b, d, b, e, d)
    }
  }
  return { positions, colors, index }
}

type Rgb = [number, number, number]
const rgb = (hex: string): Rgb => new THREE.Color(hex).toArray() as Rgb

/** Flat shapes on a ring facing the park, drawn in their own plane (x along the ring, y up) into one triangle list. */
export class FlatWriter {
  readonly positions: number[] = []
  readonly colors: number[] = []
  readonly lights: number[] = []
  readonly lightColors: number[] = []
  private ox = 0
  private oy = 0
  private oz = 0
  private tx = 0
  private tz = 0
  color: Rgb = [0, 0, 0]

  place(angle: number, r: number, y: number): this {
    this.ox = Math.cos(angle) * r
    this.oy = y
    this.oz = Math.sin(angle) * r
    this.tx = -Math.sin(angle)
    this.tz = Math.cos(angle)
    return this
  }

  private vertex(out: number[], x: number, y: number, inward: number) {
    // Along the ring is (tx, tz); towards the park is (-cos, -sin) = (-tz, tx).
    out.push(this.ox + this.tx * x - this.tz * inward, this.oy + y, this.oz + this.tz * x + this.tx * inward)
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
    this.vertex(this.positions, ax, ay, 0)
    this.vertex(this.positions, bx, by, 0)
    this.vertex(this.positions, cx, cy, 0)
    for (let i = 0; i < 3; i++) this.colors.push(...this.color)
  }

  quad(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.tri(x0, y0, x1, y1, x2, y2)
    this.tri(x0, y0, x2, y2, x3, y3)
  }

  rect(x0: number, y0: number, x1: number, y1: number) {
    this.quad(x0, y0, x1, y0, x1, y1, x0, y1)
  }

  bar(x0: number, y0: number, x1: number, y1: number, w: number) {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1
    const nx = (-(y1 - y0) / len) * (w / 2)
    const ny = ((x1 - x0) / len) * (w / 2)
    this.quad(x0 + nx, y0 + ny, x0 - nx, y0 - ny, x1 - nx, y1 - ny, x1 + nx, y1 + ny)
  }

  arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, segments: number) {
    for (let i = 0; i < segments; i++) {
      const p = a0 + ((a1 - a0) * i) / segments
      const q = a0 + ((a1 - a0) * (i + 1)) / segments
      this.quad(
        cx + Math.cos(p) * r0, cy + Math.sin(p) * r0,
        cx + Math.cos(p) * r1, cy + Math.sin(p) * r1,
        cx + Math.cos(q) * r1, cy + Math.sin(q) * r1,
        cx + Math.cos(q) * r0, cy + Math.sin(q) * r0,
      )
    }
  }

  /** Just in front of the shape, so it never fights its depth. */
  light(x: number, y: number, color: Rgb) {
    this.vertex(this.lights, x, y, 3)
    this.lightColors.push(...color)
  }

  get triangles(): number {
    return this.positions.length / 9
  }
}

const BULBS = ['#fff1c8', '#ffd27a', '#ffb050'].map(rgb)
const NEON = ['#ff6fa8', '#7fd6ff', '#ffe066', '#9dff8a'].map(rgb)
const WINDOWS = ['#ffe2a0', '#ffcf80', '#fff4dc'].map(rgb)

function ferrisWheel(w: FlatWriter, rng: Rng, s: number) {
  const R = 62 * s
  const hub = R + 10 * s
  w.bar(-R * 0.55, 0, 0, hub, 6 * s)
  w.bar(R * 0.55, 0, 0, hub, 6 * s)
  w.arc(0, hub, R - 5 * s, R, 0, Math.PI * 2, 24)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI
    w.bar(-Math.cos(a) * R, hub - Math.sin(a) * R, Math.cos(a) * R, hub + Math.sin(a) * R, 2.5 * s)
  }
  const bulb = rng.pick(NEON)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    w.light(Math.cos(a) * R, hub + Math.sin(a) * R, bulb)
  }
}

/** A lift hill, then hills falling away; `loop` adds a vertical loop half way. */
function coaster(w: FlatWriter, rng: Rng, s: number, loop: boolean) {
  const len = 280 * s
  const H = 105 * s
  const n = 30
  const y = (t: number) =>
    8 + H * (t < 0.2 ? t / 0.2 : (0.55 + 0.45 * Math.cos(((t - 0.2) / 0.8) * Math.PI * 3)) * (1 - 0.5 * ((t - 0.2) / 0.8)))
  const bulb = rng.pick(BULBS)
  for (let i = 0; i < n; i++) {
    const t0 = i / n
    const t1 = (i + 1) / n
    const x0 = -len / 2 + len * t0
    w.bar(x0, y(t0), -len / 2 + len * t1, y(t1), 5 * s)
    if (i % 3 === 0) w.bar(x0, 0, x0, y(t0), 2.5 * s)
    if (i % 2 === 0) w.light(x0, y(t0) + 2 * s, bulb)
  }
  if (loop) {
    const r = 26 * s
    w.arc(len * 0.3, 8 + r, r - 4.5 * s, r, 0, Math.PI * 2, 18)
    w.bar(len * 0.3, 0, len * 0.3, 8 + r * 2, 3 * s)
  }
}

function dropTower(w: FlatWriter, rng: Rng, s: number) {
  const H = 190 * s
  w.bar(0, 0, 0, H, 6 * s)
  w.rect(-10 * s, H - 8 * s, 10 * s, H)
  w.rect(-7 * s, H * 0.45, 7 * s, H * 0.45 + 9 * s)
  const bulb = rng.pick(NEON)
  for (let i = 0; i < 4; i++) w.light(-9 * s + i * 6 * s, H, bulb)
  w.light(0, H + 6 * s, rgb('#ff4040'))
}

/** A water park: a platform tower and three slides snaking down from it. */
function waterSlides(w: FlatWriter, rng: Rng, s: number) {
  const H = 100 * s
  w.rect(-8 * s, 0, 8 * s, H)
  w.rect(-14 * s, H, 14 * s, H + 5 * s)
  const bulb = rng.pick(BULBS)
  for (const side of [-1, 1, 0.45]) {
    const reach = side * 120 * s
    const n = 12
    for (let i = 0; i < n; i++) {
      const t0 = i / n
      const t1 = (i + 1) / n
      const x = (t: number) => reach * t + Math.sin(t * Math.PI * 3) * 16 * s
      const y = (t: number) => H * (1 - t) ** 1.3
      w.bar(x(t0), y(t0), x(t1), y(t1), 6.5 * s)
      if (i % 3 === 1) w.light(x(t0), y(t0) + 3 * s, bulb)
    }
  }
}

/** An observation tower: a mast and a ring of seats seen edge-on. */
function gyroTower(w: FlatWriter, rng: Rng, s: number) {
  const H = 160 * s
  w.bar(0, 0, 0, H, 7 * s)
  w.rect(-4 * s, H, 4 * s, H + 14 * s)
  const y = H * rng.range(0.4, 0.75)
  w.quad(-24 * s, y - 3 * s, 24 * s, y - 3 * s, 20 * s, y + 4 * s, -20 * s, y + 4 * s)
  const bulb = rng.pick(NEON)
  for (let i = 0; i < 6; i++) w.light(-20 * s + i * 8 * s, y + 4 * s, bulb)
}

type Ride = 'wheel' | 'coaster' | 'loop' | 'tower' | 'slides' | 'gyro'
const RIDES: readonly Ride[] = ['wheel', 'coaster', 'tower', 'slides', 'loop', 'gyro', 'wheel', 'coaster', 'slides', 'tower', 'loop', 'gyro']
/** Half-widths along the ring at scale 1, to bury each base below the ground under it. */
const RIDE_HALF_WIDTH: Record<Ride, number> = { wheel: 40, coaster: 140, loop: 140, tower: 10, slides: 125, gyro: 24 }

/** The lowest the hills get across a flat shape's width at radius r. */
function groundUnder(angle: number, r: number, halfWidth: number): number {
  const da = halfWidth / r
  let low = Infinity
  for (let i = -2; i <= 2; i++) low = Math.min(low, hillSurface(r, angle + (da * i) / 2))
  return low - 6
}

function drawRides(w: FlatWriter, rng: Rng) {
  const step = (Math.PI * 2) / RIDES.length
  RIDES.forEach((ride, i) => {
    const angle = i * step + rng.range(-0.25, 0.25) * step
    const r = RIDE_RING + rng.range(-50, 50)
    const s = rng.range(0.9, 1.25)
    w.color = rgb(rng.pick(['#2c3646', '#323a4e', '#2a3c48']))
    w.place(angle, r, groundUnder(angle, r, RIDE_HALF_WIDTH[ride] * s))
    if (ride === 'wheel') ferrisWheel(w, rng, s)
    else if (ride === 'coaster' || ride === 'loop') coaster(w, rng, s, ride === 'loop')
    else if (ride === 'tower') dropTower(w, rng, s)
    else if (ride === 'slides') waterSlides(w, rng, s)
    else gyroTower(w, rng, s)
  })
}

const SKYLINE_CLUSTERS = 10

/** Clusters of towers, spires and domes in the far valley: a town round the park. */
function drawSkyline(w: FlatWriter, rng: Rng) {
  for (let c = 0; c < SKYLINE_CLUSTERS; c++) {
    const centre = ((c + rng.range(-0.3, 0.3)) / SKYLINE_CLUSTERS) * Math.PI * 2
    const count = 4 + Math.floor(rng() * 5)
    for (let k = 0; k < count; k++) {
      const r = SKYLINE_RING + rng.range(-60, 60)
      const angle = centre + rng.range(-150, 150) / r
      const half = rng.range(10, 24)
      const h = rng.range(90, 300)
      w.color = rgb(rng.pick(['#323d4e', '#36404f', '#2e3a4a']))
      w.place(angle, r, groundUnder(angle, r, half))
      const roll = rng()
      if (roll < 0.15) {
        w.arc(0, 0, 0, half * 2, 0, Math.PI, 8)
      } else {
        w.rect(-half, 0, half, h)
        if (roll < 0.4) w.tri(-half * 0.6, h, half * 0.6, h, 0, h + rng.range(30, 80))
        else if (roll < 0.55) w.bar(0, h, 0, h + rng.range(30, 60), 2)
        const windows = Math.floor(rng.range(2, 7))
        for (let i = 0; i < windows; i++) w.light(rng.range(-half * 0.8, half * 0.8), rng.range(10, h - 6), rng.pick(WINDOWS))
      }
    }
  }
}

const TOWN_CLUSTERS = 16
const TOWN_LIGHTS = 10

/** Village lights on the slopes facing the park. */
function drawTownLights(w: FlatWriter, rng: Rng) {
  for (let c = 0; c < TOWN_CLUSTERS; c++) {
    const centre = rng() * Math.PI * 2
    const centreR = rng.pick([1200, 1800])
    for (let i = 0; i < TOWN_LIGHTS; i++) {
      const r = centreR + rng.range(-70, 70)
      const angle = centre + rng.range(-90, 90) / r
      w.place(angle, r, hillSurface(r, angle) + 3)
      w.light(0, 0, rng.pick(WINDOWS))
    }
  }
}

export interface HorizonLayout {
  rides: FlatWriter
  skyline: FlatWriter
}

export function buildTitleHorizon(seed = 459): HorizonLayout {
  const rng = createRng(seed)
  const rides = new FlatWriter()
  drawRides(rides, rng)
  const skyline = new FlatWriter()
  drawSkyline(skyline, rng)
  drawTownLights(skyline, rng)
  return { rides, skyline }
}
