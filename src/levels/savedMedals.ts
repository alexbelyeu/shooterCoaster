/**
 * The saved medals (#879): per level, the ids of the medals it has won, as the store keeps and persists them. Apart from
 * `medals.ts` so the store's startup path doesn't carry the medal table: the screens show only the ids the table names,
 * in its order, so an id it no longer has just goes unshown.
 */

/** Ids saved so far plus this run's, each once. */
export function addMedals(saved: readonly string[] | undefined, won: readonly string[]): string[] {
  return [...new Set([...(saved ?? []), ...won])]
}

/** Stored medals as valid data or nothing: string ids in arrays, each once, levels with none dropped. */
export function sanitizeSavedMedals(raw: unknown): Record<string, string[]> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<string, string[]> = {}
  for (const [levelId, ids] of Object.entries(raw)) {
    if (!Array.isArray(ids)) continue
    const kept = addMedals([], ids.filter((id): id is string => typeof id === 'string'))
    if (kept.length > 0) out[levelId] = kept
  }
  return out
}
