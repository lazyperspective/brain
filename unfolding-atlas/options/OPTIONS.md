# The Unfolding Atlas — five art directions

One beat, five ways. Every clip shows the **same** moment of the same book:

1. the atlas at rest on *Plate VI*, a flat map of the Moon River;
2. the thin map leaf turns (real paper curl: the free edge leads, then trails and rolls down from the spine);
3. it lands and uncovers the board for *Plate VII — Río de la Luna*;
4. the board opens and the pop-up unfolds from it — the map becomes the place;
5. life switches on: the river runs, birds lift out of the canopy, the canoe slides down its slot (the pull-tab at the page edge moves with it), leaves tremble, mist rises;
6. a held beat while the camera finishes a slow push-in and tilt.

The scene is a rainforest gorge whose river **falls out of the moon**: karst towers, the moon bridged across the backdrop, a rope bridge with three travellers over the waterfall, a great kapok with monkeys and a toucan, a ruined temple with pilgrims and lanterns, a heron, lotus, a canoe with two paddlers.

All five were rendered from one scene model and one mechanism; only the medium, the light, the book and the timing change. Files: `option_<n>_<name>.mp4` (1920×1080, 30 fps, x264 CRF 18, +faststart, AAC foley), `option_<n>_<name>.png` (hero still), `options_grid.jpg`, `options_strips.jpg`.

---

## 1 · Lamplit Paper Theatre — `option_1_lamplit_paper_theatre`

**Pitch:** a cut-paper diorama under one warm desk lamp — every shape its own sheet of dyed paper, and you can feel the lamp.

- **Art style.** *Palette:* saturated poster-paper colours — cobalt and periwinkle towers, emerald/lime canopy, vermilion cliffs, saffron temple, a yolk-yellow moon, cream page, teal linen cover with a gold rule, dark walnut desk. *Line:* almost none; form comes from stacked sheets. A few scored lines (leaf veins, strata, steps). *Texture:* paper fibre and mottling on every sheet, a soft contact shadow under each glued layer, a lit cut edge on the upper-left of every piece. *Light:* one low warm lamp from front-left; real soft cast shadows from layer to layer and across the floor, cool ambient fill, strong vignette so the book sits in a pool of light.
- **Animation feel.** *Page turn:* unhurried, 1.75 s, soft landing with a moving shadow. *Unfold:* springy and playful — tabbed layers lag the V-folds by ~17° and then pop upright one after another with soft overshoot (2.3 Hz, lightly damped), a tiny bounce as the board lands. *Life:* white paper slivers run down the falls and the river, ripple rings, paper birds with a second paper wing-tip, breathing lantern halos, layers tremble.
- **Render cost.** 9.6 s / 288 frames. Bake ≈ 6 s; ≈ 0.86 s per frame per core — 62 s for the frames on 4 cores at 1.5× supersampling, plus ≈ 25 s x264. One texture per card.
- **Scaling to the other biomes.** The most direct: each biome is a new palette of paper stocks and a lamp colour (reef: turquoise gel and caustic gobo; desert: low orange side light with long shadows; tundra: cold top light, white-on-white papers and blue shadows). The shadow system is where its beauty lives, and that is already general.

## 2 · Riso Field Press — `option_2_riso_field_press`

**Pitch:** the book is printed while you watch — the pop-up opens carrying only its yellow pass, then the pink and blue drums hit and jog into register.

- **Art style.** *Palette:* three spot inks only — Yellow, Fluorescent Pink, Blue — on warm white stock; every other colour is an overprint (green = yellow + blue, vermilion = yellow + pink, indigo = pink + blue). *Line:* none on the shapes; indigo linework for details and type, set in a bold grotesque. *Texture:* halftone screens at three angles, roller mottle and pinholes in the ink, 2 px misregistration, crop marks and a colour bar on the pages; pieces are die-cut with a white margin. *Light:* flat studio light; shadows are a pale blue tint, and the book's own shadow on the table is a blue halftone.
- **Animation feel.** *Page turn:* on twos, snappy. *Unfold:* stop-motion on twos (camera stays on ones so the move is still smooth), crisp locks with almost no overshoot. *Life:* the print run itself — pink arrives 0.14 s after landing, blue at 0.56 s, each sweeping far-to-near and jogging home over a few held frames; afterwards the plates "boil" by a fraction of a pixel, birds have two wing poses, mist is a drifting dot screen, lanterns throw little printed rays.
- **Render cost.** 9.6 s / 288 frames. Bake ≈ 13 s (halftone separations); ≈ 1.0 s per frame per core (four plates per card, multiplied live) — 74 s for the frames. The costliest to render and the largest file (halftone is hard on x264).
- **Scaling to the other biomes.** Change one drum per biome and the whole world re-tints for free: reef = Aqua/Fluoro Orange/Yellow, desert = Orange/Violet/Yellow, tundra = Blue/Teal/Metallic silver. The "printed while you watch" idea becomes the film's transition grammar: each page turn is a new press run.

