# Sound bible

What ShooterCoaster should sound like, and how we check it. The **Sound designer** owns
this file (`.claude/agents/sound-designer.md`). Direction comes from Alex
(29 Oct 2026). Rewrite it as the game's sound takes shape, but only Alex changes the
direction.

## Direction: arcade rail-shooter

Aim for late-90s Sega arcade cabinet energy (House of the Dead, Virtua Cop, Time Crisis;
OutRun for the driving feel). It should be punchy, melodic and confident, mixed so you
could hear it across a loud arcade. Every sound tells the player something.

- **Score:** hooky lead melodies you'd hum after one ride. Driving tempos (roughly 130–175
  BPM). Real chord progressions, with a key change or a lift every 16–32 bars. Big drums.
  Each level has one signature instrument colour.
- **SFX:** loud, short, satisfying and readable under the music. Shooting a target should
  feel like a pinball machine paying out.
- **Never:** muddy pads under everything, polite volume, random beeps, or anything that
  fights the player's attention.
- **Originality:** write *in the spirit of* the references. Never reproduce a real
  game's or song's melody, hook or chord-for-chord progression. That's a copyright problem,
  and hard rule 5 covers sound too: everything is our own synthesis.

## Per level (starting briefs: the sound designer turns these into demos for Alex)

| Level | Biome | Brief | Signature colour |
|---|---|---|---|
| Title | Theme park at night | 20–30 s attract-mode theme that loops: the game's main hook, tells you "press start" | supersaw lead + gated snare |
| level1 | Theme Park | Carnival meets arcade rock. Major key, bouncy, bright | calliope/organ riffs over rock drums |
| level2 | Desert | Driving, sun-bleached. Phrygian or harmonic-minor flavour, hand percussion over a straight kick | twangy guitar, darbuka-style percussion |
| level3 | Ocean | Fast, open, surf-rock energy with a sparkling top | spring-reverb guitar, steel drum, sea wash |
| level4 | Antarctica | Glassy and tense but still driving. Minor key, crystalline | bells, celesta, icy pads with a hard kick |
| level5 | Inferno | Heaviest level, the boss-rush mood. Low and fast | distorted guitar, choir stabs, timpani, orchestra hits |
| FRENZY (5× combo) | any | The level's track lifts: double-time hats, extra lead layer, filter opens | same as the level, brighter |
| Boss / finale | any | A variation of the level theme, darker and louder | the level's colour + orchestra hits |
| Results | any | 3–6 s jingle: rising for 3★, flatter for 1★ or 0★, then a calm loop | bells + brass |

## Mix targets (starting numbers: tune with a decision entry)

These are measured on offline renders, at default settings, with nothing else playing:

| What | Target |
|---|---|
| Music bus alone, integrated | −18 to −16 LUFS (it sits under SFX) |
| Full game mix in a busy combat moment, short-term max | ≈ −14 LUFS |
| True peak, master | ≤ −1.0 dBTP; no clipped samples |
| Single SFX (gun, kill) | peak ≥ 6 dB above the music around it; gun ≤ 150 ms to silence (−60 dB) |
| Low end | nothing below 30 Hz; kick and bass don't mask each other (check the spectrogram) |
| Stereo | lead and kick centred; pads, hats and percussion spread; mono-compatible |
| Loop seams | no click, gap or level jump at the loop point (render across it and check) |

## Rules for SFX

- Each weapon has its own identity: a transient (click/crack), a body (pitched thump or
  noise) and a tail. Auto-fire stays readable at its fire rate and doesn't smear.
- Hits and kills escalate with the combo tier (see `src/audio/sfxDesign.ts`).
  FRENZY gets its own entry sting and a looping lift.
- Musical SFX (stingers, results jingle, wave tell) play in the current key, quantised to
  the beat or bar.
- Ducking: big moments (boss entry, FRENZY, the results reveal) briefly duck the music.
  Gunfire never does.
- Keep a voice budget with priority stealing; no sound may grow the node count without
  bound. The smoke test already checks the node count on the phone run.

## How we check sound, since no agent can hear

1. **Render offline** (the toolkit from the audio epic; until it exists, use the method
   in `docs/audio/reference/README.md`).
2. **Measure** loudness (integrated, short-term max, LRA), true peak, clipping, the
   loop-seam level jump, and band energy (sub / low / mid / high). Compare against the
   targets above and against the previous render.
3. **Look** at the spectrogram PNG: masking, mud, harsh highs, dead air.
4. **Lint** every score: it compiles, every bar adds up, and every note is inside its
   instrument's useful range.
5. **Publish for Alex.** Every audio PR commits short renders (≤ 30 s, MP3, 128 kbps)
   plus a metrics JSON to `docs/audio/renders/`, overwriting the same file names. The
   **How to listen** section of the PR links them. The weekly report links everything
   that changed that week.
6. **Alex's ear is the taste gate.** The first new theme for each level (and the title)
   needs his OK: the sound designer opens a `needs-alex` + `type:audio` listening issue
   with two or three options, and he closes it with his pick. Revisions after that ship
   on measurements, and he steers from the weekly report.
