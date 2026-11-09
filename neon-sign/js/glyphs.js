// Letterforms and emblem of the rooftop sign, drawn here from straight strokes and arcs (no font).
// Units: a glyph is designed in "cap units" (cap height 1, origin at its bottom-left), then placed on the sign plane
// in metres. Every glyph is a union of convex polygons (one lightbox panel each) plus "tubes": the centre lines of the
// LED rows inside the box, which show through the diffuser as slightly brighter bands.
//
// Light sources (one brightness channel each, shared by the face, the glow, the spill, the haze and the reflections):
//   0 N   1 V   2 I   3 D   4 I   5 A   6 emblem, outer turn of the spiral   7 emblem, inner turn and pupil
(function () {
  const NS = window.NS || (window.NS = {});

  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  // ring sector as convex quads
  function arcBand(cx, cy, r0, r1, a0, a1, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
      out.push([[cx + r1 * Math.cos(t0), cy + r1 * Math.sin(t0)], [cx + r1 * Math.cos(t1), cy + r1 * Math.sin(t1)],
        [cx + r0 * Math.cos(t1), cy + r0 * Math.sin(t1)], [cx + r0 * Math.cos(t0), cy + r0 * Math.sin(t0)]]);
    }
    return out;
  }
  function arcLine(cx, cy, r, a0, a1, n) {
    const p = [];
    for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    return p;
  }

  // A bold, wide geometric sans. Stems 0.21-0.22 of the cap height.
  const LETTERS = {
    N: { w: 1.0, polys: [rect(0, 0, 0.215, 1), rect(0.785, 0, 1, 1), [[0, 1], [0.275, 1], [1, 0], [0.725, 0]]],
      tubes: [[[0.107, 0.07], [0.107, 0.93]], [[0.893, 0.07], [0.893, 0.93]], [[0.2, 0.86], [0.8, 0.14]]] },
    V: { w: 1.08, polys: [[[0, 1], [0.275, 1], [0.68, 0], [0.40, 0]], [[0.805, 1], [1.08, 1], [0.68, 0], [0.40, 0]]],
      tubes: [[[0.14, 0.92], [0.54, 0.08]], [[0.94, 0.92], [0.54, 0.08]]] },
    I: { w: 0.22, polys: [rect(0, 0, 0.22, 1)], tubes: [[[0.11, 0.07], [0.11, 0.93]]] },
    D: { w: 1.0, polys: [rect(0, 0, 0.22, 1), rect(0.2, 0.785, 0.5, 1), rect(0.2, 0, 0.5, 0.215)].concat(arcBand(0.5, 0.5, 0.285, 0.5, -Math.PI / 2, Math.PI / 2, 18)),
      tubes: [[[0.11, 0.07], [0.11, 0.93]], [[0.16, 0.893], [0.5, 0.893]].concat(arcLine(0.5, 0.5, 0.393, Math.PI / 2, -Math.PI / 2, 18)).concat([[0.16, 0.107]])] },
    A: { w: 1.12, polys: [[[0, 0], [0.28, 0], [0.68, 1], [0.44, 1]], [[0.84, 0], [1.12, 0], [0.68, 1], [0.44, 1]], [[0.34, 0.18], [0.78, 0.18], [0.705, 0.37], [0.415, 0.37]]],
      tubes: [[[0.15, 0.08], [0.56, 0.93]], [[0.97, 0.08], [0.56, 0.93]], [[0.39, 0.275], [0.73, 0.275]]] },
  };

  // The emblem: an eye drawn by one spiralling ribbon (an almond outline that keeps turning inward) and a pupil.
  // Height 1, width 1.3, in emblem units. The almond: x = W a cos(th), y = H a sin(th) |sin(th)|^0.32 (pointed corners).
  function emblem() {
    const W = 0.63, Hh = 0.44, cx = 0.65, cy = 0.5;
    const th0 = Math.PI, th1 = -Math.PI * (NS.EYE_TURN || 1.72), k = Math.log(1 / 0.6) / (2 * Math.PI);
    const pt = (th, a) => { const s = Math.sin(th); return [cx + W * a * Math.cos(th), cy + Hh * a * s * Math.pow(Math.abs(s), 0.32)]; };
    const half = (th) => (NS.EYE_HALF || 0.058) * (1 - 0.18 * (th0 - th) / (th0 - th1));
    const turns = [[], []], tubes = [[], []];
    const N = 120;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const th = th0 + (th1 - th0) * i / N, a = Math.exp(-k * (th0 - th));
      const p = pt(th, a), q = pt(th - 0.01, Math.exp(-k * (th0 - th + 0.01)));
      let tx = q[0] - p[0], ty = q[1] - p[1];
      const l = Math.hypot(tx, ty); tx /= l; ty /= l;
      const nx = -ty, ny = tx, hw = half(th);
      const cur = { o: [p[0] + nx * hw, p[1] + ny * hw], i: [p[0] - nx * hw, p[1] - ny * hw], c: p };
      const which = th > -Math.PI ? 0 : 1;
      if (prev) turns[which].push([prev.o, cur.o, cur.i, prev.i]);
      tubes[which].push(p);
      prev = cur;
    }
    tubes[1].unshift(tubes[0][tubes[0].length - 1]);
    // pupil: a disc set a little up and toward the inner corner, "looking"
    const pc = [cx + 0.035, cy + 0.03], pr = NS.EYE_PUPIL || 0.105, disc = [];
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; disc.push([pc[0] + pr * Math.cos(a), pc[1] + pr * Math.sin(a)]); }
    turns[1].push(disc);
    NS.EYE_PUPIL_C = pc;
    return { w: 1.3, outer: { polys: turns[0], tubes: [tubes[0]] }, inner: { polys: turns[1], tubes: NS.EYE_NO_PUPIL_TUBE ? [tubes[1]] : [tubes[1], [[pc[0] - 0.05, pc[1]], [pc[0] + 0.05, pc[1]]]] } };
  }

  // Lay the sign out on its plane (metres). Cap height capH, baseline y0, centred on x = xc.
  NS.layoutSign = function (o) {
    const capH = o.capH, y0 = o.y0, track = 0.155, emH = o.emblemH, gap = o.emblemGap;
    const word = ['N', 'V', 'I', 'D', 'I', 'A'];
    let wordW = 0;
    word.forEach((c, i) => { wordW += LETTERS[c].w + (i ? track : 0); });
    wordW *= capH;
    const em = emblem(), emW = em.w * emH;
    const total = emW + gap + wordW, x0 = o.xc - total / 2;
    const sources = [];
    const place = (polys, tubes, ox, oy, s) => ({
      polys: polys.map((p) => p.map(([x, y]) => [ox + x * s, oy + y * s])),
      tubes: tubes.map((p) => p.map(([x, y]) => [ox + x * s, oy + y * s])),
    });
    let x = x0 + emW + gap;
    word.forEach((c, i) => {
      const L = LETTERS[c];
      const s = place(L.polys, L.tubes, x, y0, capH);
      s.name = c + (c === 'I' ? (i === 2 ? '1' : '2') : '');
      s.box = [x, y0, x + L.w * capH, y0 + capH];
      sources.push(s);
      x += (L.w + track) * capH;
    });
    const ey = y0 + capH / 2 - emH / 2;
    const so = place(em.outer.polys, em.outer.tubes, x0, ey, emH); so.name = 'eye-outer'; so.box = [x0, ey, x0 + emW, ey + emH];
    const si = place(em.inner.polys, em.inner.tubes, x0, ey, emH); si.name = 'eye-inner'; si.box = [x0 + emW * 0.2, ey + emH * 0.2, x0 + emW * 0.8, ey + emH * 0.8];
    sources.push(so, si);
    return { sources, x0, x1: x0 + total, y0, y1: y0 + capH, emY0: ey, emY1: ey + emH };
  };

  const polyArea = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
  const centroid = (p) => { let x = 0, y = 0; p.forEach((q) => { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; };

  // Light sample points of a source: points along its tubes (where the light is), weighted by the panel area they
  // stand for. At most maxN points per source.
  NS.samplePoints = function (src, maxN, z) {
    let area = 0;
    src.polys.forEach((p) => (area += polyArea(p)));
    let len = 0;
    const segs = [];
    src.tubes.forEach((t) => { for (let i = 0; i + 1 < t.length; i++) { const l = Math.hypot(t[i + 1][0] - t[i][0], t[i + 1][1] - t[i][1]); segs.push([t[i], t[i + 1], l]); len += l; } });
    const n = Math.max(2, Math.min(maxN, Math.round(len / 1.1)));
    const pts = [];
    for (let k = 0; k < n; k++) {
      let d = (k + 0.5) / n * len;
      for (const [a, b, l] of segs) { if (d <= l) { const u = d / l; pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, z, area / n]); break; } d -= l; }
    }
    return pts;
  };
  NS.polyArea = polyArea;
  NS.centroid = centroid;
})();
