// IV. THE SEA — thin tonal glazes on raw canvas, almost nothing there. After the
// blaze, the silence: a low, harmless sun; a widening ring on the water; one
// white feather still carrying a bead of wax; and far off, a ship that never
// noticed.
window.paint = async function (canvas, W, H) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const hc = L.canvas(W, H), hctx = hc.getContext('2d');
  const S = W / 1000, DH = H / S;
  const R = new L.Rand(4409), N = L.noise2(21), N2 = L.noise2(22);
  const P = (h) => L.hex(h);
  const HZ = 1000, SUNX = 604, SUNY = 1004, SUNR = 30;
  const FX = 612, FY = 1438;

  ctx.setTransform(S, 0, 0, S, 0, 0); hctx.setTransform(S, 0, 0, S, 0, 0);
  hctx.fillStyle = '#333'; hctx.fillRect(0, 0, 1000, DH);

  // ---------- ground: two great soft fields, sky over sea ----------
  const skyStops = [[0, '#323d4f'], [0.3, '#4a5265'], [0.6, '#7a7280'], [0.82, '#b29c98'], [0.95, '#d9bfa4'], [1, '#e8cfae']];
  const sg = ctx.createLinearGradient(0, 0, 0, HZ);
  for (const [t, c] of skyStops) sg.addColorStop(t, c);
  ctx.fillStyle = sg; ctx.fillRect(0, 0, 1000, HZ);
  const seaStops = [[0, '#9c938f'], [0.04, '#6f727a'], [0.25, '#4b5560'], [0.6, '#323e49'], [1, '#1f2932']];
  const wg = ctx.createLinearGradient(0, HZ, 0, DH);
  for (const [t, c] of seaStops) wg.addColorStop(t, c);
  ctx.fillStyle = wg; ctx.fillRect(0, HZ, 1000, DH - HZ);

  const skyAt = (y) => { const t = L.clamp(y / HZ); for (let i = 1; i < skyStops.length; i++) if (t <= skyStops[i][0]) { const a = skyStops[i - 1], b = skyStops[i]; return L.mix(P(a[1]), P(b[1]), (t - a[0]) / (b[0] - a[0])); } return P('#e8cfae'); };
  const seaAt = (y) => { const t = L.clamp((y - HZ) / (DH - HZ)); for (let i = 1; i < seaStops.length; i++) if (t <= seaStops[i][0]) { const a = seaStops[i - 1], b = seaStops[i]; return L.mix(P(a[1]), P(b[1]), (t - a[0]) / (b[0] - a[0])); } return P('#1f2932'); };

  // ---------- glazes: broad, slow, horizontal strokes, barely there ----------
  function glaze(y0, y1, n, wmin, wmax, colFn, alpha, hgt = 0.35) {
    for (let i = 0; i < n; i++) {
      const y = R.r(y0, y1), x = R.r(-200, 900), len = R.r(250, 900), w = R.r(wmin, wmax);
      const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([x + len * t, y + Math.sin(t * Math.PI) * R.r(-1, 1) * w * 0.08 + N(x / 300 + t, y / 100) * 6]); }
      L.bristle(ctx, hctx, pts, { R, width: w, color: colFn(y), alpha: alpha * R.r(0.5, 1), height: hgt * R.r(0.6, 1), halpha: 0.25, dry: 0.5, taperA: 0.3, taperB: 0.35, bristles: Math.round(w / 3), dl: 0.02 });
    }
  }
  glaze(-40, HZ - 20, 320, 40, 130, (y) => L.vary(skyAt(y), R, 0.012, 0.05, 0.05), 0.15);
  glaze(HZ - 120, HZ - 4, 60, 10, 30, (y) => L.vary(skyAt(y + 15), R, 0.01, 0.04, 0.03), 0.18);
  glaze(HZ + 6, DH + 40, 360, 12, 70, (y) => L.vary(seaAt(y), R, 0.01, 0.05, 0.045), 0.16);
  // long fine wave-lines, lighter where the sky reflects
  for (let i = 0; i < 700; i++) {
    const y = HZ + 8 + Math.pow(R.next(), 1.6) * (DH - HZ), x = R.r(-50, 1000), len = R.r(20, 160) * (0.4 + (y - HZ) / 600);
    const light = R.chance(0.5);
    L.bristle(ctx, hctx, [[x, y], [x + len * 0.5, y + R.r(-1, 1)], [x + len, y]], { R, width: R.r(1.5, 4) * (0.5 + (y - HZ) / 700), color: light ? L.mix(seaAt(y), P('#b9b3b0'), 0.35) : L.mix(seaAt(y), P('#151c24'), 0.4), alpha: R.r(0.08, 0.22), height: 0.4, halpha: 0.3, dry: 0.45, bristles: 3, taperA: 0.35, taperB: 0.4 });
  }

  // ---------- horizon: a soft luminous seam, never a hard line ----------
  {
    ctx.filter = `blur(${10 * S}px)`;
    ctx.fillStyle = 'rgba(232,212,186,0.45)'; ctx.fillRect(-50, HZ - 20, 1100, 26);
    ctx.filter = `blur(${3 * S}px)`;
    ctx.fillStyle = 'rgba(150,140,140,0.35)'; ctx.fillRect(-50, HZ + 1, 1100, 5);
    ctx.filter = 'none';
  }

  // ---------- the sun: low, sinking, harmless now ----------
  {
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(SUNX, SUNY, 0, SUNX, SUNY, 420);
    g.addColorStop(0, 'rgba(240,190,130,0.45)'); g.addColorStop(0.2, 'rgba(220,160,120,0.18)'); g.addColorStop(1, 'rgba(200,150,130,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 500, 1000, 900);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1000, HZ + 1); ctx.clip();
    ctx.filter = `blur(${2.2 * S}px)`;
    ctx.fillStyle = L.css(P('#f1c896'), 0.92); ctx.beginPath(); ctx.arc(SUNX, SUNY, SUNR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.css(P('#f8dcb2'), 0.7); ctx.beginPath(); ctx.arc(SUNX - 3, SUNY - 6, SUNR * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.filter = 'none';
    // a few cloud-wisps drawn across it
    for (let i = 0; i < 2; i++) {
      const y = SUNY - 16 + i * 9 + R.r(-2, 2), x0 = SUNX - R.r(90, 160);
      L.bristle(ctx, hctx, [[x0, y], [x0 + 120, y + R.r(-1, 1)], [x0 + R.r(200, 280), y]], { R, width: R.r(5, 8), color: L.mix(skyAt(y), P('#8a7f88'), 0.3), alpha: 0.22, height: 0.4, halpha: 0.2, dry: 0.4, bristles: 3 });
    }
    ctx.restore();
  }

  // ---------- its reflection: a broken column of amber reaching to the feather ----------
  const refl = L.canvas(W, H), rctx = refl.getContext('2d'); rctx.setTransform(S, 0, 0, S, 0, 0);
  for (let i = 0; i < 260; i++) {
    const t = Math.pow(R.next(), 0.9), y = HZ + 3 + t * (FY - HZ + 60);
    const spread = 14 + t * 70, x = SUNX + R.gauss(0, spread * 0.45) + (FX - SUNX) * t;
    const len = R.r(6, 26) * (0.4 + t * 1.6), a = (1 - t * 0.75) * R.r(0.25, 0.7) * Math.exp(-(((x - SUNX - (FX - SUNX) * t) / spread) ** 2));
    const col = R.pick([P('#f0c48e'), P('#e7b07c'), P('#f6dbb4'), P('#d9a27a')]);
    L.bristle(rctx, hctx, [[x - len / 2, y], [x + len / 2, y + R.r(-0.5, 0.5)]], { R, width: R.r(1.2, 3.2) * (0.6 + t), color: col, alpha: a, height: 0.5, halpha: 0.4, dry: 0.2, bristles: 2 });
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${0.9 * S}px)`; ctx.drawImage(refl, 0, 0); ctx.filter = `blur(${5 * S}px)`; ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'screen'; ctx.drawImage(refl, 0, 0); ctx.restore();

  // ---------- the ship, far off, sailing on ----------
  {
    const sx = 214, sy = HZ - 1;
    ctx.fillStyle = L.css(P('#3f4250'), 0.75);
    ctx.filter = `blur(${0.5 * S}px)`;
    ctx.beginPath(); ctx.moveTo(sx - 9, sy - 2); ctx.lineTo(sx + 10, sy - 2); ctx.lineTo(sx + 7, sy + 1); ctx.lineTo(sx - 7, sy + 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 1, sy - 3); ctx.lineTo(sx - 1, sy - 21); ctx.quadraticCurveTo(sx + 7, sy - 12, sx + 8, sy - 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 2, sy - 3); ctx.lineTo(sx - 2, sy - 17); ctx.quadraticCurveTo(sx - 8, sy - 10, sx - 9, sy - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = L.css(P('#3f4250'), 0.2); ctx.fillRect(sx - 6, sy + 3, 12, 6);
    ctx.filter = 'none';
  }

  // ---------- rings on the water where he went down ----------
  {
    const rx = FX - 46, ry = FY - 12;
    for (let k = 0; k < 7; k++) {
      const r = 34 + k * k * 9 + k * 22, fade = 1 - k / 7;
      for (const [off, col, a] of [[0, P('#b4b0b0'), 0.32], [3.5, P('#151c24'), 0.35]]) {
        ctx.strokeStyle = L.css(col, a * fade); ctx.lineWidth = (2.2 - k * 0.15);
        ctx.filter = `blur(${(0.6 + k * 0.25) * S}px)`;
        ctx.beginPath();
        const segs = 90;
        for (let i = 0; i <= segs; i++) {
          const th = i / segs * Math.PI * 2, rr = r + N(Math.cos(th) * 1.2 + k, Math.sin(th) * 1.2) * (1 + k * 0.6);
          const x = rx + Math.cos(th) * rr * 1.0, y = ry + Math.sin(th) * rr * 0.17 + off * 0.3;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.filter = 'none';
  }

  // ---------- the feather ----------
  {
    const len = 175, ang = -0.17;
    const dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1], dir[0]];
    const base = [FX - dir[0] * len * 0.45, FY - dir[1] * len * 0.45];
    const tip = [base[0] + dir[0] * len, base[1] + dir[1] * len];
    const ctrl = [(base[0] + tip[0]) / 2 + nrm[0] * 9, (base[1] + tip[1]) / 2 + nrm[1] * 9];
    const M = 60, rach = L.quad(base, ctrl, tip, M), rn = L.normals(rach);
    const prof = (t) => (t < 0.1 ? 0 : L.smooth(0.1, 0.3, t)) * (t > 0.7 ? Math.sqrt(Math.max(0, 1 - ((t - 0.7) / 0.3) ** 2)) : 1);
    // seen low across the water, the vanes are foreshortened
    const vane = (t, s) => { const i = Math.round(t * M), w = (s > 0 ? 11 : 19) * prof(t) * (1 + 0.06 * N(t * 5, s * 3) - (s < 0 && t > 0.52 && t < 0.56 ? 0.35 : 0) - (s > 0 && t > 0.33 && t < 0.36 ? 0.3 : 0)); return [rach[i][0] + rn[i][0] * w * s * 0.8, rach[i][1] + rn[i][1] * w * s * 0.8 + (s > 0 ? -1 : 1) * w * 0.15]; };
    const up = [], dn = []; for (let i = 0; i <= M; i++) { up.push(vane(i / M, 1)); dn.push(vane(i / M, -1)); }
    const outline = up.concat(dn.slice().reverse());
    // reflection first: dark, blurred, trembling
    ctx.save();
    ctx.translate(0, (FY + 4) * 2); ctx.scale(1, -1);
    ctx.filter = `blur(${2.5 * S}px)`;
    ctx.fillStyle = 'rgba(205,200,198,0.22)'; L.path(ctx, outline.map(([x, y]) => [x + N(x / 6, y / 3) * 2, y]), true); ctx.fill();
    ctx.restore(); ctx.filter = 'none';
    // a faint wet shadow ring around it
    ctx.filter = `blur(${4 * S}px)`; ctx.fillStyle = 'rgba(18,24,30,0.35)'; L.path(ctx, outline.map(([x, y]) => [x, y + 3]), true); ctx.fill(); ctx.filter = 'none';
    // body of the feather: cool white, warm where the last light catches it
    const fg = ctx.createLinearGradient(base[0], base[1] - 12, base[0], base[1] + 12);
    fg.addColorStop(0, '#fbf3e6'); fg.addColorStop(0.5, '#e9e6e2'); fg.addColorStop(1, '#a9adb3');
    ctx.fillStyle = fg; L.path(ctx, outline, true); ctx.fill();
    // barbs: fine strokes, clumped where the water has wetted them
    ctx.lineCap = 'round';
    for (const s of [1, -1]) {
      for (let t = 0.12; t < 0.985; t += 0.0035) {
        const i = Math.round(t * M), e = vane(Math.min(1, t + 0.05), s);
        const clump = Math.sin(t * 23 + s * 2) > 0.93;
        ctx.strokeStyle = clump ? 'rgba(130,135,145,0.4)' : (s > 0 ? 'rgba(255,250,240,0.35)' : 'rgba(165,168,178,0.28)');
        ctx.lineWidth = clump ? 0.4 : 0.25;
        ctx.beginPath(); ctx.moveTo(rach[i][0], rach[i][1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
      }
    }
    // warm rim toward the sun
    ctx.strokeStyle = 'rgba(244,200,150,0.75)'; ctx.lineWidth = 0.9; L.path(ctx, up.slice(8)); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,125,135,0.6)'; ctx.lineWidth = 0.7; L.path(ctx, dn.slice(8)); ctx.stroke();
    // the quill
    ctx.fillStyle = 'rgba(236,228,214,0.95)'; L.ribbon(ctx, rach, (t) => 2.1 * (1 - t) + 0.3);
    ctx.fillStyle = 'rgba(150,140,130,0.6)'; L.ribbon(ctx, rach.map(([x, y]) => [x, y + 0.6]), (t) => 0.7 * (1 - t) + 0.1);
    // the bead of wax, still clinging — the last of the gold
    const wx = rach[4][0], wy = rach[4][1];
    const wg2 = ctx.createRadialGradient(wx - 1.2, wy - 1.4, 0.3, wx, wy, 5);
    wg2.addColorStop(0, '#ffe3a6'); wg2.addColorStop(0.5, '#e3a446'); wg2.addColorStop(1, '#9a5a1e');
    ctx.fillStyle = wg2; ctx.beginPath(); ctx.ellipse(wx, wy, 3.2, 2.6, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,245,220,0.9)'; ctx.beginPath(); ctx.arc(wx - 1, wy - 1, 0.6, 0, 7); ctx.fill();
    // a glint of that amber in the water beneath it
    ctx.filter = `blur(${2 * S}px)`; ctx.fillStyle = 'rgba(230,170,90,0.45)'; ctx.fillRect(wx - 5, wy + 6, 10, 2.2); ctx.filter = 'none';
  }

  // ---------- surface: thin paint over visible canvas ----------
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  L.relief(ctx, hc, { blur: 1.2 * S, depth: 1.4, strength: 0.35, spec: 0.05, specPow: 16, lx: 0.3, ly: -0.6, lz: 0.75 });
  L.weave(ctx, { amount: 0.06, grain: 5, seed: 44, period: 2.4 });
  ctx.globalCompositeOperation = 'multiply';
  const vg = ctx.createRadialGradient(W * 0.55, H * 0.6, W * 0.35, W * 0.5, H * 0.55, W * 1.15);
  vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(40,40,55,0.4)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
};
