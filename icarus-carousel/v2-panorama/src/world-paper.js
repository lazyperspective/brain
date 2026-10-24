// I. THE DESIGN (panorama) — the notebook page, now a torn sheet lying over the
// world. Its ink sea is the same sea as everyone else's; its labyrinth island is
// torn in half, the other half painted in oil; its birds fly off the page.
SC.WORLD.paper = async function (S) {
  const DH = SC.DH, HZ = SC.HZ;
  const Ly = SC.layer(0, 1130, S);
  const ctx = Ly.ctx, W = Ly.c.width, H = Ly.c.height;
  const R = new L.Rand(1503), N = L.noise2(41), N2 = L.noise2(42), N3 = L.noise2(43);
  const INK = [52, 33, 18], SEPIA = [140, 96, 52], CHALK = [178, 78, 52], AMBER = [214, 146, 46];

  // ---------------- paper ----------------
  const paper = L.canvas(W, H);
  {
    const px = paper.getContext('2d');
    const img = px.createImageData(W, H), d = img.data;
    const base = L.hex('#eadcbf'), warm = L.hex('#d9c193'), edge = L.hex('#a98454'), cool = L.hex('#e6dcc8');
    for (let y = 0; y < H; y++) {
      const uy = y / S, tx = SC.tearX(uy);
      const laid = 1 + 0.012 * Math.sin(uy * Math.PI * 2 / 1.25);
      for (let x = 0; x < W; x++) {
        const ux = x / S;
        const f = L.fbm(N, ux / 420, uy / 420, 5);
        const f2 = L.fbm(N2, ux / 90, uy / 90, 3);
        let c = L.mix(base, warm, 0.55 * L.smooth(-0.5, 0.8, f + 0.25 * f2));
        c = L.mix(c, cool, L.smooth(0.25, 0.7, -f) * 0.5);
        const de = Math.min(ux, uy, DH - uy) + L.fbm(N3, ux / 220, uy / 220, 3) * 45 + L.fbm(N3, ux / 25, uy / 25, 2) * 4;
        const e = 1 - L.smooth(-10, 120, de);
        c = L.mix(c, edge, e * e * e * 0.55);
        // the torn side has browned a little in the air
        const dt = tx - ux + L.fbm(N3, ux / 40, uy / 40, 2) * 10;
        const et = 1 - L.smooth(0, 55, dt);
        c = L.mix(c, edge, et * et * 0.32);
        const rr = Math.hypot(ux - 760, uy - 520) + L.fbm(N2, ux / 70, uy / 70, 3) * 40;
        const tide = Math.exp(-(((rr - 250) / 9) ** 2)) * 0.3 + (rr < 250 ? 0.05 : 0);
        c = L.mix(c, warm, tide);
        const chain = Math.exp(-(((ux % 27.5) - 13.7) ** 2) / 0.5) * 0.02;
        const k = laid - chain;
        const g = (R.next() - 0.5) * 7;
        const i = (y * W + x) * 4;
        d[i] = c[0] * k + g; d[i + 1] = c[1] * k + g; d[i + 2] = c[2] * k + g * 0.8; d[i + 3] = 255;
      }
    }
    px.putImageData(img, 0, 0);
    px.setTransform(S, 0, 0, S, 0, 0);
    for (let i = 0; i < 2900; i++) {
      const x = R.r(0, 1130), y = R.r(0, DH), a = R.r(0, Math.PI * 2), l = R.r(2, 9);
      px.strokeStyle = R.chance(0.5) ? 'rgba(255,250,235,0.18)' : 'rgba(120,90,50,0.07)';
      px.lineWidth = R.r(0.2, 0.5);
      px.beginPath(); px.moveTo(x, y); px.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); px.stroke();
    }
    px.globalCompositeOperation = 'multiply';
    for (let c = 0; c < 15; c++) {
      const cx = R.r(0, 1100), cy = R.r(0, DH), cnt = R.int(3, 14);
      for (let i = 0; i < cnt; i++) {
        const x = cx + R.gauss(0, 18), y = cy + R.gauss(0, 18), r = R.r(0.8, 4.5);
        const g = px.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(150,95,45,${R.r(0.15, 0.4)})`); g.addColorStop(1, 'rgba(150,95,45,0)');
        px.fillStyle = g; px.beginPath(); px.arc(x, y, r, 0, Math.PI * 2); px.fill();
      }
    }
    const fg = px.createLinearGradient(492, 0, 512, 0);
    fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.45, 'rgba(160,125,80,0.10)'); fg.addColorStop(0.55, 'rgba(255,255,255,0)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
    px.fillStyle = fg; px.fillRect(490, 0, 25, DH);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(paper, 0, 0); ctx.restore();
  const paperFill = ctx.createPattern(paper, 'no-repeat');

  // ---------------- drawing instruments ----------------
  let load = 1; // ink load on the nib
  const wob = (pts, amp = 0.55, f = 0.02) => pts.map(([x, y]) => [x + N(x * f, y * f + 3.1) * amp, y + N2(x * f + 7.7, y * f) * amp]);
  function pen(pts, w, o = {}) {
    const p = wob(L.resample(pts, 0.9), o.wob ?? 0.5);
    if (p.length < 2) return;
    const seed = R.r(0, 100), len = L.polyLen(p);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = L.css(o.color || INK, (o.alpha ?? 0.9) * (0.65 + 0.35 * load));
    const taper = o.taper ?? 0.12;
    L.ribbon(ctx, p, (t) => w * (0.7 + 0.45 * N3(seed + t * len * 0.04, 0.5)) * (taper ? Math.sqrt(L.smooth(0, taper, t) * L.smooth(1, 1 - taper, t)) * 0.85 + 0.15 : 1));
    load = Math.max(0.6, load - len * 0.0005);
    if (R.chance(0.04)) load = 1;
  }
  const dip = () => { load = 1; };
  function lines(segs, w, alpha, color = INK) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = L.css(color, alpha); ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
    ctx.stroke();
  }
  function chalk(pts, w = 1.6, alpha = 0.3) {
    const p = wob(L.resample(pts, 1.6), 0.8);
    ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'round';
    for (let i = 1; i < p.length; i++) {
      if (R.chance(0.18)) continue;
      ctx.strokeStyle = L.css(CHALK, alpha * R.r(0.3, 1)); ctx.lineWidth = w * R.r(0.5, 1.2);
      ctx.beginPath(); ctx.moveTo(p[i - 1][0], p[i - 1][1]); ctx.lineTo(p[i][0], p[i][1]); ctx.stroke();
    }
  }
  function wash(poly, alpha, color = SEPIA, blur = 0) {
    ctx.globalCompositeOperation = 'multiply';
    if (blur) ctx.filter = `blur(${blur * S}px)`;
    ctx.fillStyle = L.css(color, alpha); L.path(ctx, poly, true); ctx.fill();
    ctx.filter = 'none';
    // pooled pigment at the drying edge
    ctx.strokeStyle = L.css(color, alpha * 0.9); ctx.lineWidth = 0.9; L.path(ctx, wob(poly, 0.8), true); ctx.stroke();
  }
  function cover(poly) { ctx.globalCompositeOperation = 'source-over'; paperFill.setTransform(ctx.getTransform().inverse()); ctx.fillStyle = paperFill; L.path(ctx, poly, true); ctx.fill(); }
  function hatch(poly, ang, gap, alpha, w = 0.45, cross = false, jitter = 0.4) {
    ctx.save(); L.path(ctx, poly, true); ctx.clip();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = Math.hypot(x1 - x0, y1 - y0) / 2 + 5;
    const segs = [];
    const dirs = cross ? [ang, ang + 1.2] : [ang];
    for (const a of dirs) {
      const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      for (let s = -rad; s < rad; s += gap * R.r(0.8, 1.2)) {
        const l0 = -rad * R.r(0.7, 1), l1 = rad * R.r(0.7, 1), jj = R.gauss(0, jitter);
        segs.push([cx + nx * s + dx * l0, cy + ny * s + dy * l0, cx + nx * (s + jj) + dx * l1, cy + ny * (s + jj) + dy * l1]);
      }
    }
    lines(segs, w, alpha);
    ctx.restore();
  }
  function wax(cx, cy, r, drip = 0) {
    const sh = L.blob(cx, cy, r, R, 0.22, 36);
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = `blur(${r * 0.9 * S}px)`; ctx.fillStyle = L.css([225, 190, 120], 0.35); L.path(ctx, L.blob(cx, cy + r * 0.3, r * 1.9, R, 0.3, 36), true); ctx.fill(); ctx.filter = 'none';
    if (drip) {
      ctx.fillStyle = L.css(AMBER, 0.75);
      const dp = L.catmull([[cx, cy], [cx + R.r(-2, 2), cy + drip * 0.5], [cx + R.r(-3, 3), cy + drip]], 10);
      L.ribbon(ctx, dp, (t) => r * (1.1 - 0.75 * t) + (t > 0.92 ? r * 0.35 * Math.sin((t - 0.92) / 0.08 * Math.PI) : 0));
      ctx.beginPath(); ctx.arc(dp[dp.length - 1][0], dp[dp.length - 1][1], r * 0.42, 0, Math.PI * 2); ctx.fill();
    }
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.1);
    g.addColorStop(0, L.css([240, 190, 90], 0.75)); g.addColorStop(0.7, L.css(AMBER, 0.85)); g.addColorStop(1, L.css([160, 92, 22], 0.95));
    ctx.fillStyle = g; L.path(ctx, sh, true); ctx.fill();
    ctx.strokeStyle = L.css([120, 70, 20], 0.5); ctx.lineWidth = 0.7; L.path(ctx, sh, true); ctx.stroke();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,248,225,0.75)';
    L.path(ctx, L.blob(cx - r * 0.35, cy - r * 0.4, r * 0.22, R, 0.2, 16, 1.6, -0.6), true); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.3)';
    L.path(ctx, L.blob(cx + r * 0.25, cy + r * 0.3, r * 0.12, R, 0.2, 12), true); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------- mirror script ----------------
  const GLYPHS = {
    a: [[0.45, -0.85], [0.1, -0.95], [0, -0.4], [0.22, 0], [0.48, -0.55], [0.5, -0.95], [0.52, -0.1], [0.62, 0]],
    e: [[0, -0.1], [0.35, -0.5], [0.3, -0.95], [0.05, -0.6], [0.15, -0.05], [0.45, 0]],
    n: [[0, 0], [0.02, -0.95], [0.1, -0.75], [0.33, -0.95], [0.43, -0.5], [0.46, 0]],
    m: [[0, 0], [0.02, -0.95], [0.08, -0.75], [0.25, -0.95], [0.32, -0.4], [0.33, 0], [0.36, -0.75], [0.55, -0.95], [0.64, -0.5], [0.66, 0]],
    u: [[0, -0.95], [0.02, -0.2], [0.18, 0], [0.4, -0.3], [0.43, -0.95], [0.45, -0.1], [0.55, 0]],
    o: [[0.3, -0.95], [0.03, -0.6], [0.15, -0.02], [0.47, -0.3], [0.42, -0.9], [0.25, -0.95], [0.55, -0.85]],
    i: [[0, 0], [0.08, -0.85], [0.1, -0.05], [0.25, 0]],
    r: [[0, 0], [0.04, -0.95], [0.1, -0.7], [0.28, -0.95], [0.4, -0.8], [0.42, -0.1]],
    s: [[0, 0], [0.28, -0.95], [0.22, -0.55], [0.42, -0.2], [0.15, 0], [0.48, 0.02]],
    l: [[0, 0], [0.25, -1.1], [0.32, -2.1], [0.16, -2.05], [0.1, -1], [0.14, 0], [0.3, 0]],
    d: [[0.42, -0.85], [0.08, -0.95], [0, -0.35], [0.2, 0], [0.42, -0.6], [0.52, -2.1], [0.47, -1], [0.5, 0], [0.62, 0]],
    p: [[0, -0.9], [0.06, 0], [0.08, 1.15], [0.06, 0.2], [0.2, -0.9], [0.48, -0.6], [0.34, 0], [0.08, -0.1], [0.55, 0]],
    f: [[0, 0], [0.12, 1.1], [0.15, -1.2], [0.3, -2.15], [0.42, -1.9], [0.2, -1.6], [0.18, -0.2], [0.35, 0]],
    c: [[0.42, -0.8], [0.25, -0.95], [0.02, -0.5], [0.15, -0.02], [0.45, -0.05]],
    q: [[0.44, -0.85], [0.1, -0.95], [0.02, -0.4], [0.2, 0], [0.44, -0.5], [0.44, -0.95], [0.46, 1.15], [0.4, 0.4], [0.6, 0]],
  };
  const FREQ = 'eeeeaaaoooiinnnnrrsssuuummllddcpfq';
  function scriptLine(x0, y0, width, xh, o = {}) {
    const words = [];
    let x = 0;
    while (true) {
      const nl = R.int(2, 8);
      let wpts = [], dots = [];
      let wx = x;
      for (let k = 0; k < nl; k++) {
        const ch = FREQ[R.int(0, FREQ.length - 1)], g = GLYPHS[ch];
        const sx = R.r(0.9, 1.15);
        for (const [gx, gy] of g) wpts.push([wx + gx * xh * sx * 1.25 + R.gauss(0, 0.05 * xh), gy * xh * (gy < -1 || gy > 0.2 ? R.r(0.9, 1.05) : 1) + R.gauss(0, 0.06 * xh)]);
        if (ch === 'i') dots.push([wx + 0.1 * xh, -1.6 * xh]);
        wx += (g[g.length - 1][0] + 0.12) * xh * sx * 1.25;
      }
      if (wx > width) break;
      words.push({ pts: wpts, dots });
      x = wx + xh * R.r(1.0, 1.8);
      if (o.short && words.length >= o.short) break;
    }
    // right-aligned mirror writing: flip each line
    const used = x;
    for (const w of words) {
      const pts = L.catmull(w.pts.map(([px, py]) => [x0 + width - (px + py * -0.18) - (o.left ? width - used : 0), y0 + py]), 6);
      pen(pts, xh * 0.14, { taper: 0.08, wob: 0.15, alpha: o.alpha ?? 0.85 });
      for (const [dx, dy] of w.dots) { ctx.fillStyle = L.css(INK, 0.7); ctx.beginPath(); ctx.arc(x0 + width - (dx - dy * 0.18) - (o.left ? width - used : 0), y0 + dy, xh * 0.09, 0, 7); ctx.fill(); }
    }
  }
  function block(x0, y0, width, xh, nLines, lead, o = {}) {
    dip();
    for (let i = 0; i < nLines; i++) {
      const w = i === nLines - 1 ? width * R.r(0.35, 0.7) : width * R.r(0.86, 1);
      scriptLine(x0 + (width - w), y0 + i * lead, w, xh, o);
      if (R.chance(0.3)) dip();
    }
  }
  function numeral(str, x, y, h, w = 1.1) {
    let cx = x;
    for (const ch of str) {
      if (ch === 'I') { pen([[cx, y - h], [cx + 0.3, y - h / 2], [cx, y]], w); pen([[cx - h * 0.18, y - h], [cx + h * 0.18, y - h]], w * 0.6); pen([[cx - h * 0.18, y], [cx + h * 0.18, y]], w * 0.6); cx += h * 0.42; }
      if (ch === 'V') { pen([[cx - h * 0.1, y - h], [cx + h * 0.25, y]], w); pen([[cx + h * 0.25, y], [cx + h * 0.55, y - h]], w * 0.7); cx += h * 0.75; }
    }
  }

  // ---------------- feather ----------------
  function feather(base, ang, len, wid, curve, o = {}) {
    const dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1], dir[0]];
    const tip = [base[0] + dir[0] * len, base[1] + dir[1] * len];
    const ctrl = [(base[0] + tip[0]) / 2 + nrm[0] * curve * len, (base[1] + tip[1]) / 2 + nrm[1] * curve * len];
    const M = 70, rach = L.quad(base, ctrl, tip, M), rn = L.normals(rach);
    const side = o.side ?? -1; // which normal side is the narrow outer vane
    const prof = (t) => (t < 0.07 ? 0 : L.smooth(0.07, 0.24, t)) * (t > 0.68 ? Math.sqrt(Math.max(0, 1 - ((t - 0.68) / 0.32) ** 2)) : 1);
    const notch = (t) => (o.notch ? 1 - 0.32 * L.smooth(0.5, 0.66, t) : 1);
    const wOut = (t) => wid * 0.33 * prof(t) * (1 - 0.25 * t) * notch(t) ** 0.3;
    const wIn = (t) => wid * 0.67 * prof(t) * notch(t);
    const edge = (t, s) => { const i = Math.round(t * M), w = s === side ? wOut(t) : wIn(t); return [rach[i][0] + rn[i][0] * w * s, rach[i][1] + rn[i][1] * w * s]; };
    const outer = [], inner = [];
    for (let i = 0; i <= M; i++) { outer.push(edge(i / M, side)); inner.push(edge(i / M, -side)); }
    const outline = outer.concat(inner.slice().reverse());
    const innerPoly = inner.concat(rach.slice().reverse());
    const outerPoly = outer.concat(rach.slice().reverse());
    cover(outline);
    // sepia wash, deeper on the shadowed inner vane
    const tone = o.tone ?? 1;
    wash(innerPoly.slice(4), (o.washIn ?? 0.16) * tone);
    wash(outerPoly.slice(4), (o.washOut ?? 0.06) * tone);
    // tonal hatching near the base, cross-hatched where coverts shade it
    const sub = (poly, t0, t1) => { const a = Math.round(t0 * M), b = Math.round(t1 * M); return inner.slice(a, b + 1).concat(rach.slice(a, b + 1).reverse()); };
    hatch(sub(innerPoly, 0.08, o.hatchTo ?? 0.55), -2.36 + 0.3, 2.4, 0.36 * tone, 0.42);
    hatch(sub(innerPoly, 0.08, 0.3), -2.36 + 0.3, 2.2, 0.34 * tone, 0.42, true);
    if (tone > 1.15) hatch(sub(innerPoly, 0.3, 0.85), -2.36 + 0.3, 2.0, 0.3 * (tone - 1), 0.4);
    // barbs
    const segsA = [], segsB = [];
    const gap = o.barbGap ?? 2.4;
    for (const s of [side, -side]) {
      let split = 0;
      for (let t = 0.08; t < 0.985; t += gap / len * R.r(0.75, 1.25)) {
        if (R.chance(0.025)) split = R.r(0.01, 0.025);
        const i = Math.round(t * M);
        const lead = (s === side ? 0.035 : 0.06) + split;
        const e = edge(Math.min(1, t + lead), s);
        if (R.chance(0.08)) continue;
        (R.chance(0.5) ? segsA : segsB).push([rach[i][0], rach[i][1], e[0], e[1]]);
        split *= 0.8;
      }
    }
    lines(segsA, 0.38, 0.55 * tone); lines(segsB, 0.32, 0.4 * tone);
    // outline and quill
    dip();
    pen(outer, 0.75, { taper: 0.05 }); pen(inner, 0.85, { taper: 0.05 });
    pen(rach, 2.0 * (o.quill ?? 1), { taper: 0.0 });
    ctx.globalCompositeOperation = 'source-over';
    // quill sheen: a thin paper-coloured line inside the shaft
    ctx.strokeStyle = 'rgba(245,235,212,0.65)'; ctx.lineWidth = 0.55 * (o.quill ?? 1);
    L.path(ctx, rach.slice(2, Math.round(M * 0.75)).map(([x, y], i) => [x + rn[i + 2][0] * 0.35, y + rn[i + 2][1] * 0.35])); ctx.stroke();
    return { tip, rach, outline };
  }

  // ---------------- the wing ----------------
  const spar = L.resample(L.catmull([[95, 340], [205, 278], [335, 252], [455, 268], [560, 302], [640, 352], [712, 420]], 12), 2);
  const sparAt = (u) => spar[Math.round(L.clamp(u) * (spar.length - 1))];
  const sparDir = (u) => { const a = sparAt(u - 0.01), b = sparAt(u + 0.01); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const root = (u, off) => { const p = sparAt(u), a = sparDir(u); return [p[0] - Math.sin(a) * off, p[1] + Math.cos(a) * off]; };

  // red-chalk construction underneath the ink
  const deg = Math.PI / 180;
  const flights = [];
  for (let k = 0; k < 13; k++) {
    const t = k / 12;
    flights.push({ u: 0.07 + 0.49 * t, ang: (101 - 18 * t) * deg + R.gauss(0, 0.02), len: (360 + 50 * t - (k < 2 ? 40 - k * 20 : 0)) * R.r(0.9, 1.06), wid: 70, curve: 0.03, notch: false });
  }
  for (let k = 0; k < 10; k++) {
    const t = k / 9;
    flights.push({ u: 0.6 + 0.395 * t, ang: (80 - 30 * t) * deg, len: 400 + 70 * Math.sin(t * 2.6), wid: 60 - 8 * t, curve: 0.05 + 0.02 * t, notch: k > 4 });
  }
  const tips = flights.map((f) => { const b = root(f.u, 9); return [b[0] + Math.cos(f.ang) * f.len, b[1] + Math.sin(f.ang) * f.len]; });

  // flight feathers: from the wing tip toward the body, so inner feathers overlap outer ones
  for (let k = flights.length - 1; k >= 0; k--) {
    const f = flights[k];
    const tone = 1.0 + 0.9 * L.smooth(0.25, 0.95, f.u) * (k % 2 ? 1 : 0.75) + 0.35 * N(f.u * 8, 2);
    feather(root(f.u, 9), f.ang + R.gauss(0, 0.01), f.len, f.wid, f.curve, { notch: f.notch, side: -1, tone });
  }
  {
    const band = [];
    for (let u = 0; u <= 1.0001; u += 0.02) band.push(root(u, 95 + 25 * Math.sin(u * 3)));
    for (let u = 1; u >= -0.0001; u -= 0.02) band.push(root(u, 30));
    ctx.globalCompositeOperation = 'multiply'; ctx.filter = `blur(${14 * S}px)`;
    ctx.fillStyle = L.css(SEPIA, 0.32); L.path(ctx, band, true); ctx.fill(); ctx.filter = 'none';
    const segs = [];
    for (let u = 0.03; u < 0.97; u += 0.0025) { const a = root(u, R.r(40, 60)), b = root(u + 0.01, R.r(95, 125)); segs.push([a[0], a[1], b[0] - 6, b[1]]); }
    lines(segs, 0.4, 0.22);
  }
  // coverts: two overlapping rows, then scale-like lesser coverts
  const flightAt = (u) => { let best = flights[0]; for (const f of flights) if (Math.abs(f.u - u) < Math.abs(best.u - u)) best = f; return best; };
  for (const [n, frac, off, wid, u0, u1] of [[24, 0.36, 10, 34, 0.04, 0.97], [28, 0.2, 4, 24, 0.02, 0.93]]) {
    for (let k = n - 1; k >= 0; k--) {
      const u = u0 + (u1 - u0) * (k / (n - 1)), f = flightAt(u);
      feather(root(u, off), f.ang - 0.07, f.len * frac * R.r(0.92, 1.06), wid, 0.02, { side: -1, barbGap: 1.9, hatchTo: 0.75, washIn: 0.16, quill: 0.6 });
    }
  }
  {
    // lesser coverts as small overlapping scallops along the leading edge
    for (let row = 2; row >= 0; row--) {
      for (let u = 0.02; u < 0.94; u += 0.016) {
        const p = root(u + row * 0.006, 2 + row * 5), a = sparDir(u) + Math.PI / 2;
        const sc = []; for (let i = 0; i <= 12; i++) { const th = -Math.PI / 2 + Math.PI * i / 12; sc.push([p[0] + Math.cos(a + th) * 6.5, p[1] + Math.sin(a + th) * 6.5]); }
        const poly = sc.concat([p]);
        cover(poly); wash(poly, 0.12); pen(sc, 0.55, { taper: 0.2, alpha: 0.75 });
      }
    }
  }
  // the spar: a bound wooden rod with pivots
  {
    const nr = L.normals(spar), wAt = (i) => 7 - 3.2 * (i / spar.length);
    const left = spar.map((p, i) => [p[0] + nr[i][0] * wAt(i), p[1] + nr[i][1] * wAt(i)]);
    const right = spar.map((p, i) => [p[0] - nr[i][0] * wAt(i), p[1] - nr[i][1] * wAt(i)]);
    const poly = left.concat(right.slice().reverse());
    cover(poly); wash(poly, 0.2);
    hatch(right.concat(spar.slice().reverse()), -2.36 + 0.3, 1.7, 0.45, 0.4);
    for (let g = -0.5; g <= 0.5; g += 0.33) pen(spar.map((p, i) => [p[0] + nr[i][0] * wAt(i) * g + N(i * 0.05, g * 3) * 0.6, p[1] + nr[i][1] * wAt(i) * g]), 0.3, { alpha: 0.4, taper: 0.3 });
    dip(); pen(left, 1.3, { taper: 0.03 }); pen(right, 1.6, { taper: 0.03 });
    // thread bindings with wax at each
    for (let i = 30; i < spar.length - 8; i += 21) {
      const p = spar[i], n = nr[i], w = wAt(i) + 1.2, dx = n[1], dy = -n[0];
      for (let k = -2; k <= 2; k++) pen([[p[0] + n[0] * w + dx * (k * 1.6 + 1.6), p[1] + n[1] * w + dy * (k * 1.6 + 1.6)], [p[0] - n[0] * w + dx * k * 1.6, p[1] - n[1] * w + dy * k * 1.6]], 0.55, { taper: 0.25, alpha: 0.8 });
    }
    for (const f of flights) { const b = root(f.u, 10); wax(b[0] + R.gauss(0, 1), b[1] + R.r(-1, 2), R.r(3.3, 4.6)); }
    for (const u of [0.25, 0.555]) {
      const p = sparAt(u);
      cover(L.blob(p[0], p[1], 13, R, 0.02)); wash(L.blob(p[0], p[1], 13, R, 0.02), 0.12);
      pen(L.blob(p[0], p[1], 13, R, 0.03, 40).concat([L.blob(p[0], p[1], 13, R, 0, 40)[0]]), 1.3, { taper: 0 });
      pen(L.blob(p[0], p[1], 4, R, 0.02, 20).concat([[p[0] + 4, p[1]]]), 0.9, { taper: 0 });
      hatch(L.blob(p[0] + 2, p[1] + 2, 11, R, 0.02), -0.6, 1.5, 0.35, 0.35);
      pen([[p[0] - 18, p[1]], [p[0] + 18, p[1]]], 0.4, { alpha: 0.5 }); pen([[p[0], p[1] - 18], [p[0], p[1] + 18]], 0.4, { alpha: 0.5 });
    }
    // shoulder plate and harness strap
    const s0 = spar[0];
    const strap = L.catmull([[s0[0] + 8, s0[1] + 4], [s0[0] - 30, s0[1] + 30], [s0[0] - 60, s0[1] + 18], [s0[0] - 72, s0[1] - 22], [s0[0] - 40, s0[1] - 50], [s0[0] - 5, s0[1] - 30]], 10);
    const sn = L.normals(strap);
    const sl = strap.map((p, i) => [p[0] + sn[i][0] * 5, p[1] + sn[i][1] * 5]), sr = strap.map((p, i) => [p[0] - sn[i][0] * 5, p[1] - sn[i][1] * 5]);
    cover(sl.concat(sr.slice().reverse())); wash(sl.concat(sr.slice().reverse()), 0.22);
    pen(sl, 1, { taper: 0.05 }); pen(sr, 1.1, { taper: 0.05 });
    for (let i = 6; i < strap.length - 4; i += 4) { ctx.fillStyle = L.css(INK, 0.6); ctx.beginPath(); ctx.arc(strap[i][0], strap[i][1], 0.7, 0, 7); ctx.fill(); }
    const plate = [[s0[0] - 16, s0[1] - 14], [s0[0] + 20, s0[1] - 20], [s0[0] + 24, s0[1] + 12], [s0[0] - 12, s0[1] + 18]];
    const pl = L.catmull(plate, 6, true);
    cover(pl); wash(pl, 0.18); hatch(pl, -2.06, 1.8, 0.4, 0.4);
    pen(pl.concat([pl[0]]), 1.3, { taper: 0 });
    for (const [rx, ry] of [[-8, -7], [14, -11], [16, 6], [-5, 10]]) { ctx.fillStyle = L.css(INK, 0.85); ctx.beginPath(); ctx.arc(s0[0] + rx, s0[1] + ry, 1.6, 0, 7); ctx.fill(); }
  }


  // ---------------- the sea, drawn: the same sea line the other painters use ----------------
  {
    wash([[0, HZ], [1130, HZ], [1130, DH + 5], [0, DH + 5]], 0.05);
    pen([[0, HZ], [1130, HZ + 0.5]], 0.95, { taper: 0, wob: 0.3 });
    for (let k = 0; ; k++) {
      const y = HZ + 7 + 5.5 * k + 0.62 * k * k;
      if (y > DH + 10) break;
      const amp = 0.7 + k * 0.28, lam = 13 + k * 3.2, ph = R.r(0, 6.28);
      let x = R.r(-20, 10);
      while (x < 1130) {
        const len = R.r(60, 260) * (1 + k * 0.05), pts = [];
        for (let xx = x; xx < x + len; xx += 2) pts.push([xx, y + amp * Math.sin(xx / lam * Math.PI * 2 + ph) + N(xx / 80, k) * amp * 0.6]);
        if (pts.length > 2) pen(pts, 0.45 + k * 0.055, { alpha: 0.7, taper: 0.15 });
        x += len + R.r(4, 30);
      }
    }
  }
  // ---------------- the island of the labyrinth, half of it on this page ----------------
  {
    const I = SC.ISLE, shore = L.blob(I.cx, I.cy, I.rx, new L.Rand(77), 0.08, 80, 1, 0).map(([x, y]) => [x, I.cy + (y - I.cy) * (I.ry / I.rx)]);
    // surf around the coast
    for (let k = 1; k <= 3; k++) pen(shore.map(([x, y]) => [I.cx + (x - I.cx) * (1 + k * 0.07), I.cy + (y - I.cy) * (1 + k * 0.16) + 2]).slice(0, 44), 0.5, { alpha: 0.55 - k * 0.1, taper: 0.2 });
    cover(shore); wash(shore, 0.1);
    hatch(shore.filter(([x, y]) => y > I.cy - 8), -2.06, 2.2, 0.3, 0.4);
    dip(); pen(shore.concat([shore[0]]), 1.2, { taper: 0 });
    const lab = L.labyrinth(SC.LAB.cx, SC.LAB.cy, SC.LAB.r, SC.LAB.rings, new L.Rand(SC.LAB.seed), SC.LAB.sy);
    dip(); for (const w of lab) pen(w, 1.1, { taper: 0.02, wob: 0.2 });
  }
  // ---------------- the planned ascent, dotted, running off the page ----------------
  for (let i = 0; i < SC.ASCENT.length - 1; i += 3) if (SC.ASCENT[i][0] < 1130) pen([SC.ASCENT[i], SC.ASCENT[i + 1]], 1.0, { taper: 0, wob: 0.1 });

  // ---------------- a single feather study, lower left ----------------
  {
    const base = [86, 1328], ang = -0.42, len = 470;
    const fd = feather(base, ang, len, 84, 0.05, { side: 1, barbGap: 1.7, notch: true, hatchTo: 0.6, quill: 1.6 });
    const rp = fd.rach;
    for (let k = 0; k < 6; k++) { const p = rp[2 + k], a = ang + Math.PI / 2; pen([[p[0] + Math.cos(a) * 6, p[1] + Math.sin(a) * 6], [p[0] - Math.cos(a) * 6 + 2, p[1] - Math.sin(a) * 6 + 1]], 0.6, { taper: 0.2 }); }
    wax(rp[5][0] + 1, rp[5][1] + 1, 10, 34);
    block(70, 1052, 420, 5.6, 3, 17);
  }
  // ---------------- the flock, sketched, heading for the edge of the page ----------------
  function bird(x, y, s, phase, rot) {
    const c = Math.cos(rot), sn = Math.sin(rot), T = ([px, py]) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s];
    const lift = Math.sin(phase), fold = 0.5 + 0.5 * Math.cos(phase);
    for (const sd of [-1, 1]) {
      const wing = L.catmull([[0, 0], [sd * 5, -4 - lift * 5], [sd * (11 + fold * 2), -2 - lift * 8], [sd * (19 + fold * 3), 2 - lift * 6 + fold * 3]], 8).map(T);
      ctx.fillStyle = L.css(INK, 0.85); ctx.globalCompositeOperation = 'multiply';
      L.ribbon(ctx, wing, (t) => (2.4 * (1 - t) ** 0.7 + 0.3) * s);
    }
    ctx.beginPath(); const h = T([0, 0.5]); ctx.ellipse(h[0], h[1], 2.2 * s, 1.5 * s, rot, 0, 7); ctx.fill();
    pen([T([0, 1]), T([-0.5, 5])], 0.9 * s, { taper: 0.4 });
  }
  for (const [x, y, ph] of SC.BIRDS) if (x < 1090) bird(x, y, 1.15, ph, -0.38 + Math.sin(ph) * 0.08);
  for (let k = 0; k < 6; k++) bird(85 + k * 50, 196 - k * 15 + Math.sin(k * 2) * 5, 1.05, k * 1.1, -0.28 + Math.sin(k) * 0.08);
  pen([[60, 225], [380, 112]], 0.4, { alpha: 0.35 });

  // ---------------- notes ----------------
  block(70, 900, 560, 6.5, 6, 21);
  block(380, 120, 540, 10, 1, 30, { alpha: 0.9 });
  block(470, 158, 450, 6.2, 3, 20);
  pen([[600, 190], [655, 330]], 0.45, { alpha: 0.6 });
  pen([[200, 960], [260, 760]], 0.45, { alpha: 0.6 });

  // ---------------- red chalk ----------------
  {
    const c = sparAt(0.555);
    const arc = []; for (let a = -0.4; a < 1.9; a += 0.01) arc.push([c[0] + Math.cos(a) * 455, c[1] + Math.sin(a) * 455]);
    chalk(arc, 1.6, 0.28);
    for (let k = 13; k < tips.length; k++) chalk([c, tips[k]], 1.1, 0.16);
    chalk([[30, 238], [1130, 238]], 1.2, 0.18);
    chalk([[95, 120], [95, 880]], 1.1, 0.15);
    const big = []; for (let a = 0; a < Math.PI * 2; a += 0.01) big.push([400 + Math.cos(a) * 330, 545 + Math.sin(a) * 330]);
    chalk(big, 1.4, 0.13);
    chalk(L.catmull([[640, 352], [790, 470], [905, 650], [930, 760]], 10), 2.2, 0.22);
    // the intended course, in chalk: a long, careful curve away to the right
    chalk(L.quad([972, 1436], [990, 1160], [1130, 1010], 40), 2, 0.25);
  }

  // ---------------- tear the page ----------------
  ctx.globalCompositeOperation = 'destination-in';
  const tp = []; for (let y = -20; y <= DH + 20; y += 2) tp.push([SC.tearX(y), y]);
  ctx.fillStyle = '#000'; L.path(ctx, tp.concat([[-20, DH + 20], [-20, -20]]), true); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // the torn edge shows the pale core of the sheet, and loose fibres
  {
    const inner = tp.map(([x, y]) => [x - 2.5 - 3.5 * (0.5 + 0.5 * N(y / 14, 9)), y]);
    ctx.fillStyle = 'rgba(247,240,224,0.95)'; L.path(ctx, tp.concat(inner.slice().reverse()), true); ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 1400; i++) {
      const y = R.r(-10, DH + 10), x = SC.tearX(y) - R.r(0, 2), a = R.gauss(0, 0.7), l = R.r(1, 4.5);
      ctx.strokeStyle = `rgba(250,244,230,${R.r(0.4, 0.85)})`; ctx.lineWidth = R.r(0.2, 0.45);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l * 0.6, y + R.gauss(0, 0.8), x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  }
  return Ly;
};
