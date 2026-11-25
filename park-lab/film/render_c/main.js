// Render agent C: page entry. ?shot=<id>&w=&h=
import * as THREE from 'three';
import { clamp, lerp, smooth, sstep, eOutBack, eOutCubic, eInOut, eOutBounce, spring, rng, hash1, canvasTex, makeCanvas, starPath, Inst, patchMaterial, addShells, makeEnv, Post, fitShadow, lumpySphere, RoundedBoxGeometry, tint, merge, xf, mixHex, shade } from './common.js';
import { makeKit, paintGround, buildTrees, buildWater, buildProps, buildGuests, updateGuests, drawPattern, geoKit } from './world.js';
import { buildBuildings, buildRides, buildTracks, buildTrains, updateTrains } from './rides.js';

console.log('[build] module start at ' + (performance.now() / 1000).toFixed(1) + 's');
const qs = new URLSearchParams(location.search);
const SHOT = qs.get('shot'); const WD = +(qs.get('w') || 1920), HT = +(qs.get('h') || 1080);
const SITE = { x0: -340, x1: 340, z0: -270, z1: 320 };
const SHEET = { x0: -300, x1: 300, z0: -232, z1: 248 };
const CFG = {
  '01_paper_ticket': { base: SHEET, basePpm: 8, hi: null, clipSheet: true },
  '10_pov_crest_paper': { base: SHEET, basePpm: 6, hi: { x0: -70, x1: 95, z0: -212, z1: -108 }, roiPpm: 22, clipSheet: true },
  '03_felt_kiddie': { base: SITE, basePpm: 4, hi: { x0: -152, x1: -12, z0: 14, z1: 156 }, roiPpm: 24 },
  '11_pov_drop_felt': { base: SITE, basePpm: 4, hi: { x0: -45, x1: 80, z0: -212, z1: -118 }, roiPpm: 22 },
  '06_tin_toybox': { base: SITE, basePpm: 4, hi: { x0: 40, x1: 205, z0: -6, z1: 140 }, roiPpm: 22 },
  '14_pov_corkscrew_tin': { base: SITE, basePpm: 4, hi: { x0: 0, x1: 130, z0: -182, z1: -100 }, roiPpm: 22 },
};
const inR = (r, x, z, m = 0) => r && x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;

