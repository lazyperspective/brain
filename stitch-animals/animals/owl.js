// Great horned owl: three-quarter bust, head tilted up and to the right, slow heavy blink.
(function () {
  const PAL = [
    '#127a74', // 0 background: deep teal / sea-green
    '#1e130c', // 1 near-black umber
    '#4d2f1b', // 2 dark brown
    '#7f5432', // 3 mid brown
    '#b5854f', // 4 light tan-brown
    '#dcb984', // 5 pale tan highlight
    '#f3e9d0', // 6 cream (facial disc, throat)
    '#f8a814', // 7 iris yellow-orange
    '#c9640c', // 8 iris shadow under the lid
    '#ffffff', // 9 glint
  ];
  const LOOP = 6, OY = 5;

  // ---------- deterministic helpers ----------
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s | 0) * 982451653) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    const top = a + (b - a) * sx, bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  }
  function fbm(x, y, s) { return 0.62 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.08 * vnoise(x * 4.3, y * 4.3, s + 13); }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // quantize a 0..1 luminance to plumage tones 1..5
  const tone = (L) => (L < 0.16 ? 1 : L < 0.36 ? 2 : L < 0.58 ? 3 : L < 0.8 ? 4 : 5);

  // ---------- geometry (grid 108 x 153) ----------
  const HC = { x: 57, y: 73 }, HRX = 32.5, HRY = 26, HROT = -0.24;
  const CR = Math.cos(HROT), SR = Math.sin(HROT);
  // head-local frame (u right, v down, both ~-1..1 over the head)
  function hl(x, y) {
    const dx = x - HC.x, dy = y - HC.y;
    return { u: (dx * CR + dy * SR) / HRX, v: (-dx * SR + dy * CR) / HRY };
  }
  // head-local -> grid
  function hg(u, v) {
    const dx = u * HRX, dy = v * HRY;
    return { x: HC.x + dx * CR - dy * SR, y: HC.y + dx * SR + dy * CR };
  }
  function headField(x, y) {
    const { u, v } = hl(x, y);
    // flatter crown, fuller cheeks
    const e = Math.pow(Math.abs(u), 2.3) + Math.pow(Math.abs(v), v < 0 ? 2.6 : 2.0);
    return e + (fbm(x * 0.3, y * 0.3, 3) - 0.5) * 0.12;
  }
  const inHead = (x, y) => headField(x, y) < 1;

  // body: two rounded wing-shoulders and a chest, rising from the bottom edge
  // half-width of the body at row y: rounded wing-shoulders rising from the bottom edge
  function bodyHalf(y) {
    if (y < 86) return -1;
    const k = clamp((y - 86) / 36, 0, 1);
    return 22 + 14 * Math.sqrt(k * (2 - k)) + clamp((y - 118) / 35, 0, 1) * 5;
  }
  const bodyCx = (y) => 57 - clamp((y - 90) / 50, 0, 1) * 3;
  function bodyField(x, y) {
    const w = bodyHalf(y);
    if (w < 0) return 2;
    return Math.abs(x - bodyCx(y)) / w + (fbm(x * 0.5, y * 0.5, 5) - 0.5) * 0.06;
  }
  const inBody = (x, y) => bodyField(x, y) < 1;
  // wing vs chest split (the folded wings' leading edges)
  // edges bow inward a little at mid-height, like folded wings wrapping the breast
  const wingL = (y) => bodyCx(y) - bodyHalf(y) * (0.5 + 0.12 * Math.sin(clamp((y - 92) / 70, 0, 1) * Math.PI)) - 1.5;
  const wingR = (y) => bodyCx(y) + bodyHalf(y) * (0.55 + 0.1 * Math.sin(clamp((y - 92) / 70, 0, 1) * Math.PI));
  function wingSide(x, y) {
    if (x < wingL(y)) return -1;
    if (x > wingR(y)) return 1;
    return 0;
  }

  const EYES = [
    { x: 50.5, y: 72.5, r: 8.3, inner: 1 },     // near (left) eye; inner corner on its right
    { x: 72.7, y: 66.8, r: 7.3, inner: -1 }, // far (right) eye, slightly foreshortened
  ];
  const BEAK = { x: 63.5, y: 74.5 };

  // facial disc: two lobes around the eyes plus the muzzle under the beak
  function discField(x, y) {
    const e0 = EYES[0], e1 = EYES[1];
    const a = Math.hypot((x - e0.x + 1.6) / 15.6, (y - e0.y - 2.7) / 15.1);
    const b = Math.hypot((x - e1.x - 1.6) / 11.3, (y - e1.y - 2.7) / 14);
    const mid = Math.hypot((x - BEAK.x) / 9.7, (y - BEAK.y - 5.4) / 9.7);
    return Math.min(a, b, mid);
  }

  // ---------- static layer ----------
  let STATIC = null;
  function buildStatic(W, H) {
    const A = new Uint8Array(W * H);
    const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? A[y * W + x] : 0);
    const set = (x, y, i) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) A[y * W + x] = i; };
    // despeckle: lone base-tone cells join their neighbours (keeps patches, drops salt-and-pepper);
    // run on the base tones only, before the deliberate feather marks go on
    function despeckle(keep) {
      const B = A.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const v = B[y * W + x];
        if (v < 1 || v > 5 || !keep(x, y)) continue;
        const nb = [B[y * W + x - 1], B[y * W + x + 1], B[(y - 1) * W + x], B[(y + 1) * W + x]];
        if (nb.includes(v) || nb.includes(0)) continue;
        const cnt = {};
        let best = v, bc = 0;
        for (const n of nb) { cnt[n] = (cnt[n] || 0) + 1; if (cnt[n] > bc) { bc = cnt[n]; best = n; } }
        if (bc >= 2) A[y * W + x] = best;
      }
    }

    // ---- body ----
    for (let y = 85; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inBody(x, y)) continue;
      const side = wingSide(x, y);
      const dx = (x - bodyCx(y)) / bodyHalf(y);
      const nz = Math.sqrt(Math.max(0, 1 - dx * dx));
      const top = clamp(1 - (y - 92) / 30, 0, 1);       // top planes of the shoulders catch light
      const lam = clamp(-0.6 * dx + 0.6 * nz + top * 0.25, 0, 1);
      const n = fbm(x * 0.13, y * 0.13, 17) - 0.5;
      let L;
      if (side === 0) L = 0.37 + 0.45 * lam + n * 0.45;
      else if (side < 0) L = 0.12 + 0.55 * lam + n * 0.45;
      else L = 0.14 + 0.36 * lam + n * 0.4 - clamp((dx - 0.85) / 0.15, 0, 1) * 0.12;
      // cast shadow under the head
      L -= clamp((99 - y) / 8, 0, 1) * 0.4;
      // the low body settles into two or three big flat tones
      const flat = clamp((y - 124) / 14, 0, 1);
      const flatL = side === 0 ? 0.5 - dx * 0.3 + (fbm(x * 0.07, y * 0.07, 23) - 0.5) * 0.25 : side < 0 ? 0.3 : 0.24;
      L = L * (1 - flat) + flatL * flat + (fbm(x * 0.09, y * 0.09, 19) - 0.5) * 0.12 * flat;
      set(x, y, tone(clamp(L, 0, 1)));
    }
    despeckle(inBody);
    // dark crevice along the folded wing edges
    for (let y = 96; y < H; y++) {
      // broken into short runs that jog sideways, like a real fold between feather masses
      const seg = Math.floor(y / 3);
      const flat = y > 128;
      const xl = Math.round(wingL(y)) + (hash(seg, 1, 6) > 0.7 ? -1 : 0), xr = Math.round(wingR(y)) + (hash(seg, 2, 6) > 0.7 ? 1 : 0);
      if (inBody(xl, y) && hash(seg, 3, 6) > 0.3) set(xl, y, flat ? 2 : 1);
      if (inBody(xr, y) && hash(seg, 4, 6) > 0.3) set(xr, y, flat ? 1 : 2);
    }
    // chest barring: jittered small chevrons, darker than the local tone, thinning out low down
    for (let gy = 100; gy < 140; gy += 3.2) for (let gx = 28; gx < 90; gx += 5) {
      const r = Math.round((gy - 100) / 3.2);
      const cx = Math.round(gx + (r % 2) * 2.5 + (hash(gx | 0, r, 33) - 0.5) * 2.5);
      const cy = Math.round(gy + (hash(gx | 0, r, 34) - 0.5) * 1.6);
      if (!inBody(cx, cy) || wingSide(cx, cy) !== 0 || wingSide(cx - 3, cy) !== 0 || wingSide(cx + 3, cy) !== 0) continue;
      const fade = clamp((cy - 118) / 16, 0, 1);
      if (fade > 0.75 || hash(cx, cy, 35) < 0.08 + fade * 0.85) continue;
      // small feather marks: U scallops, V chevrons and short drooping bars
      const kind = hash(cx, cy, 36);
      const shape = kind < 0.4 ? [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]]
        : kind < 0.7 ? [[-1, 0], [0, 1], [1, 0]]
        : kind < 0.85 ? [[-2, 0], [-1, 0], [0, 0], [1, 1]]
        : [[-1, 1], [0, 0], [1, 0], [2, 0]];
      for (const [i, j] of shape) {
        const base = get(cx + i, cy + j);
        if (base < 2 || base > 5) continue;
        set(cx + i, cy + j, Math.max(1, base - 2));
      }
      if (hash(cx, cy, 39) > 0.55) { const base = get(cx, cy - 1); if (base >= 3 && base <= 4) set(cx, cy - 1, base + 1); }
    }
    // wing coverts: rows of rounded feathers, each a pale crown over a dark U-shaped tip
    for (let gy = 95; gy < 140; gy += 4.6) for (let gx = 0; gx < 108; gx += 6) {
      const r = Math.round((gy - 95) / 4.6);
      const cx = Math.round(gx + (r % 2) * 3 + (hash(gx | 0, r, 43) - 0.5) * 2);
      const cy = Math.round(gy + (hash(gx | 0, r, 44) - 0.5) * 1.4 + Math.abs(cx - 57) * 0.06);
      const sd = wingSide(cx, cy);
      if (!inBody(cx, cy) || !inBody(cx, cy + 3) || sd === 0 || wingSide(cx - 3 * sd, cy) === 0) continue;
      const fade = clamp((cy - 116) / 18, 0, 1);
      if (hash(cx, cy, 45) < 0.1 + fade * 0.85) continue;
      const w = 2 + (hash(cx, cy, 46) > 0.55 ? 1 : 0);
      // pale feather body (lit from the upper left)
      if (hash(cx, cy, 48) > 0.3) for (let j = -2; j <= 0; j++) for (let i = -w + 1; i <= w - 1 + j; i++) {
        const base = get(cx + i, cy + j);
        if (base >= 2 && base <= 4 && hash(cx + i, cy + j, 49) > 0.2) set(cx + i, cy + j, base + 1);
      }
      // dark U tip
      for (let i = -w; i <= w; i++) {
        const yy = cy + (Math.abs(i) < w ? 1 : 0) + (Math.abs(i) <= w - 2 ? 1 : 0);
        const base = get(cx + i, yy);
        if (base >= 2 && base <= 5 && hash(cx + i, yy, 47) > 0.08) set(cx + i, yy, Math.max(1, base - 2));
      }
    }
    // ---- head ----
    for (let y = 40; y < 105; y++) for (let x = 0; x < W; x++) {
      if (!inHead(x, y)) continue;
      const { u, v } = hl(x, y);
      const nz = Math.sqrt(Math.max(0, 1 - 0.75 * (u * u + v * v)));
      const lam = clamp(-0.55 * u - 0.55 * v + 0.6 * nz, 0, 1);
      let L = 0.0 + 0.78 * lam + (fbm(x * 0.2, y * 0.2, 11) - 0.5) * 0.5;
      // edges of the head fall into shadow (no outline, just darker)
      L -= clamp((headField(x, y) - 0.78) / 0.22, 0, 1) * 0.22;
      set(x, y, tone(clamp(L, 0, 1)));
    }
    despeckle(inHead);
    // crown + side scallops, rows following the head curvature
    for (let gv = -1.0; gv < 0.9; gv += 0.17) for (let gu = -1.1; gu < 1.1; gu += 0.18) {
      const r = Math.round((gv + 1) / 0.17);
      const uu = gu + (r % 2) * 0.09 + (hash(r, Math.round(gu * 50), 51) - 0.5) * 0.06;
      const p = hg(uu, gv);
      const cx = Math.round(p.x), cy = Math.round(p.y);
      if (headField(cx, cy) > 0.9 || discField(cx, cy) < 1.15) continue;
      if (hash(cx, cy, 52) < 0.25) continue;
      const w = 1 + (hash(cx, cy, 53) > 0.45 ? 1 : 0);
      for (let i = -w; i <= w; i++) {
        const yy = cy + (Math.abs(i) < w ? 1 : 0);
        if (discField(cx + i, yy) < 1.1) continue;
        const base = get(cx + i, yy);
        if (base >= 1 && base <= 5 && hash(cx + i, yy, 54) > 0.12) set(cx + i, yy, Math.max(1, base - 2));
      }
      if (hash(cx, cy, 55) > 0.45) {
        const base = get(cx - 1, cy - 1);
        if (base >= 2 && base <= 4) { set(cx - 1, cy - 1, base + 1); if (hash(cx, cy, 56) > 0.5) set(cx, cy - 1, base + 1); }
      }
    }

    // ---- facial disc ----
    for (let y = 55; y < 100; y++) for (let x = 0; x < W; x++) {
      if (!inHead(x, y)) continue;
      const d = discField(x, y);
      if (d > 1) continue;
      const n = fbm(x * 0.28, y * 0.28, 61);
      const { u, v } = hl(x, y);
      // rim: the dark 'parentheses' around the outer sides and chin, broken
      if (d > 0.86 && v > -0.25) {
        set(x, y, n + hash(x, y, 62) * 0.3 > 0.55 ? 1 : 2);
        continue;
      }
      // radial feather streaks from each eye
      let streak = 0;
      for (const e of EYES) {
        const ang = Math.atan2(y - e.y, x - e.x), dist = Math.hypot(x - e.x, y - e.y);
        if (dist > e.r + 1.5) streak += (Math.sin(ang * 11 + 1.3) > 0.82 ? 1 : 0) * clamp((dist - e.r) / 6, 0, 1);
      }
      let L = 0.78 - u * 0.25 + v * 0.05 + (n - 0.5) * 0.55 - streak * 0.22 - clamp((d - 0.6) / 0.3, 0, 1) * 0.18;
      set(x, y, L > 0.7 ? 6 : L > 0.5 ? 5 : L > 0.32 ? 4 : 3);
    }
    // eye surround: dark ring outside each eye
    for (const e of EYES) for (let y = Math.floor(e.y - e.r - 3); y <= e.y + e.r + 3; y++) for (let x = Math.floor(e.x - e.r - 3); x <= e.x + e.r + 3; x++) {
      const dd = Math.hypot(x - e.x, y - e.y);
      if (dd < e.r + 1.6 && dd > e.r - 0.5) set(x, y, hash(x, y, 63) > 0.3 ? 2 : 3);
    }
    // brows: pale feathers in a V whose point sits at the beak base (inner ends low = grumpy),
    // running up and out toward the tufts, with a dark line beneath
    for (const e of EYES) {
      const ix = BEAK.x - e.inner * 1.5, iy = BEAK.y - 4;                 // inner end
      const ox = e.x - e.inner * (e.r + 3.5), oy = e.y - e.r - 4.5 - (e.inner < 0 ? 1 : 0); // outer end
      const n = Math.ceil(Math.hypot(ox - ix, oy - iy) * 2);
      for (let k = 0; k <= n; k++) {
        const f = k / n, bx = ix + (ox - ix) * f, by = iy + (oy - iy) * f - Math.sin(f * Math.PI) * 1.2;
        const th = f < 0.15 ? 1 : f > 0.85 ? 1 : 2 + (f > 0.3 && f < 0.7 ? 1 : 0);
        for (let j = 0; j < th; j++) {
          const yy = Math.round(by - j - 0.5), xx = Math.round(bx);
          const L = 0.72 - j * 0.08 + (hash(xx, yy, 64) - 0.5) * 0.4 - (e.inner < 0 ? 0.1 : 0) - f * 0.12;
          set(xx, yy, L > 0.62 ? 6 : L > 0.42 ? 5 : 4);
        }
        set(Math.round(bx), Math.round(by + 0.5), 1);
      }
    }
    // pale bristles between the eyes, around the beak
    for (let y = 66; y < 92; y++) for (let x = 52; x < 72; x++) {
      const d = Math.hypot((x - BEAK.x) / 5, (y - BEAK.y - 3) / 9);
      if (d < 1 && hash(x, y, 65) > 0.25) set(x, y, d < 0.6 ? 6 : 5);
    }

    // ---- throat bib ----
    for (let y = 86; y < 106; y++) for (let x = 30; x < 92; x++) {
      const dx = x - 64, dy = y - 92;
      const u = dx * CR + dy * SR, v = -dx * SR + dy * CR;
      const d = Math.hypot(u / 17, v / 7) + (fbm(x * 0.45, y * 0.45, 71) - 0.5) * 0.35;
      if (d < 1) set(x, y, d < 0.62 - u * 0.012 ? 6 : 5);
      else if (d < 1.25 && v > 0 && get(x, y) > 1) set(x, y, Math.max(1, get(x, y) - 1));
    }

    // ---- beak (small, dark, hooked) ----
    const beak = [
      '.1111.',
      '122221',
      '123221',
      '.1321.',
      '.1221.',
      '..121.',
      '..11..',
      '...1..',
    ];
    beak.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') set(BEAK.x - 3 + i, BEAK.y + j, +c); }));
    return A;
  }

  // ---------- animation ----------
  // blink: lid fraction 0 (open, heavy grumpy hood) .. 1 (closed), pixel-stepped in 6 positions
  const B0 = 2.0, BC = 0.45, BH = 0.25, BO = 0.65;
  function lidAt(t) {
    let f = 0;
    if (t >= B0 && t < B0 + BC) f = (t - B0) / BC;
    else if (t >= B0 + BC && t < B0 + BC + BH) f = 1;
    else if (t >= B0 + BC + BH && t < B0 + BC + BH + BO) f = 1 - (t - B0 - BC - BH) / BO;
    f = f * f * (3 - 2 * f);
    return Math.round(f * 6) / 6;
  }
  const pupilBoost = (t) => (t > B0 + BC + BH + BO + 0.1 && t < 5.4 ? 1 : 0);
  const sway = (t, ph) => (Math.sin(2 * Math.PI * (t / LOOP) + ph) > 0.1 ? 1 : 0);

  function drawEye(g, e, lid, boost) {
    const R = e.r;
    const px = e.x + 0.9, py = e.y - 1.4; // gaze up and a touch right
    for (let y = Math.floor(e.y - R - 2); y <= e.y + R + 2; y++) for (let x = Math.floor(e.x - R - 2); x <= e.x + R + 2; x++) {
      const d = Math.hypot(x - e.x, y - e.y);
      if (d > R + 0.6) continue;
      if (d > R - 0.4) { g.set(x, y, 1); continue; }
      const pd = Math.hypot(x - px, y - py);
      g.set(x, y, pd < R * 0.44 + boost ? 1 : 7);
    }
    // glint upper-left of the pupil
    g.set(Math.round(px - 1.5), Math.round(py - 1.2), 9);
    // upper lid: open position hoods the top of the eye with an inward slant
    const top = e.y - R - 1, span = 2 * R + 2;
    for (let x = Math.floor(e.x - R - 1); x <= e.x + R + 1; x++) {
      const k = ((x - e.x) / R) * e.inner; // +1 at the inner corner
      const q = (x - e.x) / R;
      const edge = top + span * (0.27 + 0.45 * lid) + k * 2.2 * (1 - lid) + (1 - q * q) * 1.8 * lid; // sags into an arc as it closes
      for (let y = Math.floor(top); y <= e.y + R + 1; y++) {
        const d = Math.hypot(x - e.x, y - e.y);
        if (d > R + 0.6) continue;
        if (y < edge - 1.5) {
          // feathered lid: lit along the top-left, darker toward the rim, in soft patches
          const dl = (edge - 1.5 - y) / span;                    // 0 at the rim, grows upward
          const L = 0.38 + dl * 0.5 - ((x - e.x) / R) * 0.12 + (fbm(x * 0.45, y * 0.45, 72) - 0.5) * 0.35 + (e.inner < 0 ? -0.08 : 0);
          g.set(x, y, L > 0.62 ? 5 : L > 0.45 ? 4 : L > 0.28 ? 3 : 2);
        } else if (y < edge) g.set(x, y, 1);
        else if (lid > 0.99) g.set(x, y, hash(x, y, 73) > 0.5 ? 3 : 4); // lower lid when shut
        else if (y < edge + 1.2 && g.get(x, y) === 7) g.set(x, y, 8); // lid shadow on the iris
      }
    }
  }

  window.ANIMAL = {
    name: 'owl', loop: LOOP, bg: 0, palette: PAL,
    draw(g0, t) {
      if (!STATIC) STATIC = buildStatic(g0.w, g0.h);
      // the whole bird sits OY cells lower on the canvas than its design coordinates
      const g = { w: g0.w, h: g0.h, set: (x, y, i) => g0.set(x, y + OY, i), get: (x, y) => g0.get(x, y + OY) };
      // ear tufts (behind the head edge); upper part sways one cell in the breeze
      const tufts = [
        { base: hg(-0.58, -0.74), w: 6, tip: hg(-0.93, -1.5), ph: 0, out: -1 },
        { base: hg(0.5, -0.86), w: 5.5, tip: hg(0.8, -1.56), ph: 0.6, out: 1 },
      ];
      for (const tf of tufts) {
        const s = sway(t, tf.ph);
        // quadratic centreline bowing outward, so the tufts flare like feather horns
        const mx = (tf.base.x + tf.tip.x) / 2 + tf.out * 2.5, my = (tf.base.y + tf.tip.y) / 2;
        const pts = [];
        for (let i = 0; i <= 80; i++) {
          const q = i / 80;
          pts.push({
            q,
            x: (1 - q) * (1 - q) * tf.base.x + 2 * q * (1 - q) * mx + q * q * tf.tip.x + s * clamp((q - 0.35) / 0.65, 0, 1) ** 2,
            y: (1 - q) * (1 - q) * tf.base.y + 2 * q * (1 - q) * my + q * q * tf.tip.y,
          });
        }
        const x0 = Math.floor(Math.min(tf.base.x, tf.tip.x, mx) - tf.w - 2), x1 = Math.ceil(Math.max(tf.base.x, tf.tip.x, mx) + tf.w + 2);
        for (let y = Math.floor(tf.tip.y) - 1; y < tf.base.y + 8; y++) for (let x = x0; x <= x1; x++) {
          let best = 1e9, bq = 0, bi = 0;
          for (let i = 0; i < pts.length; i++) {
            const dd = (x - pts[i].x) ** 2 + (y - pts[i].y) ** 2;
            if (dd < best) { best = dd; bq = pts[i].q; bi = i; }
          }
          const half = tf.w * Math.pow(1 - bq, 0.8) + 0.6;
          const dist = Math.sqrt(best);
          if (dist > half || (bq > 0.995 && dist > 0.8)) continue;
          // signed side: negative = left (lit) of the centreline
          const p0 = pts[Math.max(0, bi - 1)], p1 = pts[Math.min(80, bi + 1)];
          const cross = (p1.x - p0.x) * (y - p0.y) - (p1.y - p0.y) * (x - p0.x);
          const d = (cross > 0 ? -1 : 1) * dist / half * (tf.out < 0 ? 1 : 1);
          // ragged feather edge, in short runs
          if (dist > half - 1 && bq > 0.2 && hash(Math.floor(x / 2), Math.floor(y / 2), 91) > 0.62) continue;
          let L = 0.36 - d * 0.22 + (fbm(x * 0.35, y * 0.2, 81) - 0.5) * 0.35 - bq * 0.08;
          if (d < -0.55) L += 0.2;                                     // pale lit edge
          if (Math.abs(d - 0.15) < 0.22 && bq > 0.1 && bq < 0.85) L -= 0.25; // dark central shaft
          g.set(x, y, tone(clamp(L, 0, 1)));
        }
      }
      for (let y = OY; y < g0.h; y++) for (let x = 0; x < g0.w; x++) { const v = STATIC[(y - OY) * g0.w + x]; if (v) g0.a[y * g0.w + x] = v; }
      const lid = lidAt(t), boost = pupilBoost(t);
      for (const e of EYES) drawEye(g, e, lid, boost);
    },
  };
})();
