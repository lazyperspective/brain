import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P, toXD, rng, clamp, smooth, lerp, clockFn, vnoise, Polyline, sweep, circleProfile, faceColors, hash1 } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- layout
export const LAYOUT = {
  coaster: [0, -17],
  wheel: [31, -34],
  drop: [-33, -31],
  lake: [-31, 11],
  hub: [0, 9],
  swing: [24, 7],
  ship: [36, -1],
  cups: [-12, 28],
  gate: [4, 45],
};

// path graph in screen coords [X,D]
const NODES = {
  G: [4, 50], E: [4, 41], S: [0, 19], W: [-10, 9], N: [0, -1], Ee: [10, 9],
  w1: [-19, 3], w2: [-22, -6], w3: [-31, -16], w4: [-34, -24],
  b1: [-10, -7], b2: [12, -6], b3: [26, -14], b4: [30, -24], b5: [34, -27],
  e1: [17, 14], e2: [31, 14], e3: [29, 3],
  l1: [-8, 37], l2: [-21, 31], l3: [-22, 21],
  r1: [17, 36], r2: [30, 27],
};
const EDGES = [
  ['G', 'E', 3.6], ['E', 'S', 3.4],
  ['S', 'W', 3.0, 'arc'], ['W', 'N', 3.0, 'arc'], ['N', 'Ee', 3.0, 'arc'], ['Ee', 'S', 3.0, 'arc'],
  ['W', 'w1', 2.8], ['w1', 'w2', 2.8], ['w2', 'w3', 2.6], ['w3', 'w4', 2.6],
  ['N', 'b1', 2.8], ['b1', 'w2', 2.8], ['N', 'b2', 2.8], ['b2', 'b3', 2.8], ['b3', 'b4', 2.6], ['b4', 'b5', 2.6],
  ['Ee', 'e1', 2.8], ['e1', 'e2', 2.8], ['e2', 'e3', 2.6], ['e3', 'b3', 2.6],
  ['E', 'l1', 2.8], ['l1', 'l2', 2.6], ['l2', 'l3', 2.6], ['l3', 'w1', 2.6],
  ['E', 'r1', 2.8], ['r1', 'r2', 2.6], ['r2', 'e2', 2.6],
];

export function buildPaths() {
  const nodes = {}; for (const k in NODES) nodes[k] = P(NODES[k][0], NODES[k][1]);
  const hub = P(...LAYOUT.hub);
  const edges = EDGES.map(([a, b, w, kind]) => {
    let pts;
    if (kind === 'arc') {
      const A = nodes[a].clone().sub(hub), B = nodes[b].clone().sub(hub);
      const a0 = Math.atan2(A.z, A.x); let a1 = Math.atan2(B.z, B.x);
      let da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      pts = []; for (let i = 0; i <= 8; i++) { const an = a0 + da * i / 8; pts.push(V(hub.x + Math.cos(an) * 10, 0, hub.z + Math.sin(an) * 10)); }
    } else {
      // gentle curve: quadratic bend
      const A = nodes[a], B = nodes[b]; const mid = A.clone().lerp(B, 0.5);
      const perp = V(-(B.z - A.z), 0, B.x - A.x).normalize().multiplyScalar((hash1(A.x + B.z) - 0.5) * 2.0);
      mid.add(perp);
      const c = new THREE.QuadraticBezierCurve3(A, mid, B); pts = c.getPoints(8);
    }
    return { a, b, w, line: new Polyline(pts) };
  });
  // dijkstra from G
  const dist = {}; for (const k in nodes) dist[k] = Infinity; dist.G = 0;
  const left = new Set(Object.keys(nodes));
  while (left.size) {
    let best = null; for (const k of left) if (best === null || dist[k] < dist[best]) best = k;
    left.delete(best);
    for (const e of edges) {
      if (e.a === best && dist[best] + e.line.length < dist[e.b]) dist[e.b] = dist[best] + e.line.length;
      if (e.b === best && dist[best] + e.line.length < dist[e.a]) dist[e.a] = dist[best] + e.line.length;
    }
  }
  return { nodes, edges, dist, hub };
}

// distance along network from the gate to the nearest network point of pos
export function netDistance(paths, pos) {
  let best = Infinity; const q = V();
  for (const e of paths.edges) {
    const L = e.line;
    for (let i = 0; i <= 16; i++) {
      const s = L.length * i / 16; L.at(s, q);
      const gap = Math.hypot(q.x - pos.x, q.z - pos.z);
      const d = Math.min(paths.dist[e.a] + s, paths.dist[e.b] + L.length - s) + gap * 1.3;
      if (d < best) best = d;
    }
  }
  return best;
}

// ---------------------------------------------------------------- shared geometry
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  sph: new THREE.SphereGeometry(1, 8, 6),
};

function mesh(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
// cylinder between two points
function strut(a, b, r, mat, parent, geo = G.cyl6) {
  const m = new THREE.Mesh(geo, mat); const d = b.clone().sub(a); const L = d.length();
  m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(r, L, r);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function stripedCone(r, h, seg, cA, cB, open = false) {
  const g = new THREE.ConeGeometry(r, h, seg, 1, open);
  const A = new THREE.Color(cA), B = new THREE.Color(cB);
  return faceColors(g, (f, c) => { const a = Math.atan2(c.z, c.x); const k = Math.floor(((a / TAU) + 1) * seg + 0.5) % 2; return k ? A : B; });
}
function stripedCyl(r1, r2, h, seg, cA, cB) {
  const g = new THREE.CylinderGeometry(r1, r2, h, seg, 1, true);
  const A = new THREE.Color(cA), B = new THREE.Color(cB);
  return faceColors(g, (f, c) => { const a = Math.atan2(c.z, c.x); const k = Math.floor(((a / TAU) + 1) * seg + 0.5) % 2; return k ? A : B; });
}

// ---------------------------------------------------------------- ground
export function buildGround(ctx, paths) {
  const { root } = ctx;
  const size = 320, seg = 110;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); const [X, D] = toXD(V(x, 0, z));
    const edge = Math.max(Math.abs(X) / 54, (D > 0 ? D / 60 : -D / 52));
    const hill = smooth(1.0, 1.5, edge) * (vnoise(x * 0.05, z * 0.05) * 9 + vnoise(x * 0.13, z * 0.13) * 3);
    pos.setY(i, hill + (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.25 * smooth(0.9, 1.1, edge) - 0.02);
  }
  const lake = P(...LAYOUT.lake);
  const grass = faceColors(g, (f, c) => {
    const n = vnoise(c.x * 0.08 + 3, c.z * 0.08) * 0.6 + hash1(f) * 0.4;
    const col = new THREE.Color().setHSL(0.255 + n * 0.06, 0.52 + n * 0.12, 0.43 + n * 0.08 + c.y * 0.008);
    return col;
  });
  const gm = ctx.groundMat(grass);
  const ground = new THREE.Mesh(grass, gm); ground.receiveShadow = true; ground.userData.ground = true; ground.userData.noBPEdges = true;
  root.add(ground);

  // paths ribbons
  const geos = [];
  for (const e of paths.edges) {
    const pts = e.line.pts; const hw = e.w / 2; const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const d = b.clone().sub(a).normalize(); const n = V(-d.z, 0, d.x);
      L.push(pts[i].clone().addScaledVector(n, hw)); R.push(pts[i].clone().addScaledVector(n, -hw));
    }
    const p = [];
    for (let i = 0; i < pts.length - 1; i++) {
      p.push(L[i].x, 0.05, L[i].z, R[i].x, 0.05, R[i].z, L[i + 1].x, 0.05, L[i + 1].z);
      p.push(R[i].x, 0.05, R[i].z, R[i + 1].x, 0.05, R[i + 1].z, L[i + 1].x, 0.05, L[i + 1].z);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); gg.computeVertexNormals();
    geos.push(gg);
    for (const k of [e.a, e.b]) {
      const c = new THREE.CircleGeometry(hw, 12).rotateX(-Math.PI / 2).toNonIndexed();
      c.deleteAttribute('uv'); c.translate(paths.nodes[k].x, 0.05, paths.nodes[k].z); geos.push(c);
    }
  }
  // plazas
  const plaza = (X, D, r) => { const c = new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2).toNonIndexed(); c.deleteAttribute('uv'); const p = P(X, D); c.translate(p.x, 0.055, p.z); geos.push(c); };
  plaza(...LAYOUT.hub, 12.5); plaza(4, 42, 6.5); plaza(-12, 28, 7.5); plaza(24, 7, 7); plaza(...LAYOUT.ship, 6); plaza(-14, -11, 5.5);
  for (const gg of geos) if (gg.attributes.uv) gg.deleteAttribute('uv');
  const pg = mergeGeometries(geos.map(x => { if (x.attributes.normal) x.deleteAttribute('normal'); return x; }));
  pg.computeVertexNormals();
  const pathMesh = new THREE.Mesh(pg, ctx.pathMat()); pathMesh.receiveShadow = true; pathMesh.userData.path = true;
  root.add(pathMesh);

  // lake
  const shape = new THREE.Shape(); const lr = [];
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; const r = 10.5 + Math.sin(a * 3 + 1) * 1.6 + Math.cos(a * 2) * 1.2; lr.push([Math.cos(a) * r, Math.sin(a) * r]); }
  lr.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  const sand = new THREE.Mesh(new THREE.ShapeGeometry(shape).scale(1.15, 1.15, 1).rotateX(-Math.PI / 2), ctx.mat(0xe9d6a6));
  sand.position.set(lake.x, 0.04, lake.z); sand.receiveShadow = true; root.add(sand);
  const wg = new THREE.ShapeGeometry(shape, 3).rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(wg, ctx.waterMat()); water.position.set(lake.x, 0.09, lake.z); water.receiveShadow = true; water.userData.water = true;
  root.add(water);
  return { ground, pathMesh, water };
}

// ---------------------------------------------------------------- coaster
function coasterControlPoints() {
  const pts = []; const add = (u, y, w) => pts.push([u, y, w]);
  // back straight: lift hill and first drop (heading +u)
  add(-24, 2.0, -12); add(-20, 3.6, -12); add(-15, 8.2, -12); add(-9, 15, -12); add(-4, 21.6, -12); add(-0.6, 24.6, -12);
  add(2.4, 24.9, -12); add(5.4, 22.2, -12); add(8.4, 14, -12); add(11.4, 6.2, -12); add(14.6, 2.4, -12); add(18.5, 2.0, -12); add(23, 2.6, -12);
  // right turn
  const ys = [3.8, 5.8, 7.2, 6.8, 5.2];
  [-60, -30, 0, 30, 60].forEach((a, i) => { const r = a * Math.PI / 180; add(24 + 9 * Math.cos(r), ys[i], -3 + 9 * Math.sin(r)); });
  add(23.5, 3.8, 6); add(19, 2.3, 6); add(15, 1.6, 6);
  // vertical loop heading -u
  const uc = 10.5, R = 7.2, N = 28;
  for (let i = 0; i <= N; i++) {
    const th = i / N * TAU; const r = R * (1 - 0.22 * Math.sin(th / 2) ** 2);
    const f = i / N; const ss = f * f * (3 - 2 * f);
    add(uc - r * Math.sin(th), 1.6 + R - r * Math.cos(th), 6 + 2.6 * ss);
  }
  add(4.5, 1.6, 8.6); add(0.5, 3.2, 8.6); add(-3.5, 6.2, 8.6); add(-7.5, 3.4, 8.6); add(-11, 1.7, 8.6);
  add(-15, 1.6, 8.6); add(-20, 1.6, 8.6); add(-24.5, 1.6, 8.6); add(-28, 1.7, 8.6);
  [30, 60, 90, 120, 150].forEach((b) => { const r = b * Math.PI / 180; add(-28 - 10.3 * Math.sin(r), 1.8, -1.7 + 10.3 * Math.cos(r)); });
  add(-28, 1.9, -12);
  return pts;
}

