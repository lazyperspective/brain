// Red fox, profile, head tilted up, gazing skyward with a smug half-lidded eye.
// Signature motion: a quick near-ear flick. Secondary: chest ruff breath (1 cell) + one slow blink.
(function () {
  // ---- palette ---------------------------------------------------------------------------
  const BG = 0, K = 1, D = 2, M = 3, L = 4, H = 5, W = 6, Y = 7;
  const PAL = [
    '#2446c8', // 0 cobalt / ultramarine background
    '#210d07', // 1 deep brown-black
    '#77280e', // 2 dark rust
    '#c9531a', // 3 mid rust-orange
    '#ee8b2f', // 4 light orange
    '#f9c58c', // 5 pale apricot highlight
    '#fcf1dc', // 6 cream
    '#ffb821', // 7 amber eye
  ];
  const FUR = [K, D, M, L, H];   // 5-tone fur ramp (index 0..4)
  const CRM = [D, M, L, H, W];   // cream fur, shaded with the light tones

  // ---- helpers ---------------------------------------------------------------------------
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s | 0) * 1442695041) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function vn(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function sdPoly(px, py, P) {
    let d = Infinity, s = 1;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const ax = P[j][0], ay = P[j][1], bx = P[i][0], by = P[i][1];
      const ex = bx - ax, ey = by - ay, wx = px - ax, wy = py - ay;
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
      const qx = wx - ex * t, qy = wy - ey * t;
      d = Math.min(d, qx * qx + qy * qy);
      const c1 = py >= ay, c2 = py < by, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  }
  function dLine(px, py, P) {
    let d = Infinity;
    for (let i = 1; i < P.length; i++) {
      const ax = P[i - 1][0], ay = P[i - 1][1], ex = P[i][0] - ax, ey = P[i][1] - ay, wx = px - ax, wy = py - ay;
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
      d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    }
    return d;
  }
  function sdEll(px, py, cx, cy, rx, ry) {
    const qx = (px - cx) / rx, qy = (py - cy) / ry;
    return (Math.hypot(qx, qy) - 1) * Math.min(rx, ry);
  }
  const dome = (sd, r) => (sd >= 0 ? -99 : r * Math.sqrt(clamp(-sd / r, 0, 1)));
  const smax = (a, b, k) => { const h = clamp(0.5 + 0.5 * (a - b) / k, 0, 1); return b + (a - b) * h + k * h * (1 - h); };
  function yAt(P, x) {
    if (x <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (x <= P[i][0]) {
      const t = (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t;
    }
    return P[P.length - 1][1];
  }
  function rotAbout(P, c, a) {
    if (!a) return P;
    const co = Math.cos(a), si = Math.sin(a);
    return P.map(([x, y]) => [c[0] + (x - c[0]) * co - (y - c[1]) * si, c[1] + (x - c[0]) * si + (y - c[1]) * co]);
  }

  // ---- head frame: local coords, snout along -x, y down, eye at origin ---------------------
  const ANG = 30 * Math.PI / 180, CA = Math.cos(ANG), SA = Math.sin(ANG), S = 1.52, EX = 50, EY = 91;
  const toL = (x, y) => { const dx = (x - EX) / S, dy = (y - EY) / S; return [dx * CA + dy * SA, -dx * SA + dy * CA]; };
  const toS = (lx, ly) => [EX + S * (lx * CA - ly * SA), EY + S * (lx * SA + ly * CA)];

  const HEAD = [
    [-31, 1.4], [-30.2, -0.9], [-26, -2.3], [-20, -3.5], [-14, -4.9], [-9.5, -6.6], [-5.5, -9.2], [0, -11.2],
    [6, -12.6], [12, -12.2], [17, -10], [21, -5], [23, 2], [22, 10], [14, 15], [4, 13.2], [-8, 10.8], [-18, 8.8],
    [-24.5, 7.4], [-27.5, 5.8], [-28.3, 4.6], [-30.6, 3.6]];
  const SNOUT = [[-31, 1.4], [-30.2, -0.9], [-20, -3.5], [-9.5, -6.6], [-2, -6], [0, 4], [-10, 6.4], [-20, 5.2], [-30.6, 3.6]];
  // top plane of snout + forehead (catches the light)
  const TOPLINE = [[-30.5, -0.6], [-26, -2.3], [-20, -3.5], [-14, -4.9], [-9.5, -6.6], [-5.5, -9.2], [0, -11.2], [6, -12.6], [11, -12.4]];
  // cheek ruff: pointed tufts sweeping back over the neck (apricot), cream only right under the eye
  const RUFF = [[-7, 4.4], [0, 3.4], [7, 3.6], [14, 5], [21, 6.5], [29, 9], [23, 10.8], [28.5, 15], [21, 15.2], [24, 19.5],
    [15, 17.5], [6, 14.5], [-4, 11], [-8, 7]];
  const CREAM = [[-7.5, 5.6], [-3, 4.4], [2, 4.2], [6, 5], [8, 7.5], [5, 9.5], [0, 9.4], [-5, 8.6]];
  // mouth: ends below the front of the eye with a small upturn
  const MOUTH = [[-28.6, 4.1], [-24, 4.7], [-17, 5.5], [-11, 6.1], [-8.2, 6.2], [-7, 5.4]];
  const mouthY = (lx) => yAt(MOUTH.slice(0, 5), lx);
  const TEAR = [[-5.6, 1.3], [-7.6, 2.4], [-9.6, 3.2]];

  const EAR_N = [[3.5, -11.5], [3, -18], [5.5, -26], [9.5, -31.5], [13, -35], [15, -28.5], [17, -21], [18.5, -13], [18.5, -7]];
  const EAR_IN = [[6.5, -13], [6.5, -19.5], [8.6, -25.5], [11.8, -30.5], [13.6, -25], [14.8, -18], [15.4, -11]];
  const EAR_F = [[-3, -9.5], [-3.2, -16.5], [-1.5, -24], [1.5, -30], [4.5, -24], [7, -16.5], [8, -10]];
  const EAR_PIV = [11, -9.5], EAR_TIP = [13, -35];
  // pale fluff strokes at the base of the inner ear (ear coords: a = along 0..1, u = across, + toward snout)
  const FLUFF = [[0.04, 1.8, 0.3, 2.1, W], [0.05, 0.4, 0.24, 0.6, H], [0.06, -1.0, 0.18, -0.9, H]];

  // neck & chest ruff (screen coords)
  const NECK = [[44, 100], [70, 86], [83, 94], [88, 107], [92, 122], [95, 138], [97, 153], [28, 153], [30, 141], [34, 127], [39, 113]];
  const CHEST = [[31, 133], [34, 129], [36, 134], [39, 130], [41, 136], [44, 133], [45, 140], [43, 146], [45, 153], [27, 153], [29, 144]];
  const neckFront = (y) => yAt(NECK.slice(7).reverse().map(([x, yy]) => [yy, x]), y);   // x of the front edge at y
  const neckBack = (y) => yAt(NECK.slice(1, 7).map(([x, yy]) => [yy, x]), y);          // x of the nape edge at y

  const LX = -0.5, LY = -0.62, LZ = 0.6;

  function sample(x, y, earA, breath) {
    const [lx, ly] = toL(x, y);
    const dEN = sdPoly(lx, ly, rotAbout(EAR_N, EAR_PIV, earA));
    const dHd = sdPoly(lx, ly, HEAD), dRf = sdPoly(lx, ly, RUFF);
    const r = { lx, ly, x, y, dHd, dRf };
    if (dEN < 0 && !(Math.min(dHd, dRf) < -2.5 && ly > -11.5)) { r.layer = 'earN'; r.h = 30; return r; }
    if (dHd < 0 || dRf < 0) {
      const dCr = sdEll(lx, ly, 14, -1, 22, 11.5), dSn = sdPoly(lx, ly, SNOUT), dCh = sdEll(lx, ly, 16, 6, 20, 9);
      let h = dome(dCr, 13) + 2;
      h = smax(h, dome(dSn, 6) + 1, 3);
      h = smax(h, dome(dCh, 9) + 1, 3);
      h = Math.max(h, dome(Math.min(dHd, dRf), 3));
      r.layer = 'head'; r.h = 20 + h; return r;
    }
    if (sdPoly(lx, ly, EAR_F) < 0) { r.layer = 'earF'; r.h = 24; return r; }
    const dNk = sdPoly(x, y, NECK);
    if (dNk < 0) {
      r.layer = 'neck'; r.dNk = dNk; r.dCs = sdPoly(x, y + breath, CHEST); r.h = 14 + dome(dNk, 3);
      return r;
    }
    return null;
  }

  // ---- eye: hand-placed pixel map (screen space), the focal point -------------------------
  // k near-black  p pupil  l shaded amber (under the heavy smug lid)  y amber  w specular  . leave fur
  const EYE = [
    '......dkkkkkd......',
    '...kkkkkkkkkkkkd...',
    '.kkkllllplllllkkkk.',
    'kkyyyyywpyyyyyyykkk',
    '.kkyyyyypyyyyyyyk..',
    '..kyyyyypyyyyyyyk..',
    '...kyyyypyyyyyykk..',
    '....kkyyyyyyykk....',
    '......kkkkkkk......',
  ];
  const EYE_X = EX - 9, EYE_Y = EY - 4;
  function drawEye(g, lid) {
    // lid: 0 = open (smug half-lid), 1 = closed. The lid edge sweeps down over rows 2..7.
    const lidRow = 2 + Math.round(lid * 6);
    for (let r = 0; r < EYE.length; r++) for (let c = 0; c < EYE[r].length; c++) {
      const ch = EYE[r][c]; if (ch === '.') continue;
      let col = { k: K, d: D, l: L, y: Y, w: W, p: K }[ch];
      // closing lid: orange fur above a dark lash line
      if (lid > 0 && r >= 2 && r < 8 && ch !== 'k' && ch !== 'd') col = r < lidRow - 1 ? (r < 3 ? D : M) : r === lidRow - 1 ? K : col;
      g.set(EYE_X + c, EYE_Y + r, col);
    }
  }

  const big2 = (lx, ly) => (vn(lx / 2, ly / 3, 17) - 0.5) * 3;
  const RANK = [9, 0, 1, 2, 3, 4, 5, 9];   // darkness order of palette indices (bg / eye excluded)
  const q = (v) => FUR[clamp(Math.floor(v * 5), 0, 4)];

  function draw(g, t) {
    // ---- animation ----
    let earA = 0;
    const te = t - 1.4 + 0.016;                   // ear flick (30 fps): 2 frames back, 1 half way, 1 rebound, settle
    if (te >= 0 && te < 0.066) earA = 0.16;
    else if (te >= 0.066 && te < 0.1) earA = 0.07;
    else if (te >= 0.1 && te < 0.133) earA = -0.03;
    const breath = Math.sin(2 * Math.PI * t / 6) > 0 ? 1 : 0;     // chest ruff up 1 cell for half the loop
    let lid = 0; const tb = t - 4.1;               // one slow blink
    if (tb >= 0 && tb < 0.7) lid = tb < 0.2 ? tb / 0.2 : tb < 0.35 ? 1 : 1 - (tb - 0.35) / 0.35;

    const GW = g.w, GH = g.h, PW = GW + 2;
    const info = new Array(GW * GH), hf = new Float32Array(PW * (GH + 2)).fill(-1);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const s = sample(x, y, earA, breath);
      info[y * GW + x] = s; hf[(y + 1) * PW + x + 1] = s ? s.h : -1;
    }
    const earIn = rotAbout(EAR_IN, EAR_PIV, earA);
    const [tipX, tipY] = rotAbout([EAR_TIP], EAR_PIV, earA)[0];
    const ax = tipX - EAR_PIV[0], ay = tipY - EAR_PIV[1], al = Math.hypot(ax, ay);
    const P = g.a;

    // ---- 1. big tonal masses ----
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const s = info[y * GW + x]; if (!s) continue;
      const hc = s.h, nb = (xx, yy) => {
        const v = hf[(yy + 1) * PW + xx + 1];
        if (v < 0) return hc - 1.5;
        const o = info[clamp(yy, 0, GH - 1) * GW + clamp(xx, 0, GW - 1)];
        return o && o.layer !== s.layer ? hc : v;
      };
      const gx = (nb(x + 1, y) - nb(x - 1, y)) * 0.32, gy = (nb(x, y + 1) - nb(x, y - 1)) * 0.32;
      let lit = (-gx * LX - gy * LY + LZ) / Math.hypot(gx, gy, 1) - LZ;
      if (lit < 0) lit *= 0.5;
      const { lx, ly } = s;
      let c;
      if (s.layer === 'head') {
        const big = vn(lx / 6, ly / 2.6, 1) - 0.5;                 // low-frequency patch noise only
        const my = mouthY(lx), below = ly - my;
        if (lx < -7.6 && below > 0.5) {
          // lower jaw: a narrow white lip/chin line, then the dark underside
          c = below < 1.7 + big * 0.8 && lx < -11 ? (lx < -21 ? W : H) : below < 1.7 && lx >= -11 ? M
            : lx < -19 + big * 4 ? M : (lx > -12 && below > 3.4 + big * 2 ? K : D);
        } else if (sdPoly(lx, ly, CREAM) + big * 2.2 < 0) {
          c = lit < -0.08 ? L : (big > 0.12 ? H : W);              // small cream cheek tuft under the eye
        } else if (s.dRf < 0 && ly > 4) {
          // apricot ruff, shading down to light orange then rust on its lower, shadowed side
          const v = 0.78 + lit * 0.6 + big * 0.35 - clamp((ly - 9) / 9, 0, 1) * 0.35 - clamp((lx - 14) / 14, 0, 1) * 0.15;
          c = q(v);
        } else {
          const top = clamp(1 - dLine(lx, ly, TOPLINE) / (lx < -8 ? 2.4 : 3.6), 0, 1);
          let v = 0.5 + top * 0.42 + lit * 0.55 + big * 0.24;
          if (lx < -7 && ly > my - 2.2) v -= 0.12;                  // lower muzzle side, toward the mouth
          v -= clamp((lx - 12) / 10, 0, 1) * 0.12;                   // back of the head, under the ear
          v -= clamp((ly - 6) / 6, 0, 1) * 0.3;                      // cheek rolls under into shadow
          c = q(v);
        }
      } else if (s.layer === 'earN') {
        const a = ((lx - EAR_PIV[0]) * ax + (ly - EAR_PIV[1]) * ay) / (al * al);
        const u = ((lx - EAR_PIV[0]) * ay - (ly - EAR_PIV[1]) * ax) / al;
        const inner = sdPoly(lx, ly, earIn);
        const big = vn(a * 6, u / 3, 3) - 0.5;
        if (a > 0.8 + big * 0.06) c = K;                                       // black tip
        else if (inner < 0) c = (inner > -1.1 && u > 0) || a < 0.3 + big * 0.15 ? M : (a > 0.66 + big * 0.1 ? K : D);  // rust inner ear
        else if (u > 0) c = (a < 0.7 && inner > 1.4 + big) ? H : L;           // lit outer (front) edge
        else c = a > 0.55 ? K : D;                                            // thin dark back rim
        s.a = a; s.u = u;
      } else if (s.layer === 'earF') {
        const dEF = sdPoly(lx, ly, EAR_F);
        c = ly < -21 + big2(lx, ly) ? K : (dEF > -1.1 && lx < 0 && ly > -17 ? M : D);   // far ear: dark, simpler
      } else {
        const big = vn(x / 7, y / 5, 5) - 0.5, rag = vn(x / 2.4, y / 1.8, 9);
        const fx = neckFront(y), bx = neckBack(y);
        const u = (x - fx) / Math.max(1, bx - fx);                 // 0 front .. 1 nape
        const dh = Math.min(s.dHd, s.dRf) * S;                     // distance below the head
        let v = 0.52 + big * 0.2 + (u < 0.12 + rag * 0.06 ? 0.22 : 0);
        if (u > 0.74 - y * 0.0012 + rag * 0.08) v = 0.28;          // shadow side of the neck
        if (dh < 8 + rag * 4) v = 0.28;                            // big shadow cast by the raised head
        if (dh < 2.2 + rag * 1.2 || (u > 0.93 && rag > 0.45)) v = 0.1;   // deepest fold / shadowed edge
        if (s.dCs < 0) v = 0.86 + big * 0.3;                       // chest ruff
        else if (y > 139 + vn(x / 7, 0, 10) * 5 && v > 0.2) v = u > 0.72 ? 0.28 : u < 0.14 ? 0.7 : 0.5;   // flat body
        c = s.dCs < 0 ? (v > 0.9 ? W : H) : q(v);
      }
      P[y * GW + x] = c;
    }

    // ---- 2. tidy: no isolated single stitches ----
    for (let pass = 0; pass < 2; pass++) {
      const src = P.slice();
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
        const i = y * GW + x, c = src[i]; if (c === BG) continue;
        const n = [src[i - 1], src[i + 1], src[i - GW], src[i + GW]];
        if (n.some((v) => v === c)) continue;
        const cnt = {}; let best = -1, bn = 0;
        for (const v of n) if (v !== BG) { cnt[v] = (cnt[v] || 0) + 1; if (cnt[v] > bn) { bn = cnt[v]; best = v; } }
        if (best >= 0) P[i] = best;
      }
    }

    // ---- 3. fur strokes only along edges and folds: a darker mass combs out into the lighter one ----
    const isFur = (i) => info[i] && (info[i].layer === 'head' || info[i].layer === 'neck');
    for (let y = 2; y < GH - 2; y += 2) for (let x = 2; x < GW - 2; x += 2) {
      const sx = x + (hash(x, y, 41) * 2 | 0), sy = y + (hash(x, y, 42) * 2 | 0), i = sy * GW + sx;
      if (!isFur(i) || hash(x, y, 43) > 0.55) continue;
      const s = info[i];
      let dx, dy;
      if (s.layer === 'neck') { dx = 0.3; dy = 1; }
      else { const cv = s.ly > 3 ? 0.45 : 0.08; dx = CA - cv * SA; dy = SA + cv * CA; }
      const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
      const ux = Math.round(sx - dx * 2), uy = Math.round(sy - dy * 2), ui = uy * GW + ux;
      if (!isFur(ui)) continue;
      const cu = P[ui], cs = P[i];
      if (RANK[cu] >= RANK[cs] || RANK[cu] > 5 || RANK[cs] > 5 || RANK[cs] - RANK[cu] > 2) continue;
      const len = 2 + (hash(x, y, 44) * 3 | 0);
      let px = sx, py = sy;
      for (let k = 0; k < len; k++) {
        const nx = Math.round(sx + dx * k), ny = Math.round(sy + dy * k);
        if (nx !== px && ny !== py) { const j = py * GW + nx; if (isFur(j) && RANK[P[j]] > RANK[cu]) P[j] = cu; }   // keep 4-connected
        const j = ny * GW + nx; if (!isFur(j) || RANK[P[j]] <= RANK[cu]) break;
        P[j] = cu; px = nx; py = ny;
      }
    }

    // ---- 4. details ----
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const s = info[y * GW + x]; if (!s) continue;
      const { lx, ly } = s;
      if (s.layer !== 'head') continue;
      const dn = sdEll(lx, ly, -29.4, 1.3, 2.5, 2.3);
      if (dn < 0) { g.set(x, y, (lx < -29.5 && lx > -30.8 && ly < 0.4 && ly > -0.8) ? D : K); continue; }   // nose
      const dm = dLine(lx, ly, MOUTH);
      if (dm < 0.55 && lx > -27.5) { g.set(x, y, K); continue; }                 // mouth, smug upturn at the corner
      if (dLine(lx, ly, TEAR) < 0.55) { g.set(x, y, D); continue; }              // short fox tear line
    }
    // pale fluff strokes at the base of the near ear
    for (const [a0, u0, a1, u1, col] of FLUFF) {
      for (let k = 0; k <= 8; k++) {
        const a = a0 + (a1 - a0) * k / 8, u = u0 + (u1 - u0) * k / 8;
        const lx = EAR_PIV[0] + ax * a + (ay / al) * u, ly = EAR_PIV[1] + ay * a - (ax / al) * u;
        const [sx, sy] = toS(lx, ly), i = Math.round(sy) * GW + Math.round(sx);
        if (info[i] && info[i].layer === 'earN' && sdPoly(lx, ly, earIn) < 0) { P[i] = col; if (info[i + GW] && info[i + GW].layer === 'earN') P[i + GW] = col; }
      }
    }
    drawEye(g, lid);
  }

  window.ANIMAL = { name: 'fox', loop: 6, bg: BG, palette: PAL, draw };
})();
