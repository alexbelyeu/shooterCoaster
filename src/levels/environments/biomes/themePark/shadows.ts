import { roundCaster, type ShadowCaster } from '../../shared/contactShadows'
import { ARCH_HALF_SPAN, RIDES, STALL_DEPTH, STALL_WIDTH, type ThemeParkLayout } from './parkSpec'

export function themeParkShadowCasters(layout: ThemeParkLayout): ShadowCaster[] {
  const out: ShadowCaster[] = []
  for (const s of layout.stalls) {
    out.push({ x: s.x, z: s.z, halfX: STALL_WIDTH / 2, halfZ: STALL_DEPTH / 2, yaw: s.yaw, radius: 2, spread: 10, strength: 0.75 })
  }
  for (const t of layout.tents) out.push(roundCaster(t.x, t.z, 24, 0.75, 0.45))
  for (const h of layout.hedges) {
    out.push({ x: h.x, z: h.z, halfX: 9, halfZ: 3, yaw: h.yaw, radius: 2, spread: 6, strength: 0.6 })
  }
  const { arch } = layout
  if (arch) {
    const cos = Math.cos(arch.yaw)
    const sin = Math.sin(arch.yaw)
    for (const side of [-1, 1]) {
      const lx = side * ARCH_HALF_SPAN
      out.push(roundCaster(arch.x + lx * cos, arch.z - lx * sin, 4, 0.8, 2))
    }
  }
  for (const r of RIDES) {
    out.push(
      r.kind === 'ferrisWheel'
        ? { x: r.x, z: r.z, halfX: r.radius * 0.4, halfZ: 7, radius: 3, spread: r.radius * 0.25, strength: 0.65 }
        : roundCaster(r.x, r.z, r.radius + 2, 0.8, 0.5),
    )
  }
  return out
}
