import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'
import { FairBoard, FairStars } from '@/ui/Fair'
import { PAUSE_MENU, pauseMenuFocus, type PauseMenuAction } from './pauseMenu'

const fmt = new Intl.NumberFormat('en-US')

interface PauseScreenProps {
  onSettings: () => void
}

/**
 * The stopped ride's board (docs/art/PERSONALITY.md): the level, how long was left, the score and stars so far, hits;
 * Resume (also Esc) as the one gilt plate, then Restart / Photo / Settings / Quit.
 */
export default function PauseScreen({ onSettings }: PauseScreenProps) {
  const levelId = useGameStore((s) => s.currentLevel)
  const score = useGameStore((s) => Math.round(s.score))
  const timeRemaining = useGameStore((s) => s.timeRemaining)
  const kills = useGameStore((s) => s.kills)
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
    else if (action === 'restart') store.restartRun('pause')
    else if (action === 'photo') store.setPhoto(true)
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

  const stars = computeStars(score, config.maxScore, config.starThresholds)
  const seconds = Math.max(0, Math.ceil(timeRemaining - 1e-6))

  return (
    <div className="pause-screen pause-menu fair-stage">
      <FairBoard
        className="pause-card"
        shadowClassName="pause-board-shadow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
      >
        <h2 id="pause-title" className="fair-title">
          {config.name}
        </h2>
        <p className="pause-state">
          Ride stopped with {seconds} {seconds === 1 ? 'second' : 'seconds'} to go
        </p>

        <div className="pause-run">
          <strong className="fair-number">{fmt.format(score)}</strong>
          <FairStars earned={stars} label={`${stars} of 3 stars so far`} />
          <p>Points</p>
          <p className="pause-hits" data-stat="hits">
            <b>{kills}</b> of {total} hit
          </p>
        </div>

        <div className="pause-actions" onKeyDown={onMenuKeyDown}>
          {PAUSE_MENU.map(({ action, label }, i) => (
            <button
              key={action}
              ref={(el) => {
                buttons.current[i] = el
              }}
              className={`fair-plate${action === 'resume' ? ' fair-go' : ''}`}
              onClick={() => run(action)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="pause-keys">Esc gets you back on. Arrows and Enter pick.</p>
      </FairBoard>
    </div>
  )
}
