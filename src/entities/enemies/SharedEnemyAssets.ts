import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { flipWinding, mergePainted, painted, paintedAt, paintedPolygon, placedParts, pose, sunShaded } from '@/levels/environments/shared/paintedParts'
import { withRim } from './enemyRim'
import { BALLOON_COLORS, CROW_BODY as CROW_BODY_HEX, CROW_SHEEN as CROW_SHEEN_HEX, SCORPION_BODY_COLOR, SCORPION_PINCER_COLOR, SCORPION_LEG_COLOR, JELLY_COLORS, FFISH_BODY, FFISH_BELLY, CLIMBER_SHIRT, CLIMBER_TROUSERS, RAT_FUR, RAT_BELLY, DUST_GREY, DUST_LIGHT, DUST_DARK, DUST_CHALK, LANTERNFLY_FOREWING, LANTERNFLY_RED, LANTERNFLY_BODY } from './enemyPalette'

type Vec3 = [number, number, number]

export * from './infernoEnemyAssets'
export * from './oceanEnemyAssets'

// Readability rules: every lit enemy material gets a fresnel rim via withRim() (#15), and every enemy's read
// colours keep `MIN_DELTA_E` (deuteranopia, normal vision) / `MIN_DELTA_E_PROTAN` (protanopia) from what it is seen
// against (colourVision.ts, #838). A new enemy puts its read colours in enemyPalette.ts and adds itself to
// enemyColourVision.test.ts, which fails for any enemy type it doesn't check.

// ── Balloon geometries (shared by Balloon + GoldenBalloon) ──────────
export const BALLOON_BODY_GEO = new THREE.SphereGeometry(30, 16, 16)
export const BALLOON_KNOT_GEO = new THREE.SphereGeometry(4, 8, 8)
export const BALLOON_STRING_GEO = new THREE.CylinderGeometry(0.5, 0.5, 55, 4)
/** Teardrop body + knot as one geometry: Theme Park has ~150 balloons, so draw calls add up. */
export const BALLOON_GEO = placedParts([
  [new THREE.SphereGeometry(30, 16, 12), [0, 0, 0], [0, 0, 0], [1, 1.3, 1]],
  [new THREE.SphereGeometry(4, 6, 4), [0, -35, 0]],
])

// ── Balloon materials (10 color variants) ───────────────────────────

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

const CROW_BODY = new THREE.Color(CROW_BODY_HEX)
const CROW_SHEEN = new THREE.Color(CROW_SHEEN_HEX)
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
const SCORPION_HEAD_COLOR = '#24121e'
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
export const SCORPION_TAIL_GEO = placedParts(
  ([[0, 0.5, 0], [0, 1.5, -0.3], [0, 2.8, -0.2], [0, 3.8, 0.3], [0, 4.5, 1.0]] as Vec3[]).map((at) =>
    [new THREE.SphereGeometry(0.7, 5, 5), at],
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

// ── Jellyfish: bell + glowing core ───────────────────────────────
const JELLY_TENTACLES = 5
/**
 * Bell + five hanging tentacles as one geometry: a whole Ocean wave floats in view beside
 * the track (#316), and at 7 draw calls a jellyfish broke level3's draw budget.
 */
export const JELLY_BODY_GEO = placedParts([
  [new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, 0]],
  ...Array.from({ length: JELLY_TENTACLES }, (_, i): [THREE.BufferGeometry, Vec3] => {
    const a = (i / JELLY_TENTACLES) * Math.PI * 2
    return [new THREE.CylinderGeometry(0.15, 0.08, 5, 4), [Math.cos(a) * 1.8, -3, Math.sin(a) * 1.8]]
  }),
])
export const JELLY_INNER_GEO = new THREE.SphereGeometry(1.5, 6, 6)

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

// ── Flying Fish: one painted body, two wing-fins ─────────────────

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
const ffishBody = () => new THREE.LatheGeometry(ffishBodyProfile, 8)

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
const ffishTailUpper = () => makeWingGeo(
  [
    [0, 0, 0],      [0, 1.5, -1.8],  [0, 0.3, -1],
    [0.08, 0, 0],   [0.08, 1.5, -1.8], [0.08, 0.3, -1],
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)
const ffishTailLower = () => makeWingGeo(
  [
    [0, 0, 0],       [0, -1.2, -1.5],  [0, -0.2, -0.8],
    [0.08, 0, 0],    [0.08, -1.2, -1.5], [0.08, -0.2, -0.8],
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)

// Dorsal fin — small triangular
const ffishDorsal = () => makeWingGeo(
  [
    [0, 0, 0.5],    [0, 1, -0.2],   [0, 0, -0.5],
    [0.06, 0, 0.5], [0.06, 1, -0.2], [0.06, 0, -0.5],
  ],
  [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3],
)

/**
 * Body, belly, dorsal fin, forked tail and eyes, placed as their meshes were in the fish's group and painted: one draw
 * call where they were eight (36 fish leap in the Ocean's last wave). Only the wing-fins move on their own.
 */
export const FFISH_GEO = mergePainted([
  paintedAt(ffishBody(), FFISH_BODY, pose([0, 0, -1], [Math.PI / 2, 0, 0], [1, 1, 0.7])),
  paintedAt(ffishBody(), FFISH_BELLY, pose([0, -0.4, -1], [Math.PI / 2, 0, 0], [0.8, 0.8, 0.4])),
  painted(ffishDorsal(), '#6a9cc0', [0, 1.2, 0]),
  painted(ffishTailUpper(), '#6a98c0', [0, 0, -3]),
  painted(ffishTailLower(), '#6a98c0', [0, 0, -3]),
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.3, 6, 6), '#111111', [s * 0.6, 0.4, 2])),
])

