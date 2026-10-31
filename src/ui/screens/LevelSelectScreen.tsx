import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type Ref } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'
import { biomeTheme } from '@/ui/theme'
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

export default function LevelSelectScreen() {
  const startRun = useGameStore((s) => s.startRun)
  const setPhase = useGameStore((s) => s.setPhase)
  const savedScores = useGameStore((s) => s.savedScores)
  const isLevelUnlocked = useGameStore((s) => s.isLevelUnlocked)
  const savedDaily = useGameStore((s) => s.savedDaily)
  const dailyStreak = useGameStore((s) => s.dailyStreak)

  const cards = useMemo(
    () => buildLevelCards(getAllLevels(), savedScores, isLevelUnlocked),
    [savedScores, isLevelUnlocked],
  )
  const daily = useMemo(
    () => buildDailyCard(new Date(), getAllLevels(), savedDaily, dailyStreak),
    [savedDaily, dailyStreak],
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
    prepareSfx(null, 'themePark')
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
  })

  function launch(key: string, start: () => void) {
    sfx().ui('launch')
    setLaunching(key)
    launchTimer.current = window.setTimeout(start, LAUNCH_MS)
  }

  function select(i: number) {
    if (launching) return
    if (i === dailyIndex) {
      launch('daily', () => startRun(daily.levelId, undefined, { mode: 'daily', dateKey: daily.dateKey }))
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
    <div className={`level-select${launching ? ' is-launching' : ''}`}>
      <header className="level-select-header">
        <h2>Select World</h2>
        <p className="level-select-total" data-stars={total.earned} aria-label={`${total.earned} of ${total.max} stars`}>
          <span className="level-select-total-star">★</span> {total.earned} / {total.max}
        </p>
      </header>

      <div className="level-grid" role="group" aria-label="Levels" onKeyDown={onGridKeyDown}>
        {cards.map((card, i) => {
          const theme = biomeTheme(card.biome)
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
              style={{ '--accent': theme.accent, '--accent-glow': theme.glow } as CSSProperties}
              tabIndex={i === focusIndex ? 0 : -1}
              aria-disabled={!card.unlocked}
              aria-label={
                card.unlocked
                  ? `${card.name}: ${card.stars} of ${STARS_PER_LEVEL} stars${card.bestScore > 0 ? `, best ${card.bestScore}` : ''}`
                  : `${card.name}: locked${card.unlockedBy ? `, earn a star on ${card.unlockedBy}` : ''}`
              }
              onFocus={() => setFocusIndex(i)}
              onClick={() => select(i)}
            >
              <LevelPostcard biome={card.biome} />
              {!card.unlocked && (
                <span className="level-card-lock" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="5" y="10.5" width="14" height="10" rx="2" />
                    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" strokeWidth="2.4" />
                  </svg>
                </span>
              )}
              <span className="level-card-body">
                <span className="level-card-index">World {i + 1}</span>
                <span className="level-card-name">{card.name}</span>
                <span className="level-card-desc">{card.description}</span>
                {card.unlocked ? (
                  <span className="level-card-meta">
                    <span className="level-card-stars" data-stars={card.stars}>
                      {Array.from({ length: STARS_PER_LEVEL }, (_, s) => (
                        <span key={s} className={s < card.stars ? 'earned' : undefined}>
                          ★
                        </span>
                      ))}
                    </span>
                    <span className="level-card-best">
                      {card.bestScore > 0 ? `Best ${fmt.format(card.bestScore)}` : 'New'}
                    </span>
                  </span>
                ) : (
                  <span className="level-card-locked-hint">
                    Locked{card.unlockedBy ? ` — earn ★ on ${card.unlockedBy}` : ''}
                  </span>
                )}
              </span>
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

      <button className="play-button level-select-back" onClick={back} disabled={!!launching}>
        Back
      </button>
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

function DailyCardButton({ card, ref, focused, selected, onFocus, onClick }: DailyCardButtonProps) {
  const theme = biomeTheme(card.biome)
  const date = dateFmt.format(new Date())
  const best = card.bestScore > 0 ? `Best today ${fmt.format(card.bestScore)}` : 'Not played yet'
  const streak = card.streak > 0 ? `${card.streak}-day streak` : null
  return (
    <button
      ref={ref}
      type="button"
      className={`level-card level-card-daily${selected ? ' is-selected' : ''}`}
      data-daily={card.dateKey}
      style={{ '--accent': theme.accent, '--accent-glow': theme.glow } as CSSProperties}
      tabIndex={focused ? 0 : -1}
      title={rolloverHint(card.dateKey)}
      aria-label={`Daily Run, ${date}: ${card.levelName}. ${best}${streak ? `, ${streak}` : ''}`}
      onFocus={onFocus}
      onClick={onClick}
    >
      <LevelPostcard biome={card.biome} />
      <span className="level-card-daily-badge" aria-hidden="true">
        Daily
      </span>
      <span className="level-card-body">
        <span className="level-card-index">{date}</span>
        <span className="level-card-name">Daily Run</span>
        <span className="level-card-desc">{card.levelName}: the same run for everyone today</span>
        <span className="level-card-meta">
          <span className="level-card-best">{best}</span>
          {streak && <span className="level-card-streak">{streak}</span>}
        </span>
      </span>
    </button>
  )
}
