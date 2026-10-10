// THE CLOUD THIEF — world assembly + the 30-second shot timeline.
// Every value is a pure function of time t (seconds), so any frame can be rendered independently.
import * as THREE from 'three';
import { buildCity, buildClouds, buildSky, L } from './city.js';
import { G } from './mats.js';
import { V, clamp, lerp, inv, smooth, easeInOut, easeOut, easeIn, easeOutBack, bump, noise1, makeCurve } from './util.js';
import * as C from './chars.js';
import { buildProps, animateProps, poseBridge, SP } from './props.js';
import { buildFX, updateFX } from './fx.js';

export const T = { sneeze: 21.5, end: 30 };

export function buildWorld(scene, camera, renderer) {
  const w = { scene, camera };
  scene.fog = new THREE.FogExp2(0xd9b9c4, 0.0048);
  w.sky = buildSky(scene);
  w.clouds = buildClouds(scene);
  w.city = buildCity(scene);
  const sun = new THREE.DirectionalLight(0xffcf98, 4.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.015;
  scene.add(sun, sun.target); w.sun = sun;
  w.hemi = new THREE.HemisphereLight(0x86a6e0, 0xc07a72, 0.8); scene.add(w.hemi);
  w.pip = C.makePip(); scene.add(w.pip.root, w.pip.scarf);
  w.puff = C.makePuff(); scene.add(w.puff.root);
  w.flower = C.makeFlower(); scene.add(w.flower.root);
  w.P = buildProps(scene, w.city);
  w.fx = buildFX(scene, w);
  return w;
}

// ------------------------------------------------------------------ helpers
const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const fwd = (yaw) => V(Math.sin(yaw), 0, Math.cos(yaw));
const right = (yaw) => V(Math.cos(yaw), 0, -Math.sin(yaw));
function setCam(w, pos, tgt, fov = 40, roll = 0) {
  const c = w.camera; c.position.copy(pos); c.up.set(Math.sin(roll), Math.cos(roll), 0); c.lookAt(tgt); c.fov = fov; c.updateProjectionMatrix();
  c.userData.tgt = tgt.clone();
}
function shake(t, amt, f = 23) { return V(noise1(t * f) * amt, noise1(t * f + 31) * amt, noise1(t * f + 67) * amt); }
function blink(t, times) { let o = 1; for (const b of times) o = Math.min(o, 1 - bump(b, b + 0.14, t)); return o; }
const BLINKS = [0.9, 2.4, 3.3, 5.1, 9.4, 13.4, 16.95, 18.75, 20.1, 23.0, 26.9, 28.0];

function pipIdle(t, base = {}) {
  return {
    pos: V(), yaw: 0, lean: 0.02, roll: Math.sin(t * 1.7) * 0.015, squash: 1 + Math.sin(t * 2.6) * 0.012, bob: 0,
    headPitch: 0, headYaw: 0, headRoll: Math.sin(t * 1.3) * 0.03,
    armL: [0.1, 0.18 + Math.sin(t * 2.6) * 0.03, 0.35], armR: [0.1, 0.18 + Math.sin(t * 2.6 + 1) * 0.03, 0.35],
    legL: [0.02, 0.06], legR: [-0.02, 0.06],
    expr: { open: blink(t, BLINKS), lookX: 0, lookY: 0 },
    ...base,
  };
}
const merge = (a, b) => { const o = { ...a, ...b }; if (a.expr || b.expr) o.expr = { ...(a.expr || {}), ...(b.expr || {}) }; return o; };

function pipRunOnCurve(curve, u, t, opts = {}) {
  const p = curve.getPointAt(clamp(u)); const tan = curve.getTangentAt(clamp(u));
  const yaw = Math.atan2(tan.x, tan.z);
  const phase = (opts.phaseBase ?? 0) + u * curve.getLength() / 0.16 * Math.PI;
  return merge(pipIdle(t), { pos: p, yaw, ...C.runCycle(phase, opts.amt ?? 1, 1), headPitch: -0.12, expr: { open: 1, lookX: 0, ...(opts.expr || {}) } });
}
function jumpArc(a, b, peak, k) { const p = a.clone().lerp(b, k); p.y += peak * 4 * k * (1 - k); return p; }

function puffOnPip(ps, t, extra = {}) {
  const f = fwd(ps.yaw), r = right(ps.yaw);
  const p = ps.pos.clone().add(V(0, 0.68 + Math.sin(t * 9) * 0.02, 0)).add(f.multiplyScalar(-0.16)).add(r.multiplyScalar(0.06));
  return { pos: p, yaw: ps.yaw + 0.3, scale: 0.62, squash: 1 + Math.sin(t * 9) * 0.06, expr: { eyes: 'happy', mouth: 'grin', mouthOpen: 0.7 }, ...extra };
}

function crowdReact(w, t, pipPos, active) {
  for (const c of w.P.crowd) {
    const d = c.base.distanceTo(pipPos);
    const k = active ? clamp(1 - (d - 0.6) / 2.2) : 0;
    c.root.position.copy(c.base); c.root.position.y += Math.abs(Math.sin(t * 14 + c.ph)) * 0.18 * k;
    c.root.rotation.y = k > 0.05 ? lerp(c.yaw, yawTo(c.base, pipPos), k) : c.yaw;
    if (k > 0.05) c.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (0.2 + 1.8 * k); });
  }
}

const F = L.flower;
const PA = V(1.2, 0, -0.22);
const PB = V(1.36, 0, 0.5);
const FACE = V(0.3, 0, 0.1);
const BAL_YAW = -1.59; // three-quarter toward the balcony cameras, turned slightly to Puff
const flowerYaw = yawTo(PA, F);

// ------------------------------------------------------------------ chase geography
const curveGap = makeCurve([[-17.1, 8, 2.1], [-18.3, 8, 2.35], [-19.6, 8, 2.6], [-20.2, 8, 3.3], [-20.25, 8, 4.4]]);
const curveStreet = makeCurve([[-20.25, 8, 4.4], [-20.3, 8, 5.6], [-20.2, 8, 7.0], [-19.95, 8, 8.4], [-19.8, 8, 9.2]]);
const AWN_TOP = V(-19.75, 9.72, 9.25);
const RAIL0 = L.railStart;
const curveGuard = makeCurve([[-20.0, 8, -2.6], [-20.2, 8, 0.5], [-20.25, 8, 3.0], [-20.25, 8, 4.4], [-20.3, 8, 5.6]]);

function bridgeEnd(t) {
  if (t < 12.9) return L.bridge.x1;
  if (t < 14.05) return L.bridge.x1 - 4.85 * (t - 12.9);
  return Math.max(-9.6, L.bridge.x1 - 4.85 * 1.15 - 4.0 * (t - 14.05));
}

// ------------------------------------------------------------------ SHOTS
const SHOTS = [];
const shot = (t0, t1, name, def) => SHOTS.push({ t0, t1, name, ...def });

// ====== S1: one small thing in an impossibly big city (0 – 3.0) ======
function pipWater(t) {
  const lean = 0.15 + bump(1.15, 2.2, t) * 0.18;
  const tilt = smooth(0.35, 0.8, t) * (1 - smooth(1.15, 1.45, t));
  return merge(pipIdle(t), {
    pos: PA, yaw: flowerYaw, lean, headPitch: 0.42 + smooth(1.2, 1.6, t) * 0.1, headRoll: 0.12 * smooth(1.2, 1.7, t),
    armR: [1.25 + tilt * 0.2, 0.15, 0.55], armL: [0.3 + smooth(1.3, 1.7, t) * 0.4, 0.3, 0.9],
    expr: { open: blink(t, BLINKS) * lerp(1, 0.75, smooth(1.3, 1.8, t)), lookX: 0, lookY: -0.6, droop: smooth(1.25, 1.8, t) * 0.9, pupil: 1.05, shimmer: smooth(1.5, 2.2, t) * 0.5 },
  });
}
shot(0, 3.0, 'S1 flower', {
  pip: pipWater,
  run(t, w) {
    const ps = pipWater(t);
    C.posePip(w.pip, ps, t);
    C.poseFlower(w.flower, { pos: F, droop: 0.92, bloom: 0.12, health: 0.05, tremble: 1 }, t);
    const tilt = smooth(0.35, 0.8, t) * (1 - smooth(1.15, 1.45, t));
    const can = w.P.can; can.visible = true;
    can.position.copy(F).add(V(0.13, 0.33 + smooth(1.15, 1.6, t) * 0.04, -0.06)); can.rotation.set(0, 2.35, -tilt * 0.9 + Math.sin(t * 30) * 0.03 * bump(0.8, 1.15, t));
    const fl = w.P.flake; fl.visible = t > 0.8 && t < 1.25;
    const fk = inv(0.8, 1.15, t); fl.position.copy(F).add(V(0.07 - fk * 0.04, 0.3 - fk * fk * 0.3, -0.03)); fl.rotation.set(t * 20, t * 13, 0);
    const k = easeInOut(inv(1.75, 3.0, t));
    const c0 = V(1.42, 0.09, 0.42), t0 = F.clone().add(V(0, 0.13, 0));
    const c1 = V(1.75, 0.28, 0.85), t1 = F.clone().add(V(0, 0.2, -0.05));
    const c2 = V(2.1, 2.5, 3.4), t2 = V(-6, -1.6, -2.2);
    const pushK = easeInOut(inv(0.0, 1.7, t));
    let cp = c0.clone().lerp(c1, pushK * 0.6), ct = t0.clone().lerp(t1, pushK);
    const curve = makeCurve([cp, V(2.0, 1.1, 1.8), c2]);
    if (k > 0) { cp = curve.getPointAt(k); ct = ct.clone().lerp(t2, easeInOut(inv(1.75, 2.85, t))); }
    setCam(w, cp, ct, lerp(36, 46, k));
    return { brush: lerp(2, 3, k), shadow: [F, lerp(1.5, 14, k)] };
  },
});

