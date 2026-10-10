// The cast: Pip, Puff, the Vendor, Clockwork Guards, Citizens, the Flower and props.
import * as THREE from 'three';
import { paint, fluffMat, G } from './mats.js';
import { clamp, lerp, noise1, mulberry32, V } from './util.js';

const capsule = (r, l, seg = 10) => new THREE.CapsuleGeometry(r, l, 4, seg);
const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent?.add(m); return m; };
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent?.add(g); return g; };

// ---------------------------------------------------------------- face canvases
function faceCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, g: c.getContext('2d'), t }; }

function drawStar(g, x, y, r, a = 0) {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r; const aa = a + i * Math.PI / 4; g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); }
  g.closePath(); g.fill();
}

// Pip's visor: dark glass with big glowing cyan-gold eyes. e = expression params
function drawPipFace(F, e) {
  const { g, c } = F; const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  // visor shape (rounded) — dark glass gradient
  const rr = 120;
  g.save();
  g.beginPath(); g.roundRect(14, 20, W - 28, H - 40, rr); g.clip();
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1b2440'); bg.addColorStop(1, '#0b1020');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const eyeY = H * 0.5 + (e.lookY || 0) * 30, sep = W * 0.2 * (e.sep || 1);
  const open = clamp(e.open ?? 1, 0, 1), size = (e.size || 1);
  for (const s of [-1, 1]) {
    const cx = W / 2 + s * sep + (e.lookX || 0) * 26 + (e.cross ? -s * 26 : 0) * 0, cy = eyeY;
    const ex = 86 * size, ey = 98 * size;
    if (e.happy > 0.5) { // ^ ^ arcs
      g.strokeStyle = '#7ff3ff'; g.lineWidth = 22; g.lineCap = 'round'; g.shadowColor = '#5fe8ff'; g.shadowBlur = 30;
      g.beginPath(); g.arc(cx, cy + 30, 58 * size, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.shadowBlur = 0;
      continue;
    }
    if (e.squint > 0.5) { // > < straining
      g.strokeStyle = '#7ff3ff'; g.lineWidth = 20; g.lineCap = 'round'; g.shadowColor = '#5fe8ff'; g.shadowBlur = 25;
      g.beginPath(); g.moveTo(cx - s * 50, cy - 40); g.lineTo(cx + s * 30, cy); g.lineTo(cx - s * 50, cy + 40); g.stroke(); g.shadowBlur = 0;
      continue;
    }
    g.save();
    g.translate(cx, cy); g.scale(1, Math.max(0.04, open));
    // outer glow ring (gold)
    g.shadowColor = 'rgba(255,190,90,0.9)'; g.shadowBlur = 40;
    g.fillStyle = '#e8a347'; g.beginPath(); g.ellipse(0, 0, ex, ey, 0, 0, 7); g.fill(); g.shadowBlur = 0;
    // iris: cyan gradient
    const ig = g.createRadialGradient(0, ey * 0.25, 4, 0, 0, ex * 0.9);
    ig.addColorStop(0, '#d9ffff'); ig.addColorStop(0.45, '#55e0f0'); ig.addColorStop(1, '#127fae');
    g.fillStyle = ig; g.beginPath(); g.ellipse(0, 0, ex * 0.84, ey * 0.86, 0, 0, 7); g.fill();
    // pupil
    const pz = (e.pupil || 1) * (e.cross ? 0.8 : 1);
    const px = (e.lookX || 0) * 18 + (e.cross ? s * -30 : 0), py = -(e.lookY || 0) * 10 * 0;
    g.fillStyle = '#071425'; g.beginPath(); g.ellipse(px, py, ex * 0.42 * pz, ey * 0.46 * pz, 0, 0, 7); g.fill();
    // highlights
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.ellipse(px - ex * 0.28, py - ey * 0.32, ex * 0.2, ey * 0.17, -0.5, 0, 7); g.fill();
    g.beginPath(); g.ellipse(px + ex * 0.3, py + ey * 0.3, ex * 0.08, ey * 0.07, 0, 0, 7); g.fill();
    if (e.sparkle > 0) { g.fillStyle = `rgba(255,250,220,${e.sparkle})`; drawStar(g, px + ex * 0.18, py - ey * 0.05, 34 * e.sparkle, (e.t || 0) * 2); drawStar(g, px - ex * 0.35, py + ey * 0.3, 18 * e.sparkle, -(e.t || 0) * 3); }
    if (e.shimmer > 0) { // watery eyes
      g.fillStyle = `rgba(200,255,255,${0.5 * e.shimmer})`; g.beginPath(); g.ellipse(0, ey * 0.62, ex * 0.7, ey * 0.2, 0, 0, 7); g.fill();
      g.fillStyle = `rgba(255,255,255,${0.9 * e.shimmer})`; g.beginPath(); g.ellipse(px + Math.sin((e.t || 0) * 9) * 6, py - ey * 0.1, ex * 0.12, ey * 0.1, 0, 0, 7); g.fill();
    }
    g.restore();
    // sad/droopy eyelid: a dark wedge from the top, tilted down to the outside
    const droop = e.droop || 0, angry = e.angry || 0;
    const lidTop = 1 - open;
    if (droop > 0 || angry > 0 || lidTop > 0) {
      g.fillStyle = '#121a30';
      g.beginPath();
      const yIn = cy - ey * (1.05 - droop * 0.55 - angry * 0.9 - lidTop * 0.2);
      const yOut = cy - ey * (1.05 - droop * 1.0 - lidTop * 0.2 + angry * 0.2);
      g.moveTo(cx - s * ex * 1.3, cy - ey * 1.6); g.lineTo(cx + s * ex * 1.3, cy - ey * 1.6);
      g.lineTo(cx + s * ex * 1.25, yOut); g.lineTo(cx - s * ex * 1.25, yIn); g.closePath(); g.fill();
    }
  }
  // blush
  if (e.blush > 0) {
    for (const s of [-1, 1]) { const gr = g.createRadialGradient(W / 2 + s * sep * 1.45, eyeY + 95, 2, W / 2 + s * sep * 1.45, eyeY + 95, 55); gr.addColorStop(0, `rgba(255,120,150,${0.75 * e.blush})`); gr.addColorStop(1, 'rgba(255,120,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  }
  // tiny mouth
  if (e.mouth) {
    g.strokeStyle = '#7ff3ff'; g.fillStyle = '#7ff3ff'; g.lineWidth = 9; g.lineCap = 'round'; g.shadowColor = '#5fe8ff'; g.shadowBlur = 18;
    const mx = W / 2, my = eyeY + 118;
    g.beginPath();
    if (e.mouth === 'smile') g.arc(mx, my - 14, 22, 0.2 * Math.PI, 0.8 * Math.PI);
    else if (e.mouth === 'grin') { g.arc(mx, my - 10, 26, 0, Math.PI); g.closePath(); g.fill(); }
    else if (e.mouth === 'o') g.ellipse(mx, my, 10, 13, 0, 0, 7);
    else if (e.mouth === 'w') { g.moveTo(mx - 26, my - 6); g.quadraticCurveTo(mx - 13, my + 12, mx, my - 2); g.quadraticCurveTo(mx + 13, my + 12, mx + 26, my - 6); }
    else if (e.mouth === 'wobble') { g.moveTo(mx - 22, my); for (let i = 0; i <= 8; i++) g.lineTo(mx - 22 + i * 5.5, my + (i % 2 ? -5 : 5)); }
    else if (e.mouth === 'flat') { g.moveTo(mx - 14, my); g.lineTo(mx + 14, my); }
    g.stroke(); g.shadowBlur = 0;
  }
  // glass reflection streaks
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.beginPath(); g.ellipse(W * 0.3, H * 0.2, W * 0.28, H * 0.07, -0.15, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,230,200,0.07)';
  g.beginPath(); g.ellipse(W * 0.75, H * 0.85, W * 0.15, H * 0.04, 0.1, 0, 7); g.fill();
  g.restore();
  // visor bezel
  g.strokeStyle = '#2a2a33'; g.lineWidth = 14; g.beginPath(); g.roundRect(14, 20, W - 28, H - 40, rr); g.stroke();
  F.t.needsUpdate = true;
}

// Puff's face: drawn on a transparent canvas plane in front of the cloud
function drawPuffFace(F, e) {
  const { g, c } = F; const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const cx = W / 2 + (e.lookX || 0) * 18, cy = H * 0.45 + (e.lookY || 0) * 10;
  const sep = 78 * (e.sep || 1);
  // blush
  const bl = e.blush ?? 1;
  for (const s of [-1, 1]) { const gr = g.createRadialGradient(cx + s * 118, cy + 42, 2, cx + s * 118, cy + 42, 46); gr.addColorStop(0, `rgba(255,128,160,${0.85 * bl})`); gr.addColorStop(1, 'rgba(255,128,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const ex = cx + s * sep, ey = cy;
    const type = e.eyes || 'open';
    g.strokeStyle = '#3a2440'; g.fillStyle = '#2b1a33'; g.lineWidth = 11;
    if (type === 'happy') { g.beginPath(); g.arc(ex, ey + 14, 24, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    else if (type === 'closed') { g.beginPath(); g.arc(ex, ey - 6, 22, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
    else if (type === 'squeeze') { g.beginPath(); g.moveTo(ex - s * 22, ey - 18); g.lineTo(ex + s * 14, ey); g.lineTo(ex - s * 22, ey + 18); g.stroke(); }
    else {
      const sz = (e.eyeSize || 1) * (type === 'wide' ? 1.25 : 1);
      const open = clamp(e.open ?? 1, 0.05, 1);
      g.save(); g.translate(ex, ey); g.scale(1, open);
      g.beginPath(); g.ellipse(0, 0, 21 * sz, 27 * sz, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.ellipse(-7 * sz, -10 * sz, 8 * sz, 9 * sz, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(7 * sz, 9 * sz, 3.5 * sz, 3.5 * sz, 0, 0, 7); g.fill();
      if (e.tears > 0) { g.fillStyle = `rgba(150,220,255,${0.8 * e.tears})`; g.beginPath(); g.ellipse(0, 22 * sz, 18 * sz, 7 * sz, 0, 0, 7); g.fill(); }
      g.restore();
      if (e.sad > 0) { g.strokeStyle = '#3a2440'; g.lineWidth = 7; g.beginPath(); g.moveTo(ex - s * 22, ey - 42 - e.sad * 12); g.lineTo(ex + s * 18, ey - 38 + e.sad * 4); g.stroke(); }
      if (e.determined > 0) { g.strokeStyle = '#3a2440'; g.lineWidth = 8; g.beginPath(); g.moveTo(ex - s * 26, ey - 46 - e.determined * 6); g.lineTo(ex + s * 14, ey - 36 + e.determined * 4); g.stroke(); }
    }
  }
  // nose wrinkle before the sneeze
  if (e.wrinkle > 0) { g.strokeStyle = `rgba(90,50,90,${e.wrinkle})`; g.lineWidth = 5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 10, cy + 6); g.lineTo(cx + s * 22, cy + 12); g.stroke(); g.beginPath(); g.moveTo(cx + s * 10, cy + 16); g.lineTo(cx + s * 22, cy + 18); g.stroke(); } }
  // mouth
  const m = e.mouth || 'smile', mo = e.mouthOpen ?? 0.5, my = cy + 44;
  g.strokeStyle = '#3a2440'; g.fillStyle = '#7a3050'; g.lineWidth = 8;
  g.beginPath();
  if (m === 'smile') { g.arc(cx, my - 10, 16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  else if (m === 'grin') { g.moveTo(cx - 24, my - 4); g.quadraticCurveTo(cx, my + 34 * mo + 6, cx + 24, my - 4); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ff9fb4'; g.beginPath(); g.ellipse(cx, my + 12 * mo + 2, 9, 5 * mo + 1, 0, 0, 7); g.fill(); }
  else if (m === 'o') { g.ellipse(cx, my, 9 + 6 * mo, 11 + 12 * mo, 0, 0, 7); g.fill(); g.stroke(); }
  else if (m === 'open') { g.ellipse(cx, my + 6, 26 * mo + 8, 34 * mo + 6, 0, 0, 7); g.fill(); g.stroke(); }
  else if (m === 'frown') { g.arc(cx, my + 14, 14, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
  else if (m === 'wobble') { g.moveTo(cx - 20, my); for (let i = 0; i <= 8; i++) g.lineTo(cx - 20 + i * 5, my + (i % 2 ? -4 : 4)); g.stroke(); }
  else if (m === 'strain') { g.moveTo(cx - 18, my); g.lineTo(cx + 18, my); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 18, my - 6); g.lineTo(cx - 18, my + 6); g.moveTo(cx + 18, my - 6); g.lineTo(cx + 18, my + 6); g.stroke(); }
  F.t.needsUpdate = true;
}

// ---------------------------------------------------------------- PIP
export function makePip() {
  const root = new THREE.Group(); root.name = 'pip';
  const cream = paint(0xf0e3c6, { roughness: 0.38, metalness: 0.08, strokeAmt: 0.12, strokeScale: 3, rim: 0.55, rimColor: 0xffe2bd });
  const copper = paint(0xc0783f, { roughness: 0.3, metalness: 0.75, strokeAmt: 0.15, strokeScale: 3, rim: 0.4 });
  const dark = paint(0x3a3440, { roughness: 0.5, metalness: 0.4, strokeAmt: 0.1, rim: 0.3 });
  const scarfM = paint(0xd9542c, { roughness: 0.85, metalness: 0, strokeAmt: 0.18, strokeScale: 4, rim: 0.5, rimColor: 0xffb070, side: THREE.DoubleSide });
  const pack = paint(0x4d6a8a, { roughness: 0.6, metalness: 0.1, strokeAmt: 0.15, strokeScale: 3, rim: 0.4 });

  const body = grp(root, 0, 0, 0);          // squash/stretch pivot at the feet
  const hips = grp(body, 0, 0.15, 0);
  const torso = grp(hips, 0, 0, 0);
  const barrel = new THREE.LatheGeometry([0, 0.2, 0.45, 0.7, 0.9, 1].map((t, i) => new THREE.Vector2(0.105 * Math.sin(0.35 + t * 2.4) + 0.01, t * 0.17 - 0.02)), 20);
  mesh(barrel, cream, torso);
  mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 24), copper, torso, 0, 0.03, 0).rotation.x = Math.PI / 2;
  const chest = mesh(new THREE.CircleGeometry(0.028, 16), new THREE.MeshBasicMaterial({ color: 0x6ff6e6 }), torso, 0, 0.09, 0.1); chest.castShadow = false;
  mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 18), copper, torso, 0, 0.09, 0.1);
  const bp = mesh(new THREE.BoxGeometry(0.15, 0.13, 0.07), pack, torso, 0, 0.1, -0.11);
  mesh(new THREE.BoxGeometry(0.155, 0.02, 0.075), copper, torso, 0, 0.13, -0.11);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), copper, torso, 0.05, 0.16, -0.14).rotation.z = 0.25;
  // head
  const neck = grp(torso, 0, 0.17, 0);
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 10), dark, neck, 0, 0.0, 0);
  const head = grp(neck, 0, 0.18, 0);
  const shell = mesh(new THREE.SphereGeometry(0.2, 40, 28), cream, head); shell.scale.set(1.1, 0.94, 1.0);
  mesh(new THREE.TorusGeometry(0.2, 0.006, 6, 40), copper, head, 0, 0.0, -0.005).scale.set(1.1, 0.94, 1);
  const face = faceCanvas(512, 320);
  const faceMat = new THREE.MeshStandardMaterial({ map: face.t, emissive: 0xffffff, emissiveMap: face.t, emissiveIntensity: 1.0, roughness: 0.12, metalness: 0.2, transparent: true, alphaTest: 0.5 });
  const visor = mesh(new THREE.SphereGeometry(0.202, 40, 28, Math.PI / 2 - 1.05, 2.1, Math.PI / 2 - 0.8, 1.55), faceMat, head);
  visor.scale.set(1.1, 0.94, 1.0); visor.castShadow = false;
  for (const s of [-1, 1]) { // ears
    const ear = grp(head, s * 0.215, 0, -0.01); ear.rotation.z = s * Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.05, 20), copper, ear);
    mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.055, 20), dark, ear);
    mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 20), paint(0xe0b060, { metalness: 0.8, roughness: 0.3 }), ear, 0, s * 0.03, 0).rotation.x = Math.PI / 2;
  }
  const antBase = grp(head, 0.04, 0.17, -0.02);
  const ant = grp(antBase, 0, 0, 0);
  mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.11, 6), copper, ant, 0, 0.055, 0);
  const bulb = mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc46a }), ant, 0, 0.115, 0);
  mesh(new THREE.BoxGeometry(0.06, 0.02, 0.06), copper, head, -0.06, 0.175, 0.02).rotation.z = 0.2;
  // neck scarf loop
  const loop = mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 24), scarfM, neck, 0, 0.0, 0); loop.rotation.x = Math.PI / 2; loop.scale.set(1, 1, 0.8);
  // arms
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = grp(torso, s * 0.11, 0.115, 0);
    mesh(new THREE.SphereGeometry(0.03, 12, 8), copper, sh);
    const up = mesh(capsule(0.022, 0.05), cream, sh, 0, -0.04, 0);
    const el = grp(sh, 0, -0.075, 0);
    mesh(new THREE.SphereGeometry(0.022, 10, 8), dark, el);
    mesh(capsule(0.022, 0.04), cream, el, 0, -0.03, 0);
    const hand = mesh(new THREE.SphereGeometry(0.036, 14, 10), cream, el, 0, -0.07, 0.005); hand.scale.set(1, 0.9, 0.85);
    mesh(new THREE.SphereGeometry(0.015, 8, 6), cream, hand, s * -0.03, 0.01, 0.015); // thumb
    arms[s] = { sh, el, hand };
  }
  // legs
  const legs = {};
  for (const s of [-1, 1]) {
    const hp = grp(hips, s * 0.055, 0.0, 0);
    mesh(new THREE.SphereGeometry(0.03, 10, 8), dark, hp);
    mesh(capsule(0.028, 0.03), cream, hp, 0, -0.035, 0);
    const kn = grp(hp, 0, -0.065, 0);
    mesh(new THREE.SphereGeometry(0.026, 10, 8), copper, kn);
    mesh(capsule(0.03, 0.02), cream, kn, 0, -0.025, 0);
    const foot = mesh(new THREE.SphereGeometry(0.045, 14, 8), dark, kn, 0, -0.06, 0.018); foot.scale.set(0.9, 0.55, 1.25);
    legs[s] = { hp, kn, foot };
  }
  // trailing scarf tail
  const N = 16;
  const scarfGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 2 * 3), uv = new Float32Array(N * 2 * 2), idx = [];
  for (let i = 0; i < N; i++) { uv.set([i / (N - 1), 0, i / (N - 1), 1], i * 4); if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  scarfGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scarfGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); scarfGeo.setIndex(idx);
  const scarf = new THREE.Mesh(scarfGeo, scarfM); scarf.castShadow = true; scarf.frustumCulled = false;

  const P = { root, body, hips, torso, neck, head, arms, legs, ant, bulb, face, scarf, scarfN: N, chest, mats: { cream, copper, scarfM } };
  P.expr = { open: 1, lookX: 0, lookY: 0 };
  return P;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// state: {pos, yaw, lean, roll, squash, headYaw, headPitch, headRoll, armL/armR:[swing, raise, elbow], legL/legR:[hip, knee], antenna, expr}
