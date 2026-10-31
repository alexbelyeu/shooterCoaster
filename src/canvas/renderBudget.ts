/**
 * Canvas resolution and anti-aliasing budget (pure, unit-tested).
 *
 * The drawing buffer is sized by a pixel budget rather than a fixed dpr range, so
 * big or dense screens don't render more pixels than the GPU can fill. Phones and
 * tablets (coarse pointer) get a smaller budget and less MSAA. Formula from
 * mrdoob's slop-newyork (`nyc-map.js`). The graphics quality (`graphicsQuality.ts`)
 * sets the dpr cap and MSAA; the `auto` quality scales the budget down on slow frames.
 */

import type { QualityProfile } from './graphicsQuality'

/** Drawing-buffer pixels for mouse/trackpad screens (~2560×1640). */
export const PIXEL_BUDGET_FINE = 4_200_000
/** Drawing-buffer pixels for touch screens. */
export const PIXEL_BUDGET_COARSE = 1_500_000
export const MAX_DPR = 2
/** Never render below one buffer pixel per CSS pixel. */
export const MIN_DPR = 1

export function pixelBudget(coarsePointer: boolean): number {
  return coarsePointer ? PIXEL_BUDGET_COARSE : PIXEL_BUDGET_FINE
}

/** `min(deviceDpr, maxDpr, sqrt(budget / cssPixels))`, clamped to at least MIN_DPR. */
export function budgetDpr(deviceDpr: number, width: number, height: number, budget: number, maxDpr = MAX_DPR): number {
  const device = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1
  const capped = Math.min(device, maxDpr, MAX_DPR)
  const area = width * height
  if (!(area > 0)) return Math.max(MIN_DPR, capped)
  return Math.max(MIN_DPR, Math.min(capped, Math.sqrt(budget / area)))
}

/** EffectComposer MSAA samples (its default is 8). */
export function composerMultisampling(coarsePointer: boolean, profile: QualityProfile): number {
  return coarsePointer ? profile.multisampling.coarse : profile.multisampling.fine
}
