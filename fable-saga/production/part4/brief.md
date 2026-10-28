# Part IV — brief for everyone animating it

## What the user asked for (their words, condensed but faithful)
A sequel to the Unmaker fight, picking up exactly where it ended, with complete continuity. Push everything to its limit:
- **more forms**, each an extraordinary escalation of power, not just a recolour;
- **far more devastating powers**;
- **a new ability: the hero's sword grows to an absolutely MASSIVE size**, in length and scale;
- **a new villain, the Unmaker's brother** (the Sunderer).

THE FIGHT must be "ABSOLUTELY, BRUTALLY, UNFORGIVABLY HARDCORE":
- Every attack carries terrifying weight; every clash is devastating; every impact shows how ridiculously powerful they are.
- The villain is so overwhelming, relentless and merciless that watching the hero struggle is painful. The viewer should
  FEEL SORRY for the hero. The fight feels unfair. Even surviving the next attack feels impossible.
- Just when the hero hits its maximum, push it further, several times. Each limit broken turns out to be nowhere near
  enough.

Visual quality "OUTRAGEOUS":
- Cinematic animation, combat choreography, VFX, transformations, camera, environmental destruction, impact animation.
- No generic attacks, no weak impacts, no repetition, no cheap shortcuts.
- Obsessive detail, but the action stays CLEAR: the viewer must feel every hit.

**"Do not mistake visual spectacle for combat intensity."** The fight must feel physically exhausting, emotionally
punishing, brutally difficult, desperate. The characters earn every moment of progress.

**No new characters, storylines or concepts beyond these.** Build on the established world: above the clouds at dawn;
the dark ocean with rock spires beneath the cloud sea; porcelain masks, void, fire.

## The timing contract
`cues.md` is locked: the score is written to it. Never move a HIT, cue or caption time.

Photosensitivity:
- an impact frame (`impactFrame`) is ONE frame;
- never more than about 3 full-frame flashes in any second;
- check with `node flashcheck.js BUILT t0 t1`.

## Files and ownership
`src/` is concatenated in sorted order by `build.sh` into one IIFE (`'use strict'`).
- **Engine (owner: me):**
  - `a_core.js`: palette, sprites, `actor()`, `life()`, primitives, tints, camera, key tracks, effects;
  - `b_boss.js`: the Unmaker and its powers: `spiralEye`, `rewindFx`, `kaleido`, `shatterFx`, `unwriteFx`, `mapFx`, `INV`, `GREYM`, `orbAt`, `ORB`;
  - `c_kit.js`: part III's helpers, the `z5*` functions;
  - `d_sunderer.js`: the brother;
  - `e_world.js`: part IV's world and power effects;
  - `z_frame.js`: render loop, grade (bloom + vignette), captions.
- **Shots:**
  - `s1_*`–`s3_*` (0–58): me;
  - `s4_stranger.js` (58–104): agent A;
  - `s5_infinite.js` (104–180): agent B.
- **Rules for shot files:**
  - Wrap your whole file in a block `{ ... }` so your helpers are private, and prefix your helper names (`a4…` / `b4…`) to avoid clashes.
  - Only `shot()`, `CAPS`, `FLASH_CUTS` and `WHIPS` escape.
  - If you need an engine change, implement it locally in your file (a wrapper or a copy). Do not edit engine files.

## Tools (run from `fable-saga/production/part4`)
- Build: `OUT=<your scratch>/build.js bash build.sh` (also runs `node --check`).
- Stills: `node render.js out_%t.png t1,t2,... BUILT`.
- Video: `node render.js out.mp4 t0:t1 BUILT` (30 fps, 4×).
- `node strip.js BUILT out.png t0 n step`: n sequential frames, tiled 5 wide. `life()` physics needs consecutive frames, so use this to judge motion.
- `node flashcheck.js BUILT t0 t1`.
- Render cost budget: average under about 45 ms/frame across your section. The grade pass costs about 10 ms of that.

## Engine reference (the essentials; read the source for the rest)
### Frame and basics
- **Frame:** 480×270, letterbox `LB = 26`. `BUF` holds palette indices; there are 124 colours (`PAL_HEX` in `a_core.js` lists every index).
- **Primitives:**
  - `P(x, y, c)`, `rectF`, `lineP`, `lineF(x0, y0, x1, y1, fn)`, `thick`, `discF`, `ring`;
  - `capsF(ax, ay, bx, by, r0, r1, fn(u, d, x, y, nx, ny))`: a shaded capsule, defined in `d_sunderer`;
  - `z5Tri` (filled triangle).
