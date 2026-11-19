import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
import { sfx } from '@/audio/sfx'
import { useGameStore } from '@/store/useGameStore'
import { e2eSwitch, isE2E } from '@/testing/e2eHook'
import type { TrackCurve } from './curves/TrackCurve'
import { type Junction, type RoutedCurve, type SwitchPose, switchOpen, switchPose } from './junction'
import { rideProgress } from './rideProgress.hot'

const TARGET_ID = 'track-switch'
/** The board and its post, in eye heights. */
const BOARD_W = 6
const BOARD_H = 3.6
const POST_H = 4
const POST_W = 0.35
/** The hit sphere round the board's centre, in eye heights. */
const HIT_RADIUS = 3.6
const FLIP_S = 0.35

const EASY = { label: 'V2', bg: '#15803d', fg: '#f0fdf4' }
const HARD = { label: 'V8', bg: '#ea580c', fg: '#fff7ed' }

/** Two faces on one canvas: the easy way (V2, straight on) on top, the hard way (V8, turning off) below. */
function drawFaces(side: 1 | -1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const g = canvas.getContext('2d')
  if (g) {
    const face = (top: number, { label, bg, fg }: typeof EASY, arrow: (g: CanvasRenderingContext2D) => void) => {
      g.fillStyle = '#1f2937'
      g.fillRect(0, top, 256, 128)
      g.fillStyle = bg
      g.fillRect(8, top + 8, 240, 112)
      g.fillStyle = fg
      g.strokeStyle = fg
      g.font = 'bold 76px Inter, sans-serif'
      g.textBaseline = 'middle'
      g.textAlign = 'left'
      g.fillText(label, 24, top + 68)
      g.lineWidth = 12
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.save()
      g.translate(196, top + 64)
      arrow(g)
      g.restore()
    }
    const head = (g: CanvasRenderingContext2D, x: number, y: number, angle: number) => {
      g.save()
      g.translate(x, y)
      g.rotate(angle)
      g.beginPath()
      g.moveTo(0, -16)
      g.lineTo(14, 6)
      g.lineTo(-14, 6)
      g.closePath()
      g.fill()
      g.restore()
    }
    face(0, EASY, (g) => {
      g.beginPath()
      g.moveTo(0, 36)
      g.lineTo(0, -24)
      g.stroke()
      head(g, 0, -30, 0)
    })
    face(128, HARD, (g) => {
      g.beginPath()
      g.moveTo(-side * 10, 36)
      g.quadraticCurveTo(-side * 10, -16, side * 22, -18)
      g.stroke()
      head(g, side * 28, -18, (side * Math.PI) / 2)
    })
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** The board (front: the top half of the faces, back: the bottom half) on a post, in eye heights times `eye`. */
function buildSignGeometry(eye: number): THREE.BufferGeometry {
  const w = BOARD_W * eye
  const h = BOARD_H * eye
  const front = new THREE.PlaneGeometry(w, h)
  const back = new THREE.PlaneGeometry(w, h).rotateY(Math.PI)
  const uvs = (geom: THREE.BufferGeometry, v0: number) => {
    const uv = geom.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * 0.5)
  }
  uvs(front, 0.5)
  uvs(back, 0)
  front.translate(0, 0, 0.01 * eye)
  back.translate(0, 0, -0.01 * eye)
  const post = new THREE.BoxGeometry(POST_W * eye, POST_H * eye, POST_W * eye).translate(0, -(h + POST_H * eye) / 2, 0)
  // The post takes the faces' dark border.
  const uv = post.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.01, 0.99)
  const merged = mergeGeometries([front, back, post])
  front.dispose()
  back.dispose()
  post.dispose()
  if (!merged) throw new Error('switch sign geometry merge failed')
  return merged
}

interface TrackSwitchProps {
  /** The main (easy) route. */
  main: TrackCurve
  junction: Junction
  /** The ride's curve: the switch sets its `hard`. */
  routed: RoutedCurve
  eyeHeight: number
}

/** A junction's switch (#702): a V2 sign at the fork; shoot it and it flips to V8 with a clunk, and the car takes the hard way. */
export default function TrackSwitch({ main, junction, routed, eyeHeight }: TrackSwitchProps) {
  const groupRef = useRef<THREE.Group>(null)
  const runId = useGameStore((s) => s.runId)
  const pose: SwitchPose = useMemo(() => switchPose(main, junction, eyeHeight), [main, junction, eyeHeight])
  const geometry = useMemo(() => buildSignGeometry(eyeHeight), [eyeHeight])
  const texture = useMemo(() => drawFaces(pose.side), [pose.side])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), [texture])
  /** Seconds since the switch was thrown; -1 while it is set to the easy way. */
  const flipAge = useRef(-1)
  const armed = useRef(false)

  useEffect(
    () => () => {
      geometry.dispose()
      texture.dispose()
      material.dispose()
    },
    [geometry, texture, material],
  )

  useEffect(() => {
    routed.hard = false
    flipAge.current = -1
    armed.current = true
    registerCollisionTarget({
      id: TARGET_ID,
      kind: 'switch',
      getPosition: () => pose.position,
      radiusSq: (HIT_RADIUS * eyeHeight) ** 2,
      onHit: () => {
        if (routed.hard || !switchOpen(rideProgress(), pose)) return
        routed.hard = true
        flipAge.current = 0
        armed.current = false
        unregisterCollisionTarget(TARGET_ID)
        sfx().trackSwitch()
      },
    })
    if (isE2E) e2eSwitch.state = { pose, routed, main, junction, open: () => switchOpen(rideProgress(), pose) }
    return () => {
      unregisterCollisionTarget(TARGET_ID)
      routed.hard = false
      if (isE2E) e2eSwitch.state = null
    }
  }, [routed, pose, main, junction, eyeHeight, runId])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    if (armed.current && !switchOpen(rideProgress(), pose)) {
      armed.current = false
      unregisterCollisionTarget(TARGET_ID)
    }
    let turn = 0
    if (flipAge.current >= 0) {
      const { phase, timeScale } = useGameStore.getState()
      if (phase === 'playing') flipAge.current += delta * timeScale
      const u = Math.min(flipAge.current / FLIP_S, 1)
      // Ease out with a small overshoot: the board slams round and settles.
      const k = 1 - (1 - u) ** 3
      turn = Math.PI * (k + 0.08 * Math.sin(Math.PI * u))
    }
    group.rotation.y = pose.yaw + turn
  })

  return (
    <group ref={groupRef} position={pose.position} rotation-y={pose.yaw}>
      <mesh name="junction-switch" geometry={geometry} material={material} />
    </group>
  )
}
