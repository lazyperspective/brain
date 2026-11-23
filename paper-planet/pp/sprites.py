"""All cut-paper art. Each sprite is drawn in a design box W x H (y up) and registered with its
nominal on-globe width (in globe radii) so it is rasterised at the right density."""
import math
import zlib
import numpy as np
import skia
from .paper import Art, mir, poly_path, smooth_path, lighten, darken, mixc, Sprite, RGBA, PREMUL

PPU = 1250.0
REG = {}

INK = '#2B2350'
WHITE = '#FBF7EE'
SNOW = '#FFFFFF'
CREAM = '#F3E7CF'
GOLD = '#FFC542'
SAND = '#F4C77E'
SAND2 = '#E5A85C'
STONE = '#D9C4A3'
RED = '#EF4B4B'
ORANGE = '#FF8A3D'
PINK = '#FF8FB8'
GREEN = '#35B46A'
GREEN2 = '#1F9160'
LIME = '#9AD14B'
TEAL = '#22B5A8'
BLUE = '#3C8DE6'
SKY = '#8FD3F7'
VIOLET = '#7D5FD6'
BROWN = '#8A5A3C'
BROWN2 = '#6B4226'
GREY = '#8D8AA6'


def spr(name, wR, W, H, **kw):
    def deco(fn):
        REG[name] = (fn, wR, W, H, kw)
        return fn
    return deco


def build(names=None):
    out = {}
    for name, (fn, wR, W, H, kw) in REG.items():
        if names and name not in names:
            continue
        a = Art(W, H, wR * PPU, seed=zlib.crc32(name.encode()) % 100000, back=kw.get('back', '#efe4cf'))
        fn(a)
        out[name] = a.done(name, emissive=kw.get('emissive', False), ground=kw.get('ground', True))
    return out


def tri(a, x, y, w, h, c, **kw):
    return a.poly([(x - w / 2, y), (x + w / 2, y), (x, y + h)], c, **kw)


def windows(a, x0, y0, nx, ny, dx, dy, w, h, c, sh=False):
    for i in range(nx):
        for j in range(ny):
            a.rect(x0 + i * dx, y0 + j * dy, w, h, c, sh=sh, rim=False)


# =========================================================================== generic
@spr('glow', 0.05, 64, 64, emissive=True)
def _glow(a):
    p = skia.Paint(AntiAlias=True)
    p.setShader(skia.GradientShader.MakeRadial(skia.Point(32, 32), 32,
                [skia.Color4f(1.0, 0.86, 0.5, 0.95), skia.Color4f(1.0, 0.62, 0.25, 0.35), skia.Color4f(1.0, 0.5, 0.2, 0.0)],
                [0.0, 0.35, 1.0]))
    a.c.drawCircle(32, 32, 32, p)


@spr('glow_green', 0.05, 64, 64, emissive=True)
def _glowg(a):
    p = skia.Paint(AntiAlias=True)
    p.setShader(skia.GradientShader.MakeRadial(skia.Point(32, 32), 32,
                [skia.Color4f(0.6, 1.0, 0.75, 0.8), skia.Color4f(0.3, 0.9, 0.7, 0.25), skia.Color4f(0.2, 0.8, 0.8, 0.0)],
                [0.0, 0.4, 1.0]))
    a.c.drawCircle(32, 32, 32, p)


def _person(shirt, skin, hat=None, pants=INK):
    def fn(a):
        a.line([(14, 0), (16, 30)], pants, 7)
        a.line([(27, 0), (24, 30)], pants, 7)
        a.rect(8, 26, 24, 38, shirt, r=8)
        a.line([(8, 56), (3, 36)], shirt, 6)
        a.line([(32, 56), (37, 38)], shirt, 6)
        a.circ(20, 76, 12, skin)
        if hat:
            a.poly([(6, 82), (34, 82), (28, 96), (12, 96)], hat, sh=False)
    return fn


for _i, (_s, _k, _h) in enumerate([('#FF5E5B', '#F6C9A0', None), ('#3C8DE6', '#B9784F', GOLD), ('#FFC542', '#7A4A2B', None),
                                   ('#35B46A', '#F1D3B3', '#EF4B4B'), ('#FBF7EE', '#8A5A3C', '#3C8DE6'), ('#B46BE0', '#EBC19A', None)]):
    spr('person%d' % _i, 0.016, 40, 100)(_person(_s, _k, _h))


@spr('bird_w', 0.05, 100, 60, back='#fbf7ee', ground=False)
def _bird_w(a):   # half bird: body along bottom edge (flying +x), wing extends up
    a.poly([(8, 0), (30, 0), (62, 0), (96, 0), (84, 7), (62, 8), (30, 6)], WHITE)
    a.poly([(34, 2), (62, 2), (50, 56), (30, 44)], WHITE, smooth=False)
    a.poly([(44, 30), (50, 56), (30, 44)], '#D9DCEC', sh=False)
    a.poly([(96, 0), (84, 7), (88, 0)], GOLD, sh=False)


@spr('bird_d', 0.05, 100, 60, back='#5a4a70', ground=False)
def _bird_d(a):
    a.poly([(4, 0), (30, 0), (62, 0), (94, 0), (84, 7), (62, 8), (30, 6)], '#3A2E55')
    a.poly([(30, 2), (64, 2), (54, 58), (24, 46)], '#3A2E55')
    a.poly([(40, 34), (54, 58), (24, 46)], '#5C4C82', sh=False)


@spr('macaw_w', 0.06, 100, 62, back='#ffd24a', ground=False)
def _macaw(a):
    a.poly([(0, 0), (30, 0), (62, 0), (92, 0), (84, 8), (60, 9), (30, 5)], '#E8343A')
    a.poly([(0, 0), (22, 0), (22, 4)], '#2F7BE0', sh=False)
    a.poly([(32, 2), (64, 2), (56, 60), (26, 48)], '#E8343A')
    a.poly([(36, 26), (60, 30), (56, 60), (26, 48)], '#FFC542', sh=True)
    a.poly([(40, 42), (58, 46), (56, 60), (26, 48)], '#2F7BE0', sh=True)
    a.poly([(92, 0), (99, 0), (90, 6)], '#FBF7EE', sh=False)


@spr('cloud', 0.22, 200, 100, back='#ffffff', ground=False)
def _cloud(a):
    pa = skia.Path()
    for (x, y, r) in [(45, 40, 30), (80, 55, 38), (120, 50, 34), (155, 38, 28), (100, 34, 30)]:
        pa.addCircle(x, y, r)
    pa.addRoundRect(skia.Rect(20, 10, 180, 44), 17, 17)
    a.path(pa, '#FFFFFF', rim=False)
    a.line([(50, 24), (95, 24)], '#DCE9F8', 5)
    a.line([(110, 34), (150, 34)], '#DCE9F8', 5)


@spr('cloud2', 0.16, 160, 80, back='#ffffff', ground=False)
def _cloud2(a):
    pa = skia.Path()
    for (x, y, r) in [(36, 32, 24), (70, 44, 32), (108, 40, 28), (130, 30, 20)]:
        pa.addCircle(x, y, r)
    pa.addRoundRect(skia.Rect(14, 8, 148, 36), 14, 14)
    a.path(pa, '#FFF6EC', rim=False)
    a.line([(40, 20), (80, 20)], '#F6D9CC', 4.5)


# =========================================================================== trees
@spr('pine', 0.05, 60, 120)
def _pine(a):
    a.rect(26, 0, 8, 24, BROWN2)
    for i, (y, w) in enumerate([(14, 56), (38, 46), (62, 36), (84, 26)]):
        tri(a, 30, y, w, 34, '#178A63' if i % 2 == 0 else '#1FA06F')


@spr('pine_snow', 0.05, 60, 120)
def _pine_s(a):
    a.rect(26, 0, 8, 24, BROWN2)
    for i, (y, w) in enumerate([(14, 56), (38, 46), (62, 36), (84, 26)]):
        tri(a, 30, y, w, 34, '#1C7C7A' if i % 2 == 0 else '#2A9390')
        tri(a, 30, y + 20, w * 0.42, 14, SNOW, sh=False)


@spr('tree', 0.06, 80, 110)
def _tree(a):
    a.poly([(35, 0), (45, 0), (43, 40), (37, 40)], BROWN2)
    a.circ(40, 68, 34, '#2FAE62')
    a.circ(28, 60, 18, '#49C274', sh=True)
    a.circ(52, 80, 14, '#49C274', sh=True)


@spr('tree_autumn', 0.06, 80, 110)
def _tree_a(a):
    a.poly([(35, 0), (45, 0), (43, 40), (37, 40)], BROWN2)
    a.circ(40, 68, 34, '#F0562E')
    a.circ(28, 60, 18, '#FF8A3D')
    a.circ(52, 80, 14, '#FFC542')


@spr('palm', 0.06, 100, 130)
def _palm(a):
    a.line([(46, 0), (50, 40), (58, 84)], BROWN, 8, smooth=True, sh=True)
    for ang, c in [(-150, GREEN2), (-30, GREEN2), (160, GREEN), (20, GREEN), (95, LIME), (60, GREEN), (125, GREEN)]:
        r = math.radians(ang)
        x1, y1 = 58 + math.cos(r) * 40, 86 + math.sin(r) * 34
        mx, my = 58 + math.cos(r) * 22, 86 + math.sin(r) * 19 + 13
        a.poly([(58, 84), (mx - 4, my + 6), (x1, y1), (mx + 5, my - 7)], c, smooth=True)
    a.circ(55, 82, 5, BROWN2, sh=False)


@spr('acacia', 0.11, 150, 100)
def _acacia(a):
    a.line([(72, 0), (74, 30), (60, 58)], BROWN2, 7, smooth=True, sh=True)
    a.line([(74, 30), (96, 60)], BROWN2, 6)
    a.poly([(8, 62), (30, 80), (70, 92), (118, 86), (144, 66), (110, 56), (40, 54)], '#3DAA5C', smooth=True)
    a.poly([(30, 70), (60, 84), (100, 82), (124, 70), (90, 64), (50, 62)], '#62C36E', smooth=True)


@spr('baobab', 0.07, 100, 120)
def _baobab(a):
    a.poly(mir([(34, 0), (30, 40), (34, 78), (22, 96), (30, 98), (40, 86)], 50), '#B98A62', smooth=False)
    for (x, y, r) in [(22, 100, 12), (40, 110, 13), (60, 110, 13), (78, 100, 12), (50, 98, 12)]:
        a.circ(x, y, r, '#49B96A')


@spr('cherry', 0.07, 100, 110)
def _cherry(a):
    a.line([(50, 0), (48, 30), (40, 52)], '#5A3B45', 7, smooth=True, sh=True)
    a.line([(48, 30), (64, 56)], '#5A3B45', 5)
    for (x, y, r, c) in [(30, 66, 22, '#FF9CC2'), (62, 72, 26, '#FFB3D1'), (46, 88, 20, '#FFC9DE'), (76, 58, 14, '#FF9CC2')]:
        a.circ(x, y, r, c)
    for (x, y) in [(28, 70), (60, 80), (44, 92), (72, 62), (52, 66)]:
        a.circ(x, y, 2.2, '#FFF1F6', sh=False, rim=False)


@spr('jungle', 0.20, 240, 100)
def _jungle(a):
    cols = ['#128A55', '#1FA565', '#34BB6E', '#5BCB6F']
    for i, (x, y, r) in enumerate([(24, 34, 30), (64, 48, 40), (108, 40, 36), (150, 52, 42), (196, 38, 34), (222, 26, 24)]):
        a.rect(x - 4, 0, 8, y, BROWN2, sh=False, rim=False)
        a.circ(x, y, r, cols[i % 4])
        a.circ(x - r * 0.3, y + r * 0.25, r * 0.45, cols[(i + 2) % 4])
    a.rect(0, 0, 240, 12, '#128A55', sh=False, rim=False)
    for x in (40, 96, 170):
        a.circ(x, 62, 4, '#FF5E5B', sh=False)
    a.circ(132, 78, 4, GOLD, sh=False)


