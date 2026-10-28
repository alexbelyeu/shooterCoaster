import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { gameTime } from '@/core/gameClock'
import { COMBO_TIERS, comboTierIndex, comboWindowS } from '@/combat/comboTiers'
import type { ComboBrokenEvent } from '@/combat/comboRuntime'
import { comboColor } from '@/ui/theme'

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R
const LOST_MS = 900

/** Centre-bottom combo meter; its ring drains on the game clock, so pause and slow-mo hold it like the window itself. */
export default function ComboMeter() {
  const count = useGameStore((s) => s.combo.count)
  const lastKillTime = useGameStore((s) => s.combo.lastKillTime)
  const [lost, setLost] = useState<ComboBrokenEvent | null>(null)
  const fillRef = useRef<SVGCircleElement>(null)
  const live = count >= 2

  useEffect(() => {
    const onBroken = (e: unknown) => setLost({ ...(e as ComboBrokenEvent) })
    eventBus.on('combo:broken', onBroken)
    return () => eventBus.off('combo:broken', onBroken)
  }, [])

  useEffect(() => {
    if (live) setLost(null)
  }, [live])

  useEffect(() => {
    if (!lost) return
    const t = setTimeout(() => setLost(null), LOST_MS)
    return () => clearTimeout(t)
  }, [lost])

  useEffect(() => {
    if (!live) return
    const windowS = comboWindowS(count)
    let raf = 0
    const draw = () => {
      const left = Math.min(1, Math.max(0, (gameTime() - lastKillTime) / windowS))
      fillRef.current?.style.setProperty('stroke-dashoffset', String(RING_C * left))
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [live, count, lastKillTime])

  const showLost = !live && lost !== null
  // While it fades out, keep showing what it last showed (the store's chain is already 0).
  const lastShown = useRef({ count: 0, lost: false })
  if (live) lastShown.current = { count, lost: false }
  else if (showLost) lastShown.current = { count: lost.count, lost: true }
  const shown = lastShown.current.count
  const tier = comboTierIndex(shown)
  const style = { '--combo-color': comboColor(tier), '--ring-c': RING_C } as CSSProperties

  return (
    <div
      className={`hud-combo hud-combo--tier${tier}${live || showLost ? ' is-visible' : ''}${showLost ? ' is-lost' : ''}`}
      style={style}
      aria-hidden={!live && !showLost}
    >
      <div className="hud-combo-ring">
        <svg viewBox="0 0 64 64" width="64" height="64">
          <circle className="hud-combo-ring-bg" cx="32" cy="32" r={RING_R} />
          {live && (
            <circle
              ref={fillRef}
              className="hud-combo-ring-fill"
              cx="32"
              cy="32"
              r={RING_R}
              strokeDasharray={RING_C}
            />
          )}
        </svg>
        <span key={shown} className="hud-combo-count">
          {shown}
        </span>
      </div>
      <div className="hud-combo-label">
        <span key={tier} className="hud-combo-mult">
          ×{COMBO_TIERS[tier].multiplier}
        </span>
        <span className="hud-combo-word">{lastShown.current.lost ? 'COMBO LOST' : 'COMBO'}</span>
      </div>
    </div>
  )
}
