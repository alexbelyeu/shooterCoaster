import * as THREE from 'three'

export const lavaVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec3 pos = position;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

export const lavaFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uIntensity;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // --- Hash / noise primitives ---
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
  }

  float hash1(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Gradient noise (smoother than value noise)
  float gnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Voronoi — returns (F1 distance, F2 distance) for cellular crust
  vec2 voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float f1 = 8.0;
    float f2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash2(n + g) * 0.5 + 0.5;
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < f1) { f2 = f1; f1 = d; }
        else if (d < f2) { f2 = d; }
      }
    }
    return vec2(sqrt(f1), sqrt(f2));
  }

  // FBM with rotation per octave to break axis alignment
  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    // Rotation matrix per octave (~37 degrees)
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      value += amp * gnoise(p * freq);
      p = rot * p;
      freq *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;

    // --- Domain warping: use noise to distort the coordinate space ---
    // This breaks up any directional coherence and creates organic swirls
    float t = uTime * uFlowSpeed;
    vec2 baseUV = uv * 2.5;

    // First warp layer — slow large-scale distortion
    vec2 warp1 = vec2(
      fbm(baseUV + vec2(0.0, t * 0.8) + vec2(1.7, 9.2)),
      fbm(baseUV + vec2(0.0, t * 0.8) + vec2(8.3, 2.8))
    );

    // Second warp layer — feeds back the first warp for extra turbulence
    vec2 warp2 = vec2(
      fbm(baseUV + warp1 * 2.0 + vec2(t * 0.3, t * 0.2) + vec2(3.1, 7.4)),
      fbm(baseUV + warp1 * 2.0 + vec2(t * 0.2, t * 0.4) + vec2(5.8, 1.3))
    );

    // Final warped coordinates
    vec2 warpedUV = baseUV + warp2 * 1.5;

    // --- Cellular crust pattern (Voronoi) ---
    // Creates irregular polygon-shaped cooling plates
    vec2 vor = voronoi(warpedUV * 1.8 + vec2(t * 0.15, t * 0.1));
    float crustEdge = smoothstep(0.0, 0.15, vor.y - vor.x); // 1 inside plates, 0 at cracks

    // --- Molten glow through cracks ---
    // Cracks between Voronoi cells are where hot lava shows through
    float cracks = 1.0 - crustEdge;
    cracks = pow(cracks, 0.6); // widen crack glow slightly

    // --- Subsurface turbulence (visible through cracks) ---
    float turb = fbm(warpedUV * 1.5 + vec2(t * 0.5, -t * 0.3));
    turb = turb * 0.5 + 0.5; // remap to 0-1

    // --- Heat map: combine crack glow + subsurface ---
    float heat = cracks * 0.8 + turb * cracks * 0.4;
    // Add faint glow even on crust surface (subsurface scattering feel)
    heat += (1.0 - crustEdge * 0.7) * turb * 0.15;
    heat = clamp(heat, 0.0, 1.0);

    // --- Color ramp: smooth continuous blend ---
    vec3 crustColor = vec3(0.08, 0.03, 0.01);  // near-black cooled rock
    vec3 deepRed    = vec3(0.5, 0.04, 0.0);     // deep red glow
    vec3 orange     = vec3(1.0, 0.3, 0.0);      // hot orange
    vec3 yellow     = vec3(1.0, 0.7, 0.1);      // brightest molten spots

    // Smooth continuous ramp using smoothstep transitions
    vec3 color = crustColor;
    color = mix(color, deepRed, smoothstep(0.0, 0.25, heat));
    color = mix(color, orange,  smoothstep(0.2, 0.55, heat));
    color = mix(color, yellow,  smoothstep(0.5, 0.85, heat));

    // --- Crust surface detail ---
    // Darken the crust plates with low-freq noise for varied plate coloring
    float crustDetail = fbm(warpedUV * 3.0 + vec2(17.0, 23.0)) * 0.3 + 0.85;
    color *= mix(crustDetail, 1.0, heat); // only darken cool areas

    // --- Subtle pulse ---
    float pulse = 0.95 + sin(uTime * 1.2 + turb * 4.0) * 0.05;
    color *= pulse * uIntensity;

    // --- Edge fade (soften at UV edges for river strips) ---
    float edgeFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x);

    gl_FragColor = vec4(color, edgeFade * 0.95);
  }
`

/** Create a shared lava ShaderMaterial instance */
export function createLavaMaterial(flowSpeed = 0.08, intensity = 1.2): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: flowSpeed },
      uIntensity: { value: intensity },
    },
    vertexShader: lavaVertexShader,
    fragmentShader: lavaFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}
