'use strict';
// Paper pop-up park from a ticket. three.js scene of extruded card shapes with real thickness,
// warm lamp light with soft shadows, then a depth-of-field + grade pass.
const W = 1080, SS = 1.5, FPS = 30;
const T3 = THREE;
function RNG(seed) { let s = (seed >>> 0) || 1; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
// springy 0->1 with overshoot (pop-up hinge snapping open)
const spring = (t, dur = 0.5) => { if (t <= 0) return 0; const u = t / dur; return 1 - Math.exp(-5.5 * u) * Math.cos(9 * u); };

const renderer = new T3.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, W); renderer.domElement.id = 'out'; document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.VSMShadowMap;
renderer.outputColorSpace = T3.SRGBColorSpace;
const scene = new T3.Scene();
const camera = new T3.PerspectiveCamera(36, 1, 0.1, 60);

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T3.CanvasTexture(c); if (srgb) t.colorSpace = T3.SRGBColorSpace; t.anisotropy = 4; return t; }
function grainFill(g, w, h, base, amt, seed) {
  g.fillStyle = base; g.fillRect(0, 0, w, h); const R = RNG(seed);
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  for (let k = 0; k < w * h / 400; k++) { g.strokeStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + R() * 0.05})`; g.lineWidth = 0.6; const x = R() * w, y = R() * h, a = R() * 6.28, l = 3 + R() * 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
}
const GRAIN = canvasTex(512, 512, (g, w, h) => grainFill(g, w, h, '#ffffff', 26, 7)); GRAIN.wrapS = GRAIN.wrapT = T3.RepeatWrapping;
const matCache = {};
function paperMat(color, opts = {}) {
  const key = color + JSON.stringify(opts); if (matCache[key]) return matCache[key];
  const m = new T3.MeshStandardMaterial({ color, map: GRAIN, roughness: 0.92, metalness: 0, side: opts.side ?? T3.FrontSide, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 0 });
  if (opts.vc) m.vertexColors = true;
  return matCache[key] = m;
}
const edgeOf = color => { const c = new T3.Color(color); c.lerp(new T3.Color('#fff8ec'), 0.55); return paperMat('#' + c.getHexString()); };

// ---------------------------------------------------------------- palette
const P = { red: '#e0473a', coral: '#f06a4f', cream: '#f8ecd2', teal: '#2aa39a', tealD: '#1d7a78', mustard: '#f2b631', blue: '#3d74c4', navy: '#2c3e78', pink: '#f28fab', lilac: '#a487d4', mint: '#93d8b8', orange: '#f48b37', green: '#7cb342', greenD: '#4e8a3a', greenL: '#a5cf5a', wood: '#a0683c', water: '#55b3d9', white: '#fffaf0' };
const SHIRTS = [P.red, P.teal, P.mustard, P.blue, P.pink, P.lilac, P.orange, P.mint, P.navy, P.coral];
const SKIN = ['#f3cfae', '#d9a07a', '#a8714c', '#7a4e32'];

// ---------------------------------------------------------------- cut shapes
const TH = 0.012; // card thickness
function jitterPts(pts, amt, seed) { const R = RNG(seed); return pts.map(([x, y]) => [x + (R() - 0.5) * amt, y + (R() - 0.5) * amt]); }
function shapeFrom(pts, holes = []) { const s = new T3.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); for (const h of holes) { const p = new T3.Path(); p.moveTo(h[0][0], h[0][1]); for (let i = 1; i < h.length; i++) p.lineTo(h[i][0], h[i][1]); p.closePath(); s.holes.push(p); } return s; }
function circlePts(r, n = 40, cx = 0, cy = 0, j = 0, seed = 1) { const R = RNG(seed); const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const rr = r * (1 + (R() - 0.5) * j); o.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return o; }
function cut(pts, color, opts = {}) { // extruded card in XY plane, thickness along +Z (front face at z=th)
  const th = opts.th ?? TH; const geo = new T3.ExtrudeGeometry(shapeFrom(opts.jit === 0 ? pts : jitterPts(pts, opts.jit ?? 0.004, opts.seed ?? pts.length), opts.holes || []), { depth: th, bevelEnabled: false, curveSegments: 6 });
  const uvs = geo.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 2.2, uvs.getY(i) * 2.2);
  const m = new T3.Mesh(geo, [paperMat(color), edgeOf(color)]); m.castShadow = true; m.receiveShadow = true; return m;
}
function box(w, h, d, color, edge) { const g = new T3.BoxGeometry(w, h, d); const m = new T3.Mesh(g, paperMat(color)); m.castShadow = true; m.receiveShadow = true; return m; }
function stripedCone(r, h, n, c1, c2, open = false) { let g = new T3.ConeGeometry(r, h, n, 1, open); g = g.toNonIndexed(); const col = new Float32Array(g.attributes.position.count * 3); const a = new T3.Color(c1), b = new T3.Color(c2); const ps = g.attributes.position; for (let f = 0; f < ps.count / 3; f++) { let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += ps.getX(f * 3 + k); cz += ps.getZ(f * 3 + k); } const ang = (Math.atan2(cz, cx) + Math.PI) / (2 * Math.PI); const c = (Math.floor(ang * n + 1e-4) % 2) ? a : b; for (let k = 0; k < 3; k++) { col[(f * 3 + k) * 3] = c.r; col[(f * 3 + k) * 3 + 1] = c.g; col[(f * 3 + k) * 3 + 2] = c.b; } } g.setAttribute('color', new T3.BufferAttribute(col, 3)); g.computeVertexNormals(); const m = new T3.Mesh(g, paperMat('#ffffff', { vc: true })); m.material.flatShading = true; m.castShadow = true; m.receiveShadow = true; return m; }
function stripedCyl(r, h, n, c1, c2, open = true) { let g = new T3.CylinderGeometry(r, r, h, n, 1, open); g = g.toNonIndexed(); const col = new Float32Array(g.attributes.position.count * 3); const a = new T3.Color(c1), b = new T3.Color(c2); const ps = g.attributes.position; for (let f = 0; f < ps.count / 3; f++) { let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += ps.getX(f * 3 + k); cz += ps.getZ(f * 3 + k); } const ang = (Math.atan2(cz, cx) + Math.PI) / (2 * Math.PI); const c = (Math.floor(ang * n + 1e-4) % 2) ? a : b; for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f * 3 + k) * 3); } g.setAttribute('color', new T3.BufferAttribute(col, 3)); const m = new T3.Mesh(g, paperMat('#ffffff', { vc: true, side: T3.DoubleSide })); m.castShadow = true; m.receiveShadow = true; return m; }

// ---------------------------------------------------------------- lights & table
const hemi = new T3.HemisphereLight('#fff4e6', '#a07050', 1.5); scene.add(hemi);
const lamp = new T3.SpotLight('#ffd9a8', 3.0, 0, 0.95, 0.85, 0); lamp.position.set(-5, 9, 4.5); lamp.target.position.set(0.3, 0, -0.2); scene.add(lamp, lamp.target);
lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.camera.near = 6; lamp.shadow.camera.far = 20; lamp.shadow.radius = 7; lamp.shadow.blurSamples = 12; lamp.shadow.bias = -0.0004;
const fill = new T3.DirectionalLight('#cfdcff', 0.5); fill.position.set(4, 3, 5); scene.add(fill);
const WOOD = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#c08a58'; g.fillRect(0, 0, w, h); const R = RNG(3);
  for (let y = 0; y < h; y += 1) { const v = Math.sin(y * 0.05 + Math.sin(y * 0.013) * 4) * 0.5 + 0.5; g.fillStyle = `rgba(${150 + v * 50},${95 + v * 35},${55 + v * 20},${0.3 + R() * 0.1})`; g.fillRect(0, y, w, 1); }
  for (let k = 0; k < 400; k++) { g.strokeStyle = `rgba(90,50,25,${0.08 + R() * 0.12})`; g.lineWidth = 0.6 + R() * 1.4; const y = R() * h; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + k) * 6); g.stroke(); }
  for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(40,20,10,0.6)'; g.beginPath(); g.ellipse(R() * w, R() * h, 18, 6, 0, 0, 6.28); g.fill(); }
  g.fillStyle = 'rgba(60,30,15,0.5)'; for (let x = 0; x < w; x += 256) g.fillRect(x, 0, 2, h);
});
WOOD.wrapS = WOOD.wrapT = T3.RepeatWrapping; WOOD.repeat.set(3, 3);
const table = new T3.Mesh(new T3.PlaneGeometry(30, 30), new T3.MeshStandardMaterial({ map: WOOD, roughness: 0.6, metalness: 0 })); table.rotation.x = -Math.PI / 2; table.position.y = -0.002; table.receiveShadow = true; scene.add(table);
// a few loose paper scraps on the table (foreground/background bokeh)
(function () { const R = RNG(9); const spots = [[-3.6, 2.6], [3.8, 2.2], [-3.2, -3.0], [3.4, -2.8], [-4.4, 0.2], [4.6, 0.6], [1.2, 3.4], [-1.6, 3.6]]; spots.forEach(([x, z], i) => { const m = cut(circlePts(0.12 + R() * 0.1, 5 + (R() * 3 | 0), 0, 0, 0.5, i), [P.red, P.mustard, P.teal, P.pink, P.blue, P.cream][i % 6], { th: 0.006 }); m.rotation.x = -Math.PI / 2; m.rotation.z = R() * 6; m.position.set(x, 0, z); scene.add(m); }); })();

// ---------------------------------------------------------------- the map: 3 columns x 5 rows of panels
const A = 1.6, B = 0.9, PT = 0.0035; // panel size, paper thickness
const MAPW = 3 * A, MAPD = 5 * B;
const BACKTEX = canvasTex(512, 288, (g, w, h) => { grainFill(g, w, h, '#efe2c4', 18, 5); g.strokeStyle = 'rgba(200,90,70,0.35)'; g.lineWidth = 3; for (let x = -h; x < w; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); } });
const TICKTEX = canvasTex(1024, 576, drawTicket);
function drawTicket(g, w, h) {
  grainFill(g, w, h, '#f3e3bf', 22, 11);
  const stub = w * 0.74;
  g.fillStyle = '#d8423a'; g.fillRect(16, 16, w - 32, h - 32);
  g.fillStyle = '#f6e8c8'; g.fillRect(34, 34, w - 68, h - 68);
  // scalloped inner frame
  g.strokeStyle = '#d8423a'; g.lineWidth = 5; g.beginPath(); g.rect(54, 54, stub - 80, h - 108); g.stroke();
  g.fillStyle = '#d8423a'; for (let x = 70; x < stub - 30; x += 26) { g.beginPath(); g.arc(x, 54, 7, 0, Math.PI); g.fill(); g.beginPath(); g.arc(x, h - 54, 7, Math.PI, 0); g.fill(); }
  // corner flourishes
  g.fillStyle = '#2a8f88'; for (const [x, y] of [[80, 80], [stub - 50, 80], [80, h - 80], [stub - 50, h - 80]]) { g.beginPath(); g.arc(x, y, 12, 0, 6.28); g.fill(); }
  // big star with rays
  const cx = (54 + stub - 26) / 2, cy = h / 2;
  g.strokeStyle = 'rgba(242,182,49,0.7)'; g.lineWidth = 6; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; g.beginPath(); g.moveTo(cx + Math.cos(a) * 110, cy + Math.sin(a) * 110); g.lineTo(cx + Math.cos(a) * 160, cy + Math.sin(a) * 160); g.stroke(); }
  g.fillStyle = '#f2b631'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k / 10 * 6.283, r = k % 2 ? 46 : 112; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill();
  g.strokeStyle = '#b5551f'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#d8423a'; g.beginPath(); g.arc(cx, cy, 22, 0, 6.28); g.fill();
  // decorative bars (no text)
  g.fillStyle = '#2a8f88'; g.fillRect(90, cy - 6, 70, 12); g.fillRect(stub - 140, cy - 6, 70, 12);
  // perforation + stub
  g.fillStyle = '#7a5a3a'; for (let y = 30; y < h - 20; y += 18) { g.beginPath(); g.arc(stub, y, 4.5, 0, 6.28); g.fill(); }
  g.fillStyle = '#2a8f88'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k / 10 * 6.283, r = k % 2 ? 18 : 42; g.lineTo((stub + w - 34) / 2 + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill();
  g.strokeStyle = '#d8423a'; g.lineWidth = 4; for (const dy of [-110, 110]) { g.beginPath(); g.moveTo(stub + 30, cy + dy); g.lineTo(w - 60, cy + dy); g.stroke(); }
  // age: soft stains
  const R = RNG(4); for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(150,100,50,${0.05 + R() * 0.05})`; g.beginPath(); g.arc(R() * w, R() * h, 30 + R() * 80, 0, 6.28); g.fill(); }
}
// world <-> map texture coords
const mapU = x => (x + MAPW / 2) / MAPW, mapV = z => 1 - (z + MAPD / 2) / MAPD;
const PATHS = [
  [[0, 2.25], [0, 1.2], [0, 0.42]],
  [[-0.38, 0.1], [-0.9, 0.25], [-1.45, 0.55], [-1.9, 1.1]],
  [[-0.3, -0.25], [-0.9, -0.7], [-1.5, -0.95]],
  [[0.38, 0.1], [0.9, 0.2], [1.5, 0.15], [1.85, -0.15]],
  [[0.3, -0.3], [0.7, -0.6], [1.3, -0.9], [1.95, -1.45]],
  [[0, -0.42], [0.1, -0.75]],
  [[0.3, 0.35], [0.8, 0.9], [1.2, 1.3]],
  [[-0.3, 0.35], [-0.8, 1.0], [-1.3, 1.4]],
  [[-1.9, 1.1], [-1.4, 1.75], [-0.4, 1.9]],
  [[1.2, 1.3], [0.9, 1.85], [0.4, 1.95]],
];
function drawMap(g, w, h) {
  grainFill(g, w, h, '#86bf4c', 22, 21);
  const X = x => mapU(x) * w, Y = z => (1 - mapV(z)) * h, S = w / MAPW;
  const R = RNG(31);
  // meadow patches (layered paper look: darker drop shadow under each shape)
  const blobShape = (cx, cz, r, col, seed) => { const pts = circlePts(r, 14, cx, cz, 0.35, seed); g.fillStyle = 'rgba(40,60,20,0.25)'; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x) + 5, Y(z) + 6) : g.moveTo(X(x) + 5, Y(z) + 6)); g.fill(); g.fillStyle = col; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z))); g.fill(); };
  for (let k = 0; k < 26; k++) blobShape((R() - 0.5) * MAPW, (R() - 0.5) * MAPD, 0.25 + R() * 0.35, ['#9ccc58', '#6fae44', '#a9d466'][k % 3], k);
  // paths: cream card with shadow + dashed edging
  const stroke = (pl, wdt, col, dx = 0, dy = 0) => { g.strokeStyle = col; g.lineWidth = wdt * S; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pl.forEach(([x, z], i) => i ? g.lineTo(X(x) + dx, Y(z) + dy) : g.moveTo(X(x) + dx, Y(z) + dy)); g.stroke(); };
  PATHS.forEach(pl => stroke(pl, 0.24, 'rgba(50,70,20,0.3)', 5, 7));
  g.fillStyle = 'rgba(50,70,20,0.3)'; g.beginPath(); g.arc(X(0) + 5, Y(0) + 7, 0.62 * S, 0, 6.28); g.fill();
  PATHS.forEach(pl => stroke(pl, 0.24, '#f1dcae'));
  g.fillStyle = '#f1dcae'; g.beginPath(); g.arc(X(0), Y(0), 0.62 * S, 0, 6.28); g.fill();
  g.strokeStyle = '#e2a55a'; g.lineWidth = 6; g.setLineDash([16, 12]); g.beginPath(); g.arc(X(0), Y(0), 0.55 * S, 0, 6.28); g.stroke(); g.setLineDash([]);
  PATHS.forEach(pl => { g.setLineDash([10, 14]); stroke(pl, 0.012, '#d6b47a'); g.setLineDash([]); });
  // water: pond + flume channel base
  const pond = circlePts(0.34, 18, -1.75, -0.2, 0.3, 4); g.fillStyle = 'rgba(30,60,80,0.3)'; g.beginPath(); pond.forEach(([x, z], i) => i ? g.lineTo(X(x) + 5, Y(z) + 6) : g.moveTo(X(x) + 5, Y(z) + 6)); g.fill(); g.fillStyle = P.water; g.beginPath(); pond.forEach(([x, z], i) => i ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z))); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(X(-1.75) + (k - 2) * 20, Y(-0.2) + (k % 2) * 14, 12, 0.3, 2.6); g.stroke(); }
  stroke(FLUME_GROUND, 0.2, 'rgba(30,60,80,0.3)', 5, 6); stroke(FLUME_GROUND, 0.2, '#3f8fc0'); stroke(FLUME_GROUND, 0.12, P.water);
  // flower dots & little hedges
  for (let k = 0; k < 700; k++) { const x = R() * w, y = R() * h; g.fillStyle = ['#ffffff', '#ffd54a', '#ff8aa8', '#ffb15a', '#c9a2f0'][k % 5]; g.beginPath(); g.arc(x, y, 3 + R() * 3, 0, 6.28); g.fill(); }
  for (let k = 0; k < 18; k++) { const x = (R() - 0.5) * MAPW * 0.95, z = (R() - 0.5) * MAPD * 0.95; g.fillStyle = 'rgba(30,60,20,0.3)'; g.fillRect(X(x) + 4, Y(z) + 5, 60, 16); g.fillStyle = '#4e8a3a'; g.fillRect(X(x), Y(z), 60, 16); }
  // fold creases are drawn by geometry seams; add a deckled border
  g.strokeStyle = '#f8ecd2'; g.lineWidth = 22; g.strokeRect(0, 0, w, h); g.strokeStyle = '#d8423a'; g.lineWidth = 6; g.setLineDash([24, 16]); g.strokeRect(26, 26, w - 52, h - 52); g.setLineDash([]);
}
const FLUME_GROUND = [[1.75, 1.95], [2.25, 1.85], [2.3, 1.0], [2.25, 0.4]];
const MAPTEX = canvasTex(2048, 1920, drawMap);

