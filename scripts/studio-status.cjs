// Live "Studio status" page for Alex: rewrites the body of one GitHub issue
// (label `studio-status`) with what the autonomous studio is doing right now.
//
// Run by .github/workflows/studio-status.yml (actions/github-script) on every
// issue / PR / label change and every 15 minutes. Read-only except for that one
// issue (and creating it + its label the first time).
//
// Local dry run (prints the markdown, writes nothing):
//   node scripts/studio-status.cjs --dry-run

const TZ = 'America/New_York'
const STATUS_LABEL = 'studio-status'
const STATUS_TITLE = '📊 Studio status (live)'
const SITE = 'https://shooter-coaster.vercel.app'
const REPO = 'alexbelyeu/shooterCoaster'

// Keep in sync with the scheduled tasks (times are New York wall-clock).
// days: 0 = Sunday … 6 = Saturday; omitted = every day.
const SCHEDULE = [
  { who: 'Marketer', what: 'metrics, growth issues, drafts for you', times: ['05:13'], days: [1] },
  { who: 'Reporter', what: 'weekly report email', times: ['06:13'], days: [1] },
  { who: 'Director', what: 'plans the week, files issues', times: ['07:44'], days: [1] },
  { who: 'Builders', what: 'build the top issues, open PRs', times: ['08:47', '13:47', '18:47'] },
  { who: 'QA', what: 'review + approve PRs (approved PRs auto-ship)', times: ['10:17', '15:17', '20:17'] },
  { who: 'Maintainer', what: 'health, stale claims, tech debt', times: ['03:36'] },
]

const HOUR = 3600e3
const DAY = 24 * HOUR

// ---------- time helpers ----------

function zonedParts(ms) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', weekday: 'short',
  })
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd }
}

/** UTC ms for a New York wall-clock time. */
function zonedToUtc(y, m, d, h, mi) {
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const p = zonedParts(guess)
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - guess
  return guess - offset
}

function fmtTime(ms, now) {
  const sameDay = zonedParts(ms).d === zonedParts(now).d && Math.abs(ms - now) < DAY
  const opts = { timeZone: TZ, hour: 'numeric', minute: '2-digit' }
  if (!sameDay) opts.weekday = 'short'
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(ms))
}

function fmtDur(ms) {
  const m = Math.round(Math.abs(ms) / 60e3)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
}

const ago = (ms, now) => `${fmtDur(now - ms)} ago`

function nextRun(entry, now) {
  for (let offset = 0; offset <= 8; offset++) {
    const p = zonedParts(now + offset * DAY)
    if (entry.days && !entry.days.includes(p.wd)) continue
    for (const t of entry.times) {
      const [h, mi] = t.split(':').map(Number)
      const at = zonedToUtc(p.y, p.m, p.d, h, mi)
      if (at > now) return at
    }
  }
  return null
}

