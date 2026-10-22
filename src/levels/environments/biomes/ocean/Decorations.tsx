import { useMemo } from 'react'
import type { BiomeDecorationsProps } from '../../shared/types'
import { ATMOSPHERES } from '../../atmosphere'
import { SUNKEN_CITY_POSITION } from './config'
import { layoutOcean } from './seaPlacement'
import SeaStacks from './SeaStacks'
import Seabirds from './Seabirds'
import Reef from './Reef'

const [CITY_X, , CITY_Z] = SUNKEN_CITY_POSITION

export default function OceanDecorations({ groundFn, track }: BiomeDecorationsProps) {
  const layout = useMemo(
    () => layoutOcean(groundFn, track, [{ x: CITY_X, z: CITY_Z, r: 320 }]),
    [groundFn, track],
  )
  return (
    <>
      <SeaStacks stacks={layout.stacks} rocks={layout.rocks} fadeFar={ATMOSPHERES.ocean.fogFar} />
      <Seabirds orbits={layout.gulls} />
      <Reef coral={layout.coral} kelp={layout.kelp} />
    </>
  )
}
