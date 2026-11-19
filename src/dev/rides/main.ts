import * as THREE from 'three'
import { buildArcTable, tAtLoopDistance } from '@/track/arcLength'
import { buildTrackGeometry } from '@/track/trackGeometry'
import { buildMechanicsRide } from '@/track/elements/mechanicsRide'
import { dropPieceLength, trackGaps, withMechanics } from '@/track/mechanics'
import { dropHeading, dropPiecePosition } from '@/track/mechanics.hot'
import { buildDropPieceGeometry, buildMechanicsGeometry } from '@/track/mechanicsGeometry'
import { buildRidePlan, planDistance, planStopShare, planTimeAt } from '@/track/rideV2'
import type { RideMechanic } from '@/types/level'
import { getTrackDimensions } from '@/track/trackDimensions'
import { createSeatPose, seatPose } from '@/track/seatPose.hot'
import { DEMO_EYE, buildDemoRide, markerT } from '@/track/elements/demoRide'
import type { MarkerKind } from '@/track/elements/rideBuilder'

/**
 * Dev-only (#698): the ride elements demo circuit ridden by the game's seat (`seatPose`, what `CoasterCamera`
 * rides), one cell per moment, plus a shot aimed and fired by the game's raycast at a target while upside down; then
 * the special mechanics' circuit (#699): the station, the jump gap, the drop track, the backwards stretch (and a shot
 * fired facing back), each posed at a moment of its solved v2 ride.
 * Never part of the game's build (`vite build --mode turntable`, `npm run turntable -- --rides`).
 */