export function posePip(P, s, t) {
  P.root.position.copy(s.pos);
  P.root.rotation.set(0, s.yaw || 0, 0);
  const sq = s.squash ?? 1;
  P.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  P.hips.rotation.set(s.lean || 0, 0, s.roll || 0);
  P.hips.position.y = 0.15 + (s.bob || 0);
  P.torso.rotation.set(s.torsoPitch || 0, s.torsoYaw || 0, 0);
  P.head.rotation.set(s.headPitch || 0, s.headYaw || 0, s.headRoll || 0, 'YXZ');
  const hs = s.headScale || 1; P.head.scale.set(hs, hs, hs);
  for (const side of [-1, 1]) {
    const a = (side < 0 ? s.armL : s.armR) || [0, 0.15, 0];
    const A = P.arms[side];
    A.sh.rotation.set(-a[0], 0, side * (a[1] || 0));
    A.el.rotation.set(-(a[2] || 0), 0, 0);
    const l = (side < 0 ? s.legL : s.legR) || [0, 0];
    const Lg = P.legs[side];
    Lg.hp.rotation.set(-l[0], 0, side * (l[2] || 0)); Lg.kn.rotation.set(l[1] || 0, 0, 0);
    Lg.foot.rotation.x = -(l[0] - (l[1] || 0)) * 0.6;
  }
  P.ant.rotation.set(s.antX ?? Math.sin(t * 7) * 0.08, 0, s.antZ ?? Math.sin(t * 5.3) * 0.12);
  P.bulb.material.color.setHex(0xffc46a).multiplyScalar(1 + (s.bulbGlow || 0));
  P.chest.material.color.setHex(0x6ff6e6).multiplyScalar(1 + 0.4 * Math.sin(t * 4));
  drawPipFace(P.face, { ...s.expr, t });
}

