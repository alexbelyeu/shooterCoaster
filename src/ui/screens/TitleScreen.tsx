import { useEffect, useRef, useState } from 'react'
import { browserStorage, isInternalBrowser } from '@/app/analyticsGate'
import { initAudio, isAudioReady } from '@/audio/AudioEngine'
import { startTitleMusic } from '@/audio/TitleMusicManager'
import { usePrefersReducedMotion } from '@/ui/reducedMotion'
import { motion } from 'framer-motion'
import { startsGame } from './titleKeys'

const TITLE = 'ShooterCoaster'
const SUBTITLE_WORDS = ['Ride.', 'Aim.', 'Shoot.']
/** The title has landed by here; PLAY and the rest follow. */
const PLAY_IN_S = 1.3

/** The start hint shows on the first title of a page load only. */
let hintShownThisLoad = false

const touchFirst = () => typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches

interface TitleScreenProps {
  /** Starts the fade out to level select (audio is unlocked and the music running by then). */
  onPlay: () => void
  onSettings?: () => void
}

/** Unlocks audio and starts the title music: on the first press anywhere, or on PLAY. */
async function startMusic() {
  if (!isAudioReady()) await initAudio()
  startTitleMusic()
}

export default function TitleScreen({ onPlay, onSettings }: TitleScreenProps) {
  const [internal] = useState(() => isInternalBrowser(browserStorage()))
  const [showHint] = useState(() => !hintShownThisLoad)
  const [hint] = useState(() => (touchFirst() ? 'Tap PLAY to start' : 'Press any key to start'))
  const reduced = usePrefersReducedMotion()
  const started = useRef(false)

  useEffect(() => {
    hintShownThisLoad = true
  }, [])

  async function play() {
    if (started.current) return
    started.current = true
    await startMusic()
    onPlay()
  }

  useEffect(() => {
    // Music starts on the first interaction of any kind, before PLAY.
    const kickstart = () => void startMusic()
    const onKey = (e: KeyboardEvent) => {
      kickstart()
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
    <div className="title-screen">
      <motion.h1
        aria-label={TITLE}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -120, scale: 1.25, filter: 'blur(14px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{
          opacity: { duration: 0.6, ease: 'easeOut' },
          filter: { duration: 0.6, ease: 'easeOut' },
          scale: { duration: 0.6, ease: 'easeOut' },
          y: { type: 'spring', damping: 9, stiffness: 140, mass: 0.8 },
        }}
      >
        {TITLE}
      </motion.h1>

      <p className="subtitle">
        {SUBTITLE_WORDS.map((word, i) => (
          <motion.span
            key={word}
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
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
          opacity: { duration: 0.4, delay: PLAY_IN_S },
          scale: reduced
            ? { duration: 0.4, delay: PLAY_IN_S }
            : { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: PLAY_IN_S },
          boxShadow: { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: PLAY_IN_S },
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
          transition={reduced ? { delay: PLAY_IN_S + 0.6 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: PLAY_IN_S + 0.6 }}
        >
          {hint}
        </motion.p>
      )}

      {onSettings && (
        <motion.button
          className="settings-button"
          onClick={onSettings}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: PLAY_IN_S + 0.5 }}
          aria-label="Settings"
        >
          &#x2699;
        </motion.button>
      )}

      <motion.div
        className="credits"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: PLAY_IN_S + 0.5 }}
      >
        A Three.js game by{' '}
        <a href="https://github.com/alexbelyeu/shooterCoaster" target="_blank" rel="noreferrer">
          Alex Belyeu
        </a>
      </motion.div>

      {internal && <div className="internal-marker">internal: not tracked</div>}
    </div>
  )
}
