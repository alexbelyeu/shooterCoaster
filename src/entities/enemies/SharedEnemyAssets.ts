import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { flipWinding, mergePainted, painted, paintedAt, paintedPolygon, pose } from '@/levels/environments/shared/paintedParts'
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

// ── Crow: merged feathers (body, beak, feet, tail fan, wings) + eyes ─
// Brief: docs/art/ENEMIES.md (#462). Local axes: +z beak, +y up, +x right wing.

const CROW_BODY = new THREE.Color('#15131a')
const CROW_SHEEN = new THREE.Color('#3a2a55')
const CROW_TIP = new THREE.Color('#0b0a0f')
const CROW_BEAK = '#e8862a'
const _feather = new THREE.Color()

/** Wing-top sheen fading to black at `t` (0 at the shoulder, 1 at the tip). */
function crowSheen(t: number): THREE.Color {
  return _feather.copy(CROW_SHEEN).lerp(CROW_TIP, Math.min(1, Math.max(0, t)) ** 1.3)
}

/** A flat plate `thick` deep in y from any simple polygon `outline` of [x, z] corners (notches and fingers too). */
function featherPlate(
  outline: readonly (readonly [number, number])[],
  thick: number,
  top: (x: number, z: number) => THREE.Color,
  under: THREE.Color,
): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const h = thick / 2
  const at = ([i, up]: Corner) => new THREE.Vector3(outline[i][0], up ? h : -h, outline[i][1])
  // Wound to face `outward`: triangulateShape's winding depends on the outline's.
  const tri = (a: Corner, b: Corner, c: Corner, outward: THREE.Vector3) => {
    const pa = at(a)
    const n = at(b).sub(pa).cross(at(c).sub(pa))
    for (const k of n.dot(outward) >= 0 ? [a, b, c] : [a, c, b]) {
      const [x, z] = outline[k[0]]
      pos.push(x, k[1] ? h : -h, z)
      const colour = k[1] ? top(x, z) : under
      col.push(colour.r, colour.g, colour.b)
    }
  }
  const up = new THREE.Vector3(0, 1, 0)
  const down = new THREE.Vector3(0, -1, 0)
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(outline.map(([x, z]) => new THREE.Vector2(x, z)), [])) {
    tri([a, true], [b, true], [c, true], up)
    tri([a, false], [b, false], [c, false], down)
  }
  let area = 0
  outline.forEach(([x0, z0], i) => {
    const [x1, z1] = outline[(i + 1) % outline.length]
    area += x0 * z1 - x1 * z0
  })
  const turn = Math.sign(area)
  outline.forEach(([x0, z0], i) => {
    const j = (i + 1) % outline.length
    const [x1, z1] = outline[j]
    const out = new THREE.Vector3((z1 - z0) * turn, 0, -(x1 - x0) * turn)
    tri([i, true], [j, true], [j, false], out)
    tri([i, true], [j, false], [i, false], out)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}
type Corner = [index: number, top: boolean]

// Body and head in one lathe, (radius, z) from the tail to the forehead: a tapered wedge with a raven's head.
const CROW_BODY_PROFILE = [
  [0, -3.2], [0.7, -2.6], [1.3, -1.4], [1.8, 0], [1.85, 1.2], [1.45, 2.6],
  [1.15, 3.4], [1.3, 4.2], [1.1, 5], [0.55, 5.6], [0, 5.8],
].map(([r, z]) => new THREE.Vector2(r, z))

/** Right shoulder pivot and the wrist's x offset from it (the left wing mirrors x). */
const CROW_SHOULDER: [number, number, number] = [1.3, 0.55, 0.7]
const CROW_ELBOW_X = 5
const CROW_SPAN = CROW_ELBOW_X + 6.7

// Arm: broad, its trailing edge scalloped by the secondaries; [x, z] from the shoulder.
const CROW_ARM: [number, number][] = [
  [0, 1.5], [2.4, 1.75], [5, 1.35], [5, -1.6], [4.3, -2.3], [3.6, -1.95], [2.8, -2.45],
  [2, -2.05], [1.2, -2.45], [0.3, -2], [0, -1.4],
]
// Hand: four splayed primaries, a raven's fingered tip; [x, z] from the wrist, tucked under the arm so the bent wrist shows no gap.
const CROW_HAND: [number, number][] = [
  [-0.3, 1.35], [2.6, 1.2], [4.9, 0.6], [6.7, -0.1], [5.6, -0.45], [6.3, -1], [5.1, -1.05],
  [5.5, -1.75], [4.3, -1.6], [4.4, -2.3], [3.2, -1.9], [1.6, -1.9], [-0.3, -1.6],
]
// Tail fan: a raven's wedge, the middle feather longest, notched between feathers; [x, z] from the rump.
const CROW_TAIL: [number, number][] = [
  [0.45, 0.3],
  ...Array.from({ length: 9 }, (_, k): [number, number] => {
    const i = 4 - k
    const a = i * 0.1375
    const r = i % 2 === 0 ? 3.8 - Math.abs(a) * 1.2 : 3.2 - Math.abs(a)
    return [Math.sin(a) * r, -Math.cos(a) * r]
  }),
  [-0.45, 0.3],
]

/** `aWing` drives the flap shader: 0 body, ±1 arm, ±2 hand (+ = right). */
function wingTagged(g: THREE.BufferGeometry, tag: number): THREE.BufferGeometry {
  g.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(tag), 1))
  return g
}

