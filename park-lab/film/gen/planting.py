"""Procedural (seeded) planting, props and guests, stored as explicit lists."""
import math
import numpy as np
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely.prepared import prep
from layout import *

R = lambda a: round(float(a), 2)

SPECIES = [
    # id, shape, height range, crown ratio, colours
    {'id': 'oak', 'shape': 'broad rounded crown, 3-5 lumpy clusters, thick trunk', 'h': [10, 18], 'crown': 0.45, 'colors': ['#4F7F3A', '#5E8C40', '#3F6E33']},
    {'id': 'plane', 'shape': 'tall oval crown, mottled pale trunk', 'h': [12, 20], 'crown': 0.38, 'colors': ['#6A9A45', '#5C8E3E']},
    {'id': 'lime_clipped', 'shape': 'clipped box-headed avenue tree on 2.5 m clear stem', 'h': [6, 8], 'crown': 0.35, 'colors': ['#7DAA4A', '#6F9F44']},
    {'id': 'pine', 'shape': 'tall stone/scots pine, bare lower trunk, flat-topped cloud crown', 'h': [12, 22], 'crown': 0.28, 'colors': ['#2F5A3A', '#355F3C']},
    {'id': 'fir', 'shape': 'conical dark fir', 'h': [8, 16], 'crown': 0.25, 'colors': ['#24483A', '#2C5141']},
    {'id': 'palm', 'shape': 'curved slim trunk, 9-12 arching fronds', 'h': [7, 12], 'crown': 0.35, 'colors': ['#4E8F3A', '#5DA144']},
    {'id': 'jungle_broadleaf', 'shape': 'layered umbrella crown, buttress roots, hanging vines', 'h': [9, 16], 'crown': 0.5, 'colors': ['#2E7D4F', '#2A6E46', '#3B8A55']},
    {'id': 'banana', 'shape': 'clump of big paddle leaves', 'h': [3, 5], 'crown': 0.5, 'colors': ['#6DB34A', '#7CC152']},
    {'id': 'birch', 'shape': 'slender white trunk, airy oval crown', 'h': [8, 14], 'crown': 0.3, 'colors': ['#8DBB57', '#9CC463']},
    {'id': 'cherry_blossom', 'shape': 'spreading vase crown, pink blossom', 'h': [5, 8], 'crown': 0.55, 'colors': ['#F4B6C8', '#F7C9D6']},
    {'id': 'cypress', 'shape': 'narrow column', 'h': [7, 12], 'crown': 0.12, 'colors': ['#2E5A3E']},
    {'id': 'willow', 'shape': 'weeping willow, curtain to the ground', 'h': [8, 12], 'crown': 0.55, 'colors': ['#93B85A', '#86AE51']},
    {'id': 'maple_red', 'shape': 'rounded crown, warm red-orange accent', 'h': [7, 11], 'crown': 0.45, 'colors': ['#C8553D', '#D9733F']},
]
SP = {s['id']: i for i, s in enumerate(SPECIES)}

LAND_TREES = {
    'entrance': [('lime_clipped', 3), ('plane', 2), ('cypress', 1)],
    'main_street': [('lime_clipped', 3), ('plane', 1)],
    'hub': [('plane', 2), ('lime_clipped', 2), ('cherry_blossom', 1), ('cypress', 1)],
    'kiddie': [('cherry_blossom', 2), ('birch', 2), ('maple_red', 1), ('oak', 1)],
    'seaside': [('pine', 3), ('palm', 2), ('willow', 1), ('birch', 1)],
    'jungle': [('jungle_broadleaf', 4), ('palm', 3), ('banana', 3)],
    'thrill': [('birch', 3), ('cherry_blossom', 1), ('cypress', 2), ('maple_red', 2)],
    'frontier': [('pine', 4), ('fir', 2), ('oak', 1)],
    'midway': [('plane', 2), ('lime_clipped', 2), ('maple_red', 1)],
    'outside': [('oak', 3), ('pine', 2), ('fir', 2), ('birch', 1)],
}
LAND_SPACING = {'entrance': 9, 'main_street': 14, 'hub': 7, 'kiddie': 8, 'seaside': 8.5, 'jungle': 5.5, 'thrill': 11, 'frontier': 7.5, 'midway': 9, 'outside': 7.5}

