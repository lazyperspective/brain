// Shared math helpers: seeded RNG, easing, noise, keyframe interpolation.
import * as THREE from 'three';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rng = mulberry32(1337);
export const R = (a = 0, b = 1, r = rng) => a + (b - a) * r();
export const pick = (arr, r = rng) => arr[Math.floor(r() * arr.length) % arr.length];

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const easeOutBack = (t, s = 1.70158) => { const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
export const bump = (a, b, x) => { const t = inv(a, b, x); return Math.sin(t * Math.PI); }; // 0→1→0 over [a,b]
export const pulse = (a, b, c, d, x) => smooth(a, b, x) * (1 - smooth(c, d, x));

// 1D value noise (deterministic), smooth
function hash1(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
export function noise1(x) { const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return lerp(hash1(i), hash1(i + 1), u) * 2 - 1; }
export function fbm1(x, o = 3) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * noise1(x * f + i * 17.3); a *= 0.5; f *= 2; } return v; }

// Keyframe track: [[t, value], ...] values can be number or array; ease per segment optional
export function track(keys, t, ease = easeInOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1, e] = keys[i + 1];
    if (t <= t1) {
      const k = (e || ease)((t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], k));
      return lerp(v0, v1, k);
    }
  }
  return keys[keys.length - 1][1];
}
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const tv = (keys, t, ease) => { const a = track(keys, t, ease); return new THREE.Vector3(a[0], a[1], a[2]); };

// Catmull-Rom path helper
export function pathAt(points, u) {
  const c = new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? new THREE.Vector3(...p) : p), false, 'centripetal');
  return c.getPointAt(clamp(u));
}
export function makeCurve(points) {
  return new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? new THREE.Vector3(...p) : p), false, 'centripetal');
}

export function hsl(h, s, l) { return new THREE.Color().setHSL(h, s, l); }
export function col(hex) { return new THREE.Color(hex); }
