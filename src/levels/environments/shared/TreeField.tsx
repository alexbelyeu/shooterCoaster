import { useMemo, useRef, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getTerrainSlope, type HeightFunction } from '@/utils/terrainNoise'
import { createRng } from '@/utils/rng'
import { hslToRgb } from './scatter'
import type { BiomeTreeConfig, TreeTypeConfig } from './types'
import { bakeCrownShade, CANOPY_PART, treeWindTime, TRUNK_PART, withTreeWind } from './treeWind'

/** Trees placed on terrain with slope rejection and biome variety, swaying in the wind; `seed` fixes the layout. */
export default function TreeField({
  count,
  config,
  heightFn,
  seed,
}: {
  count: number
  config: BiomeTreeConfig
  heightFn: HeightFunction
  seed: number
}) {
  const treeTypes = config.types
  const actualCount = config.maxCount === undefined ? count : Math.min(config.maxCount, count)

  const trees = useMemo(() => {
    if (actualCount === 0 || treeTypes.length === 0) return []
    const rng = createRng(seed)
    const arr: { x: number; y: number; z: number; height: number; color: string; typeIdx: number }[] = []
    const minR = config.minRadius
    const maxR = config.maxRadius
    const maxSlopeAngle = config.maxSlope

    let attempts = 0
    while (arr.length < actualCount && attempts < actualCount * 5) {
      attempts++
      const r = minR + rng() * (maxR - minR)
      const theta = rng() * Math.PI * 2
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r

      const slope = getTerrainSlope(heightFn, x, z)
      if (slope > maxSlopeAngle) continue

      const y = heightFn(x, z)

      const typeIdx = Math.floor(rng() * treeTypes.length)
      const tType = treeTypes[typeIdx]
      const height = rng.range(tType.heightRange[0], tType.heightRange[1])

      arr.push({
        x,
        y,
        z,
        height,
        color: tType.canopyColors(rng),
        typeIdx,
      })
    }
    return arr
  }, [actualCount, config, heightFn, treeTypes, seed])

  const groupedTrees = useMemo(() => {
    const groups: Map<number, typeof trees> = new Map()
    for (const tree of trees) {
      if (!groups.has(tree.typeIdx)) groups.set(tree.typeIdx, [])
      groups.get(tree.typeIdx)!.push(tree)
    }
    return groups
  }, [trees])

  useFrame(({ clock }) => {
    treeWindTime.value = clock.elapsedTime
  })

  if (trees.length === 0) return null

  return (
    <>
      {Array.from(groupedTrees.entries()).map(([typeIdx, group]) => (
        <TreeTypeInstances
          key={typeIdx}
          trees={group}
          treeType={treeTypes[typeIdx]}
          fill={config.fill ?? 0}
        />
      ))}
    </>
  )
}

function TreeTypeInstances({
  trees,
  treeType,
  fill,
}: {
  trees: { x: number; y: number; z: number; height: number; color: string }[]
  treeType: TreeTypeConfig
  fill: number
}) {
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(2, 4, 1, 6), [])
  const canopyGeo = useMemo(() => {
    const geo = treeType.canopyGeoFactory()
    bakeCrownShade(geo)
    return geo
  }, [treeType])

  const trunkMat = useMemo(
    () => withTreeWind(new THREE.MeshPhongMaterial({ color: treeType.trunkColor, flatShading: true }), TRUNK_PART, fill),
    [treeType, fill],
  )
  const canopyMat = useMemo(
    () => withTreeWind(new THREE.MeshPhongMaterial({ flatShading: true, vertexColors: true }), CANOPY_PART, fill),
    [fill],
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
        _mat.makeTranslation(t.x, t.y + t.height * TRUNK_PART.base, t.z)
        _scale.set(1, t.height * TRUNK_PART.span, 1)
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
        _mat.makeTranslation(t.x, t.y + t.height * CANOPY_PART.base, t.z)
        _scale.set(t.height * 0.4, t.height * CANOPY_PART.span, t.height * 0.4)
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
