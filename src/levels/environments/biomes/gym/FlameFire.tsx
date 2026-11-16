import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { isCoarsePointer, useQualityProfile } from '@/canvas/useRenderBudget'
import ParticleField from '../../shared/ParticleField'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { gradientNoiseGlsl } from '../../shared/noiseGlsl'
import { buildFlameFireShell, emberAnchor, flamePool } from './flameFire'

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec3 aFire;
  varying vec3 vFire;

  void main() {
    vFire = aFire;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uPerimeter;
  uniform vec3 uHeights; // the mats, the Flame's top, the plume's crest
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uEdge;
  uniform vec3 uPool;
  // The fire: metres round the Flame, world height, 0. The pool: its ellipse's -1..1 along and across, 1.
  varying vec3 vFire;

  ${gradientNoiseGlsl}

  // Metres before the seam where the noise crossfades into its start, so it wraps without a line
  const float SEAM = 40.0;

  float tongues(vec2 m) {
    // Streaks far taller than wide, rising; a slow sideways warp makes them lick and sway, a fine
    // faster noise breaks their edges up
    float warp = gnoise(vec2(m.x / 30.0, m.y / 40.0 - uTime * 0.5));
    float streak = fbm(vec2(m.x / 13.0 + warp * 0.8, m.y / 50.0 - uTime * 1.1));
    return streak + 0.25 * gnoise(vec2(m.x / 6.0, m.y / 12.0 - uTime * 1.8));
  }

  vec3 fire(vec2 m) {
    float n = tongues(m);
    if (m.x > uPerimeter - SEAM) {
      n = mix(n, tongues(m - vec2(uPerimeter, 0.0)), smoothstep(uPerimeter - SEAM, uPerimeter, m.x));
    }
    float up = clamp((m.y - uHeights.x) / (uHeights.y - uHeights.x), 0.0, 1.0);
    float above = clamp((m.y - uHeights.y) / (uHeights.z - uHeights.y), 0.0, 1.0);
    // Low licks at the foot, the blaze up the flare and over the lip, only the tallest tongues reach the crest;
    // the gaps between tongues show the Flame's own paint
    float heat = mix(-0.1, 0.08, smoothstep(0.15, 0.8, up)) - 0.3 * above;
    float k = smoothstep(0.0, 0.28, heat + 1.6 * n);
    vec3 col = mix(uEdge, uMid, smoothstep(0.1, 0.55, k));
    col = mix(col, uCore, smoothstep(0.8, 1.0, k) * (1.0 - above));
    return col * k * (1.0 - 0.6 * above * above);
  }

  vec3 pool(vec2 e) {
    float flicker = 0.82 + 0.1 * sin(uTime * 7.3) + 0.08 * sin(uTime * 12.9 + 1.7);
    return uPool * (1.0 - smoothstep(0.3, 1.0, length(e))) * flicker;
  }

  void main() {
    vec3 rgb = vFire.z > 0.5 ? pool(vFire.xy) : fire(vFire.xy);
    #ifdef USE_FOG
      // Additive: fog fades the light out rather than tinting it
      rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    // Finite and bounded, whatever the noise does (#344: one bad pixel blacks out Bloom)
    gl_FragColor = vec4(clamp(rgb, 0.0, 2.0), 1.0);
  }
`

const EMBER_ANCHOR = emberAnchor()

/** The fire's skin and plume and, in the same mesh (one draw call), the light pool's quad on the mats. */
function fireGeometry(): { geometry: THREE.BufferGeometry; shell: ReturnType<typeof buildFlameFireShell> } {
  const shell = buildFlameFireShell()
  const pool = flamePool()
  const count = shell.positions.length / 3
  const positions = new Float32Array((count + 4) * 3)
  const attrs = new Float32Array((count + 4) * 3)
  positions.set(shell.positions)
  for (let i = 0; i < count; i++) attrs.set([shell.fire[i * 2], shell.fire[i * 2 + 1], 0], i * 3)
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  corners.forEach(([ex, ez], k) => {
    const c = pool.centre
    positions.set([c.x + ex * pool.halfX, c.y, c.z + ez * pool.halfZ], (count + k) * 3)
    attrs.set([ex, ez, 1], (count + k) * 3)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aFire', new THREE.BufferAttribute(attrs, 3))
  geometry.setIndex([...shell.indices, count, count + 2, count + 1, count, count + 3, count + 2])
  return { geometry, shell }
}

/**
 * The Flame burns (#520): fire licking up its faces and over its top and the warm pool its light throws on
 * the mats (one additive mesh, scrolling noise), and embers rising off it (an anchored `ParticleField`).
 * Two draw calls; the fire's noise drops an octave on phones and on low quality.
 */
export default function FlameFire() {
  const lean = isCoarsePointer || !useQualityProfile().bloom
  const fire = useMemo(fireGeometry, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        defines: lean ? { FBM_OCTAVES: 3 } : {},
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0 },
            uPerimeter: { value: fire.shell.perimeter },
            uHeights: { value: new THREE.Vector3(fire.shell.base, fire.shell.top, fire.shell.crest) },
            uCore: { value: new THREE.Color(1.0, 0.8, 0.45) },
            uMid: { value: new THREE.Color(1.0, 0.36, 0.06) },
            uEdge: { value: new THREE.Color(0.5, 0.05, 0.02) },
            uPool: { value: new THREE.Color(0.42, 0.15, 0.04) },
          },
        ]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: true,
      }),
    [fire, lean],
  )
  useEffect(() => () => fire.geometry.dispose(), [fire])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <>
      <mesh geometry={fire.geometry} material={material} />
      <ParticleField preset={PARTICLE_PRESETS.gymFlameEmbers} anchor={EMBER_ANCHOR} />
    </>
  )
}
