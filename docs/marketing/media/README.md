# Marketing media

Gameplay clips for launch posts, rendered from the real game by `npm run clip`
(`scripts/clip.mjs`). Nobody records a screen: the headless rig renders in virtual time,
one frame per 1/30 s of game time, and ffmpeg assembles the clip. All of it is our own
render of our own game, so no licence or attribution is needed (not a third-party asset,
nothing for `docs/ASSETS.md`).

| File | What |
|---|---|
| `clip-level1-1280x720.mp4` | 19 s, 1280×720, 30 fps, H.264, silent. Title fly-by (2.5 s) → PLAY → level select → Theme Park ride from track fraction 0.42: under the Ferris wheel, balloons popping with muzzle flash and hitmarkers, combo climbing to ×5 FRENZY. The one to attach to posts |
| `clip-level1-1280x720.gif` | The first 8 s of that ride, 480 px wide, 15 fps, for forums that only take GIFs |
| `clip-level1-1280x720-{start,mid,end}.jpg` | First, middle and last frame of the MP4, to check the clip without a video player |

How it was made (2026-10-28, #100): `npm run build && npm run clip` with the defaults:
`--level level1 --from 0.42 --seconds 15 --fps 30 --size 1280x720 --seed 1337`. Autofire
plays the ride; nothing is staged except the start point. The seed pins enemy spawns and
`Math.random`, and time is virtual, so re-running renders the same clip (up to a few
frames of difference in the title fly-by, whose start depends on how long the page took
to boot).

**Re-render** after a visible change to level 1, the title or the HUD:
`npm run build && npm run clip` (cloud sessions: `export SC_CHROME="$(scripts/ensure-browser.sh)"`
first; needs ffmpeg: `apt-get install -y ffmpeg`). ~15 min on a 2-core session; the frames
stay in `e2e-results/clip/<size>/` and `npm run clip -- --encode-only` re-encodes them.
A vertical cut for Shorts / Reels: `npm run clip -- --size 720x1280` (not committed yet).
Other levels: `--level <id> --from <0–1>`.
