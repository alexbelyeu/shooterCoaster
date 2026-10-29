/** Seconds of level time the `wave:incoming` tell leads its wave. */
export const WAVE_TELL_SECONDS = 1

export interface WaveProgress {
  told: boolean[]
  arrived: boolean[]
}

export function newWaveProgress(waveCount: number): WaveProgress {
  return { told: new Array(waveCount).fill(false), arrived: new Array(waveCount).fill(false) }
}

/** Runs each due tell and arrival once per `progress`; an arrival waits a tick after its tell, so one slow frame can't land both. */
export function tickWaves(
  delays: readonly number[],
  elapsed: number,
  progress: WaveProgress,
  tell: (wave: number) => void,
  arrive: (wave: number) => void,
): void {
  for (let i = 0; i < delays.length; i++) {
    const delay = delays[i]
    if (delay <= 0 || progress.arrived[i]) continue
    if (progress.told[i]) {
      if (elapsed >= delay) {
        progress.arrived[i] = true
        arrive(i)
      }
    } else if (elapsed >= delay - WAVE_TELL_SECONDS) {
      progress.told[i] = true
      tell(i)
    }
  }
}
