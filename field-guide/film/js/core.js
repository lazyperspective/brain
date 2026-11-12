'use strict';
// ------------------------------------------------------------------
// Pixel core: a crisp software rasterizer on a 360x450 RGBA buffer,
// palette quantization with ordered dither, 2:1 isometric helpers,
// the shared prologue timeline and the shared sprites (hero, plane,
// island, tree, planks, moon, stars, glyphs).
// ------------------------------------------------------------------
const LW = 360, LH = 450, SC = 3, FW = LW * SC, FH = LH * SC, DUR = 3.0;

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(i, j, k = 0) { let n = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(k | 0, 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { let t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function vnoise(x, y, s = 0) { const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
function fbm(x, y, s = 0, o = 4) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f, s + i * 17); f *= 2; a *= 0.5; } return v; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ---------------- pixel buffer ----------------
class PBuf {
  constructor(pal, amp = 24) {
    this.d = new Uint8ClampedArray(LW * LH * 4); this.pal = pal.map(hex); this.amp = amp; this.cache = new Map();
  }
  near(r, g, b) {
    const key = ((r >> 2) & 63) << 12 | ((g >> 2) & 63) << 6 | ((b >> 2) & 63);
    let c = this.cache.get(key); if (c) return c;
    let best = 1e9; c = this.pal[0];
    for (const p of this.pal) { const dr = p[0] - r, dg = p[1] - g, db = p[2] - b; const dd = 2 * dr * dr + 4 * dg * dg + 3 * db * db + 0.0; if (dd < best) { best = dd; c = p; } }
    this.cache.set(key, c); return c;
  }
  // set a pixel to colour c=[r,g,b]; dither: amplitude (0 = exact nearest)
  put(x, y, c, dith = 0) {
    if (!c) return; x |= 0; y |= 0; if (x < 0 || y < 0 || x >= LW || y >= LH) return;
    let r = c[0], g = c[1], b = c[2];
    if (dith) { const d = (BAYER[(y & 3) * 4 + (x & 3)] - 7.5) / 16 * dith; r += d; g += d; b += d; }
    const p = this.near(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)), i = (y * LW + x) * 4;
    this.d[i] = p[0]; this.d[i + 1] = p[1]; this.d[i + 2] = p[2]; this.d[i + 3] = 255;
  }
  get(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= LW || y >= LH) return null; const i = (y * LW + x) * 4; if (!this.d[i + 3]) return null; return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
  clearPx(x, y) { const i = (y * LW + x) * 4; this.d[i + 3] = 0; }
  // fill a polygon (pixel-centre sampling, no anti-aliasing). col: [r,g,b] or fn(x,y)->[r,g,b] ; dith: dither amplitude
  poly(pts, col, dith = 0) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(LH - 1, Math.ceil(y1));
    const fn = typeof col === 'function', xs = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5; xs.length = 0;
      for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(LW - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
        for (let x = xa; x <= xb; x++) { if (fn) { const c = col(x, y); if (c) this.put(x, y, c, c[3] !== undefined ? c[3] : dith); } else this.put(x, y, col, dith); }
      }
    }
  }
  circle(cx, cy, r, col, dith = 0) {
    const fn = typeof col === 'function';
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      const dy = y + 0.5 - cy; if (Math.abs(dy) > r) continue; const hw = Math.sqrt(r * r - dy * dy);
      for (let x = Math.ceil(cx - hw - 0.5); x <= Math.ceil(cx + hw - 0.5) - 1; x++) { if (fn) { const c = col(x, y); if (c) this.put(x, y, c, c[3] !== undefined ? c[3] : dith); } else this.put(x, y, col, dith); }
    }
  }
  ellipse(cx, cy, rx, ry, col, dith = 0) {
    const fn = typeof col === 'function';
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry; if (Math.abs(dy) > 1) continue; const hw = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.ceil(cx - hw - 0.5); x <= Math.ceil(cx + hw - 0.5) - 1; x++) { if (fn) { const c = col(x, y); if (c) this.put(x, y, c, c[3] !== undefined ? c[3] : dith); } else this.put(x, y, col, dith); }
    }
  }
  rect(x, y, w, h, col, dith = 0) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, typeof col === 'function' ? col(x + i, y + j) : col, dith); }
  line(x0, y0, x1, y1, col) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (; ;) { this.put(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  // blend a colour over existing pixels with alpha field fn(x,y)->a in [0,1], re-quantized with dither
  glow(x0, y0, x1, y1, col, afn, dith) {
    for (let y = Math.max(0, y0 | 0); y < Math.min(LH, y1); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(LW, x1); x++) {
      const a = afn(x + 0.5, y + 0.5); if (a <= 0.004) continue; const o = this.get(x, y); if (!o) continue;
      this.put(x, y, mix(o, col, Math.min(1, a)), dith === undefined ? this.amp : dith);
    }
  }
  toCanvas(cv) { const c = cv.getContext('2d'); c.putImageData(new ImageData(this.d, LW, LH), 0, 0); return cv; }
}

// ---------------- isometric ----------------
const ISO = { ox: 180, oy: 236, k: 1 };
const P = (x, y, z) => [ISO.ox + (x - y) * ISO.k, ISO.oy + ((x + y) / 2 - z) * ISO.k];
// box: x0,y0,z0 size sx,sy,sz ; colours top,left(+y face),right(+x face) ; fns allowed
function box(B, x0, y0, z0, sx, sy, sz, ct, cl, cr, dith = 0) {
  const x1 = x0 + sx, y1 = y0 + sy, zt = z0 + sz;
  if (cl) B.poly([P(x0, y1, zt), P(x1, y1, zt), P(x1, y1, z0), P(x0, y1, z0)], cl, dith);
  if (cr) B.poly([P(x1, y0, zt), P(x1, y1, zt), P(x1, y1, z0), P(x1, y0, z0)], cr, dith);
  if (ct) B.poly([P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)], ct, dith);
}

