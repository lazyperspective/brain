// World builder part 2: buildings, flat rides, tracks, trains (styles: paper / felt / tin)
import * as THREE from 'three';
import { clamp, lerp, rng, hash1, hex, canvasTex, starPath, RoundedBoxGeometry, lumpySphere, tint, merge, xf, beamMatrix, Inst, sweepTrack, circleProfile, mixHex, shade, makeCanvas } from './common.js';
import { geoKit, drawPattern } from './world.js';

// ---------------------------------------------------------------------------------------------- helpers
function mk(W) {
  const { S, K } = W; const G = geoKit(S);
  const H = {};
  H.mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
  H.add = (parent, obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz); parent.add(obj); return obj; };
  H.box = (p, w, h, d, c, o = {}, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => H.add(p, H.mesh(G.box(w, h, d, o.r), typeof c === 'string' ? K.M(c, o) : c), x, y, z, rx, ry, rz);
  H.cyl = (p, rt, rb, h, c, o = {}, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => H.add(p, H.mesh(G.cyl(rt, rb, h, o.seg || 20, o.open), typeof c === 'string' ? K.M(c, o) : c), x, y, z, rx, ry, rz);
  H.sph = (p, r, c, o = {}, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = H.add(p, H.mesh(G.sph(r, o.seg || 16), typeof c === 'string' ? K.M(c, o) : c), x, y, z); m.scale.set(sx, sy, sz); return m; };
  H.cone = (p, r, h, c, o = {}, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => H.add(p, H.mesh(G.cone(r, h, o.seg || 20), typeof c === 'string' ? K.M(c, o) : c), x, y, z, rx, ry, rz);
  H.rod = (p, a, b, r, c, o = {}) => { const bm = beamMatrix(a, b, 1); const m = H.mesh(G.cyl(r, r, 1, o.seg || 8), typeof c === 'string' ? K.M(c, o) : c); m.position.copy(bm.p); m.quaternion.copy(bm.q); m.scale.set(1, bm.s.y, 1); p.add(m); return m; };
  H.torus = (p, R, r, c, o = {}, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => H.add(p, H.mesh(new THREE.TorusGeometry(R, r, o.rs || 8, o.ts || 48, o.arc || Math.PI * 2), typeof c === 'string' ? K.M(c, o) : c), x, y, z, rx, ry, rz);
  // striped cone/cylinder via vertex colours (paper facets, felt panels, tin print)
  H.stripedCone = (p, r, h, n, c1, c2, o = {}, x = 0, y = 0, z = 0) => { let g = new THREE.ConeGeometry(r, h, n * (S === 'paper' ? 1 : 2), S === 'felt' ? 3 : 1, !!o.open); g = g.toNonIndexed(); colourByAngle(g, n, c1, c2); g.computeVertexNormals(); const m = H.mesh(g, K.IM(Object.assign({ side: !!o.open, flat: S === 'paper' }, o.mo || {}))); return H.add(p, m, x, y, z); };
  H.stripedCyl = (p, r, h, n, c1, c2, o = {}, x = 0, y = 0, z = 0) => { let g = new THREE.CylinderGeometry(o.rt ?? r, r, h, n * (S === 'paper' ? 1 : 2), 1, !!o.open); g = g.toNonIndexed(); colourByAngle(g, n, c1, c2); if (!o.open) g.computeVertexNormals(); const m = H.mesh(g, K.IM(Object.assign({ side: !!o.open, flat: S === 'paper' }, o.mo || {}))); return H.add(p, m, x, y, z); };
  H.scallop = (p, r, h, n, c, y) => { const pts = []; const g = new THREE.CylinderGeometry(r, r, h, n * 4, 1, true).toNonIndexed(); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { if (P.getY(i) < 0) { const a = Math.atan2(P.getZ(i), P.getX(i)); P.setY(i, -h / 2 + Math.abs(Math.sin(a * n / 2)) * h * 0.55); } } g.computeVertexNormals(); return H.add(p, H.mesh(g, K.M(c, { side: true })), 0, y, 0); };
  H.bulbs = (p, pts, c = '#ffffff') => { if (!pts.length) return; const inst = new Inst(new THREE.SphereGeometry(0.11, 8, 6), K.M('#ffffff', { kind: 'bulb' }), pts.map(q => ({ p: q, c }))); inst.mesh.castShadow = false; p.add(inst.mesh); return inst; };
  H.ring = (n, r, y, f) => { const out = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push(f ? f(a, i) : [Math.cos(a) * r, y, Math.sin(a) * r]); } return out; };
  H.rivets = (p, pts) => { if (S !== 'tin' || !pts.length) return; const inst = new Inst(new THREE.SphereGeometry(0.09, 8, 6), K.M('#ffffff', { kind: 'chrome' }), pts.map(q => ({ p: q }))); inst.mesh.castShadow = false; p.add(inst.mesh); };
  H.G = G;
  return H;
}
function colourByAngle(g, n, c1, c2) { const ps = g.attributes.position; const col = new Float32Array(ps.count * 3); const a = new THREE.Color(c1), b = new THREE.Color(c2);
  for (let f = 0; f < ps.count / 3; f++) { let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += ps.getX(f * 3 + k); cz += ps.getZ(f * 3 + k); } const ang = (Math.atan2(cz, cx) + Math.PI) / (2 * Math.PI); const c = (Math.floor(ang * n + 1e-4) % 2) ? a : b; for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f * 3 + k) * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
function piece(W, obj, x, z, info) { obj.userData.piece = Object.assign({ x, z }, info); W.pieces.push(obj); return obj; }

// ---------------------------------------------------------------------------------------------- facades
function facadeTex(W, b, w, h) {
  const { S } = W; const ppm = 40; const cw = Math.min(1024, Math.round(w * ppm)), ch = Math.min(1024, Math.round(h * ppm));
  return canvasTex(cw, ch, (g) => {
    const X = v => v / w * cw, Y = v => ch - v / h * ch; const wall = b.wall || '#E8C9A0', trim = b.trim || '#FFFFFF';
    g.fillStyle = wall; g.fillRect(0, 0, cw, ch);
    if ((b.kind === 'main_street_shop' || b.kind === 'guest_services' || b.kind === 'restroom') && (wall === '#B5563F' || b.kind !== 'main_street_shop')) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let y = 0; y < ch; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke(); } }
    const sh = b.storey_heights || [h]; let y0 = 0; const R = rng(hex(wall) % 991 + w * 7);
    sh.forEach((sth, si) => {
      const nWin = Math.max(1, Math.round(w / (si === 0 ? 4.0 : 2.6)));
      if (si === 0 && (b.shopfront || b.kind === 'main_street_shop')) { // shopfront: big display windows + door
        g.fillStyle = trim; g.fillRect(X(0.3), Y(y0 + sth * 0.85), X(w - 0.6), Y(0) - Y(sth * 0.85));
        const dw = 1.4; const n = 2; for (let k = 0; k < n; k++) { const x0 = 0.6 + k * (w - 1.2) / n, ww = (w - 1.2) / n - 0.3; const isDoor = k === 1;
          g.fillStyle = S === 'tin' ? '#233a66' : '#3a4a5a'; g.fillRect(X(x0 + 0.15), Y(y0 + sth * 0.75), X(ww - 0.3), Y(0) - Y(sth * 0.75 - 0.4));
          g.fillStyle = 'rgba(190,225,240,0.9)'; g.fillRect(X(x0 + 0.3), Y(y0 + sth * 0.72), X(ww - 0.6), Y(0) - Y(sth * 0.72 - 0.7));
          // display goods
          for (let j = 0; j < 6; j++) { g.fillStyle = ['#E74C3C', '#F1C40F', '#2E86C1', '#F5A6C8', '#27AE60', '#ffffff'][(R() * 6) | 0]; g.beginPath(); g.arc(X(x0 + 0.5 + R() * (ww - 1)), Y(y0 + 0.9 + R() * 0.6), X(0.18), 0, 7); g.fill(); }
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(X(x0 + 0.4), Y(y0 + sth * 0.7)); g.lineTo(X(x0 + 0.9), Y(y0 + sth * 0.7)); g.lineTo(X(x0 + 0.4), Y(y0 + 1.2)); g.fill(); }
        g.fillStyle = b.awning || '#7B3F61'; g.fillRect(X(0.3), Y(y0 + sth * 0.98), X(w - 0.6), Y(0) - Y(sth * 0.14)); // fascia (blank sign)
        g.fillStyle = trim; g.fillRect(X(0.5), Y(y0 + sth * 0.95), X(w - 1), Y(0) - Y(0.08));
      } else if (si === 0) { // plain ground floor: door + windows
        const dX = w / 2; g.fillStyle = S === 'tin' ? '#7B3F2a' : '#6B4A2E'; g.fillRect(X(dX - 0.6), Y(y0 + 2.3), X(1.2), Y(0) - Y(2.3)); g.fillStyle = trim; g.fillRect(X(dX - 0.7), Y(y0 + 2.45), X(1.4), Y(0) - Y(0.15));
        for (let k = 0; k < nWin; k++) { const cx = (k + 0.5) * w / nWin; if (Math.abs(cx - dX) < 1.2) continue; win(g, X, Y, cx, y0 + sth * 0.55, 1.0, Math.min(1.5, sth * 0.45), trim, S, R); }
      } else { for (let k = 0; k < nWin; k++) { const cx = (k + 0.5) * w / nWin; win(g, X, Y, cx, y0 + sth * 0.52, Math.min(1.1, w / nWin * 0.55), sth * 0.55, trim, S, R, b.window_boxes); } }
      y0 += sth; g.fillStyle = trim; g.fillRect(0, Y(y0) - 3, cw, 6); // string course
    });
    // corner quoins / pilasters
    g.fillStyle = shade(wall, 0.85); g.fillRect(0, 0, X(0.35), ch); g.fillRect(cw - X(0.35), 0, X(0.35), ch);
    if (S === 'felt') { g.strokeStyle = 'rgba(255,250,235,0.8)'; g.lineWidth = 2; g.setLineDash([7, 6]); g.strokeRect(5, 5, cw - 10, ch - 10); g.setLineDash([]); }
    if (S === 'tin') { g.strokeStyle = '#233a66'; g.lineWidth = 4; g.strokeRect(3, 3, cw - 6, ch - 6); g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 1500; i++) g.fillRect(R() * cw, R() * ch, 1.5, 1.5); }
    if (S === 'paper') { g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 2; g.strokeRect(1, 1, cw - 2, ch - 2); }
  });
}
function win(g, X, Y, cx, cy, ww, wh, trim, S, R, box) {
  g.fillStyle = trim; g.fillRect(X(cx - ww / 2 - 0.12), Y(cy + wh / 2 + 0.12), X(ww + 0.24), Y(0) - Y(wh + 0.24));
  g.fillStyle = S === 'tin' ? '#2f5f8f' : '#4a6a85'; g.fillRect(X(cx - ww / 2), Y(cy + wh / 2), X(ww), Y(0) - Y(wh));
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(X(cx - ww / 2 + 0.08), Y(cy + wh / 2 - 0.08), X(ww * 0.3), Y(0) - Y(wh * 0.5));
  g.fillStyle = trim; g.fillRect(X(cx - 0.03), Y(cy + wh / 2), X(0.06), Y(0) - Y(wh)); g.fillRect(X(cx - ww / 2), Y(cy + 0.03), X(ww), Y(0) - Y(0.06));
  if (box) { g.fillStyle = '#6B4A2E'; g.fillRect(X(cx - ww / 2 - 0.1), Y(cy - wh / 2 + 0.05), X(ww + 0.2), Y(0) - Y(0.25)); for (let i = 0; i < 6; i++) { g.fillStyle = ['#E74C3C', '#F1C40F', '#ffffff', '#F5A6C8', '#5E8C40'][(R() * 5) | 0]; g.beginPath(); g.arc(X(cx - ww / 2 + i * ww / 5), Y(cy - wh / 2 + 0.25), X(0.12), 0, 7); g.fill(); } }
}

