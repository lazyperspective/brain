# Eight Paintings: shared brief

Eight still artworks made in JavaScript, two per agent, posted on X by an artist who makes generative art. The bar is gallery quality: each must look like a masterful real example of its medium and style, not a "code demo" of it.

## Where things go
- Code: `/home/user/brain/eight-paintings/NN-slug/` (your two folders only). Self-contained `index.html` that renders the piece in a browser from `file://` (vendor any library inside your folder, pinned), `js/`, `production/`.
- Outputs: `/home/user/brain/eight-paintings-output/NN-slug/` (git-excluded).
- Do NOT run git. Do NOT touch other folders (other agents work in sibling folders at the same time). No glob deletes; delete specific files by name.
- Disk is shared and tight (~9 GB free for 4 agents): keep your usage under ~1 GB; delete your own scratch renders by name.
- No text, signatures, logos or copyrighted characters in the artwork.
- Deterministic: seeded PRNG, no Math.random or Date. Chromium + Playwright are pre-installed (`require('playwright')`, `chromium.launch()` with no options); don't install another Playwright.
- Before starting, glance at what this artist already has, so you don't repeat it: the folders in /home/user/brain (e.g. pixel-quiet, linework, still-motions, the-family, ten-hands, five-strangers) — new work must feel fresh, not a variant of those.

## Deliverables per piece (in its output folder)
1. `NN-slug-4k.png`: master, 2160 x 2700 (4:5). Render supersampled where it helps.
2. `NN-slug-x.jpg`: 2160 x 2700, JPEG quality 92 to 95, 4:4:4 chroma, under 4.8 MB.
3. `crops/`: four 100% crops (focal point, darkest area, busiest texture, an edge/corner).
4. `snapshots/roundN.png`: the state at the start of every improvement round (earlier states are never lost).

## The improvement loop (mandatory)
You do not stop at a first version. Run rounds until a full critique finds nothing that would make the piece better. Never report weak areas: fix them first.

Each round:
1. Save a snapshot.
2. Render the 4K and LOOK at it with the Read tool, then at 100% crops of at least 4 regions.
3. Critique as a ruthless art director and a master of this exact medium. Score 1-10 and write it down: composition (focal point, value structure, eye path, no awkward tangents/crops); medium authenticity (would an expert believe it?); colour (harmony, intent; darks deep and rich, never washed out: the artist dislikes washed-out darks and colour shifts); detail at 100% (no flat, empty, repetitive or obviously procedural areas, no tiling, no banding); light and depth; emotional impact (does it stop the scroll?).
4. Fix every item below 9. Compare before/after; revert anything that doesn't clearly improve. Never make it worse.
5. Repeat until no item is below 9 and you can't name a concrete improvement. Expect at least 5 rounds per piece.

## Final report (short, per piece)
Paths; what it is and how the medium is simulated (3-5 bullets); rounds with one line each; final scores.
