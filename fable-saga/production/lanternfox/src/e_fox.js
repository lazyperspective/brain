  /* ================================================================ the fox kit
     A rig in local units (≈ 1 cm; the kit is ~38 long without its tail), x forward, y down, ground at y = 0. Its head is
     a sphere in 3-D (yaw turns it from profile toward the camera, so the eyes, muzzle, ears and cheek ruffs move over it
     as they would on a real head); the body, legs and tail are 2-D chains in four passes (far legs and far ear, tail,
     body and near legs, head). Shaded per pixel: fur albedo by region (orange coat, white bib, cheeks, muzzle and tail
     tip, black socks and ear tips, cream ear insides), sky light with a cool rim, the lantern's warm light with Lambert,
     snow bounce from below, fur grain in local space (it moves with the fox, never swims), an ink edge. */
  function foxPose(o) {
    return Object.assign({
      ph: 0, gait: 0, A: 0, lift: 0, bob: 0, sq: 0, pitch: 0,
      hx: 0, hy: 0, tilt: 0, yaw: 0.42, nod: 0,
      earN: 0, earF: 0, perk: 0,
      tLift: 0, tCurl: 0, wag: 0, wagD: null,
      mouth: 0, eyes: 1, happy: 0, lookX: 0.3, lookY: 0, wide: 0,
      dig: 0, digReach: 0, sit: 0, curl: 0, breath: 0, sniff: 0, sleep: 0,
    }, o || {});
  }
  // two-bone IK: from a to target t with bone lengths l1, l2; bend +1 or −1; returns the joint
  function ik2(ax, ay, tx, ty, l1, l2, bend) {
    let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy);
    const dm = Math.max(0.01, Math.min(d, l1 + l2 - 0.01));
    const a = Math.atan2(dy, dx), c = clamp((l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm), -1, 1), b = Math.acos(c) * bend;
    return [ax + Math.cos(a + b) * l1, ay + Math.sin(a + b) * l1];
  }
  // the head's 3-D frame: a feature at (az, el) on a sphere of radius r about (cx, cy) → [x, y, z (toward camera)]
  function hfeat(F, az, el, r) {
    const ce = Math.cos(el), x = ce * (Math.cos(az) * F.fx + Math.sin(az) * F.rx), z = ce * (Math.cos(az) * F.fz + Math.sin(az) * F.rz), y = -Math.sin(el);
    // tilt (nose down) turns the frame about the ear-to-ear axis (approximately: a rotation in the screen plane)
    const ct = Math.cos(F.tilt), st = Math.sin(F.tilt);
    return [F.cx + (x * ct - y * st) * r, F.cy + (x * st + y * ct) * r, z];
  }
  const FOX = {};                                              // the rig of the frame being drawn (local units)
  function foxRig(p) {
    const R = FOX, g = p.gait, cur = p.curl, sit = p.sit;
    const bob = p.bob - (g > 0 ? 0.55 * g * Math.cos(p.ph * TAU * 2) : 0) - p.lift;
    const br = 0.18 * Math.sin(p.breath);
    // the body: rump, waist, chest; pitch tips it (nose down +), sitting lowers the rump, curling bends it round
    const pc = Math.cos(p.pitch), ps = Math.sin(p.pitch);
    const rot = (x, y) => [x * pc - y * ps, x * ps + y * pc];
    let [rx, ry] = rot(-5.8, -15.4), [mx, my] = rot(-0.2, -16.0), [cx, cy] = rot(5.2, -16.0);
    ry += bob; my += bob; cy += bob;
    if (sit > 0) { rx = lerp(rx, -4.5, sit); ry = lerp(ry, -6.8, sit); mx = lerp(mx, 0.3, sit); my = lerp(my, -12.5, sit); cx = lerp(cx, 4.6, sit); cy = lerp(cy, -18.0, sit); }
    if (cur > 0) { // lying curled: rump to the left, chest round in front, low to the ground
      rx = lerp(rx, -6, cur); ry = lerp(ry, -6.2, cur); mx = lerp(mx, 0, cur); my = lerp(my, -7.4, cur); cx = lerp(cx, 6.5, cur); cy = lerp(cy, -6.4, cur);
    }
    R.rump = [rx, ry, 5.7 + br * 0.5]; R.mid = [mx, my, 4.9 + br]; R.chest = [cx, cy, 5.4 + br];
    // the head: on the neck, ahead of the chest and above it
    let hxl = cx + 7.6 + p.hx, hyl = cy - 9.6 + p.hy - (g > 0 ? 0.35 * g * Math.cos(p.ph * TAU * 2 + 0.9) : 0);
    if (cur > 0) { hxl = lerp(hxl, 10.5, cur); hyl = lerp(hyl, -9.2, cur); }
    R.hc = [hxl, hyl]; R.hr = 7.1;
    const yaw = p.yaw, ya = yaw * PI / 2;
    R.F = { cx: hxl, cy: hyl, fx: Math.cos(ya), fz: Math.sin(ya), rx: -Math.sin(ya), rz: Math.cos(ya), tilt: p.tilt + p.nod + p.pitch * 0.5 };
    // legs: four foot paths (trot: diagonal pairs), with IK
    const legs = [];
    const A = p.A, lift = p.lift;
    const LEG = [ // [front?, near?, hip x, hip y, paw x, phase offset]
      [1, 1, cx + 1.2, cy + 2.8, cx + 1.6, 0.0], [1, 0, cx - 0.4, cy + 2.2, cx - 0.1, 0.5],
      [0, 1, rx - 0.6, ry + 2.8, rx - 1.0, 0.5], [0, 0, rx + 0.8, ry + 2.2, rx + 0.3, 0.0]];
    for (let k = 0; k < 4; k++) {
      const [fr, nr, hx, hy, px0] = LEG[k], off = LEG[k][5];
      let fx = px0, fy = 0;
      if (g > 0 && A > 0) {
        const q = frac(p.ph + off);
        if (q < 0.56) fx = px0 + A * (1 - 2 * q / 0.56);
        else { const u = (q - 0.56) / 0.44; fx = px0 - A + 2 * A * eis(u); fy = -(fr ? 3.4 : 2.8) * Math.sin(PI * u) * Math.min(1, A / 3); }
      }
      if (fr && nr && p.dig > 0) { // digging: the near forepaw reaches forward and scrapes back
        fx = lerp(fx, cx + 4.5 + p.digReach * 4.5, p.dig); fy = lerp(fy, -1.2 - 4.0 * clamp(p.digReach, 0, 1) * (1 - p.digReach * 0.5), p.dig);
      }
      if (sit > 0 && !fr) { fx = lerp(fx, rx + 5.5, sit); }
      if (sit > 0 && fr) { fx = lerp(fx, cx + 1.4, sit); }
      if (cur > 0) { fx = lerp(fx, fr ? cx + 3.2 + (nr ? 0 : -1.5) : rx + 4.0 + (nr ? 0 : -1.5), cur); fy = lerp(fy, fr ? -0.8 : -1.0, cur); }
      const top = [hx, hy];
      if (fr) {
        const pawX = fx, pawY = fy - 1.5;
        const el = ik2(hx, hy, pawX - 0.3, pawY, 6.5, 6.4, cur > 0.5 ? -1 : 1);
        legs.push({ fr, nr, top, j1: el, j2: null, paw: [pawX, pawY] });
      } else {
        const pawX = fx, pawY = fy - 1.5, hk = [pawX - 1.5 + (sit > 0 ? -2.5 * sit : 0), pawY - 4.2 + (sit > 0 ? 2.6 * sit : 0)];
        const kn = ik2(hx, hy, hk[0], hk[1], 5.8, 5.6, -1);
        legs.push({ fr, nr, top, j1: kn, j2: hk, paw: [pawX, pawY] });
      }
    }
    R.legs = legs;
    // the tail: a chain from the rump, lifted and curled, its wag delayed down its length (follow-through)
    const tb = [rx - 5.0, ry - 1.4], wagD = p.wagD || ((d) => p.wag);
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      // rest shape: out and back, then up toward the tip
      let ax = -u * 18 - u * u * 1.5 + u * u * u * 4, ay = u * 2.5 - u * u * 11.5;
      const lf = p.tLift * u, cu = p.tCurl * u * u;
      const ang = lf + wagD(u) * (0.25 + 0.75 * u) + cu * 1.2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      let x = tb[0] + ax * ca - ay * sa, y = tb[1] + ax * sa + ay * ca;
      if (cur > 0) { // curled: from the rump along the front of the body (over the paws), its tip up over the nose
        const cx2 = -12 + 24.5 * u, cy2 = -2.6 - 1.2 * Math.sin(PI * u) - 9 * Math.max(0, u - 0.7) ** 1.2;
        x = lerp(x, cx2, cur); y = lerp(y, cy2, cur);
      }
      pts.push([x, y]);
    }
    R.tail = pts;
    return R;
  }
  const TAILR0 = (u) => (2.4 + 4.6 * Math.pow(Math.sin(PI * clamp(u * 0.86 + 0.07, 0, 1)), 0.55)) * (u > 0.92 ? 1 - (u - 0.92) * 4.5 : 1);
  let TAILK = 1;
  const TAILR = (u) => TAILR0(u) * TAILK;
  // fur grain: a tile of streaky noise (in local units), looked up cheaply
  const FURT = new Float32Array(64 * 64);
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) FURT[j * 64 + i] = (vn(i * 0.7 + j * 0.25, j * 2.2, 2.6, 771) - 0.5) * 1.1 + (vn(i * 1.6, j * 4.5, 2, 773) - 0.5) * 0.5;
  const furG = (x, y) => FURT[((fl(y * 2) & 63) << 6) | (fl(x * 2) & 63)];

  /* drawFox(p, sx, sy, S, f, light): screen point (sx, sy) is the ground under the body centre; S px per unit; f = ±1
     facing. light: {sky: [dx, dy] direction the sky light comes from, rim, amb, z: the fox's depth for the lamp,
     shadowY: where its shadow falls}. Returns the screen positions of the mouth and the eyes. */
  const FOXOUT = { mouth: [0, 0], nose: [0, 0], eye: [0, 0], head: [0, 0], chest: [0, 0] };
  let FXs = 0, FYs = 0, FS = 1, FF = 1, FLT = null, FP = null;
  const fX = (x) => FXs + FF * x * FS, fY = (y) => FYs + y * FS;
  function foxShade(X, Y, s, pass) {
    const S = FS, ol = Math.max(0.75, 0.55 * S);
    const id = SDF.id;
    if (-s < ol) return pass === 0 ? 196 : 176;                // the ink edge (darker still on the far side)
    const n = sdNormal(s), nx = n[0], ny = n[1], nc = n[2];
    const lx = (X + 0.5 - FXs) / (S * FF), ly = (Y + 0.5 - FYs) / S;
    const L = FLT;
    // sky light from above and behind (cool), a rim where the surface turns away, a little cool bounce from the snow
    const sdx = L.sky[0] * FF, sdy = L.sky[1];
    const dsk = nx * sdx + ny * sdy;
    let sk = L.amb + 0.55 * Math.max(0, dsk * 0.75 + nc * 0.4) + 0.12 * Math.max(0, ny);
    const rim = (1 - nc) * (1 - nc) * Math.max(0, dsk + 0.2) * L.rim;
    sk += rim;
    // the lantern (it hangs on the camera side, in front of the chest)
    let l = lampAt(X, Y, L.z, nx, Math.max(-0.98, ny)) * (L.gain || 1);
    // which fur: by part and region
    let m = M_FOX, g = furG(lx * 1.3, ly);
    if (id === 16) { // tail: white tip, a darker band before it, paler under
      const u = SDF.u;
      if (u > 0.8 + 0.03 * Math.sin(SDF.lat * 7)) m = M_FOXW; else if (u > 0.66) sk -= 0.12;
      g = furG(u * 22, SDF.lat * 3 + SDF.side * 4) * 1.3;
      if (SDF.lat > 0.75) sk += 0.05;
    } else if (id === 8 || id === 9) { // ears: black tips, black backs on the far ear, cream insides on the near
      const u = SDF.u;
      if (u > 0.6) m = M_FOXK;
      else if (id === 8 && SDF.side * FF * FP.earSide > 0 && SDF.lat < 0.78 && u > 0.1) { m = M_EARIN; sk += 0.1; }
      else if (id === 9) sk -= 0.08;
    } else if (id === 7) m = M_FOXW;
    else if (id === 6) { // muzzle: white below the line from the nose to the cheek, orange above
      const F = FOX.F;
      if ((SDF.side * FF > 0 && SDF.lat > 0.12) || (F.fz > 0.75 && SDF.lat < 0.55) || SDF.u > 0.9) m = M_FOXW;
    } else if (id === 5) {
      // the head: a white blaze round the muzzle and under the eyes
      const F = FOX.F, hc = FOX.hc, r = FOX.hr;
      const dx = (lx - hc[0]) / r, dy = (ly - hc[1]) / r, fw = dx * F.fx;
      if (dy > 0.32 - 0.38 * clamp(fw, -0.2, 1) + 0.06 * Math.sin(dx * 9)) m = M_FOXW;
    } else if (id >= 10 && id <= 15) { // legs: black socks below the elbow and hock
      const u = SDF.u;
      if ((id === 10 || id === 11 || id === 12) ? u > 0.62 + 0.06 * Math.sin(lx * 3) : u > 0.74) m = M_FOXK;
      if (id === 12 || id === 15) m = M_FOXK;
    } else if (id === 3 || id === 4) {
      // the bib: white down the front of the throat and chest (not round the back of the neck)
      const ch = FOX.chest;
      if (id === 4) { if (SDF.side * FF > 0 && SDF.lat > 0.25 - 0.1 * Math.sin(ly * 2.5)) m = M_FOXW; }
      else if (lx > ch[0] + 1.2 + 0.6 * Math.sin(ly * 2.4) && ly > ch[1] - 3.2) m = M_FOXW;
    } else if (id === 1 || id === 2) {
      if (ly > FOX.mid[1] + 3.3) sk += 0.06;
    }
    if (m === M_FOXK) g *= 0.6;
    sk += g * 0.11;
    if (pass === 0) { sk *= 0.72; l *= 0.62; }
    return mcq(m, sk, l, X, Y);
  }
  function foxPassFar(R) {
    sdBegin();
    const S = FS;
    for (const g of R.legs) if (!g.nr) foxLeg(g);
    // the far ear (behind the head)
    const E = R.earF; sdCap(fX(E[0]), fY(E[1]), fX(E[2]), fY(E[3]), 4.3 * S, 0.7 * S, 0.6 * S, 9, 0, 1, 0.2 * S);
    sdDraw((X, Y, s) => foxShade(X, Y, s, 0));
  }
  function foxLeg(g) {
    const S = FS, [hx, hy] = g.top, [jx, jy] = g.j1, [px, py] = g.paw, idb = g.fr ? 10 : 13;
    if (g.fr) {
      sdCap(fX(hx), fY(hy), fX(jx), fY(jy), 2.5 * S, 1.6 * S, 1.2 * S, idb, 0, 0.5);
      sdCap(fX(jx), fY(jy), fX(px), fY(py), 1.6 * S, 1.35 * S, 0.7 * S, idb + 1, 0.5, 1);
      sdBall(fX(px + 0.6), fY(py + 0.35), 1.7 * S, 0.8 * S, 12);
    } else {
      const [kx, ky] = g.j2;
      sdCap(fX(hx), fY(hy), fX(jx), fY(jy), 3.5 * S, 2.1 * S, 1.6 * S, idb, 0, 0.4);
      sdCap(fX(jx), fY(jy), fX(kx), fY(ky), 2.0 * S, 1.4 * S, 1.0 * S, idb + 1, 0.4, 0.7);
      sdCap(fX(kx), fY(ky), fX(px), fY(py), 1.4 * S, 1.3 * S, 0.6 * S, idb + 1, 0.7, 1);
      sdBall(fX(px + 0.5), fY(py + 0.35), 1.65 * S, 0.8 * S, 15);
    }
  }
  function foxPassTail(R, k0, k1) {
    sdBegin();
    const S = FS, T = R.tail;
    for (let k = k0 || 0; k < (k1 || 8); k++) {
      const u0 = k / 8, u1 = (k + 1) / 8;
      sdCap(fX(T[k][0]), fY(T[k][1]), fX(T[k + 1][0]), fY(T[k + 1][1]), TAILR(u0) * S, TAILR(u1) * S, 1.4 * S, 16, u0, u1, 0.62 * S);
    }
    sdDraw((X, Y, s) => foxShade(X, Y, s, 1));
  }
  function foxPassBody(R) {
    sdBegin();
    const S = FS, ru = R.rump, mi = R.mid, ch = R.chest, hc = R.hc;
    sdCap(fX(ru[0]), fY(ru[1]), fX(mi[0]), fY(mi[1]), ru[2] * S, mi[2] * S, 2.5 * S, 1, 0, 0.5, 0.3 * S);
    sdCap(fX(mi[0]), fY(mi[1]), fX(ch[0]), fY(ch[1]), mi[2] * S, ch[2] * S, 2.5 * S, 2, 0.5, 1, 0.25 * S);
    // the neck up into the head's ruff, and the chest's fluff
    sdCap(fX(ch[0] + 1.2), fY(ch[1] - 1.5), fX(hc[0] - 2.4), fY(hc[1] + 3.8), 4.6 * S, 3.8 * S, 2.4 * S, 4, 0, 1, 0.3 * S);
    sdBall(fX(ch[0] + 3.0), fY(ch[1] + 0.8), 3.9 * S, 2.0 * S, 3, 0.45 * S);
    for (const g of R.legs) if (g.nr) foxLeg(g);
    sdDraw((X, Y, s) => foxShade(X, Y, s, 1));
  }
  function foxPassHead(R) {
    sdBegin();
    const S = FS, F = R.F, hc = R.hc, r = R.hr;
    sdBall(fX(hc[0]), fY(hc[1]), r * S, 1.5 * S, 5);
    // the muzzle: out along the face's forward direction, a little below centre
    const m0 = hfeat(F, 0, -0.32, r * 0.42), m1 = hfeat(F, 0, -0.33, r * 1.3);
    sdCap(fX(m0[0]), fY(m0[1]), fX(m1[0]), fY(m1[1]), 3.6 * S, 1.9 * S, 1.8 * S, 6, 0, 1);
    FOXOUT.mzl = hfeat(F, 0, -0.42, r * 0.62);
    // cheek ruffs: white tufts out at the sides, low
    for (const sd of [1, -1]) {
      const c = hfeat(F, sd * 1.38, -0.52, r * 0.82);
      if (c[2] > -0.55) sdBall(fX(c[0]), fY(c[1] + 0.4), (3.5 + 0.6 * c[2]) * S, 1.6 * S, 7, 0.55 * S);
    }
    // the near ear
    const E = R.earN;
    sdCap(fX(E[0]), fY(E[1]), fX(E[2]), fY(E[3]), 4.5 * S, 0.7 * S, 1.0 * S, 8, 0, 1, 0.2 * S);
    sdDraw((X, Y, s) => foxShade(X, Y, s, 1));
  }
  function foxEars(R, p) {
    const F = R.F, r = R.hr;
    // base on the crown; tip up and out; perk lifts them, earN/earF swing them back (+) or forward
    const ear = (sd, swing) => {
      const b = hfeat(F, sd * 0.78, 0.98, r * 0.78);
      const side = b[0] - F.cx;                               // ears flare away from the middle of the head
      const a = -PI / 2 + clamp(side / r, -1, 1) * 0.42 - swing + F.tilt * 0.8 + F.fx * 0.1;
      const L = 10.6 + 1.0 * p.perk;
      return [b[0], b[1], b[0] + Math.cos(a) * L * 0.9, b[1] + Math.sin(a) * L, b[2]];
    };
    const e1 = ear(1, p.earN), e2 = ear(-1, p.earF);
    // whichever base is nearer the camera is the near ear
    if (e1[4] >= e2[4]) { R.earN = e1; R.earF = e2; p.earSide = 1; } else { R.earN = e2; R.earF = e1; p.earSide = -1; }
  }
  // eyes, nose, mouth and whiskers, drawn over the head
  function foxFace(R, p) {
    const S = FS, F = R.F, r = R.hr;
    const L = FLT;
    // eyes
    for (const sd of [1, -1]) {
      const e = hfeat(F, sd * 0.56, 0.16, r * 0.98);
      if (e[2] < 0.3) continue;
      const vis = clamp((e[2] - 0.3) / 0.3, 0, 1);
      const ex = fX(e[0]), ey = fY(e[1]);
      if (sd === 1 || e[2] > 0) { FOXOUT.eye = [ex, ey]; }
      const rh = (2.25 + 0.45 * p.wide) * S, rw = rh * (0.42 + 0.5 * e[2]) * (0.75 + 0.25 * vis);
      const open = clamp(p.eyes, 0, 1), happy = p.happy;
      const x0 = fl(ex - rw - 2), x1 = Math.ceil(ex + rw + 2), y0 = fl(ey - rh - 2), y1 = Math.ceil(ey + rh + 2);
      const lidY = ey - rh + (1 - open) * 2 * rh;            // the upper lid comes down to here
      const lw = Math.max(0.6, 0.38 * S);
      for (let Y = Math.max(ROW0, y0); Y <= Math.min(ROW1, y1); Y++) for (let X = Math.max(0, x0); X <= Math.min(W - 1, x1); X++) {
        const u = (X + 0.5 - ex) / rw, v = (Y + 0.5 - ey) / rh, d = u * u + v * v;
        if (p.sleep > 0.5) { // asleep: a soft downward curve of lid and lashes, two pixels thick
          const av = v + 0.05, ad = Math.sqrt(u * u * 0.8 + av * av * 1.8);
          if (Math.abs(ad - 0.62) < lw / rh * 1.6 && av > -0.05) BUF[Y * W + X] = ad > 0.62 ? 176 : 177;
          continue;
        }
        if (happy > 0.5) { // closed in a smile: an arch
          const av = v + 0.15, ad = Math.sqrt(u * u * 0.85 + av * av * 1.4);
          if (Math.abs(ad - 0.72) < lw / rh * 0.9 && av < 0.18) BUF[Y * W + X] = 176;
          continue;
        }
        if (open < 0.2) { if (Math.abs(v - 0.15) < lw / rh && Math.abs(u) < 0.95) BUF[Y * W + X] = 176; continue; }
        if (d > 1) continue;
        if (Y + 0.5 < lidY) continue;
        if (Y + 0.5 < lidY + lw * 1.2 && open < 0.98) { BUF[Y * W + X] = 176; continue; }
        // the eye: a dark glossy ball; a warm iris low where the lantern lights it; catchlights
        const lx = u - p.lookX * 0.18, ly = v - p.lookY * 0.16;
        let c = 195;
        if (d > 0.8 && S < 1.6) c = 195;
        else {
          const warm = clamp(LAMP.I * 0.8, 0, 1);
          if (ly > 0.2 && S >= 1.3) c = ly > 0.55 ? (warm > 0.3 ? 178 : 197) : (warm > 0.3 ? 177 : 196);
          if (lx * lx + ly * ly < 0.16 && S >= 1.8) c = 195;
        }
        // highlights: the big one up and toward the sky, a little one opposite, the lantern's spark low
        const h1x = u + 0.34 * FF * (L.sky[0] < 0 ? 1 : -1) * -1, h1y = v + 0.38;
        if (h1x * h1x + h1y * h1y < (S >= 2 ? 0.1 : 0.16)) c = 22;
        else if (S >= 1.6) {
          const h2x = u - 0.38 * FF, h2y = v - 0.34;
          if (h2x * h2x + h2y * h2y < 0.035) c = 194;
          const h3x = u + 0.05, h3y = v - 0.52;
          if (LAMP.I > 0.25 && h3x * h3x * 2 + h3y * h3y * 3 < 0.06) c = 183;
        }
        if (d > 0.82 && S >= 2) c = c === 22 ? 22 : 195;
        BUF[Y * W + X] = c;
      }
    }
    // the nose: a small glossy button at the muzzle's tip
    const nz = hfeat(F, 0, -0.27, r * 1.4);
    const nx = fX(nz[0]), ny = fY(nz[1]), nr = Math.max(0.9, 1.25 * S);
    for (let Y = fl(ny - nr - 1); Y <= Math.ceil(ny + nr + 1); Y++) for (let X = fl(nx - nr * 1.4 - 1); X <= Math.ceil(nx + nr * 1.4 + 1); X++) {
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const u = (X + 0.5 - nx) / (nr * (1.05 + 0.25 * F.fz)), v = (Y + 0.5 - ny) / nr;
      if (u * u + v * v * (v < 0 ? 1.4 : 1) > 1) continue;
      BUF[Y * W + X] = (u + 0.35 * FF) * (u + 0.35 * FF) + (v + 0.4) * (v + 0.4) < 0.16 && S >= 1.2 ? 197 : 195;
    }
    if (S >= 1.5) P(nx - FF * 0.3 * S, ny - 0.45 * S, 194);
    // the mouth: a little line back from under the nose (open around the bail when carrying, a smile when happy)
    const m0 = hfeat(F, 0, -0.5, r * 1.18), mback = hfeat(F, -0.3 * (1 - F.fz), -0.6, r * 0.95);
    if (S >= 1.1) {
      const ax = fX(m0[0]), ay = fY(m0[1]), bx = fX(mback[0]), by = fY(mback[1]) + (p.happy > 0 || p.mouth === 2 ? -0.8 * S : 0.3 * S);
      lineF(nx, ny + nr * 0.8, ax, ay, (x, y) => P(x, y, 176));
      lineF(ax, ay, bx, by, (x, y, u) => { if (u < 0.92) P(x, y, 176); });
      if (p.mouth === 2 && S >= 1.6) { // an open happy mouth: a dark crescent with a pink tongue
        const cx = (ax + bx) / 2, cy = (ay + by) / 2 + 0.9 * S;
        for (let Y = fl(cy - 1.4 * S); Y <= Math.ceil(cy + 1.4 * S); Y++) for (let X = fl(cx - 2 * S); X <= Math.ceil(cx + 2 * S); X++) {
          const u = (X + 0.5 - cx) / (1.9 * S), v = (Y + 0.5 - cy) / (1.2 * S);
          if (u * u + v * v < 1 && v > -0.3) P(X, Y, v > 0.35 && Math.abs(u) < 0.6 ? 254 : 177);
        }
      }
    }
    // whiskers (only close up): fine pale lines that catch the light
    if (S >= 2.2 && p.whisk) {
      for (let k = 0; k < 2; k++) {
        const a0 = hfeat(F, 0.22, -0.4 - k * 0.07, r * 1.18), wx = fX(a0[0]), wy = fY(a0[1]);
        const ang = (-0.25 + k * 0.22), L = (4.8 - k * 0.6) * S;
        lineF(wx, wy, wx + FF * Math.cos(ang) * L, wy + Math.sin(ang) * L + L * 0.12, (x, y, u) => { if (u > 0.3 && bay(x, y) < 0.7 - u * 0.6) P(x, y, LAMP.I > 0.4 ? 190 : 192); });
      }
    }
  }
  // set up the rig for a frame (no drawing): where its mouth, nose, head and chest land on screen
  function foxPrep(p, sx, sy, S, f, light) {
    p = foxPose(p);
    FXs = sx; FYs = sy; FS = S; FF = f; FLT = light; FP = p;
    const R = foxRig(p);
    if (p.sq) { // squash and stretch about the ground point
      const ky = 1 - p.sq * 0.42, kx = 1 + p.sq * 0.3;
      const sc = (q) => { q[0] *= kx; q[1] *= ky; };
      [R.rump, R.mid, R.chest, R.hc].forEach(sc); R.F.cx = R.hc[0]; R.F.cy = R.hc[1];
      for (const g of R.legs) { sc(g.top); sc(g.j1); if (g.j2) sc(g.j2); sc(g.paw); }
      R.tail.forEach(sc);
    }
    foxEars(R, p);
    const F = R.F, r = R.hr;
    const m0 = hfeat(F, 0, -0.5, r * 1.18), mb = hfeat(F, -0.3 * (1 - F.fz), -0.6, r * 0.95);
    FOXOUT.mouth = [fX(lerp(m0[0], mb[0], 0.45)), fY(lerp(m0[1], mb[1], 0.45) + 0.5)];
    const nz = hfeat(F, 0, -0.27, r * 1.4); FOXOUT.nose = [fX(nz[0]), fY(nz[1])];
    FOXOUT.head = [fX(R.hc[0]), fY(R.hc[1])]; FOXOUT.chest = [fX(R.chest[0]), fY(R.chest[1])];
    FOXOUT.top = fY(Math.min(R.earN[3], R.earF[3])); FOXOUT.p = p; FOXOUT.R = R;
    return FOXOUT;
  }
  function drawFox(p, sx, sy, S, f, light) {
    foxPrep(p, sx, sy, S, f, light);
    p = FP; const R = FOXOUT.R;
    TAILK = 1 - 0.18 * clamp(p.curl, 0, 1);
    foxPassFar(R);
    if (p.curl < 0.5) foxPassTail(R);
    foxPassBody(R);
    if (p.preHead) p.preHead();
    foxPassHead(R);
    foxFace(R, p);
    if (p.curl >= 0.5) foxPassTail(R);                           // curled: the tail round the front, its tip over the nose
    return FOXOUT;
  }
