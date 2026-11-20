import type { EnemyWave } from '@/types/level'
import type { Route } from '@/track/mechanics'

/** Seconds of level time the `wave:incoming` tell leads its wave. */
export const WAVE_TELL_SECONDS = 1

export interface WaveProgress {
  told: boolean[]
  arrived: boolean[]
}

export function newWaveProgress(waveCount: number): WaveProgress {
  return { told: new Array(waveCount).fill(false), arrived: new Array(waveCount).fill(false) }
}

/**
 * Runs each due tell and arrival once per `progress`; an arrival waits a tick after its tell, so one slow frame can't land
 * both. An `arrive` that returns false isn't done: it runs again next tick (a route wave waiting on its route, #720).
 */
export function tickWaves(
  delays: readonly number[],
  elapsed: number,
  progress: WaveProgress,
  tell: (wave: number) => void,
  arrive: (wave: number) => boolean | void,
): void {
  for (let i = 0; i < delays.length; i++) {
    const delay = delays[i]
    if (delay <= 0 || progress.arrived[i]) continue
    if (progress.told[i]) {
      if (elapsed >= delay) progress.arrived[i] = arrive(i) !== false
    } else if (elapsed >= delay - WAVE_TELL_SECONDS) {
      progress.told[i] = true
      tell(i)
    }
  }
}

/** Whether a run on `route` meets the wave: a route wave (#720) only on its own route. */
export function onRoute(wave: Pick<EnemyWave, 'route'>, route: Route): boolean {
  return !wave.route || wave.route === route
}

/** Level time (s) the next wave still to arrive is due at, or null once every delayed wave is in. */
export function nextWaveDue(delays: readonly number[], progress: WaveProgress): number | null {
  let due: number | null = null
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0 && !progress.arrived[i] && (due === null || delays[i] < due)) due = delays[i]
  }
  return due
}

/**
 * Each wave's window of level time: from its arrival until the next wave arrives, the boss tell
 * starts (`bossAt`) or the run ends.
 */
export function waveWindows(delays: readonly number[], bossAt: number | undefined, timerSeconds: number): [number, number][] {
  return delays.map((delay) => {
    const from = Math.max(0, delay)
    let to = timerSeconds
    for (const later of [...delays, bossAt ?? Infinity]) if (later > from && later < to) to = later
    return [from, Math.max(from, to)]
  })
}

/**
 * The HUD's kill strip from the spawner's tally: an enemy that escaped (a climber topping out) leaves the total, so it
 * never reads as a kill (#480). Bystanders are never in `spawned`.
 */
export function enemyCounts(spawned: number, killed: number, escaped: number): { remaining: number; total: number } {
  const total = Math.max(0, spawned - escaped)
  return { remaining: Math.max(0, total - killed), total }
}
