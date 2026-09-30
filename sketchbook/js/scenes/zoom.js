/* Plate: EVERYTHING INSIDE EVERYTHING.
   The pen draws the first world, the city at dusk, the way it draws every plate. While it draws, the zoom engine
   quietly inks the other twelve worlds; when the pen lifts, the studio appears in the lit window and the page starts
   to fall into itself: studio, drawing board, sketchbook, leaf, cells, chloroplast, membrane, molecule, atom,
   galaxy, Earth, and back to the same city, for ever. (The worlds live in js/zoom/.) */
(function () {
  const Z = window.SketchZoom; if (!Z || !Z.defs.length) return;
  const d0 = Z.defs[0], HOLD = 1.6;
  let E = null, off = null, tReady = null, tLast = -1;
  const engine = () => E || (E = Z.engine({ q: Math.min(1, (document.getElementById('ink') || { width: 1600 }).width / 1600), beta: 1.25 }));
  (window.SCENES = window.SCENES || []).push({
    name: 'Everything Inside Everything', seed: d0.seed ?? 1, ink: d0.ink || '#1a1410',
    theme: { grid: null, tape: false, blend: 'normal', vig: 'rgba(30,20,10,0.30)', grain: [250, 244, 230, 36] },
    build(P) {
      // the first world exactly as the zoom draws it, its over-layer (the iron window bars) on a page of its own seed
      const cx = engine().ctxOf(0); d0.build(P, cx);
      if (d0.over) { const Po = new Sketch.Page((d0.seed ?? 1) + 7, { ink: d0.ink }); d0.over(Po, cx); P.ops.push(...Po.ops); }
    },
    // the other worlds are inked a little at a time while the pen works, and faster once it is done
    pump(done) { engine().pump(done ? 12 : 4); },
    takeover(ctx, t, w, h) {
      const e = engine(); if (!e.ready) { tReady = null; return true; }
      if (tReady === null || t < tLast) tReady = t; tLast = t;
      const u = t - tReady;
      if (u < HOLD) { // the studio fades into the window before the fall begins
        if (!off || off.width !== w || off.height !== h) { off = document.createElement('canvas'); off.width = w; off.height = h; }
        e.frame(off.getContext('2d'), 0, w, h); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.12; ctx.drawImage(off, 0, 0); ctx.globalAlpha = 1; return true;
      }
      e.frame(ctx, u - HOLD, w, h); return true;
    }
  });
})();
