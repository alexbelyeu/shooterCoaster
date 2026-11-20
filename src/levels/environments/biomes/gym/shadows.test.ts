import { describe, expect, it } from 'vitest'
import { buildContactShadowGeometry, SHADOW_LIFT } from '../../shared/contactShadows'
import { FLAME, GYM_SCALE, PIT, piece, toBlockout, toWorld } from './blockout'
import { PATHS, onPath } from './floorPaths'
import { gymShadowCasters, standingSurfaceAt } from './shadows'

describe('gym contact shadows', () => {
  const casters = gymShadowCasters()

  it('casts under the Flame, on its mats', () => {
    const flame = toWorld({ ...FLAME.centre, y: 0 })
    const under = casters.find((c) => Math.hypot(c.x - flame.x, c.z - flame.z) < GYM_SCALE)
    expect(under).toBeDefined()
    const pad = piece('pad', 'pad-flame')
    expect(under!.ground!(flame.x, flame.z)).toBeCloseTo((pad.base + pad.thick) * GYM_SCALE)
  })

  it("stands the Tree on the pit's mats", () => {
    const tree = piece('tree')
    expect(standingSurfaceAt(tree.x, tree.z)).toBe(PIT.floorY + PIT.mats)
  })

  it('lays shadows on a walkway at floor level, not on the mats it cuts through', () => {
    const ring = PATHS[0]
    expect(standingSurfaceAt((ring.minX + ring.maxX) / 2, (ring.minZ + ring.maxZ) / 2)).toBe(0)
  })

  it("lays every shadow cell over a walkway at the walkway's floor, the Flame's beside its raised mats too (#683)", () => {
    const geo = buildContactShadowGeometry(casters, () => 0)
    const pos = geo.getAttribute('position')
    const index = geo.getIndex()!
    let worst = 0
    for (let t = 0; t < index.count; t += 3) {
      let x = 0
      let y = 0
      let z = 0
      for (let k = 0; k < 3; k++) {
        const v = index.getX(t + k)
        x += pos.getX(v) / 3
        y += pos.getY(v) / 3
        z += pos.getZ(v) / 3
      }
      const p = toBlockout({ x, y, z })
      if (onPath(p.x, p.z)) worst = Math.max(worst, p.y - standingSurfaceAt(p.x, p.z) - SHADOW_LIFT / GYM_SCALE)
    }
    expect(worst).toBeLessThan(1e-3)
  })

  it("splits the Flame's grid at the east walkway and still covers its whole footprint and spread", () => {
    const flame = toWorld({ ...FLAME.centre, y: 0 })
    const parts = casters.filter((c) => c.x === flame.x && c.z === flame.z)
    expect(parts.length).toBeGreaterThan(1)
    const c = parts[0]
    const whole = 4 * (c.halfX + c.spread) * (c.halfZ + c.spread)
    const area = parts.reduce((sum, p) => sum + (p.grid!.maxX - p.grid!.minX) * (p.grid!.maxZ - p.grid!.minZ), 0)
    expect(area).toBeCloseTo(whole, 0)
  })

  it("casts under the Arch's two legs, not its lintel", () => {
    const arch = piece('arch')
    const { x, z } = toWorld({ x: arch.x, y: 0, z: arch.z })
    const near = casters.filter((c) => Math.abs(c.x - x) < (arch.length / 2) * GYM_SCALE && Math.abs(c.z - z) < (arch.d / 2) * GYM_SCALE)
    expect(near).toHaveLength(2)
    expect(near.every((c) => Math.abs(c.x - x) > (arch.opening / 2) * GYM_SCALE)).toBe(true)
  })

  it('gives every footprint a size and a strength in range', () => {
    expect(casters.every((c) => c.halfX > 0 && c.halfZ > 0 && c.strength > 0 && c.strength <= 1)).toBe(true)
  })
})
