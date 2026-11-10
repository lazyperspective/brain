'use strict';
// ---------- painting the gnarled apple trees: wood, rim light, snow on top, last red apples, tufts ----------
const HAZE = [178, 178, 220];
function winPos() { const hg = houseGeom(); return [(hg.x - 0.5 * hg.s) * KK, (hg.y - 1.55 * hg.s) * KK]; }
function warmK(x, y) { const w = winPos(); const dx = x - w[0], dy = (y - w[1]) * 1.25; return Math.exp(-(dx * dx + dy * dy) / (2 * Math.pow(210 * KK, 2))); }
function hazeAmt(Z) { return 0.92 * (1 - Math.exp(-Z / 52)); }
function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function c255(r, g, b) { return [r / 255, g / 255, b / 255]; }

function projBranch(t, br) {
  const n = br.pts.length;
  const px = new Array(n * 2), w = new Array(n), zs = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = br.pts[i];
    const Z = Math.max(1.4, t.Z + p.z);
    const s = CAM.F / Z;
    px[2 * i] = (CAM.VPX + (t.X + p.x) * s) * KK;
    px[2 * i + 1] = (CAM.YH + (CAM.H - p.y) * s) * KK;
    w[i] = Math.max(2 * p.r * s * KK, 0.9 * KK * 0.5);
    zs[i] = Z;
  }
  return { px, w, zs, n, order: br.order };
}
function normalsOf(px, n) {
  const nx = new Array(n), ny = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = px[2 * b] - px[2 * a], dy = px[2 * b + 1] - px[2 * a + 1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    nx[i] = -dy; ny[i] = dx;
  }
  return { nx, ny };
}
function offsetPath(px, w, nrm, u, n, a, b, sign) {
  // offset points a..b by u*w/2 along normals (sign chooses side so that 'up' is consistent)
  const out = [];
  for (let i = a; i <= b; i++) {
    const sg = sign ? sign[i] : 1;
    out.push(px[2 * i] + nrm.nx[i] * sg * u * w[i] * 0.5, px[2 * i + 1] + nrm.ny[i] * sg * u * w[i] * 0.5);
  }
  return out;
}

function inCanvas(arr, n, m) {
  for (let i = 0; i < n; i++) { const x = arr[2 * i], y = arr[2 * i + 1]; if (x > -m && x < W + m && y > -m && y < H + m) return true; }
  return false;
}

