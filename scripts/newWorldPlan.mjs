/**
 * `npm run new-world` (#460), pure: from the repo's current file texts and the biome templates, the files a new
 * world creates, the edits that register it, and the checklist left by hand (docs/LEVEL-KIT.md). `new-world.mjs`
 * reads and writes the files. Also the placeholder budgets the scaffold writes, which the smoke fills on a level's
 * first local run (`e2e/smoke.mjs`).
 */

export const USAGE =
  'npm run new-world -- <levelId> --name "<Name>" --biome <biome> [--interior] [--score-from <levelId>] [--dry-run]'

export const TEMPLATE_FILES = ['config.ts', 'Decorations.tsx', 'Features.tsx', 'index.ts']

/** Every file the scaffold edits, read by the CLI and handed to `planNewWorld` as `files`. */
export const EDITED_FILES = {
  registry: 'src/levels/LevelRegistry.ts',
  registryTest: 'src/levels/LevelRegistry.test.ts',
  scoring: 'src/levels/scoring.ts',
  biomeType: 'src/types/level.ts',
  biomeRegistry: 'src/levels/environments/biomeRegistry.ts',
  atmosphere: 'src/levels/environments/atmosphere.ts',
  terrain: 'src/utils/terrainNoise.ts',
  theme: 'src/ui/theme.ts',
  postcard: 'src/ui/screens/LevelPostcard.tsx',
  sfx: 'src/audio/sfxDesign.ts',
  scores: 'src/audio/scores/index.ts',
  budgets: 'budgets.json',
  shards: 'e2e/shards.mjs',
  ci: '.github/workflows/ci.yml',
  indexHtml: 'index.html',
}

/** What `budgets.json` holds for a level's `scene` and `pacing` until its first local smoke measures them. */
export const PLACEHOLDER = { placeholder: 'npm run new-world: set by this level\'s first local smoke (scene: the ride; pacing: --steps pacing)' }

export class NewWorldError extends Error {}

const ID = /^[a-z][a-zA-Z0-9]*$/

export function parseNewWorldArgs(argv) {
  const opts = { id: null, name: null, biome: null, kind: 'outdoor', scoreFrom: 'level1', dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new NewWorldError(`${a} needs a value\n${USAGE}`)
      return v
    }
    if (a === '--name') opts.name = value()
    else if (a === '--biome') opts.biome = value()
    else if (a === '--score-from') opts.scoreFrom = value()
    else if (a === '--interior') opts.kind = 'interior'
    else if (a === '--dry-run') opts.dryRun = true
    else if (a.startsWith('--')) throw new NewWorldError(`unknown flag ${a}\n${USAGE}`)
    else if (opts.id === null) opts.id = a
    else throw new NewWorldError(`unexpected argument ${a}\n${USAGE}`)
  }
  if (!opts.id || !opts.name || !opts.biome) throw new NewWorldError(USAGE)
  for (const [flag, v] of [['level id', opts.id], ['--biome', opts.biome]]) {
    if (!ID.test(v)) throw new NewWorldError(`${flag} "${v}" must be camelCase letters and digits`)
  }
  if (!/^[\w -]+$/.test(opts.name)) throw new NewWorldError(`--name "${opts.name}": letters, digits, spaces and - only`)
  return opts
}

/** The template folder a world's biome files come from. */
export function templateDir(kind) {
  return `scripts/new-world/${kind}`
}

export function biomeDir(biome) {
  return `src/levels/environments/biomes/${biome}`
}

/** `skyHarbour` → `SkyHarbour` (component names). */
const pascal = (s) => s[0].toUpperCase() + s.slice(1)

/** A small stable hash (FNV-1a) for the seeds and accent hue a scaffold picks. */
function hash(s) {
  let h = 0x811c9dc5
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0
  return h
}

function hslHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function hslRgba(h, s, l, alpha) {
  const hex = hslHex(h, s, l)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** The roster every scaffolded level starts on: air enemies any world can host, paced by the template, ending on a finale wave. */
export const STARTER_ROSTER = {
  waves: [
    { type: 'balloon', count: 30, waveLabel: 'Here They Come!', weight: 2 },
    { type: 'crow', count: 14, waveLabel: 'Crows!', formation: 'v', weight: 2 },
    { type: 'balloon', count: 30, waveLabel: 'More Balloons!', weight: 2 },
    { type: 'crow', count: 14, waveLabel: 'The Flock!', formation: 'spiral', weight: 3 },
  ],
  finale: { type: 'crow', count: 16, waveLabel: 'Final Wave!' },
}

const PLURAL = { balloon: 'balloons', crow: 'crows' }

/** `SCORE_VALUES` from `scoring.ts`'s text. */
export function parseScoreValues(scoringText) {
  const block = scoringText.match(/export const SCORE_VALUES[^{]*\{([^}]*)\}/)
  if (!block) throw new NewWorldError('SCORE_VALUES not found in src/levels/scoring.ts')
  return Object.fromEntries([...block[1].matchAll(/(\w+):\s*(\d+)/g)].map(([, k, v]) => [k, Number(v)]))
}

function rosterMaxScore(roster, values) {
  const waves = [...roster.waves, roster.finale]
  for (const w of waves) if (!(w.type in values)) throw new NewWorldError(`no SCORE_VALUES entry for ${w.type}`)
  // Same waves merged by type, in roster order: `30 * 13 * 2` reads worse than `60 * 13`.
  const counts = new Map()
  for (const w of waves) counts.set(w.type, (counts.get(w.type) ?? 0) + w.count)
  const terms = [...counts].map(([type, n]) => ({ text: `${n} * ${values[type]}`, total: n * values[type] }))
  return { expr: terms.map((t) => t.text).join(' + '), total: terms.reduce((s, t) => s + t.total, 0) }
}

function waveLiteral(w) {
  const parts = [`type: '${w.type}'`, `count: ${w.count}`, `waveLabel: '${w.waveLabel}'`]
  if (w.formation) parts.push(`formation: '${w.formation}'`)
  if (w.weight) parts.push(`weight: ${w.weight}`)
  return `{ ${parts.join(', ')} }`
}

/** Insert `entry` before the `}` that closes the top-level object literal opened on the line matching `opener`. */
function insertInObject(text, opener, entry, file) {
  const start = text.search(opener)
  if (start < 0) throw new NewWorldError(`${file}: ${opener} not found`)
  const close = text.indexOf('\n}', start)
  if (close < 0) throw new NewWorldError(`${file}: no closing } after ${opener}`)
  return text.slice(0, close + 1) + entry + text.slice(close + 1)
}

function replaceOnce(text, pattern, replacement, file) {
  const matches = text.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))
  if (!matches || matches.length !== 1) throw new NewWorldError(`${file}: expected one match of ${pattern}, found ${matches?.length ?? 0}`)
  return text.replace(pattern, replacement)
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen']

/** "six worlds" → "seven worlds" (and "Six worlds", "six themed worlds") in the page copy. */
function bumpWorldCount(html, from) {
  const [a, b] = [NUMBER_WORDS[from], NUMBER_WORDS[from + 1]]
  if (!b) throw new NewWorldError(`index.html: no number word for ${from + 1} worlds`)
  return html.replace(new RegExp(`\\b(${a})(?=( themed)?\\s+worlds)`, 'gi'), (w) => (w[0] === w[0].toUpperCase() ? pascal(b) : b))
}

