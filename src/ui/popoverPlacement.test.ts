import { describe, expect, it } from 'vitest'
import { placePopover, type Box } from './popoverPlacement'

const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h })
const desktop = { width: 1280, height: 720 }

describe('placePopover', () => {
  it('goes below, centred on the anchor, when there is room', () => {
    expect(placePopover(box(600, 300, 100, 44), 200, 150, desktop, [])).toEqual({ side: 'below', offsetX: -50 })
  })

  it('goes above when below runs off the screen or covers a button to avoid', () => {
    expect(placePopover(box(600, 600, 100, 44), 200, 150, desktop, []).side).toBe('above')
    const next = box(560, 410, 200, 44)
    expect(placePopover(box(600, 300, 100, 44), 200, 150, desktop, [next]).side).toBe('above')
  })

  it('keeps inside the viewport sideways', () => {
    expect(placePopover(box(10, 300, 80, 44), 272, 150, { width: 390, height: 844 }, [])).toEqual({ side: 'below', offsetX: -2 })
    const right = placePopover(box(320, 300, 60, 44), 272, 150, { width: 390, height: 844 }, [])
    expect(320 + right.offsetX + 272).toBe(390 - 8)
  })

  it('takes the roomier side when neither fits', () => {
    expect(placePopover(box(300, 50, 80, 44), 200, 400, { width: 844, height: 390 }, []).side).toBe('below')
    expect(placePopover(box(300, 300, 80, 44), 200, 400, { width: 844, height: 390 }, []).side).toBe('above')
  })
})
