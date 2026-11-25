// World builder part 1: style kits, ground, water, planting, props, guests.
import * as THREE from 'three';
import { clamp, lerp, rng, hash1, hex, canvasTex, starPath, RoundedBoxGeometry, lumpySphere, tint, merge, xf, beamMatrix, Inst, patchMaterial, mixHex, shade, vnoise, makeCanvas } from './common.js';

// =====================================================================================================
// KIT: per-style materials
// =====================================================================================================
export function makeKit(S, env) {
  const K = { S, cache: {}, tex: {} };
  // detail texture (R fine, G coarse), mean ~0.5
  K.det = canvasTex(512, 512, (g, w, h) => {
    const R = rng(S === 'felt' ? 11 : S === 'tin' ? 7 : 5);
    const id = g.createImageData(w, h); const d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const n1 = vnoise(x / 7, y / 7, 1), n2 = vnoise(x / 40, y / 40, 3) * 0.6 + vnoise(x / 13, y / 13, 9) * 0.4;
      d[i] = 128 + (n1 - 0.5) * (S === 'tin' ? 10 : 24); d[i + 1] = 128 + (n2 - 0.5) * (S === 'felt' ? 60 : S === 'tin' ? 40 : 34); d[i + 2] = 128; d[i + 3] = 255; }
    g.putImageData(id, 0, 0);
    // R channel strokes: fibres (felt/paper) or halftone + scratches (tin); draw on a temp canvas then copy R only
    const c2 = makeCanvas(w, h); const g2 = c2.getContext('2d'); g2.drawImage(g.canvas, 0, 0);
    if (S === 'felt') { for (let i = 0; i < 9000; i++) { const x = R() * w, y = R() * h, a = R() * 6.3, l = 6 + R() * 22; g2.strokeStyle = R() < 0.5 ? `rgba(255,255,255,${0.10 + R() * 0.14})` : `rgba(0,0,0,${0.08 + R() * 0.12})`; g2.lineWidth = 0.6 + R() * 1.1; g2.beginPath(); g2.moveTo(x, y); g2.quadraticCurveTo(x + Math.cos(a + 1) * l * .5, y + Math.sin(a + 1) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g2.stroke(); } }
    else if (S === 'paper') { for (let i = 0; i < 5000; i++) { const x = R() * w, y = R() * h, a = R() * 6.3, l = 3 + R() * 12; g2.strokeStyle = R() < 0.5 ? `rgba(255,255,255,${0.08 + R() * 0.1})` : `rgba(0,0,0,${0.05 + R() * 0.07})`; g2.lineWidth = 0.5 + R() * 0.6; g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g2.stroke(); } }
    else { for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) { g2.fillStyle = 'rgba(0,0,0,0.08)'; g2.beginPath(); g2.arc(x + ((y / 6) % 2) * 3, y, 1.3, 0, 7); g2.fill(); }
      for (let i = 0; i < 260; i++) { const x = R() * w, y = R() * h; g2.strokeStyle = `rgba(255,255,255,${0.15 + R() * 0.2})`; g2.lineWidth = 0.6; g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x + (R() - .5) * 60, y + (R() - .5) * 18); g2.stroke(); } }
    const a = g.getImageData(0, 0, w, h), b = g2.getImageData(0, 0, w, h); for (let i = 0; i < a.data.length; i += 4) a.data[i] = b.data[i]; g.putImageData(a, 0, 0);
  }, { srgb: false, read: true });
  K.detScale = S === 'felt' ? [1 / 4.5, 1 / 16] : S === 'paper' ? [1 / 3.0, 1 / 18] : [1 / 1.6, 1 / 14];
  K.detK = S === 'felt' ? 0.85 : S === 'paper' ? 0.32 : 0.35;

  // ---------------------------------------------------------------- pattern textures
  K.pattern = (base, acc, pattern, o = {}) => {
    const key = `${base}|${acc}|${pattern}|${o.border ?? ''}|${o.stitch ?? ''}|${o.wear ?? ''}`; if (K.tex[key]) return K.tex[key];
    const s = o.size || 256;
    const t = canvasTex(s, s, g => {
      drawPattern(g, s, base, acc, pattern);
      if (S === 'tin') {
        if (o.border !== false) { g.strokeStyle = o.borderCol || '#f2e4c4'; g.lineWidth = s / 40; g.strokeRect(s * 0.035, s * 0.035, s * 0.93, s * 0.93); g.strokeStyle = '#233a66'; g.lineWidth = s / 110; g.strokeRect(s * 0.07, s * 0.07, s * 0.86, s * 0.86); }
        const r = rng(key.length * 13 + s); g.globalAlpha = 0.07; for (let i = 0; i < 1600; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * s, r() * s, 1.4, 1.4); } g.globalAlpha = 1;
        const gr = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.78); gr.addColorStop(0, 'rgba(60,40,20,0)'); gr.addColorStop(1, 'rgba(60,40,20,0.22)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
        if (o.wear !== false) for (const [x, y, rad] of wearSpots(key.length * 31 + hex(base) % 977, s, 60)) { g.fillStyle = 'rgba(205,200,190,0.9)'; g.beginPath(); g.ellipse(x, y, rad * 1.4, rad, rad, 0, 7); g.fill(); }
      } else if (S === 'felt') {
        if (o.stitch !== false) { g.strokeStyle = o.stitchCol || 'rgba(255,250,235,0.85)'; g.lineWidth = s / 110; g.setLineDash([s / 40, s / 46]); g.strokeRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88); g.setLineDash([]); }
      } else {
        if (o.border) { g.strokeStyle = o.borderCol || 'rgba(0,0,0,0.25)'; g.lineWidth = s / 90; g.strokeRect(s * 0.04, s * 0.04, s * 0.92, s * 0.92); }
      }
    });
    if (o.rep) t.repeat.set(o.rep[0], o.rep[1]);
    return (K.tex[key] = t);
  };
  K.mr = (key) => { // tin metal/roughness wear map (G rough, B metal)
    if (K.tex['mr' + key]) return K.tex['mr' + key];
    return (K.tex['mr' + key] = canvasTex(256, 256, g => { g.fillStyle = 'rgb(0,95,70)'; g.fillRect(0, 0, 256, 256); for (const [x, y, rad] of wearSpots(key.length * 31 + (hex(key.split('|')[0] || '#000') % 977), 256, 60)) { g.fillStyle = 'rgb(0,60,255)'; g.beginPath(); g.ellipse(x, y, rad * 1.4, rad, rad, 0, 7); g.fill(); } }, { srgb: false }));
  };
  K.bump = S === 'felt' ? 0.9 : S === 'paper' ? 0.25 : 0.0;
  const detail = m => patchMaterial(m, { detail: K.det, detailScale: K.detScale, detailStrength: K.detK, bump: K.bump });
  K.detail = detail;
  // ---------------------------------------------------------------- main material factory
  // kinds: base | metal | brass | chrome | wood | glass | water | skin | bulb | rubber | dark
  K.M = (color = '#ffffff', o = {}) => {
    const kind = o.kind || 'base', pattern = o.pattern || 'plain'; const acc = o.acc || '#F3E6CC';
    const key = [color, acc, pattern, kind, o.vc ? 1 : 0, o.side || 0, o.rep || '', o.border ?? '', o.stitch ?? '', o.edge || 0, o.emis || 0, o.flat ? 1 : 0, o.opacity || 1].join('|');
    if (K.cache[key]) return K.cache[key];
    let m; const side = o.side ? THREE.DoubleSide : THREE.FrontSide;
    const map = (pattern !== 'plain' || o.forceMap) ? K.pattern(o.vc ? '#ffffff' : color, acc, pattern, o) : null;
    if (S === 'felt') {
      let c = color; if (kind === 'metal' || kind === 'chrome') c = '#c9c2b8'; if (kind === 'brass') c = '#e8b54a'; if (kind === 'glass') c = '#bfe3f0'; if (kind === 'bulb') c = '#fff1c4';
      m = new THREE.MeshPhysicalMaterial({ color: map ? 0xffffff : c, map, roughness: 1, metalness: 0, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(c).lerp(new THREE.Color('#fff6ea'), 0.45), side, vertexColors: !!o.vc, emissive: kind === 'bulb' ? new THREE.Color('#ffd98a') : 0x000000, emissiveIntensity: kind === 'bulb' ? 0.6 : 0 });
      detail(m);
    } else if (S === 'tin') {
      if (kind === 'metal' || kind === 'chrome') m = new THREE.MeshStandardMaterial({ color: o.vc ? 0xffffff : (kind === 'chrome' ? '#e4e6ea' : '#bdbab2'), metalness: 1, roughness: kind === 'chrome' ? 0.12 : 0.3, side, vertexColors: !!o.vc });
      else if (kind === 'brass') m = new THREE.MeshStandardMaterial({ color: '#d9a948', metalness: 1, roughness: 0.22, side });
      else if (kind === 'glass') m = new THREE.MeshPhysicalMaterial({ color: '#a8d8ea', metalness: 0.3, roughness: 0.08, clearcoat: 1, side });
      else if (kind === 'wood' || kind === 'skin') m = new THREE.MeshStandardMaterial({ color: o.vc ? 0xffffff : color, roughness: kind === 'skin' ? 0.42 : 0.5, metalness: 0, side, vertexColors: !!o.vc, map: woodTex(K, o.vc ? '#ffffff' : color) });
      else if (kind === 'bulb') m = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffcf7a', emissiveIntensity: 0.9, roughness: 0.2 });
      else if (kind === 'rubber' || kind === 'dark') m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, side });
      else { const mm = map || K.pattern(o.vc ? '#ffffff' : color, acc, pattern, Object.assign({ forceMap: true }, o));
        m = new THREE.MeshPhysicalMaterial({ map: mm, metalnessMap: K.mr(color + '|' + pattern), roughnessMap: K.mr(color + '|' + pattern), metalness: 0.55, roughness: 1, clearcoat: 0.7, clearcoatRoughness: 0.14, side, vertexColors: !!o.vc });
        if (mm.repeat) { m.metalnessMap = m.roughnessMap = K.mr(color + '|' + pattern); } }
      detail(m);
    } else { // paper
      let c = color; if (kind === 'metal' || kind === 'chrome') c = '#d9d4ca'; if (kind === 'brass') c = '#e2b33c'; if (kind === 'glass') c = '#cfe9f2';
      m = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : c, map, roughness: 0.93, metalness: 0, side, vertexColors: !!o.vc, flatShading: !!o.flat, emissive: kind === 'bulb' ? new THREE.Color('#ffe2a0') : 0x000000, emissiveIntensity: kind === 'bulb' ? 0.4 : 0 });
      patchMaterial(m, { detail: K.det, detailScale: K.detScale, detailStrength: K.detK, edge: o.edge || 0, bump: K.bump });
    }
    if (o.opacity && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; }
    return (K.cache[key] = m);
  };
  // material for instanced merged multi-tone geometry (vertex colours x instance colour)
  K.IM = (o = {}) => K.M('#ffffff', Object.assign({ vc: true }, o));
  K.edge = (color) => K.M(color, { edge: 0.55 }); // paper cut edge (lighter core)
  return K;
}
function woodTex(K, base) {
  const key = 'wood' + base; if (K.tex[key]) return K.tex[key];
  return (K.tex[key] = canvasTex(256, 256, g => { g.fillStyle = base; g.fillRect(0, 0, 256, 256); const r = rng(hex(base) % 1000 + 3);
    for (let i = 0; i < 50; i++) { const y = r() * 256; g.strokeStyle = `rgba(60,30,10,${r() * 0.12})`; g.lineWidth = r() * 2 + 0.5; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3); g.stroke(); } }));
}
function wearSpots(seed, s, count) { const r = rng(seed), out = []; for (let i = 0; i < count; i++) { let x = r() * s, y = r() * s; if (r() < 0.8) { const side = Math.floor(r() * 4), e = r() * s * 0.04; if (side === 0) x = e; else if (side === 1) x = s - e; else if (side === 2) y = e; else y = s - e; } out.push([x, y, (0.5 + r() * 2.0) * s / 256]); } return out; }
export function drawPattern(g, s, base, acc, pattern) {
  g.fillStyle = base; g.fillRect(0, 0, s, s); g.fillStyle = acc; g.strokeStyle = acc; const n = 8;
  if (pattern === 'stripes') for (let i = 0; i < n; i += 2) g.fillRect(i * s / n, 0, s / n, s);
  else if (pattern === 'hstripes') for (let i = 0; i < n; i += 2) g.fillRect(0, i * s / n, s, s / n);
  else if (pattern === 'wide') for (let i = 0; i < 4; i += 2) g.fillRect(i * s / 4, 0, s / 4, s);
  else if (pattern === 'dots') { for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { g.beginPath(); g.arc((i + 0.5 + (j % 2) * 0.5) * s / 6, (j + 0.5) * s / 6, s / 28, 0, 7); g.fill(); } }
  else if (pattern === 'check') { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) g.fillRect(i * s / n, j * s / n, s / n, s / n); }
  else if (pattern === 'stars') { for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { starPath(g, (i + 0.5 + (j % 2) * 0.5) * s / 5, (j + 0.5) * s / 5, s / 22); g.fill(); } }
  else if (pattern === 'diamond') { for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const x = i * s / 4, y = j * s / 4, d = s / 9; g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.fill(); } }
  else if (pattern === 'scallop') { g.fillRect(0, s * 0.6, s, s * 0.4); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i + 0.5) * s / 6, s * 0.6, s / 12, 0, Math.PI); g.fill(); } }
  else if (pattern === 'waves') { g.lineWidth = s / 40; for (let j = 0; j < 6; j++) { g.beginPath(); for (let x = 0; x <= s; x += 4) g.lineTo(x, (j + 0.5) * s / 6 + Math.sin(x / s * Math.PI * 4) * s / 30); g.stroke(); } }
  else if (pattern === 'leaves') { const r = rng(9); for (let i = 0; i < 70; i++) { g.save(); g.translate(r() * s, r() * s); g.rotate(r() * 6); g.beginPath(); g.ellipse(0, 0, s / 26, s / 60, 0, 0, 7); g.fill(); g.restore(); } }
  else if (pattern === 'gears') { for (const [x, y, r] of [[0.3, 0.32, 0.2], [0.7, 0.62, 0.17], [0.28, 0.78, 0.12], [0.75, 0.18, 0.1]]) { g.beginPath(); const T = 14; for (let i = 0; i < T * 2; i++) { const a = i * Math.PI / T, q = (i % 2 ? 0.82 : 1) * r * s; g.lineTo(x * s + Math.cos(a) * q, y * s + Math.sin(a) * q); } g.fill(); g.fillStyle = base; g.beginPath(); g.arc(x * s, y * s, r * s * 0.3, 0, 7); g.fill(); g.fillStyle = acc; } }
  else if (pattern === 'bricks') { g.lineWidth = s / 90; for (let j = 0; j < 8; j++) { g.beginPath(); g.moveTo(0, j * s / 8); g.lineTo(s, j * s / 8); g.stroke(); for (let i = 0; i < 4; i++) { const x = (i + (j % 2) * 0.5) * s / 4; g.beginPath(); g.moveTo(x, j * s / 8); g.lineTo(x, (j + 1) * s / 8); g.stroke(); } } }
  else if (pattern === 'planks') { g.lineWidth = s / 120; for (let j = 0; j < 8; j++) { g.beginPath(); g.moveTo(0, j * s / 8); g.lineTo(s, j * s / 8); g.stroke(); } }
  else if (pattern === 'sunburst') { for (let i = 0; i < 24; i += 2) { g.beginPath(); g.moveTo(s / 2, s / 2); g.arc(s / 2, s / 2, s, i / 24 * Math.PI * 2, (i + 1) / 24 * Math.PI * 2); g.fill(); } }
  else if (pattern === 'chevron') { g.lineWidth = s / 16; for (let j = -1; j < 5; j++) { g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(i * s / 8, j * s / 4 + (i % 2) * s / 8); g.stroke(); } }
}

