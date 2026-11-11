'use strict';
// ---------------------------------------------------------------------------
// Still Life with Lemon (v2) -- oil paint engine
// Float colour + paint-height buffers ("targets"), bristle strokes with
// dry-brush break-up over a canvas weave, transparent glazes, impasto, relief
// lighting of the paint surface, craquelure.  All randomness is seeded.
// Scene units are full-resolution pixels of the 2160x2700 canvas; a target
// with scale S stores them at S x resolution.
// ---------------------------------------------------------------------------
const PW = 2160, PH = 2700;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let R = mulberry32(20261111);
function reseed(s) { R = mulberry32(s); }
function rnd(a, b) { return b === undefined ? R() * (a === undefined ? 1 : a) : a + R() * (b - a); }
function gauss() { return (R() + R() + R() + R() - 2) * 0.866; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function sm(a, b, x) { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

function hash2(i, j) {
  let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, o) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < o; i++) { s += a * vn(x, y); n += a; a *= 0.5; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; }
  return s / n;
}

// colours: arrays 0..1 (display space, as a painter mixes on the palette)
function C(r, g, b) { return [r / 255, g / 255, b / 255]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function scl(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function jit(c, amt, lam) {
  const l = 1 + (R() - 0.5) * (lam === undefined ? amt * 2 : lam);
  return [clamp((c[0] + (R() - 0.5) * amt) * l, 0, 1), clamp((c[1] + (R() - 0.5) * amt) * l, 0, 1), clamp((c[2] + (R() - 0.5) * amt) * l, 0, 1)];
}
function grad(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      return mix(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
    }
  }
  return stops[stops.length - 1][1];
}
function lumc(c) { return 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2]; }

// ---------------------------------------------------------------- targets
const E = { T: null, count: 0 };
function makeTarget(W, H, S, withAlpha) {
  const N = W * H;
  const T = {
    W, H, S, N,
    r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N),
    ht: new Float32Array(N), weave: new Float32Array(N), stamp: new Int32Array(N), sid: 0,
    al: withAlpha ? new Float32Array(N) : null,
  };
  return T;
}
function setTarget(T) { E.T = T; }

// linen canvas: plain weave with irregular threads and slubs
function weaveAt(fx, fy, P) {
  // plain-weave linen: vertical warp and horizontal weft threads passing
  // over and under each other; uneven thread thickness and slubs
  const wx = fx + (vn(fx * 0.011, fy * 0.17) - 0.5) * 2.4 + (vn(fx * 0.004 + 7, fy * 0.05) - 0.5) * 1.6;
  const wy = fy + (vn(fx * 0.17 + 40, fy * 0.011) - 0.5) * 2.4 + (vn(fx * 0.05 + 3, fy * 0.004 + 1) - 0.5) * 1.6;
  const u = wx / P, v = wy / P, iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
  const thx = 0.78 + 0.32 * vn(iu * 0.37 + 5, fy * 0.02);   // warp thread thickness varies
  const thy = 0.78 + 0.32 * vn(fx * 0.02, iv * 0.37 + 9);
  const tx = Math.pow(Math.max(0, Math.sin(Math.PI * fu)), 0.7) * thx;
  const ty = Math.pow(Math.max(0, Math.sin(Math.PI * fv)), 0.7) * thy;
  const over = ((iu + iv) & 1) ? 1 : 0;
  const bulgeX = Math.sin(Math.PI * fv), bulgeY = Math.sin(Math.PI * fu);
  const warp = tx * (over ? 0.62 + 0.38 * bulgeX : 0.42 + 0.18 * bulgeX);
  const weft = ty * (over ? 0.42 + 0.18 * bulgeY : 0.62 + 0.38 * bulgeY);
  let h = Math.max(warp, weft);
  h = h * 0.85 + 0.15 * vn(fx * 0.6 + 3, fy * 0.6 + 8);
  return clamp(h, 0, 1);
}
function initCanvas(T, groundFn) {
  const S = T.S, W = T.W, H = T.H;
  const P = 4.4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / S, fy = y / S, i = y * W + x;
      T.weave[i] = weaveAt(fx, fy, P);
      const c = groundFn(fx, fy);
      T.r[i] = c[0]; T.g[i] = c[1]; T.b[i] = c[2]; T.ht[i] = 0;
    }
  }
}

