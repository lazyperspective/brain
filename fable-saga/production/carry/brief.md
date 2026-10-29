# CARRY — a 15-second endless zoom (creative brief and contract)

## The idea
A small snail sits on a flower at night and looks up at the stars. The camera pulls back without a cut: the meadow, the
valley, the curve of the world, the planet, the sun and its planets, the galaxy. Then the galaxy turns out to be the
spiral on the shell of a small snail on a flower, looking up at the night. It's the same snail, and the film is a perfect
loop that never ends. It carries the universe on its back.

The user gave full creative freedom and asked for the best 15-second pixel piece we can make. Make every frame
beautiful: rich, deliberate pixel art in the Fable films' style (indexed palette, dithering, glow and bloom, deep night
colours, warm points of light). No text and no captions. It's pure image and music.

## How the zoom works (already built: `src/f_zoomkit.js`, `src/y_zoom.js`. Read them.)
- **Seven layers, L0..L6, each 8× larger than the one inside it.** L7 is L0 again: the loop.
- **Units.** Each layer is drawn in its own units. At nominal size (u = 1) one unit is one screen pixel, and the layer's
  ORIGIN is the frame centre (240, 135). The zoom always closes on the origin.
- **Windows.** The layer inside lives at your origin at 1/8 scale. The compositor draws you, then the inner layer over
  everything, then keeps the inner layer only inside your WINDOW.
  - The default window is a soft rectangle: full within |x| < 30, |y| < 17, fading to nothing at |x| = 36, |y| = 22.
  - L0 has a custom window: the inside of the snail's shell.
- **Coverage.** At any moment the frame shows up to four layers: the outer one magnified (u 8→1), then each inner one in
  its window.
  - Whatever is inside your window is covered by the inner layer.
  - The soft border of the window (30–36 by 17–22 units) is a dissolve between you and the inner layer. Your art
    around the window must continue the inner layer's edges, so the seam is invisible.
- **Valid content.** You must draw valid, good-looking content over the whole box |x|, |y| ≤ 420 units (L6: ≤ 720).
  - When you are the outer layer at u = 8, your centre fills the frame.
  - When you are inner, everything out to your box edge may be on screen.
- **Your API.** Your draw function gets a view `V`:
  - `V.u`: screen px per unit.
  - `V.X(x)`, `V.Y(y)`, `V.S(n)`: unit to screen.
  - `V.lx(X)`, `V.ly(Y)`: screen to unit.
  - `V.box`: the screen rect of your valid region.
  - `V.each(x0, y0, x1, y1, fn)`: per-pixel fill over a box of units; `fn(x, y, X, Y)` returns a colour or −1.
  - `V.vis(...)`: whether a box is on screen.
  - `V.lod`: 0 when tiny, 1 at nominal, up to 2 when magnified.

  Helpers: `zDisc`, `zLine`, `zGlow`, `zStars`.
- **Scale.** Draw so you look right at every scale from u = 1/64 to u = 8: crisp when magnified, readable when small.
  Use `V.lod` / `V.u` to add detail when big and skip sub-pixel detail when small.
  - Everything is procedural, so magnified layers stay sharp.
  - Big flat areas at u = 8 look empty, so add texture and detail that holds up close.
- **Periodic motion.** EVERY motion must be periodic with period 15 s. Use `zP(t, n)` (n whole turns per loop) or
  `Math.sin(zP(t, n))`. Never use raw t in a non-periodic way, or the loop will jump.
- **Engine.** The whole Fable engine is available.
  - Palette: `PAL_HEX` in `a_core.js` (149 colours; 124–148 were added for this film).
  - Primitives: `P`, `rectF`, `lineP`, `thick`, `discF`, `glow`, `tintI`, `ring`, `capsF` / `limbF` (in `d_sunderer.js`),
    `z5Tri`, `cloudPuff`, `vn`, `fbm`, `ih`, `bay`.
  - Tint tables: `T_WH`, `T_GOLD`, `T_WARM`, `T_BL`, `T_GR`, `T_VI`, `T_MAG`, `T_CYAN`, `T_EMBER`, `T_NOVA`, `T_DEEP`.
  - The render loop adds bloom and a vignette.
- **Performance.** Keep each layer's draw under about 12 ms per call. The whole frame must average under about 45 ms.

