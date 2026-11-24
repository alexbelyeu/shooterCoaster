/**
 * Build-time strip of a `.scrim` score's notes (`vite.config.ts`, `?raw` imports): the `#` comments and the `about`
 * line, prose the game never reads (`src/audio/scrim/score.ts` parses `about` but nothing shows it).
 * Comments follow the parser's own rule: a `#` at the start of a line or after whitespace runs to its end.
 * Lines left empty go too; the parser skips them. Only error messages' line numbers change, and the shipped scores have none.
 */
export function stripScrim(text) {
  return text
    .split('\n')
    .map((raw) => raw.replace(/(^|\s)#.*$/, '').trimEnd())
    .filter((line) => line.trim() !== '' && !/^about\b/i.test(line.trim()))
    .join('\n')
}
