import type { World } from '@/levels/environments/worlds'
import { desert } from '.'
import Crow from '@/entities/enemies/Crow'
import Scorpion from '@/entities/enemies/Scorpion'
import GiantScorpion from '@/entities/bosses/GiantScorpion'

/** The desert world's chunk (#862): its biome, the enemies its levels spawn and its boss. */
export const world: World = {
  biome: desert,
  enemies: { crow: Crow, scorpion: Scorpion },
  bosses: { giantScorpion: GiantScorpion },
}
