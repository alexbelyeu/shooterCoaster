/** Pure numbers behind the results screen (no React / DOM, unit-tested). */

/** Whole-percent accuracy, or null with no shots fired (shown as "—"). Capped at 100. */
export function accuracyPercent(hits: number, shotsFired: number): number | null {
  if (!(shotsFired > 0)) return null
  return Math.round(Math.min(1, Math.max(0, hits / shotsFired)) * 100)
}

export function formatAccuracy(hits: number, shotsFired: number): string {
  const pct = accuracyPercent(hits, shotsFired)
  return pct === null ? '—' : `${pct}%`
}

/** Seconds left on the clock, whole seconds rounded up so a sliver still reads "1s". */
export function formatTimeLeft(seconds: number): string {
  return `${Math.max(0, Math.ceil(seconds - 1e-6))}s`
}

/** A record needs a real score that beats the best saved before this run (0 when none). */
export function isNewRecord(score: number, previousBest: number): boolean {
  return score > 0 && score > previousBest
}

export interface NextStar {
  /** 1-3: the star the player is short of. */
  stars: number
  /** Points still needed for it (rounded up). */
  points: number
}

/** The next star above `score` and how far away it is, or null with all three earned. */
export function nextStar(
  score: number,
  maxScore: number,
  thresholds: readonly [number, number, number],
): NextStar | null {
  if (!(maxScore > 0)) return null
  for (let i = 0; i < 3; i++) {
    const needed = thresholds[i] * maxScore
    if (score < needed) return { stars: i + 1, points: Math.ceil(needed - score) }
  }
  return null
}

/** Score as a 0-1 fill of the threshold bar (the bar spans 0..maxScore). */
export function barFill(score: number, maxScore: number): number {
  if (!(maxScore > 0)) return 0
  return Math.min(1, Math.max(0, score / maxScore))
}
