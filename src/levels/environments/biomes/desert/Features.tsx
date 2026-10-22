import { useMemo } from 'react'
import type { BiomeFeaturesProps } from '../../shared/types'
import Pyramid from '../../Pyramid'
import RockArches from '../../RockArches'
import { layoutDesert, MESA_HEIGHT } from './desertLayout'
import DustDevils from './DustDevils'
import { ARCHES, PYRAMID } from './landmarks'
import Mesas from './Mesas'
import SunFlare from './SunFlare'
import type { Occluder } from './sunOcclusion'

/** Desert landmarks, mesas the ride threads between, dust devils and the sun flare. */
export default function DesertFeatures({ heightFn, groundFn, track, atmosphere }: BiomeFeaturesProps) {
  const layout = useMemo(() => layoutDesert(groundFn, track), [groundFn, track])
  const pyramidY = heightFn(PYRAMID.x, PYRAMID.z)

  const occluders = useMemo<Occluder[]>(
    () => [
      { x: PYRAMID.x, z: PYRAMID.z, baseY: pyramidY, topY: pyramidY + PYRAMID.height, baseR: 400, topR: 0 },
      // The cliff, not the talus apron.
      ...layout.mesas.map((m) => ({
        x: m.x,
        z: m.z,
        baseY: m.y,
        topY: m.y + MESA_HEIGHT * m.scale,
        baseR: 100 * m.scale,
        topR: 57 * m.scale,
      })),
    ],
    [layout, pyramidY],
  )

  return (
    <>
      <Pyramid position={[PYRAMID.x, pyramidY, PYRAMID.z]} />
      <RockArches arches={ARCHES} />
      <Mesas mesas={layout.mesas} />
      <DustDevils devils={layout.devils} groundFn={groundFn} />
      <SunFlare
        sunDirection={atmosphere.sunDirection}
        sunColor={atmosphere.sky.sunColor}
        groundFn={groundFn}
        occluders={occluders}
      />
    </>
  )
}
