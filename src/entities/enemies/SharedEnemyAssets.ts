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

// ── Crow (~20 primitives) ─────────────────────────────────────────────

// Body: LatheGeometry with bird-body profile — streamlined with chest bulk + tapered tail
const crowBodyProfile = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(1.5, -3),
  new THREE.Vector2(2.8, -1),
  new THREE.Vector2(3, 0),
  new THREE.Vector2(2.8, 2),
  new THREE.Vector2(2, 4),
  new THREE.Vector2(0.5, 5.5),
  new THREE.Vector2(0, 6),
]
export const CROW_BODY_GEO = new THREE.LatheGeometry(crowBodyProfile, 10)

export const CROW_HEAD_GEO = new THREE.SphereGeometry(2.5, 8, 6)
export const CROW_BEAK_UPPER_GEO = new THREE.ConeGeometry(0.7, 3.5, 4)
export const CROW_BEAK_LOWER_GEO = new THREE.ConeGeometry(0.5, 2.5, 4)
export const CROW_EYE_GEO = new THREE.SphereGeometry(0.55, 6, 6)

// Wings: custom tapered shapes via BufferGeometry — inner (shoulder-to-elbow) + outer (elbow-to-tip)
function makeWingGeo(
  vertices: number[][],
  indices: number[],
): THREE.BufferGeometry {
  const pos = new Float32Array(vertices.length * 3)
  for (let i = 0; i < vertices.length; i++) {
    pos[i * 3] = vertices[i][0]
    pos[i * 3 + 1] = vertices[i][1]
    pos[i * 3 + 2] = vertices[i][2]
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Inner wing — wider, connects at body
export const CROW_WING_INNER_GEO = makeWingGeo(
  [
    // top face
    [0, 0.15, 2],    // 0: leading edge at body
    [5, 0.15, 1.5],  // 1: leading edge at elbow
    [5, 0.15, -1],   // 2: trailing edge at elbow
    [0, 0.15, -1.5], // 3: trailing edge at body
    // bottom face
    [0, -0.15, 2],   // 4
    [5, -0.15, 1.5], // 5
    [5, -0.15, -1],  // 6
    [0, -0.15, -1.5],// 7
  ],
  [
    0, 1, 2, 0, 2, 3, // top
    4, 6, 5, 4, 7, 6, // bottom
    0, 4, 5, 0, 5, 1, // front
    2, 6, 7, 2, 7, 3, // back
    1, 5, 6, 1, 6, 2, // outer edge
    0, 3, 7, 0, 7, 4, // inner edge
  ],
)

// Outer wing — tapered with feather notches along trailing edge
export const CROW_WING_OUTER_GEO = makeWingGeo(
  [
    // top face
    [0, 0.12, 1.5],   // 0: leading edge at elbow
    [4, 0.12, 0.8],   // 1: mid leading edge
    [6.5, 0.08, 0.3], // 2: wingtip
    [5, 0.12, -1.2],  // 3: feather notch 1
    [3, 0.12, -1.5],  // 4: feather notch 2
    [1, 0.12, -1.3],  // 5: feather notch 3
    [0, 0.12, -1],    // 6: trailing edge at elbow
    // bottom face
    [0, -0.12, 1.5],  // 7
    [4, -0.12, 0.8],  // 8
    [6.5, -0.08, 0.3],// 9
    [5, -0.12, -1.2], // 10
    [3, -0.12, -1.5], // 11
    [1, -0.12, -1.3], // 12
    [0, -0.12, -1],   // 13
  ],
  [
    // top face fan from vertex 0
    0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
    // bottom face fan
    7, 9, 8, 7, 10, 9, 7, 11, 10, 7, 12, 11, 7, 13, 12,
    // front edge
    0, 7, 8, 0, 8, 1, 1, 8, 9, 1, 9, 2,
    // back edge
    5, 12, 13, 5, 13, 6,
    // tip
    2, 9, 10, 2, 10, 3,
    // feather edges
    3, 10, 11, 3, 11, 4, 4, 11, 12, 4, 12, 5,
    // inner edge
    0, 6, 13, 0, 13, 7,
  ],
)

// Tail feathers — thin tapered flat shapes
export const CROW_TAIL_GEO = new THREE.BoxGeometry(1.2, 0.15, 4)
export const CROW_BREAST_GEO = new THREE.SphereGeometry(2.6, 8, 6)

// Materials: MeshPhysicalMaterial with iridescence for feather sheen
export const CROW_BODY_MAT = new THREE.MeshPhysicalMaterial({
  color: '#1a1a2e',
  metalness: 0.15,
  roughness: 0.6,
  iridescence: 0.4,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [200, 400],
  flatShading: true,
})

export const CROW_WING_MAT = new THREE.MeshPhysicalMaterial({
  color: '#18182a',
  metalness: 0.2,
  roughness: 0.55,
  iridescence: 0.5,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [200, 500],
  flatShading: true,
})

export const CROW_BREAST_MAT = new THREE.MeshPhysicalMaterial({
  color: '#2a2a3e',
  metalness: 0.1,
  roughness: 0.7,
  iridescence: 0.3,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [200, 400],
  flatShading: true,
})

export const CROW_HEAD_MAT = new THREE.MeshPhysicalMaterial({
  color: '#1e1e30',
  metalness: 0.15,
  roughness: 0.6,
  iridescence: 0.35,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [200, 400],
  flatShading: true,
})

export const CROW_BEAK_MAT = new THREE.MeshPhongMaterial({ color: '#3a3020', flatShading: true })

export const CROW_TAIL_MAT = new THREE.MeshPhysicalMaterial({
  color: '#1a1a2e',
  metalness: 0.15,
  roughness: 0.6,
  iridescence: 0.4,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [200, 400],
  flatShading: true,
})

export const CROW_EYE_MAT = new THREE.MeshStandardMaterial({
  color: '#ffcc00',
  emissive: '#ffcc00',
  emissiveIntensity: 0.8,
  toneMapped: false,
})

// ── Scorpion (~22 primitives) ───────────────────────────────────────
export const SCORPION_BODY_GEO = new THREE.BoxGeometry(3, 1.5, 3.5)        // cephalothorax (front)
export const SCORPION_BODY_REAR_GEO = new THREE.BoxGeometry(2.5, 1.2, 3)    // mesosoma (rear)
export const SCORPION_HEAD_GEO = new THREE.SphereGeometry(1.8, 6, 6)
export const SCORPION_EYE_GEO = new THREE.SphereGeometry(0.35, 5, 5)
export const SCORPION_PINCER_GEO = new THREE.BoxGeometry(1.2, 0.8, 3)
export const SCORPION_CLAW_GEO = new THREE.SphereGeometry(0.5, 5, 5)
export const SCORPION_TAIL_GEO = new THREE.SphereGeometry(0.7, 5, 5)
export const SCORPION_STINGER_GEO = new THREE.ConeGeometry(0.6, 2, 4)
export const SCORPION_LEG_UPPER_GEO = new THREE.CylinderGeometry(0.25, 0.22, 1.5, 4)
export const SCORPION_LEG_LOWER_GEO = new THREE.CylinderGeometry(0.22, 0.15, 1.8, 4)

// Desert amber chitin materials with specular highlights
export const SCORPION_BODY_MAT = new THREE.MeshPhongMaterial({
  color: '#6b4423',
  specular: '#aa8855',
  shininess: 40,
  flatShading: true,
})
export const SCORPION_HEAD_MAT = new THREE.MeshPhongMaterial({
  color: '#5a3a1e',
  specular: '#998866',
  shininess: 35,
  flatShading: true,
})
export const SCORPION_PINCER_MAT = new THREE.MeshPhongMaterial({
  color: '#4a2a15',
  specular: '#887755',
  shininess: 45,
  flatShading: true,
})
export const SCORPION_LEG_MAT = new THREE.MeshPhongMaterial({
  color: '#7a5533',
  specular: '#998866',
  shininess: 30,
  flatShading: true,
})
export const SCORPION_EYE_MAT = new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true })
export const SCORPION_STINGER_MAT = new THREE.MeshStandardMaterial({
  color: '#ff2222',
  emissive: '#ff0000',
  emissiveIntensity: 1.5,
  toneMapped: false,
})

