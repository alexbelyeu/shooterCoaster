import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  FLAG_DROP,
  FLAG_SPACING,
  LIGHT_POLE_HEIGHT,
  PALETTE,
  PATH_HALF_WIDTH,
  type Pole,
  type ThemeParkLayout,
  type Wire,
  wirePoint,
} from './layout'
import { buildStallGeometries } from './stallGeometry'
import { placeInstances } from './instancing'

/** Bulb colours (linear, > 1 so they clear the bloom threshold with toneMapped off). */
const BULB_COLORS = ['#fff2c0', '#ffd040', '#ff6a5a', '#7ad0ff', '#9cff8a'].map((c) =>
  new THREE.Color(c).multiplyScalar(2.4),
)
const WIRE_SEGMENTS = 12

/** One stall variant: neutral (vertex-coloured) + accent (instance-coloured) meshes. */
function StallVariant({
  geometry,
  stalls,
  neutralMat,
  accentMat,
}: {
  geometry: { neutral: THREE.BufferGeometry; accent: THREE.BufferGeometry }
  stalls: ThemeParkLayout['stalls']
  neutralMat: THREE.Material
  accentMat: THREE.Material
}) {
  const placeNeutral = useMemo(() => placeInstances(stalls), [stalls])
  const placeAccent = useMemo(() => placeInstances(stalls, stalls.map((s) => s.color)), [stalls])
  if (stalls.length === 0) return null
  return (
    <>
      <instancedMesh ref={placeNeutral} args={[geometry.neutral, neutralMat, stalls.length]} />
      <instancedMesh ref={placeAccent} args={[geometry.accent, accentMat, stalls.length]} />
    </>
  )
}

/** Wires as line segments: each hanging wire is WIRE_SEGMENTS straight pieces. */
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

/** Soft round dot so Points read as bulbs, not squares. */
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

/** Ribbon through the path rows; gaps where the path is closed (under low track). */
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
    // Both edges of a row share its Y (no twisting); wound to face up.
    pos.push(ax0, a.y, az0, ax1, a.y, az1, bx1, b.y, bz1, ax0, a.y, az0, bx1, b.y, bz1, bx0, b.y, bz0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Pole geometry `height` tall, base at y = 0 (height baked in, never scaled). */
function poleGeometry(height: number) {
  return new THREE.CylinderGeometry(0.5, 0.7, height, 5, 1, true).translate(0, height / 2, 0)
}

function poleInstances(poles: Pole[]) {
  return poles.map((p) => ({ x: p.x, y: p.y, z: p.z, yaw: 0 }))
}

/**
 * The midway along the track: stalls, string lights on poles, bunting across
 * the track and paths between the rides. Every piece is one draw call
 * (InstancedMesh / LineSegments / Points), all static.
 */
export default function Midway({ layout }: { layout: ThemeParkLayout }) {
  const { stalls, lightPoles, buntingPoles, lightWires, buntingWires, bulbs, flags, path } = layout

  // Bunting poles vary in height: one geometry as tall as the tallest, each sunk
  // into the ground so its top meets the rope.
  const buntingPoleHeight = useMemo(() => Math.max(1, ...buntingPoles.map((p) => p.height)), [buntingPoles])
  const buntingPolePlacements = useMemo(
    () => buntingPoles.map((p) => ({ x: p.x, y: p.y + p.height - buntingPoleHeight, z: p.z, yaw: 0 })),
    [buntingPoles, buntingPoleHeight],
  )

  const assets = useMemo(() => {
    const flagGeo = new THREE.BufferGeometry()
    const half = FLAG_SPACING * 0.42
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-half, 0, 0, half, 0, 0, 0, -FLAG_DROP, 0], 3))
    flagGeo.computeVertexNormals()
    return {
      stalls: buildStallGeometries(),
      stallNeutral: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, specular: '#222222', shininess: 20 }),
      stallAccent: new THREE.MeshPhongMaterial({ flatShading: true, side: THREE.DoubleSide, specular: '#333333', shininess: 30 }),
      lightPoleGeo: poleGeometry(LIGHT_POLE_HEIGHT + 1),
      buntingPoleGeo: poleGeometry(buntingPoleHeight),
      poleMat: new THREE.MeshPhongMaterial({ color: '#f4f0e8', flatShading: true }),
      wireGeo: buildWireGeometry([...lightWires, ...buntingWires]),
      wireMat: new THREE.LineBasicMaterial({ color: '#2a2a2a' }),
      bulbGeo: buildBulbGeometry(bulbs),
      bulbTex: buildDotTexture(),
      flagGeo,
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
  }, [lightWires, buntingWires, bulbs, path, buntingPoleHeight])

  const bulbMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 2.8,
        sizeAttenuation: true,
        vertexColors: true,
        map: assets.bulbTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [assets.bulbTex],
  )

  useEffect(() => {
    return () => {
      for (const s of assets.stalls) {
        s.neutral.dispose()
        s.accent.dispose()
      }
      assets.stallNeutral.dispose()
      assets.stallAccent.dispose()
      assets.lightPoleGeo.dispose()
      assets.buntingPoleGeo.dispose()
      assets.poleMat.dispose()
      assets.wireGeo.dispose()
      assets.wireMat.dispose()
      assets.bulbGeo.dispose()
      assets.bulbTex.dispose()
      assets.flagGeo.dispose()
      assets.flagMat.dispose()
      assets.pathGeo.dispose()
      assets.pathMat.dispose()
    }
  }, [assets])
  useEffect(() => () => bulbMat.dispose(), [bulbMat])

  const byVariant = useMemo(
    () => assets.stalls.map((_, v) => stalls.filter((s) => s.variant === v)),
    [assets.stalls, stalls],
  )
  const placeLightPoles = useMemo(() => placeInstances(poleInstances(lightPoles)), [lightPoles])
  const placeBuntingPoles = useMemo(() => placeInstances(buntingPolePlacements), [buntingPolePlacements])
  const placeFlags = useMemo(() => placeInstances(flags, flags.map((_, i) => i % PALETTE.length)), [flags])

  return (
    <>
      {assets.stalls.map((geometry, v) => (
        <StallVariant
          key={v}
          geometry={geometry}
          stalls={byVariant[v]}
          neutralMat={assets.stallNeutral}
          accentMat={assets.stallAccent}
        />
      ))}
      {lightPoles.length > 0 && (
        <instancedMesh ref={placeLightPoles} args={[assets.lightPoleGeo, assets.poleMat, lightPoles.length]} />
      )}
      {buntingPoles.length > 0 && (
        <instancedMesh ref={placeBuntingPoles} args={[assets.buntingPoleGeo, assets.poleMat, buntingPoles.length]} />
      )}
      {flags.length > 0 && <instancedMesh ref={placeFlags} args={[assets.flagGeo, assets.flagMat, flags.length]} />}
      <lineSegments geometry={assets.wireGeo} material={assets.wireMat} />
      <points geometry={assets.bulbGeo} material={bulbMat} />
      <mesh geometry={assets.pathGeo} material={assets.pathMat} renderOrder={1} />
    </>
  )
}
