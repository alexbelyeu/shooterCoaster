import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import type { GamePhase } from '@/types/game'

interface GameTimerProps {
  seconds: number
}

/** Counts down the level on game time; reset when a run starts (`countdown`, or `playing` without one), kept through GO and resume. */
export default function GameTimer({ seconds }: GameTimerProps) {
  const phase = useGameStore((s) => s.phase)

  const elapsed = useRef(0)
  /** The first frame's delta can include the level's load, so counting starts on the second. */
  const running = useRef(false)
  const lastCeiled = useRef(-1)
  const prevPhase = useRef<GamePhase>(phase)

  useEffect(() => {
    const prev = prevPhase.current
    prevPhase.current = phase
    const starts = phase === 'countdown' || (phase === 'playing' && prev !== 'paused' && prev !== 'countdown')
    if (!starts) return
    elapsed.current = 0
    running.current = false
    lastCeiled.current = -1
    useGameStore.getState().setTimeRemaining(seconds)
  }, [phase, seconds])

  useFrame((_, delta) => {
    if (phase !== 'playing') return
    const { timeScale, setTimeRemaining, setPhase } = useGameStore.getState()
    if (timeScale === 0) return
    if (running.current) elapsed.current += delta
    else running.current = true

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
