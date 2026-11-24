import type { LevelRide, RiddenLevel } from '@/types/level'
import { getAllLevels, getLevelConfig } from './LevelRegistry'

/**
 * Every level with its ride in hand, at once: for tests and the dev pages, never the game, which would carry every ride in
 * its startup JS (#960; `worlds.test.ts` holds the game to that). The rides the registry doesn't carry, gathered from every
 * world's `rides.ts`, the same records its chunk's `World.rides` are, so a new world's ride needs no line here.
 */
export const WORLD_RIDES: Readonly<Record<string, LevelRide>> = Object.assign(
  {},
  ...Object.values(import.meta.glob<Readonly<Record<string, LevelRide>>>('./environments/biomes/*/rides.ts', { import: 'rides', eager: true })),
)

/** A shipped level and its ride. */
export function shippedLevel(id: string): RiddenLevel {
  const config = getLevelConfig(id)
  if (!config) throw new Error(`no level ${id}`)
  const { ride: own, ...level } = config
  const ride = own ?? WORLD_RIDES[id]
  if (!ride) throw new Error(`${id}: no ride in the registry or its world's rides.ts`)
  return { ...level, ...ride }
}

/** Every shipped level and its ride, in order. */
export function shippedLevels(): RiddenLevel[] {
  return getAllLevels().map((l) => shippedLevel(l.id))
}
