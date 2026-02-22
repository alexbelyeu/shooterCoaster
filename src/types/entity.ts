import type { Vector3 } from 'three'

export interface EntityState {
  id: string
  position: Vector3
  alive: boolean
  scoreValue: number
  radius: number
}
