// tree.js - the ancient olive: a twisted rope trunk (helical strands, grain lines
// that wrap with the twist and swirl round knots, cylinder-dithered density),
// gnarled limbs with axial grain, scalloped teal foliage clumps with leaf marks,
// and roots that clamp over the parapet.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C;
  const BARK_LIT = '#c99a5c', BARK = '#a8773f', BARK_DK = '#7a5230', BARK_DEEP = '#5a3a22';
  const LEAF_LIT = '#86b6a4', LEAF = '#468e86', LEAF_DK = '#24605f', LEAF_DEEP = '#143f45';

  // spine: dense polyline [[x,y]...]; radius fn(t); opts: twist (turns), strands, amp, knots[[t,psi,size]], seed
  // Grain = evenly spaced streamlines of the projected helical grain field, swirling round knots.
  function tube(spine, radius, o) {
    const n = spine.length;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]));
    const Lpx = cum[n - 1];
    const T = cum.map((c) => c / Lpx);
    const tan = [], nrm = [];
    for (let i = 0; i < n; i++) {
      const a = spine[Math.max(0, i - 3)], b = spine[Math.min(n - 1, i + 3)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      tan.push([dx / l, dy / l]);
      nrm.push([-dy / l, dx / l]);
    }
    const flip = nrm[Math.floor(n / 2)][0] < 0 ? -1 : 1;
    for (const q of nrm) { q[0] *= flip; q[1] *= flip; }
    const seed = o.seed || 0;
    const N = o.strands || 0, amp = o.amp || 0;
    const tw = o.twist || 0;
    const phi0 = (t) => LW.TAU * tw * t + 0.5 * Math.sin(t * 5 + seed);
    const Reff = (i, psi) => radius(T[i]) * (1 + (N ? amp * Math.cos(N * (psi - phi0(T[i]))) : 0) + 0.035 * LW.noise(T[i] * 9 + seed, psi));
    const pt = (i, psi) => [spine[i][0] + nrm[i][0] * Reff(i, psi) * Math.sin(psi), spine[i][1] + nrm[i][1] * Reff(i, psi) * Math.sin(psi)];
    const left = [], right = [];
    for (let i = 0; i < n; i++) { left.push(pt(i, -Math.PI / 2)); right.push(pt(i, Math.PI / 2)); }
    const sil = left.concat(right.slice().reverse());
    const path = LW.polyPath(sil);
    const i0 = Math.floor((o.capFade || 0) * (n - 1));
    const fillPath = i0 ? LW.polyPath(left.slice(i0).concat(right.slice(i0).reverse())) : path;
    // optional exclusion: never paint inside another tube (e.g. the trunk at a fork)
    let outside = null;
    if (o.exclude) {
      outside = new Path2D();
      outside.rect(-500, -500, LW.W + 1000, LW.H + 1000);
      outside.addPath(o.exclude.path);
      LW.fill.save(); LW.fill.clip(outside, 'evenodd');
      LW.ink.save(); LW.ink.clip(outside, 'evenodd');
    }
    LW.occlude(fillPath);
    LW.flat(fillPath, o.base || BARK);
    // tonal bands; on limbs they grow in from nothing so no hard collar shows at the fork
    const ib = i0 ? Math.floor(0.3 * (n - 1)) : 0, ramp = Math.max(1, Math.floor(0.12 * (n - 1)));
    const band = (pa, pb, edge) => {
      const a = [], b = [];
      for (let i = ib; i < n; i++) {
        const k = LW.smooth(ib, ib + ramp, i);
        const qa = edge === 'b' ? LW.lerp(pb, pa, k) : pa, qb = edge === 'a' ? LW.lerp(pa, pb, k) : pb;
        a.push(pt(i, qa)); b.push(pt(i, qb));
      }
      return LW.polyPath(a.concat(b.reverse()));
    };
    void band;
    // ---- param lookup grid: screen -> (i, s=sin psi)
    const bb = LW.bbox(sil, 4);
    const cs = o.cell || 4;
    const gw = Math.ceil(bb.w / cs) + 1, gh = Math.ceil(bb.h / cs) + 1;
    const GI = new Float32Array(gw * gh), GS = new Float32Array(gw * gh);
    // coarse-to-fine nearest spine index
    const stride = Math.max(1, Math.floor(n / 120));
    for (let j = 0; j < gh; j++) {
      for (let k = 0; k < gw; k++) {
        const x = bb.x0 + k * cs, y = bb.y0 + j * cs;
        let bi = 0, bd = 1e18;
        for (let i = 0; i < n; i += stride) { const dx = spine[i][0] - x, dy = spine[i][1] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } }
        const lo = Math.max(0, bi - stride), hi = Math.min(n - 1, bi + stride);
        for (let i = lo; i <= hi; i++) { const dx = spine[i][0] - x, dy = spine[i][1] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } }
        const sd = (x - spine[bi][0]) * nrm[bi][0] + (y - spine[bi][1]) * nrm[bi][1];
        GI[j * gw + k] = bi;
        GS[j * gw + k] = sd / Math.max(1, radius(T[bi]));
      }
    }
    const look = (x, y) => {
      const fx = LW.clamp((x - bb.x0) / cs, 0, gw - 1.001), fy = LW.clamp((y - bb.y0) / cs, 0, gh - 1.001);
      const k = fx | 0, j = fy | 0, a = fx - k, b = fy - j, q = j * gw + k;
      const ii = (GI[q] * (1 - a) + GI[q + 1] * a) * (1 - b) + (GI[q + gw] * (1 - a) + GI[q + gw + 1] * a) * b;
      const ss = (GS[q] * (1 - a) + GS[q + 1] * a) * (1 - b) + (GS[q + gw] * (1 - a) + GS[q + gw + 1] * a) * b;
      return [Math.round(ii), LW.clamp(ss, -0.999, 0.999)];
    };
    const mask = LW.Mask.fromPath(path, bb, 0.5);
    // knots in screen space
    const knots = (o.knots || []).map((k) => {
      const i = Math.round(k[0] * (n - 1));
      const p = pt(i, k[1]);
      const R = radius(k[0]);
      return { p, r: R * k[2] * Math.cos(k[1]) * 0.75 + 4, c: Math.cos(k[1]), i, tn: tan[i], s: k };
    }).filter((k) => k.c > 0.2);
    const light = [-0.62, 0.78];
    const darkAt = (x, y) => {
      const [i, s] = look(x, y);
      const psi = Math.asin(s);
      const lam = Math.max(0, light[0] * s + light[1] * Math.cos(psi));
      let d = 1 - lam;
      if (N) {
        const g = Math.cos(N * (psi - phi0(T[i])));
        d = d * 0.72 + 0.42 * (0.5 - 0.5 * g) ** 1.5;
      }
      for (const k of knots) {
        const dd = Math.hypot(x - k.p[0], y - k.p[1]) / k.r;
        if (dd < 2.2) d += 0.35 * Math.exp(-((dd - 1.1) ** 2) * 3);
      }
      d += (o.darkBias || 0) + (o.darkT ? o.darkT(T[i]) : 0) + 0.08 * LW.noise(x * 0.02 + seed, y * 0.004);
      return LW.clamp(d, 0, 1);
    };
    // tone plate from the value field: four bark inks, so lit and shaded zones spiral with the strands
    if (o.tones !== false) {
      const tr = 0.5;
      const tw2 = Math.ceil(bb.w * tr), th2 = Math.ceil(bb.h * tr);
      const tc = LW.canvas(tw2, th2);
      const tg = tc.getContext('2d');
      const id = tg.createImageData(tw2, th2);
      const cols = [BARK_LIT, BARK, BARK_DK, BARK_DEEP].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      for (let j = 0; j < th2; j++) for (let k = 0; k < tw2; k++) {
        const x = bb.x0 + k / tr, y = bb.y0 + j / tr;
        if (!mask.in(x, y)) continue;
        const d = darkAt(x, y) + 0.06 * LW.noise3(x * 0.03, y * 0.01);
        const t = d < 0.3 ? 0 : d < 0.55 ? 1 : d < 0.8 ? 2 : 3;
        const q = (j * tw2 + k) * 4;
        id.data[q] = cols[t][0]; id.data[q + 1] = cols[t][1]; id.data[q + 2] = cols[t][2]; id.data[q + 3] = 255;
      }
      tg.putImageData(id, 0, 0);
      LW.fill.save(); LW.fill.clip(fillPath); LW.fill.drawImage(tc, bb.x0, bb.y0, tw2 / tr, th2 / tr); LW.fill.restore();
    }
    const dirAt = (x, y) => {
      const [i, s] = look(x, y);
      const c = Math.sqrt(1 - s * s);
      const R = radius(T[i]);
      const dpsi = LW.TAU * tw + 2.5 * Math.cos(T[i] * 5 + seed) * 0.5 * 0.2;
      let dx = tan[i][0] * Lpx + nrm[i][0] * R * c * dpsi;
      let dy = tan[i][1] * Lpx + nrm[i][1] * R * c * dpsi;
      let l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      // wavy grain
      const wv = 0.22 * LW.noise(x * 0.012 + seed, y * 0.006);
      const cw = Math.cos(wv), sw = Math.sin(wv);
      [dx, dy] = [dx * cw - dy * sw, dx * sw + dy * cw];
      // swirl round knots (flow tangent to ellipses about the knot)
      for (const k of knots) {
        const rx = x - k.p[0], ry = y - k.p[1];
        const dd = Math.hypot(rx, ry);
        const w = Math.exp(-((dd / (k.r * 1.9)) ** 2));
        if (w < 0.02) continue;
        let tx = -ry, ty = rx;
        if (tx * dx + ty * dy < 0) { tx = -tx; ty = -ty; }
        const tl = Math.hypot(tx, ty) || 1;
        dx = dx * (1 - w) + (tx / tl) * w; dy = dy * (1 - w) + (ty / tl) * w;
      }
      l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    };
    const pen = new LW.Pen();
    const minSp = o.minSp || 2.4, maxSp = o.maxSp || 8;
    const lines = LW.streamlines({
      bbox: { x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bb.y1 }, seed: Math.floor(seed * 100) + 3,
      inside: o.exclude ? (x, y) => mask.in(x, y) && !o.exclude.mask.in(x, y) : (x, y) => mask.in(x, y),
      dir: dirAt,
      sep: (x, y) => { const d = darkAt(x, y); return d < 0.04 ? 0 : (minSp + maxSp * Math.pow(1 - d, 1.6)) * (o.spScale || 1); },
      step: 2.2, minLen: 10, seedGrid: 16, cell: 5, test: 0.6,
      stop: (x, y) => LW.noise3(x * 0.05 + seed, y * 0.05) > 0.8,
    });
    LW.drawLines(pen, lines, (x, y) => (0.45 + 2.0 * darkAt(x, y)) * (o.lw || 1), 0.3, 0.1);
    // bark fissures: short thick runs along the grain
    {
      const fr = LW.rng('fis' + seed);
      for (const Ln of lines) {
        if (Ln.length < 14 || fr() > (o.fissures ?? 0.16)) continue;
        const a = Math.floor(fr() * (Ln.length - 10)), len = Math.min(Ln.length - a, 6 + Math.floor(fr() * 16));
        const run = Ln.slice(a, a + len);
        const d = darkAt(run[0][0], run[0][1]);
        pen.line(run, (1.6 + 3.2 * d) * (o.lw || 1), 0.45, 0.1);
      }
    }
    pen.draw(LW.ink, C.ink);
    // grooves between strands (deep cracks spiralling up)
    if (N) {
      for (let k = 0; k < N; k++) {
        let run = [], ws = [];
        const flush = () => { if (run.length > 2) pen.line(run, ws, 0.15, 0.15); run = []; ws = []; };
        for (let i = 0; i < n; i += 2) {
          let psi = phi0(T[i]) + ((k + 0.5) * LW.TAU) / N;
          psi = ((psi + Math.PI) % LW.TAU + LW.TAU) % LW.TAU - Math.PI;
          const c = Math.cos(psi);
          if (c < 0.1) { flush(); continue; }
          const q = pt(i, psi);
          run.push(q);
          ws.push((1.5 + 6.5 * c * (0.5 + 0.5 * darkAt(q[0], q[1]))) * (o.lw || 1) * (o.grooveW || 1));
        }
        flush();
      }
    }
    // knot eyes
    for (const k of knots) {
      const ang = Math.atan2(k.tn[1], k.tn[0]);
      for (let m = 0; m < 4; m++) {
        const sc = 1 - m * 0.23;
        const ring = [];
        for (let a = 0; a < LW.TAU; a += 0.2) {
          const ex = Math.cos(a) * k.r * 0.55 * sc, ey = Math.sin(a) * k.r * 0.95 * sc;
          ring.push([k.p[0] + Math.cos(ang) * ey - Math.sin(ang) * ex, k.p[1] + Math.sin(ang) * ey + Math.cos(ang) * ex]);
        }
        if (m === 3) { LW.flat(LW.polyPath(ring), BARK_DEEP); pen.poly(ring); } else LW.outline(pen, ring, 1.2 + m * 0.5, 1.6);
      }
    }
    pen.line(left, left.map((_, i) => (2.2 + 1.0 * LW.noise(i * 0.05, 1)) * (o.lw || 1)), 0.03);
    pen.line(right, right.map((_, i) => (4.4 + 1.6 * LW.noise(i * 0.05, 2)) * (o.lw || 1)), 0.03);
    pen.draw(LW.ink, C.ink);
    if (outside) { LW.fill.restore(); LW.ink.restore(); }
    return { path, sil, left, right, pt, T, nrm, radius, mask };
  }
  LW.tube = tube;

  // ------------------------------------------------------------------ foliage
  // A clump of olive foliage: scalloped mass whose tone is built from hundreds of
  // small leaf shapes (deep -> mid -> lit), inked with leaf strokes in shadow.
  function clump(cx, cy, r, rnd, o = {}) {
    const n = Math.max(14, Math.round(r / 7));
    const pts = [];
    const s0 = rnd() * 100;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * LW.TAU, a1 = ((k + 1) / n) * LW.TAU;
      const r0 = r * (0.8 + 0.28 * LW.noise(Math.cos(a0) * 1.2 + s0, Math.sin(a0) * 1.2 + s0));
      for (let m = 0; m < 5; m++) {
        const t = m / 5;
        const a = a0 + (a1 - a0) * t;
        const bump = Math.sin(t * Math.PI) * r * 0.1 * (0.5 + rnd());
        pts.push([cx + Math.cos(a) * (r0 + bump), cy + Math.sin(a) * (r0 + bump) * 0.8]);
      }
    }
    const path = LW.polyPath(pts);
    LW.occlude(path);
    LW.flat(path, LEAF_DEEP);
    const [lx, ly] = LW.LIGHT2;
    const under = o.under ?? 0.35;
    // sub-masses inside the clump, each with its own lit crown
    const subs = [];
    const ns = r > 70 ? rnd.int(3, 5) : r > 35 ? 2 : 1;
    for (let k = 0; k < ns; k++) {
      const a = rnd() * LW.TAU, d = ns === 1 ? 0 : rnd.range(0.25, 0.55) * r;
      subs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (ns === 1 ? 1 : rnd.range(0.45, 0.65))]);
    }
    const shadeAt = (x, y) => {
      let best = subs[0], bd = 1e9;
      for (const sb of subs) { const dd = Math.hypot(x - sb[0], y - sb[1]) / sb[2]; if (dd < bd) { bd = dd; best = sb; } }
      const local = ((x - best[0]) * lx + (y - best[1]) * ly) / best[2]; // + toward light
      const glob = ((x - cx) * lx + (y - cy) * ly) / r;
      return LW.clamp(0.5 - 0.55 * local - 0.35 * glob + 0.28 * under + 0.25 * LW.smooth(150, 1000, y) - 0.1 * LW.smooth(320, 0, y) + 0.1 * LW.noise(x * 0.03, y * 0.03), 0, 1);
    };
    const layers = [new Path2D(), new Path2D(), new Path2D()];
    const cols = [LEAF_DK, LEAF, LEAF_LIT];
    const pen = new LW.Pen();
    const count = Math.round(r * r * 0.026 * (o.density || 1));
    const leafL = 17 * (o.leafScale || 1), leafW = 5 * (o.leafScale || 1);
    const leaves = [];
    for (let k = 0; k < count; k++) {
      const a = rnd() * LW.TAU, d = Math.sqrt(rnd()) * r * 1.02;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
      const sh = shadeAt(x, y);
      const tone = sh < 0.3 ? 2 : sh < 0.58 ? 1 : sh < 0.8 ? 0 : -1;
      // olive leaves droop: mostly pointing down/outward, with scatter
      const out = Math.atan2(y - cy, x - cx);
      const ang = LW.lerp(out, Math.PI / 2, 0.35) + rnd.gauss() * 0.7;
      const L = leafL * rnd.range(0.7, 1.25) * (tone === 2 ? 1.15 : 1), Wl = leafW * rnd.range(0.7, 1.2);
      leaves.push({ x, y, sh, tone, ang, L, Wl });
    }
    for (const lf of leaves) {
      if (lf.tone < 0) continue;
      const ca = Math.cos(lf.ang), sa = Math.sin(lf.ang);
      const poly = [];
      for (let q = 0; q < 8; q++) {
        const t = (q / 8) * LW.TAU;
        const ex = Math.cos(t) * lf.L * 0.5, ey = Math.sin(t) * lf.Wl * 0.5 * (Math.cos(t) > 0 ? 0.8 : 1);
        poly.push([lf.x + ex * ca - ey * sa, lf.y + ex * sa + ey * ca]);
      }
      const P = layers[lf.tone];
      P.moveTo(poly[0][0], poly[0][1]);
      for (let q = 1; q < 8; q++) P.lineTo(poly[q][0], poly[q][1]);
      P.closePath();
      // ink: a stroke along the shadow edge of the leaf (only in mid/dark)
      if (lf.sh > 0.38 && rnd() < 0.4 + 0.6 * lf.sh) {
        const ex = lf.L * 0.5;
        const ox = -sa * lf.Wl * 0.45, oy = ca * lf.Wl * 0.45;
        pen.line([[lf.x - ca * ex + ox, lf.y - sa * ex + oy], [lf.x + ox * 1.3, lf.y + oy * 1.3], [lf.x + ca * ex + ox, lf.y + sa * ex + oy]], 0.6 + 1.5 * lf.sh, 0.45, 0.1);
      }
    }
    LW.clipDo(LW.fill, path, () => {
      for (let t = 0; t < 3; t++) LW.flat(layers[t], cols[t]);
    });
    // deep shadow strokes (tiny dark leaves) in the darkest part
    for (const lf of leaves) {
      if (lf.tone >= 0 || rnd() > 0.7) continue;
      const ca = Math.cos(lf.ang), sa = Math.sin(lf.ang);
      pen.line([[lf.x - ca * lf.L * 0.4, lf.y - sa * lf.L * 0.4], [lf.x + ca * lf.L * 0.4, lf.y + sa * lf.L * 0.4]], 2.2, 0.45, 0.1);
    }
    LW.clipDo(LW.ink, path, () => pen.draw(LW.ink, C.ink));
    // contour: leaf-tip scallops, heavy underneath
    const p2 = new LW.Pen();
    LW.inkContour(p2, pts, (nx, ny, x, y) => {
      const s = LW.shadowSide(nx, ny);
      return (0.6 + 2.8 * s * s) * (0.8 + 0.4 * LW.noise3(x * 0.06, y * 0.06));
    }, { taper: 0.1 });
    // leaf tips sticking out of the silhouette
    for (let k = 0; k < pts.length; k += 3) {
      if (rnd() < 0.5) continue;
      const p = pts[k];
      const a = Math.atan2(p[1] - cy, p[0] - cx) + rnd.gauss() * 0.4;
      const L = leafL * rnd.range(0.6, 1.1);
      p2.line([p, [p[0] + Math.cos(a) * L * 0.5 + rnd.gauss() * 1.5, p[1] + Math.sin(a) * L * 0.5], [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L]], 2.2, 0.5, 0.1);
    }
    p2.draw(LW.ink, C.ink);
  }
  LW.clump = clump;

  // gnarled branch path from a start point and direction
  function branchPath(rnd, x, y, ang, len, bendiness) {
    const pts = [[x, y]];
    const seg = 14;
    let a = ang;
    for (let k = 1; k <= seg; k++) {
      a += rnd.gauss() * bendiness;
      x += Math.cos(a) * (len / seg);
      y += Math.sin(a) * (len / seg);
      pts.push([x, y]);
    }
    return LW.spline(pts, 4);
  }

  LW.drawTree = async function () {
    const rnd = LW.rng('tree');
    // ---------------------------------------------------- trunk spine (screen space)
    const spineCtrl = [[150, 3150], [190, 2850], [245, 2560], [178, 2220], [118, 1920], [175, 1580], [258, 1330], [292, 1120], [318, 880], [345, 620], [350, 380], [338, 150], [362, -120]];
    const spine = LW.spline(spineCtrl, 3);
    const trunkR = (t) => 212 + 120 * Math.exp(-t * 11) - 150 * Math.pow(t, 1.3) + 18 * Math.sin(t * 14);
    const limbs = [
      { ctrl: [[312, 1300], [400, 920], [560, 660], [790, 450], [990, 320], [1150, 250], [1240, 225]], r0: 118, r1: 9, twist: 0.45 },
      { ctrl: [[250, 1270], [175, 900], [85, 660], [-20, 450], [-140, 320]], r0: 118, r1: 66, twist: 0.3 },
      { ctrl: [[318, 1430], [490, 1210], [700, 1080], [900, 1005], [1070, 965], [1200, 915]], r0: 70, r1: 7, twist: 0.6 },
    ];
    const clumps = [];
    const twigs = [];
    const limbSp = limbs.map((l) => LW.spline(l.ctrl, 4));
    for (let li = 0; li < limbs.length; li++) {
      const sp = limbSp[li];
      const l = limbs[li];
      const nb = li === 1 ? 3 : li === 2 ? 6 : 5;
      for (let k = 0; k < nb; k++) {
        const t = 0.3 + 0.62 * (k / nb) + rnd.range(-0.04, 0.04);
        const i = Math.floor(t * (sp.length - 1));
        const p = sp[i];
        const q = sp[Math.min(sp.length - 1, i + 3)];
        const base = Math.atan2(q[1] - p[1], q[0] - p[0]);
        const side = k % 2 ? 1 : -1;
        const ang = base + side * rnd.range(0.5, 1.0) - 0.3;
        const r = LW.lerp(l.r0, l.r1, t) * 0.4;
        const len = rnd.range(150, 300) * (li === 2 ? 0.75 : 1);
        const path = branchPath(rnd, p[0], p[1], ang, len, 0.22);
        twigs.push({ path, r0: Math.max(5, r), r1: 3.5 });
        const e = path[path.length - 1];
        clumps.push([e[0], e[1], rnd.range(80, 135)]);
        for (let m = 0; m < 3; m++) {
          const j = Math.floor(rnd.range(0.4, 0.9) * (path.length - 1));
          const a2 = ang + rnd.gauss() * 0.9;
          const p2 = branchPath(rnd, path[j][0], path[j][1], a2, rnd.range(60, 140), 0.3);
          twigs.push({ path: p2, r0: Math.max(3, r * 0.3), r1: 2 });
          const e2 = p2[p2.length - 1];
          clumps.push([e2[0], e2[1], rnd.range(50, 95)]);
        }
      }
      const e = sp[sp.length - 1];
      clumps.push([e[0], e[1], li === 0 ? 120 : li === 2 ? 100 : 170]);
    }
    for (let x = -80; x < 1100; x += rnd.range(100, 150)) {
      const y = rnd.range(-70, 110) + Math.max(0, (x - 700) * 0.22);
      clumps.push([x, y, rnd.range(130, 200)]);
    }
    for (let k = 0; k < 16; k++) clumps.push([rnd.range(-60, 900), rnd.range(140, 560), rnd.range(70, 130)]);
    const ok = (c) => !(c[0] + c[2] * 0.6 > 1290 && c[1] > 280) && !(c[0] + c[2] * 0.6 > 1180 && c[1] > 560);
    const all = clumps.filter(ok);
    all.sort((a, b) => a[1] - b[1] + (b[2] - a[2]) * 0.3);
    const back = all.filter((_, i) => i % 3 === 0);
    const front = all.filter((_, i) => i % 3 !== 0);
    for (const c of back) clump(c[0], c[1], c[2] * 0.95, rnd, { under: 0.7 });
    await LW.tick();
    // twigs
    const twigPen = new LW.Pen();
    for (const tw of twigs) {
      const ws = tw.path.map((_, i) => LW.lerp(tw.r0, tw.r1, i / (tw.path.length - 1)) * 2);
      if (tw.r0 > 14) {
        tube(tw.path, (t) => LW.lerp(tw.r0, tw.r1, t), { rnd, twist: 0.15, lw: 0.75, seed: rnd() * 10, minSp: 2.2, maxSp: 7, darkBias: 0.1 });
      } else {
        const fillPen = new LW.Pen();
        fillPen.line(tw.path, ws, 0.1);
        fillPen.draw(LW.fill, BARK_DK);
        twigPen.line(tw.path, ws.map((w) => Math.max(1.8, w * 0.6)), 0.15);
      }
    }
    twigPen.draw(LW.ink, C.ink);
    // ---------------------------------------------------- the trunk, then limbs rising out of it
    const trunk = tube(spine, trunkR, {
      rnd, twist: 1.9, strands: 4, amp: 0.13, seed: 1.7, fissures: 0.22, lw: 1.1, minSp: 2.3, maxSp: 10, grooveW: 1.15,
      knots: [[0.13, -0.35, 0.3], [0.29, 0.3, 0.26], [0.4, -0.62, 0.2], [0.5, 0.1, 0.24], [0.72, -0.3, 0.3], [0.86, 0.35, 0.3]],
      darkT: (t) => 0.08 * LW.smooth(0.2, 0.0, t),
    });
    await LW.tick();
    for (const li of [1, 2, 0]) {
      const l = limbs[li];
      tube(limbSp[li], (t) => LW.lerp(l.r0, l.r1, Math.pow(t, 0.6)) * (1 + 0.25 * Math.exp(-t * 12)) * (1 - 0.8 * LW.smooth(0.82, 1, t)) + 2, {
        rnd, twist: l.twist, strands: 3, amp: 0.06, seed: li * 3.3, lw: 1, minSp: 2.3, maxSp: 9, darkBias: 0.16, exclude: trunk,
        knots: li === 2 ? [[0.3, -0.2, 0.4]] : [[0.32 + 0.08 * li, -0.3, 0.32], [0.62, 0.35, 0.26]],
        darkT: (t) => 0.15 * LW.smooth(0.15, 0, t),
      });
      await LW.tick();
    }
    for (const c of front) clump(c[0], c[1], c[2], rnd, { under: 0.45 });
    LW.treeSpine = spine;
    LW.treeR = trunkR;
  };

  // roots clamping over the parapet coping and down its face (after the parapet is drawn)
  LW.drawRoots = async function () {
    const rnd = LW.rng('roots');
    if (!LW.treeSpine) return;
    const roots = [
      { ctrl: [[175, 2640], [190, 2740], [205, 2820], [215, 2855]], r: 78, fade: 0.25 },
      { ctrl: [[-70, 2846], [60, 2836], [190, 2852], [310, 2866], [410, 2884], [470, 2900], [492, 2930]], r: 50, fade: 0, taper: 0.75 },
      { ctrl: [[70, 2845], [96, 2880], [104, 2930], [92, 3010], [110, 3090], [100, 3140]], r: 36, fade: 0.1 },
      { ctrl: [[380, 2872], [410, 2900], [424, 2950], [414, 3020], [428, 3060]], r: 22, fade: 0.1 },
      { ctrl: [[250, 2858], [272, 2895], [282, 2940]], r: 18, fade: 0.15 },
    ];
    const S = LW.scene;
    const copY = LW.proj([0, S.parapet.top + 0.11, S.parapet.z + 0.55])[1];
    for (const r of roots) {
      const sp = LW.wobble(LW.spline(r.ctrl, 3), 4, 0.02, rnd() * 10);
      const rad = (t) => r.r * (1 - (r.taper ?? 0.82) * t) + 4 + 6 * Math.exp(-t * 8);
      // cast shadow on the masonry (lower right), only on the parapet
      const clipP = new Path2D(); clipP.rect(-100, copY, 900, 900);
      LW.clipDo(LW.ink, clipP, () => {
        const sh = new LW.Pen();
        sh.line(sp.map(([x, y]) => [x + 10, y + 12]), sp.map((_, i) => rad(i / (sp.length - 1)) * 2.1), 0.2);
        sh.draw(LW.ink, C.ink, 0.5);
      });
      tube(sp, rad, { rnd, twist: 0.5, strands: 2, amp: 0.1, seed: rnd() * 10, lw: 0.95, minSp: 2.2, maxSp: 8, darkBias: 0.08, capFade: r.fade });
      const pen = new LW.Pen();
      if (r.r < 40) {
        for (let k = 0; k < 2; k++) {
          const i = Math.floor(rnd.range(0.5, 0.95) * (sp.length - 1));
          const p = sp[i];
          const path = branchPath(rnd, p[0], p[1], Math.PI / 2 + rnd.gauss() * 0.5, rnd.range(30, 80), 0.35);
          pen.line(path, path.map((_, j) => 5 * (1 - j / path.length) + 1.2), 0.2);
        }
      }
      pen.draw(LW.ink, C.ink);
      await LW.tick();
    }
  };
})();
