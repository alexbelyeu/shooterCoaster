import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import { buildArcTable } from '@/track/arcLength'
import { wallNormal } from '@/entities/spawning/enemyPlacement'
import { buildTrackIndex } from '../../shared/trackClearance'
import { ARETE_WIDTH, CEILING_Y, GYM_WALLS, HALL, HALL_WALLS, SPORT_HEIGHT, wallLanes } from './hall'
import { ROUTE_COLORS, boulderSpots, wallDressing } from './gymLayout'

const level = getLevelConfig('level6')!
const { varA, varB, varC, scalar } = level.track
const table = buildArcTable(createTrigCurve2(varA, varB, varC, scalar))

describe('the Climbing Gym hall', () => {
  it('holds level6 track inside it, ≥ 100 from every wall and under the catwalk', () => {
    let clear = Infinity
    let top = -Infinity
    for (let i = 0; i < table.count; i++) {
      clear = Math.min(clear, table.x[i] - HALL.minX, HALL.maxX - table.x[i], table.z[i] - HALL.minZ, HALL.maxZ - table.z[i])
      top = Math.max(top, table.y[i])
    }
    expect(level.track.curve).toBe('curve2')
    expect(clear).toBeGreaterThanOrEqual(100)
    expect(top).toBeLessThan(SPORT_HEIGHT)
    expect(SPORT_HEIGHT).toBeLessThan(CEILING_Y)
  })

  it('splits every wall into lanes between arêtes, and the level climbs those lanes facing into the hall', () => {
    for (const wall of HALL_WALLS) {
      const lanes = wallLanes(wall)
      expect(lanes[0].u0).toBe(ARETE_WIDTH)
      expect(wall.length - lanes[lanes.length - 1].u1).toBeCloseTo(ARETE_WIDTH, 6)
      for (const lane of lanes) expect(lane.u1 - lane.u0).toBeGreaterThan(300)
    }
    expect(level.walls).toBe(GYM_WALLS)
    const centre = { x: (HALL.minX + HALL.maxX) / 2, z: (HALL.minZ + HALL.maxZ) / 2 }
    for (const w of GYM_WALLS) {
      const n = wallNormal(w)
      // From the wall towards the middle of the hall.
      expect(n.x * (centre.x - w.origin.x) + n.z * (centre.z - w.origin.z)).toBeGreaterThan(0)
      expect(w.height).toBe(SPORT_HEIGHT)
    }
  })

  it('dresses the lanes the same every visit: routes of one colour, holds on the lanes', () => {
    const a = wallDressing(1)
    expect(wallDressing(1)).toEqual(a)
    expect(a.holds.length).toBeGreaterThan(500)
    expect(a.holds.length).toBeLessThan(2000)
    expect(new Set(a.holds.map((h) => h.color))).toEqual(new Set(ROUTE_COLORS))
    const inside = a.holds.every((h) => h.y > 0 && h.y < SPORT_HEIGHT && h.x >= HALL.minX - 1 && h.x <= HALL.maxX + 1 && h.z >= HALL.minZ - 1 && h.z <= HALL.maxZ + 1)
    expect(inside).toBe(true)
  })

  it('puts the boulders on the floor clear of the track and its towers, apart, inside the hall', () => {
    const boulders = boulderSpots(table, 4571)
    const index = buildTrackIndex(table)
    expect(boulders.length).toBeGreaterThanOrEqual(2)
    for (const b of boulders) {
      expect(index.near(b.x, b.z, b.radius + 60)).toBe(false)
      expect(b.x - b.radius).toBeGreaterThan(HALL.minX)
      expect(b.x + b.radius).toBeLessThan(HALL.maxX)
      expect(b.z - b.radius).toBeGreaterThan(HALL.minZ)
      expect(b.z + b.radius).toBeLessThan(HALL.maxZ)
    }
  })
})
