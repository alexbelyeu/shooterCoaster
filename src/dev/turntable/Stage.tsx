import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { advanceGameTime, resetGameTime } from '@/core/gameClock'
import { useGameStore } from '@/store/useGameStore'
import { ENEMY_COMPONENTS } from '@/entities/enemies/enemyComponents'
import { WALL_STANDOFF } from '@/entities/spawning/enemyPlacement'
import GoldenBalloon from '@/entities/enemies/GoldenBalloon'
import { BOSS_COMPONENTS } from '@/entities/bosses/BossSpawner'
import { getAllLevels } from '@/levels/LevelRegistry'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import Atmosphere from '@/levels/environments/shared/Atmosphere'
import { buildArcTable, type ArcTable } from '@/track/arcLength'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import type { BiomeType, BossType, EnemyType } from '@/types/level'
import { createRng, hashString } from '@/utils/rng'
import KrakenPose from './KrakenPose'
import type { Cell, Subject, SubjectId } from './subjects'

export const BACKGROUND = '#8d9096'
const FOV = 30
/** Radians above the subject's centre. */
const ELEVATION = 0.2
const STEP = 1 / 30

export interface CellResult {
  subject: SubjectId
  caption: string
  /** Fraction of the cell's pixels that differ from the background. */
  coverage: number
}

export interface DrawResult {
  cells: CellResult[]
  /** Mean absolute pixel difference (0–255) between each cell and the one before it. */
  change: number[]
}

/** Drives a board: steps game time to each cell's, then draws that cell's subject into its scissored square. */
export type DrawBoard = (cells: Cell[], squares: HTMLElement[]) => DrawResult

const flatGround = () => 0
const noop = () => {}
const ORIGIN = new THREE.Vector3()

const tracks = new Map<BossType, ArcTable>()
/** The track of the level the boss ends, which the Giant Scorpion lays out its perches on. */
function bossTrack(type: BossType): ArcTable {
  let table = tracks.get(type)
  if (!table) {
    const level = getAllLevels().find((l) => l.boss?.type === type) ?? getAllLevels()[0]
    const { curve, varA, varB, varC, scalar } = level.track
    table = buildArcTable((curve === 'curve2' ? createTrigCurve2 : createTrigCurve)(varA, varB, varC, scalar))
    tracks.set(type, table)
  }
  return table
}

const nativeRandom = Math.random

/**
 * Its own `Math.random` stream, so a subject's random choices (heading, colour, flap phase) are the same every run;
 * the browser's comes back when it unmounts with nothing seeded after it (a new board's subjects render before the old
 * ones unmount, and keep theirs).
 */
function Seeded({ id, children }: { id: string; children: ReactNode }) {
  const seeded = useRef<() => number>(null)
  seeded.current = createRng(hashString(id))
  Math.random = seeded.current
  useEffect(
    () => () => {
      if (Math.random === seeded.current) Math.random = nativeRandom
    },
    [],
  )
  return children
}

function Model({ subject }: { subject: Subject }) {
  const { id } = subject
  if (subject.kind === 'enemy') {
    const Enemy = id === 'goldenBalloon' ? GoldenBalloon : ENEMY_COMPONENTS[id as EnemyType]
    // The spawner mounts golden balloons as type 'balloon' too.
    const type = id === 'goldenBalloon' ? 'balloon' : (id as EnemyType)
    const enemy = <Enemy id={id} type={type} spawnPosition={ORIGIN} scoreValue={0} radius={1} onKill={noop} />
    return subject.stage === 'wall' ? <>{enemy}<ClimbingWall /></> : enemy
  }
  if (id === 'kraken') return <KrakenPose />
  const Boss = BOSS_COMPONENTS[id as BossType]
  return <Boss id={id} active incoming={false} onDone={noop} track={bossTrack(id as BossType)} groundFn={flatGround} />
}

