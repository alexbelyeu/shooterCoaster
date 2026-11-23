import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { BIOME_TYPES } from '@/types/level'
import { BIOMES } from './biomeRegistry'
import { forgetWorldFailures, loadedWorld, loadWorld, WORLD_CHUNKS, type World } from './worlds'

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

describe('loadWorld (#889)', () => {
  it('a world chunk that fails stays failed for the render waiting on it, until the boundary forgets it', async () => {
    const real = WORLD_CHUNKS.gym
    const offline = vi.fn(() => Promise.reject<{ world: World }>(new Error('offline')))
    WORLD_CHUNKS.gym = offline
    try {
      const first = loadWorld('gym')
      await expect(first).rejects.toThrow('offline')
      expect(offline).toHaveBeenCalledTimes(1)
      // After it settles, the next render still reads the same rejection (and throws it to `LevelSceneBoundary`),
      // instead of a fresh promise that suspends again.
      expect(loadWorld('gym')).toBe(first)
      expect(offline).toHaveBeenCalledTimes(1)

      forgetWorldFailures()
      WORLD_CHUNKS.gym = real
      const world = await loadWorld('gym')
      expect(loadedWorld('gym')).toBe(world)
    } finally {
      WORLD_CHUNKS.gym = real
    }
  })

  it('forgetting failures keeps a load still in flight', async () => {
    const real = WORLD_CHUNKS.desert
    let arrive: (m: { world: World }) => void = () => {}
    const slow = vi.fn(() => new Promise<{ world: World }>(resolve => (arrive = resolve)))
    WORLD_CHUNKS.desert = slow
    try {
      const pending = loadWorld('desert')
      forgetWorldFailures()
      expect(loadWorld('desert')).toBe(pending)
      const { world } = await real()
      arrive({ world })
      await expect(pending).resolves.toBe(world)
      expect(slow).toHaveBeenCalledTimes(1)
    } finally {
      WORLD_CHUNKS.desert = real
    }
  })
})
