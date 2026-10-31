import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { animate, motion } from 'framer-motion'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'
import { sfx } from '@/audio/sfx'
import { biomeTheme } from '@/ui/theme'
import { usePrefersReducedMotion } from '@/ui/reducedMotion'
import type { LeaderboardEntry } from '@/types/game'
import { barFill, formatAccuracy, formatTimeLeft, isNewRecord, nextStar } from './resultsStats'
import { initialsKey, type InitialsState } from './initialsEntry'
import ResultsLeaderboard from './ResultsLeaderboard'

const fmt = new Intl.NumberFormat('en-US')

const STAGE = { title: 0, count: 1, star: 2, stats: 5, done: 6 } as const
const STAGE_AT_MS = [0, 350, 1700, 2050, 2400, 2800, 3500]
const COUNT_UP_S = 1.2
const NO_BOARD: LeaderboardEntry[] = []

/** The finished run, read once on mount so a Replay / Next during the exit fade doesn't repaint it. */
function snapshotRun() {
  const s = useGameStore.getState()
  return {
    levelId: s.currentLevel,
    score: Math.round(s.score),
    kills: s.kills,
    totalEnemies: s.totalEnemies,
    hits: s.hits,
    shotsFired: s.shotsFired,
    bestCombo: s.bestCombo,
    timeRemaining: s.timeRemaining,
    previousBest: s.currentLevel ? (s.savedScores[s.currentLevel]?.score ?? 0) : 0,
    date: Date.now(),
  }
}

