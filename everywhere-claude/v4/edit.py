# v4 edit: 26.0 s, loops. 120 BPM, 15 frames per beat, every cut on a beat. (module, label, n_frames, first frame of the shot module)
SHOTS = [
    ('s_photo', 'photo', 15, 25),      #  0.0 -  0.5  cold open: camera raised at us... FLASH (frame 5) - also the loop point
    ('s_roof', 'roof', 60, 15),        #  0.5 -  2.5  sprint, cloud streamlines, double-take, dive
    ('s_spruce', 'spruce', 45, 0),     #  2.5 -  4.0  boings up onto the spruce tip, tree pattern, wink
    ('s_logpile', 'logpile', 90, 0),   #  4.0 -  7.0  weightlifter -> caught -> log on the foot (5.5) -> hops
    ('s_manhole', 'manhole', 45, 0),   #  7.0 -  8.5  lid, peek, clank
    ('s_bales', 'bales', 45, 15),      #  8.5 - 10.0  sixth bale wakes, bolts left ...
    ('s_shoes', 'shoes', 45, 0),       # 10.0 - 11.5  ... runs in from the right, steps, waves
    ('s_garland', 'garland', 75, 15),  # 11.5 - 14.0  monkey bars, zap, ornament, drops ...
    ('s_pole', 'poleA', 75, 0),        # 14.0 - 16.5  ... drops onto the lamp, caught, leap, strap on the wire
    ('s_pole', 'poleB', 75, 120),      # 16.5 - 19.0  far down the wires: string art, landing + starburst, windmill, two pumps
    ('s_whip', 'whip', 45, 0),         # 19.0 - 20.5  the whip pan chases it (build)
    ('s_summit', 'summit', 165, 0),    # 20.5 - 26.0  DROP at 21.5, flag 23.0, ghost mountain, binoculars, wave, pump 25.2, camera up -> loop
]
BLACK_TAIL = 0                      # no black: the last frame loops into frame 0
FPS = 30
def starts():
    s, out = 0, {}
    for m, n, f, a in SHOTS: out[n] = s / FPS; s += f
    return out, s