- **Tints:**
  - `tintI` / `tintP` / `tintAll(T, a)` / `glow(cx, cy, r, T, a)`;
  - tables: `T_WH`, `T_GOLD`, `T_WARM`, `T_DARK`, `T_MAG`, `T_CYAN`, `T_VOIDT`, `T_BL`, `T_GR`, `T_YE`, `T_VI`, `T_EMBER`, `T_BLOOD`, `T_ASH`, `T_NOVA`, `T_FIRE`, `T_DEEP`;
  - `mapFx(M, amt)` with `INV` / `GREYM`.
- **Effects:**
  - hits and shockwaves: `impactFrame(x, y, mode)` (ONE frame), `flashWhite(a)` (capped at 0.86), `shockRing(x, y, rx, ry, w, cols, amt)`, `burst`, `hitFx`;
  - lines and streaks: `bolt`, `beam`, `streaks`, `radialLines`, `debris`, `sparkle`, `smearArc`;
  - camera-like: `whip`, `zoomBlur`, `cam(z, r, fx, fy, sx, sy)` (smears edges when off-centre at z<1);
  - **`z5Cam(z, r, fx, fy, sx, sy)` is the better camera.**
- **Shake:** `shk(n)` adds smooth camera shake (picture only; the letterbox never moves).
- **Easing and motion:**
  - `lin`, `sstep`, `eio`, `eoc`, `eic`, `eob`;
  - `z5Knock(g, amp, w, d)` damped recoil, `z5Knocks`, `z5Step`, `z5N` (smooth drift), `z5Sh` (smooth shudder), `z5Bz` (bezier), `ih` (hash), `vn` (value noise);
  - key tracks: `K(...)`, `trk(keys, t)`, `z5Trk` (arcs), `stopClock` (hit-stop).

### The hero
- **Drawing:** `actor(HERO3({...}), x, y, S, ang, flip, opt)`. Options in `{...}`:
  - `form`: undefined (coral), `'grey'`, `'storm'`, `'zenith'`, `'nova'`, `'lastlight'`, `'infinite'`;
  - `eyes`: `'normal'`, `'angry'`, `'wide'`, `'narrow'`, `'closed'`, `'glow'`;
  - `mouth` (0/1/2), `sword` (angle; null for none), `swordCols`, `sq` (squash), `legs`, `reach`, `fly`;
  - `cracks` (0..1): light-leaking cracks across the body.
- **`actor` returns `{ hand, tip }`.**
- **`life()` physics** (automatic for hero draws): lean, stretch, squash, foot trail, sword follow-through, auto slash trails, idle breathing/blinking.
  - `opt.still: true` turns it off (corpses, locked holds); `opt.bob` overrides the hover; `opt.noSmear` / `opt.smear` control the trail.
  - It works off positions in consecutive frames, so animate on continuous eased paths and arcs, not snaps.
- **Wings and zenith helpers:**
  - `z5Zenith(x, y, S, t, o)`: the winged zenith hero, with wings, orbs and aura;
  - `z5Wings(x, y, s, t, spread, flap)` and `z5Orbs(...)`;
  - `z5Fight(keys, tt, base)`: a key-tracked zenith fighter with its own smear;
  - `heroForm(form, o, x, y, S, ang, flip, opt)`: gold, storm or grey, with aura;
  - `aura(t, cols, R, opt)`: the flame round the last stamp.

  These draw `HEROZ` (zenith). For nova, last light and infinite, call `actor(HERO3({ form: 'nova', ... }))` and build the corona and wings yourself, reusing `z5Wings` (recolour by drawing your own, or tint after).
- **The four elements (orbs):** `orbAt(x, y, k, r, t)`; `ORB[k]` are the colours (0 water, 1 leaf, 2 lightning, 3 starlight); `EL_T[k]` are the tints.