@spr('bamboo', 0.05, 60, 110)
def _bamboo(a):
    for x, h in [(14, 96), (30, 108), (46, 88)]:
        a.line([(x, 0), (x, h)], '#5DB548', 6)
        for y in range(18, h, 22):
            a.line([(x - 4, y), (x + 4, y)], '#3E8F3A', 2)
        a.poly([(x, h - 8), (x + 14, h + 2), (x + 4, h - 14)], '#8FD45A', sh=False)


@spr('cactus', 0.035, 60, 100)
def _cactus(a):
    a.line([(30, 0), (30, 86)], '#2E9E63', 14)
    a.line([(30, 42), (10, 42), (10, 64)], '#2E9E63', 9)
    a.line([(30, 56), (50, 56), (50, 76)], '#2E9E63', 9)
    a.circ(30, 92, 5, PINK, sh=False)


@spr('gum', 0.07, 90, 120)
def _gum(a):   # eucalyptus with koala
    a.line([(44, 0), (46, 50), (38, 78)], '#C9B7A4', 8, smooth=True, sh=True)
    a.line([(46, 50), (62, 74)], '#C9B7A4', 6)
    for (x, y, r, c) in [(30, 84, 22, '#4FA67A'), (60, 90, 24, '#63B88A'), (46, 104, 16, '#7FCB9B')]:
        a.circ(x, y, r, c)
    a.oval(54, 58, 9, 11, '#9AA0B5')
    a.circ(54, 71, 7, '#9AA0B5')
    a.circ(47, 76, 4, '#9AA0B5', sh=False)
    a.circ(61, 76, 4, '#9AA0B5', sh=False)
    a.circ(54, 70, 2, INK, sh=False, rim=False)


# =========================================================================== Europe
@spr('eiffel', 0.13, 100, 232)
def _eiffel(a):
    c1, c2 = '#4A3F8C', '#6C5FC2'
    L = [(3, 0), (20, 0), (29, 30), (35.5, 66), (40.5, 110), (44, 160), (46.5, 205), (48, 228)]
    a.poly(mir(L, 50), c1)
    a.hole(smooth_path([(22, -4), (30, 16), (50, 26), (70, 16), (78, -4)]))
    a.hole([(41, 42), (59, 42), (55.5, 64), (44.5, 64)])
    a.hole([(47, 80), (53, 80), (51.6, 150), (48.4, 150)])
    for (y, x0, hh) in [(30, 14, 7), (66, 30, 6), (160, 42.5, 5)]:
        a.rect(x0, y, 100 - 2 * x0, hh, c2, r=1.5)
    for (ya, yb, xa, xb) in [(4, 28, 8, 24), (38, 64, 31, 40), (74, 110, 38.5, 46)]:
        a.line([(xa, ya), (xb + 2, yb)], c2, 1.6)
        a.line([(100 - xa, ya), (100 - xb - 2, yb)], c2, 1.6)
    a.circ(50, 222, 4, GOLD, sh=False)


@spr('bigben', 0.055, 60, 190)
def _bigben(a):
    a.rect(12, 0, 36, 128, '#D9A45B')
    for x in (18, 27, 36):
        a.rect(x, 8, 5, 86, '#B97F3E', sh=False, rim=False)
    a.rect(8, 100, 44, 40, '#E9BC78')
    a.circ(30, 120, 14, WHITE)
    a.line([(30, 120), (30, 130)], INK, 2)
    a.line([(30, 120), (37, 117)], INK, 2)
    a.poly([(10, 140), (50, 140), (40, 158), (20, 158)], '#5E6A8F')
    a.poly([(22, 158), (38, 158), (30, 188)], '#5E6A8F')
    a.circ(30, 186, 2.5, GOLD, sh=False)


@spr('windmill', 0.085, 100, 130)
def _windmill(a):
    a.poly([(30, 0), (70, 0), (62, 78), (38, 78)], '#FBF1DD')
    a.poly([(34, 78), (66, 78), (58, 96), (42, 96)], '#C84F3F')
    a.rect(44, 0, 12, 22, '#7A5236', r=5)
    a.rect(45, 44, 10, 12, '#6FB6E8', r=2)
    a.poly([(24, 0), (76, 0), (72, 8), (28, 8)], '#3FAE5E', sh=False)


@spr('sails', 0.10, 100, 100, ground=False)
def _sails(a):
    for k in range(4):
        m = skia.Matrix()
        m.setRotate(90 * k + 8, 50, 50)
        p1 = poly_path([(48.5, 50), (51.5, 50), (51.5, 98), (48.5, 98)])
        p2 = poly_path([(51.5, 62), (64, 62), (64, 96), (51.5, 96)])
        p1.transform(m)
        p2.transform(m)
        a.path(p2, '#F6E3B9', rim=False)
        a.path(p1, '#7A5236', rim=False, sh=False)
    a.circ(50, 50, 4.5, '#7A5236')


@spr('alps', 0.26, 260, 110)
def _alps(a):
    a.poly([(0, 0), (22, 44), (40, 30), (70, 84), (92, 58), (120, 108), (150, 62), (172, 78), (200, 40), (224, 60), (260, 0)], '#B9A8E8')
    a.poly([(70, 84), (92, 58), (120, 108), (150, 62), (140, 50), (122, 66), (104, 44), (88, 50)], SNOW, sh=False)
    a.poly([(120, 108), (150, 62), (172, 78), (200, 40), (224, 60), (260, 0), (150, 0)], '#9A87D8', sh=False)
    a.poly([(120, 108), (150, 62), (140, 50), (128, 70)], '#E6E2F8', sh=False)
    a.poly([(172, 78), (200, 40), (186, 44), (178, 60)], '#E6E2F8', sh=False)
    a.poly([(0, 0), (22, 44), (40, 30), (56, 60), (40, 0)], '#CFC3F2', sh=False)
    a.poly([(0, 0), (30, 16), (70, 10), (120, 22), (170, 12), (220, 18), (260, 0)], '#49B96A', smooth=False)
    a.rect(60, 8, 14, 10, '#C84F3F')
    a.poly([(56, 18), (78, 18), (67, 27)], '#7A3B2E')


@spr('colosseum', 0.085, 120, 70)
def _colos(a):
    a.poly([(4, 0), (116, 0), (116, 40), (96, 44), (96, 60), (4, 60)], '#E8C28B')
    for j, y in enumerate((6, 24, 42)):
        for i in range(6):
            x = 10 + i * 18
            if j == 2 and x > 84:
                continue
            a.rect(x, y, 10, 13, '#9C6B45', r=5, sh=False, rim=False)
    a.rect(0, 0, 120, 4, '#D1A56B', sh=False, rim=False)


@spr('basil', 0.10, 120, 170)
def _basil(a):
    a.rect(14, 0, 92, 56, '#F2E3C9')
    a.rect(50, 0, 20, 30, '#7A4B3A', r=9)
    def dome(x, y, w, h, c1, c2, st):
        a.rect(x - w * 0.33, y - st, w * 0.66, st, '#F2E3C9')
        pth = smooth_path([(x - w * 0.36, y), (x - w / 2, y + h * 0.36), (x - w * 0.2, y + h * 0.74), (x, y + h),
                           (x + w * 0.2, y + h * 0.74), (x + w / 2, y + h * 0.36), (x + w * 0.36, y)])
        a.path(pth, c1)
        a.clip(pth)
        for k in range(-3, 4):
            a.line([(x + k * w * 0.2 - w * 0.2, y), (x + k * w * 0.2 + w * 0.2, y + h)], c2, w * 0.09)
        a.unclip()
        a.line([(x, y + h), (x, y + h + 8)], GOLD, 2)
    dome(28, 78, 26, 30, '#3C8DE6', WHITE, 24)
    dome(92, 78, 26, 30, '#35B46A', GOLD, 24)
    dome(60, 112, 30, 40, '#EF4B4B', WHITE, 58)
    dome(44, 62, 18, 22, GOLD, '#EF4B4B', 8)
    dome(77, 62, 18, 22, '#B46BE0', GOLD, 8)


@spr('balloon', 0.07, 100, 150, back='#ffd9a0', ground=False)
def _balloon(a):
    pth = smooth_path([(50, 40), (22, 70), (14, 104), (30, 136), (50, 146), (70, 136), (86, 104), (78, 70)])
    a.path(pth, '#FF5E5B')
    a.clip(pth)
    for i, c in enumerate([GOLD, '#FF8A3D', WHITE, '#FF8A3D', GOLD]):
        a.oval(50, 95, 36 - i * 8.5, 56, c if i % 2 == 0 else '#FF5E5B', sh=False, rim=False)
    a.unclip()
    a.line([(40, 44), (43, 20)], BROWN2, 1.5)
    a.line([(60, 44), (57, 20)], BROWN2, 1.5)
    a.rect(40, 6, 20, 15, '#B9784F', r=3)


@spr('temple_gr', 0.07, 110, 70)
def _temple(a):
    a.rect(4, 0, 102, 8, '#F4EBDD')
    for i in range(6):
        a.rect(12 + i * 16, 8, 7, 34, '#FBF7EE')
    a.rect(6, 42, 98, 7, '#F4EBDD')
    a.poly([(4, 49), (106, 49), (55, 68)], '#E9DCC8')


@spr('hagia', 0.10, 140, 100)
def _hagia(a):
    for x in (10, 124):
        a.rect(x, 0, 7, 78, '#F6E7CF')
        tri(a, x + 3.5, 78, 10, 20, '#5E6A8F')
    a.rect(24, 0, 92, 40, '#F2B5A0')
    a.path(smooth_path([(34, 40), (40, 66), (70, 84), (100, 66), (106, 40)]), '#6FA6D8')
    a.circ(40, 44, 12, '#8BBBE6')
    a.circ(100, 44, 12, '#8BBBE6')
    a.rect(24, 0, 92, 10, '#E79A86', sh=False, rim=False)
    windows(a, 38, 16, 5, 1, 14, 0, 7, 12, '#7A4B3A')
    a.line([(70, 84), (70, 94)], GOLD, 2)


# =========================================================================== Africa
@spr('pyr_face', 0.11, 100, 90, ground=False)
def _pyr(a):
    pth = poly_path([(0, 0), (100, 0), (50, 90)])
    a.path(pth, '#F2C57A')
    a.clip(pth)
    for y in range(10, 90, 11):
        a.line([(0, y), (100, y)], '#DDA95A', 1.6)
    for j, y in enumerate(range(0, 90, 11)):
        for x in range(-6 + (j % 2) * 7, 100, 14):
            a.line([(x, y), (x, y + 11)], '#DDA95A', 1.1)
    a.unclip()
    tri(a, 50, 74, 17.5, 16, '#FBF1DD', sh=False)


@spr('sphinx', 0.07, 120, 70)
def _sphinx(a):
    a.poly([(6, 0), (116, 0), (114, 16), (70, 22), (52, 30), (30, 30), (10, 18)], '#E8B768', smooth=False)
    a.poly([(70, 20), (98, 20), (100, 52), (92, 64), (76, 64), (68, 52)], '#F2C57A')
    a.poly([(66, 30), (72, 62), (76, 64), (70, 28)], '#3C8DE6', sh=False)
    a.poly([(102, 30), (96, 62), (92, 64), (98, 28)], '#3C8DE6', sh=False)
    a.circ(80, 46, 2, INK, sh=False, rim=False)
    a.circ(90, 46, 2, INK, sh=False, rim=False)


