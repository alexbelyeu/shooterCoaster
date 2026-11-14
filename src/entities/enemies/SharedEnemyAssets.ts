import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mergePainted, painted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import { withRim } from './enemyRim'

// Readability rules (issue #15): every lit enemy material gets a fresnel rim via
// withRim(); base colours keep ΔE ≥ ~15 from their biome's dominant terrain
// colours (see docs/agents/DECISIONS.md, 2026-10-19 enemy readability).

// ── Balloon geometries (shared by Balloon + GoldenBalloon) ──────────
export const BALLOON_BODY_GEO = new THREE.SphereGeometry(30, 16, 16)
export const BALLOON_KNOT_GEO = new THREE.SphereGeometry(4, 8, 8)
export const BALLOON_STRING_GEO = new THREE.CylinderGeometry(0.5, 0.5, 55, 4)
/** Teardrop body + knot as one geometry: Theme Park has ~150 balloons, so draw calls add up. */
export const BALLOON_GEO = mergeGeometries([
  new THREE.SphereGeometry(30, 16, 12).scale(1, 1.3, 1),
  new THREE.SphereGeometry(4, 6, 4).translate(0, -35, 0),
])

// ── Balloon materials (10 color variants) ───────────────────────────
const BALLOON_COLORS = [
  '#ff3333', '#ff6633', '#ffcc00', '#33cc33', '#3399ff',
  '#9933ff', '#ff33cc', '#ff6699', '#00cccc', '#66ff33',
]

export const BALLOON_BODY_MATS = BALLOON_COLORS.map(
  (c) => withRim(new THREE.MeshPhongMaterial({ color: c, specular: '#ffffff', shininess: 60 })),
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

export const GOLDEN_KNOT_MAT = withRim(new THREE.MeshStandardMaterial({
  color: '#cc9900',
  metalness: 0.5,
  roughness: 0.3,
}))

export const GOLDEN_STRING_MAT = new THREE.MeshBasicMaterial({ color: '#cc9900' })

// ── Crow: merged feathers (body, tail, beak, wings) + eyes ───────────

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
const crowWingInnerGeo = () => makeWingGeo(
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
const crowWingOuterGeo = () => makeWingGeo(
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

/** Right shoulder pivot and the elbow's x offset from it (the left wing mirrors x). */
const CROW_SHOULDER: [number, number, number] = [2.5, 0.5, 0]
const CROW_ELBOW_X = 5

/** `aWing` drives the flap shader: 0 body, ±1 inner wing, ±2 outer wing (+ = right). */
function wingTagged(g: THREE.BufferGeometry, tag: number): THREE.BufferGeometry {
  g.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(tag), 1))
  return g
}

const CROW_WING_COLOR = '#18182a'
const CROW_BEAK_COLOR = '#d8a028'

export const CROW_GEO = mergePainted([
  painted(new THREE.LatheGeometry(crowBodyProfile, 10), '#1c1c30', [0, 0, -1], [Math.PI / 2, 0, 0]),
  paintedAt(new THREE.SphereGeometry(2.6, 8, 6), '#2a2a3e', pose([0, -0.5, 1], [0, 0, 0], [0.85, 0.85, 1])),
  paintedAt(new THREE.SphereGeometry(2.5, 8, 6), '#1e1e30', pose([0, 1, 4], [0, 0, 0], [0.9, 1, 1.1])),
  // Beak: upper mandible (longer), lower one shorter and slightly open
  painted(new THREE.ConeGeometry(0.7, 3.5, 4), CROW_BEAK_COLOR, [0, 0.6, 6.5], [Math.PI / 2, 0, 0]),
  painted(new THREE.ConeGeometry(0.5, 2.5, 4), CROW_BEAK_COLOR, [0, 0.1, 6], [Math.PI / 2 + 0.15, 0, 0]),
  // Tail fan: 5 feathers spread at angles
  ...[-0.4, -0.2, 0, 0.2, 0.4].map((a) =>
    painted(new THREE.BoxGeometry(1.2, 0.15, 4), '#1c1c30', [Math.sin(a) * 1.5, 0.3, -4.5 - Math.abs(a) * 1.5], [0.1, a, 0]),
  ),
].map((g) => wingTagged(g, 0)).concat(
  [1, -1].flatMap((side) => {
    const [sx, sy, sz] = CROW_SHOULDER
    const mirror: [number, number, number] = [side, 1, 1]
    return [
      wingTagged(paintedAt(crowWingInnerGeo(), CROW_WING_COLOR, pose([side * sx, sy, sz], [0, 0, 0], mirror)), side),
      wingTagged(
        paintedAt(crowWingOuterGeo(), CROW_WING_COLOR, pose([side * (sx + CROW_ELBOW_X), sy, sz], [0, 0, 0], mirror)),
        side * 2,
      ),
    ]
  }),
))

export const CROW_EYES_GEO = mergeGeometries([
  new THREE.SphereGeometry(0.55, 6, 6).translate(-1.2, 1.8, 5),
  new THREE.SphereGeometry(0.55, 6, 6).translate(1.2, 1.8, 5),
])

const CROW_WING_PARS = /* glsl */ `
attribute float aWing;
uniform vec2 uWingFlap;
`

// Outer wing about the elbow, then the whole wing about the shoulder; flat shading
// takes normals from screen derivatives, so only positions move.
const CROW_WING_FLAP = /* glsl */ `
{
  float side = sign(aWing);
  if (side != 0.0) {
    vec3 shoulder = vec3(side * ${CROW_SHOULDER[0].toFixed(1)}, ${CROW_SHOULDER[1].toFixed(1)}, ${CROW_SHOULDER[2].toFixed(1)});
    vec3 q = transformed - shoulder;
    if (abs(aWing) > 1.5) {
      vec2 elbow = vec2(side * ${CROW_ELBOW_X.toFixed(1)}, 0.0);
      float b = -side * uWingFlap.y;
      q.xy = elbow + mat2(cos(b), sin(b), -sin(b), cos(b)) * (q.xy - elbow);
    }
    float a = -side * uWingFlap.x;
    q.xy = mat2(cos(a), sin(a), -sin(a), cos(a)) * q.xy;
    transformed = shoulder + q;
  }
}
`

// Dark iridescent silhouette on the pale sky + a blue-grey rim sheen so crows
// also read against the hazy horizon and the red mesas.
const CROW_RIM = { color: '#a8bce0', intensity: 0.5, power: 3 }

export function patchCrowWingVertex(vertexShader: string): string {
  return vertexShader
    .replace('#include <common>', `#include <common>\n${CROW_WING_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CROW_WING_FLAP}`)
}

/** One crow's feathers, flapping by `flap` (inner, outer radians); every instance shares one program. */
export function createCrowFeatherMaterial(flap: { value: THREE.Vector2 }): THREE.MeshPhysicalMaterial {
  const material = withRim(new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.15,
    roughness: 0.6,
    iridescence: 0.4,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [200, 400],
    flatShading: true,
  }), CROW_RIM)
  const rimCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    rimCompile(shader, renderer)
    shader.uniforms.uWingFlap = flap
    shader.vertexShader = patchCrowWingVertex(shader.vertexShader)
  }
  material.customProgramCacheKey = () => 'sc-enemy-rim-v2-crow-wing'
  return material
}

