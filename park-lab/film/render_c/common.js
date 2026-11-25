// Shared helpers for render agent C (paper / felt / tin).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from '/lib/three/addons/utils/BufferGeometryUtils.js';
export { mergeGeometries };

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const sstep = (a, b, x) => smooth((x - a) / (b - a));
export const eOutCubic = x => 1 - Math.pow(1 - clamp(x), 3);
export const eInOut = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const eOutBack = (x, s = 1.70158) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const eOutBounce = x => { x = clamp(x); const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
// damped spring 0 -> 1 with overshoot; x in seconds-ish units
export const spring = (x, k = 5.5, w = 9) => x <= 0 ? 0 : 1 - Math.exp(-k * x) * Math.cos(w * x);
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hash1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const hex = s => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const col = c => new THREE.Color(c);
export function mixHex(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
export function shade(a, k) { const c = new THREE.Color(a); c.multiplyScalar(k); return '#' + c.getHexString(); }

// value noise 3D
function vnHash(x, y, z) { let h = x * 374761393 + y * 668265263 + z * 2147483647; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => vnHash(xi + a, yi + b, zi + d);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// ------------------------------------------------------------------ canvas textures
export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(w, h, draw, o = {}) {
  const c = makeCanvas(w, h); const g = c.getContext('2d', { willReadFrequently: !!o.read }); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = o.aniso ?? 8; if (o.mip === false) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}
export function starPath(g, x, y, r, n = 5, inner = 0.45) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, q = i % 2 ? r * inner : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }

// ------------------------------------------------------------------ geometry
export class RoundedBoxGeometry extends THREE.BoxGeometry {
  constructor(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1) {
    segments = segments * 2 + 1; radius = Math.min(width / 2, height / 2, depth / 2, radius);
    super(1, 1, 1, segments, segments, segments);
    const g2 = this.toNonIndexed(); this.index = null;
    this.attributes.position = g2.attributes.position; this.attributes.normal = g2.attributes.normal; this.attributes.uv = g2.attributes.uv;
    const p = new THREE.Vector3(), n = new THREE.Vector3(); const box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(radius);
    const P = this.attributes.position.array, N = this.attributes.normal.array, hs = 0.5 / segments;
    for (let i = 0; i < P.length; i += 3) {
      p.fromArray(P, i); n.copy(p); n.x -= Math.sign(n.x) * hs; n.y -= Math.sign(n.y) * hs; n.z -= Math.sign(n.z) * hs; n.normalize();
      P[i] = box.x * Math.sign(p.x) + n.x * radius; P[i + 1] = box.y * Math.sign(p.y) + n.y * radius; P[i + 2] = box.z * Math.sign(p.z) + n.z * radius;
      N[i] = n.x; N[i + 1] = n.y; N[i + 2] = n.z;
    }
  }
}
export function lumpySphere(r, detail = 2, amp = 0.12, freq = 1.6, seed = 1) {
  let g = new THREE.IcosahedronGeometry(r, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); const l = Math.hypot(x, y, z) || 1;
    const k = 1 + amp * (vnoise(x / r * freq + seed * 7.1, y / r * freq + seed * 3.3, z / r * freq) * 2 - 1);
    P.setXYZ(i, x * k, y * k, z * k); }
  g.computeVertexNormals();
  const uv = new Float32Array(P.count * 2); for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); uv[2 * i] = 0.5 + Math.atan2(z, x) / 6.283; uv[2 * i + 1] = 0.5 + Math.asin(Math.max(-1, Math.min(1, y / (Math.hypot(x, y, z) || 1)))) / 3.1416; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
// set constant vertex color (for merging multi-tone geometry; instanceColor multiplies it)
export function tint(g, c) { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count; const a = new Float32Array(n * 3); const cc = new THREE.Color(c); for (let i = 0; i < n; i++) { a[3 * i] = cc.r; a[3 * i + 1] = cc.g; a[3 * i + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
export function merge(list) { const gs = list.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
  const hasC = gs.some(g => g.attributes.color); if (hasC) gs.forEach(g => { if (!g.attributes.color) tint(g, 0xffffff); });
  return mergeGeometries(gs, false); }
export function xf(g, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) { const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s]))); g.applyMatrix4(m); return g; }
// unit beam geometry along +y from 0..1, scaled by matrix
export function beamMatrix(a, b, w, h) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const d = vb.clone().sub(va); const L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return { p: va.clone().add(vb).multiplyScalar(0.5), q, s: new THREE.Vector3(w, L, h ?? w) };
}
// sweep a 2D profile [[left, up, u]] along a baked track between s0..s1 (frames from tr.sample)
export function sweepTrack(tr, s0, s1, step, profile, o = {}) {
  const n = Math.max(2, Math.ceil((s1 - s0) / step) + 1); const m = profile.length; const closed = !!o.closed;
  const pos = new Float32Array(n * m * 3), nor = new Float32Array(n * m * 3), uv = new Float32Array(n * m * 2); const idx = [];
  const yScale = o.yScale ?? 1;
  for (let i = 0; i < n; i++) {
    const s = Math.min(s0 + (s1 - s0) * i / (n - 1), s1); const f = tr.sample(s);
    const T = f.tangent, U = f.up; const L = [U[1] * T[2] - U[2] * T[1], U[2] * T[0] - U[0] * T[2], U[0] * T[1] - U[1] * T[0]];
    for (let k = 0; k < m; k++) {
      const [l, u, uu, nl, nu] = profile[k]; const j = (i * m + k);
      pos[3 * j] = f.pos[0] + L[0] * l + U[0] * u; pos[3 * j + 1] = (f.pos[1] + L[1] * l + U[1] * u) * yScale; pos[3 * j + 2] = f.pos[2] + L[2] * l + U[2] * u;
      if (nl !== undefined) { nor[3 * j] = L[0] * nl + U[0] * nu; nor[3 * j + 1] = L[1] * nl + U[1] * nu; nor[3 * j + 2] = L[2] * nl + U[2] * nu; }
      uv[2 * j] = uu ?? k / (m - 1); uv[2 * j + 1] = s / (o.vScale || 1);
    }
    if (i > 0) { const kk = closed ? m : m - 1; for (let k = 0; k < kk; k++) { const a = (i - 1) * m + k, b = (i - 1) * m + (k + 1) % m, c = i * m + k, d = i * m + (k + 1) % m; idx.push(a, c, b, b, c, d); } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  if (profile[0][3] !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); else g.computeVertexNormals();
  return g;
}
export function circleProfile(cl, cu, r, n) { const out = []; for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2; out.push([cl + Math.cos(a) * r, cu + Math.sin(a) * r, k / n, Math.cos(a), Math.sin(a)]); } return out; }
// tube along a polyline of Vector3
export function tubeAlong(pts, r, seg = 6, closed = false) { const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal'); return new THREE.TubeGeometry(curve, Math.max(4, pts.length * 3), r, seg, closed); }

// ------------------------------------------------------------------ instancing
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _e = new THREE.Euler(), _zero = new THREE.Vector3();
// items: {p:[x,y,z], ry, rx, rz, q(Quaternion), s:[sx,sy,sz]|n, c, ...anything}
export class Inst {
  constructor(geo, mat, items, o = {}) {
    const vc = [].concat(mat).some(m => m.vertexColors); if (vc && !geo.attributes.color) geo = tint(geo, '#ffffff');
    this.items = items; this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    this.mesh.count = items.length; this.mesh.castShadow = o.cast !== false; this.mesh.receiveShadow = o.receive !== false; this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    for (const it of items) {
      it.P = new THREE.Vector3(...it.p); it.Q = it.q ? it.q.clone() : new THREE.Quaternion().setFromEuler(_e.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ'));
      it.S = typeof it.s === 'number' ? new THREE.Vector3(it.s, it.s, it.s) : new THREE.Vector3(...(it.s || [1, 1, 1]));
    }
    if (items.length && items[0].c !== undefined) { items.forEach((it, i) => { c.set(it.c); this.mesh.setColorAt(i, c); }); this.mesh.instanceColor.needsUpdate = true; }
    this.update();
    if (o.name) this.mesh.name = o.name;
  }
  // fn(it, i, P, Q, S) may mutate P,Q,S (copies of base) and return false to hide
  update(fn) {
    const M = this.mesh;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i]; _p.copy(it.P); _q.copy(it.Q); _s.copy(it.S);
      let vis = true, pre = null; if (fn) { const r = fn(it, i, _p, _q, _s); if (r === false) vis = false; else if (r && r.isMatrix4) pre = r; }
      if (!vis) _s.set(0, 0, 0);
      if (pre) { _m.compose(_zero, _q, _s); _m.premultiply(pre); _m2.makeTranslation(_p.x, _p.y, _p.z); _m.premultiply(_m2); }
      else _m.compose(_p, _q, _s);
      M.setMatrixAt(i, _m);
    }
    M.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ world-space detail injection
// Adds: world position/normal varyings and a triplanar greyscale detail texture multiplied into diffuse.
export function patchMaterial(m, o) {
  const prev = m.onBeforeCompile; const key = JSON.stringify({ d: !!o.detail, g: !!o.ground, e: !!o.edge, k: o.key || '', b: o.bump || 0 });
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uDet = { value: o.detail || null }; sh.uniforms.uDetS = { value: o.detailScale || [1, 1] }; sh.uniforms.uDetK = { value: o.detailStrength ?? 0.5 };
    if (o.ground) Object.assign(sh.uniforms, o.ground);
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 wp4 = vec4(transformed, 1.0); vec3 wn = objectNormal;
      #ifdef USE_INSTANCING
        wp4 = instanceMatrix * wp4; wn = mat3(instanceMatrix) * wn;
      #endif
      vWP = (modelMatrix * wp4).xyz; vWN = normalize(mat3(modelMatrix) * wn); }`);
    let fs = 'varying vec3 vWP; varying vec3 vWN; uniform sampler2D uDet; uniform vec2 uDetS; uniform float uDetK; float gDetV = 0.5;\n';
    if (o.ground) fs += 'uniform sampler2D gBase, gRoi; uniform vec4 gBaseR, gRoiR;\n';
    fs += sh.fragmentShader;
    if (o.ground) fs = fs.replace('#include <map_fragment>', `
      { vec2 bu = (vWP.xz - gBaseR.xy) / gBaseR.zw; vec4 tc = texture2D(gBase, bu);
        vec2 ru = (vWP.xz - gRoiR.xy) / gRoiR.zw;
        if (ru.x > 0.0 && ru.x < 1.0 && ru.y > 0.0 && ru.y < 1.0) { vec2 e = min(ru, 1.0 - ru); float w = smoothstep(0.0, 0.01, min(e.x, e.y)); tc = mix(tc, texture2D(gRoi, ru), w); }
        diffuseColor *= tc; }`);
    if (o.detail) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 bw = pow(abs(vWN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        float d1 = texture2D(uDet, vWP.zy * uDetS.x).r * bw.x + texture2D(uDet, vWP.xz * uDetS.x).r * bw.y + texture2D(uDet, vWP.xy * uDetS.x).r * bw.z;
        float d2 = texture2D(uDet, vWP.zy * uDetS.y + 0.37).g * bw.x + texture2D(uDet, vWP.xz * uDetS.y + 0.37).g * bw.y + texture2D(uDet, vWP.xy * uDetS.y + 0.37).g * bw.z;
        float dist = length(vViewPosition); float nearK = smoothstep(2.5, 10.0, dist);
        float d3 = texture2D(uDet, vWP.zy * uDetS.x * 5.0).r * bw.x + texture2D(uDet, vWP.xz * uDetS.x * 5.0).r * bw.y + texture2D(uDet, vWP.xy * uDetS.x * 5.0).r * bw.z;
        float dd = mix(mix(d3, 0.5, 0.35), d1, nearK);
        float d = mix(dd, d2, 0.4 * nearK); gDetV = dd * mix(0.3, 1.0, nearK);
        diffuseColor.rgb *= mix(1.0, d * 2.0, uDetK * mix(0.55, 1.0, nearK)); }`);
    if (o.detail && o.bump) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(gDetV), dhy = dFdy(gDetV);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
        vec3 grad = sign(det) * (dhx * r1 + dhy * r2) * ${o.bump.toFixed(3)}; normal = normalize(abs(det) * normal - grad); }`);
    if (o.edge) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.975, 0.93), ${o.edge.toFixed(2)});`);
    if (o.fragHook) fs = o.fragHook(fs);
    sh.fragmentShader = fs;
    if (o.after) o.after(sh);
  };
  const pk = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.customProgramCacheKey = () => pk() + key;
  return m;
}

