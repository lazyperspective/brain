import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- setup
const W = 1080, H = 1080;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

let STYLE = 'felt';
let FELT = true;
const G = { uK: { value: 0 } };

// ---------------------------------------------------------------- RNG + JS noise
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rnd = mulberry(1);
function h3(x, y, z) { let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
function vn3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(ix, iy, iz), h3(ix + 1, iy, iz), fx), L(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), fx), fy),
    L(L(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), fx), L(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
function fbm3(x, y, z, oct = 4) { let a = 0.5, s = 0; for (let i = 0; i < oct; i++) { s += a * vn3(x, y, z); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1; a *= 0.5; } return s; }
const lin = (hex) => new THREE.Color(hex); // ColorManagement converts sRGB hex -> linear

// ---------------------------------------------------------------- GLSL
function rotMat(a, b, c) { const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(a, b, c)); const e = new THREE.Matrix3().setFromMatrix4(m).elements; return `mat3(${e.map(v => v.toFixed(5)).join(',')})`; }
const NOISE = /* glsl */`
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3 hash33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm(vec3 p){ float a=0.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5;} return s; }
float aniso(vec3 p, mat3 R){ vec3 q = R*p; q.z *= 0.16; float n = vnoise(q); return pow(1.0-abs(n*2.0-1.0), 9.0); }
float fibres(vec3 p){
  float f = aniso(p, ${rotMat(0.3, 0.9, 0.2)});
  f = max(f, aniso(p*1.13+3.1, ${rotMat(1.3, 0.2, 2.1)}));
  f = max(f, aniso(p*0.91-7.3, ${rotMat(2.2, 1.7, 0.6)}));
  f = max(f, aniso(p*1.07+1.9, ${rotMat(0.7, 2.6, 1.4)}));
  return f;
}
`;
const UNI = `uniform float uShell, uShellLen, uK, uFreq, uBump, uBoilAmp, uVar; uniform vec3 uC1, uC2, uC3, uSSS;
varying vec3 vRest; varying vec3 vRestN; varying vec3 vPos;`;

// per-object colour functions:  vec3 baseCol(vec3 p, vec3 n, vec3 cp)
const COLFN = {
  flat: `vec3 baseCol(vec3 p, vec3 n, vec3 cp){ return uC1; }`,
  stripes: `vec3 baseCol(vec3 p, vec3 n, vec3 cp){ float y = p.y + (fbm(p*1.3)-0.5)*0.6; float b = step(0.5, fract(y/3.3)); return mix(uC1, uC2, b); }`,
  cliff: `vec3 baseCol(vec3 p, vec3 n, vec3 cp){
     float st = fbm(vec3(p.x*0.15, p.y*0.9, p.z*0.15));
     vec3 rock = mix(uC1, uC2, smoothstep(0.35,0.65,st));
     float g = smoothstep(0.35, 0.65, n.y + (fbm(p*0.7)-0.5)*0.8 + (p.y-10.0)*0.12);
     return mix(rock, uC3*(0.85+0.3*fbm(p*0.5)), g); }`,
  sky: `vec3 baseCol(vec3 p, vec3 n, vec3 cp){
     float y = p.y + (fbm(vec3(p.x*0.05, p.y*0.6, p.z*0.05))-0.5)*9.0;
     vec3 c = mix(uC1, uC2, smoothstep(2.0, 26.0, y));
     c = mix(c, uC3, smoothstep(22.0, 52.0, y));
     return c; }`,
  whale: `vec3 baseCol(vec3 p, vec3 n, vec3 cp){
     float belly = smoothstep(-0.15, -0.65, n.y + (fbm(p*0.8)-0.5)*0.4);
     vec3 c = mix(uC1, uC2, belly);
     // eyes
     vec3 e = vec3(3.1, -0.35, 0.0);
     float r = length(vec2(p.x - e.x, p.y - e.y)) ; float side = abs(p.z) ;
     float eye = (1.0 - smoothstep(0.26, 0.34, r)) * step(1.2, side);
     c = mix(c, vec3(0.012,0.01,0.01), eye);
     // pale mottles
     c = mix(c, uC3, smoothstep(0.72, 0.8, fbm(p*0.9 + 4.0)) * (1.0-belly));
     return c; }`,
  moon: `vec3 baseCol(vec3 p, vec3 n, vec3 cp){
     float cr = smoothstep(0.55, 0.65, fbm(p*0.55 + 2.0));
     float cr2 = smoothstep(0.6, 0.66, vnoise(p*1.3+9.0));
     return mix(uC1, uC2, max(cr*0.8, cr2*0.6)); }`,
  sea: `vec3 baseCol(vec3 p, vec3 n, vec3 cp){
     float h = cp.y + (fbm(p*0.35)-0.5)*0.5;
     vec3 c = mix(uC1, uC2, smoothstep(-0.7, 0.7, h));
     float crest = smoothstep(0.85, 1.25, h + (fbm(p*0.9)-0.5)*0.6);
     float far = smoothstep(-5.0, -40.0, p.z);
     c = mix(c, uC1*0.8 + uC2*0.2, far*0.5);
     return mix(c, uC3, crest); }`,
  hull: `vec3 baseCol(vec3 p, vec3 n, vec3 cp){ float s = smoothstep(0.02, 0.08, p.y+0.25) * (1.0-smoothstep(0.2, 0.26, p.y+0.25)); return mix(uC1, uC2, s); }`,
};

