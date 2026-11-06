// THE STAIRCASE v2 - assembly and the render hook.
//   index.html            plays the loop live
//   index.html?t=7.5      one frozen frame
//   index.html?export     export mode: window.__staircase = { renderAt(t), duration, isReady(), lastMs, pixels() }
(function () {
  const S = window.STAIR;
  const q = new URLSearchParams(location.search);
  const EXPORT = q.has('export');
  const SS = q.has('ss') ? +q.get('ss') : (EXPORT || q.has('t') ? S.SS : 1);
  const W = S.W, H = S.H;
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  let ready = false, lastMs = 0, renderAt = null;

  function pixels() {
    const gl = S._renderer.getContext();
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(W * H * 3);       // flip rows and drop alpha -> rgb24 top-down
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4, dst = y * W * 3;
      for (let x = 0; x < W; x++) { out[dst + x * 3] = buf[src + x * 4]; out[dst + x * 3 + 1] = buf[src + x * 4 + 1]; out[dst + x * 3 + 2] = buf[src + x * 4 + 2]; }
    }
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < out.length; i += CH) s += String.fromCharCode.apply(null, out.subarray(i, i + CH));
    return btoa(s);
  }
  window.__staircase = { renderAt: (t) => (renderAt ? renderAt(t) : 0), duration: S.D, fps: S.FPS, isReady: () => ready, get lastMs() { return lastMs; }, pixels, S };

  function init() {
    const env = S.scene.setup(canvas, W, H);
    const { renderer, scene, camera } = env;
    S._renderer = renderer;
    const stairs = S.scene.buildStairs(scene);
    const world = S.world.build(env);
    const story = S.story.build(env, stairs);
    const post = new S.Post(renderer, W, H, SS);
    const meshes = [];
    const collect = () => { meshes.length = 0; scene.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) meshes.push(o); }); };
    renderAt = function (t) {
      const t0 = performance.now();
      t = ((t % S.D) + S.D) % S.D;
      S.scene.place(env, t);
      story.update(t);
      world.update(t, env.camInfo);
      collect();
      post.render(scene, camera, meshes, t, Math.round(t * S.FPS));
      { const gl = renderer.getContext(), px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }   // block until the frame is really done (honest lastMs)
      lastMs = performance.now() - t0;
      return lastMs;
    };
    window.__staircase.dbg = { stairs, story, scene, camera, env };
    if (EXPORT) { renderAt(0); ready = true; }
    else if (q.has('t')) { renderAt(+q.get('t')); ready = true; }
    else {
      ready = true;
      const start = performance.now();
      const loop = () => { renderAt(((performance.now() - start) / 1000) % S.D); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  // the name plates are drawn with the vendored Nunito Black: load it before any canvas text is drawn
  const b = atob(window.NUNITO_900_WOFF2), bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  const font = new FontFace('Nunito Tag', bytes.buffer, { weight: '900' });
  font.load().then((f) => { document.fonts.add(f); init(); }, (e) => { console.error('font failed', e); init(); });
})();
