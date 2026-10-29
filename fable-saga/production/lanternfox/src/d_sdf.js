  /* ================================================================ soft bodies: smooth unions of tapered capsules
     A pass is a list of capsules (a → b, radius ra → rb, smooth join k, part id, along-range u0..u1, tuft amplitude),
     already in screen space. The field gives the inside depth, its gradient (the surface's lean: a pillowy normal), the
     nearest part, how far along it, which side of its axis. Rasterised row by row over only the capsules that reach the
     row, skipping ahead outside by the field value (a lower bound on the distance). The shader gets everything. */
  const SD_ST = 20, SD_MAX = 64, SDP = new Float64Array(SD_MAX * SD_ST), SDA = new Int32Array(SD_MAX), SDX0 = new Float64Array(SD_MAX), SDX1 = new Float64Array(SD_MAX);
  const SDB = [0, 0, 0, 0];
  let sdN = 0;
  // the last evaluation: gradient, nearest part, radius there, along, side (+1 left of a→b, −1 right), lateral offset
  const SDF = { gx: 0, gy: 0, id: 0, r: 1, u: 0, side: 1, lat: 0, d: 0 };
  function sdBegin() { sdN = 0; SDB[0] = 1e9; SDB[1] = 1e9; SDB[2] = -1e9; SDB[3] = -1e9; }
  function sdCap(ax, ay, bx, by, ra, rb, k, id, u0, u1, tuft) {
    if (sdN >= SD_MAX) return;
    const o = sdN++ * SD_ST, R = Math.max(ra, rb) + k + (tuft || 0) + 2;
    SDP[o] = ax; SDP[o + 1] = ay; SDP[o + 2] = bx - ax; SDP[o + 3] = by - ay;
    const L2 = SDP[o + 2] * SDP[o + 2] + SDP[o + 3] * SDP[o + 3];
    SDP[o + 4] = L2 > 1e-9 ? 1 / L2 : 0; SDP[o + 5] = ra; SDP[o + 6] = rb - ra; SDP[o + 7] = Math.max(0.01, k); SDP[o + 8] = id;
    SDP[o + 9] = u0 || 0; SDP[o + 10] = u1 === undefined ? 1 : u1;
    SDP[o + 11] = Math.min(ax, bx) - R; SDP[o + 12] = Math.min(ay, by) - R; SDP[o + 13] = Math.max(ax, bx) + R; SDP[o + 14] = Math.max(ay, by) + R;
    SDP[o + 15] = tuft || 0; SDP[o + 16] = Math.sqrt(L2);
    if (SDP[o + 11] < SDB[0]) SDB[0] = SDP[o + 11]; if (SDP[o + 12] < SDB[1]) SDB[1] = SDP[o + 12];
    if (SDP[o + 13] > SDB[2]) SDB[2] = SDP[o + 13]; if (SDP[o + 14] > SDB[3]) SDB[3] = SDP[o + 14];
  }
  const sdBall = (x, y, r, k, id, tuft) => sdCap(x, y, x, y, r, r, k, id, 0, 0, tuft);
  // a tuft profile: a sawtooth of soft points (fur flicks), q along the edge
  const tuftF = (q) => { const f = q - Math.floor(q); return f < 0.7 ? f / 0.7 : (1 - f) / 0.3; };
  function sdField(x, y, na) {
    let s = 1e9, gx = 0, gy = 0, best = 1e9, id = 0, rl = 1, al = 0, side = 1, lat = 0, tf = 0;
    for (let a = 0; a < na; a++) {
      if (x < SDX0[a] || x > SDX1[a]) continue;
      const o = SDA[a], bx = SDP[o + 2], by = SDP[o + 3], px = x - SDP[o], py = y - SDP[o + 1];
      let h = (px * bx + py * by) * SDP[o + 4]; h = h < 0 ? 0 : h > 1 ? 1 : h;
      const dx = px - bx * h, dy = py - by * h, dl = Math.sqrt(dx * dx + dy * dy) + 1e-9, r = SDP[o + 5] + SDP[o + 6] * h;
      let d = dl - r;
      const tu = SDP[o + 15];
      let tq = 0;
      if (tu > 0 && d > -tu * 2.5) {
        // fur: little points along the edge, flowing toward the end of the part
        const L = SDP[o + 16], cr = bx * py - by * px;
        const q = L > 0.5 ? (h * L + (cr > 0 ? 0.45 : 0)) / (2.1 * Math.max(0.6, tu)) : Math.atan2(dy, dx) * 2.2;
        tq = tu * (tuftF(q) - 0.35);
        d -= tq;
      }
      if (d < best) { best = d; id = SDP[o + 8]; al = SDP[o + 9] + (SDP[o + 10] - SDP[o + 9]) * h; const cr = bx * py - by * px; side = cr >= 0 ? 1 : -1; lat = dl / Math.max(0.3, r); tf = tq; }
      const ex = dx / dl, ey = dy / dl;
      if (s > 1e8) { s = d; gx = ex; gy = ey; rl = r; }
      else { const k = SDP[o + 7], g = 0.5 + 0.5 * (d - s) / k, q = g < 0 ? 0 : g > 1 ? 1 : g; s = d + (s - d) * q - k * q * (1 - q); gx = ex + (gx - ex) * q; gy = ey + (gy - ey) * q; rl = r + (rl - r) * q; }
    }
    SDF.gx = gx; SDF.gy = gy; SDF.id = id; SDF.r = rl; SDF.u = al; SDF.side = side; SDF.lat = lat; SDF.d = s; SDF.tf = tf;
    return s;
  }
  // rasterise the pass: shade(X, Y, s) → palette index (or −1 to leave the pixel); clip to [cx0, cx1] × rows
  function sdDraw(shade, cx0, cx1) {
    if (!sdN) return;
    cx0 = cx0 === undefined ? 0 : cx0; cx1 = cx1 === undefined ? W - 1 : cx1;
    const Y0 = Math.max(ROW0, fl(SDB[1])), Y1 = Math.min(ROW1, Math.ceil(SDB[3]));
    for (let Y = Y0; Y <= Y1; Y++) {
      const y = Y + 0.5;
      let na = 0, xa = 1e9, xb = -1e9;
      for (let i = 0, o = 0; i < sdN; i++, o += SD_ST) {
        if (y < SDP[o + 12] || y > SDP[o + 14]) continue;
        const R = SDP[o + 13] - Math.max(SDP[o], SDP[o] + SDP[o + 2]), ay = SDP[o + 1], dy = SDP[o + 3];
        let h0 = 0, h1 = 1;
        if (Math.abs(dy) > 1e-6) { const ha = (y - R - ay) / dy, hb = (y + R - ay) / dy; h0 = Math.max(0, Math.min(ha, hb)); h1 = Math.min(1, Math.max(ha, hb)); if (h0 > h1) continue; }
        const xa0 = SDP[o] + SDP[o + 2] * h0, xa1 = SDP[o] + SDP[o + 2] * h1;
        SDX0[na] = Math.min(xa0, xa1) - R; SDX1[na] = Math.max(xa0, xa1) + R; SDA[na] = o;
        if (SDX0[na] < xa) xa = SDX0[na]; if (SDX1[na] > xb) xb = SDX1[na]; na++;
      }
      if (!na) continue;
      const X0 = Math.max(cx0, fl(xa)), X1 = Math.min(cx1, Math.ceil(xb)), o = Y * W;
      for (let X = X0; X <= X1; X++) {
        const s = sdField(X + 0.5, y, na);
        if (s >= 0) {
          // skip ahead: no nearer than the field says, and never past where another capsule's reach begins
          let sk = s > 1e8 ? 1e9 : fl(s - 2.2);
          if (sk > 0) { const x = X + 0.5; for (let a = 0; a < na; a++) if (SDX0[a] > x) { const g = fl(SDX0[a] - x); if (g < sk) sk = g; } if (sk > 0) X += sk - (sk > 1e8 ? 0 : 0); }
          continue;
        }
        const c = shade(X, Y, s);
        if (c >= 0) BUF[o + X] = c;
      }
    }
  }
  // the pillowy normal at the last evaluation (depth −s inside a part of radius r): [nx, ny, nc]
  const SDN = [0, 0, 1];
  function sdNormal(s) {
    const gl = Math.sqrt(SDF.gx * SDF.gx + SDF.gy * SDF.gy) || 1, rel = clamp(-s / Math.max(0.5, SDF.r), 0, 1), m = 1 - rel;
    const mm = Math.sqrt(m * (2 - m));                        // a round profile: steep at the rim, flat in the middle
    SDN[0] = SDF.gx / gl * mm; SDN[1] = SDF.gy / gl * mm; SDN[2] = Math.sqrt(Math.max(0, 1 - mm * mm));
    return SDN;
  }
