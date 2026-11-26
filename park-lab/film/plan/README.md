# Park master plan: files, schema and API

All three render agents use the same park. Load it from here and don't hand-edit it. If something needs to change, edit the generator in `film/gen/` and rebuild with `python3 build_park.py && python3 draw_map.py 3 && python3 build_shots.py`.

| file | what |
|---|---|
| `park.json` | The whole park, about 1.5 MB (schema below). Everything is pre-placed and seeded, so every style gets identical content. |
| `park.js` / `park.mjs` | A dependency-free loader with helpers. It works as a classic script (`window.ParkPlan`), as an ES module (`import ParkPlan from './park.mjs'`) or in Node (`require`). |
| `park.py` | A Python mirror of `park.js` (numpy), for the pixel renderer and other Python renderers. |
| `greybox.js` | A three.js builder for the whole park as simple meshes, with a material hook per category. |
| `shots.json` | The edit: 16 shots with camera keys, ride-clock overrides, beats and transitions. |
| `map.png`, `map_labelled.png` | A top-down map at 3 px/m. The labelled copy has numbered markers, land names and a legend. |
| `preview_*.jpg` | Grey-box renders (`tools/render_greybox.js`). |
| `ticket_print.png` | The printed face of the closed paper ticket (2000×960 = 200×96 world units). Shots 01 and 16 must both use it. |

## Conventions
- **World:** metres. **x is east, y is up, z is south.** Ground is at y=0. The gate is in the south (z≈+180) and the park extends north (−z). The berm and railway ring sit at x=±290 and z=−200…160. Inside the berm the park spans x −273…273 and z −183…143.
- **Rotation:** `rot` is in radians about +y. An object's local +z axis (its front) points along `(sin rot, 0, cos rot)`. So 0 faces south (toward most cameras), π faces north, +π/2 faces east and −π/2 faces west. `w` is along local x and `d` is along local z.
- **Polygons** are lists of `[x, z]`. Region lists are `[{outer:[[x,z]…], holes:[[[x,z]…]…]}]`.
- **Sun (day):** azimuth 225° (south-west), elevation 38°, `lighting.sun_day.direction_to_sun`. Shadows fall to the north-east. Every day shot uses this.
- **Time:** every animation is a function of **global film time `t`** (seconds on the edit timeline; it may be outside 0–44 inside handles). Then a match cut between two styles shows the same train in the same place.

## park.json top level
- `meta`: units, axes, the rotation convention, bounds.
- `lands[]`: `{id, name, mood, palette{primary,secondary,accent,trim,roof,ground}, region}`. The ids are `entrance`, `main_street`, `hub`, `kiddie`, `seaside`, `jungle`, `thrill`, `frontier` and `midway`.
- `paths`
  - `paving_types{id: {color, joint, pattern, module}}`
  - `nodes{id:[x,z]}`
  - `edges[]{id,a,b,width,paving,class,points,length,land}`. The classes are main, side, alley, spoke, loop, pier, far and exit. Exit edges are the ride exits.
  - `plazas[]{id,paving,polygon,centroid,area}`
  - `paving_regions{paving: regions}`: these don't overlap, so draw them in any order at y≈0.03.
  - `kerbs.outlines`: the outline of all paved guest areas. Kerbs are 0.12 m granite, except timber on boardwalk and logs on packed_earth.
- `terrain`
  - `grid`: 2 m cells, base64 int16 in centimetres, row-major with z rows. Use `heightAt(x,z)`.
  - `features`: berm, hills (a jungle rock mountain 14 m high, a frontier mesa, a kiddie knoll, hub screen mounds) and lake depth.
  - Paths are always at y=0. The berm is cut at the gate (|x|<9).
- `water[]`
  - `lake` (polygon, level −0.5)
  - `gull_island`. This is **land** inside the lake: a lighthouse folly and pines.
  - `hub_moat` (an annulus with 24 jets)
  - `flume_splash_pool`, `kiddie_boat_pool`, `square_fountain`, `entrance_fountains`
