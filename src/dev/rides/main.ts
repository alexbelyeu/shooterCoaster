import * as THREE from 'three'
import { buildArcTable } from '@/track/arcLength'
import { buildTrackGeometry } from '@/track/trackGeometry'
import { getTrackDimensions } from '@/track/trackDimensions'
import { createSeatPose, seatPose } from '@/track/seatPose.hot'
import { DEMO_EYE, buildDemoRide, markerT } from '@/track/elements/demoRide'
import type { MarkerKind } from '@/track/elements/rideBuilder'

/**
 * Dev-only (#698): the ride elements demo circuit ridden by the game's seat (`seatPose`, what `CoasterCamera`
 * rides), one cell per moment, plus a shot aimed and fired by the game's raycast at a target while upside down.
 * Never part of the game's build (`vite build --mode turntable`, `npm run turntable -- --rides`).
 */
interface RidesApi {
  done: boolean
  cells: { label: string; t: number; upY: number; coverage: number }[]
  aim: { hit: boolean; upY: number; ndc: [number, number] } | null
}

declare global {
  interface Window {
    __RIDES__?: RidesApi
  }
}

const CELL = { width: 320, height: 200 }
const SKY = new THREE.Color('#8fb8de')

interface Moment {
  label: string
  kind: MarkerKind
  at: number
}

const phases = (kind: MarkerKind, name: string): Moment[] =>
  [0.15, 0.35, 0.5, 0.75].map((at) => ({ label: `${name} ${Math.round(at * 100)}%`, kind, at }))

const MOMENTS: Moment[] = [
  ...phases('verticalLoop', 'loop'),
  ...phases('zeroGRoll', 'zero-g roll'),
  ...phases('corkscrew', 'corkscrew'),
  { label: 'heartline roll', kind: 'heartlineRoll', at: 0.5 },
  { label: 'airtime (slow-mo)', kind: 'slowMotion', at: 0.5 },
  { label: 'helix', kind: 'helix', at: 0.5 },
  { label: 'head-chopper', kind: 'headChopper', at: 0.1 },
  { label: 'banked turn', kind: 'bankedTurn', at: 0.5 },
]

const ride = buildDemoRide()
const table = buildArcTable(ride.curve)
const dims = getTrackDimensions({ scalar: 20 })

const scene = new THREE.Scene()
scene.background = SKY
scene.fog = new THREE.Fog(SKY, 150, 700)
scene.add(new THREE.HemisphereLight('#dfefff', '#5b6b3a', 1.6))
const sun = new THREE.DirectionalLight('#fff4e0', 2.2)
sun.position.set(80, 160, 60)
scene.add(sun)

const disposables: { dispose(): void }[] = []
const add = <T extends THREE.Object3D>(o: T) => (scene.add(o), o)
const grassMaterial = new THREE.MeshStandardMaterial({ color: '#6f8f4a', roughness: 1 })
const grass = new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2)
add(new THREE.Mesh(grass, grassMaterial))
const grid = add(new THREE.GridHelper(2000, 100, '#4f6a33', '#5d7a3c'))
grid.position.y = 0.05
const trackGeometry = buildTrackGeometry(ride.curve, table, dims, 4000, [0.85, 0.2, 0.15], [0.95, 0.85, 0.3])
const trackMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 })
add(new THREE.Mesh(trackGeometry, trackMaterial))
const { min, max } = ride.beam
const beamGeometry = new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z)
const beamMaterial = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.8 })
add(new THREE.Mesh(beamGeometry, beamMaterial)).position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2)
disposables.push(grass, grassMaterial, grid, trackGeometry, trackMaterial, beamGeometry, beamMaterial)

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(CELL.width, CELL.height)
renderer.toneMapping = THREE.ACESFilmicToneMapping
const camera = new THREE.PerspectiveCamera(70, CELL.width / CELL.height, 0.5, 2000)
const pose = createSeatPose()

