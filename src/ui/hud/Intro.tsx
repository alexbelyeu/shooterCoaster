import { useEffect } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { subscribePointer } from '@/input/pointerInput'
import { INTRO_HANDOFF_SECONDS, setIntroStartedAt } from '@/core/introShot'

/**
 * The intro (#674): the camera tours the level into the seat (`CoasterCamera`, #675) on its own clock, the same length
 * on every device. Ready / Set / GO comes up over the tour's last stretch (`COUNTDOWN_LEAD_SECONDS`), so GO lands as
 * the camera does: the intro hands over to the countdown with its clock still running. A tap (pointer released off
 * the UI) or any key skips it: the camera cuts to the seat and the countdown runs there.
 */
export default function Intro() {
  useEffect(() => {
    const started = performance.now()
    setIntroStartedAt(started)
    let over = false
    let handedOver = false
    const end = (skipped: boolean) => {
      if (over) return
      over = true
      const testApi = window.__SC_TEST__
      if (testApi) {
        testApi.intro.seconds = (performance.now() - started) / 1000
        testApi.intro.skipped = skipped
      }
      const s = useGameStore.getState()
      if (s.phase !== 'intro') return
      handedOver = !skipped
      if (skipped) setIntroStartedAt(null)
      s.setPhase('countdown')
    }
    // A plain timer, not held for e2e screenshots: the intro's length is the point (#674).
    const timer = setTimeout(() => end(false), INTRO_HANDOFF_SECONDS * 1000)
    const unsubscribe = subscribePointer((_, type) => type === 'up' && end(true))
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) end(true)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('keydown', onKey)
      // Handed over, the countdown keeps the clock until GO; anything else (a pause, leaving the level) stops it.
      if (!handedOver) setIntroStartedAt(null)
    }
  }, [])

  return (
    <div className="intro-hint" aria-hidden="true">
      Tap to skip
    </div>
  )
}
