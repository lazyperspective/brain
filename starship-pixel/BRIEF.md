# Starship Catch — pixel-art recreation: shared brief

We are recreating a 92-second SpaceX promotional video ("Starship is preparing for catch") as a pixel-art film, shot for shot, with creative liberty to make it more beautiful and more stylised than the original. Three agents build it in parallel, one act each; the acts are then cut together into one film, so the look must be consistent across all three.

## Reference
- Video: `/home/user/brain/starship-ref/ref.mp4` (3840x2160, 29.97 fps, 92.0 s, with audio). Do not modify it.
- One frame per second at 960 px wide: `/home/user/brain/starship-ref/kf/t001.png` (t = 0 s) … `t092.png` (t = 91 s). LOOK at the ones for your act with the Read tool before designing anything. Extract extra frames with ffmpeg into your own folder if you need them.
- Cut list (scene changes, seconds):
  1. 0.0–4.3: blue sky with wispy clouds, a jet contrail crossing diagonally.
  2. 4.3–12.1: view looking up through a dark circular opening (inside a structure) at the launch tower top with its "chopstick" catch arms, structure framing the shot.
  3. 12.1–15.1: low angle on the tower top: the arms, the top platform, steel lattice.
  4. 15.1–18.9: tower top from a high angle with the coastal marsh landscape and sea beyond.
  5. 18.9–30.1: aerial view at golden hour: sun low over the marsh, winding channels catching the light, the launch site with tower(s) far below, lens flare; ends drifting toward the sun / bright haze.
  6. 30.1–60.3: bright sky; the Starship upper stage (silver-black, horizontal "belly-flop" attitude, flaps out) falls through the frame with lens flare, close, then smaller and further; then a wide ground-level shot of the coast and launch site with the ship far up in the sky, descending and flipping upright.
  7. 60.3–65.8: backlit, near-white sky; the tower from the ground through dune grass in the foreground as the ship descends vertically into the tower.
  8. 65.8–71.2: close fisheye shot from the catch arms: the ship's shiny stainless nose and flaps sliding down between the arms, deep blue sky.
  9. 71.2–78.6: tower holding the caught ship against a pale sky.
  10. 78.6–92.0: tower and caught ship against a deep blue sky with a faint moon; slow drift; fade to black around 88 s, black to the end.

## Acts and owners
- Act 1: shots 1–5, t = 0.0–30.1 s, plus the FULL-LENGTH SOUNDTRACK (see Sound). Folder `/home/user/brain/starship-pixel/act1/`.
- Act 2: shot 6, t = 30.1–60.3 s. Folder `/home/user/brain/starship-pixel/act2/`.
- Act 3: shots 7–10, t = 60.3–92.0 s. Folder `/home/user/brain/starship-pixel/act3/`.
- Outputs to `/home/user/brain/starship-pixel-video/actN/` (git-excluded).
Keep the timing of every cut identical to the reference, so the acts and the soundtrack line up exactly.

## Style bible (all three acts must follow it exactly)
- Native resolution 480x270, scaled x4 nearest-neighbour to 1920x1080. Every pixel on screen is a native pixel: no anti-aliasing, no blur filters, no sub-pixel smoothing, no scaling of sprites by non-integer factors. Camera motion and object motion snap to native pixels; use parallax layers and occasional sub-pixel-free techniques (e.g. moving whole layers, dithered fades by ordered patterns) for smoothness.
- 30 fps (export exactly 30.000 fps; the reference is 29.97, keep cut times in seconds).
- Palette: hand-picked, limited: up to 48 colours per shot drawn from these shared ramps (extend within the same hue families only if necessary and say so in your report):
  - sky: #0b1630 #12234a #1a3566 #24508a #3a6fa8 #5b8fc4 #86b0d8 #b3cfe6 #dbe8f2 #f4f7fa
  - warm light / sun: #fffbe8 #fff0b8 #ffd77a #f5b04a #e0823a #b85a2e #7a3524
  - steel: #0e0f12 #1c1f25 #2d323b #434a55 #5f6876 #828c99 #a9b2bd #cdd4db #eef1f4
  - marsh / land: #1c2416 #2c3a22 #44542f #66733f #8c8a55 #b3a571 #d6c99a
  - water / sea: #163042 #24506a #3b7894 #6aa3bb #a9d0dd
  - dark structure: #050608 #0f1216 #1a1e24