export default function ResultsScreen() {
  const [run] = useState(snapshotRun)
  const config = run.levelId ? getLevelConfig(run.levelId) : undefined
  const reducedMotion = usePrefersReducedMotion()
  const [stage, setStage] = useState<number>(reducedMotion ? STAGE.done : STAGE.title)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const saved = useRef(false)
  const board = useGameStore((s) => (run.levelId ? s.leaderboards[run.levelId] : undefined)) ?? NO_BOARD
  const [rank, setRank] = useState<number | null>(null)
  const [initials, setInitials] = useState<InitialsState | null>(null)
  const left = useRef(false)

  const stars = config ? computeStars(run.score, config.maxScore, config.starThresholds) : 0
  const fill = config ? barFill(run.score, config.maxScore) : 0
  const record = isNewRecord(run.score, run.previousBest)
  const counting = stage >= STAGE.count
  const done = stage >= STAGE.done

  /** Once only: the screen lingers through its exit fade. */
  function leave(levelId: string | null) {
    if (left.current) return
    left.current = true
    if (levelId) useGameStore.getState().startRun(levelId)
    else useGameStore.getState().setPhase('levelSelect')
  }

  // previousBest was read before this save, so the record check isn't fooled by it.
  // The leaderboard entry is stored now under the last initials, so leaving early never loses it.
  useEffect(() => {
    if (!config || saved.current) return
    saved.current = true
    const store = useGameStore.getState()
    const placed = store.addLeaderboardEntry(config.id, { score: run.score, stars, date: run.date })
    setRank(placed)
    if (placed !== null) setInitials({ letters: store.lastInitials, slot: 0 })
    store.saveScore({
      level: config.id,
      score: run.score,
      maxScore: config.maxScore,
      stars,
      timestamp: Date.now(),
      bestCombo: run.bestCombo,
    })
  }, [config, run, stars])

  useEffect(() => {
    if (done) return
    const timer = setTimeout(() => setStage(stage + 1), STAGE_AT_MS[stage + 1] - STAGE_AT_MS[stage])
    return () => clearTimeout(timer)
  }, [stage, done])

  useEffect(() => {
    const i = stage - STAGE.star
    if (i >= 0 && i < 3 && i < stars) sfx().starChime(i)
  }, [stage, stars])

  useEffect(() => {
    const scoreEl = scoreRef.current
    const fillEl = fillRef.current
    if (!scoreEl || !fillEl) return
    const paint = (v: number) => {
      scoreEl.textContent = fmt.format(Math.round(v))
      fillEl.style.width = `${(run.score > 0 ? v / run.score : 0) * fill * 100}%`
    }
    if (!counting) {
      paint(0)
      return
    }
    if (done) {
      paint(run.score)
      return
    }
    const controls = animate(0, run.score, { duration: COUNT_UP_S, ease: 'easeOut', onUpdate: paint })
    return () => controls.stop()
  }, [counting, done, run.score, fill])

  function initialsInput(key: string): boolean {
    if (!initials || !config) return false
    const next = initialsKey(initials, key)
    if (next === null) return false
    if (next === 'confirm') {
      setInitials(null)
      sfx().ui('launch')
      return true
    }
    if (next.letters !== initials.letters) useGameStore.getState().setEntryInitials(config.id, run.date, next.letters)
    setInitials(next)
    sfx().ui('select')
    return true
  }

  useEffect(() => {
    if (!config) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // A focused button already turns Enter into its own click.
      if (e.key === 'Enter' && e.target instanceof HTMLButtonElement) return
      if (initials) {
        // The entry owns the keys (R is a letter); Enter before it opens skips the reveal.
        if (!done) {
          if (e.key === 'Enter' && !e.repeat) setStage(STAGE.done)
        } else if (initialsInput(e.key)) {
          e.preventDefault()
        }
        return
      }
      if (e.repeat) return
      if (e.key === 'Enter') leave(config.nextLevel)
      else if (e.key === 'r' || e.key === 'R') leave(config.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!config) return null

  const theme = biomeTheme(config.biome)
  const next = nextStar(run.score, config.maxScore, config.starThresholds)
  const instant = { duration: 0 }
  const reveal = (from: number) => (stage >= from ? 'shown' : 'hidden')
  const entryOpen = done && initials !== null
  const rows: [string, string][] = [
    ['Kills', `${run.kills} / ${run.totalEnemies}`],
    ['Accuracy', formatAccuracy(run.hits, run.shotsFired)],
    ['Best combo', run.bestCombo > 0 ? `×${run.bestCombo}` : '—'],
    ['Time left', formatTimeLeft(run.timeRemaining)],
  ]

  return (
    <div
      className="results-screen"
      data-sequence={done ? 'done' : 'running'}
      style={{ '--accent': theme.accent, '--accent-glow': theme.glow } as CSSProperties}
      onPointerDown={() => {
        if (!done) setStage(STAGE.done)
      }}
    >
      <div className="results-card">
        <div className="results-main">
          <motion.h2
            initial={reducedMotion ? false : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? instant : { duration: 0.35 }}
          >
            {config.name}
          </motion.h2>
          <p className="results-message">{config.message}</p>

          <div className="results-stars" aria-label={`${stars} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="results-star">
                ☆
                {i < stars && (
                  <motion.span
                    className="results-star-earned"
                    initial={false}
                    variants={{ hidden: { scale: 0, opacity: 0, rotate: -40 }, shown: { scale: 1, opacity: 1, rotate: 0 } }}
                    animate={reveal(STAGE.star + i)}
                    transition={done ? instant : { type: 'spring', stiffness: 420, damping: 13 }}
                  >
                    ★
                  </motion.span>
                )}
              </span>
            ))}
          </div>

          <div className="results-score">
            <span ref={scoreRef} className="results-score-value">
              0
            </span>
            {record && (
              <motion.span
                className="results-record"
                initial={false}
                variants={{ hidden: { scale: 1.8, opacity: 0, rotate: -12 }, shown: { scale: 1, opacity: 1, rotate: -6 } }}
                animate={reveal(STAGE.stats)}
                transition={done ? instant : { type: 'spring', stiffness: 500, damping: 18 }}
              >
                NEW RECORD
              </motion.span>
            )}
          </div>
          {!record && run.previousBest > 0 && (
            <p className="results-best">Best {fmt.format(Math.round(run.previousBest))}</p>
          )}

          <div className="results-bar" role="presentation">
            <div ref={fillRef} className="results-bar-fill" />
            {config.starThresholds.map((t, i) => (
              <span
                key={i}
                className={`results-bar-marker${run.score >= t * config.maxScore ? ' reached' : ''}`}
                style={{ left: `${t * 100}%` }}
              >
                {'★'.repeat(i + 1)}
              </span>
            ))}
          </div>
          <p className="results-next" style={{ visibility: stage >= STAGE.stats ? 'visible' : 'hidden' }}>
            {next ? `${fmt.format(next.points)} pts to ${'★'.repeat(next.stars)}` : 'All stars!'}
          </p>
        </div>

        <div className="results-side">
          <ul className="results-stats">
            {rows.map(([label, value], i) => (
              <motion.li
                key={label}
                className="results-stat"
                initial={false}
                variants={{ hidden: { opacity: 0, x: -24 }, shown: { opacity: 1, x: 0 } }}
                animate={reveal(STAGE.stats)}
                transition={done ? instant : { duration: 0.25, delay: i * 0.08 }}
              >
                <span>{label}</span>
                <strong>{value}</strong>
              </motion.li>
            ))}
          </ul>

          <motion.div
            className="results-actions"
            initial={false}
            variants={{ hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0 } }}
            animate={reveal(STAGE.done)}
            transition={reducedMotion ? instant : { duration: 0.25 }}
            style={{ pointerEvents: done ? 'auto' : 'none' }}
          >
            <button className="play-button results-secondary" onClick={() => leave(null)}>
              Levels
            </button>
            <button className="play-button results-secondary" onClick={() => leave(config.id)}>
              Replay
            </button>
            {config.nextLevel && (
              <button className="play-button" onClick={() => leave(config.nextLevel)}>
                Next Level
              </button>
            )}
          </motion.div>
          <p className="results-keys">
            {entryOpen
              ? 'Type or ▲▼ letters · ◀▶ move · Enter: OK'
              : `${config.nextLevel ? 'Enter: next' : 'Enter: levels'} · R: replay`}
          </p>
        </div>

        <motion.div
          className="results-board-slot"
          initial={false}
          variants={{ hidden: { opacity: 0, x: 24 }, shown: { opacity: 1, x: 0 } }}
          animate={reveal(STAGE.stats)}
          transition={done ? instant : { duration: 0.3 }}
        >
          <ResultsLeaderboard
            board={board}
            rank={rank}
            editing={entryOpen ? initials : null}
            onKey={initialsInput}
            onSlot={(slot) => initials && setInitials({ ...initials, slot })}
          />
        </motion.div>
      </div>
    </div>
  )
}
