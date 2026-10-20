import * as THREE from 'three'

/**
 * Aurora curtains for the Arctic sky: a few vertical ribbons that sit on a wide
 * ring around the camera (like the sky dome, they follow the camera so they read
 * as "at infinity") and an additive shader with scrolling, domain-warped ray
 * bands in green → teal → violet.
 *
 * Emit `AURORA_INTENSITY_EVENT` on the event bus with a number (1 = default,
 * 0 = off, up to ~2.5) to brighten or dim the curtains; the shader eases toward it.
 */
export const AURORA_INTENSITY_EVENT = 'aurora:intensity'
export const AURORA_DEFAULT_INTENSITY = 1

interface RibbonSpec {
  /** Centre azimuth of the arc (radians, 0 = +x). */
  azimuth: number
  /** Angular span of the arc (radians). */
  span: number
  /** Mean horizontal distance from the camera. */
  radius: number
  /** Amplitude and frequency of the radial folds. */
  foldAmp: number
  foldFreq: number
  /** Lower / upper edge height above the camera. */
  base: number
  top: number
  /** Per-ribbon noise offset. */
  seed: number
}

// The camera's far plane is 11000 (SkyDome sits at 9900): every vertex stays
// within ~9000 of the camera. The bright lower edge hangs ~12-16° above the
// horizon, clear of the mountain line, with a faint haze below it; tops reach ~33°.
const RIBBONS: RibbonSpec[] = [
  { azimuth: 0.2, span: 2.6, radius: 7200, foldAmp: 900, foldFreq: 3.0, base: 1300, top: 4600, seed: 0 },
  { azimuth: 2.4, span: 2.4, radius: 7600, foldAmp: 1100, foldFreq: 2.5, base: 1700, top: 5000, seed: 3.7 },
  { azimuth: 4.4, span: 2.3, radius: 6800, foldAmp: 800, foldFreq: 3.5, base: 1100, top: 4200, seed: 7.9 },
]
const SEGMENTS = 128

/** All ribbons in one geometry (one draw call). uv = (along 0..1, up 0..1). */
export function createAuroraGeometry(): THREE.BufferGeometry {
  const verts = SEGMENTS + 1
  const positions = new Float32Array(RIBBONS.length * verts * 2 * 3)
  const uvs = new Float32Array(RIBBONS.length * verts * 2 * 2)
  // aRibbon: (arc length in km for ray frequency, seed)
  const ribbon = new Float32Array(RIBBONS.length * verts * 2 * 2)
  const indices: number[] = []

  RIBBONS.forEach((r, ri) => {
    const first = ri * verts * 2
    let along = 0
    let px = 0
    let pz = 0
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS
      const a = r.azimuth + (t - 0.5) * r.span
      const rad = r.radius + Math.sin(t * Math.PI * 2 * r.foldFreq + r.seed) * r.foldAmp
      const x = Math.cos(a) * rad
      const z = Math.sin(a) * rad
      if (i > 0) along += Math.hypot(x - px, z - pz) / 1000
      px = x
      pz = z
      // the curtain dips a little where it folds outwards
      const sag = Math.sin(t * Math.PI * 2 * r.foldFreq + r.seed) * 250
      for (let k = 0; k < 2; k++) {
        const v = first + i * 2 + k
        positions.set([x, k === 0 ? r.base - sag : r.top, z], v * 3)
        uvs.set([t, k], v * 2)
        ribbon.set([along, r.seed], v * 2)
      }
      if (i < SEGMENTS) {
        const v = first + i * 2
        indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      }
    }
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute('aRibbon', new THREE.BufferAttribute(ribbon, 2))
  geo.setIndex(indices)
  return geo
}

const noiseGlsl = /* glsl */ `
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // fbm with per-octave rotation (no axis-aligned banding)
  float fbm(vec2 p) {
    const mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.03 + vec2(17.1, 9.7);
      a *= 0.5;
    }
    return v;
  }
`

// The two domain-warp layers only vary along the ribbon (not with height), so they
// are evaluated per vertex (129 columns per ribbon) and interpolated: the fragment
// shader runs a single fbm for the rays.
const vertexShader = /* glsl */ `
  uniform float uTime;
  attribute vec2 aRibbon;
  varying vec2 vUv;
  varying vec2 vRibbon;
  varying vec2 vWarp;
  ${noiseGlsl}
  void main() {
    vUv = uv;
    vRibbon = aRibbon;
    float s = aRibbon.x;   // arc length along the ribbon (km)
    float seed = aRibbon.y;
    // Slow folds: w1 drives where the curtain is bright, w2 how high its lower
    // edge hangs and how the rays bend (it is warped by w1).
    vec2 q = vec2(s * 0.35 + seed, uTime * 0.04);
    float w1 = fbm(q + vec2(uTime * 0.02, 0.0));
    float w2 = fbm(q * 1.7 + vec2(w1 * 1.8, seed - uTime * 0.03));
    vWarp = vec2(w1, w2);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  varying vec2 vUv;
  varying vec2 vRibbon;
  varying vec2 vWarp;
  ${noiseGlsl}

  void main() {
    float s = vRibbon.x;
    float seed = vRibbon.y;
    float h = vUv.y;       // 0 = lower edge, 1 = top
    float t = uTime;
    float w1 = vWarp.x;
    float w2 = vWarp.y;

    float rays = fbm(vec2(s * 4.0 + w2 * 4.0 + t * 0.12, h * 0.8 - t * 0.08 + seed));
    rays = smoothstep(0.3, 0.75, rays);

    // Bright, sharp-ish lower edge that wanders, a long soft fade upward and a
    // fainter glow band near the top (where the colour has turned violet)
    float lower = 0.12 + 0.2 * w2;
    float above = h - lower;
    float vertical = smoothstep(0.0, 0.06, above) * exp(-max(above, 0.0) * 2.4);
    // diffuse haze hanging below the edge, so the curtain doesn't float on a dark gap
    if (above < 0.0) vertical += 0.3 * exp(above * 14.0) * smoothstep(0.0, 0.3, h);
    vertical = max(vertical, 0.45 * smoothstep(0.25, 0.6, above) * (1.0 - smoothstep(0.6, 1.0, h)));
    vertical *= 1.0 - smoothstep(0.8, 1.0, h);

    // Patchy along the band, faded at the ribbon ends
    float patches = smoothstep(0.32, 0.62, w1);
    float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);

    float a = (0.45 + 0.75 * rays) * vertical * (0.25 + 0.75 * patches) * ends * uIntensity;

    vec3 col = mix(uLow, uMid, smoothstep(0.08, 0.4, above));
    col = mix(col, uHigh, smoothstep(0.3, 0.8, above));

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createAuroraMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: AURORA_DEFAULT_INTENSITY },
      uLow: { value: new THREE.Color(0x2bff8a) },
      uMid: { value: new THREE.Color(0x2ee6d6) },
      uHigh: { value: new THREE.Color(0xb05cff) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  })
}
