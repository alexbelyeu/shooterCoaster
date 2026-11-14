import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  EDITED_FILES,
  NewWorldError,
  PLACEHOLDER,
  STARTER_ROSTER,
  TEMPLATE_FILES,
  isPlaceholder,
  pacingCeilings,
  parseNewWorldArgs,
  planNewWorld,
  sceneCeilings,
  setBudget,
  templateDir,
} from './newWorldPlan.mjs'
import { SCORE_VALUES } from '@/levels/scoring'
import { getAllLevels } from '@/levels/LevelRegistry'

const root = path.resolve(__dirname, '..')
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')

function repo(kind: 'outdoor' | 'interior', scoreFrom = 'level1') {
  const files: Record<string, string> = {}
  for (const rel of [...Object.values(EDITED_FILES), `src/audio/scores/${scoreFrom}.scrim`]) files[rel] = read(rel)
  const templates = Object.fromEntries(TEMPLATE_FILES.map((f) => [f, read(`${templateDir(kind)}/${f}.tmpl`)]))
  return { files, templates, biomeDirs: fs.readdirSync(path.join(root, 'src/levels/environments/biomes')) }
}

const levels = getAllLevels()
const last = levels[levels.length - 1]
const id = `level${levels.length + 1}`
const args = [id, '--name', 'Test World', '--biome', 'testWorld']