async function paintTree(t, ctxo) {
  const rng = new RNG(t.seed ^ 0x5bd1e995);
  const B = genTree(t);
  const hz = hazeAmt(t.Z) * 0.78;
  const near = t.Z < 16;
  const woodBase = [c255(30, 21, 40), c255(40, 27, 42), c255(24, 17, 36)];
  if (t.Z > 5 && t.Z < 80) paintShadows(t, B, rng);
  const prj = B.map(b => projBranch(t, b));
  // quick cull
  let any = false;
  for (const p of prj) if (inCanvas(p.px, p.n, 200)) { any = true; break; }
  if (!any) return;
  const hazeC = c255(HAZE[0], HAZE[1], HAZE[2]);
  const wcol = (v) => mixc(woodBase[v % 3], hazeC, hz);
  // --- wood: order ascending ---
  const order = prj.map((p, i) => i).sort((a, b) => prj[a].order - prj[b].order);
  const snowSegs = [];
  for (const bi of order) {
    const p = prj[bi];
    if (!inCanvas(p.px, p.n, 80)) continue;
    const wmax = Math.max(...p.w);
    const col = wcol(rng.int(0, 2));
    const farAlpha = wmax < 1.6 * KK * 0.5 ? 0.55 + 0.4 * (wmax / (0.8 * KK)) : 0.97;
    stroke(p.px, {
      widths: p.w, color: col, alpha: Math.min(0.98, farAlpha), streak: 0.28, dry: 0.12, thick: 0.18 + 0.25 * Math.min(1, wmax / 40), pick: 0.0, cj: 0.012,
      noProfile: true, rng,
    });
    const nrm = normalsOf(p.px, p.n);
    if (wmax > 26 * KK * 0.5) {
      const upS = new Array(p.n); for (let i = 0; i < p.n; i++) upS[i] = nrm.ny[i] > 0 ? -1 : 1;
      paintThick(p, nrm, upS, hz, hazeC, rng);
    } else
    // texture + rim light on large wood
    if (wmax > 7 * KK * 0.5) {
      const upSign = new Array(p.n);
      for (let i = 0; i < p.n; i++) upSign[i] = nrm.ny[i] > 0 ? -1 : 1;
      const nStr = Math.min(6, Math.floor(wmax / (9 * KK * 0.5)) + 1);
      for (let k = 0; k < nStr; k++) {
        const a = rng.int(0, Math.max(0, p.n - 3)), b = Math.min(p.n - 1, a + rng.int(2, Math.max(3, p.n)));
        if (b - a < 1) continue;
        const u = rng.range(-0.55, 0.55);
        const kind = rng.next();
        let cc, al, wf;
        if (kind < 0.3) { cc = mixc(c255(86, 98, 104), hazeC, hz); al = 0.5; wf = 0.14; }       // lichen
        else if (kind < 0.6) { cc = mixc(c255(58, 42, 58), hazeC, hz); al = 0.55; wf = 0.2; }   // warm brown
        else if (kind < 0.85) { cc = mixc(c255(12, 8, 20), hazeC, hz * 0.8); al = 0.85; wf = 0.1; } // cracks
        else { cc = mixc(c255(54, 40, 66), hazeC, hz); al = 0.7; wf = 0.22; }
        const pts = offsetPath(p.px, p.w, nrm, u, p.n, a, b, upSign);
        const ww = p.w.slice(a, b + 1).map(v => Math.max(1.0, v * wf));
        stroke(pts, { widths: ww, color: cc, alpha: al, streak: 0.5, dry: 0.4, thick: 0.25, pick: 0.02, cj: 0.03, rng });
      }
      // cool sky-light rim on the upper side
      if (wmax > 10 * KK * 0.5) {
        const a = 0, b = p.n - 1;
        const pts = offsetPath(p.px, p.w, nrm, 0.72, p.n, a, b, upSign);
        const ww = p.w.map(v => Math.max(1.0, v * 0.2));
        const rim = mixc(c255(70, 86, 160), hazeC, hz * 0.8);
        stroke(pts, { widths: ww, color: rim, color2: c255(120, 128, 200), mix: 0.3, alpha: 0.55, streak: 0.6, dry: 0.5, thick: 0.3, pick: 0.0, cj: 0.03, rng });
        // violet bounce from the snow on the underside
        const pts4 = offsetPath(p.px, p.w, nrm, -0.6, p.n, a, b, upSign);
        const ww4 = p.w.map(v => Math.max(1.0, v * 0.2));
        stroke(pts4, { widths: ww4, color: mixc(c255(66, 58, 124), hazeC, hz * 0.8), alpha: 0.5, streak: 0.5, dry: 0.4, thick: 0.2, pick: 0.0, cj: 0.03, rng });
      }
    }
    // warm rim from the window on the side of trunks and limbs that face the house
    if (t.Z > 14 && t.Z < HOUSE.Z + 14 && wmax > 2.4 * KK * 0.5) {
      const mi = Math.floor(p.n / 2);
      const wk = warmK(p.px[2 * mi], p.px[2 * mi + 1]);
      if (wk > 0.12) {
        const wp = winPos();
        const side = ((wp[0] - p.px[2 * mi]) * nrm.nx[mi] + (wp[1] - p.px[2 * mi + 1]) * nrm.ny[mi]) > 0 ? 1 : -1;
        const sg = new Array(p.n).fill(side);
        const pts = offsetPath(p.px, p.w, nrm, 0.62, p.n, 0, p.n - 1, sg);
        const wf0 = p.order === 0 ? 0.0 : 0.17;
        if (wf0 > 0) { const ww = p.w.map(v => Math.max(1.0, v * wf0));
        stroke(pts, { widths: ww, color: c255(226, 150, 96), color2: c255(190, 104, 96), mix: 0.35, alpha: Math.min(0.5, 0.7 * wk), streak: 0.4, dry: 0.3, thick: 0.3, pick: 0.0, cj: 0.03, rng }); }
      }
    }
    // register for snow
    if (p.order <= 4) snowSegs.push({ p, nrm });
  }
  // --- snow on the upper side of limbs and twigs: lumpy, broken rolls rather than a continuous tube ---
  const snowLit = mixc(c255(216, 226, 254), hazeC, hz * 0.85);
  const snowMid = mixc(c255(172, 190, 244), hazeC, hz * 0.8);
  const snowShade = mixc(c255(120, 134, 206), hazeC, hz * 0.8);
  const snowHi = mixc(c255(240, 243, 255), hazeC, hz * 0.6);
  for (const sg of snowSegs) {
    const { p } = sg;
    if (!inCanvas(p.px, p.n, 80)) continue;
    const m0 = densify(p.px, Math.max(2.5, 4 * KK * 0.5));
    const m = m0;
    const dx_ = new Float32Array(m), dy_ = new Float32Array(m), du_ = new Float32Array(m);
    for (let i = 0; i < m; i++) { dx_[i] = PX[i]; dy_[i] = PY[i]; du_[i] = PU[i]; }
    const wAt = (u) => { const ui = Math.min(p.n - 2, Math.floor(u)); const f = u - ui; return p.w[ui] + (p.w[ui + 1] - p.w[ui]) * f; };
    const nx = new Float32Array(m), ny = new Float32Array(m), acc = new Float32Array(m), ww = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      const a = Math.max(0, i - 3), b = Math.min(m - 1, i + 3);
      let tx = dx_[b] - dx_[a], ty = dy_[b] - dy_[a];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      let nxx = -ty, nyy = tx; if (nyy > 0) { nxx = -nxx; nyy = -nyy; }
      nx[i] = nxx; ny[i] = nyy;
      acc[i] = smooth(0.95, 0.35, Math.abs(ty));
      ww[i] = wAt(du_[i]);
    }
    const step = Math.max(2.5, 4 * KK * 0.5);
    let i = 0;
    while (i < m - 3) {
      const w = ww[i];
      if (acc[i] < 0.3 || rng.next() > (acc[i] > 0.75 && w > 6 * KK * 0.5 ? 0.97 : 0.3 + 0.7 * acc[i])) { i += rng.int(1, 3); continue; }
      const thickBoost = w > 8 * KK * 0.5 ? 2.2 : 1;
      const runLen = clamp(Math.round(rng.range(2.5, 9) * thickBoost * Math.max(w, 5 * KK * 0.5) / step), 4, 90);
      let j = i + 1;
      while (j < m - 1 && acc[j] > 0.3 && (j - i) < runLen) j++;
      if (j - i >= 3) {
        const pts = [], wd = [];
        const stp = Math.max(1, Math.round((j - i) / 7));
        const cnt = Math.max(3, Math.ceil((j - i) / stp));
        for (let q = 0; q <= cnt; q++) {
          const k = Math.min(j, i + q * stp);
          const u = q / cnt;
          const wl = ww[k];
          const wsn = Math.max(1.3 * KK * 0.5, wl * 0.62 + (p.order >= 2 ? 1.9 : 0.9) * KK * 0.5) * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * Math.min(0.97, Math.max(0.03, u))), 0.6)) * (0.8 + 0.4 * rng.next());
          const off = wl * 0.32 + wsn * 0.28;
          pts.push(dx_[k] + nx[k] * off, dy_[k] + ny[k] * off);
          wd.push(wsn);
        }
        const wloc = Math.max(...wd);
        const th = near ? 1.0 : 0.35;
        const tone = rng.next();
        const wk = warmK(pts[0], pts[1]) * (t.Z > HOUSE.Z - 18 ? 1 : 0.5);
        const WS = c255(255, 206, 160);
        const c1 = mixc(tone < 0.6 ? snowLit : snowMid, WS, wk * 0.55);
        stroke(pts, { widths: wd, color: c1, color2: mixc(tone < 0.6 ? snowMid : snowShade, c255(214, 130, 120), wk * 0.4), mix: 0.3, alpha: 0.98, streak: 0.32, dry: 0.08, thick: th * (0.6 + 0.8 * acc[i]), pick: 0.0, cj: 0.03, rng });
        // sculpted snow mass: shadowed underside, bright crown
        if (false) {
          const ka = Math.floor(pts.length / 4);
          const pm = [pts[2 * ka], pts[2 * ka + 1], pts[2 * ka + 2], pts[2 * ka + 3]];
          const mx = pm[2] - pm[0], my = pm[3] - pm[1], ml = Math.hypot(mx, my) || 1;
          const ox = nx[Math.min(j, i + ka * stp)] * wloc * 0.3, oy = ny[Math.min(j, i + ka * stp)] * wloc * 0.3;
          const q0 = [pm[0] - mx / ml * wloc * 0.8 + ox, pm[1] - my / ml * wloc * 0.8 + oy, (pm[0] + pm[2]) / 2 + ox, (pm[1] + pm[3]) / 2 + oy, pm[2] + mx / ml * wloc * 0.8 + ox, pm[3] + my / ml * wloc * 0.8 + oy];
          stroke(q0, { widths: [wloc * 0.4, wloc * 0.95, wloc * 0.4], color: snowMid, color2: snowShade, mix: 0.5, alpha: 0.99, streak: 0.12, dry: 0.0, thick: 1.0, pick: 0.0, cj: 0.03, rng });
          stroke(q0.map((v, q) => q % 2 ? v - wloc * 0.16 : v), { widths: [wloc * 0.25, wloc * 0.6, wloc * 0.25], color: snowLit, color2: snowHi, mix: 0.4, alpha: 0.99, streak: 0.12, dry: 0.0, thick: 1.4, pick: 0.0, cj: 0.02, rng });
        }
        // crown highlight on only some rolls
        if (wloc > 4 * KK * 0.5 && rng.next() < 0.5) {
          const p2 = [], w2 = [];
          for (let q = 0; q < wd.length; q++) { p2.push(pts[2 * q] + nx[Math.min(j, i + q * stp)] * wd[q] * 0.22, pts[2 * q + 1] + ny[Math.min(j, i + q * stp)] * wd[q] * 0.22); w2.push(Math.max(1.0, wd[q] * 0.32)); }
          stroke(p2, { widths: w2, color: snowHi, alpha: 0.85, streak: 0.55, dry: 0.4, thick: th * 1.4, pick: 0.0, cj: 0.02, rng });
        }
        // cool shadow where the snow meets the wood
        if (wloc > 6 * KK * 0.5 && near) {
          const p3 = [], w3 = [];
          for (let q = 0; q < wd.length; q++) { const k = Math.min(j, i + q * stp); p3.push(pts[2 * q] - nx[k] * wd[q] * 0.42, pts[2 * q + 1] - ny[k] * wd[q] * 0.42); w3.push(Math.max(1.0, wd[q] * 0.2)); }
          stroke(p3, { widths: w3, color: snowShade, alpha: 0.6, streak: 0.5, dry: 0.4, thick: 0.15, pick: 0.0, cj: 0.02, rng });
        }
      }
      i = j + rng.int(0, w > 8 * KK * 0.5 ? 1 : 4);
    }
    // snow caught in forks
    if (p.order >= 1 && p.order <= 3 && rng.next() < 0.55) {
      const w0 = Math.min(p.w[0], 34 * KK * 0.5);
      if (w0 > 2.2 * KK * 0.5 && inCanvas(p.px, 1, 40)) {
        const a0 = rng.range(-0.35, 0.35), L0 = Math.max(3, w0 * 2.4);
        const cx = p.px[0], cy = p.px[1] - w0 * 0.55;
        stroke([cx - Math.cos(a0) * L0 * 0.5, cy - Math.sin(a0) * L0 * 0.5, cx, cy - w0 * 0.12, cx + Math.cos(a0) * L0 * 0.5, cy + Math.sin(a0) * L0 * 0.5], { widths: [w0 * 0.45, w0 * 0.9, w0 * 0.45], color: snowLit, color2: snowMid, mix: 0.3, alpha: 0.99, streak: 0.2, dry: 0.0, thick: near ? 0.9 : 0.3, cj: 0.02, rng });
      }
    }
  }
  // --- apples on near trees ---
  if (t.apples > 0) {
    const cand = [];
    for (let bi = 0; bi < B.length; bi++) {
      const b = B[bi];
      if (b.order >= 3 && b.pts.length >= 2) { const q = b.pts[b.pts.length - 1]; if (q.y > 1.2 && q.y < 4.2) cand.push(q); }
    }
    for (let k = 0; k < t.apples && cand.length; k++) {
      const q = cand.splice(rng.int(0, cand.length - 1), 1)[0];
      const Z = Math.max(1.4, t.Z + q.z), s = CAM.F / Z;
      const x = (CAM.VPX + (t.X + q.x) * s) * KK;
      const rad = 0.052 * s * KK;
      const y = (CAM.YH + (CAM.H - (q.y - 0.075)) * s) * KK;
      paintApple(x, y, rad, hz, rng);
    }
  }
  // --- tufts of dead grass and a drift ring at the base (near trees only) ---
  if (t.Z < 24) {
    const s = CAM.F / t.Z;
    const bx = (CAM.VPX + t.X * s) * KK, by = (CAM.YH + CAM.H * s) * KK;
    paintBase(bx, by, s * KK, hz, rng, t);
  }
}

