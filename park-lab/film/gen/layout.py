"""Hand-authored layout of the film park: lands, paths, rides, buildings.

World: x east, y up, z south, metres. Ground y=0. Park gate in the south.
Rotation convention for objects: `rot` (radians) about +y; an object's local
+z axis (its FRONT) points along world (sin rot, 0, cos rot).  rot=0 faces
south (toward the gate / default camera), rot=pi faces north,
rot=+pi/2 faces east, rot=-pi/2 faces west.
"""
import math

PI = math.pi
FACE_S, FACE_N, FACE_E, FACE_W = 0.0, PI, PI / 2, -PI / 2

SITE = {'xmin': -340, 'xmax': 340, 'zmin': -270, 'zmax': 320}
BERM = {'x': 290.0, 'z0': -200.0, 'z1': 160.0, 'r': 60.0, 'height': 5.0, 'crest': 8.0, 'base_half': 16.5}

# ---------------------------------------------------------------- lands
LANDS = [
    {'id': 'entrance', 'name': 'Gate & Promenade', 'mood': 'grand, welcoming, Edwardian seaside-town civic',
     'palette': {'primary': '#C8463A', 'secondary': '#F3E6CC', 'accent': '#2F6E8E', 'trim': '#D9A441', 'roof': '#4E5D6C', 'ground': '#B5563F'},
     'poly': [[-80, 143], [80, 143], [80, 215], [-80, 215]]},
    {'id': 'main_street', 'name': 'Main Street', 'mood': 'bustling Victorian high street, bunting, flower baskets',
     'palette': {'primary': '#C8463A', 'secondary': '#F3E6CC', 'accent': '#2F6E8E', 'trim': '#D9A441', 'roof': '#4E5D6C', 'ground': '#A9503C'},
     'poly': [[-44, 30], [44, 30], [44, 143], [-44, 143]]},
    {'id': 'hub', 'name': 'Central Gardens', 'mood': 'formal garden, fountain moat, landmark tower',
     'palette': {'primary': '#FFFFFF', 'secondary': '#D9C9A8', 'accent': '#E2B33C', 'trim': '#2D5E4A', 'roof': '#3F6F8A', 'ground': '#CDBB97'},
     'circle': [0, 0, 40]},
    {'id': 'kiddie', 'name': 'Kiddie Meadow', 'mood': 'soft pastel picture-book, rounded shapes, topiary animals',
     'palette': {'primary': '#F4A7B9', 'secondary': '#A8D8EA', 'accent': '#FFE08A', 'trim': '#B8E0B0', 'roof': '#C3A6E0', 'ground': '#F1DCC4'},
     'poly': [[-142, 40], [-44, 40], [-44, 143], [-142, 143]]},
    {'id': 'seaside', 'name': 'Seaside Pier', 'mood': 'breezy Victorian pier, striped awnings, gulls, lake sparkle',
     'palette': {'primary': '#2E86C1', 'secondary': '#FFFFFF', 'accent': '#E74C3C', 'trim': '#F5CBA7', 'roof': '#1B4F72', 'ground': '#C9A97A'},
     'poly': [[-275, -45], [-112, -45], [-112, 40], [-142, 40], [-142, 143], [-275, 143]]},
    {'id': 'jungle', 'name': 'Adventure Jungle', 'mood': 'lush overgrown ruins, mossy stone, rope bridges, mist',
     'palette': {'primary': '#2E7D4F', 'secondary': '#C9A66B', 'accent': '#D35400', 'trim': '#7B5E3B', 'roof': '#6E4B2A', 'ground': '#BFA27A'},
     'poly': [[-275, -185], [-50, -185], [-50, -45], [-275, -45]]},
    {'id': 'thrill', 'name': 'Skyline Thrills', 'mood': 'bold modern engineering, signal red and navy, chrome',
     'palette': {'primary': '#E23B2E', 'secondary': '#1F2A44', 'accent': '#F2F2F2', 'trim': '#F5B700', 'roof': '#2C3E50', 'ground': '#B9B4AE'},
     'poly': [[-50, -185], [178, -185], [178, -45], [150, -45], [150, -20], [40, -20], [40, -45], [-50, -45]]},
    {'id': 'frontier', 'name': 'Frontier Ridge', 'mood': 'timber boom-town, dusty earth, pines, water tower',
     'palette': {'primary': '#A0522D', 'secondary': '#DEB887', 'accent': '#2F7A78', 'trim': '#F4E3C1', 'roof': '#5D3A1A', 'ground': '#C2A27C'},
     'poly': [[178, -185], [275, -185], [275, 143], [196, 143], [196, 20], [150, 20], [150, -20], [178, -20]]},
    {'id': 'midway', 'name': 'Fairground Midway', 'mood': 'candy-stripe carnival, gold leaf, string lights, game booths',
     'palette': {'primary': '#D7263D', 'secondary': '#FFF4E0', 'accent': '#1B998B', 'trim': '#F4B942', 'roof': '#2E294E', 'ground': '#E6CFA8'},
     'poly': [[44, 20], [196, 20], [196, 143], [44, 143]]},
]