// panel hierarchy
const panels = []; // {col,row,mesh,pivot}
const root = new T3.Group(); scene.add(root);
function makePanel(col, row) {
  const g = new T3.BoxGeometry(A, PT, B); g.translate(0, PT / 2, 0);
  const cx = col * A, cz = row * B;
  const uv = g.attributes.uv, pos = g.attributes.position;
  // box face order: +x,-x,+y,-y,+z,-z ; 4 verts each
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; const x = pos.getX(i), z = pos.getZ(i); if (f === 2) uv.setXY(i, mapU(cx + x), mapV(cz + z)); else if (f === 3) { if (col === -1 && row === 0) uv.setXY(i, 1 - (x / A + 0.5), 1 - (z / B + 0.5)); else uv.setXY(i, x / A + 0.5, z / B + 0.5); } }
  const isTicket = col === -1 && row === 0;
  const mats = [paperMat('#f3e6c8'), paperMat('#f3e6c8'), new T3.MeshStandardMaterial({ map: MAPTEX, roughness: 0.9 }), new T3.MeshStandardMaterial({ map: isTicket ? TICKTEX : BACKTEX, roughness: 0.9 }), paperMat('#f3e6c8'), paperMat('#f3e6c8')];
  const m = new T3.Mesh(g, mats); m.castShadow = true; m.receiveShadow = true; return m;
}
// build: C0 at root; columns L/R hinge to C0; rows hinge within each column (roll fold)
const PANEL = {};
const colP = { '-1': 7.5 * PT, '1': 5 * PT };
const rowP = { '1': 1.5 * PT, '-1': 2.5 * PT, '2': PT, '-2': PT };
function buildColumn(col, parent) {
  const base = new T3.Group(); parent.add(base);
  const m0 = makePanel(col, 0); base.add(m0); PANEL[col + ',0'] = { mesh: m0 };
  for (const sgn of [1, -1]) {
    const piv1 = new T3.Group(); piv1.position.set(0, rowP[sgn], sgn * B / 2); base.add(piv1);
    const g1 = new T3.Group(); g1.position.set(0, -rowP[sgn], sgn * B / 2); piv1.add(g1); const m1 = makePanel(col, sgn); g1.add(m1);
    const piv2 = new T3.Group(); piv2.position.set(0, rowP[sgn * 2], sgn * B / 2); g1.add(piv2);
    const g2 = new T3.Group(); g2.position.set(0, -rowP[sgn * 2], sgn * B / 2); piv2.add(g2); const m2 = makePanel(col, sgn * 2); g2.add(m2);
    PANEL[col + ',' + sgn] = { mesh: m1, piv: piv1, fold: sgn > 0 ? -Math.PI : Math.PI };
    PANEL[col + ',' + sgn * 2] = { mesh: m2, piv: piv2, fold: sgn > 0 ? -Math.PI : Math.PI };
  }
  return base;
}
buildColumn(0, root);
const colPiv = {};
for (const col of [-1, 1]) { const piv = new T3.Group(); piv.position.set(col * A / 2, colP[col], 0); root.add(piv); const g = new T3.Group(); g.position.set(col * A / 2, -colP[col], 0); piv.add(g); buildColumn(col, g); colPiv[col] = piv; }
const TL = { L: [0.28, 0.62], R: [0.5, 0.84], r1: [0.8, 1.1], r2: [1.0, 1.3] };
const foldAng = (t, [a, b], fold) => { const u = ease((t - a) / (b - a)); const flop = Math.sin(clamp((t - b) / 0.25) * Math.PI) * 0.06 * (1 - clamp((t - b) / 0.25)); return fold * (1 - u) + Math.sign(fold) * flop; };
function updateFolds(t) {
  colPiv[-1].rotation.z = foldAng(t, TL.L, -Math.PI); colPiv[1].rotation.z = foldAng(t, TL.R, Math.PI);
  for (const col of [-1, 0, 1]) for (const r of [1, -1, 2, -2]) { const p = PANEL[col + ',' + r]; p.piv.rotation.x = foldAng(t, Math.abs(r) === 1 ? TL.r1 : TL.r2, p.fold); }
  // whole stack lifts slightly while the first flaps open
  root.position.y = 0.04 * Math.sin(clamp((t - 0.1) / 0.6) * Math.PI);
}
function panelFlatTime(x, z) { const col = Math.round(x / A), row = Math.round(z / B); const c = col === 0 ? 0 : col < 0 ? TL.L[1] : TL.R[1]; const r = row === 0 ? 0 : Math.abs(row) === 1 ? TL.r1[1] : TL.r2[1]; return Math.max(c, r); }
const popStart = (x, z) => Math.max(panelFlatTime(clamp(x, -2.39, 2.39), clamp(z, -2.24, 2.24)) + 0.05, 0.95 + Math.hypot(x, z * 1.1) * 0.2);

