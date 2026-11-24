import * as THREE from 'three'
import { flipWinding, mergePainted, painted, paintedAt, paintedPolygon, pose, sunShaded } from '@/levels/environments/shared/paintedParts'
import { bent, darkUnder, grin, recolor } from './enemyPaint'
import { withRim } from './enemyRim'
import { IMP_ORANGE, IMP_DARK, OBSIDIAN as OBSIDIAN_HEX, LAVA, LAVA_HOT, DRAKE_CHARCOAL, DRAKE_MEMBRANE, DRAKE_GLOW, WISP_EMBER, WISP_FLAME, WISP_WHITE, WISP_RIM, WISP_RIBBON_ROOT, WISP_RIBBON_TIP } from './enemyPalette'

// Inferno's enemies as characters (#463, #813, briefs in docs/art/ENEMIES.md): the Ember Wisp, the Fire
// Imp, the Lava Golem and the Infernal Drake. Every part is vertex-painted and merged per moving part; +z faces the
// rider (the drake's snout, where it flies), +y is up. Re-exported by SharedEnemyAssets, so ShaderWarmup compiles every material here.

type Vec3 = [number, number, number]

/** Hash of a point to [0, 1): per-triangle jitter that is the same on every load. */
function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}

/** Chains a fragment patch after `material`'s rim, with its own uniforms and program key. */
function withEmissivePatch<T extends THREE.Material>(
  material: T,
  key: string,
  uniforms: Record<string, THREE.IUniform>,
  pars: string,
  apply: string,
): T {
  const base = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${pars}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${apply}`)
  }
  material.customProgramCacheKey = () => `${baseKey}-${key}`
  return material
}

// ── Ember Wisp: a flame teardrop with coal eyes + three trailing ribbon flames ──
// The core is lit by its own heat: vertex colour r is the heat (white-hot low and in front, cooling to the tip),
// g masks the flame (0 on the coal eyes); the shader ramps heat × facing through white → #ff8a2a → #a01010.

const WISP_TEARDROP = [
  [0, -3.2], [1.9, -2.6], [2.9, -1.2], [2.9, 0.6], [2.2, 2.2], [1.3, 3.6], [0.5, 4.7], [0, 5.6],
].map(([r, y]) => new THREE.Vector2(r, y))

/** The ribbons' root, at the back of the teardrop's tip: their pivot. */
export const EMBER_WISP_RIBBON_ROOT: Vec3 = [0, 3.2, -1]

export const EMBER_WISP_CORE_GEO = mergePainted([
  recolor(
    // The tip curls back, so the teardrop reads as a flame leaning into its drift.
    paintedAt(bent(new THREE.LatheGeometry(WISP_TEARDROP, 8), (h) => [0, -0.05 * Math.max(0, h - 3) ** 2]), '#ffffff', pose([0, 0, 0])),
    (_x, y, z, c) => c.setRGB(THREE.MathUtils.clamp(0.95 - (y + 3.2) / 8 + z * 0.04, 0, 1), 1, 0),
  ),
  ...[-1, 1].map((s) => painted(new THREE.SphereGeometry(0.5, 4, 2), '#000000', [s * 1.05, 0.4, 2.62], [0, s * 0.35, 0])),
])

/** An sRGB hex colour as a GLSL `vec3` in linear RGB, the space the shader adds emissive light in. */
function glslLinear(hex: string): string {
  const c = new THREE.Color(hex)
  return `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`
}

const WISP_CORE_PARS = /* glsl */ `
uniform float uWispHeat;
vec3 wispRamp(float t) {
  vec3 c = mix(${glslLinear(WISP_EMBER)}, ${glslLinear(WISP_FLAME)}, smoothstep(0.1, 0.5, t));
  return mix(c, ${glslLinear(WISP_WHITE)}, smoothstep(0.7, 1.0, t));
}
`
const WISP_CORE_APPLY = /* glsl */ `
{
  float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float heat = vColor.r * (0.2 + 0.8 * facing * facing);
  totalEmissiveRadiance += wispRamp(heat) * vColor.g * mix(0.8, 1.6, heat) * uWispHeat;
}
`

/** The core's glow multiplier, shared by every wisp (its flicker). */
export const EMBER_WISP_HEAT = { value: 1 }

export const EMBER_WISP_CORE_MAT = withEmissivePatch(
  withRim(new THREE.MeshStandardMaterial({ vertexColors: true, color: '#000000', roughness: 0.5, flatShading: true }), {
    color: WISP_RIM, intensity: 0.7, power: 2,
  }),
  'wisp-core', { uWispHeat: EMBER_WISP_HEAT }, WISP_CORE_PARS, WISP_CORE_APPLY,
)

const RIBBON_LENGTH = 7
const RIBBON_SEGMENTS = 5

/** A flat flame strip rising along +y and curling back, `width` at the root tapering to a point; `aRibbon` is 0 → 1 along it. */
function ribbon(width: number, yaw: number, roll: number): THREE.BufferGeometry {
  const positions: number[] = []
  const along: number[] = []
  const colors: number[] = []
  const root = new THREE.Color(WISP_RIBBON_ROOT).multiplyScalar(1.15)
  const tip = new THREE.Color(WISP_RIBBON_TIP)
  const c = new THREE.Color()
  const at = (t: number, side: number) => {
    const h = t * RIBBON_LENGTH
    const w = width * (1 - t) ** 0.6 * (0.7 + 0.5 * Math.sin(t * Math.PI))
    positions.push(side * w * 0.5 + 0.6 * t * Math.sin(t * Math.PI * 1.6), h, -0.14 * h * h)
    along.push(t)
    c.copy(root).lerp(tip, t ** 0.7).toArray(colors, colors.length)
  }
  for (let i = 0; i < RIBBON_SEGMENTS; i++) {
    const t0 = i / RIBBON_SEGMENTS
    const t1 = (i + 1) / RIBBON_SEGMENTS
    at(t0, -1); at(t0, 1); at(t1, 1)
    at(t0, -1); at(t1, 1); at(t1, -1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setAttribute('aRibbon', new THREE.Float32BufferAttribute(along, 1))
  return g.applyMatrix4(pose([0, 0, 0], [0, yaw, roll]))
}

/** Three ribbons from `EMBER_WISP_RIBBON_ROOT` (their origin): one straight back, two fanned out. */
export const EMBER_WISP_RIBBONS_GEO = mergePainted([ribbon(2.4, 0, 0), ribbon(2, 1.2, 0.3), ribbon(2, -1.2, -0.3)])

/** Game seconds, shared by every wisp's ribbons (the flicker wave runs on it). */
export const EMBER_WISP_FLICKER = { value: 0 }

/** Additive and unlit: the ribbons glow over the ash sky; each wave's phase comes from the wisp's world position. */
export const EMBER_WISP_RIBBON_MAT = (() => {
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFlicker = EMBER_WISP_FLICKER
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uFlicker;\nattribute float aRibbon;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
{
  float ph = uFlicker * 7.0 + dot(modelMatrix[3].xyz, vec3(0.013, 0.007, 0.011)) - aRibbon * 4.0 + position.x * 0.4;
  float a = aRibbon * aRibbon;
  transformed.x += sin(ph) * 0.9 * a;
  transformed.z += cos(ph * 0.8) * 0.5 * a;
}`)
  }
  material.customProgramCacheKey = () => 'sc-wisp-ribbon'
  return material
})()

