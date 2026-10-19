import { useRef, useEffect, useState, useCallback } from 'react'
import { eventBus } from '@/core/EventBus'
import { isFeedbackHeld } from './hitFeedback'

type HitKind = 'is-hit' | 'is-kill'

/** Restart the hitmarker CSS animation in the given colour (no React render). */
function flashHitmarker(el: SVGGElement | null, kind: HitKind) {
  if (!el) return
  el.classList.remove('is-hit', 'is-kill', 'is-hold')
  // Force a style flush so re-adding the class restarts the animation.
  void el.getBoundingClientRect()
  el.classList.add(kind)
  if (isFeedbackHeld()) el.classList.add('is-hold')
}

/**
 * SVG shooter reticle that follows the mouse with fire-feedback animation.
 * Outer ring + 4 tick marks + glowing center dot.
 * On mousedown the ticks contract inward and the dot flashes.
 * Hitmarker: a 4-tick "X" that flashes white on 'enemy:hit' and gold on
 * 'enemy:killed' (CSS classes toggled directly on the DOM node).
 */
export default function Crosshair() {
  const ref = useRef<SVGSVGElement>(null)
  const hitRef = useRef<SVGGElement>(null)
  const [firing, setFiring] = useState(false)

  useEffect(() => {
    const onHit = () => flashHitmarker(hitRef.current, 'is-hit')
    const onKill = () => flashHitmarker(hitRef.current, 'is-kill')
    eventBus.on('enemy:hit', onHit)
    eventBus.on('enemy:killed', onKill)
    return () => {
      eventBus.off('enemy:hit', onHit)
      eventBus.off('enemy:killed', onKill)
    }
  }, [])

  const onDown = useCallback(() => setFiring(true), [])
  const onUp = useCallback(() => setFiring(false), [])

  // Follow the mouse cursor (use transform to avoid layout reflow)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 24}px)`
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onDown, onUp])

  const tickOut = firing ? 9 : 13
  const tickIn = firing ? 5 : 7
  const dotR = firing ? 2.8 : 2
  const ringR = firing ? 15 : 18
  const opacity = firing ? 1 : 0.85

  return (
    <svg
      ref={ref}
      className="crosshair-svg"
      width="48"
      height="48"
      viewBox="0 0 48 48"
      style={{ opacity }}
    >
      {/* Outer ring */}
      <circle
        cx="24" cy="24" r={ringR}
        fill="none"
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth="1.2"
        style={{ transition: 'r 0.06s ease-out' }}
      />

      {/* 4 tick marks */}
      <line x1="24" y1={24 - tickOut} x2="24" y2={24 - tickIn}
        stroke="white" strokeWidth="2" strokeLinecap="round"
        style={{ transition: 'y1 0.06s ease-out, y2 0.06s ease-out' }} />
      <line x1="24" y1={24 + tickIn} x2="24" y2={24 + tickOut}
        stroke="white" strokeWidth="2" strokeLinecap="round"
        style={{ transition: 'y1 0.06s ease-out, y2 0.06s ease-out' }} />
      <line x1={24 - tickOut} y1="24" x2={24 - tickIn} y2="24"
        stroke="white" strokeWidth="2" strokeLinecap="round"
        style={{ transition: 'x1 0.06s ease-out, x2 0.06s ease-out' }} />
      <line x1={24 + tickIn} y1="24" x2={24 + tickOut} y2="24"
        stroke="white" strokeWidth="2" strokeLinecap="round"
        style={{ transition: 'x1 0.06s ease-out, x2 0.06s ease-out' }} />

      {/* Glow halo */}
      <circle
        cx="24" cy="24"
        r={firing ? 5 : 3.5}
        fill="none"
        stroke={firing ? 'rgba(255, 80, 80, 0.7)' : 'rgba(255, 100, 100, 0.3)'}
        strokeWidth={firing ? 2 : 1}
        style={{ transition: 'all 0.06s ease-out' }}
      />

      {/* Hitmarker "X" — hidden until a hit/kill class is applied */}
      <g ref={hitRef} className="hitmarker" strokeWidth="2.6" strokeLinecap="round">
        <line x1="16" y1="16" x2="20" y2="20" />
        <line x1="32" y1="16" x2="28" y2="20" />
        <line x1="16" y1="32" x2="20" y2="28" />
        <line x1="32" y1="32" x2="28" y2="28" />
      </g>

      {/* Centre dot */}
      <circle
        cx="24" cy="24" r={dotR}
        fill={firing ? '#ff4444' : '#ff6666'}
        style={{ transition: 'r 0.06s ease-out, fill 0.06s ease-out' }}
      />
    </svg>
  )
}
