import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const Q = new URLSearchParams(location.search);
const STYLE = Q.get('style') || 'tin';
const TIN = STYLE === 'tin', FELT = !TIN;
const SIZE = 1080;

// ---------------------------------------------------------------- utils
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const eOutCubic = x => 1 - Math.pow(1 - clamp(x), 3);
const eOutBack = (x, s = 1.70158) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const eOutBounce = x => { x = clamp(x); const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
const spring = (x, k = 5, w = 9) => x <= 0 ? 0 : 1 - Math.exp(-k * x) * Math.cos(w * x);
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(TIN ? 7 : 11);
const rr = (a, b) => a + (b - a) * R();
const pick = a => a[Math.floor(R() * a.length)];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- palette
const PAL = TIN ? {
  red: '#c63a2c', cream: '#f2e4c4', teal: '#2f8088', mustard: '#e3a537', navy: '#233a66',
  green: '#4f8a3c', pink: '#d9737f', sky: '#5fa2c8', orange: '#e0702e', brown: '#8a5a33', white: '#f6efe0', purple: '#6b4c8a'
} : {
  red: '#d65a4a', cream: '#f3e6cc', teal: '#3f948f', mustard: '#e8a93a', navy: '#41609a',
  green: '#78a450', pink: '#ec8a9b', sky: '#6aa6d6', orange: '#e98443', brown: '#9a6c48', white: '#f8f0e2', purple: '#9a7cc0'
};
const BRIGHTS = ['red', 'teal', 'mustard', 'navy', 'pink', 'sky', 'orange', 'green', 'purple'].map(k => PAL[k]);

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = TIN ? 0.92 : 0.86;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(TIN ? '#3a2618' : '#4a3424');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = TIN ? 0.6 : 0.25;

// ---------------------------------------------------------------- textures
const texCache = {};
function canvasTex(key, w, h, draw, srgb = true) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  texCache[key] = t; return t;
}
function star(g, x, y, r, n = 5) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, rr2 = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  g.closePath(); g.fill();
}
function drawPattern(g, s, base, acc, pattern) {
  g.fillStyle = base; g.fillRect(0, 0, s, s); g.fillStyle = acc; g.strokeStyle = acc;
  const n = 8;
  if (pattern === 'stripes') for (let i = 0; i < n; i += 2) g.fillRect(i * s / n, 0, s / n, s);
  else if (pattern === 'hstripes') for (let i = 0; i < n; i += 2) g.fillRect(0, i * s / n, s, s / n);
  else if (pattern === 'wide') for (let i = 0; i < 4; i += 2) g.fillRect(i * s / 4, 0, s / 4, s);
  else if (pattern === 'dots') { for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { g.beginPath(); g.arc((i + 0.5 + (j % 2) * 0.5) * s / 6, (j + 0.5) * s / 6, s / 30, 0, 7); g.fill(); } }
  else if (pattern === 'check') { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) g.fillRect(i * s / n, j * s / n, s / n, s / n); }
  else if (pattern === 'stars') { for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) star(g, (i + 0.5 + (j % 2) * 0.5) * s / 5, (j + 0.5) * s / 5, s / 22); }
  else if (pattern === 'diamond') { for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const x = i * s / 4, y = j * s / 4, d = s / 9; g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.fill(); } }
  else if (pattern === 'scallop') { g.fillRect(0, s * 0.6, s, s * 0.4); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i + 0.5) * s / 6, s * 0.6, s / 12, 0, Math.PI); g.fill(); } }
  else if (pattern === 'gears') {
    for (const [x, y, r] of [[0.3, 0.32, 0.2], [0.7, 0.62, 0.17], [0.28, 0.78, 0.12], [0.75, 0.18, 0.1]]) {
      g.beginPath(); const T = 14;
      for (let i = 0; i < T * 2; i++) { const a = i * Math.PI / T, rr2 = (i % 2 ? 0.82 : 1) * r * s; g.lineTo(x * s + Math.cos(a) * rr2, y * s + Math.sin(a) * rr2); }
      g.fill(); g.fillStyle = base; g.beginPath(); g.arc(x * s, y * s, r * s * 0.3, 0, 7); g.fill(); g.fillStyle = acc;
    }
  }
  else if (pattern === 'bricks') { g.lineWidth = s / 90; for (let j = 0; j < 8; j++) { g.beginPath(); g.moveTo(0, j * s / 8); g.lineTo(s, j * s / 8); g.stroke(); for (let i = 0; i < 4; i++) { const x = (i + (j % 2) * 0.5) * s / 4; g.beginPath(); g.moveTo(x, j * s / 8); g.lineTo(x, (j + 1) * s / 8); g.stroke(); } } }
}
// worn tin: returns {map, mr}
function wearSpots(seed, s, count, edge) {
  const r = rng(seed), out = [];
  for (let i = 0; i < count; i++) {
    let x = r() * s, y = r() * s;
    if (edge && r() < 0.8) { const side = Math.floor(r() * 4), e = r() * s * 0.045; if (side === 0) x = e; else if (side === 1) x = s - e; else if (side === 2) y = e; else y = s - e; }
    out.push([x, y, (0.5 + r() * 2.2) * s / 256, r()]);
  }
  return out;
}
function tinTextures(base, acc, pattern, border = true) {
  const key = `tin|${base}|${acc}|${pattern}|${border}`;
  const s = 256, spots = wearSpots(key.length * 31 + base.charCodeAt(1) * 7 + (acc.charCodeAt(2) || 0), s, 170, true);
  const map = canvasTex(key, s, s, (g) => {
    drawPattern(g, s, base, acc, pattern);
    if (border) { g.strokeStyle = pattern === 'plain' ? acc : PAL.cream; g.lineWidth = 5; g.strokeRect(9, 9, s - 18, s - 18); g.strokeStyle = PAL.navy; g.lineWidth = 2; g.strokeRect(15, 15, s - 30, s - 30); }
    // printed halftone grain
    const r = rng(5); g.globalAlpha = 0.06;
    for (let i = 0; i < 1400; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * s, r() * s, 1.5, 1.5); }
    g.globalAlpha = 1;
    // grime toward edges
    const gr = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.75); gr.addColorStop(0, 'rgba(60,40,20,0)'); gr.addColorStop(1, 'rgba(60,40,20,0.25)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (const [x, y, rad] of spots) { g.fillStyle = '#c9c4b8'; g.beginPath(); g.ellipse(x, y, rad * 1.4, rad, rad, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(210,205,195,0.55)'; g.lineWidth = 0.8;
    for (let i = 0; i < 10; i++) { const x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-30, 30), y + rr(-12, 12)); g.stroke(); }
  });
  const mr = canvasTex(key + '|mr', s, s, (g) => {
    g.fillStyle = 'rgb(0,110,90)'; g.fillRect(0, 0, s, s);
    for (const [x, y, rad] of spots) { g.fillStyle = 'rgb(0,60,255)'; g.beginPath(); g.ellipse(x, y, rad * 1.4, rad, rad, 0, 7); g.fill(); }
  }, false);
  return { map, mr };
}
function woodTex(base, key = 'wood', s = 256, dark = 0.18) {
  return canvasTex(`wood|${base}|${key}`, s, s, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const r = rng(base.charCodeAt(2) * 13 + key.length);
    for (let i = 0; i < 60; i++) {
      const y = r() * s; g.strokeStyle = `rgba(60,30,10,${r() * dark})`; g.lineWidth = r() * 2.5 + 0.5;
      g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3 + (r() - 0.5) * 2); g.stroke();
    }
    g.globalAlpha = 0.08; for (let i = 0; i < 800; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * s, r() * s, 2, 1); } g.globalAlpha = 1;
  });
}
function feltOverlay(g, s, seed, amt = 1) {
  const r = rng(seed);
  for (let i = 0; i < 2600 * amt * (s / 256) ** 2; i++) {
    const x = r() * s, y = r() * s, a = r() * 6.3, l = 3 + r() * 9;
    g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.08})` : `rgba(40,20,10,${0.04 + r() * 0.07})`;
    g.lineWidth = 0.7 + r() * 0.8; g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.6, y + Math.sin(a + 1) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}
function feltTex(base, acc, pattern) {
  return canvasTex(`felt|${base}|${acc}|${pattern}`, 256, 256, (g, s) => {
    drawPattern(g, s, base, acc || base, pattern || 'plain');
    if (pattern && pattern !== 'plain' && pattern.includes('stripe')) { // stitch lines at seams
      g.strokeStyle = 'rgba(255,250,240,0.7)'; g.lineWidth = 1.6; g.setLineDash([5, 5]);
      const n = pattern === 'wide' ? 4 : 8;
      for (let i = 1; i < n; i++) { g.beginPath(); if (pattern === 'hstripes') { g.moveTo(0, i * s / n); g.lineTo(s, i * s / n); } else { g.moveTo(i * s / n, 0); g.lineTo(i * s / n, s); } g.stroke(); }
      g.setLineDash([]);
    }
    feltOverlay(g, s, base.charCodeAt(1) * 17 + (acc || '').length);
  });
}
const bumpNoise = canvasTex('bump', 256, 256, (g, s) => { g.fillStyle = '#808080'; g.fillRect(0, 0, s, s); feltOverlay(g, s, 99, 3); }, false);

// ---------------------------------------------------------------- materials
const matCache = {};
function mat(color, o = {}) {
  const pattern = o.pattern || 'plain', acc = o.acc || PAL.cream, kind = o.kind || 'tin';
  const key = `${color}|${acc}|${pattern}|${kind}|${o.rep || 1}|${o.border}`;
  if (matCache[key]) return matCache[key];
  let m;
  if (FELT) {
    if (kind === 'metal' || kind === 'brass') color = kind === 'brass' ? PAL.mustard : '#c9c2b8';
    const map = feltTex(color, acc, pattern === 'gears' ? 'plain' : pattern);
    if (o.rep) { /* repeat handled by clone */ }
    m = new THREE.MeshPhysicalMaterial({ map, roughness: 1, metalness: 0, bumpMap: bumpNoise, bumpScale: 2.5,
      sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff4e6'), 0.35) });
  } else if (kind === 'tin') {
    const { map, mr } = tinTextures(color, acc, pattern, o.border !== false);
    m = new THREE.MeshStandardMaterial({ map, metalnessMap: mr, roughnessMap: mr, metalness: 1, roughness: 1, envMapIntensity: 1 });
  } else if (kind === 'metal') {
    m = new THREE.MeshStandardMaterial({ color: color || '#c8c6c0', metalness: 1, roughness: 0.28 });
  } else if (kind === 'brass') {
    m = new THREE.MeshStandardMaterial({ color: '#d6a54b', metalness: 1, roughness: 0.25 });
  } else if (kind === 'wood') { // painted wood
    m = new THREE.MeshStandardMaterial({ map: woodTex(color, 'p', 256, 0.12), roughness: 0.55, metalness: 0 });
  } else if (kind === 'rawwood') {
    m = new THREE.MeshStandardMaterial({ map: woodTex(color, 'r', 256, 0.35), roughness: 0.7, metalness: 0 });
  } else if (kind === 'gloss') {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.0 });
  }
  matCache[key] = m; return m;
}

// ---------------------------------------------------------------- geometry helpers
const geoCache = {};
function rbox(w, h, d, r) {
  const k = `rb${w},${h},${d},${r}`;
  if (geoCache[k]) return geoCache[k];
  const mn = Math.min(w, h, d);
  r = r ?? (FELT ? mn * 0.32 : mn * 0.12);
  return (geoCache[k] = new RoundedBoxGeometry(w, h, d, FELT ? 3 : 2, Math.min(r, mn * 0.49)));
}
function mesh(geo, m, cast = true) { const x = new THREE.Mesh(geo, m); x.castShadow = cast; x.receiveShadow = true; return x; }
function add(parent, obj, x = 0, y = 0, z = 0) { obj.position.set(x, y, z); parent.add(obj); return obj; }
function cyl(rt, rb, h, seg = 16, open = false) { return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); }
function sph(r, seg = 16) { return new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)); }
// a rod between two points
function rod(p, q, r, m, seg = 8) {
  const d = q.clone().sub(p), L = d.length();
  const x = mesh(cyl(r, r, L, seg), m);
  x.position.copy(p).addScaledVector(d, 0.5);
  x.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return x;
}
const rivetGeo = sph(0.07, 8);
function rivets(parent, pts) { if (!TIN) return; for (const p of pts) { const r = mesh(rivetGeo, mat(null, { kind: 'metal' }), false); r.position.copy(p); parent.add(r); } }
function ring(n, r, y, f) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push(f ? f(a) : V(Math.cos(a) * r, y, Math.sin(a) * r)); } return out; }

// ---------------------------------------------------------------- park registry
const parts = [];        // transformation parts
const anims = [];        // per-frame alive animation fns: f(tA, t)
function part(obj, x, z, o = {}) {
  const w = new THREE.Group(); w.position.set(x, 0, z); w.add(obj);
  scene.add(w);
  const p = { w, obj, home: w.position.clone(), kind: o.kind || 'ride', delay: o.delay ?? 0.5, lay: o.lay ?? 1, mode: o.mode || 'lay', unfold: o.unfold, idx: parts.length };
  parts.push(p); return p;
}

// ---------------------------------------------------------------- ground / room
const PARK = 16;
const ringPath = { cx: 0, cz: -0.5, hx: 10, hz: 8.7, r: 3.2 };
function roundRectPoint(u) { // u in [0,1)
  const { cx, cz, hx, hz, r } = ringPath;
  const sx = 2 * (hx - r), sz = 2 * (hz - r), arc = Math.PI * r / 2, L = 2 * sx + 2 * sz + 4 * arc;
  let d = ((u % 1) + 1) % 1 * L;
  const segs = [
    [sx, s => [cx - hx + r + s, cz + hz]],
    [arc, s => { const a = Math.PI / 2 - s / r; return [cx + hx - r + Math.cos(a) * r, cz + hz - r + Math.sin(a) * r]; }],
    [sz, s => [cx + hx, cz + hz - r - s]],
    [arc, s => { const a = -s / r; return [cx + hx - r + Math.cos(a) * r, cz - hz + r + Math.sin(a) * r]; }],
    [sx, s => [cx + hx - r - s, cz - hz]],
    [arc, s => { const a = -Math.PI / 2 - s / r; return [cx - hx + r + Math.cos(a) * r, cz - hz + r + Math.sin(a) * r]; }],
    [sz, s => [cx - hx, cz - hz + r + s]],
    [arc, s => { const a = Math.PI - s / r; return [cx - hx + r + Math.cos(a) * r, cz + hz - r + Math.sin(a) * r]; }],
  ];
  for (const [l, f] of segs) { if (d <= l) return f(d); d -= l; }
  return segs[0][1](0);
}
const ringLen = (() => { const { hx, hz, r } = ringPath; return 4 * (hx - r) + 4 * (hz - r) + 2 * Math.PI * r; })();
const spurs = [ // [x1,z1,x2,z2]
  [0, 8.2, 0, 16], [-10, -6, -11.5, -9.5], [10, -7, 12, -9.8], [-10, 0.5, -10.6, 0.5], [10, -1.5, 10.5, -1.5],
  [-7, 8.2, -9, 9.5], [7, 8.2, 9, 9.6], [-10, 3, -15.5, 3.5], [10, 3, 15.5, 4]
];
function drawPaths(g, S, col, edge, w = 2.3) {
  const P = (x, z) => [(x + PARK) / (2 * PARK) * S, (z + PARK) / (2 * PARK) * S];
  for (const [lw, c] of [[w + 0.35, edge], [w, col]]) {
    g.strokeStyle = c; g.lineWidth = lw / (2 * PARK) * S; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); for (let i = 0; i <= 200; i++) { const [x, z] = roundRectPoint(i / 200); const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); } g.stroke();
    for (const [x1, z1, x2, z2] of spurs) { g.beginPath(); g.moveTo(...P(x1, z1)); g.lineTo(...P(x2, z2)); g.stroke(); }
    // plaza at gate and around motor
    g.fillStyle = c; g.beginPath(); g.ellipse(...P(0, 12.8), (lw * 1.6) / (2 * PARK) * S, (lw * 1.1) / (2 * PARK) * S, 0, 0, 7); g.fill();
  }
}

let box = null; // tin toy box parts
function buildGround() {
  if (TIN) {
    const floorTex = canvasTex('floor', 1024, 1024, (g, s) => {
      const r = rng(3);
      for (let i = 0; i < 8; i++) {
        const c = ['#7a4a2a', '#83522e', '#6e4024', '#8c5a34'][i % 4]; g.fillStyle = c; g.fillRect(0, i * s / 8, s, s / 8);
        for (let k = 0; k < 40; k++) { const y = i * s / 8 + r() * s / 8; g.strokeStyle = `rgba(40,20,8,${r() * 0.25})`; g.lineWidth = r() * 2 + 0.5; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 32) g.lineTo(x, y + Math.sin(x / 90 + k) * 3); g.stroke(); }
        g.fillStyle = 'rgba(25,12,5,0.7)'; g.fillRect(0, i * s / 8, s, 3);
        const off = r() * s; g.fillRect(off, i * s / 8, 3, s / 8);
      }
    });
    floorTex.repeat.set(6, 6);
    const floor = mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0 }), false);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.52; scene.add(floor);
    const rugTex = canvasTex('rug', 1024, 1024, (g, s) => {
      g.fillStyle = '#7d2622'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#1f2d4d'; g.fillRect(30, 30, s - 60, s - 60);
      g.fillStyle = '#d9b77a'; g.fillRect(70, 70, s - 140, s - 140);
      g.fillStyle = '#8e2b25'; g.fillRect(90, 90, s - 180, s - 180);
      g.fillStyle = '#d9b77a'; for (let i = 0; i < 24; i++) { star(g, 50 + i * (s - 100) / 23, 50, 12, 4); star(g, 50 + i * (s - 100) / 23, s - 50, 12, 4); star(g, 50, 50 + i * (s - 100) / 23, 12, 4); star(g, s - 50, 50 + i * (s - 100) / 23, 12, 4); }
      g.fillStyle = '#1f2d4d'; g.beginPath(); g.moveTo(s / 2, 180); g.lineTo(s - 180, s / 2); g.lineTo(s / 2, s - 180); g.lineTo(180, s / 2); g.fill();
      g.fillStyle = '#d9b77a'; g.beginPath(); g.moveTo(s / 2, 260); g.lineTo(s - 260, s / 2); g.lineTo(s / 2, s - 260); g.lineTo(260, s / 2); g.fill();
      g.fillStyle = '#7d2622'; g.beginPath(); g.arc(s / 2, s / 2, 120, 0, 7); g.fill();
      for (const [x, y] of [[180, 180], [s - 180, 180], [180, s - 180], [s - 180, s - 180]]) { g.fillStyle = '#1f2d4d'; g.beginPath(); g.arc(x, y, 60, 0, 7); g.fill(); g.fillStyle = '#d9b77a'; star(g, x, y, 40, 8); }
      const r = rng(8); for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,230,200'},${r() * 0.12})`; g.fillRect(r() * s, r() * s, 2, 2); }
    });
    const rug = mesh(new THREE.PlaneGeometry(62, 48), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95, bumpMap: bumpNoise, bumpScale: 3 }), false);
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, -0.5, 1); scene.add(rug);
    // toy box: base = park board
    const baseTop = canvasTex('basetop', 2048, 2048, (g, S) => {
      g.fillStyle = '#4a8236'; g.fillRect(0, 0, S, S);
      const r = rng(4); // printed grass pattern: little tufts and flowers
      for (let i = 0; i < 2200; i++) { const x = r() * S, y = r() * S; g.fillStyle = r() < 0.7 ? 'rgba(40,90,35,0.6)' : (r() < 0.5 ? '#f2e4c4' : '#e3a537'); if (g.fillStyle.startsWith('rgba')) { g.fillRect(x, y, 3, 9); g.fillRect(x + 5, y + 2, 3, 7); } else { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } }
      drawPaths(g, S, '#e6cf9c', '#a8643a');
      // brick print on paths
      g.globalCompositeOperation = 'source-atop';
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = PAL.red; g.lineWidth = 26; g.strokeRect(13, 13, S - 26, S - 26);
      g.strokeStyle = PAL.cream; g.lineWidth = 8; g.strokeRect(34, 34, S - 68, S - 68);
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`; g.fillRect(r() * S, r() * S, 3, 3); }
      for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(200,196,186,0.8)'; const e = r() * 30; const side = Math.floor(r() * 4); const p = r() * S; const [x, y] = side === 0 ? [e, p] : side === 1 ? [S - e, p] : side === 2 ? [p, e] : [p, S - e]; g.beginPath(); g.arc(x, y, r() * 5 + 1, 0, 7); g.fill(); }
    });
    const boardMat = new THREE.MeshStandardMaterial({ map: baseTop, metalness: 0.35, roughness: 0.5 });
    const top = mesh(new THREE.PlaneGeometry(32, 32), boardMat, false); top.rotation.x = -Math.PI / 2; top.position.y = 0.001; scene.add(top);
    const outer = mat(PAL.red, { kind: 'wood' });
    const baseBox = mesh(new THREE.BoxGeometry(32, 0.5, 32), outer); baseBox.position.y = -0.25; scene.add(baseBox);
    const inner = mat(PAL.sky, { acc: PAL.cream, pattern: 'scallop', border: false });
    const lidTex = canvasTex('lid', 1024, 1024, (g, s) => {
      g.fillStyle = PAL.red; g.fillRect(0, 0, s, s);
      g.fillStyle = PAL.cream; for (let i = 0; i < 24; i += 2) { g.beginPath(); g.moveTo(s / 2, s / 2); g.arc(s / 2, s / 2, s, i * Math.PI / 12, (i + 1) * Math.PI / 12); g.fill(); }
      g.fillStyle = PAL.navy; g.beginPath(); g.arc(s / 2, s / 2, 300, 0, 7); g.fill();
      g.fillStyle = PAL.mustard; g.beginPath(); g.arc(s / 2, s / 2, 280, 0, 7); g.fill();
      g.fillStyle = PAL.navy; for (let i = 0; i < 12; i++) star(g, s / 2 + Math.cos(i * Math.PI / 6) * 230, s / 2 + Math.sin(i * Math.PI / 6) * 230, 22);
      // stylised ferris wheel + coaster print
      g.strokeStyle = PAL.red; g.lineWidth = 14; g.beginPath(); g.arc(s / 2, s / 2 - 20, 150, 0, 7); g.stroke();
      g.lineWidth = 6; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(s / 2, s / 2 - 20); g.lineTo(s / 2 + Math.cos(i * Math.PI / 4) * 150, s / 2 - 20 + Math.sin(i * Math.PI / 4) * 150); g.stroke(); }
      g.fillStyle = PAL.teal; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(s / 2 + Math.cos(i * Math.PI / 4) * 150, s / 2 - 20 + Math.sin(i * Math.PI / 4) * 150, 22, 0, 7); g.fill(); }
      g.strokeStyle = PAL.navy; g.lineWidth = 12; g.beginPath(); g.moveTo(s / 2 - 260, s / 2 + 200); g.bezierCurveTo(s / 2 - 120, s / 2 + 40, s / 2 + 100, s / 2 + 300, s / 2 + 260, s / 2 + 120); g.stroke();
      g.strokeStyle = PAL.cream; g.lineWidth = 18; g.strokeRect(24, 24, s - 48, s - 48);
      g.strokeStyle = PAL.navy; g.lineWidth = 6; g.strokeRect(46, 46, s - 92, s - 92);
      const r = rng(2); for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(205,200,190,0.85)'; const e = r() * 18; const side = Math.floor(r() * 4); const p = r() * s; const [x, y] = side === 0 ? [e, p] : side === 1 ? [s - e, p] : side === 2 ? [p, e] : [p, s - e]; g.beginPath(); g.arc(x, y, r() * 4 + 1, 0, 7); g.fill(); }
    });
    const lidMat = new THREE.MeshStandardMaterial({ map: lidTex, metalness: 0.45, roughness: 0.38 });
    const H = 5, T = 0.4;
    const mkWall = (len, faceIdx) => { const ms = [outer, outer, outer, outer, outer, outer]; ms[faceIdx] = inner; return mesh(new THREE.BoxGeometry(len, H, T), ms); };
    const walls = [];
    const defs = [ // pivot pos, axis, sign
      { p: V(0, -0.5, PARK + T), ax: 'x', s: 1, len: 2 * PARK + 2 * T, rotY: 0 },
      { p: V(0, -0.5, -PARK - T), ax: 'x', s: -1, len: 2 * PARK + 2 * T, rotY: 0 },
      { p: V(-PARK - T, -0.5, 0), ax: 'z', s: 1, len: 2 * PARK, rotY: Math.PI / 2 },
      { p: V(PARK + T, -0.5, 0), ax: 'z', s: -1, len: 2 * PARK, rotY: Math.PI / 2 },
    ];
    for (const d of defs) {
      const pv = new THREE.Group(); pv.position.copy(d.p); scene.add(pv);
      const holder = new THREE.Group(); pv.add(holder);
      // build wall in holder with thickness toward park
      const wm = mkWall(d.len, 4); // +z face of box = inner (toward park after orientation below)
      if (d.ax === 'x') { wm.position.set(0, H / 2, -d.s * T / 2); if (d.s > 0) wm.rotation.y = Math.PI; }
      else { wm.rotation.y = d.s > 0 ? Math.PI / 2 : -Math.PI / 2; wm.position.set(d.s * T / 2, H / 2, 0); }
      holder.add(wm);
      walls.push({ pv, d });
    }
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, H, 0); walls[1].pv.add(lidPivot);
    const lidIn = new THREE.MeshStandardMaterial({ map: (() => { const t = tinTextures(PAL.navy, PAL.mustard, 'stars', false).map.clone(); t.needsUpdate = true; t.repeat.set(6, 6); return t; })(), metalness: 0.5, roughness: 0.4 });
    const lid = mesh(new THREE.BoxGeometry(2 * PARK + 2 * T, T, 2 * PARK + 2 * T), [outer, outer, lidMat, lidIn, outer, outer]);
    lid.position.set(0, T / 2, PARK + T); lidPivot.add(lid);
    box = { walls, lidPivot };
  } else {
    const tableTex = canvasTex('table', 1024, 1024, (g, s) => {
      const r = rng(6);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = ['#b98552', '#c08e5c', '#ad7a49'][i % 3]; g.fillRect(0, i * s / 6, s, s / 6);
        for (let k = 0; k < 50; k++) { const y = i * s / 6 + r() * s / 6; g.strokeStyle = `rgba(90,50,20,${r() * 0.22})`; g.lineWidth = r() * 2 + 0.5; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 32) g.lineTo(x, y + Math.sin(x / 120 + k) * 4); g.stroke(); }
        g.fillStyle = 'rgba(60,30,10,0.55)'; g.fillRect(0, i * s / 6, s, 3);
      }
    });
    tableTex.repeat.set(5, 5);
    const table = mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.6 }), false);
    table.rotation.x = -Math.PI / 2; table.position.y = -0.32; scene.add(table);
    const topTex = canvasTex('felttop', 2048, 2048, (g, S) => {
      g.fillStyle = PAL.green; g.fillRect(0, 0, S, S);
      const r = rng(12);
      for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,170,80,0.5)' : 'rgba(170,200,110,0.4)'; g.beginPath(); g.ellipse(r() * S, r() * S, 40 + r() * 120, 30 + r() * 80, r() * 3, 0, 7); g.fill(); }
      drawPaths(g, S, '#f1e2c3', '#d8c29a', 2.2);
      g.strokeStyle = 'rgba(255,250,235,0.8)'; g.lineWidth = 4; g.setLineDash([14, 12]);
      g.strokeRect(40, 40, S - 80, S - 80); g.setLineDash([]);
      // little felt flowers
      for (let i = 0; i < 260; i++) { const x = r() * S, y = r() * S; g.fillStyle = pick(['#f5ead4', '#f2a7b3', '#ebbd55', '#b39ad0']); for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 6, y + Math.sin(k * 1.26) * 6, 5, 0, 7); g.fill(); } g.fillStyle = '#ebbd55'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
      feltOverlay(g, S, 5, 1.2);
    });
    const sheet = mesh(rbox(32, 0.3, 32, 0.14), mat(PAL.green), false); sheet.position.y = -0.17; scene.add(sheet); sheet.userData.fuzz = 1;
    const topM = new THREE.MeshPhysicalMaterial({ map: topTex, roughness: 1, bumpMap: bumpNoise, bumpScale: 2, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#e8f0d0') });
    const top = mesh(new THREE.PlaneGeometry(31.7, 31.7, 1, 1), topM, false); top.rotation.x = -Math.PI / 2; top.position.y = 0.0; scene.add(top);
    top.userData.fuzz = 2;
    // yarn balls on the table
    for (const [x, z, c, r] of [[-19, 9, PAL.red, 1.6], [19.5, -4, PAL.sky, 1.3], [-18.5, -12, PAL.mustard, 1.2]]) {
      const yb = mesh(sph(r, 24), mat(c, { acc: PAL.white, pattern: 'hstripes' })); yb.position.set(x, -0.32 + r * 0.9, z); scene.add(yb);
    }
  }
}

// ---------------------------------------------------------------- guests (peg dolls / felt people)
const GUESTS = [];
let gBody, gHead;
function buildGuests() {
  const N = 200;
  const bodyG = TIN ? cyl(0.1, 0.17, 0.42, 10) : (() => { const g = sph(0.17, 10); g.scale(1, 1.35, 1); g.translate(0, 0.0, 0); return g; })();
  bodyG.translate(0, 0.21, 0);
  const headG = sph(TIN ? 0.13 : 0.14, 10); headG.translate(0, TIN ? 0.53 : 0.5, 0);
  gBody = new THREE.InstancedMesh(bodyG, TIN ? new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, map: woodTex('#ffffff', 'peg', 128, 0.08) }) : new THREE.MeshPhysicalMaterial({ roughness: 1, map: feltTex('#ffffff'), bumpMap: bumpNoise, bumpScale: 2, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }), N);
  gHead = new THREE.InstancedMesh(headG, TIN ? new THREE.MeshStandardMaterial({ roughness: 0.45, map: woodTex('#e8c49a', 'head', 128, 0.2) }) : new THREE.MeshPhysicalMaterial({ roughness: 1, map: feltTex('#f3d6bd'), sheen: 1, sheenColor: new THREE.Color('#fff') }), N);
  gBody.frustumCulled = gHead.frustumCulled = false;
  gBody.castShadow = gHead.castShadow = true; gBody.receiveShadow = gHead.receiveShadow = true;
  const skins = TIN ? ['#e8c49a', '#d9b089', '#c99a6e', '#efd3b0'] : ['#f3d6bd', '#e7bd9a', '#c99673', '#f6e0cc'];
  for (let i = 0; i < N; i++) {
    const g = { i };
    const r = R();
    if (r < 0.58) { g.type = 'ring'; g.u = R(); g.v = (R() < 0.5 ? 1 : -1) * rr(0.9, 1.4) / ringLen; g.off = rr(-0.8, 0.8); }
    else if (r < 0.88) { g.type = 'spur'; g.s = pick(spurs.slice(0, 7)); g.s = R() < 0.4 ? spurs[0] : g.s; g.u = R(); g.v = (R() < 0.5 ? 1 : -1) * rr(0.08, 0.14); g.off = rr(-0.7, 0.7); }
    else { g.type = 'mill'; const spots = [[0, 12.8], [-8, 2.8], [-11.5, -7.8], [12, -8.6], [-8.5, 8.8], [9, 8.8]]; const s = pick(spots); g.c = s; g.a = R() * 6.28; g.rad = rr(0.4, 1.3); g.va = rr(-0.6, 0.6); }
    g.phase = R() * 6.28; g.hop = rr(7, 10);
    g.launch = rr(0.62, 1.38); g.from = V(rr(-3, 3), 0.6, rr(-3, 3));
    g.flat = rr(0.35, 1.35);
    gBody.setColorAt(i, new THREE.Color(pick(BRIGHTS)));
    gHead.setColorAt(i, new THREE.Color(pick(skins)));
    GUESTS.push(g);
  }
  scene.add(gBody); scene.add(gHead);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function guestPos(g, tA) {
  let x, z, dir;
  if (g.type === 'ring') {
    const u = g.u + g.v * tA, [ax, az] = roundRectPoint(u), [bx, bz] = roundRectPoint(u + 0.002 * Math.sign(g.v));
    dir = Math.atan2(bx - ax, bz - az); const nx = -(bz - az), nz = bx - ax, nl = Math.hypot(nx, nz) || 1;
    x = ax + nx / nl * g.off; z = az + nz / nl * g.off;
  } else if (g.type === 'spur') {
    const [x1, z1, x2, z2] = g.s; let u = g.u + g.v * tA; u = u - Math.floor(u); const L = Math.hypot(x2 - x1, z2 - z1);
    const fw = g.v > 0; x = lerp(x1, x2, u) + (-(z2 - z1) / L) * g.off; z = lerp(z1, z2, u) + ((x2 - x1) / L) * g.off;
    dir = Math.atan2((x2 - x1) * (fw ? 1 : -1), (z2 - z1) * (fw ? 1 : -1));
  } else {
    const a = g.a + g.va * tA; x = g.c[0] + Math.cos(a) * g.rad; z = g.c[1] + Math.sin(a) * g.rad; dir = a + (g.va > 0 ? 0 : Math.PI);
  }
  return [x, z, dir];
}
function updateGuests(t, tA, moving) {
  for (const g of GUESTS) {
    const [x, z, dir] = guestPos(g, tA);
    let y = 0, sc = 1, tilt = 0, lay = 0, flat = 1;
    if (moving) { y = TIN ? Math.abs(Math.sin(tA * g.hop + g.phase)) * 0.12 : Math.abs(Math.sin(tA * g.hop + g.phase)) * 0.05; tilt = FELT ? Math.sin(tA * g.hop + g.phase) * 0.12 : 0; }
    _p.set(x, y, z);
    if (TIN) {
      const lt = (t - g.launch) / 0.42;
      if (lt < 0) { _p.copy(g.from); sc = 0.4; if (t < 0.3) sc = 0; }
      else if (lt < 1) { _p.lerpVectors(g.from, V(x, 0, z), lt); _p.y += 5 * lt * (1 - lt) + g.from.y * (1 - lt); sc = lerp(0.4, 1, eOutBack(lt)); tilt = (1 - lt) * 6; }
      else { const b = lt - 1; _p.y += Math.abs(Math.sin(b * 7)) * 0.25 * Math.exp(-b * 4); }
    } else {
      const lt = (t - g.flat) / 0.35;
      lay = lt < 0 ? 1 : 1 - eOutBack(lt, 2.2);
      flat = lt < 0 ? 0.15 : lerp(0.15, 1, clamp(spring(lt, 5, 10) * 1.0, 0, 1.3));
    }
    _q.setFromEuler(_e.set(lay * Math.PI / 2, dir * (1 - lay), tilt, 'XYZ'));
    _s.set(sc * (FELT ? 1 + (1 - flat) * 0.25 : 1), sc, sc * (FELT ? flat : 1));
    _m.compose(_p, _q, _s);
    gBody.setMatrixAt(g.i, _m); gHead.setMatrixAt(g.i, _m);
  }
  gBody.instanceMatrix.needsUpdate = gHead.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- coaster
const coaster = {};
function buildCoaster() {
  const Rl = 3.0, dl = 1.4;
  const pts = [[-8, 0.8, 2.5], [-8, 0.8, 0], [-8, 0.85, -2.5], [-7.2, 1.4, -5.2], [-5, 3.2, -6.6], [-2.6, 6.6, -6.9], [-0.6, 9.0, -6.9], [0.9, 9.3, -6.9],
    [2.6, 5.6, -6.9], [4.2, 1.6, -6.6], [6.4, 1.9, -5.2], [7.8, 3.6, -2.8], [8.2, 4.6, 0], [7.6, 3.4, 2.6], [6.4, 1.5, 4.3], [4.6, 0.8, 5], [3.0, 0.8, 5]];
  for (let k = 0; k <= 12; k++) { const th = k / 12 * Math.PI * 2; pts.push([-Rl * Math.sin(th), 0.8 + Rl * (1 - Math.cos(th)), 5 + dl * th / (Math.PI * 2)]); }
  pts.push([-3.0, 0.8, 6.4], [-5.0, 0.8, 6.2], [-7.0, 0.8, 5.4]);
  const curve = new THREE.CatmullRomCurve3(pts.map(p => V(...p)), true, 'centripetal');
  const N = 900, P = curve.getSpacedPoints(N).slice(0, N), L = curve.getLength();
  const T = [], S = [], U = [];
  for (let i = 0; i < N; i++) {
    const t = P[(i + 1) % N].clone().sub(P[(i - 1 + N) % N]).normalize();
    const p = P[i]; const inLoop = Math.abs(p.x) < Rl + 0.6 && p.z > 4.7 && p.z < 6.7 && p.y > 0.95;
    let s = inLoop ? V(0, 0, -1) : t.clone().cross(V(0, 1, 0));
    if (s.length() < 0.2) s = V(0, 0, -1);
    s.addScaledVector(t, -s.dot(t)).normalize();
    const u = s.clone().cross(t).normalize();
    T.push(t); S.push(s); U.push(u);
  }
  // smooth frames a little
  for (let it = 0; it < 4; it++) for (let i = 0; i < N; i++) { const a = S[(i - 1 + N) % N], b = S[(i + 1) % N]; S[i] = S[i].clone().multiplyScalar(2).add(a).add(b).normalize(); S[i].addScaledVector(T[i], -S[i].dot(T[i])).normalize(); U[i] = S[i].clone().cross(T[i]).normalize(); }
  Object.assign(coaster, { P, T, S, U, N, L, Rl });
  const gauge = 0.36, railR = TIN ? 0.08 : 0.12;
  const railMat = TIN ? mat('#d0cec8', { kind: 'metal' }) : null;
  const tieMat = TIN ? mat(PAL.red, { kind: 'tin', pattern: 'plain', border: false }) : mat(PAL.cream);
  const postMat = TIN ? mat(PAL.teal, { pattern: 'hstripes', acc: PAL.cream, border: false }) : mat(PAL.cream, { acc: PAL.red, pattern: 'hstripes' });
  const K = 10, sec = Math.floor(N / K);
  const yarn = (c1, c2, len) => { // felt: twisted yarn texture
    const base = canvasTex(`yarn|${c1}|${c2}`, 64, 64, (g, s) => { g.fillStyle = c1; g.fillRect(0, 0, s, s); g.strokeStyle = c2; g.lineWidth = 9; for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2 + s, s); g.stroke(); } feltOverlay(g, s, 3, 0.4); });
    const t = base.clone(); t.needsUpdate = true; t.repeat.set(Math.round(len * 3), 1);
    return new THREE.MeshPhysicalMaterial({ map: t, roughness: 1, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#fff'), bumpMap: bumpNoise, bumpScale: 1 });
  };
  for (let k = 0; k < K; k++) {
    const a = k * sec, b = k === K - 1 ? N : (k + 1) * sec;
    const c = V(0, 0, 0); for (let i = a; i < b; i++) c.add(P[i]); c.multiplyScalar(1 / (b - a)); c.y = 0;
    const g = new THREE.Group();
    for (const side of [1, -1]) {
      const rp = []; for (let i = a; i <= b; i++) { const j = i % N; rp.push(P[j].clone().addScaledVector(S[j], side * gauge).sub(c)); }
      const rc = new THREE.CatmullRomCurve3(rp);
      const len = rc.getLength();
      const m = TIN ? railMat : yarn(side > 0 ? PAL.red : PAL.red, PAL.white, len);
      g.add(mesh(new THREE.TubeGeometry(rc, (b - a) * 2, railR, TIN ? 6 : 7, false), m));
    }
    // ties
    const step = TIN ? 6 : 8; const nt = Math.ceil((b - a) / step);
    const tieGeo = TIN ? new THREE.BoxGeometry(0.11, 0.05, gauge * 2 + 0.26) : rbox(0.14, 0.09, gauge * 2 + 0.3, 0.04);
    const ties = new THREE.InstancedMesh(tieGeo, tieMat, nt); ties.castShadow = ties.receiveShadow = true;
    const mm = new THREE.Matrix4();
    for (let n = 0; n < nt; n++) { const j = a + n * step; mm.makeBasis(T[j], U[j], S[j]); mm.setPosition(P[j].clone().addScaledVector(U[j], -0.07).sub(c)); ties.setMatrixAt(n, mm); }
    g.add(ties);
    // spine plate (toy track) under ties
    // supports
    for (let i = a; i < b; i += 22) {
      const p = P[i]; const inLoop = Math.abs(p.x) < Rl + 0.4 && p.z > 4.6 && p.z < 6.8;
      if (inLoop || U[i].y < 0.5 || p.y < 0.4) continue;
      const top = p.clone().addScaledVector(U[i], -0.1);
      g.add(rod(V(top.x, 0, top.z).sub(c), top.clone().sub(c), TIN ? 0.07 : 0.09, postMat, 8));
      const foot = mesh(TIN ? cyl(0.2, 0.25, 0.12, 12) : sph(0.2, 10), TIN ? mat(PAL.navy, { pattern: 'plain', border: false }) : mat(PAL.mustard)); foot.position.set(top.x - c.x, 0.06, top.z - c.z); g.add(foot);
    }
    // loop support A-frame
    if (P.slice(a, b).some(p => Math.abs(p.x) < 0.3 && p.z > 4.8 && p.y > 6)) {
      const topY = 0.8 + 2 * Rl;
      for (const s of [-1, 1]) g.add(rod(V(s * 2.0, 0, 5.7).sub(c), V(0, 0.8 + Rl * 0.9, 5.7).sub(c), 0.08, postMat));
    }
    const pt = part(g, c.x, c.z, { kind: 'track', delay: 0.5 + k * 0.045, mode: 'squash' });
    pt.secIdx = k;
  }
  // station canopy + platform
  const st = new THREE.Group();
  st.add(add(st, mesh(rbox(1.5, 0.7, 5), TIN ? mat(PAL.mustard, { pattern: 'bricks', acc: PAL.red }) : mat(PAL.mustard)), -1.4, 0.35, 0));
  for (const [x, z] of [[-1.9, -2.2], [-1.9, 2.2], [0.9, -2.2], [0.9, 2.2]]) add(st, mesh(cyl(0.08, 0.08, 2.6, 8), TIN ? mat(PAL.cream, { pattern: 'hstripes', acc: PAL.red, border: false }) : mat(PAL.cream)), x, 1.3, z);
  const roof = mesh(rbox(3.4, 0.3, 5.2), TIN ? mat(PAL.red, { pattern: 'wide', acc: PAL.cream }) : mat(PAL.red, { pattern: 'wide', acc: PAL.cream }));
  add(st, roof, -0.5, 2.7, 0);
  rivets(st, ring(10, 0, 0, a => V(-0.5 + Math.cos(a) * 1.6, 2.87, Math.sin(a) * 2.4)));
  part(st, -8, 0, { kind: 'ride', delay: 0.78, lay: 1 });
  // train
  const train = new THREE.Group(); const cars = [];
  const carCols = [PAL.red, PAL.mustard, PAL.teal, PAL.navy, PAL.pink];
  for (let i = 0; i < 5; i++) {
    const car = new THREE.Group();
    const body = mesh(rbox(0.88, 0.42, 0.72), TIN ? mat(carCols[i], { pattern: i === 0 ? 'stars' : 'stripes', acc: PAL.cream }) : mat(carCols[i], { acc: PAL.white, pattern: 'hstripes' }));
    add(car, body, 0, 0.32, 0);
    if (i === 0) { // nose: toy train lamp + funnel
      add(car, mesh(cyl(0.16, 0.16, 0.2, 14), TIN ? mat(null, { kind: 'brass' }) : mat(PAL.mustard)), 0.47, 0.38, 0).rotation.z = Math.PI / 2;
      add(car, mesh(cyl(0.09, 0.13, 0.34, 12), TIN ? mat('#2a2a2a', { kind: 'metal' }) : mat(PAL.navy)), 0.25, 0.68, 0);
    }
    for (const sx of [-0.28, 0.28]) for (const sz of [-0.36, 0.36]) { const w = mesh(cyl(0.11, 0.11, 0.06, 12), mat('#3a3a3a', { kind: 'metal' })); w.rotation.x = Math.PI / 2; add(car, w, sx, 0.1, sz); }
    for (const sz of [-0.16, 0.16]) { // riders
      add(car, mesh(sph(0.13, 10), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), -0.1, 0.66, sz);
      add(car, mesh(cyl(0.11, 0.14, 0.2, 10), TIN ? mat(pick(BRIGHTS), { kind: 'wood' }) : mat(pick(BRIGHTS))), -0.1, 0.5, sz);
    }
    rivets(car, [V(0.3, 0.45, 0.37), V(-0.3, 0.45, 0.37), V(0.3, 0.2, 0.37), V(-0.3, 0.2, 0.37)]);
    car.scale.setScalar(1.25); train.add(car); cars.push(car);
  }
  coaster.cars = cars;
  coaster.trainPart = part(train, 0, 0, { kind: 'train', delay: 0.95, mode: 'squash' });
  // locate loop top index
  let best = -1; for (let i = 0; i < N; i++) if (Math.abs(P[i].x) < 1 && P[i].z > 4.8 && (best < 0 || P[i].y > P[best].y)) best = i;
  coaster.loopTop = best;
}
function trackAt(u) { // u = arc length
  const { P, T, S, U, N, L } = coaster; u = ((u % L) + L) % L; const f = u / L * N, i = Math.floor(f) % N, j = (i + 1) % N, w = f - Math.floor(f);
  return { p: P[i].clone().lerp(P[j], w), t: T[i].clone().lerp(T[j], w).normalize(), up: U[i].clone().lerp(U[j], w).normalize(), s: S[i].clone().lerp(S[j], w).normalize() };
}
// precompute train motion table
const START = TIN ? 1.8 : 1.5;
function speedAt(u, t) {
  const { p } = trackAt(u);
  let v = 3.5 + 3.2 * Math.sqrt(Math.max(0, 9.6 - p.y));
  if (p.z < -5.5 && p.x > -6.5 && p.x < 0.7) v = 3.2; // lift hill
  if (TIN) v *= 1 + 0.16 * Math.sin(t * Math.PI * 2 * 6);
  return v * smooth((t - START) / 0.45);
}
let trainTable;
function buildTrainTable() {
  const anchorT = 2.62, dt = 1 / 600; const { P, N, L } = coaster;
  const anchorU = coaster.loopTop / N * L + 1.0; // middle car at top
  const tab = new Map();
  let u = anchorU; for (let t = anchorT; t >= START - 0.01; t -= dt) { tab.set(Math.round(t * 600), u); u -= speedAt(u, t) * dt; }
  coaster.parkU = u;
  u = anchorU; for (let t = anchorT; t <= 3.2; t += dt) { tab.set(Math.round(t * 600), u); u += speedAt(u, t) * dt; }
  trainTable = tab;
}
function trainU(t) { if (t <= START) return coaster.parkU; return trainTable.get(Math.round(Math.min(t, 3.19) * 600)) ?? coaster.parkU; }
const _mb = new THREE.Matrix4();
function updateTrain(t) {
  const u0 = trainU(t);
  coaster.cars.forEach((car, i) => {
    const { p, t: tt, up, s } = trackAt(u0 - i * 1.22);
    _mb.makeBasis(tt, up, s); car.quaternion.setFromRotationMatrix(_mb);
    car.position.copy(p).addScaledVector(up, 0.02);
  });
}

// ---------------------------------------------------------------- rides
function ferris() {
  const g = new THREE.Group(); const hubY = 5.6, Rw = 4.4, n = 12;
  const legM = TIN ? mat(PAL.navy, { pattern: 'plain' }) : mat(PAL.navy);
  for (const z of [-0.9, 0.9]) for (const x of [-2.6, 2.6]) g.add(rod(V(x, 0, z * 1.3), V(0, hubY, z * 0.8), 0.13, legM));
  add(g, mesh(rbox(6.4, 0.35, 3.0), TIN ? mat(PAL.red, { pattern: 'check', acc: PAL.cream }) : mat(PAL.red)), 0, 0.17, 0);
  const wheel = new THREE.Group(); wheel.position.y = hubY; g.add(wheel);
  add(wheel, mesh(cyl(0.38, 0.38, 1.7, 16), TIN ? mat(null, { kind: 'brass' }) : mat(PAL.mustard)), 0, 0, 0).rotation.x = Math.PI / 2;
  const spokeM = TIN ? mat(PAL.cream, { pattern: 'plain', acc: PAL.red }) : mat(PAL.white);
  const rimM = TIN ? mat(PAL.red, { pattern: 'stripes', acc: PAL.cream, border: false }) : mat(PAL.pink, { acc: PAL.white, pattern: 'stripes' });
  const arms = [], gond = [];
  const segL = 2 * Rw * Math.sin(Math.PI / n);
  for (let i = 0; i < n; i++) {
    const arm = new THREE.Group(); wheel.add(arm); arms.push(arm);
    for (const z of [-0.6, 0.6]) {
      arm.add(rod(V(0, 0, z), V(Rw, 0, z), 0.06, spokeM, 6));
      const seg = rod(V(Rw, 0, z), V(Rw * Math.cos(2 * Math.PI / n), Rw * Math.sin(2 * Math.PI / n), z), 0.11, rimM, 8); arm.add(seg);
    }
    add(arm, mesh(sph(0.16, 10), TIN ? mat(null, { kind: 'brass' }) : mat(PAL.mustard)), Rw, 0, 0.75);
    add(arm, mesh(sph(0.16, 10), TIN ? mat(null, { kind: 'brass' }) : mat(PAL.mustard)), Rw, 0, -0.75);
    // gondola hangs from rim point
    const gd = new THREE.Group(); gd.position.set(Rw, 0, 0); arm.add(gd);
    const col = BRIGHTS[i % BRIGHTS.length];
    add(gd, mesh(rbox(0.75, 0.55, 0.85), TIN ? mat(col, { pattern: 'dots', acc: PAL.cream }) : mat(col)), 0, -0.6, 0);
    add(gd, mesh(cyl(0.05, 0.5, 0.3, 10), TIN ? mat(PAL.cream, { pattern: 'plain', acc: col }) : mat(PAL.white)), 0, -0.2, 0);
    add(gd, mesh(sph(0.1, 8), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), 0, -0.22, 0.15);
    gond.push(gd);
  }
  rivets(wheel, ring(8, 0, 0, a => V(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.87)));
  const p = part(g, -11.4, -11.2, { delay: 0.55, lay: -1 });
  g.rotation.y = 0.42;
  p.unfold = (k) => { arms.forEach((a, i) => { a.rotation.z = i / n * Math.PI * 2 * k; }); };
  p.unfold(1);
  anims.push((tA) => { const a = -clock(tA, 0.42); wheel.rotation.z = a; arms.forEach((arm, i) => { gond[i].rotation.z = -(a + arm.rotation.z) + Math.sin(tA * 3 + i) * 0.06; }); });
  p.wheel = wheel; p.arms = arms; p.gond = gond;
}
function dropTower() {
  const g = new THREE.Group(); const H = 13.5;
  add(g, mesh(cyl(1.6, 1.9, 0.5, 24), TIN ? mat(PAL.navy, { pattern: 'stars', acc: PAL.mustard }) : mat(PAL.navy)), 0, 0.25, 0);
  add(g, mesh(cyl(0.42, 0.5, H, 20), TIN ? mat(PAL.cream, { pattern: 'hstripes', acc: PAL.red, border: false }) : mat(PAL.cream, { pattern: 'hstripes', acc: PAL.red })), 0, H / 2, 0);
  add(g, mesh(cyl(0.2, 1.0, 1.0, 20), TIN ? mat(PAL.red, { pattern: 'stripes', acc: PAL.cream }) : mat(PAL.red)), 0, H + 0.4, 0);
  add(g, mesh(sph(0.3, 12), TIN ? mat(null, { kind: 'brass' }) : mat(PAL.mustard)), 0, H + 1.05, 0);
  const car = new THREE.Group(); g.add(car);
  add(car, mesh(new THREE.TorusGeometry(0.95, 0.24, 10, 28), TIN ? mat(PAL.mustard, { pattern: 'check', acc: PAL.navy, border: false }) : mat(PAL.mustard)), 0, 0, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    add(car, mesh(rbox(0.42, 0.5, 0.36), TIN ? mat(BRIGHTS[i], { pattern: 'plain', acc: PAL.cream }) : mat(BRIGHTS[i])), Math.cos(a) * 1.25, -0.15, Math.sin(a) * 1.25).rotation.y = -a;
    add(car, mesh(sph(0.11, 8), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), Math.cos(a) * 1.3, 0.22, Math.sin(a) * 1.3);
  }
  rivets(g, ring(12, 1.75, 0.5));
  part(g, 12, -11.6, { delay: 0.6, lay: -1 });
  anims.push((tA) => { // slow rise, quick drop
    const c = (tA * 0.55 + 0.62) % 1; let y;
    if (c < 0.62) y = lerp(1.2, H - 1.2, smooth(c / 0.62)); else if (c < 0.78) y = H - 1.2; else { const d = (c - 0.78) / 0.22; y = lerp(H - 1.2, 1.2, d * d); }
    car.position.y = tA <= 0 ? 1.2 : y; car.rotation.y = tA * 0.6;
  });
}
function carousel() {
  const g = new THREE.Group();
  add(g, mesh(cyl(2.6, 2.7, 0.45, 32), TIN ? mat(PAL.teal, { pattern: 'diamond', acc: PAL.mustard }) : mat(PAL.teal)), 0, 0.22, 0);
  const rot = new THREE.Group(); g.add(rot);
  add(rot, mesh(cyl(2.35, 2.35, 0.14, 32), TIN ? mat(PAL.cream, { pattern: 'check', acc: PAL.red, border: false }) : mat(PAL.cream)), 0, 0.5, 0);
  add(rot, mesh(cyl(0.45, 0.45, 3.0, 16), TIN ? mat(PAL.mustard, { pattern: 'stars', acc: PAL.red }) : mat(PAL.mustard)), 0, 2.0, 0);
  add(rot, mesh(new THREE.ConeGeometry(2.9, 1.7, 24, 1), TIN ? mat(PAL.red, { pattern: 'stripes', acc: PAL.cream, border: false }) : mat(PAL.red, { pattern: 'stripes', acc: PAL.cream })), 0, 4.15, 0);
  add(rot, mesh(cyl(2.9, 2.9, 0.4, 24, true), TIN ? mat(PAL.navy, { pattern: 'scallop', acc: PAL.mustard, border: false }) : mat(PAL.mustard)), 0, 3.15, 0);
  add(rot, mesh(sph(0.3, 12), TIN ? mat(null, { kind: 'brass' }) : mat(PAL.mustard)), 0, 5.1, 0);
  const flag = mesh(new THREE.BoxGeometry(0.6, 0.35, 0.03), mat(PAL.teal, { border: false })); add(rot, flag, 0.35, 5.55, 0);
  add(rot, mesh(cyl(0.03, 0.03, 0.9, 6), mat('#cccccc', { kind: 'metal' })), 0, 5.4, 0);
  const horses = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, r = 1.75;
    const hg = new THREE.Group(); hg.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); hg.rotation.y = -a; rot.add(hg);
    add(hg, mesh(cyl(0.035, 0.035, 2.7, 6), mat('#d8c48a', { kind: TIN ? 'brass' : 'tin' })), 0, 1.9, 0);
    const horse = new THREE.Group(); hg.add(horse); const col = [PAL.white, PAL.cream, PAL.pink, PAL.sky][i % 4];
    const hm = TIN ? mat(col, { pattern: 'plain', acc: PAL.red }) : mat(col);
    add(horse, mesh(rbox(0.22, 0.32, 0.72), hm), 0, 0, 0);
    const neck = add(horse, mesh(rbox(0.16, 0.42, 0.2), hm), 0, 0.24, 0.36); neck.rotation.x = 0.5;
    add(horse, mesh(rbox(0.16, 0.18, 0.34), hm), 0, 0.42, 0.5);
    add(horse, mesh(rbox(0.24, 0.08, 0.3), TIN ? mat(PAL.red, { pattern: 'plain', border: false }) : mat(PAL.red)), 0, 0.18, -0.05);
    for (const [x, z] of [[-0.08, 0.26], [0.08, 0.26], [-0.08, -0.26], [0.08, -0.26]]) { const l = add(horse, mesh(rbox(0.06, 0.34, 0.07), hm), x, -0.28, z); l.rotation.x = z > 0 ? -0.6 : 0.6; }
    horses.push(horse);
  }
  rivets(g, ring(16, 2.65, 0.46));
  part(g, -13, 0.6, { delay: 0.67, lay: 1 });
  anims.push((tA) => { rot.rotation.y = clock(tA, 0.9); horses.forEach((h, i) => { h.position.y = 1.35 + Math.sin(tA * 5 + i * 1.3) * 0.25 * clamp(tA * 3); }); flag.rotation.y = Math.sin(tA * 7) * 0.4; });
}
function swingRide() {
  const g = new THREE.Group();
  add(g, mesh(cyl(1.3, 1.5, 0.4, 24), TIN ? mat(PAL.purple, { pattern: 'stars', acc: PAL.mustard }) : mat(PAL.purple)), 0, 0.2, 0);
  add(g, mesh(cyl(0.3, 0.42, 6.6, 16), TIN ? mat(PAL.mustard, { pattern: 'hstripes', acc: PAL.navy, border: false }) : mat(PAL.mustard, { pattern: 'hstripes', acc: PAL.white })), 0, 3.5, 0);
  const top = new THREE.Group(); top.position.y = 6.8; g.add(top);
  add(top, mesh(new THREE.ConeGeometry(2.4, 1.2, 24), TIN ? mat(PAL.sky, { pattern: 'stripes', acc: PAL.cream, border: false }) : mat(PAL.sky, { pattern: 'stripes', acc: PAL.white })), 0, 0.5, 0);
  add(top, mesh(cyl(2.4, 2.4, 0.3, 24, true), TIN ? mat(PAL.red, { pattern: 'scallop', acc: PAL.cream, border: false }) : mat(PAL.pink)), 0, -0.05, 0);
  add(top, mesh(sph(0.25, 10), TIN ? mat(null, { kind: 'brass' }) : mat(PAL.mustard)), 0, 1.2, 0);
  const swings = [];
  const chainM = mat('#bbbbbb', { kind: 'metal' });
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    const piv = new THREE.Group(); piv.position.set(Math.cos(a) * 2.2, -0.1, Math.sin(a) * 2.2); piv.rotation.y = -a; top.add(piv);
    const arm = new THREE.Group(); piv.add(arm);
    add(arm, mesh(cyl(0.025, 0.025, 2.9, 4), chainM), 0, -1.45, 0);
    add(arm, mesh(rbox(0.34, 0.12, 0.3), TIN ? mat(BRIGHTS[i % 9], { pattern: 'plain' }) : mat(BRIGHTS[i % 9])), 0, -2.95, 0);
    add(arm, mesh(sph(0.1, 8), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), 0, -2.72, 0);
    add(arm, mesh(cyl(0.08, 0.1, 0.2, 8), TIN ? mat(BRIGHTS[(i + 3) % 9], { kind: 'wood' }) : mat(BRIGHTS[(i + 3) % 9])), 0, -2.86, 0);
    swings.push(arm);
  }
  part(g, 13, -1.6, { delay: 0.72, lay: 1 });
  anims.push((tA) => { const sp = clamp(tA / 0.8); top.rotation.y = clock(tA, 1.5); top.rotation.x = Math.sin(tA * 1.5) * 0.08 * sp; swings.forEach((s, i) => { s.rotation.z = 0.75 * sp + Math.sin(tA * 4 + i) * 0.04; }); });
}
function pirateShip() {
  const g = new THREE.Group(); const py = 5.0;
  const legM = TIN ? mat(PAL.navy, { pattern: 'plain', acc: PAL.mustard }) : mat(PAL.navy);
  for (const z of [-1.1, 1.1]) for (const x of [-2.1, 2.1]) g.add(rod(V(x, 0, z * 1.25), V(0, py, z), 0.12, legM));
  add(g, mesh(cyl(0.12, 0.12, 2.6, 10), mat(null, { kind: 'metal' })), 0, py, 0).rotation.x = Math.PI / 2;
  const sw = new THREE.Group(); sw.position.y = py; g.add(sw);
  const shape = new THREE.Shape(); shape.moveTo(-2.6, 0.2); shape.quadraticCurveTo(-1.6, -1.3, 0, -1.3); shape.quadraticCurveTo(1.6, -1.3, 2.6, 0.2); shape.lineTo(2.2, 0.55); shape.lineTo(-2.2, 0.55); shape.closePath();
  const hullG = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: true, bevelThickness: FELT ? 0.25 : 0.06, bevelSize: FELT ? 0.22 : 0.06, bevelSegments: FELT ? 4 : 1, curveSegments: 16 });
  hullG.translate(0, 0, -0.75);
  const hullM = TIN ? mat(PAL.red, { kind: 'tin', pattern: 'plain', border: false }) : mat(PAL.red);
  if (hullM.map) { /* extrude uvs are in shape units: scale texture */ }
  hullG.computeBoundingBox();
  const hull = mesh(hullG, hullM); hull.position.y = -3.4; sw.add(hull);
  add(sw, mesh(rbox(4.6, 0.22, 1.9), TIN ? mat(PAL.mustard, { pattern: 'check', acc: PAL.navy, border: false }) : mat(PAL.mustard)), 0, -2.75, 0);
  for (const x of [-2.5, 2.5]) add(sw, mesh(sph(0.22, 10), TIN ? mat(null, { kind: 'brass' }) : mat(PAL.mustard)), x, -2.7, 0);
  for (const z of [-0.6, 0.6]) for (const x of [-1.7, 1.7]) sw.add(rod(V(0, 0, z), V(x, -3.0, z), 0.07, mat(null, { kind: 'metal' })));
  add(sw, mesh(cyl(0.06, 0.06, 2.4, 8), TIN ? mat(PAL.brown, { kind: 'wood' }) : mat(PAL.brown)), 0, -2.3, 0);
  const sail = mesh(new THREE.BoxGeometry(1.4, 1.3, 0.04), TIN ? mat(PAL.cream, { pattern: 'hstripes', acc: PAL.red, border: false }) : mat(PAL.cream, { pattern: 'hstripes', acc: PAL.red })); add(sw, sail, 0, -2.1, 0);
  for (let i = 0; i < 6; i++) add(sw, mesh(sph(0.12, 8), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), -1.9 + i * 0.75 + (i > 2 ? 0.2 : -0.2), -2.72, (i % 2 ? 0.35 : -0.35));
  rivets(sw, [...Array(9)].map((_, i) => V(-2 + i * 0.5, -3.3, 0.85)));
  part(g, 11.6, 11.2, { delay: 0.83, lay: 1 }).obj.rotation.y = -0.15;
  anims.push((tA) => { sw.rotation.z = Math.sin(tA * 2.4) * 0.85 * clamp(tA / 1.2); });
}
function logFlume() {
  const g = new THREE.Group(); const rx = 3.9, rz = 2.4, n = 64;
  const path = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const x = Math.cos(a) * rx, z = Math.sin(a) * rz; const a2 = (a + Math.PI * 2 - 4.6) % (Math.PI * 2); let hgt = 0.45; if (a2 < 2.6) hgt = 0.45 + 2.8 * smooth(a2 / 2.6); else if (a2 < 3.2) hgt = 0.45 + 2.8 * (1 - smooth((a2 - 2.6) / 0.6)); path.push(V(x, hgt, z)); }
  // smooth heights
  for (let k = 0; k < 2; k++) { const ys = path.map(p => p.y); path.forEach((p, i) => p.y = (ys[(i - 1 + n) % n] + 2 * ys[i] + ys[(i + 1) % n]) / 4); }
  const curve = new THREE.CatmullRomCurve3(path, true);
  const trough = mat(TIN ? PAL.cream : PAL.brown, TIN ? { pattern: 'stripes', acc: PAL.brown, border: false } : { acc: PAL.cream, pattern: 'stripes' });
  const waterM = TIN ? new THREE.MeshStandardMaterial({ map: (() => { const t = canvasTex('water', 128, 128, (g2, s) => { g2.fillStyle = '#3f86b8'; g2.fillRect(0, 0, s, s); g2.strokeStyle = '#bfe3f2'; g2.lineWidth = 5; for (let y = 10; y < s; y += 32) { g2.beginPath(); for (let x = 0; x <= s; x += 8) g2.lineTo(x, y + Math.sin(x / s * Math.PI * 4) * 6); g2.stroke(); } }); return t; })(), metalness: 0.4, roughness: 0.25 }) : mat(PAL.sky, { acc: '#b9dcf0', pattern: 'hstripes' });
  const tube = mesh(new THREE.TubeGeometry(curve, 160, 0.45, 10, true), trough); g.add(tube);
  { const pos = [], uv = [], idx = [], M = 200;
    for (let i = 0; i <= M; i++) { const p = curve.getPointAt((i % M) / M), tg = curve.getTangentAt((i % M) / M); const sd = V(-tg.z, 0, tg.x).normalize();
      for (const s of [-1, 1]) { pos.push(p.x + sd.x * s * 0.36, p.y + 0.47, p.z + sd.z * s * 0.36); uv.push(i / M, s > 0 ? 1 : 0); } }
    for (let i = 0; i < M; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wg.setIndex(idx); wg.computeVertexNormals();
    const wm = waterM.clone(); wm.side = THREE.DoubleSide; g.add(mesh(wg, wm, false));
    for (const s of [-1, 1]) { const rp = []; for (let i = 0; i < M; i++) { const p = curve.getPointAt(i / M), tg = curve.getTangentAt(i / M); const sd = V(-tg.z, 0, tg.x).normalize(); rp.push(p.clone().addScaledVector(sd, s * 0.4).add(V(0, 0.48, 0))); }
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp, true), 200, 0.08, 6, true), trough)); } }
  if (waterM.map) { waterM.map.repeat.set(12, 1); }
  for (let i = 0; i < n; i += 4) { const p = curve.getPointAt(i / n); if (p.y > 0.8) g.add(rod(V(p.x, 0, p.z), V(p.x, p.y - 0.4, p.z), 0.08, TIN ? mat(PAL.brown, { kind: 'rawwood' }) : mat(PAL.brown))); }
  // pond
  add(g, mesh(cyl(2.4, 2.4, 0.12, 28), waterM), 0, 0.06, 0).scale.set(1.15, 1, 0.65);
  const logs = []; const logM = TIN ? mat('#9a6a3e', { kind: 'rawwood' }) : mat(PAL.brown);
  for (let i = 0; i < 3; i++) {
    const lg = new THREE.Group(); g.add(lg);
    const l = mesh(cyl(0.3, 0.3, 1.2, 12), logM); l.rotation.z = Math.PI / 2; lg.add(l);
    add(lg, mesh(sph(0.11, 8), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), 0.15, 0.36, 0); add(lg, mesh(sph(0.11, 8), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), -0.25, 0.36, 0);
    logs.push(lg);
  }
  const splash = []; const spM = TIN ? new THREE.MeshStandardMaterial({ color: '#eaf6fb', roughness: 0.2 }) : mat(PAL.white);
  for (let i = 0; i < 10; i++) { const s = mesh(sph(0.16, 8), spM, false); g.add(s); splash.push(s); }
  part(g, -11, 11.4, { delay: 0.9, lay: 1, mode: 'squash' });
  anims.push((tA) => {
    logs.forEach((lg, i) => { const u = (i / 3 + tA * 0.16 + 0.1) % 1; const p = curve.getPointAt(u), q = curve.getTangentAt(u); lg.position.copy(p).y += 0.68; lg.rotation.y = Math.atan2(-q.z, q.x); lg.rotation.z = Math.asin(clamp(q.y, -1, 1)) * 0.9; });
    const sp = curve.getPointAt(0.27);
    splash.forEach((s, i) => { const k = (tA * 1.6 + i / 10) % 1; const a = i * 2.4; s.position.set(sp.x + Math.cos(a) * k * 0.9, sp.y + 0.3 + Math.sin(k * Math.PI) * 0.9, sp.z + Math.sin(a) * k * 0.6); s.scale.setScalar(tA > 0 ? (1 - k) * 1.2 + 0.1 : 0.001); });
    if (waterM.map) waterM.map.offset.x = -tA * 0.8;
  });
}
function teacups() {
  const g = new THREE.Group();
  add(g, mesh(cyl(2.3, 2.4, 0.3, 32), TIN ? mat(PAL.pink, { pattern: 'dots', acc: PAL.cream }) : mat(PAL.pink)), 0, 0.15, 0);
  const plat = new THREE.Group(); g.add(plat);
  const cups = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2; const cg = new THREE.Group(); cg.position.set(Math.cos(a) * 1.35, 0.3, Math.sin(a) * 1.35); plat.add(cg);
    const col = [PAL.teal, PAL.mustard, PAL.purple, PAL.sky][i];
    const cupG = new THREE.LatheGeometry([V(0, 0, 0), V(0.4, 0, 0), V(0.62, 0.25, 0), V(0.72, 0.7, 0), V(0.66, 0.72, 0), V(0.56, 0.3, 0), V(0, 0.28, 0)].map(p => new THREE.Vector2(p.x, p.y)), 20);
    const cm = (TIN ? mat(col, { pattern: 'dots', acc: PAL.cream, border: false }) : mat(col, { acc: PAL.white, pattern: 'dots' })).clone(); cm.side = THREE.DoubleSide;
    add(cg, mesh(cupG, cm), 0, 0, 0);
    const h = mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 12, Math.PI), TIN ? mat(col, { pattern: 'plain', border: false }) : mat(col)); h.position.set(0.72, 0.4, 0); h.rotation.z = -Math.PI / 2; cg.add(h);
    for (const s of [-0.2, 0.2]) add(cg, mesh(sph(0.11, 8), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), s, 0.55, 0.05);
    cups.push(cg);
  }
  add(g, mesh(cyl(0.3, 0.3, 0.8, 12), TIN ? mat(PAL.mustard, { kind: 'brass' }) : mat(PAL.mustard)), 0, 0.6, 0);
  part(g, 3.4, -1.6, { delay: 0.98, lay: 1 });
  anims.push((tA) => { plat.rotation.y = clock(tA, 0.9); cups.forEach((c, i) => c.rotation.y = -clock(tA, 2.6 + i * 0.4)); });
}
function motorBox() { // tin: clockwork motor with wind-up key; felt: fountain
  const g = new THREE.Group();
  if (TIN) {
    add(g, mesh(rbox(2.6, 2.2, 2.6), mat(PAL.navy, { pattern: 'gears', acc: PAL.mustard })), 0, 1.1, 0);
    add(g, mesh(rbox(2.9, 0.3, 2.9), mat(PAL.red, { pattern: 'check', acc: PAL.cream })), 0, 2.3, 0);
    rivets(g, [...ring(8, 0, 0, a => V(Math.cos(a) * 1.36, 0.3 + Math.abs(Math.sin(a)) * 1.6, Math.sin(a) * 1.36))]);
    const key = new THREE.Group(); key.position.set(0, 1.25, 1.3); g.add(key);
    const brass = mat(null, { kind: 'brass' });
    add(key, mesh(cyl(0.14, 0.14, 1.0, 12), brass), 0, 0, 0.5).rotation.x = Math.PI / 2;
    add(key, mesh(cyl(0.28, 0.28, 0.2, 16), brass), 0, 0, 0.95).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const lobe = mesh(new THREE.TorusGeometry(0.55, 0.16, 10, 24), brass); lobe.position.set(s * 0.68, 0, 1.08); key.add(lobe); }
    add(key, mesh(rbox(0.5, 0.36, 0.22), brass), 0, 0, 1.08);
    const gear = mesh(cyl(0.5, 0.5, 0.16, 14), mat(null, { kind: 'brass' })); gear.position.set(0, 2.5, 0); g.add(gear);
    const gear2 = mesh(cyl(0.32, 0.32, 0.16, 12), mat('#c8c6c0', { kind: 'metal' })); gear2.position.set(0.82, 2.5, 0.2); g.add(gear2);
    const p = part(g, -4.0, -2.6, { delay: 0.45 }); g.rotation.y = 0.35;
    coaster.key = key;
    anims.push((tA) => { gear.rotation.y = clock(tA, 2.2); gear2.rotation.y = -clock(tA, 3.4); });
  } else {
    add(g, mesh(cyl(1.5, 1.7, 0.6, 28), mat(PAL.cream, { pattern: 'stripes', acc: PAL.pink })), 0, 0.3, 0);
    add(g, mesh(cyl(1.25, 1.25, 0.1, 28), mat(PAL.sky)), 0, 0.58, 0);
    add(g, mesh(cyl(0.25, 0.35, 1.4, 14), mat(PAL.cream)), 0, 1.2, 0);
    add(g, mesh(cyl(0.7, 0.4, 0.3, 18), mat(PAL.cream)), 0, 1.95, 0);
    const drops = []; for (let i = 0; i < 10; i++) { const d = mesh(sph(0.13, 8), mat(PAL.sky)); g.add(d); drops.push(d); }
    part(g, -4.0, -2.6, { delay: 0.6 });
    anims.push((tA) => { drops.forEach((d, i) => { const k = (tA * 0.9 + i / 10) % 1, a = i * 0.63 * 6.28 / 6.28 * 2.6; d.position.set(Math.cos(a) * (0.3 + k * 0.9), 2.1 + Math.sin(k * Math.PI) * 0.6 - k * 1.2, Math.sin(a) * (0.3 + k * 0.9)); }); });
  }
}
function gate() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    add(g, mesh(rbox(1.3, 3.6, 1.3), TIN ? mat(PAL.red, { pattern: 'bricks', acc: PAL.cream }) : mat(PAL.red, { pattern: 'hstripes', acc: PAL.pink })), s * 2.6, 1.8, 0);
    add(g, mesh(new THREE.ConeGeometry(1.05, 1.5, 4), TIN ? mat(PAL.teal, { pattern: 'stripes', acc: PAL.cream, border: false }) : mat(PAL.teal)), s * 2.6, 4.35, 0).rotation.y = Math.PI / 4;
    add(g, mesh(cyl(0.03, 0.03, 1.0, 6), mat('#cccccc', { kind: 'metal' })), s * 2.6, 5.4, 0);
  }
  const arch = mesh(new THREE.TorusGeometry(2.6, 0.3, 12, 32, Math.PI), TIN ? mat(PAL.mustard, { pattern: 'stripes', acc: PAL.red, border: false }) : mat(PAL.mustard, { pattern: 'stripes', acc: PAL.red }));
  add(g, arch, 0, 3.2, 0);
  add(g, mesh(rbox(3.4, 0.9, 0.3), TIN ? mat(PAL.navy, { pattern: 'stars', acc: PAL.mustard }) : mat(PAL.navy, { pattern: 'stars', acc: PAL.mustard })), 0, 5.4, 0);
  const flags = [];
  for (const s of [-1, 1]) { const f = mesh(new THREE.BoxGeometry(0.6, 0.35, 0.03), TIN ? mat(PAL.mustard, { pattern: 'plain', border: false }) : mat(PAL.mustard)); f.geometry = f.geometry.clone().translate(0.3, 0, 0); add(g, f, s * 2.6, 5.7, 0); flags.push(f); }
  // fence along front edge
  const fm = TIN ? mat(PAL.cream, { pattern: 'plain', acc: PAL.red }) : mat(PAL.white);
  for (let x = -15.2; x <= 15.2; x += 0.8) { if (Math.abs(x) < 3.4) continue; add(g, mesh(rbox(0.22, 0.9, 0.12), fm), x, 0.45, 0.3); }
  for (const s of [-1, 1]) add(g, mesh(rbox(11.8, 0.12, 0.1), fm), s * 9.3, 0.6, 0.38);
  rivets(g, [V(-2.6, 3.2, 0.66), V(2.6, 3.2, 0.66), V(-2.6, 0.6, 0.66), V(2.6, 0.6, 0.66)]);
  part(g, 0, 15.2, { delay: 1.08, lay: -1 });
  anims.push((tA) => flags.forEach((f, i) => f.rotation.y = Math.sin(tA * 6 + i) * 0.5));
}
function stall(x, z, ry, col) {
  const g = new THREE.Group();
  add(g, mesh(rbox(1.7, 1.0, 1.1), TIN ? mat(PAL.cream, { pattern: 'plain', acc: col }) : mat(PAL.cream)), 0, 0.5, 0);
  add(g, mesh(rbox(1.8, 0.14, 1.2), TIN ? mat(col, { kind: 'wood' }) : mat(col)), 0, 1.05, 0);
  for (const sx of [-0.8, 0.8]) add(g, mesh(cyl(0.05, 0.05, 1.4, 6), TIN ? mat(PAL.cream, { kind: 'wood' }) : mat(PAL.white)), sx, 1.75, -0.45);
  const aw = mesh(new THREE.BoxGeometry(2.0, 0.08, 1.4), TIN ? mat(col, { pattern: 'stripes', acc: PAL.cream, border: false }) : mat(col, { pattern: 'stripes', acc: PAL.white }));
  aw.rotation.x = 0.35; add(g, aw, 0, 2.35, 0.05);
  add(g, mesh(new THREE.BoxGeometry(2.0, 0.32, 0.05), TIN ? mat(PAL.cream, { pattern: 'scallop', acc: col, border: false }) : mat(col)), 0, 2.05, 0.72);
  // goods on counter
  for (let i = 0; i < 4; i++) add(g, mesh(sph(0.1, 8), TIN ? mat(pick(BRIGHTS), { kind: 'gloss' }) : mat(pick(BRIGHTS))), -0.5 + i * 0.33, 1.2, 0.1);
  g.rotation.y = ry;
  const p = part(g, x, z, { kind: 'tent', delay: rr(0.75, 1.3), lay: 1 });
}
function tent(x, z, rad, col, acc, h = 1.6) {
  const g = new THREE.Group();
  add(g, mesh(cyl(rad, rad, h * 0.6, 20), TIN ? mat(acc, { pattern: 'stripes', acc: col, border: false }) : mat(acc, { pattern: 'stripes', acc: col })), 0, h * 0.3, 0);
  add(g, mesh(new THREE.ConeGeometry(rad * 1.15, h, 20), TIN ? mat(col, { pattern: 'stripes', acc: acc, border: false }) : mat(col, { pattern: 'stripes', acc: acc })), 0, h * 0.6 + h / 2, 0);
  add(g, mesh(cyl(0.03, 0.03, 0.8, 6), mat('#cccccc', { kind: 'metal' })), 0, h * 1.1 + 0.4, 0);
  const f = mesh(new THREE.BoxGeometry(0.5, 0.28, 0.03).translate(0.25, 0, 0), TIN ? mat(PAL.mustard, { pattern: 'plain', border: false }) : mat(PAL.mustard)); add(g, f, 0, h * 1.1 + 0.65, 0);
  const p = part(g, x, z, { kind: 'tent', delay: rr(0.7, 1.3), lay: 1 });
  anims.push((tA) => { f.rotation.y = Math.sin(tA * 6 + x) * 0.5; });
}
function tree(x, z, s) {
  const g = new THREE.Group();
  add(g, mesh(cyl(0.12 * s, 0.16 * s, 1.0 * s, 8), TIN ? mat('#8a5a33', { kind: 'rawwood' }) : mat(PAL.brown)), 0, 0.5 * s, 0);
  const col = pick(TIN ? ['#3f7a35', '#4f8a3c', '#2f6a3a', '#6b9a3a'] : ['#7fae5e', '#93b86a', '#6f9f58', '#a5c47a']);
  if (R() < 0.55) add(g, mesh(sph(0.85 * s, 18), TIN ? mat(col, { kind: 'wood' }) : mat(col)), 0, 1.6 * s, 0);
  else { add(g, mesh(new THREE.ConeGeometry(0.85 * s, 1.5 * s, 14), TIN ? mat(col, { kind: 'wood' }) : mat(col)), 0, 1.5 * s, 0); add(g, mesh(new THREE.ConeGeometry(0.65 * s, 1.2 * s, 14), TIN ? mat(col, { kind: 'wood' }) : mat(col)), 0, 2.2 * s, 0); }
  const p = part(g, x, z, { kind: 'tent', delay: rr(0.6, 1.35), lay: 1 });
  anims.push((tA) => { g.rotation.z = Math.sin(tA * 2 + x) * 0.03; });
}
const balloons = [];
function balloonCluster(x, z, n = 5) {
  const g = new THREE.Group();
  add(g, mesh(cyl(0.1, 0.14, 0.45, 8), TIN ? mat(PAL.mustard, { kind: 'wood' }) : mat(PAL.mustard)), 0, 0.22, 0);
  add(g, mesh(sph(0.13, 8), TIN ? mat('#e8c49a', { kind: 'wood' }) : mat('#f3d6bd')), 0, 0.55, 0);
  const bs = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(); b.position.set(0, 0.6, 0); g.add(b);
    const L = rr(1.4, 2.1), a = i / n * 6.28;
    const tip = V(Math.cos(a) * 0.45, L, Math.sin(a) * 0.45);
    b.add(rod(V(0, 0, 0), tip, 0.012, mat('#eeeeee', { kind: TIN ? 'metal' : 'tin' }), 3));
    const bm = mesh(sph(0.3, 14), TIN ? mat(BRIGHTS[(i * 2) % 9], { kind: 'gloss' }) : mat(BRIGHTS[(i * 2) % 9])); bm.scale.set(1, 1.2, 1); bm.position.copy(tip).y += 0.3; b.add(bm);
    bs.push(b);
  }
  part(g, x, z, { kind: 'tent', delay: rr(0.8, 1.3), lay: 1 });
  anims.push((tA) => bs.forEach((b, i) => { b.rotation.z = Math.sin(tA * 2.2 + i * 1.7 + x) * 0.12; b.rotation.x = Math.cos(tA * 1.9 + i) * 0.1; }));
}
function freeBalloons() {
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); const col = BRIGHTS[(i * 4) % 9];
    const bm = mesh(sph(0.32, 14), TIN ? mat(col, { kind: 'gloss' }) : mat(col)); bm.scale.set(1, 1.2, 1); g.add(bm);
    g.add(rod(V(0, -0.35, 0), V(0, -1.4, 0), 0.012, mat('#eeeeee', { kind: TIN ? 'metal' : 'tin' }), 3));
    scene.add(g);
    const b = { g, x: rr(-12, 12), z: rr(-10, 12), ph: R(), sp: rr(1.2, 1.8) };
    balloons.push(b);
  }
}
function updateFreeBalloons(t, tA, moving) {
  for (const b of balloons) {
    const k = (b.ph + tA * 0.12 * b.sp);
    const y = 2 + (k % 1) * 14;
    b.g.position.set(b.x + Math.sin(tA * 1.3 + b.ph * 6) * 0.6, y, b.z - (k % 1) * 3);
    b.g.visible = moving && tA > b.ph * 0.4;
    b.g.rotation.z = Math.sin(tA * 2 + b.ph * 5) * 0.15;
  }
}
function bunting(a, b, sag, n) {
  const g = new THREE.Group(); const flags = [];
  const pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20; const p = a.clone().lerp(b, k); p.y -= Math.sin(k * Math.PI) * sag; pts.push(p); }
  const c = new THREE.CatmullRomCurve3(pts);
  g.add(mesh(new THREE.TubeGeometry(c, 30, 0.02, 4), mat('#eeeeee', { kind: TIN ? 'metal' : 'tin' })));
  const triG = new THREE.BufferGeometry(); triG.setAttribute('position', new THREE.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.42, 0], 3)); triG.computeVertexNormals();
  for (let i = 1; i < n; i++) {
    const p = c.getPointAt(i / n); const f = mesh(triG, new THREE.MeshStandardMaterial({ color: BRIGHTS[i % 9], side: THREE.DoubleSide, roughness: TIN ? 0.4 : 1, metalness: TIN ? 0.3 : 0 }));
    f.position.copy(p); const tg = c.getTangentAt(i / n); f.rotation.y = Math.atan2(-tg.z, tg.x); g.add(f); flags.push(f);
  }
  const ctr = a.clone().lerp(b, 0.5); ctr.y = 0; g.children.forEach(ch => ch.position.sub(ctr));
  part(g, ctr.x, ctr.z, { kind: 'tent', delay: rr(1.0, 1.35), mode: 'squash' });
  anims.push((tA) => flags.forEach((f, i) => f.rotation.x = Math.sin(tA * 5 + i * 0.8) * 0.35));
}

// clockwork rhythm helper: blend of continuous rotation and ticked steps
function clock(tA, speed) {
  if (tA <= 0) return 0;
  const ramp = 0.35; const te = tA < ramp ? tA * tA / (2 * ramp) : tA - ramp / 2;
  if (!TIN) return te * speed;
  const f = 6, ph = te * f; const stepped = (Math.floor(ph) + smooth(clamp((ph % 1) * 1.6))) / f;
  return speed * (0.45 * te + 0.55 * stepped);
}

// ---------------------------------------------------------------- build everything
buildGround();
buildCoaster(); buildTrainTable();
ferris(); dropTower(); carousel(); swingRide(); pirateShip(); logFlume(); teacups(); motorBox(); gate();
stall(-2.9, 10.3, Math.PI / 2, PAL.red); stall(2.9, 10.3, -Math.PI / 2, PAL.teal); stall(-2.9, 12.6, Math.PI / 2, PAL.mustard); stall(2.9, 12.6, -Math.PI / 2, PAL.pink);
stall(-6.2, -11.6, 0, PAL.sky); stall(-12.8, 6.0, Math.PI / 2, PAL.orange);
tent(-6.0, 13.0, 1.1, PAL.red, PAL.cream); tent(6.0, 13.6, 0.9, PAL.navy, PAL.cream, 1.3); tent(2.5, -12.6, 1.8, PAL.red, PAL.mustard, 2.4); tent(6.6, -12.4, 1.0, PAL.teal, PAL.cream, 1.4);
tent(-3.2, -12.8, 1.0, PAL.purple, PAL.cream, 1.3); tent(14.4, 5.6, 0.9, PAL.pink, PAL.cream, 1.3); tent(-14.4, -5.0, 0.9, PAL.mustard, PAL.red, 1.3);
balloonCluster(1.4, 9.2, 6); balloonCluster(-8.4, 8.0, 5); balloonCluster(9.0, -8.6, 5); balloonCluster(-12.2, -6.4, 4); balloonCluster(7.6, 7.6, 5);
freeBalloons();
bunting(V(-2.9, 3.3, 9.0), V(2.9, 3.3, 9.0), 0.5, 10); bunting(V(-2.9, 3.3, 13.8), V(2.9, 3.3, 13.8), 0.5, 10);
{ // trees
  const blockers = [[-11.4, -11.2, 3.8], [12, -11.6, 2.2], [-13, 0.6, 3.0], [13, -1.6, 3.6], [11.6, 11.2, 3.6], [-11, 11.4, 4.5], [0, 15.2, 3.4], [2.5, -12.6, 2.2], [-6.2, -11.6, 1.5], [6.6, -12.4, 1.4], [-3.2, -12.8, 1.4], [-6, 13, 1.5], [6, 13.6, 1.3], [14.4, 5.6, 1.3], [-14.4, -5, 1.3], [-12.8, 6, 1.4], [0, 11.5, 3.5]];
  const onPath = (x, z) => { for (let i = 0; i < 120; i++) { const [a, b] = roundRectPoint(i / 120); if (Math.hypot(a - x, b - z) < 1.8) return true; } for (const [x1, z1, x2, z2] of spurs) { const L = Math.hypot(x2 - x1, z2 - z1), u = clamp(((x - x1) * (x2 - x1) + (z - z1) * (z2 - z1)) / (L * L)); if (Math.hypot(x1 + (x2 - x1) * u - x, z1 + (z2 - z1) * u - z) < 1.6) return true; } return false; };
  let placed = 0, tries = 0; const placedPts = [];
  while (placed < 34 && tries < 4000) {
    tries++; const x = rr(-15.2, 15.2), z = rr(-15.2, 14.4);
    const inner = Math.abs(x) < 9 && z > -9 && z < 7.6; if (inner) continue;
    if (blockers.some(([bx, bz, r]) => Math.hypot(bx - x, bz - z) < r + 0.8)) continue;
    if (onPath(x, z)) continue; if (placedPts.some(([a, b]) => Math.hypot(a - x, b - z) < 1.7)) continue;
    placedPts.push([x, z]); tree(x, z, rr(0.85, 1.25)); placed++;
  }
}
buildGuests();

// ---------------------------------------------------------------- felt fuzz shells + stray hairs
const boilU = { value: new THREE.Vector3() };
if (FELT) {
  const shellCache = new Map();
  const LEVELS = 3, LEN = 0.11, DENS = 11.0;
  const shellMat = (base, lv) => {
    const key = base.uuid + lv; if (shellCache.has(key)) return shellCache.get(key);
    const m = new THREE.MeshStandardMaterial({ map: base.map, color: base.color, roughness: 1, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLevel = { value: lv }; sh.uniforms.uLen = { value: LEN }; sh.uniforms.uBoil = boilU;
      sh.vertexShader = 'uniform float uLevel; uniform float uLen; varying vec3 vFP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFP = position; transformed += normal * uLen * uLevel;');
      sh.fragmentShader = 'uniform float uLevel; uniform vec3 uBoil; varying vec3 vFP;\nfloat hsh(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\n' +
        sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          vec3 q = vFP * ${DENS.toFixed(1)} + uBoil;
          vec3 ci = floor(q); vec3 f = fract(q) - 0.5;
          float hv = hsh(ci);
          vec3 jit = vec3(hsh(ci + 1.7), hsh(ci + 5.3), hsh(ci + 9.1)) - 0.5;
          float d = length(f - jit * 0.6);
          if (hv < uLevel * 0.7 + 0.12 || d > 0.62 * (1.0 - uLevel * 0.6)) discard;`)
          .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.82, 1.22, uLevel);');
    };
    m.customProgramCacheKey = () => 'shell';
    shellCache.set(key, m); return m;
  };
  const hairMats = new Map();
  const targets = [];
  scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.material && !Array.isArray(o.material) && o.material.isMeshPhysicalMaterial) targets.push(o); });
  for (const o of targets) {
    const n = o.userData.fuzz || (o.isInstancedMesh ? 2 : LEVELS);
    for (let l = 1; l <= n; l++) {
      const sm = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, shellMat(o.material, l / n), o.count) : new THREE.Mesh(o.geometry, shellMat(o.material, l / n));
      if (o.isInstancedMesh) { sm.instanceMatrix = o.instanceMatrix; sm.instanceColor = o.instanceColor; sm.frustumCulled = false; }
      sm.castShadow = false; sm.receiveShadow = true; sm.userData.shell = true;
      if (o.isInstancedMesh) { sm.position.copy(o.position); sm.quaternion.copy(o.quaternion); sm.scale.copy(o.scale); o.parent.add(sm); } else o.add(sm);
    }
    if (o.isInstancedMesh || o.userData.fuzz) continue;
    // stray hairs
    const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal; if (!nor) continue;
    o.geometry.computeBoundingSphere(); const rad = o.geometry.boundingSphere.radius; if (rad > 3.5 || o.geometry.type === 'TubeGeometry') continue;
    const cnt = Math.min(60, Math.round(rad * 14) + 4); const arr = [];
    const hr = rng(pos.count + cnt);
    for (let i = 0; i < cnt; i++) {
      const k = Math.floor(hr() * pos.count); const p = V(pos.getX(k), pos.getY(k), pos.getZ(k)), nn = V(nor.getX(k), nor.getY(k), nor.getZ(k));
      const d = nn.clone().add(V(hr() - 0.5, hr() - 0.5, hr() - 0.5).multiplyScalar(1.3)).normalize();
      const L = 0.08 + hr() * 0.2; const mid = p.clone().addScaledVector(d, L * 0.5).add(V(hr() - 0.5, hr() - 0.5, hr() - 0.5).multiplyScalar(L * 0.4));
      arr.push(p.x, p.y, p.z, mid.x, mid.y, mid.z, mid.x, mid.y, mid.z, p.x + d.x * L, p.y + d.y * L, p.z + d.z * L);
    }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const col = new THREE.Color(o.material.sheenColor || '#ffffff');
    const hk = col.getHexString(); if (!hairMats.has(hk)) hairMats.set(hk, new THREE.LineBasicMaterial({ color: col.clone(), transparent: true, opacity: 0.4 }));
    const ls = new THREE.LineSegments(hg, hairMats.get(hk)); ls.userData.shell = true; o.add(ls);
  }
}