# ---------------------------------------------------------------- paths
# paving types (renderers map these to materials)
PAVING = {
    'brick_herringbone': {'color': '#B5563F', 'joint': '#8E3F2E', 'pattern': 'herringbone', 'module': 0.2},
    'setts_radial': {'color': '#CDBB97', 'joint': '#9C8C6E', 'pattern': 'concentric setts with compass-rose inlay', 'module': 0.12},
    'concrete_plaza': {'color': '#D8D2C4', 'joint': '#B3AB98', 'pattern': '3 m grid with red-brick bands', 'module': 3.0},
    'asphalt_tinted': {'color': '#B9785A', 'joint': '#9A5F45', 'pattern': 'tinted asphalt, light edge band 0.4 m', 'module': 0},
    'boardwalk': {'color': '#B08A5A', 'joint': '#6F5333', 'pattern': 'timber planks across travel, 0.15 m', 'module': 0.15},
    'flagstone': {'color': '#C2A57A', 'joint': '#8C7653', 'pattern': 'irregular sandstone flags with moss joints', 'module': 0.6},
    'packed_earth': {'color': '#C49A6C', 'joint': '#A27B52', 'pattern': 'compacted earth, wheel ruts, timber edge boards', 'module': 0},
    'stamped_pastel': {'color': '#F1DCC4', 'joint': '#E7B8A6', 'pattern': 'stamped concrete with pastel hopscotch inlays', 'module': 1.0},
    'checker': {'color': '#E6CFA8', 'joint': '#C9503C', 'pattern': '1 m red/cream checker tiles', 'module': 1.0},
    'queue_concrete': {'color': '#CFC7B8', 'joint': '#A79E8D', 'pattern': 'broom-finished concrete', 'module': 1.5},
    'asphalt_grey': {'color': '#55585C', 'joint': '#F2F2F2', 'pattern': 'asphalt with white bay lines', 'module': 0},
    'service': {'color': '#8A8A84', 'joint': '#6E6E68', 'pattern': 'plain concrete service road', 'module': 4},
}

# Nodes (id: (x, z)) — junctions and ends
NODES = {
    'dropoff': (0, 214), 'gate_s': (0, 206), 'gate_n': (0, 176), 'square_s': (0, 141), 'square_c': (0, 126),
    'ms_s': (0, 112), 'ms_mid': (0, 73), 'ms_n': (0, 34),
    'hub_s': (0, 34), 'hub_sw': (-24, 24), 'hub_w': (-34, 0), 'hub_nw': (-24, -24), 'hub_n': (0, -34),
    'hub_e': (34, 0), 'hub_se': (24, 24),
    'sq_w': (-40, 116), 'sq_e': (40, 116), 'side_w_n': (-38, 58), 'side_e_n': (38, 58),
    'alley_w': (-38, 73), 'alley_e': (38, 73),
    'spoke_sw_j': (-45, 45), 'spoke_se_j': (45, 45),
    'kiddie': (-82, 66), 'seaside': (-122, 2), 'jungle': (-100, -66), 'coaster_plaza': (24, -56),
    'frontier': (172, -10), 'midway_w': (60, 60), 'midway_e': (182, 60),
    'shore_n': (-140, -22), 'shore_s': (-140, 108), 'boathouse': (-190, 105), 'pier_root': (-140, 10),
    'wheel_plaza': (-195, -22), 'ship': (-150, -22),
    'jungle_w': (-160, -68), 'rapids_q': (-178, -68), 'darkride_q': (-145, -132), 'flume_q': (-140, -80),
    'thrill_e': (110, -56), 'droptower': (138, -70), 'thrill_ne': (158, -32), 'tower_q': (154, -92),
    'frontier_s': (200, 20), 'frontier_q': (205, 92), 'frontier_n': (186, -70), 'frontier_nn': (196, -128),
    'kiddie_w': (-112, 66), 'kiddie_n': (-78, 40),
}

