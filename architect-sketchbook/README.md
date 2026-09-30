# Architect's Sketchbook

Six hand-drawn sheets, drawn stroke by stroke in the browser with plain JavaScript and the Canvas 2D API. No libraries and no build step.

Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

| # | Sheet | Treatment |
|---|-------|-----------|
| 1 | Spaceship | pencil + watercolour |
| 2 | Burj Khalifa | graphite only |
| 3 | Suspension bridge | pencil + watercolour |
| 4 | Space elevator | graphite only |
| 5 | Ancient mechanical robot | brown ink only |
| 6 | Pyramids of Giza | pencil + sand watercolour |

Controls: `←` / `→` change sheet, `Space` finishes the drawing, `R` redraws it, and the speed button cycles 0.5× to 4×.

## How it works

- `js/engine.js` records every mark as an "op": a wobbly pencil line with overshoot and pressure, a hatch clipped to a polygon, a watercolour wash, a dimension line, or a lettered note. Lettering comes from a built-in single-stroke architect's alphabet, so it needs no fonts.
- `js/main.js` replays the ops as a pen, paints the paper (grid, fibres, tape, grain) and handles the UI.
- `js/scenes/*.js` are the six drawings. Each is a function that receives a `Page` and draws in a 1600×1000 sheet space.
