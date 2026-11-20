import type { HTMLAttributes, ReactNode, Ref } from 'react'

/**
 * The fair's shared pieces (docs/art/PERSONALITY.md): a painted board with notched ticket corners, lined out in gilt,
 * casting a hard shadow; and the gallery's star targets. Styles: the `fair-*` rules in `src/app/global.css`.
 */
export function FairBoard({ className = '', shadowClassName = '', ref, children, ...rest }: {
  className?: string
  shadowClassName?: string
  ref?: Ref<HTMLDivElement>
  children: ReactNode
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`fair-board-shadow ${shadowClassName}`.trim()}>
      <div ref={ref} className={`fair-board fair-notched ${className}`.trim()} {...rest}>
        <div className="fair-lining fair-notched" aria-hidden="true">
          <span className="fair-notched" />
        </div>
        {children}
      </div>
    </div>
  )
}

const STAR_PATH = 'M12 1.8l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9l7.1-.6z'

/** Three star targets, `earned` of them lit. */
export function FairStars({ earned, label }: { earned: number; label: string }) {
  return (
    <span className="fair-stars" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={i < earned ? 'earned' : undefined} aria-hidden="true">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  )
}
