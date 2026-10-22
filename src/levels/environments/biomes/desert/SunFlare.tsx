import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { sunOcclusion, type Occluder } from './sunOcclusion'

/**
 * Cheap lens flare for the low desert sun: two additive quads.
 *  - Core: a glow + star billboard at the sun's position, depth-tested, so the
 *    terrain, mesas and pyramid cut it off pixel-exactly.
 *  - Ghosts: one screen-space quad drawing a horizontal streak through the sun
 *    and a few ghost discs along the sun–centre line. It has no depth to test,
 *    so its strength follows `sunOcclusion` (a CPU ray march against the drawn
 *    terrain and the big occluders) and how far the sun is from the screen edge.
 */

/** In front of the sky dome (9900), inside the camera's far plane (11000). */
const CORE_DISTANCE = 8000
const CORE_SIZE = 2200
/** 1/s: how fast the ghosts follow occlusion changes. */
const FADE_RATE = 6

const coreVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const coreFragment = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float glow = exp(-d * d * 9.0) * 0.55 + exp(-d * 28.0) * 0.9;
  float a = atan(p.y, p.x);
  float rays = pow(abs(cos(a * 3.0)), 60.0) * exp(-d * 4.0) * 0.5;
  float fade = 1.0 - smoothstep(0.7, 1.0, d);
  gl_FragColor = vec4(uColor * (glow + rays) * fade, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const ghostVertex = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const ghostFragment = /* glsl */ `
uniform vec2 uSun;
uniform float uAspect;
uniform float uStrength;
uniform vec3 uColor;
varying vec2 vNdc;

float ghost(vec2 at, float radius) {
  vec2 d = (vNdc - at) * vec2(uAspect, 1.0);
  float r = length(d) / radius;
  return smoothstep(1.0, 0.75, r) * (0.35 + 0.65 * smoothstep(0.4, 0.95, r));
}

void main() {
  vec2 toSun = (vNdc - uSun) * vec2(uAspect, 1.0);
  float streak = exp(-abs(toSun.y) * 90.0) * exp(-abs(toSun.x) * 1.6) * 0.35;
  vec3 col = uColor * streak;
  col += vec3(1.0, 0.75, 0.45) * ghost(uSun * 0.45, 0.06) * 0.10;
  col += vec3(0.95, 0.55, 0.3) * ghost(uSun * -0.15, 0.10) * 0.07;
  col += vec3(0.6, 0.8, 1.0) * ghost(uSun * -0.55, 0.05) * 0.09;
  col += vec3(1.0, 0.65, 0.35) * ghost(uSun * -0.95, 0.16) * 0.06;
  gl_FragColor = vec4(col * uStrength, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function additive(params: THREE.ShaderMaterialParameters): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    ...params,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  })
}

export default function SunFlare({
  sunDirection,
  sunColor,
  groundFn,
  occluders,
}: {
  sunDirection: readonly [number, number, number]
  sunColor: number
  groundFn: HeightFunction
  occluders: readonly Occluder[]
}) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  const coreMat = useMemo(
    () =>
      additive({
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        uniforms: { uColor: { value: new THREE.Color(sunColor) } },
      }),
    [sunColor],
  )
  const ghostMat = useMemo(
    () =>
      additive({
        vertexShader: ghostVertex,
        fragmentShader: ghostFragment,
        uniforms: {
          uSun: { value: new THREE.Vector2() },
          uAspect: { value: 1 },
          uStrength: { value: 0 },
          uColor: { value: new THREE.Color(sunColor) },
        },
        depthTest: false,
      }),
    [sunColor],
  )
  const { core, ghosts } = useMemo(() => {
    const coreMesh = new THREE.Mesh(geometry, coreMat)
    coreMesh.scale.setScalar(CORE_SIZE / 2)
    coreMesh.frustumCulled = false
    coreMesh.renderOrder = 10
    coreMesh.name = 'SunFlareCore'
    const ghostMesh = new THREE.Mesh(geometry, ghostMat)
    ghostMesh.frustumCulled = false
    ghostMesh.renderOrder = 11
    ghostMesh.visible = false
    ghostMesh.name = 'SunFlareGhosts'
    return { core: coreMesh, ghosts: ghostMesh }
  }, [geometry, coreMat, ghostMat])

  const state = useMemo(
    () => ({
      dir: new THREE.Vector3(...sunDirection).normalize(),
      forward: new THREE.Vector3(),
      ndc: new THREE.Vector3(),
      strength: 0,
    }),
    [sunDirection],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      coreMat.dispose()
      ghostMat.dispose()
    }
  }, [geometry, coreMat, ghostMat])

  useFrame(({ camera, size }, delta) => {
    const { dir, forward, ndc } = state
    core.position.copy(camera.position).addScaledVector(dir, CORE_DISTANCE)
    core.quaternion.copy(camera.quaternion)

    camera.getWorldDirection(forward)
    let target = 0
    if (forward.dot(dir) > 0.05) {
      ndc.copy(core.position).project(camera)
      const edge = Math.max(Math.abs(ndc.x), Math.abs(ndc.y))
      const onScreen = 1 - THREE.MathUtils.smoothstep(edge, 0.8, 1.2)
      if (onScreen > 0) {
        target = onScreen * (1 - sunOcclusion(camera.position, dir, groundFn, occluders))
        ;(ghostMat.uniforms.uSun.value as THREE.Vector2).set(ndc.x, ndc.y)
      }
    }
    state.strength += (target - state.strength) * Math.min(1, delta * FADE_RATE)
    ghostMat.uniforms.uStrength.value = state.strength
    ghostMat.uniforms.uAspect.value = size.width / Math.max(1, size.height)
    ghosts.visible = state.strength > 0.01
  })

  return (
    <>
      <primitive object={core} />
      <primitive object={ghosts} />
    </>
  )
}
