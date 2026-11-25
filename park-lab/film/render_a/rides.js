// Detailed rides: hero-coaster extras + trains with riders, the wooden coaster (bents, braces, build mode),
// railway train, Ferris wheel, swing ride, pirate ship, observation tower, drop tower, carousel, boats.
import * as THREE from 'three';
import { hex, T, beamM, GEO, Kit, MG, stripe, lathe, hash, rng, frame } from './util.js';

const WHITE = 0xf6f1e6, GOLD = 0xe2b33c, DARK = 0x2b2f3a;
const HEMI_LO = new THREE.SphereGeometry(0.5, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
export function buildRides(ctx) {
  const { D, park, mat, root, shot, pixel } = ctx;
  const grp = new THREE.Group(); grp.name = 'rides'; root.add(grp);
  const K = new Kit(grp); const M = mat({}); ctx.ridesGroup = grp; const MV = mat({ vc: true }); const MVD = mat({ vc: true, side: THREE.DoubleSide });
  const R = id => D.rides.find(r => r.id === id);
  const shirts = D.guests.clothes_palette.map(hex);
  const SKIN = [0xf1c9a5, 0xd9a07a, 0xa8714c, 0x7a4e32, 0xf5d6bc];
  // a seated rider (local: +z forward, +y up), arms up or down
  function rider(mg, x, y, z, seed, armsUp = 0) {
    const c = shirts[Math.floor(hash(seed, 1) * shirts.length)], sk = SKIN[Math.floor(hash(seed, 2) * 5)], hair = [0x3b2416, 0x1a1410, 0x8a5a2a, 0xd9b26a][Math.floor(hash(seed, 3) * 4)];
    mg.add(GEO.box, T(x, y + 0.3, z, 0, 0.36, 0.55, 0.25), c); mg.add(GEO.sph, T(x, y + 0.72, z, 0, 0.24, 0.27, 0.25), sk); mg.add(HEMI_LO, T(x, y + 0.75, z - 0.01, 0, 0.26, 0.19, 0.27), hair);
    for (const s of [-1, 1]) { if (armsUp && hash(seed, 9 + s) < armsUp) mg.add(GEO.box, T(x + s * 0.24, y + 0.75, z + 0.05, 0, 0.09, 0.6, 0.1, 0, -s * 0.25), c); else mg.add(GEO.box, T(x + s * 0.22, y + 0.25, z + 0.15, 0, 0.09, 0.45, 0.1, -0.9), c); }
  }
  const instTrain = (geos, count) => geos.map(g => { const im = new THREE.InstancedMesh(g, MV, count); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; grp.add(im); return im; });

  // ================================================================ HERO COASTER extras + trains
  {
    const r = R('hero_coaster'); const p = r.params; const tr = park.track('hero_coaster');
    const lift = tr.segments.filter(g => g.tag === 'lift');
    // catwalks + handrails + chain on the lift (both sides), anti-rollback rack
    for (const g of lift) for (let s = g.s0; s < g.s1; s += 1.0) {
      const f = tr.sample(s), f2 = tr.sample(Math.min(s + 1.0, g.s1)); const left = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
      const off = (a, l, u) => [a.pos[0] + left[0] * l + a.up[0] * u, a.pos[1] + left[1] * l + a.up[1] * u, a.pos[2] + left[2] * l + a.up[2] * u];
      for (const sd of [-1, 1]) { K.add(GEO.box, M, beamM(off(f, sd * 1.35, -0.45), off(f2, sd * 1.35, -0.45), 0.7, 0.05), 0x9aa3ad);
        K.add(GEO.box, M, beamM(off(f, sd * 1.7, 0.6), off(f2, sd * 1.7, 0.6), 0.05), 0x9aa3ad); K.add(GEO.box, M, beamM(off(f, sd * 1.7, 0.1), off(f2, sd * 1.7, 0.1), 0.04), 0x9aa3ad);
        K.add(GEO.box, M, beamM(off(f, sd * 1.7, -0.45), off(f, sd * 1.7, 0.6), 0.05), 0x9aa3ad); K.add(GEO.box, M, beamM(off(f, sd * 1.0, -0.45), off(f, sd * 1.7, -0.45), 0.06), 0x9aa3ad); }
      K.add(GEO.box, M, beamM(off(f, 0, -0.08), off(f2, 0, -0.08), 0.2, 0.08), 0x6a6e74); // chain trough
      for (let k = 0; k < 4; k++) { const u = k / 4; const a = [f.pos[0] * (1 - u) + f2.pos[0] * u, 0, 0]; const pp = off({ pos: [f.pos[0] + (f2.pos[0] - f.pos[0]) * u, f.pos[1] + (f2.pos[1] - f.pos[1]) * u, f.pos[2] + (f2.pos[2] - f.pos[2]) * u], up: f.up }, 0, 0.0); K.add(GEO.box, M, T(pp[0], pp[1], pp[2], Math.atan2(f.tangent[0], f.tangent[2]), 0.12, 0.06, 0.16, -Math.asin(f.tangent[1])), 0x2a2a2a); }
      K.add(GEO.box, M, beamM(off(f, 0.3, -0.12), off(f2, 0.3, -0.12), 0.06, 0.12), 0x8a8e94);
    }
    if (pixel) { // solid track ribbon so the thin rails read at native pixel size
      const n = Math.ceil(tr.length / 0.5) + 1; const pos = [], idx = [];
      for (let i = 0; i < n; i++) { const f = tr.sample(Math.min(i * 0.5, tr.length)); const left = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
        for (const [l, u] of [[-0.75, 0.1], [0.75, 0.1], [0.75, -0.75], [-0.75, -0.75]]) pos.push(f.pos[0] + left[0] * l + f.up[0] * u, f.pos[1] + left[1] * l + f.up[1] * u, f.pos[2] + left[2] * l + f.up[2] * u);
        if (i > 0) for (let j = 0; j < 4; j++) { const a = (i - 1) * 4 + j, b = (i - 1) * 4 + (j + 1) % 4, c = i * 4 + j, d = i * 4 + (j + 1) % 4; idx.push(a, c, b, b, c, d); } }
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setIndex(idx); g2.computeVertexNormals();
      const mm = new THREE.Mesh(g2, mat({ color: 0xe23b2e, side: THREE.DoubleSide })); mm.castShadow = mm.receiveShadow = true; grp.add(mm);
    }
    // bulbs along outer rails on lift and loop
    const bt = tr.segments.filter(g => g.tag === 'lift' || g.tag === 'loop');
    for (const g of bt) for (let s = g.s0; s < g.s1; s += 1.2) { const f = tr.sample(s); const left = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
      for (const sd of [-1, 1]) ctx.bulbs.push([T(f.pos[0] + left[0] * sd * 0.75 + f.up[0] * 0.12, f.pos[1] + left[1] * sd * 0.75 + f.up[1] * 0.12, f.pos[2] + left[2] * sd * 0.75 + f.up[2] * 0.12, 0, 0.13, 0.13, 0.13), 0xffe2a0]); }
    // support footers (bigger, painted) + cross bracing for tall lattice towers
    for (const sp of tr.supports) { K.add(GEO.box, M, T(sp.base[0], sp.base[1] + 0.2, sp.base[2], 0, 1.7, 0.4, 1.7), 0xb8b2a6);
      if (sp.type === 'lattice_tower' && sp.height > 6) { const n = Math.floor(sp.height / 4); for (let k = 1; k <= n; k++) { const y = sp.base[1] + k * sp.height / (n + 1); K.add(GEO.box, M, T(sp.base[0], y, sp.base[2], 0, 1.6, 0.12, 0.12), 0xf4ebd9); K.add(GEO.box, M, T(sp.base[0], y, sp.base[2], 0, 0.12, 0.12, 1.6), 0xf4ebd9); }
        for (const [dx, dz] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) K.add(GEO.cyl6, M, beamM([sp.base[0] + dx * 1.3, sp.base[1], sp.base[2] + dz * 1.3], [sp.top[0] + dx * 0.4, sp.top[1] - 0.7, sp.top[2] + dz * 0.4], 0.22), 0xf4ebd9); } }
    // station: sawtooth canopy, platform, red fascia
    const st = r.station; const Ls = frame(st.center[0], 0, st.center[1], st.rot || 0);
    K.add(GEO.box, M, Ls(0, 0.5, st.d * 0.25, st.w, 1.0, st.d * 0.4), 0xd8d2c4);
    for (let i = 0; i < 6; i++) { K.add(GEO.wedge, M, Ls(-st.w / 2 + (i + 0.5) * st.w / 6, st.h - 0.3, 0, st.w / 6, 1.4, st.d, Math.PI / 2), 0x2e294e); }
    K.add(GEO.box, M, Ls(0, st.h - 0.5, st.d / 2 + 0.05, st.w + 0.4, 0.6, 0.2), 0xe23b2e); K.add(GEO.box, M, Ls(0, st.h - 0.5, -st.d / 2 - 0.05, st.w + 0.4, 0.6, 0.2), 0xe23b2e);
    for (let i = 0; i <= 8; i++) for (const sz of [-1, 1]) K.add(GEO.cyl6, M, Ls(-st.w / 2 + i * st.w / 8, st.h / 2, sz * (st.d / 2 - 0.4), 0.3, st.h, 0.3), 0xf4ebd9);
    // trains: car model with riders (lead car with nose cone)
    const tp = p.train; const nT = (D.animation.hero_coaster || {}).trains || 2;
    const carGeo = (lead, color, seed) => { const mg = new MG(); const w = tp.car_width, L = tp.car_length; const trim = color === 0xe23b2e ? 0xf2f2f2 : 0xe23b2e;
      mg.add(GEO.box, T(0, 0.45, 0, 0, w * 0.92, 0.5, L * 0.92), color); mg.add(GEO.box, T(0, 0.73, 0, 0, w * 0.95, 0.08, L * 0.95), trim);
      for (const sd of [-1, 1]) mg.add(GEO.box, T(sd * w * 0.47, 0.8, 0, 0, 0.08, 0.25, L * 0.9), color);
      for (let row = 0; row < 2; row++) { const z = L * 0.22 - row * L * 0.47; mg.add(GEO.box, T(0, 0.85, z - 0.32, 0, w * 0.85, 0.65, 0.12), 0x2b2f3a);
        for (const sd of [-1, 1]) { rider(mg, sd * 0.45, 0.6, z, seed * 10 + row * 2 + (sd > 0), 0.55); mg.add(GEO.box, T(sd * 0.45, 0.95, z + 0.28, 0, 0.5, 0.08, 0.08), 0x333333); } }
      for (const sd of [-1, 1]) for (const zz of [-L * 0.35, L * 0.35]) mg.add(GEO.cyl, T(sd * 0.55, 0.12, zz, 0, 0.3, 0.12, 0.3, 0, Math.PI / 2), 0x555555);
      if (lead) { mg.add(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), T(0, 0.45, L * 0.46, 0, w * 0.9, w * 0.9, 1.3, Math.PI / 2), color); mg.add(GEO.box, T(0, 0.62, L * 0.62, 0, 0.6, 0.1, 0.3), trim); mg.add(GEO.sph, T(0, 0.62, L * 0.95, 0, 0.25, 0.25, 0.2), 0xffe9a8); }
      return mg.geo(); };
    const cars = []; for (let k = 0; k < tp.cars; k++) cars.push(carGeo(k === 0, hex(tp.colors[k % 2]), k));
    const ims = instTrain(cars, nT);
    if (shot.camera && shot.camera.mode === 'pov' && shot.camera.ride === 'hero_coaster') { // our own lead car: no front-row riders, slim lap bars, no lamp
      const mg = new MG(); const w = tp.car_width, L = tp.car_length; const color = hex(tp.colors[0]), trim = 0xe23b2e;
      mg.add(GEO.box, T(0, 0.42, 0, 0, w * 0.92, 0.46, L * 0.92), color); mg.add(GEO.box, T(0, 0.68, 0, 0, w * 0.95, 0.06, L * 0.95), trim);
      for (const sd of [-1, 1]) mg.add(GEO.box, T(sd * w * 0.47, 0.75, 0, 0, 0.08, 0.2, L * 0.9), color);
      mg.add(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), T(0, 0.4, L * 0.46, 0, w * 0.9, 1.1, 0.6, Math.PI / 2), color);
      for (const sd of [-1, 1]) { mg.add(GEO.cyl, beamM([sd * 0.45, 0.72, L * 0.22 + 0.05], [sd * 0.45, 0.86, L * 0.22 + 0.4], 0.06), 0x333333); mg.add(GEO.box, T(sd * 0.45, 0.88, L * 0.22 + 0.42, 0, 0.42, 0.06, 0.06), 0x333333); }
      const z = L * 0.22 - L * 0.47; mg.add(GEO.box, T(0, 0.85, z - 0.32, 0, w * 0.85, 0.65, 0.12), 0x2b2f3a); for (const sd of [-1, 1]) rider(mg, sd * 0.45, 0.6, z, 77 + (sd > 0), 0.55);
      const pg = mg.geo(); const pm = new THREE.InstancedMesh(pg, MV, 1); pm.frustumCulled = false; pm.name = 'povcar'; grp.add(pm); ctx.povCar = pm;
    }
    ctx.animators.push(t => { const fronts = park.trainFronts('hero_coaster', t, shot); const m4 = new THREE.Matrix4();
      for (let ti = 0; ti < nT; ti++) for (let c = 0; c < tp.cars; c++) { const s = fronts[ti] - tp.car_length / 2 - c * (tp.car_length + tp.car_gap); m4.fromArray(tr.matrix(s, [0, 0.1, 0]));
        if (ctx.povCar && ti === (shot.camera.train || 0) && c === 0) { ctx.povCar.setMatrixAt(0, m4); ctx.povCar.instanceMatrix.needsUpdate = true; m4.makeScale(0, 0, 0); } ims[c].setMatrixAt(ti, m4); }
      ims.forEach(im => im.instanceMatrix.needsUpdate = true); ctx.heroFront = fronts; });
  }

  // ================================================================ FAMILY COASTER caterpillar
  {
    const r = R('family_coaster'); const tp = r.params.train; const tr = park.track('family_coaster');
    const g = (lead, k) => { const mg = new MG(); const c = hex(tp.colors[k % 2]); mg.add(GEO.sph, T(0, 0.55, 0, 0, tp.car_width, 0.9, tp.car_length), c); mg.add(GEO.box, T(0, 0.75, -0.1, 0, tp.car_width * 0.6, 0.2, 0.6), 0x2b2f3a);
      rider(mg, 0.3, 0.55, 0, k * 3 + 1, 0.4); rider(mg, -0.3, 0.55, 0, k * 3 + 2, 0.4);
      if (lead) { mg.add(GEO.sph2, T(0, 1.2, 0.8, 0, 1.0, 1.0, 0.9), c); mg.add(GEO.sph, T(0.22, 1.35, 1.2, 0, 0.18, 0.2, 0.1), 0xffffff); mg.add(GEO.sph, T(-0.22, 1.35, 1.2, 0, 0.18, 0.2, 0.1), 0xffffff); mg.add(GEO.cyl6, T(0.2, 1.9, 0.8, 0, 0.05, 0.6, 0.05), 0x333333); mg.add(GEO.cyl6, T(-0.2, 1.9, 0.8, 0, 0.05, 0.6, 0.05), 0x333333); }
      return mg.geo(); };
    const ims = instTrain([...Array(tp.cars)].map((_, k) => g(k === 0, k)), 1);
    ctx.animators.push(t => { const f = park.trainFronts('family_coaster', t, shot)[0]; const m4 = new THREE.Matrix4(); for (let c = 0; c < tp.cars; c++) { m4.fromArray(tr.matrix(f - tp.car_length / 2 - c * (tp.car_length + tp.car_gap), [0, 0.1, 0])); ims[c].setMatrixAt(0, m4); ims[c].instanceMatrix.needsUpdate = true; } });
  }

  // ================================================================ WOODEN COASTER (build-mode capable)
  {
    const r = R('wooden_coaster'); const p = r.params; const tr = park.track('wooden_coaster'); const wood = hex(p.colors.structure), dark = hex(p.colors.track), steel = hex(p.colors.running_rail);
    const wg = new THREE.Group(); grp.add(wg); ctx.woodGroup = wg;
    const items = []; // {geo, mat, m, c, s}
    const add = (geo, m, c, s, mt = M) => items.push({ geo, m, c, s, mt });
    // track stack (ribbon) with per-vertex s attribute for the build clip
    const step = 0.5; const n = Math.ceil(tr.length / step) + 1; const pos = [], nor = [], sa = [], idx = [];
    const prof = [[-1.2, 0], [1.2, 0], [1.2, -0.6], [-1.2, -0.6]];
    for (let i = 0; i < n; i++) { const s = Math.min(i * step, tr.length); const f = tr.sample(s); const left = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
      for (const [l, u] of prof) { pos.push(f.pos[0] + left[0] * l + f.up[0] * (u - 0.05), f.pos[1] + left[1] * l + f.up[1] * (u - 0.05), f.pos[2] + left[2] * l + f.up[2] * (u - 0.05)); nor.push(f.up[0], f.up[1], f.up[2]); sa.push(s); }
      if (i > 0) for (let j = 0; j < 4; j++) { const a = (i - 1) * 4 + j, b = (i - 1) * 4 + (j + 1) % 4, c = i * 4 + j, d = i * 4 + (j + 1) % 4; idx.push(a, c, b, b, c, d); } }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); rg.setAttribute('iS', new THREE.Float32BufferAttribute(sa, 1)); rg.setIndex(idx); rg.computeVertexNormals();
    const MClip = mat({ color: dark, vhead: 'attribute float iS;', vert: `if (iS > uBuild) transformed = vec3(0., -9999., 0.);`, frag: `{ float f = fract(p.y*3.3 + p.x*.1); diffuseColor.rgb *= .85 + .2*step(.5,f); }`, side: THREE.DoubleSide });
    const rib = new THREE.Mesh(rg, MClip); rib.castShadow = rib.receiveShadow = true; rib.frustumCulled = false; wg.add(rib);
    // running rails + walkboards + ties (instanced with s)
    for (let s = 0; s < tr.length; s += 1.0) { const f = tr.sample(s), f2 = tr.sample(Math.min(s + 1.0, tr.length - 0.01)); const left = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
      const off = (a, l, u) => [a.pos[0] + left[0] * l + a.up[0] * u, a.pos[1] + left[1] * l + a.up[1] * u, a.pos[2] + left[2] * l + a.up[2] * u];
      for (const sd of [-1, 1]) { add(GEO.box, beamM(off(f, sd * 0.55, 0.02), off(f2, sd * 0.55, 0.02), 0.14, 0.08), steel, s); add(GEO.box, beamM(off(f, sd * 1.6, -0.5), off(f2, sd * 1.6, -0.5), 0.8, 0.06), 0xc9a46a, s);
        if (f.pos[1] > 4) { add(GEO.box, beamM(off(f, sd * 2.0, 0.5), off(f2, sd * 2.0, 0.5), 0.06), wood, s); if (Math.round(s) % 2 === 0) add(GEO.box, beamM(off(f, sd * 2.0, -0.5), off(f, sd * 2.0, 0.5), 0.07), wood, s); } }
      add(GEO.box, T(...off(f, 0, -0.62), Math.atan2(f.tangent[0], f.tangent[2]), 4.2, 0.14, 0.22, -Math.asin(Math.max(-1, Math.min(1, f.tangent[1])))), wood, s);
    }
    // bents: posts, ledgers + X braces every 2.5 m, stringers between neighbouring bents, longitudinal diagonals every 3rd bay
    const B = tr.bents; let prev = null;
    B.forEach((b, bi) => {
      const [x, y, z] = b.top; const [ax, az] = b.axis; const tw = b.top_width / 2, bw = b.base_width / 2; const g0 = b.ground; const H = y - g0;
      const at = (side, yy) => { const u = (yy - g0) / Math.max(H, 0.01); const w = bw + (tw - bw) * u; return [x + ax * w * side, yy, z + az * w * side]; };
      for (const sd of [-1, 1]) { add(GEO.box, beamM(at(sd, g0), at(sd, y - 0.6), 0.3), wood, b.s); add(GEO.box, T(...at(sd, g0 + 0.15), 0, 0.7, 0.3, 0.7), 0xb8b2a6, b.s); }
      const nl = Math.max(0, Math.floor((H - 0.6) / 2.5)); const levels = [g0 + 0.3]; for (let k = 1; k <= nl; k++) levels.push(g0 + k * 2.5); levels.push(y - 0.6);
      for (let k = 1; k < levels.length; k++) { add(GEO.box, beamM(at(-1, levels[k]), at(1, levels[k]), 0.2), wood, b.s);
        if (levels[k] - levels[k - 1] > 0.8) { add(GEO.box, beamM(at(-1, levels[k - 1]), at(1, levels[k]), 0.13), wood, b.s); add(GEO.box, beamM(at(1, levels[k - 1]), at(-1, levels[k]), 0.13), wood, b.s); } }
      if (prev && Math.hypot(prev.top[0] - x, prev.top[2] - z) < 4) {
        const [px, py, pz] = prev.top; const [pax, paz] = prev.axis; const ptw = prev.top_width / 2, pbw = prev.base_width / 2; const pH = py - prev.ground;
        const pat = (side, yy) => { const u = (yy - prev.ground) / Math.max(pH, 0.01); const w = pbw + (ptw - pbw) * u; return [px + pax * w * side, yy, pz + paz * w * side]; };
        const top = Math.min(y, py) - 0.6;
        for (let yy = g0 + 2.5; yy < top; yy += 2.5) for (const sd of [-1, 1]) add(GEO.box, beamM(at(sd, yy), pat(sd, yy), 0.12), wood, b.s);
        if (bi % 3 === 0) for (const sd of [-1, 1]) add(GEO.box, beamM(at(sd, g0 + 0.3), pat(sd, Math.max(g0 + 0.5, top)), 0.1), wood, b.s);
      }
      prev = b;
    });
    // station: timber gable with false front
    const st = r.station; const Ls = frame(st.center[0], 0, st.center[1], st.rot || 0);
    add(GEO.box, Ls(0, 0.6, 0, st.w, 1.2, st.d), 0xb08a5a, 0); add(GEO.wedge, Ls(0, st.h, 0, st.w + 1, 2.6, st.d + 1, Math.PI / 2), 0x6b4a2e, 0);
    for (let i = 0; i <= 6; i++) for (const sx of [-1, 1]) add(GEO.cyl6, Ls(sx * (st.w / 2 - 0.3), st.h / 2, -st.d / 2 + i * st.d / 6, 0.3, st.h, 0.3), 0x8b6b4a, 0);
    add(GEO.box, Ls(0, st.h + 1.6, st.d / 2 + 0.4, st.w + 1, 3.4, 0.3), 0xa0522d, 0, mat({ frag: `{ float f = fract(p.y/0.3); diffuseColor.rgb *= 0.85 + 0.15*smoothstep(0.,.15,f); }` }));
    // build into instanced meshes, keeping s per instance for the build head
    const groups = new Map(); items.forEach(it => { const k = it.geo.uuid + it.mt.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
    const dyn = []; const col = new THREE.Color();
    for (const list of groups.values()) { const im = new THREE.InstancedMesh(list[0].geo, list[0].mt, list.length); list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, col.set(it.c)); }); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; wg.add(im); dyn.push([im, list]); }
    ctx.woodBuild = head => { const m4 = new THREE.Matrix4(), Z = new THREE.Matrix4().makeScale(0, 0, 0);
      for (const [im, list] of dyn) { list.forEach((it, i) => { if (it.s > head) im.setMatrixAt(i, Z); else if (it.s > head - 8) { const u = (it.s - (head - 8)) / 8; m4.makeTranslation(0, u * u * 14, 0).multiply(it.m); im.setMatrixAt(i, m4); } else im.setMatrixAt(i, it.m); }); im.instanceMatrix.needsUpdate = true; } };
    // trains
    const tp = p.train; const nT = (D.animation.wooden_coaster || {}).trains || 2;
    const cg = (k) => { const mg = new MG(); const c = hex(tp.colors[k % 2]), c2 = hex(tp.colors[(k + 1) % 2]); const w = tp.car_width, L = tp.car_length;
      mg.add(GEO.box, T(0, 0.5, 0, 0, w * 0.9, 0.6, L * 0.9), c); mg.add(GEO.box, T(0, 0.82, 0, 0, w * 0.94, 0.1, L * 0.94), c2);
      for (let row = 0; row < 2; row++) { const z = L * 0.22 - row * L * 0.46; for (const sd of [-1, 1]) rider(mg, sd * 0.45, 0.65, z, k * 7 + row * 2 + (sd > 0) + 300, 0.35); }
      if (k === 0) mg.add(GEO.box, T(0, 0.75, L * 0.5, 0, w * 0.9, 0.5, 0.3), c2);
      return mg.geo(); };
    const ims = instTrain([...Array(tp.cars)].map((_, k) => cg(k)), nT);
    ctx.woodTrains = ims;
    ctx.animators.push(t => { const fronts = park.trainFronts('wooden_coaster', t, shot); const m4 = new THREE.Matrix4(); const Z = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let ti = 0; ti < nT; ti++) { let sf = fronts[ti]; let vis = true; if (ctx.woodTrainFilter) { const o = ctx.woodTrainFilter(t, ti, sf); vis = o.vis; sf = o.s; }
        for (let c = 0; c < tp.cars; c++) { const s = sf - tp.car_length / 2 - c * (tp.car_length + tp.car_gap); if (!vis) { ims[c].setMatrixAt(ti, Z); continue; } m4.fromArray(tr.matrix(s, [0, 0.05, 0])); ims[c].setMatrixAt(ti, m4); } }
      ims.forEach(im => im.instanceMatrix.needsUpdate = true); });
  }

  // ================================================================ RAILWAY train (tank loco + 5 open coaches) + sleepers
  {
    const r = R('railway'); const tp = r.params.train; const tr = park.track('railway'); const c = tp.colors;
    for (let s = 0; s < tr.length; s += 0.9) { const f = tr.sample(s); K.add(GEO.box, M, T(f.pos[0], f.pos[1] - 0.12, f.pos[2], Math.atan2(f.tangent[0], f.tangent[2]), 1.8, 0.12, 0.22), 0x6b4a2e); }
    const loco = (() => { const mg = new MG(); const g = hex(c.loco), tr2 = hex(c.trim);
      mg.add(GEO.box, T(0, 0.75, 0, 0, 1.9, 0.3, 6.6), 0x2b2b2b); mg.add(GEO.box, T(0, 0.75, 3.35, 0, 2.2, 0.5, 0.2), 0xc0392b); mg.add(GEO.box, T(0, 0.75, -3.35, 0, 2.2, 0.5, 0.2), 0xc0392b);
      mg.add(GEO.cyl16, T(0, 1.75, 0.9, 0, 1.5, 3.8, 1.5, Math.PI / 2), g); mg.add(GEO.cyl16, T(0, 1.75, 2.85, 0, 1.55, 0.3, 1.55, Math.PI / 2), 0x2b2b2b);
      for (const zz of [-0.2, 1.2, 2.4]) mg.add(GEO.cyl16, T(0, 1.75, zz, 0, 1.58, 0.08, 1.58, Math.PI / 2), tr2);
      mg.add(GEO.cyl, T(0, 3.0, 2.5, 0, 0.42, 1.3, 0.42), 0x2b2b2b); mg.add(GEO.cyl, T(0, 3.7, 2.5, 0, 0.6, 0.15, 0.6), 0x2b2b2b);
      mg.add(GEO.hemi, T(0, 2.45, 1.0, 0, 0.7, 0.6, 0.7), tr2); for (const sd of [-1, 1]) mg.add(GEO.box, T(sd * 0.85, 1.55, 1.0, 0, 0.35, 1.0, 3.0), g);
      mg.add(GEO.box, T(0, 2.0, -1.9, 0, 2.0, 2.4, 2.2), g); mg.add(GEO.box, T(0, 3.25, -1.9, 0, 2.2, 0.12, 2.5), 0x2b2b2b); for (const sd of [-1, 1]) mg.add(GEO.box, T(sd * 1.01, 2.4, -1.9, 0, 0.04, 0.7, 0.9), 0xf3e6cc);
      for (const sd of [-1, 1]) for (const zz of [-1.6, 0.0, 1.6]) { mg.add(GEO.cyl16, T(sd * 0.75, 0.6, zz, 0, 1.1, 0.12, 1.1, 0, Math.PI / 2), 0xc0392b); mg.add(GEO.cyl, T(sd * 0.82, 0.6, zz, 0, 0.3, 0.06, 0.3, 0, Math.PI / 2), tr2); }
      for (const sd of [-1, 1]) mg.add(GEO.box, T(sd * 0.9, 0.6, 0, 0, 0.06, 0.1, 3.4), 0x999999);
      rider(mg, 0.4, 1.0, -1.9, 999, 0); mg.add(GEO.sph, T(0, 1.75, 3.05, 0, 0.35, 0.35, 0.1), 0xfff2c8);
      return mg.geo(); })();
    const coach = (k) => { const mg = new MG(); const cc = hex(c.coaches), roof = hex(c.roofs), tr2 = hex(c.trim);
      mg.add(GEO.box, T(0, 0.7, 0, 0, 2.0, 0.25, 6.6), 0x2b2b2b); mg.add(GEO.box, T(0, 1.15, 0, 0, 2.1, 0.7, 6.6), cc); mg.add(GEO.box, T(0, 1.52, 0, 0, 2.15, 0.07, 6.7), tr2);
      for (const sd of [-1, 1]) for (let i = 0; i <= 4; i++) mg.add(GEO.box, T(sd * 1.0, 2.2, -3.2 + i * 1.6, 0, 0.08, 1.4, 0.08), tr2);
      mg.add(GEO.box, T(0, 2.95, 0, 0, 2.4, 0.12, 7.0), roof); mg.add(GEO.wedge, T(0, 3.0, 0, Math.PI / 2, 7.0, 0.35, 2.4), roof);
      for (const sd of [-1, 1]) { mg.add(GEO.box, T(sd * 1.2, 2.82, 0, 0, 0.05, 0.25, 7.0), cc); }
      for (let i = 0; i < 4; i++) { mg.add(GEO.box, T(0, 1.55, -2.4 + i * 1.6, 0, 1.8, 0.1, 0.5), 0x8b5a2b); for (const sd of [-0.5, 0.5]) if (hash(k * 13 + i, sd > 0) < 0.75) rider(mg, sd, 1.4, -2.4 + i * 1.6, k * 40 + i * 2 + (sd > 0) + 500, 0.15); }
      for (const sd of [-1, 1]) for (const zz of [-2.3, 2.3]) mg.add(GEO.cyl, T(sd * 0.7, 0.45, zz, 0, 0.8, 0.1, 0.8, 0, Math.PI / 2), 0x333333);
      return mg.geo(); };
    const geos = [loco, ...[0, 1, 2, 3, 4].map(coach)]; const ims = instTrain(geos, 1); const lens = [7.0, 7.0, 7.0, 7.0, 7.0, 7.0];
    ctx.animators.push(t => { const f = park.trainFronts('railway', t, shot)[0]; let s = f; const m4 = new THREE.Matrix4();
      for (let k = 0; k < 6; k++) { const sc = s - lens[k] / 2; m4.fromArray(tr.matrix(sc, [0, 0.05, 0])); ims[k].setMatrixAt(0, m4); ims[k].instanceMatrix.needsUpdate = true; s -= lens[k] + 0.6; } });
  }

  // ================================================================ FLUME logs + RAPIDS rafts
  for (const id of ['log_flume', 'river_rapids']) {
    const r = R(id); const tr = park.track(id); const isF = id === 'log_flume'; const bp = isF ? r.params.boats : r.params.rafts; const nB = (D.animation[id] || {}).boats || bp.count;
    const mg = new MG();
    if (isF) { mg.add(GEO.cyl16, T(0, 0.35, 0, 0, 1.3, bp.length, 0.9, Math.PI / 2), 0x8b5a2b); mg.add(GEO.box, T(0, 0.75, 0, 0, 0.9, 0.2, bp.length * 0.8), 0x5a3a1a); for (let i = 0; i < 4; i++) rider(mg, 0, 0.45, 1.3 - i * 0.85, 700 + i, 0.3); }
    else { mg.add(GEO.cyl16, T(0, 0.35, 0, 0, bp.diameter, 0.7, bp.diameter), 0x333333); mg.add(new THREE.TorusGeometry(0.5, 0.12, 6, 20), T(0, 0.6, 0, 0, bp.diameter * 0.9, bp.diameter * 0.9, bp.diameter * 0.9, Math.PI / 2), hex(bp.colors[0])); mg.add(GEO.cyl6, T(0, 0.9, 0, 0, 0.6, 0.8, 0.6), 0xf1c40f); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const ml = new MG(); rider(mg, Math.cos(a) * 1.1, 0.35, Math.sin(a) * 1.1, 800 + i, 0.2); } }
    const im = instTrain([mg.geo()], nB)[0];
    ctx.animators.push(t => { const fr = park.trainFronts(id, t, shot); const m4 = new THREE.Matrix4(); fr.forEach((s, k) => { m4.fromArray(tr.matrix(s, [0, 0, 0])); if (!isF) m4.multiply(new THREE.Matrix4().makeRotationY(t * 0.4 + k)); im.setMatrixAt(k, m4); }); im.instanceMatrix.needsUpdate = true; });
  }

  // ================================================================ FLAT RIDES (animated groups)
  const ride = (id) => { const r = R(id); const g = new THREE.Group(); g.position.set(...r.position); g.rotation.y = r.rot || 0; g.visible = !(ctx.hideRides || []).includes(id); g.name = id; grp.add(g); return [r, g, r.params]; };
  const addTo = (parent, geo, mt, m, c) => { const mesh = new THREE.Mesh(geo, mt); mesh.applyMatrix4(m); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.c = c; if (c != null) { mesh.material = mt; } parent.add(mesh); return mesh; };
  // helper: build static kit inside a group (local coords)
  const localKit = (g) => new Kit(g);
  ctx.rideState = ctx.rideState || {}; // per-shot overrides: {ferris:{angle(t)}, ...}
  // ---------------- Ferris wheel
  {
    const [r, g, p] = ride('ferris_wheel'); const R0 = p.diameter / 2, hub = p.hub_height, rs = p.rim_spacing / 2; const kS = localKit(g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { kS.add(GEO.box, M, beamM([sx * 13, 0, sz * 5], [0, hub, sz * (rs + 0.6)], 0.8), WHITE); }
    for (const sz of [-1, 1]) for (const yy of [8, 16]) { const k = 13 * (1 - yy / hub); kS.add(GEO.box, M, beamM([-k, yy, sz * (5 - (5 - rs - 0.6) * yy / hub)], [k, yy, sz * (5 - (5 - rs - 0.6) * yy / hub)], 0.35), WHITE); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kS.add(GEO.box, M, T(sx * 13, 0.4, sz * 5, 0, 2, 0.8, 2), 0xb8b2a6);
    kS.add(GEO.box, M, T(0, 0.5, 12, 0, 10, 1.0, 4), 0xd8d2c4); kS.add(GEO.box, M, T(0, 0.9, 7, 0, 3, 1.8, 6), 0xd8d2c4);
    kS.add(GEO.cyl16, M, T(0, hub, 0, 0, 1.2, p.rim_spacing + 2.4, 1.2, Math.PI / 2), 0xd0d0d0);
    kS.build(true);
    const wheel = new THREE.Group(); wheel.position.y = hub; g.add(wheel); const kW = localKit(wheel);
    for (const sz of [-rs, rs]) { kW.add(new THREE.TorusGeometry(R0, 0.28, 6, 90), M, T(0, 0, sz), WHITE); kW.add(new THREE.TorusGeometry(R0 - 2.2, 0.16, 5, 90), M, T(0, 0, sz), WHITE);
      for (let k = 0; k < p.spokes; k++) { const a = k / p.spokes * Math.PI * 2; kW.add(GEO.box, M, beamM([Math.cos(a) * 1.4, Math.sin(a) * 1.4, sz * 0.6], [Math.cos(a) * R0, Math.sin(a) * R0, sz], 0.14), WHITE);
        const a2 = (k + 0.5) / p.spokes * Math.PI * 2; kW.add(GEO.box, M, beamM([Math.cos(a) * (R0 - 2.2), Math.sin(a) * (R0 - 2.2), sz], [Math.cos(a2) * R0, Math.sin(a2) * R0, sz], 0.1), WHITE);
        kW.add(GEO.box, M, beamM([Math.cos(a2) * R0, Math.sin(a2) * R0, sz], [Math.cos((k + 1) / p.spokes * Math.PI * 2) * (R0 - 2.2), Math.sin((k + 1) / p.spokes * Math.PI * 2) * (R0 - 2.2), sz], 0.1), WHITE); } }
    for (let k = 0; k < p.spokes; k++) { const a = k / p.spokes * Math.PI * 2; kW.add(GEO.box, M, beamM([Math.cos(a) * R0, Math.sin(a) * R0, -rs], [Math.cos(a) * R0, Math.sin(a) * R0, rs], 0.16), WHITE); }
    kW.add(GEO.cyl16, M, T(0, 0, 0, 0, 3.4, p.rim_spacing + 0.6, 3.4, Math.PI / 2), 0xe2b33c);
    kW.build(false);
    // bulbs on spokes and rims (two layers: off / on)
    const bOff = [], bOn = [];
    for (const sz of [-rs - 0.2, rs + 0.2]) { for (let k = 0; k < p.spokes; k++) { const a = k / p.spokes * Math.PI * 2; for (let j = 1; j <= 8; j++) bOff.push(T(Math.cos(a) * (1.5 + j * (R0 - 1.5) / 8), Math.sin(a) * (1.5 + j * (R0 - 1.5) / 8), sz, 0, 0.3, 0.3, 0.3)); }
      for (let k = 0; k < 120; k++) { const a = k / 120 * Math.PI * 2; bOff.push(T(Math.cos(a) * (R0 + 0.35), Math.sin(a) * (R0 + 0.35), sz, 0, 0.32, 0.32, 0.32)); } }
    const bulbMesh = (col, unlit) => { const im = new THREE.InstancedMesh(GEO.ico, unlit ? mat({ unlit: true, mot: 0 }) : M, bOff.length); bOff.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, new THREE.Color(col)); }); im.frustumCulled = false; wheel.add(im); return im; };
    const offM = bulbMesh(0xd8d4c8, false), onM = bulbMesh(0xfff0b0, true); onM.visible = true; offM.visible = false;
    // gondolas: open cage with round canopy + 2 riders
    const gcols = p.colors.gondolas; const gGeo = gcols.map((c, k) => { const mg = new MG(); const cc = hex(c);
      mg.add(GEO.box, T(0, -2.4, 0, 0, 2.0, 0.25, 2.0), cc); mg.add(GEO.box, T(0, -1.95, 0, 0, 2.0, 0.65, 2.0), cc);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mg.add(GEO.cyl6, T(sx * 0.9, -1.2, sz * 0.9, 0, 0.08, 2.2, 0.08), WHITE);
      mg.add(GEO.hemi, T(0, -0.15, 0, 0, 2.5, 0.8, 2.5), cc); mg.add(GEO.cyl6, T(0, 0.35, 0, 0, 0.12, 0.7, 0.12), 0x999999); mg.add(GEO.sph, T(0, 0.65, 0, 0, 0.3, 0.3, 0.3), GOLD);
      rider(mg, -0.45, -2.25, 0.1, 900 + k, 0); rider(mg, 0.45, -2.25, -0.1, 950 + k, 0); return mg.geo(); });
    const gIm = gGeo.map(geo => { const im = new THREE.InstancedMesh(geo, MV, Math.ceil(p.gondolas / gcols.length)); im.castShadow = true; im.frustumCulled = false; g.add(im); return im; });
    const wheelAngle = t => (ctx.rideState.ferris ? ctx.rideState.ferris(t) : park.flatRide('ferris_wheel', t).angle);
    ctx.ferrisBulbs = on => { onM.visible = on; offM.visible = !on; };
    ctx.animators.push(t => { const a = wheelAngle(t); wheel.rotation.z = a; const cnt = gcols.map(() => 0);
      for (let k = 0; k < p.gondolas; k++) { const b = a + k / p.gondolas * Math.PI * 2; const ci = k % gcols.length; gIm[ci].setMatrixAt(cnt[ci]++, T(Math.cos(b) * R0, hub + Math.sin(b) * R0, 0, 0, 1, 1, 1, 0, Math.sin(t * 1.3 + k) * 0.04)); }
      gIm.forEach(im => im.instanceMatrix.needsUpdate = true); });
  }
  // ---------------- Swing ride (on the pier deck)
  {
    const [r, g, p] = ride('swing_ride'); const kS = localKit(g);
    kS.add(GEO.cyl16, M, T(0, 0.15, 0, 0, 13, 0.3, 13), 0xd8d2c4); kS.add(new THREE.CylinderGeometry(0.75, 1.0, 1, 16), M, T(0, p.mast_height / 2, 0, 0, 1, p.mast_height, 1), WHITE);
    for (let k = 0; k < 6; k++) kS.add(GEO.cyl16, M, T(0, 1.5 + k * 2.2, 0, 0, 1.9, 0.5, 1.9), 0x2e86c1);
    kS.build(true);
    const top = new THREE.Group(); top.position.y = p.mast_height; g.add(top); const kT = localKit(top);
    kT.add(stripe(new THREE.ConeGeometry(0.5, 1, 32), [0x2e86c1, WHITE], 32), MV, T(0, 1.4, 0, 0, p.canopy_radius * 2.1, 2.8, p.canopy_radius * 2.1), 0xffffff);
    kT.add(stripe(new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 1, true), [WHITE, 0x2e86c1], 32), MVD, T(0, -0.2, 0, 0, p.canopy_radius * 2.1, 0.8, p.canopy_radius * 2.1), 0xffffff);
    kT.add(GEO.sph, M, T(0, 3.0, 0, 0, 0.6, 0.6, 0.6), GOLD); kT.add(GEO.cyl6, M, T(0, 3.8, 0, 0, 0.08, 1.6, 0.08), WHITE);
    for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283; ctx.bulbs.push([T(r.position[0] + Math.cos(a) * p.canopy_radius * 1.05, r.position[1] + p.mast_height - 0.6, r.position[2] + Math.sin(a) * p.canopy_radius * 1.05, 0, 0.25, 0.25, 0.25), 0xffe2a0]); }
    kT.build(true);
    const chairGeo = (() => { const mg = new MG(); mg.add(GEO.box, T(0, 0, 0, 0, 0.6, 0.12, 0.6), 0xe74c3c); mg.add(GEO.box, T(0, 0.35, -0.28, 0, 0.6, 0.6, 0.08), 0xe74c3c); mg.add(GEO.box, T(0, p.chain_length / 2, 0, 0, 0.03, p.chain_length, 0.03), 0x999999); rider(mg, 0, -0.05, 0.05, 1200, 0.6); return mg.geo(); })();
    const ch = new THREE.InstancedMesh(chairGeo, MV, p.chairs); ch.castShadow = true; ch.frustumCulled = false; top.add(ch);
    const sw = t => ctx.rideState.swing ? ctx.rideState.swing(t) : park.flatRide('swing_ride', t);
    ctx.animators.push(t => { const s = sw(t); top.rotation.y = s.angle; const ang = s.chairAngleDeg * Math.PI / 180;
      for (let k = 0; k < p.chairs; k++) { const a = k / p.chairs * Math.PI * 2; const rr = p.canopy_radius - 0.6 + (k % 2) * 0.0; const m = T(Math.cos(a) * rr, -0.3, Math.sin(a) * rr, -a).multiply(new THREE.Matrix4().makeRotationZ(ang)).multiply(T(0, -p.chain_length, 0)); ch.setMatrixAt(k, m); }
      ch.instanceMatrix.needsUpdate = true; });
  }
  // ---------------- Pirate ship
  {
    const [r, g, p] = ride('pirate_ship'); const kS = localKit(g); const frameC = hex(p.colors.frame);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kS.add(GEO.box, M, beamM([sx * 8, 0, sz * 4.5], [0, p.pivot_height, sz * 2.4], 0.75), frameC);
    for (const sz of [-1, 1]) kS.add(GEO.box, M, beamM([-4, 7.5, sz * 3.5], [4, 7.5, sz * 3.5], 0.4), frameC);
    kS.add(GEO.cyl, M, T(0, p.pivot_height, 0, 0, 0.8, 6, 0.8, Math.PI / 2), 0x999999); kS.add(GEO.box, M, T(0, 0.2, 0, 0, 22, 0.4, 10), 0xd8d2c4);
    kS.build(true);
    const piv = new THREE.Group(); piv.position.y = p.pivot_height; g.add(piv); const kP = localKit(piv);
    const hull = new THREE.Shape(); const Lh = p.boat_length / 2; hull.moveTo(-Lh - 1, 2.2); hull.quadraticCurveTo(-Lh + 0.5, -0.4, -Lh * 0.4, -1.2); hull.lineTo(Lh * 0.4, -1.2); hull.quadraticCurveTo(Lh - 0.5, -0.4, Lh + 1, 2.2); hull.lineTo(Lh * 0.5, 1.0); hull.lineTo(-Lh * 0.5, 1.0); hull.closePath();
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 4.2, bevelEnabled: false }); hg.translate(0, 0, -2.1);
    const yBoat = -p.pivot_height + 3.2;
    kP.add(hg, M, T(0, yBoat, 0), hex(p.colors.hull)); kP.add(GEO.box, M, T(0, yBoat + 0.2, 2.15, 0, p.boat_length * 0.75, 0.35, 0.08), hex(p.colors.stripe)); kP.add(GEO.box, M, T(0, yBoat + 0.2, -2.15, 0, p.boat_length * 0.75, 0.35, 0.08), hex(p.colors.stripe));
    for (let i = 0; i < 10; i++) { const x = -Lh * 0.75 + i * Lh * 1.5 / 9; kP.add(GEO.box, M, T(x, yBoat + 0.85, 0, 0, 0.5, 0.4, 3.8), 0x6b4a2e); }
    { const mg = new MG(); for (let i = 0; i < 10; i++) for (let k = 0; k < 4; k++) { const x = -Lh * 0.75 + i * Lh * 1.5 / 9; const zz = -1.5 + k; const tmp = new MG(); rider(tmp, 0, 0, 0, 1300 + i * 4 + k, i < 2 || i > 7 ? 0.8 : 0.4); const gg = tmp.geo(); gg.applyMatrix4(T(x, yBoat + 1.0, zz, x < 0 ? Math.PI / 2 : -Math.PI / 2)); mg.add(gg, new THREE.Matrix4(), 0xffffff); } kP.add(mg.geo(), MV, new THREE.Matrix4(), 0xffffff); }
    kP.add(GEO.cyl6, M, T(0, yBoat + 5, 0, 0, 0.3, 9, 0.3), 0x6b4a2e); kP.add(GEO.box, M, T(0, yBoat + 6, 0, 0, 0.15, 5, 4.0), 0xffffff);
    kP.add(GEO.sph, M, T(0, yBoat + 6, 0.1, 0, 0.1, 1.2, 1.2), 0x2b2b2b);
    kP.add(GEO.box, M, T(0, -p.pivot_height / 2 + 1.6, 0, 0, 0.5, p.pivot_height - 4.8, 0.5), WHITE); for (const sd of [-1, 1]) kP.add(GEO.box, M, beamM([0, 0, 0], [sd * Lh * 0.5, yBoat + 1.0, 0], 0.35), 0xbbbbbb);
    kP.build(true);
    ctx.animators.push(t => { const d = ctx.rideState.ship ? ctx.rideState.ship(t) : park.flatRide('pirate_ship', t).swingDeg; piv.rotation.z = d * Math.PI / 180; });
  }
  // ---------------- Observation tower
  {
    const [r, g, p] = ride('observation_tower'); const kS = localKit(g); const bands = hex(p.colors.bands);
    kS.add(new THREE.CylinderGeometry(1, 1.25, 1, 24), M, T(0, p.height / 2, 0, 0, p.mast_radius, p.height, p.mast_radius), 0xffffff);
    for (let k = 0; k < 7; k++) kS.add(GEO.cyl16, M, T(0, 8 + k * 9, 0, 0, p.mast_radius * 2.15, 0.5, p.mast_radius * 2.15), bands);
    kS.add(GEO.cyl16, M, T(0, 1.2, 0, 0, 13, 2.4, 13), 0xe8dcc8); kS.add(GEO.cyl16, M, T(0, 2.5, 0, 0, 11, 0.3, 11), 0xffffff);
    kS.add(GEO.cyl16, M, T(0, p.height + 0.5, 0, 0, 6, 1.0, 6), 0xffffff); kS.add(GEO.cyl16, M, T(0, p.height + 1.4, 0, 0, 5.2, 0.8, 5.2), GOLD);
    kS.add(new THREE.ConeGeometry(0.5, 1, 16), M, T(0, p.height + 6, 0, 0, 3.4, 9, 3.4), GOLD); kS.add(GEO.sph, M, T(0, p.height + 10.8, 0, 0, 0.9, 0.9, 0.9), GOLD);
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; kS.add(GEO.cyl6, M, T(Math.cos(a) * 2.6, p.height + 3.2, Math.sin(a) * 2.6, 0, 0.08, 3, 0.08), 0xffffff); ctx.flags.push({ L: frame(r.position[0] + Math.cos(a) * 2.6, 0, r.position[2] + Math.sin(a) * 2.6, -a), x: 0, y: p.height + 4.2, z: 0, c: [0xc8463a, 0x2f6e8e, 0xd9a441, 0xf3e6cc][k % 4] }); }
    kS.build(true);
    const cab = new THREE.Group(); g.add(cab); const kC = localKit(cab);
    kC.add(GEO.cyl16, M, T(0, 0, 0, 0, p.cabin_radius * 2, 0.5, p.cabin_radius * 2), hex(p.colors.cabin)); kC.add(GEO.cyl16, M, T(0, p.cabin_height, 0, 0, p.cabin_radius * 2.05, 0.6, p.cabin_radius * 2.05), hex(p.colors.cabin));
    kC.add(new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 1, true), mat({ color: 0xffffff, frag: `{ diffuseColor.rgb = mix(vec3(.52,.74,.84), vec3(.85,.94,.98), smoothstep(.3,1.,fract(atan(p.z,p.x)*3.))); }`, side: THREE.DoubleSide }), T(0, p.cabin_height / 2, 0, 0, p.cabin_radius * 1.96, p.cabin_height - 0.4, p.cabin_radius * 1.96), 0xffffff);
    for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; kC.add(GEO.box, M, T(Math.cos(a) * p.cabin_radius * 0.99, p.cabin_height / 2, Math.sin(a) * p.cabin_radius * 0.99, -a, 0.12, p.cabin_height, 0.12), hex(p.colors.cabin)); }
    { const mg = new MG(); for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; const tmp = new MG(); rider(tmp, 0, 0, 0, 1500 + k, 0); const gg = tmp.geo(); gg.applyMatrix4(T(Math.cos(a) * (p.cabin_radius - 1.0), 0.3, Math.sin(a) * (p.cabin_radius - 1.0), -a - Math.PI / 2)); mg.add(gg, new THREE.Matrix4(), 0xffffff); } kC.add(mg.geo(), MV, new THREE.Matrix4(), 0xffffff); }
    kC.build(true);
    ctx.animators.push(t => { const s = park.flatRide('observation_tower', t); cab.position.y = s.y; cab.rotation.y = s.angle; });
  }
  // ---------------- Drop tower
  {
    const [r, g, p] = ride('drop_tower'); const kS = localKit(g);
    kS.add(GEO.cyl16, M, T(0, p.height / 2, 0, 0, p.mast_radius * 2, p.height, p.mast_radius * 2), hex(p.colors.mast));
    for (let k = 0; k < 14; k++) kS.add(GEO.box, M, T(p.mast_radius, 3 + k * 4.8, 0, 0, 0.2, 2.2, 0.5), 0xf5b700);
    kS.add(GEO.cyl16, M, T(0, p.height + 1, 0, 0, 6, 2, 6), hex(p.colors.top_crown)); kS.add(GEO.cone, M, T(0, p.height + 3.5, 0, 0, 5, 3, 5), hex(p.colors.top_crown));
    kS.add(GEO.cyl16, M, T(0, 0.4, 0, 0, 14, 0.8, 14), 0xd8d2c4); kS.build(true);
    const ring = new THREE.Group(); g.add(ring); const kR = localKit(ring);
    kR.add(new THREE.TorusGeometry(p.ring_radius, 0.5, 8, 32), M, T(0, 0, 0, 0, 1, 1, 1, Math.PI / 2), hex(p.colors.ring));
    { const mg = new MG(); for (let k = 0; k < p.seats; k++) { const a = k / p.seats * 6.283; const tmp = new MG(); tmp.add(GEO.box, T(0, 0.3, -0.25, 0, 0.6, 1.4, 0.2), hex(p.colors.seats)); rider(tmp, 0, -0.4, 0.05, 1600 + k, 0.5); const gg = tmp.geo(); gg.applyMatrix4(T(Math.cos(a) * (p.ring_radius + 0.6), -0.6, Math.sin(a) * (p.ring_radius + 0.6), Math.PI / 2 - a)); mg.add(gg, new THREE.Matrix4(), 0xffffff); } kR.add(mg.geo(), MV, new THREE.Matrix4(), 0xffffff); }
    kR.build(true);
    ctx.animators.push(t => { ring.position.y = park.flatRide('drop_tower', t).y; });
  }
  // ---------------- Carousel
  {
    const [r, g, p] = ride('carousel'); const kS = localKit(g);
    kS.add(GEO.cyl16, M, T(0, 0.3, 0, 0, p.radius * 2 + 1, 0.6, p.radius * 2 + 1), 0xb08a5a); kS.build(true);
    const top = new THREE.Group(); g.add(top); const kT = localKit(top);
    kT.add(GEO.cyl16, M, T(0, 0.75, 0, 0, p.radius * 2, 0.3, p.radius * 2), 0xe8d5b0);
    kT.add(stripe(new THREE.ConeGeometry(0.5, 1, 48), p.colors.canopy.map(hex), 48), MV, T(0, p.height - 0.5, 0, 0, p.radius * 2.25, 3.2, p.radius * 2.25), 0xffffff);
    kT.add(GEO.cyl16, M, T(0, p.height - 2.4, 0, 0, p.radius * 2.2, 1.2, p.radius * 2.2), hex(p.colors.trim));
    const nS = 40; for (let i = 0; i < nS; i++) { const a = i / nS * 6.283; kT.add(GEO.cyl6, M, T(Math.cos(a) * p.radius * 1.1, p.height - 3.1, Math.sin(a) * p.radius * 1.1, -a, 1.4, 0.06, 0.7, 0, Math.PI / 2), i % 2 ? 0xd7263d : 0xfff4e0); }
    kT.add(GEO.cyl16, M, T(0, p.height / 2, 0, 0, 3.4, p.height - 2, 3.4), 0xf4b942); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; kT.add(GEO.box, MGlass(), T(Math.cos(a) * 1.72, p.height / 2, Math.sin(a) * 1.72, -a + Math.PI / 2, 1.2, 2.4, 0.06), 0xcfe6ee); }
    const horse = (() => { const mg = new MG(); mg.add(GEO.sph, T(0, 0, 0, 0, 0.5, 0.55, 1.3), 0xffffff); mg.add(GEO.sph, T(0, 0.5, 0.65, 0, 0.3, 0.6, 0.35, -0.5), 0xffffff); mg.add(GEO.box, T(0, 0.75, 0.9, 0, 0.22, 0.25, 0.5), 0xffffff); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mg.add(GEO.box, T(sx * 0.15, -0.5, sz * 0.4, 0, 0.1, 0.7, 0.1, sz * 0.4), 0xffffff); mg.add(GEO.box, T(0, 0.35, 0, 0, 0.55, 0.12, 0.5), 0xd7263d); mg.add(GEO.cyl6, T(0, 0.8, 0, 0, 0.06, 4.6, 0.06), GOLD); return mg.geo(); })();
    const nH = p.figures; const hm = new THREE.InstancedMesh(horse, MV, nH); hm.castShadow = true; hm.frustumCulled = false; top.add(hm); const hcols = p.colors.horses.map(hex);
    const hpos = []; for (let row = 0; row < p.rows; row++) for (let k = 0; k < nH / p.rows; k++) { const a = (k + row * 0.5) / (nH / p.rows) * Math.PI * 2; const rr = p.radius - 1.2 - row * 1.7; hpos.push([Math.cos(a) * rr, Math.sin(a) * rr, -a]); }
    hpos.forEach((h, i) => hm.setColorAt(i, new THREE.Color(hcols[i % 4])));
    kT.build(true);
    ctx.animators.push(t => { const s = park.flatRide('carousel', t); top.rotation.y = s.angle; hpos.forEach((h, i) => hm.setMatrixAt(i, T(h[0], 2.2 + s.bob(i), h[1], h[2]))); hm.instanceMatrix.needsUpdate = true; });
  }
  function MGlass() { return mat({ color: 0xffffff, frag: `{ diffuseColor.rgb *= .8 + .5*fract(p.y*.5+p.x*.2); }` }); }
  // ---------------- Lake boats (swan pedal boats with riders)
  {
    const lb = R('lake_boats'); const boats = lb.params.boats;
    const swan = (c) => { const mg = new MG(); mg.add(GEO.sph, T(0, 0.3, 0, 0, 1.7, 0.9, 2.8), c); mg.add(GEO.box, T(0, 0.7, -0.2, 0, 1.3, 0.25, 1.4), 0xf3e6cc);
      mg.add(GEO.cyl6, T(0, 1.4, 1.2, 0, 0.3, 1.6, 0.3, 0.25), c); mg.add(GEO.sph, T(0, 2.15, 1.45, 0, 0.42, 0.42, 0.55), c); mg.add(GEO.cone, T(0, 2.1, 1.8, 0, 0.16, 0.4, 0.16, Math.PI / 2), 0xf39c12);
      for (const sd of [-1, 1]) mg.add(GEO.sph, T(sd * 0.75, 0.75, -0.6, 0, 0.35, 0.5, 1.4, 0.4), c); mg.add(GEO.box, T(0, 1.6, -0.3, 0, 1.5, 0.08, 1.5), 0xf3e6cc);
      rider(mg, 0.35, 0.45, -0.3, Math.floor(c % 97) + 1700, 0); rider(mg, -0.35, 0.45, -0.3, Math.floor(c % 89) + 1750, 0); return mg.geo(); };
    const geos = {}; boats.forEach(b => { const c = hex(b.color); if (!geos[c]) geos[c] = swan(c); });
    const ims = {}; for (const [c, gg] of Object.entries(geos)) { const n = boats.filter(b => hex(b.color) === +c).length; const im = new THREE.InstancedMesh(gg, MV, n); im.castShadow = true; im.frustumCulled = false; grp.add(im); ims[c] = im; }
    const bt = t => ctx.rideState.boats ? ctx.rideState.boats(t) : t;
    ctx.animators.push(t => { const tt = bt(t); const cnt = {}; boats.forEach((b, k) => { const c = hex(b.color); const i = cnt[c] = (cnt[c] ?? -1) + 1; const a = b.phase + Math.PI * 2 * tt / b.period_s; const x = b.route_center[0] + Math.cos(a) * b.route_radii[0], z = b.route_center[1] + Math.sin(a) * b.route_radii[1];
      const yaw = Math.atan2(-Math.sin(a) * b.route_radii[0], Math.cos(a) * b.route_radii[1]); ims[c].setMatrixAt(i, T(x, -0.62 + Math.sin(t * 2 + k) * 0.04, z, yaw, 1, 1, 1, Math.sin(t * 1.7 + k) * 0.03)); });
      Object.values(ims).forEach(im => im.instanceMatrix.needsUpdate = true); });
  }
  K.build(true);
}
