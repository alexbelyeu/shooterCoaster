import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, PerspectiveCamera, Float } from '@react-three/drei'
import * as THREE from 'three'
import { createRng } from '@/utils/rng'
import FerrisWheel from '@/levels/environments/FerrisWheel'
import Carousel from '@/levels/environments/Carousel'
import { BLEND_S, beatLockedRate, blendPose, titleCameraPose, titleShotS, type TitleCameraMode, type Vec3 } from './titleCamera'
import { CROSSING_LOOP, createTitleRide, type TitleRide } from './titleCoaster'
import TitleCoaster, { type CoasterLivery, type TitleClock } from './TitleCoaster'
import TitlePark from './TitlePark'
import TitleRides, { createTitleWaterMaterial } from './TitleRides'
import { CAROUSELS, FERRIS_WHEEL, TENT_RING, clearOfCrossing } from './titlePark'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import type { YawPlacement } from '@/levels/environments/shared/yawScaleMatrix'
import { consumeClickSwallow, isTitleAttract } from './titleAttract'
import TitleSparkles from './TitleSparkles'
import { audioNow } from '@/audio/AudioEngine'
import { titleBeatGrid } from '@/audio/titleMusic'
import { isUiTarget } from '@/input/pointerInput'
import { markStartup } from '@/core/startupMarks'
import { e2eTitleTime } from '@/testing/e2eHook'
import { prefetchLevelScene } from './loadLevelScene'

const TENT_COLORS = ['#ff4444', '#ff8800', '#4488ff', '#44cc44', '#ff44ff', '#ffffff']
const BALLOON_DRIFT_RAD_S = 0.04
const CROSSING_LIVERY: CoasterLivery = { rail: [0.92, 0.95, 1], spine: [0.15, 0.55, 1], body: '#2f6fd6', seat: '#1d4a9a' }
const BALLOON_COLORS = ['#ff4444', '#ff8800', '#ffcc00', '#44cc44', '#4488ff', '#ff44ff', '#ffffff', '#cc33ff', '#ff6688', '#44dddd']

/** Caps the first frames' camera step: their shader compiles (seconds on a phone) must not jump the fly-by off the poster's still. */
const FIRST_FRAMES = 5
const FIRST_FRAME_STEP_S = 0.1

/** Fly-by camera over `titleCamera.ts`'s menu or attract sequence, blending when the mode changes; advances `clock`. */
function FlyByCamera({ ride, clock }: { ride: TitleRide; clock: TitleClock }) {
  const camRef = useRef<THREE.PerspectiveCamera>(null)
  const frames = useRef(0)
  const st = useRef({ menu: 0, attract: 0, mode: 'menu' as TitleCameraMode, switchedAt: -Infinity }).current
  const pos = useRef<Vec3>([0, 0, 0]).current
  const target = useRef<Vec3>([0, 0, 0]).current
  const toPos = useRef<Vec3>([0, 0, 0]).current
  const toTarget = useRef<Vec3>([0, 0, 0]).current
  const ctx = useMemo(() => ({ ride, rideTime: 0 }), [ride])

  useFrame((_, delta) => {
    const cam = camRef.current
    if (!cam) return
    markStartup('titleFrame')
    const step = ++frames.current <= FIRST_FRAMES ? Math.min(delta, FIRST_FRAME_STEP_S) : delta
    const held = e2eTitleTime()
    if (held !== null) {
      clock.scene = ctx.rideTime = held
      titleCameraPose(held, ctx, pos, target, isTitleAttract() ? 'attract' : 'menu')
    } else {
      clock.scene += step
      ctx.rideTime = clock.scene
      const mode: TitleCameraMode = isTitleAttract() ? 'attract' : 'menu'
      if (mode !== st.mode) {
        // Switching mid-blend keeps the pose continuous: pick the blend up where it stands.
        const since = clock.scene - st.switchedAt
        st.switchedAt = since < BLEND_S ? clock.scene - (BLEND_S - since) : clock.scene
        st.mode = mode
        if (mode === 'attract') st.attract = 0
      }
      const grid = titleBeatGrid()
      const rate = beatLockedRate(st[mode], titleShotS(mode), grid, grid ? audioNow() : 0)
      st[mode] += step * rate
      const sinceSwitch = clock.scene - st.switchedAt
      if (sinceSwitch < BLEND_S) {
        const from: TitleCameraMode = mode === 'menu' ? 'attract' : 'menu'
        titleCameraPose(st[from], ctx, pos, target, from)
        titleCameraPose(st[mode], ctx, toPos, toTarget, mode)
        blendPose(pos, target, toPos, toTarget, sinceSwitch / BLEND_S)
      } else {
        titleCameraPose(st[mode], ctx, pos, target, mode)
      }
    }
    cam.position.set(pos[0], pos[1], pos[2])
    cam.lookAt(target[0], target[1], target[2])
  })

  return <PerspectiveCamera ref={camRef} makeDefault fov={55} near={1} far={2000} />
}

