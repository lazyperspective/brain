/* poses.js — the gestures. Angles in radians; +flex curls toward the palm.
 * view.yaw = π shows the palm, 0 the back of the hand; pitch > 0 tips the fingertips toward the viewer. */
(function () {
  'use strict';
  const HS = window.HS;
  const PI = Math.PI;
  const f = (mcp, pip, dip, abd, roll) => ({ mcp, pip, dip, abd: abd || 0, roll: roll || 0 });
  const mk = (arr) => arr.map((a) => f(a[0], a[1], a[2], a[3], a[4]));

  HS.POSES = {
    /* 1 — open palm, splayed, seen palm-on */
    openPalm: {
      side: 1, cup: 0.12, thenar: 0.9, arm: 7.5,
      fingers: mk([[0.10, 0.16, 0.08, -0.10], [0.05, 0.10, 0.10, 0.0], [0.09, 0.16, 0.07, 0.06], [0.16, 0.22, 0.10, 0.22]]),
      thumb: { abd: 0.95, flex: 0.1, roll: 1.1, mcp: 0.12, ip: 0.12 },
      wrist: { flex: 0.0, dev: 0.05 },
      view: { yaw: PI - 0.3, pitch: 0.22, roll: -0.12, dist: 60 },
    },
    /* 2 — back of a relaxed hand */
    backRelaxed: {
      side: 1, cup: 0.15, thenar: 0.6, arm: 6, interosseous: 1.2,
      light: [-0.15, 0.7, 0.7],
      fingers: mk([[0.30, 0.42, 0.22, -0.10], [0.36, 0.55, 0.30, -0.01], [0.46, 0.64, 0.36, 0.05], [0.56, 0.70, 0.40, 0.14]]),
      thumb: { abd: 0.55, flex: 0.2, roll: 0.8, mcp: 0.18, ip: 0.2 },
      wrist: { flex: -0.15, dev: -0.05 },
      view: { yaw: 0.35, pitch: 0.55, roll: 0.35, dist: 50 },
    },
    /* 3 — cupped, curled fingers, three-quarter from the palm side */
    curled: {
      side: 1, cup: 0.7, thenar: 1.1, arm: 5.5,
      fingers: mk([[0.75, 1.0, 0.6, -0.06, 0.05], [0.85, 1.1, 0.66, 0.0], [0.95, 1.15, 0.7, 0.04, -0.05], [1.0, 1.1, 0.66, 0.08, -0.12]]),
      thumb: { abd: 0.55, flex: 0.5, roll: 1.0, mcp: 0.35, ip: 0.3 },
      wrist: { flex: 0.2, dev: 0.0 },
      view: { yaw: PI - 0.9, pitch: 0.5, roll: 0.3, dist: 45 },
    },
    /* 4 — fist */
    fist: {
      side: 1, cup: 0.35, thenar: 0.9, arm: 5.0,
      fingers: mk([[1.35, 1.75, 1.15, 0, 0.10], [1.40, 1.80, 1.2, 0, 0.02], [1.45, 1.80, 1.2, 0, -0.08], [1.40, 1.75, 1.15, 0, -0.18]]),
      thumb: { abd: 0.15, flex: 0.65, roll: 0.55, mcp: 0.5, ip: 0.35 },
      wrist: { flex: -0.2, dev: 0.05 },
      view: { yaw: PI - 0.5, pitch: 0.9, roll: 0.1, dist: 45 },
    },
    /* 5 — reaching toward the viewer, strongly foreshortened */
    reaching: {
      side: 1, cup: 0.1, thenar: 0.7, arm: 5, fadeArm: true,
      fingers: mk([[0.05, 0.08, 0.04, -0.12], [0.0, 0.05, 0.03, -0.02], [0.05, 0.09, 0.04, 0.07], [0.12, 0.14, 0.06, 0.20]]),
      thumb: { abd: 0.8, flex: 0.12, roll: 0.9, mcp: 0.1, ip: 0.1 },
      wrist: { flex: -0.3, dev: 0 },
      view: { yaw: 0.9, pitch: 0.7, roll: 0.75, dist: 34, pivot: [0, 6, 0] },
    },
    /* 6 — radial side view, fingers together, thumb lifted */
    side: {
      side: 1, cup: 0.25, thenar: 0.9, arm: 5.5,
      fingers: mk([[0.32, 0.42, 0.22, 0.10], [0.36, 0.5, 0.26, 0.05], [0.42, 0.55, 0.3, 0.0], [0.5, 0.62, 0.34, -0.04]]),
      thumb: { abd: 0.85, flex: 0.02, roll: 0.5, mcp: 0.05, ip: 0.1 },
      wrist: { flex: -0.1, dev: 0 },
      view: { yaw: 1.9, pitch: 0.15, roll: -0.2, dist: 55 },
    },
    /* 7 — pointing */
    pointing: {
      side: 1, cup: 0.4, thenar: 0.9, arm: 5,
      fingers: mk([[0.05, 0.08, 0.03, -0.03], [1.35, 1.75, 1.1, 0.0, -0.05], [1.4, 1.8, 1.15, 0, -0.1], [1.35, 1.75, 1.1, 0, -0.18]]),
      thumb: { abd: 0.25, flex: 0.7, roll: 0.4, mcp: 0.55, ip: 0.3 },
      wrist: { flex: -0.1, dev: 0.05 },
      view: { yaw: 0.75, pitch: 0.2, roll: -0.35, dist: 50 },
    },
    /* 8 — precision grip (holding a small object) */
    pinch: {
      side: 1, cup: 0.35, thenar: 1.0, arm: 4.5,
      fingers: mk([[0.75, 0.75, 0.45, -0.05], [0.85, 0.95, 0.5, 0.02], [1.0, 1.15, 0.6, 0.05, -0.05], [1.1, 1.2, 0.6, 0.08, -0.1]]),
      thumb: { abd: 0.5, flex: 0.55, roll: 1.05, mcp: 0.35, ip: 0.25 },
      wrist: { flex: 0.05, dev: 0.1 },
      view: { yaw: 0.9, pitch: 0.15, roll: 0.1, dist: 45 },
    },
    /* 9 — clawed, hyper-splayed, palm-on and foreshortened */
    claw: {
      side: -1, cup: 0.3, thenar: 1.0, arm: 5,
      fingers: mk([[-0.12, 0.62, 0.22, -0.22], [-0.08, 0.66, 0.26, -0.08], [-0.06, 0.68, 0.26, 0.08], [0.0, 0.62, 0.22, 0.28]]),
      thumb: { abd: 1.0, flex: 0.1, roll: 1.0, mcp: -0.1, ip: 0.2 },
      wrist: { flex: -0.25, dev: 0 },
      view: { yaw: PI + 0.35, pitch: 0.9, roll: 0.25, dist: 36, pivot: [0, 6, 0] },
    },
    /* 10 — loosely open, palm up, an unfinished construction study */
    resting: {
      side: -1, cup: 0.45, thenar: 1.0, arm: 4, finish: 0.55, construction: true,
      fingers: mk([[0.35, 0.5, 0.3, -0.06], [0.42, 0.6, 0.35, 0.0], [0.5, 0.7, 0.4, 0.05], [0.6, 0.72, 0.4, 0.12]]),
      thumb: { abd: 0.7, flex: 0.25, roll: 1.0, mcp: 0.2, ip: 0.25 },
      wrist: { flex: 0.1, dev: 0 },
      view: { yaw: PI - 0.45, pitch: 0.7, roll: -0.5, dist: 48 },
    },
  };
})();
