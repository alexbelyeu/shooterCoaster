# Steering — from Alex

This file is Alex's. Agents read it every run and must follow it; it overrides
everything except the hard rules in CLAUDE.md. Agents never edit it, except the
Director may tick a checkbox once an item is fully done.

Alex: edit this from GitHub (web or mobile) — a commit straight to `main` is fine
for this file. You can also open an issue labelled `steering`.

## Knobs

```yaml
pause: false              # true = every scheduled run exits immediately (kill switch)
builder_parallelism: 2    # builder subagents per builder run (1–4). Raise if weekly usage is left over.
builder_runs_per_day: 6   # Builders runs per rolling 24h (scheduled + hand-fired); more are skipped. ~6M tokens each.
qa_parallelism: 1         # PRs reviewed in parallel per QA run (1–2)
ad_budget_usd_per_month: 0  # paid ads cap. Organic first; raise to ~100 after the first organic month. Only Alex spends.
```

## Direction

- [ ] Goal: turn ShooterCoaster into the most polished, exciting browser on-rails shooter possible — "AAA" in feel, cohesion and polish, more levels, better architecture, better everything.
- [ ] Never break the live game. Every week should leave it clearly better than the week before.
- [ ] Sound is key. Rebuild the game's audio, score and SFX, on a port of Scrimshaw Jukebox's Web Audio synth and text score format (`docs/audio/`), in a late-90s Sega arcade rail-shooter style. `type:audio` issues go to the Sound designer. I listen to renders weekly and pick the first theme for each level.

## Notes for the Director

_(Alex adds notes here. Newest first.)_

- 2026-10-29: Sound has been our weakest area. I chose to port Scrimshaw (https://tools.simonwillison.net/scrimshaw-jukebox) as the engine, with an arcade rail-shooter direction (`docs/audio/SOUND-BIBLE.md`) and a Sound designer role (`.claude/agents/sound-designer.md`). Plan the audio epic alongside launch work; don't let it slip behind everything else.
- 2026-10-22: The game's home is now **https://scoaster.com** (public name stays ShooterCoaster). A weekly Marketer grows it: organic first, then a ~$100/month paid test. Analytics: Vercel Web Analytics only.
