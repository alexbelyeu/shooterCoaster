import { useThree } from '@react-three/fiber'
import { useCallback, useRef } from 'react'
import type * as THREE from 'three'
import type { EnemyType } from '@/types/level'
import { SEA_DIVE, diveProgress, type DiveClock } from './seaDive.hot'

/**
 * A sea creature's dive (`seaDive.hot.ts`, #1059) for its `updatePosition`: how far into it the body is at game second
 * `time`. Only a spawned enemy (one that can escape, `onEscape`) dives; the turntable's stay up.
 */
export function useSeaDive(type: EnemyType, escapes: boolean): (mesh: THREE.Object3D, time: number) => number {
  const camera = useThree((s) => s.camera)
  const clock = useRef<DiveClock>({ seenAt: -1 })
  const stay = SEA_DIVE.stay[type]
  return useCallback(
    (mesh: THREE.Object3D, time: number) => {
      if (!escapes || stay === undefined) return 0
      const e = camera.matrixWorld.elements
      const p = mesh.position
      return diveProgress(clock.current, time, stay, p.x - e[12], p.y - e[13], p.z - e[14], -e[8], -e[9], -e[10])
    },
    [camera, escapes, stay],
  )
}
