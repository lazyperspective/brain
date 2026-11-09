// The lit faces of the sign, painted in 2D in screen space (the sign plane faces the camera, so its projection is a
// plain scale). One grey channel per light source: the diffuser face with a lighter centre, the LED rows (tubes) and
// their modules showing through, panel joints, the dark trim cap at the edge, a tired module or two.
// Returns two RGBA8 arrays (sources 0-3 and 4-7), rows bottom-up for WebGL.
(function () {
  const NS = window.NS || (window.NS = {});

  NS.paintEmission = function (cam, layout) {
    const S = NS.SIGN, k = cam.f / S.Zs; // pixels per metre on the sign plane
    const X = (x) => cam.cx + k * x, Y = (y) => cam.cy - k * y;
    const pad = Math.ceil(1.5 * k);
    const ox = Math.max(0, Math.floor(X(layout.x0)) - pad), oy = Math.max(0, Math.floor(Y(Math.max(layout.y1, layout.emY1))) - pad);
    const rw = Math.min(cam.W, Math.ceil(X(layout.x1)) + pad) - ox, rh = Math.min(cam.H, Math.ceil(Y(Math.min(layout.y0, layout.emY0))) + pad) - oy;
    const mk = () => { const c = document.createElement('canvas'); c.width = rw; c.height = rh; return c; };
    const main = mk(), tmp = mk(), tmp2 = mk();
    const g = main.getContext('2d', { willReadFrequently: true }), t = tmp.getContext('2d'), t2 = tmp2.getContext('2d');
    const out = [new Uint8Array(cam.W * cam.H * 4), new Uint8Array(cam.W * cam.H * 4)];
    const rnd = NS.mulberry32(777);

    const polyPath = (c, p) => { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(X(x) - ox, Y(y) - oy) : c.moveTo(X(x) - ox, Y(y) - oy))); c.closePath(); };
    const linePath = (c, p) => { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(X(x) - ox, Y(y) - oy) : c.moveTo(X(x) - ox, Y(y) - oy))); };
    // all panels of a source as ONE path, every polygon wound the same way: the nonzero fill is their union, with no
    // antialiasing seams where panels meet
    const ccw = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a > 0 ? p : p.slice().reverse(); };
    const fillAll = (c, src, style) => {
      c.fillStyle = style; c.beginPath();
      src.polys.forEach((p0) => { ccw(p0).forEach(([x, y], i) => (i ? c.lineTo(X(x) - ox, Y(y) - oy) : c.moveTo(X(x) - ox, Y(y) - oy))); c.closePath(); });
      c.fill('nonzero');
    };
    const maskC = mk(), mg = maskC.getContext('2d');
    const clipTo = (c, src) => {
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = 'source-over'; mg.filter = 'none'; mg.globalAlpha = 1; mg.clearRect(0, 0, rw, rh);
      fillAll(mg, src, '#fff');
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'destination-in'; c.drawImage(maskC, 0, 0); c.restore();
    };
    const clear = (c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, rw, rh); };
    const clearT = (c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, rw, rh); };
    const grey = (v) => { const q = Math.max(0, Math.min(255, Math.round(v * 255))); return `rgb(${q},${q},${q})`; };

    layout.sources.forEach((src, si) => {
      clear(g);
      // 1. the diffuser face: each panel a touch different
      fillAll(g, src, grey(0.62 * (0.95 + 0.07 * rnd())));
      // 2. lighter centre: blurred coverage, kept inside the face
      clearT(t); fillAll(t, src, '#fff');
      clearT(t2); t2.filter = `blur(${(0.34 * k).toFixed(2)}px)`; t2.drawImage(tmp, 0, 0); t2.filter = 'none'; clipTo(t2, src);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.30; g.drawImage(tmp2, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // 3. LED rows behind the diffuser: a soft band along each tube, and the modules as faint beads
      clearT(t); t.strokeStyle = '#fff'; t.lineCap = 'round'; t.lineJoin = 'round';
      t.lineWidth = 0.34 * k; t.filter = `blur(${(0.16 * k).toFixed(2)}px)`;
      src.tubes.forEach((p) => { linePath(t, p); t.stroke(); });
      t.filter = 'none'; clipTo(t, src);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.24; g.drawImage(tmp, 0, 0);
      clearT(t); t.fillStyle = '#fff'; t.filter = `blur(${Math.max(0.6, 0.05 * k).toFixed(2)}px)`;
      src.tubes.forEach((p) => {
        for (let i = 0; i + 1 < p.length; i++) {
          const [ax, ay] = p[i], [bx, by] = p[i + 1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / 0.31));
          for (let j = 0; j < n; j++) {
            const u = (j + 0.5) / n;
            t.beginPath(); t.arc(X(ax + (bx - ax) * u) - ox, Y(ay + (by - ay) * u) - oy, Math.max(0.6, 0.075 * k), 0, Math.PI * 2); t.fill();
          }
        }
      });
      t.filter = 'none'; clipTo(t, src);
      g.globalAlpha = 0.10; g.drawImage(tmp, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // 5. panel joints: every panel outline (the inner ones read as seams), and cross joints along long strokes
      g.strokeStyle = 'rgba(0,0,0,0.42)'; g.lineWidth = Math.max(0.7, 0.035 * k);
      // straight-stroke letters: every panel outline; the D: its stem and bars only; the eye: three joints along each turn
      if (src.polys.length > 1 && src.polys.length < 6) src.polys.forEach((p) => { polyPath(g, p); g.stroke(); });
      else if (src.name === 'D') src.polys.slice(0, 3).forEach((p) => { polyPath(g, p); g.stroke(); });
      else if (src.polys.length >= 6) { const n = src.polys.length; [0.27, 0.55, 0.8].forEach((f) => { const p = src.polys[Math.floor(f * n)]; g.beginPath(); g.moveTo(X(p[0][0]) - ox, Y(p[0][1]) - oy); g.lineTo(X(p[3][0]) - ox, Y(p[3][1]) - oy); g.stroke(); }); }
      src.tubes.forEach((p) => {
        if (p.length !== 2) return;
        const [ax, ay] = p[0], [bx, by] = p[1], L = Math.hypot(bx - ax, by - ay);
        if (L < 4) return;
        const nx = -(by - ay) / L, ny = (bx - ax) / L;
        for (const u of [0.36, 0.69]) {
          const cx = ax + (bx - ax) * u, cy = ay + (by - ay) * u;
          g.beginPath(); g.moveTo(X(cx - nx * 2) - ox, Y(cy - ny * 2) - oy); g.lineTo(X(cx + nx * 2) - ox, Y(cy + ny * 2) - oy);
          g.strokeStyle = 'rgba(0,0,0,0.26)'; g.stroke();
        }
      });
      // tired LED modules: a dim patch on the A's left leg and a weak module in the V
      const blot = (x, y, r, a) => { const gr = g.createRadialGradient(X(x) - ox, Y(y) - oy, 0, X(x) - ox, Y(y) - oy, r * k); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, rw, rh); };
      if (src.name === 'A') { const b = src.box; blot(b[0] + 0.21 * (b[2] - b[0]), b[1] + 0.36 * (b[3] - b[1]), 1.1, 0.38); }
      if (src.name === 'V') { const b = src.box; blot(b[0] + 0.78 * (b[2] - b[0]), b[1] + 0.62 * (b[3] - b[1]), 0.9, 0.22); }
      // 6. trim cap and the bright rim just inside it, from a tightly blurred union mask (per pixel, below)
      clearT(t); fillAll(t, src, '#fff');
      clearT(t2); t2.filter = `blur(${Math.max(0.5, 0.07 * k).toFixed(2)}px)`; t2.drawImage(tmp, 0, 0); t2.filter = 'none';
      const md = t2.getImageData(0, 0, rw, rh).data;
      clipTo(g, src);
      // pack into the channel (bottom-up rows)
      const d = g.getImageData(0, 0, rw, rh).data, arr = out[si >> 2], ch = si & 3;
      const sm = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
      for (let y = 0; y < rh; y++) {
        const ry = cam.H - 1 - (oy + y);
        if (ry < 0 || ry >= cam.H) continue;
        for (let x = 0; x < rw; x++) {
          const q = (y * rw + x) * 4;
          let v = d[q];
          if (!v) continue;
          const f = md[q + 3] / 255;                       // ~0.5 on the outline, 1 inside
          v *= (0.30 + 0.70 * sm(0.50, 0.80, f)) * (1 + 0.10 * Math.exp(-Math.pow((f - 0.90) / 0.06, 2)));
          arr[(ry * cam.W + ox + x) * 4 + ch] = Math.min(255, Math.round(v));
        }
      }
    });
    return out;
  };
})();
