"""Character design options for the warrior mini-series: chibi pixel sprites in three poses each
(ready, strike, awakened), drawn procedurally on a 64x64 grid and laid out on 1920x1080 cards."""
import math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

G = 96                      # sprite grid
OX, OY = 20, 22              # sprite coordinates are offset by this inside the grid
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

class Spr:
    def __init__(s, pal):
        s.pal = pal                       # name -> hex
        s.names = list(pal)
        s.a = np.zeros((G, G), np.int16)  # 0 empty, else index+1 into names
        s.fx = np.zeros((G, G), np.int16) # effects layer (no outline)
    def c(s, n): return s.names.index(n) + 1
    def px(s, x, y, n, fx=False):
        x, y = int(round(x)) + OX, int(round(y)) + OY
        if 0 <= x < G and 0 <= y < G:
            (s.fx if fx else s.a)[y, x] = s.c(n)
    def rect(s, x0, y0, x1, y1, n, fx=False):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1): s.px(x, y, n, fx)
    def ell(s, cx, cy, rx, ry, n, fx=False):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.px(x, y, n, fx)
    def line(s, x0, y0, x1, y1, n, w=1, fx=False):
        L = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(int(L * 2) + 1):
            u = i / (L * 2); x = x0 + (x1 - x0) * u; y = y0 + (y1 - y0) * u
            for dy in range(-(w // 2), w - w // 2):
                for dx in range(-(w // 2), w - w // 2): s.px(x + dx, y + dy, n, fx)
    def poly(s, pts, n, fx=False):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            for x in range(int(min(xs)), int(max(xs)) + 1):
                inside = False; j = len(pts) - 1
                for i in range(len(pts)):
                    xi, yi = pts[i]; xj, yj = pts[j]
                    if (yi > y + .5) != (yj > y + .5) and x + .5 < (xj - xi) * (y + .5 - yi) / (yj - yi) + xi: inside = not inside
                    j = i
                if inside: s.px(x, y, n, fx)
    def blade(s, hx, hy, ang, L, w, edge, core, glow=None, guard=None, grip=None):
        ca, sa = math.cos(ang), math.sin(ang)
        if grip: s.line(hx - ca * 3, hy - sa * 3, hx + ca * 1, hy + sa * 1, grip, 2)
        if guard: s.line(hx + ca * 2 - sa * 3, hy + sa * 2 + ca * 3, hx + ca * 2 + sa * 3, hy + sa * 2 - ca * 3, guard, 2)
        for i in range(int(L * 2)):
            u = i / 2; x = hx + ca * (3 + u); y = hy + sa * (3 + u)
            ww = w if u < L - 4 else max(0.5, w * (L - u) / 4)
            for k in range(-int(ww), int(ww) + 1):
                s.px(x - sa * k * 0.5, y + ca * k * 0.5, edge if k <= -int(ww) + 0 else core)
        if glow:
            for i in range(int(L)):
                u = i; x = hx + ca * (4 + u); y = hy + sa * (4 + u)
                if i % 3 == 1: s.px(x, y, glow)
    def outline(s, n):
        a = s.a; o = a.copy(); c = s.c(n)
        for y in range(G):
            for x in range(G):
                if a[y, x]: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < G and 0 <= Y < G and a[Y, X] and a[Y, X] != c: o[y, x] = c; break
        s.a = o
    def image(s, scale):
        img = np.zeros((G, G, 4), np.uint8)
        cols = [(0, 0, 0)] + [hexrgb(s.pal[n]) for n in s.names]
        for y in range(G):
            for x in range(G):
                k = s.a[y, x] or s.fx[y, x]
                if s.a[y, x] and s.fx[y, x] and s.names[s.fx[y, x] - 1].startswith('fx_top'): k = s.fx[y, x]
                if k: img[y, x] = cols[k] + (255,)
        return Image.fromarray(img, 'RGBA').resize((G * scale, G * scale), Image.NEAREST)

# ---------------------------------------------------------------- the body, shared by everyone
def body(s, P, pose):
    """P: per-character parts. pose: 'ready' | 'strike' | 'awake'. Origin: feet on y=60, body centre x=30."""
    lean = 3 if pose == 'strike' else 0
    hx0 = 30 + lean                             # head centre x
    # back leg, front leg
    if pose == 'strike':
        s.rect(22, 53, 25, 59, P['boot_d']); s.rect(21, 59, 26, 60, P['boot_d'])
        s.rect(34, 53, 37, 59, P['boot']); s.rect(34, 59, 40, 60, P['boot'])
    else:
        s.rect(25, 53, 28, 59, P['boot_d']); s.rect(24, 59, 29, 60, P['boot_d'])
        s.rect(31, 53, 34, 59, P['boot']); s.rect(31, 59, 36, 60, P['boot'])
    # back arm
    s.rect(24 + lean - 2, 41, 26 + lean - 2, 48, P['cloth_d'])
    # torso
    tx = 23 + lean // 2
    s.poly([(tx, 39), (tx + 14, 39), (tx + 15, 54), (tx - 1, 54)], P['cloth'])
    s.rect(tx, 39, tx + 14, 40, P['cloth_l'])
    if P.get('sash'): s.rect(tx - 1, 48, tx + 15, 50, P['sash'])
    if P.get('trim'): s.line(tx + 7, 40, tx + 9, 54, P['trim'])
    if P.get('torso'): P['torso'](s, tx, pose)
    # head
    P['hair_back'](s, hx0, pose)
    s.ell(hx0, 30, 10, 9.5, P['skin'])
    s.rect(hx0 - 9, 36, hx0 + 9, 38, P['skin_d'])
    s.ell(hx0, 30, 10, 9.5, P['skin']) if False else None
    if P.get('cap'):
        for y in range(19, 38):
            for x in range(hx0 - 11, hx0 + 11):
                if ((x + .5 - hx0) / 10) ** 2 + ((y + .5 - 30) / 9.5) ** 2 <= 1 and (y <= 22 or x <= hx0 - 3 + (y - 22) * 0.2):
                    s.px(x, y, P['cap'])
    P['face'](s, hx0, pose)
    P['hair_front'](s, hx0, pose)
    # front arm + weapon
    if pose == 'strike': hand = (tx + 18, 44)
    elif pose == 'awake': hand = (tx + 16, 45)
    else: hand = (tx + 15, 46)
    s.line(tx + 11, 42, hand[0], hand[1], P['cloth'], 3)
    s.rect(hand[0] - 1, hand[1] - 1, hand[0] + 1, hand[1] + 1, P['skin'])
    P['weapon'](s, hand, pose)
    if P.get('extra'): P['extra'](s, hx0, tx, pose)

def sprite(P, pose):
    pal = dict(P['pal'])
    if pose == 'awake' and P.get('awake_pal'): pal.update(P['awake_pal'])
    s = Spr(pal)
    if pose == 'awake' and P.get('aura_back'): P['aura_back'](s)
    body(s, P, pose)
    s.outline(P['outline'])
    if pose == 'awake' and P.get('aura_front'): P['aura_front'](s)
    if pose == 'strike' and P.get('smear'): P['smear'](s)
    return s

def eyes(s, hx, col, pose, style='calm', glow=None):
    ey = 30
    e = glow if (pose == 'awake' and glow) else col
    if style == 'sharp':
        s.rect(hx + 2, ey, hx + 4, ey + 1, e); s.px(hx + 4, ey - 1, e)
        s.rect(hx + 7, ey, hx + 8, ey + 1, e)
    else:
        s.rect(hx + 2, ey - 1, hx + 3, ey + 2, e); s.rect(hx + 7, ey - 1, hx + 8, ey + 2, e)
        s.px(hx + 2, ey - 1, 'white'); s.px(hx + 7, ey - 1, 'white')
    if pose == 'strike': s.rect(hx + 5, ey + 4, hx + 6, ey + 5, 'mouth')

def smear_arc(s, cx, cy, r0, r1, a0, a1, cols):
    for y in range(-OY, G - OY):
        for x in range(-OX, G - OX):
            dx, dy = x + .5 - cx, y + .5 - cy; r = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if a0 <= a <= a1 and r0 <= r <= r1:
                u = (a - a0) / (a1 - a0); k = 2 if u > .7 else 1 if u > .35 else 0
                if k == 0 and (x + y) % 2: continue
                s.px(x, y, cols[k], fx=True)

def flames(s, cols, cx=31, cy=40, R=26, seed=0):
    import random; rnd = random.Random(seed)
    for y in range(-OY, G - OY):
        for x in range(-OX, G - OX):
            dx, dy = (x - cx) / R, (y - cy) / (R * 1.15)
            d = dx * dx + dy * dy + (0.0 if y < cy else (y - cy) / 30)
            n = math.sin(x * 0.9 + seed) * 0.12 + math.sin(y * 0.7 + x * 0.3) * 0.1
            if d < 0.55 + n and rnd.random() > 0.08:
                s.px(x, y, cols[0] if d > 0.35 + n else cols[1], fx=True)
    for k in range(14):
        x = rnd.randint(8, 56); y = rnd.randint(4, 40); s.px(x, y, cols[2], fx=True); s.px(x, y + 1, cols[1], fx=True)

# ================================================================ 1. SABLE, the Ember Ronin
def sable():
    P = dict(outline='ink')
    P['pal'] = {'ink': '#120c12', 'skin': '#f1c9a6', 'skin_d': '#d9a07e', 'hair': '#1f1a24', 'hair_l': '#3b3346', 'ember': '#ff7a2a', 'ember_l': '#ffd36b',
                'mask': '#f4efe6', 'mask_d': '#c9c0b3', 'crack': '#2a1612', 'cloth': '#34303c', 'cloth_d': '#221f29', 'cloth_l': '#4b4656', 'sash': '#e2552b',
                'boot': '#2a2530', 'boot_d': '#1a1620', 'steel': '#cfd6e0', 'steel_d': '#7d8796', 'grip': '#5a2a1a', 'gold': '#e9b54a', 'white': '#ffffff', 'mouth': '#5a2020',
                'fx_a': '#c23a1c', 'fx_b': '#ff8a2a', 'fx_c': '#ffe9a0', 'fx_top': '#ffffff'}
    P['awake_pal'] = {'hair': '#3a1a14', 'hair_l': '#ff7a2a', 'crack': '#ffb347', 'steel': '#ffd9a0', 'steel_d': '#ff7a2a'}
    P.update(skin='skin', skin_d='skin_d', cloth='cloth', cloth_d='cloth_d', cloth_l='cloth_l', boot='boot', boot_d='boot_d', sash='sash', trim='cloth_l', cap='hair')
    def hair_back(s, hx, pose):
        s.ell(hx - 1, 27, 11, 10, 'hair')
        # a long high ponytail streaming back, ember-tipped
        sway = 4 if pose == 'strike' else 0
        pts = [(hx - 6, 19), (hx - 14 - sway, 18), (hx - 22 - sway, 24), (hx - 25 - sway, 33), (hx - 20 - sway, 30), (hx - 15 - sway, 25), (hx - 8, 25)]
        s.poly(pts, 'hair')
        s.line(hx - 14 - sway, 20, hx - 22 - sway, 26, 'hair_l')
        for k in range(3): s.px(hx - 24 - sway + k, 32 - k, 'ember')
        s.rect(hx - 8, 18, hx - 5, 20, 'sash')
    def face(s, hx, pose):
        eyes(s, hx, 'ink', pose, 'sharp', glow='ember_l')
        # a porcelain half mask over the left (front-right) side, cracked
        s.poly([(hx + 5, 22), (hx + 10, 24), (hx + 10, 36), (hx + 6, 37), (hx + 5, 31)], 'mask')
        s.rect(hx + 5, 32, hx + 10, 36, 'mask_d') if False else None
        s.line(hx + 7, 23, hx + 9, 28, 'crack'); s.line(hx + 9, 28, hx + 7, 33, 'crack')
        s.rect(hx + 7, 29, hx + 8, 30, 'ember_l' if pose == 'awake' else 'ink')
    def hair_front(s, hx, pose):
        s.poly([(hx - 9, 26), (hx - 7, 20), (hx + 2, 19), (hx + 8, 21), (hx + 4, 24), (hx + 1, 23), (hx - 3, 26), (hx - 6, 24)], 'hair')
        s.line(hx - 4, 21, hx + 3, 20, 'hair_l')
    def weapon(s, hand, pose):
        ang = {'ready': -2.35, 'strike': -0.1, 'awake': -1.2}[pose]
        s.blade(hand[0], hand[1], ang, 26, 1.4, 'steel_d', 'steel', glow='ember', guard='gold', grip='grip')
    def extra(s, hx, tx, pose):
        s.line(tx - 1, 50, tx - 5, 57, 'sash', 2)          # sash tail
    P.update(hair_back=hair_back, face=face, hair_front=hair_front, weapon=weapon, extra=extra)
    P['smear'] = lambda s: smear_arc(s, 41, 46, 20, 27, -2.0, 0.0, ['fx_a', 'fx_b', 'fx_c'])
    P['aura_back'] = lambda s: flames(s, ['fx_a', 'fx_b', 'fx_c'], seed=1)
    P['name'] = 'SABLE'; P['title'] = 'The Ember Ronin'
    P['awake'] = 'KINDLED'
    P['blurb'] = [
        "Names are power. The Hollow Court burned her village's names away.",
        "Her blade, the Last Name, was forged from the shrine's embers:",
        "every strike burns one of her own memories.",
        "Five Hollow Lords. One per episode. She remembers less after each.",
        "The twist: the cracked mask is a Lord's mask. Hers.",
    ]
    P['traits'] = ['Weapon: ember-cracked katana', 'Power: fire that eats memory', 'Flaw: forgetting why she fights', 'Tone: dark, melancholic, samurai']
    return P

# ================================================================ 2. TAMO, the Tide-Breaker
def tamo():
    P = dict(outline='ink')
    P['pal'] = {'ink': '#0b1a22', 'skin': '#c98a5e', 'skin_d': '#a86d48', 'hair': '#2f9c8f', 'hair_l': '#6fe0cf', 'cloth': '#e8d6a6', 'cloth_d': '#b9a678', 'cloth_l': '#fff1c9',
                'sash': '#1f6f8b', 'scarf': '#2bb3c7', 'shell': '#f2a68a', 'shell_d': '#c9735a', 'boot': '#6b4a35', 'boot_d': '#4e3424', 'iron': '#5d6b78', 'iron_l': '#a3b2bf',
                'rope': '#d8b56a', 'white': '#ffffff', 'mouth': '#5a2020', 'eye': '#0b1a22', 'cyan': '#7ff6ff',
                'fx_a': '#1a5f8a', 'fx_b': '#3ec7e8', 'fx_c': '#d8fbff', 'fx_top': '#ffffff'}
    P['awake_pal'] = {'hair': '#4fe3d6', 'hair_l': '#d8fbff', 'iron': '#3ec7e8', 'iron_l': '#d8fbff', 'scarf': '#d8fbff'}
    P.update(skin='skin', skin_d='skin_d', cloth='cloth', cloth_d='cloth_d', cloth_l='cloth_l', boot='boot', boot_d='boot_d', sash='sash', cap='hair')
    def torso(s, tx, pose):   # broad, with a shell pauldron
        s.rect(tx - 2, 41, tx + 16, 53, 'cloth')
        s.rect(tx - 3, 48, tx + 17, 50, 'sash')
        s.ell(tx + 12, 41, 5, 3.5, 'shell'); s.line(tx + 9, 40, tx + 15, 40, 'shell_d'); s.line(tx + 9, 42, tx + 15, 42, 'shell_d')
    def hair_back(s, hx, pose):
        s.ell(hx - 1, 26, 10.5, 8, 'hair')
        s.ell(hx - 3, 15, 4, 3.5, 'hair'); s.rect(hx - 4, 17, hx - 2, 19, 'rope')   # top knot
    def face(s, hx, pose):
        eyes(s, hx, 'eye', pose, 'calm', glow='cyan')
        s.rect(hx + 3, 33, hx + 4, 33, 'skin_d'); s.rect(hx - 4, 32, hx - 2, 33, 'shell')    # cheek, freckle-ish
    def hair_front(s, hx, pose):
        for k in range(5): s.poly([(hx - 8 + k * 4, 20), (hx - 4 + k * 4, 20), (hx - 6 + k * 4 + (2 if k > 2 else 0), 26)], 'hair')
        s.line(hx - 6, 20, hx + 6, 19, 'hair_l')
        s.rect(hx - 10, 37, hx + 10, 39, 'scarf'); s.line(hx - 9, 39, hx - 15, 44 - (4 if pose == 'strike' else 0), 'scarf', 2)
    def weapon(s, hand, pose):   # a ship's anchor as a hammer
        hx, hy = hand
        if pose == 'ready':      # planted in the ground beside it, taller than it is
            sx = hx + 4
            s.line(sx, hy - 18, sx, 57, 'iron', 3); s.line(sx - 1, hy - 18, sx - 1, 56, 'iron_l')
            s.ell(sx, hy - 21, 3, 3, 'iron'); s.ell(sx, hy - 21, 1.2, 1.2, 'ink')
            s.line(sx - 7, hy - 12, sx + 7, hy - 12, 'iron', 3); s.ell(sx - 7, hy - 12, 1.5, 2, 'iron_l'); s.ell(sx + 7, hy - 12, 1.5, 2, 'iron_l')
            for k in range(-9, 10): s.px(sx + k, 57 - (9 - abs(k)) * 0.45, 'iron'); s.px(sx + k, 58 - (9 - abs(k)) * 0.45, 'iron')
            s.poly([(sx - 11, 49), (sx - 7, 52), (sx - 10, 55)], 'iron_l'); s.poly([(sx + 11, 49), (sx + 7, 52), (sx + 10, 55)], 'iron_l')
            s.line(sx - 2, hy - 2, sx + 2, hy + 2, 'rope', 2)
        else:
            ang = -0.25 if pose == 'strike' else -1.4
            ca, sa = math.cos(ang), math.sin(ang)
            ex, ey = hx + ca * 18, hy + sa * 18
            s.line(hx, hy, ex, ey, 'iron', 2); s.ell(hx - ca * 2, hy - sa * 2, 1.5, 1.5, 'rope')
            # the anchor head: a crossbar and two flukes
            s.line(ex - sa * 8, ey + ca * 8, ex + sa * 8, ey - ca * 8, 'iron', 4)
            s.line(ex - sa * 8, ey + ca * 8, ex - sa * 8 + ca * 5, ey + ca * 8 + sa * 5, 'iron_l', 2)
            s.line(ex + sa * 8, ey - ca * 8, ex + sa * 8 + ca * 5, ey - ca * 8 + sa * 5, 'iron_l', 2)
            s.ell(ex + ca * 3, ey + sa * 3, 2, 2, 'iron')
    P.update(hair_back=hair_back, face=face, hair_front=hair_front, weapon=weapon, torso=torso)
    def wave_smear(s):
        smear_arc(s, 41, 44, 14, 24, -0.9, 0.8, ['fx_a', 'fx_b', 'fx_c'])
        for k in range(10): s.px(52 + (k * 3) % 9, 30 + k * 3, 'fx_c', fx=True)
    P['smear'] = wave_smear
    def tide(s):
        for k in range(3):
            r = 18 + k * 6
            for a in range(0, 360, 4):
                t = math.radians(a); x = 31 + math.cos(t) * r; y = 42 + math.sin(t) * r * 0.35
                if (a // 4 + k) % 3: s.px(x, y, ['fx_a', 'fx_b', 'fx_c'][k], fx=True)
        flames(s, ['fx_a', 'fx_b', 'fx_c'], R=22, seed=4)
    P['aura_back'] = tide
    P['name'] = 'TAMO'; P['title'] = 'The Tide-Breaker'
    P['awake'] = 'HIGH TIDE'
    P['blurb'] = [
        "A dockhand on the last island-city, which is sinking.",
        "The moon that holds back the sea is being dragged down in chains.",
        "Tamo lifts a drowned god's anchor that no one else can move,",
        "and climbs the Moon Stair, one guardian per episode.",
        "Big heart, small frame, impossible strength: the classic power-up arc.",
    ]
    P['traits'] = ['Weapon: a sea god\'s anchor', 'Power: tides, pressure, waves', 'Flaw: reckless, fights alone', 'Tone: hopeful, shonen, big set pieces']
    return P

# ================================================================ 3. VESPER, the Lantern Knight
def vesper():
    P = dict(outline='ink')
    P['pal'] = {'ink': '#0d0b14', 'iron': '#4a4f5c', 'iron_d': '#2e313b', 'iron_l': '#7d8494', 'gold': '#d8a93e', 'gold_d': '#9c7424', 'flame': '#a86bff', 'flame_l': '#e7d4ff',
                'void': '#110e1c', 'cape': '#5e1f2e', 'cape_d': '#3e1420', 'boot': '#3a3e49', 'boot_d': '#262932', 'steel': '#d6dbe4', 'steel_d': '#8b93a3', 'white': '#ffffff',
                'mouth': '#000000', 'glass': '#f6e7a8', 'fx_a': '#4b2a8f', 'fx_b': '#a86bff', 'fx_c': '#efe2ff', 'fx_top': '#ffffff'}
    P['awake_pal'] = {'flame': '#ffffff', 'flame_l': '#ffffff', 'gold': '#f5d47a', 'glass': '#ffffff'}
    P.update(skin='iron', skin_d='iron_d', cloth='iron', cloth_d='iron_d', cloth_l='iron_l', boot='boot', boot_d='boot_d', sash='gold')
    def torso(s, tx, pose):
        s.poly([(tx - 1, 39), (tx + 15, 39), (tx + 13, 53), (tx + 1, 53)], 'iron')
        s.line(tx + 7, 40, tx + 7, 52, 'gold'); s.rect(tx - 2, 39, tx + 3, 42, 'iron_l'); s.rect(tx + 11, 39, tx + 16, 42, 'iron_l')
        # the lantern at the belt
        s.rect(tx + 2, 50, tx + 6, 55, 'gold'); s.rect(tx + 3, 51, tx + 5, 54, 'glass')
    def hair_back(s, hx, pose):   # the cape, behind everything
        flap = 5 if pose == 'strike' else 0
        s.poly([(hx - 8, 37), (hx + 2, 37), (hx - 4, 58), (hx - 12 - flap, 60), (hx - 16 - flap, 56)], 'cape')
        for k in range(4): s.px(hx - 15 - flap + k * 3, 58 + (k & 1), 'cape_d')
    def face(s, hx, pose):
        # a closed helm with a T-visor; inside it, only flame
        s.ell(hx, 29, 10, 10, 'iron')
        s.rect(hx - 10, 24, hx + 10, 25, 'iron_l')
        s.rect(hx + 1, 27, hx + 9, 30, 'void'); s.rect(hx + 4, 30, hx + 6, 36, 'void')
        s.rect(hx + 3, 28, hx + 4, 29, 'flame'); s.rect(hx + 7, 28, hx + 8, 29, 'flame')
        s.px(hx + 5, 32, 'flame'); s.px(hx + 5, 34, 'flame_l')
        s.line(hx - 9, 33, hx - 2, 33, 'gold')
    def hair_front(s, hx, pose):   # a crest of violet flame
        for k in range(6):
            h = [5, 8, 10, 9, 6, 3][k]; x = hx - 6 + k * 2
            s.line(x, 19, x - 2, 19 - h, 'flame' if k % 2 else 'flame_l', 2)
        s.rect(hx - 8, 19, hx + 6, 20, 'gold')
    def weapon(s, hand, pose):
        ang = {'ready': 1.25, 'strike': -0.15, 'awake': -1.45}[pose]
        s.blade(hand[0], hand[1], ang, 24, 1.5, 'steel_d', 'steel', glow='flame' if pose != 'ready' else None, guard='gold', grip='iron_d')
    def extra(s, hx, tx, pose):   # a kite shield on the back arm
        sx = tx - 4
        s.poly([(sx - 5, 40), (sx + 4, 40), (sx + 4, 48), (sx - 0.5, 55), (sx - 5, 48)], 'iron_l')
        s.poly([(sx - 3, 42), (sx + 2, 42), (sx + 2, 48), (sx - 0.5, 52), (sx - 3, 48)], 'cape')
        s.line(sx - 0.5, 42, sx - 0.5, 51, 'gold')
    P.update(hair_back=hair_back, face=face, hair_front=hair_front, weapon=weapon, torso=torso, extra=extra)
    P['smear'] = lambda s: smear_arc(s, 40, 46, 19, 26, -1.6, 0.2, ['fx_a', 'fx_b', 'fx_c'])
    def split(s):
        flames(s, ['fx_a', 'fx_b', 'fx_c'], R=27, seed=7)
        for k in range(8): x = 14 + k * 5; s.line(x, 2 + (k % 3) * 3, x - 1, 10 + (k % 3) * 3, 'fx_c', fx=True)
    P['aura_back'] = split
    P['name'] = 'VESPER'; P['title'] = 'The Lantern Knight'
    P['awake'] = 'LAST LIGHT'
    P['blurb'] = [
        "An empty suit of armour, walked by the last flame of a dead kingdom.",
        "The Dimmer is eating every light in the world, kingdom by kingdom.",
        "Each soul Vesper frees joins the flame; each episode it burns brighter",
        "and remembers more of who wore the armour. The final question:",
        "is there anyone inside to save, or only the light that's left?",
    ]
    P['traits'] = ['Weapon: longsword + kite shield', 'Power: soul-flame, gathered light', 'Flaw: hollow, may not be a person', 'Tone: mythic, gothic, bittersweet']
    return P

# ================================================================ 4. KAIRA, the Storm Courier
def kaira():
    P = dict(outline='ink')
    P['pal'] = {'ink': '#0c0f1e', 'skin': '#f0c8a4', 'skin_d': '#d39f7d', 'hair': '#d9dce8', 'hair_l': '#ffffff', 'hair_d': '#9aa0b8', 'cloth': '#2b3a8c', 'cloth_d': '#1d2766', 'cloth_l': '#4559b8',
                'sash': '#f2c230', 'wrap': '#e9e4d8', 'boot': '#202a5c', 'boot_d': '#151c40', 'bolt': '#ffe14d', 'bolt_l': '#fffbd6', 'eye': '#e8a400', 'white': '#ffffff', 'mouth': '#5a2020',
                'blade': '#cfe6ff', 'blade_d': '#6f87b8', 'fx_a': '#3a4fd0', 'fx_b': '#ffe14d', 'fx_c': '#fffbd6', 'fx_top': '#ffffff'}
    P['awake_pal'] = {'hair': '#fffbd6', 'hair_l': '#ffe14d', 'hair_d': '#ffe14d', 'eye': '#ffffff', 'blade': '#fffbd6'}
    P.update(skin='skin', skin_d='skin_d', cloth='cloth', cloth_d='cloth_d', cloth_l='cloth_l', boot='boot', boot_d='boot_d', sash='sash', trim='wrap', cap='hair')
    def hair_back(s, hx, pose):
        sw = 5 if pose == 'strike' else 0
        s.ell(hx - 1, 27, 10.5, 10, 'hair')
        # a short spiky mane swept back by her own speed
        for k in range(4): s.poly([(hx - 8, 21 + k * 4), (hx - 18 - sw - k, 19 + k * 5), (hx - 9, 25 + k * 4)], 'hair' if k % 2 else 'hair_d')
        # courier's satchel strap
    def face(s, hx, pose):
        eyes(s, hx, 'eye', pose, 'sharp', glow='white')
        s.line(hx + 1, 33, hx + 3, 35, 'sash')          # a gold mark under the eye
    def hair_front(s, hx, pose):
        s.poly([(hx - 9, 27), (hx - 6, 19), (hx + 3, 18), (hx + 9, 22), (hx + 5, 23), (hx + 6, 26), (hx + 2, 23), (hx - 2, 25), (hx - 5, 23)], 'hair')
        s.line(hx - 3, 19, hx + 4, 19, 'hair_l')
        # a storm-glass goggle band
        s.rect(hx - 9, 21, hx + 9, 22, 'cloth_d'); s.ell(hx + 4, 21, 2.5, 2, 'bolt')
    def weapon(s, hand, pose):   # twin short blades; the second in the back hand
        ang = {'ready': 1.9, 'strike': -0.2, 'awake': -0.9}[pose]
        s.blade(hand[0], hand[1], ang, 13, 1.2, 'blade_d', 'blade', glow='bolt' if pose != 'ready' else None, guard='sash', grip='cloth_d')
        bx, by = (22, 48) if pose != 'strike' else (24, 47)
        s.blade(bx, by, {'ready': 2.2, 'strike': 2.6, 'awake': -2.4}[pose], 11, 1.0, 'blade_d', 'blade', guard='sash', grip='cloth_d')
    def extra(s, hx, tx, pose):
        s.line(tx, 40, tx + 13, 50, 'wrap')                              # satchel strap
        s.rect(tx - 4, 49, tx + 1, 54, 'wrap'); s.rect(tx - 4, 49, tx + 1, 50, 'sash')   # the satchel with the sealed letter
    P.update(hair_back=hair_back, face=face, hair_front=hair_front, weapon=weapon, extra=extra)
    def zip_smear(s):
        smear_arc(s, 38, 45, 9, 16, -1.4, 0.3, ['fx_a', 'fx_b', 'fx_c'])
        for k in range(6): s.line(2, 30 + k * 4, 14 - k, 30 + k * 4, ['fx_a', 'fx_b', 'fx_c'][k % 3], fx=True)
    P['smear'] = zip_smear
    def storm(s):
        flames(s, ['fx_a', 'fx_b', 'fx_c'], R=24, seed=11)
        import random; r = random.Random(3)
        for k in range(4):
            x, y = r.randint(10, 54), r.randint(4, 20)
            for j in range(6): nx, ny = x + r.randint(-3, 3), y + 3; s.line(x, y, nx, ny, 'fx_c', fx=True); x, y = nx, ny
    P['aura_back'] = storm
    P['name'] = 'KAIRA'; P['title'] = 'The Storm Courier'
    P['awake'] = 'THUNDERSTEP'
    P['blurb'] = [
        "The fastest courier of the Sky Temple, framed for stealing the Storm Seed.",
        "The Seed is inside her now, and in five days it will go off.",
        "Each episode is one day: outrun the temple's hunters, find who framed her,",
        "and deliver one sealed letter she has sworn never to open.",
        "A race against her own heartbeat, which gets faster every day.",
    ]
    P['traits'] = ['Weapon: twin storm blades', 'Power: lightning speed, afterimages', 'Flaw: never stops, never trusts', 'Tone: kinetic, chase thriller']
    return P

# ---------------------------------------------------------------- the cards
def font(sz, bold=True):
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', sz)

def card(P, idx):
    W, H = 1920, 1080
    pal = P['pal']
    bg = hexrgb(pal['ink'])
    im = Image.new('RGB', (W, H), tuple(int(c * 0.9) for c in bg))
    d = ImageDraw.Draw(im)
    acc = hexrgb(pal['fx_b'])
    # a pixel grid floor and soft panels
    for x in range(0, W, 24): d.line([(x, 0), (x, H)], fill=tuple(min(255, int(c * 0.9) + 6) for c in bg))
    for y in range(0, H, 24): d.line([(0, y), (W, y)], fill=tuple(min(255, int(c * 0.9) + 6) for c in bg))
    d.text((80, 56), f'OPTION {idx}', font=font(30), fill=acc)
    d.text((80, 96), P['name'], font=font(96), fill=(245, 240, 232))
    d.text((84, 206), P['title'].upper(), font=font(34), fill=acc)
    scale = 5
    labels = [('READY', 'ready'), ('STRIKE', 'strike'), (P['awake'], 'awake')]
    for k, (lab, pose) in enumerate(labels):
        s = sprite(P, pose)
        img = s.image(scale)
        x0, y0 = 70 + k * 400, 300
        d.rectangle([x0 + 8, y0 + 8, x0 + 392, y0 + 412], fill=tuple(min(255, c + 14) for c in bg))
        floor = y0 + 370
        d.rectangle([x0 + 8, floor + 6, x0 + 392, y0 + 412], fill=tuple(min(255, c + 22) for c in bg))
        bb = img.getbbox(); cx = (bb[0] + bb[2]) // 2
        feet = (61 + OY) * scale
        img = img.crop((max(0, cx - 190), 0, cx + 190, feet)); top = max(y0 + 12, floor + 4 - img.size[1])
        img = img.crop((0, img.size[1] - (floor + 4 - top), img.size[0], img.size[1]))
        im.paste(img, (x0 + 200 - img.size[0] // 2, top), img)
        d.text((x0 + 20, y0 + 424), lab, font=font(26), fill=(230, 225, 215) if pose != 'awake' else acc)
    # palette strip
    keys = [k for k in pal if not k.startswith('fx_top') and k not in ('white', 'mouth')][:16]
    for i, k in enumerate(keys):
        d.rectangle([80 + i * 46, 800, 80 + i * 46 + 38, 838], fill=hexrgb(pal[k]))
    d.text((80, 848), 'PALETTE', font=font(18, False), fill=(150, 145, 140))
    # the pitch
    X = 1300
    d.text((X, 300), 'THE STORY', font=font(26), fill=acc)
    y = 346
    for line in P['blurb']:
        words = line.split(' '); cur = ''
        for w in words:
            if len(cur) + len(w) + 1 > 34: d.text((X, y), cur, font=font(22, False), fill=(225, 220, 212)); y += 32; cur = w
            else: cur = (cur + ' ' + w).strip()
        d.text((X, y), cur, font=font(22, False), fill=(225, 220, 212)); y += 32
    y += 24
    d.text((X, y), 'THE WARRIOR', font=font(26), fill=acc); y += 46
    for t in P['traits']:
        d.text((X, y), '· ' + t, font=font(21, False), fill=(205, 200, 192)); y += 32
    d.text((80, 1010), 'Original character concept · pixel design sheet', font=font(18, False), fill=(120, 116, 112))
    im.save(f'{OUT}/option-{idx}-{P["name"].lower()}.png')

if __name__ == '__main__':
    for i, f in enumerate([sable, tamo, vesper, kaira], 1): card(f(), i)
    print('ok')