const PROFS = {
  flat: t => 0.82 + 0.18 * sm(0, 0.12, t),
  taper: t => 1 - 0.8 * t * t,
  lens: t => 0.18 + 0.82 * Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.6),
  tail: t => (0.35 + 0.65 * sm(0, 0.3, t)) * (1 - 0.7 * sm(0.6, 1, t)),
  point: t => Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.8),
  round: t => 1,
};

// One brush stroke along polyline P = [x0,y0,x1,y1,...] (scene units).
// o: w width, col/col2 paint (col2 streaks in), alpha, prof, thick (impasto),
//    dry (dry-brush toward the end), press, bk (bristle break-up), wk (weave
//    catch), soft, rag, lj (bristle value jitter), flat (levelling of earlier
//    paint), m (Uint8 clip mask), mi (invert mask), bs bristle spacing.
function stroke(P, o) {
  const T = E.T, S = T.S, W = T.W, H = T.H;
  const n = P.length >> 1; if (n < 2) return;
  const X = new Float32Array(n), Y = new Float32Array(n), L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = P[2 * i] * S; Y[i] = P[2 * i + 1] * S;
    if (i) L[i] = L[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  }
  const total = L[n - 1]; if (total < 0.3) return;
  const hwMax = Math.max(0.3, o.w * S * 0.5);
  const prof = typeof o.prof === 'function' ? o.prof : PROFS[o.prof || 'flat'];
  const hwv = new Float32Array(n);
  for (let i = 0; i < n; i++) hwv[i] = Math.max(0.3, hwMax * prof(L[i] / total));
  const col = o.col, col2 = o.col2 || o.col;
  const mixv = o.mixv === undefined ? 0.7 : o.mixv;
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  const thick = o.thick === undefined ? 0.3 : o.thick;
  const dry = o.dry === undefined ? 0.5 : o.dry;
  const press = o.press === undefined ? 1 : o.press;
  const bk = o.bk === undefined ? 0.5 : o.bk;
  const wk = o.wk === undefined ? 0.3 : o.wk;
  const soft = Math.max(0.02, o.soft === undefined ? 0.25 : o.soft);
  const rag = o.rag === undefined ? 0.3 : o.rag;
  const lj = o.lj === undefined ? 0.2 : o.lj;
  const flat = o.flat === undefined ? 0.8 : o.flat;
  const ridge = o.ridge === undefined ? 0.6 : o.ridge;
  const ibs = 1 / ((o.bs || 2.3) * S);
  const lf = (o.lf || 0.012) / S;
  const mk = o.m || null, mi = !!o.mi;
  const offA = R() * 900, offB = R() * 900, offC = R() * 900, offD = R() * 900;
  const id = ++T.sid; E.count++;
  const er = T.r, eg = T.g, eb = T.b, eh = T.ht, ew = T.weave, st = T.stamp, ea = T.al;
  const c0 = col[0], c1 = col[1], c2 = col[2], d0 = col2[0] - c0, d1 = col2[1] - c1, d2 = col2[2] - c2;
  const s0 = 1 - soft;
  for (let i = 0; i < n - 1; i++) {
    const ax = X[i], ay = Y[i], bx = X[i + 1], by = Y[i + 1];
    const len = L[i + 1] - L[i]; if (len < 1e-4) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const h0 = hwv[i], h1 = hwv[i + 1], hm = Math.max(h0, h1) + 1;
    const first = i === 0, last = i === n - 2;
    const e0 = first ? hm : Math.min(hm * 0.7, 2 + hm * 0.35), e1 = last ? hm : Math.min(hm * 0.7, 2 + hm * 0.35);
    const pad = hm * 1.75 + 1;
    let x0 = Math.floor(Math.min(ax, bx) - pad), x1 = Math.ceil(Math.max(ax, bx) + pad);
    let y0 = Math.floor(Math.min(ay, by) - pad), y1 = Math.ceil(Math.max(ay, by) + pad);
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > H - 1) y1 = H - 1;
    const Li = L[i];
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - ay;
      let idx = py * W + x0;
      for (let px = x0; px <= x1; px++, idx++) {
        const dx = px + 0.5 - ax;
        const t = dx * ux + dy * uy;
        if (t < -e0 || t > len + e1) continue;
        const d = dy * ux - dx * uy;
        const tc = t < 0 ? 0 : t > len ? len : t;
        const hw = h0 + (h1 - h0) * tc / len;
        let dist = d < 0 ? -d : d;
        if (first && t < 0) dist = Math.sqrt(t * t + d * d);
        else if (last && t > len) dist = Math.sqrt((t - len) * (t - len) + d * d);
        if (dist >= hw + 0.5) continue;
        if (st[idx] === id) continue;
        let mv = 1;
        if (mk) { mv = mk[idx] / 255; if (mi) mv = 1 - mv; if (mv <= 0.004) continue; }
        st[idx] = id;
        const u = Li + t;
        let un = u / total; un = un < 0 ? 0 : un > 1 ? 1 : un;
        const v = dist / hw;
        const bc = d * ibs;
        let n1 = vn(bc + offA, u * lf + offB);
        n1 = n1 * n1 * (3 - 2 * n1);
        let ev = (v + (n1 - 0.5) * rag - s0) / soft; ev = ev < 0 ? 0 : ev > 1 ? 1 : ev;
        const edge = 1 - ev * ev * (3 - 2 * ev);
        if (edge <= 0) continue;
        let aa = hw + 0.5 - dist; if (aa > 1) aa = 1;
        const load = 1 - dry * Math.pow(un, 1.4);
        const q = load * press + (n1 - 0.5) * bk + (ew[idx] - 0.5) * wk;
        let cv = (q - 0.3) * 5; cv = cv < 0 ? 0 : cv > 1 ? 1 : cv; cv = cv * cv * (3 - 2 * cv);
        const a = alpha * edge * aa * cv * mv;
        if (a < 0.003) continue;
        const n2 = vn(bc * 0.23 + offC, u * lf * 0.6 + offD);
        let m = (n2 - 0.3) * 2.5; m = m < 0 ? 0 : m > 1 ? 1 : m; m = m * m * (3 - 2 * m) * mixv;
        const f = 1 + (n1 - 0.5) * lj;
        er[idx] += ((c0 + d0 * m) * f - er[idx]) * a;
        eg[idx] += ((c1 + d1 * m) * f - eg[idx]) * a;
        eb[idx] += ((c2 + d2 * m) * f - eb[idx]) * a;
        if (ea) ea[idx] += (1 - ea[idx]) * a;
        if (thick > 0 || flat > 0) {
          let rv = (v - 0.55) / 0.35; rv = rv < 0 ? 0 : rv > 1 ? 1 : rv;
          const tgt = thick * load * (0.3 + 0.7 * n1) * (1 + ridge * rv * rv);
          eh[idx] += a * (tgt - eh[idx] * flat);
        }
      }
    }
  }
}