// =====================================================================================================
// GROUND painter: draws park ground for a world rectangle at ppm px/m
// =====================================================================================================
const PAVE = { // style colour tweaks per paving id
  felt: { brick_herringbone: '#C2654B', setts_radial: '#D8C8A2', concrete_plaza: '#E2DBCB', asphalt_tinted: '#C48565', boardwalk: '#BC9467', flagstone: '#CDB089', packed_earth: '#CFA676', stamped_pastel: '#F6E2CC', checker: '#EED8B2', queue_concrete: '#D8D0C2', asphalt_grey: '#6B6E73', service: '#9a9a94' },
};
function polyPath(g, poly, X, Y) { poly.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.closePath(); }
function regionsPath(g, regions, X, Y) { g.beginPath(); for (const r of regions) { polyPath(g, r.outer, X, Y); for (const h of r.holes || []) polyPath(g, h, X, Y); } }
export function paintGround(W, rect, ppm, o = {}) {
  const { park, D, S } = W; const w = Math.round((rect.x1 - rect.x0) * ppm), h = Math.round((rect.z1 - rect.z0) * ppm);
  const cv = makeCanvas(w, h); const g = cv.getContext('2d');
  const X = x => (x - rect.x0) * ppm, Y = z => (z - rect.z0) * ppm; const R = rng(77 + Math.round(ppm));
  const grass = S === 'felt' ? '#93C060' : S === 'tin' ? '#62A84A' : '#8FC266';
  const grassD = S === 'felt' ? '#7FAE52' : S === 'tin' ? '#4F9040' : '#7AB056';
  const forest = S === 'felt' ? '#6E9A4A' : S === 'tin' ? '#3F7A3A' : '#6FA052';
  g.fillStyle = forest; g.fillRect(0, 0, w, h);
  // heights -> berm / hills / lawn via a coarse grid canvas
  { const step = 2; const gw = Math.ceil((rect.x1 - rect.x0) / step), gh = Math.ceil((rect.z1 - rect.z0) / step); const c2 = makeCanvas(gw, gh); const g2 = c2.getContext('2d'); const id = g2.createImageData(gw, gh);
    const cg = new THREE.Color(grass), cb = new THREE.Color(S === 'tin' ? '#5A9A44' : '#86B456'), cf = new THREE.Color(forest), tmp = new THREE.Color();
    const B = D.meta.park_bounds_inside_berm;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = rect.x0 + (i + .5) * step, z = rect.z0 + (j + .5) * step; const hh = park.heightAt(x, z);
      const inside = x > B.xmin - 2 && x < B.xmax + 2 && z > B.zmin - 2 && z < B.zmax + 2;
      if (hh > 0.4) tmp.copy(cb).lerp(cf, clamp((hh - 0.4) / 8) * 0.4); else if (inside) tmp.copy(cg); else tmp.copy(cf);
      const sh = 1 + (vnoise(x / 9, z / 9, 2) - 0.5) * 0.12; const k = (j * gw + i) * 4; id.data[k] = tmp.r * 255 * sh; id.data[k + 1] = tmp.g * 255 * sh; id.data[k + 2] = tmp.b * 255 * sh; id.data[k + 3] = 255; }
    g2.putImageData(id, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(c2, 0, 0, w, h); }
  // mown lawn stripes 3 m (inside berm)
  { const B = D.meta.park_bounds_inside_berm; g.save(); g.beginPath(); g.rect(X(B.xmin), Y(B.zmin), (B.xmax - B.xmin) * ppm, (B.zmax - B.zmin) * ppm); g.clip();
    g.fillStyle = S === 'tin' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.05)'; for (let x = Math.floor(B.xmin / 6) * 6; x < B.xmax; x += 6) g.fillRect(X(x), 0, 3 * ppm, h);
    if (S === 'tin') { g.fillStyle = 'rgba(30,70,30,0.18)'; const st = Math.max(3, ppm * 0.9); for (let y = 0; y < h; y += st) for (let x = ((y / st) % 2) * st / 2; x < w; x += st) g.fillRect(x, y, Math.max(1, ppm * 0.12), Math.max(1, ppm * 0.12)); }
    g.restore(); }
  // wildflowers on the berm / meadow speckle
  if (ppm >= 3) { const n = Math.min(200000, w * h / (ppm * ppm) * 0.25); const cols = ['#ffffff', '#f7e36b', '#f2a0c0', '#c9a0e8', '#ffd27a'];
    for (let i = 0; i < n; i++) { const x = rect.x0 + R() * (rect.x1 - rect.x0), z = rect.z0 + R() * (rect.z1 - rect.z0); const hh = park.heightAt(x, z); if (hh < 0.8 || R() < 0.6) continue; g.fillStyle = cols[(R() * 5) | 0]; g.fillRect(X(x), Y(z), Math.max(1, ppm * 0.25), Math.max(1, ppm * 0.25)); } }
  // parking + backstage
  { const pk = D.parking; g.fillStyle = S === 'felt' ? '#6E7176' : '#55585C'; g.beginPath(); polyPath(g, pk.lot.polygon, X, Y); g.fill();
    g.strokeStyle = '#F2F2F2'; g.lineWidth = Math.max(1, 0.12 * ppm); for (const az of pk.aisles_z) { for (let x = -232; x <= 232; x += 2.6) { g.beginPath(); g.moveTo(X(x), Y(az - 8)); g.lineTo(X(x), Y(az - 3)); g.moveTo(X(x), Y(az + 3)); g.lineTo(X(x), Y(az + 8)); g.stroke(); } }
    const bs = D.backstage; g.fillStyle = '#8A8A84'; g.beginPath(); polyPath(g, bs.compound.polygon, X, Y); g.fill();
    g.strokeStyle = '#8A8A84'; g.lineWidth = bs.service_road.width * ppm; g.lineJoin = 'round'; g.beginPath(); bs.service_road.points.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke(); }
  // shrub zones (darker planting beds)
  g.fillStyle = S === 'tin' ? '#3E7A36' : '#5F8E42'; for (const zp of D.planting.shrub_zones) { g.beginPath(); polyPath(g, zp, X, Y); g.fill(); }
  // railway ballast
  { const tr = park.track('railway'); g.strokeStyle = '#9b968e'; g.lineWidth = 3.2 * ppm; g.lineJoin = 'round'; g.beginPath(); for (let s = 0; s <= tr.length; s += 2) { const p = tr.sample(s).pos; s ? g.lineTo(X(p[0]), Y(p[2])) : g.moveTo(X(p[0]), Y(p[2])); } g.closePath(); g.stroke(); }
  // water bodies
  const waterC = S === 'felt' ? '#6FB3DA' : S === 'tin' ? '#3F86C0' : '#6CB8DE'; const waterE = S === 'felt' ? '#4E93BE' : S === 'tin' ? '#2C5F99' : '#4A97C4';
  for (const wb of D.water) {
    if (wb.kind === 'island') continue; g.fillStyle = waterC; g.strokeStyle = waterE; g.lineWidth = Math.max(1, 0.8 * ppm);
    g.beginPath(); if (wb.polygon) polyPath(g, wb.polygon, X, Y); else if (wb.circle) g.arc(X(wb.circle[0]), Y(wb.circle[1]), wb.circle[2] * ppm, 0, 7); else if (wb.annulus) { g.arc(X(wb.annulus[0]), Y(wb.annulus[1]), wb.annulus[3] * ppm, 0, 7); g.moveTo(X(wb.annulus[0]) + wb.annulus[2] * ppm, Y(wb.annulus[1])); g.arc(X(wb.annulus[0]), Y(wb.annulus[1]), wb.annulus[2] * ppm, 0, 7, true); } else if (wb.circles) for (const c of wb.circles) { g.moveTo(X(c[0]) + c[2] * ppm, Y(c[1])); g.arc(X(c[0]), Y(c[1]), c[2] * ppm, 0, 7); }
    g.fill('evenodd'); g.stroke();
  }
  { const isl = D.water.find(w2 => w2.kind === 'island'); if (isl) { g.fillStyle = '#E9D9A6'; g.beginPath(); polyPath(g, isl.polygon, X, Y); g.fill(); g.fillStyle = grass; g.save(); g.translate(X(0), 0); g.restore(); } }
  // paving
  const PT = D.paths.paving_types; const R2 = rng(5);
  for (const [pav, regions] of Object.entries(D.paths.paving_regions)) {
    const pt = PT[pav]; let c = (PAVE[S] && PAVE[S][pav]) || pt.color; if (S === 'tin') c = mixHex(c, '#ffffff', 0.08);
    g.save(); regionsPath(g, regions, X, Y); g.fillStyle = c; g.fill('evenodd'); g.clip('evenodd');
    paintPaving(g, pav, pt, rect, ppm, X, Y, S, R2, W);
    g.restore();
    // edge: felt stitches / tin printed outline / paper print line
    g.save(); regionsPath(g, regions, X, Y);
    if (S === 'felt') { g.clip('evenodd'); g.strokeStyle = 'rgba(255,248,230,0.9)'; g.lineWidth = Math.max(1, 0.09 * ppm); g.setLineDash([0.45 * ppm, 0.35 * ppm]); g.stroke(); g.setLineDash([]); g.strokeStyle = 'rgba(60,40,20,0.22)'; g.lineWidth = Math.max(1, 0.5 * ppm); g.stroke(); }
    else if (S === 'tin') { g.strokeStyle = '#233a66'; g.lineWidth = Math.max(1, 0.22 * ppm); g.stroke(); g.save(); g.clip('evenodd'); g.strokeStyle = '#f6efe0'; g.lineWidth = Math.max(1, 0.7 * ppm); g.stroke(); g.restore(); }
    else { g.strokeStyle = 'rgba(70,45,25,0.35)'; g.lineWidth = Math.max(1, 0.18 * ppm); g.stroke(); }
    g.restore();
  }
  // kerb outlines (granite / timber)
  g.strokeStyle = S === 'tin' ? '#9aa0a6' : '#A39C90'; g.lineWidth = Math.max(1, 0.25 * ppm); for (const p of D.paths.kerbs.outlines) { g.beginPath(); polyPath(g, p.outer, X, Y); for (const hh of p.holes) polyPath(g, hh, X, Y); g.stroke(); }
  // queue pens floor
  for (const q of D.queues) { g.fillStyle = S === 'tin' ? '#d8d2c6' : '#CFC7B8'; g.beginPath(); polyPath(g, q.polygon, X, Y); g.fill(); if (ppm > 6) { g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 1; for (let k = 0; k < 40; k++) { const a = q.polygon[0], b = q.polygon[2]; } } }
  // flower beds: soil + blooms
  for (const b of D.planting.flower_beds) {
    g.save(); g.beginPath();
    if (b.kind === 'circle') g.arc(X(b.circle[0]), Y(b.circle[1]), b.circle[2] * ppm, 0, 7);
    else if (b.kind === 'annulus') { g.arc(X(b.annulus[0]), Y(b.annulus[1]), b.annulus[3] * ppm, 0, 7); g.moveTo(X(b.annulus[0]) + b.annulus[2] * ppm, Y(b.annulus[1])); g.arc(X(b.annulus[0]), Y(b.annulus[1]), b.annulus[2] * ppm, 0, 7, true); }
    else g.rect(X(b.center[0] - b.w / 2), Y(b.center[1] - b.d / 2), b.w * ppm, b.d * ppm);
    g.fillStyle = S === 'tin' ? '#7a4a2a' : '#8A6446'; g.fill('evenodd'); g.clip('evenodd');
    if (b.kind === 'annulus' && b.pattern && b.pattern.includes('radial')) { const [cx, cz, r0, r1] = b.annulus; for (let k = 0; k < 16; k++) { g.fillStyle = b.mix[k % b.mix.length]; g.beginPath(); g.moveTo(X(cx), Y(cz)); g.arc(X(cx), Y(cz), r1 * ppm, k / 16 * 6.283, (k + 1) / 16 * 6.283); g.fill(); } }
    else if (b.pattern && b.pattern.includes('stripes')) { for (let k = 0; k < 8; k++) { g.fillStyle = b.mix[k % b.mix.length]; g.fillRect(X(b.center[0] - b.w / 2 + k * b.w / 8), Y(b.center[1] - b.d / 2), b.w / 8 * ppm + 1, b.d * ppm); } }
    else if (b.id.startsWith('hub_island')) { g.fillStyle = grass; g.fill(); }
    const n = 0; g.restore();
  }
  if (S === 'paper') { // illustrated-map print: tree canopies with offset shadows, footprints, coaster lines
    const T = D.planting.trees.list, sp = D.planting.species;
    g.fillStyle = 'rgba(30,60,20,0.28)'; for (const [x, , z, si, hh, cr] of T) { if (x < rect.x0 - 10 || x > rect.x1 + 10 || z < rect.z0 - 10 || z > rect.z1 + 10) continue; g.beginPath(); g.arc(X(x + cr * 0.35), Y(z + cr * 0.45), cr * ppm * 0.95, 0, 7); g.fill(); }
    for (const [x, , z, si, hh, cr, cv] of T) { if (x < rect.x0 - 10 || x > rect.x1 + 10 || z < rect.z0 - 10 || z > rect.z1 + 10) continue; g.fillStyle = mixHex(sp[si].colors[cv % sp[si].colors.length], '#c9e39a', 0.2); g.beginPath(); g.arc(X(x), Y(z), cr * ppm * 0.85, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(X(x - cr * 0.25), Y(z - cr * 0.25), cr * ppm * 0.4, 0, 7); g.fill(); }
    for (const b of D.buildings) { if (!b.footprint) continue; g.fillStyle = 'rgba(60,40,30,0.3)'; g.beginPath(); polyPath(g, b.footprint.map(p => [p[0] + 1.2, p[1] + 1.5]), X, Y); g.fill(); g.fillStyle = mixHex(b.wall || '#E8C9A0', '#ffffff', 0.15); g.beginPath(); polyPath(g, b.footprint, X, Y); g.fill(); }
    for (const r of D.rides) { if (!r.position || r.track) continue; const p = r.params || {}; const rad = p.radius || p.platform_radius || p.pool_radius || (p.diameter ? 8 : 0) || (p.w ? Math.max(p.w, p.d) / 2 : 6); g.fillStyle = 'rgba(60,40,30,0.25)'; g.beginPath(); g.arc(X(r.position[0] + 1.2), Y(r.position[2] + 1.5), rad * ppm, 0, 7); g.fill(); g.fillStyle = '#F3E6CC'; g.beginPath(); g.arc(X(r.position[0]), Y(r.position[2]), rad * ppm, 0, 7); g.fill(); g.strokeStyle = '#C8463A'; g.lineWidth = Math.max(1, 0.5 * ppm); g.setLineDash([ppm * 1.5, ppm]); g.stroke(); g.setLineDash([]); }
    for (const [id, c] of [['hero_coaster', '#E23B2E'], ['wooden_coaster', '#8B5E3C'], ['family_coaster', '#2BB3A3'], ['log_flume', '#5AA9D6'], ['river_rapids', '#4B8FBF']]) { const tr = park.track(id); g.strokeStyle = 'rgba(60,40,30,0.25)'; g.lineWidth = Math.max(1, 2.2 * ppm); g.beginPath(); for (let s = 0; s <= tr.length; s += 2) { const p = tr.sample(s).pos; s ? g.lineTo(X(p[0] + 1), Y(p[2] + 1.3)) : g.moveTo(X(p[0] + 1), Y(p[2] + 1.3)); } g.stroke(); g.strokeStyle = c; g.lineWidth = Math.max(1, 1.4 * ppm); g.setLineDash([ppm * 2.5, ppm * 1.2]); g.beginPath(); for (let s = 0; s <= tr.length; s += 2) { const p = tr.sample(s).pos; s ? g.lineTo(X(p[0]), Y(p[2])) : g.moveTo(X(p[0]), Y(p[2])); } g.stroke(); g.setLineDash([]); }
    // compass star + scalloped map border (no text)
    g.strokeStyle = '#C8463A'; g.lineWidth = 2.5 * ppm; g.strokeRect(X(-296), Y(-228), 592 * ppm, 472 * ppm); g.strokeStyle = '#D9A441'; g.lineWidth = 0.8 * ppm; g.strokeRect(X(-292), Y(-224), 584 * ppm, 464 * ppm);
    g.fillStyle = '#C8463A'; starPath(g, X(262), Y(-196), 14 * ppm, 4, 0.3); g.fill(); g.fillStyle = '#F3E6CC'; starPath(g, X(262), Y(-196), 6 * ppm, 4, 0.3); g.fill();
  }
  // style overlay at low frequency (mottle) + paper print grain
  if (S === 'paper') { g.globalAlpha = 0.05; for (let i = 0; i < w * h / 600; i++) { g.fillStyle = R() < 0.5 ? '#fff' : '#000'; g.fillRect(R() * w, R() * h, 2, 2); } g.globalAlpha = 1; }
  if (o.extra) o.extra(g, X, Y, ppm);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
function paintPaving(g, pav, pt, rect, ppm, X, Y, S, R, W) {
  const jc = pt.joint; const lw = Math.max(0.7, 0.04 * ppm);
  const x0 = rect.x0, x1 = rect.x1, z0 = rect.z0, z1 = rect.z1;
  if (ppm < 3) { // low-res: just a hint of texture
    g.globalAlpha = 0.15; g.fillStyle = jc; for (let i = 0; i < (x1 - x0) * (z1 - z0) * 0.02; i++) g.fillRect(X(x0 + R() * (x1 - x0)), Y(z0 + R() * (z1 - z0)), 1, 1); g.globalAlpha = 1; return;
  }
  g.strokeStyle = jc; g.lineWidth = lw; g.fillStyle = jc;
  const vline = (x, za, zb) => { g.moveTo(X(x), Y(za)); g.lineTo(X(x), Y(zb)); }, hline = (z, xa, xb) => { g.moveTo(X(xa), Y(z)); g.lineTo(X(xb), Y(z)); };
  if (pav === 'brick_herringbone') { const m = ppm >= 14 ? 0.4 : 0.8; g.globalAlpha = 0.55; g.beginPath(); for (let z = Math.floor(z0 / m) * m; z < z1; z += m) for (let x = Math.floor(x0 / (2 * m)) * 2 * m; x < x1; x += 2 * m) { const o = ((z / m) % 2 + 2) % 2 * m; g.rect(X(x + o), Y(z), 2 * m * ppm, m * ppm / 2); g.rect(X(x + o + m), Y(z), m * ppm / 2, m * ppm); } g.stroke(); g.globalAlpha = 1;
    // colour variation of bricks
    g.globalAlpha = 0.12; for (let i = 0; i < (x1 - x0) * (z1 - z0) / (m * m) * 0.4; i++) { g.fillStyle = R() < 0.5 ? '#000' : '#fff'; const x = x0 + Math.floor(R() * (x1 - x0) / m) * m, z = z0 + Math.floor(R() * (z1 - z0) / m) * m; g.fillRect(X(x), Y(z), m * ppm, m * ppm / 2); } g.globalAlpha = 1; }
  else if (pav === 'checker') { const m = 1; g.fillStyle = S === 'tin' ? '#D7263D' : '#C9503C'; for (let z = Math.floor(z0); z < z1; z += m) for (let x = Math.floor(x0); x < x1; x += m) if (((x + z) % 2 + 2) % 2) g.fillRect(X(x), Y(z), m * ppm + 0.5, m * ppm + 0.5); }
  else if (pav === 'setts_radial') { g.globalAlpha = 0.45; g.beginPath(); for (let r = 1; r < 90; r += 0.6) { g.moveTo(X(r), Y(0)); g.arc(X(0), Y(0), r * ppm, 0, 7); } g.stroke(); g.globalAlpha = 0.25; g.beginPath(); for (let a = 0; a < 6.283; a += 6.283 / 96) { g.moveTo(X(Math.cos(a) * 16), Y(Math.sin(a) * 16)); g.lineTo(X(Math.cos(a) * 90), Y(Math.sin(a) * 90)); } g.stroke(); g.globalAlpha = 1;
    // compass rose inlay rings
    g.strokeStyle = '#B5563F'; g.lineWidth = 1.0 * ppm; for (const r of [20, 34, 52]) { g.beginPath(); g.arc(X(0), Y(0), r * ppm, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(181,86,63,0.7)'; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; g.beginPath(); g.moveTo(X(Math.cos(a) * 20), Y(Math.sin(a) * 20)); g.lineTo(X(Math.cos(a + 0.08) * 28), Y(Math.sin(a + 0.08) * 28)); g.lineTo(X(Math.cos(a) * 34), Y(Math.sin(a) * 34)); g.lineTo(X(Math.cos(a - 0.08) * 28), Y(Math.sin(a - 0.08) * 28)); g.fill(); } }
  else if (pav === 'concrete_plaza') { g.globalAlpha = 0.4; g.beginPath(); for (let x = Math.floor(x0 / 3) * 3; x < x1; x += 3) vline(x, z0, z1); for (let z = Math.floor(z0 / 3) * 3; z < z1; z += 3) hline(z, x0, x1); g.stroke(); g.globalAlpha = 1; g.fillStyle = 'rgba(181,86,63,0.55)'; for (let z = Math.floor(z0 / 12) * 12; z < z1; z += 12) g.fillRect(0, Y(z), 1e5, 0.6 * ppm); }
  else if (pav === 'stamped_pastel') { const cols = ['#F4A7B9', '#A8D8EA', '#FFE08A', '#B8E0B0', '#C3A6E0']; g.globalAlpha = 0.5; g.beginPath(); for (let x = Math.floor(x0); x < x1; x += 1) vline(x, z0, z1); for (let z = Math.floor(z0); z < z1; z += 1) hline(z, x0, x1); g.stroke(); g.globalAlpha = 1;
    for (let z = Math.floor(z0 / 5) * 5; z < z1; z += 5) for (let x = Math.floor(x0 / 5) * 5; x < x1; x += 5) { const hv = hash1(x * 31 + z * 7); if (hv < 0.45) continue; g.fillStyle = cols[(hv * 50 | 0) % 5]; const k = (hv * 7 | 0) % 3;
      if (k === 0) { g.beginPath(); g.arc(X(x + 2.5), Y(z + 2.5), 1.1 * ppm, 0, 7); g.fill(); } else if (k === 1) { for (let i = 0; i < 3; i++) g.fillRect(X(x + 2), Y(z + 0.5 + i * 1.3), ppm * 0.95, ppm * 0.95); } else { starPath(g, X(x + 2.5), Y(z + 2.5), 1.2 * ppm); g.fill(); } } }
  else if (pav === 'boardwalk') { g.globalAlpha = 0.5; g.beginPath(); for (let z = Math.floor(z0 / 0.3) * 0.3; z < z1; z += 0.3) hline(z, x0, x1); g.stroke(); g.globalAlpha = 0.3; g.beginPath(); for (let z = Math.floor(z0 / 0.3) * 0.3; z < z1; z += 0.3) for (let x = Math.floor(x0 / 4) * 4 + (hash1(z * 9) * 4); x < x1; x += 4) vline(x, z, z + 0.3); g.stroke(); g.globalAlpha = 1; }
  else if (pav === 'flagstone') { g.globalAlpha = 0.6; g.strokeStyle = '#7E8C55'; g.beginPath(); for (let z = Math.floor(z0 / 0.9) * 0.9; z < z1; z += 0.9) { hline(z + (hash1(z) - .5) * 0.2, x0, x1); for (let x = Math.floor(x0); x < x1; x += 0.7 + hash1(x * 3 + z) * 0.8) vline(x, z, z + 0.9); } g.stroke(); g.globalAlpha = 1; }
  else if (pav === 'packed_earth') { g.globalAlpha = 0.18; for (let i = 0; i < (x1 - x0) * (z1 - z0) * 0.6; i++) { g.fillStyle = R() < 0.5 ? '#6b4a2e' : '#f0d9b0'; g.fillRect(X(x0 + R() * (x1 - x0)), Y(z0 + R() * (z1 - z0)), ppm * 0.2, ppm * 0.2); } g.globalAlpha = 1; }
  else if (pav === 'asphalt_tinted' || pav === 'queue_concrete') { g.globalAlpha = 0.12; for (let i = 0; i < (x1 - x0) * (z1 - z0) * 0.8; i++) { g.fillStyle = R() < 0.5 ? '#000' : '#fff'; g.fillRect(X(x0 + R() * (x1 - x0)), Y(z0 + R() * (z1 - z0)), Math.max(1, ppm * 0.08), Math.max(1, ppm * 0.08)); } g.globalAlpha = 1; }
}

// =====================================================================================================
// GEOMETRY KIT per style (rounded / crisp / riveted)
// =====================================================================================================
export function geoKit(S) {
  const G = {};
  G.box = (w, h, d, r) => S === 'felt' ? new RoundedBoxGeometry(w, h, d, 3, r ?? Math.min(w, h, d) * 0.3) : S === 'tin' ? new RoundedBoxGeometry(w, h, d, 1, r ?? Math.min(w, h, d) * 0.08) : new THREE.BoxGeometry(w, h, d);
  G.cyl = (rt, rb, h, seg = 16, open = false) => { const g = new THREE.CylinderGeometry(rt, rb, h, S === 'paper' ? Math.max(6, Math.round(seg * 0.6)) : seg, S === 'felt' ? 3 : 1, open); return g; };
  G.sph = (r, seg = 16) => S === 'felt' ? lumpySphere(r, seg > 12 ? 3 : 2, 0.06, 1.6, r * 10) : new THREE.SphereGeometry(r, S === 'paper' ? Math.max(6, seg >> 1) : seg, S === 'paper' ? Math.max(4, seg >> 2) : Math.round(seg * 0.7));
  G.cone = (r, h, seg = 16) => new THREE.ConeGeometry(r, h, S === 'paper' ? Math.max(6, seg >> 1) : seg, S === 'felt' ? 3 : 1);
  return G;
}

// =====================================================================================================
// TREES (instanced, LOD by world rectangle)
// =====================================================================================================
const SHAPE = { oak: 'round', plane: 'oval', lime_clipped: 'boxhead', pine: 'pine', fir: 'cone', palm: 'palm', jungle_broadleaf: 'umbrella', banana: 'banana', birch: 'birch', cherry_blossom: 'round', cypress: 'column', willow: 'weep', maple_red: 'round' };
function treeGeos(S, shape, hi) {
  // returns [{geo (unit tree ~ height 1, crown radius 1 in xz), part:'crown'|'trunk'}]  geometry in units: x,z scaled by crownR, y by height
  const out = []; const det = hi ? 2 : 1;
  const crown = (g) => out.push({ geo: g, part: 'crown' }), trunk = (g) => out.push({ geo: g, part: 'trunk' });
  const lump = (r, d, seed) => S === 'felt' ? lumpySphere(r, d, 0.14, 1.4, seed) : S === 'tin' ? new THREE.SphereGeometry(r, hi ? 20 : 10, hi ? 14 : 7) : new THREE.IcosahedronGeometry(r, 0);
  const trunkG = (h, r0, r1) => { const g = new THREE.CylinderGeometry(r1, r0, h, hi ? 8 : 5); g.translate(0, h / 2, 0); return g; };
  if (S === 'paper') { // cross cards: two perpendicular cut silhouettes, two-tone layered
    const card = (pts, c, z) => { const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, z - 0.006); return tint(g, c); };
    const blob = (cx, cy, rx, ry, n, seed) => { const r = rng(seed); const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const k = 1 + (r() - 0.5) * 0.25 + (i % 2 ? 0.08 : -0.04); p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); } return p; };
    let back, front;
    if (shape === 'cone' || shape === 'pine' || shape === 'column') { const w = shape === 'column' ? 0.45 : 1; back = [[-w, 0.18], [w, 0.18], [0.55 * w, 0.45], [0.75 * w, 0.45], [0.3 * w, 0.75], [0.45 * w, 0.75], [0, 1.0], [-0.45 * w, 0.75], [-0.3 * w, 0.75], [-0.75 * w, 0.45], [-0.55 * w, 0.45]]; front = [[-0.6 * w, 0.3], [0.6 * w, 0.3], [0, 0.85]]; }
    else if (shape === 'palm' || shape === 'banana') { back = []; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.1 + 0.8 * i / 8); back.push([Math.cos(a) * 1.0, 0.82 + Math.sin(a) * 0.25], [Math.cos(a + 0.1) * 0.25, 0.86 + Math.sin(a + 0.1) * 0.08]); } front = blob(0, 0.86, 0.12, 0.1, 8, 3); }
    else { back = blob(0, 0.62, 1, 0.4, 18, shape.length); front = blob(-0.15, 0.68, 0.6, 0.24, 14, 7); }
    const parts = [];
    for (const ry of [0, Math.PI / 2]) { const a = card(back, '#c8c8c8', 0), b = card(front, '#ffffff', 0.03), b2 = card(front.map(p => [p[0] * 0.9 + 0.2, p[1] - 0.05]), '#ffffff', -0.03); for (const g of [a, b, b2]) { g.rotateY(ry); parts.push(g); } }
    crown(merge(parts));
    const tk = merge([card([[-0.06, 0], [0.06, 0], [0.04, 0.5], [-0.04, 0.5]], '#ffffff', -0.02).rotateY(0), card([[-0.06, 0], [0.06, 0], [0.04, 0.5], [-0.04, 0.5]], '#ffffff', -0.02).rotateY(Math.PI / 2)]); trunk(tk);
    return out;
  }
  // felt / tin 3D trees; crowns in unit space then scaled (x,z by crown radius, y by height)
  const C = [];
  if (shape === 'round' || shape === 'oval' || shape === 'birch' || shape === 'umbrella' || shape === 'weep') {
    const ov = shape === 'oval' || shape === 'birch' ? 1.35 : 1; const R = rng(shape.length * 7);
    const n = hi ? (shape === 'umbrella' ? 6 : 5) : 2;
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + R(); const rr = i === 0 ? 0 : 0.42; const s = (i === 0 ? 0.75 : 0.55 + R() * 0.15) * 0.86;
      const g = lump(s, det, i * 3 + shape.length); g.scale(1, (shape === 'umbrella' ? 0.55 : 0.85) * ov * 0.45, 1); g.translate(Math.cos(a) * rr, (shape === 'umbrella' ? 0.82 : 0.62) + (i === 0 ? 0.08 : (R() - 0.3) * 0.15), Math.sin(a) * rr); C.push(g); }
    if (shape === 'weep') { for (let i = 0; i < (hi ? 10 : 5); i++) { const a = i / (hi ? 10 : 5) * 6.283; const g = new THREE.CylinderGeometry(0.16, 0.06, 0.6, 5); g.translate(Math.cos(a) * 0.8, 0.4, Math.sin(a) * 0.8); C.push(g); } }
  } else if (shape === 'cone' || shape === 'pine') {
    if (shape === 'pine') { for (let i = 0; i < (hi ? 3 : 1); i++) { const g = lump(0.7, det, i + 9); g.scale(1, 0.45, 1); g.translate((i - 1) * 0.35, 0.82 + (i % 2) * 0.08, (i % 2) * 0.2); C.push(g); } }
    else { for (let i = 0; i < (hi ? 4 : 2); i++) { const k = i / (hi ? 4 : 2); const g = new THREE.ConeGeometry(1 - k * 0.55, 0.42, hi ? 16 : 8, 1); g.translate(0, 0.3 + k * 0.55, 0); C.push(g); } }
  } else if (shape === 'column') { const g = lump(0.5, det, 4); g.scale(1, 0.8, 1); g.translate(0, 0.55, 0); C.push(g); }
  else if (shape === 'boxhead') { const g = S === 'felt' ? new RoundedBoxGeometry(1.5, 0.45, 1.5, 3, 0.2) : new RoundedBoxGeometry(1.5, 0.45, 1.5, 1, 0.06); g.translate(0, 0.72, 0); C.push(g); }
  else if (shape === 'palm' || shape === 'banana') { const n = hi ? 9 : 5; for (let i = 0; i < n; i++) { const a = i / n * 6.283; const g = S === 'felt' ? lumpySphere(0.5, 1, 0.1, 2, i) : new THREE.SphereGeometry(0.5, 8, 5); g.scale(1.1, 0.12, 0.32); g.translate(0.55, 0, 0); g.rotateZ(-0.35); g.rotateY(a); g.translate(0, shape === 'banana' ? 0.6 : 0.92, 0); C.push(g); } }
  crown(merge(C));
  if (shape === 'palm') { const pts = []; for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3(Math.sin(i / 6 * 1.2) * 0.15, i / 6 * 0.92, 0)); trunk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.035, 6)); }
  else trunk(trunkG(shape === 'banana' ? 0.6 : shape === 'boxhead' ? 0.62 : 0.55, 0.06, 0.035));
  if (S === 'tin' && hi) { const base = new THREE.CylinderGeometry(0.28, 0.32, 0.04, 16); base.translate(0, 0.02, 0); trunk(base); } // toy stand
  return out;
}
export function buildTrees(W) {
  const { D, S, K, lodOf, group } = W; const sp = D.planting.species; const T = D.planting.trees.list;
  const sets = {}; // key shape|lod -> {crownItems, trunkItems}
  T.forEach((t, idx) => {
    const [x, gy, z, si, h, cr, cv] = t; const s = sp[si]; const shape = SHAPE[s.id] || 'round'; const lod = lodOf(x, z); if (lod > 2) return;
    const key = shape + '|' + (lod === 0 ? 'hi' : 'lo');
    if (!sets[key]) sets[key] = { shape, hi: lod === 0, crown: [], trunk: [] };
    const ry = hash1(idx * 1.7) * 6.283; let col = s.colors[cv % s.colors.length]; if (S === 'tin') col = mixHex(col, '#2f7a3a', 0.15); if (S === 'paper') col = mixHex(col, '#c9e39a', 0.28);
    const crW = S === 'paper' ? cr * 1.1 : cr; const base = { x, z, idx, land: null, cat: 'tree' };
    sets[key].crown.push(Object.assign({ p: [x, gy, z], ry: S === 'paper' ? hash1(idx) * 0.6 - 0.3 + 0.35 : ry, s: [crW, h, crW], c: col }, base));
    const trunkC = s.id === 'birch' ? '#EDEBE3' : s.id === 'plane' ? '#9C8B6E' : s.id === 'palm' ? '#A98458' : (S === 'tin' ? '#7a4f2e' : '#6B4A2E');
    sets[key].trunk.push(Object.assign({ p: [x, gy, z], ry: S === 'paper' ? hash1(idx) * 0.6 - 0.3 + 0.35 : ry, s: [Math.max(crW, 2) * (S === 'paper' ? 0.6 : 1), h, Math.max(crW, 2) * (S === 'paper' ? 0.6 : 1)], c: trunkC }, base));
  });
  const out = [];
  for (const [key, st] of Object.entries(sets)) {
    const gs = treeGeos(S, st.shape, st.hi);
    for (const { geo, part } of gs) {
      const mat = S === 'paper' ? K.IM() : (S === 'tin' && part === 'crown' ? K.M('#ffffff', { vc: !!geo.attributes.color, pattern: 'leaves', acc: '#8fb87a', border: false, wear: false }) : K.IM({ kind: part === 'trunk' && S === 'tin' ? 'wood' : 'base' }));
      if (!geo.attributes.color) tint(geo, '#ffffff');
      const inst = new Inst(geo.attributes.color ? geo : tint(geo, '#fff'), mat, part === 'crown' ? st.crown : st.trunk, { cast: true });
      inst.mesh.userData = { cat: 'tree', part, hi: st.hi, fuzz: st.hi }; group('trees').add(inst.mesh); out.push(inst);
    }
  }
  W.sets.trees = out; return out;
}

