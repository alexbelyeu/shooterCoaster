# Baseline: how the game sounds before the audio overhaul

Rendered 30 Oct 2026 (#213) from the Tone.js engine on `main`, with `npm run audio:render`
at default settings (music volume 0.7, SFX 0.8). Every file is in `renders/` as
`baseline-*.{mp3,json,png}`; the JSON has every number below and more. Re-render any of
them with the command in its row and compare: the renders are deterministic (two runs
gave identical metrics).

Level music is rendered at intensity 0.45, which is where `MusicController` starts a run:
pad + bass (+ the offbeat noise tick on the Theme Park). The lead only joins above 0.5,
once a combo builds, so it is in the mix render but not in the level renders.

## Numbers against the targets

Targets from `SOUND-BIBLE.md`. Music: −18 to −16 LUFS integrated. Combat mix: short-term
max ≈ −14 LUFS. Everything: true peak ≤ −1 dBTP, no clipped samples, energy below 30 Hz
≤ −30 dB relative to the total, loop seams within 1 dB of a bar line inside the loop.

| Render | Command | Integrated | Short-term max | True peak | Below 30 Hz | Seam vs bars | Bands sub / low / mid / pres / air |
|---|---|---|---|---|---|---|---|
| Title | `--music title` | **−21.6** ✗ | −21.3 | −8.9 ✓ | −39.5 ✓ | −0.04 ✓ | 0 / 51 / 48 / 0 / 0 % |
| Theme Park | `--music level1` | **−42.4** ✗ | −41.9 | −27.9 ✓ | −38.8 ✓ | 0.02 ✓ | 5 / 94 / 1 / 0 / 0 % |
| Desert | `--music level2` | **−44.3** ✗ | −45.9 | −28.0 ✓ | −33.0 ✓ | 0.07 ✓ | 50 / 50 / 0 / 0 / 0 % |
| Ocean | `--music level3` | **−43.1** ✗ | −44.5 | −28.3 ✓ | −40.7 ✓ | 0.06 ✓ | 0 / 98 / 1 / 0 / 0 % |
| Antarctica | `--music level4` | **−45.1** ✗ | −49.6 | −28.3 ✓ | −33.5 ✓ | 0.01 ✓ | 46 / 53 / 1 / 0 / 0 % |
| Inferno | `--music level5` | **−42.4** ✗ | −42.1 | −28.0 ✓ | −33.9 ✓ | 0.00 ✓ | 24 / 76 / 1 / 0 / 0 % |
| SFX sheet | `--sfx-sheet` | −32.9 | −31.4 | −11.7 ✓ | **−17.0** ✗ | — | 11 / 44 / 26 / 15 / 3 % |
| Combat mix, level 1 | `--mix level1` | −30.7 | **−29.7** ✗ | −10.4 ✓ | **−28.2** ✗ | — | 3 / 48 / 24 / 17 / 10 % |

No render clips. Every render is mono (stereo correlation 1.000): nothing is panned.

SFX sheet, one sound at a time (peak, then time until it stays under −60 dBFS):

| Sound | Peak dBFS | To silence |
|---|---|---|
| Fire, single shot / auto-fire | −25.0 / −31.1 | 90 / 75 ms ✓ (≤ 150) |
| Hit tick | −23.8 | 25 ms |
| Kill 1× / 2× / 3× / 5× | −16.8 / −12.5 / −12.1 / −12.1 | 50 / 195 / 205 / 366 ms |
| Combo break | −27.2 | 110 ms |
| Wave stinger / boss arrival | −24.7 / −18.8 | 0.7 / 1.3 s |
| Boss hit / boss defeat | −17.3 / −14.3 | 0.16 / 1.2 s |
| Firework whistle / pop | **−51.2** / −19.6 | 1.0 / 0.2 s |
| Star chimes 1–3 | −21 | 0.5 s |

## What the spectrograms show

**Title.** The loudest track by 20 dB, and still 4–6 dB under the music target. A solid
wall from 20 Hz to ~350 Hz (triangle bass under a sine pad) carries half the energy, with
the music-box melody stepping around 500–900 Hz and the random chimes as dots at 1.5–3 kHz.
There is almost nothing above 2 kHz, so it sounds soft and dull rather than "press start",
and at 108 BPM it is under the bible's 130–175.

**Theme Park (level 1).** About 25 dB under the target: a player hears it as near-silence
under the SFX. The spectrogram is a low smear of pad and bass under 330 Hz with a thin
full-band noise tick on every offbeat; 94% of the energy sits in 60–250 Hz. There is no
melody at the starting intensity, and no calliope or rock drums.

**Desert (level 2).** Half the energy is below 60 Hz (the A1 bass at 55 Hz), the pad
plays in two of every four bars with dark gaps between, and nothing rises above ~400 Hz
except the bass's attack clicks. No percussion, no twang: it reads as a low drone at 82 BPM.

**Ocean (level 3).** A continuous pad band at ~100–350 Hz with paired bass notes; 98%
of the energy in the low band and none of the sparkling top end the brief asks for.

**Antarctica (level 4).** The quietest track (−45.1 LUFS). The pad rests every other
bar and dies away before the next chord, so 8% of the render is digital silence and the
loudness range (4.5 LU) is mostly those gaps. Nearly half the energy is under 60 Hz; no
bells or celesta.

**Inferno (level 5).** The most regular part (bass eighths at 140 BPM), but nothing
above ~400 Hz apart from the bass's transients and no drums at all, so "the heaviest
level" is a quiet low hum.

**SFX sheet.** The gun is short and clean (90 ms to silence, a 1.1 kHz → 260 Hz sweep),
the kill layers stack as designed and peak 12 dB above the gun. Two problems are plain on
the spectrogram: every membrane thump (kill 2×+, boss hit, boss defeat on C1, firework
pop) has a tail sweeping down into 20–30 Hz, which is why the sheet carries −17 dB below
30 Hz; and the firework whistle is a faint diagonal at −51 dBFS, effectively inaudible.

**Combat mix (level 1).** The busiest moment the game has is 15 dB under the −14 LUFS
target. Auto-fire draws a picket fence of sweeps at 0.3–1.5 kHz and the kill thumps
dominate the lows; the music is barely visible underneath. The FRENZY duck at 12.1 s does
not show, because the music is already ~20 dB under the SFX. Against the "SFX ≥ 6 dB
over the music" rule, the kills pass easily (−12 dBFS over music peaks of −28 dBTP), the
single shot only by ~3 dB, and auto-fire (−31 dBFS) not at all.

## So the overhaul starts from

- Level music needs ~+25 dB and the title ~+5 dB to reach −17 LUFS, and the mix ~+15 dB.
  The level synths sit at −22 to −26 dB with pad velocity 0.3 behind a −10 dB music
  channel; the master limiter at −1 dB never engages.
- No track has presence or air (2–6 kHz and up is ~0%), no drums outside the title's
  tambourine and level 1's tick, nothing panned, and five of six tracks are under 110 BPM.
- High-pass the membrane thumps (or stop their pitch sweep above 30 Hz) and give the
  firework whistle ~25 dB.
