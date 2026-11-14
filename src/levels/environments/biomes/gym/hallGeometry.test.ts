import { describe, expect, it } from 'vitest'
import type * as THREE from 'three'
import { GYM_SCALE, HALL, PIT, toWorld } from './blockout'
import { gymFloor } from './config'
import { buildHall } from './hallGeometry'
import { scatterOn } from './holds'

const hall = buildHall()
const triangles = (g: THREE.BufferGeometry) => g.attributes.position.count / 3

describe('the Climbing Gym hall', () => {
  it('floor: the main floor at 0, the Starr pit 2.45 m down', () => {
    const inPit = toWorld({ x: (PIT.minX + PIT.maxX) / 2, y: 0, z: 20 })
    const onFloor = toWorld({ x: 40, y: 0, z: 20 })
    expect(gymFloor(inPit.x, inPit.z)).toBeCloseTo(-2.45 * GYM_SCALE)
    expect(gymFloor(onFloor.x, onFloor.z)).toBe(0)
  })

  it('stays in and round the hall, with finite positions, inside the triangle budget', () => {
    let bad = 0
    let outside = 0
    const half = (HALL.w / 2 + 12) * GYM_SCALE
    for (const g of [hall.solid, hall.light, hall.glass]) {
      const a = g.attributes.position.array
      for (let i = 0; i < a.length; i += 3) {
        if (!Number.isFinite(a[i]) || !Number.isFinite(a[i + 1]) || !Number.isFinite(a[i + 2])) bad++
        if (Math.abs(a[i]) > half || Math.abs(a[i + 2]) > half || a[i + 1] > (HALL.h + 1) * GYM_SCALE) outside++
      }
    }
    expect(bad).toBe(0)
    expect(outside).toBe(0)
    const holdTriangles = hall.holds.matrices.length * 20 + hall.volumes.matrices.length * 6
    expect(triangles(hall.solid) + triangles(hall.light) + triangles(hall.glass) + holdTriangles).toBeLessThan(120_000)
  })

  it('paints every vertex', () => {
    expect(hall.solid.attributes.color.count).toBe(hall.solid.attributes.position.count)
  })

  it('studs the climbing faces with holds and the boulders with volumes', () => {
    expect(hall.holds.matrices.length).toBeGreaterThan(800)
    expect(hall.volumes.matrices.length).toBeGreaterThan(30)
    expect(hall.holds.colors).toHaveLength(hall.holds.matrices.length)
  })
})

describe('scatterOn', () => {
  // A 2 × 2 m square facing +z, and the same square wound to face −z.
  const front = [0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 2, 0]
  const back = [0, 0, 0, 2, 2, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 2, 2, 0]

  it('places density × area points on accepted faces, the same for a seed', () => {
    const pts = scatterOn(front, (_x, _y, z) => z > 0, 5, 1)
    expect(pts).toHaveLength(20)
    expect(pts.every((p) => p.x >= 0 && p.x <= 2 && p.y >= 0 && p.y <= 2 && p.z === 0 && p.nz === 1)).toBe(true)
    expect(scatterOn(front, () => true, 5, 1)).toEqual(pts)
  })

  it('skips rejected faces', () => {
    expect(scatterOn(back, (_x, _y, z) => z > 0, 5, 1)).toHaveLength(0)
  })
})
