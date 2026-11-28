import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import type { EnemyFleet } from './enemyFleet'

/** Seats the enemy's mesh (the returned ref) in `fleet` while it is mounted (`enemyFleet.ts`). */
export function useFleetSeat(fleet: EnemyFleet) {
  const meshRef = useRef<THREE.Mesh>(null)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const seat = fleet.join(mesh, scene)
    return () => fleet.leave(seat)
  }, [fleet, scene])

  return meshRef
}
