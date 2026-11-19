# Wonders of the World - opening 5 seconds

Everything on screen is drawn by the code in this folder: no image generators,
no sprites, no downloaded assets. Python + Skia rasterise the frames, which are
piped straight into ffmpeg. No browser is involved.

## Run

    python3 -m venv --system-site-packages .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python film.py film              # out/wonders_5s.mp4  (150 frames, 1920x1080, 30 fps, ~40 s on 4 cores)
    .venv/bin/python film.py sheet             # out/contact_sheet.jpg
    .venv/bin/python film.py still 0 2.3 4.97  # full-resolution stills at those times
    .venv/bin/python film.py still 4.97 --zoom 5.5 --at=-62,-52   # a 2.5x close-up of the same world
    .venv/bin/python film.py tile fuji --t 0.3 0.6 0.9             # debug one tile through its build

One x264 encoder runs at a time (preset slow); four worker processes render
frames, each holding one 3840x2160 surface (~35 MB).

## Architecture (built to be extended into the full film)

    wonders/pal.py        the palette (cream paper, ink, blue pencil, naturals, ONE accent: saffron)
    wonders/ease.py       easing: back/overshoot, anticipation, spring, bounce
    wonders/core.py       world-model core
                            iso()        strict 2:1 isometric projection (tile space -> map space)
                            Shape        an inked/filled path with its own pencil/ink/wash timing
                            Group        shapes that arrive together (rise, pop, drop, drift, condense,
                                         tower, light, halo, wipe) and then keep moving (life)
                            Wave         an expanding wet front: fills appear where it has passed
                            Tile         the drawing API: slab, box, pyr, rev, prism, mountain, hill,
                                         guide (pencil construction with overshoot + ticks), custom...
    wonders/props.py      figures, trees, animals, boats, vehicles, clouds, balloons, water, lamps
    wonders/tiles_a..d.py one function per wonder (13 slabs + 5 satellites)
    wonders/world.py      LAYOUT: which wonder sits where; assembles and finalises the world
    wonders/timeline.py   when each piece starts building, the finale, and the camera path
    wonders/render.py     Renderer.frame(t, (cam_x, cam_y, zoom)) -> image
                          draws ANY part of the map at ANY zoom at ANY time; paper grain is
                          anchored to the map, so it travels with the camera
    film.py               CLI: frames -> ffmpeg, stills, contact sheet

Line widths, wobble and grain all live in map units, so a close-up is a true
crop of the same drawing (nothing is redrawn), exactly as in the reference.

To extend the film: add shots to the timeline as (time range, camera) pairs and
call `Renderer.frame(t, cam)`; the life motions are functions of global time and
keep running after the build.
