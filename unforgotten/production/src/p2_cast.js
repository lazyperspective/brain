  /* ================================================================ the cast: chibi sprites built from parts every frame */
  // local sprite space: feet on y = 60, body centre x = 30, facing right; the canvas is offset so weapons fit
  const SW = 128, SH = 120, SOX = 44, SOY = 40;
  const SPR = new Uint8Array(SW * SH), SPK = new Uint8Array(SW * SH);   // colour + 1; kind: 1 body, 2 prop, 3 glow (no outline), 4 outline
  const SBB = [0, 0, 0, 0];
  function sp(x, y, c, k) {
    const X = Math.round(x) + SOX, Y = Math.round(y) + SOY;
    if (X < 0 || Y < 0 || X >= SW || Y >= SH) return;
    const i = Y * SW + X; SPR[i] = c + 1; SPK[i] = k || 1;
    if (X < SBB[0]) SBB[0] = X; if (Y < SBB[1]) SBB[1] = Y; if (X > SBB[2]) SBB[2] = X; if (Y > SBB[3]) SBB[3] = Y;
  }
  function sRect(x0, y0, x1, y1, c, k) { for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) sp(x, y, c, k); }
  function sEll(cx, cy, rx, ry, c, k, keep) { for (let y = fl(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = fl(cx - rx) - 1; x <= cx + rx + 1; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && (!keep || keep(x, y))) sp(x, y, c, k); }
  function sLine(x0, y0, x1, y1, c, w, k) { w = w || 1; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)); for (let i = 0; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; for (let j = 0; j < w; j++) for (let q = 0; q < w; q++) sp(x + q - (w - 1) / 2, y + j - (w - 1) / 2, c, k); } }
  function sPoly(pts, c, k) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = fl(y0); y <= Math.ceil(y1); y++) {
      const xs = []; const yy = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > yy) !== (b[1] > yy)) xs.push(a[0] + (yy - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b); for (let q = 0; q + 1 < xs.length; q += 2) for (let x = Math.round(xs[q]); x < Math.round(xs[q + 1]); x++) sp(x, y, c, k);
    }
  }
  // a blade from a hand at an angle: L long, w half-width; edge/core colours, an optional glow line
  function sBlade(hx, hy, ang, L, w, edge, core, guard, grip, glowC) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    if (grip !== undefined) sLine(hx - ca * 3.5, hy - sa * 3.5, hx + ca, hy + sa, grip, 2, 2);
    if (guard !== undefined) sLine(hx + ca * 2 - sa * 3, hy + sa * 2 + ca * 3, hx + ca * 2 + sa * 3, hy + sa * 2 - ca * 3, guard, 2, 2);
    for (let u = 3; u < 3 + L; u += 0.5) {
      const ww = u > L - 2 ? Math.max(0.3, w * (3 + L - u) / 5) : w;
      for (let k = -ww; k <= ww; k += 0.5) sp(hx + ca * u - sa * k, hy + sa * u + ca * k, k <= -ww + 0.5 ? edge : core, 2);
    }
    if (glowC !== undefined) for (let u = 5; u < 2 + L; u += 3) sp(hx + ca * u, hy + sa * u, glowC, 2);
  }
  function clearSprite() { SPR.fill(0); SPK.fill(0); SBB[0] = SW; SBB[1] = SH; SBB[2] = -1; SBB[3] = -1; }
  // outline every shape in the darkest shade of its own colour (coloured, selective outlines)
  const OUTS = new Uint8Array(SW * SH);
  function outlineSprite(inkC) {
    OUTS.set(SPR);
    const x0 = Math.max(1, SBB[0] - 1), x1 = Math.min(SW - 2, SBB[2] + 1), y0 = Math.max(1, SBB[1] - 1), y1 = Math.min(SH - 2, SBB[3] + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * SW + x; if (OUTS[i]) continue;
      let src = 0;
      for (const j of [i - 1, i + 1, i - SW, i + SW]) if (OUTS[j] && SPK[j] !== 3 && SPK[j] !== 4) { src = OUTS[j]; break; }
      if (src) { SPR[i] = (inkC !== undefined ? inkC : ((src - 1) & ~7)) + 1; SPK[i] = 4; }
    }
    SBB[0]--; SBB[1]--; SBB[2]++; SBB[3]++;
  }

  // ---------------------------------------------------------------- shared anatomy
  const SKIN = { l: C('skin', 6), m: C('skin', 5), d: C('skin', 4), dd: C('skin', 3) };
  // eyes and mouth on the right side of the face (the side the character faces)
  function face(o, hx, P) {
    const ey = 30, e = o.eyes || 'open', ec = P.eye, look = Math.round(o.look || 0);
    const ex0 = hx + 2 + look, ex1 = hx + 7 + look;
    const br = o.brows || 'n', bc = P.brow;
    for (const [ex, side] of [[ex0, 0], [ex1, 1]]) {
      if (e === 'closed') { sRect(ex - (side ? 0 : 1), ey + 1, ex + 1, ey + 1, ec); }
      else if (e === 'half') { sRect(ex, ey, ex + 1, ey + 1, ec); sRect(ex - 1, ey - 1, ex + 1, ey - 1, P.lid || SKIN.d); }
      else if (e === 'wide') { sRect(ex - 1, ey - 2, ex + 1, ey + 2, ec); sp(ex - 1, ey - 2, WHITE); sp(ex, ey - 2, WHITE); }
      else if (e === 'narrow') { sRect(ex - 1, ey + 1, ex + 1, ey + 1, ec); sRect(ex - 1, ey, ex + 1, ey, ec); }
      else if (e === 'glow') { sRect(ex - 1, ey - 1, ex + 1, ey + 2, P.glow || C('gold', 6), 3); sRect(ex, ey, ex, ey + 1, WHITE, 3); }
      else if (e === 'sad') { sRect(ex, ey, ex + 1, ey + 2, ec); sp(ex + (side ? 0 : 1), ey, WHITE); }
      else { sRect(ex, ey - 1, ex + 1, ey + 2, ec); sp(ex, ey - 1, WHITE); }
      // brows
      if (br === 'angry') { sp(ex - 1 + side * 2, ey - 3, bc); sp(ex + side * 0, ey - 3 + (side ? 0 : 0), bc); sp(ex + (side ? -1 : 2), ey - 2, bc); }
      else if (br === 'worried') { sp(ex + (side ? 0 : -1), ey - 4, bc); sp(ex + (side ? 1 : 0), ey - 4, bc); sp(ex + (side ? -1 : 1), ey - 3, bc); }
      else if (br === 'up') { sRect(ex - 1, ey - 5, ex + 1, ey - 5, bc); }
      else if (br !== 'none') sRect(ex - 1, ey - 4, ex + 1, ey - 4, bc);
    }
    if (o.tear) { const ty = ey + 3 + ((T_NOW * 9) % 5); sp(ex0 - 1, ty, C('hush', 5), 3); sp(ex0 - 1, ty + 1, C('hush', 3), 3); }
    if (o.blush) { sRect(hx + 1, ey + 4, hx + 2, ey + 4, C('rose', 5)); sRect(hx + 8, ey + 4, hx + 9, ey + 4, C('rose', 5)); }
    // mouth: openness 0..1 from the lip-sync, smile -1..1
    const m = o.mouth || 0, mx = hx + 5 + look * 0.5, my = ey + 5, sm = o.smile || 0;
    if (m < 0.15) {
      if (sm > 0.3) { sp(mx - 1, my, P.mouth); sp(mx, my + 1, P.mouth); sp(mx + 1, my + 1, P.mouth); sp(mx + 2, my, P.mouth); }
      else if (sm < -0.3) { sp(mx - 1, my + 1, P.mouth); sp(mx, my, P.mouth); sp(mx + 1, my, P.mouth); sp(mx + 2, my + 1, P.mouth); }
      else sRect(mx, my, mx + 1, my, P.mouth);
    } else {
      const h = m < 0.45 ? 1 : m < 0.8 ? 2 : 3, w = m < 0.45 ? 2 : m < 0.8 ? 3 : 4;
      sRect(mx - (w > 2 ? 1 : 0), my, mx - (w > 2 ? 1 : 0) + w - 1, my + h, P.mouth);
      if (h >= 2) sRect(mx - (w > 2 ? 1 : 0) + 1, my + h, mx - (w > 2 ? 1 : 0) + w - 2, my + h, C('crimson', 4));
    }
  }
  // the standard chibi body; P is the character's look, o the pose of this frame
  function body(o, P) {
    const lean = o.lean || 0, cr = o.crouch || 0, hx = 30 + lean, hy = 30 + cr * 4 + (o.bob || 0);
    const ty = 39 + cr * 4 + (o.bob || 0), tx = 23 + lean * 0.5;
    // legs
    const legs = () => {
      let a = o.stride || 0, b = -(o.stride || 0), la = 0, lb = 0;
      if (o.run !== undefined) { const s = Math.sin(o.run); a = s * 1.4; b = -s * 1.4; la = Math.max(0, -s) * 3; lb = Math.max(0, s) * 3; }
      if (o.air) { la = 3; lb = 4; a = -1; b = 1.2; }
      const leg = (x, sx, lift, c, cb) => { const top = ty + 14, bot = 60 - lift; sRect(x + sx * 2, top, x + 3 + sx * 2, bot, c); sRect(x + sx * 4 - 1 + (P.bootOut ? 0 : 0), bot - 1, x + sx * 4 + 4, bot, cb); };
      if (P.robe) { // robes hide the legs: a flared skirt, with feet peeking
        const sw = (o.run !== undefined ? Math.sin(o.run) * 2 : 0);
        sPoly([[tx - 1, ty + 9], [tx + 15, ty + 9], [tx + 18 + sw, 59], [tx - 4 + sw, 59]], P.robe);
        sRect(tx - 3 + sw, 57, tx + 17 + sw, 58, P.robeD);
        sRect(tx + 1 + a * 2, 59, tx + 5 + a * 2, 60, P.boot); sRect(tx + 10 + b * 2, 59, tx + 14 + b * 2, 60, P.bootD);
        return;
      }
      if (o.kneel) {   // the back shin flat on the ground, the front knee up
        sRect(tx - 7, 57, tx + 5, 60, P.legD); sRect(tx - 8, 58, tx - 5, 60, P.bootD);
        sRect(tx + 6, ty + 12, tx + 16, ty + 15, P.leg); sRect(tx + 13, ty + 12, tx + 16, 60, P.leg); sRect(tx + 12, 59, tx + 19, 60, P.boot);
        return;
      }
      leg(25 + lean * 0.3, b, lb, P.legD, P.bootD); leg(31 + lean * 0.3, a, la, P.leg, P.boot);
    };
    // back arm
    const armB = o.armB === undefined ? 1.9 : o.armB;
    const sbx = tx + 2, sby = ty + 3;
    if (P.backHair) P.backHair(o, hx, hy);
    sLine(sbx, sby, sbx + Math.cos(armB) * 7, sby + Math.sin(armB) * 7, P.armD, 3);
    if (P.backProp) P.backProp(o, sbx + Math.cos(armB) * 8, sby + Math.sin(armB) * 8);
    legs();
    // torso
    sPoly([[tx, ty], [tx + 14, ty], [tx + 15, ty + 15], [tx - 1, ty + 15]], P.cloth);
    sRect(tx, ty, tx + 14, ty, P.clothL);
    P.torso && P.torso(o, tx, ty);
    // head
    sEll(hx, hy, 10, 9.5, P.skin || SKIN.m);
    sRect(hx - 8, hy + 6, hx + 8, hy + 7, P.skinD || SKIN.d);
    if (P.cap) for (let y = hy - 11; y <= hy + 8; y++) for (let x = hx - 11; x <= hx + 11; x++) if (((x + 0.5 - hx) / 10) ** 2 + ((y + 0.5 - hy) / 9.5) ** 2 <= 1 && (y <= hy - 8 || x <= hx - 3 + (y - hy + 8) * 0.25)) sp(x, y, P.cap);
    face(o, hx, P);
    P.front && P.front(o, hx, hy);
    // front arm and whatever it holds
    const armF = o.armF === undefined ? 1.2 : o.armF, reach = 7 + (o.reach || 0);
    const sfx = tx + 12, sfy = ty + 3, hxp = sfx + Math.cos(armF) * reach, hyp = sfy + Math.sin(armF) * reach;
    sLine(sfx, sfy, hxp, hyp, P.arm, 3);
    sRect(hxp - 1, hyp - 1, hxp + 1, hyp + 1, P.skin || SKIN.m);
    if (P.prop) P.prop(o, hxp, hyp);
    return { hand: [hxp, hyp], head: [hx, hy], chest: [tx + 8, ty + 6] };
  }

  // the same body seen from the front or from behind (view: 'front' | 'back')
  function bodyFB(o, P, view) {
    const cr = o.crouch || 0, bob = o.bob || 0, hx = 30 + (o.lean || 0) * 0.3, hy = 30 + cr * 4 + bob, ty = 39 + cr * 4 + bob, tx = 22;
    const back = view === 'back';
    // legs
    const ls = o.run !== undefined ? Math.sin(o.run) : 0;
    if (P.robe) { sPoly([[tx + 1, ty + 9], [tx + 15, ty + 9], [tx + 18, 59], [tx - 2, 59]], P.robe); sRect(tx - 2, 57, tx + 18, 58, P.robeD); }
    else { sRect(25, ty + 14, 28, 60 - Math.max(0, ls) * 3, P.legD); sRect(32, ty + 14, 35, 60 - Math.max(0, -ls) * 3, P.leg); sRect(24, 59 - Math.max(0, ls) * 3, 29, 60 - Math.max(0, ls) * 3, P.bootD); sRect(31, 59 - Math.max(0, -ls) * 3, 36, 60 - Math.max(0, -ls) * 3, P.boot); }
    if (back && P.backB) P.backB(o, hx, hy);
    // arms (screen-left and screen-right)
    const aL = o.armL === undefined ? 1.9 : o.armL, aR = o.armF === undefined ? 1.25 : o.armF, rr = 7 + (o.reach || 0);
    const sl = [tx + 1, ty + 3], sr = [tx + 15, ty + 3], hl = [sl[0] + Math.cos(aL) * 7, sl[1] + Math.sin(aL) * 7], hr = [sr[0] + Math.cos(aR) * rr, sr[1] + Math.sin(aR) * rr];
    sLine(sl[0], sl[1], hl[0], hl[1], P.armD, 3); sLine(sr[0], sr[1], hr[0], hr[1], P.arm, 3);
    // torso
    sPoly([[tx, ty], [tx + 16, ty], [tx + 17, ty + 15], [tx - 1, ty + 15]], back ? P.clothD || P.cloth : P.cloth);
    sRect(tx, ty, tx + 16, ty, P.clothL);
    if (P.torsoFB) P.torsoFB(o, tx, ty, back);
    // head
    if (!back && P.behindF) P.behindF(o, hx, hy);
    sEll(hx, hy, 10.5, 9.5, P.skin || SKIN.m);
    if (back) { sEll(hx, hy, 10.5, 9.5, P.hairC); if (P.backH) P.backH(o, hx, hy); }
    else {
      sRect(hx - 8, hy + 6, hx + 8, hy + 7, P.skinD || SKIN.d);
      faceF(o, hx, P);
      if (P.frontH) P.frontH(o, hx, hy);
    }
    sRect(hl[0] - 1, hl[1] - 1, hl[0] + 1, hl[1] + 1, P.skin || SKIN.m); sRect(hr[0] - 1, hr[1] - 1, hr[0] + 1, hr[1] + 1, P.skin || SKIN.m);
    if (P.prop) P.prop(o, hr[0], hr[1]);
    return { hand: hr, head: [hx, hy], chest: [tx + 8, ty + 6] };
  }
  // a symmetric face, looking out of the screen
  function faceF(o, hx, P) {
    const ey = 30 + (o.crouch || 0) * 4 + (o.bob || 0), e = o.eyes || 'open', ec = P.eye, lk = Math.round(o.look || 0), br = o.brows || 'n', bc = P.brow;
    for (const [ex, side] of [[hx - 5 + lk, 0], [hx + 3 + lk, 1]]) {
      if (e === 'closed') sRect(ex, ey + 1, ex + 1, ey + 1, ec);
      else if (e === 'half') { sRect(ex, ey, ex + 1, ey + 1, ec); }
      else if (e === 'wide') { sRect(ex - 1, ey - 2, ex + 2, ey + 2, ec); sp(ex, ey - 2, WHITE); sp(ex - 1, ey - 2, WHITE); }
      else if (e === 'narrow') sRect(ex - 1, ey + 1, ex + 2, ey + 1, ec);
      else if (e === 'glow') { sRect(ex - 1, ey - 1, ex + 2, ey + 2, P.glow || C('gold', 6), 3); sRect(ex, ey, ex + 1, ey + 1, WHITE, 3); }
      else { sRect(ex, ey - 1, ex + 1, ey + 2, ec); sp(ex + (side ? 0 : 1), ey - 1, WHITE); }
      if (br === 'angry') { sp(ex + (side ? 0 : 1), ey - 3, bc); sp(ex + (side ? 1 : 0), ey - 4, bc); sp(ex + (side ? -1 : 2), ey - 3, bc); }
      else if (br === 'worried') { sp(ex + (side ? 1 : 0), ey - 3, bc); sp(ex + (side ? 0 : 1), ey - 4, bc); sp(ex + (side ? -1 : 2), ey - 4, bc); }
      else if (br === 'up') sRect(ex - 1, ey - 5, ex + 2, ey - 5, bc);
      else if (br !== 'none') sRect(ex - 1, ey - 4, ex + 2, ey - 4, bc);
    }
    if (o.tear) { const ty = ey + 3 + ((T_NOW * 9) % 5); sp(hx - 5, ty, C('hush', 5), 3); sp(hx - 5, ty + 1, C('hush', 3), 3); }
    if (o.blush) { sRect(hx - 7, ey + 4, hx - 6, ey + 4, C('rose', 5)); sRect(hx + 6, ey + 4, hx + 7, ey + 4, C('rose', 5)); }
    const m = o.mouth || 0, my = ey + 5, sm = o.smile || 0;
    if (m < 0.15) { if (sm > 0.3) { sp(hx - 2, my, P.mouth); sRect(hx - 1, my + 1, hx + 1, my + 1, P.mouth); sp(hx + 2, my, P.mouth); } else if (sm < -0.3) { sp(hx - 2, my + 1, P.mouth); sRect(hx - 1, my, hx + 1, my, P.mouth); sp(hx + 2, my + 1, P.mouth); } else sRect(hx - 1, my, hx + 1, my, P.mouth); }
    else { const h = m < 0.45 ? 1 : m < 0.8 ? 2 : 3, w = m < 0.45 ? 1 : m < 0.8 ? 2 : 3; sRect(hx - w, my, hx + w - 1 + (w === 1 ? 1 : 0), my + h, P.mouth); if (h >= 2) sRect(hx - w + 1, my + h, hx + w - 2 + (w === 1 ? 1 : 0), my + h, C('crimson', 4)); }
  }

  // ---------------------------------------------------------------- the characters
  const CAST = {};
  CAST.kaira = {
    hairC: C('stone', 7),
    behindF(o, hx, hy) { const w = o.wind || 0; for (let k = 0; k < 7; k++) { const a = -PI / 2 + (k - 3) * 0.42, L = 13 + (k % 2) * 3 + w * 0.6; sPoly([[hx + Math.cos(a - 0.2) * 8, hy - 2 + Math.sin(a - 0.2) * 8], [hx + Math.cos(a) * L, hy - 3 + Math.sin(a) * L - w * 0.4], [hx + Math.cos(a + 0.2) * 8, hy - 2 + Math.sin(a + 0.2) * 8]], k % 2 ? C('stone', 6) : C('stone', 7)); } },
    frontH(o, hx, hy) { sEll(hx, hy - 5, 10.6, 5, C('stone', 7), 1, (x, y) => y < hy - 6); for (let k = -2; k <= 2; k++) sPoly([[hx + k * 4 - 2.5, hy - 8], [hx + k * 4 + 2.5, hy - 8], [hx + k * 4 + k * 0.6, hy - 3 - (k & 1) * 2]], k & 1 ? C('stone', 6) : C('stone', 7)); sRect(hx - 10, hy - 9, hx + 10, hy - 8, C('indigo', 2)); sEll(hx, hy - 9, 2.5, 2, C('gold', 5)); sp(hx - 1, hy - 10, WHITE); },
    backH(o, hx, hy) { const w = o.wind || 0; for (let k = 0; k < 9; k++) { const a = -PI / 2 + (k - 4) * 0.36, L = 12 + (k % 3) * 2 + w * 0.7; sPoly([[hx + Math.cos(a - 0.25) * 7, hy + Math.sin(a - 0.25) * 7], [hx + Math.cos(a) * L, hy + Math.sin(a) * L * 0.9 - w * 0.5], [hx + Math.cos(a + 0.25) * 7, hy + Math.sin(a + 0.25) * 7]], k % 2 ? C('stone', 7) : C('stone', 5)); } for (let k = 0; k < 5; k++) sLine(hx - 6 + k * 3, hy - 7, hx - 7 + k * 3.4, hy + 6, C('stone', 5)); sRect(hx - 10, hy - 9, hx + 10, hy - 8, C('indigo', 2)); sRect(hx - 1, hy - 8, hx + 1, hy - 3, C('indigo', 2)); sLine(hx, hy - 3, hx - 4 - w, hy + 4, C('indigo', 2)); },
    torsoFB(o, tx, ty, back) { sRect(tx - 1, ty + 9, tx + 17, ty + 10, C('gold', 5)); if (!back) { sLine(tx + 8, ty, tx + 8, ty + 15, C('linen', 6)); sLine(tx, ty + 1, tx + 16, ty + 12, C('linen', 5)); if (o.seed) { const cx = tx + 8, cy = ty + 5; sRect(cx - 1, cy - 1, cx + 1, cy + 1, C('gold', 6), 3); if (o.seed > 0.4) { sp(cx, cy, WHITE, 3); sp(cx - 2, cy, C('gold', 5), 3); sp(cx + 2, cy, C('gold', 5), 3); } } } else { sLine(tx + 16, ty + 1, tx, ty + 12, C('linen', 5)); sRect(tx + 3, ty + 9, tx + 9, ty + 15, C('linen', 6)); sRect(tx + 3, ty + 9, tx + 9, ty + 9, C('gold', 5)); } },
    eye: C('gold', 2), brow: C('stone', 4), mouth: C('crimson', 1), glow: C('gold', 6),
    cap: C('stone', 7), cloth: C('indigo', 3), clothL: C('indigo', 5), arm: C('indigo', 3), armD: C('indigo', 2),
    leg: C('indigo', 2), legD: C('indigo', 1), boot: C('night', 2), bootD: C('night', 1),
    backHair(o, hx, hy) {
      const w = (o.wind || 0) + 3;
      for (let k = 0; k < 5; k++) sPoly([[hx - 7, hy - 8 + k * 4], [hx - 15 - w * 1.4 - k, hy - 10 + k * 5 - w * 0.3], [hx - 8, hy - 4 + k * 4]], k % 2 ? C('stone', 7) : C('stone', 6));
    },
    torso(o, tx, ty) {
      sLine(tx + 7, ty, tx + 9, ty + 15, C('linen', 6));                       // wrap
      sRect(tx - 1, ty + 9, tx + 15, ty + 10, C('gold', 5));                   // sash
      sLine(tx, ty + 1, tx + 13, ty + 11, C('linen', 5));                      // satchel strap
      sRect(tx - 4, ty + 10, tx + 1, ty + 15, C('linen', 6)); sRect(tx - 4, ty + 10, tx + 1, ty + 10, C('gold', 5));
      if (o.seed) { const s = o.seed, cx = tx + 9, cy = ty + 5; sRect(cx - 1, cy - 1, cx + 1, cy + 1, C('gold', 6), 3); if (s > 0.4) { sp(cx, cy, WHITE, 3); sp(cx - 2, cy, C('gold', 5), 3); sp(cx + 2, cy, C('gold', 5), 3); sp(cx, cy - 2, C('gold', 5), 3); sp(cx, cy + 2, C('gold', 5), 3); } }
    },
    front(o, hx, hy) {
      sPoly([[hx - 9, hy - 3], [hx - 6, hy - 11], [hx + 3, hy - 12], [hx + 9, hy - 8], [hx + 5, hy - 7], [hx + 6, hy - 4], [hx + 2, hy - 7], [hx - 2, hy - 5], [hx - 5, hy - 7]], C('stone', 7));
      sLine(hx - 3, hy - 11, hx + 4, hy - 11, WHITE);
      sRect(hx - 9, hy - 9, hx + 9, hy - 8, C('indigo', 2)); sEll(hx + 4, hy - 9, 2.5, 2, C('gold', 5));
      sLine(hx + 1, hy + 3, hx + 3, hy + 5, C('gold', 5));                     // the gold courier mark
    },
    prop(o, x, y) { if (o.blade !== undefined) sBlade(x, y, o.blade, 13, 1.1, C('indigo', 5), C('indigo', 7), C('gold', 5), C('indigo', 1), o.storm ? C('gold', 7) : undefined); },
    backProp(o, x, y) { if (o.blade2 !== undefined) sBlade(x, y, o.blade2, 11, 1.0, C('indigo', 4), C('indigo', 6), C('gold', 4), C('indigo', 1)); },
  };
  CAST.tamo = {
    hairC: C('teal', 4),
    frontH(o, hx, hy) { sEll(hx, hy - 6, 10.5, 4.5, C('teal', 4), 1, (x, y) => y < hy - 6); for (let k = -2; k <= 2; k++) sPoly([[hx + k * 4 - 2, hy - 8], [hx + k * 4 + 2, hy - 8], [hx + k * 4 + (k > 0 ? 1 : -1), hy - 3]], C('teal', 4)); sEll(hx, hy - 14, 4, 3.5, C('teal', 4)); sRect(hx - 1, hy - 12, hx + 1, hy - 10, C('gold', 5)); sRect(hx - 9, hy + 7, hx + 9, hy + 9, C('teal', 5)); sRect(hx - 6, hy + 2, hx - 5, hy + 3, C('rose', 5)); sRect(hx + 5, hy + 2, hx + 6, hy + 3, C('rose', 5)); },
    backH(o, hx, hy) { sEll(hx, hy - 14, 4, 3.5, C('teal', 4)); sRect(hx - 1, hy - 12, hx + 1, hy - 10, C('gold', 5)); sRect(hx - 9, hy + 7, hx + 9, hy + 9, C('teal', 5)); sLine(hx + 2, hy + 9, hx + 6 + (o.wind || 0), hy + 15, C('teal', 5), 2); },
    torsoFB(o, tx, ty, back) { sRect(tx - 2, ty + 1, tx + 18, ty + 15, C('linen', 5)); sRect(tx - 3, ty + 9, tx + 19, ty + 11, C('sea', 4)); sEll(back ? tx + 2 : tx + 15, ty + 2, 4.5, 3.2, C('rose', 6)); },
    eye: C('night', 1), brow: C('teal', 2), mouth: C('crimson', 1), glow: C('teal', 7),
    cap: C('teal', 4), cloth: C('linen', 5), clothL: C('linen', 7), arm: C('skin', 4), armD: C('skin', 3),
    leg: C('linen', 4), legD: C('linen', 3), boot: C('wood', 3), bootD: C('wood', 2),
    backHair(o, hx, hy) { sEll(hx - 3, hy - 14, 4, 3.5, C('teal', 4)); sRect(hx - 4, hy - 12, hx - 2, hy - 10, C('gold', 5)); },
    torso(o, tx, ty) {
      sRect(tx - 2, ty + 1, tx + 16, ty + 15, C('linen', 5)); sRect(tx - 3, ty + 9, tx + 17, ty + 11, C('sea', 4));
      sEll(tx + 12, ty + 2, 5, 3.5, C('rose', 6)); sLine(tx + 9, ty + 1, tx + 15, ty + 1, C('rose', 4)); sLine(tx + 9, ty + 3, tx + 15, ty + 3, C('rose', 4));
    },
    front(o, hx, hy) {
      for (let k = 0; k < 5; k++) sPoly([[hx - 8 + k * 4, hy - 10], [hx - 4 + k * 4, hy - 10], [hx - 6 + k * 4 + (k > 2 ? 2 : 0), hy - 4]], C('teal', 4));
      sLine(hx - 6, hy - 10, hx + 6, hy - 11, C('teal', 6));
      sRect(hx - 9, hy + 7, hx + 9, hy + 9, C('teal', 5)); sLine(hx - 8, hy + 9, hx - 14 - (o.wind || 0), hy + 14 - (o.wind || 0) * 0.5, C('teal', 5), 2);
      sRect(hx - 4, hy + 2, hx - 2, hy + 3, C('rose', 5));
    },
    prop(o, x, y) { if (o.anchor !== undefined) drawAnchor(x, y, o.anchor, o.anchorGlow); },
  };
  function drawAnchor(x, y, ang, glowA) {
    const ca = Math.cos(ang), sa = Math.sin(ang), L = 20, ex = x + ca * L, ey = y + sa * L;
    const iron = glowA ? C('teal', 6) : C('stone', 4), ironL = glowA ? C('teal', 7) : C('stone', 6), ironD = glowA ? C('teal', 4) : C('stone', 2);
    sLine(x - ca * 4, y - sa * 4, ex, ey, iron, 3, 2); sLine(x - ca * 4, y - sa * 4, ex, ey, ironL, 1, 2);
    sEll(x - ca * 6, y - sa * 6, 2.5, 2.5, iron, 2); sEll(x - ca * 6, y - sa * 6, 1, 1, ironD, 2);
    sLine(x + ca * 2 - sa * 6, y + sa * 2 + ca * 6, x + ca * 2 + sa * 6, y + sa * 2 - ca * 6, iron, 2, 2);  // stock
    for (let k = -10; k <= 10; k++) { const bx = ex + ca * (Math.abs(k) * 0.25) * -1 - sa * k, by = ey + sa * (Math.abs(k) * 0.25) * -1 + ca * k; sp(bx, by, iron, 2); sp(bx + ca, by + sa, iron, 2); sp(bx - ca, by - sa, ironD, 2); }
    for (const s of [-1, 1]) { const fx = ex - sa * 10 * s - ca * 2.5, fy = ey + ca * 10 * s - sa * 2.5; sPoly([[fx, fy], [fx - ca * 5 + sa * 2 * s, fy - sa * 5 - ca * 2 * s], [fx + sa * 3 * s, fy - ca * 3 * s]], ironL, 2); }
  }
  CAST.sable = {
    hairC: C('char', 1),
    frontH(o, hx, hy) { sEll(hx, hy - 4, 11, 7, C('char', 1), 1, (x, y) => y < hy - 5 || Math.abs(x - hx) > 8.5); sPoly([[hx - 1, hy - 10], [hx - 9, hy - 6], [hx - 10, hy + 2], [hx - 7, hy - 3]], C('char', 1)); sPoly([[hx + 1, hy - 10], [hx + 9, hy - 6], [hx + 10, hy + 2], [hx + 7, hy - 3]], C('char', 1)); sRect(hx + 7, hy - 13, hx + 10, hy - 11, C('crimson', 5)); if (o.mask) { sPoly([[hx, hy - 7], [hx + 8, hy - 6], [hx + 9, hy + 6], [hx + 1, hy + 7]], C('hush', 6)); sLine(hx + 4, hy - 6, hx + 6, hy - 1, C('night', 1)); sLine(hx + 6, hy - 1, hx + 4, hy + 4, C('night', 1)); } },
    backH(o, hx, hy) { const sw = (o.wind || 0); sPoly([[hx - 3, hy - 9], [hx + 3, hy - 9], [hx + 4 + sw, hy + 22], [hx - 4 + sw * 1.2, hy + 24]], C('char', 1)); sLine(hx, hy - 6, hx + sw * 0.8, hy + 20, C('char', 3)); sRect(hx - 3, hy - 11, hx + 3, hy - 9, C('crimson', 5)); },
    torsoFB(o, tx, ty, back) { if (!back) { sLine(tx + 4, ty, tx + 8, ty + 8, C('linen', 6)); sLine(tx + 12, ty, tx + 8, ty + 8, C('linen', 6)); } sRect(tx - 1, ty + 9, tx + 17, ty + 11, C('crimson', 4)); },
    eye: C('night', 1), brow: C('char', 1), mouth: C('crimson', 2), glow: C('ember', 6),
    cap: C('char', 1), cloth: C('char', 3), clothL: C('char', 5), arm: C('char', 3), armD: C('char', 2),
    leg: C('char', 2), legD: C('char', 1), boot: C('char', 1), bootD: C('night', 1),
    backHair(o, hx, hy) {
      sEll(hx - 1, hy - 3, 11, 10, C('char', 1));
      const sw = (o.wind || 0);
      sPoly([[hx - 6, hy - 11], [hx - 14 - sw, hy - 12], [hx - 22 - sw * 1.5, hy - 6], [hx - 25 - sw * 1.8, hy + 3], [hx - 20 - sw * 1.4, hy], [hx - 15 - sw, hy - 5], [hx - 8, hy - 5]], C('char', 1));
      sLine(hx - 14 - sw, hy - 10, hx - 22 - sw * 1.5, hy - 4, C('char', 3));
      if (o.embers) for (let k = 0; k < 3; k++) sp(hx - 24 - sw * 1.8 + k, hy + 2 - k, C('ember', 6), 3);
      sRect(hx - 8, hy - 12, hx - 5, hy - 10, C('crimson', 5));
    },
    torso(o, tx, ty) { sLine(tx + 6, ty, tx + 10, ty + 8, C('linen', 6)); sLine(tx + 10, ty + 8, tx + 8, ty + 15, C('char', 5)); sRect(tx - 1, ty + 9, tx + 15, ty + 11, C('crimson', 4)); sLine(tx - 1, ty + 11, tx - 5, ty + 18, C('crimson', 4), 2); },
    front(o, hx, hy) {
      sPoly([[hx - 9, hy - 4], [hx - 7, hy - 10], [hx + 2, hy - 11], [hx + 8, hy - 9], [hx + 4, hy - 6], [hx + 1, hy - 7], [hx - 3, hy - 4], [hx - 6, hy - 6]], C('char', 1));
      sLine(hx - 4, hy - 9, hx + 3, hy - 10, C('char', 3));
      if (o.mask) { sPoly([[hx + 5, hy - 8], [hx + 10, hy - 6], [hx + 10, hy + 6], [hx + 6, hy + 7], [hx + 5, hy + 1]], C('hush', 6)); sLine(hx + 7, hy - 7, hx + 9, hy - 2, C('night', 1)); sLine(hx + 9, hy - 2, hx + 7, hy + 3, C('night', 1)); sRect(hx + 7, hy - 1, hx + 8, hy, o.embers ? C('ember', 6) : C('night', 1)); }
    },
    prop(o, x, y) { if (o.sword !== undefined) sBlade(x, y, o.sword, 25, 1.3, o.embers ? C('ember', 5) : C('stone', 5), o.embers ? C('ember', 7) : C('stone', 7), C('gold', 5), C('crimson', 2), o.embers ? C('gold', 7) : undefined); },
  };
  CAST.mira = {
    hairC: C('gold', 5),
    frontH(o, hx, hy) { sPoly([[hx - 7, hy - 4], [hx - 4, hy - 8], [hx + 4, hy - 8], [hx + 7, hy - 4], [hx + 3, hy - 6], [hx - 3, hy - 6]], C('wood', 2)); sPoly([[hx - 12, hy + 4], [hx - 11, hy - 6], [hx - 5, hy - 12], [hx + 5, hy - 12], [hx + 11, hy - 6], [hx + 12, hy + 4], [hx + 9, hy + 4], [hx + 9, hy - 5], [hx + 4, hy - 9], [hx - 4, hy - 9], [hx - 9, hy - 5], [hx - 9, hy + 4]], C('gold', 5)); sLine(hx - 4, hy - 11, hx + 4, hy - 11, C('gold', 7)); },
    backH(o, hx, hy) { sEll(hx, hy, 12, 11, C('gold', 5)); sLine(hx, hy - 10, hx, hy + 9, C('gold', 4)); },
    torsoFB(o, tx, ty, back) { if (!back) { sRect(tx + 7, ty + 1, tx + 8, ty + 14, C('gold', 4)); for (let k = 0; k < 3; k++) sp(tx + 10, ty + 3 + k * 4, C('linen', 7)); } },
    eye: C('night', 1), brow: C('wood', 2), mouth: C('crimson', 2),
    cap: null, cloth: C('gold', 5), clothL: C('gold', 6), arm: C('gold', 5), armD: C('gold', 4),
    leg: C('crimson', 4), legD: C('crimson', 3), boot: C('crimson', 4), bootD: C('crimson', 3),
    backHair(o, hx, hy) { sEll(hx - 1, hy - 1, 11.5, 11, C('gold', 5)); },        // the hood
    torso(o, tx, ty) { sRect(tx + 6, ty + 1, tx + 7, ty + 14, C('gold', 4)); for (let k = 0; k < 3; k++) sp(tx + 9, ty + 3 + k * 4, C('linen', 7)); },
    front(o, hx, hy) {
      sPoly([[hx - 8, hy - 3], [hx - 6, hy - 9], [hx + 3, hy - 10], [hx + 8, hy - 7], [hx + 3, hy - 6], [hx - 1, hy - 4]], C('wood', 2));
      sPoly([[hx - 11, hy + 3], [hx - 11, hy - 6], [hx - 5, hy - 11], [hx + 5, hy - 11], [hx + 11, hy - 6], [hx + 10, hy - 4], [hx + 4, hy - 9], [hx - 4, hy - 9], [hx - 9, hy - 4]], C('gold', 5));
      sLine(hx - 4, hy - 10, hx + 4, hy - 10, C('gold', 7));
    },
    prop(o, x, y) { if (o.lantern) { sLine(x, y, x, y + 3, C('wood', 2)); sRect(x - 2, y + 3, x + 2, y + 8, C('ember', 6), 3); sRect(x - 1, y + 4, x + 1, y + 7, C('gold', 7), 3); } if (o.chalk) sRect(x, y - 1, x + 1, y, WHITE, 2); },
  };
  CAST.warden = {
    hairC: C('linen', 6),
    frontH(o, hx, hy) { sPoly([[hx - 12, hy + 6], [hx - 10, hy - 10], [hx, hy - 19 - (o.captain ? 6 : 0)], [hx + 10, hy - 10], [hx + 12, hy + 6], [hx + 9, hy + 6], [hx + 8, hy - 7], [hx - 8, hy - 7], [hx - 9, hy + 6]], C('linen', 6)); sEll(hx, hy + 1, 8, 7.5, C('linen', 7)); sRect(hx - 7, hy - 1, hx + 7, hy + 1, C('night', 1)); sRect(hx - 5, hy - 1, hx - 4, hy, o.captain ? C('gold', 6) : C('indigo', 6)); sRect(hx + 3, hy - 1, hx + 4, hy, o.captain ? C('gold', 6) : C('indigo', 6)); if (o.captain) sLine(hx, hy - 24, hx, hy - 14, C('gold', 6), 2); },
    backH(o, hx, hy) { sPoly([[hx - 12, hy + 7], [hx - 10, hy - 10], [hx, hy - 19 - (o.captain ? 6 : 0)], [hx + 10, hy - 10], [hx + 12, hy + 7]], C('linen', 6)); },
    torsoFB(o, tx, ty, back) { sRect(tx - 1, ty + 8, tx + 17, ty + 10, o.captain ? C('gold', 5) : C('indigo', 4)); },
    eye: C('night', 0), brow: 'none', mouth: C('linen', 4),
    cap: null, cloth: C('linen', 6), clothL: C('linen', 7), arm: C('linen', 6), armD: C('linen', 4),
    robe: C('linen', 6), robeD: C('linen', 4), boot: C('indigo', 2), bootD: C('indigo', 1),
    backHair(o, hx, hy) { sPoly([[hx - 12, hy + 6], [hx - 9, hy - 11], [hx + 1, hy - 18 - (o.captain ? 6 : 0)], [hx + 10, hy - 10], [hx + 11, hy + 6]], C('linen', 6)); if (o.captain) sLine(hx + 1, hy - 23, hx + 1, hy - 14, C('gold', 6), 2); },
    torso(o, tx, ty) { sRect(tx - 1, ty + 8, tx + 15, ty + 10, o.captain ? C('gold', 5) : C('indigo', 4)); sLine(tx + 7, ty, tx + 7, ty + 15, C('linen', 4)); },
    front(o, hx, hy) {
      // a veil over the whole face, with a dark slit for the eyes
      sEll(hx + 1, hy + 1, 9, 8.5, C('linen', 7)); sRect(hx + 1, hy - 1, hx + 9, hy + 1, C('night', 1));
      sRect(hx + 3, hy - 1, hx + 4, hy, o.captain ? C('gold', 6) : C('indigo', 6)); sRect(hx + 7, hy - 1, hx + 8, hy, o.captain ? C('gold', 6) : C('indigo', 6));
      sLine(hx - 7, hy + 4, hx + 8, hy + 6, C('linen', 5));
    },
    prop(o, x, y) { if (o.spear !== undefined) { const a = o.spear, ca = Math.cos(a), sa = Math.sin(a); sLine(x - ca * 12, y - sa * 12, x + ca * 22, y + sa * 22, C('wood', 4), 2, 2); sBlade(x + ca * 19, y + sa * 19, a, 7, 1.4, C('stone', 5), C('stone', 7)); for (let k = 0; k < 5; k++) sp(x - ca * (10 + k * 2) + Math.sin(k + T_NOW * 9) * 1.5, y - sa * (10 + k * 2) + 3, C('stone', 6), 2); } },
  };
  CAST.docker = {
    hairC: C('stone', 5),
    frontH(o, hx, hy) { sPoly([[hx - 11, hy - 4], [hx - 9, hy - 11], [hx + 9, hy - 11], [hx + 11, hy - 4]], C('wood', 3)); sRect(hx - 12, hy - 5, hx + 12, hy - 4, C('wood', 2)); sPoly([[hx - 6, hy + 3], [hx + 6, hy + 3], [hx + 4, hy + 11], [hx - 4, hy + 11]], C('stone', 6)); },
    eye: C('night', 1), brow: C('stone', 6), mouth: C('crimson', 1),
    cap: null, cloth: C('linen', 4), clothL: C('linen', 6), arm: C('skin', 3), armD: C('skin', 2),
    leg: C('wood', 3), legD: C('wood', 2), boot: C('wood', 1), bootD: C('wood', 1),
    torso(o, tx, ty) { sRect(tx - 2, ty, tx + 16, ty + 15, C('linen', 4)); sRect(tx + 1, ty + 4, tx + 13, ty + 15, C('wood', 4)); },
    front(o, hx, hy) { sPoly([[hx - 10, hy - 3], [hx - 9, hy - 10], [hx + 4, hy - 11], [hx + 11, hy - 7], [hx + 11, hy - 5], [hx - 10, hy - 4]], C('wood', 3)); sRect(hx + 9, hy - 7, hx + 13, hy - 5, C('wood', 3)); sPoly([[hx - 2, hy + 3], [hx + 10, hy + 3], [hx + 8, hy + 10], [hx + 2, hy + 10]], C('stone', 6)); },
  };
  CAST.hollow = {
    hairC: C('char', 0),
    frontH(o, hx, hy) { for (let k = 0; k < 7; k++) { const x = hx - 9 + k * 3; sLine(x, hy - 9, x + (ih(k, 3, 701) - 0.5) * 4, hy - 14 - ih(k, 4, 701) * 5, C('char', 0)); } },
    backH(o, hx, hy) { for (let k = 0; k < 7; k++) { const x = hx - 9 + k * 3; sLine(x, hy - 9, x + (ih(k, 3, 701) - 0.5) * 4, hy - 14 - ih(k, 4, 701) * 5, C('char', 0)); } },
    eye: WHITE, brow: 'none', mouth: C('char', 0), skin: C('char', 1), skinD: C('char', 0),
    cap: C('char', 0), cloth: C('char', 1), clothL: C('char', 2), arm: C('char', 1), armD: C('char', 0),
    leg: C('char', 1), legD: C('char', 0), boot: C('char', 0), bootD: C('char', 0),
    front(o, hx, hy) {
      for (let k = 0; k < 7; k++) { const x = hx - 9 + k * 3; sLine(x, hy - 9, x + (ih(k, 3, 701) - 0.5) * 4, hy - 14 - ih(k, 4, 701) * 5, C('char', 0)); }
      for (let k = 0; k < 6; k++) sp(hx - 8 + fl(ih(k, 1, 702) * 18), hy - 6 + fl(ih(k, 2, 702) * 14), C('crimson', 5));
    },
  };

  // the Bellwether: a tall robed lord with a cracked bronze bell for a head
  function drawBellwether(o) {
    const sw = o.sway || 0, ring = o.ring || 0, rob = C('violet', 2), robD = C('violet', 1), robL = C('violet', 3);
    sPoly([[18, 4], [42, 4], [52 + sw, 60], [8 + sw, 60]], rob);
    for (let k = 0; k < 6; k++) sLine(20 + k * 4, 6, 14 + k * 7 + sw, 59, k & 1 ? robD : robL);
    sRect(6 + sw, 58, 54 + sw, 60, robD);
    // long arms with grey hands
    const aa = o.arms === undefined ? 1.3 : o.arms;
    for (const s of [-1, 1]) { const sx = s < 0 ? 18 : 42, ex = sx + Math.cos(s < 0 ? PI - aa : aa) * 26, ey = 8 + Math.sin(aa) * 26; sLine(sx, 8, ex, ey, rob, 4); for (let f = -1; f <= 1; f++) sLine(ex, ey, ex + f * 3 + s * 2, ey + 6, C('stone', 5), 1); }
    // the bell
    const bx = 30, by = -8 + (ring ? Math.sin(T_NOW * 60) * ring : 0);
    sPoly([[bx - 8, by - 12], [bx + 8, by - 12], [bx + 14, by + 8], [bx - 14, by + 8]], C('gold', 3));
    sEll(bx, by - 12, 8, 4, C('gold', 4)); sRect(bx - 1, by - 19, bx + 1, by - 15, C('gold', 2));
    sRect(bx - 15, by + 7, bx + 15, by + 9, C('gold', 2));
    for (let k = 0; k < 4; k++) sLine(bx - 6 + k * 4, by - 10, bx - 9 + k * 6, by + 6, C('gold', 4));
    sLine(bx + 4, by - 11, bx + 1, by - 3, C('night', 0)); sLine(bx + 1, by - 3, bx + 6, by + 6, C('night', 0));            // the crack
    sRect(bx - 9, by + 2, bx + 9, by + 4, C('night', 0)); sRect(bx - 6, by + 3, bx + 6, by + 3, o.glowEyes ? WHITE : C('hush', 2), 3);
  }
  // the Hollow King, from behind: a tall cloak and a floating ring crown of glyphs
  function drawKing(o) {
    sPoly([[22, -10], [38, -10], [48, 60], [12, 60]], C('night', 1));
    sLine(30, -10, 30, 60, C('night', 2));
    sEll(30, -16, 7, 7, C('night', 1));
    const cy = -30, r = 11;
    for (let a = 0; a < TAU; a += 0.06) { const x = 30 + Math.cos(a + T_NOW * 0.3) * r, y = cy + Math.sin(a + T_NOW * 0.3) * r * 0.35; if (fl(a * 8) % 3) sp(x, y, WHITE, 3); }
  }
  // Vesper as a shape in the fog: armour, a violet crest, a lantern
  function drawVesper(o) {
    sPoly([[18, 20], [42, 20], [44, 52], [16, 52]], C('stone', 3)); sRect(20, 52, 26, 60, C('stone', 2)); sRect(34, 52, 40, 60, C('stone', 2));
    sEll(30, 12, 10, 10, C('stone', 3)); sRect(31, 10, 39, 13, C('night', 0)); sRect(33, 11, 34, 12, C('violet', 6), 3); sRect(37, 11, 38, 12, C('violet', 6), 3);
    for (let k = 0; k < 6; k++) sLine(24 + k * 2, 2, 22 + k * 2, -6 - [5, 8, 10, 9, 6, 3][k], k % 2 ? C('violet', 6) : C('violet', 7), 2, 3);
    sPoly([[14, 22], [4, 58], [18, 58]], C('crimson', 2));
    sRect(40, 40, 44, 46, C('gold', 4)); sRect(41, 41, 43, 45, C('violet', 7), 3);
  }

  // build a sprite for a character in a pose; returns anchor points in local space
  function buildChar(who, o) {
    clearSprite();
    let r = null;
    if (who === 'bellwether') drawBellwether(o);
    else if (who === 'king') drawKing(o);
    else if (who === 'vesper') drawVesper(o);
    else r = o.view && o.view !== 'side' ? bodyFB(o, CAST[who], o.view) : body(o, CAST[who]);
    outlineSprite(who === 'hollow' || who === 'king' ? C('char', 0) : undefined);
    return r;
  }

  // ---------------------------------------------------------------- stamping: scale, rotate, mirror, depth test, light
  const SMASK = new Uint8Array(NP), SMB = [0, 0, 0, 0];
  let T_NOW = 0;
  // draw the built sprite with its feet at screen (x, y); S pixels per sprite pixel; opt: z (depth), dark (shades), rim {side, T, a},
  // color, alpha, white, tint {T, a}, ghost
  function stamp(x, y, S, ang, flip, opt) {
    opt = opt || {};
    const ca = Math.cos(ang || 0), sa = Math.sin(ang || 0), z = opt.z === undefined ? 0.01 : opt.z;
    // feet at local (30, 60)
    const fxl = 30 + SOX, fyl = 60 + SOY;
    let Rr = 0; for (const [lx, ly] of [[SBB[0], SBB[1]], [SBB[2] + 1, SBB[1]], [SBB[0], SBB[3] + 1], [SBB[2] + 1, SBB[3] + 1]]) Rr = Math.max(Rr, Math.hypot(lx - fxl, ly - fyl));
    Rr = Rr * S + 2;
    const x0 = Math.max(0, fl(x - Rr)), x1 = Math.min(W - 1, Math.ceil(x + Rr)), y0 = Math.max(0, fl(y - Rr)), y1 = Math.min(H - 1, Math.ceil(y + Rr));
    if (!opt.keepMask) { SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
    const dark = opt.dark || 0, rim = opt.rim, fogT = opt.fog ? ENV.fog : null, fa = opt.fog ? fogA(z) : 0;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
      const dx = X + 0.5 - x, dy = Y + 0.5 - y;
      let lx = (dx * ca + dy * sa) / S; const ly = (-dx * sa + dy * ca) / S;
      if (flip) lx = -lx;
      const ix = fl(lx + fxl), iy = fl(ly + fyl);
      if (ix < 0 || iy < 0 || ix >= SW || iy >= SH) continue;
      const si = iy * SW + ix, c0 = SPR[si]; if (!c0) continue;
      if (opt.alpha !== undefined && bay(X, Y) > opt.alpha) continue;
      const i = Y * W + X; if (z > ZB[i]) continue;
      let c = c0 - 1;
      if (opt.color !== undefined) c = opt.color;
      else if (opt.white) c = SPK[si] === 4 ? C('hush', 2) : WHITE;
      else {
        if (dark && SPK[si] !== 3) c = RD(c, dark);
        if (rim && SPK[si] !== 4) { const nb = flip ? -rim.side : rim.side; if (!SPR[si + nb] || SPK[si + nb] === 4 || !SPR[si + nb * 2]) c = rim.T[Math.min(7, fl(rim.a * 8)) * NPAL + c]; }
        if (opt.tint) c = opt.tint.T[Math.min(7, Math.max(0, fl(opt.tint.a * 8 + bay(X, Y) - 0.5))) * NPAL + c];
        if (fogT && fa > 0 && SPK[si] !== 3) { const l = Math.min(7, fl(fa * 8 + bay(X, Y) - 0.5)); if (l >= 0) c = fogT[l * NPAL + c]; }
      }
      BUF[i] = c; if (!opt.noZ) ZB[i] = z; IDB[i] = 65535;
      if (!opt.noMask) { SMASK[i] = 1; if (X < SMB[0]) SMB[0] = X; if (Y < SMB[1]) SMB[1] = Y; if (X > SMB[2]) SMB[2] = X; if (Y > SMB[3]) SMB[3] = Y; }
    }
  }
  function clearMask() { if (SMB[2] >= SMB[0]) for (let y = SMB[1]; y <= SMB[3]; y++) SMASK.fill(0, y * W + SMB[0], y * W + SMB[2] + 1); SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
  const ROWT = new Uint8Array(W);
  function glitchRows(t, amp, prob) {
    const f = fl(t * 15); prob = prob || 0.18;
    for (let y = SMB[1]; y <= SMB[3]; y++) {
      const band = fl(y / 3); if (ih(band, f, 51) > prob) continue;
      const sh = Math.round((ih(band, f, 52) - 0.5) * 2 * amp); if (!sh) continue;
      const o = y * W; for (let x = SMB[0]; x <= SMB[2]; x++) ROWT[x] = BUF[o + x];
      for (let x = SMB[0]; x <= SMB[2]; x++) { const sx = x - sh; if (sx >= SMB[0] && sx <= SMB[2] && SMASK[o + sx]) BUF[o + x] = ROWT[sx]; }
    }
  }
  // place a character in screen space: feet at (x, y), S scale. Hollow get ghosts and tearing.
  function actor(who, o, x, y, S, opt) {
    opt = opt || {};
    const r = buildChar(who, o);
    clearMask();
    if (who === 'hollow' && !opt.clean) {
      const off = Math.max(1, Math.round(S * 1.1)) + (fl(T_NOW * 12) % 3 === 0 ? 1 : 0);
      stamp(x - off, y, S, opt.ang, opt.flip, { z: opt.z, color: C('teal', 5), alpha: 0.3, noMask: true, noZ: true });
      stamp(x + off, y, S, opt.ang, opt.flip, { z: opt.z, color: C('crimson', 5), alpha: 0.3, noMask: true, noZ: true });
    }
    if (opt.after) for (const a of opt.after) stamp(a[0], a[1], S, opt.ang, opt.flip, { z: opt.z, color: a[2], alpha: a[3], noMask: true, noZ: true });
    stamp(x, y, S, opt.ang, opt.flip, opt);
    if ((who === 'hollow' && !opt.clean) || opt.glitch) glitchRows(T_NOW, Math.max(2, Math.round(S * 1.5)) * (1 + (opt.glitch || 0) * 3), opt.glitch ? 0.55 : 0.2);
    // where things are, in screen space
    const L = (p) => { if (!p) return null; let lx = (p[0] - 30) * S, ly = (p[1] - 60) * S; if (opt.flip) lx = -lx; const c = Math.cos(opt.ang || 0), s = Math.sin(opt.ang || 0); return [x + lx * c - ly * s, y + lx * s + ly * c]; };
    return r ? { hand: L(r.hand), head: L(r.head), chest: L(r.chest) } : { head: L([30, 20]) };
  }
  // place a character in the world: feet at (wx, wy, wz), hgt = sprite pixels per world metre (≈ 28 px is 1.6 m tall at S=1)
  function actor3(who, o, wx, wy, wz, opt) {
    opt = opt || {}; const p = proj(wx, wy, wz); if (!p) return null;
    const S = CAM.F / p.z * (opt.size || 1) / 26;
    return Object.assign(actor(who, o, p.x, p.y, S, Object.assign({ z: p.z, fog: true }, opt)), { S, x: p.x, y: p.y, z: p.z });
  }
  // a natural blink every few seconds
  const blink = (t, seed) => frac(t / (2.6 + ih(seed, 1, 9) * 1.8) + ih(seed, 2, 9)) < 0.045;