LAMPS = {'entrance': 'victorian_double', 'main_street': 'victorian_double', 'hub': 'victorian_triple', 'kiddie': 'mushroom_pastel',
         'seaside': 'seaside_globe', 'jungle': 'bamboo_lantern', 'thrill': 'modern_mast', 'frontier': 'timber_lantern', 'midway': 'bulb_pole', 'outside': 'victorian_double'}
EDGE_LAMP_SPACING = {'main': 12, 'side': 16, 'alley': 12, 'spoke': 18, 'loop': 20, 'pier': 10, 'far': 28}
DENSITY = {'main': 0.18, 'side': 0.07, 'alley': 0.05, 'spoke': 0.07, 'loop': 0.035, 'pier': 0.06, 'far': 0.012}
PLAZA_DENSITY = {'entrance_plaza': 0.09, 'town_square': 0.14, 'hub_ring': 0.13, 'food_court': 0.10, 'coaster_plaza': 0.10, 'midway_west_bulb': 0.08,
                 'midway_east_bulb': 0.06, 'frontier_street': 0.06}
CLOTHES = ['#E74C3C', '#3498DB', '#F1C40F', '#2ECC71', '#FFFFFF', '#1C2833', '#E67E22', '#9B59B6', '#F5A6C8', '#16A085', '#D35400', '#A9CCE3', '#F7DC6F', '#5D6D7E']