export function buildCoaster(ctx, paths) {
  const { root } = ctx;
  const grp = new THREE.Group(); root.add(grp);
  const [cX, cD] = LAYOUT.coaster;
  const ou = P(1, 0).normalize(), ow = P(0, 1).normalize(), org = P(cX, cD);
  const toW = (u, y, w) => org.clone().addScaledVector(ou, u).addScaledVector(ow, w).setY(y);
  const cps = coasterControlPoints().map(p => toW(...p));
  const curve = new THREE.CatmullRomCurve3(cps, true, 'centripetal');
  const M = 2400;
  const Pp = [], T = [], Nn = [], B = [];
  for (let i = 0; i < M; i++) { Pp.push(curve.getPointAt(i / M)); T.push(curve.getTangentAt(i / M).normalize()); }
  const L = curve.getLength(); const ds = L / M;
  // parallel transport
  let n = V(0, 1, 0); n.addScaledVector(T[0], -n.dot(T[0])).normalize();
  const rawN = [n.clone()];
  for (let i = 1; i <= M; i++) {
    const q = new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i % M]);
    n = n.clone().applyQuaternion(q); n.addScaledVector(T[i % M], -n.dot(T[i % M])).normalize(); rawN.push(n);
  }
  // closure twist
  const nEnd = rawN[M], n0 = rawN[0];
  let tw = Math.acos(clamp(nEnd.dot(n0), -1, 1)); if (V().crossVectors(nEnd, n0).dot(T[0]) < 0) tw = -tw;
  // horizontal curvature for banking
  const bank = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    const a = T[(i - 6 + M) % M], b = T[(i + 6) % M];
    const ha = Math.atan2(a.z, a.x), hb = Math.atan2(b.z, b.x); let d = hb - ha; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    const horiz = Math.min(Math.hypot(a.x, a.z), Math.hypot(b.x, b.z));
    bank[i] = clamp(-d / (12 * ds) * 5.0, -0.75, 0.75) * smooth(0.7, 0.95, horiz);
  }
  const bankS = new Float32Array(M);
  for (let i = 0; i < M; i++) { let s = 0; for (let k = -60; k <= 60; k++) s += bank[(i + k + M) % M]; bankS[i] = s / 121; }
  for (let i = 0; i < M; i++) {
    const nn = rawN[i].clone().applyAxisAngle(T[i], tw * i / M);
    const up = nn.y;
    nn.applyAxisAngle(T[i], bankS[i] * smooth(0.6, 0.95, up));
    Nn.push(nn); B.push(V().crossVectors(T[i], nn).normalize());
  }
  const frameAt = (s) => { s = ((s % L) + L) % L; const f = s / ds; const i = Math.floor(f) % M; const j = (i + 1) % M; const k = f - Math.floor(f);
    return { p: Pp[i].clone().lerp(Pp[j], k), t: T[i].clone().lerp(T[j], k).normalize(), n: Nn[i].clone().lerp(Nn[j], k).normalize() }; };
  const nearestS = (u, y, w) => { const q = toW(u, y, w); let bi = 0, bd = Infinity; for (let i = 0; i < M; i++) { const d = Pp[i].distanceToSquared(q); if (d < bd) { bd = d; bi = i; } } return bi * ds; };

  // ---- track geometry
  const railCol = ctx.neon ? 0x1a1d2e : 0xef4b5f, spineCol = ctx.neon ? 0x15182a : 0xf6a33b, supCol = ctx.neon ? 0x121522 : 0xf4efe6;
  const sub = (arr, step) => arr.filter((_, i) => i % step === 0);
  const PS = sub(Pp, 3), NS = sub(Nn, 3), BS = sub(B, 3);
  const railL = sweep(PS, NS, BS, circleProfile(0.13, 5, 0.55, 0.12), true);
  const railR = sweep(PS, NS, BS, circleProfile(0.13, 5, -0.55, 0.12), true);
  const spine = sweep(PS, NS, BS, [[-0.2, -0.25], [0.2, -0.25], [0.2, -0.62], [-0.2, -0.62]], true);
  const rails = mergeGeometries([railL, railR]);
  const rm = mesh(rails, ctx.mat(railCol, { rough: 0.45 }), grp); rm.userData.bpCoarse = true;
  const sm = mesh(spine, ctx.mat(spineCol), grp); sm.userData.bpCoarse = true;
  // ties
  const tieN = Math.floor(M / 8);
  const ties = new THREE.InstancedMesh(G.box, ctx.mat(spineCol), tieN);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V();
  for (let k = 0; k < tieN; k++) {
    const i = k * 8; const basis = new THREE.Matrix4().makeBasis(T[i], Nn[i], B[i]); q.setFromRotationMatrix(basis);
    m4.compose(Pp[i].clone().addScaledVector(Nn[i], -0.05), q, sc.set(0.22, 0.3, 1.25)); ties.setMatrixAt(k, m4);
  }
  ties.castShadow = true; ties.receiveShadow = true; grp.add(ties);
  // supports
  const supMat = ctx.mat(supCol);
  const supPos = [];
  for (let i = 0; i < M; i += 40) {
    const p = Pp[i], nn = Nn[i];
    if (nn.y < 0.3 || Math.abs(T[i].y) > 0.9 || p.y < 1.2) continue;
    const top = p.clone().addScaledVector(nn, -0.6);
    if (p.y > 9) {
      const bh = V(B[i].x, 0, B[i].z).normalize().multiplyScalar(0.6 + p.y * 0.07);
      strut(top, V(top.x + bh.x, 0, top.z + bh.z), 0.2, supMat, grp);
      strut(top, V(top.x - bh.x, 0, top.z - bh.z), 0.2, supMat, grp);
      for (let h = 5; h < p.y - 2; h += 5) { const f = 1 - h / top.y; strut(V(top.x + bh.x * f, h, top.z + bh.z * f), V(top.x - bh.x * f, h, top.z - bh.z * f), 0.1, supMat, grp); }
    } else strut(top, V(top.x, 0, top.z), 0.24, supMat, grp);
    mesh(G.cyl8, supMat, grp, top.x, 0.15, top.z, 0.6, 0.3, 0.6);
    supPos.push(top);
  }
  // loop legs
  const sLoopTop = nearestS(10.5, 15, 7.3);
  for (const du of [-6.5, 6.5]) {
    const s = nearestS(10.5 + du, 7, 7.3); const f = frameAt(s); const a = f.p.clone().addScaledVector(f.n, -0.6);
    strut(a, V(a.x + ow.x * 0.0, 0, a.z), 0.22, supMat, grp);
  }
  // station
  const st0 = toW(-22, 0, 8.6), st1 = toW(-12, 0, 8.6);
  const stc = st0.clone().lerp(st1, 0.5);
  const station = new THREE.Group(); station.position.copy(stc); station.quaternion.setFromUnitVectors(V(1, 0, 0), ou); grp.add(station);
  mesh(G.box, ctx.mat(ctx.neon ? 0x222433 : 0xe8dcc6), station, 0, 0.55, 2.0, 11, 1.1, 2.4);
  mesh(G.box, ctx.mat(ctx.neon ? 0x222433 : 0xe8dcc6), station, 0, 0.55, -2.0, 11, 1.1, 1.6);
  for (const x of [-5, -1.7, 1.7, 5]) for (const z of [-2.6, 2.9]) mesh(G.cyl6, ctx.mat(ctx.neon ? 0x1b1d2a : 0xffffff), station, x, 2.6, z, 0.12, 4.2, 0.12);
  const roofG = new THREE.BoxGeometry(11.6, 0.4, 6.6, 12, 1, 1);
  const roof = faceColors(roofG, (f, c) => new THREE.Color(Math.floor((c.x + 5.8) / 0.967) % 2 ? (ctx.neon ? 0x2a1a2a : 0xffffff) : (ctx.neon ? 0x301822 : 0x37b3c9)));
  mesh(roof, ctx.vmat(), station, 0, 4.8, 0.15);
  // lift chain (decor)
  if (ctx.neon) {
    const ign = ctx.igniter(ctx.act(stc), 0.6);
    ctx.tube(station, new THREE.LineCurve3(V(-5.8, 5.05, 3.45), V(5.8, 5.05, 3.45)), 0xff3d9a, 0.08, ign);
    ctx.tube(station, new THREE.LineCurve3(V(-5.8, 5.05, -3.15), V(5.8, 5.05, -3.15)), 0x27e3ff, 0.08, ign);
    ctx.lamp(stc.clone().setY(4.2), 0xff5fb0, 26, 18, ign);
  }

  // ---- motion: energy-based speed table starting at crest
  const sCrest = nearestS(1.0, 25, -12), sLift0 = nearestS(-20, 3.6, -12), sBrake0 = nearestS(-9, 2.5, 8.6);
  const yC = frameAt(sCrest).p.y; const g = 13, vLift = 5.5;
  const rel = (s) => ((s - sCrest) % L + L) % L;
  const relLift0 = rel(sLift0), relBrake0 = rel(sBrake0);
  const speed = (s) => {
    const r = rel(s);
    const y = frameAt(s).p.y;
    let v = Math.sqrt(vLift * vLift + 2 * g * Math.max(0, yC - y));
    if (r > relLift0 || r < 0.5) v = vLift;
    else if (r > relBrake0) v = lerp(v, 7, smooth(relBrake0, relBrake0 + 8, r));
    return v;
  };
  const table = [0]; const dt = 1 / 240; let s = sCrest;
  for (let k = 1; k < 240 * 30; k++) { s += speed(s) * dt; table.push(s - sCrest); }
  const sOfTime = (tt) => { const f = tt / dt; const i = clamp(Math.floor(f), 0, table.length - 2); return sCrest + lerp(table[i], table[i + 1], f - i); };
  const timeOfRel = (r) => { for (let i = 0; i < table.length; i++) if (table[i] >= r) return i * dt; return 0; };
  const tTop = timeOfRel(rel(sLoopTop));

  // ---- trains
  const trains = [];
  const mkTrain = (colA, colB, offset, startSel) => {
    const tg = new THREE.Group(); grp.add(tg); const cars = [];
    for (let c = 0; c < 5; c++) {
      const car = new THREE.Group(); tg.add(car); car.userData.noBP = true; car.scale.setScalar(1.2);
      mesh(G.box, ctx.mat(c % 2 ? colB : colA, { rough: 0.35 }), car, 0, 0.32, 0, 1.75, 0.5, 1.15);
      mesh(G.box, ctx.mat(c % 2 ? colB : colA, { rough: 0.35 }), car, -0.62, 0.72, 0, 0.3, 0.5, 1.05);
      if (c === 0) mesh(G.box, ctx.mat(colB), car, 0.95, 0.3, 0, 0.35, 0.4, 0.95).rotation.z = 0.5;
      for (const z of [-0.28, 0.28]) {
        mesh(G.box, ctx.mat([0xff7aa2, 0x58c4ff, 0xffd35a, 0x8ee07a][(c * 2 + (z > 0)) % 4]), car, -0.05, 0.75, z, 0.36, 0.45, 0.4);
        mesh(G.ico, ctx.mat(0xf2c7a0), car, -0.05, 1.12, z, 0.17, 0.17, 0.17);
        if ((c + (z > 0)) % 2 === 0) { const arm = mesh(G.box, ctx.mat(0xf2c7a0), car, 0.05, 1.3, z + (z > 0 ? 0.15 : -0.15), 0.08, 0.55, 0.08); arm.rotation.x = z > 0 ? -0.35 : 0.35; }
      }
      if (ctx.neon) {
        const ign = ctx.igniter(0, 0.1); ign.owner = 'train';
        ctx.tube(car, new THREE.LineCurve3(V(-0.88, 0.58, 0.6), V(0.88, 0.58, 0.6)), colA, 0.08, ign);
        ctx.tube(car, new THREE.LineCurve3(V(-0.88, 0.58, -0.6), V(0.88, 0.58, -0.6)), colA, 0.08, ign);
        ctx.tube(car, new THREE.LineCurve3(V(0.88, 0.1, -0.6), V(0.88, 0.1, 0.6)), 0xffffff, 0.06, ign);
        ctx.bulbs(car, [V(0, -0.05, 0.62), V(0, -0.05, -0.62), V(-0.6, -0.05, 0.62), V(-0.6, -0.05, -0.62)], colB, ign, { size: 0.12, steady: true });
        if (c === 0) ctx.bulbs(car, [V(1.1, 0.45, 0.3), V(1.1, 0.45, -0.3)], 0xfff2d0, ign, { size: 0.16, steady: true });
        car.userData.ign = ign;
      }
      cars.push(car);
    }
    trains.push({ tg, cars, offset });
  };
  mkTrain(ctx.neon ? 0xffd35a : 0xffc93c, ctx.neon ? 0xff7a3d : 0xff8a3d, 0.0);
  mkTrain(ctx.neon ? 0x27e3ff : 0x3d8bff, ctx.neon ? 0x9b5cff : 0x52d6e6, tTop - 1.25);
  const tAct = ctx.coasterStart ?? ctx.act(toW(0, 0, 0));
  const clk = clockFn(tAct, 0.45);
  const basis = new THREE.Matrix4();
  ctx.anim((t) => {
    const tau = clk(t);
    for (const tr of trains) {
      const s0 = sOfTime(tau + tr.offset);
      tr.cars.forEach((car, ci) => {
        const f = frameAt(s0 - ci * 2.4);
        const bb = V().crossVectors(f.t, f.n).normalize();
        basis.makeBasis(f.t, f.n, bb); car.quaternion.setFromRotationMatrix(basis);
        car.position.copy(f.p).addScaledVector(f.n, 0.12);
        if (car.userData.ign) car.userData.ign.t0 = ctx.trainOn ?? 0;
      });
    }
  });
  return { curve, L, frameAt, Pp, Nn, B, T, M, ds, sCrest, rel, grp, toW, supPos, stc };
}

