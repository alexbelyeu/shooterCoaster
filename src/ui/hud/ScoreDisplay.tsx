import { useEffect, useRef } from 'react'
import { runBest, useGameStore } from '@/store/useGameStore'
import { prefersReducedMotion } from '@/ui/reducedMotion'

const fmt = new Intl.NumberFormat('en-US')
/** Exponential approach rate (1/s): ~0.8 s to settle on a 500-point jump. */
const TWEEN_RATE = 8
/** A point scored knocks the numbers down a notch, like a ticket counter's wheel clicking over. */
const TICK_KEYFRAMES: Keyframe[] = [{ transform: 'translateY(-0.12em)' }, { transform: 'none' }]
const TICK_TIMING: KeyframeAnimationOptions = { duration: 120, easing: 'ease-out' }

/**
 * Score numerals that tween toward the store value. Never re-renders for score
 * changes: it subscribes to the store outside React and runs one rAF loop only
 * while the displayed value is catching up.
 */
export default function ScoreDisplay() {
  const valueRef = useRef<HTMLSpanElement>(null)
  const best = useGameStore((s) => runBest(s)?.score ?? 0)

  useEffect(() => {
    const el = valueRef.current
    if (!el) return
    let shown = useGameStore.getState().score
    let target = shown
    let raf = 0
    let last = 0
    let tick: Animation | null = null
    el.textContent = fmt.format(Math.round(shown))

    const step = (now: number) => {
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60
      last = now
      shown += (target - shown) * (1 - Math.exp(-dt * TWEEN_RATE))
      if (Math.abs(target - shown) < 0.5) shown = target
      el.textContent = fmt.format(Math.round(shown))
      if (shown !== target) {
        raf = requestAnimationFrame(step)
      } else {
        raf = 0
        last = 0
      }
    }

    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.score === prev.score) return
      if (s.score < shown) shown = s.score // reset (new run): no counting down
      target = s.score
      if (s.score > prev.score && !prefersReducedMotion()) {
        tick?.cancel()
        tick = el.animate(TICK_KEYFRAMES, TICK_TIMING)
      }
      if (!raf) raf = requestAnimationFrame(step)
    })

    return () => {
      unsub()
      if (raf) cancelAnimationFrame(raf)
      tick?.cancel()
    }
  }, [])

  return (
    <div className="hud-score">
      <span ref={valueRef} className="hud-score-value hud-number">
        0
      </span>
      {best > 0 && <div className="hud-best">Best {fmt.format(Math.round(best))}</div>}
    </div>
  )
}
