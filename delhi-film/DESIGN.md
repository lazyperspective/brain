# Dilli, Inlaid — design document

A 28-second film in which Delhi is assembled as a **parchin kari (pietra dura) panel**:
thousands of cut gemstones flying into chiselled sockets in a slab of polished black marble,
then a camera gliding across the finished inlay to visit its best corners.

## Why this, and why only Delhi
Parchin kari is the stone-inlay craft of Shah Jahan's Delhi. The throne niche of the Red Fort's
Diwan-i-Am is a wall of *black* marble panels inlaid with birds and flowers in jasper, lapis and
mother-of-pearl; Humayun's Tomb is red sandstone inlaid with white marble. The film takes that
material literally: the city is not *drawn*, it is *set*, stone by stone.

## The look
- **Ground:** one slab of polished black marble with faint warm veins, filling the whole frame,
  held in a gold-and-gem inlaid border (hashiya) like a miniature painting's margin.
- **Projection:** Mughal-miniature "stacked" space. No perspective, no isometry. Buildings are
  shown in flat frontal elevation, gardens/roundabouts/pools in plan, all stacked in three
  registers with north roughly up and the Yamuna as a lapis ribbon down the east side.
- **Every mark is a stone:** walls are coursed blocks of red jasper, domes are gores of white
  marble, lawns are malachite tesserae, water is lapis with gold pyrite flecks, the Lotus Temple
  is mother-of-pearl that shifts colour, outlines are gold wire. Stones have grain, banding,
  a soft bevel, hairline joints, and catch a raking light.
- **Light:** a low light from the upper left; gold and pearl bloom softly; stones twinkle.
- **People:** tiny profile figures in the miniature convention (turban, dupatta, a nose),
  each a few slivers of stone, each *doing* something (flying a kite, selling balloons, pedalling).

## Palette (stones)
| stone | use | colour |
|---|---|---|
| black marble | ground | #0D0E12 |
| raw chiselled stone | empty sockets | #4A4642 |
| red jasper | Red Fort, Jama Masjid, Humayun, Qutub | #AC3E2C |
| buff sandstone | India Gate, Rashtrapati Bhavan | #DEBE8C |
| white marble | domes, Connaught Place | #EEEAE0 |
| mother-of-pearl | Lotus Temple, steam, ripples | #E2E8EC (iridescent) |
| lapis lazuli | Yamuna, pools | #1E4098 + gold flecks |
| turquoise | tiles, kites | #34B0AC |
| malachite / jade | lawns, trees, parakeets, autos | #187A56 / #7EB664 |
| gold | wire, border, finials, Bangla Sahib dome | #ECBC58 |
| amber, carnelian, coral, amethyst, rose | marigolds, kites, flags, Akshardham | — |

Dark ground, many jewel colours, metallic gold: the opposite of pale paper with one accent.

## The build mechanic
1. **Frame 1 — the promise:** the bare black slab with the entire city already *chiselled out*
   as pale, rough, empty sockets (recessed, lit from the wrong side), and the first stones
   already in the air at the frame edges, casting shadows.
2. **The build (0–5.33 s):** ~8,900 stones fly in from all sides at once, each tumbling,
   shrinking as it descends, its shadow converging on it, then seating in its socket with a
   flash. Different materials move differently and all overlap:
   - lapis *flows* down the river course from the north;
   - masonry rises course by course, bottom-up, on every monument simultaneously;
   - dome gores swing in after their walls;
   - trees and petals *bloom* outward from a point;
   - gold wire is *drawn* last, like molten metal running in a channel;
   - the border fills as a chase running round the frame.
   The camera eases back from 1.14× to fit the whole slab.
3. Life switches on as the last stones seat: traffic, metro, pigeons, kites, steam.

