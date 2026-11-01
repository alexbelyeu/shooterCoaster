#!/usr/bin/env node
/** `npm run build:portal` after `vite build --mode portal`: check dist-portal/ against rules.mjs and zip it. */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { portalProblems } from './rules.mjs'

const DIR = path.resolve('dist-portal')
const ZIP = path.resolve('dist-portal.zip')
// SEO files, the share card, the web app manifest and its icons, and the 404 page for scoaster.com; a portal page has its own.
const SITE_ONLY = ['robots.txt', 'sitemap.xml', 'social', 'site.webmanifest', 'icons', '404.html']
const TEXT = /\.(html|css|js|json|txt|svg)$/

if (!fs.existsSync(path.join(DIR, 'index.html'))) {
  console.error('dist-portal/index.html not found: run `vite build --mode portal` first')
  process.exit(1)
}
for (const name of SITE_ONLY) fs.rmSync(path.join(DIR, name), { recursive: true, force: true })

const files = fs.readdirSync(DIR, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => {
    const abs = path.join(d.parentPath, d.name)
    const rel = path.relative(DIR, abs).split(path.sep).join('/')
    return { path: rel, bytes: fs.statSync(abs).size, text: TEXT.test(rel) ? fs.readFileSync(abs, 'utf8') : undefined }
  })

const problems = portalProblems(files)
if (problems.length) {
  for (const p of problems) console.error(`FAIL: ${p}`)
  process.exit(1)
}

fs.rmSync(ZIP, { force: true })
const zip = spawnSync('zip', ['-r', '-X', '-q', ZIP, '.'], { cwd: DIR, stdio: 'inherit' })
if (zip.error || zip.status !== 0) {
  console.error(`FAIL: zip ${zip.error?.message ?? `exited ${zip.status}`} (install the zip CLI)`)
  process.exit(1)
}
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1)
const total = files.reduce((sum, f) => sum + f.bytes, 0)
console.log(`dist-portal.zip: ${files.length} files, ${mb(total)} MB unpacked, ${mb(fs.statSync(ZIP).size)} MB zipped`)
