import * as THREE from 'three'
import { STREET_GRID } from './config'

/**
 * Neon Metropolis's two patched materials (#323): the towers' window grid and the wet asphalt with its street grid.
 * Both work in world units from the fragment's world position, so every tower and street matches at any scale.
 */

const HASH = /* glsl */ `
float cityHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`

/** A window bay's width and a storey's height (world units). */
const BAY = 11
const STOREY = 13

const towerVertexHead = /* glsl */ `
varying vec3 vCityPos;
varying vec3 vCityNormal;
varying vec3 vCityTower; // x: seed, y: base, z: top
`

// The towers are an axis-aligned unit box scaled per instance, so the object normal names the face.
const towerVertexBody = /* glsl */ `
vCityPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vCityNormal = normal;
vCityTower = vec3(
  fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453),
  instanceMatrix[3].y,
  instanceMatrix[3].y + length(instanceMatrix[1].xyz)
);
`

const towerFragmentHead = /* glsl */ `
varying vec3 vCityPos;
varying vec3 vCityNormal;
varying vec3 vCityTower;
${HASH}
`

// Lit windows by storey and bay, a share of them per tower; past a few pixels a window fades to the facade's average
// glow so the far towers shimmer neither in nor out. Some towers wear a cool rim at the roof line for the dark rule.
const towerFragmentBody = /* glsl */ `
{
  float seed = vCityTower.x;
  float wall = 1.0 - step(0.5, abs(vCityNormal.y));
  float across = abs(vCityNormal.x) > 0.5 ? vCityPos.z : vCityPos.x;
  vec2 cellUv = vec2(across / ${BAY.toFixed(1)}, (vCityPos.y - vCityTower.y) / ${STOREY.toFixed(1)});
  vec2 cell = floor(cellUv);
  vec2 f = fract(cellUv);
  float pane = step(0.18, f.x) * step(f.x, 0.82) * step(0.28, f.y) * step(f.y, 0.78);
  float faceSalt = vCityNormal.x * 31.7 + vCityNormal.z * 57.3;
  float h = cityHash(cell + vec2(seed * 113.0 + faceSalt, faceSalt));
  float litShare = 0.18 + 0.4 * seed;
  float lit = step(1.0 - litShare, h);
  float tintPick = cityHash(cell.yx + seed * 71.0);
  vec3 tint = tintPick < 0.62 ? vec3(1.0, 0.72, 0.42) : (tintPick < 0.9 ? vec3(0.45, 0.8, 1.0) : vec3(1.0, 0.35, 0.8));
  float aa = 1.0 - smoothstep(0.25, 0.6, max(fwidth(cellUv.x), fwidth(cellUv.y)));
  float ground = step(1.0, cell.y);
  vec3 windows = mix(vec3(1.0, 0.75, 0.55) * litShare * 0.33, tint * pane * lit, aa) * ground * wall;
  float rim = step(0.55, seed) * step(vCityTower.z - 2.5, vCityPos.y) * wall;
  totalEmissiveRadiance += windows * 1.6 + rim * vec3(0.25, 0.85, 1.0) * 1.4;
}
`

/** The towers' facade: dark glossy glass that reflects the sky's haze, lit windows on the shared box. */
export function createTowerMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0x1a1a26, roughness: 0.38, metalness: 0.55 })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${towerVertexHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${towerVertexBody}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${towerFragmentHead}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${towerFragmentBody}`)
  }
  material.customProgramCacheKey = () => 'city-tower-windows'
  return material
}

const asphaltVertexHead = /* glsl */ `
varying vec3 vStreetPos;
`

const asphaltVertexBody = /* glsl */ `
vStreetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

const asphaltFragmentHead = /* glsl */ `
varying vec3 vStreetPos;
${HASH}
`

// Distance from the nearest street's centre line, per axis: streets run along x and z every pitch, offset half a
// pitch so the blocks centre on the grid points the towers use.
const asphaltColour = /* glsl */ `
float streetKerb = 0.0;
float streetPaint = 0.0;
float streetMask = 0.0;
{
  const float PITCH = ${STREET_GRID.pitch.toFixed(1)};
  const float HALF = ${(STREET_GRID.street / 2).toFixed(1)};
  vec2 local = abs(mod(vStreetPos.xz + PITCH * 0.5, PITCH) - PITCH * 0.5);
  vec2 fromCentre = PITCH * 0.5 - local; // 0 on a street's centre line
  float inStreet = max(step(fromCentre.x, HALF), step(fromCentre.y, HALF));
  streetMask = inStreet;
  // A kerb band on the block side of each street, the dashed amber centre line down the middle
  float kerbX = step(HALF, fromCentre.x) * step(fromCentre.x, HALF + 4.0);
  float kerbZ = step(HALF, fromCentre.y) * step(fromCentre.y, HALF + 4.0);
  streetKerb = max(kerbX, kerbZ) * (1.0 - inStreet);
  float dashX = step(fromCentre.x, 1.2) * step(0.5, fract(vStreetPos.z / 24.0));
  float dashZ = step(fromCentre.y, 1.2) * step(0.5, fract(vStreetPos.x / 24.0));
  // A dash only where the other street isn't crossing
  streetPaint = max(dashX * step(HALF, fromCentre.y), dashZ * step(HALF, fromCentre.x));
  float aa = 1.0 - smoothstep(0.6, 2.0, fwidth(vStreetPos.x) + fwidth(vStreetPos.z));
  streetPaint *= aa;
  streetKerb *= aa;
  float grit = 0.85 + 0.3 * cityHash(floor(vStreetPos.xz / 3.0));
  diffuseColor.rgb *= mix(1.6, 0.75, inStreet) * grit;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18, 0.17, 0.2), streetKerb);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.38, 0.08), streetPaint);
}
`

// Wet: the streets nearly a mirror for the sky's haze, the pavements rougher, puddles in the low cells
const asphaltRoughness = /* glsl */ `
{
  float puddle = smoothstep(0.55, 0.7, cityHash(floor(vStreetPos.xz / 40.0)));
  roughnessFactor = mix(0.62, mix(0.22, 0.06, puddle), streetMask);
}
`

/** The city's ground: wet asphalt streets and pale pavement blocks on the vertex-coloured terrain (`COLOR_RAMP`). */
export function createAsphaltMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35 })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${asphaltVertexHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${asphaltVertexBody}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${asphaltFragmentHead}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${asphaltColour}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${asphaltRoughness}`)
  }
  material.customProgramCacheKey = () => 'city-wet-asphalt'
  return material
}
