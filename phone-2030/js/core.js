// Core: determinism, easing, iOS-style springs, timeline helpers, sound cues, tiny HTML helpers.
// Every frame is a pure function of t: no Math.random, no Date, no CSS animations/transitions.
(function (G) {
  function hash(n) { // number -> [0,1)
    let x = Math.floor(n * 7919 + 0.5) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sat = (v) => clamp(v, 0, 1);
  const seg = (t, a, b) => sat((t - a) / (b - a));
  const E = {
    lin: (k) => k,
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: (k) => 1 - Math.pow(1 - k, 3),
    in: (k) => k * k * k,
    in2: (k) => k * k,
    smooth: (k) => k * k * (3 - 2 * k),
    outQuint: (k) => 1 - Math.pow(1 - k, 5),
    outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
    // UIKit's default ease-in-out-ish curve (0.42,0,0.58,1) approximated
    ios: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  };
  // SwiftUI/UIKit spring: response (s), dampingFraction. returns progress (overshoots when damping < 1).
  function spring(dt, response = 0.5, damping = 0.86) {
    if (dt <= 0) return 0;
    const w = (2 * Math.PI) / response, z = damping;
    if (z >= 1) return 1 - (1 + w * dt) * Math.exp(-w * dt);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + ((z * w) / wd) * Math.sin(wd * dt));
  }
  // spring between t0 (start) and value range, with an optional reverse at t1
  function sp(t, t0, response, damping) { return t < t0 ? 0 : spring(t - t0, response, damping); }
  // momentum scroll (UIScrollView deceleration): offset after a flick of velocity v (pt/s) at t0
  function decel(t, t0, v, rate = 0.998) { if (t <= t0) return 0; const k = Math.log(rate) * 1000; return (v / -k) * (1 - Math.exp(k * (t - t0))); }

  // ---------------- sound cues ----------------
  const CUES = [];
  function cue(t, s, o = {}) { CUES.push(Object.assign({ t: +t.toFixed(4), s }, o)); }

  // ---------------- html helpers ----------------
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const px = (v) => (Math.round(v * 1000) / 1000) + 'px';
  const f3 = (v) => Math.round(v * 1000) / 1000;
  function clock(t) { // real-time clock that the status bar shows; t=0 is 7:29:59 AM
    const s = 7 * 3600 + 29 * 60 + 59.3 + t; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return { h, m, str: ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') };
  }
  G.K = { hash, rng, clamp, lerp, sat, seg, E, spring, sp, decel, CUES, cue, esc, px, f3, clock };
})(window);
