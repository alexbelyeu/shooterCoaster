import { useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { resetComboRuntime, tickCombo } from '@/combat/comboRuntime'

interface GameTimerProps {
  seconds: number
}

/**
 * Counts down the level; reset when a run starts (`runId`), kept through GO, pause and resume.
 * Also the frame that owns the combo game clock (`tickCombo`).
 */
export default function GameTimer({ seconds }: GameTimerProps) {
  const phase = useGameStore((s) => s.phase)
  const runId = useGameStore((s) => s.runId)

  const elapsed = useRef(0)
  /** The first frame's delta can include the level's load, so counting starts on the second. */
  const running = useRef(false)
  const lastCeiled = useRef(-1)

  // A layout effect, so the reset lands in the same commit as the new run and no frame can tick the old run's time.
  useLayoutEffect(() => {
    elapsed.current = 0
    running.current = false
    lastCeiled.current = -1
    resetComboRuntime()
    useGameStore.getState().setTimeRemaining(seconds)
  }, [runId, seconds])

  useFrame((_, delta) => {
    // The rendered `phase` lags a store change by a render, so a pause from a DOM event (tab hide) is read live.
    const { phase: livePhase, timeScale, setTimeRemaining, setPhase } = useGameStore.getState()
    if (phase !== 'playing' || livePhase !== 'playing') return
    if (timeScale === 0) return
    if (running.current) {
      elapsed.current += delta
      tickCombo(delta)
    } else running.current = true

    const remaining = Math.max(0, seconds - elapsed.current)
    const ceiled = Math.ceil(remaining)
    if (ceiled !== lastCeiled.current) {
      lastCeiled.current = ceiled
      setTimeRemaining(remaining)
    }

    if (remaining <= 0) setPhase('results')
  })

  return null
}
