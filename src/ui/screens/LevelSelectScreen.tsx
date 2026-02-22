import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'

export default function LevelSelectScreen() {
  const { setPhase, setCurrentLevel, resetScore, resetCombo, isLevelUnlocked, savedScores } =
    useGameStore()

  const levels = getAllLevels()

  function startLevel(levelId: string) {
    if (!isLevelUnlocked(levelId)) return
    resetScore()
    resetCombo()
    setCurrentLevel(levelId)
    setPhase('playing')
  }

  function getStars(levelId: string): number {
    return savedScores[levelId]?.stars ?? 0
  }

  return (
    <div className="level-select">
      <h2>Select World</h2>
      <div className="level-grid">
        {levels.map((level) => {
          const unlocked = isLevelUnlocked(level.id)
          const stars = getStars(level.id)
          const bestScore = savedScores[level.id]?.score ?? 0

          return (
            <div
              key={level.id}
              className={`level-card ${unlocked ? '' : 'locked'}`}
              onClick={() => startLevel(level.id)}
            >
              <h3>
                {unlocked ? '' : '🔒 '}
                {level.name}
              </h3>
              <p>{level.description}</p>
              {unlocked && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  {'★'.repeat(stars)}
                  {'☆'.repeat(3 - stars)}
                  {bestScore > 0 && ` ${bestScore}/${level.maxScore}`}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <button
        className="play-button"
        style={{ marginTop: '2rem' }}
        onClick={() => setPhase('title')}
      >
        Back
      </button>
    </div>
  )
}