try {
  const park = await ParkPlan.load('/plan/park.json');
  const shots = await (await fetch('/plan/shots.json')).json();
  const shot = shots.shots.find(s => s.id === SHOT); const S = shot.style; const cfg = CFG[SHOT];
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(WD, HT); document.body.appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const K = makeKit(S);
  console.log('[build] park+renderer+kit at ' + (performance.now() / 1000).toFixed(1) + 's'); const TT = performance.now(); const tlog = (m) => console.log(`[build] ${m} ${((performance.now() - TT) / 1000).toFixed(1)}s`);
  const groups = {}; const W = { park, D: park.data, S, K, scene, pieces: [], sets: {}, anims: [], ParkPlan, shot,
    group: n => { if (!groups[n]) { groups[n] = new THREE.Group(); groups[n].name = n; scene.add(groups[n]); } return groups[n]; },
    lodOf: (x, z) => { if (inR(cfg.hi, x, z)) return 0; if (cfg.clipSheet) return inR(SHEET, x, z, -1) ? 1 : 3; return inR(SITE, x, z) ? 1 : 3; } };
  W.groups = groups;
  // ------------------------------------------------------------------ ground textures
  const baseTex = paintGround(W, cfg.base, cfg.basePpm); tlog('base ground');
  const roiTex = cfg.hi ? paintGround(W, cfg.hi, cfg.roiPpm) : baseTex; tlog('roi ground');
  const R4 = r => new THREE.Vector4(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
  const gU = { gBase: { value: baseTex }, gRoi: { value: roiTex }, gBaseR: { value: R4(cfg.base) }, gRoiR: { value: cfg.hi ? R4(cfg.hi) : new THREE.Vector4(1e6, 1e6, 1, 1) } };
  const groundMat = S === 'felt' ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 1, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color('#fff6ea') })
    : S === 'tin' ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94 });
  patchMaterial(groundMat, { ground: gU, detail: K.det, detailScale: K.detScale, detailStrength: K.detK * (S === 'tin' ? 0.6 : 1), key: 'ground', bump: K.bump });
  groundMat.userData.gU = gU; W.groundMat = groundMat; W.baseTex = baseTex; W.roiTex = roiTex;
  // ------------------------------------------------------------------ terrain / sheet
  let slab = 0;
  if (S !== 'paper') {
    const g = park.grid; const nx = g.nx, nz = g.nz; const geo = new THREE.PlaneGeometry((nx - 1) * g.cell, (nz - 1) * g.cell, nx - 1, nz - 1); geo.rotateX(-Math.PI / 2); geo.translate(g.x0 + (nx - 1) * g.cell / 2, 0, g.z0 + (nz - 1) * g.cell / 2);
    const P = geo.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, park.heightAt(P.getX(i), P.getZ(i)) - 0.02); geo.computeVertexNormals();
    const tm = new THREE.Mesh(geo, groundMat); tm.receiveShadow = true; tm.userData.ground = true; W.group('terrain').add(tm); W.terrain = tm;
  }
  // raised path slabs (applique felt / cut card / embossed tin) – not on the folding sheet
  if (SHOT !== '01_paper_ticket') {
    slab = S === 'felt' ? 0.2 : S === 'paper' ? 0.22 : 0.08;
    const shapes = []; for (const regions of Object.values(park.data.paths.paving_regions)) for (const r of regions) { const sh = new THREE.Shape(r.outer.map(p => new THREE.Vector2(p[0], -p[1]))); for (const h of r.holes || []) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], -p[1])))); shapes.push(sh); }
    const eg = new THREE.ExtrudeGeometry(shapes, { depth: slab, bevelEnabled: false, curveSegments: 2 }); eg.rotateX(-Math.PI / 2); eg.translate(0, 0.0, 0);
    const edgeM = S === 'paper' ? K.M('#F6EEDC') : groundMat;
    const sm = new THREE.Mesh(eg, [groundMat, edgeM]); sm.receiveShadow = true; sm.castShadow = S === 'paper'; W.group('terrain').add(sm); W.slabs = sm;
  }
  W.slab = slab;
  // ------------------------------------------------------------------ build the park
  if (SHOT !== '01_paper_ticket') buildWater(W);
  buildTrees(W); tlog('trees'); buildProps(W); tlog('props'); buildBuildings(W); tlog('buildings'); buildRides(W); tlog('rides'); buildTracks(W); tlog('tracks'); buildTrains(W); buildGuests(W); tlog('trains+guests');
  // ------------------------------------------------------------------ sky / room
  const sunDir = new THREE.Vector3(...park.data.lighting.sun_day.direction_to_sun).normalize();
  if (S === 'paper') buildTable(W, scene); else buildSky(W, scene); tlog('sky/table');
  // ------------------------------------------------------------------ lights
  const tabletop = SHOT === '01_paper_ticket';
  const lightDir = tabletop ? new THREE.Vector3(-0.5, 0.8, -0.35).normalize() : sunDir;
  const sun = new THREE.DirectionalLight(tabletop ? '#FFD9A0' : '#FFF1DC', S === 'tin' ? 2.6 : S === 'felt' ? 2.7 : 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = S === 'felt' ? 0.08 : 0.04; scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(tabletop ? '#E6ECFF' : '#BFD9FF', tabletop ? '#b08060' : '#9DBF7A', S === 'tin' ? 0.55 : S === 'felt' ? 1.0 : 1.5); scene.add(hemi);
  if (S === 'tin') { const env = makeEnv(renderer, { sunDir: sunDir.toArray() }); scene.environment = env; scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) m.envMapIntensity = m.metalness > 0.9 ? 1.0 : 0.7; }); }
  if (S === 'paper') { const fill = new THREE.DirectionalLight('#fff4e4', 0.9); fill.position.set(300, 260, 500); scene.add(fill); }
  tlog('lights');
  // ------------------------------------------------------------------ felt fuzz shells on near things
  const boilU = { value: new THREE.Vector3() };
  if (S === 'felt') {
    const cache = new Map(); const targets = [];
    scene.traverse(o => { if (!(o.isMesh || o.isInstancedMesh) || o.userData.shell || Array.isArray(o.material) || !o.material.isMeshPhysicalMaterial) return;
      if (o.userData.ground) return; let near = false;
      if (o.isInstancedMesh) near = !!o.userData.hi || (o.parent && o.parent.name.startsWith('track')) || o.parent?.parent?.name === 'rides';
      else { const wp = new THREE.Vector3(); o.getWorldPosition(wp); near = W.lodOf(wp.x, wp.z) === 0 || !!o.parent?.name?.startsWith('trains'); }
      if (near) targets.push(o); });
    for (const o of targets) { o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere.radius * (o.isInstancedMesh ? 1 : Math.max(o.scale.x, o.scale.y, o.scale.z));
      const len = o.userData.cat === 'guest' ? 0.025 : clamp(r * 0.04, 0.03, 0.12); addShells(o, o.userData.cat === 'guest' ? 1 : 2, len, o.userData.cat === 'guest' ? 30 : 9, boilU, cache); }
    if (W.slabs) addShells(W.slabs, 1, 0.06, 7, boilU, cache);
  }
  // ------------------------------------------------------------------ camera, post
  tlog('shells'); const camera = new THREE.PerspectiveCamera(40, WD / HT, 0.3, 6000);
  const post = new Post(renderer, WD, HT, { ss: 1, samples: 4 });
  Object.assign(post.u, S === 'paper' ? {} : {});
  post.u.exposure.value = S === 'tin' ? 1.0 : S === 'felt' ? 1.0 : 1.0;
  post.u.sat.value = S === 'tin' ? 1.08 : S === 'felt' ? 1.04 : 1.02; post.u.contrast.value = S === 'tin' ? 1.06 : 1.02; post.u.vign.value = S === 'paper' ? 0.4 : 0.3; post.u.grain.value = S === 'paper' ? 0.018 : 0.02;
  post.u.tintC.value.set(...(tabletop || S === 'paper' ? [1.05, 1.0, 0.93] : S === 'felt' ? [1.03, 1.0, 0.96] : [1.02, 1.0, 0.97]));
  // ------------------------------------------------------------------ shot direction
  const ctx = { W, scene, K, park, shot, camera, post, sun, hemi, boilU, renderer, S };
  tlog('post'); wrapPieces(W); tlog('wrap');
  let director = null;
  if (SHOT === '01_paper_ticket') director = await setup01(ctx);
  else if (SHOT === '10_pov_crest_paper') director = setupPOV(ctx, { mblur: 0.35 });
  else if (SHOT === '03_felt_kiddie') director = setup03(ctx);
  else if (SHOT === '11_pov_drop_felt') director = setupPOV(ctx, { mblur: 0.5 });
  else if (SHOT === '06_tin_toybox') director = setup06(ctx);
  else if (SHOT === '14_pov_corkscrew_tin') director = setupPOV(ctx, { mblur: 0.42 });
  tlog('director'); renderer.compile(scene, camera); tlog('compile');
  let prevPV = null;
  window.renderAt = (t) => {
    const c = park.camera(shot, t);
    camera.fov = c.fov; camera.aspect = WD / HT; camera.near = 0.3; camera.far = 6000; camera.updateProjectionMatrix();
    camera.position.set(...c.position); camera.up.set(...c.up); camera.lookAt(...c.target); camera.updateMatrixWorld();
    // motion blur reference: camera a fraction of a frame earlier
    if (director.mblur) { const c0 = park.camera(shot, t - 1 / 30); const pc = camera.clone(); pc.position.set(...c0.position); pc.up.set(...c0.up); pc.lookAt(...c0.target); pc.updateMatrixWorld(); post.prevPV = new THREE.Matrix4().multiplyMatrices(pc.projectionMatrix, pc.matrixWorldInverse); post.u.mblur.value = director.mblur; }
    director.update(t, c);
    // shadows follow the view
    const sh = director.shadow ? director.shadow(t, c) : { center: new THREE.Vector3(...c.target), radius: 150 };
    fitShadow(sun, sh.center, sh.radius, (tabletop ? lightDir : sunDir).toArray(), 4096);
    sun.shadow.camera.updateMatrixWorld();
    const fseed = Math.round(t * 30); post.u.seed.value = (fseed % 97) * 0.731;
    post.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  };
  window.__ready = true; console.log('[build] ready at ' + (performance.now() / 1000).toFixed(1) + 's');
} catch (e) { window.__err = (e && e.stack) || String(e); }

// =====================================================================================================
function wrapPieces(W) {
  for (const p of W.pieces) { const par = p.parent; if (!par) continue; const w = new THREE.Group(); w.matrixAutoUpdate = false; const info = p.userData.piece; const base = new THREE.Vector3(info.x, 0, info.z);
    if (p.name === '' && p.position.lengthSq() > 0) { /* positioned piece */ }
    par.add(w); par.remove(p); w.add(p); p.position.sub(base); w.userData.base = base; w.userData.piece = info; w.matrix.makeTranslation(base.x, base.y, base.z); p.userData.wrapper = w; info.wrapper = w; info.obj = p; }
}
const _M = new THREE.Matrix4(), _M2 = new THREE.Matrix4(), _V = new THREE.Vector3(), _Q = new THREE.Quaternion();
function setWrap(info, pre) { const w = info.wrapper; if (!w) return; w.matrix.makeTranslation(w.userData.base.x, w.userData.base.y, w.userData.base.z); if (pre) w.matrix.multiply(pre); w.matrixWorldNeedsUpdate = true; }
// pre-matrix builders (world-aligned, about the piece's base point)
function hingeM(a) { return new THREE.Matrix4().makeRotationX(-a); }
function growM(sy, sxz) { return new THREE.Matrix4().makeScale(sxz, Math.max(0.001, sy), sxz); }
function layM(lay, depth, sq, v) { // lie down away from camera along horizontal v, flattened along -v
  const d = new THREE.Vector3(-v.x, 0, -v.z).normalize(); const Sd = new THREE.Matrix4().set(1 + (depth - 1) * d.x * d.x, 0, (depth - 1) * d.x * d.z, 0, 0, 1, 0, 0, (depth - 1) * d.z * d.x, 0, 1 + (depth - 1) * d.z * d.z, 0, 0, 0, 0, 1);
  const k = new THREE.Vector3(v.z, 0, -v.x).normalize(); const R = new THREE.Matrix4().makeRotationAxis(k, lay * Math.PI / 2 * 0.97);
  const Sq = new THREE.Matrix4().makeScale(1 + sq * 0.5, Math.max(0.02, 1 - sq), 1 + sq * 0.5);
  return R.multiply(Sd).multiply(Sq);
}
function allSets(W) { const out = []; for (const [k, v] of Object.entries(W.sets)) { if (Array.isArray(v)) out.push(...v.map(s => [k, s])); else if (v) out.push([k, v]); } return out; }

