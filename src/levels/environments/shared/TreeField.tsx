import { useMemo, useRef, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { getTerrainSlope, type HeightFunction } from '@/utils/terrainNoise'
import { hslToRgb } from './scatter'
import type { BiomeTreeConfig, TreeTypeConfig } from './types'

/** Trees placed on terrain with slope rejection and biome variety */
export default function TreeField({
  count,
  config,
  heightFn,
}: {
  count: number
  config: BiomeTreeConfig
  heightFn: HeightFunction
}) {
  const treeTypes = config.types
  const actualCount = config.maxCount === undefined ? count : Math.min(config.maxCount, count)

  const trees = useMemo(() => {
    if (actualCount === 0 || treeTypes.length === 0) return []
    const arr: { x: number; y: number; z: number; height: number; color: string; typeIdx: number }[] = []
    const minR = config.minRadius
    const maxR = config.maxRadius
    const maxSlopeAngle = config.maxSlope

    let attempts = 0
    while (arr.length < actualCount && attempts < actualCount * 5) {
      attempts++
      const r = minR + Math.random() * (maxR - minR)
      const theta = Math.random() * Math.PI * 2
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r

      // Slope rejection
      const slope = getTerrainSlope(heightFn, x, z)
      if (slope > maxSlopeAngle) continue

      const y = heightFn(x, z)

      const typeIdx = Math.floor(Math.random() * treeTypes.length)
      const tType = treeTypes[typeIdx]
      const height = tType.heightRange[0] + Math.random() * (tType.heightRange[1] - tType.heightRange[0])

      arr.push({
        x,
        y,
        z,
        height,
        color: tType.canopyColors(),
        typeIdx,
      })
    }
    return arr
  }, [actualCount, config, heightFn, treeTypes])

  // Group trees by type for instancing
  const groupedTrees = useMemo(() => {
    const groups: Map<number, typeof trees> = new Map()
    for (const tree of trees) {
      if (!groups.has(tree.typeIdx)) groups.set(tree.typeIdx, [])
      groups.get(tree.typeIdx)!.push(tree)
    }
    return groups
  }, [trees])

  if (trees.length === 0) return null

  return (
    <>
      {Array.from(groupedTrees.entries()).map(([typeIdx, group]) => (
        <TreeTypeInstances
          key={typeIdx}
          trees={group}
          treeType={treeTypes[typeIdx]}
        />
      ))}
    </>
  )
}

function TreeTypeInstances({
  trees,
  treeType,
}: {
  trees: { x: number; y: number; z: number; height: number; color: string }[]
  treeType: TreeTypeConfig
}) {
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(2, 4, 1, 6), [])
  const canopyGeo = useMemo(() => treeType.canopyGeoFactory(), [treeType])

  const trunkMat = useMemo(
    () => new THREE.MeshPhongMaterial({ color: treeType.trunkColor, flatShading: true }),
    [treeType],
  )
  const canopyMat = useMemo(
    () => new THREE.MeshPhongMaterial({ flatShading: true, vertexColors: true }),
    [],
  )

  const instanceColorAttr = useMemo(() => {
    const n = trees.length
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    for (let i = 0; i < n; i++) {
      const [r, g, b] = hslToRgb(trees[i].color)
      attr.setXYZ(i, r, g, b)
    }
    return attr
  }, [trees])

  const _mat = useRef(new THREE.Matrix4()).current
  const _scale = useRef(new THREE.Vector3()).current

  const setTrunkRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i]
        _mat.makeTranslation(t.x, t.y + t.height * 0.3, t.z)
        _scale.set(1, t.height * 0.6, 1)
        _mat.scale(_scale)
        mesh.setMatrixAt(i, _mat)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    [trees, _mat, _scale],
  )

  const setCanopyRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      mesh.instanceColor = instanceColorAttr
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i]
        _mat.makeTranslation(t.x, t.y + t.height * 0.75, t.z)
        _scale.set(t.height * 0.4, t.height * 0.5, t.height * 0.4)
        _mat.scale(_scale)
        mesh.setMatrixAt(i, _mat)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    [trees, instanceColorAttr, _mat, _scale],
  )

  useEffect(() => {
    return () => {
      trunkGeo.dispose()
      canopyGeo.dispose()
      trunkMat.dispose()
      canopyMat.dispose()
    }
  }, [trunkGeo, canopyGeo, trunkMat, canopyMat])

  const n = trees.length
  return (
    <>
      <instancedMesh ref={setTrunkRef} args={[trunkGeo, trunkMat, n]} frustumCulled />
      <instancedMesh ref={setCanopyRef} args={[canopyGeo, canopyMat, n]} frustumCulled />
    </>
  )
}
