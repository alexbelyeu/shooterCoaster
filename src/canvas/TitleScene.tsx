import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, PerspectiveCamera, Sparkles, Float } from '@react-three/drei'
import * as THREE from 'three'
import FerrisWheel from '@/levels/environments/FerrisWheel'
import Carousel from '@/levels/environments/Carousel'

const TENT_COLORS = ['#ff4444', '#ff8800', '#4488ff', '#44cc44', '#ff44ff', '#ffffff']
const BALLOON_COLORS = ['#ff4444', '#ff8800', '#ffcc00', '#44cc44', '#4488ff', '#ff44ff', '#ffffff', '#cc33ff', '#ff6688', '#44dddd']

/** Orbiting camera that slowly circles the mini theme-park */
function OrbitingCamera() {
  const camRef = useRef<THREE.PerspectiveCamera>(null)

  useFrame(({ clock }) => {
    if (!camRef.current) return
    const t = clock.elapsedTime * 0.08
    const radius = 180
    const height = 60
    camRef.current.position.set(
      Math.cos(t) * radius,
      height + Math.sin(t * 0.5) * 8,
      Math.sin(t) * radius,
    )
    camRef.current.lookAt(0, 30, 0)
  })

  return <PerspectiveCamera ref={camRef} makeDefault fov={55} near={1} far={2000} />
}

/** Ring of 6 colourful tents */
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

/** 12 poles with coloured flags scattered between tents */
function FlagPoles() {
  const poles = useMemo(() => {
    const items: { pos: [number, number, number]; color: string }[] = []
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.26
      const r = 80 + (i % 3) * 30
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

  useMemo(() => {
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
      <sphereGeometry args={[1, 8, 8]} />
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

/** Single balloon that can be popped */
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
      // Get world position of the balloon for pop burst
      if (groupRef.current) {
        const wp = new THREE.Vector3()
        groupRef.current.getWorldPosition(wp)
        onPop(wp, color)
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
          <sphereGeometry args={[3, 12, 12]} />
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

/** Balloons + pop bursts + title-screen click-to-shoot raycasting */
function Balloons() {
  const balloonData = useMemo(() => {
    const items: { pos: [number, number, number]; color: string }[] = []
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + 0.5
      const r = 40 + (i % 4) * 25
      items.push({
        pos: [Math.cos(angle) * r, 45 + Math.random() * 20, Math.sin(angle) * r],
        color: BALLOON_COLORS[i],
      })
    }
    return items
  }, [])

  const [pops, setPops] = useState<{ id: number; pos: THREE.Vector3; color: string }[]>([])
  const popId = useRef(0)

  const handlePop = useCallback((worldPos: THREE.Vector3, color: string) => {
    const id = popId.current++
    setPops((prev) => [...prev, { id, pos: worldPos, color }])
    // Clean up after animation
    setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 700)
  }, [])

  return (
    <group>
      {balloonData.map((b, i) => (
        <ShootableBalloon key={i} position={b.pos} color={b.color} onPop={handlePop} />
      ))}
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
      ndc.set(
        (e.clientX / size.width) * 2 - 1,
        -(e.clientY / size.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      if (hits.length > 0) {
        // Simulate an R3F onClick by finding the first hit object
        // and dispatching a synthetic click event through its handlers
        let obj: THREE.Object3D | null = hits[0].object
        while (obj) {
          const handlers = (obj as unknown as Record<string, unknown>).__r3f as
            | { eventCount?: number; handlers?: Record<string, (e: unknown) => void> }
            | undefined
          if (handlers?.handlers?.onClick) {
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
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [camera, scene, size, raycaster, ndc])

  return null
}

/** Living theme-park panorama for the title screen */
export default function TitleScene() {
  return (
    <>
      <OrbitingCamera />

      {/* Golden-hour sunset sky */}
      <Sky distance={4500} sunPosition={[50, 10, -100]} />

      {/* Warm lighting */}
      <hemisphereLight color="#fff0e0" groundColor="#553311" intensity={0.8} />
      <directionalLight position={[50, 80, -40]} color="#ffd4a0" intensity={1.5} castShadow={false} />
      <ambientLight intensity={0.3} />

      {/* Green ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#2d5a1e" />
      </mesh>

      {/* Rides */}
      <FerrisWheel position={[80, 0, -60]} radius={80} />
      <Carousel position={[-60, 0, -40]} radius={25} />
      <Carousel position={[20, 0, 60]} radius={20} />

      {/* Decorations */}
      <Tents />
      <FlagPoles />
      <StringLights />
      <Balloons />

      {/* Sparkles for magical atmosphere */}
      <Sparkles count={80} scale={200} size={4} speed={0.4} color="#ffd700" />

      {/* Click-to-pop raycaster */}
      <TitleClickRaycaster />
    </>
  )
}
