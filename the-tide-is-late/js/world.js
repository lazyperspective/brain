// world.js -- the tin of colours, the place, and the light.
// The place: a wide flat meadow where an inlet used to be. Seen from a little above (the way a child
// draws the ground: tipped up so you can see all of it). Design space is 1600 x 900.
(function (G) {
  'use strict';
  const A = G.ART, hex = A.hex, clamp = A.clamp, ss = A.ss, vn = A.vn, fbm = A.fbm;
  const Wd = (A.W = {});

  // ---- the tin. Wax crayons with the paper sleeves torn off, a handful of colouring pencils,
  // a stub of white board chalk, one flat red lumber crayon, one soft drawing pencil.
  const K = (Wd.K = {});
  const tin = {
    tile: '#86BCD6', milk: '#A9D6DC', cream: '#F6EDCB', butter: '#F2DF95',
    straw: '#DFCB80', ochre: '#C59E45', mustard: '#D9B23C', lemon: '#CAD560', pist: '#A3C766', sap: '#7BA64B', moss: '#587E3A',
    spruce: '#2F5A45', pine: '#22463A', sage: '#97AE97', haze: '#B2CB9C', slate: '#6E8F9B', far: '#9DB7BF', olive: '#6F7030',
    red: '#D8513A', brick: '#A63E2B', rust: '#91502D', salmon: '#E99C82',
    walnut: '#4B3527', umber: '#6E4D34', drift: '#A9A294', bone: '#D8CFB8', white: '#FCFAF0',
    graphite: '#5A5754', bluepencil: '#4D7C9E', shadew: '#C5D6E4',
  };
  for (const k in tin) K[k] = hex(tin[k]);
  // the same stick is never quite the same twice: worn faces, dirty tips
  Wd.v = function (c, rng, amt) {
    amt = amt === undefined ? 0.03 : amt;
    const d = rng.g() * amt, e = rng.g() * amt * 0.5;
    return [clamp(c[0] + d + e, 0, 1), clamp(c[1] + d, 0, 1), clamp(c[2] + d - e, 0, 1)];
  };

  // ---- where we stand
  const HZ = (Wd.HZ = 208), F = 900, HE = 3.9, CX = 800;
  Wd.F = F; Wd.HE = HE; Wd.CX = CX;
  Wd.proj = (X, Y, Z) => [CX + F * X / Z, HZ + F * (HE - Y) / Z];
  Wd.unproj = (x, y) => { const Z = F * HE / Math.max(0.5, y - HZ); return [(x - CX) * Z / F, Z]; };
  Wd.ppm = y => Math.max(0.6, (y - HZ) / HE);           // pixels (design units) per metre on the ground at screen y
  Wd.d = y => clamp((y - HZ) / (900 - HZ), 0, 1.2);     // 0 at the horizon, 1 at our feet

  // ---- the light: sun low on the left and a little behind us; cloud shadows lying on the land
  const SUN = (() => { const v = [-0.75, 0.42, -0.30], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
  Wd.SUN = SUN;
  const shadows = [ // pools lying on the sheet: cx, cy, rx, ry, softness of the edge, raggedness
    [260, 252, 420, 12, 0.42, 1], [1180, 262, 520, 13, 0.42, 1], [700, 236, 260, 5, 0.42, 1], [200, 404, 520, 50, 0.42, 1], [1250, 398, 560, 44, 0.42, 1],
    [1660, 640, 250, 110, 0.42, 1],
    [110, 965, 700, 335, 0.13, 0.3],      // the big one: coming up the channel from behind us, not at the boat yet
  ];
  Wd.light = function (x, y) { // 1 in the sun .. ~0 under a cloud
    let L = 1;
    const wob = (fbm(x / 170, y / 60, 3, 811) - 0.5) * 0.9 + (vn(x / 37, y / 15, 823) - 0.5) * 0.25;
    for (let k = 0; k < shadows.length; k++) {
      const s = shadows[k], dx = (x - s[0]) / s[2], dy = (y - s[1]) / s[3];
      const q = 1 - Math.sqrt(dx * dx + dy * dy) + wob * s[5];
      if (q <= 0) continue;
      const l = 1 - ss(0.0, s[4], q);
      if (l < L) L = l;
    }
    return L;
  };

  // ---- the far shore
  Wd.shore = x => 223.5 + 3.4 * (fbm(x / 130, 1.7, 3, 61) - 0.5) + 1.2 * (vn(x / 17, 4.2, 67) - 0.5);   // near edge of the far water
  Wd.hills = x => 199 - 19 * Math.pow(fbm(x / 330 + 3.1, 0.3, 3, 71), 1.6) - 5 * ss(900, 1600, x) + 2 * (vn(x / 23, 9.9, 73) - 0.5);

  // ---- the channel the water left by: a centre line through the world (X across, Z away), in metres
  const rc = [ // X, Z, half-width
    -0.3, 1.6, 3.9, -0.9, 4.6, 3.5, -1.7, 9.0, 2.75, -4.9, 12.2, 2.0, -3.0, 15.6, 1.7, 3.2, 18.3, 1.6, 8.6, 22.6, 1.6, 6.4, 31, 1.8,
    -1.5, 41, 2.1, -8.6, 56, 2.6, 0, 76, 3.3, 22, 103, 4.4, 47, 146, 6, 53, 250, 9, 62, 560, 15,
  ];
  const rl = (() => { // dense polyline [X, Z, hw]
    const n = rc.length / 3, out = [], per = 14;
    const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
    for (let i = 0; i < n - 1; i++) {
      const i0 = Math.max(0, i - 1), i3 = Math.min(n - 1, i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per;
        out.push(cr(rc[i0 * 3], rc[i * 3], rc[i * 3 + 3], rc[i3 * 3], t), cr(rc[i0 * 3 + 1], rc[i * 3 + 1], rc[i * 3 + 4], rc[i3 * 3 + 1], t), cr(rc[i0 * 3 + 2], rc[i * 3 + 2], rc[i * 3 + 5], rc[i3 * 3 + 2], t));
      }
    }
    out.push(rc[n * 3 - 3], rc[n * 3 - 2], rc[n * 3 - 1]);
    return out;
  })();
  Wd.riverLine = rl;
  // field on a 2-unit grid: 1 on the centre line, 0 on the bank, negative on dry land
  const GW = 801, GH = 348, GY0 = 206;
  const rf = new Float32Array(GW * GH);
  (function () {
    const ns = rl.length / 3 - 1;
    for (let gy = 0; gy < GH; gy++) {
      const y = GY0 + gy * 2;
      for (let gx = 0; gx < GW; gx++) {
        const x = gx * 2;
        let e = -3;
        if (y > HZ + 2.5) {
          const Z = F * HE / (y - HZ), X = (x - CX) * Z / F;
          for (let k = 0; k < ns; k++) {
            const ax = rl[k * 3], az = rl[k * 3 + 1], bx = rl[k * 3 + 3], bz = rl[k * 3 + 4];
            const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez;
            let t = L2 > 0 ? ((X - ax) * ex + (Z - az) * ez) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const dx = X - ax - ex * t, dz = Z - az - ez * t;
            const hw = rl[k * 3 + 2] + (rl[k * 3 + 5] - rl[k * 3 + 2]) * t;
            const v = 1 - Math.sqrt(dx * dx + dz * dz) / hw;
            if (v > e) e = v;
          }
        }
        rf[gy * GW + gx] = e;
      }
    }
  })();
  Wd.riv = function (x, y) {
    const fx = clamp(x / 2, 0, GW - 1.001), fy = clamp((y - GY0) / 2, 0, GH - 1.001);
    const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * GW + ix;
    const e = (rf[i] * (1 - tx) + rf[i + 1] * tx) * (1 - ty) + (rf[i + GW] * (1 - tx) + rf[i + GW + 1] * tx) * ty;
    const d = Wd.d(y), sx = 26 + 190 * d, sy = 5 + 60 * d;
    return e + (fbm(x / sx, y / sy, 3, 97) - 0.5) * 0.42 + (vn(x / (sx * 0.22), y / (sy * 0.3), 101) - 0.5) * 0.14;
  };

  // bare silt showing in the old bed
  Wd.silt = function (x, y) { const d = Wd.d(y); if (d < 0.2) return false; return fbm(x / (46 + 230 * d) + 3, y / (12 + 100 * d), 3, 7301) > 0.665 && Wd.riv(x, y) > 0.22; };

  // ---- places kept clean for things that will stand there (so their colours go on bare paper)
  Wd.keep = [];
  Wd.clear = function (x, y) { for (let k = 0; k < Wd.keep.length; k++) if (Wd.keep[k](x, y)) return false; return true; };

  // ---- the swells of the meadow: crest lines, far to near. Between two crests lies one band of ground.
  const NB = (Wd.NB = 17);
  Wd.crest = function (i, x) {
    const u = i / NB, y0 = 225 + 686 * Math.pow(u, 1.72);
    if (i <= 0) return Wd.shore(x) - 1;
    const amp = 3 + 52 * Math.pow(u, 1.25), lam = 70 + 520 * u;
    let y = y0 + amp * (fbm(x / lam + i * 7.31, i * 3.7, 3, 131) - 0.5) * 1.6 + amp * 0.12 * (vn(x / (lam * 0.16) + i, 2.2, 137) - 0.5);
    y += (x - 800) * 0.012 * u * (i % 3 - 1);
    return y;
  };

  // which way the grass is leaning here (radians from straight up, + is to the right): big slow swirls
  Wd.lean = function (x, y) {
    const d = Wd.d(y), sx = 60 + 330 * d, sy = 16 + 150 * d;
    return 0.16 + (fbm(x / sx + 5.2, y / sy, 3, 151) - 0.5) * 1.9;
  };
  // dry / green patches
  Wd.dry = (x, y) => { const d = Wd.d(y); return fbm(x / (90 + 300 * d) + 11, y / (22 + 120 * d), 3, 163); };
})(typeof self !== 'undefined' ? self : globalThis);
