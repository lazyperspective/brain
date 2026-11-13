// ------------------------------------------------------------------
// Render engine: studio lighting, drawable backdrop, contact shadow, post (bloom, optional DOF, grain + vignette).
// ------------------------------------------------------------------
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FINISH_SHADER = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.03 }, vig: { value: 0.28 }, res: { value: new THREE.Vector2(1920, 1080) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vig; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float n = h(floor(vUv * res) + fract(time * 7.13) * 91.7) - 0.5; c.rgb += n * grain;
      float d = distance(vUv * vec2(res.x / res.y, 1.0), vec2(0.5 * res.x / res.y, 0.5)); c.rgb *= 1.0 - vig * smoothstep(0.45, 1.05, d); gl_FragColor = c; }`,
};

export function createEngine(canvas, W, H) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(22, W / H, 0.05, 100);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.035).texture; scene.environmentIntensity = 1;
  // lights: a soft key, a cool fill, two warm rims, and a movable "sweep" light for light-runs along the edges
  const L = {
    key: new THREE.DirectionalLight('#fff6ee', 1.6), fill: new THREE.DirectionalLight('#dfe8ff', 0.35),
    rimA: new THREE.DirectionalLight('#ffb48a', 1.2), rimB: new THREE.DirectionalLight('#ffd9c2', 0.8),
    sweep: new THREE.PointLight('#ffb27a', 0, 6, 1.6), hemi: new THREE.HemisphereLight('#fff1e6', '#7a3c25', 0.35),
  };
  L.key.position.set(-3, 4, 5); L.fill.position.set(4, 1, 3); L.rimA.position.set(4, 2, -4); L.rimB.position.set(-4, -1, -3);
  Object.values(L).forEach(l => scene.add(l));
  // backdrop: a canvas we redraw per frame (gradients, colour fields, giant type behind the phone)
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
  // contact shadow: a soft blob under the phone
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; { const x = sc.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(60,25,10,0.55)'); g.addColorStop(0.5, 'rgba(60,25,10,0.18)'); g.addColorStop(1, 'rgba(60,25,10,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.visible = false; scene.add(shadow);
  // post
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.002, maxblur: 0.008 }); bokeh.enabled = false; composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.32, 0.55, 0.88); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const fin = new ShaderPass(FINISH_SHADER); fin.uniforms.res.value.set(W, H); composer.addPass(fin);
  return {
    renderer, scene, camera, L, bg, bgTex, shadow, bloom, bokeh, fin, W, H,
    look(px, py, pz, tx, ty, tz, fov) { camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); if (fov && camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); } },
    render(t) { fin.uniforms.time.value = t; bgTex.needsUpdate = true; composer.render(); },
  };
}
// smooth path through keys (monotone cubic, no stops between keys): keys [[t, v1, v2, ...]]
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
export const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
