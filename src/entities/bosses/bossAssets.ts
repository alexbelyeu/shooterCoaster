import * as THREE from 'three'
import { mergePainted, painted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import { withRim } from '@/entities/enemies/enemyRim'
import { BLIMP_LAYOUT } from './bossSpecs'
import { KRAKEN_HEAD } from './krakenMotion'

// Module-level singletons like SharedEnemyAssets; ShaderWarmup walks these exports too.

const { hullX, hullRx, hullR, gondolaY, balloonScale, balloons } = BLIMP_LAYOUT

// Orange-leaning: the park's blue sky light turns a lemon gold olive.
const GOLD = '#ffa81f'
const CRIMSON = '#c8102e'
const CREAM = '#fff1cf'
const BRONZE = '#6b4a1f'

function envelopeGeo(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 28, 16).toNonIndexed()
  g.deleteAttribute('uv')
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const gold = new THREE.Color(GOLD)
  const band = new THREE.Color(CRIMSON)
  const cap = new THREE.Color(CREAM)
  for (let t = 0; t < pos.count; t += 3) {
    let cx = 0
    let cy = 0
    for (let k = 0; k < 3; k++) {
      cx += pos.getX(t + k) / 3
      cy += pos.getY(t + k) / 3
    }
    const c = cx > 0.86 ? cap : Math.abs(cy) < 0.12 ? band : gold
    for (let k = 0; k < 3; k++) c.toArray(colors, (t + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.scale(hullRx, hullR, hullR)
  g.translate(hullX, 0, 0)
  return g
}

const tailX = hullX - hullRx

function finGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(-84, 0),
    new THREE.Vector2(-96, 62),
    new THREE.Vector2(-58, 62),
  ])
  return new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false }).translate(0, hullR * 0.55, -2.5)
}

export const BLIMP_HULL_GEO = mergePainted([
  envelopeGeo(),
  ...[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => painted(finGeo(), CRIMSON, [tailX + 100, 0, 0], [a, 0, 0])),
  ...[1, -1].flatMap((side) => [
    painted(new THREE.CylinderGeometry(10, 7, 46, 8), BRONZE, [hullX - 50, -hullR * 0.72, side * hullR * 0.95], [0, 0, Math.PI / 2]),
    painted(new THREE.BoxGeometry(6, 4, hullR * 0.5), BRONZE, [hullX - 50, -hullR * 0.72, side * hullR * 0.7]),
    painted(new THREE.CylinderGeometry(22, 22, 1.5, 12), CREAM, [hullX - 76, -hullR * 0.72, side * hullR * 0.95], [0, 0, Math.PI / 2]),
  ]),
  ...[-38, 38].map((dx) => painted(new THREE.BoxGeometry(4, 34, 4), BRONZE, [hullX + dx, gondolaY + 30, 0])),
  painted(new THREE.SphereGeometry(8, 8, 6), BRONZE, [tailX, 0, 0]),
])

// Low metalness: a metallic envelope mirrors the green park and reads olive, not gold.
export const BLIMP_HULL_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.15, roughness: 0.45, flatShading: true, emissive: '#2a1600' }),
  { color: '#fff4d0', intensity: 0.45, power: 3 },
)

export const BLIMP_GONDOLA_GEO = mergePainted([
  painted(new THREE.BoxGeometry(124, 38, 44), CREAM),
  painted(new THREE.BoxGeometry(112, 11, 45), '#2a3550', [0, 4, 0]),
  painted(new THREE.BoxGeometry(128, 7, 48), CRIMSON, [0, -20, 0]),
  painted(new THREE.ConeGeometry(22, 30, 4), CRIMSON, [70, -2, 0], [0, 0, -Math.PI / 2]),
])

export const BLIMP_GONDOLA_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.6, flatShading: true }),
)

export const BLIMP_GONDOLA_EXPOSED_MAT = withRim(
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.2,
    roughness: 0.5,
    flatShading: true,
    emissive: '#ff9a00',
    emissiveIntensity: 1.2,
  }),
  { color: '#ffd27a', intensity: 0.9, power: 2 },
)

/** Not GOLDEN_BODY_MAT: its blown-out glow reads as flat discs at this size. */
export const BLIMP_BALLOON_MAT = withRim(
  new THREE.MeshStandardMaterial({
    color: '#ffc61a',
    emissive: '#ff9d00',
    emissiveIntensity: 0.4,
    metalness: 0.35,
    roughness: 0.25,
  }),
  { color: '#fff0b0', intensity: 0.7, power: 2.5 },
)

/** BALLOON_GEO's knot (y -35), scaled. */
const BLIMP_KNOT_DROP = 35 * balloonScale * 1.05

function cable(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const d = new THREE.Vector3().subVectors(to, from)
  const g = new THREE.CylinderGeometry(1.6, 1.6, d.length(), 4)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))
  return paintedAt(g, '#4a3a20', m)
}

export const BLIMP_CABLE_GEO = (() => {
  const knots = [new THREE.Vector3(tailX, 0, 0), ...balloons.map(([x, y]) => new THREE.Vector3(x, y - BLIMP_KNOT_DROP, 0))]
  return mergePainted(knots.slice(1).map((k, i) => cable(knots[i], k)))
})()