// ------------------------------------------------------------------ fuzz shells (felt)
export function shellMaterial(base, level, len, dens, boilU) {
  const m = new THREE.MeshStandardMaterial({ map: base.map, color: base.color, roughness: 1, metalness: 0, vertexColors: base.vertexColors });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLevel = { value: level }; sh.uniforms.uLen = { value: len }; sh.uniforms.uBoil = boilU; sh.uniforms.uDens = { value: dens };
    sh.vertexShader = 'uniform float uLevel; uniform float uLen; varying vec3 vSP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed += normal * uLen * uLevel;`).replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 w = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        w = instanceMatrix * w;
      #endif
      vSP = (modelMatrix * w).xyz; }`);
    sh.fragmentShader = 'uniform float uLevel; uniform vec3 uBoil; uniform float uDens; varying vec3 vSP;\nfloat hsh(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\n' +
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec3 q = vSP * uDens + uBoil; vec3 ci = floor(q); vec3 f = fract(q) - 0.5; float hv = hsh(ci);
        vec3 jit = vec3(hsh(ci + 1.7), hsh(ci + 5.3), hsh(ci + 9.1)) - 0.5; float d = length(f - jit * 0.6);
        if (hv < uLevel * 0.65 + 0.15 || d > 0.6 * (1.0 - uLevel * 0.55)) discard;`)
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.9, 1.25, uLevel);');
  };
  m.customProgramCacheKey = () => 'shell' + (base.vertexColors ? 'v' : '');
  return m;
}
// add fuzz shells under object o (Mesh or InstancedMesh)
export function addShells(o, n, len, dens, boilU, cache) {
  const base = o.material; if (Array.isArray(base)) return;
  for (let l = 1; l <= n; l++) {
    const key = base.uuid + '|' + l; let sm = cache.get(key); if (!sm) { sm = shellMaterial(base, l / n, len, dens, boilU); cache.set(key, sm); }
    let s;
    if (o.isInstancedMesh) { s = new THREE.InstancedMesh(o.geometry, sm, o.count); s.instanceMatrix = o.instanceMatrix; s.instanceColor = o.instanceColor; s.count = o.count; s.frustumCulled = false; s.position.copy(o.position); s.quaternion.copy(o.quaternion); s.scale.copy(o.scale); o.parent.add(s); o.userData.shells = (o.userData.shells || []).concat([s]); }
    else { s = new THREE.Mesh(o.geometry, sm); o.add(s); }
    s.castShadow = false; s.receiveShadow = true; s.userData.shell = true;
  }
}

