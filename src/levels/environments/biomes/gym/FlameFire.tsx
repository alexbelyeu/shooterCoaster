import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HEAT_SHIMMER } from '@/canvas/post/HeatShimmerEffect'
import { easeShimmer, shimmerAmplitude, shimmerRect } from '@/canvas/post/heatShimmer.hot'
import { isCoarsePointer, useFbmOctaves, useQualityProfile } from '@/canvas/useRenderBudget'
import ParticleField from '../../shared/ParticleField'
import { gradientNoiseGlsl } from '../../shared/noiseGlsl'
import { FLAME_EMBERS, buildFlameTongues, buildSmokePuffs, emberAnchor, fireFlicker, fireFootprint, fireHeights, shimmerColumn, smokeCount, tongueCount } from './flameFire'
import { FIRE_FLICKER } from './grimeShader'

const tongueVertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec4 aStart; // xyz, heat
  attribute vec3 aMid;
  attribute vec3 aEnd;
  attribute vec4 aTongue; // phase, life (s), width, seed
  uniform float uTime;
  uniform float uFlicker;
  varying vec2 vUv;
  varying float vHeat;
  varying float vSeed;
  varying float vAge;
  varying float vNear;

  ${gradientNoiseGlsl}

  void main() {
    float cycle = uTime / aTongue.y + aTongue.x;
    float age = fract(cycle);
    // Every life is a new tongue: its own shape, sway and pace, so the fire never repeats
    float seed = fract(aTongue.w + floor(cycle) * 0.618034);

    // Slow at the root, accelerating up: a quadratic through the path's middle
    float t = age * (0.5 + 0.5 * age);
    vec3 c = 2.0 * aMid - 0.5 * (aStart.xyz + aEnd);
    float u = 1.0 - t;
    vec3 centre = u * u * aStart.xyz + 2.0 * u * t * c + t * t * aEnd;

    // Grows from its root, then stretches thinner and taller as it rises and breaks off; the whole fire
    // leaps and sinks with the light it throws (fireFlicker)
    float width = aTongue.z * (0.75 + 0.5 * seed) * smoothstep(0.0, 0.25, age) * (1.0 - 0.4 * age);
    float height = width * (1.9 + 2.1 * age) * (0.7 + 0.35 * uFlicker);

    // Turned to the camera round the vertical, so tongues stay upright as the coaster circles them
    vec3 toCamera = cameraPosition - centre;
    vec2 flat2 = toCamera.xz;
    float flatLength = length(flat2);
    vec3 right = flatLength > 1e-3 ? vec3(flat2.y, 0.0, -flat2.x) / flatLength : vec3(1.0, 0.0, 0.0);

    // Turbulence: the whole tongue drifts, its tip whips further and faster than its root
    float wave = uTime * (0.8 + 0.6 * seed);
    vec3 drift = vec3(gnoise(vec2(seed * 41.0, wave)), 0.0, gnoise(vec2(seed * 23.0 + 7.0, wave)));
    vec3 whip = vec3(gnoise(vec2(seed * 13.0, wave * 2.3)), 0.0, gnoise(vec2(seed * 31.0 + 3.0, wave * 2.3)));
    vec3 sway = width * (drift * 0.6 * age + whip * 0.9 * uv.y * uv.y);

    vec3 p = centre + right * (uv.x - 0.5) * width + vec3(0.0, (uv.y - 0.12) * height, 0.0) + sway;
    vUv = uv;
    vHeat = aStart.w;
    vSeed = seed;
    vAge = age;
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    // Fades out as the camera comes into it (the spiral rides through the fire's edge), so a tongue never fills the screen
    vNear = smoothstep(width * 0.4, width * 1.4, -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const tongueFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uFlicker;
  varying vec2 vUv;
  varying float vHeat;
  varying float vSeed;
  varying float vAge;
  varying float vNear;

  ${gradientNoiseGlsl}

  // Blackbody ramp: dull red, deep orange, yellow, a white-hot core; past 1 for Bloom, tone mapped by the composer
  vec3 blackbody(float t) {
    vec3 col = vec3(0.4, 0.03, 0.005) * smoothstep(0.0, 0.2, t);
    col = mix(col, vec3(1.5, 0.3, 0.03), smoothstep(0.15, 0.45, t));
    col = mix(col, vec3(2.6, 1.15, 0.2), smoothstep(0.4, 0.72, t));
    return mix(col, vec3(3.6, 3.0, 1.9), smoothstep(0.74, 1.0, t));
  }

  void main() {
    // Clamped: MSAA samples an edge pixel's varyings at its centre, a little off the quad, and pow(1 - y) of y > 1 is NaN
    float x = clamp(vUv.x, 0.0, 1.0) * 2.0 - 1.0;
    float y = clamp(vUv.y, 0.0, 1.0);
    // Noise scrolling up through the tongue faster than it rises: the turbulence inside it
    float n = fbm(vec2(x * 1.4 + vSeed * 19.0, y * 2.1 - uTime * 2.4 + vSeed * 11.0));
    #ifdef FINE_TURBULENCE
      float fine = gnoise(vec2(x * 3.6 - vSeed * 7.0, y * 4.5 - uTime * 3.7));
    #else
      float fine = 0.0;
    #endif
    // Licks: the tongue's spine wanders more towards its tip
    float xd = x + (n * 1.2 + fine * 0.35) * y;
    // A teardrop: round root, tapering tip
    float halfWidth = 0.85 * pow(max(1.0 - y, 0.0), 0.7) * smoothstep(0.0, 0.1, y) + 0.001;
    float body = clamp(1.0 - abs(xd) / halfWidth, 0.0, 1.0);
    float density = smoothstep(0.0, 0.8, body) * (1.0 - smoothstep(0.55, 1.0, y - n * 0.35));
    // Tears apart higher up into separate wisps
    density *= smoothstep(-0.3, 0.3, n + fine * 0.5 + 0.6 - 0.6 * y * (0.5 + vAge));
    // Fades in at its root, out as it burns away
    density *= smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.75, 1.0, vAge)) * vNear;

    // Hottest in a core low along the spine, cooling to red at its edges and with age; its tip, higher on an older
    // tongue, burns out into soot
    float core = smoothstep(0.35, 1.0, body) * (1.0 - smoothstep(0.1, 0.6, y));
    float tip = smoothstep(0.6, 1.05, y + 0.45 * vAge + 0.25 * n);
    float heat = vHeat * smoothstep(0.0, 0.6, density) * (0.7 + 0.5 * core) * (1.0 - 0.6 * tip) * (1.05 - 0.4 * vAge) * (0.8 + 0.25 * uFlicker);
    // Premultiplied: the flame hides much of what's behind it, so overlapping tongues build a body of fire instead
    // of adding up to white; the sooty tips are dark and a little more opaque
    vec3 rgb = blackbody(clamp(heat, 0.0, 1.0)) * density * 0.6 * (1.0 - 0.8 * tip);
    float alpha = density * (0.42 + 0.3 * tip);
    #ifdef USE_FOG
      float fade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      rgb *= fade;
      alpha *= fade;
    #endif
    // Finite and bounded, whatever the noise does (#344: one bad pixel blacks out Bloom)
    gl_FragColor = vec4(clamp(rgb, 0.0, 4.0), clamp(alpha, 0.0, 1.0));
  }
