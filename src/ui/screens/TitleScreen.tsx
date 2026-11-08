import { useEffect, useRef, useState } from 'react'
import { isInternalThisLoad } from '@/app/analyticsGate'
import { initAudio } from '@/audio/AudioEngine'
import { prepareSfx } from '@/audio/sfx'
import { useGameStore } from '@/store/useGameStore'
import { usePrefersReducedMotion } from '@/ui/reducedMotion'
import { motion } from 'framer-motion'
import { markStartup } from '@/core/startupMarks'
import { startsGame } from './titleKeys'
import { handPosterToUi, posterShown } from '@/app/poster'
import { audioClockNow, titleBeatGrid } from '@/audio/TitleMusicManager'
import { ATTRACT_IDLE_MS, setTitleAttract } from '@/canvas/titleAttract'
import { e2eAttractIdleMs } from '@/testing/e2eHook'
import { logoBeat } from './titleBeat'

const TITLE = 'ShooterCoaster'
const SUBTITLE_WORDS = ['Ride.', 'Aim.', 'Shoot.']
/** The title has landed by here; PLAY and the rest follow. */
const PLAY_IN_S = 1.3
/** Over the poster the logo is already there: PLAY replaces the poster's placeholder as that fades. */
const PLAY_OVER_POSTER_S = 0.15

let hintShownThisLoad = false

const WAKE_EVENTS = ['pointerdown', 'pointermove', 'wheel'] as const

const touchFirst = () => typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches

interface TitleScreenProps {
  onPlay: () => void
  onSettings?: () => void
}

/** PLAY waits this long at most for Tone's chunk: the title music starts from App's `whenAudioReady` when it lands. */
const PLAY_AUDIO_WAIT_MS = 300

/** Every call resumes the context inside its gesture (`initAudio`), so the PLAY click retries what a touch pointerdown couldn't. */
function startAudio(): Promise<void> {
  return initAudio().then(() => {
    // A level that mounted before Tone landed has prepared its own kit already.
    const { phase } = useGameStore.getState()
    if (phase === 'title' || phase === 'levelSelect') prepareSfx(null, 'themePark')
  })
}

export default function TitleScreen({ onPlay, onSettings }: TitleScreenProps) {
  const [internal] = useState(isInternalThisLoad)
  const [showHint] = useState(() => !hintShownThisLoad)
  const [hint] = useState(() => (touchFirst() ? 'Tap PLAY to start' : 'Press any key to start'))
  const reduced = usePrefersReducedMotion()
  // Over index.html's poster, the logo and tagline are already on screen: they stay put instead of flying in.
  const [overPoster] = useState(posterShown)
  const playIn = overPoster ? PLAY_OVER_POSTER_S : PLAY_IN_S
  const started = useRef(false)
  const logoRef = useRef<HTMLHeadingElement>(null)
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
    const onInput = () => void wake()
    for (const e of WAKE_EVENTS) window.addEventListener(e, onInput, { capture: true, passive: true })
    return () => {
      window.clearInterval(idle)
      for (const e of WAKE_EVENTS) window.removeEventListener(e, onInput, { capture: true })
      setTitleAttract(false)
    }
  }, [])

  // The logo hits on the title music's bars (and lightly on its beats): `--logo-beat` drives its scale and glow.
  useEffect(() => {
    if (reduced) return
    let raf = 0
    let last = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const grid = titleBeatGrid()
      const v = grid ? logoBeat(audioClockNow(), grid) : 0
      if (Math.abs(v - last) < 0.005) return
      last = v
      logoRef.current?.style.setProperty('--logo-beat', v.toFixed(3))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  async function play() {
    if (started.current) return
    started.current = true
    // A browser that refuses audio, or a slow network, still gets to play.
    const audio = startAudio().catch(() => {})
    await Promise.race([audio, new Promise((r) => window.setTimeout(r, PLAY_AUDIO_WAIT_MS))])
    onPlay()
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
      if (!onControl && startsGame(e)) {
        e.preventDefault()
        void play()
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
      <motion.h1
        ref={logoRef}
        aria-label={TITLE}
        initial={overPoster ? false : reduced ? { opacity: 0 } : { opacity: 0, y: -120, scale: 1.25, filter: 'blur(14px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{
          opacity: { duration: 0.6, ease: 'easeOut' },
          filter: { duration: 0.6, ease: 'easeOut' },
          scale: { duration: 0.6, ease: 'easeOut' },
          y: { type: 'spring', damping: 9, stiffness: 140, mass: 0.8 },
        }}
      >
        {TITLE}
        <span className="title-logo-sweep" aria-hidden="true">
          {TITLE}
        </span>
      </motion.h1>

      <p className="subtitle">
        {SUBTITLE_WORDS.map((word, i) => (
          <motion.span
            key={word}
            initial={overPoster ? false : { opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.2 }}
            style={{ display: 'inline-block', marginRight: '0.4em' }}
          >
            {word}
          </motion.span>
        ))}
      </p>

      <motion.button
        className="play-button"
        onClick={() => void play()}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: 1,
          scale: reduced ? 1 : [1, 1.06, 1],
          boxShadow: [
            '0 0 20px rgba(255, 200, 0, 0.3)',
            '0 0 40px rgba(255, 200, 0, 0.7)',
            '0 0 20px rgba(255, 200, 0, 0.3)',
          ],
        }}
        transition={{
          opacity: { duration: 0.4, delay: playIn },
          scale: reduced
            ? { duration: 0.4, delay: playIn }
            : { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: playIn },
          boxShadow: { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: playIn },
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        Play
      </motion.button>

      {showHint && (
        <motion.p
          className="title-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: reduced ? 0.8 : [0.45, 0.9, 0.45] }}
          transition={reduced ? { delay: playIn + 0.6 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: playIn + 0.6 }}
        >
          {hint}
        </motion.p>
      )}

      {onSettings && (
        <motion.button
          className="settings-button"
          onClick={onSettings}
          initial={{ opacity: 0, x: reduced ? 0 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: playIn + 0.35, ease: 'easeOut' }}
          whileTap={{ scale: 0.9 }}
          aria-label="Settings"
        >
          &#x2699;
        </motion.button>
      )}

      <motion.div
        className="credits"
        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: playIn + 0.5 }}
      >
        A Three.js game by{' '}
        <a href="https://github.com/alexbelyeu/shooterCoaster" target="_blank" rel="noreferrer">
          Alex Belyeu
        </a>
      </motion.div>

      {internal && <div className="internal-marker">internal: not tracked</div>}

      {attract && (
        <div className="title-attract" aria-hidden="true">
          <p className="title-attract-prompt">{touchFirst() ? 'Tap anywhere' : 'Press any key'}</p>
        </div>
      )}
    </div>
  )
}
