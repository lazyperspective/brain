// Two Weathers: animation state as a pure function of t, page bootstrap, and the export hook.
//   index.html            plays the loop
//   index.html?t=3.5      frozen at t = 3.5 s
//   index.html?export     exposes window.__piece = { renderAt(t), duration, isReady(), width, height, ... }
//   &res=1080             build the painting at a lower map resolution (quick previews)
(function () {
  'use strict';
  const D = 24; // loop length, s
  const TAU = Math.PI * 2;
  const q = new URLSearchParams(location.search);
  const RES = +(q.get('res') || 2160);
  const W = RES, H = Math.round(RES * 5 / 4);

  // lighting and breathing at time t; every term has a whole number of cycles per loop
  function state(t) {
    const ph = TAU * (t / D);
    // window daylight: the direction swings from low left toward upper left and back, rising and falling a little
    const az = (214 + 24 * Math.sin(ph) + 4 * Math.sin(2 * ph + 0.7)) * Math.PI / 180;
    const el = (19 + 5 * Math.sin(ph + 1.1) + 1.0 * Math.sin(2 * ph + 2.3)) * Math.PI / 180;
    const L = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    const ki = 1.5 / Math.pow(Math.sin(el), 0.5);
    const key = [ki * 1.0, ki * 0.93, ki * 0.83];
    const amb = [0.2, 0.22, 0.27];
    const br = [0.014 * Math.sin(ph + 0.4), 0.012 * Math.sin(ph + 2.2), 0.014 * Math.sin(ph + 2.9), 0.012 * Math.sin(ph + 4.6)];
    const em = 0.03 * Math.sin(ph + 1.4) + 0.01 * Math.sin(2 * ph + 0.3);
    const win = [Math.cos(az), Math.sin(az), 0.22];
    const winC = [0.5 - 0.14 * Math.cos(az), 0.46 - 0.1 * Math.sin(az)];
    return { L, key, amb, hs: 1.5, exp: 1.0, br, em, win, winC };
  }

  const canvas = document.getElementById('c');
  const status = document.getElementById('status');
  let maps = null, ren = null, ready = false, outW = W / 2, outH = H / 2, ss = 1, lastMs = 0;

  function b64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  const api = {
    duration: D, fps: 30, width: W, height: H,
    isReady: () => ready,
    state,
    setOutput(w, h, s) { outW = w; outH = h; ss = s || 1; },
    renderAt(t) { const t0 = performance.now(); ren.draw(state(t), ss, { w: outW, h: outH }); ren.gl.finish(); lastMs = performance.now() - t0; return lastMs; },
    pixels() { return b64(ren.read(outW, outH)); },
    get lastMs() { return lastMs; },
    get buildMs() { return maps ? maps.ms : 0; },
  };

  function start() {
    const exportMode = q.has('export');
    maps = TwoWeathersBuild.buildPainting(W, H, 20261107, exportMode ? null : (m) => console.log(m));
    if (exportMode) {
      canvas.width = 8; canvas.height = 10;
      ren = new TwoWeathersRenderer(canvas, maps);
      ren.band = 192;
      window.__piece = api; ready = true;
      if (status) status.remove();
      return;
    }
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const ww = window.innerWidth, wh = window.innerHeight;
      const cw = Math.min(ww, wh * 0.8);
      canvas.style.width = Math.floor(cw) + 'px'; canvas.style.height = Math.floor(cw * 1.25) + 'px';
      canvas.width = Math.min(W, Math.round(cw * dpr)); canvas.height = Math.round(canvas.width * 1.25);
    };
    fit();
    ren = new TwoWeathersRenderer(canvas, maps);
    window.__piece = api; ready = true;
    if (status) status.remove();
    const tq = q.get('t');
    if (tq !== null) { ren.draw(state(+tq % D), 1, null); return; }
    window.addEventListener('resize', fit);
    const t0 = performance.now();
    const loop = (now) => { ren.draw(state(((now - t0) / 1000) % D), 1, null); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  // let the page paint its status line before the (synchronous) build
  setTimeout(start, 30);
})();
