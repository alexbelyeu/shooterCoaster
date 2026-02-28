import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'

/** Accumulated frozen time so the timer doesn't jump when unfreezing */
let frozenAccum = 0

interface GameTimerProps {
  seconds: number
}

/** Counts down the level timer and triggers results when time runs out */
export default function GameTimer({ seconds }: GameTimerProps) {
  const setTimeRemaining = useGameStore((s) => s.setTimeRemaining)
  const setPhase = useGameStore((s) => s.setPhase)
  const phase = useGameStore((s) => s.phase)

  const startTime = useRef<number | null>(null)
  const lastCeiled = useRef<number>(-1)

  useEffect(() => {
    if (phase === 'playing') {
      startTime.current = null
      lastCeiled.current = -1
      frozenAccum = 0
      setTimeRemaining(seconds)
    }
  }, [phase, seconds, setTimeRemaining])

  const wasFrozen = useRef(false)
  const freezeStart = useRef(0)

  useFrame(({ clock }) => {
    if (phase !== 'playing') return
    const timeScale = useGameStore.getState().timeScale

    // Track frozen duration so timer doesn't jump
    if (timeScale === 0) {
      if (!wasFrozen.current) {
        wasFrozen.current = true
        freezeStart.current = clock.elapsedTime
      }
      return
    }
    if (wasFrozen.current) {
      wasFrozen.current = false
      frozenAccum += clock.elapsedTime - freezeStart.current
    }

    if (startTime.current === null) {
      startTime.current = clock.elapsedTime
    }

    const elapsed = clock.elapsedTime - startTime.current - frozenAccum
    const remaining = Math.max(0, seconds - elapsed)

    const ceiled = Math.ceil(remaining)
    if (ceiled !== lastCeiled.current) {
      lastCeiled.current = ceiled
      setTimeRemaining(remaining)
    }

    if (remaining <= 0) {
      setPhase('results')
    }
  })

  return null
}
