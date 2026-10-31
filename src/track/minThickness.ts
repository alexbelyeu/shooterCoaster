import * as THREE from 'three'

/**
 * Vertex patch mirroring `minThicknessPush` (`trackDimensions.ts`). Geometry carries `aThick` = (unit
 * cross-section direction, real radius); zeros leave a vertex alone. Instances must be unscaled.
 */

/** Drawing-buffer height in pixels; the one value `TrackMesh` updates, on resize or a dpr change. */
export const trackViewportHeight = { value: 720 }

const PARS = /* glsl */ `
attribute vec4 aThick;
uniform float uMinPixelRadius;
uniform float uViewportHeight;
`

const PUSH = /* glsl */ `
{
  vec4 scView = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  scView = instanceMatrix * scView;
#endif
  scView = modelViewMatrix * scView;
  float scMinRadius = 2.0 * max(-scView.z, 0.0) * uMinPixelRadius / (projectionMatrix[1][1] * uViewportHeight);
  transformed += aThick.xyz * max(scMinRadius - aThick.w, 0.0);
}
`

/** Adds the thickness floor to `material` (keeps any earlier `onBeforeCompile`); returns the same material. */
export function withMinThickness<T extends THREE.Material>(material: T, minPixelRadius: number): T {
  const prevCompile = material.onBeforeCompile
  const prevKey = material.customProgramCacheKey
  const uMinPixelRadius = { value: minPixelRadius }
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile.call(material, shader, renderer)
    shader.uniforms.uMinPixelRadius = uMinPixelRadius
    shader.uniforms.uViewportHeight = trackViewportHeight
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${PUSH}`)
  }
  material.customProgramCacheKey = () => `${prevKey.call(material)}|sc-min-thickness`
  return material
}
