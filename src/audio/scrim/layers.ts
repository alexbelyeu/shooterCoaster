/**
 * Intensity layers of a score (`layer=` on a voice; docs/audio/SCORE-FORMAT.md): intensity 0 plays the base layer,
 * 1 adds drums, 2 the lead, 3 (FRENZY) the frenzy layer and opens the score's low-pass. Pure: the player asks
 * `nextLayerStep` when to move, the synth ramps each voice's level gain there.
 */

export const LAYERS = ['base', 'drums', 'lead', 'frenzy'] as const
export type Layer = (typeof LAYERS)[number]
export const MAX_INTENSITY = LAYERS.length - 1

/** A layer change ramps over this long, ending on its beat line, so nothing clicks. */
export const LAYER_RAMP_S = 0.05
/** The low-pass of a layered score: closed below FRENZY, open at it; it opens over ~a beat (time constant). */
export const LIFT = { closedHz: 7000, openHz: 20000, q: 0.707, timeConstantS: 0.12 } as const

export function isLayer(name: string): name is Layer {
  return (LAYERS as readonly string[]).includes(name)
}

/** An untagged voice is `base`. */
export function layerSounds(layer: Layer | undefined, intensity: number): boolean {
  return LAYERS.indexOf(layer ?? 'base') <= intensity
}

export function liftHz(intensity: number): number {
  return intensity >= MAX_INTENSITY ? LIFT.openHz : LIFT.closedHz
}

/** The combo tier's index (`combat/comboTiers.ts`: 1× 2× 3× 5×) is the intensity. */
export function intensityForTier(tier: number): number {
  return Math.max(0, Math.min(MAX_INTENSITY, Math.floor(tier)))
}

export interface LayerGrid {
  /** Song time the loop starts: the intro plays every layer, the loop's beat lines count from here. */
  introS: number
  beatS: number
  barS: number
}

export interface LayerStep {
  intensity: number
  /** Song time of the beat line it lands on. */
  at: number
}

/** A change closer than this to its beat line waits for the next one: the ramp needs the time. */
const MIN_LEAD_S = LAYER_RAMP_S

function beatLineAtOrAfter(t: number, g: LayerGrid): number {
  return g.introS + Math.ceil((t - g.introS) / g.beatS - 1e-9) * g.beatS
}

/**
 * Where the layers go next, from `applied` (the last scheduled intensity, landing at song time `appliedAt`) toward
 * `target`, at song position `pos`; null when they are already there. During the intro, straight to the target at the
 * loop's start. After it a rise lands on the next beat line; a fall drops one layer there, and each further layer a bar
 * after the last change (asked for once that change has landed), so a lost FRENZY winds down instead of cutting to the
 * bare base.
 */
export function nextLayerStep(applied: number, appliedAt: number, target: number, pos: number, g: LayerGrid): LayerStep | null {
  if (target === applied) return null
  if (pos + MIN_LEAD_S <= g.introS) return { intensity: target, at: g.introS }
  const next = beatLineAtOrAfter(pos + MIN_LEAD_S, g)
  if (target > applied) return { intensity: target, at: next }
  if (appliedAt > pos) return null
  return { intensity: applied - 1, at: Math.max(next, beatLineAtOrAfter(appliedAt + g.barS, g)) }
}
