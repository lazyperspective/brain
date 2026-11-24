# v3 edit: 120 BPM, 15 frames per beat. Every cut on a beat.
SHOTS = [  # (module, name, n_frames)
    ('s_roof', 'roof', 75),         # 5 beats   0.0 -  2.5  cold open + cloud streamlines; dives behind the ridge
    ('s_spruce', 'spruce', 45),     # 3         2.5 -  4.0  pops up on the spruce tip, mirrored branch lines + star
    ('s_logpile', 'logpile', 90),   # 6         4.0 -  7.0  weightlifter -> caught -> log on the foot, hops
    ('s_manhole', 'manhole', 45),   # 3         7.0 -  8.5  lid rattle, peek, clank
    ('s_photo', 'photo', 45),       # 3         8.5 - 10.0  photographs us back, flash
    ('s_bales', 'bales', 60),       # 4        10.0 - 12.0  sixth bale, bolts left (hay bits) ...
    ('s_shoes', 'shoes', 45),       # 3        12.0 - 13.5  ... runs in from the left, falls into step, waves
    ('s_garland', 'garland', 90),   # 6        13.5 - 16.5  monkey bars, dove zap, ornament, drops out ...
    ('s_pole', 'pole', 210),        # 14       16.5 - 23.5  ... lands on the lamp; zip-line set piece + string-art wires
    ('s_whip', 'whip', 45),         # 3        23.5 - 25.0  ridge sprint, the whip pan chases it
    ('s_summit', 'summit', 195),    # 13       25.0 - 31.5  flag, ghost mountain, binoculars, wave, fist pump
]
BLACK_TAIL = 45                     # 1.5 s of black for the stinger
FPS = 30
def starts():
    s, out = 0, {}
    for m, n, f in SHOTS: out[n] = s / FPS; s += f
    return out, s
