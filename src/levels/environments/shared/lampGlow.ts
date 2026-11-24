import * as THREE from 'three'

/** Warm lamplight a lit ride or stall adds at night (#829), scaled by the atmosphere's `lampGlow`. */
export const LAMP_WARM = new THREE.Color('#ffb860')

/** Lights `material` from inside by `amount` of `LAMP_WARM` (0 = unlit, the day look); in place, no allocation. */
export function setLampGlow(material: THREE.MeshPhongMaterial, amount: number): void {
  material.emissive.copy(LAMP_WARM).multiplyScalar(amount)
}

/** Soft round sprite so Points read as bulbs and flames, not squares (the caller disposes it). */
export function buildDotTexture(): THREE.Texture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.9)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}