// Scarf tail: follows the path the neck traveled (anchor history) + gravity + flutter
export function updateScarf(P, anchorAt, t, opts = {}) {
  const N = P.scarfN, seg = opts.seg ?? 0.042, lag = opts.lag ?? 0.035, width = opts.width ?? 0.06;
  const pts = [];
  const a0 = anchorAt(t);
  pts.push(a0.p.clone());
  const fallbackSide = new THREE.Vector3(Math.cos(a0.yaw), 0, -Math.sin(a0.yaw));
  for (let i = 1; i < N; i++) {
    const ai = anchorAt(t - i * lag);
    const target = ai.p.clone();
    target.y -= i * seg * (opts.grav ?? 0.55);
    const back = new THREE.Vector3(-Math.sin(a0.yaw), 0, -Math.cos(a0.yaw)).multiplyScalar(i * seg * (opts.back ?? 0.35));
    target.add(back);
    target.x += noise1(t * 6 - i * 0.6) * 0.012 * i * (opts.flutter ?? 1);
    target.y += noise1(t * 7.3 - i * 0.5 + 5) * 0.012 * i * (opts.flutter ?? 1);
    target.z += noise1(t * 5.1 - i * 0.7 + 9) * 0.012 * i * (opts.flutter ?? 1);
    const prev = pts[i - 1];
    const d = target.sub(prev); if (d.lengthSq() < 1e-8) d.set(0, -1, 0);
    pts.push(prev.clone().add(d.normalize().multiplyScalar(seg)));
  }
  const pos = P.scarf.geometry.attributes.position;
  for (let i = 0; i < N; i++) {
    const dir = (i < N - 1 ? pts[i + 1].clone().sub(pts[i]) : pts[i].clone().sub(pts[i - 1])).normalize();
    let side = new THREE.Vector3().crossVectors(dir, _up);
    if (side.lengthSq() < 0.01) side.copy(fallbackSide);
    side.normalize();
    const tw = noise1(t * 4 - i * 0.4) * 0.6 * (i / N);
    side.applyAxisAngle(dir, tw);
    const w = width * (1 - 0.45 * i / N) * (i === N - 1 ? 0.5 : 1);
    pos.setXYZ(i * 2, pts[i].x + side.x * w / 2, pts[i].y + side.y * w / 2, pts[i].z + side.z * w / 2);
    pos.setXYZ(i * 2 + 1, pts[i].x - side.x * w / 2, pts[i].y - side.y * w / 2, pts[i].z - side.z * w / 2);
  }
  pos.needsUpdate = true; P.scarf.geometry.computeVertexNormals(); P.scarf.geometry.computeBoundingSphere();
}

