import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameCanvas from '@/canvas/GameCanvas'
import { useGameStore } from '@/store/useGameStore'
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
import { startTitleMusic, stopTitleMusic } from '@/audio/TitleMusicManager'
import { isAudioReady } from '@/audio/AudioEngine'

const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export default function App() {
  const phase = useGameStore((s) => s.phase)
  const [showSettings, setShowSettings] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const setPhase = useGameStore((s) => s.setPhase)

  // When entering 'playing', show countdown first
  const origSetPhase = useGameStore((s) => s.setPhase)

  // Intercept transition to 'playing' to show countdown
  const handleLevelStart = useCallback(() => {
    setShowCountdown(true)
  }, [])

  const onCountdownComplete = useCallback(() => {
    setShowCountdown(false)
  }, [])

  // Start/stop title music based on phase
  useEffect(() => {
    if ((phase === 'title' || phase === 'levelSelect') && isAudioReady()) {
      startTitleMusic()
    } else {
      stopTitleMusic()
    }
    return () => stopTitleMusic()
  }, [phase])

  // Hide OS cursor whenever custom crosshair is visible
  const showCrosshair = phase === 'title' || phase === 'levelSelect' || phase === 'playing'
  useEffect(() => {
    const el = document.documentElement
    if (showCrosshair) {
      el.classList.add('playing-cursor')
    } else {
      el.classList.remove('playing-cursor')
    }
    return () => el.classList.remove('playing-cursor')
  }, [showCrosshair])

  return (
    <>
      <GameCanvas />

      <AnimatePresence mode="wait">
        {phase === 'title' && !showSettings && (
          <motion.div
            key="title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <TitleScreen onSettings={() => setShowSettings(true)} />
          </motion.div>
        )}

        {phase === 'levelSelect' && !showSettings && (
          <motion.div key="levelSelect" {...fadeVariants} transition={{ duration: 0.3 }}>
            <LevelSelectScreen />
          </motion.div>
        )}

        {phase === 'playing' && showCountdown && (
          <motion.div key="countdown" {...fadeVariants} transition={{ duration: 0.2 }}>
            <Countdown onComplete={onCountdownComplete} />
          </motion.div>
        )}

        {phase === 'playing' && !showCountdown && (
          <motion.div key="hud" {...fadeVariants} transition={{ duration: 0.2 }}>
            <HUD />
          </motion.div>
        )}

        {phase === 'paused' && (
          <motion.div key="paused" {...fadeVariants} transition={{ duration: 0.2 }}>
            <PauseScreen />
          </motion.div>
        )}

        {phase === 'results' && (
          <motion.div key="results" {...fadeVariants} transition={{ duration: 0.4 }}>
            <ResultsScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}

      <MuteButton />

      {showCrosshair && <Crosshair />}

      {phase === 'playing' && <ScorePopups />}
      {phase === 'playing' && <WaveAnnouncement />}
    </>
  )
}
