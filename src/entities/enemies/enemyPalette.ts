/**
 * The enemies' read colours: the paints that cover most of each one's silhouette (sRGB hex), in a module of their own so
 * `enemyColourVision.test.ts` (#838) holds them to the colour-blind contrast bar without the asset modules exporting
 * them (ShaderWarmup walks those modules' exports). The asset modules paint with these.
 */

// SharedEnemyAssets.ts
export const BALLOON_COLORS = [
  '#f65d53', '#ff6633', '#f6c61c', '#33cc33', '#3399ff',
  '#9933ff', '#ff33cc', '#fa79a1', '#1bc5c5', '#52ed06',
]
export const CROW_BODY = '#15131a'
export const CROW_SHEEN = '#3a2a55'
export const TOUCAN_BODY = '#141216'
export const TOUCAN_BIB = '#f7d43a'
export const TOUCAN_BILL = '#ff8a1c'
export const TOUCAN_TIP = '#d42e2a'
export const SCORPION_BODY_COLOR = '#2a1626'
export const SCORPION_PINCER_COLOR = '#3a1622'
export const SCORPION_LEG_COLOR = '#e0701e'
export const JELLY_COLORS = ['#ff88cc', '#88ccff', '#cc88ff', '#78f0be']
export const FFISH_BODY = '#7aa8cc'
export const FFISH_BELLY = '#dce8f0'
export const CLIMBER_SHIRT = '#1fa898'
export const CLIMBER_TROUSERS = '#d8e2e2'
export const RAT_FUR = '#6b6058'
export const RAT_BELLY = '#a39589'
export const DUST_GREY = '#bab6ae'
export const DUST_LIGHT = '#cbc7be'
export const DUST_DARK = '#88847d'
export const DUST_CHALK = '#f6f5f0'
export const LANTERNFLY_FOREWING = '#c9b8a0'
export const LANTERNFLY_RED = '#d8282a'
export const LANTERNFLY_BODY = '#1d1a1a'

// oceanEnemyAssets.ts
export const SHARK_TOP = '#3a5f7a'
export const SHARK_BELLY = '#f2f4f2'

// infernoEnemyAssets.ts
export const IMP_ORANGE = '#ff7a1a'
export const IMP_DARK = '#7a2208'
export const OBSIDIAN = ['#141014', '#1c151a', '#251b1f'] as const
export const LAVA = '#ff5a1a'
export const LAVA_HOT = '#ffc040'
export const DRAKE_CHARCOAL = '#2a1e1e'
export const DRAKE_MEMBRANE = '#8a1a1a'
export const DRAKE_GLOW = '#ff5a14'
/** The Ember Wisp is all glow: its core's emissive ramp (cool flank, body, white-hot heart), its rim and its ribbons' root and tip. */
export const WISP_EMBER = '#d04545'
export const WISP_FLAME = '#ffc26f'
export const WISP_WHITE = '#fff7e1'
export const WISP_RIM = '#ff3a10'
export const WISP_RIBBON_ROOT = '#ff8a2a'
export const WISP_RIBBON_TIP = '#a01010'

// cityEnemyAssets.ts
export const DRONE_BODY = '#2a2e3a'
export const DRONE_DOME = '#3c4354'
export const DRONE_GLOW = '#2ee8ff'
export const DRONE_TAIL = '#ff2fb0'
export const BOT_FACE = '#ff2fb0'
export const BOT_GLYPH = '#14161e'
