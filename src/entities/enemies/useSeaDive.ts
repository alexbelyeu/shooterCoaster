import { useThree } from '@react-three/fiber'
import { useCallback, useRef } from 'react'
import type * as THREE from 'three'
import type { EnemyType } from '@/types/level'
import { inRiderSight } from './riderSight'
import { SEA_DIVE, diveProgress } from './seaDive.hot'

/**
 * A sea creature's dive (`seaDive.hot.ts`, #1059) for its `updatePosition`: how far into it the body is at game second
 * `time`. Only a spawned enemy (one that can escape, `onEscape`) dives; the turntable's stay up.
 */
export function useSeaDive(type: EnemyType, escapes: boolean): (mesh: THREE.Object3D, time: number) => number {
  const camera = useThree((s) => s.camera)
  const seenAt = useRef(-1)
  const stay = SEA_DIVE.stay[type]
  return useCallback(
    (mesh: THREE.Object3D, time: number) => {
      if (!escapes || stay === undefined) return 0
      if (seenAt.current < 0) {
        if (!inRiderSight(mesh.position, camera, SEA_DIVE.near, SEA_DIVE.seenCos)) return 0
        seenAt.current = time
      }
      return diveProgress(time - seenAt.current, stay)
    },
    [camera, escapes, stay],
  )
}
