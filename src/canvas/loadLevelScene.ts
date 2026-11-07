/** The level scene's chunk (#376): fetched once, either when a run starts or ahead of it, once the title is idle. */
type LevelSceneModule = typeof import('./LevelScene')

/** Pauses between the attempts of one load (a flaky network): `React.lazy` calls its factory once and caches a rejection. */
export const RETRY_DELAYS_MS: readonly number[] = [400, 1200]

let pending: Promise<LevelSceneModule> | null = null

/** Runs `importer`, retrying after each of `delays` before giving up with the last error. */
export async function importWithRetry<T>(
  importer: () => Promise<T>,
  delays: readonly number[] = RETRY_DELAYS_MS,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await importer()
    } catch (err) {
      if (attempt >= delays.length) throw err
      await wait(delays[attempt])
    }
  }
}

export function loadLevelScene(): Promise<LevelSceneModule> {
  pending ??= importWithRetry(() => import('./LevelScene')).catch((err) => {
    pending = null // the next call starts a fresh fetch
    throw err
  })
  return pending
}

/** After the title has drawn: when the browser is idle, so it never competes with the title's first frames. */
export function prefetchLevelScene(): void {
  const load = () => void loadLevelScene().catch(() => {})
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 3000 })
  else window.setTimeout(load, 1000)
}
