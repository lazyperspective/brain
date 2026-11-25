"""The edit -> ../plan/shots.json  (run: python3 build_shots.py)"""
import json, math

FPS, BPM = 30, 120
BEAT = 60 / BPM            # 0.5 s = 15 frames
BAR = 4 * BEAT             # 2.0 s = 60 frames
DUR = 44.0
HANDLE = 6                 # frames each side
ISO = (367.4, 300.0, 367.4)  # 2:1 dimetric: elevation 30 deg, from the south-east, distance 600


def iso(target, ortho, t, ease='linear'):
    x, y, z = target
    return {'t': t, 'pos': [round(x + ISO[0], 2), round(y + ISO[1], 2), round(z + ISO[2], 2)], 'target': list(target), 'ortho': ortho, 'ease': ease}


def k(t, pos, target, fov, ease='inOut', **kw):
    d = {'t': t, 'pos': list(pos), 'target': list(target), 'fov': fov, 'ease': ease}
    d.update(kw)
    return d


# ---------------------------------------------------------------- shared camera paths
PATH_ARRIVAL = [   # shots 01 (paper) + 02 (gouache): one continuous move, match cut at 4.0
    k(-0.2, (0, 300, 30), (0, 0, 8), 30, 'linear'),
    k(0.0, (0, 300, 30), (0, 0, 8), 30, 'inOut'),
    k(1.6, (10, 470, 150), (0, 0, 10), 32, 'inOut'),
    k(3.0, (150, 380, 420), (0, 0, 0), 34, 'in'),
    k(4.0, (140, 250, 390), (0, 0, 60), 38, 'linear'),
    k(5.2, (36, 60, 290), (0, 8, 180), 44, 'out'),
    k(6.3, (0, 5.0, 198), (0, 4.5, 120), 52, 'linear'),
    k(7.0, (0, 2.8, 152), (0, 3.5, 90), 55, 'out'),
    k(7.75, (0, 7, 96), (0, 16, 0), 55, 'in'),
    k(8.0, (-3, 8, 92), (-60, 10, 40), 58, 'linear'),
    k(8.2, (-5, 8, 90), (-90, 6, 80), 60, 'linear'),
]
PATH_KIDDIE = [
    k(7.8, (-27, 31, 153), (40, 12, 110), 40, 'out'),
    k(8.3, (-28, 30, 152), (-88, 3, 92), 40, 'inOut'),
    k(11.5, (-52, 17, 126), (-94, 4, 98), 36, 'in'),
    k(12.0, (-53, 17, 125), (-60, 10, 60), 38, 'linear'),
    k(12.2, (-53, 17, 125), (-10, 14, 70), 40, 'linear'),
]
TGT_BP = (60, 10, -125)
PATH_ISO = [       # shots 04 (low-poly) + 05 (pixel): orthographic 2:1 dimetric; match cut at 16.0
    {'t': 11.8, 'pos': [580, 310, -125], 'target': list(TGT_BP), 'ortho': 95, 'ease': 'out'},
    iso(TGT_BP, 95, 12.3, 'inOut'),
    iso((70, 10, -110), 86, 15.0, 'inOut'),
    iso((130, 0, -60), 120, 16.0, 'linear'),
    iso((215, 0, -30), 120, 17.45, 'step'),
    iso((215, 0, -30), 60, 17.5, 'linear'),
    iso((200, 0, 25), 60, 18.95, 'step'),
    iso((185, 0, 45), 40, 19.0, 'linear'),
    iso((160, 0, 58), 40, 19.45, 'step'),
    iso((128, 0, 62), 20, 19.5, 'linear'),
    iso((124, 0, 62), 20, 20.2, 'linear'),
]
PATH_TOYBOX = [
    k(19.8, (158, 46, 140), (120, 6, 62), 42, 'out'),
    k(20.0, (156, 44, 136), (120, 6, 62), 40, 'inOut'),
    k(22.2, (170, 30, 128), (130, 5, 66), 40, 'inOut'),
    k(22.6, (184, 9, 104), (176, 4.5, 88), 38, 'linear'),
    k(23.3, (186, 10, 106), (176, 5, 86), 38, 'in'),
    k(24.0, (188, 14, 112), (170, 70, 50), 44, 'linear'),
    k(24.2, (188, 15, 113), (168, 120, 40), 46, 'linear'),
]
PATH_SEASIDE = [
    k(23.8, (-170, 12, 97), (-185, 100, 0), 46, 'out'),
    k(24.4, (-171, 11, 95), (-196, 13, 10), 46, 'inOut'),
    k(27.4, (-180, 8, 80), (-198, 15, -5), 42, 'in'),
    k(28.0, (-180, 8, 80), (-140, 30, 30), 46, 'linear'),
    k(28.2, (-180, 8, 80), (-110, 40, 60), 48, 'linear'),
]
PATH_LOOP_EXT = [
    iso((80, 18, -147), 27, 32.8, 'linear'),
    iso((74, 18, -145), 25, 34.2, 'linear'),
]
PATH_FINALE = [    # shots 15 (tilt-shift) + 16 (snow globe): match cut at 40.0
    k(35.8, (56, 8, -50), (5, 11, -120), 38, 'linear'),
    k(36.6, (55, 9, -50), (5, 11, -120), 38, 'inOut'),
    k(38.0, (40, 70, 40), (5, 4, -70), 40, 'inOut'),
    k(40.0, (20, 330, 470), (0, 0, -20), 40, 'out'),
    k(40.9, (60, 520, 1350), (0, 60, -20), 36, 'linear'),
    k(42.6, (40, 470, 1300), (0, 80, -20), 36, 'inOut'),
    k(44.0, (0, 140, 670), (0, -160, 648), 30, 'linear'),
    k(44.2, (0, 140, 670), (0, -160, 648), 30, 'linear'),
]


