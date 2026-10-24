// IV. THE SEA (panorama) — thin tonal glazes. Its left edge still holds the
// afterglow of III, the sun's hard rays softened to shafts of light; to the right
// the dusk deepens into night. The last feather rests on the water.
SC.WORLD.tonal = async function (S) {
  const DH = SC.DH, HZ = SC.HZ, SUN = SC.SUN;
  const X0 = 2760, X1 = 4000;
  const Ly = SC.layer(X0, X1, S, true);
  const ctx = Ly.ctx, hctx = Ly.hctx;
  const R = new L.Rand(4409), N = L.noise2(21), N2 = L.noise2(22);
  const P = (h) => L.hex(h);
  const [FX, FY] = SC.FEATHER;

  // ---------- colour of the air and the water, left (afterglow) to right (night) ----------
  const tx = (x) => L.smooth(2850, 3980, x);
  const tri = (a, b, c, y, y0, y1, y2) => (y < y1 ? L.mix(a, b, L.clamp((y - y0) / (y1 - y0))) : L.mix(b, c, L.clamp((y - y1) / (y2 - y1))));
  const skyAt = (x, y) => {
    const t = tx(x);
    return tri(L.mix(P('#8a5a6e'), P('#0e1328'), t), L.mix(P('#d58a72'), P('#232a48'), t), L.mix(P('#f2c690'), P('#46506c'), t ** 0.8), y, 0, 820, HZ);
  };
  const seaAt = (x, y) => {
    const t = tx(x);
    return tri(L.mix(P('#a8857a'), P('#4a5068'), t), L.mix(P('#5e4f58'), P('#222a3a'), t), L.mix(P('#2e2b36'), P('#0f141e'), t), y, HZ, HZ + 60, DH);
  };

  // ---------- ground: columns of soft gradient ----------
  for (let x = X0 - 10; x < X1 + 10; x += 6) {
    const g = ctx.createLinearGradient(0, 0, 0, DH);
    for (const y of [0, 300, 600, 820, 1050, 1250, HZ - 1]) g.addColorStop(y / DH, L.css(skyAt(x, y)));
    for (const y of [HZ, HZ + 60, 1550, DH]) g.addColorStop(Math.min(1, y / DH), L.css(seaAt(x, y)));
    ctx.fillStyle = g; ctx.fillRect(x, 0, 7, DH);
  }
  hctx.fillStyle = '#333'; hctx.fillRect(X0, 0, X1 - X0, DH);

  // ---------- the sun's rays, softened to shafts of light ----------
  {
    const rays = L.canvas(Ly.c.width, Ly.c.height), rx = rays.getContext('2d');
    rx.setTransform(S, 0, 0, S, -X0 * S, 0);
    const cols = ['#f5dc45', '#e9711b', '#f0a39b', '#fbf5e6', '#f0ad1c', '#c0306b'];
    for (let k = 0; k < 26; k++) {
      const a = -0.55 + k * 0.042 + R.r(-0.01, 0.01), da = R.r(0.008, 0.022);
      rx.fillStyle = L.css(P(cols[k % cols.length]), R.r(0.18, 0.4));
      rx.beginPath(); rx.moveTo(SUN[0], SUN[1]);
      rx.lineTo(SUN[0] + Math.cos(a) * 2400, SUN[1] + Math.sin(a) * 2400); rx.lineTo(SUN[0] + Math.cos(a + da) * 2400, SUN[1] + Math.sin(a + da) * 2400); rx.closePath(); rx.fill();
    }
    rx.globalCompositeOperation = 'destination-in';
    const fade = rx.createLinearGradient(X0, 0, 3900, 0);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.45, 'rgba(0,0,0,0.45)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    rx.fillStyle = fade; rx.fillRect(X0, 0, X1 - X0, HZ);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${22 * S}px)`; ctx.drawImage(rays, 0, 0);
    ctx.filter = `blur(${7 * S}px)`; ctx.globalAlpha = 0.5; ctx.drawImage(rays, 0, 0);
    ctx.restore();
  }

  // ---------- glazes ----------
  function glaze(y0, y1, n, wmin, wmax, colFn, alpha, hgt = 0.35) {
    for (let i = 0; i < n; i++) {
      const y = R.r(y0, y1), x = R.r(X0 - 300, X1 - 100), len = R.r(250, 900), w = R.r(wmin, wmax);
      const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([x + len * t, y + Math.sin(t * Math.PI) * R.r(-1, 1) * w * 0.08 + N(x / 300 + t, y / 100) * 6]); }
      L.bristle(ctx, hctx, pts, { R, width: w, colorFn: () => L.vary(colFn(x + len * 0.5, y), R, 0.012, 0.05, 0.05), alpha: alpha * R.r(0.5, 1), height: hgt * R.r(0.6, 1), halpha: 0.25, dry: 0.5, taperA: 0.3, taperB: 0.35, bristles: Math.round(w / 3), color: [0, 0, 0] });
    }
  }
  glaze(-40, HZ - 20, 380, 40, 130, skyAt, 0.15);
  glaze(HZ - 120, HZ - 4, 70, 10, 30, (x, y) => skyAt(x, y + 15), 0.18);
  glaze(HZ + 6, DH + 40, 300, 12, 60, seaAt, 0.16);
  for (let i = 0; i < 650; i++) {
    const y = HZ + 6 + Math.pow(R.next(), 1.5) * (DH - HZ), x = R.r(X0 - 50, X1), len = R.r(20, 160) * (0.4 + (y - HZ) / 300);
    const light = R.chance(0.5), base = seaAt(x, y);
    L.bristle(ctx, hctx, [[x, y], [x + len * 0.5, y + R.r(-1, 1)], [x + len, y]], { R, width: R.r(1.5, 4) * (0.5 + (y - HZ) / 350), color: light ? L.mix(base, skyAt(x, HZ - 40), 0.4) : L.mix(base, P('#0b1018'), 0.4), alpha: R.r(0.08, 0.22), height: 0.4, halpha: 0.3, dry: 0.45, bristles: 3, taperA: 0.35, taperB: 0.4 });
  }
  // amber glints: the light of III still lying on the water, fading out
  for (let i = 0; i < 360; i++) {
    const x = X0 + Math.pow(R.next(), 1.7) * (X1 - X0) * 0.75, y = HZ + 4 + Math.pow(R.next(), 1.3) * (DH - HZ - 10);
    const a = (1 - tx(x)) * R.r(0.2, 0.6), len = R.r(5, 22) * (0.5 + (y - HZ) / 250);
    L.bristle(ctx, hctx, [[x - len / 2, y], [x + len / 2, y]], { R, width: R.r(1.2, 3), color: R.pick([P('#f0c48e'), P('#e7b07c'), P('#f6dbb4'), P('#e98a5a')]), alpha: a, height: 0.5, halpha: 0.4, dry: 0.2, bristles: 2 });
  }

  // ---------- horizon seam ----------
  ctx.save(); ctx.filter = `blur(${9 * S}px)`;
  const hz = ctx.createLinearGradient(X0, 0, X1, 0); hz.addColorStop(0, 'rgba(240,206,170,0.5)'); hz.addColorStop(1, 'rgba(110,120,150,0.25)');
  ctx.fillStyle = hz; ctx.fillRect(X0 - 50, HZ - 18, X1 - X0 + 100, 22);
  ctx.restore();

  // ---------- night arriving: stars and a thin moon ----------
  {
    const st = L.canvas(Ly.c.width, Ly.c.height), sc = st.getContext('2d'); sc.setTransform(S, 0, 0, S, -X0 * S, 0);
    for (let i = 0; i < 300; i++) {
      const x = R.r(3200, 4000), y = Math.pow(R.next(), 1.4) * 1000;
      if (!R.chance(tx(x) ** 1.6)) continue;
      const r = R.r(0.5, 1.6) * (R.chance(0.08) ? 1.8 : 1);
      sc.fillStyle = `rgba(240,236,225,${R.r(0.4, 0.95) * tx(x)})`; sc.beginPath(); sc.arc(x, y, r, 0, 7); sc.fill();
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${0.5 * S}px)`; ctx.drawImage(st, 0, 0); ctx.restore();
  }
  {
    const mx = 3830, my = 250, mr = 30;
    ctx.save();
    ctx.filter = `blur(${10 * S}px)`; ctx.fillStyle = 'rgba(220,225,235,0.18)'; ctx.beginPath(); ctx.arc(mx, my, mr * 2.4, 0, 7); ctx.fill();
    ctx.filter = `blur(${0.8 * S}px)`;
    const moon = L.canvas(Ly.c.width, Ly.c.height), mc = moon.getContext('2d'); mc.setTransform(S, 0, 0, S, -X0 * S, 0);
    mc.fillStyle = '#efe9da'; mc.beginPath(); mc.arc(mx, my, mr, 0, 7); mc.fill();
    mc.globalCompositeOperation = 'destination-out'; mc.beginPath(); mc.arc(mx - 12, my - 6, mr * 0.95, 0, 7); mc.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(moon, 0, 0);
    ctx.restore();
  }

  // ---------- the ship, sailing out of the picture ----------
  {
    const sx = 3905, sy = HZ - 1;
    ctx.save();
    ctx.fillStyle = L.css(P('#1c2130'), 0.85); ctx.filter = `blur(${0.5 * S}px)`;
    ctx.beginPath(); ctx.moveTo(sx - 9, sy - 2); ctx.lineTo(sx + 10, sy - 2); ctx.lineTo(sx + 7, sy + 1); ctx.lineTo(sx - 7, sy + 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 1, sy - 3); ctx.lineTo(sx - 1, sy - 21); ctx.quadraticCurveTo(sx + 7, sy - 12, sx + 8, sy - 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 2, sy - 3); ctx.lineTo(sx - 2, sy - 17); ctx.quadraticCurveTo(sx - 8, sy - 10, sx - 9, sy - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,150,0.9)'; ctx.beginPath(); ctx.arc(sx + 4, sy - 3, 0.9, 0, 7); ctx.fill(); // a lamp aboard
    ctx.restore();
  }

  // ---------- feather drawing (reused for the falling ones and the last one) ----------
  function featherAt(cx, cy, len, ang, o = {}) {
    const dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1], dir[0]];
    const base = [cx - dir[0] * len * 0.45, cy - dir[1] * len * 0.45];
    const tip = [base[0] + dir[0] * len, base[1] + dir[1] * len];
    const ctrl = [(base[0] + tip[0]) / 2 + nrm[0] * len * 0.05, (base[1] + tip[1]) / 2 + nrm[1] * len * 0.05];
    const M = 60, rach = L.quad(base, ctrl, tip, M), rn = L.normals(rach), k = len / 175, flat = o.flat ?? 0.8;
    const prof = (t) => (t < 0.1 ? 0 : L.smooth(0.1, 0.3, t)) * (t > 0.7 ? Math.sqrt(Math.max(0, 1 - ((t - 0.7) / 0.3) ** 2)) : 1);
    const vane = (t, s) => { const i = Math.round(t * M), w = (s > 0 ? 11 : 19) * k * prof(t) * (1 + 0.06 * N(t * 5, s * 3) - (s < 0 && t > 0.52 && t < 0.56 ? 0.35 : 0) - (s > 0 && t > 0.33 && t < 0.36 ? 0.3 : 0)); return [rach[i][0] + rn[i][0] * w * s * flat, rach[i][1] + rn[i][1] * w * s * flat + (s > 0 ? -1 : 1) * w * 0.15 * (1 - flat)]; };
    const up = [], dn = []; for (let i = 0; i <= M; i++) { up.push(vane(i / M, 1)); dn.push(vane(i / M, -1)); }
    const outline = up.concat(dn.slice().reverse());
    // blurred feathers are drawn sharp offscreen, then blurred once as a whole
    let g = ctx, off = null;
    if (o.blur || (o.alpha ?? 1) < 1) { off = L.canvas(Ly.c.width, Ly.c.height); g = off.getContext('2d'); g.setTransform(ctx.getTransform()); }
    g.save();
    const fg = g.createLinearGradient(cx, cy - 12 * k, cx, cy + 12 * k);
    fg.addColorStop(0, '#fbf3e6'); fg.addColorStop(0.5, '#e9e6e2'); fg.addColorStop(1, '#a9adb3');
    g.fillStyle = fg; L.path(g, outline, true); g.fill();
    g.lineCap = 'round';
    for (const s of [1, -1]) {
      for (let t = 0.12; t < 0.985; t += 0.0035 / Math.max(0.5, k)) {
        const i = Math.round(t * M), e = vane(Math.min(1, t + 0.05), s);
        g.strokeStyle = s > 0 ? 'rgba(255,250,240,0.35)' : 'rgba(165,168,178,0.28)'; g.lineWidth = 0.25;
        g.beginPath(); g.moveTo(rach[i][0], rach[i][1]); g.lineTo(e[0], e[1]); g.stroke();
      }
    }
    g.strokeStyle = 'rgba(244,200,150,0.7)'; g.lineWidth = 0.9; L.path(g, up.slice(8)); g.stroke();
    g.strokeStyle = 'rgba(120,125,135,0.6)'; g.lineWidth = 0.7; L.path(g, dn.slice(8)); g.stroke();
    g.fillStyle = 'rgba(236,228,214,0.95)'; L.ribbon(g, rach, (t) => 2.1 * k * (1 - t) + 0.3);
    g.restore();
    if (off) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); if (o.blur) ctx.filter = `blur(${o.blur * S}px)`; ctx.globalAlpha = o.alpha ?? 1; ctx.drawImage(off, 0, 0); ctx.restore(); }
    return { rach, outline };
  }

  // ---------- feathers still falling, out of the geometry and into the air ----------
  for (const [t, len, ang, blur, alpha] of [[0.6, 120, 0.9, 2.2, 0.8], [0.7, 105, -0.5, 1.6, 0.85], [0.8, 95, 1.9, 1.1, 0.9], [0.89, 85, 0.3, 0.7, 0.95]]) {
    const F = SC.FALL, p = F[Math.floor(t * (F.length - 1))];
    featherAt(p[0] + R.gauss(0, 18), p[1] + R.gauss(0, 10), len, ang, { blur, alpha, flat: 1 });
  }

  // ---------- rings on the water, and the last feather ----------
  {
    const rx = FX - 46, ry = FY - 12;
    for (let k = 0; k < 7; k++) {
      const r = 34 + k * k * 9 + k * 22, fade = 1 - k / 7;
      for (const [off, col, a] of [[0, P('#c0a8a0'), 0.32], [3.5, P('#0f131c'), 0.35]]) {
        ctx.save(); ctx.strokeStyle = L.css(col, a * fade); ctx.lineWidth = (2.2 - k * 0.15);
        ctx.filter = `blur(${(0.6 + k * 0.25) * S}px)`;
        ctx.beginPath();
        for (let i = 0; i <= 90; i++) {
          const th = i / 90 * Math.PI * 2, rr = r + N(Math.cos(th) * 1.2 + k, Math.sin(th) * 1.2) * (1 + k * 0.6);
          const x = rx + Math.cos(th) * rr, y = ry + Math.sin(th) * rr * 0.17 + off * 0.3;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke(); ctx.restore();
      }
    }
    const ang = -0.17;
    // reflection
    ctx.save(); ctx.translate(0, (FY + 4) * 2); ctx.scale(1, -1);
    featherAt(FX, FY, 175, ang, { blur: 2.5, alpha: 0.25 });
    ctx.restore();
    ctx.save(); ctx.filter = `blur(${4 * S}px)`; ctx.fillStyle = 'rgba(12,16,24,0.4)'; ctx.beginPath(); ctx.ellipse(FX, FY + 4, 90, 10, ang, 0, 7); ctx.fill(); ctx.restore();
    const fd = featherAt(FX, FY, 175, ang);
    const wx = fd.rach[4][0], wy = fd.rach[4][1];
    const wg2 = ctx.createRadialGradient(wx - 1.2, wy - 1.4, 0.3, wx, wy, 4);
    wg2.addColorStop(0, '#ffe3a6'); wg2.addColorStop(0.5, '#e3a446'); wg2.addColorStop(1, '#9a5a1e');
    ctx.fillStyle = wg2; ctx.beginPath(); ctx.ellipse(wx, wy, 3.2, 2.6, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,245,220,0.9)'; ctx.beginPath(); ctx.arc(wx - 1, wy - 1, 0.6, 0, 7); ctx.fill();
    ctx.save(); ctx.filter = `blur(${2 * S}px)`; ctx.fillStyle = 'rgba(230,170,90,0.45)'; ctx.fillRect(wx - 5, wy + 6, 10, 2.2); ctx.restore();
  }

  // ---------- surface ----------
  L.relief(ctx, Ly.hc, { blur: 1.2 * S, depth: 1.4, strength: 0.35, spec: 0.05, specPow: 16, lx: 0.3, ly: -0.6, lz: 0.75 });
  L.weave(ctx, { amount: 0.06, grain: 5, seed: 44, period: 2.4, S });
  return Ly;
};