// soft transparent glaze/scumble over an ellipse; mode 'mix' | 'add' | 'mul'
function glaze(cx, cy, rx, ry, col, alpha, pw, mode, mk, wk) {
  const T = E.T, S = T.S, W = T.W, H = T.H;
  cx *= S; cy *= S; rx *= S; ry *= S;
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
  const o1 = R() * 500, o2 = R() * 500;
  wk = wk === undefined ? 0.5 : wk;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const r2 = dx * dx + dy * dy; if (r2 >= 1) continue;
    let f = Math.pow(1 - Math.sqrt(r2), pw);
    f *= 0.75 + 0.5 * fbm(x / S * 0.01 + o1, y / S * 0.01 + o2, 3);
    const i = y * W + x;
    // glaze pools in the weave valleys
    f *= 1 + (0.5 - T.weave[i]) * wk;
    let a = f * alpha; if (mk) a *= mk[i] / 255;
    if (mode === 'add') { T.r[i] += col[0] * a; T.g[i] += col[1] * a; T.b[i] += col[2] * a; }
    else if (mode === 'mul') { T.r[i] *= 1 + (col[0] - 1) * a; T.g[i] *= 1 + (col[1] - 1) * a; T.b[i] *= 1 + (col[2] - 1) * a; }
    else { T.r[i] += (col[0] - T.r[i]) * a; T.g[i] += (col[1] - T.g[i]) * a; T.b[i] += (col[2] - T.b[i]) * a; }
  }
}

