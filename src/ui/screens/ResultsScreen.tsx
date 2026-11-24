import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { medalRun, runBest, useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { runNextStar } from '@/levels/scoring'
import { sfx } from '@/audio/sfx'
import { usePrefersReducedMotion } from '@/ui/reducedMotion'
import { SHARED_EVENT } from '@/app/analyticsEvents'
import { eventBus } from '@/core/EventBus'
import ShareMenu from '@/ui/ShareMenu'
import type { ShareMethod } from '@/ui/share'
import { scoreCardRun } from '@/ui/scoreCard'
import type { LeaderboardEntry } from '@/types/game'
import { onlineEndpoint, onlineLeaderboard, onlinePlan, runAccuracy, worldRows, type OnlineEntry } from '@/app/onlineLeaderboard'
import { isNewRecord, nextStarLine, runLines } from './resultsStats'
import { bystanderCount, bystanderNoun, bystanderType } from '@/combat/bystanders'
import { initialsKey, type InitialsState } from './initialsEntry'
import ResultsLeaderboard from './ResultsLeaderboard'
import ResultsMarquee from './ResultsMarquee'
import { FairBoard, FairMedal, FairStars } from '@/ui/Fair'
import { levelMedals, medalsWon } from '@/levels/medals'
import { isReloadDue, reloadIfDue } from '@/app/staleReload'
import { saveGhost } from '@/combat/ghost'
import { recording } from '@/combat/ghostTrack.hot'
import { useRidePhoto, type RidePhoto } from '@/store/ridePhoto'

const fmt = new Intl.NumberFormat('en-US')

const STAGE = { title: 0, count: 1, star: 2, stats: 5, done: 6 } as const
const STAGE_AT_MS = [0, 350, 1700, 2050, 2400, 2800, 3500]
const NO_BOARD: LeaderboardEntry[] = []

/** The finished run, read once on mount so a Replay / Next during the exit fade doesn't repaint it. */
function snapshotRun() {
  const s = useGameStore.getState()
  return {
    medals: s.currentLevel ? medalsWon(s.currentLevel, medalRun(s)) : [],
    levelId: s.currentLevel,
    runId: s.runId,
    mode: s.runMode,
    variant: s.runVariant,
    score: Math.round(s.score),
    kills: s.kills,
    totalEnemies: s.totalEnemies,
    hits: s.hits,
    shotsFired: s.shotsFired,
    bystandersHit: s.bystandersHit.length,
    bestCombo: s.bestCombo,
    timeRemaining: s.timeRemaining,
    previousBest: runBest(s)?.score ?? 0,
    seed: s.runSeed,
    date: Date.now(),
  }
}

/** Null on every build but scoaster.com's own. */
function worldBoard() {
  const endpoint = onlineEndpoint(__BUILT_ON_VERCEL__, window.location.search)
  return endpoint ? onlineLeaderboard(endpoint) : null
}

export default function ResultsScreen() {
  const [run] = useState(snapshotRun)
  // The on-ride photo (#701): kept once it arrives, so the print stays through the exit fade while the next run drops it.
  const livePhoto = useRidePhoto(run.runId)
  const [photo, setPhoto] = useState<RidePhoto | null>(livePhoto)
  if (livePhoto && livePhoto !== photo) setPhoto(livePhoto)
  const config = run.levelId ? getLevelConfig(run.levelId) : undefined
  const reducedMotion = usePrefersReducedMotion()
  const [stage, setStage] = useState<number>(reducedMotion ? STAGE.done : STAGE.title)
  /** Only when the reveal reaches the score on its own: a skipped or reduced-motion reveal lights the bulbs without it. */
  const [chase, setChase] = useState(false)
  const saved = useRef(false)
  const board = useGameStore((s) => (run.levelId ? s.leaderboards[run.levelId] : undefined)) ?? NO_BOARD
  const [rank, setRank] = useState<number | null>(null)
  const [initials, setInitials] = useState<InitialsState | null>(null)
  const [online] = useState(worldBoard)
  const [world, setWorld] = useState<{ board: LeaderboardEntry[]; rank: number | null } | null>(null)
  /** Once: on OK, or as the screen closes with the entry still open. */
  const submitOnline = useRef<((letters: string) => void) | null>(null)
  const lettersRef = useRef('')
  const left = useRef(false)
  const nextRef = useRef<HTMLButtonElement>(null)
  /** Only once the submission placed the run (#445): never block Share on it. */
  const worldRank = world?.rank ?? null
  const card = useMemo(() => (config ? scoreCardRun({ ...run, levelId: config.id, worldRank }) : null), [config, run, worldRank])

  const stars = card?.stars ?? 0
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
    // A chunk failed mid-session (#823, #888): the next screen loads fresh, its sign-off sent first.
    if (isReloadDue()) {
      submitOnline.current?.(lettersRef.current)
      if (reloadIfDue()) return
    }
    const store = useGameStore.getState()
    if (to === 'replay') store.restartRun('results')
    else if (to === 'next' && nextLevel) store.startRun(nextLevel, { from: 'results' })
    else store.setPhase('levelSelect')
  }

  // Saved on mount, after previousBest was read; the board entry goes in under the last initials so leaving early never loses it.
  useEffect(() => {
    if (!config || saved.current) return
    saved.current = true
    const store = useGameStore.getState()
    const entry = {
      level: config.id,
      score: run.score,
      maxScore: config.maxScore,
      stars,
      timestamp: run.date,
      bestCombo: run.bestCombo,
    }
    store.saveRunResult(entry)
    if (run.medals.length > 0) store.saveMedals(config.id, run.medals)
    const show = (top: OnlineEntry[], rank: number | null) => {
      if (!left.current) setWorld({ board: worldRows(top, config.maxScore, config.starThresholds), rank })
    }
    const submit = (letters: string, daily?: string) =>
      online
        ?.submit({
          level: config.id,
          initials: letters,
          score: run.score,
          seed: run.seed,
          kills: run.kills,
          accuracy: runAccuracy(run.hits, run.shotsFired),
          version: __APP_VERSION__,
          daily,
        })
        .then((result) => result && show(result.top, result.rank))

    // A daily stays off the campaign board and has no entry; only a new campaign best leaves a ghost.
    const daily = run.mode.mode === 'daily' ? run.mode.dateKey : null
    let placed: number | null = null
    if (daily === null) {
      if (record) saveGhost(config.id, recording)
      placed = store.addLeaderboardEntry(config.id, { score: run.score, stars, date: run.date })
      setRank(placed)
      if (placed !== null) setInitials({ letters: store.lastInitials, slot: 0 })
    }
    if (!online) return
    const plan = onlinePlan(config.id, daily, record, placed !== null)
    if (plan.kind === 'show') void online.top(plan.board).then((top) => top && show(top, null))
    else if (plan.kind === 'submitNow') void submit(store.lastInitials, plan.daily)
    else {
      lettersRef.current = store.lastInitials
      submitOnline.current = (letters) => {
        submitOnline.current = null
        void submit(letters)
      }
    }
  }, [config, run, stars, online, record])

  useEffect(() => () => submitOnline.current?.(lettersRef.current), [])

  useEffect(() => {
    if (done) return
    const timer = setTimeout(() => {
      if (left.current) return
      if (stage + 1 === STAGE.star) setChase(true)
      setStage(stage + 1)
    }, STAGE_AT_MS[stage + 1] - STAGE_AT_MS[stage])
    return () => clearTimeout(timer)
  }, [stage, done])

  useEffect(() => {
    const i = stage - STAGE.star
    if (!left.current && i >= 0 && i < 3 && i < stars) sfx().starChime(i)
  }, [stage, stars])

  function initialsInput(key: string): void {
    if (!initials || !config) return
    const next = initialsKey(initials, key)
    if (next === null) return
    if (next === 'confirm') {
      setInitials(null)
      sfx().ui('launch')
      submitOnline.current?.(initials.letters)
      return
    }
    lettersRef.current = next.letters
    if (next.letters !== initials.letters) useGameStore.getState().setEntryInitials(config.id, run.date, next.letters)
    setInitials(next)
    sfx().ui('select')
  }

  function onShared(method: ShareMethod) {
    if (config) eventBus.emit(SHARED_EVENT, config.id, method, daily)
  }

  // Read through a ref so the listener sees the live entry state without re-subscribing every render.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    if (!config) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target instanceof Element ? e.target : null
    // The open share menu's own keys (arrows, Esc) stay its own.
    if (target?.closest('.share-menu')) return
    if (initials) {
      // A pending entry owns every key it takes, even under a focused button and during the reveal:
      // preventDefault stops the button's click and MuteButton's S (R and S are letters).
      if (initialsKey(initials, e.key) === null) return
      e.preventDefault()
      // Enter before the entry opens skips the reveal; a held Enter never confirms it.
      if (e.key === 'Enter' && e.repeat) return
      if (!done) {
        if (e.key === 'Enter') setStage(STAGE.done)
      } else initialsInput(e.key)
      return
    }
    // A focused results button or share link turns Enter into its own click; one outside (the mute toggle) must not swallow it.
    if (e.key === 'Enter' && target?.closest('.results-screen button, .results-screen a')) return
    if (e.repeat) return
    if (e.key === 'Enter') leave(enterTo)
    else if (e.key === 'r' || e.key === 'R') leave('replay')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [])

  if (!config) return null

  const nextName = nextLevel ? (getLevelConfig(nextLevel)?.name ?? nextLevel) : null
  const next = runNextStar(run.score, config)
  const instant = { duration: 0 }
  const reveal = (from: number) => (stage >= from ? 'shown' : 'hidden')
  const entryOpen = done && initials !== null
  const starsShown = done ? stars : Math.max(0, Math.min(stars, stage - STAGE.star + 1))
  const bystanders = bystanderType(config.enemies)
  const lines = runLines({
    ...run,
    bystanders: bystanders && { noun: bystanderNoun(bystanders), total: bystanderCount(config.enemies), hit: run.bystandersHit },
  })
  const plates = [
    { to: 'next', label: 'Next Level', shown: nextOpen },
    { to: 'replay', label: 'Replay', shown: true },
    { to: 'levels', label: 'Levels', shown: true },
  ] as const
  const go = plates.find((p) => p.to === enterTo)
  const medals = levelMedals(config.id).filter((m) => run.medals.includes(m.id))

  return (
    <div
      className="results-screen fair-stage"
      data-sequence={done ? 'done' : 'running'}
      data-mode={run.mode.mode}
      onPointerDown={() => {
        if (!done) setStage(STAGE.done)
      }}
    >
      <div className={`results-card${photo ? ' has-photo' : ''}`}>
        <FairBoard className="results-panel" shadowClassName="results-panel-shadow fair-arrive" role="region" aria-labelledby="results-title">
          <div className="results-main">
            {daily && <p className="results-badge fair-showcard">Daily Run</p>}
            {run.variant === 'night' && <p className="results-badge fair-showcard">Night Ride</p>}
            <h2 id="results-title" className="fair-title">
              {config.name}
            </h2>
            <p className="results-message">{config.message}</p>

            <div className={`results-score${record ? ' has-record' : ''}`}>
              <ResultsMarquee score={run.score} stars={stars} counting={counting} lit={stage >= STAGE.star} chase={chase} done={done} />
              {record && stage >= STAGE.stats && (
                <span className="results-record fair-showcard">{daily ? 'New best' : 'New record'}</span>
              )}
            </div>

            <div className="results-stars">
              <FairStars earned={starsShown} label={`${stars} of 3 stars`} />
            </div>
            <p className="results-next" data-shown={stage >= STAGE.stats}>
              {nextStarLine(next, (n) => fmt.format(n))}
            </p>
            {medals.length > 0 && (
              <ul className="results-medals" data-shown={stage >= STAGE.stats} aria-label="Medals won this run">
                {medals.map((medal) => (
                  <li key={medal.id} className="results-medal fair-showcard" data-medal={medal.id} title={medal.line}>
                    <FairMedal earned />
                    {medal.name}
                  </li>
                ))}
              </ul>
            )}
            {!record && run.previousBest > 0 && (
              <p className="results-best">
                {daily ? "Today's best is" : 'Your best is'} {fmt.format(Math.round(run.previousBest))}
              </p>
            )}
          </div>

          <div className="results-side">
            <ul className="results-stats" data-shown={stage >= STAGE.stats}>
              {lines.map(({ stat, text }) => (
                <li key={stat} className="results-stat" data-stat={stat}>
                  {text}
                </li>
              ))}
            </ul>

            <div className="results-actions" data-shown={done}>
              {go && (
                <button ref={nextRef} className="fair-plate fair-go" onClick={() => leave(go.to)}>
                  {go.label}
                </button>
              )}
              {plates
                .filter((p) => p.shown && p !== go)
                .map((p) => (
                  <button key={p.to} className="fair-plate" onClick={() => leave(p.to)}>
                    {p.label}
                  </button>
                ))}
              {/* Not in a portal build (#254): its link would send the portal's players off to scoaster.com. */}
              {card && !__PORTAL_BUILD__ && <ShareMenu card={card} onShared={onShared} avoid={[nextRef]} prerender={done} photo={photo?.blob ?? null} />}
            </div>
            <p className="results-keys" data-shown={done}>
              {entryOpen && 'Type your initials or pick them with the arrows. Enter signs it.'}
              {!entryOpen && enterTo === 'next' && 'Enter rides on. R rides again.'}
              {!entryOpen && enterTo === 'levels' && 'Enter takes you to the levels. R rides again.'}
              {!entryOpen && enterTo === 'replay' && `A star unlocks ${nextName}. Enter or R rides again.`}
            </p>
          </div>
        </FairBoard>

        {photo && (
          <m.figure
            className="results-photo"
            initial={false}
            variants={{ hidden: { opacity: 0, y: -40, rotate: -16 }, shown: { opacity: 1, y: 0, rotate: -4 } }}
            animate={reveal(STAGE.stats)}
            transition={done ? instant : { type: 'spring', stiffness: 220, damping: 18 }}
          >
            <img src={photo.url} width={photo.width} height={photo.height} alt={`On-ride photo: ${config.name}`} />
            <figcaption>On-ride photo</figcaption>
          </m.figure>
        )}

        {(!daily || world) && (
          <m.div
            className="results-board-slot"
            initial={false}
            variants={{ hidden: { opacity: 0, x: 24 }, shown: { opacity: 1, x: 0 } }}
            animate={reveal(STAGE.stats)}
            transition={done ? instant : { duration: 0.3 }}
          >
            <ResultsLeaderboard
              board={world?.board ?? board}
              rank={world ? world.rank : rank}
              source={daily ? 'today' : world ? 'world' : 'device'}
              editing={entryOpen ? initials : null}
              onKey={initialsInput}
              onSlot={(slot) => initials && setInitials({ ...initials, slot })}
            />
          </m.div>
        )}
      </div>
    </div>
  )
}
