// node tools/camtest.js out.png t '[{"eye":[..],"tgt":[..],"fov":40}, ...]' [scale] [ss]  : one frame per camera candidate
const L = require('./lib');
(async () => {
  const [out, tS, camsS, scS, ssS] = process.argv.slice(2);
  const cams = JSON.parse(camsS), t = +tS;
  const b = await L.chromium.launch(); const pg = await L.openPage(b, { ss: +(ssS || 1), scale: +(scS || 0.5) });
  const bufs = [];
  for (const c of cams) {
    const b64 = await pg.page.evaluate(([tt, cc]) => { FG.__camOverride = () => ({ eye: cc.eye, tgt: cc.tgt, fov: cc.fov * Math.PI / 180 }); window.__piece.renderAt(tt); FG.__camOverride = null; return window.__piece.grab(); }, [t, c]);
    bufs.push(Buffer.from(b64, 'base64'));
  }
  await L.tile(bufs, out, pg.W, pg.H, Math.min(4, bufs.length), 300);
  await b.close();
})();
