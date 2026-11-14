import * as THREE from 'three'
import { mergePainted, painted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import { withRim } from '@/entities/enemies/enemyRim'
import { gradientNoiseGlsl } from '@/levels/environments/shared/noiseGlsl'
import { createRng } from '@/utils/rng'
import { BLIMP_LAYOUT } from './bossSpecs'
import { KRAKEN_HEAD } from './krakenMotion'
import { MEDUSA_BUST } from './medusaMotion'

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

// ── The Yeti (Antarctica) ──
// Blue-grey fur, never white on the snow; navy face, palms, claws and feet so it reads from the ridge.

const FUR_LIGHT = ['#dbe4f0', '#cdd8e8', '#e6edf6']
const FUR_SHADE = ['#8ea2bf', '#7f94b3', '#9aaecb']
const NAVY = '#1d2a4a'
const NAVY_DEEP = '#121a30'
const ICE = '#8fe0ff'

/** `geo` painted per triangle in shaggy light fur above `split` (its own y) and shaded fur below, then placed. */
function fur(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, split = -0.2): THREE.BufferGeometry {
  const g = geo.toNonIndexed()
  geo.dispose()
  g.deleteAttribute('uv')
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const light = FUR_LIGHT.map((c) => new THREE.Color(c))
  const shade = FUR_SHADE.map((c) => new THREE.Color(c))
  for (let t = 0; t < pos.count; t += 3) {
    const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3
    const pick = Math.abs(Math.floor(pos.getX(t) * 37 + pos.getZ(t) * 23 + y * 11)) % 3
    const c = (y < split ? shade : light)[pick]
    for (let k = 0; k < 3; k++) c.toArray(colors, (t + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g.applyMatrix4(matrix)
}

const furBall = (at: [number, number, number], scale: [number, number, number], split?: number, detail = 1) =>
  fur(new THREE.IcosahedronGeometry(1, detail), pose(at, [0, 0, 0], scale), split)

/** Feet at y 0, +z towards the rider; the head, arms, fists and chest are separate. */
export const YETI_BODY_GEO = mergePainted([
  furBall([0, 540, 0], [235, 250, 165], -0.35, 2),
  furBall([0, 330, -10], [175, 120, 135], 0.2),
  ...[-1, 1].flatMap((side) => [
    furBall([side * 215, 680, 0], [100, 95, 100]),
    fur(new THREE.CylinderGeometry(78, 66, 290, 8, 3), pose([side * 110, 170, 0]), 0.3),
    painted(new THREE.BoxGeometry(130, 50, 190), NAVY, [side * 112, 25, 25]),
    ...[-1, 0, 1].map((k) => painted(new THREE.ConeGeometry(14, 40, 5).rotateX(Math.PI / 2), NAVY_DEEP, [side * 112 + k * 40, 22, 135])),
  ]),
  // A shelf of fur over the chest, so the chest plate sits in a hollow.
  furBall([0, 645, 110], [150, 50, 60], 0.5),
])

export const YETI_FUR_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.9, flatShading: true }),
  { color: '#bfe6ff', intensity: 0.7, power: 2.4 },
)

/** Head about its neck; +z its face. */
export const YETI_HEAD_GEO = mergePainted([
  furBall([0, 30, -10], [125, 120, 120], -0.5),
  furBall([0, 140, -30], [70, 45, 70], 0),
  paintedAt(new THREE.SphereGeometry(1, 12, 8), NAVY, pose([0, 10, 82], [0, 0, 0], [80, 72, 42])),
  painted(new THREE.BoxGeometry(110, 24, 30), NAVY_DEEP, [0, 48, 108], [0.25, 0, 0]),
  ...[-1, 1].map((side) => painted(new THREE.SphereGeometry(13, 8, 6), ICE, [side * 30, 30, 118])),
])

/** Its mouth, scaled open on y by the roar. */
export const YETI_MOUTH_GEO = mergePainted([
  paintedAt(new THREE.SphereGeometry(1, 10, 6), '#5a1424', pose([0, 0, 0], [0, 0, 0], [40, 22, 14])),
  ...[-1, 1].map((side) => painted(new THREE.ConeGeometry(6, 18, 4), '#f2f6ff', [side * 22, 14, 6], [Math.PI, 0, 0])),
])

export const YETI_MOUTH_OFFSET: [number, number, number] = [0, -32, 112]

/** Unit limb from y 0 to 1 (instance scale: radius, length, radius): shaggy fur, shaded underneath. */
export const YETI_LIMB_GEO = fur(new THREE.CylinderGeometry(0.85, 1, 1, 8, 3).translate(0, 0.5, 0), new THREE.Matrix4(), 0.35)

/** Fist about its centre: fur cuff, navy palm and knuckles, navy claws pointing at the rider (+z). */
export const YETI_FIST_GEO = mergePainted([
  furBall([0, 55, -10], [70, 50, 70], -0.3),
  paintedAt(new THREE.IcosahedronGeometry(1, 1), NAVY, pose([0, 0, 10], [0, 0, 0], [66, 62, 72])),
  ...[-1, 0, 1].map((k) => painted(new THREE.ConeGeometry(11, 46, 5).rotateX(Math.PI / 2), NAVY_DEEP, [k * 30, -20, 82], [0.4, 0, 0])),
])

/** An ice heart in a navy plate: dim while it hides, blazing while it roars. */
export const YETI_CHEST_GEO = mergePainted([
  paintedAt(new THREE.SphereGeometry(1, 14, 8), NAVY, pose([0, 0, -12], [0, 0, 0], [92, 100, 30])),
  paintedAt(new THREE.OctahedronGeometry(1, 0), ICE, pose([0, 0, 14], [0, 0, 0], [46, 60, 22])),
])

export const YETI_CHEST_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, emissive: '#1a5a88', emissiveIntensity: 0.4 }),
  { color: '#bfe6ff', intensity: 0.5, power: 2.2 },
)

