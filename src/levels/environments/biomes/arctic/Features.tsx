import type { BiomeFeaturesProps } from '../../shared/types'
import IceFortress from '../../IceFortress'
import Aurora from './Aurora'
import { FORTRESS_SITE } from './config'
import IceCave from './IceCave'

/** How much brighter the aurora burns per unit of the atmosphere's `lampGlow` (the polar night, #994). */
const NIGHT_AURORA = 0.08

export default function ArcticFeatures({ heightFn, groundFn, track, darkSections, atmosphere }: BiomeFeaturesProps) {
  return (
    <>
      <Aurora glow={1 + NIGHT_AURORA * (atmosphere.lampGlow ?? 0)} />
      {darkSections?.filter((s) => s.look === 'ice').map((s) => <IceCave key={s.from} table={track} section={s} groundFn={groundFn} />)}
      <IceFortress position={[FORTRESS_SITE.x, heightFn(FORTRESS_SITE.x, FORTRESS_SITE.z), FORTRESS_SITE.z]} />
    </>
  )
}
