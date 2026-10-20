import { useEffect, useMemo, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import SkyDome from '../SkyDome'
import type { AtmosphereConfig } from '../atmosphere'

/** Applies the biome's tone-mapping exposure (read by the ACES ToneMapping effect); restores on unmount. */
function AtmosphereExposure({ exposure }: { exposure: number }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const prev = gl.toneMappingExposure
    gl.toneMappingExposure = exposure
    return () => {
      gl.toneMappingExposure = prev
    }
  }, [gl, exposure])
  return null
}

/** Sky dome, exposure, hemisphere + sun lights and fog for one biome (see atmosphere.ts). */
export default function Atmosphere({
  atmosphere,
  fogRef,
}: {
  atmosphere: AtmosphereConfig
  fogRef: RefObject<THREE.Fog | null>
}) {
  const sunPosition = useMemo<[number, number, number]>(() => {
    const [x, y, z] = atmosphere.sunDirection
    const len = Math.hypot(x, y, z) || 1
    return [(x / len) * 1000, (y / len) * 1000, (z / len) * 1000]
  }, [atmosphere])

  return (
    <>
      {/* Sky + atmosphere (per-biome, see atmosphere.ts) */}
      <SkyDome atmosphere={atmosphere} />
      <AtmosphereExposure exposure={atmosphere.exposure} />

      {/* Lighting: tinted hemisphere ambient + coloured sun */}
      <hemisphereLight
        args={[atmosphere.hemiSkyColor, atmosphere.hemiGroundColor, atmosphere.hemiIntensity]}
      />
      <directionalLight
        position={sunPosition}
        color={atmosphere.sunLightColor}
        intensity={atmosphere.sunLightIntensity}
      />

      {/* Fog — colour is the dome's horizon colour (single source of truth) */}
      <fog
        ref={fogRef}
        attach="fog"
        args={[atmosphere.sky.horizon, atmosphere.fogNear, atmosphere.fogFar]}
      />
    </>
  )
}
