import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { VIEWMODEL_DEPTH_RANGE } from '@/core/cameraLayers'
import { WEAPONS } from './weapons/weaponTypes'

// Model space: barrel along -Z, receiver centre at the origin, ~1.4 units long.
export const TIP = new THREE.Vector3(0, 0, -0.93)
export const FLASH_SIZE = 0.42 // model units
export const TRACER_WIDTH = 0.045 // model units, at the barrel end
const TRACER_FAR_WIDTH_RATIO = 10 // far end width / near end width (perspective taper)

const COLORS = {
  body: new THREE.Color('#566072'),
  dark: new THREE.Color('#1f232b'),
  accent: new THREE.Color('#ff8a1f'),
  sight: new THREE.Color('#ff3b3b'),
}

interface Part {
  geo: THREE.BufferGeometry
  color: THREE.Color
  pos: [number, number, number]
  rotX?: number
}

export function buildWeaponGeometry(): THREE.BufferGeometry {
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
  const cyl = (r: number, len: number, seg = 10) =>
    new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2)
  const parts: Part[] = [
    { geo: box(0.2, 0.22, 0.62), color: COLORS.body, pos: [0, 0, 0.02] },
    { geo: box(0.1, 0.05, 0.52), color: COLORS.dark, pos: [0, 0.135, 0.02] },
    { geo: box(0.09, 0.07, 0.05), color: COLORS.dark, pos: [0, 0.19, 0.24] },
    { geo: box(0.025, 0.025, 0.026), color: COLORS.sight, pos: [0, 0.235, 0.24] },
    { geo: box(0.21, 0.035, 0.34), color: COLORS.accent, pos: [0, -0.045, 0.05] },
    { geo: box(0.16, 0.16, 0.36), color: COLORS.body, pos: [0, 0, -0.46] },
    { geo: box(0.168, 0.03, 0.28), color: COLORS.accent, pos: [0, 0.035, -0.46] },
    { geo: box(0.03, 0.08, 0.03), color: COLORS.dark, pos: [0, 0.11, -0.6] },
    { geo: cyl(0.036, 0.26), color: COLORS.dark, pos: [0, 0, -0.76] },
    { geo: cyl(0.054, 0.08, 8), color: COLORS.dark, pos: [0, 0, -0.88] },
    // No stock: it would reach into the bottom-right HUD corner.
    { geo: box(0.12, 0.3, 0.14), color: COLORS.dark, pos: [0, -0.22, 0.2], rotX: -0.3 },
    { geo: box(0.1, 0.26, 0.15), color: COLORS.body, pos: [0, -0.2, -0.13], rotX: 0.15 },
    { geo: box(0.17, 0.18, 0.06), color: COLORS.dark, pos: [0, 0, 0.35] },
  ]
  const geos = parts.map(({ geo, color, pos, rotX }) => {
    if (rotX) geo.rotateX(rotX)
    geo.translate(pos[0], pos[1], pos[2])
    const n = geo.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) color.toArray(col, i * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return geo
  })
  const merged = mergeGeometries(geos, false)
  for (const g of geos) g.dispose()
  if (!merged) throw new Error('WeaponViewModel: failed to merge weapon geometry')
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

export function createWeaponMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0.3,
    // Floor so the gun never goes pure black in dark biomes / back-lit turns.
    emissive: new THREE.Color('#1a1e26'),
    fog: false,
  })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      // Front of the depth range: draws over the world, still self-occludes.
      gl_Position.z = (gl_Position.z + gl_Position.w) * ${VIEWMODEL_DEPTH_RANGE.toFixed(3)} - gl_Position.w;`,
    )
  }
  mat.customProgramCacheKey = () => 'sc-weapon-viewmodel-v1'
  return mat
}

/** Tapered quad along +X (0..1): near end width 1, far end TRACER_FAR_WIDTH_RATIO. */
export function buildTracerGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  const w1 = TRACER_FAR_WIDTH_RATIO * 0.5
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, -0.5, 0, 1, -w1, 0, 1, w1, 0, 0, 0.5, 0,
  ]), 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  return g
}

const tracerVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// uv.x is linear in 3D; convert to on-screen fraction so the streak head moves evenly.
const tracerFragment = /* glsl */ `
  uniform float uTime;        // 0 → 1 over the tracer's life
  uniform float uDepthRatio;  // start depth / end depth
  uniform vec3 uColor;        // the weapon's streak colour, weapons/weaponTypes.ts
  varying vec2 vUv;
  void main() {
    float zRel = mix(1.0, 1.0 / uDepthRatio, vUv.x);          // z / zStart
    float s = (1.0 - 1.0 / zRel) / max(1.0 - uDepthRatio, 1e-3); // screen fraction
    float head = uTime * 1.6 + 0.15;
    float tail = head - 0.55;
    float along = smoothstep(tail, head, s) * (1.0 - smoothstep(head, head + 0.04, s));
    float across = 1.0 - pow(abs(vUv.y * 2.0 - 1.0), 2.0);
    float a = along * across * (1.0 - uTime * 0.6);
    vec3 col = mix(uColor, mix(uColor, vec3(1.0), 0.75), along);
    gl_FragColor = vec4(col * a * 1.6, a);
  }
`

export function createTracerMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: tracerVertex,
    fragmentShader: tracerFragment,
    uniforms: { uTime: { value: 0 }, uDepthRatio: { value: 0.02 }, uColor: { value: new THREE.Color(...WEAPONS.blaster.tracerColor) } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  })
}
