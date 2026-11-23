# Everywhere I look, I see Claude: plan

Stage: analysis and proposal only. Nothing is rendered as video yet.

## 0. The clips: technical facts

| Clip | Length | Shot | Place / light |
|---|---|---|---|
| IMG_1584 | 14.9 s | balcony, slow pan right over the valley | Alpine village, overcast midday |
| IMG_1596 | 13.4 s | road → 4× + 4× zoom onto a barn → long pan right across fields | valley floor, overcast, telephoto haze |
| IMG_1605 | 13.8 s | walking: ground → tilt up to a square → pan to a white palace | Innsbruck centre, bright overcast, wet paving |
| IMG_1606 | 8.1 s | walking, looking down at own shoes → bike passes → tilt up | same square |
| IMG_1623 | 10.5 s | fast tilt up from cobbles → walk → 4× zoom into a Christmas-lit street | Innsbruck old town, dusk, warm fairy lights |
| IMG_1631 | 8.3 s | balcony → ×15 zoom onto a snowy summit, 3 s hold | blue hour, very soft (digital zoom) |
| IMG_1633 | 6.4 s | balcony → ×16 zoom → whip pan right | blue hour, heavy blur and smear |
| IMG_1661 | 9.4 s | looking straight up at a street lamp + 3 wires from a pole top → roll → tilt down along the wires to a far A-frame pole across a road; car passes | overcast morning, flat sky |

- **Rotation:** all 8 are stored 1920×1080 with a −90° display matrix, so they are **portrait 1080×1920**. ffmpeg's autorotate handles this. The film should be vertical 9:16.
- **Colour:** all 8 are **HLG (arib-std-b67), BT.2020, 10-bit, with Dolby Vision profile 8.1 metadata**. They need tone-mapping. A plain conversion looks grey and washed out. I tested `zscale=t=linear:npl=100 → bt709 primaries → tonemap=hable:desat=0 → bt709`, and it looks right. All proxies and mockups use it.
- **Frame rate:** 1584, 1605, 1606, 1623 and 1661 are 30 fps CFR. 1596, 1631 and 1633 are slightly variable (avg 29.97–29.99). Conform everything to 30 fps CFR (the proxies already are).
- **Audio:** stereo AAC 48 kHz, plus an extra 4-channel spatial stream.
  - 1605 and 1606 are loud (−15 LUFS) but more than 90 % of the energy is below 200 Hz. That is **wind buffeting, so unusable**.
  - 1584, 1596, 1631 and 1633 are near-silent room tone (−39 to −53 LUFS).
  - **Usable:** 1661 has a real car pass at 6.0–7.5 s, and 1623 has a low crowd murmur.
  - So the soundtrack is music plus designed SFX, with those two real sounds layered in.

Measurement method: OpenCV LK features → RANSAC similarity transform per frame on the SDR proxies (pan, tilt, zoom, roll), plus Laplacian sharpness. Raw data is in `work/motion/*.json`. Below, pan speeds are in full-res px/s, and "content moves left" means the camera pans right.

## 1. Per-clip breakdown and gags

### IMG_1584: balcony pan (contact_IMG_1584.jpg)
- **Content:** the roof eave and gutter (top-left) at 0–1.5 s. A corrugated roof ridge runs across the bottom fifth of the frame from 1.5 to 9.5 s, with a vent on the ridge. Valley, village and mountain at 0–6 s, clouds at 6–10 s. A big spruce enters at 10 s, then chalets with red roofs at 12–14.9 s.
- **Motion:**
  - Steady pan right. It accelerates from 0 to 2 s, then holds at about **620–670 px/s from 2 to 9.5 s**, with a slight tilt up.
  - It slows to about 150–300 px/s from 10.5 to 14.9 s.
  - There is a small zoom-out (×0.74) at 11.2–11.9 s.
  - Sharpness drops from 3 to 9 s (soft sky).
- **Trackable:** the roof ridge (a strong texture, easy 2D track) and the spruce (a parallax layer).
- **Gag A, the cold open:** the character is **already sprinting along the roof ridge at exactly the pan speed**, so it stays put in frame while the world slides by, with headband tails streaming. Around 6 s it glances at the camera, does a double-take, skids, and drops flat behind the ridge (hides).
- **Gag B, flurry insert:** at 11.0 s it peeks out from the side of the spruce. Needles shake, then it is gone.

