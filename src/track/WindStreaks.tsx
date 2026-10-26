import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STREAK_COUNT, STREAK_INNER_RADIUS, streakLayout } from './windStreaks'

/** Written by CoasterCamera each frame: opacity (0 hides the mesh) and the streak clock (s). */
export interface StreakDrive {
  opacity: number
  time: number
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  attribute vec2 aCorner;  // x: 0 tail → 1 head, y: -1 / 1 across
  attribute vec4 aStreak;  // angle, phase, length, rate
  varying vec2 vCorner;
  varying float vLife;
  void main() {
    // Built in clip space from the projection, so streaks ignore the scene and fit any aspect.
    float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
    float outer = length(vec2(aspect, 1.0)) + 0.1;
    float life = fract(aStreak.y + uTime * aStreak.w);
    // Exponential outward flight reads like perspective: slow near the centre, rushing at the edge.
    float head = ${STREAK_INNER_RADIUS.toFixed(3)} * pow(outer / ${STREAK_INNER_RADIUS.toFixed(3)}, life);
    float r = head * (1.0 - aStreak.z * (1.0 - aCorner.x));
    vec2 dir = vec2(cos(aStreak.x), sin(aStreak.x));
    vec2 q = dir * r + vec2(-dir.y, dir.x) * aCorner.y * 0.005 * head;
    vCorner = aCorner;
    vLife = life;
    gl_Position = vec4(q.x / aspect, q.y, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vCorner;
  varying float vLife;
  void main() {
    float along = sin(3.14159265 * vCorner.x);
    float across = 1.0 - vCorner.y * vCorner.y;
    float fade = smoothstep(0.0, 0.3, vLife) * (1.0 - smoothstep(0.8, 1.0, vLife));
    gl_FragColor = vec4(vec3(0.85, 0.92, 1.0), uOpacity * along * across * fade);
  }
`

function buildGeometry(): THREE.BufferGeometry {
  const layout = streakLayout(STREAK_COUNT)
  const corners = [0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1]
  const corner = new Float32Array(STREAK_COUNT * 12)
  const streak = new Float32Array(STREAK_COUNT * 24)
  for (let i = 0; i < STREAK_COUNT; i++) {
    corner.set(corners, i * 12)
    for (let v = 0; v < 6; v++) streak.set(layout.subarray(i * 4, i * 4 + 4), i * 24 + v * 4)
  }
  const geometry = new THREE.BufferGeometry()
  // `position` is unused by the shader but three needs it for the vertex count.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAK_COUNT * 18), 3))
  geometry.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2))
  geometry.setAttribute('aStreak', new THREE.BufferAttribute(streak, 4))
  return geometry
}

/** Not `transparent`, so it sorts in the opaque list by renderOrder: over the world (0), under the gun (10). */
export default function WindStreaks({ drive }: { drive: StreakDrive }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geometry = useMemo(buildGeometry, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const visible = drive.opacity > 0.002
    if (mesh.visible !== visible) mesh.visible = visible
    if (!visible) return
    material.uniforms.uOpacity.value = drive.opacity
    material.uniforms.uTime.value = drive.time
  })

  return (
    <mesh
      ref={meshRef}
      name="wind-streaks"
      geometry={geometry}
      material={material}
      visible={false}
      frustumCulled={false}
      renderOrder={9}
    />
  )
}
