import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { noiseGlsl } from './LavaShader'

interface Puff {
  y: number
  halfWidth: number
  halfHeight: number
}

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  attribute vec2 aCorner;
  attribute vec2 aHalfSize;
  attribute float aSeed;
  attribute float aColumnT;

  varying vec2 vCorner;
  varying float vSeed;
  varying float vColumnT;

  void main() {
    // Cylindrical billboard: turn to the camera about Y only, so the column stays upright
    vec3 center = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 toCam = cameraPosition - center;
    vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-5, 0.0, 0.0));
    vec3 world = center + right * aCorner.x * aHalfSize.x + vec3(0.0, aCorner.y * aHalfSize.y, 0.0);

    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vCorner = aCorner;
    vSeed = aSeed;
    vColumnT = aColumnT;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform vec3 uSmokeColor;
  uniform vec3 uGlowColor;
  uniform float uOpacity;

  varying vec2 vCorner;
  varying float vSeed;
  varying float vColumnT;

  ${noiseGlsl}

  void main() {
    float spin = (uTime * 0.025 + vSeed * 6.2831) * (vSeed > 0.5 ? 1.0 : -1.0);
    float c = cos(spin), s = sin(spin);
    vec2 q = mat2(c, s, -s, c) * (vCorner * vec2(1.6, 2.0)) + vec2(vSeed * 17.0, -uTime * 0.05);

    // Two layers of domain warping, as in the lava shader, so it billows instead of streaking
    vec2 w1 = vec2(fbm(q + vec2(1.7, 9.2)), fbm(q + vec2(8.3, 2.8)));
    vec2 w2 = vec2(fbm(q + 2.0 * w1 + vec2(3.1, uTime * 0.03)), fbm(q + 2.0 * w1 + vec2(5.8, 1.3)));
    float n = fbm(q + 1.6 * w2);

    float r = length(vCorner);
    float body = 1.0 - smoothstep(0.25, 1.0, r - n * 0.45);
    float density = body * clamp(0.75 + n * 1.5, 0.0, 1.0);

    // Lit from below by the crater, fading to ash grey above (kept dim so bloom ignores it)
    vec3 col = mix(uGlowColor, uSmokeColor, smoothstep(0.0, 0.45, vColumnT));
    col *= 0.75 + 0.6 * n;

    gl_FragColor = vec4(col, density * uOpacity);
    #ifdef USE_FOG
      // Half the scene fog, so the distant column still stands out from the sky
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 0.5 * smoothstep(fogNear, fogFar, vFogDepth));
    #endif
  }
`

/** All puffs in one geometry, so the column is one draw call. */
function createColumnGeometry(puffs: readonly Puff[]): THREE.BufferGeometry {
  const bottom = Math.min(...puffs.map(p => p.y - p.halfHeight))
  const top = Math.max(...puffs.map(p => p.y + p.halfHeight))
  const corners = [-1, -1, 1, -1, 1, 1, -1, 1]
  const positions: number[] = []
  const cornerAttr: number[] = []
  const halfSize: number[] = []
  const seeds: number[] = []
  const columnT: number[] = []
  const indices: number[] = []
  puffs.forEach((p, i) => {
    for (let k = 0; k < 4; k++) {
      const cy = corners[k * 2 + 1]
      positions.push(0, p.y, 0)
      cornerAttr.push(corners[k * 2], cy)
      halfSize.push(p.halfWidth, p.halfHeight)
      seeds.push((i * 0.618 + 0.21) % 1)
      columnT.push((p.y + cy * p.halfHeight - bottom) / (top - bottom))
    }
    const b = i * 4
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('aCorner', new THREE.Float32BufferAttribute(cornerAttr, 2))
  geo.setAttribute('aHalfSize', new THREE.Float32BufferAttribute(halfSize, 2))
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geo.setAttribute('aColumnT', new THREE.Float32BufferAttribute(columnT, 1))
  geo.setIndex(indices)
  // Positions are puff centres; the billboards extend beyond them
  const reach = Math.max(...puffs.map(p => Math.hypot(p.halfWidth, p.halfHeight)))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, (top + bottom) / 2, 0), (top - bottom) / 2 + reach)
  return geo
}

interface SmokeColumnProps {
  puffs: readonly Puff[]
}

/** Billowing smoke column: camera-facing puffs with a domain-warped noise shader. */
export default function SmokeColumn({ puffs }: SmokeColumnProps) {
  const geometry = useMemo(() => createColumnGeometry(puffs), [puffs])
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSmokeColor: { value: new THREE.Color(0x4a3833) },
        uGlowColor: { value: new THREE.Color(0xb8461a) },
        uOpacity: { value: 0.95 },
      },
    ]),
    transparent: true,
    depthWrite: false,
    fog: true,
  }), [])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })

  return <mesh geometry={geometry} material={material} />
}