def pov(tau0, t0, rate, head, fov=80, look=14):
    return {'mode': 'pov', 'ride': 'hero_coaster', 'train': 0, 'seat_back_m': 0.7, 'eye': [0, 1.25, 0], 'look_ahead_m': look, 'fov': fov,
            'head': head}, {'hero_coaster': {'t0': t0, 'tau0': tau0, 'rate': rate}}


SHOTS = []


def shot(n, slug, style, agent, start, end, action, camera, transform=None, beats=(), focus=None, must=(), tin=None, tout=None,
         rides=None, lighting='day', twos=False, notes=''):
    f0, f1 = round(start * FPS), round(end * FPS)
    frames = f1 - f0 + 2 * HANDLE
    SHOTS.append({
        'id': '%02d_%s' % (n, slug), 'n': n, 'style': style, 'agent': agent,
        'start': start, 'end': end, 'start_frame': f0, 'end_frame': f1, 'film_frames': f1 - f0,
        'bars': '%g-%g' % (start / BAR + 1, end / BAR + 1),
        'render': {'t_start': round(start - HANDLE / FPS, 4), 't_end': round(end + HANDLE / FPS, 4), 'frames': frames, 'handles': HANDLE,
                   'frame_time': 'frame i (0-based) shows film time t = t_start + i/30', 'on_twos': twos,
                   'unique_frames': (frames + 1) // 2 if twos else frames,
                   'output': 'film/shots/%02d_%s.mp4' % (n, slug), 'size': [1920, 1080]},
        'transformation': transform, 'action': action, 'beats': list(beats), 'camera': camera, 'focus': focus,
        'must_show': list(must), 'transition_in': tin, 'transition_out': tout, 'rides': rides or {}, 'lighting': lighting, 'notes': notes,
    })