// ── Fire Imp: pear body, big grinning head, curved horns, stubby arms, whip tail ──

const IMP_BONE = '#f2dcae'
const IMP_MOUTH = '#2a0805'
const IMP_FANG = '#fff6e6'
const HORN_TIP = new THREE.Color('#3a1c12')

/** Shoulders' pivot (both arms swing about one axis) and the rump's, in model units. */
export const FIRE_IMP_SHOULDER: Vec3 = [0, 4.1, 0.2]
export const FIRE_IMP_RUMP: Vec3 = [0, 1.6, -2.1]

const IMP_PEAR = [
  [0, 0.5], [1.7, 0.7], [2.5, 1.5], [2.7, 2.5], [2.4, 3.5], [1.8, 4.3], [1.2, 4.9], [0, 5.2],
].map(([r, y]) => new THREE.Vector2(r, y))

/** A horn curving out to `side` and back, base at its origin, bone fading to charcoal at the tip. */
function impHorn(side: 1 | -1): THREE.BufferGeometry {
  const g = bent(new THREE.ConeGeometry(0.55, 3, 5, 3).translate(0, 1.5, 0), (h) => [side * 0.2 * h * h, -0.12 * h * h])
  return recolor(paintedAt(g, IMP_BONE, pose([side * 1.25, 7.8, 0.1], [0.25, 0, side * -0.45])), (_x, y, _z, c) =>
    c.lerp(HORN_TIP, THREE.MathUtils.smoothstep(y, 8.6, 10.4)))
}

