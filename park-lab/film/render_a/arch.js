// Buildings (detailed facades), railway bridge, queues, street furniture.
import * as THREE from 'three';
import { hex, T, beamM, rng, GEO, Kit, frame, MG, stripe, lathe, hash, DynKit } from './util.js';

export function buildArchitecture(ctx) {
  const { D, mat, root, pixel, park } = ctx;
  const grp = new THREE.Group(); grp.name = 'arch'; root.add(grp); ctx.archGroup = grp;
  const K = new Kit(grp);
  const M = mat({}); const MV = mat({ vc: true }); const MD = mat({ side: THREE.DoubleSide }); const MVD = mat({ vc: true, side: THREE.DoubleSide });
  const MGlass = mat({ color: 0xffffff, frag: `{ float g = smoothstep(0.,1.,fract(p.y*.45 + p.x*.11 + p.z*.11)); diffuseColor.rgb = mix(diffuseColor.rgb*.75, diffuseColor.rgb*1.45, g*.6); }`, mot: 0 });
  const MClap = mat({ frag: `{ float f = fract(p.y/0.28); diffuseColor.rgb *= 0.9 + 0.1*smoothstep(0.,.15,f); }` });
  const MBrick = mat({ frag: `{ vec2 q = vec2((p.x+p.z)/0.5 + floor(p.y/0.2)*.5, p.y/0.2); vec2 f = fract(q); float j = 1.-smoothstep(.05,.1,min(min(f.x,1.-f.x)*2.5, min(f.y,1.-f.y)));
      float fw = fwidth(q.y); j *= clamp(1.-fw*2.,0.,1.); diffuseColor.rgb *= (0.88+0.22*h21(floor(q))); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86,.80,.72), j*.55); }` });
  const MPlank = mat({ frag: `{ float f = fract(p.y/0.3); diffuseColor.rgb *= 0.82 + 0.18*smoothstep(0.,.12,f) + 0.1*(vn(vec2((p.x+p.z)*.4, floor(p.y/.3)*3.))-.5); }` });
  const dyn = new DynKit(grp); let curPop = null; ctx.archDyn = dyn;
  const kadd = (g, m, mm, c) => curPop ? dyn.add(g, m, mm, c, curPop.t, curPop.pivot) : K.add(g, m, mm, c);
  const box = (L, x, y, z, sx, sy, sz, c, m = M, ry = 0, rx = 0, rz = 0) => kadd(GEO.box, m, L(x, y, z, sx, sy, sz, ry, rx, rz), c);
  const geo = (g, m, L, x, y, z, sx, sy, sz, c, ry = 0, rx = 0, rz = 0) => kadd(g, m, L(x, y, z, sx, sy, sz, ry, rx, rz), c);
  const land = id => (D.lands.find(l => l.id === id) || D.lands[0]).palette;
  const GLASS = 0x41566b, DARK = 0x2b2f3a, GOLD = 0xe2b33c, WHITE = 0xf6f1e6, IRON = 0x2d4a3a;
  // striped geometries
  const stripeCone = (cols, n) => stripe(new THREE.ConeGeometry(0.5, 1, n), cols, n);
  const onion = stripe(lathe([[0.001, 1.0], [0.08, 0.93], [0.22, 0.75], [0.48, 0.45], [0.5, 0.3], [0.42, 0.12], [0.3, 0]], 16), [0xd7263d, WHITE], 16);
  const coneRW = stripeCone([0xc8463a, WHITE], 16), coneBW = stripeCone([0x2e86c1, WHITE], 16);
  const umbStripe = {}; const umbG = c => umbStripe[c] || (umbStripe[c] = stripe(lathe([[0.001, 0.35], [0.5, 0.0], [0.47, -0.04]], 16), [c, WHITE], 16));
  const awnG = {}; const awnStripe = c => awnG[c] || (awnG[c] = stripe(new THREE.BoxGeometry(1, 1, 1, 24, 1, 1), [c, WHITE], 0, true, 12));
  const halfDisc = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2); // upper half disc in xy-plane (arch), flat edge at y=0
  const scallop = halfDisc.clone().rotateZ(Math.PI); // lower half (hanging valance)

  // ---------------------------------------------------------------- generic window
  function windowAt(L, x, y, z, ww, wh, trim, o = {}) { // on a face whose outward normal is +z (local), y = bottom of window
    box(L, x, y + wh / 2, z + 0.03, ww + 0.26, wh + 0.26, 0.08, trim);
    box(L, x, y + wh / 2, z + 0.07, ww, wh, 0.06, o.glass ?? GLASS, MGlass);
    box(L, x, y + wh * 0.58, z + 0.11, ww, 0.06, 0.04, trim); box(L, x, y + wh / 2, z + 0.11, 0.06, wh, 0.04, trim);
    box(L, x, y - 0.06, z + 0.12, ww + 0.45, 0.12, 0.26, trim);
    if (o.pediment) geo(GEO.wedge, M, L, x, y + wh + 0.16, z + 0.08, ww + 0.5, 0.42, 0.18, trim);
    else box(L, x, y + wh + 0.16, z + 0.1, ww + 0.45, 0.2, 0.2, trim);
    if (o.shutter != null) { box(L, x - ww / 2 - 0.32, y + wh / 2, z + 0.08, 0.36, wh, 0.06, o.shutter); box(L, x + ww / 2 + 0.32, y + wh / 2, z + 0.08, 0.36, wh, 0.06, o.shutter); }
    if (o.flowerBox) {
      box(L, x, y - 0.25, z + 0.28, ww + 0.1, 0.28, 0.3, 0x6b4a2e);
      const r = rng(Math.floor(x * 97 + y * 13 + z * 7) ^ 0x51);
      for (let i = 0; i < 6; i++) geo(GEO.sph, M, L, x - ww / 2 + 0.1 + (ww - 0.2) * i / 5, y - 0.05 + r() * 0.08, z + 0.3 + (r() - 0.5) * 0.12, 0.22, 0.2, 0.22, [0xe74c3c, 0xf5a6c8, 0xffffff, 0xf1c40f, 0x4f8f3a][Math.floor(r() * 5)]);
    }
  }
  // ---------------------------------------------------------------- awning across a front (outward +z at z0), top at y
  function awning(L, x, y, z0, w, depth, col, styleA) {
    const ang = 0.38; const dz = depth * Math.cos(ang), dy = depth * Math.sin(ang);
    if (styleA === 'plain') geo(GEO.box, M, L, x, y - dy / 2, z0 + dz / 2, w, 0.06, depth, col, 0, ang);
    else geo(awnStripe(col), MV, L, x, y - dy / 2, z0 + dz / 2, w, 0.06, depth, 0xffffff, 0, ang);
    // valance
    if (styleA === 'scalloped') { const n = Math.max(3, Math.round(w / 0.6)); for (let i = 0; i < n; i++) geo(scallop, M, L, x - w / 2 + (i + 0.5) * w / n, y - dy - 0.0, z0 + dz + 0.02, w / n, w / n, 0.04, i % 2 ? WHITE : col); }
    else box(L, x, y - dy - 0.18, z0 + dz, w, 0.36, 0.05, col);
    // side cheeks
    for (const s of [-1, 1]) box(L, x + s * w / 2, y - dy * 0.55, z0 + dz * 0.5, 0.04, dy * 0.9, dz, col);
  }

  // ---------------------------------------------------------------- main street shops
  const msPal = land('main_street');
  function mainStreetShop(b) {
    const L = frame(b.position[0], 0, b.position[2], b.rot); const w = b.w, d = b.d, h = b.h; const fz = d / 2;
    const wall = hex(b.wall), trim = hex(b.trim || '#FFFFFF'), aw = hex(b.awning || '#C8463A'); const sh = b.storey_heights;
    const r = rng(hash(b.id.charCodeAt(4), b.id.charCodeAt(5)) * 1e9);
    const brick = b.wall && b.wall.toUpperCase() === '#B5563F';
    box(L, 0, h / 2, 0, w, h, d, wall, brick ? MBrick : M);
    // plinth, pilasters, storey bands
    box(L, 0, 0.25, fz + 0.04, w, 0.5, 0.12, 0x9a948a);
    for (const s of [-1, 1]) box(L, s * (w / 2 - 0.22), h / 2, fz + 0.08, 0.44, h, 0.2, trim);
    let y = 0; const ys = [];
    for (let k = 0; k < sh.length; k++) { ys.push(y); y += sh[k]; if (k < sh.length - 1) box(L, 0, y, fz + 0.12, w + 0.1, 0.22, 0.3, trim); }
    // cornice + dentils
    box(L, 0, h - 0.1, fz + 0.3, w + 0.5, 0.42, 0.7, trim); box(L, 0, h - 0.4, fz + 0.18, w + 0.2, 0.18, 0.45, trim);
    for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.42) box(L, x, h - 0.6, fz + 0.12, 0.16, 0.16, 0.22, trim);
    // ground floor shopfront
    const h0 = sh[0]; const sfw = w - 1.2;
    box(L, 0, h0 - 0.55, fz + 0.16, sfw, 0.7, 0.18, aw); box(L, 0, h0 - 0.55, fz + 0.2, sfw * 0.7, 0.4, 0.06, 0xf3e6cc); // fascia + blank sign panel
    box(L, 0, h0 - 0.18, fz + 0.2, sfw + 0.2, 0.12, 0.26, trim);
    const sf = b.shopfront;
    if (sf === 'arcade') {
      const n = Math.max(2, Math.round(sfw / 2.4)); box(L, 0, (h0 - 0.9) / 2, fz - 0.6, sfw, h0 - 0.9, 0.1, GLASS, MGlass);
      for (let i = 0; i <= n; i++) { const x = -sfw / 2 + i * sfw / n; geo(GEO.cyl, M, L, x, (h0 - 0.9) / 2, fz + 0.15, 0.32, h0 - 0.9, 0.32, trim); }
      for (let i = 0; i < n; i++) { const x = -sfw / 2 + (i + 0.5) * sfw / n; geo(halfDisc, M, L, x, h0 - 0.9 - 0.02, fz + 0.12, sfw / n - 0.3, (sfw / n - 0.3) * 0.5, 0.2, trim, 0, 0, 0); }
    } else {
      const doorW = sf === 'double_doors' ? 1.8 : 1.1; const dx = sf === 'double_doors' ? 0 : sfw * 0.22;
      box(L, 0, 0.35, fz + 0.12, sfw, 0.7, 0.14, trim); // stall riser
      for (const s of [-1, 1]) { const ww = (sfw - doorW) / 2 - 0.35; const cx = dx + s * (doorW / 2 + 0.2 + ww / 2); if (sf !== 'double_doors' && s > 0 && cx + ww / 2 > sfw / 2) continue;
        box(L, cx, 0.7 + (h0 - 1.6) / 2, fz + 0.1, ww, h0 - 1.6, 0.06, GLASS, MGlass); box(L, cx, 0.7 + (h0 - 1.6) / 2, fz + 0.15, 0.07, h0 - 1.6, 0.05, trim);
        // display goods behind glass
        for (let i = 0; i < 4; i++) geo(GEO.box, M, L, cx - ww / 2 + 0.3 + i * (ww - 0.6) / 3, 0.95 + r() * 0.3, fz - 0.15, 0.35, 0.4 + r() * 0.4, 0.3, [0xe74c3c, 0xf1c40f, 0xffffff, 0x3498db, 0xf5a6c8][(i + Math.floor(r() * 5)) % 5]);
      }
      box(L, dx, (h0 - 0.9) / 2, fz + 0.06, doorW, h0 - 0.9, 0.08, 0x5a3a2a); box(L, dx, (h0 - 0.9) * 0.62, fz + 0.11, doorW * 0.8, (h0 - 0.9) * 0.5, 0.04, GLASS, MGlass);
      box(L, dx, h0 - 0.75, fz + 0.1, doorW + 0.3, 0.12, 0.2, trim);
    }
    // awning
    awning(L, 0, h0 - 0.95, fz + 0.2, sfw, 2.1, aw, b.awning_style);
    // upper storeys
    const nWin = Math.max(1, Math.round((w - 1) / 2.6)); const shutter = r() < 0.4 ? [0x2f6e8e, 0x3f6e33, 0x7b3f61][Math.floor(r() * 3)] : null; const ped = r() < 0.4;
    for (let k = 1; k < sh.length; k++) {
      const hs = sh[k]; const wh = hs * 0.56, ww = Math.min(1.25, (w - 1.4) / nWin * 0.5) * (hs / 2.9 + 0.3) / 1.3;
      for (let i = 0; i < nWin; i++) {
        const x = -w / 2 + 0.6 + (i + 0.5) * (w - 1.2) / nWin;
        if (b.shopfront === 'bay_window' && k === 1 && i === Math.floor(nWin / 2)) {
          const bw = Math.min(3, w * 0.4); box(L, x, ys[k] + hs * 0.5, fz + 0.5, bw, hs * 0.78, 1.0, wall);
          for (const s of [-1, 0, 1]) box(L, x + s * bw * 0.33, ys[k] + hs * 0.52, fz + 1.02, bw * 0.26, hs * 0.5, 0.05, GLASS, MGlass);
          box(L, x, ys[k] + hs * 0.92, fz + 0.55, bw + 0.2, 0.15, 1.15, trim); box(L, x, ys[k] + hs * 0.1, fz + 0.55, bw + 0.2, 0.15, 1.15, trim);
          continue;
        }
        windowAt(L, x, ys[k] + hs * 0.2, fz, ww, wh, trim, { shutter, pediment: ped && k === 1, flowerBox: b.window_boxes && k === 1 });
      }
    }
    // side walls (visible ones at row ends / above lower neighbours): simple windows
    for (const s of [-1, 1]) { const Ls = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => L(s * w / 2, 0, 0).multiply(T(0, 0, 0, s * Math.PI / 2)).multiply(T(x, y, z, ry, sx, sy, sz, rx, rz));
      const LsF = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => Ls(x, y, z, sx, sy, sz, ry, rx, rz);
      for (let k = 1; k < sh.length; k++) for (let i = 0; i < 3; i++) windowAt(LsF, -d / 2 + 2.5 + i * (d - 5) / 2, ys[k] + sh[k] * 0.22, 0, 0.8, sh[k] * 0.5, trim, {}); }
    // roof
    const roofC = hex(msPal.roof || '#4E5D6C');
    if (b.roof === 'flat_cornice') {
      box(L, 0, h + 0.45, fz - 0.05, w, 0.9, 0.3, wall); box(L, 0, h + 0.95, fz - 0.05, w + 0.2, 0.15, 0.4, trim);
      geo(halfDisc, M, L, 0, h + 0.95, fz - 0.05, 2.4, 1.2, 0.3, wall, 0, 0, 0); box(L, 0, h + 0.05, 0, w - 0.2, 0.15, d - 0.4, 0x8a8278);
      geo(GEO.cyl6, M, L, -w / 4, h + 0.7, -d / 4, 0.6, 1.2, 0.6, 0x7a6a5e);
    } else if (b.roof === 'hipped' || b.roof === 'corner_turret_dome') {
      geo(GEO.cone4, M, L, 0, h + 1.6, 0, w * 1.02, 3.2, d * 1.02, roofC); box(L, w * 0.25, h + 2.6, -d * 0.2, 0.7, 1.8, 0.7, 0x9a5a48);
      if (b.roof === 'corner_turret_dome') {
        const tx = w / 2 - 1.2, tz = fz - 0.6; geo(GEO.cyl16, M, L, tx, h / 2 + 1.2, tz, 2.6, h + 2.4, 2.6, wall);
        for (let k = 1; k < sh.length; k++) for (const a of [0, 0.8, -0.8]) { const Lt = (x, y, z, sx, sy, sz) => L(tx + Math.sin(a) * 1.3, 0, tz + Math.cos(a) * 1.3).multiply(T(0, 0, 0, a)).multiply(T(x, y, z, 0, sx, sy, sz)); windowAt(Lt, 0, ys[k] + sh[k] * 0.22, 0, 0.6, sh[k] * 0.5, trim, {}); }
        box(L, tx, h + 2.35, tz, 2.9, 0.25, 2.9, trim);
        geo(onion, MV, L, tx, h + 2.45, tz, 3.0, 2.6, 3.0, 0xffffff); geo(GEO.cone, M, L, tx, h + 5.4, tz, 0.15, 1.0, 0.15, GOLD); geo(GEO.sph, M, L, tx, h + 5.0, tz, 0.3, 0.3, 0.3, GOLD);
      }
    } else if (b.roof === 'mansard') {
      geo(GEO.cone4, M, L, 0, h + 1.3, 0, w * 1.04, 2.6, d * 1.04, roofC); box(L, 0, h + 2.4, 0, w * 0.55, 0.3, d * 0.6, 0x3e4a56);
      const nd = Math.max(1, nWin); for (let i = 0; i < nd; i++) { const x = -w / 2 + 0.6 + (i + 0.5) * (w - 1.2) / nd; box(L, x, h + 1.0, fz - 0.9, 0.9, 1.2, 1.0, trim); box(L, x, h + 1.0, fz - 0.38, 0.6, 0.8, 0.04, GLASS, MGlass); geo(GEO.wedge, M, L, x, h + 1.6, fz - 0.9, 1.1, 0.55, 1.1, roofC, Math.PI / 2); }
      for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 6) geo(GEO.sph, M, L, x, h + 2.7, fz - 2.2, 0.15, 0.25, 0.15, GOLD);
    } else if (b.roof === 'gable_front') {
      geo(GEO.wedge, M, L, 0, h, 0, d, 3.4, w, roofC, Math.PI / 2); // ridge runs along depth -> gable faces street
      // gable end wall + round window + bargeboard
      const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, 3.4)]);
      K.add(new THREE.ShapeGeometry(tri), M, L(0, h, fz + 0.02, 1, 1, 1), wall);
      geo(GEO.cyl, M, L, 0, h + 1.2, fz + 0.06, 1.1, 0.08, 1.1, trim, 0, Math.PI / 2); geo(GEO.cyl, MGlass, L, 0, h + 1.2, fz + 0.1, 0.8, 0.06, 0.8, GLASS, 0, Math.PI / 2);
      const ang = Math.atan2(3.4, w / 2); const len = Math.hypot(3.4, w / 2);
      for (const s of [-1, 1]) box(L, s * w / 4, h + 1.7, fz + 0.15, len + 0.3, 0.25, 0.12, trim, 0, 0, -s * ang);
      geo(GEO.cone, M, L, 0, h + 3.8, fz, 0.12, 0.9, 0.12, GOLD);
    }
    // flagpole on some roofs
    if (r() < 0.45) { geo(GEO.cyl6, M, L, -w / 2 + 1, h + 2.5, fz - 0.5, 0.08, 5, 0.08, WHITE); ctx.flags.push({ L, x: -w / 2 + 1, y: h + 4.6, z: fz - 0.5, c: [0xc8463a, 0x2f6e8e, 0xd9a441, 0xf3e6cc][Math.floor(r() * 4)] }); }
  }

  // ---------------------------------------------------------------- generic small building
  function genericBuilding(b, o = {}) {
    const L = frame(b.position[0], b.position[1] || 0, b.position[2], b.rot || 0); const w = b.w, d = b.d, h = b.h; const pal = land(b.land && b.land !== 'outside' ? b.land : 'main_street');
    const wall = hex(o.wall || pal.secondary), trim = hex(o.trim || pal.trim), roofC = hex(o.roof || pal.roof), acc = hex(o.accent || pal.primary);
    const wh = o.wallH ?? h * 0.7;
    box(L, 0, wh / 2, 0, w, wh, d, wall, o.wallMat || M);
    box(L, 0, wh, 0, w + 0.3, 0.25, d + 0.3, trim);
    box(L, 0, 0.2, 0, w + 0.15, 0.4, d + 0.15, 0x9a948a);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(L, sx * (w / 2 - 0.12), wh / 2, sz * (d / 2 - 0.12), 0.32, wh, 0.32, trim);
    // front: door + windows
    box(L, 0, 1.1, d / 2 + 0.03, 1.2, 2.2, 0.08, 0x5a3a2a); box(L, 0, 2.3, d / 2 + 0.06, 1.5, 0.15, 0.15, trim);
    const n = Math.max(1, Math.floor((w - 2) / 2.4) - 0); for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; if (Math.abs(x) < 1.2) continue; windowAt(L, x, 1.0, d / 2, 0.9, Math.min(1.4, wh - 1.6), trim, { shutter: o.shutter }); }
    for (const s of [-1, 1]) { const Ls = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => L(s * w / 2, 0, 0).multiply(T(0, 0, 0, s * Math.PI / 2)).multiply(T(x, y, z, ry, sx, sy, sz, rx, rz)); for (let i = 0; i < Math.max(1, Math.floor(d / 3.5)); i++) windowAt(Ls, -d / 2 + (i + 0.5) * d / Math.max(1, Math.floor(d / 3.5)), 1.1, 0, 0.8, Math.min(1.2, wh - 1.8), trim, {}); }
    const rt = o.roofType || 'gable'; const rh = o.roofH ?? Math.min(w, d) * 0.42;
    if (rt === 'gable') { geo(GEO.wedge, M, L, 0, wh, 0, w + 0.6, rh, d + 0.6, roofC); }
    else if (rt === 'hip') geo(GEO.cone4, M, L, 0, wh + rh / 2, 0, w + 0.5, rh, d + 0.5, roofC);
    else if (rt === 'flat') { box(L, 0, wh + 0.35, 0, w + 0.4, 0.5, d + 0.4, roofC); }
    else if (rt === 'dome') geo(GEO.hemi, M, L, 0, wh, 0, Math.min(w, d) * 0.95, rh * 1.4, Math.min(w, d) * 0.95, roofC);
    else if (rt === 'thatch') { geo(GEO.cone4, mat({ frag: `{ float s = vn(vec2(atan(p.z,p.x)*40., p.y*3.)); diffuseColor.rgb *= 0.8 + 0.35*s; }` }), L, 0, wh + rh * 0.6, 0, w + 1.6, rh * 1.2, d + 1.6, 0xc9a35a); }
    if (o.awning) awning(L, 0, 2.9, d / 2, w * 0.9, 1.6, hex(o.awning), o.awningStyle || 'striped');
    if (o.cupola) { box(L, 0, wh + rh + 0.6, 0, 1.4, 1.4, 1.4, wall); geo(GEO.cone4, M, L, 0, wh + rh + 1.8, 0, 1.9, 1.2, 1.9, roofC); geo(GEO.cone, M, L, 0, wh + rh + 2.7, 0, 0.1, 0.8, 0.1, GOLD); }
    return L;
  }

  for (const b of D.buildings) {
    const [x, y0, z] = b.position; const rot = b.rot || 0;
    if (ctx.skipBuilding && ctx.skipBuilding(b)) continue;
    const pt = ctx.popOf ? ctx.popOf(b) : null; curPop = pt != null ? { t: pt, pivot: [x, 0, z] } : null;
    switch (b.kind) {
      case 'main_street_shop': mainStreetShop(b); break;
      case 'ticket_booth': {
        const L = frame(x, 0, z, rot); const red = 0xc8463a, cream = 0xf3e6cc;
        box(L, 0, 0.25, 0, b.w + 0.3, 0.5, b.d + 0.3, 0x9a948a); box(L, 0, 1.75, 0, b.w, 2.5, b.d, cream);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) geo(GEO.cyl, M, L, sx * (b.w / 2), 1.75, sz * (b.d / 2), 0.35, 3.1, 0.35, red);
        for (const sx of [-1, 0, 1]) { box(L, sx * 1.5, 1.85, b.d / 2 + 0.04, 1.1, 1.2, 0.06, GLASS, MGlass); geo(halfDisc, M, L, sx * 1.5, 2.44, b.d / 2 + 0.05, 1.1, 0.55, 0.06, GLASS, 0, 0, 0); geo(halfDisc, M, L, sx * 1.5, 2.46, b.d / 2 + 0.02, 1.4, 0.7, 0.05, 0xd9a441, 0, 0, 0); box(L, sx * 1.5, 1.2, b.d / 2 + 0.25, 1.2, 0.1, 0.45, 0xd9a441); }
        box(L, 0, 3.1, 0, b.w + 0.4, 0.3, b.d + 0.4, 0xd9a441);
        geo(stripe(new THREE.ConeGeometry(0.5, 1, 12), [red, cream], 12), MV, L, 0, 3.9, 0, b.w + 1.4, 1.5, b.d + 1.6, 0xffffff);
        geo(GEO.sph, M, L, 0, 4.75, 0, 0.4, 0.4, 0.4, GOLD); geo(GEO.cone, M, L, 0, 5.3, 0, 0.14, 0.9, 0.14, GOLD);
        break;
      }
      case 'entrance_arch': {
        const L = frame(x, 0, z, rot); const brick = 0xb5563f, stone = 0xe8dcc8, copper = 0x3e7e6e;
        for (const sx of [-14, 14]) {
          box(L, sx, 6, 0, 6, 12, 4, brick, MBrick); box(L, sx, 0.4, 0, 6.6, 0.8, 4.6, stone);
          for (let yy = 0.8; yy < 12; yy += 0.9) for (const cx of [-1, 1]) for (const cz of [-1, 1]) box(L, sx + cx * 2.9, yy + 0.3, cz * 1.9, 0.45, 0.6, 0.45, stone);
          box(L, sx, 12.1, 0, 6.6, 0.5, 4.6, stone); box(L, sx, 12.5, 0, 6.2, 0.3, 4.2, stone);
          for (const fz of [-1, 1]) { box(L, sx, 7.5, fz * 2.03, 1.6, 2.6, 0.06, GLASS, MGlass); geo(halfDisc, M, L, sx, 8.8, fz * 2.04, 1.6, 0.8, 0.06, GLASS, 0, 0, 0); box(L, sx, 6.1, fz * 2.1, 2.0, 0.15, 0.25, stone); geo(halfDisc, M, L, sx, 8.82, fz * 2.02, 2.1, 1.05, 0.05, stone, 0, 0, 0); box(L, sx, 3.2, fz * 2.03, 2.0, 2.6, 0.06, 0x5a3a2a); }
          geo(GEO.hemi, M, L, sx, 12.6, 0, 5.2, 4.2, 3.8, copper); geo(GEO.sph, M, L, sx, 14.9, 0, 0.5, 0.5, 0.5, GOLD);
          geo(GEO.cyl6, M, L, sx, 16.5, 0, 0.12, 3.5, 0.12, WHITE); ctx.flags.push({ L, x: sx, y: 17.7, z: 0, c: 0xc8463a, big: 1.6 });
        }
        // wrought-iron arch: two arcs + lattice + bulbs
        const arc = u => [-11 + 22 * u, 11.2 + 3.4 * Math.sin(Math.PI * u)];
        const bulbs = [];
        for (const off of [0, -1.6]) for (let i = 0; i < 40; i++) { const a = arc(i / 40), b2 = arc((i + 1) / 40); K.add(GEO.box, M, L(0, 0, 0).multiply(beamM([a[0], a[1] + off, 0], [b2[0], b2[1] + off, 0], 0.18, 0.25)), 0x1f2a2a); }
        for (let i = 0; i <= 20; i++) { const a = arc(i / 20); K.add(GEO.box, M, L(0, 0, 0).multiply(beamM([a[0], a[1] - 1.6, 0], [a[0], a[1], 0], 0.08)), 0x1f2a2a); if (i < 20) { const b2 = arc((i + 1) / 20); K.add(GEO.box, M, L(0, 0, 0).multiply(beamM([a[0], a[1] - 1.6, 0], [b2[0], b2[1], 0], 0.06)), 0x1f2a2a); } }
        for (let i = 0; i <= 44; i++) { const a = arc(i / 44); bulbs.push(L(a[0], a[1] + 0.2, 0.15, 0.22, 0.22, 0.22)); bulbs.push(L(a[0], a[1] + 0.2, -0.15, 0.22, 0.22, 0.22)); }
        ctx.bulbs.push(...bulbs.map(m => [m, 0xffd98a]));
        geo(GEO.cyl, M, L, 0, 15.2, 0.12, 3.4, 0.2, 2.2, 0xd9a441, 0, Math.PI / 2); geo(GEO.cyl, M, L, 0, 15.2, 0.2, 2.8, 0.2, 1.7, 0xf3e6cc, 0, Math.PI / 2);
        geo(GEO.cone, M, L, 0, 16.7, 0, 0.3, 1.2, 0.3, GOLD); geo(GEO.sph, M, L, 0, 16.2, 0, 0.5, 0.5, 0.5, GOLD);
        break;
      }
      case 'turnstiles': {
        for (const it of b.items) { const L = frame(it.position[0], 0, it.position[2], it.rot || 0);
          box(L, -0.25, 0.55, 0, 0.3, 1.1, 1.4, 0x8d949c); box(L, -0.25, 1.12, 0, 0.36, 0.08, 1.5, 0x2d2f36);
          for (let k = 0; k < 3; k++) { const a = k * 2.094; K.add(GEO.cyl6, M, L(0, 0.95, 0).multiply(T(0, 0, 0, 0, 1, 1, 1, a)).multiply(T(0.2, 0.32, 0, 0, 0.05, 0.6, 0.05, 0, 0.0)), 0xd0d4d8); }
          geo(GEO.cyl6, M, L, 0.25, 0.5, 0.75, 0.08, 1.0, 0.08, 0xd9a441); }
        // canopy over the turnstile line
        const L = frame(x, 0, z, rot); for (let i = -7; i <= 7; i++) geo(GEO.cyl6, M, L, i * 4.2, 1.6, -1.6, 0.14, 3.2, 0.14, IRON);
        geo(awnStripe(0xc8463a), MV, L, 0, 3.3, -0.4, 60, 0.12, 3.4, 0xffffff, 0, -0.12);
        break;
      }
      case 'bandstand': {
        const L = frame(x, 0, z, rot);
        geo(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), MBrick, L, 0, 0.5, 0, b.w, 1, b.w, 0xb5563f); geo(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), M, L, 0, 1.05, 0, b.w + 0.3, 0.1, b.w + 0.3, WHITE);
        for (let s = 0; s < 3; s++) box(L, 0, 0.17 + s * 0.33, b.w / 2 + 0.4 + (2 - s) * 0.35, 2.4, 0.34, 0.35, 0xb5a690);
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; geo(GEO.cyl, M, L, Math.cos(a) * b.w * 0.44, 3.1, Math.sin(a) * b.w * 0.44, 0.22, 4.1, 0.22, WHITE);
          const a2 = (k + 1) / 8 * Math.PI * 2 + Math.PI / 8; K.add(GEO.box, M, L(0, 0, 0).multiply(beamM([Math.cos(a) * b.w * 0.44, 1.6, Math.sin(a) * b.w * 0.44], [Math.cos(a2) * b.w * 0.44, 1.6, Math.sin(a2) * b.w * 0.44], 0.06)), WHITE); }
        geo(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), M, L, 0, 5.2, 0, b.w * 0.98, 0.35, b.w * 0.98, WHITE);
        geo(onion, MV, L, 0, 5.35, 0, b.w * 1.05, 4.0, b.w * 1.05, 0xffffff); geo(GEO.cone, M, L, 0, 9.8, 0, 0.18, 1.2, 0.18, GOLD); geo(GEO.sph, M, L, 0, 9.3, 0, 0.4, 0.4, 0.4, GOLD);
        // band: tiny musicians
        for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; ctx.extraPeople.push([x + Math.cos(a) * 2.2, 1.1, z + Math.sin(a) * 2.2, Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI, k % 2 ? 0xc8463a : 0x2f3e6e, 0]); }
        break;
      }
      case 'railway_station': {
        const L = frame(x, y0, z, rot); const cream = 0xf3e6cc, green = 0x1f5e3b;
        box(L, 0, -y0 / 2 + 0.3, 0, b.w, y0 + 0.4, b.d, 0xb5563f, MBrick); box(L, 0, 0.25, 0, b.w + 0.3, 0.2, b.d + 0.3, 0xd8d2c4);
        box(L, 0, 1.8, -b.d / 2 + 0.3, b.w - 2, 3.4, 0.6, cream);
        for (let i = 0; i < 7; i++) windowAt((xx, yy, zz, sx, sy, sz, ry = 0, rx = 0, rz = 0) => L(0, 0, -b.d / 2 + 0.6).multiply(T(xx, yy, zz, ry, sx, sy, sz, rx, rz)), -b.w / 2 + 3 + i * (b.w - 6) / 6, 1.1, 0, 1.0, 1.7, green, {});
        for (let i = 0; i <= 10; i++) geo(GEO.cyl, M, L, -b.w / 2 + 1 + i * (b.w - 2) / 10, 2.3, b.d / 2 - 1, 0.25, 4.0, 0.25, green);
        geo(GEO.wedge, M, L, 0, 4.2, 0, b.w, 1.6, b.d + 1.2, 0x4e5d6c);
        const n = Math.round(b.w / 0.7); for (let i = 0; i < n; i++) geo(scallop, M, L, -b.w / 2 + (i + 0.5) * b.w / n, 4.18, b.d / 2 + 0.62, b.w / n, b.w / n, 0.04, i % 2 ? cream : 0xc8463a);
        box(L, 0, 6.4, -0.2, 2.2, 2.2, 0.5, cream); geo(GEO.cyl, M, L, 0, 6.4, 0.1, 1.5, 0.12, 1.5, WHITE, 0, Math.PI / 2); box(L, 0, 6.6, 0.2, 0.08, 0.6, 0.05, DARK, M, 0, 0, 0.0); box(L, 0.18, 6.4, 0.2, 0.45, 0.07, 0.05, DARK);
        for (const sx of [20, 50]) { const Ls = frame(sx, 0, 147, 0); for (let s = 0; s < 12; s++) box(Ls, 0, s * 0.4 + 0.2, -s * 0.42, 3, 0.4, 0.42, 0xd8d2c4); box(Ls, -1.6, 2.5, -2.5, 0.12, 1.0, 5.2, green, M, 0, -0.75); box(Ls, 1.6, 2.5, -2.5, 0.12, 1.0, 5.2, green, M, 0, -0.75); }
        break;
      }
      case 'boathouse': { genericBuilding(b, { wall: '#FFFFFF', trim: '#2F6E8E', roof: '#2E5E9E', roofType: 'gable', cupola: true, wallMat: MClap, shutter: 0x2e86c1 }); const L = frame(x, 0, z, b.rot);
        box(L, 0, 0.6, b.d / 2 + 3, b.w + 4, 0.3, 6, 0xb08a5a, MPlank); for (let i = 0; i < 6; i++) geo(GEO.cyl6, M, L, -b.w / 2 - 1.5 + i * (b.w + 3) / 5, 0.0, b.d / 2 + 5.8, 0.3, 1.6, 0.3, 0x6b4a2e);
        ctx.flags.push({ L, x: b.w / 2 - 1, y: b.h + 4, z: 0, c: 0x2e86c1 }); geo(GEO.cyl6, M, L, b.w / 2 - 1, b.h + 1.6, 0, 0.1, 5, 0.1, WHITE); break; }
      case 'frontier_building': frontier(b); break;
      case 'water_tower': {
        const L = frame(x, 0, z, 0); const wood = 0x8b6b4a;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) kadd(GEO.box, M, L(0, 0, 0).multiply(beamM([sx * 2.8, 0, sz * 2.8], [sx * 1.9, 8, sz * 1.9], 0.35)), wood);
        for (const yy of [2.5, 5.5]) for (const [a, b2] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { const k = 2.8 - (2.8 - 1.9) * yy / 8; kadd(GEO.box, M, L(0, 0, 0).multiply(beamM([a[0] * k, yy, a[1] * k], [b2[0] * k, yy, b2[1] * k], 0.2)), wood);
          kadd(GEO.box, M, L(0, 0, 0).multiply(beamM([a[0] * k, yy - 2.4, a[1] * k], [b2[0] * k, yy, b2[1] * k], 0.12)), wood); }
        box(L, 0, 8.1, 0, 6.2, 0.3, 6.2, 0x6b4a2e);
        geo(stripe(new THREE.CylinderGeometry(0.5, 0.5, 1, 28), [0x9a7650, 0x8b6b4a, 0xa47f56], 28), MPlank, L, 0, 10.6, 0, 5.6, 4.8, 5.6, 0xffffff);
        for (const yy of [8.9, 10.6, 12.3]) geo(GEO.cyl, M, L, 0, yy, 0, 5.75, 0.15, 5.75, 0x3a3a3a);
        geo(GEO.cone, M, L, 0, 14.0, 0, 6.6, 2.2, 6.6, 0x7a4a2a); geo(GEO.cyl6, M, L, 2.2, 7.2, 2.2, 0.35, 2.0, 0.35, 0x3a3a3a);
        break;
      }
      case 'lighthouse_folly': {
        const L = frame(x, 0.6, z, 0); const n = 6;
        for (let k = 0; k < n; k++) { const y0k = k * 12 / n, r0 = 2.2 - 0.7 * k / n, r1 = 2.2 - 0.7 * (k + 1) / n; K.add(new THREE.CylinderGeometry(r1, r0, 12 / n, 20), M, L(0, y0k + 6 / n, 0), k % 2 ? WHITE : 0xd7263d); }
        geo(GEO.cyl16, M, L, 0, 12.15, 0, 3.6, 0.3, 3.6, DARK); for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; geo(GEO.cyl6, M, L, Math.cos(a) * 1.75, 12.7, Math.sin(a) * 1.75, 0.06, 0.9, 0.06, WHITE); }
        geo(GEO.cyl16, M, L, 0, 13.15, 0, 3.5, 0.08, 3.5, WHITE);
        geo(GEO.cyl16, MGlass, L, 0, 13.4, 0, 2.0, 1.8, 2.0, 0xf6e7b0); geo(GEO.cone, M, L, 0, 14.9, 0, 2.6, 1.3, 2.6, 0xd7263d); geo(GEO.sph, M, L, 0, 15.6, 0, 0.35, 0.35, 0.35, GOLD);
        ctx.lighthouseLamp = L(0, 13.4, 0); box(L, 0, 1.1, 2.15, 0.9, 1.9, 0.12, 0x2f6e8e);
        // jetty + rocks
        const Lj = frame(-210, 0, 60, 0.7); box(Lj, 0, 0.5, 4, 1.8, 0.2, 9, 0xb08a5a, MPlank); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) geo(GEO.cyl6, M, Lj, s * 0.8, 0, 0.8 + i * 2.6, 0.22, 1.4, 0.22, 0x6b4a2e);
        break;
      }
      case 'food_court': {
        const L = frame(x, 0, z, rot); box(L, 0, 2.2, 0, b.w, 4.4, b.d, 0xf3e6cc);
        for (let i = 0; i < 4; i++) { const xx = -b.w / 2 + (i + 0.5) * b.w / 4; box(L, xx, 2.0, b.d / 2 + 0.05, 5, 1.6, 0.1, DARK); awning(L, xx, 3.4, b.d / 2, 5.6, 1.8, 0xd7263d, 'scalloped'); }
        geo(stripe(new THREE.ConeGeometry(0.5, 1, 32), [0xd7263d, 0xfff4e0], 32), MV, L, 0, 6.2, 0, b.w * 1.06, 3.8, b.d * 1.25, 0xffffff);
        for (const sx of [-1, 0, 1]) { geo(GEO.cyl6, M, L, sx * b.w * 0.3, 8.5, 0, 0.12, 3, 0.12, WHITE); ctx.flags.push({ L, x: sx * b.w * 0.3, y: 9.6, z: 0, c: [0xf4b942, 0xd7263d, 0x1b998b][sx + 1] }); }
        break;
      }
      case 'game_booth_rows': {
        for (const it of b.items) { const L = frame(it.position[0], 0, it.position[2], it.rot || 0); const aw = hex(it.awning || '#D7263D');
          box(L, 0, 0.55, 0.8, it.w, 1.1, 0.6, 0xf3e6cc); box(L, 0, 1.8, -it.d / 2 + 0.2, it.w, 3.6, 0.3, aw); for (const s of [-1, 1]) box(L, s * it.w / 2, 1.8, 0, 0.2, 3.6, it.d, 0xf3e6cc);
          for (let k = 0; k < 6; k++) geo(GEO.sph, M, L, -it.w / 2 + 0.5 + k * (it.w - 1) / 5, 2.2 + (k % 2) * 0.6, -it.d / 2 + 0.6, 0.5, 0.5, 0.5, [0xf5a6c8, 0xa8d8ea, 0xffe08a, 0xb8e0b0, 0xc3a6e0, 0xffffff][k]);
          geo(stripe(new THREE.BoxGeometry(1, 1, 1, 12, 1, 1), [aw, WHITE], 0, true, 6), MV, L, 0, 3.75, 0.3, it.w + 0.3, 0.25, it.d + 0.8, 0xffffff, 0, -0.15); }
        break;
      }
      case 'first_aid': { const L = genericBuilding(b, { wall: '#FFFFFF', trim: '#3F6E33', roof: '#4E5D6C', roofType: 'gable', shutter: 0x3f6e33 }); box(L, 0, b.h * 0.7 - 0.9, b.d / 2 + 0.08, 1.4, 1.4, 0.06, 0x3f8f45); box(L, 0, b.h * 0.7 - 0.9, b.d / 2 + 0.12, 0.9, 0.28, 0.04, WHITE); box(L, 0, b.h * 0.7 - 0.9, b.d / 2 + 0.12, 0.28, 0.9, 0.04, WHITE); break; }
      case 'guest_services': { const L = genericBuilding(b, { wall: '#B5563F', trim: '#F3E6CC', roof: '#4E5D6C', roofType: 'gable', wallMat: MBrick }); geo(GEO.cyl, M, L, 0, b.h * 0.7 + 1.4, b.d / 2 + 0.35, 1.6, 0.1, 1.6, WHITE, 0, Math.PI / 2); box(L, 0, b.h * 0.7 + 1.6, b.d / 2 + 0.42, 0.08, 0.55, 0.04, DARK); box(L, 0.2, b.h * 0.7 + 1.4, b.d / 2 + 0.42, 0.45, 0.07, 0.04, DARK); break; }
      case 'restroom': { const pal = land(b.land && b.land !== 'outside' ? b.land : 'main_street'); genericBuilding(b, { roofType: b.land === 'jungle' ? 'thatch' : 'hip', wall: b.land === 'frontier' || b.id.includes('frontier') ? '#8B6B4A' : pal.secondary, wallMat: b.id.includes('hub') ? MBrick : (b.id.includes('frontier') ? MPlank : M) }); break; }
      case 'food_kiosk': case 'shop': {
        const pal = land(b.land); const jungle = b.land === 'jungle';
        genericBuilding(b, { roofType: jungle ? 'thatch' : (b.id === 'seaside_shop' ? 'dome' : (b.id === 'thrill_shop' || b.id === 'thrill_food' ? 'flat' : 'hip')), awning: pal.primary, awningStyle: b.land === 'seaside' ? 'scalloped' : 'striped', wallMat: b.id === 'fish_chips' ? MClap : M, wall: b.id === 'fish_chips' ? '#FFFFFF' : undefined });
        break;
      }
      default: genericBuilding(b);
    }
  }

  curPop = null;
  // ---------------------------------------------------------------- frontier false-front buildings
  function frontier(b) {
    const L = frame(b.position[0], 0, b.position[2], b.rot); const w = b.w, d = b.d, h = b.h;
    const cols = { frontier_saloon: [0xa0522d, 0xf3e6cc], frontier_general_store: [0xc9a46a, 0x6b4a2e], frontier_assay_office: [0xb5563f, 0xe8dcc8], frontier_livery: [0x9b2d20, 0xf3e6cc] }[b.id] || [0xa0522d, 0xf3e6cc];
    const [wall, trim] = cols; const brick = b.id === 'frontier_assay_office';
    box(L, 0, h * 0.4, -0.5, w, h * 0.8, d - 1, wall, brick ? MBrick : MPlank);
    geo(GEO.wedge, M, L, 0, h * 0.8, -0.5, w + 0.4, 2.2, d - 0.6, 0x8a5a3a);
    { const Lb = (xx, yy, zz, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => L(0, 0, -d / 2).multiply(T(0, 0, 0, Math.PI)).multiply(T(xx, yy, zz, ry, sx, sy, sz, rx, rz));
      for (const s of [-1, 0, 1]) if (s) windowAt(Lb, s * w * 0.28, 1.2, 0, 1.0, 1.4, trim, { shutter: 0x6b4a2e }); box(Lb, 0, 1.1, 0.05, 1.2, 2.2, 0.1, 0x5a3a2a); box(Lb, 0, 2.3, 0.6, 2.0, 0.1, 1.2, 0x7a5a3a);
      for (let i = 0; i < 3; i++) geo(GEO.cyl, M, Lb, -w * 0.35 + i * 0.9, 0.45, 1.3, 0.7, 0.9, 0.7, 0x8b5a2b);
      for (const s of [-1, 1]) { const Ls = (xx, yy, zz, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => L(s * w / 2, 0, -0.5).multiply(T(0, 0, 0, s * Math.PI / 2)).multiply(T(xx, yy, zz, ry, sx, sy, sz, rx, rz)); for (const k of [-1, 1]) windowAt(Ls, k * (d - 1) * 0.25, 1.2, 0, 0.8, 1.3, trim, {}); } }
    box(L, 0, h / 2 + 0.6, d / 2 - 0.9, w, h + 1.2, 0.35, wall, brick ? MBrick : MPlank); // false front
    box(L, 0, h + 1.25, d / 2 - 0.7, w + 0.4, 0.3, 0.7, trim); box(L, 0, h + 0.6, d / 2 - 0.65, w * 0.6, 0.9, 0.06, trim);
    for (let x = -w / 2 + 0.4; x < w / 2; x += 0.5) box(L, x, h + 1.0, d / 2 - 0.58, 0.14, 0.18, 0.2, trim);
    // porch with boardwalk, posts, roof
    box(L, 0, 0.3, d / 2 + 1.2, w + 0.4, 0.3, 3.2, 0xb08a5a, MPlank);
    for (let i = 0; i <= Math.round(w / 3); i++) geo(GEO.cyl6, M, L, -w / 2 + i * w / Math.round(w / 3), 1.8, d / 2 + 2.6, 0.22, 3.0, 0.22, 0x8b6b4a);
    box(L, 0, 3.4, d / 2 + 1.4, w + 0.4, 0.15, 3.4, 0x7a5a3a, M, 0, 0.12);
    for (let i = 0; i < Math.round(w / 3); i++) box(L, -w / 2 + (i + 0.5) * w / Math.round(w / 3), 1.0, d / 2 + 2.6, w / Math.round(w / 3) - 0.3, 0.1, 0.08, 0x8b6b4a);
    box(L, 0, 1.25, d / 2 - 0.65, 1.6, 2.5, 0.1, 0x3a2a20); for (const s of [-1, 1]) box(L, s * 0.42, 1.3, d / 2 - 0.5, 0.75, 1.0, 0.06, 0xc9a46a); // swing doors
    for (const s of [-1, 1]) windowAt(L, s * w * 0.3, 1.0, d / 2 - 0.72, 1.3, 1.5, trim, {});
    if (b.id === 'frontier_saloon') { box(L, 0, 4.4, d / 2 + 0.3, w, 0.2, 1.8, 0x7a5a3a); for (let i = 0; i <= 12; i++) box(L, -w / 2 + i * w / 12, 4.9, d / 2 + 1.15, 0.08, 0.9, 0.08, trim); box(L, 0, 5.35, d / 2 + 1.15, w, 0.1, 0.1, trim); for (const s of [-1, 0, 1]) windowAt(L, s * w * 0.3, 4.7, d / 2 - 0.72, 1.0, 1.6, trim, {}); }
    else for (const s of [-1, 1]) windowAt(L, s * w * 0.25, 4.0, d / 2 - 0.72, 0.9, 1.2, trim, {});
    for (let i = 0; i < 3; i++) geo(GEO.cyl, M, L, w / 2 + 0.6, 0.45 + 0, d / 2 + 0.5 + i * 0.9, 0.7, 0.9, 0.7, 0x8b5a2b);
    box(L, -w / 2 - 0.8, 0.6, d / 2 + 2.2, 1.6, 0.12, 0.6, 0x6b4a2e); ctx.frontierObjs = ctx.frontierObjs || [];
  }

  // ---------------------------------------------------------------- railway bridge (riveted girder on brick abutments, arched portal)
  {
    const L = frame(0, 0, 160, 0);
    box(L, 0, 5.0, 0, 22, 1.2, 8, 0x4e5d6c); for (const s of [-1, 1]) { box(L, 0, 6.0, s * 3.6, 22.6, 1.6, 0.25, 0x2f6e8e); for (let x = -10.5; x <= 10.5; x += 1.05) box(L, x, 6.0, s * 3.75, 0.12, 1.5, 0.1, 0x245a75); for (let x = -10.8; x <= 10.8; x += 0.35) for (const yy of [5.35, 6.65]) geo(GEO.sph, M, L, x, yy, s * 3.78, 0.09, 0.09, 0.06, 0x1d4b62); }
    box(L, 0, 4.35, 0, 22, 0.25, 8.2, 0x3a4652);
    for (const sx of [-1, 1]) { box(L, sx * 12.5, 3.2, 0, 4.4, 6.4, 18, 0xb5563f, MBrick); box(L, sx * 12.5, 6.5, 0, 4.8, 0.4, 18.4, 0xe8dcc8); for (let i = 0; i < 6; i++) box(L, sx * 10.28, 0.4 + i * 1.0, 8.9, 0.5, 0.55, 0.5, 0xe8dcc8); }
    // arched portal on the park face (z<0 side faces the park: north)
    const Lp = frame(0, 0, 155.6, Math.PI); box(Lp, 0, 6.9, -0.4, 26, 1.6, 0.9, 0xb5563f, MBrick); box(Lp, 0, 7.8, -0.4, 26.4, 0.3, 1.1, 0xe8dcc8);
    for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; geo(GEO.box, M, Lp, Math.cos(a) * 9.6, 4.4 + Math.sin(a) * 1.8, 0.0, 1.1, 0.7, 0.7, i % 2 ? 0xe8dcc8 : 0xc96a50, 0, 0, a + Math.PI / 2); }
    for (const sx of [-1, 1]) for (let s = 0; s < 3; s++) geo(GEO.cyl6, M, Lp, sx * 10.6 + sx * s * 0.9, 7.3 + s * 0.3, -0.5, 0.25, 1.2, 0.25, 0x2d4a3a);
    // ivy on abutments
    for (let i = 0; i < 40; i++) { const r = rng(i * 7 + 3); const sx = r() < 0.5 ? -1 : 1; geo(GEO.sph, M, L, sx * (10.2 + r() * 0.4), r() * 5, -9 + r() * 18, 0.8 + r(), 0.9 + r(), 0.6, [0x3f6e33, 0x4f7f3a, 0x5e8c40][Math.floor(r() * 3)]); }
  }

  // ---------------------------------------------------------------- tram in the car park (road train on the tram lane)
  {
    const tl = D.parking.tram_lane; const trams = [];
    const mg = new MG(); const yel = 0xf4b942, red = 0xc8463a;
    mg.add(GEO.box, T(0, 1.0, 1.6, 0, 1.9, 1.2, 2.6), 0x2e7d4f); mg.add(GEO.box, T(0, 1.9, 1.2, 0, 1.6, 0.9, 1.4), 0x2e7d4f); mg.add(GEO.box, T(0, 2.0, 1.9, 0, 1.5, 0.6, 0.06), GLASS); mg.add(GEO.box, T(0, 2.55, 1.2, 0, 1.9, 0.1, 1.8), 0xf3e6cc);
    for (const sx of [-1, 1]) for (const zz of [0.6, 2.6]) mg.add(GEO.cyl, T(sx * 0.95, 0.45, zz, 0, 0.9, 0.3, 0.9, 0, Math.PI / 2), 0x222222);
    for (let c = 0; c < 3; c++) { const z0 = -1.5 - c * 5.2;
      mg.add(GEO.box, T(0, 0.8, z0 - 2, 0, 2.2, 0.4, 4.4), yel); for (let r = 0; r < 4; r++) mg.add(GEO.box, T(0, 1.15, z0 - 0.4 - r * 1.05, 0, 2.0, 0.5, 0.25), red);
      for (const sx of [-1, 1]) for (const zz of [0, -4]) mg.add(GEO.box, T(sx * 1.05, 1.8, z0 + zz, 0, 0.1, 2.0, 0.1), 0xffffff);
      mg.add(awnStripe(red), T(0, 2.85, z0 - 2, 0, 2.5, 0.12, 4.6), 0xffffff);
      for (const sx of [-1, 1]) for (const zz of [-0.7, -3.3]) mg.add(GEO.cyl, T(sx * 1.0, 0.4, z0 + zz, 0, 0.75, 0.25, 0.75, 0, Math.PI / 2), 0x222222);
      for (let r = 0; r < 4; r++) for (const sx of [-0.5, 0.5]) if (hash(c * 9 + r, sx > 0 ? 1 : 2) < 0.7) { mg.add(GEO.box, T(sx, 1.65, z0 - 0.6 - r * 1.05, 0, 0.36, 0.5, 0.25), [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xffffff, 0x9b59b6][Math.floor(hash(c, r * 3 + (sx > 0)) * 6)]); mg.add(GEO.sph, T(sx, 2.05, z0 - 0.6 - r * 1.05, 0, 0.26, 0.28, 0.26), 0xf1c9a5); }
    }
    const tg = mg.geo(); const tm = new THREE.InstancedMesh(tg, MV, tl.trams.length * 2); tm.castShadow = tm.receiveShadow = true; tm.frustumCulled = false; grp.add(tm);
    const Lz = tl.from[1] - tl.to[1];
    ctx.animators.push(t => {
      let k = 0;
      for (const tr of tl.trams) for (const dir of [1, -1]) {
        let u = ((tr.s + (dir > 0 ? 0 : 0.5) + t * 3.5 / (2 * Lz)) % 1 + 1) % 1; // ping-pong along the lane
        const z = tl.to[1] + Lz * (u < 0.5 ? 1 - 2 * u : 2 * u - 1); const goingN = u < 0.5; const xo = goingN ? -2 : 2;
        tm.setMatrixAt(k++, T(tl.from[0] + xo, 0, z, goingN ? Math.PI : 0));
      }
      tm.instanceMatrix.needsUpdate = true;
    });
    // drop-off canopy
    const dc = D.parking.dropoff_canopy; const Ld = frame(dc.center[0], 0, dc.center[2], 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) geo(GEO.cyl6, M, Ld, sx * (dc.w / 2 - 0.5), dc.h / 2, sz * (dc.d / 2 - 0.5), 0.25, dc.h, 0.25, IRON);
    geo(awnStripe(0xc8463a), MV, Ld, 0, dc.h + 0.1, 0, dc.w, 0.25, dc.d, 0xffffff);
    // car park lamp poles + tree-island kerbs
    for (const [lx, lz] of D.parking.lamp_poles) { const Ll = frame(lx, 0, lz, 0); geo(GEO.cyl6, M, Ll, 0, 4, 0, 0.18, 8, 0.18, 0x7f8c8d); box(Ll, 0, 8, 0, 1.6, 0.15, 0.4, 0x7f8c8d); }
  }

  // ---------------------------------------------------------------- queues: posts + rails + canopies
  for (const q of D.queues) {
    for (const [a, b] of q.rails) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / 2.2));
      K.add(GEO.box, M, beamM([a[0], 1.0, a[1]], [b[0], 1.0, b[1]], 0.07), 0x3a3a3a); K.add(GEO.box, M, beamM([a[0], 0.55, a[1]], [b[0], 0.55, b[1]], 0.05), 0x3a3a3a);
      for (let i = 0; i <= n; i++) { const u = i / n; K.add(GEO.cyl6, M, T(a[0] + (b[0] - a[0]) * u, 0.5, a[1] + (b[1] - a[1]) * u, 0, 0.09, 1.0, 0.09), 0x3a3a3a); }
    }
    const pal = land(q.land || 'thrill');
    for (const c of q.canopies) { const L = frame(c.center[0], 0, c.center[1], c.rot || 0);
      geo(stripe(new THREE.BoxGeometry(1, 1, 1, 16, 1, 1), [hex(pal.primary), 0xf3e6cc], 0, true, 4), MV, L, 0, c.height, 0, c.w, 0.08, c.d, 0xffffff, 0, 0.05);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) geo(GEO.cyl6, M, L, sx * (c.w / 2 - 0.3), c.height / 2, sz * (c.d / 2 - 0.3), 0.14, c.height, 0.14, 0x3a3a3a); }
  }

  // ---------------------------------------------------------------- fountains: stone basins, tiered columns, animated jets
  {
    const jets = []; const stone = 0xe8dcc8;
    const basin = (cx, cz, r, nJ, hJ, tiers) => {
      K.add(new THREE.TorusGeometry(r, 0.35, 6, 32), M, T(cx, 0.5, cz, 0, 1, 1, 1, Math.PI / 2), stone);
      if (tiers) { geo(GEO.cyl, M, (x, y, z, sx, sy, sz) => T(cx + x, y, cz + z, 0, sx, sy, sz), 0, 1.2, 0, 0.6, 2.4, 0.6, stone); K.add(lathe([[0.2, 0], [1.6, 0.35], [1.7, 0.5], [0.001, 0.5]], 16), M, T(cx, 2.2, cz), stone);
        if (tiers > 1) K.add(lathe([[0.15, 0], [0.9, 0.25], [1.0, 0.35], [0.001, 0.35]], 16), M, T(cx, 3.2, cz), stone); }
      for (let k = 0; k < nJ; k++) { const a = k / nJ * Math.PI * 2; jets.push([cx + Math.cos(a) * r * 0.85, cz + Math.sin(a) * r * 0.85, -Math.cos(a), -Math.sin(a), hJ, r * 0.6]); }
      if (tiers) jets.push([cx, cz, 0, 0, hJ + 1.6, 0]);
    };
    for (const w of D.water) {
      if (w.id === 'square_fountain') basin(w.circle[0], w.circle[1], w.circle[2], w.jets.count, w.jets.height, w.jets.tiers || 1);
      if (w.id === 'entrance_fountains') for (const c of w.circles) basin(c[0], c[1], c[2], w.jets.count, w.jets.height, 1);
      if (w.id === 'hub_moat') { const [cx, cz, r0, r1] = w.annulus; K.add(new THREE.TorusGeometry(r1, 0.3, 6, 48), M, T(cx, 0.5, cz, 0, 1, 1, 1, Math.PI / 2), stone);
        for (let k = 0; k < w.jets.count; k++) { const a = k / w.jets.count * Math.PI * 2; jets.push([cx + Math.cos(a) * w.jets.radius, cz + Math.sin(a) * w.jets.radius, -Math.cos(a), -Math.sin(a), w.jets.height, 1.4]); } }
    }
    const ND = 10; const dm = new THREE.InstancedMesh(GEO.ico, mat({ color: 0xffffff, frag: `{ diffuseColor.rgb = vec3(.86,.94,.98); }` }), jets.length * ND); dm.frustumCulled = false; grp.add(dm);
    ctx.animators.push(t => { let i = 0; for (const [x, z, dx, dz, h, reach] of jets) for (let k = 0; k < ND; k++) { const u = ((k / ND + t * 0.9) % 1); const y = 0.5 + 4 * h * u * (1 - u); const s = 0.16 + 0.1 * (1 - Math.abs(u - 0.5) * 2);
      dm.setMatrixAt(i++, T(x + dx * reach * u, y, z + dz * reach * u, 0, s, s * 2.2, s)); } dm.instanceMatrix.needsUpdate = true; });
  }
  // ---------------------------------------------------------------- street furniture
  furniture(ctx, K, { M, MV, MD, MGlass, box, geo, awnStripe, umbG, IRON, WHITE, GOLD, GLASS });
  K.build(true); dyn.build(); ctx.animators.push(t => dyn.update(t));
}

