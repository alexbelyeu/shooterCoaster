/** Every SFX play function and music loop callback catches into here: a bad Tone schedule drops one sound, never throws to the page. */
let dropped = 0
let lastDrop: string | null = null
const logged = new Set<string>()

export function dropSound(where: string, err: unknown): void {
  dropped++
  lastDrop = `${where}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`
  if (import.meta.env.DEV && !logged.has(where)) {
    logged.add(where)
    console.warn(`[audio] dropped ${where}`, err)
  }
}

/** e2e: drops since load and the last one's stack. */
export function droppedSounds(): { count: number; last: string | null } {
  return { count: dropped, last: lastDrop }
}
