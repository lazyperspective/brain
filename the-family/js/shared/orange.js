/* The Family — the shared orange.
 *
 * One orange rolls through the four carousel drawings. It sits exactly on the seam between two frames:
 * its right half at the right edge of one drawing, its left half at the left edge of the next. All four
 * drawings call this one function, so the two halves match pixel for pixel when the slides sit side by side.
 *
 * Design space: every carousel drawing is composed on a 1080 x 1350 (4:5) frame. The orange's centre is at
 * y = ORANGE.y on that frame, on x = 0 (left seam) or x = 1080 (right seam), radius ORANGE.r. Draw it with
 * ctx already scaled so 1 unit = 1 design pixel. It is always drawn in the same full-colour gouache, whatever
 * the style of the drawing around it: the one constant thing in four different worlds.
 */
(function () {
  'use strict';
  const ORANGE = { y: 1062, r: 31, W: 1080, H: 1350 };
  function hash(i) { let x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  // Draw the orange centred at (cx, cy). Fixed light from the upper left. No randomness: identical every call.
  function drawOrange(ctx, cx, cy, r) {
    r = r || ORANGE.r;
    ctx.save();
    // soft contact shadow on the ground beneath it
    const sh = ctx.createRadialGradient(cx + r * 0.25, cy + r * 0.92, r * 0.05, cx + r * 0.25, cy + r * 0.92, r * 1.25);
    sh.addColorStop(0, 'rgba(20,10,4,0.55)'); sh.addColorStop(1, 'rgba(20,10,4,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(cx + r * 0.25, cy + r * 0.92, r * 1.25, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    // body
    const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.08, cx, cy, r * 1.05);
    g.addColorStop(0, '#ffd27a'); g.addColorStop(0.28, '#f79a1e'); g.addColorStop(0.7, '#e2700c'); g.addColorStop(1, '#9e3f06');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // peel dimples
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    for (let i = 0; i < 140; i++) {
      const a = hash(i) * Math.PI * 2, d = Math.sqrt(hash(i + 999)) * r * 0.97;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const lit = ((x - cx) * -0.6 + (y - cy) * -0.65) / r;
      ctx.fillStyle = lit > 0.2 ? 'rgba(255,236,190,0.32)' : 'rgba(120,45,0,0.22)';
      ctx.beginPath(); ctx.arc(x, y, r * (0.025 + hash(i + 55) * 0.02), 0, Math.PI * 2); ctx.fill();
    }
    // rim darkening and highlight
    const rim = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    rim.addColorStop(0, 'rgba(90,30,0,0)'); rim.addColorStop(1, 'rgba(90,30,0,0.35)');
    ctx.fillStyle = rim; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const hl = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.45, 0, cx - r * 0.42, cy - r * 0.45, r * 0.34);
    hl.addColorStop(0, 'rgba(255,250,230,0.85)'); hl.addColorStop(1, 'rgba(255,250,230,0)');
    ctx.fillStyle = hl; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    // stem nub (on the upper right, so it shows on the right half)
    ctx.save();
    ctx.fillStyle = '#5b6b24'; ctx.beginPath(); ctx.ellipse(cx + r * 0.32, cy - r * 0.78, r * 0.11, r * 0.07, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,0,0.55)'; ctx.lineWidth = Math.max(0.6, r * 0.03); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Convenience: draw the halves that belong to this frame. hasLeft = an orange on the left seam (x=0), hasRight = on the right seam (x=W).
  function drawSeamOranges(ctx, hasLeft, hasRight) {
    if (hasLeft) drawOrange(ctx, 0, ORANGE.y);
    if (hasRight) drawOrange(ctx, ORANGE.W, ORANGE.y);
  }
  window.FamilyOrange = { ORANGE, drawOrange, drawSeamOranges };
})();