# =====================================================================================
shot(1, 'paper_ticket', 'paper', 'c', 0.0, 4.0,
     'Top-down on a folded paper ticket lying on the walnut table. It unfolds flap by flap on the beat into the full park map; pop-ups ripple out from the hub; the hero coaster strip springs up last. The camera rises and swings to a high south-east 3/4 view and starts to dive toward the gate.',
     {'mode': 'perspective', 'interp': 'catmull', 'fov': 34, 'keys': PATH_ARRIVAL},
     transform={'name': 'ticket unfolds into the park (paper pop-up)', 'start': 0.0, 'end': 3.6},
     beats=[{'t': 0.0, 'e': 'FRAME 0 = LOOP FRAME: closed ticket, still. Left flap starts flipping on frame 1 (paper thwack hit)'},
            {'t': 0.5, 'e': 'right flap lands'}, {'t': 1.0, 'e': 'rows +-1 roll open'}, {'t': 1.5, 'e': 'rows +-2 roll open; sheet lies flat'},
            {'t': 2.0, 'e': 'pop-up ripple starts at the hub tower and spreads outward by distance (~250 m/s)'},
            {'t': 2.5, 'e': 'main street facades, Ferris wheel and carousel are up'},
            {'t': 3.0, 'e': 'hero coaster strip springs up with overshoot (boing); other coasters 3.0-3.25'},
            {'t': 3.5, 'e': 'train drops off the crest; flags flutter'}],
     focus={'target': [0, 0, 8], 'dof': 'shallow on the table at t<1.6 (ticket sharp, table edges soft), then deep'},
     must=['ticket print (plan/ticket_print.png) on the closed stack', 'whole park layout incl. car park', 'hero_coaster spring-up', 'observation_tower first'],
     tin={'type': 'loop', 'note': 'frame 0 must equal the last frame of shot 16 (same ticket, same pose relative to the ticket, same table/light)'},
     tout={'type': 'match_cut', 'note': 'camera keeps moving on PATH_ARRIVAL; style changes to gouache at t=4.0 (downbeat bar 3)'},
     lighting='tabletop: warm key #FFD9A0 from upper-left-back (dir to light [-0.5,0.8,-0.35]), soft cool fill; sun direction for the pop-up park shadows the same',
     notes='SET: the map sheet covers x -300..300, z -232..248 (600 x 480 world units) and lies on the table (table top y=0). Panels 3 x 5 (each 200 x 96). Folded stack sits on the centre panel x -100..100, z -40..56, centre (0, 8). Pop-up heights are the real park heights.')

shot(2, 'gouache_arrival', 'gouache', 'a', 4.0, 8.0,
     'Continuous dive: from high over the car park down to eye level, through the entrance arch, under the railway bridge into the town square, then a push up main street toward the hub tower. Busy, joyful, alive. Ends with a whip pan left.',
     {'mode': 'perspective', 'interp': 'catmull', 'fov': 44, 'keys': PATH_ARRIVAL},
     beats=[{'t': 5.0, 'e': 'trams in the car park, crowd streaming through the turnstiles'}, {'t': 6.0, 'e': 'pass between ticket booths, under the arch (bulbs, flags)'},
            {'t': 7.0, 'e': 'under the railway bridge; a train crosses overhead (railway clock override)'}, {'t': 7.5, 'e': 'emerge on main street, bunting overhead, tower ahead'},
            {'t': 7.8, 'e': 'whip pan left begins (motion blur)'}],
     focus={'target': 'camera target', 'dof': 'deep; painterly'},
     must=['car park', 'tram', 'ticket_booth_*', 'turnstile_line', 'entrance_arch', 'railway bridge + train', 'town square bandstand', 'main street facades, bunting, lamps, crowds', 'observation_tower'],
     tin={'type': 'match_cut', 'note': 'continues shot 01 camera'}, tout={'type': 'whip_left', 'frames': 6},
     rides={'railway': {'t0': 7.0, 'tau0': 12.0, 'rate': 1.0}},
     notes='Railway override: at t=7.0 the loco front is just west of the bridge (x~-12) and the coaches are on the bridge as we pass under.')