function paintApple(x, y, r, hz, rng, fallen) {
  const hazeC = c255(HAZE[0], HAZE[1], HAZE[2]);
  const base = mixc(c255(88, 12, 28), hazeC, hz * 0.5);
  const mid = mixc(c255(158, 26, 36), hazeC, hz * 0.45);
  const hi = mixc(c255(214, 88, 66), hazeC, hz * 0.4);
  const ang = rng.range(-0.5, 0.5);
  if (fallen) { dab(x + r * 0.15, y + r * 0.7, r * 1.25, c255(22, 24, 70), { alpha: 0.5, thick: 0.02, hard: 0.2, ex: 2.0, rng, grain: 0.3 }); }
  if (!fallen) stroke([x + r * 0.05, y - r * 0.9, x + r * 0.25, y - r * 1.6, x + r * 0.15, y - r * 2.3], { w: Math.max(1.2, r * 0.16), color: c255(34, 24, 30), alpha: 0.95, streak: 0.2, dry: 0.1, thick: 0.15, noProfile: true, rng });
  // slightly lopsided body from two overlapping dabs, then a few broken touches of light
  dab(x, y, r, base, { alpha: 1, thick: 0.4, hard: 0.9, ex: 1.1, ang, rng, grain: 0.18 });
  dab(x + r * rng.range(-0.12, 0.12), y + r * 0.08, r * 0.92, base, { alpha: 0.95, thick: 0.4, hard: 0.85, ex: 1.0, ang: ang + 1.2, rng, grain: 0.18 });
  dab(x - r * 0.12, y - r * 0.1, r * 0.72, mid, { alpha: 0.85, thick: 0.6, hard: 0.35, ex: 1.1, ang, rng, grain: 0.35 });
  dab(x - r * 0.34, y - r * 0.34, r * 0.26, hi, { alpha: fallen ? 0.3 : 0.62, thick: 0.5, hard: 0.2, ex: 1.4, ang: -0.6, rng, grain: 0.4 });
  dab(x + r * 0.05, y + r * 0.84, r * 0.15, c255(26, 12, 20), { alpha: 0.7, thick: 0.1, hard: 0.5, rng, grain: 0.2 });
  dab(x + r * 0.58, y + r * 0.34, r * 0.28, mixc(c255(80, 44, 120), hazeC, hz * 0.4), { alpha: 0.4, thick: 0.1, hard: 0.2, rng, grain: 0.3 });
  if (rng.next() < (fallen ? 0.8 : 0.35)) {
    dab(x - r * 0.05, y - r * 0.78, r * 0.6, mixc(c255(222, 230, 254), hazeC, hz * 0.7), { alpha: 0.97, thick: 0.8, hard: 0.4, ex: 1.35, ang: ang * 0.5, rng, grain: 0.35 });
  }
}

