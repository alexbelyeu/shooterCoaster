import type { EnemyProps } from './EnemyBase'
import FlapBird from './FlapBird'
import { CROW_EYES_GEO, CROW_GEO } from './SharedEnemyAssets'

/** A desert raven (docs/art/ENEMIES.md, #462). */
export default function Crow(props: EnemyProps) {
  return <FlapBird {...props} body={CROW_GEO} eyes={CROW_EYES_GEO} />
}
