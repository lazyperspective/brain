// ------------------------------------------------------------------
// KILN — concept phone, studio-grade build.
// Local axes: x right, y up, z out of the screen. Height 1.56 units (1 unit ≈ 100 mm).
//  ceramic back: glazed (clearcoat) over a micro-grain body, warm edge translucency
//  frame: anodized champagne aluminium, brushed along the perimeter (anisotropic GGX), diamond-cut chamfers
//  camera: concentric-brushed disc, chamfered bezels, coated domed front elements, 9-blade iris, deep inner element
//  crown: clay anodized dial with 72-ridge knurl + concentric-brushed cap; Ask strip: glass capsule with a light core
// ------------------------------------------------------------------
import * as THREE from 'three';

export const DIM = { W: 0.74, H: 1.56, R: 0.13, D: 0.056, BV: 0.011 };
const PI = Math.PI;

export function squircle(w, h, r, n = 4.2, seg = 28) {
  const pts = [], cs = [[w / 2 - r, h / 2 - r, 0], [-(w / 2 - r), h / 2 - r, 1], [-(w / 2 - r), -(h / 2 - r), 2], [w / 2 - r, -(h / 2 - r), 3]];
  for (const [cx, cy, q] of cs) for (let i = 0; i <= seg; i++) {
    const th = (q + i / seg) * PI / 2, c = Math.cos(th), s = Math.sin(th);
    pts.push(new THREE.Vector2(cx + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)));
  }
  return pts;
}
function slab(w, h, r, depth, bevel, seg = 6) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(squircle(w, h, r)), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, steps: 1, curveSegments: 12 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
function flatShape(w, h, r) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(squircle(w, h, r)), 1), uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}

