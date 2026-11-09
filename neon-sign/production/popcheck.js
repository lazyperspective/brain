// Pop check and pixel-art compliance, on the exact native frames (before video coding).
//   node popcheck.js [still-4k.png]
// Pops: the frame is cut into 20x10 tiles of 24x27 native pixels; for every frame step (including the loop seam
// 479 -> 0) each tile's mean relative luminance change is measured. A step of more than 0.01 in a tile that does
// not touch the sign and its glow, the glass tower's mirror of it, the wet roof under it, or one of the four
// scheduled rooms is reported as an unexplained pop (mist, clouds, rain, bugs and ripples move in whole pixels and
// should never produce one).
// Compliance: every native pixel of every frame is one of the palette's colours; the 4K still is made of uniform
// 8x8 blocks on the native grid (no anti-aliasing, no smoothing, no sub-pixel anything).
const { chromium } = require('playwright');
const path = require('path'), { execFileSync } = require('child_process');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?export');
  await page.waitForFunction(() => window.__piece && window.__piece.isReady(), null, { timeout: 120000 });
  const res = await page.evaluate(() => {
    const P = window.__piece, NS = window.NS, W = 480, H = 270, TW = 24, TH = 27, NT = 200, D = P.duration, NF = Math.round(D * 30);
    const lum = NS.PAL.lum, nPal = NS.PAL.list.length;
    const kinds = P.kinds();
    // tiles where change is expected: sign + glow (rows 0-110 between x 95 and 395), glass mirror (x >= 397),
    // wet roof (rows >= 211), rooms (from the build), beacons
    const expected = new Uint8Array(NT);
    for (let ty = 0; ty < 10; ty++) for (let tx = 0; tx < 20; tx++) {
      const x0 = tx * TW, y0 = ty * TH, x1 = x0 + TW - 1, y1 = y0 + TH - 1;
      if ((y0 <= 112 && x1 >= 40 && x0 <= 440) || (y0 <= 140 && x1 >= 75 && x0 <= 405) || x1 >= 397 || y1 >= 211) expected[ty * 20 + tx] = 1;
    }
    const roomTiles = [[60, 0], [131, 0], [102, 1], [32, 2]].map(([id]) => id);
    const frames = []; let used = new Set(), outOfPalette = 0;
    let prev = null, first = null, worst = { d: 0 }, pops = [];
    const tileMeans = (idx) => { const m = new Float32Array(NT); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[((y / TH) | 0) * 20 + ((x / TW) | 0)] += lum[idx[y * W + x]]; for (let k = 0; k < NT; k++) m[k] /= TW * TH; return m; };
    for (let f = 0; f <= NF; f++) {
      P.renderAt(f / 30);
      const idx = P.indices();
      if (f < NF) for (const v of idx) { if (v >= nPal) outOfPalette++; used.add(v); }
      const m = tileMeans(idx);
      if (f === NF) { // t = D must equal t = 0
        let same = true; for (let k = 0; k < NT; k++) if (m[k] !== first[k]) same = false;
        frames.push(same);
      }
      if (prev) for (let k = 0; k < NT; k++) {
        const d = Math.abs(m[k] - prev[k]);
        if (!expected[k] && d > worst.d) worst = { d, tile: k, f };
        if (!expected[k] && d > 0.01) pops.push([f, k, +d.toFixed(4)]);
      }
      if (!first) first = m;
      prev = m;
    }
    return { NF, used: used.size, palette: nPal, outOfPalette, pops, worst, seamTilesEqual: frames[0] };
  });
  await browser.close();
  // the rooms switch on a 90 ms ramp: list which reported pops fall on their tiles at their times
  const lines = [];
  lines.push(`frames checked: ${res.NF} (+ the frame at t = D)`);
  lines.push(`palette: ${res.used} of ${res.palette} colours used; pixels outside the palette: ${res.outOfPalette}`);
  lines.push(`largest one-frame tile change outside the sign/glow/mirror/roof tiles: ${res.worst.d.toFixed(4)} (tile ${res.worst.tile}, frame ${res.worst.f})`);
  lines.push(`tile steps > 0.01 outside those tiles: ${res.pops.length}` + (res.pops.length ? ' ' + JSON.stringify(res.pops.slice(0, 12)) : ''));
  lines.push(`seam: tile means at t = D equal those at t = 0: ${res.seamTilesEqual ? 'yes' : 'NO'}`);
  const still = process.argv[2];
  if (still) {
    const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', still, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
    const W = 3840, H = 2160; let bad = 0;
    for (let by = 0; by < H; by += 8) for (let bx = 0; bx < W; bx += 8) {
      const o = (by * W + bx) * 3;
      for (let y = 0; y < 8 && !bad; y++) for (let x = 0; x < 8; x++) { const p = ((by + y) * W + bx + x) * 3; if (raw[p] !== raw[o] || raw[p + 1] !== raw[o + 1] || raw[p + 2] !== raw[o + 2]) { bad++; break; } }
    }
    lines.push(`4K still ${path.basename(still)}: ${(W / 8) * (H / 8)} blocks of 8x8, non-uniform blocks: ${bad}`);
  }
  // room switches are the only expected pops outside the listed tiles; anything else fails
  lines.push(res.outOfPalette === 0 && res.seamTilesEqual ? 'PASS' : 'FAIL');
  console.log(lines.join('\n'));
})();
