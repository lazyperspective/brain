// act1.js — Starship Catch, pixel-art recreation. Act 1: shots 1-5 (t = 0.0 - 30.1 s)
'use strict';
const ACT1 = (() => {
  const { W, H, R, rampc, dith2, thr, q4, clamp, sstep, lerp, hash, vnoise, fbm, surf, screen: S, pset, pget, fill, rect, blit, line, lineP, linef, poly, disc, ring, deorphan } = PX;
  const CUTS = [0, 4.338, 12.146, 15.115, 18.919, 30.1];
  const sky = R.sky, warm = R.warm, steel = R.steel, marsh = R.marsh, water = R.water, dark = R.dark, sur = R.sur, teal = R.teal;
  const ease = t => t * t * (3 - 2 * t);

  // ---- cloud baking: metaball puffs -> 4-tone pixel clouds lit from above ----
  // puffs: [{x,y,r,w,ax}] ; levels: [veil, shadow, base, light, highlight]
  function bakeClouds(w, h, puffs, levels, o = {}) {
    const F = new Float32Array(w * h);
    for (const p of puffs) {
      const r = p.r, ax = p.ax || 1.3, x0 = Math.max(0, Math.floor(p.x - r * ax - 1)), x1 = Math.min(w - 1, Math.ceil(p.x + r * ax + 1));
      const y0 = Math.max(0, Math.floor(p.y - r - 1)), y1 = Math.min(h - 1, Math.ceil(p.y + r + 1));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - p.x) / ax, dy = y + 0.5 - p.y, q = 1 - (dx * dx + dy * dy) / (r * r);
        if (q > 0) F[y * w + x] += p.w * q * q;
      }
    }
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : F[y * w + x];
    const t0 = o.t0 ?? 0.16, t1 = o.t1 ?? 0.34, lx = o.lx ?? 1, ly = o.ly ?? 2;
    const L = surf(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const f = F[y * w + x]; if (f < t0) continue;
      if (f < t1) { L.d[y * w + x] = 1; continue; } // thin veil
      const lit = at(x + lx, y + ly) - at(x - lx, y - ly); // >0 on sun-facing (upper) side
      let lev = 3; // base
      if (lit > (o.hl ?? 0.30) && f > (o.hf ?? 0.55)) lev = 5; else if (lit > (o.li ?? 0.06)) lev = 4; else if (lit < (o.sh ?? -0.10)) lev = 2;
      if (f < t1 + 0.06 && lev > 3) lev = 3;
      L.d[y * w + x] = lev;
    }
    deorphan(L); deorphan(L);
    const O = surf(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = L.d[y * w + x]; if (!l) continue;
      if (l === 1) { if (((x + y) & 1) === 0) O.d[y * w + x] = levels[0]; }
      else O.d[y * w + x] = levels[l - 1];
    }
    return O;
  }
  // scatter puffs along rotated "streets"; env(x,y) in 0..1 controls density/size
  function streetPuffs(w, h, seed, ang, along, across, env, rmin, rmax) {
    const out = [], ca = Math.cos(ang), sa = Math.sin(ang), D = Math.hypot(w, h);
    for (let v = -D; v < D; v += across) for (let u = -D; u < D; u += along) {
      const i = Math.round(u / along), j = Math.round(v / across);
      const ju = (hash(i, j, seed) - 0.5) * along * 0.8, jv = (hash(i, j, seed + 1) - 0.5) * across * 0.7;
      const x = w / 2 + (u + ju) * ca - (v + jv) * sa, y = h / 2 + (u + ju) * sa + (v + jv) * ca;
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      const e = env(x, y); if (e <= 0.02 || hash(i, j, seed + 2) > e * 1.4) continue;
      out.push({ x, y, r: lerp(rmin, rmax, e * (0.6 + 0.4 * hash(i, j, seed + 3))), w: 0.5 + 0.6 * e, ax: 1.25 });
    }
    return out;
  }

  // bubble-style puffs: drawn back-to-front, sun-lit crescent top-left, shaded underside
  function bakeBubbles(w, h, puffs, lv, o = {}) {
    const O = surf(w, h); const ps = puffs.slice().sort((a, b) => a.y - b.y);
    const hx = o.hx ?? -0.35, hy = o.hy ?? -0.45;
    for (const p of ps) {
      const rx = p.r * (p.ax || 1.3), ry = p.r;
      for (let y = Math.floor(p.y - ry - 1); y <= Math.ceil(p.y + ry + 1); y++) for (let x = Math.floor(p.x - rx - 1); x <= Math.ceil(p.x + rx + 1); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const dx = (x + 0.5 - p.x) / rx, dy = (y + 0.5 - p.y) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
        const ex = dx - hx, ey = dy - hy, dl = Math.sqrt(ex * ex + ey * ey);
        let c;
        const hl = o.hl ?? 0.62;
        if (p.r < 2.6) c = dl < 0.9 ? lv[2] : lv[1];
        else if (dl < hl) c = lv[3]; else if (dl < 1.05) c = lv[2]; else if (dy > (o.sh ?? 0.2)) c = lv[0]; else c = lv[1];
        O.d[y * w + x] = c;
      }
    }
    deorphan(O);
    return O;
  }

  // soft pixel halo around an opaque surface: rings of solid / 50% / 25% coverage (cloud softness)
  function halo(Sf, rings) { // rings: [[colour, coverage], ...] from inside out
    const w = Sf.w, h = Sf.h; let m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m[i] = Sf.d[i] ? 1 : 0;
    const O = surf(w, h);
    for (let r = 0; r < rings.length; r++) {
      const n2 = m.slice();
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (m[i]) continue;
        if (m[i - 1] || m[i + 1] || m[i - w] || m[i + w] || ((r & 1) && (m[i - w - 1] || m[i - w + 1] || m[i + w - 1] || m[i + w + 1]))) {
          n2[i] = 1; const [c, cov] = rings[r]; if (q4(cov) > thr(x, y)) O.d[i] = c;
        }
      }
      m = n2;
    }
    return O;
  }

  // selective outline for 3D-rendered steel: silhouette pixels facing the light get a highlight, the far side a dark rim
  const SIDX = new Map(); steel.forEach((c, i) => SIDX.set(c, i));
  function selOut(Sf, lx, ly, o = {}) {
    const w = Sf.w, h = Sf.h, src = Sf.d.slice(); const up = o.up ?? 1, dn = o.dn ?? 2;
    const ax = Math.sign(lx), ay = Math.sign(ly);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, c = src[i]; if (!c) continue; const k = SIDX.get(c); if (k === undefined) continue;
      const towardL = (ax && !src[i + ax]) || (ay && !src[i + ay * w]);
      const awayL = (ax && !src[i - ax]) || (ay && !src[i - ay * w]);
      if (towardL && !awayL) Sf.d[i] = steel[Math.min(8, k + up)];
      else if (awayL && !towardL) Sf.d[i] = steel[Math.max(1, k - dn)];
    }
  }

  // low-sun warm rim: brightest silhouette pixels facing the sun turn cream
  function warmRim(Sf, ax) { const w = Sf.w, h = Sf.h, src = Sf.d.slice(); for (let y = 0; y < h; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (src[i] === steel[8] && !src[i + ax] && ((x + y) % 3 !== 0)) Sf.d[i] = warm[0]; } }
  // ---- brighten a screen region along each colour's own ramp (glare / bloom), ordered-dithered
  const BR = new Map();
  (function () {
    const chains = [R.sur.concat([warm[0]]), R.teal.concat([sky[9], warm[0]]), sky.concat([warm[0]]), marsh.concat([warm[1], warm[0]]), water.concat([sky[9], warm[0]]), steel.slice(0, 8).concat([steel[8], warm[0]]), dark.concat([steel[2], steel[3]]), R.warmUp];
    for (const ch of chains) ch.forEach((c, i) => { if (!BR.has(c)) BR.set(c, { ch, i }); });
  })();
  function bloom(fn) { // fn(x,y) -> boost in ramp steps
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = fn(x, y); if (b <= 0.02) continue; const i = y * W + x, e = BR.get(S.d[i]); if (!e) continue;
      S.d[i] = rampc(e.ch, e.i + b, x, y, 0.7);
    }
  }

  // ======================= PASS 2: SHARED SURREAL LANGUAGE =======================
  // giant pale ringed planet (always east, over the sea). cov(x,y) -> 0..1 opacity (haze); light = angle toward the sun
  function drawPlanet(T, cx, cy, Rp, o = {}) {
    const tilt = o.tilt ?? -0.3, ry = o.ry ?? 0.21, la = o.light ?? Math.PI, cov = o.cov || (() => o.alpha ?? 0.9);
    const ca = Math.cos(tilt), sa = Math.sin(tilt), lx = Math.cos(la), ly = Math.sin(la);
    const LIT = [sky[9], sur[5], sky[8], warm[0], sky[9], sur[5]], SHD = [sky[7], sur[5], sky[6], sur[4], sky[7], sky[8]];
    const ext = Rp * 2.35, x0 = Math.floor(cx - ext), x1 = Math.ceil(cx + ext), y0 = Math.floor(cy - ext * 0.6), y1 = Math.ceil(cy + ext * 0.6);
    for (let y = Math.max(0, y0); y <= Math.min(T.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(T.w - 1, x1); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / Rp;
      const u = dx * ca + dy * sa, v = (-dx * sa + dy * ca);
      const rr = Math.hypot(u, v / ry) / Rp, front = v > 0;
      let ring = 0;
      if (rr > 1.28 && rr < 1.56) ring = rr < 1.33 ? sur[4] : sur[5];
      else if (rr > 1.61 && rr < 1.96) ring = (rr > 1.78 && rr < 1.81) ? sky[7] : sky[8];
      else if (rr > 2.0 && rr < 2.06) ring = sur[4];
      else if (rr > 2.1 && rr < 2.24) ring = ((x + y) & 1) ? sky[8] : 0;
      let c = 0;
      if (d <= 1 && !(ring && front)) {
        const lat = v / Rp, band = Math.floor((lat + 1) * 5.5 + 0.35 * Math.sin(u / Rp * 3.1 + lat * 4));
        const nz = Math.sqrt(Math.max(0, 1 - d * d)), lit = (dx / Rp) * lx + (dy / Rp) * ly + nz * 0.35;
        const ring_sh = front === false && rr > 1.28 && rr < 1.96 && lat < 0 && lat > -0.5 ? 1 : 0; // ring shadow across the disc
        c = q4(clamp((lit + 0.15) * 1.6, 0, 1)) > thr(x, y) ? LIT[((band % 6) + 6) % 6] : SHD[((band % 6) + 6) % 6];
        if (ring_sh && Math.abs(lat + 0.28) < 0.05) c = sur[4];
        if (d > 0.93 && lit > 0.15) c = warm[0]; // crisp lit limb
      } else if (ring) c = ring;
      if (!c) continue;
      if (q4(cov(x, y)) <= thr(x, y)) continue;
      T.d[y * T.w + x] = c;
    }
  }
  function drawMoon(T, cx, cy, r, la = 0, cov = 1) {
    disc(T, cx, cy, r, (x, y, d) => { if (q4(cov) <= thr(x, y)) return 0; const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r; const lit = dx * Math.cos(la) + dy * Math.sin(la);
      return lit > 0.25 ? (d > r - 1 ? warm[0] : sky[9]) : lit > -0.2 ? sur[5] : sky[7]; });
  }
  // aurora-like daylight veils: folded curtains, teal lower edge -> rose crowns, 25-50% ordered coverage
  function bakeAurora(w, h, o = {}) {
    const A = surf(w, h), y0 = o.y0 ?? 20, len = o.len ?? 60, seed = o.seed ?? 1, k = o.k ?? 1;
    for (let x = 0; x < w; x++) {
      const fold = 0.55 + 0.45 * Math.sin(x / 31 + Math.sin(x / 67 + seed) * 2.2);
      const top = y0 + 18 * Math.sin(x / 73 + seed) + 5 * Math.sin(x / 19 + seed * 2), L = len * (0.7 + 0.3 * fold);
      const ray = 0.7 + 0.3 * Math.sin(x * 0.9 + seed) * Math.sin(x * 0.37);
      for (let y = Math.max(0, Math.floor(top)); y < Math.min(h, top + L); y++) {
        const f = (y - top) / L, inten = fold * ray * (f < 0.85 ? Math.min(1, f * 3) : (1 - f) / 0.15) * k;
        const c = f > 0.84 ? teal[2] : f > 0.5 ? teal[1] : f > 0.22 ? sur[4] : sur[3];
        if (q4(clamp(inten * (f > 0.84 ? 0.75 : 0.5), 0, 0.75)) > thr(x, y)) A.d[y * w + x] = c;
      }
    }
    return A;
  }
  // drifting motes of light (pure function of t), twinkling; region [x0,y0,x1,y1]
  function motes(t, n, seed, x0, y0, x1, y1, cols, keep) {
    for (let k = 0; k < n; k++) {
      const bx = x0 + hash(k, 1, seed) * (x1 - x0), by = y0 + hash(k, 2, seed) * (y1 - y0), sp = 1.5 + hash(k, 3, seed) * 3;
      const x = Math.round(bx + Math.sin(t * 0.35 + k) * 6 + t * sp * 0.6), y = Math.round(by + Math.cos(t * 0.27 + k * 1.7) * 4 - t * sp * 0.4);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      if (keep && !keep(S.d[y * W + x])) continue;
      const tw = Math.sin(t * (1.3 + hash(k, 4, seed) * 2) + k * 2.1); if (tw < -0.2) continue;
      const c = cols[k % cols.length]; pset(S, x, y, c);
      if (tw > 0.85 && hash(k, 5, seed) > 0.6) { pset(S, x - 1, y, cols[(k + 1) % cols.length]); pset(S, x + 1, y, cols[(k + 1) % cols.length]); pset(S, x, y - 1, cols[(k + 1) % cols.length]); pset(S, x, y + 1, cols[(k + 1) % cols.length]); }
    }
  }
  // small floating rock island sprite (grass cap, violet stone underside, hanging roots)
  function makeIsland(seed, w) {
    const rnd = PX.mulberry(seed), h = Math.round(w * 1.1) + 4, I = surf(w + 2, h);
    const cx = (w + 1) / 2, capY = 3;
    for (let x = 0; x < w + 2; x++) {
      const u = (x - cx) / (w / 2); if (Math.abs(u) > 1) continue;
      const top = capY - Math.round(Math.sqrt(1 - u * u) * 1.5), depth = Math.round((1 - Math.abs(u) ** 1.3) * (h - 6) * (0.75 + 0.25 * rnd()));
      for (let y = top; y <= capY + depth; y++) {
        let c;
        if (y <= capY) c = y === top ? marsh[5] : (u < -0.2 ? marsh[4] : marsh[3]);
        else { const f = (y - capY) / Math.max(1, depth); c = u < -0.35 ? (f < 0.4 ? marsh[2] : sur[2]) : (f < 0.25 ? steel[3] : f < 0.6 ? sur[1] : sur[0]); if (u < -0.6 && f < 0.7) c = sur[3]; }
        pset(I, x, y, c);
      }
      if (rnd() < 0.25 && Math.abs(u) < 0.8) { const L = 2 + Math.floor(rnd() * 4), y2 = capY + depth + 1; for (let k = 0; k < L; k++) if ((k & 1) === 0 || k < 2) pset(I, x, y2 + k, sur[1]); }
    }
    if (w > 9) { const tx = Math.round(cx + (rnd() - 0.5) * w * 0.4); pset(I, tx, capY - 2, marsh[2]); pset(I, tx, capY - 3, marsh[3]); pset(I, tx - 1, capY - 3, marsh[3]); pset(I, tx + 1, capY - 3, marsh[4]); pset(I, tx, capY - 4, marsh[4]); }
    return I;
  }
  function drawIsland(I, x, y, t, ph, cov = 1) { const bob = Math.round(Math.sin(t * 0.6 + ph) * 1.2); blit(S, I, x, y + bob, cov < 1 ? ((px, py) => q4(cov) > thr(px, py)) : null); }
  // crisp hand-pixelled rims on a cloud surface: sunlit top edge and rose underside edge
  function rims(Sf, top, under) { const w = Sf.w, h = Sf.h, src = Sf.d.slice(); for (let y = 1; y < h - 1; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!src[i]) continue; if (!src[i - w] && top) Sf.d[i] = top; else if (!src[i + w] && under) Sf.d[i] = under; } }
  // a "dream" sky ramp: deep ultramarine -> teal -> apricot -> rose (banded, impossible hues)
  const DREAM = [sur[0], sky[1], sky[2], sky[3], sky[4], sky[5], teal[1], teal[2], sur[5], warm[1], warm[2], sur[4]];

  // ======================= SHOT 1 : blue sky, contrail =======================
  const S1 = (() => {
    let skyS, cloudA, cloudB, wisp, aur; const M = 48;
    const ax = 205, ay = 176; // contrail anchor (screen at t=0), slope -2/3
    function init() {
      skyS = surf(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = clamp(((W - x) / W) * 0.55 + (y / H) * 0.85, 0, 1.4) / 1.4;
        let v = 1.7 + 3.6 * u; const corner = clamp(1 - Math.hypot(x / W, (H - y) / H * 1.2) / 0.6, 0, 1); v += corner * 5.2; // apricot-rose glow low in one corner
        skyS.d[y * W + x] = rampc(DREAM, v, x, y, 0.45);
      }
      const LW = W + 2 * M, LH = H + 2 * M;
      // clear lane around the contrail, clouds heavier bottom/left
      const mask = (x, y) => {
        const sx = x - M, sy = y - M; // screen-ish coords
        const a = ((sx - 300) * 0.83 - (sy - 90) * 0.55) / 230, b = ((sx - 300) * 0.55 + (sy - 90) * 0.83) / 70;
        return sstep(0.55, 1.35, Math.sqrt(a * a + b * b));
      };
      const env = (x, y) => clamp(mask(x, y) * (fbm(x / 85, y / 55, 21, 4) * 2.1 - 0.72) * sstep(70, 135, Math.hypot(x - M - 430, (y - M - 245) * 1.4)), 0, 1);
      const puffs = streetPuffs(LW, LH, 101, 0.62, 6, 4.5, (x, y) => { const e = env(x, y); return e < 0.34 ? 0 : clamp((e - 0.26) / 0.5, 0, 1); }, 1.8, 4.2)
        .concat(streetPuffs(LW, LH, 102, 0.62, 14, 9, (x, y) => { const e = env(x, y); return e < 0.62 ? 0 : clamp((e - 0.5) / 0.5, 0, 1); }, 3.5, 6.5));
      // streaky fibres threading through the patches (mackerel / cirrocumulus texture)
      { const rnd = PX.mulberry(103); for (let i = 0; i < 1500; i++) { const x = rnd() * LW, y = rnd() * LH, e = env(x, y); if (e < 0.3 || rnd() > e) continue; puffs.push({ x, y, r: 0.9 + rnd() * 0.9, w: 1, ax: 5 + rnd() * 5 }); } }
      cloudA = bakeBubbles(LW, LH, puffs, [sur[5], sky[7], sky[8], sky[9]], { hl: 0.45, sh: 0.1 }); rims(cloudA, warm[0], 0);
      cloudB = halo(cloudA, [[sky[6], 1], [sky[6], 0.5], [sky[5], 0.5], [sky[5], 0.25], [sky[5], 0.25]]);
      // high cirrus: long flattened, low-contrast wisps
      const rnd = PX.mulberry(77); const wps = [];
      for (let g = 0; g < 7; g++) {
        const gx = rnd() * LW, gy = rnd() * LH, n = 3 + Math.floor(rnd() * 4);
        for (let k = 0; k < n; k++) wps.push({ x: gx + k * 9 + (rnd() - 0.5) * 8, y: gy + k * 3.5 + (rnd() - 0.5) * 3, r: 1.2 + rnd() * 1.3, w: 1, ax: 9 + rnd() * 6 });
      }
      wisp = bakeBubbles(LW, LH, wps, [sky[5], sky[5], sky[6], sky[6]], { hx: 0, hy: -0.6 });
      aur = bakeAurora(LW, LH, { y0: 60, len: 80, seed: 3, k: 0.85 });
    }
    function render(t) {
      blit(S, skyS, 0, 0);
      // camera pans: parallax layers (integer offsets)
      const wx = Math.round(-M + 1.0 * t), wy = Math.round(-M - 3.2 * t);
      const bx = Math.round(-M + 1.6 * t), by = Math.round(-M - 4.4 * t);
      const cx = Math.round(-M + 2.2 * t), cy = Math.round(-M - 5.8 * t);
      // far things first: the ringed planet low in the east (bottom-right), a small moon, daylight aurora veils
      drawPlanet(S, Math.round(424 + 0.6 * t), Math.round(240 - 2.4 * t), 78, { tilt: 0.5, ry: 0.24, light: -2.4, cov: (x, y) => 0.75 + 0.25 * clamp((y - 150) / 60, 0, 1) });
      drawMoon(S, Math.round(338 + 0.6 * t), Math.round(36 - 2.4 * t), 5, -2.6, 0.95);
      blit(S, aur, Math.round(-M + 0.8 * t), Math.round(-M - 2.8 * t));
      blit(S, wisp, wx, wy);
      // contrail (lives in the high wisp layer), jet flies to lower-left at 7 px/s relative to air
      const ox = wx + M, oy = wy + M;
      const vx = 6.5, xh = Math.round(ax - vx * t);
      const yAt = x => Math.floor(ay - (x - ax) * 2 / 3 + 0.5);
      for (let x = xh + 1; x < W - ox + 4; x++) {
        const age = (x - (ax - vx * t)) / vx; if (age < 0.35) continue;
        const y = yAt(x); const X = x + ox, Y = y + oy;
        const n = vnoise(x / 9, 3, 5), n2 = vnoise(x / 23, 7, 9);
        const wob = age > 12 ? Math.round((vnoise(x / 40, 7, 9) - 0.5) * Math.min(2.4, (age - 12) / 6)) : 0;
        if (age < 3.2) { // twin engine trails
          pset(S, X, Y, sky[9]); if (age > 0.9) pset(S, X, Y - 2, age < 2 ? sky[8] : sky[9]);
          if (age > 2.6) pset(S, X, Y - 1, sky[8]);
        } else if (age < 9) {
          pset(S, X, Y, sky[9]); pset(S, X, Y - 1, sky[9]); pset(S, X, Y - 2, sky[8]);
          if (age > 6 && ((X + Y) & 1)) pset(S, X, Y + 1, sky[7]);
        } else {
          const fade = clamp((age - 9) / 30, 0, 1);
          const wdt = 2 + Math.round(n * 2 + fade * 1.5);
          const yy = Y + wob; const top = yy - wdt + 1;
                    for (let k = top; k <= yy; k++) {
            const edge = (k === top || k === yy);
            let c = edge ? (fade > 0.45 ? sky[6] : sky[7]) : (fade > 0.6 ? sky[7] : sky[8]);
            if (edge && fade > 0.3 && ((X + k) & 1)) continue;
            pset(S, X, k, c);
          }
        }
      }
      blit(S, cloudB, cx, cy);
      blit(S, cloudA, cx, cy);
      // the jet: tiny glinting airliner at the head
      const jx = xh + ox, jy = yAt(xh) + oy;
      pset(S, jx, jy, steel[8]); pset(S, jx + 1, jy - 1, steel[7]); pset(S, jx - 1, jy, steel[6]);
      pset(S, jx + 1, jy, steel[5]); pset(S, jx, jy - 1, steel[6]); pset(S, jx, jy + 1, steel[5]);
      if ((t % 1.1) < 0.07) pset(S, jx - 1, jy + 1, warm[0]); // anti-collision strobe
      motes(t, 14, 41, 0, 0, W, H, [warm[0], teal[2], sur[5]]);
      // a small flock crossing low and late, much closer than the jet
      if (t > 2.3) for (let b = 0; b < 6; b++) {
        const tb = t - 2.3 - b * 0.06, bx = Math.round(-12 + tb * 60 + (b % 3) * 7 - b * 2), by = Math.round(236 - tb * 20 + ((b * 5) % 9) + Math.sin(tb * 3 + b) * 1.5);
        const fl = Math.floor(t * 9 + b * 1.3) & 1;
        pset(S, bx, by, sky[1]); pset(S, bx + 1, by, sky[1]); pset(S, bx - 1, by - fl, sky[2]); pset(S, bx + 2, by - fl, sky[2]);
        if (!fl) { pset(S, bx - 2, by + 1, sky[3]); pset(S, bx + 3, by + 1, sky[3]); } else { pset(S, bx - 2, by - 2, sky[3]); pset(S, bx + 3, by - 2, sky[3]); }
      }
    }
    return { init, render };
  })();

  // ======================= 3D TOWER (shared by shots 2-4) =======================
  const V = PX.v3, vadd = PX.add, vsub = PX.sub, vmul = PX.mul, vdot = PX.dot, vnorm = PX.norm, vcross = PX.cross;
  // prims: beams {k:'b', a, b, w, tone} ; quads {k:'q', p:[4], tone, ribs, n}
  function towerModel(o = {}) {
    const P = []; const hw = 4.5, top = 0, bot = o.bottom ?? -90;
    let curArm = 0;
    let curN = null;
    const beam = (a, b, w, tone, n) => P.push({ k: 'b', a, b, w, tone, arm: curArm, n: n || curN });
    const quad = (p, tone, ribs = 0, ribTone = -1) => P.push({ k: 'q', p, tone, ribs, ribTone, arm: curArm });
    const corners = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
    // legs
    for (const [x, z] of corners) beam(V(x, bot, z), V(x, top, z), 0.9, 1, vnorm(V(x, 0, z)));
    const FN = [V(0, 0, -1), V(1, 0, 0), V(0, 0, 1), V(-1, 0, 0)]; // outward normals of faces corners[f]->corners[f+1]
    // faces: girts + X braces
    const bay = 6;
    for (let y = top - 10; y > bot; y -= bay) {
      const y2 = y - bay;
      for (let f = 0; f < 4; f++) {
        const [x1, z1] = corners[f], [x2, z2] = corners[(f + 1) % 4]; curN = FN[f];
        beam(V(x1, y, z1), V(x2, y, z2), 0.45, 0);
        beam(V(x1, y, z1), V(x2, y2, z2), 0.32, -1); beam(V(x2, y, z2), V(x1, y2, z1), 0.32, -1);
      }
    }
    // upper open frame under the crown: heavy K braces + mid platform
    for (let f = 0; f < 4; f++) {
      const [x1, z1] = corners[f], [x2, z2] = corners[(f + 1) % 4]; curN = FN[f];
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      beam(V(x1, -10, z1), V(x2, -10, z2), 0.6, 0);
      beam(V(x1, -5, z1), V(x2, -5, z2), 0.5, 0);
      beam(V(x1, -10, z1), V(mx, -5, mz), 0.45, 0); beam(V(x2, -10, z2), V(mx, -5, mz), 0.45, 0);
      beam(V(x1, 0, z1), V(mx, -5, mz), 0.45, 0); beam(V(x2, 0, z2), V(mx, -5, mz), 0.45, 0);
    }
    curN = null;
    // central carriage rail on the front face
    beam(V(0, bot, hw + 0.4), V(0, -6, hw + 0.4), 0.7, 1);
    // crown box (cladded), slightly oversized, roof + rails
    const cw = 5.4, cb = 0.5, ct = 7.5;
    const C = (x, y, z) => V(x, y, z);
    quad([C(-cw, ct, cw), C(cw, ct, cw), C(cw, cb, cw), C(-cw, cb, cw)], 1, 9);  // front +z
    quad([C(cw, ct, cw), C(cw, ct, -cw), C(cw, cb, -cw), C(cw, cb, cw)], 1, 9);  // right +x
    quad([C(cw, ct, -cw), C(-cw, ct, -cw), C(-cw, cb, -cw), C(cw, cb, -cw)], 1, 9); // back
    quad([C(-cw, ct, -cw), C(-cw, ct, cw), C(-cw, cb, cw), C(-cw, cb, -cw)], 1, 9); // left
    quad([C(-cw, ct, -cw), C(cw, ct, -cw), C(cw, ct, cw), C(-cw, ct, cw)], 2, 0);   // roof
    quad([C(-cw, cb, cw), C(cw, cb, cw), C(cw, cb, -cw), C(-cw, cb, -cw)], -1, 0);  // underside
    // dark louvred band around the top of the crown + a mid seam
    { const a2 = [[-cw, -cw], [cw, -cw], [cw, cw], [-cw, cw]], e = 0.06;
      for (let f = 0; f < 4; f++) { const [x1, z1] = a2[(f + 1) % 4], [x2, z2] = a2[f]; const ox = (x1 + x2) / (2 * cw) * e * 0.3, oz = (z1 + z2) / (2 * cw) * e * 0.3;
        quad([V(x1 + ox, ct, z1 + oz), V(x2 + ox, ct, z2 + oz), V(x2 + ox, ct - 1.6, z2 + oz), V(x1 + ox, ct - 1.6, z1 + oz)], -1.6, 14, 1); P[P.length - 1].zb = -0.3;
        beam(V(x1 * 1.01, cb + 3.4, z1 * 1.01), V(x2 * 1.01, cb + 3.4, z2 * 1.01), 0.18, -1); } }
    // crown bands (top and bottom trim)
    for (const yy of [ct - 0.2, cb + 0.9]) for (let f = 0; f < 4; f++) { const a2 = [[-cw, -cw], [cw, -cw], [cw, cw], [-cw, cw]]; const [x1, z1] = a2[f], [x2, z2] = a2[(f + 1) % 4]; beam(V(x1 * 1.02, yy, z1 * 1.02), V(x2 * 1.02, yy, z2 * 1.02), 0.5, -1); }
    // roof railing + masts
    for (let f = 0; f < 4; f++) { const a2 = [[-cw, -cw], [cw, -cw], [cw, cw], [-cw, cw]]; const [x1, z1] = a2[f], [x2, z2] = a2[(f + 1) % 4]; beam(V(x1, ct + 1.1, z1), V(x2, ct + 1.1, z2), 0.12, 0); for (let k = 0; k <= 4; k++) { const tt = k / 4; beam(V(lerp(x1, x2, tt), ct, lerp(z1, z2, tt)), V(lerp(x1, x2, tt), ct + 1.1, lerp(z1, z2, tt)), 0.1, 0); } }
    beam(V(-3.6, ct, -3.6), V(-3.6, ct + 3.2, -3.6), 0.14, 0); beam(V(3.2, ct, 3.0), V(3.2, ct + 2.2, 3.0), 0.14, 0);
    // carriage
    const cy0 = o.carY ?? -27, cy1 = cy0 + 9, ce = 5.6;
    const cc = [[-ce, -ce], [ce, -ce], [ce, ce], [-ce, ce]];
    for (const yy of [cy0, cy1, (cy0 + cy1) / 2]) for (let f = 0; f < 4; f++) { const [x1, z1] = cc[f], [x2, z2] = cc[(f + 1) % 4]; beam(V(x1, yy, z1), V(x2, yy, z2), 0.8, 0); }
    for (const [x, z] of cc) beam(V(x, cy0, z), V(x, cy1, z), 0.8, 0);
    for (let f = 0; f < 4; f++) { const [x1, z1] = cc[f], [x2, z2] = cc[(f + 1) % 4]; beam(V(x1, cy0, z1), V(x2, cy1, z2), 0.5, -1); beam(V(x2, cy0, z2), V(x1, cy1, z1), 0.5, -1); }
    // arms (chopsticks): pivot at front corners, yaw open angle (0 = straight out along +z)
    const arm = (side, ang) => {
      curArm = side;
      const pv = V(side * ce, cy0 + 1, ce), len = o.armLen ?? 26;
      const dir = V(Math.sin(ang) * side, 0, Math.cos(ang)), lat = V(Math.cos(ang), 0, -Math.sin(ang) * side); // lat points +x-ish
      const inward = vmul(lat, -side); // toward the other arm
      const N = 7; const pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, d = u * len, hgt = lerp(5.2, 2.2, u), wid = lerp(2.4, 1.4, u);
        const base = vadd(pv, vmul(dir, d));
        pts.push({ bo: base, ti: vadd(vadd(base, V(0, hgt, 0)), vmul(inward, wid * 0.5)), to: vadd(vadd(base, V(0, hgt, 0)), vmul(inward, -wid * 0.5)) });
      }
      for (let i = 0; i < N; i++) {
        const p = pts[i], q = pts[i + 1];
        beam(p.bo, q.bo, 1.2, 0, V(0, -1, 0)); beam(p.ti, q.ti, 0.95, 1, inward); beam(p.to, q.to, 0.95, 1, vmul(inward, -1));
        if (i & 1) { beam(p.bo, q.ti, 0.5, -1); beam(p.bo, q.to, 0.5, -1); } else { beam(p.ti, q.bo, 0.5, -1); beam(p.to, q.bo, 0.5, -1); }
      }
      for (const p of pts) { beam(p.bo, p.ti, 0.5, 0); beam(p.bo, p.to, 0.5, 0); beam(p.ti, p.to, 0.5, 0); }
      // catch rail (dark pad strip on the inner top edge)
      if (!o.noPads) for (let i = 1; i < N; i++) { const p = pts[i], q = pts[i + 1]; const dn = V(0, -0.9, 0); quad([p.ti, q.ti, vadd(q.ti, dn), vadd(p.ti, dn)], -2, 0); }
      // root actuator block
      const r0 = vadd(pv, V(0, 0, 0)), rr = 1.6;
      quad([vadd(r0, V(-rr, 4.5, rr)), vadd(r0, V(rr, 4.5, rr)), vadd(r0, V(rr, -0.5, rr)), vadd(r0, V(-rr, -0.5, rr))], 0, 2);
      curArm = 0;
      return pts;
    };
    const AL = arm(-1, o.armL ?? 0.6), AR = arm(1, o.armR ?? 0.6);
    if (o.qd) { // quick-disconnect boom on the side of the tower, lower down
      const y0 = o.qdY ?? -62, L = 22, x0 = -hw - 0.4;
      for (const [dy, dz] of [[0, -1], [0, 1], [2.2, -1], [2.2, 1]]) beam(V(x0, y0 + dy, dz), V(x0 - L, y0 + dy + 1.5, dz), 0.45, 0);
      for (let k = 0; k <= 6; k++) { const xx = x0 - k * L / 6, yy = y0 + k * 1.5 / 6; beam(V(xx, yy, -1), V(xx, yy + 2.2, 1), 0.3, -1); beam(V(xx, yy, 1), V(xx, yy + 2.2, -1), 0.3, -1); beam(V(xx, yy, -1), V(xx, yy, 1), 0.3, -1); }
      const ex = x0 - L, ey = y0 + 1.5;
      quad([V(ex - 5, ey + 4, 1.8), V(ex + 1, ey + 4, 1.8), V(ex + 1, ey - 0.8, 1.8), V(ex - 5, ey - 0.8, 1.8)], -1, 3);
      quad([V(ex - 5, ey - 0.8, 1.8), V(ex + 1, ey - 0.8, 1.8), V(ex + 1, ey - 0.8, -1.8), V(ex - 5, ey - 0.8, -1.8)], -2, 0);
      quad([V(ex - 5, ey + 4, -1.8), V(ex - 5, ey + 4, 1.8), V(ex - 5, ey - 0.8, 1.8), V(ex - 5, ey - 0.8, -1.8)], -1, 0);
    }
    return { P, AL, AR };
  }

  // render prims with a camera. sty: {ramp, base:{tone->idx}, fog:[idxTarget, near, far], L(light dir), litCol, rim}
  function draw3D(T, cam, prims, sty) {
    const items = [];
    const Ls = vnorm(sty.L);
    for (const pr of prims) {
      if (pr.k === 'b') {
        const A = cam.proj(pr.a), B = cam.proj(pr.b); if (A[2] < 0.5 || B[2] < 0.5) continue;
        items.push({ pr, A, B, z: (A[2] + B[2]) / 2 });
        if (sty.gussets && pr.w >= 0.4 && pr.tone === 0 && !pr.arm) for (const [E, P3] of [[A, pr.a], [B, pr.b]]) items.push({ g: 1, E, z: E[2] - 0.6, sz: Math.max(1, Math.round(1.1 * cam.f / E[2])) });
      } else {
        const ps = pr.p.map(p => cam.proj(p)); if (ps.some(p => p[2] < 0.5)) continue;
        // back-face cull via screen winding
        let ar = 0; for (let i = 0; i < 4; i++) { const a = ps[i], b = ps[(i + 1) % 4]; ar += a[0] * b[1] - b[0] * a[1]; }
        if (ar < 0) continue;
        items.push({ pr, ps, z: ps.reduce((s, p) => s + p[2], 0) / 4 + (sty.quadBias ?? 0) + (pr.zb || 0) });
      }
    }
    items.sort((a, b) => b.z - a.z);
    const ramp = sty.ramp, n = ramp.length - 1;
    const fogAt = z => sty.fog ? clamp((z - sty.fog[1]) / (sty.fog[2] - sty.fog[1]), 0, 1) : 0;
    const col = (idx, z) => { const f = fogAt(z); const v = lerp(idx, sty.fog ? sty.fog[0] : idx, f * (sty.fog ? sty.fog[3] ?? 1 : 0)); return ramp[clamp(Math.round(v), 0, n)]; };
    // screen light direction
    const c0 = cam.proj(vadd(cam.pos, vmul(cam.fwd, 50))), c1 = cam.proj(vadd(vadd(cam.pos, vmul(cam.fwd, 50)), vmul(Ls, 5)));
    let lsx = c1[0] - c0[0], lsy = c1[1] - c0[1]; const ll = Math.hypot(lsx, lsy) || 1; lsx /= ll; lsy /= ll;
    const camDir = cam.fwd;
    for (const it of items) {
      if (it.g) { // gusset plate at a joint: tiny lit square with a shadowed corner
        const x = Math.round(it.E[0]), y = Math.round(it.E[1]), sz = Math.min(3, it.sz);
        if (sz >= 2) { rect(T, x - 1, y - 1, sz, sz, col(sty.base + 1.2, it.z)); pset(T, x - 1, y - 1, col(sty.base + 2.6, it.z)); pset(T, x - 2 + sz, y - 2 + sz, col(sty.base - 1.2, it.z)); }
        continue;
      }
      const pr = it.pr;
      if (pr.k === 'b') {
        const [ax, ay] = it.A, [bx, by] = it.B; let dx = bx - ax, dy = by - ay; const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len; const side = nx * lsx + ny * lsy >= 0 ? 1 : -1;
        const dir3 = vnorm(vsub(pr.b, pr.a)); const lam = Math.sqrt(Math.max(0, 1 - vdot(dir3, Ls) ** 2));
        const base = sty.base + pr.tone + (lam - 0.5) * (sty.lamK ?? 1.5) + (pr.n ? vdot(pr.n, Ls) * (sty.faceK ?? 0) - (vdot(pr.n, camDir) > 0.2 ? (sty.backDark ?? 0) : 0) : 0);
        const tpx = pr.w * cam.f / it.z * (sty.wk ?? 1);
        const cMid = col(base, it.z), cLit = col(base + (sty.litUp ?? 2), it.z), cDk = col(base - (sty.dkDn ?? 1.5), it.z);
        if (tpx < 1.6) {
          lineP(T, ax, ay, bx, by, lam > 0.75 && sty.thinLit ? cLit : cMid);
        } else if (tpx < 2.7) {
          // two px: lit row + shade row along minor axis
          const steep = Math.abs(dy) > Math.abs(dx);
          const ox = steep ? (nx * side > 0 ? 1 : -1) : 0, oy = steep ? 0 : (ny * side > 0 ? 1 : -1);
          line(T, ax - ox * 0, ay, bx, by, cDk); line(T, ax + ox, ay + oy, bx + ox, by + oy, cLit);
          if (ox || oy) line(T, ax, ay, bx, by, cMid);
        } else {
          const h = tpx / 2; const q = [[ax + nx * h, ay + ny * h], [bx + nx * h, by + ny * h], [bx - nx * h, by - ny * h], [ax - nx * h, ay - ny * h]];
          poly(T, q, cMid);
          const e = h - 0.6; line(T, ax + nx * e * side, ay + ny * e * side, bx + nx * e * side, by + ny * e * side, cLit);
          line(T, ax - nx * e * side, ay - ny * e * side, bx - nx * e * side, by - ny * e * side, cDk);
        }
      } else {
        const p3 = pr.p; const nrm = vnorm(vcross(vsub(p3[3], p3[0]), vsub(p3[1], p3[0])));
        const lam = vdot(nrm, Ls);
        const idx = sty.base + pr.tone + (lam > 0 ? lam : lam * (sty.amb ?? 0.35)) * (sty.quadK ?? 2.5);
        const ps = it.ps;
        if (sty.chrome && pr.ribs >= 9) { // polished cladding mirrors the dream sky: rose band up top, dark horizon line, teal below
          const ys = ps.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), base = col(idx, it.z);
          poly(T, ps.map(p => [p[0], p[1]]), (x, y) => { const f = (y + 0.5 - y0) / Math.max(1, y1 - y0) + (x % 7 === 0 ? 0.02 : 0);
            return sty.chrome(f, x, y, base, idx); });
        } else
        poly(T, ps.map(p => [p[0], p[1]]), col(idx, it.z));
        if (pr.ribs) { // vertical cladding ribs
          for (let k = 1; k < pr.ribs; k++) { const u = k / pr.ribs; const a = [lerp(ps[0][0], ps[1][0], u), lerp(ps[0][1], ps[1][1], u)], b = [lerp(ps[3][0], ps[2][0], u), lerp(ps[3][1], ps[2][1], u)]; line(T, a[0], a[1], b[0], b[1], col(idx + (pr.ribTone ?? -1), it.z)); }
        }
        if (sty.edges) { line(T, ps[0][0], ps[0][1], ps[1][0], ps[1][1], col(idx + 1.5, it.z)); }
      }
    }
  }

  // ======================= SHOT 3 : low angle on the tower top, arms opening =======================
  // chrome: polished cladding mirrors the dream sky (peach crown band, dark horizon line, teal below)
  const CHROME = (f, x, y, base) => f < 0.2 ? (((x + y) & 1) ? sur[5] : base) : f < 0.24 ? sur[4] : f < 0.52 ? base : f < 0.57 ? steel[3] : f > 0.78 ? (((x + y) & 1) ? teal[2] : base) : base;
  const S3 = (() => {
    let skyS, wisp, towerS, aur; const TMP = surf(W, H);
    const STY3 = { ramp: steel, base: 4.1, L: V(-0.85, 0.3, 0.42), fog: [6.5, 110, 170, 0.35], lamK: 1.2, faceK: 2.5, litUp: 2.6, dkDn: 1.8, quadK: 3.4, wk: 0.95, amb: 0.5, gussets: 1, backDark: 0.7, chrome: CHROME };
    const CAM = { pos: V(-16, -58, 96), tgt: V(0, -7, 0), f: 720 };
    let cam;
    function init() {
      cam = PX.camera(CAM.pos, CAM.tgt, CAM.f, 240, 135);
      skyS = surf(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot((x + 260) / 1.6, (y - 520)) / 820;
        let v = 7.4 - 5.4 * clamp(d, 0, 1);
        const ds = Math.hypot(x + 40, (y - 300) * 1.3) / 280; // low sun off-frame, bottom-left: apricot -> rose glow
        if (ds < 1) v += (1 - ds) ** 1.5 * 3.6;
        skyS.d[y * W + x] = rampc(DREAM, v, x, y, 0.45);
      }
      // the ringed planet, low and huge behind the right arm, softened by haze; a small moon high left
      drawPlanet(skyS, 432, 238, 84, { tilt: 0.42, ry: 0.23, light: Math.PI * 1.05, cov: (x, y) => 0.75 + 0.25 * clamp((y - 200) / 40, 0, 1) });
      drawMoon(skyS, 62, 44, 6, Math.PI * 1.1, 0.95);
      aur = bakeAurora(W + 60, H, { y0: 6, len: 64, seed: 11, k: 0.75 });
      // sculpted cloud bank low left with crisp rims, wisps high right
      const rnd = PX.mulberry(33), wps = [], cps = [];
      for (let g = 0; g < 12; g++) { const gx = 220 + rnd() * 280, gy = rnd() * 200, n = 3 + Math.floor(rnd() * 5); for (let k = 0; k < n; k++) wps.push({ x: gx + k * 10 + (rnd() - 0.5) * 6, y: gy - k * 2.2, r: 1 + rnd() * 1.4, w: 1, ax: 8 + rnd() * 7 }); }
      wisp = bakeBubbles(W + 40, H, wps, [sky[6], sky[7], sky[7], sky[8]], { hx: 0, hy: -0.6 });
      for (let k = 0; k < 26; k++) { const u = k / 25; cps.push({ x: -10 + u * 170 + rnd() * 8, y: 252 - Math.sin(u * Math.PI) * 26 + rnd() * 6, r: 6 + Math.sin(u * Math.PI) * 9 + rnd() * 3, w: 1, ax: 1.4 }); }
      const cb = bakeBubbles(W, H, cps, [sur[4], sur[5], warm[1], warm[0]], { hx: -0.55, hy: -0.6, hl: 0.5 }); rims(cb, warm[0], sur[3]);
      blit(skyS, cb, 0, 0);
      // static tower (camera is locked off): baked once, hand-finished
      towerS = surf(W, H);
      const m = towerModel({ carY: -19, armL: 0.9, armR: 0.55 });
      draw3D(towerS, cam, m.P.filter(p => !p.arm), STY3); selOut(towerS, -1, -1); warmRim(towerS, -1);
      // hoist cables from the crown down to the carriage, a service pipe up the front-left leg, amber lamps
      for (const sx of [-1, 1]) { const a = cam.proj(V(sx * 5.0, 0.5, 5.2)), b = cam.proj(V(sx * 5.4, -10, 5.7)); lineP(towerS, a[0], a[1], b[0], b[1], steel[2]); }
      { const a = cam.proj(V(-4.2, -60, 4.9)), b = cam.proj(V(-4.2, 0, 4.9)); lineP(towerS, a[0] + 2, a[1], b[0] + 2, b[1], steel[6]);
        for (let yy = -58; yy < 0; yy += 6) { const p = cam.proj(V(-4.2, yy, 4.9)); pset(towerS, Math.round(p[0]) + 1, Math.round(p[1]), steel[3]); } }
    }
    function lamp(p, c, on = true) { const x = Math.round(p[0]), y = Math.round(p[1]); if (!on) { pset(S, x, y, steel[3]); return; } pset(S, x, y, c); pset(S, x - 1, y, warm[4]); pset(S, x + 1, y, warm[4]); pset(S, x, y - 1, warm[3]); }
    function render(t, T) {
      blit(S, skyS, 0, 0);
      blit(S, aur, -30 + Math.round(t * 3), 0);
      blit(S, wisp, -Math.round(t * 2.5), 0);
      motes(t, 10, 33, 0, 0, W, H, [warm[0], teal[2], sur[5]]);
      blit(S, towerS, 0, 0);
      const u = ease(clamp(t / 2.97, 0, 1));
      const m = towerModel({ carY: -19, armL: lerp(0.9, 1.2, u), armR: lerp(0.55, 0.9, u) });
      TMP.d.fill(0); draw3D(TMP, cam, m.P.filter(p => p.arm), STY3); selOut(TMP, -1, -1); warmRim(TMP, -1); blit(S, TMP, 0, 0);
      // lamps: arm tips (steady amber), crown corners, blinking beacon on the mast
      for (const [side, AA] of [[-1, m.AL], [1, m.AR]]) { const tip = AA[AA.length - 1].to; lamp(cam.proj(tip), warm[1]); }
      lamp(cam.proj(V(-5.4, 7.5, 5.4)), warm[1]); lamp(cam.proj(V(5.4, 7.5, 5.4)), warm[1]);
      lamp(cam.proj(V(-3.6, 10.7, -3.6)), warm[0], (T % 1.3) < 0.55);
      { const gx = Math.round(470 - t * 52), gy = Math.round(60 + t * 9 + Math.sin(t * 2.2) * 2), fl = Math.floor(t * 7) & 1; // a gull drifting through
        pset(S, gx, gy, steel[2]); pset(S, gx + 1, gy, steel[2]); pset(S, gx - 1, gy - fl, steel[3]); pset(S, gx + 2, gy - fl, steel[3]); pset(S, gx - 2, gy + 1 - 2 * fl, steel[4]); pset(S, gx + 3, gy + 1 - 2 * fl, steel[4]); }
    }
    return { init, render };
  })();

  // ======================= GROUND (ray-cast terrain, baked once per shot) =======================
  // world: tower at x=z=0, ground plane y=GY. Sea toward +x (east), marsh toward -x.
  const GY = -140;
  const KIND = { sea: 1, beach: 2, dune: 3, pad: 4, road: 5, water: 6, marsh: 7 };
  function terrain(X, Z, lod, fp = 1) {
    // fp = pixel footprint in metres (keeps thin features >= 1 px at distance)
    const shore = 150 + Z * -0.18 + (Z < 0 ? Z * Z * 0.0006 : 0) + (fbm(Z / 900, 3.3, 61, 3) - 0.5) * 120;
    if (X > shore + 40) return { k: 'sea', v: fbm(X / 60, Z / 200, 62, lod), sd: X - shore - 40 };
    if (X > shore) return { k: 'beach', v: (X - shore) / 40 };
    if (X > shore - 70) return { k: 'dune', v: fbm(X / 25, Z / 25, 63, lod) };
    if (Math.abs(X - 20) < 70 && Math.abs(Z + 40) < 90) return { k: 'pad', v: ((Math.abs(X - 20) < 66 && Math.abs(Z + 40) < 86) ? 0.6 : 0.3) };
    if (Math.abs(Z + 160 - X * 0.05) < 6 && X < shore && X > -2500) return { k: 'road', v: 0.5 };
    if (Z < 400) { // the river: a wide meander through the marsh
      const cxr = -420 + 260 * Math.sin(Z / 520) + 110 * Math.sin(Z / 190 + 1.3) + Z * 0.25;
      const wr = 22 + Math.max(0, -Z) * 0.012;
      if (Math.abs(X - cxr) < Math.max(wr, fp * 0.7)) return { k: 'water', v: 1, river: 1 };
      const cx2 = -1500 + 300 * Math.sin(Z / 340 + 2) + Z * -0.15;
      if (Z < -600 && Math.abs(X - cx2) < Math.max(14, fp * 0.6)) return { k: 'water', v: 1 };
    }
    const w1 = fbm(X / 700, Z / 900, 64, Math.min(lod, 4)), w2 = fbm(X / 260, Z / 380, 65, Math.min(lod, 3));
    const ch = Math.abs(w1 - 0.5) + Math.abs(w2 - 0.5) * 0.35;
    if (ch < Math.max(0.02, fp * 0.00012)) return { k: 'water', v: 1 };
    if (fp < 6 && fbm(X / 1400, Z / 1600, 66, 3) > 0.63) return { k: 'water', v: 0.5 }; // lagoons
    return { k: 'marsh', v: fbm(X / 90, Z / 90, 67, lod) * 0.7 + fbm(X / 900, Z / 900, 68, 2) * 0.3 };
  }
  // bake ground below horizon for a camera. pal(kind, v, x, y, info) -> colour. returns surf with .K kinds and .D distance
  function bakeGround(cam, pal, opts = {}) {
    const w = opts.w || W, h = opts.h || H, ox = opts.ox || 0;
    const G = surf(w, h); G.K = new Uint8Array(w * h); G.D = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dir = vnorm(vadd(vadd(vmul(cam.fwd, cam.f), vmul(cam.right, x - ox + 0.5 - cam.cx)), vmul(cam.up, cam.cy - y - 0.5)));
      if (dir[1] >= -0.0005) continue;
      const tt = (GY - cam.pos[1]) / dir[1]; const X = cam.pos[0] + dir[0] * tt, Z = cam.pos[2] + dir[2] * tt;
      const lod = tt < 800 ? 4 : tt < 2500 ? 3 : tt < 6000 ? 2 : 1;
      const fp = tt / cam.f / Math.max(0.02, -dir[1]);
      const tr = terrain(X, Z, lod, fp);
      const I = { dist: tt, dir, X, Z, fp, sd: tr.sd }; G.d[y * w + x] = pal(tr.k, tr.v, x, y, I);
      G.K[y * w + x] = KIND[I.k || tr.k]; G.D[y * w + x] = tt;
    }
    if (!opts.noClean) deorphan(G);
    return G;
  }
  // golden-hour ground palette shared by shots 4 and 5 (sunDir: world vector toward the sun)
  function goldPal(sunDir, o = {}) {
    const sunAz = Math.atan2(sunDir[0], -sunDir[2]);
    return (k, v, x, y, I) => {
      const res = (kk, c) => { I.k = kk; return c; };

        const far = clamp(I.dist / 9000, 0, 1);
        const az = Math.atan2(I.dir[0], -I.dir[2]) - sunAz;
        const g = clamp(1 - Math.abs(az) / (0.025 + 0.05 * (1 - far)), 0, 1) * clamp((I.dist - 900) / 2500, 0, 1); // glitter path below the sun
        const M = o.mirror ? (yy) => o.mirror(x, yy ?? y) : null;
        if (k === 'sea') { // calm mirror near the shore, broken reflections farther out
          if (M) { const c = M(); if (c) { // calm mirror near shore; farther out long horizontal ripple streaks break the reflection
            if (I.sd > 300 && (y % 3 === 0)) return res(k, far > 0.3 ? water[3] : water[2]);
            return res(k, c); } }
          const b = 1.5 + v * 1.2 + far * 2.2; return res(k, g > 0.4 ? (v > 0.5 ? warm[0] : warm[1]) : rampc(water, b, x, y, 0.5)); }
        if (k === 'beach') return res(k, v < 0.22 ? water[4] : (v < 0.5 ? marsh[6] : marsh[5]));
        if (k === 'dune') return res(k, rampc(marsh, 2.4 + v * 2.6 + far * 1.2, x, y, 0.5));
        if (k === 'pad') return res(k, v > 0.5 ? marsh[6] : steel[6]);
        if (k === 'road') return res(k, marsh[5]);
        if (k === 'marsh' || k === 'water') { // art-directed river winding toward the sun, glowing bay beneath it
          const L = az * I.dist, d = I.dist, wig = 150 * Math.sin(d / 520 + 0.6) + 70 * Math.sin(d / 170) - 60;
          const wd = Math.max(14 + d * 0.005, I.fp * 0.8);
          const bay = d > 5200 && Math.abs(L + 120) < (d - 5200) * 0.35 + fbm(d / 300, L / 200, 9, 2) * 300;
          if (Math.abs(L - wig) < wd || bay) k = 'water';
        }
        if (k === 'water' && M) { const c = M(); if (c) return res(k, c); }
        if (k === 'water') { if (g > 0.25) return res(k, g > 0.6 ? warm[0] : warm[1]); const ri = hash(Math.floor(I.X / 40), Math.floor(I.Z / 9), 5) > 0.93; return res(k, ri ? sky[9] : rampc(sky, 7.3 + far * 1.8 + clamp(1 - Math.abs(az) / 0.5, 0, 1) * 0.8, x, y, 0.5)); }
        const rim = clamp(1 - Math.abs(az) / 0.6, 0, 1) * far; // sun-side haze glows
        if (I.fp < 20) { // mudflats and wet sheens break up the marsh
          const n3 = fbm(I.X / 260, I.Z / 340, 89, 3), n4 = fbm(I.X / 60, I.Z / 90, 90, 2);
          if (n3 > 0.66 && n4 > 0.42) { if (n4 > 0.62 && M) { const c = M(); if (c) return res('water', c); } return res('water', n4 > 0.62 ? (g > 0.2 ? warm[1] : sky[8]) : rampc(marsh, 4.2 + n4 * 2 + far, x, y, 0.5)); }
          if (n3 > 0.62) return res(k, rampc(marsh, 3.2 + n4 * 2.2 + far, x, y, 0.5));
        }
        let tuft = 0; if (I.fp < 12) { const n2 = fbm(I.X / 14, I.Z / 34, 88, 2); tuft = n2 > 0.64 ? 1.3 : n2 < 0.36 ? -0.7 : 0; }
        let c = rampc(marsh, 0.9 + v * 2.0 + far * 2.6 + rim * 1.2 + tuft, x, y, 0.5);
        if (far > 0.36) c = rampc([c, marsh[4], marsh[5], marsh[6], warm[1]], (far - 0.36) * 7 + rim * 1.5, x, y, 0.6);
        return res(k, c);
    };
  }
  // perfect-mirror sampler: sky surface pixel at the mirrored row, one half-step darker along its own ramp
  function mirrorFrom(Sky, ox, oy, hz) {
    return (x, y) => { const sx = x + ox, sy = Math.round(2 * hz - y) + oy; if (sx < 0 || sy < 0 || sx >= Sky.w || sy >= Sky.h) return 0; const c = Sky.d[sy * Sky.w + sx]; if (!c) return 0;
      const e = BR.get(c); return e ? e.ch[Math.max(0, e.i - 1)] : c; };
  }
  // living ripples: short bright dashes that come and go on mirror water (G drawn at screen offset ox, oy)
  function ripples(G, ox, oy, t, n, seed) {
    const fr = Math.floor(t * 4);
    for (let k = 0; k < n; k++) {
      const gx = Math.floor(hash(k, fr + k % 3, seed) * G.w), gy = Math.floor(hash(k, fr + k % 3, seed + 1) * G.h);
      if (G.K[gy * G.w + gx] !== KIND.water && G.K[gy * G.w + gx] !== KIND.sea) continue;
      const L = 2 + (k % 3), X = gx + ox, Y = gy + oy; if (Y < 0 || Y >= H) continue;
      for (let i = 0; i < L; i++) if (X + i >= 0 && X + i < W && G.K[gy * G.w + gx + i] === G.K[gy * G.w + gx]) S.d[Y * W + X + i] = i === 1 ? sky[9] : sky[8];
    }
  }
  function bankPass(G) { // dark lip on the far bank, bright lip on the near bank of rivers
    const w = G.w, h = G.h, src = G.d.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (G.K[i] !== KIND.water || G.D[i] > 3500) continue;
      const up = G.K[i - w], dn = G.K[i + w];
      if (up === KIND.marsh && src[i] !== warm[0] && src[i] !== warm[1]) G.d[i] = water[2];
      else if (dn === KIND.marsh && src[i] !== warm[0]) G.d[i] = sky[9];
    }
  }

  // surf: foam bands rolling toward the beach. G: baked ground with K/D maps; (ox,oy) = where G's (0,0) lands on screen
  function surfPrep(G, cam) {
    const sx = [], sc = [];
    for (let y = 0; y < G.h; y++) { sx[y] = -1; sc[y] = 0; for (let x = 0; x < G.w; x++) if (G.K[y * G.w + x] === KIND.sea) { sx[y] = x; sc[y] = cam.f / G.D[y * G.w + x]; break; } }
    return { sx, sc };
  }
  function surfDraw(G, SP, ox, oy, t) {
    for (let y = 0; y < G.h; y++) {
      const Y = y + oy; if (Y < 0 || Y >= H || SP.sx[y] < 0) continue; const sc = SP.sc[y]; if (sc <= 0) continue;
      for (let x = SP.sx[y]; x < G.w; x++) {
        const dm = (x - SP.sx[y]) / sc; if (dm > 260) break;
        const X = x + ox; if (X < 0 || X >= W) continue;
        if (G.K[y * G.w + x] !== KIND.sea) continue;
        const ph = (dm / 55 + t * 0.35) % 1;
        const foam = ph < (dm < 30 ? 0.22 : 0.07) && (hash(Math.floor(dm / 7), y >> 1, 3) > 0.25);
        if (foam) S.d[Y * W + X] = dm < 30 ? sky[9] : water[4];
      }
    }
  }
  function horizonY(cam) { const p = cam.proj(vadd(cam.pos, vmul(vnorm(V(cam.fwd[0], 0, cam.fwd[2])), 1e6))); return p[1]; }

  // ======================= SHOT 4 : high angle, tower top over marsh and sea =======================
  const S4 = (() => {
    const DUR = CUTS[4] - CUTS[3];
    let skyS, ground, towerL, cam0, sunP, hy, SP4, isl; const TMP4 = surf(W, H);
    const SUN = PX.norm(V(-0.33, 0.075, -0.94)); // toward the low sun (left, behind the tower)
    const STY = { ramp: steel, base: 4.4, L: SUN, fog: [6.5, 40, 160, 0.5], lamK: 1.2, faceK: 1.6, litUp: 2.6, dkDn: 1.6, quadK: 3.2, amb: 0.15, gussets: 1, backDark: 0.6, chrome: CHROME };
    function mkCam() { return PX.camera(V(-10, 0.3, 26), V(0, -1.3, 0), 250, 240, 135); }
    function init() {
      cam0 = mkCam(); hy = horizonY(cam0);
      sunP = cam0.proj(vadd(cam0.pos, vmul(SUN, 1e5)));
      skyS = surf(W + 20, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W + 20; x++) {
        const hz = hy - y; // dream bands: rose/apricot at the horizon -> peach -> aqua -> teal -> ultramarine overhead
        let v = clamp(10.6 - hz / 16, 1.5, 11);
        let c = rampc(DREAM, v, x, y, 0.45);
        const ds = Math.hypot((x - sunP[0]) * 0.8, y - sunP[1]);
        const warmth = clamp(1 - ds / 110, 0, 1) ** 1.5 * 2.6;
        if (warmth > 0.12) c = rampc([c, sur[5], warm[0], warm[1]], Math.min(3, warmth * 1.3), x, y, 0.55);
        if (ds < 8) c = ds < 6 ? warm[0] : sky[9];
        skyS.d[y * (W + 20) + x] = c;
      }
      // strata near the horizon, gold rims toward the sun
      const ps = []; const rnd = PX.mulberry(410);
      for (let b = 0; b < 6; b++) { const bx = rnd() * (W + 20), by = hy - 12 - rnd() * 26, len = 50 + rnd() * 110; for (let i = 0; i < len / 9; i++) { const u = i / (len / 9), e = Math.sin(u * Math.PI); ps.push({ x: bx - len / 2 + u * len, y: by - e * 2 + (rnd() - 0.5) * 2, r: 1.2 + e * 2.2 + rnd(), w: 1, ax: 4 + rnd() * 2 }); } }
      const B = bakeBubbles(W + 20, H, ps, [sky[6], sky[7], sky[8], warm[1]], { hx: 0, hy: -0.8 });
      // the ringed planet over the sea (east = screen right), hazed toward the horizon; moon; aurora
      drawPlanet(skyS, 410, Math.round(hy - 44), 66, { tilt: 0.35, ry: 0.22, light: Math.PI * 0.95, cov: (x, y) => 0.35 + 0.55 * clamp((hy - 6 - y) / 70, 0, 1) });
      drawMoon(skyS, 300, 26, 5, Math.PI, 0.95);
      blit(skyS, bakeAurora(W + 20, H, { y0: 8, len: 46, seed: 5, k: 0.7 }), 0, 0);
      blit(skyS, halo(B, [[sky[7], 0.5], [sky[8], 0.25]]), 0, 0); blit(skyS, B, 0, 0);
      ground = bakeGround(cam0, goldPal(SUN, { mirror: mirrorFrom(skyS, 0, 0, hy) }), { w: W + 20, h: H, ox: 10 }); bankPass(ground); SP4 = surfPrep(ground, cam0);
      isl = [makeIsland(401, 13), makeIsland(402, 8), makeIsland(403, 5)];
      towerL = surf(W + 20, H);
      const m = towerModel({ carY: -14, armL: 1.15, armR: 1.35, bottom: -140, noPads: true });
      const c2 = mkCam(); c2.cx += 10; draw3D(towerL, c2, m.P.filter(p => !p.arm), STY); selOut(towerL, -1, 0, { up: 2, dn: 1 });
      // warm sun-kiss on the lit (left) edge of the crown
      for (let y = 0; y < H; y++) for (let x = 1; x < W + 20; x++) { const i = y * (W + 20) + x; if (towerL.d[i] && !towerL.d[i - 1] && (towerL.d[i] === steel[7] || towerL.d[i] === steel[8]) && y < 110) towerL.d[i] = warm[1]; }
    }
    function render(t) {
      const u = clamp(t / DUR, 0, 1), e = ease(u);
      const dg = Math.round(-4 * e), dt = Math.round(-15 * e);
      blit(S, skyS, -10 + Math.round(-2 * e), 0); blit(S, ground, -10 + dg, 0);
      surfDraw(ground, SP4, -10 + dg, 0, t + 15); ripples(ground, -10 + dg, 0, t, 60, 62);
      // floating rock islands hovering far off over the sea
      drawIsland(isl[0], 392 + dg, Math.round(hy) - 30, t, 0, 0.9); drawIsland(isl[1], 440 + dg, Math.round(hy) - 17, t, 2, 0.8); drawIsland(isl[2], 352 + dg, Math.round(hy) - 12, t, 4, 0.75);
      motes(t, 12, 44, 0, 0, W, H, [warm[0], teal[2], sur[5]]);
      // a gull riding the updraft past the tower
      { const gx = Math.round(330 - t * 22), gy = Math.round(118 + Math.sin(t * 1.3) * 3), fl = Math.floor(t * 6) & 1;
        pset(S, gx, gy, steel[7]); pset(S, gx + 1, gy, steel[7]); pset(S, gx - 1, gy - fl, steel[8]); pset(S, gx + 2, gy - fl, steel[8]); pset(S, gx - 2, gy - 2 * fl + 1, steel[5]); pset(S, gx + 3, gy - 2 * fl + 1, steel[5]); }
      blit(S, towerL, -10 + dt, 0);
      const m = towerModel({ carY: -14, armL: 1.15, armR: lerp(1.2, 1.5, e), bottom: -140, noPads: true });
      const c2 = mkCam(); c2.cx += dt; TMP4.d.fill(0); draw3D(TMP4, c2, m.P.filter(p => p.arm), STY); selOut(TMP4, -1, 0, { up: 2, dn: 1 }); blit(S, TMP4, 0, 0);
    }
    return { init, render };
  })();

  // ======================= SHOT 2 : looking up through the ring at the tower =======================
  const S2 = (() => {
    const DUR = CUTS[2] - CUTS[1];
    let skyL, towerL, ceil, panel, pipe;
    const RX = 170, RY = 147, RO = 106, IX = 181, IY = 135, RI = 82; // ring outer/inner circles (layer coords, t=0)
    const LM = 80; // layer margin
    function pan(t) { const u = clamp(t / DUR, 0, 1); return 46 * (0.25 * ease(u) + 0.75 * u); }
    function init() {
      const LW = W + LM * 2, LH = H + LM;
      // ---- sky (seen through ring + window): deeper blue up, clouds
      skyL = surf(LW, LH);
      for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
        const d = Math.hypot(x - LM - 200, y - 200) / 330;
        skyL.d[y * LW + x] = rampc(DREAM, 6.7 - 4.8 * clamp(d, 0, 1), x, y, 0.45);
      }
      const env = (x, y) => clamp((fbm(x / 60, y / 45, 501, 4) * 2.2 - 0.78), 0, 1);
      const puffs = streetPuffs(LW, LH, 502, 0.5, 12, 8, (x, y) => { const e = env(x, y); return e < 0.7 ? 0 : (e - 0.6) / 0.6; }, 3, 6);
      blit(skyL, bakeAurora(LW, LH, { y0: 70, len: 70, seed: 7, k: 0.8 }), 0, 0);
      drawPlanet(skyL, LM + 430, 30, 64, { tilt: 0.45, ry: 0.24, light: -2.6, alpha: 1 }); // the planet, glimpsed through the window
      drawMoon(skyL, LM + 150, 120, 4, -2.4, 0.95);
      const cl = bakeBubbles(LW, LH, puffs, [sur[5], sky[7], sky[8], sky[9]], { hl: 0.5 }); rims(cl, warm[0], 0);
      { const rnd = PX.mulberry(503), wps = []; for (let g = 0; g < 22; g++) { const gx = rnd() * LW, gy = rnd() * LH, n = 3 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) wps.push({ x: gx + k * 8, y: gy - k * 3, r: 1 + rnd(), w: 1, ax: 7 + rnd() * 5 }); }
        blit(skyL, bakeBubbles(LW, LH, wps, [sky[6], sky[6], sky[7], sky[7]], { hx: 0, hy: -0.6 }), 0, 0); }
      // ---- tower seen from below (3D), baked
      towerL = surf(W + LM, H);
      const C2 = (typeof globalThis !== 'undefined' && globalThis.__S2CAM) || { pos: [0, -128, 70], tgt: [0, -25, 0], f: 500, cx: 214, cy: 192, roll: -0.13, armL: 0.35, armR: 0.3, qdY: -95 };
      const m = towerModel({ carY: -19, armL: C2.armL, armR: C2.armR, bottom: -140, armLen: 28, qd: true, qdY: C2.qdY ?? -70 });
      const cam = PX.camera(C2.pos, C2.tgt, C2.f, C2.cx + LM / 2, C2.cy, C2.roll);
      draw3D(towerL, cam, m.P, { ramp: steel, base: 4.2, L: V(0.6, 0.3, 0.7), lamK: 1.6, faceK: 1.2, litUp: 3, dkDn: 1.6, quadK: 3, fog: [6, 120, 170, 0.4] }); selOut(towerL, 1, -1);
      // ---- ceiling: dark structure with ring and top-right window cut out
      ceil = surf(LW, LH);
      const cx0 = RX + LM, cy0 = RY, ix0 = IX + LM, iy0 = IY;
      for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
        const sx = x - LM, sy = y;
        // window to the sky, top right
        const inWin = sy < 80 && (sy < (sx - 262) * 0.75) && sx < 470;
        if (inWin) continue;
        const dO = Math.hypot(x - cx0, y - cy0), dI = Math.hypot(x - ix0, y - iy0);
        if (dI < RI) continue; // opening
        let c;
        if (dO < RO) { // ring wall: segmented collar seen in perspective
          const ang = Math.atan2(y - iy0, x - ix0); const seg = Math.floor((ang + Math.PI) / (Math.PI * 2) * 30);
          const segf = ((ang + Math.PI) / (Math.PI * 2) * 30) % 1;
          // radial position across the wall 0 (inner lip) .. 1 (outer)
          const rr = (dI - RI) / Math.max(1, (RO - Math.hypot(ix0 - cx0, iy0 - cy0) * Math.cos(ang - Math.atan2(iy0 - cy0, ix0 - cx0))) - RI);
          const lightA = Math.cos(ang - (-0.6)); // light from upper-right inside the shaft
          let idx = 3.1 + 0.9 * (-lightA) + (hash(seg, 0, 7) - 0.5) * 0.6;
          if (rr > 0.55) idx -= 0.8; // outer bevel darker
          if (segf < 0.09) idx = 1.4; // seam
          c = rampc(steel, idx, x, y, 0.4);
          if (segf > 0.42 && segf < 0.58 && rr > 0.55 && rr < 0.75) c = ((y & 1) ? steel[1] : steel[5]); // bolt heads
          if (rr > 0.18 && rr < 0.26 && segf > 0.15 && segf < 0.85 && lightA < -0.1) c = (seg % 3 === 0) ? teal[1] : (seg % 3 === 1 ? sur[3] : c); // the dream sky mirrored in the polished wall
          if (dI < RI + 1.5) c = lightA < -0.2 ? warm[2] : lightA < 0.3 ? sur[5] : teal[2]; // lit lip
          if (dO > RO - 1.2) c = steel[3];
        } else {
          // dark ceiling with a vignette and big structural planes
          const vg = Math.hypot((sx - 170) / 300, (sy - 140) / 220);
          let idx = 1.6 - vg * 1.2;
          const beam = (sx + sy * 0.35) ; if (beam > 360 && beam < 372) idx += 0.6; // diagonal girder
          const ang2 = Math.atan2(y - cy0, x - cx0), spoke = ((ang2 + Math.PI) / (Math.PI * 2) * 8 + 0.3) % 1;
          if (dO < RO + 70 && spoke < 0.035) idx += 0.7; // radial ribs of the mount
          if (Math.abs(dO - RO - 40) < 0.6) idx += 0.5; // outer seam ring
          if (Math.abs(sy - (sx - 262) * 0.75) < 1.2 && sy < 80) idx = 3; // window frame edge
          c = rampc(dark, idx, x, y, 0.5);
          if (Math.abs(dO - RO - 4) < 0.7) c = dark[2];
        }
        ceil.d[y * LW + x] = c;
      }
      // cable runs and a pipe across the ceiling (detail)
      for (let k = 0; k < 3; k++) { const yA = 20 + k * 9, yB = 250 + k * 6; linef(ceil, LM - 60, yA, LM + 120 + k * 10, yB, (x, y) => { const i = y * LW + x; return (ceil.d[i] === dark[1] || ceil.d[i] === dark[0] || ceil.d[i] === dark[2]) ? (k === 1 ? dark[2] : steel[1]) : 0; }); }
      for (let x = 0; x < LW; x++) { const y = Math.round(8 + x * 0.05 + 6 * Math.sin(x / 90)); for (let k = 0; k < 3; k++) { const i = (y + k) * LW + x; if (ceil.d[i] === dark[1] || ceil.d[i] === dark[0] || ceil.d[i] === dark[2]) ceil.d[i] = k === 0 ? steel[2] : k === 1 ? dark[2] : dark[0]; } if (x % 23 === 0) { pset(ceil, x, y, steel[3]); pset(ceil, x, y + 1, steel[2]); pset(ceil, x, y + 2, steel[1]); } }
      // soft light shaft falling from the window across the dark ceiling
      for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
        const i = y * LW + x, c = ceil.d[i]; if (c !== dark[1] && c !== dark[0] && c !== dark[2]) continue;
        const sx = x - LM; const u = (sx - 330) * 0.55 + y * 0.83, v = -(sx - 330) * 0.83 + y * 0.55; // along/ across beam
        if (u < 0 || u > 230) continue; const wdt = 18 + u * 0.22; const a = Math.abs(v + 10) / wdt; if (a > 1) continue;
        const cov = (1 - a) * (1 - u / 230) * 0.6; if (q4(cov) > thr(x, y)) ceil.d[i] = c === dark[0] ? dark[1] : dark[2];
      }
      // ---- bronze bolted panel (lit by low sun) + shadowed wall top right
      panel = surf(LW, LH);
      const pShape = [[372 + LM, 72], [480 + LM + 60, 40], [480 + LM + 60, LH], [300 + LM, LH], [318 + LM, 210]];
      const lit = (sx, y) => (sx * 0.62 - y * 0.85) >= 55; // diagonal shadow cast across the plates
      poly(panel, pShape, (x, y) => {
        const sx = x - LM, L = lit(sx, y);
        const g = clamp((sx - 300) / 180, 0, 1) - y / 500;
        let c = L ? rampc([warm[6], marsh[4], marsh[5], marsh[6], warm[2]], 0.6 + g * 3.0, x, y, 0.5) : rampc([dark[1], dark[2], warm[6]], 0.8 + g * 1.5, x, y, 0.5);
        const pu = (sx * 0.83 + y * 0.55), pv = (-sx * 0.55 + y * 0.83);
        const su = ((pu + 4000) % 58), sv = ((pv + 4000) % 46);
        if (su < 1 || sv < 1) c = L ? warm[6] : dark[0]; // plate seams
        else if ((su < 2 || sv < 2) && L) c = marsh[5]; // lit seam lip
        return c;
      });
      // rivet blocks: grids of 2x2 rivets on some plates (like the reference's bolted brackets)
      for (let i = -40; i < 40; i++) for (let j = -40; j < 40; j++) for (let q = 0; q < 2; q++) {
        if (hash(i, j, 72 + q * 9) < 0.3) continue;
        const cols = 3, rows = 3 + (hash(i, j, 74 + q) > 0.5 ? 2 : 0);
        const u0 = i * 58 + 5 + q * 28 + Math.floor(hash(i, j, 75 + q) * 6), v0 = j * 46 + 6 + Math.floor(hash(i, j, 76 + q) * 12);
        for (let a2 = 0; a2 < cols; a2++) for (let b2 = 0; b2 < rows; b2++) {
          const uu = u0 + a2 * 6, vv = v0 + b2 * 5;
          const sx = Math.round(uu * 0.83 - vv * 0.55), y = Math.round(uu * 0.55 + vv * 0.83), X = sx + LM;
          if (!pget(panel, X - 1, y - 1) || !pget(panel, X + 2, y + 2)) continue;
          const L = lit(sx, y);
          pset(panel, X, y, L ? warm[1] : warm[6]); pset(panel, X + 1, y, L ? marsh[6] : dark[2]); pset(panel, X, y + 1, L ? marsh[5] : dark[2]); pset(panel, X + 1, y + 1, L ? warm[6] : dark[0]);
        }
      }
      poly(panel, [[442 + LM, 0], [480 + LM + 60, 0], [480 + LM + 60, 40], [372 + LM, 72], [364 + LM, 66]], (x, y) => rampc(steel, 2.2 + (x - LM - 380) / 200, x, y, 0.5));
      line(panel, 372 + LM, 72, 480 + LM + 60, 40, warm[3]);
      // ---- ribbed pipe bottom-left
      pipe = surf(LW, LH);
      for (let y = 150; y < LH; y++) for (let x = 0; x < 200 + LM; x++) {
        const d = Math.hypot(x - (LM - 160), y - 420); if (d > 330) continue;
        const k = Math.floor(d / 9), f = (d / 9) % 1;
        let idx = 2.2 + Math.max(0, Math.sin((Math.atan2(y - 420, x - LM + 160)) * 3)) * 0.8;
        if (f < 0.22) idx += 1.6; else if (f > 0.8) idx -= 1;
        pipe.d[y * LW + x] = rampc(steel, idx - (d > 300 ? 1 : 0), x, y, 0.3);
      }
    }
    function render(t) {
      const P = pan(t);
      const LW = W + LM * 2;
      const ringX = -LM + Math.round(P), ringY = Math.round(-0.18 * P);
      blit(S, skyL, -LM + Math.round(0.25 * P) + Math.round(t * 1.2), Math.round(-0.05 * P));
      const ix = IX + ringX + LM, iy = IY + ringY;
      blit(S, towerL, -LM / 2 + Math.round(0.55 * P), Math.round(-0.1 * P), (x, y) => Math.hypot(x + 0.5 - ix, y + 0.5 - iy) < RI + 2);
      // gulls gliding across the opening (seen from below), between tower and sky
      for (let b = 0; b < 2; b++) {
        const tb = t - 2.2 - b * 0.55; if (tb < 0 || tb > 4.5) continue;
        const bx = Math.round(ix - RI - 6 + tb * 44 + b * 7), by = Math.round(iy - 30 + b * 9 - tb * 6 + Math.sin(tb * 2) * 2);
        if (Math.hypot(bx - ix, by - iy) > RI - 2) continue;
        const fl = (Math.floor((t + b * 0.3) * 7) & 1);
        pset(S, bx, by, steel[2]); pset(S, bx + 1, by, steel[2]); pset(S, bx - 1, by - fl, steel[3]); pset(S, bx + 2, by - fl, steel[3]);
        pset(S, bx - 2, by - 2 * fl + (fl ? 0 : 1), steel[4]); pset(S, bx + 3, by - 2 * fl + (fl ? 0 : 1), steel[4]);
      }
      blit(S, ceil, ringX, ringY);
      // specular glint sliding along the lit lip of the ring as the camera moves
      { const a0 = -1.05 + P * 0.006; for (let k = -3; k <= 3; k++) { const a = a0 + k * 0.012; const gx = Math.round(ix + Math.cos(a) * (RI + 0.6)), gy = Math.round(iy + Math.sin(a) * (RI + 0.6)); pset(S, gx, gy, Math.abs(k) < 2 ? warm[0] : warm[1]); } }
      // dust motes drifting in the shaft of light under the window
      for (let k = 0; k < 16; k++) {
        const px0 = 300 + hash(k, 1, 91) * 120, py0 = 40 + hash(k, 2, 91) * 120;
        const x = Math.round(px0 + Math.sin(t * 0.4 + k) * 6 + t * 1.5 + ringX + LM * 0), y = Math.round(py0 + ((t * (2 + hash(k, 3, 91) * 3) + k * 13) % 40) - 20 + ringY);
        const tw = hash(k, Math.floor(t * 3), 92); if (tw < 0.35) continue;
        const under = S.d[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
        if (under === dark[0] || under === dark[1] || under === dark[2]) pset(S, x, y, tw > 0.8 ? warm[1] : (k % 3 === 0 ? teal[1] : k % 3 === 1 ? sur[4] : warm[3]));
      }
      blit(S, pipe, -LM + Math.round(1.35 * P), Math.round(-0.1 * P));
      blit(S, panel, -LM + Math.round(1.25 * P), Math.round(0.22 * P));
    }
    return { init, render };
  })();

  // ======================= SHOT 5 : golden hour aerial, tilt up through the sun =======================
  const S5 = (() => {
    const DUR = CUTS[5] - CUTS[4];
    const HZ = 104, SUNX = 322, SUNY = 30, TOP = 560, GM = 30; // horizon row, sun (world px), sky above screen top, ground margin
    let skyL, groundL, glare, cam, sunDir, towers = [], SP, isl;
    function scroll(t) { // camera tilt -> content moves down (px)
      const drift = -5 * Math.min(t, 3.2) / 3.2;
      const u = clamp((t - 3.0) / 4.4, 0, 1); const k = u * u * (3 - 2 * u);
      return Math.round(drift + 430 * k + Math.max(0, t - 7.4) * 5);
    }
    function scrollX(t) { return Math.round(-1.2 * t - 16 * ease(clamp((t - 3) / 5, 0, 1))); }
    function init() {
      const LW = W + 2 * GM, LH = H + TOP + 10;
      // ---- camera over the marsh, looking toward the low sun
      cam = PX.camera(V(-560, GY + 300, 1750), V(-230, GY, -100), 330, 240, HZ);
      cam.cy += HZ - horizonY(cam);
      { const x = SUNX, y = SUNY; sunDir = vnorm(vadd(vadd(vmul(cam.fwd, cam.f), vmul(cam.right, x - cam.cx)), vmul(cam.up, cam.cy - y))); }
      // ---- sky
      skyL = surf(LW, LH);
      for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
        const wy = y - TOP, wx = x - GM, hz = HZ - wy;
        // dream bands: rose/apricot on the horizon, peach, aqua, teal, then calm blue high up (matches Act 2's bright sky)
        let v = hz < 160 ? 10.9 - hz / 40 : 6.9 - (hz - 160) / 150 - (wx - 240) * 0.0012 * clamp(hz / 300, 0, 1);
        v = clamp(v, 4.2, 11);
        let c = rampc(DREAM, v, x, y, hz > 200 ? 0.9 : 0.45);
        const ds = Math.hypot((wx - SUNX) * 0.8, wy - SUNY);
        const warmth = clamp(1 - ds / 160, 0, 1) ** 1.5 * 2.6;
        if (warmth > 0.12) c = rampc([c, sur[5], warm[0], warm[1]], Math.min(3, warmth * 1.3), x, y, 0.55);
        skyL.d[y * LW + x] = c;
      }
      // sun: disc + crisp halo rings
      const sx0 = SUNX + GM, sy0 = SUNY + TOP;
      disc(skyL, sx0, sy0, 22, (x, y, d) => d > 14 ? (q4(0.5) > thr(x, y) ? warm[0] : 0) : warm[0]);
      disc(skyL, sx0, sy0, 9, sky[9]); disc(skyL, sx0, sy0, 7, warm[0]);
      ring(skyL, sx0, sy0, 30, (x, y) => ((x * 3 + y) % 4 === 0) ? warm[0] : 0);
      // stratus banks near the horizon: grey-violet bodies, gold-lit upper rims
      const bank = (cx, cyw, len, th, seed) => {
        const ps = []; const rnd = PX.mulberry(seed);
        for (let i = 0; i < len / 7; i++) { const u = i / (len / 7); const e = Math.sin(u * Math.PI) ** 0.7; ps.push({ x: cx - len / 2 + u * len + (rnd() - 0.5) * 6, y: cyw + TOP + (rnd() - 0.5) * 2 - e * th * 0.4, r: 1.5 + e * th * (0.6 + rnd() * 0.5), w: 1, ax: 2.6 }); }
        const B = bakeBubbles(LW, LH, ps.map(p => ({ ...p, x: p.x + GM })), [sur[4], sur[5], warm[1], warm[0]], { hx: (cx - SUNX) > 0 ? -0.2 : 0.2, hy: -0.75 }); rims(B, warm[0], sur[3]);
        blit(skyL, B, 0, 0);
      };
      // the ringed planet low over the sea (east = right), hazed near the horizon; a small moon; aurora veils high up
      drawPlanet(skyL, GM + 496, TOP + 70, 70, { tilt: 0.33, ry: 0.22, light: Math.PI * 0.97, cov: (x, y) => 0.3 + 0.6 * clamp((TOP + HZ - 8 - y) / 90, 0, 1) });
      drawMoon(skyL, GM + 372, TOP - 40, 5, Math.PI, 0.95);
      blit(skyL, bakeAurora(LW, LH, { y0: TOP - 330, len: 110, seed: 9, k: 0.65 }), 0, 0);
      bank(110, 76, 190, 7, 601); bank(255, 80, 120, 4, 602); bank(410, 74, 150, 8, 603); bank(30, 88, 80, 3, 604); bank(470, 90, 70, 4, 605); bank(360, 92, 100, 3, 606);
      // high cirrus (seen after the tilt): soft brushed wisps in groups
      { const rnd = PX.mulberry(607), wps = [];
        for (let g = 0; g < 16; g++) { const gx = rnd() ** 1.8 * LW * 0.85, gy = TOP - 470 + rnd() ** 1.4 * 300, n = 4 + Math.floor(rnd() * 6), dx = 8 + rnd() * 4, dy = -3 - rnd() * 2; for (let k = 0; k < n; k++) wps.push({ x: gx + k * dx + (rnd() - 0.5) * 6, y: gy + k * dy + (rnd() - 0.5) * 2, r: 1.2 + rnd() * 1.6, w: 1, ax: 7 + rnd() * 8 }); }
        const Wp = bakeBubbles(LW, LH, wps, [sky[6], sky[6], sky[7], sky[8]], { hx: 0.3, hy: 0.6 });
        blit(skyL, halo(Wp, [[sky[6], 0.5], [sky[6], 0.25]]), 0, 0); blit(skyL, Wp, 0, 0); }
      // ---- ground
      groundL = bakeGround(cam, goldPal(sunDir, { mirror: mirrorFrom(skyL, 0, TOP, HZ) }), { w: LW, h: H + 10, ox: GM });
      isl = [makeIsland(501, 12), makeIsland(502, 7), makeIsland(503, 9), makeIsland(504, 5)];
      bankPass(groundL);
      SP = surfPrep(groundL, cam);
      // towers (backlit) with long shadows toward the camera
      const twr = (X, Z, h) => { const b = cam.proj(V(X, GY, Z)), tp = cam.proj(V(X, GY + h, Z)); return { x: Math.round(b[0]) + GM, y: Math.round(b[1]), h: Math.round(b[1] - tp[1]) }; };
      towers = [twr(0, 0, 146), twr(95, 60, 146)];
      for (const T of towers) {
        for (let k = 0; k < 2; k++) line(groundL, T.x + k, T.y + 1, T.x - 30 + k, T.y + 26, marsh[0]);
        line(groundL, T.x - 31, T.y + 26, T.x - 33, T.y + 27, marsh[0]);
      }
      // tank farm & hangars
      const blk = (X, Z, w, h, c1, c2) => { const p = cam.proj(V(X, GY, Z)); const x = Math.round(p[0]) + GM, y = Math.round(p[1]); rect(groundL, x, y - h, w, h, c1); rect(groundL, x, y - h, w, 1, c2); line(groundL, x - 1, y, x - 6, y + 4, marsh[1]); };
      blk(40, -60, 3, 3, steel[6], steel[8]); blk(52, -60, 3, 3, steel[6], steel[8]); blk(64, -64, 3, 3, steel[6], steel[8]);
      blk(-120, 80, 8, 3, steel[5], steel[7]); blk(160, -30, 5, 2, steel[5], steel[7]); blk(-60, -260, 6, 2, steel[5], steel[7]);
    }
    function drawTower(T, sx, sy) {
      const x = T.x + sx - GM, y = T.y + sy, h = T.h;
      for (let yy = y - h; yy <= y; yy++) {
        const k = (yy - y) & 3;
        pset(S, x - 1, yy, steel[2]); pset(S, x, yy, k === 0 ? steel[1] : steel[3]); pset(S, x + 1, yy, yy < y - h * 0.78 ? warm[2] : yy < y - h * 0.6 ? (k & 1 ? warm[3] : steel[5]) : steel[4]);
      }
      rect(S, x - 2, y - h - 3, 5, 4, steel[3]); rect(S, x - 2, y - h - 3, 5, 1, steel[5]); pset(S, x + 2, y - h - 3, warm[1]); pset(S, x + 2, y - h - 2, warm[2]);
      const ay = y - Math.round(h * 0.4);
      line(S, x - 2, ay, x - 6, ay - 3, steel[2]); line(S, x + 2, ay, x + 6, ay - 3, steel[3]); pset(S, x + 6, ay - 3, warm[2]);
      rect(S, x - 2, y - 1, 5, 2, steel[3]);
    }
    function render(t, T) {
      const sy = scroll(t), sx = scrollX(t);
      blit(S, skyL, -GM + sx, -TOP + sy);
      if (sy < H) {
        blit(S, groundL, -GM + sx, sy);
        surfDraw(groundL, SP, -GM + sx, sy, T); ripples(groundL, -GM + sx, sy, T, 70, 61);
        // glitter on water under the sun
        const fr = Math.floor(T * 10);
        for (let k = 0; k < 90; k++) {
          const gx = Math.floor(hash(k, fr, 11) * 80) - 40 + Math.round(SUNX), gy = HZ + 1 + Math.floor(hash(k, fr, 12) ** 2 * 120);
          const X = gx + sx, Y = gy + sy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const kd = groundL.K[gy * (W + 2 * GM) + gx + GM];
          if ((kd === KIND.water || kd === KIND.sea) && Math.abs(gx - SUNX) < 6 + (gy - HZ) * 0.35) S.d[Y * W + X] = warm[0];
        }
        for (const Tw of towers) { drawTower(Tw, sx, sy); // mirrored in any water below
          const x0 = Tw.x - GM + sx, yb = Tw.y + sy;
          for (let k = 0; k <= Tw.h + 3; k++) for (let dx = -1; dx <= 1; dx++) { const gx = Tw.x + dx, gy = Tw.y + k + 1, X = x0 + dx, Y = yb + k + 1; if (Y < 0 || Y >= H || gy >= H + 10) continue;
            if (groundL.K[gy * (W + 2 * GM) + gx] === KIND.water && ((k + dx) & 1 || k < Tw.h * 0.5)) S.d[Y * W + X] = k > Tw.h ? sur[1] : (dx === 1 && k > Tw.h * 0.6 ? sur[2] : steel[2]); } }
        drawIsland(isl[0], 408 + sx, 76 + sy, T, 0, 0.9); drawIsland(isl[1], 452 + sx, 86 + sy, T, 1.7, 0.8); drawIsland(isl[2], 372 + sx, 88 + sy, T, 3.1, 0.85); drawIsland(isl[3], 440 + sx, 60 + sy, T, 4.4, 0.7);
      }
      motes(T, 16, 55, 0, 0, W, H, [warm[0], teal[2], sur[5]]);
      // birds crossing the glow (living detail)
      if (t < 6) for (let b = 0; b < 5; b++) {
        const bx = Math.round(120 + b * 9 + (b % 2) * 4 + t * 16 + sx * 0.3), by = Math.round(58 + (b % 3) * 5 - b * 2 - t * 2 + sy * 0.9);
        const flap = (Math.floor(T * 8 + b * 1.7) & 1);
        pset(S, bx, by, steel[1]); pset(S, bx - 1, by - flap, steel[2]); pset(S, bx + 1, by - flap, steel[2]);
        if (!flap) { pset(S, bx - 2, by + 1, steel[3]); pset(S, bx + 2, by + 1, steel[3]); }
      }
      // ----- lens flare along the sun -> centre axis (pixel shapes)
      const sunX = SUNX + sx, sunY = SUNY + sy;
      const vis = clamp(1 - Math.max(0, sunY - 250) / 70, 0, 1) * clamp((sunY + 50) / 50, 0, 1);
      if (vis > 0.05) {
        const dx = 240 - sunX, dy = 135 - sunY;
        const FL = [[0.4, 4, 'hex', warm[1]], [0.68, 1.5, 'dot', warm[0]], [1.15, 11, 'ring', warm[1]], [1.42, 6, 'hex', sky[9]], [1.85, 19, 'ring', sky[9]]];
        for (const [k, r, kind, c] of FL) {
          const fx = Math.round(sunX + dx * k), fy = Math.round(sunY + dy * k);
          const on = (x, y) => q4(vis * 0.75) > thr(x, y);
          if (kind === 'ring') ring(S, fx, fy, r, (x, y) => (((x + y) % 3) !== 0 && on(x, y)) ? c : 0);
          else if (kind === 'dot') disc(S, fx, fy, r, (x, y) => on(x, y) ? c : 0);
          else { const pts = []; for (let i = 0; i < 6; i++) pts.push([fx + r * Math.cos(i * Math.PI / 3 + 0.26), fy + r * Math.sin(i * Math.PI / 3 + 0.26)]);
            for (let i = 0; i < 6; i++) { const a2 = pts[i], b2 = pts[(i + 1) % 6]; linef(S, a2[0], a2[1], b2[0], b2[1], (x, y) => on(x, y) ? c : 0); } }
        }
        // anamorphic streak
        for (let x = sunX - 70; x <= sunX + 70; x++) { const e = 1 - Math.abs(x - sunX) / 70; if (e * vis > 0.6 || ((x & 1) && e * vis > 0.25)) pset(S, x, sunY, warm[0]); }
      }
      // ----- glare blooming as the camera crosses the sun: every colour climbs its own ramp (slow, no flashing)
      const gl = clamp(1 - Math.abs(t - 4.9) / 2.6, 0, 1); const g2 = gl * gl * (3 - 2 * gl);
      const base = 0.35 * clamp(1 - Math.abs(t - 4.9) / 4, 0, 1);
      if (g2 > 0 || base > 0) bloom((x, y) => { const d = Math.hypot(x - sunX, (y - sunY) * 1.1); return g2 * 2.1 * clamp(1.1 - d / 320, 0, 1) ** 1.8 + base * clamp(1 - d / 260, 0, 1); });
      // ----- the ship, tiny and high, belly-flopping, twin vapour trails from the flap tips (from 26.25 s)
      if (T > 26.25) {
        const k = T - 26.25; const x = 266 + Math.round(k * 1.6), y = Math.round(-6 + k * 17);
        for (let yy = 0; yy < y - 3; yy++) { const d = y - yy, e = d / 170; if (e > 1) continue; const c = e < 0.3 ? sky[9] : e < 0.65 ? sky[8] : sky[7];
          const spread = Math.round(d * 0.035), wob = Math.round(Math.sin(yy * 0.11 + 1) * Math.min(1, d / 60));
          for (const xs of [x - 3 - spread + wob, x + 5 + spread + wob]) {
            if (e < 0.55 || ((xs + yy) & 1)) pset(S, xs, yy, c);
            if (e > 0.15 && e < 0.8 && ((xs + yy) & 1)) pset(S, xs + 1, yy, sky[7]);
          } }
        // body (stainless, tiles dark underneath), nose to the right
        rect(S, x - 3, y, 9, 2, steel[3]); rect(S, x - 2, y, 7, 1, steel[6]); pset(S, x + 5, y, steel[7]); pset(S, x + 6, y + 1, steel[4]);
        rect(S, x - 3, y + 2, 8, 1, steel[1]); pset(S, x + 3, y, warm[0]); pset(S, x, y + 1, teal[1]); pset(S, x + 1, y + 1, sur[4]); // stainless mirrors the dream sky
        pset(S, x - 4, y - 1, steel[2]); pset(S, x - 3, y - 1, steel[3]); pset(S, x + 5, y - 1, steel[2]); pset(S, x + 6, y - 2, steel[3]); // flaps
      }
    }
    return { init, render };
  })();

  // ======================= stubs =======================
  const stub = c => ({ init() {}, render() { fill(S, c); } });

  const SHOTS = [S1, S2, S3, S4, S5];
  let ready = false;
  function init() { if (ready) return; for (const s of SHOTS) s.init(); ready = true; }
  function shotAt(t) { for (let i = CUTS.length - 2; i >= 0; i--) if (t >= CUTS[i]) return i; return 0; }
  function render(t) {
    t = clamp(t, 0, 30.1 - 1e-6); const i = shotAt(t);
    fill(S, dark[0]);
    SHOTS[i].render(t - CUTS[i], t);
  }
  return { start: 0, end: 30.1, CUTS, init, render, shotAt };
})();
if (typeof module !== 'undefined') module.exports = ACT1;