export const FIRE_IMP_BODY_GEO = darkUnder(sunShaded(mergePainted([
  paintedAt(new THREE.LatheGeometry(IMP_PEAR, 8), IMP_ORANGE, pose([0, 0, 0])),
  paintedAt(new THREE.SphereGeometry(2.3, 8, 5), IMP_ORANGE, pose([0, 6.4, 0.35], [0, 0, 0], [1.12, 0.95, 1])),
  ...[-1, 1].map((s) => paintedAt(new THREE.IcosahedronGeometry(1, 0), IMP_DARK, pose([s * 1.1, 0.4, 0.5], [0, 0, 0], [0.8, 0.45, 1.1]))),
  // A wide grin, its corners bent up, and two fangs.
  paintedAt(grin(new THREE.SphereGeometry(1, 8, 3)), IMP_MOUTH, pose([0, 5.75, 2.25], [0, 0, 0], [1.6, 0.42, 0.5])),
  ...[-1, 1].map((s) => painted(new THREE.ConeGeometry(0.22, 0.65, 4), IMP_FANG, [s * 0.6, 5.72, 2.62], [Math.PI, 0, 0])),
  // Angry brows, inner ends low.
  ...[-1, 1].map((s) => painted(new THREE.BoxGeometry(1.2, 0.32, 0.5), IMP_DARK, [s * 0.75, 7.35, 2.2], [0.2, 0, s * 0.38])),
  impHorn(-1), impHorn(1),
])), 0.5, 3.5, 0.45)

/** Yellow eyes with slit pupils; unlit, so they read in the dark. */
export const FIRE_IMP_EYES_GEO = mergePainted([-1, 1].flatMap((s) => [
  paintedAt(new THREE.SphereGeometry(0.52, 5, 3), '#ffe040', pose([s * 0.78, 6.75, 2.15], [0, s * 0.3, 0], [1, 1.15, 0.6])),
  painted(new THREE.BoxGeometry(0.13, 0.55, 0.1), '#140400', [s * 0.8, 6.75, 2.47], [0, s * 0.3, 0]),
]))

/** Both arms, about `FIRE_IMP_SHOULDER` (their origin): stubby, clawed fists. */
export const FIRE_IMP_ARMS_GEO = sunShaded(mergePainted([-1, 1].flatMap((s) => [
  painted(new THREE.CapsuleGeometry(0.42, 1.1, 1, 5), IMP_ORANGE, [s * 2.25, -0.7, 0.2], [0.3, 0, s * 0.75]),
  paintedAt(new THREE.IcosahedronGeometry(0.6, 0), IMP_DARK, pose([s * 2.75, -1.55, 0.55])),
])))

/** The whip tail from `FIRE_IMP_RUMP` (its origin): an S-curve back and up, ending in a spade. */
export const FIRE_IMP_TAIL_GEO = (() => {
  const length = 4.6
  const wave = (h: number): [number, number] => [0.45 * Math.sin(h * 1.3), 0.07 * h * h]
  const whip = paintedAt(bent(new THREE.ConeGeometry(0.32, length, 4, 5).translate(0, length / 2, 0), wave), IMP_ORANGE, pose([0, 0, 0], [-Math.PI / 2, 0, 0]))
  const [tx, tz] = wave(length)
  // Rotated -90° about x: the curve's z becomes height, its length runs to -z.
  const spade = paintedAt(new THREE.OctahedronGeometry(0.75, 0), IMP_DARK, pose([tx, tz, -length], [0, 0, 0], [0.75, 0.2, 1]))
  return darkUnder(mergePainted([whip, spade]), -0.5, 1.5, 0.6)
})()

const IMP_RIM = { color: '#ffb070', intensity: 1.0, power: 2.2 }
export const FIRE_IMP_MAT = withRim(new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.55, metalness: 0.05, flatShading: true,
  emissive: '#ff4a10', emissiveIntensity: 0.12,
}), IMP_RIM)
export const FIRE_IMP_EYE_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })

// ── Lava Golem: cracked obsidian plates over a lava core, boulder shoulders, a low head, legs ──
// Every rock is an icosahedron whose faces are grouped into plates shrunk apart, with the same shape a little
// smaller painted lava inside: the gaps between the plates are its seams. One material for every part; the shader makes
// the painted lava glow (`LAVA_GOLEM_GLOW`, pulsing) and the flare material on a hit makes it white-hot.

const OBSIDIAN = OBSIDIAN_HEX.map((c) => new THREE.Color(c))
/**
 * A cracked boulder placed by `matrix`: its faces grouped into a few plates (each face to the nearest of `plates`
 * seeded directions), each plate shrunk about its own centre along the surface, over a lava core showing through
 * the seams between them.
 */