// =====================================================================================================
// WATER surfaces
// =====================================================================================================
export function buildWater(W) {
  const { D, S, K, group } = W; const out = [];
  const wm = S === 'felt' ? K.M('#6FB3DA', { pattern: 'waves', acc: '#9ED0EC', stitch: false, rep: [1 / 14, 1 / 14] }) : S === 'tin' ? K.M('#3F86C0', { pattern: 'scallop', acc: '#2C5F99', border: false, rep: [1 / 6, 1 / 6] }) : K.M('#6CB8DE', { pattern: 'waves', acc: '#93CFEA', rep: [1 / 16, 1 / 16] });
  for (const wb of D.water) {
    if (wb.kind === 'island' || wb.kind === 'lake' && S === 'paper' && W.flatPaper) continue;
    let geo = null; const y = wb.level + (S === 'paper' ? 0.0 : 0);
    const shp = poly => new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1])));
    if (wb.polygon) geo = new THREE.ShapeGeometry(shp(wb.polygon), 4);
    else if (wb.circle) { geo = new THREE.CircleGeometry(wb.circle[2], 40); geo.translate(wb.circle[0], -wb.circle[1], 0); }
    else if (wb.annulus) { geo = new THREE.RingGeometry(wb.annulus[2], wb.annulus[3], 64); geo.translate(wb.annulus[0], -wb.annulus[1], 0); }
    else if (wb.circles) { geo = merge(wb.circles.map(c => new THREE.CircleGeometry(c[2], 32).translate(c[0], -c[1], 0))); }
    if (!geo) continue; geo.rotateX(-Math.PI / 2); geo.translate(0, S === 'paper' ? Math.max(0.05, y + 0.6) : y, 0);
    const m = new THREE.Mesh(geo, wm); m.receiveShadow = true; m.userData.cat = 'water'; group('water').add(m); out.push(m);
  }
  // island as raised land
  const isl = D.water.find(w2 => w2.kind === 'island'); if (isl) { const sh = new THREE.Shape(isl.polygon.map(p => new THREE.Vector2(p[0], -p[1]))); const g = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: S === 'felt', bevelSize: 0.6, bevelThickness: 0.4, bevelSegments: 2 }); g.rotateX(-Math.PI / 2); g.translate(0, -0.6, 0); const m = new THREE.Mesh(g, K.M(S === 'tin' ? '#62A84A' : '#93C060')); m.receiveShadow = m.castShadow = true; group('water').add(m); }
  // fountain jets
  const jets = [];
  for (const wb of D.water) if (wb.jets) { const n = typeof wb.jets === 'number' ? wb.jets : (wb.jets.count || 8);
    const cs = wb.annulus ? [[wb.annulus[0], wb.annulus[1], (wb.annulus[2] + wb.annulus[3]) / 2]] : wb.circle ? [[wb.circle[0], wb.circle[1], wb.circle[2] * 0.4]] : (wb.circles || []).map(c => [c[0], c[1], c[2] * 0.3]);
    for (const [cx, cz, r] of cs) for (let k = 0; k < n; k++) { const a = k / n * 6.283; jets.push({ p: [cx + Math.cos(a) * r, wb.level, cz + Math.sin(a) * r], ry: -a, s: [1, wb.annulus ? 3 : 2.2, 1], c: '#ffffff', x: cx, z: cz }); } }
  if (jets.length) { const jg = S === 'felt' ? lumpySphere(0.3, 1, 0.2, 2, 1).scale(0.8, 1, 0.8).translate(0, 0.5, 0) : new THREE.CylinderGeometry(0.06, 0.25, 1, 8).translate(0, 0.5, 0);
    const jm = S === 'tin' ? K.M('#d8eef8', { kind: 'glass' }) : K.M('#e6f4fb', { opacity: S === 'paper' ? 1 : 0.9 });
    const ji = new Inst(jg, jm, jets, { cast: false }); group('water').add(ji.mesh); W.sets.jets = ji; }
  return out;
}

