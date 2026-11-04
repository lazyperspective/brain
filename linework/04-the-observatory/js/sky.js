// The Observatory: sky. Posterised night bands, thousands of concentric star trails around
// the celestial pole, a stippled Milky Way band, scattered stars with glints, a meteor.
'use strict';
(function () {
  const OB = window.OB;
  const { clamp, smooth, mix, css, hex } = OB;

  OB.mwCoord = (S, x, y) => {
    const m = S.mw;
    const dx = m.bx - m.ax, dy = m.by - m.ay, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L;
    const px = x - m.ax, py = y - m.ay;
    const u = (px * ux + py * uy) / L;
    let d = px * -uy + py * ux; // signed perpendicular distance
    d += m.bend * Math.sin(u * Math.PI); // gentle bow
    return [u, d];
  };

  OB.makeMW = (S) => {
    const N = OB.noise(21);
    S.mwDensity = (x, y) => {
      const [u, d] = OB.mwCoord(S, x, y);
      const hw = S.mw.hw * (0.85 + 0.3 * (0.5 + 0.5 * N.fbm(u * 2.6, 0.5, 3)));
      const dd = d + hw * 0.25 * N.fbm(u * 3.1, 4.2, 3);
      const core = Math.exp(-(dd * dd) / (hw * hw));
      const rd = d - hw * (0.1 + 0.25 * N.fbm(u * 4.0, 3.3, 3));
      const rift = Math.exp(-(rd * rd) / Math.pow(hw * (0.1 + 0.08 * N(u * 9, 1.1)), 2)) * smooth(-0.25, 0.35, N.fbm(u * 5, 7.7, 3) + 0.15);
      const clump = 0.5 + 0.5 * N.fbm(x * 0.0035, y * 0.0035, 4);
      const knots = Math.pow(clamp(N.fbm(x * 0.009 + 5, y * 0.009, 3) * 1.6), 2);
      return clamp(core * (0.5 + 0.65 * clump + 0.45 * knots) * (1 - 0.7 * rift));
    };
  };

  OB.drawSky = (ctx, S) => {
    const W = OB.W, R = OB.rng(11), N = OB.noise(12);
    const P = S.pole, C = OB.C;
    const skyBot = 2560;
    const skyPath = new Path2D();
    skyPath.rect(-10, -10, W + 20, skyBot + 10);

    // ---- 1. posterised night bands (a stack of flat screen-print tones)
    const tone = (x, y) => {
      let t = clamp(y / 2200);
      t = 0.82 * Math.pow(t, 1.25) + 0.18 * t;
      t += 0.035 * N.fbm(x * 0.0011, y * 0.0013, 3);
      t += 0.3 * S.mwDensity(x, y);
      t += 0.06 * Math.exp(-Math.pow(Math.hypot(x - S.slit.x, y - S.slit.y) / 520, 2));
      return t;
    };
    S.skyTone = tone;
    OB.posterFill(ctx, skyPath, [0, 0, W, skyBot], tone, C.skyTones, { step: 8, dither: 0.02, noReg: true });

    // ---- 2. star trails
    const baseL = 0.58;
    // breathing room around the dome: trails thin out near the lit building
    const ox = S.obs.cx, oy = S.obs.y0 - 60;
    const cov = (x, y) => {
      const h = clamp(y / 2150);
      const nearDome = Math.exp(-Math.pow(Math.hypot(x - ox, (y - oy) * 1.1) / 520, 2));
      const rp = Math.hypot(x - P.x, y - P.y);
      return (0.1 + 0.4 * Math.pow(h, 1.6) - 0.22 * S.mwDensity(x, y) * smooth(300, 700, rp) + 0.04 * N.fbm(x * 0.002, y * 0.002, 2)) * (1 - 0.72 * nearDome);
    };
    const arcs = [];
    const mk = (r, th, L, b) => {
      const temp = R();
      let col, kind = 0;
      // colour only as a hint: warm or teal stars are rare and pale
      if (temp < 0.02) { col = mix(C.trailOrange, C.trailCream, 0.35); kind = 1; }
      else if (temp < 0.05) { col = mix(C.trailGold, C.trailCream, 0.4); kind = 1; }
      else if (temp < 0.08) { col = mix(C.trailTeal, C.trailBlue, 0.45); kind = 2; }
      else col = mix(C.trailBlue, C.trailCream, R());
      return { r, th, L, b, col, kind, w: 0.45 + 0.5 * b + 3.2 * b * b * b, a: 0.16 + 0.84 * Math.pow(b, 0.6) };
    };
    for (let r = 5; r < 2500;) {
      r += r < 90 ? 2.6 + R() * 1.4 : 1.7 + R() * 2.3;
      let th = R() * OB.TAU;
      const stop = th + OB.TAU;
      while (th < stop) {
        // a few long bright trails, many faint short ones
        let b = Math.pow(R(), 3.4);
        if (R() < 0.0035) b = 0.85 + 0.15 * R();
        const L = baseL * (0.22 + 0.5 * Math.pow(R(), 1.5) + 1.25 * Math.pow(b, 0.8));
        const mid = th + L / 2;
        const mx = P.x + r * Math.cos(mid), my = P.y + r * Math.sin(mid);
        if (mx > -300 && mx < W + 300 && my > -300 && my < skyBot) {
          if (R() < Math.max(0, cov(mx, my)) * 1.5) {
            // near the horizon the air glows: trails a touch brighter
            b = clamp(b + 0.05 * smooth(1500, 2150, my));
            arcs.push(mk(r, th, L, b));
          }
        }
        th += L * (0.3 + R() * 1.0) + baseL * 0.12 * R();
      }
    }
    // the pole star itself
    arcs.push(Object.assign(mk(13, 2.2, 0.62, 1), { col: C.trailCream, kind: 3 }));
    arcs.sort((a, b) => a.b - b.b);
    S.trailCount = arcs.length;

    const drawArcs = (list) => {
      const B = new OB.Batch();
      for (const a of list) {
        const segs = Math.max(4, Math.ceil((a.r * a.L) / 3.5));
        const pts = [];
        const ph = a.r * 0.37 + a.th;
        for (let k = 0; k <= segs; k++) {
          const th = a.th + (a.L * k) / segs;
          const rr = a.r + 0.6 * OB.N(k * 0.09 + ph, ph);
          pts.push([P.x + rr * Math.cos(th), P.y + rr * Math.sin(th)]);
        }
        const m = pts[segs >> 1];
        const wm = OB.warm(m[0], m[1], 'sky');
        let col = a.col, al = a.a * (0.78 + 0.35 * smooth(900, 2150, m[1]));
        if (wm > 0.02) { col = mix(col, C.amberHot, Math.min(1, wm * 1.4)); al = Math.min(1, al + wm * 0.5); }
        const q = (v) => Math.round(v / 6) * 6;
        const key = css([q(col[0]), q(col[1]), q(col[2])], Math.round(clamp(al) * 20) / 20);
        OB.ink(B.get(key), pts, a.w * (1 + wm * 0.6), { t0: 0.2, t1: 0.35, wn: 0.35, ph, min: 0.1 });
        a.end = pts[0];
        a.mid = m;
      }
      B.fill(ctx);
    };
    const dim = arcs.filter((a) => a.b < 0.55), bright = arcs.filter((a) => a.b >= 0.55);
    drawArcs(dim);

    // ---- 3. Milky Way: stratified (blue-noise) stipple through the trails
    {
      const B = new OB.Batch();
      const cell = 2.7;
      const cols = [css(C.trailCream, 0.95), css(C.trailBlue, 0.9), css(C.trailGold, 0.9), css(C.trailCream, 0.55)];
      for (let y = 0; y < 2300; y += cell) {
        for (let x = 0; x < W; x += cell) {
          const d = S.mwDensity(x, y);
          if (d < 0.02) continue;
          if (R() > Math.min(1, Math.pow(d, 0.95) * 1.1)) continue;
          const px = x + R() * cell, py = y + R() * cell;
          const rr = 0.42 + 1.0 * Math.pow(R(), 5) + (R() < 0.006 ? 1.2 : 0);
          const c = R();
          const key = c < 0.5 ? cols[0] : c < 0.75 ? cols[3] : c < 0.94 ? cols[1] : cols[2];
          const p = B.get(key);
          p.moveTo(px + rr, py);
          p.arc(px, py, rr, 0, OB.TAU);
        }
      }
      // field stars everywhere
      for (let y = 0; y < 2300; y += 15) {
        for (let x = 0; x < W; x += 15) {
          if (R() > 0.11) continue;
          const px = x + R() * 15, py = y + R() * 15;
          const rr = 0.45 + 1.1 * Math.pow(R(), 4);
          const p = B.get(R() < 0.7 ? cols[3] : cols[0]);
          p.moveTo(px + rr, py);
          p.arc(px, py, rr, 0, OB.TAU);
        }
      }
      B.fill(ctx);
    }

    drawArcs(bright);

    // ---- 4. glints at the heads of the brightest trails
    {
      const heads = bright.filter((a) => a.b > 0.72 && a.r > 60).sort((a, b) => b.b - a.b);
      const chosen = [];
      for (const a of heads) {
        if (chosen.length >= 16) break;
        if (a.end[1] > 1950 || a.end[1] < 20 || a.end[0] < 20 || a.end[0] > W - 20) continue;
        if (chosen.some((c) => OB.dist(c.end, a.end) < 260)) continue;
        chosen.push(a);
      }
      chosen.push(arcs.find((a) => a.kind === 3));
      for (const a of chosen) OB.starGlint(ctx, a.end[0], a.end[1], 0.8 + a.b * 1.4, a.col);
    }

    // ---- 5. meteor
    OB.meteor(ctx, S.meteor);
  };

  OB.starGlint = (ctx, x, y, s, col) => {
    const C = OB.C;
    OB.glow(ctx, x, y, 22 * s, mix(col, C.trailCream, 0.5), 0.22);
    const P = new Path2D();
    const spike = (dx, dy, L, w) => {
      OB.ribbon(P, [[x - dx * L, y - dy * L], [x - dx * L * 0.2, y - dy * L * 0.2], [x, y], [x + dx * L * 0.2, y + dy * L * 0.2], [x + dx * L, y + dy * L]], [0.05, w * 0.5, w, w * 0.5, 0.05]);
    };
    spike(1, 0, 15 * s, 1.5 * s);
    spike(0, 1, 18 * s, 1.5 * s);
    spike(0.707, 0.707, 6 * s, 0.9 * s);
    spike(0.707, -0.707, 6 * s, 0.9 * s);
    P.moveTo(x + 2.4 * s, y);
    P.arc(x, y, 2.4 * s, 0, OB.TAU);
    ctx.fillStyle = css(mix(col, [255, 255, 255], 0.5));
    ctx.fill(P);
  };

  OB.meteor = (ctx, m) => {
    const C = OB.C;
    const n = 80;
    const pts = [], ws = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([m.x0 + (m.x1 - m.x0) * t + 2 * OB.N(t * 3, 9), m.y0 + (m.y1 - m.y0) * t]);
      ws.push(0.2 + 5.5 * Math.pow(t, 2.2));
    }
    // faint teal ionisation sheath, then the white streak, then a warm head
    const sheath = new Path2D();
    OB.ribbon(sheath, pts, ws.map((w, i) => w * 3.2 + 1.5 * (i / n)));
    ctx.fillStyle = css(C.trailTeal, 0.16);
    ctx.fill(sheath);
    const core = new Path2D();
    OB.ribbon(core, pts, ws);
    ctx.fillStyle = css(mix(C.trailCream, [255, 255, 255], 0.4), 0.95);
    ctx.fill(core);
    const hx = m.x1, hy = m.y1;
    OB.glow(ctx, hx, hy, 70, C.amberHot, 0.35);
    ctx.fillStyle = css([255, 246, 220]);
    ctx.beginPath();
    ctx.arc(hx, hy, 4.2, 0, OB.TAU);
    ctx.fill();
    // fragments
    const R = OB.rng(77);
    for (let k = 0; k < 7; k++) {
      const t = 0.75 + R() * 0.2;
      const x = m.x0 + (m.x1 - m.x0) * t + (R() - 0.5) * 14, y = m.y0 + (m.y1 - m.y0) * t + (R() - 0.5) * 14;
      ctx.fillStyle = css(C.amberHot, 0.8);
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + R() * 1.2, 0, OB.TAU);
      ctx.fill();
    }
  };
})();