## 3 · The Naturalist's Field Atlas — `option_3_naturalist_watercolour`

**Pitch:** a pen drawing stands up on hand-cut white paper, and then the watercolour arrives wet, flooding each piece from a few brush touches.

- **Art style.** *Palette:* transparent watercolour — ultramarine towers, viridian and sap greens, burnt-sienna cliffs, gamboge temple, cerulean water — on bright cold-pressed paper; mustard cloth sketchbook on a pale desk with dried paint rings. *Line:* loose sepia pen outline (wobbling, sometimes doubled) over visible graphite construction: centre lines, bounding ellipses, the first pencil pass. *Texture:* paper tooth, pigment granulation, darker pooled edges, back-runs, washes that sit slightly off the line. *Light:* soft window daylight, gentle cool shadows.
- **Animation feel.** *Page turn:* the slowest and softest (1.85 s). *Unfold:* heavy and calm, no bounce, long ease; locks are barely springy. *Life:* the bloom — as the board settles the washes spread from seed points with a soft wet front, floor first, then far to near over ~2 s; water only starts to move where the paint has reached. Birds are flicked in as two-stroke pen gulls.
- **Render cost.** 9.9 s / 297 frames. Bake ≈ 8 s; ≈ 0.85 s per frame per core (the wash plate is masked live by a low-res bloom field) — 63 s for the frames.
- **Scaling to the other biomes.** Very natural for an atlas: each biome gets a limited travel-box palette and its own specimen page before it (the flat page already carries labelled figures). The bloom can change character per biome — salt-speckle for the reef, dry-brush for the desert, wet-in-wet blues for the tundra.

## 4 · Night Lantern Atlas — `option_4_night_lantern_atlas`

**Pitch:** luminous inks on deep indigo paper; the moon is a real light, and the light runs down the waterfall into the river while the lanterns catch one by one.

- **Art style.** *Palette:* indigo paper, violet towers, deep teal canopy, plum cliffs, lilac stone — with emitted cyan (water), pale gold (moon), amber (lanterns, door), magenta and violet (flowers), green-gold fireflies. *Line:* gel-pen rim light on the upper-left edge of every shape, colour-coded by material (mint on foliage, pink on rock, amber on masonry). *Texture:* soft paper mottle, printed stars on the pages, a star chart on the dark table, silver-ruled midnight cover. *Light:* additive emission plates plus screen-space bloom; a pool of moonlight on the ground in front of the fall; lantern gold reflected on the water.
- **Animation feel.** *Page turn:* slow and weightless. *Unfold:* the slowest opening (2.85 s) with a low, soft spring so pieces drift upright and sway. *Life:* light choreography — the moon is already glowing as the board lifts; after landing the sky-fall lights, then the cliff fall, then the river from the pool downstream; lanterns ignite in sequence with a small flare; fireflies rise; birds are pale and glowing.
- **Render cost.** 9.9 s / 297 frames. Bake ≈ 5 s; ≈ 0.95 s per frame per core (extra additive pass per card + bloom) — 71 s for the frames.
- **Scaling to the other biomes.** Every biome becomes a night scene with its own light source: bioluminescent reef, desert under a meteor shower with a caravan of lamps, aurora over the tundra, the rainforest as here. The "light travels through the page" device gives a strong through-line from spread to spread.

## 5 · The Gilded Engraver's Atlas — `option_5_gilded_engraving`

**Pitch:** a hand-coloured copperplate from a cabinet of curiosities — tone cut as swelling engraved lines, jewel washes, and gold leaf that turns in the light.

- **Art style.** *Palette:* lapis towers, emerald and viridian foliage, vermilion and carmine cliffs, saffron temple, turquoise water on ivory laid paper; oxblood leather cover with gold tooling, gilt page edges, green baize. *Line:* everything — black outline plus parallel engraved cuts whose direction follows the material (35° on foliage, steep on rock, near-vertical on the towers, wavy horizontals on water, coursed on masonry), widening with tone and cross-hatching in the darks. *Texture:* chain and laid lines, light foxing, hand-colouring that sits slightly off the plate. *Light:* warm candle-like key; the moon, the lamps and the frame rules are a separate gold-leaf layer with a moving specular sheen.
- **Animation feel.** *Page turn:* measured. *Unfold:* stately and mechanical — the most even angular speed, no bounce, layers lock with a critically damped settle (no overshoot), as if on clockwork. *Life:* the gold sheen sweeps as the board angle and camera change; gold and white strokes travel down the water; four-point glints on the lamps; stippled mist; black birds with gilt wing-tips.
- **Render cost.** 9.7 s / 291 frames. Bake ≈ 14 s (procedural engraving per card); ≈ 0.8 s per frame per core — 59 s for the frames.
- **Scaling to the other biomes.** Engraving direction-by-material is a rule set, so new biomes are mostly new rules: stipple and scallops for coral, long wind-blown parallels for dunes, sparse white-line work for ice. The gold can change metal per biome (gold, copper, silver, mother-of-pearl).

