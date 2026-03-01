import { useMemo, useRef, useCallback, useEffect, useContext } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from '@react-three/drei'
import type { BiomeType } from '@/types/level'
import { createHeightFunction, getTerrainSlope, type HeightFunction } from '@/utils/terrainNoise'
import { TerrainContext } from './TerrainContext'
import BiomeDecorations from './BiomeDecorations'
import FerrisWheel from './FerrisWheel'
import Carousel from './Carousel'
import Pyramid from './Pyramid'
import RockArches from './RockArches'
import SunkenCity from './SunkenCity'
import IceFortress from './IceFortress'
import Volcano from './Volcano'
import { eventBus } from '@/core/EventBus'
import { createLavaMaterial } from './LavaShader'

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
  }
> = {
  themePark: {
    sunPosition: [100, 200, 100],
    skyScale: 4500,
    ambientIntensity: 0.6,
    dirIntensity: 1.2,
    fogColor: 0x202020,
    fogNear: 1,
    fogFar: 5000,
  },
  desert: {
    sunPosition: [200, 150, -50],
    skyScale: 4500,
    ambientIntensity: 0.8,
    dirIntensity: 1.5,
    fogColor: 0xd2a679,
    fogNear: 100,
    fogFar: 6000,
  },
  ocean: {
    sunPosition: [50, 100, 200],
    skyScale: 5800,
    ambientIntensity: 0.5,
    dirIntensity: 1.0,
    fogColor: 0x4a7d7c,
    fogNear: 100,
    fogFar: 5800,
  },
  arctic: {
    sunPosition: [100, 50, 100],
    skyScale: 10000,
    ambientIntensity: 0.7,
    dirIntensity: 0.9,
    fogColor: 0xd0d8ea,
    fogNear: 1,
    fogFar: 5500,
  },
  volcanic: {
    sunPosition: [80, 30, -60],
    skyScale: 12000,
    ambientIntensity: 0.5,
    dirIntensity: 0.7,
    fogColor: 0x3a1a0a,
    fogNear: 1,
    fogFar: 6000,
  },
}

// --- Vertex color ramps per biome ---

interface ColorStop {
  height: number // normalized height 0-1
  color: THREE.Color
}

const BIOME_COLOR_RAMPS: Record<BiomeType, { stops: ColorStop[]; cliffColor: THREE.Color }> = {
  themePark: {
    stops: [
      { height: 0.0, color: new THREE.Color(0x2d5a1e) },  // dark green valley
      { height: 0.25, color: new THREE.Color(0x3a7a28) }, // green hills
      { height: 0.5, color: new THREE.Color(0x6b8a3a) },  // light green
      { height: 0.7, color: new THREE.Color(0x8b7355) },  // brown rock
      { height: 0.85, color: new THREE.Color(0x999088) }, // grey rock
      { height: 1.0, color: new THREE.Color(0xf0f0f0) },  // snow caps
    ],
    cliffColor: new THREE.Color(0x6b5a4a),
  },
  desert: {
    stops: [
      { height: 0.0, color: new THREE.Color(0xc2a060) },  // packed sand
      { height: 0.3, color: new THREE.Color(0xd4b36a) },  // golden dunes
      { height: 0.5, color: new THREE.Color(0xdaaa50) },  // deeper gold
      { height: 0.7, color: new THREE.Color(0xb85a3a) },  // red rock
      { height: 0.9, color: new THREE.Color(0x8b4030) },  // dark red mesa
      { height: 1.0, color: new THREE.Color(0x7a3528) },  // mesa top
    ],
    cliffColor: new THREE.Color(0x7a4530),
  },
  ocean: {
    stops: [
      { height: 0.0, color: new THREE.Color(0x1a3a4a) },  // deep seafloor
      { height: 0.2, color: new THREE.Color(0x2a5a5a) },  // mid seafloor
      { height: 0.4, color: new THREE.Color(0x4a8a6a) },  // shallows
      { height: 0.6, color: new THREE.Color(0x6aaa70) },  // near surface
      { height: 0.75, color: new THREE.Color(0x5a5a50) }, // volcanic rock
      { height: 1.0, color: new THREE.Color(0x3a3a35) },  // dark volcanic peak
    ],
    cliffColor: new THREE.Color(0x2a2a28),
  },
  arctic: {
    stops: [
      { height: 0.0, color: new THREE.Color(0x8ab4cc) },  // pale blue ice
      { height: 0.2, color: new THREE.Color(0xc0d8e8) },  // light blue
      { height: 0.4, color: new THREE.Color(0xe0e8f0) },  // white snow
      { height: 0.6, color: new THREE.Color(0xf0f4f8) },  // bright snow
      { height: 0.8, color: new THREE.Color(0xd0e0f0) },  // blue-white
      { height: 1.0, color: new THREE.Color(0xa0c0e0) },  // blue ice peaks
    ],
    cliffColor: new THREE.Color(0x7090b0),
  },
  volcanic: {
    stops: [
      { height: 0.0, color: new THREE.Color(0x1a0e08) },  // dark volcanic black
      { height: 0.15, color: new THREE.Color(0x2a1510) }, // dark charcoal-brown
      { height: 0.3, color: new THREE.Color(0x3a2018) },  // warm dark brown
      { height: 0.5, color: new THREE.Color(0x4a2a1a) },  // burnt umber
      { height: 0.7, color: new THREE.Color(0x3a2015) },  // darkening again
      { height: 0.85, color: new THREE.Color(0x2a1810) }, // near-black peaks
      { height: 1.0, color: new THREE.Color(0x1a1008) },  // obsidian black peaks
    ],
    cliffColor: new THREE.Color(0x5a3020),
  },
}

