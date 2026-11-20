import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type Ref } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'
import { dailyKey, dailyLevel, msUntilNextUtcDay } from '@/levels/daily'
import { biomeTheme } from '@/ui/theme'
import { FairBoard, FairStar, FairStars } from '@/ui/Fair'
import { prefersReducedMotion } from '@/ui/reducedMotion'
import { prepareSfx, sfx } from '@/audio/sfx'
import LevelPostcard from './LevelPostcard'
import {
  STARS_PER_LEVEL,
  buildDailyCard,
  buildLevelCards,
  initialFocusIndex,
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
  const isLevelUnlocked = useGameStore((s) => s.isLevelUnlocked)
  const savedDaily = useGameStore((s) => s.savedDaily)
  const dailyStreak = useGameStore((s) => s.dailyStreak)

  const cards = useMemo(
    () => buildLevelCards(getAllLevels(), savedScores, isLevelUnlocked, leaderboards),
    [savedScores, isLevelUnlocked, leaderboards],
  )
  const today = useUtcDayKey()
  const daily = useMemo(
    () => buildDailyCard(new Date(today), getAllLevels(), savedDaily, dailyStreak),
    [today, savedDaily, dailyStreak],
  )
  const dailyIndex = cards.length
  const total = totalStars(cards)

  const [launching, setLaunching] = useState<string | null>(null)
  const [focusIndex, setFocusIndex] = useState(() => initialFocusIndex(cards))
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const launchTimer = useRef<number | undefined>(undefined)

  // Mount only: start keyboard players on the next level to play.
  useEffect(() => {
    cardRefs.current[focusIndex]?.focus({ preventScroll: true })
    void prepareSfx(null, 'themePark')
  }, [])

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
      launch('daily', () => startRun(dailyLevel(dateKey), undefined, { mode: 'daily', dateKey }))
      return
    }
    const card = cards[i]
    if (!card) return
    if (!card.unlocked) {
      sfx().ui('back')
      if (!prefersReducedMotion()) cardRefs.current[i]?.animate(DENIED_SHAKE, { duration: 280, easing: 'ease-out' })
      return
    }
    launch(card.id, () => startRun(card.id))
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
          return (
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
                  ? `${card.name}: ${card.stars} of ${STARS_PER_LEVEL} stars${card.bestScore > 0 ? `, best ${card.bestScore}${card.bestInitials ? ` by ${card.bestInitials}` : ''}` : ''}`
                  : `${card.name}: locked${card.unlockedBy ? `, earn a star on ${card.unlockedBy}` : ''}`
              }
              onFocus={() => setFocusIndex(i)}
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
                    </span>
                  ) : (
                    <span className="level-card-locked-hint">
                      {card.unlockedBy ? `Opens with a star on ${card.unlockedBy}` : 'Not open yet'}
                    </span>
                  )}
                </span>
              </FairBoard>
            </button>
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
      </div>
    </div>
  )
}

interface DailyCardButtonProps {
  card: DailyCard
  ref: Ref<HTMLButtonElement>
  focused: boolean
  selected: boolean
  onFocus: () => void
  onClick: () => void
}

/** Today's Daily Run: a ticket rather than a ride board, its stub torn off along the perforation. */
function DailyCardButton({ card, ref, focused, selected, onFocus, onClick }: DailyCardButtonProps) {
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
