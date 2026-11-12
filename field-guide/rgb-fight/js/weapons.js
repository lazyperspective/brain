'use strict';
// ------------------------------------------------------------------
// WEAPONS. Weapons swing in the vertical plane of the fight line (screen-parallel, like a side-on fighting game),
// held at a shoulder just in front of the body (toward the camera).
// wpn: { kind:'sword'|'axe'|'handle', th: degrees (0 = toward the opponent, 90 = straight up, 180 = behind),
//        f: forward unit vector (toward the opponent), flat: φ radians for a horizontal spin (overrides th),
//        grow 0..1 (sword materialising), glow 0..1 }
// ------------------------------------------------------------------
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
};
const NV = [Math.SQRT1_2, Math.SQRT1_2, 0];                 // horizontal, toward the camera
const SWORD_L = 17, AXE_L = 13;
function wDir(w) {
  if (w.flat != null) return V3.norm([Math.cos(w.flat), Math.sin(w.flat), -0.06]);
  const r = w.th * Math.PI / 180; return V3.norm([w.f[0] * Math.cos(r), w.f[1] * Math.cos(r), Math.sin(r)]);
}
// geometry of a held weapon (world space)
function weaponGeom(hx, hy, z0, bz, w) {
  const dir = wDir(w), flat = w.flat != null;
  const S = flat ? [hx, hy, z0 + bz * 0.45] : [hx + NV[0] * 6.5, hy + NV[1] * 6.5, z0 + bz * 0.5], reach = flat ? 8.5 : 5;
  const grip = V3.add(S, V3.sc(dir, reach)), side = flat ? [0, 0, 1] : NV;
  let u = V3.norm(V3.cross(side, dir)); if (!flat && V3.dot(V3.cross(side, [0, 0, 1]), [w.f[0], w.f[1], 0]) < 0) u = V3.sc(u, -1);
  const len = w.kind === 'sword' ? SWORD_L * (w.grow == null ? 1 : w.grow) : w.kind === 'axe' ? AXE_L : 5;
  const base = V3.add(grip, V3.sc(dir, w.kind === 'sword' ? 1.6 : 0)), tip = V3.add(base, V3.sc(dir, len));
  const behind = flat ? V3.dot(dir, NV) < -0.2 : V3.dot(dir, [w.f[0], w.f[1], 0]) < -0.3;
  return { S, grip, dir, side, u, base, tip, behind, len };
}
function drawSword(B, g, w, G) {
  const { grip, dir, u, base, tip, len } = g, pom = V3.add(grip, V3.sc(dir, -2.4)), at = (d, uu) => P(...V3.add(V3.add(base, V3.sc(dir, d)), V3.sc(u, uu)));
  thick(B, P(...pom), P(...base), G + 1, hex('3a1a10')); thick(B, P(...pom), P(...base), G, hex('8f3f28'));
  B.rect(Math.round(P(...pom)[0]) - G, Math.round(P(...pom)[1]) - G, 2 * G + 1, 2 * G + 1, hex('ffe14f'));
  if (len > 0.4) {
    const wd = 1.5, tl = Math.min(3.5, len * 0.3);
    B.poly([at(0, wd + 0.5), at(len - tl, wd + 0.5), at(len + 0.8, 0), at(len - tl, -wd - 0.5), at(0, -wd - 0.5)], hex('3a1a10'));         // dark outline
    B.poly([at(0, wd), at(len - tl, wd), at(len, 0), at(len - tl, -wd), at(0, -wd)], w.glow > 0.5 ? hex('ffd9c2') : hex('f2a585'));      // blade
    B.poly([at(0, wd), at(len - tl, wd), at(len, 0), at(0, 0)], w.glow > 0.5 ? hex('ffffff') : hex('fff6ea'));                          // lit half
    thick(B, at(0.5, 0), at(len - tl, 0), 1, hex('d97757'));                                                                            // fuller
  }
  thick(B, at(0, 3.4), at(0, -3.4), G + 1, hex('6e2a1a')); thick(B, at(0, 3.2), at(0, -3.2), G, hex('ffe14f'));                        // crossguard
}
function drawAxe(B, g, w, G) {
  const { grip, dir, u, tip } = g, butt = V3.add(grip, V3.sc(dir, -3));
  if (w.kind === 'handle') {   // broken: a short jagged stub
    thick(B, P(...butt), P(...tip), G, hex('3c2a5c')); const e = P(...tip); B.rect(Math.round(e[0]), Math.round(e[1]) - G, G, G, hex('ff3ab0')); B.rect(Math.round(e[0]) + G, Math.round(e[1]), G, G, hex('8a6ab0')); return;
  }
  thick(B, P(...butt), P(...tip), G, hex('3c2a5c'));
  for (const s of [1.5, 5.5]) { const a = V3.add(grip, V3.sc(dir, s)), b = V3.add(grip, V3.sc(dir, s + 1.2)); thick(B, P(...a), P(...b), G + 1, hex('ff3ab0')); }
  const at = (d, uu) => P(...V3.add(V3.add(tip, V3.sc(dir, d)), V3.sc(u, uu)));
  B.poly([at(2.6, 0.5), at(4.2, 6.2), at(-3.6, 6.2), at(-2.4, 0.5)], hex('41316a'));                // the blade
  B.poly([at(2.6, 0.5), at(4.2, 6.2), at(2.2, 4.8), at(0.8, 0.5)], hex('5a4590'));
  B.poly([at(1.4, -0.4), at(0, -3.4), at(-1.4, -0.4)], hex('2a1f45'));                                // back spike
  thick(B, at(4.2, 6.2), at(-3.6, 6.2), G, hex('ff3ab0'));                                            // glowing edge
  B.put(at(0.3, 2.8)[0], at(0.3, 2.8)[1], hex('2af0ff'));
}
function wieldW(B, g, w, Cc, G) {
  if (w.kind === 'sword') drawSword(B, g, w, G); else drawAxe(B, g, w, G);
  box(B, g.grip[0] - 1.8, g.grip[1] - 1.8, g.grip[2] - 1.8, 3.6, 3.6, 3.6, Cc.lightL, Cc.body, Cc.shade);   // the fist around the grip
}
// a free (unheld) axe or handle at grip point with direction dir
function freeWeapon(B, kind, grip, dir, f, G) {
  const side = NV; let u = V3.norm(V3.cross(side, dir)); if (V3.dot(V3.cross(side, [0, 0, 1]), [f[0], f[1], 0]) < 0) u = V3.sc(u, -1);
  const len = kind === 'axe' ? AXE_L : 5, g = { grip, dir, u, side, tip: V3.add(grip, V3.sc(dir, len)) }; drawAxe(B, g, { kind }, G); return g;
}
