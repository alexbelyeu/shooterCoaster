import * as THREE from 'three'
import { mergePainted, painted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import { withRim } from '@/entities/enemies/enemyRim'
import { BLIMP_LAYOUT } from './bossSpecs'

// Boss geometries + materials: module-level singletons like SharedEnemyAssets
// (never disposed); ShaderWarmup walks this module's exports too.

const { hullX, hullRx, hullR, gondolaY, balloonScale, balloons } = BLIMP_LAYOUT

// Orange-leaning: the park's blue sky light turns a lemon gold olive.
const GOLD = '#ffa81f'
const CRIMSON = '#c8102e'
const CREAM = '#fff1cf'
const BRONZE = '#6b4a1f'

/** Envelope: a flat-shaded ellipsoid, gold with a crimson band round the equator and a cream nose cap. */
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

/** A swept-back tail fin standing on +y, its root sunk into the envelope. */
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
  // Cruciform tail fins.
  ...[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => painted(finGeo(), CRIMSON, [tailX + 100, 0, 0], [a, 0, 0])),
  // Engine pods on struts either side of the gondola.
  ...[1, -1].flatMap((side) => [
    painted(new THREE.CylinderGeometry(10, 7, 46, 8), BRONZE, [hullX - 50, -hullR * 0.72, side * hullR * 0.95], [0, 0, Math.PI / 2]),
    painted(new THREE.BoxGeometry(6, 4, hullR * 0.5), BRONZE, [hullX - 50, -hullR * 0.72, side * hullR * 0.7]),
    painted(new THREE.CylinderGeometry(22, 22, 1.5, 12), CREAM, [hullX - 76, -hullR * 0.72, side * hullR * 0.95], [0, 0, Math.PI / 2]),
  ]),
  // Struts down to the gondola.
  ...[-38, 38].map((dx) => painted(new THREE.BoxGeometry(4, 34, 4), BRONZE, [hullX + dx, gondolaY + 30, 0])),
  // Tow hitch at the tail.
  painted(new THREE.SphereGeometry(8, 8, 6), BRONZE, [tailX, 0, 0]),
])

// Low metalness: a metallic envelope mirrors the green park and reads olive, not gold.
export const BLIMP_HULL_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.15, roughness: 0.45, flatShading: true, emissive: '#2a1600' }),
  { color: '#fff4d0', intensity: 0.45, power: 3 },
)

/** Gondola (the phase-2 weak point), centred on its own origin. */
export const BLIMP_GONDOLA_GEO = mergePainted([
  painted(new THREE.BoxGeometry(124, 38, 44), CREAM),
  painted(new THREE.BoxGeometry(112, 11, 45), '#2a3550', [0, 4, 0]),
  painted(new THREE.BoxGeometry(128, 7, 48), CRIMSON, [0, -20, 0]),
  painted(new THREE.ConeGeometry(22, 30, 4), CRIMSON, [70, -2, 0], [0, 0, -Math.PI / 2]),
])

export const BLIMP_GONDOLA_MAT = withRim(
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.6, flatShading: true }),
)

/** Exposed once the balloons are gone: hot glow, pulsed by GoldenBlimp. */
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

/** The towed golden balloons (BALLOON_GEO): shaded gold, not the bonus balloons' blown-out glow, which reads as flat discs this big. */
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

/** Golden balloons hang this far below their centre (BALLOON_GEO's knot at -35, scaled). */
export const BLIMP_KNOT_DROP = 35 * balloonScale * 1.05

function cable(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const d = new THREE.Vector3().subVectors(to, from)
  const g = new THREE.CylinderGeometry(1.6, 1.6, d.length(), 4)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))
  return paintedAt(g, '#4a3a20', m)
}

/** Tow line from the tail through every golden balloon's knot. */
export const BLIMP_CABLE_GEO = (() => {
  const knots = [new THREE.Vector3(tailX, 0, 0), ...balloons.map(([x, y]) => new THREE.Vector3(x, y - BLIMP_KNOT_DROP, 0))]
  return mergePainted(knots.slice(1).map((k, i) => cable(knots[i], k)))
})()

export const BLIMP_CABLE_MAT = new THREE.MeshBasicMaterial({ vertexColors: true })

// ── Confetti: one instanced quad burst on defeat ────────────────────
export const CONFETTI_COUNT = 220
export const CONFETTI_GEO = new THREE.PlaneGeometry(12, 7)
export const CONFETTI_MAT = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
export const CONFETTI_COLORS = ['#ff3355', '#ffd23f', '#33c3ff', '#7cff4f', '#ff7a1a', '#c86bff', '#ffffff']
