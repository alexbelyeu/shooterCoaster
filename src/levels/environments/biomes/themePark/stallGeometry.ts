import * as THREE from 'three'
import { mergePainted, painted, paintedPolygon } from '../../shared/paintedParts'
import { SIGN_HEIGHT, SIGN_WIDTH, SIGN_Y, SIGN_Z, STALL_DEPTH, STALL_WIDTH } from './layout'

/**
 * Midway stall geometry, in the stall's local frame: origin on the ground at
 * the footprint centre, front (serving side, facing the track) towards +z.
 * Walls run SKIRT units below the origin so stalls on gentle slopes don't float.
 *
 * Each variant is two merged geometries: `neutral` (vertex-coloured wood,
 * canvas and white stripes) and `accent` (white, tinted per instance with the
 * stall's colour). One InstancedMesh each, so 3 variants = 6 draw calls.
 */
export interface StallGeometry {
  neutral: THREE.BufferGeometry
  accent: THREE.BufferGeometry
}

const SKIRT = 6
const W = STALL_WIDTH
const D = STALL_DEPTH
const CANVAS = new THREE.Color('#f5e6c8')
const WOOD = new THREE.Color('#8b5a2b')
const DARK = new THREE.Color('#3b2618')
const WHITE = new THREE.Color('#ffffff')
const STRIPES = 6

/** Box from y0 to y1 (both local), centred on (x, z). */
function box(w: number, y0: number, y1: number, d: number, color: THREE.Color, x = 0, z = 0) {
  return painted(new THREE.BoxGeometry(w, y1 - y0, d), color, [x, (y0 + y1) / 2, z])
}

// Flat pieces are single-sided; the stall materials are double-sided.
const tri = (a: number[], b: number[], c: number[], color: THREE.Color) => paintedPolygon([...a, ...b, ...c], color)
const quad = (a: number[], b: number[], c: number[], d: number[], color: THREE.Color) =>
  paintedPolygon([...a, ...b, ...c, ...a, ...c, ...d], color)

/**
 * A roof slope from the edge at (y0, z0) to the edge at (y1, z1), across the
 * full width, cut into stripes running down the slope; even stripes go to
 * `accent`, odd ones to `neutral` (white).
 */
function stripedSlope(
  y0: number, z0: number, y1: number, z1: number, width: number,
  accent: THREE.BufferGeometry[], neutral: THREE.BufferGeometry[],
) {
  for (let k = 0; k < STRIPES; k++) {
    const xa = -width / 2 + (width * k) / STRIPES
    const xb = xa + width / STRIPES
    const q = quad([xa, y0, z0], [xa, y1, z1], [xb, y1, z1], [xb, y0, z0], WHITE)
    ;(k % 2 === 0 ? accent : neutral).push(q)
  }
}

/** Gable-roofed booth with a striped canvas roof and a serving hatch. */
function stripedRoofStall(): StallGeometry {
  const neutral = [
    box(W - 2, -SKIRT, 13, D - 2, CANVAS),
    box(W - 7, 5, 11, 0.6, DARK, 0, (D - 2) / 2),
    box(W - 5, 5, 6, 3.5, WOOD, 0, (D - 2) / 2 + 1.5),
  ]
  const accent: THREE.BufferGeometry[] = []
  const rw = W + 2
  stripedSlope(12, D / 2 + 3, 21, 0, rw, accent, neutral)
  stripedSlope(12, -D / 2 - 1.5, 21, 0, rw, accent, neutral)
  // Gable ends.
  for (const x of [-rw / 2, rw / 2]) {
    neutral.push(tri([x, 12, D / 2 + 3], [x, 21, 0], [x, 12, -D / 2 - 1.5], CANVAS))
  }
  accent.push(painted(new THREE.ConeGeometry(1.4, 5, 4), WHITE, [0, 23, 0]))
  return { neutral: mergePainted(neutral), accent: mergePainted(accent) }
}

/** Open-fronted counter booth: painted counter, striped awning, scalloped valance. */
function counterStall(): StallGeometry {
  const neutral = [
    box(W - 2, -SKIRT, 18, 2, CANVAS, 0, -D / 2 + 1),
    box(1.5, -SKIRT, 18, D - 2, CANVAS, -(W / 2 - 1.75), 0),
    box(1.5, -SKIRT, 18, D - 2, CANVAS, W / 2 - 1.75, 0),
    box(W, 9, 10, 5, WOOD, 0, D / 2 - 3),
  ]
  const accent = [box(W - 4, -SKIRT, 9, 4, WHITE, 0, D / 2 - 3)]
  const front = D / 2 + 4
  stripedSlope(15, front, 19, -D / 2, W + 2, accent, neutral)
  // Valance: triangles hanging from the awning's front edge.
  const n = 8
  for (let k = 0; k < n; k++) {
    const xa = -(W + 2) / 2 + ((W + 2) * k) / n
    const xb = xa + (W + 2) / n
    const flap = tri([xa, 15, front], [xb, 15, front], [(xa + xb) / 2, 12, front], WHITE)
    ;(k % 2 === 0 ? accent : neutral).push(flap)
  }
  return { neutral: mergePainted(neutral), accent: mergePainted(accent) }
}

/** Kiosk with a flat roof and a big framed sign board (marquee bulbs come from the layout). */
function signStall(): StallGeometry {
  const neutral = [
    box(W - 2, -SKIRT, 15, D - 2, CANVAS),
    box(W - 7, 5, 11, 0.6, DARK, 0, (D - 2) / 2),
    box(W - 5, 5, 6, 3.5, WOOD, 0, (D - 2) / 2 + 1.5),
    box(SIGN_WIDTH + 2, SIGN_Y - SIGN_HEIGHT / 2 - 1, SIGN_Y + SIGN_HEIGHT / 2 + 1, 0.8, WHITE, 0, SIGN_Z - 0.6),
    box(1, 16.5, SIGN_Y, 1, WOOD, -SIGN_WIDTH / 3, SIGN_Z - 1),
    box(1, 16.5, SIGN_Y, 1, WOOD, SIGN_WIDTH / 3, SIGN_Z - 1),
  ]
  const accent = [
    box(W, 15, 16.5, D + 2, WHITE),
    box(SIGN_WIDTH, SIGN_Y - SIGN_HEIGHT / 2, SIGN_Y + SIGN_HEIGHT / 2, 1, WHITE, 0, SIGN_Z),
  ]
  return { neutral: mergePainted(neutral), accent: mergePainted(accent) }
}

/** Index = layout variant (SIGN_VARIANT is the sign stall). */
export function buildStallGeometries(): StallGeometry[] {
  return [stripedRoofStall(), counterStall(), signStall()]
}
