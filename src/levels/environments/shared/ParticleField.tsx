import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { isCoarsePointer } from '@/canvas/useRenderBudget'
import { e2eParticles, isE2E } from '@/testing/e2eHook'
import type { ParticleFieldPreset } from './types'
import { boostStrength, particleCounts } from './particlePresets'

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uHalfHeightPx;
  uniform vec3 uBox;
  uniform float uSecondaryShare;
  uniform float uBoost;
  uniform vec3 uVelocity[2];
  uniform vec4 uShape[2]; // size, maxPixels, sway, flicker

  // [0, 1): always-on point; [1, 2): boost-only secondary point, shown with uBoost
  attribute float aRand;

  varying float vSecondary;
  varying float vAlpha;

  void main() {
    float boostOnly = step(1.0, aRand);
    if (boostOnly > 0.5 && uBoost <= 0.0) {
      // Outside the clip volume: draws nothing
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    float r = aRand - boostOnly;
    // A point's layer never changes, so its drift never jumps
    float secondary = max(step(r, uSecondaryShare), boostOnly);
    int layer = int(secondary + 0.5);
    vec4 shape = uShape[layer];
    float phase = r * 107.0;

    // position is a seed in [0, 1)^3; drift it, then wrap into the box around the camera
    vec3 p = position * uBox + uVelocity[layer] * uTime * (0.7 + 0.6 * fract(r * 13.7));
    p.x += sin(uTime * 0.7 + phase) * shape.z;
    p.z += cos(uTime * 0.53 + phase * 1.3) * shape.z;
    vec3 rel = mod(p - cameraPosition, uBox) - 0.5 * uBox;

    vec4 mvPosition = viewMatrix * vec4(cameraPosition + rel, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float px = shape.x * projectionMatrix[1][1] * uHalfHeightPx / max(-mvPosition.z, 0.1);
    gl_PointSize = clamp(px, 1.0, shape.y);

    vec3 e = abs(rel) / (0.5 * uBox);
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, max(max(e.x, e.y), e.z));
    float flick = mix(1.0, 0.5 + 0.5 * sin(uTime * (8.0 + r * 9.0) + phase), shape.w);
    // Sub-pixel points fade rather than staying 1px wide; boost-only points fade with the boost
    vAlpha = edgeFade * flick * min(px, 1.0) * mix(1.0, uBoost, boostOnly);
    vSecondary = secondary;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor[2];
  uniform vec2 uLook[2]; // opacity, additive
  uniform float uBoost;

  varying float vSecondary;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c) * 4.0;
    if (r2 > 1.0) discard;
    int layer = int(vSecondary + 0.5);
    vec2 look = uLook[layer];
    float a = look.x * vAlpha * (1.0 - r2);
    vec3 col = uColor[layer] * (1.0 + uBoost * vSecondary);
    // Premultiplied output: additive layers write alpha 0, so they only add light
    gl_FragColor = vec4(col * a, a * (1.0 - look.y));
  }
`

/** Seeded so every run (and every smoke screenshot) looks the same. Boost-only points follow the always-on ones. */
function createSeeds(base: number, boost: number): THREE.BufferGeometry {
  let s = 0x9e3779b9
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const count = base + boost
  const positions = new Float32Array(count * 3)
  const rands = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = rand()
    positions[i * 3 + 1] = rand()
    positions[i * 3 + 2] = rand()
    rands[i] = rand() + (i < base ? 0 : 1)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aRand', new THREE.BufferAttribute(rands, 1))
  return geo
}

function createMaterial(preset: ParticleFieldPreset): THREE.ShaderMaterial {
  const layers = [preset.primary, preset.secondary]
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uHalfHeightPx: { value: 360 },
      uBox: { value: new THREE.Vector3(...preset.box) },
      uSecondaryShare: { value: preset.secondaryShare },
      uBoost: { value: 0 },
      uVelocity: { value: layers.map(l => new THREE.Vector3(...l.velocity)) },
      uShape: { value: layers.map(l => new THREE.Vector4(l.size, l.maxPixels, l.sway, l.flicker)) },
      uColor: { value: layers.map(l => new THREE.Color(l.color)) },
      uLook: { value: layers.map(l => new THREE.Vector2(l.opacity, l.additive ? 1 : 0)) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  })
}

/** Ambient particles wrapping in a box around the camera: one draw call, no per-frame CPU work but uniforms. */
export default function ParticleField({ preset }: { preset: ParticleFieldPreset }) {
  const { base, boost: boostCount } = particleCounts(preset, isCoarsePointer)
  const geometry = useMemo(() => createSeeds(base, boostCount), [base, boostCount])
  const material = useMemo(() => createMaterial(preset), [preset])
  const halfHeightPx = useThree(s => s.size.height * s.viewport.dpr * 0.5)
  // Clock time the current boost started (NaN = none yet); a new event is stamped on the next frame
  const boostStart = useRef(Number.NaN)
  const boostPending = useRef(false)

  useEffect(() => {
    material.uniforms.uHalfHeightPx.value = halfHeightPx
  }, [material, halfHeightPx])

  useEffect(() => {
    if (isE2E) Object.assign(e2eParticles, { mounted: true, points: base, boostPoints: boostCount, boost: 0 })
    return () => {
      geometry.dispose()
      if (isE2E) e2eParticles.mounted = false
    }
  }, [geometry, base, boostCount])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const event = preset.boost?.event
    if (!event) return
    const onBoost = () => { boostPending.current = true }
    eventBus.on(event, onBoost)
    return () => { eventBus.off(event, onBoost) }
  }, [preset])

  useFrame(({ clock }) => {
    const u = material.uniforms
    const t = clock.elapsedTime
    u.uTime.value = t
    const boost = preset.boost
    if (!boost) return
    if (boostPending.current) {
      boostPending.current = false
      // Restart the rise from the current strength, so an event during a boost doesn't pop
      boostStart.current = t - boost.riseS * u.uBoost.value
    }
    if (Number.isNaN(boostStart.current)) return
    u.uBoost.value = boostStrength(boost, t - boostStart.current)
    if (isE2E) e2eParticles.boost = u.uBoost.value
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
