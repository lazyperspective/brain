"""Region definitions: which paper pieces live where. Sizes are in globe radii."""
import math
from .mech import sway, spin, nod, bob

P = 0.054   # person width (v2: larger so people read as characters)


def flick(rate=5.0, base=0.75, amp=0.25, ph=0.0):
    return lambda tau, t: base + amp * math.sin(tau * rate + ph) * math.sin(tau * rate * 0.37 + 1.0)


def europe(sc):
    R = 'europe'
    sc.flap(R, 44.5, 14.0, 'alps_z', 0.28, order=0)
    sc.flap(R, 47.5, 1.5, 'eiffel', 0.19, order=1,
            emis_parts=[dict(spr='glow', x=0.5, y=2.22, w=0.5, flick=flick(5.0))])
    sc.flap(R, 52.0, -9.0, 'bigben', 0.09, order=2)
    sc.flap(R, 53.0, 17.5, 'windmill', 0.15, order=2,
            parts=[dict(spr='sails', x=-0.12, y=0.26, w=1.24, pivot=(0.5, 0.5), anim=spin(5.0))])
    sc.flap(R, 41.5, 13.5, 'colosseum', 0.17, order=3)
    sc.flap(R, 56.0, 38.0, 'basil', 0.21, order=1)
    sc.flap(R, 40.5, 31.0, 'hagia', 0.19, order=2)
    sc.flap(R, 63.5, 14.0, 'pine', 0.085, order=2)
    sc.flap(R, 62.0, 28.0, 'pine', 0.08, order=3)
    sc.flap(R, 48.5, 25.5, 'tree', 0.10, order=2)
    sc.flap(R, 51.0, 33.5, 'tree_autumn', 0.095, order=3)
    sc.flap(R, 46.5, 37.0, 'balloon', 0.12, order=4, stand=84, strut=False,
            mover=lambda tau, act, t: (46.5, 37.0, False, 0.15 * act + 0.012 * act * math.sin(tau * 1.1), 3 * math.sin(tau * 0.9) * act, 0.0))
    sc.walk(R, 'person0', P, 44.0, -4.0, 44.0, 2.5, period=12)
    sc.walk(R, 'person1', P, 39.0, 10.0, 39.0, 16.5, period=11)
    sc.walk(R, 'person5', P, 50.0, 39.0, 50.0, 46.0, period=14, phase=0.5)
    sc.bird(R, 51.0, 6.0, 'bird_w', 0.10, radius=5.5, alt=0.62, period=7.0)
    sc.bird(R, 51.0, 6.0, 'bird_w', 0.085, radius=5.5, alt=0.56, period=7.0, phase=2.4)