function crowWing(side: 1 | -1): THREE.BufferGeometry[] {
  const [sx, sy, sz] = CROW_SHOULDER
  const mirror = (o: [number, number][]) => o.map(([x, z]) => [side * x, z] as const)
  const arm = featherPlate(mirror(CROW_ARM), 0.3, (x) => crowSheen(Math.abs(x) / CROW_SPAN), CROW_BODY)
  const hand = featherPlate(
    mirror(CROW_HAND), 0.18, (x) => crowSheen((CROW_ELBOW_X + Math.abs(x)) / CROW_SPAN), CROW_BODY,
  )
  return [
    wingTagged(arm.translate(side * sx, sy, sz), side),
    wingTagged(hand.translate(side * (sx + CROW_ELBOW_X), sy, sz), side * 2),
  ]
}

export const CROW_GEO = mergePainted([
  paintedAt(new THREE.LatheGeometry(CROW_BODY_PROFILE, 8), CROW_BODY, pose([0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.85])),
  // Beak: a hooked upper mandible over a shorter lower one.
  painted(new THREE.ConeGeometry(0.55, 2.4, 4), CROW_BEAK, [0, 0.35, 6.6], [Math.PI / 2 + 0.12, 0, 0]),
  painted(new THREE.ConeGeometry(0.22, 0.75, 4), CROW_BEAK, [0, 0.05, 7.6], [Math.PI + 0.35, 0, 0]),
  painted(new THREE.ConeGeometry(0.4, 1.8, 4), CROW_BEAK, [0, -0.2, 6.3], [Math.PI / 2 + 0.25, 0, 0]),
  // Feet tucked under the belly, toes back.
  ...[1, -1].map((side) =>
    painted(new THREE.ConeGeometry(0.28, 1.2, 4), CROW_BEAK, [side * 0.55, -1.35, -1.6], [-Math.PI / 2, 0, 0])),
  featherPlate(CROW_TAIL, 0.18, (_x, z) => crowSheen(0.25 - z / 5), CROW_BODY).rotateX(0.1).translate(0, 0.15, -2.4),
].map((g) => wingTagged(g, 0)).concat(crowWing(1), crowWing(-1)))

// Eyes: a gold iris, a black pupil and a white glint each; unlit, so they read in any light.
export const CROW_EYES_GEO = mergePainted([1, -1].flatMap((side) => {
  const eye = new THREE.Vector3(side * 1.05, 0.5, 4.6)
  const on = (dir: [number, number, number], r: number): [number, number, number] =>
    eye.clone().addScaledVector(new THREE.Vector3(side * dir[0], dir[1], dir[2]).normalize(), r).toArray()
  return [
    painted(new THREE.SphereGeometry(0.36, 6, 4), new THREE.Color('#ffd166').multiplyScalar(1.6), eye.toArray()),
    painted(new THREE.SphereGeometry(0.2, 5, 3), '#050406', on([0.8, 0.15, 0.55], 0.24)),
    painted(new THREE.SphereGeometry(0.09, 4, 2), new THREE.Color(3, 3, 3), on([0.6, 0.6, 0.55], 0.36)),
  ]
}))

const CROW_WING_PARS = /* glsl */ `
attribute float aWing;
uniform vec2 uWingFlap;
`

// Hand about the wrist, then the whole wing about the shoulder; flat shading
// takes normals from screen derivatives, so only positions move.
const CROW_WING_FLAP = /* glsl */ `
{
  float side = sign(aWing);
  if (side != 0.0) {
    vec3 shoulder = vec3(side * ${CROW_SHOULDER[0].toFixed(2)}, ${CROW_SHOULDER[1].toFixed(2)}, ${CROW_SHOULDER[2].toFixed(2)});
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

export function patchCrowWingVertex(vertexShader: string): string {
  return vertexShader
    .replace('#include <common>', `#include <common>\n${CROW_WING_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CROW_WING_FLAP}`)
}

/** Wing angles (arm, hand; radians, + = down): a quick downstroke, and the hand lagging so the wrist bends. */
export function crowWingPose(phase: number, out: THREE.Vector2): THREE.Vector2 {
  const p = phase + 0.5 * Math.sin(phase)
  return out.set(0.05 + 0.6 * Math.sin(p), 0.5 * Math.sin(p - 0.9))
}

