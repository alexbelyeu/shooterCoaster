import * as THREE from 'three'

/** Warm lamplight a lit ride or stall adds at night (#829), scaled by the atmosphere's `lampGlow`. */
export const LAMP_WARM = new THREE.Color('#ffb860')

/** Lights `material` from inside by `amount` of `LAMP_WARM` (0 = unlit, the day look); in place, no allocation. */
export function setLampGlow(material: THREE.MeshPhongMaterial, amount: number): void {
  material.emissive.copy(LAMP_WARM).multiplyScalar(amount)
}
