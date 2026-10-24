// I. THE DESIGN — a Renaissance notebook page: iron-gall ink, sepia wash and
// red chalk on laid paper. Intimate, cerebral, hopeful. The flight diagram at the
// lower left quietly maps the whole carousel: I (the labyrinth) → II → III (the
// sun) → IV (the sea).
window.paint = async function (canvas, W, H) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const S = W / 1000, DH = H / S;
  const R = new L.Rand(1503), N = L.noise2(41), N2 = L.noise2(42), N3 = L.noise2(43);

  const INK = [52, 33, 18], SEPIA = [140, 96, 52], CHALK = [178, 78, 52], AMBER = [214, 146, 46];

  // ---------------- paper ----------------
  const paper = L.canvas(W, H);
  {
    const px = paper.getContext('2d');
    const img = px.createImageData(W, H), d = img.data;
    const base = L.hex('#eadcbf'), warm = L.hex('#d9c193'), edge = L.hex('#a98454'), cool = L.hex('#e6dcc8');
    for (let y = 0; y < H; y++) {
      const uy = y / S;
      const laid = 1 + 0.012 * Math.sin(uy * Math.PI * 2 / 1.25);
      for (let x = 0; x < W; x++) {
        const ux = x / S;
        const f = L.fbm(N, ux / 420, uy / 420, 5);
        const f2 = L.fbm(N2, ux / 90, uy / 90, 3);
        let c = L.mix(base, warm, 0.55 * L.smooth(-0.5, 0.8, f + 0.25 * f2));
        c = L.mix(c, cool, L.smooth(0.25, 0.7, -f) * 0.5);
        // edges: darkened, warped, slightly burnt
        const de = Math.min(ux, 1000 - ux, uy, DH - uy) + L.fbm(N3, ux / 220, uy / 220, 3) * 45 + L.fbm(N3, ux / 25, uy / 25, 2) * 4;
        const e = 1 - L.smooth(-10, 120, de);
        c = L.mix(c, edge, e * e * e * 0.55);
        // water-stain tide line, upper right
        const rr = Math.hypot(ux - 880, uy - 1180) + L.fbm(N2, ux / 70, uy / 70, 3) * 40;
        const tide = Math.exp(-(((rr - 250) / 9) ** 2)) * 0.35 + (rr < 250 ? 0.06 : 0);
        c = L.mix(c, warm, tide);
        // chain lines of hand-laid paper
        const chain = Math.exp(-(((ux % 27.5) - 13.7) ** 2) / 0.5) * 0.02;
        const k = laid - chain;
        const g = (R.next() - 0.5) * 7;
        const i = (y * W + x) * 4;
        d[i] = c[0] * k + g; d[i + 1] = c[1] * k + g; d[i + 2] = c[2] * k + g * 0.8; d[i + 3] = 255;
      }
    }
    px.putImageData(img, 0, 0);
    px.setTransform(S, 0, 0, S, 0, 0);
    // fibres
    for (let i = 0; i < 2600; i++) {
      const x = R.r(0, 1000), y = R.r(0, DH), a = R.r(0, Math.PI * 2), l = R.r(2, 9);
      px.strokeStyle = R.chance(0.5) ? 'rgba(255,250,235,0.18)' : 'rgba(120,90,50,0.07)';
      px.lineWidth = R.r(0.2, 0.5);
      px.beginPath(); px.moveTo(x, y); px.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); px.stroke();
    }
    // foxing
    px.globalCompositeOperation = 'multiply';
    for (let c = 0; c < 14; c++) {
      const cx = R.r(0, 1000), cy = R.r(0, DH), cnt = R.int(3, 14);
      for (let i = 0; i < cnt; i++) {
        const x = cx + R.gauss(0, 18), y = cy + R.gauss(0, 18), r = R.r(0.8, 4.5);
        const g = px.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(150,95,45,${R.r(0.15, 0.4)})`); g.addColorStop(1, 'rgba(150,95,45,0)');
        px.fillStyle = g; px.beginPath(); px.arc(x, y, r, 0, Math.PI * 2); px.fill();
      }
    }
    // a soft vertical fold
    const fg = px.createLinearGradient(492, 0, 512, 0);
    fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.45, 'rgba(160,125,80,0.10)'); fg.addColorStop(0.55, 'rgba(255,255,255,0)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
    px.fillStyle = fg; px.fillRect(490, 0, 25, DH);
  }
  ctx.drawImage(paper, 0, 0);
  const paperFill = ctx.createPattern(paper, 'no-repeat');
  paperFill.setTransform(new DOMMatrix([1 / S, 0, 0, 1 / S, 0, 0]));
  ctx.setTransform(S, 0, 0, S, 0, 0);

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

  // ---------------- middle band: spar section sketch + notes ----------------
  {
    // a bound rod section in perspective
    const cx = 790, cy = 965, rw = 34, rl = 150, ang = -0.35;
    const ax = Math.cos(ang), ay = Math.sin(ang), nx = -ay, ny = ax;
    const ell = (t, sx = 1) => { const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; pts.push([cx + ax * t + ax * Math.cos(a) * rw * 0.3 * sx + nx * Math.sin(a) * rw, cy + ay * t + ay * Math.cos(a) * rw * 0.3 * sx + ny * Math.sin(a) * rw]); } return pts; };
    const top = [[cx - ax * rl / 2 + nx * rw, cy - ay * rl / 2 + ny * rw], [cx + ax * rl / 2 + nx * rw, cy + ay * rl / 2 + ny * rw]];
    const bot = [[cx - ax * rl / 2 - nx * rw, cy - ay * rl / 2 - ny * rw], [cx + ax * rl / 2 - nx * rw, cy + ay * rl / 2 - ny * rw]];
    const body = [top[0], top[1], bot[1], bot[0]];
    wash(body, 0.1);
    hatch([[cx - ax * rl / 2 + nx * rw * 0.1, cy - ay * rl / 2 + ny * rw * 0.1], [cx + ax * rl / 2 + nx * rw * 0.1, cy + ay * rl / 2 + ny * rw * 0.1], top[1], top[0]], -2.06, 2.2, 0.45, 0.4, false);
    hatch([[cx - ax * rl / 2 + nx * rw * 0.6, cy - ay * rl / 2 + ny * rw * 0.6], [cx + ax * rl / 2 + nx * rw * 0.6, cy + ay * rl / 2 + ny * rw * 0.6], top[1], top[0]], -2.06, 2.0, 0.4, 0.4, true);
    dip(); pen(top, 1.2); pen(bot, 1.1);
    pen(ell(-rl / 2), 0.9, { taper: 0 });
    const e2 = ell(rl / 2); pen(e2.slice(10, 31), 0.9, { taper: 0 });
    // wood rings on the cut end
    for (let r = 0.25; r < 1; r += 0.22) { const pts = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI * 2; pts.push([cx - ax * rl / 2 + ax * Math.cos(a) * rw * 0.3 * r + nx * Math.sin(a) * rw * r, cy - ay * rl / 2 + ay * Math.cos(a) * rw * 0.3 * r + ny * Math.sin(a) * rw * r]); } pen(pts, 0.35, { alpha: 0.6, taper: 0 }); }
    // spiral thread binding
    const th = [];
    for (let t = -30; t <= 30; t += 0.5) { const a = t * 0.55; th.push([cx + ax * t + ax * Math.cos(a) * rw * 0.3 + nx * Math.sin(a) * rw * 1.04, cy + ay * t + ay * Math.cos(a) * rw * 0.3 + ny * Math.sin(a) * rw * 1.04, Math.cos(a)]); }
    for (let i = 1; i < th.length; i++) if (th[i][2] > -0.1) pen([[th[i - 1][0], th[i - 1][1]], [th[i][0], th[i][1]]], 0.8, { taper: 0, wob: 0.1 });
    wax(cx + ax * 4 - nx * 26, cy + ay * 4 - ny * 26, 7, 16);
    pen([[cx - 30, cy + 54], [cx - 70, cy + 92]], 0.5, { alpha: 0.7 });
    scriptLine(560, 1068, 170, 6, { short: 3 });
  }
  block(70, 900, 560, 6.5, 6, 21);

  // ---------------- flight diagram (lower left) ----------------
  ctx.save(); ctx.translate(40, 1650); ctx.scale(1.16, 1.16); ctx.translate(-40, -1650);
  {
    // the middle course, as instructed — two dashed guide lines
    for (const y of [1365, 1430]) {
      const segs = []; for (let x = 60; x < 470; x += 9) segs.push([x, y + N(x * 0.01, y) * 1.5, x + 5, y + N((x + 5) * 0.01, y) * 1.5]);
      lines(segs, 0.6, 0.55);
    }
    hatch([[60, 1366], [470, 1366], [470, 1429], [60, 1429]], -2.36 + 0.3, 6, 0.12, 0.35);
    // sea
    for (let r = 0; r < 4; r++) {
      const y = 1572 + r * 11, pts = [];
      for (let x = 58 + r * 9; x < 474 - r * 6; x += 2) pts.push([x, y + 2.4 * Math.sin(x * 0.14 + r * 1.7) + 1.2 * Math.sin(x * 0.05 + r)]);
      pen(pts, 0.75 - r * 0.1, { alpha: 0.85 - r * 0.15 });
    }
    // labyrinth
    const lab = L.labyrinth(118, 1497, 44, 7, R);
    cover(L.blob(118, 1497, 47, R, 0.02)); wash(L.blob(118, 1497, 47, R, 0.03), 0.1);
    dip(); for (const w of lab) pen(w, 0.95, { taper: 0.02, wob: 0.25 });
    // the sun and its forbidden zone
    const sx = 372, sy = 1205;
    const ring = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 2; ring.push([sx + Math.cos(a) * 74, sy + Math.sin(a) * 74]); }
    const ringIn = []; for (let i = 80; i >= 0; i--) { const a = i / 80 * Math.PI * 2; ringIn.push([sx + Math.cos(a) * 34, sy + Math.sin(a) * 34]); }
    hatch(ring.concat(ringIn), -2.06, 2.6, 0.32, 0.4);
    hatch(ring.concat(ringIn), -0.6, 3.4, 0.22, 0.4);
    { const segs = []; for (let i = 0; i < 80; i += 2) { const a = i / 80 * Math.PI * 2, b = (i + 1) / 80 * Math.PI * 2; segs.push([sx + Math.cos(a) * 75, sy + Math.sin(a) * 75, sx + Math.cos(b) * 75, sy + Math.sin(b) * 75]); } lines(segs, 0.7, 0.75); }
    cover(L.blob(sx, sy, 33, R, 0.01));
    wash(L.blob(sx, sy, 24, R, 0.02), 0.25, AMBER);
    pen(L.blob(sx, sy, 22, R, 0.015, 50).concat([L.blob(sx, sy, 22, R, 0, 50)[0]]), 1.2, { taper: 0 });
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, r1 = k % 2 ? 31 : 38;
      if (k % 3 === 0) { const pts = []; for (let r = 26; r < r1 + 4; r += 1) pts.push([sx + Math.cos(a + Math.sin(r * 0.6) * 0.04) * r, sy + Math.sin(a + Math.sin(r * 0.6) * 0.04) * r]); pen(pts, 0.6, { taper: 0.3 }); }
      else pen([[sx + Math.cos(a) * 26, sy + Math.sin(a) * 26], [sx + Math.cos(a) * r1, sy + Math.sin(a) * r1]], 0.6, { taper: 0.3 });
    }
    // the flight path: a calm dotted ascent… then a broken fall
    const up = L.quad([128, 1470], [170, 1150], [338, 1220], 80);
    for (let i = 0; i < up.length - 1; i += 3) pen([up[i], up[i + 1]], 0.9, { taper: 0, wob: 0.1 });
    const down = [[350, 1240]];
    for (let k = 1; k <= 14; k++) { const t = k / 14; down.push([350 + 90 * t ** 0.7 + (k % 2 ? 10 : -8) * (1 - t), 1240 + 325 * t ** 1.4]); }
    const dsm = L.catmull(down, 4);
    for (let i = 0; i < dsm.length - 1; i += 2) pen([dsm[i], dsm[i + 1]], 0.85, { taper: 0, wob: 0.1 });
    // splash
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.32; pen([[442 + Math.cos(a) * 5, 1566 + Math.sin(a) * 5], [442 + Math.cos(a) * 14, 1566 + Math.sin(a) * 14]], 0.6, { taper: 0.3 }); }
    // tiny winged figures along the way
    const glyph = (x, y, s, rot) => { const c = Math.cos(rot), sn = Math.sin(rot), T = (px, py) => [x + px * c - py * sn, y + px * sn + py * c]; pen([T(-7 * s, -3 * s), T(-3 * s, -1 * s), T(0, 1.5 * s), T(3 * s, -1 * s), T(7 * s, -3 * s)], 0.7, { taper: 0.2 }); ctx.fillStyle = L.css(INK, 0.85); const h = T(0, -1.5 * s); ctx.beginPath(); ctx.arc(h[0], h[1], 1.1 * s, 0, 7); ctx.fill(); };
    glyph(186, 1300, 1.2, -0.7); glyph(372, 1205, 1.1, 0); glyph(420, 1450, 1, 2.2);
    // a feather loosed in the fall
    const fpts = L.quad([400, 1330], [412, 1338], [416, 1352], 10); pen(fpts, 0.6); for (let i = 2; i < 10; i++) pen([fpts[i], [fpts[i][0] + 3, fpts[i][1] - 1.5]], 0.3, { alpha: 0.6 });
    // numerals: the sequence of the carousel
    numeral('I', 92, 1450, 13); numeral('II', 156, 1290, 13); numeral('III', 300, 1135, 13); numeral('IV', 452, 1545, 13);
    block(255, 1460, 160, 5.5, 3, 17);
  }
  ctx.restore();

  // ---------------- single feather detail (lower right) ----------------
  {
    const base = [612, 1650], ang = -1.05, len = 600;
    const fd = feather(base, ang, len, 92, 0.05, { side: 1, barbGap: 1.7, notch: true, hatchTo: 0.6, quill: 1.7 });
    // a cross-section of the quill
    const qx = 905, qy = 1500;
    pen(L.blob(qx, qy, 12, R, 0.02, 40).concat([L.blob(qx, qy, 12, R, 0, 40)[0]]), 1, { taper: 0 });
    pen(L.blob(qx, qy, 7, R, 0.04, 30).concat([L.blob(qx, qy, 7, R, 0, 30)[0]]), 0.6, { taper: 0 });
    hatch(L.blob(qx, qy, 11.5, R, 0.01), -2.06, 1.4, 0.4, 0.35);
    cover(L.blob(qx, qy, 6.8, R, 0.03));
    // thread lashing at the calamus, sealed with wax that has run down the page
    const rp = fd.rach;
    for (let k = 0; k < 6; k++) {
      const p = rp[2 + k], a = ang + Math.PI / 2;
      pen([[p[0] + Math.cos(a) * 6, p[1] + Math.sin(a) * 6], [p[0] - Math.cos(a) * 6 + 2, p[1] - Math.sin(a) * 6 + 1]], 0.6, { taper: 0.2 });
    }
    wax(rp[5][0] + 1, rp[5][1] + 1, 10, 48);
    // scale bar
    const bx = 950;
    pen([[bx, 1130], [bx, 1650]], 0.7, { alpha: 0.7 });
    for (let y = 1130, k = 0; y <= 1650; y += 26, k++) pen([[bx - (k % 5 ? 4 : 9), y], [bx, y]], 0.5, { alpha: 0.7 });
    block(700, 1600, 210, 5.5, 3, 17);
    block(560, 1125, 190, 5.5, 4, 17);
  }

  // ---------------- flight studies: small birds in sequence ----------------
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
  for (let k = 0; k < 6; k++) bird(85 + k * 50, 196 - k * 15 + Math.sin(k * 2) * 5, 1.05, k * 1.1, -0.28 + Math.sin(k) * 0.08);
  pen([[60, 225], [380, 112]], 0.4, { alpha: 0.35 });
  for (let k = 0; k < 4; k++) bird(560 + k * 40, 1185 - k * 26, 0.95, 2 + k * 1.4, -0.7);

  // ---------------- headings and margins ----------------
  block(380, 120, 560, 10, 1, 30, { alpha: 0.9 });
  block(470, 158, 470, 6.2, 3, 20);
  block(60, 1700, 460, 6, 2, 21);
  // leader lines from notes to parts
  pen([[600, 190], [655, 330]], 0.45, { alpha: 0.6 });
  pen([[200, 960], [260, 760]], 0.45, { alpha: 0.6 });

  // ---------------- red-chalk underdrawing (shows through everything) ----------------
  {
    const c = sparAt(0.555);
    const arc = []; for (let a = -0.4; a < 1.9; a += 0.01) arc.push([c[0] + Math.cos(a) * 455, c[1] + Math.sin(a) * 455]);
    chalk(arc, 1.6, 0.28);
    for (let k = 13; k < tips.length; k++) chalk([c, tips[k]], 1.1, 0.16);
    chalk([[30, 238], [970, 238]], 1.2, 0.18);
    chalk([[95, 120], [95, 880]], 1.1, 0.15);
    const big = []; for (let a = 0; a < Math.PI * 2; a += 0.01) big.push([400 + Math.cos(a) * 330, 545 + Math.sin(a) * 330]);
    chalk(big, 1.4, 0.13);
    // loose pentimento of a second, larger wing tip
    chalk(L.catmull([[640, 352], [790, 470], [905, 650], [930, 760]], 10), 2.2, 0.22);
    chalk(L.catmull([[930, 760], [860, 790], [800, 800]], 10), 2.0, 0.2);
    for (let y = 1110; y < 1700; y += 4) if (R.chance(0.5)) chalk([[R.r(500, 530), y], [R.r(500, 530) + 10, y - 9]], 0.9, 0.1);
  }

  // ---------------- final unity: warm tone + vignette ----------------
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.45, W * 0.3, W * 0.5, H * 0.5, W * 1.15);
  vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(150,110,65,0.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
};