function paintBase(bx, by, s, hz, rng, t) {
  const hazeC = c255(HAZE[0], HAZE[1], HAZE[2]);
  const U = KK * 0.5;
  const tw = 0.5 * s * 0.5; // approx trunk half-width in px
  const rd = window.__rd;
  const clip = { map: rd.reg, allow: 1 << REG.GROUND };
  // deep contact shadow
  dab(bx, by + 0.02 * s, tw * 1.9, mixc(c255(16, 14, 44), hazeC, hz * 0.6), { alpha: 0.55, thick: 0.02, hard: 0.1, ex: 2.6, rng, grain: 0.3, clip });
  // roots flaring into the snow
  const nr = rng.int(3, 5);
  for (let k = 0; k < nr; k++) {
    const sg = (k / (nr - 1)) * 2 - 1 + rng.range(-0.15, 0.15);
    const x0 = bx + sg * tw * 0.8, L = rng.range(0.18, 0.36) * s;
    stroke([x0, by - 0.05 * s, x0 + sg * L * 0.55, by + 0.004 * s, x0 + sg * L, by + 0.02 * s * rng.range(0.5, 1.2)], { w0: Math.max(2, 0.07 * s * rng.range(0.7, 1.1)), w1: 1.2, color: mixc(c255(26, 18, 36), hazeC, hz), alpha: 0.95, streak: 0.4, dry: 0.2, thick: 0.3, noProfile: true, rng });
  }
  // snow banked against the trunk: short soft arcs that hug the roots, picking up the ground colour
  for (let k = 0; k < 4; k++) {
    const sg = rng.range(-1, 1);
    const x0 = bx + sg * tw * 1.1, y0 = by + rng.range(0.0, 0.05) * s;
    const Lh = rng.range(0.1, 0.22) * s;
    stroke([x0 - Lh, y0 + 0.01 * s, x0, y0 - 0.012 * s, x0 + Lh, y0 + 0.012 * s], { w: Math.max(2, 0.035 * s * rng.range(0.7, 1.2)), color: mixc(c255(164, 176, 232), hazeC, hz * 0.7), color2: mixc(c255(104, 114, 190), hazeC, hz * 0.6), mix: 0.4, alpha: 0.75, streak: 0.5, dry: 0.3, thick: 0.6, pick: 0.2, rng });
  }
  // dead grass tufts
  const n = Math.round(Math.min(16, 4 + 4 * s / 100));
  for (let k = 0; k < n; k++) {
    const ox = rng.range(-1.0, 1.0) * 0.6 * s, oy = rng.range(-0.01, 0.05) * s * 0.3;
    const h = rng.range(0.12, 0.34) * s * 0.5, lean = rng.range(-0.6, 0.6) * h;
    const cc = rng.next() < 0.6 ? mixc(c255(52, 38, 60), hazeC, hz * 0.7) : mixc(c255(128, 108, 112), hazeC, hz * 0.6);
    stroke([bx + ox, by + oy, bx + ox + lean * 0.4, by + oy - h * 0.55, bx + ox + lean, by + oy - h], { w0: Math.max(1.2, 0.012 * s), w1: 1.0, color: cc, alpha: 0.9, streak: 0.2, dry: 0.1, thick: 0.2, noProfile: true, rng });
  }
}

// ---------- smoke: straight column, scumbled low-alpha strokes ----------
function paintSmoke() {
  const rng = new RNG(31337);
  const hg = houseGeom();
  const sx = (hg.x + 2.0 * hg.s), sy = (hg.y - 5.8 * hg.s);
  const top = sy - 270;
  const px = (t) => sx + 7 * Math.sin(t * 2.4 + 0.4) + 3 * Math.sin(t * 7.5) * t;
  for (let layer = 0; layer < 3; layer++) {
    const n = 46;
    for (let i = 0; i < n; i++) {
      const t0 = rng.range(0, 0.95), t1 = Math.min(1, t0 + rng.range(0.08, 0.3));
      const rad = (4 + 28 * Math.pow((t0 + t1) / 2, 0.8)) * KK;
      const pts = [];
      const lat = rng.range(-0.5, 0.5) * rad;
      for (let k = 0; k <= 4; k++) {
        const t = t0 + (t1 - t0) * k / 4;
        pts.push((px(t) + 0) * KK + lat + rng.range(-0.15, 0.15) * rad, (sy + (top - sy) * t) * KK);
      }
      const warm = 1 - smooth(0, 0.5, t0);
      const col = mixc(c255(150, 154, 204), c255(196, 180, 204), warm * 0.8);
      const a = (0.5 + 0.2 * (1 - t0)) * (layer === 0 ? 1.1 : 0.8) * (1 - 0.85 * smooth(0.45, 1.0, (t0 + t1) / 2));
      stroke(pts, { w: rad * rng.range(0.7, 1.2), color: col, color2: c255(150, 150, 200), mix: 0.4, alpha: a, streak: 0.7, dry: 0.5, thick: 0.12, pick: 0.2, cj: 0.03, rng });
    }
  }
}