@spr('camel', 0.05, 110, 90)
def _camel(a):
    for x in (30, 40, 70, 80):
        a.line([(x, 0), (x + (2 if x < 50 else -2), 36)], '#C98B4B', 5)
    a.poly([(20, 34), (30, 52), (40, 66), (52, 52), (62, 68), (74, 54), (88, 44), (84, 30), (26, 28)], '#E0A25C', smooth=True)
    a.line([(84, 40), (96, 62), (100, 76)], '#E0A25C', 8, smooth=True)
    a.oval(102, 78, 8, 5, '#E0A25C')
    a.poly([(42, 50), (72, 50), (68, 62), (46, 62)], '#EF4B4B')
    a.line([(42, 50), (72, 50)], GOLD, 2)
    a.line([(20, 34), (14, 20)], '#C98B4B', 2.5)


@spr('elephant', 0.085, 130, 100)
def _eleph(a):
    c = '#8E95B8'
    for x in (30, 46, 78, 92):
        a.rect(x, 0, 13, 40, '#7C83A8', r=4)
    a.poly([(18, 36), (20, 66), (40, 82), (78, 84), (100, 70), (104, 40), (60, 30)], c, smooth=True)
    a.circ(102, 66, 20, c)
    a.poly([(82, 52), (90, 84), (104, 80), (100, 50)], '#A6ACCB', smooth=True)
    a.circ(110, 70, 2.4, INK, sh=False, rim=False)
    a.poly([(112, 50), (124, 44), (114, 46)], WHITE, sh=False)
    a.line([(18, 60), (10, 40)], '#7C83A8', 2.5)


@spr('trunk', 0.02, 30, 60, ground=False)
def _trunk(a):
    a.line([(15, 56), (14, 30), (20, 8)], '#8E95B8', 9, smooth=True)


@spr('giraffe', 0.075, 110, 100)
def _giraffe(a):
    c = '#F7C64A'
    for x in (30, 40, 66, 76):
        a.line([(x, 0), (x, 52)], '#E9B23A', 5)
    a.poly([(22, 50), (26, 70), (50, 78), (80, 80), (86, 60), (80, 46), (30, 44)], c, smooth=True)
    for (x, y, r) in [(36, 60, 5), (50, 68, 5), (62, 56, 6), (74, 68, 5), (46, 52, 4)]:
        a.circ(x, y, r, '#C9772E', sh=False, rim=False)
    a.line([(22, 62), (14, 40)], '#C9772E', 2.5)
    for x in (30, 40, 66, 76):
        a.rect(x - 3, 0, 6, 5, BROWN2, sh=False, rim=False)


@spr('giraffe_neck', 0.045, 60, 110, ground=False)
def _gneck(a):
    a.poly([(8, 0), (26, 4), (40, 82), (30, 86)], '#F7C64A')
    for (x, y, r) in [(20, 16, 5), (26, 36, 5), (30, 56, 4.5), (33, 72, 4)]:
        a.circ(x, y, r, '#C9772E', sh=False, rim=False)
    a.poly([(28, 80), (40, 78), (56, 86), (54, 94), (36, 98), (28, 92)], '#F7C64A', smooth=True)
    a.line([(34, 96), (33, 106)], '#C9772E', 2.5)
    a.line([(40, 96), (41, 106)], '#C9772E', 2.5)
    a.circ(44, 90, 1.8, INK, sh=False, rim=False)


@spr('zebra', 0.05, 110, 80)
def _zebra(a):
    for x in (28, 38, 70, 80):
        a.line([(x, 0), (x, 34)], WHITE, 5)
    body = smooth_path([(20, 32), (22, 54), (50, 58), (82, 58), (90, 44), (84, 30), (30, 28)])
    a.path(body, WHITE)
    neck = poly_path([(76, 46), (88, 76), (100, 74), (106, 62), (96, 58), (90, 44)])
    a.path(neck, WHITE)
    for pth in (body, neck):
        a.clip(pth)
        for x in range(18, 110, 9):
            a.line([(x, 20), (x + 8, 80)], INK, 3.2)
        a.unclip()
    a.line([(20, 46), (12, 30)], INK, 2.5)


@spr('kili', 0.30, 300, 130)
def _kili(a):
    a.poly([(0, 0), (40, 30), (90, 84), (120, 116), (150, 124), (184, 118), (216, 82), (262, 30), (300, 0)], '#8C6FC9', smooth=False)
    a.poly([(150, 124), (184, 118), (216, 82), (262, 30), (300, 0), (170, 0)], '#7458B5', sh=False)
    a.poly([(98, 94), (120, 116), (150, 124), (184, 118), (204, 96), (190, 88), (176, 100), (160, 86), (144, 102), (126, 86), (112, 98)], SNOW)
    a.poly([(0, 0), (60, 18), (120, 10), (190, 20), (250, 10), (300, 0)], '#F2A93B')
    a.poly([(0, 0), (80, 8), (160, 4), (240, 9), (300, 0)], '#FFC542', sh=False)


@spr('dune', 0.2, 240, 50)
def _dune(a):
    a.poly([(0, 0), (30, 20), (70, 40), (104, 22), (140, 34), (176, 46), (210, 20), (240, 0)], '#FFD77A', smooth=True)
    a.poly([(70, 40), (104, 22), (140, 34), (120, 0), (60, 0)], '#F2B450', smooth=False, sh=False)
    a.poly([(176, 46), (210, 20), (240, 0), (190, 0)], '#F2B450', sh=False)


@spr('hut', 0.045, 80, 70)
def _hut(a):
    a.rect(18, 0, 44, 32, '#C98B4B', r=3)
    a.rect(34, 0, 12, 20, BROWN2, r=5, sh=False)
    a.poly([(6, 30), (74, 30), (40, 68)], '#F2C057')
    for x in (24, 40, 56):
        a.line([(40, 66), (x, 32)], '#D49A32', 1.5)


@spr('lion', 0.05, 110, 70)
def _lion(a):
    a.poly([(14, 0), (96, 0), (100, 16), (80, 34), (40, 36), (18, 22)], '#F0B040', smooth=True)
    a.circ(84, 40, 19, '#B86A22')
    a.circ(86, 38, 12, '#F7C258')
    a.circ(83, 40, 1.8, INK, sh=False, rim=False)
    a.circ(91, 40, 1.8, INK, sh=False, rim=False)
    a.line([(16, 16), (4, 30)], '#B86A22', 3)
    a.circ(4, 31, 3.5, '#B86A22', sh=False)


@spr('flamingo', 0.03, 60, 100)
def _flamingo(a):
    a.line([(28, 0), (29, 44)], '#FF7FA8', 2.5)
    a.oval(30, 54, 16, 12, '#FF8FB8')
    a.line([(42, 58), (50, 76), (40, 90)], '#FF8FB8', 4.5, smooth=True)
    a.circ(40, 91, 5, '#FF8FB8')
    a.poly([(42, 90), (52, 84), (44, 86)], INK, sh=False)


@spr('tablemt', 0.14, 160, 60)
def _tablemt(a):
    a.poly([(0, 0), (20, 30), (36, 50), (118, 52), (134, 34), (160, 0)], '#9B8BC9')
    a.poly([(36, 50), (118, 52), (122, 44), (34, 42)], '#B7A9DD', sh=False)
    a.poly([(0, 0), (40, 12), (110, 8), (160, 0)], '#49B96A')


# =========================================================================== mountains (accordion strips)
def range_art(a, peaks, c_light, c_dark, snow=SNOW, base=None, base2=None, snowline=0.62, W=None):
    """peaks: list of (x, h). Valleys are placed between peaks. Left faces light, right faces dark."""
    W = W or a.W
    pts = [(0, 0)]
    val = []
    for i, (x, h) in enumerate(peaks):
        if i > 0:
            px_, ph_ = peaks[i - 1]
            vx = (px_ + x) / 2 + (h - ph_) * 0.12
            vy = min(ph_, h) * 0.42
            pts.append((vx, vy))
            val.append((vx, vy))
        pts.append((x, h))
    pts.append((W, 0))
    a.poly(pts, c_light)
    hmax = max(h for _, h in peaks)
    bounds = [(0, 0)] + val + [(W, 0)]
    for i, (x, h) in enumerate(peaks):
        r = bounds[i + 1]
        a.poly([(x, h), r, (r[0], 0), (x + (r[0] - x) * 0.18, 0), (x + (r[0] - x) * 0.22, h * 0.45)], c_dark, sh=False, rim=False)
        if snow and h > hmax * snowline:
            l = bounds[i]
            t = 0.30 if h > hmax * 0.8 else 0.2
            lx, ly = x + (l[0] - x) * t, h + (l[1] - h) * t
            rx, ry = x + (r[0] - x) * t, h + (r[1] - h) * t
            a.poly([(x, h), (rx, ry), (x + (rx - x) * 0.45, ry + h * 0.06), (x, ry - h * 0.02), (x + (lx - x) * 0.5, ly + h * 0.07), (lx, ly)], snow, sh=True)
    if base:
        n = 9
        bp = [(0, 0)] + [(W * i / n, hmax * (0.10 + 0.05 * ((i * 7) % 3))) for i in range(1, n)] + [(W, 0)]
        a.poly(bp, base, smooth=False)
    if base2:
        n = 7
        bp = [(0, 0)] + [(W * i / n, hmax * (0.04 + 0.03 * ((i * 5) % 3))) for i in range(1, n)] + [(W, 0)]
        a.poly(bp, base2, sh=False)


@spr('alps_z', 0.40, 400, 150)
def _alps_z(a):
    range_art(a, [(56, 88), (132, 128), (206, 146), (288, 114), (352, 80)], '#C9BCF0', '#9C8AD9', base='#4FBF74', base2='#7FD68A')
    a.rect(84, 16, 16, 11, '#C84F3F')
    a.poly([(80, 27), (104, 27), (92, 37)], '#7A3B2E')
    a.rect(290, 14, 14, 10, '#F6E3B9')
    a.poly([(286, 24), (308, 24), (297, 33)], '#C84F3F')


@spr('kili_z', 0.34, 340, 150)
def _kili_z(a):
    range_art(a, [(170, 142)], '#9C7FD8', '#7B5FC2', snowline=0.5, base='#F2A93B', base2='#FFC542')


@spr('rockies_z', 0.40, 400, 150)
def _rockies_z(a):
    range_art(a, [(48, 76), (120, 132), (198, 144), (276, 110), (348, 82)], '#8FA3D9', '#6B7FC0', base='#2E9E63', base2='#49B96A')


@spr('himalaya_z', 0.46, 460, 200)
def _himalaya_z(a):
    range_art(a, [(50, 110), (125, 158), (215, 196), (300, 164), (372, 132), (424, 96)],
              '#F4F7FF', '#A9B8EE', snow=None, base='#A690E8', base2='#C3B2F3')
    a.line([(150, 62), (215, 92), (280, 66)], '#5B4FA0', 1.2, smooth=True)
    for i, c in enumerate(['#EF4B4B', '#FFC542', '#35B46A', '#3C8DE6', '#FBF7EE', '#EF4B4B', '#FFC542', '#35B46A']):
        x = 158 + i * 15.5
        y = 66 + 26 * (1 - ((x - 215) / 65) ** 2) - 4
        a.poly([(x, y + 4), (x + 9, y + 4), (x + 4.5, y - 7)], c, sh=False, rim=False)


@spr('andes_z', 0.30, 300, 130)
def _andes_z(a):
    range_art(a, [(44, 76), (112, 116), (184, 126), (252, 84)], '#C58BD9', '#9A62BD', base='#8FD45A', base2='#B9E36B')


@spr('fuji_z', 0.30, 300, 170)
def _fuji_z(a):
    pts = [(0, 0), (40, 22), (84, 70), (112, 122), (124, 158), (150, 164), (176, 158), (188, 122), (216, 70), (260, 22), (300, 0)]
    a.poly(pts, '#6F7FE0', smooth=False)
    a.poly([(150, 164), (176, 158), (188, 122), (216, 70), (260, 22), (300, 0), (150, 0)], '#5665C9', sh=False, rim=False)
    a.poly([(108, 114), (112, 122), (124, 158), (150, 164), (176, 158), (188, 122), (192, 114), (180, 124), (168, 108), (156, 126), (144, 106), (132, 124), (120, 108)], SNOW)
    a.poly([(0, 0), (50, 16), (110, 8), (180, 18), (250, 8), (300, 0)], '#FF9CC2')
    a.poly([(0, 0), (70, 6), (150, 3), (230, 7), (300, 0)], '#FFC9DE', sh=False)


