// s1.js — THE CURSOR. Pure black, one amber block. A keystroke turns it into a doorway.
(function (g) {
  'use strict';
  const P = g.PX, C = P.C, TL = g.TL;
  const CX = 240, CY = 135;
  // the cursor block: 5x9, centred on (240,135)
  function cursor(b, on, hot) {
    if (!on) return;
    const x = CX - 2, y = CY - 4;
    P.rect(b, x, y, 5, 9, hot ? C.A6 : C.A5);
    P.hl(b, x, y, 5, hot ? C.A8 : C.A6);
    P.hl(b, x, y + 8, 5, hot ? C.A5 : C.A4);
    if (hot) P.rect(b, x + 1, y + 2, 3, 4, C.A7);
    // one-pixel ember halo, drawn as a band (not bloom)
    P.box(b, x - 1, y - 1, 7, 11, C.A0);
    P.px(b, x - 1, y - 1, C.N0); P.px(b, x + 5, y - 1, C.N0); P.px(b, x - 1, y + 9, C.N0); P.px(b, x + 5, y + 9, C.N0);
    if (hot) { P.box(b, x - 1, y - 1, 7, 11, C.A1); P.dith(b, x - 3, y - 3, 11, 2, C.A0, 8); P.dith(b, x - 3, y + 10, 11, 2, C.A0, 8); P.dith(b, x - 3, y - 1, 2, 11, C.A0, 8); P.dith(b, x + 6, y - 1, 2, 11, C.A0, 8); }
  }
  // door geometry over time -> {x0,y0,x1,y1} (inclusive-exclusive) or null
  function door(t) {
    if (t < TL.slit[0]) return null;
    const DT = 58, DB = 212;
    let x0 = CX - 2, x1 = CX + 3, y0 = CY - 4, y1 = CY + 5;
    const a = P.ease(P.prog(t, TL.slit[0], TL.slit[1]));
    y0 = Math.round(P.lerp(CY - 4, DT, a)); y1 = Math.round(P.lerp(CY + 5, DB, a));
    const w = P.ease(P.prog(t, TL.part[0], TL.part[1]));
    x0 = Math.round(P.lerp(CX - 2, CX - 34, w)); x1 = Math.round(P.lerp(CX + 3, CX + 34, w));
    let k = P.prog(t, TL.door[0], TL.door[1]); k = k * k * (0.35 + 0.65 * k);
    if (k > 0) {
      x0 = Math.round(P.lerp(x0, -12, k)); x1 = Math.round(P.lerp(x1, 492, k));
      y0 = Math.round(P.lerp(y0, -12, k)); y1 = Math.round(P.lerp(y1, 282, k));
    }
    return { x0, y0, x1, y1, a, w, k };
  }
  function render(b, t) {
    P.clear(b, C.N0);
    if (t < TL.slit[0]) {
      const hot = t >= TL.key;
      const dy = (t >= TL.key && t < TL.key + 0.067) ? 1 : 0;
      if (hot || TL.cursorOn(t)) {
        if (dy) { const tmp = P.mk(11, 15); cursorInto(tmp, hot); P.blit(b, tmp, CX - 5, CY - 7 + dy); }
        else cursor(b, true, hot);
      }
      return;
    }
  }
  function cursorInto(tmp, hot) { // helper for the 1px key-press dip
    const full = P.mk(480, 270); cursor(full, true, hot);
    P.blit(tmp, full, 0, 0, { sx: CX - 5, sy: CY - 7, sw: 11, sh: 15 });
  }
  // frame + spill of the doorway, drawn over the composited picture
  function doorFrame(b, d) {
    const { x0, y0, x1, y1 } = d, w = x1 - x0, h = y1 - y0;
    // outer glow bands on the black
    const band = (m, c, lv) => {
      P.dith(b, x0 - m, y0 - m, w + 2 * m, 1, c, lv); P.dith(b, x0 - m, y1 + m - 1, w + 2 * m, 1, c, lv);
      P.dith(b, x0 - m, y0 - m, 1, h + 2 * m, c, lv); P.dith(b, x1 + m - 1, y0 - m, 1, h + 2 * m, c, lv);
    };
    band(6, C.A0, 6); band(5, C.A0, 10); band(4, C.A0, 16); band(3, C.A1, 16); band(2, C.A2, 16);
    P.box(b, x0 - 1, y0 - 1, w + 2, h + 2, C.A4);
    if (w <= 6) { // still a slit: solid light
      P.rect(b, x0, y0, w, h, C.A5);
      P.rect(b, x0 + 1, y0 + 2, Math.max(1, w - 2), Math.max(1, h - 4), C.A6);
      const ch = Math.max(3, Math.round(h * 0.5));
      P.rect(b, x0 + 2, ((y0 + y1) >> 1) - (ch >> 1), Math.max(1, w - 4), ch, C.A8);
    } else {
      P.box(b, x0, y0, w, h, C.A6);
      if (w > 14) { P.vl(b, x0 + 1, y0 + 1, h - 2, C.A5); P.vl(b, x1 - 2, y0 + 1, h - 2, C.A5); P.hl(b, x0 + 1, y0 + 1, w - 2, C.A5); }
    }
    // light spilling on the unseen floor: a fan of bands below the threshold
    if (d.a > 0.6 && y1 < 262) {
      const s = (d.a - 0.6) / 0.4, len = Math.round(40 * s * (1 - d.k));
      for (let i = 0; i < len; i++) {
        const y = y1 + 2 + i, half = (w >> 1) + 1 + Math.round(i * 0.8);
        const c = i < 4 ? C.A3 : i < 12 ? C.A2 : i < 24 ? C.A1 : C.A0;
        const lv = i < 4 ? 16 : i < 8 ? 12 : i < 12 ? 16 : i < 18 ? 12 : i < 24 ? 16 : i < 32 ? 10 : 5;
        P.dith(b, CX - half, y, half * 2 + 1, 1, c, lv);
      }
    }
  }
  g.S1 = { render, door, doorFrame, cursor, CX, CY };
})(typeof window !== 'undefined' ? window : globalThis);