// ---------- foreground: tufts, twigs, fallen apples, animal tracks ----------
async function paintForeground(trees) {
  const rng = new RNG(424242);
  const hazeC = c255(HAZE[0], HAZE[1], HAZE[2]);
  const gp = (X, Z) => { const s = CAM.F / Z; return [(CAM.VPX + X * s) * KK, (CAM.YH + CAM.H * s) * KK, s * KK]; };
  const rd = window.__rd;
  const clip = { map: rd.reg, allow: 1 << REG.GROUND };
  // tufts of dead grass poking through the snow, clustered near trunks and the lane edges
  const spots = [];
  for (const t of trees) if (t.Z > 3 && t.Z < 30) { const n = rng.int(1, 3); for (let k = 0; k < n; k++) spots.push([t.X + rng.range(-1.4, 1.4), t.Z + rng.range(-1.0, 0.6)]); }
  for (let i = 0; i < 14; i++) spots.push([rng.range(-5.5, 5.5), rng.range(2.2, 10)]);
  for (const sp of spots) {
    const [X, Z] = sp;
    if (Z < 2.0) continue;
    const [x, y, s] = gp(X, Z);
    if (y > H + 20 || x < -40 || x > W + 40) continue;
    const hz = hazeAmt(Z) * 0.8;
    const cnt = rng.int(5, 12);
    const sc = rng.range(0.7, 1.4);
    // soft bluish snow smudge that nests the tuft into the ground (low alpha, picks up what is underneath)
    stroke([x - 0.2 * s * 0.5 * sc, y + 0.012 * s, x, y + 0.004 * s, x + 0.2 * s * 0.5 * sc, y + 0.012 * s], { w: Math.max(2, 0.04 * s * sc), color: mixc(c255(168, 178, 228), hazeC, hz), color2: mixc(c255(120, 128, 196), hazeC, hz), mix: 0.5, alpha: 0.5, streak: 0.7, dry: 0.5, thick: 0.35, pick: 0.2, clip, rng });
    for (let k = 0; k < cnt; k++) {
      const h = rng.range(0.1, 0.34) * s * 0.55 * sc, lean = rng.range(-0.8, 0.8) * h;
      const ox = rng.range(-0.1, 0.1) * s * 0.4 * sc;
      const cc = rng.next() < 0.6 ? mixc(c255(48, 36, 62), hazeC, hz) : mixc(c255(120, 100, 106), hazeC, hz * 0.8);
      stroke([x + ox, y, x + ox + lean * 0.25, y - h * 0.5, x + ox + lean * 0.8, y - h * 0.9, x + ox + lean * 1.2, y - h * 0.95], { w0: Math.max(1.5, 0.014 * s), w1: 0.9, color: cc, alpha: 0.9, streak: 0.2, dry: 0.1, thick: 0.25, noProfile: true, rng });
    }
    if (rng.next() < 0.4) dab(x + rng.range(-1, 1) * 0.08 * s, y - 0.012 * s, Math.max(1.5, 0.018 * s), c255(216, 224, 250), { alpha: 0.85, thick: 0.6, hard: 0.4, rng, grain: 0.3 });
  }
  // fallen twigs, with a rim of snow along the top
  for (let i = 0; i < 9; i++) {
    const Z = rng.range(2.4, 9), X = rng.range(-4.2, 4.2);
    if (Math.abs(X) < 1.2) continue;
    const [x, y, s] = gp(X, Z);
    const L = rng.range(0.4, 1.1) * s * 0.5, a = rng.range(-0.25, 0.25);
    const pts = [];
    for (let k = 0; k <= 5; k++) { const u = k / 5 - 0.5; pts.push(x + Math.cos(a) * L * 2 * u, y + Math.sin(a) * L * 2 * u + Math.sin(k * 1.7 + i) * 0.012 * s); }
    stroke(pts, { w0: Math.max(1.8, 0.022 * s), w1: 1.0, color: c255(34, 24, 42), alpha: 0.95, streak: 0.2, dry: 0.1, thick: 0.25, noProfile: true, rng });
    const top = pts.map((v, k) => k % 2 ? v - 0.011 * s : v);
    stroke(top.slice(2, 10), { w: Math.max(1.2, 0.012 * s), color: c255(176, 188, 240), alpha: 0.75, streak: 0.6, dry: 0.5, thick: 0.5, clip, rng });
  }
  // a few fallen apples, half-sunk
  for (let i = 0; i < 4; i++) {
    const Z = rng.range(3.2, 12), X = (rng.next() < 0.5 ? -1 : 1) * rng.range(1.5, 4.2);
    const [x, y, s] = gp(X, Z);
    paintApple(x, y, 0.036 * s, hazeAmt(Z) * 0.8, rng, true);
  }
  // a single trail of footprints walking up the lane toward the lit window, half filled by new snow
  {
    let Z = 3.2, side = -1;
    while (Z < 24) {
      const X = -0.55 + side * 0.13 + 0.06 * Math.sin(Z * 0.4);
      const [x, y, s] = gp(X, Z);
      const ang = Math.atan2(CAM.YH * KK - y, CAM.VPX * KK - x);
      const r = 0.055 * s, ca = Math.cos(ang), sa = Math.sin(ang);
      dab(x + ca * r * 0.25, y + sa * r * 0.25, r, mixc(c255(36, 40, 108), hazeC, hazeAmt(Z) * 0.5), { alpha: 0.7, thick: 0.02, hard: 0.35, ex: 2.5, ang, rng, grain: 0.35, clip });
      dab(x - ca * r * 0.7, y - sa * r * 0.7, r * 0.6, mixc(c255(214, 208, 244), hazeC, hazeAmt(Z) * 0.4), { alpha: 0.45, thick: 0.4, hard: 0.2, ex: 2.2, ang, rng, grain: 0.4, clip });
      // fresh snow drifting back into the print
      dab(x - ca * r * 0.2, y - sa * r * 0.2, r * 0.7, mixc(c255(150, 156, 214), hazeC, hazeAmt(Z) * 0.4), { alpha: 0.3, thick: 0.2, hard: 0.0, ex: 2.0, ang, rng, grain: 0.5, clip });
      Z += 0.8 * (1 + Z / 22); side = -side;
    }
  }
  // animal tracks crossing the lane
  {
    let Z = 15, X = -4.6;
    for (let i = 0; i < 22; i++) {
      Z -= 0.6 + rng.range(-0.05, 0.05); X += 0.36 + 0.12 * Math.sin(i * 0.7);
      for (let side = -1; side <= 1; side += 2) {
        const zz = Z + (side > 0 ? 0.0 : 0.2), xx = X + side * 0.08;
        const [x, y, s] = gp(xx, zz);
        const r = 0.04 * s;
        dab(x, y, r, c255(58, 64, 134), { alpha: 0.6, thick: 0.02, hard: 0.4, ex: 1.2, rng, grain: 0.3 });
        dab(x - r * 0.1, y - r * 0.5, r * 0.75, c255(206, 214, 248), { alpha: 0.5, thick: 0.5, hard: 0.3, ex: 1.2, rng, grain: 0.4 });
      }
    }
  }
  paintGlints(rng);
  await tick();
}