const FELT_COLOR = (shell) => `
  vec3 bc = baseCol(vRest, normalize(vRestN), vPos);
  float fib = fibres(vRest*uFreq);
  float fib2 = fibres(vRest*uFreq*0.83 + 11.7);
  float fib3 = fibres(vRest*uFreq*0.67 + 5.3);
  float lump = fbm(vRest*0.9);
  bc *= 1.0 + uVar*(-0.22 + 0.42*fib - 0.22*fib2);
  bc *= 1.0 + uVar*(-0.12 + 0.24*lump);
  bc = mix(bc, bc*vec3(1.3,1.15,0.9) + 0.012, 0.35*fib3);   // blended wool strands
  float Hgt = (fib*0.035 - fib2*0.02 + lump*0.12) * uBump;
  float rAdj = 0.0;
  ${shell ? `
  float fz = fibres(vRest*uFreq*1.35 + vec3(uShell*0.8, uShell*0.45, -uShell*0.6));
  float fz2 = vnoise(vRest*uFreq*2.2 + vec3(uShell*1.5));
  float tuft = vnoise(vRest*1.3);
  float thr = mix(0.08, 0.6, uShell) - 0.3*tuft*uShell;
  float v = max(fz, fz2*fz2*fz2*0.9);
  if (v < thr) discard;
  bc *= mix(0.6, 1.3, uShell);
  diffuseColor.a = smoothstep(thr, thr + 0.2, v);` : ''}
  diffuseColor.rgb = bc;
`;
const CLAY_FUNCS = `
void fingerprint(vec3 p, out float fp, out float dent){
  fp = 0.0; dent = 0.0;
  const float CS = 1.5;
  vec3 c0 = floor(p/CS);
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) for(int k=-1;k<=1;k++){
    vec3 c = c0 + vec3(float(i),float(j),float(k));
    float ep = floor((uK + hash13(c+5.1)*4.0)/4.0);
    vec3 h = hash33(c + ep*13.7);
    if (h.x > 0.62) continue;
    vec3 ctr = (c + 0.15 + 0.7*hash33(c*1.7+ep*3.1))*CS;
    vec3 d = p - ctr;
    vec3 h2 = hash33(c*3.1 + ep);
    float r = length(d*vec3(1.0, 1.0+0.7*h2.x, 1.0+0.7*h2.y));
    float R = 0.5 + 0.35*h.y;
    float m = smoothstep(R, R*0.5, r);
    if (m <= 0.0) continue;
    float wob = vnoise(p*3.0 + h*10.0)*2.2;
    float rid = 0.5+0.5*sin(r*6.2832/0.12 + wob);
    fp = max(fp, m*rid);
    dent = max(dent, m*m*(1.0 - r/R));
  }
}
float toolmarks(vec3 p){
  vec3 dir = normalize(vec3(vnoise(p*0.15), vnoise(p*0.15+4.0), vnoise(p*0.15+9.0)) - 0.5);
  float g = sin(dot(p, dir)*6.2832/0.1 + vnoise(p*2.0)*2.0);
  float mask = smoothstep(0.58, 0.75, vnoise(p*0.45 + 3.3));
  return g*mask;
}`;
const CLAY_COLOR = `
  vec3 bc = baseCol(vRest, normalize(vRestN), vPos);
  vec3 w = vec3(fbm(vRest*0.4), fbm(vRest*0.4+7.1), fbm(vRest*0.4+3.3));
  float marb = fbm(vRest*0.55 + w*3.0);
  float streak = smoothstep(0.40,0.48,marb)*smoothstep(0.58,0.48,marb);
  bc = mix(bc, bc*vec3(1.18,1.1,0.95)+0.025, streak*0.75);
  bc = mix(bc, bc*vec3(0.85,0.9,1.05), smoothstep(0.55,0.7,marb)*0.4);
  bc *= 0.93 + 0.14*fbm(vRest*0.25 + 3.0);
  float fp, dent; fingerprint(vRest, fp, dent);
  float tm = toolmarks(vRest);
  vec3 sc = floor(vRest*3.0); vec3 sh = hash33(sc);
  float speck = (1.0 - smoothstep(0.012, 0.03, length(fract(vRest*3.0) - sh))) * step(0.82, hash13(sc+2.0));
  bc *= 1.0 - 0.55*speck;
  float Hgt = (fp*0.007 - dent*0.05 + tm*0.005 + (fbm(vRest*2.2)-0.5)*0.05) * uBump;
  float rAdj = -0.1*fp*step(0.01,dent) + 0.06*abs(tm) + speck*0.3;
  diffuseColor.rgb = bc;
`;
const BUMP = `
#include <normal_fragment_maps>
{
  vec3 sp = -vViewPosition;
  vec3 dpx = dFdx(sp), dpy = dFdy(sp);
  vec3 R1 = cross(dpy, normal), R2 = cross(normal, dpx);
  float det = dot(dpx, R1);
  float hx = dFdx(Hgt), hy = dFdy(Hgt);
  vec3 grad = sign(det)*(hx*R1 + hy*R2);
  normal = normalize(abs(det)*normal - grad);
}`;

