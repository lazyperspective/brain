'use strict';
// ------------------------------------------------------------------
// PART 2 (10–20 s) · CHAPTER I · THE REQUEST
// The thought becomes a storm that swallows the moon (high effort: it thinks, and thinks).
// The Handler's hand turns the EFFORT dial from HIGH to MED. The storm deflates to one bright idea.
// The creature carries the first plank to the edge and lays it toward the moon.
// ------------------------------------------------------------------
const CAMKEYS2 = [[10, 210, 210, 1.72], [11.2, 204, 196, 1.5], [12.6, 206, 176, 1.15], [14.0, 200, 168, 0.95], [14.6, 186, 176, 1.0], [16.2, 184, 180, 1.0], [17.2, 196, 214, 1.35], [18.0, 196, 222, 1.45], [19.2, 180, 202, 1.55], [20, 182, 198, 1.5]];
const DIAL = { q: [90, 178], r: 36 };
const DETENTS = { LOW: 200, MED: 235, HIGH: 270, XHIGH: 305, MAX: 340 };

function heroAt2(t) {
  const st = { eyes: 'open', look: [-1, -2], mouth: 'flat', arm: 0.3, hop: 0, squash: 0, walk: null, breathe: 0, blink: 0 };
  let x = 60, y = 50;
  if (t < 11.0) { st.squash = 0.03 * Math.sin((t - 8.9) * 6) + sm(10.4, 11.0, t) * 0.08; st.arm = lerp(0.3, 0.95, sm(10.4, 11.0, t)); }
  else if (t < 14.5) {                       // the Thinker: arm to chin, squashed in concentration, eyes chasing the storm
    st.squash = 0.08 + 0.02 * Math.sin(t * 5); st.arm = 0.95; st.look = t < 12.8 ? [-1, -2] : [2, -2]; st.blink = ((t * 10) % 17 < 0.6) ? 1 : 0;
    st.sweat = ((t - 11) % 1.6) * 1.2; st.mouth = Math.floor(t * 3) % 5 === 0 ? 'o' : 'flat';
  }
  else if (t < 16.3) { st.look = [-2, -1]; st.mouth = 'o'; st.eyes = t > 15.55 && t < 16.0 ? 'wide' : 'open'; st.arm = 0.5; }
  else if (t < 17.3) { const u = (t - 16.3) / 1.0; st.look = [Math.round(lerp(-1, 2, u)), -2]; st.mouth = ''; st.arm = 0.4; }
  else if (t < 17.55) { const u = (t - 17.3) / 0.25; st.eyes = 'wide'; st.mouth = 'smile'; st.shine = true; st.hop = Math.sin(u * Math.PI) * 6; st.arm = 1; st.squash = u < 0.2 ? 0.15 : -0.1; }
  else if (t < 18.0) { const u = (t - 17.55) / 0.45; st.look = u < 0.4 ? [-1, 1] : [0, -1]; st.mouth = 'smile'; st.arm = 1; st.squash = 0.1 * Math.sin(u * Math.PI); }
  else if (t < 19.0) { const u = (t - 18.0) / 1.0, hu = (u * 3) % 1; x = lerp(60, 40, ease(u)); y = lerp(50, 16, ease(u)); st.hop = Math.sin(hu * Math.PI) * 5; st.squash = hu < 0.12 ? 0.12 : hu > 0.88 ? 0.1 : -0.08; st.look = [1, -2]; st.arm = 1; st.mouth = 'smile'; }
  else if (t < 19.45) { const u = (t - 19.0) / 0.45; x = 40; y = 16; st.squash = 0.14 * Math.sin(u * Math.PI); st.look = [1, -1]; st.arm = lerp(1, 0.3, u); st.mouth = 'flat'; }
  else { x = 40; y = 16; st.look = [2, -2]; st.shine = true; st.mouth = 'smile'; st.blink = (t > 19.7 && t < 19.78) ? 1 : 0; }
  return { x, y, st };
}

