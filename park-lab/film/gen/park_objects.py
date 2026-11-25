"""Rides, buildings, queues, parking and backstage for the film park."""
import math
import numpy as np
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import affinity
from layout import *

R = lambda a: round(float(a), 3)


def rect(cx, cz, w, d, rot=0.0):
    p = box(-w / 2, -d / 2, w / 2, d / 2)
    return affinity.affine_transform(p, [math.cos(rot), math.sin(rot), -math.sin(rot), math.cos(rot), cx, cz])


def to_world(cx, cz, rot, lx, lz):
    # local x -> (cos rot, -sin rot); local z -> (sin rot, cos rot)
    return (cx + lx * math.cos(rot) + lz * math.sin(rot), cz - lx * math.sin(rot) + lz * math.cos(rot))


def pl(poly):
    return [[R(x), R(z)] for x, z in list(poly.exterior.coords)[:-1]]


def queue_pen(qid, ride, cx, cz, w, d, rot, entry_side='left', canopy='fabric_sails', land=''):
    """Switchback pen. Lanes run along local x. Entry at local (-w/2, +d/2) corner (front-left),
    exit (to station) at the back row. Returns dict + _poly."""
    pitch = 1.3
    n = max(2, int((d - 0.4) / pitch))
    lanes = []
    pts = []
    x0, x1 = -w / 2 + 0.7, w / 2 - 0.7
    for k in range(n):
        lz = d / 2 - 0.2 - pitch * (k + 0.5)
        a, b = (x0, x1) if k % 2 == 0 else (x1, x0)
        pts += [to_world(cx, cz, rot, a, lz), to_world(cx, cz, rot, b, lz)]
    rails = []
    for k in range(n + 1):
        lz = d / 2 - 0.2 - pitch * k
        if k == 0 or k == n:
            a, b = -w / 2, w / 2
        elif k % 2 == 1:
            a, b = -w / 2, w / 2 - 1.5     # gap at right end
        else:
            a, b = -w / 2 + 1.5, w / 2
        rails.append([list(map(R, to_world(cx, cz, rot, a, lz))), list(map(R, to_world(cx, cz, rot, b, lz)))])
    # side rails
    rails.append([list(map(R, to_world(cx, cz, rot, -w / 2, d / 2))), list(map(R, to_world(cx, cz, rot, -w / 2, -d / 2)))])
    rails.append([list(map(R, to_world(cx, cz, rot, w / 2, d / 2))), list(map(R, to_world(cx, cz, rot, w / 2, -d / 2)))])
    poly = rect(cx, cz, w, d, rot)
    L = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    canopies = []
    if canopy:
        nc = max(1, int(round(w / 8)))
        for c in range(nc):
            lx = -w / 2 + (c + 0.5) * w / nc
            canopies.append({'center': list(map(R, to_world(cx, cz, rot, lx, 0))), 'w': R(w / nc - 0.6), 'd': R(d - 0.6),
                             'rot': R(rot), 'height': 3.6, 'style': canopy})
    return {'id': qid, 'ride': ride, 'land': land, 'center': [R(cx), R(cz)], 'w': w, 'd': d, 'rot': R(rot),
            'lanes': n, 'lane_width': 1.1, 'rail_height': 1.0, 'post_spacing': 2.2,
            'polyline': [[R(x), R(z)] for x, z in pts], 'length': R(L),
            'entry': [R(pts[0][0]), R(pts[0][1])], 'exit': [R(pts[-1][0]), R(pts[-1][1])],
            'rails': rails, 'canopies': canopies, 'fans_and_planters': True,
            'polygon': pl(poly), '_poly': [[x, z] for x, z in list(poly.exterior.coords)[:-1]]}


