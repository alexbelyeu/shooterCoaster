import type { ComponentType } from 'react'
import type { BossType } from '@/types/level'
import type { BossProps } from './BossBase'
import GiantScorpion from './GiantScorpion'
import GoldenBlimp from './GoldenBlimp'
import Kraken from './Kraken'
import MagmaTitan from './MagmaTitan'
import Medusa from './Medusa'
import Yeti from './Yeti'

/** Every boss's component, for the turntable (`src/dev/turntable/`); the game mounts a boss from its world chunk (`levels/environments/worlds.ts`). */
export const BOSS_COMPONENTS: Record<BossType, ComponentType<BossProps>> = {
  goldenBlimp: GoldenBlimp,
  kraken: Kraken,
  giantScorpion: GiantScorpion,
  yeti: Yeti,
  magmaTitan: MagmaTitan,
  medusa: Medusa,
}
