/**
 * Phase a run starts in: the Ready / Set / GO countdown, except under the e2e hook
 * (`?e2e=1`, so smoke timings stay as they were) unless `&countdown=1` asks for it.
 */
export function startPhaseFor(search: string): 'countdown' | 'playing' {
  const q = new URLSearchParams(search)
  return q.has('e2e') && q.get('countdown') !== '1' ? 'playing' : 'countdown'
}
