/**
 * Pure gamepad rules (#819): stick math for the right-stick cursor, the d-pad / left stick's menu direction, and
 * which button does what in which phase. No DOM, no React; `gamepadInput.ts` reads the pad and applies them.
 * Everything here writes into caller-owned objects: it runs once per frame.
 */

import type { GamePhase } from '@/types/game'

/** Standard-mapping button indices (https://w3c.github.io/gamepad/#remapping). */
export const PAD = {
  A: 0,
  B: 1,
  RT: 7,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const

/** Stick deflection under this (radial) reads as zero: worn sticks rest at 0.05–0.12. */
export const STICK_DEADZONE = 0.15
/** Response curve exponent: small deflections aim finely, full deflection is still full speed. */
export const STICK_CURVE = 2
/** Full deflection moves the cursor this many viewport widths (the longer side) a second. */
export const CURSOR_SPEED_VIEWPORTS = 1.1
/** A frame longer than this (a hitch, a backgrounded tab) moves the cursor only this far. */
export const MAX_STEP_S = 0.05
/** RT's analog value at which the trigger counts as pulled. */
export const TRIGGER_THRESHOLD = 0.5
/** Left stick deflection that counts as a menu move. */
export const NAV_THRESHOLD = 0.5

export interface Vec2 {
  x: number
  y: number
}

/**
 * Stick axes → velocity in [-1, 1]²: a radial deadzone (the direction is kept, the magnitude is rescaled from the
 * deadzone's edge so there is no jump), clamped to the unit circle, then the response curve on the magnitude.
 */
export function stickVelocity(ax: number, ay: number, out: Vec2): Vec2 {
  const m = Math.hypot(ax, ay)
  if (!(m > STICK_DEADZONE)) {
    out.x = 0
    out.y = 0
    return out
  }
  const scaled = Math.min(1, (m - STICK_DEADZONE) / (1 - STICK_DEADZONE))
  const k = scaled ** STICK_CURVE / m
  out.x = ax * k
  out.y = ay * k
  return out
}

/** Cursor speed at full deflection, CSS px a second, for a viewport. */
export function cursorSpeedPx(width: number, height: number): number {
  return CURSOR_SPEED_VIEWPORTS * Math.max(width, height)
}

/** Move the cursor `pos` by velocity `vel` over `dt` seconds, clamped to the viewport. */
export function moveCursor(pos: Vec2, vel: Vec2, dt: number, width: number, height: number): Vec2 {
  const step = cursorSpeedPx(width, height) * Math.min(Math.max(dt, 0), MAX_STEP_S)
  pos.x = Math.min(Math.max(pos.x + vel.x * step, 0), Math.max(0, width - 1))
  pos.y = Math.min(Math.max(pos.y + vel.y * step, 0), Math.max(0, height - 1))
  return pos
}

export type NavKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

/** The menu direction from the d-pad (wins) or the left stick's dominant axis, or null. */
export function navDirection(up: boolean, down: boolean, left: boolean, right: boolean, lx: number, ly: number): NavKey | null {
  if (up !== down) return up ? 'ArrowUp' : 'ArrowDown'
  if (left !== right) return left ? 'ArrowLeft' : 'ArrowRight'
  const horizontal = Math.abs(lx) >= Math.abs(ly)
  const v = horizontal ? lx : ly
  if (Math.abs(v) < NAV_THRESHOLD) return null
  if (horizontal) return v < 0 ? 'ArrowLeft' : 'ArrowRight'
  return v < 0 ? 'ArrowUp' : 'ArrowDown'
}

export type PadAction = 'pause' | 'resume' | 'confirm' | 'back' | 'nav' | null

/** Phases where the face buttons and d-pad drive the screen's controls. Countdown is #818's (out of #819's scope). */
function inMenu(phase: GamePhase): boolean {
  return phase === 'title' || phase === 'levelSelect' || phase === 'paused' || phase === 'results' || phase === 'intro'
}

/**
 * What a button press does in a phase. Start pauses and resumes a run (the Escape key's store actions) and confirms
 * elsewhere; A confirms and B goes back on a screen. B on the title does nothing: Escape there opens the worlds,
 * which is forward, not back; with the title's Settings dialog open (`dialogOpen`) it closes it.
 */
export function padAction(button: number, phase: GamePhase, dialogOpen: boolean): PadAction {
  if (button === PAD.START) {
    if (phase === 'playing') return 'pause'
    if (phase === 'paused') return 'resume'
    return inMenu(phase) ? 'confirm' : null
  }
  if (!inMenu(phase)) return null
  if (button === PAD.A) return 'confirm'
  if (button === PAD.B) return phase === 'title' && !dialogOpen ? null : 'back'
  return null
}

/** Whether the d-pad / left stick moves focus in this phase. */
export function navActive(phase: GamePhase): boolean {
  return inMenu(phase) && phase !== 'intro'
}