function crackedRock(detail: number, matrix: THREE.Matrix4, plates: number): THREE.BufferGeometry[] {
  const shell = new THREE.IcosahedronGeometry(1, detail)
  const p = shell.attributes.position
  const e = matrix.elements
  const seed = hash3(e[12], e[13], e[14]) * 100
  const dirs = Array.from({ length: plates }, (_, k) =>
    new THREE.Vector3(hash3(seed, k, 1) - 0.5, hash3(k, seed, 2) - 0.5, hash3(3, k, seed) - 0.5).normalize())
  const v = new THREE.Vector3()
  const centre = new THREE.Vector3()
  const plateOf: number[] = []
  const centres = dirs.map(() => new THREE.Vector3())
  for (let t = 0; t < p.count; t += 3) {
    centre.set(0, 0, 0)
    for (let k = 0; k < 3; k++) centre.add(v.fromBufferAttribute(p, t + k))
    let best = 0
    for (let k = 1; k < plates; k++) if (centre.dot(dirs[k]) > centre.dot(dirs[best])) best = k
    plateOf.push(best)
    centres[best].add(centre)
  }
  const colors = new Float32Array(p.count * 3)
  for (let t = 0; t < p.count; t += 3) {
    const plate = plateOf[t / 3]
    const h = hash3(seed, plate, 7)
    const shrink = 0.86 + 0.08 * h
    centre.copy(centres[plate]).normalize()
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(p, t + k)
      // Towards the plate's centre, then back out to the surface: the plate stays on the boulder.
      const r = v.length()
      v.sub(centre).multiplyScalar(shrink).add(centre).setLength(r * 1.03)
      p.setXYZ(t + k, v.x, v.y, v.z)
      OBSIDIAN[Math.floor(hash3(plate, t, seed) * 3)].toArray(colors, (t + k) * 3)
    }
  }
  shell.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  shell.deleteAttribute('uv')
  shell.computeVertexNormals()
  shell.applyMatrix4(matrix)
  const core = paintedAt(new THREE.IcosahedronGeometry(0.95, detail), LAVA, matrix)
  return [shell, core]
}

const rock = (at: Vec3, scale: Vec3, rotation: Vec3 = [0, 0, 0], detail = 0) =>
  crackedRock(detail, pose(at, rotation, scale), detail ? 8 : 4)

/** Hips, legs' and arms' pivots (model units). */
export const LAVA_GOLEM_HIP: Vec3 = [2.6, 9, 0]
export const LAVA_GOLEM_SHOULDER: Vec3 = [5.2, 16.6, 0.3]

/** Hips up: pelvis, a chest leaning forward, boulder shoulders, a small head set low between them, glowing eyes. */
export const LAVA_GOLEM_BODY_GEO = mergePainted([
  ...rock([0, 9.9, 0], [3.6, 1.8, 2.6]),
  ...rock([0, 14.4, 0.3], [5.2, 4.4, 3.8], [0.25, 0, 0], 1),
  ...[-1, 1].flatMap((s) => rock([s * 5, 17.2, 0.2], [2.7, 2.4, 2.6], [0.3, s * 0.4, s * 0.2])),
  ...rock([0, 17.5, 3], [1.7, 1.5, 1.6], [0.2, 0, 0]),
  ...rock([0, 18.4, 3.6], [1.9, 0.55, 1], [0.35, 0, 0]),
  ...[-1, 1].map((s) => paintedAt(new THREE.OctahedronGeometry(0.55, 0), LAVA_HOT, pose([s * 0.72, 17.7, 4.5], [0, 0, s * 0.3], [1.3, 0.75, 0.6]))),
])

/** One leg from its hip (its origin): thigh, a glowing knee, a heavy foot. */
export const LAVA_GOLEM_LEG_GEO = mergePainted([
  ...rock([0, -2.4, 0], [2, 2.9, 2]),
  paintedAt(new THREE.IcosahedronGeometry(1.3, 0), LAVA, pose([0, -5.5, 0.1])),
  ...rock([0, -7.4, 0.5], [2, 1.8, 2.6]),
])

/** One arm from its shoulder (its origin), hanging out to `side`: upper arm, a glowing elbow, a big fist. */
function golemArm(side: 1 | -1): THREE.BufferGeometry {
  return mergePainted([
    ...rock([side * 0.6, -3, 0], [1.6, 2.8, 1.6], [0, 0, side * 0.1]),
    paintedAt(new THREE.IcosahedronGeometry(1, 0), LAVA, pose([side * 0.8, -5.7, 0.3])),
    ...rock([side * 0.95, -7.8, 0.6], [2.2, 2.4, 2.2], [0.2, 0, 0]),
  ])
}
export const LAVA_GOLEM_LEFT_ARM_GEO = golemArm(-1)
export const LAVA_GOLEM_RIGHT_ARM_GEO = golemArm(1)

