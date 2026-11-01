/** Pure numbers behind the results screen (no React / DOM, unit-tested). */

export function accuracyPercent(hits: number, shotsFired: number): number | null {
  if (!(shotsFired > 0)) return null
  return Math.round(Math.min(1, Math.max(0, hits / shotsFired)) * 100)
}

export function formatAccuracy(hits: number, shotsFired: number): string {
  const pct = accuracyPercent(hits, shotsFired)
  return pct === null ? '—' : `${pct}%`
}

export function formatTimeLeft(seconds: number): string {
  return `${Math.max(0, Math.ceil(seconds - 1e-6))}s`
}

export function isNewRecord(score: number, previousBest: number): boolean {
  return score > 0 && score > previousBest
}

export function barFill(score: number, maxScore: number): number {
  if (!(maxScore > 0)) return 0
  return Math.min(1, Math.max(0, score / maxScore))
}
