# Three Sketchbooks

Three drawings by three imagined draughtsmen, each made entirely in JavaScript at the moment the page opens.
No images, models, textures or font files: every mark is an authored stroke with its own path, pressure and speed.

Open `index.html` (works from `file://`). Keys: <kbd>←</kbd> <kbd>→</kbd> move, <kbd>1</kbd>–<kbd>3</kbd> jump,
<kbd>i</kbd> index, <kbd>h</kbd> hide the label. `?seed=N` fixes the impression; `?solo` hides the room's label.

| # | Drawing | Medium | Philosophy |
|---|---------|--------|------------|
| 1 | **Breath** | Fingertip on condensation, night bus window · WebGL | Expressive simplicity. Six strokes of one finger on a fogged window: a stranger asleep across the aisle, drawn in negative, the rainy city showing through the lines. Water beads along the edges, drops run, the fog takes the drawing back, and the finger draws it again. You can draw on the glass. |
| 2 | **Studies of a Sirena, from the Life, over Three Nights** | Silverpoint, lead white and brown ink on prepared paper · Canvas 2D | Extraordinary intricacy. A left-handed anatomist's sheet: a mermaid's skeleton and flayed musculature, two skulls, the shoulder girdle, the spine turning into tail, gills, webbed hands, a tail section, scale studies, mirror-script notes. About 486,000 marks, run through the tooth of a bone-ash ground. Press and hold for a lens. |
| 3 | **The People v. a Goose** | Pastel, porous-point pen and watercolour on toned paper · Canvas 2D | An unexpected approach: drawing as reportage. A courtroom artist draws a hearing at the speed it happens, in dark pastel on blue-grey paper. The goose would not sit still, so the sheet keeps the necks already drawn, and the margin keeps the minutes. Each visit is a different session of the same trial. |

Each drawing is one self-contained classic script in `js/pieces/` that registers itself on `window.PIECES`;
`js/main.js` is the room around them.