/** Only for ShaderWarmup: crows build their own instances. */
export const CROW_FEATHER_MAT = createCrowFeatherMaterial({ value: new THREE.Vector2() })

export const CROW_EYE_MAT = new THREE.MeshStandardMaterial({
  color: '#ffcc00',
  emissive: '#ffcc00',
  emissiveIntensity: 0.8,
  toneMapped: false,
})

// ── Scorpion: merged shell + swaying tail + glowing stinger ─────────

// Dark plum-black chitin with amber legs: an amber body sat at ΔE≈9 from the desert cliffs.
const SCORPION_BODY_COLOR = '#2a1626'
const SCORPION_HEAD_COLOR = '#24121e'
const SCORPION_PINCER_COLOR = '#3a1622'
const SCORPION_LEG_COLOR = '#e0701e'

function scorpionPincer(side: number): THREE.BufferGeometry[] {
  const arm = pose([side * 2, 0.3, 3.5], [0, side * 0.5, 0])
  const at = (p: [number, number, number], r?: [number, number, number], s?: [number, number, number]) =>
    arm.clone().multiply(pose(p, r, s))
  const box = () => new THREE.BoxGeometry(1.2, 0.8, 3)
  const tip = () => new THREE.SphereGeometry(0.5, 5, 5)
  return [
    paintedAt(box(), SCORPION_PINCER_COLOR, at([0, 0, 1.5])),
    paintedAt(box(), SCORPION_PINCER_COLOR, at([-0.4, 0, 3.2], [0, -0.3, 0], [0.5, 1, 0.6])),
    paintedAt(box(), SCORPION_PINCER_COLOR, at([0.4, 0, 3.2], [0, 0.3, 0], [0.5, 1, 0.6])),
    // Rounded claw tips
    paintedAt(tip(), SCORPION_PINCER_COLOR, at([-0.6, 0, 3.8])),
    paintedAt(tip(), SCORPION_PINCER_COLOR, at([0.6, 0, 3.8])),
  ]
}

/** Two-segment leg: upper angled outward and down, lower bent further at the knee. */
function scorpionLeg(side: number, z: number): THREE.BufferGeometry[] {
  const hip = pose([side * 2.2, -0.2, z]).multiply(pose([0, 0, 0], [0, 0, side * 0.5]))
  const knee = hip.clone().multiply(pose([side * 1.2, -1, 0], [0, 0, side * 0.6]))
  return [
    paintedAt(
      new THREE.CylinderGeometry(0.25, 0.22, 1.5, 4),
      SCORPION_LEG_COLOR,
      hip.multiply(pose([side * 0.5, -0.4, 0], [0, 0, side * 0.3])),
    ),
    paintedAt(new THREE.CylinderGeometry(0.22, 0.15, 1.8, 4), SCORPION_LEG_COLOR, knee.multiply(pose([side * 0.3, -0.6, 0]))),
  ]
}