const ATMOSPHERE = {
  outdoor: `  // __NAME__ (scaffolded): a clear day, the look still to author (sky, sun, fog, grade)
  __BIOME__: {
    sky: {
      zenith: 0x2f6cc4,
      horizon: 0xbcd6ea,
      ground: 0x8fa8b8,
      horizonFalloff: 0.45,
      sunColor: 0xfff2d8,
      sunSize: 0.03,
      sunGlow: 0.5,
      cloudiness: 0.4,
      cloudColor: 0xffffff,
      cloudSpeed: 4,
      cloudStretch: 1,
    },
    sunDirection: [0.45, 0.6, -0.65],
    sunLightColor: 0xffe8c8,
    sunLightIntensity: 1.3,
    hemiSkyColor: 0xd6e8ff,
    hemiGroundColor: 0x55603a,
    hemiIntensity: 1.0,
    fogNear: 400,
    fogFar: 5200,
    envIntensity: 0.5,
    grade: {
      exposure: 1.0,
      temperature: 0.05,
      tint: 0,
      shadowTint: 0x4a78c8,
      highlightTint: 0xffd49a,
      splitTone: 0.15,
      contrast: 1.05,
      saturation: 1.05,
      vibrance: 0.2,
      vignette: 0.3,
    },
  },
`,
  interior: `  // __NAME__ (scaffolded interior): the dome only bakes the walls' reflections; the "sun" is the roof lights
  __BIOME__: {
    sky: {
      zenith: 0xdfe9f2,
      horizon: 0xc9d1d9,
      ground: 0x9aa2aa,
      horizonFalloff: 0.6,
      sunColor: 0xffffff,
      sunSize: 0,
      sunGlow: 0,
      cloudiness: 0,
      cloudColor: 0xffffff,
      cloudSpeed: 0,
      cloudStretch: 1,
    },
    sunDirection: [0.3, 1, 0.45],
    sunLightColor: 0xfff1dc,
    sunLightIntensity: 1.6,
    hemiSkyColor: 0xe4eefa,
    hemiGroundColor: 0x8a8f96,
    hemiIntensity: 1.35,
    fogNear: 900,
    fogFar: 6500,
    envIntensity: 0.45,
    grade: {
      exposure: 1.05,
      temperature: 0.03,
      tint: 0,
      shadowTint: 0x5a7aa8,
      highlightTint: 0xffe2b8,
      splitTone: 0.15,
      contrast: 1.08,
      saturation: 1.1,
      vibrance: 0.3,
      vignette: 0.25,
    },
  },
`,
}

const TERRAIN = {
  outdoor: `  __BIOME__: {
    frequency: 0.0008,
    amplitude: 450,
    octaves: 5,
    persistence: 0.45,
    lacunarity: 2.2,
    exponent: 1.4,
    ridgeMode: false,
    baseY: 0,
    flatRadius: 600,
    transitionWidth: 800,
  },
`,
  // Drawn only where the biome has no \`floor\`; an interior always has one.
  interior: `  // __NAME__ draws its biome's \`floor\`, never this: flat for 100 km.
  __BIOME__: {
    frequency: 0.001,
    amplitude: 1,
    octaves: 1,
    persistence: 0.5,
    lacunarity: 2,
    exponent: 1,
    ridgeMode: false,
    baseY: 0,
    flatRadius: 100_000,
    transitionWidth: 1,
  },
`,
}

const REVERB = {
  outdoor: '{ seconds: 1.6, decayPow: 3.2, toneHz: 7000, level: 0.8 }',
  interior: '{ seconds: 2.6, decayPow: 2.8, toneHz: 5000, level: 0.9 }',
}

const POSTCARD = `  // __NAME__ (scaffolded): a stand-in until the world's landmark is drawn here
  __BIOME__: (t) => (
    <>
      <circle cx="160" cy="26" r="8" fill={t.accent2} />
      <path d="M118 90 L128 30 L138 90Z" fill="#6f6660" />
      <path d="M0 80 Q50 70 100 78 T200 74 V100 H0Z" fill="#33402c" />
      <path d="M8 74 Q50 30 92 62 T192 50" stroke={t.accent} strokeWidth="3" fill="none" />
    </>
  ),
`

function fill(text, v) {
  return text
    .replaceAll('__BIOME__', v.biome)
    .replaceAll('__Biome__', pascal(v.biome))
    .replaceAll('__NAME__', v.name)
    .replaceAll('__ID__', v.id)
    .replaceAll('__SEED__', String(v.seed))
}