// ---------------------------------------------------------------- procedural textures
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texOf(c, rep = 1, srgb = false) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// height field → tangent-space normal map
function normalFromHeight(hf, S, k) {
  const c = canvasOf(S, S), x = c.getContext('2d'), d = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const hL = hf[j * S + (i - 1 + S) % S], hR = hf[j * S + (i + 1) % S], hD = hf[((j + 1) % S) * S + i], hU = hf[((j - 1 + S) % S) * S + i];
    let nx = (hL - hR) * k, ny = (hD - hU) * k, nz = 1; const l = Math.hypot(nx, ny, nz); const o = (j * S + i) * 4;
    d.data[o] = (nx / l * 0.5 + 0.5) * 255; d.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; d.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0); return c;
}
function valueNoise(S, cells, oct = 4) {
  const hf = new Float32Array(S * S);
  for (let o = 0, amp = 1, n = cells; o < oct; o++, amp *= 0.5, n *= 2) {
    const g = new Float32Array(n * n).map(() => rnd());
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const fx = i / S * n, fy = j / S * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % n) * n + x0 % n], b = g[(y0 % n) * n + (x0 + 1) % n], c = g[((y0 + 1) % n) * n + x0 % n], d = g[((y0 + 1) % n) * n + (x0 + 1) % n];
      hf[j * S + i] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
    }
  }
  return hf;
}
const TEX = {};
function textures() {
  if (TEX.ready) return TEX;
  // ceramic body: fine grain + speckle (the micro-texture under the glaze)
  { const S = 512, hf = valueNoise(S, 64, 3); for (let i = 0; i < S * S; i++) hf[i] += (rnd() - 0.5) * 0.35; TEX.ceramicN = texOf(normalFromHeight(hf, S, 2.2), 6); }
  // glaze: very soft orange-peel undulation for the clearcoat
  { const S = 256, hf = valueNoise(S, 8, 3); TEX.glazeN = texOf(normalFromHeight(hf, S, 1.4), 2); }
  // brushed roughness (green channel) — fine lines along u
  { const S = 1024, c = canvasOf(S, 64), x = c.getContext('2d'); const d = x.createImageData(S, 64);
    const rows = new Float32Array(64).map(() => rnd());
    for (let j = 0; j < 64; j++) for (let i = 0; i < S; i++) { const v = 0.75 + 0.35 * rows[j] + 0.12 * Math.sin(i * 0.05 + rows[j] * 30) * rnd(); const o = (j * S + i) * 4; d.data[o] = d.data[o + 1] = d.data[o + 2] = Math.min(255, v * 200); d.data[o + 3] = 255; }
    x.putImageData(d, 0, 0); TEX.brushR = texOf(c, 1); TEX.brushR.repeat.set(4, 40);
    const hf = new Float32Array(S * 64); for (let j = 0; j < 64; j++) for (let i = 0; i < S; i++) hf[j * S + i] = rows[j] * 0.6 + rnd() * 0.05;
    TEX.brushN = texOf(normalFromHeight(hf, 64, 0.8), 1); }
  // concentric anisotropy direction map (+ fine concentric roughness rings) for discs and caps
  { const S = 512, c = canvasOf(S, S), x = c.getContext('2d'), d = x.createImageData(S, S), r = canvasOf(S, S), rx = r.getContext('2d'), rd = rx.createImageData(S, S);
    const ring = new Float32Array(400).map(() => rnd());
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const u = i / S - 0.5, v = 0.5 - j / S, l = Math.hypot(u, v) + 1e-6, o = (j * S + i) * 4;
      d.data[o] = (-v / l * 0.5 + 0.5) * 255; d.data[o + 1] = (u / l * 0.5 + 0.5) * 255; d.data[o + 2] = 255; d.data[o + 3] = 255;
      const q = 0.7 + 0.5 * ring[Math.min(399, Math.floor(l * 2 * 400))]; rd.data[o] = rd.data[o + 1] = rd.data[o + 2] = Math.min(255, q * 190); rd.data[o + 3] = 255;
    }
    x.putImageData(d, 0, 0); rx.putImageData(rd, 0, 0); TEX.radialA = new THREE.CanvasTexture(c); TEX.radialR = new THREE.CanvasTexture(r); }
  // flash: fresnel rings
  { const S = 256, c = canvasOf(S, S), x = c.getContext('2d'); x.fillStyle = '#e9dfcf'; x.fillRect(0, 0, S, S);
    for (let k = 1; k < 14; k++) { x.strokeStyle = `rgba(150,130,110,${0.5 - k * 0.02})`; x.lineWidth = 2; x.beginPath(); x.arc(128, 128, k * 9, 0, 7); x.stroke(); }
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,250,235,0.9)'); g.addColorStop(1, 'rgba(255,250,235,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    TEX.flash = new THREE.CanvasTexture(c); TEX.flash.colorSpace = THREE.SRGBColorSpace; }
  // Ask-strip light core: bright below the fill line, a hot leading edge
  { const c = canvasOf(4, 512), x = c.getContext('2d'); const g = x.createLinearGradient(0, 512, 0, 0);
    g.addColorStop(0, '#ffb98f'); g.addColorStop(0.44, '#ffc8a2'); g.addColorStop(0.485, '#ffffff'); g.addColorStop(0.5, '#ff9a66'); g.addColorStop(0.54, '#301208'); g.addColorStop(1, '#000000');
    x.fillStyle = g; x.fillRect(0, 0, 4, 512); TEX.flow = new THREE.CanvasTexture(c); TEX.flow.colorSpace = THREE.SRGBColorSpace; TEX.flow.wrapT = THREE.ClampToEdgeWrapping; }
  TEX.ready = true; return TEX;
}
// 9-blade iris aperture, drawn into a texture (a = opening 0..1)
function makeIris() {
  const S = 512, c = canvasOf(S, S), x = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; let last = -1;
  function draw(a, rot = 0) {
    if (Math.abs(a - last) < 0.002) return; last = a;
    const R = S / 2, ro = R * (0.18 + 0.7 * a), n = 9; x.clearRect(0, 0, S, S);
    let g; x.fillStyle = '#0b0a0e'; x.fillRect(0, 0, S, S);
    // blades: each a curved sliver, overlapping, catching light on one edge
    for (let i = 0; i < n; i++) {
      const th = rot + i / n * PI * 2 + a * 0.9; x.save(); x.translate(R, R); x.rotate(th);
      x.beginPath(); x.moveTo(ro, 0); x.quadraticCurveTo(ro * 1.05 + R * 0.25, -R * 0.55, R * 1.1, -R * 0.3); x.lineTo(R * 1.2, R * 0.6); x.quadraticCurveTo(R * 0.6, R * 0.3, ro * Math.cos(2 * PI / n), ro * Math.sin(2 * PI / n)); x.closePath();
      g = x.createLinearGradient(ro, 0, R, -R * 0.3); g.addColorStop(0, '#2c2b30'); g.addColorStop(0.5, '#141317'); g.addColorStop(1, '#0c0b0e'); x.fillStyle = g; x.fill();
      x.strokeStyle = 'rgba(190,180,200,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(ro, 0); x.quadraticCurveTo(ro * 1.05 + R * 0.25, -R * 0.55, R * 1.1, -R * 0.3); x.stroke();
      x.restore();
    }
    // aperture lip highlight
    x.strokeStyle = 'rgba(220,210,230,0.18)'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= n; i++) { const th = rot + i / n * PI * 2 + a * 0.9; const px = R + ro * Math.cos(th), py = R + ro * Math.sin(th); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    // barrel shadow ring
    g = x.createRadialGradient(R, R, R * 0.8, R, R, R); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.9)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    // punch the aperture (we see the deep element through it)
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); for (let i = 0; i <= n; i++) { const th = rot + i / n * PI * 2 + a * 0.9; const px = R + ro * Math.cos(th), py = R + ro * Math.sin(th); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.fill(); x.globalCompositeOperation = 'source-over';
    tex.needsUpdate = true;
  }
  draw(1); return { tex, draw };
}