// ── Shark (~18 primitives) ────────────────────────────────────────

// Body: LatheGeometry — streamlined torpedo profile
const sharkBodyProfile = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.8, 0.5),
  new THREE.Vector2(1.8, 1.5),
  new THREE.Vector2(2.5, 3),
  new THREE.Vector2(2.8, 5),
  new THREE.Vector2(2.5, 7),
  new THREE.Vector2(1.8, 9),
  new THREE.Vector2(1, 10.5),
  new THREE.Vector2(0.5, 11.5),
  new THREE.Vector2(0, 12),
]
export const SHARK_BODY_GEO = new THREE.LatheGeometry(sharkBodyProfile, 10)

// Snout: wider cone for hammerhead-like presence
export const SHARK_SNOUT_GEO = new THREE.ConeGeometry(2, 4, 6)

// Dorsal fin: custom triangular swept-back shape
export const SHARK_DORSAL_GEO = makeWingGeo(
  [
    [0, 0, 1.5],     // 0: base front
    [0, 3.5, 0],     // 1: tip (tall, swept back)
    [0, 0, -1.5],    // 2: base back
    [0.15, 0, 1.5],  // 3
    [0.15, 3.5, 0],  // 4
    [0.15, 0, -1.5], // 5
  ],
  [
    0, 1, 2,    // left face
    3, 5, 4,    // right face
    0, 3, 4, 0, 4, 1,  // front edge
    2, 1, 4, 2, 4, 5,  // back edge
    0, 2, 5, 0, 5, 3,  // bottom
  ],
)

