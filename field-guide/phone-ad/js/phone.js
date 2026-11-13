// ------------------------------------------------------------------
// KILN — a concept phone. Squircle slab, ceramic back, iris camera disc, a clay crown dial and a glowing "Ask" strip.
// Local axes: x right, y up, z out of the screen. Height 1.56 units.
// ------------------------------------------------------------------
import * as THREE from 'three';

export const DIM = { W: 0.74, H: 1.56, R: 0.13, D: 0.056, BV: 0.011 };

// continuous-curvature (squircle) rounded rectangle outline
export function squircle(w, h, r, n = 4.2, seg = 28) {
  const pts = [], cs = [[w / 2 - r, h / 2 - r, 0], [-(w / 2 - r), h / 2 - r, 1], [-(w / 2 - r), -(h / 2 - r), 2], [w / 2 - r, -(h / 2 - r), 3]];
  for (const [cx, cy, q] of cs) for (let i = 0; i <= seg; i++) {
    const th = (q + i / seg) * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
    pts.push(new THREE.Vector2(cx + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)));
  }
  return pts;
}
function slab(w, h, r, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(squircle(w, h, r)), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, steps: 1 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
function flatShape(w, h, r) {   // ShapeGeometry with 0..1 UVs
  const g = new THREE.ShapeGeometry(new THREE.Shape(squircle(w, h, r)), 1), uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}

export const FINISH = {
  ivory: { back: '#efe4d6', frame: '#c9b8a6', dial: '#c8653e', ring: '#b8a796' },
  clay: { back: '#c86d49', frame: '#a9583a', dial: '#f2c9a8', ring: '#8e4a31' },
  ink: { back: '#1c1a1d', frame: '#3a3638', dial: '#d97757', ring: '#2a2729' },
};

export function buildPhone(screenTex, finish = 'ivory') {
  const F = FINISH[finish], { W, H, R, D, BV } = DIM, g = new THREE.Group(), parts = {};
  const mFrame = new THREE.MeshPhysicalMaterial({ color: F.frame, metalness: 0.92, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.25 });
  const mBack = new THREE.MeshPhysicalMaterial({ color: F.back, metalness: 0.0, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6 });
  const mGlass = new THREE.MeshPhysicalMaterial({ color: '#050506', metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const mScreen = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.06, metalness: 0, emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 1, envMapIntensity: 0.35 });
  const mDial = new THREE.MeshPhysicalMaterial({ color: F.dial, metalness: 0.85, roughness: 0.26, clearcoat: 0.6 });
  const mLensBlack = new THREE.MeshPhysicalMaterial({ color: '#030305', metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.01 });
  const mIris = new THREE.MeshPhysicalMaterial({ color: '#27365e', metalness: 1, roughness: 0.18, iridescence: 1, iridescenceIOR: 1.6 });
  const mAsk = new THREE.MeshStandardMaterial({ color: '#d97757', emissive: '#ff8a55', emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.3 });

  // frame ring (open in the middle so the phone can be exploded)
  const outer = new THREE.Shape(squircle(W - 2 * BV, H - 2 * BV, R - BV)); outer.holes.push(new THREE.Path(squircle(W - 0.05, H - 0.05, R - 0.03).reverse()));
  const frameG = new THREE.ExtrudeGeometry(outer, { depth: D, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 8, steps: 1 }); frameG.translate(0, 0, -D / 2); frameG.computeVertexNormals();
  parts.frame = new THREE.Mesh(frameG, mFrame); g.add(parts.frame);
  // a thin polished chamfer line on the frame (front and back)
  const zF = D / 2 + BV * 0.55, zB = -zF;
  // front: glass + screen
  parts.front = new THREE.Group(); parts.front.position.z = zF;
  parts.front.add(new THREE.Mesh(slab(W - 0.032, H - 0.032, R - 0.02, 0.004, 0.0035), mGlass));
  parts.screen = new THREE.Mesh(flatShape(W - 0.056, H - 0.056, R - 0.036), mScreen); parts.screen.position.z = 0.0059; parts.front.add(parts.screen);
  g.add(parts.front);
  // back: ceramic panel + camera disc + mark (built facing +z, then turned around)
  parts.back = new THREE.Group(); parts.back.position.z = zB; parts.back.rotation.y = Math.PI;
  parts.back.add(new THREE.Mesh(slab(W - 0.032, H - 0.032, R - 0.02, 0.004, 0.0035), mBack));
  const cam = new THREE.Group(); cam.position.set(0, H / 2 - 0.27, 0.004);
  const cyl = (r, h, m, seg = 96) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); c.rotation.x = Math.PI / 2; return c; };
  const discBase = cyl(0.19, 0.016, new THREE.MeshPhysicalMaterial({ color: F.ring, metalness: 0.9, roughness: 0.22 })); discBase.position.z = 0.008; cam.add(discBase);
  const discGlass = cyl(0.178, 0.006, mLensBlack); discGlass.position.z = 0.017; cam.add(discGlass);
  for (const [lx, ly, lr] of [[-0.068, 0.03, 0.058], [0.068, 0.03, 0.058], [0, -0.075, 0.042]]) {
    const ring = cyl(lr + 0.008, 0.008, mFrame); ring.position.set(lx, ly, 0.022); cam.add(ring);
    const lens = cyl(lr, 0.01, mLensBlack); lens.position.set(lx, ly, 0.024); cam.add(lens);
    const iris = cyl(lr * 0.45, 0.004, mIris); iris.position.set(lx, ly, 0.0295); cam.add(iris);
    const pupil = cyl(lr * 0.16, 0.004, mLensBlack); pupil.position.set(lx, ly, 0.031); cam.add(pupil);
  }
  const flash = cyl(0.016, 0.004, new THREE.MeshStandardMaterial({ color: '#fff3dc', roughness: 0.6, emissive: '#fff0d0', emissiveIntensity: 0.05 })); flash.position.set(0.12, -0.09, 0.021); cam.add(flash);
  parts.back.add(cam); parts.camera = cam;
  // the mark: a ring and a dot (an ember), subtly glossier than the ceramic
  const mMark = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(F.back).multiplyScalar(0.86), metalness: 0.6, roughness: 0.15, clearcoat: 1 });
  const mark = new THREE.Group(); mark.position.set(0, -0.18, 0.0045);
  mark.add(new THREE.Mesh(new THREE.RingGeometry(0.036, 0.046, 64), mMark)); mark.add(new THREE.Mesh(new THREE.CircleGeometry(0.013, 48), mMark)); parts.back.add(mark);
  g.add(parts.back);
  // right side: crown dial + slim key ; left side: the glowing Ask strip
  const dial = new THREE.Group(); dial.position.set(W / 2 + 0.004, 0.3, 0);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.024, 64), mDial); crown.rotation.z = Math.PI / 2; dial.add(crown);
  const ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, 0.0045, 0.006), mDial, 40), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; e.set(a, 0, 0); q.setFromEuler(e); mm.compose(new THREE.Vector3(0, Math.cos(a) * 0.035, Math.sin(a) * 0.035), q, new THREE.Vector3(1, 1, 1)); ridges.setMatrixAt(i, mm); }
  dial.add(ridges); const cap = new THREE.Mesh(new THREE.CircleGeometry(0.026, 48), new THREE.MeshPhysicalMaterial({ color: '#f6ede4', metalness: 0.8, roughness: 0.12 })); cap.rotation.y = Math.PI / 2; cap.position.x = 0.0125; dial.add(cap);
  g.add(dial); parts.dial = dial;
  const key = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.12, 8, 24), mFrame); key.scale.set(0.8, 1, 1.35); key.position.set(W / 2 + 0.003, 0.05, 0); g.add(key);
  parts.ask = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.26, 8, 24), mAsk); parts.ask.scale.set(0.8, 1, 1.25); parts.ask.position.set(-(W / 2 + 0.003), 0.2, 0); g.add(parts.ask);
  // internals (only seen exploded): battery, logic board, the core chip
  parts.core = new THREE.Group();
  const battery = new THREE.Mesh(slab(W - 0.16, H * 0.5, 0.04, 0.012, 0.004), new THREE.MeshPhysicalMaterial({ color: '#a9a39c', metalness: 0.7, roughness: 0.35 })); battery.position.set(0, -0.22, -0.006); parts.core.add(battery);
  const board = new THREE.Mesh(slab(W - 0.12, H * 0.36, 0.05, 0.006, 0.002), new THREE.MeshPhysicalMaterial({ color: '#1e1c1d', metalness: 0.3, roughness: 0.5 })); board.position.set(0, 0.48, 0.002); parts.core.add(board);
  const chipM = new THREE.MeshPhysicalMaterial({ color: '#0d0c0e', metalness: 0.4, roughness: 0.12, clearcoat: 1 });
  for (const [cx, cy, s] of [[-0.18, 0.56, 0.07], [0.17, 0.4, 0.06], [0.2, 0.58, 0.05], [-0.16, 0.38, 0.05]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, 0.008), chipM); c.position.set(cx, cy, 0.008); parts.core.add(c); }
  parts.chip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.012), chipM); parts.chip.position.set(0, 0.47, 0.01); parts.core.add(parts.chip);
  parts.chipGlow = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.062, 64), new THREE.MeshBasicMaterial({ color: '#ff9a66', toneMapped: false })); parts.chipGlow.position.set(0, 0.47, 0.0165); parts.core.add(parts.chipGlow);
  parts.core.visible = false; g.add(parts.core);
  parts.materials = { mScreen, mAsk, mBack, mFrame, mGlass };
  g.userData.parts = parts; return g;
}
// exploded view: 0 = assembled, 1 = fully apart (along z, with a little fan-out)
export function explode(phone, k) {
  const p = phone.userData.parts, { D, BV } = DIM, zF = D / 2 + BV * 0.55, e = k * k * (3 - 2 * k);
  p.front.position.set(0, e * 0.06, zF + e * 0.62); p.front.rotation.set(0, 0, e * 0.02);
  p.back.position.set(0, -e * 0.05, -zF - e * 0.62); p.back.rotation.set(0, Math.PI, -e * 0.02);
  p.core.visible = k > 0.001; p.core.position.set(0, 0, e * 0.06);
  p.core.children[0].position.z = -0.006 - e * 0.3; p.core.children.slice(1).forEach(c => { c.position.z = (c.userData.z0 ??= c.position.z) + e * 0.25; });
}
