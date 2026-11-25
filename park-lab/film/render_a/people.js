// Guests as little people (instanced, 3 body variants, animated legs/arms in the vertex shader),
// strollers, balloons, waving flags, bulbs.
import * as THREE from 'three';
import { hex, T, GEO, Kit, MG, hash, lathe } from './util.js';

export function buildPeople(ctx) {
  const { D, park, mat, root } = ctx;
  const grp = new THREE.Group(); grp.name = 'people'; root.add(grp);
  const pal = D.guests.clothes_palette.map(hex);
  // -------- body variants (slot: 0 fixed, 1 shirt, 2 skin, 3 pants, 4 hair, 5 shoes; limb: 1 L leg, 2 R leg, 3 L arm, 4 R arm)
  const HL = new THREE.SphereGeometry(0.5, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  function body(v) { // v: 0 trousers+cap hair, 1 dress+long hair, 2 shorts+sun hat, 3 jeans+backpack+cap
    const mg = new MG(); const C8 = (rt, rb) => new THREE.CylinderGeometry(rt, rb, 1, 7, 1, true);
    const limbBetween = (geo, a, b, slot, limb) => { const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const d = vb.clone().sub(va); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); mg.add(geo, new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, d.length(), 1)), 0, slot, limb); };
    for (const s of [-1, 1]) {
      const limb = s < 0 ? 1 : 2; const lx = s * 0.085;
      mg.add(GEO.ico, T(lx, 0.045, 0.04, 0, 0.12, 0.08, 0.24), 0, 5, limb);
      if (v === 1) limbBetween(C8(0.045, 0.04), [lx, 0.85, 0], [lx, 0.08, 0], 2, limb);
      else if (v === 2) { limbBetween(C8(0.075, 0.07), [lx, 0.9, 0], [lx, 0.55, 0], 3, limb); limbBetween(C8(0.05, 0.042), [lx, 0.56, 0], [lx, 0.08, 0], 2, limb); }
      else limbBetween(C8(0.072, 0.058), [lx, 0.9, 0], [lx, 0.08, 0], 3, limb);
      const arm = s < 0 ? 3 : 4; const sx = s * 0.215;
      mg.add(GEO.ico, T(sx, 1.4, 0, 0, 0.13, 0.12, 0.13), 0, 1, arm);
      limbBetween(C8(0.055, 0.05), [sx, 1.42, 0], [s * 0.235, 1.18, 0.01], 1, arm);
      limbBetween(C8(0.045, 0.04), [s * 0.235, 1.19, 0.01], [s * 0.245, 0.92, 0.04], 2, arm);
      mg.add(GEO.ico, T(s * 0.245, 0.89, 0.04, 0, 0.09, 0.1, 0.08), 0, 2, arm);
    }
    if (v === 1) mg.add(C8(0.17, 0.3), T(0, 0.78, 0, 0, 1, 0.5, 0.85), 0, 1, 0);
    else mg.add(C8(0.17, 0.165), T(0, 0.93, 0, 0, 1, 0.16, 0.7), 0, 3, 0);
    mg.add(C8(0.2, 0.165), T(0, 1.2, 0, 0, 1, 0.46, 0.66), 0, 1, 0);
    mg.add(C8(0.05, 0.055), T(0, 1.47, 0, 0, 1, 0.08, 1), 0, 2, 0);
    mg.add(GEO.sph, T(0, 1.585, 0.005, 0, 0.22, 0.25, 0.23), 0, 2, 0);
    if (v === 1) { mg.add(GEO.sph, T(0, 1.61, -0.035, 0, 0.25, 0.27, 0.26), 0, 4, 0); mg.add(GEO.sph, T(0, 1.44, -0.1, 0, 0.2, 0.3, 0.09), 0, 4, 0); }
    else if (v === 2) { mg.add(C8(0.1, 0.12), T(0, 1.72, 0, 0, 1, 0.1, 1), 0, 4, 0); mg.add(new THREE.CylinderGeometry(0.21, 0.21, 1, 12), T(0, 1.68, 0.0, 0, 1, 0.015, 1), 0, 4, 0); }
    else { mg.add(HL, T(0, 1.62, -0.01, 0, 0.245, 0.17, 0.25), 0, 4, 0); if (v === 3) { mg.add(GEO.box, T(0, 1.66, 0.12, 0, 0.16, 0.025, 0.12), 0, 1, 0); mg.add(GEO.box, T(0, 1.22, -0.17, 0, 0.28, 0.34, 0.12), 0x2f6e8e, 0, 0); } }
    return mg.geo();
  }
  const geos = [body(0), body(1), body(2), body(3)]; const NV = 4;
  const pm = mat({ vc: true, key: 'people', mot: 0 });
  const ob = pm.onBeforeCompile;
  pm.onBeforeCompile = sh => {
    ob(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aSlot; attribute float aLimb; attribute vec4 iLook;
const vec3 SKIN[5] = vec3[5](vec3(.95,.79,.65), vec3(.85,.63,.48), vec3(.66,.44,.30), vec3(.45,.30,.20), vec3(.96,.84,.74));
const vec3 PANTS[6] = vec3[6](vec3(.20,.26,.42), vec3(.30,.30,.33), vec3(.80,.72,.55), vec3(.12,.13,.17), vec3(.36,.47,.66), vec3(.55,.32,.25));
const vec3 HAIR[6] = vec3[6](vec3(.23,.14,.09), vec3(.10,.08,.07), vec3(.55,.35,.18), vec3(.85,.70,.40), vec3(.40,.22,.12), vec3(.75,.72,.68));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{ float amp = iLook.w > 0. ? 0.55 : 0.; float ph = uTime*7.5 + iLook.w*37.;
  if (aLimb > 0.5) { float side = (aLimb < 1.5 || (aLimb > 3.5)) ? 1. : -1.; float a = sin(ph)*amp*side*(aLimb > 2.5 ? .8 : 1.); if (iLook.w < 0. && aLimb > 2.5) a = 0.;
    float py = aLimb < 2.5 ? 0.88 : 1.42; vec2 yz = vec2(transformed.y - py, transformed.z); float c = cos(a), s = sin(a);
    transformed.y = py + yz.x*c - yz.y*s; transformed.z = yz.x*s + yz.y*c; }
  transformed.y += amp > 0. ? abs(sin(ph))*0.035 : 0.; }`)
      .replace('#include <color_vertex>', `vColor = vec3(1.);
#ifdef USE_INSTANCING_COLOR
 vec3 shirt = instanceColor.rgb;
#else
 vec3 shirt = vec3(1.);
#endif
 int si = int(iLook.x); int pi = int(iLook.y); int hi = int(iLook.z);
 if (aSlot < .5) vColor = color.rgb; else if (aSlot < 1.5) vColor = shirt; else if (aSlot < 2.5) vColor = SKIN[si]; else if (aSlot < 3.5) vColor = PANTS[pi]; else if (aSlot < 4.5) vColor = HAIR[hi]; else vColor = vec3(.18,.16,.15);`);
  };
  // -------- populations
  const W = D.guests.walkers.list, I = D.guests.idlers.list, Qd = D.guests.queued.list;
  const filt = ctx.guestFilter || null; // (x, z, t, kind, k) -> scale (0 hides)
  // low-poly bodies for distant guests (same slots/limbs so colours and walking match)
  function bodyLo(v) {
    const mg = new MG(); const ico = new THREE.IcosahedronGeometry(0.5, 0);
    for (const s of [-1, 1]) { const limb = s < 0 ? 1 : 2; mg.add(GEO.box, T(s * 0.085, 0.47, 0, 0, 0.13, 0.86, 0.15), 0, v === 1 ? 2 : 3, limb);
      mg.add(GEO.box, T(s * 0.23, 1.15, 0, 0, 0.1, 0.55, 0.11), 0, 1, s < 0 ? 3 : 4); }
    if (v === 1) mg.add(new THREE.ConeGeometry(0.3, 0.5, 6), T(0, 0.8, 0, 0, 1, 1, 0.85), 0, 1, 0);
    mg.add(GEO.box, T(0, 1.18, 0, 0, 0.36, 0.5, 0.24), 0, 1, 0);
    mg.add(ico, T(0, 1.58, 0, 0, 0.24, 0.27, 0.25), 0, 2, 0); mg.add(ico, T(0, 1.63, -0.02, 0, 0.26, 0.16, 0.26), 0, 4, 0);
    return mg.geo();
  }
  const geosLo = [bodyLo(0), bodyLo(1), bodyLo(2), bodyLo(3)];
  const LODR2 = (ctx.pixel ? 0 : 38) ** 2;
  function mk(geo, n) { const g = geo.clone(); g.setAttribute('iLook', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)); const im = new THREE.InstancedMesh(g, pm, n); im.setColorAt(0, new THREE.Color()); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.count = 0; grp.add(im); return im; }
  const variantOf = k => (hash(k, 11) * NV) | 0;
  const lookOf = (seed, walk) => [Math.floor(hash(seed, 1) * 5), Math.floor(hash(seed, 2) * 6), Math.floor(hash(seed, 5) * 6), walk ? 0.01 + hash(seed, 7) : -1];
  const statics = [];
  for (let k = 0; k < I.length; k++) { const [x, z, hd, ci, ch, bal] = I[k]; statics.push({ x, y: 0, z, yaw: hd, s: ch ? 0.62 : 1 + (hash(k, 3) - 0.5) * 0.12, c: pal[ci], v: variantOf(k + 9000), seed: k + 9000, kind: 'idler', bal }); }
  for (let k = 0; k < Qd.length; k++) { const [qid, x, z, j, ci, ch] = Qd[k]; statics.push({ x, y: 0, z, yaw: j, s: ch ? 0.62 : 1 + (hash(k, 4) - 0.5) * 0.12, c: pal[ci], v: variantOf(k + 20000), seed: k + 20000, kind: 'queue' }); }
  for (let k = 0; k < (ctx.extraPeople || []).length; k++) { const [x, y, z, yaw, c] = ctx.extraPeople[k]; statics.push({ x, y, z, yaw, s: 1, c, v: 0, seed: k + 30000, kind: 'extra' }); }
  const pop = statics.slice(); for (const p of pop) p.look = lookOf(p.seed, false);
  for (let k = 0; k < W.length; k++) pop.push({ x: 0, y: 0, z: 0, yaw: 0, s: W[k][6] ? 0.62 : 1 + (hash(k, 3) - 0.5) * 0.12, c: pal[W[k][5]], v: variantOf(k), seed: k, kind: 'walker', wk: k, look: lookOf(k, true) });
  const cnt = [0, 0, 0, 0]; pop.forEach(p => { p.col = new THREE.Color(p.c); cnt[p.v]++; });
  const hiM = geos.map((g, v) => mk(g, Math.max(1, cnt[v]))), loM = geosLo.map((g, v) => mk(g, Math.max(1, cnt[v])));
  const col = new THREE.Color();
  // strollers for some adult walkers
  const strollerIdx = []; for (let k = 0; k < W.length; k++) if (!W[k][6] && hash(k, 77) < 0.05) strollerIdx.push(k);
  const stG = (() => { const mg = new MG(); mg.add(GEO.box, T(0, 0.5, 0, 0, 0.45, 0.3, 0.7), 0x2f6e8e); mg.add(GEO.hemi, T(0, 0.62, -0.18, 0, 0.5, 0.45, 0.45, -0.3), 0x2f6e8e); mg.add(GEO.box, beamM_([0, 0.65, 0.35], [0, 1.0, 0.6], 0.04), 0x222222); mg.add(GEO.box, T(0, 1.0, 0.6, 0, 0.45, 0.04, 0.04), 0x222222);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mg.add(GEO.cyl, T(sx * 0.22, 0.13, sz * 0.25, 0, 0.26, 0.05, 0.26, 0, Math.PI / 2), 0x222222); return mg.geo(); })();
  function beamM_(a, b, w) { const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const d = vb.clone().sub(va); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); return new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(w, d.length(), w)); }
  const stM = new THREE.InstancedMesh(stG, mat({ vc: true }), Math.max(1, strollerIdx.length)); stM.castShadow = true; stM.frustumCulled = false; grp.add(stM);
  // balloons (held by idlers + sellers)
  const balloons = (ctx.balloons || []).slice();
  for (const p of statics) if (p.bal) { const hx = p.x + Math.cos(p.yaw) * 0.26 * p.s, hz = p.z - Math.sin(p.yaw) * 0.26 * p.s; balloons.push([hx + 0.1, 1.0 * p.s + 1.6, hz, pal[(p.seed * 7) % pal.length] === 0xffffff ? 0xe74c3c : [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71, 0xf5a6c8, 0xe67e22][p.seed % 6], hx, 0.9 * p.s, hz, p]); }
  const balG = lathe([[0.001, -0.62], [0.08, -0.55], [0.3, -0.35], [0.42, -0.05], [0.38, 0.2], [0.22, 0.38], [0.001, 0.44]], 10);
  const balM = new THREE.InstancedMesh(balG, mat({ mot: 0.05 }), Math.max(1, balloons.length)); const strM = new THREE.InstancedMesh(GEO.box, mat({ color: 0xffffff }), Math.max(1, balloons.length));
  balloons.forEach((b, i) => balM.setColorAt(i, col.set(b[3]))); balM.castShadow = true; balM.frustumCulled = strM.frustumCulled = false; grp.add(balM); grp.add(strM);
  // flags (waving)
  const flagGeo = new THREE.PlaneGeometry(1, 0.66, 8, 2); flagGeo.translate(0.5, 0, 0);
  const fm = mat({ side: THREE.DoubleSide, frag: `{ diffuseColor.rgb = pow(diffuseColor.rgb, vec3(.85))*1.15; }`, vert: `{ float ph = instanceMatrix[3].x*.7 + instanceMatrix[3].z*.3; float u = position.x; transformed.z += sin(u*5. - uTime*7. + ph)*0.12*u; transformed.y += sin(u*4. - uTime*6. + ph)*0.03*u; }`, mot: 0.04 });
  const flags = ctx.flags || []; const flM = new THREE.InstancedMesh(flagGeo, fm, Math.max(1, flags.length));
  flags.forEach((f, i) => { const s = (f.big || 1) * 1.5; flM.setMatrixAt(i, f.L(f.x + 0.06, f.y, f.z, s, s, s, hash(i, 3) * 0.6)); flM.setColorAt(i, col.set(f.c)); }); flM.castShadow = true; flM.frustumCulled = false; grp.add(flM);
  // bulbs (unlit warm dots; 'lit' by ctx.bulbGain)
  const bulbs = ctx.bulbs || []; const bM = new THREE.InstancedMesh(GEO.ico, mat({ unlit: true, mot: 0 }), Math.max(1, bulbs.length));
  bulbs.forEach(([m, c], i) => { bM.setMatrixAt(i, m); bM.setColorAt(i, col.set(c).lerp(new THREE.Color(0xfff4dc), 0.35)); }); bM.frustumCulled = false; grp.add(bM);

  const m4 = new THREE.Matrix4();
  ctx.people = { statics };
  ctx.animators.push(t => {
    const g = park.guestsAt(ctx.walkerTime ? ctx.walkerTime(t) : t).walkers; const cp = ctx.camPos;
    const hc = [0, 0, 0, 0], lc = [0, 0, 0, 0]; const V = new THREE.Vector3(), SP = new THREE.Sphere();
    for (const q of pop) {
      if (q.kind === 'walker') { const k = q.wk; q.x = g[5 * k]; q.z = g[5 * k + 1]; q.yaw = g[5 * k + 2]; }
      let s = q.s; if (filt) s *= filt(q.x, q.z, t, q.kind, q.kind === 'walker' ? q.wk : q.seed); if (s <= 0) continue;
      if (ctx.frustum && !ctx.frustum.intersectsSphere(SP.set(V.set(q.x, 0.9, q.z), 3))) continue;
      let d2 = 1e12; if (cp) { d2 = (q.x - cp[0]) ** 2 + (q.z - cp[2]) ** 2; if (d2 < 16 && cp[1] < 9) continue; d2 += (cp[1] - 1) ** 2; }
      const hi = d2 < LODR2; const im = hi ? hiM[q.v] : loM[q.v]; const i = hi ? hc[q.v]++ : lc[q.v]++;
      im.setMatrixAt(i, T(q.x, q.y, q.z, q.yaw, s, s, s)); im.setColorAt(i, q.col); im.geometry.attributes.iLook.setXYZW(i, q.look[0], q.look[1], q.look[2], q.look[3]);
    }
    for (let v = 0; v < NV; v++) for (const [im, n] of [[hiM[v], hc[v]], [loM[v], lc[v]]]) { im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.geometry.attributes.iLook.needsUpdate = true; }
    strollerIdx.forEach((k, i) => { const x = g[5 * k], z = g[5 * k + 1], h = g[5 * k + 2]; let s = filt ? filt(x, z, t, 'walker', k) : 1; stM.setMatrixAt(i, T(x + Math.sin(h) * 0.75, 0, z + Math.cos(h) * 0.75, h, s, s, s)); });
    stM.instanceMatrix.needsUpdate = true;
    balloons.forEach((b, i) => { const sw = Math.sin(t * 1.3 + i) * 0.12; let s = 1; if (b[7] && filt) s = filt(b[7].x, b[7].z, t, 'idler', b[7].seed); else if (filt) s = filt(b[0], b[2], t, 'balloon', i);
      const top = [b[0] + sw, b[1] + Math.sin(t * 1.7 + i * 2) * 0.05, b[2] + sw * 0.5];
      if (cp && (b[0] - cp[0]) ** 2 + (b[2] - cp[2]) ** 2 < 16 && cp[1] < 9) s = 0;
      balM.setMatrixAt(i, T(top[0], top[1] * (s > 0 ? 1 : 0), top[2], 0, s, s * 1.1, s)); strM.setMatrixAt(i, s > 0 ? beamM_([b[4], b[5], b[6]], [top[0], top[1] - 0.6, top[2]], 0.015) : T(0, -50, 0, 0, 0, 0, 0)); });
    balM.instanceMatrix.needsUpdate = true; strM.instanceMatrix.needsUpdate = true;
    if (ctx.bulbGain) { const gn = ctx.bulbGain(t); if (gn !== undefined) bM.visible = gn > 0; }
  });
}