function paintGlints(rng) {
  const gp = (X, Z) => { const s = CAM.F / Z; return [(CAM.VPX + X * s) * KK, (CAM.YH + CAM.H * s) * KK, s * KK]; };
  const wp = winPos();
  for (let i = 0; i < 1100; i++) {
    const Z = HOUSE.Z - 3 - Math.pow(rng.next(), 1.6) * 19;
    const X = HOUSE.X + rng.gauss() * (1.2 + (HOUSE.Z - Z) * 0.12);
    const [x, y, s] = gp(X, Z);
    const wk = warmK(x, y);
    const r = Math.max(0.7, 0.011 * s * (0.6 + rng.next()));
    const warm = rng.next() < 0.35 + 0.5 * wk;
    if (!warm) continue;
    const col = mixc(c255(255, 226, 190), c255(255, 190, 150), rng.next());
    dab(x, y, r, col, { alpha: 0.3 + 0.45 * rng.next(), thick: 0.25, hard: 0.5, ex: 1.6, ang: 0, rng, grain: 0.3 });
  }
}

// ---------- falling snow ----------
async function paintSnowfall() {
  const rng = new RNG(8675309);
  const hg = houseGeom();
  const wx = (hg.x - 0.5 * hg.s) * KK, wy = (hg.y - 1.55 * hg.s) * KK;
  const flakes = [];
  for (let i = 0; i < 1500; i++) {
    const depth = Math.pow(rng.next(), 2.2); // 0 far .. 1 near
    flakes.push({ x: rng.range(-20, W + 20), y: rng.range(-20, H + 20), r: (0.8 + 9 * depth * depth * depth + 1.4 * depth) * KK * 0.5 * (0.7 + 0.7 * rng.next()), depth, b: rng.next() });
  }
  flakes.sort((a, b) => a.depth - b.depth);
  // distant veils of snow: thin, nearly vertical low-alpha streaks give the air depth
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, W), y = rng.range(0, H * 0.85), L = rng.range(90, 280) * KK * 0.5, a = 1.5 + rng.range(-0.12, 0.12);
    stroke([x, y, x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L], { w: rng.range(5, 26) * KK * 0.5, color: c255(200, 212, 244), alpha: rng.range(0.015, 0.04), streak: 0.7, dry: 0.6, thick: 0.02, pick: 0.0, cj: 0.02, rng });
  }
  let c = 0;
  for (const f of flakes) {
    const near = f.depth;
    const dxw = f.x - wx, dyw = f.y - wy;
    const dw = Math.exp(-(dxw * dxw + dyw * dyw) / (2 * (170 * KK) * (170 * KK)));
    const col = mixc(mixc(c255(196, 208, 244), c255(240, 244, 255), f.b), c255(255, 206, 150), dw * 0.85);
    const soft = near > 0.55;
    const ang = 1.5 + (rng.next() - 0.5) * 0.5;
    dab(f.x, f.y, f.r, col, { alpha: soft ? 0.32 + 0.3 * f.b : 0.45 + 0.4 * f.b, thick: 0.04 + 0.12 * near, hard: soft ? 0.05 : 0.35, ex: 1.2 + near * 0.5, ang, rng, grain: 0.35 });
    if ((++c & 255) === 0) await tick();
  }
}

