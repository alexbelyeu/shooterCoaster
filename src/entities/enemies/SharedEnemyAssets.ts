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

// ── Crow (rebuilt: ~12 primitives) ───────────────────────────────────
export const CROW_BODY_GEO = new THREE.CapsuleGeometry(2.5, 5, 4, 8)
export const CROW_HEAD_GEO = new THREE.SphereGeometry(2, 6, 6)
export const CROW_BEAK_GEO = new THREE.ConeGeometry(0.8, 3, 4)
export const CROW_WING_GEO = new THREE.BoxGeometry(8, 0.5, 4)
export const CROW_TAIL_GEO = new THREE.BoxGeometry(3, 0.3, 2.5)
export const CROW_EYE_GEO = new THREE.SphereGeometry(0.5, 4, 4)

export const CROW_BODY_MAT = new THREE.MeshPhongMaterial({ color: '#2a1a2a', flatShading: true })
export const CROW_HEAD_MAT = new THREE.MeshPhongMaterial({ color: '#1a1020', flatShading: true })
export const CROW_BEAK_MAT = new THREE.MeshPhongMaterial({ color: '#4a3a00', flatShading: true })
export const CROW_WING_MAT = new THREE.MeshPhongMaterial({ color: '#1a0d1a', flatShading: true })
export const CROW_TAIL_MAT = new THREE.MeshPhongMaterial({ color: '#2a1a2a', flatShading: true })
export const CROW_EYE_MAT = new THREE.MeshStandardMaterial({
  color: '#ffcc00',
  emissive: '#ffcc00',
  emissiveIntensity: 0.8,
  toneMapped: false,
})

// ── Scorpion (~14 primitives) ───────────────────────────────────────
export const SCORPION_BODY_GEO = new THREE.BoxGeometry(3, 1.5, 5)
export const SCORPION_HEAD_GEO = new THREE.SphereGeometry(1.8, 6, 6)
export const SCORPION_PINCER_GEO = new THREE.BoxGeometry(1.2, 0.8, 3)
export const SCORPION_TAIL_GEO = new THREE.SphereGeometry(0.7, 5, 5)
export const SCORPION_STINGER_GEO = new THREE.ConeGeometry(0.6, 2, 4)
export const SCORPION_LEG_GEO = new THREE.CylinderGeometry(0.25, 0.25, 2, 4)

export const SCORPION_BODY_MAT = new THREE.MeshPhongMaterial({ color: '#1a0a1a', flatShading: true })
export const SCORPION_HEAD_MAT = new THREE.MeshPhongMaterial({ color: '#2a102a', flatShading: true })
export const SCORPION_PINCER_MAT = new THREE.MeshPhongMaterial({ color: '#1a0a1a', flatShading: true })
export const SCORPION_LEG_MAT = new THREE.MeshPhongMaterial({ color: '#2a102a', flatShading: true })
export const SCORPION_STINGER_MAT = new THREE.MeshStandardMaterial({
  color: '#ff2222',
  emissive: '#ff0000',
  emissiveIntensity: 1.5,
  toneMapped: false,
})

// ── Shark (~14 primitives) ────────────────────────────────────────
export const SHARK_BODY_GEO = new THREE.CapsuleGeometry(2, 6, 4, 8)
export const SHARK_SNOUT_GEO = new THREE.ConeGeometry(1.5, 3, 5)
export const SHARK_DORSAL_GEO = new THREE.BoxGeometry(0.3, 3, 2)
export const SHARK_TAIL_GEO = new THREE.BoxGeometry(0.3, 2.5, 2.5)
export const SHARK_PECTORAL_GEO = new THREE.BoxGeometry(3, 0.3, 1.5)
export const SHARK_EYE_GEO = new THREE.SphereGeometry(0.4, 4, 4)
export const SHARK_MOUTH_GEO = new THREE.BoxGeometry(1.5, 0.1, 0.3)

export const SHARK_BODY_MAT = new THREE.MeshPhongMaterial({ color: '#4466aa', flatShading: true })
export const SHARK_SNOUT_MAT = new THREE.MeshPhongMaterial({ color: '#5577bb', flatShading: true })
export const SHARK_FIN_MAT = new THREE.MeshPhongMaterial({ color: '#3355aa', flatShading: true })
export const SHARK_BELLY_MAT = new THREE.MeshPhongMaterial({ color: '#6688cc', flatShading: true })
export const SHARK_EYE_MAT = new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true })
export const SHARK_MOUTH_MAT = new THREE.MeshPhongMaterial({ color: '#222233', flatShading: true })

