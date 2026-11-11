// Quick look at a section's raw frames (no compositor): node tools/peek.js <slot> T1,T2,... <out.png> [cols] [tileWidth]
// One frame -> a full-size PNG; several -> a tile sheet. Also prints render time per frame and the hero's coral bounding box.
const L = require('./lib');

function heroBox(buf) {                     // extent of the hero's coral body near the anchor (rows/columns with many coral pixels)
  const X0 = 480, X1 = 1100, Y0 = 300, Y1 = 880, rows = new Int32Array(L.H), cols = new Int32Array(L.W);
  let n = 0;
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const i = (y * L.W + x) * 4, r = buf[i], g = buf[i + 1], b = buf[i + 2];
    if (r > 110 && r > g * 1.3 && g > b * 1.0 && r - b > 55) { rows[y]++; cols[x]++; n++; }
  }
  let y0 = -1, y1 = -1, x0 = -1, x1 = -1;
  for (let y = Y0; y < Y1; y++) if (rows[y] >= 110) { if (y0 < 0) y0 = y; y1 = y; }
  for (let x = X0; x < X1; x++) if (cols[x] >= 100) { if (x0 < 0) x0 = x; x1 = x; }
  return n > 2000 && y0 >= 0 && x0 >= 0 ? { x0, y0, x1, y1, cx: (x0 + x1) / 2, w: x1 - x0, h: y1 - y0, n } : null;
}
async function main() {
  const [slot, ts, out, cols, tw] = process.argv.slice(2);
  const sec = await L.openSection(slot, { ss: process.env.SS || null });
  const bufs = [];
  for (const t of ts.split(',').map(Number)) {
    const t0 = Date.now(); const b = await sec.frame(t); bufs.push(b);
    console.log('T', t, ((Date.now() - t0) / 1000).toFixed(2) + 's', JSON.stringify(heroBox(b)));
  }
  if (bufs.length === 1) await L.png(bufs[0], out); else await L.tile(bufs, out, +(cols || 3), +(tw || 640));
  await L.closeBrowser();
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { heroBox };
