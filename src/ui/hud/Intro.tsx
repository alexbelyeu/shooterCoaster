import { useEffect } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { subscribePointer } from '@/input/pointerInput'
import { INTRO_SECONDS, setIntroStartedAt } from '@/core/introShot'

/**
 * The intro (#674): the camera tours the level into the seat (`CoasterCamera`, #675) on its own clock, `INTRO_SECONDS` long on
 * every device, then Ready / Set / GO. A tap (pointer released off the UI) or any key skips it.
 */
export default function Intro() {
  useEffect(() => {
    const started = performance.now()
    setIntroStartedAt(started)
    let over = false
    const end = (skipped: boolean) => {
      if (over) return
      over = true
      const testApi = window.__SC_TEST__
      if (testApi) {
        testApi.intro.seconds = (performance.now() - started) / 1000
        testApi.intro.skipped = skipped
      }
      const s = useGameStore.getState()
      if (s.phase === 'intro') s.setPhase('countdown')
    }
    // A plain timer, not held for e2e screenshots: the intro's length is the point (#674).
    const timer = setTimeout(() => end(false), INTRO_SECONDS * 1000)
    const unsubscribe = subscribePointer((_, type) => type === 'up' && end(true))
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) end(true)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('keydown', onKey)
      setIntroStartedAt(null)
    }
  }, [])

  return (
    <div className="intro-hint" aria-hidden="true">
      Tap to skip
    </div>
  )
}