// ---------------------------------------------------------------- Ferris wheel
export function buildWheel(ctx) {
  const [X, D] = LAYOUT.wheel; const base = P(X, D);
  const grp = new THREE.Group(); grp.position.copy(base); grp.rotation.y = 0.32; ctx.root.add(grp);
  const H = 14.5, R = 11.5, NG = 16;
  const white = ctx.mat(ctx.neon ? 0x1c1f30 : 0xfbf7f0), steel = ctx.mat(ctx.neon ? 0x161826 : 0xdde6ef);
  for (const z of [-2.2, 2.2]) {
    strut(V(-6, 0, z * 1.6), V(0, H, z * 0.55), 0.3, white, grp);
    strut(V(6, 0, z * 1.6), V(0, H, z * 0.55), 0.3, white, grp);
    strut(V(-3.5, 6, z * 1.2), V(3.5, 6, z * 1.2), 0.15, white, grp);
  }
  mesh(G.box, ctx.mat(ctx.neon ? 0x1f2233 : 0xe7d7bd), grp, 0, 0.5, 0, 9, 1, 7);
  strut(V(0, H, -1.6), V(0, H, 1.6), 0.45, steel, grp, G.cyl8);
  const wheel = new THREE.Group(); wheel.position.set(0, H, 0); grp.add(wheel);
  const rimG = new THREE.TorusGeometry(R, 0.22, 4, 40);
  for (const z of [-0.9, 0.9]) { const m = mesh(rimG, white, wheel, 0, 0, z); m.userData.bpCoarse = true; }
  const innerG = new THREE.TorusGeometry(R * 0.55, 0.15, 4, 28);
  for (const z of [-0.9, 0.9]) mesh(innerG, white, wheel, 0, 0, z);
  for (let i = 0; i < NG; i++) {
    const a = i / NG * TAU;
    for (const z of [-0.9, 0.9]) strut(V(0, 0, z * 0.4), V(Math.cos(a) * R, Math.sin(a) * R, z), 0.07, steel, wheel);
    strut(V(Math.cos(a) * R, Math.sin(a) * R, -0.9), V(Math.cos(a) * R, Math.sin(a) * R, 0.9), 0.08, steel, wheel);
  }
  const cols = [0xff6f91, 0x55c6f2, 0xffd166, 0x8fe388, 0xc39bff, 0xff9f5a];
  const gondolas = [];
  for (let i = 0; i < NG; i++) {
    const a = i / NG * TAU; const piv = new THREE.Group(); piv.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); wheel.add(piv);
    const gnd = new THREE.Group(); piv.add(gnd);
    const c = ctx.mat(ctx.neon ? 0x23263a : cols[i % cols.length]);
    mesh(G.box, c, gnd, 0, -1.25, 0, 1.4, 1.2, 1.3);
    mesh(G.cone8, ctx.mat(ctx.neon ? 0x1a1c2b : 0xffffff), gnd, 0, -0.35, 0, 1.05, 0.6, 1.05);
    strut(V(0, 0, 0), V(0, -0.5, 0), 0.05, steel, gnd);
    gondolas.push(gnd);
  }
  let ign = null;
  if (ctx.neon) {
    ign = ctx.igniter(ctx.act(base), 0.7);
    const rimPts = [], spokePts = [];
    for (const z of [-1.0, 1.0]) for (let i = 0; i < 96; i++) { const a = i / 96 * TAU; rimPts.push(V(Math.cos(a) * (R + 0.05), Math.sin(a) * (R + 0.05), z)); }
    for (let i = 0; i < NG; i++) { const a = i / NG * TAU; for (let k = 1; k <= 7; k++) { const r = R * k / 8; spokePts.push(V(Math.cos(a) * r, Math.sin(a) * r, 1.0)); } }
    const pal = [0xff3d9a, 0xffb347, 0x27e3ff, 0xb070ff];
    ctx.bulbs(wheel, rimPts, (i) => pal[Math.floor((i % 96) / 6) % 4], ign, { size: 0.2, chase: 4, chaseSpeed: 0.7, order: (i) => (i % 96) / 96 });
    ctx.bulbs(wheel, spokePts, (i) => (Math.floor(i / 7) % 2 ? 0xffe2a8 : 0xff6fc8), ign, { size: 0.15, radial: 7, order: (i) => (i % 7) / 7 });
    ctx.tube(wheel, new THREE.EllipseCurve(0, 0, R * 0.55, R * 0.55).getPoints ? circleCurve(R * 0.55, 1.0) : null, 0x27e3ff, 0.09, ign);
    ctx.tube(wheel, circleCurve(R * 0.55, -1.0), 0x27e3ff, 0.09, ign);
    ctx.tube(wheel, circleCurve(1.4, 1.2), 0xffffff, 0.12, ign);
    for (const g of gondolas) ctx.bulbs(g, [V(0, -0.6, 0.66), V(0, -1.85, 0.66)], 0xffd9a0, ign, { size: 0.13, steady: true });
    for (const z of [-1, 1]) {
      ctx.tube(grp, new THREE.LineCurve3(V(-6, 0.1, z * 3.5), V(0, H, z * 1.2)), 0x9b5cff, 0.08, ign);
      ctx.tube(grp, new THREE.LineCurve3(V(6, 0.1, z * 3.5), V(0, H, z * 1.2)), 0x9b5cff, 0.08, ign);
    }
    ctx.lamp(base.clone().setY(H), 0xff4fa8, 60, 34, ign);
  }
  const clk = clockFn(ctx.act(base) + 0.1, 0.8);
  ctx.anim((t) => {
    const a = clk(t) * 0.32 + 0.1;
    wheel.rotation.z = a;
    for (const g of gondolas) { g.rotation.z = -a - g.parent.rotation.z + Math.sin(t * 2 + g.parent.position.x) * 0.05 * smooth(0, 1, clk(t)); }
  });
  return { grp };
}
function circleCurve(r, z) {
  const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; pts.push(V(Math.cos(a) * r, Math.sin(a) * r, z)); }
  return new THREE.CatmullRomCurve3(pts, true);
}
function ringCurve(r, y, n = 48) {
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(V(Math.cos(a) * r, y, Math.sin(a) * r)); }
  return new THREE.CatmullRomCurve3(pts, true);
}