function sampleColorRamp(stops: ColorStop[], t: number, tmp: THREE.Color): void {
  const clamped = Math.max(0, Math.min(1, t))
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped <= stops[i + 1].height) {
      const range = stops[i + 1].height - stops[i].height
      const localT = range > 0 ? (clamped - stops[i].height) / range : 0
      tmp.copy(stops[i].color).lerp(stops[i + 1].color, localT)
      return
    }
  }
  tmp.copy(stops[stops.length - 1].color)
}

/**
 * Creates a noise-based terrain mesh with vertex coloring.
 * 128x128 segments for chunky low-poly flat-shading aesthetic.
 */
function createNoiseTerrain(
  biome: BiomeType,
  heightFn: HeightFunction,
  size: number,
  segments: number,
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position
  const ramp = BIOME_COLOR_RAMPS[biome]

  // Get amplitude range for normalizing colors
  // We sample a few heights to estimate max
  let maxH = 1
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = heightFn(x, z)
    pos.setY(i, y)
    maxH = Math.max(maxH, Math.abs(y))
  }

  // Compute vertex normals for slope detection
  geo.computeVertexNormals()
  const normals = geo.attributes.normal

  // Create vertex colors
  const colors = new Float32Array(pos.count * 3)
  const tmp = new THREE.Color()
  const upVec = new THREE.Vector3(0, 1, 0)
  const normalVec = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    // Normalize height to [0, 1] for color ramp
    const normalizedH = Math.max(0, Math.min(1, Math.abs(y) / maxH))

    // Get slope from vertex normal (dot with up)
    normalVec.set(
      normals.getX(i),
      normals.getY(i),
      normals.getZ(i),
    )
    const slopeDot = normalVec.dot(upVec) // 1 = flat, 0 = vertical
    const slopeFactor = 1 - Math.max(0, Math.min(1, (1 - slopeDot) * 3)) // steep = 0

    // Sample color ramp
    sampleColorRamp(ramp.stops, normalizedH, tmp)

    // Blend toward cliff color on steep slopes
    if (slopeFactor < 1) {
      tmp.lerp(ramp.cliffColor, 1 - slopeFactor)
    }

    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  return geo
}

// ── Shader-based ocean water ──────────────────────────────────────────
const waterVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 pos = position;
    // Gentle wave displacement
    float wave1 = sin(pos.x * 0.008 + uTime * 0.8) * 3.0;
    float wave2 = sin(pos.y * 0.012 + uTime * 0.6) * 2.0;
    float wave3 = cos((pos.x + pos.y) * 0.005 + uTime * 1.1) * 1.5;
    pos.z += wave1 + wave2 + wave3;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const waterFragmentShader = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uCameraPosition;
  uniform float uTime;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    // Fresnel: transparent looking down, more opaque at grazing angles
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    float fresnel = 1.0 - max(dot(viewDir, vWorldNormal), 0.0);
    fresnel = pow(fresnel, 2.0);

    // Mix deep/shallow color based on fresnel
    vec3 color = mix(uShallowColor, uDeepColor, fresnel);

    // Subtle shimmer
    float shimmer = sin(vWorldPosition.x * 0.05 + uTime * 2.0) *
                    cos(vWorldPosition.z * 0.04 + uTime * 1.5) * 0.05;
    color += shimmer;

    // Alpha: transparent when looking down, more opaque at edges
    float alpha = mix(0.12, 0.5, fresnel);

    gl_FragColor = vec4(color, alpha);
  }
