/* park.js: dependency-free loader and helpers for the film park master plan.
 *
 * Works as:
 *   - classic <script src="park.js">  -> window.ParkPlan
 *   - ES module: import ParkPlan from './park.mjs'
 *   - Node:      const ParkPlan = require('./park.js')
 *
 *   const park = await ParkPlan.load('plan/park.json')    // browser (fetch) or Node (fs)
 *   const park = ParkPlan.fromJSON(obj)
 *   park.heightAt(x, z)
 *   const tr = park.track('hero_coaster'); tr.sample(s) -> {pos,tangent,up,right,bank,tag,speed,time}
 *   tr.sAtTime(tau)    tr.cars(sFront, nCars, carLen, gap)
 *   park.rideTime('hero_coaster', t, train, shot)        // ride clock (seconds into the track's time table)
 *   park.trainFronts('hero_coaster', t, shot)            // [sFront per train]
 *   park.camera(shot, t)                                 // {position,target,up,fov,orthoHalfHeight,mode}
 *   park.guestsAt(t)                                     // {walkers:Float32Array, idlers, queued}
 *   park.flatRide(id, t)                                 // angles for wheel / carousel / ship / tower ...
 *
 * World: x east, y up, z south (metres), ground y = 0, gate in the south.
 * Rotation: object local +z (its FRONT) points along (sin rot, 0, cos rot).
 */
