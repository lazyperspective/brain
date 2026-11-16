/* STILL WARM — drawing engine
 * A tiny simulation of dry media on toothy paper, written from nothing.
 * No canvas API, no SVG, no filters: every mark is a hand-wobbled stroke
 * rubbed across a paper height-field, one grain at a time.
 */
(function (g) {
'use strict';

function createEngine(Wpx, seed) {
  const W = Wpx | 0, H = Math.round(W * 9 / 16), S = W / 1600, N = W * H;
  const rgb = new Float32Array(N * 3);     // what the eye sees
  const under = new Float32Array(N * 3);   // the first bright layer (what the pin finds again)
  const tooth = new Float32Array(N);       // paper height: 1 = peak, 0 = pit
  const fill = new Float32Array(N);        // wax packed into the tooth
  const sid = new Uint32Array(N);          // which stroke last touched this grain
  const sa = new Float32Array(N);          // how much that stroke already left there
  let strokeId = 1;

  // ---------- randomness (seeded: the same hand every time)
  let _s = (seed || 19940611) >>> 0;
  function R() {
    _s |= 0; _s = _s + 0x6D2B79F5 | 0;
    let t = Math.imul(_s ^ _s >>> 15, 1 | _s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * R();
  const gs = () => (R() + R() + R() + R() - 2) * 0.87;

  // ---------- noise
  function hash2(ix, iy, sd) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(sd | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, sd) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, sd), b = hash2(ix + 1, iy, sd), c = hash2(ix, iy + 1, sd), d = hash2(ix + 1, iy + 1, sd);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y, sd, oct) {
    let v = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { v += a * vnoise(x * f, y * f, sd + i * 17); n += a; a *= 0.5; f *= 2.03; }
    return v / n;
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const c01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const sstep = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const sq = x => x * x;
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function mkRamp(list) { const o = []; for (const [t, h] of list) { const c = hex(h); o.push(t, c[0], c[1], c[2]); } return o; }
  function ramp(st, t, o) {
    const n = st.length / 4;
    if (t <= st[0]) { o[0] = st[1]; o[1] = st[2]; o[2] = st[3]; return o; }
    for (let i = 1; i < n; i++) {
      const j = i * 4;
      if (t <= st[j]) {
        const k = (t - st[j - 4]) / (st[j] - st[j - 4]);
        o[0] = st[j - 3] + (st[j + 1] - st[j - 3]) * k;
        o[1] = st[j - 2] + (st[j + 2] - st[j - 2]) * k;
        o[2] = st[j - 1] + (st[j + 3] - st[j - 1]) * k;
        return o;
      }
    }
    const j = (n - 1) * 4; o[0] = st[j + 1]; o[1] = st[j + 2]; o[2] = st[j + 3]; return o;
  }
  function mix3(a, b, k, o) { o[0] = a[0] + (b[0] - a[0]) * k; o[1] = a[1] + (b[1] - a[1]) * k; o[2] = a[2] + (b[2] - a[2]) * k; return o; }
  function cdist(a, b) { const r = a[0] - b[0], gg = a[1] - b[1], bl = a[2] - b[2]; return Math.sqrt(r * r * 0.9 + gg * gg * 1.3 + bl * bl * 0.8); }

  // ---------- the paper: cream, slightly foxed, with a real tooth
  const PAPER = hex('#f3ead9');
  function makePaper() {
    for (let y = 0; y < H; y++) {
      const v = y / S;
      for (let x = 0; x < W; x++) {
        const u = x / S, p = y * W + x;
        let t = 0.50 * vnoise(u * 0.72, v * 0.72, 1) + 0.30 * vnoise(u * 0.31 + 9, v * 0.34, 2) + 0.15 * vnoise(u * 0.11, v * 0.13, 3)
          + 0.05 * hash2(x, y, 4);
        // faint laid lines, like cheap drawing-book paper
        t += 0.035 * Math.sin(v * 2.1 + 0.6 * vnoise(u * 0.02, v * 0.3, 5));
        t = 0.5 + (t - 0.5) * 1.9;
        if (hash2(x, y, 6) < 0.004) t -= 0.4;       // pits that never take wax
        tooth[p] = c01(t);
        const mott = 0.985 + 0.03 * vnoise(u * 0.012, v * 0.016, 7) + 0.022 * (tooth[p] - 0.5);
        const warm = 0.012 * (vnoise(u * 0.004, v * 0.005, 8) - 0.5);
        rgb[p * 3] = PAPER[0] * mott + warm; rgb[p * 3 + 1] = PAPER[1] * mott; rgb[p * 3 + 2] = PAPER[2] * mott - warm * 1.6;
      }
    }
    // a few stray fibres pressed into the sheet
    for (let i = 0; i < 260; i++) {
      let x = R() * W, y = R() * H, a = R() * 6.283; const L = rr(4, 16) * S, d = rr(0.02, 0.07), wm = R() < 0.5 ? 1 : -1;
      for (let s = 0; s < L; s++) {
        a += (R() - 0.5) * 0.5; x += Math.cos(a); y += Math.sin(a);
        const xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= W || yi >= H) break;
        const p = (yi * W + xi) * 3; rgb[p] -= d * (wm > 0 ? 0.8 : 1.1); rgb[p + 1] -= d; rgb[p + 2] -= d * (wm > 0 ? 1.4 : 0.9);
      }
    }
  }

  // ---------- tools (how each one meets the tooth)
  const TOOLS = {
    // fat wax crayon stub: skips over the valleys, streaks, burnishes with layers
    CRAYON: { reach: 0.86, burn: 0.85, isoft: 1 / 0.62, flow: 0.86, transl: 0.42, wax: 0.55, streak: 0.55, hard: 0.72, asp: 0.55, pw: 0.25 },
    // sharpened coloured pencil: fine, translucent, patient
    PENCIL: { reach: 0.94, burn: 0.7, isoft: 1 / 0.7, flow: 0.74, transl: 0.50, wax: 0.30, streak: 0.20, hard: 0.35, asp: 1, pw: 0.45 },
    // chalk dust rubbed in with the side of a thumb: soft, opaque, into every pit
    DUST: { reach: 1.7, burn: 0.20, isoft: 1 / 1.3, flow: 0.5, transl: 0.10, wax: 0.05, streak: 0.35, hard: 0.12, asp: 0.6, pw: 0.1 },
  };

  const SN = 24, streak = new Float32Array(SN + 1);
  function newStreak() {
    let prev = R();
    for (let i = 0; i <= SN; i++) { const v = R(); streak[i] = 0.5 * prev + 0.5 * v; prev = v; }
  }

  function dab(cx, cy, r, press, ux, uy, T, col, id, op) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return;
    const invr = 1 / r, iasp = 1 / T.asp, hard = T.hard, ih = 1 / (1 - hard), tr = T.transl, itr = 1 - tr;
    const cr = col[0], cg = col[1], cb = col[2], strk = T.streak, reach = T.reach, burn = T.burn, isoft = T.isoft, fl = T.flow * op, wax = T.wax;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * invr;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) * invr;
        const al = (dx * ux + dy * uy) * iasp, ac = -dx * uy + dy * ux;
        const d2 = al * al + ac * ac;
        if (d2 >= 1) continue;
        const d = Math.sqrt(d2);
        let cov = d < hard ? 1 : (1 - d) * ih;
        const si = (ac * 0.5 + 0.5) * (SN - 1), i0 = si | 0;
        const sv = streak[i0] + (streak[i0 + 1] - streak[i0]) * (si - i0);
        const pr = press * (1 - strk * sv);
        const p = y * W + x;
        const th = 1 - (pr * reach + fill[p] * burn);
        let gq = (tooth[p] - th) * isoft + 0.5;
        if (gq <= 0) { fill[p] += 0.09 * pr * cov * wax; continue; }
        if (gq > 1) gq = 1;
        const a = fl * cov * gq;
        const prev = sid[p] === id ? sa[p] : 0;
        if (a <= prev) continue;
        const da = (a - prev) / (1.0001 - prev);
        sid[p] = id; sa[p] = a;
        const i3 = p * 3, dr = rgb[i3], dg = rgb[i3 + 1], db = rgb[i3 + 2];
        rgb[i3] = dr + da * (cr * (itr + tr * (dr * 0.8 + 0.2)) - dr);
        rgb[i3 + 1] = dg + da * (cg * (itr + tr * (dg * 0.8 + 0.2)) - dg);
        rgb[i3 + 2] = db + da * (cb * (itr + tr * (db * 0.8 + 0.2)) - db);
        const f = fill[p] + da * wax; fill[p] = f > 1 ? 1 : f;
      }
    }
  }

  // shared path buffers (design units)
  const MAXP = 8192;
  const PX = new Float32Array(MAXP), PY = new Float32Array(MAXP), PP = new Float32Array(MAXP);

  function stroke(n, w, T, col, op) {
    const id = ++strokeId; newStreak();
    if (op === undefined) op = 1;
    const r0 = Math.max(0.6, w * 0.5 * S), pw = T.pw;
    if (n === 1) { dab(PX[0] * S, PY[0] * S, r0, PP[0], 1, 0, T, col, id, op); return; }
    let carry = 0;
    const sp = Math.max(0.45, r0 * T.asp * 0.42);
    for (let i = 0; i < n - 1; i++) {
      const ax = PX[i] * S, ay = PY[i] * S, bx = PX[i + 1] * S, by = PY[i + 1] * S;
      let dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy); if (L < 1e-6) continue; dx /= L; dy /= L;
      let s = carry;
      while (s < L) {
        const t = s / L, p = PP[i] + (PP[i + 1] - PP[i]) * t;
        dab(ax + dx * s, ay + dy * s, Math.max(0.55, r0 * (1 - pw + pw * p)), p, dx, dy, T, col, id, op);
        s += sp;
      }
      carry = s - L;
    }
  }

  // ---------- the pin: scratches the wax away and finds the first colour again
  function scratchDab(cx, cy, r, st) {
    const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(W - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(H - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      let cov = c01(r + 0.5 - d); if (cov <= 0) continue;
      const p = y * W + x;
      cov *= st * (0.72 + 0.28 * tooth[p]);
      const i3 = p * 3;
      rgb[i3] += (under[i3] - rgb[i3]) * cov; rgb[i3 + 1] += (under[i3 + 1] - rgb[i3 + 1]) * cov; rgb[i3 + 2] += (under[i3 + 2] - rgb[i3 + 2]) * cov;
      fill[p] *= 1 - 0.6 * cov;
    }
  }
  function scratch(n, w, st) {
    const r0 = Math.max(0.35, w * 0.5 * S);
    if (n === 1) { scratchDab(PX[0] * S, PY[0] * S, r0 * PP[0], st); return; }
    for (let i = 0; i < n - 1; i++) {
      const ax = PX[i] * S, ay = PY[i] * S, bx = PX[i + 1] * S, by = PY[i + 1] * S;
      const L = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(L / 0.6));
      for (let j = 0; j < k; j++) {
        const t = j / k, pr = PP[i] + (PP[i + 1] - PP[i]) * t;
        if (pr <= 0.02) continue;
        scratchDab(ax + (bx - ax) * t, ay + (by - ay) * t, Math.max(0.3, r0 * pr), st * (0.75 + 0.25 * hash2(i, j, strokeId)));
      }
    }
    strokeId++;
  }

  // ---------- the kneaded eraser: lifts softly, never all the way
  function eraseDab(cx, cy, r, st) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    const ir = 1 / r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) * ir; if (d >= 1) continue;
      const p = y * W + x;
      let a = (1 - d * d); a = a * a * st * (0.45 + 0.75 * tooth[p]);
      if (a > 1) a = 1;
      const i3 = p * 3;
      rgb[i3] += (under[i3] - rgb[i3]) * a; rgb[i3 + 1] += (under[i3 + 1] - rgb[i3 + 1]) * a; rgb[i3 + 2] += (under[i3 + 2] - rgb[i3 + 2]) * a;
      fill[p] *= 1 - 0.5 * a;
    }
  }
  function erase(n, w, st) {
    const r0 = Math.max(0.8, w * 0.5 * S);
    if (n === 1) { eraseDab(PX[0] * S, PY[0] * S, r0, st * PP[0]); return; }
    for (let i = 0; i < n - 1; i++) {
      const ax = PX[i] * S, ay = PY[i] * S, bx = PX[i + 1] * S, by = PY[i + 1] * S;
      const L = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(L / (r0 * 0.35)));
      for (let j = 0; j < k; j++) { const t = j / k; eraseDab(ax + (bx - ax) * t, ay + (by - ay) * t, r0, st * (PP[i] + (PP[i + 1] - PP[i]) * t) * 0.35); }
    }
  }

  function snapshotUnder() { under.set(rgb); }
  // a small island of paper the artist promised to keep (design units)
  function keepBare(x, y, r) {
    const cx = x * S, cy = y * S, rp = r * S;
    for (let yy = Math.max(0, (cy - rp) | 0); yy <= Math.min(H - 1, (cy + rp) | 0); yy++) for (let xx = Math.max(0, (cx - rp) | 0); xx <= Math.min(W - 1, (cx + rp) | 0); xx++) {
      const d = Math.hypot(xx - cx, yy - cy) / rp; if (d >= 1) continue;
      const k = Math.min(1, (1 - d) * 3), p = yy * W + xx, m = 0.985 + 0.022 * (tooth[p] - 0.5);
      for (let c = 0; c < 3; c++) under[p * 3 + c] += (PAPER[c] * m - under[p * 3 + c]) * k;
    }
  }

  // what the artist sees when they squint at a spot (design units)
  function curAt(x, y, o) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let k = 0; k < 5; k++) {
      const xx = ((x + (k === 1 || k === 3 ? -1.3 : k === 0 ? 0 : 1.3)) * S) | 0, yy = ((y + (k === 1 || k === 2 ? -1.3 : k === 0 ? 0 : 1.3)) * S) | 0;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i3 = (yy * W + xx) * 3; r += rgb[i3]; gg += rgb[i3 + 1]; b += rgb[i3 + 2]; n++;
    }
    if (!n) { o[0] = PAPER[0]; o[1] = PAPER[1]; o[2] = PAPER[2]; return o; }
    o[0] = r / n; o[1] = gg / n; o[2] = b / n; return o;
  }

  function toRGBA(out) {
    out = out || new Uint8ClampedArray(N * 4);
    for (let p = 0; p < N; p++) {
      const d = (hash2(p % W, (p / W) | 0, 99) - 0.5) / 255;
      out[p * 4] = Math.round(c01(rgb[p * 3] + d) * 255);
      out[p * 4 + 1] = Math.round(c01(rgb[p * 3 + 1] + d) * 255);
      out[p * 4 + 2] = Math.round(c01(rgb[p * 3 + 2] + d) * 255);
      out[p * 4 + 3] = 255;
    }
    return out;
  }

  return {
    W, H, S, N, rgb, under, tooth, fill, R, rr, gs, hash2, vnoise, fbm, clamp, c01, sstep, sq, hex, mkRamp, ramp, mix3, cdist,
    PAPER, makePaper, TOOLS, PX, PY, PP, MAXP, stroke, scratch, erase, snapshotUnder, keepBare, curAt, toRGBA,
  };
}

g.SW = g.SW || {};
g.SW.createEngine = createEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine };
})(typeof self !== 'undefined' ? self : globalThis);
