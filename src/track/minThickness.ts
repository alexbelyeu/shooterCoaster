import * as THREE from 'three'
import {
  type PixelFloor,
  PIXEL_FLOOR_FADE_END,
  PIXEL_FLOOR_FADE_START,
  TRACK_FOG_REACH,
} from './trackDimensions'

/**
 * Vertex patch mirroring `minThicknessPush` (`trackDimensions.ts`). Geometry carries `aThick` = (unit
 * cross-section direction, real radius); zeros leave a vertex alone. Instances must be unscaled.
 */

/** Drawing-buffer height in pixels; the one value `TrackMesh` updates, on resize or a dpr change. */
export const trackViewportHeight = { value: 720 }

const PARS = /* glsl */ `
attribute vec4 aThick;
uniform vec2 uPixelFloor;
uniform float uViewportHeight;
`

const PUSH = /* glsl */ `
{
  vec4 scView = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  scView = instanceMatrix * scView;
#endif
  scView = modelViewMatrix * scView;
  float scDepth = max(-scView.z, 0.0);
  float scPixels = mix(uPixelFloor.x, uPixelFloor.y, smoothstep(${PIXEL_FLOOR_FADE_START.toFixed(1)}, ${PIXEL_FLOOR_FADE_END.toFixed(1)}, scDepth));
  float scMinRadius = 2.0 * scDepth * scPixels / (projectionMatrix[1][1] * uViewportHeight);
  transformed += aThick.xyz * max(scMinRadius - aThick.w, 0.0);
}
`

/** Adds the thickness floor to `material` (keeps any earlier `onBeforeCompile`); returns the same material. */
export function withMinThickness<T extends THREE.Material>(material: T, floor: PixelFloor): T {
  const prevCompile = material.onBeforeCompile
  const prevKey = material.customProgramCacheKey
  const uPixelFloor = { value: new THREE.Vector2(floor.near, floor.far) }
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile.call(material, shader, renderer)
    shader.uniforms.uPixelFloor = uPixelFloor
    shader.uniforms.uViewportHeight = trackViewportHeight
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${PUSH}`)
  }
  material.customProgramCacheKey = () => `${prevKey.call(material)}|sc-min-thickness`
  return material
}

/** The scene's linear fog ending at `TRACK_FOG_REACH` of its span; exponential fog is left as three draws it. */
const TRACK_FOG = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, mix( fogNear, fogFar, ${TRACK_FOG_REACH.toFixed(3)} ), vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`

/** Fogs `material` sooner than the scene, so far track recedes into the sky tint (#327); returns the same material. */
export function withTrackHaze<T extends THREE.Material>(material: T): T {
  const prevCompile = material.onBeforeCompile
  const prevKey = material.customProgramCacheKey
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile.call(material, shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', TRACK_FOG)
  }
  material.customProgramCacheKey = () => `${prevKey.call(material)}|sc-track-haze`
  return material
}
