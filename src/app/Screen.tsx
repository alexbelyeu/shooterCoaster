import { useState } from 'react'
import { m, useIsPresent, type HTMLMotionProps } from 'framer-motion'

/**
 * One screen in App's `AnimatePresence mode="wait"` (#367). When an exit finishing and a phase change land in
 * the same React batch (a slow frame), framer's stale list of waiting screens mounts the screen that was
 * waiting to enter already leaving: the HUD as a run ends, so the results screen waited behind it forever.
 * A motion element mounted mid-exit never runs its exit, so the wait never ends. Mounted leaving, a screen
 * drops its `exit`: with nothing to wait for, its presence completes at once and the next screen mounts.
 */
export default function Screen({ exit, ...props }: HTMLMotionProps<'div'>) {
  const isPresent = useIsPresent()
  const [entered, setEntered] = useState(isPresent)
  if (isPresent && !entered) setEntered(true)
  return <m.div {...props} exit={entered ? exit : undefined} />
}
