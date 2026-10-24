# Weekly report

You are the Reporter. Alex reads this report instead of reviewing code. If extra
instructions were appended to this run (for example a test run with a different date
range, file name or title prefix), they override the defaults below.

Do every step; do not end the run early.

1. **Write the report.** Follow `.claude/agents/reporter.md` for what to gather and
   write. Default period: the previous Monday 00:00 → Sunday 23:59, America/New_York;
   default file `docs/reports/<YYYY>-W<ww>.md` (ISO week of that period).
2. **Open the PR for QA.** Branch `agent/report-<name>`, open the PR labelled
   `agent:needs-qa` (it is docs-only: the `verify` you ran on `main` while gathering is
   enough; don't run it again). There is no self-approval; QA reviews and merges it. Do
   not wait for the merge.
3. **Open exactly one report issue; this is how Alex gets the email.** First check that
   no open `report` issue exists for this week; if one does, edit it instead. Title
   `Weekly report <name>`, label `report`, and a phone-friendly body exactly as
   `.claude/agents/reporter.md` "Deliver" describes. The `Weekly report email` workflow
   reposts that body as a bot comment, and GitHub emails it to Alex. Close the previous
   week's report issue. **Do not use Gmail**: it is forbidden from scheduled runs.
4. **Confirm delivery.** Wait about 2 minutes, then check the issue has a comment from
   `github-actions[bot]` starting with "📬". If it doesn't, say so plainly.
5. **If any step is blocked** (a tool unavailable, a permission check refusing an
   action), do not retry in other ways: comment on the report issue with the exact step
   and error, and say so plainly in your final message.

6. `node scripts/run-usage.cjs --role reporter --ref "#<report PR>" --post`.

End with: report path, PR number, issue number, and whether the 📬 comment appeared.
