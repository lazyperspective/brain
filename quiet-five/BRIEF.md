# Quiet Five — one living painting in JavaScript

You are building ONE of five pieces. Each is a near-still artwork with one subtle, seamless loop of motion, posted on X by an artist who makes generative art. Your piece must look like a real work in its medium (a painting, an ink drawing, hand-placed pixel art) that happens to breathe — not a code demo, not a screensaver. A viewer, the X algorithm and a critical LLM should all look at it and say "this is a quality post."

The rule for all five: **detailed does not mean busy.** At most about five elements in the frame. The quality comes from light, material, edges, value structure and motion that is slow and physically right. Every area must reward a look at 100%: no flat, empty-looking, repetitive or obviously procedural regions (empty paper or dark wall is fine when it has real surface texture). Darks deep and rich, never washed out or grey; no colour shifts, no banding. No text, signature, logo or frame. You make every artistic decision inside your piece's spec.

## Motion
- One seamless loop of the length given in your spec, at 30 fps. Frame 0 and frame N must be continuous: no visible jump on repeat. Design the motion to be periodic (closed paths, periodic functions, a simulation whose state at t=L equals t=0 — e.g. run it over a warm-up and make spawning periodic mod L). No crossfade cheats unless the crossfade is invisible on inspection.
- Motion is subtle: most of the frame is still; the moving things move slowly and with correct weight. Nothing jitters, flickers harshly or swims. The still frame must work as a standalone image.

## Technical
- Code folder: `/home/user/brain/quiet-five/SLUG/`. Output folder: `/home/user/brain/quiet-five-output/SLUG/`. (SLUG is given in your task.) Touch nothing outside these two folders. Do not run git. No glob deletes (delete files by explicit name). Keep your output folder under 2 GB.
- Self-contained `index.html` (+ `js/`) that plays the loop live in a browser from `file://`. Canvas 2D or WebGL; no external downloads; vendor any library in your folder.
- Deterministic: seeded PRNG, no Math.random or Date. Expose `window.__piece = { renderAt(t, opts) }` (t in seconds, 0..L) when the URL has `?export`, and `?t=` to freeze a frame. The same t always gives the same pixels. You may render at a supersampled resolution and downscale.
- Render frames with Playwright (pre-installed: `require('playwright')`, `chromium.launch()` with no options; do not install another) and pipe them into ffmpeg. Browser WebGL runs on SwiftShader (CPU): keep the per-frame cost such that the full loop renders in under ~60 minutes; heavy static layers (canvas, paper, background paint) should be computed once and cached, with only the moving parts redrawn.

## Deliverables (in your output folder)
- `loop-4x5.mp4`: 1080×1350, 30 fps, exactly one loop, H.264 High, yuv420p, CRF ≤ 16, `-movflags +faststart`, silent, BT.709 tagged. Check the darks survive the encode.
- `loop-4x5-x3.mp4`: the same loop repeated 3 times (for posting; X autoplay loops).
- `still-4k.png`: 2160×2700 (4:5), rendered natively at that size, the best moment of the loop. `still-x.jpg`: the same, JPEG quality 92–95, under 4.8 MB.
- `contact-sheet.png`: 12 evenly spaced frames of the loop. `seam.png`: the last 3 and first 3 frames side by side, to prove the loop is seamless.
- `crops/`: four 100% crops of the 4K still (focal point, darkest area, busiest texture, a corner).
- `snapshots/roundN.png`: the still at the start of each improvement round.
- `verification.txt`: probe output, loop length, render time, seam check (mean abs pixel diff between last→first frame vs. typical frame→frame diff), the darkest-region luminance before and after encode.

## Improve it before you finish
Do not stop at a first version. Work in at least 4 rounds: render, LOOK at the full still, 100% crops, the contact sheet and the seam with the Read tool; critique it as a ruthless art director and a master of the medium (composition, medium authenticity, light and material, colour and darks, detail at 100%, motion quality, emotional impact — score each 1–10); fix the weakest thing; repeat until you cannot name a concrete improvement and every score is at least 8.5. Revert any change that doesn't clearly help. You can't watch the video at speed, so judge motion from strips of consecutive frames and from the math.

## Final report (short)
Paths; what you made and how the medium and the motion are simulated; the rounds, one line each; final scores; anything still weak.

---

# The five pieces