// ---------------------------------------------------------------- pop-up items
const POPS = []; // {group, x, z, t0, kind:'hinge'|'grow', dur, update(t,lt)}
function addPop(obj, x, z, kind = 'hinge', update = null, extra = {}) { const g = new T3.Group(); g.position.set(x, 0, z); g.add(obj); scene.add(g); const t0 = extra.t0 ?? popStart(x, z); POPS.push({ g, obj, x, z, t0, kind, update, dur: extra.dur ?? 0.5, dir: extra.dir ?? 1 }); g.visible = false; return g; }
function updatePops(t) {
  for (const p of POPS) {
    const lt = t - p.t0; p.g.visible = lt > 0;
    if (lt <= 0) continue; const s = spring(lt, p.dur);
    if (p.kind === 'hinge') { p.g.rotation.x = -(1 - s) * Math.PI / 2 * p.dir; p.g.scale.set(1, 1, 1); }
    else { p.g.scale.set(lerp(0.6, 1, Math.min(1, s)), Math.max(0.001, s), lerp(0.6, 1, Math.min(1, s))); }
    if (p.update) p.update(t, lt);
  }
}
function tabbed(obj) { const g = new T3.Group(); g.add(obj); return g; }

// trees: flat cut-out cards (round or pointed), layered two-tone
function tree(x, z, s, kind, seed) {
  const g = new T3.Group(); const R = RNG(seed);
  g.add(Object.assign(cut([[-0.025 * s, 0], [0.025 * s, 0], [0.02 * s, 0.25 * s], [-0.02 * s, 0.25 * s]], '#7a4b2a', { seed }), {}));
  if (kind === 'pine') { const c1 = cut([[-0.16 * s, 0.12 * s], [0.16 * s, 0.12 * s], [0, 0.62 * s]], '#2f7a4a', { seed: seed + 1 }); c1.position.z = 0.002; g.add(c1); const c2 = cut([[-0.1 * s, 0.3 * s], [0.1 * s, 0.3 * s], [0, 0.6 * s]], '#4f9a5a', { seed: seed + 2 }); c2.position.z = 0.016; g.add(c2); }
  else { const col = kind === 'blossom' ? ['#e9799a', '#f6a9c0'] : [['#3f8a3a', '#69b04a'], ['#4e9a40', '#8cc85a'], ['#2f7a4a', '#5aa85a']][seed % 3]; const c1 = cut(circlePts(0.17 * s, 16, 0, 0.36 * s, 0.25, seed), col[0], { seed: seed + 3 }); c1.position.z = 0.002; g.add(c1); const c2 = cut(circlePts(0.1 * s, 12, -0.04 * s, 0.4 * s, 0.25, seed + 9), col[1], { seed: seed + 4 }); c2.position.z = 0.016; g.add(c2); }
  g.rotation.y = (R() - 0.5) * 0.4;
  addPop(g, x, z, 'hinge', (t) => { g.rotation.z = Math.sin(t * 2 + seed) * 0.03; });
}
// people: tiny cut-outs
const PERSON_GEO = { body: null, head: null };
const peopleMats = {};
function person(color, skin) {
  const g = new T3.Group();
  const body = cut([[-0.018, 0.0], [0.018, 0.0], [0.022, 0.05], [0.016, 0.075], [-0.016, 0.075], [-0.022, 0.05]], color, { th: 0.006, jit: 0, seed: 1 });
  const head = cut(circlePts(0.014, 10, 0, 0.092), skin, { th: 0.006, jit: 0 }); head.position.z = 0.001;
  body.castShadow = head.castShadow = true; g.add(body, head); return g;
}
// balloon on a stick
function balloon(col) { const g = new T3.Group(); const stick = box(0.004, 0.34, 0.004, '#f4f0e6'); stick.position.y = 0.17; g.add(stick); const b = cut(circlePts(0.045, 16, 0, 0.37, 0.05, 3), col, { th: 0.01 }); g.add(b); const hl = cut(circlePts(0.012, 8, -0.015, 0.385), '#ffffff', { th: 0.004, jit: 0 }); hl.position.z = 0.011; g.add(hl); return g; }

