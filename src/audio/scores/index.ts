/** Score texts the `?audio=scrim` engine plays (docs/audio/SCORE-FORMAT.md): the title, one per level id, and the results screen. */
import title from './title.scrim?raw'
import level1 from './level1.scrim?raw'
import level2 from './level2.scrim?raw'
import level3 from './level3.scrim?raw'
import level4 from './level4.scrim?raw'
import level5 from './level5.scrim?raw'
import results from './results.scrim?raw'

export const SCORES: Record<string, string> = { title, level1, level2, level3, level4, level5, results }