export const SCORPION_GEO = mergePainted([
  // Cephalothorax (front) and mesosoma (rear, overlapping slightly)
  painted(new THREE.BoxGeometry(3, 1.5, 3.5), SCORPION_BODY_COLOR, [0, 0, 1]),
  painted(new THREE.BoxGeometry(2.5, 1.2, 3), SCORPION_BODY_COLOR, [0, -0.1, -1.2]),
  painted(new THREE.SphereGeometry(1.8, 6, 6), SCORPION_HEAD_COLOR, [0, 0.3, 3.5]),
  painted(new THREE.SphereGeometry(0.35, 5, 5), '#111111', [-0.7, 1, 4]),
  painted(new THREE.SphereGeometry(0.35, 5, 5), '#111111', [0.7, 1, 4]),
  ...scorpionPincer(-1),
  ...scorpionPincer(1),
  ...[-1, 1].flatMap((side) => [1.5, 0.5, -0.5, -1.5].flatMap((z) => scorpionLeg(side, z))),
])

export const SCORPION_TAIL_PIVOT: [number, number, number] = [0, 0.5, -2.5]

// Chain of spheres curling up and over
export const SCORPION_TAIL_GEO = mergeGeometries(
  [[0, 0.5, 0], [0, 1.5, -0.3], [0, 2.8, -0.2], [0, 3.8, 0.3], [0, 4.5, 1.0]].map(([x, y, z]) =>
    new THREE.SphereGeometry(0.7, 5, 5).translate(x, y, z),
  ),
)
export const SCORPION_STINGER_GEO = new THREE.ConeGeometry(0.6, 2, 4).rotateX(0.5).translate(0, 4.8, 1.8)

const SCORPION_RIM = { color: '#ffd9a0', intensity: 0.7, power: 2.2 }
// Lacquered chitin: Standard, so its facets catch the baked sky (scene.environment).
export const SCORPION_SHELL_MAT = withRim(new THREE.MeshStandardMaterial({
  vertexColors: true,
  metalness: 0.3,
  roughness: 0.35,
  flatShading: true,
}), SCORPION_RIM)
export const SCORPION_TAIL_MAT = withRim(new THREE.MeshStandardMaterial({
  color: SCORPION_HEAD_COLOR,
  metalness: 0.3,
  roughness: 0.35,
  flatShading: true,
}), SCORPION_RIM)
export const SCORPION_STINGER_MAT = new THREE.MeshStandardMaterial({
  color: '#ff4422',
  emissive: '#ff2200',
  emissiveIntensity: 2.2,
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

// Steel-blue back (dark slate vanished into the deep water), white belly; Standard so the wet skin reflects the sky env map.
const SHARK_RIM = { color: '#e0f4ff', intensity: 0.65, power: 2.5 }
export const SHARK_BODY_MAT = withRim(new THREE.MeshStandardMaterial({
  color: '#5a6e82',
  metalness: 0.25,
  roughness: 0.3,
  flatShading: true,
}), SHARK_RIM)
export const SHARK_SNOUT_MAT = withRim(new THREE.MeshStandardMaterial({
  color: '#62788c',
  metalness: 0.25,
  roughness: 0.32,
  flatShading: true,
}), SHARK_RIM)
export const SHARK_FIN_MAT = withRim(new THREE.MeshStandardMaterial({
  color: '#485c70',
  metalness: 0.25,
  roughness: 0.28,
  flatShading: true,
}), SHARK_RIM)
export const SHARK_BELLY_MAT = withRim(new THREE.MeshStandardMaterial({
  color: '#e8eef4',
  metalness: 0.05,
  roughness: 0.4,
  flatShading: true,
}), SHARK_RIM)
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

// ── Jellyfish: bell + glowing core ───────────────────────────────
const JELLY_TENTACLES = 5
/**
 * Bell + five hanging tentacles as one geometry: a whole Ocean wave floats in view beside
 * the track (#316), and at 7 draw calls a jellyfish broke level3's draw budget.
 */
export const JELLY_BODY_GEO = mergeGeometries([
  new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  ...Array.from({ length: JELLY_TENTACLES }, (_, i) => {
    const a = (i / JELLY_TENTACLES) * Math.PI * 2
    return new THREE.CylinderGeometry(0.15, 0.08, 5, 4).translate(Math.cos(a) * 1.8, -3, Math.sin(a) * 1.8)
  }),
])
export const JELLY_INNER_GEO = new THREE.SphereGeometry(1.5, 6, 6)

const JELLY_COLORS = ['#ff88cc', '#88ccff', '#cc88ff', '#88ffcc']
export const JELLY_BODY_MATS = JELLY_COLORS.map(
  (c) => withRim(
    new THREE.MeshPhongMaterial({ color: c, transparent: true, opacity: 0.5, flatShading: true, side: THREE.DoubleSide }),
    { color: c, intensity: 0.8, power: 2 },
  ),
)
export const JELLY_INNER_MATS = JELLY_COLORS.map(
  (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5, toneMapped: false }),
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

// Materials: silver-blue fish with wet sheen (VISION: flying fish read silver)
const FFISH_RIM = { color: '#f0faff', intensity: 0.65, power: 2.5 }
export const FFISH_BODY_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#7aa8cc',
  specular: '#e0f2ff',
  shininess: 60,
  flatShading: true,
}), FFISH_RIM)
export const FFISH_BELLY_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#dce8f0',
  specular: '#ffffff',
  shininess: 50,
  flatShading: true,
}), FFISH_RIM)
export const FFISH_WING_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#9cc4e4',
  specular: '#e0f2ff',
  shininess: 40,
  transparent: true,
  opacity: 0.75,
  flatShading: true,
  side: THREE.DoubleSide,
}), FFISH_RIM)
export const FFISH_TAIL_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#6a98c0',
  specular: '#c8e4f8',
  shininess: 45,
  flatShading: true,
}), FFISH_RIM)
export const FFISH_FIN_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#6a9cc0',
  specular: '#c8e4f8',
  shininess: 40,
  flatShading: true,
}), FFISH_RIM)
export const FFISH_EYE_MAT = new THREE.MeshPhongMaterial({
  color: '#111111',
  specular: '#444444',
  shininess: 80,
  flatShading: true,
})