interface RidesApi {
  done: boolean
  cells: { label: string; t: number; upY: number; coverage: number }[]
  aim: { hit: boolean; upY: number; ndc: [number, number] } | null
  /** The shot fired riding backwards (#699): it must hit with the view facing back down the track. */
  aimBack: { hit: boolean; facing: number } | null
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

/** Renders the current view of `world` into a new captioned cell; returns the share of pixels that aren't sky. */
function cell(label: string, world: THREE.Scene = scene): number {
  renderer.render(world, camera)
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

const api: RidesApi = { done: false, cells: [], aim: null, aimBack: null }
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

/** A circuit from outside. */
function overview(label: string, circuit: typeof table, world: THREE.Scene) {
  const box = new THREE.Box3()
  for (let i = 0; i < circuit.count; i++) box.expandByPoint(new THREE.Vector3(circuit.x[i], circuit.y[i], circuit.z[i]))
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3()).length()
  camera.up.set(0, 1, 0)
  camera.position.set(center.x - size * 0.3, center.y + size * 0.22, center.z - size * 0.12)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  api.cells.push({ label, t: 0, upY: 1, coverage: cell(label, world) })
}
overview('overview', table, scene)

// The special mechanics (#699) on their own circuit, a v2 ride, posed at moments of its solved plan.
{
  const mech = buildMechanicsRide()
  const mechTable = buildArcTable(mech.curve)
  const plan = buildRidePlan(mechTable, withMechanics(mech.spec, mech.mechanics, mechTable.length))
  const world = new THREE.Scene()
  world.background = SKY
  world.fog = scene.fog
  world.add(new THREE.HemisphereLight('#dfefff', '#5b6b3a', 1.6), sun.clone(), new THREE.Mesh(grass, grassMaterial), grid.clone())
  const pieceLength = dropPieceLength(DEMO_EYE)
  const red: [number, number, number] = [0.85, 0.2, 0.15]
  const yellow: [number, number, number] = [0.95, 0.85, 0.3]
  const rails = buildTrackGeometry(mech.curve, mechTable, dims, 4000, red, yellow, trackGaps(mech.mechanics, mechTable.length, pieceLength))
  const structures = buildMechanicsGeometry(mech.curve, mechTable, mech.mechanics, dims)!
  const structureMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 })
  const pieceGeometry = buildDropPieceGeometry(dims, red, yellow)
  world.add(new THREE.Mesh(rails, trackMaterial), new THREE.Mesh(structures, structureMaterial))
  const find = (kind: RideMechanic['kind']) => mech.mechanics.find((m) => m.kind === kind)!
  const drop = find('dropTrack')
  const piece = new THREE.Mesh(pieceGeometry, trackMaterial)
  piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dropHeading(mech.curve, drop, new THREE.Vector3()))
  world.add(piece)
  disposables.push(rails, structures, structureMaterial, pieceGeometry)

  /** Poses the seat and the drop's piece the way the game does `time` seconds after GO. */
  const poseAt = (time: number) => {
    const t = tAtLoopDistance(mechTable, planDistance(plan, time))
    seatPose(mech.curve, mechTable, t, dims.trackScale, DEMO_EYE, pose, mech.mechanics, planStopShare(plan, time))
    dropPiecePosition(mech.curve, drop, t, pieceLength / 2 / mechTable.length, piece.position)
    piece.updateMatrixWorld()
    camera.position.copy(pose.eye)
    camera.up.copy(pose.up)
    camera.lookAt(pose.eye.clone().add(pose.look))
    camera.updateMatrixWorld()
    return t
  }
  const timeOf = (m: RideMechanic, at: number) => planTimeAt(plan, (m.from + (m.to - m.from) * at) * mechTable.length)
  const stopOf = (share: number) => plan.stops.find((s) => Math.abs(s.distance - share * mechTable.length) < 1e-6)!
  const midStop = (share: number) => (stopOf(share).start + stopOf(share).end) / 2
  const station = find('station')
  const gap = find('jumpGap')
  const back = find('backwards')
  const moments: [string, number][] = [
    ['station (countdown)', 0],
    ['station launch', timeOf(station, 0.5)],
    ['jump: the lip', timeOf(gap, 0)],
    ['jump: mid-air', timeOf(gap, 0.5)],
    ['drop: stopped at the top', midStop(drop.from)],
    ['drop: falling', timeOf(drop, 0.5)],
    ['turntable: turning round', midStop(back.from)],
    ['backwards', timeOf(back, 0.5)],
  ]
  for (const [name, time] of moments) {
    const t = poseAt(time)
    const label = `${name} · ${time.toFixed(1)} s`
    api.cells.push({ label, t, upY: pose.up.y, coverage: cell(label, world) })
  }

  // The jump and the drop from beside the track, mid-way: the open gap, the piece halfway down its shaft.
  for (const [name, m] of [['jump gap from the side', gap], ['drop track from the side', drop]] as const) {
    const t = poseAt(timeOf(m, 0.5))
    const a = mech.curve.getPointAt(m.from).clone()
    const b = mech.curve.getPointAt(m.to).clone()
    const middle = a.clone().add(b).multiplyScalar(0.5)
    const span = Math.max(a.distanceTo(b), 30)
    camera.up.set(0, 1, 0)
    camera.position.copy(middle).add(new THREE.Vector3(-span * 1.3, span * 0.25, -span * 0.3))
    camera.lookAt(middle)
    camera.updateMatrixWorld()
    api.cells.push({ label: name, t, upY: 1, coverage: cell(name, world) })
  }

  // Riding backwards: a target ahead of the view (back down the track), shot the way `fireAtNDC` shoots.
  {
    const t = poseAt(timeOf(back, 0.4))
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const target = pose.eye.clone().addScaledVector(pose.look, 45).addScaledVector(pose.up, 4).addScaledVector(right, -8)
    const targetGeometry = new THREE.SphereGeometry(2.5, 16, 12)
    const targetMaterial = new THREE.MeshStandardMaterial({ color: '#ff3df0', emissive: '#7a0070' })
    const sphere = new THREE.Mesh(targetGeometry, targetMaterial)
    world.add(sphere)
    sphere.position.copy(target)
    sphere.updateMatrixWorld()
    const ndc = target.clone().project(camera)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera)
    const hit = raycaster.intersectObject(sphere)[0]
    const muzzle = pose.eye.clone().addScaledVector(pose.up, -1.5).addScaledVector(pose.look, 2)
    const tracerGeometry = new THREE.BufferGeometry().setFromPoints([muzzle, hit?.point ?? raycaster.ray.at(200, new THREE.Vector3())])
    const tracerMaterial = new THREE.LineBasicMaterial({ color: '#fff36b' })
    world.add(new THREE.Line(tracerGeometry, tracerMaterial))
    disposables.push(targetGeometry, targetMaterial, tracerGeometry, tracerMaterial)
    const facing = pose.look.dot(pose.tangent)
    api.aimBack = { hit: !!hit, facing }
    const label = `aim backwards · ${hit ? 'HIT' : 'MISS'} · look·track ${facing.toFixed(2)}`
    api.cells.push({ label, t, upY: pose.up.y, coverage: cell(label, world) })
  }
  overview('mechanics overview', mechTable, world)
}

for (const d of disposables) d.dispose()
renderer.dispose()
api.done = true