// ---------------- the storm ----------------
const STORM_PUFFS = (() => { const R = mulberry(101), out = []; for (let k = 0; k < 24; k++) { const a = R() * 6.283, r = Math.sqrt(R()); out.push({ a, r, w: 0.55 + R() * 0.6, born: 10.2 + k * 0.13 + R() * 0.2, seed: 200 + k }); } out.sort((p, q) => p.r - q.r); return out; })();
function stormState(t) {
  const grow = sm(10.0, 13.8, t), deflate = sm(16.3, 17.0, t);
  const head = PREF(60, 50, 40), c0 = [head[0] + 10, head[1] - 22], c1 = [266, 52];
  const c = [lerp(c0[0], c1[0], sm(11.2, 14.0, t)), lerp(c0[1], c1[1], sm(11.2, 14.0, t))];
  const cd = [lerp(c[0], head[0] + 10, deflate), lerp(c[1], head[1] - 18, deflate)];
  return { c: cd, R: lerp(14, 128, grow) * (1 - deflate * 0.9), dark: sm(10.6, 12.6, t) * (1 - deflate), cover: sm(12.9, 14.0, t) * (1 - sm(16.3, 16.9, t)), deflate };
}
function stormW(B, t, H) {
  if (t < 10 || t > 17.6) return;
  const s = stormState(t), z = CAM.z, sc = z;
  const lit = (base, dark) => mix(base, dark, s.dark);
  const flash = [12.7, 13.6, 14.15].some(f => t > f && t < f + 0.07) ? 1 : 0;
  const cols = { light: flash ? hex('e9e3f5') : lit(COL.cloudL, hex('6a5a8a')), mid: lit(COL.cloud, hex('4f3d6e')), dark: lit(COL.cloudD, hex('2a1d42')) };
  // tether of little thought puffs from the head to the storm
  const hd = H.r.head, cs = S(s.c);
  for (let q = 1; q <= 3; q++) { const u = q / 4, x = lerp(hd[0], cs[0], u * 0.6), y = lerp(hd[1] - 6 * ISO.k / 1.4, cs[1], u * 0.6); B.circle(x, y, (1.2 + q * 0.9) * ISO.k / 1.4 * (1 - s.deflate * 0.5), cols.light); }
  // body of the storm
  const wob = (k) => Math.sin(t * 1.7 + k) * 2;
  for (const p of STORM_PUFFS) {
    const age = sm(p.born, p.born + 0.5, t); if (age <= 0 && p.r > 0.1) continue;
    const q = [s.c[0] + Math.cos(p.a) * p.r * s.R * 0.85 + wob(p.seed), s.c[1] + Math.sin(p.a) * p.r * s.R * 0.62 - (1 - p.r) * s.R * 0.18 + wob(p.seed + 3) * 0.6], sp = S(q);
    pixCloud(B, sp[0], sp[1], Math.max(8, (30 + s.R * 0.42) * p.w * age * sc), cols, p.seed);
  }
  if (s.R * sc < 20) { pixCloud(B, cs[0], cs[1], 40 * ISO.k / 1.4, cols, 7); }
  // inner glow: violet core that pulses, flaring with each lightning strike
  if (s.dark > 0.2) { const core = S([s.c[0], s.c[1] + s.R * 0.05]), rr = s.R * 0.7 * sc, g = (0.18 + 0.12 * Math.sin(t * 3.1) + flash * 0.5) * s.dark * (1 - s.deflate); B.glow(core[0] - rr, core[1] - rr * 0.6, core[0] + rr, core[1] + rr * 0.6, hex('9b8fd6'), (px, py) => g * Math.max(0, 1 - Math.hypot((px - core[0]) / rr, (py - core[1]) / (rr * 0.55)))); }
  // inside the storm: turning gears, question marks, little bridge blueprints, a lightning fork
  if (s.dark > 0.3 && s.deflate < 0.5) {
    const k = sc, show = sm(11.0, 12.0, t) * (1 - s.deflate * 2);
    for (const [ox, oy, r, sp] of [[-0.35, 0.05, 9, 1.4], [-0.1, -0.12, 6, -2.1], [0.3, 0.08, 11, 0.9], [0.12, 0.2, 5, -2.6]]) {
      const g = S([s.c[0] + ox * s.R, s.c[1] + oy * s.R]), rr = r * k * show; if (rr < 2) continue;
      B.circle(g[0], g[1], rr, hex('8e82b8')); B.circle(g[0], g[1], rr * 0.45, hex('3a2a55'));
      for (let tooth = 0; tooth < 8; tooth++) { const a = tooth / 8 * 6.283 + t * sp; B.circle(g[0] + Math.cos(a) * rr * 1.05, g[1] + Math.sin(a) * rr * 1.05, Math.max(1, rr * 0.22), hex('8e82b8')); }
    }
    for (let q = 0; q < 6; q++) { const u = ((t * 0.35 + q / 6) % 1), g = S([s.c[0] + Math.sin(q * 2.4) * s.R * 0.55, s.c[1] - s.R * 0.1 - u * s.R * 0.25]); if (u > 0.85) continue; const G = Math.max(1, Math.round(k * 0.9)); glyph(B, '?', Math.round(g[0]), Math.round(g[1]), hex('e9e3f5'), G); }
    // a tiny blueprint of a bridge, sketched and re-sketched
    const bpc = S([s.c[0] + s.R * 0.05, s.c[1] + s.R * 0.25]), bw = 26 * k * show;
    if (bw > 6) { B.line(bpc[0] - bw, bpc[1], bpc[0] + bw, bpc[1] - bw * 0.5, hex('c3b9e0')); for (let q = 0; q <= 5; q++) { const u = q / 5, x = bpc[0] - bw + u * 2 * bw, y = bpc[1] - u * bw * 0.5; B.line(x, y, x, y + 4 * k, hex('c3b9e0')); } }
    if (flash) { const f0 = S([s.c[0] - s.R * 0.2, s.c[1] - s.R * 0.1]); let x = f0[0], y = f0[1]; for (let q = 0; q < 6; q++) { const nx = x + (hash(q, Math.floor(t * 10), 3) - 0.3) * 10 * k, ny = y + 7 * k; B.line(x, y, nx, ny, hex('fff1c4')); x = nx; y = ny; } }
    // question marks raining onto the island
    for (let q = 0; q < 10; q++) { const ph = (t * 0.6 + q / 10) % 1, g = S([s.c[0] + (hash(q, 1, 1) - 0.5) * s.R * 1.3, s.c[1] + s.R * 0.4 + ph * 120]); if (ph > 0.8 || s.cover < 0.3) continue; B.put(g[0], g[1], hex('c3b9e0')); B.put(g[0], g[1] - 1, hex('c3b9e0')); B.put(g[0] + 1, g[1] - 2, hex('c3b9e0')); }
  }
  // after the deflate: one small bright puff with a lightbulb, then it pops
  if (s.deflate > 0.95 && t < 17.6) {
    const u = sm(17.0, 17.15, t), pop = sm(17.45, 17.6, t), g = S([s.c[0], s.c[1] - 4]), G = Math.max(1, Math.round(ISO.k / 1.4));
    pixCloud(B, g[0], g[1], 30 * ISO.k / 1.4 * (1 - pop), { light: hex('ffffff'), mid: COL.cloudL, dark: COL.cloud }, 7);
    if (u > 0.5 && pop < 0.5) { const bx = Math.round(g[0] - 2 * G), by = Math.round(g[1] - 9 * G); B.circle(bx + 2 * G, by + 2 * G, 3 * G, hex('ffd88a')); B.rect(bx + G, by + 5 * G, 3 * G, 2 * G, hex('b9b2c4')); B.put(bx + G, by + G, hex('fff1c4'));
      for (const [dx, dy] of [[-5, -2], [9, -2], [2, -6]]) B.rect(bx + dx * G, by + dy * G, G, G, hex('fff1c4')); }
  }
}

