#!/usr/bin/env node
// The Maintainer's decisions-inbox fold check (#528): every inbox entry a branch deletes must be in DECISIONS.md.
// Twice (#499, #528) a fold deleted the inbox files without appending their entries, and CI's docs-only plan
// can't see it. Run before pushing a fold: `node scripts/decisionsFold.cjs [base]` (default origin/main).

const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')

const INBOX = 'docs/agents/decisions/inbox/'
const DECISIONS = 'docs/agents/DECISIONS.md'

/** The `## ` headings of the deleted inbox entries that DECISIONS.md lacks (pure). */
function missingFoldedHeadings(deletedEntries, decisionsMd) {
  const present = new Set(decisionsMd.split('\n').map((l) => l.trim()))
  return deletedEntries
    .flatMap((body) => body.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.trim()))
    .filter((h) => !present.has(h))
}

function main(base = 'origin/main') {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
  const deleted = git('diff', '--name-only', '--diff-filter=D', `${base}...HEAD`, '--', INBOX)
    .split('\n')
    .filter((f) => f.endsWith('.md') && !f.endsWith('README.md'))
  const missing = missingFoldedHeadings(deleted.map((f) => git('show', `${base}:${f}`)), readFileSync(DECISIONS, 'utf8'))
  for (const h of missing) console.error(`missing from ${DECISIONS}: ${h}`)
  console.log(missing.length ? `fold check: ${missing.length} entr${missing.length === 1 ? 'y' : 'ies'} lost` : `fold check: ${deleted.length} deleted inbox entr${deleted.length === 1 ? 'y' : 'ies'} all in ${DECISIONS}`)
  process.exit(missing.length ? 1 : 0)
}

if (require.main === module) main(process.argv[2])

module.exports = { missingFoldedHeadings }
