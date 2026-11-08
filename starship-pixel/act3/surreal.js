// Pass 2 shared surreal language for Act 3: ringed planet, second moon, aurora veils,
// sculpted clouds, floating rock islands, light motes, mirror water. All integer, dithered.
(function () {
  'use strict';
  const { W, H, S, Wm, T, M, A, D, U, buf, P, Pd, get, hl, line, disc, pick, bth, hash, vnoise, clamp, lerp, smooth, ri, DARKER } = PX;

  // ---- giant pale ringed planet ----
  // opt: tilt (ring tilt, rad), flat (ring ellipse ratio), alpha (0..1 opacity), hazeY (fade to 0 at this row),
  // hazeLen, clipY (nothing drawn at/below), light [lx,ly] (toward the light, screen space)
  const BODY = [U[2], U[3], S[6], S[8], S[9]];
  const BODYW = [U[2], U[3], U[4], U[5], Wm[6]];
  function planet(cx, cy, R, opt) {
    opt = opt || {};
    const tilt = opt.tilt === undefined ? -0.3 : opt.tilt, flat = opt.flat || 0.24;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const alpha = opt.alpha === undefined ? 0.92 : opt.alpha;
    let [lx, ly] = opt.light || [-0.6, -0.5]; const lz = 0.62, ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln;
    const lzn = lz / ln;
    const ext = 2.3 * R;
    const y0 = Math.max(0, Math.floor(cy - ext)), y1 = Math.min(opt.clipY === undefined ? H - 1 : opt.clipY - 1, Math.ceil(cy + ext));
    const x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(W - 1, Math.ceil(cx + ext));
    for (let y = y0; y <= y1; y++) {
      let a = alpha;
      if (opt.hazeY !== undefined) a *= clamp((opt.hazeY - y) / (opt.hazeLen || 30), 0, 1);
      if (opt.topFade !== undefined) a *= clamp((y - (cy - R)) / opt.topFade + 0.35, 0, 1);
      if (a <= 0) continue;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const rx = dx * ct + dy * st, ry = -dx * st + dy * ct;
        const d2 = dx * dx + dy * dy, inBody = d2 <= R * R;
        const rr = Math.sqrt(rx * rx + (ry / flat) * (ry / flat)) / R;
        const inRing = rr >= 1.36 && rr <= 2.28 && !(rr > 1.83 && rr < 1.89) && !(rr > 2.12 && rr < 2.15);
        const front = ry > 0;
        let c = -1, la = a;
        if (inRing && (front || !inBody)) {
          // ring bands; the far half sits in the planet's shadow side a little
          if (rr < 1.55) { c = U[6]; la *= 0.7; }
          else if (rr < 1.83) c = (rr > 1.64 && rr < 1.72) ? U[5] : Wm[6];
          else if (rr < 1.95) c = U[3];
          else if (rr < 2.12) c = U[4];
          else { c = U[6]; la *= 0.6; }
          if (!front) c = c === Wm[6] ? U[5] : c === U[5] ? U[4] : c === U[4] ? U[3] : c === U[6] ? U[7] : c;
          // the planet's shadow falls across the far ring behind it
          if (!front && rx * lx < 0 && Math.abs(ry * ct) < R * 0.9 && Math.abs(rx) < R * 1.1) c = U[3];
        } else if (inBody) {
          const nz = Math.sqrt(Math.max(0, 1 - d2 / (R * R)));
          const sh = (dx / R) * lx + (dy / R) * ly + nz * lzn;
          const lat = ry / R + 0.06 * Math.sin(rx / R * 5.0);
          const band = Math.floor((lat + 1) * 4.5);
          const boff = [0.0, 0.3, -0.2, 0.25, -0.3, 0.15, 0.35, -0.1, 0.2, -0.25, 0.1, 0.3, -0.1, 0.2][((band % 14) + 14) % 14];
          let v = 1.3 + sh * 2.4 + boff;
          if (d2 > (R - 1.2) * (R - 1.2) && sh > 0.2) v = 4.2; // lit limb
          c = pick((((band % 3) + 3) % 3) === 1 ? BODYW : BODY, v, x, y);
          // the rings' shadow line across the body
          if (Math.abs(ry + R * 0.12) < 1.0 && sh > -0.2) c = DARKER[c];
        }
        if (c < 0) continue;
        if (la >= 0.999) P(x, y, c); else Pd(x, y, c, la, 0, 0);
      }
    }
  }
  // small second moon: a teal crescent
  function moon2(cx, cy, r, lightDx, alpha) {
    disc(cx, cy, r, 0, (x, y, dx, dy) => {
      const k = (dx * lightDx - dy * 0.35) / r;
      const c = k > 0.35 ? S[9] : k > -0.15 ? U[6] : U[7];
      if (alpha === undefined || alpha >= 1) P(x, y, c); else Pd(x, y, c, alpha, 0, 0);
    });
  }

  // ---- aurora-like veils (daytime): slowly rippling curtains of teal and rose ----
  function aurora(t, x0, x1, ytop, len, strength, ox, oy, under) {
    ox = ox || 0; oy = oy || 0;
    for (let x = x0; x <= x1; x++) {
      const wx = x - ri(ox);
      const I = 0.5 + 0.5 * Math.sin(wx * 0.016 + t * 0.3 + 2 * Math.sin(wx * 0.006 + t * 0.1));
      if (I < 0.25) continue;
      const ray = ((wx % 2) + 2) % 2 === 0;
      // the curtain's lower hem is brightest; rays rise from it and fade upward
      const hem = ytop + oy + 9 * Math.sin(wx * 0.017 + t * 0.25) + 5 * Math.sin(wx * 0.05 - t * 0.4);
      const L = len * strength * Math.pow((I - 0.25) / 0.75, 0.6) * (0.85 + 0.15 * Math.sin(wx * 0.07 + t * 0.5)) * (ray ? 1 : 0.5);
      for (let y = Math.min(H - 1, ri(hem)); y > Math.max(-1, hem - L); y--) {
        if (under && !under(get(x, y))) continue;
        const f = (hem - y) / L;
        if (!ray && bth(x, y) > 0.3 - f * 0.3) continue;
        if (ray && f > 0.2 && bth(x, y) < (f - 0.2) / 0.8) continue;
        P(x, y, f < 0.05 ? U[6] : f < 0.45 ? U[7] : U[8]);
      }
    }
  }

  // ---- iridescent veil: a few parallel silk threads of light curving across the sky ----
  function veil(t, x0, x1, y0, amp, ox, under) {
    const cols = [U[6], S[9], U[5], U[6]];
    for (let x = x0; x <= x1; x++) {
      const wx = x - ri(ox || 0);
      const dens = 0.5 + 0.5 * Math.sin(wx * 0.013 + t * 0.21);
      if (dens < 0.25) continue;
      const yb = y0 + amp * Math.sin(wx * 0.009 + 0.7) + 3 * Math.sin(wx * 0.031 + t * 0.3);
      for (let k = 0; k < cols.length; k++) {
        if (bth(wx + k * 2, k) > (dens - 0.25) / 0.6) continue;
        const y = ri(yb + k * 2);
        if (under && !under(get(x, y))) continue;
        P(x, y, cols[k]);
      }
    }
  }

  // ---- sculpted cloud: union of puffs, flat base, crisp lit rim, rose underside ----
  function cloud(cx, cy, w, seed, cols, ax) {
    cols = cols || { body: S[9], shade: U[5], under: U[4], rim: Wm[6] };
    const n = 4 + ri(hash(seed, 1, 9) * 3);
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const r = w * (0.16 + 0.14 * Math.sin(f * Math.PI)) * (0.8 + 0.4 * hash(seed, i, 3));
      puffs.push([cx - w / 2 + f * w, cy - r * 0.55, r]);
    }
    const base = cy + 2;
    const x0 = ri(cx - w / 2 - w * 0.3), x1 = ri(cx + w / 2 + w * 0.3), y0 = ri(cy - w * 0.6), y1 = ri(base);
    const inside = (x, y) => { if (y > base) return false; for (const [px, py, r] of puffs) { const dx = x + 0.5 - px, dy = y + 0.5 - py; if (dx * dx + dy * dy <= r * r) return true; } return false; };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      let c = cols.body;
      const depth = (base - y) / (w * 0.4);
      if (depth < 0.18) c = cols.under; else if (depth < 0.42) c = (bth(x - (ax || 0), y) < 0.5 ? cols.shade : cols.body);
      if (!inside(x, y - 1)) c = cols.rim;
      else if (!inside(x - 1, y) && depth > 0.3) c = cols.rim;
      P(x, y, c);
    }
  }

  // ---- floating rock island: grassy top, hanging tapered rock ----
  function island(cx, cy, w, seed, cols) {
    cols = cols || { top: U[5], grass: U[3], rock: U[3], dark: U[2], rim: Wm[6] };
    const hw = w / 2, depth = w * 0.9;
    for (let x = ri(cx - hw); x <= ri(cx + hw); x++) {
      const f = (x + 0.5 - cx) / hw;
      const bot = cy + depth * Math.pow(Math.max(0, 1 - Math.abs(f)), 1.4) * (0.75 + 0.25 * hash(x - ri(cx), 2, seed));
      const top = cy - (hash(x - ri(cx), 1, seed) > 0.6 ? 1 : 0);
      for (let y = ri(top); y <= ri(bot); y++) {
        let c = f > 0.15 ? cols.dark : cols.rock;
        if (y === ri(top)) c = cols.top;
        else if (y === ri(top) + 1) c = cols.grass;
        if (y === ri(bot) && f < -0.2) c = cols.rock;
        P(x, y, c);
      }
    }
    P(ri(cx - hw) + 1, ri(cy) - 1, cols.grass); P(ri(cx + hw * 0.2), ri(cy) - 2, cols.grass); // tufts / a little tree
    P(ri(cx + hw * 0.2), ri(cy) - 1, cols.grass);
  }

  // ---- drifting light motes ----
  function motes(t, n, seed, x0, y0, w, h, vx, vy, cols, filter) {
    for (let i = 0; i < n; i++) {
      const px = x0 + (((hash(i, 1, seed) * w + t * vx * (0.6 + 0.8 * hash(i, 3, seed))) % w) + w) % w;
      const py = y0 + (((hash(i, 2, seed) * h + t * vy * (0.6 + 0.8 * hash(i, 4, seed)) + 3 * Math.sin(t * 0.9 + i)) % h) + h) % h;
      const x = ri(px), y = ri(py);
      if (filter && !filter(get(x, y))) continue;
      const tw = Math.sin(t * (1.5 + hash(i, 5, seed) * 2) + i * 1.7);
      if (tw < -0.6) continue;
      const c = cols[i % cols.length];
      P(x, y, c);
      if (tw > 0.85) { P(x + 1, y, c === Wm[6] ? Wm[5] : c); P(x - 1, y, Wm[5]); P(x, y - 1, Wm[5]); P(x, y + 1, Wm[5]); }
    }
  }

  // ---- mirror water: reflect rows above hz into rows below, nearly perfect, with fine ripples ----
  function mirror(t, hz, y1, x0, x1, opt) {
    opt = opt || {};
    for (let y = hz; y <= Math.min(H - 1, y1); y++) {
      const d = y - hz;
      const sy = hz - 1 - Math.floor(d * (opt.squash || 1));
      if (sy < 0) break;
      const amp = (opt.ripple === undefined ? 0.9 : opt.ripple) * Math.min(1, d / 12);
      const off = ri(Math.sin(y * 1.3 + t * 2.1) * amp + Math.sin(y * 0.37 - t * 1.3) * amp * 0.6);
      for (let x = x0; x <= x1; x++) {
        const s = sy * W + clamp(x + off, 0, W - 1);
        let c = buf[s];
        if (opt.tint) c = opt.tint(c, x, y, d);
        buf[y * W + x] = c;
      }
      // glinting ripple lines
      if (opt.glints !== false) for (let x = x0; x <= x1; x++) {
        const r = hash(Math.floor((x + t * (3 + d * 0.3)) / (3 + d * 0.5)), y, 12);
        if (r > 0.965 && d > 1) P(x, y, r > 0.99 ? Wm[6] : U[5]);
      }
    }
  }

  window.SUR = { planet, moon2, aurora, veil, cloud, island, motes, mirror };
})();
