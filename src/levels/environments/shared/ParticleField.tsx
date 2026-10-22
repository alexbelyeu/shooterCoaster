import { useEffect, useMemo, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** One kind of particle in a field (ash, embers, snowflakes, dust…). */
export interface ParticleLayer {
  color: THREE.ColorRepresentation
  opacity: number
  /** Diameter in world units; on screen it is clamped to [1, maxPixels]. */
  size: number
  maxPixels: number
  /** Drift in world units per second (each point varies it ±30%). */
  velocity: [number, number, number]
  sway: number
  /** 0 = steady, 1 = strong flicker. */
  flicker: number
  /** Adds light (embers) instead of covering what is behind it (ash). */
  additive: boolean
}

export interface ParticleFieldPreset {
  count: number
  /** Box around the camera the points wrap inside, world units. */
  box: [number, number, number]
  primary: ParticleLayer
  secondary: ParticleLayer
  secondaryShare: number
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uHalfHeightPx;
  uniform vec3 uBox;
  uniform float uSecondaryShare;
  uniform vec3 uVelocity[2];
  uniform vec4 uShape[2]; // size, maxPixels, sway, flicker

  attribute float aRand;

  varying float vSecondary;
  varying float vAlpha;

  void main() {
    float secondary = step(aRand, uSecondaryShare);
    int layer = int(secondary + 0.5);
    vec4 shape = uShape[layer];
    float phase = aRand * 107.0;

    // position is a seed in [0, 1)^3; drift it, then wrap into the box around the camera
    vec3 p = position * uBox + uVelocity[layer] * uTime * (0.7 + 0.6 * fract(aRand * 13.7));
    p.x += sin(uTime * 0.7 + phase) * shape.z;
    p.z += cos(uTime * 0.53 + phase * 1.3) * shape.z;
    vec3 rel = mod(p - cameraPosition, uBox) - 0.5 * uBox;

    vec4 mvPosition = viewMatrix * vec4(cameraPosition + rel, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float px = shape.x * projectionMatrix[1][1] * uHalfHeightPx / max(-mvPosition.z, 0.1);
    gl_PointSize = clamp(px, 1.0, shape.y);

    vec3 e = abs(rel) / (0.5 * uBox);
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, max(max(e.x, e.y), e.z));
    float flick = mix(1.0, 0.5 + 0.5 * sin(uTime * (8.0 + aRand * 9.0) + phase), shape.w);
    // Sub-pixel points fade rather than staying 1px wide
    vAlpha = edgeFade * flick * min(px, 1.0);
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

/** Seeded so every run (and every smoke screenshot) looks the same. */
function createSeeds(count: number): THREE.BufferGeometry {
  let s = 0x9e3779b9
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const positions = new Float32Array(count * 3)
  const rands = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = rand()
    positions[i * 3 + 1] = rand()
    positions[i * 3 + 2] = rand()
    rands[i] = rand()
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

interface ParticleFieldProps {
  preset: ParticleFieldPreset
  /** 0..1: scales the secondary layer's share and brightness up to 2×. */
  boostRef?: RefObject<number>
}

/** Ambient particles wrapping in a box around the camera: one draw call, no per-frame CPU work but uniforms. */
export default function ParticleField({ preset, boostRef }: ParticleFieldProps) {
  const geometry = useMemo(() => createSeeds(preset.count), [preset.count])
  const material = useMemo(() => createMaterial(preset), [preset])
  const halfHeightPx = useThree(s => s.size.height * s.viewport.dpr * 0.5)

  useEffect(() => {
    material.uniforms.uHalfHeightPx.value = halfHeightPx
  }, [material, halfHeightPx])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    const u = material.uniforms
    u.uTime.value = clock.elapsedTime
    const boost = boostRef?.current ?? 0
    u.uBoost.value = boost
    u.uSecondaryShare.value = Math.min(1, preset.secondaryShare * (1 + boost))
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