// =====================================================================================================
// SKY (felt / tin) and TABLE (paper)
// =====================================================================================================
function buildSky(W, scene) {
  const S = W.S; const top = S === 'tin' ? '#86B9E6' : '#9CC6EC', hor = S === 'tin' ? '#E2F0FC' : '#E4F0FA';
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(hor) }, gr: { value: new THREE.Color(S === 'tin' ? '#7fa86a' : '#9cbf80') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, hor, gr; varying vec3 vP; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){ vec3 d = normalize(vP); float y = d.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y, 0., 1.), 0.55)) : mix(hor, gr, clamp(-y * 6.0, 0., 1.));
      ${S === 'felt' ? 'float f = h(floor(d.xz * 900.0 + d.y * 300.0)); c *= 0.985 + 0.03 * f;' : 'vec2 g = fract(vec2(atan(d.z, d.x) * 180.0, y * 260.0)) - 0.5; c *= 1.0 - 0.025 * step(length(g), 0.28) * smoothstep(0.0, 0.3, y);'}
      gl_FragColor = vec4(c, 1.0); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), m); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  scene.fog = new THREE.Fog(hor, 700, 4200);
  if (S === 'felt') { // puffy felt clouds far away
    const K = W.K; const R = rng(42); const cg = []; for (let i = 0; i < 5; i++) { const g = lumpySphere(1, 2, 0.15, 1.5, i); g.scale(1, 0.7, 1); g.translate((i - 2) * 0.9, (i % 2) * 0.25, (R() - 0.5) * 0.5); cg.push(g); }
    const cloud = merge(cg); const items = [];
    for (let i = 0; i < 26; i++) { const a = R() * 6.283, d = 900 + R() * 1600; items.push({ p: [Math.cos(a) * d, 160 + R() * 380, Math.sin(a) * d], s: 30 + R() * 40, ry: R() * 6, c: '#ffffff' }); }
    const ci = new Inst(tint(cloud, '#ffffff'), K.M('#FFFFFF', { vc: true }), items, { cast: false }); ci.mesh.material = K.M('#ffffff', { vc: true }); scene.add(ci.mesh);
  }
}
function buildTable(W, scene) {
  const K = W.K;
  const wood = canvasTex(2048, 2048, (g, w, h) => { const R = rng(3); g.fillStyle = '#5a3420'; g.fillRect(0, 0, w, h); const pw = 256;
    for (let p = 0; p < w / pw; p++) { const base = ['#5c3e2f', '#523629', '#614232', '#573a2c'][p % 4]; g.fillStyle = base; g.fillRect(p * pw, 0, pw - 3, h);
      for (let i = 0; i < 90; i++) { const x = p * pw + R() * pw; g.strokeStyle = `rgba(${R() < 0.5 ? '30,15,5' : '150,95,55'},${0.08 + R() * 0.14})`; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y / 180 + i) * 6 + Math.sin(y / 37 + i * 3) * 1.5, y); g.stroke(); }
      for (let k = 0; k < 2; k++) { const cx = p * pw + 40 + R() * (pw - 80), cy = R() * h; for (let r = 4; r < 40; r += 5) { g.strokeStyle = 'rgba(40,20,8,0.18)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, r * 0.6, r * 1.8, 0, 0, 7); g.stroke(); } }
      g.fillStyle = 'rgba(20,10,5,0.55)'; g.fillRect(p * pw + pw - 3, 0, 3, h); }
  });
  wood.repeat.set(4, 4); const tm = new THREE.MeshStandardMaterial({ map: wood, color: new THREE.Color(0.66, 0.68, 1.45), roughness: 0.42, metalness: 0.0 }); K.detail(tm);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(4800, 4800), tm); table.rotation.x = -Math.PI / 2; table.position.set(0, -0.05, 0); table.rotation.z = Math.PI / 2; table.receiveShadow = true; scene.add(table);
  // table edge + room backdrop
  const edge = new THREE.Mesh(new THREE.BoxGeometry(4800, 60, 4800), new THREE.MeshStandardMaterial({ color: '#3a2214', roughness: 0.6 })); edge.position.y = -30.1; scene.add(edge);
  const wall = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: {}, vertexShader: 'varying vec3 vP; void main(){ vP = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float y = d.y; float a = atan(d.z, d.x);
      vec3 paper = mix(vec3(0.42, 0.30, 0.22), vec3(0.78, 0.66, 0.50), smoothstep(-0.05, 0.35, y));
      float stripe = step(0.5, fract(a * 40.0)); paper *= 0.96 + 0.04 * stripe;
      float win = smoothstep(0.32, 0.28, abs(a - 2.4)) * smoothstep(0.05, 0.12, y) * smoothstep(0.55, 0.45, y);
      paper = mix(paper, vec3(1.0, 0.95, 0.82), win * 0.85);
      gl_FragColor = vec4(paper * (y < 0.0 ? 0.35 : 1.0), 1.0); }` });
  const room = new THREE.Mesh(new THREE.SphereGeometry(5200, 48, 24), wall); room.renderOrder = -10; room.frustumCulled = false; scene.add(room);
  scene.fog = new THREE.Fog('#4a3426', 1400, 5200);
  // scattered confetti and a pencil on the table
  const G = geoKit('paper'); const R = rng(11); const conf = [];
  for (let i = 0; i < 70; i++) { const a = R() * 6.283, d = 380 + R() * 500; conf.push({ p: [Math.cos(a) * d, 0.2, Math.sin(a) * d * 0.8 + 8], ry: R() * 6, s: [6 + R() * 6, 1, 6 + R() * 6], c: ['#e0473a', '#f2b631', '#2aa39a', '#f28fab', '#3d74c4', '#f8ecd2'][i % 6] }); }
  const cg = new THREE.CylinderGeometry(1, 1, 0.3, 5); scene.add(new Inst(tint(cg, '#fff'), K.IM(), conf, { cast: true }).mesh);
  const pencil = new THREE.Group(); pencil.position.set(420, 9, -150); pencil.rotation.y = 0.5; scene.add(pencil);
  const pb = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 420, 6), K.M('#F2B631', { flat: true })); pb.rotation.z = Math.PI / 2; pb.castShadow = true; pencil.add(pb);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(9, 40, 6), K.M('#E8C9A0', { flat: true })); tip.rotation.z = -Math.PI / 2; tip.position.x = 230; tip.castShadow = true; pencil.add(tip);
  const er = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 30, 12), K.M('#F28FAB')); er.rotation.z = Math.PI / 2; er.position.x = -225; pencil.add(er);
}

// =====================================================================================================
// 01: ticket unfolds into the paper park
// =====================================================================================================
async function setup01(ctx) {
  const { W, scene, K, park, shot, post } = ctx; const A = 200, B = 96, PT = 0.4;
  const ticket = await new THREE.TextureLoader().loadAsync('/plan/ticket_print.png'); ticket.colorSpace = THREE.SRGBColorSpace; ticket.anisotropy = 8;
  const back = canvasTex(1024, 512, (g, w, h) => { g.fillStyle = '#efe2c4'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,90,70,0.28)'; g.lineWidth = 6; for (let x = -h; x < w; x += 44) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); } g.strokeStyle = 'rgba(200,90,70,0.5)'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28); });
  const root = new THREE.Group(); root.position.set(0, 0, 8); scene.add(root);
  const mapMat = new THREE.MeshStandardMaterial({ map: W.baseTex, roughness: 0.92 }); K.detail(mapMat);
  const sideM = K.M('#f3e6c8'); const backM = new THREE.MeshStandardMaterial({ map: back, roughness: 0.92 }); K.detail(backM); const tickM = new THREE.MeshStandardMaterial({ map: ticket, roughness: 0.9 }); K.detail(tickM);
  const makePanel = (col, row) => {
    const g = new THREE.BoxGeometry(A, PT, B); g.translate(0, PT / 2, 0); const cx = col * A, cz = row * B; const uv = g.attributes.uv, pos = g.attributes.position;
    const isT = col === -1 && row === 0;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; const x = pos.getX(i), z = pos.getZ(i);
      if (f === 2) uv.setXY(i, (cx + x + 300) / 600, 1 - (cz + z + 8 + 232) / 480);
      else if (f === 3) { if (isT) uv.setXY(i, 0.5 - x / A, 0.5 - z / B); else uv.setXY(i, x / A + 0.5, z / B + 0.5); } }
    const m = new THREE.Mesh(g, [sideM, sideM, mapMat, isT ? tickM : backM, sideM, sideM]); m.castShadow = true; m.receiveShadow = true; return m;
  };
  const PANEL = {}; const colP = { '-1': 7.5 * PT, '1': 5 * PT }; const rowP = { '1': 1.5 * PT, '-1': 2.5 * PT, '2': PT, '-2': PT };
  const buildColumn = (col, parent) => { const base = new THREE.Group(); parent.add(base); base.add(makePanel(col, 0));
    for (const sgn of [1, -1]) { const piv1 = new THREE.Group(); piv1.position.set(0, rowP[sgn], sgn * B / 2); base.add(piv1); const g1 = new THREE.Group(); g1.position.set(0, -rowP[sgn], sgn * B / 2); piv1.add(g1); g1.add(makePanel(col, sgn));
      const piv2 = new THREE.Group(); piv2.position.set(0, rowP[sgn * 2], sgn * B / 2); g1.add(piv2); const g2 = new THREE.Group(); g2.position.set(0, -rowP[sgn * 2], sgn * B / 2); piv2.add(g2); g2.add(makePanel(col, sgn * 2));
      PANEL[col + ',' + sgn] = { piv: piv1, fold: sgn > 0 ? -Math.PI : Math.PI }; PANEL[col + ',' + sgn * 2] = { piv: piv2, fold: sgn > 0 ? -Math.PI : Math.PI }; } };
  buildColumn(0, root); const colPiv = {};
  for (const col of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(col * A / 2, colP[col], 0); root.add(piv); const g = new THREE.Group(); g.position.set(col * A / 2, -colP[col], 0); piv.add(g); buildColumn(col, g); colPiv[col] = piv; }
  const TL = { L: [0.0, 0.3], R: [0.18, 0.5], r1: [0.62, 1.0], r2: [1.12, 1.5] };
  const foldAng = (t, [a, b], fold) => { const u = eInOut((t - a) / (b - a)); const fl = clamp((t - b) / 0.22); const flop = Math.sin(fl * Math.PI) * 0.05 * (1 - fl); return fold * (1 - u) + Math.sign(fold) * (t > b ? flop : 0); };
  const flatT = (x, z) => { const col = clamp(Math.round(x / A), -1, 1), row = clamp(Math.round((z - 8) / B), -2, 2); const c = col === 0 ? 0 : col < 0 ? TL.L[1] : TL.R[1]; const r = row === 0 ? 0 : Math.abs(row) === 1 ? TL.r1[1] : TL.r2[1]; return Math.max(c, r); };
  const popStart = (x, z) => Math.max(flatT(x, z) + 0.05, 2.0 + Math.hypot(x, z) / 250);
  const PRI = { observation_tower: 2.0, ferris_wheel: 2.12, carousel: 2.12, hero_coaster: 3.0, wooden_coaster: 3.08, family_coaster: 3.16, log_flume: 3.22, river_rapids: 3.25, railway: 2.6 };
  const pspring = (lt, dur = 0.42) => lt <= 0 ? 0 : 1 - Math.exp(-5.2 * lt / dur) * Math.cos(9.5 * lt / dur);
  const HINGE = /tree|lamp|flag|sign|fence|bunting|lights|queue|blooms|leaves/;
  for (const [name, inst] of allSets(W)) for (const it of inst.items) { it.t0 = popStart(it.x ?? it.p[0], it.z ?? it.p[2]) + hash1((it.x || 0) * 3.1 + (it.z || 0)) * 0.06; it.hinge = HINGE.test(name) || HINGE.test(inst.mesh.userData.cat || ''); }
  for (const p of W.pieces) { const i = p.userData.piece; i.t0 = PRI[i.id] ?? popStart(i.x, i.z); }
  // paper clouds + sun on sticks
  const clouds = new THREE.Group(); scene.add(clouds); const cl = [];
  const cloudPts = (s, seed) => { const R = rng(seed); const pts = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI; const r = (0.55 + 0.25 * Math.abs(Math.sin(i * 1.3 + seed))) * s; pts.push([Math.cos(a) * s * 1.6, Math.sin(a) * r * 0.9 + (R() - 0.5) * s * 0.05]); } return pts; };
  for (const [x, y, z, s, seed] of [[-210, 95, -205, 22, 1], [-40, 118, -224, 28, 2], [150, 100, -212, 24, 3], [262, 82, -110, 18, 4], [-270, 78, -60, 17, 5]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); clouds.add(g); const sh = new THREE.Shape(cloudPts(s, seed).map(p => new THREE.Vector2(p[0], p[1])));
    const cm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false, curveSegments: 6 }), [K.M('#FFFAF0'), K.edge('#FFFAF0')]); cm.position.y = y; cm.castShadow = true; g.add(cm);
    const cm2 = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(cloudPts(s * 0.6, seed + 5).map(p => new THREE.Vector2(p[0] - s * 0.3, p[1] + s * 0.05))), { depth: 0.8, bevelEnabled: false }), [K.M('#FFFFFF'), K.edge('#ffffff')]); cm2.position.set(0, y, 1.3); g.add(cm2);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.8, y, 0.8), K.M('#d8cdbd')); st.position.y = y / 2; st.castShadow = true; g.add(st); g.rotation.y = 0.35; cl.push({ g, t0: 2.5 + seed * 0.07, x, z, seed }); }
  { const g = new THREE.Group(); g.position.set(-250, 0, -200); clouds.add(g); const pts = []; for (let i = 0; i < 32; i++) { const a = i / 32 * 6.283; const r = i % 2 ? 13 : 18; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); } const sm = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 1, bevelEnabled: false }), [K.M('#F2B631'), K.edge('#F2B631')]); sm.position.y = 128; g.add(sm); const sc = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1.4, 24), K.M('#F48B37')); sc.rotation.x = Math.PI / 2; sc.position.set(0, 128, 1); g.add(sc); const st = new THREE.Mesh(new THREE.BoxGeometry(0.8, 128, 0.8), K.M('#d8cdbd')); st.position.y = 64; st.castShadow = true; g.add(st); g.rotation.y = 0.35; cl.push({ g, t0: 2.45, sun: sm }); }
  const trains = W.trains;
  return {
    update(t) {
      colPiv[-1].rotation.z = foldAng(t, TL.L, -Math.PI); colPiv[1].rotation.z = foldAng(t, TL.R, Math.PI);
      for (const col of [-1, 0, 1]) for (const r of [1, -1, 2, -2]) { const p = PANEL[col + ',' + r]; p.piv.rotation.x = foldAng(t, Math.abs(r) === 1 ? TL.r1 : TL.r2, p.fold); }
      root.position.y = 2.0 * Math.sin(clamp((t - 0.0) / 0.5) * Math.PI);
      // pop-ups
      for (const [name, inst] of allSets(W)) inst.update((it, i, P, Q, Sv) => { const lt = t - it.t0; if (lt <= 0) return false; const s = pspring(lt); if (it.hinge) return hingeM((1 - s) * Math.PI / 2); return growM(s, lerp(0.6, 1, Math.min(1, s))); });
      for (const p of W.pieces) { const i = p.userData.piece; const lt = t - i.t0; const w = i.wrapper; if (!w) continue; w.visible = lt > 0; if (lt <= 0) continue;
        if (i.cat === 'track') { const u = lt / 0.55; const s = 1 - Math.exp(-4.2 * u) * Math.cos(10 * u); setWrap(i, growM(Math.max(0.002, s), 1)); i.s = s; }
        else { const s = pspring(lt, i.kind === 'ferris_wheel' ? 0.5 : 0.42); setWrap(i, i.kind === 'ferris_wheel' || i.id === 'bridge' ? new THREE.Matrix4().makeRotationX(-(1 - s) * Math.PI / 2) : growM(s, lerp(0.6, 1, Math.min(1, s)))); } }
      for (const a of W.anims) a(t, {});
      updateTrains(W, t, shot, { carXform: (T, car) => { const tp = W.pieces.find(p => p.userData.piece.id === T.r.id); const i = tp && tp.userData.piece; const s = i ? (t > i.t0 ? clamp(i.s ?? 1, 0, 1.3) : 0) : 1; car.g.visible = s > 0.85; car.g.position.y *= Math.max(0.001, s); } });
      updateGuests(W, t, { pop: g => { const lt = t - (popStart(g.x, g.z) + 0.1 + hash1(g.id) * 0.1); return lt <= 0 ? 0 : pspring(lt, 0.35); } });
      for (const c of cl) { const lt = t - c.t0; c.g.visible = lt > 0; if (lt > 0) { const s = pspring(lt, 0.5); c.g.rotation.x = -(1 - s) * Math.PI / 2; if (c.sun) c.sun.rotation.z = t * 0.4; else c.g.children[0].position.x = Math.sin(t * 0.9 + c.seed) * 3; } }
      // flags flutter after 3.5
      if (W.flags) W.flags.update((it, i, P, Q) => { const lt = t - (it.t0 ?? 0); if (lt <= 0) return false; Q.setFromEuler(new THREE.Euler(0, 0.6 + Math.sin(t * 7 + i) * 0.25 * sstep(3.3, 3.6, t), 0)); return hingeM((1 - pspring(lt)) * Math.PI / 2); });
      // depth of field: shallow on the ticket early, deep later
      post.u.focus.value = Math.hypot(...park.camera(shot, t).position.map((v, k) => v - [0, 0, 8][k]));
      post.u.aperture.value = lerp(0.03, 0.0, sstep(1.0, 2.2, t)); post.u.maxCoc.value = 14;
    },
    shadow(t, c) { return { center: new THREE.Vector3(0, 0, 8), radius: lerp(140, 340, sstep(0.0, 1.6, t)) }; },
  };
}

// =====================================================================================================
// POV shots (10 paper, 11 felt, 14 tin)
// =====================================================================================================
function setupPOV(ctx, o) {
  const { W, park, shot, S } = ctx; const tf = shot.render.on_twos;
  const R = W.riderParts;
  return {
    mblur: o.mblur,
    update(t, c) {
      if (S === 'felt') { const k = Math.round(t * 15); const br = rng(k * 97 + 3); ctx.boilU.value.set(br() * 0.3, br() * 0.3, br() * 0.3); }
      for (const a of W.anims) a(t, {});
      updateTrains(W, t, shot, { armsUp: rd => rd.ride === 'hero_coaster' && rd.train === 0, povHideHeads: true });
      updateGuests(W, t, { offset: () => [0, W.slab, 0, 1] });
    },
    shadow(t, c) { const p = new THREE.Vector3(...c.position), tg = new THREE.Vector3(...c.target); const d = tg.clone().sub(p).setY(0).normalize(); const ctr = p.clone().addScaledVector(d, 70).setY(0); return { center: ctr, radius: 130 }; },
  };
}

// =====================================================================================================
// 03: felt applique puffs up
// =====================================================================================================
function setup03(ctx) {
  const { W, park, shot, post } = ctx;
  const v = new THREE.Vector3(-0.72, 0, -0.69).normalize(); // fall direction (away from camera)
  const fc = [-80, 95];
  const k8 = (x, z) => Math.min(3, Math.floor(Math.hypot(x - fc[0], z - fc[1]) / 45));
  const T0 = { kiddie_planes: 8.5, kiddie_boats: 9.0, playground: 9.0, kiddie_trucks: 9.5, kiddie_drop: 9.5, family_coaster: 10.5 };
  for (const p of W.pieces) { const i = p.userData.piece; i.t0 = T0[i.id] ?? (10.0 + 0.125 * k8(i.x, i.z) + hash1(i.x) * 0.05); i.mode = i.cat === 'track' ? 'squash' : 'lay'; }
  for (const [name, inst] of allSets(W)) for (const it of inst.items) { const x = it.x ?? it.p[0], z = it.z ?? it.p[2]; it.t0 = 10.0 + 0.125 * k8(x, z) + hash1(x * 1.3 + z) * 0.06; it.mode = /pennant|strings|bulbs|blooms/.test(name) ? 'squash' : 'lay'; }
  // queue + station of the family coaster puff with it
  const puff = (t, t0, mode) => { const lt = (t - t0) / 0.5; if (mode === 'squash') { const s = lt <= 0 ? 0.04 : lerp(0.04, 1, spring(lt, 5.5, 9.5)); return new THREE.Matrix4().makeScale(1 + (lt > 0 ? Math.sin(clamp(lt) * Math.PI) * 0.05 : 0), Math.max(0.03, s), 1 + (lt > 0 ? Math.sin(clamp(lt) * Math.PI) * 0.05 : 0)); }
    const stand = lt <= 0 ? 0 : clamp(eOutBack(lt * 1.25, 1.6), 0, 1.15); const depth = lt <= 0 ? 0.08 : lerp(0.08, 1, clamp(spring(lt, 5, 10), 0, 1.3)); const sq = lt <= 0 ? 0 : Math.sin(lt * 9) * Math.exp(-lt * 4) * 0.1; return layM(1 - stand, depth, sq, v); };
  const famT = W.trains.find(T => T.r.id === 'family_coaster');
  return {
    update(t) {
      const k = Math.round(t * 15); const br = rng(k * 97 + 3); ctx.boilU.value.set(br() * 0.3, br() * 0.3, br() * 0.3);
      for (const p of W.pieces) { const i = p.userData.piece; if (!i.wrapper) continue; let m = puff(t, i.t0, i.mode); const j = new THREE.Matrix4().makeRotationY((br() - 0.5) * 0.01); m.premultiply(j); setWrap(i, m); }
      for (const [name, inst] of allSets(W)) inst.update(it => puff(t, it.t0, it.mode));
      const moving = t >= 11.5; const ctxA = { frozen: () => !moving, clock: tt => tt };
      for (const a of W.anims) a(t, ctxA);
      updateTrains(W, t, shot, { trainFronts: (T, fr, tt) => T.r.id === 'family_coaster' ? [T.tr.sAtTime(Math.max(0, park.rideTime('family_coaster', t, 0, shot)))] : fr,
        carXform: (T, car) => { if (T.r.id === 'family_coaster') { const lt = (t - 10.5) / 0.5; const s = lt <= 0 ? 0.04 : lerp(0.04, 1, spring(lt, 5.5, 9.5)); car.g.position.y *= Math.max(0.03, s); car.g.scale.y = Math.max(0.03, s); } } });
      updateGuests(W, t, { moving, offset: () => [0, W.slab, 0, 1], puff: g => { const lt = (t - 11.0 - hash1(g.id) * 0.2) / 0.35; const lay = lt < 0 ? 1 : 1 - eOutBack(lt, 2.2); const flat = lt < 0 ? 0.15 : lerp(0.15, 1, clamp(spring(lt, 5, 10), 0, 1.3)); return { lay: clamp(lay, -0.1, 1), flat }; } });
      // focus: macro on the family coaster station
      const c = park.camera(shot, t); post.u.focus.value = Math.hypot(c.position[0] + 83, c.position[1] - 4, c.position[2] - 93); post.u.aperture.value = 0.011; post.u.maxCoc.value = 12;
    },
    shadow(t, c) { return { center: new THREE.Vector3(-78, 0, 92), radius: 120 }; },
  };
}

// =====================================================================================================
// 06: tin toy box opens on the midway, wind-up key, clockwork
// =====================================================================================================
function setup06(ctx) {
  const { W, scene, K, park, shot, post, S } = ctx; const G = geoKit('tin');
  const BX = 120, BZ = 62, BW = 70, BD = 46, BH = 30, TH = 0.5;
  const inBox = (x, z) => x > 52 && x < 188 && z > 12 && z < 130 && !(x < 60 && z > 110);
  // ---- lithographed box textures
  // lithographed tin printed to look like a wooden crate (matches the pixel crate of shot 05): planks, frame, star panels, wear
  const woodPrint = (g, x0, y0, w, h, R, vertical) => { const n = vertical ? Math.round(w / 64) : Math.round(h / 64); for (let i = 0; i < n; i++) { const c = ['#B9824C', '#C48E57', '#AE7743', '#BF8A52'][i % 4]; g.fillStyle = c; if (vertical) g.fillRect(x0 + i * w / n, y0, w / n, h); else g.fillRect(x0, y0 + i * h / n, w, h / n);
      g.strokeStyle = 'rgba(80,45,20,0.35)'; g.lineWidth = 1.2; for (let k = 0; k < 14; k++) { g.beginPath(); if (vertical) { const x = x0 + i * w / n + R() * w / n; g.moveTo(x, y0); for (let y = y0; y <= y0 + h; y += 16) g.lineTo(x + Math.sin(y / 40 + k) * 3, y); } else { const y = y0 + i * h / n + R() * h / n; g.moveTo(x0, y); for (let x = x0; x <= x0 + w; x += 16) g.lineTo(x, y + Math.sin(x / 40 + k) * 3); } g.stroke(); }
      g.fillStyle = 'rgba(60,30,10,0.5)'; if (vertical) g.fillRect(x0 + (i + 1) * w / n - 2, y0, 3, h); else g.fillRect(x0, y0 + (i + 1) * h / n - 2, w, 3); } };
  const lithoSide = (seed, star) => canvasTex(1024, 512, (g, w, h) => {
    const R = rng(seed); woodPrint(g, 0, 0, w, h, R, false);
    g.fillStyle = '#7A4A26'; g.fillRect(0, 0, w, 34); g.fillRect(0, h - 34, w, 34); g.fillRect(0, 0, 34, h); g.fillRect(w - 34, 0, 34, h); g.fillRect(w / 2 - 17, 0, 34, h);
    g.fillStyle = '#C63A2C'; g.fillRect(0, 0, w, 12); // red top edge stripe
    for (const [cx, k] of [[w / 4, 0], [3 * w / 4, 1]]) { const col = star[k]; if (!col) continue; g.fillStyle = 'rgba(60,30,10,0.35)'; starPath(g, cx + 6, h / 2 + 8, 150); g.fill(); g.fillStyle = col; starPath(g, cx, h / 2, 150); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; starPath(g, cx - 20, h / 2 - 25, 60); g.fill();
      g.strokeStyle = '#F2E4C4'; g.lineWidth = 5; g.setLineDash([14, 10]); g.strokeRect(cx - w / 4 + 60, 60, w / 2 - 120, h - 120); g.setLineDash([]); }
    // nail heads + wear + halftone
    g.fillStyle = '#5a3a20'; for (const x of [17, w / 2, w - 17]) for (let y = 40; y < h; y += 70) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    for (let i = 0; i < 160; i++) { const e = R() < 0.8; const x = e ? (R() < 0.5 ? R() * 18 : w - R() * 18) : R() * w, y = R() * h; g.fillStyle = 'rgba(215,210,200,0.9)'; g.beginPath(); g.ellipse(x, y, 2 + R() * 5, 1 + R() * 3, R() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 0.07; for (let i = 0; i < 9000; i++) { g.fillStyle = R() < 0.5 ? '#000' : '#fff'; g.fillRect(R() * w, R() * h, 2, 2); } g.globalAlpha = 1;
  }, { repeat: false });
  const lidTex = canvasTex(1024, 1024, (g, w, h) => { const R = rng(4); woodPrint(g, 0, 0, w, h, R, true); g.fillStyle = '#C63A2C'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26); g.fillRect(0, 0, 26, h); g.fillRect(w - 26, 0, 26, h);
    g.fillStyle = '#7A4A26'; g.fillRect(26, h / 2 - 22, w - 52, 44);
    g.fillStyle = '#2E2A50'; g.beginPath(); g.arc(w / 2, h / 2, 230, 0, 7); g.fill(); g.strokeStyle = '#E3A537'; g.lineWidth = 12; g.beginPath(); g.arc(w / 2, h / 2, 205, 0, 7); g.stroke(); g.fillStyle = '#F2B631'; starPath(g, w / 2, h / 2, 170); g.fill();
    for (const [x, y, c] of [[200, 200, '#2E6FD0'], [w - 200, 200, '#C63A2C'], [200, h - 200, '#C63A2C'], [w - 200, h - 200, '#2E6FD0']]) { g.fillStyle = c; starPath(g, x, y, 70); g.fill(); }
    for (let i = 0; i < 200; i++) { const x = R() < 0.5 ? R() * 25 : w - R() * 25, y = R() * h; g.fillStyle = 'rgba(215,210,200,0.9)'; g.beginPath(); g.ellipse(R() < 0.5 ? x : y, R() < 0.5 ? y : x, 2 + R() * 5, 1 + R() * 3, R() * 3, 0, 7); g.fill(); } }, { repeat: false });
  const tinM = (map) => { const m = new THREE.MeshPhysicalMaterial({ map, metalness: 0.55, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.12 }); m.metalnessMap = K.mr('#C63A2C|box'); m.roughnessMap = m.metalnessMap; m.envMapIntensity = 0.8; K.detail(m); return m; };
  const innerM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  patchMaterial(innerM, { ground: W.groundMat.userData.gU, detail: K.det, detailScale: K.detScale, detailStrength: K.detK * 0.6, key: 'inner', fragHook: fs => fs.replace('#include <color_fragment>', `#include <color_fragment>
    { float k = smoothstep(0.55, 0.95, vWN.y); float a = fract((vWP.x + vWP.z) * 0.18); vec3 st = mix(vec3(0.95, 0.89, 0.76), vec3(0.78, 0.23, 0.17), step(0.5, a));
      st = mix(st, vec3(0.14, 0.23, 0.4), step(0.9, fract(vWP.y * 0.08))); diffuseColor.rgb = mix(st, diffuseColor.rgb, k); }`) });
  const inner = W.roiTex; const box = new THREE.Group(); box.position.set(BX, 0, BZ); scene.add(box);
  // wall: hinged at its bottom outer edge; inner face uses the ground print at its fallen position
  const walls = []; const capGroup = new THREE.Group(); box.add(capGroup);
  const mkWall = (len, axis, sgn, tex) => { // axis 'z' -> wall along x at z = sgn*BD/2 ; 'x' -> wall along z at x = sgn*BW/2
    const piv = new THREE.Group(); box.add(piv); const geo = new THREE.BoxGeometry(len, BH, TH); geo.translate(0, BH / 2, -TH / 2);
    // inner face (+z local before orientation) gets ground uv of its flat landing spot
    const m = new THREE.Mesh(geo, [tinM(tex), tinM(tex), tinM(tex), tinM(tex), innerM, tinM(tex)]); m.castShadow = m.receiveShadow = true;
    const holder = new THREE.Group(); holder.add(m); piv.add(holder);
    if (axis === 'z') { piv.position.set(0, 0, sgn * BD / 2); holder.rotation.y = sgn > 0 ? Math.PI : 0; }
    else { piv.position.set(sgn * BW / 2, 0, 0); holder.rotation.y = sgn > 0 ? -Math.PI / 2 : Math.PI / 2; }
    walls.push({ piv, axis, sgn, m }); return piv; };
  mkWall(BW, 'z', 1, lithoSide(1, ['#2E6FD0', '#C63A2C'])); mkWall(BW, 'z', -1, lithoSide(2, ['#C63A2C', '#2E6FD0'])); mkWall(BD, 'x', 1, lithoSide(3, ['#8A5A30', '#2E6FD0'])); mkWall(BD, 'x', -1, lithoSide(4, ['#2E6FD0', '#8A5A30']));
  // chrome corner caps (stamped tin brackets)
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (const cy of [1.6, BH - 1.6]) { const cap = new THREE.Mesh(G.box(3.4, 3.4, 3.4, 0.5), K.M('#C9CED6', { kind: 'chrome' })); cap.position.set(cx * (BW / 2 + 0.2), cy, cz * (BD / 2 + 0.2)); cap.castShadow = true; capGroup.add(cap); }
  // ground material samples world xz, so the inner face shows the midway print once flat. Floor is the ground itself.
  const lidPiv = new THREE.Group(); lidPiv.position.set(0, BH, 0); walls[1].piv.add(lidPiv);
  const lidSide = tinM(canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#7A4A26'; g.fillRect(0, 0, w, h); g.fillStyle = '#C63A2C'; g.fillRect(0, h - 14, w, 14); }, { repeat: false }));
  const lid = new THREE.Mesh(G.box(BW + 1.2, 1.2, BD + 1.2, 0.25), [lidSide, lidSide, tinM(lidTex), innerM, lidSide, lidSide]); lid.position.set(0, 0.6, BD / 2); lid.castShadow = true; lidPiv.add(lid);
  // rim band & corner rivets (tin construction details)
  const rimM = K.M('#E3A537', { pattern: 'plain', forceMap: true });
  // ---- clockwork motor box with brass key
  const motor = new THREE.Group(); motor.position.set(176, 0, 84); scene.add(motor);
  { const body = new THREE.Mesh(G.box(10, 7, 8, 0.4), K.M('#233a66', { pattern: 'gears', acc: '#E3A537' })); body.castShadow = body.receiveShadow = true; body.position.y = 3.5; motor.add(body); }
  const mtop = new THREE.Mesh(G.box(10.6, 0.6, 8.6, 0.2), K.M('#C63A2C', { pattern: 'check', acc: '#F2E4C4' })); mtop.position.y = 7.2; mtop.castShadow = true; motor.add(mtop);
  const rv = []; for (let i = 0; i < 8; i++) rv.push([-4.6 + i * 9.2 / 7, 6.6, 4.05], [-4.6 + i * 9.2 / 7, 0.5, 4.05]); const rvi = new Inst(new THREE.SphereGeometry(0.16, 8, 6), K.M('#fff', { kind: 'chrome' }), rv.map(p => ({ p }))); motor.add(rvi.mesh);
  const brass = K.M('#d9a948', { kind: 'brass' });
  const keyG = new THREE.Group(); keyG.position.set(0, 4.5, 4.0); motor.add(keyG); const key = new THREE.Group(); keyG.add(key);
  { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.2, 16), brass); sh.rotation.x = Math.PI / 2; sh.position.z = 1.1; key.add(sh); const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 20), brass); col.rotation.x = Math.PI / 2; col.position.z = 2.0; key.add(col);
    for (const s of [-1, 1]) { const lobe = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.36, 12, 32), brass); lobe.position.set(s * 1.5, 0, 2.5); lobe.scale.set(1, 1, 0.7); key.add(lobe); const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.22, 24), brass); fill.rotation.x = Math.PI / 2; fill.position.set(s * 1.5, 0, 2.5); key.add(fill); }
    const hub = new THREE.Mesh(G.box(1.2, 0.9, 0.5, 0.2), brass); hub.position.z = 2.5; key.add(hub); key.traverse(o => { if (o.isMesh) o.castShadow = true; }); }
  const gear = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 24), brass); gear.position.set(-2, 7.8, 0); motor.add(gear); const gear2 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.5, 18), K.M('#fff', { kind: 'chrome' })); gear2.position.set(0.7, 7.8, 0.6); motor.add(gear2);
  for (const gg of [gear, gear2]) { for (let k = 0; k < 14; k++) { const tth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), gg.material); const a = k / 14 * 6.283; const r = gg.geometry.parameters.radiusTop; tth.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); gg.add(tth); } }
  // ---- schedule for pieces in the box
  const land = { carousel: 21.0, teacups: 21.25, bumper_cars: 21.5, food_court_pavilion: 22.0 };
  const ctr = new THREE.Vector3(BX, 12, BZ);
  const boothsX = W.pieces.filter(p => p.userData.piece.kind === 'booth').map(p => p.userData.piece.x).sort((a, b) => a - b);
  for (const p of W.pieces) { const i = p.userData.piece; i.inBox = inBox(i.x, i.z) && i.cat !== 'track';
    if (!i.inBox) continue; i.t1 = land[i.id] ?? (i.kind === 'booth' ? 21.75 + boothsX.indexOf(i.x) % 16 * (0.25 / 16) : 22.0 + hash1(i.x) * 0.2); }
  const HIDE_T = [[168.21, 78.44], [179.23, 87.29], [182.12, 90.21], [175.79, 102.78], [183.96, 104.12], [193.11, 101.3]]; // trees colliding with the clockwork set / camera
  for (const [name, inst] of allSets(W)) for (const it of inst.items) { const x = it.x ?? it.p[0], z = it.z ?? it.p[2]; const isTree = /tree/.test(name) || /tree/.test(inst.mesh.userData.cat || '');
    it.inBox = inBox(x, z) && !/tree|shrub|hedge|topiary|blooms|leaves/.test(name) && !isTree; it.t1 = 22.0 + hash1(x * 1.7 + z) * 0.25;
    if (isTree && x > 84 && x < 156 && z > 38 && z < 86) { it.inBox = true; it.t1 = 21.9 + hash1(x) * 0.2; }
    if (isTree && HIDE_T.some(([a, b]) => Math.abs(a - x) < 0.05 && Math.abs(b - z) < 0.05)) it.hideT = true; }
  const jumble = new THREE.Matrix4();
  // flight from the box: pre-matrix relative to the item's base
  const flight = (t, t1, base, dur = 0.45, arcH = 18) => { const lt = (t - (t1 - dur)) / dur;
    if (t < 20.55 || lt < 0) return null; // still inside
    if (lt < 1) { const u = lt; const pos = new THREE.Vector3().lerpVectors(ctr, base, u); pos.y += arcH * 4 * u * (1 - u); const sc = lerp(0.3, 1, eOutBack(u, 1.4)); const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((1 - eOutCubic(u)) * 1.2, (1 - u) * 2.5, (1 - eOutCubic(u)) * -0.8));
      return new THREE.Matrix4().makeTranslation(pos.x - base.x, pos.y - base.y, pos.z - base.z).multiply(rot).multiply(new THREE.Matrix4().makeScale(sc, sc, sc)); }
    const b = (lt - 1) * dur; const hop = Math.abs(Math.sin(b * 16)) * 1.0 * Math.exp(-b * 9); const sq = Math.sin(b * 28) * Math.exp(-b * 8) * 0.12;
    return new THREE.Matrix4().makeTranslation(0, hop + TH * 0.6, 0).multiply(new THREE.Matrix4().makeScale(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6)); };
  const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
  const tickClock = t => { if (t < 23.25) return 0; const u = (t - 23.25) * 6; const f = Math.floor(u), fr = u - f; return (f + smooth(clamp(fr / 0.35))) / 6 * 1.0; };
  const guestsT = new Map(); for (const g of W.guests) if (inBox(g.x, g.z)) guestsT.set(g.id, 22.0 + hash1(g.id * 3.7) * 0.4);
  return {
    update(t, c) {
      // box hops at 20.0 and 20.25
      let hy = 0, hs = 0; for (const h0 of [20.0, 20.25]) { const u = (t - h0) / 0.22; if (u > 0 && u < 1) hy += Math.sin(u * Math.PI) * 2.2; const v2 = (t - h0 - 0.22) / 0.12; if (v2 > 0 && v2 < 1) hs += Math.sin(v2 * Math.PI) * 0.06; }
      const rattle = t < 20.5 && t > 19.9 ? Math.sin(t * 70) * 0.006 : 0;
      box.position.y = hy; box.scale.set(1 + hs, 1 - hs, 1 + hs); box.rotation.z = rattle; box.rotation.x = rattle * 0.7;
      // lid: flips open from 20.5, then lies flat beyond the north wall when the walls fall
      const la = eOutBack((t - 20.5) / 0.32, 1.3) * 1.95; const lf = eOutBounce((t - 21.0) / 0.4);
      lidPiv.rotation.x = -(t < 20.5 ? 0 : lerp(la, Math.PI / 2, lf));
      // walls fall flat with a bounce at 21.0
      const wf = eOutBounce((t - 20.62) / 0.38) * Math.PI / 2;
      for (const w of walls) { if (w.axis === 'z') w.piv.rotation.x = w.sgn * wf; else w.piv.rotation.z = -w.sgn * wf; }
      capGroup.visible = t < 20.62; 
      // pieces
      for (const p of W.pieces) { const i = p.userData.piece; if (!i.wrapper) continue; if (!i.inBox) { setWrap(i, null); continue; } const m = flight(t, i.t1, i.wrapper.userData.base, 0.45, i.kind === 'booth' ? 10 : 22); i.wrapper.visible = !!m; if (m) setWrap(i, m); }
      for (const [name, inst] of allSets(W)) inst.update((it) => { if (it.hideT) return false; if (!it.inBox) return null; const m = flight(t, it.t1, new THREE.Vector3(...it.p), 0.4, 8); return m || false; });
      // motor: bumped up by the east wall landing
      const bump = t > 20.95 ? Math.abs(Math.sin((t - 20.95) * 14)) * Math.exp(-(t - 20.95) * 7) * 1.6 : 0; motor.position.y = bump;
      // key: 6 ratchet clicks on 8ths 22.5..23.25 -> 1.5 turns; then slowly unwinds while running
      let ka = 0; for (let k = 0; k < 6; k++) { const u = (t - (22.5 + k * 0.125)) / 0.1; if (u > 0) ka += eOutBack(clamp(u), 2.2) * Math.PI / 2; }
      if (t > 23.25) ka -= (t - 23.25) * 1.2; key.rotation.z = -ka; keyG.position.z = 4.0 + ((t > 22.5 && t < 23.25) ? Math.abs(Math.sin((t - 22.5) * 8 * Math.PI)) * 0.08 : 0);
      const tc = tickClock(t); gear.rotation.y = tc * 4; gear2.rotation.y = -tc * 6.4;
      const running = t >= 23.25;
      const ctxA = { frozen: () => !running, clock: () => 30 + tc * 6 };
      for (const a of W.anims) a(t, ctxA);
      updateTrains(W, t, shot, {});
      updateGuests(W, t, { moving: true, offset: (g) => { const t1 = guestsT.get(g.id); if (t1 === undefined) return [0, 0, 0, 1]; const lt = (t - t1) / 0.4; if (lt < 0) return [BX - g.x, -50, BZ - g.z, 0]; if (lt < 1) { const u = lt; return [(BX - g.x) * (1 - u), 12 * (1 - u) + 10 * 4 * u * (1 - u) + TH, (BZ - g.z) * (1 - u), lerp(0.4, 1, eOutBack(u, 2))]; } return [0, TH + Math.abs(Math.sin((lt - 1) * 6)) * 0.4 * Math.exp(-(lt - 1) * 3), 0, 1]; } });
      // focus: box, then pull to the key at 22.4
      const cp = park.camera(shot, t).position; const fb = Math.hypot(cp[0] - 120, cp[1] - 6, cp[2] - 62), fk = Math.hypot(cp[0] - 176, cp[1] - 4.5, cp[2] - 88.5);
      post.u.focus.value = lerp(fb, fk, sstep(22.25, 22.6, t)); post.u.aperture.value = lerp(0.009, 0.004, sstep(23.4, 24.0, t)); post.u.maxCoc.value = 12;
    },
    shadow(t, c) { const k = sstep(22.2, 22.7, t); return { center: new THREE.Vector3(lerp(122, 172, k), 0, lerp(66, 84, k)), radius: lerp(105, 60, k) }; },
  };
}