// ---------------------------------------------------------------------------------------------- BUILDINGS
const KIND_WALL = { restroom: '#B7A99A', first_aid: '#FFFFFF', bandstand: '#FFFFFF', entrance_arch: '#B5563F', ticket_booth: '#C8463A', railway_station: '#F3E6CC', frontier_building: '#A0522D', food_court: '#D7263D', water_tower: '#8B6B4A', lighthouse_folly: '#FFFFFF', boathouse: '#FFFFFF', shop: '#E8C9A0', food_kiosk: '#F3E6CC', guest_services: '#B5563F' };
export function buildBuildings(W) {
  const { D, S, K, lodOf, group } = W; const H = mk(W);
  for (const b of D.buildings) {
    const [x, y0, z] = b.position; const rot = b.rot || 0; const lod = lodOf(x, z); if (lod > 2) continue; const hi = lod === 0;
    const grp = new THREE.Group(); grp.position.set(x, y0, z); grp.rotation.y = rot; group('buildings').add(grp);
    piece(W, grp, x, z, { cat: 'building', id: b.id, kind: b.kind, land: b.land, h: b.h });
    const wall = b.wall || KIND_WALL[b.kind] || '#E0D6C4';
    if (b.kind === 'game_booth_rows') { W.pieces.pop(); grp.rotation.y = 0; grp.position.set(0, 0, 0); booths(W, H, grp, b); continue; }
    if (b.kind === 'turnstiles' || b.kind === 'turnstile_line') { if (b.items) for (const it of b.items) { const [ix, , iz] = it.position; H.box(grp, it.w || 1, it.h || 1.1, it.d || 1, '#9AA3AD', { kind: 'metal' }, ix - x, (it.h || 1.1) / 2, iz - z); } continue; }
    if (b.kind === 'entrance_arch') { for (const sx of [-14, 14]) { H.box(grp, 6, 12, 4, wall, { pattern: 'bricks', acc: '#8E3F2E' }, sx, 6, 0); H.sph(grp, 2.4, '#3E7E6E', {}, sx, 12.4, 0, 1, 1.2, 1); H.cyl(grp, 0.08, 0.08, 3, '#ffffff', {}, sx, 15, 0); }
      H.box(grp, 24, 2.2, 1.5, '#2E4A5E', {}, 0, 12.5, 0); H.box(grp, 22, 0.6, 1.7, '#D9A441', {}, 0, 11.2, 0); H.bulbs(grp, H.ring(1, 0, 0).length ? Array.from({ length: 30 }, (_, i) => [-11 + i * 22 / 29, 11.2, 0.9]) : []); continue; }
    if (b.kind === 'bandstand') { H.cyl(grp, 5.2, 5.4, 1, '#B5563F', { seg: 8, pattern: S === 'felt' ? 'plain' : 'bricks', acc: '#8E3F2E' }, 0, 0.5, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; H.cyl(grp, 0.15, 0.15, 4.2, '#ffffff', { seg: 8 }, Math.cos(a) * 4.5, 3.1, Math.sin(a) * 4.5); } H.stripedCone(grp, 5.6, 2.8, 8, '#C8463A', '#ffffff', {}, 0, 6.6, 0); H.sph(grp, 0.4, '#D9A441', {}, 0, 8.2, 0); continue; }
    if (b.id === 'kiddie_sweets') { H.stripedCyl(grp, 2.6, 2.8, 12, '#F4A7B9', '#FFFFFF', { rt: 3.0 }, 0, 1.4, 0); H.sph(grp, 3.0, '#FFF4E0', {}, 0, 3.0, 0, 1, 0.7, 1); for (let k = 0; k < 10; k++) H.sph(grp, 0.18, ['#E74C3C', '#A8D8EA', '#FFE08A', '#B8E0B0'][k % 4], {}, Math.cos(k) * 1.8, 4.6 - (k % 3) * 0.2, Math.sin(k) * 1.8); H.sph(grp, 0.5, '#D7263D', {}, 0, 5.2, 0); continue; }
    if (b.kind === 'food_court') { H.box(grp, b.w, b.h * 0.45, b.d, '#FFF4E0', { pattern: 'stripes', acc: '#D7263D' }, 0, b.h * 0.225, 0); const roof = new THREE.ConeGeometry(Math.hypot(b.w, b.d) / 2 * 1.02, b.h * 0.6, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1, 1, b.d / b.w); const rg = roof.toNonIndexed(); colourByAngle(rg, 4, '#D7263D', '#FFF4E0'); rg.computeVertexNormals(); H.add(grp, H.mesh(rg, K.IM({ pattern: S === 'tin' ? 'stripes' : 'plain', acc: '#e8e0d0', flat: true })), 0, b.h * 0.45 + b.h * 0.3, 0);
      for (let k = 0; k < 4; k++) { const xx = -b.w / 2 + (k + 0.5) * b.w / 4; H.box(grp, 4, 1.6, 0.3, '#2E294E', {}, xx, 1.9, b.d / 2 + 0.05); H.box(grp, 4.6, 0.3, 1.2, '#F4B942', {}, xx, 1.1, b.d / 2 + 0.6); }
      for (const sx of [-1, 1]) H.cyl(grp, 0.08, 0.08, 4, '#ffffff', {}, sx * b.w / 2, b.h + 1.5, 0); H.bulbs(grp, Array.from({ length: 40 }, (_, i) => [-b.w / 2 + i * b.w / 39, b.h * 0.45, b.d / 2 + 0.2])); continue; }
    if (b.kind === 'water_tower') { H.cyl(grp, b.w * 0.45, b.w * 0.45, b.h * 0.35, '#8B6B4A', { pattern: 'planks', acc: '#6B4A2E' }, 0, b.h * 0.72, 0); H.cone(grp, b.w * 0.5, b.h * 0.15, '#5D3A1A', {}, 0, b.h * 0.97, 0); for (let k = 0; k < 4; k++) { const a = k / 4 * 6.283 + 0.785; H.rod(grp, [Math.cos(a) * b.w * 0.45, 0, Math.sin(a) * b.w * 0.45], [Math.cos(a) * b.w * 0.35, b.h * 0.55, Math.sin(a) * b.w * 0.35], 0.25, '#6B4A2E'); } continue; }
    if (b.kind === 'lighthouse_folly') { H.stripedCyl(grp, b.w * 0.35, b.h * 0.8, 1, '#ffffff', '#ffffff', { rt: b.w * 0.25 }, 0, b.h * 0.4, 0); for (let k = 0; k < 3; k++) H.cyl(grp, b.w * 0.33 - k * 0.03 * b.w, b.w * 0.35 - k * 0.03 * b.w, b.h * 0.09, '#C0392B', {}, 0, b.h * (0.12 + k * 0.25), 0); H.cyl(grp, b.w * 0.3, b.w * 0.3, b.h * 0.1, '#BFE3F0', { kind: 'glass' }, 0, b.h * 0.85, 0); H.cone(grp, b.w * 0.36, b.h * 0.14, '#C0392B', {}, 0, b.h * 0.97, 0); continue; }
    // generic building: body with facade on the front face
    const isMS = b.kind === 'main_street_shop'; const h = b.h;
    const fac = (hi || isMS) ? facadeTex(W, Object.assign({ wall }, b), b.w, h) : null;
    const wm = K.M(wall, S === 'tin' ? { pattern: 'plain', forceMap: true } : {}); const fm = fac ? matWithMap(W, fac) : wm;
    const body = H.mesh(H.G.box(b.w, h, b.d, S === 'felt' ? 0.5 : S === 'tin' ? 0.12 : 0), [wm, wm, K.M(shade(wall, 0.8)), wm, fm, wm]); body.position.y = h / 2; grp.add(body);
    const roofT = b.roof || ({ bandstand: 'dome', ticket_booth: 'dome', entrance_arch: 'flat', food_court: 'hipped', railway_station: 'gable', first_aid: 'gable', restroom: 'hipped', frontier_building: 'false_front', boathouse: 'gable', shop: 'gable', food_kiosk: 'hipped' }[b.kind] || 'gable');
    const rc = isMS ? (b.palette === 'main_street' ? '#4E5D6C' : '#4E5D6C') : (b.kind === 'restroom' ? '#6B5B53' : b.kind === 'first_aid' ? '#2E7D4F' : b.kind === 'ticket_booth' ? '#2F6E8E' : b.kind === 'food_kiosk' ? '#2E86C1' : '#6B5B53');
    roofOn(W, H, grp, roofT, b.w, b.d, h, rc, b.trim || '#FFFFFF');
    if (b.awning) { // 3D striped awning on the front
      const aw = H.mesh(awningGeo(b.w * 0.92, 2.0, 0.5), K.M('#ffffff', { pattern: 'stripes', acc: b.awning, rep: [Math.round(b.w / 2), 1] })); aw.position.set(0, (b.storey_heights ? b.storey_heights[0] : 4) * 0.8, b.d / 2); grp.add(aw);
      for (const sx of [-1, 1]) H.rod(grp, [sx * b.w * 0.44, 0, b.d / 2 + 1.9], [sx * b.w * 0.44, (b.storey_heights ? b.storey_heights[0] : 4) * 0.8 - 0.5, b.d / 2 + 1.9], 0.04, '#2D4A3A'); }
    if (isMS || b.kind === 'guest_services') { // cornice + parapet / flags
      H.box(grp, b.w + 0.6, 0.5, b.d + 0.6, b.trim || '#FFFFFF', {}, 0, h + 0.1, 0);
      if (S === 'paper') { const pts = []; const n = 7; for (let i = 0; i <= n; i++) { const u = i / n; pts.push([-b.w / 2 + u * b.w, 0.9 + Math.sin(u * Math.PI) * 1.4 + (i % 2) * 0.3]); } pts.push([b.w / 2, 0], [-b.w / 2, 0]); const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); const pg = new THREE.ExtrudeGeometry(sh, { depth: 0.15, bevelEnabled: false }); const pm = H.mesh(pg, [K.M(wall), K.edge(wall)]); pm.position.set(0, h + 0.3, b.d / 2 - 0.2); grp.add(pm); }
      else { const pc = new THREE.Group(); grp.add(pc); for (let k = 0; k < Math.round(b.w / 1.5); k++) H.box(pc, 0.3, 0.7, 0.3, b.trim || '#FFFFFF', {}, -b.w / 2 + 0.6 + k * (b.w - 1.2) / Math.max(1, Math.round(b.w / 1.5) - 1), h + 0.7, b.d / 2); H.box(pc, b.w, 0.25, 0.4, b.trim || '#FFFFFF', {}, 0, h + 1.15, b.d / 2); if (hash1(x) < 0.4) { H.cyl(pc, 0.05, 0.05, 2.5, '#ffffff', {}, 0, h + 2.2, b.d / 2 - 1); } }
      if (hi && b.window_boxes) { const n = Math.max(1, Math.round(b.w / 2.6)); for (let s = 1; s < (b.storey_heights || []).length; s++) { const yy = b.storey_heights.slice(0, s).reduce((a, c) => a + c, 0) + b.storey_heights[s] * 0.25; for (let k = 0; k < n; k++) { const cx = -b.w / 2 + (k + 0.5) * b.w / n; H.box(grp, Math.min(1.2, b.w / n * 0.6), 0.25, 0.35, '#6B4A2E', {}, cx, yy, b.d / 2 + 0.15); H.sph(grp, 0.28, ['#E74C3C', '#F5A6C8', '#F1C40F'][k % 3], {}, cx, yy + 0.25, b.d / 2 + 0.2, 1.8, 0.6, 0.8); } } }
    }
    if (b.kind === 'first_aid' && hi) { H.box(grp, 1.2, 1.2, 0.1, '#2E7D4F', {}, 0, h - 1.0, b.d / 2 + 0.06); H.box(grp, 0.8, 0.25, 0.12, '#ffffff', {}, 0, h - 1.0, b.d / 2 + 0.08); H.box(grp, 0.25, 0.8, 0.12, '#ffffff', {}, 0, h - 1.0, b.d / 2 + 0.08); }
    if (b.kind === 'frontier_building') { H.box(grp, b.w, h * 0.45, 0.4, wall, { pattern: 'planks', acc: '#7a3f20' }, 0, h + h * 0.2, b.d / 2 - 0.2); H.box(grp, b.w, 0.3, 2.4, '#5D3A1A', {}, 0, 3.0, b.d / 2 + 1.2); for (const sx of [-1, 1]) H.cyl(grp, 0.12, 0.12, 3, '#DEB887', {}, sx * (b.w / 2 - 0.3), 1.5, b.d / 2 + 2.2); }
  }
  // railway bridge + station (simplified)
  { const g = new THREE.Group(); group('buildings').add(g); H.box(g, 22, 1.0, 8, '#4E5D6C', { pattern: S === 'tin' ? 'plain' : 'plain' }, 0, 5.0, 160); for (const sx of [-11.5, 11.5]) H.box(g, 3, 5, 16, '#B5563F', { pattern: 'bricks', acc: '#8E3F2E' }, sx, 2.5, 160); H.rivets(g, Array.from({ length: 22 }, (_, i) => [-10 + i * 20 / 21, 4.6, 164.05])); piece(W, g, 0, 160, { cat: 'building', id: 'bridge' }); }
}
function matWithMap(W, tex) { const { S, K } = W; let m; if (S === 'felt') { m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 1, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#fff6ea') }); K.detail(m); } else if (S === 'tin') { m = new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.5, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.15 }); K.detail(m); } else { m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93 }); K.detail(m); } return m; }
function awningGeo(w, d, drop) { const g = new THREE.PlaneGeometry(w, d, 8, 2); g.rotateX(-Math.PI / 2 + 0.45); g.translate(0, -Math.sin(0.45) * d / 2, d / 2 * Math.cos(0.45)); const sc = new THREE.PlaneGeometry(w, drop, 16, 1); const P = sc.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) < 0) P.setY(i, -drop / 2 + Math.abs(Math.sin(P.getX(i) / w * Math.PI * 8)) * drop * 0.5); sc.translate(0, -drop / 2 - Math.sin(0.45) * d, d * Math.cos(0.45)); return merge([g, sc]); }
function roofOn(W, H, grp, type, w, d, h, rc, trim) {
  const { S, K } = W; const pat = S === 'tin' ? 'stripes' : 'plain'; const m = K.M(rc, { pattern: pat, acc: shade(rc, 0.85), side: true });
  if (type === 'flat_cornice' || type === 'flat') return H.box(grp, w + 0.4, 0.4, d + 0.4, rc, {}, 0, h + 0.2, 0);
  if (type === 'dome' || type === 'corner_turret_dome') { H.box(grp, w + 0.4, 0.4, d + 0.4, trim, {}, 0, h + 0.2, 0); const s = H.sph(grp, Math.min(w, d) * 0.42, rc, {}, 0, h + 0.3, 0, 1, 0.9, 1); return s; }
  if (type === 'hipped' || type === 'mansard' || type === 'cone') { const g = new THREE.ConeGeometry(0.71, 1, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 0.5, 0); const r = H.mesh(g, m); r.scale.set(w + 0.8, Math.min(w, d) * 0.4, d + 0.8); r.position.y = h; grp.add(r); return r; }
  if (type === 'false_front') return H.box(grp, w + 0.3, 0.4, d + 0.3, rc, {}, 0, h + 0.2, 0);
  // gable along x
  const v = [-0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0]; const idx = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); const g2 = g.toNonIndexed(); g2.computeVertexNormals();
  const uv = new Float32Array(g2.attributes.position.count * 2); for (let i = 0; i < g2.attributes.position.count; i++) { uv[2 * i] = g2.attributes.position.getX(i) + 0.5; uv[2 * i + 1] = g2.attributes.position.getY(i) + g2.attributes.position.getZ(i); } g2.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const r = H.mesh(g2, m); r.scale.set(w + 0.8, Math.min(w, d) * 0.45, d + 0.8); r.position.y = h; grp.add(r); return r;
}
function booths(W, H, grp, b) {
  const { S, K } = W; const plush = ['#F5A6C8', '#A8D8EA', '#FFE08A', '#B8E0B0', '#C3A6E0', '#E74C3C', '#ffffff'];
  for (const it of b.items) {
    const g = new THREE.Group(); g.position.set(it.position[0], 0, it.position[2]); g.rotation.y = it.rot || 0; grp.add(g);
    piece(W, g, it.position[0], it.position[2], { cat: 'booth', id: b.id, kind: 'booth' });
    const w = it.w, d = it.d, h = it.h; const aw = it.awning;
    H.box(g, w, h * 0.85, 0.2, '#FFF4E0', { pattern: 'stripes', acc: aw }, 0, h * 0.425, -d / 2 + 0.1); for (const sx of [-1, 1]) H.box(g, 0.2, h * 0.85, d, '#FFF4E0', { pattern: 'hstripes', acc: aw }, sx * (w / 2 - 0.1), h * 0.425, 0);
    H.box(g, w, 1.0, 0.5, aw, { pattern: S === 'paper' ? 'plain' : 'diamond', acc: '#F4B942' }, 0, 0.5, d / 2 - 0.25); H.box(g, w + 0.1, 0.1, 0.7, '#8E5B3A', {}, 0, 1.05, d / 2 - 0.25);
    H.box(g, w - 0.4, 0.08, 0.5, '#8E5B3A', {}, 0, 1.9, -d / 2 + 0.5); H.box(g, w - 0.4, 0.08, 0.5, '#8E5B3A', {}, 0, 2.6, -d / 2 + 0.5);
    const R = rng(it.position[0] * 13);
    for (let k = 0; k < 9; k++) { const yy = k < 5 ? 2.15 : 2.85; const xx = -w / 2 + 0.6 + (k % 5) * (w - 1.2) / 4; H.sph(g, 0.22, plush[(R() * 7) | 0], {}, xx, yy, -d / 2 + 0.5); }
    for (let k = 0; k < 5; k++) H.cyl(g, 0.12, 0.12, 0.25, ['#ffffff', '#E74C3C', '#F1C40F'][k % 3], {}, -w / 2 + 0.8 + k * 0.85, 1.25, d / 2 - 0.25);
    const awg = H.mesh(awningGeo(w + 0.3, 1.6, 0.45), K.M('#ffffff', { pattern: 'stripes', acc: aw, rep: [3, 1], side: true })); awg.position.set(0, h, d / 2 - 0.1); g.add(awg);
    H.box(g, w + 0.3, 0.6, 0.15, '#F4B942', {}, 0, h + 0.05, d / 2 - 0.15); H.bulbs(g, Array.from({ length: 9 }, (_, i) => [-w / 2 + i * w / 8, h + 0.05, d / 2 - 0.05]));
    H.box(g, w, 0.15, d, '#ffffff', {}, 0, h * 0.85 + 0.05, 0);
  }
}