@spr('uluru_z', 0.30, 300, 86)
def _uluru_z(a):
    pth = a.poly([(0, 0), (16, 30), (40, 58), (80, 74), (140, 80), (210, 76), (254, 60), (284, 30), (300, 0)], '#EF6A3A', smooth=False)
    a.clip(pth)
    for x in range(30, 290, 22):
        a.line([(x, 80), (x + 6, 10)], '#D24E2E', 4)
    a.poly([(160, 90), (300, 90), (300, 0), (176, 0)], '#B8402A', sh=False, rim=False, alpha=0.45)
    a.unclip()
    a.poly([(0, 0), (60, 12), (150, 6), (240, 12), (300, 0)], '#F2A93B')


@spr('dune_z', 0.24, 240, 56)
def _dune_z(a):
    a.poly([(0, 0), (30, 22), (66, 46), (100, 30), (132, 40), (170, 54), (206, 26), (240, 0)], '#FFD77A', smooth=True)
    a.poly([(66, 46), (100, 30), (132, 40), (120, 0), (62, 0)], '#F2B450', sh=False, rim=False)
    a.poly([(170, 54), (206, 26), (240, 0), (186, 0)], '#F2B450', sh=False, rim=False)


@spr('canyon_z', 0.28, 280, 100)
def _canyon_z(a):
    a.poly([(0, 0), (0, 60), (30, 62), (34, 84), (84, 86), (90, 50), (120, 48), (126, 92), (160, 94), (166, 56), (200, 54), (206, 78), (250, 80), (256, 46), (280, 44), (280, 0)], '#E8562F')
    a.poly([(0, 0), (0, 40), (36, 44), (90, 34), (124, 46), (166, 36), (204, 44), (256, 30), (280, 30), (280, 0)], '#F58A45')
    a.poly([(0, 0), (0, 20), (50, 24), (110, 16), (170, 24), (230, 16), (280, 20), (280, 0)], '#FFB86B')
    a.line([(0, 6), (60, 9), (140, 5), (220, 9), (280, 5)], '#3CC0D8', 5, smooth=True)
    for (x, y, w_) in [(40, 72, 36), (132, 80, 22), (212, 68, 32)]:
        a.line([(x, y), (x + w_, y)], '#C7402A', 2.5)


@spr('glacier_z', 0.14, 140, 70)
def _glacier_z(a):
    a.poly([(0, 0), (10, 40), (30, 52), (44, 34), (62, 64), (84, 44), (100, 58), (124, 30), (140, 0)], '#E8F6FF')
    a.poly([(62, 64), (84, 44), (100, 58), (124, 30), (140, 0), (70, 0)], '#B5DDF7', sh=False, rim=False)
    a.poly([(0, 0), (10, 40), (30, 52), (26, 0)], '#CBE9FB', sh=False, rim=False)


@spr('nzalps_z', 0.14, 140, 70)
def _nz_z(a):
    range_art(a, [(34, 46), (70, 66), (106, 50)], '#DDE6FF', '#A9B8EE', snowline=0.9, base='#49B96A')


@spr('iceberg_z', 0.14, 140, 100)
def _iceberg_z(a):
    a.poly([(8, 0), (20, 50), (44, 78), (58, 60), (76, 96), (100, 62), (116, 70), (132, 0)], '#F4FBFF')
    a.poly([(76, 96), (100, 62), (116, 70), (132, 0), (84, 0)], '#BFE3F8', sh=False, rim=False)
    a.poly([(8, 0), (20, 50), (36, 30), (30, 0)], '#D6EEFB', sh=False, rim=False)


@spr('strut', 0.02, 30, 100, back='#e9dcc3', ground=False)
def _strut(a):
    a.rect(4, 0, 22, 100, '#EFE4CF', r=2)
    a.line([(15, 4), (15, 96)], '#D9CBAE', 1.2)


# =========================================================================== North America
@spr('liberty', 0.105, 100, 262)
def _liberty(a):
    m1, m2, m3 = '#5FCBAA', '#3FAE92', '#8FE0C6'
    a.rect(14, 0, 72, 14, '#CDB48E')
    a.poly([(26, 14), (74, 14), (68, 74), (32, 74)], STONE)
    a.rect(42, 22, 16, 26, '#B79C74', r=7, sh=False)
    a.rect(28, 68, 44, 8, '#E9D9BD')
    a.poly([(33, 76), (67, 76), (63, 150), (58, 184), (42, 184), (37, 150)], m1)
    for x0, x1 in [(40, 43), (48, 49), (56, 55), (62, 59)]:
        a.line([(x0, 80), (x1, 170)], m2, 1.8)
    a.line([(58, 176), (71, 228)], m1, 9, sh=True)
    a.rect(66, 226, 10, 9, m2, r=1)
    a.poly([(66, 235), (76, 235), (74, 244), (71, 256), (68, 244)], '#FFB52E')
    a.rect(28, 138, 11, 26, m3, r=1)
    a.line([(42, 172), (34, 152)], m1, 7)
    a.circ(50, 194, 10.5, m1)
    for ang in (-60, -30, 0, 30, 60):
        r = math.radians(90 + ang)
        a.poly([(50 + math.cos(r) * 8 - 2.2, 196 + math.sin(r) * 8), (50 + math.cos(r) * 8 + 2.2, 196 + math.sin(r) * 8),
                (50 + math.cos(r) * 24, 196 + math.sin(r) * 24)], m3, sh=False)
    a.circ(46.5, 193, 1.5, INK, sh=False, rim=False)
    a.circ(53.5, 193, 1.5, INK, sh=False, rim=False)


@spr('skyline', 0.17, 170, 200)
def _skyline(a):
    for (x, w_, h, c) in [(4, 30, 96, '#6B70BD'), (132, 34, 112, '#5960AE'), (30, 30, 138, '#8389D6'), (102, 34, 128, '#7178C8')]:
        a.rect(x, 0, w_, h, c)
        windows(a, x + 5, 10, 3, int(h / 16) - 1, (w_ - 8) / 3, 15, 4.5, 7, '#FFD76A')
    a.rect(60, 0, 42, 150, '#9AA0E6')
    a.rect(67, 150, 28, 18, '#9AA0E6')
    a.rect(74, 168, 14, 12, '#9AA0E6')
    a.line([(81, 180), (81, 198)], '#C9CDF5', 2.5)
    windows(a, 66, 10, 4, 9, 8.5, 15, 4.5, 8, '#FFD76A')


@spr('niagara', 0.17, 170, 90)
def _niagara(a):
    a.poly([(0, 0), (0, 70), (30, 78), (60, 62), (110, 62), (140, 78), (170, 70), (170, 0)], '#7E6AAE')
    a.poly([(0, 70), (30, 78), (60, 62), (110, 62), (140, 78), (170, 70), (170, 60), (140, 66), (110, 52), (60, 52), (30, 66), (0, 60)], '#35B46A')
    a.poly([(34, 66), (60, 54), (110, 54), (136, 66), (130, 6), (40, 6)], '#6FC3F2')
    for i, x in enumerate(range(46, 128, 9)):
        a.line([(x, 58 - (i % 3) * 3), (x - 1, 12 + (i % 2) * 8)], '#DDF3FF', 2.6)
    a.rect(20, 0, 130, 9, '#4C9CE8', r=3)


@spr('mist', 0.04, 60, 40, back='#ffffff', ground=False)
def _mist(a):
    pa = skia.Path()
    for (x, y, r) in [(16, 16, 12), (30, 22, 15), (44, 16, 12)]:
        pa.addCircle(x, y, r)
    a.path(pa, '#FFFFFF', rim=False)


@spr('smoke', 0.04, 60, 44, back='#d8d4e6', ground=False)
def _smoke(a):
    pa = skia.Path()
    for (x, y, r) in [(16, 18, 12), (32, 24, 16), (46, 16, 11)]:
        pa.addCircle(x, y, r)
    a.path(pa, '#E6E2F0', rim=False)


@spr('goldengate', 0.19, 200, 96)
def _gg(a):
    c = '#E8452F'
    a.rect(0, 0, 200, 10, '#3C8DE6', r=3)
    a.line([(0, 34), (200, 34)], c, 5)
    for x in (56, 144):
        a.rect(x - 5, 6, 10, 84, c, r=1)
        for y in (48, 64, 80):
            a.rect(x - 7, y, 14, 3, '#C2331F', sh=False, rim=False)
    a.line([(0, 44), (28, 62), (56, 88)], c, 2.2, smooth=True)
    a.line([(56, 88), (100, 40), (144, 88)], c, 2.2, smooth=True)
    a.line([(144, 88), (172, 62), (200, 44)], c, 2.2, smooth=True)
    for x in range(66, 140, 10):
        yy = 40 + 48 * ((x - 100) / 44) ** 2
        a.line([(x, 36), (x, yy)], c, 1.1)


@spr('redwood', 0.055, 70, 190)
def _redwood(a):
    a.poly([(26, 0), (44, 0), (40, 150), (30, 150)], '#B5573C')
    a.line([(33, 6), (34, 120)], '#8E3F2B', 1.5)
    for i, (y, w_) in enumerate([(84, 60), (108, 52), (132, 42), (154, 30)]):
        tri(a, 35, y, w_, 36, '#1C8F5F' if i % 2 == 0 else '#27A86F')


@spr('bison', 0.085, 130, 86)
def _bison(a):
    for x in (30, 42, 82, 94):
        a.rect(x, 0, 9, 30, '#4E2F1D', r=3)
    a.poly([(14, 30), (16, 52), (50, 58), (78, 78), (106, 70), (116, 44), (104, 24), (40, 22)], '#7A4A2B', smooth=True)
    a.poly([(70, 60), (84, 80), (108, 72), (112, 52), (92, 42)], '#5A341E', smooth=True)
    a.circ(112, 40, 12, '#5A341E')
    a.line([(108, 50), (114, 60)], CREAM, 3)
    a.circ(116, 40, 1.8, WHITE, sh=False, rim=False)
    a.line([(14, 46), (6, 30)], '#4E2F1D', 2.5)


@spr('chichen', 0.11, 130, 90)
def _chichen(a):
    for i in range(5):
        a.rect(6 + i * 11, i * 13, 118 - i * 22, 14, '#E3CDA4' if i % 2 == 0 else '#D4BA8C')
    a.rect(50, 65, 30, 18, '#E3CDA4')
    a.rect(60, 65, 10, 12, '#6B4226', sh=False)
    a.poly([(56, 0), (74, 0), (70, 65), (60, 65)], '#C2A777')
    for y in range(5, 65, 6):
        a.line([(57, y), (73, y)], '#A88C5C', 1)


@spr('moose', 0.09, 130, 120)
def _moose(a):
    for x in (34, 44, 84, 94):
        a.line([(x, 0), (x, 50)], '#5A3A26', 6)
    a.poly([(22, 48), (26, 74), (60, 80), (96, 84), (108, 66), (100, 46), (40, 42)], '#7B5236', smooth=True)
    a.poly([(94, 70), (104, 96), (124, 92), (128, 76), (112, 66)], '#7B5236', smooth=True)
    a.poly([(98, 96), (86, 112), (92, 118), (98, 106), (102, 118), (108, 106), (112, 116), (116, 100), (108, 94)], CREAM)
    a.circ(118, 86, 1.8, INK, sh=False, rim=False)
    a.line([(110, 70), (108, 60)], '#5A3A26', 4)


