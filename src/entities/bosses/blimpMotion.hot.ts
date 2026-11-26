/**
 * The Golden Blimp fighting back (#1059): it weaves across the rider's view and dips, so the rider tracks its towed
 * balloons, and once they are gone the gondola's hatch opens only in windows, shut (no target) between them.
 */
import { inWindow, type ExposureWindow } from './bossCycle.hot'

export const BLIMP_HATCH: ExposureWindow = { first: 0, period: 3, openS: 2, rampS: 0.25 }

export const BLIMP_WEAVE = {
  /** Half-width across the rider's view and up and down, units; radians a second. */
  across: 110,
  up: 45,
  rate: 0.9,
} as const

/** Sideways weave on top of its slow crossing, 0 as it arrives. */
export function weaveAcross(age: number): number {
  return BLIMP_WEAVE.across * Math.sin(age * BLIMP_WEAVE.rate)
}

export function weaveUp(age: number): number {
  return BLIMP_WEAVE.up * Math.sin(age * BLIMP_WEAVE.rate * 1.6)
}

/** Whether the gondola is shut `sinceExposed` s after its last balloon fell (open at once, then on the hatch's beat). */
export function hatchShut(sinceExposed: number): boolean {
  return !inWindow(BLIMP_HATCH, sinceExposed)
}
