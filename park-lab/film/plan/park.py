"""park.py: Python mirror of park.js (for the numpy/PIL renderers, e.g. pixel art).

    import sys; sys.path.insert(0, 'film/plan'); import park as PP
    park = PP.load('film/plan/park.json')
    park.height_at(x, z)
    tr = park.track('hero_coaster'); f = tr.sample(s)  # dict pos/tangent/up/right/bank/tag/speed/time
    tr.s_at_time(tau); tr.cars(s_front, n, car_len, gap)
    park.ride_time(ride_id, t, train=0, shot=None); park.train_fronts(ride_id, t, shot)
    park.camera(shot, t)    # same interpolation as park.js (Catmull-Rom + easing, ortho or perspective, pov)
    park.guests_at(t)       # walkers Nx5 array [x, z, heading, colorIndex, isChild]
    park.flat_ride(id, t)
    ParkPlan.iso_project(...) helpers for 2:1 dimetric ortho cameras: see iso_basis()
"""
import json, math, base64
import numpy as np

EASE = {
    'linear': lambda u: u,
    'in': lambda u: u ** 3,
    'out': lambda u: 1 - (1 - u) ** 3,
    'inOut': lambda u: 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2,
    'smooth': lambda u: u * u * (3 - 2 * u),
    'step': lambda u: 0.0,
}


def _n(v):
    v = np.asarray(v, float)
    l = np.linalg.norm(v)
    return v / l if l > 0 else v


def _catmull(p0, p1, p2, p3, u):
    p0, p1, p2, p3 = map(lambda a: np.asarray(a, float), (p0, p1, p2, p3))
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)


def _rot(v, k, a):
    v, k = np.asarray(v, float), np.asarray(k, float)
    return v * math.cos(a) + np.cross(k, v) * math.sin(a) + k * np.dot(k, v) * (1 - math.cos(a))


class Track:
    def __init__(self, tid, d):
        self.id, self.d = tid, d
        self.n, self.length, self.cycle_time = d['n'], d['length'], d['cycle_time']
        self.s = np.array(d['s']); self.time = np.array(d['time'])
        self.P = np.array(d['pos']).reshape(-1, 3); self.T = np.array(d['tangent']).reshape(-1, 3); self.U = np.array(d['up']).reshape(-1, 3)
        self.V = np.array(d['speed']); self.tag_idx = np.array(d['tag']); self.tags = d['tags']; self.segments = d['segments']
        self.supports = d.get('supports', []); self.bents = d.get('bents', [])

    def wrap(self, s):
        return s % self.length

    def sample(self, s):
        s = self.wrap(s)
        i = min(max(int(np.searchsorted(self.s, s, side='right')) - 1, 0), self.n - 2)
        u = (s - self.s[i]) / max(self.s[i + 1] - self.s[i], 1e-9)
        pos = self.P[i] * (1 - u) + self.P[i + 1] * u
        T = _n(self.T[i] * (1 - u) + self.T[i + 1] * u)
        U = self.U[i] * (1 - u) + self.U[i + 1] * u
        U = _n(U - T * np.dot(U, T))
        h = _n(np.cross([0, 1, 0], T))
        bank = math.degrees(math.atan2(np.dot(U, -h), U[1]))
        return {'s': s, 'pos': pos, 'tangent': T, 'up': U, 'right': np.cross(T, U), 'bank': bank,
                'tag': self.tags[self.tag_idx[i]], 'speed': self.V[i] * (1 - u) + self.V[i + 1] * u, 'time': self.time[i] * (1 - u) + self.time[i + 1] * u}

    def s_at_time(self, tau):
        tau = tau % self.cycle_time
        return float(np.interp(tau, self.time, self.s))

    def time_at_s(self, s):
        return float(np.interp(self.wrap(s), self.s, self.time))

    def cars(self, s_front, n, car_len, gap):
        return [self.sample(s_front - car_len / 2 - k * (car_len + gap)) for k in range(n)]


