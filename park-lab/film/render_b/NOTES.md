# Render agent B: shots 04, 08, 13 (low-poly), 15 (tilt-shift), 16 (snow globe)

All shots are rendered with three.js r160 in headless Chromium (SwiftShader) through Playwright, frames piped as JPEG (q 0.95) straight into ffmpeg (libx264, CRF 16, yuv420p, 30 fps, `-threads 2`, `nice -n 5`). Cameras are always `park.camera(shot, t)` with `t = t_start + i/30`; ride clocks via `park.trainFronts` / `park.rideTime` with the shot overrides. Nothing in `plan/` was edited.

## Code (render_b/)
| file | what |
|---|---|
| `serve.js`, `render.js`, `app.html` | static server, Playwright driver (`node render.js <shot> stills <t,..> <dir> [w h]` or `node render.js <shot> video [w h]`) |
| `mat.js` | material factory + one shader patch for everything: blueprint wave (lift-from-ground with overshoot, cyan flash, grid ground, keep-out zones), snow cover by normal (per-material strength), per-part colouring + limb animation for the little people, circular globe clip |
| `world.js` | detail layer on the grey-box base: paving shaders per type (herringbone brick, concentric hub setts, 3 m concrete with brick bands, boardwalk planks, flagstones, stamped pastel, checker, broom concrete), lawn stripes, kerbs as real profiles, water ripples; every building (Main Street facades with storey bands, sash windows + sills + lintels, pediments, shutters, window boxes, shopfronts by type, fascia boards, striped/scalloped awnings on brackets, cornices with dentils, mansard dormers, corner turrets with onion domes, bulb outlines; entrance towers + wrought-iron arch, bandstand, ticket kiosks, frontier false fronts with porches/balconies, water tower, lighthouse, big-top food court, midway booths with prizes, thrill shop fins, station, bridge) |
| `tracks.js` | coasters swept along the baked frames: twin rails + spine, instanced ties with struts, chain + anti-rollback on lifts, stair catwalks with handrails, fin brakes, column supports with flanges + saddles + footers, lattice bents on the lift; wooden coaster with bents, X-braces, ledgers, walkboards and handrails; flume trough + trestles; rapids rock channel + boulders; railway ballast/sleepers/rails; trains with bogies, seat backs + headrests, lap bars, nose cone, riders (arms up on drop/loop/corkscrew/helix), logs, rafts, steam train |
| `rides.js` | Ferris wheel (rims, spokes, cage gondolas, bulb chase), carousel (striped canopy, scalloped valance, rounding board with bulbs, mirrored drum, bobbing horses), teacups, swing ride, pirate ship, drop tower (riders on the ring), observation tower (rotating glass cabin with riders), dodgems, dark-ride ruin facade with torches, kiddie rides, swan boats with riders, stations, queue switchbacks (rails + posts) with canopies by style |
| `nature.js` | 13 tree species as low-poly/flocked shapes, flower-bed dots, hedges, topiary, rockwork, reeds; lamps (all 8 styles), benches, bins, planters, umbrella tables + chairs, carts, flags, signposts, fences, bunting pennants, string-light bulbs; per-land bulb meshes and light pools |
| `people.js` | ~4,200 instanced little people (head, hair, nose, torso, arms, hands, legs, shoes, 25% caps, 6 skin tones, 14-colour clothes, children), walking limbs on the walkers, queuers facing along their lane, seated guests on benches/tables, strollers, balloons with strings (sellers + kids) |
| `style_lowpoly.js`, `blueprint.js` | low-poly tycoon look; blueprint linework and the wave |
| `style_mini.js`, `globe_room.js`, `common.js` | tilt-shift dusk->night; snow globe, room, ticket, glass, snow, DOF |

(see report section below)
