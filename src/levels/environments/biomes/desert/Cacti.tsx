import { useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { scatterPositions } from '../../shared/scatter'

/** Saguaro, barrel and columnar cacti (rendered first by DesertDecorations). */
export default function Cacti({ heightFn }: { heightFn: HeightFunction }) {
  // ── Cactus positions (3 types split from 150 budget) ────────────────
  const saguaroPositions = useMemo(() => scatterPositions(40, 400, 2800, heightFn), [heightFn])
  const barrelPositions = useMemo(() => scatterPositions(50, 300, 2800, heightFn), [heightFn])
  const columnarPositions = useMemo(() => scatterPositions(60, 400, 2800, heightFn), [heightFn])

  // Cactus material — rich green with waxy specular
  const cactusMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#2a7d3a',
    specular: '#558844',
    shininess: 20,
    flatShading: true,
  }), [])

  const barrelMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#3a8a3a',
    specular: '#558844',
    shininess: 20,
    flatShading: true,
  }), [])

  const flowerMat2 = useMemo(() => new THREE.MeshPhongMaterial({ color: '#ff4466', flatShading: true }), [])

  // ── Saguaro — LatheGeometry with ribbed profile ──────────────────────
  const saguaroTrunkGeo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    const ribs = 8
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      const baseRadius = 3 * (1 - 0.3 * Math.pow(t - 0.5, 2))
      const ribBump = 0.3 * Math.sin(t * ribs * Math.PI)
      pts.push(new THREE.Vector2(baseRadius + ribBump, t * 40))
    }
    return new THREE.LatheGeometry(pts, 12)
  }, [])

  const saguaroCapGeo = useMemo(() => new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), [])
  const saguaroArmGeo = useMemo(() => new THREE.CylinderGeometry(1.8, 2, 1, 8), [])

  // Deterministic arm configs per saguaro (0, 1, or 2 arms)
  const saguaroConfigs = useMemo(() => {
    return saguaroPositions.map(() => {
      const r = Math.random()
      const trunkH = 50 + Math.random() * 40
      const armCount = r < 0.2 ? 0 : r < 0.6 ? 1 : 2
      const leftArmH = 15 + Math.random() * 20
      const rightArmH = 15 + Math.random() * 20
      const leftArmY = trunkH * (0.3 + Math.random() * 0.3)
      const rightArmY = trunkH * (0.3 + Math.random() * 0.3)
      const yRot = Math.random() * Math.PI * 2
      return { trunkH, armCount, leftArmH, rightArmH, leftArmY, rightArmY, yRot }
    })
  }, [saguaroPositions])

  // Saguaro trunk InstancedMesh — scale Y by trunkH/40 since geo is 40 units tall
  const setSaguaroTrunkRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < saguaroPositions.length; i++) {
      const p = saguaroPositions[i]
      const c = saguaroConfigs[i]
      const yScale = c.trunkH / 40
      e.set(0, c.yRot, 0)
      q.setFromEuler(e)
      m.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        q,
        new THREE.Vector3(1, yScale, 1),
      )
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [saguaroPositions, saguaroConfigs])

  // Saguaro cap InstancedMesh
  const setSaguaroCapRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < saguaroPositions.length; i++) {
      const p = saguaroPositions[i]
      const c = saguaroConfigs[i]
      m.makeTranslation(p.x, p.y + c.trunkH, p.z)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [saguaroPositions, saguaroConfigs])

  // Arm InstancedMeshes — horizontal + vertical segments, per side
  // Left arm horizontal
  const setSaguaroLArmHRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < saguaroPositions.length; i++) {
      const p = saguaroPositions[i]
      const c = saguaroConfigs[i]
      if (c.armCount >= 2) {
        e.set(0, 0, Math.PI / 2)
        q.setFromEuler(e)
        m.compose(
          new THREE.Vector3(p.x - 7, p.y + c.leftArmY, p.z),
          q,
          new THREE.Vector3(1, 10, 1),
        )
      } else {
        m.compose(new THREE.Vector3(0, -9999, 0), new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))
      }
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [saguaroPositions, saguaroConfigs])

  // Left arm vertical
  const setSaguaroLArmVRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < saguaroPositions.length; i++) {
      const p = saguaroPositions[i]
      const c = saguaroConfigs[i]
      if (c.armCount >= 2) {
        m.makeTranslation(p.x - 12, p.y + c.leftArmY + c.leftArmH / 2, p.z)
        m.scale(new THREE.Vector3(1, c.leftArmH, 1))
      } else {
        m.compose(new THREE.Vector3(0, -9999, 0), new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))
      }
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [saguaroPositions, saguaroConfigs])

  // Right arm horizontal
  const setSaguaroRArmHRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < saguaroPositions.length; i++) {
      const p = saguaroPositions[i]
      const c = saguaroConfigs[i]
      if (c.armCount >= 1) {
        e.set(0, 0, -Math.PI / 2)
        q.setFromEuler(e)
        m.compose(
          new THREE.Vector3(p.x + 7, p.y + c.rightArmY, p.z),
          q,
          new THREE.Vector3(1, 10, 1),
        )
      } else {
        m.compose(new THREE.Vector3(0, -9999, 0), new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))
      }
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [saguaroPositions, saguaroConfigs])

  // Right arm vertical
  const setSaguaroRArmVRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < saguaroPositions.length; i++) {
      const p = saguaroPositions[i]
      const c = saguaroConfigs[i]
      if (c.armCount >= 1) {
        m.makeTranslation(p.x + 12, p.y + c.rightArmY + c.rightArmH / 2, p.z)
        m.scale(new THREE.Vector3(1, c.rightArmH, 1))
      } else {
        m.compose(new THREE.Vector3(0, -9999, 0), new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))
      }
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [saguaroPositions, saguaroConfigs])

  // ── Barrel cacti — round squat domes ──────────────────────────────────
  const barrelGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), [])
  const barrelFlowerGeo = useMemo(() => new THREE.ConeGeometry(0.4, 1, 5), [])

  // Pre-compute per-instance configs so body + flower use matching values
  const barrelConfigs = useMemo(() => {
    return barrelPositions.map(() => {
      const radius = 4 + Math.random() * 5
      const height = radius * (1.2 + Math.random() * 0.6)
      const yRot = Math.random() * Math.PI * 2
      const hasFlower = Math.random() < 0.6
      return { radius, height, yRot, hasFlower }
    })
  }, [barrelPositions])

  const setBarrelRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < barrelPositions.length; i++) {
      const p = barrelPositions[i]
      const c = barrelConfigs[i]
      e.set(0, c.yRot, 0)
      q.setFromEuler(e)
      m.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        q,
        new THREE.Vector3(c.radius, c.height, c.radius),
      )
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [barrelPositions, barrelConfigs])

  const setBarrelFlowerRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < barrelPositions.length; i++) {
      const p = barrelPositions[i]
      const c = barrelConfigs[i]
      if (c.hasFlower) {
        m.makeTranslation(p.x, p.y + c.height * 0.9, p.z)
        m.scale(new THREE.Vector3(3, 3, 3))
      } else {
        m.compose(new THREE.Vector3(0, -9999, 0), new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))
      }
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [barrelPositions, barrelConfigs])

  // ── Columnar cacti — thick pillars with hemisphere caps ───────────────
  const columnarGeo = useMemo(() => new THREE.CylinderGeometry(3.5, 4, 30, 10), [])
  const columnarCapGeo = useMemo(() => new THREE.SphereGeometry(3.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), [])

  // Pre-compute per-instance scale so trunk and cap use the same value
  const columnarScales = useMemo(() => {
    return columnarPositions.map(() => 0.8 + Math.random() * 1.2)
  }, [columnarPositions])

  const setColumnarRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < columnarPositions.length; i++) {
      const p = columnarPositions[i]
      const s = columnarScales[i]
      const h = 30 * s
      m.makeTranslation(p.x, p.y + h / 2, p.z)
      m.scale(new THREE.Vector3(s, s, s))
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [columnarPositions, columnarScales])

  const setColumnarCapRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < columnarPositions.length; i++) {
      const p = columnarPositions[i]
      const s = columnarScales[i]
      const h = 30 * s
      m.makeTranslation(p.x, p.y + h, p.z)
      m.scale(new THREE.Vector3(s, 1, s))
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [columnarPositions, columnarScales])

  useEffect(() => {
    return () => {
      saguaroTrunkGeo.dispose(); saguaroCapGeo.dispose(); saguaroArmGeo.dispose()
      barrelGeo.dispose(); barrelFlowerGeo.dispose()
      columnarGeo.dispose(); columnarCapGeo.dispose()
      cactusMat.dispose(); barrelMat.dispose(); flowerMat2.dispose()
    }
  }, [saguaroTrunkGeo, saguaroCapGeo, saguaroArmGeo, barrelGeo, barrelFlowerGeo, columnarGeo, columnarCapGeo, cactusMat, barrelMat, flowerMat2])

  return (
    <>
      {/* Saguaro cacti — trunk + cap + up to 4 arm segments */}
      <instancedMesh ref={setSaguaroTrunkRef} args={[saguaroTrunkGeo, cactusMat, saguaroPositions.length]} frustumCulled />
      <instancedMesh ref={setSaguaroCapRef} args={[saguaroCapGeo, cactusMat, saguaroPositions.length]} frustumCulled />
      <instancedMesh ref={setSaguaroLArmHRef} args={[saguaroArmGeo, cactusMat, saguaroPositions.length]} frustumCulled />
      <instancedMesh ref={setSaguaroLArmVRef} args={[saguaroArmGeo, cactusMat, saguaroPositions.length]} frustumCulled />
      <instancedMesh ref={setSaguaroRArmHRef} args={[saguaroArmGeo, cactusMat, saguaroPositions.length]} frustumCulled />
      <instancedMesh ref={setSaguaroRArmVRef} args={[saguaroArmGeo, cactusMat, saguaroPositions.length]} frustumCulled />

      {/* Barrel cacti */}
      <instancedMesh ref={setBarrelRef} args={[barrelGeo, barrelMat, barrelPositions.length]} frustumCulled />
      <instancedMesh ref={setBarrelFlowerRef} args={[barrelFlowerGeo, flowerMat2, barrelPositions.length]} frustumCulled />

      {/* Columnar cacti */}
      <instancedMesh ref={setColumnarRef} args={[columnarGeo, cactusMat, columnarPositions.length]} frustumCulled />
      <instancedMesh ref={setColumnarCapRef} args={[columnarCapGeo, cactusMat, columnarPositions.length]} frustumCulled />
    </>
  )
}
