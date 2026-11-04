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

// ── The Giant Scorpion (Desert) ──

// The small scorpion's colours: plum-black chitin reads against gold sand, amber underside and joints against the dark.
const CHITIN = '#2a1626'
const CHITIN_EDGE = '#3a1622'
const AMBER = '#e0701e'
const AMBER_HOT = '#ffb347'

/** `geo` painted per triangle: `under` below `split` (its own y, before placing), `top` above. */
function twoTone(geo: THREE.BufferGeometry, top: string, under: string, split: number, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.toNonIndexed()
  geo.dispose()
  g.deleteAttribute('uv')
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const a = new THREE.Color(top)
  const b = new THREE.Color(under)
  for (let t = 0; t < pos.count; t += 3) {
    const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3
    const c = y < split ? b : a
    for (let k = 0; k < 3; k++) c.toArray(colors, (t + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g.applyMatrix4(matrix)
}

const shell = (rx: number, ry: number, rz: number, at: [number, number, number], split = -0.25) =>
  twoTone(new THREE.SphereGeometry(1, 18, 10), CHITIN, AMBER, split, pose(at, [0, 0, 0], [rx, ry, rz]))

const ABDOMEN = [0, 1, 2, 3, 4].map((k) => ({ rx: 150 - 11 * k, ry: 60 - 3 * k, z: -25 - 58 * k, y: 95 - 3 * k }))

/** +z is its head. */
export const SCORPION_BODY_GEO = mergePainted([
  shell(150, 70, 165, [0, 100, 125]),
  ...ABDOMEN.map((p) => shell(p.rx, p.ry, 55, [0, p.y, p.z])),
  shell(50, 48, 50, [0, 112, -280], -0.5),
  ...[-1, 1].map((side) => painted(new THREE.BoxGeometry(30, 34, 56), CHITIN_EDGE, [side * 36, 78, 285], [0.3, side * 0.2, 0])),
])

export const SCORPION_GLOW_GEO = mergePainted([
  ...ABDOMEN.map((p) =>
    paintedAt(new THREE.TorusGeometry(1, 0.07, 5, 24), AMBER_HOT, pose([0, p.y, p.z + 29], [0, 0, 0], [p.rx * 0.85, p.ry * 0.85, 60])),
  ),
  ...[-1, 1].map((side) => painted(new THREE.SphereGeometry(14, 8, 6), AMBER_HOT, [side * 40, 160, 235])),
])

// Less metal and gloss than the small scorpion: at this size its broad facets mirror the pale sky and read grey.
export const SCORPION_SHELL_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.6, flatShading: true, emissive: '#1a0610' }),
  { color: '#ffd9a0', intensity: 0.55, power: 2.5 },
)

export const SCORPION_GLOW_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, emissive: '#ff8a1a', emissiveIntensity: 1.5 }),
  { color: '#ffe0b0', intensity: 0.5, power: 2 },
)

/** Unit segment from y 0 to 1 (instance scale: radius, length, radius); dark, as amber legs read as stilts from above. */
export const SCORPION_LIMB_GEO = twoTone(
  new THREE.CylinderGeometry(0.75, 1, 1, 6, 4).translate(0, 0.5, 0),
  CHITIN_EDGE,
  AMBER_HOT,
  0.2,
  new THREE.Matrix4(),
)

export const SCORPION_LIMB_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.55, flatShading: true, emissive: '#2a0c04' }),
  { color: '#ffd9a0', intensity: 0.6, power: 2.2 },
)

/** Along +z around its palm, the fixed finger on +x. */
export const SCORPION_CLAW_GEO = mergePainted([
  twoTone(new THREE.SphereGeometry(1, 16, 10), CHITIN_EDGE, AMBER, -0.3, pose([0, 0, 0], [0, 0, 0], [72, 54, 95])),
  painted(new THREE.ConeGeometry(28, 150, 6).rotateX(Math.PI / 2), CHITIN, [32, 0, 140], [0, -0.12, 0]),
  painted(new THREE.SphereGeometry(13, 6, 5), AMBER_HOT, [44, 0, 72]),
])

/** Hinged at its origin; opens by turning about y. */
export const SCORPION_FINGER_GEO = mergePainted([
  painted(new THREE.ConeGeometry(25, 145, 6).rotateX(Math.PI / 2).translate(0, 0, 72), CHITIN),
  painted(new THREE.SphereGeometry(20, 6, 5), AMBER_HOT),
])

export const SCORPION_FINGER_HINGE: [number, number, number] = [-30, 0, 70]

/** Along +y around its middle. */
export const SCORPION_TAIL_SEGMENT_GEO = mergePainted([
  twoTone(new THREE.SphereGeometry(1, 12, 8), CHITIN, CHITIN_EDGE, -0.9, pose([0, 0, 0], [0, 0, 0], [46, 62, 46])),
  painted(new THREE.TorusGeometry(42, 9, 5, 14), AMBER_HOT, [0, -48, 0], [Math.PI / 2, 0, 0]),
])

export const SCORPION_TAIL_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.6, flatShading: true, emissive: '#1a0610' }),
  { color: '#ffd9a0', intensity: 0.8, power: 2.2 },
)

/** Along +y from its base, the barb hooking towards +z. */
export const SCORPION_STINGER_GEO = mergePainted([
  paintedAt(new THREE.SphereGeometry(1, 14, 10), '#8a1a1a', pose([0, 40, 0], [0, 0, 0], [46, 58, 46])),
  painted(new THREE.ConeGeometry(17, 95, 8), '#ff4422', [0, 120, 22], [0.45, 0, 0]),
])

export const SCORPION_STINGER_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1, emissive: '#ff2200', emissiveIntensity: 0.5 }),
  { color: '#ffc0a0', intensity: 0.6, power: 2.2 },
)

export const SCORPION_STINGER_EXPOSED_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: '#ff3300', emissiveIntensity: 2 }),
  { color: '#ffd0a0', intensity: 1, power: 2 },
)

/** The tell's dune: mesh scale (radius, height, radius). */
export const SCORPION_MOUND_GEO = (() => {
  const g = new THREE.SphereGeometry(1, 28, 9, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed()
  g.deleteAttribute('uv')
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const bump = 1 + 0.12 * Math.sin(x * 7.1 + z * 3.3) * Math.cos(z * 6.2 - x * 2.1)
    pos.setXYZ(i, x * bump, pos.getY(i) * bump, z * bump)
  }
  const colors = new Float32Array(pos.count * 3)
  // Darker than the terrain ramp: the dome faces the sun more than the ground and read pale.
  const sand = [new THREE.Color('#a8864c'), new THREE.Color('#9a7842'), new THREE.Color('#b08e54')]
  for (let t = 0; t < pos.count; t += 3) {
    const c = sand[Math.abs(Math.floor(pos.getX(t) * 13 + pos.getZ(t) * 7)) % sand.length]
    for (let k = 0; k < 3; k++) c.toArray(colors, (t + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
})()

export const SCORPION_MOUND_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true })
