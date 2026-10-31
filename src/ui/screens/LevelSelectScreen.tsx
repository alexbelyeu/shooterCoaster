import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'
import { biomeTheme } from '@/ui/theme'
import { prefersReducedMotion } from '@/ui/reducedMotion'
import { prepareSfx, sfx } from '@/audio/sfx'
import LevelPostcard from './LevelPostcard'
import {
  STARS_PER_LEVEL,
  buildLevelCards,
  initialFocusIndex,
  isNavKey,
  navigateCards,
  totalStars,
} from './levelSelectModel'

/** Card expand + fade before the run starts. */
const LAUNCH_MS = 300

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
  const leaderboards = useGameStore((s) => s.leaderboards)
  const isLevelUnlocked = useGameStore((s) => s.isLevelUnlocked)

  const cards = useMemo(
    () => buildLevelCards(getAllLevels(), savedScores, isLevelUnlocked, leaderboards),
    [savedScores, isLevelUnlocked, leaderboards],
  )
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

  function select(i: number) {
    const card = cards[i]
    if (launching || !card) return
    if (!card.unlocked) {
      sfx().ui('back')
      if (!prefersReducedMotion()) cardRefs.current[i]?.animate(DENIED_SHAKE, { duration: 280, easing: 'ease-out' })
      return
    }
    sfx().ui('launch')
    setLaunching(card.id)
    launchTimer.current = window.setTimeout(() => startRun(card.id), LAUNCH_MS)
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
                  ? `${card.name}: ${card.stars} of ${STARS_PER_LEVEL} stars${card.bestScore > 0 ? `, best ${card.bestScore}${card.bestInitials ? ` by ${card.bestInitials}` : ''}` : ''}`
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
                      {card.bestScore > 0 ? `Best ${card.bestScore.toLocaleString('en-US')}` : 'New'}
                      {card.bestScore > 0 && card.bestInitials && (
                        <span className="level-card-initials">{card.bestInitials}</span>
                      )}
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
      </div>

      <button className="play-button level-select-back" onClick={back} disabled={!!launching}>
        Back
      </button>
    </div>
  )
}