// ---------------------------------------------------------------- carousel
export function buildCarousel(ctx) {
  const base = P(...LAYOUT.hub); const grp = new THREE.Group(); grp.position.copy(base); ctx.root.add(grp);
  const nn = ctx.neon;
  mesh(G.cyl12, ctx.mat(nn ? 0x1e2030 : 0xf3e3c3), grp, 0, 0.3, 0, 5.6, 0.6, 5.6);
  const rot = new THREE.Group(); grp.add(rot);
  mesh(G.cyl12, ctx.mat(nn ? 0x2a1d2c : 0xd94a64), rot, 0, 0.75, 0, 5.2, 0.3, 5.2);
  mesh(G.cyl8, ctx.mat(nn ? 0x2b2a22 : 0xf2c14e), rot, 0, 2.8, 0, 0.7, 4.5, 0.7);
  mesh(stripedCone(6.2, 2.8, 16, nn ? 0x2c1824 : 0xe8475f, nn ? 0x2a2730 : 0xfff6ea), ctx.vmat(), rot, 0, 6.3, 0);
  mesh(stripedCyl(6.2, 6.2, 0.7, 32, nn ? 0x2c1824 : 0xe8475f, nn ? 0x2a2730 : 0xfff6ea), ctx.vmat(), rot, 0, 4.6, 0);
  mesh(G.ico, ctx.mat(nn ? 0x2b2a22 : 0xf2c14e), rot, 0, 8.0, 0, 0.45, 0.45, 0.45);
  const horses = [];
  const hc = [0xffffff, 0xffd6e0, 0xcfe9ff, 0xfff0b8];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, r = i % 2 ? 4.1 : 2.9;
    const pole = mesh(G.cyl6, ctx.mat(nn ? 0x2b2a22 : 0xf2c14e), rot, Math.cos(a) * r, 2.6, Math.sin(a) * r, 0.06, 3.7, 0.06);
    const h = new THREE.Group(); h.position.set(Math.cos(a) * r, 1.8, Math.sin(a) * r); h.rotation.y = -a; rot.add(h);
    const hm = ctx.mat(nn ? 0x26283a : hc[i % 4]);
    mesh(G.box, hm, h, 0, 0, 0, 0.45, 0.5, 1.3);
    mesh(G.box, hm, h, 0, 0.45, 0.6, 0.3, 0.7, 0.35).rotation.x = -0.4;
    for (const [lx, lz] of [[0.15, 0.45], [-0.15, 0.45], [0.15, -0.45], [-0.15, -0.45]]) mesh(G.box, hm, h, lx, -0.45, lz, 0.1, 0.5, 0.1);
    if (i % 3 !== 1) { mesh(G.box, ctx.mat([0x5bc0eb, 0xfde74c, 0x9bc53d, 0xe55934][i % 4]), h, 0, 0.55, -0.1, 0.35, 0.5, 0.3); mesh(G.ico, ctx.mat(0xf2c7a0), h, 0, 0.95, -0.1, 0.16, 0.16, 0.16); }
    horses.push(h); h.userData.ph = i * 1.3; void pole;
  }
  if (nn) {
    const ign = ctx.igniter(ctx.act(base), 0.6);
    const edge = []; for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; edge.push(V(Math.cos(a) * 6.3, 4.3, Math.sin(a) * 6.3)); edge.push(V(Math.cos(a + 0.05) * 6.3, 4.95, Math.sin(a + 0.05) * 6.3)); }
    const ribs = []; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; for (let j = 1; j < 7; j++) { const f = j / 7; ribs.push(V(Math.cos(a) * 6.2 * (1 - f), 4.95 + 2.8 * f, Math.sin(a) * 6.2 * (1 - f))); } }
    ctx.bulbs(rot, edge, 0xffc46b, ign, { size: 0.16, chase: 8, chaseSpeed: 1.2, order: (i) => i / edge.length });
    ctx.bulbs(rot, ribs, 0xffe0a0, ign, { size: 0.13, order: (i) => (i % 6) / 6, twinkle: true });
    ctx.tube(rot, ringCurve(5.3, 0.95), 0xff3d9a, 0.08, ign);
    ctx.tube(grp, ringCurve(5.7, 0.62), 0xffb347, 0.07, ign);
    ctx.bulbs(rot, [V(0, 8.0, 0)], 0xffffff, ign, { size: 0.5, steady: true });
    ctx.lamp(base.clone().setY(3), 0xffa040, 70, 22, ign);
  }
  const clk = clockFn(ctx.act(base) + 0.1, 0.6);
  ctx.anim((t) => { const tau = clk(t); rot.rotation.y = tau * 0.9; for (const h of horses) h.position.y = 1.9 + Math.sin(tau * 5 + h.userData.ph) * 0.35; });
}

// ---------------------------------------------------------------- drop tower
export function buildDropTower(ctx) {
  const base = P(...LAYOUT.drop); const grp = new THREE.Group(); grp.position.copy(base); ctx.root.add(grp); const nn = ctx.neon;
  const H = 34;
  mesh(G.cyl8, ctx.mat(nn ? 0x1e2030 : 0xe7d7bd), grp, 0, 0.4, 0, 4, 0.8, 4);
  mesh(G.cyl8, ctx.mat(nn ? 0x1b1e2e : 0x6aa9e0), grp, 0, H / 2, 0, 0.9, H, 0.9);
  for (let y = 2; y < H; y += 2) mesh(G.cyl8, ctx.mat(nn ? 0x22253a : 0xffffff), grp, 0, y, 0, 0.95, 0.25, 0.95);
  mesh(G.cyl8, ctx.mat(nn ? 0x24273b : 0xff6b6b), grp, 0, H + 0.8, 0, 1.8, 1.6, 1.8);
  mesh(G.cone8, ctx.mat(nn ? 0x24273b : 0xffd166), grp, 0, H + 2.4, 0, 1.6, 1.6, 1.6);
  const car = new THREE.Group(); grp.add(car);
  mesh(G.cyl12, ctx.mat(nn ? 0x2a2a3b : 0xffd166), car, 0, 0, 0, 2.3, 0.7, 2.3);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU; const x = Math.cos(a) * 2.5, z = Math.sin(a) * 2.5;
    const seat = new THREE.Group(); seat.position.set(x, -0.3, z); seat.rotation.y = -a; car.add(seat);
    mesh(G.box, ctx.mat(nn ? 0x23263a : [0xff6f91, 0x55c6f2][i % 2]), seat, 0, 0, 0, 0.5, 0.9, 0.55);
    mesh(G.ico, ctx.mat(0xf2c7a0), seat, 0.2, 0.25, 0, 0.17, 0.17, 0.17);
    mesh(G.box, ctx.mat(0x3c4a7a), seat, 0.3, -0.6, 0, 0.18, 0.6, 0.35);
  }
  let ign = null;
  if (nn) {
    ign = ctx.igniter(ctx.act(base), 0.8);
    const strip = []; for (let k = 0; k < 4; k++) for (let i = 0; i < 60; i++) { const a = k / 4 * TAU + 0.4; strip.push(V(Math.cos(a) * 0.98, 1 + i * (H - 1) / 60, Math.sin(a) * 0.98)); }
    ctx.bulbs(grp, strip, (i) => (Math.floor(i / 60) % 2 ? 0x27e3ff : 0x9b5cff), ign, { size: 0.15, order: (i) => (i % 60) / 60, chase: 6, chaseSpeed: -1.5 });
    ctx.tube(grp, ringCurve(1.85, H + 1.6, 24), 0xff3d9a, 0.1, ign);
    ctx.tube(grp, ringCurve(1.85, H, 24), 0xff3d9a, 0.1, ign);
    ctx.tube(car, ringCurve(2.35, 0.35, 32), 0xffc46b, 0.1, ign);
    ctx.tube(car, ringCurve(2.35, -0.35, 32), 0xffc46b, 0.1, ign);
    ctx.bulbs(grp, [V(0, H + 3.4, 0)], 0xff2050, ign, { size: 0.35, blink: true });
    ctx.lamp(base.clone().setY(H * 0.4), 0x7a50ff, 50, 28, ign);
  }
  const clk = clockFn(ctx.act(base) + 0.1, 0.3);
  ctx.anim((t) => {
    const tau = clk(t);
    // hold at top, then drop at tau 0.45..1.0, then bounce
    let y;
    if (tau < 0.45) y = H - 3;
    else if (tau < 1.05) { const k = (tau - 0.45) / 0.6; y = lerp(H - 3, 3.2, k * k); }
    else y = 3.2 + Math.abs(Math.sin((tau - 1.05) * 7)) * Math.exp(-(tau - 1.05) * 5) * 1.6;
    car.position.y = y;
  });
}

// ---------------------------------------------------------------- swing ride
export function buildSwing(ctx) {
  const base = P(...LAYOUT.swing); const grp = new THREE.Group(); grp.position.copy(base); ctx.root.add(grp); const nn = ctx.neon;
  mesh(G.cyl12, ctx.mat(nn ? 0x1e2030 : 0xe7d7bd), grp, 0, 0.25, 0, 6.5, 0.5, 6.5);
  mesh(G.cyl8, ctx.mat(nn ? 0x1d2032 : 0x7fd1c7), grp, 0, 5, 0, 0.7, 10, 0.7);
  const top = new THREE.Group(); top.position.y = 10; grp.add(top);
  const tilt = new THREE.Group(); top.add(tilt);
  mesh(stripedCone(4.4, 1.8, 16, nn ? 0x241b30 : 0x7fd1c7, nn ? 0x2a2730 : 0xfff6ea), ctx.vmat(), tilt, 0, 1.0, 0);
  mesh(stripedCyl(4.4, 4.4, 0.6, 32, nn ? 0x241b30 : 0x7fd1c7, nn ? 0x2a2730 : 0xfff6ea), ctx.vmat(), tilt, 0, -0.1, 0);
  mesh(G.ico, ctx.mat(nn ? 0x2b2a22 : 0xf2c14e), tilt, 0, 2.2, 0, 0.4, 0.4, 0.4);
  const chairs = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU, r = i % 2 ? 4.0 : 3.3;
    const arm = new THREE.Group(); arm.position.set(Math.cos(a) * r, -0.3, Math.sin(a) * r); arm.rotation.y = -a; tilt.add(arm);
    const sw = new THREE.Group(); arm.add(sw);
    strut(V(0, 0, -0.15), V(0, -4.2, -0.15), 0.025, ctx.mat(nn ? 0x30344a : 0x8890a0), sw);
    strut(V(0, 0, 0.15), V(0, -4.2, 0.15), 0.025, ctx.mat(nn ? 0x30344a : 0x8890a0), sw);
    mesh(G.box, ctx.mat(nn ? 0x2a2c40 : [0xff6f91, 0xffd166, 0x55c6f2, 0x8fe388][i % 4]), sw, 0, -4.3, 0, 0.45, 0.2, 0.5);
    mesh(G.box, ctx.mat([0xe85d75, 0x5d7ee8, 0x3fb68b, 0xf4a259][i % 4]), sw, 0, -4.0, 0, 0.3, 0.45, 0.35);
    mesh(G.ico, ctx.mat(0xf2c7a0), sw, 0, -3.65, 0, 0.15, 0.15, 0.15);
    chairs.push(sw);
  }
  if (nn) {
    const ign = ctx.igniter(ctx.act(base), 0.6);
    const e = []; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; e.push(V(Math.cos(a) * 4.5, -0.1, Math.sin(a) * 4.5)); }
    ctx.bulbs(tilt, e, (i) => (i % 2 ? 0x3dffb5 : 0xffffff), ign, { size: 0.17, chase: 6, chaseSpeed: 1.5, order: (i) => i / 48 });
    ctx.tube(tilt, ringCurve(4.45, 0.25), 0x3dffb5, 0.08, ign);
    ctx.tube(grp, new THREE.LineCurve3(V(0.75, 0.5, 0), V(0.75, 10, 0)), 0x27e3ff, 0.07, ign);
    ctx.tube(grp, new THREE.LineCurve3(V(-0.75, 0.5, 0), V(-0.75, 10, 0)), 0x27e3ff, 0.07, ign);
    for (const c of chairs) ctx.bulbs(c, [V(0, -4.45, 0)], 0x9bfff0, ign, { size: 0.12, steady: true });
    ctx.lamp(base.clone().setY(8), 0x30ffc0, 45, 20, ign);
  }
  const clk = clockFn(ctx.act(base) + 0.1, 1.0);
  ctx.anim((t) => {
    const tau = clk(t); const w = Math.min(1, (t - ctx.act(base) - 0.1) / 1.0);
    const om = 1.6 * smooth(0, 1, w);
    top.rotation.y = tau * 1.6;
    tilt.rotation.x = Math.sin(tau * 0.9) * 0.08 * om; tilt.rotation.z = Math.cos(tau * 0.9) * 0.08 * om;
    const ang = Math.atan(om * om * 3.8 / 9.8);
    for (const c of chairs) c.rotation.z = ang;
  });
}

