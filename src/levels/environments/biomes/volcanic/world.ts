import type { World } from '@/levels/environments/worlds'
import { volcanic } from '.'
import EmberWisp from '@/entities/enemies/EmberWisp'
import LavaGolem from '@/entities/enemies/LavaGolem'
import FireImp from '@/entities/enemies/FireImp'
import InfernalDrake from '@/entities/enemies/InfernalDrake'
import MagmaTitan from '@/entities/bosses/MagmaTitan'
import { INFERNO_LEVEL_RIDE } from './infernoLevel'

/** The volcanic world's chunk (#862): its biome, the enemies its levels spawn, its boss and its ride. */
export const world: World = {
  biome: volcanic,
  enemies: { emberWisp: EmberWisp, lavaGolem: LavaGolem, fireImp: FireImp, infernalDrake: InfernalDrake },
  bosses: { magmaTitan: MagmaTitan },
  rides: { level5: INFERNO_LEVEL_RIDE },
}