/**
 * The scaffold for `opts` (from `parseNewWorldArgs`). `files`: the text of every `EDITED_FILES` path plus the
 * `--score-from` score (`src/audio/scores/<id>.scrim`); `templates`: `TEMPLATE_FILES` → template text for `opts.kind`;
 * `biomeDirs`: the folders under `biomes/`. Throws `NewWorldError` on an id, biome or score that already exists.
 */
export function planNewWorld(opts, { files, templates, biomeDirs }) {
  const { id, name, biome, kind, scoreFrom } = opts
  const F = EDITED_FILES
  const text = (path) => {
    if (files[path] === undefined) throw new NewWorldError(`missing ${path}`)
    return files[path]
  }
  const registry = text(F.registry)
  if (new RegExp(`id: '${id}'`).test(registry)) throw new NewWorldError(`level "${id}" already exists in ${F.registry}`)
  if (new RegExp(`'${biome}'`).test(text(F.biomeType)) || biomeDirs.includes(biome)) {
    throw new NewWorldError(`biome "${biome}" already exists (${F.biomeType} / ${biomeDir(biome)}/)`)
  }
  const scorePath = `src/audio/scores/${id}.scrim`
  if (files[scorePath] !== undefined) throw new NewWorldError(`${scorePath} already exists`)
  const templateScore = text(`src/audio/scores/${scoreFrom}.scrim`)

  const v = { id, name, biome, seed: hash(biome) % 9973 }
  const orders = [...registry.matchAll(/order: (\d+)/g)].map((m) => Number(m[1]))
  const order = Math.max(...orders) + 1
  const last = registry.match(/id: '(\w+)',(?:(?!\n {2}\{)[\s\S])*?nextLevel: null,/)
  if (!last) throw new NewWorldError(`${F.registry}: no level with nextLevel: null to chain from`)
  const previous = last[1]
  const roster = STARTER_ROSTER
  const score = rosterMaxScore(roster, parseScoreValues(text(F.scoring)))

  const level = `  {
    id: '${id}',
    name: '${name}',
    description: 'Ride through ${name}',
    order: ${order},
    biome: '${biome}',
    maxScore: ${score.expr}, // ${score.total}: no boss, a finale wave ends the run
    message: 'You cleared ${name}!',
    nextLevel: null,
    // Scaffolded by npm run new-world: level1's curve family; tune it inside the track extent formula (level-design skill).
    track: {
      varA: 3,
      varB: 17,
      varC: 4,
      scalar: 20,
      rollerSpeed: 0.00001,
      minRollerSpeed: 0.00008,
      curve: 'curve1',
      color1: 0xffffff,
      color2: ${kind === 'interior' ? '0xff3355' : '0x44aaff'},
    },
    ...paceLevel({
      waves: [
${roster.waves.map((w) => `        ${waveLiteral(w)},`).join('\n')}
      ],
      finale: ${waveLiteral(roster.finale)},
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: ${kind === 'interior' ? '{}' : '{ hasTrees: true, treeCount: 60 }'},
  },
`
  let registryOut = registry.replace(last[0], last[0].replace('nextLevel: null,', `nextLevel: '${id}',`))
  registryOut = replaceOnce(registryOut, /\n\]\n/, `\n${level}]\n`, F.registry)

  const registryTest = text(F.registryTest)
  const finales = registryTest.indexOf('expect(finales).toEqual([')
  const finalesEnd = registryTest.indexOf('\n    ])', finales)
  if (finales < 0 || finalesEnd < 0) throw new NewWorldError(`${F.registryTest}: the finales table not found`)
  const registryTestOut =
    registryTest.slice(0, finalesEnd) + `\n      ['${id}', '${roster.finale.type}', ${score.total}],` + registryTest.slice(finalesEnd)

  const biomeType = replaceOnce(text(F.biomeType), /(export type BiomeType = [^\n]*)/, `$1 | '${biome}'`, F.biomeType)

  let biomeRegistry = text(F.biomeRegistry)
  const imports = [...biomeRegistry.matchAll(/^import \{ \w+ \} from '\.\/biomes\/\w+'$/gm)]
  if (!imports.length) throw new NewWorldError(`${F.biomeRegistry}: no biome imports`)
  const afterImports = imports.at(-1).index + imports.at(-1)[0].length
  biomeRegistry = biomeRegistry.slice(0, afterImports) + `\nimport { ${biome} } from './biomes/${biome}'` + biomeRegistry.slice(afterImports)
  biomeRegistry = insertInObject(biomeRegistry, /export const BIOMES\b/, `  ${biome},\n`, F.biomeRegistry)

  const hue = hash(biome) % 360
  const themeEntry = `  ${biome}: theme({
    accent: '${hslHex(hue, 0.8, 0.6)}', // scaffolded: pick the world's accent
    glow: '${hslRgba(hue, 0.8, 0.6, 0.55)}',
    accent2: '${hslHex((hue + 150) % 360, 0.85, 0.6)}',
    sky: [['${hslHex(hue, 0.5, 0.2)}', 0], ['${hslHex(hue, 0.45, 0.45)}', 0.6], ['${hslHex(hue, 0.6, 0.85)}', 1]],
  }),
`

  let sfx = insertInObject(text(F.sfx), /export const BIOME_REVERB\b/, `  ${biome}: ${REVERB[kind]},\n`, F.sfx)
  const keysAt = sfx.indexOf('export const SCORE_KEYS')
  const keysEnd = sfx.indexOf('\n}', keysAt)
  if (keysAt < 0 || keysEnd < 0) throw new NewWorldError(`${F.sfx}: SCORE_KEYS not found`)
  let keys = sfx.slice(keysAt, keysEnd)
  const key = keys.match(new RegExp(`^  ${scoreFrom}: ([^\\n]+?),(?: *//[^\\n]*)?$`, 'm'))
  if (!key) throw new NewWorldError(`${F.sfx}: no SCORE_KEYS entry for ${scoreFrom}`)
  keys = replaceOnce(keys, /^( {2}results: [^\n]*\n)/m, `  ${id}: ${key[1]}, // ${scoreFrom}'s score, copied until ${name}'s theme round\n$1`, F.sfx)
  sfx = sfx.slice(0, keysAt) + keys + sfx.slice(keysEnd)

  let scores = text(F.scores)
  const scoreImports = [...scores.matchAll(/^import \w+ from '\.\/\w+\.scrim\?raw'$/gm)]
  const lastLevelImport = scoreImports.filter((m) => !/^import (title|results) /.test(m[0])).at(-1)
  if (!lastLevelImport) throw new NewWorldError(`${F.scores}: no level score imports`)
  const at = lastLevelImport.index + lastLevelImport[0].length
  scores = scores.slice(0, at) + `\nimport ${id} from './${id}.scrim?raw'` + scores.slice(at)
  scores = replaceOnce(scores, /(export const SCORES[^\n]*?)( results,)/, `$1 ${id},$2`, F.scores)

  const scrim = templateScore
    .replace(/^title\s+.*$/m, `title    ${name} (placeholder)`)
    .replace(/^about\s+.*$/m, `about    ${name}'s score slot: a copy of ${scoreFrom}'s until its theme round (docs/audio/SOUND-BIBLE.md).`)

  const budgets = JSON.parse(text(F.budgets))
  const shardSeconds = budgets.smokeSeconds[previous]
  if (shardSeconds === undefined) throw new NewWorldError(`budgets.json: no smokeSeconds.${previous} to start ${id} from`)
  budgets.smokeSeconds = insertKeyAfter(budgets.smokeSeconds, previous, id, shardSeconds)
  budgets.scene[id] = { ...PLACEHOLDER }
  budgets.pacing[id] = { ...PLACEHOLDER }

  const shards = replaceOnce(
    text(F.shards),
    new RegExp(`(\\n {2}${previous}: \\{[^\\n]*\\},)`),
    `$1\n  ${id}: { levels: ['${id}'], steps: ['ride'] },`,
    F.shards,
  )
  const ci = replaceOnce(text(F.ci), new RegExp(`(shard: \\[[^\\]]*\\b${previous}), `), `$1, ${id}, `, F.ci)

  const worlds = orders.length
  const enemies = [...new Set([...roster.waves, roster.finale].map((w) => PLURAL[w.type] ?? w.type))]
  let html = text(F.indexHtml)
  const listEnd = html.indexOf('</ul>', html.search(/<h2>\w+ worlds<\/h2>/))
  if (listEnd < 0 || html.search(/<h2>\w+ worlds<\/h2>/) < 0) throw new NewWorldError(`${F.indexHtml}: the #about worlds list not found`)
  html = html.slice(0, listEnd) + `  <li>${name}: ${enemies.join(' and ')}.</li>\n      ` + html.slice(listEnd)
  html = bumpWorldCount(html, worlds)

  const dir = biomeDir(biome)
  const creates = [
    ...TEMPLATE_FILES.map((f) => {
      if (templates[f] === undefined) throw new NewWorldError(`missing template ${templateDir(kind)}/${f}.tmpl`)
      return { path: `${dir}/${f}`, content: fill(templates[f], v) }
    }),
    { path: scorePath, content: scrim },
  ]
  const edits = [
    { path: F.registry, content: registryOut, what: `${id} (order ${order}, after ${previous}): the starter roster, maxScore ${score.total}` },
    { path: F.registryTest, content: registryTestOut, what: `the finales table: ${id} ends on ${roster.finale.type}, ${score.total}` },
    { path: F.biomeType, content: biomeType, what: `BiomeType + '${biome}'` },
    { path: F.biomeRegistry, content: biomeRegistry, what: `BIOMES.${biome}` },
    { path: F.atmosphere, content: insertInObject(text(F.atmosphere), /export const ATMOSPHERES\b/, fill(ATMOSPHERE[kind], v), F.atmosphere), what: `ATMOSPHERES.${biome} (${kind} preset)` },
    { path: F.terrain, content: insertInObject(text(F.terrain), /export const BIOME_TERRAIN_CONFIGS\b/, fill(TERRAIN[kind], v), F.terrain), what: `BIOME_TERRAIN_CONFIGS.${biome}` },
    { path: F.theme, content: insertInObject(text(F.theme), /export const BIOME_UI\b/, themeEntry, F.theme), what: `BIOME_UI.${biome} accent + postcard sky` },
    { path: F.postcard, content: insertInObject(text(F.postcard), /const SCENES\b/, fill(POSTCARD, v), F.postcard), what: `the level-select postcard stub` },
    { path: F.sfx, content: sfx, what: `BIOME_REVERB.${biome}, SCORE_KEYS.${id} (${scoreFrom}'s key)` },
    { path: F.scores, content: scores, what: `SCORES.${id}` },
    { path: F.budgets, content: JSON.stringify(budgets, null, 2) + '\n', what: `smokeSeconds.${id} = ${shardSeconds} (${previous}'s), scene.${id} + pacing.${id} placeholders` },
    { path: F.shards, content: shards, what: `the ${id} shard (ride)` },
    { path: F.ci, content: ci, what: `the smoke matrix + ${id}` },
    { path: F.indexHtml, content: html, what: `#about: ${name}, ${NUMBER_WORDS[worlds + 1]} worlds` },
  ]
  return {
    creates,
    edits,
    commands: ['node scripts/gen-level-limits.mjs'],
    checklist: checklist(opts, previous),
  }
}