export const BLIMP_CABLE_MAT = new THREE.MeshBasicMaterial({ vertexColors: true })

export const CONFETTI_COUNT = 220
export const CONFETTI_GEO = new THREE.PlaneGeometry(12, 7)
export const CONFETTI_MAT = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
export const CONFETTI_COLORS = ['#ff3355', '#ffd23f', '#33c3ff', '#7cff4f', '#ff7a1a', '#c86bff', '#ffffff']

// ── The Kraken (Ocean) ──

// Dark teal on top, a pale sucker side towards the rider: the pale side carries it against the water.
const KRAKEN_TEAL = '#1f5c63'
const KRAKEN_DARK = '#123c42'
const KRAKEN_UNDERSIDE = '#c4e2d4'
const KRAKEN_SUCKER = '#f4c8c0'
const PAD_CYAN = '#5ff8ff'

/** One tapered segment: base at y 0, height 1, radius 1 (instance scale: radius, length, radius); its −x side faces the rider. */
function tentacleSegmentGeo(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.86, 1, 1, 12, 1, true).translate(0, 0.5, 0).toNonIndexed()
  body.deleteAttribute('uv')
  const pos = body.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const top = new THREE.Color(KRAKEN_TEAL)
  const under = new THREE.Color(KRAKEN_UNDERSIDE)
  const mixed = new THREE.Color()
  for (let t = 0; t < pos.count; t += 3) {
    const x = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3
    const z = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3
    mixed.lerpColors(top, under, THREE.MathUtils.smoothstep(-x / Math.hypot(x, z), 0.35, 0.8))
    for (let k = 0; k < 3; k++) mixed.toArray(colors, (t + k) * 3)
  }
  body.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const sucker = (y: number, z: number) => painted(new THREE.SphereGeometry(0.2, 8, 4), KRAKEN_SUCKER, [-0.9, y, z])
  return mergePainted([body, sucker(0.3, 0.22), sucker(0.75, -0.22)])
}

export const KRAKEN_SEGMENT_GEO = tentacleSegmentGeo()

export const KRAKEN_SKIN_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.08, flatShading: true, emissive: '#06222a' }),
  { color: '#bff6ff', intensity: 0.6, power: 2.5 },
)

/** Sucker pad facing −x: a pale rim around a glowing cup. */
export const KRAKEN_PAD_GEO = mergePainted([
  painted(new THREE.TorusGeometry(19, 6, 8, 20), KRAKEN_UNDERSIDE, [0, 0, 0], [0, Math.PI / 2, 0]),
  painted(new THREE.CylinderGeometry(17, 15, 6, 20), PAD_CYAN, [-1, 0, 0], [0, 0, Math.PI / 2]),
  painted(new THREE.SphereGeometry(7, 10, 6), '#ffffff', [-4, 0, 0]),
])

export const KRAKEN_PAD_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, emissive: '#1fe6ff', emissiveIntensity: 1.3 }),
  { color: '#c8ffff', intensity: 0.9, power: 2 },
)

/** Wide low dome, +z towards the rider, mottled, with a heavy brow over the eye. */
function headGeo(): THREE.BufferGeometry {
  const { rx, ry, rz, eyeRadius, eyeUp, eyeOut } = KRAKEN_HEAD
  const dome = new THREE.SphereGeometry(1, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.62).toNonIndexed()
  dome.deleteAttribute('uv')
  const pos = dome.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const skin = new THREE.Color(KRAKEN_TEAL)
  const blotch = new THREE.Color(KRAKEN_DARK)
  for (let t = 0; t < pos.count; t += 3) {
    const x = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3
    const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3
    const z = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3
    const c = Math.sin(x * 9.1) * Math.sin(y * 7.3 + 1) * Math.sin(z * 8.7 + 2) > 0.3 ? blotch : skin
    for (let k = 0; k < 3; k++) c.toArray(colors, (t + k) * 3)
  }
  dome.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  dome.scale(rx, ry, rz)
  const brow = painted(new THREE.TorusGeometry(eyeRadius * 1.1, 10, 8, 22, Math.PI), KRAKEN_DARK, [0, eyeUp + 4, eyeOut - 8])
  return mergePainted([dome, brow])
}

export const KRAKEN_HEAD_GEO = headGeo()

/** One big eye looking along +z: a gold iris with a slit pupil. */
export const KRAKEN_EYE_GEO = mergePainted([
  painted(new THREE.SphereGeometry(KRAKEN_HEAD.eyeRadius, 20, 14), '#ffd23a'),
  painted(new THREE.BoxGeometry(7, KRAKEN_HEAD.eyeRadius * 1.5, 4), '#0a0a0a', [0, 0, KRAKEN_HEAD.eyeRadius * 0.97]),
])

export const KRAKEN_EYE_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0, emissive: '#ffb000', emissiveIntensity: 0.9 }),
  { color: '#fff2b0', intensity: 0.8, power: 2 },
)
