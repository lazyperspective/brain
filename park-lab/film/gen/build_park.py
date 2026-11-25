"""Build the film park master plan -> ../plan/park.json

Run:  cd film/gen && python3 build_park.py
Everything is deterministic (seeded).
"""
import json, math, base64, sys
import numpy as np
from shapely.geometry import Polygon, LineString, Point, MultiPolygon, box
from shapely.ops import unary_union
from shapely import affinity
from shapely.prepared import prep

import coasters
from layout import *

rng = np.random.default_rng(20261125)
R = lambda a: round(float(a), 3)
OUT = '../plan/park.json'
REPORT = []


def warn(msg):
    REPORT.append(msg)


# =====================================================================================
# geometry helpers
def rounded_poly(pts, r):
    p = Polygon(pts)
    if r:
        p = p.buffer(-r, join_style=2).buffer(r, resolution=8)
    return p


def plaza_geom(spec):
    if 'circle' in spec:
        x, z, rr = spec['circle']
        g = Point(x, z).buffer(rr, resolution=24)
        if spec.get('hole'):
            g = g.difference(Point(x, z).buffer(spec['hole'], resolution=24))
        return g
    return rounded_poly(spec['poly'], spec.get('round', 0))


def poly_to_list(g):
    """shapely (Multi)Polygon -> list of {outer:[[x,z]..], holes:[[..]]}"""
    out = []
    geoms = g.geoms if hasattr(g, 'geoms') else [g]
    for p in geoms:
        if p.is_empty or p.area < 0.5:
            continue
        out.append({'outer': [[R(x), R(z)] for x, z in list(p.exterior.coords)[:-1]],
                    'holes': [[[R(x), R(z)] for x, z in list(h.coords)[:-1]] for h in p.interiors]})
    return out


def rect(cx, cz, w, d, rot=0.0):
    """w along local x, d along local z, rotated by rot (our convention)."""
    p = box(-w / 2, -d / 2, w / 2, d / 2)
    # our rot: local +z -> (sin rot, cos rot); shapely rotate is CCW in x-y plane.
    # local x -> (cos rot, -sin rot)
    p = affinity.affine_transform(p, [math.cos(rot), math.sin(rot), -math.sin(rot), math.cos(rot), cx, cz])
    return p


def node_xy(n):
    return NODES[n] if isinstance(n, str) else n


