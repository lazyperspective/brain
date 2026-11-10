'use strict';
// ---------- the reference "underpainting": sky, ridge, snow ground, farmhouse, smoke ----------
// Everything here is only a colour/structure guide for the brush passes; the final surface is built from strokes.
const REG = { SKY: 0, RIDGE: 1, GROUND: 2, HOUSE: 3, SMOKE: 4 };

const SKY_STOPS = [
  [0.00, [16, 18, 62]], [0.22, [30, 38, 100]], [0.48, [54, 70, 144]],
  [0.72, [98, 114, 178]], [0.90, [166, 166, 206]], [1.00, [214, 194, 210]],
];
const GROUND_STOPS = [ // by depth Z (m)
  [2.0, [40, 46, 108]], [5, [58, 68, 138]], [11, [90, 104, 172]], [24, [138, 148, 202]], [55, [176, 178, 218]], [200, [196, 192, 222]],
];
function stops(tbl, v) {
  if (v <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) {
    if (v <= tbl[i][0]) {
      const a = tbl[i - 1], b = tbl[i]; const t = (v - a[0]) / (b[0] - a[0]);
      return [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t];
    }
  }
  return tbl[tbl.length - 1][1];
}
function houseGeom() {
  const hp = proj(HOUSE.X, 0, HOUSE.Z);
  return { x: hp[0], y: hp[1], s: hp[2] };
}