// ====== S2: discovery & decision (3.0 – 6.0) ======
const PS2 = V(1.15, 0, 0.0);
function pipS2(t) {
  const look = smooth(3.25, 3.7, t);
  const base = merge(pipIdle(t), { pos: PS2, yaw: -1.25, headPitch: lerp(0.25, -0.55, look), headYaw: lerp(0.0, -0.35, look) + Math.sin(t * 3) * 0.02 * (1 - look), expr: { lookY: lerp(-0.3, 0.8, look), lookX: lerp(0.3, -0.5, look), droop: (1 - look) * 0.6, open: blink(t, BLINKS) } });
  if (t > 4.9) {
    const down = bump(4.95, 5.3, t);
    const idea = smooth(5.22, 5.35, t);
    base.headPitch = lerp(-0.45, 0.45, down) - idea * 0.1; base.headYaw = lerp(-0.35, 0.15, down);
    base.expr = { open: 1, lookY: lerp(0.7, -0.8, down), lookX: 0, sparkle: idea, size: 1 + idea * 0.12, pupil: 1 + idea * 0.15, mouth: idea > 0.5 ? 'grin' : (down > 0.2 ? 'flat' : null) };
    base.bulbGlow = idea * 3 * (0.6 + 0.4 * Math.sin(t * 40));
    base.antX = -idea * 0.4;
    base.squash = 1 + bump(5.22, 5.42, t) * 0.12;
  }
  if (t > 5.45) {
    const crouch = bump(5.45, 5.68, t);
    const go = easeIn(inv(5.62, 6.0, t));
    const start = PS2, end = V(-2.2, 0, 0.0);
    const p = start.clone().lerp(end, go);
    const run = C.runCycle((t - 5.6) * 34, smooth(5.6, 5.7, t), 1.4);
    Object.assign(base, run, { pos: p, yaw: lerp(-1.25, -Math.PI / 2, smooth(5.45, 5.65, t)), squash: 1 - crouch * 0.22 + go * 0.1, lean: run.lean * smooth(5.6, 5.7, t) - crouch * 0.15, headPitch: -0.1 });
    if (t < 5.65) { base.legL = [0.5 * crouch, 1.0 * crouch]; base.legR = [0.5 * crouch, 1.0 * crouch]; base.armL = [-0.8 * crouch, 0.5, 0.8]; base.armR = [-0.8 * crouch, 0.5, 0.8]; }
    base.expr = { open: 1, sparkle: 0.6, angry: 0.35, mouth: 'grin', lookX: 0 };
  }
  return base;
}
function puffInJar(t, mood) {
  const J = SP.jar.clone().add(V(0, 0.84, 0));
  return { pos: J, yaw: Math.PI / 2 - 0.25, scale: 0.5, squash: 1 + Math.sin(t * 2) * 0.03, wobble: 0.6, ...mood };
}
shot(3.0, 3.75, 'S2a mist', {
  pip: pipS2,
  run(t, w) {
    C.posePip(w.pip, pipS2(t), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.92, bloom: 0.12, health: 0.05, tremble: 0.5 }, t);
    const cp = PS2.clone().add(V(-0.72, 0.36, 0.55)), ct = PS2.clone().add(V(0, 0.42 + smooth(3.3, 3.75, t) * 0.08, 0));
    setCam(w, cp.add(V(0, smooth(3.3, 3.75, t) * -0.08, 0)), ct, 38);
    return { brush: 2, shadow: [PS2, 2], mist: true };
  },
});
shot(3.75, 4.25, 'S2b whip up', {
  pip: pipS2,
  run(t, w) {
    C.posePip(w.pip, pipS2(t), t);
    C.posePuff(w.puff, puffInJar(t, { expr: { eyes: 'open', mouth: 'frown', sad: 1, tears: 0.6, lookX: 0.4 } }), t);
    const k = easeInOut(inv(3.75, 4.2, t));
    const cp = PS2.clone().add(V(0.45, 0.28, 0.35));
    const tgt0 = PS2.clone().add(V(-0.4, 0.75, -0.1)), tgt1 = SP.jar.clone().add(V(0, 0.85, 0));
    const ct = tgt0.clone().lerp(tgt1, k);
    const fov = lerp(42, 5.5, easeIn(inv(3.85, 4.25, t)));
    setCam(w, cp, ct, fov);
    const mb = bump(3.78, 4.15, t);
    return { brush: 2.5, shadow: [SP.jar, 6], motion: [-0.012 * mb, 0.03 * mb] };
  },
});
shot(4.25, 4.95, 'S2c puff in jar', {
  run(t, w) {
    const contact = smooth(4.55, 4.7, t);
    C.posePuff(w.puff, puffInJar(t, { yaw: Math.PI / 2 - 0.25 + contact * 0.25, squash: 1 - contact * 0.08 + bump(4.55, 4.8, t) * 0.15, expr: { eyes: contact > 0.5 ? 'wide' : 'open', mouth: contact > 0.6 ? 'o' : 'frown', mouthOpen: 0.3, sad: 1 - contact, tears: 0.7 - contact * 0.3, lookX: lerp(-0.6, 0.15, contact), lookY: contact * 0.3, blush: 0.6 + contact * 0.4 } }), t);
    const J = SP.jar.clone().add(V(0, 0.86, 0));
    const cp = J.clone().add(V(0.72, 0.3 - (t - 4.25) * 0.05, 0.5)), ct = J.clone().add(V(0, -0.02, 0));
    setCam(w, cp.add(V(-(t - 4.25) * 0.08, 0, -(t - 4.25) * 0.08)), ct, 32);
    return { brush: 2, shadow: [J, 2.5] };
  },
});
shot(4.95, 5.45, 'S2d idea', {
  pip: pipS2,
  run(t, w) {
    C.posePip(w.pip, pipS2(t), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.92, bloom: 0.12, health: 0.05 }, t);
    const cp = PS2.clone().add(V(-0.88, 0.46, 0.34)), ct = PS2.clone().add(V(0, 0.44, 0));
    setCam(w, cp.add(V(0.05 * smooth(5.2, 5.45, t), 0, 0)), ct, 34);
    return { brush: 1.5, shadow: [PS2, 2] };
  },
});
shot(5.45, 6.0, 'S2e dash', {
  pip: pipS2,
  run(t, w) {
    const ps = pipS2(t); C.posePip(w.pip, ps, t);
    C.poseFlower(w.flower, { pos: F, droop: 0.92, bloom: 0.12, health: 0.05 }, t);
    const cp = V(0.2, 0.18, 1.25), ct = V(0.5, 0.3, 0.0);
    setCam(w, cp, ct.lerp(V(-0.8, 0.3, 0), smooth(5.7, 6.0, t)), 44, 0.06);
    return { brush: 2, shadow: [V(0.5, 0, 0), 3], dust: [V(1.0, 0.02, 0), 5.66] };
  },
});

