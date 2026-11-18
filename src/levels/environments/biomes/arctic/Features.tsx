import type { BiomeFeaturesProps } from '../../shared/types'
import IceFortress from '../../IceFortress'
import Aurora from './Aurora'
import { FORTRESS_SITE } from './config'

export default function ArcticFeatures({ heightFn }: BiomeFeaturesProps) {
  return (
    <>
      <Aurora />
      <IceFortress position={[FORTRESS_SITE.x, heightFn(FORTRESS_SITE.x, FORTRESS_SITE.z), FORTRESS_SITE.z]} />
    </>
  )
}
