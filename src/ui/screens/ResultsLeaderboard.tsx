import { useEffect, useRef } from 'react'
import type { LeaderboardEntry } from '@/types/game'
import { LEADERBOARD_SIZE } from '@/store/leaderboard'
import { FairBoard, FairStars } from '@/ui/Fair'
import { prefersReducedMotion } from '@/ui/reducedMotion'
import { rankLabel } from '@/ui/share'
import type { InitialsState } from './initialsEntry'

const fmt = new Intl.NumberFormat('en-US')

interface Props {
  board: readonly LeaderboardEntry[]
  rank: number | null
  /** The online top 10 or this browser's own. */
  source: 'world' | 'device'
  editing: InitialsState | null
  onKey: (key: string) => void
  onSlot: (slot: number) => void
}

/** Which board it is, in a plain line under the title (the smoke checks this text). */
const BOARD_SOURCE_LINE = { world: "The world's top 10", device: "This device's top 10" } as const

/** The pad's arrows, drawn rather than typed: ◀ and ▶ turn into emoji on some phones. */
const ARROW_TURN = { ArrowUp: 0, ArrowRight: 90, ArrowDown: 180, ArrowLeft: 270 } as const

/**
 * The level's top 10 on the results screen, online or local, as the gallery's prize board; the run's local row takes
 * arcade initials in three ticket-counter tiles (keys from ResultsScreen, plates here for touch).
 */
export default function ResultsLeaderboard({ board, rank, source, editing, onKey, onSlot }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const isEditing = editing !== null

  // On a phone the board sits below the buttons: bring the entry into view when it opens.
  useEffect(() => {
    if (isEditing) rootRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [isEditing])

  // Keep focus off the pad, or Enter would press the focused arrow instead of confirming.
  const keep = (e: { preventDefault: () => void }) => e.preventDefault()
  const arrow = (key: keyof typeof ARROW_TURN, label: string) => (
    <button type="button" className="fair-plate" aria-label={label} onMouseDown={keep} onClick={() => onKey(key)}>
      <svg viewBox="0 0 20 20" aria-hidden="true" style={{ rotate: `${ARROW_TURN[key]}deg` }}>
        <path d="M10 3l7 12H3z" />
      </svg>
    </button>
  )

  return (
    <FairBoard
      ref={rootRef}
      className="results-board"
      shadowClassName="results-board-shadow"
      data-rank={rank ?? undefined}
      data-source={source}
      data-editing={isEditing || undefined}
    >
      <h3 className="fair-title">{rank !== null ? `You're ${rankLabel(rank)}!` : 'High scores'}</h3>
      <p className="results-board-source">{BOARD_SOURCE_LINE[source]}</p>
      {board.length === 0 ? (
        <p className="results-board-empty">No scores yet. Yours could be the first.</p>
      ) : (
        <ol>
          {board.slice(0, LEADERBOARD_SIZE).map((e, i) => {
            const mine = i === rank
            return (
              <li key={`${e.date}-${i}`} className={mine ? 'is-new' : undefined}>
                <span className="results-board-rank">{i + 1}</span>
                <span className="results-board-initials">
                  {mine && editing
                    ? [...editing.letters].map((ch, slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={slot === editing.slot ? 'is-active' : undefined}
                          aria-label={`Letter ${slot + 1}: ${ch}`}
                          onMouseDown={keep}
                          onClick={() => onSlot(slot)}
                        >
                          {ch}
                        </button>
                      ))
                    : e.initials}
                </span>
                <span className="results-board-stars">
                  <FairStars earned={e.stars} label={`${e.stars} stars`} />
                </span>
                <strong className="results-board-score">{fmt.format(e.score)}</strong>
              </li>
            )
          })}
        </ol>
      )}
      {editing && (
        <div className="results-initials-pad" role="group" aria-label="Enter your initials">
          {arrow('ArrowLeft', 'Previous letter slot')}
          {arrow('ArrowUp', 'Next letter')}
          {arrow('ArrowDown', 'Previous letter')}
          {arrow('ArrowRight', 'Next letter slot')}
          <button type="button" className="fair-plate results-initials-ok" aria-label="Confirm initials" onMouseDown={keep} onClick={() => onKey('Enter')}>
            OK
          </button>
        </div>
      )}
    </FairBoard>
  )
}
