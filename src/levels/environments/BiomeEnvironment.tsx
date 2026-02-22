import { useMemo, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { Sky } from '@react-three/drei'
import type { BiomeType } from '@/types/level'
import FerrisWheel from './FerrisWheel'
import Carousel from './Carousel'

interface BiomeEnvironmentProps {
  biome: BiomeType
  groundColor: number
  fog?: { color: number; near: number; far: number }
  hasWater?: boolean
  hasTrees?: boolean
  treeCount?: number
}

const BIOME_SETTINGS: Record<
  BiomeType,
  {
    sunPosition: [number, number, number]
    skyScale: number
    ambientIntensity: number
    dirIntensity: number
    fogColor: number
    fogNear: number
    fogFar: number
    displaceGround: boolean
  }
> = {
  themePark: {
    sunPosition: [100, 200, 100],
    skyScale: 4500,
    ambientIntensity: 0.6,
    dirIntensity: 1.2,
    fogColor: 0x202020,
    fogNear: 1,
    fogFar: 4000,
    displaceGround: true,
  },
  desert: {
    sunPosition: [200, 150, -50],
    skyScale: 4500,
    ambientIntensity: 0.8,
    dirIntensity: 1.5,
    fogColor: 0xd2a679,
    fogNear: 100,
    fogFar: 6000,
    displaceGround: false,
  },
  ocean: {
    sunPosition: [50, 100, 200],
    skyScale: 5800,
    ambientIntensity: 0.5,
    dirIntensity: 1.0,
    fogColor: 0x4a7d7c,
    fogNear: 100,
    fogFar: 5800,
    displaceGround: false,
  },
  arctic: {
    sunPosition: [100, 50, 100],
    skyScale: 10000,
    ambientIntensity: 0.7,
    dirIntensity: 0.9,
    fogColor: 0xd0d8ea,
    fogNear: 1,
    fogFar: 4000,
    displaceGround: false,
  },
}

/**
 * Port of Poem.js ground generation with vertex displacement.
 * Original: vertices displaced by random * max(0, distance/5 - 250)
 */
function createDisplacedGround(
  width: number,
  height: number,
  wSeg: number,
  hSeg: number,
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, wSeg, hSeg)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position
  const center = new THREE.Vector3(0, 0, 0)
  const v = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i))

    // Offset XZ randomly
    const nx = v.x + (Math.random() * 100 - 50)
    const nz = v.z + (Math.random() * 100 - 50)

    // Height based on distance from center
    const distance = v.distanceTo(center) / 5 - 250
    const ny = Math.random() * Math.max(0, distance)

    pos.setXYZ(i, nx, ny, nz)
  }

  geo.computeVertexNormals()
  return geo
}

function createFlatGround(width: number, height: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height)
  geo.rotateX(-Math.PI / 2)
  return geo
}

export default function BiomeEnvironment({
  biome,
  groundColor,
  fog,
  hasWater = false,
  hasTrees = false,
  treeCount = 0,
}: BiomeEnvironmentProps) {
  const settings = BIOME_SETTINGS[biome]
  const groundColorObj = useMemo(() => new THREE.Color(groundColor), [groundColor])
  const fogColor = fog?.color ?? settings.fogColor

  const groundGeo = useMemo(() => {
    if (settings.displaceGround) {
      return createDisplacedGround(5000, 5000, 30, 30)
    }
    const w = biome === 'arctic' ? 10000 : 5000
    const h = biome === 'arctic' ? 10000 : 5000
    return createFlatGround(w, h)
  }, [biome, settings.displaceGround])

  return (
    <>
      {/* Sky */}
      <Sky
        distance={settings.skyScale}
        sunPosition={settings.sunPosition}
      />

      {/* Lighting — port of Poem.js: HemisphereLight + DirectionalLight */}
      <hemisphereLight args={[0xfff0f0, 0x606066, 1]} />
      <directionalLight position={[1, 1, 1]} intensity={0.5} />

      {/* Fog */}
      <fog
        attach="fog"
        args={[fogColor, fog?.near ?? settings.fogNear, fog?.far ?? settings.fogFar]}
      />

      {/* Ground */}
      <mesh geometry={groundGeo} visible={!hasWater}>
        <meshPhongMaterial color={groundColorObj} flatShading />
      </mesh>

      {/* Water (ocean level) */}
      {hasWater && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[5000, 5000]} />
          <meshPhongMaterial
            color={0x004f41}
            transparent
            opacity={0.85}
            flatShading
          />
        </mesh>
      )}

      {/* Trees for theme park */}
      {hasTrees && treeCount > 0 && <TreeField count={treeCount} biome={biome} />}

      {/* Funfair decorations for theme park */}
      {biome === 'themePark' && <FunfairDecorations />}

      {/* Rides and string lights for theme park */}
      {biome === 'themePark' && (
        <>
          <FerrisWheel position={[500, 0, -300]} radius={80} />
          <Carousel position={[-400, 0, -200]} radius={25} />
          <Carousel position={[200, 0, 400]} radius={20} />
          <StringLights />
        </>
      )}
    </>
  )
}