// =====================================================================================================
// PROPS (instanced merged multi-tone geometry)
// =====================================================================================================
export function buildProps(W) {
  const { D, S, K, lodOf, group } = W; const G = geoKit(S); const pr = D.props;
  const add = (name, geo, items, o = {}) => { if (!items.length) return null; if (!geo.attributes.color) geo = tint(geo, '#ffffff'); const inst = new Inst(geo, o.mat || K.IM(o.mo || {}), items, { cast: o.cast !== false }); inst.mesh.userData = { cat: name, hi: o.hi ?? (items.filter(i => lodOf(i.x ?? i.p[0], i.z ?? i.p[2]) === 0).length > items.length * 0.5) }; group(o.group || 'props').add(inst.mesh); W.sets[name] = inst; return inst; };
  const near = (x, z, L = 0) => lodOf(x, z) <= L;
  const B = (w, h, d, c, p = [0, 0, 0], r = [0, 0, 0]) => tint(xf(G.box(w, h, d), { p, r }), c);
  const Cy = (rt, rb, h, c, p = [0, 0, 0], r = [0, 0, 0], seg = 10) => tint(xf(G.cyl(rt, rb, h, seg), { p, r }), c);
  const Sp = (rad, c, p = [0, 0, 0], sc = [1, 1, 1]) => tint(xf(G.sph(rad, 12), { p, s: sc }), c);
  const Co = (rad, h, c, p = [0, 0, 0], seg = 12) => tint(xf(G.cone(rad, h, seg), { p }), c);
  // ---------------- lamps (by style)
  const lampGeo = {
    victorian_double: () => merge([Cy(0.2, 0.26, 0.6, '#2D4A3A', [0, 0.3, 0]), Cy(0.08, 0.1, 4.0, '#2D4A3A', [0, 2.2, 0]), B(1.5, 0.07, 0.07, '#2D4A3A', [0, 3.9, 0]), ...[-0.7, 0.7].flatMap(x => [B(0.26, 0.38, 0.26, '#FFF2C8', [x, 3.62, 0]), Co(0.24, 0.2, '#2D4A3A', [x, 3.92, 0], 4)]), Sp(0.32, '#5E8C40', [0, 3.35, 0], [1, 0.8, 1]), Sp(0.12, '#E74C3C', [0.18, 3.42, 0.2]), Sp(0.1, '#F1C40F', [-0.2, 3.38, 0.15]), Sp(0.1, '#ffffff', [0.05, 3.4, -0.25]), Sp(0.08, '#D9A441', [0, 4.25, 0])]),
    victorian_triple: () => merge([Cy(0.22, 0.28, 0.7, '#2D4A3A', [0, 0.35, 0]), Cy(0.08, 0.11, 4.6, '#2D4A3A', [0, 2.6, 0]), ...[0, 2.09, 4.19].map(a => Sp(0.22, '#FFF6DC', [Math.cos(a) * 0.5, 4.7, Math.sin(a) * 0.5])), B(1.1, 0.06, 0.06, '#2D4A3A', [0, 4.5, 0]), Sp(0.25, '#FFF6DC', [0, 5.05, 0])]),
    mushroom_pastel: () => merge([Cy(0.14, 0.2, 2.6, '#FFF4E0', [0, 1.3, 0]), tint(xf(new THREE.SphereGeometry(0.65, 14, 7, 0, 6.283, 0, Math.PI / 2), { p: [0, 2.55, 0], s: [1, 0.7, 1] }), '#F4A7B9'), ...[0, 1, 2, 3, 4].map(k => Sp(0.08, '#ffffff', [Math.cos(k * 1.26) * 0.42, 2.82, Math.sin(k * 1.26) * 0.42])), Sp(0.18, '#FFF2C8', [0, 2.45, 0])]),
    seaside_globe: () => merge([Cy(0.07, 0.12, 3.5, '#ffffff', [0, 1.75, 0]), Sp(0.3, '#F4F8FF', [0, 3.75, 0]), tint(xf(new THREE.TorusGeometry(0.3, 0.05, 6, 16), { p: [0, 3.55, 0], r: [Math.PI / 2, 0, 0] }), '#2E86C1')]),
    bamboo_lantern: () => merge([Cy(0.06, 0.07, 3.0, '#C9A66B', [0, 1.5, 0]), Cy(0.2, 0.2, 0.42, '#E67E22', [0.3, 2.5, 0]), B(0.4, 0.05, 0.05, '#C9A66B', [0.15, 2.85, 0])]),
    modern_mast: () => merge([Cy(0.08, 0.12, 6, '#4A4F57', [0, 3, 0]), Cy(0.13, 0.13, 0.5, '#E23B2E', [0, 4.2, 0]), B(0.9, 0.12, 0.32, '#4A4F57', [0.3, 6.0, 0]), B(0.8, 0.03, 0.26, '#F4F4F0', [0.3, 5.93, 0])]),
    timber_lantern: () => merge([B(0.2, 3.5, 0.2, '#7B5E3B', [0, 1.75, 0]), B(0.7, 0.1, 0.1, '#7B5E3B', [0.3, 3.35, 0]), B(0.24, 0.34, 0.24, '#2d2d2d', [0.55, 3.05, 0]), B(0.16, 0.24, 0.16, '#FFE2A0', [0.55, 3.05, 0])]),
    bulb_pole: () => merge([...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => Cy(0.1, 0.1, 0.5, k % 2 ? '#ffffff' : '#D7263D', [0, 0.25 + k * 0.5, 0])), ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => Sp(0.1, '#FFE6A8', [Math.cos(k * 0.785) * 0.4, 5.0, Math.sin(k * 0.785) * 0.4])), Sp(0.16, '#F4B942', [0, 5.2, 0])]),
  };
  const lampsBy = {}; for (const [x, y, z, st] of pr.lamps.list) { if (!near(x, z, 1)) continue; (lampsBy[st] = lampsBy[st] || []).push({ p: [x, y, z], ry: hash1(x * 3 + z) * 6.28, x, z, cat: 'lamp' }); }
  for (const [st, items] of Object.entries(lampsBy)) add('lamps_' + st, (lampGeo[st] || lampGeo.victorian_double)(), items);
  // ---------------- benches, bins, planters, signposts, fountains
  add('benches', merge([...[0, 1, 2, 3].map(k => B(1.8, 0.05, 0.1, '#8E5B3A', [0, 0.45, -0.2 + k * 0.12])), ...[0, 1, 2].map(k => B(1.8, 0.1, 0.05, '#8E5B3A', [0, 0.65 + k * 0.13, -0.33], [0.2, 0, 0])), ...[-0.8, 0.8].flatMap(x => [B(0.08, 0.45, 0.5, '#2D4A3A', [x, 0.22, -0.05]), B(0.08, 0.45, 0.08, '#2D4A3A', [x, 0.75, -0.33])])]), pr.benches.list.filter(b => near(b[0], b[2], 1)).map(([x, y, z, r]) => ({ p: [x, y, z], ry: r, x, z, cat: 'bench' })));
  add('bins', merge([Cy(0.3, 0.27, 0.9, '#2D4A3A', [0, 0.45, 0]), Cy(0.33, 0.33, 0.08, '#D9A441', [0, 0.92, 0]), Sp(0.15, '#2D4A3A', [0, 1.0, 0], [1, 0.5, 1])]), pr.bins.list.filter(b => near(b[0], b[2], 1)).map(([x, y, z]) => ({ p: [x, y, z], x, z, cat: 'bin' })));
  add('planters', merge([Cy(0.5, 0.36, 0.7, '#2D4A3A', [0, 0.35, 0]), Cy(0.52, 0.52, 0.08, '#D9A441', [0, 0.7, 0]), Sp(0.48, '#4F7F3A', [0, 0.85, 0], [1, 0.6, 1]), ...[0, 1, 2, 3, 4, 5, 6].map(k => Sp(0.1, ['#E74C3C', '#F1C40F', '#ffffff', '#9B59B6', '#F5A6C8'][k % 5], [Math.cos(k * 0.9) * 0.32, 1.02 + (k % 2) * 0.05, Math.sin(k * 0.9) * 0.32]))]), pr.planters.list.filter(b => near(b[0], b[2], 1)).map(([x, y, z, st, d]) => ({ p: [x, y, z], s: d / 1.0, ry: x, x, z, cat: 'planter' })));
  add('signposts', merge([Cy(0.07, 0.08, 3.2, '#2D4A3A', [0, 1.6, 0]), Sp(0.12, '#D9A441', [0, 3.3, 0]), B(1.2, 0.3, 0.05, '#F3E6CC', [0.5, 2.7, 0]), B(1.0, 0.3, 0.05, '#2F6E8E', [-0.4, 2.3, 0], [0, 1.2, 0]), B(1.1, 0.3, 0.05, '#C8463A', [0.3, 1.9, 0.2], [0, -0.8, 0])]), pr.signposts.list.filter(b => near(b[0], b[2], 1)).map(([x, y, z]) => ({ p: [x, y, z], ry: hash1(x + z) * 6, x, z, cat: 'sign' })));
  add('fountains_d', merge([Cy(0.25, 0.3, 0.9, '#B7A99A', [0, 0.45, 0]), Cy(0.35, 0.3, 0.12, '#9A948A', [0, 0.95, 0])]), pr.drinking_fountains.list.filter(b => near(b[0], b[2], 1)).map(([x, y, z]) => ({ p: [x, y, z], x, z, cat: 'fountain' })));
  add('baskets', merge([Sp(0.35, '#5E8C40', [0, 0, 0], [1, 0.8, 1]), Sp(0.12, '#E74C3C', [0.2, 0.1, 0.18]), Sp(0.1, '#F1C40F', [-0.2, 0.05, 0.15]), Sp(0.1, '#F5A6C8', [0.05, 0.1, -0.25])]), pr.hanging_baskets.list.filter(b => near(b[0], b[2], 0)).map(([x, y, z]) => ({ p: [x, y, z], x, z, cat: 'basket' })));
  // ---------------- carts
  { const cartTop = { popcorn: '#F1C40F', ice_cream: '#F5A6C8', balloons: '#E74C3C', pretzel: '#D35400', churros: '#E67E22', souvenir: '#9B59B6', cotton_candy: '#F5A6C8', lemonade: '#F7DC6F' };
    const byT = {}; for (const [x, y, z, tp, r] of pr.carts.list) { if (!near(x, z, 1)) continue; (byT[tp] = byT[tp] || []).push({ p: [x, y, z], ry: r, x, z, cat: 'cart' }); }
    for (const [tp, items] of Object.entries(byT)) { const c = cartTop[tp] || '#F4B942';
      const parts = [B(2.2, 1.0, 1.1, '#FFF4E0', [0, 0.95, 0]), B(2.25, 0.25, 1.15, c, [0, 1.35, 0]), ...[-0.7, 0.7].map(x => tint(xf(new THREE.TorusGeometry(0.32, 0.07, 6, 14), { p: [x, 0.35, 0.58] }), '#2E294E')), ...[-0.7, 0.7].map(x => tint(xf(new THREE.TorusGeometry(0.32, 0.07, 6, 14), { p: [x, 0.35, -0.58] }), '#2E294E')),
        Cy(0.03, 0.03, 1.2, '#ffffff', [-1, 2.0, -0.5]), Cy(0.03, 0.03, 1.2, '#ffffff', [1, 2.0, -0.5]), Cy(0.03, 0.03, 1.2, '#ffffff', [-1, 2.0, 0.5]), Cy(0.03, 0.03, 1.2, '#ffffff', [1, 2.0, 0.5]), tint(xf(new THREE.ConeGeometry(1.75, 0.6, 4, 1), { p: [0, 2.85, 0], r: [0, Math.PI / 4, 0], s: [1.0, 1, 0.6] }), c), tint(xf(new THREE.ConeGeometry(1.76, 0.2, 4, 1, true), { p: [0, 2.45, 0], r: [0, Math.PI / 4, 0], s: [1.0, 1, 0.6] }), '#ffffff')];
      if (tp === 'popcorn') parts.push(B(0.9, 0.7, 0.7, '#F7F1D0', [0, 1.85, 0]), Sp(0.4, '#FFF6C8', [0, 2.2, 0], [1.1, 0.5, 0.8]));
      if (tp === 'balloons' || tp === 'cotton_candy') for (let k = 0; k < 7; k++) parts.push(Sp(0.28, ['#E74C3C', '#F1C40F', '#3498DB', '#2ECC71', '#F5A6C8', '#ffffff'][k % 6], [Math.cos(k) * 0.5, 3.4 + (k % 3) * 0.3, Math.sin(k) * 0.3]));
      if (tp === 'ice_cream') parts.push(Co(0.15, 0.4, '#E2B07A', [0.5, 1.75, 0]), Sp(0.18, '#F5A6C8', [0.5, 2.0, 0]));
      add('carts_' + tp, merge(parts), items); } }
  // ---------------- umbrella tables (+4 chairs) & flagpoles
  { const it = pr.umbrella_tables.list.filter(b => near(b[0], b[2], 1)).map(([x, y, z, d, c]) => ({ p: [x, y, z], s: d / 2.8, c, ry: hash1(x * 7 + z) * 6, x, z, cat: 'umbrella' }));
    const furn = merge([Cy(0.45, 0.45, 0.05, '#ffffff', [0, 0.74, 0]), Cy(0.05, 0.08, 0.74, '#cccccc', [0, 0.37, 0]), ...[0, 1, 2, 3].flatMap(k => { const a = k * Math.PI / 2 + 0.4; return [B(0.42, 0.05, 0.42, '#ffffff', [Math.cos(a) * 0.85, 0.45, Math.sin(a) * 0.85]), B(0.42, 0.4, 0.05, '#ffffff', [Math.cos(a) * 1.07, 0.65, Math.sin(a) * 1.07], [0, -a + Math.PI / 2, 0]), B(0.04, 0.45, 0.04, '#cccccc', [Math.cos(a) * 0.85, 0.22, Math.sin(a) * 0.85])]; })]);
    add('table_furn', furn, it.map(i => Object.assign({}, i, { c: undefined })));
    const para = merge([tint(xf(new THREE.ConeGeometry(1.4, 0.55, 8, 1), { p: [0, 2.45, 0] }), '#ffffff'), tint(xf(new THREE.ConeGeometry(1.42, 0.18, 8, 1, true), { p: [0, 2.2, 0] }), '#f6f0e6'), Cy(0.035, 0.035, 2.6, '#f0f0f0', [0, 1.3, 0]), Sp(0.07, '#D9A441', [0, 2.75, 0])]);
    add('parasols', para, it);
    add('flagpoles', Cy(0.06, 0.08, 1, '#EEEEEE', [0, 0.5, 0], [0, 0, 0], 6), pr.flagpoles.list.filter(b => near(b[0], b[2], 1)).map(([x, y, z, h]) => ({ p: [x, y, z], s: [1, h, 1], x, z, cat: 'flag' })));
    const flagG = new THREE.PlaneGeometry(1.6, 1.0, 8, 1); flagG.translate(0.8, 0, 0); const P = flagG.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getX(i) * 2.4) * 0.12 * P.getX(i)); flagG.computeVertexNormals();
    W.flags = add('flags', flagG, pr.flagpoles.list.filter(b => near(b[0], b[2], 1)).map(([x, y, z, h, c]) => ({ p: [x, y + h - 0.6, z], c, x, z, ry: 0.6, cat: 'flag' })), { mo: { side: true } }); }
  // ---------------- fences (posts + rails)
  { const posts = [], rails = [];
    for (const f of pr.fences) for (let i = 0; i < f.points.length - 1; i++) { const a = f.points[i], b = f.points[i + 1]; if (!near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1)) continue; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / 2.4));
      for (let k = 0; k <= n; k++) { const u = k / n; posts.push({ p: [lerp(a[0], b[0], u), 0, lerp(a[1], b[1], u)], s: [1, f.height, 1], x: a[0], z: a[1], cat: 'fence' }); }
      for (const hh of [0.35, 0.95].map(v => v * f.height)) { const bm = beamMatrix([a[0], hh, a[1]], [b[0], hh, b[1]], 0.05); rails.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), x: a[0], z: a[1], cat: 'fence' }); } }
    const fc = S === 'tin' ? '#233a66' : '#3a3a3a';
    add('fence_posts', Cy(0.04, 0.04, 1, fc, [0, 0.5, 0], [0, 0, 0], 5), posts); add('fence_rails', Cy(0.5, 0.5, 1, fc, [0, 0, 0], [0, 0, 0], 5), rails); }
  // ---------------- bunting & string lights
  { const pen = [], strings = [], bulbs = [];
    for (const b of pr.bunting.list) { const mx = (b.a[0] + b.b[0]) / 2, mz = (b.a[2] + b.b[2]) / 2; if (!near(mx, mz, 1)) continue; const L = Math.hypot(b.b[0] - b.a[0], b.b[2] - b.a[2]); const n = Math.round(L / (b.pennant * 1.7 + 0.1)); const pts = W.ParkPlan.sagLine(b.a, b.b, b.sag, n);
      const ry = Math.atan2(b.b[0] - b.a[0], b.b[2] - b.a[2]) + Math.PI / 2;
      for (let k = 0; k < n; k++) pen.push({ p: pts[k].map((v, i) => i === 1 ? v : (v + pts[k + 1][i]) / 2), ry, s: b.pennant / 0.3, c: b.colors[k % b.colors.length], x: mx, z: mz, cat: 'bunting' });
      for (let k = 0; k < n; k++) { const bm = beamMatrix(pts[k], pts[k + 1], 0.03); strings.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), x: mx, z: mz, cat: 'bunting' }); } }
    for (const b of pr.string_lights.list) { const mx = (b.a[0] + b.b[0]) / 2, mz = (b.a[2] + b.b[2]) / 2; if (!near(mx, mz, 1)) continue; const L = Math.hypot(b.b[0] - b.a[0], b.b[2] - b.a[2]); const n = Math.max(2, Math.round(L / b.bulb_spacing)); const pts = W.ParkPlan.sagLine(b.a, b.b, b.sag, n);
      for (let k = 0; k <= n; k++) bulbs.push({ p: [pts[k][0], pts[k][1] - 0.12, pts[k][2]], c: ['#FFE6A8', '#FFD27A', '#FFF2D0', '#F7A8B8', '#A8E0F0'][k % 5], x: mx, z: mz, cat: 'lights' });
      for (let k = 0; k < n; k++) { const bm = beamMatrix(pts[k], pts[k + 1], 0.025); strings.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), x: mx, z: mz, cat: 'lights' }); } }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute([-0.15, 0, 0, 0.15, 0, 0, 0, -0.38, 0], 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2)); pg.computeVertexNormals();
    add('pennants', S === 'felt' ? xf(new RoundedBoxGeometry(0.3, 0.38, 0.06, 1, 0.03), { p: [0, -0.19, 0] }) : pg, pen, { mo: { side: true } });
    add('strings', Cy(0.5, 0.5, 1, '#5a4a3a', [0, 0, 0], [0, 0, 0], 4), strings, { cast: false });
    add('bulbs', new THREE.SphereGeometry(0.09, 8, 6), bulbs, { mat: K.M('#ffffff', { kind: 'bulb', vc: false }), cast: false }); }
  // ---------------- flower bed blooms (hi lod)
  { const blooms = [], stems = [];
    for (const b of D.planting.flower_beds) { const cx = b.circle ? b.circle[0] : b.annulus ? b.annulus[0] : b.center[0], cz = b.circle ? b.circle[1] : b.annulus ? b.annulus[1] : b.center[1]; if (!near(cx, cz, 0)) continue; const R = rng(cx * 13 + cz);
      const inside = (x, z) => b.kind === 'circle' ? Math.hypot(x - cx, z - cz) < b.circle[2] - 0.2 : b.kind === 'annulus' ? (() => { const d = Math.hypot(x - cx, z - cz); return d > b.annulus[2] + 0.2 && d < b.annulus[3] - 0.2; })() : Math.abs(x - cx) < b.w / 2 - 0.2 && Math.abs(z - cz) < b.d / 2 - 0.2;
      const ext = b.circle ? b.circle[2] : b.annulus ? b.annulus[3] : Math.max(b.w, b.d) / 2; const n = Math.min(900, Math.round(ext * ext * 3.5));
      for (let i = 0; i < n; i++) { const x = cx + (R() * 2 - 1) * ext, z = cz + (R() * 2 - 1) * ext; if (!inside(x, z) || b.id.startsWith('hub_island')) continue;
        let c = b.mix[(R() * b.mix.length) | 0]; if (b.kind === 'annulus' && b.pattern && b.pattern.includes('radial')) c = b.mix[Math.floor(((Math.atan2(z - cz, x - cx) + 6.283) % 6.283) / 6.283 * 16) % b.mix.length];
        blooms.push({ p: [x, 0.25 + R() * 0.15, z], s: 0.8 + R() * 0.5, c, x: cx, z: cz, cat: 'flowers' }); stems.push({ p: [x, 0.0, z], s: [1, 0.3 + R() * 0.1, 1], c: '#4F7F3A', x: cx, z: cz, cat: 'flowers' }); } }
    add('blooms', S === 'paper' ? tint(new THREE.CircleGeometry(0.16, 6).rotateX(-1.2), '#fff') : G.sph(0.14, 8), blooms, { cast: false, mo: { side: S === 'paper' } }); add('leaves', S === 'paper' ? tint(xf(new THREE.ConeGeometry(0.2, 1, 4), { p: [0, 0.5, 0] }), '#fff') : tint(xf(G.sph(0.22, 8), { p: [0, 0.6, 0], s: [1, 1.2, 1] }), '#fff'), stems, { cast: false }); }
  // ---------------- hedges, topiary, shrubs
  { const hed = [];
    for (const h of D.planting.hedges) for (let i = 0; i < h.points.length - 1; i++) { const a = h.points[i], b = h.points[i + 1]; if (!near(a[0], a[1], 1)) continue; const bm = beamMatrix([a[0], h.height / 2, a[1]], [b[0], h.height / 2, b[1]], 0.9, 1); const L = bm.s.y;
      hed.push({ p: bm.p.toArray(), q: bm.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0))), s: [0.9, L + 0.3, h.height], c: S === 'tin' ? '#3E7A36' : '#4F8A3E', x: a[0], z: a[1], cat: 'hedge' }); }
    // hedge segments: unit geometry along +y (length), x width, z height -> rotate so local z is up: use box geo oriented (x width, y length, z height)
    add('hedges', S === 'felt' ? new RoundedBoxGeometry(1, 1, 1, 2, 0.35) : S === 'tin' ? new RoundedBoxGeometry(1, 1, 1, 1, 0.12) : new THREE.BoxGeometry(1, 1, 1), hed, { group: 'planting' });
    // fix: hedge beam: rotate local axes so the box's z-extent maps to world up. beamMatrix aligns +y to segment; we need height along world y.
    const T = []; const shapes = { rabbit: [[0, 0.7, 0, 0.75], [0, 1.6, 0, 0.45], [-0.18, 2.15, 0, 0.14, 0.45], [0.18, 2.15, 0, 0.14, 0.45], [0.55, 0.45, 0, 0.25]], elephant: [[0, 1.1, 0, 0.9], [0.95, 1.4, 0, 0.55], [1.35, 0.7, 0, 0.18, 0.6], [-0.5, 0.35, 0.4, 0.25], [0.5, 0.35, 0.4, 0.25], [-0.5, 0.35, -0.4, 0.25], [0.5, 0.35, -0.4, 0.25], [0.9, 1.55, 0.45, 0.35, 0.8, 0.2]], ball_stack: [[0, 0.6, 0, 0.6], [0, 1.45, 0, 0.45], [0, 2.05, 0, 0.3]], swan: [[0, 0.6, 0, 0.75, 0.6], [0.65, 1.3, 0, 0.18, 0.9], [0.85, 1.85, 0, 0.22]], bear: [[0, 0.8, 0, 0.75], [0, 1.75, 0, 0.45], [-0.3, 2.15, 0, 0.15], [0.3, 2.15, 0, 0.15]], cone_spiral: [[0, 0.5, 0, 0.6], [0, 1.25, 0, 0.45], [0, 1.85, 0, 0.32], [0, 2.3, 0, 0.2]] };
    const topi = []; for (const t of D.planting.topiary) { if (!near(t.position[0], t.position[2], 1)) continue; topi.push({ t }); }
    for (const sh of Object.keys(shapes)) { const items = topi.filter(o => o.t.shape === sh).map(o => ({ p: o.t.position, s: o.t.height / 2.2, ry: hash1(o.t.position[0]) * 6, c: S === 'tin' ? '#3E8A3A' : '#4A8A3C', x: o.t.position[0], z: o.t.position[2], cat: 'topiary' })); if (!items.length) continue;
      const g = merge([...shapes[sh].map(([x, y, z, r, sy, sz]) => tint(xf(G.sph(r, 14), { p: [x, y, z], s: [1, sy ?? 1, sz ?? 1] }), '#ffffff')), tint(xf(new THREE.CylinderGeometry(0.7, 0.8, 0.4, 14), { p: [0, 0.2, 0] }), S === 'tin' ? '#B5563F' : '#9A6C48')]);
      add('topiary_' + sh, g, items, { group: 'planting' }); }
    // shrubs: scatter in shrub zones
    const sh = []; let k = 0; for (const zp of D.planting.shrub_zones) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of zp) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const R = rng(++k * 17); const lod = lodOf((x0 + x1) / 2, (z0 + z1) / 2); if (lod > 1) continue; const dens = lod === 0 ? 0.35 : 0.08; const n = Math.min(1500, Math.round((x1 - x0) * (z1 - z0) * dens));
      for (let i = 0; i < n; i++) { const x = lerp(x0, x1, R()), z = lerp(z0, z1, R()); if (!W.ParkPlan.pointInPoly(x, z, zp)) continue; sh.push({ p: [x, 0, z], s: [0.8 + R() * 0.9, 0.7 + R() * 0.6, 0.8 + R() * 0.9], ry: R() * 6, c: ['#4F7F3A', '#5E8C40', '#3F6E33', '#6A9A45'][(R() * 4) | 0], x, z, cat: 'shrub' });
        if (R() < 0.25) sh.push({ p: [x + 0.4, 0.5, z + 0.3], s: 0.35, c: ['#E74C3C', '#F5A6C8', '#ffffff', '#F1C40F'][(R() * 4) | 0], x, z, cat: 'shrub' }); } }
    add('shrubs', tint(xf(S === 'felt' ? lumpySphere(0.8, 2, 0.15, 1.5, 3) : S === 'tin' ? new THREE.SphereGeometry(0.8, 12, 8) : new THREE.IcosahedronGeometry(0.8, 0), { p: [0, 0.5, 0], s: [1, 0.8, 1] }), '#fff'), sh, { group: 'planting' }); }
  // ---------------- queue rails & canopies
  { const posts = [], rails = [], canopies = [], canPosts = [];
    for (const q of D.queues) { if (!near(q.center[0], q.center[1], 1)) continue;
      for (const [a, b] of q.rails) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / (q.post_spacing || 2.2))); for (let k = 0; k <= n; k++) posts.push({ p: [lerp(a[0], b[0], k / n), 0, lerp(a[1], b[1], k / n)], x: q.center[0], z: q.center[1], cat: 'queue' });
        for (const hh of [0.55, 1.0]) { const bm = beamMatrix([a[0], hh, a[1]], [b[0], hh, b[1]], 0.06); rails.push({ p: bm.p.toArray(), q: bm.q, s: bm.s.toArray(), x: q.center[0], z: q.center[1], cat: 'queue' }); } }
      for (const c of q.canopies) { const colr = c.style === 'striped_awning' ? '#E74C3C' : c.style === 'scalloped_awning' ? '#F4A7B9' : c.style === 'thatch' ? '#C9A66B' : c.style.includes('pergola') ? '#8E5B3A' : '#F3E6CC';
        canopies.push({ p: [c.center[0], c.height, c.center[1]], ry: c.rot, s: [c.w, 1, c.d], c: colr, x: q.center[0], z: q.center[1], cat: 'queue' });
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const ca = Math.cos(c.rot), sa = Math.sin(c.rot); const lx = sx * (c.w / 2 - 0.2), lz = sz * (c.d / 2 - 0.2); canPosts.push({ p: [c.center[0] + lx * ca + lz * sa, 0, c.center[1] - lx * sa + lz * ca], s: [1, c.height, 1], x: q.center[0], z: q.center[1], cat: 'queue' }); } } }
    const qc = S === 'tin' ? '#C0C4CA' : '#4a4a4a';
    add('queue_posts', merge([Cy(0.04, 0.04, 1.05, qc, [0, 0.52, 0], [0, 0, 0], 6), Sp(0.06, qc, [0, 1.07, 0])]), posts, { mo: { kind: S === 'tin' ? 'chrome' : 'base' } });
    add('queue_rails', Cy(0.5, 0.5, 1, qc, [0, 0, 0], [0, 0, 0], 5), rails, { mo: { kind: S === 'tin' ? 'chrome' : 'base' } });
    const canG = merge([tint(xf(new THREE.PlaneGeometry(1, 1, 6, 1), { r: [-Math.PI / 2, 0, 0] }), '#fff'), ...[-0.5, 0.5].map(z => tint(xf(new THREE.PlaneGeometry(1, 0.12), { p: [0, -0.06, z], r: [0, z > 0 ? 0 : Math.PI, 0] }), '#fff'))]);
    const Pc = canG.attributes.position; for (let i = 0; i < Pc.count; i++) Pc.setY(i, Pc.getY(i) - Math.abs(Math.sin(Pc.getX(i) * Math.PI * 3)) * 0.08);
    canG.computeVertexNormals();
    add('queue_canopies', canG, canopies, { mo: { side: true, pattern: S === 'paper' ? 'plain' : 'plain' } }); add('queue_canposts', Cy(0.06, 0.06, 1, '#ffffff', [0, 0.5, 0], [0, 0, 0], 6), canPosts); }
  // ---------------- parking cars
  { const cars = D.parking.cars.list.filter(c => near(c[0], c[1], 1)).map(([x, z, r, ci]) => ({ p: [x, 0, z], ry: r, c: D.parking.car_colors[ci], x, z, cat: 'car' }));
    const cg = merge([B(1.8, 0.75, 4.3, '#ffffff', [0, 0.55, 0]), B(1.55, 0.55, 2.2, '#ffffff', [0, 1.15, -0.2]), B(1.58, 0.42, 2.0, '#2a3440', [0, 1.15, -0.2]), ...[[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]].map(([x, z]) => Cy(0.32, 0.32, 0.22, '#1c1c1c', [x, 0.32, z], [0, 0, Math.PI / 2], 10))]);
    add('cars', cg, cars, { group: 'parking' }); }
}

