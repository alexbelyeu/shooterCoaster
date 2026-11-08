/** Score texts the score engine plays (docs/audio/SCORE-FORMAT.md): the title, one per level id, and the results screen. */
import title from './title.scrim?raw'
import level1 from './level1.scrim?raw'
import level2 from './level2.scrim?raw'
import level3 from './level3.scrim?raw'
import level4 from './level4.scrim?raw'
import level5 from './level5.scrim?raw'
import results from './results.scrim?raw'

/**
 * Theme options waiting on Alex's pick (`Listen:` issue, sound bible "taste gate"): `themes/<slot>.<name>.scrim`, keyed
 * `<slot>.<name>`. None right now. They never play by default: `?theme=<name>` puts one in its slot's place
 * (`themesFromQuery`). Once Alex picks, the winner replaces `<slot>.scrim` and the options are deleted.
 */
const THEME_OPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./themes/*.scrim', { query: '?raw', import: 'default', eager: true })).map(
    ([path, text]) => [path.slice('./themes/'.length, -'.scrim'.length), text],
  ),
)

export const SCORES: Record<string, string> = { title, level1, level2, level3, level4, level5, results, ...THEME_OPTIONS }

/** `?theme=neon,carousel` → `{ title: 'title.neon', level1: 'level1.carousel' }`: each named option replaces its slot's score; unknown names are ignored. */
export function themesFromQuery(search: string, options: readonly string[] = Object.keys(THEME_OPTIONS)): Record<string, string> {
  const themes: Record<string, string> = {}
  const names = new URLSearchParams(search).get('theme')?.split(',') ?? []
  for (const name of names) {
    const id = options.find((option) => option.endsWith(`.${name.trim()}`))
    if (id) themes[id.slice(0, id.indexOf('.'))] = id
  }
  return themes
}

const ACTIVE_THEMES = typeof location === 'undefined' ? {} : themesFromQuery(location.search)

/** The score that plays for `slot` ('title', a level id, 'results'): its theme option under `?theme=`, else its own. */
export function scoreIdFor(slot: string): string {
  return ACTIVE_THEMES[slot] ?? slot
}