class Park:
    def __init__(self, data):
        self.data = data
        g = data['terrain']['grid']
        self.grid = g
        self.H = np.frombuffer(base64.b64decode(g['data']), dtype='<i2').reshape(g['nz'], g['nx']).astype(np.float32) / 100.0
        self._tracks = {}
        self.rides = {r['id']: r for r in data['rides']}
        self.edges = {}
        for e in data['paths']['edges']:
            pts = np.array(e['points'], float)
            cum = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
            self.edges[e['id']] = dict(e, _pts=pts, _cum=cum, _L=cum[-1])

    def height_at(self, x, z):
        g = self.grid
        i = np.clip((np.asarray(x) - g['x0']) / g['cell'], 0, g['nx'] - 1.001)
        j = np.clip((np.asarray(z) - g['z0']) / g['cell'], 0, g['nz'] - 1.001)
        i0, j0 = np.floor(i).astype(int), np.floor(j).astype(int)
        fi, fj = i - i0, j - j0
        H = self.H
        return (H[j0, i0] * (1 - fi) + H[j0, i0 + 1] * fi) * (1 - fj) + (H[j0 + 1, i0] * (1 - fi) + H[j0 + 1, i0 + 1] * fi) * fj

    def track(self, tid):
        if tid not in self._tracks:
            self._tracks[tid] = Track(tid, self.data['tracks'][tid])
        return self._tracks[tid]

    def ride_time(self, ride_id, t, train=0, shot=None):
        tr = self.track(ride_id)
        anim = self.data['animation'].get(ride_id, {})
        n = anim.get('trains', anim.get('boats', 1))
        offs = train * tr.cycle_time / n
        ov = (shot or {}).get('rides', {}).get(ride_id)
        if ov:
            return ov['tau0'] + (t - ov['t0']) * ov.get('rate', 1.0) - offs
        return t + anim.get('ride_time_at_film_t0', 0) - offs

    def train_fronts(self, ride_id, t, shot=None):
        anim = self.data['animation'].get(ride_id, {})
        n = anim.get('trains', anim.get('boats', 1))
        tr = self.track(ride_id)
        return [tr.s_at_time(self.ride_time(ride_id, t, k, shot)) for k in range(n)]

    def trains(self, ride_id, t, shot=None):
        tp = self.rides[ride_id]['params']['train']
        tr = self.track(ride_id)
        return [tr.cars(s, tp['cars'], tp['car_length'], tp['car_gap']) for s in self.train_fronts(ride_id, t, shot)]

    def edge_point(self, eid, u):
        e = self.edges[eid]
        s = min(max(u, 0), 1) * e['_L']
        c = e['_cum']
        i = min(max(int(np.searchsorted(c, s, side='right')) - 1, 0), len(c) - 2)
        a, b = e['_pts'][i], e['_pts'][i + 1]
        seg = max(c[i + 1] - c[i], 1e-9)
        f = (s - c[i]) / seg
        p = a + (b - a) * f
        return p[0], p[1], (b[0] - a[0]) / seg, (b[1] - a[1]) / seg

    def guests_at(self, t):
        W = self.data['guests']['walkers']['list']
        out = np.zeros((len(W), 5), np.float32)
        for k, (eid, u0, d, spd, lat, ci, child) in enumerate(W):
            L = self.edges[eid]['_L']
            u = (u0 + d * spd * t / L) % 2
            dd = d
            if u > 1:
                u, dd = 2 - u, -d
            x, z, dx, dz = self.edge_point(eid, u)
            out[k] = [x - dz * lat, z + dx * lat, math.atan2(dx * dd, dz * dd), ci, child]
        return out

    def flat_ride(self, rid, t):
        a = self.data['animation'].get(rid, {})
        TAU = 2 * math.pi
        if rid == 'ferris_wheel':
            return {'angle': math.radians(a.get('angle_at_t0_deg', 0)) + TAU * t / a['period_s']}
        if rid == 'pirate_ship':
            return {'swing_deg': a['amplitude_deg'] * math.sin(TAU * t / a['period_s'] + a.get('phase_at_t0', 0))}
        return {'angle': TAU * t / a.get('period_s', a.get('period_main_s', 10))}

    # ------------------------------------------------------------------ camera (mirrors park.js)
    def camera(self, shot, t):
        cam = shot['camera']
        if cam.get('mode') == 'pov':
            return self._pov(shot, t)
        K = cam['keys']
        if t <= K[0]['t']:
            i = 0
        elif t >= K[-1]['t']:
            i = max(len(K) - 2, 0)
        else:
            i = 0
            while i < len(K) - 2 and K[i + 1]['t'] <= t:
                i += 1
        k0, k1 = K[max(i - 1, 0)], K[i]
        k2, k3 = K[min(i + 1, len(K) - 1)], K[min(i + 2, len(K) - 1)]
        u = 0.0 if len(K) == 1 else min(max((t - k1['t']) / ((k2['t'] - k1['t']) or 1), 0), 1)
        ease = k1.get('ease', 'linear')
        u = (1.0 if t >= k2['t'] else 0.0) if ease == 'step' else EASE.get(ease, EASE['linear'])(u)
        if cam.get('interp') == 'linear':
            pos = np.asarray(k1['pos'], float) + (np.asarray(k2['pos'], float) - np.asarray(k1['pos'], float)) * u
            tgt = np.asarray(k1['target'], float) + (np.asarray(k2['target'], float) - np.asarray(k1['target'], float)) * u
        else:
            pos = _catmull(k0['pos'], k1['pos'], k2['pos'], k3['pos'], u)
            tgt = _catmull(k0['target'], k1['target'], k2['target'], k3['target'], u)
        f1 = k1.get('fov', cam.get('fov')); f2 = k2.get('fov', cam.get('fov'))
        fov = None if f1 is None else f1 + ((f2 if f2 is not None else f1) - f1) * u
        oh = None
        if k1.get('ortho') is not None:
            o2 = k2.get('ortho', k1['ortho'])
            oh = k1['ortho'] + (o2 - k1['ortho']) * u
        roll = math.radians(k1.get('roll', 0) + (k2.get('roll', 0) - k1.get('roll', 0)) * u)
        fwd = _n(tgt - pos)
        up = np.array([0, 0, -1.0]) if abs(fwd[1]) > 0.999 else np.array([0, 1.0, 0])
        if roll:
            up = _rot(up, fwd, roll)
        return {'mode': 'ortho' if oh is not None else 'perspective', 'position': pos, 'target': tgt, 'up': up, 'fov': fov,
                'ortho_half_height': oh, 'focus_distance': float(np.linalg.norm(tgt - pos))}

    def _pov(self, shot, t):
        c = shot['camera']
        tr = self.track(c['ride'])
        s_front = tr.s_at_time(self.ride_time(c['ride'], t, c.get('train', 0), shot))
        se = s_front - c.get('seat_back_m', 0.7)
        f = tr.sample(se)
        eye = c.get('eye', [0, 1.25, 0])
        left = np.cross(f['up'], f['tangent'])
        pos = f['pos'] + left * eye[0] + f['up'] * eye[1] + f['tangent'] * eye[2]
        la = tr.sample(se + c.get('look_ahead_m', 14))
        tgt = la['pos'] + la['up'] * eye[1] * 0.8
        up = f['up']
        H = c.get('head') or []
        if H:
            i = 0
            while i < len(H) - 1 and H[i + 1]['t'] <= t:
                i += 1
            a, b = H[i], H[min(i + 1, len(H) - 1)]
            u = EASE['inOut'](min(max((t - a['t']) / (b['t'] - a['t']), 0), 1)) if b['t'] > a['t'] else 0
            yaw = math.radians(a.get('yaw', 0) + (b.get('yaw', 0) - a.get('yaw', 0)) * u)
            pitch = math.radians(a.get('pitch', 0) + (b.get('pitch', 0) - a.get('pitch', 0)) * u)
            d = _rot(tgt - pos, up, yaw)
            side = _n(np.cross(d, up))
            d = _rot(d, side, pitch)
            tgt = pos + d
        return {'mode': 'perspective', 'position': pos, 'target': tgt, 'up': up, 'fov': c.get('fov', 78), 'ortho_half_height': None,
                'focus_distance': 12.0, 's_front': s_front}


def iso_basis(cam):
    """screen basis for an ortho camera dict from Park.camera(): returns (right, up, forward) unit vectors.
    Project world p -> screen: x_px = W/2 + dot(p - target, right) * (H/2)/half_height ; y_px = H/2 - dot(p - target, up) * (H/2)/half_height"""
    fwd = _n(cam['target'] - cam['position'])
    right = _n(np.cross(fwd, cam['up']))
    up = np.cross(right, fwd)
    return right, up, fwd


def load(path):
    with open(path) as f:
        return Park(json.load(f))