/** Port of TreeField.js — random trees scattered around */
function TreeField({ count, biome }: { count: number; biome: BiomeType }) {
  const trees = useMemo(() => {
    const arr: { x: number; y: number; z: number; height: number; color: string }[] = []
    const minR = biome === 'themePark' ? 1200 : 300
    for (let i = 0; i < count; i++) {
      const r = minR + Math.random() * 2200
      const theta = Math.random() * Math.PI * 2
      arr.push({
        x: Math.cos(theta) * r,
        y: 0,
        z: Math.sin(theta) * r,
        height: 30 + Math.random() * 60,
        color: `hsl(${100 + Math.random() * 40}, ${50 + Math.random() * 30}%, ${25 + Math.random() * 20}%)`,
      })
    }
    return arr
  }, [count, biome])

  // Use InstancedMesh for performance
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(2, 4, 1, 6), [])
  const canopyGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 6), [])

  return (
    <>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, tree.y, tree.z]}>
          {/* Trunk */}
          <mesh position={[0, tree.height * 0.3, 0]} scale={[1, tree.height * 0.6, 1]}>
            <cylinderGeometry args={[2, 4, 1, 6]} />
            <meshPhongMaterial color="#5c3a1e" flatShading />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, tree.height * 0.75, 0]} scale={[tree.height * 0.4, tree.height * 0.5, tree.height * 0.4]}>
            <coneGeometry args={[1, 1, 6]} />
            <meshPhongMaterial color={tree.color} flatShading />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** String lights — catenary curves of emissive spheres between poles */