const WALL_HOLDS: readonly [number, number][] = [[-28, 40], [22, 30], [-14, -10], [30, -24], [-30, -40], [8, 52]]

/** A patch of pale gym wall behind a wall enemy, with dark holds: front face only, so the back view sees the climber. */
function ClimbingWall() {
  return (
    <group position={[0, 6, -WALL_STANDOFF]}>
      <mesh>
        <planeGeometry args={[90, 120]} />
        <meshStandardMaterial color="#ddd8cc" roughness={0.9} />
      </mesh>
      {WALL_HOLDS.map(([x, y]) => (
        <mesh key={`${x},${y}`} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.5, 0.8]}>
          <sphereGeometry args={[4, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#2e2a3a" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function StudioLight() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)
    pmrem.dispose()
    room.dispose()
    scene.environment = target.texture
    scene.environmentIntensity = 0.6
    return () => {
      scene.environment = null
      target.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={['#ffffff', '#5c5f66', 1.1]} />
      {/* Key from the camera's upper left, fill from its right, rim from behind. */}
      <directionalLight position={[-3, 4, 4]} intensity={2.2} />
      <directionalLight position={[4, 1, 2]} intensity={0.6} />
      <directionalLight position={[0, 3, -5]} intensity={1.2} />
    </>
  )
}

function Lighting({ biome }: { biome: BiomeType | null }) {
  const fogRef = useRef<THREE.Fog>(null)
  return biome ? <Atmosphere atmosphere={ATMOSPHERES[biome]} fogRef={fogRef} /> : <StudioLight />
}

interface Framing {
  centre: THREE.Vector3
  radius: number
}

const _box = new THREE.Box3()
const _part = new THREE.Box3()
const _size = new THREE.Vector3()
const _centre = new THREE.Vector3()

/** Bounds of what is drawn: hidden parts (a parked weak point, the dormant sand mound) don't count. */
function frameVisible(root: THREE.Object3D): Framing {
  root.updateWorldMatrix(true, true)
  _box.makeEmpty()
  root.traverseVisible((o) => {
    if (!(o instanceof THREE.Mesh)) return
    if (o instanceof THREE.InstancedMesh) {
      o.computeBoundingBox()
      _part.copy(o.boundingBox!)
    } else {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      _part.copy(o.geometry.boundingBox!)
    }
    _box.union(_part.applyMatrix4(o.matrixWorld))
  })
  return { centre: _box.getCenter(new THREE.Vector3()), radius: _box.getSize(_size).length() / 2 }
}

/** Its travel cancelled, and its heading too when `holdHeading` says so: it animates in place. */
function settle(turntable: THREE.Object3D, subject: Subject) {
  const anchor = turntable.children[0]
  if (!anchor) return
  anchor.position.set(0, 0, 0)
  if (subject.holdHeading === 'root') anchor.rotation.y = 0
  else if (subject.holdHeading === 'model' && anchor.children[0]) anchor.children[0].rotation.y = 0
}

export function Stage({
  subjects,
  biome,
  onReady,
}: {
  subjects: readonly Subject[]
  biome: BiomeType | null
  onReady: (draw: DrawBoard) => void
}) {
  const get = useThree((s) => s.get)
  const turntables = useRef(new Map<SubjectId, THREE.Group>()).current
  const drawCell = useRef<(() => void) | null>(null)
  const byId = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  // After every subject's own frame (priority 0): cancel its travel, then draw if a cell is due.
  useFrame(() => {
    for (const [id, turntable] of turntables) settle(turntable, byId.get(id)!)
    drawCell.current?.()
  }, 1)

  useEffect(() => {
    const draw: DrawBoard = (cells, squares) => {
      const { gl, scene, camera, advance } = get()
      const cam = camera as THREE.PerspectiveCamera
      const store = useGameStore
      gl.setSize(window.innerWidth, window.innerHeight)
      gl.setScissorTest(false)
      gl.setClearColor(0x000000, 0)
      gl.clear()
      gl.setScissorTest(true)

      resetGameTime()
      let now = 0
      let stamp = 0
      const framings = new Map<SubjectId, Framing>()
      const results: CellResult[] = []
      const change: number[] = []
      const background = new THREE.Color(BACKGROUND)
      const bg = [1, 3, 5].map((k) => parseInt(BACKGROUND.slice(k, k + 2), 16))
      let previous: Uint8Array | null = null

      cells.forEach((cell, i) => {
        store.setState({ phase: 'playing', timeScale: 1 })
        while (now < cell.time - 1e-6) {
          const dt = Math.min(STEP, cell.time - now)
          now += dt
          stamp += dt
          advanceGameTime(dt)
          advance(stamp)
        }
        // A frame that moves nothing but turns the billboards to this camera: always on +z, so they face it.
        store.setState({ phase: 'paused' })
        const rect = squares[i].getBoundingClientRect()
        const x = Math.round(rect.left)
        const y = Math.round(gl.domElement.clientHeight - rect.bottom)
        const w = Math.round(rect.width)
        const h = Math.round(rect.height)
        drawCell.current = () => {
          for (const [id, t] of turntables) t.visible = id === cell.subject.id
          const turntable = turntables.get(cell.subject.id)!
          let framing = framings.get(cell.subject.id)
          if (!framing) {
            turntable.rotation.set(0, 0, 0)
            turntable.position.set(0, 0, 0)
            framing = frameVisible(turntable)
            framings.set(cell.subject.id, framing)
          }
          // Turn it about its own centre, which stays at the origin the camera looks at.
          turntable.rotation.set(0, cell.yaw, 0)
          turntable.position.copy(framing.centre).applyAxisAngle(THREE.Object3D.DEFAULT_UP, cell.yaw).negate()
          const distance = (framing.radius * 1.04) / Math.sin(THREE.MathUtils.degToRad(FOV / 2))
          cam.fov = FOV
          cam.aspect = w / h
          cam.near = distance / 50
          cam.far = distance * 50
          cam.position.set(0, Math.sin(ELEVATION) * distance, Math.cos(ELEVATION) * distance)
          cam.lookAt(0, 0, 0)
          cam.updateProjectionMatrix()
          gl.setViewport(x, y, w, h)
          gl.setScissor(x, y, w, h)
          gl.setClearColor(background, 1)
          gl.clear()
          gl.render(scene, cam)

          const pixels = new Uint8Array(w * h * 4)
          // The canvas is drawn at 1 CSS pixel per pixel (dpr={1}).
          const ctx = gl.getContext()
          ctx.readPixels(x, y, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels)
          let covered = 0
          let diff = 0
          for (let p = 0; p < pixels.length; p += 4) {
            if (Math.abs(pixels[p] - bg[0]) + Math.abs(pixels[p + 1] - bg[1]) + Math.abs(pixels[p + 2] - bg[2]) > 12) covered++
            if (previous) diff += Math.abs(pixels[p] - previous[p]) + Math.abs(pixels[p + 1] - previous[p + 1]) + Math.abs(pixels[p + 2] - previous[p + 2])
          }
          if (previous) change.push(diff / ((pixels.length / 4) * 3))
          previous = pixels
          results.push({ subject: cell.subject.id, caption: cell.caption, coverage: covered / (pixels.length / 4) })
        }
        advance(stamp)
        drawCell.current = null
      })
      gl.setScissorTest(false)
      return { cells: results, change }
    }
    onReady(draw)
  }, [get, turntables, onReady])

  return (
    <>
      <Lighting biome={biome} />
      {subjects.map((subject) => (
        <group
          key={subject.id}
          visible={false}
          ref={(g) => {
            if (g) turntables.set(subject.id, g)
            else turntables.delete(subject.id)
          }}
        >
          <Seeded id={subject.id}>
            <Model subject={subject} />
          </Seeded>
        </group>
      ))}
    </>
  )
}