export const FINISH = { ivory: { back: '#f2ece3', frame: '#dccdbd', dial: '#b95f3d', ring: '#ddd0c1', mark: '#e9dfd2' } };

export function buildPhone(screenTex, finish = 'ivory') {
  const T = textures(), F = FINISH[finish], { W, H, R, D, BV } = DIM, g = new THREE.Group(), parts = {};
  // --- materials
  const mFrame = new THREE.MeshPhysicalMaterial({ color: F.frame, metalness: 1, roughness: 0.34, roughnessMap: T.brushR, anisotropy: 0.85, anisotropyRotation: 0, envMapIntensity: 1.15, clearcoat: 0.25, clearcoatRoughness: 0.2 });
  const mChamfer = new THREE.MeshPhysicalMaterial({ color: '#efe2d2', metalness: 1, roughness: 0.07, envMapIntensity: 1.6 });
  const mBack = new THREE.MeshPhysicalMaterial({ color: F.back, metalness: 0, roughness: 0.42, normalMap: T.ceramicN, normalScale: new THREE.Vector2(0.1, 0.1),
    clearcoat: 1, clearcoatRoughness: 0.07, clearcoatNormalMap: T.glazeN, clearcoatNormalScale: new THREE.Vector2(0.012, 0.012), sheen: 0.4, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.45, specularIntensity: 0.6 });
  // fake subsurface: warm translucency that rises at grazing angles and in light wrap
  mBack.onBeforeCompile = sh => {
    sh.uniforms.sss = { value: 0.12 };
    sh.fragmentShader = 'uniform float sss;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { float fr = pow(1.0 - saturate(dot(normal, geometryViewDir)), 2.2); reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(1.0, 0.72, 0.52) * (0.10 + fr * 0.9) * sss; }`);
  };
  const mGlass = new THREE.MeshPhysicalMaterial({ color: '#030304', metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.01, specularIntensity: 1, envMapIntensity: 1.4 });
  const mScreen = new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color(1, 1, 1) });
  const mReflect = new THREE.MeshStandardMaterial({ color: '#000000', metalness: 0, roughness: 0.02, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1 });
  const mDial = new THREE.MeshPhysicalMaterial({ color: F.dial, metalness: 1, roughness: 0.3, anisotropy: 0.6, anisotropyRotation: PI / 2, clearcoat: 0.15, clearcoatRoughness: 0.2, envMapIntensity: 0.75 });
  const mDialCap = new THREE.MeshPhysicalMaterial({ color: '#f1e3d4', metalness: 1, roughness: 0.18, roughnessMap: T.radialR, anisotropy: 0.9, anisotropyMap: T.radialA });
  const mRing = new THREE.MeshPhysicalMaterial({ color: F.ring, metalness: 1, roughness: 0.2, roughnessMap: T.radialR, anisotropy: 0.95, anisotropyMap: T.radialA, envMapIntensity: 1.3 });
  const mBezel = new THREE.MeshPhysicalMaterial({ color: '#e8dccd', metalness: 1, roughness: 0.1, envMapIntensity: 1.5 });
  const mBlack = new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.85, metalness: 0 });
  const mDiscGlass = new THREE.MeshPhysicalMaterial({ color: '#07070a', metalness: 0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.0, envMapIntensity: 1.2 });
  const mCoat = new THREE.MeshPhysicalMaterial({ color: '#000000', metalness: 0, roughness: 0.0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    iridescence: 0.8, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 360], envMapIntensity: 0.45, specularIntensity: 1 });
  const mInner = new THREE.MeshPhysicalMaterial({ color: '#0a0a12', metalness: 0.3, roughness: 0.05, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 700], envMapIntensity: 1.5 });
  const mAskGlass = new THREE.MeshPhysicalMaterial({ color: '#fff0e6', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.32, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false });
  const mAskCore = new THREE.MeshStandardMaterial({ color: '#b86a48', roughness: 0.35, metalness: 0.1, emissive: '#ffffff', emissiveMap: T.flow, emissiveIntensity: 0 });
  const mBand = new THREE.MeshStandardMaterial({ color: '#d4c6b6', roughness: 0.62, metalness: 0 });
  const mMark = new THREE.MeshPhysicalMaterial({ color: F.mark, metalness: 0.7, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.4 });

  // --- frame ring (squircle band with rounded edges)
  const outer = new THREE.Shape(squircle(W - 2 * BV, H - 2 * BV, R - BV)); outer.holes.push(new THREE.Path(squircle(W - 0.05, H - 0.05, R - 0.03).reverse()));
  const frameG = new THREE.ExtrudeGeometry(outer, { depth: D, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 10, steps: 1, curveSegments: 12 }); frameG.translate(0, 0, -D / 2); frameG.computeVertexNormals();
  parts.frame = new THREE.Mesh(frameG, mFrame); g.add(parts.frame);
  // diamond-cut chamfers where frame meets glass and ceramic
  const zF = D / 2 + BV * 0.55;
  for (const s of [1, -1]) {
    const pts = squircle(W - 0.03, H - 0.03, R - 0.016, 4.2, 40).map(p => new THREE.Vector3(p.x, p.y, s * (D / 2 + BV * 0.62)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 720, 0.0026, 8, true), mChamfer); g.add(tube);
  }
  // antenna bands
  for (const [sx, sy] of [[1, 0.6], [-1, 0.6], [1, -0.62], [-1, -0.62]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.007, D + BV * 1.4), mBand); b.position.set(sx * (W / 2 - 0.0005), sy, 0); g.add(b); }
  // bottom: port + speaker grille
  { const port = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.04, 6, 16), mBlack); port.rotation.z = PI / 2; port.scale.set(1, 1, 0.9); port.position.set(0, -H / 2 + 0.0035, 0); g.add(port);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.01, 16), mBlack); h.position.set(s * (0.1 + i * 0.022), -H / 2 + 0.003, 0); g.add(h); } }

  // --- front: glass + screen + reflection layer
  parts.front = new THREE.Group(); parts.front.position.z = zF;
  parts.front.add(new THREE.Mesh(slab(W - 0.032, H - 0.032, R - 0.02, 0.004, 0.0035), mGlass));
  parts.screen = new THREE.Mesh(flatShape(W - 0.056, H - 0.056, R - 0.036), mScreen); parts.screen.position.z = 0.0058; parts.front.add(parts.screen);
  parts.reflect = new THREE.Mesh(flatShape(W - 0.036, H - 0.036, R - 0.022), mReflect); parts.reflect.position.z = 0.0062; parts.front.add(parts.reflect);
  // tiny front camera (under-glass dot)
  { const fc = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 32), new THREE.MeshPhysicalMaterial({ color: '#020203', roughness: 0.05, clearcoat: 1, iridescence: 0.6 })); fc.position.set(0, H / 2 - 0.06, 0.006); parts.front.add(fc); parts.frontCam = fc; }
  g.add(parts.front);

  // --- back: ceramic + camera disc + mark
  parts.back = new THREE.Group(); parts.back.position.z = -zF; parts.back.rotation.y = PI;
  parts.back.add(new THREE.Mesh(slab(W - 0.032, H - 0.032, R - 0.02, 0.004, 0.0035, 8), mBack));
  const cam = new THREE.Group(); cam.position.set(0, H / 2 - 0.27, 0.004);
  const cyl = (r, h, m, seg = 128, open = false) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg, 1, open), m); c.rotation.x = PI / 2; return c; };
  const lathe = (prof, m, seg = 128) => { const l = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), seg), m); l.rotation.x = PI / 2; return l; };
  // disc: raised plateau with a chamfered rim (lathe), concentric-brushed top
  cam.add(lathe([[0.2, 0.0], [0.2, 0.006], [0.196, 0.012], [0.19, 0.0145]], mRing));
  const LENS = [[-0.068, 0.03, 0.058], [0.068, 0.03, 0.058], [0, -0.075, 0.042]];
  { const sh = new THREE.Shape(); sh.absarc(0, 0, 0.19, 0, PI * 2, false); for (const [lx, ly, lr] of LENS) { const h = new THREE.Path(); h.absarc(lx, ly, lr + 0.0005, 0, PI * 2, true); sh.holes.push(h); }
    const tg = new THREE.ShapeGeometry(sh, 64), uv = tg.attributes.uv, ps = tg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 0.38 + 0.5, ps.getY(i) / 0.38 + 0.5);
    const top = new THREE.Mesh(tg, mRing); top.position.z = 0.0145; cam.add(top); }
  parts.lenses = [];
  for (const [lx, ly, lr] of LENS) {
    const L = new THREE.Group(); L.position.set(lx, ly, 0.0145); cam.add(L);
    // bezel: polished, stepped, chamfered — rises from the disc
    L.add(lathe([[lr + 0.012, 0.0], [lr + 0.012, 0.004], [lr + 0.009, 0.0075], [lr + 0.004, 0.0085], [lr + 0.0015, 0.007], [lr + 0.0005, 0.004]], mBezel));
    // dark barrel going down into the disc
    const barrel = cyl(lr, 0.02, mBlack, 96, true); barrel.material = mBlack; barrel.position.z = -0.006; L.add(barrel);
    // iris disc (texture, recessed)
    const iris = makeIris(); const im = new THREE.Mesh(new THREE.CircleGeometry(lr, 96), new THREE.MeshStandardMaterial({ map: iris.tex, roughness: 0.35, metalness: 0.5, envMapIntensity: 0.6, alphaTest: 0.5 })); im.position.z = -0.005; L.add(im);
    const deep = new THREE.Mesh(new THREE.CircleGeometry(lr, 64), mBlack); deep.position.z = -0.0155; L.add(deep);
    // deep inner element: a small iridescent dome seen through the aperture
    const inner = new THREE.Mesh(new THREE.SphereGeometry(lr * 0.7, 48, 16, 0, PI * 2, 0, 0.6), mInner); inner.rotation.x = PI / 2; inner.position.z = -0.0145 - lr * 0.7 * Math.cos(0.6); L.add(inner);
    // front element: coated, domed glass (reflection-only additive layer)
    const th = 0.32, Rs = lr / Math.sin(th);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(Rs, 96, 16, 0, PI * 2, 0, th), mCoat); dome.rotation.x = PI / 2; dome.position.z = 0.002 - Rs * Math.cos(th); L.add(dome);
    parts.lenses.push({ group: L, iris, r: lr });
  }
  // flash + mic
  { const fl = new THREE.Mesh(new THREE.CircleGeometry(0.017, 48), new THREE.MeshStandardMaterial({ map: TEX.flash, roughness: 0.25, emissive: '#fff1da', emissiveIntensity: 0.0 })); fl.position.set(0.122, -0.098, 0.0155); cam.add(fl); parts.flash = fl;
    const fr = lathe([[0.0175, 0], [0.021, 0.0], [0.021, 0.002], [0.0185, 0.0035]], mBezel); fr.position.set(0.122, -0.098, 0.0145); cam.add(fr);
    const mic = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 24), mBlack); mic.position.set(-0.122, -0.098, 0.0152); cam.add(mic); }
  parts.back.add(cam); parts.camera = cam;
  // the mark: a polished ring and dot
  { const mark = new THREE.Group(); mark.position.set(0, -0.2, 0.0058);
    mark.add(new THREE.Mesh(new THREE.RingGeometry(0.032, 0.04, 96), mMark)); mark.add(new THREE.Mesh(new THREE.CircleGeometry(0.011, 48), mMark)); parts.back.add(mark); }
  g.add(parts.back);

  // --- crown dial (right side)
  const dial = new THREE.Group(); dial.position.set(W / 2 + 0.002, 0.3, 0);
  { const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.008, 96), mFrame); collar.rotation.z = PI / 2; collar.position.x = 0.001; dial.add(collar); }
  const knurl = new THREE.Group(); knurl.position.x = 0.015; dial.add(knurl);
  { const core = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.022, 96), mDial); core.rotation.z = PI / 2; knurl.add(core);
    const N = 72, ridges = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.02, 8), mDial, N), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < N; i++) { const a = i / N * PI * 2; e.set(a, 0, PI / 2); q.setFromEuler(e); mm.compose(new THREE.Vector3(0, Math.cos(a) * 0.0335, Math.sin(a) * 0.0335), q, new THREE.Vector3(1, 1, 1)); ridges.setMatrixAt(i, mm); }
    knurl.add(ridges);
    const capRim = lathe([[0.034, 0], [0.034, 0.0015], [0.031, 0.003], [0.026, 0.0035]], new THREE.MeshPhysicalMaterial({ color: '#c9a58e', metalness: 1, roughness: 0.22, envMapIntensity: 0.55 }), 96); capRim.rotation.set(0, 0, -PI / 2); capRim.position.x = 0.011; knurl.add(capRim);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.0262, 96), mDialCap); cap.rotation.y = PI / 2; cap.position.x = 0.0146; knurl.add(cap);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0042, 32), new THREE.MeshStandardMaterial({ color: '#ff9a66', emissive: '#ff8a50', emissiveIntensity: 0.6, roughness: 0.3 })); dot.rotation.y = PI / 2; dot.position.set(0.0148, 0.014, 0); knurl.add(dot); }
  g.add(dial); parts.dial = dial; parts.knurl = knurl;
  // slim key (right, below dial)
  { const key = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.12, 8, 24), mFrame); key.scale.set(0.75, 1, 1.3); key.position.set(W / 2 + 0.002, 0.04, 0); g.add(key); }
  // --- Ask strip (left side): dark seat, glowing core, glass capsule
  const ask = new THREE.Group(); ask.position.set(-(W / 2 + 0.001), 0.2, 0); g.add(ask); parts.askG = ask;
  { const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.0118, 0.262, 8, 32), new THREE.MeshPhysicalMaterial({ color: '#4a2a1c', roughness: 0.5, metalness: 0.6 })); seat.scale.set(0.5, 1, 1.2); seat.position.x = 0.002; ask.add(seat);
    parts.askCore = new THREE.Mesh(new THREE.CapsuleGeometry(0.0072, 0.25, 8, 32), mAskCore); parts.askCore.scale.set(0.8, 1, 1.2); parts.askCore.position.x = -0.0012; ask.add(parts.askCore);
    parts.askGlass = new THREE.Mesh(new THREE.CapsuleGeometry(0.0098, 0.258, 8, 32), mAskGlass); parts.askGlass.scale.set(0.8, 1, 1.22); parts.askGlass.position.x = -0.0016; ask.add(parts.askGlass); }

  g.traverse(o => { if (o.isMesh && o !== parts.reflect && o.material !== mCoat) { o.castShadow = true; } });
  parts.materials = { mScreen, mReflect, mBack, mFrame, mGlass, mAskCore, mAskGlass, mCoat, mDial, mChamfer };
  g.userData.parts = parts; return g;
}

