# RGB Fight — handoff

A 30 s pixel-isometric fight video: **Fable 5.2 (coral block hero) vs. its Alter Ego (dark-violet glitch twin)**, in the
"Fable 5.2 Field Guide" format (360×450 pixel art upscaled ×3 to 1080×1350, 30 fps, neon/synthwave RGB style).
**Part 1 (0–15 s) is done.** Next: Part 2 (15–30 s).

## Where things are
- `index.html` loads `js/core.js, helpers.js, font.js, world.js` (shared engine) → `js/base.js` (palette, fighters, arena props,
  hi-res effects) → `js/weapons.js` (sword/axe) → `js/fight.js` (choreography, camera, HUD, the frame).
- `tools/render.js` — `node tools/render.js stills 1.0,2.5 out/prefix` or `node tools/render.js video 0 15 out.mp4` (~1.4 s/frame).
- `audio/sound.py` — numpy/scipy synth score + foley; writes `part1-raw.wav`. Master + mux:
  `ffmpeg -i part1-raw.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.84" audio.wav` then
  `ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart final.mp4`.
- Rendered outputs went to `../../field-guide-video/rgb-fight/` (not in git). `../rgb-proto/` is the 5 s prototype (keep intact).
- Needs: Node 18+, `playwright` + Chromium, ffmpeg, Python 3 with numpy, scipy, pillow.

## How the fight is built (fight.js)
- **Action time vs real time:** `HITS = [[actionTime, freezeSeconds], ...]` are hit-stops; `actionT(realT)` maps real → action.
  All choreography is keyed in action time. `sound.py` has the same table (`rt(a)` maps action → real) — keep them in sync.
- **Fight line:** `pos(s, p)` — s along the line (hero left, alter right), p toward the camera. `SPREAD = 1.25` scales track s.
- **Movement:** keyframe tracks `HK` (hero) / `AKS` (alter): `[a, s, p, hopHeight, ease]`. Poses in `heroAt` / `alterAt` (if-chains by beat).
- **Weapons** swing in the screen-parallel plane (side-on, like a 2D fighting game): `{kind, th (deg: 0 = at opponent, 90 = up,
  180 = behind), f (forward), flat (spin angle), glow, grow}`. Sword idle angle 74, axe 70.
- **Flexible bodies:** `bodyDyn()` simulates a damped spring per fighter from the motion (lag, overshoot, landing squash,
  hit impulses in `IMPULSE`); `flex()` adds pose leans (wind-up back, follow-through forward, punches, spin) and stepping feet.
  Bend is capped (lean 3.4, squash −0.24…0.22) — stronger made the blocks read as flat slabs.
- **HUD:** health bars, damage in `DMG_H` / `DMG_A`. **Words:** one `popLabel` per beat. **Camera:** `CAMK` keys `[a, cx, cy, zoom]`.

## Part 1 beats (action time; real end = 15.0 s)
A 0–2 entrance (alter glitches in, ROUND 1, FIGHT!) · B 2–3.9 fists (block shield, counter-punch) · C 3.9–6 orb drops from
the neon ring → hero gets SWORD! · D 6–8 swing 1 whiffs (alter blinks), swing 2 lands · E 8–10 rift spits GLITCH AXE!, leap +
floor slam (cracks, tiles fly) · F 10–11.6 CLASH! blade lock (sparks, RGB lightning), blown apart · G 11.6–13 spin attack →
AXE BROKEN! · H 13–14.35 hook: shards stream into the alter, sky ring glitches red, RGB copies start peeling off.

## Direction rules the user set (keep these)
- Not chaotic: **one clear action per beat**, every move wound up first, fighters spaced so you can tell who hits whom.
- Captions/words must stay on screen long enough to read; no text appearing out of nowhere.
- Continuous feel — no cuts between sections; quality bar = current Part 1 (detail, shading, neon, flexible bodies).
- Work in chunks, show stills/contact sheets, then render. Keep earlier versions intact when making a v2.
- Commit + push to branch `ten-hands`. Don't commit rendered video (repo rejects >100 MB files).

## Part 2 (15–30 s) — proposed, not yet approved
Continue straight from the hook: the alter splits into three R/G/B copies (as in the prototype), they circle the hero;
a second power-up (hammer or shield) for the hero; copies attack one at a time (readable); a big finisher; the alter
recombines and is KO'd; end title "FABLE 5.2 vs. ITS ALTER EGO". Ask the user to confirm the beat list before building.

## Known weak spots
Sword a bit small in wide shots · spin flips the face between sides (no true rotation) · orb pickup burst competes with "SWORD!".
