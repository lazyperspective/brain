/* skeleton.js — the scaffolding an artist would block in first: joint positions,
 * bone axes and rough section sizes for each finger, the thumb, and the palm/forearm.
 * Units are centimetres. Canonical hand: RIGHT hand, fingers along +Y, back of hand
 * toward +Z, thumb side toward -X. Nothing here is drawn; it only tells the 2D
 * block-in where things go. */
(function () {
  'use strict';
  const HS = window.HS;
  const { clamp, lerp, smooth, gauss, curve1, V } = HS;
  const cos = Math.cos, sin = Math.sin;

  const identF = () => ({ l: [1, 0, 0], d: [0, 1, 0], n: [0, 0, 1] });
  function rotFlex(F, a) {
    const c = cos(a), s = sin(a), d = F.d, n = F.n;
    return { l: F.l, d: [d[0] * c - n[0] * s, d[1] * c - n[1] * s, d[2] * c - n[2] * s], n: [n[0] * c + d[0] * s, n[1] * c + d[1] * s, n[2] * c + d[2] * s] };
  }
  function rotAbd(F, a) {
    const c = cos(a), s = sin(a), d = F.d, l = F.l;
    return { l: [l[0] * c - d[0] * s, l[1] * c - d[1] * s, l[2] * c - d[2] * s], d: [d[0] * c + l[0] * s, d[1] * c + l[1] * s, d[2] * c + l[2] * s], n: F.n };
  }
  function rotRoll(F, a) {
    const c = cos(a), s = sin(a), l = F.l, n = F.n;
    return { l: [l[0] * c + n[0] * s, l[1] * c + n[1] * s, l[2] * c + n[2] * s], d: F.d, n: [n[0] * c - l[0] * s, n[1] * c - l[1] * s, n[2] * c - l[2] * s] };
  }
  function fk(origin, F0, segs) {
    const joints = [origin.slice()], frames = [];
    let F = F0;
    for (const s of segs) { F = s.rot(F); frames.push(F); joints.push(V.madd(joints[joints.length - 1], F.d, s.len)); }
    return { joints, frames };
  }

  const MCP = [{ x: -2.75, y: 9.4 }, { x: -0.9, y: 9.7 }, { x: 0.95, y: 9.2 }, { x: 2.75, y: 8.1 }];
  const FINGERS = [
    { name: 'index',  L: [4.0, 2.4, 2.0], W: 1.95, rest: -0.10 },
    { name: 'middle', L: [4.4, 2.7, 2.2], W: 2.0,  rest: -0.02 },
    { name: 'ring',   L: [4.1, 2.6, 2.1], W: 1.85, rest: 0.06 },
    { name: 'pinky',  L: [3.2, 1.9, 1.9], W: 1.6,  rest: 0.16 },
  ];
  const cupZ = (cup, x, y) => -cup * 0.09 * (x + 1.5) * (x + 1.5) * smooth(0, 8, y);

  /* cross-section (half width, dorsal half thickness, palmar half thickness) along a digit,
     as a function of distance from its first joint */
  function digitSection(L, W, kind) {
    const tot = L[0] + L[1] + L[2];
    let wk, tk, hdFrac;
    if (kind === 'thumb') {
      wk = [[0, 1.45], [0.5 * L[0], 1.22], [0.95 * L[0], 1.02], [L[0], 1.05], [L[0] + 0.5 * L[1], 0.88], [L[0] + 0.95 * L[1], 0.9], [L[0] + L[1], 1.0], [L[0] + L[1] + 0.5 * L[2], 0.96], [tot, 0.8]];
      tk = [[0, 1.0], [0.6 * L[0], 0.95], [L[0], 0.95], [L[0] + L[1], 0.88], [tot, 0.72]];
      hdFrac = 0.42;
    } else {
      wk = [[0, 1.06], [0.55 * L[0], 0.9], [L[0], 1.04], [L[0] + 0.5 * L[1], 0.85], [L[0] + L[1], 0.97], [L[0] + L[1] + 0.45 * L[2], 0.86], [L[0] + L[1] + 0.8 * L[2], 0.84], [tot, 0.66]];
      tk = [[0, 0.95], [L[0], 0.92], [L[0] + L[1], 0.84], [tot, 0.7]];
      hdFrac = 0.4;
    }
    const wf = curve1(wk.map((k) => k[0]), wk.map((k) => k[1]));
    const tf = curve1(tk.map((k) => k[0]), tk.map((k) => k[1]));
    const scale = kind === 'thumb' ? 1 : 1.1;
    return (s) => {
      const hw = 0.5 * W * scale * wf(s), T = tf(s) * 2 * hw;
      return { w: hw, hd: hdFrac * T, hp: (1 - hdFrac) * T, pw: 2.3 + 0.4 * clamp(s / tot, 0, 1) };
    };
  }

  HS.buildSkeleton = function (pose) {
    const cup = pose.cup || 0, arm = pose.arm == null ? 7.5 : pose.arm;
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const D = FINGERS[i], fp = pose.fingers[i], x = MCP[i].x, y = MCP[i].y;
      let F0 = rotRoll(identF(), -Math.atan(0.18 * cup * (x + 1.5)));
      F0 = rotAbd(F0, D.rest + (fp.abd || 0));
      const r = fk([x, y, cupZ(cup, x, y)], F0, [
        { len: D.L[0], rot: (F) => rotFlex(rotRoll(F, fp.roll || 0), fp.mcp || 0) },
        { len: D.L[1], rot: (F) => rotFlex(rotAbd(F, fp.pipAbd || 0), fp.pip || 0) },
        { len: D.L[2], rot: (F) => rotFlex(F, fp.dip || 0) },
      ]);
      fingers.push({ def: D, L: D.L, joints: r.joints, frames: r.frames, sec: digitSection(D.L, D.W, 'finger') });
    }
    const th = pose.thumb;
    let TF = identF();
    TF = rotAbd(TF, -(th.abd == null ? 0.6 : th.abd));
    TF = rotFlex(TF, th.flex == null ? 0.3 : th.flex);
    TF = rotRoll(TF, th.roll == null ? 0.9 : th.roll);
    const TL = [4.6, 3.3, 2.8];
    const tOrigin = [-1.5, 1.5, cupZ(cup, -1.5, 1.5) - 0.6];
    const tk = fk(tOrigin, TF, [
      { len: TL[0], rot: (F) => F },
      { len: TL[1], rot: (F) => rotFlex(rotAbd(F, th.mcpAbd || 0), th.mcp || 0) },
      { len: TL[2], rot: (F) => rotFlex(F, th.ip || 0) },
    ]);
    const thumb = { L: TL, joints: tk.joints, frames: tk.frames, sec: digitSection(TL, 2.35, 'thumb') };

    /* palm + wrist + forearm: one long tapered block */
    const PWk = curve1([-8, -4, -1, 1, 3, 5.5, 8, 10], [3.3, 3.05, 2.85, 3.25, 3.85, 3.95, 3.95, 3.95]);
    const PHk = curve1([-8, -4, -1, 1, 3, 5.5, 8, 10], [2.3, 2.15, 1.9, 1.7, 1.45, 1.25, 1.15, 1.1]);
    const Ymax = curve1([-4.7, -3.6, -2.75, -0.9, 0.95, 2.75, 3.7, 4.4], [8.9, 9.6, 9.95, 10.25, 9.75, 8.65, 7.6, 6.6]);
    const Wr = (y) => PWk(y) + 1.25 * gauss(y - 2.9, 2.0);
    const Wu = (y) => PWk(y) - 0.25 * smooth(6, 9, y) + 0.35 * gauss(y - 4.0, 2.0);
    const palm = {
      y0: -arm, Ymax, Wr, Wu, cup, pw: 2.55,
      H: (y) => PHk(y),
      zc: (x, y) => cupZ(cup, x, y),
      /* a point on the dorsal (top=true) or palmar face at (x, y) */
      face(x, y, top) {
        const W = x >= 0 ? Wu(y) : Wr(y);
        const xn = clamp(x / W, -0.995, 0.995);
        const zn = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(xn), this.pw)), 1 / this.pw);
        const z = this.zc(x, y) + (top ? 0.93 * PHk(y) * zn : -1.07 * PHk(y) * zn);
        return [x, y, z];
      },
    };
    return { fingers, thumb, palm, MCP, cup, arm };
  };
})();
