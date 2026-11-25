/* greybox.js: builds the whole film park as simple three.js meshes from park.json.
 *
 *   import { buildGreybox, CATEGORY_COLORS } from './greybox.js';
 *   const gb = buildGreybox(THREE, park, { material: (category, info) => myMaterial, detail: 1 });
 *   scene.add(gb.root);
 *   gb.update(t, shot);           // animate trains, flat rides, guests, boats for film time t
 *   gb.groups.trees / gb.groups.guests / ...   // THREE.Group per layer, toggle or restyle
 *
 * THREE is passed in (works with r160 and r170, ESM or UMD). `park` is a ParkPlan.Park (park.js).
 * Every mesh gets userData.category (see CATEGORY_COLORS keys) so a renderer can swap materials later:
 *   gb.root.traverse(o => { if (o.isMesh) o.material = myMat(o.userData.category, o.userData.info) })
 * Instanced meshes use per-instance colours (instanceColor); give replacement materials color white
 * to keep them. Geometry is in world metres, y up, z south.
 */
export const CATEGORY_COLORS = {
  terrain: 0x7fae5a, berm: 0x6f9e50, water: 0x4b8fbf, paving: 0xcccccc, kerb: 0x9a948a, flowerbed: 0xe74c3c, shrub: 0x4f7f3a,
  building: 0xe8dcc8, roof: 0x6b5b53, booth: 0xd7263d, ride: 0xd0d0d0, ride_accent: 0xe23b2e, glass: 0x9fd3e8,
  track_rail: 0xe23b2e, track_spine: 0xe23b2e, track_tie: 0x888888, support: 0xf4ebd9, footer: 0xb8b2a6, wood_structure: 0xd9b98c,
  trough: 0xddeff2, channel: 0x8c7a63, ballast: 0x8d8a85, sleeper: 0x6b4a2e, rail: 0x555555, train: 0xf2f2f2,
  queue_rail: 0x3a3a3a, canopy: 0xf3e6cc, tree_trunk: 0x6b4a2e, tree_crown: 0x4f7f3a, lamp: 0x2d4a3a, bench: 0x8e5b3a,
  bin: 0x2d4a3a, umbrella: 0xd7263d, cart: 0xf4b942, flag: 0xc8463a, fence: 0x444444, bunting: 0xc8463a, string_light: 0xffc76b,
  signpost: 0x2d4a3a, guest: 0xffffff, car: 0xffffff, parking: 0x55585c, backstage: 0x9a9fa5, rock: 0x9b8b78,
};

