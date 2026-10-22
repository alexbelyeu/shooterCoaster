import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { eventBus } from '@/core/EventBus'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake'
import type { BiomeFeaturesProps } from '../../shared/types'
import Volcano from '../../Volcano'
import { createLavaMaterial } from '../../LavaShader'
import { createLavaRiverGeometries } from './lavaRivers'
import ParticleField from '../../shared/ParticleField'
import { ASH_EMBERS } from './config'

const ERUPTION_TRAUMA = 0.8
const ERUPTION_TRAUMA_MS = 3000
const EMBER_BOOST_S = 3
const EMBER_BOOST_FADE_S = 1

/** Volcano, lava rivers, ash and embers, and the eruption (camera rumble, fog pulse, ember burst). */
export default function VolcanicFeatures({ heightFn, atmosphere, fogRef }: BiomeFeaturesProps) {
  const fogPulseRef = useRef({ active: false, startTime: 0 })
  const emberBoostRef = useRef(0)

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

  useEffect(() => {
    const onEruption = () => {
      const pulse = fogPulseRef.current
      pulse.active = true
      pulse.startTime = -1 // set from the R3F clock on the next frame
      eventBus.emit(CAMERA_TRAUMA_EVENT, ERUPTION_TRAUMA, ERUPTION_TRAUMA_MS)
    }
    eventBus.on('eruption:start', onEruption)
    return () => { eventBus.off('eruption:start', onEruption) }
  }, [])

  useFrame(({ clock }) => {
    // Drive lava shader time
    const t = clock.elapsedTime
    lavaRiverMat.uniforms.uTime.value = t
    lavaFlowMat.uniforms.uTime.value = t

    const pulse = fogPulseRef.current
    if (!pulse.active) return
    if (pulse.startTime < 0) pulse.startTime = clock.elapsedTime
    const elapsed = clock.elapsedTime - pulse.startTime
    emberBoostRef.current = 1 - Math.min(1, Math.max(0, (elapsed - EMBER_BOOST_S) / EMBER_BOOST_FADE_S))

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
        pulse.active = false
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
      <ParticleField preset={ASH_EMBERS} boostRef={emberBoostRef} />
    </>
  )
}