// ---------------------------------------------------------------- pirate ship
export function buildShip(ctx) {
  const base = P(...LAYOUT.ship); const grp = new THREE.Group(); grp.position.copy(base); grp.rotation.y = Math.PI / 4 - 0.45; grp.scale.setScalar(0.9); ctx.root.add(grp); const nn = ctx.neon;
  const H = 8;
  const frame = ctx.mat(nn ? 0x1d2032 : 0x8a5a44);
  for (const z of [-1.8, 1.8]) { strut(V(-4.5, 0, z), V(0, H, z * 0.8), 0.25, frame, grp); strut(V(4.5, 0, z), V(0, H, z * 0.8), 0.25, frame, grp); }
  strut(V(0, H, -1.8), V(0, H, 1.8), 0.3, frame, grp);
  mesh(G.box, ctx.mat(nn ? 0x1e2030 : 0xe7d7bd), grp, 0, 0.25, 0, 11, 0.5, 5);
  const pend = new THREE.Group(); pend.position.y = H; grp.add(pend);
  const sh = new THREE.Shape(); sh.moveTo(-4.6, 0.9); sh.quadraticCurveTo(-3.6, -1.6, 0, -1.7); sh.quadraticCurveTo(3.6, -1.6, 4.6, 0.9); sh.lineTo(-4.6, 0.9);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false, curveSegments: 4 }); hull.translate(0, 0, -1.2);
  const ship = new THREE.Group(); ship.position.y = -6; pend.add(ship);
  mesh(hull, ctx.mat(nn ? 0x22263a : 0x6b3f2a), ship);
  mesh(G.box, ctx.mat(nn ? 0x2a2c40 : 0xd8a35d), ship, 0, 0.95, 0, 9.0, 0.12, 2.3);
  mesh(G.box, ctx.mat(nn ? 0x2a2c40 : 0xc0392b), ship, 0, 0.6, 1.22, 8.6, 0.25, 0.05);
  mesh(G.box, ctx.mat(nn ? 0x2a2c40 : 0xc0392b), ship, 0, 0.6, -1.22, 8.6, 0.25, 0.05);
  strut(V(0, 0.9, 0), V(0, 5.5, 0), 0.1, frame, ship);
  const sail = mesh(G.box, ctx.mat(nn ? 0x262838 : 0xfff3dc), ship, 0, 3.6, 0, 0.08, 2.6, 2.4); void sail;
  for (let i = 0; i < 8; i++) { mesh(G.ico, ctx.mat(0xf2c7a0), ship, -3.2 + i * 0.9, 1.35, (i % 2 ? 0.6 : -0.6), 0.17, 0.17, 0.17); mesh(G.box, ctx.mat([0xff6f91, 0x55c6f2, 0xffd166, 0x8fe388][i % 4]), ship, -3.2 + i * 0.9, 1.1, (i % 2 ? 0.6 : -0.6), 0.3, 0.35, 0.3); }
  for (const z of [-1.0, 1.0]) strut(V(0, 0, z), V(0, -5.2, z), 0.12, frame, pend);
  if (nn) {
    const ign = ctx.igniter(ctx.act(base), 0.6);
    const hp = sh.getPoints(16).map(p => V(p.x, p.y, 1.25));
    ctx.tube(ship, new THREE.CatmullRomCurve3(hp, true), 0xff4545, 0.09, ign);
    ctx.tube(ship, new THREE.CatmullRomCurve3(sh.getPoints(16).map(p => V(p.x, p.y, -1.25)), true), 0xff4545, 0.09, ign);
    ctx.tube(ship, new THREE.LineCurve3(V(0, 0.9, 0), V(0, 5.5, 0)), 0xffb347, 0.07, ign);
    ctx.bulbs(ship, [V(0, 5.6, 0)], 0xffffff, ign, { size: 0.25, steady: true });
    for (const z of [-1.8, 1.8]) { ctx.tube(grp, new THREE.LineCurve3(V(-4.5, 0.1, z), V(0, H, z * 0.8)), 0xffb347, 0.06, ign); ctx.tube(grp, new THREE.LineCurve3(V(4.5, 0.1, z), V(0, H, z * 0.8)), 0xffb347, 0.06, ign); }
    ctx.lamp(base.clone().setY(4), 0xff5030, 40, 18, ign);
  }
  const clk = clockFn(ctx.act(base) + 0.1, 0.6);
  ctx.anim((t) => { const tau = clk(t); const amp = 0.85 * smooth(0, 1.2, tau); pend.rotation.z = Math.sin(tau * 1.9) * amp; });
}

// ---------------------------------------------------------------- teacups
export function buildTeacups(ctx) {
  const base = P(...LAYOUT.cups); const grp = new THREE.Group(); grp.position.copy(base); ctx.root.add(grp); const nn = ctx.neon;
  mesh(G.cyl12, ctx.mat(nn ? 0x1e2030 : 0xf6d6e4), grp, 0, 0.2, 0, 6.4, 0.4, 6.4);
  const plat = new THREE.Group(); plat.position.y = 0.45; grp.add(plat);
  const profile = [[0, 0], [0.55, 0], [0.9, 0.25], [1.05, 0.8], [1.1, 1.05], [0.98, 1.05], [0.9, 0.35], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const cupG = new THREE.LatheGeometry(profile, 10);
  const cupCols = [0xff8fab, 0x7fd8f0, 0xffd166, 0xa5e887, 0xc9a7ff, 0xffa66b, 0xff8fab, 0x7fd8f0, 0xffd166];
  const subs = []; const cups = [];
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * TAU; const sp = new THREE.Group(); sp.position.set(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4); plat.add(sp);
    mesh(G.cyl12, ctx.mat(nn ? 0x232538 : 0xffffff), sp, 0, 0.1, 0, 2.6, 0.2, 2.6);
    for (let j = 0; j < 3; j++) {
      const b = j / 3 * TAU; const cup = new THREE.Group(); cup.position.set(Math.cos(b) * 1.5, 0.2, Math.sin(b) * 1.5); sp.add(cup);
      mesh(cupG, ctx.mat(nn ? 0x262a40 : cupCols[k * 3 + j]), cup, 0, 0, 0, 0.85, 0.85, 0.85);
      mesh(G.ico, ctx.mat(0xf2c7a0), cup, 0.25, 0.85, 0, 0.17, 0.17, 0.17);
      mesh(G.ico, ctx.mat(0xf2c7a0), cup, -0.25, 0.85, 0.1, 0.15, 0.15, 0.15);
      cups.push(cup);
      if (nn) { const ign = ctx.igniter(ctx.act(base) + 0.05 * (k * 3 + j), 0.4); ctx.tube(cup, ringCurve(0.93, 0.9, 20), [0xff3d9a, 0x27e3ff, 0xffb347, 0x3dffb5, 0xb070ff][(k * 3 + j) % 5], 0.06, ign); }
    }
    subs.push(sp);
  }
  if (nn) {
    const ign = ctx.igniter(ctx.act(base), 0.6);
    const e = []; for (let i = 0; i < 56; i++) { const a = i / 56 * TAU; e.push(V(Math.cos(a) * 6.45, 0.45, Math.sin(a) * 6.45)); }
    ctx.bulbs(grp, e, (i) => (i % 2 ? 0xff7ad0 : 0xffe0a0), ign, { size: 0.15, chase: 7, chaseSpeed: 1.0, order: (i) => i / 56 });
    ctx.lamp(base.clone().setY(3), 0xff60d0, 40, 16, ign);
  }
  const clk = clockFn(ctx.act(base) + 0.1, 0.6);
  ctx.anim((t) => { const tau = clk(t); plat.rotation.y = tau * 0.8; subs.forEach((s, i) => s.rotation.y = -tau * 1.6 * (i % 2 ? 1 : -1)); cups.forEach((c, i) => c.rotation.y = tau * (2.5 + i % 3)); });
}

