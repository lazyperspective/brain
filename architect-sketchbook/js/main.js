(function () {
  'use strict';
  const S = Sketch, W = S.W, H = S.H;
  const stage = document.getElementById('stage');
  const paperC = document.getElementById('paper');
  const inkC = document.getElementById('ink');
  const grain = document.getElementById('grain');
  const ictx = inkC.getContext('2d');
  const pctx = paperC.getContext('2d');

  const SCENES = window.SCENES || []; SCENES.forEach((s, n) => { s.index = n; });
  const TOTAL = SCENES.length;
  let speedMul = 1, cur = -1, k = 1, switching = false;
  const DURATION = 34; // seconds for a sheet at 1x

  /* ---------------------------------------------------------------- paper */
  function paintPaper() {
    const w = paperC.width, h = paperC.height, R = S.rng(7);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.fillStyle = '#f2ead8'; pctx.fillRect(0, 0, w, h);
    pctx.setTransform(k, 0, 0, k, 0, 0);
    // soft blotches of uneven tone
    for (let i = 0; i < 26; i++) {
      const x = R() * W, y = R() * H, r = 120 + R() * 380;
      const g = pctx.createRadialGradient(x, y, 0, x, y, r);
      const warm = R() > 0.5;
      g.addColorStop(0, warm ? 'rgba(206,176,120,0.10)' : 'rgba(255,255,255,0.14)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      pctx.fillStyle = g; pctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // faint drafting grid
    pctx.strokeStyle = 'rgba(96,120,150,0.075)'; pctx.lineWidth = 1 / k * 0.8;
    pctx.beginPath();
    for (let x = 40; x < W; x += 20) { pctx.moveTo(x, 40); pctx.lineTo(x, H - 40); }
    for (let y = 40; y < H; y += 20) { pctx.moveTo(40, y); pctx.lineTo(W - 40, y); }
    pctx.stroke();
    pctx.strokeStyle = 'rgba(96,120,150,0.11)'; pctx.beginPath();
    for (let x = 40; x < W; x += 100) { pctx.moveTo(x, 40); pctx.lineTo(x, H - 40); }
    for (let y = 40; y < H; y += 100) { pctx.moveTo(40, y); pctx.lineTo(W - 40, y); }
    pctx.stroke();
    // paper fibres
    for (let i = 0; i < 2600; i++) {
      const x = R() * W, y = R() * H, a = R() * 6.28, l = 3 + R() * 9;
      pctx.strokeStyle = R() > 0.5 ? 'rgba(120,96,60,0.07)' : 'rgba(255,255,255,0.35)';
      pctx.lineWidth = 0.5; pctx.beginPath(); pctx.moveTo(x, y);
      pctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); pctx.stroke();
    }
    // edge darkening
    const v = pctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(120,90,40,0)'); v.addColorStop(1, 'rgba(120,90,40,0.28)');
    pctx.fillStyle = v; pctx.fillRect(0, 0, W, H);
    // masking tape on the corners
    for (const [x, y, r] of [[38, 30, -0.7], [W - 38, 30, 0.7], [38, H - 30, 0.7], [W - 38, H - 30, -0.7]]) {
      pctx.save(); pctx.translate(x, y); pctx.rotate(r);
      pctx.fillStyle = 'rgba(232,214,160,0.72)'; pctx.fillRect(-42, -13, 84, 26);
      pctx.strokeStyle = 'rgba(160,130,70,0.35)'; pctx.lineWidth = 0.8; pctx.strokeRect(-42, -13, 84, 26);
      for (let t = -36; t < 40; t += 5) { pctx.beginPath(); pctx.moveTo(t, -13); pctx.lineTo(t + 1.5, 13); pctx.strokeStyle = 'rgba(160,130,70,0.10)'; pctx.stroke(); }
      pctx.restore();
    }
  }
  function makeGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 220;
    const x = c.getContext('2d'), R = S.rng(99), id = x.createImageData(220, 220);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = R();
      id.data[i] = 250; id.data[i + 1] = 244; id.data[i + 2] = 230;
      id.data[i + 3] = v > 0.86 ? Math.floor((v - 0.86) * 7.1 * 62) : 0;
    }
    x.putImageData(id, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
    grain.style.backgroundSize = '220px 220px';
  }

  /* --------------------------------------------------------------- player */
  class Player {
    constructor(scene) {
      const P = new S.Page(scene.seed, { ink: scene.ink });
      scene.build(P, scene.index + 1, TOTAL);
      this.page = P; this.ops = P.ops; this.i = 0; this.j = 0; this.credit = 0;
      this.total = 0;
      for (const op of this.ops) this.total += this.units(op) * this.ucost(op);
    }
    units(op) {
      switch (op.k) { case 's': return Math.max(0, op.p.length - 1); case 'f': return op.steps; default: return 1; }
    }
    ucost(op) {
      switch (op.k) { case 's': return 1; case 'f': return 9; case 'D': return 1 + op.p.length * 0.12; case 'e': return 2; default: return 1; }
    }
    get done() { return this.i >= this.ops.length; }
    get fraction() { return this.done ? 1 : this.i / this.ops.length; }
    reset() { ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, inkC.width, inkC.height); ictx.setTransform(k, 0, 0, k, 0, 0); }
    advance(b) {
      this.credit += b;
      while (this.i < this.ops.length) {
        const op = this.ops[this.i], N = this.units(op);
        if (N === 0) { this.i++; this.j = 0; continue; }
        const uc = this.ucost(op), avail = Math.floor(this.credit / uc);
        if (avail < 1) break;
        const take = Math.min(avail, N - this.j);
        this.draw(op, this.j, this.j + take);
        this.j += take; this.credit -= take * uc;
        if (this.j >= N) { this.i++; this.j = 0; }
      }
      if (this.done) this.credit = 0;
    }
    finish() { this.advance(Infinity); }
    /* redraw everything already drawn (after a resize / sheet switch) */
    replay() {
      const ti = this.i, tj = this.j;
      this.reset();
      for (let n = 0; n <= ti && n < this.ops.length; n++) {
        const op = this.ops[n], N = this.units(op);
        if (N === 0) continue;
        this.draw(op, 0, n < ti ? N : tj);
      }
    }
    draw(op, from, to) {
      if (to <= from && op.k !== 'e') return;
      const c = ictx;
      switch (op.k) {
        case 's': {
          const p = op.p, fs = op.fs || (op.fs = S.rgba(op.c, op.a));
          const L = [], Rr = [];
          for (let n = from; n <= to; n++) {
            const q = p[n], a = p[Math.max(0, n - 1)], b = p[Math.min(p.length - 1, n + 1)];
            let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
            const hw = q[2] * 0.68;
            L.push(q[0] - ty * hw, q[1] + tx * hw); Rr.push(q[0] + ty * hw, q[1] - tx * hw);
          }
          c.fillStyle = fs; c.beginPath(); c.moveTo(L[0], L[1]);
          for (let n = 2; n < L.length; n += 2) c.lineTo(L[n], L[n + 1]);
          for (let n = Rr.length - 2; n >= 0; n -= 2) c.lineTo(Rr[n], Rr[n + 1]);
          c.closePath(); c.fill();
          break;
        }
        case 'f': {
          const steps = op.steps, aStep = a => 1 - Math.pow(1 - a, 1 / steps);
          c.beginPath(); c.moveTo(op.poly[0][0], op.poly[0][1]);
          for (let n = 1; n < op.poly.length; n++) c.lineTo(op.poly[n][0], op.poly[n][1]);
          c.closePath();
          for (let s = from; s < to; s++) {
            if (op.g) {
              const g = op.g, gr = c.createLinearGradient(g.x0, g.y0, g.x1, g.y1);
              gr.addColorStop(0, S.rgba(g.c0, aStep(g.a0))); gr.addColorStop(1, S.rgba(g.c1, aStep(g.a1)));
              c.fillStyle = gr;
            } else c.fillStyle = S.rgba(op.c, aStep(op.a));
            c.fill();
          }
          if (to >= steps && op.edge) {
            c.lineWidth = 1.2; c.lineJoin = 'round';
            c.strokeStyle = S.rgba(op.g ? op.g.c1 : op.c, Math.min(1, (op.g ? op.g.a1 : op.a) * 0.55));
            c.stroke();
          }
          break;
        }
        case 'd': c.fillStyle = S.rgba(op.c, op.a); c.beginPath(); c.arc(op.x, op.y, op.r, 0, 6.3); c.fill(); break;
        case 'D': {
          c.fillStyle = S.rgba(op.c, op.a);
          for (const q of op.p) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 6.3); c.fill(); }
          break;
        }
        case 'e': {
          c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
          c.beginPath(); c.moveTo(op.poly[0][0], op.poly[0][1]);
          for (let n = 1; n < op.poly.length; n++) c.lineTo(op.poly[n][0], op.poly[n][1]);
          c.closePath(); c.fill(); c.restore();
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ app */
  const players = [];
  function playerFor(i) { return players[i] || (players[i] = new Player(SCENES[i])); }

  function layout() {
    const availW = window.innerWidth - 12, availH = window.innerHeight - 54 - 12;
    const scale = Math.min(availW / W, availH / H);
    const cw = Math.floor(W * scale), ch = Math.floor(H * scale), dpr = Math.min(2, window.devicePixelRatio || 1);
    stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
    const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    const changed = paperC.width !== pw || paperC.height !== ph;
    if (changed) {
      paperC.width = inkC.width = pw; paperC.height = inkC.height = ph;
      k = pw / W;
      paintPaper();
      if (cur >= 0) playerFor(cur).replay();
    }
  }

  function show(i, instant) {
    i = (i + TOTAL) % TOTAL;
    if (switching) return;
    switching = true;
    const go = () => {
      cur = i;
      history.replaceState(null, '', '#' + (i + 1));
      document.querySelectorAll('#tabs button').forEach((b, n) => b.classList.toggle('on', n === i));
      const p = playerFor(i);
      layout(); p.replay();
      stage.classList.remove('out');
      switching = false;
    };
    if (instant) go(); else { stage.classList.add('out'); setTimeout(go, 330); }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (cur >= 0 && !switching) {
      const p = playerFor(cur);
      if (!p.done) p.advance(Math.max(140, p.total / DURATION) * speedMul * dt);
    }
    requestAnimationFrame(frame);
  }

  function boot() {
    const tabs = document.getElementById('tabs');
    SCENES.forEach((s, n) => {
      const b = document.createElement('button');
      b.textContent = s.name; b.title = s.name;
      b.onclick = () => show(n);
      tabs.appendChild(b);
    });
    document.getElementById('prev').onclick = () => show(cur - 1);
    document.getElementById('next').onclick = () => show(cur + 1);
    document.getElementById('redraw').onclick = () => { const p = playerFor(cur); p.i = 0; p.j = 0; p.credit = 0; p.reset(); };
    document.getElementById('finish').onclick = () => { const p = playerFor(cur); p.finish(); };
    const sp = document.getElementById('speed');
    sp.onclick = () => { speedMul = speedMul === 1 ? 2 : speedMul === 2 ? 4 : speedMul === 4 ? 0.5 : 1; sp.textContent = speedMul + '×'; };
    addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') show(cur + 1);
      else if (e.key === 'ArrowLeft') show(cur - 1);
      else if (e.key === ' ') { e.preventDefault(); playerFor(cur).finish(); }
      else if (e.key === 'r' || e.key === 'R') document.getElementById('redraw').click();
    });
    addEventListener('resize', layout);
    makeGrain();
    const start = Math.max(0, Math.min(TOTAL - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
    layout();
    show(start, true);
    // if the handwriting font arrives late, re-lay the lettering out
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
      players.forEach(p => p && p.ops.forEach(o => { if (o.lay) o.lay = null; }));
      if (cur >= 0) playerFor(cur).replay();
    });
    requestAnimationFrame(frame);
    window.__sketch = { show, get player() { return playerFor(cur); }, players };
  }

  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([Promise.all([document.fonts.load('16px "Architects Daughter"'), document.fonts.load('16px Caveat')]), new Promise(r => setTimeout(r, 1500))])
    : Promise.resolve();
  fontsReady.catch(() => { }).then(boot);
})();
