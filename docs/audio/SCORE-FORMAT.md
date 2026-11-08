# Score format

The plain-text score format the game's music engine plays (`src/audio/scrim/`). It is the
Scrimshaw format, ported from [Scrimshaw Jukebox](reference/README.md) (simonw/tools
`5fc8e8b`, Apache-2.0). The Sound designer owns this file and records every extension
here.

The original prompt, `reference/scrimshaw-llm-prompt.md`, is the full reference for the
syntax, and **everything in it holds unchanged**: settings, `voice` lines and options,
patterns, `from` / `mute`, melodic and drum bars, chords, dynamics, slides, `%` `_` `=`,
`play` / `loop` with `+N` / `*N`, and every instrument. The port's compiler is pinned to
the original by `src/audio/scrim/score.test.ts` (identical timelines for all six demo
scores, identical error messages). To compose a score for the game, give an LLM
`COMPOSER-PROMPT.md`.

## In one screen

```
title    Midway Rush
tempo    156          # BPM
beats    4            # beats per bar
steps    2            # steps per beat: every bar holds beats × steps = 8 steps
reverb   0.22

voice lead   organ     vol=0.75 pan=-0.1
voice skank  accordion vol=0.35 pan=0.3 center=A4 gate=0.5
voice tuba   tuba      vol=0.8  oct=1
voice kick   kick      vol=0.85

pattern A
lead  | C5 A4 C5 F5- E5 F5 A5 | G5- E5 C5- E5 G5 E5 |
skank | .- [F]- .- [F]- | .- [C]- .- [C]- |
tuba  | F2- C2- F2- C2- | C2- G1- C2- G1- |
kick  | x... x... | % |

play intro
loop A B
```

A note is a step plus one per dash (`D5---` is 4 steps), `.` is a rest, `[Dm7]` a chord
voiced around the voice's `center`, `x X o .` a drum lane. Every bar must add up to
`beats × steps`; the compiler names the line and the count of any bar that doesn't.

## What ShooterCoaster adds or changes

| What | Original | ShooterCoaster |
|---|---|---|
| Where scores live | pasted into the page | `src/audio/scores/<id>.scrim`: `title`, one per level id (`level1`…), `results`; listed in `scores/index.ts` |
| Theme options | — | `scores/themes/<slot>.<name>.scrim`: candidate themes for a slot, waiting on Alex's pick (sound bible "taste gate"; none right now: the folder is read by glob, so a listening round only adds files and their `SCORE_KEYS` rows). `?audio=scrim&theme=<name>[,<name>]` plays each named option in its slot's place (`themesFromQuery`, `scoreIdFor`), arcade SFX included (each option has its own `SCORE_KEYS` entry); the default never changes. Render one with `--music <slot>.<name> --engine scrim` |
| Where it plays | its own `AudioContext`, to the speakers | Tone's context, into its own stereo music channel (`AudioEngine.scoreChannel`): music volume, the slow-mo low-pass duck and the master limiter apply |
| Mix bus | `jukebox` voicing: master 0.72 → +2 dB low shelf @180 Hz → −2.5 dB high shelf @7.5 kHz → compressor (−15 dB, 3.2:1) → limiter (−3 dB) → out 1.0 (≈ −9.5 LUFS) | `game` voicing (`GAME_VOICING` in `synth.ts`): 24 dB/oct high-pass at 32 Hz first, the same EQ and compressor, then a −6 dB limiter and out 0.53, so a score lands at −18…−16 LUFS through the music channel with true peaks near −9 dBTP |
| Track changes | stop with a 60 ms fade | 1 s crossfade on a `musicBus` gain, like the Tone.js music |
| Pause | — | a paused run holds its score where it is (`pauseScore`) and resumes from that song position |
| Results | — | the results screen crossfades to the `results` score; Replay crossfades back to the level's |
| Loading | — | the engine and scores are a separate chunk, loaded only under `?audio=scrim` |
| Plucked strings | built on demand, `warm()` in idle slices | the same; a track warms its whole score when it starts (the countdown, for a level) |
| Randomness | `Math.random` | the same in play; offline renders seed it (`createRng`), so the original page and the port render the same score near bit-identically (`renders/parity-*`) |
| Instruments | 38 melodic, 27 drums | the same, plus the arcade palette below (7 melodic, 5 drums) |
| Intensity layers | — | `layer=base\|drums\|lead\|frenzy` on a voice (untagged = `base`): the level's music follows the combo tier (see below) |

Not there yet (a later issue): beat-quantised stingers. It gets a row here when it lands.

## Intensity layers

