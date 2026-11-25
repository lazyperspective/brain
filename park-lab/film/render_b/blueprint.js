// blueprint.js: cyan construction-drawing linework for the shot-04 wave (tracks, supports, buildings, rides, trees, kerbs)
import * as THREE from 'three';
import { U } from './mat.js';

export function buildBlueprint(park, Wd, opts = {}) {
  const D = park.data; const bx = opts.box || { x0: -1e9, x1: 1e9, z0: -1e9, z1: 1e9 };
  const inB = (x, z) => x > bx.x0 && x < bx.x1 && z > bx.z0 && z < bx.z1;
  const A = [], B = []; // bright, dim
  const seg = (arr, a, b) => arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const poly = (arr, pts, closed) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) seg(arr, pts[i], pts[(i + 1) % pts.length]); };
  const circle = (arr, cx, cy, cz, r, n = 16, vertical = null) => { const p = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; p.push(vertical == null ? [cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r] : [cx + Math.cos(a) * r * Math.cos(vertical), cy + Math.sin(a) * r, cz + Math.cos(a) * r * Math.sin(vertical)]); } poly(arr, p, true); };
  const boxW = (arr, x, y0, z, rot, w, h, d) => {
    const c = Math.cos(rot), s = Math.sin(rot); const P = (lx, ly, lz) => [x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c];
    const q = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    poly(arr, q.map(([a, b]) => P(a, 0, b)), true); poly(arr, q.map(([a, b]) => P(a, h, b)), true); for (const [a, b] of q) seg(arr, P(a, 0, b), P(a, h, b));
    seg(arr, P(-w / 2, h, -d / 2), P(w / 2, h, d / 2)); seg(arr, P(w / 2, h, -d / 2), P(-w / 2, h, d / 2));
  };
  // tracks
  for (const id of Object.keys(D.tracks)) {
    const tr = park.track(id); const r = D.rides.find(rr => rr.track === id); const g2 = r && r.params && r.params.gauge ? r.params.gauge / 2 : 0.6;
    const L = [], Rr = [];
    for (let s = 0; s <= tr.length; s += 1.0) { const f = tr.sample(s); if (!inB(f.pos[0], f.pos[2])) { if (L.length > 1) { poly(A, L); poly(A, Rr); } L.length = 0; Rr.length = 0; continue; }
      const lf = [f.up[1] * f.tangent[2] - f.up[2] * f.tangent[1], f.up[2] * f.tangent[0] - f.up[0] * f.tangent[2], f.up[0] * f.tangent[1] - f.up[1] * f.tangent[0]];
      const a = [f.pos[0] + lf[0] * g2, f.pos[1] + lf[1] * g2, f.pos[2] + lf[2] * g2], b = [f.pos[0] - lf[0] * g2, f.pos[1] - lf[1] * g2, f.pos[2] - lf[2] * g2];
      L.push(a); Rr.push(b); if ((s | 0) % 3 === 0) seg(B, a, b); }
    if (L.length > 1) { poly(A, L); poly(A, Rr); }
    for (const sp of tr.supports || []) if (inB(sp.base[0], sp.base[2])) { seg(B, sp.base, sp.top); const [x, y, z] = sp.base; poly(B, [[x - 0.8, y, z - 0.8], [x + 0.8, y, z - 0.8], [x + 0.8, y, z + 0.8], [x - 0.8, y, z + 0.8]], true); }
    for (const b of tr.bents || []) if (inB(b.top[0], b.top[2])) { const [x, y, z] = b.top; const [ax, az] = b.axis; seg(B, [x - ax * b.base_width / 2, b.ground, z - az * b.base_width / 2], [x - ax * b.top_width / 2, y, z - az * b.top_width / 2]); seg(B, [x + ax * b.base_width / 2, b.ground, z + az * b.base_width / 2], [x + ax * b.top_width / 2, y, z + az * b.top_width / 2]); seg(B, [x - ax * b.base_width / 2, b.ground, z - az * b.base_width / 2], [x + ax * b.top_width / 2, y, z + az * b.top_width / 2]); }
  }
  // buildings
  for (const b of D.buildings) {
    const [x, y0, z] = b.position; if (!inB(x, z)) continue;
    if (b.items) { for (const it of b.items) boxW(A, it.position[0], 0, it.position[2], it.rot || 0, it.w, it.h, it.d); continue; }
    boxW(A, x, y0, z, b.rot || 0, b.w, b.h, b.d);
  }
  // rides
  for (const r of D.rides) {
    if (r.station && inB(r.station.center[0], r.station.center[1])) boxW(A, r.station.center[0], 0, r.station.center[1], r.station.rot || 0, r.station.w, r.station.h, r.station.d);
    if (!r.position || !inB(r.position[0], r.position[2])) continue; const p = r.params || {}; const [x, , z] = r.position;
    const rad = p.radius || p.platform_radius || p.canopy_radius || p.ring_radius || (p.diameter ? p.diameter / 2 : 6);
    const h = p.height || p.mast_height || p.hub_height || p.pivot_height || 6;
    circle(A, x, 0.1, z, rad + 1, 24); circle(B, x, h, z, Math.max(1.5, (p.mast_radius || 1) + 0.6), 16); seg(A, [x, 0, z], [x, h, z]);
    if (p.mast_radius) { for (const k of [0, 1, 2, 3]) { const a = k / 4 * Math.PI * 2; seg(A, [x + Math.cos(a) * p.mast_radius, 0, z + Math.sin(a) * p.mast_radius], [x + Math.cos(a) * p.mast_radius, h, z + Math.sin(a) * p.mast_radius]); } for (let yy = 0; yy < h; yy += 6) circle(B, x, yy, z, p.mast_radius, 12); }
    if (r.type === 'ferris_wheel') circle(A, x, p.hub_height, z, p.diameter / 2, 40, (r.rot || 0) + Math.PI / 2);
  }
  // queues
  for (const q of D.queues) if (inB(q.center[0], q.center[1])) for (const [a, b] of q.rails) seg(B, [a[0], 1, a[1]], [b[0], 1, b[1]]);
  // kerb outlines
  for (const p of D.paths.kerbs.outlines) for (const ring of [p.outer, ...p.holes]) { const pts = ring.filter(([x, z]) => inB(x, z)).map(([x, z]) => [x, 0.15, z]); if (pts.length > 1) for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if (inB(a[0], a[1]) && inB(b[0], b[1])) seg(A, [a[0], 0.15, a[1]], [b[0], 0.15, b[1]]); } }
  // trees (lollipop wireframes) inside the box
  const T = D.planting.trees.list;
  T.forEach(([x, gy, z, si, h, cr], k) => { if (!inB(x, z)) return; seg(B, [x, gy, z], [x, gy + h * 0.5, z]); circle(B, x, gy + h * 0.62, z, cr, 8); circle(B, x, gy + h * 0.62, z, cr * 0.95, 8, k * 0.7); });

  const zf = { value: 1 };
  const mat = (k) => new THREE.ShaderMaterial({
    uniforms: Object.assign({ uK: { value: k }, uZF: zf }, U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform vec2 uDir; uniform vec4 uZoneA, uZoneB, uZoneC; varying float vS; varying float vZ;
      float bpZone(vec2 p){ float z = 0.0;
        z = max(z, step(uZoneA.x, p.x) * step(p.x, uZoneA.z) * step(uZoneA.y, p.y) * step(p.y, uZoneA.w));
        z = max(z, step(uZoneB.x, p.x) * step(p.x, uZoneB.z) * step(uZoneB.y, p.y) * step(p.y, uZoneB.w)); return z; }
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vS = dot(w.xz, uDir); vZ = bpZone(w.xz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uFront, uBand, uK, uZF; uniform vec3 uCyan; varying float vS; varying float vZ;
      void main(){ float r = clamp((uFront - vS) / uBand, 0.0, 1.0) * (1.0 - vZ); float a = 1.0 - smoothstep(0.2, 0.9, r);
        float boost = (1.0 + 2.2 * exp(-abs(uFront - vS) * 0.08) * (1.0 - vZ)) * (1.0 - 0.45 * vZ) * mix(1.0, uZF, vZ);
        gl_FragColor = vec4(mix(uCyan, vec3(0.85, 0.97, 1.0), 0.3) * a * uK * boost, 1.0); }`,
  });
  const mk = (arr, k) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const l = new THREE.LineSegments(g, mat(k)); l.frustumCulled = false; l.renderOrder = 5; return l; };
  const group = new THREE.Group(); group.add(mk(A, 0.75), mk(B, 0.42));
  return { group, update: (t, f) => { const u = Math.min(1, Math.max(0, (t - 14.6) / 1.0)); zf.value = 1 - u * u * (3 - 2 * u); group.visible = true; } };
}
