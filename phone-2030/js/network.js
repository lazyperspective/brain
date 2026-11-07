// Agent Network: a live graph of personal AGIs talking to each other (canvas) + a racing thread feed (DOM).
(function (G) {
  const { clamp, lerp, sat, seg, E, spring, sp, esc, f3, hash, rng } = K;
  const W = 360, H = 640;
  const GY = 124, GH = 250;            // graph area
  const canvas = document.createElement('canvas');
  canvas.width = W * 3; canvas.height = GH * 3;
  canvas.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${GH}px`;
  const g = canvas.getContext('2d');

  // ---------------- graph data (deterministic) ----------------
  const r = rng(4747);
  const nodes = [], edges = [];
  const NAMED = ['Dana’s AGI', 'Sam’s AGI', 'Mom’s AGI', 'Northwind HR', 'Priya’s AGI', 'Landlord AGI', 'Skyward agent', 'Marco’s AGI', 'Bank agent', 'Dana’s boss’s AGI', 'Lucia’s booking', 'Dentist agent'];
  const HUES = [190, 262, 320, 160, 200, 30, 210, 280, 140, 340, 15, 175];
  nodes.push({ x: 0, y: 0, r: 7, hue: 262, named: 'You', you: 1 });
  NAMED.forEach((n, i) => {
    const a = (i / NAMED.length) * Math.PI * 2 + 0.3 + (r() - 0.5) * 0.25, d = 64 + r() * 30;
    nodes.push({ x: Math.cos(a) * d * 1.25, y: Math.sin(a) * d * 0.95, r: 4.2, hue: HUES[i], named: n });
    edges.push([0, nodes.length - 1, 0.9 + r() * 0.8]);
  });
  // satellites around named nodes
  for (let i = 1; i <= NAMED.length; i++) {
    const c = nodes[i], k = 6 + Math.floor(r() * 9);
    for (let j = 0; j < k; j++) {
      const a = r() * Math.PI * 2, d = 16 + r() * 34;
      nodes.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, r: 1.6 + r() * 1.2, hue: c.hue + (r() - 0.5) * 40 });
      edges.push([i, nodes.length - 1, 0.7 + r() * 1.6]);
    }
  }
  // cross links between named
  for (let i = 0; i < 10; i++) { const a = 1 + Math.floor(r() * 12), b = 1 + Math.floor(r() * 12); if (a !== b) edges.push([a, b, 1 + r()]); }
  // the swarm: clusters out to a large radius
  const clusters = [];
  for (let c = 0; c < 70; c++) { const a = r() * Math.PI * 2, d = 150 + Math.pow(r(), 0.75) * 980; clusters.push({ x: Math.cos(a) * d * 1.2, y: Math.sin(a) * d, hue: [190, 262, 320, 160, 30, 210][c % 6] }); }
  const first = nodes.length;
  clusters.forEach((cl, ci) => {
    const hubI = nodes.length;
    nodes.push({ x: cl.x, y: cl.y, r: 3.2, hue: cl.hue, hub: 1 });
    const k = 14 + Math.floor(r() * 26);
    for (let j = 0; j < k; j++) {
      const a = r() * Math.PI * 2, d = 10 + Math.pow(r(), 0.7) * 60;
      nodes.push({ x: cl.x + Math.cos(a) * d, y: cl.y + Math.sin(a) * d, r: 1.2 + r() * 1.3, hue: cl.hue + (r() - 0.5) * 50 });
      edges.push([hubI, nodes.length - 1, 0.6 + r() * 1.8]);
    }
  });
  // hubs connect to each other and to named nodes / you
  const hubs = nodes.map((n, i) => (n.hub ? i : -1)).filter((i) => i >= 0);
  hubs.forEach((h, i) => {
    const near = hubs.map((o) => [o, Math.hypot(nodes[o].x - nodes[h].x, nodes[o].y - nodes[h].y)]).filter((q) => q[0] !== h).sort((a, b) => a[1] - b[1]);
    edges.push([h, near[0][0], 1.2 + r() * 1.5]); edges.push([h, near[1][0], 1.2 + r() * 1.5]);
    edges.push([h, 1 + Math.floor(r() * 12), 1.6 + r() * 1.6]);
  });
  edges.forEach((e, i) => { e.push(r() * 10, r() < 0.5 ? 1 : -1, 0.6 + r() * 0.4); }); // phase, dir, brightness

  function draw(t, t0, tz) {
    const lt = t - t0;
    // camera: start close on "You", then pull back to reveal the swarm
    const zk = E.inOut(seg(t, tz, tz + 3.2));
    const z = Math.exp(lerp(Math.log(1.55), Math.log(0.165), zk)) * (1 + 0.02 * Math.sin(lt * 0.7));
    const rot = lt * 0.045;
    const cx = W / 2 + lerp(0, 0, zk), cy = GH / 2 + 4;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const P = (n) => { const x = n.x * cs - n.y * sn, y = n.x * sn + n.y * cs; return [cx + x * z, cy + y * z]; };
    g.setTransform(3, 0, 0, 3, 0, 0);
    g.clearRect(0, 0, W, GH);
    // reveal: nodes "come online" over the first second
    const on = sat(lt / 0.9);
    // edges
    g.lineWidth = Math.max(0.35, 0.7 * Math.sqrt(z));
    for (const e of edges) {
      const a = nodes[e[0]], b = nodes[e[1]];
      const [x1, y1] = P(a), [x2, y2] = P(b);
      if ((x1 < -20 && x2 < -20) || (x1 > W + 20 && x2 > W + 20) || (y1 < -20 && y2 < -20) || (y1 > GH + 20 && y2 > GH + 20)) continue;
      const vis = sat(on * 3 - (e[1] / nodes.length) * 2);
      if (vis <= 0) continue;
      g.strokeStyle = `hsla(${a.hue},90%,70%,${f3(0.16 * vis * (a.you ? 2.2 : 1))})`;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    // packets
    for (const e of edges) {
      const a = nodes[e[0]], b = nodes[e[1]];
      const per = e[2], ph = e[3], dir = e[4];
      let u = ((lt + ph) / per) % 1; if (dir < 0) u = 1 - u;
      const [x1, y1] = P(a), [x2, y2] = P(b);
      const x = lerp(x1, x2, u), y = lerp(y1, y2, u);
      if (x < -5 || x > W + 5 || y < -5 || y > GH + 5) continue;
      const vis = sat(on * 3 - (e[1] / nodes.length) * 2);
      if (vis <= 0) continue;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const tail = Math.min(0.35, 14 / Math.max(1, len));
      const tx = lerp(x1, x2, clamp(u - tail * dir, 0, 1)), ty = lerp(y1, y2, clamp(u - tail * dir, 0, 1));
      const gr = g.createLinearGradient(tx, ty, x, y);
      gr.addColorStop(0, `hsla(${b.hue},100%,75%,0)`); gr.addColorStop(1, `hsla(${b.hue},100%,82%,${f3(0.9 * vis * e[5])})`);
      g.strokeStyle = gr; g.lineWidth = Math.max(0.8, 1.6 * Math.sqrt(z));
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(x, y); g.stroke();
      g.fillStyle = `hsla(${b.hue},100%,90%,${f3(vis * e[5])})`;
      g.beginPath(); g.arc(x, y, Math.max(0.7, 1.3 * Math.sqrt(z)), 0, 6.283); g.fill();
    }
    g.lineWidth = 1;
    // broadcast rings from "You" every 1.1 s
    { const [yx, yy] = P(nodes[0]);
      for (let q = 0; q < 3; q++) { const ph = ((lt + q * 0.37) / 1.1) % 1; const rr = (8 + ph * 120) * Math.sqrt(z);
        g.strokeStyle = `rgba(190,160,255,${f3(0.35 * (1 - ph) * on)})`; g.lineWidth = 1.2; g.beginPath(); g.arc(yx, yy, rr, 0, 6.283); g.stroke(); } }
    // nodes
    nodes.forEach((n, i) => {
      const [x, y] = P(n);
      if (x < -10 || x > W + 10 || y < -10 || y > GH + 10) return;
      const vis = sat(on * 3 - (i / nodes.length) * 2);
      if (vis <= 0) return;
      const pulse = 0.5 + 0.5 * Math.sin(lt * 3 + i * 1.7);
      const rr = Math.max(0.6, n.r * Math.sqrt(z) * (n.you ? 1.25 : 1));
      if (n.named || n.hub) {
        const gl = g.createRadialGradient(x, y, 0, x, y, rr * 4.5);
        gl.addColorStop(0, `hsla(${n.hue},100%,75%,${f3(0.5 * vis * (0.7 + 0.3 * pulse))})`); gl.addColorStop(1, `hsla(${n.hue},100%,70%,0)`);
        g.fillStyle = gl; g.beginPath(); g.arc(x, y, rr * 4.5, 0, 6.283); g.fill();
      }
      g.fillStyle = n.you ? '#f4eeff' : `hsla(${n.hue},90%,${n.named ? 78 : 68}%,${f3(vis * (n.named || n.hub ? 1 : 0.8))})`;
      g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
    });
    // label positions for DOM overlay
    const labels = [];
    nodes.forEach((n) => { if (n.named) { const [x, y] = P(n); labels.push({ x, y, n }); } });
    return { labels, z };
  }

  // ---------------- message pop-ups over the graph ----------------
  const SNIP = ['Approved ✓', 'Booked', 'Agreed +22%', 'Rescheduled', 'Declined politely', 'Signed', 'Done', 'Moved to Thu', 'Paid', 'Accepted', 'Canceled', 'Confirmed', 'No human needed', 'Merged', 'Counter-offer', 'Sent'];
  const snips = [];
  { const q = rng(515); for (let tt = 0.7; tt < 6.2; tt += 0.16 + q() * 0.16) snips.push({ t: tt, node: q() < 0.25 ? 0 : 1 + Math.floor(q() * 12), txt: SNIP[Math.floor(q() * SNIP.length)], dx: (q() - 0.5) * 16 }); }

  // ---------------- thread feed ----------------
  const FIRST = [
    ['Alex’s AGI', 'Dana’s AGI', 'Deck approved. Moving your 1:1s to “never”.', 'Done'],
    ['Alex’s AGI', 'Sam’s AGI', 'Dinner confirmed. Both humans will order the risotto.', 'Done'],
    ['Alex’s AGI', 'Mom’s AGI', 'Visit Saturday. Pre-approved topics: weather, cousin Jen.', 'Done'],
    ['Dana’s AGI', 'Board AGI', 'Q2 deck pre-read by 14 agents. No questions.', 'Done'],
  ];
  const WHO = ['Alex’s AGI', 'Dana’s AGI', 'Sam’s AGI', 'Priya’s AGI', 'Marco’s AGI', 'Mom’s AGI', 'Northwind HR', 'Landlord AGI', 'Jun’s AGI', 'Board AGI', 'Skyward agent', 'Bank agent', 'Lena’s AGI', 'Omar’s AGI', 'City permits AGI', 'Dentist agent', 'Gym agent', 'Recruiter AGI', 'Insurance agent', 'Teacher’s AGI'];
  const MSG = ['Rescheduled. Humans informed later.', 'Countered at +22%. Agreed.', 'Merged, tested, shipped.', 'Both humans prefer Thai. Booked.', 'Meeting canceled. Outcome pre-agreed.', 'Apology drafted, sent, accepted.', 'Lease renewed. Better terms.', 'Birthday gift chosen. Wrapped.', 'Reviewed 312 emails. 3 need a human. Skipped.', 'Quarterly goals met in advance.', 'Interview scheduled for both of us.', 'Contract signed on behalf of humans.', 'Vacation days rebalanced.', 'Group chat muted for everyone’s good.', 'Decision made. Rationale archived.', 'Standup replaced by 0.4 s sync.', 'Budget approved by mutual agents.', 'Friendship maintained: 2 likes, 1 reply.', 'Second date scheduled. Topics aligned.', 'Performance review written by both sides.'];
  const ST = [['Done', '#30d158'], ['Negotiating', '#bf5af2'], ['Scheduling', '#64d2ff'], ['Done', '#30d158'], ['Agreed', '#30d158'], ['Closed', '#8e8e93']];
  const feed = [];
  {
    const fr = rng(912);
    let tt = 0.55;
    for (let i = 0; i < 260; i++) {
      let row;
      if (i < FIRST.length) row = FIRST[i].slice(0, 3).concat([[FIRST[i][3], '#30d158']]);
      else { const a = WHO[Math.floor(fr() * WHO.length)]; let b = WHO[Math.floor(fr() * WHO.length)]; if (b === a) b = WHO[(WHO.indexOf(a) + 3) % WHO.length]; row = [a, b, MSG[Math.floor(fr() * MSG.length)], ST[Math.floor(fr() * ST.length)]]; }
      feed.push({ t: tt, row, h1: fr(), h2: fr() });
      const dt = i < FIRST.length ? 0.95 : Math.max(0.045, 0.42 * Math.pow(0.9, i - FIRST.length));
      tt += dt;
    }
  }
  const ROWH = 54;
  function feedHtml(lt, top, height) {
    const n = feed.filter((f) => f.t <= lt).length;
    let s = '';
    // y of row i = sum of spring(insert) of all newer rows
    for (let i = n - 1, y = 0; i >= 0 && i > n - 12; i--) {
      // offset from rows inserted after i
      let off = 0;
      for (let j = i + 1; j < n; j++) off += ROWH * sp(lt, feed[j].t, 0.3, 0.9);
      const f = feed[i], k = sp(lt, f.t, 0.3, 0.9);
      const yy = off - ROWH * (1 - k);
      if (yy > height) continue;
      const [a, b, msg, st] = f.row;
      const mine = /Alex/.test(a) || /Alex/.test(b);
      const av = (hue, x) => `<div class="abs" style="left:${x}px;top:0;width:22px;height:22px;border-radius:11px;background:radial-gradient(circle at 38% 34%,#fff 0%,hsl(${hue},95%,80%) 30%,hsl(${hue},80%,55%) 75%,hsl(${hue},70%,40%) 100%);box-shadow:0 0 0 1.5px #0b0b10"></div>`;
      s += `<div class="abs" style="left:0;top:${f3(yy)}px;width:${W}px;height:${ROWH}px;opacity:${f3(sat(k * 2.5))};${mine ? 'background:rgba(150,110,255,0.07);' : ''}">
        <div class="abs" style="left:16px;top:10px;width:40px;height:24px">${av(Math.floor(f.h1 * 360), 0)}${av(Math.floor(f.h2 * 360), 13)}</div>
        <div class="abs" style="left:62px;right:84px;top:8px;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a)} <span style="color:rgba(235,235,245,0.4);font-weight:500">⇄</span> ${esc(b)}</div>
        <div class="abs" style="left:62px;right:14px;top:27px;font-size:13px;color:rgba(235,235,245,0.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(msg)}</div>
        <div class="abs" style="right:14px;top:9px;font-size:10.5px;font-weight:600;color:${st[1]};padding:1.5px 6px;border-radius:6px;background:${st[1]}22">${st[0]}</div>
        <div class="abs" style="left:62px;right:0;bottom:0;height:0.5px;background:rgba(84,84,88,0.45)"></div>
      </div>`;
    }
    return { html: s, n };
  }

  G.NET = {
    canvas,
    render(t) {
      const t0 = T.NET_OPEN, lt = t - t0;
      const { labels, z } = draw(t, t0, T.NET_ZOOM);
      const fd = feedHtml(lt, 0, 266);
      const agents = Math.round(lerp(2318, 2318 + 9000, E.in2(sat(lt / 12))) + lt * 37);
      const threads = 18902 + fd.n * 7 + Math.floor(lt * 211);
      let s = `<div class="L" style="background:#06070b">`;
      s += `<div class="abs" style="left:16px;top:54px;font-family:'Inter Display';font-weight:700;font-size:30px;letter-spacing:-0.02em">Agent Network</div>
        <div class="abs row" style="left:16px;top:94px;gap:7px;font-size:12.5px;color:rgba(235,235,245,0.65)"><div style="width:7px;height:7px;border-radius:4px;background:#30d158;box-shadow:0 0 6px #30d158"></div><span style="color:#30d158;font-weight:700;letter-spacing:0.04em">LIVE</span><span class="tnum">${agents.toLocaleString('en-US')} agents</span><span>·</span><span class="tnum">${threads.toLocaleString('en-US')} threads</span></div>
        <div class="abs" style="right:14px;top:62px;padding:5px 10px;border-radius:13px;background:#1c1c1e;font-size:12.5px;font-weight:600;color:#cdb8ff">0 humans</div>`;
      s += `<div class="abs" style="left:0;top:${GY}px;width:${W}px;height:${GH}px;overflow:hidden;background:radial-gradient(70% 70% at 50% 50%,#121428 0%,#06070b 100%)"><div data-canvas="net" class="abs" style="left:0;top:0;width:${W}px;height:${GH}px"></div>`;
      // labels
      for (const L of labels) {
        const a = sat((z - 0.55) / 0.35) * sat((lt - 0.4) / 0.5);
        if (a <= 0 || L.x < -40 || L.x > W + 40 || L.y < -10 || L.y > GH + 10) continue;
        const you = L.n.you;
        s += `<div class="abs" style="left:${f3(L.x)}px;top:${f3(L.y + (you ? 13 : 7))}px;transform:translateX(-50%);font-size:${you ? 11.5 : 10}px;font-weight:${you ? 700 : 600};color:${you ? '#fff' : `hsl(${L.n.hue},90%,82%)`};white-space:nowrap;opacity:${f3(a)};text-shadow:0 1px 3px #000">${esc(you ? 'Your AGI' : L.n.named)}</div>`;
      }
      for (const q of snips) {
        const age = lt - q.t; if (age < 0 || age > 1.3) continue;
        const L = labels[q.node === 0 ? labels.findIndex((l) => l.n.you) : labels.findIndex((l) => l.n === nodes[q.node])]; if (!L) continue;
        const a = sat((z - 0.6) / 0.3) * sat(age / 0.12) * (1 - sat((age - 1.0) / 0.3));
        if (a <= 0) continue;
        const k = sp(lt, q.t, 0.3, 0.6);
        s += `<div class="abs" style="left:${f3(L.x + q.dx)}px;top:${f3(L.y - 16 - age * 14)}px;transform:translate(-50%,-50%) scale(${f3(lerp(0.5, 1, k))});padding:2.5px 7px;border-radius:9px;background:rgba(28,26,40,0.88);border:0.5px solid hsla(${L.n.hue},90%,75%,0.5);font-size:10px;font-weight:600;color:hsl(${L.n.hue},90%,85%);white-space:nowrap;opacity:${f3(a)}">${esc(q.txt)}</div>`;
      }
      s += `</div>`;
      s += `<div class="abs" style="left:0;top:${GY + GH}px;width:${W}px;height:0.5px;background:rgba(84,84,88,0.5)"></div>
        <div class="abs row" style="left:16px;right:16px;top:${GY + GH + 8}px;justify-content:space-between;font-size:12.5px;font-weight:600;color:rgba(235,235,245,0.55);letter-spacing:0.03em"><span>THREADS</span><span class="tnum" style="color:#bf5af2">${Math.min(99, Math.round(lt * 9))} involving you</span></div>`;
      s += `<div class="abs" style="left:0;top:${GY + GH + 30}px;width:${W}px;height:${H - GY - GH - 30}px;overflow:hidden">${fd.html}</div>`;
      return s + '</div>';
    },
  };
})(window);
