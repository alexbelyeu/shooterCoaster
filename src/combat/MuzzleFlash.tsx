import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { MUZZLE_FLASH_MS, isFeedbackHeld } from './hitFeedback'

/** Distance in front of the camera (camera near plane is 1). */
const DIST = 3
/** Flash size as a fraction of the view's half-height at DIST. */
const SIZE = 0.52
/** Vertical placement: fraction of the half-height below centre (gun position). */
const DROP = 0.8

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Procedural star-burst: hot core, 6 tapered spikes, soft glow. No texture.
const fragmentShader = /* glsl */ `
  uniform float uIntensity;
  uniform float uSpikes;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float spikes = pow(abs(cos(a * uSpikes * 0.5)), 10.0) * max(0.0, 1.0 - r);
    float core = exp(-r * r * 14.0);
    float glow = exp(-r * r * 3.5) * 0.35;
    float v = (core * 1.4 + spikes * 0.9 + glow) * uIntensity;
    vec3 hot = vec3(1.0, 0.95, 0.8);
    vec3 warm = vec3(1.0, 0.55, 0.15);
    vec3 col = mix(warm, hot, clamp(core * 1.5, 0.0, 1.0)) * 1.8;
    gl_FragColor = vec4(col * v, clamp(v, 0.0, 1.0));
  }
`

/**
 * Camera-attached additive muzzle flash at the bottom-centre of the view.
 * Mount as a child of the gameplay camera. One mesh, reused for every shot
 * (pooled by construction); hidden — so zero draw calls — when idle.
 */
export default function MuzzleFlash() {
  const meshRef = useRef<THREE.Mesh>(null)
  const remainingMs = useRef(0)

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uIntensity: { value: 0 }, uSpikes: { value: 6 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useEffect(() => {
    const onFire = () => {
      const mesh = meshRef.current
      if (!mesh) return
      remainingMs.current = MUZZLE_FLASH_MS
      // Random roll + scale so consecutive flashes don't look stamped.
      mesh.rotation.z = Math.random() * Math.PI * 2
      const s = 0.85 + Math.random() * 0.3
      mesh.userData.flashScale = s
      material.uniforms.uSpikes.value = Math.random() < 0.5 ? 6 : 8
    }
    eventBus.on('weapon:fire', onFire)
    return () => eventBus.off('weapon:fire', onFire)
  }, [material])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    if (remainingMs.current <= 0) {
      if (mesh.visible) mesh.visible = false
      return
    }

    const cam = mesh.parent as THREE.PerspectiveCamera | null
    const halfH = Math.tan(THREE.MathUtils.degToRad((cam?.fov ?? 80) / 2)) * DIST
    const t = remainingMs.current / MUZZLE_FLASH_MS // 1 → 0
    const s = halfH * SIZE * ((mesh.userData.flashScale as number) ?? 1) * (0.75 + 0.25 * t)
    mesh.scale.set(s, s, 1)
    mesh.position.set(0, -halfH * DROP, -DIST)
    material.uniforms.uIntensity.value = t
    mesh.visible = true

    if (!isFeedbackHeld()) {
      const timeScale = useGameStore.getState().timeScale
      remainingMs.current -= delta * timeScale * 1000
    }
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      visible={false}
      frustumCulled={false}
      renderOrder={999}
    />
  )
}