type Vec3 = [number, number, number]

/** Fresh parts sharing one material, placed as their meshes were and merged into one draw call (the parts are disposed). */
function placedParts(parts: [geo: THREE.BufferGeometry, position: Vec3, rotation?: Vec3, scale?: Vec3][]): THREE.BufferGeometry {
  const g = mergeGeometries(parts.map(([geo, p, r, s]) => geo.applyMatrix4(pose(p, r, s))))
  for (const [geo] of parts) geo.dispose()
  return g
}

// ── Snowman (shared across normal, scout, brute) ───────────────────
export const SNOWMAN_BODY_GEO = placedParts([
  [new THREE.SphereGeometry(20, 12, 12), [0, 0, 0]],
  [new THREE.SphereGeometry(14, 12, 12), [0, 25, 0]],
  [new THREE.SphereGeometry(10, 12, 12), [0, 42, 0]],
])
// Snow-white by design, so snowmen read by luminance: the blue emissive lift keeps them brighter than the shaded snow.
const SNOW_RIM = { color: '#dceaff', intensity: 0.55, power: 2.2 }
export const SNOWMAN_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#f6f9ff',
  emissive: '#8094c8',
  emissiveIntensity: 1.4,
  specular: '#ffffff',
  shininess: 40,
  flatShading: true,
}), SNOW_RIM)

// Accessories shared across snowman variants — glossy coal (its sky reflection
// keeps it from reading as a hole), saturated carrot, warm brown sticks.
const snowmanFace = (): Parameters<typeof placedParts>[0] => [
  [new THREE.SphereGeometry(1.5, 6, 6), [-3.5, 45, 8]],
  [new THREE.SphereGeometry(1.5, 6, 6), [3.5, 45, 8]],
  ...[-0.6, -0.3, 0, 0.3, 0.6].map((x): [THREE.BufferGeometry, Vec3] =>
    [new THREE.SphereGeometry(0.8, 6, 6), [x * 4, 39 - Math.abs(x) * 2, 9.5]]),
]
/** Coal eyes and smile (the scout has no buttons). */
export const SNOWMAN_FACE_GEO = placedParts(snowmanFace())
/** Coal eyes, smile and buttons. */
export const SNOWMAN_COAL_GEO = placedParts([
  ...snowmanFace(),
  ...[[30, 13], [25, 13.5], [20, 13]].map(([y, z]): [THREE.BufferGeometry, Vec3] => [new THREE.SphereGeometry(1, 6, 6), [0, y, z]]),
])
export const SNOWMAN_COAL_MAT = new THREE.MeshStandardMaterial({
  color: '#0c0c14',
  metalness: 0.5,
  roughness: 0.2,
  flatShading: true,
})
export const SNOWMAN_NOSE_GEO = placedParts([[new THREE.ConeGeometry(1.2, 6, 5), [0, 42, 10], [Math.PI / 2, 0, 0]]])
export const SNOWMAN_NOSE_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#ff6a00',
  emissive: '#802800',
  specular: '#ffc080',
  shininess: 30,
  flatShading: true,
}), { color: '#ffd0a0', intensity: 0.5 })
/** Stick arm with two twigs, about its shoulder pivot; `side` -1 is the left arm. */
const snowmanArm = (side: -1 | 1) => placedParts([
  [new THREE.CylinderGeometry(0.5, 0.3, 14, 4), [0, 0, 0]],
  [new THREE.CylinderGeometry(0.15, 0.1, 5, 3), [0, 4, 0], [0.3, 0, -side * 0.4]],
  [new THREE.CylinderGeometry(0.15, 0.1, 5, 3), [0, -3, 0], [-0.2, 0, side * 0.5]],
])
export const SNOWMAN_LEFT_ARM_GEO = snowmanArm(-1)
export const SNOWMAN_RIGHT_ARM_GEO = snowmanArm(1)
export const SNOWMAN_ARM_MAT = withRim(
  new THREE.MeshPhongMaterial({ color: '#6a4026', specular: '#a07050', shininess: 20, flatShading: true }),
  { color: '#ffe0c0', intensity: 0.5 },
)

