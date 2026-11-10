/** The title park's extra rides (#454): drop tower, swing ride, log flume; each a merged static part plus one moving part. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergePainted, painted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import { audioNow } from '@/audio/AudioEngine'
import { titleBeatGrid } from '@/audio/titleMusic'
import { DROP_BARS, DROP_TOWER, DROP_TOWER_HEIGHT, GROUND_Y, SWING_RIDE, dropCarHeight, flumePoint } from './titlePark'
import type { TitleClock } from './TitleCoaster'

/** Drop cycle without the title score (before the first key press): 4 bars at 120 bpm. */
const SILENT_CYCLE_S = 8
const SWING_RAD_S = 0.9
const SWING_TILT = 0.62
const SWING_CHAIRS = 16
const SWING_TOP = 26
const FLUME_SEGMENTS = 140
const FLUME_WIDTH = 5
const FLUME_WALL = 2.4
const FLUME_LOGS = 3
const FLUME_LAP_S = 40
const CHAIR_COLORS = ['#ff4444', '#ffaa00', '#4488ff', '#44cc44', '#ff44ff', '#ffffff']

function vertexColored(opts: THREE.MeshLambertMaterialParameters = {}) {
  return new THREE.MeshLambertMaterial({ vertexColors: true, ...opts })
}

/** Lake and flume water: sky in the fresnel, a sun glint on slow ripples; finite everywhere (#344). */
export function createTitleWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#1d5a78') },
      uSky: { value: new THREE.Color('#bcd6e8') },
      uSunDir: { value: new THREE.Vector3(50, 10, -100).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uSky;
      uniform vec3 uSunDir;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz;
        vec3 n = normalize(vec3(
          0.07 * cos(p.x * 0.31 + uTime * 1.3) + 0.04 * cos(p.y * 0.53 + p.x * 0.2 - uTime * 0.9),
          1.0,
          0.07 * cos(p.y * 0.27 - uTime * 1.1) + 0.04 * cos(p.x * 0.47 - p.y * 0.15 + uTime * 0.7)));
        vec3 v = normalize(cameraPosition - vWorld + vec3(0.0, 1e-3, 0.0));
        float f = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
        vec3 col = mix(uDeep, uSky, clamp(0.12 + 0.88 * f, 0.0, 1.0));
        float s = pow(clamp(dot(n, normalize(v + uSunDir)), 0.0, 1.0), 90.0);
        col += vec3(1.0, 0.86, 0.62) * s * 1.6;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

function buildTowerGeometry(): THREE.BufferGeometry {
  const h = DROP_TOWER_HEIGHT
  const parts = [
    painted(new THREE.CylinderGeometry(9, 11, 3, 10), '#5a5a66', [0, 1.5, 0]),
    painted(new THREE.CylinderGeometry(2.4, 3.2, h, 8, 1, true), '#e8e4dc', [0, h / 2, 0]),
    painted(new THREE.CylinderGeometry(4.5, 3, 5, 8), '#e2302a', [0, h + 2, 0]),
    painted(new THREE.ConeGeometry(4.5, 7, 8), '#ffd23f', [0, h + 8, 0]),
  ]
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    parts.push(painted(new THREE.BoxGeometry(0.8, 26, 0.8), '#9a9aa6', [Math.cos(a) * 6, 12, Math.sin(a) * 6], [Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22]))
  }
  return mergePainted(parts)
}

function buildDropCarGeometry(): THREE.BufferGeometry {
  const parts = [
    painted(new THREE.CylinderGeometry(6.5, 6.5, 2.2, 12, 1, true), '#e2302a', [0, 0, 0]),
    painted(new THREE.CylinderGeometry(6.7, 6.7, 0.6, 12, 1, true), '#ffd23f', [0, 1.4, 0]),
  ]
  const heads = ['#f0c8a0', '#8a5a3c', '#e8b48a', '#c68e5e']
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    parts.push(painted(new THREE.IcosahedronGeometry(0.9, 0), heads[i % 4], [Math.cos(a) * 7.2, 0.6, Math.sin(a) * 7.2]))
  }
  return mergePainted(parts)
}

