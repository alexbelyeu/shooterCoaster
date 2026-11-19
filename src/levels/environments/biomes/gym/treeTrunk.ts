import { createRng } from '@/utils/rng'
import { TREE_GAP, treeHeadLean, type PieceOf } from './blockout'
import { pushTri, type V3 } from './wallPanels'

/**
 * The Tree's wood (#519, pure, seeded): a barked trunk standing on four buttress roots, with surface roots
 * spreading over the pit floor into the caves, two great limbs roofing the caves, and branches climbing the
 * headwall as its frame. The four roots leave the gap a tree has (Alex, #558): under the trunk, cave to cave
 * and front to back, big enough for the coaster (`TREE_GAP`). Local frame as `hallGeometry`'s `frame()`:
 * x along the Tree, y up from the pit floor, z out from its back wall's foot line. Everything stays inside the
 * Tree's footprint (`pieceBoxes`).
 */

export interface TreeWood {
  /** Non-indexed triangles, 9 numbers each, wound to face out. */
  positions: number[]
  /** Per triangle, 0 in a bark groove … 1 on a ridge. */
  tone: number[]
}

const SEGMENTS = 16
/** How far bark ridges stand off a ring's radius, at most. */
const BARK = 0.22

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** n points on a cubic Bézier. */
function bezier(p0: V3, p1: V3, p2: V3, p3: V3, n: number): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const a = (1 - t) ** 3
    const b = 3 * (1 - t) ** 2 * t
    const c = 3 * (1 - t) * t * t
    const d = t ** 3
    return [0, 1, 2].map((k) => a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k]) as V3
  })
}

/**
 * A barked tube through `path`: each ring perpendicular to the path, radius `ru` along `ref` (projected onto
 * the ring) and `rv` across it, both swelling by up to `BARK` on ridges that twist up the tube. Capped both ends.
 */