// ====== S3: the great cloud theft (6.0 – 8.5) ======
const J = SP.jar; const VEN = SP.vendor;
function pipTheft(t) {
  const s = merge(pipIdle(t), {});
  if (t < 6.62) {
    const k = inv(6.0, 6.62, t);
    const p = V(-17.12, 8, 3.2).lerp(V(-17.05, 8, 0.32), easeOut(k));
    const sliding = smooth(6.22, 6.3, t) * (1 - smooth(6.5, 6.62, t));
    Object.assign(s, C.runCycle(k * 18, 1 - sliding, 1.2), { pos: p, yaw: Math.PI });
    if (sliding > 0) { s.lean = -0.9 * sliding; s.legL = [1.2 * sliding, 0.1]; s.legR = [1.0 * sliding, 0.2]; s.armL = [-0.6, 1.0, 0.3]; s.armR = [-0.6, 1.0, 0.3]; s.bob = -0.08 * sliding; }
    s.expr = { open: 1, angry: 0.4, mouth: 'grin', lookX: 0 };
  } else if (t < 7.05) {
    const k = inv(6.62, 7.05, t);
    const h1 = smooth(0, 0.5, k), h2 = smooth(0.5, 1, k);
    const y = 8 + 0.3 * easeOutBack(h1) + 0.3 * easeOutBack(h2);
    const hop = Math.sin(k * Math.PI * 2) * 0.08;
    s.pos = V(-17.0, y + Math.abs(hop), 0.32 - 0.12 * k + 0.05);
    s.yaw = Math.PI; s.squash = 1 + Math.sin(k * Math.PI * 4) * 0.12;
    s.armL = [1.6, 0.4, 0.6]; s.armR = [1.6, 0.4, 0.6]; s.legL = [0.6 * Math.abs(Math.sin(k * 12)), 0.8]; s.legR = [0.2, 0.4];
    s.expr = { open: 1, lookY: 0.6, mouth: 'flat' };
  } else if (t < 7.45) {
    const k = inv(7.05, 7.45, t);
    s.pos = V(-17.0, 8.62, 0.25); s.yaw = Math.PI;
    s.armR = [1.4 + bump(0.1, 0.4, k) * 0.9, 0.2, 0.3]; s.armL = [0.6, 0.6, 0.6];
    s.headPitch = -0.35; s.lean = 0.1;
    const pop = smooth(0.4, 0.55, k);
    s.expr = { open: 1, lookY: 0.7, size: 1 + pop * 0.15, sparkle: pop, mouth: pop > 0.5 ? 'grin' : 'o' };
    s.squash = 1 - bump(0.4, 0.7, k) * 0.15;
  } else if (t < 7.95) {
    const k = inv(7.45, 7.95, t);
    const p = jumpArc(V(-17.0, 8.62, 0.25), V(-17.05, 8, 0.95), 0.25, easeOut(k));
    s.pos = p; s.yaw = Math.PI + Math.sin(k * 8) * 0.2; s.lean = -0.3 * bump(0, 0.6, k); s.roll = Math.sin(k * 10) * 0.15;
    s.armL = [1.0, 1.2, 0.2]; s.armR = [1.0, 1.2, 0.2];
    s.squash = 1 - bump(0.55, 0.75, k) * 0.2;
    s.expr = { happy: k < 0.6 ? 1 : 0, mouth: 'grin', open: 1, size: 1.1, lookX: k > 0.6 ? 0.6 : 0 };
    if (k > 0.75) s.expr = { open: 1, size: 1.25, pupil: 0.7, mouth: 'o', lookX: 0.5, lookY: 0.2 };
  } else {
    const ant = bump(7.95, 8.22, t);
    const go = easeIn(inv(8.2, 8.5, t));
    s.pos = V(-17.05, 8, 0.95).lerp(V(-17.1, 8, 2.1), go);
    s.yaw = lerp(Math.PI, 0.1, smooth(7.95, 8.15, t));
    Object.assign(s, go > 0 ? C.runCycle(t * 34, 1, 1.4) : {});
    if (go <= 0) { s.squash = 1 - ant * 0.2; s.legL = [0.4 * ant, 0.9 * ant]; s.legR = [0.4 * ant, 0.9 * ant]; s.armL = [-0.5 * ant, 0.6, 0.5]; s.armR = [-0.5 * ant, 0.6, 0.5]; s.headYaw = Math.sin(t * 30) * 0.25 * ant; }
    s.expr = { open: 1, size: 1.2, pupil: 0.65, mouth: 'wobble', lookX: Math.sin(t * 20) * 0.6 * (1 - go) };
  }
  return s;
}
function puffTheft(t, ps) {
  if (t < 7.27) return puffInJar(t, { expr: { eyes: t > 6.9 ? 'wide' : 'open', mouth: t > 6.9 ? 'o' : 'smile', lookY: 0.2, lookX: 0.2 } });
  if (t < 7.6) {
    const k = inv(7.27, 7.6, t);
    const p = SP.jar.clone().add(V(0, 0.84 + easeOut(k) * 0.55, k * 0.2));
    return { pos: p, yaw: Math.PI / 2 - 0.25 + k * 2.5, scale: lerp(0.5, 0.75, easeOutBack(k)), squash: 1 + Math.sin(k * 14) * 0.25 * (1 - k), expr: { eyes: 'happy', mouth: 'grin', mouthOpen: 1 } };
  }
  const o = puffOnPip(ps, t, {}); const k = smooth(7.6, 7.85, t);
  const from = SP.jar.clone().add(V(0, 1.39, 0.2)); o.pos = from.lerp(o.pos, k);
  o.scale = lerp(0.75, 0.62, k);
  if (t > 7.9) o.expr = { eyes: 'wide', mouth: 'o', mouthOpen: 0.5 };
  return o;
}
function poseVendor(w, t) {
  const V_ = w.P.vendor; V_.root.position.copy(VEN); V_.root.scale.setScalar(1);
  const aghast = smooth(7.85, 8.0, t);
  V_.root.rotation.y = Math.PI + aghast * 0.25;
  V_.head.rotation.set(-0.1 * aghast, lerp(-1.3 + Math.sin(t * 3) * 0.1, 0.2, aghast), Math.sin(t * 4) * 0.05 * (1 - aghast));
  V_.hat.position.y = 0.12 + bump(7.88, 8.1, t) * 0.25; V_.hat.rotation.z = bump(7.88, 8.2, t) * 0.3;
  V_.torso.rotation.x = -0.05 * aghast; V_.torso.position.y = 1.25 + bump(7.88, 8.05, t) * 0.08;
  V_.arms.forEach((a, i) => { const s = i ? 1 : -1; a.sh.rotation.set(lerp(-0.4 - Math.sin(t * 5 + i) * 0.3 * (i ? 1 : 0.3), -2.6, aghast), 0, s * lerp(0.2, 0.5, aghast)); a.el.rotation.x = lerp(-0.9, -0.3, aghast); });
  V_.tassels.forEach((ts, i) => { ts.rotation.x = Math.sin(t * 3 + i) * 0.15 + bump(7.88, 8.3, t) * Math.sin(t * 30 + i) * 0.5; });
  V_.jars.forEach((j, i) => { j.rotation.z = Math.sin(t * 2 + i) * 0.08 + bump(7.88, 8.4, t) * Math.sin(t * 25 + i) * 0.4; });
  V_.lensGlow.material.color.setHex(aghast > 0.5 ? 0xff7060 : 0x9ff0ff);
  V_.legs.forEach((L_, i) => { L_.hp.rotation.z = (i ? -1 : 1) * 0.12; });
  const Cu = w.P.customer; Cu.root.position.copy(SP.customer).add(V(0, Math.sin(t * 2) * 0.05, 0)); Cu.root.rotation.y = -Math.PI / 2 - 0.2;
}
function poseBell(w, t) {
  const ring = smooth(7.62, 7.7, t) * Math.exp(-Math.max(0, t - 7.7) * 1.2);
  w.P.bell.root.rotation.z = Math.sin(t * 38) * 0.6 * ring;
}
function poseJarStack(w, t) {
  const lid = w.P.puffJar.userData.lid; const k = inv(7.22, 7.9, t);
  lid.position.set(0.0, 0.22 + k * 0.9 - k * k * 1.4, k * 0.5); lid.rotation.set(k * 9, 0, k * 4);
  w.P.latch.rotation.z = smooth(7.12, 7.2, t) * 2.0;
  const j = w.P.smallJars[2]; const tk = inv(7.5, 7.8, t);
  j.rotation.z = easeIn(tk) * 1.6; j.position.set(-0.1 - tk * 0.2, 0.68 - easeIn(tk) * 0.6, 0.14 + tk * 0.1); j.visible = t < 7.8;
}
function guardIdle(Gd, pos, yaw, t, extra = {}) { C.poseGuard(Gd, { pos, yaw, wing: 0.15, bob: Math.sin(t * 3) * 0.01, propSpeed: 6, ...extra }, t); }

shot(6.0, 6.75, 'S3a slide', {
  pip: pipTheft,
  run(t, w) {
    const ps = pipTheft(t); C.posePip(w.pip, ps, t);
    C.posePuff(w.puff, puffTheft(t, ps), t);
    const cp = ps.pos.clone().add(V(-0.22, 0.34, 1.3)), ct = J.clone().add(V(0, 0.45, 0));
    setCam(w, cp, ct, 46, -0.05);
    return { brush: 2, shadow: [VEN, 4], dust: [V(-17.06, 8.02, 1.3), 6.35] };
  },
});
shot(6.75, 7.45, 'S3b latch', {
  pip: pipTheft,
  run(t, w) {
    const ps = pipTheft(t); C.posePip(w.pip, ps, t);
    C.posePuff(w.puff, puffTheft(t, ps), t);
    const cp = J.clone().add(V(0.62, 1.0, -0.5)), ct = J.clone().add(V(0, 0.82, 0.2));
    setCam(w, cp.add(V(-0.1 * inv(6.75, 7.45, t), 0, 0)), ct, 36);
    return { brush: 1.8, shadow: [J, 2.5], sparkle: [J.clone().add(V(0, 1.0, 0)), 7.27] };
  },
});
shot(7.45, 7.92, 'S3c escape', {
  pip: pipTheft,
  run(t, w) {
    const ps = pipTheft(t); C.posePip(w.pip, ps, t);
    C.posePuff(w.puff, puffTheft(t, ps), t);
    const cp = V(-16.7, 8.38, -0.05), ct = V(-17.05, 8.45, 1.0);
    setCam(w, cp.add(shake(t, 0.01 * bump(7.6, 7.9, t))), ct, 40);
    return { brush: 1.8, shadow: [J, 3] };
  },
});
shot(7.92, 8.24, 'S3d aghast', {
  pip: pipTheft,
  run(t, w) {
    const ps = pipTheft(t); C.posePip(w.pip, ps, t);
    C.posePuff(w.puff, puffTheft(t, ps), t);
    const cp = V(-16.72, 8.3, 0.22), ct = V(-17.15, 9.85, 1.55);
    setCam(w, cp.add(shake(t, 0.015)), ct, 42, 0.08);
    return { brush: 1.8, shadow: [VEN, 4] };
  },
});
shot(8.24, 8.5, 'S3e guards spin', {
  run(t, w) {
    const spin = easeOutBack(inv(8.24, 8.42, t));
    const Gs = w.P.guards; const pos = [SP.g1, SP.g2, SP.g3];
    Gs.forEach((g, i) => guardIdle(g, pos[i].clone().add(V(0, bump(8.24, 8.4, t) * 0.15, 0)), lerp(Math.PI * 0.9, 0, spin) + i * 0.1, t, { alarm: true, propSpeed: 40, wing: 0.6, armRaise: 0.9 }));
    const cp = V(-20.1, 8.6, 1.6), ct = V(-20.4, 8.9, -3.2);
    setCam(w, cp.add(shake(t, 0.01)), ct, 38, -0.12);
    return { brush: 2, shadow: [SP.g2, 4] };
  },
});

