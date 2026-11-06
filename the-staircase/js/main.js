// THE STAIRCASE - assembly and the render hook.
//   index.html            plays the loop live
//   index.html?t=7.5      one frozen frame
//   index.html?export     export mode: window.__staircase = { renderAt(t), duration, isReady(), lastMs, pixels() }
(function () {
  const S = window.STAIR, T3 = THREE;
  const q = new URLSearchParams(location.search);
  const EXPORT = q.has('export');
  const SS = q.has('ss') ? +q.get('ss') : (EXPORT || q.has('t') ? S.SS : 1);
  const W = S.W, H = S.H;
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const env = S.scene.setup(canvas, W, H, SS);
  const { renderer, scene, camera } = env;
  const stairs = S.scene.buildStairs(scene);
  const world = S.world ? S.world.build(env) : null;
  const story = S.story ? S.story.build(env, stairs) : null;
  const post = new S.Post(renderer, W, H, SS);
  const meshes = [];
  const collect = () => { meshes.length = 0; scene.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) meshes.push(o); }); };

  let lastMs = 0, ready = false;
  function renderAt(t) {
    const t0 = performance.now();
    t = ((t % S.D) + S.D) % S.D;
    if (story) story.update(t); else S.scene.idleStairs && S.scene.idleStairs(stairs, t);
    if (world) world.update(t);
    collect();
    post.render(scene, camera, meshes, t, Math.round(t * S.FPS));
    { const gl = renderer.getContext(), px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }   // block until the frame is really done (honest lastMs)
    lastMs = performance.now() - t0;
    return lastMs;
  }
  function pixels() {
    const gl = renderer.getContext();
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // flip rows and drop alpha -> rgb24 top-down
    const out = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4, dst = y * W * 3;
      for (let x = 0; x < W; x++) { out[dst + x * 3] = buf[src + x * 4]; out[dst + x * 3 + 1] = buf[src + x * 4 + 1]; out[dst + x * 3 + 2] = buf[src + x * 4 + 2]; }
    }
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < out.length; i += CH) s += String.fromCharCode.apply(null, out.subarray(i, i + CH));
    return btoa(s);
  }
  window.__staircase = { renderAt, duration: S.D, fps: S.FPS, isReady: () => ready, get lastMs() { return lastMs; }, pixels, S, dbg: { stairs, story, scene, camera } };

  if (EXPORT) { renderAt(0); ready = true; }
  else if (q.has('t')) { renderAt(+q.get('t')); ready = true; }
  else {
    ready = true;
    const start = performance.now();
    const loop = () => { renderAt(((performance.now() - start) / 1000) % S.D); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
