"""When things happen. Shared by the drawings and the sound."""

# shot name -> duration (seconds), in running order
ORDER = [
    ('forest', 23.5),     # the hour: the fleck, the lantern, the chore, the knock
    ('night', 6.0),       # the root-house at night
    ('edge', 4.5),        # leaving
    ('reveal', 6.0),      # the open slope
    ('plenty', 6.0),      # everything within reach
    ('late', 8.5),        # the hour comes round where there is no fleck
    ('stars', 3.2),       # first night out
    ('unknock', 5.6),     # the knock that is not made
    ('years', 12.0),      # the slope, year on year
    ('husk', 5.5),        # what the leaf-litter kept
    ('carry', 3.5),       # the old one brings it
    ('knock', 8.5),       # tok, tok
    ('flash', 2.4),       # the dark sheet, for a breath
    ('end', 7.5),
    ('tail', 2.6),        # nothing         # the foot, raised
]
DUR = dict(ORDER)
START = {}
_t = 0.0
for _n, _d in ORDER:
    START[_n] = _t
    _t += _d
TOTAL = _t

# ---- forest (local seconds)
F_FLECK_IN = (1.0, 4.0)
F_IGNITE = 3.35
F_RUN = (5.2, 7.4)
F_HOPS = (7.75, 8.15)
F_TIP = (8.5, 9.2)
F_OLD_OUT = 7.3
F_OLD_WALK1 = (8.0, 11.5)
F_NUDGE = (11.5, 12.1)
F_SCOOT = (12.15, 13.5)
F_OLD_WALK2 = (12.2, 14.7)
F_BITE = 15.05
F_BACK = (15.9, 16.5)
F_SPRING = 16.1
F_TUCK = (16.6, 17.4)
F_THUMP = 17.3
F_GO_KNOCK = (17.4, 18.3)
F_KNOCK1 = (18.55, 18.78)
F_KNOCK2 = (19.6, 19.80, 20.0)
F_HEAD_OUT = (20.3, 21.1)
F_FLECK_OUT = (20.2, 23.0)
F_DRIPS = (0.55, 2.35, 4.6, 6.4, 13.9, 21.6, 22.9)

# ---- night (local)
N_DRIPS_YOUNG = (1.1,)
N_SHUFFLE = (1.9, 3.1)
N_DRIPS_OLD = (3.45, 5.25)
N_KICK = 4.3

# ---- edge (local)
E_TURN = (1.0, 2.15)
E_WHITE = (2.2, 4.5)
# ---- reveal
R_DRAWN = (0.35, 2.7)
# ---- plenty
P_BITE = 2.95
# ---- late
L_DUSK = (2.0, 3.8)
L_CONTACT = 5.75
L_RELEASE = 7.05
# ---- stars
U_WALK = (0.2, 2.2)
U_PAW = (2.6, 3.1, 4.3, 4.9)
# ---- years
YEARS = 20.0
# ---- husk
H_NUDGE = (1.5, 2.4)
H_GLOW = (2.6, 3.6)
# ---- knock
K_SET = 3.0
K_TAPS = (4.8, 5.6)
K_WAKE = (7.0, 8.1)
# ---- end
X_BITE = 1.15
X_DOZE = (4.0, 5.4)
X_PAW = (5.7, 6.4)

