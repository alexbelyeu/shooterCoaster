import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/store/useGameStore'
import { subscribePointer } from '@/input/pointerInput'
import { isFeedbackHeld } from '@/combat/hitFeedback'
import { sfx } from '@/audio/sfx'
import { isLevelSceneLoaded, loadLevelScene } from '@/canvas/loadLevelScene'
import { readyDone } from './countdownGate'
import { setCountdownGoAt } from '@/core/introShot'

/** GO! sets `playing` and stays up over the HUD for `goHoldMs`: 2.5 s in all on a warm start, ~1.6 s on a resume. */
const SEQUENCES = {
  start: { steps: ['Ready', 'Set', 'GO!'], stepMs: 850, goHoldMs: 800 },
  resume: { steps: ['Ready', 'GO!'], stepMs: 1100, goHoldMs: 500 },
} as const
type CountdownMode = keyof typeof SEQUENCES

/** Ready waits for the level chunk (#464), then for the shader warm-up (`sceneReady`), but never longer than this after the chunk. */
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

function modeAtMount(): CountdownMode | null {
  const { phase, resuming } = useGameStore.getState()
  if (phase === 'countdown') return 'start'
  return phase === 'paused' && resuming ? 'resume' : null
}

/** Ready / Set / GO over a warming-up level, or Ready / GO over a frozen run resuming; a pause unmounts it. */
export default function Countdown() {
  const [mode] = useState(modeAtMount)
  const { steps, stepMs, goHoldMs } = SEQUENCES[mode ?? 'start']
  const go = steps.length - 1
  const [step, setStep] = useState<number | null>(mode ? 0 : null)
  const sceneReady = useGameStore((s) => s.sceneReady)
  const [readyShown, setReadyShown] = useState(false)
  const [chunkLoaded, setChunkLoaded] = useState(isLevelSceneLoaded)
  const [warmupTimedOut, setWarmupTimedOut] = useState(false)

  useEffect(() => stepTimeout(() => setReadyShown(true), stepMs), [stepMs])

  // A run can start before the startup fetch lands (slow network); a failed load returns to the title, unmounting this.
  useEffect(() => {
    if (chunkLoaded) return
    let live = true
    loadLevelScene().then(() => live && setChunkLoaded(true), () => {})
    return () => {
      live = false
    }
  }, [chunkLoaded])

  useEffect(() => {
    if (!chunkLoaded) return
    const timedOut = setTimeout(() => setWarmupTimedOut(true), READY_MAX_MS)
    return () => clearTimeout(timedOut)
  }, [chunkLoaded])

  const ready = readyDone({ shown: readyShown, chunkLoaded, sceneReady, warmupTimedOut })
  useEffect(() => {
    if (step === 0 && ready) return stepTimeout(() => setStep(1), 0)
  }, [step, ready])

  useEffect(() => {
    if (step === null || step === 0) return
    if (step < go) {
      // The camera's intro swoop lands in the seat on GO (#328).
      if (mode === 'start' && step === go - 1) setCountdownGoAt(performance.now() + stepMs)
      return stepTimeout(() => setStep(step + 1), stepMs)
    }
    setCountdownGoAt(null)
    const store = useGameStore.getState()
    if (store.phase === 'countdown' || (store.phase === 'paused' && store.resuming)) store.setPhase('playing')
    return stepTimeout(() => setStep(null), goHoldMs)
  }, [step, go, stepMs, goHoldMs, mode])

  useEffect(() => () => setCountdownGoAt(null), [])

  useEffect(() => {
    if (step !== null) sfx().countdown(step === go)
  }, [step, go])

  const counting = step !== null && step < go
  useEffect(() => {
    if (!counting || !chunkLoaded) return
    const skippableAt = performance.now() + SKIPPABLE_AFTER_MS
    return subscribePointer((_, type) => {
      if (type === 'up' && performance.now() >= skippableAt) setStep(go)
    })
  }, [counting, chunkLoaded, go])

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
