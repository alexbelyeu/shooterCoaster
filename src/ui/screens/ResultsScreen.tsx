import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'

export default function ResultsScreen() {
  const { score, currentLevel, setPhase, saveScore, startRun } = useGameStore()

  const config = currentLevel ? getLevelConfig(currentLevel) : undefined
  const saved = useRef(false)

  const stars = config ? computeStars(score, config.maxScore, config.starThresholds) : 0

  useEffect(() => {
    if (config && !saved.current) {
      saved.current = true
      saveScore({
        level: config.id,
        score,
        maxScore: config.maxScore,
        stars,
        timestamp: Date.now(),
      })
    }
  }, [config, score, stars, saveScore])

  if (!config) return null

  function replay() {
    startRun(config!.id)
  }

  function nextLevel() {
    if (config!.nextLevel) {
      startRun(config!.nextLevel)
    } else {
      setPhase('levelSelect')
    }
  }

  return (
    <div className="results-screen">
      <h2>{config.message}</h2>
      <p style={{ fontSize: '3rem', margin: '1rem 0' }}>
        {'★'.repeat(stars)}
        {'☆'.repeat(3 - stars)}
      </p>
      <p style={{ fontSize: '1.5rem' }}>
        Score: {Math.round(score)} / {config.maxScore}
      </p>
      <div className="results-actions">
        <button className="play-button" onClick={replay}>
          Replay
        </button>
        <button className="play-button" onClick={nextLevel}>
          {config.nextLevel ? 'Next Level' : 'Back to Menu'}
        </button>
      </div>
    </div>
  )
}
