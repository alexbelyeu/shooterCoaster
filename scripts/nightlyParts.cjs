// The nightly full smoke runs as parallel parts (prod-smoke.yml `nightly-part` matrix, e2e/shards.mjs NIGHTLY_PARTS,
// #570). Each part's artifact holds its `results.json` (the smoke writes it when it ends) and `exit-code` (the
// `timeout`-wrapped smoke's). This folds them into the one verdict `prod-alert.cjs` reports: an exit code and one
// results array, with a stand-in failed check for a part that timed out or left nothing.
//
//   node scripts/nightlyParts.cjs <parts dir> <out dir> <part,part,...>
//     reads <parts dir>/prod-e2e-results-<part>/, writes <out dir>/results.json, prints `exit_code=<n>`.

const fs = require('node:fs')
const path = require('node:path')

const { INCONCLUSIVE } = require('./prod-alert.cjs')

const TIMED_OUT = [124, 137]

/**
 * parts: [{ name, exitCode (number, or null when the part left no exit code), results (array or null) }].
 * Exit code: 124 if any part hit the cap (prod-alert then says so and lists what failed), else 1 if any part is red,
 * else INCONCLUSIVE if a part failed only because production redeployed under it (#822), else 0.
 */
function combine(parts, capMinutes) {
  const results = []
  let timedOut = false
  let red = false
  let inconclusive = false
  for (const { name, exitCode, results: own } of parts) {
    if (Array.isArray(own)) results.push(...own)
    if (exitCode === 0) continue
    if (exitCode === INCONCLUSIVE) {
      inconclusive = true
      continue
    }
    if (TIMED_OUT.includes(exitCode)) {
      timedOut = true
      results.push({ id: `part ${name}`, ok: false, problems: [`stopped at the ${capMinutes} min cap${own ? '' : ' before it reported any result'}`] })
    } else {
      red = true
      if (exitCode === null) results.push({ id: `part ${name}`, ok: false, problems: ['left no result: the job failed before the smoke ended'] })
      else if (!Array.isArray(own) || own.every((c) => c.ok)) results.push({ id: `part ${name}`, ok: false, problems: [`exited with code ${exitCode} before any check failed`] })
    }
  }
  return { exitCode: timedOut ? 124 : red ? 1 : inconclusive ? INCONCLUSIVE : 0, results }
}

function readPart(dir, name) {
  const partDir = path.join(dir, `prod-e2e-results-${name}`)
  const read = (file) => {
    try {
      return fs.readFileSync(path.join(partDir, file), 'utf8')
    } catch {
      return null
    }
  }
  const code = read('exit-code')
  let results = null
  try {
    results = JSON.parse(read('results.json'))
  } catch {
    results = null
  }
  return { name, exitCode: code === null || code.trim() === '' ? null : Number(code.trim()), results }
}

if (require.main === module) {
  const [dir, out, names] = process.argv.slice(2)
  if (!dir || !out || !names) {
    console.error('usage: node scripts/nightlyParts.cjs <parts dir> <out dir> <part,part,...>')
    process.exit(2)
  }
  const { exitCode, results } = combine(names.split(',').map((n) => readPart(dir, n)), Number(process.env.CAP_MINUTES || 60))
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2))
  console.log(`exit_code=${exitCode}`)
}

module.exports = { combine, readPart }
