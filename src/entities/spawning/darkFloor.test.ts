import { describe, expect, it } from 'vitest'
import { buildArcTable, distanceAtT, indexAtT } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { createRng } from '@/utils/rng'
import { PYRAMID_BASE_SIZE, PYRAMID_SHRINK } from '@/levels/environments/landmarkDimensions'
import { DESERT_TRACK, PYRAMID_BASE_Y } from '@/levels/environments/biomes/desert/desertTrack'
import { PYRAMID_PASSAGE, PYRAMID_PASSAGE_FLOOR, RIDE_FRAME } from '@/levels/environments/biomes/desert/landmarks'
import { darkFloorSlots, placeOnDarkFloor } from './darkFloor'
import { indexAhead } from './spawnPlacement'

const table = buildArcTable(createTrackCurve(DESERT_TRACK))
const sections = DESERT_TRACK.darkSections!
const passage = sections[0]
const slots = darkFloorSlots(8, createRng(1337))
const FLOOR_Y = PYRAMID_BASE_Y + PYRAMID_PASSAGE_FLOOR
const HALF_LENGTH = (PYRAMID_BASE_SIZE * PYRAMID_SHRINK ** PYRAMID_PASSAGE.layer) / 2

/** Along the ride's frame (+x toward the Pyramid) and across it. */
const inRideFrame = (p: { x: number; z: number }) => ({
  along: p.x * RIDE_FRAME.cos - p.z * RIDE_FRAME.sin,
  across: p.x * RIDE_FRAME.sin + p.z * RIDE_FRAME.cos,
})

describe('placeOnDarkFloor (#937: level 2’s scorpions in the Pyramid’s passage)', () => {
  const passageAt = indexAtT(table, passage.from)
  const railsAcross = inRideFrame({ x: table.x[passageAt], z: table.z[passageAt] }).across

  it('stands every walker on the passage floor, inside the Pyramid, between the rails and the walls, facing the car', () => {
    const rider = indexAhead(table, passageAt, -300)
    const placed = placeOnDarkFloor(table, rider, sections, slots)
    expect(placed).toHaveLength(8)
    const misplaced = placed.filter(({ position: p, floor }) => {
      const { along, across } = inRideFrame(p)
      const off = Math.abs(across - railsAcross)
      const toRider = { x: table.x[rider] - p.x, z: table.z[rider] - p.z }
      const facing = Math.cos(floor.heading) * toRider.x + Math.sin(floor.heading) * toRider.z
      return Math.abs(floor.y - FLOOR_Y) > 1 || Math.abs(along - RIDE_FRAME.pyramidX) > HALF_LENGTH
        || off < 10 - 1e-6 || off > PYRAMID_PASSAGE.width / 2 - 17 + 1e-6 || facing <= 0
    })
    expect(misplaced).toEqual([])
    expect(new Set(placed.map((p) => Math.sign(inRideFrame(p.position).across - railsAcross)))).toEqual(new Set([-1, 1]))
  })

  it('spreads them down the passage ahead of a rider already inside it', () => {
    const rider = indexAhead(table, passageAt, 200)
    const ahead = placeOnDarkFloor(table, rider, sections, slots).map(({ position: p }) => {
      let best = 0
      let bestD = Infinity
      for (let i = rider; i < rider + 600; i++) {
        const d = Math.hypot(table.x[i] - p.x, table.z[i] - p.z)
        if (d < bestD) [best, bestD] = [i, d]
      }
      return table.s[best] - table.s[rider]
    })
    expect(Math.min(...ahead)).toBeGreaterThan(100)
    expect(Math.max(...ahead) + table.s[rider]).toBeLessThan(distanceAtT(table, passage.to) + 10)
    expect(ahead).toEqual([...ahead].sort((a, b) => a - b))
  })

  it('needs a dark section with a floor', () => {
    expect(() => placeOnDarkFloor(table, 0, [{ ...passage, floor: undefined }], slots)).toThrow(/floor/)
  })
})