// Standard run cycle generator → partial pose
export function runCycle(phase, amt = 1, speed = 1) {
  const s = Math.sin(phase), c = Math.cos(phase);
  return {
    legL: [s * 0.9 * amt, Math.max(0, -c) * 1.1 * amt + 0.1], legR: [-s * 0.9 * amt, Math.max(0, c) * 1.1 * amt + 0.1],
    armL: [-s * 1.0 * amt, 0.35, 0.9], armR: [s * 1.0 * amt, 0.35, 0.9],
    bob: Math.abs(Math.cos(phase)) * 0.035 * amt, lean: 0.28 * amt * speed, squash: 1 + Math.cos(phase * 2) * 0.04 * amt,
    roll: s * 0.06 * amt,
  };
}

// ---------------------------------------------------------------- PUFF
export function makePuff() {
  const root = new THREE.Group(); root.name = 'puff';
  const body = grp(root);
  const mat = fluffMat({ wobble: 0.035 });
  const r = mulberry32(5);
  const blobs = [];
  const layout = [[0, 0.05, 0, 0.21], [-0.17, -0.02, 0.02, 0.15], [0.17, -0.02, 0.02, 0.155], [-0.08, 0.15, -0.02, 0.15], [0.09, 0.16, -0.01, 0.14], [0, 0.22, -0.05, 0.12],
    [-0.27, -0.06, 0, 0.1], [0.28, -0.06, 0, 0.1], [-0.1, -0.08, 0.08, 0.13], [0.1, -0.08, 0.08, 0.13], [0, -0.06, -0.1, 0.15], [-0.18, 0.08, -0.08, 0.11], [0.19, 0.09, -0.08, 0.1]];
  for (const [x, y, z, rad] of layout) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 3), mat); m.position.set(x, y, z); body.add(m); m.castShadow = true;
    blobs.push({ m, base: V(x, y, z), rad, ph: r() * 6.28 });
  }
  const face = faceCanvas(400, 240);
  const fm = new THREE.MeshBasicMaterial({ map: face.t, transparent: true, depthWrite: false, toneMapped: true });
  const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.252), fm);
  facePlane.position.set(0, 0.04, 0.215); facePlane.renderOrder = 5; body.add(facePlane);
  return { root, body, blobs, face, facePlane, mat };
}

