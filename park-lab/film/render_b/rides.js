// rides.js: flat rides, stations, queues (switchbacks + canopies), with bulbs registered per land
import * as THREE from 'three';
import { merge, box, cyl, ico, sph, cone, S, T, R, hash } from './geo.js';

const hex = s => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);

export function buildRides(W, park, opts = {}) {
  const D = park.data; const { put, cmp, beamM, frame, mat, G, addBulb, addPool, addPoint, LP } = W;
  const anim = W.animators;
  const dyn = (geo, mk, color, parent) => { const m = new THREE.Mesh(geo, W.mat(mk)); m.castShadow = true; m.receiveShadow = true; if (color != null) { /* per-mesh colour via material clone */ m.material = W.M.std({ color, snowK: mk === 'roof' ? 1 : 0.18, rough: LP ? 0.8 : 0.32, side: mk === 'fabric' ? THREE.DoubleSide : THREE.FrontSide }); } parent.add(m); return m; };
  const meshGroup = (geos) => merge(geos);
  const bulbsLocal = []; // bulbs attached to moving parts: {obj, local:[x,y,z], land, color}
  const addMovingBulbs = (obj, pts, land, color, size = 0.2, tag) => { for (const p of pts) bulbsLocal.push({ obj, p, land, color, size, tag }); };

  for (const r of D.rides) {
    const p = r.params || {}; if (!r.position) continue; const [x, y0, z] = r.position; const rot = r.rot || 0; const land = r.land || W.landOf(x, z);
    const L = frame(x, y0, z, rot);
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = rot; G('rides').add(g);
    switch (r.type) {
      case 'ferris_wheel': {
        const R0 = p.diameter / 2, hub = p.hub_height, rs = p.rim_spacing;
        // A-frame legs
        for (const sz of [-1, 1]) for (const sx of [-1, 1]) { L.cbeam('ride', [sx * 13, 0, sz * 5], [0, hub, sz * (rs / 2 + 0.6)], 0.8, 0xffffff); }
        for (const sz of [-1, 1]) { L.cbeam('ride', [-9.5, hub * 0.3, sz * 4.1], [9.5, hub * 0.3, sz * 4.1], 0.4, 0xffffff); L.box('solid', 0, 0.4, sz * 5, 30, 0.8, 1.6, 0xb8b2a6); }
        L.box('solid', 0, 0.6, 0, 8, 1.2, 4, 0x2e86c1); // boarding platform
        const wheel = new THREE.Group(); wheel.position.set(0, hub, 0); g.add(wheel);
        const rimGeo = merge([new THREE.TorusGeometry(R0, 0.32, LP ? 5 : 8, 90), new THREE.TorusGeometry(R0 * 0.62, 0.16, 5, 60)]);
        for (const zz of [-rs / 2, rs / 2]) { const m = dyn(rimGeo, 'ride', 0xffffff, wheel); m.position.z = zz; }
        const sp = [];
        for (let k = 0; k < p.spokes; k++) { const a = k / p.spokes * Math.PI * 2; for (const zz of [-rs / 2, rs / 2]) { const gg = box(R0, 0.14, 0.14); gg.translate(R0 / 2, 0, 0); gg.rotateZ(a); gg.translate(0, 0, zz * 0.85); sp.push(gg); } const cr = box(0.12, 0.12, rs, Math.cos(a) * R0, Math.sin(a) * R0, 0); sp.push(cr); }
        dyn(merge(sp), 'ride', 0xffffff, wheel);
        dyn(cyl(1.6, 1.6, rs + 1.4, 16).rotateX(Math.PI / 2), 'metal', 0xdddddd, wheel);
        const gond = []; const gcols = p.colors.gondolas;
        const gGeo = merge([box(2.0, 0.15, 2.0, 0, -1.0, 0), box(2.0, 0.9, 0.08, 0, -0.55, 0.96), box(2.0, 0.9, 0.08, 0, -0.55, -0.96), box(0.08, 0.9, 2.0, 0.96, -0.55, 0), box(0.08, 0.9, 2.0, -0.96, -0.55, 0),
          ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => box(0.06, 1.9, 0.06, a * 0.95, 0, b * 0.95)), S(sph(1.3, 10, 4, 0, 0, 0, 0, Math.PI * 2, 0, Math.PI / 2), 1, 0.45, 1).translate(0, 0.9, 0), box(0.1, 0.9, 0.1, 0, 1.4, 0)]);
        for (let k = 0; k < p.gondolas; k++) { const m = dyn(gGeo, 'ride', hex(gcols[k % gcols.length]), g); gond.push(m); }
        // bulbs on spokes and rims (attached to wheel)
        const pts = []; for (let k = 0; k < p.spokes; k++) { const a = k / p.spokes * Math.PI * 2; for (let j = 1; j <= 8; j++) pts.push([Math.cos(a) * R0 * j / 8.4, Math.sin(a) * R0 * j / 8.4, rs / 2 + 0.25, j / 8]); }
        for (let k = 0; k < 120; k++) { const a = k / 120 * Math.PI * 2; pts.push([Math.cos(a) * R0, Math.sin(a) * R0, rs / 2 + 0.4, 1.1]); pts.push([Math.cos(a) * R0, Math.sin(a) * R0, -rs / 2 - 0.4, 1.1]); }
        addMovingBulbs(wheel, pts, land, 0xffd890, 0.28, 'wheel');
        anim.push(t => { const a = park.flatRide(r.id, t).angle; wheel.rotation.z = a; gond.forEach((gd, k) => { const b = a + k / p.gondolas * Math.PI * 2; gd.position.set(Math.cos(b) * R0, hub + Math.sin(b) * R0 - 1.2, 0); gd.rotation.z = Math.sin(t * 0.8 + k) * 0.04; }); });
        addPool(land, x, z, 26, 0xffd090, 1.2); addPoint(land, x, hub, z + 8, 0xffd8a0, 1, 60);
        break;
      }
      case 'carousel': {
        const R1 = p.radius, H = p.height; const cc = p.colors;
        L.g('cyl20', 'ride', 0, 0.35, 0, R1 * 2 + 1, 0.7, R1 * 2 + 1, 0x8e5b3a); L.g('cyl20', 'ride', 0, 0.75, 0, R1 * 2 + 0.6, 0.1, R1 * 2 + 0.6, hex(cc.trim));
        for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; L.box('solid', Math.cos(a) * (R1 + 0.4), 0.9, Math.sin(a) * (R1 + 0.4), 0.6, 0.35, 0.3, 0xf4b942, -a); }
        const top = new THREE.Group(); g.add(top);
        const canopy = []; const n = 24;
        for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2; const gg = new THREE.BufferGeometry();
          const rr = R1 + 0.6, hh = H - 3.4, hp = H + 0.8; gg.setAttribute('position', new THREE.Float32BufferAttribute([0, hp, 0, Math.cos(a1) * rr, hh, Math.sin(a1) * rr, Math.cos(a0) * rr, hh, Math.sin(a0) * rr], 3)); gg.computeVertexNormals();
          const m = dyn(gg, 'fabric', hex(cc.canopy[k % 2]), top); }
        // rounding board + valance + scallops
        dyn(cyl(R1 + 0.65, R1 + 0.65, 1.3, 32, 0, H - 4.0, 0), 'ride', hex(cc.trim), top);
        dyn(cyl(R1 + 0.7, R1 + 0.7, 0.14, 32, 0, H - 3.4, 0), 'ride', 0xfff4e0, top);
        for (let k = 0; k < 32; k++) { const a = (k + 0.5) / 32 * Math.PI * 2; const m = dyn(S(sph(0.6, 8, 4, 0, 0, 0, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 1, 0.7, 0.3), 'fabric', hex(cc.canopy[k % 2]), top); m.position.set(Math.cos(a) * (R1 + 0.66), H - 4.65, Math.sin(a) * (R1 + 0.66)); m.rotation.y = -a + Math.PI / 2; }
        dyn(cyl(1.6, 1.6, H - 4.6, 16, 0, (H - 4.6) / 2 + 0.8, 0), 'ride', 0xe8d8b0, top); // centre drum
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const m = dyn(box(0.9, 2.0, 0.05), 'glass', 0x9fb8c8, top); m.position.set(Math.cos(a) * 1.62, 2.6, Math.sin(a) * 1.62); m.rotation.y = -a + Math.PI / 2; }
        dyn(cone(0.25, 1.4, 8, 0, H + 1.3, 0), 'metal', 0xf4b942, top);
        const horses = []; const per = p.figures / p.rows;
        const horseGeo = merge([S(sph(0.5, 8, 6), 0.42, 0.42, 1.0).translate(0, 0, 0), S(sph(0.25, 6, 5), 0.7, 1.1, 1.3).rotateX(-0.6).translate(0, 0.35, 0.5), box(0.12, 0.6, 0.12, 0.12, -0.45, 0.3), box(0.12, 0.6, 0.12, -0.12, -0.45, 0.3), box(0.12, 0.6, 0.12, 0.12, -0.45, -0.3), box(0.12, 0.6, 0.12, -0.12, -0.45, -0.3), cyl(0.04, 0.04, H - 3.0, 6, 0, (H - 3.0) / 2 - 1.6, 0.1)]);
        for (let row = 0; row < p.rows; row++) for (let k = 0; k < per; k++) { const a = (k + row * 0.5) / per * Math.PI * 2; const rr = R1 - 1.2 - row * 1.8; const m = dyn(horseGeo, 'ride', hex(cc.horses[(k + row) % 4]), top); m.position.set(Math.cos(a) * rr, 2.2, Math.sin(a) * rr); m.rotation.y = -a; horses.push(m); }
        const pts = []; for (let rr = 0; rr < 3; rr++) for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2; pts.push([Math.cos(a) * (R1 + 0.72), H - 4.4 + rr * 0.42, Math.sin(a) * (R1 + 0.72)]); }
        for (let k = 0; k < 24; k++) for (let j = 1; j < 6; j++) { const a = k / 24 * Math.PI * 2; const u = j / 6; pts.push([Math.cos(a) * (R1 + 0.6) * u, H + 0.8 - (H + 0.8 - (H - 3.4)) * u + 0.1, Math.sin(a) * (R1 + 0.6) * u]); }
        addMovingBulbs(top, pts, land, 0xffd890, 0.16);
        anim.push(t => { const s = park.flatRide(r.id, t); top.rotation.y = s.angle; horses.forEach((h, k) => h.position.y = 2.2 + s.bob(k)); });
        addPool(land, x, z, 16, 0xffc070, 1.3); addPoint(land, x, 6, z, 0xffc070, 1, 40);
        break;
      }
      case 'teacups': {
        L.g('cyl20', 'ride', 0, 0.25, 0, p.platform_radius * 2 + 0.5, 0.5, p.platform_radius * 2 + 0.5, 0xe6cfa8);
        const main = new THREE.Group(); g.add(main); const subs = [];
        dyn(cyl(p.platform_radius, p.platform_radius, 0.12, 32, 0, 0.55, 0), 'ride', 0xf5a6c8, main);
        const cupGeo = merge([cyl(0.62, 0.45, 0.9, 14, 0, 0.45, 0), new THREE.TorusGeometry(0.62, 0.06, 4, 16).rotateX(Math.PI / 2).translate(0, 0.9, 0), new THREE.TorusGeometry(0.2, 0.06, 4, 8).translate(0.68, 0.55, 0), cyl(0.12, 0.12, 0.5, 6, 0, 0.9, 0)]);
        for (let k = 0; k < p.turntables; k++) { const sub = new THREE.Group(); const a = k / p.turntables * Math.PI * 2; sub.position.set(Math.cos(a) * 5, 0.6, Math.sin(a) * 5); main.add(sub); subs.push(sub);
          dyn(cyl(3.0, 3.0, 0.1, 24), 'ride', 0xffffff, sub);
          for (let c = 0; c < p.cups_per_turntable; c++) { const b = c / p.cups_per_turntable * Math.PI * 2; const m = dyn(cupGeo, 'ride', hex(p.colors.cups[(c + k) % 6]), sub); m.position.set(Math.cos(b) * 2.1, 0, Math.sin(b) * 2.1); m.scale.setScalar(p.cup_radius / 0.62 * 0.9); } }
        anim.push(t => { const s = park.flatRide(r.id, t); main.rotation.y = s.main; subs.forEach(sb => sb.rotation.y = s.sub); });
        const pts = []; for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; pts.push([Math.cos(a) * (p.platform_radius + 0.3), 0.55, Math.sin(a) * (p.platform_radius + 0.3)]); }
        pts.forEach(pp => { const q = L.p(...pp); addBulb(land, q[0], q[1], q[2], 0xffc0e0, 0.14); });
        addPool(land, x, z, 13, 0xffc0d8, 0.9);
        break;
      }
      case 'swing_ride': {
        L.g('cyl12', 'ride', 0, 0.25, 0, 16, 0.5, 16, 0xffffff);
        L.g('cyl12', 'ride', 0, p.mast_height / 2, 0, 1.3, p.mast_height, 1.3, 0xffffff);
        for (let yy = 2; yy < p.mast_height; yy += 2.5) L.g('cyl12', 'ride', 0, yy, 0, 1.45, 0.25, 1.45, 0x2e86c1);
        const top = new THREE.Group(); top.position.y = p.mast_height; top.rotation.z = (p.tilt_deg || 0) * Math.PI / 180 * 0.4; g.add(top);
        const n = 16; for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2; const gg = new THREE.BufferGeometry(); const rr = p.canopy_radius;
          gg.setAttribute('position', new THREE.Float32BufferAttribute([0, 2.6, 0, Math.cos(a1) * rr, 0, Math.sin(a1) * rr, Math.cos(a0) * rr, 0, Math.sin(a0) * rr], 3)); gg.computeVertexNormals(); dyn(gg, 'fabric', k % 2 ? 0xffffff : 0x2e86c1, top); }
        dyn(cyl(p.canopy_radius, p.canopy_radius, 0.7, 32, 0, -0.35, 0), 'ride', 0x2e86c1, top);
        const chairs = []; const chairGeo = merge([box(0.55, 0.08, 0.55, 0, 0, 0), box(0.55, 0.6, 0.06, 0, 0.3, -0.25), cyl(0.012, 0.012, 1, 3, 0.22, 0.5, 0), cyl(0.012, 0.012, 1, 3, -0.22, 0.5, 0)]);
        for (let k = 0; k < p.chairs; k++) chairs.push(dyn(chairGeo, 'ride', [0xe74c3c, 0xf1c40f, 0x2ecc71, 0xffffff][k % 4], top));
        const chainGeo = cyl(0.015, 0.015, 1, 3, 0, 0.5, 0); const chains = []; for (let k = 0; k < p.chairs; k++) chains.push(dyn(chainGeo, 'metal', 0xcccccc, top));
        anim.push(t => { const s = park.flatRide(r.id, t); top.rotation.y = s.angle; const ang = s.chairAngleDeg * Math.PI / 180;
          chairs.forEach((c, k) => { const a = k / p.chairs * Math.PI * 2 + (k % 2) * 0.1; const rr = p.canopy_radius - 0.6 + Math.sin(ang) * p.chain_length; const yy = -Math.cos(ang) * p.chain_length - 0.6; c.position.set(Math.cos(a) * rr, yy, Math.sin(a) * rr); c.rotation.set(0, -a - Math.PI / 2, 0); c.rotateX(0); c.rotation.z = 0;
            const ch = chains[k]; ch.position.set(Math.cos(a) * (p.canopy_radius - 0.6), -0.6, Math.sin(a) * (p.canopy_radius - 0.6)); ch.lookAt(new THREE.Vector3(c.position.x, c.position.y, c.position.z).applyMatrix4(top.matrixWorld)); ch.rotateX(-Math.PI / 2); ch.scale.set(1, p.chain_length, 1); }); });
        const pts = []; for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; pts.push([Math.cos(a) * (p.canopy_radius + 0.05), -0.35, Math.sin(a) * (p.canopy_radius + 0.05)]); }
        for (let k = 0; k < 16; k++) for (let j = 1; j < 5; j++) { const a = k / 16 * Math.PI * 2; pts.push([Math.cos(a) * p.canopy_radius * j / 5, 2.6 * (1 - j / 5) + 0.05, Math.sin(a) * p.canopy_radius * j / 5]); }
        addMovingBulbs(top, pts, land, 0xbfe8ff, 0.18);
        addPool(land, x, z, 16, 0x9fe3ff, 0.9);
        break;
      }
      case 'pirate_ship': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.cbeam('ride', [sx * 7.5, 0, sz * 4.5], [0, p.pivot_height, sz * 2.2], 0.7, hex(p.colors.frame));
        L.cbeam('metal', [0, p.pivot_height, -2.6], [0, p.pivot_height, 2.6], 0.8, 0x888888);
        L.box('solid', 0, 0.3, 0, 22, 0.6, 9, 0x8e5b3a);
        const piv = new THREE.Group(); piv.position.y = p.pivot_height; g.add(piv);
        const hull = []; const Lh = p.boat_length;
        const hullGeo = (() => { const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(Math.sin(u * Math.PI) * 2.0 + 0.01, u * Lh - Lh / 2)); } const gg = new THREE.LatheGeometry(pts, 12, Math.PI / 2, Math.PI); gg.rotateZ(Math.PI / 2); gg.rotateY(Math.PI / 2); return gg; })();
        const hm = dyn(S(hullGeo.clone(), 1, 1.1, 1), 'ride', hex(p.colors.hull), piv); hm.position.y = -p.pivot_height + 4.2; hm.rotation.y = Math.PI / 2; hm.material.side = THREE.DoubleSide;
        dyn(box(Lh * 0.9, 0.2, 3.6, 0, -p.pivot_height + 4.25, 0), 'ride', 0xb08a5a, piv);
        dyn(box(Lh * 0.95, 0.35, 0.1, 0, -p.pivot_height + 4.0, 1.95), 'ride', hex(p.colors.stripe), piv); dyn(box(Lh * 0.95, 0.35, 0.1, 0, -p.pivot_height + 4.0, -1.95), 'ride', hex(p.colors.stripe), piv);
        for (const sx of [-1, 1]) { dyn(box(1.2, 2.6, 3.6, sx * (Lh / 2 - 1.2), -p.pivot_height + 5.4, 0), 'ride', hex(p.colors.hull), piv); }
        dyn(cyl(0.12, 0.15, p.pivot_height - 3, 8, 0, -p.pivot_height / 2 + 2.6, 0), 'metal', 0xdddddd, piv);
        dyn(box(4.5, 3.2, 0.06, 0, -p.pivot_height + 8.0, 0), 'fabric', 0xffffff, piv);
        anim.push(t => { piv.rotation.z = park.flatRide(r.id, t).swingDeg * Math.PI / 180; });
        addPool(land, x, z, 14, 0xffc070, 0.7);
        break;
      }
      case 'drop_tower': {
        const H = p.height, mr = p.mast_radius; const mc = hex(p.colors.mast);
        L.g('cyl20', 'ride', 0, H / 2, 0, mr * 2, H, mr * 2, mc);
        // rails/lattice strips up the mast
        for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; L.box('metal', Math.cos(a) * (mr + 0.05), H / 2, Math.sin(a) * (mr + 0.05), 0.25, H, 0.25, 0xb0b8c0, -a); }
        for (let yy = 4; yy < H; yy += 4) L.g('cyl20', 'ride', 0, yy, 0, mr * 2 + 0.25, 0.3, mr * 2 + 0.25, 0x2c3a5c);
        L.g('cyl20', 'ride', 0, H + 1.2, 0, mr * 2 + 1.6, 2.4, mr * 2 + 1.6, hex(p.colors.top_crown)); L.g('cone12', 'ride', 0, H + 3.4, 0, mr * 2 + 1.2, 2.0, mr * 2 + 1.2, hex(p.colors.top_crown)); L.g('cyl6', 'metal', 0, H + 5.2, 0, 0.12, 2.0, 0.12, 0xdddddd);
        L.g('cyl20', 'solid', 0, 0.4, 0, 13, 0.8, 13, 0x8a929c); L.g('cyl20', 'solid', 0, 1.0, 0, 9, 0.4, 9, 0xf5b700);
        const ring = new THREE.Group(); g.add(ring);
        dyn(new THREE.TorusGeometry(p.ring_radius, 0.4, 8, 32).rotateX(Math.PI / 2), 'ride', hex(p.colors.ring), ring);
        dyn(cyl(p.ring_radius + 0.3, p.ring_radius + 0.3, 1.4, 32, 0, 0.8, 0), 'ride', hex(p.colors.ring), ring);
        const seatGeo = merge([box(0.62, 0.9, 0.18, 0, 0.45, 0), box(0.62, 0.12, 0.5, 0, 0.0, 0.2), box(0.5, 0.35, 0.25, 0, 0.9, 0.12)]);
        for (let k = 0; k < p.seats; k++) { const a = k / p.seats * Math.PI * 2; const m = dyn(seatGeo, 'ride', hex(p.colors.seats), ring); m.position.set(Math.cos(a) * (p.ring_radius + 0.55), -0.6, Math.sin(a) * (p.ring_radius + 0.55)); m.rotation.y = Math.PI / 2 - a; }
        // riders on the ring
        const nR = p.seats; const rim = W.makePeople(nR, 'rides');
        const m4 = new THREE.Matrix4();
        anim.push(t => { const yy = park.flatRide(r.id, t).y; ring.position.y = yy; ring.updateMatrixWorld(true);
          for (let k = 0; k < nR; k++) { const a = k / p.seats * Math.PI * 2; const v = new THREE.Vector3(Math.cos(a) * (p.ring_radius + 0.75), -0.55 - 0.8, Math.sin(a) * (p.ring_radius + 0.75)).applyMatrix4(ring.matrixWorld);
            m4.compose(v, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2 - a + rot, 0)), new THREE.Vector3(0.94, 0.94, 0.94)); W.setPerson(rim, k, m4, 500 + k, -1, yy > 20 ? 0.6 : 0); }
          W.commitPeople(rim); });
        const pts = []; for (let yy = 3; yy < H; yy += 1.5) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; pts.push(L.p(Math.cos(a) * (mr + 0.3), yy, Math.sin(a) * (mr + 0.3))); }
        pts.forEach((q, i) => addBulb(land, q[0], q[1], q[2], i % 8 < 4 ? 0xffc76b : 0xff5a4a, 0.22, 'drop'));
        addMovingBulbs(ring, Array.from({ length: 40 }, (_, k) => [Math.cos(k / 40 * 6.283) * (p.ring_radius + 0.35), 1.55, Math.sin(k / 40 * 6.283) * (p.ring_radius + 0.35)]), land, 0xffe090, 0.18);
        addPool(land, x, z, 12, 0xffc070, 0.8);
        break;
      }
      case 'observation_tower': {
        const H = p.height, mr = p.mast_radius; const c = p.colors;
        L.g('cyl20', 'ride', 0, H / 2, 0, mr * 2, H, mr * 2, hex(c.mast));
        for (let yy = 8; yy < H - 2; yy += 9) L.g('cyl20', 'ride', 0, yy, 0, mr * 2 + 0.15, 1.2, mr * 2 + 0.15, hex(c.bands));
        L.g('cyl20', 'ride', 0, H + 0.6, 0, mr * 2 + 2.4, 1.2, mr * 2 + 2.4, 0xffffff); L.g('cyl20', 'ride', 0, H + 1.5, 0, mr * 2 + 1.2, 0.6, mr * 2 + 1.2, hex(c.cabin));
        L.g('cone12', 'metal', 0, H + 5.5, 0, 2.6, 8, 2.6, 0xe2b33c); L.g('sph', 'metal', 0, H + 9.8, 0, 0.8, 0.8, 0.8, 0xe2b33c);
        for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; L.g('cyl6', 'metal', Math.cos(a) * 1.6, H + 3.0, Math.sin(a) * 1.6, 0.1, 2.0, 0.1, 0xe2b33c); }
        // base pavilion
        L.g('cyl20', 'ride', 0, 1.6, 0, 11, 3.2, 11, 0xffffff); L.g('cyl20', 'ride', 0, 3.3, 0, 12, 0.35, 12, hex(c.cabin));
        for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; L.box('win:hub', Math.cos(a) * 5.52, 1.6, Math.sin(a) * 5.52, 1.6, 2.0, 0.1, 0x2a3442, Math.PI / 2 - a); }
        const cab = new THREE.Group(); g.add(cab);
        dyn(cyl(p.cabin_radius, p.cabin_radius, 0.5, 32, 0, -p.cabin_height / 2, 0), 'ride', hex(c.cabin), cab);
        dyn(cyl(p.cabin_radius + 0.2, p.cabin_radius + 0.2, 0.4, 32, 0, p.cabin_height / 2, 0), 'ride', hex(c.cabin), cab);
        const gl = new THREE.Mesh(cyl(p.cabin_radius - 0.1, p.cabin_radius - 0.1, p.cabin_height - 0.4, 32, 0, 0, 0), W.M.std({ color: 0x5a7d90, rough: 0.15, metal: 0.2, emissive: 0xffbe6e, emissiveIntensity: 0, key: 'cabinglass' })); gl.material.userData.land = 'hub'; gl.material.userData.glow = 0.7; W.MAT['cabinglass'] = gl.material; cab.add(gl); gl.castShadow = true;
        for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; const m = dyn(box(0.12, p.cabin_height, 0.12), 'metal', 0xe2b33c, cab); m.position.set(Math.cos(a) * p.cabin_radius, 0, Math.sin(a) * p.cabin_radius); }
        const nR = 14; const rim = W.makePeople(nR, 'rides'); const m4 = new THREE.Matrix4();
        anim.push(t => { const s = park.flatRide(r.id, t); cab.position.y = s.y; cab.rotation.y = s.angle; cab.updateMatrixWorld(true);
          for (let k = 0; k < nR; k++) { const a = k / nR * 6.283; const v = new THREE.Vector3(Math.cos(a) * (p.cabin_radius - 1.0), -p.cabin_height / 2 + 0.25, Math.sin(a) * (p.cabin_radius - 1.0)).applyMatrix4(cab.matrixWorld);
            m4.compose(v, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2 - a - s.angle, 0)), new THREE.Vector3(0.95, 0.95, 0.95)); W.setPerson(rim, k, m4, 700 + k, 0, 0); }
          W.commitPeople(rim); });
        addMovingBulbs(cab, Array.from({ length: 64 }, (_, k) => [Math.cos(k / 64 * 6.283) * (p.cabin_radius + 0.25), -p.cabin_height / 2 - 0.3, Math.sin(k / 64 * 6.283) * (p.cabin_radius + 0.25)]), 'hub', 0xffe0a0, 0.2);
        for (let yy = 8; yy < H - 2; yy += 9) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; const q = L.p(Math.cos(a) * (mr + 0.15), yy, Math.sin(a) * (mr + 0.15)); addBulb('hub', q[0], q[1], q[2], 0x9fe3ff, 0.2); }
        for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; const q = L.p(Math.cos(a) * (mr + 1.25), H + 1.3, Math.sin(a) * (mr + 1.25)); addBulb('hub', q[0], q[1], q[2], 0xffe0a0, 0.3); }
        addPoint('hub', x, 12, z + 14, 0xffe0b0, 1, 60);
        break;
      }
      case 'bumper_car_pavilion': {
        const w = p.w, d = p.d, h = p.h; const c = p.colors;
        L.box('solid', 0, 0.15, 0, w, 0.3, d, 0x8a8a8a); L.box('roof', 0, h, 0, w + 1, 0.8, d + 1, hex(c.roof)); L.box('solid', 0, h - 0.8, d / 2 + 0.5, w + 1, 1.2, 0.3, hex(c.fascia));
        L.box('solid', 0, h / 2, -d / 2, w, h, 0.4, hex(c.roof)); L.box('solid', -w / 2, h / 2, 0, 0.4, h, d, hex(c.roof)); L.box('solid', w / 2, h / 2, 0, 0.4, h, d, hex(c.roof));
        for (let i = 0; i < 7; i++) L.box('solid', -w / 2 + i * w / 6, h / 2, d / 2, 0.5, h, 0.5, hex(c.fascia));
        for (let i = 0; i < 24; i++) L.box('solid', -w / 2 + 1 + (i % 12) * (w - 2) / 11, 0.5, (i < 12 ? -1 : 1) * (d / 2 - 1), (w - 2) / 12, 0.5, 0.4, i % 2 ? 0xf4b942 : 0x222222);
        const cars = []; const carGeo = merge([S(cyl(1, 1, 0.55, 12), 1.0, 1, 0.75).translate(0, 0.45, 0), new THREE.TorusGeometry(1.0, 0.15, 5, 16).rotateX(Math.PI / 2).scale(1, 1, 0.75).translate(0, 0.3, 0), cyl(0.04, 0.04, h - 1.2, 4, 0, (h - 1.2) / 2 + 0.6, -0.5)]);
        for (let k = 0; k < p.cars; k++) cars.push(dyn(carGeo, 'ride', hex(c.cars[k % c.cars.length]), g));
        const rim = W.makePeople(p.cars, 'rides'); const m4 = new THREE.Matrix4();
        anim.push(t => { cars.forEach((cr, k) => { const a = t * (0.25 + hash(k) * 0.2) + k * 2.1; cr.position.set(Math.sin(a * 1.3 + k) * (w / 2 - 3), 0, Math.cos(a * 0.9 + k * 0.7) * (d / 2 - 3)); cr.rotation.y = a * 1.7 + k; cr.updateMatrixWorld(true);
          const v = new THREE.Vector3(0, -0.15, 0.1).applyMatrix4(cr.matrixWorld); m4.compose(v, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, cr.rotation.y + rot, 0)), new THREE.Vector3(0.94, 0.94, 0.94)); W.setPerson(rim, k, m4, 900 + k, -1, 0); });
          W.commitPeople(rim); });
        for (let i = 0; i < 50; i++) { const q = L.p(-w / 2 + i * w / 49, h - 0.2, d / 2 + 0.7); addBulb(land, q[0], q[1], q[2], i % 3 ? 0xffc76b : 0x9fe3ff, 0.16); }
        addPoint(land, x, h - 1, z, 0xd0b0ff, 1, 30);
        break;
      }
      case 'dark_ride_show_building': {
        L.box('solid', 0, p.h / 2, 0, p.w, p.h, p.d, 0x6e7f5e);
        // stepped stone ruin facade on the south
        for (let i = 0; i < 9; i++) { const ww = p.w - i * 4; L.box('solid', 0, 1.5 + i * 1.6, p.d / 2 + 1.2 - i * 0.15, ww, 1.6, 2.4, i % 2 ? 0x9b8b78 : 0x8c7d6a); }
        for (let i = 0; i < 40; i++) L.box('solid', -p.w / 2 + hash(i) * p.w, 0.5 + hash(i * 3) * p.h * 0.8, p.d / 2 + 2.4, 1 + hash(i * 7) * 1.5, 0.8 + hash(i * 9), 0.3, 0x7d6e5c);
        L.box('solid', 0, 3.2, p.d / 2 + 2.45, 6, 6.4, 0.2, 0x1a1410); L.g('cyl12', 'solid', 0, 6.4, p.d / 2 + 2.45, 6, 0.4, 6, 0x1a1410, 0, Math.PI / 2);
        for (let i = 0; i < 30; i++) L.box('leaf', -p.w / 2 + hash(i * 5) * p.w, p.h - 1 - hash(i * 2) * 4, p.d / 2 + 2.5, 0.5, 2 + hash(i) * 5, 0.2, 0x3b6e3a);
        for (const sx of [-1, 1]) { L.g('cyl6', 'solid', sx * 4.5, 2, p.d / 2 + 3.2, 0.25, 4, 0.25, 0x5a3a22); L.g('cone8', 'glow:jungle', sx * 4.5, 4.3, p.d / 2 + 3.2, 0.6, 0.9, 0.6, 0xff7a20); const q = L.p(sx * 4.5, 4.6, p.d / 2 + 3.2); addBulb('jungle', q[0], q[1], q[2], 0xff8a30, 0.45); }
        break;
      }
      case 'kiddie_planes': case 'kiddie_boats': case 'kiddie_trucks': case 'kiddie_drop_tower': case 'playground': {
        const rr = p.radius || p.pool_radius || 5; const cols = (p.colors || ['#F4A7B9', '#A8D8EA', '#FFE08A', '#B8E0B0']).map(hex);
        if (r.type === 'kiddie_planes') {
          L.g('cyl20', 'ride', 0, 0.3, 0, rr * 2 + 2, 0.6, rr * 2 + 2, 0xb8e0b0); L.g('cyl12', 'ride', 0, 2.2, 0, 0.8, 4.4, 0.8, 0xffe08a); L.g('cone12', 'fabric', 0, 5.0, 0, 3.6, 1.4, 3.6, 0xf4a7b9);
          const hub = new THREE.Group(); hub.position.y = 2.5; g.add(hub);
          const planeGeo = merge([S(cyl(0.35, 0.25, 1.6, 8), 1, 1, 1).rotateX(Math.PI / 2), box(2.0, 0.08, 0.5, 0, 0.05, 0.1), box(0.9, 0.06, 0.3, 0, 0.1, -0.7), box(0.06, 0.4, 0.3, 0, 0.3, -0.7), cyl(0.05, 0.05, rr, 4).rotateZ(Math.PI / 2).translate(rr / 2, 0, 0)]);
          for (let k = 0; k < p.arms; k++) { const a = k / p.arms * Math.PI * 2; const m = dyn(planeGeo, 'ride', cols[k % 4], hub); m.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); m.rotation.y = -a; }
          anim.push(t => { hub.rotation.y = t * Math.PI * 2 / p.period_s; hub.position.y = 2.3 + Math.sin(t * 0.7) * 0.4; });
        } else if (r.type === 'kiddie_boats') {
          for (let k = 0; k < p.boats; k++) { const a = k / p.boats * Math.PI * 2; L.g('sph', 'ride', Math.cos(a) * (rr - 2), 0.45, Math.sin(a) * (rr - 2), 1.0, 0.5, 1.8, cols[k % cols.length], -a); }
          L.g('cyl12', 'ride', 0, 1.5, 0, 0.6, 3, 0.6, 0xffffff);
        } else if (r.type === 'kiddie_trucks') {
          L.box('solid', 0, 0.05, 0, p.oval_length + 2, 0.1, p.oval_width + 2, 0x7f8c8d);
          const trucks = []; const trGeo = merge([box(1.0, 0.6, 1.6, 0, 0.5, 0), box(0.9, 0.5, 0.6, 0, 1.0, 0.4)]);
          for (let k = 0; k < p.trucks; k++) trucks.push(dyn(trGeo, 'ride', [0xe74c3c, 0x3498db, 0xf1c40f][k % 3], g));
          anim.push(t => { trucks.forEach((tk, k) => { const a = t * 2 * Math.PI / p.period_s + k / p.trucks * Math.PI * 2; tk.position.set(Math.cos(a) * p.oval_length / 2 * 0.8, 0, Math.sin(a) * p.oval_width / 2 * 0.8); tk.rotation.y = -a; }); });
        } else if (r.type === 'kiddie_drop_tower') {
          L.g('cyl20', 'ride', 0, 0.2, 0, 7, 0.4, 7, 0xffe08a); L.g('cyl12', 'ride', 0, p.height / 2, 0, 0.7, p.height, 0.7, 0xc3a6e0); L.g('sph', 'ride', 0, p.height + 0.4, 0, 1.4, 1.4, 1.4, 0xffe08a);
          const ring = dyn(cyl(1.4, 1.4, 0.6, 16), 'ride', 0xf4a7b9, g); anim.push(t => { const u = (t % 9) / 9; ring.position.y = 1 + (u < 0.6 ? u / 0.6 : u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3) * (p.height - 2.5); });
        } else { // playground
          L.box('solid', 0, 0.06, 0, p.w, 0.12, p.d, 0xe7b8a6);
          L.g('cone4', 'ride', -3, 1.6, -2, 3.6, 3.2, 3.6, 0xc0392b); L.box('ride', 2.5, 1.6, -1, 1.6, 3.2, 1.6, 0x3498db); L.box('ride', 2.5, 1.0, 1.5, 0.8, 0.1, 4, 0xf1c40f, 0, 0.5); L.box('solid', -2, 0.15, 3, 4, 0.3, 3, 0xf0d9a0);
        }
        break;
      }
      case 'lake_boats': {
        const boats = p.boats; const items = [];
        const swanGeo = merge([S(sph(0.5, 10, 6), 1.3, 0.55, 2.2).translate(0, 0.25, 0), cyl(0.1, 0.13, 1.0, 6, 0, 0.9, 0.75).rotateX(0), S(sph(0.18, 8, 6), 1, 1, 1.4).translate(0, 1.45, 0.82), cone(0.06, 0.25, 5).rotateX(Math.PI / 2).translate(0, 1.45, 1.1), box(0.9, 0.5, 0.8, 0, 0.55, -0.35)]);
        const swanIM = new THREE.InstancedMesh(swanGeo, W.mat('ride'), boats.length); swanIM.frustumCulled = false; swanIM.castShadow = true; G('rides').add(swanIM);
        const c = new THREE.Color(); boats.forEach((b, k) => swanIM.setColorAt(k, c.set(b.kind && b.kind.includes('swan') ? 0xffffff : hex(b.color))));
        const rim = W.makePeople(boats.length * 2, 'rides'); const m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4();
        anim.push(t => { boats.forEach((b, k) => { const a = b.phase + Math.PI * 2 * t / b.period_s; const bx = b.route_center[0] + Math.cos(a) * b.route_radii[0], bz = b.route_center[1] + Math.sin(a) * b.route_radii[1];
          const hd = Math.atan2(-Math.sin(a) * b.route_radii[0], Math.cos(a) * b.route_radii[1]); m4.compose(new THREE.Vector3(bx, -0.45 + Math.sin(t * 2 + k) * 0.04, bz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hd), new THREE.Vector3(1.2, 1.2, 1.2)); swanIM.setMatrixAt(k, m4);
          for (let j = 0; j < 2; j++) { m5.copy(m4).multiply(new THREE.Matrix4().makeTranslation(j ? 0.3 : -0.3, 0.38 - 0.81, -0.25)).multiply(new THREE.Matrix4().makeScale(0.8, 0.8, 0.8)); W.setPerson(rim, k * 2 + j, m5, 1200 + k * 2 + j, -1, 0); } });
          swanIM.instanceMatrix.needsUpdate = true; W.commitPeople(rim); });
        break;
      }
    }
  }
  // ---- stations
  for (const r of D.rides) {
    if (!r.station) continue; const s = r.station; const L = frame(s.center[0], 0, s.center[1], s.rot || 0); const land = r.land;
    const ph = s.platform_height || 1.0; const pal = (D.lands.find(l => l.id === land) || D.lands[0]).palette;
    if (r.id === 'hero_coaster') {
      L.box('solid', 0, ph / 2, s.d / 2 - 3.5, s.w, ph, 5, 0xb9b4ae); L.box('solid', 0, ph / 2, -s.d / 2 + 3.5, s.w, ph, 5, 0xb9b4ae);
      for (let i = 0; i <= 10; i++) for (const sz of [-1, 1]) L.g('cyl8', 'metal', -s.w / 2 + i * s.w / 10, s.h / 2, sz * (s.d / 2 - 0.4), 0.35, s.h, 0.35, 0x1f2a44);
      for (let i = 0; i < 8; i++) { const xx = -s.w / 2 + (i + 0.5) * s.w / 8; L.box('roof', xx, s.h + 0.7, 0, s.w / 8 + 0.05, 0.15, s.d + 1.0, 0x1f2a44, 0, 0, 0.32); L.box(i % 2 ? 'glass' : 'win:thrill', xx + s.w / 16 - 0.1, s.h + 0.7, 0, 0.1, 1.3, s.d, 0x9fd3e8); }
      L.box('ride', 0, s.h + 0.05, s.d / 2 + 0.55, s.w + 1, 0.8, 0.12, 0xe23b2e); L.box('ride', 0, s.h + 0.05, -s.d / 2 - 0.55, s.w + 1, 0.8, 0.12, 0xe23b2e);
      L.box('ride', -s.w / 2 - 0.5, s.h + 0.05, 0, 0.12, 0.8, s.d + 1, 0xe23b2e); L.box('ride', s.w / 2 + 0.5, s.h + 0.05, 0, 0.12, 0.8, s.d + 1, 0xe23b2e);
      for (let i = 0; i < 14; i++) L.box('metal', -s.w / 2 + 6 + i * 2.2, ph + 0.55, 2.3, 1.4, 1.1, 0.06, 0xb0b8c0);
      for (let i = 0; i < 60; i++) { const q = L.p(-s.w / 2 + i * s.w / 59, s.h - 0.3, s.d / 2 + 0.62); addBulb('thrill', q[0], q[1], q[2], 0xff5040, 0.12); }
      addPoint('thrill', s.center[0], s.h - 1, s.center[1], 0xffc8a0, 1, 30);
      if (r.transfer) { const sh = r.transfer.shed; const L2 = frame(sh.center[0], 0, sh.center[1], 0); L2.box('solid', 0, sh.h / 2, 0, sh.w, sh.h, sh.d, 0x8a929c); L2.g('gable', 'roof', 0, sh.h, 0, sh.w + 0.6, 2, sh.d + 0.6, 0x2c3e50); L2.box('solid', -sh.w / 2 - 0.02, sh.h * 0.4, 0, 0.05, sh.h * 0.7, 3.5, 0x555555); }
    } else {
      L.box('solid', 0, ph / 2, s.d / 4 + 1.0, s.w, ph, s.d / 2 - 2, hex(pal.ground || '#b9b4ae'));
      for (let i = 0; i <= 6; i++) for (const sz of [-1, 1]) L.g('cyl8', 'solid', -s.w / 2 + i * s.w / 6, s.h / 2, sz * (s.d / 2 - 0.4), 0.35, s.h, 0.35, hex(pal.trim));
      L.g('gable', 'roof', 0, s.h, 0, s.w + 1.2, Math.min(3.5, s.d * 0.3), s.d + 1.2, hex(pal.roof));
      for (let i = 0; i < 30; i++) { const q = L.p(-s.w / 2 + i * s.w / 29, s.h - 0.2, s.d / 2 + 0.6); addBulb(land, q[0], q[1], q[2], 0xffc76b, 0.13); }
    }
  }
  // ---- queues: switchback rails with posts, canopies by style, fans/planters
  for (const q of D.queues) {
    const land = (D.rides.find(r => r.id === q.ride) || {}).land || W.landOf(q.center[0], q.center[1]);
    const rh = q.rail_height || 1.0; const railC = land === 'frontier' || land === 'jungle' ? 0x7b5e3b : land === 'kiddie' ? 0xf4a7b9 : land === 'thrill' ? 0x1f2a44 : 0x2d4a3a;
    for (const [a, b] of q.rails) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / (q.post_spacing || 2.2)));
      put('box', 'metal', beamM([a[0], rh, a[1]], [b[0], rh, b[1]], 0.06), railC); put('box', 'metal', beamM([a[0], rh * 0.5, a[1]], [b[0], rh * 0.5, b[1]], 0.04), railC);
      for (let i = 0; i <= n; i++) { const u = i / n; put('cyl6', 'metal', cmp(a[0] + (b[0] - a[0]) * u, rh / 2 + 0.03, a[1] + (b[1] - a[1]) * u, 0, 0.09, rh + 0.06, 0.09), railC); }
    }
    for (const c of q.canopies) {
      const L = frame(c.center[0], 0, c.center[1], c.rot); const h = c.height; const st = c.style;
      const postC = st.includes('timber') || st === 'thatch' || st.includes('vine') ? 0x7b5e3b : 0xdddddd;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.g('cyl6', 'solid', sx * (c.w / 2 - 0.2), h / 2, sz * (c.d / 2 - 0.2), 0.16, h, 0.16, postC);
      if (st === 'fabric_sails') { // two hypar-ish triangles per bay
        for (const sz of [-1, 1]) { const gg = new THREE.BufferGeometry(); const P = (x2, y2, z2) => L.p(x2, y2, z2);
          const A = P(-c.w / 2, h + 0.6, 0), B2 = P(c.w / 2, h - 0.2, 0), C2 = P(0, h + 0.2, sz * c.d / 2);
          gg.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B2, ...C2], 3)); gg.computeVertexNormals(); const m = new THREE.Mesh(gg, W.M.std({ color: sz > 0 ? 0xf4f4f0 : 0xe23b2e, side: THREE.DoubleSide, snowK: 0.6, rough: 0.7 })); m.castShadow = true; G('static').add(m); }
      } else if (st === 'thatch') { L.g('gable', 'roof', 0, h, 0, c.w + 0.8, 1.8, c.d + 0.8, 0xb08d57); }
      else if (st.includes('pergola')) { for (let i = 0; i < Math.round(c.w / 0.6); i++) L.box('solid', -c.w / 2 + i * 0.6, h + 0.1, 0, 0.12, 0.2, c.d + 0.6, 0x8b6b4a); for (const sz of [-1, 1]) L.box('solid', 0, h - 0.1, sz * (c.d / 2 - 0.2), c.w + 0.6, 0.25, 0.2, 0x7b5e3b); if (st.includes('vine')) for (let i = 0; i < 14; i++) L.g('sph0', 'leaf', -c.w / 2 + hash(i + c.center[0]) * c.w, h + 0.3, -c.d / 2 + hash(i * 3 + c.center[1]) * c.d, 1.5, 0.5, 1.5, 0x4f7f3a); }
      else { const n = 10; const cc = st.includes('striped') ? 0x2e86c1 : 0xf4a7b9; for (let i = 0; i < n; i++) L.box('fabric', -c.w / 2 + (i + 0.5) * c.w / n, h + 0.4, 0, c.w / n, 0.06, c.d + 0.4, i % 2 ? 0xffffff : cc, 0, 0, 0); }
    }
    // fans + planters at the ends
    if (q.fans_and_planters) { const [cx, cz] = q.center; for (const sx of [-1, 1]) { put('cyl12', 'solid', cmp(cx + sx * (q.w / 2 + 1.2), 0.45, cz, 0, 1.2, 0.9, 1.2), 0x2d4a3a); put('sph', 'leaf', cmp(cx + sx * (q.w / 2 + 1.2), 1.2, cz, 0, 1.4, 1.0, 1.4), 0x5e8c40); } }
  }
  W.flush();

  // ---- moving bulbs: one instanced mesh per land, positions updated per frame from parent objects
  const byLand = {}; for (const b of bulbsLocal) (byLand[b.land] = byLand[b.land] || []).push(b);
  W.movingBulbs = [];
  const bulbGeo = new THREE.IcosahedronGeometry(0.5, 1);
  for (const [land, list] of Object.entries(byLand)) {
    const im = new THREE.InstancedMesh(bulbGeo, W.mat('bulb:' + land), list.length); im.frustumCulled = false; G('bulbs').add(im);
    const c = new THREE.Color(); list.forEach((b, k) => im.setColorAt(k, c.set(b.color)));
    im.userData.list = list; im.userData.land = land; W.movingBulbs.push(im);
  }
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3();
  anim.push(() => {
    for (const im of W.movingBulbs) { const list = im.userData.list; let lastObj = null;
      for (let k = 0; k < list.length; k++) { const b = list[k]; if (b.obj !== lastObj) { b.obj.updateMatrixWorld(true); lastObj = b.obj; }
        v.set(b.p[0], b.p[1], b.p[2]).applyMatrix4(b.obj.matrixWorld); im.setMatrixAt(k, m4.compose(v, q0, s0.setScalar(b.size * (W.bulbScale || 1)))); }
      im.instanceMatrix.needsUpdate = true; }
  });
}
