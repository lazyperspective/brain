"""Coaster, flume, rapids and railway centrelines for the film park."""
import math
import numpy as np
from track import Track, energy_speed, DS

PI = math.pi
WEST, EAST, NORTH, SOUTH = PI, 0.0, -PI / 2, PI / 2


def hero_coaster():
    y0 = 1.2
    t = Track([24.0, y0, -74.0], WEST)
    t.straight(34, tag='station')                 # x 24 -> -10
    t.straight(4, tag='drive')
    t.turn(90, 12, tag='drive', auto_roll=False)  # -> north
    t.straight(3, tag='drive')
    t.seg(12, phi_to=38, tag='lift')
    t.seg(58, tag='lift')
    t.seg(14, phi_to=0, tag='lift')
    t.seg(28, dpsi=90, phi_to=-6, tag='crest', auto_roll=True)     # crest turn -> east, slight pre-drop
    t.seg(12, phi_to=-62, tag='drop')
    t.seg(28.5, tag='drop')
    t.seg(22, phi_to=0, tag='drop')
    t.seg(6, tag='track')
    t.seg(14, phi_to=36, tag='airtime')           # camelback
    t.seg(11, tag='airtime')
    t.seg(18, phi_to=-36, tag='airtime')
    t.seg(10, tag='airtime')
    t.seg(14, phi_to=0, tag='airtime')
    t.seg(22, tag='track')
    t.seg(26, phi_to=14, tag='turnaround', auto_roll=True)
    t.seg(66, dpsi=180, phi_to=-8, tag='turnaround', auto_roll=True)   # overbanked turnaround -> west
    t.seg(14, phi_to=0, tag='track', auto_roll=True)
    t.straight(8, tag='track')
    t.loop(100, lateral=-5.0, tag='loop')
    t.straight(5, tag='track')
    t.corkscrew(24, 6.5, right_hand=True, tag='corkscrew')
    t.seg(12, phi_to=25, tag='track')
    t.seg(8, tag='track')
    t.seg(12, phi_to=-3.6, tag='track')
    t.seg(150, dpsi=-540, tag='helix', auto_roll=True)
    t.seg(10, phi_to=0, tag='track', auto_roll=True)
    t.straight(36, tag='trim')
    t.seg(48, dpsi=180, tag='turn', auto_roll=True)
    t.close_to([60.0, y0, -74.0], WEST, tag='brakes')
    t.straight(36, tag='brakes')
    return t


def finish_hero(t):
    def vprof(tr):
        return energy_speed(tr, {
            'station': ('fixed', 1.6), 'drive': ('fixed', 2.6), 'lift': ('fixed', 3.6),
            'trim': ('brake', 11.0, 4.0), 'brakes': ('brake', 1.8, 3.5)}, mu=0.012, drag=0.00022)
    t.finish(v_profile=vprof)
    return t



def transform(t, angle_deg, cx, cz, dx=0.0, dz=0.0):
    """Rotate a finished track about (cx, cz) by angle (deg, about +y, map clockwise
    when z points down) then translate."""
    a = math.radians(angle_deg)
    c, s_ = math.cos(a), math.sin(a)
    def rot(v, pos):
        x, z = v[:, 0].copy(), v[:, 2].copy()
        if pos:
            x -= cx; z -= cz
        nx = c * x - s_ * z
        nz = s_ * x + c * z
        if pos:
            nx += cx + dx; nz += cz + dz
        out = v.copy(); out[:, 0] = nx; out[:, 2] = nz
        return out
    t.Parr = rot(t.Parr, True)
    t.Tarr = rot(t.Tarr, False)
    t.Uarr = rot(t.Uarr, False)
    return t


def finish_generic(t, rules, mu=0.02, drag=0.0003, bank_scale=1.0, max_bank=60.0, v_station=1.5):
    t.finish(v_profile=lambda tr: energy_speed(tr, rules, mu=mu, drag=drag, v_station=v_station),
             bank_scale=bank_scale, max_bank=max_bank)
    return t


