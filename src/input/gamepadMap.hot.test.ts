import { describe, expect, it } from 'vitest'
import {
  MAX_STEP_S,
  STICK_DEADZONE,
  cursorSpeedPx,
  moveCursor,
  navActive,
  navDirection,
  navTarget,
  padAction,
  stickVelocity,
} from './gamepadMap.hot'
import { titleAction } from '@/ui/screens/titleKeys'

const v = () => ({ x: 0, y: 0 })

describe('stickVelocity', () => {
  it('reads zero inside the radial deadzone', () => {
    expect(stickVelocity(0.1, 0.1, v())).toEqual({ x: 0, y: 0 })
    expect(stickVelocity(STICK_DEADZONE, 0, v())).toEqual({ x: 0, y: 0 })
    expect(stickVelocity(Number.NaN, 0, v())).toEqual({ x: 0, y: 0 })
  })

  it('starts from zero at the deadzone edge, with no jump', () => {
    const out = stickVelocity(STICK_DEADZONE + 0.001, 0, v())
    expect(out.x).toBeGreaterThan(0)
    expect(out.x).toBeLessThan(1e-4)
  })

  it('gives full speed at full deflection and clamps a corner to the unit circle', () => {
    expect(stickVelocity(1, 0, v()).x).toBeCloseTo(1)
    const corner = stickVelocity(1, 1, v())
    expect(Math.hypot(corner.x, corner.y)).toBeCloseTo(1)
    expect(corner.x).toBeCloseTo(corner.y)
  })

  it('curves the response: half deflection is well under half speed, and keeps the direction', () => {
    const half = stickVelocity(0, -0.5, v())
    expect(half.x).toBe(0)
    expect(half.y).toBeLessThan(0)
    expect(-half.y).toBeLessThan(0.25)
    let prev = 0
    for (let m = 0.2; m <= 1; m += 0.05) {
      const s = stickVelocity(m, 0, v()).x
      expect(s).toBeGreaterThan(prev)
      prev = s
    }
  })
})

describe('moveCursor', () => {
  it('scales the speed with the viewport', () => {
    expect(cursorSpeedPx(1920, 1080)).toBe(2 * cursorSpeedPx(960, 540))
    const big = moveCursor({ x: 960, y: 540 }, { x: 1, y: 0 }, 0.02, 1920, 1080)
    const small = moveCursor({ x: 480, y: 270 }, { x: 1, y: 0 }, 0.02, 960, 540)
    expect(big.x - 960).toBeCloseTo(2 * (small.x - 480))
  })

  it('clamps to the screen', () => {
    expect(moveCursor({ x: 5, y: 5 }, { x: -1, y: -1 }, 0.05, 800, 600)).toEqual({ x: 0, y: 0 })
    expect(moveCursor({ x: 795, y: 595 }, { x: 1, y: 1 }, 0.05, 800, 600)).toEqual({ x: 799, y: 599 })
  })

  it('caps a long frame and ignores a negative one', () => {
    const capped = moveCursor({ x: 0, y: 0 }, { x: 1, y: 0 }, 2, 10000, 10000)
    expect(capped.x).toBeCloseTo(cursorSpeedPx(10000, 10000) * MAX_STEP_S)
    expect(moveCursor({ x: 50, y: 50 }, { x: 1, y: 1 }, -1, 100, 100)).toEqual({ x: 50, y: 50 })
  })
})

describe('menu navigation', () => {
  it('takes the d-pad first, then the left stick past its threshold on its dominant axis', () => {
    expect(navDirection(true, false, false, false, 1, 0)).toBe('ArrowUp')
    expect(navDirection(false, false, false, true, 0, 0)).toBe('ArrowRight')
    expect(navDirection(false, false, false, false, 0.3, 0.2)).toBeNull()
    expect(navDirection(false, false, false, false, -0.8, 0.3)).toBe('ArrowLeft')
    expect(navDirection(false, false, false, false, 0.2, 0.9)).toBe('ArrowDown')
  })

  it("never sends an arrow to an unfocused title, where it would start a run instead of moving focus", () => {
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map((key) =>
      titleAction({ key, repeat: false, ctrlKey: false, metaKey: false, altKey: false }),
    )
    expect(arrows).toEqual(['play', 'play', 'play', 'play'])
    expect(navTarget('title', false)).toBe('focus')
    expect(navTarget('title', true)).toBe('key')
    expect(navTarget('levelSelect', false)).toBe('key')
    expect(navTarget('paused', false)).toBe('key')
  })
})

describe('padAction', () => {
  it('Start pauses a run and resumes it', () => {
    expect(padAction('pause', 'playing', false)).toBe('pause')
    expect(padAction('pause', 'paused', true)).toBe('resume')
    expect(padAction('pause', 'title', false)).toBe('confirm')
    expect(padAction('pause', 'countdown', false)).toBeNull()
  })

  it('A confirms and B goes back on screens, not during play', () => {
    expect(padAction('confirm', 'levelSelect', false)).toBe('confirm')
    expect(padAction('back', 'levelSelect', false)).toBe('back')
    expect(padAction('back', 'results', false)).toBe('back')
    expect(padAction('confirm', 'playing', false)).toBeNull()
    expect(padAction('back', 'playing', false)).toBeNull()
    expect(padAction('back', 'countdown', false)).toBeNull()
  })

  it('B on the title only closes its Settings dialog (Escape there opens the worlds)', () => {
    expect(padAction('back', 'title', false)).toBeNull()
    expect(padAction('back', 'title', true)).toBe('back')
  })

  it('moves focus on screens only', () => {
    expect(navActive('paused')).toBe(true)
    expect(navActive('title')).toBe(true)
    expect(navActive('playing')).toBe(false)
    expect(navActive('intro')).toBe(false)
  })
})