def africa(sc):
    R = 'africa'
    sc.pyramid(R, 29.5, 29.5, 'pyr_face', 0.26, order=1, yaw=24)
    sc.pyramid(R, 25.5, 20.5, 'pyr_face', 0.20, order=2, yaw=24)
    sc.pyramid(R, 21.5, 30.5, 'pyr_face', 0.15, order=3, yaw=24)
    sc.flap(R, 16.0, 37.5, 'palm', 0.11, order=3)
    sc.flap(R, 31.0, -6.0, 'palm', 0.10, order=3)
    sc.flap(R, 25.5, 1.0, 'dune_z', 0.30, order=1)
    for i in range(3):
        sc.walk(R, 'camel', 0.12, 17.0, -8.0 + i * 8.0, 17.0, 0.0 + i * 8.0, period=24, order=4)
    sc.flap(R, -4.5, 37.0, 'kili_z', 0.36, order=0)
    sc.flap(R, 3.5, 31.5, 'acacia', 0.21, order=2)
    sc.flap(R, -18.5, 35.5, 'acacia', 0.17, order=2)
    sc.flap(R, 1.0, 14.5, 'jungle', 0.24, order=1)
    tr = dict(spr='trunk', x=0.75, y=0.02, w=0.23, pivot=(0.5, 0.93), anim=sway(13, 3.4))
    sc.flap(R, -11.0, 22.5, 'elephant', 0.22, order=3, parts=[dict(tr)], strut=False)
    sc.flap(R, -13.5, 30.0, 'elephant', 0.13, order=4, parts=[dict(tr, anim=sway(16, 2.6, 1.0))], strut=False)
    nk = dict(spr='giraffe_neck', x=0.56, y=0.64, w=0.545, pivot=(0.28, 0.02))
    sc.flap(R, 7.5, 23.5, 'giraffe', 0.17, order=3, parts=[dict(nk, anim=nod(20, 9.0, 0.5))], strut=False)
    sc.walk(R, 'zebra', 0.12, -20.5, 17.5, -20.5, 25.5, period=18)
    sc.walk(R, 'zebra', 0.11, -23.5, 23.0, -23.5, 30.0, period=18, phase=0.12)
    sc.flap(R, -27.5, 20.5, 'lion', 0.12, order=4, strut=False)
    sc.flap(R, 11.5, -3.5, 'hut', 0.11, order=3)
    sc.flap(R, 8.5, 5.0, 'hut', 0.10, order=4)
    sc.walk(R, 'person2', P, 6.0, -6.0, 6.0, 1.0, period=12)
    sc.walk(R, 'person4', P, 13.5, 24.0, 13.5, 30.0, period=11, phase=0.4)
    for la, lo in [(-27.0, 30.0), (-29.0, 32.5)]:
        sc.flap(R, la, lo, 'flamingo', 0.06, order=5, strut=False)
    sc.flap(R, -32.0, 21.5, 'tablemt', 0.22, order=1)
    sc.flap(R, -19.5, 46.5, 'baobab', 0.13, order=2)
    sc.bird(R, -4.0, 29.0, 'bird_d', 0.10, radius=6.5, alt=0.38, period=9.0)
    sc.bird(R, -4.0, 29.0, 'bird_d', 0.085, radius=6.5, alt=0.26, period=9.0, phase=3.0)


def namerica(sc):
    R = 'namerica'
    sc.zigzag(R, 47.0, -114.0, 'rockies_z', 2, 0.46, order=0, beta=76)
    sc.flap(R, 40.5, -74.0, 'liberty', 0.15, order=1,
            emis_parts=[dict(spr='glow', x=0.71, y=2.46, w=0.62, flick=flick(6.0))])
    sc.flap(R, 43.5, -80.5, 'skyline', 0.22, order=2)
    sc.flap(R, 48.5, -89.0, 'niagara', 0.24, order=2,
            parts=[dict(spr='mist', x=0.14, y=-0.03, w=0.30, anim=bob(0.03, 2.2, 0.0)),
                   dict(spr='mist', x=0.38, y=-0.05, w=0.28, anim=bob(0.035, 2.6, 1.3)),
                   dict(spr='mist', x=0.58, y=-0.03, w=0.30, anim=bob(0.03, 2.0, 2.4))])
    sc.flap(R, 35.0, -110.5, 'canyon_z', 0.34, order=1)
    sc.flap(R, 38.5, -123.5, 'goldengate', 0.26, order=2)
    sc.flap(R, 49.5, -124.0, 'redwood', 0.085, order=2)
    sc.flap(R, 53.5, -127.5, 'redwood', 0.075, order=3)
    sc.walk(R, 'bison', 0.17, 41.0, -106.0, 41.0, -97.0, period=22)
    sc.walk(R, 'bison', 0.15, 37.0, -101.5, 37.0, -93.5, period=22, phase=0.2)
    sc.flap(R, 30.0, -107.0, 'cactus', 0.07, order=3)
    sc.flap(R, 26.0, -102.5, 'cactus', 0.065, order=4)
    sc.flap(R, 20.0, -89.5, 'chichen', 0.19, order=2)
    sc.flap(R, 49.0, -70.0, 'tree_autumn', 0.11, order=3)
    sc.flap(R, 53.0, -80.0, 'tree_autumn', 0.10, order=2)
    sc.flap(R, 58.5, -114.0, 'moose', 0.17, order=3, strut=False)
    sc.walk(R, 'polarbear', 0.15, 62.0, -94.0, 62.0, -82.0, period=20, order=3)
    sc.walk(R, 'person1', P, 37.6, -81.0, 37.6, -74.5, period=12)
    sc.walk(R, 'person3', P, 30.0, -121.0, 30.0, -115.0, period=12, phase=0.3)
    sc.bird(R, 48.0, -112.0, 'eagle_w', 0.13, radius=6.0, alt=0.34, period=9.0)


