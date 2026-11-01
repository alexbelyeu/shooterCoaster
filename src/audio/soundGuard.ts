/** Every SFX play function catches into here, and every music loop callback is `guarded`: a bad Tone schedule drops one sound, never throws to the page. */
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

/** Wraps a Tone `Sequence` / `Loop` callback once, when the loop is built: a throw drops that one note. */
export function guarded<A extends unknown[]>(where: string, cb: (...args: A) => void): (...args: A) => void {
  return (...args) => {
    try {
      cb(...args)
    } catch (e) {
      dropSound(where, e)
    }
  }
}

/** e2e: drops since load and the last one's stack. */
export function droppedSounds(): { count: number; last: string | null } {
  return { count: dropped, last: lastDrop }
}