function pick(x, y) {
  const T = E.T, S = T.S;
  const px = clamp(Math.round(x * S), 0, T.W - 1), py = clamp(Math.round(y * S), 0, T.H - 1);
  const i = py * T.W + px; return [T.r[i], T.g[i], T.b[i]];
}
// blurred pick (5 taps)
function pickB(x, y, r) {
  const a = pick(x, y), b = pick(x - r, y - r * 0.5), c = pick(x + r, y + r * 0.5), d = pick(x + r * 0.5, y - r), e = pick(x - r * 0.5, y + r);
  return [(a[0] * 2 + b[0] + c[0] + d[0] + e[0]) / 6, (a[1] * 2 + b[1] + c[1] + d[1] + e[1]) / 6, (a[2] * 2 + b[2] + c[2] + d[2] + e[2]) / 6];
}

// Uint8 mask from a coverage function cov(x,y) in scene units -> 0..1, over a box
function makeMask(T, box, cov) {
  const S = T.S, M = new Uint8Array(T.N);
  const x0 = Math.max(0, Math.floor(box[0] * S)), y0 = Math.max(0, Math.floor(box[1] * S));
  const x1 = Math.min(T.W - 1, Math.ceil(box[2] * S)), y1 = Math.min(T.H - 1, Math.ceil(box[3] * S));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = cov((x + 0.5) / S, (y + 0.5) / S);
    if (v > 0) M[y * T.W + x] = Math.round(clamp(v, 0, 1) * 255);
  }
  M.box = [box[0], box[1], box[2], box[3]];
  return M;
}
function maskAt(M, x, y) {
  const T = E.T, S = T.S;
  const px = clamp(Math.floor(x * S), 0, T.W - 1), py = clamp(Math.floor(y * S), 0, T.H - 1);
  return M[py * T.W + px] / 255;
}

// ---------------------------------------------------------------- relief
// Lit colour of a rectangle of paint. src: {r,g,b,ht} arrays laid out with
// stride sw; weave likewise.  Writes RGB into out (3 per pixel, stride ow).
// Pixels within 2 px of the rect border use clamped neighbours, so callers
// that need exact agreement with a larger render pass a 2 px margin.
const RELIEF = { lx: -0.6, ly: -0.8, S: 1 };
function reliefRect(sr, sg, sb, sh, swv, sw, rw, rh, out) {
  const N = rw * rh, S = RELIEF.S;
  const hh = new Float32Array(N), tmp = new Float32Array(N);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = y * rw + x, j = y * sw + x;
    const h = sh[j];
    hh[i] = h * 5.5 + (swv[j] - 0.5) * 1.5 * Math.exp(-h * 3.2);
  }
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = y * rw + x; const xm = x > 0 ? i - 1 : i, xp = x < rw - 1 ? i + 1 : i;
    tmp[i] = (hh[xm] + 2 * hh[i] + hh[xp]) * 0.25;
  }
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = y * rw + x; const ym = y > 0 ? i - rw : i, yp = y < rh - 1 ? i + rw : i;
    hh[i] = (tmp[ym] + 2 * tmp[i] + tmp[yp]) * 0.25;
  }
  const lx = RELIEF.lx, ly = RELIEF.ly, Kk = 0.42 / Math.max(S, 0.25);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = y * rw + x, j = y * sw + x;
    const xm = x > 0 ? i - 1 : i, xp = x < rw - 1 ? i + 1 : i, ym = y > 0 ? i - rw : i, yp = y < rh - 1 ? i + rw : i;
    const gx = (hh[xp] - hh[xm]) * 0.5, gy = (hh[yp] - hh[ym]) * 0.5;
    let s = -(gx * lx + gy * ly) * Kk * 1.9;
    s = s < -0.3 ? -0.3 : s > 0.42 ? 0.42 : s;
    let sp = s > 0.1 ? (s - 0.1) : 0; sp = sp * sp * 0.9;
    // thin paint: the ground glints on the thread tops, darker paint lies in the valleys
    const thin = Math.exp(-sh[j] * 4), wv = (swv[j] - 0.5) * 0.14 * thin;
    let r = sr[j] * (1 + wv), g = sg[j] * (1 + wv), b = sb[j] * (1 + wv);
    const lum = 0.3 * r + 0.55 * g + 0.15 * b;
    const k = 1 + s * (0.5 + 0.5 * lum);
    const spk = sp * (0.2 + 0.8 * lum);
    out[3 * i] = r * k + spk * 0.92; out[3 * i + 1] = g * k + spk * 0.95; out[3 * i + 2] = b * k + spk * 0.9;
  }
}
function reliefTarget(T) {
  RELIEF.S = T.S;
  const out = new Float32Array(T.N * 3);
  reliefRect(T.r, T.g, T.b, T.ht, T.weave, T.W, T.W, T.H, out);
  return out;
}