function buildReference(W, H, trees) {
  const K = W / 1080;
  const noise = new Noise(4242), noise2 = new Noise(991);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const hg = houseGeom();
  const winX = hg.x + (-0.5) * hg.s, winY = hg.y - 1.9 * hg.s; // window centre (design units)
  const YH = CAM.YH;
  // ---- sky + ground per pixel ----
  for (let y = 0; y < H; y++) {
    const dy = y / K;
    for (let x = 0; x < W; x++) {
      const dx = x / K;
      const o = (y * W + x) * 4;
      let r, g, b;
      if (dy < YH) {
        const t = dy / YH;
        const c = stops(SKY_STOPS, t);
        r = c[0]; g = c[1]; b = c[2];
        // horizontal cloud banks
        const wx = dx / 420, wy = dy / 120;
        const warp = noise.n2(wx * 0.6 + 3.1, wy * 0.8) * 0.9;
        const n1 = noise.fbm(wx + warp, wy * 1.7 + 0.5 * warp, 4, 2.0, 0.5);
        const n1b = noise.fbm(wx + warp, wy * 1.7 + 0.5 * warp + 0.04, 4, 2.0, 0.5);
        const cloud = smooth(-0.08, 0.38, n1);
        const rim = clamp((n1b - n1) * 38, -1, 1); // vertical gradient -> underlit edges
        const upper = 1 - smooth(0.0, 0.9, t) * 0.4;
        // darker, violet-grey cloud masses
        const dark = cloud * upper * 0.5;
        r = r * (1 - dark * 0.55) + 22 * dark; g = g * (1 - dark * 0.62) + 8 * dark; b = b * (1 - dark * 0.35) + 46 * dark;
        // lit undersides toward the horizon glow
        const lit = Math.max(0, rim) * smooth(0.25, 0.85, t) * cloud * 0.8;
        r += 70 * lit; g += 54 * lit; b += 30 * lit;
        // thin streaky haze
        const st = noise2.n2(dx / 700, dy / 22) * 0.5 + noise2.n2(dx / 260, dy / 9) * 0.5;
        const sk = st * 7 * (0.4 + t);
        r += sk; g += sk; b += sk * 1.1;
        // warm afterglow behind the farmhouse
        const gw = Math.exp(-Math.pow((dx - hg.x) / 330, 2)) * smooth(0.6, 1.0, t);
        const w = gw * 0.62;
        r = r + (238 - r) * w; g = g + (170 - g) * w * 0.9; b = b + (152 - b) * w * 0.8;
      } else {
        const dd = dy - YH + 0.5;
        const Z = CAM.H * CAM.F / dd;
        const X = (dx - CAM.VPX) * Z / CAM.F;
        const c = stops(GROUND_STOPS, Z);
        // drift relief (perspective-correct)
        const fa = Math.exp(-Z / 80);
        const hh = (X0, Z0) => {
          let v = 0.55 * noise.n2(X0 * 0.30 + 5, Z0 * 0.16) + 0.3 * noise.n2(X0 * 0.8 + 11, Z0 * 0.45) + 0.12 * noise2.n2(X0 * 2.2, Z0 * 1.3);
          // lane depressions (tracks)
          const ax = Math.abs(X0 - 0.2);
          v -= 0.16 * Math.exp(-Math.pow((ax - 0.95) / 0.25, 2));
          return v;
        };
        const e = 0.12;
        const h0 = hh(X, Z), hz = hh(X, Z + e), hx = hh(X + e, Z);
        const sz = (hz - h0) / e, sx = (hx - h0) / e;
        let sh = clamp(0.5 - 0.55 * sz - 0.18 * sx, 0, 1);
        sh = 0.5 + (sh - 0.5) * (0.35 + 0.65 * fa);
        const lr = c[0] * 1.3 + 14, lg = c[1] * 1.27 + 14, lb = c[2] * 1.12 + 10;
        const sr = c[0] * 0.62, sg = c[1] * 0.6, sb = c[2] * 0.84 + 4;
        r = sr + (lr - sr) * sh; g = sg + (lg - sg) * sh; b = sb + (lb - sb) * sh;
        // finer sparkle variation
        const fv = noise2.n2(X * 4.2, Z * 2.6) * 0.04 * fa;
        r *= 1 + fv; g *= 1 + fv; b *= 1 + fv;
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.scale(K, K);

  // ---- tree pools / crown shade on the snow ----
  for (const t of trees) {
    if (t.Z > 140) continue;
    const p = proj(t.X, 0, t.Z);
    const rx = 2.4 * p[2] * (t.spread / 2.2), ry = Math.max(2, CAM.H * CAM.F * 2.2 / (t.Z * t.Z) * (t.spread / 2.2));
    const a = 0.5 * Math.exp(-t.Z / 70);
    ctx.save();
    ctx.translate(p[0], p[1]); ctx.scale(1, ry / rx);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(26,22,78,${a})`); gr.addColorStop(0.55, `rgba(30,28,90,${a * 0.6})`); gr.addColorStop(1, 'rgba(34,34,100,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  // ---- window light on the snow (screen blend, hue shifts orange -> rose -> violet) ----
  {
    const ground = ctx.getImageData(0, Math.floor(YH * K), W, H - Math.floor(YH * K));
    const gd = ground.data;
    const gh = ground.height;
    const hy0 = hg.y + 4;
    for (let yy = 0; yy < gh; yy++) {
      const dy = (yy + Math.floor(YH * K)) / K;
      for (let x = 0; x < W; x++) {
        const dx = x / K;
        const ex = (dx - winX) / 250, ey = (dy - hy0) / 38;
        let a = Math.exp(-(ex * ex + ey * ey * (dy > hy0 ? 0.55 : 1.6)));
        const below = Math.max(0, dy - hy0);
        const sw = 34 + below * 0.7;
        const ex2 = (dx - winX) / sw;
        a += 0.55 * Math.exp(-ex2 * ex2) * Math.exp(-below / 95) * (dy >= hy0 - 6 ? 1 : 0);
        a = Math.min(1, a) * 0.95;
        if (a < 0.003) continue;
        const o = (yy * W + x) * 4;
        const wr = 1.0 * a, wg = 0.60 * a, wb = 0.22 * a;
        gd[o] = 255 - (255 - gd[o]) * (1 - wr);
        gd[o + 1] = 255 - (255 - gd[o + 1]) * (1 - wg);
        gd[o + 2] = 255 - (255 - gd[o + 2]) * (1 - wb);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(ground, 0, Math.floor(YH * K));
    ctx.restore(); ctx.save(); ctx.scale(K, K);
  }

  // ---- far ridge / hedgerow in haze ----
  {
    ctx.save();
    ctx.filter = `blur(${1.6 * K}px)`;
    const grd = ctx.createLinearGradient(0, YH - 26, 0, YH + 1);
    grd.addColorStop(0, 'rgb(150,148,200)'); grd.addColorStop(1, 'rgb(108,104,160)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.moveTo(0, YH + 2);
    for (let x = 0; x <= 1080; x += 6) {
      const hh = 7 + 9 * (noise.n2(x / 90, 7.7) * 0.5 + 0.5) + 5 * noise.n2(x / 26, 2.2) + 8 * Math.exp(-Math.pow((x - 190) / 140, 2)) + 6 * Math.exp(-Math.pow((x - 930) / 180, 2));
      ctx.lineTo(x, YH - hh);
    }
    ctx.lineTo(1080, YH + 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // region map
  const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
  const rctx = rc.getContext('2d', { willReadFrequently: true });
  rctx.fillStyle = 'rgb(0,0,0)'; rctx.fillRect(0, 0, W, H);
  rctx.save(); rctx.scale(K, K);
  rctx.fillStyle = `rgb(${REG.GROUND * 40},0,0)`; rctx.fillRect(0, YH, 1080, 1350 - YH);
  rctx.fillStyle = `rgb(${REG.RIDGE * 40},0,0)`;
  rctx.beginPath(); rctx.moveTo(0, YH + 1);
  for (let x = 0; x <= 1080; x += 6) {
    const hh = 7 + 9 * (noise.n2(x / 90, 7.7) * 0.5 + 0.5) + 5 * noise.n2(x / 26, 2.2) + 8 * Math.exp(-Math.pow((x - 190) / 140, 2)) + 6 * Math.exp(-Math.pow((x - 930) / 180, 2));
    rctx.lineTo(x, YH - hh);
  }
  rctx.lineTo(1080, YH + 1); rctx.closePath(); rctx.fill();
  rctx.restore();

  return { cv, ctx, rc, rctx, K, hg, winX, winY };
}

// Draw house + smoke into the ref canvas and region map (called once, after ground ref exists)
function drawHouse(ref) {
  const { ctx, rctx, K, hg } = ref;
  const s = hg.s, bx = hg.x, by = hg.y;
  const X = (m) => bx + m * s, Y = (m) => by - m * s;
  const polys = (c, fn) => { c.save(); c.scale(K, K); fn(c); c.restore(); };
  const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  const wallTop = 2.7, ridge = 4.45;
  polys(ctx, (c) => {
    // lean-to on left
    let g = c.createLinearGradient(0, Y(2.1), 0, Y(0));
    g.addColorStop(0, 'rgb(48,46,92)'); g.addColorStop(1, 'rgb(30,30,70)');
    c.fillStyle = g; c.fillRect(X(-6.0), Y(2.0), 3.0 * s, 2.0 * s);
    // lean-to roof (snow)
    g = c.createLinearGradient(0, Y(2.7), 0, Y(1.95));
    g.addColorStop(0, 'rgb(176,182,224)'); g.addColorStop(1, 'rgb(120,128,188)');
    c.fillStyle = g; poly(c, [[X(-6.3), Y(1.95)], [X(-5.3), Y(2.55)], [X(-2.9), Y(2.85)], [X(-2.9), Y(2.0)]]); c.fill();
    // main wall
    g = c.createLinearGradient(0, Y(wallTop), 0, Y(0));
    g.addColorStop(0, 'rgb(58,54,104)'); g.addColorStop(0.7, 'rgb(40,38,84)'); g.addColorStop(1, 'rgb(28,28,66)');
    c.fillStyle = g; c.fillRect(X(-3.2), Y(wallTop), 6.4 * s, wallTop * s);
    // chimney (behind roof)
    c.fillStyle = 'rgb(62,44,70)'; c.fillRect(X(1.55), Y(5.55), 0.85 * s, 2.2 * s);
    c.fillStyle = 'rgb(196,200,236)'; c.fillRect(X(1.45), Y(5.7), 1.05 * s, 0.32 * s);
    // roof main plane (snow covered)
    g = c.createLinearGradient(0, Y(ridge), 0, Y(wallTop - 0.2));
    g.addColorStop(0, 'rgb(206,210,240)'); g.addColorStop(0.5, 'rgb(170,176,222)'); g.addColorStop(1, 'rgb(126,130,190)');
    c.fillStyle = g; poly(c, [[X(-3.6), Y(wallTop - 0.15)], [X(-2.5), Y(ridge)], [X(2.9), Y(ridge)], [X(3.7), Y(wallTop - 0.15)]]); c.fill();
    // eave shadow
    c.fillStyle = 'rgb(40,34,78)'; c.fillRect(X(-3.4), Y(wallTop - 0.1), 6.9 * s, 0.22 * s);
    // snow lumps along eave
    c.fillStyle = 'rgb(168,174,220)';
    for (let i = 0; i < 12; i++) { c.beginPath(); c.ellipse(X(-3.4 + i * 0.6 + 0.15 * Math.sin(i * 3.1)), Y(wallTop - 0.1), 0.3 * s, 0.17 * s, 0, 0, 6.3); c.fill(); }
    // dark window
    g = c.createLinearGradient(0, Y(2.2), 0, Y(1.0)); g.addColorStop(0, 'rgb(30,34,80)'); g.addColorStop(1, 'rgb(18,20,52)');
    c.fillStyle = g; c.fillRect(X(-2.35), Y(2.2), 0.85 * s, 1.1 * s);
    c.fillStyle = 'rgb(88,96,150)'; c.fillRect(X(-2.35), Y(2.2), 0.85 * s, 0.14 * s);
    // door
    c.fillStyle = 'rgb(24,22,52)'; c.fillRect(X(1.1), Y(2.05), 0.95 * s, 2.05 * s);
    c.fillStyle = 'rgb(130,138,196)'; c.fillRect(X(1.05), Y(2.12), 1.05 * s, 0.1 * s);
    // snow bank at the base
    c.fillStyle = 'rgb(112,122,186)';
    c.beginPath(); c.ellipse(X(-1), Y(0.05), 4.6 * s, 0.32 * s, 0, 0, 6.3); c.fill();
    c.fillStyle = 'rgb(150,158,206)';
    c.beginPath(); c.ellipse(X(1.5), Y(0.04), 2.6 * s, 0.2 * s, 0, 0, 6.3); c.fill();
    // glow on wall
    const wcx = X(-0.5), wcy = Y(1.55);
    g = c.createRadialGradient(wcx, wcy, 0, wcx, wcy, 3.2 * s);
    g.addColorStop(0, 'rgba(255,170,70,0.62)'); g.addColorStop(0.35, 'rgba(240,130,70,0.28)'); g.addColorStop(1, 'rgba(200,90,110,0)');
    c.save(); c.beginPath(); c.rect(X(-3.2), Y(wallTop), 6.4 * s, wallTop * s); c.clip();
    c.fillStyle = g; c.fillRect(wcx - 4 * s, wcy - 4 * s, 8 * s, 8 * s); c.restore();
    // the lit window
    const wx0 = X(-0.95), wy0 = Y(2.05), ww = 0.9 * s, wh = 1.1 * s;
    c.fillStyle = 'rgb(46,26,30)'; c.fillRect(wx0 - 0.1 * s, wy0 - 0.1 * s, ww + 0.2 * s, wh + 0.2 * s);
    g = c.createLinearGradient(0, wy0, 0, wy0 + wh);
    g.addColorStop(0, 'rgb(255,236,160)'); g.addColorStop(0.5, 'rgb(255,190,84)'); g.addColorStop(1, 'rgb(238,118,34)');
    c.fillStyle = g; c.fillRect(wx0, wy0, ww, wh);
    c.fillStyle = 'rgba(120,52,24,0.8)';
    c.fillRect(wx0 + ww / 2 - 0.035 * s, wy0, 0.07 * s, wh); c.fillRect(wx0, wy0 + wh / 2 - 0.035 * s, ww, 0.07 * s);
    // curtain hint
    c.fillStyle = 'rgba(200,86,40,0.55)'; c.fillRect(wx0, wy0, 0.2 * s, wh * 0.7);
    // sill snow
    c.fillStyle = 'rgb(190,196,236)'; c.fillRect(wx0 - 0.12 * s, wy0 + wh + 0.06 * s, ww + 0.24 * s, 0.14 * s);
    // snow cap on roof edge lines
    c.strokeStyle = 'rgba(224,228,250,0.9)'; c.lineWidth = 0.14 * s; c.beginPath(); c.moveTo(X(-2.5), Y(ridge)); c.lineTo(X(2.9), Y(ridge)); c.stroke();
  });
  // smoke column (straight up, widening and thinning)
  const sx = X(2.0), sy = Y(5.75);
  const smoke = (c, regionMode) => {
    const n = 60;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = sy - t * 262;
      const x = sx + 6 * Math.sin(t * 3.0 + 0.4) + 2.5 * Math.sin(t * 9.0);
      const rad = 5 + 30 * Math.pow(t, 0.85);
      if (regionMode) { c.fillStyle = `rgb(${REG.SMOKE * 40},0,0)`; c.beginPath(); c.arc(x, y, rad * 0.9, 0, 6.3); c.fill(); continue; }
      const a = 0.34 * Math.pow(1 - t, 1.35) + 0.015;
      const gr = c.createRadialGradient(x, y, 0, x, y, rad);
      const col = t < 0.3 ? [168, 160, 190] : [136, 140, 188];
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`); gr.addColorStop(0.6, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.6})`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, rad, 0, 6.3); c.fill();
    }
  };
  polys(ctx, (c) => smoke(c, false));
  // region map for the house
  polys(rctx, (c) => {
    c.fillStyle = `rgb(${REG.HOUSE * 40},0,0)`;
    c.fillRect(X(-6.0), Y(2.0), 3.0 * s, 2.0 * s);
    poly(c, [[X(-6.3), Y(1.95)], [X(-5.3), Y(2.55)], [X(-2.9), Y(2.85)], [X(-2.9), Y(2.0)]]); c.fill();
    c.fillRect(X(-3.2), Y(wallTop), 6.4 * s, wallTop * s);
    c.fillRect(X(1.45), Y(5.7), 1.05 * s, 2.5 * s);
    poly(c, [[X(-3.6), Y(wallTop - 0.15)], [X(-2.5), Y(ridge)], [X(2.9), Y(ridge)], [X(3.7), Y(wallTop - 0.15)]]); c.fill();
    c.beginPath(); c.ellipse(X(-1), Y(0.05), 4.6 * s, 0.32 * s, 0, 0, 6.3); c.fill();
    smoke(c, true);
  });
}

function readRef(ref, W, H) {
  const id = ref.ctx.getImageData(0, 0, W, H).data;
  const N = W * H;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0, o = 0; i < N; i++, o += 4) { R[i] = id[o] / 255; G[i] = id[o + 1] / 255; B[i] = id[o + 2] / 255; }
  const rd = ref.rctx.getImageData(0, 0, W, H).data;
  const reg = new Uint8Array(N);
  for (let i = 0, o = 0; i < N; i++, o += 4) reg[i] = Math.round(rd[o] / 40);
  return { R, G, B, reg };
}