def samerica(sc):
    R = 'samerica'
    sc.flap(R, -21.0, -67.0, 'andes_z', 0.38, order=0)
    sc.flap(R, -12.0, -74.0, 'machu', 0.28, order=1)
    sc.flap(R, -17.5, -70.0, 'llama', 0.12, order=3, strut=False)
    sc.flap(R, -22.0, -44.5, 'christ', 0.17, order=1)
    sc.flap(R, -1.0, -64.5, 'jungle', 0.32, order=1)
    sc.flap(R, -6.5, -55.0, 'jungle', 0.26, order=2)
    sc.flap(R, 5.5, -61.5, 'palm', 0.10, order=3)
    sc.walk(R, 'jaguar', 0.17, -13.0, -61.0, -13.0, -52.0, period=20)
    sc.flap(R, -3.0, -49.5, 'toucan', 0.11, order=4, strut=False)
    sc.bird(R, -3.5, -61.0, 'macaw_w', 0.16, radius=6.5, alt=0.38, period=8.0)
    sc.bird(R, -3.5, -61.0, 'macaw_w', 0.13, radius=6.5, alt=0.25, period=8.0, phase=3.3)
    sc.flap(R, -49.0, -72.0, 'glacier_z', 0.19, order=1)
    sc.flap(R, -55.5, -68.0, 'penguin', 0.065, order=3, hang=False)
    sc.flap(R, -52.5, -60.0, 'penguin', 0.06, order=4, hang=False)
    for i, lo in enumerate((-113.0, -109.3, -105.6)):
        sc.flap('pacific', -27.0, lo, 'moai', 0.075, order=2 + i)
    sc.flap(R, -0.6, -90.6, 'tortoise', 0.12, order=3, strut=False)
    sc.walk(R, 'person2', P, -30.5, -55.0, -30.5, -49.0, period=8)
    sc.walk(R, 'person5', P, -28.0, -47.0, -28.0, -52.5, period=9, phase=0.4)
    sc.bird(R, -20.0, -66.0, 'bird_d', 0.11, radius=6.0, alt=0.34, period=10.0)