// Scout: near-white body (a strongly blue one sank into the blue-violet snow); the glowing shards carry its identity.
export const SNOWMAN_SCOUT_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#eef6ff',
  emissive: '#8098c8',
  emissiveIntensity: 1.4,
  specular: '#e0f0ff',
  shininess: 45,
  flatShading: true,
}), { color: '#e4f0ff', intensity: 0.65, power: 2.2 })
export const SNOWMAN_SCOUT_CROWN_GEO = placedParts([
  [new THREE.ConeGeometry(2, 8, 4), [0, 54, 0]],
  [new THREE.ConeGeometry(2, 8, 4), [-4, 52, 0], [0, 0, 0.3]],
  [new THREE.ConeGeometry(2, 8, 4), [4, 52, 0], [0, 0, -0.3]],
  [new THREE.ConeGeometry(2, 8, 4), [-2, 53, 3], [0.2, 0.4, 0.2], [0.75, 0.75, 0.75]],
  [new THREE.ConeGeometry(2, 8, 4), [2, 53, 3], [-0.2, -0.4, -0.2], [0.75, 0.75, 0.75]],
])
export const SNOWMAN_SCOUT_SHARD_MAT = new THREE.MeshPhongMaterial({
  color: '#80d0ff',
  emissive: '#3080cc',
  emissiveIntensity: 1.5,
  flatShading: true,
  transparent: true,
  opacity: 0.8,
  toneMapped: false,
})

// Brute — navy top hat with red band, saturated red scarf
export const SNOWMAN_HAT_GEO = placedParts([
  [new THREE.CylinderGeometry(8, 8, 1.5, 8), [0, 52, 0]],
  [new THREE.CylinderGeometry(5.5, 6, 10, 8), [0, 58, 0]],
])
export const SNOWMAN_HAT_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#16205a',
  emissive: '#0a1450',
  emissiveIntensity: 0.6,
  specular: '#6070c0',
  shininess: 50,
  flatShading: true,
}), { color: '#a0b8ff', intensity: 0.6 })
/** Scarf, its trailing end and the hat band (same red). */
export const SNOWMAN_SCARF_GEO = placedParts([
  [new THREE.TorusGeometry(11, 2, 6, 12), [0, 34, 0], [Math.PI / 2, 0, 0]],
  [new THREE.BoxGeometry(2, 8, 1), [7, 30, 7], [0.4, 0.3, 0.2]],
  [new THREE.CylinderGeometry(6.1, 6.1, 1.2, 8), [0, 54, 0]],
])
export const SNOWMAN_SCARF_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#e01828',
  emissive: '#a00818',
  emissiveIntensity: 0.6,
  specular: '#ff8070',
  shininess: 25,
  flatShading: true,
}), { color: '#ffc0b0', intensity: 0.5 })

// ── Ember Wisp ────────────────────────────────────────────────
export const EMBER_WISP_CORE_GEO = new THREE.SphereGeometry(3, 8, 8)
/** Six upright flame tendrils round the core. */
export const EMBER_WISP_TENDRILS_GEO = placedParts(
  Array.from({ length: 6 }, (_, i): [THREE.BufferGeometry, Vec3, Vec3] => {
    const a = (i / 6) * Math.PI * 2
    return [new THREE.ConeGeometry(1, 4, 4), [Math.cos(a) * 3.5, Math.sin(a), Math.sin(a) * 3.5], [0, a, 0]]
  }),
)

export const EMBER_WISP_CORE_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#ff6600',
  emissive: '#ff3300',
  emissiveIntensity: 0.8,
  flatShading: true,
}), { color: '#ffd080', intensity: 1.1 })
export const EMBER_WISP_TENDRIL_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#ffaa00',
  emissive: '#ff6600',
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.7,
  flatShading: true,
}), { color: '#ffd080', intensity: 0.6 })

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
export const LAVA_GOLEM_BODY_GEO = placedParts([
  [new THREE.LatheGeometry(lavaGolemProfile, 10), [0, 0, 0]],
  [new THREE.SphereGeometry(3, 8, 6), [0, 22, 0]],
])
export const LAVA_GOLEM_CRACK_GEO = placedParts([[new THREE.LatheGeometry(lavaGolemProfile, 10), [0, 0, 0], [0, 0, 0], [1.02, 1.01, 1.02]]])
export const LAVA_GOLEM_ARM_GEO = new THREE.BoxGeometry(2, 8, 2)
export const LAVA_GOLEM_EYES_GEO = placedParts([
  [new THREE.SphereGeometry(0.8, 6, 6), [-1.5, 23, 2.5]],
  [new THREE.SphereGeometry(0.8, 6, 6), [1.5, 23, 2.5]],
])

// Ash-grey basalt (brown sat at ΔE≈6 from the terrain); a strong rim, since Inferno enemies read by their edges.
const VOLCANIC_RIM = { color: '#ffb070', intensity: 1.2, power: 2.0 }
export const LAVA_GOLEM_BODY_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#5c5450',
  specular: '#ff8844',
  shininess: 50,
  flatShading: true,
}), VOLCANIC_RIM)
export const LAVA_GOLEM_CRACK_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#ff4400',
  emissive: '#ff2200',
  emissiveIntensity: 0.6,
  flatShading: true,
}), VOLCANIC_RIM)
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
export const FIRE_IMP_HORNS_GEO = placedParts([
  [new THREE.ConeGeometry(0.6, 3, 4), [-1.5, 9, 1], [0.3, 0, -0.2]],
  [new THREE.ConeGeometry(0.6, 3, 4), [1.5, 9, 1], [0.3, 0, 0.2]],
])
export const FIRE_IMP_TAIL_GEO = new THREE.CylinderGeometry(0.3, 0.15, 6, 4)
export const FIRE_IMP_TAIL_SPIKE_GEO = new THREE.ConeGeometry(0.5, 1.5, 4)
export const FIRE_IMP_EYES_GEO = placedParts([
  [new THREE.SphereGeometry(0.5, 6, 6), [-1, 7, 2.8]],
  [new THREE.SphereGeometry(0.5, 6, 6), [1, 7, 2.8]],
])

