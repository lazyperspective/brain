/* ink.js: batched pen strokes with per-segment colour/weight, hand wobble and
   tapered ends. Lines are collected into buckets keyed by (colour, width) and
   flushed as a handful of big paths, which keeps millions of segments fast. */
(function () {
  'use strict';
  const LW = window.LW;

  class Ink {
    constructor(seed = 7) {
      this.noise = new LW.Noise(seed);
      this.noise2 = new LW.Noise(seed + 101);
      this.colors = [];
      this.cmap = new Map();
      this.buckets = new Map();
      this.order = [];
      this.fills = [];
      this.wobble = 0.9; // px amplitude of hand tremor
      this.wfreq = 1 / 36;
      this.segCount = 0;
    }
    col(c) {
      const s = typeof c === 'string' ? c : LW.rgb(c);
      let i = this.cmap.get(s);
      if (i === undefined) {
        i = this.colors.length;
        this.colors.push(s);
        this.cmap.set(s, i);
      }
      return i;
    }
    // style code: colour index * 512 + width in 1/16 px
    st(ci, w) {
      const q = Math.max(1, Math.min(511, Math.round(w * 16)));
      return ci * 512 + q;
    }
    _bucket(code) {
      let b = this.buckets.get(code);
      if (!b) {
        b = [];
        this.buckets.set(code, b);
        this.order.push(code);
      }
      return b;
    }
    wob(x, y, amp) {
      if (!amp) return [x, y];
      const f = this.wfreq;
      return [x + this.noise.n2(x * f, y * f) * amp, y + this.noise2.n2(x * f, y * f) * amp];
    }
    /* pts: array of [x,y]; style: code number or fn(x,y,i)->code|-1
       opts: { taper: px length of end taper (0 = none), wobble: amp, minScale } */
    line(pts, style, opts = {}) {
      const n = pts.length;
      if (n < 2) return;
      const amp = opts.wobble === undefined ? this.wobble : opts.wobble;
      const taper = opts.taper === undefined ? 10 : opts.taper;
      const minScale = opts.minScale === undefined ? 0.3 : opts.minScale;
      const P = new Array(n);
      for (let i = 0; i < n; i++) P[i] = this.wob(pts[i][0], pts[i][1], amp);
      const codes = new Int32Array(n - 1);
      const fn = typeof style === 'function';
      for (let i = 0; i < n - 1; i++) {
        if (fn) {
          const mx = (pts[i][0] + pts[i + 1][0]) * 0.5, my = (pts[i][1] + pts[i + 1][1]) * 0.5;
          codes[i] = style(mx, my, i);
        } else codes[i] = style;
      }
      // runs
      let i = 0;
      while (i < n - 1) {
        if (codes[i] < 0) { i++; continue; }
        let j = i;
        while (j < n - 1 && codes[j] >= 0) j++;
        // run segments i..j-1
        this._run(P, codes, i, j, taper, minScale);
        i = j;
      }
    }
    _run(P, codes, a, b, taper, minScale) {
      const cnt = b - a;
      let lens = null, total = 0;
      if (taper > 0) {
        lens = new Float32Array(cnt + 1);
        for (let k = 0; k < cnt; k++) {
          const p = P[a + k], q = P[a + k + 1];
          total += Math.hypot(q[0] - p[0], q[1] - p[1]);
          lens[k + 1] = total;
        }
      }
      let cur = -1, sub = null;
      for (let k = 0; k < cnt; k++) {
        let code = codes[a + k];
        if (taper > 0) {
          const mid = (lens[k] + lens[k + 1]) * 0.5;
          const t = Math.min(1, mid / taper, (total - mid) / taper);
          if (t < 1) {
            const ci = Math.floor(code / 512);
            const w = (code % 512) / 16;
            code = this.st(ci, w * (minScale + (1 - minScale) * Math.sqrt(Math.max(0, t))));
          }
        }
        const p = P[a + k], q = P[a + k + 1];
        if (code !== cur) {
          sub = [p[0], p[1]];
          this._bucket(code).push(sub);
          cur = code;
        }
        sub.push(q[0], q[1]);
        this.segCount++;
      }
    }
    // a filled ink shape (crevices, solid shadows) drawn before strokes
    fill(pts, color, wobble) {
      const amp = wobble === undefined ? this.wobble : wobble;
      const P = pts.map((p) => this.wob(p[0], p[1], amp));
      this.fills.push({ pts: P, color: typeof color === 'string' ? color : LW.rgb(color) });
    }
    fillPath(path, color) {
      this.fills.push({ path, color: typeof color === 'string' ? color : LW.rgb(color) });
    }
    flush(ctx) {
      ctx.save();
      for (const f of this.fills) {
        ctx.fillStyle = f.color;
        if (f.path) ctx.fill(f.path);
        else {
          ctx.beginPath();
          ctx.moveTo(f.pts[0][0], f.pts[0][1]);
          for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // thicker strokes first so fine lines sit on top
      const codes = this.order.slice().sort((p, q) => (q % 512) - (p % 512));
      for (const code of codes) {
        const subs = this.buckets.get(code);
        ctx.strokeStyle = this.colors[Math.floor(code / 512)];
        ctx.lineWidth = (code % 512) / 16;
        let cnt = 0;
        ctx.beginPath();
        for (const s of subs) {
          ctx.moveTo(s[0], s[1]);
          for (let k = 2; k < s.length; k += 2) ctx.lineTo(s[k], s[k + 1]);
          cnt += s.length;
          if (cnt > 60000) {
            ctx.stroke();
            ctx.beginPath();
            cnt = 0;
          }
        }
        ctx.stroke();
      }
      ctx.restore();
      this.buckets.clear();
      this.order = [];
      this.fills = [];
    }
  }
  LW.Ink = Ink;
})();
