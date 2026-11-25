import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeSky } from './nature.js';
import { gouachePost, pixelPost } from './post.js';
import { shotConfig } from './shots.js';

const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1920), H = +(qs.get('h') || 1080); const style = qs.get('style') || 'gouache'; const pixel = style === 'pixel';
const log = (...a) => console.log('[a]', ...a);
try {
  const park = await ParkPlan.load('/plan/park.json');
  const shots = await (await fetch('/plan/shots.json')).json();
  const shot = shots.shots.find(s => s.id === qs.get('shot'));
  const NW = pixel ? 480 : W, NH = pixel ? 270 : H;
  const canvas = document.createElement('canvas'); canvas.width = NW; canvas.height = NH; document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(NW, NH, false);
  renderer.shadowMap.enabled = !qs.get('ns'); renderer.shadowMap.type = pixel ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  const cfg = shotConfig(shot, park, style);
  const t0 = performance.now();
  const world = buildWorld(park, shot, style, cfg.opts || {});
  log('world built', ((performance.now() - t0) / 1000).toFixed(1) + 's');
  const scene = new THREE.Scene(); scene.add(world.root);
  for (const h of (qs.get('hide') || '').split(',').filter(Boolean)) { world.root.traverse(o => { if (o.name === h) o.visible = false; }); if (world.gb.groups[h]) world.gb.groups[h].visible = false; }
  scene.background = new THREE.Color(pixel ? 0x3f9a43 : 0xbfd9ff);
  let sky = null; if (!pixel) { sky = makeSky(world.ctx); scene.add(sky); world.ctx.skyGrey = sky.material.uniforms.uGrey; scene.fog = new THREE.Fog(0xd9e3e6, 350, 3200); }
  const L = park.data.lighting; const d = L.sun_day.direction_to_sun;
  const sun = new THREE.DirectionalLight(0xfff1dc, pixel ? 2.7 : 2.9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; if (!pixel) sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x9dbf7a, pixel ? 1.25 : 1.35); scene.add(hemi);
  const pcam = new THREE.PerspectiveCamera(40, W / H, 0.3, 6000);
  const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 3000);
  const post = pixel ? pixelPost(renderer, NW, NH) : gouachePost(renderer, NW, NH);
  const out = document.createElement('canvas'); out.width = W; out.height = H; const octx = out.getContext('2d'); octx.imageSmoothingEnabled = false;
  const v = new THREE.Vector3();
  function setCamera(t) {
    const c = park.camera(shot, t);
    let cam;
    if (c.mode === 'ortho') {
      cam = ocam; const oh = c.orthoHalfHeight; cam.left = -oh * 16 / 9; cam.right = oh * 16 / 9; cam.top = oh; cam.bottom = -oh;
      const tg = new THREE.Vector3(...c.target); const dir = tg.clone().sub(new THREE.Vector3(...c.position)).normalize();
      cam.up.set(...c.up); cam.position.copy(tg).addScaledVector(dir, -1200); cam.lookAt(tg); cam.updateMatrixWorld();
      if (pixel) { // snap to the native pixel grid (crisp pixel art; at most half a native pixel off)
        const pxs = 2 * oh / NH; const r = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), u = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        const a = tg.dot(r), b = tg.dot(u); const da = Math.round(a / pxs) * pxs - a, db = Math.round(b / pxs) * pxs - b;
        cam.position.addScaledVector(r, da).addScaledVector(u, db); cam.updateMatrixWorld();
      }
      cam.near = 1; cam.far = 3000; cam.updateProjectionMatrix();
      post.p && (post.p.m.uniforms.uThr.value = Math.max(0.8, oh * 0.03));
      fitShadow(tg, oh * 2.4);
    } else {
      cam = pcam; cam.fov = c.fov; cam.aspect = W / H; cam.near = 0.3; cam.far = 6000; cam.updateProjectionMatrix();
      cam.position.set(...c.position); cam.up.set(...c.up); cam.lookAt(...c.target); cam.updateMatrixWorld();
      // shadow focus: where the view hits the ground (or the target), radius from distance
      const pos = cam.position, dir = new THREE.Vector3(...c.target).sub(pos).normalize();
      let gpt; if (dir.y < -0.05) { const k = Math.min(-pos.y / dir.y, 600); gpt = pos.clone().addScaledVector(dir, k * 0.55); } else gpt = pos.clone().addScaledVector(dir, 90);
      gpt.y = 0; const R = Math.max(70, Math.min(420, pos.y * 1.3 + 60));
      fitShadow(cfg.shadowCenter ? new THREE.Vector3(...cfg.shadowCenter(t, cam)) : gpt, cfg.shadowRadius ? cfg.shadowRadius(t, cam) : R);
    }
    return { cam, c };
  }
  function fitShadow(center, R) {
    sun.position.set(center.x + d[0] * 900, center.y + d[1] * 900, center.z + d[2] * 900); sun.target.position.copy(center); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 200; sc.far = 1700; sc.updateProjectionMatrix();
  }
  window.renderFrame = (t, still) => {
    const T0 = performance.now(); world.ctx.camPos = park.camera(shot, t).position; renderer.info.autoReset = false; renderer.info.reset();
    const { cam, c } = setCamera(t);
    if (sky) sky.position.copy(cam.position);
    cam.updateMatrixWorld(); const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); world.ctx.frustum = fr;
    world.update(t); if (cfg.update) cfg.update(t, world, post);
    if (cfg.preRender) cfg.preRender(t, cam, post, world);
    const T1 = performance.now();
    if (qs.get('raw')) { renderer.setRenderTarget(null); renderer.render(scene, cam); } else post.render(scene, cam, t);
    if (still) { const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); log('update', (T1 - T0).toFixed(0), 'render', (performance.now() - T1).toFixed(0), 'calls', renderer.info.render.calls, 'tris', renderer.info.render.triangles); }
    if (still && qs.get('prof')) { const acc = {}; const S = new THREE.Sphere();
      scene.traverseVisible(o => { if (!o.isMesh) return; const g = o.geometry; const tri = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
        if (o.frustumCulled) { if (!o.boundingSphere && o.isInstancedMesh) o.computeBoundingSphere(); const bs = o.isInstancedMesh ? o.boundingSphere : (g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere)); S.copy(bs).applyMatrix4(o.matrixWorld); if (!fr.intersectsSphere(S)) return; }
        let p = o; let key = ''; while (p.parent && p.parent !== scene) { if (p.name) key = p.name + '/' + key; p = p.parent; } key += (o.userData.category || o.material.type); acc[key] = (acc[key] || 0) + tri; });
      log(JSON.stringify(Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => k + ':' + Math.round(v / 1000) + 'k'))); }
    if (pixel && still) { octx.drawImage(canvas, 0, 0, W, H); return out.toDataURL('image/png'); }
    if (pixel) return canvas.toDataURL('image/png');
    return canvas.toDataURL('image/jpeg', 0.95);
  };
  window.__ready = true;
} catch (e) { window.__err = e.stack || String(e); }
