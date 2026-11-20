/**
 * Soft contact shadows shaded by a rounded-box distance field, after slop-newyork's
 * `createContactShadowMaterial` (tsl-materials.js), Copyright (c) 2026 Mr.doob, MIT License,
 * https://github.com/mrdoob/slop-newyork. Written from its description; no code copied.
 */
import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'

export interface ShadowCaster {
  x: number
  z: number
  halfX: number
  halfZ: number
  /** Rotation about +Y (local x across, z along, as tower yaw). */
  yaw?: number
  /** Corner radius; `min(halfX, halfZ)` makes a round footprint. Default 0. */
  radius?: number
  spread: number
  strength: number
  /** What it stands on when that isn't the drawn terrain (the gym's mats over its floor); default the level's `groundFn`. */
  ground?: HeightFunction
  /**
   * The part of the footprint + spread this grid covers, in the caster's local units; default all of it. A caster whose
   * ground steps (a raised mat beside a floor-level walkway) is split into one grid per flat piece: the shading stays
   * continuous across them, and no cell straddles the step for the deficit lift to raise to its top.
   */
  grid?: { minX: number; maxX: number; minZ: number; maxZ: number }
}

/** Round footprint of radius `r`, penumbra `spread` × r. */
export function roundCaster(x: number, z: number, r: number, strength: number, spread = 0.6): ShadowCaster {
  return { x, z, halfX: r, halfZ: r, radius: r, spread: r * spread, strength }
}

/** Shadow grid cell size (world units): fine enough to follow the drawn terrain (≈94-unit cells). */
export const SHADOW_CELL = 16
/** Max grid segments per side, so landmark-sized casters stay cheap. */
const MAX_SEGMENTS = 24
/** Lift above the drawn terrain; polygonOffset handles the rest. */
export const SHADOW_LIFT = 0.6
const CELL_SAMPLES = 4

/** One indexed geometry: per caster, a grid over footprint + spread that never dips under `groundFn`. */
export function buildContactShadowGeometry(
  casters: readonly ShadowCaster[],
  groundFn: HeightFunction,
): THREE.BufferGeometry {
  const grids = casters.map((c) => {
    const ex = c.halfX + c.spread
    const ez = c.halfZ + c.spread
    const { minX, maxX, minZ, maxZ } = c.grid ?? { minX: -ex, maxX: ex, minZ: -ez, maxZ: ez }
    const nx = Math.min(MAX_SEGMENTS, Math.max(1, Math.ceil((maxX - minX) / SHADOW_CELL)))
    const nz = Math.min(MAX_SEGMENTS, Math.max(1, Math.ceil((maxZ - minZ) / SHADOW_CELL)))
    return { nx, nz, minX, minZ, sx: (maxX - minX) / nx, sz: (maxZ - minZ) / nz }
  })
  let vertexCount = 0
  let indexCount = 0
  for (const g of grids) {
    vertexCount += (g.nx + 1) * (g.nz + 1)
    indexCount += g.nx * g.nz * 6
  }

  const position = new Float32Array(vertexCount * 3)
  const local = new Float32Array(vertexCount * 2)
  const box = new Float32Array(vertexCount * 4)
  const strength = new Float32Array(vertexCount)
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount)

  let v = 0
  let k = 0
  casters.forEach((c, ci) => {
    const { nx, nz, minX, minZ, sx, sz } = grids[ci]
    const cos = Math.cos(c.yaw ?? 0)
    const sin = Math.sin(c.yaw ?? 0)
    const worldX = (lx: number, lz: number) => c.x + lx * cos + lz * sin
    const worldZ = (lx: number, lz: number) => c.z - lx * sin + lz * cos
    const surface = c.ground ?? groundFn
    const ground = (lx: number, lz: number) => surface(worldX(lx, lz), worldZ(lx, lz)) + SHADOW_LIFT
    const radius = Math.min(c.radius ?? 0, c.halfX, c.halfZ)
    const base = v
    for (let j = 0; j <= nz; j++) {
      const lz = minZ + j * sz
      for (let i = 0; i <= nx; i++) {
        const lx = minX + i * sx
        position.set([worldX(lx, lz), ground(lx, lz), worldZ(lx, lz)], v * 3)
        local.set([lx, lz], v * 2)
        box.set([c.halfX, c.halfZ, radius, c.spread], v * 4)
        strength[v] = c.strength
        v++
      }
    }
    const y = (vi: number) => position[vi * 3 + 1]
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = base + j * (nx + 1) + i
        const b = a + 1
        const d = a + nx + 1
        const e = d + 1
        // Counter-clockwise seen from above (+Y).
        index.set([a, d, b, b, d, e], k)
        k += 6
        // The drawn terrain can fold inside a cell: raise each triangle by its worst deficit.
        const [ya, yb, yd, ye] = [y(a), y(b), y(d), y(e)]
        let lowAbd = 0
        let lowBde = 0
        for (let q = 0; q <= CELL_SAMPLES; q++) {
          for (let p = 0; p <= CELL_SAMPLES; p++) {
            const s = p / CELL_SAMPLES
            const t = q / CELL_SAMPLES
            const g = ground(minX + (i + s) * sx, minZ + (j + t) * sz)
            if (s + t <= 1) lowAbd = Math.max(lowAbd, g - (ya + s * (yb - ya) + t * (yd - ya)))
            if (s + t >= 1) lowBde = Math.max(lowBde, g - (ye + (1 - s) * (yd - ye) + (1 - t) * (yb - ye)))
          }
        }
        const both = Math.max(lowAbd, lowBde)
        position[a * 3 + 1] += lowAbd
        position[b * 3 + 1] += both
        position[d * 3 + 1] += both
        position[e * 3 + 1] += lowBde
      }
    }
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geo.setAttribute('aLocal', new THREE.BufferAttribute(local, 2))
  geo.setAttribute('aBox', new THREE.BufferAttribute(box, 4))
  geo.setAttribute('aStrength', new THREE.BufferAttribute(strength, 1))
  geo.setIndex(new THREE.BufferAttribute(index, 1))
  geo.computeBoundingSphere()
  return geo
}

const vertexShader = /* glsl */ `
  attribute vec2 aLocal;
  attribute vec4 aBox;
  attribute float aStrength;
  varying vec2 vLocal;
  varying vec4 vBox;
  varying float vStrength;
  #include <fog_pars_vertex>
  void main() {
    vLocal = aLocal;
    vBox = aBox;
    vStrength = aStrength;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vLocal;
  varying vec4 vBox;
  varying float vStrength;
  #include <fog_pars_fragment>

  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    float d = roundedBox(vLocal, vBox.xy, vBox.z);
    float inner = max(min(vBox.x, vBox.y), 1e-3);
    // Most of the footprint hides under the prop: the visible part is the penumbra.
    float penumbra = 1.0 - smoothstep(0.0, vBox.w, d);
    float core = smoothstep(0.0, inner, -d);
    float a = vStrength * penumbra * mix(0.85, 1.0, core);
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        a *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      #endif
    #endif
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

/** Fades out with the fog instead of being tinted by it; no depth write + negative polygon offset, so no z-fighting. */
export function createContactShadowMaterial(color: THREE.ColorRepresentation = '#000000'): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(color) } }]),
    fog: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  })
}
