import type { LevelRide } from '@/types/level'
import { INFERNO_LEVEL_RIDE } from './infernoLevel'

/** The volcanic world's rides by level (#960): its chunk's `rides`, and what `shippedLevels.ts` finds for the tests. */
export const rides: Readonly<Record<string, LevelRide>> = { level5: INFERNO_LEVEL_RIDE }
