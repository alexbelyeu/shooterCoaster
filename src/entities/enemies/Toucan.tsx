import type { EnemyProps } from './EnemyBase'
import FlapBird from './FlapBird'
import { TOUCAN_EYES_GEO, TOUCAN_GEO } from './SharedEnemyAssets'
import { TOUCAN_FLEE } from './slipAway.hot'

/** A jungle toucan (docs/art/ENEMIES.md, #870): the crow's flight under a big orange bill; one left too long once seen flies off (`TOUCAN_FLEE`, #1059). */
export default function Toucan(props: EnemyProps) {
  return <FlapBird {...props} flee={TOUCAN_FLEE} body={TOUCAN_GEO} eyes={TOUCAN_EYES_GEO} />
}
