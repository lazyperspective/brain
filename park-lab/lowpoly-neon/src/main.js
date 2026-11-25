import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { P, rng, clamp, smooth, lerp, hash1, clockFn } from './util.js';
import * as Park from './park.js';

const qs = new URLSearchParams(location.search);
const MODE = qs.get('mode') || 'lowpoly';
const SIZE = +(qs.get('size') || 1080);
const NEON = MODE === 'neon';
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE);
document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = NEON ? 1.0 : 1.05;
renderer.shadowMap.enabled = !NEON; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const root = new THREE.Group(); scene.add(root);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);

const anims = [];
const ctx = { neon: NEON, root, anim: (f) => anims.push(f) };
const paths = Park.buildPaths();

// ============================================================ LOW-POLY: blueprint sweep material system
const U = {
  uFront: { value: -100 }, uBand: { value: 14 }, uDir: { value: new THREE.Vector2() }, uCyan: { value: new THREE.Color(0x48e0ff) },
};
{ const d = new THREE.Vector2(-1, -1).normalize().multiplyScalar(1).add(new THREE.Vector2(0.3, -0.3).multiplyScalar(Math.SQRT1_2)); U.uDir.value.copy(d.normalize()); }
const FRONT0 = -96, FRONT_SPEED = 128, SWEEP_T0 = 0.2;
const frontAt = (t) => FRONT0 + Math.max(0, t - SWEEP_T0) * FRONT_SPEED;
const sOf = (p) => p.x * U.uDir.value.x + p.z * U.uDir.value.y;

const BP_VERT_HEAD = `
uniform float uFront; uniform float uBand; uniform vec2 uDir;
varying float vBpS; varying vec3 vBpW;
`;
const BP_PROJECT = (ground) => `
vec4 bpW = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
bpW = instanceMatrix * bpW;
#endif
bpW = modelMatrix * bpW;
float bpS = dot(bpW.xz, uDir);
vBpS = bpS; vBpW = bpW.xyz;
float bpR = clamp((uFront - bpS) / uBand, 0.0, 1.0);
float bx = bpR - 1.0;
float bpE = 1.0 + 2.70158 * bx * bx * bx + 1.70158 * bx * bx;
${ground ? '' : 'bpW.y = bpW.y * max(0.0, bpE);'}
vec4 mvPosition = viewMatrix * bpW;
gl_Position = projectionMatrix * mvPosition;
`;
const BP_FRAG_HEAD = `
uniform float uFront; uniform float uBand; uniform vec3 uCyan;
varying float vBpS; varying vec3 vBpW;
float bpGrid(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) * s; vec2 fw = fwidth(p); vec2 l = 1.0 - smoothstep(vec2(0.0), fw * w, g); return max(l.x, l.y); }
`;
const BP_FRAG = (kind) => `
{
float bpR = clamp((uFront - vBpS) / uBand, 0.0, 1.0);
${kind === 'ground' || kind === 'path' ? `
  vec2 rp = vec2(vBpW.x - vBpW.z, vBpW.x + vBpW.z) * 0.70710678;
  float g1 = bpGrid(rp, 2.0, 1.0), g2 = bpGrid(rp, 10.0, 1.6);
  vec3 bp = vec3(0.025, 0.075, 0.24) + uCyan * (g1 * 0.16 + g2 * 0.42) ${kind === 'path' ? '+ uCyan * 0.10' : ''};
  float k = smoothstep(0.05, 0.75, bpR);
  gl_FragColor.rgb = mix(bp, gl_FragColor.rgb, k);
  float edge = exp(-abs(uFront - vBpS) * 0.45) * (1.0 - smoothstep(0.0, 0.9, bpR) * 0.7);
  gl_FragColor.rgb += uCyan * edge * 0.9 + vec3(0.6,0.9,1.0) * exp(-abs(uFront - vBpS) * 1.6) * 0.8;
` : `
  if (bpR < 0.025) discard;
  float glow = 1.0 - smoothstep(0.05, 0.8, bpR);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uCyan * 1.3, glow * 0.85);
`}
}
`;
function patch(m, kind = 'solid') {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = BP_VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', BP_PROJECT(kind !== 'solid'));
    sh.fragmentShader = BP_FRAG_HEAD + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + BP_FRAG(kind));
  };
  m.customProgramCacheKey = () => 'bp-' + kind;
  return m;
}
const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
depthMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = BP_VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', BP_PROJECT(false));
  sh.fragmentShader = 'uniform float uFront; uniform float uBand; varying float vBpS; varying vec3 vBpW;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (clamp((uFront - vBpS) / uBand, 0.0, 1.0) < 0.025) discard;');
};
depthMat.customProgramCacheKey = () => 'bp-depth';

