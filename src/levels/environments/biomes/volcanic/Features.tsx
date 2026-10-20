import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { eventBus } from '@/core/EventBus'
import type { BiomeFeaturesProps } from '../../shared/types'
import Volcano from '../../Volcano'
import { createLavaMaterial } from '../../LavaShader'
import { createLavaRiverGeometries } from './lavaRivers'

/** Volcano landmark, lava rivers, and the eruption event (camera shake + fog pulse). */
export default function VolcanicFeatures({ heightFn, atmosphere, fogRef }: BiomeFeaturesProps) {
  const cameraShakeRef = useRef({ active: false, startTime: 0 })

  // Lava shader material — animated procedural molten rock
  const lavaRiverMat = useMemo(() => createLavaMaterial(0.08, 1.2), [])
  const lavaFlowMat = useMemo(() => createLavaMaterial(0.12, 1.5), [])

  const lavaRiverGeos = useMemo(() => createLavaRiverGeometries(heightFn), [heightFn])

  useEffect(() => {
    return () => {
      lavaRiverMat.dispose()
      lavaFlowMat.dispose()
      lavaRiverGeos.forEach(g => g.dispose())
    }
  }, [lavaRiverMat, lavaFlowMat, lavaRiverGeos])

  // Eruption event handling — fog pulse + camera shake
  useEffect(() => {
    const onEruption = () => {
      cameraShakeRef.current = { active: true, startTime: performance.now() / 1000 }
    }
    eventBus.on('eruption:start', onEruption)
    return () => { eventBus.off('eruption:start', onEruption) }
  }, [])

  useFrame(({ camera, clock }) => {
    // Drive lava shader time
    const t = clock.elapsedTime
    lavaRiverMat.uniforms.uTime.value = t
    lavaFlowMat.uniforms.uTime.value = t

    const shake = cameraShakeRef.current
    if (!shake.active) return
    const elapsed = clock.elapsedTime - shake.startTime
    if (elapsed < 0) {
      shake.startTime = clock.elapsedTime
      return
    }

    // Camera shake: 3s duration, damped
    if (elapsed < 3) {
      const amplitude = 3 * (1 - elapsed / 3)
      camera.position.x += Math.sin(elapsed * 30) * amplitude * 0.02
      camera.position.y += Math.cos(elapsed * 25) * amplitude * 0.02
    }

    // Fog pulse: close in over 2s, recover over 8s
    if (fogRef.current) {
      const baseFar = atmosphere.fogFar
      if (elapsed < 2) {
        const t = elapsed / 2
        fogRef.current.far = baseFar + (200 - baseFar) * t
      } else if (elapsed < 10) {
        const t = (elapsed - 2) / 8
        fogRef.current.far = 200 + (baseFar - 200) * t
      } else {
        fogRef.current.far = baseFar
        shake.active = false
      }
    }
  })

  return (
    <>
      <Volcano position={[2400, heightFn(2400, -1500), -1500]} lavaMaterial={lavaFlowMat} />
      {lavaRiverGeos.map((geo, i) => (
        <mesh
          key={`lava-river-${i}`}
          geometry={geo}
          material={lavaRiverMat}
        />
      ))}
    </>
  )
}
