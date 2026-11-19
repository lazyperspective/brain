# Wonders of the World - five art directions (style-lab)

The animation is untouched: the same world, layout, timing, camera and life. Only the rendering
changes. Every frame here is the film's own geometry, rasterised twice:

* a **colour pass**, where every fill and coloured line goes through the style's palette map and black ink and blue pencil are left out
* a **role pass**, painted in the same order: R = ink line-art coverage, G = construction-pencil coverage, B = how wet the colour wash still is

Each style then composes those two images in its own medium (`wonders/styles.py`). Because the role pass is painted in painter's order, every line mask respects occlusion exactly. The wetness channel is what lets each medium re-imagine "colour floods in". Textures are anchored to the map, like the film's paper grain, so a close-up is still a true crop of the same sheet.

Selection: `film.py --style NAME ...` (current | riso | watercolour | blueprint | papercut | cloisonne).

* Snapshot: t = 8.5 s, the Pyramids close-up at 2.5x.
* Clips: frames 48-138 (1.6-4.6 s of the build), with the matching slice of the score.

The `current` style is the original film, pixel for pixel. It was checked against `out/shots/shot_01_pyramids_08.53s.png`, and the maximum difference is 0.

---

## 1 Riso - "Spot-Ink Atlas"
**Pitch:** the world printed on a risograph: three spot drums plus a midnight key, overprinting into every other colour, a little out of register.

**The build**
- **Construction lines:** printed by the fluorescent-pink drum, like a printer's guides and crop marks.
- **Line art:** the key plate in midnight blue (38,46,96), with its own small offset from the colour.
- **Colour:** the drums register one at a time. Yellow lands first on the wet front, pink follows (wetness < 0.55), and blue arrives last as the wash settles (< 0.2). The colour visibly builds up as separations.
- **Life:** prints in the same inks.

**Palette:**
- Paper: uncoated Munken-white (248,246,239).
- Drums: Riso Yellow (255,226,0), Fluorescent Pink (255,72,168), Riso Blue (0,120,191).
- Every film colour is solved, per colour and in Lab, into the three drum densities, with a small ink-economy bias.
- Warm earths lean pink. Shadows become pink+blue (purple) overprints instead of black.
- The hero saffron is a full yellow+pink overprint.

**Treatment:**
- AM halftone screens at 0°/75°/15°, anchored to the map with a pitch of about 4-6 output px.
- Ink grain and starved voids; solids print solid.
- Per-drum misregistration of 0.2-0.4 map px.

**Cost:** 2 rasters + about 0.35 s of numpy post per frame. About 1.7 s per build frame single-threaded; the 90-frame clip took 47 s on 4 workers, encode included.

## 2 Watercolour - "Field Journal"
**Pitch:** a naturalist's travel sketchbook: sepia pen, graphite under-drawing, transparent washes that never quite stay inside the line.

**The build**
- **Construction lines:** soft graphite that catches on the paper's tooth.
- **Line art:** a sepia dip pen (78,50,36), thinner than the film's line. The pressure swells and lifts along the line, and the pen is tinted by the wash it crosses.
- **Colour:** while wet, the pigment blooms outward and pales. As it dries it draws a darker tide-line at its rim and granulates into the paper.
- **Life:** painted in the same wash.

**Palette:**
- Paper: warm cold-press white (251,248,240).
- A pigment box rather than a screen palette: greens toward sap/olive, blues toward cerulean/ultramarine, everything ~25% less saturated and lighter than the print.

**Treatment:**
- Colour is handled as pigment density (−log transmittance).
- The colour field is displaced off the line by a slow map-anchored noise field (~0.36 map px) and lightly blurred.
- Uneven hand-laid washes, the occasional dry-brush skip, edge darkening (D − blur(D)) and granulation in the paper's valleys.
- Relief lighting of the cold-press tooth.

**Cost:** 2 rasters + about 0.5 s of post (remap and several blurs). The clip took 47 s on 4 workers.

## 3 Cyanotype - "Patent & Gilt"
**Pitch:** the world as an engineer's patent drawing, sun-printed on Prussian-blue cyanotype, with gold leaf laid onto the wonders.

