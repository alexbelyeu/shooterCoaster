import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { animate, motion } from 'framer-motion'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars, nextStar } from '@/levels/scoring'
import { sfx } from '@/audio/sfx'
import { biomeTheme } from '@/ui/theme'
import { usePrefersReducedMotion } from '@/ui/reducedMotion'
import { SHARED_EVENT } from '@/app/analyticsEvents'
import { eventBus } from '@/core/EventBus'
import { shareMethod, sharePayload, sharePayloadForRun } from '@/ui/share'
import { barFill, formatAccuracy, formatTimeLeft, isNewRecord } from './resultsStats'

const fmt = new Intl.NumberFormat('en-US')

const STAGE = { title: 0, count: 1, star: 2, stats: 5, done: 6 } as const
const STAGE_AT_MS = [0, 350, 1700, 2050, 2400, 2800, 3500]
const COUNT_UP_S = 1.2
const COPIED_MS = 2000

/** The finished run, read once on mount so a Replay / Next during the exit fade doesn't repaint it. */
function snapshotRun() {
  const s = useGameStore.getState()
  const mode = s.runMode
  const previous = mode.mode === 'daily' ? s.savedDaily[mode.dateKey] : s.currentLevel ? s.savedScores[s.currentLevel] : undefined
  return {
    levelId: s.currentLevel,
    mode,
    score: Math.round(s.score),
    kills: s.kills,
    totalEnemies: s.totalEnemies,
    hits: s.hits,
    shotsFired: s.shotsFired,
    bestCombo: s.bestCombo,
    timeRemaining: s.timeRemaining,
    previousBest: previous?.score ?? 0,
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
  const left = useRef(false)
  const [copied, setCopied] = useState(false)
  const [share] = useState(() => (run.levelId ? sharePayloadForRun(run.levelId, run.score) : null))
  const canShare = share !== null && shareMethod(navigator, share) !== null

  const stars = config ? computeStars(run.score, config.maxScore, config.starThresholds) : 0
  const fill = config ? barFill(run.score, config.maxScore) : 0
  const record = isNewRecord(run.score, run.previousBest)
  const counting = stage >= STAGE.count
  const done = stage >= STAGE.done

  const daily = run.mode.mode === 'daily'
  /** No Next Level after a daily: it is one run, not a step in the campaign. */
  const nextLevel = daily ? null : (config?.nextLevel ?? null)
  // Read live: this run's own save (below) can be what unlocks it.
  const nextOpen = useGameStore((s) => nextLevel !== null && s.isLevelUnlocked(nextLevel))
  const enterTo = nextLevel === null ? 'levels' : nextOpen ? 'next' : 'replay'

  /** Once only, and the reveal stops: the screen lingers through its exit fade, over the next run's countdown. */
  function leave(to: 'levels' | 'replay' | 'next') {
    if (left.current) return
    left.current = true
    const store = useGameStore.getState()
    if (to === 'replay') store.restartRun()
    else if (to === 'next' && nextLevel) store.startRun(nextLevel)
    else store.setPhase('levelSelect')
  }

  // previousBest was read before this save, so the record check isn't fooled by it.
  useEffect(() => {
    if (!config || saved.current) return
    saved.current = true
    const entry = {
      level: config.id,
      score: run.score,
      maxScore: config.maxScore,
      stars,
      timestamp: Date.now(),
      bestCombo: run.bestCombo,
    }
    if (run.mode.mode === 'daily') useGameStore.getState().saveDailyScore(entry, run.mode.dateKey)
    else useGameStore.getState().saveScore(entry)
  }, [config, run, stars])

  useEffect(() => {
    if (done) return
    const timer = setTimeout(() => {
      if (!left.current) setStage(stage + 1)
    }, STAGE_AT_MS[stage + 1] - STAGE_AT_MS[stage])
    return () => clearTimeout(timer)
  }, [stage, done])

  useEffect(() => {
    const i = stage - STAGE.star
    if (!left.current && i >= 0 && i < 3 && i < stars) sfx().starChime(i)
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

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  async function onShare() {
    if (!share || !config) return
    const outcome = await sharePayload(navigator, share)
    if (outcome === 'copied') setCopied(true)
    if (outcome === 'shared' || outcome === 'copied') eventBus.emit(SHARED_EVENT, config.id, stars)
  }

  useEffect(() => {
    if (!config) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      // A focused results button turns Enter into its own click; one outside (the mute toggle) must not swallow it.
      if (e.key === 'Enter' && e.target instanceof HTMLButtonElement && e.target.closest('.results-screen')) return
      if (e.key === 'Enter') leave(enterTo)
      else if (e.key === 'r' || e.key === 'R') leave('replay')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config, nextLevel, enterTo])

  if (!config) return null

  const theme = biomeTheme(config.biome)
  const nextName = nextLevel ? (getLevelConfig(nextLevel)?.name ?? nextLevel) : null
  const next = nextStar(run.score, config.maxScore, config.starThresholds)
  const instant = { duration: 0 }
  const reveal = (from: number) => (stage >= from ? 'shown' : 'hidden')
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
      data-mode={run.mode.mode}
      style={{ '--accent': theme.accent, '--accent-glow': theme.glow } as CSSProperties}
      onPointerDown={() => {
        if (!done) setStage(STAGE.done)
      }}
    >
      <div className="results-card">
        <div className="results-main">
          {daily && <p className="results-daily-badge">Daily Run</p>}
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
                {daily ? 'NEW BEST' : 'NEW RECORD'}
              </motion.span>
            )}
          </div>
          {!record && run.previousBest > 0 && (
            <p className="results-best">
              {daily ? 'Best today' : 'Best'} {fmt.format(Math.round(run.previousBest))}
            </p>
          )}

          <div className="results-bar" role="presentation">
            <div ref={fillRef} className="results-bar-fill" />
            {config.starThresholds.map((t, i) => (
              <span
                key={i}
                className={`results-bar-marker${i < stars ? ' reached' : ''}`}
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
            <button className="play-button results-secondary" onClick={() => leave('levels')}>
              Levels
            </button>
            <button className="play-button results-secondary" onClick={() => leave('replay')}>
              Replay
            </button>
            {canShare && (
              <button className="play-button results-secondary results-share" onClick={onShare}>
                {copied ? 'Copied!' : 'Share'}
              </button>
            )}
            {nextOpen && (
              <button className="play-button" onClick={() => leave('next')}>
                Next Level
              </button>
            )}
          </motion.div>
          <p className="results-keys">
            {enterTo === 'next' && 'Enter: next · R: replay'}
            {enterTo === 'levels' && 'Enter: levels · R: replay'}
            {enterTo === 'replay' && `★ unlocks ${nextName} · Enter / R: replay`}
          </p>
        </div>
      </div>
    </div>
  )
}