`

const smokeVertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec4 aStart; // xyz, darkness
  attribute vec3 aEnd;
  attribute vec4 aPuff; // phase, life (s), size at start, size at end
  uniform float uTime;
  varying vec2 vUv;
  varying float vAge;
  varying float vDark;
  varying float vSeed;
  varying float vNear;

  ${gradientNoiseGlsl}

  void main() {
    float cycle = uTime / aPuff.y + aPuff.x;
    float age = fract(cycle);
    vSeed = fract(aPuff.x * 7.31 + floor(cycle) * 0.618034);
    // Quick off the crest, slowing as it spreads under the roof
    float t = 1.0 - pow(1.0 - age, 1.8);
    float size = mix(aPuff.z, aPuff.w, t);
    float wave = uTime * 0.15;
    vec3 drift = vec3(gnoise(vec2(vSeed * 37.0, wave)), 0.0, gnoise(vec2(vSeed * 19.0 + 5.0, wave))) * size * 0.5 * t;
    vec3 centre = mix(aStart.xyz, aEnd, t) + drift;
    vec4 mvPosition = viewMatrix * vec4(centre, 1.0);
    mvPosition.xy += (uv - 0.5) * size;
    vUv = uv;
    vAge = age;
    vDark = aStart.w;
    // Fades out as the camera comes into it, so a puff never fills the screen
    vNear = smoothstep(size * 0.6, size * 1.6, -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const smokeFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uFlicker;
  varying vec2 vUv;
  varying float vAge;
  varying float vDark;
  varying float vSeed;
  varying float vNear;

  ${gradientNoiseGlsl}

  void main() {
    vec2 p = clamp(vUv, 0.0, 1.0) * 2.0 - 1.0;
    // Billowing: noise rolling through the puff, its edge torn by it
    float n = fbm(p * 1.3 + vec2(vSeed * 17.0, vSeed * 9.0 - uTime * 0.12));
    float density = clamp(1.0 - length(p) + n * 0.45, 0.0, 1.0);
    density = smoothstep(0.0, 0.7, density);
    density *= smoothstep(0.0, 0.15, vAge) * (1.0 - smoothstep(0.55, 1.0, vAge)) * vNear;
    float alpha = density * 0.7 * vDark;
    // Soot black, its underside lit orange by the fire while it is still low over it
    vec3 lit = vec3(0.7, 0.25, 0.06) * uFlicker * (1.0 - smoothstep(0.0, 0.35, vAge)) * smoothstep(0.2, -0.6, p.y);
    vec3 rgb = (vec3(0.1, 0.092, 0.085) + lit) * alpha;
    #ifdef USE_FOG
      float fade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      rgb *= fade;
      alpha *= fade;
    #endif
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
  }
`