- Light: crisp hand-placed highlights; ordered (Bayer 4x4) dithering only in gradients (sky, glow, haze) and in dithered fades; clean clusters elsewhere; no pillow shading, no orphan pixels except intended glints/stars.
- Lens flare and sun glare: drawn as pixel-art shapes (rings, hexagons, streaks) in the warm/sky ramps, never as smooth bloom.
- Rocket and tower: the ship is a stainless-steel cylinder with a rounded nose, two forward and two aft flaps, black heat-shield tiles on one side; the tower is a square steel lattice with two big catch arms ("chopsticks") on a carriage. No logos, no text, no flags anywhere.
- Creative liberty: make it more beautiful than the reference (richer skies, better composition within each shot, little living details: birds, waves glinting, heat shimmer done in pixels, cloud drift, clanking arms), but keep each shot's content, camera idea and timing.

## Technical contract
- Code: Canvas 2D in the browser, rendered frame by frame with Playwright (pre-installed: `require('playwright')`, `chromium.launch()` with no options; don't install another). Draw into a 480x270 indexed/RGBA buffer, then scale x4 with `imageSmoothingEnabled = false`.
- Deterministic: every frame a pure function of t (seeded PRNG, no Math.random / Date).
- `index.html` in your act folder plays your act live; `?t=` freezes; `?export` exposes `window.__act = { renderAt(t), start, end, isReady() }` with t in film seconds (your act's absolute range).
- Encode your act: `actN.mp4`, 1920x1080, 30 fps, H.264 High, yuv420p, CRF 14, `-tune animation`, silent, exact duration of the act. Pipe frames into ffmpeg; do not keep frame dumps. Disk is tight (~8 GB free shared by three agents): keep under ~1.5 GB each.
- Also export `stills/` (one native-resolution PNG and one 1920x1080 PNG per shot at its best moment) and a contact sheet (one frame per second).
- Do NOT run git. Do not touch the other acts' folders or the reference. No glob deletes; delete your own files by name.

## Sound (Act 1 owner only)
Compose and synthesize the full 92.0 s soundtrack `/home/user/brain/starship-pixel-video/score.wav` (48 kHz stereo) timed to the cut list: an original chiptune-meets-orchestral score (pulse/triangle/noise channels plus a few lush pads), building from calm sky to tension during the descent, a big swell at the catch (~65-70 s), a triumphant resolve at 71-78 s, and a soft ending into the fade at 88 s. Add pixel-era sound design: wind, a distant jet, the ship's sonic booms when it appears (~30 s), the Raptor engine roar during the landing burn (~55-66 s, in chiptune noise style), the clank of the arms catching (~68 s). Original music only (don't imitate a recognisable melody). Mix to -14 LUFS integrated, true peak below -1 dBTP. Listen-free checks: loudness, no clipping, sync with the cut list.

## Improvement loop (mandatory, all agents)
Do not stop at a first version. Run rounds until a full critique finds nothing that would make your act better:
1. Save a contact sheet per round in your output folder under `snapshots/roundN.png`.
2. Look at full-resolution frames of every shot and 100% crops with the Read tool, and compare against the reference frames for the same seconds.
3. Critique as a ruthless pixel artist and film editor. Score 1-10: pixel-art craft (clusters, palette, dithering, readability); faithfulness to the shot (content, camera, timing); beauty and creative upgrade; motion quality (smooth, no jitter or popping, pixel-snapped); consistency with the style bible; emotional impact.
4. Fix every item below 9; revert anything that doesn't clearly improve it.
5. Repeat until no item is below 9 and you can't name a concrete improvement. Expect at least 5 rounds.
Also check: no flashing hazards (no more than 3 large-area luminance flashes per second; careful with lens flares and cuts).

## Final report (short)
Paths, per-shot description, how it's built, rounds with one line each, final scores, any palette extensions, known limitations.