A level's score reacts to play. Tag each voice with the layer it belongs to; the game sets
the intensity from the combo tier, and each voice sounds once its layer is in. **`base` is the
whole song as it renders, tune included; the layers only add energy on top of it** (#415): a run
opens on `base` alone, and a lost combo takes the layers away again, so a tune in a higher layer
goes missing for most of a run.

| Intensity | Combo tier | Plays |
|---|---|---|
| 0 | 1× (and the run's start) | `base` (every untagged voice): the whole song, melody included |
| 1 | 2× | + `drums` |
| 2 | 3× | + `lead`: an added line (a doubling, harmony or counter-melody), never the tune itself |
| 3 | 5× FRENZY | + `frenzy`, and the score's low-pass opens |

```
voice skank  accordion vol=0.35 center=A4 gate=0.5   # untagged: base
voice tuba   tuba      vol=0.8  oct=1
voice lead   organ     vol=0.75                       # the riff: base
voice kick   kick      vol=0.85 layer=drums
voice xylo   xylophone vol=0.45 layer=lead            # doubles the riff two octaves up
voice saw    supersaw  vol=0.42 oct=1 layer=frenzy    # doubles the riff an octave up
voice fhat   hat909    vol=0.42 pan=0.4 layer=frenzy  # fills the hats out to straight eighths
```

- **The intro plays every layer**, whatever the combo: it is the countdown's fanfare. The
  loop opens on the run's intensity.
- **Changes land on the loop's beat lines.** A voice's level ramps over 50 ms ending on the
  beat, so nothing clicks and a layer coming in has its downbeat. A rise lands on the next
  beat; a lost combo drops one layer on the next beat and each further layer a bar later,
  so a lost FRENZY winds down over three bars instead of cutting to the bare base.
- **The low-pass ("the filter opens")**: a score with any `layer=` gets a 12 dB/oct
  low-pass after its voices, at 7 kHz below FRENZY; FRENZY opens it to 20 kHz over about a
  beat. A score without tags gets no filter and plays exactly as before (the parity tests
  and `renderOffline` run every layer).
- Every voice keeps playing its notes when its layer is out (silently), so a layer that comes
  in mid-phrase picks the phrase up where it is. The layers are each voice's own level gain:
  no extra nodes; the low-pass is one more per track.
- **Writing for layers**: `base` must carry the loop alone: the tune, bass and a harmonic
  pulse (it plays in every bar, `scores.test.ts` checks it), `drums` the groove, `lead` what
  joins the tune at 3× (an octave doubling, a harmony, a counter-melody, stabs), and `frenzy`
  the lift: double-time hats, an extra lead an octave up or a counter-line. `lintLayers`
  (`scrim/lint.ts`, run on every score by `scores.test.ts`) fails a pitched voice in a higher
  layer that plays higher than every base voice (by its loop's mean top note) without doubling
  one base voice note for note.
  The compressor holds the music's loudness nearly level as layers come in (level1:
  −16.6 LUFS on base, −17 at FRENZY), so the layers add density and brightness, not volume.
- Hear them: `npm run audio:render -- --music level1 --engine scrim --layers <0..3>`
  holds one intensity; `--layers ramp` climbs through every layer and loses the combo
  (`renders/scrim-music-level1` is the ramp, `scrim-music-<id>-base` holds 0 for each level,
  `scrim-music-level1-{full,frenzy}` hold 2 and 3). In the game, `?audio=scrim`.

## Instruments

Every instrument the synth plays. `src/audio/scrim/palette.test.ts` checks this list
against the synth and the compiler both ways, and the ranges below against `lintRanges`.

From Scrimshaw, unchanged (`reference/scrimshaw-llm-prompt.md` says what each one is;
their ranges are in `scrim/lint.ts`):

- Melodic: `steeldrum` `marimba` `vibes` `celesta` `glock` `xylophone` `musicbox` `bell` `organ` `pipe` `harpsichord` `strings` `pizz` `fiddle` `harp` `guitar` `banjo` `upright` `flute` `clarinet` `oboe` `bassoon` `accordion` `trumpet` `brass` `horn` `tuba` `choir` `voices` `pad` `fretless` `synbass` `timpani` `chip` `sine` `square` `saw` `triangle`
- Drums: `kick` `snare` `rim` `hat` `ohat` `ride` `crash` `clap` `conga` `tumba` `bongo` `bongolo` `timbale` `bodhran` `shaker` `tamb` `clave` `block` `cowbell` `guiro` `tri` `tomlo` `tommid` `tomhi` `gong` `thunder` `surf`

### Arcade palette

ShooterCoaster's own instruments for the arcade rail-shooter sound (`SOUND-BIBLE.md`): pure
Web Audio synthesis, each note's nodes disconnected when it ends. Levels are calibrated
against the nearest original instrument (the arcade one sits 0–3 dB louder at the same
`vol`). Hear them in `renders/palette-melodic.mp3`, `palette-drums.mp3` and
`palette-groove.mp3` (scores in `palette/`; `npm run audio:render -- --score
docs/audio/palette/palette-groove.scrim --chain game` renders one through the game's music chain).

| Instrument | Kind | Range | What it is | Defaults and `bright` |
|---|---|---|---|---|
| `fmbass` | melodic | E1–D4 | 2-operator FM bass: sine carrier, sine modulator at 3× (harmonics 1, 2, 4, 5, 7…, no DC). The index jumps on the attack, more with velocity, and falls in ~55 ms: a slap, then a round tone. Write it in octaves 2–3 | reverb 0.05. `bright` scales the FM index and the 2.4 kHz low-pass |
| `supersaw` | melodic | C3–C7 | Seven saws (centre plus ±11, ±23, ±37 cents, the sides panned ±0.55) through a low-pass that snaps open in 20 ms and settles; 140 Hz high-pass; late vibrato. The lead of the title brief | reverb 0.3, attack 6 ms, release 0.18 s. `bright` scales the filter's peak and sustain |
| `distguitar` | melodic | E2–E5 | Saw + square into the voice's own amp: 110 Hz high-pass, asymmetric tanh drive (4× oversampled), 24 dB/oct high-pass at 90 Hz (no DC, no difference-tone rumble), then a cab (−4 dB at 520 Hz, +3 dB at 1.9 kHz, low-passes at 4.6 and 6.2 kHz). A voice's notes share one amp, so `E2+B2` is a real power chord. `gate=0.5` for chugs | reverb 0.15. `bright` scales the cab low-passes |
| `orchhit` | melodic | C2–C6 | Orchestra stab: two brass saws, two string saws an octave up, a square an octave down and a bow-noise burst. Fixed ~0.5 s decay whatever the length; play chords (`E4+G4+B4`, `[Em]`) | reverb 0.4. `bright` scales the attack's filter |
| `synbrass` | melodic | E2–E6 | 90s synth brass: two saws (±7 cents) and a sub square, a 3% scoop into the pitch, a resonant filter that swells over 70 ms; late vibrato. Stabs and pads | reverb 0.25, attack 25 ms, release 0.14 s. `bright` scales the filter swell |
| `riser` | melodic | C3–C7 | Transition sweep as long as the written note: band-passed noise plus a saw climbing from half the note to 8× it, getting louder, cut at the end. `C6-------` is a one-bar riser at 8 steps | reverb 0.45. `bright` scales the top of the sweep |
| `downlifter` | melodic | C3–C7 | The riser backwards: starts loud at 8× the note and falls to half of it over the written length | reverb 0.45. `bright` scales the start of the sweep |
| `bigkick` | drum | — | Sine diving 210 → 60 Hz in 45 ms and settling at 50 Hz, damped by 0.3 s, with a knock and a click. Bigger than `kick`; keep the bass off its notes' lowest octave | reverb 0.04 |
| `gatesnare` | drum | — | Snare with a gated-reverb tail: dense noise held ~220 ms, then shut. Has its own room, so keep `rev` low | reverb 0.08 |
| `hat909` | drum | — | Tight, bright 909-style closed hat: more noise than ring | reverb 0.08 |
| `ohat909` | drum | — | The open version, ~0.6 s. There is no choke group: a closed hat doesn't cut it | reverb 0.12 |
| `clap909` | drum | — | Four quick taps and a short tail around 1.2 kHz | reverb 0.2 |

## House rules for game scores

These are not enforced by the compiler; `src/audio/scores/scores.test.ts` checks the first two.

- **Compiles clean and in range.** No errors, and every note inside its instrument's
  useful range (`lintRanges` in `scrim/lint.ts`).
- **Intro once, then a loop.** Every score has a `play` intro and a `loop`.
- **Bass in octaves 2–3.** Write the line in octave 1–2 with `oct=1` on the voice, or
  write it an octave up. Anything under ~45 Hz costs headroom and reads as mud under the
  SFX; the game voicing cuts below 32 Hz anyway.
- **Leave the mids for SFX.** The gun and kill sounds live at 300 Hz–3 kHz.
- **Measure, don't guess:** `npm run audio:render -- --music <id> --engine scrim`
  renders a score through the game's chain and checks it against the sound bible's targets.

## Hearing and rendering it

- In the game: add `?audio=scrim` to the URL (e.g. `https://scoaster.com/?audio=scrim`).
  Title, level and results music switch to the score engine, and the SFX to the arcade engine.
  Add `&theme=<name>` for a theme option during a listening round, comma-separated for
  options in different slots (`?audio=scrim&theme=<name>,<name>`); with no options in
  `scores/themes/`, it does nothing.
- `npm run audio:render -- --music <title|level1..5|results|<slot>.<name>> --engine scrim`: a score
  through the game's music chain (`docs/audio/renders/scrim-music-*`). Add `--seam` to start
  10 s before the first loop seam, so the render crosses it (a 32-bar loop is longer than a
  30 s render). A seam render starts inside the loop, which opens on intensity 0, so a score
  with `layer=` tags plays its base alone there: add `--layers 3` to hear every layer cross the seam.
- `npm run audio:render -- --score <file.scrim | vendored:1..6> [--engine port|original]
  [--voicing jukebox|game]`: one score alone through the port, or through the original
  page for comparison. Add `--chain game` to play a score file through the game's music
  chain instead, measured like a level's score (`--seam` works here too).
