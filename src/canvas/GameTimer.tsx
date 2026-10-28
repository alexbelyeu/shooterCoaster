import { useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import type { GamePhase } from '@/types/game'
import { resetComboRuntime, tickCombo } from '@/combat/comboRuntime'

interface GameTimerProps {
  seconds: number
}

/**
 * Counts down the level; reset when a run starts (`countdown`, or `playing` without one), kept
 * through GO and resume. Also the frame that owns the combo game clock (`tickCombo`).
 */
export default function GameTimer({ seconds }: GameTimerProps) {
  const phase = useGameStore((s) => s.phase)

  const elapsed = useRef(0)
  /** The first frame's delta can include the level's load, so counting starts on the second. */
  const running = useRef(false)
  const lastCeiled = useRef(-1)
  const prevPhase = useRef<GamePhase>(phase)

  // A layout effect, so the reset lands in the same commit as the new `phase` and no frame can tick the old run's time.
  useLayoutEffect(() => {
    const prev = prevPhase.current
    prevPhase.current = phase
    const starts = phase === 'countdown' || (phase === 'playing' && prev !== 'paused' && prev !== 'countdown')
    if (!starts) return
    elapsed.current = 0
    running.current = false
    lastCeiled.current = -1
    resetComboRuntime()
    useGameStore.getState().setTimeRemaining(seconds)
  }, [phase, seconds])

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