const GOLEM_PARS = /* glsl */ `
uniform float uLavaGlow;
uniform float uRockHeat;
`
const GOLEM_APPLY = /* glsl */ `
{
  float lava = smoothstep(0.35, 0.6, vColor.r - vColor.b);
  totalEmissiveRadiance += vColor.rgb * lava * uLavaGlow + vec3(1.0, 0.5, 0.25) * (1.0 - lava) * uRockHeat;
}
`

/** The seams' glow, shared by every golem (each sets the same pulse from game time). */
export const LAVA_GOLEM_GLOW = { value: 1.8 }

const golemMaterial = (glow: { value: number }, rockHeat: number) => withEmissivePatch(
  withRim(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.15, flatShading: true }), {
    color: '#ff8a40', intensity: 0.7, power: 2.4,
  }),
  'golem-lava', { uLavaGlow: glow, uRockHeat: { value: rockHeat } }, GOLEM_PARS, GOLEM_APPLY,
)

export const LAVA_GOLEM_MAT = golemMaterial(LAVA_GOLEM_GLOW, 0)
/** Its hit flash: the seams flare white-hot and the rock glows (same program as `LAVA_GOLEM_MAT`). */
export const LAVA_GOLEM_FLARE_MAT = golemMaterial({ value: 7 }, 0.9)

// ── Infernal Drake: a long-necked dragon on bat wings, a spade tail, horns and glowing eyes ──
// One material for every part: a charcoal body and membrane wings whose scalloped trailing edges glow, as do the
// eyes and the inside of the jaw (the glow is painted: a hot orange vertex colour lights itself). Its eight moving
// parts (torso, neck with head, jaw, tail, each wing's arm and hand) are one geometry, each vertex tagged with its part
// (`aPart`), moved in the vertex shader by that part's matrix (`drakePose.hot.ts`): one draw call a drake (#922).

const DRAKE_BELLY = new THREE.Color('#5a3026')
const DRAKE_VEIN = '#3a0c0c'
const DRAKE_BONE = '#d8c8a8'
const DRAKE_EYE = '#ffd040'

/** Pivots (model units): the neck's root, the tail's root, the right shoulder. */
export const DRAKE_NECK_ROOT: Vec3 = [0, 0.9, 3.6]
export const DRAKE_TAIL_ROOT: Vec3 = [0, 0.1, -4.6]
export const DRAKE_SHOULDER: Vec3 = [1.5, 1.4, 1.6]
/** The elbow in the shoulder's frame: the hand (outer wing) pivots here. */
export const DRAKE_ELBOW: Vec3 = [6.5, 0.6, 0.5]

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** A tapered bone from `a` (radius r0) to `b` (radius r1). */
function strut(a: Vec3, b: Vec3, r0: number, r1: number, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  _a.fromArray(a)
  const dir = _b.fromArray(b).sub(_a)
  const length = dir.length()
  const m = new THREE.Matrix4().compose(
    _a.addScaledVector(dir, 0.5),
    new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize()),
    new THREE.Vector3(1, 1, 1),
  )
  return paintedAt(new THREE.CylinderGeometry(r1, r0, length, 4, 1, true), color, m)
}

/** Both faces of a flat triangle. */
const twoSided = (a: Vec3, b: Vec3, c: Vec3, color: THREE.ColorRepresentation) =>
  [paintedPolygon([...a, ...b, ...c], color), paintedPolygon([...a, ...c, ...b], color)]

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/**
 * Membrane fanned from `hub` over the `edge` chain. Where `trailing[i]` (the edge from point i to i + 1 is a trailing
 * edge) its outer strip is painted to glow. Returns the membrane and the glowing parts apart.
 */
function membrane(hub: Vec3, edge: Vec3[], trailing: boolean[]): [THREE.BufferGeometry[], THREE.BufferGeometry[]] {
  const skin: THREE.BufferGeometry[] = []
  const glow: THREE.BufferGeometry[] = []
  for (let i = 0; i < edge.length - 1; i++) {
    const [a, b] = [edge[i], edge[i + 1]]
    if (!trailing[i]) {
      skin.push(...twoSided(hub, a, b, DRAKE_MEMBRANE))
      continue
    }
    const [ia, ib] = [lerp3(hub, a, 0.86), lerp3(hub, b, 0.86)]
    skin.push(...twoSided(hub, ia, ib, DRAKE_MEMBRANE))
    glow.push(...twoSided(ia, a, b, DRAKE_GLOW), ...twoSided(ia, b, ib, DRAKE_GLOW))
  }
  return [skin, glow]
}