/** `FBM_OCTAVES` at medium and high on a desktop; below it the tongues drop their fine turbulence. */
const FULL_OCTAVES = 4
const EMBER_ANCHOR = emberAnchor()
const SHIMMER_COLUMN = shimmerColumn()
const viewProjection = new THREE.Matrix4()
const shimmerBounds = new Float32Array(5)
const fogUniforms = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog)

/** A unit quad to instance: the vertex shader places and sizes each copy. */
function instancedQuad(): THREE.InstancedBufferGeometry {
  const plane = new THREE.PlaneGeometry(1, 1)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setIndex(plane.getIndex())
  geometry.setAttribute('position', plane.getAttribute('position'))
  geometry.setAttribute('uv', plane.getAttribute('uv'))
  plane.dispose()
  return geometry
}

/** Every tongue as one instance of a unit quad; the quality's share of them drawn (`instanceCount`). */
function tongueGeometry(): THREE.InstancedBufferGeometry {
  const tongues = buildFlameTongues()
  const geometry = instancedQuad()
  geometry.setAttribute('aStart', new THREE.InstancedBufferAttribute(tongues.start, 4))
  geometry.setAttribute('aMid', new THREE.InstancedBufferAttribute(tongues.mid, 3))
  geometry.setAttribute('aEnd', new THREE.InstancedBufferAttribute(tongues.end, 3))
  geometry.setAttribute('aTongue', new THREE.InstancedBufferAttribute(tongues.params, 4))
  // The quad's own bounds mean nothing once the vertex shader places it: bound the whole fire
  const { base, crest } = fireHeights()
  const ground = fireFootprint()
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(ground.centre.x, (base + crest) / 2, ground.centre.z),
    // Padded for the tongues' height over their paths, their width and sway
    Math.hypot(ground.halfX, ground.halfZ, (crest - base) / 2) + (crest - base) / 2,
  )
  return geometry
}

