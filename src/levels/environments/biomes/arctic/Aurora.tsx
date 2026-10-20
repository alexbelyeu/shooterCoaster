import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import {
  AURORA_DEFAULT_INTENSITY,
  AURORA_INTENSITY_EVENT,
  createAuroraGeometry,
  createAuroraMaterial,
} from './aurora'

export default function Aurora() {
  const geometry = useMemo(() => createAuroraGeometry(), [])
  const material = useMemo(() => createAuroraMaterial(), [])
  const target = useRef(AURORA_DEFAULT_INTENSITY)

  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geometry, material)
    m.frustumCulled = false
    m.name = 'Aurora'
    return m
  }, [geometry, material])

  useEffect(() => {
    const onIntensity = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) target.current = Math.max(0, value)
    }
    eventBus.on(AURORA_INTENSITY_EVENT, onIntensity)
    return () => eventBus.off(AURORA_INTENSITY_EVENT, onIntensity)
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(({ camera, clock }, delta) => {
    mesh.position.copy(camera.position)
    const u = material.uniforms
    u.uTime.value = clock.elapsedTime
    u.uIntensity.value += (target.current - u.uIntensity.value) * Math.min(1, delta * 2)
  })

  return <primitive object={mesh} />
}
