/** The title park's ground, midway, crowds, tree clumps, hedges and lake (#454): static, one draw call per kind of piece. */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import Midway from '@/levels/environments/biomes/themePark/Midway'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import { mergePainted, painted } from '@/levels/environments/shared/paintedParts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FOUNTAIN_RADIUS, GRASS_TEXELS, GROUND_SIZE, GROUND_Y, HEDGE_LENGTH, POND, type Tree, buildTitlePark, grassTexels } from './titlePark'

const SHIRTS = ['#e2302a', '#2f6fd6', '#f2c230', '#3aa655', '#ffffff', '#d04fc4', '#ff8a2a', '#2a2a40'].map((c) => new THREE.Color(c))
const FLOWERS = ['#ff3d6e', '#ffd23f', '#b04fe0', '#ff8a2a'].map((c) => new THREE.Color(c))
const FOREST_GREEN = new THREE.Color('#2f6a24')
const treeTint = (t: Tree) => new THREE.Color().setScalar(0.78 + 0.34 * t.tint)
const SKINS = ['#f0c8a0', '#8a5a3c', '#e8b48a', '#c68e5e'].map((c) => new THREE.Color(c))

/** Grass in soft patches of tone, never one flat green: baked once, one texture fetch a pixel (per-pixel noise doubled the phone's frame time). */
function createGroundMaterial(): THREE.MeshLambertMaterial {
  const map = new THREE.DataTexture(grassTexels(GRASS_TEXELS), GRASS_TEXELS, GRASS_TEXELS)
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true
  const material = new THREE.MeshLambertMaterial({ map })
  material.addEventListener('dispose', () => map.dispose())
  return material
}

function buildPersonGeometry() {
  return {
    body: new THREE.CylinderGeometry(0.75, 1.1, 3.4, 4, 1, true).translate(0, 1.7, 0),
    head: new THREE.OctahedronGeometry(0.78).translate(0, 4.2, 0),
  }
}

function buildTreeGeometry(): THREE.BufferGeometry {
  return mergePainted([
    painted(new THREE.CylinderGeometry(0.7, 1.1, 7, 5, 1, true), '#6b4a2a', [0, 3.5, 0]),
    painted(new THREE.IcosahedronGeometry(6.5, 0), '#3d7a2a', [0, 12, 0]),
  ])
}

function buildFountain() {
  const r = FOUNTAIN_RADIUS
  const stone = mergePainted([
    painted(new THREE.CylinderGeometry(r, r + 0.4, 2, 18, 1, true), '#d8d0c0', [0, 1, 0]),
    painted(new THREE.CylinderGeometry(r + 0.6, r + 0.6, 0.5, 18, 1, true), '#eee6d6', [0, 2.1, 0]),
    painted(new THREE.CylinderGeometry(1, 1.4, 6, 8, 1, true), '#d8d0c0', [0, 3.5, 0]),
    painted(new THREE.CylinderGeometry(3.2, 0.8, 1.4, 12), '#eee6d6', [0, 6.6, 0]),
  ])
  const water = mergeGeometries([
    new THREE.CircleGeometry(r - 0.2, 18).rotateX(-Math.PI / 2).translate(0, 1.5, 0),
    new THREE.CircleGeometry(3, 12).rotateX(-Math.PI / 2).translate(0, 7.25, 0),
  ])
  return { stone, water }
}

export default function TitlePark({ water }: { water: THREE.Material }) {
  const layout = useMemo(() => buildTitlePark(), [])
  const assets = useMemo(() => {
    const person = buildPersonGeometry()
    const fountain = buildFountain()
    return {
      fountainStone: fountain.stone,
      fountainWater: fountain.water,
      ground: new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE).rotateX(-Math.PI / 2),
      groundMat: createGroundMaterial(),
      body: person.body,
      head: person.head,
      tintedMat: new THREE.MeshLambertMaterial(),
      tree: buildTreeGeometry(),
      // Seen from 400+ units: an 8-triangle crown on its stump.
      forestTree: new THREE.OctahedronGeometry(7, 0).scale(1, 1.3, 1).translate(0, 9, 0),
      treeMat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      hedge: new THREE.BoxGeometry(HEDGE_LENGTH, 2.8, 2.6).translate(0, 1.4, 0),
      hedgeMat: new THREE.MeshLambertMaterial({ color: '#2d6b2d', flatShading: true }),
      planter: new THREE.BoxGeometry(9.5, 1, 3.6).translate(0, 0.5, 0),
      pond: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2).scale(POND.rx, 1, POND.rz),
    }
  }, [])
  useEffect(() => () => Object.values(assets).forEach((a) => a.dispose()), [assets])

  const shirts = useMemo(() => layout.people.map((p) => SHIRTS[p.shirt]), [layout])
  const skins = useMemo(() => layout.people.map((p) => SKINS[p.skin]), [layout])
  const flowers = useMemo(() => layout.planters.map((p) => FLOWERS[p.color]), [layout])
  const treeTints = useMemo(() => layout.trees.map(treeTint), [layout])
  const forestTints = useMemo(() => layout.forest.map((t) => treeTint(t).multiply(FOREST_GREEN)), [layout])

  return (
    <>
      <mesh name="title-ground" geometry={assets.ground} material={assets.groundMat} position={[0, GROUND_Y, 0]} />
      <Midway layout={layout} />
      <StaticInstances placements={layout.people} colors={shirts} geometry={assets.body} material={assets.tintedMat} />
      <StaticInstances placements={layout.people} colors={skins} geometry={assets.head} material={assets.tintedMat} />
      <StaticInstances placements={layout.trees} colors={treeTints} geometry={assets.tree} material={assets.treeMat} />
      <StaticInstances placements={layout.forest} colors={forestTints} geometry={assets.forestTree} material={assets.tintedMat} />
      <StaticInstances placements={layout.hedges} geometry={assets.hedge} material={assets.hedgeMat} />
      <StaticInstances placements={layout.planters} colors={flowers} geometry={assets.planter} material={assets.tintedMat} />
      <group position={[0, GROUND_Y, 0]}>
        <mesh name="title-fountain" geometry={assets.fountainStone} material={assets.treeMat} />
        <mesh geometry={assets.fountainWater} material={water} />
      </group>
      <mesh name="title-lake" geometry={assets.pond} material={water} position={[POND.x, GROUND_Y + 0.2, POND.z]} />
    </>
  )
}
