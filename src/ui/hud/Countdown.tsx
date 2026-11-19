import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/store/useGameStore'
import { subscribePointer } from '@/input/pointerInput'
import { sfx } from '@/audio/sfx'
import { isFeedbackHeld } from '@/combat/hitFeedback'

/** GO! sets `playing` and stays up over the HUD for `goHoldMs`: 2.5 s in all on a warm start, ~1.6 s on a resume. */
const SEQUENCES = {
  start: { steps: ['Ready', 'Set', 'GO!'], stepMs: 850, goHoldMs: 800 },
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
 * Ready / Set / GO in the seat after the loading screen and the intro (#674: nothing left to wait on, the camera
 * still), or Ready / GO over a frozen run resuming; a pause unmounts it.
 */
export default function Countdown() {
  const [mode] = useState(modeAtMount)
  const { steps, stepMs, goHoldMs } = SEQUENCES[mode ?? 'start']
  const go = steps.length - 1
  const [step, setStep] = useState<number | null>(mode ? 0 : null)

  useEffect(() => {
    if (step === null) return
    if (step < go) return stepTimeout(() => setStep(step + 1), stepMs)
    const store = useGameStore.getState()
    if (store.phase === 'countdown' || (store.phase === 'paused' && store.resuming)) store.setPhase('playing')
    return stepTimeout(() => setStep(null), goHoldMs)
  }, [step, go, stepMs, goHoldMs])

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
