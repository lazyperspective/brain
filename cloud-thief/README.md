# The Cloud Thief — 30-second animated short

A tiny robot named Pip steals a baby raincloud named Puff to save a dying flower. Pip and Puff race through a floating steampunk city, and a sneeze turns the whole city into a garden.

**Deliverable:** `The_Cloud_Thief_FINAL.mp4` is 30.0 s, 1920×1080, 24 fps (720 frames), H.264 with AAC stereo audio.

## How it was made (and why not Blender)

The machine had **no GPU and no Blender** (4 CPU cores, 15 GB RAM). Software-only Blender would have meant a huge compromise in render quality or render time. So the whole film is a real-time-style 3D engine that renders offline, frame by frame:

- **Renderer:** Three.js (r170) running in headless Chromium on SwiftShader (CPU WebGL2). `render.mjs` steps time deterministically and reads back each frame. It pipes raw RGBA into ffmpeg.
- **Painterly look** (`src/post.js`), my own post stack:
  - Kuwahara brush filter
  - 3-level bloom
  - sun god-rays
  - depth-based ink outlines
  - teal/warm split-tone grade, chromatic aberration, vignette and film grain
- **Materials** (`src/mats.js`): enamel, copper and cloth get triplanar brush-stroke albedo breakup and rim light. Puff uses a custom wrap-lit "fluff" shader. Clouds are hand-painted procedural canvas textures.
- **World** (`src/city.js`): all procedural. It has stacked towers with arched windows and sills, balconies, pipes, gears, bridges, cables, bunting and the sky market. It also has a bottomless shaft with a turbine, a colossal clock spire, a dome hall and a cloud ocean. The layout is fixed, so every shot is in one geography: balcony, shaft, market, sky rail, retracting bridge.
- **Cast** (`src/chars.js`): Pip, Puff, the stilt-legged vendor, three clockwork guards, varied citizens, mechanical birds, fish airships and the flower.
  - Pip's and Puff's faces are drawn live on 2D canvases every frame. That gives anime expressions: droop, sparkle, ^^, >_<, cross-eyed, tears and blush.
  - Pip's scarf follows Pip's own motion history, so it streams along the path Pip actually travelled.
- **Animation** (`src/shots.js`): about 30 camera setups, written as pure functions of time. That means any frame renders on its own, and the render can be split across processes.
- **Magic** (`src/fx.js`):
  - The bloom wave grows instanced flowers, leaves and vines outward from the sneeze across real city surfaces.
  - The sneeze is a GPU-particle rainbow geyser, plus 42 tapered light-ribbons arcing over the city.
  - Other effects: a rainbow-tinted cloud canopy, near and far rainbow rain, swirling petals, waterfalls, sun motes, dust, sparks and sparkles.
- **Sound** (`tools/audio.py`): original score and sound design, synthesized from scratch with numpy/scipy. Nothing is sampled or licensed.
  - Score: music box, pizzicato, chase percussion, brass stabs, xylophone, pads, formant "choir", flute theme, timpani and orchestral hit.
  - Sound effects: about 60, including the clink, alarm bell, boings, rail grind, airship horn, bridge klaxon, Puff's squeaks and giggles, the "ah… ah… ACHOO", rain, blossom pops and Pip's giggle-bleeps.

## Running it

```bash
npm install                                     # three@0.170.0
node render.mjs --stills 4.6,21.45,28.3         # stills -> stills/
tools/contact.sh "1,5,9,13" sheet.png           # labelled contact sheet at 640x360
node render.mjs --from 0 --to 719 --out frames  # full film frames (≈10 s/frame/process on 4 CPU cores)
python3 tools/audio.py                          # -> audio/mix.wav (needs numpy, scipy)
tools/assemble.sh                               # -> The_Cloud_Thief_FINAL.mp4
```

Open `index.html?t=21.5` through any static server to view a single frame in a browser with a GPU (then it's real-time).

## Files

- `src/`: engine, world, cast, shots, FX, post
- `render.mjs`: headless frame renderer
- `tools/`: contact sheets, soundtrack synth, final assembly
- `audio/`: `mix.wav`, plus separated `score.wav` and `sfx.wav`
- `stills/`: lookdev and contact sheets from the iteration passes
- `references/`: the supplied concept kit

## Honest notes

- There is no `.blend` file. Blender wasn't available and the pipeline doesn't use it. The project source here is the equivalent.
- The characters are built from primitives with hand-keyed procedural animation, not sculpted and rigged meshes. The faces carry the performance.
- The sound is entirely synthesized. It's charming and in sync, but it won't match a recorded orchestra.
- Some fast shots are only a few frames long, as in anime pacing. The guards-freeze beat was cut in favour of a longer inhale.
