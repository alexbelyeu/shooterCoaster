/**
 * The results screen's two cuts (#792): `results-win` after a 2 or 3 star run, `results-lose` after 0 or 1.
 * Pure and import-free, so `LevelAudio` picks the cut without pulling the score texts into its chunk.
 */
export const RESULTS_CUTS = ['results-win', 'results-lose'] as const

export type ResultsCut = (typeof RESULTS_CUTS)[number]

/** The cut for a run that earned `stars` (0-3). */
export function resultsCut(stars: number): ResultsCut {
  return stars >= 2 ? 'results-win' : 'results-lose'
}
