# ShooterCoaster's personality: how the game looks, moves and talks outside the 3D world

Alex, 19 Nov 2026: the UI's accents (a coloured stripe on a card's top edge, glows, a spaced-out caps label over every
title) are tell-tale signs of AI design, so never use them; the game needs its own personality. This file is that
personality. Every screen, HUD element, share card and store graphic follows it, and a PR that adds UI is reviewed
against it (QA's checklist, `branch-review`). The 3D look is `docs/agents/VISION.md` and `docs/art/ENEMIES.md`; this
file is everything drawn over or around it.

## Who we are

**The travelling fair's shooting gallery, bolted to a rollercoaster.** The showman who runs it is loud, warm, quick and
a little cheeky, and everything they own is painted by hand: the boards, the prize tickets, the stars on the targets.
Nothing is glass, nothing glows, nothing is sleek. When the game talks over the ride, it should look like a sign
someone painted for this ride, not like an app's settings panel.

## Where it comes from (look these up before designing something new)

- **Fairground signwriting.** Chunky letters with a painted **block** (the letter's depth, in a darker shade of its
  own colour) and a cast **shadow** (on the board, in near-black), both hard-edged; gold leaf; panels **lined out**
  with a thin line a finger's width inside the edge; shading that follows its own folk logic rather than real light.
  References: Joby Carter, *Signwriting: Tips, Tricks & Inspiration* and *All the Fonts of the Fair* (Carters Steam
  Fair); A. J. Lewery, *The Art of the Signwriters*.
- **The midway shooting gallery.** Painted cast-iron knock-over targets, rows of ducks and stars, prize tickets with
  notched corners, strings of chaser bulbs round the booth.
- **The ride itself.** Enamel-painted boards on the ride's front, chunky operator buttons that physically press down,
  stencilled numbers.
- **Type.** Robert Bringhurst, *The Elements of Typographic Style*, for the scale, measure and spacing. Fair lettering
  breaks rules on purpose; our UI may only break one where the fair would, and never at the cost of reading it on a
  phone at arm's length mid-ride.

## Palette

The house colours are the same on every level; a level's own colour shows only in its name plate on level select
and in the 3D world. Tokens live in `src/app/global.css` `:root` (`--fair-*`).

| Token | Hex | What it is | Use |
|---|---|---|---|
| `--fair-oxblood` | `#5b1220` | The painted board | Panels, boards, the pause and results grounds |
| `--fair-oxblood-deep` | `#3a0a13` | Board in shadow | Secondary plates, empty stars, wells |
| `--fair-gilt` | `#e9b53d` | Gold leaf | Titles, the one main plate, lit stars, the lining |
| `--fair-gilt-block` | `#9a6414` | Gold's block | The block under gilt letters, the gold plate's edge |
| `--fair-vermilion` | `#d9301f` | The fair's red | Danger and loss only: quit confirmations, a missed bystander, the timer's last seconds |
| `--fair-sky` | `#63b7e6` | Fairground sky blue | Information that isn't score: a hint, a new-best line |
| `--fair-cream` | `#f6e7c1` | Lettering ink | Text and numbers on boards and over the ride |
| `--fair-tar` | `#1b110d` | Warm near-black | Shadows, plate edges, text on gilt |
| `--fair-night` | `#1c2147` | The board after dark | A level-select board flipped to its Night Ride, the moon's tile on its switch (#1057) |

Contrast (WCAG): cream on oxblood 11:1, cream on oxblood-deep 13.9:1, tar on gilt 9.8:1, gilt on oxblood 7.2:1, sky on
oxblood 6.1:1. Cream on vermilion is only 3.9:1, so vermilion carries no text under 24 px.
Never a gradient on a surface; the only soft colour change allowed is the dim over the paused ride.

## Type

- **Ultra** (Apache 2.0, fat-face Clarendon, the circus poster and ride-front letter): titles, level names, the score and
  every big number. Always with a block and shadow when it is gilt on a board; cream numbers get the shadow alone.
- **Big Shoulders** (OFL, condensed signage grotesque, variable with an optical size axis): everything else. Plate
  labels at `opsz` 40 and weight 800; text at `opsz` 10, weight 500 to 600.
- **Lobster** stays in the logo's wordmark only (Alex's pick) and on the Theme Park's entrance arch in the world.
- **No Inter** (retired with the score card, #735): it is the default sans of generated pages. The page's own default face is Big Shoulders.
- Scale (px at a 390 px wide phone; desktop the same, the board doesn't grow): 17 hint, 20 to 22 text and small
  plates, 30 to 34 main plate, 40 board title, 52 score. Sentence case for text, title case for plate labels.
  **No letter-spacing and no all-caps labels.** Lines under 60 characters.

## Shapes and surfaces

- **Boards.** Opaque oxblood panels with **notched ticket corners** (a concave quarter circle, 16 px) and a **gilt
  lining** 2 px wide, 9 px in, its corners running parallel to the notches. A board casts a hard shadow (6 px right,
  8 px down, tar, no blur). One board per screen; nothing nests a board in a board.
- **Plates** (buttons). Enamel-painted, 5 px corners, a hard 5 px edge underneath in a darker shade; pressed, the
  plate drops 4 px onto its edge. **One gilt plate per screen**: the thing to do next. Everything else is an
  oxblood-deep plate, smaller, side by side when there's room. Focus: a 3 px cream outline 3 px out.
- **Stars** are the gallery's star targets: gilt with a tar outline when earned, oxblood-deep when not.
- **Over the ride** (the HUD), there are no boards: cream lettering and numbers stand straight on the scene with a
  hard tar shadow, like letters painted on the car (the shared `.fair-over-ride` class; the title's lettering on the park uses it too, so reuse it rather than writing another outline). Nothing covers the middle of the screen during play. Over a pale
  sky a shadow alone isn't enough, so HUD letters also get a tar **keyline** (the signwriter's outline: eight hard
  copies 1.5 to 2 px out, `--hud-ink` / `--hud-ink-thin`), which makes their contrast cream on tar wherever they sit.
  Ultra's counters close up behind a keyline below about 30 px, so the small counts (kills, the combo ring's chain)
  are heavy Big Shoulders. Rings and bars are painted: a tar edge, an oxblood-deep well, the colour laid in with
  square ends.

## Motion

Mechanical and physical, never floaty: a sign swung on its hook, a ticket counter rolling, a button pressed.

- A board arrives by dropping in and swinging once on its hook (about 300 ms, settles; no fade-and-slide): the
  `fair-hook` class in `src/app/global.css`.
- Numbers that change roll like a ticket counter, digit by digit.
- **The one signature moment: the results board's chaser bulbs.** A string of bulbs round the final score chases
  once and holds lit for each star earned. No other screen has bulbs.
- Plates press (60 ms) and spring back. Nothing pulses, breathes or shimmers on its own.
- `prefers-reduced-motion`: boards appear in place, numbers jump, bulbs light without chasing.

## Voice

The showman behind the counter: short, warm, plain verbs, now and then a wink. Never corporate, never cute for
the sake of it, never vague.

| Instead of | Say |
|---|---|
| PAUSED (a label over the title) | the title, then "Ride stopped with 50 seconds to go" |
| Time left 50s | 50 seconds to go |
| Kills 5 / 86 | 5 of 86 hit |
| Esc: resume · ↑↓ + Enter | Esc gets you back on. Arrows and Enter pick. |
| An error occurred | Say what broke and what to do: "The scores didn't load. Your own best is still here." |

Labels on plates stay the plain verb the player expects (Resume, Restart, Settings, Quit, Play): the smoke tests and
the player both find them by name. The showman's voice goes in the lines around them.

## Never (the tells)

These read as generated, whatever the screen. A PR adding any of them is sent back.

- A coloured stripe or accent border on one edge of a card or panel.
- Glows: any `text-shadow` or `box-shadow` with a blur used to make something shine. Shadows here are hard.
- Frosted glass (`backdrop-filter`), and soft grey card shadows.
- Gradients on buttons or panels; pill-shaped buttons.
- A small spaced-out all-caps label above a heading ("PAUSED", "LEVEL", "NEW").
- Strings joined with middle dots ("A · B · C"), labels built as "WORD: fragment" or "WORD — fragment", an arrow
  appended to button text.
- Identical rounded cards in a grid, one radius on everything.
- Monospace for small data labels; Inter or any default system sans.
- Emoji as icons.

`scripts/uiTells.mjs` (run by `npm run lint`) counts these in `src/` and fails when a count goes up; its baseline
only ever goes down as screens move to this file.
