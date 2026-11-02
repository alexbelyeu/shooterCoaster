import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/useGameStore'

const fmt = new Intl.NumberFormat('en-US')
/** Exponential approach rate (1/s): ~0.8 s to settle on a 500-point jump. */
const TWEEN_RATE = 8
const POP_KEYFRAMES: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.16)', offset: 0.35 },
  { transform: 'scale(1)' },
]
const POP_TIMING: KeyframeAnimationOptions = { duration: 280, easing: 'ease-out' }

interface ScoreDisplayProps {
  levelId: string
}

/**
 * Score numerals that tween toward the store value. Never re-renders for score
 * changes: it subscribes to the store outside React and runs one rAF loop only
 * while the displayed value is catching up.
 */
export default function ScoreDisplay({ levelId }: ScoreDisplayProps) {
  const valueRef = useRef<HTMLSpanElement>(null)
  const best = useGameStore((s) =>
    s.runMode.mode === 'daily' ? (s.savedDaily[s.runMode.dateKey]?.score ?? 0) : (s.savedScores[levelId]?.score ?? 0),
  )

  useEffect(() => {
    const el = valueRef.current
    if (!el) return
    let shown = useGameStore.getState().score
    let target = shown
    let raf = 0
    let last = 0
    let pop: Animation | null = null
    el.textContent = fmt.format(Math.round(shown))

    const tick = (now: number) => {
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60
      last = now
      shown += (target - shown) * (1 - Math.exp(-dt * TWEEN_RATE))
      if (Math.abs(target - shown) < 0.5) shown = target
      el.textContent = fmt.format(Math.round(shown))
      if (shown !== target) {
        raf = requestAnimationFrame(tick)
      } else {
        raf = 0
        last = 0
      }
    }

    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.score === prev.score) return
      if (s.score < shown) shown = s.score // reset (new run): no counting down
      target = s.score
      if (s.score > prev.score) {
        pop?.cancel()
        pop = el.animate(POP_KEYFRAMES, POP_TIMING)
      }
      if (!raf) raf = requestAnimationFrame(tick)
    })

    return () => {
      unsub()
      if (raf) cancelAnimationFrame(raf)
      pop?.cancel()
    }
  }, [])

  return (
    <div className="hud-score">
      <span ref={valueRef} className="hud-score-value">
        0
      </span>
      {best > 0 && <div className="hud-best">BEST {fmt.format(Math.round(best))}</div>}
    </div>
  )
}
