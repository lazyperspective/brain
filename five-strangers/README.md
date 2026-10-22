# Five Strangers

Five artworks by five imagined artists who never met, each drawn entirely in JavaScript at the moment the page
opens. There are no image files, models, textures or fonts for the art: every pixel is computed.

Open `index.html` (works from `file://`). Keys: <kbd>←</kbd> <kbd>→</kbd> move, <kbd>1</kbd>–<kbd>5</kbd> jump,
<kbd>i</kbd> index, <kbd>h</kbd> hide the label. `?seed=N` fixes the impression; `?solo` hides the room's label.

| # | Work | Medium | Astonishing for |
|---|------|--------|-----------------|
| 1 | **Where It Hung** | Distemper, daylight and forty years · WebGL | Simplicity. A sun-bleached wall, the unfaded rectangle where a portrait hung, one nail. An afternoon of sunlight crosses it in about six minutes. |
| 2 | **Under the Picnic** | Gouache over pencil on cream board, with ants · Canvas 2D | Complexity. A naturalist's cutaway of a meadow: a colony of several hundred ants walking real tunnel routes, strata, roots, a sleeping toad, and buried things getting older with depth. A 3× loupe follows the pointer. |
| 3 | **Bear, AP View, Patient Age 71** | Radiograph on a lightbox · WebGL2 volume projection | Revelation. An X-ray of a 1950s jointed bear: wood-wool, cotter pins, a growler, a rag-stuffed arm, and a ring where the heart would be. Drag to window/level like a radiologist. |
| 4 | **Mr. Pruett Was Left on the Radiator** | Plasticine, cast iron, tea · WebGL2 ray-marched SDF | Material illusion and wit. A clay gentleman, fingerprints and all, melting politely through a radiator in a tilted-macro photograph. He blinks, in stop motion. |
| 5 | **Mammy Wagon from Hell, Part 2** | Enamel and oil on two stitched flour sacks · Canvas 2D | Audacity. A Ghanaian mobile-cinema poster for a film nobody saw: a demon passenger lorry, a hero with a pistol and a Bible, a woman throwing her soup. Hand-drawn lettering, sack weave, one generator bulb. |

Each piece is one self-contained classic script in `js/pieces/` that registers itself on `window.PIECES`;
`js/main.js` is the room around them. The heavy WebGL pieces (3 and 4) render progressively: a quick proof
first, then refinement.
