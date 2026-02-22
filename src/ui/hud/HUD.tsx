import { useEffect, useCallback } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'

export default function HUD() {
  const { score, currentLevel, timeRemaining, enemiesRemaining, totalEnemies, combo, setPhase } = useGameStore()
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
      {combo.count > 1 && (
        <div className="hud-combo">
          {combo.count}x Combo!
          <br />
          <span style={{ fontSize: '1rem' }}>{combo.multiplier.toFixed(1)}x</span>
        </div>
      )}
      {/* Crosshair rendered globally in App.tsx */}
    </>
  )
}
