import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { gameTime } from '@/core/gameClock'
import { WEAPONS, pickupRemaining, type PickupWeaponId } from '@/combat/weapons/weaponTypes'

const RING_R = 22
const RING_C = 2 * Math.PI * RING_R

function WeaponIcon({ id }: { id: PickupWeaponId }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const }
  switch (id) {
    case 'spread':
      return (
        <g {...common}>
          <path d="M12 20 L12 5 M12 20 L5 7 M12 20 L19 7" />
        </g>
      )
    case 'rapid':
      return (
        <g {...common} strokeLinejoin="round">
          <path d="M6 18 L12 12 L6 6 M12 18 L18 12 L12 6" />
        </g>
      )
    case 'piercing':
      return (
        <g {...common} strokeLinejoin="round">
          <circle cx="9" cy="12" r="3.2" strokeWidth={1.8} />
          <circle cx="16" cy="12" r="3.2" strokeWidth={1.8} />
          <path d="M2 12 L22 12 M18.5 8.5 L22 12 L18.5 15.5" />
        </g>
      )
  }
}

/** The pickup gun (#185) beside the combo meter; its ring drains on the game clock, so a pause holds it. */
export default function WeaponBadge() {
  const weapon = useGameStore((s) => s.weapon)
  const [shown, setShown] = useState<PickupWeaponId | null>(null)
  const [live, setLive] = useState(false)
  const fillRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    if (weapon.id === null) {
      setLive(false)
      return
    }
    setShown(weapon.id)
    setLive(true)
    let raf = 0
    const draw = () => {
      const left = pickupRemaining(weapon, gameTime())
      fillRef.current?.style.setProperty('stroke-dashoffset', String(RING_C * (1 - left)))
      if (left <= 0) {
        setLive(false)
        return
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [weapon])

  const style = { '--weapon-color': shown ? WEAPONS[shown].uiColor : undefined } as CSSProperties

  return (
    <div className={`hud-weapon${live ? ' is-visible' : ''}`} style={style} aria-hidden={!live}>
      <div className="hud-weapon-ring">
        <svg viewBox="0 0 52 52" width="52" height="52">
          <circle className="hud-weapon-ring-bg" cx="26" cy="26" r={RING_R} />
          <circle ref={fillRef} className="hud-weapon-ring-fill" cx="26" cy="26" r={RING_R} strokeDasharray={RING_C} />
        </svg>
        {shown && (
          <svg className="hud-weapon-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <WeaponIcon id={shown} />
          </svg>
        )}
      </div>
      {shown && <span className="hud-weapon-label">{WEAPONS[shown].label}</span>}
    </div>
  )
}
