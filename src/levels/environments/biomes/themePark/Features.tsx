import { useMemo } from 'react'
import FerrisWheel from '../../FerrisWheel'
import Carousel from '../../Carousel'
import type { BiomeFeaturesProps } from '../../shared/types'
import { getThemeParkLayout } from './layout'
import { RIDES } from './parkSpec'
import EntranceArch from './EntranceArch'
import Fireworks from '@/effects/Fireworks'
import type { Vec3 } from '@/effects/fireworks'

/** Rides, the entrance arch and the combo-streak fireworks (launched from the Ferris wheels and the arch) */
export default function ThemeParkFeatures({ heightFn, groundFn, track }: BiomeFeaturesProps) {
  const { arch } = useMemo(() => getThemeParkLayout(track, heightFn, groundFn), [track, heightFn, groundFn])
  const launchPads = useMemo(() => {
    const pads: Vec3[] = RIDES.filter((r) => r.kind === 'ferrisWheel').map((r) => ({ x: r.x, y: groundFn(r.x, r.z), z: r.z }))
    if (arch) pads.push({ x: arch.x, y: arch.groundY, z: arch.z })
    return pads
  }, [arch, groundFn])
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
      <Fireworks pads={launchPads} />
    </>
  )
}
