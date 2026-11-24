import type { LevelRide } from '@/types/level'
import { OCEAN_LEVEL_RIDE } from './oceanLevel'

/** The ocean world's rides by level (#960): its chunk's `rides`, and what `shippedLevels.ts` finds for the tests. */
export const rides: Readonly<Record<string, LevelRide>> = { level3: OCEAN_LEVEL_RIDE }