// per-frame hardware state
export function setHardware(phone, s) {
  const p = phone.userData.parts, M = p.materials;
  // Ask strip: fill (0..1 travelling light), glow (overall intensity), press (mm inward)
  const fill = s.askFill ?? 0, glow = s.askGlow ?? 0;
  T_flowOffset(fill); M.mAskCore.emissiveIntensity = glow * 2.0; M.mAskCore.color.set(glow > 0.02 ? '#e7a07a' : '#b86a48');
  p.askG.position.x = -(DIM.W / 2 + 0.001) + (s.askPress ?? 0) * 0.0025;
  p.knurl.rotation.x = s.dial ?? 0;
  for (const L of p.lenses) L.iris.draw(s.iris ?? 0.8, 0.3);
  // three ignores material.envMapIntensity when it falls back to scene.environment, so the glass
  // reflection layer carries its own envMap (kept in sync with the scene's rotation/intensity)
  const sc = s.scene;
  if (sc && sc.environment) { M.mReflect.envMap = sc.environment; M.mReflect.envMapRotation.copy(sc.environmentRotation); M.mReflect.envMapIntensity = (s.reflect ?? 1) * sc.environmentIntensity; M.mReflect.needsUpdate = !M.mReflect._hasEnv; M.mReflect._hasEnv = true; }
  M.mScreen.color.setScalar(s.screen ?? 1);
}
function T_flowOffset(fill) { const t = TEX.flow; if (!t) return; t.offset.y = 0.5 - (fill * 1.12 - 0.06); }
