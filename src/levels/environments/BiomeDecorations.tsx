import { useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import type { BiomeType } from '@/types/level'
import type { HeightFunction } from '@/utils/terrainNoise'

interface BiomeDecorationsProps {
  biome: BiomeType
  heightFn: HeightFunction
}

/** Scatter positions in an annular ring, rejecting steep slopes */
function scatterPositions(
  count: number,
  minR: number,
  maxR: number,
  heightFn: HeightFunction,
  maxSlope = Math.PI / 4,
): { x: number; y: number; z: number }[] {
  const arr: { x: number; y: number; z: number }[] = []
  let attempts = 0
  while (arr.length < count && attempts < count * 5) {
    attempts++
    const r = minR + Math.random() * (maxR - minR)
    const theta = Math.random() * Math.PI * 2
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const y = heightFn(x, z)

    // Simple slope check
    const delta = 5
    const hx = heightFn(x + delta, z)
    const hz = heightFn(x, z + delta)
    const dx = (hx - y) / delta
    const dz = (hz - y) / delta
    const slope = Math.atan(Math.sqrt(dx * dx + dz * dz))
    if (slope > maxSlope) continue

    arr.push({ x, y, z })
  }
  return arr
}

export default function BiomeDecorations({ biome, heightFn }: BiomeDecorationsProps) {
  switch (biome) {
    case 'desert':
      return <DesertDecorations heightFn={heightFn} />
    case 'ocean':
      return <OceanDecorations heightFn={heightFn} />
    case 'arctic':
      return <ArcticDecorations heightFn={heightFn} />
    case 'volcanic':
      return <VolcanicDecorations heightFn={heightFn} />
    default:
      return null
  }
}

// --- DESERT ---

function DesertDecorations({ heightFn }: { heightFn: HeightFunction }) {
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

  // ── Non-cactus decorations (unchanged) ──────────────────────────────

  // Rocks
  const rockPositions = useMemo(() => scatterPositions(80, 300, 2800, heightFn), [heightFn])
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const rockMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#8b6b4a', flatShading: true }), [])

  const setRockRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < rockPositions.length; i++) {
      const p = rockPositions[i]
      const s = 3 + Math.random() * 10
      euler.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5)
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
  const tumbleweedPositions = useMemo(() => scatterPositions(30, 200, 2500, heightFn), [heightFn])
  const twGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const twMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#9a8a5a', flatShading: true }), [])

  const setTwRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    for (let i = 0; i < tumbleweedPositions.length; i++) {
      const p = tumbleweedPositions[i]
      const s = 2 + Math.random() * 4
      mat.makeTranslation(p.x, p.y + s, p.z)
      mat.scale(new THREE.Vector3(s, s, s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [tumbleweedPositions])

  // Bone clusters
  const bonePositions = useMemo(() => scatterPositions(15, 500, 2500, heightFn), [heightFn])
  const boneGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.5, 1, 4), [])
  const boneMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#e8dcc8', flatShading: true }), [])

  const setBoneRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < bonePositions.length; i++) {
      const p = bonePositions[i]
      euler.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + 1, p.z),
        q,
        new THREE.Vector3(2, 6 + Math.random() * 4, 2),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [bonePositions])

  // Skull clusters
  const skullPositions = useMemo(() => scatterPositions(20, 400, 2500, heightFn), [heightFn])
  const skullGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const skullMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#e8dcc8', flatShading: true }), [])

  const setSkullRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < skullPositions.length; i++) {
      const p = skullPositions[i]
      const s = 2 + Math.random() * 2
      euler.set(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.3)
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
  const flowerPositions = useMemo(() => scatterPositions(15, 300, 2200, heightFn), [heightFn])
  const flowerGeo = useMemo(() => new THREE.ConeGeometry(0.6, 1.2, 5), [])
  const flowerMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#ff6644', flatShading: true }), [])

  const setFlowerRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    for (let i = 0; i < flowerPositions.length; i++) {
      const p = flowerPositions[i]
      const s = 2 + Math.random() * 3
      mat.makeTranslation(p.x, p.y + s * 0.5, p.z)
      mat.scale(new THREE.Vector3(s, s, s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [flowerPositions])

  useEffect(() => {
    return () => {
      saguaroTrunkGeo.dispose(); saguaroCapGeo.dispose(); saguaroArmGeo.dispose()
      barrelGeo.dispose(); barrelFlowerGeo.dispose()
      columnarGeo.dispose(); columnarCapGeo.dispose()
      cactusMat.dispose(); barrelMat.dispose(); flowerMat2.dispose()
      rockGeo.dispose(); rockMat.dispose()
      twGeo.dispose(); twMat.dispose()
      boneGeo.dispose(); boneMat.dispose()
      skullGeo.dispose(); skullMat.dispose()
      flowerGeo.dispose(); flowerMat.dispose()
    }
  }, [saguaroTrunkGeo, saguaroCapGeo, saguaroArmGeo, barrelGeo, barrelFlowerGeo, columnarGeo, columnarCapGeo, cactusMat, barrelMat, flowerMat2, rockGeo, rockMat, twGeo, twMat, boneGeo, boneMat, skullGeo, skullMat, flowerGeo, flowerMat])

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

      {/* Other desert decorations */}
      <instancedMesh ref={setRockRef} args={[rockGeo, rockMat, rockPositions.length]} frustumCulled />
      <instancedMesh ref={setTwRef} args={[twGeo, twMat, tumbleweedPositions.length]} frustumCulled />
      <instancedMesh ref={setBoneRef} args={[boneGeo, boneMat, bonePositions.length]} frustumCulled />
      <instancedMesh ref={setSkullRef} args={[skullGeo, skullMat, skullPositions.length]} frustumCulled />
      <instancedMesh ref={setFlowerRef} args={[flowerGeo, flowerMat, flowerPositions.length]} frustumCulled />
    </>
  )
}

// --- OCEAN ---

function OceanDecorations({ heightFn }: { heightFn: HeightFunction }) {
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

// --- ARCTIC ---

function ArcticDecorations({ heightFn }: { heightFn: HeightFunction }) {
  // Ice crystal shards (stretched octahedrons) — increased to 140
  const crystalPositions = useMemo(() => scatterPositions(140, 150, 3500, heightFn), [heightFn])
  const crystalGeo = useMemo(() => new THREE.OctahedronGeometry(1, 0), [])
  const crystalMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#a0d0f0',
    emissive: '#203040',
    emissiveIntensity: 0.3,
    flatShading: true,
    transparent: true,
    opacity: 0.85,
  }), [])

  const setCrystalRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < crystalPositions.length; i++) {
      const p = crystalPositions[i]
      const h = 5 + Math.random() * 20
      euler.set(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.3)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + h * 0.5, p.z),
        q,
        new THREE.Vector3(2 + Math.random() * 3, h, 2 + Math.random() * 3),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [crystalPositions])

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

  // Snow mounds — soft dome shapes
  const moundPositions = useMemo(() => scatterPositions(40, 100, 3000, heightFn), [heightFn])
  const moundGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), [])
  const moundMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#e8eef4', flatShading: true }), [])

  const setMoundRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    for (let i = 0; i < moundPositions.length; i++) {
      const p = moundPositions[i]
      const s = 5 + Math.random() * 15
      mat.makeTranslation(p.x, p.y, p.z)
      mat.scale(new THREE.Vector3(s, s * 0.4, s))
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [moundPositions])

  useEffect(() => {
    return () => {
      crystalGeo.dispose(); crystalMat.dispose()
      boulderGeo.dispose(); boulderMat.dispose()
      columnGeo.dispose(); columnMat.dispose()
      pondGeo.dispose(); pondMat.dispose()
      moundGeo.dispose(); moundMat.dispose()
    }
  }, [crystalGeo, crystalMat, boulderGeo, boulderMat, columnGeo, columnMat, pondGeo, pondMat, moundGeo, moundMat])

  return (
    <>
      <instancedMesh ref={setCrystalRef} args={[crystalGeo, crystalMat, crystalPositions.length]} frustumCulled />
      <instancedMesh ref={setBoulderRef} args={[boulderGeo, boulderMat, boulderPositions.length]} frustumCulled />
      <instancedMesh ref={setColumnRef} args={[columnGeo, columnMat, columnPositions.length]} frustumCulled />
      {pondPositions.length > 0 && (
        <instancedMesh ref={setPondRef} args={[pondGeo, pondMat, pondPositions.length]} frustumCulled />
      )}
      <instancedMesh ref={setMoundRef} args={[moundGeo, moundMat, moundPositions.length]} frustumCulled />
    </>
  )
}

