// ------------------------------------------------------------------
// PULSE render engine: custom soft-box studio environment (PMREM), rim/key/sweep lights, a drawable backdrop canvas,
// contact shadow, post: MSAA, optional Bokeh DOF, bloom, tone mapping, a finish pass (grain, vignette, chromatic
// aberration, flash, fade).
// ------------------------------------------------------------------
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FINISH_SHADER = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.028 }, vig: { value: 0.25 }, res: { value: new THREE.Vector2(1920, 1080) },
    ca: { value: 0 }, flash: { value: 0 }, flashCol: { value: new THREE.Color(1, 0.96, 0.92) }, fade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vig, ca, flash, fade; uniform vec3 flashCol; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; vec4 c = texture2D(tDiffuse, vUv);
      if (ca > 0.0) { vec2 o = d * ca * 0.04; c.r = texture2D(tDiffuse, vUv + o).r; c.b = texture2D(tDiffuse, vUv - o).b; }
      float n = h(floor(vUv * res) + fract(time * 7.13) * 91.7) - 0.5; c.rgb += n * grain;
      float r = distance(vUv * vec2(res.x / res.y, 1.0), vec2(0.5 * res.x / res.y, 0.5)); c.rgb *= 1.0 - vig * smoothstep(0.42, 1.05, r);
      c.rgb = mix(c.rgb, flashCol, clamp(flash, 0.0, 1.0)); c.rgb *= 1.0 - fade; gl_FragColor = c; }`,
};

// a studio of soft boxes and strip lights, baked into the PMREM so glass, ceramic and metal get real highlights
function studioEnv() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: '#060506', side: THREE.BackSide })));
  const box = (w, h, x, y, z, col, k, look = [0, 0, 0]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(...look); s.add(m); return m; };
  box(6, 2.2, 0, 7, 1.5, '#fff4ea', 5.5);            // overhead soft box
  box(1.6, 8, -6, 1, 2.5, '#ffffff', 5);             // left strip (crisp edge highlights)
  box(1.6, 8, -5, 1, -3.5, '#ffe6d6', 3.5);          // left-back strip
  box(1.6, 8, 6.2, 0.5, -1, '#ffb88f', 4.5);         // right warm strip
  box(1.6, 8, 5.2, 0.5, 4, '#fff0e4', 3);            // right-front strip
  box(0.35, 6, 3.5, 0.5, 5.5, '#ffe2cc', 5);         // front-right thin strip (glass streak)
  box(5, 1.4, 0, -4, 4.5, '#3a2018', 2.2);           // low warm bounce card
  box(4, 3, -3, 2, -6, '#ff8a55', 3);                // back rim box (ember)
  box(2.5, 2.5, 5, 4, 4, '#ffffff', 2.4);            // key fill box
  box(5, 2.6, -2.2, 4.2, 6.5, '#fff3e8', 1.6, [0, 0, 0]);   // high front-left soft box: the gloss highlight on anything facing camera
  // big gradient card behind camera (product-shot glass reflection), a soft falloff made of bands
  for (let i = 0; i < 4; i++) box(9, 0.45, 0, 3.4 - i * 0.7, 9, '#ffffff', 0.12 + (3 - i) * 0.08);
  return s;
}

export function createEngine(canvas, W, H) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(22, W / H, 0.02, 100);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(studioEnv(), 0.02).texture; scene.environmentIntensity = 1;
  const L = {
    key: new THREE.DirectionalLight('#fff6ee', 1.6), fill: new THREE.DirectionalLight('#dfe8ff', 0.35),
    rimA: new THREE.DirectionalLight('#ffb48a', 1.2), rimB: new THREE.DirectionalLight('#ffd9c2', 0.8),
    sweep: new THREE.PointLight('#ffb27a', 0, 6, 1.6), askLight: new THREE.PointLight('#ff7a45', 0, 0.6, 1.5), hemi: new THREE.HemisphereLight('#fff1e6', '#7a3c25', 0.35),
  };
  Object.values(L).forEach(l => scene.add(l));
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; { const x = sc.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.5, 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.visible = false; scene.add(shadow);
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.002, maxblur: 0.008 }); bokeh.enabled = false; composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.32, 0.55, 0.88); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const fin = new ShaderPass(FINISH_SHADER); fin.uniforms.res.value.set(W, H); composer.addPass(fin);
  const E = {
    renderer, scene, camera, L, bg, bgTex, shadow, bloom, bokeh, fin, W, H,
    look(px, py, pz, tx, ty, tz, fov, roll = 0) {
      camera.position.set(px, py, pz); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(tx, ty, tz);
      if (fov && camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    reset() {
      L.key.position.set(-3, 4, 5); L.fill.position.set(4, 1, 3); L.rimA.position.set(4, 2, -4); L.rimB.position.set(-4, -1, -3);
      L.key.intensity = 1.5; L.key.color.set('#fff6ee'); L.fill.intensity = 0.3; L.rimA.intensity = 1.6; L.rimB.intensity = 1.0; L.hemi.intensity = 0.25;
      L.rimA.color.set('#ffb48a'); L.rimB.color.set('#ffd9c2'); L.sweep.intensity = 0; L.sweep.distance = 6; L.sweep.color.set('#ffb27a'); L.askLight.intensity = 0;
      scene.environmentIntensity = 1; scene.environmentRotation.set(0, 0, 0); scene.backgroundRotation.set(0, 0, 0); bokeh.enabled = false; bloom.strength = 0.3; bloom.radius = 0.55; bloom.threshold = 0.88; shadow.visible = false;
      const u = fin.uniforms; u.vig.value = 0.25; u.ca.value = 0; u.flash.value = 0; u.fade.value = 0; u.grain.value = 0.028; u.flashCol.value.setRGB(1, 0.96, 0.92);
      camera.up.set(0, 1, 0);
    },
    dof(focus, aperture, maxblur = 0.01) { bokeh.enabled = true; bokeh.uniforms.focus.value = focus; bokeh.uniforms.aperture.value = aperture; bokeh.uniforms.maxblur.value = maxblur; },
    render(t) { fin.uniforms.time.value = t; bgTex.needsUpdate = true; composer.render(); },
  };
  E.reset(); return E;
}

// ---------------------------------------------------------------- timing helpers
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
export const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
export const mix = (a, b, u) => a + (b - a) * u;
// damped spring step response from 0 to 1 starting at t0 (overshoots, settles)
export function spr(t, t0 = 0, f = 3.2, z = 0.32) { const x = t - t0; if (x <= 0) return 0; const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + z * w / wd * Math.sin(wd * x)); }
export const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);        // ease out cubic
export const eo5 = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 5);
export const ei = (x) => Math.pow(clamp(x, 0, 1), 3);
export const expo = (x) => { x = clamp(x, 0, 1); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
export const BEAT = 0.5;
export const beatKick = (t, d = 0.18) => { const p = ((t % BEAT) + BEAT) % BEAT; return Math.exp(-p / d * 3); };   // 1 on each beat, decays