// Tail: crescent/lunate shape — upper lobe larger than lower
export const SHARK_TAIL_UPPER_GEO = makeWingGeo(
  [
    [0, 0, 0],       // 0: base
    [0, 2.5, -2],    // 1: tip (up and back)
    [0, 0.5, -1.5],  // 2: trailing edge
    [0.15, 0, 0],    // 3
    [0.15, 2.5, -2], // 4
    [0.15, 0.5, -1.5], // 5
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)

export const SHARK_TAIL_LOWER_GEO = makeWingGeo(
  [
    [0, 0, 0],        // 0: base
    [0, -1.5, -1.5],  // 1: tip (down and back)
    [0, -0.3, -1.2],  // 2: trailing edge
    [0.15, 0, 0],     // 3
    [0.15, -1.5, -1.5], // 4
    [0.15, -0.3, -1.2], // 5
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)

// Pectoral fins: swept-back triangular
export const SHARK_PECTORAL_GEO = makeWingGeo(
  [
    [0, 0.1, 1],      // 0: leading edge at body
    [3.5, 0.1, 0],    // 1: tip
    [1.5, 0.1, -1],   // 2: trailing edge
    [0, -0.1, 1],     // 3
    [3.5, -0.1, 0],   // 4
    [1.5, -0.1, -1],  // 5
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)

export const SHARK_EYE_GEO = new THREE.SphereGeometry(0.5, 6, 6)
export const SHARK_MOUTH_GEO = new THREE.BoxGeometry(2, 0.15, 0.5)
export const SHARK_TOOTH_GEO = new THREE.ConeGeometry(0.15, 0.5, 3)
export const SHARK_GILL_GEO = new THREE.BoxGeometry(0.05, 0.8, 0.15)

// Materials: dark steel-grey with wet specular sheen
export const SHARK_BODY_MAT = new THREE.MeshPhongMaterial({
  color: '#3a4a5a',
  specular: '#667788',
  shininess: 50,
  flatShading: true,
})
export const SHARK_SNOUT_MAT = new THREE.MeshPhongMaterial({
  color: '#445566',
  specular: '#778899',
  shininess: 45,
  flatShading: true,
})
export const SHARK_FIN_MAT = new THREE.MeshPhongMaterial({
  color: '#2a3a4a',
  specular: '#556677',
  shininess: 55,
  flatShading: true,
})
export const SHARK_BELLY_MAT = new THREE.MeshPhongMaterial({
  color: '#8899aa',
  specular: '#aabbcc',
  shininess: 40,
  flatShading: true,
})
export const SHARK_EYE_MAT = new THREE.MeshStandardMaterial({
  color: '#111111',
  emissive: '#222222',
  emissiveIntensity: 0.3,
  metalness: 0.8,
  roughness: 0.2,
})
export const SHARK_MOUTH_MAT = new THREE.MeshPhongMaterial({
  color: '#1a1a22',
  flatShading: true,
})
export const SHARK_TOOTH_MAT = new THREE.MeshPhongMaterial({
  color: '#eeeedd',
  flatShading: true,
})

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

// ── Flying Fish (~14 primitives) ──────────────────────────────────

// Body: LatheGeometry — sleek laterally-compressed fish shape
const ffishBodyProfile = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.6, 0.3),
  new THREE.Vector2(1.2, 1),
  new THREE.Vector2(1.5, 2),
  new THREE.Vector2(1.4, 3),
  new THREE.Vector2(1.1, 4),
  new THREE.Vector2(0.6, 4.8),
  new THREE.Vector2(0.2, 5.3),
  new THREE.Vector2(0, 5.5),
]
export const FFISH_BODY_GEO = new THREE.LatheGeometry(ffishBodyProfile, 8)

// Wing-fins: swept-back translucent gliding surfaces
export const FFISH_WING_GEO = makeWingGeo(
  [
    // top
    [0, 0.08, 1],     // 0: leading edge at body
    [4, 0.08, 0.3],   // 1: mid
    [5.5, 0.05, -0.2],// 2: tip
    [2, 0.08, -0.8],  // 3: trailing mid
    [0, 0.08, -0.5],  // 4: trailing at body
    // bottom
    [0, -0.08, 1],    // 5
    [4, -0.08, 0.3],  // 6
    [5.5, -0.05, -0.2],// 7
    [2, -0.08, -0.8], // 8
    [0, -0.08, -0.5], // 9
  ],
  [
    // top face
    0, 1, 2, 0, 2, 3, 0, 3, 4,
    // bottom face
    5, 7, 6, 5, 8, 7, 5, 9, 8,
    // edges
    0, 5, 6, 0, 6, 1, 1, 6, 7, 1, 7, 2,
    2, 7, 8, 2, 8, 3, 3, 8, 9, 3, 9, 4,
    0, 4, 9, 0, 9, 5,
  ],
)

// Tail: forked (two lobes)
export const FFISH_TAIL_UPPER_GEO = makeWingGeo(
  [
    [0, 0, 0],      [0, 1.5, -1.8],  [0, 0.3, -1],
    [0.08, 0, 0],   [0.08, 1.5, -1.8], [0.08, 0.3, -1],
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)
export const FFISH_TAIL_LOWER_GEO = makeWingGeo(
  [
    [0, 0, 0],       [0, -1.2, -1.5],  [0, -0.2, -0.8],
    [0.08, 0, 0],    [0.08, -1.2, -1.5], [0.08, -0.2, -0.8],
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)

// Dorsal fin — small triangular
export const FFISH_DORSAL_GEO = makeWingGeo(
  [
    [0, 0, 0.5],    [0, 1, -0.2],   [0, 0, -0.5],
    [0.06, 0, 0.5], [0.06, 1, -0.2], [0.06, 0, -0.5],
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)

export const FFISH_EYE_GEO = new THREE.SphereGeometry(0.3, 6, 6)

// Materials: tropical iridescent fish with wet sheen
export const FFISH_BODY_MAT = new THREE.MeshPhongMaterial({
  color: '#4488bb',
  specular: '#99ccee',
  shininess: 60,
  flatShading: true,
})
export const FFISH_BELLY_MAT = new THREE.MeshPhongMaterial({
  color: '#aaccdd',
  specular: '#ddeeff',
  shininess: 50,
  flatShading: true,
})
export const FFISH_WING_MAT = new THREE.MeshPhongMaterial({
  color: '#6699cc',
  specular: '#88bbdd',
  shininess: 40,
  transparent: true,
  opacity: 0.75,
  flatShading: true,
  side: THREE.DoubleSide,
})
export const FFISH_TAIL_MAT = new THREE.MeshPhongMaterial({
  color: '#5588bb',
  specular: '#77aacc',
  shininess: 45,
  flatShading: true,
})
export const FFISH_FIN_MAT = new THREE.MeshPhongMaterial({
  color: '#5599bb',
  specular: '#88bbdd',
  shininess: 40,
  flatShading: true,
})
export const FFISH_EYE_MAT = new THREE.MeshPhongMaterial({
  color: '#111111',
  specular: '#444444',
  shininess: 80,
  flatShading: true,
})

// ── Snowman (shared across normal, scout, brute) ───────────────────
export const SNOWMAN_BOTTOM_GEO = new THREE.SphereGeometry(20, 12, 12)
export const SNOWMAN_MIDDLE_GEO = new THREE.SphereGeometry(14, 12, 12)
export const SNOWMAN_TOP_GEO = new THREE.SphereGeometry(10, 12, 12)
export const SNOWMAN_MAT = new THREE.MeshPhongMaterial({
  color: '#e8eeff',
  specular: '#aaccff',
  shininess: 30,
  flatShading: true,
})

// Accessories shared across snowman variants
export const SNOWMAN_EYE_GEO = new THREE.SphereGeometry(1.5, 6, 6)
export const SNOWMAN_EYE_MAT = new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true })
export const SNOWMAN_NOSE_GEO = new THREE.ConeGeometry(1.2, 6, 5)
export const SNOWMAN_NOSE_MAT = new THREE.MeshPhongMaterial({ color: '#ff6600', flatShading: true })
export const SNOWMAN_BUTTON_GEO = new THREE.SphereGeometry(1, 6, 6)
export const SNOWMAN_BUTTON_MAT = new THREE.MeshPhongMaterial({ color: '#222222', flatShading: true })
export const SNOWMAN_MOUTH_GEO = new THREE.SphereGeometry(0.8, 6, 6)
export const SNOWMAN_MOUTH_MAT = new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true })
export const SNOWMAN_ARM_GEO = new THREE.CylinderGeometry(0.5, 0.3, 14, 4)
export const SNOWMAN_ARM_MAT = new THREE.MeshPhongMaterial({ color: '#4a3020', flatShading: true })
export const SNOWMAN_TWIG_GEO = new THREE.CylinderGeometry(0.15, 0.1, 5, 3)
export const SNOWMAN_TWIG_MAT = SNOWMAN_ARM_MAT