function paintThick(p, nrm, upS, hz, hazeC, rng) {
  const n = p.n;
  const U = KK * 0.5;
  const base1 = mixc(c255(30, 21, 40), hazeC, hz), base2 = mixc(c255(40, 27, 44), hazeC, hz);
  const sub = (u, wf, col, col2, al, st, thk, a, b) => {
    a = a === undefined ? 0 : a; b = b === undefined ? n - 1 : b;
    if (b - a < 1) return;
    const pts = offsetPath(p.px, p.w, nrm, u, n, a, b, upS);
    const ww = p.w.slice(a, b + 1).map(v => Math.max(1.0, v * wf));
    stroke(pts, { widths: ww, color: col, color2: col2, mix: 0.4, alpha: al, streak: st, dry: 0.4, thick: thk, pick: 0.02, cj: 0.03, rng });
  };
  sub(-0.26, 0.58, base1, base2, 0.92, 0.8, 0.3);
  sub(0.28, 0.55, base2, base1, 0.92, 0.8, 0.3);
  // lit side picks up the cool sky
  sub(-0.46, 0.3, mixc(c255(64, 60, 120), hazeC, hz), mixc(c255(98, 98, 166), hazeC, hz), 0.5, 0.8, 0.35);
  sub(-0.74, 0.1, mixc(c255(116, 124, 196), hazeC, hz), null, 0.55, 0.6, 0.4);
  // faint warm bounce on the far side
  sub(0.66, 0.14, mixc(c255(92, 54, 62), hazeC, hz), null, 0.4, 0.6, 0.2);
  // cracks and ridges
  const nc = Math.min(8, 2 + Math.floor(p.w[0] / (30 * U)));
  for (let k = 0; k < nc; k++) {
    const a = rng.int(0, Math.max(0, n - 3)), b = Math.min(n - 1, a + rng.int(Math.max(1, Math.floor(n * 0.4)), n));
    if (b - a < 1) continue;
    const u = rng.range(-0.8, 0.8);
    const pts = [];
    const twist = rng.range(0.1, 0.35) * (rng.next() < 0.5 ? -1 : 1), tph = rng.range(0, 6.28);
    for (let i = a; i <= b; i++) {
      const uu = clamp(u + twist * Math.sin((i - a) / Math.max(1, b - a) * Math.PI * 1.4 + tph), -0.92, 0.92);
      pts.push(p.px[2 * i] + nrm.nx[i] * upS[i] * uu * p.w[i] * 0.5 + rng.range(-0.5, 0.5) * p.w[a] * 0.02, p.px[2 * i + 1] + nrm.ny[i] * upS[i] * uu * p.w[i] * 0.5 + rng.range(-0.5, 0.5) * p.w[a] * 0.02);
    }
    const wf = rng.range(0.012, 0.035);
    const ww = p.w.slice(a, b + 1).map(v => Math.max(1.2, v * wf));
    const dark = rng.next() < 0.55;
    stroke(pts, { widths: ww, color: dark ? mixc(c255(12, 8, 20), hazeC, hz * 0.8) : mixc(c255(84, 72, 100), hazeC, hz), alpha: dark ? 0.6 : 0.45, streak: 0.3, dry: 0.2, thick: dark ? 0.1 : 0.4, pick: 0.0, cj: 0.01, rng });
  }
  // burls and a hollow: swollen knots with a lit upper lip and a dark cavity
  if (p.w[0] > 70 * KK * 0.5) {
    const nb2 = rng.int(3, 5);
    for (let k = 0; k < nb2; k++) {
      const i = rng.int(1, Math.max(1, n - 2));
      const rr = p.w[i] * rng.range(0.07, 0.15);
      const ox = nrm.nx[i] * rng.range(-0.55, 0.55) * p.w[i], oy = nrm.ny[i] * rng.range(-0.55, 0.55) * p.w[i];
      const cx = p.px[2 * i] + ox, cy = p.px[2 * i + 1] + oy;
      dab(cx, cy, rr * 1.15, mixc(c255(52, 40, 66), hazeC, hz), { alpha: 0.9, thick: 0.7, hard: 0.6, ex: 1.3, ang: 1.5, rng, grain: 0.35 });
      dab(cx - rr * 0.15, cy - rr * 0.35, rr * 0.7, mixc(c255(98, 100, 160), hazeC, hz), { alpha: 0.55, thick: 0.9, hard: 0.3, ex: 1.6, ang: 1.5, rng, grain: 0.4 });
      dab(cx + rr * 0.1, cy + rr * 0.15, rr * 0.55, mixc(c255(8, 5, 14), hazeC, hz * 0.5), { alpha: 0.85, thick: 0.2, hard: 0.5, ex: 1.4, ang: 1.5, rng, grain: 0.3 });
    }
  }
  // lichen patches
  const nl = rng.int(2, 5);
  for (let k = 0; k < nl; k++) {
    const i = rng.int(0, n - 1);
    const rr = p.w[i] * rng.range(0.05, 0.12);
    dab(p.px[2 * i] + nrm.nx[i] * rng.range(-0.5, 0.5) * p.w[i], p.px[2 * i + 1] + nrm.ny[i] * rng.range(-0.5, 0.5) * p.w[i], rr, mixc(rng.next() < 0.5 ? c255(96, 112, 106) : c255(120, 120, 130), hazeC, hz), { alpha: 0.5, thick: 0.4, hard: 0.3, ex: 1.6, ang: 1.57, rng, grain: 0.5 });
  }
}

// long soft shadows of the crown thrown toward the viewer (backlit by the horizon glow)
function paintShadows(t, B, rng) {
  const tanE = 0.42;
  const rd = window.__rd;
  const clip = { map: rd.reg, allow: 1 << REG.GROUND };
  const shade = mixc(c255(40, 44, 118), c255(HAZE[0], HAZE[1], HAZE[2]), hazeAmt(t.Z) * 0.55);
  for (const b of B) {
    if (b.order > 4) continue;
    const pts = [], ws = [];
    for (const q of b.pts) {
      const Zs = t.Z + q.z - q.y / tanE;
      if (Zs < 2.0) break;
      const s = CAM.F / Zs;
      pts.push((CAM.VPX + (t.X + q.x) * s) * KK, (CAM.YH + CAM.H * s) * KK);
      ws.push(Math.max(1.0, (2 * q.r + 0.02 * q.y) * s * KK));
    }
    if (pts.length < 6) continue;
    const al = (b.order <= 1 ? 0.62 : b.order <= 2 ? 0.5 : 0.4);
    stroke(pts, { widths: ws, color: shade, alpha: al, streak: 0.5, dry: 0.4, thick: 0.02, pick: 0.15, cj: 0.02, clip, noProfile: true, rng });
  }
}


// ---------- window bloom: a warm glaze of light breathing through falling snow ----------
function paintBloom() {
  const rng = new RNG(5150);
  const hg = houseGeom();
  const cx = (hg.x - 0.5 * hg.s) * KK, cy = (hg.y - 1.55 * hg.s) * KK;
  const rings = [[170, 0.05, [255, 140, 70]], [128, 0.06, [255, 150, 72]], [92, 0.08, [255, 168, 84]], [62, 0.11, [255, 186, 100]], [38, 0.15, [255, 208, 128]], [22, 0.2, [255, 226, 156]]];
  for (const [r, a, c] of rings) dab(cx, cy, r * KK, c255(c[0], c[1], c[2]), { alpha: a, thick: 0.05, hard: 0.0, ex: 1.15, rng, grain: 0.45 });
  // low glow on the snow in front of the house
  const gy = (hg.y + 8) * KK;
  for (let i = 0; i < 4; i++) dab(cx + rng.range(-20, 20) * KK, gy + i * 4 * KK, (140 - i * 25) * KK, c255(255, 170, 110), { alpha: 0.07, thick: 0.05, hard: 0.0, ex: 3.4, rng, grain: 0.45 });
  // crisp window on top
  const wx0 = (hg.x - 0.95 * hg.s) * KK, wy0 = (hg.y - 2.05 * hg.s) * KK, ww = 0.9 * hg.s * KK, wh = 1.1 * hg.s * KK;
  const cols = [c255(255, 238, 168), c255(255, 208, 112), c255(250, 160, 70), c255(238, 120, 44)];
  for (let i = 0; i < 4; i++) {
    const yy = wy0 + (i + 0.5) * wh / 4;
    stroke([wx0 + 1, yy, wx0 + ww * 0.5, yy + rng.range(-0.5, 0.5), wx0 + ww - 1, yy], { w: wh / 4 + 1, color: cols[i], alpha: 1, streak: 0.2, dry: 0.0, thick: 0.35, pick: 0.0, cj: 0.01, noProfile: true, rng });
  }
  stroke([wx0 + ww * 0.5, wy0, wx0 + ww * 0.5, wy0 + wh], { w: Math.max(1.4, 0.07 * hg.s * KK), color: c255(104, 44, 24), alpha: 0.9, streak: 0.2, dry: 0.1, thick: 0.3, noProfile: true, rng });
  stroke([wx0, wy0 + wh * 0.5, wx0 + ww, wy0 + wh * 0.5], { w: Math.max(1.4, 0.07 * hg.s * KK), color: c255(104, 44, 24), alpha: 0.9, streak: 0.2, dry: 0.1, thick: 0.3, noProfile: true, rng });
}