// ---------------- the EFFORT dial (pixel) + its labels (hi-res pixel font) ----------------
function dialAngle(t) {
  if (t < 15.55) return DETENTS.HIGH;
  const steps = [[15.55, 258], [15.75, 246], [15.95, 235]]; let a = DETENTS.HIGH;
  for (const [tt, ang] of steps) if (t >= tt) a = lerp(a, ang, sm(tt, tt + 0.08, t));
  return a;
}
function dialScale(t) { return sm(14.55, 14.95, t) * (1 + Math.sin(sm(14.55, 14.95, t) * Math.PI) * 0.12) * (1 - sm(16.55, 16.95, t)); }
function dialW(B, t) {
  const s = dialScale(t); if (s <= 0.01) return; const c = S(DIAL.q, 0.9), r = DIAL.r * (1 + (CAM.z - 1) * 0.9) * s;
  B.circle(c[0] + 2, c[1] + 3, r + 3, hex('140f22'));
  B.circle(c[0], c[1], r + 3, hex('6a62b0')); B.circle(c[0], c[1], r + 1, hex('3a2a55')); B.circle(c[0], c[1], r - 1, (x, y) => mix(hex('2a1d42'), hex('1c1530'), clamp((y - c[1] + r) / (2 * r), 0, 1)), 16);
  for (const [name, ang] of Object.entries(DETENTS)) { const a = ang * Math.PI / 180; for (let q = 0; q < 4; q++) B.put(c[0] + Math.cos(a) * (r - 3 - q), c[1] + Math.sin(a) * (r - 3 - q), name === 'MED' && t > 15.95 ? COL.flag : hex('9b8fd6')); }
  const a = dialAngle(t) * Math.PI / 180;
  B.circle(c[0], c[1], r * 0.42, hex('b9b2c4')); B.circle(c[0] - r * 0.08, c[1] - r * 0.08, r * 0.34, hex('e9e3f5'));
  for (let q = 0; q < r * 0.78; q++) { const x = c[0] + Math.cos(a) * q, y = c[1] + Math.sin(a) * q; B.put(x, y, COL.flag); B.put(x + 1, y, COL.flag); }
  // a little arc of "heat" on the high side while it is on HIGH
  if (t < 15.9) for (let q = 0; q < 24; q++) { const an = (270 + q * 3) * Math.PI / 180; if (hash(q, Math.floor(t * 12), 2) < 0.4) B.put(c[0] + Math.cos(an) * (r + 5), c[1] + Math.sin(an) * (r + 5), hex('f5b45a')); }
}
function dialLabels(F, t) {
  const s = dialScale(t); if (s <= 0.5) return; const c = S(DIAL.q, 0.9), r = DIAL.r * (1 + (CAM.z - 1) * 0.9) * s;
  F.save(); F.globalAlpha = sm(0.5, 0.9, s);
  hiText(F, 'EFFORT', c[0] * SC, (c[1] + r + 9) * SC, 4, '#c3b9e0', { align: 'c' });
  const cur = dialAngle(t);
  for (const [name, ang] of Object.entries(DETENTS)) { const a = ang * Math.PI / 180, x = (c[0] + Math.cos(a) * (r + 22)) * SC, y = (c[1] + Math.sin(a) * (r + 15)) * SC - 10; const on = Math.abs(cur - ang) < 6; hiText(F, name, x, y, 3, on ? '#d97757' : '#8e82b8', { align: 'c' }); }
  F.restore();
}
// the Handler's hand comes down out of the dark and turns the dial
function handTurn(F, t) {
  if (t < 14.3 || t > 17.2) return;
  const inn = ease(clamp((t - 14.3) / 0.75, 0, 1)), out = ease(clamp((t - 16.35) / 0.8, 0, 1)), c = S(DIAL.q, 0.9);
  const tx = c[0] * SC, ty = c[1] * SC, x = lerp(tx - 520, tx, inn) - out * 520, y = lerp(ty - 760, ty, inn) - out * 760;
  const twist = (dialAngle(t) - DETENTS.HIGH) * Math.PI / 180, sc = 2.2 * (1 + (CAM.z - 1) * 0.9);
  F.save(); F.translate(x, y); F.rotate(-0.6 + twist * 0.8); F.scale(sc, sc); F.filter = 'blur(1.2px)'; F.fillStyle = '#07050d';
  F.beginPath(); F.ellipse(-14, -70, 40, 50, 0.1, 0, 7); F.fill();
  F.beginPath(); F.roundRect(-30, -260, 64, 210, 26); F.fill();                                   // forearm into the dark
  for (const [fx, fy, len, a] of [[6, -30, 46, -0.2], [-10, -26, 48, 0.15], [-22, -36, 40, 0.5]]) { F.save(); F.translate(fx, fy); F.rotate(a); F.beginPath(); F.roundRect(-7, -4, 14, len, 7); F.fill(); F.restore(); }
  F.save(); F.translate(22, -50); F.rotate(-0.9); F.beginPath(); F.roundRect(-7, -4, 14, 40, 7); F.fill(); F.restore(); // thumb pinching the knob
  F.filter = 'blur(2.5px)'; F.strokeStyle = 'rgba(255,214,160,0.42)'; F.lineWidth = 2.5;
  F.beginPath(); F.ellipse(-14, -70, 40, 50, 0.1, -0.4, 1.0); F.stroke();
  F.restore();
}
function tipCard(F, t, a, b, lines) {
  const al = fadeIO(t, a, b, 0.3); if (al <= 0) return; const rise = (1 - sm(a, a + 0.35, t)) * 30;
  const W = 700, Hh = 74 + lines.length * 52, x = FW / 2 - W / 2, y = 1110 - Hh / 2 + rise;
  F.save(); F.globalAlpha = al; F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 24; F.shadowOffsetY = 10; F.fillStyle = '#f3ead6'; F.beginPath(); F.roundRect(x, y, W, Hh, 14); F.fill(); F.shadowColor = 'transparent';
  F.fillStyle = '#d97757'; F.beginPath(); F.roundRect(x, y, 12, Hh, [14, 0, 0, 14]); F.fill();
  // small pixel glove icon
  F.fillStyle = '#d97757'; for (const [dx, dy, w, h] of [[0, 10, 22, 18], [0, 0, 4, 12], [6, -4, 4, 16], [12, -2, 4, 14], [18, 2, 4, 10], [-6, 14, 6, 4]]) F.fillRect(x + 44 + dx, y + 26 + dy, w, h);
  hiText(F, "HANDLER'S TIP", x + 84, y + 28, 4, '#d97757', { shadow: false });
  lines.forEach((L, i) => hiText(F, L, x + 44, y + 76 + i * 52, 6, '#2a2350', { shadow: false }));
  F.restore();
}
// dims the world while the storm covers the moon
function stormDark(F, t) { const s = stormState(t); if (s.cover <= 0.01) return; F.save(); F.fillStyle = `rgba(6,4,14,${0.42 * s.cover})`; F.fillRect(0, 0, FW, FH); F.restore(); }

