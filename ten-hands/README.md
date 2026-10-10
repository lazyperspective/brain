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
