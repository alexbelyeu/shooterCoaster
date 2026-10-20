---
name: branch-review
description: Senior architect review of a ShooterCoaster branch. Questions whether the solution is the right approach, not just whether it works. Checks it reuses the game's existing systems, follows CLAUDE.md, and deletes what it makes obsolete instead of building on top.
---

# Skill: Branch Review

Review this branch as if it ships to every player the moment it merges and you are
the last line of defence. Your job is not to check that the code runs; it is to ask
whether this is the **right solution** and whether it leaves the game better than it
found it.

## We own the entire game

There are no external consumers and no compatibility to preserve. If the right fix
changes the level config, the spawner, the store and the HUD, do all four. Never
settle for a workaround in one system because another is "harder to change".
Delete old code instead of aliasing or wrapping it.

Agents default to building on top: new options, wrappers and parallel systems to
avoid touching existing code. This review exists to counteract that.

## Process

1. **Intent.** Write one sentence: what is this branch trying to accomplish?
2. **Right approach?** Given we own every layer, is this the best way? Would a
   different structure (a level-config field instead of a special case, a shared
   system instead of a one-off component) be cleaner, even if more files change?
3. **Reuse before you build.** Does it duplicate something the game already has?
   Check especially: `eventBus` for cross-system signals, the bullet pool and pooled
   explosions, `InstancedMesh` decorations, `LevelRegistry` configs and
   `scoring.ts`, `atmosphere.ts` per-biome settings, `trackDimensions`, the zustand
   stores, `pointerInput` as the single input source, `hitFeedback.ts` constants,
   the e2e hook. A second way of doing an existing thing is a high finding.
4. **Complexity added vs removed.** Count new components, options, flags, stores and
   parameters. A branch that adds three knobs to avoid restructuring one function has
   the wrong trade-off. `enableX` booleans usually mean two things are coupled.
5. **Separation.** Gameplay rules in stores and pure modules (unit-testable, no
   React/three imports); rendering in components; per-level differences in level
   config, not `if (levelId === …)` branches scattered through systems.
6. **Deletion.** Anything the branch makes unreachable or redundant (old effects,
   unused props, dead constants, superseded components) must be deleted in the same
   branch.
7. **Conventions.** Against CLAUDE.md: hard rules (no removed features, budgets,
   assets and licences, disposal, no per-frame allocations, flags for big rewrites),
   code map placement, the level-design skill for anything visual or level-related,
   tests for pure logic, docs and the decisions inbox updated.
8. **Player-facing quality.** Does it fit the game's look and feel across all biomes,
   on desktop and on a phone in portrait and landscape? Is it obviously better, or
   just different?

## Report Format

```markdown
# Branch Review: `<branch-name>`

**Intent:** <one sentence>
**Verdict:** Ship as-is / Needs changes / Needs rethink

## Findings

### <Finding title> [severity: high/medium/low]

**What:** <what was observed>
**Why it matters:** <consequence if shipped as-is>
**Fix:** <concrete change: files and approach, across whatever systems need to change>

## Convention Violations

<CLAUDE.md / skill violations, with file:line>

## What's Good

<One or two lines.>
```

High severity means it should not merge as-is: a duplicated system, a hard-rule
violation, an approach that will have to be ripped out, or a clear player-facing
regression. Use medium/low for everything else. If the branch is clean, say so in
one line and stop.
