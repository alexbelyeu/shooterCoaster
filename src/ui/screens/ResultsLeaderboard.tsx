import { useEffect, useRef } from 'react'
import type { LeaderboardEntry } from '@/types/game'
import { LEADERBOARD_SIZE } from '@/store/leaderboard'
import { prefersReducedMotion } from '@/ui/reducedMotion'
import type { InitialsState } from './initialsEntry'

const fmt = new Intl.NumberFormat('en-US')

interface Props {
  board: readonly LeaderboardEntry[]
  rank: number | null
  editing: InitialsState | null
  onKey: (key: string) => void
  onSlot: (slot: number) => void
}

/** Local top 10 on the results screen; the run's row takes arcade initials (keys from ResultsScreen, buttons here for touch). */
export default function ResultsLeaderboard({ board, rank, editing, onKey, onSlot }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const isEditing = editing !== null

  // On a phone the board sits below the buttons: bring the entry into view when it opens.
  useEffect(() => {
    if (isEditing) rootRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [isEditing])

  // Keep focus off the pad, or Enter would press the focused arrow instead of confirming.
  const keep = (e: { preventDefault: () => void }) => e.preventDefault()
  const pad = (key: string, label: string, text: string, className?: string) => (
    <button type="button" className={className} aria-label={label} onMouseDown={keep} onClick={() => onKey(key)}>
      {text}
    </button>
  )

  return (
    <div ref={rootRef} className="results-board" data-rank={rank ?? undefined} data-editing={isEditing || undefined}>
      <h3>{rank !== null ? `New high score · #${rank + 1}` : 'Top 10'}</h3>
      {board.length === 0 ? (
        <p className="results-board-empty">No scores yet</p>
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
                <span className="results-board-stars" aria-label={`${e.stars} stars`}>
                  {'★'.repeat(e.stars)}
                </span>
                <strong>{fmt.format(e.score)}</strong>
              </li>
            )
          })}
        </ol>
      )}
      {editing && (
        <div className="results-initials-pad" role="group" aria-label="Enter your initials">
          {pad('ArrowLeft', 'Previous letter slot', '◀')}
          {pad('ArrowUp', 'Next letter', '▲')}
          {pad('ArrowDown', 'Previous letter', '▼')}
          {pad('ArrowRight', 'Next letter slot', '▶')}
          {pad('Enter', 'Confirm initials', 'OK', 'results-initials-ok')}
        </div>
      )}
    </div>
  )
}