function usual(entry) {
  const t = entry.times
    .map((s) => {
      const [h, mi] = s.split(':').map(Number)
      return `${((h + 11) % 12) + 1}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
    })
    .join(' · ')
  if (!entry.days) return `${t} daily`
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${entry.days.map((d) => names[d]).join(', ')} ${t}`
}

// ---------- markdown helpers ----------

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
const short = (s, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const hasLabel = (x, name) => x.labels.some((l) => (typeof l === 'string' ? l : l.name) === name)
const prio = (x) => (hasLabel(x, 'P1') ? 1 : hasLabel(x, 'P2') ? 2 : hasLabel(x, 'P3') ? 3 : 4)

function table(head, rows) {
  if (!rows.length) return '_None._\n'
  return [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n') + '\n'
}

// ---------- data ----------

async function collect(api, now) {
  const [openIssuesAndPrs, openPrs, closedPrs, branches] = await Promise.all([
    api('GET /repos/{owner}/{repo}/issues', { state: 'open', per_page: 100 }),
    api('GET /repos/{owner}/{repo}/pulls', { state: 'open', per_page: 100 }),
    api('GET /repos/{owner}/{repo}/pulls', { state: 'closed', sort: 'updated', direction: 'desc', per_page: 40 }),
    api('GET /repos/{owner}/{repo}/branches', { per_page: 100 }),
  ])
  const issues = openIssuesAndPrs.filter((i) => !i.pull_request)
  const prs = openPrs.filter((p) => !p.draft)
  const drafts = openPrs.filter((p) => p.draft)
  const merged = closedPrs
    .filter((p) => p.merged_at && now - Date.parse(p.merged_at) < 48 * HOUR)
    .sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at))

  // Being built: claim time from the latest "Claimed by" comment, activity from the branch.
  const building = await Promise.all(
    issues.filter((i) => hasLabel(i, 'agent:in-progress')).map(async (i) => {
      const comments = await api('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        issue_number: i.number, per_page: 100,
      })
      const claim = [...comments].reverse().find((c) => /^Claimed by/i.test(c.body || ''))
      const claimedAt = Date.parse(claim ? claim.created_at : i.updated_at)
      const branch = branches.find((b) => b.name.startsWith(`agent/${i.number}-`))
      let pushedAt = null
      if (branch) {
        const c = await api('GET /repos/{owner}/{repo}/commits/{ref}', { ref: branch.name })
        pushedAt = Date.parse(c.commit.committer.date)
      }
      const pr = openPrs.find((p) => branch && p.head.ref === branch.name)
      return { issue: i, claimedAt, branch: branch && branch.name, pushedAt, pr }
    }),
  )

  // CI state for PRs that are in review or sent back.
  const verifyOf = async (sha) => {
    const r = await api('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { ref: sha, check_name: 'verify' })
    const run = r.check_runs.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0]
    if (!run) return '⏳ not started'
    if (run.status !== 'completed') return '⏳ running'
    return run.conclusion === 'success' ? '✅ green' : `❌ ${run.conclusion}`
  }
  const reviewPrs = prs.filter((p) => hasLabel(p, 'agent:needs-qa') || hasLabel(p, 'agent:qa-approved') || hasLabel(p, 'agent:changes-requested'))
  const ci = Object.fromEntries(await Promise.all(reviewPrs.map(async (p) => [p.number, await verifyOf(p.head.sha)])))

  let prodSmoke = null
  try {
    const r = await api('GET /repos/{owner}/{repo}/actions/workflows/{workflow}/runs', { workflow: 'prod-smoke.yml', per_page: 5 })
    prodSmoke = r.workflow_runs.find((w) => w.status === 'completed') || null
  } catch {
    prodSmoke = null
  }

  let steeringPaused = false
  try {
    const f = await api('GET /repos/{owner}/{repo}/contents/{path}', { path: 'docs/agents/STEERING.md' })
    steeringPaused = /^pause:\s*true/m.test(Buffer.from(f.content, 'base64').toString('utf8'))
  } catch {
    steeringPaused = false
  }

  return { issues, prs, drafts, merged, building, ci, prodSmoke, steeringPaused }
}

// ---------- render ----------

function render(data, now) {
  const { issues, prs, drafts, merged, building, ci, prodSmoke, steeringPaused } = data
  const pauses = issues.filter((i) => hasLabel(i, 'pause'))
  const inQa = prs.filter((p) => hasLabel(p, 'agent:needs-qa'))
    .sort((a, b) => prio(a) - prio(b) || Date.parse(a.created_at) - Date.parse(b.created_at))
  const approved = prs.filter((p) => hasLabel(p, 'agent:qa-approved'))
  const sentBack = prs.filter((p) => hasLabel(p, 'agent:changes-requested'))
  const blocked = issues.filter((i) => hasLabel(i, 'agent:blocked'))
  const prodBroken = issues.filter((i) => hasLabel(i, 'agent:prod-broken'))
  const ready = issues.filter((i) => hasLabel(i, 'agent:ready') && !hasLabel(i, 'epic'))
    .sort((a, b) => prio(a) - prio(b) || a.number - b.number)
  const steering = issues.filter((i) => hasLabel(i, 'steering'))

  const runs = SCHEDULE.map((s) => ({ ...s, next: nextRun(s, now) })).sort((a, b) => a.next - b.next)
  const next = runs[0]
  const nextOf = (who) => runs.find((r) => r.who === who)
  const when = (r) => `${fmtTime(r.next, now)} (in ${fmtDur(r.next - now)})`

  const headline = []
  if (prodBroken.length) headline.push(`🚨 production smoke failing (${prodBroken.map((i) => `#${i.number}`).join(', ')})`)
  headline.push(building.length ? `🔨 ${building.length} being built` : '🔨 nothing being built')
  headline.push(`🔍 ${inQa.length} waiting for QA`)
  if (approved.length) headline.push(`✅ ${approved.length} approved, merging`)
  if (sentBack.length) headline.push(`↩️ ${sentBack.length} sent back`)
  if (blocked.length) headline.push(`⛔ ${blocked.length} blocked`)
  headline.push(`🚀 ${merged.length} shipped in 48h`)

  const out = []
  out.push('<!-- generated by scripts/studio-status.cjs; edits are overwritten -->')
  if (pauses.length || steeringPaused) {
    const why = pauses.length
      ? pauses.map((i) => `#${i.number} "${i.title}"`).join(', ') + ' — close it to resume'
      : '`pause: true` in docs/agents/STEERING.md'
    out.push(`> ⏸ **PAUSED** by ${why}. Agents start no new work and stop at their next checkpoint; approved PRs still auto-merge.`)
    out.push('')
  }
  out.push(`**${headline.join(' · ')}**`)
  out.push('')
  out.push(`**Next:** ${next.who} at ${when(next)} — ${next.what}.`)
  out.push('')
  out.push(`<sub>Updated ${fmtTime(now, now)} ET. Refreshes on every agent action and every 15 min. Work only moves when a scheduled run fires, so quiet gaps between runs are normal.</sub>`)
  out.push('')

  out.push('### 🔨 Being built now')
  out.push(table(['Issue', 'Claimed', 'Last push', 'Status'], building
    .sort((a, b) => a.claimedAt - b.claimedAt)
    .map((b) => {
      const quietFor = now - (b.pushedAt || b.claimedAt)
      let note = 'working'
      if (b.pr) note = `PR #${b.pr.number} open`
      else if (now - b.claimedAt > 20 * HOUR) note = '⚠️ stale — Maintainer will release it'
      else if (quietFor > 2 * HOUR) note = `💤 quiet ${fmtDur(quietFor)}`
      return [`#${b.issue.number} ${short(b.issue.title)}`, ago(b.claimedAt, now), b.pushedAt ? ago(b.pushedAt, now) : 'no commits yet', note]
    })))

  out.push(`### 🔍 Waiting for QA — next QA run ${when(nextOf('QA'))}`)
  out.push(table(['PR', 'Opened', 'CI'], inQa.map((p) => [
    `#${p.number} ${prio(p) === 1 ? '**P1** ' : ''}${short(p.title)}`, ago(Date.parse(p.created_at), now), ci[p.number] || '—',
  ])))

  if (approved.length) {
    out.push('### ✅ Approved — GitHub merges these once CI is green')
    out.push(table(['PR', 'CI'], approved.map((p) => [`#${p.number} ${short(p.title)}`, ci[p.number] || '—'])))
  }

  out.push(`### ↩️ Sent back to builders — next builder run ${when(nextOf('Builders'))}`)
  out.push(table(['PR', 'Updated', 'CI'], sentBack.map((p) => [
    `#${p.number} ${short(p.title)}`, ago(Date.parse(p.updated_at), now), ci[p.number] || '—',
  ])))

  out.push('### ⛔ Blocked (needs the Director or you)')
  out.push(table(['Issue', 'Since'], blocked.map((i) => [`#${i.number} ${short(i.title)}`, ago(Date.parse(i.updated_at), now)])))

  out.push(`### 🚀 Shipped in the last 48h — live at ${SITE}`)
  out.push(merged.length
    ? merged.map((p) => `- ${fmtTime(Date.parse(p.merged_at), now)} — #${p.number} ${p.title}`).join('\n') + '\n'
    : '_Nothing merged in the last 48h._\n')

  out.push('### 🩺 Production')
  const smoke = prodSmoke
    ? `${prodSmoke.conclusion === 'success' ? '✅ passed' : `❌ ${prodSmoke.conclusion}`} ${ago(Date.parse(prodSmoke.updated_at), now)} ([run](${prodSmoke.html_url}))`
    : 'no run yet'
  out.push(`Live-site smoke test: ${smoke}. Open prod-broken issues: ${prodBroken.length ? prodBroken.map((i) => `#${i.number}`).join(', ') : 'none'}.`)
  out.push('')

  out.push('### ⏰ Schedule (New York time)')
  out.push(table(['Who', 'Next run', 'Usual', 'Does'], runs.map((r) => [r.who, when(r), usual(r), r.what])))

  out.push('### 📋 Queue')
  const byP = [1, 2, 3].map((n) => `P${n}: ${ready.filter((i) => prio(i) === n).length}`).join(', ')
  out.push(`${ready.length} issues ready to build (${byP}). Up next:`)
  out.push(ready.slice(0, 5).map((i) => `- #${i.number} ${i.title}`).join('\n') || '- _(empty — builders will draw from the VISION.md backlog)_')
  if (drafts.length) out.push(`\nDraft PRs (unfinished work): ${drafts.map((p) => `#${p.number}`).join(', ')}`)
  if (steering.length) out.push(`\nOpen steering issues: ${steering.map((i) => `#${i.number}`).join(', ')}`)
  const forAlex = issues.filter((i) => hasLabel(i, 'needs-alex'))
  if (forAlex.length) out.push(`\n📣 Waiting on you (marketing): ${forAlex.map((i) => `#${i.number} ${short(i.title, 50)}`).join(' · ')}`)
  out.push('')
  out.push(`<sub>⏸ [Pause everything](https://github.com/${REPO}/issues/new?title=PAUSE&labels=pause&body=Close%20this%20issue%20to%20resume.) (or title it \`PAUSE until 2026-10-21 08:00\` to resume by itself) · Steer: edit \`docs/agents/STEERING.md\` or open an issue labelled \`steering\`.</sub>`)
  return out.join('\n')
}

// ---------- entry points ----------

async function upsertIssue(api, body) {
  const existing = await api('GET /repos/{owner}/{repo}/issues', { state: 'open', labels: STATUS_LABEL, per_page: 10 })
  if (existing.length) {
    const issue = existing.sort((a, b) => a.number - b.number)[0]
    if (issue.body === body) return { number: issue.number, changed: false }
    await api('PATCH /repos/{owner}/{repo}/issues/{issue_number}', { issue_number: issue.number, body, title: STATUS_TITLE })
    return { number: issue.number, changed: true }
  }
  try {
    await api('POST /repos/{owner}/{repo}/labels', {
      name: STATUS_LABEL, color: '0e8a16', description: 'The live studio status page (kept up to date by a workflow)',
    })
  } catch {
    // label already exists
  }
  const created = await api('POST /repos/{owner}/{repo}/issues', { title: STATUS_TITLE, body, labels: [STATUS_LABEL] })
  return { number: created.number, changed: true }
}

/** Called from actions/github-script. */
module.exports = async function run({ github, context, core }) {
  const api = async (route, params = {}) =>
    (await github.request(route, { owner: context.repo.owner, repo: context.repo.repo, ...params })).data
  const now = Date.now()
  const body = render(await collect(api, now), now)
  const res = await upsertIssue(api, body)
  core.info(`Studio status issue #${res.number} ${res.changed ? 'updated' : 'unchanged'}`)
}

module.exports.render = render
module.exports.nextRun = nextRun
module.exports.SCHEDULE = SCHEDULE

// Local dry run through the `gh` CLI: node scripts/studio-status.cjs --dry-run
if (require.main === module) {
  const { execFileSync } = require('node:child_process')
  const repo = process.env.GITHUB_REPOSITORY || 'alexbelyeu/shooterCoaster'
  const [owner, name] = repo.split('/')
  const api = async (route, params = {}) => {
    const [method, tmpl] = route.split(' ')
    if (method !== 'GET') throw new Error('dry run is read-only')
    const all = { owner, repo: name, ...params }
    const used = new Set()
    const path = tmpl.replace(/\{(\w+)\}/g, (_, k) => (used.add(k), encodeURIComponent(all[k])))
    const qs = Object.entries(all).filter(([k]) => !used.has(k)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return JSON.parse(execFileSync('gh', ['api', qs ? `${path}?${qs}` : path], { encoding: 'utf8', maxBuffer: 64e6 }))
  }
  const now = Date.now()
  collect(api, now).then((d) => console.log(render(d, now))).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
