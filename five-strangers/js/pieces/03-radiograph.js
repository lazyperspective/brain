/* Five Strangers — 03
 * "Bear, AP View, Patient Age 71"
 *
 * A conservator's radiograph of an old jointed teddy bear, photographed on a lightbox.
 * The film image is a true projection: every pixel integrates attenuation along a parallel
 * ray through a modelled bear (Beer–Lambert): mohair skin and pile as shells, wood-wool
 * stuffing as a fibrous density field, hardboard joint discs, steel washers and cotter pins,
 * glass eyes on wire shanks, a growler with its bellows, weight, spring and reed.
 * And one thing somebody put there on purpose.
 *
 * Drag to window/level the film: sideways = contrast width, down = dig toward the metal.
 */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const FW = 35, FH = 43; // film, cm (14 x 17 in)

  /* ------------------------------------------------------------ vectors */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function basis(n) {
    const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = nrm(cross(n, a));
    return [u, cross(n, u)];
  }
  function catmull(pts, n) { // resample a 2D/4D control polyline to n points along a Catmull-Rom curve
    const seg = pts.length - 1, out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * seg, k = Math.min(seg - 1, Math.floor(t)), f = t - k;
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(seg, k + 2)];
      const o = [];
      for (let c = 0; c < p1.length; c++) {
        o.push(0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * f + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * f * f +
          (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * f * f * f));
      }
      out.push(o);
    }
    return out;
  }

  /* ------------------------------------------------------------ materials (1/cm) */
  const MU = { card: 0.28, cardboard: 0.5, steel: 26, brass: 30, lead: 45, gold: 70, glass: 2.4, paper: 0.55, wood: 0.32 };

  /* ------------------------------------------------------------ the bear */
  function buildScene(seed) {
    const R = mulberry32((seed ^ 0x51ED270B) >>> 0);
    const rr = (a, b) => a + (b - a) * R();
    const S = { prims: [], groups: [] };

    const bear = { s: 0.93, rot: rr(-0.035, 0.02), ox: rr(-0.35, 0.25), oy: rr(-0.55, -0.05) };
    const cb = Math.cos(bear.rot), sb = Math.sin(bear.rot);
    const tp = (p) => [bear.ox + bear.s * (cb * p[0] - sb * p[1]), bear.oy + bear.s * (sb * p[0] + cb * p[1]), bear.s * (p[2] || 0)];
    const tv = (v) => nrm([cb * v[0] - sb * v[1], sb * v[0] + cb * v[1], v[2]]);
    S.bear = bear; S.tp = tp;

    /* -------- primitive buffers (bear coords in, film coords stored) */
    let G = null;
    function group(name) { G = { name, start: S.prims.length, count: 0, box: [1e9, 1e9, -1e9, -1e9] }; S.groups.push(G); }
    function ext(p, r) {
      const b = G.box; b[0] = Math.min(b[0], p[0] - r); b[1] = Math.min(b[1], p[1] - r);
      b[2] = Math.max(b[2], p[0] + r); b[3] = Math.max(b[3], p[1] + r);
    }
    function push(arr) {
      if (G.count >= 60) group(G.name + '+');
      S.prims.push(arr); G.count++;
    }
    const sc = (x) => x * bear.s;
    function wire(a, b, r, mu, caps) {
      const A = tp(a), B = tp(b);
      push([0, mu, sc(r), caps === undefined ? 3 : caps, A[0], A[1], A[2], 0, B[0], B[1], B[2], 0, 0, 0, 0, 0]);
      ext(A, sc(r) + 0.05); ext(B, sc(r) + 0.05);
    }
    function chain(pts, r, mu) {
      for (let i = 0; i < pts.length - 1; i++) wire(pts[i], pts[i + 1], r, mu, (i === 0 ? 1 : 0) | (i === pts.length - 2 ? 2 : 0));
    }
    function disc(c, n, Rr, h, mu, Ri) {
      const C = tp(c), N = tv(n);
      push([1, mu, sc(Rr), sc(Ri || 0), C[0], C[1], C[2], sc(h), N[0], N[1], N[2], 0, 0, 0, 0, 0]);
      ext(C, sc(Rr + h) + 0.05);
    }
    function ell(c, u, su, v, sv, sw, mu, type) {
      const C = tp(c), U = tv(u), Vv = tv(v);
      push([type || 2, mu, 0, 0, C[0], C[1], C[2], sc(sw), U[0], U[1], U[2], sc(su), Vv[0], Vv[1], Vv[2], sc(sv)]);
      ext(C, sc(type === 3 ? su + sv + sw : Math.max(su, sv, sw)) + 0.05);
    }
    const box = (c, u, su, v, sv, sw, mu) => ell(c, u, su, v, sv, sw, mu, 3);
    function torus(c, n, Rr, r, mu) {
      const C = tp(c), N = tv(n);
      push([4, mu, sc(Rr), sc(r), C[0], C[1], C[2], 0, N[0], N[1], N[2], 0, 0, 0, 0, 0]);
      ext(C, sc(Rr + r) + 0.05);
    }

    /* -------- soft parts: ellipsoids */
    const E = []; // {c, ax:[u,v,w], s:[a,b,c]}
    function addEll(c, u, v, s) { const w = cross(u, v); E.push({ c: tp(c), ax: [tv(u), tv(v), tv(w)], s: s.map(sc) }); }

    // head frame
    const hc = [rr(-0.15, 0.15), 10.85 + rr(-0.15, 0.1), 0.3];
    const th = rr(0.13, 0.19);              // head leans toward the raised arm
    const ch = Math.cos(th), sh = Math.sin(th);
    const hf = (x, y, z) => [hc[0] + ch * x - sh * y, hc[1] + sh * x + ch * y, hc[2] + (z || 0)];
    const hx = [ch, sh, 0], hy = [-sh, ch, 0], hz = [0, 0, 1];
    addEll(hf(0, 0.35, 0), hx, hy, [5.45, 5.35, 4.6]);                      // 0 cranium, a little forehead
    const mz = nrm(add(mul(hy, -0.28), hz)), my = nrm(cross(mz, hx));
    addEll(hf(0, -1.85, 3.9), hx, my, [2.6, 2.25, 4.3]);                  // 1 muzzle
    addEll([0, -0.2, 0.3], [1, 0, 0], [0, 1, 0], [5.2, 6.3, 4.4]);           // 2 chest
    addEll([0, -5.7, 0.4], [1, 0, 0], [0, 1, 0], [7.0, 6.4, 5.6]);         // 3 belly: a pear
    const feet = [[-8.25 + rr(-0.2, 0.2), -17.25, 2.0], [7.6 + rr(-0.2, 0.2), -17.45, 1.9]];
    feet.forEach((f, i) => {
      const toe = nrm([i ? 0.6 : -0.5, -0.15, 1]);
      const fu = nrm(cross([0, 1, 0], toe)), fv = cross(toe, fu);
      addEll(f, fu, fv, [2.75, 2.45, 4.9]);                                  // 4,5 feet (toes toward the tube)
    });
    for (const sx of [-1, 1]) addEll(hf(sx * 3.15, -2.05, 1.0), hx, hy, [3.05, 2.75, 3.7]);   // 6,7 cheeks
    S.E = E;

    /* -------- limbs: spine polylines (x, y, radius) */
    const jit = () => rr(-0.25, 0.25);
    const armUp = [[-5.6, 3.9, 2.5], [-7.0, 6.2 + jit(), 2.45], [-8.4, 8.9, 2.2], [-9.5 + jit(), 11.6, 1.95],
      [-10.15, 14.0, 1.8], [-10.1, 16.0, 2.0], [-9.3, 17.5, 2.05], [-8.2, 18.1, 1.55]];
    const armDn = [[5.7, 3.6, 2.6], [6.9, 1.3, 2.55], [7.95 + jit(), -1.5, 2.35], [8.7, -4.6, 2.15],
      [9.0, -7.4 + jit(), 1.95], [8.7, -9.8, 2.1], [7.7, -11.4, 2.1], [6.6, -12.0, 1.6]];
    const legR = [[-5.2, -8.9, 3.0], [-5.9, -11.1, 3.0], [-6.9, -13.3, 2.7], [-7.7, -15.2, 2.45], [-8.1, -16.6, 2.35]];
    const legL = [[5.2, -8.9, 3.0], [5.8, -11.2, 3.0], [6.55, -13.5, 2.7], [7.2, -15.5, 2.45], [7.5, -16.85, 2.35]];
    const limbZ = [1.0, 1.4, 1.4, 1.4];
    S.limbs = [armUp, armDn, legR, legL].map((pts, li) => catmull(pts, 8).map((p) => {
      const q = tp([p[0], p[1], 0]); return [q[0], q[1], sc(p[2]), sc(limbZ[li])];
    }));

    /* -------- ears (x, y, radius, outward angle) */
    const earR = hf(-4.6, 4.05), earL = hf(4.85, 3.55 + rr(-0.25, 0.05));
    const outR = Math.atan2(earR[1] - hc[1], earR[0] - hc[0]), outL = Math.atan2(earL[1] - hc[1], earL[0] - hc[0]) - 0.12;
    S.ears = [[...tp(earR).slice(0, 2), sc(2.45), outR + bear.rot], [...tp(earL).slice(0, 2), sc(2.3), outL + bear.rot]];

    /* -------- stuffing density: lumps (x, y, radius, amount) */
    const L = [];
    const lump = (p, r, a) => { const q = tp(p); L.push([q[0], q[1], sc(r), a]); };
    lump([0, 5.3, 0], 2.2, -0.5);                         // the neck has sagged
    lump([-1.6, 3.4, 0], 2.5, -0.3); lump([2.2, 4.0, 0], 1.7, -0.22);   // stuffing settled out of the chest
    lump([0.3, -7.8, 0], 4.2, 0.28);                      // and packed into the seat
    lump(hf(0, -1.95), 2.3, 1.6);                         // hard-packed muzzle
    lump(feet[0], 2.4, 0.35); lump(feet[1], 2.4, 0.35);
    lump([8.3, -10.2, 0], 1.8, 0.35); lump([8.2, -3.5, 0], 3.0, 0.25);
    for (let i = 0; i < 4; i++) lump([rr(-4.5, 4.5), rr(-9, 2), 0], rr(1.0, 2.0), rr(-0.3, 0.25));
    lump(hf(rr(-3, 3), rr(1.5, 3.5)), rr(1.2, 1.8), rr(-0.3, -0.12));
    S.lumps = L;

    /* -------- mohair wear: bald where it was held, kissed, dragged */
    const W = [];
    const worn = (p, r, a) => { const q = tp(p); W.push([q[0], q[1], sc(r), a]); };
    worn(hf(0, -1.9), 1.9, 0.95);
    worn([0.6, -4.0, 0], 3.2, 0.55);
    worn([-9.6, 16.4, 0], 2.2, 0.95);
    worn([-8.4, 8.4, 0], 2.0, 0.6);
    worn([8.6, -9.5, 0], 1.6, 0.5);
    worn(hf(-4.6, 4.0), 1.6, 0.45);
    worn([rr(-4, 4), rr(-10, 3), 0], rr(1.2, 2.5), rr(0.3, 0.6));
    worn([rr(-8, 8), rr(-17, -12), 0], rr(1.2, 2), rr(0.3, 0.6));
    S.wear = W;

    /* -------- seams (doubled fabric edge-on) */
    group('seams');
    const muSeam = 1.1, rSeam = 0.035;
    const headZ = (x, y) => 4.6 * Math.sqrt(Math.max(0.02, 1 - (x / 5.45) ** 2 - ((y - 0.35) / 5.35) ** 2));
    for (const sx of [-1, 1]) {
      group('seam');
      const pts = [];
      for (let y = 0.6; y <= 5.2; y += 0.65) { const x = sx * (1.05 + 0.13 * y); pts.push(hf(x, y, headZ(x, y) - 0.1)); }
      chain(pts, rSeam, muSeam);
    }
    {
      group('seam');
      const pts = [];
      for (let y = 5.3; y >= -11.2; y -= 1.1) {
        const e = y > -2.5 ? [5.6, 6.2, 4.5, -0.3] : [6.7, 6.3, 5.4, -5.3];
        const z = e[2] * Math.sqrt(Math.max(0.02, 1 - ((y - e[3]) / e[1]) ** 2));
        pts.push([0.15 * Math.sin(y * 0.7), y, z - 0.12]);
      }
      chain(pts, rSeam, muSeam * 0.8);
    }

    // the muzzle was cut as its own piece: its seam rings the snout
    group('seam');
    {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2, x = 2.5 * Math.cos(a), y = -1.85 + 2.15 * Math.sin(a);
        pts.push(hf(x, y, headZ(x, y) - 0.15));
      }
      chain(pts, rSeam, muSeam * 3.0);
    }

    // felt paw pads, their seams outlining the palm of each paw
    [[armUp, 1], [armDn, -1]].forEach(([pts, side]) => {
      group('seam');
      const n = pts.length, e = pts[n - 1], b = pts[n - 3];
      const ax = nrm([e[0] - b[0], e[1] - b[1], 0]), px = [-ax[1] * side, ax[0] * side, 0];
      const c = add(add([e[0], e[1], 0.9], mul(ax, -1.25)), mul(px, 0.45));
      const lp = [];
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        lp.push(add(c, add(mul(ax, 1.25 * Math.cos(a)), add(mul(px, 0.85 * Math.sin(a)), [0, 0, 0.5 * Math.sin(a)]))));
      }
      chain(lp, rSeam, muSeam * 1.5);
    });

    /* -------- joints: hardboard discs, steel washers, split cotter pins with crown curls */
    function joint(J, n, Rd, name) {
      group(name);
      n = nrm(n);
      const [u, v] = basis(n);
      const gap = 0.36;
      disc(add(J, mul(n, gap)), n, Rd, 0.17, MU.card, 0.12);
      disc(add(J, mul(n, -gap)), n, Rd * rr(0.97, 1.03), 0.17, MU.card, 0.12);
      group(name + '-metal');
      disc(add(J, mul(n, 0.6)), n, 0.72, 0.045, MU.steel, 0.1);
      disc(add(J, mul(n, -0.6)), n, 0.72, 0.045, MU.steel, 0.1);
      const H = add(J, mul(n, 0.7)), Eend = add(J, mul(n, -0.7));
      // the split pin: two half-round wires
      for (const s of [-1, 1]) wire(add(H, mul(u, 0.055 * s)), add(Eend, mul(u, 0.055 * s)), 0.06, MU.steel);
      // the eye of the pin
      const eye = [];
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI * 0.85 + (i / 10) * Math.PI * 1.7;
        eye.push(add(add(H, mul(n, 0.2)), add(mul(n, -0.2 * Math.cos(a)), mul(u, 0.2 * Math.sin(a)))));
      }
      chain(eye, 0.06, MU.steel);
      // crown: the legs bent back and curled against the washer
      const rot = rr(-0.6, 0.6);
      const cu = add(mul(u, Math.cos(rot)), mul(v, Math.sin(rot)));
      const curl = [[0, 0], [0.16, -0.1], [0.36, -0.12], [0.5, 0.0], [0.5, 0.16], [0.37, 0.24], [0.25, 0.14], [0.27, 0.03]];
      for (const s of [-1, 1]) {
        const k = rr(0.85, 1.15);
        const pts = catmull(curl, 12).map(([a, b]) => add(Eend, add(mul(cu, s * a * k), mul(n, b * k + 0.1))));
        chain(pts, 0.055, MU.steel);
      }
    }
    joint(hf(0, -5.55, 0.1), [-sh * 0.95, ch * 0.95, 0.32], 2.9, 'neck');
    joint([-5.05, 3.55, 0.5], [-0.93, 0.3, 0.36], 2.2, 'shoulderR');
    joint([5.1, 3.4, 0.5], [0.95, -0.08, 0.34], 2.2, 'shoulderL');
    joint([-4.75, -8.75, 0.7], [-0.92, -0.22, 0.38], 2.6, 'hipR');
    joint([4.8, -8.8, 0.7], [0.93, -0.18, 0.36], 2.6, 'hipL');

    /* -------- one glass eye on its wire shank; the other lost, and replaced with a boot button */
    for (const sx of [-1, 1]) {
      group('eye');
      if (sx > 0) {
        const x = 2.3, y = 0.72, z = headZ(x, y) - 0.02;
        const c = hf(x, y, z);
        disc(c, hz, 0.46, 0.09, MU.steel * 0.22);                 // pressed steel dome
        disc(c, hz, 0.46, 0.13, MU.steel * 0.8, 0.37);            // its rolled rim
        const lp = [];
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          lp.push(add(hf(x, y, z - 0.35), add(mul(hx, 0.12 * Math.sin(a)), [0, 0, 0.12 * Math.cos(a)])));
        }
        chain(lp, 0.035, MU.steel);
        wire(hf(x, y, z - 0.1), hf(x, y, z - 0.25), 0.04, MU.steel);
        continue;
      }
      const x = sx * 2.15, y = 0.95, z = headZ(x, y) - 0.05;
      const c = hf(x, y, z);
      ell(c, hx, 0.6, hy, 0.6, 0.36, MU.glass);
      const back = hf(x, y, z - 0.42);
      const loop = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        loop.push(add(back, add(mul(hy, 0.13 * Math.sin(a) - 0.05), [0, 0, -0.13 + 0.13 * Math.cos(a)])));
      }
      chain(loop, 0.035, MU.steel);
      chain([hf(x, y - 0.05, z - 0.3), hf(x + sx * 0.3, y - 0.3, z - 0.9), hf(x + sx * 0.55, y - 0.55, z - 1.6), hf(x + sx * 0.6, y - 0.62, z - 2.0)], 0.03, MU.steel);
      wire(hf(x, y, z - 0.08), hf(x, y, z - 0.42), 0.035, MU.steel);
    }

    /* -------- card insoles in the feet */
    feet.forEach((f, i) => group('sole') || disc(add(f, [0, -1.45, -0.1]), [i ? 0.1 : -0.08, -1, 0.16 + rr(0, 0.08)], 1.8, 0.06, MU.cardboard));

    /* -------- growler in the belly */
    group('growler');
    {
      const gc = [0.75 + rr(-0.2, 0.2), -5.7, 0.4];
      const a = nrm([0.14 + rr(-0.05, 0.05), 0.82, 0.55]);
      const [u, v] = basis(a);
      const at = (t, x, y) => add(gc, add(mul(a, t), add(mul(u, x || 0), mul(v, y || 0))));
      disc(gc, a, 2.25, 2.7, MU.card * 2.2, 2.13);                  // card tube
      disc(at(2.7), a, 2.25, 0.05, MU.card * 2.2);                 // perforated cap
      disc(at(-2.7), a, 2.25, 0.05, MU.card * 2.2);                 // base
      group('holes');
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + 0.3, rad = i === 6 ? 0 : 1.15;
        disc(at(2.7, rad * Math.cos(ang) * (i === 6 ? 0 : 1), rad * Math.sin(ang)), a, 0.26, 0.06, -MU.card * 2.2);
      }
      group('bellows');
      // bellows: pleated paper
      for (let i = 0; i < 9; i++) disc(at(-2.55 + i * 0.22), a, i % 2 ? 1.75 : 2.05, 0.025, MU.paper * 3.0, i % 2 ? 1.6 : 1.9);
      // lead weight on the bellows
      disc(at(-0.45), a, 1.35, 0.24, MU.lead);
      // steel spring between weight and reed
      group('spring');
      const sp = [];
      const turns = 5 + Math.floor(rr(0, 2));
      for (let i = 0; i <= turns * 10; i++) {
        const t = i / (turns * 10), ang = t * turns * Math.PI * 2;
        sp.push(at(-0.2 + t * 2.45, 0.62 * Math.cos(ang), 0.62 * Math.sin(ang)));
      }
      chain(sp, 0.04, MU.steel);
      group('reed');
      // brass reed plate with its slot and tongue
      box(at(2.35), u, 1.25, v, 0.7, 0.05, MU.brass);
      box(at(2.35), u, 0.85, v, 0.12, 0.06, -MU.brass);
      box(at(2.36, -0.05, 0), u, 0.72, v, 0.07, 0.015, MU.steel);
      // two wire stays
      for (const s of [-1, 1]) chain([at(-2.6, 1.85 * s, 0.3), at(-1, 1.95 * s, 0.25), at(2.6, 1.85 * s, 0.3)], 0.035, MU.steel);
    }

    /* -------- THE RING — tied into the chest where the heart would be */
    group('ring');
    const ringC = [2.55 + rr(-0.15, 0.15), 1.95 + rr(-0.2, 0.2), 1.3];
    const ringN = nrm([rr(-0.5, 0.5), rr(0.6, 0.9), rr(0.45, 0.7)]);
    torus(ringC, ringN, 0.92, 0.12, MU.gold);
    {
      // a small claw setting with its stone, at the top of the band
      const [ru, rv] = basis(ringN);
      const ang = rr(0, Math.PI * 2), dir = add(mul(ru, Math.cos(ang)), mul(rv, Math.sin(ang)));
      const top = add(ringC, mul(dir, 0.98));
      const t2 = nrm(cross(ringN, dir));
      ell(add(top, mul(dir, 0.1)), dir, 0.2, t2, 0.24, 0.17, MU.gold);
      ell(add(top, mul(dir, 0.34)), dir, 0.16, t2, 0.2, 0.2, MU.glass * 2.2);
      for (const a of [0.8, 2.4, 3.9, 5.5]) {
        const o = add(mul(t2, 0.21 * Math.cos(a)), mul(ringN, 0.21 * Math.sin(a)));
        wire(add(top, add(mul(dir, 0.15), o)), add(top, add(mul(dir, 0.48), mul(o, 0.7))), 0.035, MU.gold);
      }
    }
    const rc = tp(ringC);
    S.ring = [rc[0], rc[1], sc(2.1), 0];

    /* -------- the raised arm was opened, restuffed with rags and closed with a safety pin */
    group('safetypin');
    {
      const pc = [-8.25 + rr(-0.2, 0.2), 8.6 + rr(-0.4, 0.4), 1.7];
      const armDir = nrm([-0.43, 0.9, 0]);
      const ang = Math.atan2(armDir[1], armDir[0]) + Math.PI / 2 + rr(-0.35, 0.35);
      const ax = nrm([Math.cos(ang), Math.sin(ang), rr(-0.15, 0.15)]);
      const pn = nrm([rr(-0.25, 0.25), rr(-0.25, 0.25), 1]);
      const by = nrm(cross(pn, ax));
      const at = (x, y, z) => add(pc, add(mul(ax, x), add(mul(by, y), mul(pn, z || 0))));
      const len = 3.3;
      // coil at the -x end: 2.5 turns, axis along pn
      const coil = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, a = Math.PI * 0.5 + t * Math.PI * 5;
        coil.push(at(-len / 2 + 0.2 * Math.cos(a), 0.2 * Math.sin(a), -0.08 + 0.16 * t));
      }
      chain(coil, 0.045, MU.steel);
      chain([at(-len / 2 + 0.05, 0.2, 0.08), at(-0.3, 0.17, 0.05), at(len / 2 - 0.35, 0.09, 0.0)], 0.045, MU.steel); // pin
      chain([at(-len / 2 + 0.05, -0.2, -0.08), at(0, -0.21, -0.06), at(len / 2 - 0.3, -0.13, -0.02)], 0.045, MU.steel);
      box(at(len / 2 - 0.3, -0.02, 0), ax, 0.32, by, 0.2, 0.09, MU.steel);
      box(at(len / 2 - 0.3, -0.02, 0), ax, 0.24, by, 0.14, 0.06, -MU.steel * 0.7);
    }

    group('ragfinds');
    {
      const hc2 = [-9.55 + rr(-0.3, 0.3), 12.4 + rr(-0.5, 0.5), 0.6], ha = rr(0, Math.PI * 2);
      const hd = [Math.cos(ha), Math.sin(ha), 0.15], hn = [-Math.sin(ha), Math.cos(ha), 0];
      const P2 = (a, b) => add(hc2, add(mul(hd, a), mul(hn, b)));
      chain([P2(-0.45, 0.12), P2(0.25, 0.12), P2(0.45, 0.0), P2(0.3, -0.12), P2(0.12, -0.08)], 0.03, MU.brass);   // the hook
      chain([P2(-0.45, -0.12), P2(-0.12, -0.12)], 0.03, MU.brass);
      const ey = [];
      for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.3 + 1.4 * i / 10); ey.push(P2(0.95 + 0.22 * Math.cos(a), 0.22 * Math.sin(a) + 0.35)); }
      chain(ey, 0.03, MU.brass);                                            // its eye, unhooked
      const bc = [-8.6 + rr(-0.3, 0.3), 6.6 + rr(-0.4, 0.4), 1.2], bn = nrm([rr(-0.3, 0.3), rr(-0.3, 0.3), 1]);
      disc(bc, bn, 0.48, 0.07, 1.6);                                        // a bone shirt button
      const [bu, bv] = basis(bn);
      for (const [x, y] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) disc(add(bc, add(mul(bu, 0.12 * x), mul(bv, 0.12 * y))), bn, 0.06, 0.08, -1.6);
    }

    /* -------- sometimes, a dressmaker's pin forgotten after a repair */
    if (R() < 0.55) {
      group('pin');
      const spots = [[-6.2, -13.0], [3.5, 12.6], [7.9, -2.0], [-2.5, -9.5]];
      const p = spots[Math.floor(R() * spots.length)];
      const a = rr(0, Math.PI * 2), l = 2.9;
      const d = [Math.cos(a), Math.sin(a), rr(-0.3, 0.3)];
      const A = [p[0] - d[0] * l / 2, p[1] - d[1] * l / 2, 1], B = [p[0] + d[0] * l / 2, p[1] + d[1] * l / 2, 1 + d[2] * l];
      wire(A, B, 0.035, MU.steel);
      ell(A, [1, 0, 0], 0.13, [0, 1, 0], 0.13, 0.13, MU.glass * 1.4);
    }

    /* -------- wood slivers and shavings in the excelsior */
    const inPart = (x, y) => {
      for (const e of [[0, -0.3, 5.3, 5.9], [0, -5.3, 6.3, 6.0], [hc[0], hc[1], 5.4, 4.9]]) {
        if (((x - e[0]) / e[3]) ** 2 + ((y - e[1]) / e[2]) ** 2 < 0.8) return true;
      }
      return false;
    };
    const sl = [];
    for (let tries = 0; tries < 400 && sl.length < 24; tries++) {
      const x = rr(-7, 7), y = rr(-11, 15);
      if (!inPart(x, y)) continue;
      if (Math.hypot(x - ringC[0], y - ringC[1]) < 2.2) continue;
      const a = rr(0, Math.PI * 2), l = rr(0.4, 1.4), z = rr(-3, 3);
      const d = [Math.cos(a) * l / 2, Math.sin(a) * l / 2, rr(-0.4, 0.4)];
      sl.push([sub([x, y, z], d), add([x, y, z], d), rr(0.04, 0.08), MU.wood * rr(1.5, 3)]);
    }
    sl.sort((p, q) => p[0][1] - q[0][1]);
    sl.forEach((w, i) => { if (i % 3 === 0) group('slivers'); wire(w[0], w[1], w[2], w[3]); });

    S.parts = { hc, th };
    return S;
  }

  /* ------------------------------------------------------------ handwriting & lead type */
  // single-stroke glyphs, cap height 1, x-height ~0.6, y up
  const GL = {
    a: [0.62, [[0.5, 0.5, 0.38, 0.62, 0.16, 0.56, 0.05, 0.32, 0.1, 0.08, 0.28, 0, 0.45, 0.12, 0.52, 0.36], [0.53, 0.6, 0.52, 0.2, 0.56, 0.02, 0.62, 0]]],
    b: [0.58, [[0.06, 1.02, 0.05, 0.5, 0.06, 0.02], [0.06, 0.35, 0.2, 0.58, 0.4, 0.6, 0.52, 0.42, 0.5, 0.15, 0.32, 0, 0.1, 0.06]]],
    c: [0.54, [[0.5, 0.52, 0.36, 0.62, 0.15, 0.56, 0.04, 0.3, 0.12, 0.06, 0.3, 0, 0.5, 0.1]]],
    d: [0.6, [[0.48, 0.45, 0.32, 0.6, 0.12, 0.52, 0.04, 0.28, 0.12, 0.04, 0.3, 0, 0.46, 0.15], [0.5, 1.02, 0.49, 0.4, 0.52, 0]]],
    e: [0.54, [[0.06, 0.3, 0.48, 0.34, 0.46, 0.52, 0.3, 0.62, 0.12, 0.55, 0.04, 0.3, 0.12, 0.06, 0.3, 0, 0.48, 0.1]]],
    h: [0.56, [[0.06, 1.02, 0.06, 0], [0.07, 0.38, 0.2, 0.58, 0.38, 0.6, 0.47, 0.45, 0.48, 0]]],
    i: [0.24, [[0.1, 0.6, 0.1, 0.02], [0.1, 0.86, 0.12, 0.88]]],
    k: [0.5, [[0.06, 1.02, 0.06, 0], [0.44, 0.62, 0.08, 0.28], [0.2, 0.38, 0.46, 0]]],
    l: [0.24, [[0.1, 1.02, 0.09, 0.1, 0.16, 0]]],
    m: [0.76, [[0.06, 0.6, 0.06, 0], [0.06, 0.4, 0.17, 0.58, 0.3, 0.58, 0.36, 0.4, 0.36, 0], [0.36, 0.4, 0.47, 0.58, 0.6, 0.58, 0.66, 0.4, 0.66, 0]]],
    n: [0.56, [[0.06, 0.6, 0.06, 0], [0.06, 0.4, 0.2, 0.58, 0.38, 0.6, 0.46, 0.45, 0.46, 0]]],
    o: [0.58, [[0.3, 0.62, 0.1, 0.54, 0.03, 0.3, 0.1, 0.06, 0.28, 0, 0.46, 0.08, 0.53, 0.32, 0.46, 0.55, 0.3, 0.62, 0.22, 0.58]]],
    p: [0.58, [[0.06, 0.6, 0.06, -0.38], [0.07, 0.42, 0.22, 0.6, 0.42, 0.58, 0.52, 0.36, 0.45, 0.1, 0.26, 0, 0.08, 0.08]]],
    r: [0.42, [[0.06, 0.6, 0.06, 0], [0.06, 0.36, 0.18, 0.56, 0.32, 0.62, 0.42, 0.58]]],
    s: [0.5, [[0.44, 0.54, 0.3, 0.62, 0.12, 0.58, 0.08, 0.44, 0.2, 0.34, 0.36, 0.28, 0.46, 0.16, 0.38, 0.02, 0.2, 0, 0.04, 0.08]]],
    t: [0.4, [[0.18, 0.9, 0.17, 0.12, 0.24, 0, 0.36, 0.04], [0.02, 0.6, 0.38, 0.62]]],
    u: [0.56, [[0.06, 0.6, 0.06, 0.16, 0.16, 0, 0.34, 0.02, 0.46, 0.2], [0.47, 0.6, 0.47, 0]]],
    v: [0.5, [[0.02, 0.6, 0.24, 0, 0.46, 0.62]]],
    x: [0.5, [[0.04, 0.6, 0.44, 0], [0.44, 0.6, 0.04, 0]]],
    A: [0.62, [[0.02, 0, 0.3, 1, 0.58, 0], [0.13, 0.36, 0.47, 0.36]]],
    P: [0.56, [[0.06, 0, 0.06, 1, 0.34, 1, 0.5, 0.88, 0.5, 0.64, 0.34, 0.52, 0.07, 0.52]]],
    R: [0.6, [[0.06, 0, 0.06, 1, 0.34, 1, 0.5, 0.88, 0.5, 0.66, 0.34, 0.54, 0.07, 0.54], [0.3, 0.54, 0.56, 0]]],
    L: [0.62, [[0.06, 1, 0.06, 0, 0.6, 0.02]]],
    V: [0.58, [[0.02, 1, 0.28, 0, 0.54, 1]]],
    0: [0.56, [[0.28, 1, 0.08, 0.86, 0.02, 0.5, 0.08, 0.14, 0.28, 0, 0.46, 0.14, 0.52, 0.5, 0.46, 0.86, 0.28, 1]]],
    1: [0.36, [[0.04, 0.8, 0.22, 1, 0.22, 0]]],
    2: [0.56, [[0.04, 0.78, 0.16, 0.96, 0.34, 1, 0.48, 0.86, 0.46, 0.62, 0.04, 0, 0.52, 0]]],
    3: [0.54, [[0.04, 0.9, 0.24, 1, 0.44, 0.92, 0.46, 0.72, 0.26, 0.56, 0.46, 0.42, 0.5, 0.18, 0.34, 0, 0.14, 0, 0.02, 0.1]]],
    4: [0.56, [[0.38, 0, 0.38, 1, 0.02, 0.3, 0.54, 0.3]]],
    5: [0.54, [[0.48, 1, 0.1, 1, 0.06, 0.56, 0.24, 0.62, 0.44, 0.54, 0.5, 0.3, 0.42, 0.08, 0.24, 0, 0.04, 0.08]]],
    6: [0.54, [[0.44, 0.96, 0.26, 1, 0.08, 0.8, 0.02, 0.4, 0.08, 0.1, 0.26, 0, 0.44, 0.1, 0.5, 0.3, 0.42, 0.5, 0.24, 0.56, 0.06, 0.4]]],
    7: [0.54, [[0.02, 1, 0.52, 1, 0.22, 0]]],
    8: [0.54, [[0.27, 0.54, 0.08, 0.68, 0.08, 0.9, 0.27, 1, 0.46, 0.9, 0.46, 0.68, 0.27, 0.54, 0.04, 0.36, 0.04, 0.12, 0.27, 0, 0.5, 0.12, 0.5, 0.36, 0.27, 0.54]]],
    9: [0.54, [[0.48, 0.6, 0.3, 0.46, 0.1, 0.52, 0.04, 0.76, 0.16, 0.96, 0.34, 1, 0.48, 0.86, 0.5, 0.6, 0.44, 0.2, 0.3, 0, 0.08, 0.04]]],
    '.': [0.22, [[0.08, 0, 0.1, 0.03]]],
    ',': [0.22, [[0.11, 0.04, 0.06, -0.18]]],
    '-': [0.4, [[0.05, 0.32, 0.34, 0.33]]],
    '—': [0.8, [[0.05, 0.32, 0.72, 0.35]]],
    ' ': [0.32, []],
  };

  function writeText(c, str, x, y, h, ang, R, mode) {
    const grease = mode === 'grease';
    c.save();
    c.translate(x, y); c.rotate(ang);
    c.lineCap = grease ? 'round' : 'square'; c.lineJoin = grease ? 'round' : 'miter';
    c.lineWidth = h * (grease ? 0.13 : 0.16);
    let pen = 0;
    const slant = grease ? 0.16 : 0;
    for (const ch of str) {
      const g = GL[ch];
      if (!g) { pen += 0.32 * h; continue; }
      const dy = grease ? (R() - 0.5) * 0.06 * h : 0, sx = grease ? 1 + (R() - 0.5) * 0.12 : 1;
      for (const st of g[1]) {
        const pts = [];
        for (let i = 0; i < st.length; i += 2) {
          const jx = grease ? (R() - 0.5) * 0.045 : 0, jy = grease ? (R() - 0.5) * 0.045 : 0;
          pts.push([pen + (st[i] * sx + st[i + 1] * slant + jx) * h, (st[i + 1] + jy) * h + dy + (grease ? Math.sin(pen * 0.9) * 0.03 * h : 0)]);
        }
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        if (pts.length === 2) c.lineTo(pts[1][0], pts[1][1]);
        else if (grease) {
          for (let i = 1; i < pts.length - 1; i++) {
            c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
          }
          c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        } else for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
        if (grease) c.lineWidth = h * (0.11 + R() * 0.05);
        c.stroke();
      }
      pen += (g[0] + (grease ? 0.07 + (R() - 0.5) * 0.06 : 0.12)) * h;
    }
    c.restore();
    return pen;
  }

  // overlay in film space: R = lead, G = grease pencil, B = plastic (marker holders, ruler)
  function drawOverlay(cv, seed) {
    const R = mulberry32((seed ^ 0xA11CE) >>> 0);
    const rr = (a, b) => a + (b - a) * R();
    const c = cv.getContext('2d');
    const k = cv.width / FW;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, -k, cv.width / 2, cv.height / 2);
    c.globalCompositeOperation = 'lighter';

    // lead ruler in a plastic strip, down the left edge
    c.save();
    c.translate(-15.55 + rr(-0.2, 0.2), -9.4 + rr(-0.4, 0.4)); c.rotate(rr(-0.02, 0.012));
    c.fillStyle = 'rgb(0,0,60)';
    c.beginPath(); c.roundRect ? c.roundRect(-0.8, -10.8, 1.6, 21.6, 0.15) : c.rect(-0.8, -10.8, 1.6, 21.6); c.fill();
    c.strokeStyle = 'rgb(255,0,0)'; c.fillStyle = 'rgb(255,0,0)';
    for (let i = 0; i <= 40; i++) {
      const y = -10 + i * 0.5, len = i % 10 === 0 ? 0.75 : i % 2 === 0 ? 0.5 : 0.28;
      c.fillRect(-0.62, y - 0.035, len, 0.07);
    }
    for (let i = 0; i <= 20; i++) {
      const s = String(i);
      writeText(c, s, 0.08 + (s.length > 1 ? -0.12 : 0), -10 + i - 0.17, 0.34, 0, R, 'lead');
    }
    c.restore();

    // "R" marker with the conservator's initials, in a plastic holder
    c.save();
    c.translate(-14.4 + rr(-0.3, 0.3), 19.0 + rr(-0.3, 0.2)); c.rotate(rr(-0.12, 0.08));
    c.fillStyle = 'rgb(0,0,70)';
    c.beginPath(); c.roundRect ? c.roundRect(-0.95, -1.25, 1.9, 2.5, 0.25) : c.rect(-0.95, -1.25, 1.9, 2.5); c.fill();
    c.strokeStyle = 'rgb(255,0,0)';
    writeText(c, 'R', -0.38, -0.35, 1.2, 0, R, 'lead');
    writeText(c, 'AV', -0.42, -1.0, 0.42, 0, R, 'lead');
    c.restore();

    // grease pencil
    c.strokeStyle = 'rgb(0,255,0)';
    const gx = 9.4 + rr(-0.3, 0.2), gy = 19.4 + rr(-0.3, 0.1), ga = rr(-0.05, 0.02);
    writeText(c, '2019.112.4', gx, gy, 0.95, ga, R, 'grease');
    writeText(c, 'bear — mohair,', gx - 0.05, gy - 1.35, 0.72, ga + rr(-0.02, 0.02), R, 'grease');
    writeText(c, 'excelsior. c.1955', gx + 0.2, gy - 2.45, 0.72, ga + rr(-0.03, 0.01), R, 'grease');
    writeText(c, 'AP  55kV  14.x.26', gx + 0.1, gy - 3.65, 0.62, ga + rr(-0.02, 0.02), R, 'grease');

    const nx = 11.2 + rr(-0.2, 0.2), ny = -0.2 + rr(-0.4, 0.4), na = rr(-0.06, 0.0);
    writeText(c, 'inclusion,', nx, ny, 0.7, na, R, 'grease');
    writeText(c, 'L chest —', nx + 0.15, ny - 1.05, 0.7, na, R, 'grease');
    writeText(c, 'leave in situ', nx - 0.1, ny - 2.15, 0.7, na + rr(-0.02, 0.02), R, 'grease');
  }

  /* ------------------------------------------------------------ shaders */
  const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

  const NOISE = `
vec2 hash2(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz)*p3.zy)*2.0 - 1.0; }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(dot(hash2(i), f), dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
             mix(dot(hash2(i+vec2(0,1)), f-vec2(0,1)), dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y); }
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
`;

  const FILM_FS = `#version 300 es
precision highp float; precision highp int;
out vec4 o;
uniform vec2 u_fres;
uniform sampler2D u_prim, u_ov;
uniform vec4 u_gbox[56]; uniform ivec2 u_grng[56]; uniform int u_ng;
uniform vec3 u_eC[8]; uniform mat3 u_eR[8]; uniform vec3 u_eS[8];
uniform vec4 u_limb[32];
uniform vec4 u_ear[2];
uniform vec4 u_lump[16]; uniform int u_nlump;
uniform vec4 u_wear[8];
uniform vec4 u_ring;
uniform vec4 u_off;
${NOISE}
const float MU_EX = 0.088, MU_FAB = 0.17, MU_FUR = 0.03;
const float PILE = 0.8, SKIN = 0.12;

vec2 ellI(int i, vec2 P, float dl){
  vec3 o = (vec3(P, 0.0) - u_eC[i]) * u_eR[i];
  vec3 d = vec3(0.0, 0.0, 1.0) * u_eR[i];
  vec3 s = max(u_eS[i] + dl, vec3(0.05));
  o /= s; d /= s;
  float a = dot(d, d), b = dot(o, d), c = dot(o, o) - 1.0;
  float h = b*b - a*c;
  if (h <= 0.0) return vec2(1e5, -1e5);
  h = sqrt(h);
  return vec2((-b - h)/a, (-b + h)/a);
}
float ilen(vec2 v){ return max(v.y - v.x, 0.0); }
// union length of several z-intervals that mostly overlap (one solid), disjoint leftovers added
void acc(inout vec2 cur, inout float extra, vec2 b){
  if (ilen(b) <= 0.0) return;
  if (ilen(cur) <= 0.0){ cur = b; return; }
  if (b.y < cur.x || cur.y < b.x){ extra += ilen(b); return; }
  cur = vec2(min(cur.x, b.x), max(cur.y, b.y));
}
float headL(vec2 P, float dl, float dm){
  vec2 c = ellI(0, P, dl); float ex = 0.0;
  acc(c, ex, ellI(1, P, dm)); acc(c, ex, ellI(6, P, dl)); acc(c, ex, ellI(7, P, dl));
  return ilen(c) + ex;
}
float uni(vec2 a, vec2 b){
  float la = ilen(a), lb = ilen(b);
  if (la <= 0.0) return lb;
  if (lb <= 0.0) return la;
  if (a.y < b.x || b.y < a.x) return la + lb;
  return max(a.y, b.y) - min(a.x, b.x);
}

float rho(vec2 P){
  float r = 1.0;
  for (int i = 0; i < 16; i++){ if (i >= u_nlump) break; vec4 l = u_lump[i]; vec2 d = P - l.xy; r += l.w*exp(-dot(d,d)/(l.z*l.z)); }
  return max(r, 0.12);
}
float wear(vec2 P){
  float w = 1.0;
  for (int i = 0; i < 8; i++){ vec4 l = u_wear[i]; vec2 d = P - l.xy; w -= l.w*exp(-dot(d,d)/(l.z*l.z)); }
  w *= smoothstep(-0.3, 0.2, noise(P*0.42 + u_off.w) + 0.22);
  return clamp(w, 0.0, 1.0);
}

// wood wool: many layers of long crimped ribbons, each layer a different lie
float exc(vec2 p, float aligned){
  p += u_off.xy*(1.0 - aligned) + vec2(3.3, 7.1)*aligned;
  vec2 w = vec2(noise(p*0.28), noise(p*0.28 + vec2(5.2, 1.3)));
  vec2 pw = p + w*0.8;
  // each handful was pushed in with its own lie: one dominant direction per region
  float reg = noise(p*0.2 + 4.0)*3.4 + u_off.z;
  float acc = 0.0;
  for (int k = 0; k < 7; k++){
    float fk = float(k);
    float a = mix(fk*0.4488 + u_off.z, (fk - 3.0)*0.11, aligned);
    float wgt = mix(0.12 + 0.88*pow(0.5 + 0.5*cos(2.0*(a - reg)), 4.0), 1.0, aligned);
    vec2 cs = vec2(cos(a), sin(a));
    vec2 q = vec2(dot(pw, cs), dot(pw, vec2(-cs.y, cs.x)));
    q.y += 0.4*noise(vec2(q.x*0.45, q.y*0.22) + fk*3.7) + 0.05*sin(q.x*6.5 + fk*1.3);
    float n = noise(vec2(q.x*0.26, q.y*2.1) + fk*11.3);
    float tw = abs(noise(vec2(q.x*1.1, q.y*0.5) + fk*5.0));           // the ribbon twisting along its length
    float wd = 0.035 + 0.16*smoothstep(0.05, 0.6, tw);                  // edge-on: thin; face-on: a few mm wide
    float t = abs(n)/wd;
    float body = 1.0 - smoothstep(0.78, 1.0, t);
    float edge = exp(-pow((t - 0.86)/0.12, 2.0));
    float bright = mix(1.6, 0.42, smoothstep(0.05, 0.6, tw));           // a ribbon seen edge-on is a bright line
    acc += wgt*(body*bright + edge*0.55);
  }
  float clump = noise(p*0.5 + 9.0)*0.55 + noise(p*1.5)*0.22;
  return 0.18 + acc*0.62*(0.8 + clump) + clump*0.5;
}
// rags: wads of torn cloth, smooth inside, a brighter fold where two wads meet edge-on
vec2 cell(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + hash2(i + g)*0.42 + 0.5 - f;
    float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(vec2(d1, d2));
}
float rags(vec2 p){
  vec2 q = p*0.62 + 0.9*vec2(noise(p*0.4), noise(p*0.4 + 3.0));
  vec2 c = cell(q);
  float lobe = 1.0 - 0.95*c.x*c.x;                                       // each wad a soft stacked lobe
  float fold = exp(-pow((c.y - c.x)/0.045, 2.0))*smoothstep(-0.25, 0.25, noise(p*0.7 + 5.0));
  vec2 c2 = cell(q*1.9 + 4.0);
  float lay = exp(-pow((c2.y - c2.x)/0.035, 2.0))*smoothstep(0.0, 0.35, noise(p*0.9 + 1.0));
  vec2 hq = vec2(p.x*0.8 + p.y*0.6, p.y*0.8 - p.x*0.6);
  float hem = exp(-pow(noise(hq*vec2(0.35, 1.6) + 2.0)/0.03, 2.0))*smoothstep(0.1, 0.4, noise(p*0.45 + 8.0));
  return 0.55 + 0.55*lobe + 0.45*fold + 0.3*lay + 0.5*hem + 0.05*noise(p*3.5);
}
float hair(vec2 q){
  float n = noise(vec2(q.x*1.6, q.y*3.2));
  return 0.7 + 0.6*smoothstep(-0.35, 0.5, n);
}
float partA(vec3 L, float F, float r, float hr, float wr){
  float st = L.z;
  float sk = max(L.y - L.z, 0.0);
  float fu = max(L.x - L.y, 0.0);
  return MU_EX*r*F*st + MU_FAB*sk + MU_FUR*hr*wr*fu;
}

void tubeQ(int li, vec2 P, out float dd, out float rr, out float sArc, out float sgn){
  float best = 1e9; dd = 1e9; rr = 0.0; sArc = 0.0; sgn = 1.0;
  float acc = 0.0;
  for (int k = 0; k < 7; k++){
    vec4 a = u_limb[li*8 + k], b = u_limb[li*8 + k + 1];
    vec2 ab = b.xy - a.xy, ap = P - a.xy;
    float L2 = max(dot(ab, ab), 1e-6);
    float t = clamp(dot(ap, ab)/L2, 0.0, 1.0);
    float d = length(ap - ab*t);
    float r = mix(a.z, b.z, t);
    if (d - r < best){ best = d - r; dd = d; rr = r; sArc = acc + t*sqrt(L2); sgn = sign(ab.x*ap.y - ab.y*ap.x); }
    acc += sqrt(L2);
  }
}
float tubeH(float d, float r, float dl){ float R = r + dl; return 0.86*sqrt(max(R*R - d*d, 0.0)); }

vec4 PF(int i){ return texelFetch(u_prim, ivec2(i & 1023, i >> 10), 0); }
vec2 cylI(vec3 op, vec3 dp, float R){
  float a = dot(dp, dp);
  if (a < 1e-8) return dot(op, op) < R*R ? vec2(-1e5, 1e5) : vec2(1e5, -1e5);
  float b = dot(op, dp), c = dot(op, op) - R*R;
  float h = b*b - a*c;
  if (h <= 0.0) return vec2(1e5, -1e5);
  h = sqrt(h);
  return vec2((-b - h)/a, (-b + h)/a);
}
vec2 isect(vec2 a, vec2 b){ return vec2(max(a.x, b.x), min(a.y, b.y)); }
vec2 slab(float o, float d, float h){
  if (abs(d) < 1e-6) return abs(o) <= h ? vec2(-1e5, 1e5) : vec2(1e5, -1e5);
  float t0 = (-h - o)/d, t1 = (h - o)/d;
  return vec2(min(t0, t1), max(t0, t1));
}
float primA(int i, vec2 P){
  vec4 t0 = PF(i), t1 = PF(i + 1), t2 = PF(i + 2);
  int ty = int(t0.x + 0.5); float mu = t0.y;
  vec3 o = vec3(P, 0.0) - t1.xyz;
  if (ty == 0){
    vec3 a = t1.xyz, b = t2.xyz; float r = t0.z;
    vec2 ab = b.xy - a.xy, ap = P - a.xy;
    float L2 = dot(ab, ab);
    float tr = L2 > 1e-8 ? dot(ap, ab)/L2 : 0.5;
    int caps = int(t0.w + 0.5);
    if (tr < 0.0 && (caps & 1) == 0) return 0.0;
    if (tr >= 1.0 && (caps & 2) == 0) return 0.0;
    float d = length(ap - ab*clamp(tr, 0.0, 1.0));
    if (d >= r) return 0.0;
    vec3 D = b - a; float Ln = length(D);
    float dz = Ln > 1e-6 ? abs(D.z)/Ln : 1.0;
    float c = 2.0*sqrt(r*r - d*d)/sqrt(max(1.0 - dz*dz, 1e-4));
    return mu*min(c, Ln*dz + 2.0*r);
  }
  if (ty == 1){
    vec3 n = t2.xyz; float h = t1.w;
    float on = dot(o, n), dn = n.z;
    vec2 sl = slab(on, dn, h);
    if (sl.y <= sl.x) return 0.0;
    vec3 op = o - on*n, dp = vec3(0, 0, 1) - dn*n;
    float L = ilen(isect(sl, cylI(op, dp, t0.z)));
    if (t0.w > 0.0) L -= ilen(isect(sl, cylI(op, dp, t0.w)));
    return mu*max(L, 0.0);
  }
  vec4 t3 = PF(i + 3);
  vec3 u = t2.xyz, v = t3.xyz, w = cross(u, v);
  vec3 sz = vec3(t2.w, t3.w, t1.w);
  if (ty == 2){
    vec3 lo = vec3(dot(o, u), dot(o, v), dot(o, w))/sz;
    vec3 ld = vec3(u.z, v.z, w.z)/sz;
    float a = dot(ld, ld), b = dot(lo, ld), c = dot(lo, lo) - 1.0;
    float hh = b*b - a*c;
    return hh > 0.0 ? mu*2.0*sqrt(hh)/a : 0.0;
  }
  if (ty == 3){
    vec2 iv = isect(isect(slab(dot(o, u), u.z, sz.x), slab(dot(o, v), v.z, sz.y)), slab(dot(o, w), w.z, sz.z));
    return mu*ilen(iv);
  }
  // torus, projected as a tube along the ring's ellipse
  vec3 n = t2.xyz; float Rm = t0.z, r = t0.w;
  vec2 e1 = length(n.xy) > 1e-4 ? normalize(n.xy) : vec2(0, 1);
  vec2 e2 = vec2(-e1.y, e1.x);
  vec2 q = vec2(dot(o.xy, e2), dot(o.xy, e1));
  float nz = abs(n.z), b = max(Rm*nz, 1e-3);
  float psi = atan(q.y/b, q.x/Rm);
  vec2 pe = vec2(Rm*cos(psi), b*sin(psi));
  float d = length(q - pe);
  float d2 = length(q - vec2(pe.x, -pe.y));
  float Tz = cos(psi)*sqrt(max(1.0 - nz*nz, 0.0));
  float acc = 0.0;
  if (d < r) acc += 2.0*sqrt(r*r - d*d)/sqrt(max(1.0 - Tz*Tz, 0.02));
  if (b < r && d2 < r && abs(pe.y) > 1e-3) acc += 2.0*sqrt(r*r - d2*d2)/sqrt(max(1.0 - Tz*Tz, 0.02));
  return mu*acc;
}

void main(){
  vec2 uv = gl_FragCoord.xy/u_fres;
  vec2 P = (uv - 0.5)*vec2(${FW.toFixed(1)}, ${FH.toFixed(1)});
  float A = 0.0;
  float rh = rho(P), wr = wear(P);
  // mohair edges are never conic: the outline breathes with the pile and the lumps under it
  float jo = noise(P*0.7 + 21.0)*0.32 + noise(P*2.3 + 5.0)*0.12;
  float dO = PILE*(0.75 + 0.5*wr) + jo*1.3, dS = jo*0.45, dI = -SKIN + jo*0.45;
  float sEx = 0.0, sExL = 0.0, sRag = 0.0, fab = 0.0, fur = 0.0, bestL = 0.0;
  vec2 limbQ = vec2(0.0);

  // head: cranium U muzzle
  if (length(P - u_eC[0].xy) < 9.5){
    vec3 L = vec3(headL(P, dO, PILE*0.3 + dS), headL(P, dS, dS), headL(P, dI, dI));
    if (L.x > 0.0){
      sEx += rh*L.z; fab += max(L.y - L.z, 0.0);
      float fu = max(L.x - L.y, 0.0);
      vec2 dv = P - u_eC[0].xy;
      fur += fu*(L.z < 2.0 ? hair(vec2(length(dv), atan(dv.y, dv.x)*6.0)) : 1.0);
    }
  }
  // torso: chest U belly
  if (abs(P.x - u_eC[3].x) < 9.0 && P.y < u_eC[2].y + 8.0 && P.y > u_eC[3].y - 8.5){
    vec3 L = vec3(uni(ellI(2, P, dO), ellI(3, P, dO)),
                  uni(ellI(2, P, dS), ellI(3, P, dS)),
                  uni(ellI(2, P, dI), ellI(3, P, dI)));
    if (L.x > 0.0){
      vec2 rd = P - u_ring.xy;
      vec2 rw = rd + 0.25*u_ring.z*vec2(noise(P*0.9 + 3.0), noise(P*0.9 + 8.0));
      float rq = length(rw)/u_ring.z;
      float cav = exp(-rq*rq*1.4);
      float rim = exp(-pow((rq - 1.05)/0.32, 2.0));
      sEx += rh*(1.0 - 0.92*cav)*(1.0 + 0.55*rim)*L.z; fab += max(L.y - L.z, 0.0);
      float fu = max(L.x - L.y, 0.0);
      vec2 dv = P - u_eC[3].xy;
      fur += fu*(L.z < 2.0 ? hair(vec2(length(dv), atan(dv.y, dv.x)*7.0)) : 1.0);
      A += 0.07*cav*(0.75 + 0.5*noise(P*2.2))*smoothstep(0.0, 2.0, L.z);   // a nest of cotton wool
    }
  }
  // limbs
  for (int li = 0; li < 4; li++){
    float d, r, sa, sg;
    tubeQ(li, P, d, r, sa, sg);
    r += (li == 0 ? 0.26 : 0.1)*noise(vec2(sa*0.75, float(li)*5.0 + sg*0.6)) + (li == 0 ? 0.12*noise(P*1.4) : 0.0);
    if (d > r + PILE + 2.6) continue;
    float zc = u_limb[li*8].w;
    float hO = tubeH(d, r, dO), hS = tubeH(d, r, dS), hI = tubeH(d, r, dI);
    vec3 L = vec3(2.0*hO, 2.0*hS, 2.0*hI);
    if (li >= 2){
      int fe = li + 2;
      L = vec3(uni(vec2(zc - hO, zc + hO), ellI(fe, P, dO)),
               uni(vec2(zc - hS, zc + hS), ellI(fe, P, dS)),
               uni(vec2(zc - hI, zc + hI), ellI(fe, P, dI)));
    }
    if (L.x <= 0.0) continue;
    if (li == 0) sRag += L.z;
    else {
      // wood wool is pushed in lengthwise: in the limbs the strands follow the limb
      float m = rh*L.z;
      sExL += m;
      if (m > bestL){
        bestL = m;
        vec2 a0 = u_limb[li*8].xy, ax = normalize(u_limb[li*8 + 7].xy - a0);
        vec2 dp = P - a0;
        limbQ = vec2(dot(dp, ax), ax.x*dp.y - ax.y*dp.x) + float(li)*vec2(13.0, 0.0);
      }
    }
    fab += max(L.y - L.z, 0.0);
    float fu = max(L.x - L.y, 0.0);
    fur += fu*(L.z < 1.5 ? hair(vec2(d, sa)) : 1.0)*(li == 0 ? 0.5 : 1.0);
  }
  if (sEx > 0.0) A += MU_EX*exc(P, 0.0)*sEx;
  if (sExL > 0.0) A += MU_EX*exc(limbQ, 1.0)*sExL;
  if (sRag > 0.0) A += MU_EX*1.6*rags(P)*sRag;
  A += MU_FAB*fab + MU_FUR*wr*fur;
  // ears: two layers of mohair, the rim seam, the pile
  for (int i = 0; i < 2; i++){
    vec4 e = u_ear[i];
    vec2 q = P - e.xy;
    vec2 ou = vec2(cos(e.w), sin(e.w));
    q = vec2(dot(q, vec2(ou.y, -ou.x)), dot(q, ou));
    float sd = max(length(q) - e.z, -(q.y + 0.25*e.z));
    if (sd > PILE + 0.2) continue;
    float inside = 1.0 - smoothstep(-0.03, 0.03, sd);
    float cup = 1.0 - clamp(dot(q, q)/(e.z*e.z), 0.0, 1.0);
    A += MU_FAB*inside*(0.32 + 0.45*(1.0 - cup) + 0.7*exp(-sd*sd/0.012));
    A += MU_FUR*(0.8 + 0.4*noise(q*2.5))*wr*1.7*(1.0 - smoothstep(-0.4, PILE, sd));
  }
  // hard things
  for (int g = 0; g < 56; g++){
    if (g >= u_ng) break;
    vec4 bb = u_gbox[g];
    if (P.x < bb.x || P.y < bb.y || P.x > bb.z || P.y > bb.w) continue;
    ivec2 rg = u_grng[g];
    for (int k = 0; k < 64; k++){
      if (k >= rg.y) break;
      A += primA((rg.x + k)*4, P);
    }
  }
  // lead and plastic on the cassette
  vec4 ov = texture(u_ov, uv);
  A += ov.r*14.0 + ov.b*0.55;

  // quantum mottle (more where less radiation got through)
  float px = 43.0/u_fres.y;
  float mot = (h21(gl_FragCoord.xy + u_off.w*13.0) - 0.5)*0.9 + noise(P*9.0)*0.8;
  A = max(A, 0.0);
  A += mot*0.022*(px/0.035)*(0.4 + min(A, 3.0)*0.35);
  A = max(A, 0.0);
#ifdef ENC8
  o = vec4(asinh(A/0.25)/7.0, exp(-A), 0.0, 1.0);
#else
  o = vec4(A, exp(-A), 0.0, 1.0);
#endif
}`;

  const DISP_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 u_res, u_ctr;
