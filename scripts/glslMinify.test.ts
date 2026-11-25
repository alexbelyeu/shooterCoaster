import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { minifyGlsl } from './glslMinify.mjs'

const glsl = (body: string) => 'const S = /* glsl */ `' + body + '`\n'

describe('minifyGlsl', () => {
  it('drops comments, indentation and empty lines, keeping one statement per line', () => {
    const src = glsl(`
      // the rim
      uniform float uRim; /* strength */
      void main() {

        gl_FragColor = vec4(1.0); // white
      }
    `)
    expect(minifyGlsl(src)).toBe(glsl('\nuniform float uRim;\nvoid main() {\ngl_FragColor = vec4(1.0);\n}\n'))
  })

  it('keeps preprocessor lines on their own line', () => {
    expect(minifyGlsl(glsl('\n  #ifdef A // a\n    #define B 2\n  #endif\n'))).toBe(glsl('\n#ifdef A\n#define B 2\n#endif\n'))
  })

  it('keeps the spaces and newlines that touch an interpolation', () => {
    const src = glsl('\n  float ${name} = 1.0;\n  ${chunk}\n  x += 1.0;  // c\n')
    expect(minifyGlsl(src)).toBe(glsl('\nfloat ${name} = 1.0;\n${chunk}\nx += 1.0;\n'))
  })

  it('leaves a literal alone when a comment runs into an interpolation or one nests a template', () => {
    const commented = glsl('\n  // was ${old}\n  x;\n')
    const nested = glsl('\n  ${list.map((v) => `float ${v};`).join("")}\n')
    expect(minifyGlsl(commented)).toBe(commented)
    expect(minifyGlsl(nested)).toBe(nested)
  })

  it('touches only glsl-tagged literals', () => {
    const src = 'const a = `  keep  // this\n`\n' + glsl('\n  x;\n')
    expect(minifyGlsl(src)).toBe('const a = `  keep  // this\n`\n' + glsl('\nx;\n'))
  })

  it('strips every shader in src/ (none falls back to its text as written)', () => {
    const files = execSync('git grep -l "/\\* glsl \\*/" -- src', { encoding: 'utf8' }).trim().split('\n')
    const kept: string[] = []
    for (const file of files) {
      const code = fs.readFileSync(path.resolve(file), 'utf8')
      const out = minifyGlsl(code)
      // Any line still indented, or a `//` comment left, in a tagged literal: the minifier gave up on it (#1022).
      for (const [, body] of out.matchAll(/\/\* glsl \*\/\s*`([^`]*)`/g)) {
        if (/\n[ \t]+[^\s$]|^\s*\/\/|\n\s*\/\//.test(body)) kept.push(file)
      }
    }
    expect(kept).toEqual([])
  })
})