// ====== S4: chase through the market (8.5 – 12.5) ======
function pipChase(t) {
  if (t < 8.98) { const k = inv(8.5, 8.98, t); return pipRunOnCurve(curveGap, k, t, { expr: { open: 1, size: 1.15, pupil: 0.7, mouth: 'wobble' } }); }
  if (t < 9.92) { const k = inv(8.98, 9.92, t); return pipRunOnCurve(curveStreet, k * 0.33, t, { phaseBase: 20, expr: { open: 1, angry: 0.35, mouth: 'grin', lookX: 0.0 } }); }
  if (t < 10.42) {
    const k = inv(9.92, 10.42, t); const s = pipRunOnCurve(curveStreet, 0.33 + k * 0.2, t, { phaseBase: 20 });
    const sl = smooth(0.15, 0.3, k) * (1 - smooth(0.8, 1, k));
    s.lean = lerp(s.lean, -1.0, sl); s.legL = [lerp(s.legL[0], 1.3, sl), 0.1]; s.legR = [lerp(s.legR[0], 1.1, sl), 0.2]; s.armL = [lerp(s.armL[0], -0.5, sl), 1.2, 0.2]; s.armR = [lerp(s.armR[0], -0.5, sl), 1.2, 0.2]; s.bob = -0.12 * sl;
    s.expr = { open: 1, size: 1.1, mouth: sl > 0.5 ? 'o' : 'grin' }; return s;
  }
  if (t < 10.9) { const k = inv(10.42, 10.9, t); const s = pipRunOnCurve(curveStreet, 0.53 + k * 0.47, t, { phaseBase: 20, expr: { open: 1, mouth: 'grin', angry: 0.3 } }); if (k > 0.75) { const jk = inv(0.75, 1, k); s.pos.y += Math.sin(jk * Math.PI) * 0.5 + jk * 1.2; s.legL = [0.9, 1.2]; s.legR = [0.4, 0.6]; } return s; }
  if (t < 11.12) {
    const k = inv(10.9, 11.12, t); return merge(pipIdle(t), { pos: AWN_TOP.clone().add(V(0, -0.25 * Math.sin(k * Math.PI), 0)), yaw: 1.7, squash: 1 - Math.sin(k * Math.PI) * 0.3, legL: [0.5, 1.2], legR: [0.5, 1.2], armL: [-0.5, 1.0, 0.4], armR: [-0.5, 1.0, 0.4], expr: { squint: 1 } });
  }
  if (t < 11.6) {
    const k = inv(11.12, 11.6, t); const p = jumpArc(AWN_TOP, RAIL0.clone().add(V(0, 0.08, 0)), 1.7, k);
    return merge(pipIdle(t), { pos: p, yaw: 1.55, lean: 0.3 - k * 0.5, roll: -k * 0.4, squash: 1 + bump(0, 0.3, k) * 0.25, legL: [0.9, 1.3], legR: [0.2, 0.4], armL: [2.6, 0.5, 0.2], armR: [1.5, 1.0, 0.2], expr: { open: 1, size: 1.2, mouth: 'grin', sparkle: 0.7, happy: k > 0.3 && k < 0.8 ? 1 : 0 } });
  }
  return pipGrind(t);
}
let _w;
function pipGrind(t) {
  const k = inv(11.6, 13.12, t); const u = easeIn(k) * 0.35 + k * 0.65;
  const c = _w.city.market.railCurve; const p = c.getPointAt(clamp(u)); const tan = c.getTangentAt(clamp(u));
  const yaw = Math.atan2(tan.x, tan.z);
  return merge(pipIdle(t), { pos: p.add(V(0, 0.08, 0)), yaw: yaw + 0.5, lean: -0.1, roll: Math.sin(t * 9) * 0.06 - 0.15, squash: 0.95, legL: [0.35, 0.5, 0.2], legR: [-0.35, 0.5, 0.2], armL: [0.3, 1.4, 0.2], armR: [0.6, 1.3, 0.3], headYaw: -0.35, expr: { open: 1, mouth: 'grin', sparkle: 0.4, angry: 0.2 } });
}
function guardsChase(w, t) {
  const Gs = w.P.guards;
  const g1k = inv(8.5, 10.3, t); const gp = curveGuard.getPointAt(clamp(easeIn(g1k) * 0.3 + g1k * 0.7));
  if (t < 10.3) C.poseGuard(Gs[0], { pos: gp, yaw: 0, run: t * 22, runAmt: 1, lean: 0.3, wing: 0.7, flap: 1, propSpeed: 45, alarm: true, armRaise: 1.1, armSwing: -1.3 }, t);
  else { const k = inv(10.3, 10.8, t); C.poseGuard(Gs[0], { pos: SP.noodle.clone().add(V(0, 0.15 + Math.sin(t * 6) * 0.05, -0.1)), yaw: t * 14 * (1 - k * 0.7), lean: 0.4, roll: Math.sin(t * 9) * 0.3, wing: 0.9, flap: 1, propSpeed: 40, alarm: true, armRaise: 1.5, armSwing: Math.sin(t * 20) }, t); }
  for (const [i, lag] of [[1, 0.45], [2, 0.8]]) {
    const k = inv(8.5 + lag, 10.8 + lag, t); const p = curveGuard.getPointAt(clamp(k)).add(V(i === 1 ? 0.45 : -0.45, 0, 0));
    C.poseGuard(Gs[i], { pos: p, yaw: 0, run: t * 22 + i, runAmt: 1, lean: 0.3, wing: 0.6, flap: 1, propSpeed: 45, alarm: true, armRaise: 1.1, armSwing: -1.3 }, t);
  }
}
function poseNoodle(w, t) { const N = w.P.noodle; N.root.position.copy(SP.noodle).add(V(0, Math.sin(t * 2) * 0.04 + bump(10.0, 10.5, t) * 0.12, 0)); N.root.rotation.z = bump(10.0, 10.9, t) * Math.sin(t * 20) * 0.08; N.noodles.rotation.y = t * 8; N.prop.rotation.y = t * 25; }
function poseAwning(w, t) { const c = w.P.awningCloth; const k = inv(10.9, 11.6, t); c.position.y = 1.7 - Math.sin(Math.min(1, k * 2.2) * Math.PI) * 0.25 * (1 - k); c.rotation.z = Math.sin(k * 25) * 0.15 * (1 - k); }

shot(8.5, 9.85, 'S4a tracking', {
  pip: pipChase,
  run(t, w) {
    const ps = pipChase(t); C.posePip(w.pip, ps, t);
    C.posePuff(w.puff, puffOnPip(ps, t), t);
    const side = right(ps.yaw).multiplyScalar(-0.85);
    const cp = ps.pos.clone().add(side).add(V(0, 0.22, 0)).add(fwd(ps.yaw).multiplyScalar(0.25));
    const ct = ps.pos.clone().add(V(0, 0.35, 0)).add(fwd(ps.yaw).multiplyScalar(0.15));
    setCam(w, cp.add(shake(t, 0.01)), ct, 52, 0.05);
    return { brush: 1.8, shadow: [ps.pos, 4], motion: [0.004, 0] };
  },
});
shot(9.85, 10.8, 'S4b noodle', {
  pip: pipChase,
  run(t, w) {
    const ps = pipChase(t); C.posePip(w.pip, ps, t);
    C.posePuff(w.puff, puffOnPip(ps, t, { squash: 1 - bump(10.05, 10.35, t) * 0.4, expr: { eyes: 'squeeze', mouth: 'grin', mouthOpen: 0.8 } }), t);
    const cp = V(-19.85, 8.18, 7.3), ct = V(-20.2, 8.45, 5.2);
    setCam(w, cp.add(shake(t, 0.006)), ct, 44, -0.04);
    return { brush: 1.8, shadow: [SP.noodle, 4] };
  },
});
shot(10.8, 11.62, 'S4c awning', {
  pip: pipChase,
  run(t, w) {
    const ps = pipChase(t); C.posePip(w.pip, ps, t);
    C.posePuff(w.puff, puffOnPip(ps, t, { squash: 1 + bump(11.0, 11.3, t) * 0.3 }), t);
    const cp = V(-16.6, 9.2, 13.6), ct = V(-18.6, 10.0, 8.9).lerp(V(-17.6, 10.2, 9.3), smooth(11.0, 11.6, t));
    setCam(w, cp, ct, 40);
    return { brush: 2, shadow: [V(-18.5, 9, 9), 5] };
  },
});
shot(11.62, 12.5, 'S4d grind & airship', {
  pip: pipChase,
  run(t, w) {
    const ps = pipChase(t); C.posePip(w.pip, ps, t);
    C.posePuff(w.puff, puffOnPip(ps, t, { expr: { eyes: 'happy', mouth: 'grin', mouthOpen: 1 } }), t);
    const hs = w.P.heroShip; const k = inv(11.3, 12.8, t);
    hs.position.set(lerp(-6, -24, k), 14.2 + Math.sin(t) * 0.2, 9.5); hs.rotation.set(0, Math.PI, Math.sin(t * 0.8) * 0.04); hs.userData.tail.rotation.y = Math.sin(t * 2) * 0.3; hs.userData.prop.rotation.x = t * 25;
    const back = fwd(ps.yaw - 0.5).multiplyScalar(-1.3);
    const cp = ps.pos.clone().add(back).add(V(0.0, -0.25, 0.4)), ct = ps.pos.clone().add(V(0, 0.9, 0)).lerp(hs.position, 0.12);
    setCam(w, cp.add(shake(t, 0.012)), ct, 58, -0.15);
    return { brush: 2, shadow: [ps.pos, 6], sparks: ps.pos, motion: [0.0, -0.006] };
  },
});

