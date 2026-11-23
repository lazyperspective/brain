# The edit: 120 BPM, 15 frames per beat. Every cut on a beat (the flurry's last two are half-beat cuts on the drum fill).
SHOTS = [  # (module, name, n_frames)
    ('s_roof', 'roof', 75),        # 5 beats   0.0 - 2.5  cold open
    ('s_logpile', 'logpile', 75),  # 5         2.5 - 5.0
    ('s_phone', 'phone', 30),      # 2         5.0 - 6.0
    ('s_manhole', 'manhole', 45),  # 3         6.0 - 7.5
    ('s_bales', 'bales', 60),      # 4         7.5 - 9.5
    ('s_shoes', 'shoes', 45),      # 3         9.5 - 11.0
    ('s_garland', 'garland', 45),  # 3        11.0 - 12.5
    ('s_pole', 'pole', 210),       # 14       12.5 - 19.5  set piece
    ('s_flurry', 'fl1', 15),       # 1        19.5 - 20.0
    ('s_flurry', 'fl2', 15),       # 1        20.0 - 20.5
    ('s_flurry', 'fl3', 8),        # 1/2      20.5 - 20.77
    ('s_flurry', 'fl4', 7),        # 1/2      20.77 - 21.0
    ('s_summit', 'summit', 180),   # 12       21.0 - 27.0  ending (music stops)
]
BLACK_TAIL = 45                    # 1.5 s of black for the stinger
FPS = 30
def starts():
    s, out = 0, {}
    for m, n, f in SHOTS: out[n] = s / FPS; s += f
    return out, s
