// Player telemetry's read side (#373): GET /api/telemetry's 24 h summary for the status page and the studio-health findings.

const fs = require('node:fs')
const path = require('node:path')

const TELEMETRY_URL = 'https://scoaster.com/api/telemetry'
const FETCH_TIMEOUT_MS = 8000
/** An error seen in this many sessions in 24 h gets a studio-health issue. */
const ERROR_SESSIONS = 3
/** A level's phone p95 is judged once this many sessions played it in 24 h: one slow device isn't a trend. */
const PERF_SESSIONS = 3

/** The summary, or null when the endpoint is down (no env vars yet, a paused Supabase project) or unreachable. */
async function fetchTelemetry(fetchImpl = globalThis.fetch, url = process.env.SC_TELEMETRY_URL || TELEMETRY_URL) {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const s = await res.json()
    return s && Number.isInteger(s.sessions) && Array.isArray(s.errors) && Array.isArray(s.frames) && s.contextLost ? s : null
  } catch {
    return null
  }
}

/** budgets.json `playerFrameMs.touchP95`: the phone p95 frame time the watchdog holds every level to; null if unreadable. */
function phoneFrameBudget(file = path.join(__dirname, '..', 'budgets.json')) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8')).playerFrameMs?.touchP95
    return typeof v === 'number' && v > 0 ? v : null
  } catch {
    return null
  }
}

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const code = (s) => (s ? `\`${s.replace(/`/g, "'")}\`` : '')

/** The status page's "Players" section, as markdown lines. */
function telemetrySection(summary, budget) {
  const out = ['### 📡 Players (last 24 h)']
  if (!summary) {
    out.push('_Telemetry unavailable: `/api/telemetry` did not answer (not set up yet, or the Supabase project is paused; docs/TELEMETRY.md)._', '')
    return out
  }
  const lost = summary.contextLost
  const gpus = lost.gpus.length ? ` (${lost.gpus.map((g) => `${short(g.gpu, 40)} ×${g.sessions}`).join(', ')})` : ''
  out.push(`${summary.sessions}${summary.truncated ? '+' : ''} play sessions reported · ${summary.errors.length ? `${summary.errors.length} distinct errors` : 'no errors'} · ` +
    `${lost.sessions} WebGL context losses${gpus}`)
  out.push('')
  if (summary.errors.length) {
    out.push('| Sessions | Count | Error | Where | Versions |', '|---|---|---|---|---|')
    for (const e of summary.errors.slice(0, 5)) {
      out.push(`| ${e.sessions} | ${e.count} | ${cell(short(e.message, 80))} | ${cell(code(short(e.frame, 60)))} | ${cell(e.versions.join(', '))} |`)
    }
    out.push('')
  }
  if (summary.frames.length) {
    out.push(`| Level | Device | Sessions | p50 ms | p95 ms | Worst p95 | Longest frame | Frames ≥ 100 ms |`, '|---|---|---|---|---|---|---|---|')
    for (const f of summary.frames) {
      const over = f.device === 'touch' && budget && f.p95Ms > budget ? ' ⚠️' : ''
      out.push(`| ${f.level} | ${f.device} | ${f.sessions} | ${f.p50Ms} | ${f.p95Ms}${over} | ${f.worstP95Ms} | ${f.worstMaxMs ?? '-'} | ${f.longFrames ?? '-'} |`)
    }
    out.push(`<sub>Medians over sessions of each session's own p50 / p95 frame time. Phone budget: p95 ≤ ${budget ?? '?'} ms (budgets.json \`playerFrameMs\`).</sub>`)
    out.push('')
  }
  return out
}

/**
 * studio-health findings: one per error seen in `ERROR_SESSIONS`+ sessions (closed after a fix, it is filed again
 * only when a session after the close hits it), and one per level whose phone p95 is over budget right now.
 */
function telemetryFindings(summary, { closedAt = {}, budget = null } = {}) {
  if (!summary) return []
  const out = []
  for (const e of summary.errors) {
    const key = `player-error:${e.key}`
    const lastSeen = Date.parse(e.lastSeen)
    if (e.sessions < ERROR_SESSIONS || lastSeen <= (closedAt[key] ?? -Infinity)) continue
    out.push({
      key,
      lastSeen,
      owner: 'agents',
      title: `Player error in ${e.sessions} sessions: ${short(e.message, 70)}`,
      body: `Real players hit this error in **${e.sessions} sessions** (${e.count} times) in the last 24 h ` +
        `(first ${e.firstSeen.slice(0, 16)}Z, latest ${e.lastSeen.slice(0, 16)}Z), from player telemetry (\`/api/telemetry\`, #373).\n\n` +
        `- Message: ${code(e.message)}\n- First stack frame: ${code(e.frame) || '_none_'}\n- Versions: ${e.versions.map(code).join(', ')}\n\n` +
        'The frame points into the minified production bundle. A version is `<package version>+<commit>`: check out that commit, ' +
        '`npm run build`, and read the named file of `dist/assets/` at that line and column to find the code. ' +
        'Reproduce it, fix the cause, and close this issue with the PR link.',
    })
  }
  if (budget) {
    for (const f of summary.frames) {
      if (f.device !== 'touch' || f.sessions < PERF_SESSIONS || !(f.p95Ms > budget)) continue
      out.push({
        state: true,
        key: `player-perf:${f.level}`,
        lastSeen: Date.parse(summary.until),
        owner: 'agents',
        title: `${f.level} runs slow on phones: p95 frame ${f.p95Ms} ms (budget ${budget})`,
        body: `Over the last 24 h, ${f.sessions} phone sessions played ${f.level}: median p95 frame time **${f.p95Ms} ms** ` +
          `(p50 ${f.p50Ms} ms, slowest session's p95 ${f.worstP95Ms} ms), over the ${budget} ms budget (budgets.json \`playerFrameMs.touchP95\`), ` +
          'from player telemetry (`/api/telemetry`, #373).\n\n' +
          'Profile the level on a phone-sized viewport (`npm run smoke -- --levels ' + f.level + ' --mobile`: draw calls, triangles) ' +
          'and cut what costs most there; docs/HEAP-BOTTLENECKS.md and the perf notes in docs/ have the usual suspects.',
      })
    }
  }
  return out
}

module.exports = { fetchTelemetry, phoneFrameBudget, telemetrySection, telemetryFindings, ERROR_SESSIONS, PERF_SESSIONS, TELEMETRY_URL }