// state: {pos, scale, squash, inflate, yaw, pitch, roll, wobble, expr, glow, blush}
export function posePuff(Pf, s, t) {
  Pf.root.position.copy(s.pos);
  Pf.root.rotation.set(s.pitch || 0, s.yaw || 0, s.roll || 0);
  const sc = s.scale ?? 1, sq = s.squash ?? 1, inf = s.inflate ?? 0;
  Pf.root.scale.set(sc / Math.sqrt(sq), sc * sq, sc / Math.sqrt(sq));
  for (const b of Pf.blobs) {
    const br = 1 + Math.sin(t * 3 + b.ph) * 0.04 * (s.wobble ?? 1) + inf * (0.8 + 0.4 * Math.sin(b.ph * 3));
    b.m.scale.setScalar(br);
    b.m.position.copy(b.base).multiplyScalar(1 + inf * 0.9);
    b.m.position.y += Math.sin(t * 2.2 + b.ph) * 0.008 * (s.wobble ?? 1);
  }
  Pf.facePlane.position.z = 0.215 * (1 + inf * 1.3) + 0.01;
  Pf.facePlane.position.y = 0.04 * (1 + inf);
  Pf.facePlane.scale.setScalar(1 + inf * 0.35);
  Pf.mat.uniforms.uGlow.value = s.glow ?? 0.0;
  drawPuffFace(Pf.face, { blush: 1, ...s.expr, t });
}

// ---------------------------------------------------------------- VENDOR
export function makeVendor() {
  const root = new THREE.Group(); root.name = 'vendor';
  const coat = paint(0x7a2f45, { roughness: 0.8, strokeAmt: 0.2, strokeScale: 2, rim: 0.45 });
  const brass = paint(0xc9a24a, { roughness: 0.3, metalness: 0.8, rim: 0.4 });
  const iron = paint(0x45414d, { roughness: 0.45, metalness: 0.6, rim: 0.3 });
  const cream = paint(0xe6d6b8, { roughness: 0.5, rim: 0.4 });
  const legs = [];
  for (const s of [-1, 1]) {
    const hp = grp(root, s * 0.16, 1.25, 0);
    mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.65, 8), iron, hp, 0, -0.32, 0);
    const kn = grp(hp, 0, -0.65, 0); mesh(new THREE.SphereGeometry(0.06, 10, 8), brass, kn);
    mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.6, 8), iron, kn, 0, -0.3, 0);
    mesh(new THREE.ConeGeometry(0.07, 0.1, 8), brass, kn, 0, -0.6, 0.02);
    legs.push({ hp, kn });
  }
  const torso = grp(root, 0, 1.25, 0);
  mesh(new THREE.ConeGeometry(0.32, 0.9, 12, 1, true), coat, torso, 0, 0.3, 0).material.side = THREE.DoubleSide;
  mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.45, 12), coat, torso, 0, 0.55, 0);
  mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 20), brass, torso, 0, 0.35, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.025, 8, 6), brass, torso, 0, 0.45 + i * 0.1, 0.18);
  const neck = grp(torso, 0, 0.8, 0);
  mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8), iron, neck, 0, 0.15, 0);
  const head = grp(neck, 0, 0.36, 0);
  mesh(new THREE.SphereGeometry(0.16, 20, 14), cream, head).scale.set(1, 0.85, 0.95);
  const lens = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 18), brass, head, 0.04, 0.0, 0.14); lens.rotation.x = Math.PI / 2;
  const lensGlow = mesh(new THREE.CircleGeometry(0.055, 18), new THREE.MeshBasicMaterial({ color: 0x9ff0ff }), head, 0.04, 0, 0.167);
  const brow = mesh(new THREE.BoxGeometry(0.16, 0.025, 0.03), iron, head, 0.03, 0.09, 0.15);
  const mous = mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12, Math.PI), iron, head, 0, -0.07, 0.14); mous.rotation.z = Math.PI;
  // umbrella hat with stripes + tassels
  const hat = grp(head, 0, 0.12, 0);
  for (let g = 0; g < 14; g++) { const seg = new THREE.ConeGeometry(0.62, 0.32, 1, 1, true, (g / 14) * Math.PI * 2, Math.PI * 2 / 14); mesh(seg, paint(g % 2 ? 0xd2564f : 0xf1e4c8, { roughness: 0.8, rim: 0.5, side: THREE.DoubleSide }), hat, 0, 0.16, 0); }
  mesh(new THREE.SphereGeometry(0.04, 8, 6), brass, hat, 0, 0.34, 0);
  const tassels = [];
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; const ts = grp(hat, Math.cos(a) * 0.6, 0.0, Math.sin(a) * 0.6); mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), brass, ts, 0, -0.06, 0); mesh(new THREE.SphereGeometry(0.02, 6, 4), paint(0xf0b85a, { rim: 0.4 }), ts, 0, -0.13, 0); tassels.push(ts); }
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(torso, s * 0.2, 0.72, 0);
    mesh(new THREE.SphereGeometry(0.05, 8, 6), brass, sh);
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), iron, sh, 0, -0.22, 0);
    const el = grp(sh, 0, -0.45, 0); mesh(new THREE.SphereGeometry(0.04, 8, 6), brass, el);
    mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.4, 6), iron, el, 0, -0.2, 0);
    const hand = grp(el, 0, -0.42, 0);
    for (let f = 0; f < 3; f++) { const fg = mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.08, 4), brass, hand, (f - 1) * 0.025, -0.03, 0); fg.rotation.z = (f - 1) * 0.3; }
    arms.push({ sh, el });
  }
  // yoke pole with hanging cloud jars on the back
  const yoke = grp(torso, 0, 0.85, -0.22);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), paint(0x8a5a3c, { rim: 0.3 }), yoke).rotation.z = Math.PI / 2;
  const jars = [];
  for (let i = 0; i < 6; i++) { const x = -0.6 + i * 0.24; const j = grp(yoke, x, 0, 0); mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 4), iron, j, 0, -0.1, 0); const jar = makeJar(0.07, i); jar.position.y = -0.3; j.add(jar); jars.push(j); }
  return { root, torso, neck, head, hat, tassels, arms, legs, jars, lensGlow, brow, hatFlowers: null };
}

