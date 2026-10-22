import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { dustDevilCenter, type DustDevil } from './desertLayout'

/** Rings stacked per column. */
const RINGS = 10
const DUST_COLOR = 0xb08356
const DUST_OPACITY = 0.34

/** Open, slightly flared tube of height 1 centred on y = 0. */
function createRingGeometry(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(1, 0.8, 1, 18, 1, true)
}

/**
 * Low-alpha sand: spiral streaks around each ring (they spin with the instance),
 * soft top/bottom edges, and a per-ring `aFade` (dense near the ground, thinning
 * towards the top).
 */
function createDustMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: DUST_COLOR,
    transparent: true,
    opacity: DUST_OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;\nvarying vec2 vDustUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;\nvDustUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;\nvarying vec2 vDustUv;')
      .replace(
        '#include <alphamap_fragment>',
        /* glsl */ `#include <alphamap_fragment>
        float spiral = 0.55 + 0.45 * sin(vDustUv.x * 18.85 + vDustUv.y * 5.0);
        spiral *= 0.7 + 0.3 * sin(vDustUv.x * 43.98 - vDustUv.y * 9.0);
        diffuseColor.a *= vFade * spiral * sin(3.14159 * vDustUv.y);`,
      )
  }
  material.customProgramCacheKey = () => 'desert-dust-devil'
  return material
}

/** All dust devils in one instanced mesh, every ring placed in one useFrame. */
export default function DustDevils({ devils, groundFn }: { devils: readonly DustDevil[]; groundFn: HeightFunction }) {
  const count = devils.length * RINGS
  const geometry = useMemo(() => {
    const geo = createRingGeometry()
    const fade = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const u = ((i % RINGS) + 0.5) / RINGS
      fade[i] = Math.min(1, u * 4) * (1 - u * 0.6)
    }
    geo.setAttribute('aFade', new THREE.InstancedBufferAttribute(fade, 1))
    return geo
  }, [count])
  const material = useMemo(() => createDustMaterial(), [])
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(
    () => ({
      foot: { x: 0, z: 0 },
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = clock.elapsedTime
    const { foot, matrix, position, quaternion, scale, up } = tmp
    for (let d = 0; d < devils.length; d++) {
      const devil = devils[d]
      dustDevilCenter(devil, t, foot)
      const ground = groundFn(foot.x, foot.z)
      const segment = devil.height / RINGS
      // The column leans and snakes: the higher the ring, the further it swings.
      const sway = t * 0.7 + devil.phase
      for (let k = 0; k < RINGS; k++) {
        const u = k / (RINGS - 1)
        const bend = Math.pow(u, 1.5) * devil.height * 0.16
        const wobble = sway + u * 2.2
        position.set(
          foot.x + Math.cos(wobble) * bend,
          ground + (k + 0.5) * segment,
          foot.z + Math.sin(wobble * 0.8) * bend,
        )
        const r = devil.radius * (0.2 + 0.8 * Math.pow(u, 1.3)) * (1 + 0.08 * Math.sin(t * 2.3 + k))
        scale.set(r, segment * 1.3, r)
        quaternion.setFromAxisAngle(up, devil.spin * t + k * 0.5)
        matrix.compose(position, quaternion, scale)
        mesh.setMatrixAt(d * RINGS + k, matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (count === 0) return null
  return <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />
}
