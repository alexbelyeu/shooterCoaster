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
  /** Sky gradient behind the postcard, top to bottom: colour and stop (0–1). */
  sky: readonly SkyStop[]
  bg: string
}

export type SkyStop = readonly [colour: string, at: number]

function theme(t: Omit<BiomeUITheme, 'bg'>): BiomeUITheme {
  const stops = t.sky.map(([c, at]) => `${c} ${Math.round(at * 100)}%`).join(', ')
  return { ...t, bg: `linear-gradient(180deg, ${stops})` }
}

export const BIOME_UI: Record<BiomeType, BiomeUITheme> = {
  themePark: theme({
    accent: '#ff5cad', // candy pink
    glow: 'rgba(255, 92, 173, 0.55)',
    accent2: '#ffd23f',
    sky: [['#2f8ff0', 0], ['#7fd0ff', 0.62], ['#ffe1f0', 1]],
  }),
  desert: theme({
    accent: '#ffb347', // dune gold
    glow: 'rgba(255, 179, 71, 0.55)',
    accent2: '#d9532b',
    sky: [['#f2793a', 0], ['#ffc070', 0.58], ['#ffe6ad', 1]],
  }),
  ocean: theme({
    accent: '#2ee6d6', // lagoon teal
    glow: 'rgba(46, 230, 214, 0.55)',
    accent2: '#2a6fdb',
    sky: [['#1b56b5', 0], ['#46b3e6', 0.58], ['#c4f4ff', 1]],
  }),
  arctic: theme({
    accent: '#8fd3ff', // glacier blue
    glow: 'rgba(143, 211, 255, 0.55)',
    accent2: '#b48cff',
    sky: [['#171f4a', 0], ['#45589f', 0.55], ['#b6d6ff', 1]],
  }),
  volcanic: theme({
    accent: '#ff5a1f', // lava orange
    glow: 'rgba(255, 90, 31, 0.6)',
    accent2: '#ffc933',
    sky: [['#110a0a', 0], ['#3a1410', 0.55], ['#9c2a10', 1]],
  }),
  gym: theme({
    accent: '#22d3c5', // chalk-bag teal
    glow: 'rgba(34, 211, 197, 0.55)',
    accent2: '#ff3355',
    sky: [['#27313d', 0], ['#4b5a6b', 0.6], ['#a9b6c4', 1]],
  }),
}

export const DEFAULT_UI_THEME: BiomeUITheme = theme({
  accent: '#ffd23f',
  glow: 'rgba(255, 210, 63, 0.55)',
  accent2: '#ff8c00',
  sky: [['#222', 0], ['#555', 1]],
})

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
