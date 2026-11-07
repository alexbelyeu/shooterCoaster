/** index.html's `#poster` (#376): the title's still and logo, painted before any JS, until the canvas has drawn. */

/** Matches the `#poster.is-leaving` transition in index.html. */
const FADE_MS = 600

function poster(): HTMLElement | null {
  return document.getElementById('poster')
}

/** The poster is still up: the title screen lays its logo over the poster's instead of flying it in. */
export function posterShown(): boolean {
  return poster() !== null
}

/** The title UI has mounted over the poster: the poster's own logo and PLAY placeholder fade under it. */
export function handPosterToUi(): void {
  poster()?.classList.add('has-ui')
}

export function dismissPoster(): void {
  const el = poster()
  if (!el || el.classList.contains('is-leaving')) return
  el.classList.add('is-leaving')
  window.setTimeout(() => el.remove(), FADE_MS)
}
