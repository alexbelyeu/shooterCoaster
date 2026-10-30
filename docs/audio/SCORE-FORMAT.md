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
| Where it plays | its own `AudioContext`, to the speakers | Tone's context, into its own stereo music channel (`AudioEngine.scoreChannel`): music volume, the slow-mo low-pass duck and the master limiter apply |
| Mix bus | `jukebox` voicing: master 0.72 → +2 dB low shelf @180 Hz → −2.5 dB high shelf @7.5 kHz → compressor (−15 dB, 3.2:1) → limiter (−3 dB) → out 1.0 (≈ −9.5 LUFS) | `game` voicing (`GAME_VOICING` in `synth.ts`): 24 dB/oct high-pass at 32 Hz first, the same EQ and compressor, then a −6 dB limiter and out 0.53, so a score lands at −18…−16 LUFS through the music channel with true peaks near −9 dBTP |
| Track changes | stop with a 60 ms fade | 1 s crossfade on a `musicBus` gain, like the Tone.js music |
| Pause | — | a paused run holds its score where it is (`pauseScore`) and resumes from that song position |
| Results | — | the results screen crossfades to the `results` score; Replay crossfades back to the level's |
| Loading | — | the engine and scores are a separate chunk, loaded only under `?audio=scrim` |
| Plucked strings | built on demand, `warm()` in idle slices | the same; a track warms its whole score when it starts (the countdown, for a level) |
| Randomness | `Math.random` | the same in play; offline renders seed it (`createRng`), so the original page and the port render the same score near bit-identically (`renders/parity-*`) |

Not there yet (later issues): named intensity layers (base / +drums / +lead / FRENZY),
beat-quantised stingers, and the arcade instruments (FM bass, supersaw, distorted guitar,
orchestra hit, big kick, gated snare). Each one gets a row here when it lands.

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
  Title, level and results music switch to the score engine; SFX stay as they are.
- `npm run audio:render -- --music <title|level1..5|results> --engine scrim`: a score
  through the game's music chain (`docs/audio/renders/scrim-music-*`).
- `npm run audio:render -- --score <file.scrim | vendored:1..6> [--engine port|original]
  [--voicing jukebox|game]`: one score alone through the port, or through the original
  page for comparison.