const TENTS: YawPlacement[] = Array.from({ length: TENT_RING.count }, (_, i) => {
  const a = (i / TENT_RING.count) * Math.PI * 2
  return { x: Math.cos(a) * TENT_RING.r, y: 0, z: Math.sin(a) * TENT_RING.r, yaw: 0 }
})

const FLAG_POLES: YawPlacement[] = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + 0.26
  const r = 80 + (i % 3) * 18
  return { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, yaw: 0 }
})

/** The tent ring and the flag poles: four draw calls. */
function TentsAndFlags() {
  const assets = useMemo(
    () => ({
      tentRoof: new THREE.ConeGeometry(18, 28, 6).translate(0, 20, 0),
      tentBase: new THREE.CylinderGeometry(17, 17, 12, 6).translate(0, 6, 0),
      pole: new THREE.CylinderGeometry(0.5, 0.5, 40, 4).translate(0, 20, 0),
      flag: new THREE.BoxGeometry(5, 3.5, 0.3).translate(3, 37, 0),
      white: new THREE.MeshStandardMaterial({ color: '#eeeeee' }),
      grey: new THREE.MeshStandardMaterial({ color: '#999999' }),
      tinted: new THREE.MeshStandardMaterial(),
    }),
    [],
  )
  useEffect(() => () => Object.values(assets).forEach((a) => a.dispose()), [assets])
  const tentColors = useMemo(() => TENTS.map((_, i) => new THREE.Color(TENT_COLORS[i % TENT_COLORS.length])), [])
  const flagColors = useMemo(() => FLAG_POLES.map((_, i) => new THREE.Color(TENT_COLORS[i % TENT_COLORS.length])), [])
  return (
    <>
      <StaticInstances placements={TENTS} colors={tentColors} geometry={assets.tentRoof} material={assets.tinted} />
      <StaticInstances placements={TENTS} geometry={assets.tentBase} material={assets.white} />
      <StaticInstances placements={FLAG_POLES} geometry={assets.pole} material={assets.grey} />
      <StaticInstances placements={FLAG_POLES} colors={flagColors} geometry={assets.flag} material={assets.tinted} />
    </>
  )
}