// ====== S5: the impossible shortcut (12.5 – 16.5) ======
function pipBridge(t) {
  if (t < 13.12) return pipGrind(t);
  if (t < 14.05) {
    const k = inv(13.12, 14.05, t); const x = lerp(-16.0, -5.62, k * 0.92 + easeIn(k) * 0.08);
    const s = merge(pipIdle(t), C.runCycle(t * 40, 1.15, 1.5)); s.pos = V(x, 0, lerp(0.55, 0.0, smooth(0, 0.3, k))); s.yaw = Math.PI / 2; s.lean = 0.45;
    s.expr = { open: 1, angry: 0.5, mouth: 'grin', size: 1.05 }; return s;
  }
  if (t < 15.7) {
    const k0 = inv(14.05, 15.7, t);
    const k = k0 < 0.5 ? easeOut(k0 * 2) * 0.5 : 0.5 + easeIn((k0 - 0.5) * 2) * 0.5;
    const p = jumpArc(V(-5.62, 0, 0), V(-0.25, -0.38, 0), 2.6, k);
    const air = smooth(0.0, 0.15, k0);
    return merge(pipIdle(t), { pos: p, yaw: Math.PI / 2, lean: 0.2 - 0.4 * k0, roll: Math.sin(t * 3) * 0.08, squash: 1 + bump(0, 0.12, k0) * 0.25,
      legL: [0.5 * air + Math.sin(t * 10) * 0.3 * air, 0.8], legR: [-0.2 * air - Math.sin(t * 10) * 0.3 * air, 0.5], armL: [2.9 * air, 0.3, 0.1], armR: [2.9 * air, 0.3, 0.1],
      headPitch: -0.25, expr: { open: 1, size: 1.1, sparkle: 0.8, mouth: k0 > 0.25 && k0 < 0.7 ? 'grin' : 'o', happy: k0 > 0.35 && k0 < 0.55 ? 1 : 0 } });
  }
  if (t < 16.1) {
    const k = inv(15.7, 16.1, t);
    const p = V(-0.25, -0.38, 0).lerp(V(0.35, 0.0, 0.0), easeOutBack(smooth(0.35, 1, k)));
    return merge(pipIdle(t), { pos: p, yaw: Math.PI / 2, lean: 0.4 * (1 - k), armL: [2.7 - k * 2.0, 0.2, 0.2], armR: [2.7 - k * 2.0, 0.2, 0.2], legL: [Math.sin(t * 30) * 0.6 * (1 - k), 0.5], legR: [-Math.sin(t * 30) * 0.6 * (1 - k), 0.5], expr: { squint: k < 0.5 ? 1 : 0, open: 1, mouth: 'flat' } });
  }
  return merge(pipIdle(t), { pos: V(0.4, 0, 0.0), yaw: -Math.PI / 2 + 0.3, headYaw: 0.2, expr: { open: 1, lookX: 0.3, mouth: 'grin' } });
}
function puffBridge(t, ps) {
  if (t < 14.25) return puffOnPip(ps, t);
  if (t < 15.75) {
    const k = inv(14.25, 15.75, t); const inf = smooth(0, 0.25, k) * (1 - smooth(0.8, 1, k));
    return { pos: ps.pos.clone().add(V(0, 0.78 + inf * 0.35, 0)), yaw: ps.yaw - 0.4, scale: 0.62 + inf * 0.25, inflate: inf * 1.6, squash: 0.75 + Math.sin(t * 6) * 0.05, expr: { eyes: inf > 0.5 ? 'squeeze' : 'wide', mouth: 'grin', mouthOpen: 0.8, blush: 1 } };
  }
  return puffOnPip(ps, t, { expr: { eyes: 'happy', mouth: 'grin' } });
}
function guardBridge(w, t) {
  const G2 = w.P.guards[1];
  if (t < 16.0) {
    const k = inv(13.4, 16.0, t); const x = Math.min(bridgeEnd(t) - 0.2, lerp(-16.3, -9.3, k));
    C.poseGuard(G2, { pos: V(x, 0, -0.1), yaw: Math.PI / 2, run: t * 24, runAmt: 1, lean: 0.35, wing: 0.7, flap: 1, propSpeed: 45, alarm: true, armRaise: 1.1, armSwing: -1.3 }, t);
  } else {
    const k = inv(16.0, 16.45, t); const p = jumpArc(V(-9.4, 0, -0.1), V(-6.5, -1.22, 0), 0.6, easeOut(k));
    const sw = Math.sin((t - 16.45) * 4) * 0.25 * Math.exp(-Math.max(0, t - 16.45) * 0.5) * (t > 16.45 ? 1 : 0);
    C.poseGuard(G2, { pos: p, yaw: Math.PI / 2, roll: lerp(0, Math.PI, easeOut(k)) + sw, wing: 1.0, flap: 1 - k, propSpeed: 30 * (1 - k) + 4, alarm: true, armRaise: 1.6, armSwing: Math.sin(t * 12) * 0.5, legX: 0.3 }, t);
  }
}
shot(12.5, 13.15, 'S5a spot balcony', {
  pip: pipBridge,
  run(t, w) {
    const ps = pipBridge(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBridge(t, ps), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.92, bloom: 0.12, health: 0.05 }, t);
    const cp = ps.pos.clone().add(V(-1.3, 0.55, 1.0)), ct = ps.pos.clone().add(V(0.3, 0.3, -0.2)).lerp(V(0.6, 0.25, 0), smooth(12.75, 13.1, t));
    setCam(w, cp, ct, 46);
    return { brush: 2, shadow: [V(-12, 0, 2), 8] };
  },
});
shot(13.15, 14.05, 'S5b sprint', {
  pip: pipBridge,
  run(t, w) {
    const ps = pipBridge(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBridge(t, ps), t);
    const cp = V(ps.pos.x - 0.5, 0.22, 2.1), ct = V(ps.pos.x + 0.9, 0.25, 0);
    setCam(w, cp, ct, 46, 0.03);
    return { brush: 2.2, shadow: [V(-7, 0, 0), 10], motion: [0.003, 0] };
  },
});
shot(14.05, 14.45, 'S5c leap', {
  pip: pipBridge,
  run(t, w) {
    const ps = pipBridge(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBridge(t, ps), t);
    const cp = V(-4.6, -1.0, 1.4), ct = ps.pos.clone().add(V(0.2, 0.35, 0));
    setCam(w, cp, ct, 50, 0.12);
    return { brush: 2, shadow: [ps.pos, 5] };
  },
});
shot(14.45, 15.7, 'S5d hang time', {
  pip: pipBridge,
  run(t, w) {
    const ps = pipBridge(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBridge(t, ps), t);
    const k = inv(14.45, 15.7, t);
    const cp = V(-3.6, -2.6, 4.6).lerp(V(-2.6, -2.2, 4.2), k), ct = ps.pos.clone().add(V(0, 0.9, -1.2));
    setCam(w, cp, ct, 50, -0.08);
    return { brush: 3, shadow: [ps.pos, 12], rays: 1.0 };
  },
});
shot(15.7, 16.12, 'S5e catch ledge', {
  pip: pipBridge,
  run(t, w) {
    const ps = pipBridge(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBridge(t, ps), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.92, bloom: 0.12, health: 0.05 }, t);
    const cp = V(1.0, 0.35, 1.25), ct = V(-0.1, 0.0, 0.0);
    setCam(w, cp.add(shake(t, 0.01 * bump(15.7, 15.9, t))), ct, 42);
    return { brush: 2, shadow: [V(0, 0, 0), 3] };
  },
});
shot(16.12, 16.5, 'S5f guard dangles', {
  pip: pipBridge,
  run(t, w) {
    const ps = pipBridge(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBridge(t, ps), t);
    const cp = V(-4.6, -1.2, 2.2), ct = V(-6.55, -1.75, 0);
    setCam(w, cp, ct, 40);
    return { brush: 2, shadow: [V(-6.5, -1, 0), 5] };
  },
});

