import { useCallback, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { SHARK_BODY_GEO, SHARK_MAT } from './SharedEnemyAssets'

/**
 * Port of Sharks.js: circular orbit + lookAt(camera).
 * Original: position.z += 5*cos(time*theta)/theta, position.x += 5*sin(time*theta)/theta
 * Time was in milliseconds (/1000), we use seconds directly.
 */
export default function Shark(props: EnemyProps) {
  const theta = useMemo(() => Math.random() * Math.PI, [])
  const { camera } = useThree()

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.z += ((5 * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((5 * Math.sin(time * theta)) / theta) * dt
      mesh.lookAt(camera.position)
    },
    [theta, camera],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <mesh scale={[15, 15, 15]} geometry={SHARK_BODY_GEO} material={SHARK_MAT} />
    </EnemyBase>
  )
}
