# First Snow, Orchard — one painting in JavaScript

Make one still artwork in JavaScript that looks like a masterful oil painting, not a code demo. It will be posted on X by an artist who makes generative art. The same brief is being given to several painters independently; yours will be compared side by side with theirs.

## The painting
"First Snow, Orchard": an old apple orchard under the first snowfall at blue hour. Bare, gnarled apple trees in rows receding into the dusk, fresh snow on the ground and on the upper sides of the branches, a few last red apples still hanging. Beyond the trees, one small farmhouse with a single window glowing warm orange, its light spilling onto the snow; smoke rising straight up from the chimney. Snow is falling lightly. Cold violet-blue shadows against the one warm light. Quiet, still, a little lonely, beautiful.

The look: real oil paint on canvas. Visible brushwork that follows form, thick impasto in the snow highlights with thin transparent darks, soft and hard edges used deliberately, canvas weave showing through thin passages, a clear focal point and strong value structure. Darks must be deep and rich, never washed out or grey; no colour shifts or banding. Every area should reward a close look at 100%: no flat, empty, repetitive or obviously procedural regions. No text, signature, logo or frame.

You make all the artistic decisions (composition, palette, how the paint is simulated).

## Technical
- Your code folder: `/home/user/brain/first-snow/SLOT/`. Your output folder: `/home/user/brain/first-snow-output/SLOT/`. (SLOT is given at the end of this brief.) Touch nothing outside these two folders. Do not run git. No glob deletes.
- A self-contained `index.html` (plus `js/` if you like) that renders the painting on a canvas in a browser from `file://`. Canvas 2D or WebGL; no external downloads; any library must be vendored in your folder.
- Deterministic: seeded PRNG, no Math.random or Date; the same code gives the same image.
- Render with Playwright (pre-installed: `require('playwright')`, `chromium.launch()` with no options; do not install another).
- Deliverables in your output folder:
  - `first-snow-4k.png`: 2160 x 2700 (4:5 portrait).
  - `first-snow-x.jpg`: the same, JPEG quality 92–95, under 4.8 MB.
  - `crops/`: four 100% crops (focal point, darkest area, busiest texture, a corner).
  - `snapshots/roundN.png`: the image at the start of each improvement round.

## Improve it before you finish
Do not stop at a first version. Work in rounds: render, LOOK at the full image and at 100% crops with the Read tool, critique it as a ruthless art director and a master oil painter (composition, medium authenticity, colour and darks, detail at 100%, light and depth, emotional impact; score each 1–10), fix what is weakest, and repeat until you cannot name a concrete improvement. Revert any change that doesn't clearly help.

## Final report (short)
Paths; what you painted and how the paint is simulated; the rounds, one line each; your final scores; anything still weak.
