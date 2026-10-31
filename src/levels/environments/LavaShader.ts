import * as THREE from 'three'
import { gradientNoiseGlsl } from './shared/noiseGlsl'

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

  ${gradientNoiseGlsl}

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

    // Cells a few pixels wide alias into yellow sparkle: fade to the average heat
    float cellsPerPixel = length(fwidth(warpedUV * 1.8));
    heat = mix(heat, 0.3, smoothstep(0.06, 0.35, cellsPerPixel));

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

/** Lava material: geometry `uv.x` 0..1 across a strip, `uv.y` the distance along it in strip widths (round crust cells); flows towards lower `uv.y`. */
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
