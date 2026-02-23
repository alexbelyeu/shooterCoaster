import { useRef, useEffect, useState, useCallback } from 'react'

/**
 * SVG shooter reticle that follows the mouse with fire-feedback animation.
 * Outer ring + 4 tick marks + glowing center dot.
 * On mousedown the ticks contract inward and the dot flashes.
 */
export default function Crosshair() {
  const ref = useRef<SVGSVGElement>(null)
  const [firing, setFiring] = useState(false)

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

      {/* Centre dot */}
      <circle
        cx="24" cy="24" r={dotR}
        fill={firing ? '#ff4444' : '#ff6666'}
        style={{ transition: 'r 0.06s ease-out, fill 0.06s ease-out' }}
      />
    </svg>
  )
}
