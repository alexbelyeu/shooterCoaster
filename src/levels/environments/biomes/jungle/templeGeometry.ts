import * as THREE from 'three'
import { mergePainted, painted, paintedAt, pose, type Paint } from '@/levels/environments/shared/paintedParts'
import { createRng } from '@/utils/rng'
import { TEMPLE } from './config'

// The stepped temple (#870), Jungle Ruins' hero landmark, in one geometry: seven weathered tiers mossed on every
// ledge, a stair up the front (+z) to a shrine with a dark doorway and a roof comb, vines hanging down the faces.
// Model space: the bottom tier's foot at y = 0, so it stands on the terrace's ground; the bottom tier runs on below it.

const STONE = ['#9c9478', '#8c876f', '#a59c80', '#7f7b66'] as const
const MOSS = '#56702f'
const MOSS_DARK = '#3e5524'
const VINE = '#2f4a1e'
const DOORWAY = '#16130f'
/** How far the bottom tier runs on into the ground, so the terrace's falloff never shows its underside. */
const FOOTING = 120
const STAIR_HALF_WIDTH = 55
const STEPS_PER_TIER = 4

/** Half the width of tier `i` (0 = bottom). */
export function tierHalfWidth(i: number): number {
  return TEMPLE.base * (1 - i * 0.115)
}

/** Weathered stone with moss on whatever faces up: picked per triangle by its centroid. */
function stoneMossed(top: number, seed: number): Paint {
  const rng = createRng(seed)
  const shades = Array.from({ length: 16 }, () => STONE[Math.floor(rng() * STONE.length)])
  return (x, y, z) => {
    if (y > top - 0.5) return Math.abs(Math.sin(x * 0.05) + Math.cos(z * 0.04)) > 0.4 ? MOSS : MOSS_DARK
    return shades[Math.floor(Math.abs(x * 0.013 + y * 0.03 + z * 0.011) * 7) % shades.length]
  }
}

function box(w: number, h: number, d: number, at: [number, number, number], paint: Paint, yaw = 0): THREE.BufferGeometry {
  return paintedAt(new THREE.BoxGeometry(w, h, d), paint, pose(at, [0, yaw, 0]))
}

export function buildTempleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const h = TEMPLE.tierHeight
  const topY = TEMPLE.tiers * h

  for (let i = 0; i < TEMPLE.tiers; i++) {
    const w = tierHalfWidth(i)
    const bottom = i === 0 ? -FOOTING : i * h
    const top = (i + 1) * h
    // Centred at the origin, the paint reads the box's own frame: its top face sits at half its height.
    parts.push(box(w * 2, top - bottom, w * 2, [0, (top + bottom) / 2, 0], stoneMossed((top - bottom) / 2, 40 + i)))
  }

  // The stair: from the foot in front of the bottom tier to the top tier's edge, solid back into the temple.
  const steps = TEMPLE.tiers * STEPS_PER_TIER
  const zFoot = tierHalfWidth(0) + 150
  const zTop = tierHalfWidth(TEMPLE.tiers - 1)
  for (let k = 0; k < steps; k++) {
    const y = ((k + 1) / steps) * topY
    const front = zFoot - (k / steps) * (zFoot - zTop)
    const back = zTop - 20
    parts.push(box(STAIR_HALF_WIDTH * 2, y + 10, front - back, [0, (y - 10) / 2, (front + back) / 2], k % 2 ? STONE[0] : STONE[1]))
  }
  // Balustrades: a sloped slab each side of the stair
  const slope = Math.atan2(topY, zFoot - zTop)
  const run = Math.hypot(topY, zFoot - zTop)
  for (const side of [-1, 1]) {
    parts.push(paintedAt(new THREE.BoxGeometry(16, 22, run), STONE[3],
      pose([side * (STAIR_HALF_WIDTH + 8), topY / 2 + 8, (zFoot + zTop) / 2], [slope, 0, 0])))
  }

  // The shrine on top: walls, a dark doorway facing the stair, a stepped roof and its comb
  const shrineW = tierHalfWidth(TEMPLE.tiers - 1) * 0.75
  parts.push(box(shrineW * 2, 70, shrineW * 1.6, [0, topY + 35, 0], stoneMossed(35, 90)))
  parts.push(box(40, 52, 6, [0, topY + 26, shrineW * 0.8 + 1], DOORWAY))
  parts.push(box(shrineW * 2.2, 10, shrineW * 1.8, [0, topY + 75, 0], MOSS_DARK))
  parts.push(painted(new THREE.CylinderGeometry(shrineW * 0.25, shrineW * 1.1, 24, 4, 1).rotateY(Math.PI / 4), STONE[2], [0, topY + 92, 0]))
  parts.push(box(shrineW * 1.1, 32, 10, [0, topY + 118, 0], STONE[1]))

  // Vines down the faces and fallen blocks on the ledges, seeded
  const rng = createRng(870)
  for (let n = 0; n < 46; n++) {
    const tier = Math.floor(rng() * TEMPLE.tiers)
    const w = tierHalfWidth(tier)
    const top = (tier + 1) * h
    const length = h * (0.5 + rng() * 1.6)
    const along = (rng() * 2 - 1) * (w - 12)
    const face = Math.floor(rng() * 4)
    if (face === 0 && Math.abs(along) < STAIR_HALF_WIDTH + 20) continue
    const yaw = (face * Math.PI) / 2
    const [sx, sz] = [Math.sin(yaw), Math.cos(yaw)]
    // A face's outward normal is (sx, sz); `along` runs across it.
    const at: [number, number, number] = [sx * (w + 2) + sz * along, top - length / 2, sz * (w + 2) - sx * along]
    parts.push(box(6 + rng() * 6, length, 3, at, rng() < 0.5 ? VINE : MOSS_DARK, yaw))
  }
  for (let n = 0; n < 14; n++) {
    const tier = 1 + Math.floor(rng() * (TEMPLE.tiers - 2))
    const w = tierHalfWidth(tier)
    const a = rng() * Math.PI * 2
    const r = w - 20 - rng() * 10
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (Math.abs(x) < STAIR_HALF_WIDTH + 30 && z > 0) continue
    const s = 14 + rng() * 14
    parts.push(paintedAt(new THREE.BoxGeometry(s * 1.4, s, s), STONE[Math.floor(rng() * STONE.length)],
      pose([x, (tier + 1) * h + s * 0.4, z], [rng() * 0.4, rng() * Math.PI, rng() * 0.3])))
  }
  return mergePainted(parts)
}
