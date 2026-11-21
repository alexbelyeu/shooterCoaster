/**
 * Build-time GLSL whitespace and comment stripping for the `/* glsl *\/` tagged template literals
 * in `src/` (vite.config.ts `minifyGlsl`). esbuild minifies the JS around a shader but keeps the
 * shader's text as written, indentation and comments included (~4.5 KB gz of the LevelScene chunk).
 *
 * Per line of shader text: drop `//` and `/* *\/` comments, the indentation and trailing spaces,
 * then the lines left empty. Newlines stay (preprocessor lines end at one). Text touching a
 * `${…}` keeps its spaces on that side (`float ${name}`), and a literal that can't be stripped
 * safely (a comment running into a `${…}`, a nested template literal) is left exactly as written.
 */

const TAG = /\/\*\s*glsl\s*\*\/\s*`/g

/**
 * Splits the template literal whose body starts at `start` (just past its opening backtick) into
 * its static parts and the `${…}` expressions between them. Returns null when it can't be sure
 * where an expression ends (a backtick or quote inside one) or the literal never closes.
 * @param {string} code
 * @param {number} start
 * @returns {{ quasis: string[], exprs: string[], end: number } | null}
 */
function splitTemplate(code, start) {
  const quasis = []
  const exprs = []
  let text = ''
  let i = start
  while (i < code.length) {
    const c = code[i]
    if (c === '\\') {
      text += code.slice(i, i + 2)
      i += 2
    } else if (c === '`') {
      quasis.push(text)
      return { quasis, exprs, end: i + 1 }
    } else if (c === '$' && code[i + 1] === '{') {
      let depth = 1
      let j = i + 2
      while (j < code.length && depth > 0) {
        const d = code[j]
        if (d === '`' || d === '"' || d === "'") return null
        if (d === '{') depth++
        else if (d === '}') depth--
        j++
      }
      if (depth > 0) return null
      quasis.push(text)
      exprs.push(code.slice(i, j))
      text = ''
      i = j
    } else {
      text += c
      i++
    }
  }
  return null
}

/**
 * One static part of a shader. `afterExpr` / `beforeExpr`: a `${…}` touches its start / end, so
 * that edge keeps its spaces. Null when a comment would swallow the expression that follows.
 * @param {string} text
 * @param {boolean} afterExpr
 * @param {boolean} beforeExpr
 * @returns {string | null}
 */
function minifyPart(text, afterExpr, beforeExpr) {
  const blocks = text.replace(/\/\*[\s\S]*?\*\//g, ' ')
  if (blocks.includes('/*')) return null
  const lines = blocks.split('\n')
  if (beforeExpr && lines[lines.length - 1].includes('//')) return null
  const last = lines.length - 1
  const out = []
  lines.forEach((raw, k) => {
    let line = raw.replace(/\/\/.*$/, '')
    if (!(k === 0 && afterExpr)) line = line.trimStart()
    if (!(k === last && beforeExpr)) line = line.trimEnd()
    // The first and last line border the backtick or an expression: keep them, even empty, so
    // the newline after a `${…}` stays. Only the inner lines left empty go.
    if (line !== '' || k === 0 || k === last) out.push(line)
  })
  return out.join('\n')
}

/**
 * Strips the GLSL in every `/* glsl *\/` template literal of a module's source.
 * @param {string} code
 * @returns {string}
 */
export function minifyGlsl(code) {
  let out = ''
  let from = 0
  TAG.lastIndex = 0
  let m
  while ((m = TAG.exec(code))) {
    const bodyStart = m.index + m[0].length
    const parts = splitTemplate(code, bodyStart)
    if (!parts) continue
    const { quasis, exprs, end } = parts
    const mini = quasis.map((q, k) => minifyPart(q, k > 0, k < exprs.length))
    TAG.lastIndex = end
    if (mini.some((q) => q === null)) continue
    let body = mini[0]
    exprs.forEach((e, k) => {
      body += e + mini[k + 1]
    })
    out += code.slice(from, bodyStart) + body + '`'
    from = end
  }
  return out + code.slice(from)
}
