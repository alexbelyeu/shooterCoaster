import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import { buildArcTable } from '@/track/arcLength'
import { createHeightFunction, sampleTrackPath } from '@/utils/terrainNoise'
import { createRng } from '@/utils/rng'
import type { EnemyType } from '@/types/level'
import { maxReadableDistance } from '../enemies/enemyReadability'
import { ENEMY_PLACEMENT, WATER_DEPTH, WATER_Y, readableScatterSpawn, scatterSpawn, type ScatterBand } from './enemyPlacement'

const scattered = (Object.keys(ENEMY_PLACEMENT) as EnemyType[]).filter((t) => ENEMY_PLACEMENT[t].scatter !== 'trackside')

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
    const { surface, scatter } = ENEMY_PLACEMENT.shark
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
