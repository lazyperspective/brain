// people.js: little people (instanced, per-part colours, walking limbs), balloons, strollers, seated guests
import * as THREE from 'three';
import { hash, strollerGeometry, merge, sph, cyl, box } from './geo.js';

const hex = s => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);
const BOTTOMS = [0x2f4b7c, 0x3b5d8f, 0x26324a, 0x7a6a50, 0xc8b48a, 0x2b2b2b, 0x5b5b62, 0xe8e2d4, 0x4a6fa8, 0x8e3b46];
const HAIR = [0x1d1612, 0x3b2516, 0x5a3a22, 0x8a5a2b, 0xd8b56a, 0xb0552a, 0x9a9a9a, 0x2a1d14];
const SKIN = [0xf2cfb0, 0xe8b893, 0xc98e62, 0x9c6a45, 0x6e4a32, 0xf6dcc4];
const WINTER = [0xb8232b, 0x1f3a6e, 0x2e5e3a, 0xd79b2b, 0x6b2e4f, 0x2a2a33, 0xa8402a, 0x4a6fa8, 0xe8e2d4];

export function installPeople(W, park, opts = {}) {
  const D = park.data; const pal = D.guests.clothes_palette.map(hex);
  const geo = opts.lod === 'lo' ? W.persons.lo : W.persons.hi;
  const col = new THREE.Color();
  W.makePeople = (n, group = 'guests', g = geo) => {
    const ig = g.clone();
    const mk = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); ig.setAttribute(name, a); return a; };
    mk('iTop', 3); mk('iBot', 3); mk('iHair', 3); mk('iSkin', 3); mk('iAnim', 4);
    const im = new THREE.InstancedMesh(ig, W.mat('person'), n);
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    W.G(group).add(im); im.userData.n = n;
    return im;
  };
  // seed -> clothes
  W.winter = 0;
  W.setPerson = (im, i, m4, seed, walk = 0, armsUp = 0, colorIdx = -1, child = 0) => {
    im.setMatrixAt(i, m4);
    const a = im.geometry.attributes;
    const h1 = hash(seed * 1.13 + 0.5), h2 = hash(seed * 2.71 + 1.3), h3 = hash(seed * 0.37 + 7.1), h4 = hash(seed * 5.3 + 2.2);
    let top = colorIdx >= 0 ? pal[colorIdx % pal.length] : pal[Math.floor(h1 * pal.length)];
    if (W.winter > 0.5) top = WINTER[Math.floor(h1 * WINTER.length)];
    col.set(top); a.iTop.setXYZ(i, col.r, col.g, col.b);
    col.set(child && h2 < 0.5 ? pal[(Math.floor(h2 * 99)) % pal.length] : BOTTOMS[Math.floor(h2 * BOTTOMS.length)]); a.iBot.setXYZ(i, col.r, col.g, col.b);
    col.set(HAIR[Math.floor(h3 * HAIR.length)]); a.iHair.setXYZ(i, col.r, col.g, col.b);
    col.set(SKIN[Math.floor(h4 * SKIN.length)]); a.iSkin.setXYZ(i, col.r, col.g, col.b);
    const hat = W.winter > 0.5 ? (h3 < 0.8 ? 1 : 0) : (hash(seed * 9.1) < 0.25 ? 1 : 0);
    a.iAnim.setXYZW(i, hash(seed * 3.3) * 6.283, walk, armsUp, hat);
  };
  W.commitPeople = (im) => { im.instanceMatrix.needsUpdate = true; for (const k of ['iTop', 'iBot', 'iHair', 'iSkin', 'iAnim']) im.geometry.attributes[k].needsUpdate = true; };
}

