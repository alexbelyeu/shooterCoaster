import * as THREE from 'three'
import type { AtmosphereConfig } from '../atmosphere'

/**
 * Aerial perspective (#836): the fog takes on the sky in the view direction, warmer and brighter towards the sun,
 * cooler (the sky's zenith) away from it. One patch of three's fog chunks for every material that includes them
 * (`installAerialFog`, once at startup, before any program compiles), reading three shared uniforms:
 *
 * - `uAerialSun`: xyz the sun's heading (world space, on the ground plane), w the strength (0 is three's own fog).
 * - `uAerialSunTint`: the haze's colour looking into the sun (linear).
 * - `uAerialAway`: its colour looking away from the sun (linear).
 *
 * The values are plain `{x, y, z, w}` objects, not `Vector3`s: `UniformsUtils.clone` (each built-in material's copy
 * of its `ShaderLib` uniforms, and every `ShaderMaterial` merging `UniformsLib.fog`) copies three's math types but
 * passes any other object through by reference, so every material reads these same objects and one write per frame
 * (`setAerialFog`) reaches all of them. A material without them (a dev page, a shader built before the install)
 * reads zeros: strength 0, three's fog. `BiomeEnvironment` sets a level's strength and puts it back to 0 as it
 * unmounts; the title sets 0 itself and keeps its flat horizon fog (the poster's still is drawn from it).
 *
 * The tint fades out as the fog closes in fully (`1 - fogFactor⁴`), so a fully fogged horizon is still the dome's
 * horizon colour and the line where the terrain meets the sky stays seamless.
 */

export interface AerialFogConfig {
  /** The haze looking into the sun, sRGB hex. Default: the horizon brightened by the sun's light colour. */
  sunTint?: number
  /** The haze looking away from the sun, sRGB hex. Default: the sky's zenith. */
  away?: number
  /** 0 (three's flat fog) to 1. Default `DEFAULT_STRENGTH`, 0 for a sky without a sun glow (an interior). */
  strength?: number
}

interface Vec3 {
  x: number
  y: number
  z: number
}

export interface AerialFogValues {
  /** The sun's heading: its direction flattened onto the ground, so the tint follows which way the ride faces. */
  sunDir: Vec3
  /** Linear RGB */
  sunTint: Vec3
  /** Linear RGB */
  away: Vec3
  strength: number
}

export const DEFAULT_STRENGTH = 0.8
/** How much of the sun light's colour the default sun tint adds to the horizon. */
const SUN_TINT_GAIN = 0.35

const ZERO = { x: 0, y: 0, z: 0 }
export const AERIAL_OFF: AerialFogValues = { sunDir: ZERO, sunTint: ZERO, away: ZERO, strength: 0 }

const rgb = (c: THREE.Color): Vec3 => ({ x: c.r, y: c.g, z: c.b })
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

/** A biome's aerial fog: its `aerialFog` overrides over defaults from its sky. */
export function resolveAerialFog(atmosphere: Pick<AtmosphereConfig, 'sky' | 'sunDirection' | 'sunLightColor' | 'aerialFog'>): AerialFogValues {
  const { sky, sunDirection, aerialFog } = atmosphere
  const [x, , z] = sunDirection
  const len = Math.hypot(x, z)
  // A sun straight overhead has no side of the world to warm
  if (len < 1e-3) return AERIAL_OFF
  const sunTint =
    aerialFog?.sunTint !== undefined
      ? new THREE.Color(aerialFog.sunTint)
      : new THREE.Color(sky.horizon).add(new THREE.Color(atmosphere.sunLightColor).multiplyScalar(SUN_TINT_GAIN))
  const away = new THREE.Color(aerialFog?.away ?? sky.zenith)
  const strength = clamp01(aerialFog?.strength ?? (sky.sunGlow > 0 ? DEFAULT_STRENGTH : 0))
  return { sunDir: { x: x / len, y: 0, z: z / len }, sunTint: rgb(sunTint), away: rgb(away), strength }
}

const sun = { x: 0, y: 0, z: 0, w: 0 }
const sunTint = { x: 0, y: 0, z: 0 }
const away = { x: 0, y: 0, z: 0 }

export const AERIAL_UNIFORMS = {
  uAerialSun: { value: sun },
  uAerialSunTint: { value: sunTint },
  uAerialAway: { value: away },
}

/** Writes `values` into the shared uniforms, its strength scaled by `damp` (0–1): every frame, no allocation. */
export function setAerialFog(values: AerialFogValues, damp = 1): void {
  Object.assign(sun, values.sunDir).w = values.strength * clamp01(damp)
  Object.assign(sunTint, values.sunTint)
  Object.assign(away, values.away)
}

/**
 * The vertex stage does the geometry once per vertex, not per pixel: `vAerial` is (cosine between the view ray and
 * the sun's heading, strength), interpolated over the triangle. `uAerialSun` lives only in the vertex stage and the
 * colours only in the fragment stage, so no uniform is declared in both (a precision mismatch there fails the link).
 */
export const AERIAL_PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
uniform vec4 uAerialSun;
varying vec2 vAerial;
#endif
`

export const AERIAL_VERTEX = /* glsl */ `
#ifdef USE_FOG
vAerial = vec2(dot(mvPosition.xyz, (viewMatrix * vec4(uAerialSun.xyz, 0.)).xyz) / max(length(mvPosition.xyz), 1e-4), uAerialSun.w);
#endif
`

/**
 * `aerialFogColor(fogFactor, aerial)`: the fog colour along this pixel's view ray. Takes `vAerial` as an argument so
 * a shader that includes these pars without three's fog vertex chunk never reads the varying.
 */
export const AERIAL_PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
uniform vec3 uAerialSunTint;
uniform vec3 uAerialAway;
varying vec2 vAerial;
vec3 aerialFogColor(float f, vec2 a) {
f *= f;
float r = a.y * (1. - f * f), t = max(a.x, 0.);
return mix(mix(fogColor, uAerialSunTint, t * t * r), uAerialAway, max(-a.x, 0.) * r);
}
#endif
`

/** Three's fog line, which the install points at the aerial colour (`aerialFog.test.ts` fails if a three upgrade changes it). */
const FOG_MIX = 'mix( gl_FragColor.rgb, fogColor, fogFactor )'

/**
 * Patches three's fog chunks and adds the shared uniforms to every `ShaderLib` shader that has fog and to
 * `UniformsLib.fog`. Call once at startup, before the first render: three caches a built-in material's program by
 * its parameters, not its source, so a program compiled before the install would keep the flat fog. Idempotent.
 */
export function installAerialFog(): void {
  if ('uAerialSun' in THREE.UniformsLib.fog) return
  const chunks = THREE.ShaderChunk as Record<string, string>
  chunks.fog_pars_vertex += AERIAL_PARS_VERTEX
  chunks.fog_vertex += AERIAL_VERTEX
  chunks.fog_pars_fragment += AERIAL_PARS_FRAGMENT
  chunks.fog_fragment = chunks.fog_fragment.replace(FOG_MIX, 'mix( gl_FragColor.rgb, aerialFogColor( fogFactor, vAerial ), fogFactor )')
  Object.assign(THREE.UniformsLib.fog, AERIAL_UNIFORMS)
  for (const shader of Object.values(THREE.ShaderLib)) {
    if ('fogColor' in shader.uniforms) Object.assign(shader.uniforms, AERIAL_UNIFORMS)
  }
}