// ====== S6: the failed miracle (16.5 – 19.0) ======
function pipBalcony(t) {
  const s = merge(pipIdle(t), { pos: PB.clone(), yaw: BAL_YAW });
  if (t < 16.9) {
    const k = inv(16.5, 16.9, t); s.pos = V(0.4, 0, 0.0).lerp(PB, easeOut(k)); s.pos.y = Math.abs(Math.sin(k * Math.PI)) * 0.1;
    s.lean = k * Math.PI * 2 * (1 - k * 0.15); s.squash = 0.85; s.legL = [1.2, 1.4]; s.legR = [1.2, 1.4]; s.armL = [1.5, 0.6, 1.2]; s.armR = [1.5, 0.6, 1.2]; s.expr = { squint: 1 };
    return s;
  }
  if (t < 17.45) {
    const k = inv(16.9, 17.45, t); const pres = easeOutBack(smooth(0.25, 0.6, k));
    s.squash = 1 + bump(0, 0.3, k) * 0.15 - bump(0.3, 0.5, k) * 0.08;
    s.armL = [0.6 + pres * 0.7, 0.3 + pres * 0.9, 0.2]; s.armR = [0.6 + pres * 0.3, 0.3 + pres * 0.3, 0.2];
    s.headYaw = lerp(0.5, -0.4, pres); s.headPitch = 0.1; s.headRoll = 0.15 * pres;
    s.expr = { open: 1, happy: pres > 0.4 ? 1 : 0, mouth: 'grin', blush: 0.4 };
    return s;
  }
  if (t < 18.5) {
    const hope = smooth(17.45, 17.6, t), drop = smooth(18.0, 18.2, t);
    s.headYaw = -0.6; s.headPitch = lerp(-0.25, 0.25, drop * bump(17.95, 18.5, t)); s.armL = [0.9, 0.3, 1.4]; s.armR = [0.9, 0.3, 1.4];
    s.expr = { open: blink(t, BLINKS), lookX: -0.3, lookY: lerp(0.4, -0.4, drop * bump(17.95, 18.6, t)), size: 1 + hope * 0.1, sparkle: hope * (1 - drop), droop: smooth(18.2, 18.45, t) * 0.4, mouth: drop > 0.5 ? 'flat' : 'o' };
    return s;
  }
  const pat = bump(18.5, 18.72, t), hug = smooth(18.7, 18.9, t);
  s.headYaw = -0.45; s.headRoll = 0.25 * hug; s.lean = 0.12 * hug;
  s.armR = [1.6 + Math.sin(t * 28) * 0.2 * pat, 0.2, 0.4 + 0.5 * hug]; s.armL = [lerp(0.3, 1.5, hug), lerp(0.2, 0.8, hug), 0.6 * hug];
  s.pos = PB.clone().add(fwd(s.yaw).multiplyScalar(0.06 * hug));
  s.expr = { open: 1, happy: hug > 0.5 ? 1 : 0, mouth: 'smile', blush: 0.6 * hug, lookX: -0.4 };
  return s;
}
const PUFF_REST = () => PB.clone().add(V(-0.22, 0.44, -0.42));
const PUFF_YAW = () => yawTo(PUFF_REST(), V(0.35, 0.4, 1.0));
function puffBalcony(t) {
  if (t < 16.9) { const k = inv(16.5, 16.9, t); return { pos: V(0.4, 0.7, 0.2).lerp(PUFF_REST(), easeOut(k)).add(V(0, Math.abs(Math.sin(k * 9)) * 0.15 * (1 - k), 0)), yaw: 1.0, scale: 0.62, squash: 1 + Math.sin(k * 14) * 0.2, expr: { eyes: 'squeeze', mouth: 'grin' } }; }
  const base = { pos: PUFF_REST(), yaw: PUFF_YAW(), scale: 0.62, expr: { eyes: 'open', mouth: 'smile', lookX: 0.4 } };
  if (t < 17.45) { base.expr = { eyes: 'open', mouth: 'o', mouthOpen: 0.3, lookX: -0.4, lookY: -0.5 }; base.pitch = 0.25 * smooth(17.1, 17.3, t); base.squash = 1 + bump(17.25, 17.4, t) * 0.08; return base; }
  if (t < 18.2) {
    const strain = smooth(17.5, 17.6, t) * (1 - smooth(17.9, 18.0, t));
    base.pos.add(V(Math.sin(t * 60) * 0.006 * strain, 0, Math.cos(t * 55) * 0.006 * strain));
    base.squash = 1 - strain * 0.18; base.scale = 0.62 - strain * 0.03;
    base.expr = { eyes: t < 17.55 ? 'open' : 'squeeze', determined: t < 17.55 ? 1 : 0, mouth: t < 17.55 ? 'flat' : 'strain', blush: 1 + strain * 0.5 };
    base.glow = -0.12 * strain;
    if (t > 17.95) base.expr = { eyes: 'open', mouth: 'o', mouthOpen: 0.2, lookY: -0.8, blush: 1 };
    return base;
  }
  if (t < 18.5) {
    const k = smooth(18.2, 18.45, t);
    base.pos.y -= 0.07 * k; base.squash = 1 - 0.12 * k; base.pitch = 0.2 * k;
    base.expr = { eyes: 'open', sad: k, mouth: 'wobble', blush: 1 - 0.8 * k, tears: 0.6 * k, lookY: -0.6 };
    base.glow = -0.1 * k;
    return base;
  }
  const hug = smooth(18.7, 18.9, t);
  base.pos.y -= 0.07 * (1 - hug * 0.5); base.squash = 1 - 0.12 * (1 - hug) + bump(18.5, 18.72, t) * Math.sin(t * 28) * 0.05; base.pitch = 0.2 * (1 - hug);
  base.expr = { eyes: hug > 0.5 ? 'closed' : 'open', sad: 1 - hug, mouth: hug > 0.6 ? 'smile' : 'wobble', blush: 0.2 + hug * 0.6, tears: 0.6 * (1 - hug), lookY: -0.3 };
  return base;
}
function dropS6(w, t) {
  const d = w.P.drop; const k = inv(17.98, 18.2, t);
  d.visible = t > 17.92 && t < 18.25;
  const from = PUFF_REST().add(V(0.02, -0.12, 0.02)), to = F.clone().add(V(0.0, 0.01, 0.02));
  d.position.copy(from).lerp(to, easeIn(k)); d.scale.set(1, 1 + k * 0.8, 1).multiplyScalar(t < 17.98 ? smooth(17.92, 17.98, t) : 1);
}
function guardsBackground(w, t) {
  const G2 = w.P.guards[1], G3 = w.P.guards[2];
  const sw = Math.sin((t - 16.45) * 4) * 0.25 * Math.exp(-(t - 16.45) * 0.5);
  C.poseGuard(G2, { pos: V(-6.5, -1.22, 0), yaw: Math.PI / 2, roll: Math.PI + sw, wing: 1.0, propSpeed: 4, alarm: false, armRaise: 1.6, armSwing: Math.sin(t * 3) * 0.3, legX: 0.3 }, t);
  const k = inv(17.6, 18.9, t);
  const x = lerp(-15.8, -9.9, easeOut(k)); const skid = smooth(20.8, 21.1, t);
  C.poseGuard(G3, { pos: V(x + skid * 0.3, 0, 0.15), yaw: Math.PI / 2, run: t * 22, runAmt: 1 - smooth(18.6, 18.9, t), lean: lerp(0.35, -0.3, skid), wing: 0.7, flap: 1, propSpeed: 40, alarm: t < 20.8, armRaise: 1.1 + skid * 0.6, armSwing: -1.3 }, t);
}
shot(16.5, 17.45, 'S6a present', {
  pip: pipBalcony,
  run(t, w) {
    const ps = pipBalcony(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBalcony(t), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.92, bloom: 0.12, health: 0.05 }, t);
    const cp = V(0.15, 0.48, 1.25), ct = V(1.05, 0.32, 0.35);
    setCam(w, cp, ct, 42);
    return { brush: 1.6, shadow: [PB, 2.5] };
  },
});
shot(17.45, 18.5, 'S6b tries to rain', {
  pip: pipBalcony,
  run(t, w) {
    const ps = pipBalcony(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBalcony(t), t); dropS6(w, t);
    C.poseFlower(w.flower, { pos: F, droop: 0.92 - bump(18.18, 18.4, t) * 0.08, bloom: 0.12, health: 0.05, tremble: bump(18.18, 18.5, t) * 2 }, t);
    const k = inv(17.45, 18.5, t);
    const cp = V(0.3, 0.42, 1.12).lerp(V(0.4, 0.4, 1.0), k), ct = V(1.08, 0.28, 0.25);
    setCam(w, cp, ct, 42);
    return { brush: 1.5, shadow: [PB, 2] };
  },
});
shot(18.5, 19.0, 'S6c hug', {
  pip: pipBalcony,
  run(t, w) {
    const ps = pipBalcony(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffBalcony(t), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.9, bloom: 0.12, health: 0.05 }, t);
    const k = inv(18.5, 19.0, t);
    const cp = V(0.45, 0.44, 1.0).lerp(V(0.55, 0.44, 0.9), k), ct = PB.clone().add(V(-0.15, 0.4, -0.25));
    setCam(w, cp, ct, 34);
    return { brush: 1.5, shadow: [PB, 2] };
  },
});

