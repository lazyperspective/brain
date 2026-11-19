# Wonders of the World - an animated film drawn entirely in code

Everything on screen is drawn by the code in this folder: no image generators, no
sprites, no downloaded assets. Python + Skia rasterise the frames, which are piped
straight into one ffmpeg/x264 process. No browser is involved. The soundtrack is
synthesised sample by sample in `soundtrack.py` (numpy only, no recordings).

## Run

    python3 -m venv --system-site-packages .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python soundtrack.py             # out/soundtrack.wav + level report + out/soundtrack_analysis.png
    .venv/bin/python film.py film              # out/wonders_full_1080p.mp4  (1650 frames, 55 s, video + AAC)
    .venv/bin/python film.py share             # out/wonders_full_share.mp4  (CRF 25, faststart)
    .venv/bin/python film.py film --frames 0 150 -o out/wonders_5s.mp4       # just the opening
    .venv/bin/python film.py sheet             # out/contact_sheet.jpg  (build sequence + one tile per shot)
    .venv/bin/python film.py shots             # out/shots/*.png  (a full-res still from every shot)
    .venv/bin/python film.py still 4.97 --zoom 5.5 --at=-62,-52             # any time, any place, any zoom

Four worker processes render frames (each holds one 3840x2160 surface, ~35 MB);
exactly one x264 encoder runs (preset slow), so memory stays far below 15 GB.

## Structure of the film

One musical bar = one shot = 100 frames = 3.333 s (72 BPM, 4/4).

    0.00 -  6.67 s   the map builds itself (complete by ~4 s) and holds, alive
    6.67 - 50.00 s   13 close-ups at 2.5x, clockwise.  Each rests for 80 frames (with a slight drift; its
                     signature event peaks on beat 3), then the camera swoops for 20 frames - pulls out
                     to ~1.8x, flies, pushes in - landing on the next landmark exactly on the bar line
   50.00 - 55.00 s   the last swoop opens out to the whole world; the music resolves

The shot list and the camera live in `wonders/timeline.py` (`SHOTS`, `camera_at`).  Frames in flight are
motion-blurred: 5 sub-frame renders x 4 re-projections each, averaged (`film.py: blurred`).  Close-ups are
views of the same world at the same time - nothing is redrawn, and the life keeps moving through every move.

## Architecture

    wonders/pal.py        palette + vivid(): the one place that sets how saturated the film is
    wonders/ease.py       easing: back/overshoot, anticipation, spring, bounce
    wonders/core.py       world-model core: iso projection, Shape, Group, Wave, Tile drawing API
    wonders/figures.py    people: walk routes with stepping legs, pause, turn round, look about, wave
    wonders/props.py      trees, animals, boats (+wakes), vehicles, clouds, smoke, flocks, spray, water
    wonders/tiles_a..d.py one function per wonder (13 slabs + 5 satellites)
    wonders/life.py       second pass of life per tile (strollers, smoke, flocks, sparkles)
    wonders/extras.py     furniture, on-camera events, water arcs / bridges / spills between slabs, construction marks, cranes
    wonders/detail.py     fourth pass per wonder: architectural detail, ground detail, each close-up's signature event
    wonders/sky.py        the dream: sun, clouds between slabs, sky whale, paper cranes, floating islets
    wonders/world.py      LAYOUT: which wonder sits where; assembles and finalises the world
    wonders/timeline.py   build schedule, shot list, cuts, camera
    wonders/render.py     Renderer.frame(t, (cam_x, cam_y, zoom)) -> image; any place, zoom, time
    film.py               CLI: frames -> ffmpeg, stills, shots, contact sheet
    soundtrack.py         the score, synthesised; prints loudness / peak / gap / ending checks

Line widths, wobble and grain live in map units, so a close-up is a true crop of the
same drawing. Every motion is a function of global time, so it runs for as long as the
film does.
