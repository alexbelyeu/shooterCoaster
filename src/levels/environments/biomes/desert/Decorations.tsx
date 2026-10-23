import { useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { createRng } from '@/utils/rng'
import { scatterPositions } from '../../shared/scatter'
import Cacti from './Cacti'

/** Desert ground clutter: rocks, tumbleweeds, bones, skulls, flowers. */
function DesertProps({ heightFn }: Pick<BiomeDecorationsProps, 'heightFn'>) {
  // Rocks
  const rockPositions = useMemo(() => scatterPositions(createRng(2330), 80, 300, 2800, heightFn), [heightFn])
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const rockMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#8b6b4a', flatShading: true }), [])

  const setRockRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const rng = createRng(2335)
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < rockPositions.length; i++) {
      const p = rockPositions[i]
      const s = 3 + rng() * 10
      euler.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + s * 0.4, p.z),
        q,
        new THREE.Vector3(s, s * 0.6, s),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [rockPositions])

  // Tumbleweeds
  const tumbleweedPositions = useMemo(() => scatterPositions(createRng(2331), 30, 200, 2500, heightFn), [heightFn])
  const twGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const twMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#9a8a5a', flatShading: true }), [])

  const setTwRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const rng = createRng(2336)
    const mat = new THREE.Matrix4()
    for (let i = 0; i < tumbleweedPositions.length; i++) {
      const p = tumbleweedPositions[i]
      const s = 2 + rng() * 4
      mat.makeTranslation(p.x, p.y + s, p.z)
      mat.scale(new THREE.Vector3(s, s, s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [tumbleweedPositions])

  // Bone clusters
  const bonePositions = useMemo(() => scatterPositions(createRng(2332), 15, 500, 2500, heightFn), [heightFn])
  const boneGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.5, 1, 4), [])
  const boneMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#e8dcc8', flatShading: true }), [])

  const setBoneRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const rng = createRng(2337)
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < bonePositions.length; i++) {
      const p = bonePositions[i]
      euler.set(rng() * Math.PI, rng() * Math.PI, 0)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + 1, p.z),
        q,
        new THREE.Vector3(2, 6 + rng() * 4, 2),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [bonePositions])

  // Skull clusters
  const skullPositions = useMemo(() => scatterPositions(createRng(2333), 20, 400, 2500, heightFn), [heightFn])
  const skullGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const skullMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#e8dcc8', flatShading: true }), [])

  const setSkullRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const rng = createRng(2338)
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < skullPositions.length; i++) {
      const p = skullPositions[i]
      const s = 2 + rng() * 2
      euler.set(rng() * 0.3, rng() * Math.PI * 2, rng() * 0.3)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + s * 0.4, p.z),
        q,
        new THREE.Vector3(s, s * 0.8, s * 0.9),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [skullPositions])

  // Desert flowers
  const flowerPositions = useMemo(() => scatterPositions(createRng(2334), 15, 300, 2200, heightFn), [heightFn])
  const flowerGeo = useMemo(() => new THREE.ConeGeometry(0.6, 1.2, 5), [])
  const flowerMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#ff6644', flatShading: true }), [])

  const setFlowerRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const rng = createRng(2339)
    const mat = new THREE.Matrix4()
    for (let i = 0; i < flowerPositions.length; i++) {
      const p = flowerPositions[i]
      const s = 2 + rng() * 3
      mat.makeTranslation(p.x, p.y + s * 0.5, p.z)
      mat.scale(new THREE.Vector3(s, s, s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [flowerPositions])

  useEffect(() => {
    return () => {
      rockGeo.dispose(); rockMat.dispose()
      twGeo.dispose(); twMat.dispose()
      boneGeo.dispose(); boneMat.dispose()
      skullGeo.dispose(); skullMat.dispose()
      flowerGeo.dispose(); flowerMat.dispose()
    }
  }, [rockGeo, rockMat, twGeo, twMat, boneGeo, boneMat, skullGeo, skullMat, flowerGeo, flowerMat])

  return (
    <>
      {/* Other desert decorations */}
      <instancedMesh ref={setRockRef} args={[rockGeo, rockMat, rockPositions.length]} frustumCulled />
      <instancedMesh ref={setTwRef} args={[twGeo, twMat, tumbleweedPositions.length]} frustumCulled />
      <instancedMesh ref={setBoneRef} args={[boneGeo, boneMat, bonePositions.length]} frustumCulled />
      <instancedMesh ref={setSkullRef} args={[skullGeo, skullMat, skullPositions.length]} frustumCulled />
      <instancedMesh ref={setFlowerRef} args={[flowerGeo, flowerMat, flowerPositions.length]} frustumCulled />
    </>
  )
}

/** Every scatter has its own fixed seed, so the layout is the same each visit. */
export default function DesertDecorations({ heightFn }: BiomeDecorationsProps) {
  return (
    <>
      <Cacti heightFn={heightFn} />
      <DesertProps heightFn={heightFn} />
    </>
  )
}
