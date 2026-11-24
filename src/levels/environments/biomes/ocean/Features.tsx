import type { BiomeFeaturesProps } from '../../shared/types'
import SunkenCity from '../../SunkenCity'
import { SUNKEN_CITY_POSITION } from './config'
import Whale from './Whale'
import Splashdown from './Splashdown'
import SeaArch from './SeaArch'

/** Ocean landmark, the splashdown into the ride's glass tunnel and the sea arch over its corkscrew (#865), and the whale that breaches across the ride when the level asks for one (#793). */
export default function OceanFeatures({ track, speeds, whale, seaArch }: BiomeFeaturesProps) {
  return (
    <>
      <SunkenCity position={SUNKEN_CITY_POSITION} />
      <Splashdown track={track} />
      {seaArch && <SeaArch spec={seaArch} />}
      {whale && <Whale track={track} speeds={speeds} spec={whale} />}
    </>
  )
}
