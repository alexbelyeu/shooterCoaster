import { useCallback, useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { EnemyProps } from './EnemyBase'
import FlapBird from './FlapBird'
import { withRim } from './enemyRim'
import { BIRD_EYE_MAT, CROW_RIM } from './SharedEnemyAssets'
import crowUrl from './models/crow.glb?url'

/**
 * The Blender crow (#1040, a spike of #381 step 4): `models/crow.glb` from `tools/art/crow.py`, an organic skinned raven
 * whose `flap` clip is one wingbeat of the hand-coded crow's `birdWingPose`. It flies as the crow does (`FlapBird`),
 * its clip set to the flap phase each frame. Only behind `?blenderCrow=1` in a build that includes it (`Crow.tsx`).
 */

/** Smooth feathers, painted and occluded by the bake; one for every Blender crow (the skinning is per mesh). */
const FEATHER_MAT = withRim(new THREE.MeshPhysicalMaterial({
  vertexColors: true,
  metalness: 0.1,
  roughness: 0.7,
  iridescence: 0.3,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [200, 400],
}), CROW_RIM)

/** The clip's share of a wingbeat with the wings highest (`birdWingPose`'s arm at -0.55 rad): its hit pose. */
const WINGS_UP = 0.8216

/** Its own copy of the model (bones and skeletons; the geometry is shared), the feathers and eyes in the game's materials. */
function useCrowModel() {
  const gltf = useLoader(GLTFLoader, crowUrl)
  return useMemo(() => {
    const root = clone(gltf.scene)
    root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      mesh.material = (mesh.material as THREE.Material).name === 'eyes' ? BIRD_EYE_MAT : FEATHER_MAT
    })
    const mixer = new THREE.AnimationMixer(root)
    const clip = gltf.animations[0]
    const action = mixer.clipAction(clip).play()
    return { root, mixer, action, duration: clip.duration }
  }, [gltf])
}

export default function BlenderCrow(props: EnemyProps) {
  const { root, mixer, action, duration } = useCrowModel()
  useEffect(() => () => {
    mixer.stopAllAction()
    mixer.uncacheRoot(root)
    root.traverse((o) => (o as THREE.SkinnedMesh).skeleton?.dispose())
  }, [mixer, root])

  const at = useCallback((share: number) => {
    action.time = share * duration
    mixer.update(0)
  }, [action, duration, mixer])
  const pose = useCallback((phase: number) => {
    const turns = phase / (2 * Math.PI)
    at(turns - Math.floor(turns))
  }, [at])
  const onHit = useCallback(() => at(WINGS_UP), [at])

  return <FlapBird {...props} model={<primitive object={root} />} pose={pose} onHit={onHit} />
}