/** Flaps `material`'s crow wings by `flap`; every material built the same way shares one program. */
function withCrowWings<T extends THREE.Material>(material: T, flap: { value: THREE.Vector2 }): T {
  const base = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer)
    shader.uniforms.uWingFlap = flap
    shader.vertexShader = patchCrowWingVertex(shader.vertexShader)
  }
  material.customProgramCacheKey = () => `${baseKey}-crow-wing`
  return material
}

// Violet-black on the pale sky + a blue-grey rim sheen so crows
// also read against the hazy horizon and the red mesas.
const CROW_RIM = { color: '#a8bce0', intensity: 0.4, power: 3.5 }

/** One crow's feathers, flapping by `flap` (arm, hand radians); every instance shares one program. */
export function createCrowFeatherMaterial(flap: { value: THREE.Vector2 }): THREE.MeshPhysicalMaterial {
  return withCrowWings(withRim(new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.1,
    roughness: 0.7,
    iridescence: 0.3,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [200, 400],
    flatShading: true,
  }), CROW_RIM), flap)
}

/** Only for ShaderWarmup: crows build their own instances. */
export const CROW_FEATHER_MAT = createCrowFeatherMaterial({ value: new THREE.Vector2() })

export const CROW_EYE_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })

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

/** A closed mesh from hand-placed `vertices` and triangle `indices`. */
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

const CLIMBER_SHIRT = '#3a3f8f'
const CLIMBER_TROUSERS = '#2c2f3a'
const CLIMBER_SKIN = '#e2b48c'
const CLIMBER_HELMET = '#ff7a1a'
const CLIMBER_HARNESS = '#19c8e0'
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

// ── Spotted lanternfly (#516), built to docs/art/ENEMIES.md ──
// Lies on a wall: head along +y, its back out of the wall along +z. One material, five moving parts: the body and each
// side's forewing and hindwing, every wing about its own shoulder (LANTERNFLY_FOREWING_PIVOT / _HINDWING_PIVOT, x
// mirrored for the left), built for the right side (+x) back along -y in its own xy plane. 500-triangle cap.

const LANTERNFLY_BODY = '#1d1a1a'
const LANTERNFLY_LEG = '#2a2522'
const LANTERNFLY_ANTENNA = '#8a2a22'
const LANTERNFLY_FOREWING = '#c9b8a0'
const LANTERNFLY_WINGTIP = '#7d756a'
const LANTERNFLY_FLECK = '#ddd3c2'
const LANTERNFLY_SPOT = '#141212'
const LANTERNFLY_RED = '#d8282a'
const LANTERNFLY_BAND = '#f2efe6'

export const LANTERNFLY_FOREWING_PIVOT: Vec3 = [0.3, 1.2, 1.1]
export const LANTERNFLY_HINDWING_PIVOT: Vec3 = [0.25, 0.9, 0.9]

type P2 = [number, number]

/** The part of a polygon above (`keep` +1) or below (-1) the line y = `y` (Sutherland–Hodgman). */
function clipY(poly: readonly P2[], y: number, keep: 1 | -1): P2[] {
  const out: P2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ina = (a[1] - y) * keep >= 0
    const inb = (b[1] - y) * keep >= 0
    if (ina) out.push(a)
    if (ina !== inb) {
      const t = (y - a[1]) / (b[1] - a[1])
      out.push([a[0] + (b[0] - a[0]) * t, y])
    }
  }
  return out
}

/** A flat plate in the xy plane at height `z`, fanned from its centroid (any star-shaped outline), facing +z. */
function wingPlate(poly: readonly P2[], color: string, z = 0): THREE.BufferGeometry {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length
  const area = poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length]
    return s + p[0] * q[1] - q[0] * p[1]
  }, 0)
  const ring = area >= 0 ? poly : [...poly].reverse()
  const corners: number[] = []
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    corners.push(cx, cy, z, p[0], p[1], z, q[0], q[1], z)
  }
  return paintedPolygon(corners, color)
}

const wingSpots = (spots: readonly [number, number, number][], color: string, z: number) =>
  spots.map(([x, y, r]) => painted(new THREE.CircleGeometry(r, 5), color, [x, y, z]))

const FOREWING: P2[] = [[-0.25, 0.1], [0.8, -0.5], [1.45, -2.6], [1.6, -4.6], [1.4, -6.3], [0.95, -7.1], [0.35, -7.2], [-0.15, -6.2], [-0.3, -3]]
const FOREWING_TIP_Y = -4.9
const HINDWING: P2[] = [[0, 0.1], [1.1, -0.2], [2.3, -1.4], [2.8, -3.2], [2.6, -4.8], [1.8, -5.7], [0.7, -5.7], [0.05, -4]]
const HINDWING_BAND: [number, number] = [-3, -3.8]

