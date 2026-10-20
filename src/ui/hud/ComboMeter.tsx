import { useEffect, useState, type CSSProperties } from 'react'
import { useGameStore, COMBO_TIMEOUT } from '@/store/useGameStore'
import { comboColor, comboTier } from '@/ui/theme'

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R

/**
 * Centre-bottom combo meter: a ring that drains over the combo window, the
 * chain count inside it, and the multiplier (sized by tier) beside it. Renders only on kills
 * and once when the window expires; the drain is a CSS animation restarted per
 * kill (keyed on lastKillTime).
 */
export default function ComboMeter() {
  const count = useGameStore((s) => s.combo.count)
  const multiplier = useGameStore((s) => s.combo.multiplier)
  const lastKillTime = useGameStore((s) => s.combo.lastKillTime)
  const [expiredFor, setExpiredFor] = useState(-1)

  useEffect(() => {
    if (count < 2) return
    const left = COMBO_TIMEOUT - (performance.now() - lastKillTime)
    const t = setTimeout(() => setExpiredFor(lastKillTime), Math.max(0, left))
    return () => clearTimeout(t)
  }, [count, lastKillTime])

  const visible = count >= 2 && expiredFor !== lastKillTime
  const color = comboColor(multiplier)
  const tier = comboTier(multiplier)
  // If we mount mid-window, start the drain part-way through.
  const elapsed = visible ? Math.max(0, performance.now() - lastKillTime) : 0

  const style = {
    '--combo-color': color,
    '--combo-window': `${COMBO_TIMEOUT}ms`,
    '--ring-c': RING_C,
  } as CSSProperties

  return (
    <div
      className={`hud-combo hud-combo--tier${tier}${visible ? ' is-visible' : ''}`}
      style={style}
      aria-hidden={!visible}
    >
      <div className="hud-combo-ring">
        <svg viewBox="0 0 64 64" width="64" height="64">
          <circle className="hud-combo-ring-bg" cx="32" cy="32" r={RING_R} />
          {visible && (
            <circle
              key={lastKillTime}
              className="hud-combo-ring-fill"
              cx="32"
              cy="32"
              r={RING_R}
              strokeDasharray={RING_C}
              style={{ animationDelay: `-${elapsed}ms` }}
            />
          )}
        </svg>
        <span key={count} className="hud-combo-count">
          {count}
        </span>
      </div>
      <div className="hud-combo-label">
        <span key={multiplier} className="hud-combo-mult">
          ×{multiplier.toFixed(2).replace(/\.?0+$/, '')}
        </span>
        <span className="hud-combo-word">COMBO</span>
      </div>
    </div>
  )
}
