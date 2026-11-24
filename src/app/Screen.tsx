import { useState } from 'react'
import { m, useIsPresent, type HTMLMotionProps } from 'framer-motion'

/**
 * One screen in App's `AnimatePresence mode="wait"`. A motion element whose animation features arrive while it is
 * already leaving registers for its exit but never runs it, so the next screen waits forever: the HUD mounted leaving
 * as a run ended (#367), the title when `LazyMotion`'s chunk landed in the render that started a run (#938, #933).
 * So a screen keeps its `exit` only once it has started an animation while present (its enter fade).
 */
export default function Screen({ exit, onAnimationStart, ...props }: HTMLMotionProps<'div'>) {
  const isPresent = useIsPresent()
  const [animated, setAnimated] = useState(false)
  return (
    <m.div
      {...props}
      exit={animated ? exit : undefined}
      onAnimationStart={(definition) => {
        if (isPresent) setAnimated(true)
        onAnimationStart?.(definition)
      }}
    />
  )
}