def asia(sc):
    R = 'southasia'
    sc.zigzag(R, 29.5, 84.0, 'himalaya_z', 2, 0.46, order=0, beta=76)
    sc.flap(R, 22.5, 76.5, 'taj', 0.30, order=1)
    sc.walk(R, 'tiger', 0.19, 19.0, 80.0, 19.0, 88.0, period=20)
    tr = dict(spr='trunk', x=0.75, y=0.02, w=0.23, pivot=(0.5, 0.93), anim=sway(13, 3.0))
    sc.flap(R, 13.0, 77.5, 'elephant', 0.17, order=3, parts=[dict(tr)], strut=False)
    sc.flap(R, 20.5, 66.5, 'peacock', 0.13, order=4, strut=False)
    sc.flap(R, 24.5, 54.5, 'burj', 0.075, order=1)
    sc.flap(R, 20.0, 46.5, 'dune_z', 0.25, order=2)
    sc.walk(R, 'camel', 0.12, 28.0, 41.5, 28.0, 49.5, period=22)
    sc.walk(R, 'person4', P, 18.0, 71.5, 18.0, 77.0, period=12)
    R = 'eastasia'
    sc.zigzag(R, 41.5, 106.0, 'greatwall', 6, 0.60, order=1, beta=62)
    sc.flap(R, 36.0, 116.5, 'pagoda', 0.16, order=2)
    sc.flap(R, 30.0, 104.0, 'panda', 0.16, order=3, strut=False)
    sc.flap(R, 32.5, 110.0, 'bamboo', 0.09, order=4)
    sc.flap(R, 36.0, 138.5, 'fuji_z', 0.38, order=0)
    sc.flap(R, 34.0, 132.0, 'cherry', 0.13, order=2)
    sc.flap(R, 39.5, 142.0, 'cherry', 0.12, order=3)
    sc.flap(R, 33.5, 136.5, 'torii', 0.12, order=3)
    sc.flap(R, 13.5, 104.0, 'angkor', 0.20, order=2)
    sc.flap(R, 0.5, 114.0, 'orangutan', 0.13, order=3, strut=False)
    for la, lo, o in [(62, 88, 2), (64, 106, 3), (62, 123, 2)]:
        sc.flap(R, la, lo, 'pine_snow', 0.09, order=o)
    sc.walk(R, 'reindeer', 0.16, 67.5, 96.0, 67.5, 110.0, period=22, order=3)
    sc.walk(R, 'train', 0.36, 54.5, 66.0, 54.5, 98.0, period=40, order=2)
    sc.flap(R, 47.0, 103.0, 'yurt', 0.12, order=3)
    sc.walk(R, 'person0', P, 27.5, 108.0, 27.5, 114.0, period=12)
    sc.walk(R, 'person3', P, 31.5, 135.5, 31.5, 140.5, period=10, phase=0.3)
    sc.bird(R, 37.0, 137.0, 'bird_w', 0.11, radius=5.5, alt=0.46, period=8.0)
    sc.bird(R, 37.0, 137.0, 'bird_w', 0.095, radius=5.5, alt=0.42, period=8.0, phase=2.6)


def oceania(sc):
    R = 'oceania'
    sc.flap(R, -24.0, 131.0, 'uluru_z', 0.32, order=0)
    sc.flap(R, -30.0, 153.0, 'hbridge', 0.34, order=0)
    sc.flap(R, -35.0, 149.5, 'opera', 0.34, order=1)
    sc.walk(R, 'kangaroo', 0.13, -31.0, 130.0, -31.0, 138.0, period=9, hop=0.03)
    sc.walk(R, 'kangaroo', 0.11, -20.0, 122.5, -20.0, 131.0, period=9, hop=0.03, phase=0.35)
    sc.walk(R, 'kangaroo', 0.10, -32.5, 119.5, -32.5, 127.0, period=9, hop=0.03, phase=0.7)
    sc.flap(R, -26.5, 141.0, 'gum', 0.15, order=2)
    sc.flap(R, -17.0, 148.5, 'coral_a', 0.11, order=2)
    sc.flap(R, -13.0, 146.5, 'coral_b', 0.10, order=3)
    sc.flap(R, -20.5, 152.0, 'coral_c', 0.095, order=3)
    sc.walk(R, 'fish_a', 0.065, -15.0, 150.5, -15.0, 156.0, period=8, order=4)
    sc.walk(R, 'fish_b', 0.065, -18.5, 154.5, -18.5, 159.5, period=9, phase=0.4, order=4)
    sc.walk(R, 'turtle', 0.12, -23.5, 155.5, -23.5, 162.0, period=16, order=4)
    sc.flap(R, -27.5, 158.5, 'surf', 0.22, order=2,
            parts=[dict(spr='surfer', x=0.50, y=0.50, w=0.36, pivot=(0.5, 0.0), anim=sway(8, 2.4))])
    sc.flap(R, -43.8, 170.3, 'nzalps_z', 0.19, order=1)
    sc.walk(R, 'sheep', 0.075, -38.0, 174.5, -38.0, 178.0, period=12, order=4)
    sc.walk(R, 'sheep', 0.07, -40.0, 177.0, -40.0, 174.0, period=13, phase=0.3, order=4)
    sc.flap(R, -5.5, 141.0, 'palm', 0.10, order=3)
    sc.flap(R, -7.6, 110.5, 'volcano', 0.19, order=2,
            parts=[dict(spr='smoke', x=0.34, y=0.74, w=0.32, anim=bob(0.03, 2.8, 0.0))],
            emis_parts=[dict(spr='glow', x=0.5, y=0.66, w=0.5, flick=flick(4.0, 0.7, 0.3))])
    sc.walk(R, 'person1', P, -34.5, 136.0, -34.5, 141.0, period=11)
    sc.bird(R, -6.5, 143.5, 'macaw_w', 0.13, radius=5.0, alt=0.25, period=8.0)


