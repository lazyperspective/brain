// style_mini.js: tilt-shift miniature (shot 15, dusk -> night, lights land by land) and snow globe (shot 16)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeFactory, U } from './mat.js';
import { buildScene, cameraFor } from './scene.js';
import { skyDome, horizon, GradeShader, tiltPass } from './common.js';
import { buildRoom, buildSnow, GlassShader, DofShader } from './globe_room.js';
import { rng } from './geo.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const C = (h) => new THREE.Color(h);
const mixC = (stops, t) => { if (t <= stops[0][0]) return C(stops[0][1]); for (let i = 0; i < stops.length - 1; i++) { const [t0, c0] = stops[i], [t1, c1] = stops[i + 1]; if (t <= t1) return C(c0).lerp(C(c1), smooth(t0, t1, t)); } return C(stops[stops.length - 1][1]); };

function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t; }

// land switch-on times (shot 15 beats)
export const LIGHT_ON = { entrance: 37.5, main_street: 37.5, hub: 38.0, midway: 38.5, seaside: 39.0, kiddie: 39.0, thrill: 39.5, frontier: 39.5, jungle: 39.5, outside: 39.5 };
export function lightLevels(t) {
  const L = {};
  for (const [land, t0] of Object.entries(LIGHT_ON)) {
    const u = t - t0;
    let v = 0;
    if (u >= 0) {
      // stutter-pop on (2 quick flickers in 0.12 s) then a bright flash decaying to steady
      const fl = u < 0.12 ? ((Math.floor(u * 50) % 3) !== 1 ? 1 : 0.15) : 1;
      v = fl * (1 + 0.9 * Math.exp(-Math.max(0, u - 0.04) * 7));
    }
    L[land] = v;
  }
  return L;
}

