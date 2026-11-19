# Wonders of the World: animation feels

The world, the art style, the layout and the framing stay the same. What changes is how things move. Each
clip is the same 10.8 s span, 1920x1080 at 30 fps (325 frames):

- **0 – ~6.0 s:** the build, compressed from the film's 10 s.
- **~6.0 – 6.6 s:** a brief hold on the finished map.
- **Transition:** lands on the Pyramids close-up (2.5×) at exactly **7.5 s** (frame 225) in every feel.
- **~7.9 – 10.8 s:** the balloon lifts off (its peak, as in the film, is beat 3 of the bar, frame 275).

All clips share the same start framing (CAM0, close on the Pyramids) and the same wide framing (WIDE).

**Audio:** every clip carries the film's soundtrack from 2.5 s to 13.33 s, with a 0.35 s fade-in and a
0.6 s fade-out. With that offset, the film's own cut into the Pyramids close-up (10.0 s) falls on our cut at
7.5 s. The bar-3 pickup leads into the transition, and the clip opens on a beat. No feel fights the music.
Rubber hose drops its slabs on eighth notes and bounces on every beat, so it locks to the music. The others
are free-running over it.

**How to run** (from `anim-lab/`, using the shared `.venv`):

    ../.venv/bin/python film.py clip --feel NAME -j 4     # -> out/feel_<n>_<name>.mp4
    ../.venv/bin/python film.py stills --feel NAME --frames 30 120 230
    ../.venv/bin/python film.py strips                    # -> out/feels_strips.jpg

Code lives in `wonders/feels/`. There is one module per feel. `base.py` holds the shared parts: the piece
decomposition, the clip clock and camera, and motion blur.

The renderer copy (`wonders/render.py`) gained a few hooks:

- a per-slab transform and a per-piece outer transform with a clip;
- a tinted band drawn into a layer, used for the plotter's hot layer and the moss edge;
- a life clock separate from the build clock;
- pencil and ground clips, plus an image pass that runs before the paper grain.

Links between slabs (water arcs, bridges) now follow whichever feel is active (`detail.OnTime`).

**Render cost** is measured core-seconds per frame at 1080p, including each worker's ~8 s setup (wall ×
workers / 324 frames). On this 4-core machine a clip takes about 2 to 2.8 minutes of wall time with one
x264 encoder. The baseline costs 1.49.

---

## 0 · current (baseline)

The film as it is today. The build schedule is compressed (SLOW 1.6→1.36, PIECE 1.4→1.23), so the
pencil → ink → wash → arrive-by-nature build finishes by about 6 s. The film's quintic swoop with pull-out
and motion blur lands on the cut.

- Cost: 1.49 core-s/frame (121 s wall, 4 workers).

---

## 1 · popup: Pop-up book

**Pitch:** the world is a folded paper map that opens itself, and the buildings rise with the page.

**Build:**
- The Pyramids panel is the cover. Every other slab is a panel folded on its neighbour, along a fold
  tree: inner four from the Pyramids, outer ring from the inner four.
- Each panel swings over on its crease. This is a true 3D rotation about the crease line, projected
  exactly through the iso matrix.
- While a panel is upside down you see its printed card back: a saffron border and a compass star.
- It lands flat with one soft flap of air.
- As a panel opens, its architecture rises with it. This is V-fold linkage: the rise angle is a function
  of the page angle, and pieces nearest the crease lead.
- After landing, trees, people and boats flick up as paper tabs, rippling outward from the crease.
- Satellites, islets and sky pieces hinge up on their own tabs.
- The rock keel under each slab drops like a pull-down flap.
- Everything is printed: there is no pencil and no wash.

**Life:**
- Trees flutter like stand-ups (±1.6° about their base).
- The balloon swings on its tab as it rises (6°, 0.62 Hz, enveloped by the lift).

