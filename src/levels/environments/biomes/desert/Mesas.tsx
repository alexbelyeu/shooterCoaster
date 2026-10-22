import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import StaticInstances from '../../shared/StaticInstances'
import { buildRingedRock } from '../../shared/ringedRock'
import { MESA_JITTER, MESA_RINGS, type Mesa } from './desertLayout'

const c = (hex: number) => new THREE.Color(hex)

// One colour per ring band, bottom up: sandy talus, then alternating red-rock
// strata, pale ledges where the profile steps in.
const BANDS = [
  c(0xc4824f), // talus
  c(0xb06440), // talus foot of the cliff
  c(0x9a4630),
  c(0xc0643e),
  c(0xd8a06a), // ledge
  c(0x8c3e2a),
  c(0xb35a3a),
  c(0xdba46c), // ledge
  c(0x9e4a32),
]
const TOP = c(0xc98552)

const UP = new THREE.Vector3(0, 1, 0)

function mesaMatrix(m: Mesa): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(m.x, m.y, m.z),
    new THREE.Quaternion().setFromAxisAngle(UP, m.yaw),
    new THREE.Vector3(m.scale, m.scale, m.scale),
  )
}

/** Flat-topped, stepped red-rock mesas: one merged geometry, one draw call. */
export default function Mesas({ mesas }: { mesas: readonly Mesa[] }) {
  const geometry = useMemo(() => buildRingedRock(MESA_RINGS, 11, MESA_JITTER, 23, BANDS, TOP, 0), [])
  const material = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        vertexColors: true,
        flatShading: true,
        specular: 0x2a1a10,
        shininess: 12,
      }),
    [],
  )
  const matrices = useMemo(() => mesas.map(mesaMatrix), [mesas])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return <StaticInstances matrices={matrices} geometry={geometry} material={material} />
}
