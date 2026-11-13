// ------------------------------------------------------------------
// KILN — a concept phone. Squircle slab, speckled kiln-fired ceramic back, anodized frame with polished chamfers,
// iris camera disc, a clay crown dial on the right, and a glowing "Ask" strip on the left.
// Local axes: x right, y up, z out of the screen. Height 1.56 units.
// ------------------------------------------------------------------
import * as THREE from 'three';

export const DIM = { W: 0.74, H: 1.56, R: 0.13, D: 0.056, BV: 0.011 };

export function squircle(w, h, r, n = 4.2, seg = 28) {
  const pts = [], cs = [[w / 2 - r, h / 2 - r, 0], [-(w / 2 - r), h / 2 - r, 1], [-(w / 2 - r), -(h / 2 - r), 2], [w / 2 - r, -(h / 2 - r), 3]];
  for (const [cx, cy, q] of cs) for (let i = 0; i <= seg; i++) {
    const th = (q + i / seg) * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
    pts.push(new THREE.Vector2(cx + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)));
  }
  return pts;
}
function slab(w, h, r, depth, bevel, segs = 6) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(squircle(w, h, r)), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, steps: 1 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
function flatShape(w, h, r) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(squircle(w, h, r)), 1), uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}
// a closed polished line following the squircle outline (chamfer highlight)
function chamfer(w, h, r, rad) {
  const pts = squircle(w, h, r, 4.2, 24).map(p => new THREE.Vector3(p.x, p.y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  return new THREE.TubeGeometry(curve, 480, rad, 6, true);
}

export const FINISH = {
  ivory: { back: '#efe5d8', speck: '#6e5a48', frame: '#cdbfae', dial: '#c8653e', ring: '#bfb2a4', mark: '#d9c9b6' },
  clay: { back: '#c86d49', speck: '#4a2216', frame: '#b06446', dial: '#f2c9a8', ring: '#94503a', mark: '#a95736' },
  ink: { back: '#1d1b1e', speck: '#6a5f58', frame: '#45403f', dial: '#d97757', ring: '#2c2829', mark: '#2e2a2c' },
};

// speckled ceramic: base colour map + bump/roughness micro texture (kiln speckle, glaze pooling)
const TEX = {};
function ceramicMaps(fin) {
  if (TEX[fin]) return TEX[fin];
  const F = FINISH[fin], N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  x.fillStyle = F.back; x.fillRect(0, 0, N, N);
  let s = 11; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  // glaze pooling: big soft blotches
  for (let i = 0; i < 0; i++) { const X = r() * N, Y = r() * N, R = 60 + r() * 160, g = x.createRadialGradient(X, Y, 0, X, Y, R); const l = r() > 0.5; g.addColorStop(0, l ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.022)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(X - R, Y - R, 2 * R, 2 * R); }
  // iron speckle
  x.fillStyle = F.speck; for (let i = 0; i < 1800; i++) { const X = r() * N, Y = r() * N, R = 0.4 + r() * r() * 1.8; x.globalAlpha = 0.2 + r() * 0.45; x.beginPath(); x.arc(X, Y, R, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  const d = x.getImageData(0, 0, N, N), a = d.data; for (let i = 0; i < a.length; i += 4) { const n = (r() - 0.5) * 7; a[i] += n; a[i + 1] += n; a[i + 2] += n; } x.putImageData(d, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1.2, 1.2); map.anisotropy = 8;
  // bump: fine orange-peel of a glaze
  const b = document.createElement('canvas'); b.width = b.height = 512; const y = b.getContext('2d'); y.fillStyle = '#808080'; y.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const X = r() * 512, Y = r() * 512, R = 1 + r() * 3.5; const g = y.createRadialGradient(X, Y, 0, X, Y, R); const v = r() > 0.5 ? 255 : 0; g.addColorStop(0, `rgba(${v},${v},${v},0.18)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); y.fillStyle = g; y.fillRect(X - R, Y - R, 2 * R, 2 * R); }
  const bump = new THREE.CanvasTexture(b); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(3, 3);
  return (TEX[fin] = { map, bump });
}
// brushed (anodized) metal: fine directional streaks as a roughness map
let BRUSH = null;
function brushMap() {
  if (BRUSH) return BRUSH; const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, 512, 64);
  let s = 3; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 700; i++) { const v = Math.floor(90 + r() * 90); x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(r() * 512, r() * 64, 40 + r() * 200, 1); }
  BRUSH = new THREE.CanvasTexture(c); BRUSH.wrapS = BRUSH.wrapT = THREE.RepeatWrapping; BRUSH.repeat.set(6, 30); return BRUSH;
}

export function buildPhone(screenTex, finish = 'ivory') {
  const F = FINISH[finish], { W, H, R, D, BV } = DIM, g = new THREE.Group(), parts = {}, CM = ceramicMaps(finish);
  const mFrame = new THREE.MeshPhysicalMaterial({ color: F.frame, metalness: 1, roughness: 0.3, roughnessMap: brushMap(), anisotropy: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.12 });
  const mChamfer = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(F.frame).lerp(new THREE.Color('#ffffff'), 0.45), metalness: 1, roughness: 0.06 });
  const mBack = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: CM.map, metalness: 0.0, roughness: 0.38, bumpMap: CM.bump, bumpScale: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.05, specularIntensity: 0.6, sheen: 0.25, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5 });
  const mGlass = new THREE.MeshPhysicalMaterial({ color: '#030304', metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.0, specularIntensity: 1 });
  const mScreen = new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0.05, metalness: 0, emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.0, envMapIntensity: 0.5 });
  const mDial = new THREE.MeshPhysicalMaterial({ color: F.dial, metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const mLensBlack = new THREE.MeshPhysicalMaterial({ color: '#010102', metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.0, iridescence: 0.12, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 600], specularIntensity: 0.6 });
  const mIris = new THREE.MeshPhysicalMaterial({ color: '#b89272', metalness: 1, roughness: 0.14, iridescence: 0.35, iridescenceIOR: 1.5, emissive: '#2a0e05', emissiveIntensity: 1 });
  const mLensGlow = new THREE.MeshBasicMaterial({ color: '#ff6a35', toneMapped: false, transparent: true, opacity: 0.0 });
  const mAsk = new THREE.MeshPhysicalMaterial({ color: '#d97757', emissive: '#ff7a45', emissiveIntensity: 0.25, roughness: 0.18, metalness: 0.2, clearcoat: 1, transmission: 0 });
  const mPolish = new THREE.MeshPhysicalMaterial({ color: '#d8d2cc', metalness: 1, roughness: 0.05 });

  // frame ring
  const outer = new THREE.Shape(squircle(W - 2 * BV, H - 2 * BV, R - BV)); outer.holes.push(new THREE.Path(squircle(W - 0.05, H - 0.05, R - 0.03).reverse()));
  const frameG = new THREE.ExtrudeGeometry(outer, { depth: D, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 8, steps: 1 }); frameG.translate(0, 0, -D / 2); frameG.computeVertexNormals();
  parts.frame = new THREE.Mesh(frameG, mFrame); g.add(parts.frame);
  const zF = D / 2 + BV * 0.55, zB = -zF;
  // polished chamfers at the front and back edges of the frame
  for (const z of [D / 2 + BV * 0.62, -(D / 2 + BV * 0.62)]) { const c = new THREE.Mesh(chamfer(W - 0.026, H - 0.026, R - 0.016, 0.0022), mChamfer); c.position.z = z; parts.frame.add(c); }
  // front: glass + screen
  parts.front = new THREE.Group(); parts.front.position.z = zF;
  parts.front.add(new THREE.Mesh(slab(W - 0.032, H - 0.032, R - 0.02, 0.004, 0.0035), mGlass));
  parts.screen = new THREE.Mesh(flatShape(W - 0.05, H - 0.05, R - 0.034), mScreen); parts.screen.position.z = 0.0059; parts.front.add(parts.screen);
  g.add(parts.front);
  // back: ceramic panel + camera disc + mark
  parts.back = new THREE.Group(); parts.back.position.z = zB; parts.back.rotation.y = Math.PI;
  parts.back.add(new THREE.Mesh(slab(W - 0.032, H - 0.032, R - 0.02, 0.004, 0.0035), mBack));
  const cam = new THREE.Group(); cam.position.set(0, H / 2 - 0.27, 0.004);
  const cyl = (r, h, m, seg = 96) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); c.rotation.x = Math.PI / 2; return c; };
  const discBase = cyl(0.19, 0.016, new THREE.MeshPhysicalMaterial({ color: F.ring, metalness: 1, roughness: 0.2, roughnessMap: brushMap(), clearcoat: 0.5 })); discBase.position.z = 0.008; cam.add(discBase);
  const discRim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.0035, 12, 160), mChamfer); discRim.position.z = 0.016; cam.add(discRim);
  const discGlass = cyl(0.178, 0.006, mLensBlack); discGlass.position.z = 0.017; cam.add(discGlass);
  parts.irises = [];
  for (const [lx, ly, lr] of [[-0.068, 0.03, 0.058], [0.068, 0.03, 0.058], [0, -0.075, 0.042]]) {
    const ring = cyl(lr + 0.008, 0.008, mPolish); ring.position.set(lx, ly, 0.022); cam.add(ring);
    const lens = cyl(lr, 0.01, mLensBlack); lens.position.set(lx, ly, 0.024); cam.add(lens);
    const el = new THREE.Mesh(new THREE.TorusGeometry(lr * 0.72, 0.0016, 8, 96), mPolish); el.position.set(lx, ly, 0.0292); cam.add(el);
    const iris = new THREE.Group(); iris.position.set(lx, ly, 0.0295);
    // iris blades: a ring of thin wedges that can open/close
    for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.CircleGeometry(lr * 0.5, 3, 0, 0.9), mIris); b.rotation.z = i / 9 * Math.PI * 2; b.position.set(Math.cos(i / 9 * 6.283) * lr * 0.08, Math.sin(i / 9 * 6.283) * lr * 0.08, i * 0.0001); iris.add(b); }
    const pupil = cyl(lr * 0.16, 0.004, mLensBlack); pupil.position.z = 0.0015; iris.add(pupil);
    const lg = new THREE.Mesh(new THREE.RingGeometry(lr * 0.52, lr * 0.56, 96), mLensGlow); lg.position.z = 0.0008; iris.add(lg);
    cam.add(iris); parts.irises.push(iris);
  }
  const flash = cyl(0.016, 0.004, new THREE.MeshStandardMaterial({ color: '#fff3dc', roughness: 0.6, emissive: '#fff0d0', emissiveIntensity: 0.05 })); flash.position.set(0.12, -0.09, 0.021); cam.add(flash);
  parts.back.add(cam); parts.camera = cam;
  const mMark = new THREE.MeshPhysicalMaterial({ color: F.mark, metalness: 0.85, roughness: 0.12, clearcoat: 1 });
  const mark = new THREE.Group(); mark.position.set(0, -0.2, 0.0045);
  mark.add(new THREE.Mesh(new THREE.RingGeometry(0.036, 0.046, 64), mMark)); mark.add(new THREE.Mesh(new THREE.CircleGeometry(0.013, 48), mMark)); parts.back.add(mark); parts.mark = mark;
  g.add(parts.back);
  // right side: crown dial + slim key ; left side: the glowing Ask strip
  const dial = new THREE.Group(); dial.position.set(W / 2 + 0.004, 0.3, 0);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.024, 64), mDial); crown.rotation.z = Math.PI / 2; dial.add(crown);
  const ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, 0.0045, 0.006), mDial, 40), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; e.set(a, 0, 0); q.setFromEuler(e); mm.compose(new THREE.Vector3(0, Math.cos(a) * 0.035, Math.sin(a) * 0.035), q, new THREE.Vector3(1, 1, 1)); ridges.setMatrixAt(i, mm); }
  dial.add(ridges);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.026, 48), new THREE.MeshPhysicalMaterial({ color: '#f6ede4', metalness: 1, roughness: 0.1 })); cap.rotation.y = Math.PI / 2; cap.position.x = 0.0125; dial.add(cap);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0018, 8, 64), mChamfer); capRing.rotation.y = Math.PI / 2; capRing.position.x = 0.0122; dial.add(capRing);
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.016, 0.003), new THREE.MeshBasicMaterial({ color: '#ff7a45', toneMapped: false })); notch.position.set(0.0128, 0.012, 0); dial.add(notch);
  g.add(dial); parts.dial = dial;
  const key = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.12, 8, 24), mFrame); key.scale.set(0.8, 1, 1.35); key.position.set(W / 2 + 0.003, 0.05, 0); g.add(key);
  parts.ask = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.26, 8, 24), mAsk); parts.ask.scale.set(0.8, 1, 1.25); parts.ask.position.set(-(W / 2 + 0.003), 0.2, 0); g.add(parts.ask);
  // internals (only seen exploded)
  parts.core = new THREE.Group();
  const battery = new THREE.Mesh(slab(W - 0.16, H * 0.5, 0.04, 0.012, 0.004), new THREE.MeshPhysicalMaterial({ color: '#5a5552', metalness: 1, roughness: 0.42, roughnessMap: brushMap() })); battery.position.set(0, -0.22, -0.006); parts.core.add(battery);
  const board = new THREE.Mesh(slab(W - 0.12, H * 0.36, 0.05, 0.006, 0.002), new THREE.MeshPhysicalMaterial({ color: '#1e1c1d', metalness: 0.3, roughness: 0.5 })); board.position.set(0, 0.48, 0.002); parts.core.add(board);
  const chipM = new THREE.MeshPhysicalMaterial({ color: '#0d0c0e', metalness: 0.4, roughness: 0.12, clearcoat: 1 });
  for (const [cx, cy, s] of [[-0.18, 0.56, 0.07], [0.17, 0.4, 0.06], [0.2, 0.58, 0.05], [-0.16, 0.38, 0.05]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, 0.008), chipM); c.position.set(cx, cy, 0.008); parts.core.add(c); }
  // fine traces on the board
  const traceM = new THREE.MeshBasicMaterial({ color: '#ff8a55', toneMapped: false, transparent: true, opacity: 0.6 }); parts.traceM = traceM;
  for (let i = 0; i < 14; i++) { const tr = new THREE.Mesh(new THREE.PlaneGeometry(0.22 + (i % 4) * 0.04, 0.0025), traceM); tr.position.set((i % 2 ? 1 : -1) * 0.11, 0.33 + i * 0.022, 0.0055); parts.core.add(tr); }
  parts.chip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.012), chipM); parts.chip.position.set(0, 0.47, 0.01); parts.core.add(parts.chip);
  parts.chipGlow = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.062, 64), new THREE.MeshBasicMaterial({ color: '#ff9a66', toneMapped: false })); parts.chipGlow.position.set(0, 0.47, 0.0165); parts.core.add(parts.chipGlow);
  parts.core.visible = false; g.add(parts.core);
  parts.materials = { mScreen, mAsk, mBack, mFrame, mGlass, mLensGlow };
  g.userData.parts = parts; g.userData.finish = finish; return g;
}
export function explode(phone, k) {
  const p = phone.userData.parts, { D, BV } = DIM, zF = D / 2 + BV * 0.55, e = k;
  p.front.position.set(0, e * 0.06, zF + e * 0.62); p.front.rotation.set(0, 0, e * 0.02);
  p.back.position.set(0, -e * 0.05, -zF - e * 0.62); p.back.rotation.set(0, Math.PI, -e * 0.02);
  p.core.visible = Math.abs(k) > 0.001; p.core.position.set(0, 0, e * 0.06);
  p.core.children[0].position.z = -0.006 - e * 0.3; p.core.children.slice(1).forEach(c => { c.position.z = (c.userData.z0 ??= c.position.z) + e * 0.25; });
  p.dial.position.x = DIM.W / 2 + 0.004 + e * 0.25; p.ask.position.x = -(DIM.W / 2 + 0.003) - e * 0.22 + (p.askPress || 0);
}
export function setIris(phone, open, rot = 0) {   // open 0..1 : blades fold back
  phone.userData.parts.irises.forEach(ir => { ir.rotation.z = rot; ir.children.forEach((b, i) => { if (i < 9) { b.scale.setScalar(1 - open * 0.55); } }); });
  phone.userData.parts.materials.mLensGlow.opacity = phone.userData.lensGlow || 0;
}
export function pressAsk(phone, k) { const p = phone.userData.parts; p.askPress = k * 0.006; p.ask.position.x = -(DIM.W / 2 + 0.003) + k * 0.006; }