/** Pop particle burst — small spheres that fly outward then fade */
function PopBurst({ position, color }: { position: THREE.Vector3; color: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<THREE.Vector3[]>([])
  const velocitiesRef = useRef<THREE.Vector3[]>([])
  const [visible, setVisible] = useState(true)
  const elapsed = useRef(0)

  useMemo(() => {
    // eslint-disable-next-line sc/no-math-random -- cosmetic: a pop's spark directions
    const jitter = Math.random
    const pts: THREE.Vector3[] = []
    const vels: THREE.Vector3[] = []
    for (let i = 0; i < 8; i++) {
      pts.push(new THREE.Vector3())
      vels.push(
        new THREE.Vector3(
          (jitter() - 0.5) * 40,
          jitter() * 30 + 10,
          (jitter() - 0.5) * 40,
        ),
      )
    }
    particlesRef.current = pts
    velocitiesRef.current = vels
  }, [])

  useFrame((_, delta) => {
    if (!visible || !groupRef.current) return
    elapsed.current += delta
    if (elapsed.current > 0.6) {
      setVisible(false)
      return
    }
    const children = groupRef.current.children as THREE.Mesh[]
    for (let i = 0; i < children.length; i++) {
      const vel = velocitiesRef.current[i]
      children[i].position.addScaledVector(vel, delta)
      vel.y -= 60 * delta // gravity
      const scale = Math.max(0, 1 - elapsed.current / 0.6)
      children[i].scale.setScalar(scale)
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={position}>
      {particlesRef.current.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.8, 6, 6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

function ShootableBalloon({
  position,
  color,
  onPop,
}: {
  position: [number, number, number]
  color: string
  onPop: (worldPos: THREE.Vector3, color: string) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const _wp = useRef(new THREE.Vector3()).current
  const [alive, setAlive] = useState(true)
  const popScale = useRef(1)
  const [fullyGone, setFullyGone] = useState(false)

  useFrame((_, delta) => {
    if (!alive && groupRef.current) {
      popScale.current = Math.max(0, popScale.current - delta * 8)
      groupRef.current.scale.setScalar(popScale.current)
      if (popScale.current <= 0) setFullyGone(true)
    }
  })

  const handleClick = useCallback(
    (e: THREE.Event & { stopPropagation: () => void }) => {
      if (!alive) return
      e.stopPropagation()
      setAlive(false)
      if (groupRef.current) {
        groupRef.current.getWorldPosition(_wp)
        onPop(_wp, color)
      }
    },
    [alive, color, onPop],
  )

  if (fullyGone) return null

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={2} floatingRange={[-1, 1]}>
      <group ref={groupRef} position={position} onClick={handleClick}>
        {/* Balloon body — larger hitbox sphere */}
        <mesh>
          <sphereGeometry args={[3, 10, 8]} />
          <meshStandardMaterial color={color} roughness={0.2} metalness={0.1} />
        </mesh>
        {/* Knot */}
        <mesh position={[0, -3.2, 0]}>
          <coneGeometry args={[0.8, 2, 6]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* String */}
        <mesh position={[0, -8, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 8, 4]} />
          <meshStandardMaterial color="#999999" />
        </mesh>
      </group>
    </Float>
  )
}

function Balloons() {
  const balloonData = useMemo(() => {
    const rng = createRng(101)
    const items: { pos: [number, number, number]; color: string }[] = []
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + 0.5
      const r = 40 + (i % 4) * 25
      items.push({
        pos: [Math.cos(angle) * r, 45 + rng() * 20, Math.sin(angle) * r],
        color: BALLOON_COLORS[i],
      })
    }
    return items
  }, [])

  const [pops, setPops] = useState<{ id: number; pos: THREE.Vector3; color: string }[]>([])
  const popId = useRef(0)
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const rafIdsRef = useRef<number[]>([])

  const handlePop = useCallback((worldPos: THREE.Vector3, color: string) => {
    const id = popId.current++
    // Next frame, so the click frame stays light.
    const rafId = requestAnimationFrame(() => {
      setPops((prev) => [...prev, { id, pos: worldPos.clone(), color }])
      const timeoutId = setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 700)
      timeoutIdsRef.current.push(timeoutId)
    })
    rafIdsRef.current.push(rafId)
  }, [])

  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutIdsRef.current) clearTimeout(timeoutId)
      timeoutIdsRef.current = []
      for (const rafId of rafIdsRef.current) cancelAnimationFrame(rafId)
      rafIdsRef.current = []
    }
  }, [])

  // Bursts stay outside the drift, where the balloon popped.
  const driftRef = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (driftRef.current) driftRef.current.rotation.y += BALLOON_DRIFT_RAD_S * delta
  })

  return (
    <group>
      <group ref={driftRef}>
        {balloonData.map((b, i) => (
          <ShootableBalloon key={i} position={b.pos} color={b.color} onPop={handlePop} />
        ))}
      </group>
      {pops.map((p) => (
        <PopBurst key={p.id} position={p.pos} color={p.color} />
      ))}
    </group>
  )
}

