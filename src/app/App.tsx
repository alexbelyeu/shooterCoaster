import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import GameCanvas from '@/canvas/GameCanvas'
import { useGameStore } from '@/store/useGameStore'
import { isLevelActive } from '@/store/startPhase'
import TitleScreen from '@/ui/screens/TitleScreen'
import LevelSelectScreen from '@/ui/screens/LevelSelectScreen'
import SettingsScreen from '@/ui/screens/SettingsScreen'
import HUD from '@/ui/hud/HUD'
import Countdown from '@/ui/hud/Countdown'
import PauseScreen from '@/ui/screens/PauseScreen'
import ResultsScreen from '@/ui/screens/ResultsScreen'
import MuteButton from '@/ui/MuteButton'
import Crosshair from '@/combat/Crosshair'
import ScorePopups from '@/effects/ScorePopups'
import WaveAnnouncement from '@/ui/hud/WaveAnnouncement'
import { playTitleWhoosh, startTitleMusic, stopTitleMusic } from '@/audio/TitleMusicManager'
import { whenAudioReady } from '@/audio/AudioEngine'
import { usePrefersReducedMotion } from '@/ui/reducedMotion'
import { usePauseOnHidden } from './usePauseOnHidden'

/** PLAY fades the title to black (with a whoosh) over this long, then opens level select. */
const TITLE_FADE_S = 0.4

const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export default function App() {
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const resuming = useGameStore((s) => s.phase === 'paused' && s.resuming)
  const [showSettings, setShowSettings] = useState(false)
  const [veiled, setVeiled] = useState(false)
  const veilTimer = useRef<number | undefined>(undefined)
  usePauseOnHidden()
  const reducedMotion = usePrefersReducedMotion()
  const inPlay = isLevelActive(phase)

  useEffect(() => {
    if (phase === 'title' || phase === 'levelSelect') return whenAudioReady(startTitleMusic)
    stopTitleMusic()
  }, [phase])
  useEffect(() => () => stopTitleMusic(), [])

  // The CSS mirrors its prefers-reduced-motion rules under html.reduce-motion for the in-game toggle.
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    if (phase !== 'title') setVeiled(false)
  }, [phase])
  useEffect(() => () => window.clearTimeout(veilTimer.current), [])

  function playFromTitle() {
    setVeiled(true)
    playTitleWhoosh()
    veilTimer.current = window.setTimeout(() => setPhase('levelSelect'), TITLE_FADE_S * 1000)
  }

  const showCrosshair = phase === 'title' || phase === 'levelSelect' || inPlay || resuming
  useEffect(() => {
    const el = document.documentElement
    if (showCrosshair) {
      el.classList.add('playing-cursor')
    } else {
      el.classList.remove('playing-cursor')
    }
    return () => el.classList.remove('playing-cursor')
  }, [showCrosshair])

  // During play: no page scroll / pinch-zoom / text-selection gestures (touch).
  useEffect(() => {
    if (!inPlay) return
    const el = document.documentElement
    el.classList.add('is-playing')
    // iOS Safari ignores touch-action for pinch on some versions; block its gesture events.
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', block)
    document.addEventListener('gesturechange', block)
    return () => {
      el.classList.remove('is-playing')
      document.removeEventListener('gesturestart', block)
      document.removeEventListener('gesturechange', block)
    }
  }, [inPlay])

  return (
    // Framer transitions (countdown, wave banner, screen fades) follow the toggle too, not only the OS setting.
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
      <GameCanvas />

      <AnimatePresence mode="wait">
        {phase === 'title' && !showSettings && (
          <motion.div
            key="title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <TitleScreen onPlay={playFromTitle} onSettings={() => setShowSettings(true)} />
          </motion.div>
        )}

        {phase === 'levelSelect' && !showSettings && (
          <motion.div key="levelSelect" {...fadeVariants} transition={{ duration: 0.3 }}>
            <LevelSelectScreen />
          </motion.div>
        )}

        {(phase === 'playing' || resuming) && (
          <motion.div key="hud" {...fadeVariants} transition={{ duration: 0.2 }}>
            <HUD />
          </motion.div>
        )}

        {phase === 'paused' && !resuming && !showSettings && (
          <motion.div key="paused" {...fadeVariants} transition={{ duration: 0.2 }}>
            <PauseScreen onSettings={() => setShowSettings(true)} />
          </motion.div>
        )}

        {phase === 'results' && (
          <motion.div key="results" {...fadeVariants} transition={{ duration: 0.4 }}>
            <ResultsScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {(inPlay || resuming) && <Countdown />}

      {/* Black over everything from PLAY until level select has mounted under it. */}
      <AnimatePresence>
        {veiled && (
          <motion.div
            key="veil"
            className="screen-veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: TITLE_FADE_S, ease: 'easeIn' } }}
            exit={{ opacity: 0, transition: { duration: 0.4, delay: 0.3, ease: 'easeOut' } }}
          />
        )}
      </AnimatePresence>

      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}

      <MuteButton />

      {showCrosshair && <Crosshair />}

      {phase === 'playing' && <ScorePopups />}
      {phase === 'playing' && <WaveAnnouncement />}
    </MotionConfig>
  )
}
