#!/usr/bin/env node
/**
 * Lighthouse gate on dist/ (#193), one run per form factor: `npm run build && npm run lighthouse`.
 * Thresholds in lighthouseGate.mjs; Performance is printed only, since software GL makes it unfair.
 * Options: --url http://localhost:4173 (skip vite preview), --form mobile|desktop
 */
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import fs from 'node:fs'
import path from 'node:path'
import { launchBrowser, startPreview, stopPreview } from './headless.mjs'
import { gateProblems, THRESHOLDS } from './lighthouseGate.mjs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const FORMS = arg('form') ? [arg('form')] : ['mobile', 'desktop']
const OUT = path.resolve('e2e-results/lighthouse.json')
const CATEGORIES = ['seo', 'accessibility', 'best-practices', 'performance']

function summarise(lhr) {
  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]))
  const failing = []
  for (const c of CATEGORIES) {
    if (c === 'performance') continue
    for (const ref of lhr.categories[c].auditRefs) {
      const audit = lhr.audits[ref.id]
      if (ref.weight > 0 && audit.score !== null && audit.score < 1) failing.push(`${c}/${ref.id}: ${audit.title}`)
    }
  }
  return { scores, failing, lighthouse: lhr.lighthouseVersion, finalUrl: lhr.finalDisplayedUrl }
}

let preview, browser
const results = {}
try {
  const given = arg('url')
  if (!given) preview = await startPreview()
  const url = `${given ?? preview.url}/`
  const port = 9300 + Math.floor(Math.random() * 600)
  browser = await launchBrowser([`--remote-debugging-port=${port}`])
  for (const form of FORMS) {
    const started = Date.now()
    const runner = await lighthouse(
      url,
      { port, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES },
      form === 'desktop' ? desktopConfig : undefined,
    )
    if (!runner) throw new Error(`lighthouse returned no result for ${form}`)
    if (runner.lhr.runtimeError) throw new Error(`lighthouse ${form}: ${runner.lhr.runtimeError.message}`)
    results[form] = { ...summarise(runner.lhr), seconds: Math.round((Date.now() - started) / 1000) }
    const { scores, seconds } = results[form]
    console.log(
      `lighthouse ${form}: seo=${scores.seo} accessibility=${scores.accessibility} ` +
        `best-practices=${scores['best-practices']} performance=${scores.performance} (report only) in ${seconds}s`,
    )
    for (const f of results[form].failing) console.log(`  - ${f}`)
  }
} finally {
  await browser?.close()
  if (preview) stopPreview(preview.proc)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ thresholds: THRESHOLDS, results }, null, 2))
const problems = gateProblems(results)
for (const p of problems) console.error(`FAIL: ${p}`)
if (problems.length) process.exit(1)
console.log(`lighthouse: PASS (${FORMS.join(' + ')})`)
