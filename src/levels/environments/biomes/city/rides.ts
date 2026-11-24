import type { LevelRide } from '@/types/level'
import { CITY_LEVEL_RIDE } from './cityLevel'

/** The city world's rides by level (#871, #960): its chunk's `rides`, and what `shippedLevels.ts` finds for the tests. */
export const rides: Readonly<Record<string, LevelRide>> = { level7: CITY_LEVEL_RIDE }
