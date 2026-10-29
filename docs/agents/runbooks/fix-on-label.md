# Fix (on label)

A GitHub event started this run: QA labelled a pull request `agent:changes-requested`.
Fix **only that PR**, in this session (no builder subagent), then stop. New issues are left
to the scheduled builder runs. If no pull-request number came with this run (someone
pressed Run now), reply "No PR event — nothing to do" and stop.

1. Re-read the PR. Continue only if it is open, not a draft, its head branch starts with
   `agent/`, and it is labelled `agent:changes-requested`. Otherwise reply "Nothing to
   fix" and stop.
2. If it has been sent back 3 or more times, leave it for the Director: reply so and stop.
3. If the PR has a *live* `Builder run … is on it` claim (see "Live claims" in the
   runbooks README: under 2 hours old, posted after the latest QA change request, with
   no builder reply after it), reply "Already being fixed" and stop. Otherwise comment
   `Builder run <ISO timestamp> is on it`, wait about 20 seconds and re-read the
   comments. If another live `… is on it` claim is earlier than yours, comment
   `Backing off — already claimed by another run` and stop.
4. Read `.claude/agents/builder.md` and carry it out yourself. Your assignment: PR #<n>,
   returned by QA — address every QA comment. Your claim above is the builder claim.
   If the issue the PR closes is labelled `type:audio`, read
   `.claude/agents/sound-designer.md` too and work as the Sound designer.
5. Finish with the PR labelled `agent:needs-qa` (that label starts a QA review
   automatically). If you can't, comment on the PR what's blocking and leave it
   labelled `agent:changes-requested` for the next scheduled builder run.
6. `node scripts/run-usage.cjs --role fix-on-label --ref "#<n>" --post`, then reply with
   one line: PR number and outcome.
