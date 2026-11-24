import type { World } from '@/levels/environments/worlds'
import Toucan from '@/entities/enemies/Toucan'
import GoldenBlimp from '@/entities/bosses/GoldenBlimp'
import { jungle } from '.'

/** Jungle Ruins's chunk (#862): its biome, its toucans and its boss (the Golden Blimp holds the slot until the guardian, #869). */
export const world: World = {
  biome: jungle,
  enemies: { toucan: Toucan },
  bosses: { goldenBlimp: GoldenBlimp },
}