function StringLights() {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const lights = useMemo(() => {
    const arr: { x: number; y: number; z: number }[] = []

    // Create several catenary strings between poles in the tent ring
    for (let s = 0; s < 10; s++) {
      const theta1 = (s / 10) * Math.PI * 2
      const theta2 = ((s + 1) / 10) * Math.PI * 2
      const r = 420

      const x1 = Math.cos(theta1) * r
      const z1 = Math.sin(theta1) * r
      const x2 = Math.cos(theta2) * r
      const z2 = Math.sin(theta2) * r

      const bulbCount = 10
      for (let i = 0; i <= bulbCount; i++) {
        const t = i / bulbCount
        const x = x1 + (x2 - x1) * t
        const z = z1 + (z2 - z1) * t
        // Catenary sag
        const sag = Math.sin(t * Math.PI) * 8
        const y = 48 - sag

        arr.push({ x, y, z })
      }
    }

    return arr
  }, [])

  // Set instance matrices on mount
  useMemo(() => {
    // Will be applied once ref is available via useEffect
  }, [])

  // Use a separate useEffect won't work in R3F, so apply in useMemo via callback ref
  const setRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    ;(meshRef as any).current = mesh
    const mat = new THREE.Matrix4()
    for (let i = 0; i < lights.length; i++) {
      mat.makeTranslation(lights[i].x, lights[i].y, lights[i].z)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [lights])

  return (
    <instancedMesh ref={setRef} args={[undefined, undefined, lights.length]} frustumCulled={false}>
      <sphereGeometry args={[1.2, 6, 6]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffcc44"
        emissiveIntensity={3}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

/** Colorful theme park decorations — tents, poles, fences, booths, hedges */
function FunfairDecorations() {
  const decorations = useMemo(() => {
    const arr: { x: number; z: number; type: 'tent' | 'pole' | 'arch' | 'booth' | 'hedge'; color: string; rotation?: number }[] = []
    const colors = ['#ff4444', '#ffaa00', '#4488ff', '#44cc44', '#ff44ff', '#ffffff']

    // Inner ring of tents (original)
    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2
      const r = 400 + Math.random() * 200
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'tent',
        color: colors[i % colors.length],
      })
    }

    // Outer tent ring (radius 800–1000)
    for (let i = 0; i < 8; i++) {
      const theta = ((i + 0.5) / 8) * Math.PI * 2
      const r = 800 + Math.random() * 200
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'tent',
        color: colors[(i + 3) % colors.length],
      })
    }

    // Game booths / stalls (radius 150–700)
    for (let i = 0; i < 20; i++) {
      const r = 150 + Math.random() * 550
      const theta = Math.random() * Math.PI * 2
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'booth',
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
      })
    }

    // Hedge perimeter (radius ~1100)
    for (let i = 0; i < 40; i++) {
      const theta = (i / 40) * Math.PI * 2
      const r = 1100
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'hedge',
        color: '#2d6b2d',
        rotation: theta,
      })
    }

    // Scattered poles with flags
    for (let i = 0; i < 30; i++) {
      const r = 100 + Math.random() * 800
      const theta = Math.random() * Math.PI * 2
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'pole',
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    // Entrance arches
    for (let i = 0; i < 4; i++) {
      const theta = (i / 4) * Math.PI * 2
      arr.push({
        x: Math.cos(theta) * 250,
        z: Math.sin(theta) * 250,
        type: 'arch',
        color: colors[i % colors.length],
      })
    }

    return arr
  }, [])

  return (
    <>
      {decorations.map((d, i) => {
        switch (d.type) {
          case 'tent':
            return (
              <group key={i} position={[d.x, 0, d.z]}>
                {/* Tent body */}
                <mesh position={[0, 30, 0]}>
                  <coneGeometry args={[25, 40, 6]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                {/* Tent base */}
                <mesh position={[0, 8, 0]}>
                  <cylinderGeometry args={[24, 24, 16, 6]} />
                  <meshPhongMaterial color="#ffffff" flatShading />
                </mesh>
              </group>
            )
          case 'booth':
            return (
              <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.rotation ?? 0, 0]}>
                {/* Booth body */}
                <mesh position={[0, 8, 0]}>
                  <boxGeometry args={[12, 16, 10]} />
                  <meshPhongMaterial color="#f5e6c8" flatShading />
                </mesh>
                {/* Awning roof */}
                <mesh position={[0, 18, 0]}>
                  <boxGeometry args={[14, 3, 12]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                {/* Counter */}
                <mesh position={[0, 5, 5.5]}>
                  <boxGeometry args={[10, 2, 1]} />
                  <meshPhongMaterial color="#8b6914" flatShading />
                </mesh>
              </group>
            )
          case 'hedge':
            return (
              <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.rotation ?? 0, 0]}>
                <mesh position={[0, 5, 0]}>
                  <boxGeometry args={[18, 10, 6]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
              </group>
            )
          case 'pole':
            return (
              <group key={i} position={[d.x, 0, d.z]}>
                <mesh position={[0, 25, 0]}>
                  <cylinderGeometry args={[1, 1, 50, 4]} />
                  <meshPhongMaterial color="#888888" flatShading />
                </mesh>
                {/* Flag */}
                <mesh position={[3, 45, 0]}>
                  <boxGeometry args={[6, 4, 0.5]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
              </group>
            )
          case 'arch':
            return (
              <group key={i} position={[d.x, 0, d.z]}>
                {/* Left pillar */}
                <mesh position={[-15, 30, 0]}>
                  <boxGeometry args={[4, 60, 4]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                {/* Right pillar */}
                <mesh position={[15, 30, 0]}>
                  <boxGeometry args={[4, 60, 4]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                {/* Top beam */}
                <mesh position={[0, 62, 0]}>
                  <boxGeometry args={[34, 4, 4]} />
                  <meshPhongMaterial color="#ffdd00" flatShading />
                </mesh>
              </group>
            )
          default:
            return null
        }
      })}

      {/* Extra rides */}
      <FerrisWheel position={[-500, 0, 300]} radius={60} />
      <Carousel position={[400, 0, 350]} radius={20} />
    </>
  )
}
