import type { World } from '@/levels/environments/worlds'
import Balloon from '@/entities/enemies/Balloon'
import Crow from '@/entities/enemies/Crow'
import { jungle } from '.'

/** Jungle Ruins's chunk (#862): its biome and the starter roster's enemies. Each enemy and the boss its level gains goes here too. */
export const world: World = {
  biome: jungle,
  enemies: { balloon: Balloon, crow: Crow },
  bosses: {},
}
