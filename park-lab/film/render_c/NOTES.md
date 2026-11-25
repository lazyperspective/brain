# Render agent C: paper / felt / tin (shots 01, 03, 06, 10, 11, 14)

All six shots are rendered to `film/shots/<id>.mp4`: 1920×1080, 30 fps, H.264 yuv420p, CRF 16, exact `render.frames` (verified with ffprobe). Felt (03, 11) and tin (06, 14) are on twos (each unique frame written twice).

| shot | frames | unique | render time (frames only; + ~5–8 min scene build) | check frames |
|---|---|---|---|---|
| 01_paper_ticket | 132 | 132 | ~36 min | `check/01_in.jpg`, `01_out.jpg`, `01_still.jpg` |
| 03_felt_kiddie | 132 | 66 | ~28 min | `check/03_*` |
| 06_tin_toybox | 132 | 66 | ~21 min | `check/06_*` |
| 10_pov_crest_paper | 42 | 42 | ~4 min | `check/10_*` |
| 11_pov_drop_felt | 42 | 21 | ~4 min | `check/11_*` |
| 14_pov_corkscrew_tin | 42 | 21 | ~5 min | `check/14_*` |

The machine was shared with two other render agents (load 8–12 on 4 cores; mine ran at nice 5). The fixed ~5–8 min per run is SwiftShader compiling the shader programs on the GPU thread; the page itself builds the whole park in ~5 s.

## How it works (`render_c/`)
- `render.cjs`: the Playwright harness. It serves `film/`, opens `page.html?shot=…`, renders each unique frame at `t = t_start + i/30`, and pipes PNGs into ffmpeg (no frames on disk). The `--stills t1,t2 --scale 0.5` option writes test stills. It also writes a few preview PNGs to `scratch/preview/`.
- `main.js`: the per-shot setup (ROI/LOD rectangles, lights, sky or table) and the transformation directors (ticket fold and pop-ups, felt puff, toy box), plus the POV logic.
- `world.js`: the style kits (materials and textures), the ground painter (paths with per-type paving patterns, kerbs, stitches or printed outlines, flower beds, berm wildflowers, car park), trees, water, props, queues and guests.
- `rides.js`: building facades, every flat ride, tracks swept along the baked frames, trains with riders, and stations.
- `common.js`: helpers. It covers instancing with world-aligned pre-transforms, triplanar detail and bump injection, felt fuzz shells, the env map, and post-processing (MSAA, then DOF or depth-masked camera motion blur, then a neutral tone map, grade, vignette and grain).
- Cameras are always `park.camera(shot, t)` (fov as vertical fov, near/far 0.3/6000). Ride clocks come from `park.rideTime`/`trainFronts` with the shot overrides. Day sun is SW `#FFF1DC` with an `#BFD9FF` hemisphere fill. In 01 the tabletop key is `#FFD9A0` from [-0.5, 0.8, -0.35]. The shadow map (4096) follows the view.
- LOD: each shot has a "hi" rectangle (dense: 22–24 px/m ground print, 3-D paving slabs, full people with limbs, flower blooms, hanging baskets, multi-lump trees, fuzz shells). Everything else in the site is "mid" (simpler trees and people, printed ground at 4–8 px/m).

## Detail added (all from park.json, nothing moved)
- **Paths:** paving per type at hi LOD: herringbone brick, setts with a compass-rose inlay, a 3 m concrete grid with brick bands, red/cream checker, pastel stamped tiles with hopscotch inlays, boardwalk planks, flagstones, packed earth, broom concrete. Kerb outlines are drawn. Paths are raised slabs: felt applique 0.2 m, cut card 0.22 m, embossed tin 0.08 m. Edges are stitched in felt and printed (navy/cream) in tin.
- **Furniture:** 8 lamp styles by land (Victorian double with a flower basket, triple globe, pastel mushroom, seaside globe, bamboo lantern, modern mast, timber lantern, bulb pole), benches with slats and cast ends, bins, planters with flowers, blank signposts, drinking fountains, 8 cart types with canopies and goods, umbrella tables with 4 chairs, flags, fences, pennant bunting and bulb string lights, hanging baskets, queue posts and rails with fabric/awning canopies.
- **People:** every walker, idler and queued guest, plus seated guests on half the benches and two at each umbrella table. Felt people have head, hair, hats on 25%, body, swinging arms and legs, shoes, skirts and strollers. Tin people are lathed two-tone peg dolls with painted hair and hats that hop. Paper people are three-layer cut-out cards (legs, shirt, head, hair). Balloons are carried by balloon idlers and some children.
- **Buildings:** a facade texture per building (storeys from `storey_heights`, shopfront windows with goods, a blank fascia, window frames, window boxes, quoins), 3-D striped awnings, cornices and parapets (scalloped cut-card parapets in paper), a cupcake kiosk, bandstand, food-court big-top, booths with prize shelves, plush toys and bulb fascias.
- **Rides:** carousel (mirror drum, 36 horses on brass poles, chariots, striped canopy, scalloped valance, bulbs), teacups (lathed cups on 3 turntables), bumper-car pavilion with moving cars on poles, Ferris wheel (paper: cut card with holes), swing ride, pirate ship, drop tower, observation tower, all kiddie rides, playground, dark-ride facade, swan boats.
- **Coasters:** rails, spine and C-bracket ties swept on the baked frames; column and lattice-tower supports with footers; catwalks, handrails and chain on the lifts; fin brakes. The wooden coaster has bents with X-bracing and ledgers. Also flume troughs, the rapids channel with rock banks, and the railway with sleepers. Trains have seats, lap bars, a nose cone and riders whose arms go up on drops, loops and corkscrews. The lead car is red to match shot 09.