### IMG_1596: zoom to barn, then long pan (contact_IMG_1596.jpg)
- **Content:** wet road at 0–1 s, then two pinch zooms:
  - ×4.0 at 0.6–2.2 s
  - ×4.3 at 2.2–4.2 s, plus a tilt up. It **lands at 3.7–4.5 s on a barn with a log pile in front**.
- **Then a long pan right, 4.5–13.4 s, accelerating from 165 to 900 px/s.** It passes:
  - the barn
  - a **molehill** in the field (6.0–7.5 s)
  - a **row of five green-wrapped hay bales** (8.6–10.4 s)
  - a wayside cross and an autumn tree (9.5–10.6 s)
  - **high-voltage pylons** (8–9 s, 12.5–13.4 s)
- At ×17 telephoto the image is flat, hazy and soft. Motion blur grows with the pan.
- **Trackable:** the log pile top (a flat ledge), the field plane and the bale row. All are near-planar at this zoom, so a 2D similarity track is enough.
- **Gag A, "discovered on zoom":** the zoom lands at 3.7 s on the character on top of the log pile, **mid-stretch and mid-yawn** (arms up, eyes shut). At 4.4 s it opens its eyes, sees the camera, and freezes with eyes wide and mouth "o". The arms come down very slowly, as if that makes it invisible. (mockup_2)
- **Gag B, "hiding in plain sight":** five bales, and a sixth coral "bale" at the end of the row: squashed flat, eyes closed, stock-still. As the pan passes (around 9.6 s), one eye opens. Then it **bolts right and outruns the pan**, motion-blurred, out of frame.
- **Spare gag:** at 6.0–7.5 s it pops its head out of the molehill like a mole, sees us, and ducks down.
- **Flurry insert:** at 12.8 s it sits on top of the far pylon, kicking its feet.

### IMG_1605: walk, tilt up, pan (contact_IMG_1605.jpg)
- **Content:**
  - Wet asphalt with tactile paving lines at 0–1 s.
  - **A woman standing and looking at her phone** at 0.6–2.0 s (feet first, then her whole figure).
  - A fast tilt up and pan right at 0–3 s (×2.7 perspective change) to the square, with a yellow theatre building and an orange tree.
  - **A tactile guide strip leading straight to a manhole cover**, centre frame, at 3.0–5.0 s.
  - Walking forward at 5–9.5 s, with pedestrians.
  - A pan right at 10–13.8 s (about 800 px/s, with roll) to the white palace and **a lamp post** (13.0–13.8 s).
- **Trackable:** the ground plane (strong lines, so a homography) and the lamp post.
- **Gag A, mimicry:** beside the woman's shoes, the character is also hunched over a tiny glowing phone. The tilt up reveals them side by side in identical poses. **This needs your OK, because she is a recognisable stranger.**
- **Gag B, manhole:** at 3.3 s the manhole lid lifts, the character peeks out, sees us, and the lid slams shut (clank) at 4.2 s.
- **Flurry insert:** at 13.3 s it sits on top of the palace lamp post.

### IMG_1606: looking at own shoes (contact_IMG_1606.jpg)
- **Content:** asphalt, a white line and tactile paving. **The user's jeans and grey sneakers fill the bottom at 0.8–2.2 s.** A **bicycle passes at 3.4–4.2 s**. Tilt up at 4.5–6 s to the square, palace and manhole.
- **Motion:** the camera rolls hard (+35–45°/s) at 0–1.5 s while walking. Then tilt up at about 500 px/s.
- **Trackable:** the ground plane from the paving lines. This is handheld walking, so it needs a homography per frame. The bike is a moving object, so it needs a manual track.
- **Gag A:** **it is walking right beside the user's feet, matching their steps.** It looks straight up into the lens and gives a cheery wave. This is the warmest "it's following me" beat. (mockup_3)
- **Gag B:** it rides past clinging to the bicycle's rear rack and waves goodbye. Optional, and the first thing to cut if time is short.

