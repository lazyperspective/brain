// ------------------------------------------------------------------
// KILN — LIGHT. The film: 15 shots, transitions, backdrop light, haze, title.
// Every shot is a pure function of film time t: it poses the phone, camera, lights and post, and returns the OS view.
// ------------------------------------------------------------------
import * as THREE from 'three';
import { track, sm, clamp, lerp, easeIO, easeOut, smr } from './engine.js';
import { setHardware, DIM } from './phone.js';

const PI = Math.PI, TAU = PI * 2, SERIF = '"Newsreader", Georgia, serif', SANS = '"Inter", system-ui, sans-serif';
const v3 = new THREE.Vector3();
const rand = (i, k = 0) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
function lerpCol(a, b, u) { return new THREE.Color(a).lerp(new THREE.Color(b), clamp(u, 0, 1)); }
function css(c) { return '#' + c.getHexString(); }

// ---------------------------------------------------------------- light: backdrop field + shafts + motes
let BEAM = null;
function beamSprite() {   // a soft volumetric shaft: bright core across, fading along its length
  if (BEAM) return BEAM; BEAM = document.createElement('canvas'); BEAM.width = 1024; BEAM.height = 256; const x = BEAM.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,248,238,0)'); g.addColorStop(0.3, 'rgba(255,248,238,0.55)'); g.addColorStop(0.5, 'rgba(255,250,242,1)'); g.addColorStop(0.7, 'rgba(255,248,238,0.55)'); g.addColorStop(1, 'rgba(255,248,238,0)');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 256);
  x.globalCompositeOperation = 'destination-in'; g = x.createLinearGradient(0, 0, 1024, 0); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.35, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 1024, 256);
  // faint striations, like light through a scrim
  x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(0,0,0,${0.08 + rand(i, 9) * 0.18})`; x.fillRect(0, rand(i, 3) * 256, 1024, 2 + rand(i, 4) * 10); }
  return BEAM;
}
function drawShaft(x, W, H, s) {
  if (!s || s.a <= 0) return; x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = s.a;
  x.translate(s.x * W, s.y * H); x.rotate(s.ang); x.drawImage(beamSprite(), 0, -s.w / 2, s.len * W, s.w); x.restore();
}
// caustic: light bent through the glass, thrown onto the floor (procedural, after the classic water-caustic iteration)
let CAU = null;
function caustic(x, cx, cy, w, h, t, a, ang = 0) {
  if (a <= 0.01) return; genCaustic(t);
  x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = a; x.translate(cx, cy); x.rotate(ang); x.filter = 'blur(1.5px)'; x.drawImage(CAU, -w / 2, -h / 2, w, h); x.restore();
}
let CAUT = null, lastCT = -1;
function genCaustic(t) {
  if (t === lastCT) return; lastCT = t; const S = 160, R = 110; if (!CAU) { CAU = document.createElement('canvas'); CAU.width = S; CAU.height = R; }
  const c = CAU.getContext('2d'), d = c.createImageData(S, R), TT = t * 0.35 + 23;
  for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) {
    let px = (i / S) * 6.28 * 1.6 - 250, py = (j / R) * 6.28 * 1.1 - 250, ix = px, iy = py, cc = 1;
    for (let n = 0; n < 4; n++) { const t2 = TT * (1 - 3.5 / (n + 1)); const nx = px + Math.cos(t2 - ix) + Math.sin(t2 + iy), ny = py + Math.sin(t2 - iy) + Math.cos(t2 + ix); ix = nx; iy = ny;
      cc += 1 / Math.hypot(px / (Math.sin(ix + t2) / 0.005), py / (Math.cos(iy + t2) / 0.005)); }
    cc /= 4; cc = 1.17 - Math.pow(cc, 1.4); let v = Math.pow(Math.abs(cc), 8);
    const mx = (i / S - 0.5) * 2, my = (j / R - 0.5) * 2, m = Math.max(0, 1 - (mx * mx + my * my)); v = Math.min(1, v) * m * m;
    const o = (j * S + i) * 4; d.data[o] = 255; d.data[o + 1] = 236; d.data[o + 2] = 210; d.data[o + 3] = v * 255;
  }
  c.putImageData(d, 0, 0); if (CAUT) CAUT.needsUpdate = true;
}
// a caustic thrown onto the floor in 3D (additive, so it reads inside the shadow)
let CMESH = null;
function causticFloor(E, t, pos, sx, sz, rotY, a) {
  if (!CMESH) { genCaustic(t); CAUT = new THREE.CanvasTexture(CAU); CAUT.colorSpace = THREE.SRGBColorSpace;
    CMESH = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: CAUT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1, 0.85, 0.65) }));
    CMESH.renderOrder = 5; E.scene.add(CMESH); }
  CMESH.visible = a > 0.01; if (!CMESH.visible) return; genCaustic(t);
  CMESH.position.copy(pos); CMESH.rotation.set(-PI / 2, 0, rotY); CMESH.scale.set(sx, sz, 1); CMESH.material.opacity = a; CMESH.material.color.setRGB(a * 1.4, a * 1.1, a * 0.8);
}
// the light-orange field (scene background)
function field(E, o = {}) {
  const x = E.bg.getContext('2d'), W = E.W, H = E.H; x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  const glow = o.glow ?? 1, cx = (o.cx ?? 0.5) * W, cy = (o.cy ?? 0.46) * H, dim = o.dim ?? 0;
  const c0 = lerpCol('#eba584', '#fbe2cf', glow).lerp(new THREE.Color('#c99a88'), dim * 0.5), c1 = lerpCol('#e49a74', '#f2b896', glow).lerp(new THREE.Color('#b98a78'), dim * 0.5), c2 = new THREE.Color('#d98b62').lerp(new THREE.Color('#a77a68'), dim * 0.5);
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, W * (o.r ?? 0.75)); g.addColorStop(0, css(c0)); g.addColorStop(0.5, css(c1)); g.addColorStop(1, css(c2));
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (o.floor) { const f = x.createLinearGradient(0, H * 0.55, 0, H); f.addColorStop(0, 'rgba(200,110,70,0)'); f.addColorStop(1, `rgba(200,110,70,${o.floor})`); x.fillStyle = f; x.fillRect(0, 0, W, H); }
  (o.shafts || []).forEach(s => drawShaft(x, W, H, s));
  if (o.caustic) { const k = o.caustic; caustic(x, k.x * W, k.y * H, k.w * W, k.h * H, o.t, k.a, k.ang || 0); }
  if (o.rainLight) { x.save(); x.globalCompositeOperation = 'soft-light'; for (let i = 0; i < 30; i++) { const X = rand(i, 1) * W, Y = ((rand(i, 2) * 1.4 + o.t * (0.18 + rand(i, 3) * 0.1)) % 1.4 - 0.2) * H; const gg = x.createLinearGradient(X, Y, X, Y + 260); gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(1, `rgba(255,255,255,${o.rainLight * 0.12})`); x.fillStyle = gg; x.fillRect(X, Y, 2 + rand(i, 4) * 3, 260); } x.restore(); }
}
// front haze: the same shafts at low strength over everything + floating motes
function haze(o, t, W, H, h = {}) {
  if (h.shafts) h.shafts.forEach(s => drawShaft(o, W, H, { ...s, a: s.a * (h.front ?? 0.22) }));
  const n = h.motes ?? 0; if (!n) return;
  o.save(); o.globalCompositeOperation = 'screen';
  for (let i = 0; i < 90; i++) {
    const big = rand(i, 7) > 0.86, z = rand(i, 8);
    const X = ((rand(i, 1) + t * (0.004 + z * 0.01) + Math.sin(t * 0.3 + i) * 0.01) % 1) * W, Y = ((rand(i, 2) - t * (0.006 + z * 0.006) + 2) % 1) * H;
    let lit = 1; if (h.shafts && h.shafts[0]) { const s = h.shafts[0], dx = X - s.x * W, dy = Y - s.y * H, along = dx * Math.cos(s.ang) + dy * Math.sin(s.ang), across = -dx * Math.sin(s.ang) + dy * Math.cos(s.ang); lit = 0.25 + 0.75 * Math.exp(-(across * across) / (s.w * s.w * 0.25)) * (along > 0 ? 1 : 0); }
    const r = big ? 6 + z * 18 : 0.8 + z * 2.2, a = n * lit * (big ? 0.07 : 0.55) * (0.5 + 0.5 * Math.sin(t * (0.8 + z) + i));
    if (a <= 0.004) continue;
    const g = o.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, `rgba(255,248,238,${a})`); g.addColorStop(big ? 0.8 : 0.4, `rgba(255,240,225,${a * (big ? 0.7 : 0.3)})`); g.addColorStop(1, 'rgba(255,240,225,0)');
    o.fillStyle = g; o.fillRect(X - r, Y - r, r * 2, r * 2);
  }
  o.restore();
}

// ---------------------------------------------------------------- staging helpers
let SCENE = null;
function stage(E, phone) {
  SCENE = E.scene;
  const L = E.L;
  L.key.intensity = 1.25; L.key.position.set(-3, 4, 5); L.key.castShadow = false; L.fill.intensity = 0.22; L.rimA.intensity = 0.9; L.rimB.intensity = 0.6; L.sweep.intensity = 0; L.glow.intensity = 0; L.glow.distance = 0.6; L.sweep.distance = 3; L.hemi.intensity = 0.22; L.spot.intensity = 0;
  L.rimA.color.set('#ffb48a'); L.rimB.color.set('#ffe0c8'); L.rimA.position.set(4, 2, -4); L.rimB.position.set(-4, -1, -3);
  E.scene.environmentIntensity = 1; E.scene.environmentRotation.set(0, 0, 0); E.bokeh.enabled = false; E.bloom.strength = 0.28; E.bloom.threshold = 0.86; E.bloom.radius = 0.6;
  E.shadow.visible = false; E.catcher.visible = false; E.shadow.rotation.set(-PI / 2, 0, 0);
  Object.assign(E.fin.uniforms, {}); E.fin.uniforms.vig.value = 0.2; E.fin.uniforms.grain.value = 0.02; E.fin.uniforms.ca.value = 0.0009; E.fin.uniforms.lift.value = 0; E.fin.uniforms.fade.value = 0;
  phone.visible = true; phone.scale.setScalar(1); if (CMESH) CMESH.visible = false;
}
function pose(phone, p) { phone.position.set(p[0], p[1], p[2]); phone.rotation.set(p[3], p[4], p[5]); phone.updateMatrixWorld(true); }
function wpos(obj, local = null) { if (local) return obj.localToWorld(v3.set(...local)).clone(); obj.getWorldPosition(v3); return v3.clone(); }
function blob(E, phone, floorY, k, sx = 1.5, sz = 0.5) { E.shadow.visible = k > 0.01; E.shadow.position.set(phone.position.x, floorY, phone.position.z); E.shadow.scale.set(sx, sz, 1); E.shadow.material.opacity = k * clamp(1 - (phone.position.y - floorY - 0.85) * 0.7, 0.15, 1); }
const HW = (o = {}) => ({ scene: SCENE, askFill: 0, askGlow: 0, askPress: 0, dial: 0, iris: 0.82, reflect: 1, screen: 1, ...o });

// ---------------------------------------------------------------- shots
const SHAFT = (t, a = 1) => ({ x: 0.08 + Math.sin(t * 0.07) * 0.02, y: -0.32, ang: 0.98 + Math.sin(t * 0.11) * 0.03, w: 560, len: 1.5, a });

const RISE = [[45.2, 0.2, -0.55, 0, 0.22, TAU - 2.5, 0.1], [46.4, 0.08, -0.12, 0, 0.1, TAU - 0.9, 0.02], [47.6, -0.12, 0.02, 0, 0.03, TAU + 0.18, 0.0], [49.2, -0.5, 0.02, 0, 0.0, TAU + 0.36, 0.0], [52.0, -0.54, 0.03, 0, 0.0, TAU + 0.4, 0.0]];
const P_RISE = t => track(RISE, t), p0x = t => P_RISE(t)[0];
const camT = t => { const [cx, cy, cz, tx] = track([[45.2, 0.35, -0.42, 4.5, 0.0], [47.4, 0.15, -0.2, 4.9, -0.05], [49.4, 0.0, -0.05, 5.4, 0.0], [52.0, 0.0, -0.04, 5.55, 0.0]], t); return [cx, cy, cz, tx, 0.0, 0, 22]; };
const shots = [
  { name: 'FIELD + ARRIVAL', t0: 0, t1: 6.6,
    mb: t => (t > 3.2 && t < 4.9 ? 4 : 1),
    frame(t, E, phone) {
      stage(E, phone);
      const sh = SHAFT(t, 0.75 * sm(0.3, 2.6, t));
      field(E, { glow: 0.45 + 0.55 * sm(0.0, 3.4, t), shafts: [sh], floor: 0.08 });
      const p = track([[3.0, 0.05, -2.75, 0, 0.42, PI + 1.15, 0.22], [4.4, 0.02, -0.7, 0, 0.2, PI + 0.72, 0.06], [5.4, 0, -0.08, 0, 0.1, PI + 0.48, -0.01], [6.6, 0, 0.03, 0, 0.06, PI + 0.33, -0.035]], t);
      p[1] += Math.sin(t * 1.1) * 0.012; pose(phone, p); phone.visible = t > 3.0;
      const d = lerp(6.1, 5.25, smr(2.5, 6.6, t));
      E.look(0.02, -0.12 + 0.1 * sm(3, 6.6, t), d, 0, 0.02, 0, 22);
      E.scene.environmentRotation.y = lerp(-0.9, 0.6, smr(3.2, 6.6, t));
      E.L.sweep.intensity = 2.2 * Math.sin(clamp((t - 4.4) / 2.2, 0, 1) * PI); E.L.sweep.position.set(lerp(-1.2, 1.2, clamp((t - 4.4) / 2.2, 0, 1)), 0.7, -1.2);
      E.L.rimA.intensity = 1.3;
      E.L.spot.intensity = 9; E.L.spot.angle = 0.42; E.L.spot.penumbra = 1; E.L.spot.position.set(-1.8, 2.8, 3.2); E.L.spot.target.position.set(0.35, -0.5, 0); E.L.key.intensity = 0.8;
      blob(E, phone, -1.12, sm(3.9, 5.8, t) * 0.75);
      setHardware(phone, HW());
      return { os: { mode: 'off' }, haze: { shafts: [sh], motes: 1 * sm(0.2, 1.6, t), front: 0.25 } };
    } },
  { name: 'IRIS', t0: 6.6, t1: 9.6,
    frame(t, E, phone) {
      stage(E, phone); const u = (t - 6.6) / 3;
      field(E, { glow: 0.9, cx: 0.7, cy: 0.3 });
      pose(phone, [0, 0, 0, 0.02, PI + 0.06, 0.0]);
      const lens = wpos(phone.userData.parts.lenses[0].group);
      // oblique, sliding: the disc rim near camera → main lens
      const off = new THREE.Vector3(-lerp(0.26, 0.15, easeIO(0, 1, u)), lerp(0.12, 0.05, easeIO(0, 1, u)), lerp(0.5, 0.4, easeIO(0, 1, u)));
      const tgt = lens.clone().add(new THREE.Vector3(-lerp(0.05, 0.0, easeIO(0, 0.7, u)), lerp(-0.03, 0.0, easeIO(0, 0.7, u)), 0));
      E.look(lens.x + off.x, lens.y + off.y, lens.z + off.z, tgt.x, tgt.y, tgt.z, 22, lerp(0.08, -0.02, u));
      E.scene.environmentRotation.set(0.2, lerp(0.4, -0.5, u), 0);
      const rim = wpos(phone.userData.parts.camera, [-0.16, -0.08, 0.015]);
      const fp = rim.lerp(lens, easeIO(0.12, 0.42, u));
      E.focusOn(fp, 0.28, 0.011);
      E.L.sweep.intensity = 2.5; E.L.sweep.position.set(lens.x + lerp(0.5, -0.3, u), lens.y + 0.3, lens.z + 0.4); E.L.sweep.distance = 2;
      const iris = 0.85 - 0.62 * easeIO(7.55, 8.15, t) + 0.5 * easeIO(8.6, 9.25, t);
      setHardware(phone, HW({ iris }));
      E.bloom.strength = 0.35; E.fin.uniforms.vig.value = 0.3;
      return { os: { mode: 'off' }, haze: { motes: 0.4 } };
    } },
  { name: 'CROWN', t0: 9.6, t1: 12.4,
    frame(t, E, phone) {
      stage(E, phone); const u = (t - 9.6) / 2.8;
      field(E, { glow: 0.8, cx: 0.3, cy: 0.4 });
      pose(phone, [0, 0, 0, 0, -0.12, 0]);
      const dial = wpos(phone.userData.parts.knurl);
      const camP = dial.clone().add(new THREE.Vector3(lerp(0.36, 0.3, u), lerp(0.13, 0.05, easeIO(0, 1, u)), lerp(0.3, 0.16, easeIO(0, 1, u))));
      E.look(camP.x, camP.y, camP.z, dial.x - 0.02, dial.y - 0.03, dial.z, 22, -0.06);
      E.focusOn(dial, 0.22, 0.012);
      // five detents, each a quick eased click
      let ang = 0; for (const d of [10.15, 10.55, 10.95, 11.35, 11.75]) ang += easeOut(d, d + 0.16, t) * (TAU / 30);
      E.scene.environmentRotation.set(0, lerp(-0.6, 0.4, u), 0);
      // a glint running down the chamfer
      const gy = lerp(0.95, -0.5, easeIO(0.05, 0.95, u)); E.L.sweep.intensity = 1.6; E.L.sweep.distance = 1.0; E.L.sweep.position.set(DIM.W / 2 + 0.12, gy, 0.3);
      setHardware(phone, HW({ dial: ang }));
      E.bloom.strength = 0.22; E.bloom.threshold = 0.95; E.fin.uniforms.vig.value = 0.3;
      return { os: { mode: 'off' }, haze: { motes: 0.35 } };
    } },
  { name: 'ASK', t0: 12.4, t1: 15.0,
    frame(t, E, phone) {
      stage(E, phone); const u = (t - 12.4) / 2.6;
      field(E, { glow: 0.35 + 0.4 * sm(13.1, 14.3, t), cx: 0.7, cy: 0.3, dim: 0.5 * (1 - sm(13.1, 14.3, t)) });
      pose(phone, [0, 0, 0, 0, 0.1, 0]);
      const s = wpos(phone.userData.parts.askG);
      const camP = s.clone().add(new THREE.Vector3(-lerp(0.56, 0.48, easeIO(0, 1, u)), -lerp(0.16, 0.1, easeIO(0, 1, u)), -lerp(0.4, 0.33, easeIO(0, 1, u))));
      E.look(camP.x, camP.y, camP.z, s.x + 0.025, s.y + lerp(0.03, 0.0, u), s.z - 0.015, 22, -0.38);
      E.scene.environmentIntensity = 0.6 + 0.25 * sm(13.1, 14.2, t); E.L.rimA.intensity = 0.5; E.L.hemi.intensity = 0.12;
      E.focusOn(s, 0.09, 0.012);
      const fill = easeIO(13.05, 14.05, t), glow = sm(12.95, 13.4, t) * (0.85 + 0.15 * Math.sin(t * 3));
      E.L.glow.intensity = glow * 0.28; E.L.glow.distance = 0.4; E.L.glow.position.set(s.x - 0.03, s.y + lerp(-0.12, 0, fill), s.z - 0.01);
      E.scene.environmentRotation.set(0, lerp(0.5, -0.2, u), 0);
      E.L.key.intensity = 1.0 - 0.3 * glow;
      setHardware(phone, HW({ askFill: fill, askGlow: glow }));
      E.bloom.strength = 0.32; E.bloom.threshold = 0.92; E.bloom.radius = 0.4; E.fin.uniforms.vig.value = 0.32;
      return { os: { mode: 'off' }, haze: { motes: 0.35 } };
    } },
  { name: 'TURN · LOCK · HOME', t0: 15.0, t1: 26.4,
    mb: t => (t > 15.55 && t < 17.2 ? 3 : 1),
    frame(t, E, phone) {
      stage(E, phone);
      const sh = SHAFT(t, 0.6 * (1 - sm(18, 20, t) * 0.5));
      field(E, { glow: 1, shafts: [sh], floor: 0.06 });
      const yaw = track([[15.0, PI + 0.55], [15.45, PI + 0.6], [17.35, TAU - 0.24], [19.2, TAU - 0.13], [23.6, TAU - 0.07], [26.4, TAU + 0.03]], t)[0];
      const tilt = track([[15.0, 0.06], [17.3, 0.02], [26.4, -0.02]], t)[0];
      pose(phone, [0, Math.sin(t * 0.9) * 0.008, 0, tilt, yaw, 0]);
      const [d, ty, cx] = track([[15.0, 4.75, 0.0, 0.1], [17.3, 4.35, 0.03, 0.06], [19.2, 3.6, 0.1, 0.02], [21.2, 3.25, 0.1, 0], [22.6, 3.15, 0.12, 0], [24.2, 3.0, 0.17, 0], [26.4, 2.9, 0.15, -0.02]], t);
      E.look(cx, ty + 0.03, d, cx * 0.5, ty, 0, 22);
      E.scene.environmentRotation.set(0, track([[15.0, 0.9], [17.4, -0.7], [19.5, -0.35], [26.4, -0.2]], t)[0], 0);
      blob(E, phone, -1.12, 0.65);
      const glowS = lerp(0.85, 0.3, sm(15.0, 16.8, t)) + Math.exp(-Math.max(0, t - 17.55) * 2.2) * (t > 17.4 ? 1 : 0) * sm(17.4, 17.6, t) * 0.9;
      E.L.glow.intensity = glowS * 0.5; E.L.glow.position.copy(wpos(phone.userData.parts.askG)).add(new THREE.Vector3(-0.06, 0, 0.03));
      const reflect = lerp(1.0, 0.35, sm(18.2, 19.8, t));
      setHardware(phone, HW({ askFill: 1, askGlow: glowS, reflect }));
      E.bloom.strength = 0.3; E.bloom.threshold = 0.88;
      const yawRel = yaw - TAU; return { os: { par: [-yawRel * 260, 0] }, haze: { shafts: [sh], motes: 0.7, front: 0.18 } };
    } },
  { name: 'PRESS · LISTEN · BUILD', t0: 26.4, t1: 37.0,
    frame(t, E, phone) {
      stage(E, phone);
      field(E, { glow: 0.95, cx: 0.6, shafts: [SHAFT(t, 0.4)] });
      const press = Math.exp(-Math.pow((t - 27.0) / 0.12, 2));
      const ry = track([[26.4, -0.3], [27.8, -0.26], [29.4, -0.02], [37.0, 0.02]], t)[0];
      pose(phone, [0, 0, 0, 0, ry, 0]);
      // orbit from 3/4-left to frontal, then glide down the plan
      const [ang, d, ty, tx] = track([[26.4, -0.62, 2.75, 0.1, -0.08], [27.7, -0.55, 2.65, 0.1, -0.06], [29.5, -0.04, 2.8, 0.06, 0], [31.4, -0.01, 2.75, 0.08, 0], [32.3, 0.0, 2.3, 0.33, 0], [33.4, 0.01, 2.3, 0.26, 0], [34.4, 0.02, 2.3, -0.06, 0], [35.4, 0.02, 2.4, -0.3, 0], [36.3, 0.0, 2.7, -0.08, 0], [37.0, 0.0, 2.85, 0.02, 0]], t);
      E.look(tx + Math.sin(ang) * d, ty + 0.08, Math.cos(ang) * d, tx, ty, 0, 22);
      E.scene.environmentRotation.set(0, lerp(-0.6, 0.2, sm(26.4, 37, t)), 0);
      const fill = easeIO(26.92, 27.25, t), glow = 0.25 + 0.75 * sm(26.9, 27.05, t) * (1 - 0.5 * sm(28.5, 30, t));
      E.L.glow.intensity = glow * 0.45; E.L.glow.position.copy(wpos(phone.userData.parts.askG)).add(new THREE.Vector3(-0.06, 0, 0.04));
      setHardware(phone, HW({ askFill: t < 26.9 ? 1 : fill, askGlow: glow, askPress: press, reflect: lerp(0.5, 0.3, sm(27.5, 29, t)) }));
      E.bloom.strength = 0.3; E.bloom.threshold = 0.88;
      return { os: { par: [-ry * 200, 0] }, haze: { motes: 0.4 } };
    } },
  { name: 'CONDENSE', t0: 37.0, t1: 41.4,
    frame(t, E, phone) {
      stage(E, phone); const u = (t - 37) / 4.4;
      field(E, { glow: 0.55, dim: 0.35, rainLight: 1, t, cx: 0.5, cy: 0.4 });
      pose(phone, [0, 0, 0, -0.32, lerp(0.12, -0.04, u), lerp(0.04, 0.0, u)]);
      const d = lerp(2.95, 2.7, easeIO(0, 1, u));
      E.look(0.1, 0.55 + 0.72 * d / 3, d, 0, 0.12, 0, 22);
      E.scene.environmentRotation.set(0, lerp(0.3, -0.2, u), 0);
      E.L.key.intensity = 0.9; E.scene.environmentIntensity = 0.85;
      setHardware(phone, HW({ askFill: 1, askGlow: 0.25, reflect: 1.0 }));
      E.fin.uniforms.vig.value = 0.26;
      return { os: { mode: 'condense' }, haze: { motes: 0.0 } };
    } },
  { name: 'TOP-DOWN', t0: 41.4, t1: 45.2,
    frame(t, E, phone) {
      stage(E, phone); const u = (t - 41.4) / 3.8;
      const roll = lerp(0.62, 0.18, easeIO(0, 1, u));
      const sweep = lerp(-0.25, 1.15, easeIO(0.05, 1, u));
      const sh = { x: sweep - 0.4, y: -0.3, ang: 1.05 - roll * 0.3, w: 700, len: 1.6, a: 0.55 };
      const rz = 0.5;
      // project a floor point beside the phone (away from the key) to place the caustic
      field(E, { glow: 0.85, cx: 0.5, cy: 0.5, r: 0.8, shafts: [sh] });
      causticFloor(E, t, new THREE.Vector3(0.55, -0.071, -0.12), 0.55, 0.9, rz, 1.0 * sm(41.5, 42.5, t));
      pose(phone, [0, 0, 0, -PI / 2, 0, rz]);
      const h = lerp(4.6, 3.75, easeIO(0, 1, u));
      E.look(0.0, h, 0.0, 0, 0, 0, 22, 0, [Math.sin(roll), 0, -Math.cos(roll)]);
      E.L.key.castShadow = true; E.L.key.position.set(-1.6, 4.2, 1.0); E.L.key.intensity = 1.4;
      E.catcher.visible = true; E.catcher.position.y = -0.073; E.catcher.material.opacity = 0.5;
      E.shadow.visible = true; E.shadow.position.set(0, -0.072, 0); E.shadow.rotation.set(-PI / 2, 0, rz); E.shadow.scale.set(0.98, 1.85, 1); E.shadow.material.opacity = 0.5;
      // the passing shaft also lights the phone
      E.L.spot.intensity = 6 * Math.sin(clamp(u * 1.1, 0, 1) * PI); E.L.spot.position.set(lerp(-3, 3, u), 4, lerp(1.5, -1.5, u)); E.L.spot.target.position.set(lerp(-0.6, 0.6, u), 0, 0);
      E.scene.environmentRotation.set(0, lerp(-0.5, 0.5, u), 0);
      setHardware(phone, HW({ askFill: 1, askGlow: 0.25, reflect: 0.1 }));
      return { os: { mode: 'glance', time: '3:28', line: 'Café Lumen  ·  2 min  ·  Noor is here' }, haze: { motes: 0.5, shafts: [sh], front: 0.12 } };
    } },
  { name: 'RISE · TURN · TITLE', t0: 45.2, t1: 52.0,
    mb: t => (t > 45.25 && t < 47.3 ? 3 : 1),
    frame(t, E, phone) {
      stage(E, phone);
      const sh = SHAFT(t, 0.65);
      field(E, { glow: 1, cx: lerp(0.5, 0.62, sm(47.5, 50, t)), shafts: [sh], floor: 0.06 });
      causticFloor(E, t, new THREE.Vector3(p0x(t) + 0.12, -1.115, 0.1), 1.1, 0.55, 0.0, 0.5 * sm(47.0, 48.5, t));
      const p = P_RISE(t);
      p[1] += Math.sin(t * 1.1) * 0.008; pose(phone, p);
      E.look(...camT(t));
      E.scene.environmentRotation.set(0, track([[45.2, 1.2], [47.6, -0.5], [52, -0.25]], t)[0], 0);
      // rims chase the chamfer as it turns
      E.L.rimA.intensity = 1.4 + 1.2 * Math.sin(clamp((t - 45.3) / 2.4, 0, 1) * PI); E.L.rimB.intensity = 0.9;
      blob(E, phone, -1.12, 0.7);
      setHardware(phone, HW({ askFill: 1, askGlow: 0.3 + 0.2 * sm(48.5, 49.5, t), reflect: 0.75 }));
      return { os: { mode: 'glance', time: '3:28', line: 'Café Lumen  ·  2 min  ·  Noor is here' }, haze: { shafts: [sh], motes: 0.6, front: 0.2 } };
    } },
];

// transitions: dissolve (renders both), wash (flash to light at the cut), wipe (a light-run across at the cut)
const transitions = [
  { type: 'wipe', t: 12.4, len: 0.42 },
  { type: 'dissolve', a: 5, b: 6, t0: 36.75, t1: 37.3 },
  { type: 'wash', t: 41.4, len: 0.55 },
  { type: 'flash', t: 9.6, len: 0.2 },
];

// title card
function title(o, t, W, H) {
  const k1 = clamp((t - 49.25) / 1.1, 0, 1), k2 = clamp((t - 49.85) / 0.9, 0, 1), k3 = clamp((t - 50.3) / 0.8, 0, 1);
  const X = W * 0.56, Y = H * 0.5;
  const cond = (k, fn, blur = 22) => { if (k <= 0) return; const e = easeOut(0, 1, k); o.save(); o.globalAlpha = e; if (e < 0.995) o.filter = `blur(${((1 - e) * blur).toFixed(1)}px)`; fn(e); o.restore();
    if (e < 0.98) { o.save(); o.globalCompositeOperation = 'screen'; o.globalAlpha = Math.sin(e * PI) * 0.6; o.filter = `blur(${(14 + (1 - e) * blur).toFixed(1)}px)`; fn(e); o.restore(); } };
  cond(k1, e => { o.font = `300 ${Math.round(H * 0.17)}px ${SERIF}`; o.letterSpacing = `${lerp(40, -2, e)}px`; o.fillStyle = '#3b1b0e'; o.textAlign = 'left'; o.fillText('KILN', X, Y); o.letterSpacing = '0px'; }, 30);
  cond(k2, e => { o.font = `400 ${Math.round(H * 0.032)}px ${SANS}`; o.fillStyle = '#4a2414'; o.textAlign = 'left'; o.fillText('The phone that thinks with you.', X + 6, Y + H * 0.075 + (1 - e) * 10); });
  cond(k3, e => { o.font = `600 ${Math.round(H * 0.0155)}px ${SANS}`; o.letterSpacing = '7px'; o.fillStyle = 'rgba(122,63,38,0.85)'; o.fillText('CONCEPT', X + 8, Y + H * 0.135); o.letterSpacing = '0px';
    o.fillStyle = 'rgba(122,63,38,0.5)'; o.fillRect(X + 8, Y + H * 0.105, 46 * e, 1.5); });
}

export const FILM = {
  dur: 52.0, shots, transitions,
  shotIndex(t) { for (let i = 0; i < shots.length; i++) if (t < shots[i].t1) return i; return shots.length - 1; },
  overlay(o, t, W, H, st) {
    haze(o, t, W, H, st.haze || {});
    // light transitions
    for (const tr of transitions) {
      if (tr.type === 'wipe' && Math.abs(t - tr.t) < tr.len) { const u = (t - tr.t + tr.len) / (2 * tr.len); o.save(); o.globalCompositeOperation = 'screen'; const bx = lerp(-0.4, 1.4, easeIO(0, 1, u)) * W; const g = o.createLinearGradient(bx - W * 0.35, 0, bx + W * 0.35, 0); g.addColorStop(0, 'rgba(255,236,220,0)'); g.addColorStop(0.5, `rgba(255,246,238,${0.95})`); g.addColorStop(1, 'rgba(255,236,220,0)'); o.fillStyle = g; o.fillRect(0, 0, W, H); o.restore(); }
      if (tr.type === 'wash' && Math.abs(t - tr.t) < tr.len) { const a = Math.pow(1 - Math.abs(t - tr.t) / tr.len, 1.6); o.save(); o.fillStyle = `rgba(255,232,214,${a})`; o.fillRect(0, 0, W, H); o.restore(); }
      if (tr.type === 'flash' && t >= tr.t && t < tr.t + tr.len) { const a = 1 - (t - tr.t) / tr.len; o.save(); o.globalCompositeOperation = 'screen'; o.fillStyle = `rgba(255,236,220,${0.35 * a})`; o.fillRect(0, 0, W, H); o.restore(); }
    }
    if (t > 49) title(o, t, W, H);
    // the opening: pure light-orange holds before anything
    if (t < 0.6) { o.save(); o.fillStyle = `rgba(236,170,135,${1 - t / 0.6})`; o.fillRect(0, 0, W, H); o.restore(); }
    // final: gentle settle at the very end (no fade to black — we end in light)
  },
};
