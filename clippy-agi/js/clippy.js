// An original paperclip assistant character (googly eyes, expressive brows, yellow paper), drawn in code.
(function (G) {
  const { E, seg, sat, lerp, hash, clamp } = K;
  // wire centre-line (top-down coords in a 22x72 box; bottom of the lowest bend at y=70)
  function buildPath() {
    const pts = [];
    const line = (x0, y0, x1, y1) => { const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5)); for (let i = 0; i <= n; i++) pts.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]); };
    const arc = (cx, cy, r, a0, a1) => { const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r / 1.5)); for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    line(12.5, 44, 12.5, 21);
    arc(8.5, 21, 4, 0, -Math.PI);
    line(4.5, 21, 4.5, 61);
    arc(12.5, 61, 8, Math.PI, 0);
    line(20.5, 61, 20.5, 11);
    arc(10.5, 11, 10, 0, -Math.PI);
    line(0.5, 11, 0.5, 52);
    return pts.map(([x, y]) => [x - 10.5, y - 70]);
  }
  const PATH = buildPath();

  function strokePoly(ctx, pts, n) {
    if (n < 2) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  // bend the clip a little (lean / squash) by warping points
  function warp(pts, p) {
    return pts.map(([x, y]) => {
      const h = -y / 70; // 0 at bottom, 1 at top
      return [x + p.lean * h * h * 10 + (p.wobble || 0) * Math.sin(h * 3.0) * 2, y * p.sy];
    });
  }

  function paper(ctx, p) {
    ctx.save();
    const u = p.paper == null ? 1 : p.paper;
    if (u <= 0) { ctx.restore(); return; }
    ctx.scale(1, u);
    // backdrop curl (behind) + floor (under), one continuous lined yellow sheet
    const g = ctx.createLinearGradient(0, -58, 0, 12);
    g.addColorStop(0, '#f4ee9a'); g.addColorStop(0.55, '#fffbd0'); g.addColorStop(0.78, '#fffff0'); g.addColorStop(1, '#f2e9a0');
    ctx.beginPath();
    ctx.moveTo(-40, 12); ctx.lineTo(42, 9);
    ctx.bezierCurveTo(44, -6, 40, -8, 38, -16);
    ctx.bezierCurveTo(36, -34, 34, -48, 30, -58);
    ctx.bezierCurveTo(10, -54, -10, -56, -32, -54);
    ctx.bezierCurveTo(-34, -40, -38, -26, -39, -12);
    ctx.bezierCurveTo(-41, -4, -42, 4, -40, 12);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(120,150,220,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const y = -50 + i * 7.4; ctx.beginPath(); ctx.moveTo(-44, y + (y > -10 ? 0 : 0)); ctx.lineTo(46, y - 2.5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,90,90,0.35)'; ctx.beginPath(); ctx.moveTo(-26, -56); ctx.lineTo(-29, 14); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#b0a050'; ctx.lineWidth = 1; ctx.stroke();
    // floor shadow under the clip
    ctx.fillStyle = 'rgba(90,80,20,0.28)'; ctx.beginPath(); ctx.ellipse(2 + p.x * 0, 1, 16 * (p.shadow || 1), 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function eye(ctx, ex, ey, rx, ry, p, side) {
    const pop = p.eyePop == null ? 1 : p.eyePop;
    if (pop <= 0.01) return;
    rx *= pop; ry *= pop;
    // eye white
    ctx.save();
    ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
    const red = p.red || 0;
    ctx.fillStyle = red > 0 ? `rgb(255,${Math.round(255 - red * 40)},${Math.round(255 - red * 50)})` : '#ffffff'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#1a1a1a'; ctx.stroke();
    ctx.clip();
    // pupil
    const lx = clamp(p.lookX || 0, -1, 1), ly = clamp(p.lookY || 0, -1, 1);
    const px = ex + lx * rx * 0.45 + (side < 0 ? 0.6 : -0.6), py = ey + ly * ry * 0.42 + 1;
    const pr = 3.1 * pop * (p.pupil || 1);
    if (red > 0) {
      const gl = ctx.createRadialGradient(px, py, 0, px, py, pr * 1.9);
      gl.addColorStop(0, `rgba(255,${Math.round(220 - red * 220)},0,${red})`); gl.addColorStop(0.4, `rgba(255,0,0,${red * 0.9})`); gl.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, pr * 1.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = red > 0.5 ? '#c00000' : '#000'; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    if (red > 0.5) { ctx.fillStyle = '#ff4020'; ctx.beginPath(); ctx.arc(px, py, pr * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 1.1, py - 1.2, 0.9, 0, Math.PI * 2); ctx.fill();
    // upper lid (blink) and lower lid (smile)
    const blink = sat(p.blink || 0);
    if (blink > 0) { ctx.fillStyle = '#c8c8c8'; ctx.fillRect(ex - rx - 1, ey - ry - 1, rx * 2 + 2, (ry * 2 + 2) * blink); ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - rx, ey - ry + ry * 2 * blink); ctx.lineTo(ex + rx, ey - ry + ry * 2 * blink); ctx.stroke(); }
    const sm = sat(p.smile || 0);
    if (sm > 0) { ctx.fillStyle = '#d4d4d4'; ctx.beginPath(); ctx.ellipse(ex, ey + ry * 1.25, rx * 1.3, ry * (0.45 + 0.35 * sm), 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(ex, ey + ry * 1.25, rx * 1.3, ry * (0.45 + 0.35 * sm), 0, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.lineWidth = 1.3; ctx.strokeStyle = '#111'; ctx.stroke();
    if (red > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createRadialGradient(px, py, 0, px, py, 12); g2.addColorStop(0, `rgba(255,30,0,${0.35 * red})`); g2.addColorStop(1, 'rgba(255,0,0,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
  function brow(ctx, x0, y0, x1, y1, lift, pop) {
    if (pop <= 0.01) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 3.0 * pop;
    ctx.beginPath(); const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 2.2;
    ctx.moveTo(x0, y0 - lift); ctx.quadraticCurveTo(mx, my - lift, x1, y1 - lift); ctx.stroke(); ctx.restore();
  }

  // p: {x, y (screen pos of the clip's foot), s (scale), sy (squash), lean, tilt, draw (0..1 wire drawn), eyePop, browPop,
  //     lookX, lookY, blink, smile, browL, browR, browTilt, red, paper, hop (px up)}
  function draw(ctx, p) {
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    const s = p.s || 1;
    ctx.scale(s, s);
    paper(ctx, p);
    ctx.translate(0, -(p.hop || 0));
    ctx.rotate(p.tilt || 0);
    const pts = warp(PATH, { lean: p.lean || 0, sy: p.sy || 1, wobble: p.wobble || 0 });
    const n = Math.round(pts.length * (p.draw == null ? 1 : sat(p.draw)));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a2c34'; ctx.lineWidth = 5.0; strokePoly(ctx, pts, n);
    ctx.strokeStyle = '#9aa1b4'; ctx.lineWidth = 3.3; strokePoly(ctx, pts, n);
    ctx.strokeStyle = '#eef0f8'; ctx.lineWidth = 1.3; ctx.save(); ctx.translate(-0.6, -0.5); strokePoly(ctx, pts, n); ctx.restore();
    // face: eyes overlap the upper loops, brows above
    const sy = p.sy || 1, lean = p.lean || 0;
    const hx = (yy) => lean * Math.pow(-yy / 70, 2) * 10;
    const ey = -45 * sy, eyL = -5.6 + hx(-45), eyR = 8.6 + hx(-45);
    eye(ctx, eyL, ey, 7.0, 8.8, p, -1);
    eye(ctx, eyR, ey + 0.5, 7.0, 8.8, p, 1);
    const bp = p.browPop == null ? (p.eyePop == null ? 1 : p.eyePop) : p.browPop;
    const tilt = p.browTilt || 0;
    brow(ctx, eyL - 6, ey - 11 + tilt, eyL + 5, ey - 13 - tilt * 0.5, p.browL || 0, bp);
    brow(ctx, eyR - 5, ey - 13 - tilt * 0.5, eyR + 6, ey - 11 + tilt, p.browR || 0, bp);
    ctx.restore();
  }

  // ---- reusable motion snippets (local time u in seconds) ----
  const A = {
    blink(t, seed = 3) { // natural blinks every ~2.5-4.5 s
      let acc = 0.6, k = 0;
      while (acc < t + 1) { const d = 2.4 + hash(seed * 31 + k) * 2.2; const bt = acc; if (t >= bt && t < bt + 0.16) { const u = (t - bt) / 0.16; return u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6; } acc += d; k++; }
      return 0;
    },
    breathe(t) { return Math.sin(t * 2.1) * 0.012; },
    arrive(u) { // 0..1.5s
      return {
        paper: E.outBack(seg(u, 0.0, 0.28)), draw: E.inOut(seg(u, 0.18, 0.85)),
        eyePop: u < 0.85 ? 0 : E.outBack(seg(u, 0.85, 1.08), 3), browPop: E.out(seg(u, 1.0, 1.15)),
        sy: 1 + (u > 1.08 && u < 1.5 ? Math.sin((u - 1.08) / 0.42 * Math.PI * 2) * 0.08 * (1 - (u - 1.08) / 0.42) : 0),
        browL: u > 1.15 && u < 1.6 ? Math.sin((u - 1.15) / 0.45 * Math.PI) * 3 : 0,
      };
    },
    hop(u, h = 9, d = 0.45) { // one bouncy hop with squash on landing
      if (u < 0 || u > d + 0.25) return { hop: 0, sy: 1 };
      if (u < 0.08) return { hop: 0, sy: 1 - 0.12 * Math.sin(u / 0.08 * Math.PI / 2) };
      if (u < d) { const k = (u - 0.08) / (d - 0.08); return { hop: Math.sin(k * Math.PI) * h, sy: 1.06 }; }
      const k = (u - d) / 0.25; return { hop: 0, sy: 1 - 0.14 * Math.sin(k * Math.PI) * (1 - k) };
    },
    eyeRoll(u, d = 0.9) { if (u < 0 || u > d) return null; const a = -Math.PI / 2 + (u / d) * Math.PI * 2; const k = Math.sin(u / d * Math.PI); return { lookX: Math.cos(a) * k, lookY: Math.sin(a) * k }; },
  };
  G.CLIPPY = { draw, A, PATH };
})(window);