// ---------------------------------------------------------------- craquelure
// returns Float32Array crack strength 0..1 (fine polygonal network, varnish age)
function craquelure(W, H, S) {
  const out = new Float32Array(W * H);
  const cell = 15 * S;
  const jx = (i, j) => hash2(i * 3 + 1, j * 7 + 5), jy = (i, j) => hash2(i * 11 + 2, j * 5 + 9);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = x / S, fy = y / S;
    // anisotropy + warping: cells slightly elongated, edges wander
    const wx = x + (vn(fx * 0.03, fy * 0.03) - 0.5) * cell * 0.9;
    const wy = y + (vn(fx * 0.03 + 50, fy * 0.03 + 20) - 0.5) * cell * 0.9;
    const gx = wx / (cell * 1.25), gy = wy / cell;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    let d1 = 1e9, d2 = 1e9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i + 0.15 + 0.7 * jx(ix + i, iy + j), cy = iy + j + 0.15 + 0.7 * jy(ix + i, iy + j);
      const dx = (gx - cx) * 1.25, dy = gy - cy;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    const e = (Math.sqrt(d2) - Math.sqrt(d1)) * cell; // ~ distance to cell border in px
    const pres = sm(0.35, 0.6, fbm(fx * 0.004 + 3, fy * 0.004 + 1, 3));
    const wid = 0.28 * S + 0.25 * S * vn(fx * 0.05, fy * 0.05);
    out[y * W + x] = (1 - sm(0, wid + 0.5, e)) * (0.15 + 0.85 * pres) * (0.5 + 0.5 * vn(fx * 0.09, fy * 0.09));
  }
  return out;
}