// Orange imp (VISION) with bone horns; the old maroon/near-black read as terrain
export const FIRE_IMP_BODY_MAT = withRim(new THREE.MeshPhysicalMaterial({
  color: '#e0561c',
  metalness: 0.2,
  roughness: 0.5,
  iridescence: 0.3,
  iridescenceIOR: 1.3,
  flatShading: true,
}), VOLCANIC_RIM)
export const FIRE_IMP_HORN_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#e8d8b0',
  specular: '#ffffff',
  shininess: 40,
  flatShading: true,
}), VOLCANIC_RIM)
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

// Crimson drake with bone spikes (old #2a0a0a body was ΔE≈7 from obsidian terrain)
export const DRAKE_BODY_MAT = withRim(new THREE.MeshPhysicalMaterial({
  color: '#7a1020',
  metalness: 0.3,
  roughness: 0.4,
  iridescence: 0.5,
  iridescenceIOR: 1.4,
  iridescenceThicknessRange: [200, 500],
  flatShading: true,
}), VOLCANIC_RIM)
export const DRAKE_WING_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#660000',
  emissive: '#ff2200',
  emissiveIntensity: 0.3,
  transparent: true,
  opacity: 0.75,
  flatShading: true,
  side: THREE.DoubleSide,
}), VOLCANIC_RIM)
export const DRAKE_SPIKE_MAT = withRim(new THREE.MeshPhongMaterial({
  color: '#d8c8a8',
  specular: '#ffffff',
  shininess: 40,
  flatShading: true,
}), VOLCANIC_RIM)
export const DRAKE_EYE_MAT = new THREE.MeshStandardMaterial({
  color: '#ff4400',
  emissive: '#ff2200',
  emissiveIntensity: 2,
  toneMapped: false,
})

// ── Climber (#453), built to docs/art/ENEMIES.md ──
// Faces +z (the wall), so the ride sees its back; one material, four moving parts parted at the shoulders and hips.
// A bystander (#518), so dressed friendly and in no enemy's colours: calm teal and white, a green harness, and the
// green friend marker over its helmet.

const CLIMBER_SHIRT = '#1fa898'
const CLIMBER_TROUSERS = '#d8e2e2'
const CLIMBER_SKIN = '#e2b48c'
const CLIMBER_HELMET = '#f4f7f6'
const CLIMBER_HARNESS = '#3ccf7c'
const CLIMBER_CHALK = '#f4f4f0'
const CLIMBER_DARK = '#1c1d24'
const CLIMBER_METAL = '#b8bcc8'

export const CLIMBER_SHOULDER: [number, number, number] = [0.95, 1.05, 0]
export const CLIMBER_HIP: [number, number, number] = [0, -1.05, 0]

/** Lighter on top, darker underneath: the brief's gradient, from each vertex's normal. */
function sunShaded(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.attributes.normal
  const c = g.attributes.color
  for (let i = 0; i < c.count; i++) {
    const k = 0.8 + 0.22 * n.getY(i)
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k)
  }
  return g
}

// Low-poly by budget: 700 triangles in all (the brief's cap), so bands are open cylinders and hands, eyes few-sided.
const capsule = (r: number, length: number, sides = 5) => new THREE.CapsuleGeometry(r, length, 1, sides)
const band = (r: number, height: number, sides = 8) => new THREE.CylinderGeometry(r, r, height, sides, 1, true)

export const CLIMBER_BODY_GEO = sunShaded(mergePainted([
  paintedAt(capsule(0.82, 0.9, 6), CLIMBER_SHIRT, pose([0, 0.2, 0], [0, 0, 0], [1, 1, 0.8])),
  paintedAt(new THREE.SphereGeometry(0.8, 6, 3), CLIMBER_TROUSERS, pose([0, -0.85, 0], [0, 0, 0], [1.05, 0.7, 0.85])),
  paintedAt(band(0.86, 0.32), CLIMBER_HARNESS, pose([0, -0.62, 0], [0, 0, 0], [1, 1, 0.82])),
  ...[-1, 1].map((s) => painted(new THREE.BoxGeometry(0.16, 0.5, 0.12), CLIMBER_METAL, [s * 0.86, -0.95, 0.12], [0, 0, s * 0.2])),
  painted(new THREE.SphereGeometry(1.1, 8, 5), CLIMBER_SKIN, [0, 2.1, 0]),
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.14, 4, 2), CLIMBER_DARK, [s * 0.38, 2.05, 1.03])),
  paintedAt(new THREE.SphereGeometry(1.24, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.52), CLIMBER_HELMET, pose([0, 2.25, -0.06])),
  painted(new THREE.BoxGeometry(0.3, 0.1, 1.2), CLIMBER_DARK, [0, 3.45, -0.15], [0.1, 0, 0]),
  painted(new THREE.CylinderGeometry(0.5, 0.42, 0.72, 6), CLIMBER_CHALK, [0, -0.42, -0.8]),
  painted(band(0.52, 0.12, 6), CLIMBER_HARNESS, [0, -0.1, -0.8]),
]))