**Transition:** a page turn over 26 frames. The wide picture folds back from the bottom-right corner along
a turning fold line (32°→16°). The flap shows its cream back with 10 % show-through of the mirrored print.
The close-up beneath carries a contact shadow along the fold.

**Easing and timing:**
- Each panel takes 1.0 s with an in-out (exponent 2.4). Panels start 0.37 s apart (inner) and 0.28 s
  apart (outer).
- Landing flap: 0.07 rad, damped at 1.7 Hz.
- Pop-ups: smoothstep on the page angle. Tabs: a spring at 2.2 Hz, damping 6.5.
- Page turn: in-out (exponent 2.2).

**Cost:** 1.22–1.41 core-s/frame (114 s wall on 4 workers). The 26 page-turn frames cost about 2× (two
renders and a numpy composite).

---

## 2 · stopmo: Stop-motion on twos

**Pitch:** a cut-out set laid down by an unseen hand under a rostrum camera, shot on twos.

**Build:**
- Everything is held for two frames (15 drawings/s): the world, the life clock and the camera.
- Slabs are placed one by one in the film's spiral order, 0.30 s apart. The hand's soft shadow reaches
  in from the top-right before each placement and withdraws after.
- Each slab arrives in four exposures:
  1. lifted 34 px and tilted up to ±5°;
  2. 42 % lower and less tilted;
  3. pressed in (3.5 % squash);
  4. nudged true, by a sub-pixel offset that it keeps.
- Buildings get the same treatment back-to-front, one exposure apart.
- Small things (trees, people, boats) appear by replacement, a few per exposure: one squashed exposure,
  one stretched, then normal.

**Line and light:** the lines boil through three cycling displacement fields (~1 px). The exposure
flickers by ±0.9 %. Both are applied before the paper grain, so the paper itself stays still.

**Life:**
- Everything walks and sails on twos.
- The puppet balloon gets a fresh hand-set offset every exposure while lifting (±0.35 px, ±2°), so it
  never travels quite smoothly.

**Transition:**
- Three stepped camera nudges in (10 %, 22 %, 36 % of the way, zoom ×1.9).
- A hard cut.
- The close-up bumps into place over three exposures (zoom 0.965 → 0.988 → 1.003, a few px of
  offset).

**Easing and timing:** there is deliberately no easing. Motion comes from discrete poses, with the
spacing chosen per exposure.

**Cost:** 1.18 core-s/frame (127 s wall, 3 workers). Each pose is rendered twice; caching the odd frames
would halve this.

---

## 3 · toybox: Toy box

**Pitch:** painted wooden toys dropped into place: gravity, a squash, a hop, a puff of dust.

**Build:**
- Slabs drop from 300 map px under constant gravity (1400 px/s²), so fall time grows with the square
  root of the height. They stretch slightly as they speed up.
- While a slab falls, a soft shadow gathers on the paper beneath it.
- On landing: a 10 % squash, one short heavy hop (3 % of the drop), and a ring of dust puffs along the
  slab's front edges. The camera takes a thud: a 3.2 px vertical shake at 11 Hz, damped.
- Buildings then drop onto the slab back-to-front (60–140 px, 16 % squash, a small puff).
- Last comes a patter of trees, people and boats, tossed in from 34–60 px. These bounce twice and squash
  30 %.
- Slabs land 0.31 s apart. Satellites and islets follow 0.11 s apart. The sky lowers in last.

**Life:** before it lets go, the balloon squats (8 % wide, 10 % down), then lifts and kicks up a puff of
dust.

**Transition:** the camera itself drops into the close-up. Over 16 frames it moves on pure acceleration
(u^2.2, no ease-in to the landing), with heavy motion blur (shutter 0.8). It overshoots the zoom by ~5.5 %
and springs back at 1.7 Hz, with a 3 px thud at 8 Hz.

**Easing and timing:**
- Everything falls on t², never on a designed ease.
- Impacts decay exponentially (55 ms squash). There is one hop, two for the light pieces.

