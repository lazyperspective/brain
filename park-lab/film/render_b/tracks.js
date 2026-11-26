// tracks.js: coasters, water rides and railway with real hardware; trains with riders
import * as THREE from 'three';
import { merge, box, cyl, ico, sph, cone, S, T, R, hash } from './geo.js';

const hex = s => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// sweep a 2D profile [[left, up], ...] along a track between s0 and s1 (baked frames)
export function sweepTrack(tr, profile, s0, s1, step, closed = true, smoothNormals = true) {
  const n = Math.max(2, Math.ceil((s1 - s0) / step) + 1); const m = profile.length;
  const pos = new Float32Array(n * m * 3); const idx = [];
  for (let i = 0; i < n; i++) {
    const s = Math.min(s0 + i * step, s1); const f = tr.sample(s);
    const L = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
    for (let j = 0; j < m; j++) { const [a, b] = profile[j]; const k = (i * m + j) * 3; pos[k] = f.pos[0] + L[0] * a + f.up[0] * b; pos[k + 1] = f.pos[1] + L[1] * a + f.up[1] * b; pos[k + 2] = f.pos[2] + L[2] * a + f.up[2] * b; }
    if (i > 0) { const segs = closed ? m : m - 1; for (let j = 0; j < segs; j++) { const j2 = (j + 1) % m; const a = (i - 1) * m + j, b = (i - 1) * m + j2, c = i * m + j, d = i * m + j2; idx.push(a, b, c, b, d, c); } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const circ = (cx, cy, r, n) => { const o = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
const rect = (cx, cy, w, h) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];

export function buildTracks(W, park, opts = {}) {
  const D = park.data, M = W.M || null;
  const { put, cmp, beamM, mat, G, LP } = W;
  const trackMats = {};
  const tmat = (color, extra = {}) => { const k = color + JSON.stringify(extra); if (!trackMats[k]) trackMats[k] = W.M.std(Object.assign({ color, snowK: 0.12, rough: LP ? 0.7 : 0.3, metal: LP ? 0 : 0.15, bpPerVertex: true }, extra)); return trackMats[k]; };
  const addMesh = (geo, material, group, shadow = true) => { const m = new THREE.Mesh(geo, material); m.castShadow = shadow; m.receiveShadow = true; G(group).add(m); return m; };
  const segAt = (tr, tag) => tr.segments.filter(s => s.tag === tag);
  const tagOf = (tr, s) => tr.sample(s).tag;
  const M4 = (tr, s, off) => new THREE.Matrix4().fromArray(tr.matrix(s, off));
  const sides = LP ? 6 : 10;
  const trains = []; // animated trains: {rideId, tr, cars, carLen, gap, carMeshes...}

  // ======================================================== HERO (steel looping) + FAMILY
  for (const r of D.rides.filter(r => r.type === 'steel_looping_coaster' || r.type === 'family_coaster')) {
    const tr = park.track(r.track); const p = r.params; const hero = r.type === 'steel_looping_coaster';
    const grp = 'track:' + r.id; const tc = hex(p.colors.track), sc = hex(p.colors.supports);
    const g2 = p.gauge / 2, rr = (p.rail_diameter || 0.2) / 2;
    const spineY = hero ? -0.62 : -0.45, spineR = hero ? 0.3 : 0.22;
    const tm = tmat(tc);
    addMesh(sweepTrack(tr, circ(g2, 0, rr, sides), 0, tr.length, 0.5), tm, grp);
    addMesh(sweepTrack(tr, circ(-g2, 0, rr, sides), 0, tr.length, 0.5), tm, grp);
    if (hero) addMesh(sweepTrack(tr, circ(0, spineY, spineR, sides + 2), 0, tr.length, 0.5), tm, grp);
    else addMesh(sweepTrack(tr, rect(0, spineY, 0.36, 0.42), 0, tr.length, 0.5), tm, grp);
    // ties: crossbar + struts down to spine (merged local geometry, instanced in the track frame)
    const tieGeo = merge([
      box(p.gauge + 0.05, 0.09, 0.14, 0, -0.1, 0),
      ...[-1, 1].map(sx => { const g = box(0.08, Math.hypot(g2, spineY) * 0.95, 0.16); g.rotateZ(sx * Math.atan2(g2, -spineY)); g.translate(sx * g2 * 0.5, spineY * 0.5 - 0.02, 0); return g; }),
      box(0.4, 0.22, 0.2, 0, spineY + spineR * 0.6, 0),
      ...[-1, 1].map(sx => box(0.14, 0.18, 0.2, sx * g2, -0.06, 0)),
    ]);
    const tieStep = hero ? 1.2 : 1.0;
    for (let s = 0; s < tr.length; s += tieStep) put(tieGeo, 'trackI', M4(tr, s), tc, { group: grp });
    // wheel-carrier detail: small bolts on rails every 3 m (close-up sparkle)
    // lift: chain, anti-rollback, catwalks with stairs + handrails
    for (const seg of segAt(tr, 'lift')) {
      for (let s = seg.s0; s < seg.s1; s += 0.22) put('box', 'metal', M4(tr, s, [0, 0.02, 0]).multiply(new THREE.Matrix4().makeScale(0.07, 0.06, 0.2)), 0x3a3a3a, { group: grp });
      addMesh(sweepTrack(tr, rect(0, -0.07, 0.22, 0.06), seg.s0, seg.s1, 0.5), W.M.std({ color: 0x555a60, rough: 0.5, metal: 0.4, bpPerVertex: true, snowK: 0 }), grp);
      for (let s = seg.s0; s < seg.s1; s += 0.45) put('box', 'metal', M4(tr, s, [0.2, -0.02, 0]).multiply(new THREE.Matrix4().makeRotationX(0.5)).multiply(new THREE.Matrix4().makeScale(0.06, 0.04, 0.22)), 0x777777, { group: grp });
      if (hero) for (const sx of [-1, 1]) {
        const off = sx * (g2 + 0.95);
        // stairs: horizontal treads
        for (let s = seg.s0; s < seg.s1; s += 0.32) {
          const f = tr.sample(s); const L = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
          const c = [f.pos[0] + L[0] * off + f.up[0] * -0.25, f.pos[1] + L[1] * off + f.up[1] * -0.25, f.pos[2] + L[2] * off + f.up[2] * -0.25];
          const yaw = Math.atan2(f.tangent[0], f.tangent[2]);
          put('box', 'metal', cmp(c[0], c[1], c[2], yaw, 0.85, 0.05, 0.3), 0x9aa3ad, { group: grp });
        }
        addMesh(sweepTrack(tr, rect(off + sx * 0.42, 0.85, 0.06, 0.06), seg.s0, seg.s1, 1.0), W.M.std({ color: 0x9aa3ad, rough: 0.5, metal: 0.4, bpPerVertex: true, snowK: 0.3 }), grp);
        addMesh(sweepTrack(tr, rect(off + sx * 0.42, 0.35, 0.05, 0.05), seg.s0, seg.s1, 1.0), W.M.std({ color: 0x9aa3ad, rough: 0.5, metal: 0.4, bpPerVertex: true, snowK: 0.3 }), grp);
        addMesh(sweepTrack(tr, rect(off, -0.32, 0.9, 0.06), seg.s0, seg.s1, 1.0), W.M.std({ color: 0x8a939d, rough: 0.6, metal: 0.3, bpPerVertex: true, snowK: 0.6 }), grp);
        for (let s = seg.s0; s < seg.s1; s += 1.6) {
          put('box', 'metal', M4(tr, s, [off + sx * 0.42, 0.25, 0]).multiply(new THREE.Matrix4().makeScale(0.06, 1.2, 0.06)), 0x9aa3ad, { group: grp });
          put('box', 'metal', M4(tr, s, [sx * (g2 + 0.45), -0.32, 0]).multiply(new THREE.Matrix4().makeScale(0.9, 0.08, 0.1)), 0x9aa3ad, { group: grp });
        }
      }
    }
    // fin brakes on brakes/trim
    for (const tag of ['brakes', 'trim']) for (const seg of segAt(tr, tag)) for (let s = seg.s0 + 1; s < seg.s1 - 1; s += 0.9) {
      put('box', 'metal', M4(tr, s, [0, -0.05, 0]).multiply(new THREE.Matrix4().makeScale(0.04, 0.3, 0.75)), 0xc9ccd0, { group: grp });
      put('box', 'metal', M4(tr, s, [0, -0.25, 0]).multiply(new THREE.Matrix4().makeScale(0.5, 0.12, 0.3)), 0x333333, { group: grp });
    }
    // supports
    for (const sp of tr.supports) {
      const [bx, by, bz] = sp.base, [tx, ty, tz] = sp.top; const dia = sp.diameter;
      put('box', 'solid', cmp(bx, by + 0.15, bz, 0, 1.7, 0.36, 1.7), hex(p.colors.footers || '#B8B2A6'), { group: grp });
      put('cyl8', 'solid', cmp(bx, by + 0.36, bz, 0, dia + 0.25, 0.12, dia + 0.25), 0x8a8a8a, { group: grp });
      if (sp.type === 'lattice_tower' && sp.height > 4) {
        // ladder-style lattice bent across the track: 2 tapered legs (each a twin-tube column), rungs + X bracing
        const h = sp.height - 0.4; const bw = 1.1 + h * 0.035, tw = 0.75;
        const f = tr.sample(sp.s); const yaw = Math.atan2(f.tangent[0], f.tangent[2]);
        const L = W.frame(bx, by, bz, yaw);
        for (const sx of [-1, 1]) for (const sz of [-0.28, 0.28]) L.cbeam('ride', [sx * bw, 0, sz], [sx * tw, h, sz * 0.7], 0.2, sc, { group: grp });
        const nb = Math.max(1, Math.round(h / 4.0));
        for (let k = 0; k <= nb; k++) {
          const yy = h * k / nb, ww = bw + (tw - bw) * k / nb;
          L.cbeam('ride', [-ww, yy, 0], [ww, yy, 0], 0.13, sc, { group: grp });
          if (k < nb) { const y2 = h * (k + 1) / nb, w2 = bw + (tw - bw) * (k + 1) / nb; L.cbeam('ride', [-ww, yy, 0], [w2, y2, 0], 0.08, sc, { group: grp }); L.cbeam('ride', [ww, yy, 0], [-w2, y2, 0], 0.08, sc, { group: grp }); }
        }
        for (const sx of [-1, 1]) put('box', 'solid', cmp(...L.p(sx * bw, 0.15, 0), yaw, 1.2, 0.3, 1.2), hex(p.colors.footers || '#B8B2A6'), { group: grp });
        put('box', 'ride', cmp(tx, ty - 0.25, tz, yaw, 2.2, 0.35, 0.7), sc, { group: grp });
      } else {
        put('cyl12', 'ride', beamM([bx, by + 0.3, bz], [tx, ty - 0.1, tz], dia), sc, { group: grp });
        // flange rings every 6 m
        for (let yy = by + 6; yy < ty - 1; yy += 6) put('cyl12', 'ride', cmp(bx, yy, bz, 0, dia + 0.12, 0.1, dia + 0.12), sc, { group: grp });
        const f = tr.sample(sp.s); const yaw = Math.atan2(f.tangent[0], f.tangent[2]);
        put('box', 'ride', cmp(tx, ty - 0.05, tz, yaw, 1.1, 0.3, 0.5), sc, { group: grp });
      }
    }
    // night rig: bulbs along both outer rails on the lift and the loop (hero); lift on the family coaster
    for (const tag of (hero ? ['lift', 'loop'] : ['lift'])) for (const seg of segAt(tr, tag)) for (let s = seg.s0; s < seg.s1; s += 1.1) for (const sx of [-1, 1]) {
      const f = tr.sample(s); const lf = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
      const o = sx * (g2 + 0.22); W.addBulb(r.land, f.pos[0] + lf[0] * o + f.up[0] * 0.12, f.pos[1] + lf[1] * o + f.up[1] * 0.12, f.pos[2] + lf[2] * o + f.up[2] * 0.12, tag === 'loop' ? 0xffe2a0 : 0xffc76b, 0.2); }
    // trains
    const tp = p.train; const nTr = (D.animation[r.id] || {}).trains || tp.count || 1;
    trains.push(makeTrain(W, park, r, tr, tp, nTr, hero ? 'hero' : 'family'));
  }

  // ======================================================== WOODEN COASTER
  for (const r of D.rides.filter(r => r.type === 'wooden_out_and_back_coaster')) {
    const tr = park.track(r.track); const p = r.params; const grp = 'track:' + r.id;
    const wood = hex(p.colors.structure), dark = hex(p.colors.track);
    addMesh(sweepTrack(tr, [[-1.2, -0.65], [1.2, -0.65], [1.2, -0.05], [-1.2, -0.05]], 0, tr.length, 0.5), tmat(dark), grp);
    addMesh(sweepTrack(tr, rect(0.55, 0.0, 0.14, 0.08), 0, tr.length, 0.5), tmat(0x9aa3ad, { metal: 0.5 }), grp);
    addMesh(sweepTrack(tr, rect(-0.55, 0.0, 0.14, 0.08), 0, tr.length, 0.5), tmat(0x9aa3ad, { metal: 0.5 }), grp);
    // walkboards + handrails both sides
    for (const sx of [-1, 1]) {
      addMesh(sweepTrack(tr, rect(sx * 1.75, -0.6, 0.9, 0.08), 0, tr.length, 1.0), tmat(wood), grp);
      addMesh(sweepTrack(tr, rect(sx * 2.15, 0.45, 0.08, 0.08), 0, tr.length, 1.0), tmat(wood), grp);
    }
    for (let s = 0; s < tr.length; s += 1.2) for (const sx of [-1, 1]) put('box', 'solid', M4(tr, s, [sx * 2.15, -0.1, 0]).multiply(new THREE.Matrix4().makeScale(0.09, 1.1, 0.09)), wood, { group: grp });
    for (const b of tr.bents) {
      const [x, y, z] = b.top; const [ax, az] = b.axis; const tw = b.top_width / 2, bw = b.base_width / 2; const g0 = b.ground;
      const pt = (u, yy) => { const ww = bw + (tw - bw) * (yy - g0) / Math.max(0.1, y - 0.6 - g0); return [x + ax * ww * u, yy, z + az * ww * u]; };
      const top = y - 0.65;
      if (top - g0 < 0.3) continue;
      for (const u of [-1, 1]) put('box', 'solid', beamM(pt(u, g0), pt(u, top), 0.32), wood, { group: grp });
      if (b.height > 6) for (const u of [-0.45, 0.45]) put('box', 'solid', beamM([x + ax * bw * u * 0.9, g0, z + az * bw * u * 0.9], [x + ax * tw * u, top, z + az * tw * u], 0.22), wood, { group: grp });
      const nl = Math.max(1, Math.floor((top - g0) / 2.5));
      for (let k = 0; k <= nl; k++) { const yy = g0 + (top - g0) * k / nl; put('box', 'solid', beamM(pt(-1.05, yy), pt(1.05, yy), 0.2), wood, { group: grp });
        if (k < nl) { const y2 = g0 + (top - g0) * (k + 1) / nl; put('box', 'solid', beamM(pt(-1, yy), pt(1, y2), 0.13), wood, { group: grp }); put('box', 'solid', beamM(pt(1, yy), pt(-1, y2), 0.13), wood, { group: grp }); } }
      put('box', 'solid', cmp(x + ax * bw, g0 + 0.15, z + az * bw, 0, 0.8, 0.3, 0.8), 0xb8b2a6, { group: grp });
      put('box', 'solid', cmp(x - ax * bw, g0 + 0.15, z - az * bw, 0, 0.8, 0.3, 0.8), 0xb8b2a6, { group: grp });
    }
    // longitudinal ledgers between consecutive bents
    for (let i = 1; i < tr.bents.length; i++) {
      const a = tr.bents[i - 1], b = tr.bents[i]; if (Math.hypot(a.top[0] - b.top[0], a.top[2] - b.top[2]) > 3.5) continue;
      const ha = a.top[1] - 0.65, hb = b.top[1] - 0.65; const hmin = Math.min(ha, hb);
      for (let yy = 2.5; yy < hmin - 0.5; yy += 2.5) for (const u of [-1, 1]) {
        const fa = (ya, B) => { const tw = B.top_width / 2, bw = B.base_width / 2; const ww = bw + (tw - bw) * ya / Math.max(0.1, B.top[1] - 0.65); return [B.top[0] + B.axis[0] * ww * u, ya, B.top[2] + B.axis[1] * ww * u]; };
        put('box', 'solid', beamM(fa(yy, a), fa(yy, b), 0.14), wood, { group: grp });
        if (i % 3 === 0) put('box', 'solid', beamM(fa(yy - 2.5, a), fa(yy, b), 0.1), wood, { group: grp });
      }
    }
    for (const tag of ['lift', 'drop']) for (const seg of segAt(tr, tag)) for (let s = seg.s0; s < Math.min(seg.s1, seg.s0 + 60); s += 1.2) for (const sx of [-1, 1]) { const f = tr.sample(s); const lf = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]]; W.addBulb('frontier', f.pos[0] + lf[0] * sx * 2.15, f.pos[1] + 0.6, f.pos[2] + lf[2] * sx * 2.15, 0xffc070, 0.2); }
    for (const seg of segAt(tr, 'lift')) for (let s = seg.s0; s < seg.s1; s += 0.25) put('box', 'metal', M4(tr, s, [0, 0.02, 0]).multiply(new THREE.Matrix4().makeScale(0.07, 0.06, 0.2)), 0x3a3a3a, { group: grp });
    const tp = p.train; const nTr = (D.animation[r.id] || {}).trains || tp.count || 1;
    trains.push(makeTrain(W, park, r, tr, tp, nTr, 'wood'));
  }

  // ======================================================== LOG FLUME
  for (const r of D.rides.filter(r => r.type === 'log_flume')) {
    const tr = park.track(r.track); const p = r.params; const grp = 'track:' + r.id; const tw = p.trough_width / 2, td = p.trough_depth;
    addMesh(sweepTrack(tr, [[-tw - 0.12, td * 0.45], [-tw - 0.12, -td * 0.7], [tw + 0.12, -td * 0.7], [tw + 0.12, td * 0.45]], 0, tr.length, 0.5, false), tmat(hex(p.trough_outer || '#8B6B4A')), grp);
    addMesh(sweepTrack(tr, [[tw, td * 0.45], [tw, -td * 0.55], [-tw, -td * 0.55], [-tw, td * 0.45]], 0, tr.length, 0.5, false), tmat(hex(p.trough_color || '#DDEFF2')), grp);
    const wm = W.M.std({ color: 0x5aa9d6, rough: 0.1, snowK: 0, bpPerVertex: true, fragExtra: f => f.replace('#include <color_fragment>', `#include <color_fragment>\n{ float w = mn(vec2(vWP.x + vWP.z, uTime * 6.0) * vec2(1.3, 1.0)); diffuseColor.rgb = mix(vec3(0.3,0.62,0.82), vec3(0.85,0.95,1.0), smoothstep(0.55, 0.9, w)); }`), key: 'flumewater' });
    addMesh(sweepTrack(tr, [[tw - 0.02, -0.05], [-tw + 0.02, -0.05]], 0, tr.length, 0.5, false), wm, grp, false);
    for (const seg of segAt(tr, 'lift')) for (let s = seg.s0; s < seg.s1; s += 0.6) put('box', 'metal', M4(tr, s, [0, -0.02, 0]).multiply(new THREE.Matrix4().makeScale(0.9, 0.08, 0.12)), 0x2a2a2a, { group: grp });
    for (const sp of tr.supports) {
      const [bx, by, bz] = sp.base, [tx, ty, tz] = sp.top; const f = tr.sample(sp.s); const yaw = Math.atan2(f.tangent[0], f.tangent[2]); const L = W.frame(bx, by, bz, yaw);
      const h = ty - by - 0.6; if (h < 0.4) continue;
      for (const sx of [-1, 1]) L.box('solid', sx * 1.0, h / 2, 0, 0.3, h, 0.3, 0x7b5e3b, 0, 0, sx * -0.06, { group: grp });
      for (let yy = 1.8; yy < h; yy += 2.4) { L.box('solid', 0, yy, 0, 2.4, 0.18, 0.2, 0x7b5e3b, 0, 0, 0, { group: grp }); L.beam('solid', [-1, yy - 1.8, 0], [1, yy, 0], 0.12, 0x7b5e3b, { group: grp }); }
      L.box('solid', 0, h, 0, 2.6, 0.25, 0.4, 0x7b5e3b, 0, 0, 0, { group: grp });
    }
    // splash pool spray wall & logs
    const tp = { cars: 1, car_length: p.boats.length, car_gap: 0, color: p.boats.color }; const nB = (D.animation[r.id] || {}).boats || p.boats.count;
    trains.push(makeTrain(W, park, r, tr, tp, nB, 'log'));
  }

  // ======================================================== RIVER RAPIDS
  for (const r of D.rides.filter(r => r.type === 'river_rapids')) {
    const tr = park.track(r.track); const p = r.params; const grp = 'track:' + r.id; const cw = p.channel_width / 2;
    addMesh(sweepTrack(tr, [[-cw - 1.4, 1.2], [-cw - 0.3, 0.9], [-cw, -1.2], [cw, -1.2], [cw + 0.3, 0.9], [cw + 1.4, 1.2]], 0, tr.length, 0.5, false), tmat(0x8c7a63, { rough: 0.95 }), grp);
    const wm = W.M.std({ color: 0x4b8fbf, rough: 0.12, snowK: 0, bpPerVertex: true, key: 'rapidswater', fragExtra: f => f.replace('#include <color_fragment>', `#include <color_fragment>\n{ float w = mn(vWP.xz * 0.7 + uTime * 0.9) * 0.6 + mn(vWP.xz * 2.3 - uTime * 1.3) * 0.4; diffuseColor.rgb = mix(vec3(0.2,0.5,0.66), vec3(0.92,0.97,1.0), smoothstep(0.6, 0.85, w)); }`) });
    addMesh(sweepTrack(tr, [[cw - 0.1, 0.0], [-cw + 0.1, 0.0]], 0, tr.length, 0.5, false), wm, grp, false);
    // rockwork boulders along the banks
    for (let s = 0; s < tr.length; s += 2.2) for (const sx of [-1, 1]) { const h = hash(s * 3.1 + sx); if (h < 0.35) continue; const sc = 0.8 + hash(s + 9 * sx) * 1.6;
      put('sph0', 'solid', M4(tr, s, [sx * (cw + 1.0 + h), 0.5, 0]).multiply(new THREE.Matrix4().makeScale(sc * 1.4, sc, sc * 1.2)), [0x9b8b78, 0x8a7a68, 0xa89880][(s | 0) % 3], { group: grp }); }
    const tp = { cars: 1, car_length: p.rafts.diameter, car_gap: 0, colors: p.rafts.colors }; const nB = (D.animation[r.id] || {}).boats || p.rafts.count;
    trains.push(makeTrain(W, park, r, tr, tp, nB, 'raft'));
  }

  // ======================================================== RAILWAY
  for (const r of D.rides.filter(r => r.type === 'perimeter_railway')) {
    const tr = park.track(r.track); const grp = 'track:' + r.id; const p = r.params;
    addMesh(sweepTrack(tr, [[-2.0, -0.55], [-1.2, -0.1], [1.2, -0.1], [2.0, -0.55]], 0, tr.length, 2, false), tmat(0x8d8a85, { rough: 1 }), grp, false);
    for (let s = 0; s < tr.length; s += 0.8) put('box', 'solid', M4(tr, s, [0, -0.05, 0]).multiply(new THREE.Matrix4().makeScale(1.9, 0.1, 0.22)), 0x6b4a2e, { group: grp, shadow: false });
    for (const sx of [-0.46, 0.46]) addMesh(sweepTrack(tr, rect(sx, 0.05, 0.07, 0.1), 0, tr.length, 2), tmat(0x6d6f73, { metal: 0.6 }), grp, false);
    trains.push(makeTrain(W, park, r, tr, p.train, 1, 'rail'));
  }

  W.flush();
  W.animators.push((t, shot) => { for (const T2 of trains) T2.update(t, shot); });
  return { trains };
}

// ---------------------------------------------------------------------------------------------- trains
function makeTrain(W, park, r, tr, tp, nTr, kind) {
  const { G, LP } = W;
  const nCars = kind === 'rail' ? 1 + (tp.coaches || 5) : (tp.cars || 1);
  const carL = kind === 'rail' ? 7.0 : (tp.car_length || 2.2), gap = kind === 'rail' ? 0.6 : (tp.car_gap || 0.25);
  const colors = (tp.colors && Array.isArray(tp.colors)) ? tp.colors.map(hex) : [hex(tp.color || '#ffffff')];
  const grp = G('trains');
  const pieces = []; // {geo, mat, perCar: (carIdx, trainIdx) => colour, count}
  const lead = [], body = [], dark = [], metal = [], riders = [];
  const ridersPerCar = kind === 'hero' || kind === 'wood' ? 4 : kind === 'family' ? 2 : kind === 'log' ? 4 : kind === 'raft' ? 6 : 0;
  // car local geometry (x = left, y = up, z = forward), origin on the track centreline at car centre
  let bodyGeo, leadGeo, darkGeo, metalGeo, seatOffsets = [];
  if (kind === 'hero' || kind === 'wood' || kind === 'family') {
    const w = kind === 'family' ? 1.3 : 1.9, L = carL - 0.1;
    const rows = kind === 'family' ? [0] : [0.42, -0.62];
    const seats = kind === 'family' ? [0.3, -0.3] : [0.47, -0.47];
    for (const rz of rows) for (const sx of seats) seatOffsets.push([sx, 0.62, rz - 0.22]);
    const sideH = kind === 'family' ? 0.55 : 0.62;
    bodyGeo = merge([
      box(w, 0.22, L, 0, 0.42, 0),                     // floor pan
      box(0.12, sideH, L, w / 2 - 0.06, 0.42 + sideH / 2, 0), box(0.12, sideH, L, -w / 2 + 0.06, 0.42 + sideH / 2, 0), // sides
      box(w, 0.3, 0.14, 0, 0.55, L / 2 - 0.07), box(w - 0.1, 0.08, 0.36, 0, 0.72, L / 2 - 0.2), // front panel + padded top
      ...rows.map(rz => box(w - 0.2, 0.62, 0.14, 0, 0.84, rz - 0.42)), ...rows.flatMap(rz => seats.map(sx => box(0.5, 0.32, 0.12, sx, 1.27, rz - 0.44))), // seat backs + headrests
      ...rows.map(rz => box(w - 0.2, 0.18, 0.55, 0, 0.62, rz - 0.12)), // seat pans
    ]);
    darkGeo = merge([
      box(1.2, 0.26, 0.5, 0, 0.18, L * 0.3), box(1.2, 0.26, 0.5, 0, 0.18, -L * 0.3), // bogies
      ...[-1, 1].flatMap(sx => [cyl(0.13, 0.13, 0.1, 10).rotateZ(Math.PI / 2).translate(sx * 0.62, 0.07, L * 0.3), cyl(0.13, 0.13, 0.1, 10).rotateZ(Math.PI / 2).translate(sx * 0.62, 0.07, -L * 0.3), cyl(0.1, 0.1, 0.1, 8).translate(sx * 0.52, -0.16, L * 0.3), cyl(0.1, 0.1, 0.1, 8).translate(sx * 0.52, -0.16, -L * 0.3)]),
      box(0.25, 0.12, 0.5, 0, 0.3, -L / 2), // coupler
    ]);
    // lap bars (U) per seat: front of seat at z + 0.15
    const bars = [];
    for (const [sx, , rz] of seatOffsets) { const z0 = rz + 0.42; bars.push(cyl(0.025, 0.025, 0.32, 6).rotateX(Math.PI / 2).translate(sx - 0.15, 0.86, z0), cyl(0.025, 0.025, 0.32, 6).rotateX(Math.PI / 2).translate(sx + 0.15, 0.86, z0), S(cyl(0.05, 0.05, 0.34, 8), 1, 1, 1).rotateZ(Math.PI / 2).translate(sx, 0.86, z0 + 0.16), cyl(0.035, 0.035, 0.3, 6).translate(sx, 0.72, z0 - 0.16)); }
    metalGeo = merge(bars);
    // nose cone for lead car
    if (kind === 'hero') leadGeo = merge([sph(1, 16, 8, 0, 0, 0, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(w / 2 * 0.92, 0.3, 1.5).translate(0, 0.45, L / 2 - 0.05), S(cone(0.5, 1, 12), 1, 1, 1).rotateX(Math.PI / 2).scale(0.5, 0.3, 0.6).translate(0, 0.62, L / 2 + 1.3)]);
    else if (kind === 'family') leadGeo = merge([sph(0.62, 12, 10, 0, 1.1, L / 2 + 0.15), sph(0.12, 8, 6, 0.25, 1.38, L / 2 + 0.6), sph(0.12, 8, 6, -0.25, 1.38, L / 2 + 0.6), cyl(0.03, 0.03, 0.6, 5, 0.22, 1.85, L / 2 + 0.2), cyl(0.03, 0.03, 0.6, 5, -0.22, 1.85, L / 2 + 0.2)]);
    else leadGeo = merge([box(w, 0.7, 0.4, 0, 0.8, L / 2 + 0.15)]);
  } else if (kind === 'log') {
    bodyGeo = merge([S(cyl(0.75, 0.75, carL, 12), 1, 1, 0.75).rotateX(Math.PI / 2).translate(0, 0.2, 0), box(1.2, 0.2, carL - 0.8, 0, 0.62, 0)]);
    for (let k = 0; k < 4; k++) seatOffsets.push([0, 0.35, carL / 2 - 0.9 - k * 0.85]);
    darkGeo = merge([S(sph(0.7, 10, 6), 1, 0.7, 0.4).translate(0, 0.35, carL / 2), S(sph(0.7, 10, 6), 1, 0.7, 0.4).translate(0, 0.35, -carL / 2)]);
  } else if (kind === 'raft') {
    bodyGeo = merge([new THREE.TorusGeometry(1.45, 0.32, 8, 20).rotateX(Math.PI / 2).translate(0, 0.25, 0)]);
    darkGeo = merge([cyl(1.3, 1.3, 0.25, 16, 0, 0.3, 0), cyl(0.45, 0.45, 0.8, 10, 0, 0.6, 0)]);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; seatOffsets.push([Math.cos(a) * 0.95, 0.45, Math.sin(a) * 0.95, a]); }
  } else if (kind === 'rail') {
    bodyGeo = merge([box(2.2, 0.3, carL - 0.4, 0, 0.9, 0), box(2.3, 0.12, carL - 0.2, 0, 2.9, 0), ...[-1, 1].flatMap(sz => [-1, 1].map(sx => box(0.1, 1.9, 0.1, sx * 1.05, 1.95, sz * (carL / 2 - 0.4)))), box(2.0, 0.5, 0.1, 0, 1.3, 0), box(0.1, 0.6, carL - 0.6, 1.05, 1.3, 0), box(0.1, 0.6, carL - 0.6, -1.05, 1.3, 0)]);
    darkGeo = merge([box(1.4, 0.4, 1.2, 0, 0.45, carL * 0.3), box(1.4, 0.4, 1.2, 0, 0.45, -carL * 0.3)]);
    leadGeo = merge([cyl(0.8, 0.8, 4.2, 12).rotateX(Math.PI / 2).translate(0, 1.6, 1.0), box(2.0, 2.4, 2.2, 0, 2.0, -2.0), box(2.3, 0.15, 2.6, 0, 3.25, -2.0), cyl(0.28, 0.35, 1.6, 8, 0, 3.0, 2.6), cyl(0.38, 0.38, 0.2, 8, 0, 3.8, 2.6), S(sph(0.35, 8, 6), 1, 1, 1).translate(0, 2.55, 0.6), box(2.2, 0.35, carL - 0.4, 0, 0.75, 0)]);
    for (let c = 0; c < 6; c++) seatOffsets.push([c % 2 ? 0.5 : -0.5, 0.95, -carL / 2 + 1.2 + Math.floor(c / 2) * 2.0]);
  }
  const total = nTr * nCars;
  const mk = (geo, mkey, count) => { if (!geo) return null; const im = new THREE.InstancedMesh(geo, W.mat(mkey), count); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; grp.add(im); return im; };
  const bodyIM = mk(bodyGeo, 'ride', total), darkIM = mk(darkGeo, 'trackI', total), metalIM = mk(metalGeo, 'metal', total), leadIM = mk(leadGeo, 'ride', nTr);
  const col = new THREE.Color();
  for (let i = 0; i < total; i++) {
    const c = i % nCars, tIdx = Math.floor(i / nCars);
    let cc = colors[(c + tIdx) % colors.length];
    if (kind === 'rail') cc = c === 0 ? hex(tp.colors.loco) : hex(tp.colors.coaches);
    if (kind === 'family') cc = colors[c === 0 ? 0 : (c % 2 ? 1 : 0)];
    bodyIM.setColorAt(i, col.set(cc)); darkIM.setColorAt(i, col.set(kind === 'raft' ? 0x3a3a3a : 0x2c2c30)); if (metalIM) metalIM.setColorAt(i, col.set(0xd0d4d8));
  }
  if (leadIM) for (let i = 0; i < nTr; i++) leadIM.setColorAt(i, col.set(kind === 'hero' ? 0xe23b2e : kind === 'family' ? 0x7bc96f : kind === 'rail' ? hex(tp.colors.loco) : colors[0]));
  // riders
  const nR = total * ridersPerCar; let ridersIM = null; const rCols = [];
  if (nR && !W.noRiders) {
    ridersIM = W.makePeople ? W.makePeople(nR, 'riders') : null;
  }
  const m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4(), sc = new THREE.Matrix4();
  const armsTags = new Set(['drop', 'loop', 'corkscrew', 'airtime', 'crest', 'helix', 'turnaround', 'hill', 'twister', 'chute', 'splash']);
  const update = (t, shot) => {
    const fronts = park.trainFronts(r.id, t, shot); let k = 0, kr = 0;
    for (let ti = 0; ti < nTr; ti++) {
      for (let c = 0; c < nCars; c++) {
        const s = fronts[ti] - carL / 2 - c * (carL + gap);
        m4.fromArray(tr.matrix(s, [0, kind === 'log' ? -0.35 : kind === 'raft' ? -0.2 : kind === 'rail' ? 0 : 0, 0]));
        if (kind === 'raft') m4.multiply(m5.makeRotationY(Math.sin(t * 0.3 + ti * 2.1) * 2.5 + ti));
        bodyIM.setMatrixAt(k, m4); darkIM.setMatrixAt(k, m4); if (metalIM) metalIM.setMatrixAt(k, m4);
        if (c === 0 && leadIM) {
          // polish: in a ride-along shot, our own lead car gets a shorter nose (0.55x) so only its tip shows at the bottom edge,
          // matching the render_a / render_c cars that cut against it
          if (kind === 'hero' && shot && shot.camera && shot.camera.mode === 'pov' && shot.camera.ride === r.id && ti === (shot.camera.train || 0)) {
            const pz = carL / 2 - 0.1; m5.copy(m4).multiply(sc.makeTranslation(0, 0, pz)).multiply(new THREE.Matrix4().makeScale(1, 1, 0.55)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -pz));
            leadIM.setMatrixAt(ti, m5);
          } else leadIM.setMatrixAt(ti, m4);
        }
        if (ridersIM) {
          const tag = tr.sample(s).tag; const up = armsTags.has(tag) ? 1 : 0;
          for (let q = 0; q < ridersPerCar; q++) {
            const so = seatOffsets[q % seatOffsets.length];
            m5.copy(m4).multiply(sc.makeTranslation(so[0], so[1] - 0.86 * 0.94, so[2])).multiply(new THREE.Matrix4().makeRotationY(so[3] != null ? -so[3] - Math.PI / 2 : 0)).multiply(new THREE.Matrix4().makeScale(0.94, 0.94, 0.94));
            const seed = ti * 97 + c * 7 + q;
            const armsUp = kind === 'rail' ? 0 : up * (hash(seed) < 0.75 ? 1 : 0.0) + (kind === 'log' && tag === 'drop' ? 1 : 0);
            // polish: ride-along shots hide our own front-row neighbours (their heads and raised arms sat next to the lens)
            if (kind === 'hero' && c === 0 && q < 2 && shot && shot.camera && shot.camera.mode === 'pov' && shot.camera.ride === r.id && ti === (shot.camera.train || 0)) m5.makeScale(0, 0, 0);
            W.setPerson(ridersIM, kr++, m5, seed, -1, Math.min(1, armsUp), 0);
          }
        }
        k++;
      }
    }
    for (const im of [bodyIM, darkIM, metalIM, leadIM]) if (im) im.instanceMatrix.needsUpdate = true;
    if (ridersIM) W.commitPeople(ridersIM);
  };
  return { update, rideId: r.id, bodyIM, leadIM, ridersIM };
}
