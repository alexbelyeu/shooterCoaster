import { describe, expect, it } from 'vitest'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { FLAME, GYM_SCALE, toBlockout } from './blockout'
import { PAD_TOP, SKIN, buildFlameFireShell, emberAnchor, flamePool } from './flameFire'

const shell = buildFlameFireShell()
const vertices = Array.from({ length: shell.positions.length / 3 }, (_, i) => ({
  x: shell.positions[i * 3],
  y: shell.positions[i * 3 + 1],
  z: shell.positions[i * 3 + 2],
}))

describe('the Flame fire', () => {
  it('rises from the mats over the Flame top to a crest above it', () => {
    expect(shell.base).toBeCloseTo(PAD_TOP * GYM_SCALE, 5)
    expect(shell.top).toBeCloseTo(FLAME.top * GYM_SCALE, 5)
    expect(shell.crest).toBeGreaterThan(shell.top)
    const ys = vertices.map((v) => v.y)
    expect(Math.min(...ys)).toBeCloseTo(shell.base, 5)
    expect(Math.max(...ys)).toBeCloseTo(shell.crest, 5)
  })

  it('hugs the Flame: never past its flared footprint by more than the skin', () => {
    let worst = 0
    for (const v of vertices) {
      const b = toBlockout(v)
      worst = Math.max(worst, Math.abs(b.x - FLAME.centre.x) - FLAME.halfX, Math.abs(b.z - FLAME.centre.z) - FLAME.halfZ)
    }
    expect(worst).toBeLessThanOrEqual(SKIN + 1e-6)
  })

  it('wraps its noise round the whole perimeter on every ring, closing the seam', () => {
    // The footprint's ten points and the seam's repeat of the first
    const perRing = 11
    expect(shell.fire.length / 2).toBe(vertices.length)
    expect(vertices.length % perRing).toBe(0)
    for (let r = 0; r < vertices.length / perRing; r++) {
      const first = r * perRing
      const last = first + perRing - 1
      expect(shell.fire[first * 2]).toBe(0)
      expect(shell.fire[last * 2]).toBeCloseTo(shell.perimeter, 3)
      expect(vertices[last].x).toBeCloseTo(vertices[first].x, 5)
      expect(vertices[last].z).toBeCloseTo(vertices[first].z, 5)
    }
    expect([...shell.positions, ...shell.fire].every(Number.isFinite)).toBe(true)
    expect(Math.max(...shell.indices)).toBe(vertices.length - 1)
  })

  it('lays its light pool on the mats round the Flame foot', () => {
    const pool = flamePool()
    expect(pool.centre.y).toBeGreaterThan(PAD_TOP * GYM_SCALE)
    expect(pool.centre.y).toBeLessThan(PAD_TOP * GYM_SCALE + 1)
    expect(pool.halfX).toBeGreaterThan(FLAME.halfX * GYM_SCALE)
    expect(pool.halfZ).toBeGreaterThan(FLAME.halfZ * GYM_SCALE)
  })

  it('anchors rising embers over the Flame, their box reaching from its flare to above the crest', () => {
    const [x, y, z] = emberAnchor()
    const c = toBlockout({ x, y, z })
    expect(c.x).toBeCloseTo(FLAME.centre.x, 5)
    expect(c.z).toBeCloseTo(FLAME.centre.z, 5)
    const { box, primary, secondary } = PARTICLE_PRESETS.gymFlameEmbers
    expect(y - box[1] / 2).toBeLessThan(shell.top)
    expect(y + box[1] / 2).toBeGreaterThan(shell.crest)
    for (const layer of [primary, secondary]) {
      expect(layer.velocity[1]).toBeGreaterThan(0)
      expect(layer.additive).toBe(true)
    }
  })
})