/** Every smoke puff as one instance of a unit quad. */
function smokeGeometry(): THREE.InstancedBufferGeometry {
  const puffs = buildSmokePuffs()
  const geometry = instancedQuad()
  geometry.setAttribute('aStart', new THREE.InstancedBufferAttribute(puffs.start, 4))
  geometry.setAttribute('aEnd', new THREE.InstancedBufferAttribute(puffs.end, 3))
  geometry.setAttribute('aPuff', new THREE.InstancedBufferAttribute(puffs.params, 4))
  geometry.boundingSphere = new THREE.Sphere()
  geometry.boundingSphere.setFromPoints(
    Array.from({ length: puffs.count * 2 }, (_, k) => {
      const i = k >> 1
      return k & 1 ? new THREE.Vector3().fromArray(puffs.end, i * 3) : new THREE.Vector3().fromArray(puffs.start, i * 4)
    }),
  )
  // Padded for the puffs' size and drift
  geometry.boundingSphere.radius += Math.max(...puffs.params.filter((_, k) => k % 4 === 3))
  return geometry
}

/**
 * The Flame burns (#520, #595, #599): a few hundred soft tongues of flame rising up its faces and off its top,
 * smoke rising off the crest, and embers (an anchored `ParticleField`), in three draw calls; its light on the hall
 * is the grime shader's, flickering with the `FIRE_FLICKER` this sets each frame; the air over it wavers through
 * the composer's `HeatShimmerEffect` (#627), which this aims each frame.
 */
export default function FlameFire() {
  const octaves = useFbmOctaves()
  const { particleScale } = useQualityProfile()
  const shimmerStrength = useRef(0)
  const tongues = useMemo(tongueGeometry, [])
  const smoke = useMemo(smokeGeometry, [])
  const tongueMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: tongueVertex,
        fragmentShader: tongueFragment,
        // The cheaper path (low quality, touch): fewer octaves and no fine turbulence over them
        defines: octaves >= FULL_OCTAVES ? { FBM_OCTAVES: octaves, FINE_TURBULENCE: '' } : { FBM_OCTAVES: octaves },
        uniforms: { ...fogUniforms(), uTime: { value: 0 }, uFlicker: FIRE_FLICKER },
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
  const smokeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: smokeVertex,
        fragmentShader: smokeFragment,
        defines: { FBM_OCTAVES: octaves },
        uniforms: { ...fogUniforms(), uTime: { value: 0 }, uFlicker: FIRE_FLICKER },
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        fog: true,
      }),
    [octaves],
  )
  useEffect(() => {
    tongues.instanceCount = tongueCount(isCoarsePointer, particleScale)
    smoke.instanceCount = smokeCount(isCoarsePointer, particleScale)
  }, [tongues, smoke, particleScale])
  useEffect(() => () => tongues.dispose(), [tongues])
  useEffect(() => () => smoke.dispose(), [smoke])
  useEffect(() => () => tongueMaterial.dispose(), [tongueMaterial])
  useEffect(() => () => smokeMaterial.dispose(), [smokeMaterial])
  useEffect(
    () => () => {
      HEAT_SHIMMER.shimmerAmp.value = 0
    },
    [],
  )

  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime
    tongueMaterial.uniforms.uTime.value = t
    smokeMaterial.uniforms.uTime.value = t
    FIRE_FLICKER.value = fireFlicker(t)

    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const inView = shimmerRect(SHIMMER_COLUMN, viewProjection.elements, shimmerBounds)
    const strength = easeShimmer(shimmerStrength.current, inView, delta)
    shimmerStrength.current = strength
    // Fading out, it keeps the last rect it had in view
    if (inView) {
      HEAT_SHIMMER.shimmerRect.value.fromArray(shimmerBounds)
      HEAT_SHIMMER.shimmerNear.value = shimmerBounds[4]
    }
    HEAT_SHIMMER.shimmerAmp.value = shimmerAmplitude(shimmerBounds[3] - shimmerBounds[1], strength)
    HEAT_SHIMMER.shimmerTime.value = t
  })

  return (
    <>
      {/* Under the flames: the tongues' light adds over the smoke where they meet */}
      <mesh geometry={smoke} material={smokeMaterial} renderOrder={-1} />
      <mesh geometry={tongues} material={tongueMaterial} />
      <ParticleField preset={FLAME_EMBERS} anchor={EMBER_ANCHOR} />
    </>
  )
}