### IMG_1623: old town (contact_IMG_1623.jpg)
- **Content:** a heavy-blur tilt up from cobbles at 0–2 s (1000 px/s), then a walk with pink and yellow facades. Then a **×4.1 zoom at 5.0–7.5 s into a street strung with Christmas light garlands (glowing doves)** over a crowd. Hold at 7.5–10.5 s.
- **Trackable:** the garland lines and facades. Once zoomed in this is near-static, so a similarity track works.
- **Gag:** as the zoom settles, the character is **hanging on a light garland among the glowing doves**, legs swinging. When the frame stops it freezes and pretends to be one of the ornaments. The lights twinkle and it blinks in time with them. Its blush and top catch the warm fairy-light colour.
- **Flurry insert:** at 9.6 s it walks among the pedestrians toward the camera, at shin height.

### IMG_1631: summit zoom, blue hour (contact_IMG_1631.jpg)
- **Content:** balcony and roof at 0–1 s. **A ×15 zoom at 0.8–5.0 s onto a snowy summit**, then a **3 s steady hold (5.0–8.3 s)** on the peak against a flat blue sky.
- **Motion:** smooth throughout. The image is very soft (digital zoom) and the light is cold and blue.
- **Trackable:** the ridge silhouette. A similarity track is easy (300–600 inliers).
- **Gag, the ending:** the zoom lands and the character is **standing on the summit, looking straight back at us through binoculars**. It lowers them, gives a happy-eyes smile and a wave. The coral against the blue frame is the only warm colour, so it reads instantly. (mockup_4)

### IMG_1633: summit zoom plus whip (contact_IMG_1633.jpg)
- **Content:** balcony at 0–0.5 s, a ×16 zoom at 0.4–3.0 s onto the ridge, then a **whip pan right at 3.0–6.4 s (up to 2000 px/s)**. The image is heavily smeared, with a visible stitching seam around 4.0 s and only 30–200 inliers.
- **Gag:** the character sprints along the ridge and the whip feels like the camera chasing it. Use the whip mainly as a transition (a coral streak inside the blur).
- **Risky.** Keep only 2.6–3.6 s.

### IMG_1661: the electricity pole, the user's example (contact_IMG_1661.jpg)
- **Content:**
  - Looking straight up: **a street lamp** (head at about x 650–705, y 1070–1340) and **three wires from the pole's crossarm** (dark, top right, with insulators).
  - **The camera rolls about 35°** at 0.8–3.6 s.
  - It then **tilts down along the three wires** at 3.6–9.4 s. They converge on a **far A-frame pole** across a road and field.
  - **A white car passes underneath** at 7.0–7.5 s.
  - It ends on the road and the distant pole at 8.6–9.4 s.
- **Tracking:** the sky has almost no features (40–60 inliers), so the global track is weak. The lamp and wires, however, are crisp dark lines. Hough lines found all of them cleanly (for example, at 2.9 s the near wire runs at −57.5°).
- **Gag, the set piece:**
  1. 0.4–1.3 s: it is **hanging from the bottom of the lamp head by both fists**, feet dangling, idly swinging.
  2. 1.3 s: it notices the camera ("caught"), with wide eyes.
  3. 2.0–2.8 s: it scrambles up and leaps for the nearest wire (lamp and wire are adjacent in frame at about 3 s). It throws its headband-cream strap over the wire.
  4. 2.9 s on: it **zip-lines away down the wire**, tails streaming, motion-blurred, getting smaller as the wires converge. The tilt down follows it.
  5. 7.0–7.5 s: it **zips over the passing car** (real car whoosh in the audio).
  6. 8.3 s: it lands on top of the far pole and does a tiny victory pose (fist pump, squash and bounce).
  (mockup_1)

## 2. The edit: timed shot list

The music is **120 BPM** (1 beat = 0.5 s, 1 bar = 2 s). Every cut falls on a beat. Every shot opens mid-action. There is no text anywhere.

