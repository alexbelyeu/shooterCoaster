import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { initAudio, isAudioReady } from '@/audio/AudioEngine'
import { startTitleMusic } from '@/audio/TitleMusicManager'
import { motion } from 'framer-motion'

const TITLE = 'ShooterCoaster'
const SUBTITLE_WORDS = ['Ride.', 'Aim.', 'Shoot.']

const letterSpring = {
  type: 'spring' as const,
  damping: 12,
  stiffness: 200,
}

interface TitleScreenProps {
  onSettings?: () => void
}

export default function TitleScreen({ onSettings }: TitleScreenProps) {
  const setPhase = useGameStore((s) => s.setPhase)
  const musicStarted = useRef(false)

  // Start music on the very first click/tap anywhere on the page
  useEffect(() => {
    if (musicStarted.current) return
    const kickstart = async () => {
      if (!isAudioReady()) await initAudio()
      if (!musicStarted.current) {
        musicStarted.current = true
        startTitleMusic()
      }
    }
    window.addEventListener('pointerdown', kickstart, { once: true })
    return () => window.removeEventListener('pointerdown', kickstart)
  }, [])

  async function handlePlay() {
    if (!isAudioReady()) await initAudio()
    if (!musicStarted.current) {
      musicStarted.current = true
      startTitleMusic()
    }
    setPhase('levelSelect')
  }

  return (
    <div className="title-screen">
      {/* Title — per-letter staggered spring entrance */}
      <h1 aria-label={TITLE}>
        {TITLE.split('').map((char, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 40, scale: 0.5, rotateX: -90 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            transition={{ ...letterSpring, delay: i * 0.04 }}
            style={{ display: 'inline-block' }}
          >
            {char}
          </motion.span>
        ))}
      </h1>

      {/* Subtitle — three words fade in sequentially */}
      <p className="subtitle">
        {SUBTITLE_WORDS.map((word, i) => (
          <motion.span
            key={word}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.0 + i * 0.3 }}
            style={{ display: 'inline-block', marginRight: '0.4em' }}
          >
            {word}
          </motion.span>
        ))}
      </p>

      {/* Play button — fades in, then infinite pulsing glow */}
      <motion.button
        className="play-button"
        onClick={handlePlay}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: 1,
          scale: 1,
          boxShadow: [
            '0 0 20px rgba(255, 200, 0, 0.3)',
            '0 0 40px rgba(255, 200, 0, 0.7)',
            '0 0 20px rgba(255, 200, 0, 0.3)',
          ],
        }}
        transition={{
          opacity: { duration: 0.5, delay: 2.0 },
          scale: { duration: 0.5, delay: 2.0 },
          boxShadow: { duration: 2, repeat: Infinity, delay: 2.5 },
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        Play
      </motion.button>

      {/* Settings gear — bottom-left */}
      {onSettings && (
        <motion.button
          className="settings-button"
          onClick={onSettings}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 2.5 }}
          aria-label="Settings"
        >
          &#x2699;
        </motion.button>
      )}

      {/* Credits */}
      <motion.div
        className="credits"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 2.5 }}
      >
        A Three.js game by{' '}
        <a href="https://github.com/alexbelyeu/shooterCoaster" target="_blank" rel="noreferrer">
          Alex Belyeu
        </a>
      </motion.div>
    </div>
  )
}
