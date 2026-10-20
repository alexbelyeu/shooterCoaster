import type { BiomeFeaturesProps } from '../../shared/types'
import Pyramid from '../../Pyramid'
import RockArches from '../../RockArches'

/** Desert landmarks */
export default function DesertFeatures({ heightFn }: BiomeFeaturesProps) {
  return (
    <>
      <Pyramid position={[2000, heightFn(2000, -1600), -1600]} />
      <RockArches />
    </>
  )
}