## Per style
- **Paper (01, 10):** a walnut table, a 15-panel map sheet that folds exactly like the stack described in EDIT (ticket_print on top at (0, 8), 200×96×6), and a printed illustrated map (tree canopies with offset shadows, ride footprints, dashed coaster lines, a scalloped border, compass star). Flaps land 0.3/0.5/1.0/1.5 with a flop. Pop-ups ripple from the tower at 250 m/s from t = 2.0; landmarks are prioritised; the hero coaster springs up at 3.0 with a boing. Cross-card trees, cut-edge highlights, paper grain and bump, clouds and a sun on sticks, confetti and a pencil. Shot 10 shows the paper park on the table inside a room, with the paper U-strip track and printed ties.
- **Felt (03, 11):** sheen wool materials with triplanar fibre colour and bump (plus a finer near-camera octave), 1–2 fuzz shells with boil on near objects, lumpy needle-felted trees, a stitched-applique ground, and felt clouds. In 03 everything starts as flat side-profile applique: planes 8.5, boats and playground 9.0, trucks and drop 9.5, trees, topiary and hedges on 8ths from 10.0, the family-coaster big puff at 10.5, guests sit up at 11.0, everything moves at 11.5, and the train leaves the station at 11.5.
- **Tin (06, 14):** lithographed patterns with printed borders, halftone, chipped wear (metal/roughness maps) and clearcoat enamel with env reflections. There are toy-stand trees with printed leaves, rivets on track and props, and chrome queue rails. In 06 the box is tin printed as a wooden crate with blue/red stars and chrome corner caps, to match the pixel crate at the end of 05. It hops at 20.0 and 20.25, the lid flips at 20.5, and the walls bounce flat at ~21.0 (their insides show the printed midway). Carousel 21.0, teacups 21.25, bumper cars 21.5, booths in 16ths from 21.75, food court, umbrellas and props at 22.0, and peg dolls hop out from 22.0 to 22.4. The brass key ratchets 6 clicks (1.5 turns) from 22.5 to 23.25, then rides and gears run on a 6-tick/s clockwork clock. The shot tilts to plain sky.

## Deviations / judgement calls
- In 06, six park trees that collided with the clockwork set or the close-up camera are hidden. These are the trees at (168, 78), (179, 87), (182, 90), (176, 103), (184, 104) and (193, 101); the last would have sat in the plain-sky exit frame. Trees standing inside the toy-box footprint spring out with the pieces.
- In 03 the family train is held in the station until 11.5 (ride clock clamped at τ = 0), as the beat sheet asks.
- In POV shots the two front-row neighbours' heads are hidden; they sit 90° to the side and were clipped by the 0.3 m near plane during the roll. Their raised arms remain.

## What I'm not fully happy with
- In the POV shots (10, 11), the director camera pitches down -25…-28°, so the front car and the rider's seat fill the lower third to half of the frame at the start of 11 and the end of 10. In felt the car reads as a red plush blob up close. The view opens onto the drop as the pitch lifts.
- Neighbour riders' arms near the lens are large in 10 and 14. They read as arms, but are heavy.
- In 03 the camera path passes close behind trees, so the puffing kiddie rides are partly hidden behind foreground felt trees after 10.5. The flat-applique phase reads best.
- Paper (01) at full-park distance reads more as a "cut-card diorama" than as obvious paper. Grain and cut edges show mainly in the early ticket frames and in 10.
- Felt flight shadow detail and fuzz boil are subtle in the far field. Tin grass is a fairly flat printed green.