# Edges: (a, b, width, paving, class, [intermediate points])
EDGES = [
    ('dropoff', 'gate_s', 16, 'concrete_plaza', 'main', []),
    ('gate_s', 'gate_n', 16, 'concrete_plaza', 'main', []),
    ('gate_n', 'square_s', 14, 'brick_herringbone', 'main', []),          # tunnel under the railway bridge
    ('ms_s', 'ms_n', 18, 'brick_herringbone', 'main', []),               # MAIN STREET
    ('sq_w', 'side_w_n', 8, 'brick_herringbone', 'side', [(-38, 104)]),
    ('sq_e', 'side_e_n', 8, 'brick_herringbone', 'side', [(38, 104)]),
    ('side_w_n', 'spoke_sw_j', 8, 'brick_herringbone', 'side', []),
    ('side_e_n', 'spoke_se_j', 8, 'brick_herringbone', 'side', []),
    ('alley_w', (-9, 73), 5, 'brick_herringbone', 'alley', []),
    ('alley_e', (9, 73), 5, 'brick_herringbone', 'alley', []),
    # spokes
    ('hub_sw', 'kiddie', 10, 'asphalt_tinted', 'spoke', [(-45, 45), (-66, 60)]),
    ('hub_w', 'seaside', 10, 'asphalt_tinted', 'spoke', [(-70, 2)]),
    ('hub_nw', 'jungle', 10, 'flagstone', 'spoke', [(-50, -40), (-80, -58)]),
    ('hub_n', 'coaster_plaza', 12, 'asphalt_tinted', 'spoke', [(4, -46)]),
    ('hub_e', 'frontier', 10, 'asphalt_tinted', 'spoke', [(90, -4), (140, -8)]),
    ('hub_se', 'midway_w', 10, 'checker', 'spoke', [(45, 45)]),
    # land loop
    ('kiddie', 'kiddie_w', 8, 'stamped_pastel', 'loop', []),
    ('kiddie_w', 'shore_s', 7, 'boardwalk', 'loop', [(-128, 70), (-140, 84)]),
    ('kiddie', 'kiddie_n', 6, 'stamped_pastel', 'loop', [(-80, 52)]),
    ('kiddie_n', 'seaside', 6, 'stamped_pastel', 'loop', [(-90, 26), (-110, 10)]),
    ('shore_s', 'pier_root', 7, 'boardwalk', 'loop', [(-142, 60)]),
    ('pier_root', 'shore_n', 7, 'boardwalk', 'loop', [(-142, -8)]),
    ('seaside', 'pier_root', 10, 'boardwalk', 'loop', []),
    ('pier_root', (-178, 10), 9, 'boardwalk', 'pier', []),                       # the pier deck
    ('shore_s', 'boathouse', 6, 'boardwalk', 'loop', [(-160, 116)]),
    ('shore_n', 'ship', 7, 'boardwalk', 'loop', []),
    ('ship', 'wheel_plaza', 7, 'boardwalk', 'loop', [(-172, -22)]),
    ('wheel_plaza', (-246, -22), 5, 'boardwalk', 'far', [(-225, -20)]),
    ('seaside', 'jungle', 8, 'flagstone', 'loop', [(-112, -20), (-108, -48)]),
    ('ship', 'jungle_w', 6, 'flagstone', 'loop', [(-150, -40), (-158, -56)]),
    ('jungle', 'jungle_w', 8, 'flagstone', 'loop', [(-130, -70)]),
    ('jungle_w', 'rapids_q', 6, 'flagstone', 'loop', []),
    ('jungle_w', 'darkride_q', 7, 'flagstone', 'loop', [(-145, -80), (-141, -105)]),
    ('jungle', 'coaster_plaza', 8, 'asphalt_tinted', 'loop', [(-60, -58), (-20, -56)]),
    ('coaster_plaza', 'thrill_e', 8, 'asphalt_tinted', 'loop', [(70, -55)]),
    ('thrill_e', 'droptower', 8, 'asphalt_tinted', 'loop', []),
    ('droptower', 'tower_q', 6, 'asphalt_tinted', 'spoke', []),
    ('droptower', 'thrill_ne', 8, 'asphalt_tinted', 'loop', [(152, -52)]),
    ('thrill_ne', 'frontier', 8, 'packed_earth', 'loop', []),
    ('frontier', 'frontier_s', 10, 'packed_earth', 'loop', [(192, 2)]),
    ('frontier_s', 'midway_e', 10, 'packed_earth', 'loop', [(194, 46)]),
    ('frontier_s', 'frontier_q', 8, 'packed_earth', 'loop', [(205, 50)]),
    ('frontier', 'frontier_n', 8, 'packed_earth', 'loop', [(184, -40)]),
    ('frontier_n', 'frontier_nn', 6, 'packed_earth', 'far', [(194, -100)]),
    ('midway_w', 'midway_e', 12, 'checker', 'loop', []),                          # the MIDWAY avenue
    ('midway_w', 'sq_e', 8, 'brick_herringbone', 'loop', [(52, 96), (44, 110)]),
]

