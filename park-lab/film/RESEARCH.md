# Research: how real amusement parks are laid out and detailed

This file holds the research that went into the master plan (`plan/park.json`), condensed into **design rules** that the renderers can follow. Sources are listed at the end. Where the web sources gave no number, the figures are typical values from general industry practice. They are marked *(typ.)* and are good enough for a film, not for engineering.

---

## 1. Overall layout

**What real parks do**
- **One entrance, a strong boundary and radial circulation.** The classic plan has a single gated entrance. A short "main street" acts as an entry funnel and leads to a **central hub**, and **spokes** radiate from the hub to the themed lands. People always know where they are, because the hub's landmark (the "weenie") is visible from every spoke. One known weakness is that everyone leaves through the hub. Real parks fix this with **bypass streets** parallel to main street and with **loop paths that link the lands to each other**, so guests don't always have to go back to the hub.
- **Forced perspective on main street.** Upper storeys are built at smaller scale (ground floor about 90%, first floor about 80%, then smaller still), so the buildings look taller and the landmark looks farther away. Shop windows sit low, at children's eye level.
- **Transitions.** Guests go from the car park through ticket booths and turnstiles, then pass **under a railway** (through a tunnel or bridge), and the park opens up all at once in front of them. The perimeter railway runs on the **berm**, an earth mound with landscaping around the whole park. The berm hides the outside world and the car park, and it is the railway's embankment.
- **Backstage.** Service roads, maintenance sheds, ride storage and deliveries sit **outside the berm or behind show buildings**, screened by dense trees, fences and walls. Every shop and restaurant has rear access that guests can't see. A show building (dark ride) only "dresses" its front facade. Its back is a plain grey box hidden by trees.
- **Themed lands** have their own palette, architecture, planting and paving. Between lands, transitions happen over 20–40 m: planting closes in, the paving changes, a bridge or archway marks the threshold, and the music changes.
- **Water** is a central organiser. A lake reflects the lit rides at night, gives open sky views, carries boats, and holds splashdowns and soak zones.

**Rules for the film park**
1. Use a hub-and-spoke plan with one gate in the south and a landmark observation tower at the hub, visible from every land.
2. Main street runs about 100 m from the gate to the hub. It is 18 m wide, with 2–3 storey facades that step down in scale upward. A Town Square with a bandstand sits just inside the gate, and side streets run parallel to it as bypasses.
3. A 5 m perimeter berm with trees goes all the way round, and the railway runs on its crest. Guests enter under a **railway bridge**. The car park and backstage stay outside the berm.
4. Lands connect to each other by a loop path, so guests never need to backtrack to the hub.
5. Show buildings are boxes with a themed facade on the guest side and trees behind.

## 2. Pathways

**What real parks do**
- **Widths** *(typ.)*: main street and the hub ring 15–20 m; primary spokes 8–12 m; land loops 6–8 m; secondary paths and lakeside promenades 4–6 m; garden walks 2–3 m; queue lanes 0.9–1.2 m between rails (wide enough for a wheelchair, 1.5 m at turns). Service roads 4–6 m, hidden.
- **Paving** sets each land apart. Main street uses red brick in herringbone or a stamped-brick pattern with granite kerbs. The hub uses concentric stone setts or a compass-rose inlay. Lands use tinted concrete in colours that suit them: sand and terracotta in the jungle, packed-earth tones and timber boardwalk in the frontier, timber decking and pale stone on the pier, and pastel stamped concrete or rubber in kiddie land. Paths have a 10–15 cm **kerb** or a flush edge band 0.3–0.5 m wide in a contrasting stone.
- **Furniture rhythm** *(typ.)*: lamp posts every 15–25 m along both edges (closer, 12 m, on main street), benches in pairs every 25–40 m facing views, and bins next to benches and at every food outlet. Planters and raised beds are 1.5–3 m round or square. Wayfinding signposts with blank blades stand at every junction. Drinking fountains sit near restrooms and queues. Restroom blocks are about 15 × 8 m, tucked behind planting at the hub's edges and in each land, never on main axes.
- **Queues**: outdoor queues hug the edge of the walkway or sit in a fenced pen beside the ride entrance. **Switchbacks** (serpentine lanes) hold a long line in a compact area. Rails are 1.0 m tall, posts every 2–2.5 m, with shade canopies (tension fabric or a timber pergola) over the pen and fans, planters and drinking fountains along it. The queue narrows to the width of the loading lane at the station. The **exit path** is separate from the entrance, often through a shop.
- **Food courts**: a pavilion with a covered terrace. In front sit 20–60 tables with 2.5–3 m parasols in rows, with planters and trees for shade. Kiosks (3 × 3 m) and carts (2.5 × 1.2 m with a canopy) appear every 50–80 m along busy paths and at queue exits.