| # | Film time | Beats | Source | What happens |
|---|---|---|---|---|
| 1 | 0.0–3.0 | 6 | 1584 4.0–7.0 | **Cold open:** already sprinting on the roof ridge in lockstep with the pan. Double-take, skid, drops out of sight. |
| 2 | 3.0–5.5 | 5 | 1596 3.0–5.5 | The zoom lands on the log pile: mid-yawn stretch, then **caught** (eyes pop at 4.4). Slow-motion arms down. |
| 3 | 5.5–7.0 | 3 | 1605 0.9–2.4 | Phone mimicry beside the woman. *(Fallback: cut this and give its beats to shot 4.)* |
| 4 | 7.0–8.5 | 3 | 1605 3.2–4.7 | Manhole: lid up, peek, clank. |
| 5 | 8.5–10.5 | 4 | 1596 8.6–10.6 | Sixth hay bale: one eye opens, then it **bolts and outruns the pan**. |
| 6 | 10.5–12.0 | 3 | 1606 0.8–2.3 | Walking beside the user's shoes, looks up, **waves**. |
| 7 | 12.0–13.0 | 2 | 1606 3.3–4.3 | Rides past on the bike's rear rack, waving. *(Optional.)* |
| 8 | 13.0–14.5 | 3 | 1623 6.2–7.7 | The zoom settles: it is an "ornament" on the light garland, blinking with the lights. |
| 9 | 14.5–15.5 | 2 | 1633 2.6–3.6 | Ridge sprint; the whip pan chases it. Whip transition into 10. |
| 10 | 15.5–22.5 | 14 | 1661 0.4–3.4 real time, then 3.4–6.4 at 3× speed (1 s), then 6.4–9.4 real time | **The set piece:** lamp hang → caught → leap → zip-line → over the car → lands on the far pole, fist pump. |
| 11 | 22.5–24.0 | 1, 1, ½, ½ | 1584 11.0, 1605 13.2, 1623 9.6, 1596 12.8 | **Flurry:** spruce peek / on the palace lamp / walking in the crowd / on the pylon. Each a single glimpse. |
| 12 | 24.0–30.0 | 12 | 1631 0.8–5.0 at 1.5× speed (2.8 s), then 5.0–8.2 real time | **The ending** (below). |

**Total: about 30 s.**

**How the cuts speed up:**
- Act 1 (discovery, 0–8.5 s): 6, 5, 3, 3 beats.
- Act 2 (it is getting bolder, 8.5–15.5 s): 4, 3, 2, 3, 2 beats.
- Act 3: one long 14-beat set piece (the breath before the drop), then the flurry at 1, 1, ½ and ½ beats, then the music cuts out for the ending.

**Running thread:** the character's attitude escalates from **hides (roof) → freezes (log pile) → flees (bales) → waves at you (shoes) → shows off (zip-line) → turns the tables (summit)**. In every shot it reacts to the camera a little sooner and a little more boldly. The last shot reveals it has been watching *you*.

## 3. The ending

**Shot 12, IMG_1631:**
1. Hard cut on the downbeat at 24.0 s. **The music stops dead**, leaving only soft wind and room tone.
2. The ×15 zoom pushes in on the blue-hour summit (sped up 1.5×), with a rising tension tone.
3. **The zoom lands at about 26.8 s:** the tiny coral block stands on the summit, **looking straight back into the lens through binoculars**. Hold one beat in silence.
4. It lowers the binoculars, sees us, and gives a happy-eyes smile and a wave (27.6–28.5 s).
5. On the final beat (about 29.5 s) it does the fist pump from the fight video, with a squash-bounce and a tiny "boop" sound. **Hard cut to black**, then one music stinger.

**Why it lands:**
- It pays off the title. "Everywhere I look, I see Claude" flips to "Claude was looking at me".
- The silence after 24 s of music makes the reveal loud.
- Coral on a blue frame is the strongest single image in the footage.
- The zoom is the film's own grammar (discovery by zooming) used one final time.

**Alternatives for you to choose:**
- **(b) Fourth-wall boop:** in 1606, after the tilt up, it runs at the camera and boops the lens. The frame goes coral, then black.
- **(c) End on the zip-line landing** on the far pole (bigger stunt, weaker final image).

## 4. Music and sound

**Music:**
- 120 BPM, a playful "tiny spy caper": plucked or pizzicato bass, brushed funk kit, a marimba or glockenspiel hook, and **chiptune accents** (square-wave arpeggios and blips) as a wink to the pixel fight.
- Small drop-outs (a 1-beat freeze) on each "caught" moment, so the freeze is felt.
- It builds through Act 2, goes big for the zip-line, and the flurry runs on a drum fill. Then silence for the ending.
- It can be synthesized with the same numpy/scipy approach as `rgb-fight/audio/sound.py`, so it is royalty-free and kept in sync by a beat table. A licensed track is the alternative.

**SFX (all designed, quiet and characterful):**
- tiny pitched-up footstep patter
- squash "boing" on landings and freezes
- a camera **focus "bip"** on every caught moment (diegetic phone-camera feel)
- record-stop-free freeze stinger (a short pluck)
- cloth flutter for the headband tails
- manhole clank
- whooshes on the pan and whip
- wire "zzzip" with a rising Doppler whine
- the **real car pass** from 1661
- the real crowd murmur, low, under 1623
- wind bed for the summit
- the final "boop"