// ====== S7: the sneeze (19.0 – 22.0) ======
function pipSneeze(t) {
  const s = pipBalcony(Math.min(t, 18.99));
  s.pos = PB.clone(); s.yaw = BAL_YAW;
  const startle = smooth(19.9, 20.1, t);
  s.headYaw = -0.45 * (1 - startle) - 0.3 * startle; s.headPitch = lerp(0, -0.75, smooth(19.9, 20.5, t)); s.headRoll = 0.25 * (1 - startle);
  s.armL = [lerp(1.5, 0.4, startle), lerp(0.8, 1.1, startle), 0.6]; s.armR = [lerp(1.6, 0.4, startle), lerp(0.2, 1.1, startle), 0.6];
  s.pos.add(fwd(s.yaw).multiplyScalar(-0.12 * smooth(19.95, 20.3, t)));
  s.lean = -0.25 * startle; s.squash = 1 + bump(19.9, 20.1, t) * 0.15;
  s.expr = { open: 1, happy: t < 19.85 ? 1 : 0, mouth: t < 19.85 ? 'w' : 'o', size: 1 + startle * 0.25, pupil: 1 - startle * 0.35, lookY: startle * 0.9, blush: 0.5 * (1 - startle) };
  if (t > 21.48) { const blast = smooth(21.48, 21.6, t); s.lean = -0.5 * blast; s.pos.add(fwd(s.yaw).multiplyScalar(-0.1 * blast)); s.squash = 1 - bump(21.48, 21.7, t) * 0.25; s.expr = { squint: 1 }; s.armL = [2.2, 0.8, 0.4]; s.armR = [2.2, 0.8, 0.4]; }
  return s;
}
function puffSneeze(t) {
  const base = { pos: PUFF_REST(), yaw: PUFF_YAW(), scale: 0.62 };
  if (t < 19.6) {
    base.squash = 1 + Math.sin(t * 34) * 0.07; base.roll = Math.sin(t * 22) * 0.12; base.pos.y += Math.abs(Math.sin(t * 17)) * 0.03;
    base.expr = { eyes: 'happy', mouth: 'grin', mouthOpen: 0.6 + Math.sin(t * 34) * 0.3, blush: 1.4 }; return base;
  }
  const gulps = [[19.95, 20.2, 0.4], [20.3, 20.55, 0.9], [20.65, 20.95, 1.6], [21.0, 21.35, 2.6]];
  let inf = 0; for (const [a, b, v] of gulps) inf = Math.max(inf, smooth(a, b, t) * v);
  const blast = smooth(21.48, 21.56, t);
  inf = inf * (1 - blast);
  base.inflate = inf; base.pos.y += inf * 0.18;
  base.squash = 1 + Math.sin(t * 9) * 0.03 + (blast > 0 ? -bump(21.48, 21.8, t) * 0.3 : 0);
  base.expr = { eyes: inf > 1.2 ? 'squeeze' : 'wide', mouth: inf > 0.2 ? 'o' : 'smile', mouthOpen: clamp(inf * 0.5), wrinkle: smooth(19.6, 19.9, t), blush: 1 + inf * 0.2 };
  if (t > 21.2 && t < 21.48) base.expr = { eyes: 'squeeze', mouth: 'open', mouthOpen: 0.5 + Math.sin(t * 50) * 0.15, wrinkle: 1 };
  if (t >= 21.48) { base.expr = { eyes: 'squeeze', mouth: 'open', mouthOpen: 1, wrinkle: 0.5 }; base.pos.add(V(0.05, -0.04, 0.05).multiplyScalar(bump(21.48, 21.8, t))); }
  if (t > 21.85) base.expr = { eyes: 'wide', mouth: 'o', mouthOpen: 0.3 };
  return base;
}
shot(19.0, 19.65, 'S7a giggle', {
  pip: pipSneeze,
  run(t, w) {
    C.posePip(w.pip, pipSneeze(t), t); C.posePuff(w.puff, puffSneeze(t), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.9, bloom: 0.12, health: 0.05 }, t);
    const cp = V(0.48, 0.46, 1.02), ct = PB.clone().add(V(-0.15, 0.42, -0.25));
    setCam(w, cp, ct, 34);
    return { brush: 1.5, shadow: [PB, 2] };
  },
});
shot(19.65, 21.2, 'S7b inhale', {
  pip: pipSneeze,
  run(t, w) {
    C.posePip(w.pip, pipSneeze(t), t); C.posePuff(w.puff, puffSneeze(t), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.9, bloom: 0.12, health: 0.05 }, t);
    const k = easeInOut(inv(19.65, 21.2, t));
    const cp = V(0.4, 0.32, 1.15).lerp(V(0.2, 0.18, 1.35), k), ct = PB.clone().add(V(-0.2, 0.45 + k * 0.55, -0.3));
    setCam(w, cp, ct, lerp(36, 46, k));
    return { brush: 1.6, shadow: [PB, 3] };
  },
});
shot(21.2, 21.5, 'S7d beat', {
  pip: pipSneeze,
  run(t, w) {
    C.posePip(w.pip, pipSneeze(t), t); C.posePuff(w.puff, puffSneeze(t), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.9, bloom: 0.12, health: 0.05 }, t);
    const pf = PUFF_REST().add(V(0, 0.55, 0));
    const cp = pf.clone().add(V(-0.75, -0.15, 1.0)).add(V(0.1, 0, -0.1).multiplyScalar(inv(21.2, 21.5, t))), ct = pf;
    setCam(w, cp, ct, 40);
    return { brush: 1.6, shadow: [PB, 3], exposure: 0.95 };
  },
});
shot(21.5, 22.0, 'S7e ACHOO', {
  pip: pipSneeze,
  run(t, w) {
    C.posePip(w.pip, pipSneeze(t), t); C.posePuff(w.puff, puffSneeze(t), t);
    C.poseFlower(w.flower, { pos: F, droop: 0.9 - smooth(21.6, 22, t) * 0.1, bloom: 0.12, health: 0.05 + smooth(21.6, 22, t) * 0.1 }, t);
    const k = easeOut(inv(21.5, 22.0, t));
    const cp = V(0.3, 0.3, 1.2).lerp(V(0.2, 0.22, 1.45), k), ct = V(1.1, 0.62, 0.1).lerp(V(0.95, 1.9, -0.1), easeInOut(inv(21.6, 22.0, t)));
    setCam(w, cp.add(shake(t, 0.03 * (1 - k))), ct, lerp(52, 60, k));
    return { brush: 2, shadow: [PB, 3], flash: bump(21.48, 21.62, t) * 0.45, exposure: 1.05 };
  },
});

// ====== S8: the city blooms (22.0 – 26.5) ======
function pipLooksUp(t) { const s = pipSneeze(21.99); s.lean = -0.15; s.squash = 1; s.headPitch = -0.8; s.armL = [0.6, 1.0, 0.4]; s.armR = [0.6, 1.0, 0.4]; s.expr = { open: 1, size: 1.25, sparkle: 1, mouth: 'o', lookY: 1 }; return s; }
shot(22.0, 23.3, 'S8a rainbow canopy', {
  run(t, w) {
    C.posePip(w.pip, pipLooksUp(t), t); C.posePuff(w.puff, { pos: PUFF_REST().add(V(0, 0.15, 0)), scale: 0.62, expr: { eyes: 'wide', mouth: 'o', mouthOpen: 0.4, lookY: 1 } }, t);
    C.poseFlower(w.flower, { pos: F, droop: 0.8, bloom: 0.15, health: 0.2 }, t);
    const k = easeInOut(inv(22.0, 23.3, t));
    const cp = V(-4, 2, 12).lerp(V(-2, 13, 14.5), k), ct = V(-2, 8, -4).lerp(V(-7, 10, -8), k);
    setCam(w, cp, ct, 55);
    return { brush: 3, shadow: [V(-6, 0, 0), 30], rays: 0.8 };
  },
});
shot(23.3, 24.1, 'S8b facade bloom', {
  run(t, w) {
    const k = easeInOut(inv(23.3, 24.1, t));
    const cp = V(-3.6, 6.5, 5.2).lerp(V(-3.0, -1.5, 5.6), k), ct = V(1.6, 4.0, -1.2).lerp(V(1.6, -2.5, -1.2), k);
    setCam(w, cp, ct, 48, 0.05);
    return { brush: 2.5, shadow: [V(2, 0, 0), 12] };
  },
});
function vendorDelight(w, t) {
  const V_ = w.P.vendor; V_.root.position.copy(VEN); V_.root.rotation.y = 0.5;
  const j = Math.abs(Math.sin(t * 9)); V_.torso.position.y = 1.25 + j * 0.08; V_.head.rotation.set(-0.3, 0, Math.sin(t * 5) * 0.1); V_.hat.position.y = 0.12; V_.hat.rotation.z = 0;
  V_.arms.forEach((a, i) => { const s = i ? 1 : -1; a.sh.rotation.set(-2.5 + Math.sin(t * 9 + i) * 0.3, 0, s * 0.6); a.el.rotation.x = -0.3; });
  V_.lensGlow.material.color.setHex(0xffd0f0);
  V_.tassels.forEach((ts, i) => { ts.rotation.x = Math.sin(t * 9 + i) * 0.3; });
}
shot(24.1, 24.95, 'S8c market blooms', {
  run(t, w) {
    vendorDelight(w, t);
    const Gs = w.P.guards; Gs[0].root.visible = true;
    C.poseGuard(Gs[0], { pos: SP.noodle.clone().add(V(0, 0.15, -0.1)), yaw: 0.6, wing: 0.9, propSpeed: 8, armRaise: 1.5, armSwing: Math.sin(t * 6) * 0.5, lean: 0.2 }, t);
    const k = easeInOut(inv(24.1, 24.95, t));
    const cp = V(-16.0, 9.3, 3.6).lerp(V(-16.1, 9.6, 3.1), k), ct = V(-17.15, 10.0, 1.55);
    setCam(w, cp, ct, 46);
    return { brush: 2, shadow: [VEN, 6] };
  },
});
shot(24.95, 26.5, 'S8d the whole city', {
  run(t, w) {
    const k = easeInOut(inv(24.95, 26.5, t));
    const cp = V(30, 12, 42).lerp(V(44, 22, 62), k), ct = V(-20, 10, -20).lerp(V(-24, 14, -24), k);
    setCam(w, cp, ct, 52);
    return { brush: 3.2, shadow: [V(-10, 0, -5), 40], rays: 1.0 };
  },
});