// ---------- farmhouse detail: clapboards, warm spill on the wall, window frame ----------
function paintHouseDetail() {
  const rng = new RNG(60606);
  const hg = houseGeom(), s = hg.s;
  const rd = window.__rd;
  const clip = { map: rd.reg, allow: 1 << REG.HOUSE };
  const X = (m) => (hg.x + m * s) * KK, Y = (m) => (hg.y - m * s) * KK;
  // clapboard courses
  for (let k = 0; k < 9; k++) {
    const y = Y(0.3 + k * 0.28);
    const light = rng.next() < 0.5;
    stroke([X(-3.2), y + rng.range(-1, 1), X(0), y + rng.range(-1, 1), X(3.2), y + rng.range(-1, 1)], { w: 0.1 * s * KK, color: light ? c255(70, 66, 116) : c255(34, 32, 74), alpha: 0.3, streak: 0.6, dry: 0.5, thick: 0.15, pick: 0.05, cj: 0.03, clip, rng });
    stroke([X(-6.0), y + rng.range(-1, 1) - 0.1 * s * KK, X(-4.5), y, X(-3.0), y], { w: 0.09 * s * KK, color: light ? c255(60, 58, 108) : c255(30, 30, 70), alpha: 0.25, streak: 0.6, dry: 0.5, thick: 0.15, pick: 0.05, cj: 0.03, clip, rng });
  }
  // warm light on the wall around the window
  const wcx = X(-0.5), wcy = Y(1.55);
  for (let i = 0; i < 5; i++) {
    const r = (3.0 - i * 0.5) * s * KK;
    dab(wcx, wcy, r, c255(236, 130, 60), { alpha: 0.12 + 0.05 * i, thick: 0.05, hard: 0.0, ex: 1.0, rng, grain: 0.4, clip });
  }
  // snow lying on the sill and the door step
  stroke([X(1.0), Y(0.1), X(1.6), Y(0.05), X(2.2), Y(0.1)], { w: 0.2 * s * KK, color: c255(190, 200, 240), alpha: 0.9, streak: 0.4, dry: 0.2, thick: 0.6, rng });
}


// ---------- palette-knife drags of lit snow: flat planes with ridged edges ----------
function paintKnifeSnow() {
  const rng = new RNG(2024);
  const rd = window.__rd;
  const clip = { map: rd.reg, allow: 1 << REG.GROUND };
  const gp = (X, Z) => { const s = CAM.F / Z; return [(CAM.VPX + X * s) * KK, (CAM.YH + CAM.H * s) * KK, s * KK]; };
  let made = 0, tries = 0;
  while (made < 70 && tries < 800) {
    tries++;
    const Z0 = 2.4 + Math.pow(rng.next(), 1.5) * 26, X = rng.range(-8, 8);
    const radial = rng.next() < 0.55;
    const pts = [];
    let wpx;
    if (radial) {
      const L = rng.range(1.5, 5) * (1 + Z0 / 14);
      for (let k = 0; k <= 4; k++) { const [x, y, s] = gp(X + Math.sin(k * 1.1 + X) * 0.12, Z0 + L * k / 4); pts.push(x, y); }
    } else {
      const L = rng.range(1.5, 4.5);
      for (let k = 0; k <= 4; k++) { const [x, y, s] = gp(X + L * k / 4, Z0 + Math.sin(k * 0.9 + X) * 0.08); pts.push(x, y); }
    }
    const s0 = gp(X, Z0)[2];
    wpx = rng.range(0.22, 0.6) * s0;
    const mx = clamp(Math.round(pts[4]), 0, W - 1), my = clamp(Math.round(pts[5]), 0, H - 1);
    const ii = my * W + mx;
    const lum = 0.3 * rd.R[ii] + 0.55 * rd.G[ii] + 0.15 * rd.B[ii];
    if (lum < 0.4 || wpx < 4 * KK * 0.5) continue;
    const c = [rd.R[ii], rd.G[ii], rd.B[ii]];
    const col = [Math.min(1, c[0] * 1.1 + 0.05), Math.min(1, c[1] * 1.08 + 0.04), Math.min(1, c[2] * 1.04 + 0.03)];
    const col2 = [Math.min(1, c[0] * 0.92), Math.min(1, c[1] * 0.92), Math.min(1, c[2] * 1.0)];
    stroke(pts, { w: wpx, color: col, color2: col2, mix: 0.3, alpha: 0.93, knife: true, thick: 1.5, pick: 0.05, cj: 0.015, clip, rng });
    made++;
  }
}


// ---------- dry-brush scumbles of cooler light across the sky: thick, ragged, catching the surface ----------
function paintSkyScumble() {
  const rng = new RNG(1717);
  const rd = window.__rd;
  const clip = { map: rd.reg, allow: 1 << REG.SKY };
  const hz = CAM.YH * KK;
  for (let i = 0; i < 90; i++) {
    const x = rng.range(-100, W + 100), y = rng.range(0, hz * 0.95);
    const ii = clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1);
    const lift = 1.1 + 0.18 * rng.next();
    const c = [Math.min(1, rd.R[ii] * lift + 0.02), Math.min(1, rd.G[ii] * lift + 0.02), Math.min(1, rd.B[ii] * lift + 0.04)];
    const L = rng.range(240, 700) * KK * 0.5, a = rng.range(-0.08, 0.08);
    const pts = [x, y, x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 + rng.range(-8, 8), x + Math.cos(a) * L, y + Math.sin(a) * L];
    stroke(pts, { w: rng.range(30, 90) * KK * 0.5, color: c, color2: [c[0] * 0.9, c[1] * 0.9, c[2]], mix: 0.4, alpha: rng.range(0.28, 0.55), streak: 0.85, dry: 0.75, thick: 0.9, pick: 0.1, cj: 0.03, clip, rng });
  }
}