uniform float u_ppcm;
uniform vec3 u_film;
uniform vec2 u_fres;
uniform vec2 u_wl;
uniform float u_power, u_seed;
uniform sampler2D u_tex, u_ov;
uniform vec2 u_clips;
${NOISE}
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float tone(float A){
  float a = asinh(max(A, 0.0)/0.25);
  float x = (a - u_wl.y)/u_wl.x;
  float v = 1.0/(1.0 + exp(-x*5.0));
  float v0 = 1.0/(1.0 + exp(2.6)), v1 = 1.0/(1.0 + exp(-2.6));
  return clamp((v - v0)/(v1 - v0), 0.0, 1.0);
}
float bbox(vec2 p, vec2 c, vec2 h, float s){
  vec2 d = abs(p - c);
  vec2 k = smoothstep(-s, s, h - d);
  return k.x*k.y;
}
float getA(float r){
#ifdef ENC8
  return sinh(r*7.0)*0.25;
#else
  return r;
#endif
}
vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 s = (fc - u_ctr)/u_ppcm;
  float px = 1.0/u_ppcm;
  float P = u_power;
  vec3 cold = vec3(0.90, 0.97, 1.0);

  vec2 pc = vec2(0.0, -0.4), ph = vec2(19.2, 23.6);
  float dPanel = sdBox(s - pc, ph, 0.25);
  float spill = 1.0/(1.0 + max(dPanel, 0.0)*max(dPanel, 0.0)/260.0);

  // the wall of the archive
  vec3 col = vec3(0.005, 0.0055, 0.0065)*(0.3 + 0.7*spill*P)*(0.92 + 0.16*noise(s*0.35));
  // the viewer housing (a bank of bays, only one switched on)
  float dHouse = sdBox(s - vec2(0.0, -0.35), vec2(83.0, 27.4), 0.9);
  if (dHouse < 0.0){
    float bev = smoothstep(0.0, 0.6, -dHouse);
    vec3 hcol = vec3(0.0065, 0.007, 0.008)*(0.2 + 0.8*spill*P);
    hcol *= 0.85 + 0.15*smoothstep(-27.0, 27.0, s.y);
    hcol += vec3(0.05)*P*exp(-max(dPanel, 0.0)/0.35)*0.5;   // bevel lit by the panel
    col = mix(col, hcol, bev);
    // the clip rail along the top
    float rail = smoothstep(23.0, 23.15, s.y)*(1.0 - smoothstep(25.6, 25.75, s.y));
    col = mix(col, vec3(0.008, 0.0085, 0.009)*(0.5 + 0.5*P) + vec3(0.025)*P*exp(-max(s.y - 23.1, 0.0)/0.2), rail*0.9);
    // dark neighbouring bays
    for (int b = -1; b <= 1; b += 2){
      vec2 c2 = vec2(float(b)*41.0, -0.4);
      float d2 = sdBox(s - c2, ph, 0.25);
      if (d2 < 0.0){
        float near = exp(-abs(s.x - float(b)*21.8)/9.0);
        vec3 off = vec3(0.010, 0.012, 0.014)*(0.2 + P*(0.8*near + 0.15));
        off *= 1.0 - 0.12*cos((s.x - c2.x)*6.2832/12.8);
        col = mix(col, off, smoothstep(0.0, 0.08, -d2));
      }
    }
  }

  // lit panel
  float pan = 1.0 - smoothstep(-px, px, dPanel);
  float tubes = 1.0 + 0.03*cos((s.x + 0.3)*6.2832/12.8) - 0.10*smoothstep(10.0, 23.5, abs(s.y + 0.4)) - 0.07*smoothstep(13.0, 19.2, abs(s.x));
  float Lp = P*tubes*(1.0 + 0.015*noise(s*0.9));
  col = mix(col, cold*Lp*1.45, pan);

  // the film
  vec2 fl = rot(s - u_film.xy, -u_film.z);
  float dFilm = sdBox(fl, vec2(17.5, 21.5), 0.35);
  dFilm = max(dFilm, -(length(fl - vec2(13.1, 21.5)) - 0.33));
  float cov = 1.0 - smoothstep(-0.7*px, 0.7*px, dFilm);
  // a soft shadow line where the film lifts off the diffuser
  col *= 1.0 - 0.10*pan*exp(-max(dFilm, 0.0)/0.12)*(1.0 - cov);
  if (cov > 0.0){
    vec2 uv = fl/vec2(${FW.toFixed(1)}, ${FH.toFixed(1)}) + 0.5;
    float tpp = u_fres.y/${FH.toFixed(1)}*px;
    float lod = max(log2(max(tpp, 1e-3)), 0.0) + 0.35;
    float A = getA(textureLod(u_tex, uv, lod).r);
    A += 0.20*(uv.y - 0.5);                              // anode heel: the head end saw less
    float Es = textureLod(u_tex, uv, 6.0).g;             // scatter fog
    float At = -log(exp(-A) + 0.03*Es) + log(1.03);
    float v = tone(At);
    // unexposed border where the collimator overlapped the cassette
    float coll = smoothstep(-0.25, 0.25, fl.x - 16.95 + 0.05*fl.y*0.02) + smoothstep(-0.25, 0.25, -21.05 - fl.y + 0.008*fl.x);
    v = max(v, clamp(coll, 0.0, 1.0)*0.82);
    float T = mix(0.0016, 0.80, pow(v, 1.25));
    vec3 tint = mix(vec3(0.62, 0.74, 0.90), vec3(0.84, 0.93, 1.0), v);
    vec3 fcol = cold*Lp*1.45*T*tint;
    // light piped along the cut edge of the film base
    fcol += cold*Lp*0.22*exp(dFilm/0.045);
    // sheen of the room in the film's surface, the curl at the lower corners
    float curl = smoothstep(14.0, 17.5, abs(fl.x))*(1.0 - smoothstep(-21.5, -16.0, fl.y));
    float sheen = 0.0045 + 0.006*smoothstep(-30.0, 30.0, fl.x*0.6 + fl.y) + 0.03*curl*smoothstep(0.0, 1.0, -dFilm);
    sheen *= 0.85 + 0.3*noise(fl*0.25);
    fcol += vec3(0.80, 0.86, 0.95)*sheen*P;
    // dust on the film
    vec2 dc = floor(fl/0.45);
    float hd = h21(dc + 7.3);
    if (hd > 0.985){
      vec2 dp = (dc + 0.5 + (vec2(h21(dc + 1.1), h21(dc + 2.2)) - 0.5)*0.6)*0.45;
      float dd = length(fl - dp);
      float sp = 1.0 - smoothstep(0.012, 0.012 + px, dd);
      fcol = mix(fcol, vec3(0.5)*0.03 + fcol*0.25, sp*0.8);
    }
    // grease pencil: waxy, lit by the room, blocking the lightbox
    float g = texture(u_ov, uv).g;
    float wax = g*(0.72 + 0.28*smoothstep(-0.3, 0.4, noise(fl*vec2(28.0, 9.0))));
    vec3 waxc = vec3(0.86, 0.84, 0.78)*0.07*(0.4 + 0.6*P) + fcol*0.12;
    fcol = mix(fcol, waxc, clamp(wax, 0.0, 1.0));
    col = mix(col, fcol, cov);
  }

  // film clips: blackened spring clips, backlit, a cold line of light along their edges
  float clipM = 0.0;
  for (int i = 0; i < 2; i++){
    float cx = i == 0 ? u_clips.x : u_clips.y;
    vec2 q = s - vec2(cx, 22.2);
    float dJaw = sdBox(q - vec2(0.0, -0.25), vec2(1.25, 1.15), 0.18);
    float dDrum = sdBox(q - vec2(0.0, 1.1), vec2(1.45, 0.42), 0.4);
    float dTab = sdBox(q - vec2(0.0, 2.0), vec2(0.45, 0.7), 0.12);
    float d = min(min(dJaw, dDrum), dTab);
    if (d < 0.5){
      float m0 = 1.0 - smoothstep(-px, 0.0, d);
      vec3 m = vec3(0.006, 0.0065, 0.007)*(0.5 + 0.5*P);
      float cyl = clamp((q.y - 0.68)/0.84, 0.0, 1.0);
      m += vec3(0.05, 0.055, 0.06)*P*pow(sin(cyl*3.1416), 6.0)*step(dDrum, 0.0)*0.5;   // highlight on the hinge drum
      m += vec3(0.012)*P*smoothstep(-0.25, 0.0, dJaw)*step(dJaw, 0.0);
      m += vec3(0.03)*P*step(abs(q.x) - 0.08, 0.0)*step(abs(q.y - 1.1), 0.08)*0.6;        // rivet
      m += vec3(0.12, 0.13, 0.14)*P*exp(d/0.035)*pan;                                     // light wrapping the edge
      col = mix(col, m, m0);
      clipM = max(clipM, m0);
    }
  }

  // bloom: the bright margin and the brightest metal
  float bp = bbox(s, pc, ph, 1.2) - 0.97*bbox(s, u_film.xy, vec2(17.5, 21.5), 1.2);
  float bw = bbox(s, pc, ph, 6.0) - 0.97*bbox(s, u_film.xy, vec2(17.5, 21.5), 6.0);
  col += cold*P*(max(bp, 0.0)*0.10*(1.0 - 0.7*clipM) + max(bw, 0.0)*0.05);
  vec2 fuv = clamp(fl/vec2(${FW.toFixed(1)}, ${FH.toFixed(1)}) + 0.5, 0.0, 1.0);
  float ab = getA(textureLod(u_tex, fuv, 4.5).r);
  col += cold*P*pow(tone(ab), 2.0)*0.05*(1.0 - smoothstep(-1.0, 2.0, dFilm));

  // camera
  col = 1.0 - exp(-col*1.25);
  col = pow(col, vec3(1.0/2.2));
  vec2 vq = (fc - 0.5*u_res)/max(u_res.x, u_res.y);
  col *= 1.0 - 0.35*dot(vq, vq);
  col += (h21(fc + u_seed) - 0.5)*0.022;
  o = vec4(col, 1.0);
}`;

  /* ------------------------------------------------------------ GL helpers */
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, fs, defs) {
    const p = gl.createProgram();
    if (defs) fs = fs.replace('\n', '\n' + defs + '\n');
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      U[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, U };
  }

  const DEF_WL = [3.5, 2.1];

  (window.PIECES = window.PIECES || []).push({
    id: 'radiograph',
    title: 'Bear, AP View, Patient Age 71',
    medium: 'Radiograph on a lightbox, grease pencil, lead markers',
    note: 'Drag: sideways for contrast, down to dig to the metal',
    about: 'A conservator radiographs a much-loved 1950s jointed bear and treats the film as a portrait: mohair, wood-wool, card discs and cotter pins, a growler in the belly, an arm that was once restuffed with rags, and something tied in where the heart would be. Every grey is integrated along parallel rays through a modelled body, then printed as film and hung on a cold lightbox.',
    tone: 'dark',
    room: '#060708',
    mount(el, api) {
      const seed = api.seed >>> 0;
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair';
      el.style.background = '#060708';
      el.appendChild(canvas);

      let alive = true, raf = 0, raf2 = 0, raf3 = 0, timer = 0;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl) {
        el.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9aa;font-style:italic">This film needs WebGL2 to be developed.</div>';
        api.ready();
        return { destroy() {} };
      }
      const floatOK = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');

      let filmP, dispP;
      try {
        filmP = program(gl, FILM_FS, floatOK ? '' : '#define ENC8');
        dispP = program(gl, DISP_FS, floatOK ? '' : '#define ENC8');
      } catch (e) {
        console.error(e);
        el.textContent = 'The film could not be developed.';
        api.ready();
        return { destroy() {} };
      }
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      /* scene */
      const S = buildScene(seed);
      const R2 = mulberry32((seed ^ 0xF11A) >>> 0);
      const filmPose = [(R2() - 0.5) * 0.5, (R2() - 0.5) * 0.3, (R2() - 0.5) * 0.016];
      const clips = [-9.5 + (R2() - 0.5) * 1.2, 9.5 + (R2() - 0.5) * 1.2];

      // primitive texture
      const NP = S.prims.length;
      const texW = 1024, texH = Math.max(1, Math.ceil((NP * 4) / texW));
      const pdata = new Float32Array(texW * texH * 4);
      S.prims.forEach((p, i) => pdata.set(p, i * 16));
      const primTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, primTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, texW, texH, 0, gl.RGBA, gl.FLOAT, pdata);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      if (S.groups.length > 56) console.warn('radiograph: too many groups');

      let cur = null, rendering = 0;

      function setFilmUniforms() {
        const U = filmP.U;
        gl.useProgram(filmP.p);
        const gb = new Float32Array(56 * 4), gr = new Int32Array(56 * 2);
        S.groups.slice(0, 56).forEach((g, i) => { gb.set(g.box, i * 4); gr[i * 2] = g.start; gr[i * 2 + 1] = g.count; });
        gl.uniform4fv(U.u_gbox, gb); gl.uniform2iv(U.u_grng, gr); gl.uniform1i(U.u_ng, Math.min(56, S.groups.length));
        const eC = [], eR = [], eS = [];
        S.E.forEach((e) => { eC.push(...e.c); eR.push(...e.ax[0], ...e.ax[1], ...e.ax[2]); eS.push(...e.s); });
        gl.uniform3fv(U.u_eC, eC); gl.uniformMatrix3fv(U.u_eR, false, eR); gl.uniform3fv(U.u_eS, eS);
        gl.uniform4fv(U.u_limb, S.limbs.flat(2));
        gl.uniform4fv(U.u_ear, S.ears.flat());
        const lumps = new Float32Array(64); S.lumps.slice(0, 16).forEach((l, i) => lumps.set(l, i * 4));
        gl.uniform4fv(U.u_lump, lumps); gl.uniform1i(U.u_nlump, Math.min(16, S.lumps.length));
        const wear = new Float32Array(32); S.wear.slice(0, 8).forEach((l, i) => wear.set(l, i * 4));
        gl.uniform4fv(U.u_wear, wear);
        gl.uniform4fv(U.u_ring, S.ring);
        const r = mulberry32(seed ^ 0x777);
        gl.uniform4f(U.u_off, r() * 10, r() * 10, r() * 10, r() * 50);
        gl.uniform1i(U.u_prim, 0); gl.uniform1i(U.u_ov, 1);
      }

      /* layout */
      let W = 1, H = 1, dpr = 1, ppcm = 10, ctr = [0, 0];
      function layout() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = el.getBoundingClientRect();
        W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
        if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
        ppcm = Math.min((H * 0.95) / 48.6, (W * 0.985) / 36.4);
        ctr = [W / 2, H / 2 + ppcm * 0.2];
      }
      function wantRes() {
        const fh = Math.round(Math.min(2048, Math.max(1000, ppcm * FH * (dpr > 1.4 ? 1.0 : 1.15))));
        return [Math.round(fh * FW / FH), fh];
      }

      function texParams(mip) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      function makeTarget(res) {
        const t = { res };
        t.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        const levels = Math.floor(Math.log2(Math.max(res[0], res[1]))) + 1;
        gl.texStorage2D(gl.TEXTURE_2D, levels, floatOK ? gl.RGBA16F : gl.RGBA8, res[0], res[1]);
        texParams(true);
        t.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // lead, plastic and grease pencil, drawn in film space at the same resolution
        const ov = document.createElement('canvas');
        ov.width = res[0]; ov.height = res[1];
        drawOverlay(ov, seed);
        t.ov = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t.ov);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ov);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        texParams(false);
        return t;
      }
      function freeTarget(t) {
        if (!t) return;
        gl.deleteTexture(t.tex); gl.deleteTexture(t.ov); gl.deleteFramebuffer(t.fbo);
      }
      function bindFilmPass(t) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.viewport(0, 0, t.res[0], t.res[1]);
        gl.useProgram(filmP.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, primTex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.ov);
        gl.enable(gl.SCISSOR_TEST);
      }
      const frame = () => new Promise((r) => { raf = requestAnimationFrame(r); });
      let uniformsSet = false;
      // expose the film: render the projection in bands, never holding the page for long
      async function develop(res) {
        const my = ++rendering;
        const t = makeTarget(res);
        bindFilmPass(t);
        if (!uniformsSet) { setFilmUniforms(); uniformsSet = true; }
        gl.uniform2f(filmP.U.u_fres, res[0], res[1]);
        let y = 0, rows = 12;
        while (y < res[1]) {
          if (!alive || my !== rendering) { gl.disable(gl.SCISSOR_TEST); freeTarget(t); return null; }
          const h = Math.min(rows, res[1] - y);
          bindFilmPass(t);
          gl.scissor(0, y, res[0], h);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.disable(gl.SCISSOR_TEST);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const t0 = performance.now();
          for (let n = 0; n < 900; n++) {
            await frame();
            if (!alive) { gl.deleteSync(fence); return null; }
            if (gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED) break;
          }
          gl.deleteSync(fence);
          const dt = performance.now() - t0;
          y += h;
          rows = Math.max(4, Math.min(1024, Math.round(rows * Math.min(2.5, Math.max(0.5, 120 / Math.max(dt, 1))))));
        }
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.generateMipmap(gl.TEXTURE_2D);
        if (my !== rendering) { freeTarget(t); return null; }
        freeTarget(cur);
        cur = t;
        return t;
      }

      /* display */
      let wl = DEF_WL.slice(), power = 0, t0 = 0;
      // never queue more than one frame on a slow GPU: wait for the last one to land
      let dispFence = null, dispWanted = false, dispPoll = 0;
      function display() {
        if (!alive || !cur) return;
        if (dispFence) {
          const st = gl.getSyncParameter(dispFence, gl.SYNC_STATUS);
          if (st !== gl.SIGNALED) {
            dispWanted = true;
            if (!dispPoll) dispPoll = requestAnimationFrame(() => { dispPoll = 0; if (dispWanted) { dispWanted = false; display(); } });
            return;
          }
          gl.deleteSync(dispFence); dispFence = null;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.SCISSOR_TEST);
        gl.viewport(0, 0, W, H);
        gl.useProgram(dispP.p);
        const U = dispP.U;
        gl.uniform2f(U.u_res, W, H);
        gl.uniform2f(U.u_ctr, ctr[0], ctr[1]);
        gl.uniform1f(U.u_ppcm, ppcm);
        gl.uniform3f(U.u_film, filmPose[0], filmPose[1], filmPose[2]);
        gl.uniform2f(U.u_fres, cur.res[0], cur.res[1]);
        gl.uniform2f(U.u_wl, wl[0], wl[1]);
        gl.uniform1f(U.u_power, power);
        gl.uniform1f(U.u_seed, (seed % 1000) * 0.37);
        gl.uniform2f(U.u_clips, clips[0], clips[1]);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cur.ov);
        gl.uniform1i(U.u_tex, 0); gl.uniform1i(U.u_ov, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        dispFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
      }
      let pending = false;
      function request() {
        if (pending || !alive) return;
        pending = true;
        raf2 = requestAnimationFrame(() => { pending = false; display(); });
      }

      // fluorescent tube striking: a couple of blinks, then the cold steady light
      function tubePower(t) {
        if (t < 0.35) return 0.0;
        if (t < 0.42) return 0.75;
        if (t < 0.62) return 0.03;
        if (t < 0.66) return 0.9;
        if (t < 0.74) return 0.12;
        if (t < 0.80) return 0.95;
        if (t < 0.86) return 0.35;
        const k = Math.min(1, (t - 0.86) / 0.9);
        return 0.86 + 0.14 * k + 0.02 * Math.sin(t * 90) * (1 - k);
      }
      function strike(now) {
        if (!alive) return;
        if (!t0) t0 = now;
        const t = (now - t0) / 1000;
        const pw = tubePower(t);
        if (Math.abs(pw - power) > 0.01) { power = pw; display(); }
        if (t < 1.8) raf3 = requestAnimationFrame(strike);
        else { power = 1; display(); }
      }

      layout();
      (async () => {
        // a quick proof first, so the room can open; then the full-resolution film
        const full = wantRes();
        const ph = Math.min(520, Math.round(full[1] * 0.5));
        const proof = [Math.round(ph * FW / FH), ph];
        const tp0 = performance.now();
        if (!(await develop(proof))) return;
        power = 0; display();
        api.ready();
        el.dataset.proofMs = Math.round(performance.now() - tp0);
        raf3 = requestAnimationFrame(strike);
        if (!(await develop(wantRes()))) return;
        el.dataset.fullMs = Math.round(performance.now() - tp0);
        request();
      })();

      /* window / level by dragging */
      let drag = null;
      function onDown(e) {
        drag = { x: e.clientX, y: e.clientY, wl: wl.slice(), id: e.pointerId };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      function onMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const k = 1 / Math.max(240, Math.min(el.clientWidth, el.clientHeight) * 0.6);
        const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
        wl[0] = Math.max(0.25, Math.min(8, drag.wl[0] * Math.exp(dx * 1.6)));
        wl[1] = Math.max(-0.5, Math.min(6.5, drag.wl[1] + dy * 3.2));
        if (power < 1 && t0) return;
        request();
      }
      function onUp(e) { if (drag && e.pointerId === drag.id) drag = null; }
      function onDbl() {
        const from = wl.slice(), start = performance.now();
        const step = (now) => {
          if (!alive) return;
          const k = Math.min(1, (now - start) / 600), e2 = k * k * (3 - 2 * k);
          wl = [from[0] + (DEF_WL[0] - from[0]) * e2, from[1] + (DEF_WL[1] - from[1]) * e2];
          display();
          if (k < 1) raf2 = requestAnimationFrame(step);
        };
        raf2 = requestAnimationFrame(step);
      }
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('dblclick', onDbl);

      /* resize */
      const ro = new ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!alive) return;
          layout();
          const want = wantRes();
          if (cur && cur.res[1] >= 900 && Math.abs(want[1] - cur.res[1]) / cur.res[1] > 0.3) {
            develop(want).then((t) => { if (t) request(); });
          } else display();
        }, 160);
      });
      ro.observe(el);

      return {
        destroy() {
          alive = false;
          rendering++;
          cancelAnimationFrame(raf); cancelAnimationFrame(raf2); cancelAnimationFrame(raf3); cancelAnimationFrame(dispPoll);
          clearTimeout(timer);
          ro.disconnect();
          canvas.removeEventListener('pointerdown', onDown);
          canvas.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerup', onUp);
          canvas.removeEventListener('pointercancel', onUp);
          canvas.removeEventListener('dblclick', onDbl);
          const lose = gl.getExtension('WEBGL_lose_context');
          if (lose) lose.loseContext();
        },
      };
    },
  });
})();
