## 2026-11-08 — Picked level 2–5 themes are the default, with the hook in `base` (Sound designer, #392)

**Context:** Alex picked `dunerider`, `lagoon`, `aurora` and `hellgate` (#391). The options were written with the
hook on `layer=lead` (heard only from a 3× combo), which #415 rules out: level scores keep their melody in `base`,
layers only add. #415 had not merged yet.
**Decision:** each pick replaced `level2…5.scrim` with its hook voice untagged (`base`), and the voice that doubled or
answered it moved down one layer to `lead` (Dune Rider's octave-down twang, Lagoon Run's horn stabs, Aurora's bell;
Hellgate's horns were already `lead`), so 3× still adds a line. FRENZY keeps its hats (and Hellgate's choir) plus the
filter opening. The full-mix renders are unchanged by the retagging. Every option file, its `SCORE_KEYS` row and its
renders are deleted; `SCORE_KEYS` holds each pick's key.
**Consequences:** at FRENZY, Dune Rider, Lagoon Run and Aurora add only hats and the open filter. A follow-up can
write a FRENZY counter-line for them if it feels thin in play.
