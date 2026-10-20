import { useRef, useEffect, useState } from 'react'
import { eventBus } from '@/core/EventBus'
import { getPointerState, subscribePointer, type PointerKind } from '@/input/pointerInput'
import { isFeedbackHeld } from './hitFeedback'

/** On touch the reticle sits this far above the finger so it isn't hidden by it. */
const TOUCH_OFFSET_PX = 40
const TOUCH_SCALE = 1.25
/** Finger position in the SVG's local (unscaled) coordinates. */
const TOUCH_FINGER_Y = 24 + TOUCH_OFFSET_PX / TOUCH_SCALE

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

function placeReticle(el: SVGSVGElement, x: number, y: number, kind: PointerKind) {
  el.style.transform =
    kind === 'touch'
      ? `translate(${x - 24}px, ${y - 24 - TOUCH_OFFSET_PX}px) scale(${TOUCH_SCALE})`
      : `translate(${x - 24}px, ${y - 24}px)`
}

/**
 * SVG shooter reticle that follows the active pointer with fire-feedback animation.
 * Outer ring + 4 tick marks + glowing center dot.
 * While the trigger is held the ticks contract inward and the dot flashes.
 * On touch the reticle is larger and floats above the finger, with a short
 * tether down to the true aim point (the finger), so it stays visible.
 * Hitmarker: a 4-tick "X" that flashes white on 'enemy:hit' and gold on
 * 'enemy:killed' (CSS classes toggled directly on the DOM node).
 */
export default function Crosshair() {
  const ref = useRef<SVGSVGElement>(null)
  const hitRef = useRef<SVGGElement>(null)
  const [firing, setFiring] = useState(() => getPointerState().down)
  const [kind, setKind] = useState<PointerKind>(() => getPointerState().kind)

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

  // Follow the active pointer (transform only, no layout reflow).
  useEffect(() => {
    return subscribePointer((p, type) => {
      if (ref.current) placeReticle(ref.current, p.x, p.y, p.kind)
      setKind(p.kind)
      if (type === 'down') setFiring(true)
      else if (type === 'up') setFiring(false)
    })
  }, [])

  // Place on mount (keeps the aim across screens) and when the pointer kind
  // changes (touch adds the offset + scale).
  useEffect(() => {
    if (!ref.current) return
    const p = getPointerState()
    placeReticle(ref.current, p.x, p.y, kind)
  }, [kind])

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
      style={{ opacity, overflow: 'visible' }}
    >
      {/* Touch: tether from the reticle down to the finger (the real aim point) */}
      {kind === 'touch' && (
        <g opacity={firing ? 0.9 : 0.55}>
          <line
            x1="24" y1={24 + ringR + 2} x2="24" y2={TOUCH_FINGER_Y - 7}
            stroke="white" strokeWidth="1.2" strokeDasharray="2 2" strokeLinecap="round"
          />
          <circle cx="24" cy={TOUCH_FINGER_Y} r="6" fill="none" stroke="rgba(255, 100, 100, 0.8)" strokeWidth="1.2" />
        </g>
      )}

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
