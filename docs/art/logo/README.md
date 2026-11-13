# Title logo concepts (#476)

Renders of the three logo concepts on the live title, for Alex's pick in the `Look: pick the new logo` issue.
Each is `https://scoaster.com/?logo=<name>` (`src/ui/screens/logo/`); without the param the title keeps the wordmark.

| Concept | Idea | Files |
|---|---|---|
| `bullseye` | The o's of ShooterCoaster are targets; Coaster's takes the hit (gold bull, crosshair) | `bullseye-{desktop,phone}.jpg`, `bullseye-build-in.mp4` |
| `coaster` | A gold rail rides over the letters, up the S and the C and down between them; a car runs it once | `coaster-{desktop,phone}.jpg`, `coaster-build-in.mp4` |
| `loop` | The blend: the rail runs under the wordmark into a loop, and the loop is the target | `loop-{desktop,phone}.jpg`, `loop-build-in.mp4` |

Stills are the last frame of `npm run clip -- --title --logo <name> --seconds 3` (1280×720, and `--size 720x1280` for the
phone, cropped); the MP4s are the first 3 s of the desktop clip cropped to the logo: the build-in, then still.
The follow-up that makes the pick the default deletes this folder.
