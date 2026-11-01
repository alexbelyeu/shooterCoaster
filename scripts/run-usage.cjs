#!/usr/bin/env node
// Token ledger: sums this Claude Code session's token use (its transcript plus every
// subagent transcript) and optionally appends one comment to the `token-ledger` issue.
// Every runbook ends with it (docs/agents/runbooks/README.md); studio-status.cjs and the
// Reporter read the comments back.
//
//   node scripts/run-usage.cjs --role qa --ref "#123" [--note "..."] [--json] [--post]
//   node scripts/run-usage.cjs --summary --since <ISO> [--until <ISO>]
//
// --summary prints the ledger's runs logged in [since, until) as JSON (total, runs,
// per-role and per-ref weighted tokens, a session counted once), through the same
// ledgerSummary as the status page; the Reporter's token section reads it.
//
// Transcripts: ~/.claude/projects/<cwd-slug>/<session>.jsonl and
// ~/.claude/projects/<cwd-slug>/<session>/subagents/*.jsonl. The session is
// $CLAUDE_CODE_SESSION_ID, else the most recently modified top-level transcript.
// Streamed replies repeat one message on several lines with the same usage, so
// usage is counted once per message id + request id.
//
// "Weighted" = input + output + 1.25 × cache writes + 0.1 × cache reads: API pricing
// ratios, an approximation of plan usage, not its exact accounting.
//
// Each entry also carries `diag` (from diagnose()): where the context went. Peak context,
// compactions, cache misses (a turn that re-wrote most of its context instead of reading
// it from the cache) with their likely cause, and the heaviest tool results. It exists
// because cache writes were half of all spend in Oct 2026 and the totals alone can't say why.
//
// Never fails the session: any error prints a warning and exits 0.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const LEDGER_LABEL = 'token-ledger'
const LEDGER_TITLE = '🧮 Token ledger'
const LEDGER_BODY = [
  'Token use per scheduled agent run. Each run appends one comment here with',
  '`node scripts/run-usage.cjs --role <role> --ref <what it worked on> --post`.',
  '',
  'The "weighted" figure is approximate: input + output + 1.25 × cache writes + 0.1 × cache',
  'reads (API pricing ratios, not the plan\'s exact accounting). The status page and the',
  'weekly report sum these comments.',
  '',
  'Agents only append comments. Not work: builders never claim it; nobody edits or closes it.',
].join('\n')

const weighted = (t) =>
  Math.round(t.input + t.output + 1.25 * t.cacheCreation + 0.1 * t.cacheRead)

const emptyTokens = () => ({ input: 0, cacheCreation: 0, cacheRead: 0, output: 0, turns: 0 })

/**
 * Pure: sums transcripts. `files` = [{ text, subagent }], each `text` a JSONL transcript.
 * Returns totals, per-model totals, turns, subagent count and wall minutes.
 */
function summarize(files) {
  const seen = new Map()
  let first = Infinity
  let last = -Infinity
  for (const { text } of files) {
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let j
      try {
        j = JSON.parse(line)
      } catch {
        continue
      }
      const ts = j.timestamp ? Date.parse(j.timestamp) : NaN
      if (!Number.isNaN(ts)) {
        first = Math.min(first, ts)
        last = Math.max(last, ts)
      }
      const m = j.type === 'assistant' && j.message
      if (!m || !m.usage || m.model === '<synthetic>') continue
      const key = `${m.id || j.uuid}|${j.requestId || ''}`
      const prev = seen.get(key)
      // Repeated lines carry the same usage; keep the most complete one.
      if (!prev || (m.usage.output_tokens || 0) >= (prev.usage.output_tokens || 0)) {
        seen.set(key, { model: m.model || 'unknown', usage: m.usage })
      }
    }
  }
  const total = emptyTokens()
  const models = {}
  for (const { model, usage } of seen.values()) {
    const t = (models[model] ||= emptyTokens())
    for (const target of [t, total]) {
      target.input += usage.input_tokens || 0
      target.cacheCreation += usage.cache_creation_input_tokens || 0
      target.cacheRead += usage.cache_read_input_tokens || 0
      target.output += usage.output_tokens || 0
      target.turns += 1
    }
  }
  for (const t of Object.values(models)) t.weighted = weighted(t)
  return {
    ...total,
    weighted: weighted(total),
    models,
    subagents: files.filter((f) => f.subagent).length,
    minutes: first <= last ? Math.round((last - first) / 60e3) : 0,
  }
}

const MISS_MIN_TOKENS = 20_000
const IDLE_MINUTES = 5

/** Pure: "Bash: npm run verify" from a tool_use block, short enough for a ledger line. */
function describeTool(block) {
  if (!block) return null
  const input = block.input || {}
  const arg = input.command || input.file_path || input.pattern || input.description || input.subagent_type || ''
  const short = String(arg).replace(/\s+/g, ' ').replace(/^(cd \S+ (&&|;) )+/, '')
  return `${block.name}${short ? `: ${short}` : ''}`.slice(0, 90)
}