// Scout — icy blue tint
export const SNOWMAN_SCOUT_MAT = new THREE.MeshPhongMaterial({
  color: '#d0e8ff',
  specular: '#88bbff',
  shininess: 35,
  flatShading: true,
})
export const SNOWMAN_SCOUT_SHARD_GEO = new THREE.ConeGeometry(2, 8, 4)
export const SNOWMAN_SCOUT_SHARD_MAT = new THREE.MeshPhongMaterial({
  color: '#80d0ff',
  emissive: '#3080cc',
  emissiveIntensity: 1.5,
  flatShading: true,
  transparent: true,
  opacity: 0.8,
  toneMapped: false,
})

// Brute — top hat and scarf
export const SNOWMAN_HAT_BRIM_GEO = new THREE.CylinderGeometry(8, 8, 1.5, 8)
export const SNOWMAN_HAT_TOP_GEO = new THREE.CylinderGeometry(5.5, 6, 10, 8)
export const SNOWMAN_HAT_BAND_GEO = new THREE.CylinderGeometry(6.1, 6.1, 1.2, 8)
export const SNOWMAN_HAT_MAT = new THREE.MeshPhongMaterial({
  color: '#111111',
  specular: '#333333',
  shininess: 15,
  flatShading: true,
})
export const SNOWMAN_SCARF_GEO = new THREE.TorusGeometry(11, 2, 6, 12)
export const SNOWMAN_SCARF_TAIL_GEO = new THREE.BoxGeometry(2, 8, 1)
export const SNOWMAN_SCARF_MAT = new THREE.MeshPhongMaterial({
  color: '#cc2222',
  specular: '#ff6644',
  shininess: 20,
  flatShading: true,
})
export const SNOWMAN_HAT_BAND_MAT = new THREE.MeshPhongMaterial({
  color: '#cc2222',
  specular: '#ff6644',
  shininess: 20,
  flatShading: true,
})