export async function setup({ park, shot, W, H, qs }) {
  const GLOBE = shot.id.startsWith('16');
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H); document.body.appendChild(renderer.domElement);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const flock = canvasTex(256, 256, (g, w, h) => { const r = rng(8); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const l = 160 + r() * 95; g.fillStyle = `rgb(${l},${l},${l})`; g.fillRect(r() * w, r() * h, 2, 2); } }, true);
  flock.colorSpace = THREE.NoColorSpace; flock.repeat.set(2, 2);
  const M = makeFactory('mini', { snow: GLOBE });
  const scene = new THREE.Scene(); scene.environment = envTex;
  const Wd = buildScene(park, M, { personLOD: GLOBE ? 'lo' : 'hi', flockTex: flock, guestSub: GLOBE ? 2 : 1 });
  const globe = new THREE.Group(); scene.add(globe); globe.add(Wd.root);
  Wd.bulbGain = GLOBE ? 5.0 : 3.4; Wd.poolGain = 0.3;
  const sky = skyDome(); scene.add(sky.mesh);
  const hz = horizon(M, { ground: 0x4f7a3c, hills: 0x4a6e44 }); scene.add(hz);
  const fog = new THREE.Fog(0xffc890, 900, 4200); scene.fog = fog;
  // lights
  const hemi = new THREE.HemisphereLight(0xffe0b8, 0x5d6b3a, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb060, 3); sun.castShadow = true; sun.shadow.mapSize.set(3072, 3072); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; scene.add(sun); scene.add(sun.target);
  const moon = new THREE.DirectionalLight(0x7a8cff, 0); scene.add(moon); scene.add(moon.target);
  const pts = Wd.pointLights.slice(0, 0).map(p => { const l = new THREE.PointLight(p.color, 0, p.dist * 2.0, 2); l.position.set(p.x, p.y, p.z); l.userData = p; globe.add(l); return l; });
  // globe / room extras
  let room = null, snow = null;
  const GC = new THREE.Vector3(0, 120, -20), GR = 400;
  if (GLOBE) {
    room = buildRoom(M, park, { flock });
    scene.add(room.table); globe.add(room.base);
    snow = buildSnow(GC, GR, W, H); globe.add(snow.points);
    hz.visible = false; sky.mesh.visible = false; scene.fog = null;
    scene.background = new THREE.Color(0x0a0806);
    scene.add(room.wall);
    U.uClip.value.set(0, -20, 350, 1);
    // winter snow cover must keep colour: handled by per-material snowK
  }
  const envMats = []; scene.traverse(o => { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m && m.isMeshStandardMaterial && !envMats.includes(m)) envMats.push(m); });
  const cams = { persp: new THREE.PerspectiveCamera(40, W / H, 0.3, 6000), ortho: new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000) };

  // ---------------------------------------------------------------- post
  const rtA = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rtA); composer.setPixelRatio(1); composer.setSize(W, H);
  let rp = null, gpass = null;
  const rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: GLOBE ? 4 : 0 });
  const rtDepth = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedIntType) });
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  let globeState = { haze: 0, sub: [] };
  if (!GLOBE) { rp = new RenderPass(scene, cams.persp); composer.addPass(rp); }
  else {
    const glassMat = new THREE.ShaderMaterial(GlassShader); glassMat.uniforms.tScene.value = rtScene.texture; glassMat.uniforms.tDepth.value = rtDepth.depthTexture;
    const quad = new FullScreenQuad(glassMat);
    gpass = new (class extends Pass { render(r, writeBuffer) {
      const cam = this.cam;
      r.setRenderTarget(rtScene); r.clear(); r.render(scene, cam);
      // depth-only pass (the MSAA target has no readable depth); clip/discard is irrelevant here (ring floor covers the cut)
      scene.overrideMaterial = depthOnly; snow.points.visible = false; const bg = scene.background; scene.background = null;
      r.setRenderTarget(rtDepth); r.clear(); r.render(scene, cam);
      scene.overrideMaterial = null; snow.points.visible = true; scene.background = bg;
      const u = glassMat.uniforms; u.invProj.value.copy(cam.projectionMatrixInverse); u.camWorld.value.copy(cam.matrixWorld); u.viewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      u.camPos.value.copy(cam.position); u.near.value = cam.near; u.far.value = cam.far; u.haze.value = globeState.haze; u.glassK.value = globeState.glassK; u.center.value.copy(globeState.center); u.radius.value = GR;
      r.setRenderTarget(this.renderToScreen ? null : writeBuffer); quad.render(r);
    } })();
    composer.addPass(gpass);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.55, 1.0); composer.addPass(bloom);
  const tilt1 = tiltPass(W, H), tilt2 = tiltPass(W, H); tilt2.uniforms.rot.value = 1.3;
  composer.addPass(tilt1);
  let dof = null; if (GLOBE) { dof = new ShaderPass(DofShader); dof.uniforms.tDepth.value = rtDepth.depthTexture; dof.uniforms.res.value.set(W, H); composer.addPass(dof); }
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);

  // ---------------------------------------------------------------- per-frame state
  const L0 = park.data.lighting;
  function dusk(t) {
    // sun: azimuth 260 (west), elevation 12 -> -8 deg between 36.0 and 37.5 (eased), golden -> red
    const u = smooth(35.6, 37.6, t);
    const el = lerp(12, -8, u) * Math.PI / 180, az = lerp(262, 258, u) * Math.PI / 180;
    const sd = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    return {
      sd, sunCol: mixC([[35.8, '#ffa040'], [36.6, '#ff8436'], [37.2, '#ff5030']], t), sunI: 4.2 * (1 - smooth(36.7, 37.45, t)),
      top: mixC([[35.8, '#7ea4d6'], [36.8, '#7a78c8'], [37.6, '#3a347e'], [38.6, '#151a40'], [39.6, '#0b0f2a']], t),
      hor: mixC([[35.8, '#ffc98a'], [36.6, '#ff9a6a'], [37.3, '#b46aa8'], [38.0, '#4a3c8c'], [39.0, '#24204e'], [40.0, '#1a1838']], t),
      hemiTop: mixC([[35.8, '#ffe2bc'], [36.8, '#e8b0c0'], [37.6, '#7a68c0'], [38.6, '#3a4a90'], [40, '#2a3670']], t),
      hemiBot: mixC([[35.8, '#6a6a3a'], [37, '#3a3050'], [38.5, '#1a1a30']], t),
      hemiI: lerp(0.6, 0.2, smooth(36.5, 37.7, t)),
      stars: smooth(38.4, 39.6, t),
      moonI: smooth(37.2, 38.4, t) * 0.7,
      exposure: lerp(1.0, 1.35, smooth(37.6, 38.8, t)),
      night: smooth(37.3, 38.8, t), warm: 1 - smooth(36.8, 37.8, t),
    };
  }
  const shakeAt = (t) => { // globe jolt at 41.0: damped lateral shake + hop + tilt
    const u = t - 41.0; if (u <= 0 || u > 1.6) return { x: 0, y: 0, z: 0, rz: 0, rx: 0 };
    const env = Math.min(1, u / 0.06) * Math.exp(-u * 3.2);
    const ph = u * Math.PI * 2 * 3.0;
    return { x: Math.sin(ph) * 46 * env, y: Math.abs(Math.sin(ph * 0.5)) * 26 * env, z: Math.sin(ph * 0.7 + 1) * 12 * env, rz: Math.sin(ph + 0.6) * 0.05 * env, rx: Math.sin(ph * 0.8) * 0.025 * env };
  };
  function renderAt(t, i) {
    const { cam, c } = cameraFor(park, shot, t, W, H, cams);
    if (rp) rp.camera = cam; if (gpass) gpass.cam = cam;
    // ---- globe transform
    if (GLOBE) {
      const s = shakeAt(t); globe.position.set(s.x, s.y, s.z); globe.rotation.set(s.rx, 0, s.rz); globe.updateMatrixWorld(true);
      const cc = new THREE.Vector3(0, -20, 0).set(0, 0, -20).applyMatrix4(globe.matrixWorld); U.uClip.value.set(cc.x, cc.z, 350, 1);
      globeState.center = GC.clone().applyMatrix4(globe.matrixWorld);
      globeState.haze = smooth(41.0, 41.3, t) * (1 - smooth(41.75, 42.15, t)) * 0.8;
      globeState.glassK = smooth(39.95, 40.35, t);
      const winter = smooth(41.35, 41.6, t); U.uSnow.value = smooth(41.4, 42.3, t) * 0.44; Wd.winter = winter; // polish: lighter snow cover so colours survive
      snow.update(t, globe);
    }
    if (!GLOBE) U.uClip.value.set(0, -20, 350, 2 + 0.92 * smooth(39.3, 40.0, t));
    Wd.update(t, shot);
    // ---- light state
    let st;
    if (!GLOBE || t < 40.0) st = dusk(Math.min(t, 40.2));
    else st = dusk(40.0);
    sky.U.top.value.copy(st.top); sky.U.hor.value.copy(st.hor); sky.U.below.value.copy(st.hor).multiplyScalar(0.5); sky.U.sunDir.value.copy(st.sd); sky.U.sunCol.value.copy(st.sunCol); sky.U.sunK.value = 1 - smooth(37.0, 37.6, t); sky.U.stars.value = st.stars;
    fog.color.copy(st.hor).lerp(new THREE.Color(0x101428), smooth(37.5, 39, t) * 0.5);
    hemi.color.copy(st.hemiTop); hemi.groundColor.copy(st.hemiBot); hemi.intensity = st.hemiI;
    sun.color.copy(st.sunCol); sun.intensity = st.sunI; sun.castShadow = st.sunI > 0.05;
    const mv = new THREE.Vector3(...L0.night.moon).normalize(); moon.intensity = st.moonI; moon.color.set(0x8a98ff);
    renderer.toneMappingExposure = st.exposure;
    let levels = lightLevels(t);
    if (GLOBE) { for (const k in levels) levels[k] = 1 + 0.9 * smooth(41.8, 42.4, t); levels = Object.assign({}, levels); } // polish: warmer, brighter windows/bulbs in winter
    Wd.setLights(levels, 1, t);
    pts.forEach(l => { const v = levels[l.userData.land] || 0; l.intensity = Math.min(1.4, v) * 70 * (GLOBE ? 0.6 : 1); });
    const envK = GLOBE ? lerp(0.05, 0.14, smooth(40.0, 40.8, t)) : lerp(0.45, 0.05, smooth(36.6, 37.7, t)); U.uNight.value = GLOBE ? 1 : smooth(37.0, 38.0, t); for (const m of envMats) m.envMapIntensity = envK;
    // shadow frustum: around the look target, sized by distance
    const tgt = new THREE.Vector3(...c.target); const dist = new THREE.Vector3(...c.position).distanceTo(tgt);
    const ext = Math.min(420, Math.max(70, dist * 0.9));
    const focus = tgt.clone(); focus.y = 0;
    for (const [lt, dir] of [[sun, st.sd], [moon, mv]]) { const sc = lt.shadow.camera; lt.position.copy(focus).addScaledVector(dir, 900); lt.target.position.copy(focus); lt.target.updateMatrixWorld(); if (lt.castShadow) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = 2500; sc.updateProjectionMatrix(); } }
    // env reflections fade at night
    // ---- room (globe)
    if (GLOBE) {
      const rk = smooth(40.0, 40.8, t);
      room.key.intensity = lerp(0.0, 2.0, rk); hemi.intensity = lerp(st.hemiI, 0.25, rk); hemi.color.lerp(new THREE.Color(0x6a5040), rk); hemi.groundColor.set(0x1a120c);
      moon.intensity = lerp(st.moonI, 0.15, rk); renderer.toneMappingExposure = lerp(st.exposure, 1.05, rk) + 0.12 * smooth(41.8, 42.4, t) * (1 - smooth(42.9, 43.5, t)); // polish: winter park a touch brighter
      room.update(t, cam);
      // focus: globe then ticket
      const ticket = new THREE.Vector3(0, -157, 648);
      const parkC = new THREE.Vector3(0, 15, -20).applyMatrix4(globe.matrixWorld); const fd = lerp(cam.position.distanceTo(parkC), cam.position.distanceTo(ticket), smooth(42.9, 43.9, t));
      dof.uniforms.focus.value = fd; dof.uniforms.near.value = cam.near; dof.uniforms.far.value = cam.far;
      dof.uniforms.amount.value = lerp(0.0, lerp(0.35, 1.0, smooth(42.85, 43.4, t)), smooth(40.1, 40.9, t)) * lerp(1, 0.55, smooth(43.2, 44.0, t)); // polish: keep the park sharp until the crane
      dof.uniforms.maxR.value = lerp(9, 16, smooth(42.9, 43.6, t));
    }
    // ---- tilt-shift
    const tsK = GLOBE ? 1 - smooth(40.0, 40.7, t) : 1;
    const band = GLOBE ? 0.14 : lerp(0.085, 0.12, smooth(37.0, 40.0, t));
    for (const p of [tilt1, tilt2]) { p.uniforms.focusY.value = 0.5; p.uniforms.band.value = band; p.uniforms.bokeh.value = 5.0; }
    tilt1.uniforms.maxR.value = 22 * tsK * W / 1920;
    tilt1.enabled = tilt2.enabled = tsK > 0.01;
    bloom.strength = lerp(0.18, 0.75, smooth(37.3, 38.5, t)); bloom.threshold = lerp(1.6, 0.95, smooth(37.3, 38.5, t)); bloom.radius = 0.55;
    // ---- grade: miniature-photo look
    const gu = grade.uniforms; gu.uSat.value = 1.28 + (GLOBE ? 0.14 * smooth(41.8, 42.4, t) * (1 - smooth(42.9, 43.5, t)) : 0); gu.uContrast.value = 0.32; gu.uWarm.value = st.warm * 1.2; gu.uNight.value = st.night * (GLOBE ? 0.4 : 0.85); gu.uVig.value = 0.45; gu.uGrain.value = 0.03; gu.uSeed.value = i * 1.37; gu.uCA.value = GLOBE ? 0.0008 : 0.0025;
    composer.render();
  }
  return { renderAt, canvas: renderer.domElement, info: { buildMs: Wd.buildMs } };
}
