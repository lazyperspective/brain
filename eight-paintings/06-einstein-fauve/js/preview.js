// Flat likeness preview (development aid): shapes and lines only.
(function (G) {
  'use strict';
  G.drawPreview = function (ctx, k) {
    const F = G.Face;
    const path = (pts, close) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)); if (close) ctx.closePath(); };
    const fill = (pts, c) => { path(pts, true); ctx.fillStyle = c; ctx.fill(); };
    const line = (pts, c, w) => { path(pts, false); ctx.strokeStyle = c; ctx.lineWidth = w * k; ctx.lineCap = 'round'; ctx.stroke(); };
    const circ = (o, c) => { ctx.beginPath(); ctx.arc(o.c[0] * k, o.c[1] * k, o.r * k, 0, 7); ctx.fillStyle = c; ctx.fill(); };
    ctx.fillStyle = '#1f8a66'; ctx.fillRect(0, 0, 500 * k, 1250 * k);
    ctx.fillStyle = '#e2442a'; ctx.fillRect(500 * k, 0, 500 * k, 1250 * k);
    fill(F.hairSil, '#f1eee6');
    fill(F.earL, '#e98a55'); fill(F.earR, '#d0604a');
    fill(F.neck, '#d86a3a');
    fill(F.jacket, '#22256a');
    fill(F.chest, '#e8904a');
    fill(F.collarL, '#f2efe0'); fill(F.collarR, '#cfe0ea');
    fill(F.face, '#f0b060');
    fill(F.browL, '#6a6a80'); fill(F.browR, '#6a6a80');
    fill(F.eyeL.almond, '#f4ead8'); fill(F.eyeR.almond, '#f4ead8');
    ctx.save(); path(F.eyeL.almond, true); ctx.clip(); circ(F.irisL, '#2a1a20'); ctx.restore();
    ctx.save(); path(F.eyeR.almond, true); ctx.clip(); circ(F.irisR, '#2a1a20'); ctx.restore();
    line(F.eyeL.up, '#301820', 3); line(F.eyeR.up, '#301820', 3);
    line(F.hoodL, '#8a3a40', 3); line(F.hoodR, '#8a3a40', 3);
    [F.bagL1, F.bagL2, F.bagR1, F.bagR2].forEach((b) => line(b, '#a85050', 2));
    F.crowL.concat(F.crowR).forEach((b) => line(b, '#a85050', 1.5));
    F.wrinkles.forEach((b) => line(b, '#b05a3a', 2.2));
    line(F.frownL, '#a05040', 2); line(F.frownR, '#a05040', 2);
    circ(F.noseTip, '#f0a070'); circ(F.alaL, '#e89060'); circ(F.alaR, '#c87050');
    line(F.noseShadowSide, '#6a4a50', 2.5); line(F.noseNearSide, '#c07050', 1.5);
    fill(F.nostrilL, '#40202a'); fill(F.nostrilR, '#40202a');
    line(F.nlL, '#a05040', 2.5); line(F.nlR, '#a05040', 2.5);
    fill(F.lowerLip, '#c0504a');
    line(F.mouthLine, '#30161c', 3);
    fill(F.moustache, '#e6e2d8');
    line(F.chinCrease, '#a05040', 2); line(F.jowlL, '#a05040', 2); line(F.jowlR, '#a05040', 2);
    line(F.lapelL, '#0a0a30', 3); line(F.lapelR, '#0a0a30', 3);
  };
})(window);
// Plan preview: regions + modelled Fauvist colour (development aid)
window.drawPlan = function (ctx, k) {
  const P = window.buildPlan();
  window.__plan = P;
  const img = ctx.createImageData(P.PW, P.PH);
  const regCol = { 1: [40, 140, 100], 2: [240, 238, 230], 3: [30, 35, 110], 6: [240, 240, 225], 7: [210, 225, 235], 10: [230, 228, 220], 11: [90, 90, 120], 12: [240, 230, 215], 13: [190, 70, 70] };
  for (let i = 0; i < P.PW * P.PH; i++) {
    let c;
    if (P.Hh[i] && P.reg[i] !== 10 && P.reg[i] !== 11 && P.reg[i] !== 12) c = [P.col[i * 3] * 255, P.col[i * 3 + 1] * 255, P.col[i * 3 + 2] * 255];
    else c = regCol[P.reg[i]] || [200, 100, 50];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};
