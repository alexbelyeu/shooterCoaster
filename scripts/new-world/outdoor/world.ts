import type { World } from '@/levels/environments/worlds'
import Balloon from '@/entities/enemies/Balloon'
import Crow from '@/entities/enemies/Crow'
import { __BIOME__ } from '.'

/** __NAME__'s chunk (#862): its biome and the starter roster's enemies. Each enemy and the boss its level gains goes here too. */
export const world: World = {
  biome: __BIOME__,
  enemies: { balloon: Balloon, crow: Crow },
  bosses: {},
}