def wooden_coaster():
    """Out-and-back timber coaster along the east berm (Frontier)."""
    y0 = 1.4
    t = Track([233.0, y0, 76.0], SOUTH)
    t.straight(30, tag='station')                 # z 70 -> 100
    t.straight(3, tag='drive')
    t.seg(44, dpsi=-180, tag='drive')             # left U-turn -> north, x ~ 256
    t.straight(3, tag='drive')
    t.ramp(33.0, 30, 10, tag='lift')
    t.seg(6, phi_to=-4, tag='crest')
    t.ramp(2.2, 52, 12, tag='drop')
    t.seg(4, tag='hill')
    t.ramp(24.0, 40, 10, tag='hill'); t.seg(3, tag='hill'); t.ramp(4.0, 40, 10, tag='hill')
    t.seg(4, tag='hill')
    t.ramp(19.0, 32, 9, tag='hill'); t.seg(4, tag='turnaround')
    t.seg(56, dpsi=-180, tag='turnaround', auto_roll=True)          # north -> west -> south
    t.seg(4, tag='turnaround')
    t.ramp(2.5, 45, 10, tag='drop')
    for h in [12.0, 8.5]:
        t.seg(3, tag='hill'); t.ramp(h, 30, 8, tag='hill'); t.seg(2, tag='hill'); t.ramp(2.5, 30, 8, tag='hill')
    t.seg(18, dpsi=-28, tag='twister', auto_roll=True)
    t.seg(18, dpsi=28, tag='twister', auto_roll=True)
    t.close_to([233.0, y0, 46.0], SOUTH, tag='brakes')
    t.straight(30, tag='brakes')
    return finish_generic(t, {'station': ('fixed', 1.6), 'drive': ('fixed', 2.4), 'lift': ('fixed', 3.2),
                              'brakes': ('brake', 1.6, 5.5)}, mu=0.025, drag=0.0003, bank_scale=0.9)


def family_coaster():
    """Compact family coaster in Kiddie Land."""
    y0 = 1.0
    t = Track([-104.0, y0, 134.0], WEST)
    t.straight(18, tag='station')                 # x -104 -> -122
    t.seg(10, dpsi=90, tag='drive')               # -> north
    t.straight(2, tag='drive')
    t.seg(5, phi_to=28, tag='lift')
    t.seg(16, tag='lift')
    t.seg(5, phi_to=0, tag='lift')
    t.seg(22, dpsi=90, phi_to=-3, tag='crest', auto_roll=True)        # -> east, ~11 m
    t.seg(5, phi_to=-35, tag='drop')
    t.seg(8, tag='drop')
    t.seg(7, phi_to=0, tag='drop')
    t.seg(5, phi_to=14, tag='hill'); t.seg(5, phi_to=0, tag='hill')
    t.seg(5, phi_to=-14, tag='hill'); t.seg(5, phi_to=0, tag='hill')
    t.seg(16, dpsi=90, tag='turn', auto_roll=True)                     # -> south
    t.ramp(7.0, 20, 5, tag='track', end_phi=-5.5)
    t.seg(52, dpsi=360, tag='helix', auto_roll=True)                  # right helix, descending
    t.seg(5, phi_to=0, tag='track', auto_roll=True)
    t.close_to([-84.0, y0, 134.0], WEST, tag='brakes')
    t.straight(20, tag='brakes')
    return finish_generic(t, {'station': ('fixed', 1.4), 'drive': ('fixed', 2.0), 'lift': ('fixed', 2.4),
                              'brakes': ('brake', 1.4, 2.5)}, mu=0.025, drag=0.0004, max_bank=45)


def log_flume():
    """Log flume in Adventure Jungle; centreline = water surface in the trough."""
    y0 = 0.6
    t = Track([-122.0, y0, -95.0], NORTH)
    t.straight(20, tag='station')                 # z -95 -> -115
    t.straight(4, tag='channel')
    t.seg(4, phi_to=24, tag='lift'); t.seg(13, tag='lift'); t.seg(4, phi_to=0, tag='lift')
    t.seg(8, phi_to=-0.4, tag='channel')
    t.seg(26, dpsi=90, tag='channel')             # -> east, elevated
    t.straight(6, tag='channel')
    t.ramp(0.6, 30, 4, tag='drop')
    t.seg(6, phi_to=0, tag='channel')
    t.seg(26, dpsi=90, tag='channel')             # -> south
    t.straight(22, tag='channel')
    t.seg(32, dpsi=-180, tag='channel')           # U-turn -> north
    t.ramp(16.0, 30, 4, tag='lift')
    t.seg(55, dpsi=-180, phi_to=-0.4, tag='channel')   # top turn -> south
    t.ramp(0.6, 38, 6, tag='drop')
    t.straight(18, tag='splash')
    t.seg(16, dpsi=90, tag='channel')             # -> west
    t.close_to([-122.0, y0, -95.0], NORTH, tag='channel')
    return finish_generic(t, {'station': ('fixed', 1.2), 'channel': ('fixed', 2.2), 'lift': ('fixed', 1.6),
                              'splash': ('brake', 2.0, 12.0)}, mu=0.06, drag=0.002, max_bank=0, bank_scale=0)


