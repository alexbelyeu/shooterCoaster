import { useEffect, useRef, useState } from 'react'
import { m, PresenceContext, usePresence, type HTMLMotionProps } from 'framer-motion'

/** Longest a leaving screen holds the next one if its exit animation never reports done (the exits run 0.2–0.4 s). */
const EXIT_FALLBACK_MS = 1000

/**
 * One screen in App's `AnimatePresence mode="wait"`. framer's own exit only runs for a motion element whose animation
 * features were there when it started leaving; one whose features arrived later registers with the presence and never
 * completes it, so the next screen waits forever: the HUD mounted leaving as a run ended (#367), the title when
 * `LazyMotion`'s chunk landed as a run started (#938, #933). So the screen completes its own presence: it hides its
 * subtree from the presence (no motion element inside registers), plays `exit` as an `animate` target once it has
 * started an animation while present (its enter fade), and otherwise leaves at once.
 */
export default function Screen({ animate, exit, onAnimationStart, onAnimationComplete, ...props }: HTMLMotionProps<'div'>) {
  const [isPresent, safeToRemove] = usePresence()
  const [entered, setEntered] = useState(false)
  // The exit's own completion: an enter cut short by the exit reports complete too.
  const exitDefinition = useRef<unknown>(undefined)
  const animatesOut = entered && exit !== undefined

  useEffect(() => {
    if (isPresent || !safeToRemove) return
    if (!animatesOut) {
      safeToRemove()
      return
    }
    const fallback = setTimeout(safeToRemove, EXIT_FALLBACK_MS)
    return () => clearTimeout(fallback)
  }, [isPresent, animatesOut, safeToRemove])

  return (
    <PresenceContext.Provider value={null}>
      <m.div
        {...props}
        animate={isPresent ? animate : (exit as HTMLMotionProps<'div'>['animate'])}
        onAnimationStart={(definition) => {
          if (isPresent) setEntered(true)
          else exitDefinition.current = definition
          onAnimationStart?.(definition)
        }}
        onAnimationComplete={(definition) => {
          if (!isPresent && definition === exitDefinition.current) safeToRemove?.()
          onAnimationComplete?.(definition)
        }}
      />
    </PresenceContext.Provider>
  )
}