/** A copy of `obj` with `key: value` right after `after` (budgets.json keeps a level's shard next to its neighbours'). */
function insertKeyAfter(obj, after, key, value) {
  const out = {}
  for (const [k, val] of Object.entries(obj)) {
    out[k] = val
    if (k === after) out[key] = value
  }
  return out
}

function checklist({ id, biome, kind }, previous) {
  const dir = biomeDir(biome)
  return [
    'Read .claude/skills/shooter-coaster-level-design and docs/art/ENEMIES.md.',
    `Track: tune ${id}'s curve in LevelRegistry.ts inside the extent formula (or author a spline, like the gym's)${kind === 'interior' ? `, and size HALL in ${dir}/config.ts around it` : ''}.`,
    `Look: ${dir}/config.ts palette, ATMOSPHERES.${biome} (atmosphere.ts), the hero landmark in Features.tsx, props in Decorations.tsx (seeded, off the track), contact shadows.`,
    `Level select: draw the landmark in LevelPostcard.tsx SCENES.${biome}, pick the BIOME_UI.${biome} accent (theme.ts).`,
    `Roster: swap the starter waves for the world's own enemies; a boss goes in LevelConfig.boss. maxScore and the finales row in LevelRegistry.test.ts follow, then node scripts/gen-level-limits.mjs.`,
    'New enemies: SharedEnemyAssets.ts, enemyComponents.ts, ENEMY_PLACEMENT, SCORE_VALUES, deathStyles.ts, sfxDesign.ts, the turntable subjects.ts, a brief in docs/art/ENEMIES.md.',
    `Music: src/audio/scores/${id}.scrim is a copy; a theme round for Alex (Listen: issue) replaces it, with its SCORE_KEYS row.`,
    `#about: rewrite ${id}'s line in index.html once the world has its enemies and landmark.`,
    `docs/agents/STATE.md: a row for ${id}.`,
    `Prove it: node e2e/smoke.mjs --shard ${id} (sets scene.${id} in budgets.json on its first local run), then --steps pacing --levels ${id} (sets pacing.${id}); look at the ride, enemy and combat shots. ${previous} now unlocks ${id}.`,
  ]
}

