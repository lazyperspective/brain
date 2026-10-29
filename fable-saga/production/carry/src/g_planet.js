  /* ================================================================ Carry: the snail's planet (shared by L3, L4 and L5)
     One world, drawn wherever it appears at whatever size, from one baked texture so that every layer shows the same seas,
     the same continents, the same clouds and cities. Its north pole is tipped 32° toward us, so the top limb — where the
     snail lives (the origin of L3, L4 and L5) — is at latitude 58°, just south of the aurora oval. The sun is behind it and
     to the left (a crescent of day on the lower left); the snail's side is night.
     gPlanet(V, cx, cy, R, t, o): draw the disc of radius R units about (cx, cy) into the view, with its atmosphere glow, its
     aurora and its night lights; o = { glowW (atmosphere thickness in units), aur (aurora strength), detail } */
  const GP_A = [0, -0.85, 0.527], GP_B = [1, 0, 0], GP_C = [0, 0.527 * 0, 0];
  { const a = GP_A, l = Math.hypot(a[0], a[1], a[2]); a[0] /= l; a[1] /= l; a[2] /= l; GP_C[0] = a[1] * GP_B[2] - a[2] * GP_B[1]; GP_C[1] = a[2] * GP_B[0] - a[0] * GP_B[2]; GP_C[2] = a[0] * GP_B[1] - a[1] * GP_B[0]; }
  const GP_S = (() => { const s = [-0.62, 0.35, -0.7], l = Math.hypot(s[0], s[1], s[2]); return s.map((v) => v / l); })();
  // 3D value noise and fbm (for baking)
  function vn3(x, y, z, s) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const h = (a, b, c) => ih(a, Math.imul(b, 40503) ^ Math.imul(c, 9973), s);
    const x00 = lerp(h(i, j, k), h(i + 1, j, k), ux), x10 = lerp(h(i, j + 1, k), h(i + 1, j + 1, k), ux);
    const x01 = lerp(h(i, j, k + 1), h(i + 1, j, k + 1), ux), x11 = lerp(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), ux);
    return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
  }
  function fbm3(x, y, z, oct, s) { let v = 0, a = 1, n = 0, f = 1; for (let k = 0; k < oct; k++) { v += a * vn3(x * f, y * f, z * f, s + k * 37); n += a; a *= 0.5; f *= 2.03; } return v / n; }
  // the bake: an equirectangular map of height (land > 128), clouds, and a city factor
  const GT_W = 768, GT_H = 384, GT_LAND = new Uint8Array(GT_W * GT_H), GT_CLOUD = new Uint8Array(GT_W * GT_H);
  let GT_BAKED = false;
  // where the snail lives (view-space up, in the planet's frame): its continent is guaranteed
  const GP_N0 = [GP_B[1] * -1, GP_C[1] * -1, GP_A[1] * -1];
  // (baked on first use, so the gallery's page load never pays for it)
  function gBake() {
  GT_BAKED = true;
  for (let j = 0; j < GT_H; j++) {
    const lat = (0.5 - (j + 0.5) / GT_H) * PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < GT_W; i++) {
      const lon = ((i + 0.5) / GT_W - 0.5) * TAU, px = cl * Math.cos(lon), py = cl * Math.sin(lon), pz = sl;
      const wx = vn3(px * 1.3 + 5, py * 1.3, pz * 1.3, 9100) - 0.5, wy = vn3(px * 1.3, py * 1.3 + 7, pz * 1.3, 9101) - 0.5;
      let h = fbm3(px * 2.1 + wx * 0.9, py * 2.1 + wy * 0.9, pz * 2.1, 4, 9102);
      h = 0.5 + (h - 0.5) * 1.6;                                         // more contrast: real continents and real seas
      const dn = (px - GP_N0[0]) ** 2 + (py - GP_N0[1]) ** 2 + (pz - GP_N0[2]) ** 2;
      h += 0.16 * Math.exp(-dn / 0.09) - 0.03;
      const c = fbm3(px * 3.2 + wx * 2.2, py * 3.2 + wy * 2.2, pz * 3.2 + 3, 3, 9103) * (0.75 + 0.5 * Math.abs(Math.sin(lat * 2.6))) * (1 - 0.75 * Math.exp(-dn / 0.07));   // (a clear night over the snail)
      GT_LAND[j * GT_W + i] = clamp(fl(h * 255), 0, 255); GT_CLOUD[j * GT_W + i] = clamp(fl(c * 255), 0, 255);
    }
  }
  }
  function gSample(T, lon, lat) {
    const fx = ((lon / TAU + 0.5) * GT_W - 0.5 + GT_W * 4) % GT_W, fy = clamp((0.5 - lat / PI) * GT_H - 0.5, 0, GT_H - 1.001);
    const i = fl(fx), j = fl(fy), ax = fx - i, ay = fy - j, i1 = (i + 1) % GT_W, j1 = Math.min(GT_H - 1, j + 1);
    return ((T[j * GT_W + i] * (1 - ax) + T[j * GT_W + i1] * ax) * (1 - ay) + (T[j1 * GT_W + i] * (1 - ax) + T[j1 * GT_W + i1] * ax) * ay) / 255;
  }
  const GP_NIGHT_SEA = [0, 114, 115], GP_DAY_SEA = [88, 45, 46, 47], GP_DAY_LAND = [24, 25, 26, 26, 48, 26], GP_TERM = [9, 10, 28, 25], GP_TERM_S = [9, 10, 88, 45];
  // the colour of the surface at view normal (nx, ny, nz) (ny down the screen, nz toward us), at screen pixel (X, Y)
  function gSurface(nx, ny, nz, X, Y, t, det) {
    const p0 = nx * GP_B[0] + ny * GP_B[1] + nz * GP_B[2], p1 = nx * GP_C[0] + ny * GP_C[1] + nz * GP_C[2], p2 = nx * GP_A[0] + ny * GP_A[1] + nz * GP_A[2];
    const lat = Math.asin(clamp(p2, -1, 1)), lon = Math.atan2(p1, p0), d = bay(X, Y);
    let h = gSample(GT_LAND, lon, lat);
    if (det > 0) h += (vn(lon * 900, lat * 900, 1, 9104) - 0.5) * 0.035 * det;
    const cloudOff = 0.03 * Math.sin(zP(t, 1)) + 0.02 * Math.sin(zP(t, 2) + lat * 3);
    const c0 = gSample(GT_CLOUD, lon + cloudOff, lat), cl = c0 * 0.55 + gSample(GT_CLOUD, lon * 3 + c0 * 2.5 + cloudOff * 2, lat * 3 + 0.7) * 0.45 + (det > 0 ? (vn(lon * 400 + 3, lat * 400, 1, 9105) - 0.5) * 0.06 * det : 0);
    const sun = nx * GP_S[0] + ny * GP_S[1] + nz * GP_S[2], alat = Math.abs(lat), land = h > 0.5, ice = alat > 1.43 || (alat > 1.38 && h > 0.5);
    const cloud = cl > 0.55 ? clamp((cl - 0.55) / 0.16, 0, 1) : 0, lim = nz;          // lim: small near the limb (grazing)
    let c;
    if (sun > 0.035) {
      // day: blue oceans, green and gold land, white ice and clouds; brighter toward the sun
      const b = clamp(sun * 2.5, 0, 1);
      if (ice) c = b > 0.4 ? (d < 0.6 ? 22 : 21) : (d < 0.5 ? 21 : 20);
      else if (land) { const e = h - 0.5; c = GP_DAY_LAND[clamp(fl(e * 22 + b * 2.4 + d * 0.9), 0, 5)]; }
      else c = GP_DAY_SEA[clamp(fl(b * 2.6 + d * 0.9 + (h - 0.45) * 5), 0, 3)];
      if (cloud > d * 0.9 + 0.05) c = b > 0.35 ? (cloud > 0.6 ? 22 : 21) : (cloud > 0.6 ? 21 : 20);
    } else if (sun > -0.025) {
      c = d < (sun + 0.025) / 0.06 ? (land ? GP_TERM : GP_TERM_S)[clamp(fl((sun + 0.025) * 60), 0, 3)] : (land ? 23 : 114);    // a thin band of dusk, warm and dim
    } else {
      // night: dark seas, darker land, pale ice, moonlit clouds, and cities strung along the coasts
      if (ice) { const e = h - 0.5 + (cl - 0.5) * 0.4; c = e > 0.08 ? (d < 0.55 ? 135 : 134) : e > -0.05 ? (d < 0.45 ? 134 : 2) : (d < 0.25 ? 134 : 2); }
      else if (land) { const e = h - 0.5; c = e < 0.012 ? (d < 0.6 ? 139 : 23) : e > 0.14 ? (d < 0.35 ? 139 : 23) : (d < 0.22 ? 139 : d < 0.75 ? 23 : 1); }
      else c = h > 0.47 ? (d < 0.5 ? 115 : 114) : (d < 0.2 ? 115 : 114);
      if (cloud > d * 1.1 + 0.12) c = cloud > 0.8 ? (d < 0.3 ? 135 : 134) : cloud > 0.5 ? (d < 0.4 ? 134 : 2) : 2;
      if (land && !ice && cloud < 0.5) {
        const coast = 1 - clamp((h - 0.5) / 0.05, 0, 1), k = ih(fl(lon * 300), fl(lat * 300), 9106), kc = (0.01 + coast * 0.3);
        if (k < kc * 1.8 && alat < 1.25) {                       // (only then can there be a light here: look closer)
          const town = vn(lon * 40, lat * 40, 1, 9107), on = 0.5 + 0.5 * Math.sin(zP(t, 1 + (k * 4 | 0)) + k * 40);
          if (k < kc * (town > 0.62 ? 1.8 : town > 0.5 ? 0.6 : 0.08) && on > 0.12) c = k < 0.025 ? 53 : k < 0.15 ? 144 : 145;
        }
      }
      // the limb: haze and airglow
      if (lim < 0.06) c = lim < 0.025 ? (d < 0.6 ? 137 : 136) : (d < 0.5 ? 135 : c);
    }
    return c;
  }
  // the aurora oval about the north pole (lat ≈ 64–70°): its strength at (lat, lon)
  function gAurora(lat, lon, t) {
    const a = lat - 1.16 - 0.04 * Math.sin(lon * 3 + zP(t, 1)) - 0.03 * Math.sin(lon * 7 - zP(t, 2));
    return Math.exp(-a * a / 0.0011) * (0.7 + 0.3 * Math.sin(lon * 60 + zP(t, 2)) * Math.sin(lon * 23 - zP(t, 1))) * (0.65 + 0.35 * Math.sin(lon * 3 - zP(t, 1)));
  }
  function gPlanet(V, cx, cy, R, t, o) {
    o = o || {};
    if (!GT_BAKED) gBake();
    const u = V.u, Rp = R * u, CX = V.X(cx), CY = V.Y(cy), gw = (o.glowW || R * 0.035) * u, det = o.detail || 0, aur = o.aur === undefined ? 1 : o.aur;
    if (Rp < 0.7) { P(CX, CY, 136); return; }
    const X0 = Math.max(V.box[0], fl(CX - Rp - gw - 1)), X1 = Math.min(V.box[2], Math.ceil(CX + Rp + gw + 1));
    const Y0 = Math.max(V.box[1], LB, fl(CY - Rp - gw - 1)), Y1 = Math.min(V.box[3], H - 1 - LB, Math.ceil(CY + Rp + gw + 1));
    for (let Y = Y0; Y <= Y1; Y++) {
      const ny = (Y + 0.5 - CY) / Rp, hr = V.hole && Y >= V.hole[1] && Y <= V.hole[3];
      for (let X = X0; X <= X1; X++) {
        if (hr && X >= V.hole[0] && X <= V.hole[2]) { X = V.hole[2]; continue; }
        const nx = (X + 0.5 - CX) / Rp, r2 = nx * nx + ny * ny;
        if (r2 > 1) {
          // the atmosphere outside the limb: a thin glow, warm on the sunward side, airglow and aurora elsewhere
          const hgt = (Math.sqrt(r2) - 1) * Rp; if (hgt > gw) continue;
          const f = 1 - hgt / gw, sunw = (nx * GP_S[0] + ny * GP_S[1]) / Math.sqrt(r2), dd = bay(X, Y);
          if (sunw > 0.3) { if (dd < f * f * 0.9) BUF[Y * W + X] = f > 0.7 ? 148 : 147; }
          else if (dd < f * f * 0.75) BUF[Y * W + X] = f > 0.75 ? 137 : 136;
          continue;
        }
        const nz = Math.sqrt(1 - r2);
        let c = gSurface(nx, ny, nz, X, Y, t, det);
        const p2 = aur > 0 ? nx * GP_A[0] + ny * GP_A[1] + nz * GP_A[2] : 0;
        if (aur > 0 && p2 > 0.84 && p2 < 0.97) {                  // (the oval's band of latitude, 1.0–1.33 rad)
          const p1 = nx * GP_C[0] + ny * GP_C[1] + nz * GP_C[2], p0 = nx * GP_B[0] + ny * GP_B[1] + nz * GP_B[2];
          const A = gAurora(Math.asin(clamp(p2, -1, 1)), Math.atan2(p1, p0), t) * aur, dd = bay(X, Y);
          if (A > 0.62 + dd * 0.3) c = 49; else if (A > 0.4 + dd * 0.3) c = 48; else if (A > 0.22 + dd * 0.3) c = 125; else if (A > 0.1 + dd * 0.25) c = c === 0 || c === 114 || c === 1 || c === 23 ? 124 : c;
        }
        // o.darkAt [x, y, r] (units): the ground darkens toward that spot (the snail's own dark meadow, seen from above)
        if (o.darkAt) { const [qx, qy, qr] = o.darkAt, ddx = (X + 0.5 - V.X(qx)) / u, ddy = (Y + 0.5 - V.Y(qy)) / u, f = 1 - Math.sqrt(ddx * ddx + ddy * ddy) / qr; if (f > 0 && bay(X, Y) < f * 1.4) c = GP_DARKER[c] === undefined ? c : GP_DARKER[c]; }
        BUF[Y * W + X] = c;
      }
    }
  }
  const GP_DARKER = { 140: 139, 139: 23, 24: 23, 23: 1, 25: 24, 145: 23, 144: 145, 115: 114, 114: 0, 135: 134, 134: 2, 2: 1 };