// Silver-blue with a wet sheen (VISION: flying fish read silver).
const FFISH_RIM = { color: '#f0faff', intensity: 0.65, power: 2.5 }
export const FFISH_MAT = withRim(new THREE.MeshPhongMaterial({
  vertexColors: true,
  specular: '#e0f2ff',
  shininess: 55,
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

// ── Climber (#453), built to docs/art/ENEMIES.md ──
// Faces +z (the wall), so the ride sees its back; one material, four moving parts parted at the shoulders and hips.
// A bystander (#518), so dressed friendly and in no enemy's colours: calm teal and white, a green harness, and the
// green friend marker over its helmet.

const CLIMBER_SKIN = '#e2b48c'
const CLIMBER_HELMET = '#f4f7f6'
const CLIMBER_HARNESS = '#3ccf7c'
const CLIMBER_CHALK = '#f4f4f0'
const CLIMBER_DARK = '#1c1d24'
const CLIMBER_METAL = '#b8bcc8'

export const CLIMBER_SHOULDER: [number, number, number] = [0.95, 1.05, 0]
export const CLIMBER_HIP: [number, number, number] = [0, -1.05, 0]

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

const DUST_CORE = '#a4a099'
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
  // Stray hairs: short, since the fluff rolls and the longest part sets how high it floats (#524).
  ...[[0.3, 0.9, -0.3], [-0.7, 0.4, -0.6], [0.8, -0.2, -0.5], [-0.2, -0.5, -0.8]].map(([x, y, z]) =>
    paintedAt(new THREE.BoxGeometry(0.05, 1.1, 0.05), DUST_DARK, alongDir(new THREE.Vector3(x, y, z).normalize(), DUST_BUNNY_RADIUS + 0.45))),
  // A lost scrap of hold tape.
  paintedAt(new THREE.BoxGeometry(1.1, 0.06, 0.5), DUST_TAPE, alongDir(new THREE.Vector3(-0.6, 0.6, 0.5).normalize(), DUST_BUNNY_RADIUS + 0.12)),
]))

/** The fluff's farthest point from its centre, model units: the stray hairs' tips. It rolls, so any of it can point down. */
export const DUST_BUNNY_REACH = (() => {
  const p = DUST_BUNNY_BODY_GEO.attributes.position
  let reach = 0
  for (let i = 0; i < p.count; i++) reach = Math.max(reach, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)))
  return reach
})()

