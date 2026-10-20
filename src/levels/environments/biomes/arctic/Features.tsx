import type { BiomeFeaturesProps } from '../../shared/types'
import IceFortress from '../../IceFortress'

/** Arctic landmark */
export default function ArcticFeatures({ heightFn }: BiomeFeaturesProps) {
  return <IceFortress position={[2200, heightFn(2200, -1200), -1200]} />
}