**Rules**
6. Give every edge in `paths.edges` a width class and a paving type, then follow the furniture rhythm above. Kerbs sit on every path polygon outline (`kerb: true`).
7. Every major ride has a switchback queue pen with a canopy beside its entrance and a separate exit path back to the loop.
8. Put kiosks and carts at path junctions and queue exits. Put restrooms behind planting, with a short spur path.

## 3. Rides

### Steel looping coaster (hero)
**Anatomy:** a **station** (covered platform, a 25–35 m straight, a loading gate on each side) → a short dip and turn → **chain lift hill** at 30–45°, with a central chain, anti-rollback rack and catwalks with handrails on both sides → **crest** (a slight pre-drop or an immediate dive) → **first drop** at 55–70° → **vertical loop** (teardrop/clothoid, not circular, so its radius is tightest at the top) → **overbanked turn** → **corkscrew** (a helical 360° roll about a horizontal axis, about 8 m radius) → **helix** (a descending banked spiral) → **brake run** (straight, with fin brakes between the rails) → **transfer track** beside the station (a shunt to a storage shed) → back to the station.
Track: 2 running rails about 1.0–1.2 m apart (centres), plus 1 larger spine pipe below, with cross-ties every 1–1.5 m. Supports are hollow steel columns 0.6–1.2 m in diameter, usually painted a contrasting colour. Single columns carry low track, A-frames or 3- and 4-leg towers carry the lift, and loops stand on 2 splayed legs. Each column lands on a concrete **footer**, a pad about 1.5 × 1.5 m that is 0.3 m proud of the ground. Trains are 5–8 cars of 4 riders (2 × 2), each car about 2.2 m long.

### Wooden coaster
The track is a laminated timber stack with flat steel running strips, carried on a dense **lattice**. Transverse **bents** (pairs of posts with diagonal X-bracing) sit every 2–2.5 m along the track. They are tied together by horizontal **ledgers** every 2–3 m in height and by longitudinal diagonal braces. The structure flares wider at the base (base width ≈ 0.35 × height + 3 m). Taller wooden coasters stand 30–60 m. A typical layout is **out-and-back**: a lift, a long drop and a run of camelback hills straight out, a turnaround, then back with lower hills and a twisting section. There are no inversions, and the ride sways a little.

### Family coaster
Track at 8–15 m with tight helices and gentle drops. A small lift (sometimes tyre-driven), single columns in bright colours, trains of 5–8 cars of 2.

### Water rides
- **Log flume:** a 1.2 m wide fibreglass, concrete or steel **trough** with flowing water, on timber or steel trestles where it's elevated. Boats are hollow logs for 4–5 riders. There are 2 lift hills (conveyor belts). The first leads into a meandering elevated channel with a small drop. The second, taller lift (12–20 m) ends in the big final drop into a **splashdown** run-out pool. The exit path passes the splash, the soak zone.
- **River rapids:** circular rafts (3–4 m diameter, 6–12 riders) on a rubber buoyancy ring, in a 5–8 m wide channel of artificial rock. Underwater cylinders and logs make standing waves, with waterfalls, geysers and a cave. A **turntable** or conveyor station, a conveyor lift of 3–6 m, and a calm 5–15 m run-out.

### Flat rides and landmarks
| Ride | Real-world dimensions *(typ.)* |
|---|---|
| Ferris wheel | 30–60 m diameter, 24–42 gondolas, A-frame legs, radial spokes plus 2 parallel rim rings, gondolas hang level |
| Carousel | 15–18 m diameter (50 ft), 3 rows of horses (about 36 figures), 2 chariots, a centre mirrored drum with an organ, striped conical canopy, a rounding-board frieze with bulbs |
| Drop tower | 60–100 m lattice or tube mast, a ring gondola of 16–24 seats round the mast, magnetic brakes at the bottom |
| Swing ride | 10–12 m centre mast, 18–20 m canopy, 24–48 chairs on 6 m chains that fly out about 45° |
| Pirate ship | a 17–20 m boat on a 15 m A-frame, swings ±75° |
| Teacups | an 18 m disc platform, 3 sub-turntables × 6 cups (about 2.5 m each) |
| Bumper cars | a 40 × 25 m pavilion with an open side, a ceiling grid, poles on the cars, a padded perimeter rail |
| Dark ride | a 60 × 40 × 12 m show box, themed facade, a load station inside the front, track hidden |
| Observation tower | 50–80 m mast, a glass cabin ring that rises and rotates |
| Perimeter railway | 600 mm–914 mm gauge, steam-style loco + 4–6 open coaches, raised station platform with a canopy |
| Kiddie rides | 6–10 m discs: mini planes on arms, mini boats in a pool, kiddie trucks, a mini drop tower of about 8 m |

**Rules**
9. The hero coaster's track centreline, banking (roll), segment tags (station, lift, drop, loop, corkscrew, helix, brakes) and support positions are given in `park.json`. Renderers sweep a track profile along the baked frames. They must not re-spline it.
10. Supports are vertical columns from track underside to footer. They never land on paths, buildings or water (the validator checks this). Inverted points have no column underneath. Loops and corkscrews stand on their entry and exit legs.