// --- VOLCANIC ---

function VolcanicDecorations({ heightFn }: { heightFn: HeightFunction }) {
  // Obsidian shards — 4-sided crystalline cones
  const shardPositions = useMemo(() => scatterPositions(150, 100, 5000, heightFn), [heightFn])
  const shardGeo = useMemo(() => new THREE.ConeGeometry(2, 15, 4), [])
  const shardMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#0a0a12',
    specular: '#4466aa',
    shininess: 80,
    flatShading: true,
  }), [])

  const setShardRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < shardPositions.length; i++) {
      const p = shardPositions[i]
      const h = 8 + Math.random() * 17
      euler.set(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.3)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + h * 0.4, p.z),
        q,
        new THREE.Vector3(1 + Math.random(), h / 15, 1 + Math.random()),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [shardPositions])

  // Lava pools — flat emissive circles on ground
  const poolPositions = useMemo(() => scatterPositions(30, 200, 4000, heightFn, Math.PI / 6), [heightFn])
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
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < poolPositions.length; i++) {
      const p = poolPositions[i]
      const s = 8 + Math.random() * 12
      euler.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + 5, p.z),
        q,
        new THREE.Vector3(s, s * (0.6 + Math.random() * 0.4), 1),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [poolPositions])

  // Ember patches — small faint glowing circles
  const emberPositions = useMemo(() => scatterPositions(80, 50, 4500, heightFn), [heightFn])
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
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < emberPositions.length; i++) {
      const p = emberPositions[i]
      const s = 3 + Math.random() * 5
      euler.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2)
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

  // Volcanic boulders — dodecahedron with organic variation
  const boulderPositions = useMemo(() => scatterPositions(60, 100, 4500, heightFn), [heightFn])
  const boulderGeo = useMemo(() => new THREE.DodecahedronGeometry(6, 0), [])
  const boulderMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#2a1a10',
    specular: '#443322',
    shininess: 20,
    flatShading: true,
  }), [])

  const setBoulderRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const euler = new THREE.Euler()
    for (let i = 0; i < boulderPositions.length; i++) {
      const p = boulderPositions[i]
      const sx = 0.5 + Math.random() * 1.5
      const sy = 0.5 + Math.random() * 1.5
      const sz = 0.5 + Math.random() * 1.5
      euler.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5)
      q.setFromEuler(euler)
      mat.compose(
        new THREE.Vector3(p.x, p.y + sy * 3, p.z),
        q,
        new THREE.Vector3(sx, sy, sz),
      )
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [boulderPositions])

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
