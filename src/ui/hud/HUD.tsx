import { useEffect, useCallback, memo } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'

const ComboDisplay = memo(function ComboDisplay() {
  const combo = useGameStore((s) => s.combo)
  const visible = combo.count > 1

  return (
    <div
      className="hud-combo"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {combo.count}x Combo!
      <br />
      <span style={{ fontSize: '1rem' }}>{combo.multiplier.toFixed(1)}x</span>
    </div>
  )
})

export default function HUD() {
  const score = useGameStore((s) => s.score)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const timeRemaining = useGameStore((s) => s.timeRemaining)
  const enemiesRemaining = useGameStore((s) => s.enemiesRemaining)
  const totalEnemies = useGameStore((s) => s.totalEnemies)
  const setPhase = useGameStore((s) => s.setPhase)

  const config = currentLevel ? getLevelConfig(currentLevel) : null

  // Escape key to pause
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPhase('paused')
      }
    },
    [setPhase],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!config) return null

  return (
    <>
      <div className="hud">
        <div>
          <div className="hud-score">
            Score: {Math.round(score)} / {config.maxScore}
          </div>
          <div className="hud-enemies">Enemies: {totalEnemies - enemiesRemaining} / {totalEnemies}</div>
        </div>
        <div className="hud-timer">
          {Math.ceil(timeRemaining)}s
        </div>
      </div>
      <ComboDisplay />
      {/* Crosshair rendered globally in App.tsx */}
    </>
  )
}
