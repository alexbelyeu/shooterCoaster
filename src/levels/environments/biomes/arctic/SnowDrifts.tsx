import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { scatterNearTrack, settleOnGround, trackExtent } from '../../shared/trackScatter'
import { createRng } from '@/utils/rng'
import { COLOR_RAMP } from './config'
import StaticInstances from '../../shared/StaticInstances'
import { yawScaleMatrix } from '../../shared/yawScaleMatrix'
import { DRIFT_HALF_LENGTH, DRIFT_HEIGHT, createDriftGeometry } from './iceProps'

/** Prevailing wind (yaw): drifts line up with it. */
const WIND_YAW = 0.7

/** Snow drifts on flat ground beside the track. */
export default function SnowDrifts({ groundFn, track }: BiomeDecorationsProps) {
  const geometry = useMemo(() => createDriftGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        // the ramp's "bright snow" stop
        color: COLOR_RAMP.stops[3].color,
        specular: '#c8d8ff',
        shininess: 12,
        flatShading: true,
      }),
    [],
  )

  const matrices = useMemo(() => {
    const rng = createRng(77)
    const count = 90
    const points = scatterNearTrack({
      count: count * 3,
      track,
      heightFn: groundFn,
      minDist: 50,
      maxDist: 700,
      maxRadius: trackExtent(track) * 1.5,
      maxSlope: Math.PI / 12,
      bias: 1.5,
      rng,
    })
    const drifts = settleOnGround(points, groundFn, {
      count,
      scaleRange: [10, 32],
      footprint: DRIFT_HALF_LENGTH,
      height: DRIFT_HEIGHT,
      sink: 0,
      maxBury: 0.33,
      rng,
    })
    return drifts.map((d) => yawScaleMatrix(d, WIND_YAW + (rng() - 0.5) * 0.8, d.scale))
  }, [groundFn, track])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return <StaticInstances matrices={matrices} geometry={geometry} material={material} />
}
