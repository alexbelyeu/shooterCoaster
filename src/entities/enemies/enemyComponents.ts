import type { ComponentType } from 'react'
import type { EnemyType } from '@/types/level'
import type { EnemyProps } from './EnemyBase'
import Balloon from './Balloon'
import Crow from './Crow'
import Toucan from './Toucan'
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
import Rat from './Rat'
import DustBunny from './DustBunny'
import Lanternfly from './Lanternfly'
import HoverDrone from './HoverDrone'

/** Every wave enemy's component, for the turntable (`src/dev/turntable/`); the game mounts an enemy from its world chunk (`levels/environments/worlds.ts`). */
export const ENEMY_COMPONENTS: Record<EnemyType, ComponentType<EnemyProps>> = {
  balloon: Balloon,
  crow: Crow,
  toucan: Toucan,
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
  rat: Rat,
  dustBunny: DustBunny,
  lanternfly: Lanternfly,
  hoverDrone: HoverDrone,
}