// ---------------- glyphs ----------------
const GLY = {
  z: ['####', '..#.', '.#..', '####'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['###', '..#', '.#.', '...', '.#.'],
};
function glyph(B, g, x, y, col, s = 1) { const rows = GLY[g]; for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') B.rect(x + i * s, y + j * s, s, s, col); }

// ---------------- timeline (shared prologue, 3 s) ----------------
// 0.00 plane already gliding in from upper left (frame 0 alive), hero asleep with Zzz
// 1.30 plane bonks hero's head ; 1.32 eyes pop open, squash
// 1.45-1.60 anticipation, 1.60-2.00 hop, 2.00-2.15 land squash
// 2.15 looks up-right at the moon, "!" bubble at 2.25, moon glints at 2.4
function heroState(t) {
  const s = { hop: 0, squash: 0, eyes: 'closed', mouth: false, bubble: 0, arm: 0, breathe: 0, look: 0 };
  if (t < 1.30) { s.breathe = Math.sin(t * 2 * Math.PI / 1.5) * 0.5 + 0.5; return s; }
  s.eyes = 'open';
  if (t < 1.45) { const k = (t - 1.30) / 0.15; s.squash = 0.22 * Math.sin(k * Math.PI); s.mouth = true; }
  else if (t < 1.60) { const k = (t - 1.45) / 0.15; s.squash = 0.18 * ease(k); s.mouth = true; }
  else if (t < 2.00) { const k = (t - 1.60) / 0.40; s.hop = 4 * k * (1 - k) * 16; s.squash = -0.16 * Math.sin(Math.min(1, k * 1.6) * Math.PI) ; s.arm = 1; s.mouth = true; }
  else if (t < 2.15) { const k = (t - 2.00) / 0.15; s.squash = 0.2 * Math.sin(k * Math.PI); s.arm = 1 - k; }
  if (t >= 2.15) { s.eyes = 'up'; s.look = sm(2.15, 2.3, t); s.arm = sm(2.3, 2.5, t) ; }
  if (t >= 2.25) s.bubble = sm(2.25, 2.35, t);
  return s;
}
// plane in SCREEN space, relative to the hero's head point H=[hx,hy]
function planeState(t, H) {
  const p0 = [H[0] - 150, H[1] - 150], p1 = [H[0] - 40, H[1] - 205], p2 = [H[0] - 95, H[1] - 30], p3 = [H[0] - 4, H[1] - 2];
  if (t <= 1.30) {
    const u = ease(t / 1.30 * 0.86 + 0.14 * (t / 1.30));
    const v = 1 - u, bx = v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0];
    const by = v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1];
    const fl = Math.sin(t * 9) * 1.5 * (1 - u);
    const u2 = Math.min(1, u + 0.01), v2 = 1 - u2;
    const cx = v2 * v2 * v2 * p0[0] + 3 * v2 * v2 * u2 * p1[0] + 3 * v2 * u2 * u2 * p2[0] + u2 * u2 * u2 * p3[0];
    const cy = v2 * v2 * v2 * p0[1] + 3 * v2 * v2 * u2 * p1[1] + 3 * v2 * u2 * u2 * p2[1] + u2 * u2 * u2 * p3[1];
    return { x: bx, y: by + fl, ang: Math.atan2(cy - by, cx - bx), landed: 0, u };
  }
  // bonk: bounces up-left and flutters to the ground in front of the hero
  const k = clamp((t - 1.30) / 0.45, 0, 1);
  const x = lerp(p3[0], H[0] - 26, k), y = lerp(p3[1], H[1] + 30, k) - Math.sin(k * Math.PI) * 18;
  return { x, y, ang: lerp(-0.6, 0.15, k) + Math.sin(k * 12) * 0.35 * (1 - k), landed: k, u: 1 };
}

