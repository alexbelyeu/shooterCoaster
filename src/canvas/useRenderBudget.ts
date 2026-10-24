import { useEffect, useState } from 'react'
import { budgetDpr, composerMultisampling, pixelBudget } from './renderBudget'

/** Phones and tablets. Read once: a device's primary pointer doesn't change mid-session. */
export const isCoarsePointer =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

export const COMPOSER_MULTISAMPLING = composerMultisampling(isCoarsePointer)

function currentDpr(): number {
  return budgetDpr(window.devicePixelRatio, window.innerWidth, window.innerHeight, pixelBudget(isCoarsePointer))
}

/** Canvas dpr from the pixel budget; recomputed on resize. The canvas fills the window. */
export function useBudgetDpr(): number {
  const [dpr, setDpr] = useState(currentDpr)
  useEffect(() => {
    const update = () => setDpr(currentDpr())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return dpr
}
