import type { BiomeType } from '@/types/level'

/**
 * Small UI palette shared by the HUD, wave banner, results and level select.
 * Accents follow the per-biome art direction in docs/agents/VISION.md.
 */
export interface BiomeUITheme {
  /** Primary accent: wave banner rule, kill strip fill. */
  accent: string
  /** Glow colour (accent with alpha) for text-shadow / box-shadow. */
  glow: string
  /** Secondary accent: the landmark highlight on the level-select postcard. */
  accent2: string
  /** Sky gradient (CSS background) behind the level-select postcard. */
  bg: string
}

export const BIOME_UI: Record<BiomeType, BiomeUITheme> = {
  themePark: {
    accent: '#ff5cad', // candy pink
    glow: 'rgba(255, 92, 173, 0.55)',
    accent2: '#ffd23f',
    bg: 'linear-gradient(180deg, #2f8ff0 0%, #7fd0ff 62%, #ffe1f0 100%)',
  },
  desert: {
    accent: '#ffb347', // dune gold
    glow: 'rgba(255, 179, 71, 0.55)',
    accent2: '#d9532b',
    bg: 'linear-gradient(180deg, #f2793a 0%, #ffc070 58%, #ffe6ad 100%)',
  },
  ocean: {
    accent: '#2ee6d6', // lagoon teal
    glow: 'rgba(46, 230, 214, 0.55)',
    accent2: '#2a6fdb',
    bg: 'linear-gradient(180deg, #1b56b5 0%, #46b3e6 58%, #c4f4ff 100%)',
  },
  arctic: {
    accent: '#8fd3ff', // glacier blue
    glow: 'rgba(143, 211, 255, 0.55)',
    accent2: '#b48cff',
    bg: 'linear-gradient(180deg, #171f4a 0%, #45589f 55%, #b6d6ff 100%)',
  },
  volcanic: {
    accent: '#ff5a1f', // lava orange
    glow: 'rgba(255, 90, 31, 0.6)',
    accent2: '#ffc933',
    bg: 'linear-gradient(180deg, #110a0a 0%, #3a1410 55%, #9c2a10 100%)',
  },
}

export const DEFAULT_UI_THEME: BiomeUITheme = {
  accent: '#ffd23f',
  glow: 'rgba(255, 210, 63, 0.55)',
  accent2: '#ff8c00',
  bg: 'linear-gradient(180deg, #222 0%, #555 100%)',
}

export function biomeTheme(biome: BiomeType | undefined | null): BiomeUITheme {
  return (biome && BIOME_UI[biome]) || DEFAULT_UI_THEME
}

/** HUD status colours. */
export const HUD_COLORS = {
  text: '#ffffff',
  gold: '#ffd23f',
  orange: '#ff9a1f',
  red: '#ff3b3b',
  amber: '#ffb020',
} as const

const COMBO_COLORS = [HUD_COLORS.text, HUD_COLORS.gold, HUD_COLORS.orange, HUD_COLORS.red] as const

/** Combo colour by tier (`combat/comboTiers.ts`): 1× white, 2× gold, 3× orange, 5× red. */
export function comboColor(tier: number): string {
  return COMBO_COLORS[Math.min(Math.max(tier, 0), COMBO_COLORS.length - 1)]
}
