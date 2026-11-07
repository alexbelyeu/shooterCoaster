/** The level scene's chunk (#376): fetched once, either when a run starts or ahead of it, once the title is idle. */
let pending: Promise<typeof import('./LevelScene')> | null = null

export function loadLevelScene(): Promise<typeof import('./LevelScene')> {
  pending ??= import('./LevelScene').catch((err) => {
    pending = null // a failed fetch (flaky network) is retried by the next call
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
