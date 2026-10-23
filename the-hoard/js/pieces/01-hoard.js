/* The Hoard — a sixty-second animated engraving.
 * A real 3D scene (procedural meshes, a spline-rigged dragon, analytic coin impostors) rasterised in
 * WebGL2 and shaded by an engraving shader: every tone is made of burin lines whose spacing is held in
 * screen space while their direction follows the form, swelling in shadow and thinning to nothing in light.
 * Every frame is a pure function of time: drawFrame(t), t in [0, 60].
 */
(function () {
  'use strict';

  /* ================================================================== constants & small maths */
  const W = 1080, H = 1350, DUR = 60, HOLD = 3.0;
  const DBGN = (/[?&]dbg=(\d+)/.exec(location.search) || [0, 0])[1] | 0;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);
  const EZ = {
    lin: (t) => t,
    io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    o: (t) => 1 - Math.pow(1 - t, 3),
    o2: (t) => 1 - (1 - t) * (1 - t),
    i: (t) => t * t * t,
    i2: (t) => t * t,
    s: (t) => -(Math.cos(PI * t) - 1) / 2,
  };
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      if (t <= k[0]) { const a = keys[i - 1], u = (t - a[0]) / (k[0] - a[0]); return lerp(a[1], k[1], EZ[k[2] || 's'](u)); }
    }
    return keys[keys.length - 1][1];
  }
  // vec3
  const v3 = (x, y, z) => [x, y, z];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const madd = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function rotAxis(v, k, a) { // Rodrigues
    const c = Math.cos(a), s = Math.sin(a), d = dot(k, v), cr = cross(k, v);
    return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)];
  }
  // Catmull-Rom through points (centripetal-ish uniform)
  function crPt(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t, o = [0, 0, 0];
    for (let i = 0; i < 3; i++) o[i] = 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
    return o;
  }
  function crPath(pts, u) { // u in [0,1] across all segments
    const n = pts.length - 1, x = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
    return crPt(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(n, i + 2)], f);
  }
  // mat4 (column-major)
  function perspective(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  }
  function lookAt(e, c, up) {
    const z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x), m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -dot(x, e); m[13] = -dot(y, e); m[14] = -dot(z, e); m[15] = 1; return m;
  }
  function mmul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  }

  /* ================================================================== seeded randomness & noise */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let SEED = 7, RNG = mulberry32(7);
  function hh(n) {
    n = (n ^ 0x9e3779b9) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  const hr = (i, k) => hh((i * 7919 + k * 104729 + SEED * 15485863) | 0);
  let PERM = null, GRAD = null;
  function initNoise(seed) {
    const r = mulberry32(seed ^ 0x5bd1e995);
    PERM = new Uint8Array(512); GRAD = new Float32Array(256);
    const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
    for (let i = 0; i < 256; i++) GRAD[i] = r() * 2 - 1;
  }
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), X = xi & 255, Y = yi & 255;
    const a = GRAD[PERM[PERM[X] + Y]], b = GRAD[PERM[PERM[X + 1] + Y]], c = GRAD[PERM[PERM[X] + Y + 1]], d = GRAD[PERM[PERM[X + 1] + Y + 1]];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  const n1 = (x) => n2(x, 17.31);
  function fbm(x, y, o) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < (o || 4); i++) { s += a * n2(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

  /* ================================================================== the hall of Erebor: layout */
  // Units are metres. The hall runs along -z; the camera flies from the entrance bank (z ~ +34) toward the
  // great mound (z ~ -95) where the dragon lies. Pillars stand in two ranks at x = +-PX.
  const PX = 15, WALLX = 24, PZ0 = 40, PDZ = 13, NPIL = 16, ZBACK = -172, ZFRONT = 52;
  const MOUND = [0, -95], MR = 16.5, MH = 9.0;
  const RIDGEZ = -58;
  // the hook: a coin rolls along the lip of the entrance bank, then falls down its face
  const HOOK = { z: 33.7, top: 3.05 };
  let PILES = [];
  function makePiles(rng) {
    PILES = [];
    for (let k = 0, tries = 0; k < 140 && tries < 2000; k++, tries++) {
      const z = lerp(-150, 24, rng()); let x = lerp(-21, 21, rng());
      const cx = corridorX(z); if (Math.abs(x - cx) < 2.8) x = cx + Math.sign(x - cx || 1) * (2.8 + rng() * 2);
      if (Math.hypot(x - MOUND[0], z - MOUND[1]) < 30 || (x > 14 && z > -55 && z < -10)) { k--; continue; }
      const r = 1.6 + rng() * 3.6, hgt = (0.5 + rng() * 1.6) * (0.6 + 0.4 * sstep(3, 12, Math.abs(x)));
      PILES.push([x, z, r, hgt]);
    }
  }
  function corridorX(z) { return 1.2 * Math.sin(z * 0.045 + 0.6) - 0.8 * Math.sin(z * 0.11); }
  function heapH(x, z) {
    let h = 0.75;
    const hook = Math.exp(-((x - 0.2) * (x - 0.2)) / 18 - ((z - 33.7) * (z - 33.7)) / 30);
    // the entrance bank: a broad step of gold whose lip runs across the hall at z ~ HOOK.z
    const bank = sstep(25.0, 33.55, z);
    h += 2.3 * bank;
    const rough = 1 - 0.92 * hook;
    h += rough * (1.5 * fbm(x * 0.055 + 3.1, z * 0.047 + 1.3, 3) + 0.45 * fbm(x * 0.21 + 9.0, z * 0.19, 3));
    // separate piles, each a soft cone of coins with a rounded crown
    for (let k = 0; k < PILES.length; k++) {
      const p = PILES[k], dx = x - p[0], dz = z - p[1];
      if (dx > 9 || dx < -9 || dz > 9 || dz < -9) continue;
      const r2 = (dx * dx + dz * dz) / (p[2] * p[2]);
      if (r2 < 4) h += p[3] * Math.pow(Math.max(0, 1 - r2 / 4), 1.6);
    }
    // gold banked against the pillar ranks and walls
    h += 2.6 * sstep(7, 19, Math.abs(x)) + 1.2 * sstep(19, 23.5, Math.abs(x));
    // the low valley the camera flies along
    const cx = corridorX(z);
    h -= 0.85 * Math.exp(-((x - cx) * (x - cx)) / 30) * sstep(30, 22, z) * sstep(-62, -40, z);
    // the ridge the camera rises over
    h += 4.0 * Math.exp(-((z - RIDGEZ) * (z - RIDGEZ)) / 22) * (0.8 + 0.2 * Math.cos(x * 0.2));
    // the great mound and its shoulder
    const dx = x - MOUND[0], dz = z - MOUND[1];
    h += MH * Math.exp(-(dx * dx + dz * dz) / (2 * MR * MR));
    h += 2.2 * Math.exp(-((dx - 9) * (dx - 9) + (dz + 10) * (dz + 10)) / 60);
    // under the stair (right wall) the gold thins out to the floor
    h -= 1.2 * sstep(17, 22, x) * sstep(-50, -42, z) * sstep(-8, -16, z);
    return h;
  }
  function heapN(x, z) {
    const e = 0.05;
    return norm([heapH(x - e, z) - heapH(x + e, z), 2 * e, heapH(x, z - e) - heapH(x, z + e)]);
  }
  // stair: up the right wall toward the secret door
  const STAIR = { x0: 20.6, x1: WALLX, z0: -46, z1: -15.5, y0: 0.0, y1: 18.0, n: 40 };
  const DOOR = { z0: -15.4, z1: -12.6, y0: 18.0, y1: 21.6 };
  // shafts of daylight come through slits high in the left wall; each is specified by where it lands
  const WINY = 58;
  let SUNDIR = norm([0.42, 0.88, 0.2]); // toward the light; it falls down to the right
  const SHAFTS = [
    // [landing x, y, z, half-width x, half-width z]
    [0.0, 3.05, 33.75, 0.022, 0.9],     // 0 the thin thread across the bank's lip (the hook glint)
    [0.6, 1.0, 26.5, 1.3, 2.6],          // 1 on the face of the bank, where the avalanche runs
    [-2.5, 1.0, -8.0, 0.9, 2.6],         // 2
    [3.0, 1.4, -31.0, 1.4, 1.8],         // 3
    [-1.0, 4.5, -57.0, 2.2, 1.6],        // 4 on the ridge
    [-3.5, 9.0, -92.0, 3.2, 2.4],        // 5 on the dragon
    [2.4, 6.0, -75.6, 0.7, 1.0],         // 6 on the cup
    [22.3, 12.0, -26.0, 1.5, 7.5],       // 7 the stair
  ];
  function settleShafts() { for (let i = 1; i < 7; i++) SHAFTS[i][1] = heapH(SHAFTS[i][0], SHAFTS[i][2]) + (i === 1 ? 0.2 : 0); }
  let F0W = null;
  // the shafts that matter to this view, nearest first
  function shaftWindows(sun, cam) {
    const cand = [];
    SHAFTS.forEach((s, i) => {
      const k = (WINY - s[1]) / sun[1], land = [s[0], s[1], s[2]], d = sub(cam, land), u = clamp(dot(d, sun), 0, k);
      const dist = len(sub(d, mul(sun, u)));
      if (dist < 75) cand.push({ i, dist, w: [s[0] + sun[0] * k, s[2] + sun[2] * k, s[3], s[4]] });
    });
    cand.sort((a, b) => a.dist - b.dist);
    const o = new Float32Array(32), wk = new Float32Array(8); let n = 0;
    const W8 = F0W || [];
    for (const c of cand.filter((c) => (W8[c.i] === undefined ? 1 : W8[c.i]) > 0).slice(0, 3)) { o.set(c.w, n * 4); wk[n] = W8[c.i] === undefined ? 1 : W8[c.i]; n++; }
    return { win: o, wk, n };
  }

  /* ================================================================== GLSL: the engraving library */
  const GLSL_LIB = `
precision highp float; precision highp int;
#define DBG ${DBGN}
#ifndef LSF
#define LSF 0
#endif
#ifndef DOF
#define DOF 0
#endif
#ifndef PLATE
#define PLATE 0
#endif
#define PI 3.14159265
uniform mat4 uVP; uniform vec3 uCam; uniform float uT; uniform float uPx; uniform float uSeed;
uniform float uLP; uniform float uExpo; uniform vec2 uRes;
uniform vec3 uSunDir; uniform vec3 uSunC; uniform float uWinY; uniform vec4 uWin[8]; uniform float uWinK[8]; uniform float uShaftK;
uniform vec4 uGlow; uniform vec3 uGlowC;
uniform vec4 uFire[4]; uniform vec3 uFireC; uniform int uNF; uniform int uNW;
uniform vec4 uLamp; uniform vec3 uLampC;
uniform vec3 uAmbC; uniform float uFogD; uniform float uVoid; uniform float uEnvK;
uniform vec3 uCR; uniform vec3 uCU; uniform vec3 uCF; uniform float uTanF; uniform float uAsp;
uniform vec4 uFocus;      // focus distance, coc px per unit of defocus, max coc, unused
uniform float uHeat;       // 0..1: how white-hot the engraving goes in the fire
const vec3 PAPER = vec3(0.925, 0.862, 0.735);
const vec3 INK = vec3(0.085, 0.066, 0.056);
const vec3 GAMB = vec3(0.96, 0.72, 0.26);
const vec3 VERM = vec3(0.88, 0.33, 0.14);
const vec3 SIEN = vec3(0.66, 0.33, 0.15);
const vec3 HOTL = vec3(1.0, 0.62, 0.2);
float h11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz)*p3.zy); }
vec4 h42(vec2 p){ vec4 p4 = fract(vec4(p.xyxy)*vec4(.1031, .1030, .0973, .1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw)*p4.zywx); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  float a = h21(i), b = h21(i+vec2(1,0)), c = h21(i+vec2(0,1)), d = h21(i+1.);
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm2(vec2 p){ return vn(p)*.5 + vn(p*2.03+7.1)*.25 + vn(p*4.1+3.3)*.125 + vn(p*8.3+1.7)*.0625; }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); float k = i.z*17.13;
  float a = mix(vn(i.xy + k + f.xy), vn(i.xy + k + 17.13 + f.xy), f.z); return a; }

// one family of burin lines. x: line parameter in periods; psi: along-line coordinate in periods;
// ppx: pixels per period. Lines swell (sw) along their length, wander slightly, and break up in the light.
float stripe(float x, float psi, float tone, float ppx, float jit, float soft){
  float id = floor(x + .5);
  float hid = fract(id*.6180339 + jit*.1371);
  hid = fract(hid*hid*91.7 + hid*13.3);
  float ph = hid*6.283;
  float s1 = sin(psi*.19 + ph), s2 = sin(psi*.047 + ph*3.);
  float d = abs(fract(x + s1*.05 + .5) - .5);
  float sw = .82 + .3*s2;
  float br = .5 + .3*s2*s1 + .2*sin(psi*.41 + ph*5.);
  float hw = tone*.5*sw*smoothstep(.0, .22, tone*2.4 - br*.75 + .06);
  return clamp((hw - d)*ppx/soft + .5, 0., 1.);
}
float hatchL(float phi, float psi, float tone, float w, float jit, float soft){
  // Dore's manner: wide-spaced hair lines in the light, close-set swelling lines in the shade
  w *= mix(2.1, .78, smoothstep(.06, .8, tone));
  float L = log2(max(uLP*w, 1e-8));
  float Lf = floor(L), fr = L - Lf, s = exp2(Lf);
  float k = smoothstep(0., 1., fr);
  float a = k < .98 ? stripe(phi/s, psi/s, tone, s/w, jit, soft) : 0.;
  float b = k > .02 ? stripe(phi/(2.*s), psi/(2.*s), tone, 2.*s/w, jit, soft) : 0.;
  return mix(a, b, k);
}
// tone 0 = paper, 1 = black. Three layers: the form lines, a cross-hatch, a third diagonal in the deepest shadow.
float engrave(float tone, float phi, float psi, float wphi, float wpsi, float jit, float soft){
  tone = clamp(tone, 0., 1.);
#if DBG == 10
  return tone;
#endif
  // the form lines carry the tone to the half-tones; a cross-hatch at ~60 degrees deepens the shadows
  float t1 = min(tone*1.15, .84);
  float t2 = clamp((tone - .52)*1.6, 0., .8);
  float c = hatchL(phi, psi, t1, wphi, jit, soft);
  // the second cut crosses the first at a shallow angle, so the shade breaks into long lozenges
  float p2 = phi*.8 + psi*.6, q2 = psi*.8 - phi*.6;
  float w2 = sqrt(wphi*wphi*.64 + wpsi*wpsi*.36);
  c = 1. - (1. - c)*(1. - hatchL(p2, q2, t2, w2, jit + 3.7, soft));
  // the deepest shadows close up into a velvet black, as the lines run together on the plate
  return max(c, smoothstep(.74, .97, tone)*.985);
}
float shaftAt(vec3 P){
  float k = (uWinY - P.y)/uSunDir.y; vec2 q = P.xz + uSunDir.xz*k;
  float m = 0.; float pen = .004*k + .02;
  for (int i = 0; i < 8; i++){ if (i >= uNW) break; vec4 w = uWin[i]; vec2 d = abs(q - w.xy) - w.zw; float e = max(d.x, d.y); m = max(m, 1. - smoothstep(-pen, pen, e)); }
  return m;
}
// length of a view ray inside the shafts of daylight (each shaft is an oblique prism below its window)
float shaftLen(vec3 O, vec3 D, float tmax, float grow){
  float acc = 0.;
  vec2 A = O.xz + uSunDir.xz*(uWinY - O.y)/uSunDir.y;
  vec2 Bv = D.xz - uSunDir.xz*D.y/uSunDir.y;
  Bv = vec2(abs(Bv.x) < 1e-5 ? 1e-5 : Bv.x, abs(Bv.y) < 1e-5 ? 1e-5 : Bv.y);
  float tTop = D.y > 1e-5 ? (uWinY - O.y)/D.y : 1e9;
  tmax = min(tmax, tTop);
  for (int i = 0; i < 8; i++){
    if (i >= uNW) break;
    vec4 w = uWin[i];
    vec2 hw = w.zw*grow;
    vec2 lo = (w.xy - hw - A)/Bv, hi = (w.xy + hw - A)/Bv;
    vec2 t0 = min(lo, hi), t1 = max(lo, hi);
    float a = max(max(t0.x, t0.y), 0.), b = min(min(t1.x, t1.y), tmax);
    acc += max(b - a, 0.)*uWinK[i];
  }
  return acc;
}
float pointAtt(vec3 P, vec4 L){ vec3 d = L.xyz - P; return 1./(1. + dot(d,d)/(L.w*L.w)); }
// diffuse irradiance split into cool (daylight, ambient) and warm (glow, fire, lamp) parts, plus specular
void lighting(vec3 P, vec3 N, vec3 V, float shin, out vec3 Dc, out vec3 Dw, out vec3 S){
  Dc = uAmbC*(.55 + .45*N.y); Dw = vec3(0); S = vec3(0);
#if DBG == 11
  return;
#endif
  float sm = shaftAt(P);
  if (sm > 0.){ float nl = max(dot(N, uSunDir), 0.); Dc += uSunC*sm*nl; vec3 Hh = normalize(uSunDir + V); S += uSunC*sm*pow(max(dot(N,Hh),0.), shin)*nl*(shin+8.)/16.; }
  vec3 L; float a, nl;
  L = normalize(uGlow.xyz - P); a = pointAtt(P, uGlow); nl = max(dot(N,L), 0.)*.9 + .1*max(dot(N,L)+.3, 0.);
  Dw += uGlowC*a*nl; S += uGlowC*a*pow(max(dot(N, normalize(L+V)),0.), shin)*(shin+8.)/16.*max(dot(N,L),0.);
#if LSF
  for (int i = 0; i < 4; i++){
    L = normalize(uFire[i].xyz - P); a = pointAtt(P, uFire[i]); nl = max(dot(N,L), 0.);
    Dw += uFireC*a*nl; S += uFireC*a*pow(max(dot(N, normalize(L+V)),0.), shin)*.6;
  }
#endif
  L = normalize(uLamp.xyz - P); a = pointAtt(P, uLamp); nl = max(dot(N,L), 0.);
  Dw += uLampC*a*nl; S += uLampC*a*pow(max(dot(N, normalize(L+V)),0.), shin)*(shin+8.)/16.*nl;
}
vec3 envRefl(vec3 R, vec3 P){
  // what polished gold sees in the hall: dark vault, a band of lit gold at the horizon, the glow, the shafts
  float ry = R.y + .05;
  float hor = .55/(1. + ry*ry*20.) + max(-R.y, 0.)*.3;
  float stri = .06*sin(R.x*23. + R.z*17.)*sin(R.y*31.);
  vec3 Lg = normalize(uGlow.xyz - P);
  float gd = max(dot(R, Lg), 0.); gd *= gd; gd *= gd;
  float band = exp(-pow((R.y + .08)/.16, 2.)) + .35*exp(-pow((R.y - .45)/.1, 2.));
  return uAmbC*(hor + stri)*3. + uGlowC*(gd*2. + hor*.06)*pointAtt(P, uGlow) + vec3(.42, .34, .22)*band*uEnvK;
}
`;

  /* ================================================================== GLSL: surfaces */
  const VS_MESH = `#version 300 es
in vec3 aP; in vec3 aN; in vec2 aUV; in vec2 aAux;
uniform mat4 uVP; uniform mat4 uM;
out vec3 vP; out vec3 vN; out vec2 vUV; out vec2 vAux;
void main(){ vec4 w = uM*vec4(aP, 1.); vP = w.xyz; vN = mat3(uM)*aN; vUV = aUV; vAux = aAux; gl_Position = uVP*w; }`;

  const MAT_HEAP = `
    // ---------------- the hoard: a carpet of engraved coins, each a tilted disc with a rim
    ao = vAux.y;
    float cs = .05;
    vec2 xz = P.xz;
    float fl = 0.;
    { vec2 dd = xz - uFlow.xy; float rr = length(dd); fl = uFlow.z*smoothstep(uFlow.w, uFlow.w*.3, rr)*smoothstep(0., .6, uFlow.y - xz.y + .4); xz.y += fl; }
    vec2 q = xz/cs;
    float cpx = cs/wP;
    float det = smoothstep(2.2, 5., cpx);
    vec2 cf = normalize(uCF.xz + vec2(1e-4, 0.)), cr = vec2(-cf.y, cf.x);
    phi = P.y*.6 + dot(P.xz, cf)*.3; psi = dot(P.xz, cr); wm = 0.;
    vec3 up = vec3(0,1,0);
    float topZ = -9., be = 2., bta = 0., bid = 0.; vec2 bd = vec2(0), btd = vec2(1, 0);
    vec2 ci = floor(q), sg = sign(fract(q) - .5);
    float zs[4], es[4];
    for (int k = 0; k < 4; k++){
      vec2 c = ci + vec2(k == 1 || k == 3 ? sg.x : 0., k >= 2 ? sg.y : 0.);
      vec4 r = h42(c + uSeed);
      vec2 ctr = c + .5 + (r.xy - .5)*.5;
      float rnd = r.z, rad = .56 + .12*r.w;
      float an = fract(r.z*7.31 + r.w*3.7)*6.2832; vec2 td = vec2(cos(an), sin(an));
      float ta = .12 + .6*fract(r.x*5.13 + r.w*9.7); float ca = sqrt(1. - ta*ta);
      vec2 d = q - ctr; float a = dot(d, td)/ca, b = dot(d, vec2(-td.y, td.x));
      float e = length(vec2(a, b))/rad;
      float z = rnd*.7 + a*ta*.9;
      zs[k] = z; es[k] = e;
      if (e < 1. && z > topZ){ topZ = z; be = e; bd = vec2(a, b)/rad; btd = td; bta = ta; bid = rnd; }
    }
    float sh = 0.;
    for (int k = 0; k < 4; k++){ float e = es[k], z = zs[k]; if (e >= 1. && e < 1.45 && z > topZ + .04) sh = max(sh, (1. - (e - 1.)/.45)*smoothstep(.04, .3, z - topZ)); }
    float onCoin = step(be, 1.);
    {
      vec2 rd = bd/max(be, 1e-3);
      float r = min(be, 1.);
      float dh = (r > .92 ? -2.6 : 0.) + ((r > .8 && r < .86) ? 2.4 : 0.) + ((r < .8 && r > .3) ? .18 : 0.) + (r < .32 ? -.9*(r/.32) : 0.);
      float ang = atan(bd.y, bd.x) + bid*40.;
      dh += (r > .62 && r < .74) ? .8*sin(ang*22.) : 0.;
      vec3 tdw = vec3(btd.x, 0., btd.y), tpw = vec3(-btd.y, 0., btd.x);
      float ca = sqrt(1. - bta*bta);
      vec3 nT = normalize(tdw*(-bta) + up*ca);
      vec3 radW = normalize(tdw*rd.x*ca + tpw*rd.y + up*rd.x*bta + 1e-5);
      vec3 nC = normalize(nT - radW*dh*.32*det);
      float k = det*onCoin;
      N = normalize(Ng + (nC - up)*1.15*k);
      ink2 = max(smoothstep(.9, .99, r)*.85*k, smoothstep(.045, .0, abs(r - .8))*.5*k*smoothstep(5., 12., cpx));
      phi = mix(phi, dot(q, tpw.xz)*cs + bid*.3, k); psi = mix(psi, dot(q, tdw.xz)*cs, k); wm = k;
      jit = bid*13.;
    }
    ao *= mix(1., .12, det*(1. - onCoin));
    ao *= 1. - sh*.75*det;
    metal = mix(.6, 1., det);
    alb = .5; shin = 36.; specK = 1.6;
    wash = GAMB; washA = .55;
    // where the coins are too small to draw one by one, the heap glitters: a sparse field of glints,
    // each a coin turned just so toward the light, on a grid that coarsens with distance
    {
      float gl = log2(max(4.5*wP/cs, 1.)); float gf = floor(gl), gk = gl - gf;
      float gsz = cs*exp2(gf);
      float acc = 0.;
      for (int lv = 0; lv < 2; lv++){
        float g = gsz*(lv == 0 ? 1. : 2.);
        vec2 qq = P.xz/g; vec2 cc = floor(qq);
        vec4 r = h42(cc + 31.7 + float(lv)*7.);
        vec2 sp = cc + .2 + .6*r.xy;
        vec3 gn = normalize(vec3((r.z - .5)*1.6, 1., (r.w - .5)*1.6));
        vec3 Lg = normalize(uGlow.xyz - P);
        float sm = shaftAt(P);
        vec3 Rg = reflect(-V, gn);
        float sp1 = pow(max(dot(Rg, uSunDir), 0.), 30.)*sm*2. + pow(max(dot(Rg, Lg), 0.), 20.)*pointAtt(P, uGlow)*dot(uGlowC, vec3(.3)) + pow(max(dot(Rg, normalize(uLamp.xyz - P)), 0.), 20.)*pointAtt(P, uLamp)*dot(uLampC, vec3(.5));
        float rpx = length((qq - sp)*g)/wP;
        float spot = smoothstep(1.6, .4, rpx)*step(.45, fract(r.x*13.7 + r.y*5.1));
        acc += spot*min(sp1*uExpo*2., 1.)*(lv == 0 ? 1. - gk : gk);
      }
      lite = max(lite, acc*(1. - det*.7)*1.4);
    }
    vec2 fg; float fm = footprints(P.xz, fg);
    ao *= 1. - fm*.55; N = normalize(N + vec3(fg.x, 0., fg.y)*.06); ink3 = fm*.45;
`;
  const MAT_STONE = `
    float part = floor(vAux.y + .5);
    float a = vUV.x, y = vUV.y;
    alb = .5; shin = 4.; specK = .05;
    phi = a; psi = y;
    float n = vn(vec2(a, y)*1.3)*.6 + vn(vec2(a, y)*3.1)*.4;
    alb *= .8 + .4*n;
    phi = y; psi = a;
    // the joints between drums, blocks and courses
    float cy = part > 2.5 && part < 3.5 ? 1.3 : part > 1.5 && part < 2.5 ? 1.4 : 2.6;
    float j = abs(fract(y/cy) - .5)*cy;
    float jl = (part < .5 || part > 5.5) ? 0. : 1.;
    float cw = part > 2.5 ? 2.1 : 1.6;
    float jv = abs(fract(a/cw + floor(y/cy)*.5) - .5)*cw;
    float isTread = step(3.5, part)*step(part, 4.5), isRiser = step(4.5, part)*step(part, 5.5);
    ink2 = max(smoothstep(.045, .016, j)*.78, smoothstep(.04, .014, jv)*.65*jl)*(1. - isTread);
    lite = smoothstep(.075, .045, abs(j - .065))*.5*(1. - isTread);
    if (part > 3.5 && part < 4.5){ phi = a; psi = y; }
    phi = mix(phi, vUV.y*2., isRiser);
    vec2 fg; float fm = footprints(P.xz, fg);
    alb = mix(alb, .85, isTread);
    ink3 = fm*.8*isTread*smoothstep(.15, .5, fm); ao *= 1. - fm*.5*isTread;
`;
  const MAT_BAND = `
    float a = vUV.x, y = vUV.y;
    vec3 T = normalize(cross(vec3(0,1,0), Ng) + vec3(1e-5, 0, 0)); vec3 B = cross(Ng, T);
    alb = .52; shin = 4.; specK = .05;
    phi = y; psi = a;
    float bi = floor(y/10.);
    float yc = bi*10. + 8.5;
    vec2 uv = vec2(a/.95, (y - yc)/.85);
    float e = .02;
    vec2 kn = knot(uv);
    float hx = knot(uv + vec2(e, 0)).x - kn.x, hy = knot(uv + vec2(0, e)).x - kn.x;
    float r = runes(vec2(a/.8, (y - yc)/.85), bi + 3.);
    float r2 = runes(vec2(a/.8, (y - yc + .03)/.85), bi + 3.);
    float isK = step(mod(bi, 2.), .5);
    N = normalize(N - (T*hx/.95 + B*hy/.85)/e*.035*isK);
    ink2 = mix(r*.9, kn.y*.9, isK);
    lite = max(r2 - r, 0.)*.8*(1. - isK);
`;
  const MAT_METAL = `
    float gold = step(vAux.x, 2.5);
    phi = vUV.x; psi = vUV.y;
    alb = .34; shin = 46.; specK = 3.; metal = 1.2;
    wash = mix(vec3(.9, .88, .84), GAMB, gold); washA = mix(.3, .9, gold);
    float band = abs(fract(vUV.y/.035) - .5); ink2 = smoothstep(.06, .0, band)*.25;
`;
  const MAT_GEM = `
    vec3 ft = normalize(cross(N, vec3(.31, .95, .17)));
    phi = dot(P, ft); psi = dot(P, cross(N, ft));
    alb = .2; shin = 90.; specK = 3.; metal = 1.;
    float gi = floor(vAux.y + .5);
    wash = gi < .5 ? VERM : gi < 1.5 ? GAMB : gi < 2.5 ? SIEN : vec3(1); washA = gi < 2.5 ? 1. : 0.;
    lite = h21(floor(N.xy*9.) + gi)*.4;
`;
  let DRAGON_MAT = '';

  DRAGON_MAT = `
  vec2 duv1 = dFdx(vUV), duv2 = dFdy(vUV);
  vec3 dp2perp = cross(dPy, Ng), dp1perp = cross(Ng, dPx);
  vec3 Tt = dp2perp*duv1.x + dp1perp*duv2.x, Bt = dp2perp*duv1.y + dp1perp*duv2.y;
  float imx = inversesqrt(max(max(dot(Tt, Tt), dot(Bt, Bt)), 1e-12)); Tt *= imx; Bt *= imx;
#if MAT == 4
  // ---------------- armour plates: shingled, each with a keel, a lit lip and a shadow where it overlaps the next
  float ax = vAux.y;
  float rowsN = 28.;
  #define edgeD0(xl, fy) (xl - .4*(1. - 3.6*fy*fy))
  vec2 g = vec2(vUV.x, vUV.y*rowsN);
  float row = floor(g.y);
  float gx = g.x + mod(row, 2.)*.5;
  float xl = fract(gx), fy = fract(g.y) - .5;
  float cpx = 1./max(fwidth(g.x), 1e-5);
  float det = smoothstep(7., 16., cpx);
  float flick = (1. - det)*smoothstep(2., 5., cpx)*step(.82, h21(vec2(floor(gx), row)))*smoothstep(.12, .0, abs(edgeD0(xl, fy)));
  float cellW = wP*cpx;
  float belly = ax >= 0. ? smoothstep(.17, .12, abs(vUV.y - .5)) : 0.;
  float ov = .4*(1. - 3.6*fy*fy);
  float onPrev = step(xl, ov);
  float edgeD = xl - ov;
  float lip = smoothstep(.13, .0, -edgeD)*onPrev;
  float shade = smoothstep(.0, .06, edgeD)*smoothstep(.42, .06, edgeD);
  float outline = smoothstep(.06, .0, abs(edgeD))*.9 + smoothstep(.43, .5, abs(fy))*.55*(1. - onPrev);
  float keel = 1. - abs(fy)*2.;
  // belly: broad pale scutes across the body
  float bx = fract(g.x*.5), bov = .22*(1. - pow(abs(vUV.y - .5)/.17, 2.));
  float bed = bx - bov;
  float bOut = smoothstep(.04, .0, abs(bed))*.8;
  float bShade = smoothstep(.0, .05, bed)*smoothstep(.3, .05, bed);
  float tilt = mix(.42, .2, belly);
  vec3 Np = normalize(N - Tt*tilt*det*(1. - onPrev*.3) - Bt*(-fy*2.)*.35*det*(1. - belly));
  N = normalize(mix(Np, normalize(N - Tt*.3*det), belly));
  ink2 = mix(max(outline, shade*.75), max(bOut, bShade*.6), belly)*det;
  lite = mix(lip*(ax < -1.5 ? .35 : .9) + smoothstep(.2, .0, abs(fy))*keel*.15, smoothstep(.1, .0, -bed)*.3, belly)*det;
  ao *= 1. - mix(shade, bShade, belly)*.5*det;
  lite = max(lite, flick*.9*(1. - belly));
  // engraved lines run parallel to each plate's free edge, so every plate is cut as its own curved shield
  float plateK = det*(1. - belly);
  phi = mix(g.x*cellW, (xl - ov)*cellW + row*.37*cellW, plateK); psi = mix(g.y*cellW, fy*cellW, plateK);
  phi = mix(phi, (bx - bov)*cellW*2., belly*det);
  wm = plateK + belly*det;
  jit = row*1.7 + floor(gx)*.31;
  alb = mix(.42, .34, belly); shin = 24.; specK = 1.1; metal = .35;
  wash = mix(mix(SIEN, VERM, .35), vec3(.95, .86, .62), belly); washA = mix(.85, .5, belly);
  // the hoard's gems pressed into his belly; and the bare patch in the hollow of his left breast
  if (ax >= 0.){
    vec2 gq = vec2(vUV.x*1.6, vUV.y*rowsN*1.6);
    vec2 gc = floor(gq), gf = fract(gq) - .5;
    vec4 gr = h42(gc + 3.3);
    float crust = belly*smoothstep(.12, .2, ax)*smoothstep(.46, .36, ax);
    float bare = smoothstep(.022, .012, abs(ax - .262))*smoothstep(.05, .03, abs(vUV.y - .565));
    float isGem = step(.52, gr.x)*crust*(1. - bare);
    float gR = .26 + .14*gr.y;
    float gd = length(gf + (gr.zw - .5)*.3);
    float gm = smoothstep(gR, gR - .05, gd)*isGem*det;
    float fa = floor((atan(gf.y, gf.x) + 3.1416)/1.0472);
    vec3 fn = normalize(vec3(cos(fa*1.0472 + .5), sin(fa*1.0472 + .5), 1.6));
    N = normalize(mix(N, normalize(N + (Tt*fn.x + Bt*fn.y)*.9), gm));
    ink2 = max(ink2*(1. - gm), smoothstep(.04, .0, abs(gd - gR + .02))*isGem*det*.9);
    lite = max(lite, gm*h21(gc + fa)*.7);
    wash = mix(wash, gr.z < .5 ? VERM : GAMB, gm); washA = mix(washA, 1., gm);
    shin = mix(shin, 80., gm); specK = mix(specK, 3., gm); metal = mix(metal, 1., gm);
    alb = mix(alb, .5, bare); ink2 *= 1. - bare*.7; lite *= 1. - bare;
    phi = mix(phi, dot(P, normalize(cross(N, vec3(.3, .9, .2)))), gm); wm *= 1. - gm;
  }
  // the furnace within: seams between the plates glow when the fire rises in his chest and throat
  float fz = ax >= 0. ? exp(-pow((ax - .26)/.09, 2.)) + .9*exp(-pow((ax - .1)/.11, 2.))*smoothstep(.55, .9, uDrag.x) : (ax < -1.5 ? .6*smoothstep(.6, .95, uDrag.x) : 0.);
  float seam = max(max(outline, shade*.8), belly*max(bOut, bShade))*det + (1. - det)*.35;
  float fire = uDrag.x*fz;
  emis = fire*seam*2.2 + fire*fire*.25;
  hot = clamp(fire*seam*1.6, 0., 1.);
  ink2 *= 1. - clamp(fire*seam*2., 0., 1.);
#elif MAT == 5
  // ---------------- membrane: veined, stretched, lit through from the furnace in his chest
  float u = vUV.x, v = fract(vUV.y), pan = floor(vUV.y);
  phi = vUV.y*3.; psi = u*6.; wm = 0.;
  float vein = smoothstep(.05, .0, abs(fract(v*3. + u*.2) - .5) - .46)*.6 + smoothstep(.04, .0, abs(fract(u*5. + v*.6) - .5) - .47)*.3*(1. - u*.4);
  float rimE = smoothstep(.06, .0, min(v, 1. - v))*.8 + smoothstep(.97, 1., u)*.9;
  vec3 Lg = normalize(uGlow.xyz - P);
  float trans = max(-dot(N, Lg), 0.)*pointAtt(P, uGlow)*dot(uGlowC, vec3(.33));
  float through = (trans*.6 + uDrag.x*1.2*smoothstep(1.1, .1, u))*(1. - vein*.75)*(.75 + .25*sin(u*9. + v*4.));
  emis = through*1.5;
  alb = .38; shin = 6.; specK = .15;
  wash = mix(VERM, GAMB, .45); washA = .9;
  ink2 = max(vein*.75, rimE)*(1. - clamp(through, 0., 1.)*.35);
  hot = clamp(through*.6 - .1, 0., .7);
#elif MAT == 6
  // ---------------- horn, claw, tooth and crest
  phi = vUV.y*6.; psi = vUV.x*.6; wm = 0.;
  ink2 = smoothstep(.07, .0, abs(fract(vUV.x*.35) - .5) - .43)*.45;
  alb = .48; shin = 22.; specK = .9; metal = .25;
  wash = vec3(.9, .8, .6); washA = .35;
#elif MAT == 8
  // ---------------- the eye, sunk in its socket: heavy scaled lids, a furnace iris, a slit pupil, the cup within
  vec3 l = normalize(vec3(vUV.x, vUV.y, vAux.y));
  vec2 e = l.xy/.6;
  float open = uDrag.w;
  float fall = max(1. - e.x*e.x/.92, 0.);
  float upE = mix(-.03, .56, open)*fall + .03, loE = mix(.03, -.42, open)*fall - .03;
  float lidU = smoothstep(upE - .02, upE + .02, e.y), lidL = smoothstep(loE + .02, loE - .02, e.y);
  float lid = max(max(lidU, lidL), smoothstep(.93, .99, abs(e.x)));
  float rr = length(e), ang = atan(e.y, e.x);
  float iris = smoothstep(.64, .6, rr);
  float pw = uEye.x*.72;
  float slit = smoothstep(pw*(1. - pow(e.y/.62, 2.)) + .012, pw*(1. - pow(e.y/.62, 2.)) - .012, abs(e.x))*step(abs(e.y), .62);
  float glow = uEye.y;
  vec2 cq = (e - uEye.zw)/.09;
  float dB = max(length(vec2(cq.x/.78, (cq.y - .45)/.75)) - 1., cq.y - .45);
  float dS = max(abs(cq.x) - .1, abs(cq.y + .45) - .2);
  float dF = max(abs(cq.x) - .42, abs(cq.y + .7) - .07);
  float dH = abs(length(vec2(abs(cq.x) - .8, cq.y - .2)) - .24) - .06;
  float dC = min(min(dB, dS), min(dF, dH));
  float cupOn = step(.001, abs(uEye.z) + abs(uEye.w));
  float cup = smoothstep(.04, -.04, dC)*cupOn, cupLine = smoothstep(.06, .0, abs(dC))*cupOn;
  // molten iris: radial cuts that kink, and rings of darker fire
  float stri = .5 + .5*sin(ang*58. + sin(ang*9.)*2.2 + rr*6.);
  float ring = smoothstep(.04, .0, abs(fract(rr*5.5) - .5) - .42);
  phi = ang*.12; psi = rr*.12; wm = 0.;
  alb = .5; shin = 80.; specK = 2.5;
  ink2 = max(slit*.98*(1. - cup), cupLine*.9) + smoothstep(.035, .0, abs(rr - .62))*.9 + (stri*.3 + ring*.25)*iris*(1. - slit)*(1. - cup);
  emis = glow*iris*(1. - slit)*(1.05 - rr)*(.5 + .5*stri)*.6*(1. - cup*.5);
  hot = clamp(glow*iris*(1. - slit)*(1.15 - rr*1.2), 0., 1.);
  // the wet window of light on the cornea
  vec2 hq = e - vec2(-.24, .26);
  float hl = smoothstep(.012, .0, max(abs(hq.x) - .07, abs(hq.y) - .045)) + smoothstep(.02, .0, length(e - vec2(.2, -.18)) - .03)*.6;
  lite = cup*.95 + hl*(1. - lid);
  wash = mix(GAMB, VERM, rr*1.3); washA = 1.;
  // the darkness under the upper lid and the brow
  ao *= mix(1., smoothstep(-.05, .22, upE - e.y), 1. - lid);
  // the lids: thick, rimmed, covered in small plates in rows that follow the lid's curve
  float du = e.y - upE, dl = loE - e.y;
  float dd = lidU > .5 ? du : dl;
  float rows = fract(dd*9.), cols = fract(e.x*(7. + 2.*dd) + floor(dd*9.)*.5);
  float plate = smoothstep(.12, .0, rows)*.7 + smoothstep(.1, .0, abs(cols - .5) - .4)*.45;
  float rim = smoothstep(.05, .0, abs(dd - .04))*.95;
  float rimLit = smoothstep(.035, .0, abs(dd - .1))*.7;
  vec3 Nl = normalize(N + (normalize(vec3(0., lidU > .5 ? 1. : -1., 0.))*.6)*(1. - smoothstep(.0, .25, dd)));
  N = mix(N, Nl, lid);
  ink2 = mix(ink2, max(plate*smoothstep(.12, .2, dd), rim), lid);
  emis *= 1. - lid; hot *= 1. - lid;
  lite = mix(lite, rimLit, lid);
  alb = mix(alb, .42, lid); wash = mix(wash, mix(SIEN, VERM, .35), lid); washA = mix(washA, .8, lid);
  shin = mix(shin, 20., lid); specK = mix(specK, .8, lid);
  phi = mix(phi, dd*.12, lid); psi = mix(psi, e.x*.12, lid);
#elif MAT == 9
  // ---------------- the mouth, and the fire waiting in it
  phi = vUV.x*4.; psi = vUV.y*2.; wm = 0.;
  alb = .2; shin = 4.; specK = .1;
  float f = uDrag.x;
  emis = f*f*2.4*(.6 + .4*vUV.x);
  hot = clamp(f*1.3 - .3, 0., 1.);
  wash = mix(VERM, GAMB, .4); washA = 1.;
  ink2 = smoothstep(.05, .0, abs(fract(vUV.y*3.) - .5) - .45)*.5*(1. - f);
#endif
`;

  const MESH_TAIL = `
  // ---------------- light, tone and the burin
  vec3 Dc, Dw, S; lighting(P, N, V, shin, Dc, Dw, S);
  vec3 R = reflect(-V, N);
  vec3 envc = envRefl(R, P)*metal;
  vec3 rad = (Dc + Dw)*alb*ao + S*specK*mix(1., ao, .5) + envc*ao*.8;
  float lum = dot(rad, vec3(.3, .55, .15))*uExpo + emis;
  float sc = 1. - exp(-shaftLen(uCam, -V, dist, 1.)*uShaftK);
#if DBG == 12
  sc = 0.;
#endif
  float bright = 1. - exp(-lum*1.5);
  float tone = 1. - bright;
  tone = smoothstep(.1, .86, tone);
  float fogk = 1. - exp(-dist/uFogD);
  tone = mix(tone, uVoid, fogk);
  tone = clamp(tone - lite*.8*(1. - fogk), 0., 1.)*(1. - sc*.8);
  float wphi = mix(fwidth(phi), wP, wm), wpsi = mix(fwidth(psi), wP, wm);
  float coc = clamp(abs(dist - uFocus.x)/dist*uFocus.y, 0., uFocus.z);
  float cover = engrave(tone, phi, psi, max(wphi, 1e-6), max(wpsi, 1e-6), jit, 1. + coc*.35);
  cover = max(cover, ink2*(1. - bright*.55)*smoothstep(.0, .25, 1. - bright*bright)*(1. - sc*.6));
  cover = max(cover, ink3);
  float warmL = dot(Dw, vec3(.33)), coolL = dot(Dc, vec3(.33));
  float warmF = warmL/(warmL + coolL + 1e-4);
  vec3 paper = PAPER;
  paper *= mix(vec3(1), wash, washA*bright*.45);
  paper *= mix(vec3(1), mix(GAMB, VERM, .5 - .5*warmF*warmF), warmF*bright*.4);
  float heat = clamp(clamp(dot(Dw, vec3(.33))*uExpo*.3 - .25, 0., 1.)*uHeat + hot, 0., 1.);
  vec3 ink = mix(INK, mix(VERM*.75, HOTL, heat*heat), clamp(heat*1.5, 0., 1.));
  paper = mix(paper, mix(GAMB, vec3(1., .93, .74), heat*heat), heat*.75);
  // in the white heat the burin lines stay, but they burn
#if LSF
  cover = max(cover, engrave(.42*heat*uHeat, phi, psi, max(wphi, 1e-6), max(wpsi, 1e-6), jit + 5., 1.)*heat*uHeat);
#endif
  oC = vec4(mix(paper, ink, cover), 1.);
  oG = vec4(N*.5 + .5, dist);
`;
  // material codes: 0 hoard, 1 stone, 11 carved band, 2 metal, 7 gem, 10 daylight; dragon: 4 plates, 5 membrane, 6 horn, 8 eye, 9 mouth
  const MESH_HEAD = `in vec3 vP; in vec3 vN; in vec2 vUV; in vec2 vAux;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oG;
uniform vec4 uFoot[16]; uniform int uNFoot;     // footprints: x, z, heading, press (0..1)
uniform vec4 uFlow;          // avalanche: x, z of source, travel, radius
uniform vec4 uBreath;        // dragon nostril x,y,z, strength
uniform vec4 uDrag;          // dragon: inner fire 0..1, breathing phase, glow seam, eye open
uniform vec4 uEye;           // eye: pupil width, iris glow, cup reflection x, cup reflection y
uniform vec4 uEyeP;          // eye centre (world) and radius
uniform vec3 uEyeF;          // eye forward axis
float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0., 1.); return length(pa - ba*h); }
// knotwork: a two-strand plait with alternating over/under crossings; returns relief and an incised-line mask
vec2 knot(vec2 uv){
  float u = uv.x, v = uv.y;
  float s = sin(u*PI)*.6, ds = cos(u*PI)*PI*.6, kk = inversesqrt(1. + ds*ds);
  float k1 = abs(v - s)*kk, k2 = abs(v + s)*kk;
  float w = .21;
  float ci = floor(u + .5), near = 1. - smoothstep(.05, .32, abs(u - ci));
  bool oneTop = mod(ci, 2.) < .5;
  float kt = oneTop ? k1 : k2, kb = oneTop ? k2 : k1;
  float top = smoothstep(w, w*.7, kt), bot = smoothstep(w, w*.7, kb);
  float hide = near*smoothstep(w*1.45, w*1.15, kt);
  bot *= 1. - hide;
  float h = max(top, bot*(1. - near*.5));
  // engraved outlines of both strands and the central groove
  float edge = max(smoothstep(.045, .0, abs(kt - w)), (1. - hide)*smoothstep(.045, .0, abs(kb - w)));
  float mid = max(top*smoothstep(.03, .0, kt), bot*smoothstep(.03, .0, kb));
  // a third strand: a looping cord along the band edges
  float rail = smoothstep(.06, .0, abs(abs(v) - .93));
  return vec2(h + rail*.6, max(edge, mid*.7) + rail*.5);
}
// angular dwarf-runes on a ribbon; returns incised mask
float runes(vec2 uv, float seed){
  float cw = .62; float ci = floor(uv.x/cw); vec2 p = vec2(fract(uv.x/cw) - .5, uv.y)*vec2(cw, 1.);
  float r = h21(vec2(ci, seed)); float r2 = h21(vec2(ci + 7., seed)); float d = 9.;
  if (r < .9) d = segD(p, vec2(0., -.7), vec2(0., .7));
  if (fract(r*7.) > .45) d = min(d, segD(p, vec2(0., .7), vec2(.24, .38)));
  if (fract(r*13.) > .55) d = min(d, segD(p, vec2(0., .7), vec2(-.24, .38)));
  if (fract(r*29.) > .5) d = min(d, segD(p, vec2(0., .1), vec2(.24, -.2)));
  if (fract(r*31.) > .6) d = min(d, segD(p, vec2(0., -.2), vec2(-.24, -.5)));
  if (r2 > .7) d = min(d, segD(p, vec2(-.2, .7), vec2(.2, .3)));
  if (r2 < .2) d = min(d, segD(p, vec2(-.2, -.1), vec2(.2, .3)));
  if (r > .9) d = min(d, length(p) < .5 ? abs(length(p - vec2(0., .2)) - .18) : 9.);
  float frame = smoothstep(.05, .0, abs(abs(uv.y) - .92));
  return max(smoothstep(.075, .035, d), frame);
}
float footprints(vec2 xz, out vec2 g){
  float m = 0.; g = vec2(0);
  for (int k = 0; k < 16; k++){
    if (k >= uNFoot) break;
    vec4 f = uFoot[k];
    float fsz = max(1., f.w); f.w = min(f.w, 1.);
    vec2 d = (xz - f.xy)/fsz; float c = cos(f.z), s = sin(f.z); vec2 l = vec2(c*d.x + s*d.y, -s*d.x + c*d.y);
    // a hobbit foot: long, broad at the toes
    float wv = mix(.05, .072, smoothstep(-.1, .1, l.x));
    vec2 e = vec2(l.x/.135, l.y/wv); float r = length(e);
    float toes = 0.;
    for (int j = 0; j < 4; j++){ float fj = float(j); vec2 tp = vec2(.15 - abs(fj - 1.5)*.012, (fj - 1.5)*.032); toes = max(toes, smoothstep(.022, .012, length(l - tp))); }
    float bowl = max(1. - r*r, 0.) + toes*.6;
    m = max(m, f.w*min(bowl*1.6, 1.));
    g += f.w*(r < 1. ? -2.*e/vec2(.135, wv) : vec2(0));
  }
  return m;
}
`;
  function fsMesh(mat, fire) {
    return `#version 300 es
#define MAT ${mat}
#define LSF ${fire ? 1 : 0}
${GLSL_LIB}
${MESH_HEAD}
void main(){
#if DBG == 14
  oC = vec4(1./64.); oG = vec4(1.); return;
#endif
  vec3 P = vP;
  vec3 V = normalize(uCam - P);
  vec3 dPx = dFdx(P), dPy = dFdy(P);
  vec3 Ngeo = normalize(cross(dPx, dPy)); if (dot(Ngeo, V) < 0.) Ngeo = -Ngeo;
  vec3 Ng = normalize(vN); if (dot(Ng, Ngeo) < 0.) Ng = -Ng;
  float wP = max(length(dPx), length(dPy));
  float dist = length(uCam - P);
  vec3 N = Ng; float alb = .62, shin = 10., specK = 0., metal = 0., ao = 1.;
  float phi = P.y, psi = P.x; float wm = 0.; float jit = 0.;
  vec3 wash = vec3(1); float washA = 0.; float ink2 = 0., lite = 0., emis = 0., hot = 0., ink3 = 0.;
#if MAT == 0 && DBG == 9
  alb = .5;
#elif MAT == 0
  ${MAT_HEAP}
#elif MAT == 1
  ${MAT_STONE}
#elif MAT == 11
  ${MAT_BAND}
#elif MAT == 2
  ${MAT_METAL}
#elif MAT == 7
  ${MAT_GEM}
#elif MAT == 10
  oC = vec4(1., .985, .93, 1.); oG = vec4(N*.5 + .5, dist); return;
#else
  ${DRAGON_MAT}
#endif
  ${MESH_TAIL}
}`;
  }
  /* ================================================================== GLSL: coins as exact impostors */
  const VS_COIN = `#version 300 es
in vec3 aQ; in vec4 iC; in vec4 iA; in vec4 iK;
uniform mat4 uVP; uniform vec3 uCam;
out vec3 vW; flat out vec4 vC; flat out vec4 vA; flat out vec4 vK;
void main(){
  // a tight oriented box around the disc; the fragment shader finds the exact coin inside it
  vec3 C = iC.xyz; float R = iC.w;
  vec3 n = normalize(iA.xyz);
  vec3 t1 = normalize(cross(n, abs(n.y) < .9 ? vec3(0,1,0) : vec3(1,0,0))); vec3 t2 = cross(n, t1);
  vec3 w = C + (t1*aQ.x + t2*aQ.y)*R*1.03 + n*aQ.z*(R*iK.x*1.3 + R*.01);
  if (iK.z > .5) w = vec3(0.);
  vW = w; vC = iC; vA = iA; vK = iK;
  gl_Position = uVP*vec4(w, 1.);
}`;
  const FS_COIN = `#version 300 es
${GLSL_LIB}
in vec3 vW; flat in vec4 vC; flat in vec4 vA; flat in vec4 vK;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oG;
uniform int uPass; uniform sampler2D uCoinD;
float coinRelief(vec2 p, float seed){
  float r = length(p), a = atan(p.y, p.x) + seed*31.;
  float h = 0.;
  h += smoothstep(.94, .9, r)*.5 + smoothstep(.84, .87, r)*.6 - smoothstep(.93, .99, r)*.6;
  h += (r > .74 && r < .8) ? smoothstep(.3, .1, length(vec2(fract(a*36./6.2832) - .5, (r - .77)*12.)))*.35 : 0.;
  float leg = (r > .6 && r < .72) ? step(.35, fract(a*14./6.2832 + floor(a*3.)*.31))*smoothstep(.0, .02, min(r - .6, .72 - r)) : 0.;
  h += leg*.25*step(.4, h21(vec2(floor(a*28./6.2832), seed)));
  float k = fract(seed*7.);
  vec2 q = vec2(p.x*cos(seed*9.) - p.y*sin(seed*9.), p.x*sin(seed*9.) + p.y*cos(seed*9.));
  float m = 0.;
  if (k < .4){ // the lonely mountain under a crown of stars
    float y = q.y + .2; float peak = .42 - abs(q.x)*1.25; float peak2 = .28 - abs(q.x - .2)*1.5;
    m = smoothstep(.02, -.02, y - max(peak, peak2)) * step(-.02, y) * step(abs(q.x), .42);
    for (int i = 0; i < 3; i++){ float fi = float(i) - 1.; m = max(m, smoothstep(.05, .03, length(q - vec2(fi*.17, .38 - abs(fi)*.05)))); }
  } else if (k < .7){ // a hammer
    m = max(step(abs(q.x), .05)*step(abs(q.y + .05), .3), step(abs(q.x), .25)*step(abs(q.y - .27), .09));
  } else { // eight-rayed star
    float aa = atan(q.y, q.x); float rr = length(q); m = smoothstep(.0, .02, .12 + .3*pow(abs(cos(aa*4.)), 8.) - rr);
  }
  h += m*.55*step(r, .55);
  return h;
}
void main(){
  vec3 C = vC.xyz; float R = vC.w; vec3 n = normalize(vA.xyz); float seed = vA.w;
  vec3 D = normalize(vW - uCam);
  vec3 t1 = normalize(cross(n, abs(n.y) < .9 ? vec3(0,1,0) : vec3(1,0,0))); vec3 t2 = cross(n, t1);
  vec3 O = uCam - C;
  vec3 o = vec3(dot(O, t1), dot(O, t2), dot(O, n)), d = vec3(dot(D, t1), dot(D, t2), dot(D, n));
  float hz = R*vK.x;
  float tb = 1e9; vec3 nl = vec3(0); float part = 0.; vec3 p = vec3(0);
  if (abs(d.z) > 1e-6){
    for (int s = 0; s < 2; s++){ float sg = s == 0 ? 1. : -1.; float t = (sg*hz - o.z)/d.z; vec3 q = o + d*t; if (t > 0. && dot(q.xy, q.xy) < R*R && t < tb){ tb = t; nl = vec3(0, 0, sg); p = q; part = 0.; } }
  }
  float A = dot(d.xy, d.xy), Bq = dot(o.xy, d.xy), Cq = dot(o.xy, o.xy) - R*R, disc = Bq*Bq - A*Cq;
  if (disc > 0. && A > 1e-9){ float t = (-Bq - sqrt(disc))/A; vec3 q = o + d*t; if (t > 0. && abs(q.z) < hz && t < tb){ tb = t; nl = vec3(q.xy/R, 0.); p = q; part = 1.; } }
  if (tb > 1e8) discard;
  vec3 Pw = C + t1*p.x + t2*p.y + n*p.z;
  vec4 clip = uVP*vec4(Pw, 1.);
  gl_FragDepth = clip.z/clip.w*.5 + .5;
  float dist = length(uCam - Pw);
  if (uPass == 0){ oC = vec4(dist); oG = vec4(0); return; }
  if (dist > texelFetch(uCoinD, ivec2(gl_FragCoord.xy), 0).r*1.0003 + 1e-5) discard;
  float wP = dist*uPx*.0;  // replaced below
  wP = max(length(dFdx(vW)), length(dFdy(vW)))*dist/max(length(uCam - vW), 1e-4);
  float rpx = R/wP;
  float det = smoothstep(4., 14., rpx);
  vec2 lp = p.xy/R;
  float phi, psi; float ink2 = 0.;
  if (part < .5){
    float e = .012;
    float h0 = coinRelief(lp, seed);
    vec2 g = vec2(coinRelief(lp + vec2(e, 0), seed) - h0, coinRelief(lp + vec2(0, e), seed) - h0)/e;
    nl = normalize(vec3(-g*.09*det, nl.z));
    float ca = cos(seed*5.), sa = sin(seed*5.);
    phi = (lp.x*ca + lp.y*sa)*R; psi = (-lp.x*sa + lp.y*ca)*R;
    float r = length(lp);
    ink2 = smoothstep(.955, .995, r)*.9*smoothstep(2.5, 5., rpx);
  } else {
    float a = atan(p.y, p.x);
    phi = p.z*1.5; psi = a*R;
    float reed = abs(fract(a*R/(R*.07)) - .5);
    ink2 = smoothstep(.2, .05, reed)*.5*det;
  }
  vec3 N = normalize(t1*nl.x + t2*nl.y + n*nl.z);
  vec3 V = -D;
  vec3 Dc, Dw, S; lighting(Pw, N, V, 46., Dc, Dw, S);
  vec3 env = envRefl(reflect(D, N), Pw);
  float heat = vK.y;
  vec3 rad = (Dc + Dw)*.3 + S*2.2 + env*.75;
  float lum = dot(rad, vec3(.3, .55, .15))*uExpo + heat*2.;
  float bright = 1. - exp(-lum*1.5);
  float tone = 1. - bright;
  float coc = clamp(abs(dist - uFocus.x)/dist*uFocus.y, 0., uFocus.z);
  float cover = engrave(tone, phi, psi, wP*.9, wP*.9, seed*17., 1. + coc*.9);
  cover = max(cover, ink2*(1. - bright*.5));
  float warmL = dot(Dw, vec3(.33)), coolL = dot(Dc, vec3(.33)); float warmF = warmL/(warmL + coolL + 1e-4);
  vec3 paper = PAPER*mix(vec3(1), GAMB, .8*bright);
  paper *= mix(vec3(1), VERM, warmF*bright*.35);
  float hh = clamp(dot(Dw, vec3(.33))*uExpo*.25 - .35, 0., 1.)*uHeat + heat;
  vec3 ink = mix(INK, mix(VERM*.9, HOTL, hh), clamp(hh*1.4, 0., 1.));
  paper = mix(paper, vec3(1., .95, .78), clamp(hh, 0., 1.)*.8);
  oC = vec4(mix(paper, ink, cover), 1.);
  oG = vec4(N*.5 + .5, dist);
}`;

  /* ================================================================== GLSL: sprites (dust, embers, smoke) */
  const VS_SPR = `#version 300 es
in vec2 aQ; in vec4 iP; in vec4 iD; in vec4 iV;
uniform mat4 uVP; uniform vec3 uCam; uniform float uPx; uniform vec2 uRes; uniform float uPxA;
out vec2 vQ; flat out vec4 vD; out vec3 vWP; flat out vec4 vV; out float vSz;
void main(){
  vec3 C = iP.xyz; float dist = length(uCam - C);
  float s = max(iP.w, dist*uPxA*(iD.x > 1.5 ? 1. : 1.3));
  vec3 f = normalize(uCam - C); vec3 r = normalize(cross(vec3(0,1,0), f)); vec3 u = cross(f, r);
  vec3 w = C + (r*aQ.x + u*aQ.y)*s;
  if (dot(iV.xyz, iV.xyz) > 0.){ vec3 vs = iV.xyz - f*dot(iV.xyz, f); w += vs*(.5 - .5*aQ.y); }
  vQ = aQ; vD = iD; vWP = C; vV = iV; vSz = s;
  gl_Position = uVP*vec4(w, 1.);
}`;
  const FS_SPR = `#version 300 es
${GLSL_LIB}
in vec2 vQ; flat in vec4 vD; in vec3 vWP; flat in vec4 vV; in float vSz;
out vec4 oC;
void main(){
  float seed = vD.y, al = vD.z;
  float r = length(vQ);
#if KIND == 0
  {
    // dust mote in a shaft: a dark stipple dot, or a gold glint
    float sm = shaftAt(vWP);
    if (sm < .02 || r > 1.) discard;
    if (vD.w > .5){ float g = smoothstep(1., .2, r); oC = vec4(mix(GAMB, vec3(1., .97, .85), .6), g*sm*al); }
    else { float g = smoothstep(1., .6, r); oC = vec4(INK, g*sm*al*.85); }
  }
#elif KIND == 1
  {
    // ember: a white-hot core in a vermilion husk
    if (r > 1.) discard;
    float core = smoothstep(.6, .1, r);
    oC = vec4(mix(VERM, vec3(1., .9, .6), core), smoothstep(1., .5, r)*al);
  }
#else
  {
    // smoke: stipple whose density follows the puff
    if (r > 1.) discard;
    float dens = smoothstep(1., .1, r + .15*sin(atan(vQ.y, vQ.x)*5. + seed*20.))*al;
    vec2 g = gl_FragCoord.xy/uPx;
    vec2 cell = floor(g/2.6); vec2 fr = fract(g/2.6) - .5;
    float hsh = h21(cell + floor(seed*91.)); vec2 jo = (h22(cell + 3.1) - .5)*.5;
    float dot1 = smoothstep(.36, .2, length(fr - jo))*step(hsh, dens*.8);
    float a = dot1;
    if (a < .01) discard;
    oC = vec4(mix(INK, vec3(.25, .18, .14), .3), a*.9);
  }
#endif
}`;


  /* ================================================================== GLSL: the fire */
  const VS_FIRE = `#version 300 es
in vec2 aQ; in vec4 iA; in vec4 iB;
uniform mat4 uVP; uniform vec3 uCam; uniform float uT; uniform float uPxA;
uniform vec4 uFS; uniform vec4 uFD; uniform vec3 uFU; uniform vec3 uFV;
out vec2 vS; out float vTemp; out float vFade; out float vD; flat out float vK; flat out float vSm; out float vWpx;
float radAt(float d){ float df = uFS.w; return (.3 + d*.12)*(1. + .7*smoothstep(df - 7., df, d)); }
vec3 axisPt(float d, float phi, float rho, float ph){
  float R = radAt(d);
  float tw = sin(d*.17 - uT*3.1 + ph*6.) + .4*sin(d*.41 + uT*4.3 + ph*11.);
  float tw2 = cos(d*.15 - uT*2.7 + ph*9.) + .4*cos(d*.47 - uT*5.1 + ph*3.);
  vec3 off = (uFU*cos(phi + d*.03) + uFV*sin(phi + d*.03))*R*rho + (uFU*tw + uFV*tw2)*R*.1;
  return uFS.xyz + uFD.xyz*d + off + vec3(0., 1., 0.)*d*d*.003;
}
void main(){
  float a = aQ.x, side = aQ.y;
  float phi = iA.x, rho = iA.y, ph = iA.z, spd = iA.w;
  float kind = iB.z;
  float df = uFS.w, dt = uFD.w;
  float base = fract(ph + uT*.6*spd);
  float span = iB.y;
  float u0 = base*(1. + span) - span;
  float uu = clamp(u0 + a*span, 0., 1.);
  float d = mix(dt, df, uu);
  float d2 = mix(dt, df, clamp(u0 + (a + .04)*span, 0., 1.));
  vec3 P = axisPt(d, phi, rho, ph), P2 = axisPt(d2 + .08, phi, rho, ph);
  vec3 T = normalize(P2 - P + 1e-4), V = normalize(uCam - P);
  vec3 sd = normalize(cross(T, V) + 1e-5);
  float dist = length(uCam - P);
  float R = radAt(d);
  float px = dist*uPxA;
  float w = kind < .5 ? max(R*.055*iB.x, px*1.6) : R*.75*iB.x;
  float aa = clamp(a, 0., 1.);
  w *= (kind < .5 ? pow(1. - aa, .75)*smoothstep(0., .12, aa) : sin(3.14159*aa))*(.4 + .6*smoothstep(0., 5., d));
  vFade = 1.;
  P += sd*side*w;
  vWpx = w/max(px, 1e-5);
  vS = vec2(side, a); vD = d; vK = kind; vSm = step(.88, rho)*step(.5, fract(ph*7.3))*step(kind, .5);
  vTemp = (1. - .5*clamp(d/max(df, 1.), 0., 1.))*(.75 + .45*(1. - rho)) + .35*exp(-d*.12)*(1. - rho);
  vFade = sin(3.14159*base)*smoothstep(0., .5, df - dt)*smoothstep(3., 10., dist);
  gl_Position = uVP*vec4(P, 1.);
}`;
  const FS_FIRE = `#version 300 es
${GLSL_LIB}
in vec2 vS; in float vTemp; in float vFade; in float vD; flat in float vK; flat in float vSm; in float vWpx;
out vec4 oC;
void main(){
  float s = abs(vS.x), a = vS.y;
  float core = 1. - s;
  float temp = vTemp*(.45 + .55*core)*(.94 + .06*sin(a*7. + uT*6. + vD*.3));
  vec3 hotc = mix(VERM*.9, mix(GAMB, vec3(1., .98, .9), smoothstep(.74, .95, temp)), smoothstep(.22, .62, temp));
#if FILL == 0
  {
    // a tongue of flame, cut as one tapering stroke; only the cooler tongues carry an inked edge
    float cool = 1. - smoothstep(.45, .66, temp);
    if (vSm > .5){ oC = vec4(mix(SIEN*.45, INK, .5), smoothstep(1., .4, s)*vFade*.55); return; }
    float edge = smoothstep(.74, .88, s)*smoothstep(1., .92, s)*cool;
    vec3 col = mix(hotc, INK*1.4, edge*.85);
    // burin lines along the tongue, a constant few pixels apart
    float nl = max(1., vWpx*uPx/3.4), xx = vS.x*nl*.5 + .5;
    float ln = clamp((clamp(.68 - temp, 0., .6)*.62*(.7 + .6*sin(a*5. + vD)) - abs(fract(xx) - .5))*3.4*uPx + .5, 0., 1.);
    col = mix(col, mix(SIEN*.55, INK, .4), ln*.8);
    oC = vec4(col, smoothstep(1., .55, s)*vFade*mix(.75, 1., cool));
  }
#else
  {
    // the body of the fire: a wash, ruled with lines that thin out where it is hottest
    vec2 fc = gl_FragCoord.xy/uPx;
    float x = fc.y/3.2 + fc.x*.12; float ln = clamp((clamp(.55 - temp, 0., .55)*.55 - abs(fract(x) - .5))*3.2*uPx + .5, 0., 1.);
    vec3 col = mix(hotc, mix(INK, SIEN*.4, .5), ln*.7);
    oC = vec4(col, smoothstep(0., .8, core)*vFade*.32);
  }
#endif
}`;

  /* ================================================================== GLSL: the billows of the fire */
  const VS_LOBE = `#version 300 es
in vec2 aQ; in vec4 iP; in vec4 iD; in vec4 iV;
uniform mat4 uVP; uniform vec3 uCam; uniform float uPxA;
out vec2 vQ; flat out vec4 vD; flat out float vRpx; flat out float vRot;
void main(){
  vec3 C = iP.xyz; float s = iP.w;
  vec3 f = normalize(uCam - C); vec3 r = normalize(cross(vec3(0,1,0), f)); vec3 u = cross(f, r);
  float dist = max(length(uCam - C), .1);
  vec3 w = C + (r*aQ.x + u*aQ.y)*s*1.12 + f*min(s*.5, dist*.5);
  vQ = aQ*1.12; vD = iD; vRpx = s/(dist*uPxA); vRot = iV.x;
  gl_Position = uVP*vec4(w, 1.);
}`;
  const FS_LOBE = `#version 300 es
${GLSL_LIB}
in vec2 vQ; flat in vec4 vD; flat in float vRpx; flat in float vRot;
out vec4 oC;
void main(){
  float seed = vD.x, temp = vD.y, al = vD.z, age = vD.w;
  float r = length(vQ), a = atan(vQ.y, vQ.x);
  float edge = 1. - .08*sin(a*5. + seed*20. + age*1.7) - .05*sin(a*9. - seed*13. - age*2.3) - .03*sin(a*17. + seed*7.);
  if (r > edge) discard;
  float rr = r/edge; vec2 qn = vQ/edge;
  float nz = sqrt(max(1. - rr*rr, 0.));
  // lit from within: white at the heart of the lobe, cooling to vermilion and soot at its upper rim
  float t = temp*(.55 + .45*nz)*(1. - .35*smoothstep(.2, 1., qn.y)*rr);
  // the burin follows the roll of the billow: arcs round a centre set off to one side
  vec2 cc = vec2(cos(vRot), sin(vRot))*.38;
  float cr = length(qn - cc), a2 = atan(qn.y - cc.y, qn.x - cc.x);
  float per = 3.4*uPx;
  float x = (cr + .05*sin(a2*3. + age*1.3 + seed*9.))*vRpx/per;
  // each lobe is modelled as a ball: white-hot where it faces out of the fire, hatched as it turns away
  float tone = clamp(.1 + 1.05*pow(1. - nz, .75) + .4*max(qn.y, 0.)*rr - (temp - .5)*.6, 0., 1.);
  float hw = tone*.5*(.8 + .35*sin(a2*2. + seed*5.));
  float ln = clamp((hw - abs(fract(x) - .5))*per + .5, 0., 1.);
  // a second, crossing cut deepens the coolest folds
  float x2 = (dot(qn, vec2(.8, .6)) + .4*rr*rr)*vRpx/per;
  float ln2 = clamp((clamp(tone - .55, 0., .45)*.9 - abs(fract(x2) - .5))*per + .5, 0., 1.);
  // a firm engraved contour round each lobe, heavier on its cool upper side
  float olw = (1.2 + 1.4*smoothstep(-.4, .7, qn.y))*uPx/max(vRpx, 1.);
  float ol = smoothstep(olw, olw*.3, 1. - rr);
  t = mix(t, t*(1. - tone*.6), .7);
  vec3 hotc = mix(VERM*.9, mix(GAMB, vec3(1., .97, .86), smoothstep(.55, .85, t)), smoothstep(.1, .45, t));
  vec3 col = mix(hotc, mix(INK, SIEN*.45, .3), max(max(ln, ln2)*.88, ol*.92));
  oC = vec4(col, al);
}`;
  /* ================================================================== GLSL: the dark of the vault */
  const FS_VOID = `#version 300 es
${GLSL_LIB}
in vec2 vUv; layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oG;
void main(){
  vec2 ndc = vUv*2. - 1.;
  vec3 D = normalize(uCF + uCR*ndc.x*uTanF*uAsp + uCU*ndc.y*uTanF);
  float rpp = 2.*uTanF/uRes.y;
  float el = asin(clamp(D.y, -1., 1.))/rpp, az = atan(D.x, -D.z)/rpp;
  float sc = 1. - exp(-shaftLen(uCam, D, 400., 1.)*uShaftK);
  float tn = (uVoid - .06*vn(vec2(az, el)*.004))*(1. - sc*.8);
  oC = vec4(mix(PAPER, INK, engrave(tn, el*.8 + az*.6, az*.8 - el*.6, 1., 1., 0., 1.)), 1.);
  oG = vec4(0);
}`;
  const VS_VOID = `#version 300 es
in vec2 aQ; out vec2 vUv; void main(){ vUv = aQ*.5 + .5; gl_Position = vec4(aQ, 1., 1.); }`;

  /* ================================================================== GLSL: the plate (post) */
  const VS_FULL = `#version 300 es
in vec2 aQ; out vec2 vUv; void main(){ vUv = aQ*.5 + .5; gl_Position = vec4(aQ, 0., 1.); }`;
  const FS_POST = `#version 300 es
${GLSL_LIB}
uniform sampler2D uC0; uniform sampler2D uC1;
uniform vec2 uSunScr;
uniform vec4 uPlate;
in vec2 vUv; out vec4 o;
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec4 g0 = texture(uC1, vUv);
  vec3 col = texture(uC0, vUv).rgb;
  float d0 = g0.a;
  vec2 ndc = vUv*2. - 1.;
  vec3 D = normalize(uCF + uCR*ndc.x*uTanF*uAsp + uCU*ndc.y*uTanF);
  vec2 px = 1./uRes;
  float coc = d0 > 0. ? clamp(abs(d0 - uFocus.x)/d0*uFocus.y, 0., uFocus.z) : uFocus.z*.5;
  {
    // depth of field: a light gather; the shaders already coarsen the lines out of focus
#if DOF
    if (coc > .8){
      vec3 acc = col; float ws = 1.;
      for (int k = 0; k < 10; k++){
        float fk = float(k) + .5; float ang = fk*2.39996; float rr = sqrt(fk/10.)*coc*.7;
        vec2 uv = vUv + vec2(cos(ang), sin(ang))*rr*px;
        vec4 gs = texture(uC1, uv);
        float cs = gs.a > 0. ? clamp(abs(gs.a - uFocus.x)/gs.a*uFocus.y, 0., uFocus.z) : uFocus.z*.5;
        float w = smoothstep(rr*.5, rr + .5, cs + .5);
        acc += texture(uC0, uv).rgb*w; ws += w;
      }
      col = acc/ws;
    }
#endif
    // contours where depth or normal break
    float e = 0.; vec3 n0 = g0.rgb*2. - 1.;
    float rr = 1.2*uPx;
    for (int k = 0; k < 4; k++){
      vec2 off = (k == 0 ? vec2(1, 0) : k == 1 ? vec2(-1, 0) : k == 2 ? vec2(0, 1) : vec2(0, -1))*rr*px;
      vec4 g = texture(uC1, vUv + off);
      float dd = g.a <= 0. ? 1. : (g.a - d0)/d0;
      e = max(e, smoothstep(.025, .07, dd));
      if (g.a > 0.) e = max(e, smoothstep(.35, .7, 1. - dot(n0, g.rgb*2. - 1.))*.55);
    }
    col = mix(col, INK, e*.8/(1. + coc*.4));
  }
  // shafts of daylight: lighter, ruled along the beam, as an engraver cuts them
  float L = shaftLen(uCam, D, d0 > 0. ? d0 : 400., 1.25);
  float s = 1. - exp(-L*uShaftK);
  {
    float lum = dot(col, vec3(.33));
    vec2 sp = normalize(vec2(-uSunScr.y, uSunScr.x));
    float x = dot(fc/uPx, sp)/3.3;
    float along = dot(fc/uPx, normalize(uSunScr))/3.3;
    float rule = stripe(x, along, clamp(.5 - s*.55, .0, .5), 3.3*uPx, 2., 1.);
    col = mix(col, INK*1.2, rule*smoothstep(.0, .25, s)*(1. - lum)*.55);
  }
  // paper: grain, fibres, a breath of plate tone toward the edges
  vec2 pp = fc/uPx;
  float grain = vn(pp*.8)*.55 + vn(pp*.21 + 9.)*.45;
  float fib = vn(vec2(pp.x*.03 + pp.y*.01, pp.y*.9));
  float ink = 1. - dot(col, vec3(.33))/dot(PAPER, vec3(.33));
  col *= .955 + .06*grain - .025*fib*(1. - ink);
  vec2 cuv = vUv*2. - 1.;
  float vig = smoothstep(.55, 1.45, length(cuv*vec2(.9, .8)));
  col = mix(col, col*vec3(.62, .55, .48), vig*.55);
  // the plate mark at the end: a margin of clean paper and a ruled border
#if PLATE
  {
    vec2 q = fc/uRes; // 0..1
    float mx = .055*uPlate.x, myb = .17*uPlate.x, myt = .055*uPlate.x;
    float inside = step(mx, q.x)*step(q.x, 1. - mx)*step(myb, q.y)*step(q.y, 1. - myt);
    vec3 pap = PAPER*(.985 + .03*grain);
    float bx = min(min(q.x - mx, 1. - mx - q.x)*uRes.x, min(q.y - myb, 1. - myt - q.y)*uRes.y);
    float border = smoothstep(1.4*uPx, .4*uPx, abs(bx + 5.*uPx)) + smoothstep(.9*uPx, .2*uPx, abs(bx + 9.*uPx))*.7;
    float pm = smoothstep(1.2*uPx, .0, abs(bx - 14.*uPx*uPlate.x))*.12;
    col = mix(pap*(1. - pm), col, inside);
    col = mix(col, INK, border*uPlate.x);
  }
#endif
  o = vec4(col, 1.);
}`;

  /* ================================================================== mesh building */
  // vertex: position 3, normal 3, uv 2, aux 2 (material, extra) = 10 floats
  function MB() { return { v: [], i: [], n: 0 }; }
  function vert(m, p, nn, u, v, mat, ax) { m.v.push(p[0], p[1], p[2], nn[0], nn[1], nn[2], u, v, mat, ax); return m.n++; }
  function quadI(m, a, b, c, d) { m.i.push(a, b, c, a, c, d); }
  function gridI(m, base, nu, nv) {
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i; quadI(m, a, a + 1, a + nu + 2, a + nu + 1);
    }
  }
  // an object transform: origin, three axes (already scaled)
  function XF(o, X, Y, Z) { return { o, X, Y, Z }; }
  const xfP = (x, p) => [x.o[0] + x.X[0] * p[0] + x.Y[0] * p[1] + x.Z[0] * p[2], x.o[1] + x.X[1] * p[0] + x.Y[1] * p[1] + x.Z[1] * p[2], x.o[2] + x.X[2] * p[0] + x.Y[2] * p[1] + x.Z[2] * p[2]];
  const xfN = (x, n) => norm([x.X[0] * n[0] + x.Y[0] * n[1] + x.Z[0] * n[2], x.X[1] * n[0] + x.Y[1] * n[1] + x.Z[1] * n[2], x.X[2] * n[0] + x.Y[2] * n[1] + x.Z[2] * n[2]]);
  function xfFrom(o, up, yaw, s) {
    const Y = norm(up); let ref = Math.abs(Y[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    let X = norm(cross(ref, Y)); X = rotAxis(X, Y, yaw); const Z = cross(X, Y);
    return XF(o, mul(X, s), mul(Y, s), mul(Z, s));
  }
  // surface of revolution about local y. prof: [[r, y], ...]
  function lathe(m, x, prof, segs, mat, ax) {
    const base = m.n, np = prof.length; let arc = 0; const rmax = Math.max(...prof.map((p) => p[0])) || 1;
    for (let k = 0; k < np; k++) {
      if (k > 0) arc += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]);
      const a = prof[Math.max(0, k - 1)], b = prof[Math.min(np - 1, k + 1)];
      let tr = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tr, ty) || 1; tr /= tl; ty /= tl;
      const nr = ty, ny = -tr;
      for (let j = 0; j <= segs; j++) {
        const ang = (j / segs) * TAU, c = Math.cos(ang), s = Math.sin(ang);
        vert(m, xfP(x, [prof[k][0] * c, prof[k][1], prof[k][0] * s]), xfN(x, [nr * c, ny, nr * s]), ang * rmax * len(x.X), arc * len(x.X), mat, ax);
      }
    }
    for (let k = 0; k < np - 1; k++) for (let j = 0; j < segs; j++) {
      const a = base + k * (segs + 1) + j; quadI(m, a, a + segs + 1, a + segs + 2, a + 1);
    }
  }
  // tube along a polyline of local points with radii
  function tube(m, x, pts, rad, segs, mat, ax, flat) {
    const base = m.n, np = pts.length;
    let T = norm(sub(pts[1], pts[0]));
    let Nn = norm(cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    let arc = 0;
    for (let k = 0; k < np; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(np - 1, k + 1)];
      const T2 = norm(sub(b, a));
      Nn = norm(sub(Nn, mul(T2, dot(Nn, T2)))); T = T2;
      const Bn = cross(T, Nn);
      if (k > 0) arc += len(sub(pts[k], pts[k - 1]));
      for (let j = 0; j <= segs; j++) {
        const ang = (j / segs) * TAU, c = Math.cos(ang), s = Math.sin(ang);
        const d = add(mul(Nn, c), mul(Bn, s));
        vert(m, xfP(x, madd(pts[k], d, rad[k])), xfN(x, d), ang * 0.05 * len(x.X), arc * len(x.X), mat, ax);
      }
    }
    for (let k = 0; k < np - 1; k++) for (let j = 0; j < segs; j++) {
      const a = base + k * (segs + 1) + j; quadI(m, a, a + segs + 1, a + segs + 2, a + 1);
    }
  }
  // flat-shaded triangle
  function ftri(m, x, a, b, c, mat, ax) {
    const A = xfP(x, a), B = xfP(x, b), Cc = xfP(x, c), n = norm(cross(sub(B, A), sub(Cc, A)));
    const i0 = vert(m, A, n, 0, 0, mat, ax), i1 = vert(m, B, n, 1, 0, mat, ax), i2 = vert(m, Cc, n, 0, 1, mat, ax);
    m.i.push(i0, i1, i2);
  }
  function fquad(m, x, a, b, c, d, mat, ax, uvs) {
    const A = xfP(x, a), B = xfP(x, b), Cc = xfP(x, c), Dd = xfP(x, d), n = norm(cross(sub(B, A), sub(Dd, A)));
    const u = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
    const i0 = vert(m, A, n, u[0][0], u[0][1], mat, ax), i1 = vert(m, B, n, u[1][0], u[1][1], mat, ax), i2 = vert(m, Cc, n, u[2][0], u[2][1], mat, ax), i3 = vert(m, Dd, n, u[3][0], u[3][1], mat, ax);
    quadI(m, i0, i1, i2, i3);
  }
  function box(m, x, c, h, mat, ax) { // axis-aligned in local frame; uv in metres per face
    const s = len(x.X);
    const P = (i, j, k) => [c[0] + i * h[0], c[1] + j * h[1], c[2] + k * h[2]];
    const F = [
      [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), 2 * h[0], 2 * h[1]],
      [P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), 2 * h[0], 2 * h[1]],
      [P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), 2 * h[2], 2 * h[1]],
      [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), 2 * h[2], 2 * h[1]],
      [P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), 2 * h[0], 2 * h[2]],
      [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), 2 * h[0], 2 * h[2]],
    ];
    for (const f of F) fquad(m, x, f[0], f[1], f[2], f[3], mat, ax, [[0, 0], [f[4] * s, 0], [f[4] * s, f[5] * s], [0, f[5] * s]]);
  }
  function gem(m, x, mat, gi) {
    const g = [], c = [], n = 8;
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU; g.push([Math.cos(a), 0, Math.sin(a)]); c.push([0.56 * Math.cos(a + PI / n), 0.36, 0.56 * Math.sin(a + PI / n)]); }
    const top = [0, 0.36, 0], bot = [0, -0.62, 0];
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      ftri(m, x, top, c[k2], c[k], 7, gi);
      ftri(m, x, g[k], c[k], g[k2], 7, gi); ftri(m, x, c[k], c[k2], g[k2], 7, gi);
      ftri(m, x, g[k2], bot, g[k], 7, gi);
    }
  }

  /* ---------------------------------------------------------------- the treasure */
  const PROF = {
    goblet: [[0, 0], [0.045, 0], [0.05, 0.006], [0.044, 0.012], [0.016, 0.022], [0.01, 0.045], [0.021, 0.06], [0.021, 0.07], [0.01, 0.082], [0.012, 0.1], [0.035, 0.115], [0.05, 0.14], [0.056, 0.175], [0.058, 0.205], [0.063, 0.212], [0.056, 0.213], [0.052, 0.2], [0.048, 0.16], [0.02, 0.135], [0, 0.132]],
    cup: [[0, 0], [0.07, 0], [0.076, 0.01], [0.07, 0.02], [0.03, 0.035], [0.024, 0.07], [0.04, 0.085], [0.04, 0.095], [0.03, 0.105], [0.07, 0.13], [0.105, 0.17], [0.118, 0.22], [0.116, 0.27], [0.122, 0.285], [0.128, 0.29], [0.118, 0.292], [0.108, 0.28], [0.104, 0.22], [0.09, 0.17], [0, 0.15]],
    helm: [[0, -0.005], [0.128, -0.005], [0.14, 0.0], [0.142, 0.004], [0.142, 0.032], [0.134, 0.036], [0.13, 0.06], [0.122, 0.12], [0.098, 0.18], [0.062, 0.226], [0.028, 0.252], [0.008, 0.272], [0, 0.278]],
    shield: [[0, 0.08], [0.03, 0.078], [0.062, 0.066], [0.082, 0.04], [0.095, 0.032], [0.2, 0.024], [0.36, 0.013], [0.395, 0.013], [0.42, 0.004], [0.42, -0.012], [0.39, -0.016], [0, -0.022]],
    platter: [[0, 0], [0.12, 0.002], [0.2, 0.012], [0.24, 0.03], [0.252, 0.035], [0.246, 0.038], [0.2, 0.019], [0.12, 0.009], [0, 0.007]],
    ewer: [[0, 0], [0.05, 0], [0.056, 0.01], [0.03, 0.03], [0.07, 0.09], [0.087, 0.16], [0.072, 0.23], [0.032, 0.27], [0.025, 0.31], [0.042, 0.34], [0.037, 0.346], [0.02, 0.332], [0, 0.32]],
    crownband: [[0.1, 0], [0.105, 0.004], [0.105, 0.05], [0.1, 0.055], [0.095, 0.05], [0.095, 0.004], [0.1, 0]],
    pommel: [[0, -0.03], [0.02, -0.026], [0.03, -0.01], [0.028, 0.008], [0.014, 0.02], [0.01, 0.026]],
  };
  function buildTreasure(m, kind, x, rng) {
    const gold = rng() < 0.8 ? 2 : 3;
    if (kind === 'goblet') { lathe(m, x, PROF.goblet, 18, gold, 0); for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.3; gem(m, XF(xfP(x, [0.052 * Math.cos(a), 0.175, 0.052 * Math.sin(a)]), mul(x.X, 0.008), mul(x.Y, 0.008), mul(x.Z, 0.008)), 7, k % 3); } }
    else if (kind === 'cup') { cupMesh(m, x); }
    else if (kind === 'helm') {
      lathe(m, x, PROF.helm, 22, 3, 0);
      box(m, x, [0, 0.0, 0.142], [0.014, 0.05, 0.006], 2, 0);
      box(m, x, [0, 0.2, 0], [0.006, 0.055, 0.12], 2, 0);
      gem(m, XF(xfP(x, [0, 0.07, 0.132]), mul(x.X, 0.016), mul(x.Z, -0.016), mul(x.Y, 0.016)), 7, 0);
    }
    else if (kind === 'crown') {
      lathe(m, x, PROF.crownband, 24, 2, 0);
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU, am = (a0 + a1) / 2, r = 0.104;
        const p0 = [r * Math.cos(a0), 0.05, r * Math.sin(a0)], p1 = [r * Math.cos(a1), 0.05, r * Math.sin(a1)], tip = [0.118 * Math.cos(am), 0.12, 0.118 * Math.sin(am)];
        const pin = [0.09 * Math.cos(am), 0.06, 0.09 * Math.sin(am)];
        ftri(m, x, p0, tip, p1, 2, 0); ftri(m, x, p1, tip, pin, 2, 0); ftri(m, x, pin, tip, p0, 2, 0);
        gem(m, XF(xfP(x, tip), mul(x.X, 0.01), mul(x.Y, 0.01), mul(x.Z, 0.01)), 7, 3);
        gem(m, XF(xfP(x, [0.106 * Math.cos(am), 0.027, 0.106 * Math.sin(am)]), mul(x.Y, 0.012), mul([Math.cos(am) * x.X[0] + Math.sin(am) * x.Z[0], Math.cos(am) * x.X[1] + Math.sin(am) * x.Z[1], Math.cos(am) * x.X[2] + Math.sin(am) * x.Z[2]], 0.012), mul(x.X, 0.012)), 7, k % 3);
      }
    }
    else if (kind === 'shield') { lathe(m, x, PROF.shield, 32, gold, 0); }
    else if (kind === 'platter') { lathe(m, x, PROF.platter, 28, gold, 0); }
    else if (kind === 'ewer') { lathe(m, x, PROF.ewer, 18, gold, 0); tube(m, x, [[0.07, 0.25, 0], [0.13, 0.27, 0], [0.14, 0.2, 0], [0.085, 0.13, 0]], [0.009, 0.009, 0.009, 0.009], 6, gold, 0); }
    else if (kind === 'sword') {
      const L = 0.86, secs = 10;
      let prev = null;
      for (let k = 0; k <= secs; k++) {
        const y = 0.05 + (k / secs) * L, w = 0.026 * (1 - Math.pow(k / secs, 2.2) * 0.96), th = 0.006 * (1 - (k / secs) * 0.7);
        const s = [[-w, y, 0], [0, y, th], [w, y, 0], [0, y, -th]];
        if (prev) for (let f = 0; f < 4; f++) fquad(m, x, prev[f], prev[(f + 1) % 4], s[(f + 1) % 4], s[f], 3, 0, [[0, prev[f][1]], [0.02, prev[f][1]], [0.02, y], [0, y]]);
        prev = s;
      }
      box(m, x, [0, 0.04, 0], [0.12, 0.012, 0.014], 2, 0);
      tube(m, x, [[0, 0.03, 0], [0, -0.06, 0], [0, -0.12, 0]], [0.016, 0.017, 0.016], 8, 2, 0);
      lathe(m, XF(xfP(x, [0, -0.15, 0]), x.X, x.Y, x.Z), PROF.pommel, 10, 2, 0);
    }
    else if (kind === 'gem') { gem(m, x, 7, (rng() * 4) | 0); }
  }
  function cupMesh(m, x) {
    lathe(m, x, PROF.cup, 28, 2, 0);
    for (const s of [1, -1]) tube(m, x, [[s * 0.112, 0.255, 0], [s * 0.17, 0.27, 0], [s * 0.2, 0.22, 0], [s * 0.18, 0.16, 0], [s * 0.1, 0.13, 0]], [0.011, 0.012, 0.012, 0.011, 0.01], 8, 2, 0);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; gem(m, XF(xfP(x, [0.116 * Math.cos(a), 0.235, 0.116 * Math.sin(a)]), mul(x.Y, 0.014), mul([Math.cos(a) * x.X[0] + Math.sin(a) * x.Z[0], Math.cos(a) * x.X[1] + Math.sin(a) * x.Z[1], Math.cos(a) * x.X[2] + Math.sin(a) * x.Z[2]], 0.014), mul(x.X, 0.014)), 7, k % 2); }
  }

  /* ---------------------------------------------------------------- the hall */
  function buildHeap(m) {
    const x0 = -WALLX, x1 = WALLX, z0 = ZBACK, z1 = ZFRONT, nx = 150, nz = 600;
    const base = m.n;
    const Hs = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) Hs[j * (nx + 1) + i] = heapH(lerp(x0, x1, i / nx), zAt(j));
    function zAt(j) { const u = 1 - j / nz; return lerp(z0, z1, u); } // front rows first, so that early depth rejects what lies behind
    const dx = (x1 - x0) / nx, dz = (z1 - z0) / nz;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const h = Hs[j * (nx + 1) + i];
      const hl = Hs[j * (nx + 1) + Math.max(0, i - 1)], hr2 = Hs[j * (nx + 1) + Math.min(nx, i + 1)];
      const hd = Hs[Math.max(0, j - 1) * (nx + 1) + i], hu = Hs[Math.min(nz, j + 1) * (nx + 1) + i];
      const n = norm([(hl - hr2) / (2 * dx), 1, (hd - hu) / (2 * dz)]);
      // occlusion from the local concavity
      let avg = 0, cnt = 0;
      for (let k = -3; k <= 3; k += 2) for (let l = -3; l <= 3; l += 2) { const ii = clamp(i + k, 0, nx), jj = clamp(j + l, 0, nz); avg += Hs[jj * (nx + 1) + ii]; cnt++; }
      const ao = clamp(1 - (avg / cnt - h) * 0.9, 0.35, 1);
      const x = lerp(x0, x1, i / nx), z = zAt(j);
      vert(m, [x, h, z], n, x, z, 0, ao);
    }
    gridI(m, base, nx, nz);
  }
  function buildPillar(m, cx, cz, pi) {
    const prof = [[0, 3.1], [1.6, 3.1], [1.6, 2.7], [2.0, 2.7], [2.45, 2.28], [2.8, 2.28], [2.8, 2.02],
      [7.65, 2.02], [7.65, 2.16], [9.35, 2.16], [9.35, 2.02],
      [17.65, 2.02], [17.65, 2.16], [19.35, 2.16], [19.35, 2.02],
      [27.65, 2.02], [27.65, 2.16], [29.35, 2.16], [29.35, 2.02],
      [37.65, 2.02], [37.65, 2.16], [39.35, 2.16], [39.35, 2.02],
      [44, 2.02], [46, 2.4], [48.5, 3.3], [49.5, 3.3], [49.5, 3.6], [80, 3.6]];
    const parts = (y0, y1, a0, a1) => {
      if (y0 < 2.81) return 2;
      const yb = ((y0 % 10) + 10) % 10;
      if (Math.abs(a0 - 2.16) < 0.01 && Math.abs(a1 - 2.16) < 0.01 && y0 < 40) return 1;
      if (y0 >= 44) return 6;
      return 0;
    };
    const n = 8, ca = Math.cos(PI / n);
    for (let k = 0; k < prof.length - 1; k++) {
      const [y0, a0] = prof[k], [y1, a1] = prof[k + 1];
      const part = parts(y0, y1, a0, a1);
      for (let f = 0; f < n; f++) {
        const t0 = (f / n) * TAU + PI / n, t1 = ((f + 1) / n) * TAU + PI / n;
        const r0 = a0 / ca, r1 = a1 / ca;
        const A = [cx + r0 * Math.cos(t0), y0, cz + r0 * Math.sin(t0)], B = [cx + r0 * Math.cos(t1), y0, cz + r0 * Math.sin(t1)];
        const Cc = [cx + r1 * Math.cos(t1), y1, cz + r1 * Math.sin(t1)], D = [cx + r1 * Math.cos(t0), y1, cz + r1 * Math.sin(t0)];
        const hw0 = a0 * Math.tan(PI / n), hw1 = a1 * Math.tan(PI / n);
        const nn = norm(cross(sub(D, A), sub(B, A)));
        const i0 = vert(m, A, nn, -hw0 + f * 0.0, y0, 1, part), i1 = vert(m, B, nn, hw0, y0, 1, part), i2 = vert(m, Cc, nn, hw1, y1, 1, part), i3 = vert(m, D, nn, -hw1, y1, 1, part);
        if (y0 === y1) { const up = a0 > a1 ? 1 : -1; const nu = [0, up, 0]; for (const ii of [i0, i1, i2, i3]) { m.v[ii * 10 + 3] = 0; m.v[ii * 10 + 4] = up; m.v[ii * 10 + 5] = 0; } }
        quadI(m, i0, i3, i2, i1);
      }
    }
  }
  function wallQuad(m, A, B, Cc, D, part, ua, ub, va, vb) {
    const nn = norm(cross(sub(B, A), sub(D, A)));
    const i0 = vert(m, A, nn, ua, va, 1, part), i1 = vert(m, B, nn, ub, va, 1, part), i2 = vert(m, Cc, nn, ub, vb, 1, part), i3 = vert(m, D, nn, ua, vb, 1, part);
    quadI(m, i0, i1, i2, i3);
  }
  function buildWalls(m) {
    const Y = 80;
    // left wall (faces +x)
    wallQuad(m, [-WALLX, 0, ZFRONT], [-WALLX, 0, ZBACK], [-WALLX, Y, ZBACK], [-WALLX, Y, ZFRONT], 3, ZFRONT, ZBACK, 0, Y);
    // right wall (faces -x), with the door opening
    const R = WALLX;
    wallQuad(m, [R, 0, ZBACK], [R, 0, DOOR.z0], [R, Y, DOOR.z0], [R, Y, ZBACK], 3, ZBACK, DOOR.z0, 0, Y);
    wallQuad(m, [R, 0, DOOR.z1], [R, 0, ZFRONT], [R, Y, ZFRONT], [R, Y, DOOR.z1], 3, DOOR.z1, ZFRONT, 0, Y);
    wallQuad(m, [R, 0, DOOR.z0], [R, 0, DOOR.z1], [R, DOOR.y0, DOOR.z1], [R, DOOR.y0, DOOR.z0], 3, DOOR.z0, DOOR.z1, 0, DOOR.y0);
    wallQuad(m, [R, DOOR.y1, DOOR.z0], [R, DOOR.y1, DOOR.z1], [R, Y, DOOR.z1], [R, Y, DOOR.z0], 3, DOOR.z0, DOOR.z1, DOOR.y1, Y);
    // the passage beyond the door, and the daylight at its end
    const dx = 3.5;
    wallQuad(m, [R, DOOR.y0, DOOR.z0], [R + dx, DOOR.y0, DOOR.z0], [R + dx, DOOR.y1, DOOR.z0], [R, DOOR.y1, DOOR.z0], 3, 0, dx, DOOR.y0, DOOR.y1);
    wallQuad(m, [R + dx, DOOR.y0, DOOR.z1], [R, DOOR.y0, DOOR.z1], [R, DOOR.y1, DOOR.z1], [R + dx, DOOR.y1, DOOR.z1], 3, 0, dx, DOOR.y0, DOOR.y1);
    wallQuad(m, [R, DOOR.y0, DOOR.z1], [R + dx, DOOR.y0, DOOR.z1], [R + dx, DOOR.y0, DOOR.z0], [R, DOOR.y0, DOOR.z0], 4, 0, dx, DOOR.z1, DOOR.z0);
    wallQuad(m, [R, DOOR.y1, DOOR.z0], [R + dx, DOOR.y1, DOOR.z0], [R + dx, DOOR.y1, DOOR.z1], [R, DOOR.y1, DOOR.z1], 3, 0, dx, DOOR.z0, DOOR.z1);
    const dl = m.n;
    wallQuad(m, [R + dx, DOOR.y0, DOOR.z0], [R + dx, DOOR.y0, DOOR.z1], [R + dx, DOOR.y1, DOOR.z1], [R + dx, DOOR.y1, DOOR.z0], 0, 0, 1, 0, 1);
    for (let k = dl; k < m.n; k++) m.v[k * 10 + 8] = 10;
    // the door leaf, almost shut: a sliver of day along its edge
    const hz = DOOR.z1, open = 0.55, Ld = DOOR.z1 - DOOR.z0 - 0.06;
    const ez = hz - Ld * Math.cos(open), ex = R + 0.25 + Ld * Math.sin(open);
    wallQuad(m, [R + 0.25, DOOR.y0, hz], [ex, DOOR.y0, ez], [ex, DOOR.y1 - 0.05, ez], [R + 0.25, DOOR.y1 - 0.05, hz], 3, 0, Ld, DOOR.y0, DOOR.y1);
    // back and front walls
    wallQuad(m, [-WALLX, 0, ZBACK], [WALLX, 0, ZBACK], [WALLX, Y, ZBACK], [-WALLX, Y, ZBACK], 3, -WALLX, WALLX, 0, Y);
    wallQuad(m, [WALLX, 0, ZFRONT], [-WALLX, 0, ZFRONT], [-WALLX, Y, ZFRONT], [WALLX, Y, ZFRONT], 3, WALLX, -WALLX, 0, Y);
  }
  function buildStair(m) {
    const S = STAIR, x = XF([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const run = (S.z1 - S.z0) / S.n, rise = (S.y1 - S.y0) / S.n;
    for (let k = 0; k < S.n; k++) {
      const za = S.z0 + k * run, zb = za + run, yt = S.y0 + (k + 1) * rise;
      const jitter = (hr(k, 3) - 0.5) * 0.03;
      // tread
      wallQuad(m, [S.x0, yt + jitter, zb], [S.x1, yt + jitter, zb], [S.x1, yt + jitter, za], [S.x0, yt + jitter, za], 4, S.x0, S.x1, zb, za);
      // riser (faces -z)
      wallQuad(m, [S.x1, yt - rise, za], [S.x0, yt - rise, za], [S.x0, yt + jitter, za], [S.x1, yt + jitter, za], 5, S.x1, S.x0, yt - rise, yt);
      // side (faces -x), down to the floor
      wallQuad(m, [S.x0, 0, za], [S.x0, 0, zb], [S.x0, yt + jitter, zb], [S.x0, yt + jitter, za], 3, za, zb, 0, yt);
    }
    // the landing before the door
    box(m, x, [(S.x0 + S.x1) / 2, S.y1 - 0.2, (S.z1 + DOOR.z1 + 1.2) / 2], [(S.x1 - S.x0) / 2, 0.2, (DOOR.z1 + 1.2 - S.z1) / 2], 1, 4);
  }
  // treasure placement on the gold, half sunk
  function placeTreasure(m, rng, kind, x, z, s, tilt) {
    const h = heapH(x, z), n = heapN(x, z);
    let up = norm(add(n, [(rng() - 0.5) * tilt, 0, (rng() - 0.5) * tilt]));
    let sink = 0.02;
    if (kind === 'sword') { up = norm([(rng() - 0.5) * 1.4, 1, (rng() - 0.5) * 1.4]); sink = 0.35; }
    if (kind === 'shield') { up = norm(add(n, [(rng() - 0.5) * 1.6, 0.2, (rng() - 0.5) * 1.6])); sink = 0.06; }
    if (kind === 'helm' && rng() < 0.4) { up = norm([(rng() - 0.5) * 2, 0.4, (rng() - 0.5) * 2]); sink = 0.08; }
    if (kind === 'goblet' && rng() < 0.4) { up = norm([(rng() - 0.5) * 2, 0.15, (rng() - 0.5) * 2]); sink = 0.03; }
    const x0 = xfFrom([x, h - sink * s * (kind === 'sword' ? 1.6 : 4), z], up, rng() * TAU, s);
    buildTreasure(m, kind, x0, rng);
  }
  const KINDS = ['goblet', 'goblet', 'helm', 'crown', 'shield', 'shield', 'platter', 'ewer', 'sword', 'sword', 'gem', 'gem', 'gem'];
  function buildTreasures(m, rng) {
    // along the flight
    for (let k = 0; k < 260; k++) {
      const z = lerp(-60, 31, rng()), off = (rng() - 0.5) * 2, x = corridorX(z) + Math.sign(off) * (0.5 + Math.abs(off) * Math.abs(off) * 7);
      const kind = KINDS[(rng() * KINDS.length) | 0];
      const s = kind === 'gem' ? 0.03 + rng() * 0.03 : 1.1 + rng() * 0.9;
      placeTreasure(m, rng, kind, x, z, s, 0.8);
    }
    // heaped against the pillars and on the far mound
    for (let k = 0; k < 160; k++) {
      const z = lerp(-130, 30, rng()), x = (rng() < 0.5 ? -1 : 1) * lerp(8, 20, rng());
      const kind = KINDS[(rng() * 10) | 0];
      placeTreasure(m, rng, kind, x, z, 1.4 + rng() * 1.6, 0.8);
    }
    for (let k = 0; k < 120; k++) {
      const a = rng() * TAU, r = 6 + rng() * 22, x = MOUND[0] + Math.cos(a) * r, z = MOUND[1] + Math.sin(a) * r;
      const kind = KINDS[(rng() * KINDS.length) | 0];
      placeTreasure(m, rng, kind, x, z, kind === 'gem' ? 0.05 + rng() * 0.05 : 1.3 + rng() * 1.2, 0.8);
    }
    // treasure at the feet of the orbit
    for (let k = 0; k < 26; k++) {
      const o = orbitPos(lerp(14.8, 22, k / 25)), dir = norm([o.cc[0] - o.p[0], 0, o.cc[2] - o.p[2]]), side = [-dir[2], 0, dir[0]];
      const f = 3 + rng() * 7, sd = (rng() - 0.5) * f * 1.2;
      placeTreasure(m, rng, ['helm', 'shield', 'goblet', 'crown', 'sword', 'ewer', 'platter'][k % 7], o.p[0] + dir[0] * f + side[0] * sd, o.p[2] + dir[2] * f + side[2] * sd, 1.6 + rng() * 1.2, 0.7);
    }
    // a few hero pieces where the camera passes close
    const hero = [['helm', 0.9, 20.5, 1.7], ['shield', -1.1, 12.0, 2.2], ['goblet', 1.0, 6.0, 2.4], ['crown', -0.8, -2.0, 2.4], ['sword', 1.2, -9.0, 1.9], ['ewer', -1.3, -17.0, 2.0], ['shield', 1.6, -25.0, 2.4], ['helm', -1.0, -33.0, 2.2], ['crown', 1.1, -41.0, 2.6], ['goblet', -0.9, -47.0, 2.4]];
    for (const [kind, ox, z, s] of hero) placeTreasure(m, rng, kind, corridorX(z) + ox, z, s, 0.6);
    for (let k = 0; k < 44; k++) {
      const z = lerp(26, -54, k / 43) + (rng() - 0.5) * 1.5, side = k % 2 ? 1 : -1;
      const kind = ['helm', 'shield', 'goblet', 'crown', 'sword', 'ewer', 'platter', 'shield'][k % 8];
      placeTreasure(m, rng, kind, corridorX(z) + side * (0.9 + rng() * 1.6), z, 1.8 + rng() * 1.4, 0.7);
    }
    // on the lip of the bank, in the dark beside the rolling coin
    placeTreasure(m, rng, 'goblet', -0.55, 33.95, 1.0, 0.2);
    placeTreasure(m, rng, 'gem', 0.42, 33.86, 0.022, 0.2);
    placeTreasure(m, rng, 'gem', -0.1, 33.6, 0.018, 0.2);
  }

  /* ================================================================== coins */
  // instance: C xyz, R | axis xyz, seed | thickness ratio, heat, hidden, roll angle
  const CF = 12;
  let STAT = null, NSTAT = 0, AVAL = null, NAVAL = 0, CBUF = null;
  function coinPush(arr, k, c, R, ax, seed, heat, roll) {
    const o = k * CF; arr[o] = c[0]; arr[o + 1] = c[1]; arr[o + 2] = c[2]; arr[o + 3] = R;
    const a = norm(ax); arr[o + 4] = a[0]; arr[o + 5] = a[1]; arr[o + 6] = a[2]; arr[o + 7] = seed;
    arr[o + 8] = 0.075; arr[o + 9] = heat || 0; arr[o + 10] = 0; arr[o + 11] = roll || 0;
  }
  function restingCoin(rng, x, z, R, tiltMax) {
    const n = heapN(x, z), a = rng() * TAU, tl = Math.pow(rng(), 1.5) * tiltMax;
    const ax = norm(add(n, [Math.cos(a) * Math.tan(tl), 0, Math.sin(a) * Math.tan(tl)]));
    const y = heapH(x, z) + R * Math.sin(tl) * 0.55 + R * 0.06;
    return { c: [x, y, z], ax, R };
  }
  function buildCoins(rng) {
    const list = [];
    // the lip of the bank: a bed of loose coins under the rolling one
    for (let k = 0; k < 1500; k++) {
      const x = lerp(-1.0, 1.3, rng()), z = lerp(33.15, 34.7, Math.pow(rng(), 0.8));
      if (Math.abs(z - HOOK.z) < 0.05 && x > -0.45 && x < 0.3) continue;
      list.push(restingCoin(rng, x, z, 0.019 + rng() * 0.008, 0.6));
    }
    // along the flight
    for (let k = 0; k < 9000; k++) {
      const z = lerp(-62, 30, rng()), off = (rng() - 0.5) * 2, x = corridorX(z) + off * Math.abs(off) * 6;
      list.push(restingCoin(rng, x, z, 0.02 + rng() * 0.012, 0.9));
    }
    // under the orbiting camera: coins at its feet, so that he is seen at the scale of a coin
    for (let k = 0; k < 5200; k++) {
      const tt = lerp(14.6, 22, rng()), o = orbitPos(tt);
      const dir = norm([o.cc[0] - o.p[0], 0, o.cc[2] - o.p[2]]), side = [-dir[2], 0, dir[0]];
      const f = 1.5 + Math.pow(rng(), 0.7) * 9, sd = (rng() - 0.5) * f * 1.1;
      const x = o.p[0] + dir[0] * f + side[0] * sd, z = o.p[2] + dir[2] * f + side[2] * sd;
      list.push(restingCoin(rng, x, z, 0.022 + rng() * 0.014, 0.9));
    }
    // the ridge and the near flank of the mound, where the thief walks
    for (let k = 0; k < 3500; k++) {
      const x = lerp(-14, 10, rng()), z = lerp(-84, -62, rng());
      list.push(restingCoin(rng, x, z, 0.022 + rng() * 0.012, 0.9));
    }
    NSTAT = list.length; STAT = new Float32Array(NSTAT * CF);
    list.forEach((c, k) => coinPush(STAT, k, c.c, c.R, c.ax, rng() * 100, 0, rng() * TAU));
    // the avalanche: coins resting on the face of the bank, released by the falling coin
    const av = [];
    for (let k = 0; k < 3400; k++) {
      const x = lerp(-1.8, 2.3, rng()), z = lerp(26.5, 33.45, Math.pow(rng(), 0.6));
      const c = restingCoin(rng, x, z, 0.019 + rng() * 0.01, 0.8);
      const d = Math.hypot(x - 0.15, (z - 33.4) * 0.7);
      c.t0 = 2.42 + d / 2.4 + rng() * 0.25;
      c.smax = 1.5 + rng() * 4.5 + (33.5 - z) * 0.2;
      c.acc = 2.2 + rng() * 2.5;
      c.spread = (rng() - 0.5) * 0.5 + (x - 0.15) * 0.08;
      c.spin = (rng() - 0.5) * 30; c.sax = norm([rng() - 0.5, rng() - 0.5, rng() - 0.5]); c.bph = rng() * TAU; c.bfr = 6 + rng() * 8;
      c.seed = rng() * 100; c.roll = rng() * TAU;
      av.push(c);
    }
    AVAL = av; NAVAL = av.length;
    CBUF = new Float32Array((NSTAT + NAVAL + 10000) * CF);
  }
  function avalancheCoin(c, t, out, k) {
    const tau = t - c.t0;
    if (tau <= 0) { coinPush(out, k, c.c, c.R, c.ax, c.seed, 0, c.roll); return; }
    let s = c.acc * tau * tau / (1 + tau * 0.9);
    s = c.smax * (1 - Math.exp(-s / c.smax));
    const dir = norm([c.spread, 0, -1]);
    const x = c.c[0] + dir[0] * s, z = c.c[2] + dir[2] * s;
    const moving = Math.exp(-Math.max(0, s - c.smax * 0.8) * 2);
    const bounce = Math.abs(Math.sin(tau * c.bfr + c.bph)) * 0.03 * Math.exp(-tau * 0.8) * moving;
    const y = heapH(x, z) + c.R * 0.5 + bounce;
    const ax = rotAxis(c.ax, c.sax, c.spin * Math.min(tau, 1.6) * 0.6 * moving + c.spin * 0.1 * tau);
    coinPush(out, k, [x, y, z], c.R, ax, c.seed, 0, c.roll + s / c.R * 0.3);
  }
  // the hero coin of the hook
  function hookCoin(t) {
    const R = 0.024;
    if (t < 1.8) {
      const x = -0.36 + 0.36 * t - 0.05 * t * t, top = heapH(x, HOOK.z);
      const lean = 0.06 * Math.sin(t * 4.2) * (0.3 + t / 1.8) + 0.03 * sstep(1.2, 1.8, t);
      const ax = rotAxis([0, 0, 1], [1, 0, 0], lean);
      const up = rotAxis([0, 1, 0], [1, 0, 0], lean);
      return { c: [x, top + R * Math.cos(lean) + 0.002, HOOK.z - Math.sin(lean) * R * 0.0], ax, R, roll: -(x + 0.36) / R };
    }
    if (t < 2.25) {
      const u = (t - 1.8) / 0.45, x = -0.36 + 0.36 * 1.8 - 0.05 * 3.24 + (t - 1.8) * 0.06, top = heapH(x, HOOK.z);
      const lean = lerp(0.032, PI / 2 - 0.06, EZ.i2(u));
      const ax = rotAxis([0, 0, 1], [1, 0, 0], lean);
      const contact = [x, top, HOOK.z];
      const c = add(contact, mul(rotAxis([0, 1, 0], [1, 0, 0], lean), R));
      return { c, ax, R, roll: -(x + 0.36) / R - u * 0.4 };
    }
    const tau = t - 2.25, x0 = -0.36 + 0.648 - 0.162 + 0.027;
    const s = 2.6 * tau * tau / (1 + tau * 0.35);
    const z = HOOK.z - R - s, x = x0 + s * 0.06 + Math.sin(tau * 3) * 0.02;
    const bounce = Math.abs(Math.sin(tau * 11)) * 0.028 * Math.exp(-tau * 1.2) + Math.abs(Math.sin(tau * 23)) * 0.006;
    const n = heapN(x, z);
    const ax = norm(add(n, [Math.sin(tau * 13) * 0.35, 0, Math.cos(tau * 9) * 0.3]));
    return { c: [x, heapH(x, z) + R * 0.4 + bounce, z], ax, R, roll: tau * 14 };
  }

  /* ================================================================== the camera */
  // Hermite spline through timed keys [t, value(array)] with Catmull-Rom tangents
  function kspline(keys, t) {
    if (t <= keys[0][0]) return keys[0][1].slice();
    const n = keys.length;
    if (t >= keys[n - 1][0]) return keys[n - 1][1].slice();
    let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[i], k1 = keys[i + 1], dt = k1[0] - k0[0], u = (t - k0[0]) / dt;
    const tg = (j) => {
      const a = keys[Math.max(0, j - 1)], b = keys[Math.min(n - 1, j + 1)];
      if (j === 0 || j === n - 1) return k0[1].map(() => 0);
      return a[1].map((v, d) => (b[1][d] - v) / (b[0] - a[0]));
    };
    const m0 = tg(i), m1 = tg(i + 1);
    const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return k0[1].map((v, d) => h00 * v + h10 * dt * m0[d] + h01 * k1[1][d] + h11 * dt * m1[d]);
  }
  let CAMK = null;
  function avgH(x, z) { let s = 0; for (let k = -2; k <= 2; k++) s += heapH(x, z + k * 1.2) + heapH(x + 0.8, z + k * 1.2) * 0 ; return s / 5; }
  function buildCamera() {
    const top = HOOK.top;
    // hook: [t, px,py,pz, qx,qy,qz, fov, focus]
    const hook = [
      [0.0, -0.22, top + 0.04, 33.99, -0.17, top + 0.022, 33.70, 34, 0.29],
      [0.9, -0.1, top + 0.042, 34.0, -0.02, top + 0.022, 33.70, 34, 0.3],
      [1.7, 0.08, top + 0.05, 33.98, 0.14, top + 0.02, 33.70, 33, 0.29],
      [2.25, 0.18, top + 0.14, 33.92, 0.2, top - 0.05, 33.5, 38, 0.4],
      [2.9, 0.26, top - 0.05, 33.3, 0.28, top - 0.75, 31.9, 44, 0.9],
      [3.5, 0.3, top - 0.25, 32.5, 0.35, 1.5, 28.5, 52, 2.0],
      [4.1, 0.4, 2.55, 30.6, 0.55, 0.9, 22.0, 56, 6.0],
    ];
    const fl = [];
    for (let k = 0; k <= 22; k++) {
      const t = 4.6 + k * 0.42;
      const u = (t - 4.6) / (13.84 - 4.6);
      const z = lerp(29.2, -56, EZ.io2(u) * 0.35 + u * 0.65);
      const x = corridorX(z) + 0.7 * Math.sin(t * 0.9);
      const clr = lerp(1.15, 0.75, Math.sin(u * PI)) + 2.6 * sstep(0.72, 1, u);
      const y = avgH(x, z) + clr;
      const za = z - 9 - 14 * sstep(0.75, 1, u), xa = corridorX(za) + 0.5 * Math.sin((t + 0.8) * 0.9);
      const ya = lerp(avgH(xa, za) + 0.1, 9.5, sstep(0.7, 1, u));
      fl.push([t, x, y, z, xa, ya, za, 58 - 6 * sstep(0.85, 1, u), 7]);
    }
    const kk = (a) => a.map((k) => [k[0], k.slice(1)]);
    CAMK = { hook: kk(hook), fl: kk(fl) };
  }
  function hookTrack(t) {
    // the camera rides behind the falling coin, then lifts away to watch the avalanche go
    const hc = hookCoin(Math.min(t, 4.4)).c;
    const k = sstep(2.8, 4.5, t);
    const o = lerp3([0.03, 0.11, 0.26], [0.25, 1.0, 2.2], k);
    let p = add(hc, o);
    p[1] = Math.max(p[1], heapH(p[0], p[2]) + 0.07);
    const q = lerp3(add(hc, [0, -0.01, -0.12]), [0.6, 1.0, 21.5], sstep(3.0, 4.7, t));
    return [p[0], p[1], p[2], q[0], q[1], q[2], lerp(40, 56, k), lerp(0.3, 6, k)];
  }
  // later shots are keyed as [t, px,py,pz, qx,qy,qz, fov, headWeight]; the target leans toward his head by headWeight
  const SHOTK = {
    rise: [
      [31.9, -12.5, 13.5, -68, -4, 11, -85, 40, 0.9],
      [35.0, -12, 14.5, -66, -4, 14, -85, 42, 0.9],
      [37.8, -11, 10.5, -54, -3, 17, -92, 58, 0.3],
      [40.4, -7, 11, -42, -2, 19, -92, 62, 0.2],
      [43.95, 3, 6.5, -27, -2, 13, -90, 58, 0.3]],
    fire: [
      [43.95, 3, 6.5, -27, -2, 13, -90, 58, 0.3],
      [45.0, 10, 7.0, -27, -1, 11, -85, 56, 0.6],
      [49.0, 11, 6.6, -24.5, -2, 9, -70, 60, 0.4],
      [52.0, 10.5, 6.4, -26, 0, 9, -76, 58, 0.4]],
    end: [
      [52.0, 10.5, 6.4, -26, 0, 9, -76, 58, 0.4],
      [53.6, 10, 11, -44.5, 24, 8, -44, 54, 0],
      [55.2, 18.5, 18.5, -44.5, 22.2, 6.5, -36, 50, 0],
      [57.6, 18.7, 21.0, -45.0, 22.4, 10.0, -28, 46, 0],
      [60.0, 18.9, 22.0, -45.2, 23.0, 17.5, -16, 44, 0]],
  };
  // the cup: it lifts by itself, as if carried
  function cupPos(t) {
    const hy = heapH(CUP0[0], CUP0[2]);
    if (t < 24.6) return [CUP0[0], hy - 0.04, CUP0[2]];
    const u = clamp((t - 24.6) / 3.4, 0, 1), lift = EZ.o2(clamp((t - 24.6) / 0.8, 0, 1));
    const x = CUP0[0] - 2.6 * u * u, z = CUP0[2] + 3.2 * u;
    const bob = Math.abs(Math.sin((t - 24.6) * 5.2)) * 0.05 * lift;
    return [x, heapH(x, z) + lift * 0.72 + bob, z];
  }
  function headPos() { return DRAG ? DRAG.head.W2([2.4, 0.2, 0]) : [0, 11, -84]; }
  function keyedShot(keys, t) {
    if (!keys.kk) keys.kk = keys.map((k) => [k[0], k.slice(1)]);
    const k = kspline(keys.kk, t), h = headPos(), w = k[7];
    const q = lerp3([k[3], k[4], k[5]], h, w), p = [k[0], k[1], k[2]];
    p[1] = Math.max(p[1], heapH(p[0], p[2]) + 2.2);
    return [p[0], p[1], p[2], q[0], q[1], q[2], k[6], len(sub(q, p))];
  }
  function orbitPos(t) {
    const u = EZ.s(clamp((t - 13.6) / 8.6, 0, 1));
    const cc = [M0 - 1, heapH(M0, M1) + 0.5, M1 + 3];
    const a = lerp(0.05, 0.92, u), R = lerp(30, 19, u);
    const p = [cc[0] + R * Math.sin(a), 0, cc[2] + R * Math.cos(a)];
    p[1] = Math.max(lerp(13.5, 9.5, sstep(0, 0.35, u)), heapH(p[0], p[2]) + 2.4 + 0.8 * Math.sin(u * PI));
    return { p, cc, u };
  }
  function orbitShot(t) {
    const { p, cc } = orbitPos(t);
    const q = lerp3(add(cc, [0, -0.5, 0]), headPos(), 0.3);
    return [p[0], p[1], p[2], q[0], q[1], q[2], 44, len(sub(q, p))];
  }
  const CUP0 = [2.4, 0, -75.6];
  function thiefShot(t) {
    const u = EZ.s(clamp((t - 22) / 6, 0, 1)), hy = heapH(CUP0[0], CUP0[2]);
    const px = lerp(3.1, 2.6, u), pz = lerp(-72.2, -72.6, u);
    const p = [px, Math.max(heapH(px, pz), hy) + lerp(0.6, 0.75, u), pz];
    const c = cupPos(t);
    let q = lerp3(add(CUP0, [0, hy + 0.15, 0]), add(c, [0, 0.12, 0]), 0.6);
    q = lerp3(q, headPos(), 0.12);
    return [p[0], p[1], p[2], q[0], q[1], q[2], 38, len(sub(q, p))];
  }
  function eyeShot(t) {
    if (!DRAG) return [0, 10, -80, 0, 10, -85, 30, 1];
    let e = DRAG.eyes[1];
    const u = EZ.s(clamp((t - 28) / 4, 0, 1)), d = lerp(1.55, 1.1, u);
    const p = add(e.c, add(mul(e.F, d), add(mul(e.U, 0.1), mul(e.R, -0.12))));
    const q = add(e.c, mul(e.U, 0.05));
    return [p[0], p[1], p[2], q[0], q[1], q[2], 30, d];
  }
  function camAt(t) {
    let k, ap = 6, roll = 0;
    if (t < 2.25) k = kspline(CAMK.hook, t);
    else if (t < 4.2) {
      const a = kspline(CAMK.hook, Math.min(t, 2.6)), b = hookTrack(t), w = sstep(2.25, 2.7, t);
      k = a.map((v, i) => lerp(v, b[i], w));
    } else if (t < 13.4) {
      const a = hookTrack(Math.min(t, 5.2)), b = kspline(CAMK.fl, Math.max(t, 4.6)), w = sstep(4.2, 5.2, t);
      k = a.map((v, i) => lerp(v, b[i], w));
    } else if (t < 22) {
      const a = kspline(CAMK.fl, t), b = orbitShot(t), w = sstep(13.4, 14.8, t);
      k = a.map((v, i) => lerp(v, b[i], w)); ap = 3;
    } else if (t < 28) { k = thiefShot(t); ap = 9; }
    else if (t < 32) { k = eyeShot(t); ap = 7; }
    else if (t < 43.95) { k = keyedShot(SHOTK.rise, t); ap = 2; }
    else if (t < 52) { k = keyedShot(SHOTK.fire, t); ap = 2; }
    else { k = keyedShot(SHOTK.end, t); ap = 2; }
    if (t > 4.4 && t < 14) { const a = kspline(CAMK.fl, t - 0.3), b = kspline(CAMK.fl, t + 0.3); roll = clamp((b[1] - a[1]) * 0.12, -0.12, 0.12) * sstep(4.4, 5.5, t) * (1 - sstep(13, 14, t)); }
    // the floor shakes when he rises and when he breathes
    const shake = 0.06 * sstep(35, 36, t) * (1 - sstep(39, 41, t)) + 0.1 * sstep(45.2, 45.8, t) * (1 - sstep(49, 51.5, t));
    if (shake > 0) { k[0] += shake * Math.sin(t * 37) ; k[1] += shake * Math.sin(t * 29 + 1); k[3] += shake * 2 * Math.sin(t * 31 + 2); }
    return { p: [k[0], k[1], k[2]], q: [k[3], k[4], k[5]], fov: k[6], focus: k[7], roll, ap: t < 2.9 ? 14 : t < 4.2 ? lerp(14, 6, sstep(2.9, 3.6, t)) : ap, near: t > 28 && t < 32 ? 0.02 : 0.06 };
  }

  /* ================================================================== light, per moment */
  function lightsAt(t) {
    const L = {
      sunC: [2.6, 2.45, 2.2], amb: [0.008, 0.007, 0.006], glow: [0, 9, -95, 45], glowC: [0, 0, 0],
      fire: [[0, -50, 0, 1], [0, -50, 0, 1], [0, -50, 0, 1], [0, -50, 0, 1]], fireC: [0, 0, 0],
      lamp: [0, -50, 0, 1], lampC: [0, 0, 0], expo: 1.0, shaftK: 0.05, voidT: 0.985, heat: 0, fogD: 70,
    };
    if (t < 4.6) {
      // the dark of the hook: only the thread of light; then the far glow, as the eye adjusts
      L.amb = mul([0.01, 0.008, 0.006], 0.15 + 0.85 * sstep(2.4, 4.6, t));
      L.glow = [0, 11, -95, 32]; L.glowC = mul([7, 3.0, 1.0], 0.05 + 0.95 * sstep(2.6, 5.0, t));
      L.lamp = [0.6, HOOK.top + 0.9, 31.5, 1.6]; L.lampC = mul([1.0, 0.55, 0.25], 0.02 + 0.45 * sstep(2.4, 4.0, t));
      L.sunC = [3.4, 3.2, 2.8];
      L.expo = 1.25; L.shaftK = lerp(0.5, 0.07, sstep(2.4, 3.8, t)); L.fogD = lerp(4, 40, sstep(2.6, 4.6, t));
      L.envK = 0.05 + 0.95 * sstep(2.6, 4.6, t);
      L.shaftW = [0.55, lerp(0, 0.35, sstep(2.3, 3.2, t)), lerp(0, 1, sstep(3.6, 4.6, t)), 0, 0, 0, 0, 0];
      L.voidT = 0.99;
    } else if (t < 14.5) {
      L.glowC = [7, 3.0, 1.0]; L.glow = [0, 11, -95, 32];
      L.expo = 1.3; L.shaftK = 0.07; L.fogD = 34;
    } else if (t < 22) {
      L.glowC = [10, 4.3, 1.5]; L.glow = [0, 11, -95, 20];
      L.amb = [0.005, 0.0045, 0.004];
      L.expo = 1.3; L.shaftK = 0.06; L.fogD = 60;
    } else if (t < 28) {
      L.glowC = [8, 3.4, 1.2]; L.glow = [0, 11, -95, 22];
      L.expo = 1.3; L.shaftK = 0.05; L.fogD = 60;
    } else if (t < 32) {
      L.glowC = [3, 1.3, 0.5]; L.glow = [0, 11, -95, 22];
      L.amb = [0.004, 0.0035, 0.003]; L.envK = 0.3;
      L.lamp = [0, 0, 0, 1]; L.lampC = [1.0, 0.6, 0.3];
      L.expo = 1.2; L.shaftK = 0.0; L.fogD = 30; L.shaftW = [0, 0, 0, 0, 0, 1, 1, 0];
    } else if (t < 44) {
      const k = sstep(32, 44, t);
      L.glowC = mul([8, 3.4, 1.2], 1 + 0.3 * k); L.glow = [0, 11, -95, lerp(22, 26, k)];
      L.expo = 1.25; L.shaftK = 0.06; L.fogD = 140;
    } else if (t < 52.5) {
      L.glowC = mul([8, 3.4, 1.1], 1 + 0.4 * sstep(44.5, 45.5, t)); L.glow = [0, 11, -95, 26];
      L.expo = 1.2; L.shaftK = 0.04; L.fogD = 140; L.heat = 1;
    } else {
      const k = sstep(52, 58, t);
      L.glowC = mul([10, 4.2, 1.4], 1 - 0.6 * k); L.glow = [0, 11, -95, 30];
      L.expo = 1.3; L.shaftK = lerp(0.03, 0.12, k); L.fogD = 90; L.heat = 1 - sstep(52, 55, t);
      L.lamp = [WALLX - 1.5, DOOR.y0 + 1.8, (DOOR.z0 + DOOR.z1) / 2, 16]; L.lampC = mul([2.6, 2.5, 2.3], sstep(53, 56, t)); L.amb = [0.012, 0.011, 0.01];
      L.shaftW = [0, 0, 0, 1, 0, 0, 0, 3];
    }
    return L;
  }
  function top0() { return HOOK.top; }

  /* ================================================================== the WebGL engine */
  let VLOBE = null, gl = null, GLC = null, PR = {}, FB = null, MESH_S = null, MESH_D = null, VCOIN = null, VSPR = null, VFULL = null;
  let SPRBUF = null, NSPR = 0, GLERR = '';
  function compile(type, src, name) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s); GLERR = name + ': ' + log;
      const lines = src.split('\n'); const m = /0:(\d+)/.exec(log || '');
      console.error('[hoard] shader ' + name + ' failed: ' + log + (m ? ' >> ' + lines[+m[1] - 1] : ''));
      throw new Error('shader ' + name);
    }
    return s;
  }
  function program(vs, fs, attrs, name, defs) {
    if (defs) fs = fs.replace('#version 300 es\n', '#version 300 es\n' + defs + '\n');
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs, name + '.vs')); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs, name + '.fs'));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('[hoard] link ' + name + ': ' + gl.getProgramInfoLog(p)); throw new Error('link ' + name); }
    p.U = {}; return p;
  }
  const MPROG = {};
  function meshProg(mat, fire) {
    const k = mat + '_' + (fire ? 1 : 0);
    if (!MPROG[k]) MPROG[k] = program(VS_MESH, fsMesh(mat, fire), ['aP', 'aN', 'aUV', 'aAux'], 'mesh' + k);
    return MPROG[k];
  }
  function variant(key, vs, fs, attrs, defs) {
    if (!MPROG[key]) MPROG[key] = program(vs, fs, attrs, key, defs);
    return MPROG[key];
  }
  const coinProg = (fire) => variant('coin' + (fire ? 1 : 0), VS_COIN, FS_COIN, ['aQ', 'iC', 'iA', 'iK'], '#define LSF ' + (fire ? 1 : 0));
  const postProg = (dof, plate) => variant('post' + (dof ? 1 : 0) + (plate ? 1 : 0), VS_FULL, FS_POST, ['aQ'], '#define DOF ' + (dof ? 1 : 0) + '\n#define PLATE ' + (plate ? 1 : 0));
  function U(p, n) { if (!(n in p.U)) p.U[n] = gl.getUniformLocation(p, n); return p.U[n]; }
  function u1(p, n, v) { const l = U(p, n); if (l) gl.uniform1f(l, v); }
  function u2(p, n, v) { const l = U(p, n); if (l) gl.uniform2fv(l, v); }
  function u3(p, n, v) { const l = U(p, n); if (l) gl.uniform3fv(l, v); }
  function u4(p, n, v) { const l = U(p, n); if (l) gl.uniform4fv(l, v); }
  function um4(p, n, v) { const l = U(p, n); if (l) gl.uniformMatrix4fv(l, false, v); }
  function initGL(canvas) {
    gl = canvas.getContext('webgl2', { antialias: false, depth: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_color_buffer_half_float');
    VFULL = gl.createVertexArray(); gl.bindVertexArray(VFULL);
    const fb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    // a unit cube, wound counter-clockwise from outside
    const cv = [], C8 = (i, j, k) => [i, j, k];
    const faces = [[C8(1, -1, -1), C8(1, 1, -1), C8(1, 1, 1), C8(1, -1, 1)], [C8(-1, -1, -1), C8(-1, -1, 1), C8(-1, 1, 1), C8(-1, 1, -1)],
      [C8(-1, 1, -1), C8(-1, 1, 1), C8(1, 1, 1), C8(1, 1, -1)], [C8(-1, -1, -1), C8(1, -1, -1), C8(1, -1, 1), C8(-1, -1, 1)],
      [C8(-1, -1, 1), C8(1, -1, 1), C8(1, 1, 1), C8(-1, 1, 1)], [C8(-1, -1, -1), C8(-1, 1, -1), C8(1, 1, -1), C8(1, -1, -1)]];
    for (const f of faces) for (const tr of [[0, 1, 2], [0, 2, 3]]) {
      let a = f[tr[0]], b = f[tr[1]], c = f[tr[2]];
      const nn = cross(sub(b, a), sub(c, a)), ctr = mul(add(add(a, b), c), 1 / 3);
      if (dot(nn, ctr) < 0) { const tmp = b; b = c; c = tmp; }
      cv.push(...a, ...b, ...c);
    }
    const cube = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cube); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cv), gl.STATIC_DRAW);
    const inst = (nAttr, geo, comps) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, geo || quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, comps || 2, gl.FLOAT, false, 0, 0);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib);
      for (let a = 0; a < nAttr; a++) { gl.enableVertexAttribArray(1 + a); gl.vertexAttribPointer(1 + a, 4, gl.FLOAT, false, nAttr * 16, a * 16); gl.vertexAttribDivisor(1 + a, 1); }
      gl.bindVertexArray(null); return { vao, ib, n: 0 };
    };
    VCOIN = inst(3, cube, 3); VSPR = inst(3); VLOBE = inst(3);
    return true;
  }
  function meshVAO(dynamic) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    const st = 40;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, st, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, st, 32);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bindVertexArray(null);
    return { vao, vb, ib, n: 0, dynamic };
  }
  // sort the triangles of a mesh into batches by material, so that each batch runs its own small shader
  function groupMesh(m) {
    const by = {}, v = m.v, idx = m.i;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], mat = Math.round(v[a * 10 + 8]), part = Math.round(v[a * 10 + 9]);
      // wind every triangle counter-clockwise about its normal, so that back faces can be culled
      { const b = idx[t + 1], c = idx[t + 2];
        const ex = v[b * 10] - v[a * 10], ey = v[b * 10 + 1] - v[a * 10 + 1], ez = v[b * 10 + 2] - v[a * 10 + 2];
        const fx = v[c * 10] - v[a * 10], fy = v[c * 10 + 1] - v[a * 10 + 1], fz = v[c * 10 + 2] - v[a * 10 + 2];
        const nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
        const sx = v[a * 10 + 3] + v[b * 10 + 3] + v[c * 10 + 3], sy = v[a * 10 + 4] + v[b * 10 + 4] + v[c * 10 + 4], sz = v[a * 10 + 5] + v[b * 10 + 5] + v[c * 10 + 5];
        if (nx * sx + ny * sy + nz * sz < 0) { idx[t + 1] = c; idx[t + 2] = b; } }
      const key = mat === 3 ? 2 : mat === 1 && part === 1 ? 11 : mat;
      (by[key] || (by[key] = [])).push(idx[t], idx[t + 1], idx[t + 2]);
    }
    const out = [], groups = [];
    for (const k of Object.keys(by).map(Number).sort((x, y) => x - y)) { groups.push({ mat: k, off: out.length, n: by[k].length }); for (const i of by[k]) out.push(i); }
    m.i = out; m.groups = groups;
  }
  function drawGroups(M, fire) {
    gl.bindVertexArray(M.vao);
    for (const g of M.groups) {
      const p = meshProg(g.mat, fire); gl.useProgram(p); setCommon(p); um4(p, 'uM', F.modelM || IDENT);
      const cull = M.cull && (g.mat === 0 || g.mat === 1 || g.mat === 11);
      if (cull) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); } else gl.disable(gl.CULL_FACE);
      gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_INT, g.off * 4);
    }
    gl.disable(gl.CULL_FACE);
  }
  function uploadMesh(M, m) {
    gl.bindVertexArray(M.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, M.vb); gl.bufferData(gl.ARRAY_BUFFER, m.v instanceof Float32Array ? m.v : new Float32Array(m.v), M.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, M.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.i instanceof Uint32Array ? m.i : new Uint32Array(m.i), M.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    M.n = m.i.length; M.groups = m.groups || [{ mat: 0, off: 0, n: m.i.length }];
    gl.bindVertexArray(null);
  }
  function makeFBO(w, h) {
    if (FB && FB.w === w && FB.h === h) return;
    if (FB) { gl.deleteFramebuffer(FB.fb); gl.deleteFramebuffer(FB.fb2); gl.deleteTexture(FB.t0); gl.deleteTexture(FB.t1); gl.deleteTexture(FB.tD); gl.deleteRenderbuffer(FB.db); }
    const tex = (ifmt, fmt, type) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const t0 = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE), t1 = tex(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    const db = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, db); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t0, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, t1, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, db);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) console.error('[hoard] framebuffer incomplete', st);
    const tD = tex(gl.R32F, gl.RED, gl.FLOAT);
    const fb2 = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tD, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, db);
    const st2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st2 !== gl.FRAMEBUFFER_COMPLETE) console.error('[hoard] framebuffer 2 incomplete', st2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    FB = { fb, t0, t1, db, w, h, fb2, tD };
  }

  /* ================================================================== a frame */
  let F = null, CTX2 = null, CV = null, MOTES = null, IDM = null;
  const MDYN = { v: null, i: null };
  function setCommon(p) {
    const L = F.L;
    um4(p, 'uVP', F.VP); u3(p, 'uCam', F.cam.p); u1(p, 'uT', F.t); u1(p, 'uPx', F.px); u1(p, 'uSeed', (SEED % 997) * 0.37);
    u1(p, 'uLP', 3.5 * F.px); u1(p, 'uExpo', L.expo); u2(p, 'uRes', [F.pw, F.ph]);
    u3(p, 'uSunDir', SUNDIR); u3(p, 'uSunC', L.sunC); u1(p, 'uWinY', WINY);
    const lw = U(p, 'uWin'); if (lw) gl.uniform4fv(lw, F.win);
    u3(p, 'uCR', F.R); u3(p, 'uCU', F.Uv); u3(p, 'uCF', F.Fv); u1(p, 'uTanF', F.tanF); u1(p, 'uAsp', F.asp);
    u4(p, 'uGlow', L.glow); u3(p, 'uGlowC', L.glowC);
    const lf = U(p, 'uFire'); if (lf) gl.uniform4fv(lf, new Float32Array([].concat(...L.fire)));
    u3(p, 'uFireC', L.fireC); u4(p, 'uLamp', L.lamp); u3(p, 'uLampC', L.lampC); u3(p, 'uAmbC', L.amb);
    u4(p, 'uFocus', [F.cam.focus, F.cam.ap, 7 * F.px, 0]); u1(p, 'uHeat', L.heat);
    u1(p, 'uPxA', 2 * F.tanF / F.ph);
    const lnw = U(p, 'uNW'); if (lnw) gl.uniform1i(lnw, F.nw);
    const lwk = U(p, 'uWinK'); if (lwk) gl.uniform1fv(lwk, F.wink);
    u1(p, 'uShaftK', L.shaftK); u1(p, 'uVoid', L.voidT); u1(p, 'uFogD', L.fogD || 80); u1(p, 'uEnvK', L.envK === undefined ? 1 : L.envK);
    const lnft = U(p, 'uNFoot'); if (lnft) gl.uniform1i(lnft, F.nfoot || 0);
    const lft = U(p, 'uFoot'); if (lft && F.foot) gl.uniform4fv(lft, F.foot);
    u4(p, 'uFlow', F.flow || [0, 0, 0, 1]);
    if (F.mu) for (const k in F.mu) { const v = F.mu[k]; if (v.length === 4) u4(p, k, v); else if (v.length === 3) u3(p, k, v); else { const l = U(p, k); if (l) gl.uniform4fv(l, v); } }
  }
  function gatherCoins(t) {
    const out = CBUF, cp = F.cam.p, f = F.Fv;
    let k = 0;
    const dmax = t < 4.2 ? 7 : t < 14.5 ? 26 : 40, d2 = dmax * dmax, cosLim = Math.cos(Math.min(1.4, (F.cam.fov * PI / 180) * 0.85 + 0.1));
    for (let i = 0; i < NSTAT; i++) {
      const o = i * CF, dx = STAT[o] - cp[0], dy = STAT[o + 1] - cp[1], dz = STAT[o + 2] - cp[2], dd = dx * dx + dy * dy + dz * dz;
      if (dd > d2) continue;
      const dl = Math.sqrt(dd) + 1e-6;
      if ((dx * f[0] + dy * f[1] + dz * f[2]) / dl < cosLim && dl > 0.3) continue;
      out.set(STAT.subarray(o, o + CF), k * CF); k++;
    }
    if (t < 16) {
      const tmp = new Float32Array(CF);
      for (let i = 0; i < NAVAL; i++) {
        const c = AVAL[i];
        const dx = c.c[0] - cp[0], dz = c.c[2] - cp[2];
        if (dx * dx + dz * dz > d2 * 1.5) continue;
        avalancheCoin(c, t, out, k); k++;
      }
    }
    if (t < 4.6) { const h = hookCoin(t); coinPush(out, k, h.c, h.R, h.ax, 3.3, 0, h.roll); out[k * CF + 8] = 0.085; k++; }
    if (t > 21.5 && t < 28.2) { const h = ringCoin(t); coinPush(out, k, h.c, h.R, h.ax, 7.7, 0, h.roll); out[k * CF + 8] = 0.085; k++; }
    if (EXTRA_COINS) k = EXTRA_COINS(t, out, k);
    return k;
  }
  let EXTRA_COINS = null;
  function buildMotes(rng) {
    const m = [];
    for (let s = 1; s < SHAFTS.length; s++) {
      const S = SHAFTS[s];
      for (let k = 0; k < 420; k++) {
        const u = Math.pow(rng(), 1.4) * 22;
        const base = madd([S[0] + (rng() - 0.5) * 2 * S[3] * 1.2, S[1], S[2] + (rng() - 0.5) * 2 * S[4] * 1.2], SUNDIR, u);
        m.push({ p: base, ph: rng() * TAU, a: 0.3 + rng() * 0.5, sz: 0.008 + rng() * 0.022, gold: rng() < 0.4 ? 1 : 0, sp: 0.02 + rng() * 0.05 });
      }
    }
    // near the hook's thread of light
    const S = SHAFTS[0];
    for (let k = 0; k < 220; k++) {
      const u = rng() * 1.2;
      m.push({ p: madd([S[0] + (rng() - 0.5) * 0.1, S[1] + 0.005, S[2] + (rng() - 0.5) * 1.2], SUNDIR, u), ph: rng() * TAU, a: 0.3 + rng() * 0.5, sz: 0.0006 + rng() * 0.001, gold: rng() < 0.5 ? 1 : 0, sp: 0.003 });
    }
    MOTES = m;
    SPRBUF = new Float32Array((m.length + 2400) * 12);
  }
  function gatherSprites(t) {
    const o = SPRBUF; let k = 0;
    const cp = F.cam.p;
    for (const m of MOTES) {
      const p = [m.p[0] + Math.sin(t * 0.3 + m.ph) * m.sp * 8, m.p[1] + Math.sin(t * 0.21 + m.ph * 2) * m.sp * 5 - ((t * m.sp * 0.4) % 1), m.p[2] + Math.cos(t * 0.25 + m.ph) * m.sp * 8];
      const dx = p[0] - cp[0], dy = p[1] - cp[1], dz = p[2] - cp[2];
      if (dx * dx + dy * dy + dz * dz > 900) continue;
      const b = k * 12; o[b] = p[0]; o[b + 1] = p[1]; o[b + 2] = p[2]; o[b + 3] = m.sz;
      o[b + 4] = 0; o[b + 5] = m.ph; o[b + 6] = m.a; o[b + 7] = m.gold; o[b + 8] = 0; o[b + 9] = 0; o[b + 10] = 0; o[b + 11] = 0; k++;
    }
    if (EXTRA_SPR) k = EXTRA_SPR(t, o, k);
    return k;
  }
  let SPRTMP = null, EXTRA_SPR = null, DRAGON_MESH = null, DRAGON_FRAME = null, FX_DRAW = null, OVERLAY = null;
  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  let PRF = null; const PXB = new Uint8Array(4);
  const pmark = (k) => { if (PRF) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PXB); const n = performance.now(); PRF[k] = (PRF[k] || 0) + n - PRF._t; PRF._t = n; } };
  function drawFrame(t) {
    t = clamp(t, 0, DUR);
    if (PRF) PRF._t = performance.now();
    DRAG = POSES ? dragonBuild(t) : null;
    const cam = camAt(t), L = lightsAt(t);
    const pw = GLC.width, ph = GLC.height, asp = pw / ph, fov = cam.fov * PI / 180;
    const near = t < 4.2 ? 0.005 : cam.near || 0.06;
    const Pm = perspective(fov, asp, near, 700);
    const f = norm(sub(cam.q, cam.p)); let r = norm(cross(f, [0, 1, 0])); let up = cross(r, f);
    up = rotAxis(up, f, cam.roll || 0); r = norm(cross(f, up));
    const VP = mmul(Pm, lookAt(cam.p, cam.q, up));
    F0W = L.shaftW || null;
    const sw = shaftWindows(SUNDIR, cam.p);
    F = { t, VP, cam, R: r, Uv: up, Fv: f, tanF: Math.tan(fov / 2), asp, L, pw, ph, px: ph / H, win: sw.win, wink: sw.wk, nw: sw.n };
    let fire = false;
    F.plate = sstep(54.6, 56.4, t);
    F.flow = t > 2.4 && t < 7 ? [0.15, 33.4, 2.6 * sstep(2.4, 4.6, t), 3.6] : [0, 0, 0, 1];
    if (DRAG) { dragonUpload(t); fireLights(t); }
    fire = (F.L.fireC[0] + F.L.fireC[1] + F.L.fireC[2]) > 0;
    if (STEPS) { const fp = footprintsAt(t); F.foot = fp.foot; F.nfoot = fp.n; }
    F.extraMeshes = CUP_MESH && t > 13 && t < 28.2 ? [{ mesh: CUP_MESH, M: cupMatrix(t) }] : null;
    makeFBO(pw, ph);
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.fb); gl.viewport(0, 0, pw, ph);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
    gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    // surfaces
    pmark('setup');
    if (DRAGON_MESH && DRAGON_MESH.n) drawGroups(DRAGON_MESH, fire);
    pmark('dragon');
    drawGroups(MESH_S, fire);
    if (DBGN === 14) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST); gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); drawGroups(MESH_S, fire); const px = new Uint8Array(F.pw * F.ph * 4); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, F.pw, F.ph, gl.RGBA, gl.UNSIGNED_BYTE, px); let sm = 0; for (let i = 0; i < px.length; i += 4) sm += px[i]; console.log('[hoard] overdraw', (sm / (F.pw * F.ph) / 4).toFixed(2)); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); }
    if (DBGN === 13) { gl.depthFunc(gl.LESS); drawGroups(MESH_S, fire); gl.depthFunc(gl.LEQUAL); }
    if (F.extraMeshes) for (const em of F.extraMeshes) { F.modelM = em.M; drawGroups(em.mesh, fire); F.modelM = null; }
    pmark('static');
    // coins
    const nc = gatherCoins(t);
    if (nc) {
      const pc = coinProg(fire); gl.useProgram(pc); setCommon(pc);
      gl.bindVertexArray(VCOIN.vao); gl.bindBuffer(gl.ARRAY_BUFFER, VCOIN.ib); gl.bufferData(gl.ARRAY_BUFFER, CBUF.subarray(0, nc * CF), gl.DYNAMIC_DRAW);
      // a depth pre-pass, so that each visible coin pixel is engraved once
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null); gl.uniform1i(U(pc, 'uCoinD'), 2);
      gl.bindFramebuffer(gl.FRAMEBUFFER, FB.fb2); gl.drawBuffers([gl.COLOR_ATTACHMENT0]); gl.clearBufferfv(gl.COLOR, 0, [1e9, 0, 0, 0]);
      gl.uniform1i(U(pc, 'uPass'), 0);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, nc);
      gl.bindFramebuffer(gl.FRAMEBUFFER, FB.fb); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, FB.tD); gl.uniform1i(U(pc, 'uCoinD'), 2); gl.uniform1i(U(pc, 'uPass'), 1);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, nc);
      gl.disable(gl.CULL_FACE);
    }
    // the dark of the vault, wherever nothing was drawn
    gl.useProgram(PR.vd); setCommon(PR.vd); gl.bindVertexArray(VFULL); gl.drawArrays(gl.TRIANGLES, 0, 3);
    pmark('coins');
    // the air: dust, embers, smoke, fire
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    if (FX_DRAW) FX_DRAW(t, 0);
    const ns = gatherSprites(t);
    if (ns) {
      // sort by kind so that each kind is drawn by its own small shader
      const cnt = [0, 0, 0], tmp = SPRTMP || (SPRTMP = new Float32Array(SPRBUF.length));
      for (let i = 0; i < ns; i++) cnt[SPRBUF[i * 12 + 4] | 0]++;
      const off = [0, cnt[0], cnt[0] + cnt[1]], pos = off.slice();
      for (let i = 0; i < ns; i++) { const kd = SPRBUF[i * 12 + 4] | 0; tmp.set(SPRBUF.subarray(i * 12, i * 12 + 12), pos[kd]++ * 12); }
      gl.bindVertexArray(VSPR.vao); gl.bindBuffer(gl.ARRAY_BUFFER, VSPR.ib); gl.bufferData(gl.ARRAY_BUFFER, tmp.subarray(0, ns * 12), gl.DYNAMIC_DRAW);
      for (let kd = 0; kd < 3; kd++) {
        if (!cnt[kd]) continue;
        const ps = PR.spr[kd]; gl.useProgram(ps); setCommon(ps);
        for (let a = 1; a <= 3; a++) gl.vertexAttribPointer(a, 4, gl.FLOAT, false, 48, off[kd] * 48 + (a - 1) * 16);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cnt[kd]);
      }
      for (let a = 1; a <= 3; a++) gl.vertexAttribPointer(a, 4, gl.FLOAT, false, 48, (a - 1) * 16);
    }
    if (FX_DRAW) FX_DRAW(t, 1);
    gl.disable(gl.BLEND); gl.depthMask(true);
    pmark('fx');
    // the plate
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, pw, ph); gl.disable(gl.DEPTH_TEST);
    const pp = postProg(cam.ap > 12, (F.plate || 0) > 0); gl.useProgram(pp); setCommon(pp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, FB.t0); gl.uniform1i(U(pp, 'uC0'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, FB.t1); gl.uniform1i(U(pp, 'uC1'), 1);
    u3(pp, 'uCR', r); u3(pp, 'uCU', up); u3(pp, 'uCF', f); u1(pp, 'uTanF', F.tanF); u1(pp, 'uAsp', asp);
    u1(pp, 'uShaftK', L.shaftK); u1(pp, 'uVoid', L.voidT);
    // the beam's direction on screen
    const c0 = projS(VP, cam.q), c1 = projS(VP, add(cam.q, mul(SUNDIR, 3)));
    u2(pp, 'uSunScr', [c1[0] - c0[0] || 0.001, c1[1] - c0[1] || 0.001]);
    u4(pp, 'uPlate', [F.plate || 0, 0, 0, 0]);
    gl.bindVertexArray(VFULL); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    pmark('post');
    // onto the visible sheet
    CTX2.setTransform(1, 0, 0, 1, 0, 0); CTX2.globalAlpha = 1; CTX2.globalCompositeOperation = 'source-over';
    CTX2.drawImage(GLC, 0, 0, CV.width, CV.height);
    if (OVERLAY) OVERLAY(CTX2, t, CV.width, CV.height);
    if (PRF) { CTX2.getImageData(0, 0, 1, 1); pmark('blit'); }
  }
  function projS(VP, p) { const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15]; return [x / w, y / w]; }

  /* ================================================================== the dragon */
  // A spline spine (resampled by arc length), posed by keyframes and eased; a tube of armour plates
  // around it; a lofted head with a hinged jaw, a crown of horns, IK legs, and fan wings with membranes.
  const NS = 150;                      // spine samples
  const U_SH = 0.2, U_HIP = 0.385;     // shoulders and hips, as fractions of the length
  const RAD = [[0, 1.2], [0.05, 1.4], [0.12, 1.8], [0.18, 2.35], [0.23, 2.85], [0.28, 2.75], [0.34, 2.35], [0.41, 2.0], [0.52, 1.35], [0.66, 0.85], [0.82, 0.42], [0.94, 0.17], [1, 0.05]];
  function radiusAt(u) {
    for (let i = 1; i < RAD.length; i++) if (u <= RAD[i][0]) { const a = RAD[i - 1], b = RAD[i], f = (u - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], EZ.s(f)); }
    return RAD[RAD.length - 1][1];
  }
  // resample a Catmull-Rom curve through pts to NS+1 points equally spaced in arc length
  function resample(pts) {
    const dense = [], n = 600;
    for (let i = 0; i <= n; i++) dense.push(crPath(pts, i / n));
    const acc = [0];
    for (let i = 1; i <= n; i++) acc.push(acc[i - 1] + len(sub(dense[i], dense[i - 1])));
    const L = acc[n], out = [];
    let j = 0;
    for (let k = 0; k <= NS; k++) {
      const sk = (k / NS) * L;
      while (j < n - 1 && acc[j + 1] < sk) j++;
      const f = (sk - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]);
      out.push(lerp3(dense[j], dense[j + 1], clamp(f, 0, 1)));
    }
    return { pts: out, L };
  }
  const M0 = MOUND[0], M1 = MOUND[1];
  const G = (x, z, h) => [M0 + x, heapH(M0 + x, M1 + z) + (h || 0), M1 + z];
  const A = (x, y, z) => [M0 + x, heapH(M0 + x, M1 + z) + y, M1 + z];
  let POSES = null;
  function groundPose(pts) {
    // lay a resampled curve on the gold: each point rests at its own radius above the heap
    const r = resample(pts);
    r.pts = r.pts.map((p, k) => { const u = k / NS; return [p[0], Math.max(p[1], heapH(p[0], p[2]) + radiusAt(u) * 0.78), p[2]]; });
    return r;
  }
  function makePoses() {
    const tailSleep = [G(8.6, -0.4), G(9.8, 4.4), G(8.6, 9.2), G(5.4, 12.8), G(1.0, 15.0), G(-3.8, 15.2), G(-7.6, 13.4), G(-9.8, 10.2), G(-10.4, 7.2)];
    const body = [G(-7.2, 1.4), G(-6.8, -3.0), G(-4.3, -6.6), G(-0.4, -8.2), G(3.7, -7.2), G(6.7, -4.3)];
    const sleep = groundPose([G(-0.2, 10.4, 0.3), G(-2.9, 8.9, 0.6), G(-5.6, 6.0, 0.9)].concat(body, tailSleep));
    const lift = groundPose([A(-3.4, 7.6, 10.6), A(-4.8, 9.0, 8.2), A(-6.0, 8.2, 5.8), A(-6.8, 5.6, 3.8), A(-7.2, 3.4, 2.2)].concat(body, tailSleep));
    // risen: the body stays long and low behind the planted forelegs; only the neck rears, in a thick S
    const bodyUp = [A(-4.8, 3.3, 1.2), A(-4.6, 2.9, -3.0), A(-3.0, 2.3, -6.6), A(-0.4, 1.8, -8.4), G(3.7, -7.2), G(6.7, -4.3)];
    const tailSweep = [G(9.6, -1.6), G(13.0, 1.6), G(15.6, 5.6), G(17.0, 10.0), G(17.4, 14.6), G(16.6, 19.0), G(15.0, 22.6), G(12.8, 25.6), G(10.6, 27.6)];
    const rise = groundPose([A(-2.0, 9.4, 14.8), A(-2.5, 10.6, 12.4), A(-3.4, 11.8, 9.2), A(-4.4, 10.0, 6.0), A(-4.9, 6.2, 3.4)].concat(bodyUp, tailSleep));
    const rise2 = groundPose([A(-1.5, 9.0, 15.4), A(-2.2, 10.4, 13.0), A(-3.3, 11.8, 9.6), A(-4.4, 10.0, 6.0), A(-4.9, 6.2, 3.4)].concat(bodyUp, tailSweep));
    const fire = groundPose([A(-1.0, 7.2, 17.6), A(-1.7, 8.8, 14.6), A(-2.9, 10.8, 10.6), A(-4.2, 9.8, 6.4), A(-4.9, 6.2, 3.4)].concat(bodyUp, tailSweep));
    POSES = { sleep, lift, rise, rise2, fire };
    // the dorsal direction: rolled toward the coil's centre while he sleeps, so his pale belly shows
    const cen = [M0 + 1, 0, M1 + 3];
    for (const k in POSES) {
      const P = POSES[k]; P.up = [];
      for (let i = 0; i <= NS; i++) {
        const u = i / NS, p = P.pts[i];
        const out = norm([p[0] - cen[0], 0, p[2] - cen[2]]);
        const roll = (k === 'sleep' || k === 'lift') ? 0.75 * sstep(0.12, 0.3, u) * (1 - 0.35 * sstep(0.5, 1, u)) : (k === 'rise' ? 0.3 : 0.1) * sstep(0.3, 0.5, u);
        P.up.push(norm(add(mul([0, 1, 0], Math.cos(roll)), mul(out, -Math.sin(roll)))));
      }
    }
  }
  // the pose at time t: keyframes eased between, plus breath and a little life
  const POSE_KEYS = [[0, 'sleep'], [31.6, 'sleep'], [35.2, 'lift'], [38.6, 'rise'], [41.8, 'rise2'], [45.0, 'fire'], [60, 'fire']];
  function spineAt(t) {
    let i = 0; while (i < POSE_KEYS.length - 2 && t > POSE_KEYS[i + 1][0]) i++;
    const a = POSE_KEYS[i], b = POSE_KEYS[i + 1], f = EZ.io2(clamp((t - a[0]) / (b[0] - a[0]), 0, 1));
    const A1 = POSES[a[1]], B1 = POSES[b[1]];
    const pts = [], up = [];
    // the neck leads and the tail follows: a travelling delay along the body
    for (let k = 0; k <= NS; k++) {
      const u = k / NS;
      const fl = clamp(f * 1.25 - u * 0.25 * (1 - f) * 0, 0, 1);
      const ff = EZ.s(clamp((f - (u > U_HIP ? (u - U_HIP) * 0.25 : 0)) / (1 - (u > U_HIP ? (u - U_HIP) * 0.25 : 0)), 0, 1));
      const w = u < 0.25 ? fl : ff;
      pts.push(lerp3(A1.pts[k], B1.pts[k], w));
      up.push(norm(lerp3(A1.up[k], B1.up[k], w)));
    }
    // life: the sleeping tail-tip twitches; awake, a slow serpentine sway runs down the neck and tail
    const awake = sstep(30, 34, t);
    for (let k = 0; k <= NS; k++) {
      const u = k / NS;
      const tw = (1 - awake) * sstep(0.85, 1, u) * 0.25 * Math.sin(t * 1.3 + u * 9);
      const sw = awake * (Math.sin(t * 1.1 - u * 7) * 0.5 * (sstep(0.5, 1, u) + 0.6 * (1 - sstep(0, 0.18, u))) );
      pts[k][0] += tw + sw * 0.8; pts[k][2] += tw * 0.6 + sw * 0.4;
      pts[k][1] += awake * Math.sin(t * 0.9 - u * 5) * 0.25 * (1 - sstep(0, 0.2, u)) * (1 - sstep(44, 46, t));
    }
    return { pts, up };
  }
  // the dragon's state at time t (pose, jaw, wings, eye, breath, inner fire)
  function dragonState(t) {
    const breath = Math.sin((t / 4.4) * TAU), awake = sstep(30, 34, t);
    return {
      t, breath: breath * (1 - awake) + Math.sin(t * 2.4) * awake * 0.6,
      jaw: track([[0, 0.02], [35, 0.02], [37, 0.2], [39, 0.12], [42.5, 0.24], [44.4, 0.16], [45.4, 0.62], [50.4, 0.66], [52, 0.22], [55, 0.05]], t),
      wing: track([[0, 0], [36.2, 0], [40.6, 1, 'io2'], [60, 1]], t),
      wingLift: track([[0, 0], [37.5, 0], [40.6, 1], [43, 0.6], [45, 0.85], [60, 0.8]], t) + Math.sin(t * 1.6) * 0.08 * sstep(40, 42, t),
      headPitch: track([[0, -0.05], [31, -0.05], [35, 0.12], [38.6, 0.22], [42, 0.18], [45, 0.1], [52, 0.1], [60, 0.1]], t),
      fireIn: track([[0, 0.08], [30, 0.08], [33, 0.22], [40, 0.45], [44.0, 0.6], [45.4, 1], [50.5, 1], [53, 0.35], [60, 0.2]], t),
      sweep: track([[0, 0], [39.5, 0], [42.5, 1], [44.5, 0.75], [60, 0.75]], t),
    };
  }
  const DMB = {};
  function dmb(k) { const m = DMB[k] || (DMB[k] = MB()); return m; }
  function dragonBuild(t) {
    for (const k in DMB) { DMB[k].v.length = 0; DMB[k].i.length = 0; DMB[k].n = 0; }
    const S = dragonState(t), sp = spineAt(t), C = sp.pts;
    // frames along the spine
    const T = [], D = [], Sd = [];
    for (let k = 0; k <= NS; k++) {
      const a = C[Math.max(0, k - 1)], b = C[Math.min(NS, k + 1)];
      const tt = norm(sub(b, a)); let d = sp.up[k]; d = norm(sub(d, mul(tt, dot(d, tt))));
      T.push(tt); D.push(d); Sd.push(cross(tt, d));
    }
    const rib = (u) => 1 + 0.045 * S.breath * Math.exp(-Math.pow((u - 0.29) / 0.07, 2));
    const RR = []; for (let k = 0; k <= NS; k++) RR.push(radiusAt(k / NS) * rib(k / NS));
    const out = { S, C, T, D, Sd, RR };
    // ---------------- the body: one long tube of plates
    {
      const m = dmb(4), NA = 40, base = m.n;
      let sig = 0;
      for (let k = 0; k <= NS; k++) {
        const u = k / NS, r = RR[k];
        if (k > 0) sig += len(sub(C[k], C[k - 1])) / Math.max(0.15, r) * (28 / TAU);
        for (let j = 0; j <= NA; j++) {
          const th = (j / NA) * TAU, c = Math.cos(th), s = Math.sin(th);
          const hy = r * (c < 0 ? 0.86 : 0.98), wx = r * 1.04;
          const o = add(mul(D[k], c * hy), mul(Sd[k], s * wx));
          const nn = norm(add(mul(D[k], c / hy), mul(Sd[k], s / wx)));
          vert(m, add(C[k], o), nn, sig, j / NA, 4, u);
        }
      }
      gridI(m, base, NA, NS);
    }
    // ---------------- dorsal spines: a crest of horn plates from crown to tail
    {
      const m = dmb(6);
      for (let k = 3; k < NS - 2; k += 3) {
        const u = k / NS, r = RR[k];
        const hgt = r * (0.32 + 0.28 * Math.exp(-Math.pow((u - 0.24) / 0.12, 2))) * (u > 0.9 ? 0.6 : 1);
        const p0 = madd(C[k], D[k], r * 0.9), back = mul(T[k], r * 0.55);
        const a = sub(p0, mul(back, 0.6)), b = add(p0, back), tip = madd(madd(p0, D[k], hgt), T[k], hgt * 0.7);
        const sw = mul(Sd[k], r * 0.06);
        const X = XF([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
        ftri(m, X, add(a, sw), add(b, sw), tip, 6, u); ftri(m, X, sub(b, sw), sub(a, sw), tip, 6, u);
      }
      // the tail ends in three blades
      const k = NS - 1, e = C[NS], tt = T[NS];
      for (let q = 0; q < 3; q++) {
        const ang = (q - 1) * 0.9, dir = norm(add(mul(tt, 1), add(mul(D[k], Math.cos(ang) * 0.6), mul(Sd[k], Math.sin(ang) * 0.6))));
        const tip = madd(e, dir, 1.4), side = mul(norm(cross(dir, D[k])), 0.2);
        const X = XF([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
        ftri(m, X, madd(e, side, 1), madd(e, side, -1), tip, 6, 1);
      }
    }
    headBuild(out, S);
    legsBuild(out, S, t);
    wingsBuild(out, S, t);
    return out;
  }
  // a surface from a grid of points; normals from the grid, uv and aux per vertex
  function gridSurf(m, P, nu, nv, mat, uvf, axf, flip) {
    const base = m.n;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const p = P[j][i];
      const pu = sub(P[j][Math.min(nu, i + 1)], P[j][Math.max(0, i - 1)]), pv = sub(P[Math.min(nv, j + 1)][i], P[Math.max(0, j - 1)][i]);
      let n = norm(cross(pu, pv)); if (flip) n = mul(n, -1);
      const uv = uvf(i / nu, j / nv);
      vert(m, p, n, uv[0], uv[1], mat, axf(i / nu, j / nv));
    }
    gridI(m, base, nu, nv);
  }
  function dtube(m, pts, rad, segs, mat, ax, cells) {
    const np = pts.length, P = [];
    let Nn = null; const rows = [];
    let sig = 0;
    for (let k = 0; k < np; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(np - 1, k + 1)], T2 = norm(sub(b, a));
      if (!Nn) Nn = norm(cross(T2, Math.abs(T2[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      Nn = norm(sub(Nn, mul(T2, dot(Nn, T2)))); const Bn = cross(T2, Nn);
      if (k > 0) sig += len(sub(pts[k], pts[k - 1])) / Math.max(0.03, rad[k]) * ((cells || 16) / TAU);
      const row = [];
      for (let j = 0; j <= segs; j++) { const th = (j / segs) * TAU; row.push(madd(madd(pts[k], Nn, Math.cos(th) * rad[k]), Bn, Math.sin(th) * rad[k])); }
      P.push(row); rows.push(sig);
    }
    gridSurf(m, P, segs, np - 1, mat, (u, v) => [rows[Math.round(v * (np - 1))], u * (cells || 16) / 28], () => ax, true);
  }
  function spline(pts, n) { const o = []; for (let i = 0; i <= n; i++) o.push(crPath(pts, i / n)); return o; }
  function taper(n, r0, r1, pw) { const o = []; for (let i = 0; i <= n; i++) o.push(lerp(r0, r1, Math.pow(i / n, pw || 1))); return o; }
  const prof = (pts, x) => { for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return lerp(a[1], b[1], EZ.s((x - a[0]) / (b[0] - a[0]))); } return pts[pts.length - 1][1]; };
  const HW = [[0, 0.74], [0.18, 0.8], [0.32, 0.74], [0.46, 0.58], [0.62, 0.45], [0.82, 0.35], [0.93, 0.32], [0.985, 0.2], [1, 0.03]];
  const HT = [[0, 0.74], [0.2, 0.76], [0.34, 0.66], [0.44, 0.66], [0.53, 0.5], [0.7, 0.38], [0.86, 0.31], [0.93, 0.34], [0.985, 0.2], [1, 0.03]];
  const HB = [[0, 0.7], [0.22, 0.52], [0.45, 0.34], [0.7, 0.26], [0.9, 0.18], [0.985, 0.1], [1, 0.02]];
  const HL = 4.5;
  function headBuild(o, S) {
    const T0 = o.T[0], D0 = o.D[0], S0 = o.Sd[0];
    let X = rotAxis(mul(T0, -1), S0, -S.headPitch);
    const aimW = sstep(43.5, 45.2, S.t) * (1 - sstep(51.5, 54, S.t));
    if (aimW > 0) { const aim = norm(sub([-4.0, 7.0, -38], o.C[0])); X = norm(lerp3(X, aim, aimW * 0.85)); }
    const Y = norm(sub(D0, mul(X, dot(D0, X)))), Z = cross(X, Y);
    const org = madd(o.C[0], X, -0.45);
    const HS = 1.4, W2 = (l) => add(org, add(mul(X, l[0] * HS), add(mul(Y, l[1] * HS), mul(Z, l[2] * HS))));
    const hinge = 0.2 * HL, jaw = S.jaw;
    const jawRot = (l, x) => {
      const a = -jaw * sstep(0.08, 0.3, x), dx = l[0] - hinge, dy = l[1] + 0.05;
      return [hinge + dx * Math.cos(a) - dy * Math.sin(a), -0.05 + dx * Math.sin(a) + dy * Math.cos(a), l[2]];
    };
    const n = 2.5, pw = 2 / n;
    const bump = (v, c, w) => Math.exp(-((v - c) * (v - c)) / (w * w));
    const sec = (x, th, upper) => {
      const c = Math.cos(th), sn = Math.sin(th);
      const W = prof(HW, x), Ht = prof(HT, x), Hb = prof(HB, x);
      let z = W * Math.sign(c) * Math.pow(Math.abs(c), pw), y = upper ? Ht * Math.pow(Math.abs(sn), pw) : -Hb * Math.pow(Math.abs(sn), pw);
      if (upper) {
        // brow ridges over the eyes, nostril bosses, a groove between the eyes
        const brow = 0.27 * bump(x, 0.41, 0.085) * (bump(th, PI / 2 - 0.78, 0.32) + bump(th, PI / 2 + 0.78, 0.32)) + 0.06 * bump(x, 0.3, 0.12) * (bump(th, 0.7, 0.4) + bump(th, PI - 0.7, 0.4));
        const nos = 0.12 * bump(x, 0.92, 0.04) * (bump(th, PI / 2 - 0.5, 0.22) + bump(th, PI / 2 + 0.5, 0.22)) + 0.04 * bump(th, PI / 2, 0.15) * sstep(0.55, 0.8, x) * (1 - sstep(0.88, 0.95, x));
        const groove = -0.05 * bump(th, PI / 2, 0.22) * sstep(0.3, 0.5, x) * (1 - sstep(0.8, 0.95, x));
        const crest = 0.08 * bump(th, PI / 2, 0.18) * (1 - sstep(0.15, 0.35, x));
        const k = brow + nos + groove + crest; y += k * Math.abs(sn) + k * 0.2; z += k * c * 0.6;
      } else {
        const chin = 0.05 * bump(x, 0.8, 0.12) * bump(th, 1.5 * PI, 0.4);
        // the jaw: a hard ridge along each side, and the hinge muscle swelling behind it
        const ridge = 0.07 * (bump(th, PI + 0.35, 0.18) + bump(th, 2 * PI - 0.35, 0.18)) * sstep(0.1, 0.3, x) * (1 - sstep(0.85, 1, x));
        const mass = 0.12 * bump(x, 0.12, 0.12);
        y -= chin + ridge * 0.4 + mass * 0.5; z += Math.sign(c) * (ridge + mass);
      }
      return [x * HL, y, z];
    };
    const NX = 44, NT = 28;
    // upper skull and snout
    let P = [];
    for (let j = 0; j <= NT; j++) { const th = (j / NT) * PI, row = []; for (let i = 0; i <= NX; i++) row.push(W2(sec(i / NX, th, true))); P.push(row); }
    gridSurf(dmb(4), P, NX, NT, 4, (u, v) => [u * HL * 100 / (TAU * 0.62), v * 1.8], () => -2, false);
    // lower jaw
    P = [];
    for (let j = 0; j <= NT; j++) { const th = PI + (j / NT) * PI, row = []; for (let i = 0; i <= NX; i++) { const x = i / NX; row.push(W2(jawRot(sec(x, th, false), x))); } P.push(row); }
    gridSurf(dmb(4), P, NX, NT, 4, (u, v) => [u * HL * 100 / (TAU * 0.5), 1.8 + v * 1.8], () => -2, false);
    // the mouth: palate and floor, dark and lit from within
    const MX = 16, x0 = 0.16;
    P = []; let Q = [];
    for (let j = 0; j <= 4; j++) {
      const row = [], rowq = [];
      for (let i = 0; i <= MX; i++) {
        const x = lerp(x0, 1, i / MX), w = prof(HW, x) * 0.96, z = lerp(-w, w, j / 4);
        row.push(W2([x * HL, 0.0, z])); rowq.push(W2(jawRot([x * HL, -0.02 - 0.05 * Math.sin((j / 4) * PI), z], x)));
      }
      P.push(row); Q.push(rowq);
    }
    gridSurf(dmb(9), P, MX, 4, 9, (u, v) => [u, v], () => 0, false);
    gridSurf(dmb(9), Q, MX, 4, 9, (u, v) => [u, v], () => 1, true);
    // teeth
    const mt = dmb(6);
    for (let side = -1; side <= 1; side += 2) for (let q = 0; q < 15; q++) {
      const x = 0.34 + q * 0.045, w = prof(HW, x) - 0.05;
      const big = Math.exp(-Math.pow((x - 0.86) / 0.04, 2)) * 0.18 + Math.exp(-Math.pow((x - 0.6) / 0.03, 2)) * 0.06;
      const L = 0.2 + big * 1.4 + 0.04 * hr(q, side + 7), r0 = 0.05 + big * 0.14;
      const up0 = W2([x * HL, 0.02, side * w]), tipU = W2([x * HL - 0.03, -L, side * (w - 0.02)]);
      dtube(mt, [up0, lerp3(up0, tipU, 0.5), tipU], [r0, r0 * 0.6, 0.006], 5, 6, -1, 6);
      const lo0 = W2(jawRot([x * HL, -0.03, side * (w - 0.03)], x)), tipL = W2(jawRot([x * HL + 0.02, -0.03 + L * 0.8, side * (w - 0.05)], x));
      dtube(mt, [lo0, lerp3(lo0, tipL, 0.5), tipL], [r0 * 0.9, r0 * 0.55, 0.006], 5, 6, -1, 6);
    }
    // the crown of horns: two great horns swept back and up, a ring of lesser horns, cheek spikes
    const mh = dmb(6);
    for (let side = -1; side <= 1; side += 2) {
      const r = (l) => W2([l[0], l[1], l[2] * side]);
      dtube(mh, spline([r([0.5, 0.55, 0.42]), r([-0.5, 1.0, 0.85]), r([-1.7, 1.45, 1.25]), r([-2.8, 2.25, 1.3]), r([-3.3, 3.2, 1.0])], 14), taper(14, 0.27, 0.015, 0.9), 9, 6, -1, 9);
      for (let q = 0; q < 3; q++) {
        const ph = 0.35 + q * 0.32, y0 = 0.7 * Math.cos(ph), z0 = 0.7 * Math.sin(ph);
        const Lh = 1.25 - q * 0.22;
        dtube(mh, spline([r([0.18, y0, z0]), r([-0.4 * Lh, y0 + 0.5 * Lh * Math.cos(ph), z0 + 0.5 * Lh * Math.sin(ph)]), r([-0.95 * Lh, y0 + 0.85 * Lh * Math.cos(ph) + 0.15, z0 + 0.75 * Lh * Math.sin(ph)])], 8), taper(8, 0.13, 0.01, 0.9), 7, 6, -1, 7);
      }
      for (let q = 0; q < 3; q++) {
        const x = 0.9 + q * 0.42, Lc = 0.85 - q * 0.15;
        dtube(mh, spline([r([x, -0.25, 0.68]), r([x - 0.35 * Lc, -0.45, 0.68 + 0.45 * Lc]), r([x - 0.8 * Lc, -0.62, 0.7 + 0.75 * Lc])], 6), taper(6, 0.09, 0.008), 6, 6, -1, 6);
      }
      dtube(mh, spline([r([1.85, 0.68, 0.42]), r([1.6, 1.0, 0.52]), r([1.2, 1.25, 0.58])], 5), taper(5, 0.085, 0.006), 6, 6, -1, 6);
    }
    dtube(mh, spline([W2([0.25, 0.8, 0]), W2([-0.3, 1.5, 0]), W2([-0.9, 1.95, 0])], 8), taper(8, 0.15, 0.01), 7, 6, -1, 7);
    dtube(mh, spline([W2([4.15, 0.36, 0]), W2([4.25, 0.56, 0]), W2([4.18, 0.74, 0])], 4), taper(4, 0.07, 0.005), 6, 6, -1, 6);
    // eyes, set under the brow
    o.eyes = [];
    for (let side = -1; side <= 1; side += 2) {
      const x = 0.435, w = prof(HW, x);
      const c = W2([x * HL, 0.3, side * (w * 0.62)]), rad = 0.24 * 1.4;
      const F = norm(add(add(mul(X, 0.32), mul(Y, 0.28)), mul(Z, side)));
      const Ue = norm(sub(Y, mul(F, dot(Y, F)))), Re = cross(Ue, F);
      const m = dmb(8), base = m.n, NU = 40, NV = 30;
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
        const th = (j / NV) * PI, ph = (i / NU) * TAU;
        const d = add(add(mul(F, Math.cos(th)), mul(Re, Math.sin(th) * Math.cos(ph))), mul(Ue, Math.sin(th) * Math.sin(ph)));
        vert(m, madd(c, d, rad), d, dot(d, Re) * side, dot(d, Ue), 8, dot(d, F));
      }
      gridI(m, base, NU, NV);
      o.eyes.push({ c, F, U: Ue, R: Re, rad, side });
    }
    o.head = { org, X, Y, Z, W2, jawRot };
    o.nostril = W2([4.05, 0.34, 0]); o.mouth = W2([4.3, -0.1, 0]); o.mouthDir = norm(add(X, mul(Y, -0.25 * 0)));
    // tilt the mouth direction with the open jaw
    o.mouthDir = norm(rotAxis(X, Z, -jaw * 0.3));
    if (S.t > 44 && S.t < 54) o.mouthDir = norm(lerp3(o.mouthDir, norm(sub([-4.5, 4.2, -36], o.mouth)), 0.85));
  }
  function ik2(root, tgt, a, b, pole) {
    let d = sub(tgt, root), L = len(d); const dir = mul(d, 1 / (L || 1));
    L = clamp(L, Math.abs(a - b) + 0.05, a + b - 0.05);
    const ca = (a * a + L * L - b * b) / (2 * a * L), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
    const perp = norm(sub(pole, mul(dir, dot(pole, dir))));
    const knee = add(root, add(mul(dir, a * ca), mul(perp, a * sa)));
    const foot = add(root, mul(dir, L));
    return { knee, foot };
  }
  function bodyPt(o, u) { const k = clamp(Math.round(u * NS), 0, NS); return { c: o.C[k], T: o.T[k], D: o.D[k], S: o.Sd[k], r: o.RR[k] }; }
  function legsBuild(o, S, t) {
    const m = dmb(4), mc = dmb(6);
    const stand = sstep(35.5, 39, t);
    for (const [u, front] of [[0.215, true], [0.372, false]]) for (let side = -1; side <= 1; side += 2) {
      const b = bodyPt(o, u);
      const root = add(b.c, add(mul(b.S, side * b.r * 0.7), mul(b.D, -b.r * 0.3)));
      const a = front ? 3.0 : 3.3, bb = front ? 2.9 : 3.1;
      const hf = norm([-b.T[0], 0, -b.T[2]]), hs = norm([b.S[0], 0, b.S[2]]);
      const fwd = front ? lerp(1.9, 1.2, stand) : lerp(0.8, 0.3, stand), out = front ? lerp(2.0, 1.4, stand) : lerp(2.3, 1.7, stand);
      let tg = add(add(root, mul(hf, fwd)), mul(hs, side * out));
      tg[1] = heapH(tg[0], tg[2]) + 0.5;
      const pole = norm(add(mul(b.T, front ? 1 : -1), add(mul(b.S, side * 0.4), [0, 0.2, 0])));
      const ik = ik2(root, tg, a, bb, pole);
      const pts = [root, lerp3(root, ik.knee, 0.5), ik.knee, lerp3(ik.knee, ik.foot, 0.5), ik.foot];
      const r0 = (front ? 1.15 : 1.35) * Math.min(1.1, b.r / 2.0);
      dtube(m, spline(pts, 12), [r0, r0 * 0.97, r0 * 0.88, r0 * 0.7, r0 * 0.56, r0 * 0.48, r0 * 0.5, r0 * 0.5, r0 * 0.42, r0 * 0.36, r0 * 0.32, r0 * 0.3, r0 * 0.3], 16, 4, -1, 18);
      // toes and claws, spread on the gold
      const ank = ik.foot;
      for (let q = 0; q < 4; q++) {
        const ang = (q - 1.5) * 0.34 + side * 0.15;
        const dir = norm(add(mul(hf, Math.cos(ang)), mul(hs, Math.sin(ang) * side)));
        const p1 = add(ank, mul(dir, 0.55)); p1[1] = Math.max(heapH(p1[0], p1[2]) + 0.22, ank[1] - 0.3);
        const p2 = add(ank, mul(dir, 1.15)); p2[1] = heapH(p2[0], p2[2]) + 0.14;
        dtube(m, spline([ank, p1, p2], 6), taper(6, 0.32, 0.15), 8, 4, -1, 8);
        const c1 = add(p2, mul(dir, 0.28)); c1[1] = p2[1] - 0.02; const c2 = add(p2, mul(dir, 0.5)); c2[1] = heapH(c2[0], c2[2]) - 0.05;
        dtube(mc, spline([p2, c1, c2], 5), taper(5, 0.15, 0.008), 6, 6, -1, 6);
      }
    }
  }
  function wingsBuild(o, S, t) {
    const b = bodyPt(o, 0.245), hip = bodyPt(o, 0.37);
    const f = S.wing, fa = EZ.io2(sstep(0, 0.65, f)), ff = EZ.io2(sstep(0.3, 1, f)), lift = S.wingLift;
    const flap = Math.sin(t * 2.2) * 0.12 * sstep(40, 42, t) * (1 - sstep(45, 47, t));
    const LF = [24, 28, 24, 19], OPEN = [0.22, 0.62, 1.02, 1.42];
    o.wings = [];
    for (let side = -1; side <= 1; side += 2) {
      const Th = norm([b.T[0], b.T[1] * 0.3, b.T[2]]);
      const D = norm(lerp3(b.D, [0, 1, 0], fa)), T = norm(sub(lerp3(b.T, Th, fa), mul(D, dot(lerp3(b.T, Th, fa), D)))), Sd = mul(cross(T, D), side * Math.sign(dot(cross(T, D), b.S) || 1));
      const root = add(b.c, add(mul(D, b.r * 0.62), mul(Sd, b.r * 0.5)));
      const humF = norm(add(add(mul(T, 0.8), mul(Sd, 0.5)), mul(D, 0.22))), humO = norm(add(add(mul(Sd, 0.6), mul(D, 0.45 + 0.55 * lift + flap)), mul(T, 0.2)));
      const hum = norm(lerp3(humF, humO, fa));
      const elbow = madd(root, hum, lerp(4.2, 7.0, fa));
      const foreF = norm(add(add(mul(T, -0.9), mul(D, 0.06)), mul(Sd, 0.3))), foreO = norm(add(add(mul(Sd, 0.9), mul(D, 0.15 + 0.4 * lift + flap * 2)), mul(T, 0.12)));
      const fore = norm(lerp3(foreF, foreO, fa));
      const wrist = madd(elbow, fore, lerp(4.6, 8.4, fa));
      const fingers = [];
      for (let q = 0; q < 4; q++) {
        const dF = norm(add(add(mul(T, 1), mul(D, -0.12 - 0.07 * q)), mul(Sd, 0.28 + 0.04 * q)));
        const a = lerp(OPEN[q] + 0.5, OPEN[q], lift), dO = norm(add(add(mul(Sd, Math.sin(a)), mul(T, 0.3 + 0.08 * q)), mul(D, Math.cos(a) + flap * 3)));
        const dir = norm(lerp3(dF, dO, ff));
        const L = LF[q] * lerp(0.42 - 0.03 * q, 1, ff);
        const mid = add(madd(wrist, dir, L * 0.5), mul(T, 0.35 + 0.2 * q)), tip = add(madd(wrist, dir, L), mul(T, 0.9 + 0.3 * q));
        fingers.push(spline([wrist, mid, tip], 10));
      }
      // bones under the skin
      const m = dmb(4);
      dtube(m, spline([root, lerp3(root, elbow, 0.5), elbow], 6), taper(6, 0.85, 0.5), 10, 4, -1, 10);
      dtube(m, spline([elbow, lerp3(elbow, wrist, 0.5), wrist], 6), taper(6, 0.5, 0.36), 10, 4, -1, 10);
      for (const fg of fingers) dtube(m, fg, taper(fg.length - 1, 0.32, 0.05), 6, 4, -1, 6);
      // the claws of the leading edge: a great thumb-hook at the wrist, a spur at the elbow
      const tdir = norm(add(fore, mul(D, 0.6))), tc1 = madd(wrist, tdir, 1.1), tc2 = madd(madd(tc1, tdir, 0.7), mul(T, -1), 0.6);
      dtube(dmb(6), spline([wrist, tc1, tc2], 6), taper(6, 0.34, 0.01), 7, 6, -1, 7);
      const ed = norm(add(mul(hum, -0.3), mul(D, 0.8))), e1 = madd(elbow, ed, 1.0);
      dtube(dmb(6), spline([elbow, e1, madd(e1, mul(T, -1), 0.5)], 5), taper(5, 0.28, 0.01), 7, 6, -1, 7);
      // membranes: panels strung between the fingers, the last one back to the flank, each edge scalloped
      const flank = add(hip.c, add(mul(hip.D, hip.r * 0.35), mul(mul(hip.S, side), hip.r * 0.75)));
      const bodyLine = spline([wrist, lerp3(wrist, flank, 0.5), flank], 10);
      const spokes = fingers.concat([bodyLine]);
      const mm = dmb(5), NU = 10, NV = 8;
      for (let q = 0; q < 4; q++) {
        const A1 = spokes[q], B1 = spokes[q + 1], P = [];
        const nA = A1.length - 1, nB = B1.length - 1;
        const pn = norm(cross(sub(A1[nA], wrist), sub(B1[nB], wrist)));
        for (let j = 0; j <= NV; j++) {
          const v = j / NV, row = [];
          for (let i = 0; i <= NU; i++) {
            const u = i / NU;
            const pa = A1[Math.round(u * nA)], pb = B1[Math.round(u * nB)];
            let p = lerp3(pa, pb, v);
            const sc = 0.24 * Math.sin(PI * v) * Math.pow(u, 3);
            p = lerp3(p, wrist, sc);
            p = madd(p, pn, -side * Math.sin(PI * v) * Math.sin(PI * u) * 1.3 * f * (q === 3 ? 1.4 : 1));
            row.push(p);
          }
          P.push(row);
        }
        gridSurf(mm, P, NU, NV, 5, (u, v) => [u, v + q], () => side, false);
      }
      // the small membrane before the arm
      const P2 = [];
      for (let j = 0; j <= 4; j++) { const v = j / 4, row = []; for (let i = 0; i <= 6; i++) { const u = i / 6; const a = lerp3(root, elbow, u * 2 > 1 ? 1 : u * 2), bq = u < 0.5 ? elbow : lerp3(elbow, wrist, (u - 0.5) * 2); const base2 = lerp3(root, wrist, u); row.push(lerp3(base2, lerp3(a, bq, 0.5), v * 0.9)); } P2.push(row); }
      gridSurf(mm, P2, 6, 4, 5, (u, v) => [u, v + 4], () => side, false);
      o.wings.push({ root, elbow, wrist, fingers });
    }
  }


  /* ---------------------------------------------------------------- the thief: footprints, the cup, a coin */
  let CUP_MESH = null;
  function buildCup() {
    const m = MB(); cupMesh(m, XF([0, 0, 0], [1.35, 0, 0], [0, 1.35, 0], [0, 0, 1.35])); groupMesh(m);
    CUP_MESH = meshVAO(false); uploadMesh(CUP_MESH, m);
  }
  // the walk: footprints approach the cup, then follow it away
  let STEPS = null;
  function buildSteps() {
    STEPS = [];
    const a0 = [0.6, -71.6], a1 = [CUP0[0] - 0.3, CUP0[2] + 0.3];
    const n1 = 8;
    for (let k = 0; k < n1; k++) {
      const f = k / (n1 - 1), x = lerp(a0[0], a1[0], f), z = lerp(a0[1], a1[1], f);
      const hd = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), side = k % 2 ? 1 : -1;
      STEPS.push({ t: 22.2 + k * 0.33, x: x - Math.sin(hd) * 0.09 * side, z: z + Math.cos(hd) * 0.09 * side, h: hd });
    }
    for (let k = 0; k < 7; k++) {
      const tt = 24.95 + k * 0.6, c = cupPos(tt), c2 = cupPos(tt + 0.1);
      const hd = Math.atan2(c2[2] - c[2], c2[0] - c[0]), side = k % 2 ? 1 : -1;
      STEPS.push({ t: tt, x: c[0] - Math.sin(hd) * 0.1 * side - Math.cos(hd) * 0.25, z: c[2] + Math.cos(hd) * 0.1 * side - Math.sin(hd) * 0.25, h: hd });
    }
    // up the stair at the end, racing
    const S = STAIR, run = (S.z1 - S.z0) / S.n;
    for (let k = 0; k < 22; k++) {
      const tread = 3 + k * 1.6, z = S.z0 + (tread + 0.5) * run, side = k % 2 ? 1 : -1;
      STEPS.push({ t: 53.4 + k * 0.21, x: 22.3 + side * 0.1, z, h: PI / 2, stair: true });
    }
  }
  function footprintsAt(t) {
    const act = STEPS.filter((s) => s.t <= t && (t < 52 ? !s.stair && t < 29 : s.stair));
    const last = act.slice(-16), o = new Float32Array(64);
    last.forEach((s, i) => { const pr = EZ.o2(clamp((t - s.t) / 0.16, 0, 1)); o.set([s.x, s.z, s.h, s.stair ? pr * 1.7 : pr], i * 4); });
    return { foot: o, n: last.length };
  }
  // the coin knocked loose when the cup is lifted: it slides, then spins on its rim, ringing, and falls
  function ringCoin(t) {
    const t0 = 24.75, R = 0.026;
    const p0 = [CUP0[0] + 0.12, 0, CUP0[2] + 0.1];
    if (t < t0) { const y = heapH(p0[0], p0[2]); return { c: [p0[0], y + 0.004, p0[2]], ax: [0.1, 1, 0.05], R, roll: 0 }; }
    const tau = t - t0;
    const sl = Math.min(tau, 0.7), d = 0.55 * (1 - Math.pow(1 - sl / 0.7, 2));
    const cx = p0[0] - 0.35 * d, cz = p0[2] + 0.45 * d;
    if (tau < 0.7) { const y = heapH(cx, cz); return { c: [cx, y + R * 0.3, cz], ax: norm([0.4 * tau, 1, 0.2]), R, roll: tau * 6 }; }
    // Euler's disk: the lean grows, the precession quickens, then it falls flat
    const u = clamp((tau - 0.7) / 2.4, 0, 1), lean = lerp(0.12, 1.45, Math.pow(u, 1.6));
    const prec = (tau - 0.7) * lerp(9, 28, u * u) ;
    const ax = norm([Math.cos(prec) * Math.cos(lean), Math.sin(lean), Math.sin(prec) * Math.cos(lean)]);
    const y = heapH(cx, cz) + R * Math.cos(lean) * 0.98;
    if (u >= 1) return { c: [cx, heapH(cx, cz) + 0.003, cz], ax: [0, 1, 0.02], R, roll: 0 };
    return { c: [cx + Math.cos(prec + 1.57) * 0.01, y, cz + Math.sin(prec + 1.57) * 0.01], ax, R, roll: prec * 0.3 };
  }
  function cupMatrix(t) {
    const c = cupPos(t), sway = t > 24.6 ? Math.sin((t - 24.6) * 2.6) * 0.06 : 0, yaw = 0.4 + (t > 24.6 ? (t - 24.6) * 0.08 : 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cs = Math.cos(sway), ss = Math.sin(sway);
    // yaw about y, then a small sway about z
    const X = [cy * cs, ss, -sy * cs], Y = [-cy * ss, cs, sy * ss], Z = [sy, 0, cy];
    return new Float32Array([X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, c[0], c[1], c[2], 1]);
  }

  /* ---------------------------------------------------------------- coins that move with the dragon */
  function frameAt(pts, up, k) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(NS, k + 1)], tt = norm(sub(b, a));
    let d = up[k]; d = norm(sub(d, mul(tt, dot(d, tt)))); return { C: pts[k], T: tt, D: d, S: cross(tt, d) };
  }
  function surfAt(fr, r, th) {
    const n = norm(add(mul(fr.D, Math.cos(th)), mul(fr.S, Math.sin(th))));
    return { p: add(fr.C, add(mul(fr.D, Math.cos(th) * r * 0.98), mul(fr.S, Math.sin(th) * r * 1.04))), n };
  }
  function landTime(p0, v0, R) {
    let lo = 0, hi = 4;
    const y = (tt) => p0[1] + v0[1] * tt - 4.9 * tt * tt - heapH(p0[0] + v0[0] * tt, p0[2] + v0[2] * tt) - R;
    if (y(hi) > 0) return hi;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (y(m) > 0) lo = m; else hi = m; }
    return hi;
  }
  let CASC = null, KICK = null, BREATHC = null;
  function buildCascade(rng) {
    CASC = [];
    for (let i = 0; i < 5200; i++) {
      // most coins pour in a few streams, each from one place on his back, for several seconds
      let u = lerp(0.16, 0.66, Math.pow(rng(), 0.8)), th = (rng() - 0.5) * 2.6, td = 33.2 + (u - 0.16) * 5 + rng() * 1.4 + Math.abs(th) * 0.4;
      if (i % 10 < 7) {
        const sI = i % 14, su = 0.17 + sI * 0.026, sth = (sI % 3 === 2 ? 1 : -1) * (0.45 + 0.2 * (sI % 3));
        u = su + (rng() - 0.5) * 0.03; th = sth + (rng() - 0.5) * 0.35; td = 33.4 + sI * 0.18 + rng() * 5.8;
      }
      CASC.push({ u, th, td, R: (i % 10 < 7 ? 0.1 : 0.07) + rng() * 0.07, seed: rng() * 100, tilt: [(rng() - 0.5) * 0.8, (rng() - 0.5) * 0.8], spin: (rng() - 0.5) * 20, sax: norm([rng() - 0.5, rng() - 0.5, rng() - 0.5]), push: 0.5 + rng() * 2.5 });
    }
    for (const c of CASC) {
      const k = Math.round(c.u * NS), r = radiusAt(c.u);
      const s0 = spineAt(c.td), s1 = spineAt(c.td + 0.05);
      const a = surfAt(frameAt(s0.pts, s0.up, k), r, c.th), b = surfAt(frameAt(s1.pts, s1.up, k), r, c.th);
      c.p0 = madd(a.p, a.n, c.R * 0.3); c.v0 = add(mul(sub(b.p, a.p), 1 / 0.05), mul(a.n, 0.6 + c.push * 0.4));
      c.tl = landTime(c.p0, c.v0, c.R);
    }
    KICK = [];
    for (let i = 0; i < 700; i++) {
      const u = lerp(0.5, 0.97, rng()), tk = lerp(39.8, 42.6, (u - 0.5) / 0.47) + (rng() - 0.5) * 0.4;
      const k = Math.round(u * NS), s0 = spineAt(tk), s1 = spineAt(tk + 0.05);
      const side = (rng() - 0.5) * 2.2;
      const fr = frameAt(s0.pts, s0.up, k);
      const p = add(s0.pts[k], mul(fr.S, side * radiusAt(u) * 1.6)); p[1] = heapH(p[0], p[2]) + 0.03;
      const vel = mul(sub(s1.pts[k], s0.pts[k]), 1 / 0.05);
      const v0 = add(mul(vel, 0.5 + rng() * 0.6), [(rng() - 0.5) * 3, 3 + rng() * 6, (rng() - 0.5) * 3]);
      const R = 0.045 + rng() * 0.035;
      KICK.push({ p0: p, v0, tk, R, tl: landTime(p, v0, R), seed: rng() * 100, spin: (rng() - 0.5) * 25, sax: norm([rng() - 0.5, rng() - 0.5, rng() - 0.5]), ax: norm([(rng() - 0.5), 1, (rng() - 0.5)]) });
    }
    // coins under his nostrils, which his breath stirs
    const o = dragonBuild(16);
    BREATHC = [];
    const fwd = norm([o.head.X[0], 0, o.head.X[2]]), side = norm(cross([0, 1, 0], fwd));
    for (let i = 0; i < 40; i++) {
      const d = 0.4 + rng() * 2.2, sd = (rng() - 0.5) * (0.6 + d * 0.8);
      const x = o.nostril[0] + fwd[0] * d + side[0] * sd, z = o.nostril[2] + fwd[2] * d + side[2] * sd;
      BREATHC.push({ x, z, d, fwd, R: 0.028 + rng() * 0.02, seed: rng() * 100, ph: rng() * TAU, ax: norm([(rng() - 0.5) * 0.8, 1, (rng() - 0.5) * 0.8]) });
    }
  }
  function dragonCoins(t, out, k) {
    if (!CASC || !DRAG || t < 13) return k;
    // riding his back, then poured off as he rises
    for (const c of CASC) {
      if (t < c.td) {
        const kk = Math.round(c.u * NS), fr = { C: DRAG.C[kk], T: DRAG.T[kk], D: DRAG.D[kk], S: DRAG.Sd[kk] };
        const a = surfAt(fr, DRAG.RR[kk], c.th);
        coinPush(out, k++, madd(a.p, a.n, c.R * 0.3), c.R, add(a.n, mul(fr.T, c.tilt[0])), c.seed, 0, 0);
      } else {
        const tau = Math.min(t - c.td, c.tl);
        const p = [c.p0[0] + c.v0[0] * tau, c.p0[1] + c.v0[1] * tau - 4.9 * tau * tau, c.p0[2] + c.v0[2] * tau];
        coinPush(out, k++, p, c.R * (DBGN === 20 ? 6 : 1), rotAxis([0, 1, 0], c.sax, c.spin * tau + 0.3), c.seed, 0, tau * 9);
      }
    }
    if (t > 39) for (const c of KICK) {
      const tau = clamp(t - c.tk, 0, c.tl);
      const p = [c.p0[0] + c.v0[0] * tau, c.p0[1] + c.v0[1] * tau - 4.9 * tau * tau, c.p0[2] + c.v0[2] * tau];
      coinPush(out, k++, p, c.R, rotAxis(c.ax, c.sax, c.spin * tau), c.seed, 0, tau * 7);
    }
    // his breath: each exhale pushes the nearest coins, which slide and settle back
    if (t < 30) {
      const ex = Math.max(0, DRAG.S.breath), ex2 = ex * ex;
      for (const c of BREATHC) {
        const w = ex2 * 0.09 / (0.4 + c.d), x = c.x + c.fwd[0] * w, z = c.z + c.fwd[2] * w;
        const hop = ex2 * 0.03 * Math.max(0, Math.sin(t * 7 + c.ph)) / (0.5 + c.d);
        coinPush(out, k++, [x, heapH(x, z) + c.R * 0.4 + hop, z], c.R, rotAxis(c.ax, c.fwd, ex2 * 0.6 / (0.5 + c.d)), c.seed, 0, 0);
      }
    }
    return k;
  }


  /* ---------------------------------------------------------------- the fire, per frame */
  const FIRE_T0 = 45.35, FIRE_T1 = 50.4, FIRE_V = 21, FIRE_MAX = 40;
  let VFIRE = null, NRIB = 420, NFILL = 0, MELT = null;
  function fireState(t) {
    const df = clamp((t - FIRE_T0) * FIRE_V, 0, FIRE_MAX + (t > FIRE_T1 ? (t - FIRE_T1) * FIRE_V : 0));
    const dt = t > FIRE_T1 ? (t - FIRE_T1) * FIRE_V * 1.1 : 0;
    return { df, dt, on: t > FIRE_T0 && dt < df, k: clamp((t - FIRE_T0) * 3, 0, 1) * (1 - sstep(FIRE_T1, FIRE_T1 + 1.6, t)) };
  }
  function buildFire(rng) {
    const strip = [];
    const S = 22;
    for (let j = 0; j <= S; j++) strip.push(j / S, -1, j / S, 1);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(strip), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const inst = [];
    for (let i = 0; i < NRIB; i++) { const fill = i < NFILL; inst.push(rng() * TAU, fill ? Math.sqrt(rng()) * 0.6 : Math.sqrt(rng()), rng(), 0.7 + rng() * 0.7, fill ? 0.7 + rng() * 0.6 : 0.6 + rng() * 1.2, fill ? 0.35 + rng() * 0.3 : 0.08 + rng() * 0.25, fill ? 1 : 0, 0); }
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inst), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    VFIRE = { vao, ib, n: (S + 1) * 2 };
    PR.fire = [0, 1].map((k) => program(VS_FIRE, FS_FIRE, ['aQ', 'iA', 'iB'], 'fire' + k, '#define FILL ' + k));
    // coins under the torrent: they glow, run soft and fly
    const o = dragonBuild(46.5);
    MELT = [];
    for (let i = 0; i < 700; i++) {
      const d = lerp(4, FIRE_MAX - 2, Math.pow(rng(), 0.8));
      const ax = madd(o.mouth, o.mouthDir, d);
      const sp = (rng() - 0.5) * (2 + d * 0.3);
      const side = norm(cross(o.mouthDir, [0, 1, 0]));
      const x = ax[0] + side[0] * sp, z = ax[2] + side[2] * sp;
      const p0 = [x, heapH(x, z) + 0.03, z], tp = FIRE_T0 + d / FIRE_V + rng() * 0.15;
      const out = norm([side[0] * Math.sign(sp || 1), 0, side[2] * Math.sign(sp || 1)]);
      const v0 = add(add(mul(out, 2 + rng() * 6), mul(o.mouthDir, 4 + rng() * 8)), [0, 3 + rng() * 7, 0]);
      const R = 0.03 + rng() * 0.03;
      MELT.push({ p0, v0, tp, R, tl: landTime(p0, v0, R), seed: rng() * 100, spin: (rng() - 0.5) * 30, sax: norm([rng() - 0.5, rng() - 0.5, rng() - 0.5]), ax: norm([(rng() - 0.5), 1, (rng() - 0.5)]) });
    }
  }
  function meltCoins(t, out, k) {
    if (!MELT || t < 44 || t > 56) return k;
    for (const c of MELT) {
      const tau = clamp(t - c.tp, 0, c.tl);
      const heat = t < c.tp ? 0 : clamp(1.4 - (t - c.tp) * 0.25, 0, 1.2);
      const p = [c.p0[0] + c.v0[0] * tau, c.p0[1] + c.v0[1] * tau - 4.9 * tau * tau, c.p0[2] + c.v0[2] * tau];
      coinPush(out, k++, p, c.R * (1 + heat * 0.15), rotAxis(c.ax, c.sax, c.spin * tau), c.seed, heat, tau * 8);
      out[(k - 1) * CF + 8] = 0.075 * (1 - heat * 0.4);
    }
    return k;
  }

  // the torrent: a stream of lobes, each born at the jaws, rolling, swelling and cooling as it goes
  let LOBES = null, LOBEBUF = null;
  function buildLobes(rng) {
    LOBES = [];
    const n = 230;
    for (let i = 0; i < n; i++) LOBES.push({ tb: FIRE_T0 + (i / n) * (FIRE_T1 - FIRE_T0) + rng() * 0.03, phi: rng() * TAU, rho: Math.sqrt(rng()), spd: 0.85 + rng() * 0.3, seed: rng(), curl: (rng() < 0.5 ? -1 : 1) * (1 + rng()), sw: rng() * TAU });
    LOBEBUF = new Float32Array(n * 12);
    PR.lobe = program(VS_LOBE, FS_LOBE, ['aQ', 'iP', 'iD', 'iV'], 'lobe');
  }
  function drawLobes(t) {
    if (!LOBES || !DRAG || t < FIRE_T0 || t > FIRE_T1 + 4) return;
    const d0 = DRAG.mouthDir, U0 = norm(cross(d0, [0, 1, 0])), V0 = cross(U0, d0), cp = F.cam.p;
    const list = [];
    for (const L of LOBES) {
      const tau = t - L.tb; if (tau <= 0) continue;
      const d = Math.min(28 * tau / (1 + 0.3 * tau) * L.spd, FIRE_MAX + 4);
      const R = Math.min(0.5 + 0.17 * d + 0.45 * tau, 7.5);
      let p = madd(DRAG.mouth, d0, d);
      p = add(p, add(mul(U0, Math.cos(L.phi) * R * 0.7 * L.rho + Math.sin(tau * 1.7 + L.sw) * 0.4 * tau), mul(V0, Math.sin(L.phi) * R * 0.55 * L.rho)));
      p[1] += 0.55 * tau * tau + 0.5 * tau;
      p[1] = Math.max(p[1], heapH(p[0], p[2]) + R * 0.5);
      const cool = t > FIRE_T1 ? Math.exp(-(t - FIRE_T1) * 1.1) : 1;
      const temp = clamp((1.12 - 0.09 * tau - d / 260) * (1.12 - 0.3 * L.rho), 0, 1) * cool;
      const dist = len(sub(p, cp));
      let al = sstep(0, 0.07, tau) * sstep(0.3, 0.62, temp) * sstep(R * 1.0, R * 2.2, dist);
      if (al < 0.01) continue;
      list.push({ p, R, temp, al, dist, rot: L.seed * 6.3 + tau * 1.5 * L.curl, seed: L.seed, tau });
    }
    if (!list.length) return;
    list.sort((a, b) => b.dist - a.dist);
    const o = LOBEBUF;
    list.forEach((l, i) => { o.set([l.p[0], l.p[1], l.p[2], l.R, l.seed, l.temp, l.al, l.tau, l.rot, 0, 0, 0], i * 12); });
    const pl = PR.lobe; gl.useProgram(pl); setCommon(pl);
    gl.bindVertexArray(VLOBE.vao); gl.bindBuffer(gl.ARRAY_BUFFER, VLOBE.ib); gl.bufferData(gl.ARRAY_BUFFER, o.subarray(0, list.length * 12), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, list.length);
  }
  function fireDraw(t, pass) {
    if (pass !== 1 || !VFIRE || !DRAG) return;
    const fs = fireState(t); if (!fs.on) { drawLobes(t); return; }
    const d = DRAG.mouthDir, u = norm(cross(d, [0, 1, 0])), v = cross(u, d);
    gl.bindVertexArray(VFIRE.vao); gl.bindBuffer(gl.ARRAY_BUFFER, VFIRE.ib);
    for (let k = 1; k >= 0; k--) {
      const pf = PR.fire[k]; gl.useProgram(pf); setCommon(pf);
      u4(pf, 'uFS', [DRAG.mouth[0], DRAG.mouth[1], DRAG.mouth[2], Math.min(fs.df, 15)]); u4(pf, 'uFD', [d[0], d[1], d[2], fs.dt]); u3(pf, 'uFU', u); u3(pf, 'uFV', v);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, (k ? 0 : NFILL) * 32); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, (k ? 0 : NFILL) * 32 + 16);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, VFIRE.n, k ? NFILL : NRIB - NFILL);
    }
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    drawLobes(t);
  }
  function fireLights(t) {
    const fs = fireState(t); if (!fs.on || !DRAG) return;
    const L = F.L, d = DRAG.mouthDir;
    L.fire = [0.1, 0.35, 0.62, 0.9].map((f) => { const dd = lerp(fs.dt, fs.df, f); const p = madd(DRAG.mouth, d, dd); return [p[0], p[1] + 0.5, p[2], 9 + dd * 0.3]; });
    L.fireC = mul([7, 2.9, 0.7], fs.k);
  }

  /* ---------------------------------------------------------------- smoke and embers after the fire */
  let SMOKE = null, EMBERS = null;
  function buildAir(rng) {
    const o = dragonBuild(47);
    SMOKE = []; EMBERS = [];
    for (let i = 0; i < 130; i++) {
      const d = lerp(3, FIRE_MAX, Math.pow(rng(), 0.7)), c = madd(o.mouth, o.mouthDir, d);
      const sp = norm([rng() - 0.5, rng() * 0.6, rng() - 0.5]);
      SMOKE.push({ p: madd(c, sp, (0.5 + d * 0.12) * rng()), t0: FIRE_T0 + d / FIRE_V + rng() * 0.6, sz: 0.9 + rng() * 1.6 + d * 0.03, rise: 0.4 + rng() * 0.9, seed: rng(), drift: [(rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6] });
    }
    for (let i = 0; i < 700; i++) {
      const d = lerp(2, FIRE_MAX, rng()), c = madd(o.mouth, o.mouthDir, d);
      const sp = norm([rng() - 0.5, rng() - 0.3, rng() - 0.5]);
      EMBERS.push({ p: madd(c, sp, (0.4 + d * 0.15) * rng()), t0: FIRE_T0 + d / FIRE_V + rng() * 4, life: 2.5 + rng() * 4.5, v: [(rng() - 0.5) * 1.5, 0.6 + rng() * 2.2, (rng() - 0.5) * 1.5], sz: 0.03 + rng() * 0.05, ph: rng() * TAU });
    }
  }
  function airSprites(t, o, k) {
    // his breath, while he sleeps: a little stippled smoke that curls out of the nostrils on each exhale
    if (DRAG && t > 13 && t < 31) {
      const fwd = DRAG.head.X, ex = Math.max(0, DRAG.S.breath);
      const ph = fract(t / 4.4);
      for (let i = 0; i < 14; i++) {
        const f = fract(ph + i / 14), a = Math.sin(f * PI) * ex * 0.7; if (a < 0.03) continue;
        const b = k * 12, d = 0.2 + f * 2.2;
        o[b] = DRAG.nostril[0] + fwd[0] * d + Math.sin(i * 7.1) * 0.2 * f; o[b + 1] = DRAG.nostril[1] + fwd[1] * d - 0.2 * f + f * f * 0.5; o[b + 2] = DRAG.nostril[2] + fwd[2] * d + Math.cos(i * 5.3) * 0.2 * f;
        o[b + 3] = 0.12 + f * 0.55; o[b + 4] = 2; o[b + 5] = i * 0.137; o[b + 6] = a; o[b + 7] = 0; o[b + 8] = 0; o[b + 9] = 0; o[b + 10] = 0; o[b + 11] = 0; k++;
      }
    }
    if (!SMOKE || t < FIRE_T0) return k;
    const clear = 1 - sstep(53.5, 58.8, t);
    for (const m of SMOKE) {
      const tau = t - m.t0; if (tau < 0) continue;
      const a = sstep(0, 1.2, tau) * clear * 0.85; if (a < 0.01) continue;
      const b = k * 12, sz = m.sz * (1 + tau * 0.22);
      o[b] = m.p[0] + m.drift[0] * tau; o[b + 1] = m.p[1] + m.rise * tau; o[b + 2] = m.p[2] + m.drift[2] * tau; o[b + 3] = sz;
      o[b + 4] = 2; o[b + 5] = m.seed; o[b + 6] = a; o[b + 7] = 0; o[b + 8] = 0; o[b + 9] = 0; o[b + 10] = 0; o[b + 11] = 0; k++;
    }
    for (const e of EMBERS) {
      const tau = t - e.t0; if (tau < 0 || tau > e.life) continue;
      const b = k * 12, sw = Math.sin(t * 3 + e.ph) * 0.4;
      o[b] = e.p[0] + e.v[0] * tau + sw; o[b + 1] = e.p[1] + e.v[1] * tau; o[b + 2] = e.p[2] + e.v[2] * tau; o[b + 3] = e.sz;
      o[b + 4] = 1; o[b + 5] = e.ph; o[b + 6] = (1 - tau / e.life) * (0.6 + 0.4 * Math.sin(t * 9 + e.ph * 5)); o[b + 7] = 0;
      o[b + 8] = -e.v[0] * 0.08; o[b + 9] = -e.v[1] * 0.08; o[b + 10] = -e.v[2] * 0.08; o[b + 11] = 0; k++;
    }
    return k;
  }

  /* ---------------------------------------------------------------- the title, in black-letter, cut by hand */
  // strokes in x-height units, y up; [thick?, points]
  const GLYPHS = {
    T: { w: 1.15, s: [[1, [[-0.12, 1.25], [0.15, 1.43], [0.55, 1.32], [0.95, 1.44], [1.1, 1.33]]], [1, [[0.48, 1.34], [0.48, 0.12], [0.32, -0.03], [0.1, 0.06]]], [0, [[-0.12, 1.25], [-0.22, 1.02]]], [0, [[1.1, 1.33], [1.14, 1.08]]], [0, [[0.3, 0.9], [0.66, 0.9]]]] },
    h: { w: 0.74, s: [[1, [[-0.08, 1.38], [0.04, 1.5], [0.02, 0.0], [-0.08, -0.02]]], [1, [[0.02, 0.78], [0.24, 1.0], [0.5, 0.86], [0.5, 0.06], [0.64, -0.06]]]] },
    e: { w: 0.7, s: [[1, [[0.52, 0.14], [0.32, -0.01], [0.0, 0.12], [0.0, 0.86], [0.24, 1.0], [0.5, 0.86], [0.5, 0.62], [0.02, 0.5]]]] },
    H: { w: 1.1, s: [[1, [[-0.12, 1.32], [0.06, 1.44], [0.06, 0.1], [-0.1, -0.02]]], [1, [[0.62, 1.38], [0.78, 1.46], [0.78, 0.12], [0.94, 0.0]]], [1, [[0.06, 0.72], [0.42, 0.84], [0.78, 0.72]]], [0, [[0.42, 1.12], [0.42, 0.28]]], [0, [[-0.12, 1.32], [-0.2, 1.1]]]] },
    o: { w: 0.7, s: [[1, [[0.26, 1.0], [0.0, 0.86], [0.0, 0.14], [0.26, 0.0], [0.52, 0.14], [0.52, 0.86], [0.26, 1.0]]]] },
    a: { w: 0.76, s: [[1, [[0.04, 0.88], [0.27, 1.0], [0.52, 0.86], [0.52, 0.1], [0.64, -0.03]]], [1, [[0.52, 0.58], [0.1, 0.46], [0.0, 0.14], [0.22, 0.0], [0.52, 0.16]]]] },
    r: { w: 0.58, s: [[1, [[-0.08, 0.92], [0.02, 1.0], [0.02, 0.0], [-0.08, -0.03]]], [1, [[0.02, 0.8], [0.22, 1.0], [0.44, 0.9]]]] },
    d: { w: 0.76, s: [[1, [[0.52, 0.86], [0.26, 1.0], [0.0, 0.86], [0.0, 0.14], [0.26, 0.0], [0.52, 0.12], [0.62, 0.02]]], [1, [[0.52, 0.12], [0.52, 0.92], [0.32, 1.24], [0.02, 1.46]]]] },
    ' ': { w: 0.42, s: [] },
  };
  function drawTitle(g, t, cw, ch) {
    const t0 = 55.3, t1 = 58.4;
    if (t < t0) return;
    const text = 'The Hoard', xh = ch * 0.05, nibA = 0.66;
    let tw = 0; for (const c of text) tw += GLYPHS[c].w;
    const x0 = (cw - tw * xh) / 2, base = ch * 0.938;
    // every stroke, in order, with its length
    const strokes = []; let x = 0, total = 0;
    for (const c of text) {
      const gl = GLYPHS[c];
      for (const st of gl.s) { const pts = st[1].map((p) => [x0 + (x + p[0]) * xh, base - p[1] * xh]); let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); strokes.push({ thick: st[0], pts, L, at: total }); total += L; }
      x += gl.w;
    }
    const done = EZ.io2(clamp((t - t0) / (t1 - t0), 0, 1)) * total;
    g.save();
    g.fillStyle = 'rgba(24,17,13,0.94)';
    let tip = null;
    for (const st of strokes) {
      if (st.at > done) break;
      const lim = done - st.at, nib = (st.thick ? 0.21 : 0.045) * xh / 2;
      const nx = Math.cos(nibA) * nib, ny = -Math.sin(nibA) * nib;
      let acc = 0;
      for (let i = 1; i < st.pts.length; i++) {
        const a = st.pts[i - 1], b0 = st.pts[i], sl = Math.hypot(b0[0] - a[0], b0[1] - a[1]);
        if (acc >= lim) break;
        const f = Math.min(1, (lim - acc) / sl), b = [a[0] + (b0[0] - a[0]) * f, a[1] + (b0[1] - a[1]) * f];
        g.beginPath(); g.moveTo(a[0] - nx, a[1] - ny); g.lineTo(a[0] + nx, a[1] + ny); g.lineTo(b[0] + nx, b[1] + ny); g.lineTo(b[0] - nx, b[1] - ny); g.closePath(); g.fill();
        // the burr of the burin: a hair-thin shadow along the lower edge
        acc += sl; tip = b;
      }
    }
    // a lozenge either side, once the word is cut
    const k = clamp((t - t1) / 0.6, 0, 1);
    if (k > 0) for (const sx of [x0 - xh * 0.9, x0 + tw * xh + xh * 0.9]) {
      const cy = base - xh * 0.5, r = xh * 0.2 * k;
      g.beginPath(); g.moveTo(sx, cy - r); g.lineTo(sx + r * 0.7, cy); g.lineTo(sx, cy + r); g.lineTo(sx - r * 0.7, cy); g.closePath(); g.fill();
    }
    if (tip && t < t1) { g.fillStyle = 'rgba(255,246,220,0.9)'; g.beginPath(); g.arc(tip[0], tip[1], xh * 0.035, 0, TAU); g.fill(); }
    g.restore();
  }
  /* ---------------------------------------------------------------- the dragon, per frame */
  let DRAG = null;
  function eyeState(t) {
    return {
      open: track([[0, 0], [28.9, 0], [30.0, 1, 'o2'], [60, 1]], t) * (1 - 0.9 * Math.exp(-Math.pow((t - 37.2) / 0.08, 2))),
      pupil: track([[0, 0.34], [29.7, 0.34], [30.5, 0.16, 'o2'], [31.2, 0.14], [31.9, 0.05], [33, 0.06], [60, 0.06]], t),
      glow: track([[0, 0.05], [29.8, 0.12], [31.8, 1.25, 'i2'], [60, 1.1]], t),
      cup: t > 30.15 && t < 34 ? [0.0 + 0.015 * Math.sin(t * 2), -0.08 + 0.01 * Math.sin(t * 3.1)] : [0, 0],
    };
  }
  function dragonUpload(t) {
    const o = DRAG;
    const keys = [4, 5, 6, 8, 9]; let nv = 0, ni = 0;
    for (const k of keys) if (DMB[k]) { nv += DMB[k].n; ni += DMB[k].i.length; }
    const V = new Float32Array(nv * 10), I = new Uint32Array(ni), groups = []; let vo = 0, io = 0;
    for (const k of keys) {
      const m = DMB[k]; if (!m || !m.n) continue;
      V.set(m.v, vo * 10); for (let q = 0; q < m.i.length; q++) I[io + q] = m.i[q] + vo;
      groups.push({ mat: k, off: io, n: m.i.length }); vo += m.n; io += m.i.length;
    }
    uploadMesh(DRAGON_MESH, { v: V, i: I, groups });
    const S = o.S, E = eyeState(t);
    let eye = o.eyes[0], best = -9;
    for (const e of o.eyes) { const d = dot(e.F, norm(sub(F.cam.p, e.c))); if (d > best) { best = d; eye = e; } }
    F.mu = F.mu || {};
    F.mu.uDrag = [S.fireIn, S.breath, 0, E.open];
    F.mu.uEye = [E.pupil, E.glow, E.cup[0], E.cup[1]];
    F.mu.uEyeP = [eye.c[0], eye.c[1], eye.c[2], eye.rad]; F.mu.uEyeF = eye.F;
    F.mu.uBreath = [o.nostril[0], o.nostril[1], o.nostril[2], Math.max(0, S.breath)];
    if (t >= 32 && t < 45.3) {
      // the fire's light thrown up from the gold onto his head, so the skull reads as carved
      const hp = o.head.W2([2.6, 0.4, 0]), toC = norm(sub(F.cam.p, hp));
      F.L.lamp = [...add(hp, add(mul(toC, 5), [0, 4.5, 0])), 9]; F.L.lampC = mul([2.4, 1.5, 0.8], sstep(32, 34, t));
    }
    if (t >= 28 && t < 32) {
      const e = o.eyes[1];
      F.L.lamp = [...add(e.c, add(mul(e.F, 1.4), add(mul(e.U, 1.6), mul(e.R, 1.1)))), 1.6];
      F.L.lampC = [3.2, 2.1, 1.3]; F.L.lamp[3] = 2.6;
    }
    // his own light: the furnace in his chest
    const ch = bodyPt(o, 0.26);
    const gp = add(ch.c, add(mul(ch.T, -ch.r * 1.2), mul(ch.D, ch.r * (t > 32 ? 1.6 : -1.2))));
    F.L.glow = [gp[0], Math.max(gp[1], heapH(gp[0], gp[2]) + 0.8), gp[2], F.L.glow[3]];
  }
  /* ================================================================== building, playing, exporting */
  let STATIC_M = null;
  const BUILD = [
    () => { initNoise(SEED); RNG = mulberry32(SEED * 31 + 5); makePiles(mulberry32(SEED * 5 + 11)); HOOK.top = heapH(0.0, HOOK.z); settleShafts(); },
    () => { for (const m of [0, 1, 11]) meshProg(m, false); },
    () => { for (const m of [2, 7, 10]) meshProg(m, false); coinProg(false); },
    () => { PR.spr = [0, 1, 2].map((k) => program(VS_SPR, FS_SPR, ['aQ', 'iP', 'iD', 'iV'], 'spr' + k, '#define KIND ' + k)); PR.vd = program(VS_VOID, FS_VOID, ['aQ'], 'void'); postProg(false, false); postProg(true, false); },
    () => { STATIC_M = MB(); buildHeap(STATIC_M); },
    () => {
      for (let i = 0; i < NPIL; i++) { const z = PZ0 - i * PDZ; buildPillar(STATIC_M, -PX, z, i * 2); buildPillar(STATIC_M, PX, z, i * 2 + 1); }
      buildWalls(STATIC_M); buildStair(STATIC_M);
    },
    () => { buildTreasures(STATIC_M, mulberry32(SEED * 7 + 1)); },
    () => { groupMesh(STATIC_M); MESH_S = meshVAO(false); MESH_S.cull = true; uploadMesh(MESH_S, STATIC_M); STATIC_M = null; },
    () => { buildCoins(mulberry32(SEED * 13 + 3)); buildMotes(mulberry32(SEED * 17 + 9)); buildCamera(); },
  ];
  const BUILD_LATE = [
    () => { makePoses(); DRAGON_MESH = meshVAO(true); },
    () => { for (const m of [4, 5, 6, 8, 9]) meshProg(m, false); },
    () => { buildCup(); buildSteps(); },
    () => { buildCascade(mulberry32(SEED * 23 + 7)); EXTRA_COINS = (t, out, k) => meltCoins(t, out, dragonCoins(t, out, k)); FX_DRAW = (t, pass) => fireDraw(t, pass); },
    () => { buildAir(mulberry32(SEED * 31 + 13)); EXTRA_SPR = airSprites; OVERLAY = drawTitle; },
    () => { buildFire(mulberry32(SEED * 29 + 3)); buildLobes(mulberry32(SEED * 37 + 5)); for (const m of [0, 1, 11, 2, 7, 4, 5, 6, 9]) meshProg(m, true); coinProg(true); },
  ];

  (window.PIECES = window.PIECES || []).push({
    id: 'hoard',
    title: 'The Hoard',
    medium: 'Animated engraving, burin and wash, in code · 60 s',
    note: 'Tap to pause',
    about: 'A coin rolls in the dark of Erebor, and the hoard wakes the worm who sleeps on it. An original interpretation of Tolkien’s text in The Hobbit, not of any film: a real three-dimensional hall, treasure and dragon, drawn each frame as an engraving whose every line follows the form it describes.',
    tone: 'dark',
    room: '#0c0a09',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = (api.seed >>> 0) % 100000 || 7;
      let alive = true, raf = 0, built = 0, playing = !EXPORT, clock = 0, last = 0, readyCalled = false, failed = false;
      el.style.background = '#0c0a09';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;';
      el.appendChild(cv);
      CV = cv; CTX2 = cv.getContext('2d');
      GLC = document.createElement('canvas');
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .5s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="4" height="16" rx="1.5" fill="rgba(240,232,220,.75)"/><rect x="20" y="9" width="4" height="16" rx="1.5" fill="rgba(240,232,220,.75)"/></svg>';
      el.appendChild(pauseMark);
      function fail(msg) {
        failed = true;
        const d = document.createElement('div');
        d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(240,232,220,.7);font:italic 18px Georgia,serif;text-align:center;padding:24px';
        d.textContent = msg; el.appendChild(d); api.ready();
      }
      if (!initGL(GLC)) { fail('This engraving is drawn with WebGL2, which this browser does not offer.'); return { destroy() {} }; }
      let cssW = 0, cssH = 0;
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0;
        if (EXPORT) { cssW = W; cssH = H; cv.style.position = 'fixed'; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          cssW = Math.min(w, h * 0.8); cssH = cssW * 1.25;
          left = (w - cssW) / 2; top = (h - cssH) / 2;
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 50) + 'px'; pauseMark.style.top = (top + 16) + 'px';
        const xs = EXPORT ? (/[?&]x2\b/.test(location.search) ? 2 : 1) : dpr;
        let pw = Math.round(cssW * xs), ph = Math.round(cssH * xs);
        if (!EXPORT && pw * ph > 1.8e6) { const k = Math.sqrt(1.8e6 / (pw * ph)); pw = Math.round(pw * k); ph = Math.round(ph * k); }
        if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; GLC.width = pw; GLC.height = ph; }
      }
      layout();
      const STEPS = BUILD.concat(BUILD_LATE);
      async function build() {
        for (let i = built; i < STEPS.length; i++) {
          if (!alive) return;
          const t0 = performance.now();
          try { STEPS[i](); } catch (e) { console.error(e); fail('This engraving could not be prepared: ' + e.message); return; }
          if (EXPORT) console.log('[b] step ' + i + ' ' + Math.round(performance.now() - t0) + 'ms');
          built = i + 1;
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        }
        if (!alive) return;
        drawFrame(0);
        if (!readyCalled) { readyCalled = true; document.documentElement.dataset.ready = 'hoard'; api.ready(); }
      }
      let allDone = null;
      const whenAll = new Promise((res) => { allDone = res; });
      build().then(() => { if (built >= STEPS.length) allDone(); });
      // keep the room's force-reveal from announcing readiness before the plate is cut
      const mo = new MutationObserver(() => { if (built < STEPS.length && !failed && document.documentElement.dataset.ready) delete document.documentElement.dataset.ready; });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
      window.__hoard = {
        duration: DUR,
        isReady: () => built >= STEPS.length,
        ready: whenAll,
        renderAt(t) { return whenAll.then(() => { playing = false; clock = t; drawFrame(t); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }); },
        time: (t) => { const a = performance.now(); drawFrame(t); gl.finish(); return performance.now() - a; },
        cam: (t) => { DRAG = dragonBuild(t); const c = camAt(t); return { c, head: headPos(), eye: DRAG.eyes.map((e) => e.c) }; },
        prof: (t) => { PRF = {}; drawFrame(t); const r = PRF; PRF = null; delete r._t; return r; },
      };
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing || EXPORT || built < STEPS.length) return;
        clock += dt;
        if (clock > DUR + HOLD) clock = 0;
        drawFrame(Math.min(clock, DUR));
        if (clock > DUR + HOLD - 1.0) { const k = (clock - (DUR + HOLD - 1.0)) / 1.0; CTX2.setTransform(1, 0, 0, 1, 0, 0); CTX2.fillStyle = 'rgba(12,10,9,' + clamp(k, 0, 1) + ')'; CTX2.fillRect(0, 0, cv.width, cv.height); }
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => {
        clearTimeout(rt);
        rt = setTimeout(() => { if (!alive) return; layout(); if (built >= STEPS.length) drawFrame(Math.min(clock, DUR)); }, 150);
      });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); cv.removeEventListener('pointerdown', onDown);
          if (window.__hoard) delete window.__hoard;
          try { const ext = gl && gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) { /* gone */ }
          gl = null; FB = null;
        },
      };
    },
  });
})();