function loft(out: TreeWood, path: readonly V3[], radii: readonly [number, number][], ref: V3, seed: number): void {
  const rng = createRng(seed)
  const phase = [rng() * 6.3, rng() * 6.3]
  const knots = Array.from({ length: SEGMENTS }, () => rng() - 0.5)
  const ridge = (k: number, j: number) => {
    const a = (k / SEGMENTS) * Math.PI * 2 + j * 0.3
    return 0.5 + 0.3 * Math.sin(5 * a + phase[0]) + 0.15 * Math.sin(9 * a + phase[1]) + 0.25 * knots[k]
  }
  const rings = path.map((c, j) => {
    const t = norm(sub(path[Math.min(j + 1, path.length - 1)], path[Math.max(j - 1, 0)]))
    const u = norm(sub(ref, t.map((x) => x * dot(ref, t)) as V3))
    const v = cross(t, u)
    const [ru, rv] = radii[j]
    return Array.from({ length: SEGMENTS }, (_, k) => {
      const a = (k / SEGMENTS) * Math.PI * 2
      const s = 1 + BARK * Math.min(1, Math.max(0, ridge(k, j)))
      const cu = Math.cos(a) * ru * s
      const cv = Math.sin(a) * rv * s
      return [c[0] + u[0] * cu + v[0] * cv, c[1] + u[1] * cu + v[1] * cv, c[2] + u[2] * cu + v[2] * cv] as V3
    })
  })
  for (let j = 0; j + 1 < rings.length; j++) {
    for (let k = 0; k < SEGMENTS; k++) {
      const m = (k + 1) % SEGMENTS
      const a = rings[j][k]
      const b = rings[j][m]
      const c = rings[j + 1][m]
      const d = rings[j + 1][k]
      const hint = norm(sub([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], [(path[j][0] + path[j + 1][0]) / 2, (path[j][1] + path[j + 1][1]) / 2, (path[j][2] + path[j + 1][2]) / 2]))
      const tone = Math.min(1, Math.max(0, (ridge(k, j) + ridge(m, j + 1)) / 2))
      pushTri(out.positions, a, b, c, hint)
      pushTri(out.positions, a, c, d, hint)
      out.tone.push(tone, tone)
    }
  }
  for (const [j, sign] of [[0, -1], [rings.length - 1, 1]] as const) {
    const t = norm(sub(path[Math.min(j + 1, path.length - 1)], path[Math.max(j - 1, 0)]))
    const hint = t.map((x) => x * sign) as V3
    for (let k = 0; k < SEGMENTS; k++) {
      pushTri(out.positions, path[j], rings[j][k], rings[j][(k + 1) % SEGMENTS], hint)
      out.tone.push(0.2)
    }
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Build the Tree's wood. */
export function buildTreeWood(t: PieceOf<'tree'>): TreeWood {
  const out: TreeWood = { positions: [], tone: [] }
  const rng = createRng(5190)
  const half = t.width / 2
  const lip = t.caveDepth
  const lean = treeHeadLean(t)
  /** The headwall's face at height y, and the footprint's front less a ridge's swell. */
  const face = (y: number) => lip + (Math.max(0, y - t.caveHeight) / (t.height - t.caveHeight)) * lean
  const front = lip + lean - 0.05
  const swell = 1 + BARK
  let seed = 1

  // The trunk: from its underside (the gap's ceiling) up through the caves' roof and on up the headwall.
  const core = lip * 0.6
  const r = t.trunk / 2 + 0.5
  const trunk: { y: number; ru: number; rv: number }[] = [
    { y: TREE_GAP.height, ru: 0.6, rv: 0.6 },
    { y: TREE_GAP.height + 0.3, ru: r * 0.8, rv: lip * 0.38 },
    { y: TREE_GAP.height + 1, ru: r * 1.05, rv: lip * 0.48 },
    { y: t.caveHeight - 1.5, ru: r, rv: lip * 0.47 },
    { y: t.caveHeight - 0.4, ru: r * 1.08, rv: lip * 0.5 },
  ]
  for (let y = t.caveHeight + 1; y < t.height - 3; y += 1.6) {
    const k = (y - t.caveHeight) / (t.height - t.caveHeight)
    trunk.push({ y, ru: lerp(r, 0.7, k), rv: lerp(lip * 0.5, 0.5, k) })
  }
  trunk.push({ y: t.height - 2.6, ru: 0.25, rv: 0.2 })
  loft(
    out,
    trunk.map((ring) => {
      // On the headwall the trunk stands proud of the face by its own depth, inside the footprint.
      const z = ring.y <= t.caveHeight ? core : Math.min(face(ring.y) + 0.15, front - ring.rv * swell)
      return [0, ring.y, Math.max(z, ring.rv * swell - 0.45)] as V3
    }),
    trunk.map((ring) => [ring.ru, ring.rv]),
    [1, 0, 0],
    seed++,
  )

  // Four buttress roots: thin fins radiating along the Tree, tall in their own plane. Front pair at the lip, back pair at the wall.
  for (const sx of [-1, 1]) {
    for (const [z, rf] of [[lip + 0.75, 0.5], [0.05, 0.4]] as const) {
      const path = bezier([sx * (half * 0.56), -0.3, z], [sx * (half * 0.38), 0.4, z], [sx * 2.4, 2.4, z], [sx * 1.5, TREE_GAP.height + 1.4, z], 9)
      loft(out, path, path.map((_, j) => [rf, lerp(1.3, 0.85, j / 8)]), [0, 0, 1], seed++)
    }
  }

  // Surface roots over the pit floor into the caves, half sunk.
  for (const sx of [-1, 1]) {
    for (const z0 of [lip * 0.9, lip * 0.5, 0.4]) {
      const x0 = half * (0.42 + rng() * 0.08)
      const x1 = half * (0.75 + rng() * 0.2)
      const z1 = Math.min(lip + 0.6, Math.max(0.1, z0 + (rng() - 0.5) * 2.4))
      const path = bezier([sx * x0, 0, z0], [sx * lerp(x0, x1, 0.35), 0.15, lerp(z0, z1, 0.2)], [sx * lerp(x0, x1, 0.7), 0.05, lerp(z0, z1, 0.8)], [sx * x1, -0.12, z1], 7)
      loft(out, path, path.map((_, j) => [lerp(0.38, 0.1, j / 6), lerp(0.55, 0.12, j / 6)]), [0, 1, 0], seed++)
    }
  }

  // Two great limbs: the caves' roofs, out from the trunk to the Tree's ends.
  for (const sx of [-1, 1]) {
    const y = t.caveHeight - 0.45
    const path = bezier([sx * 1.2, y - 0.3, core], [sx * half * 0.35, y + 0.25, core], [sx * half * 0.7, y + 0.05, core - 0.1], [sx * (half - 0.2), y, core - 0.2], 9)
    loft(out, path, path.map((_, j) => [lerp(0.85, 0.6, j / 8), lerp(lip * 0.52, lip * 0.47, j / 8)]), [0, 1, 0], seed++)
  }

  // Branches up the headwall, flattened against it: the panels' frame.
  const branches: [V3, V3, V3, V3, number][] = [
    [[1.2, t.caveHeight + 1.5, 0], [half * 0.35, t.caveHeight + 4, 0], [half * 0.6, t.caveHeight + 7, 0], [half * 0.85, t.height - 3, 0], 0.65],
    [[0.8, t.caveHeight + 5, 0], [half * 0.2, t.caveHeight + 8, 0], [half * 0.3, t.height - 3.5, 0], [half * 0.45, t.height - 0.6, 0], 0.5],
    [[1.8, t.caveHeight + 0.8, 0], [half * 0.5, t.caveHeight + 1.2, 0], [half * 0.8, t.caveHeight + 2.4, 0], [half - 0.3, t.caveHeight + 3.8, 0], 0.45],
  ]
  for (const sx of [-1, 1]) {
    for (const [p0, p1, p2, p3, r0] of branches) {
      const path = bezier(...([p0, p1, p2, p3].map((p) => [sx * p[0], p[1], 0]) as [V3, V3, V3, V3]), 10)
      const radii = path.map((_, j): [number, number] => {
        const k = lerp(r0, 0.16, j / 9)
        return [k * 0.7, k]
      })
      path.forEach((p, j) => {
        p[2] = Math.min(face(p[1]) + 0.1, front - radii[j][0] * swell)
      })
      loft(out, path, radii, [0, 0, 1], seed++)
    }
  }
  return out
}