@spr('polarbear', 0.09, 130, 74)
def _pbear(a):
    for x in (28, 42, 84, 98):
        a.rect(x, 0, 12, 26, '#E6EEF6', r=5)
    a.poly([(12, 24), (16, 50), (50, 60), (90, 58), (112, 50), (116, 28), (60, 20)], '#FAFDFF', smooth=True)
    a.poly([(100, 40), (112, 60), (126, 54), (130, 44), (118, 36)], '#FAFDFF', smooth=True)
    a.circ(108, 60, 4, '#FAFDFF', sh=False)
    a.circ(129, 45, 2.2, INK, sh=False, rim=False)
    a.circ(119, 50, 1.6, INK, sh=False, rim=False)


@spr('cabin', 0.075, 100, 80)
def _cabin(a):
    a.rect(12, 0, 76, 40, '#8A5A3C')
    for y in (10, 20, 30):
        a.line([(12, y), (88, y)], '#6B4226', 1.6)
    a.poly([(4, 38), (96, 38), (50, 76)], '#FBFDFF')
    a.rect(24, 12, 16, 16, '#FFD76A', r=2, sh=False)
    a.rect(58, 0, 16, 28, '#5A341E', r=2, sh=False)
    a.rect(70, 52, 8, 22, '#8A5A3C')


@spr('eagle_w', 0.06, 100, 62, back='#f3e7cf', ground=False)
def _eagle(a):
    a.poly([(2, 0), (30, 0), (62, 0), (88, 0), (80, 8), (60, 9), (30, 6)], '#6B4226')
    a.poly([(80, 8), (88, 0), (99, 0), (92, 7)], WHITE, sh=False)
    a.poly([(2, 0), (16, 0), (10, 6)], WHITE, sh=False)
    a.poly([(30, 2), (64, 2), (58, 60), (24, 46)], '#6B4226')
    a.poly([(38, 34), (58, 60), (24, 46)], '#8A5A3C', sh=False)


# =========================================================================== South America
@spr('machu', 0.18, 180, 150)
def _machu(a):
    a.poly([(70, 0), (86, 60), (104, 112), (120, 142), (136, 146), (150, 120), (164, 60), (180, 0)], '#249A5E', smooth=False)
    a.poly([(136, 146), (150, 120), (164, 60), (180, 0), (140, 0)], '#1B7F50', sh=False, rim=False)
    a.poly([(30, 0), (48, 50), (62, 78), (76, 60), (92, 0)], '#3DB36A')
    for i in range(5):
        y = i * 11
        a.rect(0 + i * 5, y, 112 - i * 13, 11, '#7CCB6B' if i % 2 == 0 else '#5FBF62')
        a.line([(i * 5, y + 10.4), (112 - i * 8, y + 10.4)], '#CDB48E', 1.6)
    for (x, y) in [(20, 22), (44, 33), (66, 44), (36, 11), (78, 22)]:
        a.rect(x, y, 13, 9, STONE, sh=True)
        a.poly([(x - 2, y + 9), (x + 15, y + 9), (x + 6.5, y + 17)], '#D9A441', sh=False)


@spr('llama', 0.06, 90, 110)
def _llama(a):
    for x in (24, 34, 58, 66):
        a.line([(x, 0), (x, 40)], '#E9DCC8', 6)
    a.poly([(14, 38), (16, 62), (40, 68), (70, 66), (76, 46), (66, 36), (24, 34)], '#FBF3E4', smooth=True)
    a.poly([(60, 56), (64, 96), (78, 98), (76, 56)], '#FBF3E4')
    a.poly([(62, 92), (66, 108), (70, 98), (74, 108), (86, 92), (84, 84), (66, 84)], '#FBF3E4')
    a.circ(78, 92, 1.8, INK, sh=False, rim=False)
    a.poly([(24, 50), (60, 50), (58, 68), (26, 68)], '#EF4B4B')
    a.line([(24, 56), (60, 56)], GOLD, 2.5)
    a.line([(24, 62), (60, 62)], '#3C8DE6', 2.5)


@spr('christ', 0.11, 120, 190)
def _christ(a):
    a.poly([(0, 0), (16, 40), (36, 72), (60, 84), (84, 72), (104, 40), (120, 0)], '#2E9E63', smooth=False)
    a.poly([(60, 84), (84, 72), (104, 40), (120, 0), (66, 0)], '#1F8552', sh=False, rim=False)
    a.rect(50, 80, 20, 14, STONE)
    a.poly([(50, 94), (70, 94), (67, 160), (53, 160)], '#FCFAF3')
    a.poly([(14, 146), (106, 146), (106, 158), (68, 162), (52, 162), (14, 158)], '#FCFAF3')
    a.circ(60, 170, 9, '#FCFAF3')
    a.line([(57, 100), (58, 150)], '#D9D3C3', 1.3)
    a.line([(63, 100), (62, 150)], '#D9D3C3', 1.3)


@spr('jaguar', 0.085, 130, 66)
def _jaguar(a):
    for x in (30, 42, 86, 98):
        a.line([(x, 0), (x, 28)], '#E9A63A', 6)
    body = smooth_path([(16, 26), (20, 46), (56, 50), (96, 50), (110, 40), (104, 24), (40, 22)])
    a.path(body, '#F7B844')
    a.clip(body)
    for (x, y) in [(30, 38), (44, 32), (56, 42), (70, 34), (82, 44), (94, 34), (40, 46), (66, 26)]:
        a.circ(x, y, 3.4, '#5A341E', sh=False, rim=False)
        a.circ(x, y, 1.4, '#F7B844', sh=False, rim=False)
    a.unclip()
    a.circ(112, 46, 12, '#F7B844')
    a.poly([(104, 56), (108, 64), (112, 56)], '#F7B844', sh=False)
    a.poly([(114, 56), (118, 64), (122, 54)], '#F7B844', sh=False)
    a.circ(116, 48, 1.8, INK, sh=False, rim=False)
    a.line([(16, 38), (4, 52), (8, 60)], '#F7B844', 4, smooth=True)


@spr('tortoise', 0.06, 110, 60)
def _tortoise(a):
    for x in (28, 76):
        a.rect(x, 0, 12, 18, '#7FA35A', r=4)
    a.poly([(84, 20), (104, 26), (108, 38), (96, 40), (84, 30)], '#8DB466', smooth=True)
    a.circ(101, 34, 1.6, INK, sh=False, rim=False)
    dome = smooth_path([(14, 14), (22, 40), (54, 56), (84, 40), (92, 14), (54, 10)])
    a.path(dome, '#5E8A45')
    a.clip(dome)
    for (x, y) in [(36, 30), (54, 40), (72, 30), (54, 20)]:
        a.poly([(x - 9, y), (x, y + 8), (x + 9, y), (x, y - 8)], '#86B560', sh=False)
    a.unclip()


@spr('moai', 0.04, 60, 110)
def _moai(a):
    a.poly([(12, 0), (48, 0), (46, 70), (50, 96), (40, 108), (16, 108), (10, 96), (14, 70)], '#8D8AA6')
    a.rect(10, 84, 40, 7, '#6E6B8A', sh=False)
    a.poly([(26, 52), (34, 52), (36, 84), (24, 84)], '#A6A3BD', sh=False)
    a.line([(22, 44), (38, 44)], '#5A5775', 3)


@spr('toucan', 0.05, 80, 70)
def _toucan(a):
    a.oval(34, 34, 18, 24, INK, rot=-20)
    a.oval(40, 44, 9, 12, WHITE, rot=-20, sh=False)
    a.poly([(46, 52), (78, 50), (74, 40), (50, 40)], '#FF8A3D', smooth=True)
    a.poly([(66, 50), (78, 50), (74, 42)], '#EF4B4B', sh=False)
    a.circ(46, 52, 2, WHITE, sh=False, rim=False)
    a.poly([(20, 14), (10, 0), (26, 10)], INK, sh=False)


# =========================================================================== Asia
@spr('taj', 0.21, 210, 170)
def _taj(a):
    w0, w1 = '#FDFBF5', '#E9E4F2'
    a.rect(0, 0, 210, 14, '#F2C9B8')
    for x in (10, 190):
        a.rect(x, 14, 10, 104, w0)
        a.rect(x - 2, 96, 14, 5, w1, sh=False)
        a.path(smooth_path([(x - 1, 118), (x + 5, 134), (x + 11, 118)]), w0)
    a.rect(36, 14, 138, 70, w0)
    a.poly([(36, 14), (60, 14), (60, 84), (36, 84)], w1, sh=False, rim=False)
    a.poly([(150, 14), (174, 14), (174, 84), (150, 84)], w1, sh=False, rim=False)
    arch = smooth_path([(88, 14), (88, 52), (105, 74), (122, 52), (122, 14)])
    a.path(arch, '#F2B6C6', sh=False)
    a.path(smooth_path([(96, 14), (96, 46), (105, 60), (114, 46), (114, 14)]), '#7A5FA8', sh=False)
    for x in (44, 158):
        a.path(smooth_path([(x - 2, 20), (x - 2, 38), (x + 4, 47), (x + 10, 38), (x + 10, 20)]), '#F2B6C6', sh=False)
        a.path(smooth_path([(x - 2, 52), (x - 2, 66), (x + 4, 74), (x + 10, 66), (x + 10, 52)]), '#F2B6C6', sh=False)
    a.rect(82, 84, 46, 12, w1)
    a.path(smooth_path([(84, 96), (74, 122), (90, 146), (105, 160), (120, 146), (136, 122), (126, 96)]), w0)
    a.line([(105, 158), (105, 168)], GOLD, 2.2)
    for x in (56, 154):
        a.rect(x - 8, 84, 16, 8, w1)
        a.path(smooth_path([(x - 9, 92), (x - 11, 102), (x, 114), (x + 11, 102), (x + 9, 92)]), w0)
        a.line([(x, 113), (x, 119)], GOLD, 1.6)


@spr('tiger', 0.09, 130, 66)
def _tiger(a):
    for x in (30, 42, 86, 98):
        a.line([(x, 0), (x, 28)], '#F08A2E', 6)
    body = smooth_path([(16, 26), (20, 46), (56, 50), (96, 50), (110, 40), (104, 24), (40, 22)])
    a.path(body, '#FF9A3D')
    a.clip(body)
    for x in range(26, 104, 11):
        a.poly([(x, 52), (x + 5, 52), (x + 2, 32)], INK, sh=False, rim=False)
    a.unclip()
    a.circ(112, 46, 12, '#FF9A3D')
    a.poly([(104, 56), (108, 64), (112, 56)], '#FF9A3D', sh=False)
    a.poly([(114, 56), (118, 64), (122, 54)], '#FF9A3D', sh=False)
    a.circ(118, 42, 5, WHITE, sh=False, rim=False)
    a.circ(116, 49, 1.8, INK, sh=False, rim=False)
    a.line([(16, 38), (4, 50), (8, 60)], '#FF9A3D', 4, smooth=True)


@spr('peacock', 0.07, 110, 100)
def _peacock(a):
    fan = poly_path([(55, 14)] + [(55 + 50 * math.cos(math.radians(t)), 14 + 80 * math.sin(math.radians(t))) for t in range(10, 171, 16)])
    a.path(fan, '#1FAF9A')
    for t in range(22, 160, 23):
        for rr in (44, 66):
            x, y = 55 + rr * 0.62 * math.cos(math.radians(t)), 14 + rr * math.sin(math.radians(t))
            a.circ(x, y, 5.5, GOLD, sh=False, rim=False)
            a.circ(x, y, 2.8, '#2F5FD0', sh=False, rim=False)
    a.poly([(46, 0), (64, 0), (62, 34), (56, 50), (50, 34)], '#2F5FD0', smooth=True)
    a.circ(56, 54, 6, '#2F5FD0')
    a.poly([(60, 54), (68, 52), (61, 50)], GOLD, sh=False)


@spr('burj', 0.045, 50, 230)
def _burj(a):
    for i, (w_, h) in enumerate([(40, 60), (32, 100), (24, 140), (16, 175), (8, 205)]):
        a.rect(25 - w_ / 2, 0, w_, h, '#9FC8EE' if i % 2 == 0 else '#C2E0F8')
    a.line([(25, 205), (25, 228)], '#E8F4FF', 2)