// ------------------------------------------------------------------ environment (for tin reflections)
export function makeEnv(renderer, o = {}) {
  const sc = new THREE.Scene();
  const skyG = new THREE.SphereGeometry(50, 32, 16);
  const skyM = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(o.top || '#7fb2e8') }, hor: { value: new THREE.Color(o.hor || '#e6f0ff') }, gnd: { value: new THREE.Color(o.gnd || '#7a8a5a') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top, hor, gnd; varying vec3 vP; void main(){ float y = normalize(vP).y; vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor * 0.8, gnd, pow(-y, 0.4)); gl_FragColor = vec4(c, 1.0); }' });
  sc.add(new THREE.Mesh(skyG, skyM));
  const lm = (c, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), lm('#fff4e0', o.sunI ?? 40)); const d = o.sunDir || [-0.557, 0.616, 0.557]; sun.position.set(d[0] * 40, d[1] * 40, d[2] * 40); sc.add(sun);
  for (const [x, y, z, w, h, i] of (o.panels || [[0, 30, 0, 30, 30, 1.6], [-40, 8, 10, 4, 20, 3], [40, 10, -10, 6, 16, 2.5]])) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lm('#ffffff', i)); p.position.set(x, y, z); p.lookAt(0, 0, 0); sc.add(p); }
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(sc, 0.02); pm.dispose(); return rt.texture;
}

