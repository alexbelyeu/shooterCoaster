import type { BiomeFeaturesProps } from '../../shared/types'
import SunkenCity from '../../SunkenCity'
import { SUNKEN_CITY_POSITION } from './config'
import Whale from './Whale'

/** Ocean landmark, and the whale that breaches across the ride when the level asks for one (#793). */
export default function OceanFeatures({ track, speeds, whale }: BiomeFeaturesProps) {
  return (
    <>
      <SunkenCity position={SUNKEN_CITY_POSITION} />
      {whale && <Whale track={track} speeds={speeds} spec={whale} />}
    </>
  )
}
