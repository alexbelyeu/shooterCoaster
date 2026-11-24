import { useEffect, useMemo, type CSSProperties } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels, getLevelConfig } from '@/levels/LevelRegistry'
import { rushStages } from '@/levels/bossRush'
import { biomeTheme } from '@/ui/theme'
import ScoreDisplay from './ScoreDisplay'
import TimerBar from './TimerBar'
import ComboMeter from './ComboMeter'
import FrenzyFlash from './FrenzyFlash'
import SnowSplat from './SnowSplat'
import BossBar from './BossBar'
import WeaponBadge from './WeaponBadge'
import BystanderHint from './BystanderHint'
import TrackRadar from './TrackRadar'
import { setTimeScaleOverride, timeScaleOverride } from '@/combat/slowMo.hot'

/** "5 of 86 hit" under the score. Renders on kills only. */
function KillStrip() {
  const total = useGameStore((s) => s.totalEnemies)
  const killed = useGameStore((s) => s.totalEnemies - s.enemiesRemaining)
  return (
    <div className="hud-kills">
      <span className="hud-kills-count">
        <span className="hud-kills-value">{killed}</span> of {total} hit
      </span>
    </div>
  )
}

/** "Boss 2 of 8" under the score on a Boss Rush stage (#1011), where there is nothing else to count. */
function RushStrip({ stage }: { stage: number }) {
  const stages = useMemo(() => rushStages(getAllLevels()).length, [])
  return (
    <div className="hud-kills" data-rush-stage={stage + 1}>
      <span className="hud-kills-count">
        Boss <span className="hud-kills-value">{stage + 1}</span> of {stages}
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
  const rushStage = useGameStore((s) => (s.runMode.mode === 'bossRush' ? s.runMode.stage : null))
  const config = currentLevel ? getLevelConfig(currentLevel) : null
  const theme = biomeTheme(config?.biome)
  const style = useMemo(
    () => ({ '--hud-accent': theme.accent, '--hud-glow': theme.glow }) as CSSProperties,
    [theme],
  )

  // Escape key to pause, backtick (`) to freeze/unfreeze for screenshots
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useGameStore.getState().setPhase('paused')
      if (e.key === '`') setTimeScaleOverride(timeScaleOverride() === 0 ? null : 0)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!config || !currentLevel) return null

  return (
    <div className="hud" style={style}>
      <div className="hud-panel hud-panel--left">
        <ScoreDisplay />
        {rushStage === null ? <KillStrip /> : <RushStrip stage={rushStage} />}
      </div>
      <div className="hud-panel hud-panel--right">
        <TimerBar />
      </div>
      <BossBar />
      <FrenzyFlash />
      <SnowSplat />
      <ComboMeter />
      <WeaponBadge />
      <BystanderHint levelId={currentLevel} />
      <TrackRadar levelId={currentLevel} />
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
