// ------------------------------------------------------------------
// KILN · LIGHT render engine
//  - custom studio environment (soft-box light cards + orange bounce floor) rendered into PMREM
//  - direct lights (key with soft VSM shadow, fills, rims, a movable sweep, the Ask-strip glow)
//  - drawable backdrop canvas, contact shadow, shadow-catcher floor
//  - post: MSAA, Bokeh DOF, bloom, output, finish (grain, vignette, lens CA, warm halation lift)
// ------------------------------------------------------------------
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FINISH_SHADER = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.022 }, vig: { value: 0.22 }, ca: { value: 0.0009 }, lift: { value: 0.0 }, res: { value: new THREE.Vector2(1920, 1080) }, fade: { value: 0 }, fadeCol: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vig, ca, lift, fade; uniform vec3 fadeCol; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c; c.r = texture2D(tDiffuse, vUv - d * ca * r2 * 4.0).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv + d * ca * r2 * 4.0).b;
      // gentle film curve + warm lift in the shadows
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.12); c += lift * vec3(0.06, 0.03, 0.015) * (1.0 - c);
      float dv = distance(vUv * vec2(res.x / res.y, 1.0), vec2(0.5 * res.x / res.y, 0.5)); c *= 1.0 - vig * smoothstep(0.42, 1.05, dv);
      c = mix(c, fadeCol, fade);
      // luminance-weighted grain (finer in highlights, like film)
      float l = dot(c, vec3(0.299, 0.587, 0.114)); float n = h(floor(vUv * res) + fract(time * 7.13) * 91.7) + h(floor(vUv * res * 0.5) + fract(time * 3.1) * 17.3) - 1.0;
      c += n * grain * (0.6 + 0.6 * (1.0 - l));
      gl_FragColor = vec4(c, 1.0); }`,
};

// soft-box texture: bright core, feathered edges, subtle diffusion falloff
function softboxTex(round = false) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  if (round) { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#eee'); g.addColorStop(0.85, '#555'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  else {
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256); x.filter = 'blur(10px)'; x.fillStyle = '#fff'; x.fillRect(22, 22, 212, 212); x.filter = 'none';
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 180); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); return t;
}

export function buildStudioEnv(renderer, opt = {}) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(30, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#5f5a55').multiplyScalar(0.85) }, mid: { value: new THREE.Color('#5e5049').multiplyScalar(0.55) }, bot: { value: new THREE.Color(opt.floor || '#e79a72').multiplyScalar(0.42) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.8, y)) : mix(mid, bot, smoothstep(0.0, -0.35, y)); gl_FragColor = vec4(c, 1.0); }',
  }));
  s.add(room);
  const sq = softboxTex(false), rd = softboxTex(true);
  const card = (w, h, pos, col, I, tex = sq) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), map: tex, side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m); return m;
  };
  // the light plot: a big overhead scrim, a tall key strip camera-left, a narrower strip camera-right,
  // a warm kicker behind, a low front card (gives glass its gradient), and two little "hot spots" for sparkle
  card(9, 6, [0, 10, 1.5], '#fffaf5', 3.0);
  card(1.5, 9, [-7.5, 1.2, 4.0], '#fff3e8', 6.5);
  card(1.1, 8, [7.5, 0.6, 2.5], '#ffe9da', 4.2);
  card(7, 2.2, [0, 2.4, -8.5], '#ffc49a', 3.0);
  card(6, 1.2, [0, -1.6, 8], '#ffe2cc', 1.1);
  card(4.5, 2.6, [3.5, 1.5, 7.5], '#fff8f2', 2.0);   // big soft front-top scrim: the glaze's long gradient highlight
  card(1.2, 1.2, [4.5, 5.5, 5.5], '#ffffff', 5, rd);
  card(0.8, 0.8, [-5, 4.5, -5], '#ffd9bb', 4, rd);
  // warm field floor bounce
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(opt.floor || '#e79a72').multiplyScalar(0.5), toneMapped: false }));
  fl.rotation.x = -Math.PI / 2; fl.position.y = -4; s.add(fl);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.012); pm.dispose();
  return rt.texture;
}

export function createEngine(canvas, W, H) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(22, W / H, 0.01, 100);
  scene.environment = buildStudioEnv(renderer); scene.environmentIntensity = 1;
  const L = {
    key: new THREE.DirectionalLight('#fff4ea', 1.4), fill: new THREE.DirectionalLight('#e6ecff', 0.25),
    rimA: new THREE.DirectionalLight('#ffb48a', 1.0), rimB: new THREE.DirectionalLight('#ffe0c8', 0.7),
    sweep: new THREE.PointLight('#fff0e0', 0, 3, 1.5), glow: new THREE.PointLight('#ff8a4c', 0, 0.9, 2), hemi: new THREE.HemisphereLight('#fff1e6', '#8a4a2c', 0.25),
    spot: new THREE.SpotLight('#fff1e2', 0, 14, 0.32, 0.9, 1.2),
  };
  L.key.position.set(-3, 4, 5); L.fill.position.set(4, 1, 3); L.rimA.position.set(4, 2, -4); L.rimB.position.set(-4, -1, -3);
  L.key.castShadow = true; L.key.shadow.mapSize.set(2048, 2048); L.key.shadow.radius = 14; L.key.shadow.blurSamples = 16; L.key.shadow.bias = -0.0004; L.key.shadow.normalBias = 0.01;
  Object.assign(L.key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 14 });
  L.spot.position.set(-2, 5, 2); scene.add(L.spot.target);
  Object.values(L).forEach(l => scene.add(l));
  // backdrop canvas (screen-space field)
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
  // contact shadow blob
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; { const x = sc.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(90,38,16,0.62)'); g.addColorStop(0.35, 'rgba(90,38,16,0.3)'); g.addColorStop(0.7, 'rgba(90,38,16,0.08)'); g.addColorStop(1, 'rgba(90,38,16,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.visible = false; shadow.renderOrder = -1; scene.add(shadow);
  // shadow catcher for the real (soft VSM) shadow
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ color: '#6a2a10', opacity: 0.3, depthWrite: false }));
  catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true; catcher.visible = false; scene.add(catcher);
  // post
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  // NaN/Inf guard: a single bad pixel (anisotropic GGX at grazing angles) would otherwise smear into a box through the bloom blur chain
  composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(64.0)), c.a); }' }));
  const bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.002, maxblur: 0.01 }); bokeh.enabled = false; composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.6, 0.86); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const fin = new ShaderPass(FINISH_SHADER); fin.uniforms.res.value.set(W, H); composer.addPass(fin);
  const E = {
    renderer, scene, camera, L, bg, bgTex, shadow, catcher, bloom, bokeh, fin, W, H, composer, rt,
    look(px, py, pz, tx, ty, tz, fov, roll = 0, up = null) {
      camera.position.set(px, py, pz); if (up) camera.up.set(...up); else camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(tx, ty, tz);
      if (fov && camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    // focus distance from camera to a world point
    focusOn(p, aperture, maxblur = 0.012) { E.bokeh.enabled = true; E.bokeh.uniforms.focus.value = camera.position.distanceTo(p); E.bokeh.uniforms.aperture.value = aperture; E.bokeh.uniforms.maxblur.value = maxblur; },
    render(t) { fin.uniforms.time.value = t; bgTex.needsUpdate = true; composer.render(); },
  };
  return E;
}

// smooth path through keys (monotone cubic): keys [[t, v1, v2, ...]]
export function track(K, t) {
  const n = K.length; if (t <= K[0][0]) return K[0].slice(1); if (t >= K[n - 1][0]) return K[n - 1].slice(1);
  let i = 0; while (i < n - 2 && t > K[i + 1][0]) i++; const out = [];
  for (let c = 1; c < K[0].length; c++) {
    const m = j => { if (j === 0 || j === n - 1) return 0; const a = K[j - 1], b = K[j], e = K[j + 1], d0 = (b[c] - a[c]) / (b[0] - a[0]), d1 = (e[c] - b[c]) / (e[0] - b[0]); return d0 * d1 <= 0 ? 0 : 2 / (1 / d0 + 1 / d1); };
    const a = K[i], b = K[i + 1], h = b[0] - a[0], u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
    out.push((2 * u3 - 3 * u2 + 1) * a[c] + (u3 - 2 * u2 + u) * h * m(i) + (-2 * u3 + 3 * u2) * b[c] + (u3 - u2) * h * m(i + 1));
  }
  return out;
}
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const smr = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * t * (t * (6 * t - 15) + 10); };   // smootherstep
export const easeOut = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return 1 - Math.pow(1 - t, 3); };
export const easeIO = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
// damped spring step response (0 → 1, with natural overshoot). w = natural freq (rad/s), z = damping ratio
export function spring(t, w = 14, z = 0.72) {
  if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
export const lerp = (a, b, u) => a + (b - a) * u;
