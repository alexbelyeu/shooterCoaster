import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { particleShare } from '@/canvas/graphicsQuality'
import { isCoarsePointer, useQualityProfile } from '@/canvas/useRenderBudget'
import { createCarGeometry, createCarMaterial } from './cityNeon'
import { writeTraffic } from './traffic.hot'
import type { Traffic as TrafficLayout } from './trafficPaths'

/** The city's traffic (#324): every car in one instanced draw call, thinned by the quality's `particleScale`; scenery, never raycast. */
export default function Traffic({ traffic }: { traffic: TrafficLayout }) {
  const { particleScale } = useQualityProfile()
  const geometry = useMemo(createCarGeometry, [])
  const material = useMemo(createCarMaterial, [])
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, traffic.count)
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    m.frustumCulled = false
    m.raycast = () => {}
    return m
  }, [geometry, material, traffic])

  useEffect(() => {
    mesh.count = Math.round(traffic.count * particleShare(isCoarsePointer, particleScale))
  }, [mesh, traffic, particleScale])

  useEffect(() => () => void mesh.dispose(), [mesh])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(({ clock }) => {
    writeTraffic(traffic, mesh.count, clock.elapsedTime, mesh.instanceMatrix.array as Float32Array)
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}