`

function OceanWater() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(0x003344) },
    uShallowColor: { value: new THREE.Color(0x007766) },
    uCameraPosition: { value: new THREE.Vector3() },
  }), [])

  useFrame(({ clock, camera }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime
      matRef.current.uniforms.uCameraPosition.value.copy(camera.position)
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[6000, 6000, 128, 128]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={waterVertexShader}
        fragmentShader={waterFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
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
  const fogColor = fog?.color ?? settings.fogColor
  const heightFn = useContext(TerrainContext)
  const fogRef = useRef<THREE.Fog>(null)
  const cameraShakeRef = useRef({ active: false, startTime: 0 })

  const groundGeo = useMemo(() => {
    const size = biome === 'arctic' ? 10000 : biome === 'volcanic' ? 12000 : 6000
    return createNoiseTerrain(biome, heightFn, size, 128)
  }, [biome, heightFn])

  useEffect(() => {
    return () => groundGeo.dispose()
  }, [groundGeo])

  // Lava shader material — animated procedural molten rock
  const lavaRiverMat = useMemo(() => biome === 'volcanic' ? createLavaMaterial(0.08, 1.2) : null, [biome])
  const lavaFlowMat = useMemo(() => biome === 'volcanic' ? createLavaMaterial(0.12, 1.5) : null, [biome])

  // Lava rivers — terrain-conforming strips that drape over the heightmap
  const lavaRiverGeos = useMemo(() => {
    if (biome !== 'volcanic') return []

    const geos: THREE.BufferGeometry[] = []
    const riverConfigs = [
      { angle: 0.3, rStart: 800, rEnd: 3000, halfWidth: 15 },
      { angle: 1.2, rStart: 900, rEnd: 2800, halfWidth: 12 },
      { angle: 2.5, rStart: 1000, rEnd: 3200, halfWidth: 18 },
      { angle: 3.8, rStart: 700, rEnd: 2600, halfWidth: 14 },
      { angle: 5.0, rStart: 850, rEnd: 2900, halfWidth: 16 },
    ]

    // The terrain mesh is 128 segments over 12000 units (~94 units/cell).
    // Between terrain vertices the GPU interpolates linearly, but heightFn
    // gives exact noise.  To guarantee the lava strip always sits visibly
    // *above* the rendered terrain surface we:
    //  1. Sample a 5×5 grid around each vertex (matching the terrain cell size)
    //     and take the MAX height so we clear any nearby peak.
    //  2. Add a generous Y offset (8 units).
    //  3. Use 120 segments so the strip follows the terrain closely.

    const TERRAIN_CELL = 12000 / 128  // ~93.75
    const Y_OFFSET = 8
    const SEGMENTS = 120

    /** Return the highest terrain value in a small neighbourhood */
    function safeHeight(x: number, z: number): number {
      const half = TERRAIN_CELL * 0.6
      let maxH = heightFn(x, z)
      // sample a cross pattern around the point
      for (const ox of [-half, 0, half]) {
        for (const oz of [-half, 0, half]) {
          const h = heightFn(x + ox, z + oz)
          if (h > maxH) maxH = h
        }
      }
      return maxH + Y_OFFSET
    }

    for (const cfg of riverConfigs) {
      const dx = Math.cos(cfg.angle)
      const dz = Math.sin(cfg.angle)
      const px = -dz // perpendicular
      const pz = dx

      const positions: number[] = []
      const uvs: number[] = []
      const indices: number[] = []

      for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS
        const r = cfg.rStart + (cfg.rEnd - cfg.rStart) * t
        const cx = dx * r
        const cz = dz * r
        const wander = Math.sin(t * 4) * 30 + Math.cos(t * 7) * 15

        const lx = cx + (px * cfg.halfWidth) + px * wander
        const lz = cz + (pz * cfg.halfWidth) + pz * wander
        const rx = cx - (px * cfg.halfWidth) + px * wander
        const rz = cz - (pz * cfg.halfWidth) + pz * wander

        // Use the max of all three sample points so the whole cross-section clears
        const centerH = safeHeight(cx + px * wander, cz + pz * wander)
        const leftH = safeHeight(lx, lz)
        const rightH = safeHeight(rx, rz)
        const rowY = Math.max(centerH, leftH, rightH)

        positions.push(lx, rowY, lz)
        positions.push(rx, rowY, rz)
        uvs.push(0, t)
        uvs.push(1, t)

        if (i < SEGMENTS) {
          const base = i * 2
          indices.push(base, base + 1, base + 2)
          indices.push(base + 1, base + 3, base + 2)
        }
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      geos.push(geo)
    }
    return geos
  }, [biome, heightFn])

  useEffect(() => {
    return () => {
      lavaRiverMat?.dispose()
      lavaFlowMat?.dispose()
      lavaRiverGeos.forEach(g => g.dispose())
    }
  }, [lavaRiverMat, lavaFlowMat, lavaRiverGeos])

  // Eruption event handling — fog pulse + camera shake
  useEffect(() => {
    if (biome !== 'volcanic') return
    const onEruption = () => {
      cameraShakeRef.current = { active: true, startTime: performance.now() / 1000 }
    }
    eventBus.on('eruption:start', onEruption)
    return () => { eventBus.off('eruption:start', onEruption) }
  }, [biome])

  useFrame(({ camera, clock }) => {
    if (biome !== 'volcanic') return

    // Drive lava shader time
    const t = clock.elapsedTime
    if (lavaRiverMat) lavaRiverMat.uniforms.uTime.value = t
    if (lavaFlowMat) lavaFlowMat.uniforms.uTime.value = t

    const shake = cameraShakeRef.current
    if (!shake.active) return
    const elapsed = clock.elapsedTime - shake.startTime
    if (elapsed < 0) {
      shake.startTime = clock.elapsedTime
      return
    }

    // Camera shake: 3s duration, damped
    if (elapsed < 3) {
      const amplitude = 3 * (1 - elapsed / 3)
      camera.position.x += Math.sin(elapsed * 30) * amplitude * 0.02
      camera.position.y += Math.cos(elapsed * 25) * amplitude * 0.02
    }

    // Fog pulse: close in over 2s, recover over 8s
    if (fogRef.current) {
      const baseFar = settings.fogFar
      if (elapsed < 2) {
        const t = elapsed / 2
        fogRef.current.far = baseFar + (200 - baseFar) * t
      } else if (elapsed < 10) {
        const t = (elapsed - 2) / 8
        fogRef.current.far = 200 + (baseFar - 200) * t
      } else {
        fogRef.current.far = baseFar
        shake.active = false
      }
    }
  })

  return (
    <>
      {/* Sky */}
      <Sky
        distance={settings.skyScale}
        sunPosition={settings.sunPosition}
      />

      {/* Lighting */}
      <hemisphereLight args={[0xfff0f0, 0x606066, 1]} />
      <directionalLight position={[1, 1, 1]} intensity={0.5} />

      {/* Fog */}
      <fog
        ref={fogRef}
        attach="fog"
        args={[fogColor, fog?.near ?? settings.fogNear, fog?.far ?? settings.fogFar]}
      />

      {/* Terrain mesh */}
      <mesh geometry={groundGeo}>
        <meshPhongMaterial vertexColors flatShading />
      </mesh>

      {/* Water (ocean level) */}
      {hasWater && <OceanWater />}

      {/* Trees */}
      {hasTrees && treeCount > 0 && (
        <TreeField count={treeCount} biome={biome} heightFn={heightFn} />
      )}

      {/* Biome-specific decorations */}
      {biome !== 'themePark' && <BiomeDecorations biome={biome} heightFn={heightFn} />}

      {/* Desert landmarks */}
      {biome === 'desert' && (
        <>
          <Pyramid position={[2000, heightFn(2000, -1600), -1600]} />
          <RockArches />
        </>
      )}

      {/* Ocean landmark */}
      {biome === 'ocean' && (
        <SunkenCity position={[1800, -15, -1400]} />
      )}

      {/* Arctic landmark */}
      {biome === 'arctic' && (
        <IceFortress position={[2200, heightFn(2200, -1200), -1200]} />
      )}

      {/* Volcanic landmark + lava rivers */}
      {biome === 'volcanic' && (
        <>
          <Volcano position={[2400, heightFn(2400, -1500), -1500]} lavaMaterial={lavaFlowMat} />
          {lavaRiverMat && lavaRiverGeos.map((geo, i) => (
            <mesh
              key={`lava-river-${i}`}
              geometry={geo}
              material={lavaRiverMat}
            />
          ))}
        </>
      )}

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

/** Parse HSL string to RGB for instance color attribute */
function hslToRgb(hsl: string): [number, number, number] {
  const c = new THREE.Color()
  c.setStyle(hsl)
  return [c.r, c.g, c.b]
}

// --- Tree configs per biome ---

interface TreeTypeConfig {
  trunkColor: string
  canopyColors: () => string
  canopyGeoFactory: () => THREE.BufferGeometry
  heightRange: [number, number]
}

function getTreeTypes(biome: BiomeType): TreeTypeConfig[] {
  switch (biome) {
    case 'themePark':
      return [
        {
          trunkColor: '#5c3a1e',
          canopyColors: () => `hsl(${100 + Math.random() * 40}, ${50 + Math.random() * 30}%, ${25 + Math.random() * 20}%)`,
          canopyGeoFactory: () => new THREE.ConeGeometry(1, 1, 6),
          heightRange: [30, 90],
        },
        {
          trunkColor: '#6b4422',
          canopyColors: () => `hsl(${80 + Math.random() * 50}, ${40 + Math.random() * 30}%, ${20 + Math.random() * 25}%)`,
          canopyGeoFactory: () => new THREE.DodecahedronGeometry(1, 1),
          heightRange: [25, 70],
        },
      ]
    case 'desert':
      return [
        {
          trunkColor: '#8a7a5a',
          canopyColors: () => `hsl(${30 + Math.random() * 20}, ${20 + Math.random() * 15}%, ${30 + Math.random() * 15}%)`,
          canopyGeoFactory: () => new THREE.ConeGeometry(1, 1, 4),
          heightRange: [15, 35],
        },
      ]
    case 'arctic':
      return [
        {
          trunkColor: '#3a2818',
          canopyColors: () => `hsl(${140 + Math.random() * 20}, ${20 + Math.random() * 15}%, ${20 + Math.random() * 10}%)`,
          canopyGeoFactory: () => new THREE.ConeGeometry(1, 1, 6),
          heightRange: [25, 70],
        },
      ]
    case 'volcanic':
      return [
        {
          trunkColor: '#1a1008',
          canopyColors: () => '#1a1008',
          canopyGeoFactory: () => new THREE.ConeGeometry(0.3, 0.5, 3),
          heightRange: [15, 50],
        },
      ]
    default:
      return []
  }
}

function getTreeCount(biome: BiomeType, requested: number): number {
  switch (biome) {
    case 'themePark': return requested // 120
    case 'desert': return Math.min(15, requested)
    case 'arctic': return Math.min(80, requested)
    case 'volcanic': return Math.min(60, requested)
    case 'ocean': return 0
    default: return requested
  }
}

/** Trees placed on terrain with slope rejection and biome variety */
function TreeField({
  count,
  biome,
  heightFn,
}: {
  count: number
  biome: BiomeType
  heightFn: HeightFunction
}) {
  const treeTypes = useMemo(() => getTreeTypes(biome), [biome])
  const actualCount = getTreeCount(biome, count)

  const trees = useMemo(() => {
    if (actualCount === 0 || treeTypes.length === 0) return []
    const arr: { x: number; y: number; z: number; height: number; color: string; typeIdx: number }[] = []
    const minR = biome === 'themePark' ? 800 : 200
    const maxR = biome === 'themePark' ? 3000 : 4000
    const maxSlopeAngle = (biome === 'arctic' || biome === 'volcanic') ? Math.PI / 6 : Math.PI / 4

    let attempts = 0
    while (arr.length < actualCount && attempts < actualCount * 5) {
      attempts++
      const r = minR + Math.random() * (maxR - minR)
      const theta = Math.random() * Math.PI * 2
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r

      // Slope rejection
      const slope = getTerrainSlope(heightFn, x, z)
      if (slope > maxSlopeAngle) continue

      const y = heightFn(x, z)

      // Ocean: skip trees below water
      if (biome === 'ocean' && y < 2) continue

      const typeIdx = Math.floor(Math.random() * treeTypes.length)
      const tType = treeTypes[typeIdx]
      const height = tType.heightRange[0] + Math.random() * (tType.heightRange[1] - tType.heightRange[0])

      arr.push({
        x,
        y,
        z,
        height,
        color: tType.canopyColors(),
        typeIdx,
      })
    }
    return arr
  }, [actualCount, biome, heightFn, treeTypes])

  // Group trees by type for instancing
  const groupedTrees = useMemo(() => {
    const groups: Map<number, typeof trees> = new Map()
    for (const tree of trees) {
      if (!groups.has(tree.typeIdx)) groups.set(tree.typeIdx, [])
      groups.get(tree.typeIdx)!.push(tree)
    }
    return groups
  }, [trees])

  if (trees.length === 0) return null

  return (
    <>
      {Array.from(groupedTrees.entries()).map(([typeIdx, group]) => (
        <TreeTypeInstances
          key={typeIdx}
          trees={group}
          treeType={treeTypes[typeIdx]}
        />
      ))}
    </>
  )
}

function TreeTypeInstances({
  trees,
  treeType,
}: {
  trees: { x: number; y: number; z: number; height: number; color: string }[]
  treeType: TreeTypeConfig
}) {
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(2, 4, 1, 6), [])
  const canopyGeo = useMemo(() => treeType.canopyGeoFactory(), [treeType])

  const trunkMat = useMemo(
    () => new THREE.MeshPhongMaterial({ color: treeType.trunkColor, flatShading: true }),
    [treeType],
  )
  const canopyMat = useMemo(
    () => new THREE.MeshPhongMaterial({ flatShading: true, vertexColors: true }),
    [],
  )

  const instanceColorAttr = useMemo(() => {
    const n = trees.length
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    for (let i = 0; i < n; i++) {
      const [r, g, b] = hslToRgb(trees[i].color)
      attr.setXYZ(i, r, g, b)
    }
    return attr
  }, [trees])

  const _mat = useRef(new THREE.Matrix4()).current
  const _scale = useRef(new THREE.Vector3()).current

  const setTrunkRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i]
        _mat.makeTranslation(t.x, t.y + t.height * 0.3, t.z)
        _scale.set(1, t.height * 0.6, 1)
        _mat.scale(_scale)
        mesh.setMatrixAt(i, _mat)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    [trees, _mat, _scale],
  )

  const setCanopyRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      mesh.instanceColor = instanceColorAttr
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i]
        _mat.makeTranslation(t.x, t.y + t.height * 0.75, t.z)
        _scale.set(t.height * 0.4, t.height * 0.5, t.height * 0.4)
        _mat.scale(_scale)
        mesh.setMatrixAt(i, _mat)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    [trees, instanceColorAttr, _mat, _scale],
  )

  useEffect(() => {
    return () => {
      trunkGeo.dispose()
      canopyGeo.dispose()
      trunkMat.dispose()
      canopyMat.dispose()
    }
  }, [trunkGeo, canopyGeo, trunkMat, canopyMat])

  const n = trees.length
  return (
    <>
      <instancedMesh ref={setTrunkRef} args={[trunkGeo, trunkMat, n]} frustumCulled />
      <instancedMesh ref={setCanopyRef} args={[canopyGeo, canopyMat, n]} frustumCulled />
    </>
  )
}

/** String lights — catenary curves of emissive spheres between poles */
function StringLights() {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const lights = useMemo(() => {
    const arr: { x: number; y: number; z: number }[] = []

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
        const sag = Math.sin(t * Math.PI) * 8
        const y = 48 - sag

        arr.push({ x, y, z })
      }
    }

    return arr
  }, [])

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
                <mesh position={[0, 30, 0]}>
                  <coneGeometry args={[25, 40, 6]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                <mesh position={[0, 8, 0]}>
                  <cylinderGeometry args={[24, 24, 16, 6]} />
                  <meshPhongMaterial color="#ffffff" flatShading />
                </mesh>
              </group>
            )
          case 'booth':
            return (
              <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.rotation ?? 0, 0]}>
                <mesh position={[0, 8, 0]}>
                  <boxGeometry args={[12, 16, 10]} />
                  <meshPhongMaterial color="#f5e6c8" flatShading />
                </mesh>
                <mesh position={[0, 18, 0]}>
                  <boxGeometry args={[14, 3, 12]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
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
                <mesh position={[3, 45, 0]}>
                  <boxGeometry args={[6, 4, 0.5]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
              </group>
            )
          case 'arch':
            return (
              <group key={i} position={[d.x, 0, d.z]}>
                <mesh position={[-15, 30, 0]}>
                  <boxGeometry args={[4, 60, 4]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                <mesh position={[15, 30, 0]}>
                  <boxGeometry args={[4, 60, 4]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
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

      <FerrisWheel position={[-500, 0, 300]} radius={60} />
      <Carousel position={[400, 0, 350]} radius={20} />
    </>
  )
}
