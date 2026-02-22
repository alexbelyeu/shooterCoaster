import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'

export default function ResultsScreen() {
  const { score, currentLevel, setPhase, setCurrentLevel, saveScore, resetScore, resetCombo } =
    useGameStore()

  const config = currentLevel ? getLevelConfig(currentLevel) : undefined
  const saved = useRef(false)

  const pct = config ? score / config.maxScore : 0
  const stars = config
    ? pct >= config.starThresholds[2]
      ? 3
      : pct >= config.starThresholds[1]
        ? 2
        : pct >= config.starThresholds[0]
          ? 1
          : 0
    : 0

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
    resetScore()
    resetCombo()
    setPhase('playing')
  }

  function nextLevel() {
    if (config!.nextLevel) {
      resetScore()
      resetCombo()
      setCurrentLevel(config!.nextLevel)
      setPhase('playing')
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
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
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
