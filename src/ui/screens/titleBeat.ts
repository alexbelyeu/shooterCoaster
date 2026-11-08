import type { BeatGrid } from '@/canvas/titleCamera'

/** Decay of the logo's hit on each bar line, and the lighter one on the other beats (s). */
const BAR_DECAY_S = 0.22
const BEAT_DECAY_S = 0.12
const BEAT_LEVEL = 0.35

/** The logo's hit (0..1) at audio time `now`: full on a bar line, a lighter tap on its other beats, each decaying fast. */
export function logoBeat(now: number, grid: BeatGrid): number {
  if (grid.beatS <= 0) return 0
  const song = now - grid.origin
  if (song < 0) return 0
  const sinceBeat = song % grid.beatS
  const onBar = Math.floor(song / grid.beatS + 1e-6) % grid.beats === 0
  return onBar ? Math.exp(-sinceBeat / BAR_DECAY_S) : BEAT_LEVEL * Math.exp(-sinceBeat / BEAT_DECAY_S)
}