shot(3, 'felt_kiddie', 'felt', 'c', 8.0, 12.0,
     'Kiddie Meadow starts as a flat felt applique picture and puffs up into soft 3D ride by ride on the beat; the camera drifts in toward the family coaster.',
     {'mode': 'perspective', 'interp': 'catmull', 'fov': 40, 'keys': PATH_KIDDIE},
     transform={'name': 'felt puff-up', 'start': 8.0, 'end': 11.5},
     beats=[{'t': 8.0, 'e': 'flat felt applique (pieces lying flat in side profile)'}, {'t': 8.5, 'e': 'kiddie_planes puffs'}, {'t': 9.0, 'e': 'kiddie_boats + playground'},
            {'t': 9.5, 'e': 'kiddie_trucks + kiddie_drop'}, {'t': 10.0, 'e': 'trees, topiary, hedges puff (8ths)'}, {'t': 10.5, 'e': 'family_coaster track inflates (big puff)'},
            {'t': 11.0, 'e': 'guests sit up'}, {'t': 11.5, 'e': 'everything moves; train leaves the station'}, {'t': 11.85, 'e': 'whip pan right begins'}],
     focus={'target': [-83, 4, 93], 'dof': 'shallow macro (felt miniature), focus pulls to the family coaster station'},
     must=['family_coaster', 'kiddie_planes', 'kiddie_boats', 'kiddie_trucks', 'kiddie_drop', 'playground', 'kiddie plaza', 'topiary', 'lake in background'],
     tin={'type': 'whip_left', 'frames': 6}, tout={'type': 'whip_right', 'frames': 6}, twos=True,
     rides={'family_coaster': {'t0': 11.5, 'tau0': 0.0, 'rate': 1.0}})

shot(4, 'lowpoly_blueprint', 'lowpoly', 'b', 12.0, 16.0,
     'Orthographic tycoon view of Skyline Thrills as a cyan blueprint; a wave front sweeps from south-west to north-east and extrudes the real land: coaster supports, track, station, drop tower, trees. The train starts as the wave passes the crest and dives. The camera then slides east and widens to the exact pixel-art framing.',
     {'mode': 'ortho', 'interp': 'linear', 'keys': PATH_ISO},
     transform={'name': 'blueprint to real', 'start': 12.25, 'end': 15.0},
     beats=[{'t': 12.0, 'e': 'whip-in settles; blueprint grid + wireframes'}, {'t': 12.5, 'e': 'wave enters at the SW corner of the land (x=-50,z=-50)'},
            {'t': 13.5, 'e': 'wave passes the station and lift; lift supports rise'}, {'t': 14.0, 'e': 'loop + corkscrew extrude'}, {'t': 14.5, 'e': 'wave reaches the NE corner; train crests'},
            {'t': 15.0, 'e': 'train drops; land fully real'}, {'t': 15.0, 'e': 'camera slides east and widens (ortho 86 -> 120)'}],
     focus={'target': list(TGT_BP), 'dof': 'none (ortho); optional mild tilt-shift band'},
     must=['hero_coaster full circuit', 'supports + footers', 'station + queue', 'drop_tower', 'thrill shop', 'coaster plaza crowd'],
     tin={'type': 'whip_right', 'frames': 6}, tout={'type': 'iso_match_cut', 'note': 'identical ortho camera at t=16.0; pixel art takes over'},
     rides={'hero_coaster': {'t0': 14.5, 'tau0': 63.0, 'rate': 1.0}})