def build_objects(walk_union, land_at):
    rides, buildings, queues, water = [], [], [], []
    ride_fp, bfp, b_ok, r_ok = {}, {}, {}, set()
    rng = np.random.default_rng(7)

    def add_ride(r, fp, on_path_ok=False):
        r['footprint'] = pl(fp) if fp.geom_type == 'Polygon' else [pl(g) for g in fp.geoms]
        r.setdefault('land', land_at(r['position'][0], r['position'][2]) if 'position' in r else '')
        rides.append(r)
        ride_fp[r['id']] = fp
        if on_path_ok:
            r_ok.add(r['id'])

    def add_bld(b, on_path_ok=False):
        cx, cz = b['position'][0], b['position'][2]
        fp = rect(cx, cz, b['w'], b['d'], b.get('rot', 0))
        b['footprint'] = pl(fp)
        b.setdefault('land', land_at(cx, cz))
        buildings.append(b)
        bfp[b['id']] = (fp, b['h'])
        if on_path_ok:
            b_ok[b['id']] = True

    # ===================================================================== RIDES
    # --- tracked rides (geometry in tracks{}) ---
    add_ride({'id': 'hero_coaster', 'type': 'steel_looping_coaster', 'name': 'the Red Comet', 'land': 'thrill', 'track': 'hero_coaster',
              'position': [7, 0, -74],
              'params': {'gauge': 1.1, 'rail_diameter': 0.25, 'spine_diameter': 0.6, 'tie_spacing': 1.2, 'catwalk_on': ['lift'],
                         'chain_on': ['lift'], 'antirollback_on': ['lift'], 'fin_brakes_on': ['brakes', 'trim'],
                         'max_height': 45.1, 'loop_height': 29.8, 'top_speed_ms': 28.9,
                         'train': {'count': 2, 'cars': 7, 'rows_per_car': 2, 'seats_per_row': 2, 'car_length': 2.2, 'car_gap': 0.25,
                                   'car_width': 2.0, 'colors': ['#F2F2F2', '#E23B2E'], 'lap_bars': True, 'nose_cone_on_lead': True},
                         'colors': {'track': '#E23B2E', 'spine': '#E23B2E', 'supports': '#F4EBD9', 'footers': '#B8B2A6', 'catwalk': '#9AA3AD'}},
              'station': {'center': [7, -74], 'w': 40, 'd': 16, 'rot': R(FACE_S), 'platform_height': 1.0, 'roof': 'sawtooth canopy, navy with red fascia', 'h': 7.5,
                          'load_side': 'south', 'unload_side': 'north'},
              'transfer': {'table_s_range': [8, 24], 'spur': [[33, -74], [33, -84], [58, -84]], 'shed': {'center': [52, -84], 'w': 18, 'd': 12, 'h': 7}},
              'queue': 'q_hero', 'exit_path': [[-6, -66], [-22, -63], [-30, -58]], 'platform': 'single south platform: unload at the west half, load at the east half',
              'spectator_spots': ['coaster_plaza fence line facing the loop (z=-60)', 'path at x=-60 under the lift view']},
             rect(7, -74, 40, 16, 0).union(rect(51, -84, 20, 14, 0)))
    add_ride({'id': 'wooden_coaster', 'type': 'wooden_out_and_back_coaster', 'name': 'the Timber Twister', 'land': 'frontier', 'track': 'wooden_coaster',
              'position': [233, 0, 91],
              'params': {'gauge': 1.1, 'track_stack_depth': 0.6, 'track_width': 2.4, 'bent_spacing': 2.4,
                         'ledger_spacing': 2.5, 'diagonal_bracing': 'X in every bent, longitudinal diagonals every 3rd bay', 'walkboards': True,
                         'max_height': 33.0, 'top_speed_ms': 24.1,
                         'train': {'count': 2, 'cars': 6, 'rows_per_car': 2, 'seats_per_row': 2, 'car_length': 2.4, 'car_gap': 0.3,
                                   'car_width': 2.0, 'colors': ['#2F7A78', '#F4E3C1'], 'lap_bars': True},
                         'colors': {'structure': '#D9B98C', 'structure_alt_painted': '#EFE6D2', 'track': '#6B4A2E', 'running_rail': '#9AA3AD'}},
              'station': {'center': [233, 91], 'w': 16, 'd': 36, 'rot': R(FACE_S), 'platform_height': 1.2, 'roof': 'timber gable with false front', 'h': 8},
              'queue': 'q_wood', 'exit_path': [[225, 74], [214, 70], [206, 64]]},
             rect(233, 91, 16, 36, 0))
    add_ride({'id': 'family_coaster', 'type': 'family_coaster', 'name': 'the Caterpillar', 'land': 'kiddie', 'track': 'family_coaster',
              'position': [-83, 0, 93],
              'params': {'gauge': 0.9, 'rail_diameter': 0.16, 'spine': 'box beam 0.5 m', 'max_height': 10.9, 'top_speed_ms': 12.5,
                         'lift': 'tyre-driven',
                         'train': {'count': 1, 'cars': 6, 'rows_per_car': 1, 'seats_per_row': 2, 'car_length': 1.6, 'car_gap': 0.2, 'car_width': 1.4,
                                   'colors': ['#7BC96F', '#FFE08A'], 'lead_car_face': 'smiling caterpillar head (abstract, no text)'},
                         'colors': {'track': '#2BB3A3', 'supports': '#F5C542', 'footers': '#E0D7C6'}},
              'station': {'center': [-83, 93], 'w': 24, 'd': 9, 'rot': R(FACE_S), 'platform_height': 0.8, 'roof': 'scalloped pastel canopy', 'h': 5},
              'queue': 'q_family', 'exit_path': [[-70, 88], [-66, 80], [-72, 74]]},
             rect(-83, 93, 24, 9, 0))
    add_ride({'id': 'log_flume', 'type': 'log_flume', 'name': 'the Big Splash', 'land': 'jungle', 'track': 'log_flume',
              'position': [-122, 0, -105],
              'params': {'trough_width': 1.6, 'trough_depth': 0.9, 'trough_color': '#DDEFF2', 'trough_outer': '#8B6B4A',
                         'lifts': 'conveyor belt, rubber cleats', 'max_height': 16.0,
                         'boats': {'count': 8, 'length': 4.2, 'width': 1.4, 'seats': 5, 'style': 'hollow log', 'color': '#8B5A2B', 'spacing_s': 48},
                         'splash_pool': {'center': [-74, -114], 'w': 9, 'd': 22}, 'soak_zone': 'path spur at z=-106 by the splash run'},
              'station': {'center': [-122, -105], 'w': 12, 'd': 24, 'rot': R(FACE_E), 'roof': 'thatched gable', 'h': 6},
              'queue': 'q_flume', 'exit_path': [[-128, -95], [-136, -90], [-141, -86]]},
             rect(-122, -105, 12, 24, 0))
    add_ride({'id': 'river_rapids', 'type': 'river_rapids', 'name': 'Rumble River', 'land': 'jungle', 'track': 'river_rapids',
              'position': [-187, 0, -80],
              'params': {'channel_width': 7.0, 'channel_depth': 1.2, 'banks': 'artificial rockwork 1-4 m high, ferns',
                         'rafts': {'count': 9, 'diameter': 3.4, 'seats': 12, 'colors': ['#E67E22', '#F1C40F', '#E74C3C'], 'spacing_s': 36, 'spin': 'slow random yaw'},
                         'features': ['standing waves on rapids segments', 'geysers at chute', 'waterfall from the rock hill onto the waterfall segment', 'cave overhang on north run'],
                         'station': 'turntable, 14 m'},
              'station': {'center': [-187, -80], 'w': 22, 'd': 16, 'rot': R(FACE_S), 'roof': 'timber long-house with palm thatch', 'h': 6.5},
              'queue': 'q_rapids', 'exit_path': [[-199, -74], [-214, -66], [-224, -40], [-225, -22]]},
             rect(-187, -80, 22, 16, 0))
    # --- flat rides ---
    add_ride({'id': 'ferris_wheel', 'type': 'ferris_wheel', 'name': 'the Sea Wheel', 'land': 'seaside',
              'position': [-195, 0, -40], 'rot': R(FACE_S),
              'params': {'diameter': 44, 'hub_height': 25, 'gondolas': 30, 'gondola': {'w': 2.0, 'h': 2.2, 'style': 'open-sided cage with round canopy'},
                         'spokes': 30, 'rims': 2, 'rim_spacing': 4.0, 'legs': 'two A-frames, base spread 26 m along plane, 10 m deep',
                         'rotation_period_s': 90, 'bulbs_on_spokes': True,
                         'colors': {'structure': '#FFFFFF', 'gondolas': ['#E74C3C', '#F1C40F', '#2E86C1', '#27AE60', '#F5A6C8', '#F39C12']}},
              'boarding_platform': {'center': [-195, -28], 'w': 10, 'd': 4},
              'queue': 'q_wheel'},
             rect(-195, -38, 30, 14, 0))
    add_ride({'id': 'swing_ride', 'type': 'swing_ride', 'name': 'Gull Swings', 'land': 'seaside', 'position': [-189, 1.2, 10],
              'params': {'mast_height': 14, 'canopy_radius': 6.0, 'canopy': 'striped cone, 16 panels white/blue', 'chairs': 32, 'chain_length': 6.0,
                         'max_angle_deg': 45, 'period_s': 5.2, 'tilt_deg': 8, 'on_deck': 'pier end platform at y=1.2'}},
             Point(-189, 10).buffer(12.0), on_path_ok=True)
    add_ride({'id': 'pirate_ship', 'type': 'pirate_ship', 'name': 'the Galleon', 'land': 'seaside', 'position': [-132, 0, -34], 'rot': R(FACE_S),
              'params': {'boat_length': 18, 'pivot_height': 15, 'max_swing_deg': 72, 'period_s': 7.5, 'rows': 10,
                         'frame': 'red A-frame', 'colors': {'hull': '#8E5B3A', 'stripe': '#F1C40F', 'sail_motif': '#FFFFFF', 'frame': '#C0392B'},
                         'swing_axis': 'local x (boat swings along x)'}},
             rect(-132, -34, 28, 12, 0))
    add_ride({'id': 'carousel', 'type': 'carousel', 'name': 'the Grand Carousel', 'land': 'midway', 'position': [86, 0, 30],
              'params': {'radius': 9.0, 'height': 9.5, 'rows': 3, 'figures': 36, 'chariots': 2, 'period_s': 16,
                         'canopy': 'red/cream striped cone, scalloped valance, gold rounding board with bulbs', 'organ': 'centre drum, mirrored panels',
                         'colors': {'canopy': ['#D7263D', '#FFF4E0'], 'horses': ['#FFFFFF', '#F4B942', '#8E5B3A', '#2E294E'], 'trim': '#F4B942'}}},
             Point(86, 30).buffer(11.5))
    add_ride({'id': 'teacups', 'type': 'teacups', 'name': 'Spinning Cups', 'land': 'midway', 'position': [126, 0, 32],
              'params': {'platform_radius': 9.0, 'turntables': 3, 'cups_per_turntable': 6, 'cup_radius': 1.2, 'period_main_s': 14, 'period_sub_s': 5,
                         'canopy': 'none (open air), surrounding low hedge', 'colors': {'cups': ['#F5A6C8', '#A8D8EA', '#FFE08A', '#B8E0B0', '#C3A6E0', '#FFFFFF']}}},
             Point(126, 32).buffer(11.0))
    add_ride({'id': 'bumper_cars', 'type': 'bumper_car_pavilion', 'name': 'Dodgems', 'land': 'midway', 'position': [128, 0, 88], 'rot': R(FACE_N),
              'params': {'w': 36, 'd': 24, 'h': 7, 'open_side': 'north (faces the midway avenue)', 'cars': 18, 'floor': 'steel plate',
                         'ceiling_grid': True, 'perimeter_bumper': 'yellow/black padded rail', 'colors': {'roof': '#2E294E', 'fascia': '#F4B942', 'cars': ['#D7263D', '#1B998B', '#F4B942', '#2E86C1']}}},
             rect(128, 88, 36, 24, 0))
    add_ride({'id': 'drop_tower', 'type': 'drop_tower', 'name': 'the Plummet', 'land': 'thrill', 'position': [168, 0, -118], 'exit_path': [[175, -111], [182, -92], [186, -73]],
              'params': {'height': 70, 'mast_radius': 1.8, 'ring_radius': 3.4, 'seats': 16, 'cycle': {'rise_s': 18, 'hold_s': 3, 'drop_s': 3.6, 'brake_s': 1.5, 'reload_s': 10},
                         'colors': {'mast': '#1F2A44', 'ring': '#F5B700', 'seats': '#E23B2E', 'top_crown': '#E23B2E'}}},
             Point(168, -118).buffer(7.0))
    add_ride({'id': 'observation_tower', 'type': 'observation_tower', 'name': 'the Lookout', 'land': 'hub', 'position': [0, 0, 0],
              'params': {'height': 72, 'mast_radius': 2.2, 'cabin_radius': 6.5, 'cabin_height': 3.2, 'cabin_travel': [3.5, 62], 'rotation_period_s': 60,
                         'cycle': {'rise_s': 60, 'top_s': 20, 'descend_s': 60, 'bottom_s': 30}, 'crown': 'gold spire with flag ring', 'colors': {'mast': '#FFFFFF', 'bands': '#3F6F8A', 'cabin': '#E2B33C', 'glass': '#9FD3E8'}}},
             Point(0, 0).buffer(8.0))
    add_ride({'id': 'dark_ride', 'type': 'dark_ride_show_building', 'name': 'Temple of Echoes', 'land': 'jungle', 'position': [-154, 0, -160], 'rot': R(FACE_S),
              'exit_path': [[-133, -138], [-141, -128]],
             'params': {'w': 48, 'd': 40, 'h': 13, 'facade': 'mossy stepped stone ruin facade 48 m wide on the south side (generic, no faces/IP), vine curtains, two torches, carved archway entrance 6 m',
                         'back': 'plain grey-green box, hidden by trees', 'vehicles': 'hidden inside'}},
             rect(-154, -160, 48, 40, 0))
    # kiddie rides
    add_ride({'id': 'kiddie_planes', 'type': 'kiddie_planes', 'land': 'kiddie', 'position': [-54, 0, 104],
              'params': {'arms': 8, 'radius': 5.0, 'lift_height': 2.5, 'period_s': 10, 'colors': ['#F4A7B9', '#A8D8EA', '#FFE08A', '#B8E0B0']}},
             Point(-54, 104).buffer(7.0))
    add_ride({'id': 'kiddie_boats', 'type': 'kiddie_boats', 'land': 'kiddie', 'position': [-112, 0, 46],
              'params': {'pool_radius': 7.0, 'boats': 8, 'period_s': 20, 'colors': ['#F4A7B9', '#A8D8EA', '#FFE08A']}},
             Point(-112, 46).buffer(8.0))
    add_ride({'id': 'kiddie_trucks', 'type': 'kiddie_trucks', 'land': 'kiddie', 'position': [-60, 0, 30], 'rot': R(0.6),
              'params': {'oval_length': 16, 'oval_width': 8, 'trucks': 6, 'period_s': 18}},
             rect(-60, 30, 18, 10, 0.6))
    add_ride({'id': 'kiddie_drop', 'type': 'kiddie_drop_tower', 'land': 'kiddie', 'position': [-98, 0, 40],
              'params': {'height': 9, 'seats': 8, 'colors': ['#C3A6E0', '#FFE08A']}},
             Point(-98, 40).buffer(4.0))
    add_ride({'id': 'playground', 'type': 'playground', 'land': 'kiddie', 'position': [-124, 0, 30],
              'params': {'w': 14, 'd': 12, 'items': ['rope pyramid', 'slide tower', 'sandpit', 'spring riders'], 'surface': 'rubber crumb #E7B8A6'}},
             rect(-124, 30, 14, 12, 0))
    # perimeter railway
    add_ride({'id': 'railway', 'type': 'perimeter_railway', 'name': 'Berm Line', 'land': 'entrance', 'track': 'railway', 'position': [35, 5.4, 160],
              'params': {'gauge': 0.914, 'train': {'loco': 'tank engine with tall chimney, brass dome', 'coaches': 5, 'coach_length': 7.0, 'open_sided': True,
                                                   'colors': {'loco': '#1F5E3B', 'trim': '#D9A441', 'coaches': '#C8463A', 'roofs': '#F3E6CC'}, 'speed_ms': 6.0},
                         'ballast': 'grey ballast bed 3 m wide on the berm crest', 'sleepers': 'timber, 0.6 m spacing',
                         'bridge': {'x': [-10, 10], 'z': 160, 'type': 'riveted girder bridge on brick abutments with arched portal facing the park (no text)', 'deck_y': 5.0, 'clear_height': 4.6},
                         'station': {'center': [35, 151], 'w': 42, 'd': 9, 'platform_y': 4.8, 'style': 'Victorian station with canopy, valance, clock (no numerals needed), two stairs down to the town square at x=20 and x=50'}}},
             rect(35, 151, 42, 9, 0), on_path_ok=True)
    # lake boats
    boats = []
    for k in range(10):
        a = k / 10 * 2 * math.pi
        boats.append({'id': 'swan_%d' % k, 'kind': 'swan_pedal_boat', 'route_center': [-200, 44], 'route_radii': [40 - (k % 3) * 9, 34 - (k % 3) * 7],
                      'phase': R(a), 'period_s': 140 + 12 * (k % 4), 'color': ['#FFFFFF', '#FFFFFF', '#F5CBA7'][k % 3]})
    boats.append({'id': 'paddle_steamer', 'kind': 'paddle_steamer', 'route_center': [-205, 46], 'route_radii': [46, 40], 'phase': 1.0, 'period_s': 240,
                  'length': 14, 'color': '#FFFFFF', 'trim': '#E74C3C'})
    add_ride({'id': 'lake_boats', 'type': 'lake_boats', 'land': 'seaside', 'position': [-200, -0.5, 44], 'params': {'boats': boats,
              'dock': {'center': [-190, 103], 'w': 16, 'd': 6}, 'note': 'boats follow ellipses on the lake; heading = tangent'}},
             Polygon())

    # ===================================================================== QUEUES
    queues += [
        queue_pen('q_hero', 'hero_coaster', 44, -66.5, 30, 10.5, FACE_S, land='thrill'),
        queue_pen('q_wood', 'wooden_coaster', 216, 91, 26, 14, FACE_W, canopy='timber_pergola', land='frontier'),
        queue_pen('q_family', 'family_coaster', -96, 83, 16, 6.5, FACE_S, canopy='scalloped_awning', land='kiddie'),
        queue_pen('q_flume', 'log_flume', -134, -104, 20, 8, FACE_W, canopy='thatch', land='jungle'),
        queue_pen('q_rapids', 'river_rapids', -187, -66, 22, 8, FACE_S, canopy='thatch', land='jungle'),
        queue_pen('q_darkride', 'dark_ride', -154, -134, 20, 8, FACE_S, canopy='vine_pergola', land='jungle'),
        queue_pen('q_wheel', 'ferris_wheel', -208, -15, 14, 5.5, FACE_S, canopy='striped_awning', land='seaside'),
        queue_pen('q_drop', 'drop_tower', 162, -102, 12, 8, FACE_S, land='thrill'),
    ]

    # ===================================================================== BUILDINGS
    # entrance
    add_bld({'id': 'entrance_arch', 'kind': 'entrance_arch', 'position': [0, 0, 180], 'rot': FACE_S, 'w': 34, 'd': 4, 'h': 15,
             'style': 'two brick towers (6x4 m, 12 m) with copper domes, wrought-iron arch spanning 22 m with bulb lights and a blank cartouche, flags on top',
             'palette': 'entrance'}, on_path_ok=True)
    for i, x in enumerate([-38, -24, -10, 10, 24, 38]):
        add_bld({'id': 'ticket_booth_%d' % i, 'kind': 'ticket_booth', 'position': [x, 0, 200], 'rot': FACE_S, 'w': 5, 'd': 3.5, 'h': 4.2,
                 'style': 'kiosk with arched windows facing south, striped canopy, finial', 'palette': 'entrance'}, on_path_ok=True)
    turnstiles = []
    for i in range(20):
        x = -28.5 + i * 3.0
        turnstiles.append({'position': [R(x), 0, 188], 'rot': FACE_S, 'w': 0.8, 'd': 1.6, 'h': 1.1})
    add_bld({'id': 'turnstile_line', 'kind': 'turnstiles', 'position': [0, 0, 188], 'rot': FACE_S, 'w': 60, 'd': 1.6, 'h': 1.1,
             'items': turnstiles, 'style': 'brushed steel turnstiles between brick piers, low green canopy over the line'}, on_path_ok=True)
    # main street facades
    pal_walls = ['#F3E6CC', '#E8C9A0', '#C8463A', '#9DB7A5', '#F2D2B6', '#B9CFE0', '#E9B44C', '#D98E73']
    pal_awn = ['#C8463A', '#2F6E8E', '#2D5E4A', '#D9A441', '#7B3F61']
    roofs = ['mansard', 'gable_front', 'flat_cornice', 'hipped']
    k = 0
    for side, sx, rot in [('W', -1, FACE_E), ('E', 1, FACE_W)]:
        for z0, z1 in [(35.5, 70.5), (75.5, 110.5)]:
            z = z0
            while z < z1 - 0.1:
                w = min(rng.choice([7.0, 8.0, 9.0, 10.0, 12.0]), z1 - z)
                if z1 - z - w < 5:
                    w = z1 - z
                storeys = int(rng.choice([2, 2, 3, 3, 3]))
                corner = (z == z0) or (z + w >= z1 - 0.1)
                h = 4.2 + 3.4 * 0.85 + (3.0 * 0.72 if storeys == 3 else 0)
                add_bld({'id': 'ms_%s%02d' % (side, k), 'kind': 'main_street_shop', 'position': [R(sx * 17), 0, R(z + w / 2)], 'rot': R(rot),
                         'w': R(w), 'd': 16, 'h': R(h), 'storeys': storeys,
                         'storey_heights': [4.2, R(3.4 * 0.85), R(3.0 * 0.72)][:storeys],
                         'forced_perspective': 'upper storeys scaled 85% and 72%',
                         'roof': 'corner_turret_dome' if corner and rng.random() < 0.6 else str(rng.choice(roofs)),
                         'wall': str(rng.choice(pal_walls)), 'trim': '#FFFFFF', 'awning': str(rng.choice(pal_awn)),
                         'awning_style': str(rng.choice(['striped', 'scalloped', 'plain'])),
                         'shopfront': str(rng.choice(['display_windows', 'arcade', 'bay_window', 'double_doors'])),
                         'window_boxes': True, 'facade_faces': 'main street', 'palette': 'main_street'})
                k += 1
                z += w
    # town square
    add_bld({'id': 'bandstand', 'kind': 'bandstand', 'position': [-24, 0, 128], 'rot': FACE_E, 'w': 10, 'd': 10, 'h': 7.5,
             'style': 'octagonal, white cast-iron columns, red-white striped onion roof, raised 1 m on brick plinth with steps, bunting to lamp posts',
             'lawn': {'circle': [-24, 128, 8]}}, on_path_ok=True)
    add_bld({'id': 'first_aid', 'kind': 'first_aid', 'position': [-51, 0, 128], 'rot': FACE_E, 'w': 14, 'd': 12, 'h': 6.5,
             'style': 'white cottage, green shutters, a plain white-on-green cross panel', 'palette': 'main_street'})
    add_bld({'id': 'guest_services', 'kind': 'guest_services', 'position': [51, 0, 124], 'rot': FACE_W, 'w': 14, 'd': 12, 'h': 7,
             'style': 'brick civic building with clock gable (no numerals required)', 'palette': 'main_street'})
    add_bld({'id': 'gate_station', 'kind': 'railway_station', 'position': [35, 4.8, 151], 'rot': FACE_N, 'w': 42, 'd': 9, 'h': 6,
             'style': 'see rides.railway.params.station', 'palette': 'entrance'}, on_path_ok=True)
    # hub
    add_bld({'id': 'restroom_hub_w', 'kind': 'restroom', 'position': [-58, 0, 20], 'rot': FACE_N, 'w': 14, 'd': 8, 'h': 4.5, 'style': 'brick pavilion, hidden by shrubs'})
    add_bld({'id': 'restroom_hub_e', 'kind': 'restroom', 'position': [58, 0, -22], 'rot': FACE_S, 'w': 14, 'd': 8, 'h': 4.5, 'style': 'brick pavilion, hidden by shrubs'})
    # seaside
    add_bld({'id': 'boathouse', 'kind': 'boathouse', 'position': [-190, 0, 116], 'rot': FACE_N, 'w': 18, 'd': 10, 'h': 7,
             'style': 'white clapboard boathouse with blue roof, cupola, flags', 'palette': 'seaside'})
    add_bld({'id': 'fish_chips', 'kind': 'food_kiosk', 'position': [-122, 0, 24], 'rot': FACE_N, 'w': 10, 'd': 6, 'h': 4.5,
             'style': 'striped beach-hut kiosk, blue/white, umbrellas in front', 'palette': 'seaside'})
    add_bld({'id': 'seaside_shop', 'kind': 'shop', 'position': [-132, 0, -14], 'rot': FACE_E, 'w': 8, 'd': 12, 'h': 5.5,
             'style': 'pier pavilion with domed roof', 'palette': 'seaside'})
    add_bld({'id': 'restroom_seaside', 'kind': 'restroom', 'position': [-164, 0, 128], 'rot': FACE_N, 'w': 12, 'd': 7, 'h': 4.2, 'style': 'beach hut style'})
    # jungle
    add_bld({'id': 'jungle_trading_post', 'kind': 'shop', 'position': [-84, 0, -84], 'rot': FACE_S, 'w': 12, 'd': 9, 'h': 6,
             'style': 'bamboo and thatch trading post with crates', 'palette': 'jungle'})
    add_bld({'id': 'jungle_snacks', 'kind': 'food_kiosk', 'position': [-128, 0, -56], 'rot': FACE_N, 'w': 9, 'd': 6, 'h': 4.5,
             'style': 'thatched hut, tiki torches', 'palette': 'jungle'})
    add_bld({'id': 'restroom_jungle', 'kind': 'restroom', 'position': [-168, 0, -52], 'rot': FACE_S, 'w': 12, 'd': 7, 'h': 4.2, 'style': 'stone hut'})
    # thrill
    add_bld({'id': 'thrill_shop', 'kind': 'shop', 'position': [-30, 0, -70], 'rot': FACE_S, 'w': 14, 'd': 10, 'h': 6,
             'style': 'glass-fronted modern pavilion with red fins (coaster exit shop)', 'palette': 'thrill'})
    add_bld({'id': 'thrill_food', 'kind': 'food_kiosk', 'position': [92, 0, -66], 'rot': FACE_S, 'w': 10, 'd': 6, 'h': 4.5,
             'style': 'container-style snack bar, navy with yellow', 'palette': 'thrill'})
    add_bld({'id': 'restroom_thrill', 'kind': 'restroom', 'position': [166, 0, -76], 'rot': FACE_W, 'w': 12, 'd': 7, 'h': 4.2, 'style': 'modern block'})
    # frontier
    fx = [('saloon', 214, 6, 16, 'two-storey saloon with balcony and false front, swing doors'),
          ('general_store', 214, 22, 12, 'false-front general store with porch'),
          ('assay_office', 214, 36, 10, 'brick assay office with arched windows'),
          ('livery', 214, 50, 14, 'barn-red livery stable')]
    for name, x, z, w, st in fx:
        add_bld({'id': 'frontier_' + name, 'kind': 'frontier_building', 'position': [x, 0, z], 'rot': FACE_W, 'w': w, 'd': 10, 'h': 8 if name == 'saloon' else 6.5,
                 'style': st, 'boardwalk_porch': True, 'palette': 'frontier'})
    add_bld({'id': 'water_tower', 'kind': 'water_tower', 'position': [205, 0, -30], 'rot': FACE_S, 'w': 6, 'd': 6, 'h': 14,
             'style': 'timber tank on trestle legs with conical roof'})
    add_bld({'id': 'restroom_frontier', 'kind': 'restroom', 'position': [168, 0, -36], 'rot': FACE_E, 'w': 10, 'd': 7, 'h': 4.2, 'style': 'log cabin'})
    # midway
    add_bld({'id': 'food_court_pavilion', 'kind': 'food_court', 'position': [78, 0, 120], 'rot': FACE_N, 'w': 40, 'd': 14, 'h': 8,
             'style': 'circus-striped big-top style pavilion (red/cream), 4 serving windows, terrace with 30 tables + parasols in front (props)', 'palette': 'midway'})
    booths = []
    for z, rot in [(50.5, FACE_S), (69.5, FACE_N)]:
        for i, x in enumerate(np.arange(76, 176, 6.5)):
            if z > 60 and 104 <= x <= 152:      # gap in front of the bumper cars? keep booths
                pass
            booths.append({'position': [R(x), 0, z], 'rot': R(rot), 'w': 5, 'd': 3, 'h': 3.6,
                           'game': ['ring_toss', 'duck_pond', 'coconut_shy', 'shooting_gallery', 'hoopla', 'strength_test', 'popcorn', 'candy_floss', 'balloon_darts'][i % 9],
                           'awning': ['#D7263D', '#1B998B', '#F4B942', '#2E294E'][i % 4]})
    add_bld({'id': 'midway_booths', 'kind': 'game_booth_rows', 'position': [126, 0, 60], 'rot': FACE_S, 'w': 106, 'd': 22, 'h': 3.6,
             'items': booths, 'style': 'striped awnings, prize shelves with plush toys, bulb fascia'}, on_path_ok=True)
    add_bld({'id': 'restroom_midway', 'kind': 'restroom', 'position': [168, 0, 112], 'rot': FACE_N, 'w': 12, 'd': 7, 'h': 4.2, 'style': 'striped pavilion'})
    # kiddie
    add_bld({'id': 'kiddie_sweets', 'kind': 'food_kiosk', 'position': [-66, 0, 50], 'rot': FACE_W, 'w': 6, 'd': 6, 'h': 5,
             'style': 'cupcake-shaped kiosk, pastel', 'palette': 'kiddie'})
    add_bld({'id': 'restroom_kiddie', 'kind': 'restroom', 'position': [-56, 0, 128], 'rot': FACE_E, 'w': 10, 'd': 7, 'h': 4.2, 'style': 'pastel cottage with baby-change'})

    # ===================================================================== PARKING & BACKSTAGE
    cars = []
    car_cols = ['#C0392B', '#2E86C1', '#F2F2F2', '#1C1C1C', '#7F8C8D', '#BDC3C7', '#27AE60', '#F1C40F', '#8E44AD', '#D35400']
    rows_z = [228, 244, 260, 276, 292]
    lamp_poles = []
    for rz in rows_z:
        for side in (-1, 1):
            zz = rz + side * 3.2
            for x in np.arange(-226, 226, 2.7):
                if abs(x) < 10:          # tram lane / walkway
                    continue
                if rng.random() < 0.78:
                    cars.append([R(x + rng.normal(0, 0.08)), R(zz), R((FACE_N if side < 0 else FACE_S) + rng.normal(0, 0.04)), int(rng.integers(len(car_cols)))])
        for x in np.arange(-220, 230, 40):
            lamp_poles.append([R(x), R(rz)])
    parking = {'lot': {'polygon': [[-232, 216], [232, 216], [232, 300], [-232, 300]], 'surface': 'asphalt_grey'},
               'aisles_z': rows_z, 'stall': {'w': 2.6, 'd': 5.0}, 'car_colors': car_cols,
               'cars': {'format': '[x, z, rot, colorIndex]', 'size': [1.8, 1.45, 4.4], 'list': cars},
               'tree_islands': [[R(x), R(z)] for z in [236, 268] for x in np.arange(-200, 220, 50)],
               'lamp_poles': lamp_poles,
               'tram_lane': {'from': [0, 300], 'to': [0, 214], 'width': 8, 'trams': [{'s': 0.3}, {'s': 0.75}], 'tram': 'open trailers behind a small tractor, striped canopy'},
               'dropoff_canopy': {'center': [0, 0, 214], 'w': 24, 'd': 6, 'h': 4}}
    backstage = {
        'service_road': {'points': [[-300, -230], [300, -230], [310, -60], [305, 175], [240, 214]], 'width': 7, 'surface': 'service'},
        'compound': {'polygon': [[60, -262], [250, -262], [250, -222], [60, -222]], 'surface': 'service'},
        'buildings': [
            {'id': 'maintenance_shop', 'position': [110, 0, -246], 'w': 60, 'd': 26, 'h': 10, 'style': 'grey steel shed, roller doors'},
            {'id': 'warehouse', 'position': [185, 0, -244], 'w': 40, 'd': 30, 'h': 9, 'style': 'grey steel shed'},
            {'id': 'staff_canteen', 'position': [230, 0, -240], 'w': 18, 'd': 12, 'h': 5, 'style': 'portacabins'}],
        'staff_cars': [[R(x), -228.5, FACE_N] for x in np.arange(70, 240, 3)],
        'tunnel_under_berm': {'x': 150, 'z': -200, 'note': 'hidden service tunnel portal on outer berm slope'},
        'outside': 'dense mixed woodland on all sides beyond the service road; rolling farmland and hedgerows beyond 400 m; distant blue hills on the north horizon',
    }

    add_bld({'id': 'lighthouse_folly', 'kind': 'lighthouse_folly', 'position': [-218, 0, 52], 'rot': FACE_E, 'w': 5, 'd': 5, 'h': 16,
             'style': 'decorative red/white striped lighthouse on Gull Island, gallery rail, lantern glows at night; island has pines, rocks, a tiny jetty',
             'palette': 'seaside'})
    # ===================================================================== water extras
    water.append({'id': 'gull_island', 'kind': 'island', 'level': 0.6, 'polygon': [[-232, 46], [-226, 38], [-214, 37], [-205, 44], [-204, 56], [-212, 64], [-226, 63], [-233, 56]],
                  'note': 'grass island inside the lake (land, not water): rocks at the edge, pines, lighthouse folly'})
    water.append({'id': 'hub_moat', 'kind': 'fountain_moat', 'level': 0.35, 'annulus': [0, 0, 8.5, 12.0],
                  'jets': {'count': 24, 'radius': 10.2, 'height': 3.0, 'arc_toward_center': True}})
    water.append({'id': 'flume_splash_pool', 'kind': 'pool', 'level': 0.4, 'polygon': pl(rect(-74, -114, 9, 22, 0))})
    water.append({'id': 'kiddie_boat_pool', 'kind': 'pool', 'level': 0.3, 'circle': [-112, 46, 7.0]})
    water.append({'id': 'square_fountain', 'kind': 'fountain', 'level': 0.5, 'circle': [0, 128, 4.0], 'jets': {'count': 8, 'height': 2.2, 'tiers': 2}})
    water.append({'id': 'entrance_fountains', 'kind': 'fountain', 'level': 0.4, 'circles': [[-55, 194, 4], [55, 194, 4]], 'jets': {'count': 6, 'height': 1.8}})

    # ===================================================================== lighting rigs (night)
    lighting_rigs = {
        'note': 'Every ride and building has bulb outlines at night. Counts are guides; renderers instance HDR bulbs.',
        'bulb_spacing_m': 0.6,
        'per_ride': {
            'ferris_wheel': 'bulbs along all 30 spokes and both rims; chase pattern outward 2 Hz',
            'carousel': 'rounding board 3 rows of bulbs, canopy ribs, mirrored drum',
            'hero_coaster': 'warm bulbs along both outer rails on the lift and the loop only; station canopy LED strip',
            'wooden_coaster': 'bulbs along the lift and first-drop handrails',
            'drop_tower': 'vertical chase of bulbs on mast, ring lights',
            'swing_ride': 'canopy edge bulbs, chase',
            'observation_tower': 'cabin underside ring, mast bands, crown spotlight up',
            'midway_booths': 'bulb fascia on every booth',
            'entrance_arch': 'bulb arch and tower outlines',
            'main_street_shop': 'warm windows, bulb outline on cornices, gas-style lamps',
            'string_lights': 'see props.string_lights (festoons)'},
        'switch_on_order_from_gate': ['entrance', 'main_street', 'hub', 'midway', 'kiddie', 'seaside', 'jungle', 'thrill', 'frontier'],
    }

    # ===================================================================== animation defaults
    animation = {
        'note': 'All rides animate from GLOBAL FILM TIME t (seconds, the edit timeline, may be <0 or >duration inside handles) so match cuts stay continuous across styles. Shots may override with shots.json -> rides.',
        'hero_coaster': {'trains': 2, 'train_offsets_s': [0.0, 'cycle/2'], 'ride_time_at_film_t0': 52.0,
                         'rule': 'ride_time = t + ride_time_at_film_t0 + train_offset ; s_front = track.sAtTime(ride_time mod cycle_time)'},
        'wooden_coaster': {'trains': 2, 'train_offsets_s': [0.0, 'cycle/2'], 'ride_time_at_film_t0': 10.0},
        'family_coaster': {'trains': 1, 'ride_time_at_film_t0': 5.0},
        'log_flume': {'boats': 8, 'spacing': 'evenly spaced by time', 'ride_time_at_film_t0': 0.0},
        'river_rapids': {'boats': 9, 'spacing': 'evenly spaced by time', 'ride_time_at_film_t0': 0.0},
        'railway': {'trains': 1, 'ride_time_at_film_t0': 40.0},
        'ferris_wheel': {'angle_at_t0_deg': 0, 'period_s': 90},
        'carousel': {'period_s': 16, 'horse_bob_period_s': 2.0},
        'teacups': {'period_main_s': 14, 'period_sub_s': 5, 'cup_spin_period_s': 2.4},
        'swing_ride': {'period_s': 5.2, 'angle_deg': 45},
        'pirate_ship': {'period_s': 7.5, 'amplitude_deg': 72, 'phase_at_t0': 0.0},
        'drop_tower': {'cycle_s': 36.1, 'phase_at_t0_s': 20.0, 'note': 'phase 20 = just after release -> mid drop at film t=0.5'},
        'observation_tower': {'cycle_s': 170, 'phase_at_t0_s': 40},
        'guests': {'walk_speed': 'per guest, 0.9-1.5 m/s', 'note': 'see guests.walkers'},
    }
    hard = unary_union([v[0] for v in bfp.values()] + [g for k, g in ride_fp.items() if not g.is_empty])
    return {'rides': rides, 'buildings': buildings, 'queues': queues, 'water': water, 'parking': parking, 'backstage': backstage,
            'lighting_rigs': lighting_rigs, 'animation': animation,
            '_hard_union': hard, '_ride_fp': ride_fp, '_building_fp': bfp, '_building_on_path_ok': b_ok, '_ride_on_path_ok': r_ok}
