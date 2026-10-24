import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/store/useGameStore'
import { subscribePointer } from '@/input/pointerInput'
import { isFeedbackHeld } from '@/combat/hitFeedback'

const STEPS = ['Ready', 'Set', 'GO!']
const GO = STEPS.length - 1
/** Ready and Set each hold this long; GO! starts the run and stays up over the HUD for GO_HOLD_MS (2.5 s in all on a warm level). */
const STEP_MS = 850
const GO_HOLD_MS = 800
/** Ready also waits for the shader warm-up (`sceneReady`), but never longer than this. */
const READY_MAX_MS = 4000
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

/**
 * Ready / Set / GO over a mounted, warming-up level. Shows only when it mounts in
 * the `countdown` phase; GO moves the run to `playing`. Unmounting (pause) stops it.
 */
export default function Countdown() {
  const [step, setStep] = useState<number | null>(() =>
    useGameStore.getState().phase === 'countdown' ? 0 : null,
  )
  const sceneReady = useGameStore((s) => s.sceneReady)
  const [readyShown, setReadyShown] = useState(false)
  const [readyTimedOut, setReadyTimedOut] = useState(false)

  useEffect(() => {
    const cancelShown = stepTimeout(() => setReadyShown(true), STEP_MS)
    const timedOut = setTimeout(() => setReadyTimedOut(true), READY_MAX_MS)
    return () => {
      cancelShown()
      clearTimeout(timedOut)
    }
  }, [])

  useEffect(() => {
    if (step === 0 && readyShown && (sceneReady || readyTimedOut)) return stepTimeout(() => setStep(1), 0)
  }, [step, readyShown, sceneReady, readyTimedOut])

  useEffect(() => {
    if (step === null || step === 0) return
    if (step < GO) return stepTimeout(() => setStep(step + 1), STEP_MS)
    const store = useGameStore.getState()
    if (store.phase === 'countdown') store.setPhase('playing')
    return stepTimeout(() => setStep(null), GO_HOLD_MS)
  }, [step])

  const counting = step !== null && step < GO
  useEffect(() => {
    if (!counting) return
    const skippableAt = performance.now() + SKIPPABLE_AFTER_MS
    return subscribePointer((_, type) => {
      if (type === 'up' && performance.now() >= skippableAt) setStep(GO)
    })
  }, [counting])

  return (
    <div className="countdown">
      <AnimatePresence mode="wait">
        {step !== null && (
          <motion.div
            key={step}
            className={`countdown-step${step === GO ? ' countdown-step--go' : ''}`}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {STEPS[step]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