@spr('greatwall', 0.60, 600, 84)
def _greatwall(a):
    a.poly([(0, 0), (0, 14), (80, 26), (180, 16), (300, 30), (420, 18), (520, 28), (600, 14), (600, 0)], '#5FBF62')
    wall = [(0, 16), (100, 30), (200, 20), (300, 36), (400, 22), (500, 34), (600, 18)]
    top = [(x, y + 20) for x, y in wall]
    pth = poly_path(wall + top[::-1])
    a.path(pth, '#E2B98E')
    a.clip(pth)
    for k in range(0, 600, 12):
        a.line([(k, 0), (k, 84)], '#C99A6C', 1.0)
    a.unclip()
    for i in range(len(wall) - 1):
        (x0, y0), (x1, y1) = top[i], top[i + 1]
        for k in range(1, 9, 2):
            t0, t1 = k / 9.0, (k + 1) / 9.0
            a.poly([(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0), (x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1),
                    (x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1 + 6), (x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0 + 6)], '#E2B98E', sh=False, rim=False)
    for (x, y) in [(100, 30), (300, 36), (500, 34)]:
        a.rect(x - 16, y - 6, 32, 40, '#EDCBA4')
        a.rect(x - 20, y + 34, 40, 6, '#C99A6C')
        for k in (-14, -4, 6):
            a.rect(x + k, y + 40, 7, 6, '#EDCBA4', sh=False, rim=False)
        a.rect(x - 5, y + 8, 10, 14, '#7A4B3A', r=4, sh=False)


@spr('pagoda', 0.095, 100, 180)
def _pagoda(a):
    for i in range(5):
        y = i * 30
        w_ = 56 - i * 8
        a.rect(50 - w_ / 2, y, w_, 22, '#FBF1DD')
        a.rect(50 - w_ / 4, y + 4, w_ / 2, 12, '#C7402A', sh=False, rim=False)
        rw = w_ + 30
        a.poly([(50 - rw / 2 - 4, y + 26), (50 - rw / 2 + 6, y + 21), (50 + rw / 2 - 6, y + 21), (50 + rw / 2 + 4, y + 26), (50 + w_ / 2 - 2, y + 33), (50 - w_ / 2 + 2, y + 33)], '#E8452F')
        a.line([(50 - rw / 2 + 4, y + 22), (50 + rw / 2 - 4, y + 22)], GOLD, 1.8)
    a.line([(50, 152), (50, 176)], GOLD, 3)
    a.circ(50, 176, 3, GOLD, sh=False)


@spr('panda', 0.075, 90, 86)
def _panda(a):
    a.oval(24, 14, 13, 10, INK)
    a.oval(66, 14, 13, 10, INK)
    a.oval(45, 30, 30, 26, '#FDFDFB')
    a.line([(18, 36), (30, 22)], INK, 11)
    a.line([(72, 36), (60, 22)], INK, 11)
    a.circ(28, 76, 8, INK)
    a.circ(62, 76, 8, INK)
    a.circ(45, 60, 22, '#FDFDFB')
    a.oval(36, 62, 5.5, 7, INK, rot=20, sh=False, rim=False)
    a.oval(54, 62, 5.5, 7, INK, rot=-20, sh=False, rim=False)
    a.circ(45, 53, 2.6, INK, sh=False, rim=False)
    a.line([(72, 6), (60, 50)], '#5DB548', 4)
    a.poly([(60, 50), (74, 56), (64, 42)], '#8FD45A', sh=False)


@spr('torii', 0.075, 100, 86)
def _torii(a):
    c = '#E8452F'
    a.rect(20, 0, 9, 66, c)
    a.rect(71, 0, 9, 66, c)
    a.rect(14, 50, 72, 7, c)
    a.poly([(2, 80), (98, 80), (92, 68), (8, 68)], c)
    a.poly([(0, 84), (100, 84), (98, 79), (2, 79)], INK, sh=False)
    a.rect(46, 57, 8, 11, c, sh=False)


@spr('angkor', 0.12, 150, 110)
def _angkor(a):
    a.rect(0, 0, 150, 26, '#C9A27C')
    for x in range(10, 140, 16):
        a.rect(x, 4, 6, 14, '#8A6444', sh=False, rim=False)
    def tower(x, w_, h):
        a.path(smooth_path([(x - w_ / 2, 22), (x - w_ / 2 - 2, 22 + h * 0.3), (x - w_ * 0.3, 22 + h * 0.7), (x, 22 + h),
                            (x + w_ * 0.3, 22 + h * 0.7), (x + w_ / 2 + 2, 22 + h * 0.3), (x + w_ / 2, 22)]), '#D9B48C')
        for k in range(1, 5):
            y = 22 + h * k / 5.5
            ww = w_ * (1 - k / 6.5)
            a.line([(x - ww / 2, y), (x + ww / 2, y)], '#B08A62', 1.6)
    tower(22, 24, 50)
    tower(128, 24, 50)
    tower(75, 34, 84)


@spr('orangutan', 0.06, 80, 84)
def _orang(a):
    a.oval(40, 28, 26, 26, '#E8662A')
    a.line([(18, 40), (8, 12)], '#E8662A', 10)
    a.line([(62, 40), (72, 12)], '#E8662A', 10)
    a.circ(40, 60, 18, '#E8662A')
    a.oval(40, 56, 11, 10, '#F2B48A', sh=False)
    a.circ(35, 60, 1.8, INK, sh=False, rim=False)
    a.circ(45, 60, 1.8, INK, sh=False, rim=False)


@spr('reindeer', 0.085, 120, 116)
def _reindeer(a):
    for x in (30, 40, 78, 88):
        a.line([(x, 0), (x, 46)], '#8A6444', 5)
    a.poly([(18, 44), (22, 68), (56, 72), (90, 74), (100, 58), (92, 42), (34, 40)], '#B58A62', smooth=True)
    a.poly([(86, 62), (96, 90), (112, 88), (116, 76), (102, 66)], '#B58A62', smooth=True)
    a.circ(26, 62, 7, WHITE, sh=False)
    for sx in (-1, 1):
        a.line([(100, 90), (100 + sx * 6, 104), (100 + sx * 14, 112)], CREAM, 2.6, smooth=True)
        a.line([(100 + sx * 6, 104), (100 + sx * 2, 114)], CREAM, 2.2)
    a.circ(115, 80, 2.6, RED, sh=False, rim=False)
    a.circ(107, 82, 1.6, INK, sh=False, rim=False)


@spr('train', 0.26, 320, 56)
def _train(a):
    a.line([(0, 3), (320, 3)], '#6E6B8A', 3)
    for i, c in enumerate(['#3C8DE6', '#FFC542', '#35B46A']):
        x = 6 + i * 74
        a.rect(x, 10, 66, 30, c, r=4)
        windows(a, x + 8, 22, 3, 1, 18, 0, 12, 11, '#EAF6FF')
        a.circ(x + 14, 9, 6.5, INK)
        a.circ(x + 52, 9, 6.5, INK)
    a.rect(230, 10, 84, 26, '#EF4B4B', r=4)
    a.rect(232, 30, 36, 20, '#EF4B4B', r=3)
    a.rect(240, 34, 18, 11, '#EAF6FF', sh=False)
    a.rect(288, 36, 11, 14, INK)
    a.poly([(314, 10), (320, 10), (314, 22)], GOLD, sh=False)
    for xx in (244, 268, 296):
        a.circ(xx, 9, 7, INK)
        a.circ(xx, 9, 2.5, GOLD, sh=False, rim=False)


@spr('yurt', 0.06, 90, 62)
def _yurt(a):
    a.rect(10, 0, 70, 30, '#FBF7EE', r=3)
    a.poly([(4, 28), (86, 28), (62, 56), (28, 56)], '#F2E6CF', smooth=False)
    a.rect(36, 0, 18, 24, '#EF4B4B', r=3, sh=False)
    a.line([(10, 22), (80, 22)], '#3C8DE6', 2.5)
    a.rect(38, 54, 14, 5, '#C84F3F', sh=False)


# =========================================================================== Oceania
@spr('opera', 0.21, 220, 120)
def _opera(a):
    a.rect(0, 0, 220, 10, '#3C8DE6', r=3)
    a.poly([(8, 8), (212, 8), (204, 28), (16, 28)], '#E3B58C')
    def sail(x, w_, h, lean, c):
        a.path(smooth_path([(x, 26), (x + w_ * 0.2 + lean * 0.5, 26 + h * 0.6), (x + w_ * 0.5 + lean, 26 + h), (x + w_ * 0.86, 26 + h * 0.5), (x + w_, 26)], closed=True, tension=0.42), c)
    sail(120, 84, 62, 26, '#F2EEE4')
    sail(96, 80, 82, 22, '#FDFCF8')
    sail(66, 70, 66, 14, '#F2EEE4')
    sail(34, 58, 48, 8, '#FDFCF8')
    sail(10, 40, 30, 4, '#F2EEE4')


@spr('hbridge', 0.24, 240, 96)
def _hbridge(a):
    c = '#5D689E'
    for x in (14, 214):
        a.rect(x, 0, 14, 50, '#D9C4A3')
    a.line([(0, 30), (240, 30)], c, 5)
    a.line([(24, 30), (70, 70), (120, 86), (170, 70), (216, 30)], c, 5, smooth=True)
    a.line([(28, 30), (70, 50), (120, 60), (170, 50), (212, 30)], c, 3, smooth=True)
    for x in range(44, 200, 13):
        y1 = 86 - 56 * ((x - 120) / 96) ** 2
        a.line([(x, 30), (x, y1)], c, 1.3)


@spr('kangaroo', 0.07, 100, 110)
def _kangaroo(a):
    c = '#C9773C'
    a.line([(26, 22), (6, 6), (0, 2)], c, 7, smooth=True, sh=True)
    a.poly([(24, 10), (50, 4), (60, 10), (40, 18)], c)
    a.poly([(26, 18), (30, 46), (50, 70), (66, 74), (70, 56), (60, 28), (46, 12)], c, smooth=True)
    a.poly([(56, 64), (62, 90), (76, 94), (80, 82), (70, 64)], c, smooth=True)
    a.poly([(64, 92), (62, 108), (70, 98)], c, sh=False)
    a.poly([(70, 94), (74, 108), (78, 94)], c, sh=False)
    a.line([(62, 56), (76, 46)], '#B4622C', 4.5)
    a.circ(74, 86, 1.8, INK, sh=False, rim=False)
    a.oval(54, 40, 8, 12, '#E9A06A', sh=False, rim=False)


@spr('coral_a', 0.06, 80, 90)
def _coral_a(a):
    for (x1, y1) in [(12, 60), (26, 82), (40, 88), (56, 80), (70, 58)]:
        a.line([(40, 0), ((40 + x1) / 2 + (x1 - 40) * 0.2, y1 * 0.5), (x1, y1)], '#FF6F91', 7, smooth=True, sh=True)
        a.circ(x1, y1, 5.5, '#FF9CB8')


@spr('coral_b', 0.06, 80, 80)
def _coral_b(a):
    fan = poly_path([(40, 0)] + [(40 + 38 * math.cos(math.radians(t)), 76 * math.sin(math.radians(t))) for t in range(15, 166, 15)])
    a.path(fan, '#FF8A3D')
    a.clip(fan)
    for t in range(25, 160, 18):
        a.line([(40, 0), (40 + 40 * math.cos(math.radians(t)), 80 * math.sin(math.radians(t)))], '#FFD76A', 2.2)
    a.unclip()


@spr('coral_c', 0.05, 70, 80)
def _coral_c(a):
    for (x, h, c) in [(14, 50, '#A77BF0'), (30, 74, '#8E63E0'), (46, 60, '#A77BF0'), (58, 40, '#C3A2F7')]:
        a.rect(x - 6, 0, 12, h, c, r=6)
        a.circ(x, h - 8, 2, WHITE, sh=False, rim=False)


