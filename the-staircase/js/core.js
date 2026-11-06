// THE STAIRCASE - core: config, deterministic math helpers. Every frame is a pure function of t (no Math.random).
(function () {
  const S = (window.STAIR = window.STAIR || {});
  S.D = 20;            // loop length, seconds (one lap of the impossible staircase)
  S.FPS = 30;
  S.W = 1080; S.H = 1350;   // output frame (4:5)
  S.SS = 2;                 // internal supersampling for the export render
  S.CS = 1.22;              // character scale: AI climbers (their mini-mes are half that)
  S.HS = 1.15;              // character scale: the humans

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sat = (x) => clamp(x, 0, 1);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const s5 = (u) => { u = sat(u); return u * u * u * (u * (u * 6 - 15) + 10); };
  const wrap = (x, m) => ((x % m) + m) % m;
  const wrapS = (x, m) => wrap(x + m / 2, m) - m / 2;          // signed wrap into [-m/2, m/2)
  const bump = (x, a, b, r) => smooth(a - r, a, x) * (1 - smooth(b, b + r, x));
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return v - Math.floor(v); };
  const hash2 = (a, b) => hash(a * 57.31 + b * 113.7);
  const easeOutBack = (u, c = 1.6) => { u = sat(u); const v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
  const easeInOut = (u) => { u = sat(u); return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; };
  const easeOut = (u) => { u = sat(u); return 1 - (1 - u) * (1 - u); };
  const easeIn = (u) => { u = sat(u); return u * u; };
  // damped spring response to a step at time 0: 0 -> 1 with overshoot
  const spring = (tau, f = 3, z = 0.35) => (tau <= 0 ? 0 : 1 - Math.exp(-z * 2 * Math.PI * f * tau) * Math.cos(2 * Math.PI * f * Math.sqrt(1 - z * z) * tau));
  // decaying wobble after an event (0 before it)
  const wobble = (tau, f = 4, decay = 4) => (tau <= 0 ? 0 : Math.sin(2 * Math.PI * f * tau) * Math.exp(-decay * tau));
  const angLerp = (a, b, u) => a + wrapS(b - a, Math.PI * 2) * u;

  // Piecewise-linear key table lookup: keys [[x, y], ...] sorted by x.
  function keys(tab, x) {
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const a = tab[i - 1], b = tab[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); }
    return tab[tab.length - 1][1];
  }
  // Smooth (smoothstep-blended) key table, periodic over D when per=true.
  function skeys(tab, x, per) {
    if (per) {
      const D = per; x = wrap(x, D);
      const n = tab.length;
      for (let i = 0; i < n; i++) {
        const a = tab[i], b = i + 1 < n ? tab[i + 1] : [tab[0][0] + D, tab[0][1]];
        let xx = x; if (xx < a[0]) xx += D;
        if (xx >= a[0] && xx <= b[0]) { const u = (xx - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], u * u * (3 - 2 * u)); }
      }
      return tab[0][1];
    }
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const a = tab[i - 1], b = tab[i]; const u = (x - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], u * u * (3 - 2 * u)); }
    return tab[tab.length - 1][1];
  }

  // A periodic speed profile: multiplier keys over one cycle [0, D) (smooth, periodic), integrated and normalised so the
  // mean is exactly 1. Returns pos(c) = integral 0..c of m (pos(D) = D) for any real c (extends by D per cycle).
  function profile(tab, D, n = 4000) {
    const cum = new Float64Array(n + 1);
    const dt = D / n;
    for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + Math.max(0, skeys(tab, (i + 0.5) * dt, D)) * dt;
    const k = D / cum[n];
    for (let i = 0; i <= n; i++) cum[i] *= k;
    const f = (c) => {
      const w = Math.floor(c / D), x = c - w * D, fi = x / dt, i = Math.min(n - 1, Math.floor(fi));
      return w * D + cum[i] + (cum[i + 1] - cum[i]) * (fi - i);
    };
    f.rate = (c) => Math.max(0, skeys(tab, c, D)) * k;
    return f;
  }

  S.U = { clamp, sat, lerp, smooth, s5, wrap, wrapS, bump, hash, hash2, easeOutBack, easeInOut, easeOut, easeIn, spring, wobble, angLerp, keys, skeys, profile };
})();