// ====== S9: the little reward (26.5 – 30.0) ======
function pipEnd(t) {
  const s = merge(pipIdle(t), { pos: PB.clone(), yaw: BAL_YAW + 0.1 });
  if (t < 27.6) { const k = smooth(26.6, 27.4, t); s.headPitch = 0.35; s.headYaw = -0.2; s.expr = { open: 1, shimmer: k, sparkle: k * 0.8, size: 1.1, lookY: -0.5, mouth: k > 0.5 ? 'smile' : 'o', blush: 0.5 * k }; s.armL = [0.6, 0.3, 1.3]; s.armR = [0.6, 0.3, 1.3]; return s; }
  const look = smooth(28.15, 28.35, t) * (1 - smooth(28.55, 28.65, t));
  const proud = smooth(28.6, 28.85, t);
  s.yaw = lerp(BAL_YAW + 0.1, BAL_YAW + 0.45, smooth(27.6, 28.6, t));
  s.headPitch = lerp(0.1, -0.35, look) - proud * 0.18; s.headYaw = 0; s.squash = 1 - bump(28.15, 28.35, t) * 0.12 + proud * 0.04;
  s.expr = { open: 1, cross: look > 0.3, lookY: look * 0.9, size: 1 + look * 0.05, mouth: look > 0.3 ? 'o' : 'smile', blush: 0.4 };
  if (proud > 0) { s.armL = [lerp(0.1, -0.3, proud), lerp(0.2, 1.1, proud), lerp(0.3, 2.2, proud)]; s.armR = [lerp(0.1, -0.3, proud), lerp(0.2, 1.1, proud), lerp(0.3, 2.2, proud)]; s.lean = -0.12 * proud; s.expr = { open: 1, happy: 1, mouth: 'grin', blush: 0.6, sparkle: 1 }; }
  if (t > 29.2) {
    const g = smooth(29.25, 29.35, t);
    s.squash += Math.sin(t * 30) * 0.04 * g; s.roll = Math.sin(t * 22) * 0.08 * g;
    s.expr = { open: 1, happy: 1, mouth: 'w', blush: 0.9, sparkle: 0.5 };
    if (t < 29.3) s.expr = { open: 1, cross: true, lookY: 0.2, mouth: 'o', size: 1.1 };
  }
  return s;
}
function puffEnd(t, ps) {
  if (t < 27.6) return { pos: PB.clone().add(V(-0.25, 0.55 + Math.sin(t * 2) * 0.03, -0.45)), yaw: PUFF_YAW(), scale: 0.62, expr: { eyes: 'happy', mouth: 'grin', mouthOpen: 0.6, blush: 1.2 } };
  const k = easeInOut(inv(27.6, 28.2, t));
  const head = ps.pos.clone().add(V(0, 0.6, 0)).add(fwd(ps.yaw).multiplyScalar(-0.02));
  const from = PB.clone().add(V(-0.25, 0.58, -0.45));
  const p = from.lerp(head, k); p.y += Math.sin(k * Math.PI) * 0.15;
  const settle = smooth(28.15, 28.35, t);
  const o = { pos: p, yaw: ps.yaw, scale: lerp(0.62, 0.66, settle), squash: lerp(1, 0.62, settle) + bump(28.15, 28.4, t) * 0.12, expr: { eyes: settle > 0.5 ? 'closed' : 'happy', mouth: 'smile', blush: 1.2 } };
  if (t > 28.95 && t < 29.25) o.expr = { eyes: 'squeeze', mouth: 'o', mouthOpen: 0.4, wrinkle: 1 };
  if (t >= 29.25) o.expr = { eyes: 'happy', mouth: 'grin', mouthOpen: 0.7, blush: 1.4 };
  if (t > 29.05 && t < 29.2) o.squash *= 0.9;
  return o;
}
function dropEnd(w, t, ps) {
  const d = w.P.drop; const k = inv(29.07, 29.27, t); d.visible = t > 29.05 && t < 29.4;
  const from = ps.pos.clone().add(V(0, 0.62, 0)).add(fwd(ps.yaw).multiplyScalar(0.14));
  const to = ps.pos.clone().add(V(0, 0.42, 0)).add(fwd(ps.yaw).multiplyScalar(0.22));
  d.position.copy(from).lerp(to, easeIn(k)); if (t > 29.27) d.position.y -= (t - 29.27) * 0.3; d.scale.setScalar(1.3);
}
shot(26.5, 27.6, 'S9a flower blooms', {
  pip: pipEnd,
  run(t, w) {
    const ps = pipEnd(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffEnd(t, ps), t);
    const b = easeOutBack(smooth(26.6, 27.4, t), 1.2);
    C.poseFlower(w.flower, { pos: F, droop: lerp(0.85, -0.05, easeOut(smooth(26.5, 27.2, t))), bloom: b, health: smooth(26.5, 27.1, t), glow: bump(26.9, 27.6, t) * 1.2 + 0.3 * smooth(27, 27.6, t), scale: 1 + b * 0.25 }, t);
    const k = easeInOut(inv(26.5, 27.6, t));
    const cp = F.clone().add(V(-0.72, 0.3, 0.55)).lerp(F.clone().add(V(-0.6, 0.36, 0.48)), k), ct = F.clone().add(V(0.15, 0.38 + k * 0.06, 0.05));
    setCam(w, cp, ct, 38);
    return { brush: 1.4, shadow: [F, 1.6] };
  },
});
shot(27.6, 29.05, 'S9b new hairstyle', {
  pip: pipEnd,
  run(t, w) {
    const ps = pipEnd(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffEnd(t, ps), t);
    C.poseFlower(w.flower, { pos: F, droop: -0.05, bloom: 1, health: 1, glow: 0.3, scale: 1.25 }, t);
    const f = fwd(ps.yaw);
    const cp = ps.pos.clone().add(f.clone().multiplyScalar(1.05)).add(V(0, 0.48, 0)).add(right(ps.yaw).multiplyScalar(-0.15)), ct = ps.pos.clone().add(V(0, 0.55, 0));
    setCam(w, cp, ct, 36);
    return { brush: 1.4, shadow: [PB, 2] };
  },
});
shot(29.05, 30.01, 'S9c pull back', {
  pip: pipEnd,
  run(t, w) {
    const ps = pipEnd(t); C.posePip(w.pip, ps, t); C.posePuff(w.puff, puffEnd(t, ps), t); dropEnd(w, t, ps);
    C.poseFlower(w.flower, { pos: F, droop: -0.05, bloom: 1, health: 1, glow: 0.3, scale: 1.25 }, t);
    const f = fwd(ps.yaw);
    const k = easeInOut(inv(29.4, 30.0, t));
    const c0 = ps.pos.clone().add(f.clone().multiplyScalar(0.9)).add(V(0, 0.5, 0)).add(right(ps.yaw).multiplyScalar(-0.12));
    const c1 = V(-2.6, 1.7, 3.6);
    const cp = c0.lerp(c1, k), ct = ps.pos.clone().add(V(0, 0.55, 0)).lerp(V(0.6, 0.3, -0.4), k);
    setCam(w, cp, ct, lerp(34, 50, k));
    return { brush: lerp(1.4, 2.5, k), shadow: [PB, lerp(2, 8, k)], title: smooth(29.1, 29.7, t) };
  },
});

// ------------------------------------------------------------------ per-frame update
export function updateWorld(t, w) {
  _w = w;
  t = Math.min(t, 29.999);
  const sh = SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];
  w.P.can.visible = false; w.P.drop.visible = false; w.P.flake.visible = false;
  w.P.guards.forEach(g => g.root.visible = true);
  // background state that persists across shots
  if (t < 22.5) poseVendor(w, Math.min(t, 8.45)); else vendorDelight(w, t);
  poseJarStack(w, t); poseBell(w, t); poseNoodle(w, t); poseAwning(w, t);
  poseBridge(w.P, bridgeEnd(t), t, t > 12.8 && t < 19);
  if (t < 8.24) w.P.guards.forEach((g, i) => guardIdle(g, [SP.g1, SP.g2, SP.g3][i], Math.PI * 0.9 + i * 0.1, t));
  else if (t < 12.5) guardsChase(w, t);
  else if (t < 16.5) { guardBridge(w, t); w.P.guards[0].root.visible = false; w.P.guards[2].root.visible = false; }
  else { guardsBackground(w, t); w.P.guards[0].root.visible = t > 22.5; if (t > 22.5) C.poseGuard(w.P.guards[0], { pos: SP.noodle.clone().add(V(0, 0.15, -0.1)), yaw: 0.6, wing: 0.9, propSpeed: 8, armRaise: 1.5, armSwing: Math.sin(t * 6) * 0.5, lean: 0.2 }, t); }
  const hs = w.P.heroShip; hs.position.set(lerp(-6, -24, inv(11.3, 12.8, t)), 14.2, 9.5); hs.rotation.set(0, Math.PI, 0);
  animateProps(w.P, w.city, t);
  if (t > 8.5 && t < 12.5) crowdReact(w, t, pipChase(t).pos, true); else crowdReact(w, t, V(999, 0, 0), false);
  if (t > 22.5) for (const c of w.P.crowd) { c.root.position.copy(c.base); c.root.position.y += Math.abs(Math.sin(t * 10 + c.ph)) * 0.2; c.root.rotation.y = c.yaw + Math.sin(t * 4 + c.ph) * 0.6; c.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (1.6 + Math.sin(t * 10 + c.ph) * 0.4); }); }
  // default Puff & Pip placement for shots that don't pose them
  if (t >= 22.0 && t < 26.5) { C.posePip(w.pip, pipLooksUp(t), t); C.posePuff(w.puff, { pos: PUFF_REST().add(V(0, 0.15, 0)), scale: 0.62, expr: { eyes: 'happy', mouth: 'grin', lookY: 1 } }, t); }

  if (t < 7.27) C.posePuff(w.puff, puffInJar(t, { expr: { eyes: 'open', mouth: 'frown', sad: 1, tears: 0.4 } }), t);
  const look = sh.run(t, w) || {};
  if (sh.pip) {
    const anchorAt = (tt) => {
      const s = sh.pip(Math.max(tt, sh.t0));
      const p = s.pos.clone().add(V(0, 0.315 * (s.squash || 1) + (s.bob || 0), 0)).add(fwd(s.yaw).multiplyScalar(-0.07));
      return { p, yaw: s.yaw };
    };
    C.updateScarf(w.pip, anchorAt, t, { lag: 0.03, grav: 0.55 });
  }
  const [sc, size] = look.shadow || [V(0, 0, 0), 10];
  const scam = w.sun.shadow.camera; scam.left = -size; scam.right = size; scam.top = size; scam.bottom = -size; scam.near = 0.5; scam.far = size * 6 + 60; scam.updateProjectionMatrix();
  w.sun.position.copy(sc).add(L.sun.clone().multiplyScalar(size * 3 + 25)); w.sun.target.position.copy(sc); w.sun.target.updateMatrixWorld();
  updateFX(w, t, look, T);
  return {
    brush: look.brush ?? 2.5, uExposure: look.exposure ?? 1.0, uFlash: look.flash ?? 0, uRaysAmt: (look.rays ?? 0.6),
    uMotion: look.motion || [0, 0], title: look.title || 0,
  };
}
export const SHOT_LIST = SHOTS;