export const YETI_CHEST_EXPOSED_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, emissive: '#5fd8ff', emissiveIntensity: 2 }),
  { color: '#e0f6ff', intensity: 1, power: 2 },
)

export const SNOWBALL_GEO = new THREE.IcosahedronGeometry(44, 1).deleteAttribute('uv')

// Faintly ice-lit so it reads against the pale sky and the snow.
export const SNOWBALL_MAT = withRim(
  new THREE.MeshStandardMaterial({ color: '#f4f8ff', roughness: 0.8, metalness: 0, flatShading: true, emissive: '#3a8ad0', emissiveIntensity: 0.35 }),
  { color: '#8fe0ff', intensity: 1.1, power: 1.8 },
)

// ── The Magma Titan (Inferno) ──
// Cracked obsidian lit only by its own lava: Voronoi cracks glowing through every surface (hotter as its hp drops),
// painted lava (eyes, vents, heart, crown, joints) glowing on top, and a warm rim for the edges (dark levels read by
// emissive edges, never by a brighter frame).

const OBSIDIAN = ['#16111a', '#1d151c', '#241a1e']
const OBSIDIAN_EDGE = '#2e2024'
const LAVA = '#ff6a10'
const LAVA_HOT = '#ffc040'

/** Obsidian painted per triangle in three near-blacks, then placed. */
function obsidian(geo: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.toNonIndexed()
  geo.dispose()
  g.deleteAttribute('uv')
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const shades = OBSIDIAN.map((c) => new THREE.Color(c))
  for (let t = 0; t < pos.count; t += 3) {
    const pick = Math.abs(Math.floor(pos.getX(t) * 31 + pos.getY(t) * 17 + pos.getZ(t) * 13)) % 3
    for (let k = 0; k < 3; k++) shades[pick].toArray(colors, (t + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g.applyMatrix4(matrix)
}

const rock = (at: [number, number, number], scale: [number, number, number], rotation: [number, number, number] = [0, 0, 0], detail = 1) =>
  obsidian(new THREE.IcosahedronGeometry(1, detail), pose(at, rotation, scale))

const spire = (at: [number, number, number], height: number, radius: number, rotation: [number, number, number] = [0, 0, 0]) =>
  obsidian(new THREE.ConeGeometry(radius, height, 5).translate(0, height / 2, 0), pose(at, rotation))

const TITAN_CRACK_PARS = /* glsl */ `
uniform float uGlow;
uniform float uHeat;
varying vec3 vCrackPos;
varying vec3 vCrackNormal;
${gradientNoiseGlsl}
`

/** Crack edges (F2 − F1 of a Voronoi) on three planes blended by the object normal, plus the painted lava. */
const TITAN_CRACK_APPLY = /* glsl */ `
#include <emissivemap_fragment>
{
  vec3 w = abs(normalize(vCrackNormal)) + 1e-3;
  w /= (w.x + w.y + w.z);
  vec3 p = vCrackPos * 0.011;
  vec2 vx = voronoi(p.zy);
  vec2 vy = voronoi(p.xz + 7.3);
  vec2 vz = voronoi(p.xy + 3.1);
  float edge = (vx.y - vx.x) * w.x + (vy.y - vy.x) * w.y + (vz.y - vz.x) * w.z;
  float crack = 1.0 - smoothstep(0.03, 0.11, edge);
  vec3 heat = mix(vec3(1.0, 0.22, 0.02) * 0.9, vec3(1.0, 0.86, 0.6) * 4.0, uGlow);
  float painted = smoothstep(0.35, 0.6, vColor.r - vColor.b);
  totalEmissiveRadiance += (heat * crack + vColor.rgb * painted * mix(1.8, 4.0, uGlow)) * uHeat;
}
`

/** One material for its body and every part, so a hit's glow and the defeat's blackout move them all at once. */
export const TITAN_OBSIDIAN_MAT = (() => {
  const material = withRim(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15, flatShading: true }),
    { color: '#ff9a50', intensity: 1.1, power: 2.2 },
  )
  const uniforms = { uGlow: { value: 0 }, uHeat: { value: 1 } }
  material.userData.titan = uniforms
  const rimCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    rimCompile(shader, renderer)
    shader.uniforms.uGlow = uniforms.uGlow
    shader.uniforms.uHeat = uniforms.uHeat
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCrackPos;\nvarying vec3 vCrackNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrackPos = position;\nvCrackNormal = objectNormal;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${TITAN_CRACK_PARS}`)
      .replace('#include <emissivemap_fragment>', TITAN_CRACK_APPLY)
  }
  material.customProgramCacheKey = () => 'sc-enemy-rim-v2-titan-crack'
  return material
})()

/** The one Titan's crack heat (`crackGlow`) and glow multiplier (`defeatHeat`). */
export const TITAN_CRACK_UNIFORMS = TITAN_OBSIDIAN_MAT.userData.titan as { uGlow: { value: number }; uHeat: { value: number } }

/** Hips up (the legs, arms and head are separate); +z towards the rider. */
export const TITAN_BODY_GEO = mergePainted([
  rock([0, 480, -10], [240, 120, 160]),
  rock([0, 680, -20], [230, 180, 160], [0.1, 0, 0]),
  rock([0, 920, -10], [400, 200, 185]),
  obsidian(new THREE.CylinderGeometry(95, 130, 200, 6), pose([0, 1110, 60], [0.3, 0, 0])),
  ...[-1, 1].flatMap((side) => [
    // Chest plates round the heart's hollow, boulders under the vents, spires over the shoulders.
    rock([side * 150, 860, 160], [140, 150, 70], [0, side * 0.35, side * 0.15], 0),
    rock([side * 370, 1030, 0], [165, 140, 150]),
    spire([side * 380, 1060, -90], 330, 70, [-0.35, 0, -side * 0.45]),
    spire([side * 230, 1000, -170], 280, 60, [-0.6, 0, -side * 0.2]),
    paintedAt(new THREE.IcosahedronGeometry(1, 0), LAVA, pose([side * 170, 420, 20], [0, 0, 0], [70, 45, 70])),
  ]),
  // A spine of spires down its back: the cathedral.
  ...[0, 1, 2].map((k) => spire([0, 1050 - k * 170, -200 + k * 10], 380 - k * 80, 80 - k * 12, [-0.5, 0, 0])),
])

/** About its neck; +z its face: a heavy brow over two crater-glow eyes. */
export const TITAN_HEAD_GEO = mergePainted([
  rock([0, 40, 0], [140, 140, 125], [0, 0.4, 0], 0),
  rock([0, 95, 80], [150, 40, 60], [0.2, 0, 0], 0),
  rock([0, -45, 60], [105, 55, 80], [-0.2, 0, 0], 0),
  ...[-1, 1].map((side) => paintedAt(new THREE.IcosahedronGeometry(1, 1), LAVA_HOT, pose([side * 55, 40, 115], [0, 0, 0], [32, 24, 16]))),
  paintedAt(new THREE.BoxGeometry(120, 14, 20), LAVA, pose([0, -55, 135])),
])

/** Hangs from its shoulder (y 0) down to the fist (y −armLength); lava in the elbow and knuckles. */
export const TITAN_ARM_GEO = mergePainted([
  obsidian(new THREE.CylinderGeometry(115, 95, 380, 7).translate(0, -190, 0), new THREE.Matrix4()),
  paintedAt(new THREE.IcosahedronGeometry(1, 0), LAVA, pose([0, -400, 0], [0, 0, 0], [80, 60, 80])),
  obsidian(new THREE.CylinderGeometry(100, 125, 330, 7).translate(0, -585, 0), new THREE.Matrix4()),
  rock([0, -760, 15], [155, 140, 150], [0.3, 0.2, 0], 0),
  ...[-1, 0, 1].map((k) => paintedAt(new THREE.IcosahedronGeometry(1, 0), LAVA, pose([k * 60, -800, 130], [0, 0, 0], [30, 26, 22]))),
])

/** Hip (y 0) to foot; the stride swings it about its hip. */
export const TITAN_LEG_GEO = mergePainted([
  obsidian(new THREE.CylinderGeometry(140, 115, 300, 7).translate(0, -150, 0), new THREE.Matrix4()),
  paintedAt(new THREE.IcosahedronGeometry(1, 0), LAVA, pose([0, -310, 30], [0, 0, 0], [80, 55, 80])),
  obsidian(new THREE.CylinderGeometry(120, 150, 300, 7).translate(0, -470, 0), new THREE.Matrix4()),
  rock([0, -600, 50], [170, 70, 210], [0, 0, 0], 0),
])

/** A crater on its shoulder, brimming with lava. */
export const TITAN_VENT_GEO = mergePainted([
  obsidian(new THREE.CylinderGeometry(95, 140, 110, 7, 1, true), new THREE.Matrix4()),
  paintedAt(new THREE.SphereGeometry(1, 10, 6), LAVA_HOT, pose([0, 25, 0], [0, 0, 0], [92, 50, 92])),
  ...[0, 1, 2, 3, 4].map((k) => spire([Math.cos(k * 1.26) * 105, 30, Math.sin(k * 1.26) * 105], 70 + (k % 2) * 40, 26)),
])

/** The heart behind its chest plates, shut on a dull seam between beats. */
export const TITAN_HEART_SHUT_GEO = mergePainted([
  ...[-1, 1].map((side) => rock([side * 62, 0, -10], [80, 120, 50], [0, side * 0.2, 0], 0)),
  paintedAt(new THREE.BoxGeometry(18, 170, 20), LAVA, pose([0, 0, 20])),
])

/** The plates parted on a blazing core. */
export const TITAN_HEART_OPEN_GEO = mergePainted([
  ...[-1, 1].map((side) => rock([side * 135, 0, -30], [70, 125, 50], [0, side * 0.6, 0], 0)),
  paintedAt(new THREE.IcosahedronGeometry(1, 2), LAVA_HOT, pose([0, 0, 0], [0, 0, 0], [105, 115, 85])),
])

/** A ring of lava spikes on its head. */
export const TITAN_CROWN_GEO = mergePainted([
  painted(new THREE.TorusGeometry(110, 32, 6, 12), OBSIDIAN_EDGE, [0, 0, 0], [Math.PI / 2, 0, 0]),
  ...Array.from({ length: 7 }, (_, k) => {
    const a = (k / 7) * Math.PI * 2
    const tall = k % 2 === 0
    return paintedAt(
      new THREE.ConeGeometry(30, tall ? 210 : 150, 5).translate(0, tall ? 105 : 75, 0),
      tall ? LAVA_HOT : LAVA,
      pose([Math.sin(a) * 110, 10, Math.cos(a) * 110], [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25]),
    )
  }),
])

// ── The Medusa of the Starr (Climbing Gym) ──
// Modelled, with her blessing, on a real person: warm brown skin (darker underneath, lighter where the hall's light
// falls), a big nose with a jewel on its bridge, kind eyes with a sideways, mischievous glance, curly dark hair.
// Toy-like and flattering: smooth skin, faceted curls, beaded toy snakes with big round eyes.

const SKIN_LOW = new THREE.Color('#4f2b19')
const SKIN_HIGH = new THREE.Color('#9b5f3c')
const LIP = '#8a3445'
const BLUSH = '#9c4f3d'
const BROW = '#1c120e'
const IRIS = '#3d2414'
const GOLD_TRIM = '#ffc845'
const GOWN = '#6a2c91'
const CURLS = ['#140e0b', '#1f1511', '#2b1d16', '#3a281d']

/** `geo` placed by `matrix`, then painted per vertex from deep brown below to a warm highlight on top and on the light side. */
function skin(geo: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  g.applyMatrix4(matrix)
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const height = Math.min(1, Math.max(0, (pos.getY(i) + 220) / 330))
    const lit = Math.max(0, nor.getY(i)) * 0.25 + Math.max(0, nor.getZ(i)) * 0.15
    c.copy(SKIN_LOW).lerp(SKIN_HIGH, Math.min(1, height * 0.75 + lit))
    c.toArray(colors, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

type V3 = readonly [number, number, number]
const skinBall = ([x, y, z]: V3, [sx, sy, sz]: V3, detail = 3) =>
  skin(new THREE.IcosahedronGeometry(1, detail), pose([x, y, z], [0, 0, 0], [sx, sy, sz]))

/** A limb from `a` to `b`, radius `ra` at `a` tapering to `rb`. */
function limb(a: [number, number, number], b: [number, number, number], ra: number, rb: number): THREE.BufferGeometry {
  const from = new THREE.Vector3(...a)
  const to = new THREE.Vector3(...b)
  const dir = to.clone().sub(from)
  const m = new THREE.Matrix4().compose(
    from.clone().add(to).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
    new THREE.Vector3(1, 1, 1),
  )
  return skin(new THREE.CylinderGeometry(rb, ra, dir.length(), 12, 2), m)
}

function gown(): THREE.BufferGeometry {
  const [x, y, z] = MEDUSA_BUST.gown.at
  const [sx, sy, sz] = MEDUSA_BUST.gown.radii
  return paintedAt(new THREE.IcosahedronGeometry(1, 3), GOWN, pose([x, y, z], [0, 0, 0], [sx, sy, sz]))
}

/** Root at the star's hub, +z towards the rider: bust, arms on the star's points, neck, head and face. */
export const MEDUSA_BODY_GEO = mergePainted([
  // Shoulders and a jewel-purple gown with a gold neckline.
  skinBall(MEDUSA_BUST.shoulders.at, MEDUSA_BUST.shoulders.radii),
  gown(),
  paintedAt(new THREE.TorusGeometry(1, 0.06, 6, 32), GOLD_TRIM, pose([0, -112, 18], [Math.PI / 2 - 0.25, 0, 0], [118, 52, 60])),
  // A little gold star on a chain: the Starr's queen.
  paintedAt(new THREE.TorusGeometry(36, 2.4, 5, 24, Math.PI), GOLD_TRIM, pose([0, -60, 34], [0.35, 0, Math.PI])),
  paintedAt(new THREE.OctahedronGeometry(1, 0), GOLD_TRIM, pose([0, -100, 52], [0, 0, Math.PI / 4], [11, 11, 5])),
  // Arms resting forwards on the star's points, big soft hands.
  ...[-1, 1].flatMap((side) => [
    limb([side * 118, -92, -5], [side * 172, -168, 40], 30, 24),
    limb([side * 172, -168, 40], [side * 128, -198, 118], 24, 20),
    skinBall([side * 172, -168, 40], [25, 25, 25], 2),
    skinBall([side * 124, -200, 128], [26, 17, 30], 2),
  ]),
  // Neck and head.
  limb([0, -80, -8], [0, -10, -4], 33, 29),
  skinBall(MEDUSA_BUST.head.at, MEDUSA_BUST.head.radii),
  ...[-1, 1].flatMap((side) => [
    skinBall([side * 64, 36, -2], [9, 16, 11], 2),
    paintedAt(new THREE.TorusGeometry(11, 2.2, 6, 16), GOLD_TRIM, pose([side * 67, 12, 2], [0, Math.PI / 2, 0])),
  ]),
  // The big nose: a strong bridge, a round tip and full wings.
  skinBall([0, 32, 64], [11, 22, 12], 2),
  skinBall([0, 15, 76], [19, 15, 16], 2),
  ...[-1, 1].map((side) => skinBall([side * 14, 11, 68], [10, 9, 9], 2)),
  // Kind eyes glancing sideways, lids a little lowered, one brow up.
  ...[-1, 1].flatMap((side) => [
    paintedAt(new THREE.SphereGeometry(1, 14, 10), '#fbf6ee', pose([side * 27, 48, 56], [0, 0, 0], [14, 11, 10])),
    paintedAt(new THREE.SphereGeometry(1, 12, 8), IRIS, pose([side * 27 + 4, 47, 64], [0, 0, 0], [7.5, 7.5, 4])),
    paintedAt(new THREE.SphereGeometry(1, 8, 6), '#ffffff', pose([side * 27 + 6.5, 50, 67.5], [0, 0, 0], [2.4, 2.4, 1.2])),
    skin(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), pose([side * 27, 49, 57], [-0.35, 0, 0], [15.5, 9, 11])),
    painted(new THREE.BoxGeometry(26, 4.5, 6), BROW, [side * 27, side > 0 ? 69 : 64, 60], [0, 0, side > 0 ? -0.22 : 0.12]),
    paintedAt(new THREE.SphereGeometry(1, 10, 8), BLUSH, pose([side * 40, 14, 50], [0, side * 0.5, 0], [10, 6.5, 3])),
  ]),
  // A warm, knowing closed smile: a full crescent, a touch higher on her glancing side.
  paintedAt(new THREE.CircleGeometry(1, 20, Math.PI, Math.PI), LIP, pose([2, -5, 55.5], [-0.25, 0, 0.08], [21, 9, 1])),
  paintedAt(new THREE.TorusGeometry(1, 0.14, 6, 20, Math.PI), '#5e1f2d', pose([2, -5, 56], [-0.25, 0, Math.PI + 0.08], [21, 9, 9])),
])

export const MEDUSA_SKIN_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 }),
  { color: '#ffe2c4', intensity: 0.45, power: 2.6 },
)

/** Her curls: faceted clusters round the back, top and sides of her head, falling to her shoulders; laid from a fixed seed. */
export const MEDUSA_HAIR_GEO = (() => {
  const rand = createRng(521)
  const parts: THREE.BufferGeometry[] = [paintedAt(new THREE.IcosahedronGeometry(1, 2), CURLS[0], pose([0, 58, -14], [0, 0, 0], [76, 80, 70]))]
  const curl = (x: number, y: number, z: number, r: number) =>
    parts.push(paintedAt(new THREE.IcosahedronGeometry(1, 0), rand.pick(CURLS),
      pose([x, y, z], [rand() * 6, rand() * 6, rand() * 6], [r, r * rand.range(0.8, 1.2), r])))
  const n = 230
  for (let i = 0; i < n; i++) {
    // Fibonacci sphere directions, skipping the face and under the jaw.
    const y = 1 - (2 * (i + 0.5)) / n
    const ring = Math.sqrt(1 - y * y)
    const a = i * 2.39996
    const x = Math.cos(a) * ring
    const z = Math.sin(a) * ring
    if (y < -0.35 || (z > 0.2 && y < 0.5)) continue
    curl(x * 90, 54 + y * 94, -12 + z * 82, rand.range(14, 23))
  }
  // Falling to her shoulders behind the ears.
  for (const side of [-1, 1]) {
    for (let k = 0; k < 16; k++) curl(side * rand.range(76, 102), 34 - k * 8, rand.range(-34, 0) - k, rand.range(16, 24))
  }
  return mergePainted(parts)
})()

export const MEDUSA_HAIR_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1, flatShading: true }),
  { color: '#ffd9b0', intensity: 0.5, power: 2.2 },
)

/** The jewel on the bridge of her nose; its glint is animated (Medusa.tsx). */
export const MEDUSA_JEWEL_GEO = new THREE.OctahedronGeometry(5.5, 0)
export const MEDUSA_JEWEL_OFFSET: [number, number, number] = [0, 43, 77]
export const MEDUSA_JEWEL_MAT = new THREE.MeshStandardMaterial({
  color: '#7ff6ff', emissive: '#3fe8ff', emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.3, flatShading: true,
})

/** One bead of a toy snake: a unit sphere stretched along y between two points of its body (instance colour per snake). */
export const MEDUSA_SNAKE_BEAD_GEO = new THREE.SphereGeometry(1, 10, 8).deleteAttribute('uv')
export const MEDUSA_SNAKE_MAT = withRim(
  new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 }),
  { color: '#e8ffd0', intensity: 0.6, power: 2.2 },
)
export const MEDUSA_SNAKE_COLORS = ['#2fb36a', '#25a593', '#7cc63a', '#3ec28a'] as const
export const MEDUSA_CROWN_SNAKE_COLOR = '#d8b03a'

const snakeHead = (skinColor: string) => [
  paintedAt(new THREE.SphereGeometry(1, 12, 8), skinColor, pose([0, 0, 8], [0, 0, 0], [15, 11, 21])),
  paintedAt(new THREE.SphereGeometry(1, 10, 6), '#f4f0b0', pose([0, -4, 12], [0, 0, 0], [12, 6, 16])),
  ...[-1, 1].flatMap((side) => [
    paintedAt(new THREE.SphereGeometry(1, 10, 8), '#ffffff', pose([side * 8, 7, 17], [0, 0, 0], [5.5, 5.5, 5])),
    paintedAt(new THREE.SphereGeometry(1, 8, 6), '#141414', pose([side * 8.6, 7.4, 21.3], [0, 0, 0], [2.8, 2.8, 1.6])),
    painted(new THREE.BoxGeometry(1.6, 1, 9), '#ff5c8a', [side * 2, -3, 32], [0, side * 0.35, 0]),
  ]),
]

/** A snake's head about its neck, +z where it looks: big round eyes, a pale jaw, a little forked tongue. */
export const MEDUSA_SNAKE_HEAD_GEO = mergePainted(snakeHead(MEDUSA_SNAKE_COLORS[0]))

/** The crown snake's head: gold, with a tiny gold crown. */
export const MEDUSA_CROWN_HEAD_GEO = mergePainted([
  ...snakeHead(MEDUSA_CROWN_SNAKE_COLOR),
  painted(new THREE.CylinderGeometry(9, 8, 5, 10, 1, true), GOLD_TRIM, [0, 12, 6]),
  ...Array.from({ length: 5 }, (_, k) => {
    const a = (k / 5) * Math.PI * 2
    return painted(new THREE.ConeGeometry(2.6, 8, 4), k === 0 ? '#ff4f9a' : GOLD_TRIM, [Math.sin(a) * 8.5, 18, 6 + Math.cos(a) * 8.5])
  }),
])

export const MEDUSA_SNAKE_HEAD_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05 }),
  { color: '#e8ffd0', intensity: 0.7, power: 2.2 },
)

/** A star outline over the Starr's points (unit outer radius, in its xy plane), which glows and turns in her tell. */
export const MEDUSA_STAR_GLOW_GEO = (() => {
  const star = (outer: number, inner: number) => {
    const points: THREE.Vector2[] = []
    for (let k = 0; k < 16; k++) {
      const a = Math.PI / 2 + (k * Math.PI) / 8
      const r = k % 2 === 0 ? outer : inner
      points.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
    }
    return points
  }
  const shape = new THREE.Shape(star(1.06, 0.3))
  shape.holes.push(new THREE.Path(star(0.86, 0.22).reverse()))
  return new THREE.ShapeGeometry(shape).deleteAttribute('uv')
})()

export const MEDUSA_STAR_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: '#ffd23f', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
})

/** The hub opening in her tell: a violet glow she rises out of. */
export const MEDUSA_HUB_GEO = new THREE.CircleGeometry(1, 32).deleteAttribute('uv')
export const MEDUSA_HUB_MAT = new THREE.MeshBasicMaterial({
  color: '#c46bff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
})
