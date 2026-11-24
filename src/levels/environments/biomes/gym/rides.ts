import type { LevelRide } from '@/types/level'
import { GYM_LEVEL_RIDE } from './gymLevel'

/** The gym world's rides by level (#960): its chunk's `rides`, and what `shippedLevels.ts` finds for the tests. */
export const rides: Readonly<Record<string, LevelRide>> = { level6: GYM_LEVEL_RIDE }
