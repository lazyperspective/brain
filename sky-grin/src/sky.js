// Sky, cumulus clouds, wind wisps and shards.
'use strict';

const Sky = (() => {
  const { S, rnd, srnd, noise1 } = E;
  const TAU = Math.PI * 2;
  const W = 1080, H = 2160;
  const CREAM = '#fdf6e5';

  // ---------- cumulus construction ----------
  // returns circles {x,y,r,d(depth),ink(bool internal line)}
  // contour-hugging lobes: rim scallops along a dome profile + interior fillers + flat-ish base
  function cumulus(cx, by, w, h, seed, n, skew = 0) {
    const cs = [];
    const dome = (u) => Math.pow(Math.max(0, 1 - (2 * u) ** 2), 0.65) * (1 + skew * u) * (0.85 + 0.15 * noise1(u * 6, seed));
    const yTop = (u) => by - h * dome(u);
    // rim lobes
    let u = -0.5;
    let i = 0;
    while (u < 0.5 && i < 60) {
      const dm = dome(u);
      const r = h * (0.09 + 0.17 * rnd(seed, i, 1) ** 1.3) * (0.5 + 0.7 * dm);
      const du = 0.001;
      const sx = w * du * 2, sy = yTop(u + du) - yTop(u - du);
      const L = Math.hypot(sx, sy);
      const nx = -sy / L, ny = sx / L;           // inward normal (pointing down into cloud)
      const x = cx + u * w, y = yTop(u);
      cs.push({ x: x + nx * r * 0.78 * (ny < 0 ? -1 : 1), y: y + Math.abs(ny) * r * 0.78 + (ny < 0 ? 0 : 0), r });
      u += (r * (1.0 + 0.5 * rnd(seed, i, 2))) / w;
      i++;
    }
    // interior fillers
    const nf = Math.max(2, Math.round(w / (h * 0.5)));
    for (let k = 0; k < nf; k++) {
      const uu = (k + 0.5) / nf - 0.5;
      const dm = dome(uu);
      const r = Math.max(h * 0.12, h * dm * 0.42);
      cs.push({ x: cx + uu * w, y: by - h * dm * 0.42, r, fill: 1 });
    }
    // base lobes
    const nb = Math.max(2, Math.round(w / (h * 0.3)));
    for (let k = 0; k < nb; k++) {
      const uu = (k + 0.5 + srnd(seed, k, 9) * 0.3) / nb - 0.5;
      const r = h * (0.1 + 0.1 * rnd(seed, k, 10)) * (0.6 + 0.5 * dome(uu));
      cs.push({ x: cx + uu * w * 0.95, y: by - r * (0.55 + 0.3 * rnd(seed, k, 11)), r, base: 1 });
    }
    // extra mid-body lobes (front puffs)
    for (let k = 0; k < n; k++) {
      const uu = srnd(seed, k, 20) * 0.42;
      const dm = dome(uu);
      const r = h * (0.1 + 0.16 * rnd(seed, k, 21)) * (0.6 + 0.5 * dm);
      cs.push({ x: cx + uu * w, y: by - r - rnd(seed, k, 22) * Math.max(0, h * dm - 2.2 * r), r });
    }
    const top = Math.min(...cs.map((c) => c.y - c.r));
    for (const c of cs) {
      c.d = c.y + c.r * 0.6 + rnd(seed, c.x, c.y) * 30 - (c.fill ? 400 : 0);
      c.ink = c.fill ? 0 : rnd(seed, c.x, 7) < 0.6;
      c.s = rnd(seed, c.x, c.r);
      c.v = Math.max(0, Math.min(1, (c.y - top) / (by - top)));
    }
    return cs;
  }

  function circPoly(c, seed) {
    const n = Math.max(18, Math.round(c.r * TAU / 6));
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const rr = rAt(c, a);
      out.push([c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr]);
    }
    return out;
  }
  const rAt = (c, a) => c.r * (1 + 0.04 * noise1(a * 2.2 + c.s * 50, 77) + 0.015 * Math.sin(a * 5 + c.s * 20) + 0.06 * Math.cos(2 * a) - 0.03 * Math.max(0, Math.sin(a)));
  const inside = (c, x, y, eps = 0) => {
    const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
    return d < rAt(c, Math.atan2(dy, dx)) - eps;
  };

  // draw a cloud group: painter by depth + union silhouette ink
  function drawGroup(cs0, o) {
    const ctx = S.ctx;
    const id0 = S.sid;
    // boil + billow
    const cs = cs0.map((c, i) => ({
      ...c,
      x: c.x + o.dx + srnd(S.draw, id0, i, 1) * 1.2,
      y: c.y + o.dy + srnd(S.draw, id0, i, 2) * 1.2,
      r: c.r * (1 + 0.018 * Math.sin(TAU * o.t + c.s * 9)) + srnd(S.draw, id0, i, 3) * 0.9,
    }));
    S.sid += cs.length + 1;
    const order = cs.map((c, i) => i).sort((a, b) => cs[a].d - cs[b].d);
    const polys = cs.map((c) => circPoly(c));
    // fills
    for (const i of order) {
      const c = cs[i];
      E.fill(polys[i], o.shade);
      const k = 0.16 + 0.62 * c.v ** 1.3 + 0.1 * c.s;
      const sh = { x: c.x - c.r * k * 0.45, y: c.y - c.r * k, r: c.r * (1 - 0.15 * c.v), s: c.s + 0.3 };
      E.clipTo(polys[i], () => E.fill(circPoly(sh), o.cream));
    }
    // internal edges (front lobe tops over back lobes)
    const lw = o.lw ?? 3;
    for (let oi = 0; oi < order.length; oi++) {
      const i = order[oi], c = cs[i];
      if (!c.ink) { S.sid++; continue; }
      const fronts = order.slice(oi + 1).map((j) => cs[j]);
      const backs = order.slice(0, oi).map((j) => cs[j]);
      runs(c, (a) => {
        const x = c.x + Math.cos(a) * rAt(c, a), y = c.y + Math.sin(a) * rAt(c, a);
        if (Math.sin(a) > 0.15) return false;             // only upper arcs
        if (fronts.some((f) => inside(f, x, y, -1))) return false;
        return backs.some((b) => inside(b, x, y, 3));
      }, { w: lw * 0.8, color: o.ink, t0: 22, t1: 22, min: 0.05, minLen: 24 });
    }
    // silhouette
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      const others = cs.filter((_, j) => j !== i);
      runs(c, (a) => {
        const x = c.x + Math.cos(a) * rAt(c, a), y = c.y + Math.sin(a) * rAt(c, a);
        return !others.some((f) => inside(f, x, y, -0.5));
      }, { w: lw, color: o.ink, t0: 10, t1: 10, min: 0.2, hook: 0.09, side: 1, shade: 0.9, minLen: 6 });
    }
  }

  // find angular runs on circle c where pred(angle) holds, brush each
  function runs(c, pred, o) {
    const n = Math.max(36, Math.round(c.r * TAU / 4));
    const ok = [];
    for (let i = 0; i < n; i++) ok.push(pred(i / n * TAU));
    if (ok.every(Boolean)) { strokeArc(c, 0, TAU + 0.3, o); return; }
    let start = ok.findIndex((v) => !v);
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      if (ok[i] && !ok[(i - 1 + n) % n]) {
        let j = i; let len = 0;
        while (ok[j % n] && len < n) { j++; len++; }
        const a0 = i / n * TAU, a1 = j / n * TAU;
        if ((a1 - a0) * c.r >= (o.minLen ?? 0)) strokeArc(c, a0 - (o.hook ?? 0), a1 + (o.hook ?? 0), o);
      }
    }
  }
  function strokeArc(c, a0, a1, o) {
    const pts = [];
    const n = Math.max(3, Math.ceil((a1 - a0) * c.r / 4));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, rr = rAt(c, a);
      pts.push([c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr]);
    }
    // arcs go clockwise in screen space -> outward normal is -left
    E.brushPoly(pts, Object.assign({ press: 0.25 }, o, { side: o.side ? -1 : 0 }));
  }

  // ---------- cloud layout (static, built once) ----------
  const groups = [];
  function G(cs, o) { groups.push({ cs, ...o }); }
  // palette by altitude: higher = warmer cream / lavender, lower = bluer
  const P_hi = { cream: CREAM, shade: '#cbc7e6', ink: '#5d5469' };
  const P_mid = { cream: '#fbf5e8', shade: '#b9c1e6', ink: '#4f5878' };
  const P_lo = { cream: '#f6f4ec', shade: '#a9bde8', ink: '#3f5779' };

  // top-left high cloud partly off-frame
  G(cumulus(110, 560, 600, 330, 11, 4, 0.3), { ...P_hi, amp: 7, ph: 0.1, lw: 3 });
  // small top-right puff
  G(cumulus(910, 330, 300, 150, 23, 2, -0.2), { ...P_hi, amp: 5, ph: 0.5, lw: 2.6 });
  // towering cumulus behind the kid
  G(cumulus(700, 1500, 960, 900, 31, 8, -0.15), { ...P_mid, amp: 8, ph: 0.3, lw: 3.2 });
  G(cumulus(170, 1380, 600, 470, 37, 5, 0.2), { ...P_mid, amp: 9, ph: 0.7, lw: 3.2 });
  // lower front bank
  G(cumulus(140, 1980, 820, 480, 41, 5, 0.1), { ...P_lo, amp: 10, ph: 0.9, lw: 3.4 });
  G(cumulus(960, 2020, 820, 520, 43, 5, -0.1), { ...P_lo, amp: 10, ph: 0.2, lw: 3.4 });

  // ---------- wind wisps & shards ----------
  const WIND = [Math.cos(-0.32), Math.sin(-0.32)]; // blowing right & slightly up
  const wisps = [];
  for (let i = 0; i < 6; i++) {
    wisps.push({ ph: rnd(5, i), y0: 250 + i * 330 + srnd(6, i) * 90, len: 260 + 260 * rnd(7, i), wd: 16 + 14 * rnd(8, i), k: 1, curve: srnd(9, i) * 0.3, seed: i, lobes: 2 + Math.floor(rnd(10, i) * 3) });
  }
  const shards = [];
  for (let i = 0; i < 26; i++) {
    shards.push({ ph: rnd(15, i), y0: 80 + rnd(16, i) * 1900, sz: 10 + 22 * rnd(17, i) ** 1.6, k: rnd(18, i) < 0.4 ? 2 : 1, spin: srnd(19, i), seed: i, nv: 4 + Math.floor(rnd(20, i) * 3) });
  }
  const specks = [];
  for (let i = 0; i < 30; i++) specks.push({ ph: rnd(25, i), y0: rnd(26, i) * 2000, sz: 2 + 3 * rnd(27, i), k: 1 + Math.floor(rnd(28, i) * 2) });

  function flyPos(it, t, span = 1700) {
    const u = ((it.ph + t * it.k) % 1 + 1) % 1;
    const d = -350 + u * span;
    return [d * WIND[0], it.y0 + d * WIND[1] + 0.35 * d * 0, u];
  }

  // wind wisp: a torn cloud tuft (lobed head) dragging a long needle tail
  function drawWisp(wp, t) {
    const [x, y] = flyPos(wp, t, 2100);
    const ang = Math.atan2(WIND[1], WIND[0]) + wp.curve * 0.25;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const L2W = (lx, ly) => [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
    const wd = wp.wd;
    // tail: tapered ribbon behind the head, gently S-curved and fluttering
    const n = 10, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n; // 0 = tail tip, 1 = head
      const lx = (u - 1) * wp.len;
      const ly = wp.curve * wp.len * 0.35 * Math.sin(u * Math.PI) + 6 * Math.sin(TAU * (2 * t + u + wp.seed * 0.37));
      const w = wd * (0.02 + 0.98 * Math.pow(u, 1.25));
      top.push(L2W(lx, ly - w * 0.9));
      bot.push(L2W(lx, ly + w * 0.45));
    }
    const tail = E.shape([[...top[0], 1], ...top.slice(2), ...bot.slice(2).reverse()], 1.2);
    E.fill(tail, CREAM);
    E.clipTo(tail, () => E.fill([...bot, ...bot.map((p, i) => [p[0] * 0.6 + top[i][0] * 0.4, p[1] * 0.6 + top[i][1] * 0.4]).reverse()], '#c8c6e6', false));
    E.outline(tail, { w: 2.4, color: '#5d5469', pieces: 2, t0: 50, t1: 30, min: 0.03, gap: 22 });
    // head: a few lobes, rendered exactly like the big cumulus
    const cs = [];
    for (let k = 0; k < wp.lobes; k++) {
      const r = wd * (0.55 + 0.5 * rnd(40, wp.seed, k));
      const [cx, cy] = L2W(-k * wd * 0.8 + wd * 0.2, -r * 0.35 - (k % 2) * wd * 0.3);
      cs.push({ x: cx, y: cy, r, d: k === 0 ? 2 : 1, ink: k === 0, s: rnd(41, wp.seed, k), v: 0.35 });
    }
    drawGroup(cs, { dx: 0, dy: 0, t, cream: CREAM, shade: '#c8c6e6', ink: '#5d5469', lw: 2.5 });
  }

  function drawShard(sd, t) {
    const [x, y] = flyPos(sd, t, 1700);
    const rot = sd.spin * 0.6 * Math.sin(TAU * t) + Math.atan2(WIND[1], WIND[0]) + srnd(33, sd.seed) * 0.4;
    const pts = [];
    const nv = sd.nv + 3;
    for (let i = 0; i < nv; i++) {
      const a = i / nv * TAU;
      let r = sd.sz * (0.55 + 0.35 * rnd(31, sd.seed, i));
      let sharp = 0;
      if (i === 0) { r = sd.sz * (1.5 + rnd(34, sd.seed)); sharp = 1; }           // trailing point
      else if (rnd(32, sd.seed, i) < 0.25) { r *= 1.35; sharp = 1; }
      const lx = -Math.cos(a) * r * 1.2, ly = Math.sin(a) * r * 0.8;
      pts.push([x + lx * Math.cos(rot) - ly * Math.sin(rot), y + lx * Math.sin(rot) + ly * Math.cos(rot), sharp]);
    }
    const poly = E.shape(pts, 0.8);
    E.fill(poly, '#c5c4e4');
    E.clipTo(poly, () => E.fill(poly.map((p) => [p[0] - sd.sz * 0.15, p[1] - sd.sz * 0.42]), CREAM));
    if (sd.sz > 12) E.outline(poly, { w: sd.sz > 20 ? 2.6 : 2, color: '#5d5469', pieces: 1, t0: 8, t1: 8, min: 0.2, gap: rnd(35, sd.seed) < 0.5 ? 8 : 0 });
  }

  function draw(t) {
    const ctx = S.ctx;
    // the one gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a63d8');
    g.addColorStop(0.35, '#1489ee');
    g.addColorStop(0.7, '#3cb8f4');
    g.addColorStop(1, '#6ad6f6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    S.sid = 1000;
    // specks
    for (const sp of specks) {
      const [x, y] = flyPos(sp, t, 1700);
      ctx.fillStyle = 'rgba(255,252,240,0.85)';
      ctx.beginPath(); ctx.ellipse(x, y, sp.sz * 1.3, sp.sz * 0.8, -0.3, 0, TAU); ctx.fill();
    }
    groups.forEach((gp, i) => {
      S.sid = 2000 + i * 400;
      drawGroup(gp.cs, { ...gp, t, dx: gp.amp * Math.sin(TAU * (t + gp.ph)), dy: 0.3 * gp.amp * Math.cos(TAU * (t + gp.ph)) });
    });
    wisps.forEach((wp, i) => { S.sid = 6000 + i * 50; drawWisp(wp, t); });
    shards.forEach((sd, i) => { if (i % 2 === 0) { S.sid = 8000 + i * 20; drawShard(sd, t); } });
  }
  function drawFront(t) {
    shards.forEach((sd, i) => { if (i % 2 === 1) { S.sid = 8000 + i * 20; drawShard(sd, t); } });
  }

  return { draw, drawFront, cumulus, drawGroup };
})();
