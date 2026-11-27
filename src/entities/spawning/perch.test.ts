import { describe, expect, it } from 'vitest'
import { buildArcTable } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { GYM_TRACK } from '@/levels/environments/biomes/gym/gymTrack'
import { FLAME_PERCH } from '@/levels/environments/biomes/gym/flameFire'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createRng } from '@/utils/rng'
import { perchSlots, placeOnPerch } from './perch'

const table = buildArcTable(createTrackCurve(GYM_TRACK))

describe('level 6 dust over the Flame (#945)', () => {
  const wave = getLevelConfig('level6')!.enemies.find((w) => w.perch)!
  const placed = placeOnPerch(FLAME_PERCH, table, perchSlots(wave.count, createRng(1337)))

  it('hangs over the top, from its lift to its rise', () => {
    const { x, z, y, halfLength, halfWidth, lift, rise } = FLAME_PERCH
    const off = placed.filter(({ position: p, floor }) =>
      Math.abs(p.x - x) > halfLength || Math.abs(p.z - z) > halfWidth || floor.y < y + lift || floor.y > y + lift + rise || p.y !== floor.y)
    expect(off).toEqual([])
  })

  it('keeps off the rails it rolls along', () => {
    let nearest = Infinity
    for (const { position: p } of placed) {
      for (let i = 0; i < table.count; i++) {
        if (Math.abs(table.y[i] - p.y) < 2 * FLAME_PERCH.railClear) nearest = Math.min(nearest, Math.hypot(table.x[i] - p.x, table.z[i] - p.z))
      }
    }
    expect(nearest).toBeGreaterThan(FLAME_PERCH.railClear * 0.9)
  })
})