# Plazas: polygons (paved) id -> (paving, polygon or circle)
PLAZAS = {
    'entrance_plaza': ('concrete_plaza', {'poly': [[-75, 176], [75, 176], [75, 212], [-75, 212]], 'round': 8}),
    'town_square': ('brick_herringbone', {'poly': [[-42, 112], [42, 112], [42, 143], [-42, 143]], 'round': 6}),
    'hub_ring': ('setts_radial', {'circle': [0, 0, 34], 'hole': 15}),
    'kiddie_plaza': ('stamped_pastel', {'circle': [-82, 66, 13]}),
    'seaside_plaza': ('boardwalk', {'circle': [-122, 2, 13]}),
    'pier_end': ('boardwalk', {'circle': [-189, 10, 13]}),
    'jungle_plaza': ('flagstone', {'circle': [-100, -66, 11]}),
    'coaster_plaza': ('asphalt_tinted', {'poly': [[-14, -64], [64, -64], [64, -48], [-14, -48]], 'round': 4}),
    'frontier_plaza': ('packed_earth', {'circle': [172, -10, 14]}),
    'droptower_plaza': ('asphalt_tinted', {'circle': [138, -70, 9]}),
    'wheel_plaza': ('boardwalk', {'poly': [[-212, -26], [-178, -26], [-178, -18], [-212, -18]], 'round': 2}),
    'food_court': ('checker', {'poly': [[56, 72], [100, 72], [100, 112], [56, 112]], 'round': 4}),
    'midway_west_bulb': ('checker', {'circle': [60, 60, 10]}),
    'midway_east_bulb': ('checker', {'circle': [182, 60, 10]}),
    'frontier_street': ('packed_earth', {'poly': [[186, -4], [204, -4], [208, 60], [190, 60]], 'round': 2}),
}

LAKE = [[-150, -6], [-170, -9], [-200, -8], [-232, -6], [-252, 6], [-262, 26], [-258, 52], [-248, 78],
        [-226, 96], [-196, 100], [-170, 98], [-152, 92], [-148, 70], [-150, 46], [-149, 22], [-148, 0]]