/** One drake part: its charcoal and bone shaded lighter on top, the glowing parts left at full heat. */
const drakePart = (shaded: THREE.BufferGeometry[], glowing: THREE.BufferGeometry[] = []) =>
  mergePainted([sunShaded(mergePainted(shaded)), ...glowing])

const DRAKE_TORSO = [[0, -5], [1.2, -4.6], [2.1, -3], [2.6, -0.5], [2.5, 1.8], [1.9, 3.5], [1.2, 4.4], [0, 4.8]]

/** Torso (a warmer belly), tucked hind legs and a ridge of spines. */
const DRAKE_BODY_GEO = drakePart([
  recolor(paintedAt(new THREE.LatheGeometry(DRAKE_TORSO.map(([r, z]) => new THREE.Vector2(r, z)), 8), DRAKE_CHARCOAL,
    pose([0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.85])), (_x, y, _z, c) => c.lerp(DRAKE_BELLY, 1 - THREE.MathUtils.smoothstep(y, -1.6, -0.6))),
  ...[-1, 1].flatMap((s) => [
    painted(new THREE.CapsuleGeometry(0.45, 1.6, 1, 4), DRAKE_CHARCOAL, [s * 1.3, -1.9, -2.4], [-1.1, 0, 0]),
    painted(new THREE.ConeGeometry(0.4, 0.8, 4), DRAKE_BONE, [s * 1.3, -2.5, -3.6], [-2.1, 0, 0]),
  ]),
  ...[3, 1.2, -0.6, -2.4].map((z, i) =>
    painted(new THREE.ConeGeometry(0.4, 1.3 - i * 0.15, 4), DRAKE_BONE, [0, 2.1 - Math.abs(z) * 0.05, z], [-0.5, 0, 0])),
])

/** The neck, built along +y and leaned forward: it rises from the shoulders and levels out at the head. */
const NECK_LENGTH = 6
const NECK_LEAN = 1.0
const neckBend = (h: number): [number, number] => [0, 0.06 * h * h]
/** The head's place in the neck's frame: the neck's end, leaned forward. */
const DRAKE_HEAD: Vec3 = (() => {
  const v = new THREE.Vector3(0, NECK_LENGTH, neckBend(NECK_LENGTH)[1]).applyAxisAngle(new THREE.Vector3(1, 0, 0), NECK_LEAN)
  return [v.x, v.y, v.z]
})()
/** The lower jaw's hinge, in the neck's frame. */
export const DRAKE_JAW_HINGE: Vec3 = [0, DRAKE_HEAD[1] - 0.45, DRAKE_HEAD[2] + 0.1]

/** A horn sweeping back from the crown and curling up, bone fading to charcoal at the tip. */
function drakeHorn(side: 1 | -1): THREE.BufferGeometry {
  const tip = new THREE.Color(DRAKE_CHARCOAL)
  const g = recolor(paintedAt(bent(new THREE.ConeGeometry(0.32, 2.6, 5, 3).translate(0, 1.3, 0), (h) => [side * 0.08 * h * h, 0.14 * h * h]),
    DRAKE_BONE, new THREE.Matrix4()), (_x, y, _z, c) => c.lerp(tip, THREE.MathUtils.smoothstep(y, 1, 2.4)))
  const [x, y, z] = DRAKE_HEAD
  return g.applyMatrix4(pose([x + side * 0.6, y + 0.55, z - 0.5], [-1.9, side * 0.35, 0]))
}

