// px.js — tiny indexed-colour pixel engine for "Self-Portrait".
// Everything is drawn into 480x270 buffers of palette indices (255 = transparent).
// No anti-aliasing anywhere: the only way to make an in-between tone is an
// ordered Bayer 4x4 dither or a palette LUT that snaps to the nearest palette colour.
(function (g) {
  'use strict';
  const W = 480, H = 270, TR = 255;

  // ---- master palette (shared ramps across all scenes) ----------------------
  const HEX = {
    // night: violet-black -> blue -> pale lavender (rich darks, never grey)
    N0: '000000', N1: '06041a', N2: '0c0930', N3: '131046', N4: '1b185c', N5: '262374',
    N6: '34338e', N7: '4a4baa', N8: '6769c4', N9: '8d8fdb', N10: 'bbbcee', N11: 'e8e8fb',
    // amber / lantern ramp up to a pale hot core
    A0: '240a14', A1: '4a1512', A2: '7a2c10', A3: 'b04a12', A4: 'de7418', A5: 'f6a12e',
    A6: 'fdcb5c', A7: 'ffeaa6', A8: 'fffbe6',
    // surreal family
    T0: '06222f', T1: '0b3f4d', T2: '12666e', T3: '239a90', T4: '62d3b4', T5: 'bff5df',
    R0: '2e0c2c', R1: '5c1844', R2: '96295a', R3: 'd24c74', R4: 'f48da0', R5: 'fdcfd0',
    V0: '22104a', V1: '421a78', V2: '6f30a8', V3: 'a55ad0', V4: 'd49cec',
    O0: 'a85238', O1: 'd98455', O2: 'f4b688', O3: 'fbdcc0',
    M0: '241c3a', M1: '3d3156', M2: '63527a', M3: '947f9f'
  };
  const NAMES = Object.keys(HEX), C = {}, RGB = [];
  NAMES.forEach((n, i) => {
    C[n] = i;
    const v = parseInt(HEX[n], 16);
    RGB.push([(v >> 16) & 255, (v >> 8) & 255, v & 255]);
  });
  const NC = NAMES.length;
  const ramp = (p, n) => { const r = []; for (let i = 0; i < n; i++) r.push(C[p + i]); return r; };
  const RAMP = { N: ramp('N', 12), A: ramp('A', 9), T: ramp('T', 6), R: ramp('R', 6), V: ramp('V', 5), O: ramp('O', 4), M: ramp('M', 4) };
  const LUM = RGB.map(c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255);

  // ---- deterministic randomness ---------------------------------------------
  function rng(seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.i = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.chance = p => f() < p;
    f.r = (lo, hi) => lo + f() * (hi - lo);
    return f;
  }
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => B4[((y & 3) << 2) | (x & 3)];

  // ---- LUTs -------------------------------------------------------------------
  function nearest(r, gg, b) {
    let best = 0, bd = 1e12;
    for (let i = 0; i < NC; i++) {
      const c = RGB[i], dr = c[0] - r, dg = c[1] - gg, db = c[2] - b;
      const d = dr * dr * 0.30 + dg * dg * 0.50 + db * db * 0.20;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function hexRGB(h) { const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  // mix every palette colour toward a tint and snap back to the palette
  function mixLUT(tint, s) {
    const t = typeof tint === 'string' ? hexRGB(tint) : RGB[tint];
    const L = new Uint8Array(256);
    for (let i = 0; i < NC; i++) {
      const c = RGB[i];
      L[i] = nearest(c[0] + (t[0] - c[0]) * s, c[1] + (t[1] - c[1]) * s, c[2] + (t[2] - c[2]) * s);
    }
    L[TR] = TR;
    return L;
  }
  // add light (screen-ish) and snap
  function addLUT(tint, s) {
    const t = typeof tint === 'string' ? hexRGB(tint) : RGB[tint];
    const L = new Uint8Array(256);
    for (let i = 0; i < NC; i++) {
      const c = RGB[i];
      L[i] = nearest(Math.min(255, c[0] + t[0] * s), Math.min(255, c[1] + t[1] * s), Math.min(255, c[2] + t[2] * s));
    }
    L[TR] = TR;
    return L;
  }
  // multiply (shadow) and snap
  function mulLUT(tint, s) {
    const t = typeof tint === 'string' ? hexRGB(tint) : RGB[tint];
    const L = new Uint8Array(256);
    for (let i = 0; i < NC; i++) {
      const c = RGB[i];
      const k = j => c[j] * (1 - s + s * t[j] / 255);
      L[i] = nearest(k(0), k(1), k(2));
    }
    L[TR] = TR;
    return L;
  }
  function idLUT() { const L = new Uint8Array(256); for (let i = 0; i < 256; i++) L[i] = i; return L; }
  // step every colour n steps down (n<0) or up its own ramp; bottoms out in N1/N0
  function stepLUT(n, floorC) {
    const L = idLUT();
    for (const k in RAMP) {
      const r = RAMP[k];
      for (let i = 0; i < r.length; i++) {
        const j = i + n;
        if (j < 0) L[r[i]] = (floorC !== undefined ? floorC : (k === 'N' ? C.N0 : C.N1));
        else L[r[i]] = r[Math.min(r.length - 1, j)];
      }
    }
    if (floorC !== undefined && n < 0) { L[C.N0] = C.N0; }
    return L;
  }
  const LUT = {
    id: idLUT(),
    dark1: mulLUT('3a3080', 0.55), dark2: mulLUT('241c66', 0.8), dark3: mulLUT('100c40', 0.95),
    dn1: stepLUT(-1), dn2: stepLUT(-2), dn3: stepLUT(-3), dn4: stepLUT(-4), dn5: stepLUT(-5), dn6: stepLUT(-6),
    up1: stepLUT(1), up2: stepLUT(2),
    warm1: addLUT('ff8a20', 0.10), warm2: addLUT('ff8a20', 0.22), warm3: addLUT('ff9426', 0.38),
    warm4: addLUT('ffa030', 0.58), warm5: addLUT('ffb44a', 0.85),
    cool1: mixLUT('34338e', 0.3), cool2: mixLUT('262374', 0.55), cool3: mixLUT('1b185c', 0.75),
    water: mulLUT('2a2a96', 0.72), water2: mulLUT('16145a', 0.9),
    teal1: addLUT('20c0b0', 0.15), teal2: addLUT('20c0b0', 0.3),
    rose1: addLUT('f04880', 0.15), rose2: addLUT('f04880', 0.3),
    moon1: addLUT('8080ff', 0.12), moon2: addLUT('9090ff', 0.25), moon3: addLUT('a0a0ff', 0.4)
  };

  // ---- buffers ----------------------------------------------------------------
  function mk(w, h, fill) { const b = { w: w, h: h, d: new Uint8Array(w * h) }; b.d.fill(fill === undefined ? TR : fill); return b; }
  function clear(b, c) { b.d.fill(c === undefined ? TR : c); }
  function copy(dst, src) { dst.d.set(src.d); }
  function px(b, x, y, c) { if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
  function get(b, x, y) { return (x >= 0 && y >= 0 && x < b.w && y < b.h) ? b.d[y * b.w + x] : TR; }
  function rect(b, x, y, w, h, c) {
    let x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(b.w, x + w), y1 = Math.min(b.h, y + h);
    if (x1 <= x0) return;
    for (let yy = y0; yy < y1; yy++) b.d.fill(c, yy * b.w + x0, yy * b.w + x1);
  }
  function hl(b, x, y, w, c) { rect(b, x, y, w, 1, c); }
  function vl(b, x, y, h, c) { rect(b, x, y, 1, h, c); }
  function box(b, x, y, w, h, c) { hl(b, x, y, w, c); hl(b, x, y + h - 1, w, c); vl(b, x, y, h, c); vl(b, x + w - 1, y, h, c); }
  // dithered rect: lv 0..16 = coverage
  function dith(b, x, y, w, h, c, lv, ox, oy) {
    ox = ox | 0; oy = oy | 0;
    let x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(b.w, x + w), y1 = Math.min(b.h, y + h);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (bay(xx + ox, yy + oy) < lv) b.d[yy * b.w + xx] = c;
  }
  function line(b, x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (; ;) {
      px(b, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function ell(b, cx, cy, rx, ry, c, lv) {
    const y0 = Math.max(0, Math.ceil(cy - ry)), y1 = Math.min(b.h - 1, Math.floor(cy + ry));
    for (let y = y0; y <= y1; y++) {
      const dy = (y - cy) / (ry || 1), s = 1 - dy * dy;
      if (s < 0) continue;
      const hw = rx * Math.sqrt(s);
      const xa = Math.max(0, Math.ceil(cx - hw)), xb = Math.min(b.w - 1, Math.floor(cx + hw));
      if (lv === undefined) { if (xb >= xa) b.d.fill(c, y * b.w + xa, y * b.w + xb + 1); }
      else for (let x = xa; x <= xb; x++) if (bay(x, y) < lv) b.d[y * b.w + x] = c;
    }
  }
  function disc(b, cx, cy, r, c, lv) { ell(b, cx, cy, r, r, c, lv); }
  function ring(b, cx, cy, r, c) { // 1px circle outline
    let x = Math.round(r), y = 0, e = 1 - x;
    cx |= 0; cy |= 0;
    while (x >= y) {
      px(b, cx + x, cy + y, c); px(b, cx - x, cy + y, c); px(b, cx + x, cy - y, c); px(b, cx - x, cy - y, c);
      px(b, cx + y, cy + x, c); px(b, cx - y, cy + x, c); px(b, cx + y, cy - x, c); px(b, cx - y, cy - x, c);
      y++;
      if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
    }
  }
  function poly(b, pts, c, lv) {
    let ymin = 1e9, ymax = -1e9;
    for (const p of pts) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
    ymin = Math.max(0, Math.ceil(ymin)); ymax = Math.min(b.h - 1, Math.floor(ymax));
    const n = pts.length;
    for (let y = ymin; y <= ymax; y++) {
      const xs = [];
      const yc = y + 0.001;
      for (let i = 0; i < n; i++) {
        const a = pts[i], q = pts[(i + 1) % n];
        if ((a[1] <= yc && q[1] > yc) || (q[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (q[1] - a[1]) * (q[0] - a[0]));
      }
      xs.sort((u, v) => u - v);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.max(0, Math.round(xs[i])), xb = Math.min(b.w - 1, Math.round(xs[i + 1]) - 1);
        if (lv === undefined) { if (xb >= xa) b.d.fill(c, y * b.w + xa, y * b.w + xb + 1); }
        else for (let x = xa; x <= xb; x++) if (bay(x, y) < lv) b.d[y * b.w + x] = c;
      }
    }
  }
  // generic per-pixel shader for building static layers
  function shade(b, x0, y0, x1, y1, fn) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(b.w, x1); y1 = Math.min(b.h, y1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * b.w + x, c = fn(x, y, b.d[i]);
      if (c >= 0) b.d[i] = c;
    }
  }
  // vertical gradient through a list of colours with an ordered-dither transition
  function vgrad(b, x, y, w, h, cols, soft) {
    soft = soft === undefined ? 1 : soft;
    const n = cols.length;
    shade(b, x, y, x + w, y + h, (xx, yy) => {
      const f = (yy - y) / Math.max(1, h - 1) * (n - 1);
      let k = Math.floor(f + 0.5 + ((bay(xx, yy) + 0.5) / 16 - 0.5) * soft);
      return cols[k < 0 ? 0 : k >= n ? n - 1 : k];
    });
  }
  // sprites from ASCII art
  function spr(rows, map) {
    const h = rows.length; let w = 0;
    for (const r of rows) w = Math.max(w, r.length);
    const s = mk(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch !== '.' && ch !== ' ' && map[ch] !== undefined) s.d[y * w + x] = map[ch];
    }
    return s;
  }
  // blit src over dst. o: {lut, fx, fy, lv (dither coverage), sx,sy,sw,sh (source rect)}
  function blit(dst, src, dx, dy, o) {
    o = o || {};
    const L = o.lut, fx = o.fx, fy = o.fy, lv = o.lv;
    const sx = o.sx | 0, sy = o.sy | 0, sw = o.sw === undefined ? src.w - sx : o.sw, sh = o.sh === undefined ? src.h - sy : o.sh;
    const dd = dst.d, sd = src.d, dw = dst.w, dh = dst.h;
    for (let y = 0; y < sh; y++) {
      const ty = dy + y; if (ty < 0 || ty >= dh) continue;
      const ry = (fy ? sy + sh - 1 - y : sy + y) * src.w;
      const row = ty * dw;
      for (let x = 0; x < sw; x++) {
        const tx = dx + x; if (tx < 0 || tx >= dw) continue;
        let c = sd[ry + (fx ? sx + sw - 1 - x : sx + x)];
        if (c === TR) continue;
        if (lv !== undefined && bay(tx, ty) >= lv) continue;
        dd[row + tx] = L ? L[c] : c;
      }
    }
  }
  // fast opaque-aware full-frame layer blit with integer offset
  function layer(dst, src, ox, oy) {
    const dd = dst.d, sd = src.d, dw = dst.w, dh = dst.h, sw = src.w, sh = src.h;
    const y0 = Math.max(0, oy), y1 = Math.min(dh, oy + sh), x0 = Math.max(0, ox), x1 = Math.min(dw, ox + sw);
    for (let y = y0; y < y1; y++) {
      let si = (y - oy) * sw + (x0 - ox), di = y * dw + x0;
      for (let x = x0; x < x1; x++, si++, di++) { const c = sd[si]; if (c !== TR) dd[di] = c; }
    }
  }
  function lutRect(b, x, y, w, h, L, lv, ox, oy) {
    ox = ox | 0; oy = oy | 0;
    let x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(b.w, x + w), y1 = Math.min(b.h, y + h);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      if (lv !== undefined && bay(xx + ox, yy + oy) >= lv) continue;
      const i = yy * b.w + xx; b.d[i] = L[b.d[i]];
    }
  }
  // banded glow: radii inner->outer, luts same length. ry/rx squash, dw = dither width in px at band edges
  function glow(b, cx, cy, radii, luts, o) {
    o = o || {};
    const sq = o.sq || 1, dw = o.dw === undefined ? 2 : o.dw, n = radii.length, R = radii[n - 1] + dw;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(b.w - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R * sq)), y1 = Math.min(b.h - 1, Math.ceil(cy + R * sq));
    const clip = o.clip;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (clip && (x < clip[0] || y < clip[1] || x >= clip[2] || y >= clip[3])) continue;
      const dx = x - cx, dy = (y - cy) / sq;
      const d = Math.sqrt(dx * dx + dy * dy) + ((bay(x, y) + 0.5) / 16 - 0.5) * dw;
      let k = 0; while (k < n && d >= radii[k]) k++;
      if (k >= n) continue;
      const L = luts[k]; if (!L) continue;
      const i = y * b.w + x; b.d[i] = L[b.d[i]];
    }
  }
  function glyph(b, gl, x, y, c) {
    const w = gl.w, h = gl.h, bits = gl.b;
    for (let yy = 0; yy < h; yy++) {
      const ty = y + yy; if (ty < 0 || ty >= b.h) continue;
      for (let xx = 0; xx < w; xx++) if (bits[yy * w + xx]) { const tx = x + xx; if (tx >= 0 && tx < b.w) b.d[ty * b.w + tx] = c; }
    }
  }
  // two-frame ordered-dither mix: write src where bay<lv
  function mix(dst, src, lv, ox, oy) {
    if (lv <= 0) return; ox = ox | 0; oy = oy | 0;
    const dd = dst.d, sd = src.d, w = dst.w;
    if (lv >= 16) { dd.set(sd); return; }
    for (let y = 0, i = 0; y < dst.h; y++) for (let x = 0; x < w; x++, i++) if (bay(x + ox, y + oy) < lv) dd[i] = sd[i];
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = sat(t); return t * t * (3 - 2 * t); };
  const ease = t => { t = sat(t); return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t); };
  const prog = (t, a, b) => sat((t - a) / (b - a));

  // palette index buffer -> RGBA ImageData-ish
  const PAL32 = new Uint32Array(256);
  for (let i = 0; i < NC; i++) PAL32[i] = (255 << 24) | (RGB[i][2] << 16) | (RGB[i][1] << 8) | RGB[i][0];
  PAL32[TR] = 0xffff00ff;
  function toRGBA(b, out32) { const d = b.d; for (let i = 0; i < d.length; i++) out32[i] = PAL32[d[i]]; }

  g.PX = {
    W, H, TR, C, RGB, RAMP, LUM, NC, NAMES, LUT, rng, hash, bay, B4, nearest, mixLUT, addLUT, mulLUT, stepLUT, idLUT,
    mk, clear, copy, px, get, rect, hl, vl, box, dith, line, ell, disc, ring, poly, shade, vgrad, spr, blit, layer,
    lutRect, glow, glyph, mix, clamp, sat, lerp, smooth, ease, prog, toRGBA
  };
})(typeof window !== 'undefined' ? window : globalThis);
