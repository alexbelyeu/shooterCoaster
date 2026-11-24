import type { World } from '@/levels/environments/worlds'
import { city } from '.'
import HoverDrone from '@/entities/enemies/HoverDrone'
import Helicopter from '@/entities/bosses/Helicopter'
import { CITY_LEVEL_RIDE } from './cityLevel'

/** The city world's chunk (#862): its biome, the enemies its levels spawn and its boss, and level 7's ride (#871, #960). */
export const world: World = {
  biome: city,
  enemies: { hoverDrone: HoverDrone },
  bosses: { helicopter: Helicopter },
  rides: { level7: CITY_LEVEL_RIDE },
}
