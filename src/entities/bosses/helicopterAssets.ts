import * as THREE from 'three'
import { mergePainted, painted } from '@/levels/environments/shared/paintedParts'
import { cityMachineMaterial } from '@/entities/enemies/cityEnemyAssets'
import { HELI_LAYOUT } from './bossSpecs'

// The Helicopter (Neon Metropolis's finale, #325; brief in docs/art/ENEMIES.md). Only Helicopter.tsx imports this, so it
// rides in the city's world chunk; the dormant boss is mounted with the level, so ShaderWarmup's scene pass compiles it.
// +z is the nose, +y up. Its paint follows the hover drone's: a dark frame the rim outlines, bright paint that burns
// (`cityMachineMaterial`), so it shares the drone's program.

const HULL = '#262b38'
const HULL_TOP = '#3c4354'
const BELLY = '#1a1d26'
const CYAN = '#2ee8ff'
const MAGENTA = '#ff2fb0'
const RED = '#ff2a3a'
const LAMP = '#fff1b8'
const AMBER = '#ffb020'
const BEAM_COLOR = new THREE.Color('#fff4d0')

const { rotorRadius, rotorY, tailRotor } = HELI_LAYOUT
const TAIL_Z = tailRotor[2]

/** A box stretched along the hull, `from` → `to` along z. */
const strip = (w: number, h: number, from: number, to: number, x: number, y: number, color: string) =>
  painted(new THREE.BoxGeometry(w, h, to - from), color, [x, y, (from + to) / 2])

/** Cabin, tail boom, fin, skids, the canopy's glow and the lights along it. */
export const HELI_BODY_GEO = mergePainted([
  // Cabin: a squat egg, the dark belly under a lighter top.
  painted(new THREE.SphereGeometry(1, 10, 7).scale(48, 42, 78), HULL),
  painted(new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(44, 30, 66), HULL_TOP, [0, 12, -6]),
  painted(new THREE.BoxGeometry(70, 14, 110), BELLY, [0, -36, 0]),
  // Engine cowling and mast under the rotor.
  painted(new THREE.CylinderGeometry(24, 30, 26, 8), HULL_TOP, [0, 40, -12]),
  painted(new THREE.CylinderGeometry(6, 8, 22, 6), BELLY, [0, 56, 0]),
  // Tail boom tapering to the fin, a magenta stripe down each side.
  painted(new THREE.CylinderGeometry(15, 7, -TAIL_Z - 50, 8), HULL, [0, 12, (TAIL_Z - 50) / 2], [Math.PI / 2, 0, 0]),
  strip(2, 5, TAIL_Z + 20, -60, 13, 14, MAGENTA),
  strip(2, 5, TAIL_Z + 20, -60, -13, 14, MAGENTA),
  painted(new THREE.BoxGeometry(6, 64, 34), HULL_TOP, [0, 30, TAIL_Z - 6], [-0.35, 0, 0]),
  painted(new THREE.BoxGeometry(60, 4, 22), HULL_TOP, [0, 12, TAIL_Z + 24]),
  // Skids on their struts.
  ...[-1, 1].flatMap((s) => [
    painted(new THREE.CylinderGeometry(3, 3, 150, 6), BELLY, [s * 38, -62, 4], [Math.PI / 2, 0, 0]),
    painted(new THREE.BoxGeometry(4, 26, 4), BELLY, [s * 34, -50, 40], [0, 0, s * 0.25]),
    painted(new THREE.BoxGeometry(4, 26, 4), BELLY, [s * 34, -50, -30], [0, 0, s * 0.25]),
  ]),
  // Canopy glow: the windscreen and a side window each side.
  painted(new THREE.SphereGeometry(1, 10, 4, Math.PI / 2 - 0.75, 1.5, 0.85, 0.6).scale(49, 43, 80), CYAN, [0, 2, 0]),
  painted(new THREE.BoxGeometry(2, 18, 34), CYAN, [47, 8, 16]),
  painted(new THREE.BoxGeometry(2, 18, 34), CYAN, [-47, 8, 16]),
  // Nav lights: cyan to starboard, red to port, a red beacon on the fin and one under the belly.
  painted(new THREE.SphereGeometry(5, 6, 4), CYAN, [62, -6, 0]),
  painted(new THREE.SphereGeometry(5, 6, 4), RED, [-62, -6, 0]),
  painted(new THREE.BoxGeometry(14, 6, 6), CYAN, [55, -6, 0]),
  painted(new THREE.BoxGeometry(14, 6, 6), RED, [-55, -6, 0]),
  painted(new THREE.SphereGeometry(5, 6, 4), RED, [0, 64, TAIL_Z - 14]),
  painted(new THREE.SphereGeometry(4, 6, 4), RED, [0, -45, -30]),
])

