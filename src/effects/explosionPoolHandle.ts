import type * as THREE from 'three'
import type { DeathStyle } from './deathStyles'

export interface ExplosionPoolHandle {
  explode: (position: THREE.Vector3, style: DeathStyle) => void
}

let poolHandle: ExplosionPoolHandle | null = null

export function setExplosionPool(handle: ExplosionPoolHandle | null): void {
  poolHandle = handle
}

export function getExplosionPool(): ExplosionPoolHandle | null {
  return poolHandle
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    poolHandle = null
  })
}