shot(5, 'pixel_build', 'pixel', 'a', 16.0, 20.0,
     'Isometric pixel-art build mode on Frontier Ridge: the wooden coaster is laid piece by piece from its station with the train chasing the build head; frontier buildings and the water tower pop in with dust puffs; guests stream in at fast-forward. Snap zooms on the beat (x2, x3, x6) dive onto the empty midway lot where a single toy-box crate waits.',
     {'mode': 'ortho', 'interp': 'linear', 'keys': PATH_ISO},
     transform={'name': 'build mode', 'start': 16.0, 'end': 19.0},
     beats=[{'t': 16.0, 'e': 'track build head starts at the wooden coaster station (s=0) and advances to s=612 by 18.5 (linear)'},
            {'t': 16.2, 'e': 'train follows 8 m behind the build head until the circuit closes, then free-runs'},
            {'t': 16.5, 'e': 'saloon pops'}, {'t': 16.75, 'e': 'general store'}, {'t': 17.0, 'e': 'assay office + livery'}, {'t': 17.25, 'e': 'water tower'},
            {'t': 17.5, 'e': 'SNAP ZOOM x2'}, {'t': 17.5, 'e': 'pines pop along the ridge (16ths)'}, {'t': 18.0, 'e': 'guests stream in fast-forward, easing to walking speed by 19.0'},
            {'t': 19.0, 'e': 'SNAP ZOOM x3'}, {'t': 19.5, 'e': 'SNAP ZOOM x6 onto the midway lot: empty dirt pad + one closed toy-box crate at (120,0,62)'}],
     focus={'target': 'n/a', 'dof': 'none'},
     must=['wooden_coaster lattice', 'frontier buildings', 'water_tower', 'frontier street guests', 'midway lot with crate'],
     tin={'type': 'iso_match_cut'}, tout={'type': 'snap_zoom_cut', 'note': 'cut on the downbeat 20.0 to the tin toy box (same spot)'},
     rides={'wooden_coaster': {'t0': 16.2, 'tau0': 0.0, 'rate': 1.6}},
     notes='Native pixel grid: 480x270 upscaled x4 (nearest). ortho = half the visible world height in metres (2:1 dimetric). Snap zooms change the pixel scale, not the native grid. The midway (rides, booths, food court) is NOT built in this shot.')

shot(6, 'tin_toybox', 'tin', 'c', 20.0, 24.0,
     'A lithographed tin toy box sits on the empty midway. It rattles, the lid flips open, the walls fall flat and become the printed midway board; carousel, teacups, bumper-car pavilion, booth rows, food court and peg-doll guests spring out and land on the beat. Close on the brass wind-up key: it ratchets 1.5 turns, then the whole midway runs on clockwork. Tilt up to the sky.',
     {'mode': 'perspective', 'interp': 'catmull', 'fov': 40, 'keys': PATH_TOYBOX},
     transform={'name': 'out of the toy box + wind-up key', 'start': 20.0, 'end': 23.3},
     beats=[{'t': 20.0, 'e': 'box hop 1'}, {'t': 20.25, 'e': 'box hop 2'}, {'t': 20.5, 'e': 'lid flips open (hinged on the north edge)'}, {'t': 21.0, 'e': 'walls fall flat'},
            {'t': 21.0, 'e': 'carousel lands'}, {'t': 21.25, 'e': 'teacups'}, {'t': 21.5, 'e': 'bumper car pavilion'}, {'t': 21.75, 'e': 'booth rows (left to right, 16ths)'},
            {'t': 22.0, 'e': 'food court + umbrellas; peg-doll guests hop out 22.0-22.4'}, {'t': 22.5, 'e': 'wind-up key starts: 6 ratchet clicks on 8ths 22.5-23.25'},
            {'t': 23.25, 'e': 'release: everything runs at 6 ticks/s clockwork'}, {'t': 23.5, 'e': 'tilt up to the sky'}],
     focus={'target': [120, 6, 62], 'dof': 'shallow toy macro; pull focus to the key (176, 4.5, 88) at 22.4'},
     must=['carousel', 'teacups', 'bumper_cars', 'midway_booths', 'food_court_pavilion', 'string lights', 'wind-up key'],
     tin={'type': 'cut', 'note': 'on the downbeat after the pixel snap zoom'}, tout={'type': 'tilt_up_sky', 'note': 'ends on plain sky for the sky wipe'}, twos=True,
     notes='SET: toy box 70 x 46 x 30 centred (120, 0, 62), lid hinged on its north edge. Clockwork motor box 10 x 8 x 7 at (176, 0, 84); brass key on its south face at (176, 4.5, 88.5), key axis along z.')