def arctic(sc):
    R = 'arctic'
    sc.zigzag(R, 69.5, -40.0, 'aurora', 8, 0.56, order=0, beta=48, shimmer=1.0, follow=False, fade=True)
    sc.flap(R, 65.5, -34.0, 'igloo', 0.16, order=2)
    sc.walk(R, 'polarbear', 0.16, 77.0, -50.0, 77.0, -30.0, period=20, order=3)
    sc.flap(R, 64.8, -19.0, 'geyser', 0.10, order=2)
    n0 = len(sc.pieces)
    sc.zigzag(R, 67.5, -150.0, 'aurora', 8, 0.52, order=0, beta=48, shimmer=1.0, follow=False, fade=True)
    sc.flap(R, 62.0, -154.0, 'cabin', 0.15, order=2,
            emis_parts=[dict(spr='glow', x=0.32, y=0.25, w=0.55, flick=flick(3.0, 0.8, 0.2))])
    sc.flap(R, 61.0, -142.0, 'moose', 0.17, order=3, strut=False)
    sc.flap(R, 62.5, -163.0, 'pine_snow', 0.09, order=2)
    sc.flap(R, 60.0, -134.5, 'pine_snow', 0.085, order=3)
    for p in sc.pieces[n0:]:
        p.hero_region = 'namerica'     # Alaska opens with the North American close-up, on the upper left


def antarctica(sc):
    R = 'antarctica'
    # the Ross Sea, framed when the camera dips under the world: shelf, colony, aurora australis, station
    sc.flap(R, -77.0, 179.0, 'iceshelf', 0.60, order=0)
    sc.zigzag(R, -63.5, 165.0, 'aurora_s', 8, 0.50, order=0, beta=48, shimmer=1.0, follow=False, fade=True, glow=True)
    sc.flap(R, -70.5, 171.0, 'colony', 0.36, order=1)
    sc.flap(R, -77.8, 166.5, 'station', 0.17, order=2)
    sc.flap(R, -62.0, -172.0, 'iceberg_z', 0.26, order=1)
    sc.flap(R, -62.0, 150.0, 'iceberg_z', 0.20, order=1)
    sc.flap(R, -68.0, 139.0, 'seal', 0.15, order=3, strut=False)
    # two rows of walkers on the camera side of the colony, spaced wider than they walk so they never cross
    for i, (la, lo) in enumerate([(-65.0, 158.0), (-65.0, 180.0), (-68.5, 169.0), (-68.5, 191.0)]):
        sc.walk(R, 'penguin', 0.085, la, lo - 1.5, la, lo + 1.5, period=[6.0, 5.0, 7.5][i % 3], phase=i * 0.17, order=2 + i % 3)
    # the rest of the coast, seen only in passing at the bottom of frame
    for i, (la, lo) in enumerate([(-66.0, -62.0), (-70.0, -72.0), (-73.0, -52.0)]):
        sc.walk(R, 'penguin', 0.075, la, lo - 2.0, la, lo + 2.0, period=[6.0, 5.0, 7.5][i], phase=i * 0.3, order=2 + i)
    sc.flap(R, -62.5, -48.0, 'iceberg_z', 0.17, order=1)
    for i, (la, lo) in enumerate([(-68.0, 70.0), (-70.5, 84.0), (-68.5, 98.0)]):
        sc.walk(R, 'penguin', 0.075, la, lo - 2.0, la, lo + 2.0, period=[6.0, 5.0, 7.5][i], phase=i * 0.3, order=2 + i)
    sc.flap(R, -63.0, 100.0, 'iceberg_z', 0.17, order=1)
    sc.flap(R, -64.0, 20.0, 'iceberg_z', 0.16, order=1)


