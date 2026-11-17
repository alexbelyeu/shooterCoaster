import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { isCoarsePointer, useFbmOctaves, useQualityProfile } from '@/canvas/useRenderBudget'
import ParticleField from '../../shared/ParticleField'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { gradientNoiseGlsl } from '../../shared/noiseGlsl'
import { buildFlameTongues, emberAnchor, fireHeights, flamePool, tongueCount } from './flameFire'

const tongueVertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec4 aStart; // xyz, heat
  attribute vec3 aMid;
  attribute vec3 aEnd;
  attribute vec4 aTongue; // phase, life (s), width, seed
  uniform float uTime;
  varying vec2 vUv;
  varying float vHeat;
  varying float vSeed;
  varying float vAge;

  ${gradientNoiseGlsl}

  void main() {
    float cycle = uTime / aTongue.y + aTongue.x;
    float age = fract(cycle);
    // Every life is a new tongue: its own shape, sway and pace, so the fire never repeats
    float seed = fract(aTongue.w + floor(cycle) * 0.618034);

    // Slow at the root, accelerating up: a quadratic through the path's middle
    float t = age * (0.35 + 0.65 * age);
    vec3 c = 2.0 * aMid - 0.5 * (aStart.xyz + aEnd);
    float u = 1.0 - t;
    vec3 centre = u * u * aStart.xyz + 2.0 * u * t * c + t * t * aEnd;

    // Grows from its root, then stretches thinner and taller as it rises and breaks off
    float width = aTongue.z * (0.75 + 0.5 * seed) * smoothstep(0.0, 0.25, age) * (1.0 - 0.4 * age);
    float height = width * (1.7 + 1.6 * age);

    // Turned to the camera round the vertical, so tongues stay upright as the coaster circles them
    vec3 toCamera = cameraPosition - centre;
    vec2 flat2 = toCamera.xz;
    float flatLength = length(flat2);
    vec3 right = flatLength > 1e-3 ? vec3(flat2.y, 0.0, -flat2.x) / flatLength : vec3(1.0, 0.0, 0.0);

    // Turbulence: the whole tongue drifts, its tip whips further and faster than its root
    float wave = uTime * (0.8 + 0.6 * seed);
    vec3 drift = vec3(gnoise(vec2(seed * 41.0, wave)), 0.0, gnoise(vec2(seed * 23.0 + 7.0, wave)));
    vec3 whip = vec3(gnoise(vec2(seed * 13.0, wave * 2.3)), 0.0, gnoise(vec2(seed * 31.0 + 3.0, wave * 2.3)));
    vec3 sway = width * (drift * 0.5 * age + whip * 0.7 * uv.y * uv.y);

    vec3 p = centre + right * (uv.x - 0.5) * width + vec3(0.0, (uv.y - 0.12) * height, 0.0) + sway;
    vUv = uv;
    vHeat = aStart.w;
    vSeed = seed;
    vAge = age;
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const tongueFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  varying vec2 vUv;
  varying float vHeat;
  varying float vSeed;
  varying float vAge;

  ${gradientNoiseGlsl}

  // Blackbody-ish ramp: deep red, orange, yellow, a white-hot core; past 1 for Bloom, tone mapped by the composer
  vec3 blackbody(float t) {
    vec3 col = vec3(0.55, 0.06, 0.015) * smoothstep(0.0, 0.25, t);
    col = mix(col, vec3(1.3, 0.38, 0.06), smoothstep(0.2, 0.5, t));
    col = mix(col, vec3(2.2, 1.15, 0.3), smoothstep(0.45, 0.78, t));
    return mix(col, vec3(3.2, 2.6, 1.6), smoothstep(0.78, 1.0, t));
  }

  void main() {
    // Clamped: MSAA samples an edge pixel's varyings at its centre, a little off the quad, and pow(1 - y) of y > 1 is NaN
    float x = clamp(vUv.x, 0.0, 1.0) * 2.0 - 1.0;
    float y = clamp(vUv.y, 0.0, 1.0);
    // Noise scrolling up through the tongue faster than it rises: the flicker inside it
    float n = fbm(vec2(x * 1.4 + vSeed * 19.0, y * 1.9 - uTime * 2.2 + vSeed * 11.0));
    float fine = gnoise(vec2(x * 3.6 - vSeed * 7.0, y * 4.5 - uTime * 3.7));
    // Licks: the tongue's spine wanders more towards its tip
    float xd = x + (n * 1.1 + fine * 0.3) * y;
    // A teardrop: round root, tapering tip
    float halfWidth = 0.78 * pow(max(1.0 - y, 0.0), 0.55) * smoothstep(0.0, 0.2, y) + 0.001;
    float body = clamp(1.0 - abs(xd) / halfWidth, 0.0, 1.0);
    float density = smoothstep(0.0, 0.85, body) * (1.0 - smoothstep(0.4, 0.95, y - n * 0.4));
    // Tears apart higher up into separate wisps
    density *= smoothstep(-0.3, 0.3, n + fine * 0.5 + 0.5 - 0.75 * y * (0.6 + vAge));
    // Fades in at its root, out as it burns away
    density *= smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.7, 1.0, vAge));

    // Hottest in the core and low, cooling to red at its edges, its tip and with age
    float heat = density * vHeat * (1.1 - 0.55 * vAge) * (1.0 - 0.35 * y);
    vec3 rgb = blackbody(heat) * density;
    // The cooler outer flame dims what's behind it a little, so the cores read in front of darker fire
    float alpha = density * 0.28;
    #ifdef USE_FOG
      float fade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      rgb *= fade;
      alpha *= fade;
    #endif
    // Finite and bounded, whatever the noise does (#344: one bad pixel blacks out Bloom)
    gl_FragColor = vec4(clamp(rgb, 0.0, 4.0), clamp(alpha, 0.0, 1.0));
  }
