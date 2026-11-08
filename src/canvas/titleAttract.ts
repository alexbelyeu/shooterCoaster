/** Title attract mode (#419): the title screen turns it on after `ATTRACT_IDLE_MS` without input; the title camera reads it every frame. */

export const ATTRACT_IDLE_MS = 30_000

let attract = false

export function isTitleAttract(): boolean {
  return attract
}

export function setTitleAttract(on: boolean): void {
  attract = on
}

/** The pointer that ends attract mode swallows its own click (it only brings the menu back): armed on that pointerdown, spent by the next click or after `SWALLOW_MS`. */
const SWALLOW_MS = 1000
let swallowUntil = 0

export function armClickSwallow(now = performance.now()): void {
  swallowUntil = now + SWALLOW_MS
}

export function consumeClickSwallow(now = performance.now()): boolean {
  const armed = now < swallowUntil
  swallowUntil = 0
  return armed
}
