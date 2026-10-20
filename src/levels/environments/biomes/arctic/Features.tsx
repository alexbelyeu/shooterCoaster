import type { BiomeFeaturesProps } from '../../shared/types'
import IceFortress from '../../IceFortress'
import Aurora from './Aurora'

/** Arctic landmark + aurora sky band */
export default function ArcticFeatures({ heightFn }: BiomeFeaturesProps) {
  return (
    <>
      <Aurora />
      <IceFortress position={[2200, heightFn(2200, -1200), -1200]} />
    </>
  )
}
