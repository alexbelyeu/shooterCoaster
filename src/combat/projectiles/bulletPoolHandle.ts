import type * as THREE from 'three'

export interface Bullet {
  alive: boolean
  bornAt: number
  position: THREE.Vector3
  /** Position at the start of this frame's step (the swept hit test runs prev → position). */
  prev: THREE.Vector3
  direction: THREE.Vector3
  /** World units per second. */
  speed: number
  /** Multiplier on target hit radii for this bullet (touch shots get a little slack). */
  hitScale: number
  /** Drawn position minus hit-test position at birth (muzzle tip − camera). */
  muzzleOffset: THREE.Vector3
  /** The pool sets muzzleOffset on the first frame, once the gun has turned to the shot. */
  muzzlePending: boolean
  travelled: number
}

export interface BulletPoolHandle {
  /** Returns true if a bullet left the barrel (false when rate-limited or the pool is full). */
  fire: (origin: THREE.Vector3, direction: THREE.Vector3, hitScale?: number) => boolean
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