/** Hangs from the shoulder (its origin) along -y; the same arm on either side. */
export const CLIMBER_ARM_GEO = sunShaded(mergePainted([
  painted(band(0.38, 0.7, 6), CLIMBER_SHIRT, [0, -0.25, 0]),
  painted(capsule(0.3, 1.2), CLIMBER_SKIN, [0, -1.05, 0]),
  painted(new THREE.SphereGeometry(0.42, 5, 3), CLIMBER_SKIN, [0, -1.95, 0]),
]))

/** Both legs from the hips (its origin). */
export const CLIMBER_LEGS_GEO = sunShaded(mergePainted(
  [-1, 1].flatMap((s) => {
    const hip = pose([s * 0.42, 0, 0], [0, 0, s * 0.55])
    const knee = new THREE.Vector3(0, -1.3, 0).applyMatrix4(hip)
    return [
      paintedAt(capsule(0.36, 0.9), CLIMBER_TROUSERS, hip.clone().multiply(pose([0, -0.65, 0]))),
      paintedAt(band(0.4, 0.16, 6), CLIMBER_HARNESS, hip.clone().multiply(pose([0, -0.3, 0]))),
      painted(new THREE.CapsuleGeometry(0.32, 0.8, 1, 4), CLIMBER_TROUSERS, [knee.x, knee.y - 0.55, knee.z]),
      painted(new THREE.BoxGeometry(0.55, 0.38, 0.85), CLIMBER_DARK, [knee.x, knee.y - 1.25, knee.z + 0.15]),
    ]
  }),
))

export const CLIMBER_MAT = withRim(new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.5,
  metalness: 0.05,
  flatShading: true,
}), { color: '#fff4e6', intensity: 0.5, power: 2.5 })

/** The friend marker: a down-pointing chevron over the helmet, in its plane facing the ride (local −z). */
export const CLIMBER_MARKER_Y = 5.2
export const CLIMBER_MARKER_GEO = (() => {
  const s = new THREE.Shape()
  s.moveTo(-1.2, 0.7)
  s.lineTo(-0.75, 0.7)
  s.lineTo(0, -0.05)
  s.lineTo(0.75, 0.7)
  s.lineTo(1.2, 0.7)
  s.lineTo(0, -0.7)
  s.closePath()
  return new THREE.ShapeGeometry(s)
})()

/** Unlit and bright, so it reads (and blooms a little) at a few pixels against any wall. */
export const CLIMBER_MARKER_MAT = new THREE.MeshBasicMaterial({ color: '#5dffa8', side: THREE.DoubleSide })

// ── New York rat (#515), built to docs/art/ENEMIES.md ──
// Faces +z; one material, three moving parts: the body, the snout (nose twitch) about RAT_SNOUT_PIVOT, the tail
// (swish) about RAT_TAIL_PIVOT. 600-triangle cap.

const RAT_FUR = '#6b6058'
const RAT_BELLY = '#a39589'
const RAT_PINK = '#f2a0a8'
const RAT_EYE = '#111014'
const RAT_GLINT = '#ffffff'
const RAT_WHISKER = '#ece6dc'

export const RAT_SNOUT_PIVOT: Vec3 = [0, 1.3, 2.75]
export const RAT_TAIL_PIVOT: Vec3 = [0, 0.95, -1.85]

export const RAT_BODY_GEO = sunShaded(mergePainted([
  paintedAt(new THREE.SphereGeometry(1, 8, 5), RAT_FUR, pose([0, 1.05, 0], [0, 0, 0], [1.05, 0.95, 2])),
  paintedAt(new THREE.SphereGeometry(1, 6, 4), RAT_BELLY, pose([0, 0.72, 0.1], [0, 0, 0], [0.9, 0.55, 1.7])),
  paintedAt(new THREE.SphereGeometry(0.85, 8, 5), RAT_FUR, pose([0, 1.35, 2.05], [0, 0, 0], [1, 0.9, 1.2])),
  // Big round ears, pink faces to the front.
  ...[-1, 1].map((s) => paintedAt(new THREE.SphereGeometry(0.6, 8, 3), RAT_PINK, pose([s * 0.62, 2.2, 1.8], [0, s * 0.35, s * 0.3], [1, 1, 0.3]))),
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.17, 5, 3), RAT_EYE, [s * 0.4, 1.62, 2.72])),
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.06, 4, 2), RAT_GLINT, [s * 0.44, 1.7, 2.86])),
  // Little hands in front, long feet behind.
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.24, 4, 3), RAT_PINK, [s * 0.55, 0.22, 1.45])),
  ...[-1, 1].map((s) => paintedAt(new THREE.SphereGeometry(0.26, 4, 3), RAT_PINK, pose([s * 0.65, 0.22, -0.95], [0, 0, 0], [1, 0.8, 1.7]))),
]))

