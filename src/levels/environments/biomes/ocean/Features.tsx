import type { BiomeFeaturesProps } from '../../shared/types'
import SunkenCity from '../../SunkenCity'
import { SUNKEN_CITY_POSITION } from './config'
import Whale from './Whale'

/** Ocean landmark and the whale that breaches across the ride (#793). */
export default function OceanFeatures({ track }: BiomeFeaturesProps) {
  return (
    <>
      <SunkenCity position={SUNKEN_CITY_POSITION} />
      <Whale track={track} />
    </>
  )
}
