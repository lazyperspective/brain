/* Small World — Small Infinities, piece 1.
 *
 * A pocket planet turning once in twenty seconds. The surface is a seamless longitude-wrapped map built
 * once from 3D noise on the sphere (so it has no seam and no pinched poles) and read back through a true
 * orthographic sphere projection, so continents slide around the curve and foreshorten at the limb.
 * Lighting is fixed in screen space, which means every pixel’s light level, sun-glint and shadow-offset
 * lookups are precomputed; each frame only shifts the map. Light is done with palette ramps and stepped,
 * Bayer-dithered bands, never smooth shading. The cloud deck turns twice per loop and drops shadows on
 * the ground; storms flash on the night side, cities twinkle, an aurora ripples over the north pole,
 * and a tidally locked moon makes one orbit per loop, crossing the sun line (its shadow runs across the
 * day side) and the anti-sun line (it turns copper in the planet’s shadow before slipping behind it).
 * 270 × 338 art pixels, 39 colours, shown at 4×. Every frame is a pure function of t.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const AW = 270, AH = 338, NP = AW * AH, D = 20;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, t) => a + (b - a) * t;
  const CX = 135, CY = 168, R = 81;              // the planet, in art pixels
  const TW = 512, TH = 256, TN = TW * TH, TM = TW - 1;   // surface and cloud maps (lon × lat)

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 977, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* ================================================================ palette (39) */
  const P = {}, PAL_HEX = [];
  const C = (name, hex) => { P[name] = PAL_HEX.length; PAL_HEX.push(hex); };
  C('void', '04050c'); C('sp1', '0b0e20'); C('sp2', '151b38'); C('neb1', '1b1540'); C('neb2', '2a1d52');
  C('st1', '4a5480'); C('st2', 'a8b4d8'); C('white', 'f4f6ff');
  C('oc1', '0d1838'); C('oc2', '13285c'); C('oc3', '1a3f86'); C('oc4', '2360ae'); C('oc5', '3586cc');
  C('sh1', '2c9ccc'); C('sh2', '58c4d8'); C('gl', 'b8eef0');
  C('ic1', '6c7ca8'); C('ic2', 'a8bcd8'); C('ic3', 'e4ecf8');
  C('de1', '6a4630'); C('de2', 'a8743e'); C('de3', 'd8a860'); C('de4', 'f0d08a');
  C('ve0', '173826'); C('ve1', '23502e'); C('ve2', '4f8c34'); C('ve3', '86bc4a');
  C('ro1', '4a3c40'); C('ro2', '7a6458'); C('ro3', 'ae9480');
  C('cl0', '262c4c'); C('cl1', '6a7498'); C('cl3', 'dfe6f4');
  C('ci1', 'b8682c'); C('ci2', 'f4b04c'); C('ci3', 'fff0c0');
  C('au1', '1c5a48'); C('au2', '2fae74'); C('au3', '86f0a4');
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);

  // biomes and their light ramps: [night, dusk, shade, lit, bright]
  const B_DEEP = 0, B_OCEAN = 1, B_SHALLOW = 2, B_SEAICE = 3, B_DESERT = 4, B_GRASS = 5, B_FOREST = 6, B_ROCK = 7, B_SNOW = 8, B_TUNDRA = 9;
  const RAMP = [
    ['sp1', 'oc1', 'oc2', 'oc3', 'oc4'],
    ['sp1', 'oc1', 'oc3', 'oc4', 'oc5'],
    ['sp1', 'oc2', 'oc4', 'sh1', 'sh2'],
    ['sp2', 'cl0', 'ic1', 'ic2', 'ic3'],
    ['sp2', 'de1', 'de2', 'de3', 'de4'],
    ['sp2', 've0', 've1', 've2', 've3'],
    ['sp2', 've0', 've0', 've1', 've2'],
    ['sp2', 'ro1', 'ro1', 'ro2', 'ro3'],
    ['sp2', 'ic1', 'ic2', 'ic3', 'white'],
    ['sp2', 've0', 'ro1', 'ro2', 'ro3'],
  ].map((r) => r.map((n) => P[n]));
  // a sixth, over-bright step for sunlit mountain faces
  const RAMP_UP = [P.oc5, P.sh1, P.sh2, P.ic3, P.de4, P.ve3, P.ve3, P.ic2, P.white, P.ic2];
  const CLOUD = ['cl0', 'cl1', 'st2', 'cl3', 'white'].map((n) => P[n]);
  const MOON = ['sp2', 'cl0', 'cl1', 'st2', 'cl3'].map((n) => P[n]);

  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => B4[((y & 3) << 2) | (x & 3)];
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  const bay8 = (x, y) => (B8[((y & 7) << 3) | (x & 7)] + 0.5) / 64;

  /* ================================================================ noise */
  const PERM = new Uint8Array(512);
  function initNoise(seed) {
    const r = mulberry32(seed), p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = fl(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function grad(hash, x, y, z) {
    const h = hash & 15, u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function noise3(x, y, z) {
    const X = fl(x), Y = fl(y), Z = fl(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = PERM[xi] + yi, AA = PERM[A] + zi, AB = PERM[A + 1] + zi;
    const B = PERM[xi + 1] + yi, BA = PERM[B] + zi, BB = PERM[B + 1] + zi;
    return mix(
      mix(mix(grad(PERM[AA], x, y, z), grad(PERM[BA], x - 1, y, z), u), mix(grad(PERM[AB], x, y - 1, z), grad(PERM[BB], x - 1, y - 1, z), u), v),
      mix(mix(grad(PERM[AA + 1], x, y, z - 1), grad(PERM[BA + 1], x - 1, y, z - 1), u), mix(grad(PERM[AB + 1], x, y - 1, z - 1), grad(PERM[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  function fbm(x, y, z, oct) {
    let s = 0, a = 0.5, f = 1;
    for (let o = 0; o < oct; o++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
    return s;
  }

  /* ================================================================ geometry */
  const nrm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
  const L = nrm(-0.85, -0.2, 0.45);                   // the sun, view space (x right, y up, z to viewer)
  const HV = nrm(L[0], L[1], L[2] + 1);               // half vector for the glint
  const TILT = 25 * Math.PI / 180, ROLL = -20 * Math.PI / 180;
  const ct = Math.cos(TILT), stl = Math.sin(TILT), cr = Math.cos(ROLL), sr = Math.sin(ROLL);
  const V3 = [0, 0, 0];
  function toBody(x, y, z) {   // view → tilted (non-spinning) planet frame
    const x1 = x * cr + y * sr, y1 = -x * sr + y * cr;
    V3[0] = x1; V3[1] = y1 * ct + z * stl; V3[2] = -y1 * stl + z * ct; return V3;
  }
  function toView(x, y, z) {   // tilted planet frame → view
    const y1 = y * ct - z * stl, z1 = y * stl + z * ct;
    V3[0] = x * cr - y1 * sr; V3[1] = x * sr + y1 * cr; V3[2] = z1; return V3;
  }
  function texCoord(x, y, z) {  // view-space unit vector → [row, lon in texels]
    const b = toBody(x, y, z);
    const lat = Math.asin(clamp(b[1], -1, 1));
    let lon = Math.atan2(b[0], b[2]); if (lon < 0) lon += TAU;
    return [clamp(fl((0.5 - lat / Math.PI) * TH), 0, TH - 1), lon / TAU * TW];
  }

  /* ================================================================ maps */
  const BIO = new Uint8Array(TN), HM = new Uint8Array(TN), CLD = new Uint8Array(TN);
  let CITIES = [];
  const STORMS = [   // [lat, lon] in the cloud frame, radius of the flash, cyclone spin (0 = plain thunderhead)
    [0.10, 0.70, 0.11, 0], [-0.06, 2.35, 0.10, 0], [0.42, 3.90, 0.16, 1], [-0.50, 5.45, 0.15, -1], [0.04, 4.80, 0.09, 0], [0.30, 1.60, 0.10, 0],
  ];
  const LANDFRAC = 0.40;

  function weightedLevel(arr, frac) {   // the value below which `frac` of the sphere’s area lies
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < TN; i++) { if (arr[i] < lo) lo = arr[i]; if (arr[i] > hi) hi = arr[i]; }
    const NB = 2048, hist = new Float64Array(NB);
    let tot = 0;
    for (let j = 0; j < TH; j++) {
      const w = Math.cos(Math.PI / 2 - (j + 0.5) / TH * Math.PI);
      for (let i = 0; i < TW; i++) { const v = arr[j * TW + i]; hist[clamp(fl((v - lo) / (hi - lo) * NB), 0, NB - 1)] += w; tot += w; }
    }
    let acc = 0;
    for (let b = 0; b < NB; b++) { acc += hist[b]; if (acc >= frac * tot) return lo + (b + 0.5) / NB * (hi - lo); }
    return hi;
  }

  function buildMaps() {
    initNoise(20261027);
    const H = new Float32Array(TN), MT = new Float32Array(TN), MO = new Float32Array(TN), CL = new Float32Array(TN), IC = new Float32Array(TN);
    const LAT = new Float32Array(TH);
    const SC = STORMS.map((s) => {
      const c = [Math.cos(s[0]) * Math.sin(s[1]), Math.sin(s[0]), Math.cos(s[0]) * Math.cos(s[1])];
      const e1 = nrm(c[2], 0, -c[0]);                         // east at the storm
      const e2 = [c[1] * e1[2] - c[2] * e1[1], c[2] * e1[0] - c[0] * e1[2], c[0] * e1[1] - c[1] * e1[0]];
      return { c, e1, e2, r: s[2] * 2.4, spin: s[3], core: s[2] };
    });
    for (let j = 0; j < TH; j++) {
      const lat = Math.PI / 2 - (j + 0.5) / TH * Math.PI; LAT[j] = lat;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < TW; i++) {
        const lon = (i + 0.5) / TW * TAU;
        const x = cl * Math.sin(lon), y = sl, z = cl * Math.cos(lon);
        const k = j * TW + i;
        const wx = noise3(x * 1.6 + 11.3, y * 1.6 + 3.1, z * 1.6 + 7.7);
        const wy = noise3(x * 1.6 - 5.2, y * 1.6 + 9.4, z * 1.6 - 2.6);
        const wz = noise3(x * 1.6 + 2.8, y * 1.6 - 7.1, z * 1.6 + 4.4);
        const qx = x + 0.5 * wx, qy = y + 0.5 * wy, qz = z + 0.5 * wz;
        H[k] = fbm(qx * 1.15 + 0.3, qy * 1.15, qz * 1.15 - 0.6, 5) + 0.05 * noise3(x * 9, y * 9, z * 9);
        const rg = 1 - Math.abs(noise3(qx * 2.4 + 40, qy * 2.4 + 13, qz * 2.4 - 8));
        MT[k] = rg * rg * rg * (0.75 + 0.5 * noise3(x * 3 + 70, y * 3, z * 3));
        MO[k] = fbm(x * 1.7 + 90, y * 1.7 + 4, z * 1.7 - 30, 3);
        IC[k] = noise3(x * 3.5 - 60, y * 3.5, z * 3.5 + 21) + 0.4 * noise3(x * 9 - 60, y * 9, z * 9 + 21);
        // clouds: zonal streaks, a wet equator, dry subtropics, thunderheads and two cyclones
        const al = Math.abs(lat);
        let c = 0.62 * fbm(x * 2.1 + 31, y * 4.6 - 12, z * 2.1 + 5, 5) + 0.3 * fbm(x * 5.2 - 17, y * 6.5 + 2, z * 5.2 + 40, 3);
        c += 0.16 * Math.exp(-(lat / 0.13) * (lat / 0.13)) - 0.13 * Math.exp(-((al - 0.42) / 0.12) * ((al - 0.42) / 0.12)) + 0.08 * Math.exp(-((al - 0.95) / 0.2) * ((al - 0.95) / 0.2));
        for (const s of SC) {
          const dt = x * s.c[0] + y * s.c[1] + z * s.c[2];
          const a = Math.acos(clamp(dt, -1, 1));
          if (a > s.r) continue;
          const f = 1 - a / s.r;
          if (s.spin) {
            const ps = Math.atan2(x * s.e2[0] + y * s.e2[1] + z * s.e2[2], x * s.e1[0] + y * s.e1[1] + z * s.e1[2]);
            const arm = Math.cos(2 * ps * s.spin + 7.5 * Math.log(a + 0.015));
            c = mix(c, 0.06 + 0.42 * arm + 0.12 * f, Math.min(1, f * 1.6));
            if (a < 0.022) c = -0.4;                       // the eye
          } else {
            c += f * (0.42 * f + 0.3 * noise3(x * 11 + 3, y * 11, z * 11) + 0.12 * noise3(x * 23, y * 23, z * 23 - 7));
          }
        }
        CL[k] = c;
      }
    }
    const sea = weightedLevel(H, 1 - LANDFRAC);
    const cThick = weightedLevel(CL, 0.855), cThin = weightedLevel(CL, 0.81);

    // land / water mask, cleaned of single-texel specks
    const LAND = new Uint8Array(TN);
    for (let k = 0; k < TN; k++) LAND[k] = H[k] > sea ? 1 : 0;
    for (let pass = 0; pass < 2; pass++) {
      const nx = LAND.slice();
      for (let j = 1; j < TH - 1; j++) for (let i = 0; i < TW; i++) {
        let s = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj) s += LAND[(j + dj) * TW + ((i + di) & TM)];
        const k = j * TW + i;
        if (LAND[k] && s <= 2) nx[k] = 0; else if (!LAND[k] && s >= 6) nx[k] = 1;
      }
      LAND.set(nx);
    }
    // distance to the coast (land side), for beaches of light
    const DIST = new Uint8Array(TN).fill(255);
    const q = new Int32Array(TN); let qh = 0, qt = 0;
    for (let k = 0; k < TN; k++) if (!LAND[k]) { DIST[k] = 0; q[qt++] = k; }
    while (qh < qt) {
      const k = q[qh++], j = (k / TW) | 0, i = k - j * TW, d = DIST[k] + 1;
      const nb = [j * TW + ((i + 1) & TM), j * TW + ((i - 1) & TM), j > 0 ? k - TW : -1, j < TH - 1 ? k + TW : -1];
      for (const n of nb) if (n >= 0 && DIST[n] > d) { DIST[n] = Math.min(254, d); q[qt++] = n; }
    }

    for (let j = 0; j < TH; j++) {
      const lat = LAT[j], al = Math.abs(lat);
      for (let i = 0; i < TW; i++) {
        const k = j * TW + i, e = H[k] - sea;
        const polar = al + 0.085 * IC[k] > 1.07;
        let b;
        if (!LAND[k]) {
          b = polar && al + 0.085 * IC[k] > 1.12 ? B_SEAICE : e > -0.035 ? B_SHALLOW : e > -0.12 ? B_OCEAN : B_DEEP;
        } else if (polar) b = B_SNOW;
        else {
          const m = MO[k] + 0.06 * Math.cos(lat * 2.2);
          const mt = MT[k];
          if (mt > 0.5 && DIST[k] > 2) b = mt > 0.74 ? B_SNOW : B_ROCK;
          else if (al > 0.9 + 0.06 * IC[k]) b = B_TUNDRA;
          else if (al > 0.22 && al < 0.68 && m < -0.03 && DIST[k] > 1) b = B_DESERT;
          else if (m > 0.07 || (al < 0.3 && m > -0.06)) b = B_FOREST;
          else b = B_GRASS;
        }
        BIO[k] = b;
        HM[k] = LAND[k] ? clamp(fl(MT[k] * 230), 0, 255) : 0;
        CLD[k] = clamp(fl(128 + (CL[k] - cThin) / (cThick - cThin) * 40), 0, 255);   // 128 = thin edge, 168 = thick edge
      }
    }

    // cities: lights strung along temperate coasts, a few inland towns
    const rng = mulberry32(4242);
    const isHome = (k) => LAND[k] && (BIO[k] === B_GRASS || BIO[k] === B_FOREST || BIO[k] === B_DESERT || BIO[k] === B_TUNDRA);
    const centres = [];
    for (let tries = 0; tries < 20000 && centres.length < 90; tries++) {
      const j = fl(TH * (0.2 + 0.6 * rng())), i = fl(TW * rng()), k = j * TW + i;
      if (!isHome(k) || DIST[k] > 5 || (BIO[k] === B_DESERT && DIST[k] > 2)) continue;
      if (centres.some((c) => Math.abs(c[0] - j) + Math.min(Math.abs(c[1] - i), TW - Math.abs(c[1] - i)) < 14)) continue;
      centres.push([j, i]);
    }
    const out = [];
    const add = (j, i, cls) => {
      const jj = clamp(Math.round(j), 0, TH - 1), ii = Math.round(i) & TM, k = jj * TW + ii;
      if (!isHome(k)) return;
      out.push({ lat: Math.PI / 2 - (j + 0.5) / TH * Math.PI, lon: (i + 0.5) / TW * TAU, cls, f: 1 + fl(rng() * 6), ph: rng(), thr: 0.55 + 0.4 * rng() });
    };
    for (const c of centres) {
      const n = 8 + fl(rng() * 22), sg = 1.2 + rng() * 2.8;
      add(c[0], c[1], 2);
      for (let m = 0; m < n; m++) {
        const g1 = Math.sqrt(-2 * Math.log(rng() + 1e-9)), g2 = TAU * rng();
        add(c[0] + g1 * Math.sin(g2) * sg * 0.8, c[1] + g1 * Math.cos(g2) * sg / Math.max(0.35, Math.cos(Math.PI / 2 - (c[0] + 0.5) / TH * Math.PI)), m < 3 ? 1 : 0);
      }
    }
    for (let m = 0; m < 420; m++) add(TH * (0.18 + 0.64 * rng()), TW * rng(), rng() < 0.15 ? 1 : 0);
    CITIES = out;
  }

  /* ================================================================ static per-pixel geometry */
  let NDK = 0;
  let DTERM, DPIX, DROW, DLON, DROWA, DLONA, DROWB, DLONB, DROWS, DLONS, DLEV, DGL, DNX, DNY, DNZ, DRIM;
  const LEVF = new Uint8Array(NP).fill(255), DKOF = new Int32Array(NP).fill(-1);
  const BG = new Uint8Array(NP), OUT = new Uint8Array(NP);
  let RIM = [];          // [pixel, colour] for the atmosphere outside the disc
  let AUR = null, AURPIX = null, AURACC = null;
  const STARS = [];

  function band(d, x, y) {   // light level 0..4 with a narrow ordered-dither seam at each step
    const e = d + (bay(x, y) - 0.5) * 0.06;
    return e < 0 ? 0 : e < 0.1 ? 1 : e < 0.3 ? 2 : e < 0.6 ? 3 : 4;
  }

  function buildGeometry() {
    const list = [];
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY;
      if (dx * dx + dy * dy < R * R) list.push(y * AW + x);
    }
    NDK = list.length;
    DPIX = Int32Array.from(list);
    DROW = new Int16Array(NDK); DLON = new Float32Array(NDK);
    DROWA = new Int16Array(NDK); DLONA = new Float32Array(NDK);
    DROWB = new Int16Array(NDK); DLONB = new Float32Array(NDK);
    DROWS = new Int16Array(NDK); DLONS = new Float32Array(NDK);
    DLEV = new Uint8Array(NDK); DTERM = new Uint8Array(NDK); DGL = new Uint8Array(NDK); DRIM = new Uint8Array(NDK);
    DNX = new Float32Array(NDK); DNY = new Float32Array(NDK); DNZ = new Float32Array(NDK);
    const off = (nx, ny, nz, dd, s) => {   // point on the sphere shifted along the sun’s tangent direction
      const tx = L[0] - dd * nx, ty = L[1] - dd * ny, tz = L[2] - dd * nz;
      return nrm(nx + s * tx, ny + s * ty, nz + s * tz);
    };
    for (let k = 0; k < NDK; k++) {
      const pi = DPIX[k], x = pi % AW, y = (pi / AW) | 0;
      const u = (x + 0.5 - CX) / R, v = -(y + 0.5 - CY) / R;
      const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      DNX[k] = u; DNY[k] = v; DNZ[k] = z;
      let tc = texCoord(u, v, z); DROW[k] = tc[0]; DLON[k] = tc[1];
      const d = u * L[0] + v * L[1] + z * L[2];
      let p = off(u, v, z, d, 1.6 / R); tc = texCoord(p[0], p[1], p[2]); DROWA[k] = tc[0]; DLONA[k] = tc[1];
      p = off(u, v, z, d, -1.6 / R); tc = texCoord(p[0], p[1], p[2]); DROWB[k] = tc[0]; DLONB[k] = tc[1];
      p = off(u, v, z, d, 3.2 / R / Math.max(0.3, d)); tc = texCoord(p[0], p[1], p[2]); DROWS[k] = tc[0]; DLONS[k] = tc[1];
      const lv = band(d, x, y);
      DLEV[k] = lv; LEVF[pi] = lv; DKOF[pi] = k;
      const te = d + (bay(x, y) - 0.5) * 0.03;
      DTERM[k] = lv === 1 && te < 0.03 ? 1 : 0;   // the last sunset on the cloud tops
      const s = u * HV[0] + v * HV[1] + z * HV[2], bb = (bay(x, y) - 0.5) * 0.002;
      DGL[k] = s + bb > 0.9985 ? 3 : s + bb > 0.995 ? 2 : s + bb > 0.987 ? 1 : 0;
      // the lit limb: a hairline of sky
      const r = Math.sqrt(u * u + v * v), lim = (u * L[0] + v * L[1]) / Math.max(1e-6, r);
      DRIM[k] = (r * R > R - 1.1 && lim > 0.1) ? 2 : (r * R > R - 2.2 && lim > 0.45 && bay(x, y) < 0.5) ? 1 : 0;
    }
    // atmosphere outside the disc
    RIM = [];
    for (let y = CY - R - 5; y <= CY + R + 5; y++) for (let x = CX - R - 5; x <= CX + R + 5; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = Math.sqrt(dx * dx + dy * dy);
      if (r < R || r >= R + 4) continue;
      const lim = (dx * L[0] - dy * L[1]) / r + 0.22;   // scattering reaches a little past the terminator
      const b = bay(x, y), o = r - R;
      let c = -1;
      if (o < 1) c = lim > 0.55 ? P.sh2 : lim > 0.12 ? P.sh1 : lim > -0.05 ? P.oc3 : lim > -0.3 ? P.oc1 : -1;
      else if (o < 2) c = lim > 0.6 ? P.oc4 : lim > 0.3 ? (b < 0.5 ? P.oc3 : P.oc2) : lim > 0.1 ? (b < 0.35 ? P.oc2 : -1) : -1;
      else if (o < 3) c = lim > 0.6 ? (b < 0.5 ? P.oc2 : P.oc1) : lim > 0.35 ? (b < 0.3 ? P.oc1 : -1) : -1;
      else c = lim > 0.7 && b < 0.25 ? P.oc1 : -1;
      if (c >= 0) RIM.push(y * AW + x, c);
    }
    RIM = Int32Array.from(RIM);
  }

  /* aurora: samples of a thin shell (r = 1 … 1.09) over the north pole, on the night side, stored once */
  const AW_ = 0.026;
  function buildAurora() {
    const x0 = CX - 60, x1 = CX + 100, y0 = CY - R - 22, y1 = CY - 5;
    const pix = [], smp = [];
    const NS = 22;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const u = (x + 0.5 - CX) / R, v = -(y + 0.5 - CY) / R, r2 = u * u + v * v;
      const RO = 1.2;
      if (r2 >= RO * RO) continue;
      const zmax = Math.sqrt(RO * RO - r2), zmin = r2 < 1 ? Math.sqrt(1 - r2) : -zmax;
      const dz = (zmax - zmin) / NS;
      let any = false;
      for (let s = 0; s < NS; s++) {
        const z = zmin + (s + 0.5) * dz, rr = Math.sqrt(r2 + z * z), alt = rr - 1;
        if (alt < 0) continue;
        const nx = u / rr, ny = v / rr, nz = z / rr;
        const night = nx * L[0] + ny * L[1] + nz * L[2];
        if (night > 0.1) continue;
        const b = toBody(nx, ny, nz);
        const colat = Math.acos(clamp(b[1], -1, 1));
        if (colat < 0.12 || colat > 0.48) continue;
        const lon = Math.atan2(b[0], b[2]);
        if (!any) { pix.push(y * AW + x); any = true; }
        smp.push(pix.length - 1, lon, colat, alt, dz * R * clamp((0.1 - night) / 0.2, 0, 1));
      }
    }
    AURPIX = Int32Array.from(pix);
    AUR = Float32Array.from(smp);
    AURACC = new Float32Array(pix.length);
  }

  /* moon: a little crater map, tidally locked */
  const MTW = 64, MTH = 32, MTEX = new Int8Array(MTW * MTH);
  function buildMoon() {
    for (let j = 0; j < MTH; j++) for (let i = 0; i < MTW; i++) {
      const lat = Math.PI / 2 - (j + 0.5) / MTH * Math.PI, lon = (i + 0.5) / MTW * TAU;
      const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
      const m = fbm(x * 1.6 + 200, y * 1.6, z * 1.6 - 50, 3);
      MTEX[j * MTW + i] = m < -0.08 ? -1 : 0;
    }
    const cr = [[0.5, 0.6, 0.22], [-0.4, 2.0, 0.18], [0.1, 3.4, 0.3], [-0.7, 4.6, 0.2], [0.75, 5.5, 0.16], [-0.1, 5.0, 0.12]];
    for (let j = 0; j < MTH; j++) for (let i = 0; i < MTW; i++) {
      const lat = Math.PI / 2 - (j + 0.5) / MTH * Math.PI, lon = (i + 0.5) / MTW * TAU;
      const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
      for (const c of cr) {
        const cx = Math.cos(c[0]) * Math.sin(c[1]), cy = Math.sin(c[0]), cz = Math.cos(c[0]) * Math.cos(c[1]);
        const a = Math.acos(clamp(x * cx + y * cy + z * cz, -1, 1));
        if (a < c[2] * 0.6) MTEX[j * MTW + i] = -1; else if (a < c[2]) MTEX[j * MTW + i] = Math.max(MTEX[j * MTW + i], 1);
      }
    }
  }
  const MRAD = 10, MOR = 1.5;    // moon radius (px) and orbit radius (planet radii)
  // orbit plane contains the sun line, so the moon both transits the sun and passes through the planet’s shadow
  function rotAbout(v, a, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), d = v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
    const cx = a[1] * v[2] - a[2] * v[1], cy = a[2] * v[0] - a[0] * v[2], cz = a[0] * v[1] - a[1] * v[0];
    return [v[0] * c + cx * s + a[0] * d * (1 - c), v[1] * c + cy * s + a[1] * d * (1 - c), v[2] * c + cz * s + a[2] * d * (1 - c)];
  }
  const OE1 = rotAbout([1, 0, 0], L, 0.16), OE2 = rotAbout(nrm(0, L[1], L[2]), L, 0.16);
  const PHI0 = -1.6;
  function moonPos(t) {
    const ph = PHI0 + TAU * t / D, s = Math.sin(ph), c = Math.cos(ph);
    return [MOR * (s * OE1[0] + c * OE2[0]), MOR * (s * OE1[1] + c * OE2[1]), MOR * (s * OE1[2] + c * OE2[2]), ph];
  }

  function buildBackground() {
    initNoise(77);
    // nebula: a faint band from lower left to upper right
    const ax = 0, ay = 300, bx = 270, by = 40, ll = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / ll, ny = (bx - ax) / ll;
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const dd = (x - ax) * nx + (y - ay) * ny;
      const along = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ll;
      const w = 34 + 14 * noise3(along / 60, 3.3, 0.5);
      let den = Math.exp(-(dd / w) * (dd / w)) * (0.62 + 0.75 * fbm(x / 46 + 5, y / 46, 1.7, 4)) + 0.25 * fbm(x / 22, y / 22, 8.1, 3) * Math.exp(-(dd / (w * 1.6)) * (dd / (w * 1.6)));
      const b = bay8(x, y) * 0.16;
      const v = den + b;
      BG[y * AW + x] = v > 0.86 ? P.neb2 : v > 0.66 ? P.neb1 : v > 0.5 ? P.sp1 : P.void;
    }
    // stars: seeded scatter, denser in the band, then a handful placed by hand
    const rng = mulberry32(9001);
    const ok = (x, y) => { const dx = x + 0.5 - CX, dy = y + 0.5 - CY; return dx * dx + dy * dy > (R + 6) * (R + 6); };
    for (let n = 0; n < 420 && STARS.length < 190; n++) {
      const x = fl(rng() * AW), y = fl(rng() * AH);
      if (!ok(x, y)) continue;
      const inBand = BG[y * AW + x] !== P.void;
      if (!inBand && rng() < 0.35) continue;
      const r = rng();
      const col = r < 0.62 ? P.st1 : r < 0.86 ? (rng() < 0.5 ? P.cl1 : P.oc4) : r < 0.95 ? P.st2 : (rng() < 0.5 ? P.de4 : P.sh2);
      STARS.push({ x, y, col, tw: rng() < 0.3 ? 1 + fl(rng() * 4) : 0, ph: rng(), big: 0 });
    }
    const HAND = [[24, 34, 2], [236, 26, 1], [214, 70, 0], [30, 128, 0], [252, 150, 1], [18, 262, 0], [58, 312, 2], [230, 300, 1], [150, 22, 0], [112, 318, 0], [196, 322, 0], [72, 60, 1]];
    for (const h of HAND) STARS.push({ x: h[0], y: h[1], col: P.white, tw: 1 + (h[2] % 3), ph: (h[0] * 7 + h[1] * 3) % 17 / 17, big: h[2] });
    for (const s of STARS) if (!s.tw) BG[s.y * AW + s.x] = s.col;
  }

  /* ================================================================ frame */
  function drawStars(t) {
    for (const s of STARS) {
      if (!s.tw) continue;
      const w = Math.sin(TAU * (s.tw * t / D + s.ph));
      const i = s.y * AW + s.x;
      if (!s.big) { OUT[i] = w > 0.55 ? P.white : w > -0.4 ? s.col : P.st1; continue; }
      OUT[i] = P.white;
      const arm = w > 0.6 ? 2 : w > -0.5 ? 1 : 0;
      const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < AW && y < AH) OUT[y * AW + x] = c; };
      if (arm >= 1) { put(s.x - 1, s.y, P.st2); put(s.x + 1, s.y, P.st2); put(s.x, s.y - 1, P.st2); put(s.x, s.y + 1, P.st2); }
      if (arm >= 2 && s.big >= 1) { put(s.x - 2, s.y, P.st1); put(s.x + 2, s.y, P.st1); put(s.x, s.y - 2, P.st1); put(s.x, s.y + 2, P.st1); }
      if (arm >= 2 && s.big >= 2) { put(s.x - 3, s.y, P.sp2); put(s.x + 3, s.y, P.sp2); put(s.x, s.y - 3, P.sp2); put(s.x, s.y + 3, P.sp2); }
    }
  }

  function drawMoon(mp, front) {
    const mx = Math.round(CX + mp[0] * R), my = Math.round(CY - mp[1] * R), ph = mp[3];
    const rmU = MRAD / R;
    for (let y = my - MRAD; y < my + MRAD; y++) {
      if (y < 0 || y >= AH) continue;
      for (let x = mx - MRAD; x < mx + MRAD; x++) {
        if (x < 0 || x >= AW) continue;
        const du = (x + 0.5 - mx) / MRAD, dv = -(y + 0.5 - my) / MRAD, r2 = du * du + dv * dv;
        if (r2 >= 1) continue;
        const dz = Math.sqrt(1 - r2);
        const d = du * L[0] + dv * L[1] + dz * L[2];
        let lv = band(d, x, y);
        let lon = Math.atan2(du, dz) + ph; lon = ((lon % TAU) + TAU) % TAU;
        const lat = Math.asin(clamp(dv, -1, 1));
        const tv = MTEX[clamp(fl((0.5 - lat / Math.PI) * MTH), 0, MTH - 1) * MTW + (fl(lon / TAU * MTW) & (MTW - 1))];
        // the planet’s shadow
        const qx = mp[0] + du * rmU, qy = mp[1] + dv * rmU, qz = mp[2] + dz * rmU;
        const s = qx * L[0] + qy * L[1] + qz * L[2];
        let c;
        const perp2 = s < 0 ? qx * qx + qy * qy + qz * qz - s * s : 9;
        const pb = (bay(x, y) - 0.5) * 0.08;
        if (perp2 + pb < 0.93) {
          c = tv < 0 ? P.ro1 : perp2 > 0.78 ? P.ci1 : P.de1;      // copper, lit only by sunsets on the rim of the world
          if (dz < 0.3 && tv >= 0 && perp2 > 0.6) c = P.ci1;
        } else {
          if (perp2 + pb < 1.12 && lv > 1) lv -= 1;                 // penumbra
          if (lv > 0) lv = clamp(lv + tv, 1, 4);
          c = MOON[lv];
        }
        OUT[y * AW + x] = c;
      }
    }
    if (front) {   // a dark hairline keeps the moon off the planet behind it
      for (let y = my - MRAD - 1; y <= my + MRAD; y++) for (let x = mx - MRAD - 1; x <= mx + MRAD; x++) {
        if (x < 0 || y < 0 || x >= AW || y >= AH) continue;
        const du = x + 0.5 - mx, dv = y + 0.5 - my, r2 = du * du + dv * dv;
        if (r2 < MRAD * MRAD || r2 >= (MRAD + 1) * (MRAD + 1)) continue;
        if (LEVF[y * AW + x] !== 255) OUT[y * AW + x] = P.void;
      }
    }
  }

  function drawFrame(t) {
    t = ((t % D) + D) % D;
    const th = TAU * t / D, tau = th;
    const sh = (t / D) * TW, shc = ((2 * t / D) % 1) * TW;
    OUT.set(BG);
    drawStars(t);
    const mp = moonPos(t);
    if (mp[2] < 0) drawMoon(mp);
    for (let i = 0; i < RIM.length; i += 2) OUT[RIM[i]] = RIM[i + 1];

    // moon shadow on the planet: only near the transit
    const rmU = MRAD / R;
    const ms = mp[0] * L[0] + mp[1] * L[1] + mp[2] * L[2];
    const mperp = Math.sqrt(Math.max(0, mp[0] * mp[0] + mp[1] * mp[1] + mp[2] * mp[2] - ms * ms));
    const moonShadow = ms > 0 && mperp < 1 + rmU * 2.2;

    // lightning: which storms are flashing this frame (15 flash slots a second)
    const slot = fl(t * 15 + 1e-6), FL = [];
    const thc = 2 * th;
    for (let s = 0; s < STORMS.length; s++) {
      const st = STORMS[s];
      const lon0 = st[1] + thc;
      const b = [Math.cos(st[0]) * Math.sin(lon0), Math.sin(st[0]), Math.cos(st[0]) * Math.cos(lon0)];
      const v = toView(b[0], b[1], b[2]);
      if (v[2] < 0.1) continue;
      if (v[0] * L[0] + v[1] * L[1] + v[2] * L[2] > -0.03) continue;
      const burst = ih(s, fl(slot / 9), 3) < 0.3;
      if (!burst) continue;
      const hh = ih(s, slot, 5);
      const I = hh < 0.22 ? 1 : hh < 0.4 ? 0.55 : 0;
      if (!I) continue;
      const ra = st[2] * (0.55 + 0.35 * ih(s, slot, 9));
      FL.push(v[0], v[1], v[2], Math.cos(ra), I);
    }

    for (let k = 0; k < NDK; k++) {
      const pi = DPIX[k], x = pi % AW, y = (pi / AW) | 0;
      let lv = DLEV[k];
      if (moonShadow && lv > 0) {
        const wx = mp[0] - DNX[k], wy = mp[1] - DNY[k], wz = mp[2] - DNZ[k];
        const s = wx * L[0] + wy * L[1] + wz * L[2];
        if (s > 0) {
          const p2 = (wx * wx + wy * wy + wz * wz - s * s) / (rmU * rmU) + (bay(x, y) - 0.5) * 0.6;
          if (p2 < 0.55) lv = 0; else if (p2 < 1.1) lv = 1; else if (p2 < 2.2) lv = Math.max(1, lv - 1);
        }
      }
      const row = DROW[k] * TW;
      const ti = row + (((DLON[k] - sh + TW) | 0) & TM);
      const bio = BIO[ti];
      const cd = CLD[row + (((DLON[k] - shc + TW) | 0) & TM)];
      const cloudy = cd >= 168 || (cd >= 128 && bay(x + 1, y) < (cd - 128) / 40);
      let c;
      if (cloudy) {
        let cl = lv === 4 ? 3 : lv;
        if (lv > 0) {
          const ca = CLD[DROWA[k] * TW + (((DLONA[k] - shc + TW) | 0) & TM)];
          const cb = CLD[DROWB[k] * TW + (((DLONB[k] - shc + TW) | 0) & TM)];
          if (ca < 128) cl++;
          else if (cb < 128 && cd < 200) cl--;
          if (cd < 168) cl--; else if (cd >= 206 && lv >= 3) cl++;
          cl = clamp(cl, 1, 4);
        }
        c = DTERM[k] && cd >= 168 ? P.de2 : CLOUD[cl];
        if (FL.length) {
          let f = 0;
          for (let q = 0; q < FL.length; q += 5) {
            const dt = DNX[k] * FL[q] + DNY[k] * FL[q + 1] + DNZ[k] * FL[q + 2];
            if (dt > FL[q + 3]) f = Math.max(f, (dt - FL[q + 3]) / (1 - FL[q + 3]) * FL[q + 4]);
          }
          if (f > 0) {
            const e = f + (bay(x, y) - 0.5) * 0.35;
            c = e > 0.62 ? P.white : e > 0.36 ? P.cl3 : e > 0.16 ? P.st2 : e > 0.03 ? P.cl1 : c;
          }
        }
      } else {
        let gl = lv;
        if (lv > 0) {
          const cs = CLD[DROWS[k] * TW + (((DLONS[k] - shc + TW) | 0) & TM)];
          if (cs >= 160) gl = Math.max(1, gl - 1);
          if (bio === B_ROCK || bio === B_SNOW || bio === B_TUNDRA) {
            const ha = HM[DROWA[k] * TW + (((DLONA[k] - sh + TW) | 0) & TM)], h0 = HM[ti];
            if (h0 > ha + 9) gl++; else if (h0 + 9 < ha) gl--;
          }
        }
        if (gl > 4) c = RAMP_UP[bio];
        else c = RAMP[bio][clamp(gl, lv > 0 ? 1 : 0, 4)];
        if (bio <= B_SHALLOW && DGL[k] && lv >= 3) {
          const g = DGL[k];
          c = g === 3 ? P.white : g === 2 ? P.gl : P.sh2;
        }
      }
      if (DRIM[k] && lv >= 2) c = DRIM[k] === 2 ? (cloudy ? P.gl : P.sh2) : (cloudy ? c : P.sh1);
      OUT[pi] = c;
    }

    // city lights on the night side
    for (let n = 0; n < CITIES.length; n++) {
      const ci = CITIES[n];
      const lon0 = ci.lon + th, cl = Math.cos(ci.lat);
      const v = toView(cl * Math.sin(lon0), Math.sin(ci.lat), cl * Math.cos(lon0));
      if (v[2] < 0.12) continue;
      const px = fl(CX + v[0] * R), py = fl(CY - v[1] * R), pi = py * AW + px;
      const lv = LEVF[pi];
      if (lv > 1) continue;
      const k = DKOF[pi];
      const cd = CLD[DROW[k] * TW + (((DLON[k] - shc + TW) | 0) & TM)];
      if (cd >= 168) continue;
      let b = ci.cls + (Math.sin(TAU * (ci.f * t / D + ci.ph)) > ci.thr ? 1 : 0) - (cd >= 128 ? 1 : 0) - lv - (v[2] < 0.3 ? 1 : 0);
      if (b < 0) continue;
      OUT[pi] = b >= 3 ? P.ci3 : b === 2 ? P.ci3 : b === 1 ? P.ci2 : P.ci1;
      if (b >= 3 && LEVF[pi + 1] === 0) OUT[pi + 1] = P.ci2;
    }

    // aurora
    AURACC.fill(0);
    for (let i = 0; i < AUR.length; i += 5) {
      const lon = AUR[i + 1], colat = AUR[i + 2], alt = AUR[i + 3];
      const c0 = 0.27 + 0.016 * Math.sin(3 * lon + tau) + 0.009 * Math.sin(7 * lon - 2 * tau);
      const dd = Math.abs(colat - c0);
      if (dd > AW_) continue;
      if (alt < 0.012) continue;
      const fold = 1 - dd / AW_;
      const prof = Math.exp(-(alt - 0.012) / 0.085);
      let ray = 0.5 + 0.5 * Math.sin(37 * lon + 3 * tau + 2.2 * Math.sin(5 * lon - tau));
      ray = ray * ray * ray;
      const pulse = 0.62 + 0.24 * Math.sin(2 * lon - 2 * tau) + 0.14 * Math.sin(5 * lon + 3 * tau);
      const p = AUR[i] | 0;
      const w = AUR[i + 4] * fold * pulse;
      AURACC[p] += w * (alt < 0.03 ? 1.4 : prof * (0.15 + 0.85 * ray));
    }
    for (let p = 0; p < AURPIX.length; p++) {
      const a = AURACC[p];
      if (a < 0.05) continue;
      const pi = AURPIX[p], x = pi % AW, y = (pi / AW) | 0, b = bay(x, y);
      const e = a + (b - 0.5) * 0.25;
      if (e > 1.5) OUT[pi] = P.au3;
      else if (e > 0.75) OUT[pi] = P.au2;
      else if (e > 0.3) OUT[pi] = P.au1;
    }

    if (mp[2] >= 0) drawMoon(mp, true);
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  function present(g, k) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = AW; SMALL.height = AH; SG = SMALL.getContext('2d'); IMG = SG.createImageData(AW, AH); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < NP; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, AW * k, AH * k);
  }

  /* ================================================================ mount */
  let BUILT = false;
  function buildAll() {
    if (BUILT) return;
    buildMaps(); buildGeometry(); buildAurora(); buildMoon(); buildBackground();
    BUILT = true;
  }

  (window.PIECES = window.PIECES || []).push({
    id: 'small-world',
    title: 'Small World',
    medium: 'Pixel art in 39 colours, 270 × 338, animated in JavaScript · 20 s loop',
    note: 'One day on a very small planet · tap to pause',
    about: 'A pocket planet turns once in twenty seconds. Continents slide around the curve with their deserts, forests and snowy poles; a cloud deck turns twice as fast and drags its shadows over the ground; on the night side cities twinkle, storms flash and an aurora ripples over the pole. Its moon makes one orbit per loop: it throws a small shadow across the day side, then turns copper in the planet’s shadow before slipping behind it. Every pixel is computed as it plays, lit with palette ramps and ordered dither.',
    tone: 'dark',
    room: '#04050c',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#04050c';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(242,246,255,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 4;
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; K = 4; cv.style.position = 'fixed';
          cv.width = 1080; cv.height = 1350;
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / AW, h * dpr / AH) * 0.96;
          const k = Math.max(1, Math.floor(fit));
          K = k;
          if (k < fit * 0.85) { K = Math.max(1, Math.ceil(fit)); cssW = AW * fit / dpr; cssH = AH * fit / dpr; }
          else { cssW = AW * k / dpr; cssH = AH * k / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
          if (cv.width !== AW * K || cv.height !== AH * K) { cv.width = AW * K; cv.height = AH * K; }
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      layout();
      buildAll();
      built = true;
      const draw = (t) => { drawFrame(t); present(g, K); };
      draw(0);
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__smallworld = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__smallworld.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'small-world';
        api.ready();
      } else {
        window.__smallworld = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => requestAnimationFrame(res)); }); } };
        api.ready();
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        draw(clock);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); draw(clock); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__smallworld) delete window.__smallworld;
        },
      };
    },
  });
})();
