import { createRng } from '@/utils/rng'

/** A climbable surface: triangles (non-indexed x, y, z) in blockout metres, and which faces take holds. */
export interface ClimbSurface {
  positions: ArrayLike<number>
  /** Unit face normal → does this face take holds (the climbing side, not the back or a top). */
  accept: (nx: number, ny: number, nz: number) => boolean
  /** Holds per square metre. */
  density: number
  /** Volumes per square metre (the boulders' big shapes). */
  volumes: number
}

export interface Placement {
  x: number
  y: number
  z: number
  /** Unit normal of the face it sits on. */
  nx: number
  ny: number
  nz: number
  /** 0..1, for the caller's size, colour and roll. */
  pick: number
  roll: number
}

/** Area-weighted points on a surface's accepted faces, `perSquareMetre` of them (pure, seeded). */
export function scatterOn(positions: ArrayLike<number>, accept: ClimbSurface['accept'], perSquareMetre: number, seed: number): Placement[] {
  const faces: { i: number; nx: number; ny: number; nz: number }[] = []
  const cumulative: number[] = []
  let total = 0
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const ux = positions[i + 3] - positions[i]
    const uy = positions[i + 4] - positions[i + 1]
    const uz = positions[i + 5] - positions[i + 2]
    const vx = positions[i + 6] - positions[i]
    const vy = positions[i + 7] - positions[i + 1]
    const vz = positions[i + 8] - positions[i + 2]
    const cx = uy * vz - uz * vy
    const cy = uz * vx - ux * vz
    const cz = ux * vy - uy * vx
    const len = Math.hypot(cx, cy, cz)
    if (len < 1e-9) continue
    const nx = cx / len
    const ny = cy / len
    const nz = cz / len
    if (!accept(nx, ny, nz)) continue
    total += len / 2
    faces.push({ i, nx, ny, nz })
    cumulative.push(total)
  }
  const count = Math.round(total * perSquareMetre)
  const rng = createRng(seed)
  const out: Placement[] = []
  for (let k = 0; k < count; k++) {
    const target = rng() * total
    let lo = 0
    let hi = cumulative.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cumulative[mid] < target) lo = mid + 1
      else hi = mid
    }
    const f = faces[lo]
    let a = rng()
    let b = rng()
    if (a + b > 1) {
      a = 1 - a
      b = 1 - b
    }
    const p = (axis: number) =>
      positions[f.i + axis] + a * (positions[f.i + 3 + axis] - positions[f.i + axis]) + b * (positions[f.i + 6 + axis] - positions[f.i + axis])
    out.push({ x: p(0), y: p(1), z: p(2), nx: f.nx, ny: f.ny, nz: f.nz, pick: rng(), roll: rng() * Math.PI * 2 })
  }
  return out
}
