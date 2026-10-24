import { Effect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'
import { hueOf, LUMA, whiteBalanceGains, type GradeConfig } from './colourGrade'

/** Colour grade + vignette, merged into the composer's EffectPass before ToneMapping so it grades linear HDR colour at no extra pass. */
const fragmentShader = /* glsl */ `
uniform float exposure;
uniform vec3 whiteBalance;
uniform vec3 shadowHue;
uniform vec3 highlightHue;
uniform float splitTone;
uniform float contrast;
uniform float saturation;
uniform float vibrance;
uniform float vignette;

const vec3 GRADE_LUMA = vec3(${LUMA.join(', ')});
const float MID_GREY = 0.18;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb * exposure * whiteBalance, 0.0);

  // 0 in deep shadow, 0.5 at mid grey, towards 1 in highlights
  float l = dot(c, GRADE_LUMA);
  float t = l / (l + MID_GREY);
  c *= mix(vec3(1.0), shadowHue, splitTone * (1.0 - t) * (1.0 - t));
  c *= mix(vec3(1.0), highlightHue, splitTone * t * t);

  c = MID_GREY * pow(c / MID_GREY, vec3(contrast));

  l = dot(c, GRADE_LUMA);
  float hi = max(c.r, max(c.g, c.b));
  float chroma = (hi - min(c.r, min(c.g, c.b))) / max(hi, 1e-4);
  c = max(mix(vec3(l), c, saturation + vibrance * (1.0 - chroma)), 0.0);

  // Aspect-corrected distance over the corner radius: round on any screen, 1 at the corners
  vec2 frame = vec2(aspect, 1.0);
  float d = length((uv - 0.5) * frame) / length(0.5 * frame);
  c *= 1.0 - vignette * smoothstep(0.2, 1.0, d);

  outputColor = vec4(c, inputColor.a);
}
`

function createUniforms() {
  return {
    exposure: new Uniform(1),
    whiteBalance: new Uniform(new Vector3(1, 1, 1)),
    shadowHue: new Uniform(new Vector3(1, 1, 1)),
    highlightHue: new Uniform(new Vector3(1, 1, 1)),
    splitTone: new Uniform(0),
    contrast: new Uniform(1),
    saturation: new Uniform(1),
    vibrance: new Uniform(0),
    vignette: new Uniform(0),
  }
}

export class ColourGradeEffect extends Effect {
  private readonly gradeUniforms: ReturnType<typeof createUniforms>

  constructor() {
    const uniforms = createUniforms()
    super('ColourGradeEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>(Object.entries(uniforms)),
    })
    this.gradeUniforms = uniforms
  }

  setGrade(grade: GradeConfig): void {
    const u = this.gradeUniforms
    u.exposure.value = grade.exposure
    u.whiteBalance.value.fromArray(whiteBalanceGains(grade.temperature, grade.tint))
    u.shadowHue.value.fromArray(hueOf(grade.shadowTint))
    u.highlightHue.value.fromArray(hueOf(grade.highlightTint))
    u.splitTone.value = grade.splitTone
    u.contrast.value = grade.contrast
    u.saturation.value = grade.saturation
    u.vibrance.value = grade.vibrance
    u.vignette.value = grade.vignette
  }
}
