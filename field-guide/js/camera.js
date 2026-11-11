/* Fable 5.2: A Field Guide. The camera: one continuous path keyed in each site's frame (a = outward, b = clockwise,
   c = height above the site's ground), interpolated with time-scaled Hermite splines, plus impact shakes. The key
   light keeps its place over the camera's right shoulder (smoothed), so the hero is always lit like a portrait. */
(function (root) {
  'use strict';
  var FG = root.FG, V = FG.v, m = FG.m, S = FG.SITES, E = FG.TL.E, W = FG.W;
  var D2R = Math.PI / 180;
  function cp(F, a, b, c) { return [F.p[0] + F.o[0] * a + F.tw[0] * b, F.p[1] + c, F.p[2] + F.o[2] * a + F.tw[2] * b]; }
  var T = S.think, K = S.key, CL = S.clear, VI = S.village, MI = S.mine, CO = S.clones, N = S.notes, SC = S.scroll;

  // camera keys: [t, eye, target, fov(deg), tension]
  var KEYS = [
    [0.0, cp(T, -6.4, 0.3, 1.45), cp(T, 0.4, 0.15, 1.75), 44],
    [2.95, cp(T, -5.9, 0.2, 1.35), cp(T, 0.4, 0.1, 1.72), 43],
    [4.6, cp(T, -6.0, -0.7, 1.45), cp(T, 0.3, 0.05, 1.72), 43],
    [5.6, cp(T, -5.9, -0.85, 1.5), cp(T, 0.2, -0.05, 1.8), 43],
    [6.05, cp(T, -5.6, -1.9, 1.9), cp(T, -1.5, -3.0, 2.5), 46],
    [6.45, cp(T, -6.3, -3.9, 2.5), cp(K, 0.0, 0.6, 1.4), 46],
    [7.0, cp(K, -7.6, 0.7, 2.95), cp(K, 0.0, -0.05, 1.75), 41],
    [8.1, cp(K, -7.45, 0.5, 2.9), cp(K, 0.0, -0.15, 1.75), 40],
    [9.6, cp(K, -7.35, 0.2, 2.85), cp(K, 0.0, -0.35, 1.7), 40],
    [10.4, cp(K, -7.0, -2.0, 2.2), cp(K, 0.1, -3.0, 1.05), 42],
    [11.0, cp(CL, -6.0, 0.6, 1.1), cp(CL, 0.3, 0.05, 1.8), 47],
    [11.5, cp(CL, -5.9, 0.45, 0.95), cp(CL, 0.4, -0.1, 2.25), 48],
    [12.5, cp(CL, -5.8, 0.4, 1.0), cp(CL, 0.35, -0.1, 2.15), 48],
    [13.4, cp(CL, -5.7, 0.35, 1.05), cp(CL, 0.2, 0.0, 1.75), 47],
    [13.78, cp(CL, -4.6, -1.6, 1.6), cp(VI, 0.0, 3.6, 0.9), 46],
    [14.25, cp(VI, -6.4, 0.9, 2.6), cp(VI, 0.7, 0.55, 0.95), 44],
    [15.3, cp(VI, -6.4, 0.6, 2.6), cp(VI, 0.7, 0.2, 0.95), 44],
    [17.6, cp(VI, -6.2, 0.15, 2.55), cp(VI, 0.7, -0.15, 0.95), 44],
    [18.05, cp(VI, -5.6, -2.0, 2.4), cp(MI, 0.0, 2.2, 0.6), 43],
    [18.5, cp(MI, -5.0, 0.55, 1.8), cp(MI, 0.25, -0.35, 0.5), 42],
    [20.4, cp(MI, -4.85, 0.4, 1.72), cp(MI, 0.25, -0.42, 0.55), 42],
    [22.35, cp(MI, -4.7, 0.25, 1.7), cp(MI, 0.25, -0.5, 0.6), 42],
    [22.85, cp(MI, -4.4, -1.9, 3.4), V.add(S.top.p, [0, 0.55, 0]), 44],
    [23.35, cp(CO, -5.3, 0.7, 3.4), cp(CO, 1.2, 0.25, 0.95), 48],
    [25.9, cp(CO, -5.2, 0.4, 3.3), cp(CO, 1.2, 0.05, 0.9), 48],
    [26.95, cp(N, -4.5, 0.35, 1.25), cp(N, 0.0, 0.0, 0.8), 40],
    [30.6, cp(N, -4.35, 0.2, 1.2), cp(N, 0.0, -0.1, 0.8), 40],
    [31.3, cp(SC, -5.6, 0.25, 1.6), cp(SC, -0.4, 0.15, 0.85), 42],
    [32.25, cp(SC, -6.0, 0.45, 2.5), cp(SC, -2.6, 0.25, 0.2), 47],
    [33.5, cp(SC, -5.9, 0.35, 2.0), cp(SC, -1.2, 0.2, 0.65), 44],
    [34.3, cp(SC, -5.7, 0.3, 1.75), cp(SC, -0.8, 0.15, 0.9), 42],
    [34.9, [5.98, 6.1, 4.81], [4.6, 3.4, 9.3], 48],
    [35.6, [10.0, 7.8, 8.97], [1.6, 3.6, 13.0], 50],
    [36.5, [11.5, 8.8, 17.8], [1.0, 3.4, 9.0], 52],
    [37.4, [4.36, 8.6, 21.7], [0.5, 3.0, 4.0], 54],
    [38.3, [0.8, 8.6, 22.0], [0.2, 2.75, 1.2], 54, 0],
    [40.0, [0.8, 8.6, 22.0], [0.2, 2.75, 1.2], 54, 0]
  ];
  FG.CAM_KEYS = KEYS;
  var EYE = KEYS.map(function (k) { return [k[0], k[1]]; }), TGT = KEYS.map(function (k) { return [k[0], k[2]]; });
  var FOV = KEYS.map(function (k) { return [k[0], k[3]]; });

  // impact shakes: [time, amplitude, frequency, decay]
  var SHAKES = [[E.hiLand, 0.07, 19, 7], [E.signHits[0], 0.025, 22, 10], [E.signHits[1], 0.02, 22, 10], [E.lastPlank, 0.02, 24, 12], [E.crown, 0.02, 22, 10], [E.burst, 0.03, 20, 9], [E.landTop, 0.012, 20, 10]];
  E.taps.forEach(function (t) { SHAKES.push([t, 0.022, 26, 12]); });
  function shake(t) {
    var s = [0, 0, 0];
    for (var i = 0; i < SHAKES.length; i++) {
      var k = SHAKES[i], d = t - k[0]; if (d < 0 || d > 0.8) continue;
      var a = k[1] * Math.exp(-d * k[3]);
      s[0] += a * Math.sin(d * k[2] * 6.28 + i); s[1] += a * Math.cos(d * k[2] * 5.1 + i * 2);
    }
    return s;
  }
  FG.cameraAt = function (t) {
    if (FG.__camOverride) return FG.__camOverride(t);
    var eye = m.vkeys(EYE, t), tgt = m.vkeys(TGT, t), fov = m.keys(FOV, t);
    // hold the poster: no motion after the hold point
    var sh = shake(t);
    var fwd = V.norm(V.sub(tgt, eye)), right = V.norm(V.cross(fwd, [0, 1, 0])), up = V.cross(right, fwd);
    eye = V.add(eye, V.add(V.mul(right, sh[0]), V.mul(up, sh[1])));
    tgt = V.add(tgt, V.add(V.mul(right, sh[0] * 0.6), V.mul(up, sh[1] * 0.6)));
    return { eye: eye, tgt: tgt, fov: fov * D2R };
  };
  // smoothed heading of the camera (radians, clockwise from north)
  function heading(t) {
    var c = FG.cameraAt(t); var d = V.sub(c.tgt, c.eye); return [d[0], d[2]];
  }
  FG.lightAt = function (t) {
    var sx = 0, sz = 0, wsum = 0;
    for (var k = -10; k <= 10; k++) {
      var tt = m.clamp(t + k * 0.1, 0, 38.3), h = heading(tt), l = Math.hypot(h[0], h[1]) || 1, w = Math.exp(-(k * k) / 30);
      sx += h[0] / l * w; sz += h[1] / l * w; wsum += w;
    }
    var az = Math.atan2(sx, -sz);                   // heading, clockwise from north
    var la = az + m.lerp(150, 212, m.ss(34.8, 37.6, t)) * D2R, el = 30 * D2R;         // the sun behind the camera's right shoulder (left, at the end)
    return V.norm([Math.sin(la) * Math.cos(el), Math.sin(el), -Math.cos(la) * Math.cos(el)]);
  };
  // the deflating cloud's balloon flight: a wobbly loop, then it zips straight at the lens and the camera flies through
  FG.cloudZipAt = function (t) {
    var c0 = V.add(V.mad(T.p, T.tw, -0.15), V.add([0, 2.45, 0], V.mul(T.o, 0.1)));
    function loop(tt) { var z = Math.max(0, tt - E.cloudZip); return V.add(c0, V.add(V.mul(T.tw, Math.sin(z * 13) * 0.35 * Math.min(1, z * 4)), [0, z * 1.1 + Math.sin(z * 17) * 0.12, 0])); }
    function lens(tt, d) { var c = FG.cameraAt(tt), f = V.norm(V.sub(c.tgt, c.eye)); return V.mad(c.eye, f, d); }
    if (t < 6.08) return loop(t);
    if (t < 6.32) { var u = m.ss(6.08, 6.32, t); return V.lerp(loop(6.08), lens(t, 1.0), u * u); }
    return lens(t, 1.0 - (t - 6.32) * 5.0);
  };

  // per-frame render parameters: shadow frustum, focus, fog, veil (inside the thought cloud)
  FG.shotParams = function (t, ctx) {
    var cam = ctx.cam, fr = {};
    fr.light = FG.lightAt(t);
    var tg = cam.tgt, wide = m.ss(35.2, 38.0, t);
    fr.shadowC = V.lerp(tg, [0, 1.5, 0], wide);
    fr.shadowR = m.lerp(8.5, 19, wide);
    var hp = ctx.heroP || tg;
    fr.focus = V.dist(cam.eye, tg) * 1.0;
    fr.dof = m.lerp(0.55, 0.12, wide);
    fr.fogD = m.lerp(13, 28, wide); fr.fogK = m.lerp(0.024, 0.0105, wide);
    fr.ao = 0.55;
    // the veil: how deep inside the cloud the lens is
    var v = 0;
    if (ctx.cloudC && ctx.cloudS > 0) {
      var d = V.dist(cam.eye, ctx.cloudC), r = 1.45 * ctx.cloudS;
      v = m.ss(r * 1.25, r * 0.35, d);
    }
    fr.veil = [0.62, 0.55, 0.72, v * 0.88];
    return fr;
  };
})(typeof window !== 'undefined' ? window : globalThis);