shot(7, 'gouache_revival', 'gouache', 'a', 24.0, 28.0,
     'Tilt down from the painted sky onto the forgotten corner: the Seaside Pier across the lake, abandoned, grey, misty, overgrown, wheel and swings still. The lighthouse on Gull Island flickers on and a wave of colour and life blooms outward: swings, pier bunting, boats, the Ferris wheel lights up and turns, the galleon swings, guests fill the promenade. Ends with a whip up and right.',
     {'mode': 'perspective', 'interp': 'catmull', 'fov': 44, 'keys': PATH_SEASIDE},
     transform={'name': 'abandoned -> alive', 'start': 24.5, 'end': 27.5, 'origin': [-218, 16, 52], 'note': 'arrival map = distance from the lighthouse + fbm; ~90 m/s'},
     beats=[{'t': 24.5, 'e': 'lighthouse lamp ignites (bloom)'}, {'t': 25.0, 'e': 'swing_ride + pier deck colour'}, {'t': 25.5, 'e': 'pier bunting + lake boats start'},
            {'t': 26.0, 'e': 'ferris_wheel bulbs on'}, {'t': 26.5, 'e': 'wheel starts turning, pirate_ship swings'}, {'t': 27.0, 'e': 'colour reaches the camera; guests on promenade'},
            {'t': 27.6, 'e': 'whip up-right'}],
     focus={'target': [-189, 8, 10], 'dof': 'deep painterly'},
     must=['ferris_wheel', 'swing_ride on pier end', 'pier', 'lighthouse_folly on gull_island', 'lake_boats', 'pirate_ship', 'boathouse', 'promenade railing'],
     tin={'type': 'tilt_down_sky'}, tout={'type': 'whip_up_right', 'frames': 6})

# ------------------------------------------------------------------ climax: one ride, styles change on the beat
cam, rides = pov(44.0, 28.0, 4.0, [{'t': 27.8, 'yaw': 0, 'pitch': 10}, {'t': 29.3, 'yaw': -40, 'pitch': -10}, {'t': 30.2, 'yaw': -15, 'pitch': 0}])
shot(8, 'pov_lift_lowpoly', 'lowpoly', 'b', 28.0, 30.0,
     'POV from the front seat of the Red Comet climbing the chain lift; the head turns right to watch the park fall away (hub tower, midway, wooden coaster).',
     cam, beats=[{'t': 28.0, 'e': 'chain clacks on 8ths (lift x4 time-lapse)'}], focus={'dof': 'deep'},
     must=['lift chain + catwalk', 'train nose + lap bars in the bottom of frame', 'park panorama'],
     tin={'type': 'whip_up_right'}, tout={'type': 'cut', 'note': 'POV match cut, same rig'}, rides=rides)
cam, rides = pov(53.0, 30.0, 3.6, [{'t': 29.8, 'yaw': -15, 'pitch': 0}, {'t': 31.2, 'yaw': 0, 'pitch': -4}])
shot(9, 'pov_crest_gouache', 'gouache', 'a', 30.0, 31.0, 'POV: the last metres of the lift; the horizon opens over the painted park.', cam,
     must=['lift top', 'sky', 'park below'], tin={'type': 'cut'}, tout={'type': 'cut'}, rides=rides)
cam, rides = pov(59.3, 31.0, 4.2, [{'t': 30.8, 'yaw': 0, 'pitch': -4}, {'t': 31.6, 'yaw': 0, 'pitch': -10}, {'t': 32.2, 'yaw': 0, 'pitch': -28}])
shot(10, 'pov_crest_paper', 'paper', 'c', 31.0, 32.0,
     'POV: the crest turn, hanging at the top. The paper park lies spread on the table far below; the nose tips over the edge on the last frames. Music drops out.', cam,
     beats=[{'t': 31.0, 'e': 'silence, wind'}, {'t': 31.75, 'e': 'nose tips over'}], must=['paper park below', 'drop ahead'], tin={'type': 'cut'}, tout={'type': 'cut', 'note': 'THE DROP hits on 32.0'}, rides=rides)
cam, rides = pov(63.5, 32.0, 2.8, [{'t': 31.8, 'yaw': 0, 'pitch': -25}, {'t': 33.2, 'yaw': 0, 'pitch': -5}])
shot(11, 'pov_drop_felt', 'felt', 'c', 32.0, 33.0, 'POV: the first drop, plunging toward the felt valley.', cam, beats=[{'t': 32.0, 'e': 'DROP (bar 17 downbeat), whoop'}],
     must=['drop', 'felt valley + trees'], tin={'type': 'cut'}, tout={'type': 'cut'}, rides=rides, twos=True)