def build_planting(paved, objs, water, track_corr, land_at, terrain_h, rng):
    hard = objs['_hard_union']
    queues = unary_union([Polygon(q['_poly']) for q in objs['queues']]) if objs['queues'] and '_poly' in objs['queues'][0] else Polygon()
    lot = box(-236, 212, 236, 304)
    compound = box(56, -266, 254, -218)
    service = LineString([(-300, -230), (300, -230), (310, -60), (305, 175), (240, 214)]).buffer(5)
    gate_zone = box(-80, 140, 80, 216)
    excl = unary_union([paved.buffer(1.8), hard.buffer(1.6), queues.buffer(1.2), water.buffer(1.5), track_corr, lot, compound, service,
                        Point(0, 0).buffer(12.5), gate_zone.difference(box(-80, 140, 80, 150)) if False else Polygon()])
    exs = prep(excl)
    trees = []
    xs = np.arange(SITE['xmin'] + 3, SITE['xmax'] - 3, 1.0)
    # jittered grid per land spacing
    taken = []
    for land in list(LAND_SPACING):
        sp = LAND_SPACING[land]
        mix = LAND_TREES[land]
        tot = sum(w for _, w in mix)
        for z in np.arange(SITE['zmin'] + 4, SITE['zmax'] - 4, sp):
            for x in np.arange(SITE['xmin'] + 4, SITE['xmax'] - 4, sp):
                jx, jz = x + rng.uniform(-0.45, 0.45) * sp, z + rng.uniform(-0.45, 0.45) * sp
                if land_at(jx, jz) != land:
                    continue
                if land == 'outside':
                    # thin out far away & in the lot; keep the berm dense
                    d_to_park = max(abs(jx) - 290, jz - 160, -200 - jz, 0)
                    if d_to_park > 40 and rng.random() < 0.35:
                        continue
                if exs.contains(Point(jx, jz)):
                    continue
                if land in ('entrance', 'main_street', 'hub', 'midway') and rng.random() < 0.2:
                    continue
                r_ = rng.uniform(0, tot)
                for sid, w in mix:
                    r_ -= w
                    if r_ <= 0:
                        break
                s = SPECIES[SP[sid]]
                h = rng.uniform(*s['h'])
                g = terrain_h(jx, jz)
                trees.append([R(jx), R(g), R(jz), SP[sid], R(h), R(h * s['crown']), int(rng.integers(len(s['colors'])))])
    # avenue trees along spokes / main street side streets / midway
    for e_pts, w, cls, pav in [(None, None, None, None)]:
        pass
    # flower beds
    beds = []
    beds.append({'id': 'hub_ring_beds', 'kind': 'annulus', 'annulus': [0, 0, 12.2, 15.0], 'mix': ['#E74C3C', '#F1C40F', '#FFFFFF', '#9B59B6'], 'pattern': 'radial colour bands, 16 segments'})
    beds.append({'id': 'hub_island_lawn', 'kind': 'circle', 'circle': [0, 0, 8.3], 'mix': ['#5E9C3F'], 'pattern': 'lawn with clipped box parterre around the tower base'})
    for x in (-62, -40, 40, 62):
        beds.append({'id': 'entrance_bed_%d' % x, 'kind': 'rect', 'center': [x, 198], 'w': 12, 'd': 6, 'mix': ['#E74C3C', '#FFFFFF', '#F1C40F'], 'pattern': 'carpet bedding stripes'})
    beds.append({'id': 'square_bed_ring', 'kind': 'annulus', 'annulus': [0, 128, 4.0, 6.5], 'mix': ['#F5A6C8', '#FFFFFF', '#E74C3C'], 'pattern': 'ring around fountain'})
    for (x, z) in [(-30, 116), (30, 116), (-30, 139), (30, 139)]:
        beds.append({'id': 'square_corner_%d_%d' % (x, z), 'kind': 'circle', 'circle': [x, z, 3.0], 'mix': ['#E74C3C', '#F1C40F'], 'pattern': 'round bed with standard rose'})
    for (x, z, r) in [(-82, 66, 3.5), (-122, 2, 3.0), (-100, -66, 3.0), (172, -10, 3.0)]:
        beds.append({'id': 'plaza_centre_%d_%d' % (x, z), 'kind': 'circle', 'circle': [x, z, r], 'mix': ['#F1C40F', '#E67E22', '#FFFFFF'], 'pattern': 'raised round planter with central tree or feature'})
    for q in objs['queues']:
        pass
    # hedges around flat rides
    hedges = []
    for r in objs['rides']:
        if r['type'] in ('carousel', 'teacups', 'kiddie_planes', 'kiddie_boats', 'kiddie_trucks', 'kiddie_drop_tower', 'swing_ride', 'pirate_ship', 'drop_tower'):
            fp = objs['_ride_fp'][r['id']]
            gg = fp.buffer(1.2)
            ring = (max(gg.geoms, key=lambda g: g.area) if hasattr(gg, 'geoms') else gg).exterior
            hedges.append({'ride': r['id'], 'height': 0.9, 'points': [[R(x), R(z)] for x, z in list(ring.coords)[::2]], 'gap_toward': 'nearest path (entry/exit)'})
    topiary = []
    for k, (x, z) in enumerate([(-70, 74), (-94, 74), (-70, 58), (-94, 58), (-48, 120), (-48, 88)]):
        topiary.append({'position': [x, 0, z], 'shape': ['rabbit', 'elephant', 'ball_stack', 'swan', 'bear', 'cone_spiral'][k], 'height': 2.2})
    for x in (-70, -50, 50, 70):
        topiary.append({'position': [x, 0, 182], 'shape': 'cone_spiral', 'height': 2.6})
    # shrub/understorey zones: foundation planting around buildings & along screens
    shrub = unary_union([objs['_building_fp'][b][0].buffer(3.0).difference(objs['_building_fp'][b][0]) for b in objs['_building_fp']
                         if not b.startswith('ms_') and not b.startswith('midway') and b not in ('turnstile_line', 'entrance_arch')]).difference(paved.buffer(0.5))
    shrubs = []
    for g in (shrub.geoms if hasattr(shrub, 'geoms') else [shrub]):
        if g.area > 4:
            shrubs.append([[R(x), R(z)] for x, z in list(g.exterior.coords)[:-1:2]])
    return {'species': SPECIES, 'trees': {'format': '[x, groundY, z, speciesIndex, height, crownRadius, colorVariant]', 'count': len(trees), 'list': trees},
            'flower_beds': beds, 'hedges': hedges, 'topiary': topiary, 'shrub_zones': shrubs,
            'lawn': 'all unpaved ground inside the berm is mown lawn with stripes 3 m wide, darker in shade; berm slopes are rough grass with wildflowers',
            'reeds': {'lake_shore_sw': True}}