// ---------------------------------------------------------------- rides
const ANIM = []; // per-frame updaters after pop
// Ferris wheel
(function () {
  const X = -1.7, Z = -1.4, R0 = 0.62, H = 0.78;
  const g = new T3.Group();
  for (const dz of [-0.07, 0.07]) for (const e of [-1, 1]) { const leg = box(0.03, 0.9, 0.012, '#f4eadc'); leg.position.set(e * 0.2, 0.39, dz); leg.rotation.z = -e * 0.27; g.add(leg); }
  const wheel = new T3.Group(); wheel.position.set(0, H, 0); g.add(wheel);
  for (const dz of [-0.05, 0.05]) {
    const ring = cut(circlePts(R0, 64, 0, 0, 0, 1), dz > 0 ? '#f6f0f8' : '#e7d9ee', { holes: [circlePts(R0 - 0.035, 64).reverse()], jit: 0, th: 0.01 }); ring.position.z = dz; wheel.add(ring);
    for (let i = 0; i < 16; i++) { const sp = box(R0 * 2, 0.012, 0.006, dz > 0 ? '#f6f0f8' : '#d9c9e2'); sp.rotation.z = i / 16 * Math.PI; sp.position.z = dz; wheel.add(sp); }
  }
  const inner = cut(circlePts(0.26, 40), P.mustard, { holes: [circlePts(0.23, 40).reverse()], jit: 0, th: 0.008 }); inner.position.z = 0.062; wheel.add(inner);
  const hub = cut(circlePts(0.07, 20), P.red, { th: 0.02 }); hub.position.z = 0.06; wheel.add(hub);
  const gons = []; const cols = [P.red, P.teal, P.mustard, P.blue, P.pink, P.lilac, P.orange, P.mint];
  for (let i = 0; i < 12; i++) { const gg = new T3.Group(); const body = cut([[-0.055, -0.03], [0.055, -0.03], [0.065, -0.11], [0.05, -0.14], [-0.05, -0.14], [-0.065, -0.11]], cols[i % 8], { seed: i, th: 0.03 }); body.position.z = -0.015; const roof = cut([[-0.06, -0.03], [0.06, -0.03], [0, 0.0]], '#fff4e0', { th: 0.032 }); roof.position.z = -0.016; const win = cut([[-0.04, -0.05], [0.04, -0.05], [0.04, -0.085], [-0.04, -0.085]], '#fff4e0', { th: 0.004, jit: 0 }); win.position.z = 0.016; gg.add(body, roof, win); wheel.add(gg); gons.push(gg); }
  const bulbs = []; for (let i = 0; i < 24; i++) { const bl = new T3.Mesh(new T3.SphereGeometry(0.012, 6, 4), new T3.MeshBasicMaterial({ color: '#fff0b0' })); const a = i / 24 * 6.283; bl.position.set(Math.cos(a) * R0, Math.sin(a) * R0, 0.065); wheel.add(bl); bulbs.push(bl); }
  g.rotation.y = 0.3;
  addPop(g, X, Z, 'hinge', (t, lt) => { const rot = -Math.max(0, lt - 0.3) * 0.5 - 0.15 * sstep(0, 1, lt); wheel.rotation.z = rot; gons.forEach((gg, i) => { const a = i / 12 * 6.283; gg.position.set(Math.cos(a) * R0, Math.sin(a) * R0, 0); gg.rotation.z = -rot + Math.sin(t * 3 + i) * 0.05; }); });
})();
// Carousel at the centre
(function () {
  const g = new T3.Group();
  const base = stripedCyl(0.36, 0.06, 24, P.teal, P.cream, false); base.position.y = 0.03; g.add(base);
  const top = new T3.Mesh(new T3.CylinderGeometry(0.36, 0.36, 0.006, 32), paperMat('#f1d9a8')); top.position.y = 0.063; top.receiveShadow = true; g.add(top);
  const rot = new T3.Group(); g.add(rot);
  const col = stripedCyl(0.08, 0.28, 12, P.mustard, '#fff0c8', false); col.position.y = 0.2; rot.add(col);
  const horses = [];
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; const r = i % 2 ? 0.27 : 0.2; const pole = box(0.008, 0.3, 0.008, '#e8c060'); pole.position.set(Math.cos(a) * r, 0.21, Math.sin(a) * r); rot.add(pole); const h = cut([[-0.05, 0], [0.04, 0], [0.05, 0.02], [0.065, 0.045], [0.05, 0.05], [0.035, 0.03], [-0.04, 0.03], [-0.055, 0.045], [-0.06, 0.035]], ['#fff7ea', '#f4e2c8'][i % 2], { th: 0.012, seed: i }); const hg = new T3.Group(); hg.add(h); h.position.set(0, -0.02, -0.006); hg.position.set(Math.cos(a) * r, 0.14, Math.sin(a) * r); hg.rotation.y = -a; rot.add(hg); const saddle = box(0.025, 0.012, 0.014, [P.red, P.blue, P.mustard, P.lilac][i % 4]); saddle.position.y = 0.015; hg.add(saddle); horses.push(hg); }
  const roof = stripedCone(0.42, 0.2, 16, P.red, P.cream); roof.position.y = 0.46; rot.add(roof);
  const val = stripedCyl(0.42, 0.06, 32, P.mustard, P.teal, true); val.position.y = 0.33; rot.add(val);
  const flag = cut([[0, 0], [0.08, 0.025], [0, 0.05]], P.coral, { th: 0.004 }); flag.position.y = 0.6; rot.add(flag); const fp = box(0.006, 0.08, 0.006, '#8a6a40'); fp.position.y = 0.58; rot.add(fp);
  const bulbs = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; const bl = new T3.Mesh(new T3.SphereGeometry(0.012, 6, 4), new T3.MeshBasicMaterial({ color: '#ffe6a0' })); bl.position.set(Math.cos(a) * 0.43, 0.3, Math.sin(a) * 0.43); rot.add(bl); }
  addPop(g, 0, 0, 'grow', (t, lt) => { rot.rotation.y = Math.max(0, lt - 0.25) * 0.9 + 0.3 * sstep(0, 0.6, lt); horses.forEach((h, i) => h.position.y = 0.14 + 0.03 * Math.sin(t * 6 + i * 1.4)); }, { t0: 0.95, dur: 0.55 });
})();
// Coaster: paper strip track that arcs up from the map
const COASTER = (function () {
  const key = [[-8, 2.5, -8], [4, 2.5, -8], [14, 2.5, -8], [22, 3, -11], [27, 5.5, -17], [28, 13, -25], [28, 24, -34], [27.4, 31, -41], [24, 32.5, -46.5], [18, 30, -49], [12, 16, -48], [6.5, 2.4, -44.2]];
  const Rl = 12.5, x0 = 0, z0 = -42.5, NL = 30, loop = [];
  for (let i = 0; i <= NL; i++) { const th = i / NL * 2 * Math.PI; loop.push([x0 - Rl * Math.sin(th) - 7 * i / NL, 1.6 + Rl * (1 - Math.cos(th)) * 1.15, z0 + 3.4 * i / NL]); }
  const tail = [[-15, 2.4, -38.5], [-21, 7, -35], [-25, 15, -28], [-24.5, 10, -20], [-20, 4.5, -13], [-14, 3, -9]];
  const ctrl = [...key, ...loop, ...tail].map(p => [p[0] * 0.058 + 0.15, p[1] * 0.047, (p[2] + 28) * 0.05 - 0.95]); const n = ctrl.length;
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    const tj = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 0.5) || 1e-4;
    const t0 = 0, t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let k = 0; k < 16; k++) { const t = lerp(t1, t2, k / 16); const L = (a, b, ta, tb) => a.map((v, d) => (tb - t) / (tb - ta) * v + (t - ta) / (tb - ta) * b[d]); const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3); dense.push(L(B1, B2, t1, t2)); }
  }
  const cum = [0]; for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
  const Ltot = cum[cum.length - 1], N = 520; const S = [];
  for (let i = 0; i < N; i++) { const s = i / N * Ltot; let k = 0; while (cum[k + 1] < s) k++; const u = (s - cum[k]) / (cum[k + 1] - cum[k]); const a = dense[k], b = dense[(k + 1) % dense.length]; S.push(a.map((v, d) => v + (b[d] - v) * u)); }
  const T = S.map((p, i) => new T3.Vector3(...S[(i + 1) % N]).sub(new T3.Vector3(...S[(i - 1 + N) % N])).normalize());
  const Bv = []; let b = new T3.Vector3().crossVectors(T[0], new T3.Vector3(0, 1, 0)).normalize();
  for (let i = 0; i < N; i++) { b = b.clone().sub(T[i].clone().multiplyScalar(b.dot(T[i]))).normalize(); Bv.push(b); }
  const Nv = Bv.map((b, i) => new T3.Vector3().crossVectors(b, T[i]));
  return { S, T, B: Bv, N: Nv, Ltot, Nn: N };
})();
const coasterGroup = new T3.Group(); scene.add(coasterGroup);
const trackGeo = new T3.BufferGeometry();
(function () {
  const N = COASTER.Nn; const pos = new Float32Array(N * 8 * 3); const idx = [];
  for (let i = 0; i < N; i++) { const j = (i + 1) % N; const a = i * 8, b = j * 8; // 0..3 top strip (L,R), 4..7 bottom
    const quad = (p, q, r, s) => idx.push(p, q, r, p, r, s);
    quad(a + 0, b + 0, b + 1, a + 1); quad(a + 5, b + 5, b + 4, a + 4); quad(a + 4, b + 4, b + 0, a + 0); quad(a + 1, b + 1, b + 5, a + 5);
  }
  trackGeo.setAttribute('position', new T3.BufferAttribute(pos, 3)); trackGeo.setIndex(idx);
  const col = new Float32Array(N * 8 * 3); const top = new T3.Color(P.red), bot = new T3.Color('#fff2dc');
  const side = new T3.Color('#c23a30'); for (let i = 0; i < N; i++) for (let k = 0; k < 8; k++) { const c = k < 2 ? top : k < 4 ? side : (k < 6 ? side : side); col.set([c.r, c.g, c.b], (i * 8 + k) * 3); }
  trackGeo.setAttribute('color', new T3.BufferAttribute(col, 3));
})();
const trackMesh = new T3.Mesh(trackGeo, new T3.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: T3.DoubleSide })); trackMesh.castShadow = true; trackMesh.receiveShadow = true; coasterGroup.add(trackMesh);
const supports = []; for (let i = 0; i < COASTER.Nn; i += 10) { const p = COASTER.S[i]; if (p[1] < 0.12 || COASTER.N[i].y < 0.5) continue; if (p[0] > -0.7 && p[0] < 0.75 && p[2] < -0.45 && p[2] > -0.85 && p[1] > 0.2) continue; const s = box(0.022, 1, 0.006, '#fff4e0'); coasterGroup.add(s); supports.push({ i, m: s }); }
const ties = []; for (let i = 0; i < COASTER.Nn; i += 4) { const m = box(0.075, 0.006, 0.012, '#fff8ec'); coasterGroup.add(m); ties.push({ i, m }); }
const cars = []; for (let c = 0; c < 5; c++) { const g = new T3.Group(); const body = box(0.085, 0.045, 0.06, [P.mustard, P.teal, P.mustard, P.blue, P.mustard][c]); body.position.y = 0.03; g.add(body); const stripe = box(0.087, 0.008, 0.062, P.cream); stripe.position.y = 0.04; g.add(stripe); for (const dx of [-0.02, 0.02]) { const hd = new T3.Mesh(new T3.SphereGeometry(0.011, 8, 6), paperMat(SKIN[(c + (dx > 0)) % 4])); hd.position.set(dx, 0.066, 0); hd.castShadow = true; g.add(hd); } g.scale.setScalar(1.45); coasterGroup.add(g); cars.push(g); }
const COASTER_T0 = 1.22, COASTER_DUR = 0.55;
let trainS = 0;
function updateCoaster(t) {
  const lt = t - COASTER_T0; coasterGroup.visible = lt > 0; if (lt <= 0) return;
  const h = Math.max(0.001, spring(lt, COASTER_DUR));
  const N = COASTER.Nn, pos = trackGeo.attributes.position.array; const w = 0.034, th = 0.018;
  const lift = i => { const p = COASTER.S[i]; return new T3.Vector3(p[0], p[1] * h + 0.01, p[2]); };
  // during arc-up the frame is re-derived from the squashed curve
  const Pp = []; for (let i = 0; i < N; i++) Pp.push(lift(i));
  for (let i = 0; i < N; i++) {
    const T = Pp[(i + 1) % N].clone().sub(Pp[(i - 1 + N) % N]).normalize(); const Bb = COASTER.B[i].clone().sub(T.clone().multiplyScalar(COASTER.B[i].dot(T))).normalize(); const Nn = new T3.Vector3().crossVectors(Bb, T);
    const p = Pp[i]; const L = p.clone().addScaledVector(Bb, w), R = p.clone().addScaledVector(Bb, -w);
    const v = [L.clone().addScaledVector(Nn, th), R.clone().addScaledVector(Nn, th), L, R, L.clone().addScaledVector(Nn, -th), R.clone().addScaledVector(Nn, -th), L, R];
    for (let k = 0; k < 8; k++) pos.set([v[k].x, v[k].y, v[k].z], (i * 8 + k) * 3);
    COASTER._f = COASTER._f || []; COASTER._f[i] = { p, T, B: Bb, N: Nn };
  }
  trackGeo.attributes.position.needsUpdate = true; trackGeo.computeVertexNormals(); trackGeo.computeBoundingSphere();
  for (const s of supports) { const f = COASTER._f[s.i]; const hh = Math.max(0.001, f.p.y - 0.012); s.m.scale.y = hh; s.m.position.set(f.p.x, hh / 2, f.p.z); s.m.rotation.y = Math.atan2(f.T.x, f.T.z) + Math.PI / 2; }
  for (const tt of ties) { const f = COASTER._f[tt.i]; tt.m.position.copy(f.p).addScaledVector(f.N, 0.019); const m = new T3.Matrix4().makeBasis(f.B, f.N, f.T.clone().negate()); tt.m.quaternion.setFromRotationMatrix(m); }
  // train
  const run = Math.max(0, t - (COASTER_T0 + 0.4));
  const vis = run > 0; cars.forEach(c => c.visible = vis);
  if (!vis) return;
  const ds = COASTER.Ltot / N;
  let ci = 0; COASTER.S.forEach((p, i) => { if (p[1] > COASTER.S[ci][1]) ci = i; }); const yTop = COASTER.S[ci][1] + 0.04; let s = (ci + 14) * ds; // integrate speed analytically-ish
  const steps = Math.floor(run * 120); let sp = s; for (let k = 0; k < steps; k++) { const idx = Math.floor(((sp / ds) % N + N) % N); const y = COASTER.S[idx][1]; const v = 0.3 + Math.sqrt(Math.max(0, 2 * 9.8 * (yTop - y))) * 0.6; sp += v / 120; }
  cars.forEach((c, k) => { const ss = sp - k * 0.15; const fi = ((ss / ds) % N + N) % N; const i = Math.floor(fi); const f = COASTER._f[i]; c.position.copy(f.p).addScaledVector(f.N, 0.018); const m = new T3.Matrix4().makeBasis(f.T, f.N, f.B); c.quaternion.setFromRotationMatrix(m); });
}
// Drop tower
(function () {
  const g = new T3.Group(); const col = box(0.09, 1.9, 0.09, '#efe4f2'); col.position.y = 0.95; g.add(col);
  for (let y = 0.2; y < 1.9; y += 0.2) { const b = box(0.095, 0.02, 0.095, P.lilac); b.position.y = y; g.add(b); }
  const crown = stripedCone(0.12, 0.2, 8, P.red, P.cream); crown.position.y = 2.0; g.add(crown);
  const car = new T3.Group(); const ring = stripedCyl(0.16, 0.06, 16, P.blue, P.mustard, false); car.add(ring); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const leg = box(0.012, 0.05, 0.012, '#3b4a6b'); leg.position.set(Math.cos(a) * 0.17, -0.05, Math.sin(a) * 0.17); car.add(leg); } g.add(car);
  addPop(g, 2.0, -1.85, 'hinge', (t, lt) => { const d = lt - 0.4; let y = 0.12; if (d > 0) { const up = 0.7, hold = 0.2, drop = 0.28; if (d < up) y = 0.12 + 1.55 * sstep(0, 1, d / up); else if (d < up + hold) y = 1.67; else if (d < up + hold + drop) { const u = (d - up - hold) / drop; y = 1.67 - 1.5 * u * u; } else y = 0.17 + 0.08 * Math.exp(-(d - up - hold - drop) * 5) * Math.abs(Math.cos((d - up - hold - drop) * 16)); } car.position.y = y; });
})();
// Swing ride
(function () {
  const g = new T3.Group(); const pole = stripedCyl(0.035, 0.62, 10, P.navy, P.cream, false); pole.position.y = 0.31; g.add(pole);
  const top = new T3.Group(); top.position.y = 0.62; g.add(top); const cone = stripedCone(0.28, 0.14, 16, P.blue, P.mustard); cone.position.y = 0.07; top.add(cone);
  const chairs = []; const lineMat = new T3.LineBasicMaterial({ color: '#4a4048' });
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; const ch = new T3.Group(); const seat = box(0.035, 0.012, 0.03, [P.red, P.mustard, P.teal, P.pink][i % 4]); const kid = cut([[-0.012, 0], [0.012, 0], [0.01, 0.035], [-0.01, 0.035]], SHIRTS[i % 10], { th: 0.004, jit: 0 }); kid.position.y = 0.006; const hd = cut(circlePts(0.009, 8, 0, 0.045), SKIN[i % 4], { th: 0.004, jit: 0 }); ch.add(seat, kid, hd); const geo = new T3.BufferGeometry().setFromPoints([new T3.Vector3(0, 0, 0), new T3.Vector3(0, 0.25, 0)]); const ln = new T3.Line(geo, lineMat); ch.add(ln); top.add(ch); chairs.push({ ch, a }); }
  addPop(g, 1.5, 0.3, 'grow', (t, lt) => { const sp = sstep(0.2, 1.2, lt); top.rotation.y = Math.max(0, lt - 0.2) * 2.0 * Math.min(1, lt); const ang = sp * 0.9; chairs.forEach(({ ch, a }) => { const r = 0.24 + Math.sin(ang) * 0.25; ch.position.set(Math.cos(a) * r, -Math.cos(ang) * 0.25, Math.sin(a) * r); ch.rotation.set(0, -a, 0); ch.rotateZ(ang); }); top.rotation.z = Math.sin(t * 1.5) * 0.06 * sp; });
})();
// Pirate ship (flat cut-out swinging on an A-frame)
(function () {
  const g = new T3.Group();
  for (const dz of [-0.07, 0.07]) for (const e of [-1, 1]) { const l = box(0.025, 0.62, 0.012, '#d9c8ae'); l.position.set(e * 0.14, 0.29, dz); l.rotation.z = -e * 0.45; g.add(l); }
  const piv = new T3.Group(); piv.position.y = 0.56; g.add(piv);
  const ship = new T3.Group(); piv.add(ship);
  const hull = cut([[-0.36, -0.36], [-0.24, -0.5], [0.24, -0.5], [0.36, -0.36], [0.3, -0.4], [-0.3, -0.4]], '#7a4a2c', { th: 0.05 }); hull.position.z = -0.025; ship.add(hull);
  const stripe = cut([[-0.3, -0.43], [0.3, -0.43], [0.27, -0.455], [-0.27, -0.455]], P.mustard, { th: 0.004, jit: 0 }); stripe.position.z = 0.026; ship.add(stripe);
  const mast = box(0.012, 0.36, 0.01, '#5a3a22'); mast.position.y = -0.24; ship.add(mast);
  const sail = cut([[0.005, -0.38], [0.16, -0.36], [0.14, -0.12], [0.005, -0.1]], P.cream, { th: 0.006 }); ship.add(sail);
  const sstripe = cut([[0.01, -0.28], [0.15, -0.27], [0.15, -0.22], [0.01, -0.22]], P.red, { th: 0.002, jit: 0 }); sstripe.position.z = 0.007; ship.add(sstripe);
  for (const e of [-1, 1]) { const arm = box(0.012, 0.5, 0.01, '#8a7a6a'); arm.position.set(e * 0.12, -0.22, 0.03); arm.rotation.z = e * 0.5; ship.add(arm); }
  for (let i = 0; i < 6; i++) { const hd = cut(circlePts(0.016, 8, -0.2 + i * 0.08, -0.34), SKIN[i % 4], { th: 0.006, jit: 0 }); hd.position.z = 0.01; ship.add(hd); }
  g.rotation.y = 0.5;
  addPop(g, -1.55, 0.45, 'hinge', (t, lt) => { const amp = 0.8 * sstep(0.2, 1.4, lt); piv.rotation.z = amp * Math.sin(Math.max(0, lt - 0.2) * 3.2); });
})();
// Teacups
(function () {
  const g = new T3.Group(); const plat = new T3.Mesh(new T3.CylinderGeometry(0.3, 0.3, 0.025, 32), paperMat('#bfe6d8')); plat.position.y = 0.012; plat.castShadow = plat.receiveShadow = true; g.add(plat);
  const spin = new T3.Group(); g.add(spin); const cups = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; const c = new T3.Group(); const cup = new T3.Mesh(new T3.CylinderGeometry(0.065, 0.045, 0.06, 16, 1, true), paperMat([P.pink, P.mint, P.lilac, P.mustard, P.coral][i], { side: T3.DoubleSide })); cup.position.y = 0.055; cup.castShadow = true; c.add(cup); const bot = new T3.Mesh(new T3.CircleGeometry(0.045, 16), paperMat('#fff4e8')); bot.rotation.x = -Math.PI / 2; bot.position.y = 0.03; c.add(bot); for (const dx of [-0.02, 0.025]) { const hd = new T3.Mesh(new T3.SphereGeometry(0.013, 8, 6), paperMat(SKIN[(i + (dx > 0)) % 4])); hd.position.set(dx, 0.08, 0); c.add(hd); } c.position.set(Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19); spin.add(c); cups.push(c); }
  const pot = new T3.Mesh(new T3.SphereGeometry(0.06, 16, 10, 0, 6.283, 0, Math.PI / 2), paperMat(P.cream)); pot.position.y = 0.025; g.add(pot);
  addPop(g, 1.2, 1.3, 'grow', (t, lt) => { const r = Math.max(0, lt - 0.25); spin.rotation.y = r * 1.1; cups.forEach((c, i) => c.rotation.y = r * 3 + i); });
})();
// Log flume: raised chute + channel, logs
const FLUME = (function () {
  const pts = [[2.25, 0.04, 0.4], [2.2, 0.06, -0.2], [2.15, 0.34, -0.8], [2.0, 0.42, -1.2], [1.75, 0.42, -1.15], [1.7, 0.38, -0.8], [1.72, 0.04, 0.0], [1.74, 0.03, 0.7], [1.78, 0.03, 1.4], [1.75, 0.03, 1.95]];
  const crv = new T3.CatmullRomCurve3(pts.map(p => new T3.Vector3(...p)));
  return crv;
})();
(function () {
  const g = new T3.Group();
  const trough = new T3.Mesh(new T3.TubeGeometry(FLUME, 120, 0.05, 6, false), paperMat('#9a6a40')); trough.castShadow = true; trough.receiveShadow = true; g.add(trough);
  const water = new T3.Mesh(new T3.TubeGeometry(FLUME, 120, 0.038, 6, false), paperMat(P.water)); water.position.y = 0.014; g.add(water);
  for (let k = 0; k <= 20; k++) { const p = FLUME.getPointAt(k / 20); if (p.y < 0.08) continue; const s = box(0.018, p.y, 0.018, '#b08050'); s.position.set(p.x, p.y / 2, p.z); g.add(s); }
  const logs = []; for (let k = 0; k < 4; k++) { const l = new T3.Group(); const lg = box(0.13, 0.04, 0.05, '#8a5530'); lg.position.y = 0.04; l.add(lg); for (const dx of [-0.03, 0.03]) { const hd = new T3.Mesh(new T3.SphereGeometry(0.012, 8, 6), paperMat(SKIN[(k + (dx > 0)) % 4])); hd.position.set(dx, 0.075, 0); l.add(hd); } g.add(l); logs.push(l); }
  const splash = []; for (let k = 0; k < 7; k++) { const s = cut([[0, 0], [0.02, 0.06], [0.035, 0.0]], '#ffffff', { th: 0.004 }); s.rotation.y = k; g.add(s); splash.push(s); }
  const sp0 = FLUME.getPointAt(0.66);
  addPop(g, 0, 0, 'grow', (t, lt) => {
    const r = Math.max(0, lt - 0.3);
    logs.forEach((l, k) => { let u = (k / 4 + r * 0.16) % 1; const p = FLUME.getPointAt(u), q = FLUME.getPointAt(Math.min(1, u + 0.01)); l.position.copy(p); l.position.y += 0.015; l.lookAt(q.x, q.y + 0.015, q.z); l.rotateY(Math.PI / 2); });
    splash.forEach((s, k) => { const ph = (t * 1.8 + k / 7) % 1; s.position.set(sp0.x + Math.cos(k * 2) * 0.08 * ph, 0.02 + Math.sin(ph * Math.PI) * 0.1, sp0.z + 0.15 + Math.sin(k * 2) * 0.06 * ph); s.scale.setScalar(r > 0 ? 1 - ph * 0.5 : 0.001); });
  }, { t0: popStart(2.0, -0.4) });
})();
// Gate (front pop-up card)
(function () {
  const g = new T3.Group();
  for (const e of [-1, 1]) { const tw = cut([[-0.09, 0], [0.09, 0], [0.09, 0.4], [-0.09, 0.4]], '#f6e6c6', { th: 0.02 }); tw.position.x = e * 0.3; g.add(tw); const rf = cut([[-0.11, 0.4], [0.11, 0.4], [0, 0.6]], P.teal, { th: 0.024 }); rf.position.x = e * 0.3; g.add(rf); for (let k = 0; k < 3; k++) { const b = cut([[-0.09, 0.08 + k * 0.1], [0.09, 0.08 + k * 0.1], [0.09, 0.1 + k * 0.1], [-0.09, 0.1 + k * 0.1]], P.red, { th: 0.004, jit: 0 }); b.position.set(e * 0.3, 0, 0.021); g.add(b); } const fl = cut([[0, 0.6], [0.09, 0.63], [0, 0.66]], P.coral, { th: 0.004 }); fl.position.x = e * 0.3; g.add(fl); }
  const arch = []; for (let i = 0; i <= 20; i++) { const u = i / 20; arch.push([lerp(-0.22, 0.22, u), 0.36 + Math.sin(u * Math.PI) * 0.12]); } for (let i = 20; i >= 0; i--) { const u = i / 20; arch.push([lerp(-0.22, 0.22, u), 0.31 + Math.sin(u * Math.PI) * 0.12]); }
  const ar = cut(arch, P.red, { th: 0.016 }); g.add(ar);
  const star = []; for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k / 10 * 6.283, r = k % 2 ? 0.03 : 0.07; star.push([Math.cos(a) * r, 0.5 + Math.sin(a) * r]); } const st = cut(star, P.mustard, { th: 0.016 }); st.position.z = 0.004; g.add(st);
  const bulbs = []; for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9; const bl = new T3.Mesh(new T3.SphereGeometry(0.01, 6, 4), new T3.MeshBasicMaterial({ color: '#fff0b0' })); bl.position.set(lerp(-0.22, 0.22, u), 0.335 + Math.sin(u * Math.PI) * 0.12, 0.02); g.add(bl); }
  // fence cards
  for (const e of [-1, 1]) { const fpts = [[0, 0]]; for (let k = 0; k <= 16; k++) { fpts.push([k * 0.06, 0.08], [k * 0.06 + 0.03, 0.1], [k * 0.06 + 0.06, 0.08]); } fpts.push([0.96, 0]); const f = cut(fpts, '#fff4e0', { th: 0.008 }); f.position.x = e > 0 ? 0.4 : -1.36; g.add(f); }
  addPop(g, 0, 2.02, 'hinge');
})();
// tents & stalls
function tent(x, z, r, c1, seed) { const g = new T3.Group(); const wall = stripedCyl(r, r * 0.8, 12, c1, P.cream, false); wall.position.y = r * 0.4; g.add(wall); const roof = stripedCone(r * 1.15, r * 1.0, 12, c1, P.cream); roof.position.y = r * 0.8 + r * 0.5; g.add(roof); const fl = cut([[0, 0], [0.06, 0.02], [0, 0.04]], P.mustard, { th: 0.004 }); fl.position.y = r * 1.8 + 0.04; g.add(fl); const fp = box(0.005, 0.07, 0.005, '#6a5040'); fp.position.y = r * 1.8 + 0.03; g.add(fp); addPop(g, x, z, 'grow', (t) => { fl.rotation.y = Math.sin(t * 6 + seed) * 0.4; }); }
function stall(x, z, c1, side, seed) { const g = new T3.Group(); const bx = box(0.16, 0.12, 0.2, '#fff2dc'); bx.position.y = 0.06; g.add(bx); const ctr = box(0.005, 0.05, 0.16, '#4a2c34'); ctr.position.set(side * 0.081, 0.08, 0); g.add(ctr); for (let i = 0; i < 6; i++) { const s = box(0.1, 0.004, 0.035, i % 2 ? c1 : P.cream); s.position.set(side * 0.1, 0.135, -0.0875 + i * 0.035); s.rotation.z = -side * 0.45; g.add(s); } const top = box(0.17, 0.012, 0.21, c1); top.position.y = 0.125; g.add(top); addPop(g, x, z, 'grow'); }
// back-edge scenery: layered paper hills, clouds on sticks, sun
(function () {
  const hills = (z, base, amp, col, seed, w = MAPW + 0.3) => { const R = RNG(seed); const pts = [[-w / 2, 0]]; for (let i = 0; i <= 30; i++) { const u = i / 30; pts.push([lerp(-w / 2, w / 2, u), base + amp * (0.5 + 0.5 * Math.sin(u * 9 + seed) * 0.6 + (R() - 0.5) * 0.25)]); } pts.push([w / 2, 0]); const m = cut(pts, col, { th: 0.014, seed }); addPop(m, 0, z, 'hinge', null, { t0: 1.3 + (seed % 3) * 0.06, dir: 1 }); };
  hills(-2.24, 0.42, 0.28, '#8fbf6a', 1); hills(-2.18, 0.26, 0.2, '#5f9e4a', 2); hills(-2.12, 0.12, 0.12, '#3f7d3e', 3);
  const cloud = (x, y, z, s, seed) => { const g = new T3.Group(); const pts = []; const R = RNG(seed); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; const r = (0.12 + 0.05 * Math.abs(Math.sin(i * 1.7))) * s; pts.push([Math.cos(a) * 0.3 * s * 1.4, Math.sin(a) * r * 1.3]); } const c = cut(pts, '#fffaf0', { th: 0.012, seed }); c.material = [paperMat('#fffaf0', { emissive: 0xfff0dc, ei: 0.35 }), edgeOf('#fffaf0')]; c.position.y = y; g.add(c); const st = box(0.006, y, 0.006, '#d8cdbd'); st.position.y = y / 2; g.add(st); addPop(g, x, z, 'hinge', (t) => { c.position.x = Math.sin(t * 0.8 + seed) * 0.05; }, { t0: 1.4 + seed * 0.03 }); };
  cloud(-1.4, 1.35, -2.2, 1.1, 1); cloud(0.9, 1.6, -2.2, 0.9, 2); cloud(-0.1, 1.15, -2.15, 0.7, 3);
  const sun = new T3.Group(); const sp = []; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, r = k % 2 ? 0.13 : 0.18; sp.push([Math.cos(a) * r, Math.sin(a) * r]); } const sm = cut(sp, P.mustard, { th: 0.014 }); sm.position.y = 1.75; sun.add(sm); const sc = cut(circlePts(0.09, 20, 0, 1.75), '#ffd36a', { th: 0.004 }); sc.position.z = 0.015; sun.add(sc); const st = box(0.006, 1.75, 0.006, '#d8cdbd'); st.position.y = 0.875; sun.add(st);
  addPop(sun, 1.7, -2.22, 'hinge', (t) => { sm.rotation.z = t * 0.3; }, { t0: 1.45 });
})();
// populate
(function () {
  const R = RNG(55);
  const treeSpots = [];
  for (let k = 0; k < 55; k++) { const x = (R() - 0.5) * (MAPW - 0.2), z = (R() - 0.5) * (MAPD - 0.2); const near = (px, pz, r) => Math.hypot(x - px, z - pz) < r; if (near(0, 0, 0.75) || near(-1.7, -1.35, 0.5) || near(2.0, -1.85, 0.25) || near(1.5, 0.3, 0.45) || near(-1.55, 0.45, 0.45) || near(1.2, 1.3, 0.38) || near(0, 2.0, 0.5) || (x > 1.6 && z > -1.3)) continue; if (z < -0.35 && z > -2.0 && x > -1.25 && x < 1.75) continue; let onPath = false; for (const pl of PATHS) for (let i = 0; i < pl.length - 1; i++) { const a = pl[i], b = pl[i + 1]; for (let u = 0; u <= 1; u += 0.1) if (Math.hypot(x - lerp(a[0], b[0], u), z - lerp(a[1], b[1], u)) < 0.18) onPath = true; } if (onPath) continue; treeSpots.push([x, z]); }
  treeSpots.forEach(([x, z], i) => tree(x, z, 0.55 + R() * 0.3, R() < 0.25 ? 'pine' : R() < 0.2 ? 'blossom' : 'round', i * 7 + 3));
  for (let x = -2.3; x <= 2.3; x += 0.22 + R() * 0.1) tree(x, -2.05 - R() * 0.12, 0.8 + R() * 0.35, R() < 0.3 ? 'pine' : 'round', 900 + (x * 100 | 0));
  tent(-0.75, -0.55, 0.13, P.red, 1); tent(-1.2, 1.45, 0.15, P.mustard, 2); tent(0.75, -0.45, 0.11, P.blue, 3); tent(-2.05, -0.75, 0.12, P.pink, 4); tent(0.6, 1.45, 0.12, P.teal, 5); tent(-0.45, 1.6, 0.1, P.lilac, 6);
  [[-0.24, 1.0, 1], [0.24, 1.15, -1], [-0.24, 1.35, 1], [0.24, 1.55, -1], [-0.24, 1.72, 1], [0.24, 0.8, -1], [0.55, 0.35, 1], [-0.62, 0.05, -1]].forEach(([x, z, sd], i) => stall(x, z, [P.red, P.teal, P.mustard, P.blue, P.pink, P.lilac, P.orange, P.mint][i], sd, i));
  // lamps with string lights along the avenue
  const lampPos = [[-0.17, 0.6], [0.17, 0.6], [-0.17, 1.2], [0.17, 1.2], [-0.17, 1.8], [0.17, 1.8]];
  const strand = new T3.Group(); const bulbsMat = ['#ffe6a0', '#ffb0a0', '#bfe6ff', '#fff3c8'].map(c => new T3.MeshBasicMaterial({ color: c }));
  lampPos.forEach(([x, z]) => { const p = box(0.008, 0.22, 0.008, '#3d4a4f'); p.position.set(x, 0.11, z); strand.add(p); });
  for (let k = 0; k < lampPos.length - 2; k++) { const a = lampPos[k], b = lampPos[k + 2]; for (let i = 1; i < 8; i++) { const u = i / 8; const bl = new T3.Mesh(new T3.SphereGeometry(0.008, 6, 4), bulbsMat[i % 4]); bl.position.set(a[0], 0.22 - Math.sin(u * Math.PI) * 0.05, lerp(a[1], b[1], u)); strand.add(bl); } }
  for (let k = 0; k < 6; k += 2) { const a = lampPos[k], b = lampPos[k + 1]; for (let i = 1; i < 6; i++) { const u = i / 6; const bl = new T3.Mesh(new T3.SphereGeometry(0.008, 6, 4), bulbsMat[i % 4]); bl.position.set(lerp(a[0], b[0], u), 0.22 - Math.sin(u * Math.PI) * 0.04, a[1]); strand.add(bl); } }
  addPop(strand, 0, 0, 'grow', null, { t0: popStart(0, 1.2) });
  // people walking along paths
  const lens = PATHS.map(pl => { let L = 0; for (let i = 1; i < pl.length; i++) L += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); return L; });
  const at = (pl, s) => { for (let i = 1; i < pl.length; i++) { const l = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); if (s <= l) return [lerp(pl[i - 1][0], pl[i][0], s / l), lerp(pl[i - 1][1], pl[i][1], s / l)]; s -= l; } return pl[pl.length - 1]; };
  const counts = [34, 12, 10, 12, 12, 4, 8, 8, 10, 10];
  PATHS.forEach((pl, pi) => { for (let k = 0; k < counts[pi]; k++) { const u0 = R(), dir = R() < 0.5 ? 1 : -1, sp = 0.05 + R() * 0.05, off = (R() - 0.5) * 0.16; const g = person(SHIRTS[R() * 10 | 0], SKIN[R() * 4 | 0]); const sc = 0.85 + R() * 0.35; g.scale.setScalar(sc); const p0 = at(pl, u0 * lens[pi]); const ph = R() * 6; const hasB = R() < 0.12; if (hasB) { const b = balloon(SHIRTS[R() * 10 | 0]); b.scale.setScalar(0.45); b.position.x = 0.02; g.add(b); }
    const gg = addPop(g, p0[0], p0[1], 'hinge', (t, lt) => { const s = ((u0 * lens[pi] + dir * sp * Math.max(0, lt - 0.3)) % lens[pi] + lens[pi]) % lens[pi]; const q = at(pl, s); gg.position.set(q[0] + off * 0.5, Math.abs(Math.sin(t * 9 + ph)) * 0.008, q[1] + off * 0.3); }); } });
  for (let k = 0; k < 26; k++) { const a = R() * 6.283, r = 0.42 + R() * 0.15; const g = person(SHIRTS[R() * 10 | 0], SKIN[R() * 4 | 0]); const ph = R() * 6, w = (R() - 0.5) * 0.4; const gg = addPop(g, Math.cos(a) * r, Math.sin(a) * r, 'hinge', (t, lt) => { const aa = a + w * Math.max(0, lt - 0.3); gg.position.set(Math.cos(aa) * r, Math.abs(Math.sin(t * 8 + ph)) * 0.008, Math.sin(aa) * r); }); }
  // balloon bunches
  [[0.35, 0.62], [-0.38, -0.55], [0.9, 1.0], [-1.0, 0.8], [-0.4, 2.1]].forEach(([x, z], i) => { const g = new T3.Group(); for (let k = 0; k < 5; k++) { const b = balloon(SHIRTS[(i * 5 + k) % 10]); b.position.set((k - 2) * 0.03, 0, 0); b.rotation.z = (k - 2) * 0.18; b.scale.setScalar(0.8 + (k % 2) * 0.15); g.add(b); } addPop(g, x, z, 'hinge', (t) => { g.children.forEach((b, k) => b.rotation.z = (k - 2) * 0.18 + Math.sin(t * 2.5 + k + i) * 0.06); }); });
})();

