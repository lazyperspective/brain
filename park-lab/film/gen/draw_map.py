"""Top-down map of park.json -> ../plan/map.png (clean) and ../plan/map_labelled.png (numbered + legend)."""
import json, base64, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

P = json.load(open('../plan/park.json'))
S = SC = float(sys.argv[1]) if len(sys.argv) > 1 else 2.5   # px per metre
X0, X1, Z0, Z1 = -335, 335, -268, 318
W, H = int((X1 - X0) * S), int((Z1 - Z0) * S)
F = lambda x, z: ((x - X0) * S, (z - Z0) * S)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
fsmall = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


# ------------------------------------------------ terrain shading
g = P['terrain']['grid']
Hm = np.frombuffer(base64.b64decode(g['data']), dtype='<i2').reshape(g['nz'], g['nx']).astype(float) / 100
gy, gx = np.gradient(Hm, g['cell'])
light = np.array([-0.6, 0.6, 0.53]); light /= np.linalg.norm(light)
nrm = np.dstack([-gx, np.ones_like(Hm), -gy]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
shade = np.clip((nrm @ np.array([light[0], light[1], light[2]])), 0.3, 1.0)
base = np.zeros(Hm.shape + (3,))
grass = np.array([118, 168, 78]) / 255
dark = np.array([88, 138, 60]) / 255
base[:] = grass
base = base * (0.75 + 0.35 * shade[..., None])
base[Hm < -0.4] = np.array([70, 130, 170]) / 255
img_t = Image.fromarray((np.clip(base, 0, 1) * 255).astype('uint8'))
# crop/resize terrain grid onto the canvas
gx0, gz0, cell = g['x0'], g['z0'], g['cell']
box_px = (int((X0 - gx0) / cell), int((Z0 - gz0) / cell), int((X1 - gx0) / cell), int((Z1 - gz0) / cell))
img_t = img_t.resize((int(g['nx'] * cell * S), int(g['nz'] * cell * S)), Image.BILINEAR)
img = Image.new('RGBA', (W, H), (110, 160, 75, 255))
img.paste(img_t, (int((gx0 - X0) * S), int((gz0 - Z0) * S)))
# lawn stripes
st = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
for x in range(0, W, int(6 * S)):
    sd.rectangle([x, 0, x + int(3 * S), H], fill=(255, 255, 255, 10))
img = Image.alpha_composite(img, st)
d = ImageDraw.Draw(img, 'RGBA')


def poly(pts, fill=None, outline=None, width=1):
    if len(pts) < 3:
        return
    d.polygon([F(x, z) for x, z in pts], fill=fill, outline=outline, width=width)


def polys(lst, fill, outline=None, width=1, hole_fill=None):
    for p in lst:
        poly(p['outer'], fill, outline, width)
        for h in p['holes']:
            poly(h, hole_fill or (110, 160, 75, 255), outline, width)


# ------------------------------------------------ parking & backstage
pk = P['parking']
poly(pk['lot']['polygon'], hexc('#55585C'))
for z in pk['aisles_z']:
    for side in (-1, 1):
        zz = z + side * 5.6
        d.line([F(-228, zz), F(228, zz)], fill=(230, 230, 230, 120), width=1)
cols = pk['car_colors']
for x, z, rot, ci in pk['cars']['list']:
    cx, cz = F(x, z)
    d.rectangle([cx - 0.9 * S, cz - 2.2 * S, cx + 0.9 * S, cz + 2.2 * S], fill=hexc(cols[ci]))
for x, z in pk['tree_islands']:
    d.ellipse([*F(x - 5, z - 3), *F(x + 5, z + 3)], fill=(90, 140, 60, 255))
bs = P['backstage']
d.line([F(*p) for p in bs['service_road']['points']], fill=hexc('#8A8A84'), width=int(7 * S))
poly(bs['compound']['polygon'], hexc('#8A8A84'))
for b in bs['buildings']:
    x, _, z = b['position']
    d.rectangle([*F(x - b['w'] / 2, z - b['d'] / 2), *F(x + b['w'] / 2, z + b['d'] / 2)], fill=(150, 155, 160, 255), outline=(90, 90, 90, 255))

# ------------------------------------------------ water
for w in P['water']:
    col = (64, 140, 190, 255)
    if 'polygon' in w:
        if w['kind'] == 'island':
            poly(w['polygon'], (126, 172, 84, 255), (225, 210, 170, 255), 3)
        else:
            poly(w['polygon'], col, (220, 220, 210, 255), 2)
    if 'circle' in w:
        x, z, r = w['circle']; d.ellipse([*F(x - r, z - r), *F(x + r, z + r)], fill=col)
    if 'circles' in w:
        for x, z, r in w['circles']:
            d.ellipse([*F(x - r, z - r), *F(x + r, z + r)], fill=col)
    if 'annulus' in w:
        x, z, r0, r1 = w['annulus']
        d.ellipse([*F(x - r1, z - r1), *F(x + r1, z + r1)], fill=col)
        d.ellipse([*F(x - r0, z - r0), *F(x + r0, z + r0)], fill=(100, 160, 70, 255))

# ------------------------------------------------ paving
for pav, lst in P['paths']['paving_regions'].items():
    c = hexc(P['paths']['paving_types'][pav]['color'])
    polys(lst, c, None)
polys(P['paths']['kerbs']['outlines'], None, (90, 80, 70, 200), 1)
# lake rendering on top of anything? no.
# ------------------------------------------------ planting beds
pl = P['planting']
for b in pl['flower_beds']:
    c = hexc(b['mix'][0])
    if b['kind'] == 'circle':
        x, z, r = b['circle']; d.ellipse([*F(x - r, z - r), *F(x + r, z + r)], fill=c)
    elif b['kind'] == 'annulus':
        x, z, r0, r1 = b['annulus']
        for k in range(32):
            a0, a1 = k / 32 * 360, (k + 1) / 32 * 360
            d.pieslice([*F(x - r1, z - r1), *F(x + r1, z + r1)], a0, a1, fill=hexc(b['mix'][k % len(b['mix'])]))
        d.ellipse([*F(x - r0, z - r0), *F(x + r0, z + r0)], fill=(100, 160, 70, 255))
    elif b['kind'] == 'rect':
        x, z = b['center']; d.rectangle([*F(x - b['w'] / 2, z - b['d'] / 2), *F(x + b['w'] / 2, z + b['d'] / 2)], fill=c)
for s in pl['shrub_zones']:
    poly(s, (70, 120, 55, 200))
for h in pl['hedges']:
    d.line([F(*p) for p in h['points']] + [F(*h['points'][0])], fill=(50, 100, 45, 255), width=max(1, int(1.0 * S)))
# re-draw hub moat on top of beds
for w in P['water']:
    if 'annulus' in w:
        x, z, r0, r1 = w['annulus']
        d.ellipse([*F(x - r1, z - r1), *F(x + r1, z + r1)], outline=(64, 140, 190, 255), width=int((r1 - r0) * S))

# ------------------------------------------------ queues
for q in P['queues']:
    poly(q['polygon'], hexc('#CFC7B8'))
    for c in q['canopies']:
        pass
    for a, b in q['rails']:
        d.line([F(*a), F(*b)], fill=(80, 80, 80, 255), width=1)

# ------------------------------------------------ buildings & rides footprints
for b in P['buildings']:
    if b['kind'] in ('game_booth_rows', 'turnstiles'):
        for it in b['items']:
            x, _, z = it['position']
            w, dd = it['w'], it['d']
            col = hexc(it.get('awning', '#777777'))
            d.rectangle([*F(x - w / 2, z - dd / 2), *F(x + w / 2, z + dd / 2)], fill=col, outline=(60, 60, 60, 255))
        continue
    col = {'main_street_shop': b.get('wall', '#E8C9A0'), 'restroom': '#B7A99A', 'bandstand': '#FFFFFF', 'entrance_arch': '#B5563F',
           'ticket_booth': '#C8463A', 'railway_station': '#F3E6CC', 'frontier_building': '#A0522D', 'food_court': '#D7263D', 'water_tower': '#8B6B4A'}.get(b['kind'], '#C9B8A0')
    poly(b['footprint'], hexc(col), (50, 40, 35, 255), 1)
    if b['kind'] == 'main_street_shop':
        # roof ridge hint
        pass
ride_col = {'carousel': '#D7263D', 'teacups': '#F5A6C8', 'bumper_car_pavilion': '#2E294E', 'drop_tower': '#1F2A44', 'observation_tower': '#E2B33C',
            'ferris_wheel': '#FFFFFF', 'swing_ride': '#2E86C1', 'pirate_ship': '#8E5B3A', 'dark_ride_show_building': '#6E7F5E', 'kiddie_planes': '#A8D8EA',
            'kiddie_boats': '#A8D8EA', 'kiddie_trucks': '#FFE08A', 'kiddie_drop_tower': '#C3A6E0', 'playground': '#E7B8A6'}
for r in P['rides']:
    if r['type'] in ride_col:
        fp = r['footprint'] if isinstance(r['footprint'][0][0], (int, float)) else r['footprint'][0]
        a = 200 if r['type'] not in ('swing_ride',) else 120
        poly(fp, hexc(ride_col[r['type']], a), (40, 40, 40, 255), 1)
    if r['type'] == 'ferris_wheel':
        x, _, z = r['position']
        d.line([F(x - 22, z), F(x + 22, z)], fill=(240, 240, 240, 255), width=int(3 * S))
    if r['type'] in ('carousel', 'teacups'):
        x, _, z = r['position']; rr = r['params'].get('radius', r['params'].get('platform_radius', 9))
        for k in range(12):
            a = k / 12 * 2 * math.pi
            d.line([F(x, z), F(x + math.cos(a) * rr, z + math.sin(a) * rr)], fill=(255, 244, 224, 255), width=1)
    if r['type'] in ('steel_looping_coaster', 'wooden_out_and_back_coaster', 'family_coaster', 'log_flume', 'river_rapids') and 'station' in r:
        st = r['station']
        x, z = st['center']
        d.rectangle([*F(x - st['w'] / 2, z - st['d'] / 2), *F(x + st['w'] / 2, z + st['d'] / 2)], fill=(90, 90, 110, 140), outline=(40, 40, 40, 255))

# ------------------------------------------------ trees
sp = pl['species']
trees = sorted(pl['trees']['list'], key=lambda t: t[1] + t[4])
for x, gy_, z, si, h, cr, cv in trees:
    c = hexc(sp[si]['colors'][cv])
    sx, sz = F(x, z)
    r = max(1.5, cr * S)
    d.ellipse([sx - r + 2, sz - r + 2, sx + r + 2, sz + r + 2], fill=(30, 50, 25, 90))
    d.ellipse([sx - r, sz - r, sx + r, sz + r], fill=c)
    d.ellipse([sx - r * 0.6, sz - r * 0.7, sx + r * 0.1, sz - r * 0.0], fill=(255, 255, 255, 40))
for t_ in pl['topiary']:
    x, _, z = t_['position']; d.ellipse([*F(x - 1.2, z - 1.2), *F(x + 1.2, z + 1.2)], fill=(40, 110, 50, 255))

# ------------------------------------------------ tracks
track_cols = {'hero_coaster': '#E23B2E', 'wooden_coaster': '#7A4E2A', 'family_coaster': '#2BB3A3', 'log_flume': '#7FC8E8', 'river_rapids': '#3E8EC4', 'railway': '#3B3B3B'}
for tid, t in P['tracks'].items():
    pos = np.array(t['pos']).reshape(-1, 3)
    if tid == 'wooden_coaster':
        for b in t['bents']:
            x, y, z = b['top']; ax, az = b['axis']; bw = b['base_width'] / 2
            d.line([F(x - ax * bw, z - az * bw), F(x + ax * bw, z + az * bw)], fill=(205, 170, 120, 255), width=1)
    if 'supports' in t:
        for s_ in t['supports']:
            x, y, z = s_['base']; r_ = 0.9
            d.ellipse([*F(x - r_, z - r_), *F(x + r_, z + r_)], fill=(245, 235, 217, 255), outline=(80, 80, 80, 255))
    width = {'river_rapids': 7.0, 'log_flume': 1.8, 'railway': 2.2}.get(tid, 1.4)
    col = hexc(track_cols[tid])
    pts = [F(p[0], p[2]) for p in pos[::2]]
    # draw in order of height so higher sections are on top
    order = np.argsort(pos[::2, 1])
    segs = list(zip(pts[:-1], pts[1:], pos[::2, 1][:-1]))
    for i in sorted(range(len(segs)), key=lambda i: segs[i][2]):
        a, b, hgt = segs[i]
        shade_ = int(min(60, hgt * 1.3))
        c = (min(255, col[0] + shade_), min(255, col[1] + shade_), min(255, col[2] + shade_), 255)
        d.line([a, b], fill=(30, 30, 30, 120), width=max(1, int(width * S) + 2))
        d.line([a, b], fill=c, width=max(1, int(width * S)))

# ------------------------------------------------ props
pr = P['props']
for x, y, z, stl in pr['lamps']['list']:
    sx, sz = F(x, z); d.ellipse([sx - 1.6, sz - 1.6, sx + 1.6, sz + 1.6], fill=(30, 50, 40, 255))
for x, y, z, rot in pr['benches']['list']:
    sx, sz = F(x, z); d.rectangle([sx - 2, sz - 1, sx + 2, sz + 1], fill=(120, 80, 50, 255))
for x, y, z, dia, col, pat in pr['umbrella_tables']['list']:
    sx, sz = F(x, z); r = dia / 2 * S; d.ellipse([sx - r, sz - r, sx + r, sz + r], fill=hexc(col), outline=(80, 80, 80, 255))
for x, y, z, tp, rot in pr['carts']['list']:
    sx, sz = F(x, z); d.rectangle([sx - 3, sz - 2, sx + 3, sz + 2], fill=(240, 200, 60, 255), outline=(60, 60, 60, 255))
for b in pr['bunting']['list']:
    d.line([F(b['a'][0], b['a'][2]), F(b['b'][0], b['b'][2])], fill=(220, 60, 60, 160), width=1)
for f in pr['fences']:
    d.line([F(*p) for p in f['points']], fill=(70, 70, 70, 200), width=1)
# ------------------------------------------------ guests
G = P['guests']
cl = G['clothes_palette']
edges = {e['id']: e for e in P['paths']['edges']}
from shapely.geometry import LineString
lines = {k: LineString(e['points']) for k, e in edges.items()}
for eid, u0, dr, spd, lat, ci, child in G['walkers']['list']:
    ls = lines[eid]; p = ls.interpolate(u0, normalized=True); p2 = ls.interpolate(min(1, u0 + 0.01), normalized=True)
    dx, dz = p2.x - p.x, p2.y - p.y; n = math.hypot(dx, dz) or 1
    x, z = p.x - dz / n * lat, p.y + dx / n * lat
    sx, sz = F(x, z); d.ellipse([sx - 1.1, sz - 1.1, sx + 1.1, sz + 1.1], fill=hexc(cl[ci]))
for x, z, hd, ci, child, bal in G['idlers']['list']:
    sx, sz = F(x, z); d.ellipse([sx - 1.1, sz - 1.1, sx + 1.1, sz + 1.1], fill=hexc(cl[ci]))
for qid, x, z, j, ci, child in G['queued']['list']:
    sx, sz = F(x, z); d.ellipse([sx - 1.0, sz - 1.0, sx + 1.0, sz + 1.0], fill=hexc(cl[ci]))

img.convert('RGB').save('../plan/map.png', optimize=True)
print('map.png', W, H)

# ------------------------------------------------ labelled copy
lab = img.copy()
dl = ImageDraw.Draw(lab, 'RGBA')
legend = []


def label(x, z, text):
    n = len(legend) + 1
    legend.append((n, text))
    sx, sz = F(x, z)
    dl.ellipse([sx - 11, sz - 11, sx + 11, sz + 11], fill=(20, 20, 30, 230), outline=(255, 255, 255, 255), width=2)
    dl.text((sx, sz), str(n), font=fsmall, fill=(255, 255, 255, 255), anchor='mm')


for r in P['rides']:
    x, _, z = r['position']
    if r['id'] == 'lake_boats':
        x, z = -205, 60
    label(x, z, '%s (%s)' % (r.get('name', r['id']), r['type']))
for b in P['buildings']:
    if b['kind'] in ('main_street_shop',):
        continue
    x, _, z = b['position']
    label(x, z, b['id'])
label(0, 75, 'Main Street (%d facades)' % sum(1 for b in P['buildings'] if b['kind'] == 'main_street_shop'))
label(0, 250, 'Car park (%d cars)' % len(pk['cars']['list']))
label(150, -244, 'Backstage compound')
for q in P['queues']:
    x, z = q['center']; label(x, z, 'queue %s' % q['id'])
for L in P['lands' if 'lands' in P else 'rides'][:0]:
    pass
# land names
fland = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
LPOS = {'entrance': (0, 198), 'main_street': (0, 100), 'hub': (0, -30), 'kiddie': (-95, 120), 'seaside': (-215, 120), 'jungle': (-200, -60),
        'thrill': (60, -95), 'frontier': (245, 130), 'midway': (150, 128)}
for L_ in P.get('lands', []):
    x, z = LPOS[L_['id']]
    sx, sz = F(x, z)
    dl.text((sx, sz), L_['name'].upper(), font=fland, fill=(255, 255, 255, 255), anchor='mm', stroke_width=3, stroke_fill=(30, 30, 40, 255))
# legend panel
lines_ = ['%2d  %s' % (n, t) for n, t in legend]
ncol = 2
rows = math.ceil(len(lines_) / ncol)
pw = 560 * ncol
panel = Image.new('RGBA', (pw, max(H, rows * 17 + 60)), (250, 247, 240, 255))
pd = ImageDraw.Draw(panel)
pd.text((14, 12), 'Legend (north up; 1 grid = 50 m)', font=font, fill=(20, 20, 20, 255))
for i, l in enumerate(lines_):
    c, r_ = divmod(i, rows)
    pd.text((14 + c * 560, 40 + r_ * 17), l, font=fsmall, fill=(20, 20, 20, 255))
for gx_ in range(-300, 301, 50):
    dl.line([F(gx_, Z0), F(gx_, Z1)], fill=(255, 255, 255, 40))
for gz_ in range(-250, 301, 50):
    dl.line([F(X0, gz_), F(X1, gz_)], fill=(255, 255, 255, 40))
    dl.text(F(X0 + 2, gz_), 'z=%d' % gz_, font=fsmall, fill=(255, 255, 255, 200))
for gx_ in range(-300, 301, 100):
    dl.text(F(gx_, Z0 + 3), 'x=%d' % gx_, font=fsmall, fill=(255, 255, 255, 200))
out = Image.new('RGBA', (W + pw, max(H, panel.height)), (250, 247, 240, 255))
out.paste(lab, (0, 0)); out.paste(panel, (W, 0))
out.convert('RGB').save('../plan/map_labelled.png', optimize=True)
print('map_labelled.png')
