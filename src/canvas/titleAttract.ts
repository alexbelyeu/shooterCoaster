/** Title attract mode (#419): the title screen turns it on after `ATTRACT_IDLE_MS` without input; the title camera reads it every frame. */

export const ATTRACT_IDLE_MS = 30_000

let attract = false

export function isTitleAttract(): boolean {
  return attract
}

export function setTitleAttract(on: boolean): void {
  attract = on
}
