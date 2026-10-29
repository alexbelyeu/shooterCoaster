import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Volcano shape in its local frame (base centre at the origin). */
export const VOLCANO = {
  baseRadius: 1200,
  topRadius: 230,
  height: 1600,
  rimRadius: 210,
  rimTube: 60,
} as const

/** Cone radius at height y (0 = base, VOLCANO.height = crater). */
export function coneRadius(y: number): number {
  const t = Math.min(1, Math.max(0, y / VOLCANO.height))
  return VOLCANO.baseRadius + (VOLCANO.topRadius - VOLCANO.baseRadius) * t
}

const BASE_ROCK = new THREE.Color(0x2a1510)
const HOT_ROCK = new THREE.Color(0x8a2410)
const RIM_ROCK = new THREE.Color(0x3a2018)
const RIM_MOLTEN = new THREE.Color(0xffa040)
/** Upper slopes: dim, just enough to lift the silhouette off the ash sky. */
const CONE_GLOW = 0.5
/** Crater lip: HDR, so Bloom picks it up. */
const RIM_GLOW = 6

const _c = new THREE.Color()

function addColourAndGlow(
  geo: THREE.BufferGeometry,
  paint: (i: number, out: THREE.Color) => number,
): void {
  const n = geo.attributes.position.count
  const colors = new Float32Array(n * 3)
  const glow = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    glow[i] = paint(i, _c)
    _c.toArray(colors, i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('glow', new THREE.BufferAttribute(glow, 1))
  geo.deleteAttribute('uv')
}

/** Cone + crater rim in one geometry with `color` and `glow` attributes for `createTerrainMaterial`. Caller disposes. */
export function buildVolcanoRock(): THREE.BufferGeometry {
  const { baseRadius, topRadius, height, rimRadius, rimTube } = VOLCANO

  const cone = new THREE.CylinderGeometry(topRadius, baseRadius, height, 24, 10, true)
  cone.translate(0, height / 2, 0)
  const conePos = cone.attributes.position
  addColourAndGlow(cone, (i, out) => {
    const t = conePos.getY(i) / height
    const heat = t * t * t
    out.copy(BASE_ROCK).lerp(HOT_ROCK, heat)
    return CONE_GLOW * heat
  })

  const rim = new THREE.TorusGeometry(rimRadius, rimTube, 10, 24)
  rim.rotateX(-Math.PI / 2)
  rim.translate(0, height, 0)
  const rimPos = rim.attributes.position
  const rimNrm = rim.attributes.normal
  addColourAndGlow(rim, (i, out) => {
    // Inner and upper surface molten, so the top edge glows even seen from below
    const x = rimPos.getX(i), z = rimPos.getZ(i)
    const r = Math.hypot(x, z)
    const inward = -(rimNrm.getX(i) * x + rimNrm.getZ(i) * z) / r
    const molten = THREE.MathUtils.smoothstep(0.5 * inward + rimNrm.getY(i), -0.1, 0.6)
    out.copy(RIM_ROCK).lerp(RIM_MOLTEN, molten)
    return RIM_GLOW * molten
  })

  const merged = mergeGeometries([cone, rim])
  cone.dispose()
  rim.dispose()
  if (!merged) throw new Error('volcano rock: merge failed')
  return merged
}

interface LavaStreak {
  /** Angle around the cone (radians, from +X towards +Z). */
  angle: number
  /** Lowest height the streak reaches. */
  bottomY: number
  /** Width at the crater; it tapers to half at the bottom. */
  width: number
}

/** On the side facing the ride: seen from the volcano at (2400, -1500), the track centre lies at angle ≈ 2.6. */
export const LAVA_STREAKS: readonly LavaStreak[] = [
  { angle: 1.6, bottomY: 640, width: 60 },
  { angle: 2.15, bottomY: 360, width: 80 },
  { angle: 2.7, bottomY: 500, width: 70 },
  { angle: 3.25, bottomY: 320, width: 85 },
  { angle: 3.8, bottomY: 580, width: 65 },
]

/** The flat facets sit inside the true cone, so any lift clears them. */
const STREAK_LIFT = 12
const STREAK_ROWS = 40

/** All streaks in one geometry for the lava shader; `uv.y` counts up from the bottom so the flow runs downhill. Caller disposes. */
export function buildLavaStreaks(): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const top = VOLCANO.height - VOLCANO.rimTube * 0.5

  for (const s of LAVA_STREAKS) {
    const base = positions.length / 3
    let v = 0
    let prevX = 0, prevY = 0, prevZ = 0
    for (let i = 0; i <= STREAK_ROWS; i++) {
      const t = i / STREAK_ROWS // 0 = bottom, 1 = crater
      const y = s.bottomY + (top - s.bottomY) * t
      const r = coneRadius(y) + STREAK_LIFT
      const a = s.angle + Math.sin(t * 5 + s.angle * 3) * 0.035
      const halfAngle = (s.width * (0.5 + 0.5 * t)) / 2 / r
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r
      if (i > 0) v += Math.hypot(cx - prevX, y - prevY, cz - prevZ) / s.width
      prevX = cx; prevY = y; prevZ = cz
      positions.push(Math.cos(a - halfAngle) * r, y, Math.sin(a - halfAngle) * r)
      positions.push(Math.cos(a + halfAngle) * r, y, Math.sin(a + halfAngle) * r)
      uvs.push(0, v, 1, v)
      if (i < STREAK_ROWS) {
        const b = base + i * 2
        indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  return geo
}
