import { useGameStore } from '@/store/useGameStore'
import { RUN_SECONDS } from '@/levels/pacing'

const WARN_SECONDS = 15
const CRITICAL_SECONDS = 5

/**
 * "50 seconds to go" over a bar that runs down. Renders ~1×/s (GameTimer writes whole seconds); the bar aims at the next
 * second and eases there over 1 s, so it moves continuously without per-frame React work.
 */
export default function TimerBar() {
  const remaining = useGameStore((s) => s.timeRemaining)
  const secs = Math.ceil(remaining)
  const frac = Math.max(0, Math.min(1, (remaining - 1) / RUN_SECONDS))
  const state = secs <= CRITICAL_SECONDS ? 'critical' : secs <= WARN_SECONDS ? 'warn' : 'ok'

  return (
    <div className={`hud-timer hud-timer--${state}`} role="timer" aria-label={`${secs} seconds to go`}>
      <div key={state === 'critical' ? secs : undefined} className="hud-timer-value hud-number">
        {secs}
      </div>
      <div className="hud-timer-label">{secs === 1 ? 'second' : 'seconds'} to go</div>
      <div className="hud-timer-track">
        <div className="hud-timer-fill" style={{ transform: `scaleX(${frac})` }} />
      </div>
    </div>
  )
}