@spr('fish_a', 0.03, 70, 44, back='#ffb060', ground=False)
def _fish_a(a):
    a.poly([(4, 8), (18, 22), (4, 36)], '#FF7A2E')
    a.oval(40, 22, 26, 16, '#FF7A2E')
    a.rect(30, 6, 6, 32, WHITE, sh=False, rim=False)
    a.rect(46, 8, 6, 28, WHITE, sh=False, rim=False)
    a.circ(58, 25, 2.2, INK, sh=False, rim=False)


@spr('fish_b', 0.03, 70, 44, back='#9ad0ff', ground=False)
def _fish_b(a):
    a.poly([(4, 8), (18, 22), (4, 36)], GOLD)
    a.oval(40, 22, 26, 16, '#2F7BE0')
    a.poly([(30, 36), (44, 44), (50, 34)], GOLD, sh=False)
    a.circ(58, 25, 2.2, WHITE, sh=False, rim=False)


@spr('turtle', 0.06, 110, 60)
def _turtle(a):
    a.poly([(24, 20), (6, 4), (30, 10)], '#3FAE7A')
    a.poly([(70, 18), (84, 0), (88, 16)], '#3FAE7A')
    a.poly([(86, 28), (106, 30), (108, 40), (92, 42)], '#52C48C', smooth=True)
    a.circ(102, 37, 1.6, INK, sh=False, rim=False)
    dome = smooth_path([(14, 20), (24, 44), (54, 54), (84, 44), (92, 22), (54, 12)])
    a.path(dome, '#1F8F6A')
    a.clip(dome)
    for (x, y) in [(36, 32), (54, 42), (72, 32), (54, 22)]:
        a.poly([(x - 9, y), (x, y + 8), (x + 9, y), (x, y - 8)], '#6FD3A0', sh=False)
    a.unclip()


@spr('surf', 0.13, 150, 100)
def _surf(a):
    a.path(smooth_path([(0, 0), (10, 40), (40, 80), (80, 96), (112, 84), (120, 64), (104, 56), (88, 66), (74, 50), (84, 24), (150, 0)], tension=0.4), '#2C8FE0')
    a.path(smooth_path([(40, 80), (80, 96), (112, 84), (120, 64), (104, 56), (100, 70), (80, 84), (56, 76)], tension=0.4), '#FFFFFF')
    a.line([(20, 20), (40, 52)], '#7CC6F5', 3)
    a.line([(40, 14), (56, 40)], '#7CC6F5', 3)
    a.poly([(0, 0), (150, 0), (120, 10), (30, 10)], '#7CC6F5', sh=False)


@spr('surfer', 0.035, 70, 70, ground=False)
def _surfer(a):
    a.poly([(0, 6), (60, 0), (70, 6), (60, 12)], GOLD, smooth=True)
    a.line([(26, 10), (30, 30)], INK, 5)
    a.line([(40, 9), (36, 30)], INK, 5)
    a.rect(24, 28, 18, 22, '#EF4B4B', r=5)
    a.line([(24, 44), (10, 40)], '#F6C9A0', 4)
    a.line([(42, 44), (58, 50)], '#F6C9A0', 4)
    a.circ(33, 58, 8, '#F6C9A0')


@spr('sheep', 0.04, 80, 60)
def _sheep(a):
    for x in (24, 34, 52, 60):
        a.line([(x, 0), (x, 22)], INK, 4)
    pa = skia.Path()
    for (x, y, r) in [(24, 32, 13), (38, 40, 15), (54, 38, 14), (44, 26, 13), (60, 28, 11)]:
        pa.addCircle(x, y, r)
    a.path(pa, '#FFFFFF', rim=False)
    a.oval(68, 40, 9, 8, INK)
    a.circ(71, 42, 1.4, WHITE, sh=False, rim=False)


@spr('kiwi', 0.045, 80, 60)
def _kiwi(a):
    a.line([(34, 0), (36, 22)], '#C98B4B', 3)
    a.line([(46, 0), (44, 22)], '#C98B4B', 3)
    a.oval(38, 34, 24, 18, '#7A5236')
    a.circ(58, 42, 9, '#7A5236')
    a.line([(64, 42), (79, 30)], '#E9DCC8', 2.5)
    a.circ(60, 45, 1.5, INK, sh=False, rim=False)


@spr('volcano', 0.16, 180, 130)
def _volcano(a):
    a.poly([(0, 0), (30, 30), (62, 86), (76, 114), (104, 114), (118, 86), (150, 30), (180, 0)], '#6B4E8F', smooth=False)
    a.poly([(90, 114), (104, 114), (118, 86), (150, 30), (180, 0), (96, 0)], '#553A78', sh=False, rim=False)
    a.poly([(74, 110), (76, 114), (104, 114), (106, 110), (100, 84), (104, 60), (96, 70), (92, 40), (86, 66), (80, 90)], '#FF6A2E')
    a.poly([(82, 114), (98, 114), (94, 86), (90, 60), (88, 90)], '#FFC542', sh=False)
    a.poly([(0, 0), (50, 14), (100, 6), (150, 14), (180, 0)], '#35B46A')


# =========================================================================== polar
@spr('aurora', 0.60, 600, 280, back='#7cf0c0', ground=False)
def _aurora(a):
    top = [(x, 236 + 34 * math.sin(x * 0.021 + 0.6) + 10 * math.sin(x * 0.05)) for x in range(0, 601, 30)]
    bot = [(x, 26 + 18 * math.sin(x * 0.017 + 2.0)) for x in range(600, -1, -30)]
    pth = smooth_path(top + bot, tension=0.4)
    p = skia.Paint(AntiAlias=True)
    p.setShader(skia.GradientShader.MakeLinear([skia.Point(0, 20), skia.Point(0, 270)],
                [skia.Color4f(0.55, 1.0, 0.62, 0.96), skia.Color4f(0.20, 0.90, 0.72, 0.92), skia.Color4f(0.30, 0.62, 0.98, 0.80), skia.Color4f(0.62, 0.40, 0.95, 0.55)],
                [0.0, 0.35, 0.7, 1.0]))
    a.c.drawPath(pth, p)
    a.clip(pth)
    for x in range(8, 600, 13):
        hh = 90 + 70 * abs(math.sin(x * 0.37))
        a.line([(x, 20), (x + 2, 20 + hh)], '#D9FFE9', 2.2, alpha=0.5)
    for x in range(14, 600, 29):
        a.line([(x, 120), (x + 1, 270)], '#B79CFF', 3.0, alpha=0.35)
    a.unclip()


@spr('igloo', 0.085, 110, 64)
def _igloo(a):
    dome = smooth_path([(8, 0), (10, 30), (30, 54), (58, 60), (86, 50), (100, 26), (102, 0)], tension=0.45)
    a.path(dome, '#F4FAFF')
    a.clip(dome)
    for y in (14, 28, 42):
        a.line([(0, y), (110, y)], '#BBD9F0', 1.6)
    for j, y in enumerate((0, 14, 28, 42)):
        for x in range(8 + (j % 2) * 9, 110, 18):
            a.line([(x, y), (x, y + 14)], '#BBD9F0', 1.4)
    a.unclip()
    a.path(smooth_path([(42, 0), (42, 20), (56, 30), (70, 20), (70, 0)], tension=0.45), '#3A4A7A')


@spr('penguin', 0.04, 60, 90)
def _penguin(a):
    a.poly([(16, 0), (26, 0), (28, 6), (14, 6)], ORANGE, sh=False)
    a.poly([(34, 0), (44, 0), (46, 6), (32, 6)], ORANGE, sh=False)
    a.path(smooth_path([(12, 8), (8, 44), (18, 76), (30, 86), (42, 76), (52, 44), (48, 8)], tension=0.45), '#2B2B45')
    a.path(smooth_path([(18, 8), (16, 40), (22, 62), (30, 66), (38, 62), (44, 40), (42, 8)], tension=0.45), WHITE, sh=False)
    a.poly([(8, 50), (2, 28), (12, 34)], '#2B2B45', sh=False)
    a.poly([(52, 50), (58, 28), (48, 34)], '#2B2B45', sh=False)
    a.poly([(26, 70), (34, 70), (30, 63)], ORANGE, sh=False)
    a.circ(24, 75, 2, WHITE, sh=False, rim=False)
    a.circ(36, 75, 2, WHITE, sh=False, rim=False)
    a.oval(30, 60, 8, 3, GOLD, sh=False, rim=False)


@spr('seal', 0.07, 110, 50)
def _seal(a):
    a.path(smooth_path([(4, 6), (10, 14), (30, 24), (60, 30), (84, 40), (100, 44), (106, 34), (96, 20), (84, 6), (40, 2), (14, 0)], tension=0.45), '#8D93AD')
    a.poly([(4, 6), (0, 18), (14, 10)], '#8D93AD', sh=False)
    a.circ(98, 36, 1.8, INK, sh=False, rim=False)
    a.poly([(60, 6), (70, 0), (78, 6)], '#757B96', sh=False)


@spr('station', 0.075, 100, 80)
def _station(a):
    a.line([(22, 0), (22, 18)], '#6E6B8A', 3)
    a.line([(78, 0), (78, 18)], '#6E6B8A', 3)
    a.rect(10, 16, 80, 30, '#EF4B4B', r=6)
    windows(a, 20, 26, 4, 1, 17, 0, 9, 10, '#EAF6FF')
    a.line([(84, 46), (84, 76)], '#6E6B8A', 2)
    a.poly([(84, 76), (84, 62), (66, 69)], GOLD)


@spr('geyser', 0.05, 70, 110, back='#ffffff')
def _geyser(a):
    a.poly([(10, 0), (60, 0), (46, 14), (24, 14)], '#8D8AA6')
    a.path(smooth_path([(30, 12), (26, 50), (14, 80), (22, 100), (35, 108), (48, 100), (56, 80), (44, 50), (40, 12)], tension=0.45), '#EAF7FF')
    a.line([(35, 16), (35, 86)], '#BFE3F8', 3)


# =========================================================================== sea life and ships
@spr('whale', 0.30, 320, 150, back='#9cc4f0', ground=False)
def _whale(a):
    body = smooth_path([(6, 40), (30, 86), (80, 122), (140, 138), (210, 126), (268, 92), (300, 52), (292, 30), (250, 22), (200, 34), (140, 44), (80, 40), (40, 28)], tension=0.42)
    a.path(body, '#2F6FD0')
    a.clip(body)
    a.path(smooth_path([(120, 36), (200, 26), (270, 14), (310, 40), (296, 64), (240, 60), (180, 66), (120, 60)], tension=0.42), '#CFE6FA', sh=False)
    for k in range(0, 9):
        a.line([(150 + k * 16, 30), (146 + k * 16, 64)], '#9CC4F0', 1.8)
    a.unclip()
    a.poly([(6, 40), (-2, 70), (22, 60), (40, 28), (16, 12), (14, 34)], '#2F6FD0', smooth=False)
    a.poly([(150, 46), (130, 14), (176, 30)], '#2459B0')
    a.circ(262, 72, 4, WHITE, sh=False, rim=False)
    a.circ(263, 72, 2, INK, sh=False, rim=False)


@spr('whale_tail', 0.12, 130, 110, back='#9cc4f0', ground=False)
def _wtail(a):
    a.path(smooth_path([(52, 0), (58, 50), (30, 84), (4, 96), (20, 104), (50, 96), (65, 82), (80, 96), (110, 104), (126, 96), (100, 84), (72, 50), (78, 0)], tension=0.4), '#2F6FD0')
    a.line([(65, 6), (65, 70)], '#2459B0', 2.5)


@spr('spout', 0.06, 80, 90, back='#ffffff', ground=False)
def _spout(a):
    for ang in (-34, -17, 0, 17, 34):
        r = math.radians(90 + ang)
        x1, y1 = 40 + math.cos(r) * 70, math.sin(r) * 70
        a.line([(40, 0), (40 + math.cos(r) * 40, math.sin(r) * 44), (x1, y1)], '#EAF7FF', 4.5, smooth=True)
        a.circ(x1, y1, 5.5, '#FFFFFF')