def polyline_len(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def resample(pts, step):
    pts = [np.array(p, float) for p in pts]
    L = polyline_len(pts)
    n = max(1, int(L / step))
    out = []
    ls = LineString(pts)
    for i in range(n + 1):
        q = ls.interpolate(L * i / n)
        out.append((q.x, q.y))
    return out


def chaikin(pts, it=2):
    pts = [tuple(p) for p in pts]
    for _ in range(it):
        new = [pts[0]]
        for i in range(len(pts) - 1):
            a, b = np.array(pts[i]), np.array(pts[i + 1])
            new += [tuple(0.75 * a + 0.25 * b), tuple(0.25 * a + 0.75 * b)]
        new.append(pts[-1])
        pts = new
    return pts


# =====================================================================================
# 1. terrain
def berm_dist(x, z):
    """signed distance from the berm centreline (rounded rectangle)."""
    X, Z0, Z1, Rr = BERM['x'], BERM['z0'], BERM['z1'], BERM['r']
    cx, cz = 0.0, (Z0 + Z1) / 2
    hx, hz = X - Rr, (Z1 - Z0) / 2 - Rr
    qx = np.abs(x - cx) - hx
    qz = np.abs(z - cz) - hz
    outside = np.hypot(np.maximum(qx, 0), np.maximum(qz, 0)) + np.minimum(np.maximum(qx, qz), 0)
    return outside - Rr   # 0 on centreline, negative inside


def noise2(x, z, scale, seed):
    # cheap value noise via sums of sines (deterministic, smooth)
    r = np.random.default_rng(seed)
    acc = 0
    for k in range(5):
        ax, az, ph = r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(0, 6.28)
        f = (1.6 ** k) / scale
        acc = acc + np.sin((ax * x + az * z) * f + ph) / (1.5 ** k)
    return acc / 2.2


TERRAIN_FEATURES = {
    'berm': {'centreline': 'rounded rectangle x=+-290, z=-200..160, corner r=60', 'height': 5.0, 'crest_width': 8.0,
             'base_half_width': 16.5, 'note': 'railway runs on the crest; cut at the gate (x=-8..8) where the railway crosses on a bridge'},
    'hills': [
        {'id': 'jungle_rock', 'x': -218, 'z': -128, 'height': 14.0, 'radius': 24, 'style': 'rock mountain with waterfall, rockwork faces, palms'},
        {'id': 'frontier_mesa', 'x': 214, 'z': -160, 'height': 6.0, 'radius': 22, 'style': 'dusty red mesa with pines, behind the coaster turnaround'},
        {'id': 'kiddie_knoll', 'x': -122, 'z': 128, 'height': 2.0, 'radius': 12, 'style': 'grassy picnic knoll'},
        {'id': 'hub_screen_w', 'x': -60, 'z': -6, 'height': 1.6, 'radius': 14, 'style': 'planted mound'},
        {'id': 'hub_screen_e', 'x': 66, 'z': -26, 'height': 1.6, 'radius': 14, 'style': 'planted mound'},
    ],
    'lake': {'water_level': -0.5, 'depth': 2.0},
}


def build_terrain(paved_union, water_union):
    cell = 2.0
    xs = np.arange(SITE['xmin'], SITE['xmax'] + 0.01, cell)
    zs = np.arange(SITE['zmin'], SITE['zmax'] + 0.01, cell)
    X, Z = np.meshgrid(xs, zs)
    d = berm_dist(X, Z)
    hb = BERM['height']
    a = np.abs(d)
    crest = BERM['crest'] / 2
    t = np.clip((a - crest) / (BERM['base_half'] - crest), 0, 1)
    berm = hb * (1 - (t * t * (3 - 2 * t)))
    berm += np.where((a > crest) & (a < BERM['base_half']), 0.35 * noise2(X, Z, 30, 3) * (1 - t) * t * 4, 0)
    # gate cut
    cut = (np.abs(X) < 9.0) & (Z > 140) & (Z < 180)
    berm = np.where(cut, 0, berm)
    H = berm
    for hdef in TERRAIN_FEATURES['hills']:
        r2 = ((X - hdef['x']) ** 2 + (Z - hdef['z']) ** 2) / hdef['radius'] ** 2
        bump = hdef['height'] * np.exp(-1.6 * r2) * (1 + 0.15 * noise2(X, Z, 12, 7))
        H = np.maximum(H, bump)
    # lake basin
    lake = Polygon(LAKE)
    pl = prep(lake.buffer(6))
    for j in range(len(zs)):
        for i in range(len(xs)):
            x, z = xs[i], zs[j]
            if pl.contains(Point(x, z)):
                dd = lake.exterior.distance(Point(x, z))
                inside = lake.contains(Point(x, z))
                if inside:
                    H[j, i] = -0.5 - min(2.0, dd / 6.0)
                else:
                    H[j, i] = min(H[j, i], -0.5 + dd / 6 * 0.5)
    # paths are flat at y=0 (except berm cut already)
    pp = prep(paved_union.buffer(1.5))
    inside_berm = d < -BERM['base_half'] + 0.5
    for j in range(len(zs)):
        for i in range(len(xs)):
            if H[j, i] > 0.01 and pp.contains(Point(xs[i], zs[j])) and inside_berm[j, i]:
                H[j, i] = 0.0
    return xs, zs, H


# =====================================================================================
# 2. tracks
def bake_track(t, extra=None):
    P, T, U = t.Parr, t.Tarr, t.Uarr
    tags = list(dict.fromkeys(t.tags))
    tag_idx = [tags.index(x) for x in t.tags]
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    v = t.v
    tt = np.concatenate([[0], np.cumsum(np.diff(s) / np.maximum(0.5 * (v[1:] + v[:-1]), 0.05))])
    segs = []
    cur = None
    for i, tg in enumerate(t.tags):
        if cur is None or cur['tag'] != tg:
            if cur:
                cur['s1'] = R(s[i])
                segs.append(cur)
            cur = {'tag': tg, 's0': R(s[i])}
    cur['s1'] = R(s[-1])
    segs.append(cur)
    d = {
        'length': R(s[-1]), 'ds': 0.5, 'n': len(P), 'closed': True,
        'cycle_time': R(tt[-1]),
        'tags': tags, 'segments': segs,
        's': [R(x) for x in s],
        'pos': [R(x) for x in P.flatten()],
        'tangent': [round(float(x), 4) for x in T.flatten()],
        'up': [round(float(x), 4) for x in U.flatten()],
        'tag': tag_idx,
        'speed': [round(float(x), 2) for x in v],
        'time': [R(x) for x in tt],
    }
    if extra:
        d.update(extra)
    return d


def track_supports(t, ride_id, avoid, spacing=7.0, min_h=2.2, kind='column', terrain=None, heavy_tags=(), start_s=0.0):
    """Supports: columns from the track spine down to footers on terrain; skip inverted points;
    nudge along s to avoid paths/buildings/water."""
    P, U, T = t.Parr, t.Uarr, t.Tarr
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    L = s[-1]
    out = []
    sk = start_s
    av = prep(avoid)
    while sk < L:
        placed = False
        for off in [0, 1.0, -1.0, 2.0, -2.0, 3.0, -3.0]:
            sq = sk + off
            if sq < 0 or sq >= L:
                continue
            i = int(np.searchsorted(s, sq))
            i = min(i, len(P) - 1)
            p, u = P[i], U[i]
            if u[1] < 0.45:
                break
            spine = p - u * 0.9
            gx, gz = spine[0], spine[2]
            g = terrain(gx, gz) if terrain else 0.0
            h = spine[1] - g
            if h < min_h:
                break
            if av.contains(Point(gx, gz)):
                continue
            tag = t.tags[i]
            out.append({'s': R(sq), 'top': [R(spine[0]), R(spine[1]), R(spine[2])], 'base': [R(gx), R(g), R(gz)],
                        'height': R(h), 'type': ('lattice_tower' if tag in heavy_tags else kind),
                        'diameter': R(0.6 + min(h, 45) * 0.012)})
            placed = True
            break
        if not placed:
            # check if we needed one here but could not place
            i = min(int(np.searchsorted(s, sk)), len(P) - 1)
            p, u = P[i], U[i]
            if u[1] >= 0.45 and (p[1] - 0.9 - (terrain(p[0], p[2]) if terrain else 0)) > min_h:
                warn('%s: no support near s=%.1f (%.1f,%.1f) h=%.1f -> spans over obstacle' % (ride_id, sk, p[0], p[2], p[1]))
        sk += spacing if t.tags[min(int(np.searchsorted(s, sk)), len(P) - 1)] not in heavy_tags else spacing * 0.8
    return out


def wooden_bents(t, avoid, terrain, spacing=2.4):
    P, U = t.Parr, t.Uarr
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    out = []
    av = prep(avoid)
    sk = 0.0
    while sk < s[-1]:
        i = min(int(np.searchsorted(s, sk)), len(P) - 1)
        p = P[i]
        g = terrain(p[0], p[2])
        h = p[1] - 0.6 - g
        if h > 1.0:
            # bent axis is perpendicular to tangent (horizontal)
            tx, tz = t.Tarr[i][0], t.Tarr[i][2]
            n = math.hypot(tx, tz) or 1
            out.append({'s': R(sk), 'top': [R(p[0]), R(p[1] - 0.6), R(p[2])], 'ground': R(g), 'height': R(h),
                        'base_width': R(2.6 + 0.35 * h), 'top_width': 2.6,
                        'axis': [R(-tz / n), R(tx / n)],
                        'blocked': bool(av.contains(Point(p[0], p[2])))})
        sk += spacing
    return out


# =====================================================================================
def main():
    import time
    t0 = time.time()
    park = {'meta': {
        'name': 'film park master plan', 'version': 1,
        'units': 'metres', 'axes': 'x east, y up, z south; ground y=0; gate in the south (z~+180), park extends north (z negative)',
        'rotation_convention': 'rot (radians) about +y; object local +z (its FRONT) points along world (sin rot, 0, cos rot). rot=0 faces south/camera, pi faces north, +pi/2 faces east, -pi/2 faces west',
        'site': SITE, 'park_bounds_inside_berm': {'xmin': -273, 'xmax': 273, 'zmin': -183, 'zmax': 143},
    }}

    # ---------------------------------------------------------------- lands
    lands = []
    land_geoms = {}
    for L in LANDS:
        g = Point(L['circle'][0], L['circle'][1]).buffer(L['circle'][2]) if 'circle' in L else Polygon(L['poly'])
        land_geoms[L['id']] = g
        d = {k: v for k, v in L.items() if k not in ('poly', 'circle')}
        d['region'] = poly_to_list(g)
        lands.append(d)

    park['lands'] = lands

    def land_at(x, z):
        if land_geoms['hub'].contains(Point(x, z)):
            return 'hub'
        for L in LANDS:
            if L['id'] != 'hub' and land_geoms[L['id']].contains(Point(x, z)):
                return L['id']
        return 'outside'

    # ---------------------------------------------------------------- paths
    nodes = {k: [R(v[0]), R(v[1])] for k, v in NODES.items()}
    edges = []
    path_geoms_by_paving = {}
    walk = []
    for k, (a, b, w, pav, cls, mids) in enumerate(EDGES):
        pa, pb = node_xy(a), node_xy(b)
        pts = [pa] + list(mids) + [pb]
        if pav in ('flagstone', 'packed_earth', 'boardwalk', 'stamped_pastel') and len(pts) > 2:
            pts = chaikin(pts, 2)
        eid = 'e%02d' % k
        if not isinstance(a, str):
            nid = 'end_%s_a' % eid; nodes[nid] = [R(pa[0]), R(pa[1])]; a = nid
        if not isinstance(b, str):
            nid = 'end_%s_b' % eid; nodes[nid] = [R(pb[0]), R(pb[1])]; b = nid
        ls = LineString(pts)
        g = ls.buffer(w / 2, cap_style=1 if cls not in ('main',) else 2, join_style=1, resolution=8)
        path_geoms_by_paving.setdefault(pav, []).append(g)
        walk.append(g)
        edges.append({'id': eid, 'a': a, 'b': b, 'width': w, 'paving': pav, 'class': cls,
                      'points': [[R(x), R(z)] for x, z in pts], 'length': R(ls.length), 'land': land_at(*ls.interpolate(0.5, normalized=True).coords[0])})
    plazas = []
    for pid, (pav, spec) in PLAZAS.items():
        g = plaza_geom(spec)
        path_geoms_by_paving.setdefault(pav, []).append(g)
        walk.append(g)
        plazas.append({'id': pid, 'paving': pav, 'polygon': poly_to_list(g), 'centroid': [R(g.centroid.x), R(g.centroid.y)], 'area': R(g.area)})

    # rides, buildings, queues are defined in park_objects.py (needs path union first)
    from park_objects import build_objects
    walk_union = unary_union(walk)
    objs = build_objects(walk_union, land_at)
    # ride exit paths become real edges (class 'exit')
    land_pav = {'thrill': 'asphalt_tinted', 'frontier': 'packed_earth', 'kiddie': 'stamped_pastel', 'jungle': 'flagstone', 'seaside': 'boardwalk', 'midway': 'checker'}
    for r in objs['rides']:
        if 'exit_path' in r:
            pts = [tuple(p) for p in r['exit_path']]
            pav = land_pav.get(r.get('land'), 'asphalt_tinted')
            eid = 'x_%s' % r['id']
            nodes['exit_%s_a' % r['id']] = [R(pts[0][0]), R(pts[0][1])]
            nodes['exit_%s_b' % r['id']] = [R(pts[-1][0]), R(pts[-1][1])]
            ls = LineString(pts)
            g = ls.buffer(1.75, resolution=6)
            path_geoms_by_paving.setdefault(pav, []).append(g)
            edges.append({'id': eid, 'a': 'exit_%s_a' % r['id'], 'b': 'exit_%s_b' % r['id'], 'width': 3.5, 'paving': pav, 'class': 'exit',
                          'points': [[R(x), R(z)] for x, z in pts], 'length': R(ls.length), 'land': r.get('land', '')})
            r['exit_edge'] = eid
    # queue pens add paved area (queue_concrete)
    for q in objs['queues']:
        path_geoms_by_paving.setdefault('queue_concrete', []).append(Polygon(q['_poly']))
    # paving priority: later wins
    priority = ['service', 'asphalt_grey', 'concrete_plaza', 'asphalt_tinted', 'flagstone', 'packed_earth', 'stamped_pastel',
                'checker', 'boardwalk', 'brick_herringbone', 'setts_radial', 'queue_concrete']
    paving_regions = {}
    taken = Polygon()
    for pav in reversed(priority):
        if pav not in path_geoms_by_paving:
            continue
        g = unary_union(path_geoms_by_paving[pav]).difference(taken)
        taken = taken.union(g)
        paving_regions[pav] = g
    all_paved = unary_union(list(paving_regions.values()))
    # car park & service roads defined in objects
    park['paths'] = {
        'paving_types': PAVING,
        'nodes': nodes, 'edges': edges, 'plazas': plazas,
        'paving_regions': {k: poly_to_list(v) for k, v in paving_regions.items()},
        'kerbs': {'note': 'kerb = outline of the union of all paved guest areas; 0.12 m high granite (0.3 m wide) except boardwalk (timber edge) and packed_earth (log edge)',
                  'outlines': poly_to_list(all_paved)},
        'paving_priority_note': 'regions are already non-overlapping; draw in any order',
    }

    # ---------------------------------------------------------------- terrain
    island = Polygon([w for w in objs['water'] if w['id'] == 'gull_island'][0]['polygon'])
    water_union = Polygon(LAKE).difference(island)
    xs, zs, H = build_terrain(all_paved.union(objs['_hard_union']), water_union)

    def terrain_h(x, z):
        i = (x - xs[0]) / (xs[1] - xs[0]); j = (z - zs[0]) / (zs[1] - zs[0])
        i0 = int(np.clip(math.floor(i), 0, len(xs) - 2)); j0 = int(np.clip(math.floor(j), 0, len(zs) - 2))
        fi, fj = i - i0, j - j0
        return float((H[j0, i0] * (1 - fi) + H[j0, i0 + 1] * fi) * (1 - fj) + (H[j0 + 1, i0] * (1 - fi) + H[j0 + 1, i0 + 1] * fi) * fj)

    Hc = np.round(H * 100).astype('<i2')
    park['terrain'] = {
        'features': TERRAIN_FEATURES,
        'grid': {'x0': float(xs[0]), 'z0': float(zs[0]), 'cell': 2.0, 'nx': len(xs), 'nz': len(zs),
                 'encoding': 'base64 little-endian int16, centimetres, row-major (z rows, x columns)',
                 'data': base64.b64encode(Hc.tobytes()).decode()},
        'default_ground': 'grass (mown stripes on lawns), per-land tint in lands[].palette.ground for paths',
    }
    park['water'] = [{'id': 'lake', 'kind': 'lake', 'level': -0.5, 'polygon': [[R(x), R(z)] for x, z in LAKE],
                      'edge': 'stone coping 0.4 m on the east (promenade) shore, sandy beach on the west, reeds on the south-west'}]
    park['water'] += objs['water']

    # ---------------------------------------------------------------- tracks
    obstacles = unary_union([all_paved.buffer(1.0), objs['_hard_union'], water_union.buffer(1.0)])
    tracks = {}
    T_hero = coasters.BUILD['hero']()
    T_wood = coasters.BUILD['wooden']()
    T_fam = coasters.BUILD['family']()
    T_flume = coasters.BUILD['flume']()
    T_rap = coasters.BUILD['rapids']()
    T_rail = coasters.BUILD['railway']()
    hero_sup = track_supports(T_hero, 'hero_coaster', obstacles, spacing=7.5, terrain=terrain_h, heavy_tags=('lift', 'crest'))
    fam_sup = track_supports(T_fam, 'family_coaster', obstacles, spacing=5.0, min_h=1.6, terrain=terrain_h, heavy_tags=('lift',))
    flume_sup = track_supports(T_flume, 'log_flume', obstacles, spacing=4.0, min_h=1.2, kind='timber_trestle', terrain=terrain_h, heavy_tags=('lift',))
    wood_b = wooden_bents(T_wood, obstacles, terrain_h)
    for b in wood_b:
        if b['blocked']:
            warn('wooden_coaster bent at s=%.0f lands on obstacle' % b['s'])
    tracks['hero_coaster'] = bake_track(T_hero, {'supports': hero_sup})
    tracks['wooden_coaster'] = bake_track(T_wood, {'bents': wood_b})
    tracks['family_coaster'] = bake_track(T_fam, {'supports': fam_sup})
    tracks['log_flume'] = bake_track(T_flume, {'supports': flume_sup, 'trough_width': 1.6, 'trough_depth': 0.9})
    tracks['river_rapids'] = bake_track(T_rap, {'channel_width': 7.0, 'channel_depth': 1.2})
    tracks['railway'] = bake_track(T_rail, {'gauge': 0.914})
    park['tracks'] = tracks

    # ---------------------------------------------------------------- objects
    for k in ('rides', 'buildings', 'queues', 'props', 'planting', 'parking', 'backstage', 'lighting_rigs'):
        if k in objs:
            park[k] = objs[k]

    # ---------------------------------------------------------------- planting & props & guests (need tracks)
    from planting import build_planting, build_props, build_guests
    track_corr = []
    for name, t in [('hero', T_hero), ('wood', T_wood), ('fam', T_fam), ('flume', T_flume), ('rap', T_rap), ('rail', T_rail)]:
        P = t.Parr
        pts = [(p[0], p[2]) for p in P[::4]] + [(P[0][0], P[0][2])]
        w = {'hero': 9, 'wood': 10, 'fam': 5, 'flume': 4, 'rap': 7, 'rail': 4}[name]
        track_corr.append(LineString(pts).buffer(w))
    track_corr = unary_union(track_corr)
    park['planting'] = build_planting(all_paved, objs, water_union, track_corr, land_at, terrain_h, rng)
    park['props'] = build_props(edges, plazas, objs, all_paved, land_at, rng, track_corr)
    park['guests'] = build_guests(edges, plazas, objs, all_paved, rng)

    # ---------------------------------------------------------------- conventions
    park['lighting'] = {
        'sun_day': {'azimuth_deg': 225, 'elevation_deg': 38,
                    'direction_to_sun': [R(-math.sin(math.radians(45)) * math.cos(math.radians(38))), R(math.sin(math.radians(38))), R(math.cos(math.radians(45)) * math.cos(math.radians(38)))],
                    'color': '#FFF1DC', 'note': 'sun in the SOUTH-WEST, behind-left of a camera looking north from the gate; shadows fall north-east'},
        'sky_fill': '#BFD9FF', 'ground_bounce': '#9DBF7A',
        'dusk': {'sun_azimuth_deg': 260, 'elevation_start_deg': 12, 'elevation_end_deg': -8, 'note': 'tilt-shift finale: sun sets in the WEST'},
        'night': {'moon': [-0.3, 0.8, -0.5], 'ambient': '#1C2340', 'bulb_warm': '#FFC76B', 'bulb_cool': '#9FE3FF'},
    }
    park['animation'] = objs['animation']
    for q in park['queues']:
        q.pop('_poly', None)
    park['validation'] = validate(park, objs, all_paved, water_union, T_hero, T_wood, T_fam, T_flume, T_rap, T_rail, terrain_h) + REPORT
    with open(OUT, 'w') as f:
        json.dump(park, f, separators=(',', ':'))
    print('wrote', OUT, '%.1f MB' % (len(json.dumps(park, separators=(',', ':'))) / 1e6), 'in %.1fs' % (time.time() - t0))
    for r in park['validation']:
        print('  -', r)


def validate(park, objs, paved, water, *tracks_and_terrain):
    *tracks, terrain_h = tracks_and_terrain
    names = ['hero', 'wooden', 'family', 'flume', 'rapids', 'railway']
    msgs = []
    pp = prep(paved)
    hard = prep(objs['_hard_union'])
    # 1. track clearance over paths & ground
    for name, t in zip(names, tracks):
        P = t.Parr
        bad_path, bad_ground = [], []
        own = prep(objs['_ride_fp'].get({'hero': 'hero_coaster', 'wooden': 'wooden_coaster', 'family': 'family_coaster', 'flume': 'log_flume', 'rapids': 'river_rapids', 'railway': 'railway'}[name], Polygon()))
        for i in range(0, len(P), 2):
            x, y, z = P[i]
            g = terrain_h(x, z)
            pt = Point(x, z)
            if name not in ('railway', 'rapids', 'flume') and y - g < 0.6 and t.tags[i] not in ('station',):
                bad_ground.append(i)
            if pp.contains(pt) and not own.contains(pt):
                clearance = min(y, y + 1.6 * t.Uarr[i][1]) - 0 - 1.2
                if name == 'railway':
                    continue
                if clearance < 4.0:
                    bad_path.append((round(x), round(z), round(y, 1)))
        if bad_ground:
            msgs.append('%s: %d samples below 0.6 m ground clearance' % (name, len(bad_ground)))
        if bad_path:
            msgs.append('%s: crosses paths with low clearance at %s' % (name, bad_path[:6]))
    # 2. track-track proximity (3D) between different tracks, and self (non-adjacent)
    from scipy.spatial import cKDTree
    for a in range(len(tracks)):
        for b in range(a, len(tracks)):
            Pa, Pb = tracks[a].Parr[::2], tracks[b].Parr[::2]
            tr = cKDTree(Pb)
            dmin = 3.5 if names[a] != 'rapids' and names[b] != 'rapids' else 5.0
            pairs = tr.query_ball_point(Pa, dmin)
            hits = []
            for i, js in enumerate(pairs):
                for j in js:
                    if a == b:
                        sa, sb = i * 2, j * 2
                        n = len(tracks[a].Parr)
                        if min(abs(sa - sb), n - abs(sa - sb)) < 40:   # within 20 m along track
                            continue
                    hits.append((round(Pa[i][0]), round(Pa[i][2]), round(Pa[i][1], 1)))
            if hits:
                msgs.append('%s x %s: %d close points (<%.1f m), e.g. %s' % (names[a], names[b], len(hits), dmin, hits[:4]))
    # 3. supports on obstacles
    for rid in ('hero_coaster', 'family_coaster', 'log_flume'):
        bad = [s for s in park['tracks'][rid]['supports'] if pp.contains(Point(s['base'][0], s['base'][2]))]
        if bad:
            msgs.append('%s: %d supports on paths' % (rid, len(bad)))
    # 4. tracks over buildings
    for name, t in zip(names, tracks):
        for bid, (bp, bh) in objs['_building_fp'].items():
            P = t.Parr
            pr = prep(bp)
            for i in range(0, len(P), 3):
                if pr.contains(Point(P[i][0], P[i][2])) and P[i][1] < bh + 3 and not bid.startswith(name):
                    msgs.append('%s passes through building %s at (%.0f,%.0f,%.1f)' % (name, bid, P[i][0], P[i][2], P[i][1]))
                    break
    # 5. buildings over paths
    for bid, (bp, bh) in objs['_building_fp'].items():
        ov = bp.buffer(-0.6).intersection(paved).area
        if ov > 2.0 and not objs['_building_on_path_ok'].get(bid):
            msgs.append('building %s overlaps paths by %.0f m2' % (bid, ov))
    # 6. ride footprints over paths
    for rid, fp in objs['_ride_fp'].items():
        if rid in ('railway',):
            continue
        ov = fp.buffer(-0.5).intersection(paved).area
        if ov > 10.0 and rid not in objs['_ride_on_path_ok']:
            msgs.append('ride %s footprint overlaps paths by %.0f m2' % (rid, ov))
    # 7. queue pens vs buildings / rides / paths
    for q in objs['queues']:
        qp = Polygon(q['_poly']) if '_poly' in q else Polygon(q['polygon'])
        for bid, (bp, bh) in objs['_building_fp'].items():
            if qp.buffer(-0.3).intersects(bp):
                msgs.append('queue %s overlaps building %s' % (q['id'], bid))
        for rid, fp in objs['_ride_fp'].items():
            if not fp.is_empty and qp.buffer(-0.3).intersects(fp):
                msgs.append('queue %s overlaps ride %s' % (q['id'], rid))
        ov = qp.buffer(-0.3).intersection(paved.difference(qp)).area
    for name, t in zip(names, tracks):
        for q in objs['queues']:
            qp = Polygon(q['polygon'])
            P = t.Parr
            for i in range(0, len(P), 2):
                if qp.contains(Point(P[i][0], P[i][2])) and P[i][1] < 6:
                    msgs.append('%s passes low over queue %s' % (name, q['id']))
                    break
    if not msgs:
        msgs.append('all checks passed')
    return msgs


if __name__ == '__main__':
    main()