**Cost:** 1.19 core-s/frame (128 s wall, 3 workers). The 16 transition frames cost ~2.5× (blur sub-frames).

---

## 4 · tide: Tide

**Pitch:** one ripple of reality rolls out from the Pyramids, and the world forms in its wake.

**Build:**
- A single wavefront leaves the Pyramids' shore and rolls outward. It decelerates:
  R = R0 + (Rmax−R0)(1−(1−p)²) over 5.6 s.
- Nothing exists beyond the front, not even the pencil. Pencil and ground-level shapes are clipped to the
  ring.
- At the front, the construction lines flash and are wiped within 0.3 s.
- Just behind the front the ink traces: slab +0.02 s, structure +0.16 s, detail +0.30 s.
- Behind the ink the colour floods in on the ring itself: ground +0.12 s, structures +0.34 s. Water still
  pours with its foam.
- Things rise and pop in the wake, each by its own nature (the film's own arrival kinds). Every shape is
  re-timed by its own distance from the Pyramids.
- As the swell passes under each slab it lifts it 5 px and settles.
- The ring is drawn on the paper (ink and foam) with three fading echo rings, plus a faint wet sheen over
  everything.

**Camera:** the pull-back is tied to the wave. The zoom follows the ring radius, so the front stays in
frame.

**Life:** the balloon's lift-off sends four rings across the sand.

**Transition:** a ripple dissolve over 26 frames. The close-up opens inside a wobbly ring that spreads
from the Pyramids. A refraction band pulls the incoming picture outward just inside the rim, and a dark
meniscus and a bright sheen mark the edge. Meanwhile the wide drifts 35 % in.

**Easing and timing:**
- Everything derives from one decelerating curve, so the build slows down as it reaches the edge of
  the world: a long exhale.
- The film's pencil → ink → wash order is kept, but compressed into the wake.

**Cost:** 1.65 core-s/frame (134 s wall, 4 workers). This is the only feel that still draws pencil,
trims and washes. The 26 dissolve frames cost about 2×.

---

## 5 · plotter: Plotter / 3D print

**Pitch:** the world is printed layer by layer at a constant feed rate: precise, mechanical, satisfying.

**Build:**
- The bed is printed in a serpentine raster: one slab job after another, back row to front, alternating
  left-right and right-left. Jobs start 0.2 s apart; a second head prints the sky.
- Each job first rules its footprint in blue pencil (the slicer preview).
- The slab is then laid down from the bottom of its rock keel up through the topsoil at 150 map px/s.
  The top face fills front-to-back, like a recoater sweep.
- Everything on the slab then extrudes from the ground up, one z-layer at a time, at 78 px/s. Short things
  finish fast; the Eiffel tower and Everest take longest.
- The layer being laid glows saffron. Fresh layers show faint layer lines that cure away over 0.8 s.
- Velocity profiles are trapezoids (accelerate, cruise, decelerate), never springs.

**Life:** the balloon rises perfectly plumb on a motion-control trapezoid (25 % ramps). The film's sway is
cancelled.

**Transition:** a 34-frame motion-control dolly. It runs at constant speed with 28 % ramps: no pull-out,
no overshoot, mild blur (shutter 0.5).

**Easing and timing:** linear feed rates, trapezoidal moves. Nothing anticipates or overshoots.

**Cost:** 1.57 core-s/frame (127 s wall, 4 workers). There is one extra Skia layer per piece while it
prints.

---

## 6 · rubber: Rubber hose

**Pitch:** an elastic cartoon with huge squash and stretch and overshoot, where everything bounces on the beat.

**Build:**
- Slabs are dropped on eighth notes (spacing 0.31 s). Each falls stretched (0.72 × 1.45) for 0.16 s and
  splats flat (1.32 × 0.62).
- After the splat it jiggles like jelly: volume-preserving sx/sy at 2.6 Hz, decay 4.0.
- Buildings shoot up far too tall and thin (sy 1.55, sx 0.62, 0.11 s), snap back, and wobble with a
  rubber-hose sway (7°).
- Trees, people and boats boing in from nothing: a spring at 2.4 Hz with a 14° wiggle.

**Life:**
- Once landed, everything keeps bouncing to the music: a small squash on every beat at 72 BPM,
  3.5 % for trees and 1.8 % for buildings, like a 1930s cartoon.
- The balloon gathers itself into a huge squash (30 %, 0.45 s), snaps to a stretch, launches, and wobbles
  as it climbs.

**Transition:**
- Anticipation: the camera backs off 7 % and leans away over 9 frames.
- A 9-frame whip, quintic in-out, with smear frames (shutter 1.5, 6×5 sub-samples).
- An overshoot past the landing that springs back (10 %, 1.9 Hz).

**Easing and timing:** springs everywhere, everything on the beat grid, overshoot as a rule.

**Cost:** 1.19 core-s/frame (128 s wall, 3 workers). The 9 smear frames cost ~3×.

---

## 7 · growth: Timelapse garden

**Pitch:** the world grows like a garden filmed over a season: roots, moss, sprouting stone. The clock slows
to real time as we arrive.

**Build:**
- Growth spreads outward from the Pyramids slab by slab, timed by distance.
- On each slab, the ground creeps across as moss or lichen does: a cluster of 4–7 growing patches seeded
  along the edge that faces the Pyramids. The patches are wobbly blobs unioned into one clip, with a darker
  living edge (a moss-green band).
- Roots follow: the rock keel grows downward.
- The buildings sprout as thin shoots that swell as they rise, on sigmoid growth (smootherstep). Width
  lags height. They sway toward the light (7°) and straighten as they mature.
- Trees unfurl from a 32° curl.

**Life:**
- Life runs on a timelapse clock: ×6 until 4 s, then smoothly back to ×1 by 6.9 s. People, boats, flocks
  and clouds stream about at six times speed.
- The light breathes through day and night (±2 %, cool and warm).
- Once we land, everything is in real time.
- The balloon breathes as the burner heats it (±4.5 % at 1.25 Hz), then drifts up like a seed.

**Transition:** a slow spiral push over 40 frames, shaped like a growing shell. The offset from the target
turns 115° while it shrinks, swinging out a little on the way. The zoom interpolates in log space, and
there is mild blur.

**Easing and timing:** sigmoids and slow in-outs. Nothing bounces. The overall gesture is the speed ramp.

**Cost:** 1.51 core-s/frame (122 s wall, 4 workers). The moss clip uses Skia path ops per slab while it
grows.

---

## 8 · sand: Sand dream

**Pitch:** each wonder condenses out of drifting sand blown off the Pyramids, like a dream remembering
itself.

**Build:**
- The Pyramids' desert is the source. Ribbons of grains (700 per slab) lift off its dunes and drift out
  on slow, curling winds (quadratic paths with lift and turbulence) to where each slab will be.
- There the slab condenses grain by grain. The slab is drawn into a layer, masked by a map-anchored,
  rank-uniform grain noise (fine grain plus soft clumps) through a Skia colour-matrix threshold.
- It forms as a faint mist of itself first, then thickens to solid colour, in soft clumps, over 1.55 s.
- Easing is long, overlapping and in-out. Nothing snaps or bounces. The camera floats on two slow sines.

**Life:** as the balloon lifts, sand trickles from its basket.

**Transition:** a grain dissolve over 30 frames. The close-up condenses over the wide through the same
grain noise while the wide softens (a slight blur) and drifts in 25 %. The close-up settles from 6 % large.

**Easing and timing:** in-out (exponent 1.7) on every formation. Formations overlap by ~80 %.

**Cost:** 2.07 core-s/frame (168 s wall, 4 workers), the most expensive. That includes one bounded Skia
layer per slab while it forms, ~5 k grain points per frame, and 30 dissolve frames at about 2×.
