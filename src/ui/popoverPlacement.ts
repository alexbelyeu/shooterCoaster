export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Placement {
  side: 'below' | 'above'
  /** Horizontal offset (px) from the anchor's left edge to the popover's left edge. */
  offsetX: number
}

const GAP = 8
const MARGIN = 8

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** Where a `width` x `height` popover goes beside `anchor`: centred on it, kept `MARGIN` inside the viewport, below
 *  when that fits and covers none of `avoid`, else above (or whichever side has more room when neither fits). */
export function placePopover(anchor: Box, width: number, height: number, viewport: { width: number; height: number }, avoid: Box[]): Placement {
  const centred = (anchor.left + anchor.right) / 2 - width / 2
  const left = Math.max(MARGIN, Math.min(viewport.width - MARGIN - width, centred))
  const below = { left, right: left + width, top: anchor.bottom + GAP, bottom: anchor.bottom + GAP + height }
  const above = { left, right: left + width, top: anchor.top - GAP - height, bottom: anchor.top - GAP }
  const fits = (b: Box) => b.top >= MARGIN && b.bottom <= viewport.height - MARGIN && !avoid.some((a) => overlaps(a, b))
  let side: Placement['side']
  if (fits(below)) side = 'below'
  else if (fits(above)) side = 'above'
  else side = viewport.height - anchor.bottom > anchor.top ? 'below' : 'above'
  return { side, offsetX: left - anchor.left }
}