// ---------------------------------------------------------------- log flume
export function buildFlume(ctx) {
  const c = P(...LAYOUT.lake); const nn = ctx.neon;
  const pts = []; const N = 18;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU; const r = 13.5 + Math.sin(a * 2 + 0.5) * 1.5;
    let y = 0.6;
    const f = i / N; // lift then drop near f 0.55..0.75
    if (f > 0.25 && f < 0.6) y = 0.6 + (f - 0.25) / 0.35 * 6.5;
    if (f >= 0.6 && f < 0.68) y = 7.1 - (f - 0.6) / 0.08 * 6.5;
    pts.push(V(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const M = 400; const Pp = [], Nn = [], B = [];
  for (let i = 0; i < M; i++) {
    const p = curve.getPointAt(i / M), t = curve.getTangentAt(i / M);
    const b = V().crossVectors(t, V(0, 1, 0)).normalize(); const n = V().crossVectors(b, t).normalize();
    Pp.push(p); Nn.push(n); B.push(b);
  }
  const trough = sweep(Pp, Nn, B, [[-0.95, 0.45], [-0.75, -0.35], [0.75, -0.35], [0.95, 0.45], [0.75, 0.45], [0.6, -0.15], [-0.6, -0.15], [-0.75, 0.45]], true);
  const grp = new THREE.Group(); ctx.root.add(grp);
  const tm = mesh(trough, ctx.mat(nn ? 0x1c2030 : 0xc9925e), grp); tm.userData.bpCoarse = true;
  const wat = sweep(Pp, Nn, B, [[-0.62, -0.1], [0.62, -0.1], [0.62, -0.12], [-0.62, -0.12]], true);
  const wm = mesh(wat, nn ? ctx.glowMat(0x1060a0, 0.3) : ctx.mat(0x6fd3f5, { rough: 0.2 }), grp); wm.castShadow = false;
  if (nn) ctx.glowFollow(wm.material, 0x1a70c0, 0.18, c);
  for (let i = 0; i < M; i += 16) { const p = Pp[i]; if (p.y > 1.2) strut(V(p.x, 0, p.z), p.clone().addScaledVector(Nn[i], -0.4), 0.15, ctx.mat(nn ? 0x181b2a : 0x9c6b45), grp); }
  // logs
  const logs = []; const L = curve.getLength();
  for (let k = 0; k < 5; k++) {
    const lg = new THREE.Group(); grp.add(lg); lg.userData.noBP = true;
    mesh(G.cyl8, ctx.mat(nn ? 0x2c2430 : 0x8b5a2b), lg, 0, 0.1, 0, 0.55, 2.4, 0.55).rotation.z = Math.PI / 2;
    for (const x of [-0.5, 0.4]) { mesh(G.ico, ctx.mat(0xf2c7a0), lg, x, 0.75, 0, 0.17, 0.17, 0.17); mesh(G.box, ctx.mat([0xff6f91, 0x55c6f2, 0xffd166][k % 3]), lg, x, 0.5, 0, 0.3, 0.35, 0.35); }
    logs.push(lg);
  }
  // splash particles
  const sN = 60; const splash = new THREE.InstancedMesh(G.ico, nn ? ctx.glowMat(0x9fe8ff, 2.5) : ctx.mat(0xffffff, { rough: 0.3 }), sN); splash.frustumCulled = false; grp.add(splash); splash.userData.noBP = true;
  const dropEnd = curve.getPointAt(0.69);
  const fN = 90; const fount = new THREE.InstancedMesh(G.ico, nn ? ctx.glowMat(0x8fe0ff, 1.0) : ctx.mat(0xeafaff, { rough: 0.2 }), fN); fount.frustumCulled = false; fount.userData.noBP = true; grp.add(fount);
  if (nn) ctx.glowFollow(fount.material, 0x8fe0ff, 2.2, c);
  const fr = rng(31); const fp = []; for (let i = 0; i < fN; i++) fp.push([fr() * TAU, 0.6 + fr() * 1.2, 7 + fr() * 2.5, fr()]);
  const fm4 = new THREE.Matrix4(), fq = new THREE.Quaternion();
  ctx.anim((t) => {
    const tau = clockFn(ctx.act(c) + 0.2, 0.4)(t); const k = smooth(0, 0.6, tau);
    for (let i = 0; i < fN; i++) {
      const [a, vr, vy, ph] = fp[i]; const T = 1.6; const age = (tau + ph * T) % T;
      const y = 0.2 + vy * k * age - 4.9 * age * age; const s = y > 0.1 ? 0.18 * k * (1 - 0.4 * age / T) : 0;
      fm4.compose(V(c.x + Math.cos(a) * vr * age, Math.max(0.1, y), c.z + Math.sin(a) * vr * age), fq, V(s, s, s)); fount.setMatrixAt(i, fm4);
    }
    fount.instanceMatrix.needsUpdate = true;
  });
  let ign = null;
  if (nn) {
    ign = ctx.igniter(ctx.act(c), 0.9);
    const ptsL = [], ptsR = []; for (let i = 0; i < M; i += 2) { ptsL.push(Pp[i].clone().addScaledVector(B[i], 0.95).addScaledVector(Nn[i], 0.45)); ptsR.push(Pp[i].clone().addScaledVector(B[i], -0.95).addScaledVector(Nn[i], 0.45)); }
    ctx.tube(grp, new THREE.CatmullRomCurve3(ptsL, true), 0x27e3ff, 0.055, ign, { segs: 400 });
    ctx.tube(grp, new THREE.CatmullRomCurve3(ptsR, true), 0x3dffb5, 0.055, ign, { segs: 400 });
    ctx.lamp(dropEnd.clone().setY(2), 0x30c0ff, 50, 20, ign);
  }
  const clk = clockFn(ctx.act(c) + 0.1, 0.5);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), r = rng(9);
  const sp = []; for (let i = 0; i < sN; i++) sp.push([r() * TAU, 2 + r() * 4, 3 + r() * 5, r()]);
  ctx.anim((t) => {
    const tau = clk(t);
    logs.forEach((lg, k) => {
      const u = ((k / 5 + 0.04 + tau * 0.07) % 1 + 1) % 1;
      const s = u; const p = curve.getPointAt(s), tg = curve.getTangentAt(s);
      lg.position.copy(p).add(V(0, 0.05, 0)); lg.quaternion.setFromUnitVectors(V(1, 0, 0), tg);
    });
    for (let i = 0; i < sN; i++) {
      const [a, vy, vr, ph] = sp[i]; const T = 0.9; const age = ((tau + ph * T) % T);
      const on = tau > 0.05 ? 1 : 0;
      const x = dropEnd.x + Math.cos(a) * vr * age, z = dropEnd.z + Math.sin(a) * vr * age, y = 0.4 + vy * age - 9 * age * age;
      const s = on * 0.22 * (1 - age / T);
      m4.compose(V(x, Math.max(0.1, y), z), q, V(s, s, s)); splash.setMatrixAt(i, m4);
    }
    splash.instanceMatrix.needsUpdate = true;
  });
}

// ---------------------------------------------------------------- gate, stalls, tents
export function buildGate(ctx) {
  const base = P(...LAYOUT.gate); const grp = new THREE.Group(); grp.position.copy(base); grp.rotation.y = Math.PI / 4; ctx.root.add(grp); const nn = ctx.neon;
  // gate spans local x (screen right)
  for (const x of [-4.2, 4.2]) {
    mesh(G.box, ctx.mat(nn ? 0x1d2032 : 0xf3e3c3), grp, x, 3, 0, 1.8, 6, 1.8);
    mesh(G.cone8, ctx.mat(nn ? 0x281c2c : 0xe8475f), grp, x, 7.1, 0, 1.6, 2.2, 1.6).rotation.y = Math.PI / 8;
    mesh(G.box, ctx.mat(nn ? 0x26283a : 0x7fd1c7), grp, x, 4.5, 0, 1.9, 0.4, 1.9);
    strut(V(x, 8, 0), V(x, 9.4, 0), 0.04, ctx.mat(0x666666), grp);
    const flag = mesh(G.box, ctx.mat(nn ? 0x2a2c40 : (x < 0 ? 0xffd166 : 0x55c6f2)), grp, x + 0.45, 9.1, 0, 0.9, 0.5, 0.04);
    ctx.anim((t) => { flag.rotation.y = Math.sin(t * 6 + x) * 0.35; });
  }
  const arch = new THREE.TorusGeometry(4.2, 0.35, 5, 16, Math.PI);
  mesh(arch, ctx.mat(nn ? 0x26283a : 0xffd166), grp, 0, 5.2, 0);
  const banner = faceColors(new THREE.BoxGeometry(6.6, 1.2, 0.3, 8, 1, 1), (f, c) => new THREE.Color(Math.floor((c.x + 3.3) / 0.825) % 2 ? (nn ? 0x2a1d2e : 0xe8475f) : (nn ? 0x222433 : 0xfff6ea)));
  mesh(banner, ctx.vmat(), grp, 0, 5.4, 0.3);
  for (const x of [-1.6, 0, 1.6]) mesh(G.box, ctx.mat(nn ? 0x22253a : 0x9aa3b5), grp, x, 0.5, 0, 0.3, 1.0, 1.2);
  if (nn) {
    const ign = ctx.igniter(0.12, 0.5);
    const ap = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; ap.push(V(Math.cos(a) * 4.2, 5.2 + Math.sin(a) * 4.2, 0.4)); }
    ctx.tube(grp, new THREE.CatmullRomCurve3(ap), 0xff3d9a, 0.12, ign);
    const ap2 = ap.map(p => V(p.x * 0.85, 5.2 + (p.y - 5.2) * 0.85, 0.4));
    ctx.tube(grp, new THREE.CatmullRomCurve3(ap2), 0x27e3ff, 0.09, ign);
    const bul = []; for (let i = 0; i < 12; i++) bul.push(V(-3 + i * 6 / 11, 4.65, 0.5), V(-3 + i * 6 / 11, 6.15, 0.5));
    ctx.bulbs(grp, bul, 0xffd27a, ign, { size: 0.15, chase: 4, chaseSpeed: 2, order: (i) => i / bul.length });
    for (const x of [-4.2, 4.2]) { ctx.tube(grp, new THREE.LineCurve3(V(x - 0.95, 0.1, 0.95), V(x - 0.95, 6, 0.95)), 0xffb347, 0.06, ign); ctx.tube(grp, new THREE.LineCurve3(V(x + 0.95, 0.1, 0.95), V(x + 0.95, 6, 0.95)), 0xffb347, 0.06, ign); }
    ctx.lamp(base.clone().setY(5), 0xff60b0, 40, 18, ign);
  }
}

export function buildStalls(ctx) {
  const nn = ctx.neon;
  const stalls = [[11, 27, 0.6, 0], [11, 33, 0.6, 1], [-4, 34, -0.3, 2], [15, 18, 0.8, 3], [-15, 17, -0.6, 0], [14, -1, 0.1, 1], [-8, -12, 0.2, 2], [-17, 38, 0, 3], [22, 30, 0.9, 2]];
  const awn = [[0xe8475f, 0xffffff], [0x3fa7d6, 0xffffff], [0xf9c74f, 0xffffff], [0x90be6d, 0xffffff]];
  const signs = [0xffd166, 0xff8fab, 0x8fe388, 0x7fd8f0];
  for (const [X, D, rot, k] of stalls) {
    const base = P(X, D); const grp = new THREE.Group(); grp.position.copy(base); grp.rotation.y = rot + Math.PI / 4; ctx.root.add(grp);
    mesh(G.box, ctx.mat(nn ? 0x1e2030 : 0xfff3dc), grp, 0, 0.9, 0, 3.0, 1.8, 2.0);
    mesh(G.box, ctx.mat(nn ? 0x232538 : 0xb5835a), grp, 0, 1.0, 1.05, 3.0, 0.15, 0.4);
    const aw = faceColors(new THREE.BoxGeometry(3.4, 0.15, 1.6, 7, 1, 1), (f, c) => new THREE.Color(Math.floor((c.x + 1.7) / 0.486) % 2 ? (nn ? 0x2a1d2e : awn[k][0]) : (nn ? 0x222433 : awn[k][1])));
    const am = mesh(aw, ctx.vmat(), grp, 0, 2.3, 1.15); am.rotation.x = 0.35;
    mesh(G.box, ctx.mat(nn ? 0x1e2030 : 0xfff3dc), grp, 0, 2.2, -0.2, 3.0, 0.3, 1.6);
    // roof prop: giant treat (ice cream / donut / popcorn)
    if (k === 0) { mesh(G.cone8, ctx.mat(nn ? 0x2b2a22 : 0xe0a96d), grp, 0, 3.0, -0.2, 0.45, 1.1, 0.45).rotation.x = Math.PI; mesh(G.ico, ctx.mat(nn ? 0x302030 : 0xffb3c6), grp, 0, 3.7, -0.2, 0.55, 0.55, 0.55); }
    else if (k === 1) { const d = mesh(new THREE.TorusGeometry(0.5, 0.25, 5, 10), ctx.mat(nn ? 0x302030 : 0xff8fab), grp, 0, 3.2, -0.2); }
    else if (k === 2) { mesh(stripedCyl(0.55, 0.4, 0.9, 8, nn ? 0x2a1d2e : 0xe8475f, nn ? 0x222433 : 0xffffff), ctx.vmat(), grp, 0, 2.9, -0.2); mesh(G.ico, ctx.mat(nn ? 0x2b2a22 : 0xfff1c1), grp, 0, 3.45, -0.2, 0.5, 0.35, 0.5); }
    else { mesh(G.box, ctx.mat(nn ? 0x22253a : signs[k]), grp, 0, 3.0, -0.2, 1.8, 0.8, 0.15); }
    if (nn) {
      const ign = ctx.igniter(ctx.act(base), 0.4);
      ctx.tube(grp, new THREE.CatmullRomCurve3([V(-1.7, 2.55, 1.85), V(1.7, 2.55, 1.85)]), [0xff3d9a, 0x27e3ff, 0xffb347, 0x3dffb5][k], 0.06, ign);
      ctx.tube(grp, new THREE.CatmullRomCurve3([V(-1.5, 0.1, 1.05), V(-1.5, 1.9, 1.05)]), [0xff3d9a, 0x27e3ff, 0xffb347, 0x3dffb5][k], 0.05, ign);
      ctx.tube(grp, new THREE.CatmullRomCurve3([V(1.5, 0.1, 1.05), V(1.5, 1.9, 1.05)]), [0xff3d9a, 0x27e3ff, 0xffb347, 0x3dffb5][k], 0.05, ign);
      ctx.bulbs(grp, [V(0, 1.5, 0.95)], 0xffc070, ign, { size: 0.5, steady: true, dim: 0.6 });
      const sb = []; for (let i = 0; i < 6; i++) sb.push(V(-1.5 + i * 0.6, 3.2, -0.2));
      ctx.bulbs(grp, sb, 0xfff0c0, ign, { size: 0.12, chase: 3, chaseSpeed: 2, order: (i) => i / 6 });
    }
  }
  // striped tents
  const tents = [[-24, 40, 0], [-30, 34, 1], [26, 38, 2], [34, 31, 3], [-2, -12, 1], [22, -4, 0], [-20, 11, 2]];
  const tc = [[0xe8475f, 0xfff6ea], [0x3fa7d6, 0xfff6ea], [0xf9c74f, 0xe8475f], [0x9b6bd6, 0xfff6ea]];
  for (const [X, D, k] of tents) {
    const base = P(X, D); const grp = new THREE.Group(); grp.position.copy(base); ctx.root.add(grp);
    const r = 2.4 + (k % 2) * 0.6;
    mesh(stripedCyl(r, r, 2.0, 12, nn ? 0x2a1d2e : tc[k][0], nn ? 0x222433 : tc[k][1]), ctx.vmat(), grp, 0, 1.0, 0);
    mesh(stripedCone(r + 0.4, 2.4, 12, nn ? 0x2a1d2e : tc[k][0], nn ? 0x222433 : tc[k][1]), ctx.vmat(), grp, 0, 3.2, 0);
    strut(V(0, 4.3, 0), V(0, 5.3, 0), 0.04, ctx.mat(0x777777), grp);
    const fl = mesh(G.box, ctx.mat(nn ? 0x2a2c40 : tc[(k + 1) % 4][0]), grp, 0.35, 5.05, 0, 0.7, 0.4, 0.04);
    ctx.anim((t) => { fl.rotation.y = Math.sin(t * 7 + X) * 0.4; });
    if (nn) {
      const ign = ctx.igniter(ctx.act(base), 0.5);
      const e = []; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; e.push(V(Math.cos(a) * (r + 0.42), 2.02, Math.sin(a) * (r + 0.42))); }
      const ribs = []; for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; for (let s = 1; s < 5; s++) { const f = s / 5; ribs.push(V(Math.cos(a) * (r + 0.4) * (1 - f), 2.0 + 2.4 * f, Math.sin(a) * (r + 0.4) * (1 - f))); } }
      ctx.bulbs(grp, e.concat(ribs), [0xffc46b, 0xff7ad0, 0x7fe8ff, 0xb98bff][k], ign, { size: 0.13, order: (i) => (i % 24) / 24, twinkle: true });
      ctx.bulbs(grp, [V(0, 1.2, 0)], [0xffa040, 0xff60c0, 0x40c0ff, 0xa070ff][k], ign, { size: 1.0, steady: true, dim: 0.35 });
    }
  }
  // fountain at hub front
}