def offset_points(pts, w_off, spacing, start=0.0):
    ls = LineString(pts)
    L = ls.length
    out = []
    s = start
    while s < L:
        p = ls.interpolate(s)
        p2 = ls.interpolate(min(L, s + 0.5))
        p1 = ls.interpolate(max(0, s - 0.5))
        dx, dz = p2.x - p1.x, p2.y - p1.y
        n = math.hypot(dx, dz) or 1
        nx, nz = -dz / n, dx / n
        out.append((s, p.x, p.y, nx, nz, dx / n, dz / n))
        s += spacing
    return out


def build_props(edges, plazas, objs, paved, land_at, rng, track_corr):
    hard = prep(objs['_hard_union'].buffer(0.8))
    pv = prep(paved)
    tc = prep(track_corr)
    lamps, benches, bins, planters, signposts, fountains, carts, umbrellas, bunting, strings, flags, fences, baskets, balloons = [], [], [], [], [], [], [], [], [], [], [], [], [], []

    def ok(x, z, need_unpaved=False):
        if hard.contains(Point(x, z)) or tc.contains(Point(x, z)):
            return False
        if need_unpaved and pv.contains(Point(x, z)):
            return False
        return True

    def far_enough(lst, x, z, d):
        for q in lst[-40:]:
            if (q[0] - x) ** 2 + (q[2] - z) ** 2 < d * d:
                return False
        return True

    for e in edges:
        cls, w, pts = e['class'], e['width'], e['points']
        land = e['land']
        sp = EDGE_LAMP_SPACING.get(cls, 20)
        inside = cls in ('main', 'side', 'alley', 'pier')
        off = (w / 2 - 0.8) if inside else (w / 2 + 0.7)
        for s, x, z, nx, nz, tx, tz in offset_points(pts, off, sp, start=sp / 2):
            for side in (-1, 1):
                lx, lz = x + nx * off * side, z + nz * off * side
                if ok(lx, lz) and far_enough(lamps, lx, lz, 6):
                    lamps.append([R(lx), 0, R(lz), LAMPS.get(land, 'victorian_double')])
                    if cls in ('main', 'side') or land in ('main_street', 'entrance', 'hub'):
                        baskets.append([R(lx), 3.2, R(lz)])
        # benches every ~32 m alternating sides, in the verge facing the path
        if cls not in ('alley',):
            for k, (s, x, z, nx, nz, tx, tz) in enumerate(offset_points(pts, 0, 32, start=10)):
                side = 1 if k % 2 else -1
                o = (w / 2 + 0.9) if not inside else (w / 2 - 1.6)
                bx, bz = x + nx * o * side, z + nz * o * side
                if ok(bx, bz) and (inside or not pv.contains(Point(bx, bz))):
                    rot = math.atan2(-nx * side, -nz * side)    # face the path centre
                    benches.append([R(bx), 0, R(bz), R(rot)])
                    bins.append([R(bx + tx * 1.6), 0, R(bz + tz * 1.6)])
        # planters along main street edges
        if cls == 'main' and e['paving'] == 'brick_herringbone':
            for s, x, z, nx, nz, tx, tz in offset_points(pts, 0, 12, start=6):
                for side in (-1, 1):
                    px, pz = x + nx * (w / 2 - 0.9) * side, z + nz * (w / 2 - 0.9) * side
                    if ok(px, pz):
                        planters.append([R(px), 0, R(pz), 'round_cast_iron', 1.4])
    # plaza furniture: benches around hub ring + planters + flags
    for k in range(16):
        a = k / 16 * 2 * math.pi + 0.1
        x, z = math.cos(a) * 16.2, math.sin(a) * 16.2
        if abs(math.sin(a)) > 0.98 or abs(math.cos(a)) > 0.98:
            continue
        benches.append([R(x), 0, R(z), R(math.atan2(math.cos(a), math.sin(a)))])
    for k in range(8):
        a = k / 8 * 2 * math.pi + math.pi / 8
        flags.append([R(math.cos(a) * 31.5), 0, R(math.sin(a) * 31.5), 10.0, ['#C8463A', '#F3E6CC', '#2F6E8E', '#D9A441'][k % 4]])
    for x in np.arange(-70, 71, 10):
        if abs(x) > 18:
            flags.append([R(x), 0, 208.5, 9.0, ['#C8463A', '#F3E6CC', '#2F6E8E', '#D9A441'][int(abs(x) / 10) % 4]])
    for x in (-15.5, -12.5, 12.5, 15.5):
        flags.append([x, 15.0, 180, 3.0, '#C8463A'])
    for x in (-150, -160, -170):
        flags.append([x, 1.2, 14.5, 6.0, '#2E86C1'])
        flags.append([x, 1.2, 5.5, 6.0, '#E74C3C'])
    # signposts at junction nodes (blank blades)
    deg = {}
    for e in edges:
        deg[e['a']] = deg.get(e['a'], 0) + 1
        deg[e['b']] = deg.get(e['b'], 0) + 1
    nodes = {k: v for k, v in NODES.items()}
    for n, dg in deg.items():
        if dg >= 2 and n in nodes:
            x, z = nodes[n]
            for dx, dz in [(3.5, 3.5), (-3.5, 3.5), (3.5, -3.5), (-3.5, -3.5)]:
                if ok(x + dx, z + dz):
                    signposts.append([R(x + dx), 0, R(z + dz), int(min(dg, 4)), 'blank arrow blades, land-coloured, finial on top'])
                    break
    # carts & kiosks
    cart_types = ['popcorn', 'ice_cream', 'balloons', 'pretzel', 'churros', 'souvenir', 'cotton_candy', 'lemonade']
    cart_spots = [(-6, 120), (8, 96), (-6, 60), (22, 14), (-22, -14), (-82, 56), (-112, -6), (-98, -56), (34, -52), (166, -2), (60, 50), (150, 62), (-60, 92), (-132, 60), (196, 30), (-30, 132), (120, -58)]
    for k, (x, z) in enumerate(cart_spots):
        carts.append([x, 0, z, cart_types[k % len(cart_types)], R(rng.uniform(0, 6.28))])
        if cart_types[k % len(cart_types)] == 'balloons':
            balloons.append({'seller': [x, 0, z], 'count': 24, 'colors': ['#E74C3C', '#F1C40F', '#3498DB', '#2ECC71', '#F5A6C8', '#FFFFFF']})
    # food court tables + umbrellas
    for x in np.arange(60, 98, 5.0):
        for z in np.arange(76, 106, 5.0):
            umbrellas.append([R(x), 0, R(z), 2.8, ['#D7263D', '#FFF4E0', '#1B998B', '#F4B942'][int((x + z) / 5) % 4], 'stripe' if (x + z) % 10 == 0 else 'solid'])
    for x in np.arange(-128, -115, 4.5):
        umbrellas.append([R(x), 0, 32.5, 2.4, '#2E86C1', 'stripe'])
    for z in np.arange(-6, 12, 4.5):
        umbrellas.append([R(200.0), 0, R(z), 2.4, '#A0522D', 'solid'])
    # bunting: main street zigzag between opposite lamps; town square; midway
    for z in np.arange(38, 110, 12):
        bunting.append({'a': [-8.2, 6.8, R(z)], 'b': [8.2, 6.8, R(z + 6)], 'sag': 0.9, 'colors': ['#C8463A', '#F3E6CC', '#2F6E8E', '#D9A441'], 'pennant': 0.3})
        bunting.append({'a': [8.2, 6.8, R(z + 6)], 'b': [-8.2, 6.8, R(z + 12)], 'sag': 0.9, 'colors': ['#C8463A', '#F3E6CC', '#2F6E8E', '#D9A441'], 'pennant': 0.3})
    for k in range(10):
        a = k / 10 * 2 * math.pi
        bunting.append({'a': [-24, 7.2, 128], 'b': [R(-24 + math.cos(a) * 14), 5.0, R(128 + math.sin(a) * 12)], 'sag': 0.5,
                        'colors': ['#C8463A', '#FFFFFF', '#2F6E8E'], 'pennant': 0.3})
    for x in np.arange(64, 180, 9):
        bunting.append({'a': [R(x), 5.5, 52.5], 'b': [R(x + 4.5), 5.5, 67.5], 'sag': 1.2, 'colors': ['#D7263D', '#FFF4E0', '#F4B942', '#1B998B'], 'pennant': 0.35})
    for x in np.arange(-142, -176, -6):
        bunting.append({'a': [R(x), 4.8, 5.6], 'b': [R(x - 6), 4.8, 5.6], 'sag': 0.4, 'colors': ['#2E86C1', '#FFFFFF', '#E74C3C'], 'pennant': 0.3})
        bunting.append({'a': [R(x), 4.8, 14.4], 'b': [R(x - 6), 4.8, 14.4], 'sag': 0.4, 'colors': ['#2E86C1', '#FFFFFF', '#E74C3C'], 'pennant': 0.3})
    # string lights (festoon bulbs)
    for z in np.arange(74, 110, 6):
        strings.append({'a': [56, 4.5, R(z)], 'b': [100, 4.5, R(z)], 'sag': 1.0, 'bulb_spacing': 0.8, 'color': '#FFC76B'})
    for x in np.arange(62, 182, 12):
        strings.append({'a': [R(x), 6.0, 54], 'b': [R(x + 12), 6.0, 54], 'sag': 0.6, 'bulb_spacing': 0.6, 'color': '#FFC76B'})
        strings.append({'a': [R(x), 6.0, 66], 'b': [R(x + 12), 6.0, 66], 'sag': 0.6, 'bulb_spacing': 0.6, 'color': '#FFC76B'})
    for z in np.arange(40, 110, 8):
        strings.append({'a': [-8.5, 5.6, R(z)], 'b': [8.5, 5.6, R(z)], 'sag': 0.5, 'bulb_spacing': 0.5, 'color': '#FFE3A3'})
    # fences around rides (picket/rail) = ride footprint outline + 1 m
    for r in objs['rides']:
        if r['type'] in ('lake_boats', 'perimeter_railway', 'observation_tower', 'dark_ride_show_building', 'bumper_car_pavilion'):
            continue
        fp = objs['_ride_fp'][r['id']]
        if fp.is_empty:
            continue
        gg = fp.buffer(0.6, join_style=2)
        ring = (max(gg.geoms, key=lambda g: g.area) if hasattr(gg, 'geoms') else gg).exterior
        fences.append({'ride': r['id'], 'height': 1.1, 'style': {'kiddie': 'pastel picket', 'frontier': 'split rail', 'jungle': 'bamboo', 'seaside': 'white rope-and-post',
                                                                    'thrill': 'black steel mesh', 'midway': 'gold-tipped iron'}.get(r.get('land'), 'iron'),
                       'points': [[R(x), R(z)] for x, z in ring.coords]})
    # lake railing along the promenade side
    fences.append({'ride': 'lake_edge', 'height': 1.0, 'style': 'white seaside railing', 'points': [[x, z] for x, z in LAKE[-6:] + LAKE[:1]]})
    # drinking fountains near restrooms
    for b in objs['buildings']:
        if b['kind'] == 'restroom':
            x, z = b['position'][0], b['position'][2]
            fountains.append([R(x + 9), 0, R(z)])
    for q in objs['queues']:
        fountains.append([q['entry'][0], 0, q['entry'][1]])
    return {
        'lamps': {'format': '[x, y, z, style]', 'styles': {
            'victorian_double': 'green cast-iron post 4.2 m, two lantern arms, hanging flower basket',
            'victorian_triple': 'ornate 5 m post with 3 globes', 'mushroom_pastel': 'pastel mushroom-cap lamp 3 m',
            'seaside_globe': 'white post with frosted globe and blue ring 3.8 m', 'bamboo_lantern': 'bamboo pole with paper/rattan lantern 3 m',
            'modern_mast': 'slim dark-grey mast 6 m with flat LED head and red band', 'timber_lantern': 'timber post with hanging iron lantern 3.5 m',
            'bulb_pole': 'striped pole 5 m topped with a ring of bulbs'}, 'list': lamps},
        'hanging_baskets': {'format': '[x, y, z]', 'list': baskets},
        'benches': {'format': '[x, y, z, rot] (rot: bench front faces direction (sin rot, cos rot))', 'size': [1.8, 0.85, 0.65], 'list': benches},
        'bins': {'format': '[x, y, z]', 'list': bins},
        'planters': {'format': '[x, y, z, style, diameter]', 'list': planters},
        'signposts': {'format': '[x, y, z, nBlades, style]', 'list': signposts},
        'drinking_fountains': {'format': '[x, y, z]', 'list': fountains},
        'carts': {'format': '[x, y, z, type, rot]', 'size': [2.6, 2.4, 1.3], 'list': carts},
        'balloon_sellers': balloons,
        'umbrella_tables': {'format': '[x, y, z, diameter, color, pattern] (table + 4 chairs under each)', 'list': umbrellas},
        'bunting': {'format': 'a,b endpoints (y = height), sag in m, triangular pennants', 'list': bunting},
        'string_lights': {'format': 'a,b endpoints, sag, bulb spacing', 'list': strings},
        'flagpoles': {'format': '[x, baseY, z, height, flagColor]', 'list': flags},
        'fences': fences,
    }


