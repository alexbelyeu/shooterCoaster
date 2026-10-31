import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  FLAG_DROP,
  FLAG_SPACING,
  PALETTE,
  PATH_HALF_WIDTH,
  type Pole,
  type ThemeParkLayout,
  type Wire,
  paletteColors,
  wirePoint,
} from './parkSpec'
import { type StallGeometry, buildStallGeometries } from './stallGeometry'
import StaticInstances from '../../shared/StaticInstances'

/** Above 1 so the bulbs clear the bloom threshold (the material is not tone-mapped). */
const BULB_COLORS = ['#fff2c0', '#ffd040', '#ff6a5a', '#7ad0ff', '#9cff8a'].map((c) =>
  new THREE.Color(c).multiplyScalar(2.4),
)
const WIRE_SEGMENTS = 12

function StallVariant({
  geometry,
  stalls,
  neutralMat,
  accentMat,
}: {
  geometry: StallGeometry
  stalls: ThemeParkLayout['stalls']
  neutralMat: THREE.Material
  accentMat: THREE.Material
}) {
  const colors = useMemo(() => paletteColors(stalls.map((s) => s.color)), [stalls])
  return (
    <>
      <StaticInstances placements={stalls} geometry={geometry.neutral} material={neutralMat} />
      <StaticInstances placements={stalls} colors={colors} geometry={geometry.accent} material={accentMat} />
    </>
  )
}

/**
 * Poles of any heights from one geometry as tall as the tallest, each sunk into
 * the ground so its top lands where the layout wants it (no height scaling).
 */
function Poles({ poles, material }: { poles: Pole[]; material: THREE.Material }) {
  const height = useMemo(() => Math.max(1, ...poles.map((p) => p.height)), [poles])
  const geometry = useMemo(
    () => new THREE.CylinderGeometry(0.5, 0.7, height, 5, 1, true).translate(0, height / 2, 0),
    [height],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  const placements = useMemo(
    () => poles.map((p) => ({ x: p.x, y: p.y + p.height - height, z: p.z, yaw: 0 })),
    [poles, height],
  )
  return <StaticInstances placements={placements} geometry={geometry} material={material} />
}

function buildWireGeometry(wires: Wire[]): THREE.BufferGeometry {
  const pos = new Float32Array(wires.length * WIRE_SEGMENTS * 6)
  let o = 0
  for (const w of wires) {
    for (let k = 0; k < WIRE_SEGMENTS; k++) {
      pos.set(wirePoint(w, k / WIRE_SEGMENTS), o)
      pos.set(wirePoint(w, (k + 1) / WIRE_SEGMENTS), o + 3)
      o += 6
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return g
}

function buildBulbGeometry(bulbs: number[]): THREE.BufferGeometry {
  const n = bulbs.length / 3
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) BULB_COLORS[i % BULB_COLORS.length].toArray(colors, i * 3)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

/** Soft round sprite so Points read as bulbs, not squares. */
function buildDotTexture(): THREE.Texture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.9)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

function buildPathGeometry(rows: ThemeParkLayout['path']): THREE.BufferGeometry {
  const pos: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    const b = rows[(i + 1) % rows.length]
    if (!a.open || !b.open) continue
    const ax0 = a.x - a.nx * PATH_HALF_WIDTH, az0 = a.z - a.nz * PATH_HALF_WIDTH
    const ax1 = a.x + a.nx * PATH_HALF_WIDTH, az1 = a.z + a.nz * PATH_HALF_WIDTH
    const bx0 = b.x - b.nx * PATH_HALF_WIDTH, bz0 = b.z - b.nz * PATH_HALF_WIDTH
    const bx1 = b.x + b.nx * PATH_HALF_WIDTH, bz1 = b.z + b.nz * PATH_HALF_WIDTH
    // Both edges of a row share its Y so the strip never twists.
    pos.push(ax0, a.y, az0, ax1, a.y, az1, bx1, b.y, bz1, ax0, a.y, az0, bx1, b.y, bz1, bx0, b.y, bz0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

function buildFlagGeometry(): THREE.BufferGeometry {
  const half = FLAG_SPACING * 0.42
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-half, 0, 0, half, 0, 0, 0, -FLAG_DROP, 0], 3))
  g.computeVertexNormals()
  return g
}

/** Stalls, string lights, bunting and paths: static, one draw call per kind of piece. */
export default function Midway({ layout }: { layout: ThemeParkLayout }) {
  const { stalls, lightPoles, buntingPoles, lightWires, buntingWires, bulbs, flags, path } = layout

  const stallGeometries = useMemo(() => buildStallGeometries(), [])
  useEffect(
    () => () => stallGeometries.forEach((g) => (g.neutral.dispose(), g.accent.dispose())),
    [stallGeometries],
  )

  const assets = useMemo(() => {
    const bulbTex = buildDotTexture()
    return {
      stallNeutral: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, specular: '#222222', shininess: 20 }),
      stallAccent: new THREE.MeshPhongMaterial({ flatShading: true, side: THREE.DoubleSide, specular: '#333333', shininess: 30 }),
      poleMat: new THREE.MeshPhongMaterial({ color: '#f4f0e8', flatShading: true }),
      wireGeo: buildWireGeometry([...lightWires, ...buntingWires]),
      wireMat: new THREE.LineBasicMaterial({ color: '#2a2a2a' }),
      bulbGeo: buildBulbGeometry(bulbs),
      bulbTex,
      bulbMat: new THREE.PointsMaterial({
        size: 2.8,
        vertexColors: true,
        map: bulbTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
      flagGeo: buildFlagGeometry(),
      flagMat: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
      pathGeo: buildPathGeometry(path),
      pathMat: new THREE.MeshLambertMaterial({
        color: '#e2cfa3',
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    }
  }, [lightWires, buntingWires, bulbs, path])
  useEffect(() => () => Object.values(assets).forEach((a) => a.dispose()), [assets])

  const byVariant = useMemo(
    () => stallGeometries.map((_, v) => stalls.filter((s) => s.variant === v)),
    [stallGeometries, stalls],
  )
  const flagColors = useMemo(() => paletteColors(flags.map((_, i) => i % PALETTE.length)), [flags])

  return (
    <>
      {stallGeometries.map((geometry, v) => (
        <StallVariant
          key={v}
          geometry={geometry}
          stalls={byVariant[v]}
          neutralMat={assets.stallNeutral}
          accentMat={assets.stallAccent}
        />
      ))}
      <Poles poles={lightPoles} material={assets.poleMat} />
      <Poles poles={buntingPoles} material={assets.poleMat} />
      <StaticInstances placements={flags} colors={flagColors} geometry={assets.flagGeo} material={assets.flagMat} />
      <lineSegments geometry={assets.wireGeo} material={assets.wireMat} />
      <points geometry={assets.bulbGeo} material={assets.bulbMat} />
      {/* Drawn after the terrain it lies on; depthWrite off + polygon offset avoid z-fighting. */}
      <mesh geometry={assets.pathGeo} material={assets.pathMat} renderOrder={1} />
    </>
  )
}