(function (root) {
  'use strict';
  const EASE = {
    linear: u => u,
    in: u => u * u * u,
    out: u => 1 - Math.pow(1 - u, 3),
    inOut: u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
    smooth: u => u * u * (3 - 2 * u),
    step: u => 0,
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  function rotAxis(v, k, ang) { // Rodrigues
    const c = Math.cos(ang), s = Math.sin(ang);
    return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
  }
  function catmull(p0, p1, p2, p3, u) {
    const u2 = u * u, u3 = u2 * u;
    const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])];
  }
  function b64ToInt16(b64) {
    let bin;
    if (typeof atob === 'function') bin = atob(b64);
    else bin = Buffer.from(b64, 'base64').toString('binary');
    const n = bin.length >> 1, out = new Int16Array(n);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v & 0x8000) v -= 0x10000; out[i] = v; }
    return out;
  }

  // ------------------------------------------------------------------ Track
  class Track {
    constructor(id, d) {
      this.id = id; this.d = d;
      this.n = d.n; this.length = d.length; this.cycleTime = d.cycle_time;
      this.s = Float64Array.from(d.s); this.time = Float64Array.from(d.time);
      this.P = Float64Array.from(d.pos); this.T = Float64Array.from(d.tangent); this.U = Float64Array.from(d.up);
      this.V = Float64Array.from(d.speed); this.tagIdx = d.tag; this.tags = d.tags; this.segments = d.segments;
      this.supports = d.supports || []; this.bents = d.bents || [];
    }
    _idx(arr, v) { // last i with arr[i] <= v
      let lo = 0, hi = arr.length - 1;
      if (v <= arr[0]) return 0; if (v >= arr[hi]) return hi - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; }
      return lo;
    }
    wrapS(s) { const L = this.length; return ((s % L) + L) % L; }
    sample(s) {
      s = this.wrapS(s);
      const i = this._idx(this.s, s), j = Math.min(i + 1, this.n - 1);
      const u = (this.s[j] - this.s[i]) > 1e-9 ? (s - this.s[i]) / (this.s[j] - this.s[i]) : 0;
      const g = (A, k) => lerp(A[3 * i + k], A[3 * j + k], u);
      const pos = [g(this.P, 0), g(this.P, 1), g(this.P, 2)];
      const tangent = norm([g(this.T, 0), g(this.T, 1), g(this.T, 2)]);
      let up = [g(this.U, 0), g(this.U, 1), g(this.U, 2)];
      up = norm(sub(up, mul(tangent, dot(up, tangent))));
      const right = cross(tangent, up);      // rider's right
      // bank: roll angle of `up` relative to the vertical plane containing the tangent
      const h = norm(cross([0, 1, 0], tangent));   // horizontal, rider's left
      const bank = Math.atan2(dot(up, mul(h, -1)), up[1]) * 180 / Math.PI;
      return { s, pos, tangent, up, right, bank, tag: this.tags[this.tagIdx[i]], speed: lerp(this.V[i], this.V[j], u), time: lerp(this.time[i], this.time[j], u) };
    }
    timeAtS(s) { s = this.wrapS(s); const i = this._idx(this.s, s), j = i + 1; const u = (s - this.s[i]) / (this.s[j] - this.s[i] || 1); return lerp(this.time[i], this.time[j], u); }
    sAtTime(tau) {
      const C = this.cycleTime; tau = ((tau % C) + C) % C;
      const i = this._idx(this.time, tau), j = i + 1; const u = (tau - this.time[i]) / (this.time[j] - this.time[i] || 1);
      return lerp(this.s[i], this.s[j], u);
    }
    tagAt(s) { return this.sample(s).tag; }
    segmentsByTag(tag) { return this.segments.filter(g => g.tag === tag); }
    /** car centres for a train whose front is at sFront */
    cars(sFront, nCars, carLen, gap) {
      const out = [];
      for (let k = 0; k < nCars; k++) { const sc = sFront - carLen / 2 - k * (carLen + gap); out.push(this.sample(sc)); }
      return out;
    }
    /** column-major 4x4: local +z = forward (tangent), +y = up, +x = up x forward (rider's LEFT) */
    matrix(s, offset) {
      const f = this.sample(s); const x = cross(f.up, f.tangent);
      let p = f.pos; if (offset) p = add(add(add(p, mul(x, offset[0])), mul(f.up, offset[1])), mul(f.tangent, offset[2]));
      return [x[0], x[1], x[2], 0, f.up[0], f.up[1], f.up[2], 0, f.tangent[0], f.tangent[1], f.tangent[2], 0, p[0], p[1], p[2], 1];
    }
  }

  // ------------------------------------------------------------------ Park
  class Park {
    constructor(data) {
      this.data = data;
      const g = data.terrain.grid;
      this.grid = g; this.H = b64ToInt16(g.data);
      this._tracks = {};
      this.edges = {}; for (const e of data.paths.edges) this.edges[e.id] = this._prepEdge(e);
      this.rides = {}; for (const r of data.rides) this.rides[r.id] = r;
      this.lands = {}; for (const L of (data.lands || [])) this.lands[L.id] = L;
    }
    heightAt(x, z) {
      const g = this.grid; let i = (x - g.x0) / g.cell, j = (z - g.z0) / g.cell;
      i = clamp(i, 0, g.nx - 1.001); j = clamp(j, 0, g.nz - 1.001);
      const i0 = Math.floor(i), j0 = Math.floor(j), fi = i - i0, fj = j - j0, H = this.H, nx = g.nx;
      const h = (H[j0 * nx + i0] * (1 - fi) + H[j0 * nx + i0 + 1] * fi) * (1 - fj) + (H[(j0 + 1) * nx + i0] * (1 - fi) + H[(j0 + 1) * nx + i0 + 1] * fi) * fj;
      return h / 100;
    }
    track(id) { if (!this._tracks[id]) this._tracks[id] = new Track(id, this.data.tracks[id]); return this._tracks[id]; }
    landAt(x, z) {
      for (const L of this.data.lands || []) for (const p of L.region) if (pointInPoly(x, z, p.outer)) return L.id;
      return 'outside';
    }
    // ---------------------------------------------------------- ride clocks
    /** ride clock tau (s) for a tracked ride at film time t. shot.rides[rideId] = {t0, tau0, rate} overrides. */
    rideTime(rideId, t, train = 0, shot = null) {
      const tr = this.track(rideId), anim = this.data.animation[rideId] || {};
      const nTr = anim.trains || anim.boats || 1;
      const offs = train * tr.cycleTime / nTr;
      const ov = shot && shot.rides && shot.rides[rideId];
      if (ov) return ov.tau0 + (t - ov.t0) * (ov.rate == null ? 1 : ov.rate) - offs;
      return t + (anim.ride_time_at_film_t0 || 0) - offs;
    }
    trainFronts(rideId, t, shot = null) {
      const anim = this.data.animation[rideId] || {}; const n = anim.trains || anim.boats || 1; const tr = this.track(rideId);
      const out = []; for (let k = 0; k < n; k++) out.push(tr.sAtTime(this.rideTime(rideId, t, k, shot))); return out;
    }
    /** train cars for a coaster at film time t: [[car frames of train0], [train1] ...] */
    trains(rideId, t, shot = null) {
      const r = this.rides[rideId]; const tp = r.params.train; const tr = this.track(rideId);
      return this.trainFronts(rideId, t, shot).map(s => tr.cars(s, tp.cars, tp.car_length, tp.car_gap));
    }
    flatRide(id, t) {
      const a = this.data.animation[id] || {}; const TAU = Math.PI * 2; const r = this.rides[id] || {}; const p = r.params || {};
      switch (id) {
        case 'ferris_wheel': return { angle: (a.angle_at_t0_deg || 0) * Math.PI / 180 + TAU * t / a.period_s };
        case 'carousel': return { angle: TAU * t / a.period_s, bob: k => 0.35 * Math.sin(TAU * t / a.horse_bob_period_s + k * 2.1) };
        case 'teacups': return { main: TAU * t / a.period_main_s, sub: -TAU * t / a.period_sub_s, cup: k => TAU * t / a.cup_spin_period_s * (k % 2 ? 1 : -1.3) + k };
        case 'swing_ride': return { angle: TAU * t / a.period_s, chairAngleDeg: a.angle_deg };
        case 'pirate_ship': return { swingDeg: a.amplitude_deg * Math.sin(TAU * t / a.period_s + (a.phase_at_t0 || 0)) };
        case 'drop_tower': {
          const c = p.cycle; const C = a.cycle_s; let u = ((t + a.phase_at_t0_s) % C + C) % C; const top = p.height - 6, bot = 3;
          if (u < c.rise_s) return { y: lerp(bot, top, EASE.inOut(u / c.rise_s)) }; u -= c.rise_s;
          if (u < c.hold_s) return { y: top }; u -= c.hold_s;
          if (u < c.drop_s) return { y: lerp(top, bot + 8, (u / c.drop_s) ** 2) }; u -= c.drop_s;
          if (u < c.brake_s) return { y: lerp(bot + 8, bot, EASE.out(u / c.brake_s)) };
          return { y: bot };
        }
        case 'observation_tower': {
          const c = p.cycle; const C = a.cycle_s; let u = ((t + a.phase_at_t0_s) % C + C) % C; const [lo, hi] = p.cabin_travel;
          const ang = TAU * t / p.rotation_period_s; let y;
          if (u < c.rise_s) y = lerp(lo, hi, EASE.inOut(u / c.rise_s)); else if ((u -= c.rise_s) < c.top_s) y = hi; else if ((u -= c.top_s) < c.descend_s) y = lerp(hi, lo, EASE.inOut(u / c.descend_s)); else y = lo;
          return { y, angle: ang };
        }
        default: return { angle: TAU * t / (a.period_s || 10) };
      }
    }
    // ---------------------------------------------------------- paths & guests
    _prepEdge(e) {
      const pts = e.points; const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return Object.assign({}, e, { cum, L: cum[cum.length - 1] });
    }
    /** point on edge at arc-length fraction u (0..1): {x, z, dx, dz} (unit direction a->b) */
    edgePoint(id, u) {
      const e = this.edges[id]; const s = clamp(u, 0, 1) * e.L; const c = e.cum; let i = 0;
      while (i < c.length - 2 && c[i + 1] < s) i++;
      const a = e.points[i], b = e.points[i + 1]; const seg = c[i + 1] - c[i] || 1; const f = (s - c[i]) / seg;
      return { x: lerp(a[0], b[0], f), z: lerp(a[1], b[1], f), dx: (b[0] - a[0]) / seg, dz: (b[1] - a[1]) / seg };
    }
    /** guests at film time t. walkers: Float32Array stride 5 [x, z, heading, colorIndex, isChild] */
    guestsAt(t) {
      const G = this.data.guests; const W = G.walkers.list; const out = new Float32Array(W.length * 5);
      for (let k = 0; k < W.length; k++) {
        const [eid, u0, dir, spd, lat, ci, child] = W[k]; const e = this.edges[eid];
        let u = u0 + dir * spd * t / e.L; u = ((u % 2) + 2) % 2; let d = dir; if (u > 1) { u = 2 - u; d = -dir; }
        const p = this.edgePoint(eid, u); const x = p.x - p.dz * lat, z = p.z + p.dx * lat;
        out[5 * k] = x; out[5 * k + 1] = z; out[5 * k + 2] = Math.atan2(p.dx * d, p.dz * d); out[5 * k + 3] = ci; out[5 * k + 4] = child;
      }
      return { walkers: out, idlers: G.idlers.list, queued: G.queued.list, palette: G.clothes_palette };
    }
    // ---------------------------------------------------------- camera
    /** shot = an entry of shots.json; returns {position, target, up, fov, orthoHalfHeight, mode, focusDistance} */
    camera(shot, t) {
      const cam = shot.camera;
      if (cam.mode === 'pov') return this._pov(shot, t);
      const K = cam.keys; let i = 0;
      if (t <= K[0].t) i = 0; else if (t >= K[K.length - 1].t) i = K.length - 2; else while (i < K.length - 2 && K[i + 1].t <= t) i++;
      const k0 = K[Math.max(i - 1, 0)], k1 = K[i], k2 = K[Math.min(i + 1, K.length - 1)], k3 = K[Math.min(i + 2, K.length - 1)];
      let u = K.length === 1 ? 0 : clamp((t - k1.t) / ((k2.t - k1.t) || 1), 0, 1);
      u = (EASE[k1.ease || 'linear'] || EASE.linear)(u);
      if (k1.ease === 'step') u = t >= k2.t ? 1 : 0;
      const lin = cam.interp === 'linear';
      const position = lin ? lerp3(k1.pos, k2.pos, u) : catmull(k0.pos, k1.pos, k2.pos, k3.pos, u);
      const target = lin ? lerp3(k1.target, k2.target, u) : catmull(k0.target, k1.target, k2.target, k3.target, u);
      const fov = lerp(k1.fov == null ? cam.fov : k1.fov, k2.fov == null ? cam.fov : k2.fov, u);
      const oh = (k1.ortho != null) ? lerp(k1.ortho, k2.ortho == null ? k1.ortho : k2.ortho, u) : null;
      const roll = lerp(k1.roll || 0, k2.roll || 0, u) * Math.PI / 180;
      let up = [0, 1, 0]; const fwd = norm(sub(target, position));
      if (Math.abs(fwd[1]) > 0.999) up = [0, 0, -1];
      if (roll) up = rotAxis(up, fwd, roll);
      return { mode: oh != null ? 'ortho' : 'perspective', position, target, up, fov, orthoHalfHeight: oh, focusDistance: Math.hypot(...sub(target, position)) };
    }
    _pov(shot, t) {
      const c = shot.camera; const rideId = c.ride; const tr = this.track(rideId); const r = this.rides[rideId]; const tp = r.params.train;
      const sFront = tr.sAtTime(this.rideTime(rideId, t, c.train || 0, shot));
      const seat = c.seat_back_m == null ? 0.7 : c.seat_back_m;
      const se = sFront - seat;
      const f = tr.sample(se);
      const eye = c.eye || [0, 1.25, 0];  // [left, up, forward] in track frame
      const left = cross(f.up, f.tangent);
      const position = add(add(add(f.pos, mul(left, eye[0])), mul(f.up, eye[1])), mul(f.tangent, eye[2]));
      const la = tr.sample(se + (c.look_ahead_m || 14));
      let target = add(la.pos, mul(la.up, eye[1] * 0.8));
      let up = f.up;
      // head turn keyframes: [{t, yaw, pitch}] degrees (yaw + = look left)
      if (c.head && c.head.length) {
        const H = c.head; let i = 0; while (i < H.length - 1 && H[i + 1].t <= t) i++;
        const a = H[i], b = H[Math.min(i + 1, H.length - 1)]; const u = b.t > a.t ? EASE.inOut(clamp((t - a.t) / (b.t - a.t), 0, 1)) : 0;
        const yaw = lerp(a.yaw || 0, b.yaw || 0, u) * Math.PI / 180, pitch = lerp(a.pitch || 0, b.pitch || 0, u) * Math.PI / 180;
        let dir = sub(target, position); dir = rotAxis(dir, up, yaw); const side = norm(cross(dir, up)); dir = rotAxis(dir, side, pitch);
        target = add(position, dir);
      }
      return { mode: 'perspective', position, target, up, fov: c.fov || 78, orthoHalfHeight: null, focusDistance: 12, sFront, trackSample: f };
    }
  }

  function pointInPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  }
  function polygonArea(poly) { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]); return Math.abs(a / 2); }
  /** catenary-ish sag points between a and b (y = height): n points */
  function sagLine(a, b, sag, n) { const out = []; for (let i = 0; i <= n; i++) { const u = i / n; const p = lerp3(a, b, u); p[1] -= sag * 4 * u * (1 - u); out.push(p); } return out; }

  const ParkPlan = {
    fromJSON: d => new Park(d),
    async load(src) {
      if (typeof src === 'object') return new Park(src);
      if (typeof window === 'undefined' && typeof require === 'function') { const fs = require('fs'); return new Park(JSON.parse(fs.readFileSync(src, 'utf8'))); }
      const r = await fetch(src); return new Park(await r.json());
    },
    loadFileSync(path) { const fs = require('fs'); return new Park(JSON.parse(fs.readFileSync(path, 'utf8'))); },
    EASE, pointInPoly, polygonArea, sagLine, catmull, vec: { add, sub, mul, dot, cross, norm, lerp3, rotAxis },
    Park, Track,
  };
  if (typeof module === 'object' && module.exports) module.exports = ParkPlan;
  root.ParkPlan = ParkPlan;
})(typeof globalThis !== 'undefined' ? globalThis : this);
