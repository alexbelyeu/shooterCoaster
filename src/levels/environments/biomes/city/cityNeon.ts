import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { mergePainted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import type { NeonColor, NeonSign, Tower } from './cityLayout'

/** sRGB neon; the material scales them past the bloom threshold. */
export const NEON_RGB: Record<NeonColor, number> = { magenta: 0xff2fb0, cyan: 0x2ee8ff, amber: 0xffa424 }

/** How far past white the neon burns, so the bloom picks it up. */
export const NEON_GAIN = 2.2

/** How a sign lights (#324): steady, light bands chasing along it, blinking on and off, or steady with a stutter now and then. */
const NEON_PATTERNS = ['steady', 'chase', 'blink', 'flicker'] as const
type NeonPattern = (typeof NEON_PATTERNS)[number]

function hash01(i: number, salt: number): number {
  return Math.abs(Math.sin(i * salt + 311.7) * 43758.5453) % 1
}

/** By a hash of the sign's index, so the city's seeded layout is untouched. */
function neonPattern(i: number): NeonPattern {
  const h = hash01(i, 127.1)
  return h < 0.4 ? 'chase' : h < 0.6 ? 'blink' : h < 0.75 ? 'flicker' : 'steady'
}

/** Every slab as one vertex-coloured geometry; `aNeon` is (distance along the slab's long axis, 0, seed, pattern). Caller disposes. */
export function neonGeometry(signs: readonly NeonSign[]): THREE.BufferGeometry {
  return mergePainted(
    signs.map((s, i) => {
      const box = new THREE.BoxGeometry(s.w, s.h, s.d).toNonIndexed()
      const pos = box.attributes.position
      const neon = new Float32Array(pos.count * 4)
      const seed = hash01(i, 78.233)
      const pattern = NEON_PATTERNS.indexOf(neonPattern(i))
      for (let v = 0; v < pos.count; v++) {
        neon[v * 4] = s.w >= s.h ? pos.getX(v) + s.w / 2 : s.h / 2 - pos.getY(v)
        neon[v * 4 + 2] = seed
        neon[v * 4 + 3] = pattern
      }
      box.setAttribute('aNeon', new THREE.BufferAttribute(neon, 4))
      return paintedAt(box, NEON_RGB[s.color], pose([s.x, s.y, s.z], [0, s.yaw, 0]))
    }),
  )
}

/** The scene clock's seconds, shared by every neon material. */
const neonTime = { value: 0 }

/** Each component that draws city neon calls this. */
export function useNeonClock(): void {
  useFrame(({ clock }) => {
    neonTime.value = clock.elapsedTime
  })
}

const neonVertexHead = /* glsl */ `
attribute vec4 aNeon;
varying vec4 vNeon;
`

// The patterns in `NEON_PATTERNS` order
const neonFragmentHead = /* glsl */ `
uniform float uNeonTime;
varying vec4 vNeon;
float neonLevel(vec4 n, float t) {
  float seed = n.z;
  if (n.w < 0.5) return 1.0;
  if (n.w < 1.5) return 0.25 + 0.75 * step(0.45, fract(n.x / 16.0 - t * (0.9 + seed)));
  if (n.w < 2.5) return 0.12 + 0.88 * step(0.3, fract(t * (0.45 + 0.35 * seed) + seed));
  // Flicker: a stutter of a few frames every few seconds
  float stutter = step(0.86, fract(t * 0.21 + seed));
  float h = fract(sin(floor(t * 15.0) * 12.9898 + seed * 78.233) * 43758.5453);
  return 1.0 - stutter * step(0.45, h) * 0.85;
}
`

/** Unlit neon, burning past white, each sign lit by its pattern. Caller disposes. */
export function createNeonMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true })
  material.color.setScalar(NEON_GAIN)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNeonTime = neonTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${neonVertexHead}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNeon = aNeon;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${neonFragmentHead}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= neonLevel(vNeon, uNeonTime);')
  }
  material.customProgramCacheKey = () => 'city-neon'
  return material
}

/** Unit box standing on y = 0: every tower is one instance of it, scaled (`towerMatrix`). Caller disposes. */
export function createTowerGeometry(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
}

const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _q = new THREE.Quaternion()

/** A tower's instance matrix, its base `sink` below the ground at `baseY` so it never floats on a swell. */
export function towerMatrix(t: Tower, baseY: number, sink = 4): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_p.set(t.x, baseY - sink, t.z), _q, _s.set(t.w, t.h + sink, t.d))
}
