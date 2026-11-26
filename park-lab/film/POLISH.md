# Polish pass

One agent, after the three render agents finished. Everything old can be restored: the replaced shots are in
`film/shots_v1/`, the old plan files in `film/plan/v1_backup/` (`shots.json`, `park.js`, `park.py`, `build_shots.py`),
and the edited renderer files in `render_b/v1_backup/` and `render_c/v1_backup/` (see "Renderer edits" for the two
`render_b/tracks.js` edits, which were made before that backup existed).

## 1. Coaster ride-along, shots 08, 09, 10, 11, 13, 14 (28–36 s)

**Problem.** The old rig sat the eye 1.25 m above the front seat and aimed at the track point 14 m ahead, and the head
keys pitched down up to 25–28°. On the lift, crest and drop the chord to the look-ahead point dives over the brink
before the car does, so the camera looked 44–58° below the car's own axis: the red front car filled the lower
half of the frame (all of it in felt at 32.0), and the neighbours' raised arms sat next to the lens.

**One rig for all six shots** (the beat cuts stay consistent):
- `plan/park.js` and `plan/park.py` (`_pov`): a new optional `aim_ahead_m`. When present, the camera looks along the
  track **tangent** that far ahead instead of at the 14 m chord point, so there is a little anticipation but no dive at
  the brink. Head keys also take `roll` (degrees about the view axis) and a per-key `ease`. Without the new fields the
  function behaves exactly as before. JS and Python agree to 1e-13.
- `gen/build_shots.py`: one `POV_RIG` constant used by all six shots: `seat_back_m 0.3` (eye at the front of the
  lead car), `eye [0, 1.6, 0]` (a bit higher), `aim_ahead_m 4`, `fov 84` (was 80). New head keys per shot (below).
  `shots.json` was rebuilt with `python3 build_shots.py`; only shots 08–14 (POV) and 16 changed, and shot 15 is
  byte-identical.
- I designed the keys numerically first: a small tool computed per frame the view pitch relative to the car, the
  world pitch, the horizon position and tilt, and how far each renderer's lead-car silhouette reaches into the
  frame. Then I checked them with keyframe stills from all three renderers side by side and iterated (5 rounds).

| shot | head keys (yaw + = left, pitch + = up) | what the frame shows now |
|---|---|---|
| 08 lift | look up the lift (−5, −4) → turn right over the park (−80, −10, roll −28) → back to the front (−10, −6) | chain, catwalks and the crest ahead against the sky; then a level panorama of the park falling away (drop tower, wooden coaster, red track, horizon); the roll cancels most of the 38° lift tilt |
| 09 crest approach | (−10, −6) → (−18, −10) | the horizon opens over the painted fields, the crest turn sweeps right |
| 10 crest turn | (−20, −10) → (−22, −12) → (−6, −4) | the paper park spread on the table below to the right, the turn ahead, the nose tips over at the end |
| 11 drop | (0, −2) → (−5, +12) at 32.15 → (−10, +18) → (−10, +14) | at 32.0: the drop opening, park below, horizon; then the track plunging into the felt valley with the ground rushing up and the horizon just at the top edge |
| 13 loop | −6 → −22 around the top (34.35–34.65) → −4 | the climb into the sky, then the **inverted horizon** on the 34.5 beat (park overhead, sky below), then the ground rushing up |
| 14 corkscrew | −8 | the world rolls 360° around the track ahead |

Only the nose tip (and in 08's sideways look, the car's side rail) shows at the bottom edge.

**Renderer edits (small, only for the ride-along shots):**
- `render_b/tracks.js`: in a POV shot our own lead car's nose is drawn at 0.55× length (its nose stuck out 1.55 m,
  much longer than the render_a / render_c cars it cuts against), and our own two front-row riders are not drawn.
- `render_c/main.js` (`setupPOV`): our own front-row neighbours are hidden completely (before only their heads were
  hidden, so their raised arms still swung past the lens in 10 and 14).
- render_a already used a POV car without front-row riders; no change.

## 2. Snow-globe ending, shot 16 (40–44 s)

- **Camera** (`gen/build_shots.py`, `PATH_GLOBE`): shot 16 now has its own keys after the 40.0 match-cut key. Shot 15
  keeps `PATH_FINALE` untouched and the frame at exactly 40.0 is the shared key, so the match cut is unchanged. The
  pull-back stops nearer (≈1,150 instead of ≈1,420 from the globe) and higher. During the shake the camera pushes in
  to ≈950 at ~30° elevation, so the park disc fills most of the frame width through the winter reveal (42.0–42.9).
  Then it cranes down onto the ticket; the 44.0 key (LOOP frame) is unchanged.
- **Winter look** (`render_b/style_mini.js`, `world.js`): snow cover capped at 0.44 (was 0.62) with less snow on
  foliage (leaf 0.38, was 0.55), so greens, roofs and paths keep their colour. Windows and bulbs go to 1.9× after
  the shake (was 1.25×), with slightly higher exposure and saturation during the reveal. Depth of field is 0.35×
  until the crane so the park stays sharp, then it ramps to the old product-shot look on the ticket.
- **Flakes** (`render_b/globe_room.js`): 1,500 flakes instead of 3,200, 3–4× bigger (5–12 units), with a bright core,
  a soft six-fold edge and per-flake rotation. They read as flakes at 1080p, not grain.
