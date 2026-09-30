# Hand Studies

One sheet from an imaginary anatomy sketchbook: ten pen-and-ink studies of hands (open palm, back of
the hand, pointing, cupped, reaching in perspective, fist, side view, claw, precision grip, and an
unfinished construction study), drawn entirely in JavaScript onto a flat warm-paper canvas.
No images, textures, tracing or 3D models — every mark is a procedurally placed pen stroke.

Open `index.html`. It inks the sheet in about 25 seconds (progressively). Click the sheet to toggle
between fit-to-window and 1:1 (2700 × 3600).  `?only=fist,side` draws just those studies.

## How it is drawn (the way an artist would)

There is no depth buffer, no mesh, no shadow map and no per-pixel lighting. The pipeline mimics a drawing:

1. **Scaffolding (`skeleton.js`)** — a light skeleton per hand (joint angles, bone lengths, rough
   section sizes). It is never drawn directly; it only tells the block-in where things go.
2. **Block-in (`forms.js`)** — the skeleton is viewed through a simple perspective and turned into flat
   2D shapes: one per phalanx, the thumb segments, the palm + wrist + forearm block, and small webs.
3. **Which is in front (`scene.js`)** — the artist's decision about overlaps. Shading is a simple
   analytic across-the-width cylinder/sphere model per shape, plus short contact shading beside
   overlaps and soft bumps for muscle, tendon and knuckle. Evaluated only at points where the pen is
   about to make a mark.
4. **The pen (`pencil.js`)** — an underdrawing of joint circles and bone axes; cross-contour hatching
   that follows each form; angled hatching in each form's own frame, cross-hatched only as it
   darkens; stippling in the half-tones; lost-and-found contours (heavier on the shadow side, thinner
   and broken on the lit side, doubled here and there); creases, knuckle wrinkles, tendons, veins and
   nails. Each stroke is a variable-width polygon with pressure, wobble, bow, taper and overshoot.

`poses.js` holds the gestures; `main.js` lays out the sheet.