const allMats = [];
function makeMat(o, h = 0) {
  const shell = h > 0;
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0,
    roughness: FELT ? 1.0 : (o.rough ?? 0.36),
    sheen: FELT ? 1.0 : 0.0, sheenRoughness: 0.5, sheenColor: FELT ? lin(o.c1).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(0.55) : new THREE.Color(0, 0, 0),
    specularIntensity: FELT ? 0.12 : 0.85,
    emissive: new THREE.Color(o.emissive ?? 0x000000), emissiveIntensity: o.emissiveIntensity ?? 0,
    side: o.side ?? THREE.FrontSide,
  });
  if (shell) m.alphaToCoverage = true;
  const sss = lin(o.c1).multiplyScalar(FELT ? 0.16 : 0.05);
  const U = {
    uShell: { value: h }, uShellLen: { value: o.shellLen ?? 0.25 }, uK: G.uK,
    uC1: { value: lin(o.c1) }, uC2: { value: lin(o.c2 ?? o.c1) }, uC3: { value: lin(o.c3 ?? o.c1) },
    uSSS: { value: o.sss ? lin(o.sss) : sss }, uFreq: { value: o.freq ?? 4.0 }, uBump: { value: o.bump ?? 1.0 },
    uBoilAmp: { value: o.boil ?? (FELT ? 0.03 : 0.06) }, uVar: { value: o.var ?? 1.0 },
  };
  m.userData.U = U;
  const colFn = COLFN[o.kind || 'flat'];
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${UNI}\n${NOISE}\nattribute vec3 rest;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRest = rest; vRestN = normal;
        float bo = (vnoise(rest*0.5 + vec3(uK*1.7)) - 0.5) * uBoilAmp;
        transformed += normalize(objectNormal) * (uShell*uShellLen + bo);
        vPos = transformed;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${UNI}\n${NOISE}\n${FELT ? '' : CLAY_FUNCS}\n${colFn}`)
      .replace('#include <color_fragment>', FELT ? FELT_COLOR(shell) : CLAY_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor + rAdj, 0.05, 1.0);')
      .replace('#include <normal_fragment_maps>', BUMP)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uSSS;');
  };
  m.customProgramCacheKey = () => STYLE + (o.kind || 'flat') + (shell ? 's' : 'b');
  allMats.push(m);
  return m;
}

// ---------------------------------------------------------------- hair (stray fibres)
const hairMat = new THREE.ShaderMaterial({
  uniforms: { keyDir: { value: new THREE.Vector3() }, keyCol: { value: new THREE.Color() }, ambCol: { value: new THREE.Color() }, camPos: { value: new THREE.Vector3() } },
  vertexShader: `attribute vec3 tng; attribute vec3 hcol; attribute float along;
    varying vec3 vT; varying vec3 vCol; varying vec3 vW; varying float vA;
    void main(){ vT = normalize(mat3(modelMatrix)*tng); vCol = hcol; vA = along; vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `uniform vec3 keyDir, keyCol, ambCol, camPos; varying vec3 vT; varying vec3 vCol; varying vec3 vW; varying float vA;
    void main(){ vec3 T = normalize(vT); vec3 L = normalize(keyDir); vec3 V = normalize(camPos - vW);
      float TL = dot(T,L); float diff = sqrt(max(0.0, 1.0-TL*TL));
      vec3 Hh = normalize(L+V); float TH = dot(T,Hh); float spec = pow(sqrt(max(0.0,1.0-TH*TH)), 60.0);
      float back = pow(max(0.0, dot(-V, L)), 3.0);
      vec3 c = vCol*(ambCol + keyCol*diff*0.35) + keyCol*(spec*0.25 + back*0.6)*vCol;
      gl_FragColor = vec4(c, 0.8*(1.0 - 0.5*vA)); }`,
  transparent: true, depthWrite: false,
});
const hairSets = [];
class Hair {
  constructor(mesh, count, len, colHex, opts = {}) {
    this.mesh = mesh; this.count = count; this.len = len; this.seg = 4;
    const pos = mesh.geometry.attributes.position;
    const r = mulberry(count * 7 + 13);
    this.idx = new Uint32Array(count); this.par = new Float32Array(count * 8);
    const filt = opts.filter;
    for (let i = 0; i < count; i++) {
      let v; let tries = 0;
      do { v = Math.floor(r() * pos.count); tries++; } while (filt && !filt(pos.getX(v), pos.getY(v), pos.getZ(v)) && tries < 50);
      this.idx[i] = v;
      for (let j = 0; j < 8; j++) this.par[i * 8 + j] = r();
    }
    const nv = count * this.seg * 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    g.setAttribute('tng', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    const hc = new Float32Array(nv * 3), al = new Float32Array(nv);
    const base = lin(colHex);
    for (let i = 0; i < count; i++) {
      const b = 0.75 + 0.6 * this.par[i * 8 + 7];
      const tint = this.par[i * 8 + 6] < 0.12 ? lin(opts.alt ?? colHex) : base;
      for (let s = 0; s < this.seg * 2; s++) {
        const o = (i * this.seg * 2 + s);
        hc[o * 3] = tint.r * b; hc[o * 3 + 1] = tint.g * b; hc[o * 3 + 2] = tint.b * b;
        al[o] = Math.floor((s + 1) / 2) / this.seg;
      }
    }
    g.setAttribute('hcol', new THREE.BufferAttribute(hc, 3));
    g.setAttribute('along', new THREE.BufferAttribute(al, 1));
    this.lines = new THREE.LineSegments(g, hairMat);
    this.lines.frustumCulled = false;
    mesh.add(this.lines);
    hairSets.push(this);
  }
  update(k) {
    const P = this.mesh.geometry.attributes.position.array, N = this.mesh.geometry.attributes.normal.array;
    const out = this.lines.geometry.attributes.position.array, tg = this.lines.geometry.attributes.tng.array;
    const jr = mulberry(k * 977 + this.count);
    const n = new THREE.Vector3(), t = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      const v = this.idx[i], pr = this.par.subarray(i * 8, i * 8 + 8);
      n.set(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]).normalize();
      p.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      t.set(pr[0] - 0.5, pr[1] - 0.5, pr[2] - 0.5); t.addScaledVector(n, -t.dot(n)).normalize();
      const alpha = 0.35 + 1.0 * pr[3];
      d.copy(n).multiplyScalar(Math.cos(alpha)).addScaledVector(t, Math.sin(alpha)).normalize();
      c.crossVectors(n, t).normalize();
      const L = this.len * (0.35 + 0.9 * pr[4] * pr[4]);
      const curl = (pr[5] - 0.5) * 1.6 + (jr() - 0.5) * 0.25;
      p.addScaledVector(n, -0.03);
      for (let s = 0; s < this.seg; s++) {
        const o = (i * this.seg + s) * 6;
        out[o] = p.x; out[o + 1] = p.y; out[o + 2] = p.z;
        d.addScaledVector(c, curl * 0.5).addScaledVector(t, (jr() - 0.5) * 0.15).normalize();
        d.y -= 0.04; d.normalize();
        p.addScaledVector(d, L / this.seg);
        out[o + 3] = p.x; out[o + 4] = p.y; out[o + 5] = p.z;
        tg[o] = tg[o + 3] = d.x; tg[o + 1] = tg[o + 4] = d.y; tg[o + 2] = tg[o + 5] = d.z;
      }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.tng.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- object helper
function prep(geo, lump = 0, lumpFreq = 0.3, seed = 0) {
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-4);
  if (lump > 0) {
    geo.computeVertexNormals();
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const d = (fbm3(x * lumpFreq + seed, y * lumpFreq, z * lumpFreq) - 0.5) * 2 * lump;
      p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
    }
  }
  geo.computeVertexNormals();
  geo.setAttribute('rest', geo.attributes.position.clone());
  return geo;
}
// Fuzzy/clay object: base mesh + felt shells
function obj(geo, o, parent) {
  const mesh = new THREE.Mesh(geo, makeMat(o, 0));
  mesh.castShadow = o.cast ?? true; mesh.receiveShadow = true;
  if (FELT && (o.shells ?? 8) > 0) {
    const n = o.shells ?? 8;
    for (let i = 1; i <= n; i++) {
      const s = new THREE.Mesh(geo, makeMat(o, i / n));
      s.receiveShadow = true; s.castShadow = false;
      mesh.add(s);
    }
  }
  if (FELT && o.hairs) new Hair(mesh, o.hairs, o.hairLen ?? 0.6, o.hairCol ?? o.c1, { alt: o.hairAlt, filter: o.hairFilter });
  (parent || scene).add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- scene
let scene, camera, key, fill, hemi, lamp, spot, beam, sea, seaBase, whale, whaleRest, flukeRest, boat, foam = [], jitterables = [], lampGlow;
const PAL = {};

function buildScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(33, 1, 5, 400);
  rnd = mulberry(FELT ? 11 : 22);

  // palettes
  Object.assign(PAL, FELT ? {
    sea1: 0x0e4373, sea2: 0x2a8ab8, sea3: 0xe4eef0, rock1: 0x6b5a4f, rock2: 0x8a7766, grass: 0x6d8a3c,
    white: 0xeee6d6, red: 0xb8362c, dark: 0x2a2a30, glass: 0xffd58a, sky1: 0xf4b07a, sky2: 0xa0709c, sky3: 0x2e3566,
    moon: 0xf3e6bd, moon2: 0xcdbb92, whale1: 0x2f4f7c, whale2: 0xd2ccbc, whale3: 0x5f7c9e, hull: 0xc4572a, hull2: 0xf1e7d2, sail: 0xf2ead8, wood: 0x6b4a2e, foam: 0xf4f1ea,
  } : {
    sea1: 0x1f5d86, sea2: 0x3b8fb8, sea3: 0xe8f1ee, rock1: 0x7a6656, rock2: 0x9b8570, grass: 0x5d8238,
    white: 0xf3ece0, red: 0xd23b2e, dark: 0x2c2b33, glass: 0xffd36e, sky1: 0xf6a86a, sky2: 0x9a6aa6, sky3: 0x2c3a78,
    moon: 0xf6e7b0, moon2: 0xd9c48c, whale1: 0x46628a, whale2: 0xd9d4c5, whale3: 0x7d93ad, hull: 0xe0612a, hull2: 0xf5ecd8, sail: 0xf7f0de, wood: 0x7a5232, foam: 0xf7f5ee,
  });

  // lights
  hemi = new THREE.HemisphereLight(0x8790c8, 0x3b2c3c, FELT ? 0.55 : 0.5); scene.add(hemi);
  key = new THREE.DirectionalLight(0xffb27c, 3.4);
  key.position.set(-55, 34, -8); key.target.position.set(0, 0, -5);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -55, right: 55, top: 50, bottom: -50, near: 10, far: 160 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05; key.shadow.radius = 3;
  scene.add(key, key.target);
  fill = new THREE.DirectionalLight(0xb7c3ff, 0.45); fill.position.set(30, 20, 60); scene.add(fill);

  // backdrop cyc
  const bg = new THREE.CylinderGeometry(80, 80, 80, 96, 40, true, Math.PI - 1.0, 2.0);
  bg.translate(0, 40, 0);
  const back = obj(prep(bg), { kind: 'sky', c1: PAL.sky1, c2: PAL.sky2, c3: PAL.sky3, side: THREE.BackSide, shells: 0, freq: 2.0, bump: FELT ? 1.0 : 1.2, cast: false, var: FELT ? 0.3 : 0.45 });
  back.position.set(0, -2, 38);
  back.material.userData.U.uSSS.value = new THREE.Color(0.3, 0.3, 0.3);

  // moon
  const moonG = prep(new THREE.SphereGeometry(4.6, 64, 48).scale(1, 1, 0.38), FELT ? 0.12 : 0.18, 0.5, 3);
  const moon = obj(moonG, { kind: 'moon', c1: PAL.moon, c2: PAL.moon2, emissive: PAL.moon, emissiveIntensity: 0.25, shells: 10, shellLen: 0.35, hairs: 350, hairLen: 0.9, freq: 3.0, bump: 1.6 });
  moon.position.set(-15, 32, 38 - Math.sqrt(6400 - 225) + 2.4); jitterables.push(moon);
  // stars
  for (let i = 0; i < 7; i++) {
    const s = obj(prep(new THREE.SphereGeometry(0.45 + rnd() * 0.25, 20, 14).scale(1, 1, 0.5), 0.05, 1, i), { kind: 'flat', c1: 0xfff0c8, emissive: 0xfff0c8, emissiveIntensity: 0.6, shells: 5, shellLen: 0.15, freq: 6, cast: true });
    const x = -38 + rnd() * 76, y = 34 + rnd() * 22;
    s.position.set(x, y, 38 - Math.sqrt(80 * 80 - x * x) + 0.6);
    if (Math.abs(x + 15) < 8 && Math.abs(y - 32) < 8) s.position.x += 16;
    jitterables.push(s);
  }

  // cliff
  const cg = new THREE.SphereGeometry(1, 128, 96);
  {
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * 13, y = p.getY(i) * 16 + 2, z = p.getZ(i) * 10;
      const top = 12.5;
      if (y > top - 2) y = top - 2 + (y - (top - 2)) * 0.22;
      // strata bulges on the face
      const st = Math.sin(y * 1.3) * 0.35;
      const r = Math.hypot(x, z); x *= 1 + st / Math.max(r, 1) * 0.6; z *= 1 + st / Math.max(r, 1) * 0.6;
      p.setXYZ(i, x, y, z);
    }
  }
  const cliff = obj(prep(cg, FELT ? 1.1 : 1.4, 0.16, 5), { kind: 'cliff', c1: PAL.rock1, c2: PAL.rock2, c3: PAL.grass, shells: 8, shellLen: 0.4, hairs: 3000, hairLen: 1.1, hairCol: 0xa8a070, freq: 3.0, bump: 1.3 });
  cliff.position.set(18.5, 0, -14); cliff.rotation.y = 0.3;
  // rocks
  [[10.5, -6.5, 2.2], [13.5, -3.5, 1.4], [30, -2, 2.6]].forEach(([x, z, s], i) => {
    const r = obj(prep(new THREE.SphereGeometry(s, 48, 32).scale(1.3, 0.85, 1), s * 0.3, 0.5, i + 9), { kind: 'cliff', c1: PAL.rock1, c2: PAL.rock2, c3: PAL.rock2, shells: 8, shellLen: 0.25, hairs: 200, hairLen: 0.6, hairCol: 0xb0a090, freq: 3.5 });
    r.position.set(x, 0.1, z); jitterables.push(r);
  });

  // lighthouse
  const lh = new THREE.Group(); lh.position.set(19, 11.2, -14.5); scene.add(lh); jitterables.push(lh);
  const prof = [];
  for (let i = 0; i <= 40; i++) { const y = i / 40 * 13.2; prof.push(new THREE.Vector2(2.35 - 0.7 * (y / 13.2) + (FELT ? 0 : 0.05 * Math.sin(y * 2.1)), y)); }
  prof.push(new THREE.Vector2(0.0, 13.25));
  const tower = obj(prep(new THREE.LatheGeometry(prof, 64), FELT ? 0.05 : 0.1, 0.6, 2), { kind: 'stripes', c1: PAL.white, c2: PAL.red, shells: 8, shellLen: 0.18, hairs: 900, hairLen: 0.5, hairCol: 0xf0d8c8, hairAlt: 0xd06050, freq: 4.5 }, lh);
  const gal = obj(prep(new THREE.CylinderGeometry(2.35, 2.2, 0.5, 48, 2), 0.04, 1, 3), { kind: 'flat', c1: PAL.dark, shells: 6, shellLen: 0.12, freq: 5 }, lh); gal.position.y = 13.4;
  const glass = obj(prep(new THREE.CylinderGeometry(1.25, 1.25, 1.9, 40, 4), 0.02, 1, 4), { kind: 'flat', c1: PAL.glass, emissive: PAL.glass, emissiveIntensity: FELT ? 5.5 : 6.5, shells: 5, shellLen: 0.1, freq: 5, cast: false }, lh); glass.position.y = 14.6;
  const roof = obj(prep(new THREE.SphereGeometry(1.65, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1), 0.04, 1, 5), { kind: 'flat', c1: PAL.red, shells: 7, shellLen: 0.15, hairs: 150, hairLen: 0.4, hairCol: 0xe07060, freq: 5 }, lh); roof.position.y = 15.5;
  const knob = obj(prep(new THREE.SphereGeometry(0.38, 20, 14)), { kind: 'flat', c1: PAL.dark, shells: 5, shellLen: 0.1, freq: 6 }, lh); knob.position.y = 17.0;
  const door = obj(prep(new THREE.SphereGeometry(1, 24, 16).scale(0.65, 1.0, 0.3), 0.03, 1, 6), { kind: 'flat', c1: PAL.dark, shells: 4, shellLen: 0.08, freq: 6 }, lh); door.position.set(0.0, 1.1, 2.3);
  [[5.5, 2.1], [9.2, 1.85]].forEach(([y, r], i) => { const w = obj(prep(new THREE.SphereGeometry(0.42, 16, 12).scale(1, 1.3, 0.4)), { kind: 'flat', c1: 0x3a2e20, emissive: PAL.glass, emissiveIntensity: 0.8, shells: 3, shellLen: 0.05, freq: 6 }, lh); w.position.set(0.0, y, r); });
  lh.rotation.y = 0.35;

  lamp = new THREE.PointLight(0xffc477, FELT ? 260 : 300, 0, 2); lamp.position.set(0, 14.6, 0); lh.add(lamp);
  // rotating beam: spot light + additive cone
  spot = new THREE.SpotLight(0xffd79a, 9000, 0, 0.09, 0.7, 2); spot.position.set(0, 14.6, 0); lh.add(spot); lh.add(spot.target);
  const bgeo = new THREE.CylinderGeometry(0.6, 5.0, 60, 48, 1, true); bgeo.translate(0, 30, 0); bgeo.rotateZ(-Math.PI / 2);
  beam = new THREE.Mesh(bgeo, new THREE.ShaderMaterial({
    uniforms: { uInt: { value: 1.0 } },
    vertexShader: `varying float vX; varying vec3 vN; varying vec3 vV; void main(){ vX = position.x/60.0; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uInt; varying float vX; varying vec3 vN; varying vec3 vV; void main(){ float e = abs(dot(normalize(vN), normalize(vV))); float a = pow(e, 3.0)*pow(1.0-vX, 2.0)*smoothstep(0.0,0.03,vX); gl_FragColor = vec4(vec3(1.0,0.8,0.5)*a*0.4*uInt, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  beam.position.y = 14.6; lh.add(beam);

  // sea
  const sg = new THREE.PlaneGeometry(150, 110, 260, 190); sg.rotateX(-Math.PI / 2);
  sg.deleteAttribute('uv');
  sg.setAttribute('rest', sg.attributes.position.clone());
  seaBase = sg.attributes.position.array.slice();
  sea = obj(sg, { kind: 'sea', c1: PAL.sea1, c2: PAL.sea2, c3: PAL.sea3, shells: 6, shellLen: 0.3, hairs: 5000, hairLen: 0.8, hairCol: 0x9ab8cc, hairAlt: 0xe8eef0, freq: 3.2, bump: FELT ? 1.2 : 1.7, cast: false, boil: 0.0,
    hairFilter: (x, y, z) => z > -25 && z < 30 && x > -40 && x < 40 });
  sea.position.z = 0;

  // whale (straight rest coordinates: x = spine arc length from head, y up, z lateral)
  const L = WL, Rm = WRm;
  const wg = new THREE.CylinderGeometry(1, 1, 1, 56, 140, false); // we rebuild positions
  {
    const p = wg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getY(i) + 0.5; // 0..1 (top=1)
      let s = 1 - u; // 0 at head
      const ang = Math.atan2(p.getZ(i), p.getX(i));
      const isCap = Math.abs(Math.hypot(p.getX(i), p.getZ(i)) - 1) > 1e-3;
      const rr = isCap ? Math.hypot(p.getX(i), p.getZ(i)) : 1;
      const f = Math.pow(Math.max(s, 0) + 0.002, 0.42) * Math.pow(1 - s + 0.001, 1.25) / 0.53;
      let r = Rm * (f * 0.9 + 0.06) * rr;
      const ey = Math.sin(ang) , ez = Math.cos(ang);
      let y = ey * r * 0.86, z = ez * r * 1.05;
      if (ey < 0) y *= 0.85; // flatter belly
      // head bump / mouth line
      if (s < 0.25) y += r * 0.08 * Math.sin(s / 0.25 * Math.PI);
      // dorsal ridge toward tail
      if (s > 0.55 && ey > 0.85) y += 0.25 * (ey - 0.85) / 0.15 * Math.sin((s - 0.55) / 0.45 * Math.PI);
      p.setXYZ(i, s * L, y, z);
    }
  }
  // flukes
  const fg = new THREE.SphereGeometry(1, 48, 24);
  {
    const p = fg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // z = span (-1..1), x = chord, y = thickness
      const span = z * 5.6;
      const chord = 1.7 * (1 - 0.55 * Math.abs(z));
      let X = x * chord + 0.9 * Math.pow(Math.abs(z), 1.6) * 3.0;
      X -= 0.5 * Math.exp(-z * z * 60) * (x > 0 ? 1 : 0); // notch
      p.setXYZ(i, L + 1.2 + X, y * 0.36 * (1 - 0.5 * Math.abs(z)), span);
    }
  }
  const wgeo = prep(wg, 0, 0, 0), fgeo = prep(fg, 0, 0, 0);
  if (!FELT) { lumpRest(wgeo, 0.18, 0.35, 1); lumpRest(fgeo, 0.08, 0.6, 2); }
  whaleRest = wgeo.attributes.position.array.slice(); flukeRest = fgeo.attributes.position.array.slice();
  const wo = { kind: 'whale', c1: PAL.whale1, c2: PAL.whale2, c3: PAL.whale3, shells: 8, shellLen: 0.3, hairs: 1600, hairLen: 0.7, hairCol: 0x7f97b8, hairAlt: 0xa8b8cc, freq: 3.4, bump: 1.2, boil: 0 };
  whale = new THREE.Group(); scene.add(whale);
  whale.body = obj(wgeo, wo, whale); whale.fluke = obj(fgeo, { ...wo, hairs: 500 }, whale);
  whale.body.frustumCulled = whale.fluke.frustumCulled = false;
  whale.body.children.forEach(c => c.frustumCulled = false); whale.fluke.children.forEach(c => c.frustumCulled = false);

  // foam tufts / clay splash blobs
  for (let i = 0; i < 26; i++) {
    const r = 0.45 + rnd() * 0.6;
    const f = obj(prep(new THREE.SphereGeometry(r, 24, 16), r * 0.25, 1.0, i * 3), { kind: 'flat', c1: PAL.foam, shells: 8, shellLen: 0.3, hairs: 40, hairLen: 0.6, hairCol: 0xffffff, freq: 4.5, boil: 0.02 });
    f.userData = { side: i % 2, a: rnd() * Math.PI * 2, d: 0.6 + rnd() * 1.4, ph: rnd(), r };
    foam.push(f);
  }

  // boat
  boat = new THREE.Group(); scene.add(boat);
  const hg = new THREE.SphereGeometry(1, 64, 32);
  { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i) * 3.2, y = p.getY(i) * 1.25, z = p.getZ(i) * 1.35; if (y > 0.3) y = 0.3 + (y - 0.3) * 0.08; x *= 1 + 0.1 * Math.max(0, y); if (x > 0) z *= 1 - 0.35 * (x / 3.2) ** 2; p.setXYZ(i, x, y, z); } }
  obj(prep(hg, 0.08, 0.8, 7), { kind: 'hull', c1: PAL.hull, c2: PAL.hull2, shells: 8, shellLen: 0.15, hairs: 250, hairLen: 0.45, hairCol: 0xe08050, freq: 5.0 }, boat);
  const mast = obj(prep(new THREE.CylinderGeometry(0.13, 0.16, 5.2, 12, 8).translate(0, 2.6, 0), 0.02, 1, 3), { kind: 'flat', c1: PAL.wood, shells: 4, shellLen: 0.06, freq: 7 }, boat); mast.position.set(0.3, 0.3, 0);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.5, 0); sh.quadraticCurveTo(1.4, 2.2, 0, 4.4); sh.lineTo(0, 0);
  const sailG = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 24 });
  sailG.translate(0, 0, -0.06);
  const sail = obj(prep(sailG, 0.03, 1, 8), { kind: 'flat', c1: PAL.sail, shells: 7, shellLen: 0.13, hairs: 220, hairLen: 0.45, hairCol: 0xfff8ec, freq: 5.0 }, boat); sail.position.set(0.45, 1.0, 0);
  const flag = obj(prep(new THREE.BoxGeometry(0.8, 0.45, 0.06, 6, 4, 1), 0.02, 1, 3), { kind: 'flat', c1: PAL.red, shells: 4, shellLen: 0.06, freq: 7 }, boat); flag.position.set(0.75, 5.35, 0);
  boat.position.set(7.5, 0, 9); boat.rotation.y = 0.5;
}

function lumpRest(geo, amp, freq, seed) {
  const p = geo.attributes.position; geo.computeVertexNormals(); const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = (fbm3(x * freq + seed, y * freq, z * freq) - 0.5) * 2 * amp;
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  geo.attributes.rest.array.set(p.array); geo.attributes.rest.needsUpdate = true;
}

// ---------------------------------------------------------------- animation
const WH = { C: new THREE.Vector3(-8.0, 0, -3), R: 11, yc: 8.3, dir: new THREE.Vector3(0.42, 0, -0.91).normalize() };
WH.lat = new THREE.Vector3(-WH.dir.z, 0, WH.dir.x); // horizontal perpendicular
const WL = 20, WRm = 3.3;
const ease = (t) => t * t * (3 - 2 * t);
let spine = [];

function whaleState(t) {
  const u = ease(Math.min(1, t / 3.0));
  return { headA: -0.85 + u * 2.73, lift: Math.max(0, (t - 1.5) / 1.5), t };
}
function deformWhale(geo, rest, st, k) {
  const p = geo.attributes.position.array;
  const R = WH.R, yc = WH.yc;
  const L = WL;
  for (let i = 0; i < p.length; i += 3) {
    const sx = rest[i]; let ry = rest[i + 1], rz = rest[i + 2];
    // clay squash/stretch + soft morph
    if (!FELT) {
      const sq = 1 + 0.07 * Math.sin(st.t * 4.2 + sx * 0.25);
      ry *= sq; rz *= 1 / Math.sqrt(sq);
      const wob = 0.05 * Math.sin(sx * 0.9 + k * 1.7);
      ry *= 1 + wob; rz *= 1 + wob;
    }
    // tail bend: tail section curls up out of the water (circular bend around the lateral axis)
    let sxb = sx, lift = 0;
    const s0 = 12.5, Lb = 7.0, phi = 0.05 + 1.25 * ease(Math.min(1, st.lift));
    if (sx > s0) {
      const d = sx - s0, rho = Lb / phi;
      let cx, cy, a;
      if (d < Lb) { a = d / rho; cx = rho * Math.sin(a); cy = rho * (1 - Math.cos(a)); }
      else { a = phi; const e = d - Lb; cx = rho * Math.sin(phi) + e * Math.cos(phi); cy = rho * (1 - Math.cos(phi)) + e * Math.sin(phi); }
      sxb = s0 + cx - ry * Math.sin(a);
      lift = cy + ry * Math.cos(a) - ry;
    }
    const th = st.headA - sxb / R; // angle on arc
    const s = Math.sin(th), c = Math.cos(th);
    const ox = WH.C.x + WH.dir.x * R * s, oz = WH.C.z + WH.dir.z * R * s, oy = R * c - yc;
    // outward normal (in dir/y plane): (s*dir, c); tangent forward: (c*dir, -s)
    const nY = ry + lift;
    p[i] = ox + WH.dir.x * s * nY + WH.lat.x * rz;
    p[i + 1] = oy + c * nY;
    p[i + 2] = oz + WH.dir.z * s * nY + WH.lat.z * rz;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}
function computeSpine(st) {
  spine = [];
  const phi = 0.05 + 1.25 * ease(Math.min(1, st.lift)), s0 = 12.5, Lb = 7.0, rho = Lb / phi;
  for (let j = 0; j <= 40; j++) {
    const sx = j / 40 * (WL + 4);
    let sxb = sx, lift = 0;
    if (sx > s0) { const d = sx - s0; if (d < Lb) { const a = d / rho; sxb = s0 + rho * Math.sin(a); lift = rho * (1 - Math.cos(a)); } else { const e = d - Lb; sxb = s0 + rho * Math.sin(phi) + e * Math.cos(phi); lift = rho * (1 - Math.cos(phi)) + e * Math.sin(phi); } }
    const th = st.headA - sxb / WH.R, sn = Math.sin(th), cs = Math.cos(th);
    const u = sx / WL; const f = sx <= WL ? Math.pow(u + 0.002, 0.42) * Math.pow(1 - u + 0.001, 1.25) / 0.53 * 0.9 * WRm + 0.2 : 1.2;
    spine.push({ x: WH.C.x + WH.dir.x * (WH.R * sn + sn * lift), y: WH.R * cs - WH.yc + cs * lift, z: WH.C.z + WH.dir.z * (WH.R * sn + sn * lift), r: f });
  }
}
function waveH(x, z, k, t) {
  if (FELT) {
    const ph = t * 1.1;
    return 0.42 * Math.sin(0.42 * x + 0.3 * z + ph * 1.6) + 0.3 * Math.sin(-0.2 * x + 0.55 * z + 1.9 * ph + 1.0) + 0.8 * (fbm3(x * 0.12, z * 0.12 + t * 0.2, 0.5, 3) - 0.5);
  }
  // sculpted clay ridges: sharp crests, shifting each held frame
  const ph = t * 1.5 + (h3(k, 1, 2) - 0.5) * 0.25;
  const warp = (fbm3(x * 0.07, z * 0.07, k * 0.05, 3) - 0.5) * 3.5;
  const s1 = 0.5 + 0.5 * Math.sin(0.30 * x + 0.20 * z + ph + warp);
  const s2 = 0.5 + 0.5 * Math.sin(-0.13 * x + 0.36 * z + ph * 1.2 + 2.0 + warp * 0.6);
  return 1.35 * Math.pow(s1, 6.0) + 0.4 * Math.pow(s2, 3.0) + 0.25 * s1 - 0.5;
}
function updateSea(k, t) {
  const p = sea.geometry.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const x = seaBase[i], z = seaBase[i + 2];
    let y = waveH(x, z, k, t);
    // fade waves far away for a calmer horizon
    y *= 0.55 + 0.45 * Math.min(1, Math.max(0, (z + 40) / 30));
    // bulge where the whale breaks the surface
    let b = 0, rip = 0;
    if (x > -40 && x < 15 && z > -30 && z < 20) {
      for (const s of spine) {
        if (s.y + s.r < -1.0) continue;
        const dx = x - s.x, dz = z - s.z; const d2 = dx * dx + dz * dz;
        const R = s.r + 3.2; if (d2 > R * R * 4) continue;
        const d = Math.sqrt(d2);
        const prox = Math.min(1, Math.max(0, (s.y + s.r + 1.0) / (s.r + 1.0)));
        const v = prox * Math.exp(-Math.pow(Math.max(0, d - s.r * 0.7) / (FELT ? 2.2 : 1.8), 2));
        if (v > b) b = v;
        rip = Math.max(rip, prox * Math.exp(-d * 0.18) * Math.sin(d * 1.3 - t * 7.0));
      }
    }
    y += b * (FELT ? 0.9 : 1.1) + rip * (FELT ? 0.18 : 0.3);
    p[i + 1] = y;
  }
  sea.geometry.attributes.position.needsUpdate = true;
  sea.geometry.computeVertexNormals();
}

function updateFoam(k, t) {
  // two waterline crossings of the whale's spine
  const cross = [];
  for (let j = 0; j < spine.length - 1; j++) {
    const a = spine[j], b = spine[j + 1];
    if ((a.y + 0.3) * (b.y + 0.3) < 0) { const f = (a.y + 0.3) / (a.y - b.y); cross.push({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, r: a.r, up: a.y < b.y }); }
  }
  const jr = mulberry(k * 31 + 5);
  foam.forEach((f, i) => {
    const c = cross[f.userData.side % Math.max(1, cross.length)];
    if (!c) { f.visible = false; return; }
    f.visible = true;
    const a = f.userData.a, d = c.r * 0.9 + f.userData.d * 1.4;
    const lx = Math.cos(a) * d, lz = Math.sin(a) * d;
    const life = 0.5 + 0.5 * Math.sin(t * 3 + f.userData.ph * 6.28);
    const popped = FELT ? 1 : (0.6 + 0.8 * life);
    f.position.set(c.x + lx + (jr() - 0.5) * 0.1, 0.35 + life * (FELT ? 0.5 : 1.2), c.z + lz + (jr() - 0.5) * 0.1);
    const sq = FELT ? 1 : popped;
    f.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  });
}

// ---------------------------------------------------------------- post-processing
const rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(W, H) });
const rtDof = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const rtB1 = new THREE.WebGLRenderTarget(W / 4, H / 4, { type: THREE.HalfFloatType });
const rtB2 = new THREE.WebGLRenderTarget(W / 4, H / 4, { type: THREE.HalfFloatType });
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
function pass(fs, uniforms) { const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false }); const s = new THREE.Scene(); s.add(new THREE.Mesh(quadGeo, m)); return { s, m }; }
const dofPass = pass(`
  uniform sampler2D tColor, tDepth; uniform float uNear, uFar, uFocus, uK, uMax; uniform vec2 uRes; varying vec2 vUv;
  float linZ(float d){ float z = d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear - z*(uFar-uNear)); }
  float coc(float z){ return clamp(uK*abs(z-uFocus)/z, 0.0, uMax); }
  void main(){
    float zc = linZ(texture2D(tDepth, vUv).x); float cc = coc(zc);
    vec3 col = texture2D(tColor, vUv).rgb; float tot = 1.0;
    float rad = 0.9;
    for (int i=0; i<400; i++){
      if (rad >= uMax) break;
      float ang = float(i)*2.39996323;
      vec2 tc = vUv + vec2(cos(ang), sin(ang))*rad/uRes;
      vec3 sc = texture2D(tColor, tc).rgb;
      float zs = linZ(texture2D(tDepth, tc).x);
      float cs = coc(zs);
      if (zs > zc) cs = clamp(cs, 0.0, cc*2.0);
      float m = smoothstep(rad-0.5, rad+0.5, cs);
      col += mix(col/tot, sc, m); tot += 1.0;
      rad += 1.15/rad;
    }
    gl_FragColor = vec4(col/tot, 1.0);
  }`, { tColor: { value: null }, tDepth: { value: null }, uNear: { value: 5 }, uFar: { value: 400 }, uFocus: { value: 70 }, uK: { value: 30 }, uMax: { value: 16 }, uRes: { value: new THREE.Vector2(W, H) } });
const brightPass = pass(`uniform sampler2D tColor; uniform vec2 uRes; varying vec2 vUv;
  void main(){ vec3 s = vec3(0.0); for(int x=-2;x<2;x++) for(int y=-2;y<2;y++){ vec3 c = texture2D(tColor, vUv + (vec2(x,y)+0.5)/uRes).rgb; s += max(c - 0.9, 0.0); } gl_FragColor = vec4(s/16.0, 1.0); }`,
  { tColor: { value: null }, uRes: { value: new THREE.Vector2(W, H) } });
const blurPass = pass(`uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
  void main(){ vec3 s = vec3(0.0); float t=0.0; for(int i=-12;i<=12;i++){ float w = exp(-float(i*i)/50.0); s += texture2D(tColor, vUv + uDir*float(i)).rgb*w; t+=w; } gl_FragColor = vec4(s/t, 1.0); }`,
  { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });
const finalPass = pass(`uniform sampler2D tColor, tBloom; uniform float uExp, uSeed, uBloom; uniform vec3 uTint; varying vec2 vUv;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed)*43758.5453); }
  void main(){
    vec3 c = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb*uBloom;
    c *= uExp * uTint;
    vec2 q = vUv - 0.5; float vig = 1.0 - dot(q,q)*0.9; c *= vig;
    c = aces(c);
    c = pow(c, vec3(1.0/2.2));
    c = mix(vec3(dot(c, vec3(0.299,0.587,0.114))), c, 1.06);
    c += (hash(vUv*1000.0) - 0.5) * 0.028;
    gl_FragColor = vec4(c, 1.0);
  }`, { tColor: { value: null }, tBloom: { value: null }, uExp: { value: 1 }, uSeed: { value: 0 }, uBloom: { value: 0.5 }, uTint: { value: new THREE.Vector3(1, 1, 1) } });

// ---------------------------------------------------------------- frame
const tmpV = new THREE.Vector3();
window.setup = (style, scale) => {
  STYLE = style; FELT = style === 'felt';
  buildScene();
};
window.renderFrame = (k) => {
  const t = k * 2 / 30; // held on twos
  G.uK.value = k;
  const jr = mulberry(k * 101 + (FELT ? 1 : 2));
  const J = FELT ? 0.035 : 0.05;

  // camera: slow motion-control dolly (also stepped on twos)
  const u = t / 3;
  camera.position.set(-7 + 10 * u, 16.5 + 1.5 * u, 74 - 5 * u);
  camera.lookAt(1.5 + 1.5 * u, 11, -6);
  camera.updateMatrixWorld();

  // whale
  const st = whaleState(t);
  deformWhale(whale.body.geometry, whaleRest, st, k);
  deformWhale(whale.fluke.geometry, flukeRest, st, k);
  computeSpine(st);
  updateSea(k, t);
  updateFoam(k, t);

  // boat bobbing on the swell + whale wake
  const bx = 7.5, bz = 9;
  const bh = waveH(bx, bz, k, t);
  const hx = waveH(bx + 1.5, bz, k, t) - waveH(bx - 1.5, bz, k, t);
  const hz = waveH(bx, bz + 1, k, t) - waveH(bx, bz - 1, k, t);
  const wake = Math.max(0, Math.sin(t * 2.6 - 1.4)) * (FELT ? 0.08 : 0.12);
  boat.position.set(bx + (jr() - 0.5) * J, 0.35 + bh * 0.8 + (jr() - 0.5) * J, bz);
  boat.rotation.set(-hz * 0.25 + wake, 0.5 + (jr() - 0.5) * 0.02, hx * 0.2 + wake * 0.6);

  // stop-motion boil on props
  jitterables.forEach(o => {
    if (!o.userData.home) o.userData.home = { p: o.position.clone(), r: o.rotation.clone() };
    const h = o.userData.home;
    o.position.set(h.p.x + (jr() - 0.5) * J, h.p.y + (jr() - 0.5) * J * 0.5, h.p.z + (jr() - 0.5) * J);
    o.rotation.set(h.r.x + (jr() - 0.5) * 0.004, h.r.y + (jr() - 0.5) * 0.006, h.r.z + (jr() - 0.5) * 0.004);
  });

  // beam rotation (lighthouse group is rotated 0.35)
  const ba = -0.2 + t * 1.15;   // radians, sweeping toward camera and across
  const dir = new THREE.Vector3(Math.cos(ba), -0.07, Math.sin(ba));
  beam.rotation.set(0, -ba, -0.07);
  spot.target.position.set(dir.x * 50, 14.6 + dir.y * 50, dir.z * 50);
  lamp.intensity = (FELT ? 260 : 300) * (0.96 + jr() * 0.08);

  // hairs
  scene.updateMatrixWorld(true);
  hairMat.uniforms.keyDir.value.copy(key.position).sub(key.target.position).normalize();
  hairMat.uniforms.keyCol.value.copy(key.color).multiplyScalar(key.intensity * 0.35);
  hairMat.uniforms.ambCol.value.set(0.4, 0.38, 0.45);
  hairMat.uniforms.camPos.value.copy(camera.position);
  hairSets.forEach(hs => hs.update(k));

  // render
  renderer.setRenderTarget(rtScene); renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.render(scene, camera);
  // DOF: focus on the whale's breach point
  tmpV.set(-6, 3, -6).applyMatrix4(camera.matrixWorldInverse);
  dofPass.m.uniforms.uFocus.value = -tmpV.z;
  dofPass.m.uniforms.tColor.value = rtScene.texture; dofPass.m.uniforms.tDepth.value = rtScene.depthTexture;
  renderer.setRenderTarget(rtDof); renderer.render(dofPass.s, quadCam);
  brightPass.m.uniforms.tColor.value = rtDof.texture;
  renderer.setRenderTarget(rtB1); renderer.render(brightPass.s, quadCam);
  blurPass.m.uniforms.tColor.value = rtB1.texture; blurPass.m.uniforms.uDir.value.set(1.5 / (W / 4), 0);
  renderer.setRenderTarget(rtB2); renderer.render(blurPass.s, quadCam);
  blurPass.m.uniforms.tColor.value = rtB2.texture; blurPass.m.uniforms.uDir.value.set(0, 1.5 / (H / 4));
  renderer.setRenderTarget(rtB1); renderer.render(blurPass.s, quadCam);
  finalPass.m.uniforms.tColor.value = rtDof.texture; finalPass.m.uniforms.tBloom.value = rtB1.texture;
  finalPass.m.uniforms.uExp.value = (FELT ? 1.25 : 1.2) * (1 + (jr() - 0.5) * 0.03);
  finalPass.m.uniforms.uSeed.value = k * 1.37;
  renderer.setRenderTarget(null); renderer.render(finalPass.s, quadCam);
  return renderer.domElement.toDataURL('image/png');
};
window.ready = true;