/** Pure: characters (and images) in a tool_result's content. */
function resultSize(content) {
  if (typeof content === 'string') return { chars: content.length, images: 0 }
  let chars = 0
  let images = 0
  for (const c of Array.isArray(content) ? content : []) {
    if (c && c.type === 'image') images += 1
    else if (c && typeof c.text === 'string') chars += c.text.length
  }
  return { chars, images }
}

/**
 * Pure: where a session's context went. `files` = [{ text, subagent }] as for summarize().
 * A cache miss is a turn that wrote ≥ 20k tokens to the cache and more than it read, i.e.
 * it paid again for context it had already seen. Its cause: "compaction" (first turn after
 * a compact boundary), "idle" (≥ 5 min since the agent's previous turn, so the cache
 * expired), "start" (an agent's first turn: expected, not counted as waste) or "other".
 */
function diagnose(files) {
  let peakContext = 0
  let compactions = 0
  let images = 0
  let resultChars = 0
  const misses = []
  const heavy = []
  files.forEach(({ text }, agent) => {
    const seen = new Set()
    const tools = new Map() // tool_use id → description
    let lastTs = NaN
    let lastTool = null
    let afterCompaction = false
    let first = true
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let j
      try {
        j = JSON.parse(line)
      } catch {
        continue
      }
      if ((j.type === 'system' && j.subtype === 'compact_boundary') || j.isCompactSummary) {
        if (!afterCompaction) compactions += 1
        afterCompaction = true
        continue
      }
      if (j.type === 'user' && j.message && Array.isArray(j.message.content)) {
        for (const c of j.message.content) {
          if (!c || c.type !== 'tool_result') continue
          const size = resultSize(c.content)
          resultChars += size.chars
          images += size.images
          heavy.push({ agent, tool: tools.get(c.tool_use_id) || 'unknown', chars: size.chars, images: size.images })
        }
        continue
      }
      const m = j.type === 'assistant' && j.message
      if (!m || m.model === '<synthetic>') continue
      for (const c of Array.isArray(m.content) ? m.content : []) {
        if (c && c.type === 'tool_use') tools.set(c.id, describeTool(c))
      }
      const key = `${m.id || j.uuid}|${j.requestId || ''}`
      const ts = j.timestamp ? Date.parse(j.timestamp) : NaN
      if (m.usage && !seen.has(key)) {
        seen.add(key)
        const u = m.usage
        const write = u.cache_creation_input_tokens || 0
        const read = u.cache_read_input_tokens || 0
        const context = (u.input_tokens || 0) + write + read
        peakContext = Math.max(peakContext, context)
        if (write >= MISS_MIN_TOKENS && write > read) {
          const gapMin = Number.isNaN(ts) || Number.isNaN(lastTs) ? null : Math.round((ts - lastTs) / 6e4)
          const cause = first ? 'start' : afterCompaction ? 'compaction' : gapMin !== null && gapMin >= IDLE_MINUTES ? 'idle' : 'other'
          misses.push({ agent, tokens: write, context, gapMin, cause, after: lastTool })
        }
        first = false
        afterCompaction = false
      }
      // A streamed message spreads its blocks over several lines: the last tool wins.
      for (const c of Array.isArray(m.content) ? m.content : []) {
        if (c && c.type === 'tool_use') lastTool = describeTool(c)
      }
      if (!Number.isNaN(ts)) lastTs = ts
    }
  })
  const wasted = misses.filter((x) => x.cause !== 'start')
  const causes = {}
  for (const x of wasted) causes[x.cause] = (causes[x.cause] || 0) + 1
  return {
    peakContext,
    compactions,
    misses: wasted.length,
    missTokens: wasted.reduce((n, x) => n + x.tokens, 0),
    causes,
    topMisses: wasted.sort((a, b) => b.tokens - a.tokens).slice(0, 5),
    resultChars,
    images,
    heaviest: heavy.sort((a, b) => b.chars - a.chars).slice(0, 5),
  }
}

function fmtTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return String(n)
}

/** Pure: the ledger comment (one human line + a machine-readable marker). */
function ledgerComment(entry) {
  // In backticks, so `#123` doesn't add a cross-reference to that PR's timeline every run.
  const ref = entry.ref === 'none' ? 'no ref' : `\`${entry.ref}\``
  const line = `🧮 **${entry.role}** · ${ref} · ~${fmtTokens(entry.weighted)} weighted tokens · ` +
    `${entry.turns} turns · ${entry.subagents} subagents · ${entry.minutes} min` +
    (entry.diag
      ? ` · peak ctx ${fmtTokens(entry.diag.peakContext)} · ${entry.diag.compactions} compactions · ` +
        `${entry.diag.misses} cache misses (~${fmtTokens(entry.diag.missTokens)})`
      : '') +
    (entry.note ? ` · ${entry.note}` : '')
  // Escape `-->` so a note can't end the HTML comment early (still valid JSON).
  return `${line}\n<!-- ledger ${JSON.stringify(entry).replace(/-->/g, '--\\u003e')} -->`
}