// ── Ember Wisp ────────────────────────────────────────────────
export const EMBER_WISP_CORE_GEO = new THREE.SphereGeometry(3, 8, 8)
export const EMBER_WISP_TENDRIL_GEO = new THREE.ConeGeometry(1, 4, 4)

export const EMBER_WISP_CORE_MAT = new THREE.MeshPhongMaterial({
  color: '#ff6600',
  emissive: '#ff3300',
  emissiveIntensity: 0.8,
  flatShading: true,
})
export const EMBER_WISP_TENDRIL_MAT = new THREE.MeshPhongMaterial({
  color: '#ffaa00',
  emissive: '#ff6600',
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.7,
  flatShading: true,
})

// ── Lava Golem ────────────────────────────────────────────────
const lavaGolemProfile = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(4, 1),
  new THREE.Vector2(5.5, 3),
  new THREE.Vector2(6, 6),
  new THREE.Vector2(5.5, 9),
  new THREE.Vector2(5, 12),
  new THREE.Vector2(4, 15),
  new THREE.Vector2(3.5, 18),
  new THREE.Vector2(0, 20),
]
export const LAVA_GOLEM_BODY_GEO = new THREE.LatheGeometry(lavaGolemProfile, 10)
export const LAVA_GOLEM_HEAD_GEO = new THREE.SphereGeometry(3, 8, 6)
export const LAVA_GOLEM_ARM_GEO = new THREE.BoxGeometry(2, 8, 2)
export const LAVA_GOLEM_EYE_GEO = new THREE.SphereGeometry(0.8, 6, 6)

