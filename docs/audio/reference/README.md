# Scrimshaw: the reference for ShooterCoaster's audio engine

Alex picked Scrimshaw Jukebox as the model for the game's sound (29 Oct 2026, decision
`docs/agents/decisions/inbox/2026-10-29-audio-scrimshaw-engine.md`). These files are
here so no session has to fetch it again. The shell can't reach the site, and
sessions keep no memory.

| File | What |
|---|---|
| `scrimshaw-jukebox.html` | The complete original page, byte for byte: parser, synth, player and UI in one file. From [simonw/tools](https://github.com/simonw/tools) at commit `5fc8e8b` (2026-10-27). Live at https://tools.simonwillison.net/scrimshaw-jukebox. Blog post: https://simonwillison.net/2026/Oct/6/scrimshaw-jukebox/ |
| `LICENSE-scrimshaw-apache-2.0.txt` | Its licence. Apache-2.0 lets us port it: keep this file, credit it in ported files, and say what we changed. |
| `scrimshaw-llm-prompt.md` | The page's own "Compose with an LLM" prompt, verbatim. It is the best short spec of the original score format. |

This folder is reference material. The game never loads these files: don't import from
here, and don't edit them. The port lives in `src/audio/scrim/`. Our extensions to the
format go in `docs/audio/SCORE-FORMAT.md`, which the engine-port issue creates.

## What it is, in one paragraph

Claude Opus 5.5 designed a plain-text score format and a Web Audio synthesizer, then
wrote six adventure-game tracks in it. The model writes text. The engine makes that text
sound like instruments, with no samples. The format only works because rhythm is just
counting: every bar holds exactly `beats × steps` steps, and the parser reports the line
and step count of any bar that doesn't add up. That error message is what lets an LLM
fix its own score.

## How the engine works

Line numbers refer to `scrimshaw-jukebox.html`.

- **Score parser and compiler**, the `ScrimScore` IIFE (~495–902).
  - `parse` reads settings, `voice` lines, `pattern` blocks and `play`/`loop`.
  - `parseMelodicBars` and `parseDrumBars` turn bars into step events. Notes take dashes,
    `+` stacks notes, `[Dm7]` chords are voiced near the voice's `center`, `~` slides,
    and `!`/`?` set dynamics. Drum lanes use `x X o .`.
  - `compile` resolves `pattern B from A` (copy, then replace voices), `mute`,
    per-pattern tempo/meter/swing, and transposition (`A+2`; drums don't transpose).
    It produces two timelines, `intro` (plays once) and `loop` (repeats). Each timeline
    holds `{t, d, v, m[], vel, g}` events in seconds, with swing applied to odd steps.
- **Synth**, the `ScrimSynth` IIFE (~903–1570). It is built from small helpers:
  - `G` gain, `F` biquad, `O` oscillator (also takes a custom `PeriodicWave` from `WAVES`)
  - `adsr` and `perc` envelopes, `partial` (a decaying sine at a frequency ratio),
    `noise` (filtered burst from one shared 3 s noise buffer), `vibrato`, `metal`
  - `ks`, Karplus-Strong plucked strings. Its buffers are cached per pitch and pre-built
    in idle slices by `warm()`.
- **Instruments.** `INST` holds 38 melodic voices, each a `play(S, out, t, d, f, v, p)`.
  `DRUM` holds 27 percussion voices, each a `hit(S, out, t, v)`. Per family:
  - mallets and bells: inharmonic partial stacks (marimba ×1/×3.98/×9.9, bell ×2.76/×5.4/×8.93)
  - brass and choir: detuned saw stacks through filter or formant chains
  - strings: Karplus-Strong
  - drums: pitch-swept sines plus band-passed noise
  - cymbals: high-passed noise through a peaking EQ
- **Mix bus** (`createSynth`): master gain → low shelf +2 dB @180 Hz → high shelf
  −2.5 dB @7.5 kHz → compressor (−15 dB, 3.2:1) → limiter (−3 dB, 20:1) → out. There is
  one convolution reverb with a procedural impulse response (`makeIR`, 2.8 s, darker as
  it decays) and a 220 Hz high-pass on its send. Each `session(song)` gets its own bus
  and send, so `stop()` can fade out everything already scheduled.
- **Scheduler** (`player.tick`, ~1662). Every 25 ms it schedules events up to
  `currentTime + 0.3 s` (1.6 s while the tab is hidden). The loop restarts seamlessly.
  This is a look-ahead scheduler, not `setTimeout` per note.
- **Offline render** (`renderOffline`, ~1548). It renders a song into an
  `OfflineAudioContext`, feeding events in 0.25 s chunks through
  `suspend()`/`resume()`. `opts.raw` swaps the mix bus for a rough K-weighted
  measurement chain. **This is how an agent "listens":** render, then measure.

## Rendering it from a cloud session (proven 2026-10-29)

Load the page in headless Chromium, compile a track, render it offline, then write the
buffer out as a WAV:

```js
// inside page.evaluate on file://…/scrimshaw-jukebox.html
const song = ScrimScore.compile(TRACKS[4].text);       // song.errors lists bad bars
const buf = await ScrimSynth.renderOffline(song, 20, 44100);
// interleave buf.getChannelData(0/1) into 16-bit PCM and return it as base64
```

Then measure it with ffmpeg:

```
ffmpeg -i x.wav -af ebur128=peak=true -f null -                  # LUFS, LRA, true peak
ffmpeg -i x.wav -lavfi showspectrumpic=s=800x300:scale=log:fscale=log x.png   # spectrogram
```

Read the PNG with the Read tool. "Duel on the Docks" measured −9.5 LUFS integrated,
peak 0.93. That's mastered hot for a standalone player and is too loud for music under
game SFX.

## What the port must change for a game

- TypeScript modules with no DOM or UI. Keep parse/compile pure and unit-testable in
  Node; keep the synth and scheduler free of React.
- Hook into the game's audio graph, not `ctx.destination`. That means the music and SFX
  buses, ducking, the FRENZY slow-mo low-pass, 1 s crossfades between tracks,
  unlock-on-gesture, pause on tab hide, and dispose on level exit (hard rule 8).
- Add an adaptive layer: named intensity layers and stingers quantised to the beat.
  The original only does play-once intro + loop.
- Extend the palette for the arcade direction (`docs/audio/SOUND-BIBLE.md`): FM bass,
  supersaw lead, a distorted guitar via waveshaper, orchestra hit, big kick, gated snare.
  Record every addition in `docs/audio/SCORE-FORMAT.md`.
- Re-voice the mix bus for games. Music sits under SFX, so it needs a lower level, its own
  limiter per bus, and a master true-peak ceiling.