// ---------------- sprites ----------------
const HERO = { body: hex('d97757'), shade: hex('a8553b'), light: hex('f2a585'), dark: hex('6e2a1a'), hi: hex('ffd9c2'), eye: hex('1b1426'), white: hex('fff6ea') };
// hero standing at world (hx,hy,hz). returns head screen point
function drawHero(B, hx, hy, hz, st, opt = {}) {
  const bx0 = 16, by0 = 14, bz0 = 13;
  const sq = st.squash, bz = Math.round(bz0 * (1 - sq)), bx = Math.round(bx0 * (1 + sq * 0.5)), by = Math.round(by0 * (1 + sq * 0.5));
  const z0 = hz + 3 + st.hop, x0 = hx - bx / 2, y0 = hy - by / 2;
  const breath = st.breathe ? Math.round(st.breathe) : 0;
  const BZ = bz + (st.eyes === 'closed' ? breath : 0);
  const C = opt.colors || HERO;
  // contact shadow
  if (opt.shadow !== false) { const sp = P(hx, hy, hz); const r = (11 - Math.min(5, st.hop * 0.3)) * ISO.k; B.ellipse(sp[0] + 1, sp[1] + 1, r, r * 0.45, opt.shadowCol || [20, 14, 30]); }
  // legs (only when not too squashed); back legs first
  const lz = hz + st.hop;
  const legH = 3;
  const legs = [[x0 + 1, y0 + 1], [x0 + bx - 4, y0 + 1], [x0 + 1, y0 + by - 4], [x0 + bx - 4, y0 + by - 4]];
  for (const [lx, ly] of legs) box(B, lx, ly, lz, 3, 3, legH, C.dark, C.shade, C.dark);
  // body with chamfered front-vertical edge
  const x1 = x0 + bx, y1 = y0 + by, zt = z0 + BZ, ch = 2;
  B.poly([P(x0, y1, zt), P(x1 - ch, y1, zt), P(x1 - ch, y1, z0), P(x0, y1, z0)], C.body); // left (+y) face
  B.poly([P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1, y0, z0)], C.shade); // right (+x) face
  B.poly([P(x1 - ch, y1, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1 - ch, y1, z0)], mix(C.body, C.shade, 0.5)); // bevel
  B.poly([P(x0 + 1, y0, zt), P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1 - ch, y1, zt), P(x0, y1, zt), P(x0, y0 + 1, zt)], C.light); // top
  // top-front rim highlight
  const a = P(x0 + 1, y1, zt), b = P(x1 - ch, y1, zt); B.line(a[0], a[1], b[0], b[1] - 1, C.hi);
  // bottom dark rim
  const c1 = P(x0, y1, z0), c2 = P(x1 - ch, y1, z0), c3 = P(x1, y1 - ch, z0), c4 = P(x1, y0, z0);
  B.line(c1[0], c1[1] - 1, c2[0] - 1, c2[1] - 1, C.shade); B.line(c3[0] + 1, c3[1] - 1, c4[0] - 1, c4[1], C.dark);
  // arm nub on the +y face side (towards the viewer-left), raises when excited
  const az = z0 + Math.round(bz * 0.35) + Math.round(st.arm * 6);
  box(B, x0 + bx * 0.45, y1, az, 4, 3, 4, C.light, C.body, C.shade);
  // face on the +x face: eyes
  const ez = z0 + Math.round(bz * 0.58), lk = st.look || 0;
  const eyePts = [P(x1, y0 + 3.5, ez), P(x1, y0 + 9.5, ez)];
  for (const e of eyePts) {
    const ex = Math.round(e[0] + lk * 1), ey = Math.round(e[1] - 1 - lk * 1);
    const big = ISO.k > 1.2;
    if (st.eyes === 'closed') { B.rect(ex - 1, ey + 1, big ? 4 : 3, 1, C.eye); if (big) { B.put(ex - 2, ey, C.eye); B.put(ex + 3, ey, C.eye); } }
    else if (big) { B.rect(ex - 1, ey - 2, 3, 5, C.eye); B.rect(ex - 1, ey - 2, 1, 2, C.white); B.put(ex + 1, ey + 2, mix(C.eye, C.white, 0.35)); }
    else { B.rect(ex, ey - 1, 2, 3, C.eye); B.put(ex, ey - 1, C.white); }
  }
  // blush
  const bl = P(x1, y0 + 12.5, ez - 3); B.rect(Math.round(bl[0]), Math.round(bl[1]), ISO.k > 1.2 ? 3 : 2, 1, C.light); const bl2 = P(x1, y0 + 1.5, ez - 3); if (ISO.k > 1.2) B.rect(Math.round(bl2[0]), Math.round(bl2[1]), 2, 1, C.light);
  if (st.mouth) { const m = P(x1, y0 + 6.5, ez - 4.5); B.rect(Math.round(m[0]) - (ISO.k > 1.2 ? 1 : 0), Math.round(m[1]), ISO.k > 1.2 ? 3 : 2, ISO.k > 1.2 ? 3 : 2, C.dark); }
  else if (st.eyes !== 'closed' && ISO.k > 1.2) { const m = P(x1, y0 + 6.5, ez - 4.5); B.rect(Math.round(m[0]) - 1, Math.round(m[1]) + 1, 3, 1, C.dark); }
  const head = P(hx, hy, zt);
  return { head, top: P(x0 + bx / 2, y0 + by / 2, zt) };
}
function drawZzz(B, head, t, col, out) {
  for (let k = 0; k < 3; k++) {
    const ph = ((t * 0.55 + k / 3) % 1); if (t > 1.3) continue;
    const x = head[0] + 6 + ph * 14 + Math.sin(ph * 6 + k) * 2, y = head[1] - 8 - ph * 26; const s = ph < 0.5 ? 1 : 1;
    if (ph > 0.92) continue;
    if (out) glyph(B, 'z', Math.round(x) - 1, Math.round(y) - 1, out, s), glyph(B, 'z', Math.round(x) + 1, Math.round(y) + 1, out, s);
    glyph(B, 'z', Math.round(x), Math.round(y), col, s);
  }
}
function drawBubble(B, head, a, cols) {
  if (a <= 0) return; const w = 13, h = Math.round(16 * a); if (h < 3) return;
  const x = Math.round(head[0] + 10), y = Math.round(head[1] - 14 - h);
  B.rect(x, y, w, h, cols.out); B.rect(x + 1, y + 1, w - 2, h - 2, cols.fill); B.put(x, y, cols.clear || cols.out);
  B.rect(x + 1, y + h, 2, 2, cols.out); B.put(x + 1, y + h, cols.fill);
  if (a > 0.9) glyph(B, '!', x + 5, y + 3, cols.ink, 2);
}
// paper plane at screen (x,y), heading ang
function drawPlane(B, ps, cols, s = 1.25 * ISO.k) {
  const ca = Math.cos(ps.ang), sa = Math.sin(ps.ang);
  const T = (u, v) => [ps.x + (u * ca - v * sa) * s, ps.y + (u * sa + v * ca) * s];
  const flat = ps.landed > 0.95 ? 0.4 : 1;
  B.poly([T(7, 0), T(-6, -5 * flat), T(-3, 0)], cols.light);
  B.poly([T(7, 0), T(-3, 0), T(-6, 3.5 * flat)], cols.mid);
  B.poly([T(7, 0), T(-3, 0), T(-4, 1.5)], cols.dark);
}
function drawTrail(B, t, H, col) {
  if (t > 1.3) return;
  for (let k = 1; k < 9; k++) { const tt = t - k * 0.035; if (tt < 0) break; const p = planeState(tt, H); if ((k + Math.floor(t * 30)) % 2) continue; B.put(Math.round(p.x - Math.cos(p.ang) * 7), Math.round(p.y - Math.sin(p.ang) * 7), col); }
}

