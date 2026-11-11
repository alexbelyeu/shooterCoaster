import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { hallShellGeometry, unlitGeometry } from './hallGeometry'
import { gymDressing } from './dressing'

/** The hall round the ride: lanes, arêtes, overhanging upper walls, catwalk, ceiling, and the skylights that light it. */
export default function GymFeatures() {
  const { tags } = gymDressing()
  const shell = useMemo(() => hallShellGeometry(), [])
  const unlit = useMemo(() => unlitGeometry(tags), [tags])
  const shellMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), [])
  // Skylights read as light, not paint: no fog, bright enough for Bloom.
  const unlitMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), [])

  useEffect(() => () => {
    shell.dispose()
    shellMat.dispose()
    unlitMat.dispose()
  }, [shell, shellMat, unlitMat])
  useEffect(() => () => unlit.dispose(), [unlit])

  return (
    <>
      <mesh geometry={shell} material={shellMat} />
      <mesh geometry={unlit} material={unlitMat} />
    </>
  )
}
