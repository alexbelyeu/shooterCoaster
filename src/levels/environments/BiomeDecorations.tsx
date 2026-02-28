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
    default:
      return null
  }
}

// --- DESERT ---

function DesertDecorations({ heightFn }: { heightFn: HeightFunction }) {
  // Cacti
  const cactiPositions = useMemo(() => scatterPositions(150, 400, 2800, heightFn), [heightFn])
  const cactiGeo = useMemo(() => new THREE.CylinderGeometry(1.5, 2, 1, 6), [])
  const cactiMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#2d6b1e', flatShading: true }), [])

  const setCactiRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const scale = new THREE.Vector3()
    for (let i = 0; i < cactiPositions.length; i++) {
      const p = cactiPositions[i]
      const h = 8 + Math.random() * 20
      mat.makeTranslation(p.x, p.y + h / 2, p.z)
      scale.set(1, h, 1)
      mat.scale(scale)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [cactiPositions])

  // Rocks
  const rockPositions = useMemo(() => scatterPositions(80, 300, 2800, heightFn), [heightFn])
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const rockMat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#8b6b4a', flatShading: true }), [])

  const setRockRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const scale = new THREE.Vector3()
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
      cactiGeo.dispose(); cactiMat.dispose()
      rockGeo.dispose(); rockMat.dispose()
      twGeo.dispose(); twMat.dispose()
      boneGeo.dispose(); boneMat.dispose()
      skullGeo.dispose(); skullMat.dispose()
      flowerGeo.dispose(); flowerMat.dispose()
    }
  }, [cactiGeo, cactiMat, rockGeo, rockMat, twGeo, twMat, boneGeo, boneMat, skullGeo, skullMat, flowerGeo, flowerMat])

  return (
    <>
      <instancedMesh ref={setCactiRef} args={[cactiGeo, cactiMat, cactiPositions.length]} frustumCulled />
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
  const crystalPositions = useMemo(() => scatterPositions(140, 300, 3500, heightFn), [heightFn])
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
  const boulderPositions = useMemo(() => scatterPositions(80, 300, 3500, heightFn), [heightFn])
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
  const columnPositions = useMemo(() => scatterPositions(45, 500, 4000, heightFn), [heightFn])
  const columnGeo = useMemo(() => new THREE.CylinderGeometry(2, 4, 1, 6), [])
  const columnMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#b0d8f0',
    flatShading: true,
    transparent: true,
    opacity: 0.7,
  }), [])

  const setColumnRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const scale = new THREE.Vector3()
    for (let i = 0; i < columnPositions.length; i++) {
      const p = columnPositions[i]
      const h = 30 + Math.random() * 60
      mat.makeTranslation(p.x, p.y + h / 2, p.z)
      scale.set(1, h, 1)
      mat.scale(scale)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [columnPositions])

  // Frozen pond patches — flat translucent blue circles on the ground
  const pondPositions = useMemo(() => scatterPositions(20, 400, 3000, heightFn, Math.PI / 6), [heightFn])
  const pondGeo = useMemo(() => new THREE.CircleGeometry(1, 8), [])
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
  const moundPositions = useMemo(() => scatterPositions(40, 200, 3000, heightFn), [heightFn])
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
