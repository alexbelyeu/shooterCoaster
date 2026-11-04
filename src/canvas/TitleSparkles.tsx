import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createRng } from '@/utils/rng'

const COUNT = 80
const SPREAD = 200
const SIZE = 4

const vertexShader = /* glsl */ `
  uniform float uPointScale;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uPointScale / -mvPosition.z;
  }
`

// Floored divisor and clamped alpha: drei's unbounded 0.05 / d glow hit Inf on a centred pixel, a NaN Bloom spread frame-wide (#344).
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float a = clamp(0.05 / max(d, 0.001) - 0.1, 0.0, 1.0);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createGeometry(): THREE.BufferGeometry {
  const rng = createRng(0x5a4c)
  const positions = new Float32Array(COUNT * 3)
  for (let i = 0; i < positions.length; i++) positions[i] = rng.range(-SPREAD / 2, SPREAD / 2)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geo
}

/** Gold glints floating over the title park: one draw call. */
export default function TitleSparkles() {
  const dpr = useThree((s) => s.viewport.dpr)
  const geometry = useMemo(createGeometry, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uPointScale: { value: SIZE * 25 }, uColor: { value: new THREE.Color('#ffd700') } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => {
    material.uniforms.uPointScale.value = SIZE * 25 * dpr
  }, [material, dpr])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <points name="title-sparkles" geometry={geometry} material={material} />
}
