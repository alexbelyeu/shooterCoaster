import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import StaticInstances from '../../shared/StaticInstances'
import { HOLD_SHAPES, boulderSpots, type Hold } from './gymLayout'
import { holdGeometries, propsGeometry } from './hallGeometry'
import { gymDressing } from './dressing'

const BOULDER_SEED = 4571

const _e = new THREE.Euler(0, 0, 0, 'YXZ')
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()

interface ShapeInstances {
  matrices: THREE.Matrix4[]
  colors: THREE.Color[]
}

function byShape(holds: readonly Hold[]): ShapeInstances[] {
  const out = Array.from({ length: HOLD_SHAPES }, (): ShapeInstances => ({ matrices: [], colors: [] }))
  for (const h of holds) {
    _q.setFromEuler(_e.set(0, h.yaw, h.roll))
    out[h.shape].matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(h.x, h.y, h.z), _q, _s.setScalar(h.scale)))
    out[h.shape].colors.push(new THREE.Color(h.color))
  }
  return out
}

/** Holds up every lane (one instanced draw call per shape), volumes, and the bouldering zone's boulders on their mats. */
export default function GymDecorations({ track }: BiomeDecorationsProps) {
  const { holds, volumes } = gymDressing()
  const shapes = useMemo(() => byShape(holds), [holds])
  const holdGeos = useMemo(() => holdGeometries(), [])
  const holdMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55 }), [])
  const props = useMemo(() => propsGeometry(volumes, boulderSpots(track, BOULDER_SEED)), [volumes, track])
  const propsMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true }), [])

  useEffect(() => () => {
    holdGeos.forEach((g) => g.dispose())
    holdMat.dispose()
    propsMat.dispose()
  }, [holdGeos, holdMat, propsMat])
  useEffect(() => () => props.dispose(), [props])

  return (
    <>
      {shapes.map((s, i) => (
        <StaticInstances key={i} matrices={s.matrices} colors={s.colors} geometry={holdGeos[i]} material={holdMat} />
      ))}
      <mesh geometry={props} material={propsMat} />
    </>
  )
}