Master to −14 LUFS like the earlier videos.

## 5. The look: recommendation

**Recommended: crisp, at footage resolution, as a 3D rebuild of the same design.**

`char/char3d.html` is a three.js re-creation of the coral block hero, built from `base.js` `fighter()`. It keeps:
- the same palette (d97757 body, a8553b shade, f2a585 / f7bfa0 top, cream fff6ea / d9cbb5 headband, 1b1426 eyes, f07a6a blush)
- the same proportions (16 × 14 × 13 body on four 3-unit feet)
- the bevelled edges, the vertical gradient with dark base band and waist seam, and the lit top with a specular spot
- the headband 1–3 units under the top, with a knot at the back corner and the two 7- and 6-segment fluttering tails
- the face on the +x side: pill eyes with a catch-light, blush and mouth variants
- fists, and the lean and squash bend (`off()` / `bodyDyn` logic)

**Why 3D rather than the original pixel code:**
- The original `fighter()` is hard-wired to a fixed 2:1 isometric view (the `P()` projection and its inverse face mapping). It cannot be seen from below (the pole and wires) or from above (the shoes), so it would look pasted on in most of these shots.
- The 3D version can match each shot's camera pitch, roll and lens.
- It takes plate-matched lighting: the sky hemisphere light, and a rim light changed from neon pink to a sky-sampled colour.
- It takes motion blur from the track velocity, plus haze, softness, light wrap, contact shadows and grain.

**Pixel art is kept as a flourish, not as the main look.** A few exits (for example, the bale bolt or the flurry glimpses) can "glitch out" for 2–3 frames into the original pixel ×3 rendering, with the RGB fringe and tear of `fighterFX`. That is a nod to the fight video and the "glitch in reality" idea, without breaking the illusion everywhere.

`mockup_0_look_crisp_vs_pixel.png` shows both on the same log pile at the same size:
- **Left (crisp):** it sits in the haze and softness of the telephoto plate.
- **Right (original pixel ×2 with the neon rim):** charming, but it reads as a sticker.

## 6. Mockups (proof-of-look stills, real frames, full-res comps)

Each panel shows the whole frame at half size, plus a 1:1 or zoomed crop of the boxed area.
- `mockup_0_look_crisp_vs_pixel.png`: the look comparison (IMG_1596 at 4.4 s).
- `mockup_1_pole_lamp_and_zipline.png`: IMG_1661. At 1.0 s it hangs under the lamp head and is caught. At 2.9 s it zip-lines on the near wire (roll-matched at about 37°, motion blur along the wire).
- `mockup_2_woodpile_yawn_then_caught.png`: IMG_1596 at 4.4 s. Full frame, then crops of the yawn-stretch beat and the caught beat. It has a contact shadow on the top log and telephoto haze.
- `mockup_3_shoes_wave.png`: IMG_1606 at 1.4 s. It stands on the white line next to the user's sneaker, leaning back and waving up at the lens, seen from above. It has a soft overcast contact shadow.
- `mockup_4_summit_binoculars_ending.png`: IMG_1631 at 7.0 s. The ending frame, with binoculars, then the wave.

The comps were made with `tools/composite.py`. It applies:
- exposure, white balance toward the local plate, saturation, and distance haze
- a black level matched to the plate
- softness matched to the plate, and directional motion blur
- light wrap and plate-matched grain
- a soft contact-shadow ellipse multiplied into the plate

## 7. Feasibility and risks