// ============================================================ NEON: materials and light systems
const igniters = [];
const glowFollows = [];
const flick = (x, seed) => { if (x < 0) return 0; if (x > 0.34) return 1; const k = Math.floor(x * 42); const h = hash1(k * 13.1 + seed * 7.7); return h > 0.42 ? 0.45 + 0.55 * h : 0.04; };
const igOn = (ig, t) => flick(t - ig.t0, ig.seed);
const lamps = [];
const bulbSets = [];
const neonTubes = [];
const tubeMatProto = {
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uOn; uniform float uTrace; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){
    float core = pow(abs(dot(normalize(vN), vec3(0.0,0.0,1.0))), 1.5);
    float lit = step(vUv.x, uTrace);
    float head = exp(-abs(vUv.x - uTrace) * 60.0) * step(uTrace, 0.999) * step(0.001, uTrace);
    vec3 c = uColor * (0.5 + 1.6 * core) * lit * uOn + mix(uColor, vec3(1.0), 0.6) * core * core * 0.9 * lit * uOn;
    c += vec3(1.0, 0.95, 0.9) * head * 6.0;
    c += uColor * 0.015;
    gl_FragColor = vec4(c, 1.0);
  }`,
};

let reflRT = null, groundMats = [];
const POOLS = 18;
const poolPos = Array.from({ length: POOLS }, () => new THREE.Vector4(0, -100, 0, 0.01));
const poolCol = Array.from({ length: POOLS }, () => new THREE.Vector4(0, 0, 0, 0));
function neonGroundMat(base, refl, ripple) {
  const m = new THREE.ShaderMaterial({
    uniforms: { tRefl: { value: null }, uRes: { value: new THREE.Vector2(SIZE, SIZE) }, uBase: { value: new THREE.Color(base) }, uRefl: { value: refl }, uRip: { value: ripple }, uTime: { value: 0 },
      uPoolPos: { value: poolPos }, uPoolCol: { value: poolCol }, uFogC: { value: new THREE.Color(0x070b1e) } },
    vertexShader: `varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D tRefl; uniform vec2 uRes; uniform vec3 uBase; uniform float uRefl; uniform float uRip; uniform float uTime; uniform vec4 uPoolPos[${POOLS}]; uniform vec4 uPoolCol[${POOLS}]; uniform vec3 uFogC;
      varying vec3 vW; varying float vDepth;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ return n(p)*0.5 + n(p*2.1)*0.3 + n(p*4.3)*0.2; }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        float puddle = smoothstep(0.48, 0.62, fbm(vW.xz * 0.09 + 3.0));
        vec2 rip = vec2(fbm(vW.xz * 0.9 + uTime * 0.25), fbm(vW.zx * 0.9 - uTime * 0.25)) - 0.5;
        vec2 off = rip * (0.006 + 0.004 * uRip) * (1.0 - puddle * 0.7);
        vec2 st = vec2(0.0, 1.0 / uRes.y) * (2.0 + 5.0 * (1.0 - puddle));
        vec3 r = texture2D(tRefl, uv + off).rgb * 0.36 + texture2D(tRefl, uv + off + st).rgb * 0.22 + texture2D(tRefl, uv + off - st).rgb * 0.22
               + texture2D(tRefl, uv + off + st * 2.5).rgb * 0.1 + texture2D(tRefl, uv + off - st * 2.5).rgb * 0.1;
        float k = mix(uRefl * 0.45, uRefl, puddle);
        vec3 col = uBase * (0.65 + 0.5 * fbm(vW.xz * 0.6));
        vec3 pool = vec3(0.0);
        for (int i = 0; i < ${POOLS}; i++) { vec2 d = vW.xz - uPoolPos[i].xz; float dd = dot(d,d); pool += uPoolCol[i].rgb * uPoolCol[i].a / (1.0 + dd * uPoolPos[i].w); }
        col += pool * (0.35 + 0.25 * (1.0 - puddle));
        col += r * k;
        float fog = smoothstep(150.0, 330.0, vDepth);
        col = mix(col, uFogC, fog * 0.85);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  groundMats.push(m);
  return m;
}