/** Muzzle, pink nose and whiskers, about RAT_SNOUT_PIVOT (the front of the head). */
export const RAT_SNOUT_GEO = sunShaded(mergePainted([
  painted(new THREE.ConeGeometry(0.46, 1.05, 6), RAT_FUR, [0, -0.05, 0.4], [Math.PI / 2, 0, 0]),
  painted(new THREE.SphereGeometry(0.2, 5, 3), RAT_PINK, [0, -0.02, 0.95]),
  ...[-1, 1].flatMap((s) => [-0.18, 0, 0.18].map((tilt) =>
    painted(new THREE.BoxGeometry(1.1, 0.035, 0.035), RAT_WHISKER, [s * 0.6, -0.08, 0.62], [0, s * 0.25, s * tilt]))),
]))

/** A long tapered pink tail from RAT_TAIL_PIVOT back along -z, curling up at the tip. */
export const RAT_TAIL_GEO = (() => {
  const length = 4.6
  const tail = new THREE.CylinderGeometry(0.06, 0.2, length, 5, 4, true).rotateX(-Math.PI / 2).translate(0, 0, -length / 2)
  const p = tail.attributes.position
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i)
    p.setY(i, p.getY(i) - 0.1 * z + 0.04 * z * z)
  }
  tail.computeVertexNormals()
  return sunShaded(mergePainted([painted(tail, RAT_PINK)]))
})()

export const RAT_MAT = withRim(new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.6,
  metalness: 0,
  flatShading: true,
}), { color: '#fff0e8', intensity: 0.5, power: 2.5 })

// ── Dust bunny (#515), built to docs/art/ENEMIES.md ──
// A ball centred on its origin, eyes on +z. Two draw calls: the fluff (rolls) and the eyes (stay facing forward).
// 500-triangle cap.

const DUST_GREY = '#9a968e'
const DUST_CORE = '#85817a'
const DUST_LIGHT = '#aaa69e'
const DUST_DARK = '#6a665f'
const DUST_CHALK = '#f6f5f0'
const DUST_TAPE = '#f2c84b'

export const DUST_BUNNY_RADIUS = 2.4

/** `n` points spread evenly over the unit sphere (a Fibonacci spiral). */
function sphereDirections(n: number): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const a = i * Math.PI * (3 - Math.sqrt(5))
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
  })
}

const _up = new THREE.Vector3(0, 1, 0)
/** A part at `distance` along unit `dir`, its +y turned to point along `dir`. */
function alongDir(dir: THREE.Vector3, distance: number): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir)
  return new THREE.Matrix4().compose(dir.clone().multiplyScalar(distance), q, new THREE.Vector3(1, 1, 1))
}

export const DUST_BUNNY_BODY_GEO = sunShaded(mergePainted([
  painted(new THREE.IcosahedronGeometry(DUST_BUNNY_RADIUS, 1), DUST_CORE),
  // Faceted fluff tufts all over.
  ...sphereDirections(18).map((d, i) =>
    paintedAt(new THREE.ConeGeometry(0.95, 0.9, 5), [DUST_GREY, DUST_CORE, DUST_LIGHT][i % 3], alongDir(d, DUST_BUNNY_RADIUS + 0.05))),
  // White chalk flecks caught in it.
  ...sphereDirections(8).map((d) =>
    paintedAt(new THREE.OctahedronGeometry(0.22), DUST_CHALK, alongDir(d.applyAxisAngle(_up, 0.9), DUST_BUNNY_RADIUS + 0.05))),
  // Stray hairs.
  ...[[0.3, 0.9, -0.3], [-0.7, 0.4, -0.6], [0.8, -0.2, -0.5], [-0.2, -0.5, -0.8]].map(([x, y, z]) =>
    paintedAt(new THREE.BoxGeometry(0.05, 1.6, 0.05), DUST_DARK, alongDir(new THREE.Vector3(x, y, z).normalize(), DUST_BUNNY_RADIUS + 0.7))),
  // A lost scrap of hold tape.
  paintedAt(new THREE.BoxGeometry(1.1, 0.06, 0.5), DUST_TAPE, alongDir(new THREE.Vector3(-0.6, 0.6, 0.5).normalize(), DUST_BUNNY_RADIUS + 0.12)),
]))

/** Two black dot eyes with a glint, on the front of the ball. */
export const DUST_BUNNY_EYES_GEO = mergePainted([
  ...[-1, 1].map((s) => paintedAt(new THREE.SphereGeometry(0.42, 6, 4), RAT_EYE, pose([s * 0.8, 0.55, DUST_BUNNY_RADIUS + 0.2], [0, 0, 0], [1, 1.15, 0.6]))),
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.12, 4, 2), RAT_GLINT, [s * 0.8 + 0.14, 0.75, DUST_BUNNY_RADIUS + 0.45])),
])

export const DUST_BUNNY_MAT = withRim(new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  metalness: 0,
  flatShading: true,
}), { color: '#e8e4dc', intensity: 0.35, power: 2.2 })

export const DUST_BUNNY_EYE_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.15,
  metalness: 0.1,
})

// ── Hit flash (shared by every enemy) ───────────────────────────────
// On hit, EnemyBase swaps each mesh's material to this one for the kill-pop
// window instead of cloning materials per enemy. Colour > 1 so it blooms.
export const ENEMY_HIT_FLASH_MAT = new THREE.MeshBasicMaterial({
  color: new THREE.Color(2.2, 2.2, 2.2),
  toneMapped: false,
  fog: false,
})
