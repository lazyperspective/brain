// Per-shot configuration: LOD focus, build mode (05), abandoned->alive (07), shadow framing.
import * as THREE from 'three';
import { T, GEO, Kit, hash, rng, popScale, DynKit, stripe, MG } from './util.js';

const near = (cx, cz, r) => (x, z) => (x - cx) ** 2 + (z - cz) ** 2 < r * r;
const sstep = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const ramp = (d, r) => d <= 0 ? 0 : d < r ? d * d / (2 * r) : d - r / 2;

export function shotConfig(shot, park, style) {
  const id = shot.id.slice(0, 2); const D = park.data;
  const cfg = { opts: { ctx: {} } }; const C = cfg.opts.ctx;
  if (id === '02') {
    C.lod = (x, z) => (Math.abs(x) < 90 && z > -20) || ((x) ** 2 + z ** 2 < 140 ** 2);
  }
  if (id === '09') {
    C.lod = (x, z) => (x + 20) ** 2 + (z + 105) ** 2 < 130 ** 2;
    cfg.shadowCenter = (t, cam) => { const f = new THREE.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize(); return [cam.position.x + f.x * 110, 0, cam.position.z + f.z * 110]; };
    cfg.shadowRadius = () => 260;
  }
  if (id === '12') {
    C.lod = near(80, -147, 90);
    C.after = (ctx) => { const im = new THREE.InstancedMesh(GEO.box, ctx.mat({ unlit: true, color: 0xffffff }), 60); im.frustumCulled = false; ctx.root.add(im); ctx.sparkles = im; };
    cfg.update = (t, world) => { const ctx = world.ctx; const im = ctx.sparkles; const tr = park.track('hero_coaster'); const f0 = ctx.heroFront[0]; const col = new THREE.Color();
      for (let k = 0; k < 60; k++) { const s = f0 - 18.5 - k * 0.8; const f = tr.sample(s); const ph = Math.floor(t * 30) + k * 7; const on = (ph % 5) < 3; const age = k / 60;
        const j = [(hash(k, ph >> 2) - 0.5) * 2.2, (hash(ph >> 2, k) - 0.5) * 2.2, (hash(k + 99, ph >> 2) - 0.5) * 2.2]; const sz = on && k % 2 === 0 ? (1 - age) * 0.55 + 0.2 : 0;
        im.setMatrixAt(k, T(f.pos[0] + j[0], f.pos[1] + j[1] + 0.8, f.pos[2] + j[2], 0, sz, sz, sz)); im.setColorAt(k, col.set([0xffffff, 0xffd541, 0x9fd8ff, 0xff6fa8][k % 4])); }
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; };
  }
  if (id === '07') {
    C.lod = near(-195, 20, 150);
    const LH = [-218, 52], CAMW = [-175, 88];
    const arrival = (x, z) => { const dl = Math.hypot(x - LH[0], z - LH[1]); const dc = Math.hypot(x - CAMW[0], z - CAMW[1]); const nr = Math.pow(Math.max(0, 1 - dc / 55), 1.5); return 24.5 + 0.55 * dl / 50 + 1.9 * nr; };
    C.wakeArrival = arrival;
    // guests appear (pop in) shortly after the colour reaches them
    C.guestFilter = (x, z, t, kind, k) => { const ta = arrival(x, z) + 0.15 + hash(k | 0, 41) * 0.35; const s = popScale(t - ta); return s ? s[1] : 0; };
    C.rideState = {
      ferris: t => { const a0 = park.flatRide('ferris_wheel', 26.5).angle; const w = Math.PI * 2 / D.animation.ferris_wheel.period_s; return a0 + w * 3 * ramp(t - 26.5, 1.2); },
      swing: t => { const s = park.flatRide('swing_ride', t); const w = Math.PI * 2 / D.animation.swing_ride.period_s; return { angle: w * ramp(t - 25.0, 1.4), chairAngleDeg: s.chairAngleDeg * sstep(25.0, 26.6, t) }; },
      ship: t => { const A = D.animation.pirate_ship.amplitude_deg; const P = D.animation.pirate_ship.period_s; return t < 26.5 ? 0 : A * Math.min(1, (t - 26.5) / 3) * Math.sin(Math.PI * 2 * (t - 26.5) / P); },
      boats: t => 25.5 + ramp(t - 25.5, 1.0),
    };
    cfg.update = (t, world, post) => {
      const ctx = world.ctx; ctx.ferrisBulbs && ctx.ferrisBulbs(t >= 26.0);
      post.p2.m.uniforms.uWakeOn.value = 1;
      const lamp = t < 24.5 ? 0 : Math.min(1, (t - 24.5) / 0.15) * (1 + 0.25 * Math.exp(-(t - 24.5) * 3)); post.p2.m.uniforms.uLamp.value = lamp;
      world.ctx.skyGrey && (world.ctx.skyGrey.value = 1 - sstep(25.2, 26.6, t));
      if (ctx.overgrowth) ctx.overgrowth(t);
    };
    cfg.preRender = (t, cam, post, world) => { const p = new THREE.Vector3(-218, 14.0, 52).project(cam); post.p2.m.uniforms.uLampUV.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5); if (p.z > 1) post.p2.m.uniforms.uLamp.value = 0; };
    C.after = (ctx) => overgrowth(ctx, arrival);
    cfg.shadowCenter = () => [-196, 0, 30]; cfg.shadowRadius = () => 150;
  }
  if (id === '05') {
    C.lod = near(128, 62, 70);
    const tr = park.track('wooden_coaster'); const Lw = tr.length;
    const head = t => Math.max(0, Math.min(1, (t - 16) / 2.5)) * Lw;
    const midway = D.lands.find(l => l.id === 'midway').region; const inMid = (x, z) => midway.some(p => ParkPlan.pointInPoly(x, z, p.outer) && !(p.holes || []).some(h => ParkPlan.pointInPoly(x, z, h)));
    const inBox = (x, z) => x > 83 && x < 157 && z > 37 && z < 87;
    C.midwayHidden = (x, z) => inMid(x, z) || inBox(x, z);
    C.skipBuilding = b => ['food_court_pavilion', 'midway_booths', 'restroom_midway'].includes(b.id) || (b.land === 'midway' && b.kind !== 'guest_services');
    C.popOf = b => ({ frontier_saloon: 16.5, frontier_general_store: 16.75, frontier_assay_office: 17.0, frontier_livery: 17.0, water_tower: 17.25, restroom_frontier: 17.0 })[b.id] ?? null;
    C.propFilter = (x, z) => !C.midwayHidden(x, z);
    C.treeFilter = (x, z) => !C.midwayHidden(x, z);
    // frontier trees pop in on 16th notes from 17.5, sweeping north -> south along the ridge
    C.treePop = (x, z, i, sid) => (x > 175 && (sid === 'pine' || sid === 'fir')) ? 17.5 + Math.floor(Math.max(0, Math.min(1, (z + 200) / 360)) * 12 + hash(i, 5) * 2) * 0.125 : null;
    // guests: fast-forward from 18.0 easing to walking speed by 19.0; frontier guests stream in; midway lot empty
    C.walkerTime = t => t < 18 ? t : t < 19 ? t + 5 * ((t - 18) - (t - 18) ** 2 / 2) : t + 2.5;
    C.guestFilter = (x, z, t, kind, k) => { if (C.midwayHidden(x, z)) return 0; if (x > 168) { const ta = 18.0 + (x - 168) / 120 * 0.8 + hash(k | 0, 8) * 0.35; const s = popScale(t - ta); return s ? s[1] : 0; } return 1; };
    C.woodTrainFilter = (t, ti, s) => { const h = head(t); if (t < 16.2) return { vis: false, s }; if (h >= Lw - 0.5) return { vis: true, s }; if (ti > 0) return { vis: false, s }; return { vis: s < h - 8 && s < Lw * 0.98, s }; };
    C.hideRides = ['carousel', 'teacups', 'bumper_cars'];
    C.after = (ctx) => buildMode(ctx, park, head, inMid);
    cfg.update = (t, world) => { const ctx = world.ctx; ctx.woodBuild && ctx.woodBuild(head(t)); world.MS.U.uBuild.value = head(t); ctx.buildCursor && ctx.buildCursor(t, head(t)); };
  }
  return cfg;
}