/** Neck and head, about `DRAKE_NECK_ROOT` (its origin): horns, brows, glowing eyes, the upper jaw. */
const DRAKE_NECK_GEO = (() => {
  const [x, y, z] = DRAKE_HEAD
  const neck = paintedAt(bent(new THREE.CylinderGeometry(0.75, 1.2, NECK_LENGTH, 6, 4).translate(0, NECK_LENGTH / 2, 0), neckBend),
    DRAKE_CHARCOAL, pose([0, 0, 0], [NECK_LEAN, 0, 0]))
  return drakePart([
    neck,
    paintedAt(new THREE.SphereGeometry(1, 6, 4), DRAKE_CHARCOAL, pose([x, y, z], [0, 0, 0], [1.05, 0.85, 1.3])),
    paintedAt(new THREE.CylinderGeometry(0.4, 0.75, 2.4, 5), DRAKE_CHARCOAL, pose([x, y - 0.1, z + 1.7], [Math.PI / 2, 0, 0], [1, 1, 0.8])),
    ...[-1, 1].map((s) => painted(new THREE.BoxGeometry(0.75, 0.25, 0.9), DRAKE_CHARCOAL, [x + s * 0.5, y + 0.55, z + 0.6], [0.25, 0, s * -0.3])),
    drakeHorn(-1), drakeHorn(1),
  ], [-1, 1].map((s) => paintedAt(new THREE.OctahedronGeometry(0.28, 0), DRAKE_EYE, pose([x + s * 0.72, y + 0.3, z + 0.75], [0, 0, 0], [1, 0.7, 1]))))
})()

/** The lower jaw about `DRAKE_JAW_HINGE` (its origin), glowing inside: shown when it roars. */
const DRAKE_JAW_GEO = drakePart(
  [paintedAt(new THREE.CylinderGeometry(0.3, 0.6, 2.4, 5), DRAKE_CHARCOAL, pose([0, -0.15, 1.3], [Math.PI / 2, 0, 0], [1, 1, 0.6]))],
  [painted(new THREE.BoxGeometry(0.6, 0.1, 1.9), DRAKE_GLOW, [0, 0.05, 1.3])],
)

/** The tail from `DRAKE_TAIL_ROOT` (its origin) back to a spade, curling up a little at the end. */
const DRAKE_TAIL_GEO = (() => {
  const length = 9
  const curl = (h: number): [number, number] => [0.4 * Math.sin(h * 0.55), 0.03 * h * h]
  const tail = paintedAt(bent(new THREE.ConeGeometry(0.85, length, 4, 6).translate(0, length / 2, 0), curl), DRAKE_CHARCOAL,
    pose([0, 0, 0], [-Math.PI / 2, 0, 0]))
  const [tx, ty] = curl(length)
  // Rotated -90° about x: the curl's z becomes height, the tail's length runs to -z.
  const spade = paintedAt(new THREE.OctahedronGeometry(1, 0), DRAKE_MEMBRANE, pose([tx, ty, -length - 0.4], [0, 0, 0], [1.1, 0.18, 1.5]))
  return drakePart([tail, spade])
})()

/** The right arm about `DRAKE_SHOULDER`: the arm bone along the leading edge, the inner membrane back to the flank. */
const DRAKE_WING_ARM_GEO = (() => {
  const trailing: Vec3[] = [DRAKE_ELBOW, [5.3, 0.1, -3.1], [2.6, 0, -3.6], [-0.3, -0.3, -4.2]]
  const [skin, glow] = membrane([0, 0, 0], trailing, [false, true, true])
  return drakePart([
    strut([0, 0, 0.1], DRAKE_ELBOW, 0.45, 0.32, DRAKE_CHARCOAL), strut([0, 0, 0], trailing[2], 0.07, 0.05, DRAKE_VEIN), ...skin,
  ], glow)
})()

/** The right hand about `DRAKE_ELBOW`: three fingers out from the wrist, scalloped membrane between them. */
const DRAKE_WING_HAND_GEO = (() => {
  const fingers: Vec3[] = [[7.5, 0.5, -0.9], [6, 0, -3.9], [3, -0.1, -4.6]]
  const join: Vec3 = [5.3 - DRAKE_ELBOW[0], 0.1 - DRAKE_ELBOW[1], -3.1 - DRAKE_ELBOW[2]]
  // Each scallop's low point, pulled in towards the wrist between two tips.
  const scallop = (a: Vec3, b: Vec3, t: number) => lerp3([0, 0, 0], lerp3(a, b, 0.5), t)
  const edge: Vec3[] = [
    fingers[0], scallop(fingers[0], fingers[1], 0.72), fingers[1], scallop(fingers[1], fingers[2], 0.78), fingers[2],
    scallop(fingers[2], join, 0.85), join,
  ]
  const [skin, glow] = membrane([0, 0, 0], edge, edge.slice(1).map(() => true))
  return drakePart([
    strut([0, 0, 0], fingers[0], 0.32, 0.12, DRAKE_CHARCOAL),
    ...fingers.slice(1).map((f) => strut([0, 0, 0], f, 0.14, 0.06, DRAKE_VEIN)),
    painted(new THREE.ConeGeometry(0.22, 0.9, 4), DRAKE_BONE, [0.1, 0.45, 0.2], [0.2, 0, 0]),
    ...skin,
  ], glow)
})()

