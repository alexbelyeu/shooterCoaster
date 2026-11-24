import type { World } from '@/levels/environments/worlds'
import { city } from '.'
import HoverDrone from '@/entities/enemies/HoverDrone'
import BillboardBot from '@/entities/enemies/BillboardBot'
import Helicopter from '@/entities/bosses/Helicopter'

/** The city world's chunk (#862): its biome, the enemies its levels spawn and its boss. */
export const world: World = {
  biome: city,
  enemies: { hoverDrone: HoverDrone, billboardBot: BillboardBot },
  bosses: { helicopter: Helicopter },
}
