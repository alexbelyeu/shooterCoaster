#!/usr/bin/env node
/**
 * The UI's generic tells (docs/art/PERSONALITY.md "Never"), counted across src/. `npm run lint` runs this: it fails
 * when any count is above `scripts/uiTells.baseline.json`, so no PR adds one, and prints where they are. It also
 * fails when a count is below it, so a PR that removes tells lowers the baseline with `node scripts/uiTells.mjs
 * --update` (which never raises it) and the next PR can't add them back unnoticed.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BASELINE = join(ROOT, 'scripts/uiTells.baseline.json')

/** Each tell: what it is, which files it's looked for in, and how to find it in one file's text. */
export const TELLS = {
  glow: {
    what: 'a blurred text-shadow / box-shadow (a glow or soft card shadow; shadows here are hard)',
    css: true,
    find: (text) => declarations(text, /(?:text|box)-shadow/).filter((v) => shadowLayers(v).some(hasBlur)),
  },
  frosted: { what: 'backdrop-filter (frosted glass)', css: true, find: (text) => declarations(text, /-?(?:webkit-)?backdrop-filter/) },
  gradientSurface: {
    what: 'a gradient as a background',
    css: true,
    find: (text) => declarations(text, /background(?:-image)?/).filter((v) => /gradient\(/.test(v)),
  },
  pill: {
    what: 'a pill radius (border-radius of 40 px or more)',
    css: true,
    find: (text) => declarations(text, /border-radius/).filter((v) => /(?:^|\s)(\d{2,})px/.test(v) && Number(/(\d{2,})px/.exec(v)[1]) >= 40),
  },
  tracking: {
    what: 'letter-spacing (spaced-out labels)',
    css: true,
    find: (text) => declarations(text, /letter-spacing/).filter((v) => !/^(?:0|normal|0px|0em)$/.test(v.trim())),
  },
  allCaps: { what: 'text-transform: uppercase (all-caps labels)', css: true, find: (text) => declarations(text, /text-transform/).filter((v) => /uppercase/.test(v)) },
  edgeAccent: {
    what: 'a thick border on one edge (an accent stripe)',
    css: true,
    find: (text) => declarations(text, /border-(?:top|right|bottom|left)/).filter((v) => /(?:^|\s)[2-9]px\s+solid/.test(v)),
  },
  defaultSans: { what: "Inter or a monospace face", css: true, code: true, find: (text) => text.match(/['"]Inter['"]|\bmonospace\b/g) ?? [] },
  middleDot: { what: 'a string joined with middle dots (" · ")', code: true, find: (text) => text.match(/ · /g) ?? [] },
}

/** The values of every `prop: value;` declaration whose property matches `prop`. */
function declarations(css, prop) {
  const out = []
  const re = new RegExp(`(?:^|[\\s;{])(${prop.source})\\s*:\\s*([^;{}]+)`, 'g')
  for (const m of css.matchAll(re)) out.push(m[2].trim())
  return out
}

/** A shadow's comma-separated layers (commas inside rgb() and friends don't split). */
export function shadowLayers(value) {
  const layers = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth--
    else if (value[i] === ',' && depth === 0) {
      layers.push(value.slice(start, i))
      start = i + 1
    }
  }
  layers.push(value.slice(start))
  return layers.map((l) => l.trim()).filter(Boolean)
}

/** A layer's third length (its blur radius) is above zero. */
export function hasBlur(layer) {
  const lengths = layer.replace(/\b(?:rgba?|hsla?|var|calc|color-mix)\([^)]*\)/g, ' ').match(/-?\d*\.?\d+(?:px|rem|em)?(?![\w%])/g) ?? []
  return lengths.length >= 3 && parseFloat(lengths[2]) > 0
}

/** Every tell's count in one file's text, by extension. */
export function countTells(text, file) {
  const css = file.endsWith('.css')
  const code = /\.(?:tsx?|jsx?)$/.test(file) && !/\.test\.[jt]sx?$/.test(file)
  const counts = {}
  for (const [id, tell] of Object.entries(TELLS)) {
    counts[id] = (css && tell.css) || (code && tell.code) ? tell.find(text).length : 0
  }
  return counts
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(?:css|tsx?|jsx?)$/.test(name)) out.push(path)
  }
  return out
}

/** The tells over the baseline and the ones under it (the baseline is stale: lower it). */
export function compareToBaseline(totals, baseline) {
  const ids = Object.keys(totals)
  return { over: ids.filter((id) => totals[id] > (baseline[id] ?? 0)), under: ids.filter((id) => totals[id] < (baseline[id] ?? 0)) }
}

function main() {
  const totals = Object.fromEntries(Object.keys(TELLS).map((id) => [id, 0]))
  const where = Object.fromEntries(Object.keys(TELLS).map((id) => [id, []]))
  for (const path of walk(join(ROOT, 'src'))) {
    const counts = countTells(readFileSync(path, 'utf8'), path)
    for (const [id, n] of Object.entries(counts)) {
      totals[id] += n
      if (n) where[id].push(`${relative(ROOT, path)} (${n})`)
    }
  }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
  if (process.argv.includes('--update')) {
    const next = Object.fromEntries(Object.keys(TELLS).map((id) => [id, Math.min(totals[id], baseline[id] ?? totals[id])]))
    writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`)
    console.log('uiTells: baseline lowered to', next)
    return
  }
  const { over, under } = compareToBaseline(totals, baseline)
  if (over.length) {
    for (const id of over) {
      console.error(`uiTells: ${TELLS[id].what}: ${totals[id]}, baseline ${baseline[id] ?? 0}. In: ${where[id].join(', ')}`)
    }
    console.error('uiTells: these are banned by docs/art/PERSONALITY.md ("Never"). Use the fair-* pieces instead.')
    process.exit(1)
  }
  if (under.length) {
    console.error(`uiTells: fewer tells than the baseline (${under.map((id) => `${id} ${totals[id]} < ${baseline[id]}`).join(', ')}): run node scripts/uiTells.mjs --update and commit scripts/uiTells.baseline.json`)
    process.exit(1)
  }
  console.log('uiTells: ok')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
