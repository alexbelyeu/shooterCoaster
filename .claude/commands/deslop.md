# Remove AI code slop

Delete what an AI agent left that a human maintainer would not have written, in the
code as much as in the comments. Builders run this over their branch before every
push that goes to QA.

**Default is delete.** A comment earns its place only by saying something the code,
the names and the test titles cannot. If you are weighing whether one qualifies, it
does not.

**One sentence.** That is the budget for a surviving comment; two only when the
second names a rejected alternative. When a docblock runs four lines, the cut is to
one line, not three.

**Halve it.** A branch's own new comments should come out of this pass at roughly
half what went in. If the count moved by a tenth, the pass was a reread, not a cut.

Cut:

- Comments restating what the next line does, or what the function/test is named.
- Docblocks narrating the mechanism ("lerps the camera, then clamps, then…") when the
  mechanism is the next twenty lines. Keep the decision, drop the walkthrough.
- **Every** comment in a test body. If one seems needed, the title is wrong: rewrite
  the title and delete the comment.
- Multi-paragraph rationale where one line does, and history ("this used to jitter
  because…", "QA asked for…") the reader does not need to act on.
- Defensive checks and try/catch abnormal for that area, especially null checks on
  refs and values the code already guarantees, and guards inside per-frame paths.
- `as any`, `as unknown as`, `// @ts-ignore` and non-null `!` used to get past types.
- Unused exports, props, constants and parameters the branch introduced or orphaned.
- Magic numbers repeated across files that belong in an existing constants module
  (`hitFeedback.ts`, level config, `atmosphere.ts`).
- Any style inconsistent with the file.

Keep only: a non-obvious _why_, a rejected alternative, a tuning rationale for a
magic number a reader would otherwise "fix", or a cross-file invariant the type
system cannot enforce, each in one sentence. Shader code may keep one line per
non-obvious formula.

**Scope is the file, not the diff.** Read every touched file's comments end to end.
Adding two lines to a docblock is licence to delete the other ten. This applies to
prose files too.

**A comment is a claim.** Check every one in the files you touched is still true and
enforced. A docblock promising an invariant nothing constructs is worse than none.

**Count before and after**, per touched source file, so "found nothing" is a
measurement:

```bash
git diff origin/main...HEAD --name-only -- src e2e scripts .github |
  grep -E '\.(ts|tsx|js|mjs|cjs|glsl)$' |
  xargs -I{} sh -c 'printf "%s %s\n" "$(grep -cE "^\s*(//|\*|/\*)" {})" {}' | sort -rn
```

If comments are a large share of a file or of the added lines, the pass is not done.
Re-run `npm test && npm run build` after cutting; commit as `chore: deslop`.

Report at the end with a 1–3 sentence summary of what you changed and the before /
after counts.
