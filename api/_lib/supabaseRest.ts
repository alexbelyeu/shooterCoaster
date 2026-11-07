/** One Supabase table over its REST API (PostgREST) with plain fetch rather than supabase-js: one less client to keep out of the browser. */

export class DbError extends Error {}

export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>

const TIMEOUT_MS = 4000

/** `call(query, init)` against `<SUPABASE_URL>/rest/v1/<table>`; null without both env vars. Throws `DbError` on a failed call. */
export function restTable(env: Record<string, string | undefined>, table: string, fetchImpl: FetchImpl = (url, init) => fetch(url, init)) {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '')
  const key = env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) return null
  const base = `${url}/rest/v1/${table}`
  // A secret key goes in `apikey` alone: the gateway turns it into the service_role JWT.
  const headers = { apikey: key }
  return async function call(query: string, init: RequestInit): Promise<Response> {
    let res: Response
    try {
      res = await fetchImpl(`${base}${query}`, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch {
      throw new DbError('unreachable')
    }
    if (!res.ok) throw new DbError(`status ${res.status}`)
    return res
  }
}

/** PostgREST filters, `{ column: 'op.value' }`, as a query string. */
export const filterQuery = (filters: Record<string, string>) =>
  Object.entries(filters)
    .map(([col, f]) => `${col}=${encodeURIComponent(f)}`)
    .join('&')

/** The row count of a `HEAD ?select=id&…` call with `Prefer: count=exact`. */
export function countOf(res: Response): number {
  const total = Number(res.headers.get('content-range')?.split('/')[1])
  if (!Number.isInteger(total)) throw new DbError('no count')
  return total
}
