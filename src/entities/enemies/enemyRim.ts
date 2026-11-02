import * as THREE from 'three'

/**
 * Fresnel rim light for enemy materials.
 *
 * Adds `rimColor * intensity * (1 - N·V)^power` to the lit colour just before
 * output (and before fog), so every enemy gets a bright silhouette edge that
 * separates it from terrain and sky regardless of the biome's lighting.
 *
 * It also scales the scene fog for enemies (`fog`, default 0.6): enemies keep
 * more of their colour at distance than the terrain behind them, which is the
 * single biggest readability win in the pale arctic/desert fog.
 *
 * Works with MeshPhongMaterial, MeshStandardMaterial and MeshPhysicalMaterial
 * (all expose `normal` and `vViewPosition` in the fragment shader). The patch is
 * applied once to each shared singleton material; rim parameters are per-material
 * uniforms, so all rim materials of the same type share one compiled program.
 */
export interface RimOptions {
  color?: THREE.ColorRepresentation
  /** Peak added radiance at grazing angles (linear). */
  intensity?: number
  /** Fresnel exponent: higher = thinner edge. */
  power?: number
  /** Multiplier on the scene fog factor for this material (1 = normal fog). */
  fog?: number
}

export interface RimUniforms {
  uRimColor: { value: THREE.Color }
  uRimIntensity: { value: number }
  uRimPower: { value: number }
  uEnemyFog: { value: number }
}

type LitMaterial = THREE.MeshPhongMaterial | THREE.MeshStandardMaterial

/** Warm white, ~0.6 — the default from the readability spec (issue #15). */
export const DEFAULT_RIM: Required<RimOptions> = {
  color: '#fff0dc',
  intensity: 0.6,
  power: 2.5,
  fog: 0.6,
}

const RIM_CACHE_KEY = 'sc-enemy-rim-v2'

const RIM_PARS = /* glsl */ `
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform float uRimPower;
uniform float uEnemyFog;
`

const RIM_APPLY = /* glsl */ `
{
  float rimNdV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  outgoingLight += uRimColor * (uRimIntensity * pow(1.0 - rimNdV, uRimPower));
}
#include <opaque_fragment>
`

const ENEMY_FOG = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * uEnemyFog );
#endif
`

/**
 * Patch a shared enemy material with the rim term. Returns the same material so
 * it can wrap a `new THREE.Mesh*Material(...)` expression. Idempotent.
 */
export function withRim<T extends LitMaterial>(material: T, options: RimOptions = {}): T {
  if (material.userData.rim) return material
  const uniforms: RimUniforms = {
    uRimColor: { value: new THREE.Color(options.color ?? DEFAULT_RIM.color) },
    uRimIntensity: { value: options.intensity ?? DEFAULT_RIM.intensity },
    uRimPower: { value: options.power ?? DEFAULT_RIM.power },
    uEnemyFog: { value: options.fog ?? DEFAULT_RIM.fog },
  }
  material.userData.rim = uniforms
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = uniforms.uRimColor
    shader.uniforms.uRimIntensity = uniforms.uRimIntensity
    shader.uniforms.uRimPower = uniforms.uRimPower
    shader.uniforms.uEnemyFog = uniforms.uEnemyFog
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${RIM_PARS}`)
      .replace('#include <opaque_fragment>', RIM_APPLY)
      .replace('#include <fog_fragment>', ENEMY_FOG)
  }
  // Same key for every rim material: the shader source is identical and the
  // per-material values live in uniforms, so programs are shared per material type.
  material.customProgramCacheKey = () => RIM_CACHE_KEY
  return material
}
