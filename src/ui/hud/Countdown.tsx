import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/store/useGameStore'
import { subscribePointer } from '@/input/pointerInput'
import { sfx } from '@/audio/sfx'
import { isFeedbackHeld } from '@/combat/hitFeedback'
import { COUNTDOWN_STEPS, COUNTDOWN_STEP_MS, INTRO_SECONDS, introStartedAt, setIntroStartedAt } from '@/core/introShot'

/** GO! sets `playing` and stays up over the HUD for `goHoldMs`: 2.5 s in all on a warm start, ~1.6 s on a resume. */
const SEQUENCES = {
  start: { steps: COUNTDOWN_STEPS, stepMs: COUNTDOWN_STEP_MS, goHoldMs: 800 },
  resume: { steps: ['Ready', 'GO!'], stepMs: 1100, goHoldMs: 500 },
} as const
type CountdownMode = keyof typeof SEQUENCES

/** A tap (pointer released off the UI) jumps to GO once the countdown has run this long. */
const SKIPPABLE_AFTER_MS = 1000

/** setTimeout that also waits out the e2e feedback hold, so a smoke screenshot can catch a step. */
function stepTimeout(fn: () => void, ms: number): () => void {
  let id = setTimeout(function tick() {
    if (isFeedbackHeld()) id = setTimeout(tick, 100)
    else fn()
  }, ms)
  return () => clearTimeout(id)
}

function modeAtMount(): CountdownMode | null {
  const { phase, resuming } = useGameStore.getState()
  if (phase === 'countdown') return 'start'
  return phase === 'paused' && resuming ? 'resume' : null
}

/**
 * Ready / Set / GO over the intro tour's last stretch into the seat (#674: the intro hands over with its clock still
 * running, and each step is timed on that clock, so GO lands as the camera does), or in the seat on a restart or a
 * skipped intro; Ready / GO over a frozen run resuming. A pause unmounts it.
 */
export default function Countdown() {
  const [mode] = useState(modeAtMount)
  const { steps, stepMs, goHoldMs } = SEQUENCES[mode ?? 'start']
  const go = steps.length - 1
  const [step, setStep] = useState<number | null>(mode ? 0 : null)

  useEffect(() => {
    if (step === null) return
    if (step < go) {
      // Over the tour, the next step lands where the tour's clock says it does, not a step after this one.
      const tourStart = mode === 'start' ? introStartedAt() : null
      const at = tourStart === null ? stepMs : tourStart + INTRO_SECONDS * 1000 - (go - step - 1) * stepMs - performance.now()
      return stepTimeout(() => setStep(step + 1), Math.max(at, 0))
    }
    setIntroStartedAt(null)
    const store = useGameStore.getState()
    if (store.phase === 'countdown' || (store.phase === 'paused' && store.resuming)) store.setPhase('playing')
    return stepTimeout(() => setStep(null), goHoldMs)
  }, [step, go, stepMs, goHoldMs, mode])

  // A pause or leaving the level mid-countdown stops the tour: a resume or a new run starts in the seat.
  useEffect(() => () => setIntroStartedAt(null), [])

  useEffect(() => {
    if (step !== null) sfx().countdown(step === go)
  }, [step, go])

  const counting = step !== null && step < go
  useEffect(() => {
    if (!counting) return
    const skippableAt = performance.now() + SKIPPABLE_AFTER_MS
    return subscribePointer((_, type) => {
      if (type === 'up' && performance.now() >= skippableAt) setStep(go)
    })
  }, [counting, go])

  return (
    <div className="countdown">
      <AnimatePresence mode="wait">
        {step !== null && (
          <motion.div
            key={step}
            className={`countdown-step${step === go ? ' countdown-step--go' : ''}`}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {steps[step]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
