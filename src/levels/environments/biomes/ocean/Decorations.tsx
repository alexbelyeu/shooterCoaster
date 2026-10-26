import { useMemo } from 'react'
import type { BiomeDecorationsProps } from '../../shared/types'
import { ATMOSPHERES } from '../../atmosphere'
import { SUNKEN_CITY_POSITION } from './config'
import { layoutOcean } from './seaPlacement'
import SeaStacks from './SeaStacks'
import Seabirds from './Seabirds'
import Reef from './Reef'
import { ROCK_FOOTPRINT, STACK_FOOTPRINT } from './seaDimensions'
import { roundCaster } from '../../shared/contactShadows'
import { useContactShadows } from '../../shared/ContactShadows'

const [CITY_X, , CITY_Z] = SUNKEN_CITY_POSITION

export default function OceanDecorations({ groundFn, track }: BiomeDecorationsProps) {
  const layout = useMemo(
    () => layoutOcean(groundFn, track, [{ x: CITY_X, z: CITY_Z, r: 320 }]),
    [groundFn, track],
  )
  // On the seabed: the water blends over them.
  useContactShadows(
    useMemo(
      () => [
        ...layout.stacks.map((s) => roundCaster(s.x, s.z, STACK_FOOTPRINT * s.scale, 0.55, 0.5)),
        ...layout.rocks.map((r) => roundCaster(r.x, r.z, ROCK_FOOTPRINT * r.scale, 0.55, 0.7)),
      ],
      [layout],
    ),
  )
  return (
    <>
      <SeaStacks stacks={layout.stacks} rocks={layout.rocks} fadeFar={ATMOSPHERES.ocean.fogFar} />
      <Seabirds orbits={layout.gulls} />
      <Reef coral={layout.coral} kelp={layout.kelp} />
    </>
  )
}
