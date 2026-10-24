# ICARUS, IN FOUR HANDS

A four-image portrait carousel (9:16). One myth told by four painters from four
different centuries, each one picking up the story where the last one left off.

| | Title | Painter's world | Mood | Composition |
|---|---|---|---|---|
| I | **The Design** | Renaissance notebook: iron-gall ink, sepia wash and red chalk on laid paper, mirror-written notes | curious, intimate, hopeful | dense, annotated, asymmetric |
| II | **The Ascent** | Post-Impressionist impasto: thick loaded strokes that follow the wind | ecstatic | swirling, diagonal, full to the edges |
| III | **The Sun** | Orphist hard-edged abstraction: flat gouache, compass and ruler | explosive, blinding | centred, radial, symmetrical |
| IV | **The Sea** | Tonalist / colour-field: thin glazes on raw canvas | silent, melancholic | almost empty, horizontal |

There are no shared techniques between the four: line versus mass, relief
versus flatness, warm monochrome versus saturated blue versus hot complements
versus near-grey. What they share is underneath:

- **One story.** The plan, the flight, the catastrophe, the aftermath.
- **One arc.** The flight diagram in *I* marks the stations **I → II → III → IV**.
  Laid side by side, the carousel follows that path: the labyrinth low on the
  page in I, Icarus climbing mid-frame in II, a black glyph at the dead centre
  of the sun in III, and a single feather low on the water in IV.
- **One sun, seen from closer and closer.** A drawn circle in a margin diagram,
  then a glare in the top corner, then the whole frame, then a dim half-disc
  slipping under the horizon.
- **One feather, four ways.** Barb by barb in ink, a fan of impasto, a hard
  lens-shaped shard, and finally a real feather on real water.
- **One drop of gold: the wax.** Amber beads on every quill in I, golden binding
  on the wings in II, the melting sun in III, and in IV, one tiny bead still
  clinging to the floating quill. It is the last warm colour in the set.
- **The labyrinth.** It's on the plan in I and seen far below in II: the prison
  the flight was meant to escape.
- **The ship.** In IV a tiny sail on the horizon keeps going, unaware. That's a
  nod to the *Landscape with the Fall of Icarus* attributed to Bruegel, where
  nobody notices the fall.

## Files

`output/` holds the finished images:

- `01-the-design.png` … `04-the-sea.png`: 2160 × 3840
- `*-1080x1920.png`: the same paintings at standard carousel size
- `00-carousel-overview.jpg`: all four side by side, in order

## How it's made

Every painting is generated in code: no image models, photos, textures or
other assets. `src/lib.js` contains the shared toolkit: seeded noise, a
bristle-brush engine that paints colour and paint height together, height-map
lighting for impasto, canvas weave, and a labyrinth glyph. Each painting is its
own script in `src/`.

```bash
node render.mjs 01-the-design 02-the-ascent 03-the-sun 04-the-sea --w=2160
python3 contact_sheet.py
```

`render.mjs` drives the Playwright Chromium installed in this environment. It
writes full-size PNGs, plus 1080 × 1920 copies when rendering larger. Pass
`--preview` to write small JPEGs to `preview/` while iterating. Rendering is
deterministic, so the same seeds give the same paintings at any resolution.