---

## At a glance

| | medium | how the world arrives | motion | length |
|---|---|---|---|---|
| 1 Lamplit | cut paper, real light | complete; shadows do the work | springy, overshoot | 9.6 s |
| 2 Riso | 3 spot inks, halftone | printed in passes: yellow → pink → blue | on twos, snappy | 9.6 s |
| 3 Field atlas | pen + watercolour | pen drawing, then washes bloom in | slow, soft | 9.9 s |
| 4 Night | luminous ink on indigo | lights switch on down the river | floaty | 9.9 s |
| 5 Gilded | engraving + gold leaf | complete; gold sheen sweeps | stately, exact | 9.7 s |

All five run at ≈ 1 s per frame per core, so a 3-minute film is roughly 25–30 core-minutes per minute of footage at this quality; none of them rules itself out on cost.

## The paper engineering (shared by all five)

The pop-up is driven by **one degree of freedom**, the opening angle θ of the board, exactly as in a real book:

- **V-folds.** The backdrop wall and the gorge cliffs are true V-folds glued to both pages along lines leaving the gutter at 62°; their crease stays in the bisector plane of the spread. The orientation of every wing is solved in closed form from θ (`atlas/popup.py`).
- **Layers on tabs (parallel folds).** The far jungle, the kapok, the temple, its forecourt and the foreground plants are hinged to one page on lines parallel to a wing and tied back with floor-parallel tabs — parallelogram linkages, so they stay parallel to their wing at every angle. Because the whole scene is one chevron family, pieces cannot clip through each other.
- **A bridge across a V-fold.** The moon is a flat disc spanning the two backdrop wings, creased down its middle; it is pulled taut and faces the viewer squarely only when the spread is fully open.
- **Pull-tab slider.** The canoe rides a slot in the right page; the tab at the near edge travels with it.
- **Closed-book check.** `Mechanism.validate()` asserts that no piece pokes out of the pages when the book is shut and that one-sided layers never cross the gutter — the render refuses to start otherwise.

Honest deviations from a physical book: the tabbed layers are allowed to lag their linkage by a few degrees and spring upright (the paper "catch"), and after the unfold the living things — birds, mist, butterflies, flowing water — are free animation rather than mechanism.

## Code layout (built to grow into the full film)

```
unfolding-atlas/
  atlas/
    scene.py      scene model: semantic shapes (role + geometry) per pop-up card, floor and flat pages, life paths
    popup.py      mechanics: V-fold solver, parallel layers, bridge, depth keys, closed-book validation
    book.py       book geometry and the thin-leaf curl surface
    timeline.py   beats -> full state (leaf, θ, per-card lean/lock, life channels, camera); sound cues
    engine.py     renderer: plane->screen homographies, painter order, cast shadows, sprites
    audio.py      synthesised foley (rustle, whoosh, lock snaps, biome ambience)
    styles/
      base.py     Style interface + baking helpers (plates, silhouettes, shadow masks, paper, text)
      lamplit.py  riso.py  field.py  night.py  gilded.py
  render.py       python render.py <style>            -> options/option_n_<name>.mp4 + .png
                  python render.py <style> --t 4.2 9.0 -> single frames
  make_sheets.py  options_grid.jpg + options_strips.jpg (and 10 fps review sheets)
```

A new biome is a new `level_*` set in `scene.py` (the mechanism, engine and all five media are reused untouched); a new medium is one file in `styles/`. A style is: a palette, a `fill`/`line` medium (or its own multi-plate bake), per-frame plate state (print passes, blooms, lights), sprites, a light and a table of timing numbers.

## Sound

Each clip carries a soft synthesised foley track (no samples): band-passed noise rustle and crackle for the leaf, a low whoosh and paper ticks for the board, a soft landing thump, one small snap per piece as it locks, then waterfall, trickle, birds and insects (crickets and frogs for the night book). It was mixed by meter, not by ear — treat it as a placeholder for real foley.