const forewingParts = () => [
  wingPlate(clipY(FOREWING, FOREWING_TIP_Y, 1), LANTERNFLY_FOREWING),
  wingPlate(clipY(FOREWING, FOREWING_TIP_Y, -1), LANTERNFLY_WINGTIP),
  ...wingSpots([[0.35, -0.8, 0.26], [0.95, -1.35, 0.24], [0.3, -2.2, 0.28], [1.05, -2.7, 0.26], [0.5, -3.4, 0.26], [1.2, -3.9, 0.22], [0.55, -4.3, 0.22]], LANTERNFLY_SPOT, 0.03),
  ...wingSpots([[0.4, -5.4, 0.12], [1.0, -5.6, 0.1], [0.7, -6.3, 0.12], [1.2, -6.4, 0.1], [0.3, -6.7, 0.1], [0.9, -6.9, 0.1]], LANTERNFLY_FLECK, 0.03),
]

const hindwingParts = () => [
  wingPlate(clipY(HINDWING, HINDWING_BAND[0], 1), LANTERNFLY_RED),
  wingPlate(clipY(clipY(HINDWING, HINDWING_BAND[0], -1), HINDWING_BAND[1], 1), LANTERNFLY_BAND),
  wingPlate(clipY(HINDWING, HINDWING_BAND[1], -1), LANTERNFLY_SPOT),
  ...wingSpots([[0.6, -0.8, 0.26], [1.45, -1.1, 0.26], [1.0, -2.0, 0.3], [2.05, -2.3, 0.26], [0.45, -2.6, 0.22]], LANTERNFLY_SPOT, 0.03),
]

const mirrorX = pose([0, 0, 0], [0, 0, 0], [-1, 1, 1])
/** The left side's: mirrored, its faces turned the right way out again. */
const mirrored = (parts: THREE.BufferGeometry[]) => mergePainted(parts.map((g) => flipWinding(g.applyMatrix4(mirrorX))))

export const LANTERNFLY_BODY_GEO = mergePainted([
  paintedAt(new THREE.SphereGeometry(1, 6, 4), LANTERNFLY_BODY, pose([0, -2.1, 0.6], [0, 0, 0], [0.8, 2.1, 0.6])),
  paintedAt(new THREE.SphereGeometry(1, 6, 4), LANTERNFLY_BODY, pose([0, 0.55, 0.7], [0, 0, 0], [0.9, 0.95, 0.65])),
  paintedAt(new THREE.SphereGeometry(0.6, 6, 3), LANTERNFLY_BODY, pose([0, 1.75, 0.6], [0, 0, 0], [1, 0.85, 0.85])),
  ...[-1, 1].map((s) => painted(new THREE.ConeGeometry(0.13, 0.9, 3), LANTERNFLY_ANTENNA, [s * 0.32, 2.45, 0.7], [0.3, 0, -s * 0.45])),
  // Three legs a side from under the thorax, splayed forward, out and back.
  ...[-1, 1].flatMap((s) => [[1.0, 0.5], [0.4, -0.1], [-0.2, -0.7]].map(([y, a]) => {
    const dx = s * Math.cos(a)
    const dy = Math.sin(a)
    return painted(new THREE.CylinderGeometry(0.07, 0.1, 1.9, 3, 1, true), LANTERNFLY_LEG, [s * 0.5 + dx * 0.95, y + dy * 0.95, 0.25], [0, 0, Math.atan2(-dx, dy)])
  })),
])

/** [right, left]. */
export const LANTERNFLY_FOREWING_GEOS = [mergePainted(forewingParts()), mirrored(forewingParts())] as const
export const LANTERNFLY_HINDWING_GEOS = [mergePainted(hindwingParts()), mirrored(hindwingParts())] as const

export const LANTERNFLY_MAT = withRim(new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.55,
  metalness: 0,
  flatShading: true,
  side: THREE.DoubleSide,
}), { color: '#fff2e0', intensity: 0.45, power: 2.5 })

// ── Hit flash (shared by every enemy) ───────────────────────────────
// On hit, EnemyBase swaps each mesh's material to this one for the kill-pop
// window instead of cloning materials per enemy. Colour > 1 so it blooms.
export const ENEMY_HIT_FLASH_MAT = new THREE.MeshBasicMaterial({
  color: new THREE.Color(2.2, 2.2, 2.2),
  toneMapped: false,
  fog: false,
})

/** The crow's hit flinch: wings snapped up (arm, hand; radians, + = down). */
export const CROW_FLINCH_POSE = new THREE.Vector2(-1.15, -0.5)
export const CROW_FLINCH_MAT = withCrowWings(ENEMY_HIT_FLASH_MAT.clone(), { value: CROW_FLINCH_POSE })
