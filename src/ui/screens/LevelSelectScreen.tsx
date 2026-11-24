import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type Ref } from 'react'
import { BOSS_RUSH, useGameStore } from '@/store/useGameStore'
import { getAllLevels, getLevelConfig } from '@/levels/LevelRegistry'
import { formatRushTime, rushStages, rushUnlocked } from '@/levels/bossRush'
import type { BiomeType } from '@/types/level'
import { dailyKey, dailyLevel, msUntilNextUtcDay } from '@/levels/daily'
import { biomeTheme } from '@/ui/theme'
import { FairBoard, FairMedal, FairStar, FairStars } from '@/ui/Fair'
import { levelMedals } from '@/levels/medals'
import { prefersReducedMotion } from '@/ui/reducedMotion'
import { prepareSfx, sfx } from '@/audio/sfx'
import LevelPostcard from './LevelPostcard'
import {
  STARS_PER_LEVEL,
  buildDailyCard,
  buildLevelCards,
  medalsLine,
  nextLevelIndex,
  isNavKey,
  navigateCards,
  totalStars,
  type DailyCard,
} from './levelSelectModel'

/** Card expand + fade before the run starts. */
const LAUNCH_MS = 300

const fmt = new Intl.NumberFormat('en-US')
/** The local date on the card ("Sat, Oct 31"); the run itself is the UTC day's, which the hint explains. */
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function rolloverHint(dateKey: string): string {
  const next = new Date(`${dateKey}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return `Same run for everyone today. New Daily Run at 00:00 UTC (${timeFmt.format(next)} your time)`
}

const DENIED_SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-6px)' },
  { transform: 'translateX(6px)' },
  { transform: 'translateX(-3px)' },
  { transform: 'translateX(0)' },
]

/** Today's UTC day key, turning over at midnight UTC while the screen stays open. */
function useUtcDayKey(): string {
  const [key, setKey] = useState(() => dailyKey(new Date()))
  useEffect(() => {
    // A little past midnight, so the new key is already today's when it fires.
    const id = window.setTimeout(() => setKey(dailyKey(new Date())), msUntilNextUtcDay(Date.now()) + 50)
    return () => window.clearTimeout(id)
  }, [key])
  return key
}

export default function LevelSelectScreen() {
  const startRun = useGameStore((s) => s.startRun)
  const setPhase = useGameStore((s) => s.setPhase)
  const savedScores = useGameStore((s) => s.savedScores)
  const leaderboards = useGameStore((s) => s.leaderboards)
  const savedMedals = useGameStore((s) => s.savedMedals)
  const isLevelUnlocked = useGameStore((s) => s.isLevelUnlocked)
  const savedDaily = useGameStore((s) => s.savedDaily)
  const dailyStreak = useGameStore((s) => s.dailyStreak)

  const cards = useMemo(
    () => buildLevelCards(getAllLevels(), savedScores, isLevelUnlocked, leaderboards, savedMedals, levelMedals),
    [savedScores, isLevelUnlocked, leaderboards, savedMedals],
  )
  const today = useUtcDayKey()
  const daily = useMemo(
    () => buildDailyCard(new Date(today), getAllLevels(), savedDaily, dailyStreak),
    [today, savedDaily, dailyStreak],
  )
  const dailyIndex = cards.length
  const rushIndex = dailyIndex + 1
  const total = totalStars(cards)
  const bossRushBest = useGameStore((s) => s.bossRushBest)
  const rush = useMemo(() => {
    const stages = rushStages(getAllLevels())
    return {
      first: stages[0].levelId,
      biome: getLevelConfig(stages[stages.length - 1].levelId)!.biome,
      bosses: stages.length,
      unlocked: rushUnlocked(getAllLevels(), (id) => savedScores[id]?.stars ?? 0),
    }
  }, [savedScores])

  const [launching, setLaunching] = useState<string | null>(null)
  /** Cards whose Night Ride toggle is down (#829): their next launch rides at night. */
  const [nightPicks, setNightPicks] = useState<ReadonlySet<string>>(() => new Set())
  const [focusIndex, setFocusIndex] = useState(() => nextLevelIndex(cards, useGameStore.getState().lastLevel))
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  /** The focused card's medal ticket hangs above it when the card sits in the screen's lower half, so it stays on screen. */
  const [featsAbove, setFeatsAbove] = useState(false)
  const launchTimer = useRef<number | undefined>(undefined)

  // Mount only: start keyboard players on the next level to play.
  useEffect(() => {
    cardRefs.current[focusIndex]?.focus({ preventScroll: true })
    void prepareSfx(null, 'themePark')
  }, [])

  useLayoutEffect(() => {
    const r = cardRefs.current[focusIndex]?.getBoundingClientRect()
    setFeatsAbove(!!r && r.top + r.height / 2 > window.innerHeight / 2)
  }, [focusIndex])

  /** A mouse over a card selects it, as the arrow keys do, so only one card's medal ticket is ever out. */
  function pointTo(e: PointerEvent<HTMLButtonElement>, i: number) {
    if (e.pointerType !== 'mouse' || launching || i === focusIndex) return
    setFocusIndex(i)
    cardRefs.current[i]?.focus({ preventScroll: true })
  }

  function back() {
    sfx().ui('back')
    setPhase('title')
  }

  useEffect(() => () => window.clearTimeout(launchTimer.current), [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !launching) back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [launching])

  function launch(key: string, start: () => void) {
    sfx().ui('launch')
    setLaunching(key)
    launchTimer.current = window.setTimeout(start, LAUNCH_MS)
  }

  function select(i: number) {
    if (launching) return
    if (i === dailyIndex) {
      // Today's key at the tap, not the card's: the screen may have been open since before midnight UTC.
      const dateKey = dailyKey(new Date())
      launch('daily', () => startRun(dailyLevel(dateKey), { mode: { mode: 'daily', dateKey } }))
      return
    }
    if (i === rushIndex) {
      if (rush.unlocked) launch('bossRush', () => startRun(rush.first, { mode: BOSS_RUSH }))
      else deny(i)
      return
    }
    const card = cards[i]
    if (!card) return
    if (!card.unlocked) {
      deny(i)
      return
    }
    const variant = card.nightRide && nightPicks.has(card.id) ? 'night' : 'day'
    launch(card.id, () => startRun(card.id, { variant }))
  }

  function deny(i: number) {
    sfx().ui('back')
    if (!prefersReducedMotion()) cardRefs.current[i]?.animate(DENIED_SHAKE, { duration: 280, easing: 'ease-out' })
  }

  function toggleNight(id: string) {
    if (launching) return
    sfx().ui('select')
    setNightPicks((picks) => {
      const next = new Set(picks)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function onGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // A held Enter from the title's PLAY must not click straight through to a level.
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      return
    }
    if (!isNavKey(e.key) || launching) return
    e.preventDefault()
    const rects = cardRefs.current.map((el) => {
      const r = el?.getBoundingClientRect()
      return { x: r?.left ?? 0, y: r?.top ?? 0, width: r?.width ?? 0, height: r?.height ?? 0 }
    })
    const next = navigateCards(rects, focusIndex, e.key)
    if (next !== focusIndex) sfx().ui('select')
    setFocusIndex(next)
    cardRefs.current[next]?.focus()
  }

  return (
    <div className={`level-select fair-stage${launching ? ' is-launching' : ''}`}>
      <header className="level-select-header">
        <button className="fair-plate level-select-back" onClick={back} disabled={!!launching}>
          Back
        </button>
        <h2 className="fair-title">Pick a ride</h2>
        <p className="level-select-total" data-stars={total.earned} aria-label={`${total.earned} of ${total.max} stars`}>
          <FairStar earned /> {total.earned} / {total.max}
        </p>
      </header>

      <div className="level-grid" role="group" aria-label="Levels" onKeyDown={onGridKeyDown}>
        {cards.map((card, i) => {
          const classes = ['level-card']
          if (!card.unlocked) classes.push('locked')
          if (launching === card.id) classes.push('is-selected')
          if (i === focusIndex) classes.push(featsAbove ? 'is-focused feats-above' : 'is-focused')
          const night = card.nightRide && nightPicks.has(card.id)
          const board = (
            <button
              key={card.id}
              ref={(el) => {
                cardRefs.current[i] = el
              }}
              type="button"
              className={classes.join(' ')}
              data-level={card.id}
              data-locked={card.unlocked ? undefined : 'true'}
              style={{ '--plate': biomeTheme(card.biome).accent } as CSSProperties}
              tabIndex={i === focusIndex ? 0 : -1}
              aria-disabled={!card.unlocked}
              aria-label={
                card.unlocked
                  ? `${card.name}${night ? ', Night Ride' : ''}: ${card.stars} of ${STARS_PER_LEVEL} stars${card.bestScore > 0 ? `, best ${card.bestScore}${card.bestInitials ? ` by ${card.bestInitials}` : ''}` : ''}, ${medalsLine(card.medals)}`
                  : `${card.name}: locked${card.unlockedBy ? `, earn a star on ${card.unlockedBy}` : ''}`
              }
              onFocus={() => setFocusIndex(i)}
              onPointerEnter={(e) => pointTo(e, i)}
              onClick={() => select(i)}
            >
              <FairBoard as="span" className="level-board" shadowClassName="level-board-shadow">
                <LevelPostcard biome={card.biome} boarded={!card.unlocked} />
                <span className="level-plate">{card.name}</span>
                <span className="level-card-body">
                  <span className="level-card-desc">{card.description}</span>
                  {card.unlocked ? (
                    <span className="level-card-meta">
                      <FairStars earned={card.stars} label={`${card.stars} of ${STARS_PER_LEVEL} stars`} />
                      <span className="level-card-best">
                        {card.bestScore > 0 ? `Best ${fmt.format(card.bestScore)}` : 'Not ridden yet'}
                        {card.bestScore > 0 && card.bestInitials && (
                          <span className="level-card-initials">{card.bestInitials}</span>
                        )}
                      </span>
                      <span className="level-medals" aria-hidden="true">
                        {card.medals.map((m) => (
                          <span key={m.id} className="level-medal" data-medal={m.id} data-earned={m.earned} title={`${m.name}. ${m.line}`}>
                            <FairMedal earned={m.earned} />
                          </span>
                        ))}
                      </span>
                    </span>
                  ) : (
                    <span className="level-card-locked-hint">
                      {card.unlockedBy ? `Opens with a star on ${card.unlockedBy}` : 'Not open yet'}
                    </span>
                  )}
                </span>
              </FairBoard>
              {card.unlocked && (
                // The medals' feats on a prize ticket (#978): under every board on a phone, under the focused one elsewhere.
                <span className="level-feats" aria-hidden="true">
                  {card.medals.map((m) => (
                    <span key={m.id} className="level-feat" data-earned={m.earned}>
                      <FairMedal earned={m.earned} />
                      <span className="level-feat-name">{m.name}</span>
                      <span className="level-feat-line">{m.line}</span>
                    </span>
                  ))}
                </span>
              )}
            </button>
          )
          if (!card.nightRide) return board
          // Its own plate under the board, not inside it: a button can't hold another.
          return (
            <div key={card.id} className="level-slot">
              {board}
              <button
                type="button"
                className="fair-plate level-night"
                aria-pressed={night}
                data-night={card.id}
                disabled={!!launching}
                onClick={() => toggleNight(card.id)}
              >
                Night Ride
              </button>
            </div>
          )
        })}
        <DailyCardButton
          card={daily}
          ref={(el) => {
            cardRefs.current[dailyIndex] = el
          }}
          focused={focusIndex === dailyIndex}
          selected={launching === 'daily'}
          onFocus={() => setFocusIndex(dailyIndex)}
          onClick={() => select(dailyIndex)}
        />
        <RushCardButton
          {...rush}
          best={bossRushBest}
          ref={(el) => {
            cardRefs.current[rushIndex] = el
          }}
          focused={focusIndex === rushIndex}
          selected={launching === 'bossRush'}
          onFocus={() => setFocusIndex(rushIndex)}
          onClick={() => select(rushIndex)}
        />
      </div>
    </div>
  )
}

interface TicketButtonProps {
  ref: Ref<HTMLButtonElement>
  focused: boolean
  selected: boolean
  onFocus: () => void
  onClick: () => void
}

/** Today's Daily Run: a ticket rather than a ride board, its stub torn off along the perforation. */
function DailyCardButton({ card, ref, focused, selected, onFocus, onClick }: TicketButtonProps & { card: DailyCard }) {
  const date = dateFmt.format(new Date())
  const best = card.bestScore > 0 ? `Best today ${fmt.format(card.bestScore)}` : 'Not played yet'
  const streak = card.streak > 0 ? `${card.streak}-day streak` : null
  return (
    <button
      ref={ref}
      type="button"
      className={`level-card level-card-daily${selected ? ' is-selected' : ''}`}
      data-daily={card.dateKey}
      tabIndex={focused ? 0 : -1}
      title={rolloverHint(card.dateKey)}
      aria-label={`Daily Run, ${date}: ${card.levelName}. ${best}${streak ? `, ${streak}` : ''}`}
      onFocus={onFocus}
      onClick={onClick}
    >
      <span className="level-ticket fair-notched">
        <span className="level-ticket-stub">
          <span className="level-ticket-title">Daily Run</span>
          <span className="level-ticket-date">{date}</span>
        </span>
        <LevelPostcard biome={card.biome} />
        <span className="level-card-body">
          <span className="level-card-desc">{card.levelName}, the same ride for everyone today</span>
          <span className="level-card-meta">
            <span className="level-card-best">{best}</span>
            {streak && <span className="level-card-streak">{streak}</span>}
          </span>
        </span>
      </span>
    </button>
  )
}

interface RushCardProps extends TicketButtonProps {
  biome: BiomeType
  bosses: number
  unlocked: boolean
  best: number | null
}

/** Boss Rush (#1011): the Daily Run's ticket for every boss back to back, shut until every level has its three stars. */
function RushCardButton({ biome, bosses, unlocked, best, ref, focused, selected, onFocus, onClick }: RushCardProps) {
  const bestLine = best === null ? 'No time yet' : `Best ${formatRushTime(best)}`
  return (
    <button
      ref={ref}
      type="button"
      className={`level-card level-card-rush${unlocked ? '' : ' locked'}${selected ? ' is-selected' : ''}`}
      data-rush={unlocked ? 'open' : 'locked'}
      tabIndex={focused ? 0 : -1}
      aria-disabled={!unlocked}
      aria-label={unlocked ? `Boss Rush: all ${bosses} bosses back to back. ${bestLine}` : 'Boss Rush: locked, earn 3 stars on every level'}
      onFocus={onFocus}
      onClick={onClick}
    >
      <span className="level-ticket fair-notched">
        <span className="level-ticket-stub">
          <span className="level-ticket-title">Boss Rush</span>
          <span className="level-ticket-date">{bosses} bosses</span>
        </span>
        <LevelPostcard biome={biome} />
        <span className="level-card-body">
          {unlocked ? (
            <>
              <span className="level-card-desc">Every boss back to back, against the clock</span>
              <span className="level-card-meta">
                <span className="level-card-best">{bestLine}</span>
              </span>
            </>
          ) : (
            <span className="level-card-locked-hint">3★ on every level opens it</span>
          )}
        </span>
      </span>
    </button>
  )
}
