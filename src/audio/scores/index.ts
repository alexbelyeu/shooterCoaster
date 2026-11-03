/** Score texts the `?audio=scrim` engine plays (docs/audio/SCORE-FORMAT.md): the title, one per level id, and the results screen. */
import title from './title.scrim?raw'
import level1 from './level1.scrim?raw'
import level2 from './level2.scrim?raw'
import level3 from './level3.scrim?raw'
import level4 from './level4.scrim?raw'
import level5 from './level5.scrim?raw'
import results from './results.scrim?raw'
import titleNeon from './themes/title.neon.scrim?raw'
import titleHighway from './themes/title.highway.scrim?raw'
import titleFanfare from './themes/title.fanfare.scrim?raw'
import level1Calliope from './themes/level1.calliope.scrim?raw'
import level1Carousel from './themes/level1.carousel.scrim?raw'
import level1Ringmaster from './themes/level1.ringmaster.scrim?raw'

/**
 * Theme options waiting on Alex's pick (`Listen:` issue, sound bible "taste gate"), as `<slot>.<name>`. They never
 * play by default: `?audio=scrim&theme=<name>` puts one in its slot's place (`themesFromQuery`).
 */
const THEME_OPTIONS: Record<string, string> = {
  'title.neon': titleNeon,
  'title.highway': titleHighway,
  'title.fanfare': titleFanfare,
  'level1.calliope': level1Calliope,
  'level1.carousel': level1Carousel,
  'level1.ringmaster': level1Ringmaster,
}

export const SCORES: Record<string, string> = { title, level1, level2, level3, level4, level5, results, ...THEME_OPTIONS }

/** `?theme=neon,carousel` → `{ title: 'title.neon', level1: 'level1.carousel' }`: each named option replaces its slot's score; unknown names are ignored. */
export function themesFromQuery(search: string): Record<string, string> {
  const themes: Record<string, string> = {}
  const names = new URLSearchParams(search).get('theme')?.split(',') ?? []
  for (const name of names) {
    const id = Object.keys(THEME_OPTIONS).find((option) => option.endsWith(`.${name.trim()}`))
    if (id) themes[id.slice(0, id.indexOf('.'))] = id
  }
  return themes
}

const ACTIVE_THEMES = typeof location === 'undefined' ? {} : themesFromQuery(location.search)

/** The score that plays for `slot` ('title', a level id, 'results'): its theme option under `?theme=`, else its own. */
export function scoreIdFor(slot: string): string {
  return ACTIVE_THEMES[slot] ?? slot
}
