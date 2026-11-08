// Act 2 timeline: shot 6 = 6a (30.1-39.0), 6b (39.0-47.2), 6c (47.2-60.3). Every frame is a pure function of t.
'use strict';
const ACT_START = 30.1, ACT_END = 60.3;
const SHOTS = [SHOT6A, SHOT6B, SHOT6C];
function renderAt(t) {
  let shot = SHOTS[0];
  for (const s of SHOTS) if (t >= s.T0 - 1e-6) shot = s;
  shot.draw(t);
  return FB;
}
