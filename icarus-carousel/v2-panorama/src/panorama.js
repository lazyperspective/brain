// Composites the four worlds into one continuous panorama and builds the three
// seams where they meet:
//   I|II   a torn page lying on wet paint (shadow, spilled strokes, half a labyrinth each)
//   II|III a shatter line: the gouache breaks into shards over the impasto
//   III|IV a dissolve: hard geometry blurs and fades into the dusk
window.paint = async function (canvas, Wp) {
  const S = Wp / 1000, DH = SC.DH;
  const W = Math.round(4000 * S), H = Math.round(DH * S);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const t0 = performance.now(), log = (m) => console.log(`${m} ${((performance.now() - t0) / 1000).toFixed(1)}s`);

  const T = await SC.WORLD.tonal(S); log('tonal');
  const O = await SC.WORLD.oil(S); log('oil');
  const G = await SC.WORLD.geo(S); log('geo');
  const Pp = await SC.WORLD.paper(S); log('paper');
  const at = (Ly) => Math.round(Ly.x0 * S);

  ctx.drawImage(T.c, at(T), 0);
  ctx.drawImage(O.c, at(O), 0);

  // ---------- II | III : the shatter ----------
  const RJ = new L.Rand(55);
  const jag = [];
  for (let y = -30, k = 0; y < DH + 60; y += RJ.r(45, 115), k++) jag.push([2000 + (k % 2 ? 1 : -1) * RJ.r(22, 88) + RJ.gauss(0, 8), y]);
  const pieces = [jag.concat([[3400, DH + 60], [3400, -30]])];
  for (let i = 0; i < 22; i++) {
    const y = RJ.r(20, DH - 20), x = 2000 - RJ.r(30, 190) * Math.pow(RJ.next(), 0.6) - 30, s = RJ.r(14, 58) * (1 - (2000 - x) / 330);
    const a = RJ.r(0, 6.28);
    pieces.push([0, 1, 2].map((k) => [x + Math.cos(a + k * 2.1 + RJ.r(-0.4, 0.4)) * s, y + Math.sin(a + k * 2.1 + RJ.r(-0.4, 0.4)) * s]));
  }
  const piecesPath = (c) => { c.beginPath(); for (const p of pieces) { c.moveTo(p[0][0], p[0][1]); for (const q of p.slice(1)) c.lineTo(q[0], q[1]); c.closePath(); } };
  // the shadow only needs the left edge of the gouache and its loose shards
  const shadowPieces = [jag.concat([[2400, DH + 60], [2400, -30]])].concat(pieces.slice(1));
  ctx.save(); ctx.setTransform(S, 0, 0, S, -6 * S, 9 * S); ctx.filter = `blur(${8 * S}px)`; ctx.fillStyle = 'rgba(8,10,34,0.5)';
  ctx.beginPath(); for (const p of shadowPieces) { ctx.moveTo(p[0][0], p[0][1]); for (const q of p.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); }
  ctx.fill(); ctx.restore();

  // ---------- III | IV : the dissolve ----------
  const version = (blur, stops) => {
    const c = L.canvas(G.c.width, G.c.height), x = c.getContext('2d');
    if (blur) x.filter = `blur(${blur * S}px)`;
    x.drawImage(G.c, 0, 0); x.filter = 'none';
    x.globalCompositeOperation = 'destination-in';
    const g = x.createLinearGradient(0, 0, c.width, 0);
    for (const [dx, a] of stops) g.addColorStop(L.clamp((dx - G.x0) / (G.x1 - G.x0)), `rgba(0,0,0,${a})`);
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(S, 0, 0, S, -G.x0 * S, 0); x.fillStyle = '#000'; piecesPath(x); x.fill();
    return c;
  };
  // halftone: the gouache breaks into dots that shrink to nothing as dusk takes over
  {
    const m = L.canvas(G.c.width, G.c.height), mx = m.getContext('2d');
    mx.setTransform(S, 0, 0, S, -G.x0 * S, 0);
    const HA = 2840, HB = 3270, sp = 15, rot = 0.5, cr = Math.cos(rot), sr = Math.sin(rot);
    const NH = L.noise2(321);
    mx.fillStyle = '#000'; mx.fillRect(G.x0, 0, HA - G.x0, DH);
    for (let u = -400; u < 400; u++) for (let v = -20; v < 160; v++) {
      const x = HA - 200 + (u * cr - v * sr) * sp, y = (u * sr + v * cr) * sp;
      if (x < HA - 30 || x > HB + 20 || y < -20 || y > DH + 20) continue;
      const t = L.smooth(HA, HB, x + NH(x / 140, y / 140) * 60);
      const r = sp * 0.8 * Math.pow(1 - t, 0.85);
      if (r < 0.4) continue;
      mx.beginPath(); mx.arc(x, y, r, 0, Math.PI * 2); mx.fill();
    }
    mx.globalCompositeOperation = 'destination-in'; piecesPath(mx); mx.fill();
    const glow = version(9, [[2860, 0], [2980, 0.4], [3180, 0]]);
    ctx.drawImage(glow, at(G), 0);
    const sharp = L.canvas(G.c.width, G.c.height), sx = sharp.getContext('2d');
    sx.drawImage(G.c, 0, 0); sx.globalCompositeOperation = 'destination-in'; sx.drawImage(m, 0, 0);
    ctx.drawImage(sharp, at(G), 0);
  }
  log('seams');

  // ---------- I | II : the torn page ----------
  const tp = []; for (let y = -20; y <= DH + 20; y += 2) tp.push([SC.tearX(y), y]);
  ctx.save(); ctx.setTransform(S, 0, 0, S, 8 * S, 6 * S); ctx.filter = `blur(${9 * S}px)`; ctx.fillStyle = 'rgba(18,14,30,0.55)';
  L.path(ctx, tp.concat([[-20, DH + 20], [-20, -20]]), true); ctx.fill(); ctx.restore();
  ctx.drawImage(Pp.c, 0, 0);
  ctx.drawImage(O.spill.c, at(O.spill), 0);
  log('done');
};
