import { useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { scatterPositions } from '../../shared/scatter'
import IceCrystals from './IceCrystals'
import SnowDrifts from './SnowDrifts'

export default function ArcticDecorations(props: BiomeDecorationsProps) {
  const { heightFn } = props

  // Snow-covered boulders — increased to 80
  const boulderPositions = useMemo(() => scatterPositions(80, 150, 3500, heightFn), [heightFn])
  const boulderGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const boulderMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#d8e0e8', flatShading: true }), [])

  const setBoulderRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < boulderPositions.length; i++) {
      const p = boulderPositions[i]
      const s = 4 + Math.random() * 12
      euler.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + s * 0.3, p.z),
        q,
        new THREE.Vector3(s, s * 0.7, s),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [boulderPositions])

  // Tall ice columns (semi-transparent) — increased to 45
  const columnPositions = useMemo(() => scatterPositions(45, 200, 3500, heightFn), [heightFn])
  const columnGeo = useMemo(() => {
    const iceColumnPoints: THREE.Vector2[] = []
    for (let i = 0; i <= 12; i++) {
      const t = i / 12
      const r = 4 * (1 - t * 0.7) + Math.sin(t * 6) * 0.3
      iceColumnPoints.push(new THREE.Vector2(r, t * 60))
    }
    return new THREE.LatheGeometry(iceColumnPoints, 10)
  }, [])
  const columnMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#b0d8f0',
    flatShading: true,
    transparent: true,
    opacity: 0.7,
  }), [])
  const columnScales = useMemo(() => {
    return columnPositions.map(() => 0.5 + Math.random())
  }, [columnPositions])

  const setColumnRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    for (let i = 0; i < columnPositions.length; i++) {
      const p = columnPositions[i]
      const s = columnScales[i]
      const h = 60 * s
      scale.set(s, s, s)
      mat.compose(new THREE.Vector3(p.x, p.y + h / 2, p.z), quat, scale)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [columnPositions, columnScales])

  // Frozen pond patches — flat translucent blue circles on the ground
  const pondPositions = useMemo(() => scatterPositions(20, 150, 3000, heightFn, Math.PI / 6), [heightFn])
  const pondGeo = useMemo(() => new THREE.CircleGeometry(1, 24), [])
  const pondMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#88bbdd',
    emissive: '#304858',
    emissiveIntensity: 0.2,
    flatShading: true,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  }), [])

  const setPondRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < pondPositions.length; i++) {
      const p = pondPositions[i]
      const s = 15 + Math.random() * 30
      euler.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + 0.5, p.z),
        q,
        new THREE.Vector3(s, s * (0.6 + Math.random() * 0.4), 1),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [pondPositions])

  useEffect(() => {
    return () => {
      boulderGeo.dispose(); boulderMat.dispose()
      columnGeo.dispose(); columnMat.dispose()
      pondGeo.dispose(); pondMat.dispose()
    }
  }, [boulderGeo, boulderMat, columnGeo, columnMat, pondGeo, pondMat])

  return (
    <>
      <IceCrystals {...props} />
      <SnowDrifts {...props} />
      <instancedMesh ref={setBoulderRef} args={[boulderGeo, boulderMat, boulderPositions.length]} frustumCulled />
      <instancedMesh ref={setColumnRef} args={[columnGeo, columnMat, columnPositions.length]} frustumCulled />
      {pondPositions.length > 0 && (
        <instancedMesh ref={setPondRef} args={[pondGeo, pondMat, pondPositions.length]} frustumCulled />
      )}
    </>
  )
}