| Shot | Camera | Tracking method | Difficulty |
|---|---|---|---|
| 1 roof run | steady pan, about 650 px/s, ~1° roll | 2D KLT similarity track on the corrugated roof; the character's speed is locked to the track | **Easy** |
| 2 log pile | ×4 zoom plus tilt, smooth | similarity track (scale + translation) on the barn and pile; >500 inliers | **Easy–medium** |
| 3 phone mimic | tilt up, roll, ×2.7 perspective, walking | ground-plane homography from the paving lines | **Medium** (plus the stranger question) |
| 4 manhole | walking, tilting | ellipse fit on the cover each frame → corner pin; the lid needs a CG copy textured from the plate, plus a dark hole | **Medium–hard** |
| 5 bales | fast pan, 700–800 px/s, telephoto blur | local 2D track on the bale row; motion blur from the track velocity | **Easy–medium** |
| 6 shoes | handheld walking, rolling 35–45°/s, near top-down | ground homography from the white line and paving; steps synced to the user's steps | **Medium** |
| 7 bike | moving object, 1 s | manual keyframes on the rear rack and hub; heavy motion blur | **Hard**. **Cut first.** |
| 8 garland | ×4 zoom, then near-static | similarity track on the facades and garland | **Easy–medium** |
| 9 ridge whip | ×16 zoom, then a 2000 px/s whip, smear, frame seam | manual; mostly hidden inside the blur | **Risky**: reduce it to a coral streak in the whip, or cut |
| 10 pole | featureless sky, 35° roll, tilt down, converging wires | **per-frame Hough line detection** of the wires and lamp (verified working) → the character's position is a parameter along the chosen wire; scale from the wire convergence; lamp via a 2-point track; manual cleanup | **Medium–hard**. The most important shot: spend about 1/3 of the effort here. |
| 11 flurry | pans | 2D tracks, 0.25–0.5 s each | **Easy** |
| 12 summit | ×15 smooth zoom, then hold | similarity track on the ridge | **Easy** |

**Pipeline:**
1. Tone-mapped SDR plates.
2. Per-shot tracks (OpenCV) stored as per-frame JSON.
3. The 3D character rendered per frame in headless Chromium (Playwright + three.js) with the camera pitch, roll and scale from the track. Animation: keyframed poses plus the ported spring-wobble.
4. Python comp (as in the mockups).
5. ffmpeg conform to 1080×1920 30 fps SDR, then mux with the synthesized score.

**Risks:**
- **Scale consistency.** A "cat-sized" character (about 40 cm) is believable at the shoes and the lamp, but only about 50 px tall at the ×17 log pile and only a few pixels on the summit. The mockups cheat the scale upward in far shots, and the summit uses a giant-on-a-mountain scale for readability. Small digital push-ins in post (×1.2–1.5) on shots 2, 5 and 12 would also help.
- **Very soft plates** (1631, 1633, the 1596 telephoto). The character must be softened to match, and its expressions must be big and simple.
- **Featureless sky** in 1661. Mitigated by the line tracking.
- **Contact and occlusion.** None of the proposed gags needs the character to go behind a real object, except the bale hide (side by side, no overlap needed) and the spruce peek (rotoscope the trunk edge, 0.5 s).

**What I would cut first, in order:**
1. The bike (shot 7)
2. The ridge whip (shot 9, keep it as a streak)
3. The manhole lid (swap in the molehill peek from 1596 at 6.0–7.5 s, which is the same gag on an easy plate)
4. The phone mimic

## 8. Decisions for you

1. **Look:** crisp 3D rebuild (recommended) or the original pixel sprite? And should a few exits glitch out to pixel art?
2. **Ending:** the summit binoculars reversal (recommended), the fourth-wall lens boop, or the zip-line landing?
3. **The stranger in IMG_1605** (the woman on her phone): may she be part of a gag? If not, shot 3 becomes the manhole or molehill.
4. **Character scale:** keep it consistently cat-sized, or cheat it bigger in far shots for readability (recommended: cheat)?
5. **Music:** a synthesized original in the style of the fight's `sound.py`, or a licensed track?
6. **Output:** native vertical 9:16, 1080×1920, about 30 s. OK?
7. **Optional shots:** keep the bike and ridge-whip gags if they track well, or drop them up front?

## Files
- `clips/`: the 8 originals (renamed `IMG_xxxx.mov`).
- `plan/contact_*.jpg`: frames every 0.5 s, timestamped.
- `plan/mockup_*.png`.
- `work/proxy/`: tone-mapped 540×960 30 fps SDR proxies.
- `work/motion/`: per-frame camera-motion JSON.
- `work/plates/`: full-res SDR frames.
- `char/`:
  - `char3d.html` + `render3d.js`: the 3D character renderer
  - `pixel.html` + `render_pixel.js`: the original `fighter()` rendered unchanged, for comparison and glitch frames
  - `node_modules/three@0.169.0`
- `tools/`: `contact.py`, `motion.py`, `summ.py`, `grab.py`, `gridview.py`, `composite.py`.
