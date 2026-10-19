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
qa_parallelism: 1         # PRs reviewed in parallel per QA run (1–2)
```

## Direction

- [ ] Goal: turn ShooterCoaster into the most polished, exciting browser on-rails shooter possible — "AAA" in feel, cohesion and polish, more levels, better architecture, better everything.
- [ ] Never break the live game. Every week should leave it clearly better than the week before.

## Notes for the Director

_(Alex adds notes here. Newest first.)_
