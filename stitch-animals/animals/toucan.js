// Toco toucan: stitched bust portrait. Head tilted up, huge beak pointing up-left, haughty.
// Signature motion: a highlight glint travels along the beak, base -> tip (~1.5 s, once per loop).
// Secondary: the white bib breathes by 1 cell; the eye blinks once. Loop 6 s.
(function () {
  const LOOP = 6;
  const BG = 0, K = 1, KD = 2,                 // hot magenta, near-black, blue-black
    B1 = 3, B2 = 4, B3 = 5, B4 = 6, B5 = 7,      // beak: deep red-orange .. pale yellow highlight
    CR = 8, WH = 9, BL = 10;                     // cream, white, eye-ring blue
  const PAL = ['#d81f6e', '#0c0a18', '#2c3160',
    '#a8250f', '#e04a12', '#f6801c', '#fbb53c', '#ffe58c',
    '#e3d2b4', '#fbf5ea', '#3fa9f5'];

  // ---------- deterministic noise ----------
  function h2(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function vnoise(x, y, sc, s) {
    x /= sc; y /= sc;
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y, sc, s) => 0.65 * vnoise(x, y, sc, s) + 0.35 * vnoise(x, y, sc * 0.45, s + 7);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- beak frame ----------
  const ANG = 35 * Math.PI / 180;
  const D = [-Math.cos(ANG), -Math.sin(ANG)];      // along the beak toward the tip (up-left)
  const N = [Math.sin(ANG), -Math.cos(ANG)];       // toward the culmen (up-right)
  const BASE = [67, 94], L = 69;
  const toBeak = (x, y) => { const rx = x - BASE[0], ry = y - BASE[1]; return [rx * D[0] + ry * D[1], rx * N[0] + ry * N[1]]; };
  const fromBeak = (u, v) => [BASE[0] + u * D[0] + v * N[0], BASE[1] + u * D[1] + v * N[1]];
  // banana profile, s = u/L
  const mid = (s) => -3.4 * s * s;
  const topEdge = (s) => mid(s) + 15.5 * Math.pow(Math.max(0, 1 - Math.pow(s, 2.6)), 0.55) + 1.6 * Math.sin(s * Math.PI);
  const botEdge = (s) => mid(s) - 12.5 * Math.pow(Math.max(0, 1 - Math.pow(s, 1.8)), 0.7);
  const cutLine = (s) => mid(s) - 4.0 * (1 - s) + 0.9 * Math.sin(s * 2 * Math.PI) * (1 - s);

  const EYE = [79, 85];

  // ---------- static layers (computed once per breath state) ----------
  const cache = {};
  function build(W, H, breath) {
    const out = new Uint8Array(W * H);
    const beakT = new Int8Array(W * H).fill(-1);   // beak tone 0..4, -2 = black tip/base
    const beakU = new Float32Array(W * H).fill(-1);
    const beakV = new Float32Array(W * H);
    const jag = (x, y) => (vnoise(x, y, 2.2, 11) - 0.5) * 1.6;

    const head = (x, y) => 1 - Math.hypot((x - 83) / 18.5, (y - 87) / 18);
    // chest/throat front edge: tucks under the jaw, then the chest swells forward
    function bodyFront(y) {
      const t = (y - 96) / (H - 96);
      if (t < 0) return 99;
      return 61 - 37 * Math.sin(clamp(t * 1.08, 0, 1) * Math.PI * 0.5) + 4 * Math.pow(t, 3) - (t > 0.25 ? breath : 0);
    }
    function bodyBack(y) {
      const t = (y - 92) / (H - 92);
      return 98.5 + 19 * clamp(t * 1.6, 0, 1) * clamp(t * 1.6, 0, 1) * (3 - 2 * clamp(t * 1.6, 0, 1)) / 1;
    }
    // bib / black border: from under the eye, round the cheek, then down and back across the chest
    function bibBack(y) {
      const t = (y - 90) / (H - 90);
      if (t < 0) return -99;
      return 74 + 12 * Math.sin(clamp(t * 2.6, 0, 1) * Math.PI * 0.5) - 25 * Math.pow(clamp((t - 0.22) / 0.78, 0, 1), 1.05);
    }

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = jag(x, y);
      const [u, v] = toBeak(x, y);
      const face = u > -9 && u < 1 && v < topEdge(0) - 1 + u * 0.3 && v > botEdge(0) + 1;
      const inHead = head(x, y) * 17 + j > 0 || face;
      const inBody = y > 93 && x - bodyFront(y) + j > 0 && bodyBack(y) - x + j > 0;
      if (inHead || inBody) {
        // ---- black plumage ----
        let c = K;
        const wing = (x - 76) / 28 + (y - 100) / 70 + (vnoise(x, y, 3, 41) - 0.5) * 0.5;
        if (wing > 0.62 && y > 100) {
          // folded wing / shoulder: one big blue-black plane, scalloped by rows of dark crevice dashes
          c = KD;
          const r = (y - x * 0.32 + (vnoise(x, y, 5, 71) - 0.5) * 4) / 5.2, row = Math.floor(r), fr = r - row;
          const seg = Math.floor((x + row * 3 + vnoise(x, y, 3, 73) * 4) / 4.5);
          if (fr < 0.2 + 0.12 * h2(seg, row, 46) && h2(seg, row, 45) < 0.5 - clamp((y - 118) / 70, 0, 0.3)) c = K;
          if (h2(x, y, 43) < 0.03) c = K;
        } else {
          // head & nape: blue-black sheen where the light from the upper left catches the crown
          let lit = -0.5 * (x - 84) / 14 - 0.9 * (y - 84) / 14 + (fbm(x, y, 2.6, 3) - 0.5) * 1.5;
          c = lit > 0.62 ? KD : K;
          if (c === KD && h2(x, y, 47) < 0.08) c = K;
        }
        out[i] = c;
        // ---- white throat bib ----
        const bb = bibBack(y) + (vnoise(x, y, 2.0, 21) - 0.5) * 4;
        const bibTop = -4.5 + 2.4 * clamp(-u, 0, 5.5) + (vnoise(x, y, 2, 23) - 0.5) * 2;
        if (x < bb && v < bibTop) {
          const fx = x - bodyFront(y);
          // lit at the upper front of the throat, cream on the shaded back and lower chest
          let w = 1.15 - Math.max(0, y - 98) / 42 - Math.max(0, fx) / 34 + (fx < 3 ? 0.25 : 0);
          if (y < 106 && x > 60) w -= 0.5 * (1 - (y - 92) / 14);   // shadow under the lower mandible
          w += (fbm(x, y, 2.8, 17) - 0.5) * 1.1;
          let wc = w > 0.45 ? WH : CR;
          // broken feather marks: short scalloped strokes of the other tone
          const r = (y + x * 0.45 + (vnoise(x, y, 4, 75) - 0.5) * 3.5) / 3.6, row = Math.floor(r), fr = r - row;
          const seg = Math.floor((x - row * 2.1 + vnoise(x, y, 3, 77) * 5) / 3.4);
          if (fr < 0.22 + 0.15 * h2(seg, row, 52) && h2(seg, row, 51) < 0.3) wc = wc === WH ? CR : WH;
          out[i] = wc;
        }
      }
      // ---- beak ----
      const s = u / L;
      if (s > -0.012 && s < 1.03) {
        const ss = clamp(s, 0, 1);
        const te = topEdge(ss) + j * 0.85, be = botEdge(ss) + j * 0.85;
        if (v < te && v > be) {
          const cl = cutLine(ss);
          let sh;
          if (v > cl) {
            const f = (v - cl) / Math.max(1, te - cl);          // 0 at the cutting edge, 1 at the culmen
            sh = 0.9 + 3.3 * Math.pow(f, 0.85) - 0.9 * ss;
            if (te - v < 1.3 && vnoise(x, y, 2, 61) > 0.42) sh -= 1.4;   // broken culmen ridge line
            if (f > 0.4 && f < 0.92 && ss < 0.86) sh += 0.9 * (fbm(x, y, 2.4, 63) > 0.55 - 0.1 * ss ? 1 : 0);   // patchy highlights on top
          } else {
            const f = (v - be) / Math.max(1, cl - be);
            sh = 0.1 + 2.2 * f - 0.4 * ss;
          }
          sh += (fbm(x, y, 3.2, 5) - 0.5) * 2.3;
          const tone = clamp(Math.round(sh), 0, 4);
          out[i] = B1 + tone; beakT[i] = tone; beakU[i] = u; beakV[i] = v;
          const tipD = Math.hypot((s - 0.98) * L / 9, (v - mid(ss) - 1.0) / 6.5);
          if (tipD + j * 0.2 < 1 && v > cl - 0.6) { out[i] = K; beakT[i] = -2; }
          if (s < 0.017 + j * 0.008) { out[i] = K; beakT[i] = -2; }
        }
      }
    }
    // serrated cutting edge: dark crevice line, irregular notches up into the upper mandible,
    // and tiny pale "tooth" glints between them (like the reference's teeth line)
    let next = 4;
    for (let u = 2; u < L - 3; u++) {
      const s = u / L, cl = cutLine(s);
      const [px, py] = fromBeak(u, cl);
      const ii = Math.round(py) * W + Math.round(px);
      if (beakT[ii] === -2) continue;
      out[ii] = K; beakT[ii] = -3;
      if (u >= next && s < 0.86) {
        next = u + 2 + Math.floor(h2(u, 5, 5) * 3);
        const len = h2(u, 6, 6) < 0.4 ? 2 : 1;
        for (let k = 1; k <= len; k++) {
          const [qx, qy] = fromBeak(u + k * 0.4, cl + 1.1 * k);
          const qi = Math.round(qy) * W + Math.round(qx);
          if (beakT[qi] >= 0) { out[qi] = K; beakT[qi] = -3; }
        }
        if (h2(u, 7, 7) < 0.55) {
          const [tx, ty] = fromBeak(u - 1.2, cl + 1.1);
          const ti = Math.round(ty) * W + Math.round(tx);
          if (beakT[ti] >= 0) out[ti] = B5;
        }
      }
    }
    return { out, beakT, beakU, beakV };
  }

  // eye: orange bare skin, bright blue ring, dark pupil, 1-cell glint. open: 0 closed .. 1 open
  function drawEye(g, open) {
    const [ex, ey] = EYE;
    for (let y = ey - 6; y <= ey + 6; y++) for (let x = ex - 6; x <= ex + 6; x++) {
      const d = Math.hypot(x - ex, (y - ey) * 1.05) + (vnoise(x, y, 1.5, 31) - 0.5) * 0.9;
      if (d < 4.9) g.set(x, y, (x - ex) + (y - ey) < -1 ? B4 : B3);
      if (d < 3.3) g.set(x, y, BL);
    }
    if (open > 0.75) {
      for (let y = ey - 1; y <= ey + 1; y++) for (let x = ex - 1; x <= ex + 1; x++) g.set(x, y, K);
      g.set(ex - 1, ey - 1, WH);
    } else if (open > 0.25) {
      for (let x = ex - 2; x <= ex + 2; x++) { g.set(x, ey, K); g.set(x, ey + 1, K); }
      g.set(ex - 1, ey - 1, BL); g.set(ex, ey - 1, BL);
    } else {
      for (let x = ex - 2; x <= ex + 2; x++) g.set(x, ey + 1, K);
    }
  }

  window.ANIMAL = {
    name: 'toucan', loop: LOOP, bg: BG, palette: PAL,
    draw(g, t) {
      const W = g.w, H = g.h;
      // breath: 2 slow breaths per loop, stepped to a whole cell
      const breath = Math.sin(2 * Math.PI * 2 * t / LOOP - 0.6) > 0.2 ? 1 : 0;
      const L0 = cache[breath] || (cache[breath] = build(W, H, breath));
      const { out, beakT, beakU, beakV } = L0;

      // glint: a slanted band of highlight sweeping base -> tip over 1.5 s (t 0.8 .. 2.3)
      const G0 = 0.8, GD = 1.5, gp = (t - G0) / GD;
      const band = gp >= 0 && gp <= 1 ? Math.floor(-6 + gp * (L + 12)) : -999;

      for (let i = 0; i < W * H; i++) {
        let c = out[i];
        if (band > -999 && beakT[i] >= 0) {
          const d = beakU[i] - band + beakV[i] * 0.35;   // slanted band
          if (d >= 0 && d < 4) c = d >= 1 && d < 3 ? B5 : B1 + Math.min(4, beakT[i] + 2);
        } else if (band > -999 && beakT[i] === -2 && beakU[i] > L * 0.5) {
          const d = beakU[i] - band + beakV[i] * 0.35;     // the glint skims the black tip as a blue-black sheen
          if (d >= 1 && d < 3) c = KD;
        }
        if (c) g.a[i] = c;
      }
      // blink once, around t = 4.3
      const bt = t - 4.3;
      const open = bt < 0 || bt > 0.3 ? 1 : (bt < 0.06 || bt > 0.24 ? 0.5 : 0);
      drawEye(g, open);
    },
  };
})();
