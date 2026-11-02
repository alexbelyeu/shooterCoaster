import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ARCH_BOARD_DEPTH, ARCH_BOARD_HEIGHT, ARCH_BOARD_WIDTH, type Arch } from './parkSpec'

const TITLE = 'SHOOTER COASTER'
/** Lobster comes from global.css; until it loads (or if it never does) the canvas uses a system face. */
const FONT_FAMILY = 'Lobster, "Arial Black", Impact, sans-serif'
const POST_SIZE = 6

function drawSign(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#c41e4a')
  bg.addColorStop(1, '#7a1036')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.lineWidth = h * 0.06
  ctx.strokeStyle = '#ffd040'
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2)

  let size = h * 0.62
  ctx.font = `${size}px ${FONT_FAMILY}`
  const maxW = w * 0.9
  const measured = ctx.measureText(TITLE).width
  if (measured > maxW) size *= maxW / measured
  ctx.font = `${size}px ${FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = size * 0.08
  ctx.strokeStyle = '#3a0618'
  ctx.strokeText(TITLE, w / 2, h * 0.53)
  ctx.fillStyle = '#ffe680'
  ctx.fillText(TITLE, w / 2, h * 0.53)
}

/** "SHOOTER COASTER" board on two posts across the track; its marquee bulbs come from the layout. */
export default function EntranceArch({ arch }: { arch: Arch }) {
  const assets = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = Math.round((1024 * ARCH_BOARD_HEIGHT) / ARCH_BOARD_WIDTH)
    drawSign(canvas)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    const face = new THREE.MeshBasicMaterial({ map: texture })
    const trim = new THREE.MeshPhongMaterial({ color: '#7a1036', flatShading: true })
    return {
      canvas,
      texture,
      face,
      trim,
      // BoxGeometry face order +x, -x, +y, -y, +z, -z: the sign reads from both sides.
      boardMats: [trim, trim, trim, trim, face, face],
      board: new THREE.BoxGeometry(ARCH_BOARD_WIDTH, ARCH_BOARD_HEIGHT, ARCH_BOARD_DEPTH),
      post: new THREE.BoxGeometry(POST_SIZE, arch.postHeight, POST_SIZE),
      postMat: new THREE.MeshPhongMaterial({ color: '#ff4444', specular: '#444444', shininess: 40, flatShading: true }),
      finial: new THREE.ConeGeometry(POST_SIZE * 0.9, 12, 6),
      finialMat: new THREE.MeshPhongMaterial({ color: '#ffd040', specular: '#666666', shininess: 60, flatShading: true }),
    }
  }, [arch.postHeight])

  useEffect(() => {
    let live = true
    document.fonts?.load(`64px ${FONT_FAMILY}`).then(() => {
      if (!live) return
      drawSign(assets.canvas)
      assets.texture.needsUpdate = true
    }, () => {})
    return () => {
      live = false
    }
  }, [assets])

  useEffect(() => {
    return () => {
      assets.texture.dispose()
      assets.face.dispose()
      assets.trim.dispose()
      assets.board.dispose()
      assets.post.dispose()
      assets.postMat.dispose()
      assets.finial.dispose()
      assets.finialMat.dispose()
    }
  }, [assets])

  const postY = arch.groundY - 2 + arch.postHeight / 2 - arch.y
  const topY = arch.groundY - 2 + arch.postHeight - arch.y

  return (
    <>
      <group position={[arch.x, arch.y, arch.z]} rotation={[0, arch.yaw, 0]}>
        <mesh geometry={assets.board} material={assets.boardMats} position={[0, arch.boardY - arch.y + ARCH_BOARD_HEIGHT / 2, 0]} />
      </group>
      {arch.feet.map((f, i) => (
        <group key={i} position={[f.x, arch.y, f.z]} rotation={[0, arch.yaw, 0]}>
          <mesh geometry={assets.post} material={assets.postMat} position={[0, postY, 0]} />
          <mesh geometry={assets.finial} material={assets.finialMat} position={[0, topY + 6, 0]} />
        </group>
      ))}
    </>
  )
}