/** Its frame: the hull, and every weak point's housing (the hit flash swaps it out per part). */
export const HELI_MAT = cityMachineMaterial(CYAN)

/** Two blades in the body's paint, turned by the rotor group. */
export const HELI_BLADES_GEO = mergePainted([
  painted(new THREE.BoxGeometry(rotorRadius * 2, 3, 14), BELLY),
  painted(new THREE.BoxGeometry(14, 3, rotorRadius * 2), BELLY),
])

export const HELI_ROTOR_AT: [number, number, number] = [0, rotorY, 0]

/** The spinning blur of a rotor: a pale disc with streaks, seen through. Unit radius, in the xz plane. */
export const HELI_ROTOR_BLUR_GEO = (() => {
  const g = new THREE.CircleGeometry(1, 24, 0, Math.PI * 2).rotateX(-Math.PI / 2)
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i))
    // Brighter at the tips, where the blades move fastest; a dark hub.
    c.setRGB(0.35, 0.42, 0.55).multiplyScalar(0.3 + 0.7 * r)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
})()

export const HELI_ROTOR_BLUR_MAT = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  side: THREE.DoubleSide,
})

/** The searchlight: a drum on a yoke under the nose, its lens burning warm white. */
export const HELI_SEARCHLIGHT_GEO = mergePainted([
  painted(new THREE.BoxGeometry(10, 22, 10), BELLY, [0, 12, -6]),
  painted(new THREE.CylinderGeometry(18, 15, 30, 10), HULL_TOP, [0, 0, 0], [Math.PI / 2, 0, 0]),
  painted(new THREE.CylinderGeometry(16, 16, 3, 12), LAMP, [0, 0, 16], [Math.PI / 2, 0, 0]),
])

/** The tail rotor: a burning magenta ring on its hub, its blades and blur, in the yz plane (it spins about x). */
export const HELI_TAIL_ROTOR_GEO = mergePainted([
  painted(new THREE.CylinderGeometry(7, 7, 10, 8), BELLY, [-4, 0, 0], [0, 0, Math.PI / 2]),
  painted(new THREE.TorusGeometry(30, 3.5, 4, 18), MAGENTA, [0, 0, 0], [0, Math.PI / 2, 0]),
  painted(new THREE.BoxGeometry(3, 58, 7), HULL_TOP, [2, 0, 0]),
  painted(new THREE.BoxGeometry(3, 7, 58), HULL_TOP, [2, 0, 0]),
])

/** The tail rotor's blur disc radius: the unit main blur disc (`HELI_ROTOR_BLUR_GEO`) scaled to the ring, turned into the yz plane where it is mounted. */
export const HELI_TAIL_BLUR_SCALE = 30

/** The main rotor's hub: a cap on the mast ringed in amber, the last weak point. */
export const HELI_HUB_GEO = mergePainted([
  painted(new THREE.CylinderGeometry(20, 24, 16, 8), HULL_TOP, [0, 0, 0]),
  painted(new THREE.TorusGeometry(24, 4, 4, 16), AMBER, [0, 0, 0], [Math.PI / 2, 0, 0]),
  painted(new THREE.SphereGeometry(12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), AMBER, [0, 8, 0]),
])

/** The hub's own material, so its glow can pulse once it is the target (the same program as `HELI_MAT`). */
export const HELI_HUB_MAT = cityMachineMaterial(AMBER)
HELI_HUB_MAT.emissive.set(AMBER)
HELI_HUB_MAT.emissiveIntensity = 0

/**
 * The searchlight's beam: an open cone with its apex at the origin along +z, radius `BEAM_SPREAD` at z = 1 (scaled to its
 * length). Added light, brightest at the lamp and fading to nothing at the street, so it tints what it crosses.
 */
export const BEAM_SPREAD = 0.2
export const HELI_BEAM_GEO = (() => {
  const g = new THREE.ConeGeometry(BEAM_SPREAD, 1, 20, 6, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2)
  return fade(g, (x, y, z) => 1 - z)
})()

/** The spot on the street: a unit disc lying flat, bright in the middle. */
export const HELI_SPOT_GEO = (() => {
  const g = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2)
  return fade(g, (x, y, z) => 1 - Math.hypot(x, z))
})()


/** Paints `g` the beam's colour times `k(x, y, z)` (clamped to 0–1, squared for a soft edge). */
function fade(g: THREE.BufferGeometry, k: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const a = Math.min(1, Math.max(0, k(pos.getX(i), pos.getY(i), pos.getZ(i)))) ** 2
    colors.set([BEAM_COLOR.r * a, BEAM_COLOR.g * a, BEAM_COLOR.b * a], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

/** Additive, so it brightens what is behind it and never darkens; its opacity fades it in and out. */
export const HELI_BEAM_MAT = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  fog: false,
})
