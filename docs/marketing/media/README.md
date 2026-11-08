# Marketing media

Gameplay clips for launch posts, rendered from the real game by `npm run clip`
(`scripts/clip.mjs`). Nobody records a screen: the headless rig renders in virtual time,
one frame per 1/30 s of game time, and ffmpeg assembles the clip. All of it is our own
render of our own game, so no licence or attribution is needed (not a third-party asset,
nothing for `docs/ASSETS.md`).

| File | What |
|---|---|
| `clip-level1-1280x720.mp4` | 19 s, 1280×720, 30 fps, H.264, silent, ~3 MB. Title fly-by → PLAY → level select → Theme Park ride from track fraction 0.42: under the Ferris wheel, balloons popping with muzzle flash and hitmarkers, combo climbing to ×5 FRENZY, fireworks bursting over the midway on the kill streaks. The one to attach to posts |
| `clip-level1-1280x720.gif` | The first 8 s of that ride, 480 px wide, 15 fps, ~7 MB, for forums that only take GIFs (over a 4 MB upload cap, attach the MP4 or a still instead). The last GIF committed here: re-renders keep theirs out of git (below) |
| `clip-level1-1280x720-{start,mid,end}.jpg` | First, middle and last frame of the MP4, to check the clip without a video player |
| `clip-level1-720x1280.mp4` | The vertical cut for TikTok / Shorts / Reels: 16.4 s, 720×1280 (9:16), 30 fps, H.264, silent, ~2.9 MB. The phone view (touch layout, portrait FOV, gun low right), opening on the ride already moving at track fraction 0.42, balloons popping, combo climbing to ×5 FRENZY, ending on fireworks over the midway at ×5. No intro or level select, no GIF |
| `clip-level1-720x1280-{start,mid,end}.jpg` | Its first (ride moving), middle (×3 combo, kill confetti) and last (×5 FRENZY, fireworks) frames |
| `clip-title-1280x720.mp4` | The title screen (#419): 9 s, 1280×720, 30 fps, silent. The cold load's first 9 s: the park orbit with the coaster running round it, then the swoop down to the chase shot |
| `clip-title-attract-1280x720.mp4` | Attract mode (#419, after 30 s idle): 9 s, letterboxed, the camera blends from the menu to the chase behind the train and the trackside crane |
| `clip-title-720x1280.mp4` | The title on a phone (portrait, touch layout), 9 s from the cold load |
| `clip-title-*-mid.jpg` | The middle frame of each title clip |

How it was made (first render 2026-10-28, #100; re-rendered 2026-11-02 on `main` @ 8e66045 by the Marketer after fireworks #222, the Golden Blimp #219, weapon pickups #266 and the HUD changes landed — 17 kills, score 555, seed 1337): `npm run build && npm run clip` with the defaults:
`--level level1 --from 0.42 --seconds 15 --fps 30 --size 1280x720 --seed 1337`. Autofire
plays the ride; nothing is staged except the start point. The seed pins enemy spawns and
`Math.random`, and time is virtual, so re-running renders the same clip (up to a few
frames of difference in the title fly-by, whose start depends on how long the page took
to boot).

**Re-render for a launch or marketing push only**, not after every visible change: git keeps
every committed version for good, so each re-render adds its MP4 and stills (~3.4 MB) to the
repo's history. Commit them in the PR for that push.
`npm run build && npm run clip` (cloud sessions: `export SC_CHROME="$(scripts/ensure-browser.sh)"`
first; needs ffmpeg: `apt-get install -y ffmpeg`). ~15 min on a 2-core session; the frames
stay in `e2e-results/clip/<size>/` and `npm run clip -- --encode-only` re-encodes them.

**The GIF is not committed** (twice the MP4's size, from the same frames): the render writes it
to `e2e-results/clip/<size>/clip-<level>-<size>.gif` (gitignored); attach it from there. Without
the frames, make one from the committed MP4 (`-ss` is where the ride starts, ~4.4 s in with the
default intro and level select):
`ffmpeg -ss 4.4 -t 8 -i clip-level1-1280x720.mp4 -vf "fps=15,scale=480:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" clip.gif`

The vertical cut (first render 2026-11-06, #309, 17 kills, score 611, seed 1337):
`npm run build && npm run clip -- --size 720x1280 --ride-only --seconds 16.4`, the other options at their defaults.
A portrait `--size` emulates touch, so the page shows the phone layout (no keyboard hints), and makes no GIF;
`--ride-only` plays the title and level select uncaptured, so the clip opens on the ride. `--seconds 16.4` ends on the
fireworks at ×5, before the combo lapses at ~17.5 s. Platform captions and buttons cover the bottom ~20 % and the right
~15 % of a vertical video: there the combo meter (bottom centre) and the gun's stock sit; score and timer are clear.
The title clips (first render 2026-11-08, #419): `npm run build && npm run clip -- --title --seconds 9` (add `--attract`
for attract mode, `--size 720x1280` for the phone). `--title` captures the title alone from its first frame; 9 s keeps one
render under ~4.5 min on a 2-core session. Of their stills, only the middle frames are committed.
Other levels: `--level <id> --from <0–1>`, e.g. `npm run clip -- --level level2 --from 0.3`;
the clip stars every level before it, so the level select opens with it unlocked and focused.