// glass jar with tiny weather inside
const jarGlass = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false });
const jarRim = paint(0xc9a24a, { roughness: 0.3, metalness: 0.8, rim: 0.4 });
export function makeJar(r = 0.1, kind = 0) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, r * 2.2, 16, 1, true), jarGlass); glass.renderOrder = 4; g.add(glass);
  const lid = mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.9, r * 0.35, 14), jarRim, g, 0, r * 1.2, 0);
  mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, r * 0.15, 14), jarRim, g, 0, -r * 1.1, 0);
  const inner = [0xfff4fa, 0xbfe6ff, 0xffe28a, 0xd8c8ff, 0xaef2d0][kind % 5];
  const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(inner).multiplyScalar(1.3) })); c.scale.y = 0.75; g.add(c);
  g.userData = { glass, lid, inner: c };
  return g;
}

// ---------------------------------------------------------------- CLOCKWORK GUARD
export function makeGuard(hue = 0) {
  const root = new THREE.Group(); root.name = 'guard';
  const navy = paint(new THREE.Color(0x2e4a6e).offsetHSL(hue, 0, 0), { roughness: 0.4, metalness: 0.5, strokeAmt: 0.15, rim: 0.6, rimColor: 0xffc890, flat: true });
  const brass = paint(0xcf9e45, { roughness: 0.3, metalness: 0.8, rim: 0.4 });
  const iron = paint(0x3a3a44, { roughness: 0.4, metalness: 0.6, rim: 0.3 });
  const body = grp(root, 0, 0.75, 0);
  const torso = mesh(new THREE.OctahedronGeometry(0.28, 0), navy, body); torso.scale.set(0.85, 1.25, 0.7);
  mesh(new THREE.TorusGeometry(0.2, 0.02, 4, 12), brass, body, 0, -0.05, 0).rotation.x = Math.PI / 2;
  const head = grp(body, 0, 0.38, 0);
  const hm = mesh(new THREE.ConeGeometry(0.17, 0.32, 5), navy, head, 0, 0.08, 0); hm.rotation.x = 0;
  const lamp = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 14), brass, head, 0, 0.0, 0.13); lamp.rotation.x = Math.PI / 2;
  const lampGlow = mesh(new THREE.CircleGeometry(0.05, 14), new THREE.MeshBasicMaterial({ color: 0xfff09a }), head, 0, 0.0, 0.168);
  // headlamp beam (soft additive cone)
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0, 0.95); head.add(beam);
  // propeller
  const propHub = grp(head, 0, 0.27, 0);
  mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6), iron, propHub, 0, 0.0, 0);
  const prop = grp(propHub, 0, 0.05, 0);
  for (let i = 0; i < 3; i++) { const b = mesh(new THREE.BoxGeometry(0.34, 0.008, 0.05), brass, prop); b.rotation.y = i * Math.PI * 2 / 3; b.position.set(Math.cos(i * 2.094) * 0.17, 0, -Math.sin(i * 2.094) * 0.17); b.rotation.x = 0.3; }
  // wings (folding)
  const wings = [];
  for (const s of [-1, 1]) { const w = grp(body, s * 0.15, 0.15, -0.1); const wm = mesh(new THREE.ConeGeometry(0.12, 0.5, 3), navy, w, s * 0.25, 0, 0); wm.rotation.z = s * Math.PI / 2; wm.scale.z = 0.2; wings.push(w); }
  // pincer arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(body, s * 0.22, 0.05, 0);
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 5), iron, sh, 0, -0.16, 0);
    const el = grp(sh, 0, -0.32, 0); mesh(new THREE.SphereGeometry(0.035, 6, 4), brass, el);
    mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 5), iron, el, 0, -0.14, 0);
    const cl = grp(el, 0, -0.3, 0);
    for (const c of [-1, 1]) { const f = mesh(new THREE.ConeGeometry(0.025, 0.12, 4), brass, cl, c * 0.025, -0.04, 0); f.rotation.z = Math.PI + c * 0.4; }
    arms.push({ sh, el });
  }
  // long spring legs
  const legs = [];
  const springPts = []; for (let i = 0; i <= 60; i++) { const t = i / 60; springPts.push(V(Math.cos(t * 6.28 * 6) * 0.035, -t * 0.38, Math.sin(t * 6.28 * 6) * 0.035)); }
  const springGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 120, 0.009, 4);
  for (const s of [-1, 1]) {
    const hp = grp(body, s * 0.1, -0.3, 0);
    mesh(springGeo, brass, hp);
    const kn = grp(hp, 0, -0.38, 0); mesh(new THREE.SphereGeometry(0.03, 6, 4), iron, kn);
    mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.1, 5), iron, kn, 0, -0.05, 0);
    const ft = mesh(new THREE.ConeGeometry(0.05, 0.08, 3), iron, kn, 0, -0.1, 0.02); ft.rotation.x = Math.PI;
    legs.push({ hp, kn });
  }
  return { root, body, head, prop, wings, arms, legs, beam, lampGlow, helmetFlower: null };
}

export function poseGuard(Gd, s, t) {
  Gd.root.position.copy(s.pos); Gd.root.rotation.set(s.pitch || 0, s.yaw || 0, s.roll || 0);
  Gd.body.position.y = 0.75 + (s.bob || 0);
  Gd.body.rotation.set(s.lean || 0, s.twist || 0, s.bodyRoll || 0);
  Gd.head.rotation.set(s.headPitch || 0, s.headYaw || 0, 0);
  Gd.prop.rotation.y = t * (s.propSpeed ?? 30);
  Gd.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * ((s.wing ?? 0.2) + Math.sin(t * 25) * 0.15 * (s.flap || 0)); });
  const ph = s.run ?? 0, amt = s.runAmt ?? 0;
  Gd.legs.forEach((L, i) => { const sg = i ? 1 : -1; L.hp.rotation.x = Math.sin(ph) * 0.8 * amt * sg + (s.legX || 0); L.kn.rotation.x = Math.max(0, Math.cos(ph) * sg) * 0.8 * amt; L.hp.scale.y = s.spring ?? 1; });
  Gd.arms.forEach((A, i) => { const sg = i ? 1 : -1; A.sh.rotation.set(-(s.armSwing ?? Math.sin(ph) * -0.6 * amt * sg), 0, sg * (s.armRaise ?? 0.3)); A.el.rotation.x = -(s.elbow ?? 0.5); });
  Gd.lampGlow.material.color.setHex(s.alarm ? (Math.sin(t * 30) > 0 ? 0xff6050 : 0xfff09a) : 0xfff09a);
}

