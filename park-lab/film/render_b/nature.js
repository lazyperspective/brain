// nature.js: trees, planting, street furniture, bunting/string lights, static bulbs and light pools
import * as THREE from 'three';
import { merge, box, cyl, ico, sph, cone, S, T, R, hash, treeGeometries, speciesKind } from './geo.js';

const hex = s => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);
const lerp = (a, b, u) => a + (b - a) * u;

export function buildNature(W, park, opts = {}) {
  const D = park.data; const { put, cmp, beamM, frame, mat, G, addBulb, addPool, LP } = W;
  const ground = (x, z) => park.heightAt(x, z);
  const treeSub = opts.treeSub || 0; // drop far-away trees outside the detail box with this probability

  // ================================================================ TREES
  const sp = D.planting.species; const geos = {};
  const tg = (kind, v) => { const k = kind + v; if (!geos[k]) geos[k] = treeGeometries(kind, LP, v); return geos[k]; };
  const T = D.planting.trees.list;
  T.forEach(([x, gy, z, si, h, cr, cv], k) => {
    if (treeSub && !W.inDetail(x, z) && hash(k * 1.31) < treeSub) return;
    const s = sp[si]; const kind = speciesKind[s.id] || 'round'; const v = k % 3; const g = tg(kind, v);
    const col = new THREE.Color(hex(s.colors[cv % s.colors.length]));
    const j = (hash(k * 2.7) - 0.5) * 0.12; col.offsetHSL(j * 0.15, 0, j);
    const ry = hash(k) * 6.283; const crw = kind === 'column' ? cr * 1.3 : kind === 'palm' || kind === 'banana' ? h * 0.5 : cr;
    const m = cmp(x, gy, z, ry, crw, h, crw);
    put(g.crown, 'leaf', m, col.getHex());
    const bark = s.id === 'birch' ? 0xe8e4dc : s.id === 'plane' ? 0x9a8a70 : s.id === 'palm' ? 0x8b6b4a : 0x5a3e28;
    put(g.trunk, 'bark', cmp(x, gy, z, ry, kind === 'palm' ? h * 0.5 : Math.max(1.6, crw), h, kind === 'palm' ? h * 0.5 : Math.max(1.6, crw)), bark);
    if (s.id === 'cherry_blossom' && W.inDetail(x, z)) for (let i = 0; i < 4; i++) put('sph0', 'leaf', cmp(x + (hash(k + i) - 0.5) * cr * 2, 0.04, z + (hash(k * 3 + i) - 0.5) * cr * 2, 0, 1.2, 0.04, 1.2), 0xf7c9d6, { shadow: false });
  });
  // tree grates on Main Street avenue trees (lime_clipped)
  T.forEach(([x, gy, z, si], k) => { if (sp[si].id === 'lime_clipped') { put('box', 'metal', cmp(x, 0.05, z, 0, 1.6, 0.06, 1.6), 0x3a3a3a); } });

  // ================================================================ FLOWER BEDS (flower dots)
  for (const b of D.planting.flower_beds) {
    const mix = b.mix.map(hex);
    const pts = [];
    if (b.kind === 'circle') { const [cx, cz, r] = b.circle; for (let i = 0; i < r * r * 3; i++) { const a = i * 2.39996, rr = Math.sqrt(i / (r * r * 3)) * r; pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, 0]); } }
    else if (b.kind === 'annulus') { const [cx, cz, r0, r1] = b.annulus; const n = Math.floor((r1 * r1 - r0 * r0) * 3); for (let i = 0; i < n; i++) { const a = i * 2.39996, rr = Math.sqrt(r0 * r0 + (r1 * r1 - r0 * r0) * i / n); pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, Math.floor((a % 6.283) / 6.283 * 16)]); } }
    else { const [cx, cz] = b.center; for (let i = 0; i < b.w * b.d * 3; i++) { const u = hash(i * 1.3 + cx), v = hash(i * 2.9 + cz); pts.push([cx + (u - 0.5) * b.w, cz + (v - 0.5) * b.d, Math.floor((u) * 6)]); } }
    pts.forEach(([px, pz, band], i) => { const c = mix.length === 1 ? mix[0] : mix[(band + (b.kind === 'rect' ? 0 : 0)) % mix.length]; const s = 0.35 + hash(i) * 0.2; put('sph0', 'leaf', cmp(px, 0.12 + s * 0.3, pz, hash(i * 7) * 6, s, s * 0.7, s), mix.length === 1 ? c : (hash(i * 5.1) < 0.25 ? 0x4f7f3a : c), { shadow: false }); });
  }
  // shrub zones -> shrub blobs along outlines
  for (const zone of D.planting.shrub_zones) { for (let i = 0; i < zone.length; i += 2) { const [x, z] = zone[i]; const s = 1.0 + hash(x * z) * 0.8; put('sph0', 'leaf', cmp(x, ground(x, z) + s * 0.35, z, hash(i) * 6, s * 1.3, s * 0.9, s * 1.3), [0x4f7f3a, 0x3f6e33, 0x5e8c40][i % 3]); } }
  for (const h of D.planting.hedges) for (let i = 0; i < h.points.length - 1; i++) { const a = h.points[i], b = h.points[i + 1]; put('box', 'leaf', beamM([a[0], h.height / 2, a[1]], [b[0], h.height / 2, b[1]], 0.9, h.height), 0x3f6e33); put('box', 'leaf', beamM([a[0], h.height / 2, a[1]], [b[0], h.height / 2, b[1]], 0.8, h.height), 0x3f6e33); }
  for (const t of D.planting.topiary) { const [x, , z] = t.position; const h = t.height;
    if (t.shape === 'ball_stack') { for (let i = 0; i < 3; i++) put('sph', 'leaf', cmp(x, 0.4 + i * 0.7, z, 0, 1.0 - i * 0.2, 1.0 - i * 0.2, 1.0 - i * 0.2), 0x2e6b3a); }
    else { put('sph', 'leaf', cmp(x, h * 0.35, z, 0, 1.6, h * 0.55, 1.1), 0x2e6b3a); put('sph', 'leaf', cmp(x, h * 0.75, z + 0.4, 0, 0.8, 0.8, 0.8), 0x2e6b3a); put('sph', 'leaf', cmp(x + 0.25, h * 0.95, z + 0.4, 0, 0.25, 0.7, 0.2), 0x2e6b3a); put('sph', 'leaf', cmp(x - 0.25, h * 0.95, z + 0.4, 0, 0.25, 0.7, 0.2), 0x2e6b3a); }
    put('cyl12', 'solid', cmp(x, 0.2, z, 0, 2.2, 0.4, 2.2), 0x8e5b3a); }
  // lake reeds
  { const lake = D.water.find(w => w.id === 'lake'); if (lake) { const P = lake.polygon; for (let i = 0; i < P.length; i++) { const [x, z] = P[i]; if (x > -200 || z < 60) continue; for (let k = 0; k < 6; k++) put('cyl6', 'leaf', cmp(x + (hash(i * 9 + k) - 0.5) * 3, 0.2, z + (hash(i * 3 + k) - 0.5) * 3, 0, 0.12, 1.4 + hash(k + i) * 0.6, 0.12), 0x7a9a4a, { shadow: false }); } } }
  // terrain features: jungle rock mountain faces, mesa
  for (const h of D.terrain.features.hills || []) {
    if (h.id === 'jungle_rock') for (let i = 0; i < 70; i++) { const a = i * 2.39996, r = Math.sqrt(i / 70) * h.radius * 0.9; const x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r; const gy = ground(x, z); const s = 2 + hash(i) * 4; put('sph0', 'solid', cmp(x, gy, z, hash(i * 3) * 6, s * 1.4, s, s * 1.2), [0x9b8b78, 0x8a7a68, 0xa89880, 0x7d6e5c][i % 4]); }
    if (h.id === 'frontier_mesa') for (let i = 0; i < 40; i++) { const a = i * 2.39996, r = Math.sqrt(i / 40) * h.radius * 0.85; const x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r; const gy = ground(x, z); const s = 1.5 + hash(i) * 3; put('box', 'solid', cmp(x, gy, z, hash(i * 3) * 6, s * 1.6, s * 0.8, s * 1.3), [0xb5653c, 0xa0522d, 0xc27a4a][i % 3]); }
  }

  // ================================================================ STREET FURNITURE
  const lampHead = { victorian_double: 4.2, victorian_triple: 5, mushroom_pastel: 3, seaside_globe: 3.8, bamboo_lantern: 3, modern_mast: 6, timber_lantern: 3.5, bulb_pole: 5 };
  D.props.lamps.list.forEach(([x, y, z, st], k) => {
    const land = W.landOf(x, z); const h = lampHead[st] || 4;
    const L = frame(x, 0, z, hash(k) * 0);
    switch (st) {
      case 'victorian_double': case 'victorian_triple':
        L.g('cyl8', 'metal', 0, 0.35, 0, 0.42, 0.7, 0.42, 0x1f3a2e); L.g('cyl8', 'metal', 0, h / 2, 0, 0.16, h, 0.16, 0x1f3a2e); L.g('sph', 'metal', 0, h * 0.62, 0, 0.26, 0.2, 0.26, 0x1f3a2e);
        for (const sx of (st === 'victorian_triple' ? [-1, 0, 1] : [-1, 1])) { L.box('metal', sx * 0.45, h - 0.15, 0, 0.9 * Math.abs(sx) + 0.06, 0.06, 0.06, 0x1f3a2e); L.g('cyl8', 'glow:' + land, sx * 0.85, h - 0.35, 0, 0.36, 0.55, 0.36, 0xfff2c8); L.g('cone8', 'metal', sx * 0.85, h - 0.02, 0, 0.5, 0.25, 0.5, 0x1f3a2e); addBulb(land, ...L.p(sx * 0.85, h - 0.35, 0), 0xffd28a, 0.42, 'lamp'); }
        break;
      case 'mushroom_pastel': L.g('cyl8', 'ride', 0, h / 2, 0, 0.2, h, 0.2, 0xffffff); L.g('dome', 'ride', 0, h - 0.2, 0, 1.4, 0.7, 1.4, [0xf4a7b9, 0xa8d8ea, 0xffe08a, 0xc3a6e0][k % 4]); for (let i = 0; i < 5; i++) L.g('sph0', 'ride', Math.cos(i * 1.3) * 0.4, h + 0.05, Math.sin(i * 1.3) * 0.4, 0.15, 0.15, 0.15, 0xffffff); addBulb(land, x, h - 0.35, z, 0xffd8a0, 0.4, 'lamp'); break;
      case 'seaside_globe': L.g('cyl8', 'ride', 0, h / 2, 0, 0.16, h, 0.16, 0xffffff); L.g('cyl8', 'ride', 0, h - 0.6, 0, 0.3, 0.15, 0.3, 0x2e86c1); L.g('sph', 'glow:' + land, 0, h, 0, 0.6, 0.6, 0.6, 0xfff8e8); addBulb(land, x, h, z, 0xfff0d0, 0.5, 'lamp'); break;
      case 'bamboo_lantern': L.g('cyl6', 'solid', 0, h / 2, 0, 0.14, h, 0.14, 0xb08d57); L.box('solid', 0.3, h - 0.1, 0, 0.6, 0.06, 0.06, 0xb08d57); L.g('cyl8', 'glow:' + land, 0.55, h - 0.5, 0, 0.42, 0.55, 0.42, 0xffa860); addBulb(land, ...L.p(0.55, h - 0.5, 0), 0xffa050, 0.42, 'lamp'); break;
      case 'modern_mast': L.g('cyl8', 'metal', 0, h / 2, 0, 0.18, h, 0.18, 0x3a3f46); L.g('cyl8', 'ride', 0, h * 0.75, 0, 0.21, 0.4, 0.21, 0xe23b2e); L.box('metal', 0.5, h, 0, 1.3, 0.12, 0.35, 0x3a3f46); L.box('glow:' + land, 0.6, h - 0.08, 0, 1.0, 0.04, 0.25, 0xf0f6ff); addBulb(land, ...L.p(0.6, h - 0.15, 0), 0xeaf4ff, 0.3, 'lamp'); break;
      case 'timber_lantern': L.g('box', 'solid', 0, h / 2, 0, 0.2, h, 0.2, 0x6b4a2e); L.box('solid', 0.35, h, 0, 0.8, 0.12, 0.12, 0x6b4a2e); L.box('glow:' + land, 0.65, h - 0.45, 0, 0.3, 0.42, 0.3, 0xffb050); addBulb(land, ...L.p(0.65, h - 0.45, 0), 0xffa848, 0.36, 'lamp'); break;
      case 'bulb_pole': for (let i = 0; i < 5; i++) L.g('cyl8', 'ride', 0, i + 0.5, 0, 0.18, 1, 0.18, i % 2 ? 0xd7263d : 0xffffff); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; L.g('sph0', 'glow:' + land, Math.cos(a) * 0.6, h + 0.1, Math.sin(a) * 0.6, 0.22, 0.22, 0.22, 0xffffff); addBulb(land, ...L.p(Math.cos(a) * 0.6, h + 0.1, Math.sin(a) * 0.6), 0xffd890, 0.26); } break;
    }
    addPool(land, x, z, st === 'modern_mast' ? 10 : 8, st === 'modern_mast' ? 0xa8b8d8 : 0xffb862, st === 'modern_mast' ? 0.6 : 0.9);
  });
  for (const [x, y, z] of D.props.hanging_baskets.list) { put('sph', 'solid', cmp(x + 0.85, y, z, 0, 0.6, 0.4, 0.6), 0x3a2a1a); for (let i = 0; i < 6; i++) put('sph0', 'leaf', cmp(x + 0.85 + Math.cos(i) * 0.25, y + 0.12 - (i % 2) * 0.25, z + Math.sin(i) * 0.25, 0, 0.25, 0.25, 0.25), [0xe74c3c, 0xf5a6c8, 0xffffff, 0x9b59b6, 0x4f7f3a][i % 5]); }
  const benchGeo = merge([box(1.8, 0.06, 0.12, 0, 0.45, 0.17), box(1.8, 0.06, 0.12, 0, 0.45, 0.02), box(1.8, 0.06, 0.12, 0, 0.45, -0.13), box(1.8, 0.1, 0.05, 0, 0.62, -0.25), box(1.8, 0.1, 0.05, 0, 0.78, -0.27), box(0.08, 0.45, 0.5, -0.8, 0.22, 0), box(0.08, 0.45, 0.5, 0.8, 0.22, 0), box(0.06, 0.4, 0.06, -0.8, 0.65, -0.27), box(0.06, 0.4, 0.06, 0.8, 0.65, -0.27)]);
  for (const [x, y, z, r] of D.props.benches.list) put(benchGeo, 'solid', cmp(x, 0, z, r, 1, 1, 1), 0x8e5b3a);
  const binGeo = merge([cyl(0.28, 0.25, 0.9, 10, 0, 0.45, 0), cyl(0.31, 0.31, 0.08, 10, 0, 0.92, 0), S(sph(0.29, 10, 4, 0, 0.95, 0, 0, Math.PI * 2, 0, Math.PI / 2), 1, 0.5, 1)]);
  for (const [x, y, z] of D.props.bins.list) put(binGeo, 'metal', cmp(x, 0, z, 0, 1, 1, 1), 0x2d4a3a);
  for (const [x, y, z, st, d] of D.props.planters.list) { put('cyl12', 'solid', cmp(x, 0.4, z, 0, d, 0.8, d), 0x2d4a3a); put('cyl12', 'solid', cmp(x, 0.82, z, 0, d + 0.15, 0.08, d + 0.15), 0x1f3a2e); for (let i = 0; i < 9; i++) put('sph0', 'leaf', cmp(x + Math.cos(i * 2.4) * d * 0.3, 0.95 + (i % 3) * 0.08, z + Math.sin(i * 2.4) * d * 0.3, 0, 0.35, 0.3, 0.35), [0xe74c3c, 0xffffff, 0xf1c40f, 0x9b59b6, 0x4f7f3a, 0x4f7f3a][i % 6]); }
  const chairGeo = merge([box(0.45, 0.05, 0.45, 0, 0.45, 0), box(0.45, 0.45, 0.05, 0, 0.7, -0.2), ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => box(0.04, 0.45, 0.04, a * 0.2, 0.22, b * 0.2))]);
  for (const [x, y, z, d, c, pat] of D.props.umbrella_tables.list) {
    put('cyl12', 'solid', cmp(x, 0.73, z, 0, 1.0, 0.05, 1.0), 0xffffff); put('cyl6', 'metal', cmp(x, 0.37, z, 0, 0.08, 0.74, 0.08), 0x888888);
    put('cyl6', 'metal', cmp(x, 1.3, z, 0, 0.06, 2.6, 0.06), 0xdddddd);
    const n = 8; for (let i = 0; i < n; i++) { const a = i / n * 6.283; put('tri', 'fabric', cmp(x + Math.cos(a + 0.39) * d * 0.22, 2.4, z + Math.sin(a + 0.39) * d * 0.22, -a - 0.39 + Math.PI / 2, d * 0.4, 1, d * 0.5, -1.25), (pat === 'striped' && i % 2) ? 0xffffff : hex(c)); }
    put('cone8', 'fabric', cmp(x, 2.45, z, 0.39, d * 1.0, 0.55, d * 1.0), hex(c));
    for (let j = 0; j < 4; j++) { const a = j / 4 * 6.283 + hash(x) ; put(chairGeo, 'solid', cmp(x + Math.cos(a) * 0.85, 0, z + Math.sin(a) * 0.85, Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI, 1, 1, 1), 0xffffff); }
  }
  const cartCol = { popcorn: 0xd7263d, ice_cream: 0xf5a6c8, balloons: 0x3498db, pretzel: 0xd9a441, churros: 0xe67e22, souvenir: 0x2e86c1, cotton_candy: 0xf5a6c8, lemonade: 0xf1c40f };
  for (const [x, y, z, tp, r] of D.props.carts.list) {
    const L = frame(x, 0, z, r); const c = cartCol[tp] || 0xd7263d;
    L.box('ride', 0, 1.0, 0, 2.4, 1.1, 1.2, c); L.box('solid', 0, 1.6, 0, 2.5, 0.08, 1.3, 0xffffff);
    for (const sx of [-1, 1]) { L.g('cyl12', 'solid', sx * 0.8, 0.35, 0.62, 0.6, 0.6, 0.6, 0x333333, 0, 0, Math.PI / 2); L.g('cyl6', 'metal', sx * 1.05, 2.1, 0, 0.05, 1.0, 0.05, 0xdddddd); }
    for (let i = 0; i < 8; i++) L.box('fabric', -1.3 + (i + 0.5) * 0.325, 2.65, 0, 0.325, 0.06, 1.6, i % 2 ? 0xffffff : c, 0, 0, 0);
    L.box(tp === 'popcorn' ? 'glow:' + W.landOf(x, z) : 'glass', 0, 1.95, 0, 1.2, 0.6, 0.8, tp === 'popcorn' ? 0xfff2c0 : 0x9fd3e8);
    L.g('sph', 'solid', 0, 3.0, 0, 0.5, 0.5, 0.5, c);
    addBulb(W.landOf(x, z), ...L.p(0, 2.55, 0.85), 0xffd890, 0.25);
  }
  for (const [x, y, z, h, c] of D.props.flagpoles.list) {
    put('cyl6', 'metal', cmp(x, y + h / 2, z, 0, 0.12, h, 0.12), 0xeeeeee); put('sph0', 'metal', cmp(x, y + h + 0.1, z, 0, 0.25, 0.25, 0.25), 0xd9a441);
    for (let i = 0; i < 6; i++) put('box', 'fabric', cmp(x + 0.15 + i * 0.27, y + h - 0.6 + Math.sin(i * 0.9) * 0.08, z + Math.sin(i * 1.3) * 0.12, Math.sin(i) * 0.3, 0.28, 1.0, 0.03), hex(c));
  }
  for (const [x, y, z, n] of D.props.signposts.list) { put('cyl6', 'metal', cmp(x, 1.5, z, 0, 0.14, 3.0, 0.14), 0x2d4a3a); put('sph0', 'metal', cmp(x, 3.1, z, 0, 0.25, 0.25, 0.25), 0xd9a441); const land = W.landOf(x, z); const pc = hex((D.lands.find(l => l.id === land) || D.lands[0]).palette.primary); for (let i = 0; i < (n || 2); i++) put('box', 'ride', cmp(x, 2.5 - i * 0.45, z, i * 1.7 + x, 1.2, 0.3, 0.06), pc); }
  for (const [x, y, z] of D.props.drinking_fountains.list) { put('cyl8', 'solid', cmp(x, 0.45, z, 0, 0.5, 0.9, 0.5), 0x9a948a); put('cyl8', 'metal', cmp(x, 0.95, z, 0, 0.6, 0.1, 0.6), 0xb0b8c0); }
  for (const f of D.props.fences) {
    const hh = f.height; const c = f.style && f.style.includes('white') ? 0xffffff : f.style && f.style.includes('timber') ? 0x7b5e3b : 0x2a2a2a;
    for (let i = 0; i < f.points.length - 1; i++) { const a = f.points[i], b = f.points[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / 2.0));
      put('box', 'metal', beamM([a[0], hh, a[1]], [b[0], hh, b[1]], 0.06), c); put('box', 'metal', beamM([a[0], 0.12, a[1]], [b[0], 0.12, b[1]], 0.05), c);
      if (f.style && f.style.includes('mesh')) put('box', 'metal', beamM([a[0], hh / 2, a[1]], [b[0], hh / 2, b[1]], 0.02, hh * 0.9), 0x3a3a3a, { shadow: false });
      else put('box', 'metal', beamM([a[0], hh * 0.55, a[1]], [b[0], hh * 0.55, b[1]], 0.04), c);
      for (let k = 0; k <= n; k++) { const u = k / n; put('box', 'metal', cmp(a[0] + (b[0] - a[0]) * u, hh / 2, a[1] + (b[1] - a[1]) * u, 0, 0.07, hh, 0.07), c); } }
  }
  // bunting: pennants along sag lines
  for (const b of D.props.bunting.list) {
    const n = Math.max(4, Math.round(Math.hypot(b.b[0] - b.a[0], b.b[2] - b.a[2]) / ((b.pennant || 0.3) * 2.2)));
    const pts = globalThis.ParkPlan.sagLine(b.a, b.b, b.sag, n); const cols = b.colors.map(hex);
    for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i], p1 = pts[i + 1]; put('box', 'metal', beamM(p0, p1, 0.02), 0xeeeeee, { shadow: false });
      const yaw = Math.atan2(p1[2] - p0[2], p1[0] - p0[0]); put('tri', 'fabric', cmp((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, -yaw, 0.5, 0.55, 1), cols[i % cols.length], { shadow: false }); }
  }
  // string lights: bulbs on sag lines (registered per land)
  for (const sl of D.props.string_lights.list) {
    const L = Math.hypot(sl.b[0] - sl.a[0], sl.b[2] - sl.a[2]); const n = Math.max(3, Math.round(L / (sl.bulb_spacing || 0.8)));
    const pts = globalThis.ParkPlan.sagLine(sl.a, sl.b, sl.sag, n); const land = W.landOf((sl.a[0] + sl.b[0]) / 2, (sl.a[2] + sl.b[2]) / 2);
    for (let i = 0; i < pts.length - 1; i++) put('box', 'metal', beamM(pts[i], pts[i + 1], 0.02), 0x333333, { shadow: false });
    pts.forEach((p, i) => { addBulb(land, p[0], p[1] - 0.12, p[2], i % 5 === 0 ? 0xffe0a0 : hex(sl.color || '#FFC76B'), 0.17, 'string'); });
    for (let i = 0; i < pts.length; i += 6) addPool(land, pts[i][0], pts[i][2], 4, 0xffc070, 0.5);
  }
  // fountains (static water jets as glossy columns + bowl)
  for (const w of D.water) {
    if (w.kind === 'fountain' || w.kind === 'fountain_moat') {
      const pts = w.circle ? [[w.circle[0], w.circle[1], w.circle[2]]] : w.circles ? w.circles : w.annulus ? null : [];
      if (pts) for (const [cx, cz, r] of pts) { put('cyl20', 'solid', cmp(cx, 0.35, cz, 0, r * 2 + 0.6, 0.7, r * 2 + 0.6), 0xd9c9a8); put('cyl12', 'solid', cmp(cx, 1.2, cz, 0, 0.5, 1.8, 0.5), 0xd9c9a8); put('cyl12', 'solid', cmp(cx, 2.1, cz, 0, 2.2, 0.3, 2.2), 0xd9c9a8);
        put('cone12', 'water', cmp(cx, 3.0, cz, 0, 0.5, 2.0, 0.5), 0xcfefff, { shadow: false }); addBulb(W.landOf(cx, cz), cx, 0.8, cz, 0x9fe3ff, 0.3); }
      if (w.annulus) { const [cx, cz, r0, r1] = w.annulus; const jets = w.jets || 24; for (let k = 0; k < (typeof jets === 'number' ? jets : 24); k++) { const a = k / 24 * 6.283; const rr = (r0 + r1) / 2; put('cone8', 'water', cmp(cx + Math.cos(a) * rr, 1.3, cz + Math.sin(a) * rr, 0, 0.3, 2.0, 0.3), 0xdff6ff, { shadow: false }); addBulb('hub', cx + Math.cos(a) * rr, 0.5, cz + Math.sin(a) * rr, 0x9fe3ff, 0.25); }
        put('cyl20', 'solid', cmp(cx, 0.25, cz, 0, r1 * 2 + 0.8, 0.5, r1 * 2 + 0.8), 0xd9c9a8); }
    }
  }
  W.flush();

  // ================================================================ STATIC BULBS + LIGHT POOLS (per land meshes)
  W.staticBulbs = [];
  const bulbGeo = new THREE.IcosahedronGeometry(0.5, 1);
  for (const [land, list] of Object.entries(W.bulbList)) {
    const im = new THREE.InstancedMesh(bulbGeo, W.mat('bulb:' + land), list.length); const c = new THREE.Color(); const m4 = new THREE.Matrix4();
    list.forEach((b, k) => { im.setMatrixAt(k, m4.makeScale(b.s, b.s, b.s).setPosition(b.x, b.y, b.z)); im.setColorAt(k, c.set(b.c)); });
    im.computeBoundingSphere(); im.userData.land = land; im.userData.list = list; G('bulbs').add(im); W.staticBulbs.push(im);
  }
  // light pools: additive radial quads just above ground, opacity driven per land
  const poolTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); return t; })();
  W.poolMeshes = [];
  const byLand = {}; for (const p of W.pools) (byLand[p.land] = byLand[p.land] || []).push(p);
  for (const [land, list] of Object.entries(byLand)) {
    const m = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m, list.length); const c = new THREE.Color(); const m4 = new THREE.Matrix4();
    list.forEach((p, k) => { im.setMatrixAt(k, m4.makeScale(p.r * 2, 1, p.r * 2).setPosition(p.x, Math.max(0.06, park.heightAt(p.x, p.z) + 0.06), p.z)); im.setColorAt(k, c.set(p.color).multiplyScalar(p.k)); });
    im.computeBoundingSphere(); im.userData.land = land; im.renderOrder = 2; G('pools').add(im); W.poolMeshes.push(im);
  }
}
