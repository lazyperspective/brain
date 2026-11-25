import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPark } from './park.js';

const W = 1080, H = 1080, FPS = 30;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const C = (h) => new THREE.Color(h);
const mixC = (stops, t) => { // stops: [[t, color]...]
  if (t <= stops[0][0]) return C(stops[0][1]);
  for (let i = 0; i < stops.length - 1; i++) { const [t0, c0] = stops[i], [t1, c1] = stops[i + 1]; if (t <= t1) return C(c0).lerp(C(c1), smooth(t0, t1, t)); }
  return C(stops[stops.length - 1][1]);
};

export function setup(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;

  const park = buildPark({ mode: 'tilt' });
  scene.add(park.root);

  // sky dome
  const skyU = { top: { value: C('#7fb0e0') }, hor: { value: C('#ffc27a') }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: C('#ffb060') }, stars: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float stars; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ float y = max(vD.y, 0.0); vec3 c = mix(hor, top, pow(smoothstep(0.0, 0.5, y), 0.7));
        float sd = max(dot(normalize(vD), normalize(sunDir)), 0.0); c += sunCol * (pow(sd, 12.0)*0.6 + pow(sd, 400.0)*3.0);
        vec3 q = floor(vD*300.0); float st = step(0.997, h(q)) * stars * smoothstep(0.05, 0.3, y); c += vec3(st);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  // distant hills ring (backdrop silhouettes)
  {
    const N = 160, pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; const h = 10 + Math.sin(a * 3) * 4 + Math.sin(a * 7 + 1) * 2.5 + Math.sin(a * 13) * 1.2; const r = 120; pos.push(Math.cos(a) * r, -1, Math.sin(a) * r, Math.cos(a) * r, h, Math.sin(a) * r); }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const hills = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#4f7a46', roughness: 1, side: THREE.DoubleSide }));
    scene.add(hills);
  }
  scene.fog = new THREE.Fog('#ffc27a', 100, 200);
  const envMats = []; scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial && !envMats.includes(o.material)) envMats.push(o.material); });

  const hemi = new THREE.HemisphereLight('#ffe0b8', '#5d6b3a', 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffb46b', 3.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 200;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const moon = new THREE.DirectionalLight('#7a8cff', 0); moon.position.set(40, 60, -30); scene.add(moon);
  const fill = new THREE.DirectionalLight('#9fb8ff', 0.0); fill.position.set(30, 40, 60); scene.add(fill);
  // night ride light pools (few point lights)
  const pls = [[0, 4, 15, '#ffc070'], [-4.5, 5, -4, '#ff70c8'], [13, 6, -12, '#ffd890'], [0, 4, 2, '#ffd080'], [-15, 4, 2, '#60d0ff']].map(([x, y, z, c]) => { const l = new THREE.PointLight(c, 0, 16, 1.5); l.position.set(x, y, z); scene.add(l); return l; });

  const camera = new THREE.PerspectiveCamera(30, W / H, 6, 500);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const ssao = new SSAOPass(scene, camera, W, H, 16);
  ssao.kernelRadius = 0.7; ssao.minDistance = 0.0004; ssao.maxDistance = 0.012;
  composer.addPass(ssao);
  const tiltShader = {
    uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(W, H) }, focusY: { value: 0.53 }, band: { value: 0.135 }, maxR: { value: 17 }, rot: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float focusY, band, maxR, rot; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        float d = abs(vUv.y - focusY) * (vUv.y > focusY ? 1.0 : 1.25);
        float r = maxR * pow(smoothstep(band, band + 0.34, d), 1.3);
        vec4 base = texture2D(tDiffuse, vUv);
        if (r < 0.6) { gl_FragColor = base; return; }
        vec3 acc = vec3(0.0); float ws = 0.0; float jit = hash(gl_FragCoord.xy) * 6.283 + rot;
        for (int i = 0; i < 40; i++) {
          float fi = float(i) + 0.5; float rr = sqrt(fi / 40.0) * r; float a = fi * 2.39996 + jit;
          vec3 c = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr / res).rgb;
          float l = dot(c, vec3(0.3, 0.59, 0.11));
          float w = 1.0 + smoothstep(1.6, 5.0, l) * 4.0;
          acc += c * w; ws += w;
        }
        gl_FragColor = vec4(acc / ws, 1.0);
      }`,
  };
  const tilt1 = new ShaderPass(tiltShader); composer.addPass(tilt1);
  const tilt2 = new ShaderPass(tiltShader); tilt2.uniforms.maxR.value = 8; tilt2.uniforms.rot.value = 1.3; composer.addPass(tilt2);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.55, 1.05); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, warm: { value: 1 }, night: { value: 0 }, res: { value: new THREE.Vector2(W, H) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float seed, warm, night; uniform vec2 res; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed)*43758.5453); }
      void main(){
        vec2 c = vUv - 0.5; float r2 = dot(c, c);
        vec2 ca = c * 0.0025;
        vec3 col = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);
        // saturation boost (miniature look)
        float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, 1.22);
        // gentle S curve
        col = col * col * (3.0 - 2.0 * col) * 0.35 + col * 0.65;
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, col * vec3(1.08, 0.98, 0.84), warm * 0.6);
        col = mix(col, col * mix(vec3(0.78, 0.82, 1.25), vec3(1.0), smoothstep(0.25, 0.7, lum)), night);
        col *= 1.0 - smoothstep(0.12, 0.62, r2) * 0.42;
        col += (hash(gl_FragCoord.xy) - 0.5) * 0.035;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`,
  });
  composer.addPass(grade);

  // ---------------------------------------------------------------- timeline
  const crestT = 1.5;
  const lightSchedule = { strings: 0.78, gate: 0.86, carousel: 0.98, wheel: 1.1, stalls: 1.05, drop: 1.18, ship: 1.24, swing: 1.3, cups: 1.36, flume: 1.42, coaster: crestT, xmas: 99 };

  function renderAt(t, frameIdx) {
    // sun: golden -> sets
    const sp = smooth(0.15, 1.25, t);
    const elev = lerp(15, -7, sp) * Math.PI / 180, az = lerp(-2.25, -2.05, sp);
    const sd = new THREE.Vector3(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az)).normalize();
    sun.position.copy(sd).multiplyScalar(100); sun.target.position.set(0, 0, 0);
    sun.color.copy(mixC([[0, '#ffa04a'], [0.6, '#ff7030'], [1.05, '#ff4a3a']], t));
    sun.intensity = 3.3 * (1 - smooth(0.55, 1.22, t));
    sun.castShadow = sun.intensity > 0.02;
    skyU.sunDir.value.copy(sd); skyU.sunCol.value.copy(sun.color).multiplyScalar(1 - smooth(0.9, 1.3, t));
    skyU.top.value.copy(mixC([[0, '#86a9d8'], [0.7, '#7a7ad0'], [1.2, '#33307a'], [1.8, '#141838']], t));
    skyU.hor.value.copy(mixC([[0, '#ffc98a'], [0.6, '#ff9a6a'], [1.0, '#9a6ac0'], [1.4, '#4a3c8c'], [1.9, '#2a2350']], t));
    skyU.stars.value = smooth(1.4, 2.2, t) * 0.8;
    scene.fog.color.copy(skyU.hor.value);
    hemi.color.copy(mixC([[0, '#ffe2bc'], [0.7, '#e8b0c0'], [1.1, '#8a70c8'], [1.7, '#3a4a90']], t));
    hemi.groundColor.copy(mixC([[0, '#5d6b3a'], [1.0, '#3a3050'], [1.7, '#1a1a30']], t));
    hemi.intensity = lerp(0.34, 0.2, smooth(0.6, 1.7, t));
    moon.intensity = smooth(1.0, 1.8, t) * 0.55;
    const envK = lerp(0.55, 0.06, smooth(0.5, 1.6, t)); envMats.forEach((m) => { m.envMapIntensity = envK * (m.userData.envBoost || 1); });
    bloom.threshold = lerp(2.6, 1.1, smooth(0.7, 1.4, t)); bloom.strength = lerp(0.25, 0.7, smooth(0.7, 1.6, t));
    fill.intensity = smooth(1.0, 1.8, t) * 0.35; fill.color.set('#7f90ff');
    renderer.toneMappingExposure = lerp(1.05, 1.25, smooth(0.9, 1.8, t));
    scene.environment = envTex; scene.environmentIntensity = 1;
    // lights on
    const lights = {};
    for (const k in lightSchedule) {
      const t0 = lightSchedule[k];
      let v = smooth(t0, t0 + 0.07, t);
      if (k === 'coaster') v = t >= t0 ? 1 : 0;
      else if (t > t0 && t < t0 + 0.16) v *= (Math.sin((t - t0) * 120) > -0.2 ? 1 : 0.25); // flicker on
      lights[k] = v;
    }
    const S = { crestTime: crestT, lights, stringProg: (t - 0.78) * 60, glowGain: 1 };
    park.update(t, S);
    pls.forEach((l, i) => { const key = ['strings', 'coaster', 'wheel', 'strings', 'flume'][i]; l.intensity = (lights[key] || 0) * 22; });
    // camera: high three-quarter, slow push + handheld micro drift
    const az2 = (16 + t * 0.9) * Math.PI / 180, el = (27.5 - t * 0.3) * Math.PI / 180, dist = 80 - t * 2.4;
    const tgt = new THREE.Vector3(1.2, 1.8, -0.5);
    const shake = new THREE.Vector3(Math.sin(t * 5.1) * 0.03 + Math.sin(t * 11.3) * 0.012, Math.sin(t * 4.3 + 1) * 0.025, 0);
    camera.position.set(tgt.x + Math.sin(az2) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, tgt.z + Math.cos(az2) * Math.cos(el) * dist).add(shake);
    camera.lookAt(tgt.clone().add(new THREE.Vector3(0, 3.2, 0)));
    camera.updateMatrixWorld();
    grade.uniforms.seed.value = frameIdx * 1.37; grade.uniforms.warm.value = 1 - smooth(0.6, 1.3, t); grade.uniforms.night.value = smooth(1.0, 1.8, t);
    composer.render();
  }
  return { renderAt, frames: 90, fps: FPS };
}
