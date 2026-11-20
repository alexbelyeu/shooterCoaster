/**
 * What the intro (#674, `ui/hud/Intro.tsx`), the countdown (`ui/hud/Countdown.tsx`) and the camera's tour (#328, #675,
 * `track/introCamera.hot.ts`) tell each other: when the intro's clock started, and whether the camera is off the seat
 * (the gun stays hidden then).
 */

/** The tour's length (#674), the same on every device: it runs on the wall clock, not on frames. */
export const INTRO_SECONDS = 10

/** Ready / Set / GO: a step every `COUNTDOWN_STEP_MS`, GO on the third. */
export const COUNTDOWN_STEP_MS = 850
export const COUNTDOWN_STEPS = ['Ready', 'Set', 'GO!'] as const

/**
 * Ready comes up this long before the tour lands, so GO lands with it: the countdown plays over the tour's last
 * stretch into the seat, not after it.
 */
export const COUNTDOWN_LEAD_SECONDS = ((COUNTDOWN_STEPS.length - 1) * COUNTDOWN_STEP_MS) / 1000

/** Seconds of tour before Ready. */
export const INTRO_HANDOFF_SECONDS = INTRO_SECONDS - COUNTDOWN_LEAD_SECONDS

/**
 * The keys that skip the intro: Space, Enter or Escape, never held or with a modifier, so the mute key (S) or a
 * browser shortcut doesn't cut the tour short.
 */
export function isIntroSkipKey(e: Pick<KeyboardEvent, 'key' | 'repeat' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): boolean {
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false
  return e.key === ' ' || e.key === 'Enter' || e.key === 'Escape'
}

let startedAt: number | null = null
let offSeat = false
const listeners = new Set<() => void>()

/**
 * `performance.now()` time the intro's clock started; null when no tour is playing. It runs on through the
 * countdown the intro hands over to, until GO.
 */
export function setIntroStartedAt(at: number | null): void {
  if (at === startedAt) return
  startedAt = at
  for (const listener of listeners) listener()
}

export function introStartedAt(): number | null {
  return startedAt
}

/** For `useSyncExternalStore`: called when the intro's clock starts or stops. */
export function subscribeIntroClock(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setCameraOffSeat(off: boolean): void {
  offSeat = off
}

/** The camera is touring the level or orbiting the landmark, not riding. */
export function cameraOffSeat(): boolean {
  return offSeat
}
