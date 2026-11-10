'use strict';
// ---------------------------------------------------------------
// Oil paint engine: float colour + paint-height buffers, bristle
// strokes with dry-brush breakup over a canvas weave, relief lighting.
// ---------------------------------------------------------------
const PW = 2160, PH = 2700;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let R = mulberry32(20261110);
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

// colour helpers (0..255 in, 0..1 arrays internally)
function C(r, g, b) { return [r / 255, g / 255, b / 255]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
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

const E = {};
function initEngine(S) {
  E.S = S; E.W = Math.round(PW * S); E.H = Math.round(PH * S);
  const N = E.W * E.H;
  E.r = new Float32Array(N); E.g = new Float32Array(N); E.b = new Float32Array(N);
  E.ht = new Float32Array(N); E.weave = new Float32Array(N); E.stamp = new Int32Array(N);
  E.sid = 0; E.count = 0;
  const P = 5.4 * S, W = E.W, H = E.H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / S, fy = y / S;
      const wx = x + (vn(fx * 0.013, fy * 0.21) - 0.5) * 3.2 * S;
      const wy = y + (vn(fx * 0.21 + 40, fy * 0.013) - 0.5) * 3.2 * S;
      let h = 0.5 + 0.5 * Math.cos(Math.PI * wx / P) * Math.cos(Math.PI * wy / P);
      h = h * 0.78 + 0.22 * vn(fx * 0.7 + 3, fy * 0.7 + 8);
      // slubs: occasional thicker threads
      h += (vn(fx * 0.02 + 9, fy * 0.9) - 0.5) * 0.18 + (vn(fx * 0.9, fy * 0.02 + 5) - 0.5) * 0.18;
      const i = y * W + x;
      E.weave[i] = clamp(h, 0, 1);
      // warm toned ground
      const t = fbm(fx * 0.004, fy * 0.004, 3);
      E.r[i] = (50 + 14 * t) / 255; E.g[i] = (32 + 8 * t) / 255; E.b[i] = (40 + 8 * t) / 255;
      E.ht[i] = 0;
    }
  }
}

const PROFS = {
  flat: t => 0.82 + 0.18 * sm(0, 0.12, t),
  taper: t => 1 - 0.8 * t * t,
  lens: t => 0.18 + 0.82 * Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.6),
  tail: t => (0.35 + 0.65 * sm(0, 0.3, t)) * (1 - 0.7 * sm(0.6, 1, t)),
};

// P: flat [x0,y0,x1,y1,...] in full-res units. o: options.
function stroke(P, o) {
  const S = E.S, W = E.W, H = E.H;
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
  let hwTop = 0;
  for (let i = 0; i < n; i++) { hwv[i] = Math.max(0.3, hwMax * prof(L[i] / total)); if (hwv[i] > hwTop) hwTop = hwv[i]; }
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
  const lj = o.lj === undefined ? 0.14 : o.lj;
  const flat = o.flat === undefined ? 0.8 : o.flat;
  const ridge = o.ridge === undefined ? 0.6 : o.ridge;
  const ibs = 1 / ((o.bs || 2.3) * S);
  const lf = (o.lf || 0.012) / S;
  const offA = R() * 900, offB = R() * 900, offC = R() * 900, offD = R() * 900;
  const id = ++E.sid; E.count++;
  const er = E.r, eg = E.g, eb = E.b, eh = E.ht, ew = E.weave, st = E.stamp;
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
        st[idx] = id;
        const u = Li + t;
        let un = u / total; un = un < 0 ? 0 : un > 1 ? 1 : un;
        const v = dist / hw;
        const bc = d * ibs;
        const n1 = vn(bc + offA, u * lf + offB);
        // edge
        let ev = (v + (n1 - 0.5) * rag - s0) / soft; ev = ev < 0 ? 0 : ev > 1 ? 1 : ev;
        const edge = 1 - ev * ev * (3 - 2 * ev);
        if (edge <= 0) continue;
        let aa = hw + 0.5 - dist; if (aa > 1) aa = 1;
        const load = 1 - dry * Math.pow(un, 1.4);
        const q = load * press + (n1 - 0.5) * bk + (ew[idx] - 0.5) * wk;
        let cv = (q - 0.3) * 5; cv = cv < 0 ? 0 : cv > 1 ? 1 : cv; cv = cv * cv * (3 - 2 * cv);
        const a = alpha * edge * aa * cv;
        if (a < 0.004) continue;
        const n2 = vn(bc * 0.23 + offC, u * lf * 0.6 + offD);
        let m = (n2 - 0.3) * 2.5; m = m < 0 ? 0 : m > 1 ? 1 : m; m = m * m * (3 - 2 * m) * mixv;
        const f = 1 + (n1 - 0.5) * lj;
        er[idx] += ((c0 + d0 * m) * f - er[idx]) * a;
        eg[idx] += ((c1 + d1 * m) * f - eg[idx]) * a;
        eb[idx] += ((c2 + d2 * m) * f - eb[idx]) * a;
        if (thick > 0 || flat > 0) {
          let rv = (v - 0.55) / 0.35; rv = rv < 0 ? 0 : rv > 1 ? 1 : rv;
          const tgt = thick * load * (0.3 + 0.7 * n1) * (1 + ridge * rv * rv);
          eh[idx] += a * (tgt - eh[idx] * flat);
        }
      }
    }
  }
}

