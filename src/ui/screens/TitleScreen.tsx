import { useEffect, useRef, useState } from 'react'
import { isInternalThisLoad } from '@/app/analyticsGate'
import { initAudio } from '@/audio/AudioEngine'
import { prepareSfx } from '@/audio/sfx'
import { useGameStore } from '@/store/useGameStore'
import { usePrefersReducedMotion } from '@/ui/reducedMotion'
import { motion } from 'framer-motion'
import { markStartup } from '@/core/startupMarks'
import { titleAction, type TitleAction } from './titleKeys'
import { handPosterToUi, posterShown } from '@/app/poster'
import { ATTRACT_IDLE_MS, armClickSwallow, setTitleAttract } from '@/canvas/titleAttract'
import { e2eAttractIdleMs } from '@/testing/e2eHook'
import TitleLogo from './TitleLogo'
import { LOGO_TEXT } from '@/ui/logoArt'
import { touchFirst } from '@/ui/touchFirst'

const SUBTITLE_WORDS = ['Ride.', 'Aim.', 'Shoot.']
/** The title has landed by here; PLAY and the rest follow. */
const PLAY_IN_S = 1.3
/** Over the poster the logo is already there: PLAY replaces the poster's placeholder as that fades. */
const PLAY_OVER_POSTER_S = 0.15

let hintShownThisLoad = false

/** focusin: a gamepad's d-pad focuses the menu without a key (`gamepadMap.hot.ts` `navTarget`). */
const WAKE_EVENTS = ['pointerdown', 'pointermove', 'wheel', 'focusin'] as const


interface TitleScreenProps {
  /** PLAY (and press any key): the player's next level, straight into its run. */
  onPlay: () => void
  /** WORLDS (W, Escape): the level select. */
  onWorlds: () => void
  onSettings: () => void
}

/** PLAY / WORLDS wait this long at most for audio and the menu sounds (the whoosh): the title music starts from App's `whenAudioReady`. */
const PLAY_AUDIO_WAIT_MS = 300

/** Every call resumes the context inside its gesture (`initAudio`), so a PLAY / WORLDS click retries what a touch pointerdown couldn't. */
function startAudio(): Promise<void> {
  return initAudio().then(() => {
    // A level that mounted before audio unlocked has prepared its own sounds already.
    const { phase } = useGameStore.getState()
    if (phase === 'title' || phase === 'levelSelect') return prepareSfx(null, 'themePark')
  })
}

export default function TitleScreen({ onPlay, onWorlds, onSettings }: TitleScreenProps) {
  const [internal] = useState(isInternalThisLoad)
  const [showHint] = useState(() => !hintShownThisLoad)
  const [hint] = useState(() => (touchFirst() ? 'Tap Play to start.' : 'Press any key to start.'))
  const reduced = usePrefersReducedMotion()
  // Over index.html's poster, the logo and tagline are already on screen: they stay put instead of flying in.
  const [overPoster] = useState(posterShown)
  const playIn = overPoster ? PLAY_OVER_POSTER_S : PLAY_IN_S
  const started = useRef(false)
  const [attract, setAttract] = useState(false)
  const attractRef = useRef(false)
  const lastInput = useRef(performance.now())

  useEffect(() => {
    hintShownThisLoad = true
    markStartup('playReady')
    handPosterToUi()
  }, [])

  /** Any input counts as activity; out of attract mode it returns to the menu and says it did. */
  function wake(): boolean {
    lastInput.current = performance.now()
    if (!attractRef.current) return false
    attractRef.current = false
    setTitleAttract(false)
    setAttract(false)
    return true
  }

  // Attract mode (#419): after ATTRACT_IDLE_MS without input the menu steps aside and the camera cuts close on the ride.
  useEffect(() => {
    const idle = window.setInterval(() => {
      const idleMs = e2eAttractIdleMs(ATTRACT_IDLE_MS)
      if (attractRef.current || idleMs === null || performance.now() - lastInput.current < idleMs) return
      attractRef.current = true
      setTitleAttract(true)
      setAttract(true)
    }, 250)
    const onInput = (e: Event) => {
      if (wake() && e.type === 'pointerdown') armClickSwallow()
    }
    for (const e of WAKE_EVENTS) window.addEventListener(e, onInput, { capture: true, passive: true })
    return () => {
      window.clearInterval(idle)
      for (const e of WAKE_EVENTS) window.removeEventListener(e, onInput, { capture: true })
      setTitleAttract(false)
    }
  }, [])

  async function leave(action: TitleAction) {
    if (started.current) return
    started.current = true
    // A browser that refuses audio, or a slow network, still gets to play.
    const audio = startAudio().catch(() => {})
    await Promise.race([audio, new Promise((r) => window.setTimeout(r, PLAY_AUDIO_WAIT_MS))])
    if (action === 'play') onPlay()
    else onWorlds()
  }

  useEffect(() => {
    const kickstart = () => void startAudio().catch(() => {})
    const onKey = (e: KeyboardEvent) => {
      kickstart()
      // The key that ends attract mode only brings the menu back.
      if (wake()) {
        e.preventDefault()
        return
      }
      // Enter / Space on a focused button already click it.
      const onControl = e.target instanceof HTMLElement && e.target.closest('button, a, input') !== null
      const action = titleAction(e)
      if (action === 'worlds' || (action === 'play' && !onControl)) {
        e.preventDefault()
        void leave(action)
      }
    }
    window.addEventListener('pointerdown', kickstart, { once: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', kickstart)
      window.removeEventListener('keydown', onKey)
    }
  })

  return (
    <div className={attract ? 'title-screen is-attract' : 'title-screen'}>
      {/* Over the poster its still logo is already drawn: this one lands on it at rest, no build-in. */}
      <motion.h1
        className="title-logo"
        aria-label={LOGO_TEXT}
        initial={overPoster ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <TitleLogo still={reduced || overPoster} />
      </motion.h1>

      <p className="title-tagline fair-over-ride">
        {SUBTITLE_WORDS.map((word, i) => (
          <motion.span
            key={word}
            initial={overPoster ? false : { opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.2 }}
          >
            {word}
          </motion.span>
        ))}
      </p>

      {/* The plates fade in on opacity alone, so they land exactly on the poster's; CSS presses them. */}
      <motion.button
        className="fair-plate fair-go title-play"
        onClick={() => void leave('play')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: playIn }}
      >
        Play
      </motion.button>

      <div className="title-row">
        <motion.button
          className="fair-plate worlds-button"
          onClick={() => void leave('worlds')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: playIn + 0.2 }}
        >
          Worlds
        </motion.button>
        <motion.button
          className="fair-plate settings-button"
          onClick={onSettings}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: playIn + 0.2 }}
        >
          Settings
        </motion.button>
      </div>

      {showHint && (
        <motion.p
          className="title-hint fair-over-ride"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: playIn + 0.6 }}
        >
          {hint}
        </motion.p>
      )}

      <motion.p
        className="credits fair-over-ride"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: playIn + 0.5 }}
      >
        A Three.js game by{' '}
        <a href="https://github.com/alexbelyeu/shooterCoaster" target="_blank" rel="noreferrer">
          Alex Belyeu
        </a>
      </motion.p>

      {internal && <p className="internal-marker fair-over-ride">Internal device, not tracked</p>}

      {attract && (
        <div className="title-attract" aria-hidden="true">
          <p className="title-attract-prompt fair-over-ride">
            {touchFirst() ? 'Tap anywhere to step up.' : 'Press any key to step up.'}
          </p>
        </div>
      )}
    </div>
  )
}
