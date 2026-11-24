import type { LevelRide } from '@/types/level'
import { ARCTIC_LEVEL_RIDE } from './arcticLevel'

/** The arctic world's rides by level (#960): its chunk's `rides`, and what `shippedLevels.ts` finds for the tests. */
export const rides: Readonly<Record<string, LevelRide>> = { level4: ARCTIC_LEVEL_RIDE }