### The Sunderer (`d_sunderer.js`)
- **`sunderer(cx, cy, s, t, o)`:** mask centred at (cx, cy); s is screen px per local unit (the mask is 38×50 units, the shoulders about 200 wide, the body runs off the bottom). Options:
  - face: `eyes` 0..2, `rage` 0..1 (the seam widens), `roar` 0..1 (the mouth tears open, teeth), `third` 0..1 (his brother's spiral eye in his brow);
  - fire and glow: `heat` 0..1 (veins and seams), `crown` 0..1 (blades of the crown), `crownSpin`, `glow`, `core` (the molten heart);
  - head movement: `tilt`, `nod`, `still`, `shake`;
  - `arms`: four slots (upper-left, upper-right, lower-left, lower-right), each `{ x, y, pose: 'fist' | 'open' | 'chop' | 'grab', front, cut, ang, heat }` or null. Shoulders are at `SH4`; hand positions are local;
  - damage: `wounds: [[x0, y0, x1, y1, w]]` (body cuts, local), `maskCuts: [[x0, y0, x1, y1, amt]]`;
  - the final cut: `split` 0..1, with `splitA`, `splitX`, `splitY`;
  - `dark` (silhouette), `body: false`, `mask: false`.

  It returns `{ hands: [[x, y] ×4], eyes, core, brow }` in screen px.
- **`sGauntlet(x, y, s, a, pose, heat, t)`:** a lone gauntlet, for close-up punches and grabs. It returns the fingertip point.
- **His palette:**
  - obsidian `OBS = [96..100]`;
  - fire `MOLT = [101..107]` (crimson → molten → white-hot);
  - porcelain `BONE4` (64..69).
- **His caption speaker is `'SUNDERER'`** (tag shown in crimson).

### Part IV world and powers (`e_world.js`)
- **World:**
  - `belowWorld(t, hz, ox, burn, skyCols)`: the ocean, its swell and the rock spires (three parallax layers);
  - `cloudSea(t, y0, ox, cols, holes)`: cloud cover with holes blown through it.
- **`bigBlade(hx, hy, a, len, w, t, { form, grow, snap, snapOff, cracks, flare, surge })`:** THE GREAT SWORD, at any length; clipped to the frame. Forms: `'gold'`, `'nova'`, `'lastlight'`, `'infinite'`, `'steel'`. Returns the tip.
- **Destruction:**
  - `frameCrack(cx, cy, amt, seed)`: the picture breaks like glass;
  - `worldSplit(x0, y0, a, gap, amt, t)`: the SUNDER;
  - `rocks(cx, cy, g, n, v, size, cols, seed, grav, dir, spread)`: boulders and chunks;
  - `warp(cx, cy, R, amt, sy)`: gravity bending the picture.
- **The black sun:** `blackSun(cx, cy, r, t, amt)`.
- **`megaHit(x, y, g, power 1..4, dir, cols, seed)`:** a whole heavy impact. One impact frame, rings, debris along `dir`, light, shake; the frame cracks from power 3.
- **`kick(t, [[time, power, dir]...])`:** returns camera kick terms `[dz, droll, dx, dy]`.
- **Palettes:** `OCEAN`, `ASH`, `SKY_BLOOD`, `SKY_ASH`, `SM_NOVA` / `SM_LAST` / `SM_INF` smear colours, `BLADE_COLS`.

### Captions
`CAPS.push([t0, t1, kind, who, text, y])`: kind `'n'` narration (top), `'s'` speech (bottom, with the speaker tag), `'x'` shout (big, centre, at y).

## The quality bar for every shot
- **Choreography.**
  - Every attack has a readable wind-up, a fast committed strike landing on its locked time, follow-through and recovery.
  - Vary every attack (cleave, uppercut, thrust, spin, hammer-fist, backhand, grab, stomp). No repeats.
  - Travel on arcs; nothing glides at a constant speed; no frozen holds (holds drift, breathe and tremble).
- **Weight.** The Sunderer is a mountain:
  - he moves little and slowly between blows, then impossibly fast for the blow itself;
  - every blow he lands moves the whole frame: shake, camera kick, the sea and clouds displaced, debris;
  - when the hero hits him, the hit should look tiny against his mass, until the later forms, when it visibly hurts him.
- **Hit reactions.**
  - The struck body recoils along the blow, with hit-stop (1–3 frames), ragdoll tumbling and a slow recovery.
  - The hero is hurt: cracks, `eyes: 'closed'`/`'wide'`, limp limbs (`z5Limp`), trembling (`z5Sh`), the sword dragging.
- **Clarity.**
  - Strong silhouettes, one focal point per moment, and camera framing that shows who is hitting whom.
  - Effects serve the hit; they don't hide it.
- **Camera with intent.**
  - Lag-follow, push-ins, kicks on impact (`kick`), whip pans (`WHIPS` / `whip`), tilts for scale, and pull-backs for the giant sword.
- **Scale.** When the sword grows, show it with the camera: the blade passing the frame edge, clouds and horizon for reference, tiny hero, endless blade.
- **Emotion.**
  - The quiet beats are quiet: the near-silent despair, the trembling attempts to rise.
  - The viewer should hurt for the hero.