// ---------------------------------------------------------------- 07: overgrowth that retracts as the colour arrives
function overgrowth(ctx, arrival) {
  const { D, mat, root } = ctx; const g = new THREE.Group(); root.add(g);
  const spots = []; const r = rng(77);
  const ring = (cx, cz, rad, n, y = 0) => { for (let i = 0; i < n; i++) { const a = i / n * 6.283 + r() * 0.3; spots.push([cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad]); } };
  ring(-189, 10, 7.2, 26, 1.2); ring(-195, -28, 6, 10); for (const sx of [-1, 1]) for (const sz of [-1, 1]) ring(-195 + sx * 13, -40 + sz * 5, 1.5, 4);
  ring(-132, -34, 8, 14); ring(-190, 116, 9, 12); ring(-218, 52, 3, 8, 0.6);
  for (const f of D.props.fences) { if (f.ride) continue; for (let i = 0; i < f.points.length - 1; i += 1) { const a = f.points[i], b = f.points[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let k = 0; k < L / 3; k++) { const u = r(); spots.push([a[0] + (b[0] - a[0]) * u, 0, a[1] + (b[1] - a[1]) * u]); } } }
  // ivy climbing the wheel legs, the swing mast and the ship frame
  const climb = (a, b, n) => { for (let i = 0; i < n; i++) { const u = (i + r()) / n * 0.7; spots.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); } };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) climb([-195 + sx * 13, 0, -40 + sz * 5], [-195, 25, -40 + sz * 2.6], 9);
  climb([-189, 1.2, 10.8], [-189, 13, 10.8], 7); for (const sx of [-1, 1]) for (const sz of [-1, 1]) climb([-132 + sx * 8, 0, -34 + sz * 4.5], [-132, 15, -34 + sz * 2.4], 6);
  const items = [];
  for (const [x, y, z] of spots) { if (Math.hypot(x + 190, z - 30) > 140) continue; const n = 2 + Math.floor(r() * 3); for (let k = 0; k < n; k++) { const s = 0.5 + r() * 1.1; items.push({ m: T(x + (r() - 0.5) * 1.2, y + s * 0.4, z + (r() - 0.5) * 1.2, r() * 6, s * 1.3, s * (0.8 + r()), s * 1.3), c: [0x5d6b3a, 0x6f7a42, 0x4e5e34, 0x8a8a55][Math.floor(r() * 4)], ta: arrival(x, z) + r() * 0.2 }); }
    if (r() < 0.5) items.push({ m: T(x, y + 1.2, z, r() * 6, 0.08, 2.4, 0.08, (r() - 0.5) * 0.5), c: 0x7a6a45, ta: arrival(x, z) }); }
  const im = new THREE.InstancedMesh(GEO.sph, mat({}), items.length); const col = new THREE.Color(); items.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, col.set(it.c)); }); im.castShadow = true; im.frustumCulled = false; g.add(im);
  const Z = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4(), S = new THREE.Matrix4();
  ctx.overgrowth = t => { items.forEach((it, i) => { const d = t - it.ta; if (d <= 0) im.setMatrixAt(i, it.m); else if (d > 0.4) im.setMatrixAt(i, Z); else { const k = 1 - d / 0.4; S.makeScale(k, k * k, k); M.copy(it.m).multiply(S); im.setMatrixAt(i, M); } }); im.instanceMatrix.needsUpdate = true; };
}

