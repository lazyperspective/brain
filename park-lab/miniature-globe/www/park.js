// Procedural miniature amusement park shared by both prototypes.
import * as THREE from 'three';

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---------------------------------------------------------------- materials
export const shared = { uSnow: { value: 0 } };

const SNOW_VERT_HEAD = 'varying vec3 vWN; varying vec3 vWP;\n';
const SNOW_FRAG_HEAD = `uniform float uSnow; varying vec3 vWN; varying vec3 vWP;
float sh_h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float sh_n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(sh_h(i),sh_h(i+vec2(1,0)),f.x), mix(sh_h(i+vec2(0,1)),sh_h(i+vec2(1,1)),f.x), f.y); }
`;
function patchSnow(m, useAlphaMask) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = shared.uSnow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SNOW_VERT_HEAD)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 snN = objectNormal; vec4 snP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          snN = mat3(instanceMatrix) * snN; snP = instanceMatrix * snP;
        #endif
        vWN = normalize(mat3(modelMatrix) * snN); vWP = (modelMatrix * snP).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SNOW_FRAG_HEAD)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float upn = normalize(vWN).y;
          float nz = sh_n(vWP.xz*2.3)*0.6 + sh_n(vWP.xz*7.1)*0.4;
          float cover = smoothstep(0.18, 0.62, upn + (nz-0.5)*0.5);
          float mask = 1.0;
          ${useAlphaMask ? 'mask = mix(0.55, 1.0, smoothstep(0.7, 0.95, diffuseColor.a)); diffuseColor.a = 1.0;' : ''}
          float s = clamp(uSnow*1.25 - (1.0-cover)*1.2 - nz*0.25*(1.0-uSnow), 0.0, 1.0) * cover * mask;
          vec3 snowc = vec3(0.93, 0.95, 1.0) * (0.92 + 0.08*nz);
          diffuseColor.rgb = mix(diffuseColor.rgb, snowc, s);
        }`);
  };
  m.customProgramCacheKey = () => 'snow' + (useAlphaMask ? 'a' : '');
}

let SNOW_ON = false;
const matCache = new Map();
function M(color, rough = 0.55, extra = {}) {
  const key = color + '|' + rough + '|' + JSON.stringify(extra);
  if (!extra.map && matCache.has(key)) return matCache.get(key);
  const ex = Object.assign({}, extra); const sa = !!ex.snowAlpha; delete ex.snowAlpha;
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, ex));
  if (SNOW_ON) patchSnow(m, sa);
  if (!extra.map) matCache.set(key, m);
  return m;
}

// ----------------------------------------------------------------- textures
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
function stripeTex(c1, c2, n = 8, vertical = true) {
  return canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < n * 2; i++) {
      g.fillStyle = i % 2 ? c2 : c1;
      if (vertical) g.fillRect(i * w / (n * 2), 0, w / (n * 2) + 1, h);
      else g.fillRect(0, i * h / (n * 2), w, h / (n * 2) + 1);
    }
    // painted-resin grain
    const r = rng(7);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
  }, true);
}

// ------------------------------------------------------------------- bulbs
// Instanced emissive bulbs; each has colour, group id, and an order value for chases.
class Bulbs {
  constructor(parent, radius = 0.09) {
    this.parent = parent; this.items = []; this.radius = radius;
  }
  add(p, color, order = 0) { this.items.push({ p: p.clone(), c: new THREE.Color(color), order }); }
  build() {
    const geo = new THREE.IcosahedronGeometry(this.radius, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, this.items.length));
    const m4 = new THREE.Matrix4();
    this.items.forEach((it, i) => { m4.makeTranslation(it.p.x, it.p.y, it.p.z); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, new THREE.Color(0.6, 0.58, 0.5)); });
    mesh.count = this.items.length; mesh.frustumCulled = false;
    this.mesh = mesh; this.parent.add(mesh);
    return this;
  }
  // level: 0..1 overall power; pattern(i,item) -> 0..1 brightness multiplier
  set(level, pattern, gain = 4.0) {
    const c = new THREE.Color(); const off = new THREE.Color(0.55, 0.52, 0.45);
    this.items.forEach((it, i) => {
      const k = level * (pattern ? pattern(i, it) : 1);
      c.copy(off).multiplyScalar(1 - Math.min(1, k)).add(it.c.clone().multiplyScalar(k * gain));
      this.mesh.setColorAt(i, c);
    });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// glow decal for ground light pools
let glowTexture = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  glowTexture = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  return glowTexture;
}
function glowDecal(parent, x, z, r, color, y = 0.06) {
  const m = new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), m);
  p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.renderOrder = 2;
  parent.add(p); return m;
}

function shadowAll(o) { o.traverse((c) => { if (c.isMesh && !c.material.isMeshBasicMaterial) { c.castShadow = true; c.receiveShadow = true; } }); }

// ================================================================ the park
export function buildPark(opts = {}) {
  const mode = opts.mode || 'tilt';
  SNOW_ON = !!opts.snow;
  matCache.clear();
  const R = rng(1234);
  const root = new THREE.Group();
  const updaters = [];       // (t, dt, S) => void
  const lightGroups = {};    // name -> { set(level, t) }
  const winterOnly = [];     // objects that fade in for winter
  const glows = [];          // {mat, name, k}

  // ---------------------------------------------------------------- paths
  const ring = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; ring.push(V(Math.cos(a) * 11.5, 0, 2 + Math.sin(a) * 8.5)); }
  const paths = [
    { pts: [V(0, 0, 22), V(0, 0, 10.5)], w: 3.4 },                  // main avenue
    { pts: ring, w: 2.4, closed: true },                            // ring path
    { pts: [V(0, 0, 10.5), V(0, 0, 2)], w: 2.8 },
    { pts: [V(-11.5, 0, 2), V(0, 0, 2), V(11.5, 0, 2)], w: 2.4 },     // cross
    { pts: [V(0, 0, -6.5), V(0, 0, -2), V(0, 0, 2)], w: 2.2 },
    { pts: [V(-11.5, 0, 2), V(-16.5, 0, 6), V(-18, 0, 12)], w: 2.0 },
    { pts: [V(11.5, 0, 2), V(16, 0, -4), V(16.5, 0, -10), V(12, 0, -19)], w: 2.0 },
    { pts: [V(9, 0, -9.5), V(10, 0, -6.2), V(8.2, 0, -3)], w: 1.6 },
    { pts: [V(-8, 0, 8.6), V(-14, 0, 15), V(-4, 0, 17.5), V(0, 0, 17.5), V(8, 0, 17.5), V(15, 0, 14), V(8, 0, 8.6)], w: 2.0 },
  ];

  // ---------------------------------------------------------------- ground
  const GS = 50; // ground texture covers [-25,25]
  const groundTex = canvasTex(2048, 2048, (g, w, h) => {
    const px = (x) => (x / GS + 0.5) * w, pz = (z) => (z / GS + 0.5) * h, sc = w / GS;
    const r2 = rng(99);
    g.fillStyle = '#5d9a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { // flocked grass blotches
      const x = r2() * w, y = r2() * h, rr = 8 + r2() * 40; const l = r2();
      g.fillStyle = l < 0.5 ? `rgba(40,90,30,${0.08 + r2() * 0.1})` : `rgba(150,190,80,${0.06 + r2() * 0.08})`;
      g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    }
    for (let i = 0; i < 60000; i++) { g.fillStyle = r2() < 0.5 ? 'rgba(30,70,20,0.25)' : 'rgba(170,210,110,0.22)'; g.fillRect(r2() * w, r2() * h, 2, 2); }
    // water basin for the flume
    g.fillStyle = '#2b5f6e'; g.beginPath(); g.ellipse(px(-17.5), pz(-1), 5.2 * sc, 7.6 * sc, 0, 0, 7); g.fill();
    // paths: border then fill (alpha 0.86 marks "path" for snow mask)
    const stroke = (pts, wd, col, closed) => {
      g.strokeStyle = col; g.lineWidth = wd * sc; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(px(p.x), pz(p.z)) : g.moveTo(px(p.x), pz(p.z)))); if (closed) g.closePath(); g.stroke();
    };
    paths.forEach((p) => stroke(p.pts, p.w + 0.35, '#8a7a5c', p.closed));
    const plazas = [[0, 2, 4.6], [0, 13.5, 4.2], [0, 20.5, 3.2], [6, 7.5, 4.2], [-9, 9.5, 3.4], [12.5, 11.5, 3.6], [12.5, -1.5, 3.8]];
    plazas.forEach(([x, z, r]) => { g.fillStyle = '#8a7a5c'; g.beginPath(); g.arc(px(x), pz(z), (r + 0.2) * sc, 0, 7); g.fill(); });
    g.globalCompositeOperation = 'source-over';
    paths.forEach((p) => stroke(p.pts, p.w, 'rgba(222,199,152,0.8)', p.closed));
    plazas.forEach(([x, z, r]) => { g.fillStyle = 'rgba(214,190,146,0.8)'; g.beginPath(); g.arc(px(x), pz(z), r * sc, 0, 7); g.fill(); });
    // paving speckle
    for (let i = 0; i < 40000; i++) { g.fillStyle = r2() < 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,240,210,0.05)'; g.fillRect(r2() * w, r2() * h, 2, 2); }
    // flower beds
    const flow = ['#ff4f6d', '#ffd23f', '#ffffff', '#ff8c2a', '#c86bff', '#ff6fb5'];
    const beds = [[-4, 7, 1.4], [4, 7.5, 1.0], [-3.2, -1.5, 1.0], [3.3, -1.4, 1.0], [-5, 15.5, 1.2], [5, 15.5, 1.2], [0, 2, 1.6]];
    beds.forEach(([x, z, r]) => {
      g.fillStyle = '#4a3527'; g.beginPath(); g.arc(px(x), pz(z), r * sc, 0, 7); g.fill();
      for (let i = 0; i < 260; i++) { const a = r2() * 7, d = Math.sqrt(r2()) * r * 0.92; g.fillStyle = flow[(r2() * flow.length) | 0]; g.beginPath(); g.arc(px(x + Math.cos(a) * d), pz(z + Math.sin(a) * d), 2.2 + r2() * 2, 0, 7); g.fill(); }
    });
  });
  const groundMat = M('#ffffff', 0.95, { map: groundTex, snowAlpha: true });
  let ground;
  if (mode === 'tilt') {
    ground = new THREE.Mesh(new THREE.PlaneGeometry(GS, GS), groundMat);
    ground.rotation.x = -Math.PI / 2;
    // countryside beyond the model
    const outerTex = canvasTex(512, 512, (g, w, h) => {
      const r2 = rng(5); g.fillStyle = '#5a9238'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = r2() < 0.5 ? 'rgba(30,70,20,0.2)' : 'rgba(170,210,110,0.2)'; g.fillRect(r2() * w, r2() * h, 2, 2); }
    }, true);
    outerTex.repeat.set(30, 30);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), M('#ffffff', 1, { map: outerTex }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; root.add(outer);
  } else {
    const cg = new THREE.CircleGeometry(opts.discRadius || 24.5, 96);
    const uv = cg.attributes.uv, pos = cg.attributes.position;
    for (let i = 0; i < uv.count; i++) { uv.setXY(i, pos.getX(i) / GS + 0.5, pos.getY(i) / GS + 0.5); }
    ground = new THREE.Mesh(cg, groundMat); ground.rotation.x = -Math.PI / 2;
  }
  ground.receiveShadow = true; root.add(ground);

  // flume water basin (sunk a little, glossy)
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), M('#3d9db3', 0.08, { metalness: 0.1, envMapIntensity: 1.6 }));
  water.scale.set(5.1, 7.5, 1); water.rotation.x = -Math.PI / 2; water.position.set(-17.5, 0.05, -1); water.receiveShadow = true; root.add(water);

  // ------------------------------------------------------------ helpers
  const box = (w, h, d, mat, x, y, z, parent = root) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const cyl = (rt, rb, h, mat, x, y, z, parent = root, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const white = M('#f4f0e6', 0.5), red = M('#e2302f', 0.45), yellow = M('#ffc928', 0.45), blue = M('#2f6fd6', 0.45), teal = M('#21b3a8', 0.45),
    pink = M('#ff6fa8', 0.45), orange = M('#ff8a24', 0.45), purple = M('#7b4fd6', 0.45), dark = M('#3b3631', 0.6), wood = M('#9c6b3f', 0.8), green = M('#3f9c52', 0.5),
    metal = M('#c9ccd2', 0.35, { metalness: 0.5 }), gold = M('#e8b64a', 0.3, { metalness: 0.6 });

  // ============================================================ COASTER
  const coaster = new THREE.Group(); root.add(coaster);
  const loopC = V(-5, 4.9, -6.0), loopR = 3.7;
  const cps = [
    V(9, 1.1, -10), V(5, 1.1, -10), V(2.3, 1.3, -11.2), V(1.4, 2.2, -13), V(1.1, 6.5, -16.2), V(1.0, 10.6, -19.0),
    V(0.4, 12.1, -20.4), V(-1.6, 11.9, -21.0), V(-4.2, 9.2, -20.8), V(-7.2, 3.4, -20.1), V(-9.8, 1.4, -18.6),
    V(-12.6, 1.8, -16.2), V(-13.6, 4.6, -12.8), V(-13.2, 2.4, -9.4), V(-11.2, 1.3, -7.2),
  ];
  // loop (teardrop-ish), lateral drift in z
  const loopPts = [];
  for (let i = 0; i <= 14; i++) {
    const a = -Math.PI / 2 + (i / 14) * Math.PI * 2 + 0.0;
    const rr = loopR * (1 - 0.12 * Math.max(0, Math.sin(a)));
    loopPts.push(V(loopC.x + Math.cos(a) * rr * 1.0 + (i / 14) * 2.6 - 1.3, loopC.y + Math.sin(a) * rr, -6.6 + (i / 14) * 1.6));
  }
  // drop first/last loop points (they become the entry/exit)
  cps.push(V(-8.2, 1.2, -6.7));
  loopPts.slice(1, 14).forEach((p) => cps.push(p));
  cps.push(V(-1.6, 1.25, -4.9), V(2.0, 2.8, -4.2), V(5.5, 3.6, -3.0), V(9.0, 3.0, -1.5), V(12.2, 2.4, -2.6), V(13.3, 1.9, -6.0), V(12.2, 1.3, -9.2));
  const curve = new THREE.CatmullRomCurve3(cps, true, 'centripetal');
  const L = curve.getLength();
  const NS = 1400;
  const F = []; // frames: p, t, up, side
  for (let i = 0; i <= NS; i++) {
    const u = i / NS; const p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1);
    let up = V(0, 1, 0);
    const dxy = Math.hypot(p.x - loopC.x - (p.z + 6.6) / 1.6 * 2.6 + 1.3, p.y - loopC.y);
    const inLoop = p.z > -6.9 && p.z < -4.8 && p.x > loopC.x - loopR - 2.2 && p.x < loopC.x + loopR + 2.2 && p.y > 1.9;
    if (inLoop) { const c = V(loopC.x + (p.z + 6.6) / 1.6 * 2.6 - 1.3, loopC.y, p.z); up = c.sub(p).normalize(); }
    up.sub(t.clone().multiplyScalar(up.dot(t))).normalize();
    const side = new THREE.Vector3().crossVectors(t, up).normalize();
    F.push({ p, t, up, side });
  }
  // light smoothing of up vectors
  for (let pass = 0; pass < 6; pass++) {
    const ups = F.map((f) => f.up.clone());
    for (let i = 0; i <= NS; i++) {
      const a = ups[(i - 1 + NS) % NS], b = ups[(i + 1) % NS];
      const u = ups[i].clone().multiplyScalar(2).add(a).add(b);
      u.sub(F[i].t.clone().multiplyScalar(u.dot(F[i].t))).normalize();
      F[i].up = u; F[i].side = new THREE.Vector3().crossVectors(F[i].t, u).normalize();
    }
  }
  const frameAt = (s) => {
    const u = (((s / L) % 1) + 1) % 1 * NS; const i = Math.floor(u), f = u - i;
    const A = F[i], B = F[i + 1];
    return { p: A.p.clone().lerp(B.p, f), t: A.t.clone().lerp(B.t, f).normalize(), up: A.up.clone().lerp(B.up, f).normalize(), side: A.side.clone().lerp(B.side, f).normalize() };
  };
  // rails
  const trackMat = M('#e8322b', 0.35, { metalness: 0.25 }), supMat = M('#f2efe8', 0.45);
  const railPath = (off) => new THREE.CatmullRomCurve3(F.slice(0, NS).map((f) => f.p.clone().add(f.side.clone().multiplyScalar(off.x)).add(f.up.clone().multiplyScalar(off.y))), true);
  [[0.36, 0], [-0.36, 0], [0, -0.32]].forEach(([x, y], k) => {
    const tg = new THREE.TubeGeometry(railPath({ x, y }), 900, k === 2 ? 0.16 : 0.09, 6, true);
    coaster.add(new THREE.Mesh(tg, trackMat));
  });
  // ties
  const nTies = Math.floor(L / 0.55);
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 0.08, 0.12), trackMat, nTies);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc1 = V(1, 1, 1);
  for (let i = 0; i < nTies; i++) {
    const f = frameAt(i * L / nTies); m4.makeBasis(f.side, f.up, f.t); m4.setPosition(f.p.clone().add(f.up.clone().multiplyScalar(-0.12)));
    ties.setMatrixAt(i, m4);
  }
  coaster.add(ties);
  // supports
  const sups = [];
  for (let s = 0; s < L; s += 1.6) {
    const f = frameAt(s); if (f.up.y < 0.75 || f.p.y < 1.0) continue;
    const inLoopZone = f.p.z > -7.2 && f.p.z < -4.5 && Math.abs(f.p.x - loopC.x) < loopR + 0.6 && f.p.y > 2.2;
    if (inLoopZone) continue;
    sups.push(f.p.clone().add(f.up.clone().multiplyScalar(-0.35)));
  }
  // loop legs
  [[-1.2, -6.6], [1.2, -6.6], [-1.2, -5.0], [1.2, -5.0]].forEach(([dx, z]) => sups.push(V(loopC.x + dx * 0.2, loopC.y - loopR + 0.2, z)));
  const supG = new THREE.CylinderGeometry(0.09, 0.12, 1, 6); supG.translate(0, 0.5, 0);
  const supI = new THREE.InstancedMesh(supG, supMat, sups.length);
  sups.forEach((p, i) => { m4.compose(V(p.x, 0, p.z), q.identity(), V(1, p.y, 1)); supI.setMatrixAt(i, m4); });
  coaster.add(supI);
  // footings
  const footI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), M('#b9b2a4', 0.9), sups.length);
  sups.forEach((p, i) => { m4.makeTranslation(p.x, 0.07, p.z); footI.setMatrixAt(i, m4); }); coaster.add(footI);
  // loop pylon frame (white A-frame behind loop)
  // station building
  const st = new THREE.Group(); st.position.set(7, 0, -10); coaster.add(st);
  box(5.2, 0.9, 2.6, M('#d8c7a0', 0.8), 0, 0.45, 0, st);
  box(5.6, 0.2, 3.2, M('#2f6fd6', 0.45), 0, 2.6, 0, st);
  [-2.4, 0, 2.4].forEach((x) => [-1.3, 1.3].forEach((z) => cyl(0.08, 0.08, 1.8, white, x, 1.7, z, st, 6)));
  const roofS = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.4, 1.1, 4, 1), M('#ffffff', 0.5, { map: stripeTex('#2f6fd6', '#ffffff', 6) }));
  roofS.rotation.y = Math.PI / 4; roofS.scale.set(1.45, 1, 0.8); roofS.position.y = 3.25; st.add(roofS);

  // speed profile
  let sCrest = 0, yMax = -1;
  for (let i = 0; i < NS; i++) { const p = F[i].p; if (p.z < -18 && p.y > yMax) { yMax = p.y; sCrest = i / NS * L; } }
  let sLiftStart = 0;
  for (let i = 0; i < NS; i++) { const p = F[i].p; if (p.z < -11 && p.z > -13 && p.x > 0.5 && p.x < 2.6) { sLiftStart = i / NS * L; break; } }
  const sStation = (() => { for (let i = 0; i < NS; i++) { if (F[i].p.x > 8.5 && F[i].p.z < -9.5 && F[i].p.y < 1.4) return i / NS * L; } return 0; })();
  const hAt = (s) => frameAt(s).p.y;
  const G = 15, FR = 0.055, vLift = 2.4, vMin = 3.2;
  const tab = []; // [t, s] from crest forward
  { let s = 0, t = 0; const ds = 0.05; while (s < L) {
      const sa = (sCrest + s) % L;
      let v;
      const relLift = ((sa - sLiftStart) % L + L) % L, liftLen = ((sCrest - sLiftStart) % L + L) % L;
      if (relLift < liftLen) v = vLift;
      else { v = Math.sqrt(Math.max(vMin * vMin, vLift * vLift + 2 * G * (yMax - hAt(sa)) - FR * G * s)); }
      const relSt = ((sa - sStation) % L + L) % L; if (relSt < 7) v = Math.min(v, 3.0); // station brake run
      tab.push([t, s]); t += ds / Math.max(v, 0.5); s += ds;
    } tab.push([t, L]); }
  const period = tab[tab.length - 1][0];
  const sAtTime = (tau) => { tau = ((tau % period) + period) % period; let lo = 0, hi = tab.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tab[mid][0] < tau) lo = mid; else hi = mid; } const a = tab[lo], b = tab[hi]; return sCrest + a[1] + (b[1] - a[1]) * ((tau - a[0]) / Math.max(1e-6, b[0] - a[0])); };

  // trains
  const NCARS = 5, GAP = 1.3;
  const carColors = [['#ffcc1f', '#2f6fd6'], ['#26c3b0', '#ff6fa8']];
  const trains = carColors.map(([c1, c2]) => {
    const cars = [];
    for (let k = 0; k < NCARS; k++) {
      const g = new THREE.Group();
      box(0.9, 0.38, 1.16, M(k === 0 ? c2 : c1, 0.3), 0, 0.17, 0, g);
      box(0.82, 0.12, 0.3, M(c2, 0.35), 0, 0.36, 0.42, g);
      if (k === 0) { const nose = box(0.7, 0.26, 0.3, M(c2, 0.35), 0, 0.16, 0.62, g); nose.rotation.x = 0.3; }
      for (let r = 0; r < 2; r++) for (let sd = -1; sd <= 1; sd += 2) {
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M(['#f1c7a3', '#c98d63', '#8a5a3c', '#f6d9bd'][(k + r + sd + 2) % 4], 0.6));
        hd.position.set(sd * 0.2, 0.55, -0.22 + r * 0.42); g.add(hd);
        const bd = box(0.17, 0.2, 0.14, M(['#ffffff', '#ff4f6d', '#2bb3ff', '#ffd23f'][(k * 2 + r + sd + 4) % 4], 0.6), sd * 0.2, 0.4, -0.22 + r * 0.42, g);
      }
      shadowAll(g); coaster.add(g); cars.push(g);
    }
    // train lights
    const tb = new Bulbs(coaster, 0.07); return { cars, tb };
  });
  // track bulbs (along lift, crest, and loop) -- snap on at crest
  const trackBulbs = new Bulbs(coaster, 0.075);
  for (let s = 0; s < L; s += 0.75) {
    const f = frameAt(s);
    const rel = ((s - sLiftStart) % L + L) % L;
    const inLoop = f.p.z > -7 && f.p.z < -4.6 && Math.abs(f.p.x - loopC.x) < loopR + 1.6 && f.p.y > 1.4;
    if (rel < (((sCrest - sLiftStart) % L + L) % L) + 6 || inLoop || f.p.y > 3.0) {
      [1, -1].forEach((sd) => trackBulbs.add(f.p.clone().add(f.side.clone().multiplyScalar(0.47 * sd)).add(f.up.clone().multiplyScalar(-0.04)), inLoop ? (sd > 0 ? '#ff5ab4' : '#47d7ff') : '#fff1c4', s));
    }
  }
  trackBulbs.build();
  const trainLights = new Bulbs(coaster, 0.06); // per-car headlights (we reposition each frame)
  trains.forEach(() => { for (let k = 0; k < NCARS; k++) { trainLights.add(V(0, 0, 0), '#fff0c0'); trainLights.add(V(0, 0, 0), '#ff4060'); } });
  trainLights.build();
  let coasterLightOn = 0;
  lightGroups.coaster = (lv, t) => { coasterLightOn = lv; trackBulbs.set(lv, (i, it) => 0.75 + 0.25 * Math.sin(t * 9 - it.order * 0.7), 4.5); trainLights.set(lv, null, 5); };
  updaters.push((t, S) => {
    const tau0 = t - (S.crestTime ?? 1.5);
    trains.forEach((tr, ti) => {
      const sLead = sAtTime(tau0 + ti * period / 2) + GAP * (NCARS - 1) / 2;
      tr.cars.forEach((g, k) => {
        const f = frameAt(sLead - k * GAP);
        m4.makeBasis(f.side, f.up, f.t); g.quaternion.setFromRotationMatrix(m4);
        g.position.copy(f.p).add(f.up.clone().multiplyScalar(0.12));
        const li = (ti * NCARS + k) * 2;
        const pL = g.position.clone().add(f.up.clone().multiplyScalar(0.2)).add(f.side.clone().multiplyScalar(0.42));
        const pR = g.position.clone().add(f.up.clone().multiplyScalar(0.2)).add(f.side.clone().multiplyScalar(-0.42));
        m4.makeTranslation(pL.x, pL.y, pL.z); trainLights.mesh.setMatrixAt(li, m4);
        m4.makeTranslation(pR.x, pR.y, pR.z); trainLights.mesh.setMatrixAt(li + 1, m4);
      });
    });
    trainLights.mesh.instanceMatrix.needsUpdate = true;
  });
  glows.push({ m: glowDecal(root, loopC.x, -5.8, 6, '#ff6ac8'), name: 'coaster', k: 0.55 });
  glows.push({ m: glowDecal(root, 1, -16, 5, '#ffe2a0'), name: 'coaster', k: 0.35 });

  // ============================================================ FERRIS WHEEL
  const fw = new THREE.Group(); fw.position.set(14, 0, -14); fw.rotation.y = -0.35; root.add(fw);
  const WR = 6.6, WH = 7.9;
  // A-frame legs
  [-1, 1].forEach((sd) => [-1, 1].forEach((fb) => {
    const leg = cyl(0.13, 0.17, 8.7, white, fb * 2.0, WH / 2, sd * 1.25, fw, 8); leg.rotation.z = -fb * 0.25; leg.rotation.x = sd * 0.0;
  }));
  box(0.5, 0.5, 2.8, white, 0, WH, 0, fw);
  const wheel = new THREE.Group(); wheel.position.y = WH; fw.add(wheel);
  const rimMat = M('#f6f3ec', 0.4);
  [-0.7, 0.7].forEach((z) => { const tr = new THREE.Mesh(new THREE.TorusGeometry(WR, 0.09, 6, 96), rimMat); tr.position.z = z; wheel.add(tr);
    const tr2 = new THREE.Mesh(new THREE.TorusGeometry(WR * 0.55, 0.06, 6, 64), rimMat); tr2.position.z = z; wheel.add(tr2); });
  const NG = 16;
  for (let i = 0; i < NG; i++) {
    const a = i / NG * Math.PI * 2;
    [-0.7, 0.7].forEach((z) => { const sp = cyl(0.035, 0.035, WR, rimMat, Math.cos(a) * WR / 2, Math.sin(a) * WR / 2, z, wheel, 4); sp.rotation.z = a - Math.PI / 2; });
    const cr = cyl(0.04, 0.04, 1.4, rimMat, Math.cos(a) * WR, Math.sin(a) * WR, 0, wheel, 4); cr.rotation.x = Math.PI / 2;
  }
  cyl(0.45, 0.45, 1.8, M('#e2302f', 0.4), 0, 0, 0, wheel, 16).rotation.x = Math.PI / 2;
  const gondCols = ['#e2302f', '#ffc928', '#2f6fd6', '#21b3a8', '#ff6fa8', '#ff8a24', '#7b4fd6', '#3f9c52'];
  const gonds = [];
  for (let i = 0; i < NG; i++) {
    const g = new THREE.Group();
    const c = M(gondCols[i % gondCols.length], 0.4);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.55, 10), c); cup.position.y = -0.75; g.add(cup);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 10), white); roof.position.y = -0.05; g.add(roof);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), white); pole.position.y = -0.35; g.add(pole);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M('#f1c7a3', 0.6)); hd.position.set(0.1, -0.38, 0); g.add(hd);
    shadowAll(g); fw.add(g); gonds.push(g);
  }
  const wheelBulbs = new Bulbs(wheel, 0.085);
  const bulbCols = ['#ffe9a8', '#ff6a8a', '#7ad8ff', '#ffe9a8', '#b48cff'];
  for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; wheelBulbs.add(V(Math.cos(a) * WR, Math.sin(a) * WR, 0.8), bulbCols[0], i); wheelBulbs.add(V(Math.cos(a) * WR, Math.sin(a) * WR, -0.8), bulbCols[0], i); }
  for (let i = 0; i < NG; i++) { const a = i / NG * Math.PI * 2; for (let k = 1; k < 9; k++) wheelBulbs.add(V(Math.cos(a) * WR * k / 9, Math.sin(a) * WR * k / 9, 0.78), bulbCols[1 + (i % 4)], 200 + k + i * 0.01); }
  wheelBulbs.build();
  lightGroups.wheel = (lv, t) => wheelBulbs.set(lv, (i, it) => it.order >= 200 ? 0.35 + 0.65 * (Math.sin(t * 7 - (it.order - 200) * 1.3) > 0.2 ? 1 : 0.25) : 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(it.order * 0.5 - t * 14), 3), 4.5);
  glows.push({ m: glowDecal(root, 13.5, -12.5, 7, '#ffd890'), name: 'wheel', k: 0.45 });
  updaters.push((t) => {
    const ang = t * 0.22 + 0.3; wheel.rotation.z = ang;
    gonds.forEach((g, i) => { const a = i / NG * Math.PI * 2 + ang; g.position.set(Math.cos(a) * WR, WH + Math.sin(a) * WR, 0); g.rotation.z = Math.sin(t * 1.7 + i) * 0.06; });
  });

  // ============================================================ CAROUSEL
  const car = new THREE.Group(); car.position.set(6, 0, 7.5); root.add(car);
  cyl(3.3, 3.4, 0.35, M('#d94f3a', 0.5), 0, 0.17, 0, car, 32);
  const rot = new THREE.Group(); car.add(rot);
  cyl(3.1, 3.1, 0.12, M('#f4e6c8', 0.5), 0, 0.41, 0, rot, 32);
  cyl(0.8, 0.8, 2.6, M('#ffe3a3', 0.4, { map: stripeTex('#ffd56a', '#e2302f', 10) }), 0, 1.7, 0, rot, 16);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.7, 1.6, 24, 1, true), M('#ffffff', 0.5, { map: stripeTex('#e2302f', '#fff4dc', 12), side: THREE.DoubleSide }));
  canopy.position.y = 3.75; rot.add(canopy);
  const val = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.45, 24, 1, true), M('#ffffff', 0.5, { map: stripeTex('#2f6fd6', '#ffd56a', 12), side: THREE.DoubleSide }));
  val.position.y = 2.75; rot.add(val);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), gold); fin.position.y = 4.7; rot.add(fin);
  const horses = [];
  const horseCols = ['#ffffff', '#f2d7a0', '#a57447', '#ffffff', '#cfcfd8', '#f6b9c9'];
  for (let ring2 = 0; ring2 < 2; ring2++) for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + ring2 * 0.31, rr = ring2 ? 1.75 : 2.6;
    const hg = new THREE.Group(); hg.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); hg.rotation.y = -a; rot.add(hg);
    cyl(0.03, 0.03, 2.3, gold, 0, 1.6, 0, hg, 4);
    const h = new THREE.Group(); hg.add(h);
    const hc = M(horseCols[(i + ring2) % horseCols.length], 0.35);
    box(0.18, 0.28, 0.62, hc, 0, 0, 0, h); const nk = box(0.14, 0.34, 0.16, hc, 0, 0.18, 0.3, h); nk.rotation.x = 0.4;
    box(0.06, 0.25, 0.06, hc, 0.05, -0.24, 0.2, h); box(0.06, 0.25, 0.06, hc, -0.05, -0.24, -0.2, h);
    box(0.2, 0.06, 0.2, M(['#e2302f', '#2f6fd6', '#21b3a8', '#ffc928'][i % 4], 0.4), 0, 0.16, -0.05, h);
    horses.push({ h, ph: i * 0.9 + ring2 * 1.7 });
  }
  shadowAll(car);
  const carBulbs = new Bulbs(rot, 0.08);
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; carBulbs.add(V(Math.cos(a) * 3.72, 2.55, Math.sin(a) * 3.72), i % 2 ? '#ffe7a0' : '#fff6dc', i); carBulbs.add(V(Math.cos(a) * 3.72, 2.95, Math.sin(a) * 3.72), '#ffd27a', i); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; for (let k = 1; k <= 3; k++) carBulbs.add(V(Math.cos(a) * 3.6 * (1 - k * 0.24), 2.95 + k * 0.4, Math.sin(a) * 3.6 * (1 - k * 0.24)), '#ffcf70', 100 + k); }
  carBulbs.build();
  const carInner = new THREE.PointLight('#ffb35a', 0, 9, 1.6); carInner.position.set(0, 2.0, 0); car.add(carInner);
  lightGroups.carousel = (lv, t) => { carBulbs.set(lv, (i, it) => 0.7 + 0.3 * Math.sin(t * 10 + it.order * 1.7), 4); carInner.intensity = lv * 30; };
  glows.push({ m: glowDecal(root, 6, 7.5, 6.5, '#ffb860'), name: 'carousel', k: 0.75 });
  updaters.push((t) => { rot.rotation.y = t * 0.9; horses.forEach((o) => { o.h.position.y = 1.15 + Math.sin(t * 4 + o.ph) * 0.22; }); });

  // ============================================================ DROP TOWER
  const dt = new THREE.Group(); dt.position.set(-17, 0, -16.5); root.add(dt);
  const DH = 17.5;
  box(1.1, DH, 1.1, M('#f4f0e6', 0.45, { map: stripeTex('#f4f0e6', '#7b4fd6', 14, false) }), 0, DH / 2, 0, dt);
  cyl(1.6, 2.0, 0.6, M('#7b4fd6', 0.45), 0, 0.3, 0, dt, 16);
  cyl(1.0, 0.7, 0.8, M('#ffc928', 0.4), 0, DH + 0.3, 0, dt, 12);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 12), M('#e2302f', 0.4)); crown.position.y = DH + 1.4; dt.add(crown);
  const dring = new THREE.Group(); dt.add(dring);
  cyl(1.35, 1.35, 0.4, M('#ff8a24', 0.4), 0, 0, 0, dring, 16);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; box(0.35, 0.55, 0.3, M('#2f2f3a', 0.5), Math.cos(a) * 1.45, -0.3, Math.sin(a) * 1.45, dring).rotation.y = -a;
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M('#f1c7a3', 0.6)); hd.position.set(Math.cos(a) * 1.62, -0.1, Math.sin(a) * 1.62); dring.add(hd);
    const lg = box(0.12, 0.35, 0.12, M('#2b4f9a', 0.6), Math.cos(a) * 1.66, -0.6, Math.sin(a) * 1.66, dring); }
  shadowAll(dt);
  const dtBulbs = new Bulbs(dt, 0.08);
  for (let k = 0; k < 30; k++) [[0.58, 0.58], [-0.58, 0.58], [0.58, -0.58], [-0.58, -0.58]].forEach(([x, z], j) => dtBulbs.add(V(x, 0.8 + k * (DH - 1) / 30, z), j % 2 ? '#c49bff' : '#ff9cf0', k));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; dtBulbs.add(V(Math.cos(a) * 1.0, DH + 0.7, Math.sin(a) * 1.0), '#ffe8a0', 40); }
  dtBulbs.build();
  lightGroups.drop = (lv, t) => dtBulbs.set(lv, (i, it) => it.order >= 40 ? 1 : 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(it.order * 0.55 - t * 12), 4), 4.5);
  glows.push({ m: glowDecal(root, -17, -16.5, 4.5, '#d090ff'), name: 'drop', k: 0.6 });
  updaters.push((t) => {
    // cycle: hold top -> drop at ~1.95s -> brake -> slow lift
    const cyc = 4.0, ph = ((t + 1.4) % cyc + cyc) % cyc; let y;
    if (ph < 0.5) y = DH - 1.2; else if (ph < 1.35) { const u = (ph - 0.5) / 0.85; y = DH - 1.2 - (DH - 3.2) * Math.min(1, u * u * 1.15); } else if (ph < 1.6) y = 2.0 + Math.sin((ph - 1.35) * 12) * 0.08 * (1.6 - ph) * 4; else { const u = (ph - 1.6) / 2.4; y = 2.0 + (DH - 3.2) * (u * u * (3 - 2 * u)); }
    dring.position.y = y;
  });

  // ============================================================ SWING RIDE
  const sw = new THREE.Group(); sw.position.set(12.5, 0, -1.5); root.add(sw);
  cyl(1.4, 1.7, 0.4, M('#21b3a8', 0.45), 0, 0.2, 0, sw, 16);
  cyl(0.35, 0.45, 6.6, M('#ffffff', 0.45, { map: stripeTex('#ffffff', '#21b3a8', 12, false) }), 0, 3.3, 0, sw, 12);
  const swTop = new THREE.Group(); swTop.position.y = 6.6; sw.add(swTop);
  const umb = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.2, 16, 1, true), M('#ffffff', 0.5, { map: stripeTex('#ffc928', '#21b3a8', 8), side: THREE.DoubleSide })); umb.position.y = 0.7; swTop.add(umb);
  const swv = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.3, 16, 1, true), M('#ff6fa8', 0.5, { side: THREE.DoubleSide })); swTop.add(swv);
  const chairs = [];
  const chainGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 3); chainGeo.translate(0, -0.5, 0);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const arm = new THREE.Group(); arm.position.set(Math.cos(a) * 2.8, -0.1, Math.sin(a) * 2.8); arm.rotation.y = -a; swTop.add(arm);
    const piv = new THREE.Group(); arm.add(piv);
    const ch = new THREE.Mesh(chainGeo, metal); ch.scale.y = 3.2; piv.add(ch);
    const seat = box(0.3, 0.08, 0.3, M(gondCols[i % 8], 0.4), 0, -3.25, 0, piv);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M('#f1c7a3', 0.6)); hd.position.set(0, -2.95, 0); piv.add(hd);
    box(0.16, 0.22, 0.12, M(['#ffffff', '#ff4f6d', '#2bb3ff', '#ffd23f'][i % 4], 0.6), 0, -3.1, 0, piv);
    chairs.push(piv);
  }
  shadowAll(sw);
  const swBulbs = new Bulbs(swTop, 0.08);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; swBulbs.add(V(Math.cos(a) * 3.05, -0.05, Math.sin(a) * 3.05), i % 2 ? '#7af0ff' : '#ffe9a8', i); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; for (let k = 1; k <= 3; k++) swBulbs.add(V(Math.cos(a) * 3 * (1 - k * 0.25), 0.3 + k * 0.3, Math.sin(a) * 3 * (1 - k * 0.25)), '#ffd0f0', 50 + k); }
  swBulbs.build();
  lightGroups.swing = (lv, t) => swBulbs.set(lv, (i, it) => 0.5 + 0.5 * (Math.sin(t * 8 + it.order * 0.8) > 0 ? 1 : 0.3), 4);
  glows.push({ m: glowDecal(root, 12.5, -1.5, 5.5, '#80f0ff'), name: 'swing', k: 0.5 });
  updaters.push((t) => {
    const spin = 1.5; swTop.rotation.y = -t * spin; swTop.rotation.x = Math.sin(t * 0.9) * 0.08; swTop.position.y = 6.6 + Math.sin(t * 0.7) * 0.15;
    chairs.forEach((c, i) => { c.rotation.z = 0; c.rotation.x = 0; c.rotation.z = 0.62 + Math.sin(t * 3 + i) * 0.03; });
  });
  // chairs fly outward: arm local x points radial; rotate around arm's local z (tangent) so chairs swing out (+x)
  chairs.forEach((c) => { c.rotation.order = 'YXZ'; });

  // ============================================================ PIRATE SHIP
  const ps = new THREE.Group(); ps.position.set(-9, 0, 9.5); ps.rotation.y = 0.5; root.add(ps);
  [-1, 1].forEach((sd) => [-1, 1].forEach((fb) => { const l = cyl(0.12, 0.15, 6.3, M('#2f6fd6', 0.45), fb * 1.5, 2.9, sd * 1.4, ps, 8); l.rotation.z = -fb * 0.42; }));
  box(0.3, 0.3, 3.2, M('#2f6fd6', 0.45), 0, 5.8, 0, ps);
  const swing = new THREE.Group(); swing.position.y = 5.8; ps.add(swing);
  const hullG = new THREE.BoxGeometry(5.4, 1.1, 1.5, 12, 3, 3);
  { const p = hullG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const e = Math.abs(x) / 2.7; const yy = y + 0.55; p.setZ(i, z * (1 - e * e * 0.85) * (0.6 + 0.4 * yy / 1.1)); p.setY(i, y + e * e * 0.7); } hullG.computeVertexNormals(); }
  const hull = new THREE.Mesh(hullG, M('#9c5a2a', 0.55, { map: stripeTex('#a8622f', '#8a4e22', 8, false) })); hull.position.y = -4.4; swing.add(hull);
  box(4.4, 0.08, 1.1, M('#d9b27a', 0.7), 0, -3.9, 0, swing);
  [-2.2, 2.2].forEach((x) => { const a = cyl(0.04, 0.04, 4.4, metal, x * 0.25, -2.1, 0, swing, 4); a.rotation.z = x > 0 ? -0.24 : 0.24; });
  cyl(0.05, 0.05, 2.6, wood, 0, -2.6, 0, swing, 6);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6, 4, 4), M('#fff7e6', 0.7, { side: THREE.DoubleSide })); sail.position.set(0, -2.6, 0); sail.rotation.y = Math.PI / 2; swing.add(sail);
  const flagP = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), M('#1d1d24', 0.7, { side: THREE.DoubleSide })); flagP.position.set(0.25, -1.2, 0); swing.add(flagP);
  for (let i = 0; i < 12; i++) { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M(['#f1c7a3', '#c98d63', '#8a5a3c'][i % 3], 0.6)); hd.position.set(-2 + (i % 6) * 0.8, -3.65, i < 6 ? 0.3 : -0.3); swing.add(hd); }
  shadowAll(ps);
  const psBulbs = new Bulbs(ps, 0.08);
  for (let i = 0; i < 18; i++) { [-1, 1].forEach((sd) => psBulbs.add(V(-1.5 - 1.5 + i * 0.16, 0.2 + i * 0.32, sd * 1.4), '#ffb050', i)); }
  for (let i = 0; i < 18; i++) { [-1, 1].forEach((sd) => psBulbs.add(V(1.5 + 1.5 - i * 0.16, 0.2 + i * 0.32, sd * 1.4), '#ffb050', i)); }
  psBulbs.build();
  const hullBulbs = new Bulbs(swing, 0.07); for (let i = 0; i < 20; i++) { const x = -2.5 + i * 0.26; const e = Math.abs(x) / 2.7; [-1, 1].forEach((sd) => hullBulbs.add(V(x, -3.86 + e * e * 0.7, sd * 0.75 * (1 - e * e * 0.85)), '#ffd080', i)); } hullBulbs.build();
  lightGroups.ship = (lv, t) => { psBulbs.set(lv, (i, it) => 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(it.order * 0.6 - t * 10), 2), 4); hullBulbs.set(lv, null, 3.5); };
  glows.push({ m: glowDecal(root, -9, 9.5, 5, '#ffb060'), name: 'ship', k: 0.45 });
  updaters.push((t) => { swing.rotation.x = 0; swing.rotation.z = Math.sin(t * 2.1 + 0.6) * 0.85; flagP.rotation.y = Math.sin(t * 9) * 0.3; });

  // ============================================================ TEACUPS
  const tc = new THREE.Group(); tc.position.set(12.5, 0, 11.5); root.add(tc);
  cyl(3.2, 3.3, 0.25, M('#ff9fc4', 0.5), 0, 0.12, 0, tc, 32);
  const tcRot = new THREE.Group(); tc.add(tcRot);
  const tcCanopy = cyl(0.4, 0.4, 2.2, M('#fff4dc', 0.5), 0, 1.1, 0, tc, 10);
  const tcTop = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 12), M('#ffffff', 0.5, { map: stripeTex('#ff6fa8', '#ffffff', 6) })); tcTop.position.y = 2.6; tc.add(tcTop);
  const cups = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2; const cg = new THREE.Group(); cg.position.set(Math.cos(a) * 2.1, 0.25, Math.sin(a) * 2.1); tcRot.add(cg);
    const cupM = M(['#2f6fd6', '#ffc928', '#21b3a8', '#e2302f', '#7b4fd6', '#ff8a24'][i], 0.25);
    const pts = []; for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push(new THREE.Vector2(0.3 + Math.sin(u * 1.6) * 0.42, u * 0.6)); }
    const cupMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), cupM); cg.add(cupMesh);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.04, 6, 20), white); rim.rotation.x = Math.PI / 2; rim.position.y = 0.6; cg.add(rim);
    for (let k = 0; k < 3; k++) { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M(['#f1c7a3', '#c98d63', '#f6d9bd'][k], 0.6)); hd.position.set(Math.cos(k * 2.1) * 0.35, 0.68, Math.sin(k * 2.1) * 0.35); cg.add(hd); }
    cups.push(cg);
  }
  shadowAll(tc);
  const tcBulbs = new Bulbs(tc, 0.07); for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; tcBulbs.add(V(Math.cos(a) * 3.25, 0.3, Math.sin(a) * 3.25), i % 2 ? '#ffd0e6' : '#fff0c0', i); } for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; tcBulbs.add(V(Math.cos(a) * 1.5, 2.15, Math.sin(a) * 1.5), '#ffb0d8', i); } tcBulbs.build();
  lightGroups.cups = (lv, t) => tcBulbs.set(lv, (i, it) => 0.6 + 0.4 * Math.sin(t * 6 + it.order), 4);
  glows.push({ m: glowDecal(root, 12.5, 11.5, 5, '#ff9fd0'), name: 'cups', k: 0.5 });
  updaters.push((t) => { tcRot.rotation.y = -t * 0.8; cups.forEach((c, i) => { c.rotation.y = t * (2.2 + i * 0.4) * (i % 2 ? 1 : -1); }); });

  // ============================================================ LOG FLUME
  const lf = new THREE.Group(); root.add(lf);
  const flPts = [V(-14.5, 0.35, 6.5), V(-13.6, 1.0, 1.5), V(-13.6, 3.5, -3.0), V(-14.6, 4.4, -6.5), V(-17.0, 4.5, -8.3), V(-19.8, 4.4, -7.2),
    V(-21.2, 4.3, -4.0), V(-21.0, 2.2, 0.5), V(-20.6, 0.35, 3.8), V(-19.6, 0.32, 7.5), V(-17.0, 0.32, 9.0)];
  const flCurve = new THREE.CatmullRomCurve3(flPts, true, 'centripetal');
  const FL = flCurve.getLength();
  // trough: U-channel built from sampled frames
  {
    const N = 300, pos = [], idx = [], wpos = [], widx = [];
    const prof = [[-0.75, 0.55], [-0.75, 0], [-0.55, -0.12], [0.55, -0.12], [0.75, 0], [0.75, 0.55]];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = flCurve.getPointAt(u % 1), t = flCurve.getTangentAt(u % 1);
      const side = new THREE.Vector3().crossVectors(t, V(0, 1, 0)).normalize(); const up = new THREE.Vector3().crossVectors(side, t).normalize();
      prof.forEach(([x, y]) => { const q2 = p.clone().add(side.clone().multiplyScalar(x)).add(up.clone().multiplyScalar(y)); pos.push(q2.x, q2.y, q2.z); });
      [-0.56, 0.56].forEach((x) => { const q2 = p.clone().add(side.clone().multiplyScalar(x)).add(up.clone().multiplyScalar(0.12)); wpos.push(q2.x, q2.y, q2.z); });
    }
    const P = prof.length;
    for (let i = 0; i < N; i++) for (let k = 0; k < P - 1; k++) { const a = i * P + k, b = a + 1, c = a + P, d = c + 1; idx.push(a, c, b, b, c, d); }
    for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; widx.push(a, c, b, b, c, d); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    const trough = new THREE.Mesh(tg, M('#d9b98a', 0.7, { side: THREE.DoubleSide })); lf.add(trough);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3)); wg.setIndex(widx); wg.computeVertexNormals();
    lf.add(new THREE.Mesh(wg, M('#4fc3dd', 0.1, { side: THREE.DoubleSide, envMapIntensity: 1.5 })));
    // supports for raised parts
    const sp = []; for (let i = 0; i < 60; i++) { const p = flCurve.getPointAt(i / 60); if (p.y > 0.8) sp.push(p); }
    const sI = new THREE.InstancedMesh(supG, M('#8a6a48', 0.8), sp.length * 2);
    sp.forEach((p, i) => { const t = flCurve.getTangentAt(0); [-0.6, 0.6].forEach((o, j) => { m4.compose(V(p.x + o * 0.7, 0, p.z), q.identity(), V(1.1, p.y - 0.1, 1.1)); sI.setMatrixAt(i * 2 + j, m4); }); });
    lf.add(sI);
  }
  // logs
  const logs = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const lg = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.3, 4, 10), M('#7a4a26', 0.75)); lg.rotation.x = Math.PI / 2; lg.scale.set(1, 1, 0.8); g.add(lg);
    for (let k = 0; k < 3; k++) { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M(['#f1c7a3', '#c98d63', '#f6d9bd'][k], 0.6)); hd.position.set(0, 0.45, -0.45 + k * 0.45); g.add(hd);
      box(0.2, 0.18, 0.14, M(['#ff4f6d', '#2bb3ff', '#ffd23f'][(k + i) % 3], 0.6), 0, 0.3, -0.45 + k * 0.45, g); }
    shadowAll(g); lf.add(g); logs.push(g);
  }
  // station hut + splash
  const hut = new THREE.Group(); hut.position.set(-17.5, 0, 9.6); lf.add(hut);
  box(2.4, 1.2, 1.6, M('#a8743f', 0.8), 0, 0.6, 0, hut); const hr = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.0, 4), M('#3f7c4a', 0.6)); hr.position.y = 1.7; hr.rotation.y = Math.PI / 4; hut.add(hr);
  const splashN = 90; const splash = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), M('#eaf8ff', 0.2, { transparent: true, opacity: 0.85 }), splashN); lf.add(splash);
  const splR = rng(77); const splD = []; for (let i = 0; i < splashN; i++) splD.push({ a: splR() * 6.28, v: 1 + splR() * 2.5, up: 2 + splR() * 3, ph: splR() });
  const flBulbs = new Bulbs(lf, 0.07); for (let i = 0; i < 70; i++) { const u = i / 70, p = flCurve.getPointAt(u), t = flCurve.getTangentAt(u); const sd = new THREE.Vector3().crossVectors(t, V(0, 1, 0)).normalize(); [-1, 1].forEach((k) => flBulbs.add(p.clone().add(sd.clone().multiplyScalar(0.8 * k)).add(V(0, 0.58, 0)), k > 0 ? '#9ff6ff' : '#fff0b8', i)); } flBulbs.build();
  lightGroups.flume = (lv, t) => flBulbs.set(lv, (i, it) => 0.55 + 0.45 * Math.sin(it.order * 0.9 - t * 8), 3.5);
  glows.push({ m: glowDecal(root, -17.5, -1, 6.5, '#60d8ff'), name: 'flume', k: 0.5 });
  // where is the drop bottom? (index of steepest descent)
  let dropU = 0, minSlope = 0; for (let i = 0; i < 200; i++) { const t = flCurve.getTangentAt(i / 200); if (t.y < minSlope) { minSlope = t.y; dropU = i / 200; } }
  const dropBottom = (() => { for (let i = 0; i < 200; i++) { const u = (dropU + i / 200) % 1; if (flCurve.getPointAt(u).y < 0.5) return flCurve.getPointAt(u); } return flPts[8]; })();
  updaters.push((t) => {
    logs.forEach((g, i) => {
      const u = ((t * 0.075 + i / logs.length) % 1 + 1) % 1; const p = flCurve.getPointAt(u), tg = flCurve.getTangentAt(u);
      g.position.copy(p).add(V(0, 0.18 + Math.sin(t * 3 + i) * 0.03, 0)); g.lookAt(p.clone().add(tg)); g.rotateZ(Math.sin(t * 2 + i) * 0.05);
    });
    splD.forEach((d, i) => {
      const ph = ((t * 0.9 + d.ph) % 1); const r = d.v * ph; const y = d.up * ph - 6 * ph * ph;
      m4.compose(V(dropBottom.x + Math.cos(d.a) * r, Math.max(0.2, dropBottom.y + 0.2 + y), dropBottom.z + Math.sin(d.a) * r), q.identity(), sc1.setScalar(y < -0.1 ? 0.01 : 1 - ph * 0.6));
      splash.setMatrixAt(i, m4);
    });
    splash.instanceMatrix.needsUpdate = true;
  });

  // ============================================================ ENTRANCE GATE
  const gate = new THREE.Group(); gate.position.set(0, 0, 20.5); root.add(gate);
  [-3.2, 3.2].forEach((x) => {
    box(1.4, 4.2, 1.4, M('#f6e7c9', 0.6), x, 2.1, 0, gate);
    box(1.6, 0.25, 1.6, M('#e2302f', 0.5), x, 4.3, 0, gate);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 8), M('#ffffff', 0.5, { map: stripeTex('#e2302f', '#ffffff', 4) })); rf.position.set(x, 5.3, 0); gate.add(rf);
    cyl(0.03, 0.03, 1.2, dark, x, 6.6, 0, gate, 4);
  });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.32, 8, 32, Math.PI), M('#2f6fd6', 0.45)); arch.position.y = 3.6; gate.add(arch);
  box(4.6, 1.0, 0.35, M('#ffc928', 0.4), 0, 6.5, 0, gate);
  box(4.2, 0.7, 0.4, M('#e2302f', 0.4), 0, 6.5, 0.02, gate);
  for (let i = -2; i <= 2; i++) { box(0.12, 0.9, 0.9, M('#c9ccd2', 0.4, { metalness: 0.4 }), i * 1.0, 0.45, 0, gate); }
  // ticket booths
  [-6, 6].forEach((x) => { box(1.6, 1.6, 1.3, M('#ffe2a8', 0.6), x, 0.8, 0.3, gate); const r2 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 4), M('#ffffff', 0.5, { map: stripeTex('#2f6fd6', '#ffffff', 4) })); r2.position.set(x, 2.05, 0.3); r2.rotation.y = Math.PI / 4; gate.add(r2); });
  // fence along the front
  const fenceN = 46; const fI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), white, fenceN * 2);
  for (let i = 0; i < fenceN; i++) { const x = -22.5 + i * (45 / fenceN); if (Math.abs(x) < 7) { m4.makeScale(0, 0, 0); } else m4.makeTranslation(x, 0.35, 20.7); fI.setMatrixAt(i, m4); }
  for (let i = 0; i < fenceN; i++) { const z = -22 + i * (43 / fenceN); m4.makeTranslation(i % 2 ? -22.8 : 22.8, 0.35, z); fI.setMatrixAt(fenceN + i, m4); }
  if (mode === 'tilt') root.add(fI);
  const rails = mode === 'tilt' ? [[-14.75, 15.5], [14.75, 15.5]].map(([cx, w]) => { const r3 = box(w, 0.08, 0.08, white, cx, 0.6, 20.7); return r3; }) : [];
  const gateBulbs = new Bulbs(gate, 0.085);
  for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI; gateBulbs.add(V(Math.cos(a) * 3.2, 3.6 + Math.sin(a) * 3.2, 0.36), i % 2 ? '#ffe9a8' : '#ff8ab0', i); }
  for (let i = 0; i < 22; i++) gateBulbs.add(V(-2.25 + i * 0.214, 7.05, 0.2), '#fff0c0', i);
  gateBulbs.build();
  lightGroups.gate = (lv, t) => gateBulbs.set(lv, (i, it) => 0.5 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(it.order * 0.8 - t * 9), 2), 4);
  glows.push({ m: glowDecal(root, 0, 19.5, 5, '#ffcf80'), name: 'gate', k: 0.5 });
  shadowAll(gate);

  // flags on gate & tents
  const flags = [];
  const addFlag = (parent, x, y, z, color) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), M(color, 0.6, { side: THREE.DoubleSide })); f.geometry.translate(0.3, 0, 0); f.position.set(x, y, z); parent.add(f); flags.push(f); return f; };
  addFlag(gate, -3.2, 7.0, 0, '#ffc928'); addFlag(gate, 3.2, 7.0, 0, '#21b3a8');

  // ============================================================ STALLS & TENTS
  const stallCols = [['#e2302f', '#ffffff'], ['#2f6fd6', '#ffffff'], ['#ffc928', '#ffffff'], ['#21b3a8', '#ffffff'], ['#ff6fa8', '#ffffff'], ['#ff8a24', '#fff3d6']];
  const stalls = [[-3.4, 15.5, 0.0], [-3.4, 12.2, 0.0], [3.4, 15.8, Math.PI], [3.4, 12.5, Math.PI], [-6.0, -1.2, Math.PI / 2], [6.5, -1.2, Math.PI / 2], [-1.5, 22.5, 0], [17.5, 6.2, -Math.PI / 2], [-12.5, 14.8, 0.6]];
  const stallLights = new Bulbs(root, 0.07);
  stalls.forEach(([x, z, r], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r + Math.PI / 2; root.add(g);
    const [c1, c2] = stallCols[i % stallCols.length];
    box(2.0, 1.0, 1.2, M(c1, 0.5), 0, 0.5, 0, g); box(2.1, 0.08, 1.3, M('#fff6e0', 0.6), 0, 1.04, 0, g);
    box(2.0, 0.9, 0.12, M('#fff8ea', 0.6), 0, 1.5, -0.55, g);
    const aw = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.2), M('#ffffff', 0.5, { map: stripeTex(c1, c2, 6) })); aw.position.set(0, 2.05, 0.15); aw.rotation.x = 0.35; g.add(aw);
    [-0.95, 0.95].forEach((sx) => cyl(0.04, 0.04, 1.1, white, sx, 1.55, 0.55, g, 4));
    box(1.4, 0.4, 0.08, M(c2 === '#ffffff' ? '#ffe9a8' : '#ffffff', 0.5), 0, 2.55, -0.5, g);
    // goods on counter
    for (let k = 0; k < 5; k++) { const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), M(['#ff6fa8', '#ffe9a8', '#8ad1ff', '#ff8a24', '#ffffff'][(k + i) % 5], 0.4)); s2.position.set(-0.7 + k * 0.35, 1.15, 0.25); g.add(s2); }
    for (let k = 0; k < 6; k++) { const lp = V(-1.05 + k * 0.42, 2.0, 0.78); g.localToWorld(lp); g.updateMatrixWorld(); }
    shadowAll(g);
    g.updateMatrixWorld(true);
    for (let k = 0; k < 6; k++) { const lp = V(-1.05 + k * 0.42, 1.86, 0.74).applyMatrix4(g.matrixWorld); stallLights.add(lp, k % 2 ? '#ffe2a0' : '#fff6d8', i); }
  });
  // striped tents
  const tents = [[-6.5, 15.2, 1.8, '#e2302f'], [6.8, 15.0, 1.6, '#2f6fd6'], [-7.5, 4.3, 1.5, '#ffc928'], [16.8, 16.2, 1.7, '#7b4fd6'], [-18.5, 17.0, 1.8, '#e2302f'], [6.0, -6.8, 1.3, '#ff6fa8'], [-1.5, -10.2, 1.3, '#21b3a8'], [18.5, 2.2, 1.4, '#ff8a24']];
  tents.forEach(([x, z, r, c], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = i; root.add(g);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.3, 10, 1, true), M('#ffffff', 0.6, { map: stripeTex(c, '#fff8ea', 5), side: THREE.DoubleSide })); wall.position.y = 0.65; g.add(wall);
    const top = new THREE.Mesh(new THREE.ConeGeometry(r * 1.15, r * 1.2, 10), M('#ffffff', 0.5, { map: stripeTex(c, '#fff8ea', 5) })); top.position.y = 1.3 + r * 0.6; g.add(top);
    const val2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.22, 10, 1, true), M(c, 0.5)); val2.position.y = 1.3; g.add(val2);
    cyl(0.03, 0.03, 0.8, dark, 0, 1.3 + r * 1.2 + 0.3, 0, g, 4);
    addFlag(g, 0, 1.3 + r * 1.2 + 0.55, 0, ['#ffc928', '#21b3a8', '#ff6fa8', '#ffffff'][i % 4]);
    shadowAll(g);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; stallLights.add(V(x + Math.cos(a) * r * 1.16, 1.18, z + Math.sin(a) * r * 1.16), '#ffe6a6', 20 + i); }
  });
  stallLights.build();
  lightGroups.stalls = (lv, t) => stallLights.set(lv, null, 3.2);
  // umbrellas + tables near food court
  const umbs = [[-5.5, 10.5], [-4.8, 9.0], [5.2, 10.2], [-6.6, 0.9], [7.6, 0.8], [5.6, 2.5], [-5.4, 3.0]];
  umbs.forEach(([x, z], i) => { const u = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.35, 8), M('#ffffff', 0.5, { map: stripeTex(['#e2302f', '#2f6fd6', '#21b3a8', '#ffc928'][i % 4], '#ffffff', 4) })); u.position.set(x, 1.35, z); root.add(u); cyl(0.025, 0.025, 1.3, white, x, 0.65, z, root, 4); cyl(0.4, 0.4, 0.05, white, x, 0.55, z, root, 10); u.castShadow = true; });

  // fountain at hub
  const fnt = new THREE.Group(); fnt.position.set(0, 0, 2); root.add(fnt);
  cyl(1.5, 1.6, 0.4, M('#e9e2d2', 0.7), 0, 0.2, 0, fnt, 24); cyl(1.3, 1.3, 0.05, M('#4fc3dd', 0.08), 0, 0.38, 0, fnt, 24);
  cyl(0.15, 0.25, 1.1, M('#e9e2d2', 0.7), 0, 0.8, 0, fnt, 10); cyl(0.6, 0.4, 0.15, M('#e9e2d2', 0.7), 0, 1.3, 0, fnt, 16);
  shadowAll(fnt);
  const dropsN = 120; const drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), M('#d8f6ff', 0.1, { emissive: '#0b2230' }), dropsN); fnt.add(drops);
  const fR = rng(4); const dropD = []; for (let i = 0; i < dropsN; i++) dropD.push({ a: fR() * 6.28, ph: fR(), sp: 0.8 + fR() * 0.3 });
  updaters.push((t) => { dropD.forEach((d, i) => { const ph = (t * d.sp + d.ph) % 1; const r = 0.2 + ph * 1.0; const y = 1.45 + ph * 2.2 - ph * ph * 3.0; m4.makeTranslation(Math.cos(d.a) * r, Math.max(0.4, y), Math.sin(d.a) * r); drops.setMatrixAt(i, m4); }); drops.instanceMatrix.needsUpdate = true; });

  // ============================================================ STRING LIGHTS + BUNTING
  const poles = [];
  for (let z = 10; z <= 20; z += 3.3) { poles.push([V(-1.95, 0, z), V(1.95, 0, z)]); }
  const strLights = new Bulbs(root, 0.075);
  const poleI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 6), M('#4a4440', 0.5), 80); let pc = 0;
  const addPole = (p) => { m4.makeTranslation(p.x, 1.5, p.z); poleI.setMatrixAt(pc++, m4); };
  const catenary = (a, b, n, sag, cols, order0, bunting) => {
    for (let i = 0; i <= n; i++) { const u = i / n; const p = a.clone().lerp(b, u); p.y = 3.0 - Math.sin(u * Math.PI) * sag; strLights.add(p, cols[i % cols.length], order0 + u * a.distanceTo(b)); }
  };
  const bunt = []; // pennant positions
  const strCols = ['#ffe7a0', '#ffd27a', '#fff3d0'];
  // along avenue: zigzag between pole pairs
  const sideL = [], sideR = [];
  for (let z = 21; z >= 10; z -= 2.75) { sideL.push(V(-2.05, 0, z)); sideR.push(V(2.05, 0, z)); }
  sideL.forEach(addPole); sideR.forEach(addPole);
  let ord = 0;
  for (let i = 0; i < sideL.length - 1; i++) { catenary(sideL[i], sideR[i + 1], 9, 0.5, strCols, ord); catenary(sideR[i], sideL[i + 1], 9, 0.5, strCols, ord + 0.4); ord += 3; }
  // ring path lights
  const ringPoles = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; ringPoles.push(V(Math.cos(a) * 12.9, 0, 2 + Math.sin(a) * 9.9)); }
  ringPoles.forEach(addPole);
  for (let i = 0; i < 20; i++) catenary(ringPoles[i], ringPoles[(i + 1) % 20], 6, 0.4, ['#ffe7a0', '#ff9cc0', '#9fe8ff', '#fff3d0'], ord + Math.abs(i - 5) * 1.5);
  // hub to coaster
  const hubP = [V(-1.4, 0, 0), V(-1.4, 0, -6), V(1.4, 0, 0), V(1.4, 0, -6)]; hubP.forEach(addPole);
  catenary(hubP[0], hubP[1], 8, 0.4, strCols, ord + 6); catenary(hubP[2], hubP[3], 8, 0.4, strCols, ord + 6);
  poleI.count = pc; root.add(poleI); poleI.castShadow = true;
  strLights.build();
  let popOrigin = 0;
  lightGroups.strings = (lv, t, S) => {
    // pop sequence: each bulb turns on when its order < progress
    const prog = S && S.stringProg != null ? S.stringProg : (lv > 0 ? 999 : -1);
    strLights.set(1, (i, it) => (it.order < prog ? 1 : 0) * (0.85 + 0.15 * Math.sin(t * 5 + i)), 4);
  };
  // bunting along avenue
  {
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3)); tri.computeVertexNormals();
    const bcols = ['#e2302f', '#ffc928', '#2f6fd6', '#21b3a8', '#ff6fa8', '#ffffff'];
    const pts = [];
    for (let i = 0; i < sideL.length; i++) { const a = sideL[i], b = sideR[i]; for (let k = 1; k < 14; k++) { const u = k / 14; const p = a.clone().lerp(b, u); p.y = 2.75 - Math.sin(u * Math.PI) * 0.45; pts.push(p); } }
    const bI = new THREE.InstancedMesh(tri, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), pts.length);
    if (SNOW_ON) patchSnow(bI.material, false);
    pts.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bI.setMatrixAt(i, m4); bI.setColorAt(i, new THREE.Color(bcols[i % bcols.length])); });
    bI.castShadow = true; root.add(bI);
    updaters.push((t) => { pts.forEach((p, i) => { m4.makeRotationX(Math.sin(t * 4 + i * 0.7) * 0.35); m4.setPosition(p); bI.setMatrixAt(i, m4); }); bI.instanceMatrix.needsUpdate = true; });
  }
  glows.push({ m: glowDecal(root, 0, 15.5, 5.5, '#ffd890'), name: 'strings', k: 0.6 });
  glows.push({ m: glowDecal(root, 0, 2, 6, '#ffd890'), name: 'strings', k: 0.45 });

  // ============================================================ TREES (flocked)
  const treeSpots = [];
  const TR = rng(31);
  const blocked = (x, z) => {
    // keep clear of paths, rides
    const near = (px2, pz2, r) => (x - px2) ** 2 + (z - pz2) ** 2 < r * r;
    if (Math.abs(x) < 3.2 && z > 8) return true;
    if (near(0, 2, 6)) return true;
    const rr = Math.hypot(x / 11.5, (z - 2) / 8.5); if (rr > 0.8 && rr < 1.2) return true;
    if (near(6, 7.5, 4.6) || near(-9, 9.5, 4.3) || near(12.5, 11.5, 4.2) || near(12.5, -1.5, 4.2) || near(14, -14, 4.6) || near(-17, -16.5, 2.5)) return true;
    if (x > -22 && x < -12.5 && z > -9.5 && z < 10.5) return true; // flume
    if (z > 19.5 && Math.abs(x) < 8) return true;
    // coaster footprint
    for (let i = 0; i < NS; i += 8) { const p = F[i].p; if ((p.x - x) ** 2 + (p.z - z) ** 2 < 1.6) return true; }
    for (const p of paths) for (let i = 0; i < p.pts.length - 1; i++) { const a = p.pts[i], b = p.pts[i + 1]; const ab = b.clone().sub(a), ap = V(x, 0, z).sub(a); const u = clamp01(ap.dot(ab) / ab.lengthSq()); const c = a.clone().add(ab.multiplyScalar(u)); if ((c.x - x) ** 2 + (c.z - z) ** 2 < (p.w / 2 + 0.7) ** 2) return true; }
    for (const s of stalls) if (near(s[0], s[1], 2.0)) return true;
    for (const s of tents) if (near(s[0], s[1], s[2] + 1)) return true;
    return false;
  };
  const maxR = mode === 'tilt' ? 99 : (opts.discRadius || 24.5) - 1.0;
  let tries = 0;
  while (treeSpots.length < (mode === 'tilt' ? 230 : 190) && tries < 9000) {
    tries++;
    const x = (TR() - 0.5) * 47, z = (TR() - 0.5) * 46 - 0.5;
    if (Math.hypot(x, z) > maxR) continue;
    if (z > 20.2) continue;
    const edge = Math.abs(x) > 19 || z < -19 || z > 17;
    if (!edge && TR() < 0.45) continue;
    if (blocked(x, z)) continue;
    if (treeSpots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 0.9)) continue;
    treeSpots.push({ x, z, s: 0.7 + TR() * 0.7, pine: TR() < 0.28 });
  }
  // countryside trees outside the model (tilt only)
  if (mode === 'tilt') for (let i = 0; i < 260; i++) { const a = TR() * Math.PI * 2, d = 27 + TR() * 30; const x = Math.cos(a) * d, z = Math.sin(a) * d; if (z > 25 && Math.abs(x) < 30) continue; treeSpots.push({ x, z, s: 1 + TR() * 1.0, pine: TR() < 0.3 }); }
  {
    const blobG = new THREE.IcosahedronGeometry(1, 3);
    { const p = blobG.attributes.position; const nr = rng(3); for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const n = 1 + (Math.sin(v.x * 7.1 + v.y * 3.3) * Math.cos(v.z * 6.3 - v.y * 2.1)) * 0.08 + (nr() - 0.5) * 0.06; v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); } blobG.computeVertexNormals(); }
    const flock = canvasTex(256, 256, (g, w, h) => { const r2 = rng(8); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const l = 150 + r2() * 105; g.fillStyle = `rgb(${l},${l},${l})`; g.fillRect(r2() * w, r2() * h, 2, 2); } }, true);
    flock.repeat.set(3, 3);
    const leafMat = M('#ffffff', 1.0, { map: flock, bumpMap: flock, bumpScale: 2.5 });
    const pineG = new THREE.ConeGeometry(0.8, 2.4, 9, 3); { const p = pineG.attributes.position; const nr = rng(9); for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * (1 + (nr() - 0.5) * 0.15)); p.setZ(i, p.getZ(i) * (1 + (nr() - 0.5) * 0.15)); } pineG.computeVertexNormals(); }
    const trunkG = new THREE.CylinderGeometry(0.08, 0.12, 1, 6); trunkG.translate(0, 0.5, 0);
    const blobs = [], pines = [], trunks = [];
    const greens = ['#3f8a2e', '#4f9e34', '#2f7a33', '#6aa83a', '#3b7f40', '#7fb544', '#2c6b2f'];
    treeSpots.forEach((s) => {
      const c = new THREE.Color(greens[(TR() * greens.length) | 0]);
      trunks.push([s.x, s.z, s.s]);
      if (s.pine) pines.push({ p: V(s.x, 1.5 * s.s + 0.2, s.z), s: s.s, c: c.clone().multiplyScalar(0.75) });
      else { const k = 1 + ((TR() * 3) | 0); for (let j = 0; j < k; j++) blobs.push({ p: V(s.x + (TR() - 0.5) * 0.5 * s.s, (1.1 + TR() * 0.6) * s.s + j * 0.25, s.z + (TR() - 0.5) * 0.5 * s.s), s: s.s * (0.75 - j * 0.12 + TR() * 0.15), c: c.clone().offsetHSL((TR() - 0.5) * 0.03, 0, (TR() - 0.5) * 0.06) }); }
    });
    const bI = new THREE.InstancedMesh(blobG, leafMat, blobs.length);
    blobs.forEach((b, i) => { m4.compose(b.p, q.setFromEuler(new THREE.Euler(TR(), TR() * 6, TR())), V(b.s, b.s * 0.9, b.s)); bI.setMatrixAt(i, m4); bI.setColorAt(i, b.c); });
    const pI = new THREE.InstancedMesh(pineG, leafMat, pines.length);
    pines.forEach((b, i) => { m4.compose(b.p, q.identity(), V(b.s, b.s, b.s)); pI.setMatrixAt(i, m4); pI.setColorAt(i, b.c); });
    const tI = new THREE.InstancedMesh(trunkG, M('#6b4a2f', 0.9), trunks.length);
    trunks.forEach(([x, z, s], i) => { m4.compose(V(x, 0, z), q.identity(), V(s, s * 1.2, s)); tI.setMatrixAt(i, m4); });
    [bI, pI, tI].forEach((m) => { m.castShadow = true; m.receiveShadow = true; root.add(m); });
    // hedges along ring path
  }

  // ============================================================ GUESTS
  const GR = rng(555);
  const guestPaths = paths.map((p) => { const pts = p.pts; const segs = []; let len = 0; for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); segs.push([pts[i], pts[i + 1], len, l]); len += l; } return { segs, len, w: p.w, closed: !!p.closed }; });
  const posOn = (gp, s) => { for (const [a, b, l0, l] of gp.segs) if (s <= l0 + l) { const u = (s - l0) / l; return { p: a.clone().lerp(b, u), d: b.clone().sub(a).normalize() }; } const sg = gp.segs[gp.segs.length - 1]; return { p: sg[1].clone(), d: sg[1].clone().sub(sg[0]).normalize() }; };
  const guests = [];
  const weights = guestPaths.map((g) => g.len * g.w);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const NGUEST = opts.guests || 520;
  for (let i = 0; i < NGUEST; i++) {
    let r = GR() * wsum, k = 0; while (r > weights[k]) { r -= weights[k]; k++; }
    const gp = guestPaths[k];
    guests.push({ gp, s0: GR() * gp.len, v: (0.35 + GR() * 0.5) * (GR() < 0.5 ? -1 : 1), off: (GR() - 0.5) * (gp.w - 0.5), ph: GR() * 6.28, h: 0.85 + GR() * 0.25, kid: GR() < 0.2, walk: true });
  }
  // queues and standing crowds near rides/stalls
  const crowdSpots = [[6, 3.6, 2.4], [-9, 6.0, 2.0], [12.5, 8.0, 2.0], [10.3, -1.0, 1.4], [8.4, -8.2, 1.6], [-15.5, 9.8, 1.6], [-16, -14.5, 1.4], [-2.2, 14, 1.2], [2.2, 14, 1.2], [0, 19, 2.2], [11.5, -10.5, 1.6], [-3.2, -2.5, 1.2], [3.2, 4.6, 1.2]];
  crowdSpots.forEach(([x, z, r]) => { const n = Math.round(r * 9); for (let i = 0; i < n; i++) { const a = GR() * 6.28, d = Math.sqrt(GR()) * r; guests.push({ fixed: V(x + Math.cos(a) * d, 0, z + Math.sin(a) * d), face: GR() * 6.28, ph: GR() * 6.28, h: 0.85 + GR() * 0.25, kid: GR() < 0.2 }); } });
  const NG2 = guests.length;
  const bodyG = new THREE.CapsuleGeometry(0.115, 0.26, 3, 8); bodyG.translate(0, 0.25, 0);
  const legG = new THREE.CylinderGeometry(0.09, 0.07, 0.2, 6); legG.translate(0, 0.1, 0);
  const headG = new THREE.SphereGeometry(0.1, 10, 8);
  const hatG = new THREE.SphereGeometry(0.105, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const gMat = M('#ffffff', 0.6), hMat = M('#ffffff', 0.6);
  const bodyI = new THREE.InstancedMesh(bodyG, gMat, NG2), legI = new THREE.InstancedMesh(legG, M('#ffffff', 0.7), NG2), headI = new THREE.InstancedMesh(headG, hMat, NG2), hatI = new THREE.InstancedMesh(hatG, M('#ffffff', 0.7), NG2);
  const summerCols = ['#ff4f6d', '#ffd23f', '#ffffff', '#2bb3ff', '#ff8a24', '#5fd068', '#ff7fd0', '#b48cff', '#ffffff', '#e2302f', '#1fc9b5'];
  const winterCols = ['#b8232b', '#1f3a6e', '#2e5e3a', '#d79b2b', '#6b2e4f', '#2a2a33', '#a8402a', '#e8e2d4', '#4a6fa8'];
  const legCols = ['#2b3a66', '#3b3b45', '#c9b28a', '#5a6f9a', '#ffffff'];
  const skin = ['#f1c7a3', '#e0ac85', '#c98d63', '#8a5a3c', '#f6d9bd', '#5e3b26'];
  const hatCols = ['#e2302f', '#ffffff', '#2f6fd6', '#ffc928', '#3f9c52'];
  guests.forEach((g, i) => {
    g.cs = new THREE.Color(summerCols[(GR() * summerCols.length) | 0]); g.cw = new THREE.Color(winterCols[(GR() * winterCols.length) | 0]);
    legI.setColorAt(i, new THREE.Color(legCols[(GR() * legCols.length) | 0])); headI.setColorAt(i, new THREE.Color(skin[(GR() * skin.length) | 0])); hatI.setColorAt(i, new THREE.Color(hatCols[(GR() * hatCols.length) | 0]));
    bodyI.setColorAt(i, g.cs);
  });
  [bodyI, legI, headI, hatI].forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; root.add(m); });
  const tmpC = new THREE.Color();
  let lastWinter = -1;
  updaters.push((t, S) => {
    const winter = S.winter || 0;
    guests.forEach((g, i) => {
      let p, yaw, bob = 0, sw = 0;
      if (g.fixed) { p = g.fixed; yaw = g.face + Math.sin(t * 0.8 + g.ph) * 0.4; bob = Math.abs(Math.sin(t * 2 + g.ph)) * 0.015; }
      else {
        const gp = g.gp; let s = g.s0 + g.v * t; let dir = Math.sign(g.v);
        if (gp.closed) s = ((s % gp.len) + gp.len) % gp.len; else { const P = gp.len * 2; s = ((s % P) + P) % P; if (s > gp.len) { s = P - s; dir = -dir; } }
        const o = posOn(gp, s); const side = V(-o.d.z, 0, o.d.x);
        p = o.p.add(side.multiplyScalar(g.off * (dir > 0 ? 1 : -1) * 0 + g.off));
        yaw = Math.atan2(o.d.x * dir, o.d.z * dir);
        bob = Math.abs(Math.sin(t * 9 + g.ph)) * 0.05; sw = Math.sin(t * 9 + g.ph) * 0.12;
      }
      const sc = g.kid ? 0.72 : g.h;
      m4.compose(V(p.x, 0.2 * sc + bob, p.z), q.setFromEuler(new THREE.Euler(0, yaw, sw * 0.4)), V(winter > 0.5 ? 1.15 : 1, sc, winter > 0.5 ? 1.15 : 1)); bodyI.setMatrixAt(i, m4);
      m4.compose(V(p.x, 0.0 + bob * 0.3, p.z), q.setFromEuler(new THREE.Euler(sw, yaw, 0)), V(1, sc, 1)); legI.setMatrixAt(i, m4);
      const hy = 0.2 * sc + 0.62 * sc + bob + 0.02;
      m4.compose(V(p.x, hy, p.z), q.identity(), sc1.setScalar(1)); headI.setMatrixAt(i, m4);
      m4.compose(V(p.x, hy + 0.025, p.z), q.identity(), sc1.setScalar(winter > 0.5 ? 1.0 : 0.0001)); hatI.setMatrixAt(i, m4);
    });
    [bodyI, legI, headI, hatI].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    const wq = Math.round(winter * 20);
    if (wq !== lastWinter) { lastWinter = wq; guests.forEach((g, i) => { bodyI.setColorAt(i, tmpC.copy(g.cs).lerp(g.cw, winter)); }); bodyI.instanceColor.needsUpdate = true; }
  });

  // ============================================================ BALLOONS
  const balloons = [];
  const BR = rng(77);
  const bCols = ['#ff2a4f', '#ffd21f', '#2a9dff', '#ff7a1f', '#38d17a', '#ff5ec4', '#a46bff', '#ffffff'];
  const clusterAt = (x, z, n, h) => { for (let i = 0; i < n; i++) { const a = BR() * 6.28, r = BR() * 0.55; balloons.push({ base: V(x, 1.0, z), off: V(Math.cos(a) * r, h + BR() * 0.7, Math.sin(a) * r), c: bCols[i % bCols.length], ph: BR() * 6.28 }); } };
  clusterAt(2.6, 4.2, 14, 2.4); clusterAt(-1.4, 18.5, 12, 2.3); clusterAt(-6.8, -3.0, 8, 2.2); clusterAt(9.5, 4.6, 8, 2.2);
  // kids with balloons
  guests.forEach((g, i) => { if (!g.fixed && BR() < 0.06) balloons.push({ guest: g, gi: i, off: V(0.15, 1.6, 0), c: bCols[(BR() * bCols.length) | 0], ph: BR() * 6.28 }); });
  // escaped balloons drifting up
  for (let i = 0; i < 9; i++) balloons.push({ free: true, base: V((BR() - 0.5) * 34, 0, (BR() - 0.3) * 30), c: bCols[i % bCols.length], ph: BR() * 6.28, spd: 0.9 + BR() * 0.6, h0: BR() * 14 });
  const balG = new THREE.SphereGeometry(0.22, 12, 10); balG.scale(1, 1.18, 1);
  const balI = new THREE.InstancedMesh(balG, new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.0, envMapIntensity: 1.3 }), balloons.length);
  if (SNOW_ON) patchSnow(balI.material, false);
  balloons.forEach((b, i) => balI.setColorAt(i, new THREE.Color(b.c)));
  balI.castShadow = true; balI.frustumCulled = false; root.add(balI);
  const strGeo = new THREE.BufferGeometry(); strGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(balloons.length * 6), 3));
  const strLines = new THREE.LineSegments(strGeo, new THREE.LineBasicMaterial({ color: '#e8e2d8', transparent: true, opacity: 0.7 })); strLines.frustumCulled = false; root.add(strLines);
  updaters.push((t, S) => {
    const sp = strGeo.attributes.position;
    balloons.forEach((b, i) => {
      let top, bot;
      if (b.free) { const y = ((b.h0 + t * b.spd) % 18) + 3; top = b.base.clone().add(V(Math.sin(t * 0.7 + b.ph) * 0.8 + t * 0.4, y, Math.cos(t * 0.5 + b.ph) * 0.5)); bot = top.clone().add(V(Math.sin(t * 2 + b.ph) * 0.15, -0.9, 0)); }
      else if (b.guest) { const g = b.guest; m4.identity(); bodyI.getMatrixAt(b.gi, m4); const gp = V().setFromMatrixPosition(m4); bot = gp.clone().add(V(0.12, 0.25, 0)); top = gp.clone().add(V(0.15 + Math.sin(t * 2.3 + b.ph) * 0.08, 1.3, Math.cos(t * 1.9 + b.ph) * 0.08)); }
      else { bot = b.base.clone(); top = b.base.clone().add(b.off).add(V(Math.sin(t * 1.6 + b.ph) * 0.1, Math.sin(t * 2.1 + b.ph) * 0.06, Math.cos(t * 1.3 + b.ph) * 0.1)); }
      m4.compose(top, q.setFromEuler(new THREE.Euler(Math.sin(t * 1.5 + b.ph) * 0.15, 0, Math.cos(t * 1.2 + b.ph) * 0.15)), sc1.setScalar(1)); balI.setMatrixAt(i, m4);
      sp.setXYZ(i * 2, top.x, top.y - 0.25, top.z); sp.setXYZ(i * 2 + 1, bot.x, bot.y, bot.z);
    });
    balI.instanceMatrix.needsUpdate = true; sp.needsUpdate = true;
  });
  // balloon vendors (standing)
  [[2.6, 4.2], [-1.4, 18.5], [-6.8, -3.0], [9.5, 4.6]].forEach(([x, z]) => guests.length);

  // ============================================================ WINTER EXTRAS (christmas tree)
  const xmas = new THREE.Group(); xmas.position.set(0, 0, 2); root.add(xmas);
  {
    const tm = M('#1f5a32', 0.9);
    [[1.8, 2.4, 1.6], [1.45, 2.0, 2.9], [1.05, 1.6, 4.0], [0.65, 1.2, 4.9]].forEach(([r, h, y]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), tm); c.position.y = y; xmas.add(c); });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd84a').multiplyScalar(4) })); star.position.y = 5.75; xmas.add(star);
    shadowAll(xmas);
    const xb = new Bulbs(xmas, 0.085); const xr = rng(12);
    for (let i = 0; i < 120; i++) { const u = i / 120; const y = 1.0 + u * 4.5; const r = 1.85 * (1 - u * 0.86) + 0.06; const a = u * 34 + xr() * 0.2; xb.add(V(Math.cos(a) * r, y - 0.2, Math.sin(a) * r), ['#ffd27a', '#ff4a4a', '#ffe9b8', '#5ad1ff', '#ffd27a'][i % 5], i); }
    xb.build(); lightGroups.xmas = (lv, t) => xb.set(lv, (i, it) => 0.6 + 0.4 * Math.sin(t * 5 + it.order * 1.3), 4.5);
    xmas.visible = false; winterOnly.push(xmas);
  }
  const fountainParts = [fnt];

  // ------------------------------------------------------------- update
  const S0 = {};
  function update(t, S = S0) {
    updaters.forEach((u) => u(t, S));
    flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 7 + i * 1.3) * 0.35 + 0.2; });
    const lv = S.lights || {};
    for (const k in lightGroups) lightGroups[k](lv[k] || 0, t, S);
    glows.forEach((g) => { g.m.opacity = (lv[g.name] || 0) * g.k * (S.glowGain ?? 1); });
    const w = S.winter || 0;
    winterOnly.forEach((o) => { o.visible = w > 0.5; });
    fnt.visible = w <= 0.5;
    shared.uSnow.value = S.snow || 0;
  }
  root.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial && o.material.transparent !== true) { o.castShadow = true; o.receiveShadow = true; } });
  ground.castShadow = false; water.castShadow = false;
  if (mode !== 'tilt') root.children.forEach((c) => { if (!c.isInstancedMesh && c !== ground && Math.hypot(c.position.x, c.position.z) > maxR - 0.8) c.visible = false; });
  return { root, update, lightGroups, curve, loopC, period, sCrest, crestPoint: F[Math.round(sCrest / L * NS)].p.clone() };
}
