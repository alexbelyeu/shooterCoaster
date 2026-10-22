import * as THREE from 'three'

/**
 * Desert terrain material: the shared vertex-coloured flat-shaded Phong, plus
 * wind-blown sand ripples patched in with onBeforeCompile. Crests run across a
 * fixed wind direction; the steep leeward face of each ripple is darker, the
 * crest a little lighter (±8% luminance). Domain-warped so crests bend and
 * break up instead of drawing straight stripes; faded out on slopes, on the
 * red rock (by vertex-colour hue) and where a ripple gets under ~4 px wide.
 */

/** Wind blows along this angle in XZ (radians); ripple crests run across it. */
const WIND_ANGLE = 0.6
const RIPPLE_STRENGTH = 0.08

const vertexHead = /* glsl */ `
varying vec3 vSandPos;
`

const vertexBody = /* glsl */ `
vSandPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

const fragmentHead = /* glsl */ `
varying vec3 vSandPos;

float sandHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float sandNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(sandHash(i), sandHash(i + vec2(1.0, 0.0)), u.x),
    mix(sandHash(i + vec2(0.0, 1.0)), sandHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// One ripple train: gentle windward rise, steep darker lee face, bright crest.
// Returns [-1, 1]; fades to 0 where the wavelength drops under a few pixels.
float rippleTrain(float phase) {
  float f = fract(phase);
  float crest = smoothstep(0.5, 0.72, f) * (1.0 - smoothstep(0.72, 0.78, f));
  float lee = smoothstep(0.74, 0.8, f) * (1.0 - smoothstep(0.94, 1.0, f));
  float aa = 1.0 - smoothstep(0.12, 0.3, fwidth(phase));
  return (crest * 0.7 - lee) * aa;
}

float sandRipples(vec2 p) {
  const mat2 wind = mat2(${Math.cos(WIND_ANGLE).toFixed(4)}, ${(-Math.sin(WIND_ANGLE)).toFixed(4)},
                         ${Math.sin(WIND_ANGLE).toFixed(4)}, ${Math.cos(WIND_ANGLE).toFixed(4)});
  vec2 q = wind * p; // x: along the wind, y: along the crests
  // Two-layer domain warp, rotated between layers, bends the crests.
  vec2 w1 = vec2(sandNoise(q * 0.006), sandNoise(q * 0.006 + 17.3));
  vec2 r = mat2(0.8, 0.6, -0.6, 0.8) * (q * 0.018 + w1 * 2.5);
  float w2 = sandNoise(r) + 0.5 * sandNoise(r * 2.1 + 5.1);
  // Stretched across the wind: crests are long, spacing is short.
  float along = q.x + w2 * 22.0 + w1.x * 60.0;
  float fine = rippleTrain(along / 9.0 + sandNoise(vec2(q.y * 0.02, q.x * 0.004)) * 1.5);
  float coarse = rippleTrain(along / 47.0 + w1.y * 0.8);
  // Crests break up rather than running forever.
  float breakup = 0.55 + 0.45 * sandNoise(vec2(q.x * 0.01, q.y * 0.035));
  return clamp((fine * 0.65 + coarse * 0.45) * breakup, -1.0, 1.0);
}
`

const fragmentBody = /* glsl */ `
{
  vec3 upView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float flatness = smoothstep(0.8, 0.95, dot(normal, upView));
  // Linear-space vertex colours: sand g/r is 0.57-0.69, red rock and cliffs 0.21-0.31.
  float sandiness = smoothstep(0.38, 0.52, vColor.g / max(vColor.r, 0.001));
  float mask = flatness * sandiness;
  if (mask > 0.0) {
    diffuseColor.rgb *= 1.0 + ${RIPPLE_STRENGTH.toFixed(3)} * mask * sandRipples(vSandPos.xz);
  }
}
`

/** Replaces `chunk` in `source` with itself plus `extra`; throws if three renamed the chunk. */
function inject(source: string, chunk: string, extra: string, before = false): string {
  if (!source.includes(chunk)) throw new Error(`sandRipples: shader chunk ${chunk} not found`)
  return source.replace(chunk, before ? `${extra}\n${chunk}` : `${chunk}\n${extra}`)
}

export function createSandTerrainMaterial(): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = inject(shader.vertexShader, '#include <common>', vertexHead)
    shader.vertexShader = inject(shader.vertexShader, '#include <begin_vertex>', vertexBody)
    shader.fragmentShader = inject(shader.fragmentShader, '#include <common>', fragmentHead)
    shader.fragmentShader = inject(shader.fragmentShader, '#include <normal_fragment_maps>', fragmentBody)
  }
  material.customProgramCacheKey = () => 'desert-sand-ripples'
  return material
}
