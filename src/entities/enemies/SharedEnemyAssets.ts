import * as THREE from 'three'

// ── Balloon geometries (shared by Balloon + GoldenBalloon) ──────────
export const BALLOON_BODY_GEO = new THREE.SphereGeometry(30, 16, 16)
export const BALLOON_KNOT_GEO = new THREE.SphereGeometry(4, 8, 8)
export const BALLOON_STRING_GEO = new THREE.CylinderGeometry(0.5, 0.5, 55, 4)

// ── Balloon materials (10 color variants) ───────────────────────────
const BALLOON_COLORS = [
  '#ff3333', '#ff6633', '#ffcc00', '#33cc33', '#3399ff',
  '#9933ff', '#ff33cc', '#ff6699', '#00cccc', '#66ff33',
]

export const BALLOON_BODY_MATS = BALLOON_COLORS.map(
  (c) => new THREE.MeshPhongMaterial({ color: c, specular: '#ffffff', shininess: 60 }),
)

export const BALLOON_KNOT_MATS = BALLOON_COLORS.map(
  (c) => new THREE.MeshPhongMaterial({ color: c }),
)

export const BALLOON_STRING_MAT = new THREE.MeshBasicMaterial({ color: '#888888' })

export const BALLOON_COLOR_COUNT = BALLOON_COLORS.length

// ── Golden balloon materials ────────────────────────────────────────
export const GOLDEN_BODY_MAT = new THREE.MeshStandardMaterial({
  color: '#ffd700',
  emissive: '#ffd700',
  emissiveIntensity: 1.5,
  metalness: 0.6,
  roughness: 0.2,
  toneMapped: false,
})

export const GOLDEN_KNOT_MAT = new THREE.MeshStandardMaterial({
  color: '#cc9900',
  metalness: 0.5,
  roughness: 0.3,
})

export const GOLDEN_STRING_MAT = new THREE.MeshBasicMaterial({ color: '#cc9900' })

// ── Crow ────────────────────────────────────────────────────────────
export const CROW_BODY_GEO = new THREE.ConeGeometry(3, 8, 4)
export const CROW_MAT = new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true })

// ── Shark ───────────────────────────────────────────────────────────
export const SHARK_BODY_GEO = new THREE.ConeGeometry(2, 6, 6)
export const SHARK_MAT = new THREE.MeshPhongMaterial({ color: '#4466aa', flatShading: true })

// ── Snowman ─────────────────────────────────────────────────────────
export const SNOWMAN_BOTTOM_GEO = new THREE.SphereGeometry(20, 12, 12)
export const SNOWMAN_MIDDLE_GEO = new THREE.SphereGeometry(14, 12, 12)
export const SNOWMAN_TOP_GEO = new THREE.SphereGeometry(10, 12, 12)
export const SNOWMAN_MAT = new THREE.MeshPhongMaterial({ color: '#f0f0f0', flatShading: true })
