// THE STAIRCASE - the world around the staircase, in depth layers (all placed in screen terms, then pushed back
// along the view direction; the composite fades them into the sky by depth):
//   far:   other impossible staircases, small and hazy, each with two tiny glowing climbers going round and round
//   mid:   floating islands with little trees; a sea of toon clouds below, drifting (periodic)
//   near:  dark foreground silhouettes at the frame edges (a rock with a sapling, cloud banks), gently swaying
(function () {
  const S = window.STAIR, U = S.U, G = S.G, ST = S.stairs, T3 = THREE, PAL = S.PAL;
  const D = S.D, PI = Math.PI;

  function build(env) {
    const { scene, camera } = env;
    const R = new T3.Vector3(), Up = new T3.Vector3(), F = new T3.Vector3();
    camera.matrixWorld.extractBasis(R, Up, F);          // F points back toward the camera
    const ring = camera.userData.ring;
    const fw = camera.right - camera.left, fh = camera.top - camera.bottom;
    const cx = (camera.left + camera.right) / 2, cy = (camera.top + camera.bottom) / 2;
    // world position for a screen point (sx, sy in -1..1 of the frame) at view depth d (+ = farther than the stairs)
    const at = (sx, sy, d, out = new T3.Vector3()) => out.set(0, 0, 0).addScaledVector(R, cx + sx * fw / 2).addScaledVector(Up, cy + sy * fh / 2).addScaledVector(F, -d);
    const items = [];
    const root = new T3.Group(); scene.add(root);

    // ---- cloud puffs: clusters of squashed spheres, toon shaded
    const cloudMat = (hex, rim) => G.toon({ color: hex, rim: rim == null ? 0.6 : rim, rimCol: '#ffe7d0' });
    const cMats = [cloudMat('#9c8fd0', 0.8), cloudMat('#7f72bd', 0.8), cloudMat('#6a5ca8', 0.7), cloudMat('#8a7cc0')];
    function cloud(n, seed, mat, line) {
      const g = new T3.Group();
      for (let i = 0; i < n; i++) {
        const r = 0.6 + 0.9 * U.hash(seed + i * 3.1);
        const m = new T3.Mesh(new T3.SphereGeometry(r, 22, 16), mat);
        m.scale.set(1.25, 0.72, 1.0);
        const a = (i / n) * PI * 2;
        m.position.set((i - n / 2) * 0.9 + 0.4 * Math.cos(a * 2.3), 0.35 * Math.sin(i * 1.7 + seed) + (r - 1) * 0.3, 0.6 * Math.sin(a));
        G.reg(m, { line: line == null ? 0.5 : line, cast: false });
        g.add(m);
      }
      return g;
    }
    // the cloud sea: three bands, nearer bands lower and faster; each drifts by whole wraps per loop
    const bands = [
      { y: -1.0, d: 30, n: 9, sc: 1.15, speed: 1, mat: cMats[2], line: 0.28 },
      { y: -0.9, d: 50, n: 9, sc: 0.95, speed: 1, mat: cMats[1], line: 0.2 },
      { y: -0.8, d: 78, n: 10, sc: 0.8, speed: 1, mat: cMats[0], line: 0.12 },
      { y: 0.18, d: 105, n: 4, sc: 0.55, speed: 1, mat: cMats[0], line: 0.15 },
    ];
    for (const [bi, b] of bands.entries()) {
      for (let k = 0; k < b.n; k++) {
        const g = cloud(5 + (k % 3), bi * 50 + k * 7, b.mat, b.line);
        g.scale.setScalar(b.sc * (0.8 + 0.4 * U.hash(bi * 9 + k)));
        root.add(g);
        const x0 = -1.5 + 3.0 * (k + 0.5 * U.hash(k + bi)) / b.n, y0 = b.y + 0.05 * Math.sin(k * 2.1 + bi);
        items.push({ obj: g, upd: (t) => { const x = U.wrap(x0 + 1.5 + (b.speed * 3.0 * t) / D * (bi % 2 ? -1 : 1), 3.0) - 1.5; at(x, y0 + 0.012 * Math.sin(2 * PI * (t / D) * 2 + k), b.d, g.position); } });
      }
    }
    // ---- far staircases: scaled copies of the real one (so they read as impossible loops too)
    const farMat = G.toon({ color: '#e8d6c0', rim: 0.5 });
    const farGeo = [];
    for (const st of ST.steps) { const g = G.roundedBox(st.sx, ST.T, st.sz, 0.07); g.translate(st.cx, st.y - ST.T / 2, st.cz); farGeo.push(g); }
    const merged = mergeGeos(farGeo);
    const fars = [{ sx: -0.62, sy: 0.42, d: 95, s: 0.32 }, { sx: 0.7, sy: 0.22, d: 120, s: 0.24 }, { sx: 0.5, sy: -0.48, d: 70, s: 0.3 }, { sx: -0.75, sy: -0.2, d: 140, s: 0.2 }];
    for (const [i, f] of fars.entries()) {
      const g = new T3.Group(); root.add(g);
      const m = new T3.Mesh(merged, farMat); G.reg(m, { line: 0.4, cast: false, receive: false }); g.add(m);
      g.scale.setScalar(f.s);
      // tiny glowing climbers
      const dots = [0, 1].map((k) => { const d = new T3.Mesh(new T3.SphereGeometry(0.42, 12, 8), new T3.MeshBasicMaterial({ color: new T3.Color(k ? PAL.mint : '#ffb08a').multiplyScalar(3.2) })); G.reg(d, { line: 0, cast: false }); g.add(d); return d; });
      const pos = at(f.sx, f.sy, f.d);
      items.push({ obj: g, upd: (t) => {
        g.position.copy(pos).addScaledVector(Up, 0.25 * Math.sin(2 * PI * t / D + i * 1.3));
        dots.forEach((d, k) => { const s = U.wrap((t / D + k * 0.5 + i * 0.13) * ST.L, ST.L); const p = ST.onStair(s, 0, {}); d.position.set(p.x, p.y + 0.6, p.z); });
      } });
    }
    // ---- floating islands
    const rockM = G.toon({ color: '#8b6f8f', rim: 0.6 }), rockD = G.toon({ color: '#6b5578', rim: 0.4 }), grassM = G.toon({ color: '#6fbf8f', rim: 0.6 }), trunkM = G.toon({ color: '#6b4a3a' }), leafM = G.toon({ color: '#5fbf8f', rim: 0.7 }), leafM2 = G.toon({ color: '#ffb38a', rim: 0.6 });
    function island(seed, size, tree) {
      const g = new T3.Group();
      const top = new T3.Mesh(new T3.SphereGeometry(0.62, 20, 10, 0, PI * 2, 0, PI / 2), grassM); top.scale.set(1, 0.5, 1); top.position.set(-0.15, -0.05, 0); g.add(top);
      const lip = new T3.Mesh(new T3.CylinderGeometry(1.0, 0.92, 0.22, 7), G.toon({ color: '#a88aa6', rim: 0.6 })); lip.position.y = -0.14; g.add(lip);
      const rock = new T3.Mesh(new T3.ConeGeometry(0.95, 1.8, 9), rockM); rock.rotation.x = PI; rock.position.y = -1.05; g.add(rock);
      const r2 = new T3.Mesh(new T3.ConeGeometry(0.4, 0.9, 7), rockD); r2.rotation.x = PI; r2.position.set(0.5, -0.9, 0.2); g.add(r2);
      if (tree) {
        const tr = new T3.Mesh(new T3.CylinderGeometry(0.06, 0.09, 0.8, 8), trunkM); tr.position.set(-0.2, 0.55, 0); g.add(tr);
        for (let k = 0; k < 3; k++) { const l = new T3.Mesh(new T3.SphereGeometry(0.42 - k * 0.08, 18, 12), seed % 2 ? leafM2 : leafM); l.position.set(-0.2 + (k - 1) * 0.22, 1.0 + k * 0.18, 0.05 * k); g.add(l); }
      }
      g.children.forEach((m) => G.reg(m, { line: 0.5, cast: false }));
      g.scale.setScalar(size);
      return g;
    }
    const isl = [{ sx: -0.86, sy: 0.2, d: 46, s: 0.6, tree: 1 }, { sx: 0.86, sy: -0.5, d: 38, s: 0.7, tree: 1 }, { sx: 0.32, sy: 0.6, d: 90, s: 0.5, tree: 0 }, { sx: -0.62, sy: -0.62, d: 60, s: 0.55, tree: 1 }];
    for (const [i, f] of isl.entries()) {
      const g = island(i, f.s, f.tree); root.add(g);
      const pos = at(f.sx, f.sy, f.d);
      items.push({ obj: g, upd: (t) => { g.position.copy(pos).addScaledVector(Up, 0.18 * Math.sin(2 * PI * t / D * 2 + i * 2)); g.rotation.y = 0.15 * Math.sin(2 * PI * t / D + i); } });
    }
    // ---- foreground silhouettes (near the camera, dark, rim-lit)
    const fgM = G.toon({ color: '#1e1838', rim: 0.7, rimCol: '#c98a7e', flat: 0.55 }), fgC = G.toon({ color: '#3a2f66', rim: 0.9, rimCol: '#ffc9a8' }), fgLeaf = G.toon({ color: '#253e52', rim: 1.0, rimCol: '#9effd8' });
    // bottom-left: a rock with a sapling, cut by the frame
    const fg1 = new T3.Group(); root.add(fg1);
    const fr = new T3.Mesh(new T3.DodecahedronGeometry(2.2, 0), fgM); fr.scale.set(1.5, 0.8, 1.2); fg1.add(fr);
    const fr2 = new T3.Mesh(new T3.ConeGeometry(1.8, 3.4, 7), fgM); fr2.rotation.x = PI; fr2.position.y = -2.2; fg1.add(fr2);
    const st1 = new T3.Mesh(new T3.CylinderGeometry(0.07, 0.12, 1.6, 8), fgM); st1.position.set(0.9, 2.2, 0); st1.rotation.z = -0.25; fg1.add(st1);
    const leaves = [];
    for (let k = 0; k < 5; k++) { const l = new T3.Mesh(new T3.SphereGeometry(0.45, 16, 10), fgLeaf); l.scale.set(1.3, 0.55, 0.8); l.position.set(1.0 + 0.45 * Math.cos(k * 1.3), 2.9 + 0.3 * Math.sin(k * 2), 0.3 * Math.sin(k)); l.rotation.z = (k - 2) * 0.4; fg1.add(l); leaves.push(l); }
    fg1.children.forEach((m) => G.reg(m, { line: 1.2, cast: false }));
    const fg1p = at(-0.92, -0.93, -22);
    items.push({ obj: fg1, upd: (t) => { fg1.position.copy(fg1p); leaves.forEach((l, k) => { l.rotation.x = 0.12 * Math.sin(2 * PI * t / D * 3 + k); }); fg1.rotation.z = 0.02 * Math.sin(2 * PI * t / D * 2); } });
    // bottom-right: a near cloud bank
    const fg2 = new T3.Group(); for (let k = 0; k < 3; k++) { const cl = cloud(6, 77 + k * 13, fgC, 0.9); cl.position.set(k * 1.8 - 1.2, -k * 0.9 + 0.3, k * 0.6); cl.scale.setScalar(0.55 + 0.12 * k); fg2.add(cl); } fg2.scale.setScalar(1.25); root.add(fg2);
    const fg2p = at(0.95, -1.0, -18);
    items.push({ obj: fg2, upd: (t) => { fg2.position.copy(fg2p).addScaledVector(R, 0.25 * Math.sin(2 * PI * t / D)); } });
    // top-right: a hanging vine from out of frame
    const fg3 = new T3.Group(); root.add(fg3);
    const vineLeaves = [];
    for (let k = 0; k < 9; k++) {
      const l = new T3.Mesh(new T3.SphereGeometry(0.32, 14, 10), fgLeaf); l.scale.set(1.25, 0.5, 0.75);
      l.position.set(0.25 * Math.sin(k * 1.9), -k * 0.42, 0.1 * Math.cos(k)); l.rotation.z = (k % 2 ? 0.6 : -0.6);
      fg3.add(l); vineLeaves.push(l);
    }
    const vstem = new T3.Mesh(new T3.CylinderGeometry(0.04, 0.05, 4.0, 6), fgM); vstem.position.y = -1.7; fg3.add(vstem);
    fg3.children.forEach((m) => G.reg(m, { line: 1.0, cast: false }));
    const fg3p = at(0.9, 1.05, -20);
    items.push({ obj: fg3, upd: (t) => { fg3.position.copy(fg3p); fg3.rotation.z = 0.06 * Math.sin(2 * PI * t / D * 2 + 0.5); vineLeaves.forEach((l, k) => { l.rotation.x = 0.2 * Math.sin(2 * PI * t / D * 3 + k * 0.7); }); } });
    root.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
    return { update: (t) => { for (const it of items) it.upd(t); } };
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
