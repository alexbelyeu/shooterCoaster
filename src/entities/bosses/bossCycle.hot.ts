import { smoothstep } from '@/utils/ease'
/** What the ground bosses share, pure and allocation-free per frame: exposure windows, when to move on, the rider's heading. */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export { smoothstep as smooth }

/** A window that opens every `period` s from `first` and stays open `openS`, easing in and out over `rampS`. */
export interface ExposureWindow {
  first: number
  period: number
  openS: number
  rampS: number
}

/** Time into the current window, negative before the first. */
export function windowCycle(w: ExposureWindow, t: number): number {
  const u = t - w.first
  return u < 0 ? u : u % w.period
}

export function inWindow(w: ExposureWindow, t: number): boolean {
  const u = windowCycle(w, t)
  return u >= 0 && u < w.openS
}

/** 0 closed … 1 open. */
export function windowAmount(w: ExposureWindow, t: number): number {
  const u = windowCycle(w, t)
  if (u < 0 || u >= w.openS) return 0
  return Math.min(smoothstep(u / w.rampS), smoothstep((w.openS - u) / w.rampS))
}

/** 0 while open. */
export function timeToWindow(w: ExposureWindow, t: number): number {
  const u = windowCycle(w, t)
  if (u < 0) return -u
  return u < w.openS ? 0 : w.period - u
}

/** The epoch that opens the next window now. */
export function windowNowEpoch(w: ExposureWindow, now: number): number {
  return now - w.first
}

/** Moves on after holding a spot `holdS`, or once it is under `minAhead` of the rider or `maxOffAngle` off its heading. */
export interface RelocateConfig {
  holdS: number
  minAhead: number
  maxOffAngle: number
}

/** `ahead` / `side`: its offset along the rider's heading and across it. */
export function needsRelocate(c: RelocateConfig, holdAge: number, ahead: number, side: number): boolean {
  return holdAge >= c.holdS || ahead < c.minAhead || Math.abs(Math.atan2(side, ahead)) > c.maxOffAngle
}

/** Seconds the rider's heading takes to follow its view: smooth through the loops. */
export const HEADING_TAU = 2.5

export interface FlatDir {
  x: number
  z: number
}

/** Eases the unit `heading` towards the flat unit forward (`fx`, `fz`) over `HEADING_TAU`; `snap` sets it outright. */
export function followHeading(heading: FlatDir, fx: number, fz: number, dt: number, snap: boolean): void {
  let x = fx
  let z = fz
  if (!snap) {
    const k = 1 - Math.exp(-dt / HEADING_TAU)
    const lx = heading.x + (fx - heading.x) * k
    const lz = heading.z + (fz - heading.z) * k
    const len = Math.hypot(lx, lz)
    if (len >= 1e-3) {
      x = lx / len
      z = lz / len
    }
  }
  heading.x = x
  heading.z = z
}

/** A heading that leads the rider's turn (`leadHeading`): the turn rate it has measured and the forward it measured it from. */
export interface LeadHeading extends FlatDir {
  /** Radians a second, positive turning from +x towards +z. */
  rate: number
  lastX: number
  lastZ: number
}

/** `leadHeading`'s time constants, seconds: the turn rate's smoothing, the heading's, and how far ahead of the view it aims. */
export interface LeadTiming {
  rateTau: number
  headingTau: number
  lead: number
}

/** A camera cut or a snap is not a turn: the measured rate stops here (radians a second). */
const MAX_LEAD_RATE = 2

/**
 * Eases `h` towards the flat unit forward (`fx`, `fz`) turned on by its measured turn rate × `lead`, so through a steady
 * turn (the park's finale helix, a turn a second) it holds where the rider is looking instead of trailing round behind:
 * a heading that only follows, over `HEADING_TAU`, lags a whole turn there. `snap` sets it to the forward, rate zero.
 */
export function leadHeading(h: LeadHeading, fx: number, fz: number, dt: number, snap: boolean, timing: LeadTiming): void {
  if (snap) {
    h.x = h.lastX = fx
    h.z = h.lastZ = fz
    h.rate = 0
  }
  if (snap || dt <= 0) return
  const turned = Math.atan2(h.lastX * fz - h.lastZ * fx, h.lastX * fx + h.lastZ * fz)
  const rate = Math.max(-MAX_LEAD_RATE, Math.min(MAX_LEAD_RATE, turned / dt))
  h.rate += (rate - h.rate) * (1 - Math.exp(-dt / timing.rateTau))
  h.lastX = fx
  h.lastZ = fz
  const a = h.rate * timing.lead
  const tx = fx * Math.cos(a) - fz * Math.sin(a)
  const tz = fx * Math.sin(a) + fz * Math.cos(a)
  const k = 1 - Math.exp(-dt / timing.headingTau)
  const x = h.x + (tx - h.x) * k
  const z = h.z + (tz - h.z) * k
  const len = Math.hypot(x, z)
  if (len < 1e-3) return
  h.x = x / len
  h.z = z / len
}
