import { useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { inRiderSight } from './riderSight'
import { slipOffset, slipped, type SlipAway } from './slipAway.hot'

/**
 * An enemy's slip away (`slipAway.hot.ts`): call it each frame from `updatePosition` with where it is; it returns how far
 * it has gone, or -1 once it is gone (return 'escaped'). Without `s` it always returns 0: it stays.
 */
export function useSlipAway(s: SlipAway | undefined): (position: THREE.Vector3, time: number) => number {
  const camera = useThree((st) => st.camera)
  const seenAt = useRef(-1)
  return useCallback(
    (position: THREE.Vector3, time: number) => {
      if (!s) return 0
      if (seenAt.current < 0) {
        if (!inRiderSight(position, camera, s.near, s.seenCos)) return 0
        seenAt.current = time
      }
      const seen = time - seenAt.current
      return slipped(s, seen) ? -1 : slipOffset(s, seen)
    },
    [camera, s],
  )
}
