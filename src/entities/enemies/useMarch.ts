import { useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { marchHeading, marchMoving, type FormationMotion } from '@/entities/spawning/spawnPlacement'

/**
 * A formation member's march: its group's `heading` (undefined: no march, the enemy's own wander) and `moving()`,
 * false until the rider first comes within reach of the group (#472). Read `moving()` in `updatePosition`.
 */
export function useMarch(motion: FormationMotion | undefined): { heading: number | undefined; moving: () => boolean } {
  const camera = useThree((s) => s.camera)
  const started = useRef(false)
  const moving = useCallback(() => (started.current ||= marchMoving(motion, camera.position)), [motion, camera])
  return { heading: marchHeading(motion), moving }
}