// ---------------------------------------------------------------- lights & camera
const sun = new THREE.DirectionalLight(TIN ? '#ffc98c' : '#ffc890', TIN ? 4.2 : 4.3);
sun.position.set(-34, 24, 6); sun.target.position.set(0, 0, 0); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 5, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = FELT ? 6 : 3;
scene.add(sun);
scene.add(new THREE.HemisphereLight(TIN ? '#e8ecff' : '#f4ecff', TIN ? '#5a3a22' : '#6a4a30', TIN ? 0.42 : 0.38));
const rim = new THREE.DirectionalLight(TIN ? '#b8d0ff' : '#ffe6d0', TIN ? 0.6 : 0.8); rim.position.set(20, 14, -24); scene.add(rim);

const camera = new THREE.PerspectiveCamera(30, 1, 5, 400);
const focusPt = V(0, 3.5, 3.5);
function setCamera(t) {
  const k = smooth(t / 3);
  const az = lerp(0.40, 0.33, k), el = lerp(0.70, 0.66, k), dist = lerp(TIN ? 75 : 73, TIN ? 66.5 : 65, k);
  const tgt = V(0.0, 1.4, -0.4);
  camera.position.set(tgt.x + Math.sin(az) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, tgt.z + Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(tgt);
}

// ---------------------------------------------------------------- post
const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 60, aperture: TIN ? 0.0011 : 0.0013, maxblur: 0.0065 });
composer.addPass(bokeh);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSeed: { value: 0 }, uWarm: { value: TIN ? 1 : 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSeed; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d));
      c.rgb *= mix(0.72, 1.0, v); c.rgb = mix(c.rgb, c.rgb * vec3(1.05, 0.98, 0.9), 0.5);
      c.rgb += (h(vUv * 1000.0) - 0.5) * ${TIN ? '0.025' : '0.028'}; gl_FragColor = c; }`
});
composer.addPass(grade);

// ---------------------------------------------------------------- transformation
const _v = new THREE.Vector3();
const jumble = parts.map(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(-1.2, 1.2), rr(0, 6.28), rr(-1.2, 1.2))));
function applyTin(t) {
  // box
  const shake = t < 0.2 ? Math.sin(t * 90) * 0.012 * (t / 0.2) : 0;
  const lidA = eOutBack((t - 0.1) / 0.36, 1.2) * 1.85 + (-1.85 + Math.PI / 2) * smooth((t - 0.42) / 0.3);
  box.lidPivot.rotation.x = -lidA - shake * 3;
  const wf = eOutBounce((t - 0.38) / 0.42) * Math.PI / 2;
  for (const { pv, d } of box.walls) { if (d.ax === 'x') pv.rotation.x = d.s * wf; else pv.rotation.z = d.s * wf; }
  for (const p of parts) {
    const w = p.w, H = p.home;
    if (p.kind === 'tent') {
      const lt = (t - p.delay) / 0.45; w.position.copy(H);
      if (lt <= 0) { w.visible = false; continue; } w.visible = true;
      const sy = Math.max(0.001, eOutBack(lt * 1.1, 2.6)); const sx = Math.max(0.001, eOutBack(lt * 1.3, 1.6));
      w.scale.set(sx, sy, sx); w.quaternion.identity(); continue;
    }
    w.visible = true;
    const dur = p.kind === 'track' ? 0.36 : 0.5;
    const lt = (t - p.delay) / dur;
    const start = _v.set(H.x * 0.3, 0.3, H.z * 0.3);
    if (p.kind === 'train' || p.kind === 'track') start.set(H.x * 0.3 + (p.kind === 'train' ? -2 : 0), 0.5, H.z * 0.3);
    if (lt <= 0) { w.position.copy(start); w.scale.setScalar(0.3); w.quaternion.copy(jumble[p.idx]); if (p.kind === 'track') w.scale.setScalar(0.28); }
    else if (lt < 1) {
      const arc = 3 + H.distanceTo(start) * 0.25 + (p.kind === 'track' ? 1.5 : 0);
      w.position.lerpVectors(start, H, lt); w.position.y += arc * 4 * lt * (1 - lt);
      w.scale.setScalar(lerp(0.3, 1, eOutBack(lt, 1.4)));
      w.quaternion.slerpQuaternions(jumble[p.idx], new THREE.Quaternion(), eOutCubic(lt));
    } else {
      const b = (lt - 1) * dur; w.position.copy(H); w.quaternion.identity();
      const hop = p.kind === 'track' ? 0.12 : 0.45;
      w.position.y += Math.abs(Math.sin(b * 16)) * hop * Math.exp(-b * 9);
      const sq = Math.sin(b * 28) * Math.exp(-b * 8) * (p.kind === 'track' ? 0.05 : 0.12);
      w.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
    }
    if (p.unfold) p.unfold(lt < 1 ? 0.02 : clamp(eOutBack((t - p.delay - dur) / 0.45, 1.3), 0, 1.08));
  }
  // key winding: 1.35..1.82, ratchet clicks; then slowly unwinds while running
  const kt = clamp((t - 1.3) / 0.5); const clicks = 5; const ph = kt * clicks;
  const wind = (Math.floor(ph) + eOutBack(ph % 1, 2.0)) / clicks * Math.PI * 2 * 1.5;
  coaster.key.rotation.z = -(kt >= 1 ? Math.PI * 3 : wind) + (t > START ? (t - START) * 1.1 : 0);
  coaster.key.position.z = 1.3 + (kt > 0 && kt < 1 ? Math.sin(ph * Math.PI * 2) * 0.03 : 0);
}
function applyFelt(t) {
  for (const p of parts) {
    const w = p.w, H = p.home; w.position.copy(H); w.visible = true;
    const lt = (t - p.delay) / 0.5;
    if (p.mode === 'squash') {
      const s = lt <= 0 ? 0.04 : lerp(0.04, 1, spring(lt, 5.5, 9.5));
      const bulge = lt <= 0 ? 0 : Math.sin(clamp(lt) * Math.PI) * 0.05;
      w.scale.set(1 + bulge, Math.max(0.03, s), 1 + bulge); w.quaternion.identity();
      w.position.y = (0.02 + p.idx * 0.002) * (lt <= 0 ? 1 : clamp(1 - lt * 2));
    } else {
      const stand = lt <= 0 ? 0 : clamp(eOutBack(lt * 1.25, 1.6), 0, 1.2);
      const ang = (1 - stand) * p.lay * Math.PI / 2;
      const depth = lt <= 0 ? 0.07 : lerp(0.07, 1, clamp(spring(lt, 5, 10), 0, 1.35));
      const sq = lt <= 0 ? 0 : Math.sin(lt * 9) * Math.exp(-lt * 4) * 0.1;
      w.quaternion.setFromEuler(new THREE.Euler(ang, 0, 0));
      w.scale.set(1 + sq * 0.5, 1 - sq, depth);
      w.position.y = (0.03 + p.idx * 0.004) * (lt <= 0 ? 1 : clamp(1 - lt * 2));
    }
  }
}
// felt puff order: ride by ride
if (FELT) {
  const order = ['ride', 'track', 'train'];
  let k = 0; const rides = parts.filter(p => p.kind === 'ride');
  const seq = [6, 2, 0, 1, 3, 4, 5, 7, 8]; // shuffle-ish order through rides
  rides.forEach((p, i) => { p.delay = 0.22 + (seq[i % seq.length] ?? i) * 0.11; });
  parts.filter(p => p.kind === 'track').forEach((p, i) => p.delay = 0.62 + p.secIdx * 0.05);
  parts.filter(p => p.kind === 'train').forEach(p => p.delay = 1.15);
  parts.filter(p => p.kind === 'tent').forEach(p => p.delay = rr(0.3, 1.25));
}

// ---------------------------------------------------------------- render
window.renderAt = (tIn) => {
  const held = FELT ? Math.floor(tIn * 15) : Math.round(tIn * 30);
  const t = FELT ? held / 15 : tIn;
  const tA = Math.max(0, t - START);
  const moving = t > START;
  if (TIN) applyTin(t); else applyFelt(t);
  for (const a of anims) a(tA, t);
  updateTrain(t);
  // keep the train attached to its part wrapper scaling (tin launch handled by wrapper)
  updateGuests(t, tA, moving);
  updateFreeBalloons(t, tA, moving);
  setCamera(t);
  if (FELT) { // stop-motion boil: per held frame jitter
    const br = rng(held * 97 + 3);
    boilU.value.set(br() * 0.3, br() * 0.3, br() * 0.3);
    for (const p of parts) { p.w.rotation.y += (br() - 0.5) * 0.012; p.w.position.x += (br() - 0.5) * 0.02; p.w.position.z += (br() - 0.5) * 0.02; }
    camera.position.x += (br() - 0.5) * 0.04; camera.position.y += (br() - 0.5) * 0.04;
  }
  const fd = camera.position.distanceTo(focusPt);
  bokeh.uniforms.focus.value = fd;
  grade.uniforms.uSeed.value = held * 1.37 % 100;
  composer.render();
  return renderer.domElement.toDataURL('image/png');
};
window.READY = true;
console.log('ready parts', parts.length, 'track len', coaster.L.toFixed(1));