## The zoom's timing (s = zS(t), layers out)
| layer | nominal (fills the frame) at | on screen roughly |
|---|---|---|
| L0 snail | 0.0 s and 15.0 s (the seam) | 10.9–15 and 0–4.1 (≈ 8 s across the seam: the slow part) |
| L1 meadow | 4.14 | 0.5–5.7 |
| L2 valley | 5.68 | 4.1–6.9 |
| L3 the curve of the world | 6.92 | 5.7–8.1 |
| L4 the planet | 8.08 | 6.9–9.3 |
| L5 the sun and its planets | 9.32 | 8.1–10.9 |
| L6 the galaxy | 10.86 | 9.3–15, and inside the snail's shell always |

## The geometry chain (each layer's units; divide by 8 to get the next layer out)
Everything stands on top of a planet, at its north limb, seen side-on. The sun is to the LEFT and a little BELOW.
That puts the lit crescent on the planet's lower-left, and the snail's world (the top) is on the night side.

**L0 — the snail (the character).** A close portrait at night.
- **The shell.** A big round shell, centre (−18, −8), radius 64, with a rim of amber horn about 6 units wide outside
  that (130–133), ridged with growth lines and lit by the galaxy inside it.
  - The INSIDE of the shell (r < 64) is the window. The galaxy (L6) shows there; the compositor does that, so you never
    draw the galaxy yourself.
  - A curl of the shell's suture can cross the rim. The galaxy's core sits exactly at the shell's centre.
- **The snail.** Its body emerges from under the shell's lower right.
  - The body is translucent sea-glass green (124–129) with an inner glow and a soft rim light from the shell.
  - Its head is at the right (about x +85..+150, y +15..+60), with two long eyestalks rising to eyes near (+148, −72)
    and (+176, −56), small lower tentacles, and a sweet, curious face.
  - It looks up at the sky.
- **The flower.** The snail sits on a big night flower (petals in deep violets and blues with a pale rim), around
  y +55..+110. Its stem goes straight down at x = +24, 7 units wide, to the bottom (+420), in greens 141–143.
- **The sky and ground.** Deep night (134–136) with twinkling stars, and a faint green aurora high in the top left
  (aurora greens 48–50 and cyans 61 and 147, dithered and very soft).
  - Dark meadow grass blades and flower silhouettes along the bottom from y ≈ +150 (139–140), plus a few fireflies.
  - The region around |x| ≈ 240..290, |y| ≈ 135..176 is the seam into L1: keep it sky colour 135 above y ≈ +150 and
    grass below.
- **Acting (periodic, 15 s).**
  - The eyestalks sway gently and the body breathes.
  - A blink at about t = 0.3 s.
  - A shooting star crosses the sky top-left to right at about 0.6–1.3 s, and the eyestalks follow it.
  - A firefly drifts past the head around t = 2 s and again around t = 13.5 s.
  - It's a small, tender character moment. This is the face of the film.
- **Mask.** Export `mask(x, y)`: 1 inside r < 63, soft to 0 at r = 65, around (−18, −8). Also
  `maskBox: [-84, -74, 48, 58]`.

**L1 — the meadow at night.** In the window: the flower top with the snail (about 15 px tall here).
- The flower stem rises from the grass to the window at x = +3, 1 unit wide.
- The meadow grass tops sit at y ≈ +19 around the window; below it is a deep meadow of grass, bellflowers,
  dandelion clocks, a mushroom or two and many fireflies in depth.
- Above is the night sky (135 near the window, darkening to 134 higher) with stars and the faint aurora, top left.
- The meadow is a gentle hill. Distant tree silhouettes sit on the left horizon at about y ≈ +10..+20.
- There is a soft moonless glow on the horizon.

**L2 — the valley.** Seen from far away at ground level.
- In the window: the meadow hill brow (horizon at about y ≈ +2.5 near the window, sky above, dark meadow below).
- Around it: rolling hills, a forest, a river curving through the valley that reflects the aurora, a small village
  with warm windows (144–146) in the valley below right, and far mountains on the horizon.
- Above: the starry sky with the aurora much bigger now, shimmering curtains across the top.
- The horizon must be almost flat. It is part of a circle of radius 4480 centred at (0, +4480).

