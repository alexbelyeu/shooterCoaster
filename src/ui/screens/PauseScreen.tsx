import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'
import { biomeTheme } from '@/ui/theme'
import { formatTimeLeft } from './resultsStats'
import { PAUSE_MENU, pauseMenuFocus, type PauseMenuAction } from './pauseMenu'

const fmt = new Intl.NumberFormat('en-US')

interface PauseScreenProps {
  onSettings: () => void
}

/** The frozen run's card: level, score, stars so far, time left; Resume (also Esc) / Restart / Settings / Quit. */
export default function PauseScreen({ onSettings }: PauseScreenProps) {
  const levelId = useGameStore((s) => s.currentLevel)
  const score = useGameStore((s) => Math.round(s.score))
  const timeRemaining = useGameStore((s) => s.timeRemaining)
  const killed = useGameStore((s) => s.totalEnemies - s.enemiesRemaining)
  const total = useGameStore((s) => s.totalEnemies)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const config = levelId ? getLevelConfig(levelId) : undefined

  useEffect(() => {
    buttons.current[0]?.focus({ preventScroll: true })
  }, [])

  // On window: Esc resumes with nothing focused too.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.repeat) useGameStore.getState().resume()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function run(action: PauseMenuAction) {
    const store = useGameStore.getState()
    if (action === 'resume') store.resume()
    else if (action === 'restart') store.restartRun()
    else if (action === 'settings') onSettings()
    else if (action === 'quit') store.setPhase('levelSelect')
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const from = buttons.current.findIndex((b) => b === document.activeElement)
    const to = pauseMenuFocus(Math.max(from, 0), e.key, PAUSE_MENU.length)
    if (to === null) return
    e.preventDefault()
    buttons.current[to]?.focus()
  }

  if (!config) return null

  const theme = biomeTheme(config.biome)
  const stars = computeStars(score, config.maxScore, config.starThresholds)

  return (
    <div
      className="pause-screen pause-menu"
      style={{ '--accent': theme.accent, '--accent-glow': theme.glow } as CSSProperties}
    >
      <div className="pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <p className="pause-label">Paused</p>
        <h2 id="pause-title">{config.name}</h2>

        <div className="pause-run">
          <div className="pause-score">
            <strong>{fmt.format(score)}</strong>
            <span className="pause-stars" aria-label={`${stars} of 3 stars so far`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < stars ? 'earned' : undefined}>
                  ★
                </span>
              ))}
            </span>
          </div>
          <dl className="pause-stats">
            <div>
              <dt>Time left</dt>
              <dd>{formatTimeLeft(timeRemaining)}</dd>
            </div>
            <div>
              <dt>Kills</dt>
              <dd>
                {killed} / {total}
              </dd>
            </div>
          </dl>
        </div>

        <div className="pause-actions" onKeyDown={onMenuKeyDown}>
          {PAUSE_MENU.map(({ action, label }, i) => (
            <button
              key={action}
              ref={(el) => {
                buttons.current[i] = el
              }}
              className={`play-button${action === 'resume' ? '' : ' pause-secondary'}`}
              onClick={() => run(action)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="pause-keys">Esc: resume · ↑↓ + Enter</p>
      </div>
    </div>
  )
}