/** Pure: "123", "PR #123", "#12, #14" → "#123" / "#12,#14"; anything else unchanged. */
function normalizeRef(ref) {
  if (!ref || ref === 'none') return 'none'
  const s = String(ref)
  return /^(\s*(pr|issue)?\s*#?\d+\s*,?)+$/i.test(s) ? s.match(/\d+/g).map((n) => `#${n}`).join(',') : s
}

// ---------- transcripts on disk ----------

function findSession(env = process.env) {
  const root = path.join(env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects')
  const dirs = fs.readdirSync(root).map((d) => path.join(root, d)).filter((d) => fs.statSync(d).isDirectory())
  let main = null
  if (env.CLAUDE_CODE_SESSION_ID) {
    main = dirs.map((d) => path.join(d, `${env.CLAUDE_CODE_SESSION_ID}.jsonl`)).find((f) => fs.existsSync(f)) || null
  }
  if (!main) {
    const all = dirs.flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(d, f)))
    main = all.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null
  }
  if (!main) throw new Error(`no transcript under ${root}`)
  const subDir = path.join(main.replace(/\.jsonl$/, ''), 'subagents')
  const subagents = fs.existsSync(subDir)
    ? fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(subDir, f))
    : []
  return { id: path.basename(main, '.jsonl'), main, subagents }
}

// ---------- GitHub (REST through gh; GraphQL is blocked) ----------

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
    const m = url.match(/([^/:]+)\/([^/]+?)(?:\.git)?$/)
    if (m) return `${m[1]}/${m[2]}`
  } catch {
    // fall through
  }
  return 'alexbelyeu/shootercoaster'
}

function gh(method, route, body) {
  const args = ['api', '-X', method, route]
  if (body) args.push('--input', '-')
  const out = execFileSync('gh', args, { encoding: 'utf8', input: body ? JSON.stringify(body) : undefined, maxBuffer: 16e6 })
  return out.trim() ? JSON.parse(out) : null
}

function ledgerIssue(repo) {
  const open = gh('GET', `repos/${repo}/issues?labels=${LEDGER_LABEL}&state=open&per_page=10`)
  if (open.length) return open.sort((a, b) => a.number - b.number)[0].number
  try {
    gh('POST', `repos/${repo}/labels`, { name: LEDGER_LABEL, color: 'c5def5', description: 'Token use per agent run (agents only append comments; not work)' })
  } catch {
    // label already exists
  }
  return gh('POST', `repos/${repo}/issues`, { title: LEDGER_TITLE, body: LEDGER_BODY, labels: [LEDGER_LABEL] }).number
}

// ---------- CLI ----------

function parseArgs(argv) {
  const a = { role: 'unknown', ref: 'none', note: '', since: '', until: '', json: false, post: false, summary: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--json') a.json = true
    else if (k === '--post') a.post = true
    else if (k === '--summary') a.summary = true
    else if (['--role', '--ref', '--note', '--since', '--until'].includes(k)) a[k.slice(2)] = argv[++i] || ''
  }
  return a
}

/** --summary: the ledger's runs in [since, until) as JSON, summed like the status page. */
async function printSummary(args) {
  const since = Date.parse(args.since)
  const until = args.until ? Date.parse(args.until) : Infinity
  if (Number.isNaN(since) || Number.isNaN(until)) throw new Error('--summary needs --since <ISO> (and optionally --until <ISO>)')
  const status = require('./studio-status.cjs')
  const ledger = await status.collectLedger(status.ghReadApi(repoSlug()), since, until)
  console.log(JSON.stringify(ledger || { number: null, total: 0, runs: 0, roles: [], refs: [] }, null, 2))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.summary) return printSummary(args)
  const session = findSession()
  const files = [
    { text: fs.readFileSync(session.main, 'utf8'), subagent: false },
    ...session.subagents.map((f) => ({ text: fs.readFileSync(f, 'utf8'), subagent: true })),
  ]
  const s = summarize(files)
  const entry = {
    v: 1,
    role: args.role,
    ref: normalizeRef(args.ref),
    ...(args.note ? { note: args.note } : {}),
    at: new Date().toISOString(),
    session: session.id,
    weighted: s.weighted,
    input: s.input,
    output: s.output,
    cacheCreation: s.cacheCreation,
    cacheRead: s.cacheRead,
    turns: s.turns,
    subagents: s.subagents,
    minutes: s.minutes,
    models: s.models,
    diag: diagnose(files),
  }
  const comment = ledgerComment(entry)
  console.log(args.json ? JSON.stringify(entry, null, 2) : comment.split('\n')[0])
  if (args.post) {
    const repo = repoSlug()
    const n = ledgerIssue(repo)
    gh('POST', `repos/${repo}/issues/${n}/comments`, { body: comment })
    console.log(`Posted to ${repo}#${n}`)
  }
}

module.exports = { summarize, diagnose, weighted, ledgerComment, normalizeRef, fmtTokens }

if (require.main === module) {
  Promise.resolve()
    .then(main)
    .catch((e) => console.warn(`run-usage: warning, skipped (${e && e.message ? e.message.split('\n')[0] : e})`))
    .then(() => process.exit(0))
}
