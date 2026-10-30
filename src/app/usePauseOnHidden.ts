import { useEffect } from 'react'
import { useGameStore } from '@/store/useGameStore'

/** Pauses a run (its countdown, or a resume countdown) when the tab is hidden or the window loses focus; only the player resumes it. */
export function usePauseOnHidden() {
  useEffect(() => {
    const pause = () => {
      const { phase, resuming, setPhase } = useGameStore.getState()
      if (phase === 'playing' || phase === 'countdown' || resuming) setPhase('paused')
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pause()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', pause)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', pause)
    }
  }, [])
}
