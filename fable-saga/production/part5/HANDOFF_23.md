# Hand-off at 23.0 (from s4_spent.js → s5_dawnbreak.js)

Owner of 0–23 s: animator 1 (s1–s4 and the engine). Owner of 23–40 s: animator 2 (s5, s6).
This is the picture on the last frame of my range, frame 689 (t = 22.9667). Frame 690 (t = 23.0) is yours: it is
the DAWNBREAK HIT, so a cut on the impact frame is fine. Match the positions and poses below so the transformation
reads as happening *to this body, on this slab, under this blade*.

All coordinates are **world** coordinates (the same space `h5F` keys use). Screen = `vX(V, x)`, `vY(V, y)`.

## Camera at 22.9667
`V = { x: 250, y: 140, z: 1.0 }` (no roll). The shot 22.3–23.0 is a slow push-down onto the pin with a growing tremor
(`shk` up to 1.6).

## World
- `w5Night(t, 40 + V.x * 0.2, 60 + V.y * 0.2, {})`: indigo night with stars.
- The broken moon is far behind, upper left, in two halves.
- A thin line of first light crosses the frame at world y 190, fully lit at 23.0 (the dawn waiting). Your burning
  horizon can grow out of it.
- **The slab of sky:** `slabPts(vX(V,110), vX(V,410), vY(V,210), 0, 50*V.z, 31)`, carrying the dawn world (`'dawn'`), with a bevel.
  Its top surface is at world y = 210, running x = 110…410. Cracks in it radiate from the blade's point at (262, 212).

## The hero (pinned)
- Position (276, 176): `PH = [276, 181]`, raised 5 px as it pulls itself up the blade. Scale `S: 3`.
- Pose:
  - `form: 'plain'` (coral, light nearly out, `cr: 1`, faint warmth from the four sparks it absorbed);
  - `a: 0.04`, `sq: 0.14`, `eyes: 'angry'`, legs braced on the slab.
- Hands:
  - **The broken hilt** is in its sword hand: `sw ≈ 0.5`, the stub of 9 units (`swst: 'stub'`, `swl: 9`). Keep it, or let Dawnbreak grow its new blade out of it.
  - **The other arm** grips the black blade: `arm2: [-2.25, 10, 1]` (sprite-local angle, length, fist).
- A tremor of about 2 px (`z5Sh`).
- The wound: the black blade enters at its left shoulder, about (245, 157), where it glows crimson-white.

## The Hollow (standing at the blade)
- Position (173, about 72), bobbing ±2. Scale `S: 3`.
- Pose:
  - `form: 'hnova'` (black star body, white fire, void wings), `flip: false` (it faces right, toward the hero);
  - `nosw: true`, `arm: 0.5` (the blade hand reaches down-right), `a: 0.14`, `eyes: 'wide'`.
- Wings: `spread: 1`, `flap: 0.14`. Fire and light at half: `aur: 0.6`, `glow: 0.5`.
- **Its blade:** a `bigBlade(form: 'void')` from its hand (about 3 px past `E.hand`) down to the point at world
  (262, 216) in the slab, `w = 5*(1 - 0.25*drain)` with `drain = 1` at 23.0. Its cracks are at full (`cracks: 2.4`), and white
  light runs down it into the hero (the hero is already drinking it).

## Timing notes
- The music is a rising tremolo from 22.0. The last 0.7 s are a push with a growing shake, so 23.0 should land as a release.
- The caption "THEN I'LL SPEND MORE." runs from 21.6 to 22.9.
