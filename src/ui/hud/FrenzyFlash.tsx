import { useGameStore } from '@/store/useGameStore'
import { TOP_TIER, COMBO_TIERS } from '@/combat/comboTiers'
import { FairBoard } from '@/ui/Fair'

/** "×5 Frenzy" on a gilt show card in a gilt frame round the screen, for the store's `frenzy` stage: exactly as long as the slow-mo. */
export default function FrenzyFlash() {
  const stage = useGameStore((s) => s.frenzy)

  if (stage === 'off') return null
  const out = stage === 'out' ? ' is-out' : ''
  return (
    <>
      <div className={`hud-frenzy-edge${out}`} aria-hidden="true" />
      <div className={`hud-frenzy${out}`} role="status">
        <FairBoard className="hud-frenzy-card" shadowClassName="hud-frenzy-card-shadow fair-hook">
          <span className="hud-frenzy-mult">×{COMBO_TIERS[TOP_TIER].multiplier}</span>
          <span className="hud-frenzy-word">Frenzy</span>
        </FairBoard>
      </div>
    </>
  )
}