`

const poolVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vEllipse;

  void main() {
    vEllipse = uv * 2.0 - 1.0;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const poolFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uPool;
  varying vec2 vEllipse;

  void main() {
    float flicker = 0.82 + 0.1 * sin(uTime * 7.3) + 0.08 * sin(uTime * 12.9 + 1.7);
    vec3 rgb = uPool * (1.0 - smoothstep(0.3, 1.0, length(vEllipse))) * flicker;
    #ifdef USE_FOG
      // Additive: fog fades the light out rather than tinting it
      rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
  }
`

const EMBER_ANCHOR = emberAnchor()
const fogUniforms = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog)

/** Every tongue as one instance of a unit quad; the quality's share of them drawn (`instanceCount`). */
function tongueGeometry(): THREE.InstancedBufferGeometry {
  const tongues = buildFlameTongues()
  const plane = new THREE.PlaneGeometry(1, 1)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setIndex(plane.getIndex())
  geometry.setAttribute('position', plane.getAttribute('position'))
  geometry.setAttribute('uv', plane.getAttribute('uv'))
  geometry.setAttribute('aStart', new THREE.InstancedBufferAttribute(tongues.start, 4))
  geometry.setAttribute('aMid', new THREE.InstancedBufferAttribute(tongues.mid, 3))
  geometry.setAttribute('aEnd', new THREE.InstancedBufferAttribute(tongues.end, 3))
  geometry.setAttribute('aTongue', new THREE.InstancedBufferAttribute(tongues.params, 4))
  plane.dispose()
  // The quad's own bounds mean nothing once the vertex shader places it: bound the whole fire
  const { base, crest } = fireHeights()
  const pool = flamePool()
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(pool.centre.x, (base + crest) / 2, pool.centre.z),
    // Padded for the tongues' width and sway
    Math.hypot(pool.halfX, pool.halfZ, (crest - base) / 2) + 100,
  )
  return geometry
}

function poolGeometry(): THREE.PlaneGeometry {
  const pool = flamePool()
  const geometry = new THREE.PlaneGeometry(pool.halfX * 2, pool.halfZ * 2)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(pool.centre.x, pool.centre.y, pool.centre.z)
  return geometry
}

/**
 * The Flame burns (#520, rebuilt in #595): a few hundred soft tongues of flame (one instanced draw) rise
 * up its faces and off its top, each on a path round the Flame's flare with its own life, sway and noise,
 * so they overlap in front of and behind each other as the coaster circles; the warm pool its light throws
 * on the mats; and embers rising off it (an anchored `ParticleField`). Three draw calls. Touch and lower
 * qualities draw fewer tongues and the quality's `fbmOctaves`.
 */
export default function FlameFire() {
  const octaves = useFbmOctaves()
  const { particleScale } = useQualityProfile()
  const tongues = useMemo(tongueGeometry, [])
  const pool = useMemo(poolGeometry, [])
  const tongueMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: tongueVertex,
        fragmentShader: tongueFragment,
        defines: { FBM_OCTAVES: octaves },
        uniforms: { ...fogUniforms(), uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        // Premultiplied: the flame adds its light and dims what's behind it by its alpha
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        side: THREE.DoubleSide,
        fog: true,
      }),
    [octaves],
  )
  const poolMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: poolVertex,
        fragmentShader: poolFragment,
        uniforms: { ...fogUniforms(), uTime: { value: 0 }, uPool: { value: new THREE.Color(0.42, 0.15, 0.04) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true,
      }),
    [],
  )
  useEffect(() => {
    tongues.instanceCount = tongueCount(isCoarsePointer, particleScale)
  }, [tongues, particleScale])
  useEffect(() => () => tongues.dispose(), [tongues])
  useEffect(() => () => pool.dispose(), [pool])
  useEffect(() => () => tongueMaterial.dispose(), [tongueMaterial])
  useEffect(() => () => poolMaterial.dispose(), [poolMaterial])

  useFrame(({ clock }) => {
    tongueMaterial.uniforms.uTime.value = clock.elapsedTime
    poolMaterial.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <>
      <mesh geometry={pool} material={poolMaterial} />
      <mesh geometry={tongues} material={tongueMaterial} />
      <ParticleField preset={PARTICLE_PRESETS.gymFlameEmbers} anchor={EMBER_ANCHOR} />
    </>
  )
}