// ---------------------------------------------------------------------------------------------- FLAT RIDES
export function buildRides(W) {
  const { D, S, K, lodOf, group, park } = W; const H = mk(W);
  for (const r of D.rides) {
    const p = r.params || {}; if (!r.position || r.track || r.id === 'lake_boats' || r.type === 'perimeter_railway') continue; const [x, y0, z] = r.position; const lod = lodOf(x, z); if (lod > 2) continue;
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = r.rot || 0; group('rides').add(g); piece(W, g, x, z, { cat: 'ride', id: r.id, kind: r.type, land: r.land });
    const A = W.anims;
    switch (r.type) {
      case 'carousel': {
        const R0 = p.radius; H.cyl(g, R0 + 0.6, R0 + 0.8, 0.6, '#8E5B3A', { pattern: S === 'paper' ? 'plain' : 'planks', acc: '#6B4A2E', seg: 32 }, 0, 0.3, 0); for (let k = 0; k < 3; k++) H.cyl(g, R0 + 1.6 - k * 0.4, R0 + 1.7 - k * 0.4, 0.2, '#F4EBD9', { seg: 32 }, 0, 0.1 + k * 0.2, 0);
        const top = new THREE.Group(); g.add(top);
        H.cyl(top, R0, R0, 0.25, '#FFF4E0', { seg: 32 }, 0, 0.75, 0);
        H.cyl(top, 1.6, 1.6, p.height - 2.2, '#F4B942', { pattern: 'diamond', acc: '#D7263D', seg: 16 }, 0, (p.height - 2.2) / 2 + 0.8, 0); // mirrored drum
        if (S !== 'paper') for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; H.box(top, 0.6, 2.2, 0.06, '#d8eef8', { kind: 'glass' }, Math.cos(a) * 1.63, 2.6, Math.sin(a) * 1.63, 0, -a + Math.PI / 2, 0); }
        H.stripedCone(top, R0 + 0.9, 3.0, 24, p.colors.canopy[0], p.colors.canopy[1], {}, 0, p.height - 1.2, 0);
        H.stripedCyl(top, R0 + 0.85, 1.2, 24, '#F4B942', '#F4B942', {}, 0, p.height - 3.3, 0); H.scallop(top, R0 + 0.9, 0.9, 24, p.colors.canopy[0], p.height - 4.1);
        H.bulbs(top, [...H.ring(48, R0 + 0.9, p.height - 3.0), ...H.ring(48, R0 + 0.9, p.height - 3.55), ...H.ring(24, R0 * 0.62, p.height - 1.2 + 0.4 * 1.5)]);
        H.sph(top, 0.5, '#F4B942', {}, 0, p.height + 0.5, 0); H.cyl(top, 0.06, 0.06, 1.5, '#F4B942', {}, 0, p.height + 1.2, 0);
        const horses = []; const nPer = p.figures / p.rows; const hg = horseGeo(S);
        for (let row = 0; row < p.rows; row++) for (let k = 0; k < nPer; k++) { const a = (k + row * 0.5) / nPer * 6.283; const rr = R0 - 1.2 - row * 1.8;
          const pole = H.cyl(top, 0.05, 0.05, p.height - 4.2, '#F4B942', { kind: 'brass', seg: 6 }, Math.cos(a) * rr, (p.height - 4.2) / 2 + 0.85, Math.sin(a) * rr);
          const hm = H.mesh(hg, K.IM()); hm.geometry = hg; const hc = p.colors.horses[(k + row) % 4]; hm.material = K.M(hc, { vc: true }); hm.position.set(Math.cos(a) * rr, 1.9, Math.sin(a) * rr); hm.rotation.y = -a; top.add(hm); horses.push(hm); }
        for (let c = 0; c < 2; c++) { const a = c * Math.PI + 0.3; const ch = H.box(top, 1.2, 1.0, 2.0, '#D7263D', { pattern: 'scallop', acc: '#F4B942' }, Math.cos(a) * (R0 - 2.4), 1.4, Math.sin(a) * (R0 - 2.4), 0, -a, 0); }
        A.push((t, ctx) => { if (ctx.frozen && ctx.frozen(r.id)) return; const s = park.flatRide(r.id, ctx.clock ? ctx.clock(t) : t); top.rotation.y = s.angle; horses.forEach((hm, k) => hm.position.y = 1.9 + s.bob(k)); });
        break; }
      case 'teacups': {
        H.cyl(g, p.platform_radius, p.platform_radius + 0.3, 0.6, '#F3E6CC', { seg: 40, pattern: 'check', acc: '#F5A6C8' }, 0, 0.3, 0);
        const main = new THREE.Group(); g.add(main); const subs = []; const cups = [];
        const cupG = cupGeo(S);
        for (let k = 0; k < p.turntables; k++) { const sub = new THREE.Group(); const a = k / p.turntables * 6.283; sub.position.set(Math.cos(a) * 5, 0.62, Math.sin(a) * 5); main.add(sub); subs.push(sub);
          H.cyl(sub, 3.6, 3.6, 0.12, '#A8D8EA', { seg: 32, pattern: 'dots', acc: '#ffffff' }, 0, 0.06, 0);
          for (let c = 0; c < p.cups_per_turntable; c++) { const b = c / p.cups_per_turntable * 6.283; const cm = H.mesh(cupG, K.M(p.colors.cups[(c + k) % 6], { pattern: S === 'paper' ? 'plain' : (c % 2 ? 'dots' : 'stripes'), acc: '#ffffff' })); cm.position.set(Math.cos(b) * 2.4, 0.1, Math.sin(b) * 2.4); cm.scale.setScalar(p.cup_radius / 1.2); sub.add(cm); cups.push(cm);
            H.cyl(cm, 0.18, 0.18, 0.7, '#F4B942', { seg: 8 }, 0, 0.6, 0); H.cyl(cm, 0.45, 0.45, 0.08, '#F4B942', { seg: 12 }, 0, 0.95, 0);
            for (const sx of [-0.5, 0.5]) { const gg = { kind: 'walk' }; } } }
        H.cyl(main, 0.8, 0.8, 2.5, '#F5A6C8', { pattern: 'stripes', acc: '#ffffff' }, 0, 1.6, 0); H.sph(main, 1.0, '#FFE08A', {}, 0, 3.1, 0, 1, 0.6, 1);
        A.push((t, ctx) => { if (ctx.frozen && ctx.frozen(r.id)) return; const tt = ctx.clock ? ctx.clock(t) : t; const s = park.flatRide(r.id, tt); main.rotation.y = s.main; subs.forEach(sb => sb.rotation.y = s.sub); cups.forEach((c, k) => c.rotation.y = s.cup(k)); });
        break; }
      case 'bumper_car_pavilion': {
        const w = p.w, d = p.d, h = p.h; H.box(g, w, 0.3, d, '#9AA3AD', { kind: 'metal', pattern: S === 'tin' ? 'plain' : 'check', acc: '#8a929a' }, 0, 0.15, 0);
        H.box(g, w, 0.9, 0.5, '#F4B942', { pattern: 'hstripes', acc: '#1C1C1C' }, 0, 0.6, -d / 2 + 0.25); for (const sx of [-1, 1]) H.box(g, 0.5, 0.9, d, '#F4B942', { pattern: 'stripes', acc: '#1C1C1C' }, sx * (w / 2 - 0.25), 0.6, 0);
        H.box(g, w + 1.2, 0.8, d + 1.2, p.colors.roof, { pattern: S === 'paper' ? 'plain' : 'stars', acc: '#F4B942' }, 0, h, 0); for (let k = 0; k < 6; k++) H.box(g, (w + 1.2) / 6 - 0.4, 0.25, d + 1.3, k % 2 ? '#F4B942' : '#D7263D', {}, -(w + 1.2) / 2 + (k + 0.5) * (w + 1.2) / 6, h + 0.5, 0); H.box(g, w + 1.4, 1.4, 0.3, p.colors.fascia, { pattern: S === 'paper' ? 'plain' : 'scallop', acc: '#D7263D' }, 0, h - 0.6, d / 2 + 0.6);
        H.bulbs(g, Array.from({ length: 50 }, (_, i) => [-w / 2 + i * w / 49, h - 0.6, d / 2 + 0.8]));
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1]]) H.cyl(g, 0.3, 0.3, h, '#F4B942', { pattern: 'stripes', acc: '#D7263D' }, sx * (w / 2 - 0.3), h / 2, sz * (d / 2 - 0.3));
        const grid = new THREE.Group(); g.add(grid); for (let k = 0; k <= 12; k++) H.box(grid, 0.08, 0.08, d, '#5a5a5a', { kind: 'metal' }, -w / 2 + k * w / 12, h - 0.5, 0);
        const cars = []; const cg = bumperGeo(S);
        for (let k = 0; k < p.cars; k++) { const c = new THREE.Group(); g.add(c); const body = H.mesh(cg, K.M(p.colors.cars[k % 4], { vc: true })); c.add(body); H.cyl(c, 0.04, 0.04, h - 1.3, '#cccccc', { kind: 'metal', seg: 5 }, 0, (h - 1.3) / 2 + 0.9, -0.6); cars.push(c); }
        A.push((t, ctx) => { const tt = ctx.clock ? ctx.clock(t) : t; cars.forEach((c, k) => { const a = tt * (0.25 + hash1(k) * 0.2) + k * 2.1; const rx = (w / 2 - 2.5), rz = (d / 2 - 2.5); c.position.set(Math.sin(a * 1.3 + k) * rx * (0.5 + 0.5 * hash1(k + 3)), 0.3, Math.cos(a * 0.9 + k * 0.7) * rz * (0.5 + 0.5 * hash1(k + 7))); const dx = Math.cos(a * 1.3 + k) * 1.3 * rx, dz = -Math.sin(a * 0.9 + k * 0.7) * 0.9 * rz; c.rotation.y = Math.atan2(dx, dz); }); });
        break; }
      case 'ferris_wheel': {
        const R0 = p.diameter / 2, hub = p.hub_height; const wheel = new THREE.Group(); wheel.position.set(0, hub, 0); g.add(wheel);
        if (S === 'paper') { // cut card wheel with holes
          const sh = new THREE.Shape(); sh.absarc(0, 0, R0 + 0.6, 0, Math.PI * 2, false); const n = p.spokes; for (let k = 0; k < n; k++) { const a0 = k / n * 6.283 + 0.035, a1 = (k + 1) / n * 6.283 - 0.035; const hp = new THREE.Path(); hp.moveTo(Math.cos(a0) * 2.2, Math.sin(a0) * 2.2); hp.absarc(0, 0, R0 - 0.6, a0 + 0.012, a1 - 0.012, false); hp.lineTo(Math.cos(a1) * 2.2, Math.sin(a1) * 2.2); sh.holes.push(hp); }
          for (const zz of [-p.rim_spacing / 2, p.rim_spacing / 2]) { const m = H.mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false, curveSegments: 4 }), [K.M('#ffffff'), K.edge('#ffffff')]); m.position.z = zz; wheel.add(m); } }
        else { for (const zz of [-p.rim_spacing / 2, p.rim_spacing / 2]) { H.torus(wheel, R0, 0.28, '#ffffff', { ts: 96, rs: 8 }, 0, 0, zz); H.torus(wheel, R0 * 0.62, 0.16, '#ffffff', { ts: 64 }, 0, 0, zz); for (let k = 0; k < p.spokes; k++) { const a = k / p.spokes * 6.283; H.rod(wheel, [0, 0, zz], [Math.cos(a) * R0, Math.sin(a) * R0, zz], 0.09, '#ffffff'); } }
          for (let k = 0; k < p.spokes; k += 2) { const a = k / p.spokes * 6.283; H.rod(wheel, [Math.cos(a) * R0, Math.sin(a) * R0, -p.rim_spacing / 2], [Math.cos(a) * R0, Math.sin(a) * R0, p.rim_spacing / 2], 0.08, '#ffffff'); }
          H.bulbs(wheel, [...H.ring(60, R0 + 0.35, 0).map(q => [q[0], q[2], p.rim_spacing / 2 + 0.2])]); }
        H.cyl(wheel, 1.4, 1.4, p.rim_spacing + 1.4, '#F4B942', { seg: 16 }, 0, 0, 0, Math.PI / 2);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) H.rod(g, [sx * 13, 0, sz * 5], [0, hub, sz * (p.rim_spacing / 2 + 0.7)], 0.45, '#ffffff', { seg: 10 });
        H.box(g, 30, 0.6, 12, '#B08A5A', { pattern: 'planks', acc: '#6F5333' }, 0, 0.3, 0);
        const gond = []; const gcols = p.colors.gondolas;
        for (let k = 0; k < p.gondolas; k++) { const gd = new THREE.Group(); g.add(gd); const c = gcols[k % gcols.length];
          H.box(gd, 1.8, 1.0, 1.8, c, { pattern: S === 'paper' ? 'plain' : 'hstripes', acc: '#ffffff' }, 0, -1.6, 0); H.cyl(gd, 1.15, 1.15, 0.2, c, { seg: 16 }, 0, -0.35, 0); H.cone(gd, 1.15, 0.55, c, { seg: 16 }, 0, -0.0, 0); for (const sx of [-0.8, 0.8]) for (const sz of [-0.8, 0.8]) H.cyl(gd, 0.04, 0.04, 1.2, '#ffffff', { seg: 4 }, sx, -0.95, sz); gond.push(gd); }
        A.push((t) => { const a = park.flatRide(r.id, t).angle; wheel.rotation.z = a; gond.forEach((gd, k) => { const b = a + k / p.gondolas * 6.283; gd.position.set(Math.cos(b) * R0, hub + Math.sin(b) * R0 - 0.3, 0); }); });
        break; }
      case 'swing_ride': {
        H.cyl(g, 4, 4.4, 0.6, '#2E86C1', { seg: 24, pattern: 'stripes', acc: '#ffffff' }, 0, 0.3, 0); H.cyl(g, 0.7, 0.9, p.mast_height, '#ffffff', { pattern: 'hstripes', acc: '#2E86C1' }, 0, p.mast_height / 2, 0);
        const top = new THREE.Group(); top.position.y = p.mast_height; g.add(top); top.rotation.z = (p.tilt_deg || 8) * Math.PI / 180;
        const spin = new THREE.Group(); top.add(spin);
        H.stripedCone(spin, p.canopy_radius + 0.5, 2.6, 16, '#ffffff', '#2E86C1', {}, 0, 1.3, 0); H.scallop(spin, p.canopy_radius + 0.45, 0.7, 16, '#2E86C1', -0.2); H.sph(spin, 0.5, '#F4B942', {}, 0, 2.8, 0);
        const chairs = []; for (let k = 0; k < p.chairs; k++) { const c = new THREE.Group(); spin.add(c); H.box(c, 0.6, 0.15, 0.6, ['#E74C3C', '#F1C40F', '#2E86C1', '#2ECC71'][k % 4], {}, 0, 0, 0); H.box(c, 0.6, 0.5, 0.1, ['#E74C3C', '#F1C40F', '#2E86C1', '#2ECC71'][k % 4], {}, 0, 0.25, -0.28); const ch = H.cyl(c, 0.015, 0.015, p.chain_length, '#cccccc', { seg: 3, kind: 'metal' }, 0, p.chain_length / 2, 0); chairs.push(c); }
        A.push((t) => { const s = park.flatRide(r.id, t); spin.rotation.y = s.angle; const ang = s.chairAngleDeg * Math.PI / 180; chairs.forEach((c, k) => { const a = k / p.chairs * 6.283; const rr = p.canopy_radius - 0.3 + Math.sin(ang) * p.chain_length; c.position.set(Math.cos(a) * rr, -Math.cos(ang) * p.chain_length, Math.sin(a) * rr); c.rotation.set(0, -a, 0); c.rotateZ(ang); }); });
        break; }
      case 'pirate_ship': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) H.rod(g, [sx * 7, 0, sz * 4], [0, p.pivot_height, sz * 2], 0.4, p.colors.frame, { seg: 8 });
        H.cyl(g, 0.5, 0.5, 5, '#5a5a5a', { kind: 'metal' }, 0, p.pivot_height, 0, Math.PI / 2);
        const piv = new THREE.Group(); piv.position.y = p.pivot_height; g.add(piv);
        const hull = new THREE.Group(); hull.position.y = -p.pivot_height + 3.2; piv.add(hull);
        const hs = new THREE.Shape(); const L = p.boat_length; hs.moveTo(-L / 2 - 1, 2.2); hs.quadraticCurveTo(-L / 2, -1.0, 0, -1.6); hs.quadraticCurveTo(L / 2, -1.0, L / 2 + 1, 2.2); hs.lineTo(L / 2 - 0.5, 1.6); hs.lineTo(-L / 2 + 0.5, 1.6); hs.closePath();
        const hg = new THREE.ExtrudeGeometry(hs, { depth: 4, bevelEnabled: S !== 'paper', bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 2 }); hg.translate(0, 0, -2);
        H.add(hull, H.mesh(hg, S === 'paper' ? [K.M(p.colors.hull), K.edge(p.colors.hull)] : K.M(p.colors.hull, { pattern: 'planks', acc: '#6B4A2E' })));
        H.box(hull, L - 1, 0.3, 4.2, p.colors.stripe, {}, 0, 1.3, 0); for (let k = 0; k < 8; k++) H.box(hull, 0.3, 0.8, 4.0, '#6B4A2E', {}, -L / 2 + 2 + k * (L - 4) / 7, 1.8, 0);
        H.rod(piv, [0, 0, 0], [0, -p.pivot_height + 5, 0], 0.25, '#ffffff'); const mast = H.cyl(hull, 0.2, 0.25, 7, '#6B4A2E', {}, 0, 5, 0); const sail = H.box(hull, 0.1, 4, 5, '#ffffff', {}, 0, 6, 0, 0, Math.PI / 2, 0);
        A.push((t) => { piv.rotation.z = park.flatRide(r.id, t).swingDeg * Math.PI / 180; });
        break; }
      case 'drop_tower': {
        H.cyl(g, 4, 4.5, 1.0, '#1F2A44', { seg: 24 }, 0, 0.5, 0);
        if (S === 'paper') H.box(g, p.mast_radius * 2, p.height, p.mast_radius * 2, p.colors.mast, {}, 0, p.height / 2, 0);
        else { H.cyl(g, p.mast_radius, p.mast_radius, p.height, p.colors.mast, { seg: 12, pattern: S === 'tin' ? 'hstripes' : 'plain', acc: '#2b3a5c' }, 0, p.height / 2, 0); for (let k = 0; k < Math.floor(p.height / 6); k++) H.torus(g, p.mast_radius + 0.08, 0.1, '#F5B700', { ts: 16, rs: 4 }, 0, 3 + k * 6, 0, Math.PI / 2); }
        H.cyl(g, 2.6, 2.6, 2.0, '#E23B2E', { seg: 16 }, 0, p.height + 1, 0); H.cone(g, 2.6, 4, '#E23B2E', { seg: 16 }, 0, p.height + 4, 0);
        const ring = new THREE.Group(); g.add(ring); H.torus(ring, p.ring_radius, 0.5, p.colors.ring, { ts: 32 }, 0, 0, 0, Math.PI / 2); for (let k = 0; k < p.seats; k++) { const a = k / p.seats * 6.283; H.box(ring, 0.7, 1.1, 0.6, p.colors.seats, {}, Math.cos(a) * (p.ring_radius + 0.6), -0.6, Math.sin(a) * (p.ring_radius + 0.6), 0, -a, 0); }
        A.push((t) => { ring.position.y = park.flatRide(r.id, t).y; });
        break; }
      case 'observation_tower': {
        H.cyl(g, 6, 7, 1.2, '#D9C9A8', { seg: 32 }, 0, 0.6, 0);
        H.cyl(g, p.mast_radius, p.mast_radius * 1.15, p.height, p.colors.mast, { seg: 20, pattern: S === 'paper' ? 'plain' : 'hstripes', acc: '#f0f0f0' }, 0, p.height / 2, 0);
        for (let k = 0; k < 6; k++) H.cyl(g, p.mast_radius * 1.08, p.mast_radius * 1.08, 1.2, p.colors.bands, { seg: 20 }, 0, 8 + k * 10, 0);
        H.cyl(g, 3.5, 2.4, 2.5, '#E2B33C', { seg: 20 }, 0, p.height + 1.0, 0); H.cone(g, 2.4, 9, '#E2B33C', { seg: 16, kind: 'brass' }, 0, p.height + 6.5, 0); H.sph(g, 0.6, '#E2B33C', { kind: 'brass' }, 0, p.height + 11.3, 0);
        H.bulbs(g, H.ring(24, 3.6, p.height + 2.2));
        const cab = new THREE.Group(); g.add(cab); H.cyl(cab, p.cabin_radius, p.cabin_radius, 0.4, p.colors.cabin, { seg: 32 }, 0, 0, 0); H.cyl(cab, p.cabin_radius - 0.1, p.cabin_radius - 0.1, p.cabin_height - 0.6, '#9FD3E8', { kind: 'glass', seg: 32 }, 0, p.cabin_height / 2, 0); H.cyl(cab, p.cabin_radius + 0.2, p.cabin_radius, 0.5, p.colors.cabin, { seg: 32 }, 0, p.cabin_height, 0);
        A.push((t) => { const s = park.flatRide(r.id, t); cab.position.y = s.y; cab.rotation.y = s.angle; });
        break; }
      case 'kiddie_planes': {
        H.cyl(g, p.radius + 1.5, p.radius + 1.7, 0.5, p.colors[1], { seg: 32, pattern: 'dots', acc: '#ffffff' }, 0, 0.25, 0);
        H.cyl(g, 0.6, 0.8, 3.6, p.colors[0], { pattern: 'stripes', acc: '#ffffff' }, 0, 2.0, 0); H.stripedCone(g, 1.6, 1.4, 8, p.colors[2], '#ffffff', {}, 0, 4.4, 0); H.sph(g, 0.35, '#F4B942', {}, 0, 5.2, 0);
        const hub = new THREE.Group(); hub.position.y = 3.2; g.add(hub); const planes = [];
        for (let k = 0; k < p.arms; k++) { const a = k / p.arms * 6.283; const arm = new THREE.Group(); arm.rotation.y = -a; hub.add(arm); H.rod(arm, [0, 0, 0], [p.radius, -1.0, 0], 0.07, '#ffffff'); const pl = new THREE.Group(); pl.position.set(p.radius, -1.3, 0); arm.add(pl); const c = p.colors[k % 4];
          H.sph(pl, 0.55, c, {}, 0, 0, 0, 1, 0.75, 2.2); H.box(pl, 2.6, 0.12, 0.6, c, { pattern: 'hstripes', acc: '#ffffff' }, 0, 0.1, 0.1); H.box(pl, 1.0, 0.1, 0.35, c, {}, 0, 0.2, -1.05); H.box(pl, 0.08, 0.5, 0.35, c, {}, 0, 0.4, -1.05); const prop = H.box(pl, 0.9, 0.12, 0.06, '#ffffff', {}, 0, 0, 1.25); H.sph(pl, 0.2, '#F4B942', {}, 0, 0, 1.25); planes.push({ arm, prop }); }
        A.push((t, ctx) => { if (ctx.frozen && ctx.frozen(r.id)) return; const tt = ctx.clock ? ctx.clock(t) : t; hub.rotation.y = tt * 6.283 / p.period_s; hub.position.y = 3.2 + Math.sin(tt * 0.8) * 0.6; planes.forEach(q => q.prop.rotation.z = tt * 30); });
        break; }
      case 'kiddie_boats': {
        H.cyl(g, p.pool_radius + 0.8, p.pool_radius + 1.0, 0.7, '#A8D8EA', { seg: 40, pattern: 'scallop', acc: '#ffffff' }, 0, 0.35, 0); H.cyl(g, p.pool_radius, p.pool_radius, 0.1, '#6FB3DA', { seg: 40, pattern: 'waves', acc: '#9ED0EC' }, 0, 0.55, 0);
        H.cyl(g, 1.2, 1.2, 1.4, '#FFE08A', { pattern: 'stripes', acc: '#ffffff' }, 0, 1.0, 0); H.stripedCone(g, 1.8, 1.6, 8, '#F4A7B9', '#ffffff', {}, 0, 2.4, 0);
        const spin = new THREE.Group(); g.add(spin); for (let k = 0; k < p.boats; k++) { const a = k / p.boats * 6.283; const b = new THREE.Group(); b.position.set(Math.cos(a) * (p.pool_radius - 2), 0.75, Math.sin(a) * (p.pool_radius - 2)); b.rotation.y = -a; spin.add(b); const c = p.colors[k % 3]; H.sph(b, 0.7, c, {}, 0, 0, 0, 0.8, 0.5, 1.6); H.box(b, 0.8, 0.5, 0.6, '#ffffff', {}, 0, 0.35, -0.3); H.cyl(b, 0.04, 0.04, 1.2, '#ffffff', {}, 0, 0.8, 0.4); H.cone(b, 0.35, 0.5, '#E74C3C', {}, 0.1, 1.25, 0.4, 0, 0, -1.57); }
        A.push((t, ctx) => { if (ctx.frozen && ctx.frozen(r.id)) return; const tt = ctx.clock ? ctx.clock(t) : t; spin.rotation.y = tt * 6.283 / p.period_s; });
        break; }
      case 'kiddie_trucks': {
        const L = p.oval_length, Wd = p.oval_width; const track = new THREE.Shape(); track.absellipse(0, 0, L / 2 + 1.5, Wd / 2 + 1.5, 0, Math.PI * 2); const hole = new THREE.Path(); hole.absellipse(0, 0, L / 2 - 1.5, Wd / 2 - 1.5, 0, Math.PI * 2, true); track.holes.push(hole);
        const tg = new THREE.ExtrudeGeometry(track, { depth: 0.3, bevelEnabled: false, curveSegments: 32 }); tg.rotateX(-Math.PI / 2); H.add(g, H.mesh(tg, K.M('#5D6D7E', { pattern: S === 'paper' ? 'plain' : 'dots', acc: '#F4F4F4' })));
        const isl = new THREE.Shape(); isl.absellipse(0, 0, L / 2 - 1.5, Wd / 2 - 1.5, 0, Math.PI * 2); const ig = new THREE.ExtrudeGeometry(isl, { depth: 0.5, bevelEnabled: false, curveSegments: 32 }); ig.rotateX(-Math.PI / 2); H.add(g, H.mesh(ig, K.M('#B8E0B0')));
        const trucks = []; for (let k = 0; k < p.trucks; k++) { const tk = new THREE.Group(); g.add(tk); const c = ['#E74C3C', '#F1C40F', '#2E86C1', '#2ECC71', '#F5A6C8', '#E67E22'][k];
          H.box(tk, 1.1, 0.8, 1.3, c, {}, 0, 0.75, 0.6); H.box(tk, 1.1, 0.5, 1.4, c, { pattern: 'check', acc: '#ffffff' }, 0, 0.6, -0.7); H.box(tk, 1.0, 0.45, 0.1, '#BFE3F0', { kind: 'glass' }, 0, 1.0, 1.26); for (const [sx, sz] of [[-0.55, 0.8], [0.55, 0.8], [-0.55, -0.8], [0.55, -0.8]]) H.cyl(tk, 0.28, 0.28, 0.2, '#1C1C1C', { kind: 'rubber', seg: 12 }, sx, 0.3, sz, 0, 0, Math.PI / 2); trucks.push(tk); }
        A.push((t, ctx) => { if (ctx.frozen && ctx.frozen(r.id)) return; const tt = ctx.clock ? ctx.clock(t) : t; trucks.forEach((tk, k) => { const a = tt * 6.283 / p.period_s + k / p.trucks * 6.283; tk.position.set(Math.cos(a) * L / 2, 0.3, Math.sin(a) * Wd / 2); tk.rotation.y = Math.atan2(-Math.sin(a) * L / 2, Math.cos(a) * Wd / 2) + Math.PI; }); });
        break; }
      case 'kiddie_drop_tower': {
        H.cyl(g, 2.5, 2.8, 0.5, '#C3A6E0', { seg: 24, pattern: 'dots', acc: '#ffffff' }, 0, 0.25, 0); H.cyl(g, 0.45, 0.5, p.height, p.colors[0], { pattern: 'hstripes', acc: '#ffffff' }, 0, p.height / 2, 0); H.stripedCone(g, 1.3, 1.6, 8, p.colors[1], '#ffffff', {}, 0, p.height + 0.8, 0); H.sph(g, 0.3, '#F4A7B9', {}, 0, p.height + 1.8, 0);
        const ring = new THREE.Group(); g.add(ring); H.torus(ring, 1.1, 0.25, p.colors[1], { ts: 24 }, 0, 0, 0, Math.PI / 2); for (let k = 0; k < p.seats; k++) { const a = k / p.seats * 6.283; H.box(ring, 0.5, 0.6, 0.45, ['#F4A7B9', '#A8D8EA', '#FFE08A', '#B8E0B0'][k % 4], {}, Math.cos(a) * 1.5, -0.3, Math.sin(a) * 1.5, 0, -a, 0); }
        A.push((t, ctx) => { if (ctx.frozen && ctx.frozen(r.id)) { ring.position.y = 1.2; return; } const tt = ctx.clock ? ctx.clock(t) : t; const u = ((tt % 8) + 8) % 8; ring.position.y = u < 4 ? lerp(1.2, p.height - 1.5, u / 4) : u < 5 ? p.height - 1.5 : u < 5.6 ? lerp(p.height - 1.5, 1.4, ((u - 5) / 0.6) ** 1.6) : 1.2 + Math.abs(Math.sin((u - 5.6) * 8)) * 0.3 * Math.exp(-(u - 5.6) * 3); });
        break; }
      case 'playground': {
        H.box(g, p.w, 0.2, p.d, '#E7B8A6', { pattern: S === 'paper' ? 'plain' : 'dots', acc: '#F4A7B9' }, 0, 0.1, 0);
        // rope pyramid
        const top = [-3.5, 5.0, -2.5]; for (const [cx, cz] of [[-6.5, -5.5], [-0.5, -5.5], [-6.5, 0.5], [-0.5, 0.5]]) H.rod(g, [cx, 0, cz], top, 0.08, '#C9503C');
        for (let k = 1; k < 5; k++) { const u = k / 5; const c = [[-6.5, -5.5], [-0.5, -5.5], [-0.5, 0.5], [-6.5, 0.5]].map(([cx, cz]) => [lerp(cx, top[0], u), top[1] * u, lerp(cz, top[2], u)]); for (let i = 0; i < 4; i++) H.rod(g, c[i], c[(i + 1) % 4], 0.05, '#F4B942'); }
        // slide tower
        H.box(g, 2.4, 3.0, 2.4, '#A8D8EA', { pattern: 'stripes', acc: '#ffffff' }, 3.5, 1.5, -2.5); H.stripedCone(g, 2.0, 1.6, 4, '#F4A7B9', '#ffffff', {}, 3.5, 3.8, -2.5);
        const sl = new THREE.CatmullRomCurve3([new THREE.Vector3(3.5, 3.0, -1.3), new THREE.Vector3(4.6, 2.0, 0.8), new THREE.Vector3(5.6, 0.6, 3.2), new THREE.Vector3(5.8, 0.4, 4.2)]); H.add(g, H.mesh(new THREE.TubeGeometry(sl, 24, 0.55, 10, false), K.M('#FFE08A', { side: true })));
        H.box(g, 4, 0.3, 3, '#F1DCC4', { pattern: 'dots', acc: '#E9C99A' }, -3.5, 0.25, 4.0); // sandpit
        for (let k = 0; k < 3; k++) { const sx = 1 + k * 1.6; H.cyl(g, 0.06, 0.06, 0.6, '#555555', { kind: 'metal' }, sx, 0.4, 4.5); H.sph(g, 0.4, ['#F4A7B9', '#B8E0B0', '#FFE08A'][k], {}, sx, 0.95, 4.5, 0.8, 0.8, 1.4); }
        break; }
      case 'dark_ride_show_building': {
        H.box(g, p.w, p.h, p.d, '#6E7F5E', {}, 0, p.h / 2, 0);
        for (let k = 0; k < 4; k++) H.box(g, p.w - k * 6, 3.5, 3, '#9B8B78', { pattern: S === 'paper' ? 'plain' : 'bricks', acc: '#7d6f5f' }, 0, 1.75 + k * 3.5, p.d / 2 + 1.5 - k * 0.4);
        H.box(g, 7, 6, 3.5, '#2a2a2a', {}, 0, 3, p.d / 2 + 1.8); for (const sx of [-6, 6]) { H.cyl(g, 0.3, 0.3, 3, '#6B4A2E', {}, sx, 1.5, p.d / 2 + 3.4); H.sph(g, 0.5, '#E67E22', { kind: 'bulb' }, sx, 3.3, p.d / 2 + 3.4); }
        break; }
    }
  }
  // lake boats (swans)
  { const lb = D.rides.find(q => q.id === 'lake_boats'); if (lb) { const sw = []; for (const b of lb.params.boats) { const g = new THREE.Group(); group('rides').add(g); const c = b.color || '#ffffff'; H.sph(g, 1.0, c, {}, 0, 0.3, 0, 0.9, 0.6, 1.4); const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.6, 0.9), new THREE.Vector3(0, 1.6, 1.3), new THREE.Vector3(0, 2.2, 1.0), new THREE.Vector3(0, 2.1, 1.5)]); H.add(g, H.mesh(new THREE.TubeGeometry(neck, 10, 0.16, 6), K.M(c))); H.cone(g, 0.1, 0.35, '#E67E22', {}, 0, 2.05, 1.75, Math.PI / 2); sw.push({ g, b }); } W.anims.push(t => { sw.forEach(({ g, b }) => { const a = b.phase + 6.283 * t / b.period_s; g.position.set(b.route_center[0] + Math.cos(a) * b.route_radii[0], -0.5, b.route_center[1] + Math.sin(a) * b.route_radii[1]); g.rotation.y = Math.atan2(-Math.sin(a) * b.route_radii[0], Math.cos(a) * b.route_radii[1]); }); }); } }
}
function horseGeo(S) { const G = geoKit(S); const p = [tint(xf(G.sph(0.5, 12), { s: [0.55, 0.55, 1.1] }), '#ffffff'), tint(xf(G.cyl(0.14, 0.18, 0.7, 8), { p: [0, 0.35, 0.55], r: [0.6, 0, 0] }), '#ffffff'), tint(xf(G.sph(0.2, 10), { p: [0, 0.65, 0.82], s: [0.8, 0.8, 1.4] }), '#ffffff'), ...[[-0.18, 0.35], [0.18, 0.35], [-0.18, -0.35], [0.18, -0.35]].map(([x, z]) => tint(xf(G.cyl(0.06, 0.05, 0.75, 6), { p: [x, -0.5, z], r: [z > 0 ? -0.5 : 0.4, 0, 0] }), '#ffffff')), tint(xf(G.box(0.35, 0.1, 0.5, 0.04), { p: [0, 0.3, 0] }), '#D7263D'), tint(xf(G.cyl(0.04, 0.12, 0.6, 6), { p: [0, 0.05, -0.65], r: [-0.8, 0, 0] }), '#F4B942'), tint(xf(G.box(0.08, 0.35, 0.3, 0.03), { p: [0, 0.72, 0.6] }), '#F4B942')]; return merge(p); }
function cupGeo(S) { const pts = [[0, 0], [0.7, 0], [0.95, 0.15], [1.15, 0.6], [1.2, 1.0], [1.12, 1.02], [1.06, 0.62], [0.88, 0.2], [0, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)); const g = new THREE.LatheGeometry(pts, S === 'paper' ? 12 : 24); const h = new THREE.TorusGeometry(0.3, 0.08, 6, 12, Math.PI * 1.2); h.rotateZ(-Math.PI * 0.6); h.translate(1.25, 0.6, 0); return merge([g, h]); }
function bumperGeo(S) { const G = geoKit(S); return merge([tint(xf(G.box(1.5, 0.5, 2.1, 0.2), { p: [0, 0.35, 0] }), '#ffffff'), tint(xf(new THREE.TorusGeometry(0.95, 0.16, 6, 24), { p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0], s: [0.85, 1.15, 1] }), '#2a2a2a'), tint(xf(G.box(1.1, 0.6, 0.5, 0.12), { p: [0, 0.75, -0.6] }), '#ffffff'), tint(xf(G.cyl(0.22, 0.22, 0.06, 12), { p: [0, 0.85, 0.35], r: [-0.8, 0, 0] }), '#333333')]); }

