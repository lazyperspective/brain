'use strict';
const QS = new URLSearchParams(location.search);
const SCALE = parseFloat(QS.get('scale') || '1');
const STAGE = QS.get('stage') || 'all';
const W = Math.round(2160 * SCALE), H = Math.round(2700 * SCALE);
const KK = W / 1080; // design -> px
const LOG = (...a) => console.log(...a);

function skyFlow(x, y, reg) {
  if (reg === REG.SMOKE) return -Math.PI / 2 + 0.06 * Math.sin(y / 40);
  const n = FLOWN.n2(x / 520 + 2, y / 260) * 0.2;
  return -0.03 + 0.025 * Math.sin(x / 330 + y / 120) + n;
}
function groundFlow(x, y, reg, r) {
  const n = FLOWN.n2(x / 190 + 9, y / 60) * 0.3;
  const wr = smooth(40, 420, y - CAM.YH);
  const hx = Math.cos(n), hy = Math.sin(n);
  const rx = CAM.VPX - x, ry = CAM.YH - y; const rl = Math.hypot(rx, ry) || 1;
  // radial toward the glow, with a fraction of strokes laid obliquely so the surface reads as one flowing sweep, not a plaid
  let ra = Math.atan2(ry, rx);
  if (r > 0.5) ra += (r > 0.8 ? 0.38 : -0.38) * (0.6 + 0.4 * FLOWN.n2(x / 140, y / 140));
  const ux = Math.cos(ra), uy = Math.sin(ra);
  let fx = hx * (1 - wr) + ux * wr, fy = hy * (1 - wr) + uy * wr;
  if (hx * ux + hy * uy < 0) { fx = hx * (1 - wr) - ux * wr; fy = hy * (1 - wr) - uy * wr; }
  return Math.atan2(fy, fx);
}
let FLOWN;

function flowAll(x, y, reg) {
  if (reg === REG.GROUND) return groundFlow(x, y, reg);
  return skyFlow(x, y, reg);
}

async function main() {
  FLOWN = new Noise(1234);
  initPaint(W, H, 20261110);
  const trees = buildTrees(88021);
  // toned ground (warm violet-brown imprimatura)
  for (let i = 0; i < P.N; i++) { P.CR[i] = 0.24; P.CG[i] = 0.15; P.CB[i] = 0.22; }
  LOG('building reference');
  const ref = buildReference(W, H, trees);
  drawHouse(ref);
  const rd = readRef(ref, W, H);
  window.__rd = rd;
  await tick();
  if (STAGE === 'ref') {
    for (let i = 0; i < P.N; i++) { P.CR[i] = rd.R[i]; P.CG[i] = rd.G[i]; P.CB[i] = rd.B[i]; }
  } else {
    const common = { rng: new RNG(555), gridF: 0.8, edgeLo: 0.05, edgeHi: 0.22, firstLayer: 0 };
    // sky + ridge
    await refPass(ref, rd, Object.assign({}, common, {
      layers: [118, 66, 36, 19], allowReg: (1 << REG.SKY) | (1 << REG.RIDGE),
      scaleY: null, flow: skyFlow, lenF: [7, 5, 2, 6, 10], tol: [0.16, 0.12, 0.1, 0.1, 0.1],
      layerRange: { 0: [0, 3], 1: [1, 3], 4: [2, 3] }, errT: [0, 0.06, 0.08, 0.1], regScale: { 1: 0.45 },
      style: (rg, l, lum) => ({ alpha: 0.9, thick: 0.22 + 0.08 * l, streak: 0.75, dry: 0.5, pick: 0.03, cj: 0.03, mix: 0.45, useC2: true }),
      vj: 0.07, tj: 0.04, accent: 0.14, accentCols: [[0.3, 0.55, 0.68], [0.55, 0.4, 0.7], [0.75, 0.55, 0.65]], log: true,
    }));
    LOG('sky done');
    // ground
    await refPass(ref, rd, Object.assign({}, common, {
      rng: new RNG(777),
      layers: [130, 76, 44, 24, 13], allowReg: (1 << REG.GROUND), clipAllow: (1 << REG.GROUND),
      y0: CAM.YH - 4, scaleY: (dy) => clamp(0.18 + 1.0 * (dy - CAM.YH) / (1350 - CAM.YH), 0.16, 1.2), flow: groundFlow,
      lenF: [0, 0, 6, 0, 0], tol: [0, 0, 0.16, 0, 0], layerRange: { 2: [0, 4] }, errT: [0, 0.06, 0.07, 0.08, 0.09],
      style: (rg, l, lum) => ({ thick: 0.75 + 2.2 * smooth(0.42, 0.85, lum), streak: 0.5, dry: 0.22, pick: 0.05, alpha: 0.96, cj: 0.03, mix: 0.5, useC2: true }),
      vj: 0.08, tj: 0.05, accent: 0.18, accentCols: [[0.6, 0.45, 0.65], [0.32, 0.5, 0.68], [0.55, 0.5, 0.66], [0.7, 0.6, 0.74]], log: true,
    }));
    LOG('ground done');
    paintGroundScumble();
    for (const t of trees) { if (t.Z > HOUSE.Z) { await paintTree(t); } }
    LOG('far trees done');
    // house
    await refPass(ref, rd, Object.assign({}, common, {
      rng: new RNG(999),
      layers: [20, 11, 6, 3.2], allowReg: (1 << REG.HOUSE), clipAllow: (1 << REG.HOUSE) | (1 << REG.SMOKE),
      y0: 2 * (houseGeom().y - 7.5 * houseGeom().s) / 2, y1: houseGeom().y + 30, x0: houseGeom().x - 9 * houseGeom().s, x1: houseGeom().x + 8 * houseGeom().s, flow: skyFlow, lenF: [0, 0, 0, 5, 0], tol: [0, 0, 0, 0.1, 0],
      layerRange: { 3: [0, 3] }, errT: [0, 0.03, 0.02, 0.012], gridF: 0.7,
      style: (rg, l, lum) => ({ alpha: 0.95, thick: 0.15 + 0.5 * smooth(0.3, 0.9, lum), streak: 0.3, dry: 0.15, pick: 0.02, cj: 0.01, mix: 0.3, useC2: false }),
      vj: 0.02, tj: 0.01, edgeLo: 0.03, edgeHi: 0.12, log: true,
    }));
    paintHouseDetail();
    let tc = 0;
    for (const t of trees) { if (t.Z <= HOUSE.Z) { await paintTree(t); if ((++tc & 3) === 0) await tick(); } }
    LOG('near trees done');
    paintSmoke();
    paintSkyScumble();
    paintBloom();
    await paintForeground(trees);
    await paintSnowfall();
    LOG('details done', window.__shc);
  }
  LOG('finishing');
  const out = finishImage({ warp: [1.5, 0.6], weaveAmp: 0.18, weaveHide: 4.5, heightScale: 1.0, normalStrength: 2.6, diffuse: 1.1, spec: 0.14, vignette: 0.22 });
  const cv = document.getElementById('c');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.putImageData(new ImageData(out, W, H), 0, 0);
  window.__done = true;
  LOG('done');
}
main().catch(e => { console.log('ERR', e.stack || e); window.__err = String(e.stack || e); });