## 1. `still-life-lemon` — Still Life with Lemon, Pewter and a Knife (oil painting). Loop: 10 s.
A Dutch Golden Age table against a near-black wall. A half-peeled lemon on a pewter plate, its peel spiralling down off the table edge; a bone-handled knife whose handle overhangs the edge; a glass of white wine (roemer or simple goblet) with one bubble clinging inside. Nothing else. Strong chiaroscuro from a single warm source upper left.
Motion: an off-frame candle flickers, so highlights breathe — on the pewter rim, the wine's meniscus, the wet lemon flesh (soft, irregular, low-amplitude; no strobing). The hanging peel turns a few degrees in a slow draft. Once per loop the bubble lets go and rises.
Palette: bone black, raw umber, lead white, greenish-grey pewter, and one lemon yellow — the only saturated colour.
Craft: subsurface glow in the lemon flesh and pith; blurred, slightly tarnished reflections in the pewter; the glass refracting the wall and the wine casting a warm caustic on the tablecloth/table; oil-paint surface with impasto in highlights, thin transparent darks, fine craquelure in the varnish, canvas weave in the shadows.

## 2. `two-koi` — Two Koi, Ink on Rice Paper (sumi-e). Loop: 12 s.
Bare warm rice paper, mostly empty. Two koi below the surface, each made of only a handful of confident brush strokes; one has a single vermilion patch. One ginkgo leaf floats on the surface. Optional: a faint red seal-like square is NOT allowed (no text/marks); keep it to fish, leaf, water.
Motion: the koi trace one slow closed path (they never collide, bodies flex with the turn, tails lead the motion). When a fish passes under the leaf, one ring spreads outward and the leaf rocks; the leaf's shadow wobbles. Ripples are faint ink-wash distortions, not graphics.
Palette: warm paper white, five ink greys, one vermilion.
Craft: ink bleeding along paper fibres with darker dried edges; each fish a single pressure-varying stroke along a spline that frays where the brush runs dry (dry-brush); paper fibre and deckle texture at 100%; water suggested by distortion and shadow, not outlines. Restraint is the point: lots of breathing space.

## 3. `keepers-last-night` — The Keeper's Last Night (pixel art). Loop: 8 s.
Native buffer 216×270 (4:5), scaled ×5 nearest-neighbour to 1080×1350 and ×10 to 2160×2700. A lighthouse on a black rock at the tail of a storm; the keeper's cottage beside it with one lit window; a heavy sea; clouds breaking to show a few stars.
Motion: the beam sweeps in one full 8 s rotation (visible both towards and away from the viewer, with perspective). The beam lights the rain only where it passes, and flashes the wave crests it crosses. The sea heaves slowly; foam follows wave shapes. The cottage window flickers once between sweeps (someone walks past).
Palette: 16 colours max — storm blues, slate, foam whites, one warm amber family for lamp and window.
Craft: every pixel on the grid, no anti-aliasing, no filtering; the beam as a volumetric shaft built from ordered (Bayer) dither; dithering only in gradients; clean hand-placed-looking clusters, no pillow shading, no noise speckle; readable silhouette at thumbnail size.

## 4. `dawn-window` — Dawn, a Window, a Glass of Water (oil painting, interior). Loop: 10 s.
Inside a room at 4:47 a.m., looking at one window: a painted wooden frame, a sheer linen curtain half drawn, a glass of water on the sill. Outside, a cold blue sky turning rose at the horizon, a dark rooftop or tree line, one last star.
Motion: the curtain breathes in a draft (cloth with real weight: folds travel, hem lags). The caustic from the glass trembles on the sill as the water settles after a tiny disturbance. The star slowly fades and is back on the loop (design it so the return is not noticed, e.g. it dims through mid-loop and recovers behind a curtain sway).
Palette: cold interior greys and blue-violet shadows vs. the warm rose sky — cold inside, warm outside.
Craft: translucent linen showing the light through the weave, denser where folds double; correct refraction of the window through the water glass and a bright caustic on the sill; a banding-free dawn gradient; painterly brushwork on the wall and frame that follows the light, impasto in the brightest sky, canvas weave in the darks.

## 5. `night-train-rain` — Rain on the Night Train Window (painterly realism). Loop: 12 s.
The view from a train seat: rain on the glass, and behind it a city at night melted into out-of-focus light (sodium-amber streetlights, one cyan sign, windows). Maybe the dark edge of the window frame on one side.
Motion: droplets run down the glass — they pause, grow, merge and leave clear trails; many never move. The bokeh city slides slowly past (parallax: near lights faster). Once per loop, a clear patch shows a sharp lit window flashing by.
Palette: deep navy, sodium amber, one cyan accent.
Craft: each droplet refracts an inverted, sharper miniature of the scene behind it with a dark rim and a highlight; trails cut clean through a light condensation fog; bokeh discs with soft edges, slight onion-ring/chromatic fringe and cat's-eye shapes toward the corners; droplet physics simulated (pinned drops, sliding when mass exceeds a threshold, wandering paths, merging) — nothing looks like a looping sprite. Loop seamlessly (the simulation must be periodic).
