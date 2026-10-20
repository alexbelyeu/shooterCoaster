import { useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { createRng, scatterNearTrack, settleOnGround, trackExtent } from '../../shared/trackScatter'
import { COLOR_RAMP } from './config'
import { DRIFT_HALF_LENGTH, DRIFT_HEIGHT, createDriftGeometry } from './iceProps'

/** Prevailing wind (yaw): drifts line up with it. */
const WIND_YAW = 0.7

/** Snow drifts on flat ground beside the track. */
export default function SnowDrifts({ groundFn, trackSamples }: BiomeDecorationsProps) {
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
      trackSamples,
      heightFn: groundFn,
      minDist: 50,
      maxDist: 700,
      maxRadius: trackExtent(trackSamples) * 1.5,
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
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    return drifts.map((d) => {
      q.setFromAxisAngle(up, WIND_YAW + (rng() - 0.5) * 0.8)
      return new THREE.Matrix4().compose(
        new THREE.Vector3(d.x, d.y, d.z),
        q,
        new THREE.Vector3(d.scale, d.scale, d.scale),
      )
    })
  }, [groundFn, trackSamples])

  const setRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    },
    [matrices],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  if (matrices.length === 0) return null
  return <instancedMesh ref={setRef} args={[geometry, material, matrices.length]} />
}
