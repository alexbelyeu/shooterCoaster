import { useMemo } from 'react'
import FerrisWheel from '../../FerrisWheel'
import Carousel from '../../Carousel'
import type { BiomeFeaturesProps } from '../../shared/types'
import { getThemeParkLayout } from './layout'
import { RIDES } from './parkSpec'
import EntranceArch from './EntranceArch'

/** Rides and the entrance arch for the theme park */
export default function ThemeParkFeatures({ heightFn, groundFn, track }: BiomeFeaturesProps) {
  const { arch } = useMemo(() => getThemeParkLayout(track, heightFn, groundFn), [track, heightFn, groundFn])
  return (
    <>
      {RIDES.map((r) => {
        const position: [number, number, number] = [r.x, groundFn(r.x, r.z), r.z]
        return r.kind === 'ferrisWheel' ? (
          <FerrisWheel key={`${r.x},${r.z}`} position={position} radius={r.radius} />
        ) : (
          <Carousel key={`${r.x},${r.z}`} position={position} radius={r.radius} />
        )
      })}
      {arch && <EntranceArch arch={arch} />}
    </>
  )
}
