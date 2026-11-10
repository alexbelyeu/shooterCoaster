import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import { buildArcTable } from '@/track/arcLength'
import { createHeightFunction, sampleTrackPath } from '@/utils/terrainNoise'
import { createRng } from '@/utils/rng'
import type { EnemyType, WallSurface } from '@/types/level'
import { maxReadableDistance } from '../enemies/enemyReadability'
import {
  ENEMY_PLACEMENT, WALL_START_SPREAD, WATER_DEPTH, WATER_Y, readableScatterSpawn, scatterSpawn, wallNormal, wallPoint, wallSlots,
  type ScatterBand,
} from './enemyPlacement'

const types = Object.keys(ENEMY_PLACEMENT) as EnemyType[]
const scattered = types.filter((t) => typeof ENEMY_PLACEMENT[t].scatter === 'object')

describe('scatterSpawn', () => {
  const flat = () => 10

  it.each(scattered)('%s: inside its band', (type) => {
    const { surface, scatter } = ENEMY_PLACEMENT[type]
    const b = scatter as ScatterBand
    const rng = createRng(5)
    for (let i = 0; i < 200; i++) {
      const p = scatterSpawn(b, surface, flat, rng)
      const r = Math.hypot(p.x, p.z)
      expect(r).toBeGreaterThanOrEqual(b.radiusMin - 1e-9)
      expect(r).toBeLessThanOrEqual(b.radiusMin + b.radiusSpan + 1e-9)
      const above = p.y - (surface === 'water' ? WATER_Y : 10)
      expect(above).toBeGreaterThanOrEqual(Math.min(b.yMin, b.yMin + b.ySpan) - 1e-9)
      expect(above).toBeLessThanOrEqual(Math.max(b.yMin, b.yMin + b.ySpan) + 1e-9)
    }
  })

  it('puts water enemies over the sea when there is some', () => {
    const shore = (x: number) => (x < 0 ? -20 : 10)
    const { surface, scatter } = ENEMY_PLACEMENT.flyingFish
    const rng = createRng(9)
    for (let i = 0; i < 100; i++) expect(shore(scatterSpawn(scatter as ScatterBand, surface, shore, rng).x)).toBeLessThan(WATER_DEPTH)
  })
})

describe('readableScatterSpawn', () => {
  it.each(getAllLevels().map((l) => [l.id, l] as const))('%s: scatter waves spawn within readable range of the track', (_id, level) => {
    const factory = level.track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve
    const curve = factory(level.track.varA, level.track.varB, level.track.varC, level.track.scalar)
    const table = buildArcTable(curve)
    const heightFn = createHeightFunction(level.biome, sampleTrackPath((t) => curve.getPointAt(t)))
    const rng = createRng(1337)
    const waves = level.enemies.filter((w) => (!w.formation || w.formation === 'scatter') && scattered.includes(w.type))
    let readable = 0
    let total = 0
    for (const wave of waves) {
      const { surface, scatter } = ENEMY_PLACEMENT[wave.type]
      const max = maxReadableDistance(wave.type) * 1.05
      for (let i = 0; i < wave.count; i++) {
        const p = readableScatterSpawn(wave.type, scatter as ScatterBand, surface, table, heightFn, rng)
        let near = Infinity
        for (let j = 0; j < table.count; j += 8) near = Math.min(near, Math.hypot(table.x[j] - p.x, table.y[j] - p.y, table.z[j] - p.z))
        total++
        if (near <= max) readable++
      }
    }
    if (total > 0) expect(readable / total).toBeGreaterThan(0.9)
  })
})

describe('wall enemies', () => {
  const walls: WallSurface[] = [
    { id: 'north', origin: { x: -100, y: 0, z: -400 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, width: 300, height: 500 },
    // Leaning back 30° and facing -x.
    {
      id: 'slab',
      origin: { x: 400, y: 10, z: 200 },
      right: { x: 0, y: 0, z: 1 },
      up: { x: Math.sin(Math.PI / 6), y: Math.cos(Math.PI / 6), z: 0 },
      width: 80,
      height: 300,
    },
  ]

  it('climbers climb walls, and only wall enemies do', () => {
    expect(ENEMY_PLACEMENT.climber).toEqual({ surface: 'wall', scatter: 'wall' })
    for (const t of types) expect(ENEMY_PLACEMENT[t].surface === 'wall', t).toBe(ENEMY_PLACEMENT[t].scatter === 'wall')
  })

  it('starts each at the foot of one of the walls, off its edges, using every wall', () => {
    const slots = wallSlots(60, walls, createRng(3))
    expect(new Set(slots.map((s) => s.wall.id))).toEqual(new Set(['north', 'slab']))
    for (const s of slots) {
      expect(s.u).toBeGreaterThanOrEqual(Math.min(30, s.wall.width / 2))
      expect(s.u).toBeLessThanOrEqual(s.wall.width - Math.min(30, s.wall.width / 2))
      expect(s.v).toBeGreaterThanOrEqual(0)
      expect(s.v).toBeLessThanOrEqual(WALL_START_SPREAD * s.wall.height)
    }
    expect(wallSlots(5, walls, createRng(3))).toEqual(wallSlots(5, walls, createRng(3)))
  })

  it('needs the level to have walls', () => {
    expect(() => wallSlots(1, [], createRng(1))).toThrow(/walls/)
  })

  it('puts wall points on the face, off it along right × up', () => {
    const slab = walls[1]
    const n = wallNormal(slab)
    expect(n.x).toBeCloseTo(-Math.cos(Math.PI / 6))
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1)
    const p = wallPoint(slab, 40, 100, 8, { x: 0, y: 0, z: 0 })
    expect(p.z).toBeCloseTo(slab.origin.z + 40)
    expect(p.y).toBeCloseTo(slab.origin.y + 100 * Math.cos(Math.PI / 6) + 8 * n.y)
  })

  it.each(getAllLevels().map((l) => [l.id, l] as const))('%s: has walls if it has wall enemies', (_id, level) => {
    if (level.enemies.some((w) => ENEMY_PLACEMENT[w.type].surface === 'wall')) expect(level.walls?.length).toBeGreaterThan(0)
  })
})
