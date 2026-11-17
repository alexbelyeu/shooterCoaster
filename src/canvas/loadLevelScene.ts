import { markStartup } from '@/core/startupMarks'

/** The level scene's chunk (#376): fetched once, at startup under the poster (`GameCanvas`' poster handoff, #597), or when a run starts if that fetch failed. */
type LevelSceneModule = typeof import('./LevelScene')

/** Pauses between the attempts of one load (a flaky network): `React.lazy` calls its factory once and caches a rejection. */
export const RETRY_DELAYS_MS: readonly number[] = [400, 1200]

let pending: Promise<LevelSceneModule> | null = null
let loaded = false

/** The chunk has arrived: a level scene can mount without suspending. */
export const isLevelSceneLoaded = (): boolean => loaded

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
  pending ??= importWithRetry(() => import('./LevelScene')).then((mod) => {
    loaded = true
    markStartup('levelChunk')
    return mod
  }, (err) => {
    pending = null // the next call starts a fresh fetch
    throw err
  })
  return pending
}