// ---------------------------------------------------------------------------------------------- TRACKS + TRAINS
export function buildTracks(W) {
  const { D, S, K, lodOf, group, park } = W; const H = mk(W); const out = {};
  for (const r of D.rides) {
    if (!r.track) continue; const tr = park.track(r.track); const p = r.params; const cols = p.colors || {}; const grp = new THREE.Group(); group('track:' + r.id).add(grp); out[r.id] = grp;
    piece(W, grp, r.station ? r.station.center[0] : 0, r.station ? r.station.center[1] : 0, { cat: 'track', id: r.id, kind: r.type });
    // LOD per stretch: split track in 60 m chunks; hi chunks get finer geometry and ties
    const chunks = []; for (let s = 0; s < tr.length; s += 60) { const s1 = Math.min(tr.length, s + 60); const mid = tr.sample((s + s1) / 2).pos; chunks.push({ s0: s, s1, lod: lodOf(mid[0], mid[2]) }); }
    const steel = r.type === 'steel_looping_coaster' || r.type === 'family_coaster';
    if (steel) {
      const rc = cols.track || '#E23B2E'; const g2 = p.gauge / 2; const rr = (p.rail_diameter || 0.2) / 2; const spineR = r.type === 'family_coaster' ? 0.25 : (p.spine_diameter || 0.6) / 2; const spineOff = r.type === 'family_coaster' ? -0.4 : -0.62;
      if (S === 'paper') { // folded paper U-channel strip with printed ties + spine strip
        const tieTex = canvasTex(64, 256, g => { g.fillStyle = rc; g.fillRect(0, 0, 64, 256); g.fillStyle = '#F4EBD9'; for (let i = 0; i < 4; i++) g.fillRect(6, i * 64 + 20, 52, 18); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 0, 5, 256); g.fillRect(59, 0, 5, 256); });
        tieTex.repeat.set(1, 1); const tm = new THREE.MeshStandardMaterial({ map: tieTex, roughness: 0.92, side: THREE.DoubleSide }); K.detail(tm);
        const w2 = g2 + 0.25, wall = 0.32;
        for (const c of chunks) { const step = c.lod === 0 ? 0.5 : 1.5;
          const strip = sweepTrack(tr, c.s0, c.s1, step, [[w2, wall, 0], [w2, 0, 0.1], [-w2, 0, 0.9], [-w2, wall, 1.0]], { vScale: (p.tie_spacing || 1.2) * 4 });
          grp.add(H.mesh(strip, tm)); const sp = sweepTrack(tr, c.s0, c.s1, step * 2, [[0.25, spineOff, 0], [0.25, -0.05, 0.5], [-0.25, -0.05, 0.5], [-0.25, spineOff, 1]], {}); grp.add(H.mesh(sp, K.M(shade(rc, 0.85), { side: true }))); }
      } else {
        const railM = S === 'tin' ? K.M(rc, { pattern: 'plain', forceMap: true, border: false }) : K.M(rc, { pattern: 'stripes', acc: shade(rc, 0.85), stitch: false, rep: [4, 1] });
        for (const c of chunks) { const step = c.lod === 0 ? 0.5 : c.lod === 1 ? 1.5 : 3; const seg = c.lod === 0 ? 10 : 6;
          for (const sgn of [1, -1]) grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, circleProfile(sgn * g2, 0, S === 'felt' ? rr * 1.35 : rr, seg), { vScale: 1.5 }), railM));
          grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, r.type === 'family_coaster' ? [[spineR, spineOff + 0.25, 0, 0, 1], [spineR, spineOff - 0.25, 0.25, 1, 0], [-spineR, spineOff - 0.25, 0.5, 0, -1], [-spineR, spineOff + 0.25, 0.75, -1, 0], [spineR, spineOff + 0.25, 1, 0, 1]] : circleProfile(0, spineOff, S === 'felt' ? spineR * 1.15 : spineR, seg + 2), { vScale: 3 }), railM)); }
        // ties (C brackets)
        const tieG = merge([tint(xf(new THREE.BoxGeometry(p.gauge + 0.1, 0.1, 0.16), { p: [0, -0.12, 0] }), '#ffffff'), ...[-1, 1].map(sg => tint(xf(new THREE.BoxGeometry(0.1, Math.abs(spineOff) * 1.05, 0.14), { p: [sg * g2 * 0.55, spineOff / 2 - 0.08, 0], r: [0, 0, -sg * 0.55] }), '#ffffff')), tint(xf(new THREE.BoxGeometry(0.4, 0.12, 0.22), { p: [0, spineOff + spineR * 0.6, 0] }), '#ffffff')]);
        const ties = []; for (const c of chunks) { if (c.lod > 1) continue; const sp = (p.tie_spacing || 1.2) * (c.lod === 0 ? 1 : 2); for (let s = c.s0; s < c.s1; s += sp) { const m = new THREE.Matrix4().fromArray(tr.matrix(s)); const pp = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); m.decompose(pp, q, sc); ties.push({ p: pp.toArray(), q, s: 1, c: S === 'tin' ? '#F4EBD9' : rc, x: pp.x, z: pp.z }); } }
        if (ties.length) { const ti = new Inst(tieG, S === 'tin' ? K.M('#ffffff', { vc: true, pattern: 'plain', forceMap: true, border: false }) : K.IM(), ties); grp.add(ti.mesh); }
        if (S === 'tin') { const rv = []; for (const c of chunks) { if (c.lod > 0) continue; for (let s = c.s0; s < c.s1; s += 1.2) { const f = tr.sample(s); const L = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]]; for (const sg of [1, -1]) rv.push({ p: [f.pos[0] + L[0] * sg * (g2 + rr * 0.9) , f.pos[1] + L[1] * sg * (g2 + rr * 0.9), f.pos[2] + L[2] * sg * (g2 + rr * 0.9)] }); } } if (rv.length) { const ri = new Inst(new THREE.SphereGeometry(0.05, 6, 4), K.M('#ffffff', { kind: 'chrome' }), rv, { cast: false }); grp.add(ri.mesh); } }
      }
      // lift extras: catwalk, chain; fin brakes
      for (const seg of tr.segments) {
        if (seg.tag === 'lift' && (p.catwalk_on || []).includes('lift') || (r.type === 'family_coaster' && seg.tag === 'lift')) { const mid = tr.sample((seg.s0 + seg.s1) / 2).pos; if (lodOf(mid[0], mid[2]) > 1) continue;
          const cw = sweepTrack(tr, seg.s0, seg.s1, 1, [[-g2 - 0.4, -0.35, 0], [-g2 - 1.2, -0.35, 1]], { vScale: 1 }); grp.add(H.mesh(cw, K.M(cols.catwalk || '#9AA3AD', { pattern: S === 'paper' ? 'plain' : 'planks', acc: '#7a838d', side: true })));
          const cw2 = sweepTrack(tr, seg.s0, seg.s1, 1, [[g2 + 1.2, -0.35, 0], [g2 + 0.4, -0.35, 1]], { vScale: 1 }); grp.add(H.mesh(cw2, K.M(cols.catwalk || '#9AA3AD', { pattern: S === 'paper' ? 'plain' : 'planks', acc: '#7a838d', side: true })));
          for (const sg of [-1, 1]) grp.add(H.mesh(sweepTrack(tr, seg.s0, seg.s1, 1, circleProfile(sg * (g2 + 1.2), 0.65, 0.04, 4)), K.M('#c9ced4', { kind: 'metal' })));
          const posts = []; for (let s = seg.s0; s < seg.s1; s += 1.5) { const f = tr.sample(s); const L = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]]; for (const sg of [-1, 1]) posts.push({ p: [f.pos[0] + L[0] * sg * (g2 + 1.2), f.pos[1] + 0.15, f.pos[2] + L[2] * sg * (g2 + 1.2)] }); }
          const pi = new Inst(xf(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 4), { p: [0, 0, 0] }), K.M('#c9ced4', { kind: 'metal' }), posts); grp.add(pi.mesh);
          grp.add(H.mesh(sweepTrack(tr, seg.s0, seg.s1, 0.5, [[0.14, -0.05, 0], [-0.14, -0.05, 1]], { vScale: 0.3 }), K.M('#3a3a3a', { kind: 'dark', pattern: 'check', acc: '#777777', side: true, rep: [1, 1] }))); }
        if ((p.fin_brakes_on || []).includes(seg.tag)) { const fins = []; for (let s = seg.s0; s < seg.s1; s += 2.4) { const m = new THREE.Matrix4().fromArray(tr.matrix(s, [0, -0.2, 0])); const pp = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); m.decompose(pp, q, sc); fins.push({ p: pp.toArray(), q }); } const fi = new Inst(new THREE.BoxGeometry(0.05, 0.28, 1.3), K.M('#c9ced4', { kind: 'metal' }), fins); grp.add(fi.mesh); }
      }
      // supports + footers
      const colItems = [], foot = [], lattice = [];
      for (const sp of tr.supports) { if (lodOf(sp.base[0], sp.base[2]) > 2) continue; const top = [sp.top[0], sp.top[1] + spineOff + 0.1, sp.top[2]];
        if (sp.type === 'lattice_tower' && sp.height > 8 && S !== 'paper') { const wdt = Math.min(3.2, 1.2 + sp.height * 0.06); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const bm = beamMatrix([sp.base[0] + a * wdt / 2, 0, sp.base[2] + b * wdt / 2], [top[0] + a * 0.4, top[1], top[2] + b * 0.4], sp.diameter * 0.45); lattice.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), c: cols.supports || '#F4EBD9', x: sp.base[0], z: sp.base[2] }); }
          const n = Math.floor(sp.height / 3); for (let k = 0; k < n; k++) { const y0 = k * sp.height / n, y1 = (k + 1) * sp.height / n; const w0 = lerp(wdt / 2, 0.4, y0 / sp.height), w1 = lerp(wdt / 2, 0.4, y1 / sp.height); for (const [a, b, c2, d2] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) { const bm = beamMatrix([sp.base[0] + a * w0, y0, sp.base[2] + b * w0], [sp.base[0] + c2 * w1, y1, sp.base[2] + d2 * w1], 0.1); lattice.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), c: cols.supports || '#F4EBD9', x: sp.base[0], z: sp.base[2] }); } }
          for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) foot.push({ p: [sp.base[0] + a * wdt / 2, 0.15, sp.base[2] + b * wdt / 2], s: [1, 1, 1], x: sp.base[0], z: sp.base[2] }); continue; }
        const bm = beamMatrix(sp.base, top, S === 'paper' ? 1 : sp.diameter); if (S === 'paper') { bm.s.x = sp.diameter * 1.6; bm.s.z = 0.12; const tn = tr.sample(sp.s).tangent; bm.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(tn[0], tn[2]) + Math.PI / 2, 0)); }
        colItems.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), c: cols.supports || '#F4EBD9', x: sp.base[0], z: sp.base[2] }); foot.push({ p: [sp.base[0], 0.15, sp.base[2]], s: [1, 1, 1], x: sp.base[0], z: sp.base[2] }); }
      const colG = S === 'paper' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(0.5, 0.5, 1, S === 'felt' ? 10 : 14);
      if (colItems.length) { const ci = new Inst(colG, S === 'tin' ? K.M('#ffffff', { vc: false, pattern: 'plain', forceMap: true, border: false }) : K.IM(), colItems); grp.add(ci.mesh); W.sets['supports_' + r.id] = ci; }
      if (lattice.length) { const li = new Inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), K.IM(), lattice); grp.add(li.mesh); }
      if (foot.length) { const fi = new Inst(S === 'paper' ? new THREE.BoxGeometry(1.6, 0.05, 1.6) : H.G.box(1.6, 0.3, 1.6), K.M(cols.footers || '#B8B2A6'), foot.map(f => Object.assign(f, { p: [f.p[0], S === 'paper' ? 0.03 : 0.15, f.p[2]] }))); grp.add(fi.mesh); }
    } else if (r.type === 'wooden_out_and_back_coaster') {
      const tc = cols.track || '#6B4A2E', sc = cols.structure || '#D9B98C';
      for (const c of chunks) { const step = c.lod === 0 ? 0.6 : 2; grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, [[-1.2, 0.0, 0], [-1.2, -0.6, 0.2], [1.2, -0.6, 0.8], [1.2, 0.0, 1], [-1.2, 0.0, 0]], { vScale: 2 }), K.M(tc, { pattern: S === 'paper' ? 'plain' : 'planks', acc: shade(tc, 0.8) })));
        for (const sg of [-1, 1]) grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, [[sg * 0.55 + 0.06, 0.08, 0], [sg * 0.55 - 0.06, 0.08, 1]], {}), K.M('#cccccc', { kind: 'metal', side: true }))); }
      const legs = [], braces = [];
      for (const b of tr.bents) { const [x, y, z] = b.top; if (lodOf(x, z) > 2) continue; const [ax, az] = b.axis; const tw = b.top_width / 2, bw = b.base_width / 2; const yt = y - 0.6;
        for (const sgn of [-1, 1]) { const bm = beamMatrix([x + ax * bw * sgn, b.ground, z + az * bw * sgn], [x + ax * tw * sgn, yt, z + az * tw * sgn], 0.32); legs.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), c: sc, x, z }); }
        const nl = Math.max(1, Math.floor(b.height / 2.5)); for (let k = 0; k <= nl; k++) { const u = k / (nl + 0.0001), yy = b.ground + (yt - b.ground) * Math.min(1, u); const ww = lerp(bw, tw, Math.min(1, u)); const bm = beamMatrix([x - ax * ww, yy, z - az * ww], [x + ax * ww, yy, z + az * ww], 0.2); braces.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), c: sc, x, z });
          if (k < nl && lodOf(x, z) <= 1) { const y2 = b.ground + (yt - b.ground) * (k + 1) / nl, w2 = lerp(bw, tw, (k + 1) / nl); for (const sgn of [-1, 1]) { const bx = beamMatrix([x - ax * ww * sgn, yy, z - az * ww * sgn], [x + ax * w2 * sgn, y2, z + az * w2 * sgn], 0.14); braces.push({ p: bx.p.toArray(), q: bx.q, s: bx.s.toArray(), c: shade(sc, 0.92), x, z }); } } } }
      const bg = S === 'paper' ? new THREE.BoxGeometry(1, 1, 1) : new RoundedBoxGeometry(1, 1, 1, 1, 0.1);
      if (legs.length) grp.add(new Inst(bg, K.IM({ pattern: S === 'tin' ? 'planks' : 'plain', acc: '#cccccc' }), legs).mesh); if (braces.length) grp.add(new Inst(bg, K.IM(), braces).mesh);
    } else if (r.type === 'log_flume') {
      for (const c of chunks) { if (c.lod > 2) continue; const step = c.lod === 0 ? 0.6 : 2; const w = (p.trough_width || 1.6) / 2;
        grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, [[w + 0.15, 0.35, 0], [w + 0.15, -0.65, 0.2], [-w - 0.15, -0.65, 0.8], [-w - 0.15, 0.35, 1]], { vScale: 2 }), K.M(p.trough_outer || '#8B6B4A', { pattern: S === 'paper' ? 'plain' : 'planks', acc: '#6B4A2E', side: true })));
        grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, [[w, 0.3, 0], [w, -0.5, 0.3], [-w, -0.5, 0.7], [-w, 0.3, 1]], {}), K.M(p.trough_color || '#DDEFF2', { side: true })));
        grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, [[w - 0.05, -0.1, 0], [-w + 0.05, -0.1, 1]], { vScale: 4 }), K.M('#5AA9D6', { pattern: 'waves', acc: '#9ED0EC', side: true, stitch: false }))); }
      const sup = tr.supports.filter(sp => lodOf(sp.base[0], sp.base[2]) <= 2).map(sp => { const bm = beamMatrix(sp.base, [sp.top[0], sp.top[1] - 0.65, sp.top[2]], 0.35); return { p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), c: '#8B6B4A', x: sp.base[0], z: sp.base[2] }; });
      if (sup.length) grp.add(new Inst(new THREE.BoxGeometry(1, 1, 1), K.IM({ kind: S === 'tin' ? 'wood' : 'base' }), sup).mesh);
    } else if (r.type === 'river_rapids') {
      const cw = (p.channel_width || 7) / 2;
      for (const c of chunks) { if (c.lod > 2) continue; const step = c.lod === 0 ? 1 : 3; const R = rng(c.s0);
        const prof = [[cw + 2.5, 0.8, 0], [cw + 1.0, 1.4, 0.1], [cw + 0.2, 0.3, 0.2], [cw - 0.2, -1.0, 0.3], [-cw + 0.2, -1.0, 0.7], [-cw - 0.2, 0.3, 0.8], [-cw - 1.0, 1.5, 0.9], [-cw - 2.5, 0.8, 1]];
        const gch = sweepTrack(tr, c.s0, c.s1, step, prof, { vScale: 6 }); const P = gch.attributes.position; for (let i = 0; i < P.count; i++) { const k = i % prof.length; if (k === 1 || k === 6 || k === 0 || k === 7) P.setY(i, P.getY(i) + (hash1(i * 1.3) - 0.3) * 1.2); } gch.computeVertexNormals();
        grp.add(H.mesh(gch, K.M('#9B8B78', { pattern: S === 'paper' ? 'plain' : 'dots', acc: '#7d6f5f', side: true })));
        grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, [[cw - 0.1, 0.0, 0], [-cw + 0.1, 0.0, 1]], { vScale: 8 }), K.M('#4B8FBF', { pattern: 'waves', acc: '#cfe8f5', side: true, stitch: false }))); }
    } else if (r.type === 'perimeter_railway') {
      for (const c of chunks) { if (c.lod > 1) continue; const step = 2; for (const sg of [-1, 1]) grp.add(H.mesh(sweepTrack(tr, c.s0, c.s1, step, circleProfile(sg * 0.46, 0.08, 0.05, 4)), K.M('#777777', { kind: 'metal' }))); }
      const sl = []; for (let s = 0; s < tr.length; s += 0.9) { const f = tr.sample(s); if (lodOf(f.pos[0], f.pos[2]) > 0) continue; const m = new THREE.Matrix4().fromArray(tr.matrix(s)); const pp = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); m.decompose(pp, q, sc); sl.push({ p: pp.toArray(), q }); }
      if (sl.length) grp.add(new Inst(new THREE.BoxGeometry(1.8, 0.12, 0.22), K.M('#6B4A2E', { kind: S === 'tin' ? 'wood' : 'base' }), sl).mesh);
    }
    // station building
    if (r.station) { const st = r.station; const sg = new THREE.Group(); sg.position.set(st.center[0], 0, st.center[1]); sg.rotation.y = st.rot || 0; grp.add(sg); const roofC = r.type === 'family_coaster' ? '#F4A7B9' : r.type === 'steel_looping_coaster' ? '#2C3E50' : r.type === 'wooden_out_and_back_coaster' ? '#5D3A1A' : '#C9A66B';
      if (lodOf(st.center[0], st.center[1]) <= 1) { H.box(sg, st.w, st.platform_height || 1, st.d * 0.42, '#CFC7B8', {}, 0, (st.platform_height || 1) / 2, st.d * 0.29); H.box(sg, st.w, st.platform_height || 1, st.d * 0.2, '#CFC7B8', {}, 0, (st.platform_height || 1) / 2, -st.d * 0.4);
        for (let k = 0; k <= 6; k++) for (const sz of [-1, 1]) H.cyl(sg, 0.2, 0.2, st.h, '#ffffff', { seg: 8 }, -st.w / 2 + 0.5 + k * (st.w - 1) / 6, st.h / 2, sz * (st.d / 2 - 0.5));
        H.box(sg, st.w + 1, 0.5, st.d + 1, roofC, { pattern: S === 'paper' ? 'plain' : 'stripes', acc: shade(roofC, 0.85) }, 0, st.h, 0);
        if (r.type === 'steel_looping_coaster') for (let k = 0; k < 8; k++) H.box(sg, st.w / 8 - 0.3, 1.6, st.d + 1, '#2C3E50', {}, -st.w / 2 + (k + 0.5) * st.w / 8, st.h + 0.9, 0, 0, 0, 0.5);
        if (r.type === 'family_coaster') { const sc = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14, 1, false, 0, Math.PI); for (const sz of [-1, 1]) for (let k = 0; k < Math.floor((st.w + 1) / 1.0); k++) { const m = H.mesh(sc, K.M(k % 2 ? '#FFFFFF' : '#F4A7B9')); m.rotation.set(Math.PI / 2, 0, -Math.PI / 2); m.position.set(-(st.w + 1) / 2 + 0.5 + k * 1.0, st.h - 0.25, sz * ((st.d + 1) / 2 + 0.07)); sg.add(m); } for (let k = 0; k < 4; k++) H.sph(sg, 0.4, ['#FFE08A', '#A8D8EA', '#B8E0B0', '#C3A6E0'][k], {}, -st.w / 2 + 2 + k * (st.w - 4) / 3, st.h + 0.5, 0); }
        H.box(sg, st.w + 1.2, 0.8, 0.25, r.type === 'steel_looping_coaster' ? '#E23B2E' : r.type === 'family_coaster' ? '#FFE08A' : '#F4E3C1', {}, 0, st.h - 0.5, st.d / 2 + 0.55); }
    }
  }
  W.trackGroups = out; return out;
}
// trains with riders
export function buildTrains(W) {
  const { D, S, K, lodOf, group, park } = W; const G = geoKit(S); const trains = [];
  const pal = D.guests.clothes_palette;
  for (const r of D.rides) {
    if (!r.track) continue; const p = r.params; const tp = p.train || p.boats || p.rafts; if (!tp) continue; const tr = park.track(r.track);
    const nTr = (D.animation[r.id] || {}).trains || (D.animation[r.id] || {}).boats || tp.count || 1;
    let nCars = tp.cars || 1, carL = tp.car_length || tp.length || tp.diameter || 3, carW = tp.car_width || tp.width || tp.diameter || 1.6, gap = tp.car_gap || 0;
    if (r.type === 'perimeter_railway') { nCars = 1 + (tp.coaches || 5); carL = tp.coach_length || 7; gap = 0.6; carW = 2.2; }
    const cars = []; const riders = [];
    const isCoaster = r.type.includes('coaster'); const tcols = tp.colors || {};
    for (let ti = 0; ti < nTr; ti++) for (let c = 0; c < nCars; c++) {
      const g = new THREE.Group(); group('trains').add(g); let col = Array.isArray(tcols) ? tcols[(c + (r.id === 'hero_coaster' ? 1 : 0)) % tcols.length] : (tp.color || '#ffffff');
      if (isCoaster) {
        const lead = c === 0; const body = carGeo(S, carL, carW, lead && (tp.nose_cone_on_lead || r.type === 'family_coaster'), r.type === 'family_coaster', col);
        const m = new THREE.Mesh(body, K.M('#ffffff', { vc: true, pattern: S === 'tin' ? (c % 2 ? 'stars' : 'stripes') : 'plain', acc: S === 'tin' ? '#F4EBD9' : undefined, forceMap: S === 'tin' })); m.castShadow = m.receiveShadow = true; g.add(m);
        if (r.type === 'family_coaster' && lead) { const hd = new THREE.Mesh(G.sph(0.65, 16), K.M('#7BC96F')); hd.position.set(0, 1.1, carL / 2 + 0.3); g.add(hd); for (const sx of [-0.25, 0.25]) { const e = new THREE.Mesh(G.sph(0.14, 8), K.M('#ffffff')); e.position.set(sx, 1.35, carL / 2 + 0.85); g.add(e); const pu = new THREE.Mesh(G.sph(0.07, 6), K.M('#1c1c1c')); pu.position.set(sx, 1.37, carL / 2 + 0.97); g.add(pu); const an = new THREE.Mesh(G.cyl(0.03, 0.03, 0.6, 4), K.M('#1c1c1c')); an.position.set(sx, 1.85, carL / 2 + 0.2); g.add(an); } }
        const rows = tp.rows_per_car || 1, seats = tp.seats_per_row || 2;
        for (let rw = 0; rw < rows; rw++) for (let sx = 0; sx < seats; sx++) { const lx = (sx - (seats - 1) / 2) * (carW * (rw === 0 && c === 0 && r.type === 'steel_looping_coaster' ? 0.56 : 0.45)); const lz = rows === 1 ? 0 : (rw === 0 ? 0.4 : -0.6) * carL / 2.2; riders.push({ car: g, lx, lz, ci: (ti * 31 + c * 7 + rw * 3 + sx) % pal.length, skin: ['#F3D2B5', '#C99068', '#E8BC98', '#704A32'][(c + sx + rw) % 4], hair: ['#2B1D14', '#D9B56A', '#8A5A2E', '#1C1C1C'][(c * 3 + sx) % 4], ride: r.id, lead: c === 0 && rw === 0, train: ti, seatY: 0.05 }); }
      } else if (r.type === 'log_flume') { const m = new THREE.Mesh(G.cyl(0.7, 0.7, carL, 12), K.M('#8B5A2B', { pattern: S === 'paper' ? 'plain' : 'planks', acc: '#6B4A2E' })); m.rotation.x = Math.PI / 2; m.position.y = 0.2; m.scale.set(1, 1, 0.8); g.add(m); m.castShadow = true;
        for (let k = 0; k < 3; k++) riders.push({ car: g, lx: 0, lz: (k - 1) * 1.1, ci: (c * 5 + k) % pal.length, skin: '#E8BC98', hair: '#5A3A22', ride: r.id, flume: true }); }
      else if (r.type === 'river_rapids') { const m = new THREE.Mesh(new THREE.TorusGeometry(carL / 2 - 0.4, 0.45, 8, 20), K.M(col || '#E67E22', { kind: 'rubber' })); m.rotation.x = Math.PI / 2; m.position.y = 0.25; g.add(m); const d = new THREE.Mesh(G.cyl(carL / 2 - 0.5, carL / 2 - 0.5, 0.5, 16), K.M('#F1C40F')); d.position.y = 0.3; g.add(d); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; riders.push({ car: g, lx: Math.cos(a) * 1.0, lz: Math.sin(a) * 1.0, ci: (c * 5 + k) % pal.length, skin: '#E8BC98', hair: '#2B1D14', ride: r.id, flume: true }); } }
      else if (r.type === 'perimeter_railway') { const cc = tp.colors || {}; if (c === 0) { const b = new THREE.Mesh(G.cyl(0.9, 0.9, 4.5, 14), K.M(cc.loco || '#1F5E3B')); b.rotation.x = Math.PI / 2; b.position.set(0, 1.6, 0.8); g.add(b); const cab = new THREE.Mesh(G.box(2.0, 2.2, 2.0), K.M(cc.loco || '#1F5E3B')); cab.position.set(0, 2.0, -2.0); g.add(cab); const ch = new THREE.Mesh(G.cyl(0.3, 0.4, 1.4, 10), K.M('#1c1c1c')); ch.position.set(0, 2.9, 2.6); g.add(ch); const dm = new THREE.Mesh(G.sph(0.45, 10), K.M('#D9A441', { kind: 'brass' })); dm.position.set(0, 2.5, 0.8); g.add(dm); }
        else { const b = new THREE.Mesh(G.box(2.2, 0.9, carL - 0.4), K.M(cc.coaches || '#C8463A', { pattern: 'hstripes', acc: '#D9A441' })); b.position.y = 0.9; g.add(b); const rf = new THREE.Mesh(G.box(2.4, 0.15, carL - 0.2), K.M(cc.roofs || '#F3E6CC')); rf.position.y = 2.9; g.add(rf); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const po = new THREE.Mesh(G.cyl(0.05, 0.05, 1.6, 5), K.M('#D9A441')); po.position.set(sx * 1.05, 2.1, sz * (carL / 2 - 0.5)); g.add(po); } for (let k = 0; k < 4; k++) riders.push({ car: g, lx: (k % 2 - 0.5) * 1.0, lz: (Math.floor(k / 2) - 0.5) * 2.5, ci: (c * 5 + k) % pal.length, skin: '#E8BC98', hair: '#2B1D14', ride: r.id, flume: true, seatY: 0.9 }); } g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
      cars.push({ g, ti, c });
    }
    trains.push({ r, tr, cars, nTr, nCars, carL, gap, riders, height: r.type === 'river_rapids' ? 0.2 : r.type === 'log_flume' ? -0.2 : 0 });
  }
  // riders: instanced parts across all trains
  const all = trains.flatMap(t => t.riders.map(rd => Object.assign(rd, { trainObj: t })));
  const mkPart = (geo, colorOf, matO) => { tint(geo, '#fff'); const inst = new Inst(geo, matO || K.IM(), all.map(rd => ({ p: [0, 0, 0], c: colorOf(rd), rd }))); group('trains').add(inst.mesh); return inst; };
  const torso = mkPart(S === 'felt' ? xf(lumpySphere(0.25, 2, 0.05, 2, 3), { p: [0, 0.95, 0], s: [1, 1.2, 0.75] }) : xf(G.box(0.46, 0.6, 0.3, 0.1), { p: [0, 0.95, 0] }), rd => pal[rd.ci]);
  const head = mkPart(xf(G.sph(0.15, 14), { p: [0, 1.42, 0] }), rd => rd.skin, S === 'tin' ? K.M('#ffffff', { kind: 'skin', vc: true }) : null);
  const hair = mkPart(xf(new THREE.SphereGeometry(0.16, 12, 8, 0, 6.283, 0, 1.5), { p: [0, 1.45, -0.02], r: [-0.35, 0, 0] }), rd => rd.hair, K.IM({ side: true }));
  const armL = mkPart(xf(G.cyl(0.075, 0.065, 0.62, 10), { p: [0, 0.31, 0] }), rd => pal[rd.ci]);
  const armR = mkPart(xf(G.cyl(0.075, 0.065, 0.62, 10), { p: [0, 0.31, 0] }), rd => pal[rd.ci]);
  const hands = mkPart(merge([xf(G.sph(0.085, 10), { p: [0.0, 0.68, 0], s: [1, 1.2, 0.7] }), xf(G.cyl(0.03, 0.03, 0.12, 5), { p: [0.07, 0.72, 0], r: [0, 0, -0.6] })]), rd => rd.skin);
  const handsR = mkPart(merge([xf(G.sph(0.085, 10), { p: [0.0, 0.68, 0], s: [1, 1.2, 0.7] }), xf(G.cyl(0.03, 0.03, 0.12, 5), { p: [-0.07, 0.72, 0], r: [0, 0, 0.6] })]), rd => rd.skin);
  W.trains = trains; W.riderParts = { all, torso, head, hair, armL, armR, hands, handsR };
  return trains;
}
// car body: open-top car with seats (unit around origin; y=0 at rail centre plane)
function carGeo(S, L, Wd, nose, family, bc = '#ffffff') {
  const G = geoKit(S); const P = []; const w = Wd * 0.95, h0 = 0.22;
  const B = (bw, bh, bd, c, p, r) => P.push(tint(xf(G.box(bw, bh, bd, Math.min(bw, bh, bd) * (S === 'felt' ? 0.35 : 0.12)), { p, r }), c));
  B(w * 0.9, 0.22, L * 0.92, '#3a3a3a', [0, h0 - 0.05, 0]); // chassis
  B(w, 0.12, L * 0.95, bc, [0, h0 + 0.12, 0]); // floor
  for (const sx of [-1, 1]) B(0.12, 0.5, L * 0.95, bc, [sx * (w / 2 - 0.06), h0 + 0.38, 0]); // sides
  B(w, 0.3, 0.14, bc, [0, h0 + 0.22, L * 0.47]); B(w, 0.5, 0.14, bc, [0, h0 + 0.4, -L * 0.47]);
  const rows = family ? [0] : [0.4 * L / 2.2, -0.6 * L / 2.2];
  for (const rz of rows) { B(w * 0.86, 0.14, 0.42, '#3B3566', [0, h0 + 0.3, rz - 0.08]); B(w * 0.86, 0.75, 0.14, '#2E294E', [0, h0 + 0.7, rz - 0.32]); for (const sx of family ? [-0.3, 0.3] : [-0.45, 0.45]) { B(0.36, 0.3, 0.12, '#2E294E', [sx * Wd / 2 * 1.9 / 1.9, h0 + 1.22, rz - 0.34]); B(0.34, 0.06, 0.06, '#F4B942', [sx, h0 + 0.58, rz + 0.3]); B(0.05, 0.3, 0.05, '#F4B942', [sx, h0 + 0.45, rz + 0.3]); } }
  for (const sz of [-L * 0.35, L * 0.35]) for (const sx of [-0.55, 0.55]) P.push(tint(xf(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10), { p: [sx * (Wd / 2) / 1.0 * 0.55 / 0.55, 0.05, sz], r: [0, 0, Math.PI / 2] }), '#555555'));
  if (nose) { const n = new THREE.SphereGeometry(0.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); n.rotateX(Math.PI / 2); n.scale(w / 1.4, 0.24, 1.0); P.push(tint(xf(n, { p: [0, h0 + 0.1, L * 0.48] }), bc)); P.push(tint(xf(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), { p: [0, h0 + 0.18, L * 0.48 + 0.66], r: [Math.PI / 2, 0, 0] }), '#F4B942')); }
  for (const sx of [-1, 1]) P.push(tint(xf(new THREE.BoxGeometry(0.04, 0.12, L * 0.9), { p: [sx * (w / 2 + 0.01), h0 + 0.6, 0] }), '#F4B942'));
  return merge(P);
}
// update trains + riders at film time t
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function updateTrains(W, t, shot, o = {}) {
  const { park } = W;
  for (const T of W.trains) {
    let fronts = park.trainFronts(T.r.id, o.rideClock ? o.rideClock(T.r.id, t) : t, shot);
    if (o.trainFronts) fronts = o.trainFronts(T, fronts, t);
    for (const car of T.cars) { const s = fronts[car.ti] - T.carL / 2 - car.c * (T.carL + T.gap); _m.fromArray(T.tr.matrix(s, [0, T.height, 0])); _m.decompose(car.g.position, car.g.quaternion, car.g.scale); if (o.carXform) o.carXform(T, car); car.s = s; }
  }
  const R = W.riderParts; if (!R) return; const all = R.all;
  for (let i = 0; i < all.length; i++) {
    const rd = all[i]; const g = rd.car; g.updateMatrix(); const seatY = rd.seatY ?? 0.3;
    const tag = rd.ride === 'hero_coaster' || rd.ride === 'family_coaster' || rd.ride === 'wooden_coaster' ? (() => { const car = rd.trainObj.cars.find(c => c.g === g); return car ? rd.trainObj.tr.sample(car.s).tag : ''; })() : '';
    const up = /drop|crest|airtime|loop|corkscrew|hill|helix/.test(tag) || (o.armsUp && o.armsUp(rd));
    const wave = Math.sin(t * 9 + i) * 0.12;
    _m.copy(g.matrix).multiply(_m2.makeTranslation(rd.lx, seatY, rd.lz));
    const hide = (o.hideRider && o.hideRider(rd)) || !g.visible;
    const set = (inst, M) => { if (hide) M = _m2.makeScale(0, 0, 0); inst.mesh.setMatrixAt(i, M); };
    set(R.torso, _m); const noHead = o.povHideHeads && rd.lead && rd.train === 0; set(R.head, noHead ? _m2.makeScale(0, 0, 0) : _m); set(R.hair, noHead ? _m2.makeScale(0, 0, 0) : _m);
    for (const [arm, hand, sg] of [[R.armL, R.hands, 1], [R.armR, R.handsR, -1]]) {
      const M = _m.clone().multiply(_m2.makeTranslation(sg * 0.25, 1.15, 0.02));
      if (up && rd.lead && rd.train === 0) { const side = Math.sign(rd.lx) || 1; M.multiply(_m2.makeRotationZ(-side * (0.75 + wave * 0.5) - (sg === side ? 0.25 : -0.05) * side)).multiply(new THREE.Matrix4().makeRotationX(0.75 + wave)); }
      else if (up) M.multiply(_m2.makeRotationZ(-sg * (0.45 + wave))).multiply(new THREE.Matrix4().makeRotationX(0.55 + wave));
      else M.multiply(_m2.makeRotationX(Math.PI - 0.5)).multiply(new THREE.Matrix4().makeRotationZ(sg * 0.1));
      set(arm, M); set(hand, M);
    }
  }
  for (const k of ['torso', 'head', 'hair', 'armL', 'armR', 'hands', 'handsR']) R[k].mesh.instanceMatrix.needsUpdate = true;
}
