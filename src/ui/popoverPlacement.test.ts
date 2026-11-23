import { describe, expect, it } from 'vitest'
import { placePopover, type Box } from './popoverPlacement'

const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h })
const desktop = { width: 1280, height: 720 }

describe('placePopover', () => {
  it('goes below, centred on the anchor, when there is room', () => {
    expect(placePopover(box(600, 300, 100, 44), 200, 150, desktop, [])).toEqual({ side: 'below', left: 550, top: 352 })
  })

  it('goes above when below runs off the screen or covers a button to avoid', () => {
    expect(placePopover(box(600, 600, 100, 44), 200, 150, desktop, [])).toEqual({ side: 'above', left: 550, top: 600 - 8 - 150 })
    const next = box(560, 410, 200, 44)
    expect(placePopover(box(600, 300, 100, 44), 200, 150, desktop, [next]).side).toBe('above')
  })

  it('keeps inside the viewport sideways', () => {
    expect(placePopover(box(10, 300, 80, 44), 272, 150, { width: 390, height: 844 }, [])).toEqual({ side: 'below', left: 8, top: 352 })
    const right = placePopover(box(320, 300, 60, 44), 272, 150, { width: 390, height: 844 }, [])
    expect(right.left + 272).toBe(390 - 8)
  })

  it('takes the roomier side when neither fits', () => {
    expect(placePopover(box(300, 50, 80, 44), 200, 400, { width: 844, height: 390 }, []).side).toBe('below')
    expect(placePopover(box(300, 300, 80, 44), 200, 400, { width: 844, height: 390 }, []).side).toBe('above')
  })

  it('stays inside the viewport when neither side fits', () => {
    const phone = { width: 844, height: 390 }
    expect(placePopover(box(300, 100, 80, 44), 200, 250, phone, [])).toMatchObject({ side: 'below', top: 390 - 8 - 250 })
    expect(placePopover(box(300, 200, 80, 44), 200, 250, phone, [])).toMatchObject({ side: 'above', top: 8 })
    expect(placePopover(box(300, 100, 80, 44), 200, 500, phone, []).top).toBe(8)
  })

  it('opens past the gilt plate rather than over it when neither side of the anchor is free (phone results, #707)', () => {
    // Portrait 390x844: Replay spans the row above Levels / Share, there is no room below Share.
    const phone = { width: 390, height: 844 }
    const share = box(200, 600, 150, 48)
    const replay = box(40, 530, 310, 60)
    const p = placePopover(share, 300, 360, phone, [replay])
    expect(p).toEqual({ side: 'above', left: 390 - 8 - 300, top: 530 - 8 - 360 })
  })

  it('still sits right beside the anchor when that side is free', () => {
    const replay = box(560, 230, 200, 44)
    expect(placePopover(box(600, 300, 100, 44), 200, 150, desktop, [replay])).toEqual({ side: 'below', left: 550, top: 352 })
  })
})
