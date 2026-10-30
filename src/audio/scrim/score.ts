/*
 * Scrimshaw score format: parser + compiler. Pure: no DOM, no audio.
 *
 * Ported from Scrimshaw Jukebox (docs/audio/reference/scrimshaw-jukebox.html, the `ScrimScore`
 * script), simonw/tools commit 5fc8e8b, Apache-2.0 (docs/audio/reference/LICENSE-scrimshaw-apache-2.0.txt).
 * Modified for ShooterCoaster: TypeScript types; the behaviour, including every error message, is
 * unchanged and pinned by `score.test.ts` against the original. Format: docs/audio/SCORE-FORMAT.md.
 */

export const MELODIC = ['steeldrum', 'marimba', 'vibes', 'celesta', 'glock', 'xylophone', 'musicbox', 'bell',
  'organ', 'pipe', 'strings', 'pad', 'choir', 'voices', 'brass', 'trumpet', 'horn', 'tuba',
  'flute', 'clarinet', 'oboe', 'bassoon', 'accordion', 'fiddle',
  'harp', 'guitar', 'banjo', 'harpsichord', 'pizz', 'upright', 'fretless', 'synbass', 'timpani',
  'chip', 'sine', 'square', 'saw', 'triangle']
export const DRUMS = ['kick', 'snare', 'rim', 'hat', 'ohat', 'ride', 'crash', 'shaker', 'tamb',
  'conga', 'tumba', 'bongo', 'bongolo', 'clave', 'block', 'cowbell', 'guiro',
  'tomlo', 'tommid', 'tomhi', 'bodhran', 'timbale', 'tri', 'clap', 'gong', 'thunder', 'surf']

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const NOTE_RE = /^([A-Ga-g])(##|bb|#|b)?([0-8])$/
const ACC: Record<string, number> = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 }

export function noteToMidi(s: string): number | null {
  const m = NOTE_RE.exec(s)
  if (!m) return null
  return 12 * (+m[3] + 1) + PC[m[1].toLowerCase()] + ACC[m[2] || '']
}

export const CHORDS: Record<string, number[]> = {
  '': [0, 4, 7], maj: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7],
  '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], mmaj7: [0, 3, 7, 11],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7], '7sus4': [0, 5, 7, 10],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], '+': [0, 4, 8],
  '5': [0, 7], '7b9': [0, 4, 7, 10, 13],
}

function pcOf(letter: string, acc: string | undefined) {
  return (PC[letter.toLowerCase()] + ACC[acc || ''] + 12) % 12
}
function placeNear(pc: number, lo: number) {
  return lo + ((((pc - lo) % 12) + 12) % 12)
}

/** `Dm7` or `C/E` → MIDI notes voiced in a window around `center`. */
export function chordToMidis(sym: string, center: number): number[] | null {
  const m = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/.exec(sym)
  if (!m || !(m[3] in CHORDS)) return null
  const root = pcOf(m[1], m[2])
  const lo = center - 6
  const set = new Set(CHORDS[m[3]].map((iv) => placeNear((root + iv) % 12, lo)))
  if (m[4]) set.add(placeNear(pcOf(m[4], m[5]), lo - 12))
  return [...set].sort((a, b) => a - b)
}

const T_HOLD = /^-+$/
const T_REST = /^(\.+)(-*)$/
const NOTE_SRC = '[A-Ga-g](?:##|bb|#|b)?[0-8]'
const T_NOTE = new RegExp('^(~?)(\\[[^\\]]+\\]|' + NOTE_SRC + '(?:\\+' + NOTE_SRC + ')*)([!?]*)(-*)([!?]*)$')

function velFrom(marks: string) {
  let v = 0.8
  for (const ch of marks) v *= ch === '!' ? 1.25 : 0.6
  return Math.min(1.35, v)
}

function num(s: string, lo: number, hi: number, def: number) {
  const n = parseFloat(s)
  if (!isFinite(n)) return def
  return Math.max(lo, Math.min(hi, n))
}

export interface ScoreError {
  line: number
  msg: string
}

