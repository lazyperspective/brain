# Ten Hands

Ten artworks by ten imagined artists. Each one is drawn entirely in JavaScript at the moment it is opened:
no image files, no models, no textures, no libraries and no build step.

Open `index.html` in a browser (it works straight from the file system), or serve the folder with
`python3 -m http.server`.

Controls: `←` / `→` move between works, `1`–`0` jump, `i` opens the index, `h` hides the label.
Add `?seed=N` to the URL to pin a work's random seed (otherwise every visit is a new impression), and
`?solo` to hide the label entirely.

## How it is put together

- `index.html`, `style.css` and `js/main.js` are the room: navigation, the label, fades.
- Each artwork is one self-contained file in `js/pieces/`. It registers itself on `window.PIECES` with its
  title, medium and a `mount(el, api)` function, and owns everything inside `el`. `api.seed` drives all of
  its randomness; `api.ready()` tells the room to fade it in.

## The ten works

| # | Work | Medium | How it is made |
|---|------|--------|----------------|
| 1 | The Deer Who Carried the First Maize | Yarn pressed into beeswax, after the Wixárika tradition | Every figure is filled with yarn strands following distance-field contours; each strand is a twisted, shaded, slightly fuzzy cylinder. Zoom in. |
| 2 | Vole, Owl, Snow | Blind embossing (karazuri) on kozo paper | White on white. A WebGL height field lit by a raking light that follows the pointer: the image exists only as relief. |
| 3 | Carcere XVII: The Well of Stairs | Mezzotint on laid paper | A ray-marched impossible interior, printed through a simulated rocker ground, scraper marks and plate tone. |
| 4 | A Line Goes for a Walk | Steel nib and India ink, one stroke | One line, drawn live and never lifted, keeps turning into things, ending with the hand that draws it. |
| 5 | Hours of the Distracted Scribe, fol. 47v | Ink, tempera and burnished gold on vellum | A procedural textura hand, drolleries in the margins, and gold on gesso lit by a lamp that follows the pointer. |
| 6 | A Small Night, Mended Twice | Tenmoku stoneware with kintsugi | One tea bowl rendered like a museum photograph: hare's-fur glaze, iridescent oil spots, gold seams. Drag to turn it. |
| 7 | Night Snow at Hōrai Crossing | Colour woodblock print on washi | A shin-hanga of vending machines in the snow, printed block by block; each visit is a new impression. |
| 8 | Garden Room, Fragment with a Jay | Fresco with losses and tratteggio | A Roman garden painting plus two thousand years of decay, built as plaster with depth. A conservator's lamp follows the pointer. |
| 9 | One Hill, a Hundred Years | Charcoal and eraser, one sheet | A simulated sheet of paper is drawn, erased and redrawn through a century; every erased state stays as a ghost. |
| 10 | Inside the Whale, a Lamp Is Lit | Cut-paper tunnel book | Nine cut sheets with parallax, cast shadows and backlight through the paper, into a lamplit room inside a whale. |
