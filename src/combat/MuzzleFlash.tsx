import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { MUZZLE_FLASH_MS, isFeedbackHeld } from './hitFeedback'

/** Barrel tip (camera space) and flash size, written by WeaponViewModel each frame before this renders. */
export interface MuzzleAnchor {
  tip: THREE.Vector3
  size: number
}

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

/** Additive muzzle flash at the gun's barrel tip; one reused mesh, hidden (0 draw calls) when idle. */
export default function MuzzleFlash({ anchor }: { anchor: MuzzleAnchor }) {
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

    const t = Math.min(remainingMs.current / MUZZLE_FLASH_MS, 1) // 1 → 0
    const s = anchor.size * ((mesh.userData.flashScale as number) ?? 1) * (0.75 + 0.25 * t)
    mesh.scale.set(s, s, 1)
    mesh.position.copy(anchor.tip)
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
