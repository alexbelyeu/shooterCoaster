import type * as THREE from 'three'

export interface ExplosionPoolHandle {
  activate: (position: THREE.Vector3, color: string) => void
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