/** Its car rises, hangs, and drops onto a bar line of the title score (`DROP_BARS` bars a cycle). */
function DropTower({ clock }: { clock: TitleClock }) {
  const tower = useMemo(buildTowerGeometry, [])
  const car = useMemo(buildDropCarGeometry, [])
  const material = useMemo(() => vertexColored(), [])
  useEffect(() => () => [tower, car, material].forEach((d) => d.dispose()), [tower, car, material])
  const carRef = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!carRef.current) return
    const grid = titleBeatGrid()
    const phase = grid
      ? (audioNow() - grid.origin) / (grid.beatS * grid.beats * DROP_BARS)
      : clock.scene / SILENT_CYCLE_S
    carRef.current.position.y = dropCarHeight(phase)
  })
  return (
    <group position={[DROP_TOWER.x, GROUND_Y, DROP_TOWER.z]}>
      <mesh name="title-drop-tower" geometry={tower} material={material} />
      <mesh ref={carRef} geometry={car} material={material} />
    </group>
  )
}

function buildSwingBase(): THREE.BufferGeometry {
  return mergePainted([
    painted(new THREE.CylinderGeometry(15, 16, 1.6, 16), '#d8d4cc', [0, 0.8, 0]),
    painted(new THREE.CylinderGeometry(1.4, 2, SWING_TOP, 8, 1, true), '#c8c4bc', [0, SWING_TOP / 2, 0]),
  ])
}

function buildSwingTop(): THREE.BufferGeometry {
  const chain = 12
  const rim = 11
  const parts = [
    painted(new THREE.ConeGeometry(14, 6, 16), '#ff44ff', [0, SWING_TOP + 3, 0]),
    painted(new THREE.CylinderGeometry(14, 14, 1.4, 16, 1, true), '#ffd23f', [0, SWING_TOP - 0.3, 0]),
  ]
  const m = new THREE.Matrix4()
  const local = new THREE.Matrix4()
  for (let i = 0; i < SWING_CHAIRS; i++) {
    const a = (i / SWING_CHAIRS) * Math.PI * 2
    m.copy(pose([0, SWING_TOP - 0.8, 0], [0, a, 0])).multiply(pose([rim, 0, 0], [0, 0, SWING_TILT]))
    local.copy(m).multiply(pose([0, -chain / 2, 0]))
    parts.push(paintedAt(new THREE.BoxGeometry(0.25, chain, 0.25), '#8a8a90', local))
    local.copy(m).multiply(pose([0, -chain, 0], [0, 0, -SWING_TILT]))
    parts.push(paintedAt(new THREE.BoxGeometry(2.4, 0.7, 2.2), CHAIR_COLORS[i % CHAIR_COLORS.length], local))
    local.copy(m).multiply(pose([0, -chain + 1.1, 0]))
    parts.push(paintedAt(new THREE.IcosahedronGeometry(0.7, 0), '#f0c8a0', local))
  }
  return mergePainted(parts)
}

function SwingRide() {
  const base = useMemo(buildSwingBase, [])
  const top = useMemo(buildSwingTop, [])
  const material = useMemo(() => vertexColored(), [])
  useEffect(() => () => [base, top, material].forEach((d) => d.dispose()), [base, top, material])
  const topRef = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (topRef.current) topRef.current.rotation.y += SWING_RAD_S * Math.min(delta, 0.1)
  })
  return (
    <group position={[SWING_RIDE.x, GROUND_Y, SWING_RIDE.z]}>
      <mesh name="title-swing-ride" geometry={base} material={material} />
      <mesh ref={topRef} geometry={top} material={material} />
    </group>
  )
}

const _p = new THREE.Vector3()
const _q = new THREE.Vector3()
const _t = new THREE.Vector3()
const _side = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

function flumeFrame(t: number) {
  flumePoint(t + 1e-3, _q)
  flumePoint(t - 1e-3, _t)
  _t.subVectors(_q, _t).normalize()
  _side.crossVectors(UP, _t).normalize()
  return flumePoint(t, _p)
}

