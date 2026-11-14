import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { eventBus } from '@/core/EventBus'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake'
import type { BiomeFeaturesProps } from '../../shared/types'
import Volcano from '../../Volcano'
import { VOLCANO_SITE } from '../../volcanoGeometry'
import { createLavaMaterial } from '../../LavaShader'
import { createLavaRiverGeometries } from './lavaRivers'

const ERUPTION_TRAUMA = 0.8
const ERUPTION_TRAUMA_MS = 3000
/** How far the fog closes in on an eruption (`eruption:start` may pass its own: the Magma Titan's keeps it in view). */
const ERUPTION_FOG_FAR = 200
const RIVER_INTENSITY = 1.7
/** A boss defeated (the Magma Titan): the lava rivers flare once and settle. */
const RIVER_PULSE = { gain: 1.4, seconds: 1.6 }

/** Volcano, lava rivers and the eruption (camera rumble, fog pulse; the ember burst is the `volcanicAsh` particle preset's boost). */
export default function VolcanicFeatures({ heightFn, atmosphere, fogRef }: BiomeFeaturesProps) {
  const fogPulseRef = useRef({ active: false, startTime: 0, far: ERUPTION_FOG_FAR })
  const riverPulseRef = useRef({ active: false, startTime: 0 })

  // Animated molten rock; bright enough that the hot cracks pass the Bloom threshold
  const lavaRiverMat = useMemo(() => createLavaMaterial(0.08, RIVER_INTENSITY), [])
  const lavaFlowMat = useMemo(() => createLavaMaterial(0.12, 1.8), [])

  const lavaRiverGeos = useMemo(() => createLavaRiverGeometries(heightFn), [heightFn])

  useEffect(() => {
    return () => {
      lavaRiverMat.dispose()
      lavaFlowMat.dispose()
      lavaRiverGeos.forEach(g => g.dispose())
    }
  }, [lavaRiverMat, lavaFlowMat, lavaRiverGeos])

  useEffect(() => {
    const onEruption = (fogFar: unknown) => {
      const pulse = fogPulseRef.current
      pulse.active = true
      pulse.far = typeof fogFar === 'number' ? fogFar : ERUPTION_FOG_FAR
      pulse.startTime = -1 // set from the R3F clock on the next frame
      eventBus.emit(CAMERA_TRAUMA_EVENT, ERUPTION_TRAUMA, ERUPTION_TRAUMA_MS)
    }
    const onBossDefeated = () => {
      riverPulseRef.current.active = true
      riverPulseRef.current.startTime = -1
    }
    eventBus.on('eruption:start', onEruption)
    eventBus.on('boss:defeated', onBossDefeated)
    return () => {
      eventBus.off('eruption:start', onEruption)
      eventBus.off('boss:defeated', onBossDefeated)
    }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    lavaRiverMat.uniforms.uTime.value = t
    lavaFlowMat.uniforms.uTime.value = t

    const river = riverPulseRef.current
    if (river.active) {
      if (river.startTime < 0) river.startTime = t
      const u = (t - river.startTime) / RIVER_PULSE.seconds
      if (u >= 1) river.active = false
      lavaRiverMat.uniforms.uIntensity.value = RIVER_INTENSITY * (1 + (u < 1 ? RIVER_PULSE.gain * Math.sin(u * Math.PI) : 0))
    }

    const pulse = fogPulseRef.current
    if (!pulse.active) return
    if (pulse.startTime < 0) pulse.startTime = clock.elapsedTime
    const elapsed = clock.elapsedTime - pulse.startTime

    // Fog pulse: close in over 2s, recover over 8s
    if (fogRef.current) {
      const baseFar = atmosphere.fogFar
      if (elapsed < 2) {
        const t = elapsed / 2
        fogRef.current.far = baseFar + (pulse.far - baseFar) * t
      } else if (elapsed < 10) {
        const t = (elapsed - 2) / 8
        fogRef.current.far = pulse.far + (baseFar - pulse.far) * t
      } else {
        fogRef.current.far = baseFar
        pulse.active = false
      }
    }
  })

  return (
    <>
      <Volcano position={[VOLCANO_SITE.x, heightFn(VOLCANO_SITE.x, VOLCANO_SITE.z), VOLCANO_SITE.z]} lavaMaterial={lavaFlowMat} />
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
