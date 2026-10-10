// Film runtime: builds the world once, then renders any frame deterministically on request.
import * as THREE from 'three';
import { Post } from './post.js';
import { G } from './mats.js';
import { buildWorld, updateWorld } from './shots.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1920), H = +(params.get('h') || 1080);
export const FPS = 24;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 4000);
const post = new Post(renderer, W, H);
const world = buildWorld(scene, camera, renderer);
// Title card (lower third), painted once onto a transparent canvas
{
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const cx = W / 2, cy = H * 0.84;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `italic 600 ${Math.round(H * 0.075)}px Georgia, 'DejaVu Serif', serif`;
  g.shadowColor = 'rgba(255,150,200,0.9)'; g.shadowBlur = H * 0.03;
  g.fillStyle = '#fff6ea'; g.fillText('The Cloud Thief', cx, cy);
  g.shadowBlur = H * 0.01; g.fillText('The Cloud Thief', cx, cy);
  g.font = `500 ${Math.round(H * 0.018)}px Georgia, 'DejaVu Serif', serif`; g.shadowBlur = H * 0.01;
  g.fillStyle = 'rgba(255,240,230,0.85)'; g.fillText('A   S H O R T   F I L M', cx, cy + H * 0.06);
  const tex = new THREE.CanvasTexture(c); tex.flipY = true; post.final.u.tTitle.value = tex;
}

function renderAt(t) {
  G.uTime.value = t;
  const look = updateWorld(t, world);
  camera.updateMatrixWorld();
  post.render(scene, camera, { sunDir: G.uSunDir.value, time: t, ...look });
}

window.__ready = true;
window.renderFrame = (f) => { renderAt(f / FPS); return true; };
window.renderTime = (t) => { renderAt(t); return true; };
// Read the drawn frame back as raw RGBA (bottom-up), base64 encoded
window.grabFrame = () => {
  const gl = renderer.getContext();
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
  return btoa(s);
};
if (params.get('hide')) { const h = params.get('hide').split(','); const f = world.fx; const map = { plume: [f.plume], ribbons: f.ribbons.map(r => r.m), canopy: f.canopy, ring: [f.ring], rays: [] };
  const orig = window.renderTime; window.renderTime = (t) => { const r0 = orig; G.uTime.value = t; const look = updateWorld(t, world); h.forEach(k => (map[k] || []).forEach(o => o.visible = false)); if (h.includes('rays')) look.uRaysAmt = 0; if (h.includes('bloom')) look.uBloomAmt = 0; camera.updateMatrixWorld(); post.render(scene, camera, { sunDir: G.uSunDir.value, time: t, ...look }); return true; }; }
if (params.get('t')) renderAt(+params.get('t'));
window.profile = (t) => {
  const out = {}; let a = performance.now();
  G.uTime.value = t; const look = updateWorld(t, world); out.update = performance.now() - a;
  const gl = renderer.getContext(); const px = new Uint8Array(4);
  a = performance.now(); renderer.shadowMap.autoUpdate = true; renderer.setRenderTarget(post.sceneRT); renderer.render(scene, camera); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); out.sceneWithShadow = performance.now() - a;
  a = performance.now(); renderer.shadowMap.autoUpdate = false; renderer.render(scene, camera); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); out.sceneNoShadow = performance.now() - a; renderer.shadowMap.autoUpdate = true;
  a = performance.now(); post.render(scene, camera, { sunDir: G.uSunDir.value, time: t, ...look }); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); out.fullPost = performance.now() - a;
  out.calls = renderer.info.render.calls; out.tris = renderer.info.render.triangles;
  return out;
};
window.probeGroups = (t) => {
  G.uTime.value = t; updateWorld(t, world);
  const gl = renderer.getContext(); const px = new Uint8Array(4);
  const time = () => { renderer.setRenderTarget(post.sceneRT); const a = performance.now(); renderer.render(scene, camera); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return Math.round(performance.now() - a); };
  const res = { all: time(), all2: time(), all3: time() };
  for (const [name, obj] of [['clouds', world.clouds.group], ['city', world.city.group], ['sky', world.sky]]) { obj.visible = false; res['no_' + name] = time(); obj.visible = true; }
  const fxObjs = Object.values(world.fx).flat().filter(o => o && o.isObject3D);
  fxObjs.forEach(o => o.userData._v = o.visible); fxObjs.forEach(o => o.visible = false); res.no_fx = time(); fxObjs.forEach(o => o.visible = o.userData._v);
  let tris = 0; scene.traverse(o => { if (o.isMesh && o.geometry.index) tris += o.geometry.index.count / 3; else if (o.isMesh) tris += o.geometry.attributes.position.count / 3; }); res.totalTris = Math.round(tris);
  return res;
};
window.bisect = (t) => {
  const gl = renderer.getContext(); const px = new Uint8Array(4);
  const time = () => { renderer.setRenderTarget(post.sceneRT); const a = performance.now(); renderer.render(scene, camera); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return Math.round(performance.now() - a); };
  G.uTime.value = t; updateWorld(t, world); const r = { first: time(), base: time() };
  const tests = {
    canvases: () => { world.pip.face.t.needsUpdate = true; world.puff.face.t.needsUpdate = true; },
    scarf: () => { world.pip.scarf.geometry.attributes.position.needsUpdate = true; },
    instanced: () => { scene.traverse(o => { if (o.isInstancedMesh) o.instanceMatrix.needsUpdate = true; }); },
    fxbuffers: () => { scene.traverse(o => { if (o.isPoints) o.geometry.attributes.position.needsUpdate = true; }); },
    sunmove: () => { world.sun.position.x += 0.001; world.sun.shadow.camera.updateProjectionMatrix(); },
    uTime: () => { G.uTime.value += 0.0001; },
  };
  for (const k in tests) { tests[k](); r[k] = time(); }
  return r;
};
