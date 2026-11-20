/** What the ground bosses share, pure and allocation-free per frame: exposure windows, when to move on, the rider's heading. */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

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
  return Math.min(smooth(u / w.rampS), smooth((w.openS - u) / w.rampS))
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