/** Two black dot eyes with a glint, on the front of the ball. */
const DUST_BUNNY_EYES_GEO = mergePainted([
  ...[-1, 1].map((s) => paintedAt(new THREE.SphereGeometry(0.42, 6, 4), RAT_EYE, pose([s * 0.8, 0.55, DUST_BUNNY_RADIUS + 0.2], [0, 0, 0], [1, 1.15, 0.6]))),
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.12, 4, 2), RAT_GLINT, [s * 0.8 + 0.14, 0.75, DUST_BUNNY_RADIUS + 0.45])),
])

/**
 * The fluff and the eyes in one mesh, one draw call (#806: a dust bunny wave fills the screen). The fluff rolls about
 * x by two relative morph targets, (0, y, z) and (0, -z, y) weighted cos(roll) - 1 and sin(roll) (`dustBunnyRoll`);
 * the eyes have none, so they stay on its front. `aGloss` marks the eyes, which `DUST_BUNNY_MAT` keeps glossy.
 */
export const DUST_BUNNY_GEO = (() => {
  const g = mergeGeometries([DUST_BUNNY_BODY_GEO, DUST_BUNNY_EYES_GEO])
  const fluff = DUST_BUNNY_BODY_GEO.attributes.position
  const count = g.attributes.position.count
  const toward = new Float32Array(count * 3)
  const across = new Float32Array(count * 3)
  for (let i = 0; i < fluff.count; i++) {
    const y = fluff.getY(i)
    const z = fluff.getZ(i)
    toward[i * 3 + 1] = y
    toward[i * 3 + 2] = z
    across[i * 3 + 1] = -z
    across[i * 3 + 2] = y
  }
  g.morphAttributes.position = [new THREE.BufferAttribute(toward, 3), new THREE.BufferAttribute(across, 3)]
  g.morphTargetsRelative = true
  g.setAttribute('aGloss', new THREE.BufferAttribute(new Float32Array(count).fill(1, fluff.count), 1))
  // The roll keeps every point's distance from the centre, so this sphere holds it at any angle.
  const p = g.attributes.position
  let reach = 0
  for (let i = 0; i < count; i++) reach = Math.max(reach, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), reach)
  DUST_BUNNY_EYES_GEO.dispose()
  return g
})()

/** Turns a `DUST_BUNNY_GEO` mesh's fluff to `roll` about x (its morph target influences). */
export function dustBunnyRoll(influences: number[], roll: number) {
  influences[0] = Math.cos(roll) - 1
  influences[1] = Math.sin(roll)
}

const EYE_ROUGHNESS = '0.15'
const EYE_METALNESS = '0.10'

export function patchEyeGlossVertex(vertexShader: string): string {
  return vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aGloss;\nvarying float vGloss;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGloss = aGloss;')
}

export function patchEyeGlossFragment(fragmentShader: string): string {
  return fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vGloss;')
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, ${EYE_ROUGHNESS}, vGloss);`)
    .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, ${EYE_METALNESS}, vGloss);`)
}

/** Glosses `material` where the geometry's `aGloss` is 1 (the dust bunny's eyes); every material built the same way shares one program. */
function withEyeGloss<T extends THREE.Material>(material: T): T {
  const base = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer)
    shader.vertexShader = patchEyeGlossVertex(shader.vertexShader)
    shader.fragmentShader = patchEyeGlossFragment(shader.fragmentShader)
  }
  material.customProgramCacheKey = () => `${baseKey}-eye-gloss`
  return material
}

/** The fluff's matte paint, and the eyes' gloss where `aGloss` is 1. */
export const DUST_BUNNY_MAT = withEyeGloss(withRim(new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  metalness: 0,
  flatShading: true,
}), { color: '#e8e4dc', intensity: 0.35, power: 2.2 }))

// ── Spotted lanternfly (#516), built to docs/art/ENEMIES.md ──
// Lies on a wall: head along +y, its back out of the wall along +z. One mesh, one draw call (#632): the body and each
// side's forewing and hindwing, every wing about its own shoulder (LANTERNFLY_FOREWING_PIVOT / _HINDWING_PIVOT, x
// mirrored for the left), built for the right side (+x) back along -y in its own xy plane, then laid at its folded
// pose; the material's vertex shader opens the wings (`withLanternflyWings`). 500-triangle cap.

