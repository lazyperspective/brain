# Engine changes (second pass): animator 1

All changes are additive: no function is renamed or removed, and existing signatures still work.
Anything marked **(visible everywhere)** changes the look of existing calls in every shot.

| Date / round | File | Change |
|---|---|---|
| r2.1 | f_kit.js | `h5Clock(t, hits, d, shake)` → `[tt, frozen]`: `h5Stop` + `h5Frz` in one call, plus a camera shake while frozen. |
| r2.1 | f_kit.js | `h5Blow(x, y, g, pw, dir, cols, seed, imp, keep, lcol, views)`: `h5Heavy` plus a spray of refracting glass shards and debris along `dir`. `h5Heavy` itself is unchanged. |
| r2.1 | f_kit.js | `h5Frame(A, B, t, o)` → `{ x, y, z }`: an auto-framing camera on two key tracks (smoothed midpoint; zoom from their separation). |
| r2.1 | f_kit.js | `h5F` new `base` options, all off by default: `dmg` (a function t → 0..1: cracks, flicker and bleeding sparks), `halo` (a colour for a 1 px outline round the sprite), `ws` (wing scale). |
| r2.1 | f_kit.js | **(visible everywhere)** `hnova` wings are now solid void with white-fire edges and star flecks inside, at scale 1.35 (`H5FORM.hnova.ws`). To get the old size back, pass `ws: 0.74` in a key. |
| r2.1 | a_core.js | **(visible everywhere)** Nova-form cracks (`cracks` / `cr` on a nova body) are drawn as dark crimson seams leaking orange, so they show on the white body. Before, they were white on white. |
| r2.1 | g_worlds.js | **(visible everywhere)** `w5Ocean`: bioluminescent spires, light shafts and glowing foam lines in the abyss. `w5City` / `w5Flight`: brighter flights with a lit tread edge, and more lit windows. Cached `wview('ocean')` and `wview('city')` shard views change with them. |
| r2.2 | z_frame.js | **(visible everywhere)** Colour fringing (`GD.ca`) now blends the shifted red and blue channels 55/45 with the original instead of replacing them. Replacing them turned textured big-pixel sprites into checkerboards of pure green and magenta. |
| r2.2 | g_worlds.js | `w5Dawn(..., o)` takes `o.sunR` (sun size scale, default 1). |
| r2.4 | f_kit.js | `h5F`: no afterimages when the fighter is drawn at a scale of 5 or more (`S·z ≥ 5`). At that size the dithered ghosts turn into big checkerboards. |
