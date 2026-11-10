/* 1000 agents build an operating system from an empty folder.
   Pure Canvas 2D, no dependencies. Every frame is a pure function of time: renderAt(t).
   The picture is drawn into a 640x360 pixel buffer and shown at an integer scale with smoothing off. */
(() => {
  'use strict';
  const W = 640, H = 360, DUR = 40, N_AGENTS = 1000, SQUAD = 5, N_SQUADS = N_AGENTS / SQUAD;
  const PI = Math.PI, TAU = PI * 2, fl = Math.floor;

  /* ------------------------------------------------------------------ maths */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const c01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (a, b, t) => c01((t - a) / (b - a));                    // 0..1 across [a, b]
  const eio = (k) => k * k * (3 - 2 * k);                             // smoothstep
  const eo = (k) => 1 - (1 - k) * (1 - k) * (1 - k);                  // ease out cubic
  const frac = (v) => v - Math.floor(v);
  // seeded hash -> [0, 1): the only source of "randomness" in the piece
  function ih(a, b, s) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul((s | 0) + 1013, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  const hermite = (p0, v0, p1, v1, s) => { const s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * v0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * v1; };

  /* ------------------------------------------------------------------ palette */
  const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const C = {
    coral: hex('d97757'), cord: hex('a8553b'), corl: hex('f2a585'), cdark: hex('6e2a1a'), cream: hex('ffe2cf'),
    white: hex('ffffff'), black: hex('000000'),
    lilac: hex('a9a3e6'), violet: hex('6c64bd'), vdim: hex('37336b'), vdeep: hex('1b1838'),
    teal: hex('5fd6c4'),
  };

  /* ------------------------------------------------------------------ pixel buffer (float rgb, 0..255) */
  const BUF = new Float32Array(W * H * 3), BG = new Float32Array(W * H * 3);
  function pset(x, y, c, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    if (a >= 1) { BUF[i] = c[0]; BUF[i + 1] = c[1]; BUF[i + 2] = c[2]; }
    else if (a > 0) { BUF[i] += (c[0] - BUF[i]) * a; BUF[i + 1] += (c[1] - BUF[i + 1]) * a; BUF[i + 2] += (c[2] - BUF[i + 2]) * a; }
  }
  function padd(x, y, c, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3; BUF[i] += c[0] * a; BUF[i + 1] += c[1] * a; BUF[i + 2] += c[2] * a;
  }
  function rectF(x, y, w, h, c, a) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pset(x + i, y + j, c, a === undefined ? 1 : a); }
  function line(x0, y0, x1, y1, c, a) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { pset(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // a polyline drawn on from its start: only the first `k` (0..1) of its length is shown
  function polyOn(pts, k, c, a) {
    if (k <= 0) return null;
    let total = 0; for (let i = 0; i + 1 < pts.length; i++) total += Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
    let left = total * c01(k), tip = pts[0];
    for (let i = 0; i + 1 < pts.length && left > 0; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.abs(bx - ax) + Math.abs(by - ay), u = Math.min(1, left / L);
      tip = [Math.round(ax + (bx - ax) * u), Math.round(ay + (by - ay) * u)];
      line(ax, ay, tip[0], tip[1], c, a); left -= L;
    }
    return tip;
  }
  function ring(cx, cy, r, c, a) {            // a one pixel circle
    if (r < 1 || a <= 0) return;
    const n = Math.ceil(r * 7); let lx = 1e9, ly = 1e9;
    for (let k = 0; k < n; k++) { const an = k / n * TAU, x = Math.round(cx + Math.cos(an) * r), y = Math.round(cy + Math.sin(an) * r); if (x !== lx || y !== ly) { pset(x, y, c, a); lx = x; ly = y; } }
  }
  function glow(cx, cy, r, c, a) {            // soft additive light
    if (a <= 0) return;
    const x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r; if (d < 1) { const k = (1 - d) * (1 - d) * a; padd(x, y, c, k); } }
  }

  /* ------------------------------------------------------------------ 3x5 pixel lettering */
  const GL = { A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
    0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757', 9: '75716', '.': '00002', ':': '02020', '-': '00700', '/': '11244', '>': '42124', '_': '00007', ' ': '00000' };
  function text(s, x, y, c, a) {
    for (let k = 0; k < s.length; k++) { const g = GL[s[k]] || GL[' ']; for (let j = 0; j < 5; j++) { const row = +g[j]; for (let i = 0; i < 3; i++) if (row & (4 >> i)) pset(x + k * 4 + i, y + j, c, a); } }
  }
  const textW = (s) => s.length * 4 - 1;

  /* ------------------------------------------------------------------ background: deep indigo, a faint lit centre, a quiet dot grid */
  (function buildBG() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W * 0.62), dy = (y - H * 0.47) / (H * 0.72), d = Math.min(1, Math.sqrt(dx * dx + dy * dy)), k = (1 - d) * (1 - d);
      let r = 7 + 9 * k, g = 5 + 6 * k, b = 16 + 23 * k;
      if (x % 16 === 8 && y % 16 === 4) { r += 9 + 8 * k; g += 8 + 7 * k; b += 18 + 14 * k; }
      const i = (y * W + x) * 3; BG[i] = r; BG[i + 1] = g; BG[i + 2] = b;
    }
  })();

  /* ------------------------------------------------------------------ the hero: the coral block of the Fable Saga, in its plain form
     Ported from the saga's buildSprite(): a 26x16 body with a lit top edge and a darker base, four 4x6 leg stubs (the inner two
     in shade), two arm nubs, 2x3 eyes with a white glint, a white one-pixel outline. Drawn at an integer scale, never rotated. */
  const SW = 64, SH = 56, SOX = 32, SOY = 26;
  const SPR = new Uint8Array(SW * SH);
  const HP = [null, C.coral, C.cord, C.corl, C.black, C.white, C.cdark];     // sprite colours 1..6
  function sp(x, y, c) { x = Math.round(x) + SOX; y = Math.round(y) + SOY; if (x >= 0 && y >= 0 && x < SW && y < SH) SPR[y * SW + x] = c; }
  function spRect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) sp(x + i, y + j, c); }
  function buildHero(o) {
    SPR.fill(0);
    const sq = o.sq || 0, bw = Math.round(26 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(10, Math.round(16 * (1 - sq * 0.4)));
    const x0 = -bw / 2, y0 = -Math.round(bh / 2), y1 = y0 + bh, BODY = 1, DARK = 2, LITE = 3, BLK = 4, WHT = 5;
    // legs (they lift, and lean when it moves)
    const lift = o.legs || [0, 0, 0, 0], lh = 6, shx = o.legSh || 0;
    const lx = [x0, x0 + Math.round(bw * 0.2), x0 + bw - Math.round(bw * 0.2) - 4, x0 + bw - 4];
    for (let k = 0; k < 4; k++) { const n = Math.max(1, lh - lift[k]), lc = k === 1 || k === 2 ? DARK : BODY; for (let j = 0; j < n; j++) spRect(lx[k] + Math.round(shx * (j + 1) / lh), y1 + j, 4, 1, lc); }
    // body
    spRect(x0, y0, bw, bh, BODY);
    for (let i = 0; i < bw; i++) { sp(x0 + i, y1 - 1, DARK); sp(x0 + i, y0, LITE); if (i & 1) sp(x0 + i, y1 - 2, DARK); }
    for (let j = 1; j < bh - 1; j++) { sp(x0 + bw - 1, y0 + j, DARK); if (j & 1) sp(x0 + bw - 2, y0 + j, DARK); }
    sp(x0 + 1, y0 + 1, LITE); sp(x0 + 2, y0 + 1, LITE); sp(x0 + 1, y0 + 2, LITE);
    // arms
    const ay = y0 + Math.round(bh * 0.34), ah = Math.max(3, Math.round(bh * 0.32)), ar = Math.round(o.reach || 0), armA = o.armA || 0;
    const limb = (sx, sy, a, len, c) => { const ca = Math.cos(a), sa = Math.sin(a); for (let q = 0; q <= len; q += 0.5) for (let v = -ah / 2 + 0.25; v < ah / 2; v += 0.5) sp(sx + ca * q - sa * v, sy + sa * q + ca * v, c); };
    const shY = ay + ah / 2 - 0.5;
    limb(x0 + 1, shY, PI - armA * 0.6, 4.5, DARK); limb(x0 + bw - 1, shY, armA, 3.5 + ar, BODY);
    // eyes (they can glance a pixel to either side, or up)
    const lk = o.look || [0, 0];
    const ex0 = x0 + Math.round(bw * 0.17) + lk[0], ex1 = x0 + bw - Math.round(bw * 0.17) - 2 + lk[0], ey = y0 + Math.round(bh * 0.28) + lk[1];
    const e = o.eyes || 'normal';
    const eye = (ex, side) => {
      if (e === 'closed') { spRect(ex, ey + 2, 2, 1, BLK); return; }
      if (e === 'wide') { spRect(ex - 1, ey - 1, 3, 4, BLK); sp(ex - 1, ey - 1, WHT); return; }
      spRect(ex, ey, 2, 3, BLK); sp(ex + (side < 0 ? 0 : 1), ey, WHT);
    };
    eye(ex0, -1); eye(ex1, 1);
    if (o.mouth) { const mw = o.mouth > 1 ? 8 : 4, mh = o.mouth > 1 ? 4 : 2, my = y0 + Math.round(bh * 0.28) + 5; spRect(-mw / 2, my, mw, mh, BLK); if (o.mouth > 1) spRect(-mw / 2 + 1, my + mh - 1, mw - 2, 1, DARK); }
    // outline
    const src = SPR.slice();
    for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) { const i = y * SW + x; if (!src[i] && (src[i - 1] || src[i + 1] || src[i - SW] || src[i + SW])) SPR[i] = WHT; }
  }
  function stampHero(x, y, S, flip, a) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
      const c = SPR[j * SW + i]; if (!c) continue;
      const lx = flip ? SOX - 1 - i + 0 : i - SOX, ly = j - SOY;
      rectF(x + lx * S, y + ly * S, S, S, HP[c], a);
    }
  }

  /* the hero's performance: a list of moves (hops from place to place), and what its face and arms do. All a function of t. */
  const HS = 2;                                          // hero pixel scale
  const FOLDER0 = [334, 172];                            // the folder, centre
  const HERO0 = [252, 176];                              // where the hero stops beside it
  const T_SIGNAL = 1.95, T_POUR = 2.3;
  const MOVES = [
    { t0: 0.05, t1: 1.25, from: [-16, 176], to: HERO0, hops: 4, h: 15 },       // arrives
    { t0: T_SIGNAL - 0.12, t1: T_SIGNAL + 0.3, from: HERO0, to: HERO0, hops: 1, h: 17 },   // the signal
  ];
  function heroAt(t) {
    let x = MOVES[0].from[0], y = MOVES[0].from[1], land = -9, air = 0, vx = 0, moving = 0;
    for (const m of MOVES) {
      if (t >= m.t1) { x = m.to[0]; y = m.to[1]; land = m.t1; }
      else if (t >= m.t0) {
        const d = m.t1 - m.t0, s = (t - m.t0) / d, ph = m.hops * s, k = fl(ph);
        x = lerp(m.from[0], m.to[0], s); y = lerp(m.from[1], m.to[1], s);
        air = Math.sin(PI * (ph - k)); y -= m.h * air; vx = (m.to[0] - m.from[0]) / d; moving = 1;
        if (k >= 1) land = m.t0 + k / m.hops * d;
        break;
      }
    }
    const tl = t - land, n = moving ? 0 : 1;                // n: at rest
    // lands in a squash that wobbles out; stretches tall in the air; breathes when still
    let sq = 0.3 * Math.exp(-tl * 7) * Math.cos(tl * 15) * (tl >= 0 ? 1 : 0) - 0.16 * air * (air > 0.25 ? 1 : air * 4) + Math.sin(t * 3.1) * 0.05 * n;
    const legs = [0, 1, 2, 3].map((k) => moving ? air * 2.2 * (k % 2 ? 1 : 0.4) : Math.max(0, Math.sin(t * 6.5 + k * 1.6)) * 1.2);
    const legSh = clamp(-vx / 120, -3, 3) * (moving ? 0.5 + 0.5 * air : 0) + Math.sin(t * 4.2) * 0.7 * n;
    const bob = Math.sin(t * 2.3) * 0.6 * HS * n;
    // face
    let eyes = 'normal', look = [0, 0], flip = false, mouth = 0, armA = 0, reach = 0;
    if (frac((t + 1.72) / 3.3) < 0.035 || (t > 1.58 && t < 1.68)) eyes = 'closed';
    if (t > 1.25 && t < 1.42) look = [1, 0];                                          // sees the folder
    else if (t >= 1.42 && t < 1.62) look = [-1, 0];                                   // glances back
    else if (t >= 1.68 && t < T_SIGNAL - 0.1) look = [1, 0];
    else if (t >= T_POUR + 0.15) look = [1, -1];                                      // watches them rise
    const sg = t - T_SIGNAL;
    if (sg > -0.12) { const up = eio(seg(-0.12, 0.08, sg)) * (1 - eio(seg(1.6, 2.1, sg))); armA = -1.0 * up; reach = 5 * up; if (sg < 0.45) { mouth = 2; } if (sg > 0.3 && sg < 1.2) eyes = 'wide'; }
    return { x, y: y + bob, sq, legs, legSh, eyes, look, flip, mouth, armA, reach };
  }
  function drawHero(t) {
    const h = heroAt(t);
    buildHero(h);
    stampHero(h.x, h.y, HS, h.flip, 1);
    return h;
  }

  /* ------------------------------------------------------------------ the folder: one outline, drawn on in the first half second */
  function drawFolder(t) {
    const cx = FOLDER0[0], cy = FOLDER0[1], w = 68, hgt = 48, x0 = cx - w / 2, y0 = cy - hgt / 2, x1 = x0 + w - 1, y1 = y0 + hgt - 1;
    const on = eo(seg(-0.08, 0.55, t)), open = eio(seg(T_POUR - 0.22, T_POUR + 0.12, t));
    const col = C.lilac, lit = eio(seg(T_POUR - 0.1, T_POUR + 0.5, t));
    // the light inside, once it opens
    if (open > 0) { glow(cx, y0 + 13, 52, C.coral, 0.34 * open); glow(cx, y0 + 13, 22, C.corl, 0.3 * open * (0.85 + 0.15 * Math.sin(t * 9))); }
    // back: body with a tab at the top left
    const back = [[x0, y1 - 1], [x0, y0 + 1], [x0 + 1, y0], [x0 + 22, y0], [x0 + 28, y0 + 6], [x1 - 1, y0 + 6], [x1, y0 + 7], [x1, y1 - 1], [x1 - 1, y1], [x0 + 1, y1], [x0, y1 - 1]];
    const tip = polyOn(back, on, col, 0.8 - 0.25 * open);
    // front face: closed it sits just under the tab; open it tips forward
    const fy = y0 + 13 + Math.round(open * 9), sk = Math.round(open * 6);
    if (on > 0.55) {
      const k = seg(0.55, 1, on);
      const front = [[x0 + sk, fy], [x1 + sk, fy]];
      polyOn(front, k, col, 1);
      if (open > 0) { line(x0, y1, x0 + sk, fy, col, 1); line(x1, y1, x1 + sk, fy, col, 1); line(x0 + 1, y1, x1 - 1, y1, col, 1); }
    }
    if (tip && on < 1) { pset(tip[0], tip[1], C.white, 1); padd(tip[0] + 1, tip[1], C.lilac, 0.5); padd(tip[0] - 1, tip[1], C.lilac, 0.5); padd(tip[0], tip[1] + 1, C.lilac, 0.5); padd(tip[0], tip[1] - 1, C.lilac, 0.5); }
    // "0 items", until someone arrives to change that
    const la = eio(seg(0.4, 0.7, t)) * (1 - eio(seg(T_POUR + 0.1, T_POUR + 0.6, t)));
    if (la > 0) { const s = '0 ITEMS', n = Math.min(s.length, fl(seg(0.4, 0.85, t) * (s.length + 1))); text(s.slice(0, n), cx - (textW(s) >> 1), y1 + 9, C.lilac, la * 0.85); }
  }
  const mouth = () => [FOLDER0[0], FOLDER0[1] - 11];

  /* ------------------------------------------------------------------ the swarm: exactly 1000 agents, in squads of five
     Nothing is simulated. Each agent's place is a closed form of t: it rides a slowly turning, breathing ring (its home lane),
     and every excursion (pouring out of the folder; later, carrying a block to its slot) is a Hermite curve that leaves and
     rejoins the ring with matching velocity, so the motion is continuous. */
  const AG = [];
  for (let i = 0; i < N_AGENTS; i++) {
    const q = fl(i / SQUAD), c = i % SQUAD;
    const tri = ih(i, 1, 7) + ih(i, 2, 7) - 1;                        // -1..1, denser in the middle of the band
    AG.push({
      q, c,
      a0: TAU * frac(q * 0.6180339887) + (ih(i, 3, 7) - 0.5) * 0.09,  // squads are scattered around the ring by the golden angle
      spd: 1 + (ih(q, 4, 7) - 0.5) * 0.24,
      rho: tri * 13,
      emerge: T_POUR + 2.6 * (q / (N_SQUADS - 1)) + c * 0.022 + ih(i, 5, 7) * 0.05,
      fan: (ih(i, 6, 7) + ih(i, 8, 7) - 1) * 0.7,                    // the angle it leaves the folder at, about straight up
      kick: 200 + ih(i, 9, 7) * 190,
      tone: ih(i, 10, 7), tw: ih(i, 11, 7) * TAU,
    });
  }
  const T_POUR_FLY = 1.75;
  const RING = { cx: FOLDER0[0], cy: 168, rx: 168, ry: 118 };
  const RP = [0, 0];
  function ringPos(A, t, out) {
    const an = A.a0 + 0.26 * t * A.spd;
    const und = 5 * Math.sin(3 * an - 0.7 * t) + 3 * Math.sin(5 * an + 0.45 * t + 1.3);
    out[0] = RING.cx + (RING.rx + A.rho + und) * Math.cos(an);
    out[1] = RING.cy + (RING.ry + A.rho * 0.8 + und) * Math.sin(an);
  }
  const _a = [0, 0], _b = [0, 0], _c = [0, 0];
  // where agent A is at time t; returns false while it is still inside the folder
  function agentPos(A, t, out) {
    if (t < A.emerge) return false;
    const te = A.emerge + T_POUR_FLY;
    if (t < te) {
      const s = (t - A.emerge) / T_POUR_FLY, m = mouth();
      ringPos(A, te, _a); ringPos(A, te + 0.02, _b);
      const vx = (_b[0] - _a[0]) / 0.02 * T_POUR_FLY, vy = (_b[1] - _a[1]) / 0.02 * T_POUR_FLY;
      const an = -PI / 2 + A.fan, k = A.kick * T_POUR_FLY;
      out[0] = hermite(m[0] + A.fan * 9, Math.cos(an) * k, _a[0], vx, s);
      out[1] = hermite(m[1], Math.sin(an) * k, _a[1], vy, s);
      return true;
    }
    ringPos(A, t, out);
    return true;
  }
  const SPARK = [C.cord, C.coral, C.coral, C.corl, C.cream];
  function drawAgents(t) {
    let n = 0;
    for (let i = 0; i < N_AGENTS; i++) {
      const A = AG[i];
      if (!agentPos(A, t, _c)) continue;
      n++;
      const x = Math.round(_c[0]), y = Math.round(_c[1]);
      const age = t - A.emerge, born = c01(age / 0.25);
      // a spark: one pixel of the hero's coral, a short fading tail behind it, a breath of light around it
      const tone = A.tone, col = tone < 0.16 ? SPARK[0] : tone < 0.62 ? SPARK[1] : tone < 0.9 ? SPARK[3] : SPARK[4];
      const tw = 0.82 + 0.18 * Math.sin(t * 5 + A.tw);
      // its tail: a streak back to where it was a moment ago, so a fast agent reads as a stroke and a slow one as a point
      if (agentPos(A, t - 0.048, _a)) { const tx = Math.round(_a[0]), ty = Math.round(_a[1]); if (tx !== x || ty !== y) line(tx, ty, x, y, C.cord, 0.3 * tw); }
      if (agentPos(A, t - 0.02, _a)) { const tx = Math.round(_a[0]), ty = Math.round(_a[1]); if (tx !== x || ty !== y) line(tx, ty, x, y, C.coral, 0.45 * tw); }
      const hot = 1 - born;                                   // fresh out of the folder it is still white-hot
      padd(x - 1, y, C.coral, 0.13); padd(x + 1, y, C.coral, 0.13); padd(x, y - 1, C.coral, 0.13); padd(x, y + 1, C.coral, 0.13);
      pset(x, y, col, tw);
      if (hot > 0) pset(x, y, C.cream, hot * 0.8);
    }
    return n;
  }

  /* ------------------------------------------------------------------ the signal: one thin ring from the hero's raised arm */
  function drawSignal(t, h) {
    const g = t - (T_SIGNAL + 0.02);
    if (g < 0 || g > 0.9) return;
    const k = g / 0.9, r = 8 + eo(k) * 92, a = (1 - k) * (1 - k);
    ring(h.x + 36, h.y - 18, r, C.corl, 0.85 * a);
    if (g > 0.1) { const k2 = (g - 0.1) / 0.8; ring(h.x + 36, h.y - 18, 8 + eo(k2) * 62, C.coral, 0.4 * (1 - k2)); }
    // three short rays off the hand
    if (g < 0.32) { const q = g / 0.32, hx = h.x + 37, hy = h.y - 20; for (const an of [-1.25, -0.75, -0.25]) { const r0 = 4 + q * 6, r1 = r0 + 4 * (1 - q); line(hx + Math.cos(an) * r0, hy + Math.sin(an) * r0, hx + Math.cos(an) * r1, hy + Math.sin(an) * r1, C.cream, 1 - q); } }
  }

  /* ------------------------------------------------------------------ the counter: discreet, top left */
  function drawCounter(t, nAgents) {
    const a = eio(seg(T_POUR - 0.1, T_POUR + 0.4, t));
    if (a <= 0) return;
    text('AGENTS', 20, 18, C.violet, a);
    text(String(nAgents).padStart(4, '0'), 20 + 28, 18, C.corl, a);
  }

  /* ------------------------------------------------------------------ a frame */
  function renderAt(t) {
    t = ((t % DUR) + DUR) % DUR;
    BUF.set(BG);
    drawFolder(t);
    const h = heroAt(t);
    drawSignal(t, h);
    const n = drawAgents(t);
    buildHero(h); stampHero(h.x, h.y, HS, h.flip, 1);
    drawCounter(t, n);
    present();
    return n;
  }

  /* ------------------------------------------------------------------ canvas, sizing, clock */
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const octx = off.getContext('2d'), img = octx.createImageData(W, H), px = img.data;
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  function present() {
    for (let y = 0, i = 0, j = 0; y < H; y++) for (let x = 0; x < W; x++, i += 3, j += 4) { const d = B4[((y & 3) << 2) | (x & 3)]; px[j] = BUF[i] + d; px[j + 1] = BUF[i + 1] + d; px[j + 2] = BUF[i + 2] + d; }   // ordered dither: no banding in the darks
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
  }
  let lastT = 0;
  function fit() {
    const dpr = window.devicePixelRatio || 1, k = Math.max(1, fl(Math.min(window.innerWidth * dpr / W, window.innerHeight * dpr / H)));
    cv.width = W * k; cv.height = H * k;
    const fits = W * k / dpr <= window.innerWidth && H * k / dpr <= window.innerHeight;
    const s = fits ? 1 / dpr : Math.min(window.innerWidth / (W * k), window.innerHeight / (H * k));
    cv.style.width = (W * k * s) + 'px'; cv.style.height = (H * k * s) + 'px';
    renderAt(lastT);
  }
  const Q = new URLSearchParams(location.search);
  const draw = (t) => { lastT = t; return renderAt(t); };
  window.addEventListener('resize', fit);
  if (Q.has('export')) {
    // raw 640x360 RGBA of the frame at t, base64: exactly what the canvas shows before the integer upscale
    const frame = (t) => { draw(t); let s = ''; for (let i = 0; i < px.length; i += 8192) s += String.fromCharCode.apply(null, px.subarray(i, i + 8192)); return btoa(s); };
    window.__piece = { renderAt: draw, duration: DUR, isReady: () => true, frame, width: W, height: H, agents: N_AGENTS };
    fit();
  } else if (Q.has('t')) {
    lastT = parseFloat(Q.get('t')) || 0; fit();
  } else {
    // live: the clock only chooses which t to show; the drawing itself never reads it
    const loopLen = Q.has('loop') ? parseFloat(Q.get('loop')) || DUR : DUR;
    let start = null;
    const tick = (now) => { if (start === null) start = now; draw(((now - start) / 1000) % loopLen); requestAnimationFrame(tick); };
    fit(); requestAnimationFrame(tick);
  }
})();