- Less rainbow fringing: the glass dispersion is halved (IOR 1.1175 / 1.12 / 1.1225) and the grade's chromatic
  aberration is 0.0008 in the globe shot (was 0.0025). With big flakes the old fringing turned every flake into a
  red/green/blue triplet.
- Rendered at native 1920×1080 (it was 1600×900 upscaled).

## 3. Loop seam (16 → 01)

- `render_b/globe_room.js`: the table now uses **render_c's table texture**: the same canvas drawing and seed (both
  renderers use the same Mulberry32 rng), the same plane orientation and texel scale, and shifted by z +640 so the
  planks, plank seams and grain sit in the same place relative to the ticket as in shot 01. The material tint was
  retuned for render_b's lamp so it reads as the same warm walnut, not purple.
- `render_b/seam_match.py`: a colour match from 16's LOOP frame (t = 44.0) to 01's frame 0, fitted by exact pixel
  correspondence (same framing). It is a 2nd-order RGB polynomial times smooth screen-position terms, so the
  vignette and lamp-glare differences are absorbed too. It ramps in (smoothstep) over 43.5–44.0, and is run once
  after rendering 16.
- Result: see `out/loop_seam.jpg` (last film frame | first film frame).

## 4. Felt kiddie shot 03 (8–12 s)

- `render_c/main.js` (`setup03`): hides only the 13 park trees that stand between the camera and the kiddie rides
  (planes, boats, trucks, drop, playground, family coaster). I found them by ray-testing `park.camera(shot, t)` for
  t = 8.3…11.85 against every tree crown in `park.json` and keeping trees with ≥ 18 blocking rays. This is the same
  mechanism render_c used in shot 06. Everything else in the shot is unchanged.

## Render times (this pass, machine otherwise idle)

| shot | renderer | frames (unique) | wall time |
|---|---|---|---|
| 08 lift | render_b | 72 | 5.3 min |
| 13 loop | render_b | 42 | 3.0 min |
| 09 crest | render_a | 42 | 2.1 min |
| 10 crest turn | render_c | 42 | 10.7 min (about 6 of it scene build and shader compile) |
| 11 drop | render_c | 42 (21) | 9.7 min |
| 14 corkscrew | render_c | 42 (21) | 9.9 min |
| 16 globe | render_b, native 1080p | 132 | 25.9 min (rendered twice; the second pass fixed the flake fringing) |
| 16 seam match | `seam_match.py` | 132 | 1.1 min |
| 03 felt kiddie | render_c | 132 (66) | 23.1 min |

Keyframe stills for iterating: render_a and render_b take about 2–4 s per still plus a few seconds of setup;
render_c takes 5–7 min per shot (scene build) plus about 8 s per still.

## Checks

- `python3 film/assemble.py` re-run. `out/park_film.mp4` has 1320 frames, 44.000 s, 1920×1080, 30 fps, yuv420p.
  Loudness (`ebur128=peak=true`): **−14.0 LUFS integrated, true peak −1.4 dBTP**, LRA 7.3 LU. `out/park_film_share.mp4`
  has 1320 frames, −14.1 LUFS, −1.0 dBTP.
- Every re-rendered shot was checked with ffprobe: exact `render.frames` frame count, 1920×1080, 30/1, yuv420p, CRF 16.
  Felt (11, 03) and tin (14) are on twos.
- Loop seam: the mean absolute difference between the last film frame and the first is **3.2/255** (it was 10.8/255).
  Table patches match within 1–3 levels, e.g. top-left 108,69,36 vs 107,69,36.
- Sheets: `out/contact_sheet.jpg` (1 fps, 6×8), `out/ride_sheet.jpg` (every 5th frame, 28–36 s, 6×8),
  `out/loop_seam.jpg` (last frame | first frame). The pre-polish contact sheet is kept as
  `shots_v1/contact_sheet_v1.jpg`.

## Still weak

- **10 (paper crest turn):** the paper U-strip track is wide and red, so the near track still sweeps through the
  left third of the frame during the turn. The upper third is the paper room's beige wall rather than sky, because
  that is the set: the park lies on a table.
- **08:** during the sideways look over the park, the lead car's side rail and white body still show in the
  lower-left quarter. It reads as looking over the side, but it is more car than in the other shots. The lift's
  wide shot is mostly trees and red track, and the hub tower and midway are behind the train, so they are out of view.
- **11 / 13:** the nose tip reaches about 20–25% up the frame for 3–4 frames around the brink (32.1–32.2) as the
  car tips over. The loop climb (34.0–34.15) is all sky plus track.
- **16:** the snow is still dense in the upper half of the glass during the reveal, and the whole winter park sits
  under a pale, slightly beige snow tone. It reads, but it is not as crisp as the summer park. The glass still
  refracts some colour fringing at its rim.
- **Seam:** the last 0.5 s of 16 is colour-matched by a fitted transform, not by identical lighting, so the table in
  16's crane-down shifts a little warmer during that half-second. The wood grain matches; tiny grain/noise
  differences remain at the cut.
- **03:** only trees were hidden. The big pink and green felt shrub masses around the family-coaster station still
  fill the lower foreground in the low part of the move.
- Shot 15 (and every other shot) was not touched. The velocity of 16's pull-back right after the 40.0 match cut is
  slightly different from what shot 15's path implied (the position at the cut is identical).