shot(12, 'ext_loop_pixel', 'pixel', 'a', 33.0, 34.0, 'Isometric pixel shot: the train screams through the vertical loop, sparkle trail.',
     {'mode': 'ortho', 'interp': 'linear', 'keys': PATH_LOOP_EXT}, must=['loop', 'train', 'corkscrew', 'crowd at the fence'],
     tin={'type': 'cut'}, tout={'type': 'cut'}, rides={'hero_coaster': {'t0': 33.0, 'tau0': 75.6, 'rate': 4.0}})
cam, rides = pov(77.15, 34.0, 1.7, [{'t': 33.8, 'yaw': 0, 'pitch': 5}, {'t': 35.2, 'yaw': 0, 'pitch': 0}])
shot(13, 'pov_loop_lowpoly', 'lowpoly', 'b', 34.0, 35.0, 'POV: inside the loop, upside down at the top on beat 34.5; the park hangs overhead.', cam,
     must=['inverted horizon', 'loop track ahead'], tin={'type': 'cut'}, tout={'type': 'cut'}, rides=rides)
cam, rides = pov(80.7, 35.0, 2.4, [{'t': 34.8, 'yaw': 0, 'pitch': 0}])
shot(14, 'pov_corkscrew_tin', 'tin', 'c', 35.0, 36.0, 'POV: the corkscrew; the tin-toy world spins 360 degrees.', cam,
     must=['corkscrew roll'], tin={'type': 'cut'}, tout={'type': 'cut', 'note': 'downbeat 36.0'}, rides=rides, twos=True)

shot(15, 'tiltshift_dusk', 'tiltshift', 'b', 36.0, 40.0,
     'Tilt-shift miniature: start low in the coaster plaza crowd as the train circles the helix in golden light; the sun sets, then the park lights pop on land by land on the beat while the camera cranes up and back to the whole park glittering at night.',
     {'mode': 'perspective', 'interp': 'catmull', 'fov': 40, 'keys': PATH_FINALE},
     transform={'name': 'dusk to night, lights on', 'start': 36.0, 'end': 40.0},
     beats=[{'t': 36.0, 'e': 'golden hour, sun 12 deg in the WEST'}, {'t': 37.5, 'e': 'sun gone; main street + entrance lights'}, {'t': 38.0, 'e': 'hub tower + hub ring'},
            {'t': 38.5, 'e': 'midway string lights + carousel'}, {'t': 39.0, 'e': 'seaside wheel chase + kiddie'}, {'t': 39.5, 'e': 'coaster lift bulbs, frontier, jungle torches'},
            {'t': 40.0, 'e': 'whole park lit'}],
     focus={'target': 'camera target', 'dof': 'tilt-shift band through the target, strong blur top and bottom'},
     must=['hero_coaster helix + train', 'coaster plaza crowd', 'whole park lit at the end'],
     tin={'type': 'cut', 'note': 'POV -> exterior on the downbeat'}, tout={'type': 'match_cut', 'note': 'camera keeps pulling back on PATH_FINALE; at 40.0 the glass appears'},
     rides={'hero_coaster': {'t0': 36.0, 'tau0': 85.0, 'rate': 1.0}}, lighting='dusk -> night (see park.json lighting.dusk/night)')

