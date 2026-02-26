import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'

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
      setTimeRemaining(seconds)
    }
  }, [phase, seconds, setTimeRemaining])

  useFrame(({ clock }) => {
    if (phase !== 'playing') return

    if (startTime.current === null) {
      startTime.current = clock.elapsedTime
    }

    const elapsed = clock.elapsedTime - startTime.current
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
