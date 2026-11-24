import * as THREE from 'three'
import { valueNoiseGlsl } from '@/levels/environments/shared/noiseGlsl'

// Jungle Ruins' two moving surfaces (#870): the waterfall's sheet and the mist banks lying in the valleys.

const waterfallVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const waterfallFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  varying vec2 vUv;
  ${valueNoiseGlsl}
  void main() {
    // Streaks falling down the sheet (v = 1 at the lip), faster as they fall; warped across so they never band
    float fall = (1.0 - vUv.y) * (1.0 + 0.6 * (1.0 - vUv.y));
    float warp = vnoise(vec2(vUv.x * 6.0, fall * 2.0 - uTime * 0.4)) * 0.6;
    float streak = vnoise(vec2(vUv.x * 38.0 + warp * 4.0, fall * 6.0 - uTime * 2.4));
    streak = 0.55 * streak + 0.45 * vnoise(vec2(vUv.x * 90.0 - warp * 3.0, fall * 14.0 - uTime * 3.6));
    vec3 deep = vec3(0.42, 0.62, 0.62);
    vec3 foam = vec3(0.93, 0.97, 0.95);
    vec3 col = mix(deep, foam, smoothstep(0.35, 0.8, streak) * 0.85 + (1.0 - vUv.y) * 0.25);
    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float alpha = edge * mix(0.75, 0.95, streak);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }
`

/** The waterfall's sheet: scrolling foam streaks over a green-blue water, soft at its edges. Drive `uTime`. */
export function createWaterfallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: waterfallVertex,
    fragmentShader: waterfallFragment,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  })
}

const mistVertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec2 aCorner;
  attribute vec2 aHalfSize;
  attribute float aSeed;
  varying vec2 vCorner;
  varying float vSeed;
  varying float vNear;
  void main() {
    // Turned to the camera about y only, so a bank lies level along its valley
    vec3 center = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 toCam = cameraPosition - center;
    vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-5, 0.0, 0.0));
    vec3 world = center + right * aCorner.x * aHalfSize.x + vec3(0.0, aCorner.y * aHalfSize.y, 0.0);
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vCorner = aCorner;
    vSeed = aSeed;
    // A bank the rider rides into thins out instead of filling the screen
    vNear = smoothstep(90.0, 360.0, length(toCam));
    #include <fog_vertex>
  }
`

const mistFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vCorner;
  varying float vSeed;
  varying float vNear;
  ${valueNoiseGlsl}
  void main() {
    vec2 q = vCorner * vec2(3.0, 1.2) + vec2(vSeed * 31.0 + uTime * 0.04, vSeed * 7.0);
    float n = 0.65 * vnoise(q) + 0.35 * vnoise(q * 2.3 + vec2(-uTime * 0.06, 3.1));
    // Flat-bottomed: dense low, wisping out at the top and the ends
    float body = (1.0 - smoothstep(0.3, 1.0, abs(vCorner.x) + n * 0.25)) * (1.0 - smoothstep(-0.2, 1.0, vCorner.y + n * 0.5));
    body *= smoothstep(-1.0, -0.6, vCorner.y);
    gl_FragColor = vec4(uColor, body * (0.55 + 0.45 * n) * uOpacity * vNear);
    #include <fog_fragment>
  }
`

/** Soft mist banks (merged billboards from `mistGeometry`). Drive `uTime`. */
export function createMistMaterial(color: THREE.ColorRepresentation, opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: mistVertex,
    fragmentShader: mistFragment,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    }]),
    transparent: true,
    depthWrite: false,
    fog: true,
  })
}

export interface MistBank {
  x: number
  y: number
  z: number
  halfWidth: number
  halfHeight: number
}

/** One quad per bank, every corner at its bank's centre: the vertex shader spreads them to face the camera. */
export function mistGeometry(banks: readonly MistBank[]): THREE.BufferGeometry {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]
  const position = new Float32Array(banks.length * 18)
  const corner = new Float32Array(banks.length * 12)
  const half = new Float32Array(banks.length * 12)
  const seed = new Float32Array(banks.length * 6)
  banks.forEach((b, i) => {
    corners.forEach(([cx, cy], k) => {
      const v = i * 6 + k
      position.set([b.x, b.y, b.z], v * 3)
      corner.set([cx, cy], v * 2)
      half.set([b.halfWidth, b.halfHeight], v * 2)
      seed[v] = (i * 0.618) % 1
    })
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2))
  geo.setAttribute('aHalfSize', new THREE.BufferAttribute(half, 2))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  // The quads spread far past their centres: bound them generously so they are never culled while in view
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
  return geo
}