shot(16, 'globe_shake', 'snowglobe', 'b', 40.0, 44.0,
     'The pull-back continues and reveals the lit night park inside a snow globe on a table. The globe is shaken: snow erupts, haze, the season swaps to winter. Snow settles over the glowing park, then the camera cranes down onto the folded paper ticket lying on the table in front of the globe: the loop frame.',
     {'mode': 'perspective', 'interp': 'catmull', 'fov': 36, 'keys': PATH_FINALE},
     transform={'name': 'shake: summer night -> winter night', 'start': 41.0, 'end': 42.6},
     beats=[{'t': 40.0, 'e': 'glass rim + reflections appear (match cut)'}, {'t': 41.0, 'e': 'SHAKE jolt, snow erupts'}, {'t': 41.5, 'e': 'season swaps under the haze'},
            {'t': 42.0, 'e': 'haze clears: winter park, warm lights'}, {'t': 43.0, 'e': 'chime; crane down to the ticket'}, {'t': 44.0, 'e': 'LOOP FRAME (= shot 01 frame 0)'}],
     focus={'target': 'globe, then ticket', 'dof': 'shallow product-shot; ticket sharp at the end'},
     must=['globe with whole park', 'wooden base', 'table', 'closed ticket (plan/ticket_print.png) at the end'],
     tin={'type': 'match_cut'}, tout={'type': 'loop', 'note': 'last frame = shot 01 frame 0'}, lighting='night room, warm lamp key from the left-back (same as shot 01 table light)',
     notes='SET (world units): globe sphere centre (0,120,-20) r=400; park content clipped to r=350 around (0,-20); wooden base lathe from y=0 (r 385) to the table at y=-160 (r 440), brass rings. Table top y=-160 (walnut). Closed ticket stack 200 x 96 x 6, centre (0,-157,648), long side along x, print up, same orientation as shot 01. Final camera = ticket centre + (0, 297, 22), fov 30.')

# =====================================================================================
total_unique = sum(s['render']['unique_frames'] for s in SHOTS)
total_written = sum(s['render']['frames'] for s in SHOTS)
agents = {}
for s in SHOTS:
    a = agents.setdefault(s['agent'], {'shots': [], 'frames': 0, 'unique_frames': 0})
    a['shots'].append(s['id']); a['frames'] += s['render']['frames']; a['unique_frames'] += s['render']['unique_frames']
assert abs(SHOTS[-1]['end'] - DUR) < 1e-6
for a, b in zip(SHOTS, SHOTS[1:]):
    assert abs(a['end'] - b['start']) < 1e-6, (a['id'], b['id'])
for s in SHOTS:
    if s['camera'].get('keys'):
        K = s['camera']['keys']
        assert K[0]['t'] <= s['render']['t_start'] + 1e-6 and K[-1]['t'] >= s['render']['t_end'] - 1e-6, s['id']
out = {
    'title': 'park film montage', 'fps': FPS, 'size': [1920, 1080], 'duration': DUR, 'frames': round(DUR * FPS), 'loop': True,
    'music': {'bpm': BPM, 'beat_s': BEAT, 'beat_frames': 15, 'bar_s': BAR, 'bars': 22, 'time_signature': '4/4', 'score': 'film/audio/score.wav'},
    'camera_conventions': {
        'world': 'park.json world (metres, y up, z south)',
        'keys': 'keys[i] = {t, pos, target, fov | ortho, ease, roll?}; ease applies to the segment from this key to the next; interp catmull (uniform Catmull-Rom through pos/target, endpoint keys duplicated) or linear; step = hold until the next key',
        'ortho': 'orthographic half-height in metres (visible world height = 2*ortho); camera looks from pos toward target; iso = 2:1 dimetric, elevation 30 deg, from the south-east',
        'pov': 'ride-along: eye 1.25 m above the track centre of the front row (s_front - 0.7), look target 14 m ahead along the track; camera up = track up (horizon banks, inverts in the loop); head = yaw/pitch keyframes in degrees (yaw + = look left)',
        'evaluate': 'use ParkPlan.camera(shot, t) in park.js or park.camera(shot, t) in park.py so all styles get identical cameras',
        'up': 'world up (0,1,0) except straight-down views (0,0,-1) and POV',
    },
    'shots': SHOTS,
    'render_budget': {'written_frames': total_written, 'unique_frames': total_unique, 'agents': agents},
}
json.dump(out, open('../plan/shots.json', 'w'), indent=1)
print('shots', len(SHOTS), 'written', total_written, 'unique', total_unique)
for a, v in agents.items():
    print(a, v)
for s in SHOTS:
    print('%-22s %-9s %s %5.1f-%5.1f  %3d fr  %s' % (s['id'], s['style'], s['agent'], s['start'], s['end'], s['render']['frames'], (s['transformation'] or {}).get('name', '')))
