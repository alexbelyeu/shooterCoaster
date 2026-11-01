import { useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { createRng } from '@/utils/rng'
import { scatterPositions } from '../../shared/scatter'
import IceCrystals from './IceCrystals'
import SnowDrifts from './SnowDrifts'
import { roundCaster } from '../../shared/contactShadows'
import { useContactShadows } from '../../shared/ContactShadows'

export default function ArcticDecorations(props: BiomeDecorationsProps) {
  const { heightFn } = props

  const boulderPositions = useMemo(() => scatterPositions(createRng(2410), 80, 150, 3500, heightFn), [heightFn])
  const boulderGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const boulderMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#d8e0e8', flatShading: true }), [])

  const boulderConfigs = useMemo(() => {
    const rng = createRng(2413)
    return boulderPositions.map(() => {
      const s = 4 + rng() * 12
      return { s, tilt: new THREE.Euler(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5) }
    })
  }, [boulderPositions])

  const setBoulderRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (let i = 0; i < boulderPositions.length; i++) {
      const p = boulderPositions[i]
      const { s, tilt } = boulderConfigs[i]
      q.setFromEuler(tilt)
      mat.compose(
        new THREE.Vector3(p.x, p.y + s * 0.3, p.z),
        q,
        new THREE.Vector3(s, s * 0.7, s),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [boulderPositions, boulderConfigs])

  const columnPositions = useMemo(() => scatterPositions(createRng(2411), 45, 200, 3500, heightFn), [heightFn])
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
    const rng = createRng(2414)
    return columnPositions.map(() => 0.5 + rng())
  }, [columnPositions])

  useContactShadows(
    useMemo(
      () => [
        ...boulderPositions.map((p, i) => roundCaster(p.x, p.z, boulderConfigs[i].s * 0.85, 0.4, 0.8)),
        // Translucent ice: a lighter shadow.
        ...columnPositions.map((p, i) => roundCaster(p.x, p.z, 4 * columnScales[i], 0.3, 1.2)),
      ],
      [boulderPositions, boulderConfigs, columnPositions, columnScales],
    ),
  )

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

  const pondPositions = useMemo(() => scatterPositions(createRng(2412), 20, 150, 3000, heightFn, Math.PI / 6), [heightFn])
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
    const rng = createRng(2415)
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < pondPositions.length; i++) {
      const p = pondPositions[i]
      const s = 15 + rng() * 30
      euler.set(-Math.PI / 2, 0, rng() * Math.PI * 2)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + 0.5, p.z),
        q,
        new THREE.Vector3(s, s * (0.6 + rng() * 0.4), 1),
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
