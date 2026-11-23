import type { BiomeFeaturesProps } from '../../shared/types'
import IceFortress from '../../IceFortress'
import Aurora from './Aurora'
import { FORTRESS_SITE } from './config'
import IceCave from './IceCave'

export default function ArcticFeatures({ heightFn, groundFn, track, darkSections }: BiomeFeaturesProps) {
  return (
    <>
      <Aurora />
      {darkSections?.filter((s) => s.look === 'ice').map((s) => <IceCave key={s.from} table={track} section={s} groundFn={groundFn} />)}
      <IceFortress position={[FORTRESS_SITE.x, heightFn(FORTRESS_SITE.x, FORTRESS_SITE.z), FORTRESS_SITE.z]} />
    </>
  )
}