// ============================================================ ctx implementation
const matCache = new Map();
if (!NEON) {
  ctx.mat = (hex, o = {}) => {
    const key = hex + JSON.stringify(o);
    if (!matCache.has(key)) matCache.set(key, patch(new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: o.rough ?? 0.82, metalness: 0, side: o.side ?? THREE.FrontSide })));
    return matCache.get(key);
  };
  const vm = patch(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82 }));
  ctx.vmat = () => vm;
  ctx.groundMat = () => patch(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }), 'ground');
  ctx.pathMat = () => { const m = patch(new THREE.MeshStandardMaterial({ color: 0xf3e4c8, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 'path'); return m; };
  ctx.waterMat = () => patch(new THREE.MeshStandardMaterial({ color: 0x4fc3e8, roughness: 0.12, metalness: 0.05, flatShading: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 'path');
  ctx.glowMat = (hex, k) => ctx.mat(hex);
  ctx.act = (p) => SWEEP_T0 + (sOf(p) - FRONT0 + U.uBand.value * 0.9) / FRONT_SPEED;
  ctx.igniter = () => ({ t0: 0 });
  ctx.tube = ctx.bulbs = ctx.lamp = ctx.bulbsFromMesh = ctx.pathBulbs = () => null;
  ctx.coasterStart = ctx.act(P(0, -33)) + 0.05;
} else {
  ctx.mat = (hex, o = {}) => {
    const key = hex + JSON.stringify(o);
    if (!matCache.has(key)) {
      const c = new THREE.Color(hex); const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
      if (l > 0.2) c.multiplyScalar(0.07).add(new THREE.Color(0x05070f));
      matCache.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.5, metalness: 0.35, side: o.side ?? THREE.FrontSide }));
    }
    return matCache.get(key);
  };
  const vm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 });
  ctx.vmat = () => vm;
  ctx.glowMat = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
  ctx.groundMat = () => neonGroundMat(0x070b1a, 0.55, 0.5);
  ctx.pathMat = () => { const m = neonGroundMat(0x1a1c2a, 0.95, 0.3); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
  ctx.waterMat = () => { const m = neonGroundMat(0x03101e, 1.5, 1.4); m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4; return m; };
  const SPARK_SPEED = 86, SPARK_T0 = 0.2;
  ctx.SPARK_SPEED = SPARK_SPEED; ctx.SPARK_T0 = SPARK_T0;
  ctx.act = (p) => SPARK_T0 + Park.netDistance(paths, p) / SPARK_SPEED + 0.06;
  let seed = 1;
  ctx.igniter = (t0, dur) => { const ig = { t0, dur, seed: seed++ }; igniters.push(ig); return ig; };
  ctx.tube = (parent, curve, color, radius, ig, o = {}) => {
    if (!curve) return;
    const isLine = curve.isLineCurve3;
    const geo = new THREE.TubeGeometry(curve, o.segs ?? (isLine ? 2 : 96), radius, 6, !!curve.closed);
    const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.0) }, uOn: { value: 0 }, uTrace: { value: 0 } }, ...tubeMatProto });
    const m = new THREE.Mesh(geo, mat); parent.add(m); neonTubes.push({ mat, ig, o }); return m;
  };
  const bulbGeo = new THREE.IcosahedronGeometry(1, 1);
  ctx.bulbs = (parent, pts, color, ig, o = {}) => {
    const im = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), pts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = o.size ?? 0.15;
    pts.forEach((p, i) => { m4.compose(p, q, V(s, s, s)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(0)); });
    im.frustumCulled = false; parent.add(im);
    const cols = pts.map((_, i) => new THREE.Color(typeof color === 'function' ? color(i) : color));
    bulbSets.push({ im, cols, ig, o, n: pts.length });
    return im;
  };
  ctx.lamp = (pos, color, intensity, dist, ig) => {
    const l = new THREE.PointLight(color, 0, dist * 1.6, 1.4); l.position.copy(pos); scene.add(l);
    lamps.push({ l, ig, intensity, pos, color: new THREE.Color(color), dist });
  };
  ctx.glowFollow = (mat, color, k, pos) => { const ig = ctx.igniter(ctx.act(pos), 0.5); glowFollows.push({ mat, c: new THREE.Color(color).multiplyScalar(k), ig }); };
  ctx.bulbsFromMesh = (im, t0s, color, gain) => { bulbSets.push({ im, cols: t0s.map(() => new THREE.Color(color)), t0s, o: { gain, steady: true }, n: t0s.length }); };
  ctx.pathBulbs = (pts, cols, t0s, o = {}) => {
    const im = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), pts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = o.size ?? 0.1;
    pts.forEach((p, i) => { m4.compose(p, q, V(s, s, s)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(0)); });
    im.frustumCulled = false; root.add(im);
    bulbSets.push({ im, cols: cols.map(c => new THREE.Color(c)), t0s, o: { gain: o.gain ?? 2.2, twinkle: o.twinkle ?? true }, n: pts.length });
  };
  const stationT = ctx.act(P(-17, -8.4));
  ctx.coasterIgn = stationT; ctx.coasterStart = stationT + 0.3; ctx.trainOn = stationT + 0.1;
}