// =====================================================================================================
// GUESTS: little people with walking limbs (hi LOD) or simple figures (lo LOD)
// =====================================================================================================
const SKIN = ['#F3D2B5', '#E8BC98', '#C99068', '#9A6845', '#704A32', '#F6DCC8'];
const HAIR = ['#2B1D14', '#5A3A22', '#8A5A2E', '#D9B56A', '#1C1C1C', '#A0522D', '#E8D8B0'];
const PANTS = ['#2F4A73', '#1C2833', '#5D6D7E', '#C9B48A', '#3E5F8A', '#F3E6CC', '#6B4A2E'];
export function buildGuests(W) {
  const { D, S, K, lodOf, group, park } = W; const G = geoKit(S); const pal = D.guests.clothes_palette;
  const GU = []; // {kind:'walk'|'idle'|'queue'|'seat', idx, x,z,heading, ci, child, balloon, hi}
  const W0 = park.guestsAt(0).walkers;
  D.guests.walkers.list.forEach((w, i) => GU.push({ kind: 'walk', i, ci: w[5], child: w[6], x: W0[5 * i], z: W0[5 * i + 1], speed: w[3] }));
  D.guests.idlers.list.forEach(([x, z, h, ci, ch, bal], i) => GU.push({ kind: 'idle', x, z, h, ci, child: ch, balloon: bal }));
  const qpoly = {}; for (const q of D.queues) qpoly[q.id] = q.polyline;
  D.guests.queued.list.forEach(([qid, x, z, j, ci, ch]) => { const pl = qpoly[qid]; let best = 1e9, hd = 0; if (pl) for (let k = 0; k < pl.length - 1; k++) { const a = pl[k], b = pl[k + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1; const u = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2); const d = Math.hypot(a[0] + dx * u - x, a[1] + dz * u - z); if (d < best) { best = d; hd = Math.atan2(-dx, -dz); } } GU.push({ kind: 'queue', x, z, h: hd + j, ci, child: ch }); });
  // seated: 50% benches + 2 per umbrella table (hi lod only)
  D.props.benches.list.forEach(([x, y, z, r], i) => { if (hash1(i * 3.3) < 0.5) GU.push({ kind: 'seat', x: x + Math.sin(r) * 0.05 + Math.cos(r) * (hash1(i) - 0.5) * 0.8, z: z + Math.cos(r) * 0.05 - Math.sin(r) * (hash1(i) - 0.5) * 0.8, h: r, ci: (i * 7) % pal.length, child: hash1(i * 9) < 0.2, seatY: 0.45 }); });
  D.props.umbrella_tables.list.forEach(([x, y, z], i) => { for (const k of [0, 2]) { const a = k * Math.PI / 2 + 0.4 + hash1(x * 7 + z) * 6; GU.push({ kind: 'seat', x: x + Math.cos(a) * 0.85, z: z + Math.sin(a) * 0.85, h: Math.atan2(-Math.cos(a), -Math.sin(a)), ci: (i * 3 + k) % pal.length, child: hash1(i + k) < 0.3, seatY: 0.45 }); } });
  GU.forEach((g, i) => { g.id = i; g.hi = lodOf(g.x, g.z) === 0; const r = rng(i * 7919 + 13); g.skin = SKIN[(r() * SKIN.length) | 0]; g.hair = HAIR[(r() * HAIR.length) | 0]; g.pants = PANTS[(r() * PANTS.length) | 0]; g.hat = r() < 0.25; g.hatC = pal[(r() * pal.length) | 0]; g.h = g.h ?? 0;
    g.height = g.child ? 1.0 + r() * 0.3 : 1.6 + r() * 0.25; g.phase = r() * 6.283; g.stroller = g.kind === 'walk' && !g.child && r() < 0.04; if (g.kind === 'walk' && g.child && r() < 0.15) g.balloon = 1; g.balC = ['#E74C3C', '#F1C40F', '#3498DB', '#2ECC71', '#F5A6C8', '#9B59B6'][(r() * 6) | 0]; g.shorts = r() < 0.3; g.dress = !g.child && r() < 0.18; });
  W.guests = GU;
  const hiG = GU.filter(g => g.hi && lodOf(g.x, g.z) <= 0), loG = GU.filter(g => !g.hi && lodOf(g.x, g.z) <= 1 && g.kind !== 'seat');
  // ---- part geometry (unit adult 1.7 m)
  const parts = [];
  const P = (name, geo, colorOf, pivot, list, o = {}) => { if (!list.length) return; if (!geo.attributes.color) geo = tint(geo, '#fff'); const items = list.map(g => ({ p: [g.x, 0, g.z], c: colorOf(g), g })); const inst = new Inst(geo, o.mat || K.IM(o.mo || {}), items, { cast: o.cast !== false }); inst.mesh.userData = { cat: 'guest', hi: list.every(g => g.hi) }; group('guests').add(inst.mesh); parts.push({ name, inst, pivot, swing: o.swing || 0, list }); };
  if (S === 'paper') {
    const card = (pts, z = 0) => { const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, z); return g; };
    const circ = (cx, cy, r, n = 10) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * 6.283; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
    const body = card([[-0.2, 0.78], [0.2, 0.78], [0.25, 1.2], [0.2, 1.42], [-0.2, 1.42], [-0.25, 1.2]], 0.01), legs = card([[-0.17, 0], [-0.03, 0], [0, 0.6], [0.03, 0], [0.17, 0], [0.19, 0.82], [-0.19, 0.82]], 0.0), head = card(circ(0, 1.58, 0.15), 0.02), hair = card(circ(0, 1.62, 0.155, 10).filter((p, i) => p[1] > 1.6), 0.025);
    const all = hiG.concat(loG);
    P('legs', legs, g => g.pants, null, all); P('body', body, g => pal[g.ci], null, all); P('head', head, g => g.skin, null, all); P('hair', card([...circ(0, 1.6, 0.16, 12).filter(p => p[1] >= 1.6), [-0.16, 1.56], [0.16, 1.56]], 0.035), g => g.hair, null, all);
    const bal = all.filter(g => g.balloon); P('balloon', merge([tint(card(circ(0.3, 2.55, 0.22, 12), 0.04), '#fff'), tint(card([[0.29, 1.3], [0.31, 1.3], [0.31, 2.34], [0.29, 2.34]], 0.04), '#eeeeee')]), g => g.balC, null, bal);
  } else {
    const tin = S === 'tin'; const sk = tin ? K.M('#ffffff', { kind: 'skin', vc: true }) : K.IM();
    // legs: pivot at hip (y .82), geometry hangs down
    const leg = tin ? null : xf(G.cyl(0.075, 0.07, 0.8, 8), { p: [0, -0.4, 0] }); if (leg) merge;
    if (tin) { // peg dolls: one turned body (two-tone painted), ball head
      const prof = []; [[0, 0], [0.2, 0], [0.21, 0.08], [0.17, 0.5], [0.19, 0.78], [0.2, 1.05], [0.16, 1.3], [0.08, 1.38], [0, 1.4]].forEach(([r, y]) => prof.push(new THREE.Vector2(r, y)));
      const lat = new THREE.LatheGeometry(prof, 16); const n = lat.attributes.position.count; const cc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const y = lat.attributes.position.getY(i); const k = y < 0.72 ? 0.45 : y > 1.28 ? 1.6 : 1.0; cc[3 * i] = cc[3 * i + 1] = cc[3 * i + 2] = Math.min(1, k); if (y > 1.28) { cc[3 * i] = 1; cc[3 * i + 1] = 1; cc[3 * i + 2] = 1; } }
      lat.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      P('body', lat, g => pal[g.ci], null, hiG.concat(loG), { mat: K.M('#ffffff', { kind: 'wood', vc: true }) });
      P('head', xf(new THREE.SphereGeometry(0.2, 16, 12), { p: [0, 1.55, 0] }), g => g.skin, null, hiG.concat(loG), { mat: sk });
      P('hair', xf(new THREE.SphereGeometry(0.205, 14, 8, 0, 6.283, 0, 1.3), { p: [0, 1.56, -0.01], r: [-0.25, 0, 0] }), g => g.hair, null, hiG, { mat: K.M('#ffffff', { kind: 'wood', vc: true }) });
      P('arms', merge([xf(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), { p: [0.23, 0.95, 0], r: [0, 0, 0.15] }), xf(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), { p: [-0.23, 0.95, 0], r: [0, 0, -0.15] })]), g => pal[g.ci], null, hiG, { mat: K.M('#ffffff', { kind: 'wood', vc: true }) });
      P('hat', merge([xf(new THREE.CylinderGeometry(0.16, 0.17, 0.16, 14), { p: [0, 1.78, 0] }), xf(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 16), { p: [0, 1.7, 0] })]), g => g.hatC, null, hiG.filter(g => g.hat), { mat: K.M('#ffffff', { kind: 'wood', vc: true }) });
    } else { // felt dolls
      P('legL', xf(G.cyl(0.085, 0.075, 0.78, 8), { p: [0, -0.39, 0] }), g => g.shorts ? g.skin : g.pants, [0.1, 0.82, 0], hiG, { swing: 1 });
      P('legR', xf(G.cyl(0.085, 0.075, 0.78, 8), { p: [0, -0.39, 0] }), g => g.shorts ? g.skin : g.pants, [-0.1, 0.82, 0], hiG, { swing: -1 });
      P('shoes', merge([xf(G.box(0.14, 0.09, 0.24, 0.04), { p: [0.1, 0.05, 0.04] }), xf(G.box(0.14, 0.09, 0.24, 0.04), { p: [-0.1, 0.05, 0.04] })]), g => '#3a2a22', null, hiG);
      P('body', xf(lumpySphere(0.25, 2, 0.05, 2, 3), { p: [0, 1.12, 0], s: [1.0, 1.35, 0.78] }), g => pal[g.ci], null, hiG.concat(loG));
      P('skirt', xf(G.cone(0.32, 0.5, 12), { p: [0, 0.78, 0] }), g => pal[g.ci], null, hiG.filter(g => g.dress));
      P('armL', xf(G.cyl(0.06, 0.055, 0.58, 6), { p: [0, -0.29, 0] }), g => pal[g.ci], [0.27, 1.38, 0], hiG, { swing: -1 });
      P('armR', xf(G.cyl(0.06, 0.055, 0.58, 6), { p: [0, -0.29, 0] }), g => pal[g.ci], [-0.27, 1.38, 0], hiG, { swing: 1 });
      P('head', xf(lumpySphere(0.17, 2, 0.04, 2, 5), { p: [0, 1.62, 0] }), g => g.skin, null, hiG.concat(loG));
      P('hair', xf(new THREE.SphereGeometry(0.18, 12, 8, 0, 6.283, 0, 1.4), { p: [0, 1.64, -0.015], r: [-0.3, 0, 0] }), g => g.hair, null, hiG);
      P('hat', merge([xf(G.cyl(0.15, 0.17, 0.14, 12), { p: [0, 1.82, 0] }), xf(G.cyl(0.28, 0.28, 0.04, 14), { p: [0, 1.75, 0] })]), g => g.hatC, null, hiG.filter(g => g.hat));
      P('legsLo', xf(G.cyl(0.16, 0.12, 0.8, 8), { p: [0, 0.4, 0] }), g => g.pants, null, loG);
    }
    const bal = hiG.concat(loG).filter(g => g.balloon);
    P('balloon', merge([tint(xf(G.sph(0.24, 14), { p: [0.35, 2.75, 0.1], s: [1, 1.15, 1] }), '#fff'), tint(xf(new THREE.CylinderGeometry(0.008, 0.008, 1.3, 3), { p: [0.33, 2.0, 0.08], r: [0, 0, 0.03] }), '#eeeeee')]), g => g.balC, null, bal, { mat: S === 'tin' ? K.M('#ffffff', { vc: true, pattern: 'plain', forceMap: true, border: false, wear: false }) : K.IM() });
    const st = hiG.filter(g => g.stroller);
    P('stroller', merge([tint(xf(G.box(0.5, 0.35, 0.8, 0.1), { p: [0, 0.6, 0.95] }), '#fff'), tint(xf(new THREE.SphereGeometry(0.32, 10, 6, 0, 6.283, 0, 1.6), { p: [0, 0.75, 0.75], r: [-1.2, 0, 0] }), '#fff'), ...[[-0.24, 0.65], [0.24, 0.65], [-0.24, 1.25], [0.24, 1.25]].map(([x, z]) => tint(xf(new THREE.TorusGeometry(0.11, 0.035, 6, 10), { p: [x, 0.12, z], r: [0, Math.PI / 2, 0] }), '#333')), tint(xf(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), { p: [0, 0.95, 0.45], r: [0.6, 0, 0] }), '#333')]), g => ['#2E86C1', '#9B59B6', '#16A085', '#E74C3C'][g.id % 4], null, st);
  }
  W.guestParts = parts;
  return parts;
}
// animate guests. o: {t, hop(tin), puff fn(g)->{lay,flat} (felt), pop fn (paper), hidden fn}
const _M = new THREE.Matrix4(), _M2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _ax = new THREE.Vector3(1, 0, 0);
export function updateGuests(W, t, o = {}) {
  const { park, S } = W; const wk = park.guestsAt(t).walkers; const moving = o.moving !== false;
  for (const g of W.guests) {
    if (g.kind === 'walk') { g.x = wk[5 * g.i]; g.z = wk[5 * g.i + 1]; g.h = wk[5 * g.i + 2]; }
  }
  for (const part of W.guestParts) {
    const M = part.inst.mesh; const items = part.inst.items;
    for (let k = 0; k < items.length; k++) {
      const g = items[k].g; const sc = g.height / 1.7;
      let y = g.kind === 'seat' ? g.seatY - 0.45 : 0, sw = 0, tilt = 0, extraRx = 0, sy = 1, sz = 1, vis = true;
      const walking = g.kind === 'walk' && moving;
      if (walking) { const ph = t * (g.speed || 1.2) * 2.6 + g.phase; sw = Math.sin(ph) * 0.5; y = Math.abs(Math.cos(ph)) * 0.04 * sc; if (S === 'tin') { y = Math.abs(Math.sin(t * 7 + g.phase)) * 0.18 * sc; sw = 0; } if (S === 'felt') tilt = Math.sin(ph) * 0.07; }
      else if (moving && g.kind !== 'seat') { y = S === 'tin' ? Math.abs(Math.sin(t * 5 + g.phase)) * 0.05 : 0; tilt = Math.sin(t * 1.3 + g.phase) * 0.03; }
      let lay = 0; if (o.puff) { const r = o.puff(g, t); lay = r.lay; sz = r.flat; sy = r.sy ?? 1; if (r.hide) vis = false; }
      let pop = 1; if (o.pop) { pop = o.pop(g, t); if (pop <= 0.001) vis = false; }
      let off = null; if (o.offset) off = o.offset(g, t);
      if (!vis) { _M.makeScale(0, 0, 0); M.setMatrixAt(k, _M); continue; }
      const heading = S === 'paper' ? 0.35 + (g.id % 7) * 0.05 - 0.15 : g.h;
      _q.setFromEuler(_e.set(0, heading, tilt, 'YXZ'));
      if (lay) { _q2.setFromAxisAngle(_ax, lay * Math.PI / 2); _q.premultiply(_q2); }
      if (S === 'paper' && pop < 1) { _q2.setFromAxisAngle(_ax, -(1 - pop) * Math.PI / 2); _q.multiply(_q2); }
      _v.set(g.x + (off ? off[0] : 0), y + (off ? off[1] : 0), g.z + (off ? off[2] : 0)); _s.set(sc * (off ? off[3] : 1), sc * sy * (off ? off[3] : 1), sc * sz * (off ? off[3] : 1));
      _M.compose(_v, _q, _s);
      if (part.pivot) { // limb: translate to pivot, rotate swing about x
        let a = part.swing * sw; if (g.kind === 'seat' && part.name.startsWith('leg')) a = -1.45;
        _M2.makeTranslation(part.pivot[0], part.pivot[1], part.pivot[2]); _M.multiply(_M2); _M2.makeRotationX(a); _M.multiply(_M2);
      }
      M.setMatrixAt(k, _M);
    }
    M.instanceMatrix.needsUpdate = true;
  }
}