// ---------------------------------------------------------------- CITIZENS (varied silhouettes)
export function makeCitizen(kind, seed = 1) {
  const r = mulberry32(seed);
  const root = new THREE.Group(); root.name = 'citizen';
  const cols = [0xd98a6a, 0x7fb5a4, 0xe6c27a, 0xb07aa8, 0x8aa0d0, 0xe8b0a0, 0x9ab87a];
  const main = paint(cols[Math.floor(r() * cols.length)], { roughness: 0.5, metalness: 0.3, rim: 0.5 });
  const brass = paint(0xc9a24a, { roughness: 0.3, metalness: 0.8, rim: 0.4 });
  const iron = paint(0x45414d, { roughness: 0.45, metalness: 0.6, rim: 0.3 });
  const eyeM = new THREE.MeshBasicMaterial({ color: [0x9ff0ff, 0xffe08a, 0xffa0c0][Math.floor(r() * 3)] });
  const body = grp(root);
  const arms = [];
  if (kind === 0) { // teapot bot
    mesh(new THREE.SphereGeometry(0.32, 16, 12), main, body, 0, 0.5, 0).scale.y = 0.85;
    mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.1, 12), brass, body, 0, 0.8, 0);
    mesh(new THREE.SphereGeometry(0.05, 8, 6), brass, body, 0, 0.88, 0);
    const sp = mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.3, 8), main, body, 0, 0.5, 0.33); sp.rotation.x = 1.0;
    mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM, body, -0.12, 0.6, 0.27); mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM, body, 0.12, 0.6, 0.27);
    for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6), iron, body, s * 0.14, 0.11, 0);
    for (const s of [-1, 1]) { const a = grp(body, s * 0.32, 0.5, 0); mesh(new THREE.TorusGeometry(0.08, 0.02, 4, 10, Math.PI), brass, a, s * 0.06, 0, 0).rotation.z = -s * Math.PI / 2; arms.push(a); }
  } else if (kind === 1) { // tall lamp bot
    mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.3, 6), iron, body, 0, 0.65, 0);
    mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.35, 10), main, body, 0, 1.0, 0);
    const shade = mesh(new THREE.ConeGeometry(0.28, 0.25, 12, 1, true), paint(0xf0d8a8, { side: THREE.DoubleSide, rim: 0.5 }), body, 0, 1.42, 0);
    mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), body, 0, 1.3, 0);
    mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM, body, -0.05, 1.05, 0.13); mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM, body, 0.05, 1.05, 0.13);
    mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.06, 10), brass, body, 0, 0.03, 0);
    for (const s of [-1, 1]) { const a = grp(body, s * 0.12, 1.08, 0); mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 5), iron, a, 0, -0.2, 0); arms.push(a); }
  } else if (kind === 2) { // barrel bot with crate
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 14), main, body, 0, 0.45, 0);
    for (const y of [0.25, 0.65]) mesh(new THREE.TorusGeometry(0.3, 0.02, 4, 16), brass, body, 0, y, 0).rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x9ff0ff }), body, 0, 0.6, 0.29);
    mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), paint(0x8a5a3c, { rim: 0.3 }), body, 0, 0.88, 0);
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.09, 8, 6), iron, body, s * 0.18, 0.09, 0);
    for (const s of [-1, 1]) { const a = grp(body, s * 0.3, 0.6, 0); mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 5), iron, a, 0, -0.15, 0); arms.push(a); }
  } else if (kind === 3) { // cat-bot pet
    mesh(new THREE.SphereGeometry(0.14, 12, 10), main, body, 0, 0.18, 0).scale.set(1, 0.8, 1.4);
    const h = mesh(new THREE.SphereGeometry(0.11, 12, 10), main, body, 0, 0.3, 0.17);
    for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.04, 0.08, 4), main, body, s * 0.06, 0.41, 0.17); mesh(new THREE.SphereGeometry(0.02, 6, 4), eyeM, body, s * 0.045, 0.32, 0.27); }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 5), iron, body, x * 0.07, 0.05, z * 0.12);
    const tail = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 5), brass, body, 0, 0.28, -0.24); tail.rotation.x = -0.6;
  } else if (kind === 4) { // round shopper with basket & hat
    mesh(new THREE.SphereGeometry(0.26, 14, 10), main, body, 0, 0.42, 0);
    mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 12), paint(0xd2564f, { rim: 0.5 }), body, 0, 0.66, 0);
    mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.16, 12), paint(0xd2564f, { rim: 0.5 }), body, 0, 0.75, 0);
    mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), brass, body, -0.1, 0.48, 0.24);
    mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), brass, body, 0.1, 0.48, 0.24);
    mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeM, body, -0.1, 0.48, 0.25); mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeM, body, 0.1, 0.48, 0.25);
    for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 6), iron, body, s * 0.1, 0.1, 0);
    const bsk = mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.1, 10), paint(0xc08a50, { rim: 0.3 }), body, 0.28, 0.32, 0.05);
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.035, 6, 4), paint([0xe8604a, 0x9ed36a, 0xf0b85a][i]), body, 0.26 + i * 0.03, 0.39, 0.05);
    for (const s of [-1, 1]) { const a = grp(body, s * 0.25, 0.42, 0); mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 5), iron, a, 0, -0.11, 0); arms.push(a); }
  } else { // kind 5: mechanical bird
    mesh(new THREE.SphereGeometry(0.08, 10, 8), main, body, 0, 0, 0).scale.set(1, 0.8, 1.5);
    const bk = mesh(new THREE.ConeGeometry(0.025, 0.07, 5), brass, body, 0, 0, 0.13); bk.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const w = grp(body, s * 0.06, 0.02, 0); const wm = mesh(new THREE.BoxGeometry(0.18, 0.01, 0.08), main, w, s * 0.09, 0, 0); arms.push(w); }
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return { root, body, arms, kind };
}

