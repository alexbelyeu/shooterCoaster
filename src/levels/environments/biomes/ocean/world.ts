import type { World } from '@/levels/environments/worlds'
import { ocean } from '.'
import Shark from '@/entities/enemies/Shark'
import Jellyfish from '@/entities/enemies/Jellyfish'
import FlyingFish from '@/entities/enemies/FlyingFish'
import Kraken from '@/entities/bosses/Kraken'
import { OCEAN_LEVEL_RIDE } from './oceanLevel'

/** The ocean world's chunk (#862): its biome, the enemies its levels spawn, its boss and its ride. */
export const world: World = {
  biome: ocean,
  enemies: { shark: Shark, jellyfish: Jellyfish, flyingFish: FlyingFish },
  bosses: { kraken: Kraken },
  rides: { level3: OCEAN_LEVEL_RIDE },
}