// ============================================================ build the park
const g = Park.buildGround(ctx, paths);
const co = Park.buildCoaster(ctx, paths);
Park.buildWheel(ctx); Park.buildCarousel(ctx); Park.buildDropTower(ctx); Park.buildSwing(ctx); Park.buildShip(ctx);
Park.buildTeacups(ctx); Park.buildFlume(ctx); Park.buildGate(ctx); Park.buildStalls(ctx); Park.buildProps(ctx, paths);
const L = Park.LAYOUT;
Park.buildTrees(ctx, paths, [
  ...co.Pp.filter((_, i) => i % 25 === 0).map(p => [(p.x - p.z) * Math.SQRT1_2, (p.x + p.z) * Math.SQRT1_2, 3.2]),
  [L.hub[0], L.hub[1], 13], [L.wheel[0], L.wheel[1], 10], [L.drop[0], L.drop[1], 6], [L.lake[0], L.lake[1], 17], [L.swing[0], L.swing[1], 8.5],
  [L.ship[0], L.ship[1], 8], [L.cups[0], L.cups[1], 8], [L.gate[0], L.gate[1], 7], [L.gate[0], L.gate[1] + 6, 7],
  [-17, -8.4, 8], [-10, -11, 7], [0, -29, 6], [0, -20, 6], [-10, -29, 6], [10, -29, 6], [-25, -18, 6], [24, -19, 8], [17, -11, 6], [8, -12, 6],
  [11, 30, 4], [15, 18, 3], [-15, 17, 3], [14, -1, 3], [-4, 34, 3], [-17, 38, 3], [22, 30, 3], [-24, 40, 4], [-30, 34, 4], [26, 38, 4], [34, 31, 4], [-2, -12, 4], [22, -4, 4], [-20, 11, 4], [6, 19, 3],
]);
Park.buildGuests(ctx, paths);

// coaster area: avoid trees on the track footprint (sample)
{
  // remove nothing; trees avoided via circles above
}

// ============================================================ NEON extras: coaster lights, sparks
let sparkIM = null, sparkData = [];
if (NEON) {
  const tc = ctx.coasterIgn;
  const ign = ctx.igniter(tc, 0.9); ign.coaster = true;
  // rail tubes starting from the crest so the trace races ahead of the train
  const i0 = Math.round(co.sCrest / co.ds);
  const railPts = (side) => { const pts = []; for (let k = 0; k < co.M; k += 4) { const i = (i0 + k) % co.M; pts.push(co.Pp[i].clone().addScaledVector(co.B[i], side * 0.55).addScaledVector(co.Nn[i], 0.14)); } return pts; };
  const tubeL = ctx.tube(root, new THREE.CatmullRomCurve3(railPts(1), true), 0xff3d9a, 0.11, ign, { segs: 1400 });
  const tubeR = ctx.tube(root, new THREE.CatmullRomCurve3(railPts(-1), true), 0x27e3ff, 0.11, ign, { segs: 1400 });
  // bulbs along the spine
  const bp = [], order = [];
  for (let k = 0; k < co.M; k += 14) { const i = (i0 + k) % co.M; for (const side of [1, -1]) { bp.push(co.Pp[i].clone().addScaledVector(co.B[i], side * 0.32).addScaledVector(co.Nn[i], -0.66)); order.push(k / co.M); } }
  ctx.bulbs(root, bp, (i) => [0xffd27a, 0xff7ad0, 0x7fe8ff][Math.floor(i / 6) % 3], ign, { size: 0.13, order: (i) => order[i], chase: 14, chaseSpeed: 1.8 });
  // support uplights
  co.supPos.forEach((p, k) => { if (k % 2 === 0) ctx.bulbs(root, [V(p.x, 0.25, p.z)], 0x9b5cff, ign, { size: 0.22, steady: true, order: () => 0 }); });
  ctx.lamp(co.toW(10.5, 9, 7.3), 0x40c0ff, 70, 26, ign);
  ctx.lamp(co.toW(0, 22, -12), 0xff40a0, 40, 26, ign);
  // sparks along path edges
  const N_TRAIL = 10;
  sparkIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), paths.edges.length * N_TRAIL);
  sparkIM.frustumCulled = false; root.add(sparkIM);
  for (const e of paths.edges) {
    const da = paths.dist[e.a], db = paths.dist[e.b];
    sparkData.push({ e, start: Math.min(da, db), fwd: da <= db });
  }
  ctx.N_TRAIL = N_TRAIL;
}