// Painted glow lights itself: a hot vertex colour (red high, blue low) is added back as emission.
const DRAKE_GLOW_APPLY = /* glsl */ `{
  float glow = smoothstep(0.55, 0.9, vColor.r) * (1.0 - smoothstep(0.08, 0.2, vColor.b));
  totalEmissiveRadiance += vColor.rgb * glow * 2.2;
}`
/** Each part's `aPart` in `DRAKE_GEO`: its matrix in `uDrakePose`. */
export const DRAKE_PART = { body: 0, neck: 1, jaw: 2, tail: 3, rightArm: 4, rightHand: 5, leftArm: 6, leftHand: 7 } as const
export const DRAKE_PARTS = 8

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/** `g` at `at` (mirrored across x for the left wing, its triangles rewound to face out), non-indexed, tagged `part`. */
function drakePartAt(g: THREE.BufferGeometry, part: number, at: Vec3, mirror = false): THREE.BufferGeometry {
  const out = (g.index ? g.toNonIndexed() : g.clone()).translate(...at)
  if (mirror) flipWinding(out.scale(-1, 1, 1))
  out.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count).fill(part), 1))
  return out
}

/** The whole drake at rest, its parts laid where they hang: one geometry, `aPart` tagging each vertex with its part. */
export const DRAKE_GEO = (() => {
  const jaw = add3(DRAKE_NECK_ROOT, DRAKE_JAW_HINGE)
  const hand = add3(DRAKE_SHOULDER, DRAKE_ELBOW)
  const P = DRAKE_PART
  const g = mergePainted([
    drakePartAt(DRAKE_BODY_GEO, P.body, [0, 0, 0]),
    drakePartAt(DRAKE_NECK_GEO, P.neck, DRAKE_NECK_ROOT),
    drakePartAt(DRAKE_JAW_GEO, P.jaw, jaw),
    drakePartAt(DRAKE_TAIL_GEO, P.tail, DRAKE_TAIL_ROOT),
    drakePartAt(DRAKE_WING_ARM_GEO, P.rightArm, DRAKE_SHOULDER),
    drakePartAt(DRAKE_WING_HAND_GEO, P.rightHand, hand),
    drakePartAt(DRAKE_WING_ARM_GEO, P.leftArm, DRAKE_SHOULDER, true),
    drakePartAt(DRAKE_WING_HAND_GEO, P.leftHand, hand, true),
  ])
  for (const part of [DRAKE_BODY_GEO, DRAKE_NECK_GEO, DRAKE_JAW_GEO, DRAKE_TAIL_GEO, DRAKE_WING_ARM_GEO, DRAKE_WING_HAND_GEO]) part.dispose()
  // The pose swings the wings and neck about their roots: room for them in the culling sphere.
  g.boundingSphere!.radius *= 1.15
  return g
})()

const DRAKE_POSE_PARS = /* glsl */ `
attribute float aPart;
uniform mat4 uDrakePose[${DRAKE_PARTS}];
`
// Flat shading takes normals from screen derivatives, so only positions move.
const DRAKE_POSE_APPLY = /* glsl */ `
transformed = (uDrakePose[int(aPart + 0.5)] * vec4(transformed, 1.0)).xyz;
`

/** Moves each part of `material`'s drake by its matrix in `pose` (`drakePose.hot.ts` `poseDrake`); every material built the same way shares one program. */
export function withDrakePose<T extends THREE.Material>(material: T, pose: { value: THREE.Matrix4[] }): T {
  const base = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer)
    shader.uniforms.uDrakePose = pose
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${DRAKE_POSE_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${DRAKE_POSE_APPLY}`)
  }
  material.customProgramCacheKey = () => `${baseKey}-drake-pose`
  return material
}

/** A drake at rest: each part's matrix the identity. */
export const drakeRestPose = () => ({ value: Array.from({ length: DRAKE_PARTS }, () => new THREE.Matrix4()) })

/** One drake's paint, its parts posed by `pose`. */
export function createDrakeMaterial(pose: { value: THREE.Matrix4[] }): THREE.MeshStandardMaterial {
  return withDrakePose(withEmissivePatch(withRim(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.6, metalness: 0.1, flatShading: true,
  }), { color: '#ffb070', intensity: 1.2, power: 2.0 }), 'drake-glow', {}, '', DRAKE_GLOW_APPLY), pose)
}

/** Only for ShaderWarmup and the tests: every drake builds its own. */
export const DRAKE_MAT = createDrakeMaterial(drakeRestPose())