## Shot list (90 BPM, 1 bar = 2.667 s = 80 frames at 30 fps)
| bar | time | shot |
|---|---|---|
| 1–2 | 0.00–5.33 | THE BUILD (wide, easing out) |
| 3 | 5.33–8.00 | THE HOLD — whole slab alive, raking light sweeps, music swells |
| 4 | 8.00–10.67 | Old Delhi: Jama Masjid, pigeons, Chandni Chowk lanes, wires, kites |
| 5 | 10.67–13.33 | Red Fort, tricolour, Yamuna, the old iron bridge |
| 6 | 13.33–16.00 | India Gate and Kartavya Path: autos, balloons, fountains |
| 7 | 16.00–18.67 | Connaught Place from above, metro sliding past, Bangla Sahib, Rashtrapati Bhavan, Agrasen ki Baoli |
| 8 | 18.67–21.33 | Qutub Minar, a plane on approach, Hauz Khas lake, Lodhi parakeets |
| 9 | 21.33–24.00 | Humayun's Tomb and charbagh, Lotus Temple, the river |
| 10–11.5 | 24.00–28.00 | ENDING — pull back; a wind lifts every stone off the slab, left to right, leaving the empty chiselled sockets = frame 1 (loop) |

**Moving between places:** no hard cuts. In the last third of a second of each bar the camera
*glides* across the slab (a motion-blurred hop that lifts slightly, travels, and lands exactly
on the downbeat). Because it is one continuous surface, the viewer always knows where they are;
the route reads the slab like a page — along the top register, back through the middle,
then along the bottom. Each shot also carries a small inlaid nameplate (lettering is my own stroke
alphabet, set as gold wire) with a tiny map of the slab and a bead showing where the camera is.

## Insider details
Black-and-white striped domes of Jama Masjid; kabootar-baz pigeon frame on an Old Delhi roof;
jalebi spiral sign; spice heaps of Khari Baoli; Sis Ganj's gold dome; the row of seven little
chhatris over Lahori Gate; Loha Pul truss bridge; Signature Bridge pylon; Agrasen ki Baoli;
Jantar Mantar; turquoise-tiled chhatris on Humayun's Tomb; Sheesh Gumbad's blue band; the Iron
Pillar; a plane low over Qutub; Hauz Khas deer; koi in the Bangla Sahib sarovar; Nishan Sahib;
Raisina monkeys; balloon seller at India Gate; flamingos at Okhla; the cricket ground.

## Sound
Original, synthesised in Python (numpy only). D Lydian / Raag Yaman colour. Tanpura-like drone,
Karplus-Strong plucked strings, santoor-like hammered shimmer whose density follows the stones
landing, soft synthesized tabla/frame-drum groove and sub that open up on the first tour shot,
one melodic phrase per bar. Fixed 90 BPM; every shot change is on a bar line. Normalised to
-16 LUFS. The tail returns to the bare drone so the loop closes.

## Why it does not resemble the well-known film
| that film | this film |
|---|---|
| isometric cake-slice tiles | one flat slab, frontal/plan miniature stacking, no tiles |
| cream paper, black pen outline, flat fill, paper grain | black polished marble, no outlines, textured bevelled stones, gold wire, bloom |
| faceless round-headed crowd | a few profile figures with turbans/dupattas, each with a task |
| single red-orange accent | full jewel palette on black |
| centre tile + empty tile outlines, grid | no grid, no tiles; the whole design is pre-chiselled and stones arrive from everywhere |
| line art → colour → life per tile | physical flight and seating of stones, material by material, across the whole slab at once |
| static 2.5× crops, clockwise, hard cuts | drifting close-ups joined by continuous motion-blurred glides in a reading (boustrophedon) order |

## Technical
Python + numpy + OpenCV drawing primitives only (no browser). Vector scene re-rasterised every
frame at the camera's zoom with 2x supersampling (close-ups are not upscaled). Raw BGR frames
piped to ffmpeg/x264 in resumable 40-frame chunks (`chunks/cNNN.mp4`), then concatenated and
muxed with the AAC soundtrack.

Files: `scene.py` (materials, geometry helpers, figures), `city.py` (every stone), `life.py`
(everything that moves, nameplate lettering), `engine.py` (rasteriser + stone shader),
`film.py` (timeline, camera, chunk renderer), `music.py` (soundtrack), `checks.py` (bar-line,
loop and loudness self-checks), `build.sh` (one-command resumable build), `sheet.py` (contact sheet).