- `tracks{id}`: `hero_coaster`, `wooden_coaster`, `family_coaster`, `log_flume`, `river_rapids` and `railway`. Each one is **baked** every 0.5 m:
  - `s[]`
  - `pos[]`, `tangent[]` and `up[]` as flat xyz triples. `up` is the track normal, so banking and inversions are already in it. **Sweep your track profile along these frames. Do not re-spline.**
  - `tag[]` (indexes into `tags`) and `segments[]{tag,s0,s1}`. The segment tags are station, drive, lift, crest, drop, airtime, turnaround, loop, corkscrew, helix, trim, turn, brakes; hill and twister on the wooden coaster; and channel, rapids, chute, waterfall and splash on the water rides.
  - `speed[]` (m/s, from energy physics) and `time[]` (the seconds into the ride cycle). `cycle_time` is the circuit time.
  - Supports:
    - `supports[]` (hero, family, flume): `{s, top, base, height, type: column|lattice_tower|timber_trestle, diameter}`. Footers go at `base`. Inverted points have no support.
    - `bents[]` (wooden): `{s, top, ground, height, base_width, top_width, axis[x,z]}`. A bent is a transverse frame of 2 posts flaring to `base_width`. Add X-braces and ledgers every 2.5 m.
  - Water rides: `channel_width` / `trough_width` and depth. Their centreline is the **water surface**.
- `rides[]`: `{id, type, name, land, position[x,y,z], rot, footprint, params, station?, queue?, exit_edge?}`. The flat-ride `params` give every dimension and colour (see the research table). Station boxes are in `station{center,w,d,rot,h,platform_height}`.
- `buildings[]`: `{id, kind, position, rot, w, d, h, footprint, style, palette, …}`.
  - Main-street shops (`ms_*`) also carry `storeys`, `storey_heights` (forced perspective), `roof`, `wall`, `trim`, `awning`, `awning_style`, `shopfront` and `window_boxes`.
  - `turnstile_line` and `midway_booths` hold `items[]`.
  - Nothing has readable text. Signs are blank or carry an icon.
- `queues[]`: switchback pens `{id, ride, center, w, d, rot, lanes, polyline, rails[[a,b]…], canopies[], entry, exit, polygon}`.
- `planting`
  - `species[]`
  - `trees.list`: `[x, groundY, z, speciesIndex, height, crownRadius, colorVariant]`, about 3,450 trees, including a dense forest on the berm and outside it.
  - `flower_beds[]`, `hedges[]` (ride borders), `topiary[]`, `shrub_zones[]`
- `props`: lamps (8 styles by land), hanging_baskets, benches (`rot` faces the path), bins, planters, signposts (blank blades), drinking_fountains, carts (popcorn, ice cream, balloons and so on), balloon_sellers, umbrella_tables, bunting and string_lights (endpoints and sag; use `ParkPlan.sagLine`), flagpoles, fences (ride perimeters and the lake railing).
- `guests`
  - `walkers.list`: `[edgeId, u0, dir, speed, lateral, colorIndex, isChild]`. They move along the path edges and bounce back at the ends.
  - `idlers.list`: `[x, z, heading, colorIndex, isChild, holdsBalloon]`
  - `queued.list`: `[queueId, x, z, headingJitter, colorIndex, isChild]`
  - `clothes_palette`
  - About 4,200 guests: dense on Main Street, in the hub and in queues; sparse on far paths.
- `parking`: the lot, about 1,250 cars `[x,z,rot,colorIndex]`, tree islands, lamp poles, a tram lane. `backstage`: a service road, a compound and sheds outside the berm (only visible from very high).
- `lighting`: sun_day, dusk, night. `lighting_rigs`: bulb outlines per ride and the switch-on order. `animation`: default ride clocks, periods and phases.
- `validation`: the result of the geometry checks run by the generator. Currently it reports `all checks passed`. It checks:
  - track clearance over paths (≥4 m)
  - ground clearance
  - track-to-track distances (≥3.5 m, ≥5 m for rapids)
  - supports landing on paths
  - buildings, rides and queues overlapping