// island of iso columns. cfg: {mask(i,j), T, depth(i,j), cols:{top,topD,topL,lipL,lipR,dirtL,dirtR,strata,stone,root}, seed}
function drawIsland(B, cfg) {
  const T = cfg.T || 16, N = cfg.N || 7, cols = cfg.cols, R = mulberry(cfg.seed || 7);
  const cells = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (cfg.mask(i, j)) cells.push([i, j]);
  cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
  const has = (i, j) => i >= 0 && j >= 0 && i < N && j < N && cfg.mask(i, j);
  for (const [i, j] of cells) {
    const x0 = i * T + (cfg.offX || 0), y0 = j * T + (cfg.offY || 0), zt = cfg.h ? cfg.h(i, j) : 0, d = cfg.depth(i, j), z0 = zt - d;
    // faces
    const x1 = x0 + T, y1 = y0 + T;
    const leftFn = (x, y) => faceTex(x, y, cols.dirtL, cols, 0);
    const rightFn = (x, y) => faceTex(x, y, cols.dirtR, cols, 1);
    if (!has(i, j + 1) || (cfg.h && cfg.h(i, j + 1) < zt)) B.poly([P(x0, y1, zt), P(x1, y1, zt), P(x1, y1, z0), P(x0, y1, z0)], leftFn);
    if (!has(i + 1, j) || (cfg.h && cfg.h(i + 1, j) < zt)) B.poly([P(x1, y0, zt), P(x1, y1, zt), P(x1, y1, z0), P(x1, y0, z0)], rightFn);
    // underside taper teeth
    // top
    B.poly([P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)], (x, y) => topTex(x, y, cols));
    // grass lips with drips
    if (!has(i, j + 1)) lip(B, P(x0, y1, zt), P(x1, y1, zt), cols.lipL, cols.lipD || cols.lipL, i * 31 + j);
    if (!has(i + 1, j)) lip(B, P(x1, y0, zt), P(x1, y1, zt), cols.lipR, cols.lipD || cols.lipR, i * 17 + j * 5 + 3);
    // roots under exposed bottoms
    if (cols.root && (!has(i, j + 1) || !has(i + 1, j))) {
      const n = 1 + Math.floor(hash(i, j, 9) * 2);
      for (let k = 0; k < n; k++) {
        const bx = lerp(x0, x1, 0.2 + 0.6 * hash(i, j, k + 11)), by = !has(i, j + 1) ? y1 : lerp(y0, y1, hash(i, j, k + 3)), bp = P(!has(i, j + 1) ? bx : x1, by, z0);
        const L = 4 + Math.floor(hash(i, j, k + 21) * 12); let x = bp[0], y = bp[1];
        for (let s = 0; s < L; s++) { B.put(x, y + s, cols.root); if (hash(i * 7 + s, j, k) < 0.3) x += hash(i, j * 3 + s, k) < 0.5 ? -1 : 1; }
      }
    }
  }
  function faceTex(x, y, base, c, side) {
    // strata bands (screen-space horizontal-ish, skewed like the face) + clustered stones
    const sk = side ? (x * 0.5) : (-x * 0.5);
    const band = Math.floor((y + sk) / 7);
    let col = base;
    if (((y + sk) % 7 + 7) % 7 < 1 && hash(band, Math.floor(x / 5), 3) < 0.7) col = c.strata;
    const h = hash(Math.floor(x / 3), Math.floor((y + sk) / 2), 5);
    if (h > 0.93) col = c.stone; else if (h < 0.05) col = c.strata;
    return col;
  }
  function topTex(x, y, c) {
    const h = hash(x, y, 1), h2 = hash(Math.floor(x / 2), y, 2);
    if (c.flower && h > 0.992) return c.flower;
    if (h2 > 0.9) return c.topL; if (h2 < 0.08) return c.topD; return c.top;
  }
  function lip(B, a, b, col, dcol, seed) {
    const n = Math.round(Math.abs(b[0] - a[0]));
    for (let k = 0; k <= n; k++) { const u = k / Math.max(1, n), x = Math.round(lerp(a[0], b[0], u)), y = Math.round(lerp(a[1], b[1], u)); B.put(x, y, col); B.put(x, y + 1, col); const L = hash(seed, k, 4) < 0.35 ? 1 + Math.floor(hash(seed, k, 8) * 3) : 0; for (let s = 0; s < L; s++) B.put(x, y + 2 + s, s === L - 1 ? dcol : col); }
  }
}
function drawPlanks(B, x, y, z, cols) {
  for (let k = 0; k < 3; k++) box(B, x + (k % 2) * 2, y + k * 1, z + k * 2, 18, 5, 2, cols.top, cols.side, cols.dark);
}
function drawTreeRound(B, x, y, z, cols, s = 1) {
  box(B, x - 1.5, y - 1.5, z, 3, 3, 14 * s, cols.trunkL, cols.trunk, cols.trunkD);
  const c = P(x, y, z + 18 * s);
  const blobs = [[0, 0, 9], [-6, 3, 6], [6, 2, 6.5], [-2, -6, 6], [3, 5, 5]];
  for (const [dx, dy, r] of blobs) B.circle(c[0] + dx * s, c[1] + dy * s, r * s, (px, py) => { const lx = (px - (c[0] + dx * s - r * s * 0.4)), ly = (py - (c[1] + dy * s - r * s * 0.45)); const d = Math.sqrt(lx * lx + ly * ly) / (r * s); return d < 0.45 ? cols.leafL : d < 1.05 ? cols.leaf : cols.leafD; });
}
function drawMoon(B, cx, cy, r, cols, opt = {}) {
  B.circle(cx, cy, r, (x, y) => {
    const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r; const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    let l = 0.35 + 0.65 * clamp(-dx * 0.55 - dy * 0.35 + nz * 0.75, 0, 1);
    let cr = 0; for (const c of (opt.craters || CRATERS)) { const ex = dx - c[0], ey = dy - c[1], d = Math.sqrt(ex * ex + ey * ey) / c[2]; if (d < 1) { cr = Math.max(cr, d > 0.75 ? (ex + ey > 0 ? 0.6 : -0.4) : -0.55); } }
    l += cr * 0.18 + (fbm(x * 0.08, y * 0.08, 4) - 0.5) * 0.25;
    return [...mix(cols.dark, cols.light, clamp(l, 0, 1))];
  }, opt.dith === undefined ? 34 : opt.dith);
}
const CRATERS = [[-0.35, -0.2, 0.22], [0.25, 0.3, 0.16], [0.4, -0.35, 0.12], [-0.1, 0.5, 0.1], [0.05, -0.05, 0.09], [-0.55, 0.3, 0.1]];
function drawStars(B, t, seed, cols, region, n = 90) {
  const R = mulberry(seed);
  for (let k = 0; k < n; k++) {
    const x = Math.floor(R() * LW), y = Math.floor(R() * region), ph = R() * 6.28, sp = 1 + R() * 3, big = R() < 0.12;
    const tw = 0.5 + 0.5 * Math.sin(t * sp * 2 + ph);
    if (big) { B.put(x, y, cols[0]); if (tw > 0.45) { B.put(x - 1, y, cols[1]); B.put(x + 1, y, cols[1]); B.put(x, y - 1, cols[1]); B.put(x, y + 1, cols[1]); } }
    else B.put(x, y, tw > 0.5 ? cols[0] : cols[1]);
  }
}
function skyGrad(B, stops, y0 = 0, y1 = LH, dith = 30) {
  const S = stops.map(s => [s[0], hex(s[1])]);
  B.rect(0, y0, LW, y1 - y0, (x, y) => { const v = (y - y0) / (y1 - y0); let k = 0; while (k < S.length - 2 && v > S[k + 1][0]) k++; const t = clamp((v - S[k][0]) / (S[k + 1][0] - S[k][0]), 0, 1); return mix(S[k][1], S[k + 1][1], t); }, dith);
}

