// scene.js - the world layout shared by all modules (metres, camera at origin,
// x right, y up, z forward).
(function () {
  'use strict';
  const LW = window.LW, V = LW.V;
  const S = (LW.scene = {});

  // ---------------------------------------------------------------- the cliff face with the zig-zag
  const U = V.norm([1, 0, 0.36]); // along the face, receding to the right
  const NF = [U[2], 0, -U[0]]; // face normal, toward viewer (left/front)
  const C0 = [-1.6, 0, 21];
  const LEAN = 0.3; // the face (and the battered walls) set back this much per metre
  S.U = U; S.NF = NF; S.C0 = C0; S.LEAN = LEAN;
  // point on the face: u along face, h height, d distance out of the face (toward viewer)
  S.face = (u, h, d = 0) => V.add(V.add(V.add(C0, V.mul(U, u)), [0, h, 0]), V.mul(NF, d - LEAN * h));
  S.faceP = (u, h, d = 0) => LW.proj(S.face(u, h, d));
  // screen -> face coords (u, h, t) on the leaning plane at offset d
  const VA = [-LEAN * NF[0], 1, -LEAN * NF[2]];
  S.unproj = (sx, sy, d = 0) => {
    const r = [(sx - LW.cam.cx) / LW.cam.f, (LW.cam.hy - sy) / LW.cam.f, 1];
    const c = V.add(C0, V.mul(NF, d));
    const a = U, b = VA, e = [-r[0], -r[1], -r[2]], k = [-c[0], -c[1], -c[2]];
    const det = (x, y, z) => x[0] * (y[1] * z[2] - y[2] * z[1]) - y[0] * (x[1] * z[2] - x[2] * z[1]) + z[0] * (x[1] * y[2] - x[2] * y[1]);
    const D = det(a, b, e);
    return [det(k, b, e) / D, det(a, k, e) / D, det(a, b, k) / D];
  };

  // flights of the zig-zag: start u, start h, dir (+1 right / -1 left), steps
  const RISE = 0.17, GO = 0.3, WIDTH = 1.7;
  S.RISE = RISE; S.GO = GO; S.WIDTH = WIDTH;
  S.flights = [];
  let u = 2.8, h = 1.0;
  for (const dir of [1, -1, 1]) {
    const n = 19;
    S.flights.push({ u0: u, h0: h, dir, n, u1: u + dir * n * GO, h1: h + n * RISE });
    u += dir * n * GO;
    h += n * RISE;
  }
  // landings at the turns (between flights) and the top landing
  S.landings = [
    { u0: S.flights[0].u1, u1: S.flights[0].u1 + 1.6, h: S.flights[0].h1 },
    { u0: S.flights[1].u1 - 1.6, u1: S.flights[1].u1, h: S.flights[1].h1 },
    { u0: S.flights[2].u1, u1: S.flights[2].u1 + 1.7, h: S.flights[2].h1 },
  ];
  // final short flight turning INTO the cliff toward the chapel door
  const top = S.landings[2];
  S.final = { u0: top.u0 + 0.15, u1: top.u1 - 0.15, h0: top.h, n: 8, go: 0.3 };
  S.summitH = top.h + S.final.n * RISE;
  S.final.dEnd = -S.final.n * S.final.go; // d where the final flight meets the terrace

  // ---------------------------------------------------------------- chapel (on the summit)
  const uc = (top.u0 + top.u1) / 2;
  S.chapel = {
    uc,
    u0: uc - 3.1, u1: uc + 3.1, // facade extent (along the chapel's own facade axis)
    h: S.summitH, // floor level
    d: S.final.dEnd - 2.2, // facade centre offset from the face
    wallH: 5.0,
    gableH: 1.9,
    depth: 7.5,
  };

  // ---------------------------------------------------------------- near flight (foreground)
  S.near = {
    o: [-0.2, -1.65, 3.3], // outer-left corner of the first riser bottom
    D: V.norm([0.4, 0, 1]),
    n: 12, rise: 0.165, go: 0.3, width: 2.6,
  };
  S.near.N = [S.near.D[2], 0, -S.near.D[0]]; // points right (inner side)
  S.landing = { y: -1.65, zFar: 3.3, x0: -6, x1: -0.2 };
  S.parapet = { z: 3.3, top: -1.0, thick: 0.45 };

  // ---------------------------------------------------------------- sea
  S.seaY = -22;
  S.seaZ = (sy) => (S.seaY * -LW.cam.f) / (sy - LW.cam.hy); // depth of sea at screen row
})();
