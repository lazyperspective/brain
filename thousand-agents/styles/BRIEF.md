# 1000 Agents — style exploration: the same 3 seconds in a different art style

An artist who posts generative JavaScript art on X is making an animation: "1000 agents build an operating system from an empty folder". Before the full piece is built they want to choose an art style and format. Several animators are each making THE SAME FIRST 3 SECONDS in a different style; yours is given at the end of this brief (STYLE and SLOT). The results will be shown side by side, so make yours the best possible example of its style.

## The 3 seconds (same beats for everyone)
- 0.0–0.5 s: an empty folder appears in a near-empty dark space, with "0 items". Something is already moving at frame 0.
- 0.0–1.25 s: the main character hops in and stops beside the folder.
- 1.25–1.95 s: it looks at the folder, glances around, blinks.
- 1.95 s: it gives the signal (a hop, an arm raised, mouth open).
- 2.1–3.0 s: the folder opens with a warm light inside and agents pour out like a fountain; about 250 of the eventual 1000 are out by 3.0 s. A small "AGENTS 0244"-style counter is optional.
An existing flat pixel-art version of these 3 seconds is the reference for the beats: stills in /home/user/brain/thousand-agents-video/preview/ (still-t0.0/1.0/2.0/3.0.png, strip-every-3rd-frame.png) and code in /home/user/brain/thousand-agents/js/piece.js (it also contains the character's sprite data and palette). LOOK at the stills first. Do not copy its look: translate the scene fully into YOUR style and format; you may change camera, staging and proportions freely as your style demands, keeping the beats.

## The main character
The hero of the artist's "Fable Saga": a small coral block creature: a wide rounded-rectangular body, four short leg stubs, two small arm nubs, two black eyes with a glint, no mouth except when it calls out. Palette: coral #d97757, shade #a8553b, light #f2a585, dark #6e2a1a. Calm and charming here: blinks, small hops, looks around. Interpret it in your style (a 3D style builds it as a 3D object, etc.) but it must be instantly recognisable as the same character.

## Look
Dark, rich background (deep, never washed-out greys), restrained palette (the coral family for everything alive, one or two cool accents such as lilac for interface elements), generous empty space, elegant and minimal. No flashing.

## Technical
- Pure JavaScript, no external assets or libraries: Canvas 2D or raw WebGL written by hand (no three.js or other downloads). Fonts: draw your own glyphs or use the generic monospace.
- Code: /home/user/brain/thousand-agents/styles/SLOT/index.html (+ js/). It plays the 3 s live in a loop from file://; `?t=1.5` freezes; `?export` exposes `window.__piece = { renderAt(t), duration, isReady() }`. Deterministic: each frame a pure function of t (seeded PRNG, no Math.random or Date).
- Outputs: /home/user/brain/thousand-agents-video/styles/SLOT/: `preview-3s.mp4` (1920x1080, 30 fps, exactly 90 frames, H.264 High, yuv420p, CRF 14, +faststart, silent), `preview-3s-loop3.mp4` (the same played three times), `still-t0.0.png`, `still-t1.0.png`, `still-t2.0.png`, `still-t3.0.png` (1920x1080).
- Render frame by frame with Playwright (pre-installed: require('playwright'), chromium.launch() with no options; for WebGL, SwiftShader is the default and is slow: budget for it; pipe frames into ffmpeg, no frame dumps).
- Do NOT run git. Touch nothing outside your two SLOT folders. No glob deletes. Under 300 MB of disk.

## Quality
Run at least 3 quick rounds: render stills and a strip of every 3rd frame, LOOK at them with the Read tool including 100% crops, critique (is it a strong, unmistakable example of the style? character recognisable and charming? composition, darks, crispness/cleanliness, the fountain of agents readable?), fix the weakest things, repeat.

## Report (brief)
Paths; what your 3 seconds look like; how the style is achieved technically; what the rest of the film (code blocks assembling, a kernel forming, a boot screen, windows, a login) would look like in this style, in two sentences; honest weaknesses.
