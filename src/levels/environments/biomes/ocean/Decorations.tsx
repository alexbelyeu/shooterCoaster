import { useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { scatterPositions } from '../../shared/scatter'

export default function OceanDecorations({ heightFn }: BiomeDecorationsProps) {
  // Rock pillars rising from seafloor
  const pillarPositions = useMemo(() => scatterPositions(40, 600, 2800, heightFn, Math.PI / 2), [heightFn])
  const pillarGeo = useMemo(() => new THREE.CylinderGeometry(3, 6, 1, 5), [])
  const pillarMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#4a4a40', flatShading: true }), [])

  const setPillarRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const scale = new THREE.Vector3()
    for (let i = 0; i < pillarPositions.length; i++) {
      const p = pillarPositions[i]
      const h = 20 + Math.random() * 60
      mat.makeTranslation(p.x, p.y + h / 2, p.z)
      scale.set(1 + Math.random() * 0.5, h, 1 + Math.random() * 0.5)
      mat.scale(scale)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [pillarPositions])

  // Coral clusters (increased from 60 to 120)
  const coralPositions = useMemo(() => {
    return scatterPositions(120, 200, 2500, heightFn, Math.PI / 2)
      .filter(p => p.y < 0)
  }, [heightFn])
  const coralGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 4), [])
  const coralMat = useMemo(() => new THREE.MeshPhongMaterial({ flatShading: true, vertexColors: true }), [])

  const coralColors = useMemo(() => {
    const n = coralPositions.length
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    const palette = [
      new THREE.Color('#ff4466'), new THREE.Color('#ff8844'),
      new THREE.Color('#ffaa22'), new THREE.Color('#ff66aa'),
      new THREE.Color('#aa44ff'), new THREE.Color('#44aaff'),
    ]
    for (let i = 0; i < n; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)]
      attr.setXYZ(i, c.r, c.g, c.b)
    }
    return attr
  }, [coralPositions])

  const setCoralRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    mesh.instanceColor = coralColors
    const mat = new THREE.Matrix4()
    for (let i = 0; i < coralPositions.length; i++) {
      const p = coralPositions[i]
      const s = 3 + Math.random() * 8
      mat.makeTranslation(p.x, p.y + s * 0.5, p.z)
      mat.scale(new THREE.Vector3(s, s * (0.5 + Math.random() * 0.8), s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [coralPositions, coralColors])

  // Seaweed strands
  const seaweedPositions = useMemo(() => {
    return scatterPositions(80, 200, 2500, heightFn, Math.PI / 2)
      .filter(p => p.y < -5)
  }, [heightFn])
  const swGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.5, 1, 4), [])
  const swMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#1a6630', flatShading: true }), [])

  const setSwRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < seaweedPositions.length; i++) {
      const p = seaweedPositions[i]
      const h = 8 + Math.random() * 25
      euler.set(Math.random() * 0.15, 0, Math.random() * 0.15)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + h / 2, p.z),
        q,
        new THREE.Vector3(1, h, 1),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [seaweedPositions])

  // Distant island landmarks (large rocks above water)
  const islandPositions = useMemo(() => {
    const arr: { x: number; y: number; z: number }[] = []
    for (let i = 0; i < 5; i++) {
      const theta = (i / 5) * Math.PI * 2 + Math.random() * 0.5
      const r = 1800 + Math.random() * 800
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      const y = heightFn(x, z)
      arr.push({ x, y: Math.max(y, 0), z })
    }
    return arr
  }, [heightFn])
  const islandGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 1), [])
  const islandMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#5a5a4a', flatShading: true }), [])

  const setIslandRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    for (let i = 0; i < islandPositions.length; i++) {
      const p = islandPositions[i]
      const s = 30 + Math.random() * 50
      mat.makeTranslation(p.x, p.y + s * 0.3, p.z)
      mat.scale(new THREE.Vector3(s, s * 0.7, s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [islandPositions])

  // Anemones — blobby shapes on the seafloor
  const anemonePositions = useMemo(() => {
    return scatterPositions(30, 200, 2200, heightFn, Math.PI / 2)
      .filter(p => p.y < -3)
  }, [heightFn])
  const anemoneGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 5), [])
  const anemoneMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#ffaa22', flatShading: true }), [])

  const setAnemoneRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    for (let i = 0; i < anemonePositions.length; i++) {
      const p = anemonePositions[i]
      const s = 2 + Math.random() * 5
      mat.makeTranslation(p.x, p.y + s * 0.3, p.z)
      mat.scale(new THREE.Vector3(s, s * 0.6, s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [anemonePositions])

  // Bioluminescent orbs — small emissive spheres
  const orbPositions = useMemo(() => {
    return scatterPositions(25, 150, 2000, heightFn, Math.PI / 2)
      .filter(p => p.y < -2)
  }, [heightFn])
  const orbGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const orbMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#44ffaa',
    emissive: '#44ffaa',
    emissiveIntensity: 2,
    toneMapped: false,
  }), [])

  const orbColors = useMemo(() => {
    const n = orbPositions.length
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    const palette = [
      new THREE.Color('#44ffaa'), new THREE.Color('#44aaff'),
      new THREE.Color('#ff44aa'), new THREE.Color('#aaff44'),
    ]
    for (let i = 0; i < n; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)]
      attr.setXYZ(i, c.r, c.g, c.b)
    }
    return attr
  }, [orbPositions])

  const setOrbRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    mesh.instanceColor = orbColors
    const mat = new THREE.Matrix4()
    for (let i = 0; i < orbPositions.length; i++) {
      const p = orbPositions[i]
      const s = 0.8 + Math.random() * 1.5
      mat.makeTranslation(p.x, p.y + 3 + Math.random() * 8, p.z)
      mat.scale(new THREE.Vector3(s, s, s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [orbPositions, orbColors])

  useEffect(() => {
    return () => {
      pillarGeo.dispose(); pillarMat.dispose()
      coralGeo.dispose(); coralMat.dispose()
      swGeo.dispose(); swMat.dispose()
      islandGeo.dispose(); islandMat.dispose()
      anemoneGeo.dispose(); anemoneMat.dispose()
      orbGeo.dispose(); orbMat.dispose()
    }
  }, [pillarGeo, pillarMat, coralGeo, coralMat, swGeo, swMat, islandGeo, islandMat, anemoneGeo, anemoneMat, orbGeo, orbMat])

  return (
    <>
      <instancedMesh ref={setPillarRef} args={[pillarGeo, pillarMat, pillarPositions.length]} frustumCulled />
      {coralPositions.length > 0 && (
        <instancedMesh ref={setCoralRef} args={[coralGeo, coralMat, coralPositions.length]} frustumCulled />
      )}
      {seaweedPositions.length > 0 && (
        <instancedMesh ref={setSwRef} args={[swGeo, swMat, seaweedPositions.length]} frustumCulled />
      )}
      <instancedMesh ref={setIslandRef} args={[islandGeo, islandMat, islandPositions.length]} frustumCulled />
      {anemonePositions.length > 0 && (
        <instancedMesh ref={setAnemoneRef} args={[anemoneGeo, anemoneMat, anemonePositions.length]} frustumCulled />
      )}
      {orbPositions.length > 0 && (
        <instancedMesh ref={setOrbRef} args={[orbGeo, orbMat, orbPositions.length]} frustumCulled={false} />
      )}
    </>
  )
}