function buildFlume(): { channel: THREE.BufferGeometry; water: THREE.BufferGeometry; supports: THREE.Matrix4[] } {
  const channel: number[] = []
  const water: number[] = []
  const rows: number[][] = []
  for (let i = 0; i <= FLUME_SEGMENTS; i++) {
    const p = flumeFrame(i / FLUME_SEGMENTS)
    const hw = FLUME_WIDTH / 2
    const row = [
      p.x - _side.x * hw, p.y + FLUME_WALL, p.z - _side.z * hw,
      p.x - _side.x * hw, p.y, p.z - _side.z * hw,
      p.x + _side.x * hw, p.y, p.z + _side.z * hw,
      p.x + _side.x * hw, p.y + FLUME_WALL, p.z + _side.z * hw,
    ]
    rows.push(row)
    const ww = hw - 0.2
    water.push(p.x - _side.x * ww, p.y + 0.9, p.z - _side.z * ww, p.x + _side.x * ww, p.y + 0.9, p.z + _side.z * ww)
  }
  for (let i = 0; i < FLUME_SEGMENTS; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    for (let k = 0; k < 3; k++) {
      const a0 = a.slice(k * 3, k * 3 + 3), a1 = a.slice(k * 3 + 3, k * 3 + 6)
      const b0 = b.slice(k * 3, k * 3 + 3), b1 = b.slice(k * 3 + 3, k * 3 + 6)
      channel.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1)
    }
  }
  const waterIdx: number[] = []
  for (let i = 0; i < FLUME_SEGMENTS; i++) {
    const o = i * 2
    waterIdx.push(o, o + 2, o + 3, o, o + 3, o + 1)
  }
  const channelGeo = new THREE.BufferGeometry()
  channelGeo.setAttribute('position', new THREE.Float32BufferAttribute(channel, 3))
  channelGeo.computeVertexNormals()
  const waterGeo = new THREE.BufferGeometry()
  waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(water, 3))
  waterGeo.setIndex(waterIdx)
  const supports: THREE.Matrix4[] = []
  for (let i = 0; i < 40; i++) {
    const p = flumePoint(i / 40, _p)
    supports.push(new THREE.Matrix4().makeScale(1, p.y - GROUND_Y, 1).setPosition(p.x, GROUND_Y, p.z))
  }
  return { channel: channelGeo, water: waterGeo, supports }
}

function buildLogGeometry(): THREE.BufferGeometry {
  return mergePainted([
    painted(new THREE.BoxGeometry(3.6, 1.6, 8), '#8b5a2b', [0, 1.4, 0]),
    painted(new THREE.IcosahedronGeometry(0.8, 0), '#f0c8a0', [0, 2.9, 1.4]),
    painted(new THREE.IcosahedronGeometry(0.8, 0), '#8a5a3c', [0, 2.9, -1.4]),
  ])
}

const _m = new THREE.Matrix4()
const _f = new THREE.Vector3()

function LogFlume({ clock, water: waterMaterial }: { clock: TitleClock; water: THREE.Material }) {
  const { channel, water, supports } = useMemo(buildFlume, [])
  const support = useMemo(() => new THREE.CylinderGeometry(0.5, 0.6, 1, 5, 1, true).translate(0, 0.5, 0), [])
  const log = useMemo(buildLogGeometry, [])
  const wood = useMemo(() => new THREE.MeshLambertMaterial({ color: '#a8743e', side: THREE.DoubleSide }), [])
  const logMaterial = useMemo(() => vertexColored(), [])
  useEffect(
    () => () => [channel, water, support, log, wood, logMaterial].forEach((d) => d.dispose()),
    [channel, water, support, log, wood, logMaterial],
  )
  const supportsRef = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = supportsRef.current
    if (!mesh) return
    supports.forEach((s, i) => mesh.setMatrixAt(i, s))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [supports])
  const logsRef = useRef<THREE.InstancedMesh>(null)
  useFrame(() => {
    const mesh = logsRef.current
    if (!mesh) return
    for (let i = 0; i < FLUME_LOGS; i++) {
      const p = flumeFrame(clock.scene / FLUME_LAP_S + i / FLUME_LOGS)
      _f.copy(_t)
      _m.makeBasis(_side, _q.crossVectors(_f, _side), _f).setPosition(p)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <mesh name="title-flume" geometry={channel} material={wood} />
      <mesh geometry={water} material={waterMaterial} />
      <instancedMesh ref={supportsRef} args={[support, wood, supports.length]} />
      <instancedMesh ref={logsRef} args={[log, logMaterial, FLUME_LOGS]} frustumCulled={false} />
    </>
  )
}

export default function TitleRides({ clock, water }: { clock: TitleClock; water: THREE.Material }) {
  return (
    <>
      <DropTower clock={clock} />
      <SwingRide />
      <LogFlume clock={clock} water={water} />
    </>
  )
}