export const LAVA_GOLEM_BODY_MAT = new THREE.MeshPhongMaterial({
  color: '#4a2a10',
  specular: '#ff6633',
  shininess: 50,
  flatShading: true,
})
export const LAVA_GOLEM_CRACK_MAT = new THREE.MeshPhongMaterial({
  color: '#ff4400',
  emissive: '#ff2200',
  emissiveIntensity: 0.6,
  flatShading: true,
})
export const LAVA_GOLEM_EYE_MAT = new THREE.MeshStandardMaterial({
  color: '#ff4400',
  emissive: '#ff2200',
  emissiveIntensity: 1.5,
  toneMapped: false,
})

// ── Fire Imp ──────────────────────────────────────────────────
const fireImpProfile = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(2, 0.5),
  new THREE.Vector2(3, 2),
  new THREE.Vector2(3.2, 4),
  new THREE.Vector2(2.8, 6),
  new THREE.Vector2(2, 7.5),
  new THREE.Vector2(0, 8),
]
export const FIRE_IMP_BODY_GEO = new THREE.LatheGeometry(fireImpProfile, 8)
export const FIRE_IMP_HORN_GEO = new THREE.ConeGeometry(0.6, 3, 4)
export const FIRE_IMP_TAIL_GEO = new THREE.CylinderGeometry(0.3, 0.15, 6, 4)
export const FIRE_IMP_TAIL_SPIKE_GEO = new THREE.ConeGeometry(0.5, 1.5, 4)
export const FIRE_IMP_EYE_GEO = new THREE.SphereGeometry(0.5, 6, 6)