export interface Voice {
  name: string
  inst: string
  drum: boolean
  vol: number
  pan: number
  rev: number | null
  trans: number
  glide: number
  gate: number
  center: number
  bright: number
  att: number | null
  rel: number | null
  ln: number
}

interface PatternOpts {
  tempo?: number
  beats?: number
  steps?: number
  swing?: number
}

interface RawLine {
  bars: string[]
  ln: number
}

interface RawPattern {
  name: string
  ln: number
  from: string | null
  opts: PatternOpts
  raw: Record<string, RawLine[]>
  voiceOrder: string[]
  mute: Set<string>
}

interface PatternRef {
  name: string
  trans: number
  times: number
  ln: number
}

export interface ParsedSong {
  title: string
  composer: string
  about: string
  tempo: number
  beats: number
  steps: number
  swing: number
  reverb: number
  voices: Voice[]
  voiceMap: Record<string, Voice>
  patterns: Record<string, RawPattern>
  patternOrder: string[]
  play: PatternRef[]
  loop: PatternRef[]
}

/* ------------------------------------------------------------------ parse */
export function parse(text: string): { song: ParsedSong; errors: ScoreError[] } {
  const errors: ScoreError[] = []
  const err = (ln: number, msg: string) => errors.push({ line: ln, msg })
  const song: ParsedSong = {
    title: 'Untitled', composer: '', about: '', tempo: 120, beats: 4, steps: 4, swing: 0,
    reverb: 0.3, voices: [], voiceMap: {}, patterns: {}, patternOrder: [], play: [], loop: [],
  }
  let cur: RawPattern | null = null
  const lines = String(text).split(/\r?\n/)

  function parseVoice(w: string[], ln: number) {
    const [name, inst] = w
    if (!name || !inst) { err(ln, 'Write voices as: voice NAME INSTRUMENT [options]'); return }
    if (!/^[A-Za-z_]\w*$/.test(name)) { err(ln, `Voice name "${name}" should use letters, digits and _.`); return }
    const instL = inst.toLowerCase()
    const isDrum = DRUMS.includes(instL)
    if (!isDrum && !MELODIC.includes(instL)) { err(ln, `Unknown instrument "${inst}".`); return }
    const v: Voice = {
      name, inst: instL, drum: isDrum, vol: 0.8, pan: 0, rev: null, trans: 0, glide: 0.07,
      gate: 1, center: 62, bright: 1, att: null, rel: null, ln,
    }
    for (const opt of w.slice(2)) {
      const kv = /^(\w+)=(.+)$/.exec(opt)
      if (!kv) { err(ln, `Voice options look like key=value; got "${opt}".`); continue }
      const k = kv[1].toLowerCase(), val = kv[2]
      switch (k) {
        case 'vol': v.vol = num(val, 0, 2, 0.8); break
        case 'pan': v.pan = num(val, -1, 1, 0); break
        case 'rev': v.rev = num(val, 0, 1, 0.2); break
        case 'trans': v.trans = Math.round(num(val, -48, 48, 0)); break
        case 'oct': v.trans += 12 * Math.round(num(val, -4, 4, 0)); break
        case 'glide': v.glide = num(val, 0.005, 2, 0.07); break
        case 'gate': v.gate = num(val, 0.05, 1, 1); break
        case 'bright': v.bright = num(val, 0.1, 4, 1); break
        case 'att': v.att = num(val, 0.001, 4, 0.01); break
        case 'rel': v.rel = num(val, 0.005, 6, 0.1); break
        case 'center': {
          const m = noteToMidi(val)
          if (m == null) err(ln, `center= needs a note like E4; got "${val}".`)
          else v.center = m
          break
        }
        default: err(ln, `Unknown voice option "${kv[1]}".`)
      }
    }
    if (song.voiceMap[name]) err(ln, `Voice "${name}" is declared twice.`)
    else { song.voiceMap[name] = v; song.voices.push(v) }
  }

  lines.forEach((raw, i) => {
    const ln = i + 1
    const line = raw.replace(/(^|\s)#.*$/, '').trim()
    if (!line) return

    const pm = /^([A-Za-z_]\w*)\s*\|(.*)$/.exec(line)
    if (pm) {
      if (!cur) { err(ln, 'Music lines go inside a pattern. Add a "pattern NAME" line above this one.'); return }
      const parts = pm[2].split('|').map((s) => s.trim())
      while (parts.length && parts[parts.length - 1] === '') parts.pop()
      const bars: string[] = []
      parts.forEach((b, k) => {
        if (b === '') err(ln, `Empty bar ${k + 1} in "${pm[1]}". Use _ for a silent bar.`)
        else bars.push(b)
      })
      ;(cur.raw[pm[1]] = cur.raw[pm[1]] || []).push({ bars, ln })
      if (!cur.voiceOrder.includes(pm[1])) cur.voiceOrder.push(pm[1])
      return
    }

    const words = line.split(/\s+/)
    const kw = words[0].toLowerCase()
    const restStr = line.slice(words[0].length).trim()
    const target: PatternOpts = cur ? cur.opts : song

    switch (kw) {
      case 'title': song.title = restStr || song.title; break
      case 'composer': case 'by': song.composer = restStr; break
      case 'about': song.about = restStr; break
      case 'tempo': target.tempo = num(restStr, 20, 400, 120); break
      case 'beats': target.beats = Math.round(num(restStr, 1, 16, 4)); break
      case 'steps': target.steps = Math.round(num(restStr, 1, 12, 4)); break
      case 'swing': target.swing = num(restStr, 0, 0.75, 0); break
      case 'reverb': song.reverb = num(restStr, 0, 1, 0.3); break
      case 'voice': parseVoice(words.slice(1), ln); break
      case 'pattern': {
        const name = words[1]
        if (!name || !/^[A-Za-z_]\w*$/.test(name)) {
          err(ln, 'Pattern names use letters, digits and _ (for example: pattern A2).')
          cur = null
          return
        }
        if (song.patterns[name]) err(ln, `Pattern "${name}" is defined twice; the later one wins.`)
        const p: RawPattern = { name, ln, from: null, opts: {}, raw: {}, voiceOrder: [], mute: new Set() }
        cur = p
        for (let k = 2; k < words.length; k++) {
          const w = words[k]
          if (w.toLowerCase() === 'from') { p.from = words[++k]; continue }
          const kv = /^(\w+)=(.+)$/.exec(w)
          if (!kv) { err(ln, `Can't read "${w}" in the pattern line.`); continue }
          const key = kv[1].toLowerCase()
          if (key === 'tempo') p.opts.tempo = num(kv[2], 20, 400, 120)
          else if (key === 'beats') p.opts.beats = Math.round(num(kv[2], 1, 16, 4))
          else if (key === 'steps') p.opts.steps = Math.round(num(kv[2], 1, 12, 4))
          else if (key === 'swing') p.opts.swing = num(kv[2], 0, 0.75, 0)
          else err(ln, `Unknown pattern option "${kv[1]}".`)
        }
        song.patterns[name] = p
        if (!song.patternOrder.includes(name)) song.patternOrder.push(name)
        break
      }
      case 'mute':
        if (!cur) err(ln, '"mute" only works inside a pattern.')
        else for (const w of words.slice(1)) cur.mute.add(w)
        break
      case 'play': case 'loop': {
        cur = null
        const list = kw === 'play' ? song.play : song.loop
        for (const w of words.slice(1)) {
          const m = /^([A-Za-z_]\w*?)([+-]\d+)?(?:\*(\d+))?$/.exec(w)
          if (!m) { err(ln, `Can't read "${w}". Write a pattern name, optionally with +N/-N to transpose and *N to repeat.`); continue }
          list.push({ name: m[1], trans: m[2] ? parseInt(m[2], 10) : 0, times: m[3] ? Math.min(64, parseInt(m[3], 10)) : 1, ln })
        }
        break
      }
      default:
        err(ln, `Unknown line "${words[0]}". Lines start with a setting (title, tempo, voice, pattern, play, loop…) or a voice name followed by |.`)
    }
  })

  return { song, errors }
}

/* ------------------------------------------------------- pattern bodies */
interface StepEvent {
  step: number
  len: number
  vel: number
  notes?: number[]
  glide?: boolean
}

interface BarCtx {
  pattern: string
  err: (msg: string) => void
}

function parseMelodicBars(bars: string[], barSteps: number, voice: Voice, ctx: BarCtx): StepEvent[] {
  const events: StepEvent[] = []
  let last: StepEvent | null = null
  const out: StepEvent[] = []
  bars.forEach((barSrc, bi) => {
    const start = bi * barSteps
    const where = `bar ${bi + 1} of "${voice.name}" in pattern ${ctx.pattern}`
    const trimmed = barSrc.trim()
    if (trimmed === '%') {
      const prev = events.filter((e) => e.step >= start - barSteps && e.step < start)
      if (bi === 0) ctx.err(`% in ${where} has no previous bar to repeat.`)
      for (const e of prev) events.push({ ...e, step: e.step + barSteps })
      last = events.length ? events[events.length - 1] : null
      return
    }
    if (trimmed === '_') { last = null; return }
    if (trimmed === '=') {
      if (last && last.step + last.len === start) last.len += barSteps
      else ctx.err(`= in ${where} needs a note sounding right up to the bar line.`)
      return
    }
    let pos = start
    for (const tok of trimmed.split(/\s+/)) {
      let m: RegExpExecArray | null
      if (T_HOLD.test(tok)) {
        if (last && last.step + last.len === pos) last.len += tok.length
        pos += tok.length
      } else if ((m = T_REST.exec(tok))) {
        pos += m[1].length + m[2].length
        last = null
      } else if ((m = T_NOTE.exec(tok))) {
        const head = m[2]
        let notes: number[]
        if (head[0] === '[') {
          const chord = chordToMidis(head.slice(1, -1), voice.center)
          if (!chord) ctx.err(`Unknown chord "${head}" in ${where}.`)
          notes = chord ?? []
        } else {
          // The note regex guarantees each part parses.
          notes = head.split('+').map((n) => noteToMidi(n) as number)
        }
        const len = 1 + m[4].length
        const ev: StepEvent = { step: pos, len, notes, vel: velFrom(m[3] + m[5]), glide: m[1] === '~' }
        last = ev
        if (notes.length) events.push(ev)
        pos += len
      } else if (tok === '%' || tok === '_' || tok === '=') {
        ctx.err(`"${tok}" must be alone in its bar (${where}).`)
      } else {
        ctx.err(`Can't read "${tok}" in ${where}. Notes look like D5, F#4, Bb3, chords like [Dm] or C4+E4+G4.`)
      }
    }
    const used = pos - start
    if (used !== barSteps) {
      ctx.err(`${where[0].toUpperCase() + where.slice(1)} has ${used} steps; a bar here holds ${barSteps}.`)
      // clip anything spilling into the next bar so later bars stay aligned
      for (const e of events) if (e.step >= start + barSteps) e.len = 0
      const l = last as StepEvent | null
      if (l && l.step + l.len > start + barSteps && used > barSteps) l.len = Math.max(1, start + barSteps - l.step)
    }
  })
  for (const e of events) if (e.len > 0) out.push(e)
  return out
}

function parseDrumBars(bars: string[], barSteps: number, voice: Voice, ctx: BarCtx): StepEvent[] {
  const events: StepEvent[] = []
  bars.forEach((barSrc, bi) => {
    const start = bi * barSteps
    const where = `bar ${bi + 1} of "${voice.name}" in pattern ${ctx.pattern}`
    const s = barSrc.replace(/\s+/g, '')
    if (s === '%') {
      if (bi === 0) ctx.err(`% in ${where} has no previous bar to repeat.`)
      for (const e of events.filter((e) => e.step >= start - barSteps && e.step < start)) {
        events.push({ step: e.step + barSteps, len: 1, vel: e.vel })
      }
      return
    }
    if (s === '_') return
    let k = 0
    for (const ch of s) {
      if (k < barSteps) {
        if (ch === 'x') events.push({ step: start + k, len: 1, vel: 0.8 })
        else if (ch === 'X') events.push({ step: start + k, len: 1, vel: 1.05 })
        else if (ch === 'o') events.push({ step: start + k, len: 1, vel: 0.42 })
        else if (ch !== '.' && ch !== '-') ctx.err(`Drum lanes use x X o and . — found "${ch}" in ${where}.`)
      }
      k++
    }
    if (k !== barSteps) ctx.err(`${where[0].toUpperCase() + where.slice(1)} has ${k} steps; a bar here holds ${barSteps}.`)
  })
  return events
}

/* ---------------------------------------------------------------- compile */
/** One note or hit: `t` / `d` seconds into its timeline, voice index `v`, MIDI notes `m` (melodic), glide-from MIDI `g`. */
export interface ScoreEvent {
  t: number
  d: number
  v: number
  vel: number
  s: number
  m?: number[]
  g?: number
}

export interface Section {
  name: string
  trans: number
  start: number
  dur: number
  bars: number
  barDur: number
  tempo: number
  beats: number
  steps: number
}

export interface Timeline {
  events: ScoreEvent[]
  sections: Section[]
  dur: number
}

export interface CompiledSong {
  title: string
  composer: string
  about: string
  tempo: number
  beats: number
  steps: number
  reverb: number
  voices: Voice[]
  intro: Timeline
  loop: Timeline
  errors: ScoreError[]
  patternCount: number
}

interface ResolvedPattern {
  name: string
  ln: number
  raw: Record<string, RawLine[]>
  opts: PatternOpts
  order: string[]
  mute: Set<string>
}

interface CompiledPattern {
  name: string
  tempo: number
  beats: number
  steps: number
  swing: number
  barSteps: number
  bars: number
  perVoice: Record<string, StepEvent[]>
}

export function compile(text: string): CompiledSong {
  const { song, errors } = parse(text)
  const err = (ln: number, msg: string) => errors.push({ line: ln, msg })

  const resolved: Record<string, ResolvedPattern> = {}
  function resolve(name: string, stack: string[]): ResolvedPattern | null {
    if (resolved[name]) return resolved[name]
    const p = song.patterns[name]
    if (!p) return null
    let raw: Record<string, RawLine[]> = {}, opts: PatternOpts = {}, order: string[] = [], mute = new Set<string>()
    if (p.from) {
      if (stack.includes(p.from)) err(p.ln, `Pattern "${name}" builds on itself through "from".`)
      else {
        const base = resolve(p.from, stack.concat(name))
        if (!base) err(p.ln, `Pattern "${name}" builds on "${p.from}", which doesn't exist.`)
        else { raw = { ...base.raw }; opts = { ...base.opts }; order = base.order.slice(); mute = new Set(base.mute) }
      }
    }
    for (const v of p.voiceOrder) { raw[v] = p.raw[v]; mute.delete(v); if (!order.includes(v)) order.push(v) }
    p.mute.forEach((v) => mute.add(v))
    Object.assign(opts, p.opts)
    return (resolved[name] = { name, ln: p.ln, raw, opts, order, mute })
  }

  const compiled: Record<string, CompiledPattern> = {}
  function compilePattern(name: string): CompiledPattern | null {
    if (compiled[name]) return compiled[name]
    const r = resolve(name, [])
    if (!r) return null
    const tempo = r.opts.tempo || song.tempo
    const beats = r.opts.beats || song.beats
    const steps = r.opts.steps || song.steps
    const swing = r.opts.swing != null ? r.opts.swing : song.swing
    const barSteps = beats * steps
    const perVoice: Record<string, StepEvent[]> = {}
    let nBars = 0
    for (const vName of r.order) {
      if (r.mute.has(vName)) continue
      const voice = song.voiceMap[vName]
      const lines = r.raw[vName]
      if (!voice) { err(lines[0].ln, `"${vName}" isn't a voice. Declare it first: voice ${vName} INSTRUMENT`); continue }
      const bars = lines.flatMap((l) => l.bars)
      // report errors on the specific line that holds the bar
      const barLine: number[] = []
      for (const l of lines) for (let k = 0; k < l.bars.length; k++) barLine.push(l.ln)
      const ctx: BarCtx = {
        pattern: name,
        err: (m) => {
          const bm = /bar (\d+)/.exec(m)
          err(bm ? barLine[+bm[1] - 1] || lines[0].ln : lines[0].ln, m)
        },
      }
      perVoice[vName] = voice.drum ? parseDrumBars(bars, barSteps, voice, ctx) : parseMelodicBars(bars, barSteps, voice, ctx)
      nBars = Math.max(nBars, bars.length)
    }
    if (!nBars) err(r.ln, `Pattern "${name}" has no music lines.`)
    return (compiled[name] = { name, tempo, beats, steps, swing, barSteps, bars: Math.max(1, nBars), perVoice })
  }

  const voices = song.voices
  const vIndex: Record<string, number> = {}
  voices.forEach((v, i) => { vIndex[v.name] = i })
  const lastMidi: Record<number, number> = {}

  function timeline(refs: PatternRef[]): Timeline {
    const events: ScoreEvent[] = [], sections: Section[] = []
    let t = 0
    for (const ref of refs) {
      const p = compilePattern(ref.name)
      if (!p) { err(ref.ln, `There's no pattern called "${ref.name}".`); continue }
      const stepDur = 60 / p.tempo / p.steps
      const sw = p.steps % 2 === 0 ? p.swing : 0
      const timeOf = (s: number) => (s + (s % 2 === 1 ? sw : 0)) * stepDur
      const total = p.bars * p.barSteps
      for (let rep = 0; rep < ref.times; rep++) {
        const sIdx = sections.length
        sections.push({
          name: ref.name, trans: ref.trans, start: t, dur: total * stepDur, bars: p.bars,
          barDur: p.barSteps * stepDur, tempo: p.tempo, beats: p.beats, steps: p.steps,
        })
        const evs: ScoreEvent[] = []
        for (const vName in p.perVoice) {
          const voice = song.voiceMap[vName]
          const vi = vIndex[vName]
          for (const e of p.perVoice[vName]) {
            if (e.step >= total) continue
            const t0 = timeOf(e.step)
            const d = timeOf(Math.min(total, e.step + e.len)) - t0
            const ev: ScoreEvent = { t: t + t0, d, v: vi, vel: e.vel, s: sIdx }
            if (!voice.drum) {
              ev.m = (e.notes as number[]).map((n) => n + voice.trans + ref.trans)
              ev.d = Math.max(0.02, d * voice.gate)
              if (e.glide && lastMidi[vi] != null) ev.g = lastMidi[vi] + 0
            }
            evs.push(ev)
          }
        }
        evs.sort((a, b) => a.t - b.t || a.v - b.v)
        for (const ev of evs) {
          if (ev.m) lastMidi[ev.v] = ev.m[ev.m.length - 1]
          events.push(ev)
        }
        t += total * stepDur
      }
    }
    return { events, sections, dur: t }
  }

  let playRefs = song.play, loopRefs = song.loop
  if (!playRefs.length && !loopRefs.length) {
    loopRefs = song.patternOrder.map((n) => ({ name: n, trans: 0, times: 1, ln: song.patterns[n].ln }))
  }
  const intro = timeline(playRefs)
  const loop = timeline(loopRefs)
  if (!intro.dur && !loop.dur && !errors.length) errors.push({ line: 1, msg: 'Nothing to play yet. Add a pattern and a loop line.' })

  errors.sort((a, b) => a.line - b.line)
  return {
    title: song.title, composer: song.composer, about: song.about, tempo: song.tempo,
    beats: song.beats, steps: song.steps, reverb: song.reverb,
    voices, intro, loop, errors, patternCount: song.patternOrder.length,
  }
}
