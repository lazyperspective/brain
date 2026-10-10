// Set dressing that moves or is staged for the story: bridge, jar stack, crowd, ships, trams, birds, turbine, clocks.
import * as THREE from 'three';
import { L, makeFishShip, M } from './city.js';
import { paint } from './mats.js';
import * as C from './chars.js';
import { mulberry32, V, lerp } from './util.js';

export const SP = { // staged positions in the market
  jar: V(-17.0, 8, -0.2),
  vendor: V(-17.15, 8, 1.55),
  customer: V(-15.85, 8.45, 1.35),
  bell: V(-16.95, 10.0, 0.05),
  noodle: V(-20.2, 8, 4.4),
  awning: V(-19.7, 8, 8.2),
  g1: V(-19.6, 8, 0.2), g2: V(-20.4, 8, 1.9), g3: V(-21.0, 8, -0.8),
};

export function buildProps(scene, city) {
  const P = {};
  const r = mulberry32(77);
  // ---- telescoping bridge deck (4 nested sections)
  const deckM = paint(0x9a6a48, { roughness: 0.7, strokeAmt: 0.25, rim: 0.3 });
  const railM = paint(0xc9a24a, { roughness: 0.35, metalness: 0.8, rim: 0.4 });
  P.bridge = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group();
    const w = 1.3 - k * 0.04, h = 0.22 - k * 0.012;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.15, h, w), deckM); deck.position.set(-2.075, -h / 2 + k * 0.004, 0); g.add(deck);
    for (const s of [-1, 1]) {
      const rl = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.04, 0.04), railM); rl.position.set(-2.075, 0.5, s * w / 2); g.add(rl);
      for (let i = 0; i <= 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), railM); p.position.set(-i * 0.83, 0.25, s * w / 2); g.add(p); }
    }
    // hazard lamp at each section's near end
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7040 })); lamp.position.set(-0.05, 0.56, w / 2); g.add(lamp);
    g.userData.lamp = lamp;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g); P.bridge.push(g);
  }
  // ---- turbine blades
  P.turbine = new THREE.Group(); P.turbine.position.copy(L.turbine);
  const bladeM = paint(0xd8c8a8, { roughness: 0.5, metalness: 0.3, rim: 0.4 });
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.1, 1.5), bladeM); b.position.set(Math.cos(i * 1.047) * 4, 0, Math.sin(i * 1.047) * 4); b.rotation.y = -i * 1.047; b.rotation.x = 0.35; P.turbine.add(b); }
  P.turbine.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.8, 16), railM));
  scene.add(P.turbine);
  // ---- clock hands
  P.hands = [];
  const handM = paint(0x2a2630, { roughness: 0.5, rim: 0.2 });
  if (city.anim.clock) for (const [len, w] of [[1.6, 0.12], [1.1, 0.16]]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, w), handM); h.geometry.translate(0, len / 2, 0); h.position.copy(city.anim.clock.p); scene.add(h); P.hands.push(h); }
  // ---- jar stack with Puff's jar on top
  P.jarStack = new THREE.Group(); P.jarStack.position.copy(SP.jar); scene.add(P.jarStack);
  const crate = paint(0x8a5a3c, { roughness: 0.75, rim: 0.3 });
  for (const [x, y, z, s] of [[0, 0.15, 0, 0.42], [0, 0.45, 0.02, 0.38], [0.02, 0.1, 0.42, 0.3], [0, 0.12, -0.45, 0.26]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.72, s), crate); c.position.set(x, y, z); c.castShadow = c.receiveShadow = true; P.jarStack.add(c); }
  P.smallJars = [];
  for (const [x, y, z, k] of [[0.02, 0.33, 0.42, 1], [0.0, 0.3, -0.45, 2], [-0.1, 0.68, 0.14, 3], [0.12, 0.68, -0.12, 4]]) { const j = C.makeJar(0.075, k); j.position.set(x, y, z); P.jarStack.add(j); P.smallJars.push(j); }
  P.puffJar = C.makeJar(0.2, 0); P.puffJar.position.set(0, 0.86, 0); P.jarStack.add(P.puffJar);
  P.puffJar.userData.inner.visible = false;
  P.latch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.03), railM); P.latch.position.set(0, 0.21 + 0.86, 0.2); P.jarStack.add(P.latch);
  // hanging jars along the stall canopies (the glowing "weather jars" of the market)
  P.hangJars = [];
  for (const s of city.market.stalls) for (let i = 0; i < 5; i++) {
    const a = i / 5 * 6.28 + r(); const j = C.makeJar(0.06 + r() * 0.03, Math.floor(r() * 5));
    j.position.set(s.x + Math.cos(a) * 1.55, s.y + 2.25 - r() * 0.3, s.z + Math.sin(a) * 1.55); scene.add(j); P.hangJars.push({ j, ph: r() * 6 });
  }
  // ---- alarm bell
  P.bell = C.makeBell(); P.bell.root.position.copy(SP.bell); scene.add(P.bell.root);
  // ---- noodle cart
  P.noodle = C.makeNoodleCart(); P.noodle.root.position.copy(SP.noodle); P.noodle.root.rotation.y = Math.PI / 2; scene.add(P.noodle.root);
  // ---- sprung awning (cloth on a spring post) Pip ricochets off
  P.awning = new THREE.Group(); P.awning.position.copy(SP.awning); scene.add(P.awning);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), railM); post.position.y = 0.65; P.awning.add(post);
  const spring = []; for (let i = 0; i <= 40; i++) { const t = i / 40; spring.push(V(Math.cos(t * 50) * 0.08, 1.3 + t * 0.35, Math.sin(t * 50) * 0.08)); }
  P.awning.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spring), 80, 0.015, 4), railM));
  P.awningCloth = new THREE.Group(); P.awningCloth.position.y = 1.7; P.awning.add(P.awningCloth);
  for (let i = 0; i < 6; i++) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 1.1), paint(i % 2 ? 0xd2564f : 0xf1e4c8, { rim: 0.5 })); strip.position.x = -0.5 + i * 0.2; P.awningCloth.add(strip); }
  P.awning.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // ---- vendor, customer, guards
  P.vendor = C.makeVendor(); scene.add(P.vendor.root);
  P.customer = C.makeCitizen(0, 501); scene.add(P.customer.root);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.08, 16), railM); disc.position.y = -0.04; P.customer.root.add(disc);
  P.guards = [C.makeGuard(0), C.makeGuard(0.04), C.makeGuard(-0.04)]; P.guards.forEach(g => scene.add(g.root));
  // ---- market crowd (varied citizens)
  P.crowd = [];
  const spots = [[-20.4, -3.5], [-19.0, -5.2], [-21.3, 2.9], [-20.9, 6.4], [-19.2, 6.1], [-21.5, -6.4], [-24.4, 3.0], [-24.6, -2.4], [-23.8, 7.8], [-19.4, -8.6], [-24.9, -6.2], [-25.0, 10], [-21.8, 9.6], [-18.8, 9.8], [-23.0, -9.4], [-27.8, 4.4], [-28.0, -1.5], [-20.6, -1.2]];
  spots.forEach(([x, z], i) => {
    const kind = [0, 1, 2, 4, 3, 0, 4, 1, 2, 4, 0, 1, 3, 2, 4, 1, 0, 2][i];
    const c = C.makeCitizen(kind, 200 + i); c.root.position.set(x, 8, z); c.root.rotation.y = r() * 6.28;
    c.base = c.root.position.clone(); c.ph = r() * 6.28; c.yaw = c.root.rotation.y;
    scene.add(c.root); P.crowd.push(c);
  });
  // ---- airships (fish-shaped) on slow loops + one hero ship over the sky rail
  P.ships = [];
  const shipDefs = [
    { c: V(-20, 22, -40), rx: 60, rz: 25, y: 22, speed: 0.03, ph: 0.2, s: 2.2, hue: 0 },
    { c: V(10, 30, -60), rx: 80, rz: 40, y: 30, speed: -0.022, ph: 2.0, s: 3.0, hue: 0.08 },
    { c: V(-60, 8, 20), rx: 50, rz: 60, y: 8, speed: 0.025, ph: 4.1, s: 1.6, hue: -0.05 },
    { c: V(30, -6, -20), rx: 40, rz: 30, y: -6, speed: 0.04, ph: 1.0, s: 1.3, hue: 0.5 },
    { c: V(-90, 40, -30), rx: 70, rz: 50, y: 40, speed: 0.018, ph: 3.0, s: 4.0, hue: 0.12 },
    { c: V(-30, -15, 50), rx: 40, rz: 20, y: -15, speed: -0.035, ph: 5.0, s: 1.8, hue: -0.1 },
  ];
  for (const d of shipDefs) { const s = makeFishShip(d.s, d.hue); scene.add(s); P.ships.push({ s, d }); }
  P.heroShip = makeFishShip(1.5, 0.03); scene.add(P.heroShip);
  // ---- trams on the cable
  P.trams = city.anim.trams.map(tr => {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.2), paint(0x5f9e94, { rim: 0.5 })); cab.position.y = -1.0; g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.3), railM); roof.position.y = -0.4; g.add(roof);
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), railM); hang.position.y = -0.2; g.add(hang);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd38a, side: THREE.DoubleSide })); w.position.set(-0.75 + i * 0.5, -0.95, s * 0.61); g.add(w); }
    scene.add(g); return { g, tr };
  });
  // ---- mechanical birds flock
  P.birds = [];
  for (let i = 0; i < 14; i++) { const b = C.makeCitizen(5, 900 + i); b.root.scale.setScalar(2.5); scene.add(b.root); P.birds.push({ b, ph: r() * 6.28, rad: 8 + r() * 6, y: 10 + r() * 8, c: V(-6 + r() * 4, 0, -4 + r() * 6), sp: 0.5 + r() * 0.3 }); }
  // ---- tiny distant traffic (little flying boats)
  P.traffic = [];
  const boatGeo = new THREE.BoxGeometry(0.8, 0.3, 0.4); const boatM = paint(0xc0704e, { rim: 0.4 });
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(boatGeo, boatM); scene.add(m); const a = r() * 6.28, d = 30 + r() * 120; P.traffic.push({ m, a, d, y: -20 + r() * 50, sp: (r() < 0.5 ? -1 : 1) * (0.02 + r() * 0.04), bob: r() * 6 }); }
  // ---- watering can & raindrop
  P.can = C.makeWateringCan(); scene.add(P.can);
  P.drop = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.05, metalness: 0.1, emissive: 0x335577 })); scene.add(P.drop);
  P.flake = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.004, 0.012), paint(0x8a4a2a)); scene.add(P.flake);
  return P;
}