## 4. Landscaping and atmosphere

**What real parks do**
- Big **mature trees** (12–25 m) give shade along paths and screen backstage areas, and they frame views of the landmarks. Each land gets species that suit it: palms and broadleaf "jungle" trees in the adventure land, tall pines and oaks in the frontier, round clipped lime and plane trees in avenues on main street, and windblown pines with palms on the seaside. Layered planting runs from groundcover to shrubs, then small trees, then canopy.
- **Flower beds** in seasonal colour line the entrance, main street and hub. The hub has a showpiece **floral display** and **fountains**. Clipped **topiary** marks the entrance and kiddie land.
- **Bunting** hangs in catenaries between lamp posts, with triangular pennants 0.3 m apart. **Flags** fly on poles (blank, in plain colours) along roofs and the gate. **String lights** run in festoons over the midway and the food court. Rides are outlined with bulbs.
- **Crowds** are dense on main street and at the hub at a park's peak (about 1 person per 4–6 m²). They thin to 1 per 30–60 m² on the far loop paths. Queues are packed at about 1.5 people per metre of lane. Guests cluster at food courts and in viewing spots by the coaster's loop and the splashdown.

**Rules**
11. Trees sit at least 2 m from path edges, except avenue trees, which sit in tree grates inside main street's verge. Trees never sit on track footprints.
12. Crowd densities are given per path class in `park.json → guests.densities`. Use them so the frame reads realistically.
13. The palette is warm, saturated and joyful. Each land keeps its own colour key (`lands[].palette`).

---

## Sources
- Urban design reading of main street, forced perspective, the hub and the railway tunnel: [touringplans.com, "An urban designer looks at Main Street"](https://touringplans.com/blog/an-urban-designer-looks-at-main-street/)
- Hub-and-spoke, berm and the backstage concept: [nclurbandesign.org](https://nclurbandesign.org/?p=18131), [allears.net: site design](https://allears.net/?p=10753), [themeparktourist.com: design elements that reduce crowding](https://www.themeparktourist.com/features/20150507/30239/subtle-disney-design-elements-help-parks-seem-less-crowded)
- Queue design and switchbacks: [themeparkinsider.com: Robert's Rules](https://www.themeparkinsider.com/flume/201706/5625), [touringplans.com: extended queues](https://touringplans.com/blog/2020/10/18/extended-queues-are-taking-over-some-of-the-walkways-at-walt-disney-world/), [dimensions.com: queue spacing](https://www.dimensions.com/element/human-spacing-queue-space-queuing)
- Pedestrian capacity method: [Estimating pedestrian capacities for walkways (PDF)](https://cales.arizona.edu/~gimblett/Estimating%20Pedestrian%20Capacities%20for%20Walkways.pdf)
- Coaster terms (lift, anti-rollback, brake run, footers): [Six Flags: terminology 101](https://www.sixflags.com/blog/2020/may/roller-coaster-terminology-101), [Coaster101](https://www.coaster101.com/2022/07/27/coasters-101-roller-coaster-terminology/), [Wikipedia: Lift hill](https://en.wikipedia.org/wiki/Lift_hill), [HowStuffWorks](https://science.howstuffworks.com/engineering/structural/roller-coaster.htm)
- Vertical loop geometry (clothoid/teardrop): [Wikipedia: Vertical loop](https://en.wikipedia.org/wiki/Vertical_loop)
- Wooden coaster structure and layouts: [Wikipedia: Wooden roller coaster](https://en.wikipedia.org/wiki/Wooden_roller_coaster)
- Steel track rails, spine and gauge (forum figures, rough): [coasterbuzz](https://coasterbuzz.com/Forums/PostLink/978920), [rec.roller-coaster](https://groups.google.com/g/rec.roller-coaster/c/j3Sg475_E2c/m/-Xb2vh4gFXgJ)
- Log flume: [Wikipedia: Log flume](https://en.wikipedia.org/wiki/Log_flume_(ride)). River rapids: [Wikipedia: River rapids ride](https://en.wikipedia.org/wiki/River_rapids_ride)
- Swing rides and drop towers: [Wikipedia: Wave Swinger](https://en.wikipedia.org/wiki/Wave_Swinger), [Wikipedia: Drop tower](https://en.wikipedia.org/wiki/Drop_tower)
- Ferris wheel and carousel spec families: Chance Rides spec sheets (Century Wheel, 36/50 ft carousels), listed by search, not all reachable
- Trees and landscape in parks: [blooloop: trees in theme parks](https://blooloop.com/theme-park/opinion/trees-in-theme-parks/), [Storyland Studios: landscape architecture in theme parks](https://www.storylandstudios.com/crafting-worlds-the-power-of-landscape-architecture-in-theme-parks/)

No real park's castle, IP, names or signage are used. The park is original. It borrows only the real-world planning logic.
