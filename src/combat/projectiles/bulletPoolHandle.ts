import type * as THREE from 'three'

export interface Bullet {
  alive: boolean
  bornAt: number
  position: THREE.Vector3
  direction: THREE.Vector3
  speed: number
}

export interface BulletPoolHandle {
  /** Returns true if a bullet left the barrel (false when rate-limited or the pool is full). */
  fire: (origin: THREE.Vector3, direction: THREE.Vector3) => boolean
  getLiveBullets: () => Bullet[]
  getLiveBulletCount: () => number
}

let poolHandle: BulletPoolHandle | null = null

export function setBulletPool(handle: BulletPoolHandle | null): void {
  poolHandle = handle
}

export function getBulletPool(): BulletPoolHandle | null {
  return poolHandle
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    poolHandle = null
  })
}