const _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _e = new THREE.Euler();
// Always-on background life (ships, trams, birds, gears, turbine, crowd idle)
export function animateProps(P, city, t) {
  // gears
  const gm = city.anim.gearMesh;
  city.anim.gears.forEach((g, i) => { _e.set(0, g.ry, t * g.speed * 2, 'YXZ'); _q.setFromEuler(_e); _m4.compose(g.p, _q, new THREE.Vector3(g.r, g.r, g.r * 0.6 + 0.4)); gm.setMatrixAt(i, _m4); });
  gm.instanceMatrix.needsUpdate = true;
  P.turbine.rotation.y = t * 0.9;
  if (P.hands.length) { P.hands[0].rotation.set(0, 0, 0); P.hands[0].rotation.x = -t * 0.5; P.hands[1].rotation.x = -t * 0.04 - 1.2; }
  for (const { s, d } of P.ships) {
    const a = d.ph + t * d.speed; const x = d.c.x + Math.cos(a) * d.rx, z = d.c.z + Math.sin(a) * d.rz;
    const dx = -Math.sin(a) * d.rx * Math.sign(d.speed), dz = Math.cos(a) * d.rz * Math.sign(d.speed);
    s.position.set(x, d.y + Math.sin(t * 0.5 + d.ph) * 1.2, z); s.rotation.set(0, Math.atan2(-dz, dx), Math.sin(t * 0.7 + d.ph) * 0.05);
    s.userData.tail.rotation.y = Math.sin(t * 2 + d.ph) * 0.3; s.userData.prop.rotation.x = t * 20;
  }
  for (const { g, tr } of P.trams) {
    const u = (tr.phase + t * tr.speed) % 1; const p = tr.a.clone().lerp(tr.b, u); p.y -= tr.sag * 4 * u * (1 - u);
    g.position.copy(p); g.rotation.y = Math.atan2(-(tr.b.z - tr.a.z), tr.b.x - tr.a.x); g.rotation.z = Math.sin(t * 1.3) * 0.03;
  }
  for (const B of P.birds) {
    const a = B.ph + t * B.sp; B.b.root.position.set(B.c.x + Math.cos(a) * B.rad, B.y + Math.sin(a * 2) * 1.5, B.c.z + Math.sin(a) * B.rad);
    B.b.root.rotation.set(0, -a, 0); B.b.arms.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 18 + B.ph) * 0.7; });
  }
  for (const T of P.traffic) { const a = T.a + t * T.sp; T.m.position.set(Math.cos(a) * T.d - 10, T.y + Math.sin(t + T.bob) * 0.4, Math.sin(a) * T.d - 10); T.m.rotation.y = -a + (T.sp > 0 ? 0 : Math.PI); }
  for (const H of P.hangJars) H.j.rotation.z = Math.sin(t * 1.5 + H.ph) * 0.06;
  // crowd idle bob
  for (const c of P.crowd) {
    c.body.position.y = Math.abs(Math.sin(t * 3 + c.ph)) * 0.02; c.body.rotation.z = Math.sin(t * 2 + c.ph) * 0.05;
    c.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(t * 2.5 + c.ph) * 0.15); });
  }
}

// Telescoping bridge: near end x position
export function poseBridge(P, xEnd, t, alarm) {
  const x0 = L.bridge.x0, seg = 4.1;
  P.bridge.forEach((g, k) => {
    const near = Math.max(x0 + seg, Math.min(x0 + (k + 1) * seg, xEnd));
    g.position.set(near, L.bridge.y + k * 0.004, 0);
    g.userData.lamp.material.color.setHex(alarm && Math.sin(t * 16 + k) > 0 ? 0xff5030 : 0x803020);
  });
}
