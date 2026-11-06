// THE STAIRCASE v2 - the sky around the climb, in parallax layers. Everything here is anchored in world x/z (so the
// camera's sideways drift gives true parallax) and in height to the camera, minus a scroll: each layer slides
// DOWN past the rising camera by a whole number of its own vertical tile periods per loop, so it is periodic.
//   far:    ghost staircases (zig-zag columns, hazy) with a tiny glowing climber each   1 module per loop
//   far:    the purple cloud sea at the bottom of the frame (very far: no vertical parallax), drifting sideways
//   mid:    big cloud banks                                                             1 tile per loop
//   mid:    floating islands with little trees                                          1 tile per loop
//   near:   cloud wisps at the frame edges, fast                                        2 tiles per loop
(function () {
  const S = window.STAIR, U = S.U, G = S.G, ST = S.stairs, T3 = THREE, PAL = S.PAL;
  const D = S.D, PI = Math.PI;

  function build(env) {
    const { scene } = env;
    const items = [];
    const root = new T3.Group(); scene.add(root);
    // vertical scroll: position in a tile of period P, sliding down k tiles per loop, centred on yc
    const scroll = (t, y0, P, k, yc) => yc + U.wrap(y0 - (k * P * t) / D + P / 2, P) - P / 2;

    // ---- cloud puffs: clusters of squashed spheres, toon shaded
    const cloudMat = (hex, rim) => G.toon({ color: hex, rim: rim == null ? 0.6 : rim, rimCol: '#ffe7d0' });
    const cMats = [cloudMat('#a196d6', 0.8), cloudMat('#8478c2', 0.8), cloudMat('#6a5ca8', 0.7), cloudMat('#b6a6e0', 0.9), cloudMat('#5a4c96', 0.7)];
    function cloud(n, seed, mat, line, seg = 18) {
      const g = new T3.Group();
      for (let i = 0; i < n; i++) {
        const r = 0.6 + 0.9 * U.hash(seed + i * 3.1);
        const m = new T3.Mesh(new T3.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat);
        m.scale.set(1.25, 0.72, 1.0);
        const a = (i / n) * PI * 2;
        m.position.set((i - n / 2) * 0.9 + 0.4 * Math.cos(a * 2.3), 0.35 * Math.sin(i * 1.7 + seed) + (r - 1) * 0.3, 0.6 * Math.sin(a));
        G.reg(m, { line: line == null ? 0.5 : line, cast: false, receive: false });
        g.add(m);
      }
      return g;
    }

    // ---- the cloud sea: far below and far away, a dense band along the bottom of the frame
    for (let k = 0; k < 16; k++) {
      const g = cloud(6 + (k % 3), 300 + k * 7, k % 2 ? cMats[2] : cMats[4], 0.12, 14);
      g.scale.setScalar(5.5 + 2.5 * U.hash(k * 3.3));
      root.add(g);
      const x0 = -160 + 320 * (k + 0.5 * U.hash(k)) / 16, z0 = -150 - 20 * U.hash(k * 5.1), dy = -34 - 6 * U.hash(k * 2.7);
      items.push({ upd: (t, cam) => { g.position.set(U.wrap(x0 + 160 + 320 * t / D, 320) - 160, cam.pos.y + dy, z0); } });
    }
    // ---- far ghost staircases: tall columns of the real module (merged plain boxes), scrolling one module per loop
    const farMat = G.toon({ color: '#ead8c4', rim: 0.6 });
    const MODS = 9, boxes = [];
    for (let m = -4; m < MODS - 4; m++) for (const st of ST.steps) {
      const g = new T3.BoxGeometry(st.sx * 0.96, ST.T, st.sz * 0.96); g.rotateY(ST.PHI); g.translate(st.wx, st.y + m * ST.H - ST.T / 2, st.wz); boxes.push(g);
    }
    const column = mergeGeos(boxes);
    const fars = [{ x: -46, z: -118, s: 2.2, ph: 0.1 }, { x: 52, z: -150, s: 2.6, ph: 0.55 }, { x: -20, z: -205, s: 3.2, ph: 0.3 }, { x: 30, z: -95, s: 1.6, ph: 0.8 }];
    for (const [i, f] of fars.entries()) {
      const g = new T3.Group(); root.add(g);
      const m = new T3.Mesh(column, farMat); G.reg(m, { line: 0.35, cast: false, receive: false }); g.add(m);
      g.scale.setScalar(f.s);
      const dot = new T3.Mesh(new T3.SphereGeometry(0.5, 12, 8), new T3.MeshBasicMaterial({ color: new T3.Color('#ffb08a').multiplyScalar(3.2) }));
      G.reg(dot, { line: 0, cast: false }); g.add(dot);
      const P = ST.H * f.s;
      items.push({ upd: (t, cam) => {
        const a = f.ph * P - P * t / D, m = Math.floor((a + P / 2) / P);
        g.position.set(f.x, cam.pos.y + 6 + a - P * m, f.z);
        g.rotation.y = 0.3 * i;
        // the climber dot climbs one module per loop, so it holds its height on screen while its stairs slide down
        const u = ST.N * (t / D + m - f.ph) + 0.3, p = ST.onStair(ST.sOfU(u), 0, {});
        dot.position.set(p.x, u * ST.h + 0.6, p.z);
      } });
    }
    // ---- big cloud banks (mid-far)
    const banks = [{ x: -27, z: -55, y0: 0, s: 2.4, m: 1 }, { x: 26, z: -62, y0: 22, s: 2.7, m: 0 }, { x: -14, z: -85, y0: 46, s: 3.0, m: 3 }, { x: 32, z: -70, y0: 60, s: 2.4, m: 1 }, { x: -36, z: -66, y0: 36, s: 2.6, m: 0 }];
    for (const [i, b] of banks.entries()) {
      const g = new T3.Group();
      for (let k = 0; k < 3; k++) { const c = cloud(6, 40 + i * 9 + k * 3, cMats[b.m], 0.18, 16); c.position.set((k - 1) * 3.2, -k * 0.8 * (k % 2), k * 0.7); g.add(c); }
      g.scale.setScalar(b.s); root.add(g);
      items.push({ upd: (t, cam) => { g.position.set(b.x + 1.2 * Math.sin(2 * PI * t / D + i), scroll(t, b.y0, 76, 1, cam.pos.y + 12), b.z); } });
    }
    // ---- floating islands
    const rockM = G.toon({ color: '#8b6f8f', rim: 0.6 }), rockD = G.toon({ color: '#6b5578', rim: 0.4 }), grassM = G.toon({ color: '#6fbf8f', rim: 0.6 }), trunkM = G.toon({ color: '#6b4a3a' }), leafM = G.toon({ color: '#5fbf8f', rim: 0.7 }), leafM2 = G.toon({ color: '#ffb38a', rim: 0.6 });
    function island(seed, tree) {
      const g = new T3.Group();
      const top = new T3.Mesh(new T3.SphereGeometry(0.62, 20, 10, 0, PI * 2, 0, PI / 2), grassM); top.scale.set(1, 0.5, 1); top.position.set(-0.15, -0.05, 0); g.add(top);
      const lip = new T3.Mesh(new T3.CylinderGeometry(1.0, 0.92, 0.22, 7), G.toon({ color: '#a88aa6', rim: 0.6 })); lip.position.y = -0.14; g.add(lip);
      const rock = new T3.Mesh(new T3.ConeGeometry(0.95, 1.8, 9), rockM); rock.rotation.x = PI; rock.position.y = -1.05; g.add(rock);
      const r2 = new T3.Mesh(new T3.ConeGeometry(0.4, 0.9, 7), rockD); r2.rotation.x = PI; r2.position.set(0.5, -0.9, 0.2); g.add(r2);
      if (tree) {
        const tr = new T3.Mesh(new T3.CylinderGeometry(0.06, 0.09, 0.8, 8), trunkM); tr.position.set(-0.2, 0.55, 0); g.add(tr);
        for (let k = 0; k < 3; k++) { const l = new T3.Mesh(new T3.SphereGeometry(0.42 - k * 0.08, 18, 12), seed % 2 ? leafM2 : leafM); l.position.set(-0.2 + (k - 1) * 0.22, 1.0 + k * 0.18, 0.05 * k); g.add(l); }
      }
      g.children.forEach((m) => G.reg(m, { line: 0.6, cast: false, receive: false }));
      return g;
    }
    const isl = [{ x: -11, z: -24, y0: 0, s: 2.2, tree: 1 }, { x: 12, z: -30, y0: 13, s: 2.6, tree: 1 }, { x: -15, z: -36, y0: 25, s: 2.0, tree: 0 }, { x: 9, z: -20, y0: 31, s: 1.6, tree: 1 }];
    for (const [i, f] of isl.entries()) {
      const g = island(i, f.tree); g.scale.setScalar(f.s); root.add(g);
      items.push({ upd: (t, cam) => { g.position.set(f.x, scroll(t, f.y0, 40, 1, cam.pos.y + 9) + 0.3 * Math.sin(2 * PI * t / D * 2 + i * 2), f.z); g.rotation.y = 0.2 * Math.sin(2 * PI * t / D + i) + i; } });
    }
    // ---- near cloud wisps at the frame edges (in front of and beside the stairs), fast
    const wisps = [{ x: -6.4, z: 3.2, y0: 0, s: 0.6, m: 3 }, { x: 7.0, z: 2.0, y0: 6, s: 0.7, m: 0 }, { x: -7.4, z: -2.5, y0: 10.5, s: 0.8, m: 0 }, { x: 5.8, z: 4.6, y0: 13.5, s: 0.5, m: 3 }, { x: 8.8, z: -4, y0: 3, s: 0.9, m: 1 }];
    for (const [i, w] of wisps.entries()) {
      const g = cloud(6, 90 + i * 11, cMats[w.m], 0.45, 18); g.scale.setScalar(w.s); root.add(g);
      items.push({ upd: (t, cam) => { g.position.set(w.x + 0.4 * Math.sin(2 * PI * t / D * 2 + i), scroll(t, w.y0, 17, 2, cam.pos.y + 2.5), w.z); } });
    }
    return { update: (t, cam) => { for (const it of items) it.upd(t, cam); } };
  }

  function mergeGeos(geos) {
    let nv = 0, ni = 0;
    for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3);
      const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx[oi + i] = ix[i] + ov;
      ov += g.attributes.position.count; oi += ix.length;
    }
    const m = new T3.BufferGeometry();
    m.setAttribute('position', new T3.BufferAttribute(pos, 3)); m.setAttribute('normal', new T3.BufferAttribute(nor, 3)); m.setIndex(new T3.BufferAttribute(idx, 1));
    return m;
  }

  S.world = { build };
})();