// ---------------------------------------------------------------- props: lamps, bunting, benches, fence
export function buildProps(ctx, paths) {
  const nn = ctx.neon; const r = rng(77);
  const posts = []; const q = V(), d = V();
  for (const e of paths.edges) {
    const L = e.line; const n = Math.floor(L.length / 7);
    for (let i = 1; i <= n; i++) {
      const s = L.length * i / (n + 1); L.at(s, q, d); const side = (i % 2 ? 1 : -1) * (e.w / 2 + 0.35);
      posts.push({ p: V(q.x - d.z * side, 0, q.z + d.x * side), s, e });
    }
  }
  const postM = new THREE.InstancedMesh(G.cyl6, ctx.mat(nn ? 0x1a1c28 : 0x3e5c50), posts.length);
  const headM = new THREE.InstancedMesh(G.ico, nn ? ctx.glowMat(0xffd9a0, 0.0) : ctx.mat(0xfff3c4), posts.length);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
  posts.forEach((o, i) => { m4.compose(V(o.p.x, 1.6, o.p.z), qq, V(0.08, 3.2, 0.08)); postM.setMatrixAt(i, m4); m4.compose(V(o.p.x, 3.3, o.p.z), qq, V(0.25, 0.3, 0.25)); headM.setMatrixAt(i, m4); });
  postM.castShadow = true; headM.castShadow = true; ctx.root.add(postM); ctx.root.add(headM);
  if (nn) {
    // lamp heads ignite with the spark (per-instance color)
    const t0s = posts.map(o => ctx.act(o.p));
    ctx.bulbsFromMesh(headM, t0s, 0xffd9a0, 2.6);
  }
  // bunting / light strings between consecutive posts on each edge (alternate side ones -> use same-side pairs)
  const flags = []; const strings = [];
  for (const e of paths.edges) {
    const L = e.line; const n = Math.floor(L.length / 5);
    for (const side of [1, -1]) {
      for (let i = 0; i < n; i++) {
        const s0 = L.length * i / n, s1 = L.length * (i + 1) / n;
        const a = L.at(s0, V(), d).clone(); const da = d.clone(); const b = L.at(s1, V(), d).clone(); const db = d.clone();
        const off = side * (e.w / 2 + 0.2);
        a.x -= da.z * off; a.z += da.x * off; b.x -= db.z * off; b.z += db.x * off;
        if (side === -1 && !nn) continue;
        for (let k = 1; k < 8; k++) { const f = k / 8; const p = a.clone().lerp(b, f); p.y = 2.9 - Math.sin(f * Math.PI) * 0.7; flags.push({ p, dir: b.clone().sub(a).normalize(), k, t0: ctx.act(p) }); }
      }
    }
  }
  if (!nn) {
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.42, 0], 3)); tri.computeVertexNormals();
    const fm = new THREE.InstancedMesh(tri, ctx.mat(0xffffff, { side: THREE.DoubleSide }), flags.length);
    const cols = [0xff6f91, 0xffd166, 0x55c6f2, 0x8fe388, 0xc39bff];
    flags.forEach((f, i) => { const ang = Math.atan2(-f.dir.z, f.dir.x); qq.setFromAxisAngle(V(0, 1, 0), ang); m4.compose(f.p, qq, V(1, 1, 1)); fm.setMatrixAt(i, m4); fm.setColorAt(i, new THREE.Color(cols[(i * 7) % 5])); });
    fm.castShadow = true; ctx.root.add(fm); fm.userData.noBP = true;
  } else {
    const pal = [0xffd27a, 0xff6fc8, 0x6fe8ff, 0xffd27a, 0xb98bff];
    ctx.pathBulbs(flags.map(f => f.p), flags.map((f, i) => pal[(i * 3) % 5]), flags.map(f => f.t0));
  }
  // benches & bins
  const benches = [];
  for (let i = 0; i < 60; i++) { const e = paths.edges[Math.floor(r() * paths.edges.length)]; const s = r() * e.line.length; e.line.at(s, q, d); const side = (r() < 0.5 ? 1 : -1) * (e.w / 2 + 0.6); benches.push([V(q.x - d.z * side, 0, q.z + d.x * side), Math.atan2(-d.z, d.x)]); }
  const bm = new THREE.InstancedMesh(G.box, ctx.mat(nn ? 0x1c1e2a : 0xa8714a), benches.length);
  benches.forEach(([p, a], i) => { qq.setFromAxisAngle(V(0, 1, 0), a); m4.compose(V(p.x, 0.35, p.z), qq, V(1.3, 0.25, 0.45)); bm.setMatrixAt(i, m4); });
  bm.castShadow = true; bm.receiveShadow = true; ctx.root.add(bm);
  // flower beds around hub plaza
  if (!nn) {
    const fl = []; const hub = paths.hub;
    for (let i = 0; i < 160; i++) { const a = r() * TAU, rr = 6.4 + r() * 0.8; fl.push(V(hub.x + Math.cos(a) * rr, 0.2, hub.z + Math.sin(a) * rr)); }
    const fm = new THREE.InstancedMesh(G.ico, ctx.mat(0xffffff), fl.length); const fc = [0xff6f91, 0xffd166, 0xffffff, 0xc39bff, 0xff9f5a];
    fl.forEach((p, i) => { const s = 0.22 + r() * 0.15; m4.compose(p, qq.identity(), V(s, s, s)); fm.setMatrixAt(i, m4); fm.setColorAt(i, new THREE.Color(fc[i % 5])); });
    ctx.root.add(fm);
    const hedge = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.45, 4, 40).rotateX(Math.PI / 2), ctx.mat(0x4f9a52)); hedge.position.set(hub.x, 0.3, hub.z); hedge.castShadow = true; ctx.root.add(hedge);
  }
}

// ---------------------------------------------------------------- trees
export function buildTrees(ctx, paths, avoid) {
  const nn = ctx.neon; const r = rng(5); const trees = [];
  const q = V(), d = V();
  const pathDist = (p) => { let best = Infinity; for (const e of paths.edges) { for (let i = 0; i < e.line.pts.length - 1; i++) { const a = e.line.pts[i], b = e.line.pts[i + 1]; const ab = b.clone().sub(a); const t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); const c = a.clone().addScaledVector(ab, t); best = Math.min(best, c.distanceTo(p) - e.w / 2); } } return best; };
  const ok = (p) => { for (const [X, D, rr] of avoid) { const c = P(X, D); if (Math.hypot(c.x - p.x, c.z - p.z) < rr) return false; } return pathDist(p) > 1.4; };
  let tries = 0;
  while (trees.length < 520 && tries < 20000) {
    tries++;
    const X = (r() - 0.5) * 140, D = -75 + r() * 140;
    const p = P(X, D); const edge = Math.max(Math.abs(X) / 54, (D > 0 ? D / 60 : -D / 52));
    const outside = edge > 1.0;
    if (!outside && r() < 0.55) continue;
    if (!ok(p)) continue;
    p.y = 0;
    trees.push({ p, s: 0.8 + r() * 0.7 + (outside ? 0.3 : 0), kind: r() < (outside ? 0.45 : 0.3) ? 1 : 0, c: r(), outside });
  }
  // ground height for outside trees
  for (const t of trees) {
    const x = t.p.x, z = t.p.z; const [X, D] = [(x - z) * Math.SQRT1_2, (x + z) * Math.SQRT1_2];
    const edge = Math.max(Math.abs(X) / 54, (D > 0 ? D / 60 : -D / 52));
    t.p.y = smooth(1.0, 1.5, edge) * (vnoise(x * 0.05, z * 0.05) * 9 + vnoise(x * 0.13, z * 0.13) * 3) - 0.1;
  }
  const trunk = new THREE.InstancedMesh(G.cyl6, ctx.mat(nn ? 0x14161f : 0x8a5a3c), trees.length);
  const round = trees.filter(t => t.kind === 0), cone = trees.filter(t => t.kind === 1);
  const crownR = new THREE.InstancedMesh(G.ico, ctx.mat(0xffffff), round.length);
  const crownC = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), ctx.mat(0xffffff), cone.length * 2);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
  trees.forEach((t, i) => { m4.compose(V(t.p.x, t.p.y + 0.8 * t.s, t.p.z), qq, V(0.25 * t.s, 1.6 * t.s, 0.25 * t.s)); trunk.setMatrixAt(i, m4); });
  const col = (t, base) => nn ? new THREE.Color().setHSL(0.6 + t.c * 0.05, 0.3, 0.05 + t.c * 0.03) : new THREE.Color().setHSL(base + t.c * 0.08, 0.5 + t.c * 0.15, 0.36 + t.c * 0.14);
  round.forEach((t, i) => { qq.setFromEuler(new THREE.Euler(t.c * 3, t.c * 7, 0)); m4.compose(V(t.p.x, t.p.y + 2.6 * t.s, t.p.z), qq, V(1.6 * t.s, 1.5 * t.s, 1.6 * t.s)); crownR.setMatrixAt(i, m4); crownR.setColorAt(i, col(t, 0.24)); });
  qq.identity();
  cone.forEach((t, i) => {
    m4.compose(V(t.p.x, t.p.y + 2.4 * t.s, t.p.z), qq, V(1.5 * t.s, 2.6 * t.s, 1.5 * t.s)); crownC.setMatrixAt(i * 2, m4); crownC.setColorAt(i * 2, col(t, 0.33));
    m4.compose(V(t.p.x, t.p.y + 3.6 * t.s, t.p.z), qq, V(1.1 * t.s, 2.0 * t.s, 1.1 * t.s)); crownC.setMatrixAt(i * 2 + 1, m4); crownC.setColorAt(i * 2 + 1, col(t, 0.33));
  });
  for (const m of [trunk, crownR, crownC]) { m.castShadow = true; m.receiveShadow = true; ctx.root.add(m); }
  if (nn) {
    // fairy lights on some inner trees
    const pts = [], cols = [], t0 = [];
    trees.filter(t => !t.outside).forEach((t, i) => {
      if (i % 2) return;
      for (let k = 0; k < 9; k++) { const a = r() * TAU, h = r(); const rr = 1.6 * t.s * (0.9 - h * 0.3); pts.push(V(t.p.x + Math.cos(a) * rr, t.p.y + (1.8 + h * 1.6) * t.s, t.p.z + Math.sin(a) * rr)); cols.push(i % 4 ? 0xfff0c8 : 0x9fe8ff); t0.push(ctx.act(t.p) + 0.2); }
    });
    ctx.pathBulbs(pts, cols, t0, { size: 0.09, twinkle: true, gain: 1.6 });
  }
  return trees;
}