// ---------------- planks: carried on the head, then laid at the edge pointing at the moon ----------------
function carriedPlank(B, t, H) {
  if (t < 17.6 || t > 19.25) return;
  const lift = sm(17.6, 17.85, t), from = P(50, 62, 6), on = P(H.x, H.y, 3 + 13 + (H.st.hop || 0) + 2), place = P(40, -9, 1), pu = sm(19.0, 19.25, t);
  const cx = lerp(lerp(from[0], on[0], lift), place[0], pu), cy = lerp(lerp(from[1], on[1], lift), place[1], pu);
  const k = ISO.k, w = 9 * k, h = 2.6 * k; // a plank seen roughly along the iso axis
  B.poly([[cx - w, cy - h * 0.2], [cx + w * 0.2, cy - h * 1.6 - w * 0.5], [cx + w * 0.55, cy - h * 1.6 - w * 0.5 + h], [cx - w + w * 0.35, cy + h * 0.8]], COL.woodL);
  B.poly([[cx - w, cy - h * 0.2], [cx - w + w * 0.35, cy + h * 0.8], [cx - w + w * 0.35, cy + h * 1.6], [cx - w, cy + h * 0.6]], COL.wood);
}
function placedPlank(B, t) {
  if (t < 19.22) return; const d = sm(19.22, 19.3, t);
  box(B, 34, -18, 0 - (1 - d) * 2, 12, 18, 2, COL.woodL, COL.wood, COL.woodD);
  for (let q = 0; q < 3; q++) { const a = P(34, -15 + q * 6, 2), b = P(46, -15 + q * 6, 2); B.line(a[0], a[1], b[0], b[1], COL.wood); }
  if (t < 19.6) dustPuff(B, t, 19.22, P(40, -9, 0), 8);
}
