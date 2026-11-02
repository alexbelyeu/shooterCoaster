/**
 * Vercel Web Analytics counts real players only: not test runs (`?e2e=1`) and not
 * Alex's browsers (`?internal=1`, cleared by `?internal=0`).
 */

const INTERNAL_PARAM = 'internal'
export const INTERNAL_STORAGE_KEY = 'shootercoaster-internal'

export type FlagStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Null where `localStorage` is missing or its getter throws (privacy modes, sandboxed frames). */
export function browserStorage(): FlagStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function isInternalBrowser(storage: FlagStorage | null): boolean {
  try {
    return storage?.getItem(INTERNAL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let internalThisLoad = false

/** What `applyInternalParam` decided for this page load; the title's "not tracked" marker shows it. */
export const isInternalThisLoad = () => internalThisLoad

/**
 * `?internal=1` stores the flag, `?internal=0` clears it, any other value leaves it alone;
 * the parameter wins for this page load even when storage can't be written.
 */
export function applyInternalParam(search: string, storage: FlagStorage | null): boolean {
  const value = new URLSearchParams(search).get(INTERNAL_PARAM)
  if (value !== '1' && value !== '0') {
    internalThisLoad = isInternalBrowser(storage)
    return internalThisLoad
  }
  internalThisLoad = value === '1'
  try {
    if (internalThisLoad) storage?.setItem(INTERNAL_STORAGE_KEY, '1')
    else storage?.removeItem(INTERNAL_STORAGE_KEY)
  } catch {
    // The flag then lasts only for this page load.
  }
  return internalThisLoad
}

/** Null when there is no `internal` parameter to strip from the address bar. */
export function searchWithoutInternalParam(search: string): string | null {
  const params = new URLSearchParams(search)
  if (!params.has(INTERNAL_PARAM)) return null
  params.delete(INTERNAL_PARAM)
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

/** `beforeSend` re-reads the flag per event, so `?internal=1` in another tab silences this one. */
export function dropInternalEvents(storage: FlagStorage | null) {
  return <T>(event: T): T | null => (isInternalBrowser(storage) ? null : event)
}

export function analyticsEnabled(builtOnVercel: boolean, search: string, internal: boolean): boolean {
  return builtOnVercel && !internal && !new URLSearchParams(search).has('e2e')
}
