import { lazy, Suspense } from 'react'
import type { EnemyProps } from './EnemyBase'
import FlapBird from './FlapBird'
import { CROW_EYES_GEO, CROW_GEO } from './SharedEnemyAssets'
import { CROW_FLEE } from './slipAway.hot'

// The Blender crow spike (#1040): only in a build made with it (`npm run dev`, `SC_BLENDER_CROW=1 npm run build`), and
// there only with `?blenderCrow=1`. Every other build drops its chunk, its loader and the GLB.
const BlenderCrow = __BLENDER_CROW__ && new URLSearchParams(location.search).has('blenderCrow')
  ? lazy(() => import('./BlenderCrow'))
  : null

/** A desert raven (docs/art/ENEMIES.md, #462): one left too long once seen flies off (`CROW_FLEE`, #1059). */
export default function Crow(props: EnemyProps) {
  if (BlenderCrow) return <Suspense fallback={null}><BlenderCrow {...props} /></Suspense>
  return <FlapBird {...props} flee={CROW_FLEE} body={CROW_GEO} eyes={CROW_EYES_GEO} />
}
