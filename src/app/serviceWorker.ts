/** A lazy chunk, kept out of the startup JS; `updateViaCache: 'none'` so a deploy's worker is found on the next load. */
export function registerServiceWorker(): void {
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
}
