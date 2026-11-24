import type { World } from '@/levels/environments/worlds'
import { gym } from '.'
import Climber from '@/entities/enemies/Climber'
import Rat from '@/entities/enemies/Rat'
import DustBunny from '@/entities/enemies/DustBunny'
import Lanternfly from '@/entities/enemies/Lanternfly'
import Medusa from '@/entities/bosses/Medusa'
import { rides } from './rides'

/** The gym world's chunk (#862): its biome, the enemies its levels spawn, its boss and its ride. */
export const world: World = {
  biome: gym,
  enemies: { climber: Climber, rat: Rat, dustBunny: DustBunny, lanternfly: Lanternfly },
  bosses: { medusa: Medusa },
  rides,
}
