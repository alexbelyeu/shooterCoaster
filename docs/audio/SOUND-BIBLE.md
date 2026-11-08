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

**What the first round (#301) taught us.** Alex picked the most direct option in each slot: "Neon
Marquee" for the title (a supersaw hook in bar 1 over four-on-the-floor electronic drums), and he
kept "Midway Rush" for level1 (one fairground instrument on the riff, a skank and a bass that each
do one job, a rock beat). He passed on the grander fanfare and the gentler shuffle. So every level
option leads with its hook in the first bars of the loop, keeps one signature instrument on it,
drives at 134–176 BPM and lifts for its last 8 bars. The variety goes into the idea, not the polish.
Every option is also written in intensity layers, so the pick drops in as the level's score as it is.

**Level 2–5 picks (#391).** Alex picked one of three options per world, and they are now
`src/audio/scores/level2…5.scrim`: level2 "Dune Rider" (F minor, 168, desert trance: harpsichord
ostinato through the Phrygian ♭II, supersaw hook), level3 "Lagoon Run" (G major, 150, steel-drum
calypso over marimba and a tumbao bass), level4 "Aurora" (D minor, 134, vibraphone over pizzicato and
choir, timpani), level5 "Hellgate" (C minor, 150, string ostinato, brass and horns in octaves, gong).
He took the most Neon-like, the sunniest, the calmest and the most "final boss" option, and passed
on both options marked closest to their brief (`sidewinder`, `glacier`): a level's theme can lean on
mood as much as on its biome's instruments.
Each keeps its hook in `base` (layers only add, #415): the doubling or stabs come in at 3×.

| Level | Biome | Brief | Signature colour |
|---|---|---|---|
| Title | Theme park at night | Attract-mode theme: the game's main hook inside the first 4 bars, a 1–2 bar intro that says "press start", then a 32-bar loop (≈ 45–50 s) with a lift. Gated snare and big electronic drums | supersaw lead + gated snare |
| level1 | Theme Park | Carnival meets arcade rock. Major key, bouncy, bright: a fairground instrument carries the riff (calliope pipe, drawbar organ, xylophone), rock drums and FM bass drive it, and the loop lifts for its last 8 bars | calliope/organ riffs over rock drums |
| level2 | Desert | Driving, sun-bleached. Harmonic minor (the ♭6 to leading-tone step, a major V) or a Phrygian ♭II. A darbuka rhythm (maqsum, saidi) on tumba doum and bongo tek sits in the base layer, over a straight kick | twangy guitar or a reed (oboe), darbuka-style percussion |
| level3 | Ocean | Fast, open, surf-rock energy with a sparkling top. Wet guitars (high `rev`), a `surf` wave every 4–8 bars in the base layer, offbeat strums, and a bright top line (tremolo picking, steel drum, glockenspiel) | spring-reverb guitar, steel drum, sea wash |
| level4 | Antarctica | Glassy and tense but still driving. Minor key, crystalline: mallets an octave or two up, pads quiet and high (they fill the SFX mids fast), and a hard bigkick so it never floats | bells, celesta, icy pads with a hard kick |
| level5 | Inferno | Heaviest level, the boss-rush mood. Low and fast, but with gaps in the low end: the bass follows the guitar's chug rhythm instead of droning, and double-kick sixteenths stay in fills, or kick, bass and chug blur into one wall below 250 Hz | distorted guitar, choir stabs, timpani, orchestra hits |
| FRENZY (5× combo) | any | The level's track lifts: double-time hats, extra lead layer, filter opens (the score's `frenzy` layer: `SCORE-FORMAT.md`, "Intensity layers") | same as the level, brighter |
| Boss / finale | any | A variation of the level theme, darker and louder | the level's colour + orchestra hits |
| Results | any | 3–6 s jingle: rising for 3★, flatter for 1★ or 0★, then a calm loop | bells + brass |

**Picked themes (#301):** the title is "Neon Marquee" (A minor, 160, supersaw hook over a
four-on-the-floor bigkick, gated snare and FM bass; the lift replays the hook a tone up). level1
stays "Midway Rush" (F major, 156): keep its character (organ riff, accordion skank, oom-pah tuba
over a rock beat) in any polish. Levels 2–5 get their own listening round.

## Mix targets (starting numbers: tune with a decision entry)

These are measured on offline renders, at default settings, with nothing else playing:

| What | Target |
|---|---|
| Music bus alone, integrated | −18 to −16 LUFS (it sits under SFX) |
| Full game mix in a busy combat moment, short-term max | ≈ −14 LUFS |
| True peak, master | ≤ −1.0 dBTP; no clipped samples |
| Single SFX (gun, kill) | peak ≥ 6 dB above the music around it (each kill of a `--mix` render against the same mix rendered without SFX, ±0.3 s); gun ≤ 150 ms to silence (−60 dB) |
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
  bound. The smoke test checks the node count on the phone run, and the arcade engine's
  budget under `audioBurst(64, 32)`.
- The arcade engine (`?audio=scrim`, `src/audio/arcade/`) bakes every one-shot from the score
  engine's own instruments when a level starts, so SFX and music share one palette and key.
  Positional: kills and hits pan with the enemy's place on screen and dull with distance (their louder channel keeps
  its level wherever they pan, so a kill at the crosshair is not 3 dB down: `panGain`); each
  biome has its own room on the SFX send. Guns stay dry.

## How we check sound, since no agent can hear

1. **Render offline** with `npm run audio:render` (music, an SFX sheet or a scripted
   combat mix; see CLAUDE.md "Commands"). `npm run audio:check` measures any file.
2. **Measure** loudness (integrated, short-term max, LRA), true peak, clipping, the
   loop-seam level jump, and band energy (sub / low / mid / high). Compare against the
   targets above and against the previous render; `BASELINE.md` has the starting point.
   The targets live in code too (`scripts/audio/metrics.mjs`): change both together.
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
