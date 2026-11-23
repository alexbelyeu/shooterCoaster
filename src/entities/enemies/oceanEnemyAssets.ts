import * as THREE from 'three'
import { mergePainted, painted, paintedAt, pose, sunShaded } from '@/levels/environments/shared/paintedParts'
import { fin, grin, recolor } from './enemyPaint'
import { withRim } from './enemyRim'
import { SHARK_TOP as SHARK_TOP_HEX, SHARK_BELLY as SHARK_BELLY_HEX } from './enemyPalette'

// The Ocean's shark as a character (#813, brief in docs/art/ENEMIES.md): a toy shark, long nose, big dorsal and a
// red-gummed grin. Every part is vertex-painted and merged per moving part, body and tail; +z is the nose, +y up.
// Re-exported by SharedEnemyAssets, so ShaderWarmup compiles its material.

type Vec3 = [number, number, number]

const SHARK_TOP = new THREE.Color(SHARK_TOP_HEX)
const SHARK_SPINE = new THREE.Color('#2a465c')
const SHARK_BELLY = new THREE.Color(SHARK_BELLY_HEX)
const SHARK_GILL = '#1a2a38'
const SHARK_GUM = '#a83a3a'
const SHARK_TOOTH = '#f6f2e4'
const SHARK_EYE = '#0b0e13'

/** The tail's pivot, where the body narrows (model units): it sweeps about y from here. */
export const SHARK_TAIL_ROOT: Vec3 = [0, 0, -2.5]

/** A lathe profile (radius, length along the nose) turned to run along +z, a little flatter than it is wide. */
function torso(profile: number[][], at: Vec3): THREE.BufferGeometry {
  const lathe = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), 8)
  return paintedAt(lathe, SHARK_TOP, pose(at, [Math.PI / 2, 0, 0], [1, 1, 0.88]))
}

/** Counter-shading: steel-blue back darkening along the spine, a white belly below the flank line. */
function counterShaded(g: THREE.BufferGeometry, y0: number): THREE.BufferGeometry {
  return recolor(g, (_x, y, _z, c) => c.copy(SHARK_BELLY)
    .lerp(SHARK_TOP, THREE.MathUtils.smoothstep(y, y0 - 0.7, y0))
    .lerp(SHARK_SPINE, THREE.MathUtils.smoothstep(y, 1.3, 2.3)))
}

/** A fin standing up from its root, its outline drawn as (distance back, height). */
const finUp = (outline: [number, number][], thickness: number, at: Vec3, color: THREE.ColorRepresentation = SHARK_TOP) =>
  paintedAt(fin(outline, thickness), color, pose(at, [0, Math.PI / 2, 0]))

/** Grin: the gums' half-widths and lift, so the teeth can follow its curve. */
const GRIN_AT: Vec3 = [0, -1.3, 6.2]
const GRIN_SIZE: Vec3 = [1.45, 0.34, 0.85]
const grinY = (x: number) => GRIN_AT[1] + GRIN_SIZE[1] * 0.9 * (x / GRIN_SIZE[0]) ** 2
const grinZ = (x: number) => GRIN_AT[2] + GRIN_SIZE[2] * Math.sqrt(Math.max(0, 1 - (x / GRIN_SIZE[0]) ** 2))

function teeth(): THREE.BufferGeometry[] {
  const upper = [-0.9, -0.45, 0, 0.45, 0.9].map((x) =>
    painted(new THREE.ConeGeometry(0.14, 0.42, 3), SHARK_TOOTH, [x, grinY(x) + 0.05, grinZ(x) - 0.12], [Math.PI, 0, 0]))
  const lower = [-0.65, 0, 0.65].map((x) =>
    painted(new THREE.ConeGeometry(0.12, 0.32, 3), SHARK_TOOTH, [x, grinY(x) - 0.2, grinZ(x) - 0.2]))
  return [...upper, ...lower]
}

/** Head, torso, dorsal, pectorals, gills, grin and eyes: everything in front of `SHARK_TAIL_ROOT`. */
export const SHARK_BODY_GEO = sunShaded(mergePainted([
  counterShaded(torso([[0, -2.7], [1.55, -2.6], [2.15, -1], [2.6, 1], [2.62, 3], [2.35, 5], [1.8, 6.6], [1, 7.7], [0.35, 8.2], [0, 8.35]], [0, 0, 0]), -0.4),
  // A tall dorsal, its trailing edge curved like a sickle, and the second dorsal by the tail.
  finUp([[-1.7, 0], [1.3, 0], [0.95, 1.2], [2.1, 3.7], [0.25, 2.1]], 0.36, [0, 2.05, 0.9]),
  // Pectorals swept back and drooping, as the toy holds them.
  ...[-1, 1].map((s) => paintedAt(fin([[0, -0.9], [3.4, 1.7], [2.6, 2], [0, 0.9]], 0.28), SHARK_TOP,
    pose([s * 2.1, -1.2, 3.1], [-Math.PI / 2, s * 0.45, 0], [s, 1, 1]))),
  // Three gill slits a side, behind the eye.
  ...[-1, 1].flatMap((s) => [3.9, 4.35, 4.8].map((z) =>
    painted(new THREE.BoxGeometry(0.12, 1.35, 0.16), SHARK_GILL, [s * 2.47, -0.15, z], [0, 0, s * 0.12]))),
  // The grin: red gums with the corners up, white teeth.
  paintedAt(grin(new THREE.SphereGeometry(1, 8, 3)), SHARK_GUM, pose(GRIN_AT, [0.2, 0, 0], GRIN_SIZE)),
  ...teeth(),
  // Black eyes, each with one glint.
  ...[-1, 1].flatMap((s) => [
    paintedAt(new THREE.SphereGeometry(0.42, 6, 4), SHARK_EYE, pose([s * 1.85, 0.55, 5.7])),
    paintedAt(new THREE.OctahedronGeometry(0.14, 0), '#ffffff', pose([s * 2.05, 0.75, 5.95])),
  ]),
]))

/** From `SHARK_TAIL_ROOT` (its origin) back: the narrowing tail and the crescent fin, the upper lobe the longer. */
export const SHARK_TAIL_GEO = sunShaded(mergePainted([
  counterShaded(torso([[0, -4.6], [0.45, -4.3], [0.8, -3], [1.25, -1.5], [1.6, 0], [1.4, 0.6], [0, 0.7]], [0, 0, 0]), -0.25),
  finUp([[-0.6, -0.4], [1.7, -1.9], [1, 0.1], [2.6, 3.4], [-0.4, 0.9]], 0.3, [0, 0, -4]),
  finUp([[-0.5, 0], [0.6, 0], [0.7, 0.9]], 0.2, [0, 1, -0.6]),
]))

const SHARK_RIM = { color: '#e0f4ff', intensity: 0.65, power: 2.5 }
export const SHARK_MAT = withRim(new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.38, metalness: 0.12, flatShading: true,
}), SHARK_RIM)