// ============================================================ blueprint lines (low-poly)
const bpLines = [];
if (!NEON) {
  const lineMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform vec2 uDir; varying float vS; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vS = dot(w.xz, uDir); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uFront; uniform float uBand; uniform vec3 uCyan; varying float vS;
      void main(){ float r = clamp((uFront - vS) / uBand, 0.0, 1.0); float a = 1.0 - smoothstep(0.25, 0.95, r); float boost = 1.0 + 2.5 * exp(-abs(uFront - vS) * 0.4);
      gl_FragColor = vec4(mix(uCyan, vec3(0.85,0.97,1.0), 0.25) * a * 0.62 * boost, 1.0); }`,
  });
  const lineMatDim = lineMat.clone(); lineMatDim.uniforms = U; lineMatDim.fragmentShader = lineMat.fragmentShader.replace('a * 0.62', 'a * 0.3');
  const edgeCache = new Map();
  const edgesOf = (geo, thr) => { const k = geo.uuid + thr; if (!edgeCache.has(k)) edgeCache.set(k, new THREE.EdgesGeometry(geo, thr)); return edgeCache.get(k); };
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
  const isNoBP = (o) => { for (let p = o; p; p = p.parent) if (p.userData.noBP) return true; return false; };
  const baked = [];
  for (const m of meshes) {
    m.customDepthMaterial = depthMat;
    if (isNoBP(m) || m.userData.noBPEdges) continue;
    const thr = m.userData.bpCoarse ? 50 : 28;
    if (m.isInstancedMesh) {
      const eg = edgesOf(m.geometry, thr); const arr = eg.attributes.position.array; const mm = new THREE.Matrix4(); const v = V();
      const out = new Float32Array(arr.length * m.count);
      for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mm); for (let j = 0; j < arr.length; j += 3) { v.set(arr[j], arr[j + 1], arr[j + 2]).applyMatrix4(mm); out.set([v.x, v.y, v.z], i * arr.length + j); } }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(out, 3));
      const ls = new THREE.LineSegments(bg, lineMatDim); ls.frustumCulled = false; m.add(ls); bpLines.push(ls);
    } else {
      const ls = new THREE.LineSegments(edgesOf(m.geometry, thr), lineMat); ls.frustumCulled = false; m.add(ls); bpLines.push(ls);
    }
  }
  // path outline lines live with path mesh
}

// ============================================================ lights & post
let composer, gtao = null, bloom = null, tiltH, tiltV, grade;
const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, samples: 4 });
composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
let sun;
if (!NEON) {
  scene.background = new THREE.Color(0x0a1a44);
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x8fa070, 1.15));
  sun = new THREE.DirectionalLight(0xffe4bc, 3.5); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera; sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  gtao = new GTAOPass(scene, camera, SIZE, SIZE);
  gtao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.5, thickness: 2.0, scale: 1.2, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  composer.addPass(gtao);
} else {
  scene.background = new THREE.Color(0x05060f);
  scene.add(new THREE.HemisphereLight(0x2a3a7a, 0x05060a, 0.55));
  const moon = new THREE.DirectionalLight(0x6070c0, 0.5); moon.position.set(-60, 90, -30); scene.add(moon);
  scene.fog = new THREE.Fog(0x070b1e, 160, 340);
  reflRT = new THREE.WebGLRenderTarget(SIZE / 2, SIZE / 2, { type: THREE.HalfFloatType });
  for (const m of groundMats) m.uniforms.tRefl.value = reflRT.texture;
  bloom = new UnrealBloomPass(new THREE.Vector2(SIZE, SIZE), 0.82, 0.55, 0.62);
  composer.addPass(bloom);
}
const TiltShader = {
  uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() }, uFocus: { value: 0.5 }, uWidth: { value: 0.12 }, uMax: { value: 6 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir; uniform float uFocus, uWidth, uMax; varying vec2 vUv;
    void main(){ float d = abs(vUv.y - uFocus); float r = uMax * smoothstep(uWidth, uWidth + 0.36, d);
      vec4 s = vec4(0.0); float ws = 0.0;
      for (int i = -7; i <= 7; i++) { float w = exp(-float(i*i) / 24.0); s += texture2D(tDiffuse, vUv + uDir * float(i) * r / 7.0) * w; ws += w; }
      gl_FragColor = s / ws; }`,
};
tiltH = new ShaderPass(TiltShader); tiltV = new ShaderPass(TiltShader);
tiltH.uniforms.uDir.value.set(1 / SIZE, 0); tiltV.uniforms.uDir.value.set(0, 1 / SIZE);
for (const p of [tiltH, tiltV]) { p.uniforms.uFocus.value = NEON ? 0.5 : 0.52; p.uniforms.uWidth.value = NEON ? 0.2 : 0.13; p.uniforms.uMax.value = NEON ? 3.5 : 7.5; }
composer.addPass(tiltH); composer.addPass(tiltV);
composer.addPass(new OutputPass());
grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSat: { value: NEON ? 1.08 : 1.14 }, uVig: { value: NEON ? 0.55 : 0.32 }, uHaze: { value: new THREE.Color(NEON ? 0x141a40 : 0xfff2dc) }, uHazeAmt: { value: NEON ? 0.18 : 0.1 }, uTime: { value: 0 }, uWarm: { value: NEON ? 0 : 1 } },
  vertexShader: TiltShader.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uVig, uHazeAmt, uTime, uWarm; uniform vec3 uHaze; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(l), c, uSat);
      c = mix(c, c * vec3(1.03, 1.0, 0.96), uWarm);
      c = mix(c, max(c, uHaze), uHazeAmt * smoothstep(0.45, 1.0, vUv.y));
      vec2 q = vUv - 0.5; c *= 1.0 - uVig * dot(q, q) * 1.6;
      c += (h(vUv * 1000.0) - 0.5) * 0.012;
      gl_FragColor = vec4(c, 1.0); }`,
});
composer.addPass(grade);

// ============================================================ per-frame update
const TARGET = P(0, -13, 0);
function setCamera(t) {
  const e = THREE.MathUtils.degToRad(NEON ? 36 : 34);
  const az = THREE.MathUtils.degToRad(45 + (t / 3 - 0.5) * (NEON ? 5 : 7));
  const zoom = NEON ? 1.0 + 0.05 * smooth(0, 3, t) : 1.0 + 0.035 * (t / 3);
  const half = (NEON ? 45 : 44.5) / zoom;
  camera.left = -half; camera.right = half; camera.top = half; camera.bottom = -half;
  camera.position.set(TARGET.x + Math.cos(e) * Math.cos(az) * 200, TARGET.y + Math.sin(e) * 200, TARGET.z + Math.cos(e) * Math.sin(az) * 200);
  camera.up.set(0, 1, 0); camera.lookAt(TARGET); camera.near = 1; camera.far = 600; camera.updateProjectionMatrix();
  if (sun) { sun.position.set(TARGET.x - 70, 110, TARGET.z + 25); sun.target.position.copy(TARGET); }
}

const tmpC = new THREE.Color();
function updateNeon(t) {
  for (const tb of neonTubes) {
    const ig = tb.ig; const on = igOn(ig, t);
    tb.mat.uniforms.uOn.value = on * (1 + 0.04 * Math.sin(t * 50 + ig.seed));
    tb.mat.uniforms.uTrace.value = clamp((t - ig.t0) / (ig.dur || 0.5), 0, 1);
  }
  for (const b of bulbSets) {
    const { im, cols, ig, o, n } = b; const gain = o.gain ?? 2.4;
    for (let i = 0; i < n; i++) {
      let on, ord = o.order ? o.order(i) : i / n;
      if (b.t0s) { on = flick(t - b.t0s[i], i * 0.37); }
      else { on = igOn(ig, t); const tr = clamp((t - ig.t0) / (ig.dur || 0.5), 0, 1); if (ord > tr + 1e-4) on = 0; else if (ord > tr - 0.04 && tr < 1) on *= 2.2; }
      let pat = 1;
      if (o.chase) { const ph = ((ord * o.chase - t * (o.chaseSpeed ?? 1)) % 1 + 1) % 1; pat = ph < 0.5 ? 1 : 0.3; }
      else if (o.radial) { const ph = (((i % o.radial) / o.radial - t * 0.9) % 1 + 1) % 1; pat = 0.35 + 0.65 * (ph < 0.3 ? 1 : 0); }
      else if (o.twinkle) pat = 0.55 + 0.45 * Math.sin(t * 6 + i * 2.39);
      else if (o.blink) pat = (t * 1.5) % 1 < 0.5 ? 1 : 0.15;
      tmpC.copy(cols[i]).multiplyScalar(on * pat * gain * (o.dim ?? 1));
      im.setColorAt(i, tmpC);
    }
    im.instanceColor.needsUpdate = true;
  }
  let pi = 0;
  for (const L of lamps) {
    const on = igOn(L.ig, t);
    L.l.intensity = L.intensity * on * (0.95 + 0.05 * Math.sin(t * 9 + L.pos.x));
    if (pi < POOLS) { poolPos[pi].set(L.pos.x, 0, L.pos.z, 60 / (L.dist * L.dist)); poolCol[pi].set(L.color.r, L.color.g, L.color.b, on * 0.32); pi++; }
  }
  // sparks
  const d = (t - ctx.SPARK_T0) * ctx.SPARK_SPEED;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V();
  let k = 0;
  for (const sd of sparkData) {
    const L = sd.e.line; const along = d - sd.start;
    for (let j = 0; j < ctx.N_TRAIL; j++) {
      const s = along - j * 0.9; let vis = s >= 0 && s <= L.length && t < 2.4;
      const ss = sd.fwd ? s : L.length - s;
      L.at(clamp(ss, 0, L.length), p); p.y = 0.45;
      const sz = vis ? (j === 0 ? 0.34 : 0.2 * (1 - j / ctx.N_TRAIL)) : 0;
      m4.compose(p, q, V(sz, sz, sz)); sparkIM.setMatrixAt(k, m4);
      tmpC.setRGB(1, 0.78, 0.45).multiplyScalar(j === 0 ? 7 : 3 * (1 - j / ctx.N_TRAIL)); sparkIM.setColorAt(k, tmpC); k++;
      if (j === 0 && vis && pi < POOLS) { poolPos[pi].set(p.x, 0, p.z, 0.9); poolCol[pi].set(1, 0.75, 0.45, 0.9); pi++; }
    }
  }
  sparkIM.instanceMatrix.needsUpdate = true; sparkIM.instanceColor.needsUpdate = true;
  for (; pi < POOLS; pi++) poolCol[pi].set(0, 0, 0, 0);
  for (const m of groundMats) m.uniforms.uTime.value = t;
  for (const gf of glowFollows) gf.mat.color.copy(gf.c).multiplyScalar(igOn(gf.ig, t));
}

window.renderFrame = (t) => {
  setCamera(t);
  for (const f of anims) f(t);
  if (!NEON) {
    U.uFront.value = frontAt(t);
    const lineVis = t < 2.2; for (const l of bpLines) l.visible = lineVis;
    root.traverse(o => { if (o.userData.balloonStrings) o.visible = t > 1.75; });
    gtao.blendIntensity = smooth(1.2, 1.9, t);
    renderer.toneMappingExposure = lerp(0.95, 1.05, smooth(0.5, 1.8, t));
  } else {
    updateNeon(t);
    // reflection pass: mirror the world about y=0
    const hide = [g.ground, g.pathMesh, g.water]; hide.forEach(o => o.visible = false);
    root.scale.y = -1; root.updateMatrixWorld(true);
    for (const L of lamps) L.l.position.y = -L.pos.y;
    renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
    root.scale.y = 1; root.updateMatrixWorld(true);
    for (const L of lamps) L.l.position.y = L.pos.y;
    hide.forEach(o => o.visible = true);
  }
  grade.uniforms.uTime.value = t;
  composer.render();
  return renderer.domElement.toDataURL('image/png');
};

try { renderer.compile(scene, camera); window.__ready = true; } catch (e) { window.__err = String(e && e.stack || e); }
