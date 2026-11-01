import { useMemo } from 'react'
import type { BiomeFeaturesProps } from '../../shared/types'
import Pyramid from '../../Pyramid'
import RockArches from '../../RockArches'
import { ARCH_PILLAR_BASE_RADIUS, archFeet, PYRAMID_HALF_BASE, PYRAMID_HEIGHT } from '../../landmarkDimensions'
import { layoutDesert, MESA_HEIGHT } from './desertLayout'
import DustDevils from './DustDevils'
import { ARCHES, PYRAMID } from './landmarks'
import Mesas from './Mesas'
import SunFlare from './SunFlare'
import type { Occluder } from './sunOcclusion'
import { roundCaster, type ShadowCaster } from '../../shared/contactShadows'
import { useContactShadows } from '../../shared/ContactShadows'

/** The arches never move: their pillar shadows are built once. */
const ARCH_SHADOWS: ShadowCaster[] = ARCHES.flatMap((a) =>
  archFeet(a).map((f) => roundCaster(f.x, f.z, ARCH_PILLAR_BASE_RADIUS * a.scale, 0.5, 1)),
)

/** Desert landmarks, mesas the ride threads between, dust devils and the sun flare. */
export default function DesertFeatures({ heightFn, groundFn, track, atmosphere }: BiomeFeaturesProps) {
  const layout = useMemo(() => layoutDesert(groundFn, track), [groundFn, track])
  const pyramidY = heightFn(PYRAMID.x, PYRAMID.z)

  const occluders = useMemo<Occluder[]>(
    () => [
      { x: PYRAMID.x, z: PYRAMID.z, baseY: pyramidY, topY: pyramidY + PYRAMID_HEIGHT, baseR: PYRAMID_HALF_BASE, topR: 0 },
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

  useContactShadows(
    useMemo<ShadowCaster[]>(
      () => [
        { x: PYRAMID.x, z: PYRAMID.z, halfX: PYRAMID_HALF_BASE, halfZ: PYRAMID_HALF_BASE, spread: 70, strength: 0.5 },
        ...ARCH_SHADOWS,
        ...layout.mesas.map((m) => roundCaster(m.x, m.z, 120 * m.scale, 0.45, 0.35)),
      ],
      [layout],
    ),
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