export const FIRE_IMP_BODY_MAT = new THREE.MeshPhysicalMaterial({
  color: '#8b1a1a',
  metalness: 0.2,
  roughness: 0.5,
  iridescence: 0.3,
  iridescenceIOR: 1.3,
  flatShading: true,
})
export const FIRE_IMP_HORN_MAT = new THREE.MeshPhongMaterial({
  color: '#2a0808',
  flatShading: true,
})
export const FIRE_IMP_EYE_MAT = new THREE.MeshStandardMaterial({
  color: '#ffcc00',
  emissive: '#ff8800',
  emissiveIntensity: 1.5,
  toneMapped: false,
})

// ── Infernal Drake ────────────────────────────────────────────
const infernalDrakeProfile = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(1.5, 1),
  new THREE.Vector2(3, 3),
  new THREE.Vector2(3.5, 6),
  new THREE.Vector2(3.2, 9),
  new THREE.Vector2(2.8, 12),
  new THREE.Vector2(2, 15),
  new THREE.Vector2(1, 17),
  new THREE.Vector2(0, 18),
]
export const DRAKE_BODY_GEO = new THREE.LatheGeometry(infernalDrakeProfile, 10)
export const DRAKE_HEAD_GEO = new THREE.SphereGeometry(2.5, 8, 6)
export const DRAKE_SPIKE_GEO = new THREE.ConeGeometry(0.8, 3, 4)
export const DRAKE_TAIL_GEO = new THREE.CylinderGeometry(1.5, 0.3, 12, 6)
export const DRAKE_EYE_GEO = new THREE.SphereGeometry(0.6, 6, 6)
export const DRAKE_JAW_GEO = new THREE.BoxGeometry(2.5, 0.8, 3)

// Drake wing — custom bat-like membrane (4 segments)
function makeDrakeWingGeo(): THREE.BufferGeometry {
  const verts = new Float32Array([
    // top
    0, 0.1, 1.5,     // 0: shoulder
    3, 0.1, 1,        // 1: mid leading
    6, 0.08, 0.5,     // 2: outer leading
    8, 0.05, -0.5,    // 3: wingtip
    6, 0.08, -1.5,    // 4: trailing outer
    3, 0.1, -1.8,     // 5: trailing mid
    0, 0.1, -1,       // 6: trailing shoulder
    // bottom
    0, -0.1, 1.5,     // 7
    3, -0.1, 1,        // 8
    6, -0.08, 0.5,     // 9
    8, -0.05, -0.5,    // 10
    6, -0.08, -1.5,    // 11
    3, -0.1, -1.8,     // 12
    0, -0.1, -1,       // 13
  ])
  const indices = [
    // top face
    0, 1, 6, 1, 5, 6, 1, 2, 5, 2, 4, 5, 2, 3, 4,
    // bottom face
    7, 13, 8, 8, 13, 12, 8, 12, 9, 9, 12, 11, 9, 11, 10,
    // edges
    0, 7, 8, 0, 8, 1, 3, 10, 11, 3, 11, 4,
    0, 6, 13, 0, 13, 7,
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}
export const DRAKE_WING_GEO = makeDrakeWingGeo()

export const DRAKE_BODY_MAT = new THREE.MeshPhysicalMaterial({
  color: '#2a0a0a',
  metalness: 0.3,
  roughness: 0.4,
  iridescence: 0.5,
  iridescenceIOR: 1.4,
  iridescenceThicknessRange: [200, 500],
  flatShading: true,
})
export const DRAKE_WING_MAT = new THREE.MeshPhongMaterial({
  color: '#660000',
  emissive: '#ff2200',
  emissiveIntensity: 0.3,
  transparent: true,
  opacity: 0.75,
  flatShading: true,
  side: THREE.DoubleSide,
})
export const DRAKE_SPIKE_MAT = new THREE.MeshPhongMaterial({
  color: '#1a0505',
  flatShading: true,
})
export const DRAKE_EYE_MAT = new THREE.MeshStandardMaterial({
  color: '#ff4400',
  emissive: '#ff2200',
  emissiveIntensity: 2,
  toneMapped: false,
})
