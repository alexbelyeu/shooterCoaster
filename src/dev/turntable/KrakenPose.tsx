import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameTime } from '@/core/gameClock'
import { layTentacle } from '@/entities/bosses/Kraken'
import {
  KRAKEN_EYE_GEO, KRAKEN_EYE_MAT, KRAKEN_HEAD_GEO, KRAKEN_PAD_GEO, KRAKEN_PAD_MAT, KRAKEN_SEGMENT_GEO, KRAKEN_SKIN_MAT,
} from '@/entities/bosses/bossAssets'
import {
  KRAKEN_HEAD, KRAKEN_TENTACLE, createChain, headFrame, layChain, tentacleFrame, type HeadFrame, type TentacleFrame,
} from '@/entities/bosses/krakenMotion'

const T = KRAKEN_TENTACLE
const H = KRAKEN_HEAD
/** Behind and beside the head, each leaning outwards: in a fight they surface one by one around the rider instead. */
const RING = H.rx + 170
const TENTACLE_ANGLES = [-2.2, -1.1, Math.PI, 1.1, 2.2]

/**
 * The Kraken's parts in one place, posed by its real motion (`krakenMotion.ts`, `layTentacle`) on game time: the
 * fight scatters them around the rider's track, too far apart for a close-up.
 */
export default function KrakenPose() {
  const segmentsRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.Mesh>(null)
  const eyeRef = useRef<THREE.Mesh>(null)
  const pads = useRef<(THREE.Mesh | null)[]>([]).current
  const sim = useMemo(
    () => ({
      chain: createChain(),
      tentacle: { emerge: 0, bend: 0, yaw: 0 } as TentacleFrame,
      head: { emerge: 0, y: 0 } as HeadFrame,
    }),
    [],
  )

  useFrame(() => {
    const segments = segmentsRef.current
    if (!segments || !headRef.current || !eyeRef.current) return
    const tau = gameTime()
    TENTACLE_ANGLES.forEach((a, i) => {
      const f = tentacleFrame(sim.tentacle, tau, T.riseS + T.upS, i)
      const chain = layChain(sim.chain, f.emerge, f.bend)
      const out = a + f.yaw
      layTentacle(segments, i, chain, Math.sin(out), Math.cos(out), Math.sin(a) * RING, Math.cos(a) * RING, pads[i] ?? undefined)
    })
    segments.instanceMatrix.needsUpdate = true
    segments.boundingBox = null
    const pose = headFrame(sim.head, tau, H.riseS + H.upS, H.sinkS)
    headRef.current.position.y = pose.y
    eyeRef.current.position.set(0, pose.y + H.eyeUp, H.eyeOut)
  })

  return (
    <group>
      <instancedMesh ref={segmentsRef} args={[KRAKEN_SEGMENT_GEO, KRAKEN_SKIN_MAT, T.count * T.segments]} frustumCulled={false} />
      <mesh ref={headRef} geometry={KRAKEN_HEAD_GEO} material={KRAKEN_SKIN_MAT} />
      <mesh ref={eyeRef} geometry={KRAKEN_EYE_GEO} material={KRAKEN_EYE_MAT} />
      {TENTACLE_ANGLES.map((_, i) => (
        <mesh key={i} ref={(m) => void (pads[i] = m)} geometry={KRAKEN_PAD_GEO} material={KRAKEN_PAD_MAT} />
      ))}
    </group>
  )
}
