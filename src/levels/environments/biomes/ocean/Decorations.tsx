import { useMemo } from 'react'
import type { BiomeDecorationsProps } from '../../shared/types'
import { ATMOSPHERES } from '../../atmosphere'
import { SUNKEN_CITY_POSITION } from './config'
import { layoutOcean } from './seaPlacement'
import SeaStacks from './SeaStacks'
import Seabirds from './Seabirds'
import Reef from './Reef'

const [CITY_X, , CITY_Z] = SUNKEN_CITY_POSITION

/** Sea stacks, breaching rocks with foam, gulls, and the reef under the water. */
export default function OceanDecorations({ groundFn, trackSamples }: BiomeDecorationsProps) {
  const layout = useMemo(
    () => layoutOcean(groundFn, trackSamples, [{ x: CITY_X, z: CITY_Z, r: 320 }]),
    [groundFn, trackSamples],
  )
  return (
    <>
      <SeaStacks stacks={layout.stacks} rocks={layout.rocks} fadeFar={ATMOSPHERES.ocean.fogFar} />
      <Seabirds orbits={layout.gulls} />
      <Reef coral={layout.coral} kelp={layout.kelp} />
    </>
  )
}