describe('npm run new-world (#460)', () => {
  const plan = planNewWorld(parseNewWorldArgs(args), repo('outdoor'))
  const edit = (p: string) => plan.edits.find((e: { path: string }) => e.path === p)!.content as string

  it('creates the biome folder from the template and a score slot', () => {
    expect(plan.creates.map((c: { path: string }) => c.path)).toEqual([
      'src/levels/environments/biomes/testWorld/config.ts',
      'src/levels/environments/biomes/testWorld/Decorations.tsx',
      'src/levels/environments/biomes/testWorld/Features.tsx',
      'src/levels/environments/biomes/testWorld/index.ts',
      `src/audio/scores/${id}.scrim`,
    ])
    for (const c of plan.creates) expect(c.content).not.toMatch(/__[A-Za-z]+__/)
    expect(plan.creates[3].content).toContain('export const testWorld: BiomeDefinition')
    expect(plan.creates[1].content).toContain('export default function TestWorldDecorations')
  })

  it('edits every registration, and only those', () => {
    expect(plan.edits.map((e: { path: string }) => e.path).sort()).toEqual(Object.values(EDITED_FILES).filter((p) => p !== EDITED_FILES.scoring).sort())
    expect(plan.commands).toEqual(['node scripts/gen-level-limits.mjs'])
  })

  it('chains the level after the last one, with a maxScore that is the roster’s', () => {
    const registry = edit(EDITED_FILES.registry)
    expect(registry).toContain(`nextLevel: '${id}'`)
    expect(registry.match(/nextLevel: null/g)).toHaveLength(1)
    expect(registry).toContain(`order: ${last.order + 1}`)
    const total = [...STARTER_ROSTER.waves, STARTER_ROSTER.finale].reduce(
      (s, w) => s + w.count * SCORE_VALUES[w.type as keyof typeof SCORE_VALUES],
      0,
    )
    expect(registry).toContain(`// ${total}:`)
    expect(edit(EDITED_FILES.registryTest)).toContain(`['${id}', '${STARTER_ROSTER.finale.type}', ${total}],`)
  })

  it('keys the biome in every biome table', () => {
    expect(edit(EDITED_FILES.biomeType)).toMatch(/export type BiomeType = .*\| 'testWorld'\n/)
    expect(edit(EDITED_FILES.biomeRegistry)).toContain("import { testWorld } from './biomes/testWorld'")
    expect(edit(EDITED_FILES.biomeRegistry)).toMatch(/\n {2}testWorld,\n\}/)
    for (const f of [EDITED_FILES.atmosphere, EDITED_FILES.terrain, EDITED_FILES.theme, EDITED_FILES.postcard, EDITED_FILES.sfx]) {
      expect(edit(f)).toMatch(/\n {2}testWorld: /)
    }
  })

  it('gives the level a score slot in the template score’s key', () => {
    expect(edit(EDITED_FILES.scores)).toContain(`import ${id} from './${id}.scrim?raw'`)
    expect(edit(EDITED_FILES.scores)).toMatch(new RegExp(`export const SCORES[^\\n]* ${id}, results,`))
    expect(edit(EDITED_FILES.sfx)).toContain(`  ${id}: { tonic: 65, minor: false }, // level1's score`)
  })

  it('adds the gates: a shard, its CI job, the smoke budget and placeholder ceilings', () => {
    const budgets = JSON.parse(edit(EDITED_FILES.budgets))
    expect(budgets.smokeSeconds[id]).toBe(budgets.smokeSeconds[last.id])
    expect(Object.keys(budgets.smokeSeconds).indexOf(id)).toBe(Object.keys(budgets.smokeSeconds).indexOf(last.id) + 1)
    expect(budgets.scene[id]).toEqual(PLACEHOLDER)
    expect(budgets.pacing[id]).toEqual(PLACEHOLDER)
    expect(edit(EDITED_FILES.shards)).toContain(`\n  ${id}: { levels: ['${id}'], steps: ['ride'] },`)
    expect(edit(EDITED_FILES.ci)).toMatch(new RegExp(`shard: \\[[^\\]]*\\b${last.id}, ${id}, `))
  })

  it('names the world in #about and counts it', () => {
    const html = edit(EDITED_FILES.indexHtml)
    const count = (h: string) => h.match(/<h2>(\w+) worlds<\/h2>/)![1]
    expect(html).toContain('<li>Test World: balloons and crows.</li>\n      </ul>')
    expect(count(read(EDITED_FILES.indexHtml))).toBe(['Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][levels.length - 5])
    expect(count(html)).toBe(['Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven'][levels.length - 5])
    expect(html).not.toMatch(new RegExp(`\\b${count(read(EDITED_FILES.indexHtml))} (themed\\s+)?worlds`, 'i'))
  })

  it('an interior world gets the hall template, a floor and bounds', () => {
    const interior = planNewWorld(parseNewWorldArgs([...args, '--interior']), repo('interior'))
    const index = interior.creates.find((c: { path: string }) => c.path.endsWith('/index.ts'))!.content
    expect(index).toContain('floor: hallFloor')
    expect(index).toContain('bounds: HALL_BOUNDS')
    expect(interior.edits.find((e: { path: string }) => e.path === EDITED_FILES.terrain)!.content).toContain('flatRadius: 100_000')
  })

  it('refuses an existing level, biome or score, so a second run changes nothing', () => {
    const r = repo('outdoor')
    expect(() => planNewWorld(parseNewWorldArgs([last.id, '--name', 'X', '--biome', 'testWorld']), r)).toThrow(/already exists/)
    expect(() => planNewWorld(parseNewWorldArgs([id, '--name', 'X', '--biome', 'gym']), r)).toThrow(/already exists/)
    const scored = { ...r, files: { ...r.files, [`src/audio/scores/${id}.scrim`]: '' } }
    expect(() => planNewWorld(parseNewWorldArgs(args), scored)).toThrow(/already exists/)
  })

  it('parses its flags and rejects bad ones', () => {
    expect(parseNewWorldArgs([...args, '--dry-run', '--score-from', 'level3'])).toMatchObject({
      id,
      name: 'Test World',
      biome: 'testWorld',
      kind: 'outdoor',
      scoreFrom: 'level3',
      dryRun: true,
    })
    expect(() => parseNewWorldArgs([id, '--name', 'X'])).toThrow(NewWorldError)
    expect(() => parseNewWorldArgs([id, '--name', 'X', '--biome', 'sky-harbour'])).toThrow(/camelCase/)
    expect(() => parseNewWorldArgs([...args, '--fast'])).toThrow(/unknown flag/)
  })
})

describe('placeholder budgets', () => {
  it('first ceilings follow the budgets’ headroom rules', () => {
    expect(sceneCeilings({ drawCalls: 50, objects: 100, triangles: 1000, trackObjects: 10, trackTriangles: 200 })).toEqual({
      drawCalls: 60,
      objects: 115,
      triangles: 1150,
      trackObjects: 12,
      trackTriangles: 230,
    })
    expect(pacingCeilings({ longestGapSeconds: 2.4, noTargetShare: 0.061 })).toEqual({ longestGapSeconds: 4, noTargetShare: 0.1 })
    expect(pacingCeilings({ longestGapSeconds: 3, noTargetShare: 0.03 })).toEqual({ longestGapSeconds: 4, noTargetShare: 0.05 })
  })

  it('a filled budget replaces the placeholder', () => {
    const text = JSON.stringify({ scene: { level9: PLACEHOLDER } }, null, 2) + '\n'
    expect(isPlaceholder(JSON.parse(text).scene.level9)).toBe(true)
    const filled = JSON.parse(setBudget(text, 'scene', 'level9', { drawCalls: 60 }))
    expect(filled.scene.level9).toEqual({ drawCalls: 60 })
    expect(isPlaceholder(filled.scene.level9)).toBe(false)
  })
})
