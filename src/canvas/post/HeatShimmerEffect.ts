import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector4 } from 'three'
import { VIEWMODEL_DEPTH_RANGE } from '@/core/cameraLayers'

/**
 * Heat shimmer (#627): wavers the frame inside one screen rect, strongest just over its foot. Depth-tested, so only
 * what lies past the hot air's nearest point wavers, never the gun in the front of the depth range.
 */
const fragmentShader = /* glsl */ `
uniform vec4 shimmerRect;
uniform float shimmerNear;
uniform float shimmerAmp;
uniform float shimmerTime;

const float VIEWMODEL_DEPTH = ${VIEWMODEL_DEPTH_RANGE + 0.005};

bool behindHotAir(const in vec2 at) {
  float depth = readDepth(at);
  return depth > VIEWMODEL_DEPTH && -getViewZ(depth) > shimmerNear;
}

void mainUv(inout vec2 uv) {
  if (shimmerAmp <= 0.0) return;
  vec2 size = max(shimmerRect.zw - shimmerRect.xy, vec2(1e-3));
  vec2 p = (uv - shimmerRect.xy) / size;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0) return;

  float edge = smoothstep(0.0, 0.2, p.x) * smoothstep(1.0, 0.8, p.x);
  float rise = smoothstep(0.0, 0.1, p.y) * pow(1.0 - p.y, 1.5);

  // Ripples square on screen, rising with the hot air
  vec2 q = vec2(p.x * size.x * aspect / size.y, p.y) * 9.0;
  float t = shimmerTime;
  q.y -= t * 2.2;
  float dx = sin(q.y * 1.3 + sin(q.x * 0.9 + t * 2.1) * 1.4 + t * 3.0) + 0.5 * sin(q.y * 2.7 - q.x * 1.7 + t * 4.3);
  float dy = sin(q.x * 1.1 + q.y * 0.7 - t * 2.6);
  vec2 moved = uv + vec2(dx, 0.5 * dy) * (shimmerAmp * edge * rise);
  if (behindHotAir(uv) && behindHotAir(moved)) uv = moved;
}
`

/** The shimmer's uniforms, shared by the one effect and whatever fire sets them (`FlameFire`). */
export const HEAT_SHIMMER = {
  /** Screen bounds (uv: x0, y0, x1, y1) of the hot air. */
  shimmerRect: new Uniform(new Vector4(0, 0, 1, 1)),
  /** View distance to the hot air's nearest point: anything nearer is in front of it. */
  shimmerNear: new Uniform(0),
  /** Waver at its strongest (uv); 0 is off. */
  shimmerAmp: new Uniform(0),
  shimmerTime: new Uniform(0),
}

export class HeatShimmerEffect extends Effect {
  constructor() {
    super('HeatShimmerEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>(Object.entries(HEAT_SHIMMER)),
    })
  }
}
