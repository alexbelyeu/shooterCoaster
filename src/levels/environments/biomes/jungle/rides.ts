import type { LevelRide } from '@/types/level'
import { JUNGLE_LEVEL_RIDE } from './jungleLevel'

/** The jungle world's rides by level (#1009): its chunk's `rides`, and what `shippedLevels.ts` finds for the tests. */
export const rides: Readonly<Record<string, LevelRide>> = { level8: JUNGLE_LEVEL_RIDE }
