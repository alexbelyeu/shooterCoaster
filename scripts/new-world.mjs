// npm run new-world -- <levelId> --name "<Name>" --biome <biome> [--interior] [--score-from <levelId>] [--dry-run] (#460):
// scaffolds a world's biome files and every registration a level needs, then prints what is left by hand.
// The plan is pure in newWorldPlan.mjs; this reads the repo, writes it and regenerates the server's score limits.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EDITED_FILES, NewWorldError, TEMPLATE_FILES, formatPlan, parseNewWorldArgs, planNewWorld, templateDir } from './newWorldPlan.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : undefined)

try {
  const opts = parseNewWorldArgs(process.argv.slice(2))
  const files = {}
  for (const rel of [...Object.values(EDITED_FILES), `src/audio/scores/${opts.id}.scrim`, `src/audio/scores/${opts.scoreFrom}.scrim`]) {
    const t = read(rel)
    if (t !== undefined) files[rel] = t
  }
  const templates = Object.fromEntries(TEMPLATE_FILES.map((f) => [f, read(`${templateDir(opts.kind)}/${f}.tmpl`)]))
  const biomeDirs = fs.readdirSync(path.join(root, 'src/levels/environments/biomes'))
  const plan = planNewWorld(opts, { files, templates, biomeDirs })
  if (!opts.dryRun) {
    for (const f of plan.creates) {
      fs.mkdirSync(path.dirname(path.join(root, f.path)), { recursive: true })
      fs.writeFileSync(path.join(root, f.path), f.content, { flag: 'wx' })
    }
    for (const f of plan.edits) fs.writeFileSync(path.join(root, f.path), f.content)
    for (const c of plan.commands) {
      const [cmd, ...args] = c.split(' ')
      execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })
    }
  }
  console.log(formatPlan(plan, { dryRun: opts.dryRun }))
} catch (e) {
  if (!(e instanceof NewWorldError)) throw e
  console.error(`new-world: ${e.message}`)
  process.exit(1)
}