export function buildGuests(W, park, opts = {}) {
  const D = park.data; const G = D.guests;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const sub = opts.subsample || 1;
  const keep = (k) => (sub <= 1 || (k % sub) === 0);
  const H = (child, seed) => (child ? 1.0 + hash(seed) * 0.25 : 1.6 + hash(seed) * 0.25) / 1.72;
  const ground = (x, z) => Math.max(0, park.heightAt(x, z));
  const place = (x, y, z, head, sc) => m4.compose(p3.set(x, y, z), q.setFromAxisAngle(yAxis, head), s3.set(sc, sc, sc));

  // ---- static: idlers + queued + seated
  const stat = [];
  G.idlers.list.forEach((d, k) => { if (keep(k)) stat.push({ x: d[0], z: d[1], h: d[2], ci: d[3], child: d[4], balloon: d[5], seed: 10000 + k }); });
  const qById = {}; for (const qq of D.queues) qById[qq.id] = qq;
  G.queued.list.forEach((d, k) => {
    if (!keep(k)) return;
    const qq = qById[d[0]]; let head = 0;
    if (qq) { // direction of nearest polyline segment, toward the exit
      let best = 1e9; const P = qq.polyline;
      for (let i = 0; i < P.length - 1; i++) { const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1]; const vx = bx - ax, vz = bz - az; const L2 = vx * vx + vz * vz || 1; let u = ((d[1] - ax) * vx + (d[2] - az) * vz) / L2; u = Math.max(0, Math.min(1, u)); const dx = ax + vx * u - d[1], dz = az + vz * u - d[2]; const dd = dx * dx + dz * dz; if (dd < best) { best = dd; head = Math.atan2(vx, vz); } }
    }
    stat.push({ x: d[1], z: d[2], h: head + d[3], ci: d[4], child: d[5], seed: 20000 + k, queue: true });
  });
  const seated = [];
  D.props.benches.list.forEach(([x, y, z, r], k) => { if (hash(k * 1.7) < 0.55) { const off = hash(k) < 0.5 ? -0.4 : 0.4; seated.push({ x: x + Math.cos(r) * off - Math.sin(r) * 0.1, z: z - Math.sin(r) * off - Math.cos(r) * 0.1, h: r, seed: 30000 + k, y: 0.08 }); if (hash(k * 3.3) < 0.4) seated.push({ x: x - Math.cos(r) * off - Math.sin(r) * 0.1, z: z + Math.sin(r) * off - Math.cos(r) * 0.1, h: r, seed: 31000 + k, y: 0.08 }); } });
  D.props.umbrella_tables.list.forEach(([x, y, z, dd], k) => { for (let j = 0; j < 2; j++) { const a = hash(k * 2.3) * 6.28 + j * Math.PI; seated.push({ x: x + Math.cos(a) * 0.85, z: z + Math.sin(a) * 0.85, h: Math.atan2(-Math.cos(a), -Math.sin(a)), seed: 32000 + k * 2 + j, y: 0.05 }); } });
  const nStat = stat.length + seated.length;
  const statIM = W.makePeople(nStat, 'guests');
  let i = 0;
  for (const g of stat) { const sc = H(g.child, g.seed); place(g.x, ground(g.x, g.z), g.z, g.h, sc); W.setPerson(statIM, i++, m4, g.seed, 0, 0, g.ci, g.child); }
  for (const g of seated) { place(g.x, g.y + 0.45 - 0.86 * 0.95 + 0.02, g.z, g.h, 0.95); W.setPerson(statIM, i++, m4, g.seed, -1, 0); }
  W.commitPeople(statIM); statIM.computeBoundingSphere(); statIM.frustumCulled = false;

  // ---- walkers (animated)
  const WL = G.walkers.list; const widx = []; WL.forEach((w, k) => { if (keep(k)) widx.push(k); });
  const walkIM = W.makePeople(widx.length, 'guests');
  widx.forEach((k, j) => { const w = WL[k]; W.setPerson(walkIM, j, m4.identity(), 40000 + k, 0.9 + hash(k) * 0.2, 0, w[5], w[6]); });
  // strollers for ~5% of adult walkers
  const strollers = widx.filter(k => !WL[k][6] && hash(k * 7.7) < 0.05);
  const strIM = strollers.length ? new THREE.InstancedMesh(strollerGeometry(), W.mat('ride'), strollers.length) : null;
  if (strIM) { strIM.frustumCulled = false; strIM.castShadow = true; W.G('guests').add(strIM); const c = new THREE.Color(); strollers.forEach((k, j) => strIM.setColorAt(j, c.set([0x2e294e, 0x1f5e3b, 0x8e3b46, 0x2f4b7c, 0x444444][j % 5]))); }

  // ---- balloons (idlers holding + sellers) + walkers with balloons (children)
  const balloons = [];
  for (const g of stat) if (g.balloon) balloons.push({ x: g.x, z: g.z, h: g.h, sc: H(g.child, g.seed), seed: g.seed, y0: ground(g.x, g.z) });
  const walkBal = widx.filter(k => WL[k][6] && hash(k * 1.9) < 0.35);
  for (const s of D.props.balloon_sellers) for (let k = 0; k < s.count; k++) { const a = k * 2.39996, r = Math.sqrt(k / s.count) * 1.2; balloons.push({ x: s.seller[0] + Math.cos(a) * r * 0.4, z: s.seller[2] + Math.sin(a) * r * 0.4, seller: true, dx: Math.cos(a) * r, dz: Math.sin(a) * r, c: hex(s.colors[k % s.colors.length]), seed: k, y0: 0, h: 0, sc: 1 }); }
  const BCOL = [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71, 0xf5a6c8, 0xffffff, 0x9b59b6];
  const nB = balloons.length + walkBal.length;
  const balGeo = merge([sph(0.5, 10, 8, 0, 0, 0), cyl(0.05, 0.0, 0.12, 5, 0, -0.55, 0)]);
  const balIM = new THREE.InstancedMesh(balGeo, W.mat('ride'), nB); balIM.frustumCulled = false; balIM.castShadow = true;
  const strGeo = cyl(0.008, 0.008, 1, 3, 0, 0.5, 0);
  const strIM2 = new THREE.InstancedMesh(strGeo, W.mat('solid'), nB); strIM2.frustumCulled = false;
  W.G('guests').add(balIM, strIM2);
  const c = new THREE.Color();
  for (let k = 0; k < nB; k++) balIM.setColorAt(k, c.set(k < balloons.length && balloons[k].c ? balloons[k].c : BCOL[Math.floor(hash(k * 4.1) * BCOL.length)]));
  const setBalloon = (k, hx, hy, hz, t, len, seed) => {
    const sway = Math.sin(t * 1.3 + seed) * 0.25, sway2 = Math.cos(t * 1.1 + seed * 1.7) * 0.25;
    const bx = hx + sway, by = hy + len, bz = hz + sway2;
    balIM.setMatrixAt(k, m4.compose(p3.set(bx, by, bz), q.identity(), s3.set(0.42, 0.52, 0.42)));
    const L = Math.hypot(bx - hx, by - hy, bz - hz); const dir = new THREE.Vector3(bx - hx, by - hy, bz - hz).normalize();
    strIM2.setMatrixAt(k, m4.compose(p3.set(hx, hy, hz), q.setFromUnitVectors(yAxis, dir), s3.set(1, L - 0.25, 1)));
  };
  const handOff = (h, sc) => [Math.cos(h) * 0.24 * sc * 1.0, 0.82 * sc, -Math.sin(h) * 0.24 * sc];
  const winterOutfits = () => { // recolour static people for winter
    let j = 0; for (const g of stat) W.setPerson(statIM, j, (statIM.getMatrixAt(j, m4), m4), g.seed, 0, 0, g.ci, g.child), j++;
    for (const g of seated) W.setPerson(statIM, j, (statIM.getMatrixAt(j, m4), m4), g.seed, -1, 0), j++;
    W.commitPeople(statIM);
    widx.forEach((k, jj) => { const w = WL[k]; walkIM.getMatrixAt(jj, m4); W.setPerson(walkIM, jj, m4, 40000 + k, 0.9 + hash(k) * 0.2, 0, w[5], w[6]); });
  };
  let lastWinter = 0;

  W.animators.push((t) => {
    if ((W.winter > 0.5) !== (lastWinter > 0.5)) { winterOutfits(); lastWinter = W.winter; }
    const gw = park.guestsAt(t).walkers;
    const strIndex = new Map(strollers.map((k, j) => [k, j]));
    const wbIndex = new Map(walkBal.map((k, j) => [k, balloons.length + j]));
    widx.forEach((k, j) => {
      const x = gw[5 * k], z = gw[5 * k + 1], h = gw[5 * k + 2]; const child = gw[5 * k + 4]; const sc = H(child, 40000 + k);
      const y = ground(x, z);
      place(x, y, z, h, sc); walkIM.setMatrixAt(j, m4);
      const sj = strIndex.get(k); if (sj != null) strIM.setMatrixAt(sj, m4.compose(p3.set(x + Math.sin(h) * 0.45, y, z + Math.cos(h) * 0.45), q.setFromAxisAngle(yAxis, h), s3.set(1, 1, 1)));
      const bj = wbIndex.get(k); if (bj != null) { const o = handOff(h, sc); setBalloon(bj, x + o[0], y + o[1], z + o[2], t, 1.3, k); }
    });
    walkIM.instanceMatrix.needsUpdate = true; if (strIM) strIM.instanceMatrix.needsUpdate = true;
    balloons.forEach((b, k) => {
      if (b.seller) setBalloon(k, b.x, 1.6, b.z, t, 1.6 + hash(k) * 0.9, k);
      else { const o = handOff(b.h, b.sc); setBalloon(k, b.x + o[0], b.y0 + o[1], b.z + o[2], t, 1.3, b.seed); }
    });
    balIM.instanceMatrix.needsUpdate = true; strIM2.instanceMatrix.needsUpdate = true;
  });
  return { statIM, walkIM };
}