export function buildGreybox(THREE, park, opts = {}) {
  const D = park.data;
  const detail = opts.detail || 1;
  const matCache = {};
  const mat = (category, info = {}) => {
    if (opts.material) { const m = opts.material(category, info); if (m) return m; }
    const key = category + '|' + (info.color || '') + '|' + (info.instanced ? 1 : 0) + '|' + (info.vertexColors ? 1 : 0);
    if (!matCache[key]) {
      const base = category.split(':')[0];
      const col = info.instanced || info.vertexColors ? 0xffffff : (info.color != null ? info.color : (CATEGORY_COLORS[base] ?? 0xcccccc));
      matCache[key] = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, metalness: 0.0, flatShading: !!info.flat,
        vertexColors: !!info.vertexColors, side: info.doubleSide ? THREE.DoubleSide : THREE.FrontSide, transparent: !!info.transparent, opacity: info.opacity ?? 1 });
    }
    return matCache[key];
  };
  const C = c => new THREE.Color(c);
  const root = new THREE.Group(); root.name = 'park';
  const groups = {};
  const G = name => { if (!groups[name]) { groups[name] = new THREE.Group(); groups[name].name = name; root.add(groups[name]); } return groups[name]; };
  const tag = (o, category, info) => { o.userData.category = category; o.userData.info = info || {}; return o; };
  const animators = [];
  const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const shapeFrom = (outer, holes) => {
    const sh = new THREE.Shape(outer.map(p => new THREE.Vector2(p[0], -p[1])));
    for (const h of holes || []) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], -p[1]))));
    return sh;
  };
  const flatGeo = (polys, y) => {
    const shapes = polys.map(p => shapeFrom(p.outer, p.holes));
    const g = new THREE.ShapeGeometry(shapes, 2); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
  };
  // instanced helper: list of {m: Matrix4, c: color}
  const inst = (geo, category, items, group, info = {}) => {
    if (!items.length) return null;
    const m = new THREE.InstancedMesh(geo, mat(category, Object.assign({ instanced: true }, info)), items.length);
    const col = new THREE.Color();
    items.forEach((it, i) => { m.setMatrixAt(i, it.m); col.set(it.c != null ? it.c : (CATEGORY_COLORS[category.split(':')[0]] ?? 0xcccccc)); m.setColorAt(i, col); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = true; m.receiveShadow = true;
    tag(m, category, info); group.add(m); return m;
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const compose = (x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) => { E.set(rx, ry, rz); Q.setFromEuler(E); return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), Q.clone(), new THREE.Vector3(sx, sy, sz)); };
  // box from a to b (thickness w,h) as matrix for unit box
  const beam = (a, b, w, h) => {
    const va = V3(a), vb = V3(b); const d = vb.clone().sub(va); const L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(w, L, h ?? w));
  };
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const unitCylLo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  const unitCone = new THREE.ConeGeometry(0.5, 1, 10);
  const unitSphere = new THREE.IcosahedronGeometry(0.5, 1);
  const hex = s => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);

  // ================================================================ TERRAIN
  {
    const g = park.grid; const step = Math.max(1, Math.round(2 / detail));
    const nx = Math.floor((g.nx - 1) / step) + 1, nz = Math.floor((g.nz - 1) / step) + 1;
    const geo = new THREE.PlaneGeometry((nx - 1) * step * g.cell, (nz - 1) * step * g.cell, nx - 1, nz - 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(g.x0 + (nx - 1) * step * g.cell / 2, 0, g.z0 + (nz - 1) * step * g.cell / 2);
    const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
    const grass = C(0x7fae5a), berm = C(0x6f9e50), bed = C(0x8f7d5e);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); const h = park.heightAt(x, z); pos.setY(i, h - 0.02);
      const c = h < -0.3 ? bed : (h > 0.6 ? berm.clone().lerp(grass, 0.2) : grass);
      cols[3 * i] = c.r; cols[3 * i + 1] = c.g; cols[3 * i + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat('terrain', { vertexColors: true })); m.receiveShadow = true; G('terrain').add(tag(m, 'terrain'));
  }
  // ================================================================ WATER
  for (const w of D.water) {
    let geo = null;
    if (w.kind === 'island') { const g2 = flatGeo([{ outer: w.polygon, holes: [] }], 0.25); G('water').add(tag(new THREE.Mesh(g2, mat('terrain', { color: 0x86b85e })), 'terrain', { id: w.id })); continue; }
    if (w.polygon) geo = flatGeo([{ outer: w.polygon, holes: [] }], w.level);
    else if (w.circle) { geo = new THREE.CircleGeometry(w.circle[2], 32); geo.rotateX(-Math.PI / 2); geo.translate(w.circle[0], w.level, w.circle[1]); }
    else if (w.annulus) { geo = new THREE.RingGeometry(w.annulus[2], w.annulus[3], 48); geo.rotateX(-Math.PI / 2); geo.translate(w.annulus[0], w.level, w.annulus[1]); }
    else if (w.circles) { for (const c of w.circles) { const g2 = new THREE.CircleGeometry(c[2], 24); g2.rotateX(-Math.PI / 2); g2.translate(c[0], w.level, c[1]); G('water').add(tag(new THREE.Mesh(g2, mat('water', { transparent: true, opacity: 0.9 })), 'water', { id: w.id })); } continue; }
    if (geo) G('water').add(tag(new THREE.Mesh(geo, mat('water', { transparent: true, opacity: 0.9 })), 'water', { id: w.id, kind: w.kind }));
  }
  // ================================================================ PAVING + KERBS
  for (const [pav, polys] of Object.entries(D.paths.paving_regions)) {
    const col = hex(D.paths.paving_types[pav].color);
    const m = new THREE.Mesh(flatGeo(polys, 0.03), mat('paving:' + pav, { color: col })); m.receiveShadow = true;
    G('paving').add(tag(m, 'paving:' + pav, { paving: pav }));
  }
  { // kerbs as thin vertical strips along outlines
    const verts = [];
    const addRing = ring => { for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; verts.push(a[0], 0, a[1], b[0], 0, b[1], b[0], 0.14, b[1], a[0], 0, a[1], b[0], 0.14, b[1], a[0], 0.14, a[1]); } };
    for (const p of D.paths.kerbs.outlines) { addRing(p.outer); for (const h of p.holes) addRing(h); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.computeVertexNormals();
    G('paving').add(tag(new THREE.Mesh(g, mat('kerb', { doubleSide: true })), 'kerb'));
  }
  // parking lot
  { const pk = D.parking; const m = new THREE.Mesh(flatGeo([{ outer: pk.lot.polygon, holes: [] }], 0.02), mat('parking')); m.receiveShadow = true; G('parking').add(tag(m, 'parking'));
    const items = pk.cars.list.map(([x, z, r, ci]) => ({ m: compose(x, 0.75, z, r, 1.8, 1.45, 4.4), c: hex(pk.car_colors[ci]) }));
    inst(unitBox, 'car', items, G('parking'));
    const bs = D.backstage; const pts = bs.service_road.points; const shp = [];
    inst(unitBox, 'backstage', bs.buildings.map(b => ({ m: compose(b.position[0], b.h / 2, b.position[2], 0, b.w, b.h, b.d), c: 0x9a9fa5 })), G('parking'));
    const cm = new THREE.Mesh(flatGeo([{ outer: bs.compound.polygon, holes: [] }], 0.02), mat('parking', { color: 0x8a8a84 })); G('parking').add(tag(cm, 'parking'));
  }
  // flower beds
  for (const b of D.planting.flower_beds) {
    let geo;
    if (b.kind === 'circle') { geo = new THREE.CircleGeometry(b.circle[2], 24); geo.rotateX(-Math.PI / 2); geo.translate(b.circle[0], 0.12, b.circle[1]); }
    else if (b.kind === 'annulus') { geo = new THREE.RingGeometry(b.annulus[2], b.annulus[3], 48); geo.rotateX(-Math.PI / 2); geo.translate(b.annulus[0], 0.12, b.annulus[1]); }
    else { geo = new THREE.PlaneGeometry(b.w, b.d); geo.rotateX(-Math.PI / 2); geo.translate(b.center[0], 0.12, b.center[1]); }
    G('planting').add(tag(new THREE.Mesh(geo, mat('flowerbed', { color: hex(b.mix[0]) })), 'flowerbed', { id: b.id, mix: b.mix }));
  }

  // ================================================================ BUILDINGS
  const roofGeo = {
    gable: (() => { // ridge along local x, base 1 x 1 at y=0, apex at y=1
      const v = [-0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0];
      const idx = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); const g2 = g.toNonIndexed(); g2.computeVertexNormals(); return g2; })(),
    dome: (() => { const g = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); return g; })(),
    hip: (() => { const g = new THREE.ConeGeometry(0.71, 1, 4); g.rotateY(Math.PI / 4); g.translate(0, 0.5, 0); return g; })(),
  };
  const bItems = [], rItems = { gable: [], dome: [], hip: [], flat: [] };
  const addBuilding = (x, y0, z, rot, w, d, h, wall, roof, roofCol) => {
    bItems.push({ m: compose(x, y0 + h / 2, z, rot, w, h, d), c: hex(wall) });
    const rh = Math.min(w, d) * 0.35;
    if (roof === 'gable') rItems.gable.push({ m: compose(x, y0 + h, z, rot, w, rh, d), c: hex(roofCol) });
    else if (roof === 'gable_front') rItems.gable.push({ m: compose(x, y0 + h, z, rot + Math.PI / 2, d, rh * 1.3, w), c: hex(roofCol) });
    else if (roof === 'dome' || roof === 'corner_turret_dome') rItems.dome.push({ m: compose(x, y0 + h, z, rot, Math.min(w, d) * 0.8, rh * 1.6, Math.min(w, d) * 0.8), c: hex(roofCol) });
    else if (roof === 'hipped' || roof === 'mansard' || roof === 'cone') rItems.hip.push({ m: compose(x, y0 + h, z, rot, w, rh, d), c: hex(roofCol) });
    else rItems.flat.push({ m: compose(x, y0 + h + 0.3, z, rot, w + 0.6, 0.6, d + 0.6), c: hex(roofCol) });
  };
  for (const b of D.buildings) {
    const [x, y0, z] = b.position; const rot = b.rot || 0;
    if (b.items) {
      for (const it of b.items) { const [ix, iy, iz] = it.position; addBuilding(ix, iy, iz, it.rot || 0, it.w, it.d, it.h, it.awning || '#888888', 'flat', it.awning || '#666666'); }
      continue;
    }
    const wall = b.wall || ({ restroom: '#B7A99A', first_aid: '#FFFFFF', bandstand: '#FFFFFF', entrance_arch: '#B5563F', ticket_booth: '#C8463A', railway_station: '#F3E6CC',
      frontier_building: '#A0522D', food_court: '#D7263D', water_tower: '#8B6B4A', lighthouse_folly: '#FFFFFF', boathouse: '#FFFFFF', shop: '#E8C9A0', food_kiosk: '#F3E6CC', guest_services: '#B5563F' }[b.kind] || '#E0D6C4');
    const roofType = b.roof || ({ bandstand: 'dome', ticket_booth: 'dome', entrance_arch: 'flat', lighthouse_folly: 'cone', water_tower: 'cone', food_court: 'hipped', railway_station: 'gable' }[b.kind] || 'gable');
    if (b.kind === 'entrance_arch') {
      for (const sx of [-14, 14]) addBuilding(x + sx, 0, z, rot, 6, 4, 12, '#B5563F', 'dome', '#3E7E6E');
      bItems.push({ m: compose(x, 13, z, rot, 22, 1.2, 1.2), c: 0x2d2d2d });
      continue;
    }
    if (b.kind === 'lighthouse_folly' || b.kind === 'water_tower') {
      bItems.push({ m: compose(x, y0 + b.h * 0.45, z, 0, b.w * 0.7, b.h * 0.9, b.d * 0.7), c: hex(wall) });
      rItems.hip.push({ m: compose(x, y0 + b.h * 0.9, z, 0, b.w, b.h * 0.15, b.d), c: 0xc0392b }); continue;
    }
    if (b.kind === 'turnstiles') continue;
    addBuilding(x, y0, z, rot, b.w, b.d, b.h, wall, roofType, b.kind === 'main_street_shop' ? '#4E5D6C' : '#6B5B53');
    if (b.awning) { // awning strip on the front face
      const fx = Math.sin(rot), fz = Math.cos(rot); bItems.push({ m: compose(x + fx * (b.d / 2 + 1.0), 3.6, z + fz * (b.d / 2 + 1.0), rot, b.w * 0.94, 0.25, 2.0, -0.25), c: hex(b.awning) });
    }
  }
  inst(unitBox, 'building', bItems, G('buildings'));
  inst(roofGeo.gable, 'roof', rItems.gable, G('buildings')); inst(roofGeo.dome, 'roof', rItems.dome, G('buildings'));
  inst(roofGeo.hip, 'roof', rItems.hip, G('buildings')); inst(unitBox, 'roof', rItems.flat, G('buildings'));
  // railway bridge over the gate
  { const rp = D.rides.find(r => r.id === 'railway').params.bridge;
    inst(unitBox, 'building', [{ m: compose(0, 5.0, 160, 0, 22, 1.0, 8), c: 0x4e5d6c }, { m: compose(-11.5, 2.5, 160, 0, 3, 5, 16), c: 0xb5563f }, { m: compose(11.5, 2.5, 160, 0, 3, 5, 16), c: 0xb5563f }], G('buildings')); }

  // ================================================================ TRACKS
  const sweep = (tr, offsets, radius, sides, step, category, info, group, s0 = 0, s1 = null) => {
    // offsets: [left, up] in track frame; tube along the track
    s1 = s1 ?? tr.length; const n = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
    const pos = [], idx = [];
    for (let i = 0; i < n; i++) {
      const s = Math.min(s0 + i * step, s1); const f = tr.sample(s); const left = THREE ? [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]] : null;
      const c = [f.pos[0] + left[0] * offsets[0] + f.up[0] * offsets[1], f.pos[1] + left[1] * offsets[0] + f.up[1] * offsets[1], f.pos[2] + left[2] * offsets[0] + f.up[2] * offsets[1]];
      for (let k = 0; k < sides; k++) {
        const a = k / sides * Math.PI * 2; const ca = Math.cos(a) * radius, sa = Math.sin(a) * radius;
        pos.push(c[0] + left[0] * ca + f.up[0] * sa, c[1] + left[1] * ca + f.up[1] * sa, c[2] + left[2] * ca + f.up[2] * sa);
      }
      if (i > 0) for (let k = 0; k < sides; k++) { const a = (i - 1) * sides + k, b = (i - 1) * sides + (k + 1) % sides, c2 = i * sides + k, d2 = i * sides + (k + 1) % sides; idx.push(a, c2, b, b, c2, d2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(category, info)); m.castShadow = true; m.receiveShadow = true; group.add(tag(m, category, info)); return m;
  };
  const ribbon = (tr, width, yOff, step, category, info, group, wallH = 0) => {
    const n = Math.ceil(tr.length / step) + 1; const pos = [], idx = [];
    for (let i = 0; i < n; i++) {
      const f = tr.sample(i * step); const left = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
      const pts = wallH ? [[-width / 2, wallH], [-width / 2, 0], [width / 2, 0], [width / 2, wallH]] : [[-width / 2, 0], [width / 2, 0]];
      for (const [l, u] of pts) pos.push(f.pos[0] + left[0] * l + f.up[0] * (u + yOff), f.pos[1] + left[1] * l + f.up[1] * (u + yOff), f.pos[2] + left[2] * l + f.up[2] * (u + yOff));
      const k = pts.length; if (i > 0) for (let j = 0; j < k - 1; j++) { const a = (i - 1) * k + j, b = a + 1, c = i * k + j, d = c + 1; idx.push(a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(category, Object.assign({ doubleSide: true }, info))); m.receiveShadow = true; m.castShadow = true; group.add(tag(m, category, info)); return m;
  };
  const trainGroups = {};
  for (const r of D.rides) {
    if (!r.track) continue;
    const tr = park.track(r.track); const grp = G('track:' + r.id); const p = r.params; const cols = p.colors || {};
    const step = 1.0 / detail;
    if (r.type === 'steel_looping_coaster' || r.type === 'family_coaster') {
      const g2 = p.gauge / 2; const rc = hex(cols.track || '#E23B2E');
      sweep(tr, [g2, 0], (p.rail_diameter || 0.2) / 2, 6, step, 'track_rail:' + r.id, { color: rc }, grp);
      sweep(tr, [-g2, 0], (p.rail_diameter || 0.2) / 2, 6, step, 'track_rail:' + r.id, { color: rc }, grp);
      sweep(tr, [0, -0.55], (p.spine_diameter || 0.45) / 2, 8, step, 'track_spine:' + r.id, { color: rc }, grp);
      const ties = []; for (let s = 0; s < tr.length; s += (p.tie_spacing || 1.2) * 1.5) ties.push({ m: new THREE.Matrix4().fromArray(tr.matrix(s, [0, -0.3, 0])).multiply(new THREE.Matrix4().makeScale(p.gauge + 0.2, 0.12, 0.15)), c: 0x777777 });
      inst(unitBox, 'track_tie', ties, grp);
      const sup = [], foot = [];
      for (const sp of tr.supports) {
        sup.push({ m: beam(sp.base, sp.top, sp.diameter), c: hex(cols.supports || '#F4EBD9') });
        foot.push({ m: compose(sp.base[0], sp.base[1] + 0.15, sp.base[2], 0, 1.6, 0.3, 1.6), c: 0xb8b2a6 });
      }
      inst(unitCylLo, 'support:' + r.id, sup, grp); inst(unitBox, 'footer', foot, grp);
    } else if (r.type === 'wooden_out_and_back_coaster') {
      ribbon(tr, 2.4, -0.3, step, 'track_rail:' + r.id, { color: 0x6b4a2e }, grp, 0.3);
      const legs = [], braces = [];
      for (const b of tr.bents) {
        const [x, y, z] = b.top; const [ax, az] = b.axis; const tw = b.top_width / 2, bw = b.base_width / 2;
        for (const sgn of [-1, 1]) {
          legs.push({ m: beam([x + ax * bw * sgn, b.ground, z + az * bw * sgn], [x + ax * tw * sgn, y, z + az * tw * sgn], 0.3), c: hex(cols.structure || '#D9B98C') });
        }
        const nl = Math.max(1, Math.floor(b.height / 3));
        for (let k = 1; k <= nl; k++) {
          const yy = b.ground + (b.height) * k / (nl + 1); const ww = bw + (tw - bw) * k / (nl + 1);
          braces.push({ m: beam([x - ax * ww, yy, z - az * ww], [x + ax * ww, yy, z + az * ww], 0.18), c: hex(cols.structure || '#D9B98C') });
        }
      }
      inst(unitBox, 'wood_structure', legs, grp); inst(unitBox, 'wood_structure', braces, grp);
    } else if (r.type === 'log_flume') {
      ribbon(tr, p.trough_width || 1.6, -0.6, step, 'trough', { color: 0xddeff2 }, grp, 0.9);
      ribbon(tr, (p.trough_width || 1.6) - 0.2, -0.05, step * 2, 'water', { color: 0x5aa9d6 }, grp);
      inst(unitBox, 'support:' + r.id, tr.supports.map(sp => ({ m: beam(sp.base, sp.top, 0.35), c: 0x8b6b4a })), grp);
    } else if (r.type === 'river_rapids') {
      ribbon(tr, (p.channel_width || 7), -1.2, step * 2, 'channel', { color: 0x8c7a63 }, grp, 1.6);
      ribbon(tr, (p.channel_width || 7) - 0.4, 0, step * 2, 'water', { color: 0x4b8fbf }, grp);
    } else if (r.type === 'perimeter_railway') {
      ribbon(tr, 3.0, -0.35, 2, 'ballast', { color: 0x8d8a85 }, grp);
      sweep(tr, [0.46, 0], 0.06, 4, 2, 'rail', { color: 0x555555 }, grp); sweep(tr, [-0.46, 0], 0.06, 4, 2, 'rail', { color: 0x555555 }, grp);
    }
    // trains / boats
    const tp = p.train || p.boats || p.rafts; if (!tp) continue;
    const nTr = (D.animation[r.id] || {}).trains || (D.animation[r.id] || {}).boats || tp.count || 1;
    const nCars = tp.cars || 1; const carL = tp.car_length || tp.length || tp.diameter || 3; const carW = tp.car_width || tp.width || tp.diameter || 1.6;
    const items = []; for (let k = 0; k < nTr * nCars; k++) items.push({ m: new THREE.Matrix4(), c: hex((tp.colors || ['#ffffff'])[k % (tp.colors || [1]).length] || tp.color || '#ffffff') });
    const geo = r.type === 'river_rapids' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 14) : unitBox;
    const im = inst(geo, 'train:' + r.id, items, G('trains'));
    trainGroups[r.id] = { im, nTr, nCars, carL, carW, gap: tp.car_gap || 0, height: r.type === 'river_rapids' ? 0.9 : 1.3, tr };
  }
  animators.push((t, shot) => {
    const m4 = new THREE.Matrix4();
    for (const [rid, g] of Object.entries(trainGroups)) {
      const fronts = park.trainFronts(rid, t, shot);
      let k = 0;
      for (let ti = 0; ti < g.nTr; ti++) {
        for (let c = 0; c < g.nCars; c++) {
          const s = fronts[ti] - g.carL / 2 - c * (g.carL + g.gap);
          m4.fromArray(g.tr.matrix(s, [0, g.height / 2 + 0.25, 0])).multiply(new THREE.Matrix4().makeScale(g.carW, g.height, g.carL));
          g.im.setMatrixAt(k++, m4);
        }
      }
      g.im.instanceMatrix.needsUpdate = true;
    }
  });
  // station roofs & queue pens
  for (const r of D.rides) {
    if (r.station) { const s = r.station; inst(unitBox, 'building', [{ m: compose(s.center[0], s.h - 0.4, s.center[1], s.rot || 0, s.w, 0.6, s.d), c: 0x2c3e50 },
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ m: compose(s.center[0] + a * (s.w / 2 - 0.5), s.h / 2, s.center[1] + b * (s.d / 2 - 0.5), 0, 0.4, s.h, 0.4), c: 0xdddddd }))], G('rides')); }
  }
  {
    const rails = [], canopies = [];
    for (const q of D.queues) {
      for (const [a, b] of q.rails) rails.push({ m: beam([a[0], 1.0, a[1]], [b[0], 1.0, b[1]], 0.06), c: 0x3a3a3a });
      for (const c of q.canopies) canopies.push({ m: compose(c.center[0], c.height, c.center[1], c.rot, c.w, 0.1, c.d), c: 0xf3e6cc });
    }
    inst(unitBox, 'queue_rail', rails, G('queues')); inst(unitBox, 'canopy', canopies, G('queues'));
  }

  // ================================================================ FLAT RIDES
  const rideGroup = G('rides');
  for (const r of D.rides) {
    const p = r.params || {}; if (!r.position) continue; const [x, y0, z] = r.position; const rot = r.rot || 0;
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = rot; tag(g, 'ride:' + r.type, { id: r.id }); rideGroup.add(g);
    const add = (geo, cat, color, px, py, pz, sx, sy, sz, parent = g, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat(cat, { color })); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; parent.add(tag(m, cat, { id: r.id })); return m; };
    switch (r.type) {
      case 'ferris_wheel': {
        const R0 = p.diameter / 2, hub = p.hub_height; const wheel = new THREE.Group(); wheel.position.set(0, hub, 0); g.add(wheel);
        for (const zz of [-p.rim_spacing / 2, p.rim_spacing / 2]) { const tor = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.25, 6, 64), mat('ride', { color: 0xffffff })); tor.position.z = zz; wheel.add(tag(tor, 'ride', { id: r.id })); }
        for (let k = 0; k < p.spokes; k++) { const a = k / p.spokes * Math.PI * 2; add(unitBox, 'ride', 0xffffff, Math.cos(a) * R0 / 2, Math.sin(a) * R0 / 2, 0, R0, 0.15, 0.15, wheel, 0, 0, a); }
        add(unitCyl, 'ride', 0xdddddd, 0, 0, 0, 2, p.rim_spacing + 1, 2, wheel, Math.PI / 2);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = new THREE.Mesh(unitBox, mat('ride', { color: 0xffffff })); leg.applyMatrix4(beam([sx * 13, 0, sz * 5], [0, hub, sz * (p.rim_spacing / 2 + 0.5)], 0.7)); g.add(tag(leg, 'ride', { id: r.id })); }
        const gondolas = []; const gcols = p.colors.gondolas;
        for (let k = 0; k < p.gondolas; k++) gondolas.push(add(unitBox, 'ride_accent', hex(gcols[k % gcols.length]), 0, 0, 0, 2, 2.2, 2.2));
        animators.push(t => { const a = park.flatRide(r.id, t).angle; wheel.rotation.z = a; gondolas.forEach((gd, k) => { const b = a + k / p.gondolas * Math.PI * 2; gd.position.set(Math.cos(b) * R0, hub + Math.sin(b) * R0 - 1.6, 0); }); });
        break;
      }
      case 'carousel': {
        add(unitCyl, 'ride', 0xb08a5a, 0, 0.5, 0, p.radius * 2, 1, p.radius * 2);
        const top = new THREE.Group(); g.add(top);
        add(unitCone, 'ride_accent', hex(p.colors.canopy[0]), 0, p.height - 1.5, 0, p.radius * 2.2, 3, p.radius * 2.2, top);
        add(unitCyl, 'ride', hex(p.colors.trim), 0, p.height - 3.4, 0, p.radius * 2.15, 0.9, p.radius * 2.15, top);
        add(unitCyl, 'ride', 0xf4b942, 0, p.height / 2, 0, 2.6, p.height - 2, 2.6, top);
        const horses = [];
        for (let row = 0; row < p.rows; row++) for (let k = 0; k < p.figures / p.rows; k++) { const a = (k + row * 0.5) / (p.figures / p.rows) * Math.PI * 2; const rr = p.radius - 1.2 - row * 1.7; horses.push(add(unitBox, 'ride_accent', hex(p.colors.horses[(k + row) % 4]), Math.cos(a) * rr, 2, Math.sin(a) * rr, 0.5, 1.2, 1.6, top, 0, -a)); }
        animators.push(t => { const s = park.flatRide(r.id, t); top.rotation.y = s.angle; horses.forEach((h, k) => h.position.y = 2 + s.bob(k)); });
        break;
      }
      case 'teacups': {
        add(unitCyl, 'ride', 0xe6cfa8, 0, 0.3, 0, p.platform_radius * 2, 0.6, p.platform_radius * 2);
        const main = new THREE.Group(); g.add(main); const subs = [];
        for (let k = 0; k < p.turntables; k++) { const sub = new THREE.Group(); const a = k / p.turntables * Math.PI * 2; sub.position.set(Math.cos(a) * 5, 0.6, Math.sin(a) * 5); main.add(sub); subs.push(sub);
          for (let c = 0; c < p.cups_per_turntable; c++) { const b = c / p.cups_per_turntable * Math.PI * 2; add(new THREE.CylinderGeometry(0.6, 0.42, 1, 12), 'ride_accent', hex(p.colors.cups[(c + k) % 6]), Math.cos(b) * 2.2, 0.6, Math.sin(b) * 2.2, p.cup_radius * 2, 1.2, p.cup_radius * 2, sub); } }
        animators.push(t => { const s = park.flatRide(r.id, t); main.rotation.y = s.main; subs.forEach(sb => sb.rotation.y = s.sub); });
        break;
      }
      case 'swing_ride': {
        add(unitCyl, 'ride', 0xffffff, 0, p.mast_height / 2, 0, 1.2, p.mast_height, 1.2);
        const top = new THREE.Group(); top.position.y = p.mast_height; g.add(top);
        add(unitCone, 'ride_accent', 0x2e86c1, 0, 1, 0, p.canopy_radius * 2, 2.5, p.canopy_radius * 2, top);
        const chairs = []; for (let k = 0; k < p.chairs; k++) chairs.push(add(unitBox, 'ride_accent', 0xe74c3c, 0, 0, 0, 0.6, 0.6, 0.6, top));
        animators.push(t => { const s = park.flatRide(r.id, t); top.rotation.y = s.angle; const ang = s.chairAngleDeg * Math.PI / 180;
          chairs.forEach((c, k) => { const a = k / p.chairs * Math.PI * 2; const rr = p.canopy_radius - 0.5 + Math.sin(ang) * p.chain_length; c.position.set(Math.cos(a) * rr, -Math.cos(ang) * p.chain_length, Math.sin(a) * rr); }); });
        break;
      }
      case 'pirate_ship': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = new THREE.Mesh(unitBox, mat('ride', { color: 0xc0392b })); leg.applyMatrix4(beam([sx * 7, 0, sz * 4], [0, p.pivot_height, sz * 2], 0.6)); g.add(tag(leg, 'ride', { id: r.id })); }
        const piv = new THREE.Group(); piv.position.y = p.pivot_height; g.add(piv);
        add(unitBox, 'ride_accent', 0x8e5b3a, 0, -p.pivot_height + 3.5, 0, p.boat_length, 3, 4, piv);
        add(unitBox, 'ride', 0xffffff, 0, -p.pivot_height / 2 + 1, 0, 0.4, p.pivot_height - 4, 0.4, piv);
        animators.push(t => { piv.rotation.z = park.flatRide(r.id, t).swingDeg * Math.PI / 180; });
        break;
      }
      case 'drop_tower': {
        add(unitCyl, 'ride', 0x1f2a44, 0, p.height / 2, 0, p.mast_radius * 2, p.height, p.mast_radius * 2);
        add(unitCone, 'ride_accent', 0xe23b2e, 0, p.height + 2, 0, 4, 4, 4);
        const ring = add(new THREE.TorusGeometry(1, 0.25, 6, 24), 'ride_accent', 0xf5b700, 0, 3, 0, p.ring_radius, p.ring_radius, 4, g, Math.PI / 2);
        animators.push(t => { ring.position.y = park.flatRide(r.id, t).y; });
        break;
      }
      case 'observation_tower': {
        add(unitCyl, 'ride', 0xffffff, 0, p.height / 2, 0, p.mast_radius * 2, p.height, p.mast_radius * 2);
        add(unitCone, 'ride_accent', 0xe2b33c, 0, p.height + 4, 0, 3, 8, 3);
        const cab = add(new THREE.CylinderGeometry(1, 1, 1, 24), 'glass', 0x9fd3e8, 0, 4, 0, p.cabin_radius, p.cabin_height, p.cabin_radius);
        animators.push(t => { const s = park.flatRide(r.id, t); cab.position.y = s.y; cab.rotation.y = s.angle; });
        break;
      }
      case 'bumper_car_pavilion': add(unitBox, 'ride', 0x2e294e, 0, p.h, 0, p.w, 0.8, p.d); add(unitBox, 'ride', 0x999999, 0, 0.15, 0, p.w, 0.3, p.d);
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(unitBox, 'ride', 0xf4b942, a * (p.w / 2 - 0.5), p.h / 2, b * (p.d / 2 - 0.5), 0.6, p.h, 0.6); break;
      case 'dark_ride_show_building': add(unitBox, 'building', 0x6e7f5e, 0, p.h / 2, 0, p.w, p.h, p.d); add(unitBox, 'building', 0x9b8b78, 0, p.h * 0.6, p.d / 2 + 1, p.w + 2, p.h * 1.2, 2); break;
      case 'kiddie_planes': case 'kiddie_boats': case 'kiddie_trucks': case 'kiddie_drop_tower': case 'playground': {
        const rr = p.radius || p.pool_radius || 5; add(unitCyl, 'ride', hex((p.colors || ['#F4A7B9'])[0]), 0, 0.3, 0, rr * 2, 0.6, rr * 2);
        if (p.height) add(unitCyl, 'ride_accent', 0xc3a6e0, 0, p.height / 2, 0, 1, p.height, 1);
        if (r.type === 'kiddie_planes') { const hub = new THREE.Group(); hub.position.y = 2.5; g.add(hub); for (let k = 0; k < p.arms; k++) { const a = k / p.arms * Math.PI * 2; add(unitBox, 'ride_accent', hex(p.colors[k % 4]), Math.cos(a) * p.radius, 0, Math.sin(a) * p.radius, 1.6, 0.6, 1.0, hub); } animators.push(t => { hub.rotation.y = t * Math.PI * 2 / p.period_s; }); }
        break;
      }
    }
  }
  // lake boats
  { const lb = D.rides.find(r => r.id === 'lake_boats'); const boats = lb.params.boats;
    const items = boats.map(b => ({ m: new THREE.Matrix4(), c: hex(b.color) })); const im = inst(unitBox, 'ride:boat', items, G('rides'));
    animators.push(t => { boats.forEach((b, k) => { const a = b.phase + Math.PI * 2 * t / b.period_s; const x = b.route_center[0] + Math.cos(a) * b.route_radii[0], z = b.route_center[1] + Math.sin(a) * b.route_radii[1];
      const L = b.length || 2.6; im.setMatrixAt(k, compose(x, -0.2, z, Math.atan2(-Math.sin(a) * b.route_radii[0], Math.cos(a) * b.route_radii[1]), L * 0.5, 1.2, L)); }); im.instanceMatrix.needsUpdate = true; }); }

  // ================================================================ TREES
  {
    const T = D.planting.trees.list; const sp = D.planting.species;
    const shapeOf = id => ({ pine: 'cone', fir: 'cone', cypress: 'column', palm: 'palm', banana: 'palm', willow: 'weep' }[id] || 'round');
    const trunks = [], crowns = { round: [], cone: [], column: [], palm: [], weep: [] };
    for (const [x, gy, z, si, h, cr, cv] of T) {
      const s = sp[si]; const shp = shapeOf(s.id); const col = hex(s.colors[cv]);
      const th = shp === 'cone' ? h * 0.35 : shp === 'palm' ? h * 0.9 : h * 0.45;
      trunks.push({ m: compose(x, gy + th / 2, z, 0, Math.max(0.25, h * 0.04), th, Math.max(0.25, h * 0.04)), c: 0x6b4a2e });
      if (shp === 'cone') crowns.cone.push({ m: compose(x, gy + h * 0.25 + h * 0.375, z, 0, cr * 2, h * 0.75, cr * 2), c: col });
      else if (shp === 'column') crowns.column.push({ m: compose(x, gy + h * 0.55, z, 0, cr * 2.2, h * 0.9, cr * 2.2), c: col });
      else if (shp === 'palm') crowns.palm.push({ m: compose(x, gy + h * 0.92, z, 0, cr * 2.4, h * 0.18, cr * 2.4), c: col });
      else crowns.round.push({ m: compose(x, gy + h * 0.62, z, cv, cr * 2, h * 0.62, cr * 2), c: col });
    }
    inst(unitCylLo, 'tree_trunk', trunks, G('trees'));
    inst(unitSphere, 'tree_crown', crowns.round, G('trees'), { flat: true }); inst(unitCone, 'tree_crown', crowns.cone, G('trees'), { flat: true });
    inst(unitSphere, 'tree_crown', crowns.column, G('trees'), { flat: true }); inst(new THREE.ConeGeometry(0.5, 1, 9).rotateX(Math.PI), 'tree_crown', crowns.palm, G('trees'), { flat: true });
  }
  // ================================================================ PROPS
  {
    const pr = D.props; const grp = G('props');
    inst(unitCylLo, 'lamp', pr.lamps.list.map(([x, y, z, st]) => ({ m: compose(x, 2.1, z, 0, 0.18, 4.2, 0.18), c: 0x2d4a3a })), grp);
    inst(unitSphere, 'lamp', pr.lamps.list.map(([x, y, z]) => ({ m: compose(x, 4.3, z, 0, 0.6, 0.6, 0.6), c: 0xfff2c8 })), grp);
    inst(unitBox, 'bench', pr.benches.list.map(([x, y, z, r]) => ({ m: compose(x, 0.45, z, r, 1.8, 0.9, 0.65), c: 0x8e5b3a })), grp);
    inst(unitCylLo, 'bin', pr.bins.list.map(([x, y, z]) => ({ m: compose(x, 0.5, z, 0, 0.6, 1.0, 0.6), c: 0x2d4a3a })), grp);
    inst(unitCyl, 'planter', pr.planters.list.map(([x, y, z, s, d]) => ({ m: compose(x, 0.5, z, 0, d, 1.0, d), c: 0x2d4a3a })), grp);
    inst(unitCone, 'umbrella', pr.umbrella_tables.list.map(([x, y, z, d, c]) => ({ m: compose(x, 2.4, z, 0, d, 0.7, d), c: hex(c) })), grp);
    inst(unitCylLo, 'umbrella', pr.umbrella_tables.list.map(([x, y, z]) => ({ m: compose(x, 0.375, z, 0, 0.9, 0.75, 0.9), c: 0xffffff })), grp);
    inst(unitBox, 'cart', pr.carts.list.map(([x, y, z, tp, r]) => ({ m: compose(x, 1.2, z, r, 2.6, 2.4, 1.3), c: 0xf4b942 })), grp);
    inst(unitCylLo, 'flag', pr.flagpoles.list.map(([x, y, z, h]) => ({ m: compose(x, y + h / 2, z, 0, 0.12, h, 0.12), c: 0xeeeeee })), grp);
    inst(unitBox, 'flag', pr.flagpoles.list.map(([x, y, z, h, c]) => ({ m: compose(x + 0.8, y + h - 0.6, z, 0, 1.5, 1.0, 0.05), c: hex(c) })), grp);
    inst(unitCylLo, 'signpost', pr.signposts.list.map(([x, y, z]) => ({ m: compose(x, 1.5, z, 0, 0.15, 3.0, 0.15), c: 0x2d4a3a })), grp);
    const fence = [];
    for (const f of pr.fences) for (let i = 0; i < f.points.length - 1; i++) { const a = f.points[i], b = f.points[i + 1]; fence.push({ m: beam([a[0], f.height / 2, a[1]], [b[0], f.height / 2, b[1]], 0.08, f.height), c: 0x444444 }); }
    inst(unitBox, 'fence', fence, grp);
    // bunting & string lights as line segments
    const lines = (list, category, color) => { const v = []; for (const b of list) { const pts = (globalThis.ParkPlan || {}).sagLine ? globalThis.ParkPlan.sagLine(b.a, b.b, b.sag, 10) : [b.a, b.b]; for (let i = 0; i < pts.length - 1; i++) v.push(...pts[i], ...pts[i + 1]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color })); grp.add(tag(l, category)); };
    lines(pr.bunting.list, 'bunting', 0xc8463a); lines(pr.string_lights.list, 'string_light', 0xffc76b);
    // topiary & hedges
    inst(unitSphere, 'shrub', D.planting.topiary.map(t => ({ m: compose(t.position[0], t.height / 2, t.position[2], 0, 1.6, t.height, 1.6), c: 0x2e6b3a })), G('planting'));
    const hedge = []; for (const h of D.planting.hedges) for (let i = 0; i < h.points.length - 1; i++) { const a = h.points[i], b = h.points[i + 1]; hedge.push({ m: beam([a[0], h.height / 2, a[1]], [b[0], h.height / 2, b[1]], 0.8, h.height), c: 0x3f6e33 }); }
    inst(unitBox, 'shrub', hedge, G('planting'));
  }
  // ================================================================ GUESTS
  {
    const pal = D.guests.clothes_palette; const grp = G('guests');
    const geo = new THREE.CylinderGeometry(0.22, 0.26, 1, 6); geo.translate(0, 0.5, 0);
    const W = D.guests.walkers.list;
    const walkItems = W.map(w => ({ m: new THREE.Matrix4(), c: hex(pal[w[5]]) }));
    const im = inst(geo, 'guest', walkItems, grp);
    const idl = D.guests.idlers.list.map(([x, z, h, ci, ch]) => ({ m: compose(x, 0, z, h, 1, ch ? 1.15 : 1.7, 1), c: hex(pal[ci]) }));
    inst(geo, 'guest', idl, grp);
    const q = D.guests.queued.list.map(([qid, x, z, j, ci, ch]) => ({ m: compose(x, 0, z, j, 1, ch ? 1.15 : 1.7, 1), c: hex(pal[ci]) }));
    inst(geo, 'guest', q, grp);
    animators.push(t => { const g = park.guestsAt(t).walkers; const m4 = new THREE.Matrix4();
      for (let k = 0; k < W.length; k++) { const bob = Math.abs(Math.sin(t * 6.5 + k)) * 0.05; im.setMatrixAt(k, compose(g[5 * k], bob, g[5 * k + 1], g[5 * k + 2], 1, g[5 * k + 4] ? 1.15 : 1.7, 1)); }
      im.instanceMatrix.needsUpdate = true; });
  }
  const update = (t, shot = null) => { for (const a of animators) a(t, shot); };
  update(0);
  return { root, groups, update, materials: matCache };
}
