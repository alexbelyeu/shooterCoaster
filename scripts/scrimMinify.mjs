/**
 * Build-time stripping of the score files (`*.scrim`, docs/audio/SCORE-FORMAT.md) the game imports as text
 * (vite.config.ts `minifyScrim`, builds only). Per line: drop the `#` comment the compiler drops
 * (`score.ts`: a `#` at the start or after a space), the indentation and runs of spaces, then the lines left
 * empty and the `about` line (the composer's notes: the compiler keeps it, nothing in the game reads it).
 * `scrimMinify.test.ts` holds every score's compiled song to its source's.
 */

/**
 * @param {string} text
 * @returns {string}
 */
export function minifyScrim(text) {
  return text
    .split('\n')
    .map((raw) => raw.replace(/(^|\s)#.*$/, '').trim().replace(/[ \t]+/g, ' '))
    .filter((line) => line && !/^about (?!\|)/.test(line))
    .join('\n')
}