// ---------------------------------------------------------------- THE FLOWER
export function makeFlower() {
  const root = new THREE.Group(); root.name = 'flower';
  const stemM = paint(0x6f8a4a, { roughness: 0.7, strokeAmt: 0.1, rim: 0.5, rimColor: 0xd8ff9a });
  const petalM = new THREE.MeshStandardMaterial({ color: 0xd77ab8, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x000000 });
  const centerM = paint(0xf0c050, { roughness: 0.6, rim: 0.6 });
  // stem as 4 jointed segments for drooping
  const segs = []; let parent = root;
  for (let i = 0; i < 4; i++) { const s = grp(parent, 0, i === 0 ? 0 : 0.055, 0); mesh(new THREE.CylinderGeometry(0.0055, 0.007, 0.058, 6), stemM, s, 0, 0.028, 0); segs.push(s); parent = s; }
  const leaves = [];
  const leafGeo = new THREE.SphereGeometry(0.03, 10, 6); leafGeo.scale(0.45, 0.1, 1.4); leafGeo.translate(0, 0, 0.038);
  for (const [i, a] of [[0, 0.4], [1, 3.6]]) { const lf = grp(segs[i], 0, 0.03, 0); lf.rotation.y = a; const lm = mesh(leafGeo, stemM, lf); leaves.push(lf); }
  const headG = grp(segs[3], 0, 0.058, 0);
  mesh(new THREE.SphereGeometry(0.014, 10, 8), centerM, headG, 0, 0.008, 0);
  const petals = [];
  const petalGeo = new THREE.SphereGeometry(0.03, 12, 8); petalGeo.scale(0.55, 0.12, 1.0); petalGeo.translate(0, 0, 0.028);
  for (let i = 0; i < 6; i++) { const p = grp(headG, 0, 0.004, 0); p.rotation.y = i / 6 * Math.PI * 2; const pm = mesh(petalGeo, petalM, p); petals.push(p); }
  return { root, segs, leaves, headG, petals, petalM, stemM };
}

// droop: 1 = wilted, 0 = upright; bloom: 0 closed bud..1 fully open; health 0 brown..1 vivid
export function poseFlower(F, s, t) {
  F.root.position.copy(s.pos); F.root.scale.setScalar((s.scale ?? 1) * 1.8);
  const d = s.droop ?? 1, tr = s.tremble ?? 0;
  F.segs.forEach((g, i) => { g.rotation.z = d * (0.12 + i * 0.35) + Math.sin(t * 13 + i) * 0.03 * tr; g.rotation.x = Math.sin(t * 2 + i) * 0.03; });
  const b = s.bloom ?? 0.2;
  F.petals.forEach((p, i) => { p.children[0].rotation.x = lerp(-1.25, 0.15, b) + Math.sin(t * 3 + i) * 0.02 - d * 0.2; });
  F.leaves.forEach((l, i) => { l.children[0].rotation.x = lerp(0.9, -0.2, 1 - d * 0.8); });
  const h = s.health ?? 0;
  F.petalM.color.setRGB(lerp(0.55, 0.92, h), lerp(0.42, 0.42, h), lerp(0.44, 0.78, h));
  F.petalM.emissive.setRGB(0.25 * (s.glow || 0), 0.08 * (s.glow || 0), 0.2 * (s.glow || 0));
  F.stemM.color.setRGB(lerp(0.52, 0.36, h), lerp(0.47, 0.6, h), lerp(0.3, 0.25, h));
  const hs = lerp(0.85, 1.25, b); F.headG.scale.setScalar(hs);
}

// ---------------------------------------------------------------- props
export function makeWateringCan() {
  const g = new THREE.Group();
  const m = paint(0x8aa6a0, { roughness: 0.35, metalness: 0.7, rim: 0.5 });
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 14), m, g);
  const sp = mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.1, 6), m, g, 0.06, 0.02, 0); sp.rotation.z = -1.0;
  mesh(new THREE.CylinderGeometry(0.015, 0.008, 0.015, 8), m, g, 0.105, 0.05, 0).rotation.z = -1.0;
  const h = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), m, g, -0.01, 0.04, 0); h.rotation.z = 0.3;
  return g;
}

export function makeNoodleCart() {
  const g = new THREE.Group();
  const wood = paint(0xa0603c, { rim: 0.4 }), red = paint(0xd2564f, { rim: 0.5 }), brass = paint(0xc9a24a, { metalness: 0.8, roughness: 0.3, rim: 0.4 });
  mesh(new THREE.BoxGeometry(0.9, 0.35, 0.55), wood, g, 0, 0.5, 0);
  mesh(new THREE.BoxGeometry(0.95, 0.05, 0.6), brass, g, 0, 0.7, 0);
  // floating balloons lift the cart
  for (const [x, z, c] of [[-0.3, 0, 0xd2564f], [0.3, 0.05, 0xf0b85a], [0, -0.1, 0x7fb5a4]]) { mesh(new THREE.SphereGeometry(0.22, 14, 10), paint(c, { rim: 0.6 }), g, x, 1.65, z).scale.y = 1.15; mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 3), brass, g, x * 0.8, 1.15, z); }
  // propeller below
  const prop = grp(g, 0, 0.28, 0); for (let i = 0; i < 4; i++) { const b = mesh(new THREE.BoxGeometry(0.4, 0.01, 0.06), brass, prop); b.rotation.y = i * Math.PI / 2; }
  // noodle bowls with steam
  const bowls = [];
  for (let i = 0; i < 3; i++) { const b = mesh(new THREE.SphereGeometry(0.08, 12, 8, 0, 6.28, Math.PI / 2, Math.PI / 2), red, g, -0.28 + i * 0.28, 0.8, 0.05); b.rotation.x = Math.PI; bowls.push(b); }
  // spinning noodle strands (the guard gets tangled)
  const noodles = grp(g, 0.15, 0.95, 0);
  const nm = paint(0xf2d27a, { roughness: 0.6, rim: 0.4 });
  for (let k = 0; k < 6; k++) { const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(V(Math.cos(t * 9 + k) * 0.1 * (1 - t * 0.3), t * 0.5, Math.sin(t * 9 + k) * 0.1)); } mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.008, 4), nm, noodles); }
  const sign = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.03), paint(0xf1e4c8, { rim: 0.4 }), g, 0, 1.0, -0.25);
  const lanternM = new THREE.MeshBasicMaterial({ color: 0xffb862 });
  mesh(new THREE.SphereGeometry(0.06, 8, 6), lanternM, g, -0.42, 0.95, 0.25); mesh(new THREE.SphereGeometry(0.06, 8, 6), lanternM, g, 0.42, 0.95, 0.25);
  return { root: g, prop, noodles, bowls };
}

export function makeBell() {
  const g = new THREE.Group();
  const brass = paint(0xe0b050, { metalness: 0.85, roughness: 0.25, rim: 0.5 });
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.03 + 0.09 * Math.pow(t, 1.8), -t * 0.16)); }
  const bell = mesh(new THREE.LatheGeometry(pts, 16), brass, g); bell.material.side = THREE.DoubleSide;
  mesh(new THREE.SphereGeometry(0.025, 8, 6), brass, g, 0, -0.15, 0);
  mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 10), brass, g, 0, 0.02, 0);
  return { root: g, bell };
}