// ---------------------------------------------------------------- 05: build mode (dirt lots, crate, cursor, dust)
function buildMode(ctx, park, head, inMid) {
  const { D, mat, root } = ctx; const g = new THREE.Group(); root.add(g); const K = new Kit(g);
  const dirt = mat({ color: 0xa8784a, frag: `{ diffuseColor.rgb *= 0.9 + 0.12*step(.55, h21(floor(p.xz*0.9))) - 0.08*step(.85, h21(floor(p.xz*1.7)+4.)); }`, mot: 0 });
  // midway lot covered in dirt
  const mid = D.lands.find(l => l.id === 'midway').region;
  for (const p of mid) { const sh = new THREE.Shape(p.outer.map(q => new THREE.Vector2(q[0], -q[1]))); const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2); geo.translate(0, 0.16, 0); const m = new THREE.Mesh(geo, dirt); m.receiveShadow = true; g.add(m); }
  // clear the grey-box hedges/flower beds of the unbuilt midway rides
  ctx.gb.groups.planting.traverse(o => { if (!o.isInstancedMesh) return; const m = new THREE.Matrix4(), Z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); if (ctx.midwayHidden(m.elements[12], m.elements[14])) o.setMatrixAt(i, Z); } o.instanceMatrix.needsUpdate = true; });
  ctx.gb.groups.planting.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.userData.category === 'flowerbed') { o.geometry.computeBoundingSphere(); const c = o.geometry.boundingSphere.center; if (ctx.midwayHidden(c.x, c.z)) o.visible = false; } });
  // lot pegs/stakes with marker flags around the lot edge
  for (const p of mid) for (let i = 0; i < p.outer.length; i += 2) { const [x, z] = p.outer[i]; K.add(GEO.box, mat({}), T(x, 0.6, z, 0, 0.15, 1.2, 0.15), 0xf3e6cc); K.add(GEO.box, mat({}), T(x + 0.25, 1.05, z, 0, 0.5, 0.3, 0.04), 0xff8a2a); }
  // dirt pads under frontier buildings
  for (const b of D.buildings) if (b.land === 'frontier' || b.id === 'water_tower') { const [x, , z] = b.position; K.add(GEO.box, dirt, T(x, 0.08, z, b.rot || 0, b.w + 3, 0.16, b.d + 6), 0xa8784a); }
  // the toy-box crate (70 x 46 x 30 at (120, 0, 62)), lid hinged on the north edge; it drops in at 16.5 with a dust puff
  const DC = new DynKit(g); const KC = { add: (geo, m, mm, c) => DC.add(geo, m, mm, c, 16.5, [120, 0, 62]) };
  { const cx = 120, cz = 62, w = 70, d = 46, h = 30; const plank = mat({ frag: `{ float f = fract(p.y/1.6); float g = fract((p.x+p.z)/9.); diffuseColor.rgb *= 0.86 + 0.14*smoothstep(0.,.08,f)*smoothstep(1.,.92,f) + 0.06*(h21(vec2(floor(p.y/1.6), floor((p.x+p.z)/9.)))-.5); }`, mot: 0 });
    const wood = 0xc8955a, batten = 0x8e5b3a, red = 0xd7263d, gold = 0xffd541;
    KC.add(GEO.box, plank, T(cx, h / 2, cz, 0, w, h, d), wood);
    for (const sx of [-1, -0.33, 0.33, 1]) for (const sz of [-1, 1]) KC.add(GEO.box, mat({}), T(cx + sx * w / 2, h / 2, cz + sz * (d / 2 + 0.3), 0, 2.4, h, 0.6), batten);
    for (const sz of [-1, -0.33, 0.33, 1]) for (const sx of [-1, 1]) KC.add(GEO.box, mat({}), T(cx + sx * (w / 2 + 0.3), h / 2, cz + sz * d / 2, 0, 0.6, h, 2.4), batten);
    for (const yy of [1.2, h - 2.2]) { KC.add(GEO.box, mat({}), T(cx, yy, cz, 0, w + 1.2, 2.4, d + 1.2), batten); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [1.5, h - 1.5]) KC.add(GEO.box, mat({}), T(cx + sx * (w / 2 + 0.4), yy, cz + sz * (d / 2 + 0.4), 0, 3, 3, 3), 0x9aa3ad);
    KC.add(GEO.box, plank, T(cx, h + 1.0, cz, 0, w + 1.6, 2.0, d + 1.6), 0xb07a45); KC.add(GEO.box, mat({}), T(cx, h + 1.0, cz, 0, w + 1.8, 0.9, d + 1.8), red);
    for (let i = -3; i <= 3; i++) KC.add(GEO.cyl, mat({}), T(cx + i * 9, h + 0.6, cz - d / 2 - 1.0, 0, 1.2, 4, 1.2, 0, Math.PI / 2), 0x9aa3ad);
    const star = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5; const rr = k % 2 ? 4.2 : 10; const p = [Math.cos(a) * rr, Math.sin(a) * rr]; k ? star.lineTo(...p) : star.moveTo(...p); } star.closePath();
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.6, bevelEnabled: false }); sg.rotateX(-Math.PI / 2); KC.add(sg, mat({}), T(cx, h + 2.0, cz, 0), gold);
    KC.add(GEO.box, mat({}), T(cx, h * 0.55, cz + d / 2 + 0.7, 0, 3.2, 4.5, 0.6), 0x9aa3ad);
    const sg2 = new THREE.ExtrudeGeometry(star, { depth: 0.5, bevelEnabled: false });
    for (const xx of [-w / 3, w / 3]) KC.add(sg2, mat({}), T(cx + xx, h * 0.5, cz + d / 2 + 0.6, 0, 0.8, 0.8, 1), [0xd7263d, 0x2e86c1][xx > 0 ? 1 : 0]);
    KC.add(sg2, mat({}), T(cx + w / 2 + 0.6, h * 0.5, cz, Math.PI / 2, 0.8, 0.8, 1), 0xffd541);
    for (const s2 of [-1, 1]) KC.add(new THREE.TorusGeometry(2.2, 0.35, 6, 12, Math.PI), mat({}), T(cx + w / 2 + 0.8, h * 0.62, cz + s2 * d * 0.3, Math.PI / 2, 1, 1, 1, 0, Math.PI), 0xc9a46a); KC.add(GEO.cyl, mat({}), T(cx, h * 0.55 - 1, cz + d / 2 + 1.1, 0, 1.4, 0.6, 1.4, Math.PI / 2), 0x5a6988);
  }
  DC.build(); ctx.animators.push(t => DC.update(t));
  K.build(true);
  // build cursor: flashing ground diamond + guide post + sparkles at the build head
  const tr = park.track('wooden_coaster');
  const cur = new THREE.Group(); root.add(cur); const cm = mat({ unlit: true });
  const dia = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.4, 4, 1), cm); dia.rotation.x = -Math.PI / 2; dia.material = mat({ unlit: true, side: THREE.DoubleSide, color: 0xffd541 }); cur.add(dia);
  const post = new THREE.Mesh(GEO.box, mat({ unlit: true, color: 0xfff1d6 })); cur.add(post);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 4), mat({ unlit: true, color: 0xffffff })); arrow.rotation.x = Math.PI; cur.add(arrow);
  const sp = new THREE.InstancedMesh(GEO.box, mat({ unlit: true, color: 0xffffff }), 16); sp.frustumCulled = false; cur.add(sp);
  // dust puffs where buildings pop
  const puffs = [[120, 62, 16.5, 60]]; for (const b of D.buildings) { const t0 = ctx.popOf && ctx.popOf(b); if (t0 != null) puffs.push([b.position[0], b.position[2], t0, Math.max(b.w, b.d)]); }
  const dust = new THREE.InstancedMesh(GEO.sph, mat({ color: 0xe8c690 }), puffs.length * 10); dust.frustumCulled = false; g.add(dust);
  ctx.buildCursor = (t, h) => {
    const building = t > 16 && h < tr.length - 0.5; cur.visible = building;
    if (building) { const f = tr.sample(h); const blink = Math.floor(t * 8) % 2;
      dia.position.set(f.pos[0], 0.3, f.pos[2]); dia.material.color.set(blink ? 0xffd541 : 0xff8a2a);
      post.position.set(f.pos[0], f.pos[1] / 2, f.pos[2]); post.scale.set(0.25, Math.max(0.1, f.pos[1]), 0.25);
      arrow.position.set(f.pos[0], f.pos[1] + 5 + Math.sin(t * 12) * 0.6, f.pos[2]);
      for (let k = 0; k < 16; k++) { const a = k * 2.4 + t * 9, rr = 1.5 + ((k * 7 + Math.floor(t * 20)) % 5) * 0.6; sp.setMatrixAt(k, T(f.pos[0] + Math.cos(a) * rr, f.pos[1] + 1 + Math.sin(a * 1.3) * rr * 0.6, f.pos[2] + Math.sin(a) * rr, 0, 0.6, 0.6, 0.6)); }
      sp.instanceMatrix.needsUpdate = true; }
    let i = 0; for (const [x, z, t0, s] of puffs) for (let k = 0; k < 10; k++) { const d = t - t0; if (d < 0 || d > 0.6) { dust.setMatrixAt(i++, T(0, -99, 0, 0, 0, 0, 0)); continue; } const a = k / 10 * 6.283; const rr = s * 0.4 + d * 14; const sc = (1 - d / 0.6) * (2.0 + (k % 3)); dust.setMatrixAt(i++, T(x + Math.cos(a) * rr, 1 + d * 4, z + Math.sin(a) * rr, 0, sc, sc, sc)); }
    dust.instanceMatrix.needsUpdate = true;
  };
}
