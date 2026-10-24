/* The Family — the string of lights.
 *
 * One draped string of lights runs through the four carousel drawings (wedding → fruit stand → Sicily → baptism).
 * Each drawing paints it in its own medium, as something that belongs in its own world, but the GEOMETRY is shared
 * so the wire and the bulbs continue exactly across every seam when the slides sit side by side.
 *
 * Design space: each drawing is 1080 x 1350. Frame k (0..3) spans global x = 1080k .. 1080(k+1).
 * The wire hangs in one swag per frame. Every seam (x = 0 and x = 1080 of a frame) is a HANGING POINT: the wire is
 * at its highest there, y = SEAM_Y, and rises into it symmetrically from both sides, as a string of lights does where
 * it is tied up. Nothing needs to be drawn at the hanging point; the meeting of two swags reads on its own.
 *
 *   FamilyLights.wireY(x)        -> y of the wire at local x (0..1080) in THIS frame (same curve in every frame)
 *   FamilyLights.wirePath(ctx)   -> builds the wire path (moveTo/lineTo) for the whole frame width
 *   FamilyLights.bulbs()         -> [{x, y, i}] bulb positions along the wire for one frame (identical per frame,
 *                                   spaced by arc length, offset half a spacing from each seam so none is cut in half)
 *   FamilyLights.SEAM_Y, SAG, WIRE_W, BULB_R  -> constants (design px)
 *
 * The curve inside a frame is one shallow swag from seam to seam, with a smaller secondary dip so it looks hand-hung.
 * Draw the wire roughly WIRE_W wide in your own style (charcoal stroke, gouache line, watercolour line, lead came…),
 * and draw a light/lantern/pearl at every bulb position, about BULB_R in radius, in your own style.
 * Keep the wire within ~6 px of wireY(x) everywhere, and EXACTLY on it (±1 px) within 40 px of either seam.
 */
(function () {
  'use strict';
  const W = 1080, SEAM_Y = 292, SAG = 118, WIRE_W = 3, BULB_R = 9;
  // y(x): main swag (sin) plus a gentle secondary wave, so it looks hand-hung rather than perfectly symmetric.
  function wireY(x) {
    const u = x / W;
    return SEAM_Y + SAG * Math.sin(Math.PI * u) + 14 * Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * u);
  }
  function wirePath(ctx, x0, x1) {
    x0 = x0 == null ? 0 : x0; x1 = x1 == null ? W : x1;
    ctx.moveTo(x0, wireY(x0));
    for (let x = x0 + 4; x <= x1; x += 4) ctx.lineTo(x, wireY(x));
    ctx.lineTo(x1, wireY(x1));
  }
  // bulbs spaced evenly by arc length, the first and last half a spacing in from the seams
  const N = 17;
  let cache = null;
  function bulbs() {
    if (cache) return cache.map((b) => Object.assign({}, b));
    const pts = []; let L = 0, px = 0, py = wireY(0);
    const lens = [0];
    for (let x = 1; x <= W; x++) { const y = wireY(x); L += Math.hypot(x - px, y - py); lens.push(L); px = x; py = y; }
    const step = L / N;
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = step * (i + 0.5);
      while (lens[j + 1] < s) j++;
      const x = j + (s - lens[j]) / (lens[j + 1] - lens[j]);
      pts.push({ x, y: wireY(x), i });
    }
    cache = pts;
    return bulbs();
  }
  window.FamilyLights = { W, SEAM_Y, SAG, WIRE_W, BULB_R, wireY, wirePath, bulbs };
})();