export function formatPlan(plan, { dryRun }) {
  const lines = [dryRun ? 'npm run new-world --dry-run: nothing written' : 'npm run new-world: written', '', 'Creates:']
  for (const c of plan.creates) lines.push(`  + ${c.path}`)
  lines.push('', 'Edits:')
  for (const e of plan.edits) lines.push(`  ~ ${e.path}: ${e.what}`)
  lines.push('', 'Runs:')
  for (const c of plan.commands) lines.push(`  $ ${c}`)
  lines.push('', 'Left by hand (docs/LEVEL-KIT.md):')
  plan.checklist.forEach((c, i) => lines.push(`  ${i + 1}. ${c}`))
  return lines.join('\n')
}

export function isPlaceholder(budget) {
  return typeof budget?.placeholder === 'string'
}

const roundUp = (n, step) => Math.ceil(n / step) * step

/** First `scene` ceilings from a ride's measured totals: draw calls +20%, objects and triangles +15% (budgets.json `scene._comment`). */
export function sceneCeilings(measured) {
  const up = (n, f) => Math.ceil(n * f)
  return {
    drawCalls: up(measured.drawCalls, 1.2),
    objects: up(measured.objects, 1.15),
    triangles: up(measured.triangles, 1.15),
    trackObjects: up(measured.trackObjects, 1.15),
    trackTriangles: up(measured.trackTriangles, 1.15),
  }
}

/** First `pacing` ceilings from one run: the longest gap +1 s, the share +2 points rounded up to 5% (budgets.json `pacing._comment`). */
export function pacingCeilings(m) {
  return {
    longestGapSeconds: Math.ceil(m.longestGapSeconds + 1),
    noTargetShare: Math.round(roundUp((m.noTargetShare + 0.02) * 100, 5)) / 100,
  }
}

/** `budgets.json` text with `section.id` set to `values`. */
export function setBudget(budgetsText, section, id, values) {
  const budgets = JSON.parse(budgetsText)
  budgets[section][id] = values
  return JSON.stringify(budgets, null, 2) + '\n'
}
