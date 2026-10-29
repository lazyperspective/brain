# The Lantern Fox — brief

A 36.000 s Christmas pixel-art short for the Fable Saga gallery (piece 07). 480 × 270 indexed buffer, 4×, 26-px
letterbox (picture rows 26..243). One film, not a loop (the gallery rests ~2 s on the last frame, then plays again).
Every frame is a pure function of t.

## Look

- **Light is the story.** The world is cool (blue dusk, moonlight, storm); the only warm thing is the lantern until the
  lighthouse takes its flame. The lantern is a moving point light: every surface that can be lit is stored as a small
  G-buffer (material, ambient shade, depth, normal) and shaded per frame by the lamp, through per-scene material tables
  (albedo × (ambient + moon·shade + lamp·lambert) → nearest palette colour, dithered between levels). So the warm pool
  slides over snow, bark, ice, fur and faces with a real falloff, a Lambert term (lit side of trunks), the lantern
  cage's spoke shadows, the cap's shadow above, and a fox-shaped shadow thrown back across the snow.
- Atmospheric perspective by depth (per-plane fog tables toward each scene's haze colour), 4–6 parallax planes per shot,
  bloom on lights (z_frame grade), soft vignette.
- Characters are signed-distance rigs (smooth unions of tapered capsules, as Carry's snail), shaded from the field's
  gradient: pillowy, resolution-independent (the same fox is drawn 8 px tall on the cliff and 120 px tall in close-up).
- Palette: the shared 176 entries + 79 new (fox oranges and their moonlit mauves, warm-lit whites, sock blacks, brass
  and candle, blue-hour sky, teal pines, cool and warm bark, ice cyans, aurora greens, deer browns, storm greys,
  lighthouse stone, interior warms).

## Characters

- **The fox kit**: big head (≈ 0.45 of body length), huge ears with black tips and cream insides, enormous tail with a
  white tip and tufted edge, orange coat, white chest bib, cheeks and muzzle, black socks, big glossy eyes (two
  catchlights + the lantern's warm glint), black nose with a highlight. Rig: far legs / far ear pass, tail pass, body
  pass, head pass. Real trot (diagonal pairs, stance slide + swing arc, two-bone legs), body bob, head counter-bob,
  ear flicks, tail follow-through (evaluated from the body's past motion, so still a pure function of t), squash and
  stretch on the hop, blinks. The lantern swings on its bail from the fox's mouth, a damped pendulum driven by the
  head's motion (integrated over the last second each frame: deterministic).
- **The keeper**: old man on a stool, red knitted sweater with a cream snowflake band, big white beard, knit cap,
  heavy boots. Acting: slumped and sad by the dead lens → looks up (surprise) → hope (brows lift, smile) → reaches,
  takes the lantern, sets it in the lens → warm smile, hand resting near the fox.
- **Owls** (forest): two, on boughs; heads swivel to follow the lantern, blink, eyes catch gold.
- **Deer** (meadow): a herd of six; grazing, then heads rise one after another as the light passes; ear flicks, a fawn.

## Shots (t in seconds) and camera

| t | shot | camera | key beats |
|---|---|---|---|
| 0.0–5.0 | **1 · The find.** Snowy pine forest, blue dusk, Christmas Eve. Planes: sky (blue hour, rose band low), misty far pines, mid pines, the fox's clearing (drifts, a fallen log, snowy pines with heavy boughs), foreground snowy branches + falling snow. | fade up from black (0–0.9), slow push-in z 1.00→1.38 onto the fox and the glow (0–3.4); eases back to 1.0 and drifts right (4.2–5.0) | 0–1.6 sniffs at the glow (nose bobs, ear flick 1.0); 1.6–2.8 paws the snow away (three scrapes, puffs of snow), the lantern emerges; 2.8–3.4 the light blooms on its face; 3.3 delight: ears up, eyes wide and shining, hop 3.7–4.1 (squash/stretch), tail wag; 4.3–5.0 takes the bail in its mouth and lifts |
| 5.0–11.0 | **2 · Through the woods.** Same forest (one continuous world): the fox trots right; pool of light sliding over snow and trunks, snow sparkling where it touches, paw prints left behind. Owl 1 (≈6.6) and owl 2 (≈9.0) turn their heads to watch. | tracking right, eased up to trot speed; fox held at ~42 % of frame width | trot from 5.4; lantern swing; owls swivel and blink; 10.3–11.0 a dark foreground trunk sweeps across and the scene dissolves behind it |
| 11.0–17.0 | **3 · The frozen waterfall.** Towering ice columns and icicles between dark cliffs, a frozen pool and river in front; the river visibly moving under the ice. Lantern light refracts in the ice (gold + cyan caustics, internal cracks lit). | z 1.25→1.0 while craning up (reveal the height); 15.6–17.0 tilts up past the top of the falls into the sky | the fox crosses the ice left→right (11.4–15.6), slips slightly on the ice (13.2), steadies; lantern light runs up the columns |
| 17.0–23.0 | **4 · The aurora meadow.** Moonlit snowy meadow under green aurora curtains (violet hems), moon, stars, a herd of deer, birch/pine edges, and far off on the coast a dark lighthouse on a headland above the sea line. | sky → tilt down to the meadow (17.0–18.4, the shared sky dissolves); slow track right; 21.6–23.0 push in on the lighthouse | deer heads rise in sequence as the fox passes (18.6–21.0); a fawn steps behind its mother; the fox pauses, looks to the lighthouse (21.4) |
| 23.0–30.0 | **5 · The dark lighthouse.** 23.0–25.6 cliff over a stormy black sea: the lighthouse (white, red bands) dark; waves and spray on the rocks; a small ship's lights pitching, lost. 25.6–28.2 inside the tower: a vertical climb up the iron spiral stair round a stone shaft, the lantern's light climbing the walls. 28.2–30.0 the lamp room: the keeper slumped by the dead great Fresnel lens; he looks up. | 23.0 dissolve from the push-in; pan from the ship to the tower and push toward the door; dissolve into the stair; rising camera (scroll up) with the fox; continuous rise through the hatch into the lamp room | fox runs up the path and in (25.2); climbs; pops through the hatch (28.6); keeper looks up 29.0, surprise 29.3, hope 29.7 |
| 30.0–36.0 | **6 · The light.** 30.0–31.0 the keeper takes the lantern; 31.0–31.8 sets it in the lens; 31.8–32.4 it catches: the lens rings light from the centre out over ~16 frames; 32.4–34.2 outside: the beam blazes across the sea through the snow, the ship turns toward the harbour lights; 34.2–36.0 inside again: the fox turns once and curls against the keeper's boots, tail over its nose, eyes close; snow outside the glass; the beam sweeps once more. Final hold ≈35.4–36.0. | push in on the lens; dissolve out to the wide exterior (light-matched, no flash); dissolve back in, slow settle | beam reveal brightens over frames (never a white flash) |

## Music cues (♩ = 120, felt in 2; every integer second is a beat)

- 0.0 solo celesta / music-box theme (the fox), harp, soft strings; D major lullaby.
- 3.0 (light blooms) glockenspiel + harp shimmer, strings warm.
- 5.0 woodland: flute takes the theme, pizzicato walking, harp arpeggios; owl hoots on the turns (6.6, 9.0).
- 11.0 ice: high string harmonics/tremolo, celesta glints, harp in fourths; colder (B minor colour).
- 17.0 aurora: choir oohs/aahs shimmer, strings in D/G, theme in the horn.
- 23.0 storm: low brass, timpani rolls, low strings tremolo, wind/sea fx; D minor colour; the climb (25.6–28.2) rising
  ostinato; 28.2 lamp room: it thins to a lone cello + celesta (the keeper's sadness), hope at 29.7.
- 31.8–32.0 swell (reverse cymbal / strings crescendo) → **32.0 the beam: full orchestra, the theme soaring** (horns +
  violins + timpani), till 34.2.
- 34.2 lullaby: celesta theme returns, strings settle to D, final chord at 34.5, hall tail faded inside 36.0.

## Checks

- stills at several times per shot, two critique/fix rounds each; whole-film contact sheet every 1 s; fox crops
- timing (avg/max ms per frame), flashcheck (frame-to-frame mean-luminance jumps > 60)
- score: 36.000 s, 48 kHz/24-bit stereo, ≈ -16 LUFS, true peak ≤ -1 dBTP