// ------------------------------------------------------------------ post-processing: MSAA scene RT -> DOF / motion blur -> tone map -> grade
export class Post {
  constructor(renderer, W, H, o = {}) {
    this.r = renderer; this.W = W; this.H = H; const ss = o.ss || 1; this.ss = ss;
    this.rt = new THREE.WebGLRenderTarget(Math.round(W * ss), Math.round(H * ss), { type: THREE.HalfFloatType, samples: o.samples ?? 4, depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(Math.round(W * ss), Math.round(H * ss)); this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.u = {
      tC: { value: this.rt.texture }, tD: { value: this.rt.depthTexture }, res: { value: new THREE.Vector2(W * ss, H * ss) },
      near: { value: 0.3 }, far: { value: 6000 }, focus: { value: 100 }, aperture: { value: 0 }, maxCoc: { value: 12 },
      mblur: { value: 0 }, invPV: { value: new THREE.Matrix4() }, prevPV: { value: new THREE.Matrix4() },
      exposure: { value: 1 }, tintC: { value: new THREE.Vector3(1, 1, 1) }, sat: { value: 1 }, contrast: { value: 1 }, lift: { value: new THREE.Vector3(0, 0, 0) },
      vign: { value: 0.35 }, grain: { value: 0.02 }, seed: { value: 0 }, chroma: { value: 0 }, flash: { value: 0 }, smearX: { value: 0 }, smearY: { value: 0 },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `precision highp float;
      uniform sampler2D tC, tD; uniform vec2 res; uniform float near, far, focus, aperture, maxCoc, mblur, exposure, sat, contrast, vign, grain, seed, chroma, flash, smearX, smearY;
      uniform mat4 invPV, prevPV; uniform vec3 tintC, lift; varying vec2 v;
      float lin(float d){ float z = d * 2. - 1.; return 2. * near * far / (far + near - z * (far - near)); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
      float coc(vec2 uv){ float d = lin(texture2D(tD, uv).r); return clamp(abs(d - focus) / d * aperture * res.y, 0., maxCoc); }
      vec3 neutral(vec3 color){ const float sc = 0.76; const float ds = 0.15; float x = min(color.r, min(color.g, color.b)); float off = x < 0.08 ? x - 6.25 * x * x : 0.04; color -= off;
        float peak = max(color.r, max(color.g, color.b)); if (peak < sc) return color; const float d = 1. - sc; float np = 1. - d * d / (peak + d - sc); color *= np / peak;
        float g = 1. - 1. / (ds * (peak - np) + 1.); return mix(color, vec3(np), g); }
      vec3 srgb(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec3 col;
        if (mblur > 0.0) {
          float d = texture2D(tD, v).r; vec4 wp = invPV * vec4(v * 2. - 1., d * 2. - 1., 1.); wp /= wp.w; vec4 pp = prevPV * wp; vec2 puv = pp.xy / pp.w * .5 + .5;
          vec2 vel = (v - puv) * mblur * smoothstep(3.5, 6.0, lin(d)); float L = length(vel * res); if (L > 60.) vel *= 60. / L;
          vec3 acc = vec3(0.); float j = h(v * 917.) - .5;
          float wsum = 0.;
          for (int i = 0; i < 12; i++) { float f = (float(i) + .5 + j) / 12. - .5; vec2 uv = v - vel * f; float w = smoothstep(2.5, 4.5, lin(texture2D(tD, uv).r)); if (i == 6) w = 1.; acc += texture2D(tC, uv).rgb * w; wsum += w; }
          col = acc / wsum;
        } else if (aperture > 0.0) {
          float c0 = coc(v); vec3 acc = vec3(0.); float ws = 0.;
          for (int i = 0; i < 32; i++) { float fi = float(i); float r = sqrt((fi + .5) / 32.); float a = fi * 2.39996 + h(v * 300.) * 0.5;
            vec2 o = vec2(cos(a), sin(a)) * r; vec2 uv = v + o * max(c0, 0.8) / res;
            float cs = coc(uv); float w = smoothstep(0., 1., cs - r * max(c0, 0.8) + 1.); w = max(w, .02); if (cs >= c0 * .7) w = 1.;
            acc += texture2D(tC, uv).rgb * w; ws += w; }
          col = acc / ws;
        } else col = texture2D(tC, v).rgb;
        if (smearX + smearY > 0.0) { vec3 acc = col; for (int i = 1; i < 10; i++) { float f = float(i) / 9. - .5; acc += texture2D(tC, v + vec2(smearX, smearY) * f).rgb; } col = acc / 10.; }
        if (chroma > 0.0) { vec2 dd = (v - .5) * chroma; col.r = mix(col.r, texture2D(tC, v + dd).r, .7); col.b = mix(col.b, texture2D(tC, v - dd).b, .7); }
        col *= exposure * tintC;
        col = neutral(col);
        float l = dot(col, vec3(.2126, .7152, .0722)); col = mix(vec3(l), col, sat);
        col = (col - .5) * contrast + .5 + lift;
        vec2 dv = v - .5; dv.x *= res.x / res.y; col *= 1. - vign * pow(length(dv) * 1.05, 2.2);
        col = srgb(col);
        col += (h(v * 1000. + seed) - .5) * grain;
        col = mix(col, vec3(1.0, 0.98, 0.95), flash);
        gl_FragColor = vec4(col, 1.);
      }` });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.prevPV = null;
  }
  render(scene, camera) {
    const u = this.u; u.near.value = camera.near; u.far.value = camera.far;
    camera.updateMatrixWorld(); const pv = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    u.invPV.value.copy(pv).invert(); u.prevPV.value.copy(this.prevPV || pv);
    this.r.setRenderTarget(this.rt); this.r.render(scene, camera);
    this.r.setRenderTarget(null); this.r.render(this.scene, this.cam);
  }
}

// fit a directional light's shadow camera around a centre (snapped to texels)
export function fitShadow(light, center, radius, dirToSun, mapSize) {
  const d = new THREE.Vector3(...dirToSun).normalize();
  const up = Math.abs(d.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const lx = new THREE.Vector3().crossVectors(up, d).normalize(), ly = new THREE.Vector3().crossVectors(d, lx);
  const texel = 2 * radius / mapSize; const c = center.clone();
  const a = Math.round(c.dot(lx) / texel) * texel, b = Math.round(c.dot(ly) / texel) * texel, z = c.dot(d);
  c.copy(lx).multiplyScalar(a).addScaledVector(ly, b).addScaledVector(d, z);
  light.position.copy(c).addScaledVector(d, 1500); light.target.position.copy(c); light.target.updateMatrixWorld();
  const sc = light.shadow.camera; sc.left = -radius; sc.right = radius; sc.top = radius; sc.bottom = -radius; sc.near = 1; sc.far = 3200; sc.updateProjectionMatrix();
}
