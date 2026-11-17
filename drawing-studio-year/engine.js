/* A YEAR, STILL WARM — the drawing engine, grown from drawing-studio/engine.js.
 *
 * The same dry media on the same toothy paper: every mark is still a hand-wobbled
 * stroke rubbed across a paper height-field. Two things are new, because this
 * sheet has to live through a year:
 *
 *  1. The patient layers (sky, sea, hills, meadow, bark) are drawn ONCE and
 *     remembered grain by grain — which stroke left how much wax on which grain.
 *     Each frame the strokes keep their place and only change the colour of the
 *     stick, so the hatching never swims and never boils.
 *  2. The living things (leaves, grass, clouds, snow, rain, birds) are re-drawn
 *     every frame by the same dab against the same tooth, with a tremor that
 *     belongs to the stroke and not to the moment, so a blade is the same blade
 *     tomorrow.
 *
 * Design space is the original's (1600 x 900 "o-units"), extended in every
 * direction; a frame is a window on it: pixel = (o - OX|OY) * SC.
 */
'use strict';

function createEngine(opt) {
  const W = opt.W | 0, H = opt.H | 0, N = W * H;
  const SC = opt.SC, OX = opt.OX, OY = opt.OY;
  const PS = opt.PS || 1.2;                 // paper scale: pixels per paper unit (1.2 = the original at 1920)
  const K = 5;                              // remembered strokes per grain

  const rgb = new Float32Array(N * 3);      // what the eye sees this frame
  const paper = new Float32Array(N * 3);    // the bare sheet
  const tooth = new Float32Array(N);        // paper height: 1 = peak, 0 = pit
  const fill = new Float32Array(N);         // wax packed into the tooth (working copy)
  const fill0 = new Float32Array(N);        // ... as the patient layers left it
  const sid = new Uint32Array(N);           // which stroke last touched this grain
  const sa = new Float32Array(N);           // how much that stroke already left there
  const reg = new Uint8Array(N);            // region of each grain (for clipping)
  let strokeId = 1;
  let clip = 0xffff;                        // bitmask of regions the hand may touch
  let fenceY = 1e9;                         // ... and a row it may not go below (flat bases of clouds)

  // ---------- randomness: a seeded hand for the patient layers
  let _s = (opt.seed || 19940611) >>> 0;
  function R() {
    _s |= 0; _s = _s + 0x6D2B79F5 | 0;
    let t = Math.imul(_s ^ _s >>> 15, 1 | _s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * R();
  const gs = () => (R() + R() + R() + R() - 2) * 0.87;
  function reseed(s) { _s = s >>> 0; }

  // ---------- noise (stateless)
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
  const c01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const sstep = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }

  // ---------- the paper: cream, slightly foxed, with a real tooth (the original's sheet)
  const PAPER = hex('#f3ead9');
  function makePaper() {
    const sv = _s; _s = 0x51ed270b;
    for (let y = 0; y < H; y++) {
      const v = y / PS;
      for (let x = 0; x < W; x++) {
        const u = x / PS, p = y * W + x;
        let t = 0.50 * vnoise(u * 0.72, v * 0.72, 1) + 0.30 * vnoise(u * 0.31 + 9, v * 0.34, 2) + 0.15 * vnoise(u * 0.11, v * 0.13, 3)
          + 0.05 * hash2(x, y, 4);
        t += 0.035 * Math.sin(v * 2.1 + 0.6 * vnoise(u * 0.02, v * 0.3, 5));   // faint laid lines
        t = 0.5 + (t - 0.5) * 1.9;
        if (hash2(x, y, 6) < 0.004) t -= 0.4;                                  // pits that never take wax
        tooth[p] = c01(t);
        const mott = 0.985 + 0.03 * vnoise(u * 0.012, v * 0.016, 7) + 0.022 * (tooth[p] - 0.5);
        const warm = 0.012 * (vnoise(u * 0.004, v * 0.005, 8) - 0.5);
        paper[p * 3] = PAPER[0] * mott + warm; paper[p * 3 + 1] = PAPER[1] * mott; paper[p * 3 + 2] = PAPER[2] * mott - warm * 1.6;
      }
    }
    const nf = Math.round(260 * N / (1920 * 1080));
    for (let i = 0; i < nf; i++) {      // stray fibres pressed into the sheet
      let x = R() * W, y = R() * H, a = R() * 6.283; const L = rr(4, 16) * PS, d = rr(0.02, 0.07), wm = R() < 0.5 ? 1 : -1;
      for (let s = 0; s < L; s++) {
        a += (R() - 0.5) * 0.5; x += Math.cos(a); y += Math.sin(a);
        const xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= W || yi >= H) break;
        const p = (yi * W + xi) * 3; paper[p] -= d * (wm > 0 ? 0.8 : 1.1); paper[p + 1] -= d; paper[p + 2] -= d * (wm > 0 ? 1.4 : 0.9);
      }
    }
    _s = sv;
  }

  // ---------- tools (how each one meets the tooth) — unchanged from the original box
  const TOOLS = {
    CRAYON: { reach: 0.86, burn: 0.85, isoft: 1 / 0.62, flow: 0.86, transl: 0.42, wax: 0.55, streak: 0.55, hard: 0.72, asp: 0.55, pw: 0.25 },
    PENCIL: { reach: 0.94, burn: 0.7, isoft: 1 / 0.7, flow: 0.74, transl: 0.50, wax: 0.30, streak: 0.20, hard: 0.35, asp: 1, pw: 0.45 },
    DUST: { reach: 1.7, burn: 0.20, isoft: 1 / 1.3, flow: 0.5, transl: 0.10, wax: 0.05, streak: 0.35, hard: 0.12, asp: 0.6, pw: 0.1 },
  };

  // a small bank of crayon-face profiles; a stroke always wears the same face
  const SN = 24, NBANK = 128, bank = new Float32Array(NBANK * (SN + 1));
  (function () {
    for (let b = 0; b < NBANK; b++) {
      let prev = hash2(b, 0, 777);
      for (let i = 0; i <= SN; i++) { const v = hash2(b, i + 1, 777); bank[b * (SN + 1) + i] = 0.5 * prev + 0.5 * v; prev = v; }
    }
  })();
  let sOff = 0;

  // ---------- one dab, live: mixes the stick into what is already there
  function dab(cx, cy, r, press, ux, uy, T, col, id, op) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, fenceY, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return;
    const invr = 1 / r, iasp = 1 / T.asp, hard = T.hard, ih = 1 / (1 - hard), tr = T.transl, itr = 1 - tr;
    const cr = col[0], cg = col[1], cb = col[2], strk = T.streak, reach = T.reach, burn = T.burn, isoft = T.isoft, fl = T.flow * op, wax = T.wax;
    const cl = clip;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * invr;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) * invr;
        const al = (dx * ux + dy * uy) * iasp, ac = -dx * uy + dy * ux;
        const d2 = al * al + ac * ac;
        if (d2 >= 1) continue;
        const p = y * W + x;
        if (!((cl >> reg[p]) & 1)) continue;
        const d = Math.sqrt(d2);
        const cov = d < hard ? 1 : (1 - d) * ih;
        const si = (ac * 0.5 + 0.5) * (SN - 1), i0 = si | 0;
        const sv = bank[sOff + i0] + (bank[sOff + i0 + 1] - bank[sOff + i0]) * (si - i0);
        const pr = press * (1 - strk * sv);
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

  // ---------- one dab, remembered: which stroke left how much on which grain
  const ids = new Uint32Array(N * K), wts = new Float32Array(N * K);
  function dabRec(cx, cy, r, press, ux, uy, T, id, op, rid) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return;
    const invr = 1 / r, iasp = 1 / T.asp, hard = T.hard, ih = 1 / (1 - hard);
    const strk = T.streak, reach = T.reach, burn = T.burn, isoft = T.isoft, fl = T.flow * op, wax = T.wax;
    const cl = clip;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * invr;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) * invr;
        const al = (dx * ux + dy * uy) * iasp, ac = -dx * uy + dy * ux;
        const d2 = al * al + ac * ac;
        if (d2 >= 1) continue;
        const p = y * W + x;
        if (!((cl >> reg[p]) & 1)) continue;
        const d = Math.sqrt(d2);
        const cov = d < hard ? 1 : (1 - d) * ih;
        const si = (ac * 0.5 + 0.5) * (SN - 1), i0 = si | 0;
        const sv = bank[sOff + i0] + (bank[sOff + i0 + 1] - bank[sOff + i0]) * (si - i0);
        const pr = press * (1 - strk * sv);
        const th = 1 - (pr * reach + fill[p] * burn);
        let gq = (tooth[p] - th) * isoft + 0.5;
        if (gq <= 0) { fill[p] += 0.09 * pr * cov * wax; continue; }
        if (gq > 1) gq = 1;
        const a = fl * cov * gq;
        const prev = sid[p] === id ? sa[p] : 0;
        if (a <= prev) continue;
        const da = (a - prev) / (1.0001 - prev);
        sid[p] = id; sa[p] = a;
        const f = fill[p] + da * wax; fill[p] = f > 1 ? 1 : f;
        // everything already there shows a little less; this stroke shows da
        const b = p * K, keep = 1 - da;
        let slot = -1, free = -1, mn = 9, mi = -1, mx = -1, xi = -1;
        for (let k = 0; k < K; k++) {
          const w = wts[b + k];
          if (w === 0) { if (free < 0) free = k; continue; }
          const nw = w * keep; wts[b + k] = nw;
          if (ids[b + k] === rid) slot = k;
          else { if (nw < mn) { mn = nw; mi = k; } if (nw > mx) { mx = nw; xi = k; } }
        }
        if (slot >= 0) wts[b + slot] += da;
        else if (free >= 0) { ids[b + free] = rid; wts[b + free] = da; }
        else {
          // the faintest memory is folded into the strongest one, and its place taken
          if (xi === mi) xi = mi === 0 ? 1 : 0;
          if (da >= mn) { wts[b + xi] += mn; ids[b + mi] = rid; wts[b + mi] = da; }
          else wts[b + xi] += da;
        }
      }
    }
  }

  // shared path buffers (o-units)
  const MAXP = 8192;
  const PX = new Float32Array(MAXP), PY = new Float32Array(MAXP), PP = new Float32Array(MAXP);

  function stroke(n, w, T, col, op, face) {
    const id = ++strokeId; sOff = ((face === undefined ? id : face) & (NBANK - 1)) * (SN + 1);
    if (op === undefined) op = 1;
    const r0 = Math.max(0.6, w * 0.5 * SC), pw = T.pw;
    if (n === 1) { dab((PX[0] - OX) * SC, (PY[0] - OY) * SC, r0, PP[0], 1, 0, T, col, id, op); return; }
    let carry = 0;
    const sp = Math.max(0.45, r0 * T.asp * 0.42);
    for (let i = 0; i < n - 1; i++) {
      const ax = (PX[i] - OX) * SC, ay = (PY[i] - OY) * SC, bx = (PX[i + 1] - OX) * SC, by = (PY[i + 1] - OY) * SC;
      let dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy); if (L < 1e-6) continue; dx /= L; dy /= L;
      if ((ax < -40 && bx < -40) || (ay < -40 && by < -40) || (ax > W + 40 && bx > W + 40) || (ay > H + 40 && by > H + 40)) { carry = 0; continue; }
      let s = carry;
      while (s < L) {
        const t = s / L, p = PP[i] + (PP[i + 1] - PP[i]) * t;
        dab(ax + dx * s, ay + dy * s, Math.max(0.55, r0 * (1 - pw + pw * p)), p, dx, dy, T, col, id, op);
        s += sp;
      }
      carry = s - L;
    }
  }
  function strokeRec(n, w, T, rid, op) {
    const id = ++strokeId; sOff = (id & (NBANK - 1)) * (SN + 1);
    if (op === undefined) op = 1;
    const r0 = Math.max(0.6, w * 0.5 * SC), pw = T.pw;
    if (n === 1) { dabRec((PX[0] - OX) * SC, (PY[0] - OY) * SC, r0, PP[0], 1, 0, T, id, op, rid); return; }
    let carry = 0;
    const sp = Math.max(0.45, r0 * T.asp * 0.42);
    for (let i = 0; i < n - 1; i++) {
      const ax = (PX[i] - OX) * SC, ay = (PY[i] - OY) * SC, bx = (PX[i + 1] - OX) * SC, by = (PY[i + 1] - OY) * SC;
      let dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy); if (L < 1e-6) continue; dx /= L; dy /= L;
      let s = carry;
      while (s < L) {
        const t = s / L, p = PP[i] + (PP[i + 1] - PP[i]) * t;
        dabRec(ax + dx * s, ay + dy * s, Math.max(0.55, r0 * (1 - pw + pw * p)), p, dx, dy, T, id, op, rid);
        s += sp;
      }
      carry = s - L;
    }
  }

  // ---------- the pin: scratches the wax away and finds a colour underneath
  function scratchDab(cx, cy, r, st, col) {
    const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(W - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(H - 1, Math.ceil(cy + r + 1));
    const cl = clip;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      let cov = c01(r + 0.5 - d); if (cov <= 0) continue;
      const p = y * W + x;
      if (!((cl >> reg[p]) & 1)) continue;
      cov *= st * (0.72 + 0.28 * tooth[p]);
      const i3 = p * 3;
      if (col) { rgb[i3] += (col[0] - rgb[i3]) * cov; rgb[i3 + 1] += (col[1] - rgb[i3 + 1]) * cov; rgb[i3 + 2] += (col[2] - rgb[i3 + 2]) * cov; }
      else { rgb[i3] += (paper[i3] - rgb[i3]) * cov; rgb[i3 + 1] += (paper[i3 + 1] - rgb[i3 + 1]) * cov; rgb[i3 + 2] += (paper[i3 + 2] - rgb[i3 + 2]) * cov; }
      fill[p] *= 1 - 0.6 * cov;
    }
  }
  // col = null scratches back to the bare paper
  function scratch(n, w, st, col) {
    const r0 = Math.max(0.35, w * 0.5 * SC);
    if (n === 1) { scratchDab((PX[0] - OX) * SC, (PY[0] - OY) * SC, r0 * PP[0], st, col); return; }
    const sd = ++strokeId;
    for (let i = 0; i < n - 1; i++) {
      const ax = (PX[i] - OX) * SC, ay = (PY[i] - OY) * SC, bx = (PX[i + 1] - OX) * SC, by = (PY[i + 1] - OY) * SC;
      const L = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(L / 0.6));
      for (let j = 0; j < k; j++) {
        const t = j / k, pr = PP[i] + (PP[i + 1] - PP[i]) * t;
        if (pr <= 0.02) continue;
        scratchDab(ax + (bx - ax) * t, ay + (by - ay) * t, Math.max(0.3, r0 * pr), st * (0.75 + 0.25 * hash2(i, j, 5)), col);
      }
    }
  }

  // ---------- the kneaded eraser: lifts softly, never all the way
  function eraseDab(cx, cy, r, st, col) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, fenceY, Math.ceil(cy + r));
    const ir = 1 / r, cl = clip;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) * ir; if (d >= 1) continue;
      const p = y * W + x;
      if (!((cl >> reg[p]) & 1)) continue;
      let a = (1 - d * d); a = a * a * st * (0.45 + 0.75 * tooth[p]);
      if (a > 1) a = 1;
      const i3 = p * 3;
      if (col) { rgb[i3] += (col[0] - rgb[i3]) * a; rgb[i3 + 1] += (col[1] - rgb[i3 + 1]) * a; rgb[i3 + 2] += (col[2] - rgb[i3 + 2]) * a; }
      else { rgb[i3] += (paper[i3] - rgb[i3]) * a; rgb[i3 + 1] += (paper[i3 + 1] - rgb[i3 + 1]) * a; rgb[i3 + 2] += (paper[i3 + 2] - rgb[i3 + 2]) * a; }
      fill[p] *= 1 - 0.5 * a;
    }
  }
  function erase(n, w, st, col) {
    const r0 = Math.max(0.8, w * 0.5 * SC);
    if (n === 1) { eraseDab((PX[0] - OX) * SC, (PY[0] - OY) * SC, r0, st * PP[0], col); return; }
    for (let i = 0; i < n - 1; i++) {
      const ax = (PX[i] - OX) * SC, ay = (PY[i] - OY) * SC, bx = (PX[i + 1] - OX) * SC, by = (PY[i + 1] - OY) * SC;
      const L = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(L / (r0 * 0.35)));
      for (let j = 0; j < k; j++) { const t = j / k; eraseDab(ax + (bx - ax) * t, ay + (by - ay) * t, r0, st * (PP[i] + (PP[i + 1] - PP[i]) * t) * 0.35, col); }
    }
  }

  // ---------- the patient layers: remembered once, re-coloured every frame
  let wq = null;                               // weights squeezed into bytes once the drawing is done
  function finishStatic() {
    wq = new Uint8Array(N * K);
    for (let p = 0; p < N; p++) {
      const b = p * K; let s = 0;
      for (let k = 0; k < K; k++) s += wts[b + k];
      const sc = s > 1 ? 1 / s : 1;
      // strongest first, so the frame loop can stop early
      for (let k = 0; k < K; k++) for (let j = k + 1; j < K; j++) if (wts[b + j] > wts[b + k]) { const tw = wts[b + k]; wts[b + k] = wts[b + j]; wts[b + j] = tw; const ti = ids[b + k]; ids[b + k] = ids[b + j]; ids[b + j] = ti; }
      for (let k = 0; k < K; k++) wq[b + k] = Math.round(wts[b + k] * sc * 255);
    }
    fill0.set(fill);
  }
  function exportStatic() { return { ids, wq, fill0, reg }; }
  function importStatic(o) { ids.set(o.ids); wq = new Uint8Array(o.wq); fill0.set(o.fill0); reg.set(o.reg); }
  // cols: Float32Array(3 * strokes); every grain becomes paper + its remembered strokes
  function composeStatic(cols) {
    const i255 = 1 / 255;
    for (let p = 0; p < N; p++) {
      const b = p * K, p3 = p * 3;
      let r = 0, g = 0, bl = 0, ws = 0;
      for (let k = 0; k < K; k++) {
        const w = wq[b + k]; if (w === 0) break;
        const c = ids[b + k] * 3;
        r += w * cols[c]; g += w * cols[c + 1]; bl += w * cols[c + 2]; ws += w;
      }
      const pw = ws >= 255 ? 0 : 255 - ws;
      rgb[p3] = (r + pw * paper[p3]) * i255; rgb[p3 + 1] = (g + pw * paper[p3 + 1]) * i255; rgb[p3 + 2] = (bl + pw * paper[p3 + 2]) * i255;
    }
    fill.set(fill0);
  }
  function clearToPaper() { rgb.set(paper); fill.fill(0); }

  // what is on the sheet at a spot right now (o-units)
  function curAt(x, y, o) {
    const xx = ((x - OX) * SC) | 0, yy = ((y - OY) * SC) | 0;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) { o[0] = PAPER[0]; o[1] = PAPER[1]; o[2] = PAPER[2]; return o; }
    const i3 = (yy * W + xx) * 3; o[0] = rgb[i3]; o[1] = rgb[i3 + 1]; o[2] = rgb[i3 + 2]; return o;
  }
  function regAt(x, y) {
    const xx = ((x - OX) * SC) | 0, yy = ((y - OY) * SC) | 0;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) return 0;
    return reg[yy * W + xx];
  }

  // 8-bit RGB with a fixed, sub-visible dither (fixed: it must not shimmer)
  let dth = null;
  function toRGB(out) {
    if (!dth) { dth = new Float32Array(N); for (let p = 0; p < N; p++) dth[p] = (hash2(p % W, (p / W) | 0, 99) - 0.5) / 255; }
    out = out || Buffer.alloc(N * 3);
    for (let p = 0, i = 0; p < N; p++, i += 3) {
      const d = dth[p];
      let v = rgb[i] + d; out[i] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0;
      v = rgb[i + 1] + d; out[i + 1] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0;
      v = rgb[i + 2] + d; out[i + 2] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0;
    }
    return out;
  }

  return {
    W, H, N, SC, OX, OY, PS, K, rgb, paper, tooth, fill, fill0, reg, R, rr, gs, reseed, hash2, vnoise, fbm, c01, sstep, hex,
    PAPER, makePaper, TOOLS, PX, PY, PP, MAXP, stroke, strokeRec, scratch, erase,
    finishStatic, exportStatic, importStatic, composeStatic, clearToPaper, curAt, regAt, toRGB,
    setClip(m) { clip = m; }, getClip() { return clip; }, setFence(yo) { fenceY = yo === null ? 1e9 : Math.round((yo - OY) * SC); },
  };
}

module.exports = { createEngine };
