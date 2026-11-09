// The static pixel scene at native 480x270, drawn element by element into indexed buffers (no anti-aliasing:
// pixel-centre fills, Bresenham lines, hand-placed clusters). Proportions come from a simple shifted-lens camera
// (f = 513.6 px, principal point 240, 190.35) so the city stays coherent, but every mark is snapped and chosen.
//
// Buffers (one entry per native pixel):
//   idx   static colour (palette index)      kind  how the frame pass treats the pixel (K below)
//   src   light source / window id           lvl   class within the kind (face ring, rim strength, receptivity)
//   sky   base sky colour for sky pixels      gmap  glass pixel -> mirrored sign pixel (or -1)
// plus per-source glow fields (halo) and column profiles (the light streak on the wet roof).
(function () {
  const NS = window.NS || (window.NS = {});
  const K = NS.K = { SKY: 0, SOLID: 1, FACE: 2, GLASS: 3, PUDDLE: 4, WET: 5, RIM: 6, SPILL: 7, BRIM: 8 };
  // BRIM: rim light that follows the whole sign's brightness (objects too far from any one letter for the glow field)
  const W = 480, H = 270, N = W * H;
  const F = 513.6, CX = 240, CY = 190.35;

  NS.buildPixelScene = function () {
    const PAL = NS.PAL, R = PAL.ramp;
    const n = R.night, g = R.green, a = R.amber, b = R.brick, s = R.steel, t = R.teal, m = R.magenta, c = R.cyan, rd = R.red;
    const B = { W, H, idx: new Uint8Array(N), kind: new Uint8Array(N), src: new Uint8Array(N).fill(255), lvl: new Uint8Array(N), sky: new Uint8Array(N), gmap: new Int32Array(N).fill(-1) };
    const rnd = NS.mulberry32(91127);
    const P = (x, y, z) => [CX + F * x / z, CY - F * y / z];
    const U = (x, z) => Math.round(CX + F * x / z), V = (y, z) => Math.round(CY - F * y / z);

    // ---- primitives
    const put = (x, y, i, k = K.SOLID, l = 0, sr = 255) => {
      x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return;
      const p = y * W + x; B.idx[p] = i; B.kind[p] = k; B.lvl[p] = l; B.src[p] = sr;
    };
    const rect = (x0, y0, x1, y1, i, k, l, sr) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, i, k, l, sr); };
    const line = (x0, y0, x1, y1, i, k, l, sr) => {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) { put(x0, y0, i, k, l, sr); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    };
    // pixel-centre polygon fill; returns the pixels it set
    const poly = (pts, i, k, l, sr) => {
      let y0 = Infinity, y1 = -Infinity; pts.forEach((q) => { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
      const out = [];
      for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
        const yc = y + 0.5, xs = [];
        for (let j = 0; j < pts.length; j++) {
          const p0 = pts[j], p1 = pts[(j + 1) % pts.length];
          if ((p0[1] <= yc && p1[1] > yc) || (p1[1] <= yc && p0[1] > yc)) xs.push(p0[0] + (yc - p0[1]) / (p1[1] - p0[1]) * (p1[0] - p0[0]));
        }
        xs.sort((u, v) => u - v);
        for (let j = 0; j + 1 < xs.length; j += 2) for (let x = Math.ceil(xs[j] - 0.5); x <= Math.floor(xs[j + 1] - 0.5); x++) { if (x >= 0 && x < W) { if (i != null) put(x, y, i, k, l, sr); out.push(y * W + x); } }
      }
      return out;
    };
    const B4 = PAL.bayer;
    const dith = (x, y, v) => (v > B4(x, y) ? 1 : 0); // ordered dither of a 0..1 share

    // ================================================================ sky
    // night ramp bands, top darkest, with 4-row Bayer seams between bands; a faint sodium glow at the horizon
    const skyBands = [[0, n[1]], [34, n[2]], [78, n[3]], [118, n[4]], [150, n[5]]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let k = 0; while (k + 1 < skyBands.length && y >= skyBands[k + 1][0] - 3) k++;
      let col = skyBands[k][1];
      if (k + 1 < skyBands.length) { const yb = skyBands[k + 1][0]; if (y >= yb - 3 && y < yb + 3) col = dith(x, y, (y - (yb - 3) + 0.5) / 6) ? skyBands[k + 1][1] : skyBands[k][1]; }
      if (k > 0 && y < skyBands[k][0] + 3 && y >= skyBands[k][0] - 3) { const yb = skyBands[k][0]; col = dith(x, y, (y - (yb - 3) + 0.5) / 6) ? skyBands[k][1] : skyBands[k - 1][1]; }
      B.sky[y * W + x] = col;
    }

    // ================================================================ distant city (left of the hotel, and low behind it)
    const tower = (x0, x1, top, body, winA, winB, density, seed, crown) => {
      const r = NS.mulberry32(seed);
      rect(x0, top, x1, H - 1, body, K.SPILL, 1);
      for (let y = top + 3; y < H; y += 3) for (let x = x0 + 1; x < x1; x += 2) {
        if (r() < density) put(x, y, r() < 0.7 ? winA : winB, K.SPILL, 0);
      }
      // a lit edge toward the sign, a darker shadow edge, and a bit of rooftop clutter
      for (let y = top; y < H; y++) { put(x1, y, n[5], K.SPILL, 1); put(x0, y, n[3], K.SPILL, 1); }
      const cx0 = x0 + 2 + ((r() * Math.max(1, x1 - x0 - 6)) | 0);
      if (r() < 0.6) { rect(cx0, top - 3, cx0 + 3, top - 1, n[3], K.SPILL, 1); put(cx0 + 3, top - 3, n[5]); }
      else { for (let y = top - 6; y < top; y++) put(cx0, y, n[3]); put(cx0, top - 7, n[5]); }
      if (crown) crown();
    };
    // far haze towers
    tower(0, 14, 74, n[4], a[1], n[6], 0.10, 1);
    tower(15, 33, 92, n[4], a[1], n[6], 0.12, 2);
    tower(34, 52, 66, n[4], a[2], n[6], 0.09, 3, () => { for (let y = 70; y < 110; y++) put(43, y, y % 2 ? c[1] : c[2], K.SOLID); put(43, 69, c[3]); });
    tower(53, 70, 100, n[4], a[1], n[6], 0.12, 4);
    // the landmark: a stepped spire, a cyan crown band, its beacon
    rect(73, 26, 96, 135, n[3], K.SPILL, 1);
    rect(76, 16, 93, 25, n[3], K.SPILL, 1); rect(79, 9, 90, 15, n[3], K.SPILL, 1); rect(83, 3, 86, 8, n[3], K.SPILL, 1); rect(84, 0, 85, 2, s[1]);
    for (let x = 74; x <= 95; x++) put(x, 27, (x % 2) ? c[1] : c[2]);
    for (let x = 77; x <= 92; x++) put(x, 17, (x % 3) ? c[1] : c[2]);
    { const r = NS.mulberry32(5); for (let y = 31; y < 135; y += 3) for (let x = 75; x < 95; x += 2) if (r() < 0.13) put(x, y, r() < 0.6 ? n[6] : a[2], K.SPILL, 0); }
    // low roofs behind the sign's frame, dark against the glow
    const lows = [[100, 140, 93], [141, 170, 97], [171, 205, 90], [206, 238, 96], [239, 282, 92], [283, 318, 98], [319, 352, 91], [353, 384, 95]];
    lows.forEach(([x0, x1, top], k) => { rect(x0, top, x1, 104, n[2], K.SPILL, 1); const r = NS.mulberry32(40 + k); for (let x = x0 + 2; x < x1 - 1; x += 3) if (r() < 0.22) put(x, top + 2 + ((r() * 3) | 0) * 3, r() < 0.7 ? a[1] : n[5], K.SPILL, 0); });
    // a magenta sign on a far block, left
    rect(18, 101, 33, 108, n[3], K.SPILL, 1);
    for (let x = 20; x <= 31; x++) put(x, 103, m[2]); for (let x = 20; x <= 31; x++) put(x, 106, (x & 1) ? m[2] : m[1]);
    put(19, 103, m[1]); put(32, 103, m[1]); put(25, 104, m[1]); put(26, 105, m[1]);

    // ================================================================ the old brick building (left), its side face receding
    const lbTop = (x) => 130 + (x / 78) * 20;
    poly([[-1, 130], [78.5, 150], [78.5, 217], [-1, 217]], b[1], K.SPILL, 2);
    // cornice line
    for (let x = 0; x <= 78; x++) { const y = Math.round(lbTop(x)); put(x, y, b[3], K.SPILL, 3); put(x, y + 1, b[0], K.SPILL, 1); }
    // windows in perspective: columns at z steps, rows per floor
    for (let zi = 0; zi < 16; zi++) {
      const z0 = 60 + zi * 2.7, z1 = z0 + 1.25;
      const u0 = CX + F * -31 / z0, u1 = CX + F * -31 / z1;
      if (u1 < 0) continue;
      for (let fl = 0; fl < 4; fl++) {
        const yb = 5.0 - fl * 3.35, yt = yb - 1.8; // window top/bottom in metres (above/below eye)
        const q = [[u0, CY - F * yb / z0], [u1, CY - F * yb / z1], [u1, CY - F * yt / z1], [u0, CY - F * yt / z0]];
        const lit = rnd() < 0.2;
        const px = poly(q, lit ? a[2] : b[0], K.SPILL, lit ? 0 : 1);
        if (lit) px.forEach((p, k2) => { if (k2 % 3 === 0) { B.idx[p] = a[1]; } });
      }
    }
    // a blank blade sign on its corner: magenta tube, cyan bulbs chasing nothing (static)
    for (let y = 158; y <= 186; y++) { put(70, y, R.night[1]); put(71, y, m[2]); put(72, y, m[1]); put(73, y, R.night[1]); }
    for (let y = 160; y <= 184; y += 4) put(72, y, c[3]);
    put(71, 157, m[1]); put(71, 187, m[1]); for (let y = 159; y <= 185; y += 2) put(69, y, m[0]);
    // its water tank on the roof, on a stand
    { const cx = 15, top = 97, bot = 127, r = 9;
      for (const lx of [8, 13, 18, 23]) for (let y = 127; y <= 137; y++) put(lx, y, n[1]);
      line(8, 128, 23, 136, n[1]); line(23, 128, 8, 136, n[1]);
      rect(6, 127, 24, 128, s[0]);
      for (let y = top; y <= bot; y++) for (let x = cx - r; x <= cx + r; x++) {
        const u = (x - cx) / r; let col = (x & 1) ? n[2] : n[1];
        if ((y - top) % 6 === 5) col = n[0];
        put(x, y, col, u > 0.55 ? K.RIM : K.SPILL, u > 0.55 ? (u > 0.85 ? 3 : 2) : 1);
      }
      for (let y = 89; y < top; y++) { const w = Math.round((y - 89) / (top - 89) * (r + 1)); for (let x = cx - w; x <= cx + w; x++) put(x, y, n[2], x > cx + w / 2 ? K.RIM : K.SPILL, 1); }
      put(cx, 88, s[1]);
    }

    // ================================================================ the hotel
    const HX0 = 76, HX1 = 404, CRX0 = 86, CRX1 = 394;
    // main shaft brick
    rect(HX0, 142, HX1, 216, b[1], K.SPILL, 1);
    // crown
    rect(CRX0, 109, CRX1, 141, b[1], K.SPILL, 2);
    // parapet and coping
    rect(CRX0, 103, CRX1, 108, b[2], K.SPILL, 2);
    for (let x = CRX0; x <= CRX1; x++) { put(x, 102, b[4], K.RIM, 5); put(x, 103, b[3], K.SPILL, 4); put(x, 109, b[0], K.SPILL, 1); }
    // deco frieze under the parapet: a band of chevrons
    for (let x = CRX0; x <= CRX1; x++) {
      const ph = (x - CRX0) % 6, up = ph < 3 ? ph : 5 - ph;
      put(x, 110, b[3], K.SPILL, 3); put(x, 111 + (2 - up), b[4], K.SPILL, 3); put(x, 114, b[3], K.SPILL, 2);
    }
    // cornice between crown and shaft
    for (let x = HX0 - 1; x <= HX1 + 1; x++) { put(x, 141, b[4], K.SPILL, 3); put(x, 142, b[3], K.SPILL, 2); put(x, 143, b[0]); }
    // corner fins, stepped (deco), framing the sign
    const fin = (x0, x1, dir) => {
      rect(x0, 98, x1, 141, b[3], K.SPILL, 3);
      rect(x0 + 1, 93, x1 - 1, 97, b[3], K.SPILL, 3);
      rect(x0 + 2, 89, x1 - 2, 92, b[3], K.SPILL, 3);
      // flutes
      for (let y = 99; y <= 140; y++) for (let x = x0 + 1; x < x1; x += 2) put(x, y, b[2], K.SPILL, 2);
      // the edge facing the sign catches green
      const ex = dir > 0 ? x1 : x0;
      for (let y = 98; y <= 141; y++) put(ex, y, b[4], K.RIM, 3);
      for (let y = 93; y <= 97; y++) put(ex - dir, y, b[4], K.RIM, 3);
      for (let y = 89; y <= 92; y++) put(ex - 2 * dir, y, b[4], K.RIM, 3);
      put(x0 + 2, 89, b[4], K.RIM, 2); put(x1 - 2, 89, b[4], K.RIM, 2);
    };
    fin(81, 91, 1); fin(389, 399, -1);
    // crown windows: 20 bays over the crown, two floors
    const win = (x0, y0, w, h, cell, crown) => {
      const r = NS.mulberry32(cell * 7919 + 13), hl = r();
      const lit = hl < (crown ? 0.17 : 0.19);
      rect(x0 - 1, y0 - 1, x0 + w, y0 + h, b[0]); // frame / reveal shadow
      if (!lit) {
        rect(x0, y0, x0 + w - 1, y0 + h - 1, n[1]);
        put(x0, y0, n[3]); put(x0 + 1, y0, n[2]); put(x0, y0 + 1, n[2]);   // sky glint in the glass
        for (let y = y0; y < y0 + h; y++) put(x0 + (w >> 1), y, b[0]);      // mullion
        return { lit: false };
      }
      // lit rooms, five kinds: curtains and sheer with a lamp pool; a blind half down; a lamp shade in silhouette
      // against the sheer; a plant's leaves against a warm wall; a television's blue
      const tone = r(), kindR = r(), cl = 1 + ((r() * 2) | 0), cr = 1 + ((r() * 2) | 0), lampX = x0 + cl + ((r() * (w - cl - cr)) | 0);
      const blue = tone > 0.9, hot = tone < 0.5;
      const wall = hot ? a[4] : a[3], fold = hot ? a[3] : a[2];
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const lx = x - x0, ly = y - y0;
        let col = blue ? c[1] : wall;
        if (blue) { if (lx < cl || lx >= w - cr) col = c[0]; if (ly >= h - 3 && Math.abs(x - lampX) <= 1) col = c[2]; }
        else if (kindR < 0.4) {                                           // curtains, sheer, lamp
          if (lx % 2 === 1) col = fold;
          if (x === lampX && ly >= h - 4) col = a[6]; else if (Math.abs(x - lampX) <= 1 && ly >= h - 5) col = a[5];
          if (lx < cl || lx >= w - cr) col = a[1];
        } else if (kindR < 0.6) {                                         // blind half down
          if (ly < (h >> 1)) col = ly % 2 ? a[2] : a[1];
          else if (x === lampX && ly >= h - 3) col = a[6];
        } else if (kindR < 0.8) {                                         // lamp shade silhouette
          if (lx % 2 === 1) col = fold;
          const sx = x0 + (w >> 1) - 1;
          if (ly >= h - 6 && ly <= h - 4 && x >= sx - (ly - (h - 6)) && x <= sx + 2 + (ly - (h - 6))) col = b[1];
          if (ly > h - 4 && (x === sx || x === sx + 1)) col = b[0];
          if (ly === h - 7 && x >= sx && x <= sx + 1) col = a[6];
          if (lx < 1 || lx >= w - 1) col = a[1];
        } else {                                                          // plant against a warm wall
          if (ly >= h - 5 && ((lx + ly) % 3 !== 0) && lx < 4 && lx + (h - ly) < 7) col = b[0];
          if (ly >= h - 2 && lx < 3) col = b[1];
          if (lx >= w - 2) col = a[2];
          if (x === x0 + w - 3 && ly < 3) col = a[5];
        }
        put(x, y, col);
      }
      if (!(kindR >= 0.6 && kindR < 0.8)) for (let y = y0; y < y0 + h; y++) put(x0 + (w >> 1), y, blue ? c[0] : a[1]);
      return { lit: true };
    };
    const crownFloors = [[117, 8], [130, 8]];
    for (let k = 0; k < 20; k++) {
      const bx = Math.round(CRX0 + 4 + k * 15.4);
      crownFloors.forEach(([y0, h], f) => win(bx + 3, y0, 7, h, 1000 + k * 10 + f, true));
      // piers
      for (let y = 110; y <= 140; y++) { put(bx, y, b[2], K.SPILL, 2); put(bx + 1, y, b[2], K.SPILL, 2); }
    }
    // crown floodlight: warm scallops climbing from the cornice lights (static)
    for (let k = 0; k < 20; k++) {
      const lx = CRX0 + 11.7 + k * 15.4;
      for (let y = 118; y <= 140; y++) for (let x = Math.round(lx - 9); x <= Math.round(lx + 9); x++) {
        const p = y * W + x; if (x < CRX0 || x > CRX1) continue;
        if (B.idx[p] !== b[1] && B.idx[p] !== b[2]) continue;
        const v = (1 - Math.abs(x - lx) / 9.5) * Math.exp(-(140 - y) / 7.5) * 2.6;
        const band = Math.floor(v + (B4(x, y) - 0.5) * 0.7);
        if (band >= 1) B.idx[p] = band >= 3 ? a[2] : band === 2 ? a[1] : a[0];
      }
      put(Math.round(lx), 140, a[5]); put(Math.round(lx) - 1, 140, a[3]); put(Math.round(lx) + 1, 140, a[3]);
    }
    // main shaft: floors, bays, balconies, piers
    const floors = [[147, 10], [164, 10], [181, 10], [198, 10]];
    B.winRect = {};
    for (let k = 0; k < 20; k++) {
      const bx = Math.round(HX0 + k * 16.4);
      const balc = k === 1 || k === 2 || k === 17 || k === 18;
      floors.forEach(([y0, h], f) => {
        const id = k * 10 + f;
        B.winRect[id] = [bx + 5, y0, 8, h];
        win(bx + 5, y0, 8, h, id, false);
        // PTAC grille under the window
        if (!balc && y0 + h + 3 <= 216) { for (let x = bx + 6; x <= bx + 10; x++) { put(x, y0 + h + 2, b[3]); put(x, y0 + h + 3, (x & 1) ? b[2] : b[3]); } }
        if (balc) { // solid deco balustrade
          rect(bx + 1, y0 + h - 3, bx + 15, y0 + h + 2, b[3], K.SPILL, 2);
          for (let x = bx + 2; x <= bx + 14; x += 2) for (let y = y0 + h - 2; y <= y0 + h + 1; y++) put(x, y, b[2], K.SPILL, 2);
          for (let x = bx + 1; x <= bx + 15; x++) { put(x, y0 + h - 4, b[4], K.SPILL, 3); put(x, y0 + h + 3, b[0]); }
        }
      });
      // pier (stone strip on every second)
      for (let y = 144; y <= 216; y++) { put(bx, y, b[2], K.SPILL, 1); put(bx + 1, y, k % 2 ? b[2] : b[3], K.SPILL, 1); }
    }
    for (const y of [162, 179, 196, 213]) for (let x = HX0; x <= HX1; x++) if (B.idx[y * W + x] === b[1]) put(x, y, b[2], K.SPILL, 1);
    // the lower facade cools and darkens toward the bottom (a dithered gradient into the night ramp); the hotel's
    // masonry is flagged so the frame pass can lay the sign's spill on the top floors, falling off downward
    const coolOf = new Map([[b[1], n[1]], [b[2], n[2]], [b[3], n[3]], [b[4], n[4]]]);
    for (let y = 168; y <= 216; y++) for (let x = HX0; x <= HX1; x++) {
      const p = y * W + x, i = B.idx[p];
      if (!coolOf.has(i)) continue;
      const v = (y - 189) / 5;                       // one tight 5-row Bayer seam, cool below it
      if (v > B4(x, y)) B.idx[p] = coolOf.get(i);
    }
    B.hotel = new Uint8Array(N);
    for (let y = 88; y <= 216; y++) for (let x = 81; x <= 399; x++) { const p = y * W + x; if (B.kind[p] === K.SPILL || B.kind[p] === K.RIM) B.hotel[p] = 1; }

    // ================================================================ rooftop structures behind and beside the sign
    const S = NS.SIGN || { Zs: 106 };
    NS.EYE_HALF = 0.068; NS.EYE_PUPIL = 0.125; NS.EYE_TURN = 1.45; NS.EYE_NO_PUPIL_TUBE = true;
    const lay = NS.layoutSign({ capH: 7.0, y0: 21.0, emblemH: 8.2, emblemGap: 2.2, xc: 0 });
    const ks = F / 106;
    const SX = (x) => CX + ks * x, SY = (y) => CY - ks * y;
    // frame posts (behind letters) and the top girder: silhouettes
    const posts = []; for (let i = 0; i <= 12; i++) posts.push(Math.round(CX + (F / 107.3) * (lay.x0 - 0.4 + (lay.x1 - lay.x0 + 0.8) * i / 12)));
    posts.forEach((x) => { for (let y = 54; y <= 101; y++) { put(x, y, s[0]); put(x + 1, y, n[0]); } put(x, 54, s[1], K.RIM, 2); put(x + 1, 54, s[1], K.RIM, 1); });
    for (let x = posts[0]; x <= posts[12] + 1; x++) { put(x, 56, s[0]); put(x, 57, n[0]); put(x, 76, s[0]); }
    for (let i = 0; i < 12; i++) {
      const x0 = posts[i] + 1, x1 = posts[i + 1];
      if (i % 2) { line(x0, 57, x1, 76, s[0]); line(x0, 76, x1, 101, s[0]); } else { line(x0, 76, x1, 57, s[0]); line(x0, 101, x1, 76, s[0]); }
    }
    // water tank on the hotel roof, left of the eye, its sign side lit
    { const cx = 101, r = 9, top = 70, bot = 96;
      for (const lx of [94, 99, 104, 109]) for (let y = 97; y <= 102; y++) put(lx, y, n[1]);
      line(94, 97, 109, 101, n[1]);
      rect(91, 96, 111, 96, s[0]);
      for (let y = top; y <= bot - 1; y++) for (let x = cx - r; x <= cx + r; x++) {
        const u = (x - cx) / r; let col = (x & 1) ? n[2] : n[1];
        if ((y - top) % 5 === 4) col = n[0];
        put(x, y, col, u > 0.45 ? K.RIM : K.SPILL, u > 0.45 ? (u > 0.8 ? 3 : 2) : 1);
      }
      for (let y = 62; y < top; y++) { const w = Math.round((y - 62) / (top - 62) * (r + 1)); for (let x = cx - w; x <= cx + w; x++) put(x, y, n[2], x > cx ? K.RIM : K.SPILL, x > cx + w / 2 ? 3 : 1); }
      put(cx, 61, s[1]);
      for (let y = 71; y <= 95; y++) put(cx + r + 1, y, s[1], K.RIM, 3);
      for (let y = 72; y <= 95; y += 2) put(cx + r + 2, y, s[1], K.RIM, 2);
    }
    // machine room with rooftop unit and mast (right)
    rect(372, 83, 391, 101, n[2], K.SPILL, 1);
    for (let y = 83; y <= 101; y++) for (let x = 363; x <= 371; x++) { const topY = 83 + Math.round((371 - x) * 0.25); if (y >= topY) put(x, y, n[3], K.SPILL, 3); }
    for (let x = 362; x <= 392; x++) put(x, x < 372 ? 82 + Math.round((371 - x) * 0.25) : 82, b[4], K.RIM, 2);
    for (let y = 86; y <= 92; y += 2) for (let x = 364; x <= 369; x++) put(x, y, n[2], K.SPILL, 3);   // louvre
    rect(385, 92, 389, 101, s[0]); put(387, 90, a[6]); put(386, 90, a[3]); put(388, 90, a[3]); put(387, 91, a[2]);
    rect(376, 75, 386, 81, s[1], K.SPILL, 1); for (let x = 377; x <= 385; x += 2) put(x, 77, s[0]); for (let x = 376; x <= 386; x++) put(x, 75, s[2], K.RIM, 2);
    for (let y = 12; y <= 81; y++) put(382, y, s[1], K.RIM, 1);
    rect(381, 11, 383, 11, s[1]);
    line(382, 40, 372, 82, s[0]); line(382, 40, 391, 82, s[0]);
    // electrical cabinet behind the parapet
    rect(163, 96, 171, 101, s[1], K.SPILL, 2); for (let x = 163; x <= 171; x++) put(x, 95, s[2], K.RIM, 3);
    rect(299, 98, 305, 101, s[1], K.SPILL, 2); for (let x = 299; x <= 305; x++) put(x, 97, s[2], K.RIM, 3);

    // ================================================================ the sign
    // rasterise each source (pixel-centre fill of its panels), then ring classes by 4-neighbour distance to the edge
    B.faceMasks = [];
    lay.sources.forEach((src, k) => {
      const set = new Set();
      src.polys.forEach((pl) => poly(pl.map(([x, y]) => [SX(x), SY(y)]), null).forEach((p) => set.add(p)));
      B.faceMasks.push(set);
    });
    // clean: drop single orphan pixels and fill single pinholes (4-neighbour)
    B.faceMasks.forEach((set) => {
      for (let pass = 0; pass < 2; pass++) {
        const add = [], del = [];
        set.forEach((p) => { const nb = [p - 1, p + 1, p - W, p + W].filter((q) => set.has(q)).length; if (nb <= 1) del.push(p); });
        set.forEach((p) => { for (const q of [p - 1, p + 1, p - W, p + W]) if (!set.has(q)) { const nb = [q - 1, q + 1, q - W, q + W].filter((r) => set.has(r)).length; if (nb >= 3) add.push(q); } });
        del.forEach((p) => set.delete(p)); add.forEach((p) => set.add(p));
      }
    });
    // the sign's extent and each source's centre and size (for the halo's shape and its local brightness)
    { let x0 = W, x1 = 0, y0 = H, y1 = 0; B.srcX = []; B.srcA = [];
      B.faceMasks.forEach((set) => { let sx = 0; set.forEach((p) => { const x = p % W, y = (p / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); sx += x; }); B.srcX.push(sx / set.size); B.srcA.push(set.size); });
      B.signBox = [x0, y0, x1, y1]; }
    // returns: one dark pixel under every bottom edge (the lightbox seen from below), and the trim cap
    B.faceMasks.forEach((set) => set.forEach((p) => { if (!set.has(p + W)) { put((p + W) % W, ((p + W) / W) | 0, s[0]); put((p + 2 * W) % W, ((p + 2 * W) / W) | 0, s[0], K.RIM, 1); } }));
    B.faceMasks.forEach((set, k) => {
      const dist = new Map(); let front = [];
      set.forEach((p) => { if ([p - 1, p + 1, p - W, p + W].some((q) => !set.has(q))) { dist.set(p, 1); front.push(p); } });
      let d = 1;
      while (front.length) { const nx = []; d++; front.forEach((p) => { for (const q of [p - 1, p + 1, p - W, p + W]) if (set.has(q) && !dist.has(q)) { dist.set(q, d); nx.push(q); } }); front = nx; }
      dist.forEach((dd, p) => { B.idx[p] = 0; B.kind[p] = K.FACE; B.src[p] = k; B.lvl[p] = Math.min(dd, 4); });
    });
    // tubes: the LED rows down the middle of each stroke run hot (class 5)
    lay.sources.forEach((src, k) => src.tubes.forEach((tb) => {
      for (let j = 0; j + 1 < tb.length; j++) {
        const [x0, y0] = tb[j], [x1, y1] = tb[j + 1], L = Math.hypot(SX(x1) - SX(x0), SY(y1) - SY(y0)), steps = Math.max(1, Math.ceil(L * 2));
        for (let q = 0; q <= steps; q++) {
          const u = q / steps, x = Math.floor(SX(x0 + (x1 - x0) * u)), y = Math.floor(SY(y0 + (y1 - y0) * u)), p = y * W + x;
          if (B.kind[p] === K.FACE && B.src[p] === k && B.lvl[p] >= 3) B.lvl[p] = 5;
        }
      }
    }));
    B.layout = lay;
    // tired modules: a short run of the A's left-leg tube and a patch of the D's bowl burn a step dimmer (class 6)
    { const tired = (k, fx0, fy0, fx1, fy1) => { const bx = lay.sources[k].box; for (let p of B.faceMasks[k]) { const x = p % W, y = (p / W) | 0;
        const u = (x - SX(bx[0])) / (SX(bx[2]) - SX(bx[0])), v = (SY(bx[1]) - y) / (SY(bx[1]) - SY(bx[3]));
        if (u >= fx0 && u <= fx1 && v >= fy0 && v <= fy1 && B.lvl[p] >= 4) B.lvl[p] = 6; } };
      tired(5, 0.05, 0.12, 0.40, 0.46); tired(3, 0.70, 0.52, 1.0, 0.80); }
    { // the pupil's catchlight: one hot pixel up and left of centre
      const em = lay.sources[7].box, pc = NS.EYE_PUPIL_C, ex0 = lay.x0, ey0 = lay.emY0, eh = lay.emY1 - lay.emY0;
      const px = Math.floor(SX(ex0 + pc[0] * eh)) - 1, py = Math.floor(SY(ey0 + pc[1] * eh)) - 1, p = py * W + px;
      if (B.kind[p] === K.FACE) B.lvl[p] = 5;
      B.catch = p;
    }

    // ================================================================ catwalk, railing, cables, ladder, work light
    const cw0 = posts[0] - 3, cw1 = posts[12] + 4;
    for (let x = cw0; x <= cw1; x++) {
      put(x, 86, s[2], K.RIM, 3);      // top rail
      put(x, 89, s[1], K.RIM, 2);      // mid rail
      put(x, 91, s[2], K.RIM, 3);      // deck edge
      put(x, 92, s[1], K.RIM, 2);      // toe board
      put(x, 93, s[0]);
    }
    for (let x = cw0; x <= cw1; x += 8) for (let y = 86; y <= 92; y++) put(x, y, s[2], K.RIM, 2);
    posts.forEach((x) => { line(x, 94, x, 99, s[0]); put(x, 94, s[1], K.RIM, 2); });
    // conduit sagging between the outriggers (one pixel per column)
    for (let i = 0; i < 12; i++) { const x0 = posts[i], x1 = posts[i + 1]; for (let x = x0 + 1; x < x1; x++) { const u = (x - x0) / (x1 - x0); put(x, 95 + Math.round(2.2 * 4 * u * (1 - u)), s[0], K.RIM, 1); } }
    // feeds drooping to the cabinet
    for (let x = 162; x <= 168; x++) { const u = (x - 162) / 6; put(x, 93 + Math.round(u * 2 + 2 * u * (1 - u)), s[0]); }
    for (let y = 93; y <= 95; y++) put(161, y, s[0]);
    // catwalk lights: amber glints along the toe board; rivets: single pale pixels on the rail at each post
    for (let x = cw0 + 13; x < cw1; x += 31) put(x, 92, a[5]);
    posts.forEach((x) => put(x, 86, n[8], K.RIM, 3));
    // ladder at the right end
    for (let y = 86; y <= 102; y++) { put(cw1 - 1, y, s[1], K.RIM, 2); put(cw1 + 2, y, s[1], K.RIM, 2); }
    for (let y = 88; y <= 101; y += 2) { put(cw1, y, s[1]); put(cw1 + 1, y, s[1]); }
    // the work light: a caged bulb left burning near the right end
    const wb = [cw1 - 13, 84];
    put(wb[0], wb[1], a[6]); put(wb[0] - 1, wb[1], a[4]); put(wb[0] + 1, wb[1], a[4]); put(wb[0], wb[1] - 1, a[5]); put(wb[0], wb[1] + 1, a[3]);
    put(wb[0] - 1, wb[1] - 1, a[2]); put(wb[0] + 1, wb[1] - 1, a[2]);
    put(wb[0], 85, s[1]);
    B.bulb = wb;

    // ================================================================ the glass tower (right): curtain wall in perspective, mirror map
    const GX0 = 397;
    for (let y = 0; y <= 215; y++) for (let x = GX0; x < W; x++) {
      const z = F * 27.5 / (x + 0.5 - CX), yy = (CY - (y + 0.5)) * z / F;
      const pz = z / 1.5, fl = (yy + 64) / 4.0;
      const lz = pz - Math.floor(pz), lf = fl - Math.floor(fl);
      const dzdx = F * 27.5 / Math.pow(x + 0.5 - CX, 2) / 1.5; // panes per pixel
      const mull = (Math.floor(pz) % 2 === 0) && lz < Math.min(0.5, dzdx * 1.0) && dzdx < 0.35;
      const spand = lf > 0.74;
      const trans = lf > 0.74 && lf < 0.74 + Math.max(0.02, 1 / (F * 4 / z));
      let col = t[0], k = K.GLASS;
      if (spand) col = t[1];
      if (mull || trans) { col = trans ? t[2] : t[1]; k = K.SOLID; }
      // a few offices still lit: a band of ceiling lights near the top of the vision glass
      const fi = Math.floor(fl), pi = Math.floor(pz / 5);
      const litFloor = NS.mulberry32(fi * 31 + 7)() < 0.08 && NS.mulberry32(fi * 53 + pi * 7 + 1)() < 0.7;
      if (litFloor && !spand && !mull) col = lf > 0.62 && lf < 0.7 ? n[7] : (lf > 0.45 ? t[2] : t[1]);
      put(x, y, col, k, spand ? 1 : 0);
      if (k === K.GLASS && !spand) {
        // mirror: reflect the camera in the plane x = 27.5 and follow the ray to the sign plane (z = 106)
        const pr = NS.mulberry32(Math.floor(pz / 2) * 977 + fi * 131), jit = Math.round((pr() - 0.5) * 4), jy = Math.round((pr() - 0.5) * 2);
        const qx = 55 - 27.5 * 106 / z, qy = yy * 106 / z;
        const sx = Math.round(CX + ks * qx) + jit, sy = Math.round(CY - ks * qy) + jy;
        if (sx >= 0 && sx < W && sy >= 0 && sy < H) B.gmap[y * W + x] = sy * W + sx;
      }
    }
    // the tower's edge, a hard vertical
    for (let y = 0; y <= 215; y++) { put(GX0, y, t[2]); put(GX0 + 1, y, n[0]); }

    // ================================================================ mid-ground rooftops
    // left block with a timber water tank on a tall stand, a stair bulkhead and a vent stack
    rect(0, 197, 212, 216, b[0], K.SPILL, 1);
    for (let x = 0; x <= 212; x++) { put(x, 196, n[3], K.RIM, 1); put(x, 197, n[2]); }
    { const r = NS.mulberry32(77); for (let x = 6; x < 206; x += 11) { const lit = r() < 0.35; rect(x, 203, x + 3, 208, lit ? a[2] : n[1]); if (lit) { put(x + 1, 207, a[3]); put(x + 2, 207, a[3]); } put(x + 4, 203, b[0]); } }
    rect(60, 176, 90, 195, n[1], K.SPILL, 1); for (let x = 60; x <= 90; x++) put(x, 175, n[3], K.RIM, 2); rect(70, 182, 75, 195, n[0]);
    rect(197, 174, 200, 195, n[1]); rect(196, 172, 201, 173, n[2], K.RIM, 2);
    { const cx = 120, r = 11, top = 133, bot = 162;
      // stand: four legs and cross braces, the lower legs catching the street's amber
      for (const lx of [111, 117, 123, 129]) for (let y = bot + 2; y <= 195; y++) put(lx, y, y > 186 ? a[1] : n[0]);
      for (const [y0, y1] of [[167, 193], [193, 167]]) line(111, y0, 129, y1, n[0]);
      rect(107, bot + 1, 133, bot + 1, n[2]); rect(107, bot + 2, 133, bot + 2, n[0]);
      for (let y = top; y <= bot; y++) for (let x = cx - r; x <= cx + r; x++) {
        const u = (x - cx) / r;
        let col = ((x - cx + 40) % 3 === 0) ? n[1] : n[2];          // staves
        if (u < -0.55) col = n[1];                                   // the shadow side
        if ((y - top) % 6 === 5) col = u < -0.55 ? n[2] : n[3];      // steel hoops
        if (u > 0.8) put(x, y, col, K.BRIM, u > 0.95 ? 5 : 3);       // rim on the sign side
        else put(x, y, col, K.SPILL, 1);
      }
      for (let y = bot - 3; y <= bot; y++) put(cx - r, y, a[1]);     // amber from below on the shadow edge
      put(cx - r + 1, bot, a[1]);
      for (let y = 123; y < top; y++) { const w = Math.round((y - 123) / (top - 123) * (r + 1)); for (let x = cx - w; x <= cx + w; x++) { const rim = x >= cx + w - 1; put(x, y, rim ? n[3] : n[2], rim ? K.BRIM : K.SPILL, rim ? 4 : 1); } }
      for (let x = cx - r - 1; x <= cx + r + 1; x++) put(x, top, n[3], x > cx ? K.BRIM : K.SOLID, 3);
      put(cx, 122, n[3], K.BRIM, 4);
    }
    // right block: a strip of roof with HVAC boxes and a tall vent pipe
    rect(281, 209, 479, 216, b[0], K.SPILL, 1); for (let x = 281; x <= 479; x++) put(x, 208, n[3], K.RIM, 1);
    rect(314, 200, 350, 207, n[1], K.SPILL, 1); for (let x = 314; x <= 350; x++) put(x, 199, n[3], K.RIM, 2); for (let x = 316; x <= 348; x += 3) put(x, 203, n[0]);
    rect(362, 202, 392, 207, n[1], K.SPILL, 1); for (let x = 362; x <= 392; x++) put(x, 201, n[3], K.RIM, 2);
    rect(426, 155, 428, 207, n[1]); rect(424, 152, 430, 154, n[2], K.RIM, 2); for (let y = 156; y <= 206; y++) put(428, y, n[3], K.RIM, 1);

    // ================================================================ our roof in the foreground
    // a low parapet at the far edge with a coping highlight that takes the sign's light
    for (let x = 0; x < W; x++) {
      put(x, 211, n[5], K.BRIM, 4); put(x, 212, n[2]); put(x, 213, n[3]); put(x, 214, n[3]); put(x, 215, n[1]); put(x, 216, n[0]);
      if (x % 9 === 0) put(x, 213, n[2]); if (x % 9 === 4) put(x, 214, n[2]);   // block joints
    }
    // tar membrane: base, perspective lap seams converging on the vanishing point, cross seams, tar patches, gravel
    for (let y = 217; y < H; y++) for (let x = 0; x < W; x++) put(x, y, n[1], K.WET);
    const VY = CY, seamX = [-4.5, -1.5, 1.5, 4.5];
    for (let y = 217; y < H; y++) seamX.forEach((X) => { const x = Math.round(CX + X * (y - VY) / 1.6); put(x, y, n[2], K.WET); put(x + 1, y, n[0], K.WET); });
    [12, 15, 19, 24].forEach((z) => { const y = Math.round(VY + F * 1.6 / z); for (let x = 0; x < W; x++) { put(x, y, n[2], K.WET); put(x, y + 1, n[0], K.WET); } });
    const patches = [[118, 226, 12, 2.5], [372, 230, 10, 2], [446, 245, 14, 3], [20, 248, 11, 3]];
    patches.forEach(([px, py, rx, ry]) => { for (let y = py - ry; y <= py + ry; y++) for (let x = px - rx; x <= px + rx; x++) { const d = Math.pow((x - px) / rx, 2) + Math.pow((y - py) / ry, 2); if (d < 1) put(x, y, d > 0.7 && y < py ? n[2] : n[0], K.WET); } });
    { const r = NS.mulberry32(4242);
      for (let y = 219; y < H; y += 3) for (let x = 2; x < W - 2; x += 5) {
        if (r() > 0.14 + 0.16 * (y - 219) / 50) continue;
        const gx = x + ((r() * 4) | 0), gy = y + ((r() * 2) | 0), p = gy * W + gx;
        if (gy >= H || B.idx[p] !== n[1]) continue;
        put(gx, gy, n[2], K.WET); if (r() < 0.5) put(gx + 1, gy, n[2], K.WET); if (r() < 0.25) put(gx, gy - 1, n[3], K.WET);
      } }
    // puddles: four deliberate shapes (unions of flat ellipses), cleaned, with a soaked dark margin
    const PUD = [
      [[250, 245, 96, 13], [176, 240, 44, 7], [330, 251, 50, 10]],
      [[80, 229, 38, 6], [56, 232, 18, 4]],
      [[400, 259, 56, 9], [446, 263, 22, 5]],
      [[150, 265, 26, 4.5]],
    ];
    B.pud = new Int8Array(N).fill(-1); B.pudTop = new Int16Array(N);
    PUD.forEach((shape, id) => {
      for (let y = 217; y < H; y++) for (let x = 0; x < W; x++) {
        for (const [px, py, rx, ry] of shape) { const d = Math.pow((x + 0.5 - px) / rx, 2) + Math.pow((y + 0.5 - py) / ry, 2); if (d < 1) { B.pud[y * W + x] = id; break; } }
      }
    });
    for (let pass = 0; pass < 2; pass++) for (let y = 218; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, me = B.pud[p] >= 0;
      const nb = [p - 1, p + 1, p - W, p + W].filter((q) => (B.pud[q] >= 0) === me).length;
      if (nb <= 1) B.pud[p] = me ? -1 : Math.max(B.pud[p - 1], B.pud[p + 1], B.pud[p - W], B.pud[p + W]);
    }
    for (let y = 217; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (B.pud[p] >= 0) { let t0 = y; while (t0 > 217 && B.pud[(t0 - 1) * W + x] === B.pud[p]) t0--; B.pudTop[p] = t0; put(x, y, n[0], K.PUDDLE); }
      else if ([p - 1, p + 1, p - W, p + W, p - 2, p + 2].some((q) => q >= 0 && q < N && B.pud[q] >= 0)) put(x, y, n[0], K.WET);  // soaked margin
    }
    // grounding objects: the gooseneck vent (left), a roof hatch (right), a drain at the big puddle's edge
    rect(44, 222, 47, 239, n[0]); rect(44, 218, 53, 221, n[0]); rect(52, 222, 53, 224, n[0]);
    for (let y = 222; y <= 239; y++) { put(44, y, n[3]); put(45, y, n[2]); }
    for (let x = 44; x <= 53; x++) put(x, 218, n[4]); put(53, 224, n[2]);
    for (let x = 42; x <= 49; x++) put(x, 240, n[0]);
    rect(402, 227, 452, 229, n[3]); for (let x = 402; x <= 452; x++) put(x, 226, n[5], K.BRIM, 3);   // hatch lid, lit far edge
    rect(403, 230, 451, 236, n[2]); for (let x = 403; x <= 451; x += 6) for (let y = 231; y <= 235; y++) put(x, y, n[1]);
    rect(402, 237, 453, 237, n[0]); put(427, 233, n[6]); put(428, 233, n[5]);
    rect(120, 252, 126, 253, n[0]); put(121, 252, n[3]); put(123, 252, n[3]); put(125, 252, n[3]);

    // ================================================================ glow fields (one per light source) and roof columns
    const blur = (src, rx, ry) => { // three box passes each way
      let a0 = Float32Array.from(src), a1 = new Float32Array(N);
      for (let pass = 0; pass < 3; pass++) {
        for (let y = 0; y < H; y++) { let acc = 0; const o = y * W; for (let x = -rx; x < W + rx; x++) { if (x + rx < W) acc += a0[o + Math.min(W - 1, x + rx)]; if (x - rx - 1 >= 0) acc -= a0[o + x - rx - 1]; if (x >= 0 && x < W) a1[o + x] = acc / (2 * rx + 1); } }
        for (let x = 0; x < W; x++) { let acc = 0; for (let y = -ry; y < H + ry; y++) { if (y + ry < H) acc += a1[Math.min(H - 1, y + ry) * W + x]; if (y - ry - 1 >= 0) acc -= a1[(y - ry - 1) * W + x]; if (y >= 0 && y < H) a0[y * W + x] = acc / (2 * ry + 1); } }
      }
      return a0;
    };
    B.glow = []; B.glowFar = []; B.col = [];
    B.faceMasks.forEach((set) => {
      const m0 = new Float32Array(N); set.forEach((p) => (m0[p] = 1));
      const near = blur(m0, 3, 3), wide = blur(m0, 22, 12), far = blur(m0, 44, 26);
      const gk = new Float32Array(N), gf = new Float32Array(N);
      for (let i = 0; i < N; i++) { const yy = (i / W) | 0; const up = yy < 95 ? 1.0 : Math.exp(-(yy - 95) / 30); gk[i] = 3.0 * near[i] + 2.2 * wide[i]; gf[i] = 7.0 * far[i] * up + 1.2 * wide[i]; }
      B.glow.push(gk); B.glowFar.push(gf);
      const colp = new Float32Array(W);
      let tot = 0; set.forEach((p) => { colp[p % W] += 1; tot++; });
      const cb = new Float32Array(W);
      for (let x = 0; x < W; x++) { let acc = 0; for (let d = -26; d <= 26; d++) { const xx = x + d; if (xx >= 0 && xx < W) acc += colp[xx] * (1 - Math.abs(d) / 27); } cb[x] = acc / 80; }
      B.col.push(cb);
    });
    return B;
  };
})();
