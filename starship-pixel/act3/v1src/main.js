// Act 3 driver: shot dispatch by film time, live playback, ?t= freeze, ?export API.
(function () {
  'use strict';
  const { W, H, buf, toRGBA, toRGB } = PX;
  const START = 60.3, END = 92.0;
  // cut times (seconds, identical to the reference)
  const CUTS = [
    [60.3, 65.8, 'shot7'],
    [65.8, 71.2, 'shot8'],
    [71.2, 78.6, 'shot9'],
    [78.6, 92.0, 'shot10'],
  ];
  const native = document.createElement('canvas');
  native.width = W; native.height = H;
  const nctx = native.getContext('2d');
  const img = nctx.createImageData(W, H);
  const big = document.getElementById('big');
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;

  function shotAt(t) {
    // frame times are START + i/30; nudge to avoid float ties at the cuts
    const tt = t + 1e-6;
    for (const c of CUTS) if (tt >= c[0] && tt < c[1]) return c;
    return tt < START ? CUTS[0] : CUTS[CUTS.length - 1];
  }
  function draw(t) {
    const c = shotAt(t);
    window.SHOTS[c[2]](t, c[0], c[1]);
  }
  function present() {
    toRGBA(img.data);
    nctx.putImageData(img, 0, 0);
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(native, 0, 0, W * 4, H * 4);
  }
  function renderAt(t) { draw(t); present(); }
  const rgb = new Uint8Array(W * H * 3);
  function frameRGB64(t) {
    draw(t);
    toRGB(rgb);
    let s = '';
    for (let i = 0; i < rgb.length; i += 0x8000) s += String.fromCharCode.apply(null, rgb.subarray(i, i + 0x8000));
    return btoa(s);
  }

  const q = new URLSearchParams(location.search);
  window.__act = {
    renderAt, start: START, end: END, isReady: () => true,
    frameRGB64, nativePNG: () => native.toDataURL('image/png'), bigPNG: () => big.toDataURL('image/png'),
    cuts: CUTS,
  };
  const hud = document.getElementById('hud');
  if (q.has('export')) { hud.style.display = 'none'; return; }
  if (q.has('t')) { const t = parseFloat(q.get('t')); renderAt(t); hud.textContent = 't=' + t.toFixed(2); return; }
  // live playback, looping the act
  let t0 = null;
  function tick(now) {
    if (t0 === null) t0 = now;
    const t = START + ((now - t0) / 1000) % (END - START);
    renderAt(t);
    hud.textContent = 't=' + t.toFixed(2);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
