/* Fable 5.2: A Field Guide. The compositor: draws the rendered frame, then the type system over it, crisp at any
   output scale. Field notes (top), the HANDLER'S TIP card (bottom, cream, glove icon, slides in with overshoot),
   speech bubbles pinned to the hero, the viewer's dizzy eyes, and the closing title. */
(function (root) {
  'use strict';
  var FG = root.FG, m = FG.m, TL = FG.TL, E = TL.E;
  var FPS = 30;
  var COL = { cream: '#fff7ee', peach: '#f7b99a', ink: '#2a1b17', card: '#fbf2e3', cardEdge: '#e8d6bb', coral: '#d97757', shade: '#a8553b', dark: '#6e2a1a', light: '#f2a585', lilac: '#a99be6', violet: '#6c5fc4', tipHead: '#b5543a' };

  function rr(cx, x, y, w, h, r) {
    cx.beginPath(); cx.moveTo(x + r, y); cx.lineTo(x + w - r, y); cx.quadraticCurveTo(x + w, y, x + w, y + r);
    cx.lineTo(x + w, y + h - r); cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); cx.lineTo(x + r, y + h);
    cx.quadraticCurveTo(x, y + h, x, y + h - r); cx.lineTo(x, y + r); cx.quadraticCurveTo(x, y, x + r, y); cx.closePath();
  }
  // word wrap with inline {thumb} icons (icon width = 1.05 em)
  function tokens(text) { return text.split(' '); }
  function measureTok(cx, w, px) { return w === '{thumb}' ? px * 1.0 : cx.measureText(w).width; }
  function wrap(cx, text, maxW, px) {
    if (text.indexOf('\n') >= 0) { var all = []; text.split('\n').forEach(function (s) { all = all.concat(wrap(cx, s, maxW, px)); }); return all; }
    var words = tokens(text), lines = [], cur = [], cw = 0, sp = cx.measureText(' ').width;
    words.forEach(function (w) {
      var ww = measureTok(cx, w, px);
      if (cur.length && cw + sp + ww > maxW) { lines.push({ w: cw, t: cur }); cur = [w]; cw = ww; }
      else { cw += (cur.length ? sp : 0) + ww; cur.push(w); }
    });
    if (cur.length) lines.push({ w: cw, t: cur });
    return lines;
  }
  function drawLine(cx, L, x, y, px, fill, k) {
    var sp = cx.measureText(' ').width, xx = x;
    L.t.forEach(function (w, i) {
      if (w === '{thumb}') { thumbIcon(cx, xx + px * 0.5, y - px * 0.36, px * 0.92, k); xx += px * 1.0; }
      else { cx.fillStyle = fill; cx.fillText(w, xx, y); xx += cx.measureText(w).width; }
      if (i < L.t.length - 1) xx += sp;
    });
  }
  // a lilac thumbs-up glove, matching the one in the sky
  function thumbIcon(cx, x, y, s, k) {
    cx.save(); cx.translate(x, y); cx.scale(s / 100, s / 100);
    cx.shadowColor = 'rgba(0,0,0,0)';
    cx.lineJoin = 'round'; cx.lineWidth = 6; cx.strokeStyle = '#3b2f8f';
    cx.fillStyle = '#b3a6ee';
    rr(cx, -34, -6, 62, 56, 14); cx.fill(); cx.stroke();                 // fist
    rr(cx, -26, -54, 26, 56, 12); cx.fill(); cx.stroke();                // thumb up
    cx.fillStyle = '#9585e0';
    for (var i = 0; i < 3; i++) { rr(cx, 4, 2 + i * 15, 30, 14, 7); cx.fill(); cx.stroke(); }
    cx.fillStyle = '#fff7ee'; rr(cx, -40, 46, 72, 16, 6); cx.fill(); cx.stroke();
    cx.restore();
  }
  // the handler's glove (coral mitten, cream cuff) for the tip card
  function gloveIcon(cx, x, y, s) {
    cx.save(); cx.translate(x, y); cx.scale(s / 100, s / 100); cx.rotate(-0.18);
    cx.lineJoin = 'round'; cx.lineWidth = 6; cx.strokeStyle = COL.dark;
    cx.fillStyle = COL.coral;
    cx.beginPath();                                                       // mitten body with a thumb
    cx.moveTo(-28, 34); cx.lineTo(-30, -18); cx.quadraticCurveTo(-30, -52, 0, -52); cx.quadraticCurveTo(30, -52, 30, -18);
    cx.lineTo(30, 34); cx.closePath(); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(-28, 4); cx.quadraticCurveTo(-56, -6, -52, -26); cx.quadraticCurveTo(-46, -40, -30, -20); cx.fill(); cx.stroke();
    cx.strokeStyle = COL.shade; cx.lineWidth = 4;
    cx.beginPath(); cx.moveTo(-6, -40); cx.lineTo(-6, -12); cx.moveTo(10, -40); cx.lineTo(10, -12); cx.stroke();
    cx.strokeStyle = COL.dark; cx.lineWidth = 6; cx.fillStyle = COL.cream;
    rr(cx, -36, 30, 74, 22, 8); cx.fill(); cx.stroke();
    cx.restore();
  }

  function capAlpha(c, t) {
    var a = m.ss(c.t0, c.t0 + 4 / FPS, t), b = 1 - m.ss(c.t1 - 6 / FPS, c.t1, t);
    return Math.min(a, b);
  }
  var obsIndex = {};
  TL.CAPS.forEach(function (c) { if (c.kind === 'obs' && !c.cont) obsIndex[c.n] = true; });

  function drawObs(cx, c, t, k, W) {
    var a = capAlpha(c, t); if (a <= 0) return;
    var u = (t - c.t0) * FPS;                                     // frames since in
    var slam = c.cont ? 1 : 1 + 0.07 * Math.exp(-u / 2.2) * (u >= 0 ? 1 : 0);
    var px = 62 * k;
    cx.save();
    cx.globalAlpha = a;
    // a soft dark plate at the top
    var g = cx.createLinearGradient(0, 0, 0, 380 * k);
    g.addColorStop(0, 'rgba(26,16,44,0.62)'); g.addColorStop(0.55, 'rgba(26,16,44,0.28)'); g.addColorStop(1, 'rgba(26,16,44,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, 380 * k);
    cx.font = '600 ' + Math.round(24 * k) + 'px FGSemi';
    cx.letterSpacing = Math.round(5 * k) + 'px';
    cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    cx.fillStyle = COL.peach;
    cx.shadowColor = 'rgba(20,10,35,0.6)'; cx.shadowBlur = 10 * k; cx.shadowOffsetY = 2 * k;
    cx.fillText('FIELD NOTE · Nº ' + c.n, W / 2, 112 * k);
    cx.letterSpacing = '0px';
    cx.font = Math.round(px) + 'px FGDisplayXB';
    cx.textAlign = 'left';
    var lines = wrap(cx, c.text, 930 * k, px);
    cx.translate(W / 2, 175 * k); cx.scale(slam, slam);
    cx.shadowColor = 'rgba(20,10,35,0.7)'; cx.shadowBlur = 22 * k; cx.shadowOffsetY = 4 * k;
    lines.forEach(function (L, i) { drawLine(cx, L, -L.w / 2, i * px * 1.13, px, COL.cream, k); });
    cx.restore();
  }

  function drawTip(cx, c, t, k, W, H) {
    var a0 = c.t0, a1 = c.t1; if (t < a0 || t > a1) return;
    var uin = (t - a0) / 0.42, uout = (t - (a1 - 0.24)) / 0.24;
    var slide = 1 - m.back(uin, 2.0);
    if (uout > 0) slide = Math.max(slide, m.ei(uout) * 1.2);
    var rot = (-1.4 + 5 * Math.max(0, 1 - m.eo(uin * 1.2))) * Math.PI / 180;
    var px = 43 * k, padL = 150 * k, padR = 44 * k, maxW = 960 * k - padL - padR;
    cx.save();
    cx.font = Math.round(px) + 'px FGDisplayXB';
    var lines = wrap(cx, c.text, maxW, px);
    var tw = 0; lines.forEach(function (L) { tw = Math.max(tw, L.w); });
    var cw = Math.min(960 * k, Math.max(560 * k, tw + padL + padR)), chh = 70 * k + lines.length * px * 1.16 + 28 * k;
    var cxp = W / 2 - cw / 2, cyp = H - 92 * k - chh + slide * (chh + 160 * k);
    cx.translate(W / 2, cyp + chh / 2); cx.rotate(rot); cx.translate(-W / 2, -(cyp + chh / 2));
    cx.shadowColor = 'rgba(25,12,35,0.42)'; cx.shadowBlur = 34 * k; cx.shadowOffsetY = 12 * k;
    cx.fillStyle = COL.card; rr(cx, cxp, cyp, cw, chh, 26 * k); cx.fill();
    cx.shadowColor = 'rgba(0,0,0,0)';
    cx.lineWidth = 2 * k; cx.strokeStyle = COL.cardEdge; rr(cx, cxp + 7 * k, cyp + 7 * k, cw - 14 * k, chh - 14 * k, 20 * k); cx.stroke();
    // glove badge
    cx.fillStyle = '#f6dcc8'; cx.beginPath(); cx.arc(cxp + 78 * k, cyp + chh / 2, 50 * k, 0, m.TAU); cx.fill();
    var wig = Math.sin((t - a0) * 18) * Math.exp(-(t - a0) * 5) * 0.25;
    cx.save(); cx.translate(cxp + 80 * k, cyp + chh / 2 + 4 * k); cx.rotate(wig); gloveIcon(cx, 0, 0, 78 * k); cx.restore();
    cx.font = '700 ' + Math.round(23 * k) + 'px FGBold'; cx.letterSpacing = Math.round(4 * k) + 'px';
    cx.fillStyle = COL.tipHead; cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    cx.fillText('HANDLER’S TIP', cxp + padL, cyp + 52 * k);
    cx.letterSpacing = '0px';
    cx.font = Math.round(px) + 'px FGDisplayXB';
    lines.forEach(function (L, i) { drawLine(cx, L, cxp + padL, cyp + 52 * k + 46 * k + i * px * 1.16, px, COL.ink, k); });
    cx.restore();
  }

  function drawBubble(cx, b, t, A, k, W, H) {
    if (t < b.t0 || t > b.t1) return;
    var an = A[b.who === 'pop' ? 'pop' : 'hero'] || A.hero; if (!an) return;
    var u = (t - b.t0) * FPS, out = (b.t1 - t) * FPS;
    var sc = m.spring((t - b.t0), 4.2, 0.38) * Math.min(1, out / 3.5);
    if (sc <= 0.02) return;
    var px = (b.small ? 36 : 42) * k;
    cx.save();
    cx.font = Math.round(px) + 'px FGDisplayXB';
    var tw = cx.measureText(b.text).width, bw = tw + 48 * k, bh = px + 34 * k;
    var ax = an[0], ay = an[1];
    var bx = m.clamp(ax + 70 * k, 50 * k + bw / 2, W - 50 * k - bw / 2), by = m.clamp(ay - 95 * k, 330 * k, H - 330 * k);
    cx.translate(bx, by); cx.scale(sc, sc);
    cx.shadowColor = 'rgba(25,12,35,0.35)'; cx.shadowBlur = 16 * k; cx.shadowOffsetY = 6 * k;
    cx.fillStyle = '#fffaf3'; cx.strokeStyle = COL.ink; cx.lineWidth = 4 * k; cx.lineJoin = 'round';
    // body + tail toward the anchor
    var tx = (ax - bx) / sc, ty = (ay - by) / sc, tl = Math.hypot(tx, ty) || 1;
    var tipx = tx * Math.min(1, 70 * k / tl * 1.0) * 0 + m.clamp(tx * 0.5, -bw * 0.45, bw * 0.45), tipy = bh / 2 + 34 * k;
    cx.beginPath();
    cx.moveTo(-bw / 2 + 22 * k, -bh / 2); cx.lineTo(bw / 2 - 22 * k, -bh / 2); cx.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, -bh / 2 + 22 * k);
    cx.lineTo(bw / 2, bh / 2 - 22 * k); cx.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - 22 * k, bh / 2);
    var bx0 = m.clamp(tipx * 0.4, -bw / 2 + 40 * k, bw / 2 - 60 * k);
    cx.lineTo(bx0 + 28 * k, bh / 2); cx.lineTo(tipx, tipy); cx.lineTo(bx0 + 4 * k, bh / 2);
    cx.lineTo(-bw / 2 + 22 * k, bh / 2); cx.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, bh / 2 - 22 * k);
    cx.lineTo(-bw / 2, -bh / 2 + 22 * k); cx.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + 22 * k, -bh / 2); cx.closePath();
    cx.fill(); cx.shadowColor = 'rgba(0,0,0,0)'; cx.stroke();
    cx.fillStyle = COL.ink; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(b.text, 0, 2 * k);
    cx.restore();
  }

  function drawSpirals(cx, t, k, W, H) {
    var a = m.ss(E.spin, E.spin + 0.12, t) * (1 - m.ss(E.spinEnd - 0.2, E.spinEnd, t));
    if (a <= 0) return;
    var sc = 0.75 + 0.25 * m.back((t - E.spin) / 0.25, 2);
    cx.save(); cx.globalAlpha = 0.9 * a;
    [-1, 1].forEach(function (s) {
      cx.save();
      cx.translate(W / 2 + s * 215 * k, 640 * k); cx.scale(sc, sc); cx.rotate(-(t - E.spin) * 13);
      cx.fillStyle = 'rgba(255,247,238,0.92)'; cx.beginPath(); cx.arc(0, 0, 175 * k, 0, m.TAU); cx.fill();
      cx.lineWidth = 7 * k; cx.strokeStyle = COL.ink; cx.stroke();
      cx.lineCap = 'round'; cx.lineWidth = 15 * k; cx.strokeStyle = COL.violet;
      cx.beginPath();
      for (var i = 0; i <= 160; i++) { var th = i / 160 * 6.2 * Math.PI, r = th / (6.2 * Math.PI) * 150 * k; if (i === 0) cx.moveTo(Math.cos(th) * r, Math.sin(th) * r); else cx.lineTo(Math.cos(th) * r, Math.sin(th) * r); }
      cx.stroke();
      cx.restore();
    });
    cx.restore();
  }

  function drawTitle(cx, t, k, W) {
    var a = m.ss(E.title, E.title + 0.35, t);
    if (a <= 0) return;
    var b = m.ss(E.sub, E.sub + 0.35, t);
    cx.save();
    var g = cx.createLinearGradient(0, 0, 0, 420 * k);
    g.addColorStop(0, 'rgba(26,16,44,' + (0.5 * a) + ')'); g.addColorStop(0.6, 'rgba(26,16,44,' + (0.2 * a) + ')'); g.addColorStop(1, 'rgba(26,16,44,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, 420 * k);
    cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    cx.shadowColor = 'rgba(20,10,35,0.7)'; cx.shadowBlur = 24 * k; cx.shadowOffsetY = 4 * k;
    var dy = (1 - m.eo((t - E.title) / 0.5)) * 18 * k;
    cx.globalAlpha = a;
    cx.font = Math.round(128 * k) + 'px FGDisplayBlack'; cx.letterSpacing = Math.round(2 * k) + 'px';
    cx.fillStyle = COL.cream; cx.fillText('FABLE 5.2', W / 2, 205 * k + dy);
    cx.font = Math.round(46 * k) + 'px FGDisplayXB'; cx.letterSpacing = Math.round(9 * k) + 'px';
    cx.fillStyle = COL.peach; cx.fillText('— A FIELD GUIDE —', W / 2, 272 * k + dy);
    cx.letterSpacing = '0px';
    cx.globalAlpha = b;
    cx.font = Math.round(38 * k) + 'px FGSemi'; cx.fillStyle = COL.cream;
    cx.fillText('Handle with clear instructions.', W / 2, 1296 * k + (1 - m.eo((t - E.sub) / 0.5)) * 12 * k);
    cx.restore();
  }

  FG.composite = function (out, glCanvas, t, A, o) {
    var W = o.W, H = o.H, k = o.k, cx = out;
    cx.save();
    cx.globalCompositeOperation = 'copy'; cx.drawImage(glCanvas, 0, 0, W, H); cx.globalCompositeOperation = 'source-over';
    cx.restore();
    drawSpirals(cx, t, k, W, H);
    TL.BUBBLES.forEach(function (b) { drawBubble(cx, b, t, A, k, W, H); });
    TL.CAPS.forEach(function (c) {
      if (c.kind === 'obs') drawObs(cx, c, t, k, W);
      else if (c.kind === 'tip') drawTip(cx, c, t, k, W, H);
    });
    drawTitle(cx, t, k, W);
  };
})(typeof window !== 'undefined' ? window : globalThis);