def pacific(sc):
    R = 'pacific'
    sc.flap(R, 19.6, -155.6, 'volcano', 0.26, order=1,
            parts=[dict(spr='smoke', x=0.34, y=0.74, w=0.32, anim=bob(0.03, 2.8, 0.0))],
            emis_parts=[dict(spr='glow', x=0.5, y=0.66, w=0.5, flick=flick(4.0, 0.7, 0.3))])
    sc.flap(R, 21.6, -160.0, 'palm', 0.10, order=3)
    sc.flap(R, 17.8, -152.0, 'palm', 0.09, order=4)
    # the great wave rises tall over a little fleet of paper boats
    sc.flap(R, -11.0, -163.0, 'greatwave', 0.50, order=0)
    for i, (la, lo, nm) in enumerate([(-15.0, -168.5, 'sail_r'), (-14.0, -160.0, 'sail_y'), (-16.8, -164.0, 'sail_g'), (-13.2, -165.0, 'sail_y')]):
        ph = i * 1.9
        sc.flap(R, la, lo, nm, 0.095 if i < 3 else 0.075, order=2 + i % 3, strut=False,
                mover=(lambda la=la, lo=lo, ph=ph: (lambda tau, act, t: (la, lo, False, 0.006 * act * (0.5 + 0.5 * math.sin(tau * 2.2 + ph)),
                                                                          7.0 * act * math.sin(tau * 1.7 + ph), 0.0)))())
    sc.flap(R, -18.0, -149.5, 'atoll', 0.24, order=2)
    sc.walk(R, 'turtle', 0.12, -24.0, -140.0, -24.0, -132.0, period=20, order=4)
    sc.walk(R, 'fish_b', 0.07, 6.0, -126.0, 6.0, -119.0, period=10, order=4, hop=0.03)


def oceans(sc):
    """Paper wave crests that pop up across the open sea, row after row."""
    spots = [
        # Pacific
        (38, 178), (30, -150), (44, -160), (22, 172), (10, -132), (6, -152), (-6, 172), (-18, -128),
        (-32, -146), (-34, 178), (-48, -118), (26, -132), (-2, -108), (48, -140), (-30, -102),
        # Atlantic
        (30, -52), (20, -38), (6, -28), (-14, -8), (-26, -30), (-40, -22), (44, -38),
        # Indian
        (-8, 70), (-18, 92), (-34, 64), (-36, 100), (0, 58), (-44, 48),
    ]
    for i, (la, lo) in enumerate(spots):
        w = 0.15 + 0.035 * ((i * 7) % 4) / 3.0
        ph = i * 1.7
        sc.flap('ocean', la, lo, 'wavelet', w, order=1 + (i % 4), strut=False, quiet=(i % 3 != 0),
                mover=(lambda la=la, lo=lo, ph=ph: (lambda tau, act, t: (la, lo, False, 0.0, 4.0 * act * math.sin(tau * 1.4 + ph), 0.0)))())


def build(sc):
    europe(sc)
    africa(sc)
    namerica(sc)
    samerica(sc)
    asia(sc)
    oceania(sc)
    arctic(sc)
    antarctica(sc)
    pacific(sc)
    oceans(sc)
