import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPark, rng } from './park.js';

const W = 1080, H = 1080, FPS = 30;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const C = (h) => new THREE.Color(h);

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function setup(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const R = 27.5, DISC = 24.4, CY = Math.sqrt(R * R - DISC * DISC) + 0.4; // sphere centre height above park floor
  const globe = new THREE.Group(); scene.add(globe);
  const park = buildPark({ mode: 'globe', snow: true, discRadius: DISC, guests: 430 });
  globe.add(park.root);

  // ---- wooden base
  const woodTex = canvasTex(1024, 256, (g, w, h) => {
    const r = rng(21); g.fillStyle = '#6b3a1f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { const y = r() * h; g.strokeStyle = `rgba(${r() < 0.5 ? '40,18,8' : '150,90,50'},${0.15 + r() * 0.25})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 4 + (r() - 0.5) * 2); g.stroke(); }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(3, 1);
  const woodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18, color: '#ffffff' });
  const prof = [[0, -10.5], [29.5, -10.5], [30.2, -10.0], [30.2, -9.2], [29.0, -8.6], [28.6, -7.5], [27.4, -5.0], [26.6, -2.6], [26.8, -1.9], [26.2, -1.4], [25.4, -0.4], [24.6, -0.02], [24.3, -0.3], [0, -0.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const base = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), woodMat); base.castShadow = true; base.receiveShadow = true; globe.add(base);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(26.75, 0.35, 10, 128), new THREE.MeshStandardMaterial({ color: '#e0b25a', metalness: 0.9, roughness: 0.25 }));
  trim.rotation.x = Math.PI / 2; trim.position.y = -2.25; globe.add(trim);
  const trim2 = trim.clone(); trim2.scale.setScalar(30.25 / 26.75); trim2.position.y = -9.6; globe.add(trim2);

  // ---- room: table + back wall bokeh
  const tableTex = canvasTex(1024, 1024, (g, w, h) => {
    const r = rng(3); g.fillStyle = '#4a2a17'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { const x = r() * w; g.strokeStyle = `rgba(${r() < 0.5 ? '25,12,5' : '120,70,40'},${0.1 + r() * 0.2})`; g.lineWidth = 1 + r() * 4; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * 0.01 + i) * 6, y); g.stroke(); }
  });
  tableTex.wrapS = tableTex.wrapT = THREE.RepeatWrapping; tableTex.repeat.set(3, 3);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(600, 160), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.45 }));
  table.rotation.x = -Math.PI / 2; table.position.set(0, -10.5, 40); table.receiveShadow = true; scene.add(table);
  const wallTex = canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a2233'); gr.addColorStop(0.6, '#2a2530'); gr.addColorStop(1, '#3a2a22'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(11);
    // window glow at left
    const wg = g.createRadialGradient(w * 0.18, h * 0.35, 10, w * 0.18, h * 0.35, w * 0.3); wg.addColorStop(0, 'rgba(150,180,230,0.55)'); wg.addColorStop(1, 'rgba(150,180,230,0)'); g.fillStyle = wg; g.fillRect(0, 0, w, h);
    // fairy-light bokeh
    for (let i = 0; i < 140; i++) {
      const x = r() * w, y = h * (0.15 + 0.5 * r()) + Math.sin(x * 0.006) * 60, rad = 18 + r() * 38;
      const c = r() < 0.75 ? [255, 190 + r() * 40, 110 + r() * 50] : [255, 120, 100];
      const bg = g.createRadialGradient(x, y, rad * 0.2, x, y, rad); bg.addColorStop(0, `rgba(${c[0]},${c[1] | 0},${c[2] | 0},${0.25 + r() * 0.25})`); bg.addColorStop(0.85, `rgba(${c[0]},${c[1] | 0},${c[2] | 0},${0.18 + r() * 0.15})`); bg.addColorStop(1, `rgba(${c[0]},${c[1] | 0},${c[2] | 0},0)`);
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(560, 280), new THREE.MeshBasicMaterial({ map: wallTex }));
  wall.position.set(0, 40, -45); wall.scale.setScalar(0.62); scene.add(wall);

  // ---- lights
  const hemi = new THREE.HemisphereLight('#fff0dc', '#6a5040', 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffd9a8', 2.9); key.position.set(-50, 75, 45); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 10, far: 250 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9fc0ff', 0.6); rim.position.set(40, 30, -60); scene.add(rim);
  const warmIn = [[0, 6, 2], [6, 4, 7.5], [13, 8, -13], [-9, 4, 9]].map(([x, y, z]) => { const l = new THREE.PointLight('#ffb060', 0, 14, 1.6); l.position.set(x, y, z); globe.add(l); return l; });
  const envMats = []; scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial && !envMats.includes(o.material)) envMats.push(o.material); });

  // ---- snow particles
  const NF = 5500; const fr = rng(42);
  const flakes = []; const fpos = new Float32Array(NF * 3), fsize = new Float32Array(NF), falpha = new Float32Array(NF);
  for (let i = 0; i < NF; i++) {
    const front = fr() < 0.05, light = fr() < 0.22;
    flakes.push({ th: fr() * 6.283, r0: Math.sqrt(fr()) * (DISC - 1), yTop: 2 + Math.pow(fr(), 1.3) * (CY + R * 0.8 - 2), vf: light ? 0.9 + fr() * 1.6 : 7 + fr() * 12, light, ts: 0.4 + fr() * 0.2, om: 7 + fr() * 9, ph: fr() * 6.28, wob: 0.3 + fr() * 0.8, front });
    fsize[i] = front ? 0.45 + fr() * 0.35 : 0.2 + fr() * 0.25; falpha[i] = 0.55 + fr() * 0.45;
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fg.setAttribute('aSize', new THREE.BufferAttribute(fsize, 1)); fg.setAttribute('aAlpha', new THREE.BufferAttribute(falpha, 1));
  const fU = { uScale: { value: H / (2 * Math.tan(THREE.MathUtils.degToRad(26) / 2)) }, uStreak: { value: 0 }, uVis: { value: 0 } };
  const snowPts = new THREE.Points(fg, new THREE.ShaderMaterial({
    uniforms: fU, transparent: true, depthWrite: false,
    vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale, uVis; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.5, aSize * uScale / -mv.z); vA = aAlpha * uVis; }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.12, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.35, 1.38, 1.45), a); }`,
  }));
  snowPts.frustumCulled = false; snowPts.renderOrder = 5; globe.add(snowPts);
  function updateSnow(t) {
    for (let i = 0; i < NF; i++) {
      const f = flakes[i]; const u = Math.max(0, t - f.ts);
      const swirl = f.om * 0.45 * (1 - Math.exp(-u / 0.45));
      const th = f.th + swirl + u * 0.12;
      const rise = 1 - Math.exp(-u / 0.2);
      const fall = Math.max(0, u - 0.5); let y = 0.2 + (f.yTop - 0.2) * rise - f.vf * fall * fall / (fall + 0.35);
      // light flakes wrap back to the top (continuous gentle snowfall); heavy ones land and vanish into the snow cover
      const topY = CY + R * 0.88; if (y < 0.15) { if (f.light) y = topY - ((0.15 - y) % (topY - 0.15)); else y = -2; }
      let r = f.r0 * (0.65 + 0.35 * rise) + Math.sin(t * f.wob * 2 + f.ph) * 0.6 * rise;
      if (f.front) r = lerp(r, DISC + 1, 0.6);
      const rmax = Math.sqrt(Math.max(0, R * R - (y - CY) * (y - CY))) * 0.95; r = Math.min(r, rmax);
      fpos[i * 3] = Math.cos(th) * r + Math.sin(t * 1.3 + f.ph) * 0.25 * rise; fpos[i * 3 + 1] = u > 0 ? y : 0.1; fpos[i * 3 + 2] = Math.sin(th) * r;
    }
    fg.attributes.position.needsUpdate = true;
  }

  const camera = new THREE.PerspectiveCamera(26, W / H, 5, 800);

  // ---- render targets + glass pass
  const rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedIntType) });
  const glassU = {
    tScene: { value: rtScene.texture }, tDepth: { value: rtScene.depthTexture }, invProj: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, viewProj: { value: new THREE.Matrix4() },
    camPos: { value: new THREE.Vector3() }, center: { value: new THREE.Vector3() }, radius: { value: R }, near: { value: camera.near }, far: { value: camera.far }, haze: { value: 0 }, glowTint: { value: 0 },
  };
  const glassMat = new THREE.ShaderMaterial({
    uniforms: glassU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `precision highp float;
      uniform sampler2D tScene, tDepth; uniform mat4 invProj, camWorld, viewProj; uniform vec3 camPos, center; uniform float radius, near, far, haze, glowTint; varying vec2 vUv;
      vec3 envCol(vec3 r){
        vec3 c = mix(vec3(0.10, 0.075, 0.06), vec3(0.16, 0.17, 0.22), smoothstep(-0.2, 0.6, r.y));
        // big window softbox, upper-left behind camera
        vec3 wd = normalize(vec3(-0.72, 0.72, 0.45));
        vec3 ax = normalize(cross(wd, vec3(0,1,0))), ay = cross(ax, wd);
        vec2 p = vec2(dot(r, ax), dot(r, ay)) / max(dot(r, wd), 0.001);
        float win = (1.0 - smoothstep(0.17, 0.29, abs(p.x))) * (1.0 - smoothstep(0.24, 0.36, abs(p.y))) * step(0.0, dot(r, wd));
        float mull = 1.0 - (1.0 - smoothstep(0.0, 0.025, abs(p.x))) * 0.8 - (1.0 - smoothstep(0.0, 0.025, abs(p.y))) * 0.8;
        c += vec3(1.3, 1.4, 1.55) * win * clamp(mull, 0.0, 1.0);
        // warm lamps to the right
        vec3 l1 = normalize(vec3(0.8, 0.25, 0.4)); c += vec3(3.0, 1.8, 0.8) * pow(max(dot(r, l1), 0.0), 600.0);
        vec3 l2 = normalize(vec3(0.5, 0.1, 0.9)); c += vec3(1.5, 0.9, 0.4) * pow(max(dot(r, l2), 0.0), 300.0);
        return c;
      }
      float viewDist(vec2 uv, vec3 d, vec3 fwd){ float z = texture2D(tDepth, uv).x; float vz = near * far / ((far - near) * z - far); return -vz / max(dot(d, fwd), 1e-3); }
      void main(){
        vec4 ndcF = vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec4 vp = invProj * ndcF; vp /= vp.w;
        vec3 d = normalize((camWorld * vec4(vp.xyz, 0.0)).xyz);
        vec3 fwd = normalize((camWorld * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
        vec3 oc = camPos - center; float b = dot(oc, d); float c = dot(oc, oc) - radius * radius; float h = b * b - c;
        vec3 sceneC = texture2D(tScene, vUv).rgb;
        if (h < 0.0) { gl_FragColor = vec4(sceneC, 1.0); return; }
        float sh = sqrt(h); float t0 = -b - sh, t1 = -b + sh;
        float ds = viewDist(vUv, d, fwd);
        if (ds < t0 - 0.05) { gl_FragColor = vec4(sceneC, 1.0); return; }
        vec3 P = camPos + d * t0; vec3 n = normalize(P - center);
        float cosi = clamp(dot(-d, n), 0.0, 1.0);
        float inner = min(ds, t1) - t0;
        vec3 col = vec3(0.0);
        float iors[3]; iors[0] = 1.0/1.117; iors[1] = 1.0/1.12; iors[2] = 1.0/1.123;
        for (int k = 0; k < 3; k++) {
          vec3 r = refract(d, n, iors[k]);
          vec3 Q = P + r * inner;
          vec4 cl = viewProj * vec4(Q, 1.0); vec2 uv2 = cl.xy / cl.w * 0.5 + 0.5;
          uv2 = clamp(uv2, 0.001, 0.999);
          vec3 s = texture2D(tScene, uv2).rgb;
          if (k == 0) col.r = s.r; else if (k == 1) col.g = s.g; else col.b = s.b;
        }
        float F = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
        vec3 rr = reflect(d, n);
        vec3 refl = envCol(rr);
        // glass tint & edge thickness darkening
        float edge = pow(1.0 - cosi, 3.0);
        col *= mix(vec3(0.97, 0.99, 1.0), vec3(0.6, 0.7, 0.72), edge * 0.8);
        // snow haze inside
        float lum = dot(col, vec3(0.3, 0.59, 0.11));
        col = mix(col, vec3(0.82, 0.86, 0.92) * (0.6 + 0.6 * lum), haze * (0.55 + 0.45 * cosi));
        col = col * (1.0 - F) + refl * (F * 1.15 + 0.035);
        // soft highlight arc (upper-left) and faint inner arc (lower-right): screen-space around projected centre
        vec4 cc = viewProj * vec4(center, 1.0); vec2 cs = cc.xy / cc.w * 0.5 + 0.5;
        vec2 dv = vUv - cs; float ang = atan(dv.y, dv.x);
        float rho = sqrt(max(0.0, 1.0 - cosi * cosi));
        float arcA = exp(-pow((ang - 2.2) / 0.42, 2.0));
        float arc = smoothstep(0.78, 0.86, rho) * (1.0 - smoothstep(0.9, 0.95, rho)) * arcA;
        float arcB = smoothstep(0.86, 0.9, rho) * (1.0 - smoothstep(0.93, 0.965, rho)) * exp(-pow((ang + 0.9) / 0.5, 2.0));
        col += vec3(1.0, 0.98, 0.95) * arc * 0.9 + vec3(1.0, 0.85, 0.65) * arcB * 0.35;
        // crisp rim
        col += vec3(0.7, 0.75, 0.8) * smoothstep(0.985, 0.999, rho) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const glassQuad = new FullScreenQuad(glassMat);
  const accMat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: 1, toneMapped: false });
  const accQuad = new FullScreenQuad(accMat);
  const rtGlass = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });

  let currentT = 0, subN = 1, shutter = 0;
  class GlobePass extends Pass {
    render(renderer2, writeBuffer) {
      for (let k = 0; k < subN; k++) {
        const ts = currentT + (subN > 1 ? (k / (subN - 1) - 0.5) * shutter : 0);
        stateAt(ts);
        renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
        glassU.invProj.value.copy(camera.projectionMatrixInverse); glassU.camWorld.value.copy(camera.matrixWorld);
        glassU.viewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); glassU.camPos.value.copy(camera.position);
        if (subN === 1) { renderer.setRenderTarget(writeBuffer); glassQuad.render(renderer); }
        else {
          renderer.setRenderTarget(rtGlass); glassQuad.render(renderer);
          accMat.map = rtGlass.texture; accMat.color.setScalar(1 / subN);
          renderer.setRenderTarget(writeBuffer); if (k === 0) { renderer.setClearColor(0x000000, 1); renderer.clear(); }
          accQuad.render(renderer);
        }
      }
    }
  }
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new GlobePass());
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.5, 1.3); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, seed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float seed; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed)*43758.5453); }
      void main(){ vec2 c = vUv - 0.5; float r2 = dot(c, c); vec3 col = texture2D(tDiffuse, vUv).rgb;
        float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, 1.12);
        col *= 1.0 - smoothstep(0.1, 0.6, r2) * 0.5; col += (hash(gl_FragCoord.xy) - 0.5) * 0.03;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0); }`,
  });
  composer.addPass(grade);

  // ---- timeline
  const SHAKE0 = 0.32, SHAKE1 = 1.0;
  function shakeAt(t) {
    const u = (t - SHAKE0) / (SHAKE1 - SHAKE0); if (u <= 0 || u >= 1.25) return { x: 0, y: 0, rz: 0, rx: 0 };
    const env = Math.sin(Math.min(1, u) * Math.PI) * Math.exp(-Math.max(0, u - 1) * 6);
    const ph = (t - SHAKE0) * Math.PI * 2 * 3.2;
    return { x: Math.sin(ph) * 4.2 * env, y: Math.abs(Math.sin(ph * 0.5)) * 1.6 * env, rz: Math.sin(ph + 0.6) * 0.07 * env, rx: Math.sin(ph * 0.7) * 0.03 * env };
  }
  function stateAt(t) {
    const s = shakeAt(t);
    globe.position.set(s.x, s.y, 0); globe.rotation.set(s.rx, 0, s.rz);
    globe.updateMatrixWorld(true);
    glassU.center.value.set(0, CY, 0).applyMatrix4(globe.matrixWorld);
    const winter = smooth(0.95, 1.25, t), snow = smooth(0.9, 1.75, t);
    const lv = smooth(1.25, 1.9, t);
    const lights = {}; ['strings', 'gate', 'carousel', 'wheel', 'stalls', 'drop', 'ship', 'swing', 'cups', 'flume', 'coaster', 'xmas'].forEach((k, i) => { lights[k] = smooth(1.2 + i * 0.04, 1.5 + i * 0.04, t); });
    park.update(t, { crestTime: 2.05, lights, stringProg: lv > 0 ? 999 : -1, winter, snow, glowGain: 0.7 });
    fU.uVis.value = smooth(0.38, 0.5, t);
    updateSnow(t);
    glassU.haze.value = smooth(0.45, 0.75, t) * (1 - smooth(1.05, 1.55, t)) * 0.6;
    // mood: summer daylight -> cosy winter evening
    key.color.copy(C('#ffe0b0').lerp(C('#c8d4ff'), winter)); key.intensity = lerp(3.0, 1.35, winter);
    hemi.color.copy(C('#fff0dc').lerp(C('#a8b8e8'), winter)); hemi.intensity = lerp(0.6, 0.45, winter);
    rim.intensity = lerp(0.5, 0.9, winter);
    envMats.forEach((m) => { if (m !== woodMat) m.envMapIntensity = lerp(0.6, 0.35, winter); });
    warmIn.forEach((l) => { l.intensity = lv * 25; });
    bloom.strength = lerp(0.2, 0.55, lv); bloom.threshold = lerp(2.2, 1.15, lv);
    // camera: gentle push-in and drift
    const az = (-4 + t * 1.6) * Math.PI / 180, el = (27 - t * 0.5) * Math.PI / 180, dist = 136 - t * 3.0;
    const tgt = new THREE.Vector3(0, 8.0, 0);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(tgt); camera.updateMatrixWorld();
  }

  function renderAt(t, frameIdx) {
    currentT = t;
    const inShake = t > SHAKE0 && t < SHAKE1 + 0.1;
    subN = inShake ? 4 : 1; shutter = 0.5 / FPS;
    grade.uniforms.seed.value = frameIdx * 1.37;
    composer.render();
  }
  return { renderAt, frames: 90, fps: FPS };
}