// transparent glaze / light: mode 'mix' | 'add' | 'mul'
function glaze(cx, cy, rx, ry, col, alpha, pw, mode) {
  const S = E.S, W = E.W, H = E.H;
  cx *= S; cy *= S; rx *= S; ry *= S;
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
  const o1 = R() * 500, o2 = R() * 500;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const r2 = dx * dx + dy * dy; if (r2 >= 1) continue;
    let f = Math.pow(1 - Math.sqrt(r2), pw);
    f *= 0.8 + 0.4 * fbm(x / S * 0.012 + o1, y / S * 0.012 + o2, 3);
    const a = f * alpha; const i = y * W + x;
    if (mode === 'add') { E.r[i] += col[0] * a; E.g[i] += col[1] * a; E.b[i] += col[2] * a; }
    else if (mode === 'mul') { E.r[i] *= 1 + (col[0] - 1) * a; E.g[i] *= 1 + (col[1] - 1) * a; E.b[i] *= 1 + (col[2] - 1) * a; }
    else { E.r[i] += (col[0] - E.r[i]) * a; E.g[i] += (col[1] - E.g[i]) * a; E.b[i] += (col[2] - E.b[i]) * a; }
  }
}

// read back canvas colour (full-res coords)
function pick(x, y) {
  const S = E.S;
  const px = clamp(Math.round(x * S), 0, E.W - 1), py = clamp(Math.round(y * S), 0, E.H - 1);
  const i = py * E.W + px; return [E.r[i], E.g[i], E.b[i]];
}

// relief lighting + output
function finish(ctx) {
  const W = E.W, H = E.H, S = E.S, N = W * H;
  const hh = new Float32Array(N);
  const eh = E.ht, ew = E.weave;
  for (let i = 0; i < N; i++) {
    const h = eh[i];
    hh[i] = h * 2.6 + (ew[i] - 0.5) * 0.85 * Math.exp(-h * 2.2);
  }
  // light blur of relief
  const tmp = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; const xm = x > 0 ? i - 1 : i, xp = x < W - 1 ? i + 1 : i;
    tmp[i] = (hh[xm] + 2 * hh[i] + hh[xp]) * 0.25;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; const ym = y > 0 ? i - W : i, yp = y < H - 1 ? i + W : i;
    hh[i] = (tmp[ym] + 2 * tmp[i] + tmp[yp]) * 0.25;
  }
  const img = ctx.createImageData(W, H), D = img.data;
  const lx = -0.56, ly = -0.83, K = 0.34 / Math.max(S, 0.25);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const xm = x > 0 ? i - 1 : i, xp = x < W - 1 ? i + 1 : i, ym = y > 0 ? i - W : i, yp = y < H - 1 ? i + W : i;
    const gx = (hh[xp] - hh[xm]) * 0.5, gy = (hh[yp] - hh[ym]) * 0.5;
    let s = -(gx * lx + gy * ly) * K * 1.9;  // slope facing light > 0
    s = s < -0.3 ? -0.3 : s > 0.42 ? 0.42 : s;
    let sp = s > 0.1 ? (s - 0.1) : 0; sp = sp * sp * 0.9;
    let r = E.r[i], g = E.g[i], b = E.b[i];
    const lum = 0.3 * r + 0.55 * g + 0.15 * b;
    const k = 1 + s * (0.55 + 0.45 * lum);
    const spk = sp * (0.25 + 0.75 * lum);
    r = r * k + spk * 0.9; g = g * k + spk * 0.95; b = b * k + spk;
    const dz = (hash2(x * 7 + 13, y * 3 + 71) - 0.5) / 255;
    const j = i * 4;
    D[j] = clamp((r + dz) * 255 + 0.5, 0, 255) | 0;
    D[j + 1] = clamp((g + dz) * 255 + 0.5, 0, 255) | 0;
    D[j + 2] = clamp((b + dz) * 255 + 0.5, 0, 255) | 0;
    D[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ---- path helpers (full-res coords) ----
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
  o.w = r * 2; if (!o.prof) o.prof = t => 1;
  stroke([x - Math.cos(ang) * k, y - Math.sin(ang) * k, x + Math.cos(ang) * k, y + Math.sin(ang) * k], o);
}
// offset a path along a side normal chosen to best face (fx,fy)
function offsetPath(P, dist, fx, fy) {
  const n = P.length >> 1, Q = new Array(P.length);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let tx = P[2 * b] - P[2 * a], ty = P[2 * b + 1] - P[2 * a + 1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    let nx = -ty, ny = tx;
    if (nx * fx + ny * fy < 0) { nx = -nx; ny = -ny; }
    const d = typeof dist === 'function' ? dist(i / (n - 1)) : dist;
    Q[2 * i] = P[2 * i] + nx * d; Q[2 * i + 1] = P[2 * i + 1] + ny * d;
  }
  return Q;
}
function subPath(P, i0, i1) { return P.slice(2 * i0, 2 * (i1 + 1)); }
