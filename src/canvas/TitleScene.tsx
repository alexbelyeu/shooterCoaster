import { useRef, useMemo, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, PerspectiveCamera, Float } from '@react-three/drei'
import * as THREE from 'three'
import { createRng } from '@/utils/rng'
import FerrisWheel from '@/levels/environments/FerrisWheel'
import Carousel from '@/levels/environments/Carousel'
import { BLEND_S, beatLockedRate, blendPose, titleCameraPose, titleShotS, type TitleCameraMode, type Vec3 } from './titleCamera'
import { createTitleRide, type TitleRide } from './titleCoaster'
import TitleCoaster, { type TitleClock } from './TitleCoaster'
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

function Tents() {
  const tents = useMemo(() => {
    const items: { pos: [number, number, number]; color: string }[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const r = 120
      items.push({
        pos: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
        color: TENT_COLORS[i % TENT_COLORS.length],
      })
    }
    return items
  }, [])

  return (
    <group>
      {tents.map((t, i) => (
        <group key={i} position={t.pos}>
          <mesh position={[0, 20, 0]}>
            <coneGeometry args={[18, 28, 6]} />
            <meshStandardMaterial color={t.color} />
          </mesh>
          <mesh position={[0, 6, 0]}>
            <cylinderGeometry args={[17, 17, 12, 6]} />
            <meshStandardMaterial color="#eeeeee" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function FlagPoles() {
  const poles = useMemo(() => {
    const items: { pos: [number, number, number]; color: string }[] = []
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.26
      const r = 80 + (i % 3) * 18
      items.push({
        pos: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
        color: TENT_COLORS[i % TENT_COLORS.length],
      })
    }
    return items
  }, [])

  return (
    <group>
      {poles.map((p, i) => (
        <group key={i} position={p.pos}>
          <mesh position={[0, 20, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 40, 4]} />
            <meshStandardMaterial color="#999999" />
          </mesh>
          <mesh position={[3, 37, 0]}>
            <boxGeometry args={[5, 3.5, 0.3]} />
            <meshStandardMaterial color={p.color} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** ~30 emissive bulbs in catenary arcs between tent positions */
function StringLights() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const count = 30

  const positions = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let arc = 0; arc < 5; arc++) {
      const a1 = (arc / 6) * Math.PI * 2
      const a2 = ((arc + 1) / 6) * Math.PI * 2
      const r = 120
      const x1 = Math.cos(a1) * r
      const z1 = Math.sin(a1) * r
      const x2 = Math.cos(a2) * r
      const z2 = Math.sin(a2) * r

      for (let j = 0; j < 6; j++) {
        const t = (j + 1) / 7
        const x = x1 + (x2 - x1) * t
        const z = z1 + (z2 - z1) * t
        const sag = Math.sin(t * Math.PI) * 8
        const y = 36 - sag
        pts.push([x, y, z])
      }
    }
    return pts
  }, [])

  useLayoutEffect(() => {
    if (!meshRef.current) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const [x, y, z] = positions[i] || [0, 0, 0]
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [positions])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffcc44" emissiveIntensity={3} />
    </instancedMesh>
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
    const pts: THREE.Vector3[] = []
    const vels: THREE.Vector3[] = []
    for (let i = 0; i < 8; i++) {
      pts.push(new THREE.Vector3())
      vels.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 40,
          Math.random() * 30 + 10,
          (Math.random() - 0.5) * 40,
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
  const ride = useMemo(createTitleRide, [])
  const clock = useRef<TitleClock>({ scene: 0 }).current

  return (
    <>
      <FlyByCamera ride={ride} clock={clock} />

      {/* Golden-hour sunset sky */}
      <Sky distance={4500} sunPosition={[50, 10, -100]} />

      {/* Warm lighting */}
      <hemisphereLight color="#fff0e0" groundColor="#553311" intensity={0.8} />
      <directionalLight position={[50, 80, -40]} color="#ffd4a0" intensity={1.5} castShadow={false} />
      <ambientLight intensity={0.3} />

      {/* Green ground, wide enough that the chase shots, looking along the loop, never see its edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color="#2d5a1e" />
      </mesh>

      {/* Rides */}
      {/* The coaster runs under the wheel's rim, outside its legs (titleCoaster.test.ts). */}
      <FerrisWheel position={[50, 0, -75]} radius={80} />
      <Carousel position={[-60, 0, -40]} radius={25} />
      <Carousel position={[20, 0, 60]} radius={20} />

      <TitleCoaster ride={ride} clock={clock} />

      {/* Decorations */}
      <Tents />
      <FlagPoles />
      <StringLights />
      <Balloons />

      <TitleSparkles />

      {/* Click-to-pop raycaster */}
      <TitleClickRaycaster />
    </>
  )
}
