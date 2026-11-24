import type { HTMLAttributes, ReactNode, Ref } from 'react'

/**
 * The fair's shared pieces (docs/art/PERSONALITY.md): a painted board with notched ticket corners, lined out in gilt,
 * casting a hard shadow; and the gallery's star targets. Styles: the `fair-*` rules in `src/app/global.css`.
 * `as="span"` builds the board from spans, so it can sit inside a button (level select's ride boards).
 */
export function FairBoard({ as: Tag = 'div', className = '', shadowClassName = '', ref, children, ...rest }: {
  as?: 'div' | 'span'
  className?: string
  shadowClassName?: string
  ref?: Ref<HTMLDivElement>
  children: ReactNode
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`fair-board-shadow ${shadowClassName}`.trim()}>
      <Tag ref={ref} className={`fair-board fair-notched ${className}`.trim()} {...rest}>
        <FairLining />
        {children}
      </Tag>
    </Tag>
  )
}

/** A board's gilt lining, made of spans so it is button-safe too. */
function FairLining() {
  return (
    <span className="fair-lining fair-notched" aria-hidden="true">
      <span className="fair-notched" />
    </span>
  )
}

const STAR_PATH = 'M12 1.8l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9l7.1-.6z'

/** One star target, lit or sunk into the board, painted by the `.fair-stars` rules (or a rule that borrows them). */
export function FairStar({ earned }: { earned: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={earned ? 'earned' : undefined} aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  )
}

/** Three star targets, `earned` of them lit. */
export function FairStars({ earned, label }: { earned: number; label: string }) {
  return (
    <span className="fair-stars" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <FairStar key={i} earned={i < earned} />
      ))}
    </span>
  )
}

/** A gallery prize medal on its ribbon: gilt with a tar edge when won, sunk into the board when not (`.fair-medal`). */
export function FairMedal({ earned }: { earned: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`fair-medal${earned ? ' earned' : ''}`} aria-hidden="true">
      <path className="fair-medal-ribbon" d="M8 12.5 5 22l3.2-1.6L10 23l2.2-9M16 12.5l3 9.5-3.2-1.6L14 23l-2.2-9" />
      <circle cx="12" cy="9" r="7.2" />
      <circle className="fair-medal-ring" cx="12" cy="9" r="4" />
    </svg>
  )
}
