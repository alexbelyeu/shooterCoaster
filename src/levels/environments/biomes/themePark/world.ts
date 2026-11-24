import type { World } from '@/levels/environments/worlds'
import { themePark } from '.'
import Balloon from '@/entities/enemies/Balloon'
import GoldenBlimp from '@/entities/bosses/GoldenBlimp'

/** The themePark world's chunk (#862): its biome, the enemies its levels spawn and its boss. */
export const world: World = {
  biome: themePark,
  enemies: { balloon: Balloon },
  bosses: { goldenBlimp: GoldenBlimp },
}
