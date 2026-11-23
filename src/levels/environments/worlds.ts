import { createContext, useContext, type ComponentType } from 'react'
import type { BiomeType, BossType, EnemyType } from '@/types/level'
import type { EnemyProps } from '@/entities/enemies/EnemyBase'
import type { BossProps } from '@/entities/bosses/BossBase'
import { lazyChunk } from '@/core/staleBuild'
import { importWithRetry } from '@/canvas/loadLevelScene'
import { createHeightFunction, type HeightFunction, type TrackSample } from '@/utils/terrainNoise'
import type { BiomeDefinition } from './shared/types'

/**
 * One world's own code (#862): its biome (decorations, features, terrain) and the enemies and boss its levels spawn.
 * Each is a lazy chunk of its own (`biomes/<biome>/world.ts`), fetched by the level core when a run starts (`loadWorld`),
 * so a run loads its world and never the other worlds'. Only the core imports this module: what a world shares with
 * the core is then the core's, never a chunk of its own.
 */
export interface World {
  biome: BiomeDefinition
  enemies: Partial<Record<EnemyType, ComponentType<EnemyProps>>>
  bosses: Partial<Record<BossType, ComponentType<BossProps>>>
}

/**
 * Every biome's world chunk. One literal `import()` each, so the build splits them; the `Record` makes a missing
 * world a compile error. The game reaches a biome's code only through here (`worlds.test.ts`).
 */
export const WORLD_CHUNKS: Record<BiomeType, () => Promise<{ world: World }>> = {
  themePark: () => import('./biomes/themePark/world'),
  desert: () => import('./biomes/desert/world'),
  ocean: () => import('./biomes/ocean/world'),
  arctic: () => import('./biomes/arctic/world'),
  volcanic: () => import('./biomes/volcanic/world'),
  gym: () => import('./biomes/gym/world'),
}

const worldLoaders = new Map<BiomeType, () => Promise<World>>()
const loadedWorlds = new Map<BiomeType, World>()

/**
 * A biome's world chunk: fetched once, when a run of it starts (the loading screen asks for it as soon as the core is
 * in, `LevelScene` waits for it), retried and forgotten on failure like the core (`canvas/loadLevelScene.ts`, #823).
 */
export function loadWorld(biome: BiomeType): Promise<World> {
  let load = worldLoaders.get(biome)
  if (!load) {
    load = lazyChunk(() =>
      importWithRetry(WORLD_CHUNKS[biome]).then(({ world }) => {
        loadedWorlds.set(biome, world)
        return world
      }),
    )
    worldLoaders.set(biome, load)
  }
  return load()
}

/** The biome's world once its chunk has arrived: a level of it mounts without suspending. */
export const loadedWorld = (biome: BiomeType): World | undefined => loadedWorlds.get(biome)

/** A biome's ground, for every caller: an interior's authored `floor` as given, else the noise terrain kept off the track. */
export function groundOf(biome: BiomeType, def: BiomeDefinition, trackSamples?: TrackSample[]): HeightFunction {
  return def.floor ?? createHeightFunction(biome, trackSamples)
}

/** The running level's world, provided by `LevelScene` once its chunk has loaded. */
export const WorldContext = createContext<World | null>(null)

export function useWorld(): World {
  const world = useContext(WorldContext)
  if (!world) throw new Error('useWorld: no world (mount inside LevelScene)')
  return world
}
