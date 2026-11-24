import type { EnemyProps } from './EnemyBase'
import FlapBird from './FlapBird'
import { TOUCAN_EYES_GEO, TOUCAN_GEO } from './SharedEnemyAssets'

/** A jungle toucan (docs/art/ENEMIES.md, #870): the crow's flight under a big orange bill. */
export default function Toucan(props: EnemyProps) {
  return <FlapBird {...props} body={TOUCAN_GEO} eyes={TOUCAN_EYES_GEO} />
}
