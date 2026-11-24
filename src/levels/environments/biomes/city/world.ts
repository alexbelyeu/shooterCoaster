import type { World } from '@/levels/environments/worlds'
import { city } from '.'
import HoverDrone from '@/entities/enemies/HoverDrone'

/** The city world's chunk (#862): its biome and the enemies its levels spawn; no boss yet (#322). */
export const world: World = {
  biome: city,
  enemies: { hoverDrone: HoverDrone },
  bosses: {},
}
