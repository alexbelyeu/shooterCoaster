export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Placement {
  side: 'below' | 'above'
  /** The popover's top-left corner in the viewport (px), for a `position: fixed` popover. */
  left: number
  top: number
}

const GAP = 8
const MARGIN = 8

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** Where a `width` x `height` popover goes beside `anchor`: centred on it, kept `MARGIN` inside the viewport, below
 *  when that fits and covers none of `avoid`, else above. A side whose box would cover a box in `avoid` (the gilt
 *  plate above or below Share) moves on past it, so on a phone the menu opens above Replay rather than over it. When
 *  neither side fits, it takes the roomier one and is held inside the viewport: it is `position: fixed` and closes
 *  on scroll, so nothing past the edge could be reached. */
export function placePopover(anchor: Box, width: number, height: number, viewport: { width: number; height: number }, avoid: Box[]): Placement {
  const centred = (anchor.left + anchor.right) / 2 - width / 2
  const left = Math.max(MARGIN, Math.min(viewport.width - MARGIN - width, centred))
  const at = (top: number): Box => ({ left, right: left + width, top, bottom: top + height })
  // Step past every avoided box the popover would cover, in the side's direction.
  const clear = (top: number, dir: 1 | -1): Box => {
    let b = at(top)
    for (let hit = avoid.find((a) => overlaps(a, b)); hit; hit = avoid.find((a) => overlaps(a, b))) {
      b = at(dir > 0 ? hit.bottom + GAP : hit.top - GAP - height)
    }
    return b
  }
  const fits = (b: Box) => b.top >= MARGIN && b.bottom <= viewport.height - MARGIN
  const free = (b: Box) => fits(b) && !avoid.some((a) => overlaps(a, b))
  // Right beside the anchor first, below then above; only then past the boxes in the way.
  const candidates: [Placement['side'], Box][] = [
    ['below', at(anchor.bottom + GAP)],
    ['above', at(anchor.top - GAP - height)],
    ['below', clear(anchor.bottom + GAP, 1)],
    ['above', clear(anchor.top - GAP - height, -1)],
  ]
  const found = candidates.find(([, b]) => free(b))
  if (found) return { side: found[0], left, top: found[1].top }
  const side: Placement['side'] = viewport.height - anchor.bottom > anchor.top ? 'below' : 'above'
  const top = Math.max(MARGIN, Math.min(viewport.height - MARGIN - height, candidates[side === 'below' ? 0 : 1][1].top))
  return { side, left, top }
}