function furniture(ctx, K0, H) {
  const { D, mat, root, pixel } = ctx;
  const PF = ctx.propFilter || (() => true); let fx = 0, fz = 0;
  const K = { add: (g, m, mm, c) => { const e = mm.elements; if (PF(e[12], e[14])) K0.add(g, m, mm, c); } }; const { M, MV, IRON, WHITE, GOLD, GLASS, umbG, awnStripe } = H;
  const pr = D.props; const grp = ctx.archGroup;
  // lamp models (merged, vertex coloured) per style
  const lampGeo = {};
  const LG = (style) => {
    if (lampGeo[style]) return lampGeo[style]; const mg = new MG();
    const glass = 0xfff2c8;
    switch (style) {
      case 'victorian_double': case 'victorian_triple': {
        const h = style === 'victorian_triple' ? 5 : 4.2;
        mg.add(GEO.cyl6, T(0, 0.3, 0, 0, 0.45, 0.6, 0.45), IRON); mg.add(GEO.cyl, T(0, h / 2, 0, 0, 0.16, h, 0.16), IRON); mg.add(GEO.sph, T(0, 0.75, 0, 0, 0.3, 0.3, 0.3), IRON);
        const arms = style === 'victorian_triple' ? [0, 2.09, 4.19] : [0, Math.PI];
        for (const a of arms) { const cx = Math.cos(a) * 0.75, cz = Math.sin(a) * 0.75; mg.add(GEO.box, beamM([0, h - 0.4, 0], [cx, h - 0.15, cz], 0.07), IRON);
          if (style === 'victorian_triple') mg.add(GEO.sph, T(cx, h + 0.1, cz, 0, 0.5, 0.5, 0.5), glass);
          else { mg.add(GEO.box, T(cx, h + 0.05, cz, 0, 0.32, 0.5, 0.32), glass); mg.add(GEO.cone4, T(cx, h + 0.42, cz, 0, 0.5, 0.28, 0.5), IRON); } }
        mg.add(GEO.cone, T(0, h + 0.3, 0, 0, 0.12, 0.5, 0.12), GOLD); break;
      }
      case 'mushroom_pastel': mg.add(GEO.cyl, T(0, 1.4, 0, 0, 0.22, 2.8, 0.22), 0xfff4e0); mg.add(GEO.hemi, T(0, 2.75, 0, 0, 1.3, 0.7, 1.3), 0xf5a6c8); mg.add(GEO.sph, T(0, 2.75, 0, 0, 0.5, 0.3, 0.5), glass); break;
      case 'seaside_globe': mg.add(GEO.cyl, T(0, 1.9, 0, 0, 0.16, 3.8, 0.16), WHITE); mg.add(GEO.cyl, T(0, 3.6, 0, 0, 0.36, 0.12, 0.36), 0x2e86c1); mg.add(GEO.sph, T(0, 3.95, 0, 0, 0.6, 0.6, 0.6), glass); mg.add(GEO.cyl6, T(0, 0.2, 0, 0, 0.45, 0.4, 0.45), 0x2e86c1); break;
      case 'bamboo_lantern': mg.add(GEO.cyl6, T(0, 1.5, 0, 0, 0.14, 3, 0.14), 0xc9a35a); mg.add(GEO.cyl, T(0, 2.75, 0, 0, 0.45, 0.6, 0.45), 0xe9b44c); mg.add(GEO.cone, T(0, 3.15, 0, 0, 0.7, 0.3, 0.7), 0x8b6b4a); break;
      case 'modern_mast': mg.add(GEO.cyl6, T(0, 3, 0, 0, 0.18, 6, 0.18), 0x4a4f58); mg.add(GEO.box, T(0.3, 6, 0, 0, 1.0, 0.12, 0.35), 0x4a4f58); mg.add(GEO.cyl6, T(0, 4.6, 0, 0, 0.22, 0.3, 0.22), 0xe23b2e); break;
      case 'timber_lantern': mg.add(GEO.box, T(0, 1.75, 0, 0, 0.22, 3.5, 0.22), 0x8b6b4a); mg.add(GEO.box, T(0.4, 3.4, 0, 0, 0.9, 0.12, 0.12), 0x8b6b4a); mg.add(GEO.box, T(0.75, 3.0, 0, 0, 0.28, 0.42, 0.28), glass); mg.add(GEO.cone4, T(0.75, 3.3, 0, 0, 0.42, 0.2, 0.42), 0x3a3a3a); break;
      case 'bulb_pole': default: { const st = stripe(new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 10), [0xd7263d, WHITE], 8); mg.add(GEO.cyl, T(0, 2.5, 0, 0, 0.18, 5, 0.18), 0xd7263d); mg.add(GEO.cyl, T(0, 4.6, 0, 0, 0.22, 0.25, 0.22), WHITE); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; mg.add(GEO.sph, T(Math.cos(a) * 0.45, 5.0, Math.sin(a) * 0.45, 0, 0.2, 0.2, 0.2), glass); } mg.add(GEO.sph, T(0, 5.2, 0, 0, 0.3, 0.3, 0.3), GOLD); }
    }
    return lampGeo[style] = mg.geo();
  };
  for (const [x, y, z, st] of pr.lamps.list) K.add(LG(st), MV, T(x, y || 0, z, hash(Math.round(x * 10), Math.round(z * 10)) * 3));
  // hanging baskets
  for (const [x, y, z] of pr.hanging_baskets.list) for (const s of [-1, 1]) { K.add(GEO.hemi, M, T(x + s * 0.75, y + 0.15, z, 0, 0.55, -0.45, 0.55), 0x6b4a2e); for (let k = 0; k < 5; k++) K.add(GEO.sph, M, T(x + s * 0.75 + (hash(k, x) - 0.5) * 0.5, y + 0.2 + hash(k, z) * 0.15, z + (hash(z, k) - 0.5) * 0.5, 0, 0.26, 0.22, 0.26), [0xe74c3c, 0xf5a6c8, 0xffffff, 0x9b59b6, 0x4f8f3a][k]); }
  // benches
  const benchG = (() => { const mg = new MG(); const wood = 0x9a6338; for (let i = 0; i < 3; i++) mg.add(GEO.box, T(0, 0.45, -0.18 + i * 0.17, 0, 1.8, 0.05, 0.14), wood); for (let i = 0; i < 2; i++) mg.add(GEO.box, T(0, 0.65 + i * 0.18, -0.33, 0, 1.8, 0.12, 0.04, -0.2), wood);
    for (const s of [-0.8, 0.8]) { mg.add(GEO.box, T(s, 0.25, 0, 0, 0.08, 0.5, 0.55), IRON); mg.add(GEO.box, T(s, 0.62, -0.32, 0, 0.08, 0.6, 0.08, -0.2), IRON); mg.add(GEO.box, T(s, 0.6, 0.05, 0, 0.08, 0.06, 0.5), IRON); } return mg.geo(); })();
  for (const [x, y, z, r] of pr.benches.list) K.add(benchG, MV, T(x, y || 0, z, r));
  const binG = (() => { const mg = new MG(); mg.add(GEO.cyl, T(0, 0.5, 0, 0, 0.55, 1.0, 0.55), IRON); mg.add(GEO.cyl, T(0, 1.03, 0, 0, 0.62, 0.08, 0.62), GOLD); mg.add(GEO.hemi, T(0, 1.05, 0, 0, 0.55, 0.2, 0.55), IRON); return mg.geo(); })();
  for (const [x, y, z] of pr.bins.list) K.add(binG, MV, T(x, y || 0, z));
  for (const [x, y, z, st, d] of pr.planters.list) { K.add(lathe([[0.3, 0], [0.38, 0.1], [0.3, 0.5], [0.5, 0.9], [0.52, 1.0], [0.001, 1.0]], 12), M, T(x, 0, z, 0, d, 1, d), IRON); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; K.add(GEO.sph, M, T(x + Math.cos(a) * d * 0.28, 1.1 + hash(k, x * 3) * 0.2, z + Math.sin(a) * d * 0.28, 0, d * 0.4, d * 0.35, d * 0.4), [0xe74c3c, 0xf1c40f, 0xffffff, 0xf5a6c8, 0x9b59b6, 0x4f8f3a, 0x5e8c40][k]); } K.add(GEO.sph, M, T(x, 1.2, z, 0, d * 0.6, d * 0.5, d * 0.6), 0x4f7f3a); }
  for (const [x, y, z] of pr.drinking_fountains.list) { K.add(GEO.cyl, M, T(x, 0.45, z, 0, 0.4, 0.9, 0.4), 0x9a948a); K.add(GEO.cyl, M, T(x, 0.95, z, 0, 0.6, 0.15, 0.6), 0x8d949c); }
  // umbrella tables
  const tableG = (() => { const mg = new MG(); mg.add(GEO.cyl, T(0, 0.74, 0, 0, 0.9, 0.05, 0.9), WHITE); mg.add(GEO.cyl6, T(0, 0.37, 0, 0, 0.08, 0.74, 0.08), IRON); mg.add(GEO.cyl6, T(0, 1.4, 0, 0, 0.06, 2.4, 0.06), WHITE);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; const cx = Math.cos(a) * 0.85, cz = Math.sin(a) * 0.85; mg.add(GEO.box, T(cx, 0.45, cz, -a, 0.42, 0.05, 0.42), 0xffffff); mg.add(GEO.box, T(cx + Math.cos(a) * 0.2, 0.7, cz + Math.sin(a) * 0.2, -a + Math.PI / 2, 0.42, 0.5, 0.04), 0xffffff); for (const s of [-1, 1]) mg.add(GEO.box, T(cx, 0.22, cz + s * 0.15, 0, 0.04, 0.45, 0.04), IRON); }
    return mg.geo(); })();
  for (const [x, y, z, d, c, pat] of pr.umbrella_tables.list) { K.add(tableG, MV, T(x, 0, z, hash(x, z) * 6)); K.add(umbG(hex(c)), MV, T(x, 2.3, z, hash(z, x) * 6, d, d * 0.9, d)); }
  // carts
  for (const [x, y, z, tp, r] of pr.carts.list) { const L = frame(x, 0, z, r); const body = { popcorn: 0xd7263d, ice_cream: 0xa8d8ea, balloons: 0xf4b942, candy_floss: 0xf5a6c8, churros: 0xe9b44c, drinks: 0x1b998b }[tp] || 0xf4b942;
    K.add(GEO.box, M, L(0, 1.0, 0, 2.4, 1.1, 1.2), body); K.add(GEO.box, M, L(0, 1.6, 0, 2.5, 0.1, 1.3), WHITE); K.add(GEO.box, MGl(), L(0, 2.0, 0, 1.4, 0.8, 0.9), 0xfff2c8);
    for (const s of [-1, 1]) K.add(GEO.cyl, M, L(s * 0.9, 0.42, 0.65, 0.8, 0.1, 0.8, 0, Math.PI / 2), 0x3a3a3a);
    for (const sx of [-1, 1]) K.add(GEO.cyl6, M, L(sx * 1.1, 2.4, 0, 0.06, 1.6, 0.06), WHITE); K.add(awnStripe(body), MV, L(0, 3.2, 0, 2.9, 0.1, 1.7), 0xffffff);
    if (PF(x, z)) ctx.extraPeople.push([x + Math.sin(r + Math.PI) * 1.1, 0, z + Math.cos(r + Math.PI) * 1.1, r, 0xffffff, 0]); }
  function MGl() { return H.MGlass; }
  // flagpoles (+ animated flags)
  for (const [x, y, z, h, c] of pr.flagpoles.list) { K.add(GEO.cyl6, M, T(x, y + h / 2, z, 0, 0.12, h, 0.12), 0xeeeeee); K.add(GEO.sph, M, T(x, y + h + 0.1, z, 0, 0.25, 0.25, 0.25), GOLD); if (PF(x, z)) ctx.flags.push({ L: frame(x, 0, z, 0), x: 0, y: y + h - 0.7, z: 0, c: hex(c) }); }
  // signposts with blank blades
  for (const [x, y, z, nb] of pr.signposts.list) { K.add(GEO.cyl6, M, T(x, 1.6, z, 0, 0.14, 3.2, 0.14), IRON); K.add(GEO.cone, M, T(x, 3.35, z, 0, 0.2, 0.4, 0.2), GOLD);
    const lc = hex((D.lands.find(l => l.id === ctx.park.landAt(x, z)) || D.lands[0]).palette.primary);
    for (let k = 0; k < nb; k++) { const a = hash(x * 7 + k, z) * 6.283; K.add(GEO.box, M, T(x, 2.6 - k * 0.45, z, a).multiply(T(0.6, 0, 0, 0, 1.1, 0.3, 0.05)), lc); } }
  // fences: posts + rails + mesh panels
  const MFence = mat({ side: THREE.DoubleSide, frag: `{ float b = fract((p.x+p.z)*4.); if (b > .3 && fract(p.y*5.) > .2) discard; }`, mot: 0 });
  for (const f of pr.fences) { const lake = f.ride === undefined || /lake|rail/.test(f.style || ''); const col = /white/.test(f.style || '') || lake ? 0xf4f0e6 : 0x2a2d33;
    for (let i = 0; i < f.points.length - 1; i++) { const a = f.points[i], b = f.points[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / 2.5));
      K.add(GEO.box, M, beamM([a[0], f.height, a[1]], [b[0], f.height, b[1]], 0.07), col); K.add(GEO.box, M, beamM([a[0], 0.12, a[1]], [b[0], 0.12, b[1]], 0.05), col);
      if (!lake) K.add(GEO.box, MFence, beamM([a[0], f.height / 2, a[1]], [b[0], f.height / 2, b[1]], 0.02, f.height), col); else K.add(GEO.box, M, beamM([a[0], f.height * 0.55, a[1]], [b[0], f.height * 0.55, b[1]], 0.05), col);
      for (let k = 0; k <= n; k++) { const u = k / n; K.add(GEO.box, M, T(a[0] + (b[0] - a[0]) * u, f.height / 2, a[1] + (b[1] - a[1]) * u, 0, 0.09, f.height, 0.09), col); } } }
  // balloon sellers
  for (const bs of pr.balloon_sellers) { const [x, , z] = bs.seller; if (!PF(x, z)) continue; ctx.extraPeople.push([x, 0, z, 0, 0xf1c40f, 0]);
    for (let k = 0; k < bs.count; k++) { const a = k * 2.4, r = 0.4 + (k % 5) * 0.18; const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, by = 3.2 + (k % 4) * 0.35; ctx.balloons.push([bx, by, bz, hex(bs.colors[k % bs.colors.length]), x + 0.3, 1.2, z]); } }
  // bunting (pennants) and string lights
  const pennant = new THREE.BufferGeometry(); pennant.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3)); pennant.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const MPen = mat({ side: THREE.DoubleSide, frag: `{ diffuseColor.rgb = pow(diffuseColor.rgb, vec3(.85))*1.15; }`, mot: 0.05 });
  const bun = new Kit(grp);
  const sag = (a, b, s, n) => { const o = []; for (let i = 0; i <= n; i++) { const u = i / n; o.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - s * 4 * u * (1 - u), a[2] + (b[2] - a[2]) * u]); } return o; };
  const allBunting = pr.bunting.list.concat(ctx.extraBunting || []);
  ctx.buntingInst = [];
  for (const bt of allBunting) { const L = Math.hypot(bt.b[0] - bt.a[0], bt.b[2] - bt.a[2]); const step = Math.max(0.45, (bt.pennant || 0.3) * 1.6); const n = Math.max(2, Math.round(L / step)); const pts = sag(bt.a, bt.b, bt.sag, n);
    const yaw = Math.atan2(bt.b[0] - bt.a[0], bt.b[2] - bt.a[2]) - Math.PI / 2;
    for (let i = 0; i < n; i++) { const p0 = pts[i], p1 = pts[i + 1]; K.add(GEO.box, M, beamM(p0, p1, 0.025), 0x555555);
      const sz = (bt.pennant || 0.3) * 1.5; if (PF(p0[0], p0[2])) bun.add(pennant, MPen, T((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, yaw, sz, sz * 1.3, 1, 0.15 * Math.sin(i * 1.7)), hex(bt.colors[i % bt.colors.length])); } }
  for (const sl of pr.string_lights.list) { const L = Math.hypot(sl.b[0] - sl.a[0], sl.b[2] - sl.a[2]); const n = Math.max(2, Math.round(L / (sl.bulb_spacing * 1.5))); const pts = sag(sl.a, sl.b, sl.sag, n);
    for (let i = 0; i < n; i++) { K.add(GEO.box, M, beamM(pts[i], pts[i + 1], 0.03), 0x333333); if (PF(pts[i][0], pts[i][2])) ctx.bulbs.push([T(...pts[i], 0, 0.18, 0.24, 0.18), hex(sl.color || '#FFC76B')]); } }
  bun.build(false);
}