/** Poses the camera the way `CoasterCamera` does on the ride (undamped). */
function ridePose(t: number): number {
  seatPose(ride.curve, table, t, dims.trackScale, DEMO_EYE, pose)
  camera.position.copy(pose.eye)
  camera.up.copy(pose.up)
  camera.lookAt(pose.eye.clone().add(pose.look))
  camera.updateMatrixWorld()
  return pose.up.y
}

const main = document.createElement('main')
main.style.cssText = `display:grid;grid-template-columns:repeat(4,${CELL.width}px);gap:8px;padding:12px`
document.getElementById('root')!.append(main)

/** Renders the current view into a new captioned cell; returns the share of pixels that aren't sky. */
function cell(label: string): number {
  renderer.render(scene, camera)
  const figure = document.createElement('figure')
  figure.style.margin = '0'
  const caption = document.createElement('figcaption')
  caption.textContent = label
  caption.style.height = '18px'
  const canvas = document.createElement('canvas')
  canvas.width = CELL.width
  canvas.height = CELL.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(renderer.domElement, 0, 0)
  figure.append(caption, canvas)
  main.append(figure)
  const px = ctx.getImageData(0, 0, CELL.width, CELL.height).data
  let drawn = 0
  for (let i = 0; i < px.length; i += 16) if (Math.abs(px[i] - px[0]) + Math.abs(px[i + 2] - px[2]) > 24) drawn++
  return drawn / (px.length / 16)
}

const api: RidesApi = { done: false, cells: [], aim: null }
window.__RIDES__ = api

for (const m of MOMENTS) {
  const t = markerT(ride, m.kind, m.at)
  const upY = ridePose(t)
  const label = `${m.label} · up.y ${upY.toFixed(2)}`
  api.cells.push({ label, t, upY, coverage: cell(label) })
}

// Upside down at the loop's apex: a target up-screen and to the side, shot the way `fireAtNDC` shoots.
{
  const t = markerT(ride, 'verticalLoop', 0.5)
  const upY = ridePose(t)
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  const target = pose.eye.clone().addScaledVector(pose.look, 45).addScaledVector(pose.up, 7).addScaledVector(right, 9)
  const targetGeometry = new THREE.SphereGeometry(2.5, 16, 12)
  const targetMaterial = new THREE.MeshStandardMaterial({ color: '#ff3df0', emissive: '#7a0070' })
  const sphere = add(new THREE.Mesh(targetGeometry, targetMaterial))
  sphere.position.copy(target)
  sphere.updateMatrixWorld()
  const ndc = target.clone().project(camera)
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera)
  const hit = raycaster.intersectObject(sphere)[0]
  const muzzle = pose.eye.clone().addScaledVector(pose.up, -1.5).addScaledVector(pose.look, 2)
  const tracerGeometry = new THREE.BufferGeometry().setFromPoints([muzzle, hit?.point ?? raycaster.ray.at(200, new THREE.Vector3())])
  const tracerMaterial = new THREE.LineBasicMaterial({ color: '#fff36b' })
  add(new THREE.Line(tracerGeometry, tracerMaterial))
  disposables.push(targetGeometry, targetMaterial, tracerGeometry, tracerMaterial)
  api.aim = { hit: !!hit, upY, ndc: [ndc.x, ndc.y] }
  const label = `aim upside down · ${hit ? 'HIT' : 'MISS'} at (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`
  api.cells.push({ label, t, upY, coverage: cell(label) })
}

// The whole circuit from outside.
{
  const box = new THREE.Box3()
  for (let i = 0; i < table.count; i++) box.expandByPoint(new THREE.Vector3(table.x[i], table.y[i], table.z[i]))
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3()).length()
  camera.up.set(0, 1, 0)
  camera.position.set(center.x - size * 0.3, center.y + size * 0.22, center.z - size * 0.12)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  api.cells.push({ label: 'overview', t: 0, upY: 1, coverage: cell('overview') })
}

for (const d of disposables) d.dispose()
renderer.dispose()
api.done = true