**The build**
- **Construction lines:** chalk, with drafting dash-dot centre-line dashes, grainy and broken.
- **Line art:** a white ruling pen with the faint halo of a sun-printed line.
- **Colour:** arrives as the cyanotype's own yellow-green sensitizer, which develops into the blue tonal print. The colour stage is literally the photograph developing.
- **Life:** white-lined figures in the tonal blues. Saffron heroes (balloons, kites, autumn trees, the Sphinx) are gilded.
- **Before colour:** a shape that is still blank paper reads as a paler, unexposed blue cell.

**Palette:**
- Ground: Prussian blue (20,55,112) with a brushed, uneven coating.
- Fills: mapped by luminance onto a cyanotype tone ramp, from deep (6,22,58) to bleached (226,238,246). They keep 36% of their original chroma as a tinted glaze, so grass reads jade and water reads cobalt.
- The only warm colour allowed is gold leaf. It has square-sheet seams, a beaten surface and a slow travelling glint.

**Cost:** 2 rasters + about 0.3 s of post. The clip took 51 s.

## 4 Cut paper - "Paper Theatre"
**Pitch:** a hand-cut paper diorama, photographed under a warm lamp. There are no outlines at all, only stacked, deckle-edged card stocks casting real shadows on each other.

**The build**
- **Construction lines:** dashed cutting guides in soft graphite.
- **Line art:** knife scoring, a crease in the card with shadow on one lip and light on the other. Before colour, each piece reads as a white-card maquette.
- **Colour:** pieces of dyed card are laid in from above. While a piece is still "wet" it is held up, so its shadow is longer and softer; it then settles flat.
- **Life:** tiny paper cut-outs, each with its own drop shadow.

**Palette:**
- Ground: a light backing card (234,227,214).
- Fills: dyed Mi-Teintes-like stocks, matte and dusty (saturation x0.62). Hues are pulled toward brick, marigold, mustard, moss, teal, cerulean, slate and rose; whites become an ivory stock.
- Felted fibre with pale flecks in every sheet.
- A warm key light from the upper left.

**Treatment:**
- Every fill gets a Skia `DiscretePathEffect` deckle and a blurred cast shadow drawn just before it in painter's order, so shadows land only on what lies beneath.

**Cost:** the most expensive raster (a blur mask filter per fill). About 1.6 s per build frame single-threaded and about 3 s per close-up frame. The clip took 54 s.

## 5 Cloisonné - "Enamel & Gold"
**Pitch:** the world as a cloisonné jewel box: gold wire cloisons filled with fired glass enamels, on black lacquer.

**The build**
- **Construction lines:** scribed into a copper plate, as thin copper lines with a faint warm glow.
- **Line art:** gold wire (1.3x the film's line weight), bevelled and lit from the upper left. A slow sweep of light crosses the piece.
- **Colour:** arrives as matte unfired powder, flashes orange in the kiln, then sets into glossy enamel.
- **Life:** tiny enamelled figures in gold wire. Saffron heroes are solid gilt.
- **Before colour:** an empty cell shows bare copper, waiting for its enamel.

**Palette:**
- Ground: black lacquer (13,16,26) with gold dust.
- Every green becomes emerald/jade and water becomes turquoise-to-lapis.
- Roofs and reds become cinnabar/coral.
- Sands become honey-ivory, and whites become ivory/pearl enamel.

**Treatment:**
- Enamel pools: lighter where it climbs the wire, with a dark seat beside each wire and the odd bubble.
- The gold wire's bevel comes from the gradient of the blurred line mask.

**Cost:** 2 rasters + about 0.4 s of post. The clip took 56 s.

---

## Files
- `style_0_current.png` ... `style_5_cloisonne.png`: the snapshot at 1920x1080.
- `style_N_NAME_3s.mp4` (plus `style_0_current_3s.mp4` for reference): 3 s, 1920x1080, 30 fps, x264 CRF 20 with +faststart, AAC score slice.
- `styles_grid.jpg`: the comparison grid.
- Reproduce one snapshot: `../.venv/bin/python film.py --style riso still 8.5 --name style_1_riso.png`
- Reproduce one clip: `../.venv/bin/python film.py --style riso film --frames 48 138 --audio --crf 20 -o out/style_1_riso_3s.mp4`
- Rebuild the grid: `../.venv/bin/python lab_grid.py`
