import type { ComponentType } from 'react'
import type { EnemyType } from '@/types/level'
import type { EnemyProps } from './EnemyBase'
import Balloon from './Balloon'
import Crow from './Crow'
import Scorpion from './Scorpion'
import Shark from './Shark'
import Jellyfish from './Jellyfish'
import FlyingFish from './FlyingFish'
import Snowman from './Snowman'
import SnowmanScout from './SnowmanScout'
import SnowmanBrute from './SnowmanBrute'
import EmberWisp from './EmberWisp'
import LavaGolem from './LavaGolem'
import FireImp from './FireImp'
import InfernalDrake from './InfernalDrake'
import Climber from './Climber'

/** Every wave enemy's component: what `EnemySpawner` mounts and the turntable (`src/dev/turntable/`) shows. */
export const ENEMY_COMPONENTS: Record<EnemyType, ComponentType<EnemyProps>> = {
  balloon: Balloon,
  crow: Crow,
  scorpion: Scorpion,
  shark: Shark,
  jellyfish: Jellyfish,
  flyingFish: FlyingFish,
  snowman: Snowman,
  snowmanScout: SnowmanScout,
  snowmanBrute: SnowmanBrute,
  emberWisp: EmberWisp,
  lavaGolem: LavaGolem,
  fireImp: FireImp,
  infernalDrake: InfernalDrake,
  climber: Climber,
}
