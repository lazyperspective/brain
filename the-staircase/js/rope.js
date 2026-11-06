// THE STAIRCASE - ropes: chains of true catenaries between anchor points (climber's waist, each human's grip, a tail
// lying on the steps), resampled into one smooth tube. Points that would sink into a tread are lifted onto it, so a
// slack rope drapes over the step edges. Each ring of the tube carries its own path coordinate and is folded into the
// physical lap by itself, so a rope can run straight across the hidden seam.
(function () {
  const S = window.STAIR, U = S.U, G = S.G, ST = S.stairs, T3 = THREE, PAL = S.PAL;

  // catenary between a and b (3D, gravity -y) with arc length len; n+1 points into out (flat xyz), starting at index o
  function catenary(a, b, len, n, out, o) {
    const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
    const hd = Math.hypot(dx, dz);
    const chord = Math.hypot(hd, dy);
    if (len <= chord * 1.0005 || hd < 1e-4) {
      // straight (taut) or vertical: a straight line, with a sag-shaped dip for a vertical slack drop
      for (let i = 0; i <= n; i++) { const u = i / n; out[(o + i) * 3] = a.x + dx * u; out[(o + i) * 3 + 1] = a.y + dy * u; out[(o + i) * 3 + 2] = a.z + dz * u; }
      return;
    }
    // solve sqrt(len^2 - dy^2) = 2 A sinh(hd / (2 A)) for A
    const target = Math.sqrt(len * len - dy * dy) / hd;           // = sinh(x)/x with x = hd / (2A)
    let lo = 1e-6, hi = 50;
    for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (Math.sinh(m) / m < target) lo = m; else hi = m; }
    const x = (lo + hi) / 2, A = hd / (2 * x);
    // vertex offset: y(t) = A cosh((t - t0)/A) + c over t in [0, hd]
    const t0 = hd / 2 - A * Math.atanh(dy / len);
    const c = a.y - A * Math.cosh((0 - t0) / A);
    const ux = dx / hd, uz = dz / hd;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * hd;
      out[(o + i) * 3] = a.x + ux * t; out[(o + i) * 3 + 1] = A * Math.cosh((t - t0) / A) + c; out[(o + i) * 3 + 2] = a.z + uz * t;
    }
  }

  class Rope {
    constructor(scene, rings = 120, radius = 0.042) {
      const tex = (() => {           // braided rope: diagonal stripes
        const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 16);
        g.strokeStyle = 'rgba(150,90,40,0.38)'; g.lineWidth = 3;
        for (let k = -2; k < 10; k++) { g.beginPath(); g.moveTo(k * 8, 0); g.lineTo(k * 8 + 10, 16); g.stroke(); }
        const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.colorSpace = T3.SRGBColorSpace; t.repeat.set(30, 1); return t;
      })();
      this.mat = G.toon({ color: PAL.rope, rim: 0.5 });
      this.mat.map = tex;
      this.tube = new G.Tube(rings, 8, this.mat);
      G.reg(this.tube.mesh, { line: 0.75 });
      scene.add(this.tube.mesh);
      this.rings = rings; this.radius = radius;
      this.raw = new Float32Array(4096 * 3); this.rawS = new Float32Array(4096);
      this.P = new Float32Array(rings * 3); this.R = new Float32Array(rings); this.SH = new Float32Array(rings * 3); this.Sv = new Float32Array(rings);
    }
    // anchors: [{x,y,z,s}] ; lens: arc length per span (>= chord, or null for chord*slack) ; J0,J1 step range for ground
    update(anchors, lens, J0, J1, opts = {}) {
      const raw = this.raw, rawS = this.rawS, LAP = ST.LAP;
      let n = 0;
      for (let k = 0; k < anchors.length - 1; k++) {
        const a = anchors[k], b = anchors[k + 1];
        const chord = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        const seg = Math.max(2, Math.ceil(chord * 22));
        let len = lens[k]; if (len == null) len = chord * 1.01; len = Math.max(len, chord);
        catenary(a, b, len, seg, raw, n);
        for (let i = 0; i <= seg; i++) rawS[n + i] = U.lerp(a.s, b.s, i / seg);
        n += seg + (k < anchors.length - 2 ? 0 : 1);
        if (k < anchors.length - 2) { /* shared point: the next span starts at b */ }
      }
      // ground: lift points onto treads (with the rope radius)
      const r = this.radius;
      for (let i = 0; i < n; i++) {
        const y0 = ST.treadAt(raw[i * 3], raw[i * 3 + 2], J0, J1);
        if (y0 !== null && raw[i * 3 + 1] < y0 + r) raw[i * 3 + 1] = y0 + r;
      }
      // light smoothing (keeps draped corners round)
      for (let pass = 0; pass < 2; pass++) for (let i = 1; i < n - 1; i++) for (let c = 0; c < 3; c++) {
        const v = (raw[(i - 1) * 3 + c] + 2 * raw[i * 3 + c] + raw[(i + 1) * 3 + c]) / 4;
        if (c === 1) { const y0 = ST.treadAt(raw[i * 3], raw[i * 3 + 2], J0, J1); raw[i * 3 + 1] = y0 !== null ? Math.max(v, y0 + r) : v; } else raw[i * 3 + c] = v;
      }
      // resample by arc length into the tube rings
      const cum = new Float32Array(n); for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(raw[i * 3] - raw[i * 3 - 3], raw[i * 3 + 1] - raw[i * 3 - 2], raw[i * 3 + 2] - raw[i * 3 - 1]);
      const total = cum[n - 1];
      let j = 0;
      for (let i = 0; i < this.rings; i++) {
        const d = (i / (this.rings - 1)) * total;
        while (j < n - 2 && cum[j + 1] < d) j++;
        const u = cum[j + 1] > cum[j] ? (d - cum[j]) / (cum[j + 1] - cum[j]) : 0;
        for (let c = 0; c < 3; c++) this.P[i * 3 + c] = U.lerp(raw[j * 3 + c], raw[(j + 1) * 3 + c], u);
        const sv = U.lerp(rawS[j], rawS[j + 1], u);
        const k = ST.fold(sv);
        this.SH[i * 3] = -k * LAP.x; this.SH[i * 3 + 1] = -k * LAP.y; this.SH[i * 3 + 2] = -k * LAP.z;
        const endTaper = Math.min(1, (i + 0.5) / 2.5, (this.rings - 0.5 - i) / 2.5);
        this.R[i] = r * (opts.thin ? opts.thin : 1) * (0.7 + 0.3 * endTaper);
      }
      this.tube.update(this.P, this.R, this.SH);
      this.mat.map.repeat.set(Math.max(1, total * 7), 1);
      this.length = total;
      return total;
    }
    pointAt(frac, out) { const i = Math.min(this.rings - 1, Math.max(0, Math.round(frac * (this.rings - 1)))); out.x = this.P[i * 3]; out.y = this.P[i * 3 + 1]; out.z = this.P[i * 3 + 2]; return out; }
  }

  S.rope = { Rope, catenary };
})();