def build_guests(edges, plazas, objs, paved, rng):
    hard = prep(objs['_hard_union'])
    walkers = []
    for e in edges:
        dens = DENSITY.get(e['class'], 0.03)
        area = e['length'] * e['width']
        n = int(rng.poisson(area * dens))
        for _ in range(n):
            walkers.append([e['id'], R(rng.uniform(0, 1)), int(rng.choice([-1, 1])), R(rng.uniform(0.9, 1.45)),
                            R(rng.uniform(-0.42, 0.42) * e['width']), int(rng.integers(len(CLOTHES))), 1 if rng.random() < 0.22 else 0])
    idlers = []
    for p in plazas:
        dens = PLAZA_DENSITY.get(p['id'], 0.05)
        poly = Polygon(p['polygon'][0]['outer'], p['polygon'][0]['holes'])
        n = int(rng.poisson(poly.area * dens))
        minx, minz, maxx, maxz = poly.bounds
        pp = prep(poly)
        k = 0
        tries = 0
        while k < n and tries < n * 20:
            tries += 1
            x, z = rng.uniform(minx, maxx), rng.uniform(minz, maxz)
            if pp.contains(Point(x, z)) and not hard.contains(Point(x, z)):
                idlers.append([R(x), R(z), R(rng.uniform(0, 6.28)), int(rng.integers(len(CLOTHES))), 1 if rng.random() < 0.25 else 0,
                               1 if rng.random() < 0.3 else 0])
                k += 1
    queued = []
    for q in objs['queues']:
        ls = LineString(q['polyline'])
        fill = 0.85 if q['ride'] in ('hero_coaster', 'log_flume', 'wooden_coaster') else 0.6
        s = 0.0
        while s < ls.length * fill:
            p = ls.interpolate(ls.length - s)    # from the station end backwards
            queued.append([q['id'], R(p.x), R(p.y), R(rng.normal(0, 0.12)), int(rng.integers(len(CLOTHES))), 1 if rng.random() < 0.2 else 0])
            s += rng.uniform(0.55, 0.8)
    seated = []
    return {
        'clothes_palette': CLOTHES,
        'body': {'adult_height': [1.6, 1.85], 'child_height': [1.0, 1.3], 'look': 'capsule body + head, hats on 25%, some hold balloons'},
        'densities_per_m2': {'edge_classes': DENSITY, 'plazas': PLAZA_DENSITY, 'queue': 'one guest per 0.55-0.8 m of lane'},
        'walkers': {'format': '[edgeId, u0 (0..1 along edge), dir (+1 a->b / -1), speed m/s, lateralOffset m, colorIndex, isChild]',
                    'motion': 'u(t) = u0 + dir*speed*t/edgeLength, ping-pong at edge ends (reflect), lateral offset fixed; bob 2 Hz',
                    'count': len(walkers), 'list': walkers},
        'idlers': {'format': '[x, z, heading, colorIndex, isChild, holdsBalloon]', 'motion': 'stand, sway, turn slowly; 20% shuffle 0.3 m/s in small circles',
                   'count': len(idlers), 'list': idlers},
        'queued': {'format': '[queueId, x, z, headingJitter, colorIndex, isChild]', 'motion': 'face along the lane toward the station; step forward 0.6 m every ~4 s',
                   'count': len(queued), 'list': queued},
        'seated': 'one guest on ~50% of benches and 2 per umbrella table (derive from props)',
        'riders': 'fill every coaster/flat-ride seat; arms up on drops for coasters',
        'total_estimate': len(walkers) + len(idlers) + len(queued),
    }
