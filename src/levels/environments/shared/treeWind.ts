import * as THREE from 'three'

/** Seconds since start; the one value TreeField updates per frame, shared by every tree material. */
export const treeWindTime = { value: 0 }

/** A mesh's place on its tree: h/H = base + span · local y, and its instance Y scale is span · H. */
export interface TreePart {
  base: number
  span: number
}

export const TRUNK_PART: TreePart = { base: 0.3, span: 0.6 }
export const CANOPY_PART: TreePart = { base: 0.75, span: 0.5 }

const WIND_PARS = /* glsl */ `
uniform float uWindTime;
uniform vec2 uTreePart;
`

const WIND_BEND = /* glsl */ `
#ifdef USE_INSTANCING
  {
    const vec2 WIND_DIR = vec2(0.8, 0.6);
    const float GUST_WAVENUMBER = 6.2831853 / 520.0; // gust fronts ~520 units apart
    const float GUST_SPEED = 45.0;                  // units per second, downwind
    vec2 treeXZ = instanceMatrix[3].xz;
    float treeHeight = length(instanceMatrix[1].xyz) / uTreePart.y;
    float h = clamp(uTreePart.x + uTreePart.y * transformed.y, 0.0, 1.25);
    float bend = h * h * treeHeight; // H·(h/H)²: base planted, crown moves most
    float seed = fract(sin(dot(treeXZ, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
    // Travelling wave over world XZ, so gust fronts roll across the level downwind.
    float gust = 0.5 + 0.5 * sin(GUST_WAVENUMBER * (dot(treeXZ, WIND_DIR) - GUST_SPEED * uWindTime));
    gust *= gust;
    float flutter = sin(uWindTime * 1.7 + seed) + 0.4 * sin(uWindTime * 3.1 + seed * 2.3);
    float along = 0.03 + 0.09 * gust + 0.012 * flutter;
    float across = 0.015 * sin(uWindTime * 1.3 + seed * 1.7);
    vec2 sway = (WIND_DIR * along + vec2(-WIND_DIR.y, WIND_DIR.x) * across) * bend;
    // World units to local: tree instance matrices are translate + scale, never rotated.
    transformed.x += sway.x / length(instanceMatrix[0].xyz);
    transformed.z += sway.y / length(instanceMatrix[2].xyz);
  }
#endif
`

/** Sways a tree material in the wind (vertex shader only); returns the same material. */
export function withTreeWind<T extends THREE.Material>(material: T, part: TreePart): T {
  const uTreePart = { value: new THREE.Vector2(part.base, part.span) }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = treeWindTime
    shader.uniforms.uTreePart = uTreePart
    shader.vertexShader = patchTreeWindVertex(shader.vertexShader)
  }
  // The part lives in a uniform, so trunks and canopies share one shader source.
  material.customProgramCacheKey = () => 'sc-tree-wind'
  return material
}

export function patchTreeWindVertex(vertexShader: string): string {
  return vertexShader
    .replace('#include <common>', `#include <common>\n${WIND_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND_BEND}`)
}

/** Darkens the crown's underside; also the `color` attribute `vertexColors` needs (without it canopies render black). */
export function bakeCrownShade(geometry: THREE.BufferGeometry, underside = 0.55): void {
  const pos = geometry.getAttribute('position')
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox!
  const range = max.y - min.y || 1
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / range
    const shade = underside + (1 - underside) * Math.sqrt(t)
    colors[i * 3] = shade
    colors[i * 3 + 1] = shade
    colors[i * 3 + 2] = shade
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}
