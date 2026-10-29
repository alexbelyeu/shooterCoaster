import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/useGameStore'

/**
 * Boss name + segmented hp bar (one segment per weak point, sized by its hp) at the
 * top centre; shakes on each hit, bursts on defeat. State from the game store, so it
 * survives the HUD remounting after a pause.
 */
export default function BossBar() {
  const boss = useGameStore((s) => s.boss)
  const barRef = useRef<HTMLDivElement>(null)
  const hpLeft = boss ? boss.hp.reduce((sum, h) => sum + Math.max(0, h), 0) : 0
  const hpTotal = boss ? boss.maxHp.reduce((sum, h) => sum + h, 0) : 0

  // Restart the shake on every hit (a reflow between remove and add replays the animation).
  const lastHp = useRef(hpLeft)
  useEffect(() => {
    const el = barRef.current
    if (el && hpLeft < lastHp.current) {
      el.classList.remove('is-hit')
      void el.offsetWidth
      el.classList.add('is-hit')
    }
    lastHp.current = hpLeft
  }, [hpLeft])

  if (!boss) return null
  return (
    <div
      className={`hud-boss${boss.defeated ? ' is-defeated' : ''}`}
      role="status"
      aria-label={boss.defeated ? `${boss.name} defeated` : `${boss.name}: ${hpLeft} of ${hpTotal}`}
    >
      <div className="hud-boss-name">{boss.defeated ? `${boss.name} is down!` : boss.name}</div>
      <div className="hud-boss-bar" ref={barRef}>
        {boss.maxHp.map((max, i) => (
          <div key={i} className="hud-boss-seg" style={{ flexGrow: max }}>
            <div className="hud-boss-seg-fill" style={{ transform: `scaleX(${Math.max(0, boss.hp[i]) / max})` }} />
          </div>
        ))}
      </div>
    </div>
  )
}