**L3 — the curve of the world.** From very high above the north of the world, at night.
- The planet's limb passes through the origin: a circle centred at (0, +560), radius 560, so it curves visibly down
  toward the frame's edges.
- Below the limb: the night surface, with dark land and sea, clusters of city lights, moonlit cloud swirls and a frozen
  sea to one side.
- On the limb: a thin glowing band of atmosphere (147, 148, 22, dithered).
- Above it: space and stars, and the AURORA as a ring of green and cyan light standing above the limb.
- Around the window the limb runs straight through. The valley (L2) is a tiny landscape there, and its horizon must
  meet your limb.

**L4 — the planet.** A whole world in space.
- The planet's disc is centred at (0, +70) with radius 70, so its top limb (north pole) is the origin.
- The disc spans y 0..140; the bottom edge may just touch the frame bottom.
- The sun is far to the left and a bit below. The lit crescent is on the lower left: blue oceans, cloud bands,
  green-brown land, a bright terminator.
- The rest is the night side: city lights in networks, the aurora crown at the north pole, a thin atmosphere rim glow.
- A small grey moon sits somewhere right of it.
- The window at the origin is the north limb. L3's limb must continue into your limb exactly.

**L5 — the sun and its planets.**
- The planet (radius 70/8 = 8.75, centred at (0, +8.75)) sits on its orbit at the origin, with its crescent toward the
  sun and its moon nearby.
- The sun is at about (−210, +34): big, blazing, glowing (15, 16, 22, 58–60), lighting everything from the left.
- Orbits: faint ellipses around the sun (dithered 136–137).
- Other planets: a ringed giant far right, a red small one, an ice one. Asteroid dust and starfield.
- The orbits turn slowly (periodic).

**L6 — the galaxy.**
- The solar system is at the origin: the sun is a bright star at (−26, +4) and the planet's light is too small to see.
- The galaxy's core is at (−144, −64). The galaxy disc is about 512 units in radius around the core (it must FILL
  the snail's shell later), with spiral arms of stars, pink star-forming knots, dark dust lanes and a golden-white
  bulge.
- Outside the disc: deep space and faint distant galaxies, valid out to |x|, |y| ≤ 720.
- It turns: use one full turn per 15-second loop, or a gentle periodic sway; your choice, but periodic.
- **The twist.** This same galaxy appears inside the snail's shell (L0) at 1/8 scale, its core at the shell centre. So
  it must look stunning small too, like a living spiral shell full of stars.

## The quality bar
- **Each layer is a painting.** Use layered depth, light that comes from somewhere, rich dithering and no flat empty
  areas. The pixel art should be crisp and deliberate.
- **The seams must be invisible.** Before you finish, look at your layer with its inner layer in place: render the real
  film at the times where you are the outer layer. Look at your window's edge at every scale.
- **Life in every layer.** Fireflies, twinkling, drifting clouds, a shimmering aurora, flickering windows, a shimmering
  river, orbits, the galaxy turning. All periodic.
- **Shared tones.** Night is deep blue-violet (0–8, 134–138); warm lights are gold and amber; the aurora is green and
  cyan; space is near-black violet (76–80, 0–2).

## Tools (from `fable-saga/production/carry`)
- `OUT=<scratch>/build.js bash mkbuild.sh`: builds, skipping any layer file that doesn't parse.
- `node zprev.js BUILT out.png k u t`: your layer alone, at scale u and time t, with your window outlined.
- `node zprev.js BUILT "out_%t.png" film t1,t2,...`: the real film at those times.
- `node render.js out.mp4 t0:t1 BUILT`: video.
- `node strip.js BUILT out.png t0 n step`: sequential frames.
- `node flashcheck.js BUILT 0 15`.

## Files
- Layer k lives in `src/l{k}_{name}.js`: `l0_snail.js`, `l1_meadow.js`, `l2_valley.js`, `l3_curve.js`, `l4_planet.js`,
  `l5_sun.js`, `l6_galaxy.js`.
- Wrap the whole file in a `{ }` block. Prefix every helper with your layer tag (`c0…`, `c1…`, and so on).
- Register with `ZL[k] = { name, draw(V, t), mask?, maskBox?, R? }`. Use `R: 720` for L6.
- Only edit your own file. No git. Avoid imagery resembling hate symbols or hooded robes.