// ---------------- props ----------------
function drawMailbox(B, x, y, z, c, t) {
  box(B, x, y, z, 2, 2, 12, c.postL, c.post, c.postD);
  box(B, x - 3, y - 2, z + 12, 9, 6, 6, c.boxL, c.box, c.boxD);
  B.poly([P(x - 3, y - 2, z + 18), P(x + 6, y - 2, z + 18), P(x + 6, y + 1, z + 21), P(x - 3, y + 1, z + 21)], c.boxL);
  B.poly([P(x - 3, y + 1, z + 21), P(x + 6, y + 1, z + 21), P(x + 6, y + 4, z + 18), P(x - 3, y + 4, z + 18)], c.box);
  // the little flag pops up when the message arrives
  const up = sm(1.25, 1.4, t); const fz = z + 14 + up * 8, fp = P(x + 6, y - 1, fz);
  box(B, x + 6, y - 1, z + 13, 1, 1, 2 + up * 7, null, c.flag, c.flag); B.rect(Math.round(fp[0]), Math.round(fp[1]) - 1, 4, 3, c.flag);
}
function drawLantern(B, x, y, z, c, t) {
  box(B, x, y, z, 2, 2, 20, c.postL, c.post, c.postD);
  box(B, x - 2, y - 2, z + 20, 6, 6, 6, c.lampL, c.lamp, c.lampD);
  box(B, x - 3, y - 3, z + 26, 8, 8, 2, c.postL, c.post, c.postD);
  const L = P(x + 1, y + 1, z + 23); const fl = 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 7.3);
  B.glow(L[0] - 60, L[1] - 50, L[0] + 60, L[1] + 70, c.glow, (px, py) => { const d = Math.hypot(px - L[0], (py - L[1]) * 1.2); return d < 4 ? 0 : 0.42 * fl * Math.pow(Math.max(0, 1 - d / 48), 2); });
}
function drawMushrooms(B, pts, c) { for (const [x, y, z, s] of pts) { const b = P(x, y, z); B.rect(Math.round(b[0]), Math.round(b[1]) - 3 * s, s, 3 * s, c.stem); B.ellipse(b[0] + s / 2, b[1] - 3 * s, 2.5 * s, 1.5 * s, c.cap); B.put(b[0] - s, b[1] - 3 * s - 1, c.spot); } }
function drawFence(B, pts, c) { for (const [x, y] of pts) box(B, x, y, 0, 2, 2, 7, c.postL, c.post, c.postD); for (let k = 0; k + 1 < pts.length; k++) { const a = P(pts[k][0] + 1, pts[k][1] + 1, 5), b = P(pts[k + 1][0] + 1, pts[k + 1][1] + 1, 5); B.line(a[0], a[1], b[0], b[1], c.postL); const a2 = P(pts[k][0] + 1, pts[k][1] + 1, 2.5), b2 = P(pts[k + 1][0] + 1, pts[k + 1][1] + 1, 2.5); B.line(a2[0], a2[1], b2[0], b2[1], c.post); } }
function drawStones(B, pts, c) { for (const [x, y] of pts) { const p = P(x, y, 0); B.ellipse(p[0], p[1], 3.5 * ISO.k, 1.6 * ISO.k, c.stoneD); B.ellipse(p[0], p[1] - 1, 3 * ISO.k, 1.3 * ISO.k, c.stoneL); } }
// a puffy pixel cloud with a lit top, shaded belly and dithered edge
function pixCloud(B, x, y, w, c, seed) {
  const R = mulberry(seed), puffs = [];
  for (let k = 0; k < 9; k++) { const u = k / 8; puffs.push([x + (u - 0.5) * w + (R() - 0.5) * 6, y - Math.sin(u * Math.PI) * w * 0.18 - R() * 4, w * (0.12 + Math.sin(u * Math.PI) * 0.12 + R() * 0.04)]); }
  for (const [px, py, r] of puffs) B.circle(px, py + 2, r, c.dark);
  for (const [px, py, r] of puffs) B.circle(px, py, r, (qx, qy) => { const d = (qy - (py - r * 0.6)) / (r * 1.6); return d < 0.35 ? c.light : d < 0.75 ? c.mid : c.dark; });
}
