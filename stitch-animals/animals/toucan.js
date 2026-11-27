// Toco toucan: stitched bust portrait. Head tilted up, huge beak pointing up-left, haughty.
// Signature motion: a highlight glint travels along the beak, base -> tip (~1.5 s, once per loop).
// Secondary: the white bib breathes by 1 cell; the eye blinks once. Loop 6 s.
(function () {
  const LOOP = 6;
  const BG = 0, K = 1, KD = 2,                 // hot magenta, near-black, blue-black
    B1 = 3, B2 = 4, B3 = 5, B4 = 6, B5 = 7,      // beak: deep red-orange .. pale yellow highlight
    WH = 8, BL = 9, KS = 10, GC = 11;            // white, eye-ring blue, blue-black sheen, grey-cream
  const CR = B5;                                 // the bib's mid cream shares the beak's pale highlight tone
  const PAL = ['#d81f6e', '#0c0a18', '#272b55',
    '#a8250f', '#e04a12', '#f6801c', '#fbb53c', '#f8e2a8',
    '#fbf6ea', '#3fa9f5', '#4b5592', '#c8b9a2'];

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
    // body silhouette: throat tucks under the jaw, then the breast swells forward in a round curve
    function bodyFront(y) {
      const t = (y - 96) / (H - 96);
      if (t < 0) return 99;
      return 60 - 31 * Math.sin(clamp(t * 1.45, 0, 1) * Math.PI * 0.5) + 6 * Math.pow(clamp((t - 0.6) / 0.4, 0, 1), 2) - (t > 0.2 ? breath : 0);
    }
    function bodyBack(y) {
      const t = clamp((y - 92) / (H - 92) * 1.6, 0, 1);
      return 98.5 + 19 * t * t * (3 - 2 * t);
    }
    // white bib: a rounded, tilted blob that sits close under the beak and curves down into the breast
    function bibD(x, y) {
      const cx = 63.5, cy = 115.5, a = -0.38, ca = Math.cos(a), sa = Math.sin(a);
      let dx = x - cx, dy = y - cy;
      if (dx < 0) dx = dx * 19 / (19 + breath);            // breath: the bib's front swells by one cell
      const rx = dx * ca + dy * sa, ry = -dx * sa + dy * ca;
      // egg shape: fuller at the breast, narrower up at the throat
      const e = Math.hypot(rx / (17.5 + (ry > 0 ? 1.5 : -2.5) * Math.min(1, Math.abs(ry) / 24)), ry / 24);
      // throat lobe that hugs the underside of the lower mandible
      let tx = x - 59, ty = y - 103.5;
      if (tx < 0) tx = tx * 9 / (9 + breath);
      const tl = Math.hypot((tx * 0.82 - ty * 0.57) / 10, (tx * 0.57 + ty * 0.82) / 6.5);
      return Math.min(e, tl);
    }
    // wing scale network: jittered Voronoi cells, broken dark crevice edges (like the reference's scales)
    function scales(x, y) {
      const sx = x * 0.9 + y * 0.25, sy = y * 1.15 - x * 0.2, S = 5.2;
      const gx = Math.floor(sx / S), gy = Math.floor(sy / S);
      let d1 = 1e9, d2 = 1e9, id = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const cx = (gx + ox + 0.15 + 0.7 * h2(gx + ox, gy + oy, 81)) * S;
        const cy = (gy + oy + 0.15 + 0.7 * h2(gx + ox, gy + oy, 83)) * S;
        const d = Math.hypot(sx - cx, sy - cy);
        if (d < d1) { d2 = d1; d1 = d; id = (gx + ox) * 131 + gy + oy; } else if (d < d2) d2 = d;
      }
      return { edge: d2 - d1, id };
    }

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = jag(x, y);
      const [u, v] = toBeak(x, y);
      const face = u > -9 && u < 1 && v < topEdge(0) - 1 + u * 0.3 && v > botEdge(0) + 1;
      const inHead = head(x, y) * 17 + j > 0 || face;
      const inBody = y > 93 && x - bodyFront(y) + j > 0 && bodyBack(y) - x + j > 0;
      if (!(inHead || inBody)) { /* background */ }
      else {
        let c = K;
        const wing = (x - 76) / 28 + (y - 100) / 70 + (vnoise(x, y, 3, 41) - 0.5) * 0.5;
        if (wing > 0.62 && y > 100) {
          // ---- folded wing: blue-black plane, irregular scale crevices, lit feather patches at the shoulder ----
          c = KD;
          const sc = scales(x, y);
          if (sc.edge < 0.95 && h2(sc.id, 1, 85) < 0.72 && vnoise(x, y, 2.5, 87) > 0.3) c = K;
          const sh = 1.1 - Math.hypot((x - 95) / 13, (y - 107) / 10) + (fbm(x, y, 2.4, 89) - 0.5) * 1.1;
          if (sh > 0.5 && sc.edge > 0.9) c = KS;
          if (y > 128 && sc.edge < 1.6 && h2(sc.id, 2, 91) < 0.5) c = K;   // the lower wing sinks into shadow
          if (h2(x, y, 43) < 0.025) c = K;
        } else if (y < 106 || x > 80) {
          // ---- head: sphere lit from the upper left, posterized into 3 blue-blacks ----
          const nx = (x - 82) / 19, ny = (y - 86) / 19, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          let l = -0.55 * nx - 0.7 * ny + 0.45 * nz - 0.2;
          // crown & forehead catch the light; a subtle cheek plane behind/below the eye
          l += 0.35 * Math.max(0, 1 - Math.hypot((x - 79) / 8, (y - 74) / 5));
          l += 0.3 * Math.max(0, 1 - Math.hypot((x - 89) / 5, (y - 94) / 4));
          // dark under the eye and at the back of the head
          l -= 0.6 * Math.max(0, 1 - Math.hypot((x - 81) / 5, (y - 92) / 2.6));
          l -= 0.5 * clamp((x - 93) / 6, 0, 1);
          l += (fbm(x, y, 2.6, 3) - 0.5) * 0.65;
          c = l > 0.62 ? KS : l > 0.3 ? KD : K;
          if (c !== K && h2(x, y, 47) < 0.06) c = K;            // tiny feather crevices
        } else {
          // ---- breast beside / below the bib: mostly black, a few dull sheen patches ----
          // breast beside / below the bib: lit along its rounded upper-left, sinking into black below
          const l = 0.55 - (x - bodyFront(y)) / 12 - (y - 112) / 50 + (fbm(x, y, 2.8, 93) - 0.5) * 1.1;
          c = l > 0.62 ? KS : l > 0.2 ? KD : K;
          if (c !== K && h2(x, y, 95) < 0.07) c = K;
        }
        out[i] = c;
        // ---- white throat bib ----
        const bd = bibD(x, y) + (vnoise(x, y, 2.0, 21) - 0.5) * 0.14;
        const bibTop = -4.5 + 2.4 * clamp(-u, 0, 5.5) + (vnoise(x, y, 2, 23) - 0.5) * 2;
        if (bd < 1 && v < bibTop) {
          // light from the upper left: white -> cream -> grey-cream toward the shaded right / bottom
          let w = 1.0 - (x - 50) / 30 - (y - 98) / 36 - Math.pow(bd, 3) * 0.3;
          if (y < 108 && x > 60) w -= 0.45 * clamp(1 - (y - 94) / 14, 0, 1);  // shadow under the lower mandible
          w += (fbm(x, y, 2.6, 17) - 0.5) * 0.9;
          let wc = w > 0.05 ? WH : w > -0.5 ? CR : GC;
          // broken feather marks: short scalloped strokes one tone darker
          const r = (y + x * 0.45 + (vnoise(x, y, 4, 75) - 0.5) * 3.5) / 3.6, row = Math.floor(r), fr = r - row;
          const seg = Math.floor((x - row * 2.1 + vnoise(x, y, 3, 77) * 5) / 3.4);
          if (fr < 0.22 + 0.15 * h2(seg, row, 52) && h2(seg, row, 51) < 0.3) wc = wc === WH ? CR : GC;
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
