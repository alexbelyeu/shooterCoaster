import { useGameStore } from '@/store/useGameStore'
import { TOP_TIER, COMBO_TIERS } from '@/combat/comboTiers'

/** "×5 FRENZY" and a red edge pulse for the store's `frenzy` stage, so it lasts exactly as long as the slow-mo. */
export default function FrenzyFlash() {
  const stage = useGameStore((s) => s.frenzy)

  if (stage === 'off') return null
  const out = stage === 'out' ? ' is-out' : ''
  return (
    <>
      <div className={`hud-frenzy-edge${out}`} aria-hidden="true" />
      <div className={`hud-frenzy${out}`} role="status">
        <span className="hud-frenzy-mult">×{COMBO_TIERS[TOP_TIER].multiplier}</span>
        <span className="hud-frenzy-word">FRENZY</span>
      </div>
    </>
  )
}
