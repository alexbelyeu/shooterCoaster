import { useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { inRiderSight } from './riderSight'
import { SNOW_SINK, snowSinkDepth, snowSunk } from './snowSink.hot'

/**
 * A snowman's sink into the snow (`snowSink.hot.ts`): call it each frame from `updatePosition` with where it stands; it
 * returns how far to lower it, or -1 once it has gone under (return 'escaped').
 */
export function useSnowSink(): (position: THREE.Vector3, time: number) => number {
  const camera = useThree((s) => s.camera)
  const seenAt = useRef(-1)
  return useCallback(
    (position: THREE.Vector3, time: number) => {
      if (seenAt.current < 0) {
        if (!inRiderSight(position, camera, SNOW_SINK.near, SNOW_SINK.seenCos)) return 0
        seenAt.current = time
      }
      const seen = time - seenAt.current
      return snowSunk(seen) ? -1 : snowSinkDepth(seen)
    },
    [camera],
  )
}