// ---------------------------------------------------------------- paths
function seg(x0, y0, x1, y1, wob, step) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.ceil(len / (step || 8)));
  const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
  const o = R() * 300, P = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = wob ? (vn(t * len * 0.02 + o, o) - 0.5) * 2 * wob : 0;
    P.push(x0 + (x1 - x0) * t + nx * w, y0 + (y1 - y0) * t + ny * w);
  }
  return P;
}
function arc(x, y, ang, len, curv, wob, step) {
  step = step || 6;
  const n = Math.max(2, Math.ceil(len / step)), P = [x, y], o = R() * 300;
  for (let i = 0; i < n; i++) {
    ang += curv * step + (wob ? (vn(i * step * 0.03 + o, o) - 0.5) * wob : 0);
    x += Math.cos(ang) * step; y += Math.sin(ang) * step; P.push(x, y);
  }
  return P;
}
function dab(x, y, r, o, ang) {
  ang = ang === undefined ? R() * 6.283 : ang;
  const k = r * (o.el === undefined ? 0.25 : o.el);
  o.w = r * 2; if (!o.prof) o.prof = 'round';
  stroke([x - Math.cos(ang) * k, y - Math.sin(ang) * k, x + Math.cos(ang) * k, y + Math.sin(ang) * k], o);
}
// stroke following a direction field
function flowPath(x, y, len, dirFn, step, sign) {
  step = step || 6; sign = sign || 1;
  let a = dirFn(x, y);
  const P = [x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5];
  let px = P[0], py = P[1];
  for (let s = 0; s < len; s += step) {
    a = dirFn(px, py);
    px += Math.cos(a) * step; py += Math.sin(a) * step; P.push(px, py);
  }
  return P;
}
// a field of strokes over a box, centres stratified + shuffled
function paintField(n, box, colFn, dirFn, o) {
  const [x0, y0, x1, y1] = box;
  const asp = (x1 - x0) / Math.max(1, (y1 - y0));
  const ny = Math.max(1, Math.round(Math.sqrt(n / asp))), nx = Math.max(1, Math.round(n / ny));
  const order = [];
  for (let i = 0; i < nx * ny; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
  for (const k of order) {
    const gx = k % nx, gy = (k / nx) | 0;
    const x = x0 + (gx + R()) / nx * (x1 - x0), y = y0 + (gy + R()) / ny * (y1 - y0);
    if (o.place && !o.place(x, y)) { R(); R(); continue; }
    const ws = o.wscale ? o.wscale(x, y) : 1;
    const len = rnd(o.len[0], o.len[1]) * ws, w = rnd(o.w[0], o.w[1]) * ws;
    const step = Math.max(3, Math.min(w * 0.35, 10));
    let P;
    if (o.straight) {
      const a = dirFn(x, y), cv = gauss() * (o.curl === undefined ? 0.6 : o.curl) / len;
      P = []; let aa = a - cv * len * 0.5, px = x - Math.cos(a) * len * 0.5, py = y - Math.sin(a) * len * 0.5;
      P.push(px, py);
      for (let s = 0; s < len; s += step) { aa += cv * step; px += Math.cos(aa) * step; py += Math.sin(aa) * step; P.push(px, py); }
    } else P = flowPath(x, y, len, dirFn, step);
    const col = jit(colFn(x, y), o.cj === undefined ? 0.03 : o.cj, o.lj2);
    const col2 = jit(colFn(x + gauss() * w * 0.8, y + gauss() * w * 0.8), (o.cj === undefined ? 0.03 : o.cj) * 1.6, o.lj2);
    const so = Object.assign({}, o.s, { w: w, col: col, col2: col2 });
    if (o.salpha) so.alpha = (so.alpha === undefined ? 1 : so.alpha) * o.salpha(x, y);
    if (o.sfn) o.sfn(x, y, so);
    stroke(P, so);
  }
}

// soften wet paint inside a box (scene units): separable box blur of the
// colour, mixed back by amt (times the mask, if any).  Height is untouched,
// so brush relief and canvas weave survive the blending.
function blendPass(box, rad, amt, mk) {
  const T = E.T, S = T.S, W = T.W;
  const x0 = Math.max(0, Math.floor(box[0] * S)), y0 = Math.max(0, Math.floor(box[1] * S));
  const x1 = Math.min(T.W - 1, Math.ceil(box[2] * S)), y1 = Math.min(T.H - 1, Math.ceil(box[3] * S));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, r = Math.max(1, Math.round(rad * S));
  for (const ch of [T.r, T.g, T.b]) {
    const a = new Float32Array(bw * bh), b = new Float32Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) a[y * bw + x] = ch[(y + y0) * W + x + x0];
    for (let y = 0; y < bh; y++) {
      let s = 0, n = 0;
      for (let x = -r; x <= r; x++) if (x >= 0 && x < bw) { s += a[y * bw + x]; n++; }
      for (let x = 0; x < bw; x++) {
        b[y * bw + x] = s / n;
        const xo = x - r, xi = x + r + 1;
        if (xo >= 0) { s -= a[y * bw + xo]; n--; }
        if (xi < bw) { s += a[y * bw + xi]; n++; }
      }
    }
    for (let x = 0; x < bw; x++) {
      let s = 0, n = 0;
      for (let y = -r; y <= r; y++) if (y >= 0 && y < bh) { s += b[y * bw + x]; n++; }
      for (let y = 0; y < bh; y++) {
        a[y * bw + x] = s / n;
        const yo = y - r, yi = y + r + 1;
        if (yo >= 0) { s -= b[yo * bw + x]; n--; }
        if (yi < bh) { s += b[yi * bw + x]; n++; }
      }
    }
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = (y + y0) * W + x + x0;
      let k = amt; if (mk) k *= mk[i] / 255;
      ch[i] += (a[y * bw + x] - ch[i]) * k;
    }
  }
}

// dead-colouring: lay a smooth colour field under the strokes, inside a mask
function fillMask(mk, colFn, alpha, thick) {
  const T = E.T, S = T.S, W = T.W;
  const b = mk.box;
  const x0 = Math.max(0, Math.floor(b[0] * S)), y0 = Math.max(0, Math.floor(b[1] * S));
  const x1 = Math.min(T.W - 1, Math.ceil(b[2] * S)), y1 = Math.min(T.H - 1, Math.ceil(b[3] * S));
  alpha = alpha === undefined ? 1 : alpha; thick = thick || 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x, m = mk[i]; if (!m) continue;
    const c = colFn((x + 0.5) / S, (y + 0.5) / S); if (!c) continue;
    const a = m / 255 * alpha;
    T.r[i] += (c[0] - T.r[i]) * a; T.g[i] += (c[1] - T.g[i]) * a; T.b[i] += (c[2] - T.b[i]) * a;
    T.ht[i] += (thick - T.ht[i]) * a;
  }
}
