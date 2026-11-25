import type { World } from '@/levels/environments/worlds'
import Toucan from '@/entities/enemies/Toucan'
import GoldenBlimp from '@/entities/bosses/GoldenBlimp'
import { jungle } from '.'
import { rides } from './rides'

/**
 * Jungle Ruins's chunk (#862): its biome, its toucans, its boss (the Golden Blimp holds the slot until the guardian, #869)
 * and level 8's ride (#1009).
 */
export const world: World = {
  biome: jungle,
  enemies: { toucan: Toucan },
  bosses: { goldenBlimp: GoldenBlimp },
  rides,
}
