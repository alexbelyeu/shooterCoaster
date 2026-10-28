import { useEffect, useState } from 'react'
import { eventBus } from '@/core/EventBus'
import { FRENZY, TOP_TIER, COMBO_TIERS } from '@/combat/comboTiers'
import { isFeedbackHeld } from '@/combat/hitFeedback'

const FADE_MS = 350
const HOLD_POLL_MS = 200

type Stage = 'off' | 'on' | 'out'

/** "×5 FRENZY" and a red edge pulse for the top-tier slow-mo (`combo:frenzy`); held by e2e `holdFeedback`. */
export default function FrenzyFlash() {
  const [stage, setStage] = useState<Stage>('off')
  const [shownAt, setShownAt] = useState(0)

  useEffect(() => {
    const onFrenzy = () => {
      setStage('on')
      setShownAt((n) => n + 1)
    }
    eventBus.on('combo:frenzy', onFrenzy)
    return () => eventBus.off('combo:frenzy', onFrenzy)
  }, [])

  useEffect(() => {
    if (stage === 'off') return
    let t: ReturnType<typeof setTimeout>
    const next = () => {
      if (isFeedbackHeld()) t = setTimeout(next, HOLD_POLL_MS)
      else setStage(stage === 'on' ? 'out' : 'off')
    }
    t = setTimeout(next, stage === 'on' ? FRENZY.durationS * 1000 - FADE_MS : FADE_MS)
    return () => clearTimeout(t)
  }, [stage, shownAt])

  if (stage === 'off') return null
  const out = stage === 'out' ? ' is-out' : ''
  return (
    <>
      <div key={`edge${shownAt}`} className={`hud-frenzy-edge${out}`} aria-hidden="true" />
      <div key={`text${shownAt}`} className={`hud-frenzy${out}`} role="status">
        <span className="hud-frenzy-mult">×{COMBO_TIERS[TOP_TIER].multiplier}</span>
        <span className="hud-frenzy-word">FRENZY</span>
      </div>
    </>
  )
}
