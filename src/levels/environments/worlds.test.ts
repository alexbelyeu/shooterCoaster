import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { BIOME_TYPES } from '@/types/level'
import { BIOMES } from './biomeRegistry'
import { WORLD_CHUNKS } from './worlds'

describe('world chunks (#862)', () => {
  it.each(BIOME_TYPES)('%s: its world holds its biome and every enemy, bystander and boss its levels spawn', async (biome) => {
    const { world } = await WORLD_CHUNKS[biome]()
    expect(world.biome).toBe(BIOMES[biome])
    const needed = getAllLevels()
      .filter((level) => level.biome === biome)
      .flatMap((level) => [
        ...level.enemies.flatMap((wave) => [wave.type, ...(wave.bystanders ? [wave.bystanders.type] : [])]),
        ...(level.boss ? [level.boss.type] : []),
      ])
    const held = [...Object.keys(world.enemies), ...Object.keys(world.bosses)]
    expect(needed.filter((type) => !held.includes(type))).toEqual([])
  })

  it('no game module imports the all-biome registries: a world reaches the game only through its chunk', () => {
    const src = join(__dirname, '../..')
    const registries = /from '[^']*\/(biomeRegistry|enemyComponents|bossComponents)'/
    const offenders: string[] = []
    for (const entry of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
      if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry) || entry.startsWith('dev/')) continue
      if (registries.test(readFileSync(join(src, entry), 'utf8'))) offenders.push(entry)
    }
    expect(offenders).toEqual([])
  })
})