def river_rapids():
    """Wide rapids channel looping round the jungle rock hill; centreline = water surface."""
    y0 = 0.4
    t = Track([-180.0, y0, -80.0], WEST)
    t.straight(14, tag='station')
    t.seg(6, phi_to=8, tag='lift'); t.seg(26, tag='lift'); t.seg(6, phi_to=0, tag='lift')
    t.seg(26, dpsi=90, phi_to=-0.7, tag='channel')        # -> north
    t.seg(26, dpsi=20, tag='rapids')
    t.seg(26, dpsi=-20, tag='rapids')
    t.seg(8, phi_to=-6, tag='chute'); t.seg(8, phi_to=-0.7, tag='chute')
    t.seg(30, dpsi=90, tag='rapids')                      # -> east
    t.seg(30, tag='waterfall')
    t.seg(26, dpsi=90, tag='rapids')                      # -> south
    t.seg(20, dpsi=-15, tag='rapids')
    t.seg(20, dpsi=15, tag='rapids')
    t.close_to([-166.0, y0, -80.0], WEST, tag='channel')
    t.straight(0.5, tag='channel')
    return finish_generic(t, {'station': ('fixed', 1.0), 'lift': ('fixed', 1.2), 'channel': ('fixed', 2.4),
                              'rapids': ('fixed', 3.2), 'chute': ('fixed', 4.0), 'waterfall': ('fixed', 2.6)},
                          max_bank=0, bank_scale=0)


def railway():
    """Perimeter railway on the berm crest: rounded rectangle, anticlockwise from the gate station."""
    y0 = 5.4
    X, Z0, Z1, R = 290.0, -200.0, 160.0, 60.0
    t = Track([60.0, y0, Z1], WEST)
    t.straight(60.0 + X - R - 60 - 0, tag='track') if False else None
    # south side heading west: x 60 -> -X+R
    t.straight(60.0 + (X - R), tag='track')
    t.seg(R * math.pi / 2, dpsi=90, tag='track')      # -> north
    t.straight((Z1 - Z0) - 2 * R, tag='track')
    t.seg(R * math.pi / 2, dpsi=90, tag='track')      # -> east
    t.straight(2 * X - 2 * R, tag='track')
    t.seg(R * math.pi / 2, dpsi=90, tag='track')      # -> south
    t.straight((Z1 - Z0) - 2 * R, tag='track')
    t.seg(R * math.pi / 2, dpsi=90, tag='track')      # -> west
    t.close_to([60.0, y0, Z1], WEST, tag='track')
    t.finish(v_profile=lambda tr: np.full(len(tr.Parr), 6.0), bank_scale=0, max_bank=0)
    return t


BUILD = {'hero': lambda: finish_hero(hero_coaster()), 'wooden': wooden_coaster,
         'family': lambda: transform(family_coaster(), 180, -98.0, 113.5, 0.0, 0.0),
         'flume': log_flume, 'rapids': river_rapids, 'railway': railway}

if __name__ == '__main__':
    import sys
    t = BUILD[sys.argv[1] if len(sys.argv) > 1 else 'hero']()
    P = t.Parr
    print('len', t.s[-1], 'end', P[-1], 'maxy', P[:, 1].max(), 'miny', P[:, 1].min())
    for tag in dict.fromkeys(t.tags):
        m = t.tags == tag
        print(tag, 'x %.0f..%.0f z %.0f..%.0f y %.1f..%.1f v %.1f..%.1f' % (
            P[m, 0].min(), P[m, 0].max(), P[m, 2].min(), P[m, 2].max(), P[m, 1].min(), P[m, 1].max(), t.v[m].min(), t.v[m].max()))
