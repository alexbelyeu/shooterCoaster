import { useGameStore } from '@/store/useGameStore'
import { RUN_SECONDS } from '@/levels/pacing'

const WARN_SECONDS = 15
const CRITICAL_SECONDS = 5

/**
 * Shrinking timer bar + numerals. GameTimer only writes `timeRemaining` when the
 * whole second changes, so this renders ~1×/s; the bar is aimed at where the
 * timer will be at the next update and eased there with a 1 s linear transition,
 * which reads as continuous motion without per-frame React work.
 */
export default function TimerBar() {
  const remaining = useGameStore((s) => s.timeRemaining)
  const secs = Math.ceil(remaining)
  const frac = Math.max(0, Math.min(1, (remaining - 1) / RUN_SECONDS))
  const state = secs <= CRITICAL_SECONDS ? 'critical' : secs <= WARN_SECONDS ? 'warn' : 'ok'

  return (
    <div className={`hud-timer hud-timer--${state}`} role="timer" aria-label={`${secs} seconds left`}>
      <div className="hud-timer-value">
        {secs}
        <span className="hud-timer-unit">s</span>
      </div>
      <div className="hud-timer-track">
        <div className="hud-timer-fill" style={{ transform: `scaleX(${frac})` }} />
      </div>
    </div>
  )
}
