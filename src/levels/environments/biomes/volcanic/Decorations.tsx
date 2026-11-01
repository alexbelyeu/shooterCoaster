import { useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { createRng } from '@/utils/rng'
import { scatterPositions } from '../../shared/scatter'
import { roundCaster } from '../../shared/contactShadows'
import { useContactShadows } from '../../shared/ContactShadows'

export default function VolcanicDecorations({ heightFn }: BiomeDecorationsProps) {
  const shardPositions = useMemo(() => scatterPositions(createRng(2510), 150, 100, 5000, heightFn), [heightFn])
  const shardGeo = useMemo(() => new THREE.ConeGeometry(2, 15, 4), [])
  const shardMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#0a0a12',
    specular: '#4466aa',
    shininess: 80,
    flatShading: true,
  }), [])

  const shardConfigs = useMemo(() => {
    const rng = createRng(2514)
    return shardPositions.map(() => {
      const h = 8 + rng() * 17
      const tilt = new THREE.Euler(rng() * 0.3, rng() * Math.PI * 2, rng() * 0.3)
      return { h, tilt, sx: 1 + rng(), sz: 1 + rng() }
    })
  }, [shardPositions])

  const setShardRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (let i = 0; i < shardPositions.length; i++) {
      const p = shardPositions[i]
      const { h, tilt, sx, sz } = shardConfigs[i]
      q.setFromEuler(tilt)
      mat.compose(
        new THREE.Vector3(p.x, p.y + h * 0.4, p.z),
        q,
        new THREE.Vector3(sx, h / 15, sz),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [shardPositions, shardConfigs])

  const poolPositions = useMemo(() => scatterPositions(createRng(2511), 30, 200, 4000, heightFn, Math.PI / 6), [heightFn])
  const poolGeo = useMemo(() => new THREE.CircleGeometry(1, 24), [])
  const poolMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#ff4400',
    emissive: '#ff2200',
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  }), [])

  const setPoolRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const rng = createRng(2515)
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < poolPositions.length; i++) {
      const p = poolPositions[i]
      const s = 8 + rng() * 12
      euler.set(-Math.PI / 2, 0, rng() * Math.PI * 2)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + 5, p.z),
        q,
        new THREE.Vector3(s, s * (0.6 + rng() * 0.4), 1),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [poolPositions])

  const emberPositions = useMemo(() => scatterPositions(createRng(2512), 80, 50, 4500, heightFn), [heightFn])
  const emberGeo = useMemo(() => new THREE.CircleGeometry(1, 16), [])
  const emberMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#cc3300',
    emissive: '#ff4400',
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  }), [])

  const setEmberRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const rng = createRng(2516)
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < emberPositions.length; i++) {
      const p = emberPositions[i]
      const s = 3 + rng() * 5
      euler.set(-Math.PI / 2, 0, rng() * Math.PI * 2)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + 3, p.z),
        q,
        new THREE.Vector3(s, s, 1),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [emberPositions])

  const boulderPositions = useMemo(() => scatterPositions(createRng(2513), 60, 100, 4500, heightFn), [heightFn])
  const boulderGeo = useMemo(() => new THREE.DodecahedronGeometry(6, 0), [])
  const boulderMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#2a1a10',
    specular: '#443322',
    shininess: 20,
    flatShading: true,
  }), [])

  const boulderConfigs = useMemo(() => {
    const rng = createRng(2517)
    return boulderPositions.map(() => {
      const scale = new THREE.Vector3(0.5 + rng() * 1.5, 0.5 + rng() * 1.5, 0.5 + rng() * 1.5)
      return { scale, tilt: new THREE.Euler(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5) }
    })
  }, [boulderPositions])

  const setBoulderRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (let i = 0; i < boulderPositions.length; i++) {
      const p = boulderPositions[i]
      const { scale, tilt } = boulderConfigs[i]
      q.setFromEuler(tilt)
      mat.compose(new THREE.Vector3(p.x, p.y + scale.y * 3, p.z), q, scale)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [boulderPositions, boulderConfigs])

  useContactShadows(
    useMemo(
      () => [
        ...shardPositions.map((p, i) => roundCaster(p.x, p.z, 2 * Math.max(shardConfigs[i].sx, shardConfigs[i].sz), 0.5, 1.2)),
        ...boulderPositions.map((p, i) => {
          const { scale } = boulderConfigs[i]
          return roundCaster(p.x, p.z, 5.5 * Math.max(scale.x, scale.z), 0.5, 0.8)
        }),
      ],
      [shardPositions, shardConfigs, boulderPositions, boulderConfigs],
    ),
  )

  useEffect(() => {
    return () => {
      shardGeo.dispose(); shardMat.dispose()
      poolGeo.dispose(); poolMat.dispose()
      emberGeo.dispose(); emberMat.dispose()
      boulderGeo.dispose(); boulderMat.dispose()
    }
  }, [shardGeo, shardMat, poolGeo, poolMat, emberGeo, emberMat, boulderGeo, boulderMat])

  return (
    <>
      <instancedMesh ref={setShardRef} args={[shardGeo, shardMat, shardPositions.length]} frustumCulled />
      {poolPositions.length > 0 && (
        <instancedMesh ref={setPoolRef} args={[poolGeo, poolMat, poolPositions.length]} frustumCulled />
      )}
      <instancedMesh ref={setEmberRef} args={[emberGeo, emberMat, emberPositions.length]} frustumCulled />
      <instancedMesh ref={setBoulderRef} args={[boulderGeo, boulderMat, boulderPositions.length]} frustumCulled />
    </>
  )
}