const LANTERNFLY_LEG = '#2a2522'
const LANTERNFLY_ANTENNA = '#8a2a22'
const LANTERNFLY_WINGTIP = '#7d756a'
const LANTERNFLY_FLECK = '#ddd3c2'
const LANTERNFLY_SPOT = '#141212'
const LANTERNFLY_BAND = '#f2efe6'

export const LANTERNFLY_FOREWING_PIVOT: Vec3 = [0.3, 1.2, 1.1]
export const LANTERNFLY_HINDWING_PIVOT: Vec3 = [0.25, 0.9, 0.9]
/** Each wing's swing out in the wall's plane, its roll (a tent over the back when folded) and the hindwing's fan; folded, the hindwings show a red edge past the forewings (#665). */
export const LANTERNFLY_FOLDED = { foreSwing: 0.06, foreRoll: 0.5, hindSwing: 0.25, hindRoll: 0.4, hindFan: 0.6 }
export const LANTERNFLY_OPEN = { foreSwing: 1.45, foreRoll: 0.1, hindSwing: 0.55, hindRoll: 0.05, hindFan: 1 }

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

const lanternflyBody = () => mergePainted([
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

const isHind = (tag: number) => Math.abs(tag) > 1.5
const wingPivot = (tag: number, out: THREE.Vector3) => {
  const [px, py, pz] = isHind(tag) ? LANTERNFLY_HINDWING_PIVOT : LANTERNFLY_FOREWING_PIVOT
  return out.set(Math.sign(tag) * px, py, pz)
}

/**
 * A wing built at its shoulder, tagged for the shader (±1 forewing, ±2 hindwing; + = right) and laid at its folded
 * pose: the hindwing's fan along x, then the roll and swing about its shoulder (Euler ZYX), the transform the shader undoes.
 */
function foldedWing(g: THREE.BufferGeometry, tag: number): THREE.BufferGeometry {
  const side = Math.sign(tag)
  const f = LANTERNFLY_FOLDED
  const hind = isHind(tag)
  const fold = new THREE.Matrix4().compose(
    wingPivot(tag, new THREE.Vector3()),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * (hind ? f.hindRoll : f.foreRoll), side * (hind ? f.hindSwing : f.foreSwing), 'ZYX')),
    new THREE.Vector3(hind ? f.hindFan : 1, 1, 1),
  )
  return wingTagged(g.applyMatrix4(fold), tag)
}

/** Grows the bounds (frustum culling) to every pose, not just the folded one the geometry holds: each wing's reach from its shoulder, fanned out. */
function boundEveryWingPose(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const sphere = g.boundingSphere!
  const pos = g.attributes.position
  const tag = g.attributes.aWing
  const v = new THREE.Vector3()
  const pivot = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const t = tag.getX(i)
    if (t === 0) continue
    wingPivot(t, pivot)
    const reach = v.fromBufferAttribute(pos, i).distanceTo(pivot) / (isHind(t) ? LANTERNFLY_FOLDED.hindFan : 1)
    sphere.radius = Math.max(sphere.radius, pivot.distanceTo(sphere.center) + reach)
  }
  return g
}

/** The whole bug folded, each side's hindwing under its forewing. */
export const LANTERNFLY_GEO = boundEveryWingPose(mergePainted([
  wingTagged(lanternflyBody(), 0),
  foldedWing(mergePainted(hindwingParts()), 2),
  foldedWing(mirrored(hindwingParts()), -2),
  foldedWing(mergePainted(forewingParts()), 1),
  foldedWing(mirrored(forewingParts()), -1),
]))

/** Share of its own paint each lanternfly lights on its own: on the gym's shaded walls its red read as maroon and its forewings as black (#665). */
const LANTERNFLY_SELF_LIT = 0.45

