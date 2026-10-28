  /* ================================================================ the cast: hand-pixelled parts */
  // Everything faces right; the rig mirrors it. Keys map letters to palette entries.
  const k_ = C('ink', 0);
  /* ---- Sable */
  const SABLE_KEY = {
    k: k_, H: C('hair', 1), h: C('hair', 2), l: C('hair', 3), L: C('hair', 5), s: C('tan', 5), S: C('tan', 3), t: C('tan', 6), n: C('tan', 2),
    C: C('ink', 3), D: C('ink', 4), c: C('ink', 2), w: C('linen', 6), W: C('linen', 4), r: C('crimson', 4), R: C('crimson', 2), g: C('gold', 5),
  };
  const SABLE = {
    key: SABLE_KEY,
    head: { ax: 11, ay: 23, eyeN: [15, 12], eyeF: [10, 12], mouth: [15, 18], browN: [14, 10], browF: [9, 10], rows: [
      '........kkkkkkk.......',
      '......kkHHHHHHHkk.....',
      '.....kHHhhhhhhhhHk....',
      '....kHhhhlllllhhhHk...',
      '...kHhhhlLLLLLlhhhHk..',
      '..kHhhhhllllllhhhhhk..',
      '.kHhhhhhhhhhhhhhhhhHk.',
      '.kHhhhhhhhHhhhHhhhhhk.',
      'kHhhhhhhHkhHkhhHhHhhk.',
      'kHhhhhhHkssHksshHkshHk',
      'kHhhhhHksssskssssksssk',
      'kHhhhhHkssssssssssssk.',
      'kHhhhhHksssssssssssssk',
      'kHhhhhHsssssssssssssk.',
      'kHhhhhHsSsssssssssssk.',
      'kHhhhhHsSsssssssssnssk',
      'kHhhhhHSSssssssssssk..',
      'kHhhhhHkSSsssssssssk..',
      '.kHhhhHkSSssssssssk...',
      '.kHhhhHkkSSssssssk....',
      '.kHhhhHk.kSSsssskk....',
      '..kHhhHk..kkSSSk......',
      '..kHhhHk...kSSSk......',
      '...kHHk....kSSSk......',
    ] },
    torso: { ax: 8, ay: 0, shN: [13, 3], shF: [3, 3], hip: [8, 16], rows: [
      '......kssk......',
      '....kkwSwkkk....',
      '..kkDDwwwwCCkk..',
      '.kDDDCCwwCCCcCk.',
      '.kDDCCCCwCCCcCk.',
      'kDDCCCCCwCCCcCCk',
      'kDDCCCCCCwCCcCCk',
      'kDCCCCCCCCwCcCCk',
      'kDCCCCCCCCCwcCk.',
      '.kDCCCCCCCCCcCk.',
      '.kDCCCCCCCCCcCk.',
      '.kDCCCCCCCCCcCk.',
      '.krrrrrrrrrRRrk.',
      '.krrrrrrgrrRRrk.',
      '.kRRRRRRRRRRRRk.',
      '.kDCCCCCCCCcCCk.',
      '.kDCCCCCCCCckCCk',
      'kDCCCCCCCCck.kCk',
      'kDCCCCCCCck..kCk',
      'kDCCcCCCCck...kCk',
      'kDCCcCCCck....kCk',
      'kDCCcCCCck....kCk',
      'kDCCcCCck.....kk.',
      'kkkkkkkk.........',
    ] },
  };
  // faces, shared shapes: eyes (near and far), mouths, brows; I = iris, P = pupil
  const EYES = {
    open: { n: ['kkk', 'wIP', 'wPP'], f: ['kk', 'IP', 'PP'] },
    wide: { n: ['kkk', 'wIw', 'wPP', '.w.'], f: ['kk', 'Iw', 'PP'] },
    half: { n: ['...', 'kkk', 'wPP'], f: ['..', 'kk', 'PP'] },
    narrow: { n: ['...', 'kkk', '.PP'], f: ['..', 'kk', '.P'] },
    closed: { n: ['...', '...', 'kkk'], f: ['..', '..', 'kk'] },
    happy: { n: ['...', '.k.', 'k.k'], f: ['..', 'k.', '.k'] },
    sad: { n: ['k..', 'wIP', 'wPP'], f: ['.k', 'IP', 'PP'] },
  };
  const MOUTHS = { closed: ['nn'], smile: ['n..n', '.nn.'], frown: ['.nn.', 'n..n'], o1: ['kk', 'mm'], o2: ['kkk', 'mmm', 'kkk'], o3: ['kkk', 'mtm', 'mmm', 'kkk'], grit: ['kkk', 'www', 'kkk'] };
  const BROWS = { n: { n: ['HHH'], f: ['HH'] }, angry: { n: ['H..', '.HH'], f: ['.H', 'H.'] }, worried: { n: ['.HH', 'H..'], f: ['H.', '.H'] }, up: { n: ['HHH', '...'], f: ['HH', '..'] } };
  function face(CH, x0, y0, flip, F, key) {
    const hd = CH.head, at = (a) => [x0 + (flip ? hd.ax - a[0] : a[0] - hd.ax), y0 + a[1] - hd.ay];
    const ek = Object.assign({}, key, { w: C('snow', 7), I: C(CH.iris, 5), P: C(CH.iris, 1), m: C('crimson', 1), t: C('crimson', 4), k: k_ });
    const E = EYES[F.eyes || 'open'] || EYES.open;
    for (const [rows, a] of [[E.n, hd.eyeN], [E.f, hd.eyeF]]) { const [x, y] = at(a); art({ rows, ax: 0, ay: 0 }, x, y, flip, ek); }
    const B = BROWS[F.brows || 'n'] || BROWS.n;
    for (const [rows, a] of [[B.n, hd.browN], [B.f, hd.browF]]) { const [x, y] = at(a); art({ rows, ax: 0, ay: 0 }, x, y - rows.length + 1, flip, ek); }
    const m = F.mouth || 0, M = m > 0.75 ? MOUTHS.o3 : m > 0.45 ? MOUTHS.o2 : m > 0.15 ? MOUTHS.o1 : F.smile > 0.3 ? MOUTHS.smile : F.smile < -0.3 ? MOUTHS.frown : MOUTHS.closed;
    const [mx, my] = at(hd.mouth); art({ rows: M, ax: 0, ay: 0 }, mx - (M[0].length > 2 ? 1 : 0), my, flip, ek);
    // the cracked white mask: a plate over the upper face with two slits (embers burning behind them when lit)
    if (F.mask) { const x0_ = hd.eyeF[0] - 2, x1_ = hd.eyeN[0] + 4, y0_ = hd.browF[1] - 1, y1_ = hd.mouth[1] + 1;
      for (let yy = y0_; yy <= y1_; yy++) for (let xx = x0_; xx <= x1_; xx++) { if (yy === y1_ && (xx === x0_ || xx === x1_)) continue; const [px, py] = at([xx, yy]); const slit = yy === hd.eyeN[1] + 1 && ((xx >= hd.eyeN[0] && xx <= hd.eyeN[0] + 2) || (xx >= hd.eyeF[0] && xx <= hd.eyeF[0] + 1)); const crack = xx === hd.eyeN[0] + 1 + (yy > hd.eyeN[1] + 2 ? 1 : 0) && yy !== hd.eyeN[1] + 1;
        sp(px, py, slit ? (F.mask > 1 ? C('fire', 6) : C('ink', 0)) : crack ? C('ink', 1) : yy === y0_ ? C('snow', 7) : C('hush', 5 + (xx > hd.eyeN[0] ? -1 : 0)), slit && F.mask > 1 ? 3 : 1); } }
    if (F.blush) for (const a of [[hd.eyeN[0] - 1, hd.eyeN[1] + 4], [hd.eyeF[0] - 1, hd.eyeF[1] + 4]]) { const [x, y] = at(a); sp(x, y, C('rose', 4)); sp(x + (flip ? -1 : 1), y, C('rose', 4)); }
  }
  SABLE.iris = R.ember;
  SABLE.head.key = SABLE.torso.key = SABLE_KEY;

  /* ---- Mira: eight, a yellow raincoat with the hood up, brown fringe, red boots */
  const MIRA_KEY = {
    k: k_, Y: C('gold', 5), y: C('gold', 4), z: C('gold', 3), Z: C('gold', 6), s: C('skin', 5), S: C('skin', 3), t: C('skin', 6), n: C('skin', 2),
    b: C('wood', 3), B: C('wood', 2), o: C('linen', 7), H: C('wood', 1),
  };
  const MIRA = {
    key: MIRA_KEY, iris: R.wood,
    head: { ax: 9, ay: 19, eyeN: [13, 11], eyeF: [8, 11], mouth: [13, 15], browN: [12, 9], browF: [7, 9], rows: [
      '.......kkkkkk.......',
      '.....kkYYYYYYkk.....',
      '....kYZZZZZZYYYk....',
      '...kYZZYYYYYYYYYk...',
      '..kYZYYyyyyyyyYYYk..',
      '..kYYyykkkkkkkyyYk..',
      '.kYYyykbbbbbbbkkyYk.',
      '.kYYykbbBbbbbbbbkYk.',
      '.kYYykbBssbbbssbbkYk',
      '.kYYyksssssssssssskk',
      '.kYYykssssssssssssk.',
      '.kYYyksssssssssssssk',
      '.kYYyksSsssssssssssk',
      '.kYYyksSssssssssssk.',
      '.kYYyksSSsssssssssk.',
      '.kYYYykSSssssssssk..',
      '..kYYYykSSsssssskk..',
      '..kzYYYykkSSSSkk....',
      '...kzzYYYkkkkk......',
      '....kkkkkk..........',
    ] },
    torso: { ax: 7, ay: 0, shN: [11, 2], shF: [3, 2], hip: [7, 12], rows: [
      '.....kssk.....',
      '...kkYYYYkk...',
      '..kZYYYYYYYk..',
      '.kZZYYoYYYYYk.',
      '.kZYYYYYYYyYk.',
      '.kZYYYoYYYyYk.',
      'kZZYYYYYYYyYYk',
      'kZYYYYoYYYyYYk',
      'kZYYYYYYYYyYYk',
      'kZYYYYoYYyyYYk',
      'kZYYYYYYYyYYYk',
      'kZYYyyyyyyYYYk',
      'kZYYYYYYYYYYYk',
      'kZYYYYYYYYYYYk',
      'kZYYYYYYYYYYYYk',
      'kzzzzzzzzzzzzzk',
      'kkkkkkkkkkkkkkk',
    ] },
  };
  MIRA.head.key = MIRA.torso.key = MIRA_KEY;
  // body measures (sprite pixels): legs, arms, limb widths, colours
  SABLE.body = { leg: 30, thigh: 15.5, shin: 15, legR: 2.3, arm1: 9, arm2: 8.5, armR: 1.7, pants: R.ink, pantsB: 2, sleeve: R.ink, sleeveB: 3, skin: R.tan, boot: R.hair, cuff: R.crimson };
  MIRA.body = { leg: 16, thigh: 8.5, shin: 8, legR: 2, arm1: 6, arm2: 5.5, armR: 1.7, pants: R.crimson, pantsB: 3, sleeve: R.gold, sleeveB: 4, skin: R.skin, boot: R.crimson, kid: true };

  /* ---------------------------------------------------------------- the rig */
  // pose (sprite pixels, feet at 0,0, facing right): hip (y offset of the hips, default -leg), lean (px the head leads),
  // legs [near, far]: { foot: [x, y], knee: [x, y] } (knee optional: IK bends it forward), arms [near, far]: { a, b } angles
  // (0 = hanging, + forward/up) or { hand: [x, y] }, face {...}, hair (sway), prop (fn)
  function ik(ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy); const mx = l1 + l2 - 0.01; if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1), -1, 1)), base = Math.atan2(dy, dx), ang = base + a * bend;
    return [ax + Math.cos(ang) * l1, ay + Math.sin(ang) * l1, ax + dx, ay + dy];
  }
  function rig(CH, P, t) {
    const B = CH.body, tr = CH.torso, hd = CH.head;
    sclear();
    const hipY = P.hip === undefined ? -B.leg : P.hip, lean = P.lean || 0, bob = P.bob || 0;
    const hx = 0, hy = hipY + bob;
    // torso placement: its hip anchor on the hips, leaning the top forward by shifting rows
    const neck = [hx + lean, hy - tr.hip[1]];
    const shN = [neck[0] + tr.shN[0] - tr.ax, neck[1] + tr.shN[1]], shF = [neck[0] + tr.shF[0] - tr.ax, neck[1] + tr.shF[1]];
    // the far side first: back hair, far arm, far leg
    if (CH.back) CH.back(P, neck, t);
    const arm = (A, sh, far) => {
      let el, hd_;
      if (A.hand) { const r = ik(sh[0], sh[1], A.hand[0], A.hand[1], B.arm1, B.arm2, A.bend === undefined ? -1 : A.bend); el = [r[0], r[1]]; hd_ = [r[2], r[3]]; }
      else { const a = A.a === undefined ? 0.15 : A.a, b = A.b === undefined ? 0.3 : A.b; el = [sh[0] + Math.sin(a) * B.arm1, sh[1] + Math.cos(a) * B.arm1]; hd_ = [el[0] + Math.sin(a + b) * B.arm2, el[1] + Math.cos(a + b) * B.arm2]; }
      limb(sh[0], sh[1], el[0], el[1], B.armR + 0.3, B.armR, B.sleeve, B.sleeveB - far);
      limb(el[0], el[1], hd_[0], hd_[1], B.armR, B.armR + 0.2, B.sleeve, B.sleeveB - far);
      if (B.cuff) limb(lerp(el[0], hd_[0], 0.75), lerp(el[1], hd_[1], 0.75), hd_[0], hd_[1], B.armR + 0.3, B.armR + 0.3, B.cuff, 4 - far);
      blob(hd_[0] + (hd_[0] - el[0]) * 0.18, hd_[1] + (hd_[1] - el[1]) * 0.18, 1.6, B.skin, 5 - far);
      return { el, hand: hd_ };
    };
    const leg = (L, ox, far) => {
      const hp = [hx + ox, hy - 1], ft = L.foot || [ox, 0];
      let kn = L.knee; if (!kn) { const r = ik(hp[0], hp[1], ft[0], ft[1] - 1, B.thigh, B.shin, -1); kn = [r[0], r[1]]; }
      limb(hp[0], hp[1], kn[0], kn[1], B.legR + 0.3, B.legR, B.pants, B.pantsB - far);
      limb(kn[0], kn[1], ft[0], ft[1] - 1.5, B.legR, B.legR - 0.3, B.kid ? B.boot : B.pants, (B.kid ? 4 : B.pantsB) - far);
      // the boot: toe forward
      const bt = B.boot, fx = ft[0], fy = ft[1] - 1;
      for (let x = -2; x <= 3; x++) for (let y = -2; y <= 0; y++) if (!(x === 3 && y === -2)) sp(fx + x, fy + y, C(bt, (y === -2 ? 3 : 2) - far + (x < 0 ? 0 : 0)));
      return kn;
    };
    const A = P.arms || [{}, {}], L = P.legs || [{}, {}];
    const aF = arm(A[1], shF, 1);
    if (P.propFar) P.propFar(aF, t);
    leg(L[1], -2, 1); leg(L[0], 2, 0);
    // the torso, the head and its face
    art(tr, neck[0], neck[1], false);
    const hx2 = neck[0] + (P.headX || 0), hy2 = neck[1] + 1 + (P.headY || 0);
    art(hd, hx2, hy2, false); if (!CH.noFace) face(CH, hx2, hy2, false, P.face || {}, CH.key);
    if (CH.front) CH.front(P, [hx2, hy2], t);
    const aN = arm(A[0], shN, 0);
    if (P.prop) P.prop(aN, t);
    return { neck, head: [hx2, hy2 - hd.ay / 2], handN: aN.hand, handF: aF.hand, chest: [neck[0], neck[1] + 6] };
  }
  // draw a character into the frame: feet at (x, y), scale S, facing f (+1 right, -1 left)
  function actor(CH, P, x, y, S, f, o) {
    LIGHTS.x = LIGHT.x * (f < 0 ? -1 : 1); LIGHTS.y = LIGHT.y;
    const r = rig(CH, P, P.t || 0);
    soutline(ENV.edge);
    stamp(x, y, S || 1, f < 0, o);
    const L = (q) => [x + (f < 0 ? -q[0] - 0.5 : q[0] + 0.5) * (S || 1), y + q[1] * (S || 1)];
    return { head: L(r.head), handN: L(r.handN), handF: L(r.handF), chest: L(r.chest), neck: L(r.neck) };
  }
  // Sable's ponytail: a chain of shrinking blobs from the crown, swaying
  SABLE.back = (P, neck, t) => {
    const w = P.wind || 0; let x = neck[0] - 6, y = neck[1] - 19;
    blob(x + 1, y, 2.2, R.crimson, 4);
    for (let k = 0; k < 9; k++) { const sw = Math.sin(t * 2.2 - k * 0.5) * (0.35 + w * 0.2); x += -1.1 - w * 0.5 + sw * 0.4; y += 2.2 - w * 0.25; blob(x, y, Math.max(1, 3 - k * 0.22), R.hair, k % 3 === 1 ? 3 : 2); }
  };
  const ENV = { edge: null };
  // Sable's sword: a long single-edged blade, a gold guard, a red-wrapped grip; ang 0 points straight up
  function swordArt(hx, hy, ang, L, burn) {
    const dx = Math.sin(ang), dy = -Math.cos(ang), nx = -dy, ny = dx;
    for (let u = -4; u <= 0; u += 0.5) sp(hx + dx * u, hy + dy * u, C('crimson', u % 2 === 0 ? 2 : 3), 2);
    for (let q = -3; q <= 3; q += 0.5) sp(hx + dx * 1.5 + nx * q, hy + dy * 1.5 + ny * q, C('gold', q < 0 ? 5 : 3), 2);
    for (let u = 2; u < L; u += 0.5) { const w = u > L - 4 ? (L - u) / 4 : 1; for (let q = -0.6; q <= w * 1.1; q += 0.5) sp(hx + dx * u + nx * q, hy + dy * u + ny * q, burn ? C(q > 0.6 ? 'fire' : 'ember', q > 0.6 ? 6 : 5) : C('steel', q < 0 ? 6 : q > 0.8 ? 3 : 5), burn ? 3 : 2); }
  }
  // Mira's lantern, hanging from her hand
  function lanternArt(hx, hy, t, lit) {
    const sw = Math.round(Math.sin(t * 3) * 0.6);
    for (let y = 0; y < 3; y++) sp(hx + sw * y / 3, hy + y, C('wood', 2), 2);
    for (let y = 3; y < 9; y++) for (let x = -2; x <= 2; x++) sp(hx + sw + x, hy + y, y === 3 || y === 8 ? C('wood', 2) : lit ? (Math.abs(x) < 1 ? C('snow', 7) : C('fire', 5)) : C('stone', 3), lit && y > 3 && y < 8 ? 3 : 2);
  }

  /* ---- Kaira: the courier; swept-back silver hair, an indigo headband with a gold stone, a gold mark on her cheek */
  const KAIRA_KEY = {
    k: k_, H: C('steel', 3), h: C('hush', 3), l: C('hush', 6), L: C('snow', 7), s: C('skin', 5), S: C('skin', 3), t: C('skin', 6), n: C('skin', 2),
    i: C('indigo', 2), I: C('indigo', 4), g: C('gold', 5), G: C('gold', 6), C: C('indigo', 3), D: C('indigo', 5), c: C('indigo', 1), w: C('linen', 6), W: C('linen', 4), r: C('gold', 4),
  };
  const KAIRA = {
    key: KAIRA_KEY, iris: R.gold,
    head: { ax: 11, ay: 23, eyeN: [15, 12], eyeF: [10, 12], mouth: [15, 18], browN: [14, 10], browF: [9, 10], rows: [
      '.......k...kk.........',
      'kk....khk.klhk..k.....',
      'khkk.khhkkhlhkkhk.....',
      '.khhkhlhhhhllhhhk.kk..',
      'kkhhhhllLlhhlhhhkhhk..',
      'kHhhhlhhhhlhhHhhhhhhk.',
      '.kHhhHhhhhhhhhHhhhhhk.',
      '..kHiiiiiiiiiiiiiiiik.',
      '.kHiIIIIIIgGIIIIIIIIk.',
      '.kHhiiiiiiiiiiiiiiiik.',
      'kHhhhhHkssskhsskhsssk.',
      'kHhhhhHksssssssssssssk',
      'kHhhhHksssssssssssssk.',
      'kHhhhHkssssssssssssssk',
      'kHhhhHsSsssssssssssssk',
      '.kHhhHsSsssssssssnssk.',
      '.kHhHkSSssssggssssssk.',
      '..kHHkSSssssgsssssk...',
      '..kHk.kSSssssssssk....',
      '...k..kkSSssssssk.....',
      '.......kkSSsssskk.....',
      '.........kSSSSk.......',
      '.........kSSSSk.......',
      '.........kSSSSk.......',
    ] },
    torso: { ax: 8, ay: 0, shN: [13, 3], shF: [3, 3], hip: [8, 16], rows: [
      '......kssk......',
      '....kkIwIkkk....',
      '..kkDDIwwDCCkk..',
      '.kDDDCCwwCCCcCk.',
      '.kDDCCCCwCCCcCk.',
      'kDDCCwCCCwCCcCCk',
      'kDDCCCwCCCwCcCCk',
      'kDCCCCCwCCCwcCCk',
      'kDCCCCCCwCCCcwk.',
      '.kDCCCCCCwCCcCk.',
      '.kDCCCCCCCwCcCk.',
      '.krrrrrrrrrrrrk.',
      '.kgggggGggggggk.',
      '.krrrrrrrrrrrrk.',
      '.kDCCCCCCCCcCCk.',
      '.kDCCCCCCCCcCCk.',
      '.kDCCCCCCCCckCk.',
      '.kDCCCCCCCck.kk.',
      '.kkkkkkkkkk.....',
    ] },
    body: { leg: 30, thigh: 15.5, shin: 15, legR: 2.2, arm1: 9, arm2: 8.5, armR: 1.7, pants: R.indigo, pantsB: 2, sleeve: R.indigo, sleeveB: 3, skin: R.skin, boot: R.ink, cuff: R.gold },
  };
  KAIRA.head.key = KAIRA.torso.key = KAIRA_KEY;
  KAIRA.back = (P, neck, t) => {
    // the satchel on her hip, behind the far side
    const w = P.wind || 0;
    for (let y = 0; y < 6; y++) for (let x = -3; x <= 3; x++) sp(neck[0] - 7 + x, neck[1] + 15 + y, C('linen', y === 0 ? 5 : x < 0 ? 4 : 3));
    // hair streaming back in the wind
    // (each lock a chain of tapering limbs, so the strands stay solid however far the wind pulls them)
    for (let k = 0; k < 4; k++) { let x = neck[0] - 6, y = neck[1] - 15 - k * 2.6; const n = 3 + (k % 2) + Math.round(w * 0.5), seg = 1.8 + w * 0.5; for (let j = 0; j < n; j++) { const nx = x - seg, ny = y + 0.5 + Math.sin(t * 7 + k * 1.3 + j * 0.9) * (0.4 + w * 0.15), r0 = Math.max(0.7, 1.7 - j * 0.32), r1 = Math.max(0.6, 1.7 - (j + 1) * 0.32); limb(x, y, nx, ny, r0, r1, R.hush, k === 1 ? 5 : k === 3 ? 2 : 3); x = nx; y = ny; } }
  };

  /* ---- Tamo: the dockhand; a teal topknot with a gold ring, rosy cheeks, a linen tunic and a sea-blue band */
  const TAMO_KEY = {
    k: k_, H: C('teal', 2), h: C('teal', 3), l: C('teal', 5), L: C('mint', 6), s: C('tan', 5), S: C('tan', 3), t: C('tan', 6), n: C('tan', 2), p: C('rose', 4),
    g: C('gold', 5), C: C('linen', 5), D: C('linen', 6), c: C('linen', 3), b: C('sea', 3), B: C('sea', 2), o: C('rose', 5), O: C('rose', 3), w: C('wood', 4),
  };
  const TAMO = {
    key: TAMO_KEY, iris: R.ink,
    head: { ax: 11, ay: 24, eyeN: [15, 13], eyeF: [10, 13], mouth: [15, 19], browN: [14, 11], browF: [9, 11], rows: [
      '........kkkk..........',
      '.......khhhhk.........',
      '.......kglgGk.........',
      '.....kkkhhhhkkk.......',
      '...kkHHhhlllhhhkk.....',
      '..kHHhhlLLLLlhhhHk....',
      '.kHhhhhllllllhhhhHk...',
      '.kHhhhhhhhhhhhhhhhhk..',
      'kHhhhhhhHhhhhHhhhhhhk.',
      'kHhhhhhHkhhHhhhHhhhhk.',
      'kHhhhhHksshhsshhshhhk.',
      'kHhhhhksssssssssssshk.',
      '.kHhhksssssssssssssssk',
      '.kHhhkssssssssssssssk.',
      '.kHhhksssssssssssssssk',
      '.kHhhsSsssssssssssssk.',
      '.kHhhsSsspssssspsnssk.',
      '..kHhSSspppsssppsssk..',
      '..kHhSSssssssssssssk..',
      '...kHkSSssssssssssk...',
      '....k.kSSssssssskk....',
      '.......kkSSsssskk.....',
      '.........kSSSSk.......',
      '.........kSSSSk.......',
      '.........kSSSSk.......',
    ] },
    torso: { ax: 9, ay: 0, shN: [16, 3], shF: [3, 3], hip: [9, 17], rows: [
      '.......kssk.......',
      '....kkbBbbBbkk....',
      '..kkDDwDDDwDCCkk..',
      '.kDDDDDwDwDCCCcCk.',
      'kDDDCCCCwCCCCooCCk',
      'kDDCCCCCCCCCoOOoCk',
      'kDDCCCCCCCCCCooCCk',
      'kDCCCCCCCCCCCCCcCk',
      'kDCCCCCCCCCCCCCcCk',
      'kDCCCCCCCCCCCCCcCk',
      '.kDCCCCCCCCCCCcCk.',
      '.kbbbbbbbbbbbbbbk.',
      '.kbBBBBBBBBBBBBbk.',
      '.kbbbbbbbbbbbbbbk.',
      '.kDCCCCCCCCCCCcCk.',
      '.kDCCCCCCCCCCCcCk.',
      '.kDCCCCCCCCCCCcCk.',
      '.kkkkkkkkkkkkkkkk.',
    ] },
    body: { leg: 28, thigh: 14.5, shin: 14, legR: 2.8, arm1: 9, arm2: 8.5, armR: 2.2, pants: R.linen, pantsB: 3, sleeve: R.tan, sleeveB: 4, skin: R.tan, boot: R.wood },
  };
  TAMO.head.key = TAMO.torso.key = TAMO_KEY;

  /* ---- the temple wardens: indigo lacquered lamellar, a rounded steel helm with a white plume and a visor slit that
  // glows; Oren, their captain, in a gold helm with a crimson plume */
  const WARDEN_KEY = { k: k_, H: C('steel', 5), h: C('steel', 4), j: C('steel', 3), J: C('steel', 6), d: C('ink', 0), e: C('cyan', 6), P: C('snow', 7), p: C('hush', 4),
    A: C('steel', 4), a: C('steel', 3), b: C('steel', 2), T: C('indigo', 3), t: C('indigo', 2), G: C('gold', 4), g: C('gold', 5), s: C('tan', 4) };
  const WARDEN = {
    key: WARDEN_KEY, iris: R.indigo, noFace: true,
    head: { ax: 11, ay: 23, eyeN: [15, 15], eyeF: [11, 15], mouth: [15, 19], browN: [14, 13], browF: [10, 13], rows: [
      '......................',
      '.....kkkk.............',
      '...kkPPPPkk...........',
      '..kPPPPpPPPk..........',
      '.kPPPppkkkkkkk........',
      '.kPPpkkJJJJHHhkk......',
      'kPPpkJJJHHHHHHhhk.....',
      'kPpkJJHHHHHHHHHhhk....',
      'kPpkJHHHHHHHHHHHhjk...',
      'kpkJHHHHHHHHHHHHhhjk..',
      '.kkHHHHHHHHHHHHHHhjk..',
      '..kHHHHHHHHHkkkkkkkk..',
      '..kHHHHHHHHkdddddddk..',
      '..kHHHHHHHHkddddeddek.',
      '..khHHHHHHHkkkkkkkkkk.',
      '..khhHHHHHHHHHHHHhhjk.',
      '..khhhHHHHHHHHHHhhjjk.',
      '..kjhhhHHHHHHHHhhjjk..',
      '...kjjhhhhhhhhhhjjk...',
      '....kkjjjjjjjjjjkk....',
      '......kGGGGGGGGk......',
      '......kGgggggggk......',
      '.......kkkkkkkk.......',
      '......................',
    ] },
    torso: { ax: 10, ay: 0, shN: [15, 3], shF: [4, 3], hip: [10, 16], rows: [
      '.......kssssk.......',
      '.....kAAAAAaabk.....',
      '...kAAAAAAAaaaabk...',
      '..kAAAGTTTTTttGbbk..',
      '.kAAAAGTTTTTttGabbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kaaaaGTTTTTttGbbbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kaaaaGTTTTTttGbbbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kggggggggggggggggk.',
      '.kGGGGGGGGGGGGGGGGk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kaaaaGTTTTTttGbbbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kAAAAGTTTTTttGabbk.',
      '..kaaaGTTTTTttGbbk..',
      '..kAAAGTTTTTttGbbk..',
      '..kAAAGTTTTTttGbbk..',
      '..kaaaGTTTTTttGbbk..',
      '..kAAAGTTTTTttGbbk..',
      '..kbbbtttttttttbbk..',
      '..kkkkkkkkkkkkkkkk..',
    ] },
    body: { leg: 30, thigh: 15.5, shin: 15, legR: 2.3, arm1: 9, arm2: 8.5, armR: 2, pants: R.indigo, pantsB: 1, sleeve: R.steel, sleeveB: 3, skin: R.tan, boot: R.ink, cuff: R.indigo },
  };
  WARDEN.head.key = WARDEN.torso.key = WARDEN_KEY;
  const OREN_KEY = Object.assign({}, WARDEN_KEY, { H: C('gold', 5), h: C('gold', 4), j: C('gold', 3), J: C('gold', 6), P: C('crimson', 5), p: C('crimson', 3), e: C('fire', 6), T: C('ink', 3), t: C('ink', 2) });
  const OREN = Object.assign({}, WARDEN, { key: OREN_KEY, head: Object.assign({}, WARDEN.head, { key: OREN_KEY }), torso: Object.assign({}, WARDEN.torso, { key: OREN_KEY }), body: Object.assign({}, WARDEN.body, { pants: R.ink, cuff: R.gold }) });
  // a warden's spear: a long shaft and a leaf-shaped steel head with a red tassel; ang 0 points up
  function spearArt(hx, hy, ang, L, t) {
    const dx = Math.sin(ang), dy = -Math.cos(ang), nx = -dy, ny = dx;
    for (let u = -L * 0.35; u < L; u += 0.5) sp(hx + dx * u, hy + dy * u, C('wood', u % 3 < 1.5 ? 3 : 4), 2);
    for (let u = 0; u < 9; u += 0.5) { const w = u < 4 ? u / 4 * 1.6 : (9 - u) / 5 * 1.6; for (let q = -w; q <= w; q += 0.5) sp(hx + dx * (L + u) + nx * q, hy + dy * (L + u) + ny * q, C('steel', q < 0 ? 6 : 4), 2); }
    for (let k = 0; k < 5; k++) sp(hx + dx * (L - 1) - nx * (1 + k * 0.3) + Math.sin((t || 0) * 5 + k) * 0.4, hy + dy * (L - 1) - ny * 1 + k, C('crimson', 4), 2);
  }
