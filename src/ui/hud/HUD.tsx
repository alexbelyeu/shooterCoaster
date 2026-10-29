import { useEffect, useMemo, type CSSProperties } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { biomeTheme } from '@/ui/theme'
import ScoreDisplay from './ScoreDisplay'
import TimerBar from './TimerBar'
import ComboMeter from './ComboMeter'
import FrenzyFlash from './FrenzyFlash'
import BossBar from './BossBar'

/** Thin segmented kills / total strip under the score. Renders on kills only. */
function KillStrip() {
  const total = useGameStore((s) => s.totalEnemies)
  const killed = useGameStore((s) => s.totalEnemies - s.enemiesRemaining)
  const frac = total > 0 ? Math.min(1, killed / total) : 0
  return (
    <div className="hud-kills" aria-label={`${killed} of ${total} enemies`}>
      <div className="hud-kills-track">
        <div className="hud-kills-fill" style={{ transform: `scaleX(${frac})` }} />
      </div>
      <span className="hud-kills-count">
        {killed}
        <span className="hud-kills-total">/{total}</span>
      </span>
    </div>
  )
}

/**
 * In-play HUD. The root only subscribes to the current level, so it renders once
 * per level; each widget subscribes to its own store slice (see ScoreDisplay for
 * the rAF score tween).
 */
export default function HUD() {
  const currentLevel = useGameStore((s) => s.currentLevel)
  const config = currentLevel ? getLevelConfig(currentLevel) : null
  const theme = biomeTheme(config?.biome)
  const style = useMemo(
    () => ({ '--hud-accent': theme.accent, '--hud-glow': theme.glow }) as CSSProperties,
    [theme],
  )

  // Escape key to pause, backtick (`) to freeze/unfreeze for screenshots
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useGameStore.getState()
      if (e.key === 'Escape') store.setPhase('paused')
      if (e.key === '`') store.setTimeScale(store.timeScale === 0 ? 1 : 0)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!config || !currentLevel) return null

  return (
    <div className="hud" style={style}>
      <div className="hud-panel hud-panel--left">
        <ScoreDisplay levelId={currentLevel} />
        <KillStrip />
      </div>
      <div className="hud-panel hud-panel--right">
        <TimerBar totalSeconds={config.timerSeconds} />
      </div>
      <BossBar />
      <FrenzyFlash />
      <ComboMeter />
      {/* Touch has no Escape key: an always-available pause button. */}
      <button
        className="hud-pause-button"
        onClick={() => useGameStore.getState().setPhase('paused')}
        aria-label="Pause"
        title="Pause (Esc)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      </button>
      {/* Crosshair rendered globally in App.tsx */}
    </div>
  )
}
