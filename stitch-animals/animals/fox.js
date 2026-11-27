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
  const ANG = 30 * Math.PI / 180, CA = Math.cos(ANG), SA = Math.sin(ANG), S = 1.52, EX = 50, EY = 87;
  const toL = (x, y) => { const dx = (x - EX) / S, dy = (y - EY) / S; return [dx * CA + dy * SA, -dx * SA + dy * CA]; };
  const toS = (lx, ly) => [EX + S * (lx * CA - ly * SA), EY + S * (lx * SA + ly * CA)];

  const HEAD = [
    [-31, 1.4], [-30.2, -0.9], [-26, -2.3], [-20, -3.5], [-14, -4.9], [-9.5, -6.6], [-5.5, -9.2], [0, -11.2],
    [6, -12.6], [12, -12.2], [17, -10], [21, -5], [23, 2], [22, 10], [14, 15], [4, 13.2], [-8, 10.8], [-18, 8.8],
    [-24.5, 7.4], [-27.5, 5.8], [-28.3, 4.6], [-30.6, 3.6]];
  const SNOUT = [[-31, 1.4], [-30.2, -0.9], [-20, -3.5], [-9.5, -6.6], [-2, -6], [0, 4], [-10, 6.4], [-20, 5.2], [-30.6, 3.6]];
  const JAW = [[-28.3, 4.6], [-20, 5.3], [-8, 6.8], [2, 7], [6, 12], [-8, 10.8], [-18, 8.8], [-24.5, 7.4], [-27.5, 5.8]];
  // white cheek with a pointed ruff tuft sweeping back over the neck
  const CHEEK = [[-7, 4.4], [0, 3.4], [7, 3.6], [14, 5], [21, 6.5], [29, 9], [23, 10.8], [28.5, 15], [21, 15.2], [24, 19.5],
    [15, 17.5], [6, 14.5], [-4, 11], [-8, 7]];
  const MOUTH = [[-29.8, 3.9], [-24, 4.6], [-16, 5.5], [-9, 6.5], [-5.5, 6.7], [-4, 5.9]];
  const TEAR = [[-5.2, 1.4], [-7.8, 2.6], [-10.5, 3.6], [-12.5, 4.1]];
  const LIP_TOP = [[-31, 3.4], [-20, 4.6], [-9, 5.6], [-4, 5.4]];

  const EAR_N = [[3.5, -11.5], [2.5, -18], [5, -26], [9, -32], [13, -36.5], [15.5, -29], [17.5, -21], [19, -13], [18.5, -7]];
  const EAR_IN = [[6, -13], [5.8, -19.5], [8, -26], [11.8, -32], [14, -25], [15.3, -18], [15.8, -11]];
  const EAR_F = [[-3, -9.5], [-3.5, -17], [-1.5, -25], [1.5, -32.5], [5, -25], [7.5, -17], [8, -10]];
  const EAR_PIV = [11, -9.5], EAR_TIP = [13, -36.5];

  // neck & chest ruff (screen coords)
  const NECK = [[44, 96], [70, 82], [83, 90], [88, 104], [92, 120], [95, 137], [97, 153], [28, 153], [30, 140], [34, 125], [39, 110]];
  const CHEST = [[31, 131], [34, 127], [36, 132], [39, 128], [41, 134], [44, 131], [45, 138], [43, 145], [45, 153], [27, 153], [29, 142]];

  const LX = -0.5, LY = -0.62, LZ = 0.6;

  function sample(x, y, earA, breath) {
    const [lx, ly] = toL(x, y);
    const earN = rotAbout(EAR_N, EAR_PIV, earA);
    const dEN = sdPoly(lx, ly, earN);
    const dHd = sdPoly(lx, ly, HEAD), dCk = sdPoly(lx, ly, CHEEK);
    const r = { lx, ly, x, y, dHd, dCk };
    if (dEN < 0 && !(Math.min(dHd, dCk) < -2.5 && ly > -11.5)) {
      r.layer = 'earN'; r.dEN = dEN; r.h = 30 + dome(dEN, 2.5); return r;
    }
    if (dHd < 0 || dCk < 0) {
      const dCr = sdEll(lx, ly, 14, -1, 22, 11.5);
      const dSn = sdPoly(lx, ly, SNOUT), dJw = sdPoly(lx, ly, JAW), dCh = sdEll(lx, ly, 16, 6, 20, 9);
      let h = dome(dCr, 13) + 2;
      h = smax(h, dome(dSn, 6) + 1, 3);
      h = smax(h, dome(dCh, 9) + 1, 3);
      h = Math.max(h, dome(dJw, 3) - 1.5);
      h = Math.max(h, dome(Math.min(dHd, dCk), 3));
      r.layer = 'head'; r.h = 20 + h; r.dSn = dSn; r.dJw = dJw; return r;
    }
    const dEF = sdPoly(lx, ly, EAR_F);
    if (dEF < 0) { r.layer = 'earF'; r.h = 24 + dome(dEF, 2); r.dEF = dEF; return r; }
    const dNk = sdPoly(x, y, NECK);
    if (dNk < 0) {
      const u = clamp((x - 29) / 68, 0, 1);
      r.layer = 'neck'; r.dNk = dNk; r.dCs = sdPoly(x, y + breath, CHEST);
      r.h = 14 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1.1, 2))) + dome(dNk, 3);
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
    const tone = new Int8Array(GW * GH).fill(-1);
    const ramp = new Array(GW * GH);
    const earN = rotAbout(EAR_N, EAR_PIV, earA), earIn = rotAbout(EAR_IN, EAR_PIV, earA);
    const [tipX, tipY] = rotAbout([EAR_TIP], EAR_PIV, earA)[0];
    const ax = tipX - EAR_PIV[0], ay = tipY - EAR_PIV[1], al = Math.hypot(ax, ay);

    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const s = info[y * GW + x]; if (!s) continue;
      const hc = s.h, nb = (xx, yy) => {
        const v = hf[(yy + 1) * PW + xx + 1];
        if (v < 0) return hc - 1.5;
        const o = info[clamp(yy, 0, GH - 1) * GW + clamp(xx, 0, GW - 1)];
        return o && o.layer !== s.layer ? hc : v;
      };
      const gx = (nb(x + 1, y) - nb(x - 1, y)) * 0.32, gy = (nb(x, y + 1) - nb(x, y - 1)) * 0.32;
      let lit = (-gx * LX - gy * LY + LZ) / Math.hypot(gx, gy, 1) - LZ;   // 0 = flat, + lit, - shade
      if (lit < 0) lit *= 0.55;                                          // shadows stay readable (dark rust, not black)
      const { lx, ly } = s;
      let v, R = FUR;
      if (s.layer === 'head') {
        const n1 = vn(lx / 5.5, ly / 2, 1), n2 = vn(lx / 2.6, ly / 1.4, 2);
        v = 0.46 + lit * 1.3 + (n1 - 0.5) * 0.4 + (n2 - 0.5) * 0.2;
        const cheekEdge = s.dCk + (vn(lx / 1.6, ly / 1.6, 7) - 0.5) * 1.8;
        const lip = ly > yAt(LIP_TOP, lx) && lx < -4;
        if (cheekEdge < 0 || lip) {
          R = CRM;
          v = 0.7 + lit * 0.9 + (n2 - 0.5) * 0.35 - clamp((lx - 10) / 14, 0, 1) * 0.2;
          if (ly > 10 && lx < 10) v -= 0.25;                    // underside of the jaw in shade
        } else if (s.dJw < 0) {
          v -= 0.2;
        }
      } else if (s.layer === 'earN') {
        const a = ((lx - EAR_PIV[0]) * ax + (ly - EAR_PIV[1]) * ay) / (al * al);
        const u = ((lx - EAR_PIV[0]) * ay - (ly - EAR_PIV[1]) * ax) / al;   // >0 toward the snout side
        const inner = sdPoly(lx, ly, earIn);
        s.a = a; s.u = u; s.inner = inner;
        v = 0.55 + lit * 1.1 + (vn(a * 9, u / 1.2, 3) - 0.5) * 0.4;
        if (u < 0) v -= 0.25;                                    // the back edge of the ear is dark
      } else if (s.layer === 'earF') {
        v = 0.28 + lit * 0.8 + (vn(lx / 1.4, ly / 4, 4) - 0.5) * 0.3;
        if (ly < -26) v = 0;
      } else {
        const n1 = vn(x / 2.2, y / 5, 5), n2 = vn(x / 1.3, y / 2.5, 6);
        v = 0.5 + lit * 1.1 + (n1 - 0.5) * 0.3 + (n2 - 0.5) * 0.14 - clamp((x - 70) / 26, 0, 1) * 0.25;
        // the raised head casts a big ragged shadow onto the throat and neck
        const dh = Math.min(s.dHd, s.dCk) * S, rag = vn(x / 2.2, y / 1.6, 9);
        if (dh < 6 + rag * 6) v = Math.min(v, 0.32 + (n2 - 0.5) * 0.25);
        if (s.dNk > -1.6 && x > 62) v = Math.max(v, vn(x / 2, y / 2.5, 13) > 0.55 ? 0.1 : 0.25);   // ragged shadowed edge, not an outline
        if (dh < 1.6 + rag * 2.2 && vn(x / 1.6, y / 1.6, 14) > 0.3) v = 0.1;
        if (s.dCs < 0) { R = CRM; v = 0.7 + lit * 0.8 + (n2 - 0.5) * 0.35; }
        else if (y > 137 + vn(x / 7, 0, 10) * 6) {                  // simplified body: big flat tones
          v = x > 80 + (y - 137) * 0.35 + vn(0, y / 6, 11) * 5 ? 0.3 : x < 40 + vn(0, y / 5, 12) * 4 ? 0.7 : 0.5;
        }
      }
      tone[y * GW + x] = clamp(Math.floor(v * 5), 0, 4); ramp[y * GW + x] = R;
    }

    // ---- fur strokes: short dark marks following the fur direction ----
    const mark = (x0, y0, x1, y1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / Math.max(1, n)), y = Math.round(y0 + (y1 - y0) * i / Math.max(1, n));
        if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
        const k = y * GW + x; if (tone[k] < 1 || !info[k] || info[k].layer === 'earN') continue;
        tone[k] = Math.max(0, tone[k] - 2);
      }
    };
    for (let j = -12; j < 16; j += 2.4) for (let i = -26; i < 26; i += 3.4) {
      if (hash(Math.round(i * 10), Math.round(j * 10), 11) > 0.5) continue;
      const px = i + hash(i * 7 | 0, j * 3 | 0, 12) * 2.5, py = j + (hash(i * 5 | 0, j * 9 | 0, 13) - 0.5) * 1.6;
      const [sx, sy] = toS(px, py), k = Math.round(sy) * GW + Math.round(sx);
      if (!info[k] || info[k].layer !== 'head' || ramp[k] !== FUR) continue;
      const len = 1.6 + hash(i * 3 | 0, j * 11 | 0, 14) * 1.6, curve = py > 2 ? 0.45 : 0.1;
      const [ex, ey] = toS(px + len, py + len * curve);
      mark(sx, sy, ex, ey);
    }
    for (let y = 86; y < 140; y += 3) for (let x = 28; x < 100; x += 3) {
      if (hash(x, y, 21) > 0.32) continue;
      const px = x + (hash(x, y, 22) * 3 | 0), py = y + (hash(x, y, 23) * 3 | 0), k = py * GW + px;
      if (!info[k] || info[k].layer !== 'neck' || ramp[k] !== FUR) continue;
      const len = 2 + (hash(x, y, 24) * 2.5 | 0);
      mark(px, py, px + Math.round(len * 0.3), py + len);
    }
    for (let i = 0; i < GW * GH; i++) if (tone[i] >= 0) g.a[i] = ramp[i][tone[i]];
    // tidy: a lone stitch whose 4 neighbours all agree takes their colour (cleaner posterized patches)
    const src = g.a.slice();
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
      const i = y * GW + x, c = src[i]; if (c === BG) continue;
      const n0 = src[i - 1];
      if (n0 !== c && n0 !== BG && src[i + 1] === n0 && src[i - GW] === n0 && src[i + GW] === n0) g.a[i] = n0;
    }

    // ---- details over the fur ----
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const s = info[y * GW + x]; if (!s) continue;
      const { lx, ly } = s;
      if (s.layer === 'earN') {
        const { a, u, inner } = s;
        if (a > 0.84) { g.set(x, y, K); continue; }                         // black ear tip
        if (inner < 0) {
          // dark inner ear, pale hairs combed along the front inner edge and fluff at the base
          const n = vn(a * 14, u * 0.9, 31);
          let c = n > 0.6 ? D : K;
          const hair = vn(a * 22, u * 0.6, 32);
          if (inner > -1.6 && u > 0 && a < 0.62 && hair > 0.42) c = hair > 0.62 ? H : L;
          if (a < 0.24 && inner > -3 && hair > 0.5) c = hair > 0.72 ? W : H;
          g.set(x, y, c);
        } else if (u < 0 && inner < 1.6) {
          g.set(x, y, a > 0.5 ? K : D);                                       // black back rim of the ear
        }
        continue;
      }
      if (s.layer !== 'head') continue;
      // nose
      const dn = sdEll(lx, ly, -29.4, 1.3, 2.5, 2.3);
      if (dn < 0) { g.set(x, y, (lx < -29.5 && lx > -30.8 && ly < 0.4 && ly > -0.8) ? D : K); continue; }
      if (dLine(lx, ly, MOUTH) < 0.55) { g.set(x, y, K); continue; }              // mouth with smug upturn
      if (dLine(lx, ly, TEAR) < 0.62) { g.set(x, y, ly > 3.3 ? D : K); continue; } // fox tear line
    }
    drawEye(g, lid);
  }

  window.ANIMAL = { name: 'fox', loop: 6, bg: BG, palette: PAL, draw };
})();
