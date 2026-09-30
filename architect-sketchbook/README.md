# Architect's Sketchbook

Six hand-drawn sheets, drawn stroke by stroke in the browser with plain JavaScript and the Canvas 2D API. No libraries and no build step.

Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

| # | Sheet | Look |
|---|-------|------|
| 1 | Spaceship (ISV Argo-7) | soft-pencil orthographic multi-view on cream, with red/green wiring and orbit insets |
| 2 | Burj Khalifa | kraft-paper worm's-eye view, black crosshatch, slate wash, white pen highlights |
| 3 | Suspension bridge | blue ballpoint, with fog as scalloped smoke ropes |
| 4 | Space elevator | mint graph paper, orbit construction circles, red ascent path |
| 5 | Mechanical robot | PCB-style inking with red/green trace bundles |
| 6 | Pyramids of Giza | kraft low-angle view with scaffolding, sun-path geometry and star alignment |
| 8 | Cathedral of St. Aubert | sepia ink and wash architectural sections: longitudinal, transverse with flying buttresses, and detail plates |
| 9 | Watch movement (plan) | black ink + red: flat plan of a tourbillon / perpetual-calendar / repeater movement, escapement in four stages |
| 10 | Watch movement (3D) | true perspective exploded view built on `engine3d.js`: solids, hidden surfaces, light-driven hatching, six 3D detail plates |
| 11 | Nave (cinematic 3D) | low-angle one-point perspective, hatched by the light, depth fog |
| 12 | Camera, exploded | 3D exploded rangefinder: vertical explosion, lens and shutter sub-assemblies, red springs and screws, callouts, parts schedule |
| 7 | The Library Tree (original) | cyanotype: engraved white line-work on brush-edged Prussian blue, lit rooms drawn in negative |

Controls: `←` / `→` change sheet, `Space` finishes the drawing, `R` redraws it, and the speed button cycles 0.5× to 4×.

## How it works

- `js/engine.js` records every mark as an "op": a wobbly pencil line with overshoot and pressure, a hatch clipped to a polygon, a watercolour wash, a dimension line, or a lettered note. Lettering comes from a built-in single-stroke architect's alphabet, so it needs no fonts.
- `js/engine3d.js` adds a perspective camera, extruded solids (gears, rings, cylinders, bars), painter's-algorithm occlusion and light-driven pen hatching, so a 3D model is still drawn as hand-inked strokes.
- `js/main.js` replays the ops as a pen, paints the per-sheet paper theme (kraft, mint, pcb, pencil, bluepen, cream) and handles the UI.
- `js/scenes/*.js` are the six drawings. Each is a function that receives a `Page` and draws in a 1600×1000 sheet space.