// ---------------------------------------------------------------- guests & balloons
export function buildGuests(ctx, paths) {
  const nn = ctx.neon; const r = rng(42);
  const NW = 560, NI = 200; const N = NW + NI;
  const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.26, 0.72, 6), ctx.mat(0xffffff), N);
  const head = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.19, 0), ctx.mat(nn ? 0x3a3340 : 0xf2c7a0), N);
  for (const m of [body, head]) { m.frustumCulled = false; m.castShadow = true; m.userData.noBP = true; ctx.root.add(m); }
  const shirt = [0xff5d73, 0x3fa7d6, 0xffd166, 0x59c96b, 0xa77bff, 0xff9f45, 0xffffff, 0x2ec4b6, 0xf15bb5];
  const skin = [0xf2c7a0, 0xd9a47a, 0xa86f4c, 0xf7d9bf, 0x7a4b32];
  const guests = [];
  const edgesOf = {}; paths.edges.forEach((e, i) => { (edgesOf[e.a] ??= []).push(i); (edgesOf[e.b] ??= []).push(i); });
  for (let g = 0; g < NW; g++) {
    // build random route
    let ei = Math.floor(r() * paths.edges.length); let fwd = r() < 0.5; const pts = [];
    for (let k = 0; k < 4; k++) {
      const e = paths.edges[ei]; const p = e.line.pts.slice(); if (!fwd) p.reverse();
      pts.push(...(pts.length ? p.slice(1) : p));
      const endNode = fwd ? e.b : e.a; const opts = edgesOf[endNode].filter(x => x !== ei); const nx = opts.length ? opts[Math.floor(r() * opts.length)] : ei;
      const ne = paths.edges[nx]; fwd = ne.a === endNode; ei = nx;
    }
    const line = new THREE.Vector3(); void line;
    const route = new (paths.edges[0].line.constructor)(pts);
    const e0 = paths.edges[0];
    guests.push({ route, s0: r() * route.length * 0.4, v: 1.1 + r() * 0.9, off: (r() - 0.5) * 2.2, ph: r() * TAU, balloon: r() < 0.09 });
  }
  const idle = [];
  const spots = [[...LAYOUT.hub, 11.5, 6.6], [4, 42, 6, 0], [-12, 28, 7, 6.2], [24, 7, 6.8, 6.6], [...LAYOUT.ship, 5.8, 0], [-14, -11, 5, 0]];
  for (let i = 0; i < NI; i++) {
    const [X, D, R, rin] = spots[Math.floor(r() * spots.length)]; const a = r() * TAU, rr = rin + 0.3 + r() * (R - rin - 0.3);
    const c = P(X, D); idle.push({ p: V(c.x + Math.cos(a) * rr, 0, c.z + Math.sin(a) * rr), a: r() * TAU, ph: r() * TAU, balloon: r() < 0.08 });
  }
  // queue at coaster station + others
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), tmp = V(), dir = V();
  const all = guests.length + idle.length;
  for (let i = 0; i < all; i++) { body.setColorAt(i, new THREE.Color(nn ? new THREE.Color(shirt[i % shirt.length]).multiplyScalar(0.12) : shirt[Math.floor(r() * shirt.length)])); head.setColorAt(i, new THREE.Color(nn ? 0x2a2630 : skin[Math.floor(r() * skin.length)])); }
  // balloons
  const bal = []; guests.forEach((g, i) => g.balloon && bal.push({ g, i })); idle.forEach((g, i) => g.balloon && bal.push({ g, i: i + NW }));
  // vendor cluster + floating
  const vend = P(6, 19); const VN = 16; const FN = 7;
  const BN = bal.length + VN + FN;
  const balloonM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 7, 6).scale(1, 1.18, 1), nn ? ctx.glowMat(0xffffff, 1) : ctx.mat(0xffffff, { rough: 0.3 }), BN);
  balloonM.frustumCulled = false; balloonM.castShadow = true; balloonM.userData.noBP = true; ctx.root.add(balloonM);
  const bcols = [0xff3d6e, 0xffd23f, 0x3dc5ff, 0x7bf08a, 0xc77dff, 0xff8a3d];
  for (let i = 0; i < BN; i++) { const c = new THREE.Color(bcols[(i * 5) % bcols.length]); if (nn) c.multiplyScalar(0); balloonM.setColorAt(i, c); }
  const strGeo = new THREE.BufferGeometry(); const strPos = new Float32Array(BN * 6); strGeo.setAttribute('position', new THREE.BufferAttribute(strPos, 3));
  const strings = new THREE.LineSegments(strGeo, new THREE.LineBasicMaterial({ color: nn ? 0x555566 : 0x666666, transparent: true, opacity: 0.6 })); strings.frustumCulled = false; strings.userData.noBP = true; strings.userData.balloonStrings = true; ctx.root.add(strings);
  const floatStart = []; for (let i = 0; i < FN; i++) floatStart.push([P((r() - 0.5) * 70, (r() - 0.3) * 60), r() * 6]);
  const clkCache = new Map();
  const clkFor = (p) => { return clockFn(ctx.act(p), 0.5); };
  guests.forEach(g => { g.route.at(g.s0, tmp); g.clk = clkFor(tmp.clone()); g.t0 = ctx.act(tmp.clone()); });
  idle.forEach(g => { g.t0 = ctx.act(g.p); });
  const vendT0 = ctx.act(vend);
  const bcolor = new THREE.Color();
  ctx.anim((t) => {
    let bi = 0;
    const setBalloon = (bp, anchor, idx, t0) => {
      const on = nn ? smooth(t0, t0 + 0.3, t) : 1;
      m4.compose(bp, q.identity(), V(1, 1, 1)); balloonM.setMatrixAt(bi, m4);
      if (nn) { bcolor.set(bcols[(idx * 5) % bcols.length]).multiplyScalar(on * (1.3 + 0.4 * Math.sin(t * 4 + idx))); balloonM.setColorAt(bi, bcolor); }
      strPos.set([anchor.x, anchor.y, anchor.z, bp.x, bp.y - 0.45, bp.z], bi * 6); bi++;
    };
    guests.forEach((g, i) => {
      const tau = g.clk(t); const s = g.s0 + tau * g.v;
      g.route.at(s, tmp, dir);
      const x = tmp.x - dir.z * g.off, z = tmp.z + dir.x * g.off;
      const bob = Math.abs(Math.sin(tau * g.v * 5 + g.ph)) * 0.12;
      q.setFromAxisAngle(V(0, 1, 0), Math.atan2(dir.x, dir.z));
      m4.compose(V(x, 0.42 + bob, z), q, V(1, 1, 1)); body.setMatrixAt(i, m4);
      m4.compose(V(x, 0.98 + bob, z), q, V(1, 1, 1)); head.setMatrixAt(i, m4);
      if (g.balloon) setBalloon(V(x + 0.3 + Math.sin(t * 1.5 + g.ph) * 0.15, 2.9 + bob * 0.5, z + 0.2), V(x + 0.2, 0.8 + bob, z), i, g.t0);
    });
    idle.forEach((g, k) => {
      const i = k + NW; const sway = Math.sin(t * 2 + g.ph) * 0.05;
      q.setFromAxisAngle(V(0, 1, 0), g.a + Math.sin(t * 0.7 + g.ph) * 0.4);
      m4.compose(V(g.p.x, 0.42 + Math.max(0, Math.sin(t * 6 + g.ph)) * 0.04, g.p.z), q, V(1, 1, 1)); body.setMatrixAt(i, m4);
      m4.compose(V(g.p.x + sway, 0.98, g.p.z), q, V(1, 1, 1)); head.setMatrixAt(i, m4);
      if (g.balloon) setBalloon(V(g.p.x + 0.3 + sway * 2, 2.9, g.p.z + 0.2), V(g.p.x + 0.2, 0.8, g.p.z), i, g.t0);
    });
    for (let k = 0; k < VN; k++) { const a = k / VN * TAU; const rr = 0.4 + (k % 3) * 0.35; setBalloon(V(vend.x + Math.cos(a) * rr + Math.sin(t * 1.3 + k) * 0.12, 3.4 + (k % 4) * 0.45 + Math.sin(t * 2 + k) * 0.08, vend.z + Math.sin(a) * rr), V(vend.x, 1.0, vend.z), k + 100, vendT0); }
    for (let k = 0; k < FN; k++) { const [p0, ph] = floatStart[k]; const y = 4 + ((ph + t * 1.6) % 14) * 1.5 + k; const bp = V(p0.x + Math.sin(t * 0.8 + k) * 0.8, y, p0.z + Math.cos(t * 0.6 + k) * 0.6); setBalloon(bp, bp.clone().add(V(0, -1.2, 0)), k + 200, nn ? 1.6 + k * 0.1 : 0); }
    body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true; balloonM.instanceMatrix.needsUpdate = true;
    if (balloonM.instanceColor) balloonM.instanceColor.needsUpdate = true;
    strGeo.attributes.position.needsUpdate = true;
  });
}
