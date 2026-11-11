# Still Life with Lemon, v2: painting-first rebuild

Piece #1 of `/home/user/brain/quiet-five/BRIEF.md` (read the brief, all of it; its rules, deliverables and loop requirements apply). Your SLUG is `still-life-lemon-v2`:
- code: `/home/user/brain/quiet-five/still-life-lemon-v2/`
- output: `/home/user/brain/quiet-five-output/still-life-lemon-v2/`

## Why there is a v2
A first version exists in `/home/user/brain/quiet-five/still-life-lemon/` (output in `/home/user/brain/quiet-five-output/still-life-lemon/`; look at `still-x.jpg` and `snapshots/`). It was built as a JavaScript ray tracer with a paint layer on top. After ten rounds it still reads as a CG render with a paint filter (its author scored medium authenticity 6.5): the glass is a clean CG bowl with bead prunts, the peel is a smooth-shaded ribbon, the plate a grey disc. A filter over a render cannot get there. Do NOT continue that approach.

What v1 got right and you may reuse (read its code): the loop design (everything periodic in 10 s; the candle flicker built from integer harmonics; layered lighting re-mixed per frame instead of repainting), the bubble timing, the peel sway amplitude, the encode settings that keep the darks.

## The v2 approach: paint it like a painter
Build the image the way a Dutch Golden Age still-life painter (Willem Claesz Heda, Pieter Claesz: tonal "ontbijtje" breakfast pieces) would: a designed composition, a value plan, then a stroke-based oil painting. Reference engine that already produces convincing oil paint in this repo: `/home/user/brain/first-snow/fable/js/engine.js` + `scene.js` (float colour and paint-height buffers, bristle strokes with dry-brush break-up over canvas weave, relief lighting; output `/home/user/brain/first-snow-output/fable/first-snow-x.jpg`). Study it and write your own engine suited to a still life (smaller, more controlled strokes; glazes; impasto highlights).
- Draw each object as designed shapes and form-following strokes, not ray-traced geometry. Light logic comes from your value plan: one warm source upper left; Heda's silvery tonalism; a wall of olive-grey to warm umber glowing behind the objects and darkening to the upper right; a deep warm brown table; cool silvery pewter; the lemon the only saturated note.
- Darks: thin transparent warm glazes with canvas weave showing. Lights: opaque loaded strokes; about 5–10 deliberate lead-white impasto touches for the brightest highlights. Edges lost and found.
- GLASS (roemer): paint it the way painters do: mostly the wall seen through it, slightly shifted and tinted, the wine as a warm golden body with a bright meniscus line, and the glass itself stated by a few confident highlight strokes (a window-like reflection on the bowl, a bright rim accent broken in places, small highlights on each prunt with a dark core), plus the golden caustic on the table. The prunts are raised glass drops with a bright highlight and a dark shadow side, not beads.
- LEMON: pitted waxy rind catching tiny highlights; thick white pith at the cut; translucent glowing flesh with segments and juice highlights.
- PEEL: ~1.75 cm wide, a few mm thick, yellow outside, white pith inside visible as it twists, irregular width, a loose gravity-pulled uneven helix tapering at the end, hanging off the plate rim into the dark foreground. It is the key motion, so it must be painted with strokes that travel WITH it: render it as a separate layer per frame, painting strokes in the peel's own surface coordinates (seeded per segment, so strokes stay attached and don't fizz), lit by the same flickering candle.
- PEWTER PLATE: imperfect ellipse with soft dents, broad dull sheen, a warm blurred reflection of the lemon, one crisp highlight along the front rim.
- KNIFE: bone handle overhanging the table edge on a diagonal leading into the lemon; the steel blade stated by one thin bright highlight and a darker reflection.
- Composition: classic diagonal; glass behind left of centre (not too big), plate jutting over the table edge toward us, knife diagonal, peel as the vertical counterweight hanging into the dark. Five elements only.

## Motion (10 s seamless loop)
Static paint (wall, table, plate, glass, lemon, knife) is painted once, as separate lighting layers (ambient, candle-lit, highlight layers for two flame positions) so the flicker can be re-mixed each frame. Highlights breathe; the peel turns a few degrees in a slow draft (lower turns lagging); the bubble inside the wine clings, grows, lets go once and rises. Nothing strobes.

## Quality bar
As in the brief, plus: judge medium authenticity at 100% honestly — would a museum visitor believe it is oil on canvas? Do not finish with anything below 8.5. Compare each round's still with v1's still and with the First Snow painting. At least 5 rounds. Your folders only, no git, no glob deletes.