// ── Jellyfish (~10 primitives) ───────────────────────────────────
export const JELLY_DOME_GEO = new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
export const JELLY_INNER_GEO = new THREE.SphereGeometry(1.5, 6, 6)
export const JELLY_TENTACLE_GEO = new THREE.CylinderGeometry(0.15, 0.08, 5, 4)

const JELLY_COLORS = ['#ff88cc', '#88ccff', '#cc88ff', '#88ffcc']
export const JELLY_DOME_MATS = JELLY_COLORS.map(
  (c) => new THREE.MeshPhongMaterial({ color: c, transparent: true, opacity: 0.55, flatShading: true, side: THREE.DoubleSide }),
)
export const JELLY_INNER_MATS = JELLY_COLORS.map(
  (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5, toneMapped: false }),
)
export const JELLY_TENTACLE_MATS = JELLY_COLORS.map(
  (c) => new THREE.MeshPhongMaterial({ color: c, transparent: true, opacity: 0.4, flatShading: true }),
)
export const JELLY_COLOR_COUNT = JELLY_COLORS.length

// ── Flying Fish (~8 primitives) ──────────────────────────────────
export const FFISH_BODY_GEO = new THREE.CapsuleGeometry(1, 3, 4, 6)
export const FFISH_WING_GEO = new THREE.BoxGeometry(3, 0.15, 1.5)
export const FFISH_TAIL_GEO = new THREE.BoxGeometry(0.2, 1.2, 0.8)
export const FFISH_EYE_GEO = new THREE.SphereGeometry(0.25, 4, 4)

export const FFISH_BODY_MAT = new THREE.MeshPhongMaterial({ color: '#88aadd', flatShading: true })
export const FFISH_WING_MAT = new THREE.MeshPhongMaterial({ color: '#99bbee', transparent: true, opacity: 0.7, flatShading: true })
export const FFISH_TAIL_MAT = new THREE.MeshPhongMaterial({ color: '#7799cc', flatShading: true })
export const FFISH_EYE_MAT = new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true })

// ── Snowman (shared across normal, scout, brute) ───────────────────
export const SNOWMAN_BOTTOM_GEO = new THREE.SphereGeometry(20, 12, 12)
export const SNOWMAN_MIDDLE_GEO = new THREE.SphereGeometry(14, 12, 12)
export const SNOWMAN_TOP_GEO = new THREE.SphereGeometry(10, 12, 12)
export const SNOWMAN_MAT = new THREE.MeshPhongMaterial({ color: '#f0f0f0', flatShading: true })

// Accessories shared across snowman variants
export const SNOWMAN_EYE_GEO = new THREE.SphereGeometry(1.5, 6, 6)
export const SNOWMAN_EYE_MAT = new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true })
export const SNOWMAN_NOSE_GEO = new THREE.ConeGeometry(1.2, 6, 5)
export const SNOWMAN_NOSE_MAT = new THREE.MeshPhongMaterial({ color: '#ff6600', flatShading: true })
export const SNOWMAN_BUTTON_GEO = new THREE.SphereGeometry(1, 6, 6)
export const SNOWMAN_BUTTON_MAT = new THREE.MeshPhongMaterial({ color: '#222222', flatShading: true })
export const SNOWMAN_ARM_GEO = new THREE.CylinderGeometry(0.5, 0.3, 14, 4)
export const SNOWMAN_ARM_MAT = new THREE.MeshPhongMaterial({ color: '#4a3020', flatShading: true })

// Scout — icy blue tint
export const SNOWMAN_SCOUT_MAT = new THREE.MeshPhongMaterial({ color: '#d0e8ff', flatShading: true })
export const SNOWMAN_SCOUT_SHARD_GEO = new THREE.ConeGeometry(2, 8, 4)
export const SNOWMAN_SCOUT_SHARD_MAT = new THREE.MeshPhongMaterial({
  color: '#80d0ff',
  emissive: '#3080cc',
  emissiveIntensity: 0.5,
  flatShading: true,
  transparent: true,
  opacity: 0.8,
})

// Brute — top hat and scarf
export const SNOWMAN_HAT_BRIM_GEO = new THREE.CylinderGeometry(8, 8, 1.5, 8)
export const SNOWMAN_HAT_TOP_GEO = new THREE.CylinderGeometry(5.5, 6, 10, 8)
export const SNOWMAN_HAT_MAT = new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true })
export const SNOWMAN_SCARF_GEO = new THREE.TorusGeometry(11, 2, 6, 12)
export const SNOWMAN_SCARF_MAT = new THREE.MeshPhongMaterial({ color: '#cc2222', flatShading: true })