## park.js API (park.py mirrors it with snake_case)
```js
const park = await ParkPlan.load('/plan/park.json');     // Node: ParkPlan.loadFileSync(path)
park.heightAt(x, z)
const tr = park.track('hero_coaster');
tr.length, tr.cycleTime, tr.segments, tr.supports, tr.bents
tr.sample(s)          // {pos, tangent, up, right, bank(deg), tag, speed, time}
tr.sAtTime(tau)       // tau = ride clock (s), wraps
tr.cars(sFront, nCars, carLen, gap)        // car-centre frames
tr.matrix(s, [left, up, fwd])               // column-major 4x4, local +z forward, +y up
park.rideTime(rideId, t, train, shot)       // ride clock; shot.rides[rideId] = {t0,tau0,rate} overrides the default
park.trainFronts(rideId, t, shot)           // s of each train's front
park.trains(rideId, t, shot)                // [[car frames]...]
park.flatRide(id, t)                        // wheel angle, carousel angle+bob, ship swing, drop/tower heights...
park.guestsAt(t)                            // walkers Float32Array stride 5 [x, z, heading, colorIdx, isChild] + idlers/queued
park.camera(shot, t)                        // {mode:'perspective'|'ortho', position, target, up, fov, orthoHalfHeight, focusDistance}
park.edgePoint(edgeId, u), park.landAt(x, z), ParkPlan.sagLine(a, b, sag, n)
```
**Always use `park.camera(shot, t)` for the camera.** It does Catmull-Rom or linear interpolation with easing, ortho iso, and POV ride-along with head turns. Then the match cuts line up exactly between agents.

POV fields (`shot.camera` with `mode: 'pov'`): `seat_back_m` (eye station behind the train front), `eye` [left, up, fwd] in the track frame, `aim_ahead_m` (polish pass: look along the track tangent this far ahead; without it the camera aims at the point `look_ahead_m` ahead, the original rig), `fov`, and `head` keys `{t, yaw, pitch, roll?, ease?}` in degrees (yaw + = look left, pitch + = look up, roll rotates the head about the view axis; ease defaults to inOut).

## greybox.js
```js
import * as THREE from 'three';
import { buildGreybox, CATEGORY_COLORS } from '/plan/greybox.js';
const gb = buildGreybox(THREE, park, { detail: 1, material: (category, info) => null /* or a THREE.Material */ });
scene.add(gb.root); gb.update(t, shot);   // animates trains, flat rides, boats and guests
gb.groups.trees.visible = false;          // groups: terrain water paving parking planting buildings track:<rideId> trains queues rides trees props guests
```
- Every mesh has `userData.category` and `userData.info`. Categories include terrain, water, `paving:<type>`, kerb, flowerbed, building, roof, `track_rail:<ride>`, `track_spine:<ride>`, track_tie, `support:<ride>`, footer, wood_structure, trough, channel, ballast, rail, `train:<ride>`, queue_rail, canopy, tree_trunk, tree_crown, lamp, bench, bin, planter, umbrella, cart, flag, signpost, fence, shrub, guest, car, `ride:<type>`, ride, ride_accent and glass. To restyle, traverse and swap materials.
- Instanced meshes carry per-instance colours, so keep a replacement material's `color` white.
- It works with three r160 (`film/lib/three/three.module.js`) and r170.
- Software WebGL builds the whole park in about 3 s and renders a 1600×900 frame in about 1–3 s.
- The harness is `film/tools/greybox.html` with `film/tools/render_greybox.js`. Run `node tools/render_greybox.js --shot <id> out.mp4 640 360` to render a whole shot with handles. Use it as a template for a Playwright renderer.