@spr('splash', 0.08, 110, 40, back='#ffffff', ground=False)
def _splash(a):
    pa = skia.Path()
    for (x, y, r) in [(14, 8, 9), (30, 16, 13), (52, 22, 16), (76, 16, 13), (94, 8, 9)]:
        pa.addCircle(x, y, r)
    pa.addRect(skia.Rect(8, 0, 100, 10))
    a.path(pa, '#FFFFFF', rim=False)


@spr('orca', 0.2, 240, 110, back='#e8eef8', ground=False)
def _orca(a):
    body = smooth_path([(6, 30), (30, 70), (80, 96), (140, 100), (196, 84), (230, 50), (220, 30), (180, 26), (120, 36), (60, 30)], tension=0.42)
    a.path(body, '#22233F')
    a.clip(body)
    a.path(smooth_path([(120, 34), (180, 22), (236, 36), (220, 52), (170, 50), (120, 54)], tension=0.42), WHITE, sh=False)
    a.unclip()
    a.oval(196, 66, 12, 6, WHITE, rot=20, sh=False, rim=False)
    a.poly([(6, 30), (-4, 56), (20, 48), (36, 20), (10, 8), (14, 26)], '#22233F')
    a.poly([(110, 96), (120, 110), (140, 98)], '#22233F')


@spr('tallship', 0.13, 150, 150)
def _tallship(a):
    a.poly([(8, 22), (18, 0), (124, 0), (146, 24), (120, 20), (30, 20)], '#7A4A2B', smooth=False)
    a.line([(14, 16), (136, 18)], GOLD, 2)
    for (x, h) in [(42, 124), (80, 142), (112, 112)]:
        a.line([(x, 18), (x, h)], '#5A341E', 2.6)
    for (x, y, w_, h) in [(26, 28, 34, 36), (30, 68, 26, 28), (32, 100, 20, 20), (62, 28, 38, 42), (66, 74, 30, 32), (70, 110, 22, 24),
                          (100, 28, 28, 34), (102, 66, 22, 26)]:
        a.path(smooth_path([(x, y), (x + w_ * 0.12, y + h * 0.5), (x, y + h), (x + w_, y + h), (x + w_ * 1.12, y + h * 0.5), (x + w_, y)], tension=0.3), '#FBF3E0')
    a.poly([(80, 142), (80, 150), (96, 146)], RED, sh=False)
    a.line([(124, 22), (148, 44)], '#5A341E', 2)


@spr('liner', 0.19, 220, 100)
def _liner(a):
    a.poly([(4, 30), (14, 0), (196, 0), (216, 30)], '#EF4B4B')
    a.poly([(4, 30), (216, 30), (212, 24), (6, 24)], '#22233F', sh=False)
    a.rect(30, 30, 150, 18, WHITE)
    a.rect(50, 48, 110, 14, WHITE)
    windows(a, 38, 35, 12, 1, 11.5, 0, 6, 7, '#3C8DE6')
    windows(a, 58, 52, 8, 1, 12, 0, 6, 6, '#3C8DE6')
    for x in (78, 118):
        a.rect(x, 62, 18, 26, GOLD)
        a.rect(x, 80, 18, 8, '#22233F', sh=False)


@spr('junk', 0.11, 120, 120)
def _junk(a):
    a.poly([(6, 24), (20, 0), (96, 0), (116, 30), (96, 20), (24, 18)], '#7A4A2B')
    for (x, y, w_, h) in [(22, 26, 30, 54), (58, 24, 40, 84)]:
        pth = poly_path([(x, y), (x + w_, y), (x + w_ + 6, y + h * 0.9), (x + w_ * 0.4, y + h), (x - 4, y + h * 0.8)])
        a.path(pth, '#E8452F')
        a.clip(pth)
        for k in range(1, 6):
            a.line([(x - 6, y + h * k / 6), (x + w_ + 8, y + h * k / 6 + 4)], '#B8301F', 1.8)
        a.unclip()
    a.line([(40, 18), (40, 86)], '#5A341E', 2.4)
    a.line([(80, 18), (80, 114)], '#5A341E', 2.4)


@spr('dhow', 0.10, 120, 110)
def _dhow(a):
    a.poly([(4, 22), (22, 0), (92, 0), (118, 28), (96, 18), (24, 16)], '#8A5A3C')
    a.line([(56, 16), (62, 100)], '#5A341E', 2.4)
    a.poly([(20, 36), (62, 104), (104, 30), (60, 24)], '#FBF3E0', smooth=False)
    a.line([(20, 36), (62, 104)], '#C9B48E', 2)


def _sailboat(col):
    def fn(a):
        a.poly([(6, 16), (16, 0), (60, 0), (74, 18)], WHITE)
        a.line([(8, 12), (72, 14)], col, 2.5)
        a.line([(38, 16), (38, 96)], '#5A341E', 2.2)
        a.poly([(41, 22), (41, 94), (72, 26)], col)
        a.poly([(35, 26), (35, 80), (12, 28)], WHITE)
    return fn


spr('sail_r', 0.065, 80, 100)(_sailboat('#EF4B4B'))
spr('sail_y', 0.065, 80, 100)(_sailboat('#FFC542'))
spr('sail_g', 0.065, 80, 100)(_sailboat('#35B46A'))


@spr('canoe', 0.11, 130, 60)
def _canoe(a):
    a.path(smooth_path([(4, 20), (30, 4), (100, 4), (126, 20), (100, 14), (30, 14)], tension=0.4), '#B5573C')
    a.line([(20, 2), (110, 2)], '#8A5A3C', 3)
    a.line([(40, 12), (40, 2)], '#8A5A3C', 2)
    a.line([(90, 12), (90, 2)], '#8A5A3C', 2)
    for x, c in [(50, '#FFC542'), (78, '#35B46A')]:
        a.rect(x - 6, 14, 12, 16, c, r=4)
        a.circ(x, 37, 6.5, '#B9784F')
        a.line([(x + 6, 26), (x + 16, 8)], '#5A341E', 2)


# =========================================================================== sky things
@spr('moon', 0.20, 200, 200, back='#f1e6c8', ground=False)
def _moon(a):
    a.circ(100, 100, 96, '#FBF0CF')
    a.path(smooth_path([(100, 196), (150, 170), (180, 120), (176, 70), (140, 20), (100, 4), (150, 40), (164, 100), (140, 160)], tension=0.45), '#EFDDAE', sh=False)
    for (x, y, r) in [(70, 130, 20), (118, 80, 15), (64, 66, 11), (124, 146, 9), (90, 34, 8)]:
        a.circ(x, y, r, '#E9D5A0')
        a.circ(x + r * 0.12, y - r * 0.12, r * 0.72, '#F6E8C0', sh=False, rim=False)


@spr('plane_wing', 0.12, 140, 44, back='#f7f1e2', ground=False)
def _plane(a):   # half of a paper dart: nose at +x, keel along bottom edge
    a.poly([(0, 0), (140, 0), (4, 42)], '#FFFDF6')
    a.poly([(0, 0), (140, 0), (2, 12)], '#E6E0F2', sh=False, rim=False)
    a.line([(2, 12), (138, 0.6)], '#CFC6E6', 1.0)


@spr('dash', 0.02, 40, 14, back='#ffffff', ground=False)
def _dash(a):
    a.rect(2, 2, 36, 10, '#FFFDF6', r=5)


@spr('petal', 0.012, 20, 20, back='#ffd0e2', ground=False)
def _petal(a):
    a.oval(10, 10, 9, 6, '#FFB3D1', rot=30)


@spr('wavelet', 0.16, 180, 70, back='#bfe3f8')
def _wavelet(a):
    a.path(smooth_path([(0, 0), (8, 22), (30, 44), (52, 50), (62, 40), (54, 34), (46, 38), (44, 26), (60, 12),
                        (76, 30), (98, 56), (122, 62), (132, 50), (122, 44), (114, 48), (112, 34), (128, 16),
                        (146, 30), (160, 40), (170, 34), (164, 28), (160, 30), (162, 18), (180, 0)], tension=0.4), '#4FA6EE')
    for pts in ([(30, 44), (52, 50), (62, 40), (54, 34), (50, 42)], [(98, 56), (122, 62), (132, 50), (122, 44), (118, 54)],
                [(146, 30), (160, 40), (170, 34), (164, 28), (160, 34)]):
        a.path(smooth_path(pts, tension=0.4), '#FFFFFF', sh=False)
    a.poly([(0, 0), (180, 0), (150, 9), (30, 9)], '#8FCDF5', sh=False, rim=False)


@spr('greatwave', 0.5, 300, 215)
def _greatwave(a):
    body = smooth_path([(0, 0), (14, 60), (50, 126), (104, 176), (164, 202), (222, 198), (262, 172), (276, 140), (262, 122),
                        (240, 132), (214, 152), (182, 150), (158, 126), (150, 92), (160, 56), (190, 26), (240, 8), (300, 0)], tension=0.42)
    a.path(body, '#35A4EA')
    a.clip(body)
    for k, c in enumerate(['#1F6FD0', '#8AD0F7', '#1F6FD0', '#8AD0F7']):
        o = 16 + k * 17
        a.line([(o - 6, 0), (o + 14, 60), (o + 52, 118), (o + 104, 160), (o + 160, 176)], c, 6, smooth=True)
    a.unclip()
    # foam along the lip, with the claw-like fingers of the woodblock wave
    a.path(smooth_path([(104, 176), (164, 202), (222, 198), (262, 172), (276, 140), (262, 122), (252, 126), (258, 142), (246, 160),
                        (218, 176), (170, 180), (130, 168)], tension=0.42), '#FFFFFF')
    for (x, y, dx, dy) in [(262, 122), (246, 128), (228, 140), (208, 150)][:0]:
        pass
    for (x, y, r) in [(270, 118, 7), (256, 110, 6), (244, 120, 7), (230, 128, 6), (218, 140, 7), (204, 146, 6), (282, 104, 4.5), (268, 96, 4),
                      (250, 96, 3.5), (290, 120, 3.5), (236, 108, 3)]:
        a.circ(x, y, r, '#FFFFFF', sh=(r > 5))
    a.poly([(0, 0), (300, 0), (270, 12), (200, 18), (120, 12), (40, 16)], '#8FCDF5', smooth=False, sh=False)
    a.poly([(0, 0), (300, 0), (240, 7), (60, 7)], '#DDF3FF', sh=False, rim=False)


@spr('atoll', 0.22, 220, 130)
def _atoll(a):
    a.poly([(0, 0), (30, 16), (80, 26), (140, 26), (190, 16), (220, 0)], '#FFE2A0', smooth=True)
    for (x, hgt, lean) in [(70, 86, -8), (112, 104, 4), (150, 80, 12)]:
        a.line([(x, 18), (x + lean * 0.4, hgt * 0.55), (x + lean, hgt)], BROWN, 6, smooth=True, sh=True)
        for ang, c in [(-150, GREEN2), (-30, GREEN2), (160, GREEN), (20, GREEN), (95, LIME), (55, GREEN), (125, GREEN)]:
            r = math.radians(ang)
            x1, y1 = x + lean + math.cos(r) * 30, hgt + math.sin(r) * 24
            mx, my = x + lean + math.cos(r) * 16, hgt + math.sin(r) * 13 + 9
            a.poly([(x + lean, hgt), (mx - 3, my + 4), (x1, y1), (mx + 4, my - 5)], c, smooth=True)
    a.rect(24, 14, 26, 18, '#C98B4B', r=2)
    a.poly([(18, 30), (56, 30), (37, 50)], '#F2C057')
    a.poly([(0, 0), (220, 0), (190, 8), (30, 8)], '#5FD6D0', sh=False, rim=False)
