import type { World } from '@/levels/environments/worlds'
import { arctic } from '.'
import Snowman from '@/entities/enemies/Snowman'
import SnowmanScout from '@/entities/enemies/SnowmanScout'
import SnowmanBrute from '@/entities/enemies/SnowmanBrute'
import Yeti from '@/entities/bosses/Yeti'
import { rides } from './rides'

/** The arctic world's chunk (#862): its biome, the enemies its levels spawn, its boss and its ride. */
export const world: World = {
  biome: arctic,
  enemies: { snowman: Snowman, snowmanScout: SnowmanScout, snowmanBrute: SnowmanBrute },
  bosses: { yeti: Yeti },
  rides,
}
