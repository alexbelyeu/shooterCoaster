/** Pure numbers and lines behind the results board (no React / DOM, unit-tested). */

export function accuracyPercent(hits: number, shotsFired: number): number | null {
  if (!(shotsFired > 0)) return null
  return Math.round(Math.min(1, Math.max(0, hits / shotsFired)) * 100)
}

export function formatAccuracy(hits: number, shotsFired: number): string {
  const pct = accuracyPercent(hits, shotsFired)
  return pct === null ? '—' : `${pct}%`
}

/** `×14`, the HUD's multiplier sign, or a dash for a run without a combo: the results line and the score card both say it so. */
export function formatBestCombo(bestCombo: number): string {
  return bestCombo > 0 ? `×${bestCombo}` : '—'
}

export function isNewRecord(score: number, previousBest: number): boolean {
  return score > 0 && score > previousBest
}

export interface RunLineInput {
  kills: number
  totalEnemies: number
  hits: number
  shotsFired: number
  bestCombo: number
  timeRemaining: number
  /** The level's bystanders (#518): their plural noun, how many rode along and how many were hit; null without any. */
  bystanders: { noun: string; total: number; hit: number } | null
}

/** One stat line on the board: `stat` is its `data-stat` hook (the smoke reads it), `text` the showman's line. */
export interface RunLine {
  stat: 'hits' | 'accuracy' | 'combo' | 'spared' | 'time'
  text: string
}

/** The run as plain lines in the showman's voice (docs/art/PERSONALITY.md "Voice"): "12 of 86 hit", "Best combo ×3". */
export function runLines(run: RunLineInput): RunLine[] {
  const pct = accuracyPercent(run.hits, run.shotsFired)
  const seconds = Math.max(0, Math.ceil(run.timeRemaining - 1e-6))
  const lines: RunLine[] = [
    { stat: 'hits', text: `${run.kills} of ${run.totalEnemies} hit` },
    { stat: 'accuracy', text: pct === null ? 'Not a shot fired' : `${pct}% of shots on target` },
    { stat: 'combo', text: run.bestCombo > 0 ? `Best combo ${formatBestCombo(run.bestCombo)}` : 'No combo this time' },
  ]
  const b = run.bystanders
  if (b && b.total > 0) lines.push({ stat: 'spared', text: `${Math.max(0, b.total - b.hit)} of ${b.total} ${b.noun} spared` })
  lines.push({
    stat: 'time',
    text: seconds === 0 ? 'Down to the wire' : `${seconds} ${seconds === 1 ? 'second' : 'seconds'} to spare`,
  })
  return lines
}

const ORDINAL = ['first', 'second', 'third']

/** The line under the score: what the next star costs, or a bow when all three are lit. */
export function nextStarLine(next: { stars: number; points: number } | null, format: (n: number) => string): string {
  if (!next) return 'All three stars. Take a bow.'
  return `${format(next.points)} more for the ${ORDINAL[next.stars - 1]} star`
}

/**
 * A ticket counter's wheels at value `v` (fractional while it rolls), lowest digit last: each wheel's position in
 * 0..10 (10 is the 0 after 9). The lowest wheel turns with the value; a higher one turns only while every wheel below
 * it rolls from 9 to 0, like the real thing.
 */
export function counterWheels(v: number, digits: number, out: number[] = []): number[] {
  out.length = digits
  const value = Math.max(0, v)
  for (let k = 0; k < digits; k++) {
    const place = 10 ** k
    const rest = value % place
    const rolling = Math.max(0, rest - (place - 1))
    out[digits - 1 - k] = (Math.floor(value / place) % 10) + rolling
  }
  return out
}

/** Percent positions round a rectangle, clockwise from its top-left corner: `top` bulbs on top and bottom, `side` on each side between. */
export function bulbRing(top: number, side: number): { x: number; y: number }[] {
  const ring: { x: number; y: number }[] = []
  const along = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * 100 : 50)
  const down = (j: number) => ((j + 1) / (side + 1)) * 100
  for (let i = 0; i < top; i++) ring.push({ x: along(i, top), y: 0 })
  for (let j = 0; j < side; j++) ring.push({ x: 100, y: down(j) })
  for (let i = top - 1; i >= 0; i--) ring.push({ x: along(i, top), y: 100 })
  for (let j = side - 1; j >= 0; j--) ring.push({ x: 0, y: down(j) })
  return ring
}

/** Which star (0..2) a bulb holds lit for: the ring in three equal runs. */
export function bulbStar(index: number, count: number): number {
  return Math.min(2, Math.floor((index * 3) / count))
}