/** Adds `lift` × the vertex colour as emissive, so the paint reads in shade and the black spots stay black. */
function withSelfLit<T extends THREE.Material>(material: T, lift: number): T {
  const base = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * ${lift.toFixed(3)};`,
    )
  }
  material.customProgramCacheKey = () => `${baseKey}-self-lit`
  return material
}

const LANTERNFLY_WING_PARS = /* glsl */ `
attribute float aWing;
uniform float uLanternflyWings;
vec3 lanternflyRz(vec3 q, float a) { float c = cos(a), s = sin(a); return vec3(c * q.x - s * q.y, s * q.x + c * q.y, q.z); }
vec3 lanternflyRy(vec3 q, float a) { float c = cos(a), s = sin(a); return vec3(c * q.x + s * q.z, q.y, c * q.z - s * q.x); }
`

const glslVec3 = (v: readonly number[]) => `vec3(${v.map((n) => n.toFixed(3)).join(', ')})`
const LF_FOLDED = LANTERNFLY_FOLDED
const LF_OPEN = LANTERNFLY_OPEN

// Undoes each wing's folded pose about its shoulder (foldedWing), then lays it at the pose `uLanternflyWings` mixes
// (0 folded, 1 open). Flat shading takes normals from screen derivatives, so only positions move.
const LANTERNFLY_WING_OPEN = /* glsl */ `
{
  float side = sign(aWing);
  if (side != 0.0) {
    bool hind = abs(aWing) > 1.5;
    vec3 shoulder = (hind ? ${glslVec3(LANTERNFLY_HINDWING_PIVOT)} : ${glslVec3(LANTERNFLY_FOREWING_PIVOT)}) * vec3(side, 1.0, 1.0);
    // (swing, roll, fan)
    vec3 folded = hind ? ${glslVec3([LF_FOLDED.hindSwing, LF_FOLDED.hindRoll, LF_FOLDED.hindFan])} : ${glslVec3([LF_FOLDED.foreSwing, LF_FOLDED.foreRoll, 1])};
    vec3 open = hind ? ${glslVec3([LF_OPEN.hindSwing, LF_OPEN.hindRoll, LF_OPEN.hindFan])} : ${glslVec3([LF_OPEN.foreSwing, LF_OPEN.foreRoll, 1])};
    vec3 p = mix(folded, open, uLanternflyWings);
    vec3 q = lanternflyRy(lanternflyRz(transformed - shoulder, -side * folded.x), -side * folded.y);
    q.x *= p.z / folded.z;
    transformed = shoulder + lanternflyRz(lanternflyRy(q, side * p.y), side * p.x);
  }
}
`

export function patchLanternflyWingVertex(vertexShader: string): string {
  return vertexShader
    .replace('#include <common>', `#include <common>\n${LANTERNFLY_WING_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${LANTERNFLY_WING_OPEN}`)
}

/** Opens `material`'s lanternfly wings by `wings` (0 folded, 1 open); every material built the same way shares one program. */
function withLanternflyWings<T extends THREE.Material>(material: T, wings: { value: number }): T {
  const base = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer)
    shader.uniforms.uLanternflyWings = wings
    shader.vertexShader = patchLanternflyWingVertex(shader.vertexShader)
  }
  material.customProgramCacheKey = () => `${baseKey}-lanternfly-wings`
  return material
}

/** One lanternfly's paint, its wings opened by `wings`; every instance shares one program. */
export function createLanternflyMaterial(wings: { value: number }): THREE.MeshStandardMaterial {
  return withLanternflyWings(withSelfLit(withRim(new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  }), { color: '#fff2e0', intensity: 0.45, power: 2.5 }), LANTERNFLY_SELF_LIT), wings)
}

/** Only for ShaderWarmup: lanternflies build their own instances. */
export const LANTERNFLY_MAT = createLanternflyMaterial({ value: 0 })

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

/** A lanternfly's hit flash, its wings held where `wings` has them. */
export const createLanternflyFlashMaterial = (wings: { value: number }) => withLanternflyWings(ENEMY_HIT_FLASH_MAT.clone(), wings)
/** Only for ShaderWarmup, like LANTERNFLY_MAT. */
export const LANTERNFLY_FLASH_MAT = createLanternflyFlashMaterial({ value: 0 })