// ---------------------------------------------------------------- post: depth of field + grade
const rt = new T3.WebGLRenderTarget(W * SS, W * SS, { type: T3.HalfFloatType });
rt.depthTexture = new T3.DepthTexture(W * SS, W * SS); rt.depthTexture.type = T3.UnsignedIntType;
const postScene = new T3.Scene(); const postCam = new T3.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new T3.ShaderMaterial({
  uniforms: { tC: { value: rt.texture }, tD: { value: rt.depthTexture }, near: { value: camera.near }, far: { value: camera.far }, focus: { value: 5 }, ap: { value: 1 }, res: { value: new T3.Vector2(W * SS, W * SS) }, uT: { value: 0 } },
  vertexShader: `varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `precision highp float; uniform sampler2D tC, tD; uniform float near, far, focus, ap, uT; uniform vec2 res; varying vec2 v;
  float lin(float d){ float z = d*2.-1.; return 2.*near*far/(far+near - z*(far-near)); }
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  float coc(vec2 uv){ float d = lin(texture2D(tD, uv).r); return clamp(abs(d - focus)/d * ap * 60., 0., 14.); }
  void main(){
    float c0 = coc(v);
    vec3 acc = vec3(0.); float wsum = 0.;
    const int NS = 28;
    for(int i=0;i<NS;i++){
      float fi = float(i); float r = sqrt((fi+.5)/float(NS)); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r;
      vec2 uv = v + o*max(c0,1.2)/res*1.5;
      float cs = coc(uv);
      float w = smoothstep(0., 1., cs - r*max(c0,1.2) + 1.) ; w = max(w, .02);
      if (cs >= c0*.7) w = 1.;
      acc += texture2D(tC, uv).rgb * w; wsum += w;
    }
    vec3 col = acc/wsum;
    // warm tabletop grade + vignette + fine grain
    col = pow(col, vec3(0.97));
    col *= vec3(1.04, 1.0, .93);
    float vg = length(v - vec2(.5, .52)); col *= 1. - .45*pow(vg*1.2, 2.4);
    col += (h(v*1000.+uT) - .5)*.02;
    gl_FragColor = vec4(col, 1.);
  }`,
  depthTest: false, depthWrite: false,
});
postScene.add(new T3.Mesh(new T3.PlaneGeometry(2, 2), postMat));

// ---------------------------------------------------------------- camera path
function setCamera(t) {
  const u = ease(clamp((t - 0.25) / 1.45));
  const start = { p: new T3.Vector3(0.15, 1.55, 2.0), l: new T3.Vector3(0, 0.0, 0.02), f: 2.45 };
  const end = { p: new T3.Vector3(0.0, 5.0, 6.9), l: new T3.Vector3(0.1, 0.42, -0.45) };
  const push = sstep(1.6, 3.0, t);
  const p = start.p.clone().lerp(end.p, u); const l = start.l.clone().lerp(end.l, u);
  p.lerp(l, push * 0.06); p.x += Math.sin(t * 0.6) * 0.06 * u;
  camera.position.copy(p); camera.lookAt(l); camera.updateMatrixWorld();
  postMat.uniforms.focus.value = p.distanceTo(l) * lerp(0.98, 0.95, u);
  postMat.uniforms.ap.value = lerp(0.3, 0.3, u);
}

window.renderFrame = async function (i) {
  const t = i / FPS;
  updateFolds(t); updatePops(t); updateCoaster(t); setCamera(t);
  postMat.uniforms.uT.value = t;
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  renderer.getContext().finish();
};
window.READY = true;
