import { describe, expect, it } from 'vitest'
import { FLAME, GYM_SCALE, PIT, piece, toWorld } from './blockout'
import { PATHS } from './floorPaths'
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