/** Raycasts window clicks into the R3F scene for title-screen balloon popping */
function TitleClickRaycaster() {
  const { camera, scene, size } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // The tap that ended attract mode only brings the menu back: not PLAY, not a balloon.
      if (consumeClickSwallow()) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      // A click on a button or a dialog (Settings over the title) is the UI's; stopping it here would swallow it.
      if (isUiTarget(e.target) || (e.target instanceof Element && e.target.closest('[role="dialog"]'))) return
      ndc.set(
        (e.clientX / size.width) * 2 - 1,
        -(e.clientY / size.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object
        while (obj) {
          const handlers = (obj as unknown as Record<string, unknown>).__r3f as
            | { eventCount?: number; handlers?: Record<string, (e: unknown) => void> }
            | undefined
          if (handlers?.handlers?.onClick) {
            e.preventDefault()
            e.stopPropagation()
            handlers.handlers.onClick({
              stopPropagation: () => {},
              object: hits[0].object,
              point: hits[0].point,
              distance: hits[0].distance,
            })
            break
          }
          obj = obj.parent
        }
      }
    }
    window.addEventListener('click', onClick, { capture: true })
    return () => window.removeEventListener('click', onClick, { capture: true })
  }, [camera, scene, size, raycaster, ndc])

  return null
}

/** Living theme-park panorama for the title screen */
export default function TitleScene() {
  useEffect(prefetchLevelScene, [])
  const ride = useMemo(() => createTitleRide(), [])
  const crossingRide = useMemo(() => createTitleRide(CROSSING_LOOP), [])
  const clock = useRef<TitleClock>({ scene: 0 }).current
  const water = useMemo(createTitleWaterMaterial, [])
  useEffect(() => () => water.dispose(), [water])
  useFrame(() => {
    water.uniforms.uTime.value = clock.scene
  })

  return (
    <>
      <FlyByCamera ride={ride} clock={clock} />

      {/* Golden-hour sunset sky */}
      <Sky distance={4500} sunPosition={[50, 10, -100]} />

      {/* Warm lighting */}
      <hemisphereLight color="#fff0e0" groundColor="#553311" intensity={0.8} />
      <directionalLight position={[50, 80, -40]} color="#ffd4a0" intensity={1.5} castShadow={false} />
      <ambientLight intensity={0.3} />

      {/* Ground, paths, midway, crowds, trees and the lake; wide enough that the chase shots never see the ground's edge */}
      <TitlePark water={water} />

      {/* Rides */}
      {/* The coaster runs under the wheel's rim, outside its legs (titleCoaster.test.ts). */}
      <FerrisWheel position={[FERRIS_WHEEL.x, 0, FERRIS_WHEEL.z]} radius={FERRIS_WHEEL.radius} />
      {CAROUSELS.map((c) => (
        <Carousel key={c.x} position={[c.x, 0, c.z]} radius={c.radius} />
      ))}
      <TitleRides clock={clock} water={water} />

      <TitleCoaster ride={ride} clock={clock} keepColumn={clearOfCrossing} />
      <TitleCoaster ride={crossingRide} clock={clock} livery={CROSSING_LIVERY} name="title-crossing" />

      {/* Decorations */}
      <TentsAndFlags />
      <Balloons />

      <TitleSparkles />

      {/* Click-to-pop raycaster */}
      <TitleClickRaycaster />
    </>
  )
}
