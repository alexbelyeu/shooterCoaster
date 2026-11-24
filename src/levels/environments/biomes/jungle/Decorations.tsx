import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '@/levels/environments/shared/types'
import { scatterNearTrack, settleOnGround, trackExtent } from '@/levels/environments/shared/trackScatter'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import { mergePainted, painted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import { yawScaleMatrix } from '@/levels/environments/shared/yawScaleMatrix'
import { createRng } from '@/utils/rng'

const STONE = '#948c72'
const STONE_DARK = '#7a7560'
const MOSS = '#4f6b2c'

/** A broken column, unit radius and about four high: a mossy drum on a plinth, its top snapped off at a slant. */
function columnGeometry(): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(0.8, 0.9, 3.2, 9, 1)
  const top = shaft.attributes.position
  for (let i = 0; i < top.count; i++) if (top.getY(i) > 0) top.setY(i, top.getY(i) + top.getX(i) * 0.35)
  return mergePainted([
    painted(new THREE.BoxGeometry(2.2, 0.6, 2.2), STONE_DARK, [0, 0.3, 0]),
    paintedAt(shaft, (_x, y) => (y > 1.2 ? MOSS : STONE), pose([0, 2.2, 0])),
    painted(new THREE.TorusGeometry(0.88, 0.12, 4, 9), MOSS, [0, 1.2, 0], [Math.PI / 2, 0, 0]),
  ])
}

/** A fallen block, unit high: a dressed stone with a moss cap. */
function blockGeometry(): THREE.BufferGeometry {
  return paintedAt(new THREE.BoxGeometry(1.8, 1, 1.2), (_x, y) => (y > 0.45 ? MOSS : STONE_DARK), pose([0, 0.5, 0], [0, 0, 0.08]))
}

/** Ruins beside the ride, seeded and kept off the rails and towers: broken columns and fallen blocks, two draw calls. */
export default function JungleDecorations({ groundFn, track }: BiomeDecorationsProps) {
  const column = useMemo(columnGeometry, [])
  const block = useMemo(blockGeometry, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }), [])

  const [columns, blocks] = useMemo(() => {
    const rng = createRng(8702)
    const points = scatterNearTrack({
      count: 300,
      track,
      heightFn: groundFn,
      minDist: 70,
      maxDist: 700,
      maxRadius: trackExtent(track) * 1.5,
      maxSlope: Math.PI / 7,
      bias: 1.4,
      rng,
    })
    const columns = settleOnGround(points.slice(0, 120), groundFn, { count: 36, scaleRange: [9, 16], footprint: 1.1, height: 4, sink: 0.2, maxBury: 0.4, rng })
    const blocks = settleOnGround(points.slice(120), groundFn, { count: 60, scaleRange: [10, 22], footprint: 1, height: 1, sink: 0.25, maxBury: 0.5, rng })
    const place = (props: typeof columns) => props.map((p) => yawScaleMatrix(p, rng() * Math.PI * 2, p.scale))
    return [place(columns), place(blocks)]
  }, [groundFn, track])

  useEffect(
    () => () => {
      column.dispose()
      block.dispose()
      material.dispose()
    },
    [column, block, material],
  )

  return (
    <>
      <StaticInstances matrices={columns} geometry={column} material={material} />
      <StaticInstances matrices={blocks} geometry={block} material={material} />
    </>
  )
}
