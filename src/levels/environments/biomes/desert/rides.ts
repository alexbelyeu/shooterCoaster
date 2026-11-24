import type { LevelRide } from '@/types/level'
import { DESERT_LEVEL_RIDE } from './desertLevel'

/** The desert world's rides by level (#960): its chunk's `rides`, and what `shippedLevels.ts` finds for the tests. */
export const rides: Readonly<Record<string, LevelRide>> = { level2: DESERT_LEVEL_RIDE }
