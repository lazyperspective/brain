# Still Motions: shared brief for all five pieces

Five generative artworks in JavaScript, each in a different art style, each with a subtle, seamless looping animation. They will be posted on X by an artist who makes generative art. The bar is gallery quality: each piece must look like a real, masterful example of its medium, not "a code demo of" it.

## Where things go
- Your code: `/home/user/brain/still-motions/NN-slug/` (only your own folder). Self-contained: `index.html` that plays the loop live in a browser (works from `file://`; vendor any library you need inside your folder, pinned), `js/`, and `production/` scripts.
- Your outputs: `/home/user/brain/still-motions-output/NN-slug/` (git-excluded; large files fine).
- Do NOT run any git command. Do NOT touch other folders (other agents are working in sibling folders at the same time). No glob deletes; delete specific files by name only.
- No text, signatures, logos or copyrighted characters in the artwork.

## Technical contract
- Deterministic: every frame is a pure function of time t (seeded PRNG, no Math.random, no Date). `index.html?t=3.5` freezes at t; `index.html?export` exposes `window.__piece = { renderAt(t), duration, isReady(), width, height }`.
- Canvas 2D or WebGL, your choice. Chromium + Playwright are pre-installed: `require('playwright')` works, `chromium.launch()` needs no options. Do not install another Playwright. For WebGL headless use SwiftShader (default) and expect it to be slow; budget for it.
- Loop: seamless, 12 to 24 s at 30 fps (pick what suits the motion). Frame at t = duration must equal frame at t = 0: all motion must be periodic with the loop (integer cycles per loop, or smooth-noise sampled on a circle).
- Animation must be SUBTLE: the image is a still artwork that quietly lives. No flashing (no more than 3 luminance flashes per second over any large area), no popping, no jitter, no shimmering aliasing.

## Deliverables (in your output folder)
1. `NN-slug-4k.png`: master still, 2160 x 2700 (4:5), at the best-looking moment of the loop.
2. `NN-slug-x.jpg`: X-ready still, 2160 x 2700, JPEG quality 92 to 95, chroma subsampling 4:4:4, under 4.8 MB.
3. `NN-slug-4x5.mp4`: 1080 x 1350, 30 fps, H.264 High, yuv420p, CRF around 16, `-movflags +faststart`, exactly one loop, silent. Render frames supersampled (for example at 2160 x 2700, then downscaled with a good filter) for clean edges.
4. `NN-slug-4x5-2loops.mp4`: the same, two loops (for checking the seam by eye).
5. `stills/`: about 6 frames across the loop plus `contact-sheet.png`.
6. `snapshots/roundN/`: a still saved at the start of every improvement round, so earlier states are never lost.
7. `production/verification.txt` in your code folder: the check results below.

Encoding note: H.264 can make the loop seam visible (the first frame is a keyframe and looks sharper). A proven fix exists in `/home/user/brain/ink-courtyard/production/render.js` (x264 `zones`: high quality on frame 0 and ramped over the last ~40 frames). Read it and use the same approach. `/home/user/brain/ink-courtyard/production/seamcheck.js` and `flashcheck.js` are working examples of the checks; adapt them.

## Required checks (all must pass, write results to verification.txt)
- Seam: the pixel difference between the last frame and the first is no larger than an ordinary frame-to-frame step (both on raw renders and on the decoded MP4).
- Flash: no large-area luminance flashes.
- Pop: no single-frame jumps (a frame-step outlier more than about 1.5x its neighbours).
- Determinism: rendering the same t twice gives identical pixels.

## The improvement loop (the core of this job)
You do not stop at a first version. You run rounds until a full critique round finds nothing that would make the piece better. "Never come back with weak areas": every weakness you find must be fixed before you report.

Each round:
1. Save a snapshot of the current state (`snapshots/roundN/`).
2. Render the full 4K still and LOOK at it with the Read tool, then crop and look at 100% detail in at least 4 regions (focal point, darkest area, a busy texture area, an edge/corner), plus 2 or 3 frames from across the loop.
3. Critique as a ruthless art director and a master of this specific medium. Score each item 1 to 10 and write it down:
   - Composition: clear focal point, strong silhouette and value structure, eye path, nothing awkwardly cropped or tangent.
   - Medium authenticity: would an expert in this medium believe it? Material texture, how the medium actually behaves (its marks, its edges, its flaws).
   - Colour: harmony, intent, no muddy or accidentally grey areas. Darks are deep and rich, never washed out (the artist dislikes washed-out darks).
   - Detail at 100% zoom: rewards close looking; no flat, empty, or obviously procedural/repetitive areas, no visible tiling, no banding.
   - Light and depth.
   - Animation: subtle, alive, smooth, motivated by the subject; nothing distracting; seamless.
   - Emotional impact: does it make someone stop scrolling?
4. Fix every item below 9. Make each change deliberately; compare before/after at the same t; if a change doesn't clearly improve the piece, revert it. Never make something worse.
5. Repeat. You may only stop when a full round's critique finds no item below 9 and you cannot name a concrete change that would make it better. Expect at least 5 rounds; more is fine.

Then run the checks, render final deliverables, and look at the final contact sheet and the 4K still one last time.

## Final report (short)
- Path list of deliverables.
- What the piece is and how the medium is simulated (3 to 5 bullets).
- The animation: what moves, loop length.
- Rounds run, and the main things fixed in each (one line per round).
- Final scores per checklist item.
- Check results.
