# Stitch animals: shared style brief

Reference: `reference.jpg` (a crocodile). Match its LOOK, never its subject or composition beyond the rules below.

## What the reference does
- **Medium:** pixel art that reads as cross-stitch on aida cloth. `lib/stitch.js` already renders that texture; you only fill a grid of palette indices.
- **Grid:** 108 × 153 cells, which renders at 1080 × 1530, a ~1:1.42 portrait like the reference.
- **Composition:** a bust portrait. The head and neck rise from the bottom edge and are cropped there; the body/shoulder at the bottom is simplified into 1–2 big flat tones. The animal fills roughly the lower 60–65% and the left-right middle, and the head is tilted up, gazing upward or off to one side: aloof, proud, a little funny. The top 35–40% is empty flat background.
- **Background:** ONE flat, saturated colour, roughly complementary to the animal, with no gradient, pattern or vignette.
- **Palette:** about 8 colours in total.
  - The animal is ONE hue family in 5 tones: near-black, dark, mid, light and highlight.
  - Add 1–2 small accents: in the reference, a lime eye and white teeth.
- **Form:**
  - It looks like a posterized photo translated by hand into stitches: irregular patches of tone follow the 3D form, lit from the upper left, with highlights on the top planes and dark under the jaw and in the folds.
  - Edges are jagged and pixel-stepped, never smooth or anti-aliased, with no lines thinner than 1 cell.
  - Texture (scales, fur, feathers) comes from small dark crevice marks and broken highlight patches, not from noise.
  - There is no outline around the silhouette; dark tones appear naturally at shadowed edges.
- **Eye:** the focal point, with a crisp accent colour, a 1-cell specular highlight and a clear pupil.

## Animation rules
- Very little movement: subtle, alive, calm. Pixel-stepped and never blurred.
- Make ONE signature motion per animal (yours is in your brief), plus at most one secondary breath-level motion.
- Everything must be a function of t in [0, loop), and t = loop must equal t = 0 exactly, for a seamless loop.
- The background never moves.

## Tech
- Write `animals/<name>.js` that sets `window.ANIMAL = { name, loop, bg, palette, draw(g, t) }`:
  - `palette[0]` is usually the background.
  - Use `g.set(x, y, idx)`, `g.get`, `g.w` (108) and `g.h` (153).
  - Draw with code: SDFs, polygons, shading maths, procedural texture. Small hand-written ASCII pixel maps for tiny details such as the eye are fine.
- Live preview: `lib/page.html?a=<name>`.
- Stills: `node lib/render.js <name> stills 0,1.5,3` writes `out/check/<name>_<t>.png`.
- Final: `node lib/render.js <name> 30 <still_t>` writes `out/<name>.mp4` (one loop) and `out/<name>.png`.
- Do NOT edit `lib/`. It is shared, so all three animals look like one series.
