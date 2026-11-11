// Dawn, a Window, a Glass of Water — the oil paint: brush strokes laid over the light study,
// coarse to fine, each with bristle striations, dry-brush breakup, wet pickup and a paint-height trace;
// plus the canvas weave and the raking-light relief of the finished surface.
(function () {
  'use strict';
  const DW = window.DW;
  const { clamp, smooth, mix } = DW;
  const R = DW.R;

  // region -> brush scale and character
  const REG = [];
  REG[R.WALL] = { s: 1.35, asp: 3.2, curl: 0.18, op: 0.80, jit: 0.07, hue: 0.05 };
  REG[R.LOWWALL] = { s: 1.5, asp: 3.0, curl: 0.2, op: 0.80, jit: 0.08, hue: 0.06 };
  REG[R.ROD] = { s: 0.22, asp: 6, curl: 0.0, op: 0.7, jit: 0.02 };
  REG[R.REVL] = { s: 0.75, asp: 3.5, curl: 0.08, op: 0.85, jit: 0.045, hue: 0.04, iso: 1 };
  REG[R.REVR] = { s: 0.75, asp: 3.5, curl: 0.08, op: 0.85, jit: 0.045, hue: 0.04, iso: 1 };
  REG[R.SOFFIT] = { s: 0.75, asp: 3.5, curl: 0.08, op: 0.85, jit: 0.045, hue: 0.045, iso: 1 };
  REG[R.SILL] = { s: 0.6, asp: 4.5, curl: 0.04, op: 0.85, jit: 0.035, hue: 0.03 };
  REG[R.NOSE] = { s: 0.35, asp: 7, curl: 0.0, op: 0.8, jit: 0.02 };
  REG[R.FRAME] = { s: 0.33, asp: 6, curl: 0.02, op: 0.85, jit: 0.04, hue: 0.03 };
  REG[R.FSIDE] = { s: 0.18, asp: 7, curl: 0.0, op: 0.85, jit: 0.02 };
  REG[R.SKY] = { s: 1.0, asp: 4.2, curl: 0.06, op: 0.75, jit: 0.03, hue: 0.035 };
  REG[R.GLOW] = { s: 0.85, asp: 5.0, curl: 0.05, op: 0.8, jit: 0.028, hue: 0.04 };
  REG[R.DARKOUT] = { s: 0.4, asp: 4, curl: 0.05, op: 0.85, jit: 0.03 };

  function perc(v) { return Math.sqrt(v < 0 ? 0 : v); } // cheap perceptual-ish transfer for comparisons

  DW.paint = function (S, seed) {
    const { Wpx, Hpx, N, ref, region, dir, keep } = S;
    const scale = Wpx / 2160;
    const rnd = DW.rng(seed || 4471);

    // perceptual reference for edge awareness
    const refP = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) refP[i] = perc(ref[i]);

    // blurred references per pass (stroke colours come from these)
    const blurs = [null, DW.boxBlur(ref, Wpx, Hpx, 3, Math.max(1, Math.round(3 * scale)), 2)];
    // underpainting: very soft version of the light, slightly warm in the darks (a toned ground showing through)
    const under = blurs[1];
    const P = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      P[i * 3] = under[i * 3] * 1.04 + 0.0015;
      P[i * 3 + 1] = under[i * 3 + 1] * 1.0 + 0.0012;
      P[i * 3 + 2] = under[i * 3 + 2] * 0.97 + 0.0008;
    }
    const Hh = new Float32Array(N); // paint height

    const passes = [
      { w: 30, thr: -1, sig: 0.11, op: 1.0, dry: 0.25 },
      { w: 13, thr: 0.018, sig: 0.075, op: 0.95, dry: 0.35 },
      { w: 6, thr: 0.03, sig: 0.05, op: 0.9, dry: 0.4 },
      { w: 3.2, thr: 0.045, sig: 0.04, op: 0.85, dry: 0.3 },
    ];
    const NB = 18;
    const bristle = new Float32Array(NB);
    let strokes = 0;

    for (let pi = 0; pi < passes.length; pi++) {
      const pass = passes[pi];
      const src = pi === 0 ? blurs[1] : ref;
      const wNom = pass.w * scale;
      const sp = Math.max(1.5, wNom * 0.85) * 0.34; // fine candidate grid; thinned per region below
      // candidates on a jittered grid
      const cand = [];
      for (let y = sp * 0.5; y < Hpx; y += sp)
        for (let x = sp * 0.5; x < Wpx; x += sp) cand.push(x + (rnd() - 0.5) * sp, y + (rnd() - 0.5) * sp);
      // shuffle
      const nC = cand.length / 2;
      const order = new Uint32Array(nC);
      for (let i = 0; i < nC; i++) order[i] = i;
      for (let i = nC - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }

      for (let oi = 0; oi < nC; oi++) {
        const cx = cand[order[oi] * 2], cy = cand[order[oi] * 2 + 1];
        const ix = clamp(cx | 0, 0, Wpx - 1), iy = clamp(cy | 0, 0, Hpx - 1);
        const p0 = iy * Wpx + ix;
        const reg = region[p0];
        const rp = REG[reg] || REG[R.WALL];
        // density: big-brush regions get fewer, larger strokes
        const rs = rp.s;
        const keepP = Math.min(1, (0.34 / rs) * (0.34 / rs));
        if (rnd() > keepP) continue;
        // refinement: skip where the canvas already matches the light
        if (pass.thr > 0) {
          let err = 0;
          for (let k = 0; k < 3; k++) err += Math.abs(perc(P[p0 * 3 + k]) - refP[p0 * 3 + k]);
          if (err / 3 < pass.thr) continue;
        }
        // tiny brushes are not used on the big quiet surfaces
        if (pi === 3 && rs > 0.9) continue;
        const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd();
        const hw = Math.max(0.8, wNom * Math.min(rs, pi === 0 ? 1.6 : 1.25) * (0.7 + 0.6 * r1) * 0.5);
        const hl = hw * rp.asp * (0.7 + 0.6 * r2);
        let ang = dir[p0] + (r3 - 0.5) * 0.22;
        // on the reveals most strokes run across the fall of light (along the isophotes), some with it
        if (rp.iso && rnd() < 0.65) ang += Math.PI / 2 + (rnd() - 0.5) * 0.3;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const curl = (r4 - 0.5) * 2 * rp.curl;
        // colour: the light study averaged along the brush path (same surface only), jittered like hand-mixed paint
        let s0 = 0, s1 = 0, s2 = 0, sn = 0;
        for (let k = -3; k <= 3; k++) {
          for (let l = -1; l <= 1; l++) {
            const sx = clamp((cx + ca * hl * 0.26 * k - sa * hw * 0.45 * l) | 0, 0, Wpx - 1);
            const sy = clamp((cy + sa * hl * 0.26 * k + ca * hw * 0.45 * l) | 0, 0, Hpx - 1);
            const sp2 = sy * Wpx + sx;
            if (region[sp2] !== reg) continue;
            s0 += src[sp2 * 3]; s1 += src[sp2 * 3 + 1]; s2 += src[sp2 * 3 + 2]; sn++;
          }
        }
        s0 /= sn; s1 /= sn; s2 /= sn;
        const j0 = (rnd() - 0.5) * 2 * rp.jit, jr = (rnd() - 0.5) * rp.jit * 0.6, jb = (rnd() - 0.5) * rp.jit * 0.6;
        // broken colour: each loaded brush leans a little warm or cool
        const hj = (rnd() - 0.5) * 2 * (rp.hue || 0.02);
        const col0 = s0 * (1 + j0 + jr + hj), col1 = s1 * (1 + j0 + hj * 0.15), col2 = s2 * (1 + j0 + jb - hj);
        const cP0 = perc(s0), cP1 = perc(s1), cP2 = perc(s2);
        const lumP = 0.3 * cP0 + 0.55 * cP1 + 0.15 * cP2;
        const thick = 0.12 + 0.95 * smooth(0.42, 0.9, lumP);
        const isig = 1 / (pass.sig * pass.sig);
        const op = pass.op * rp.op;
        const dry = pass.dry * (0.6 + 0.8 * r5);
        const pick = 0.12 + 0.2 * rnd();
        for (let b = 0; b < NB; b++) {
          const v = rnd();
          bristle[b] = v < 0.1 ? 0.15 + 0.2 * rnd() : 0.55 + 0.45 * v;
        }
        // raster the stroke
        const ex = Math.abs(ca) * hl + Math.abs(sa) * hw + Math.abs(curl) * hl + 2;
        const ey = Math.abs(sa) * hl + Math.abs(ca) * hw + Math.abs(curl) * hl + 2;
        const x0 = Math.max(0, (cx - ex) | 0), x1 = Math.min(Wpx - 1, (cx + ex) | 0);
        const y0 = Math.max(0, (cy - ey) | 0), y1 = Math.min(Hpx - 1, (cy + ey) | 0);
        const ihl = 1 / hl, ihw = 1 / hw;
        for (let py = y0; py <= y1; py++) {
          const dy = py + 0.5 - cy;
          let p = py * Wpx + x0;
          for (let px = x0; px <= x1; px++, p++) {
            const dx = px + 0.5 - cx;
            const a = dx * ca + dy * sa;
            const ta = a * ihl;
            if (ta <= -1 || ta >= 1) continue;
            const bb = (-dx * sa + dy * ca) - curl * a * a * ihl;
            const s01 = (ta + 1) * 0.5;
            const wf = 1 - 0.3 * s01 * s01; // narrower as the brush lifts
            const tb = bb * ihw / wf;
            if (tb <= -1 || tb >= 1) continue;
            // ends: loaded start, feathered lift-off
            const endA = ta < -0.8 ? (ta + 1) * 5 : ta > 0.55 ? (1 - ta) / 0.45 : 1;
            const atb = tb < 0 ? -tb : tb;
            const side = atb < 0.72 ? 1 : (1 - atb) / 0.28;
            // bristles across the width
            const bf = (tb * 0.5 + 0.5) * (NB - 1);
            const bi = bf | 0, bfr = bf - bi;
            const bd = bristle[bi] + (bristle[bi < NB - 1 ? bi + 1 : bi] - bristle[bi]) * bfr;
            // dry brush: thin bristles run out of paint first, towards the end of the stroke
            const th = dry * s01 * s01 * 1.4;
            let bc = (bd - th) * 4;
            bc = bc < 0 ? 0 : bc > 1 ? 1 : bc;
            let cov = endA * side * bc;
            if (cov <= 0.002) continue;
            // edge awareness: the brush stops at a change of colour, wanders across similar tones
            const q = p * 3;
            const d0 = refP[q] - cP0, d1 = refP[q + 1] - cP1, d2 = refP[q + 2] - cP2;
            const e = (d0 * d0 + d1 * d1 + d2 * d2) * isig;
            const wE = 1 / (1 + e + 0.5 * e * e);
            const al = op * cov * wE;
            if (al <= 0.002) continue;
            // wet pickup of the paint underneath, increasing along the stroke; bristle striation in value
            const m = pick * s01;
            const str = 1 + 0.07 * (bd - 0.75);
            const u0 = P[q], u1 = P[q + 1], u2 = P[q + 2];
            const c0 = (col0 + (u0 - col0) * m) * str, c1 = (col1 + (u1 - col1) * m) * str, c2 = (col2 + (u2 - col2) * m) * str;
            P[q] = u0 + (c0 - u0) * al;
            P[q + 1] = u1 + (c1 - u1) * al;
            P[q + 2] = u2 + (c2 - u2) * al;
            // paint height: ridges along bristles, a little build-up at the stroke sides
            const ridge = atb > 0.6 ? (atb - 0.6) * 1.5 : 0;
            const hNew = thick * (0.55 + 0.45 * bd + ridge) * (1 - 0.35 * s01);
            Hh[p] = Hh[p] * (1 - al * 0.55) + hNew * al * 0.75;
          }
        }
        strokes++;
      }
    }

    // keep certain details crisp (edges of the moulding, the rod): blend back towards the light study
    for (let i = 0; i < N; i++) {
      const k = keep[i];
      if (k > 0) {
        P[i * 3] = mix(P[i * 3], ref[i * 3], k);
        P[i * 3 + 1] = mix(P[i * 3 + 1], ref[i * 3 + 1], k);
        P[i * 3 + 2] = mix(P[i * 3 + 2], ref[i * 3 + 2], k);
      }
    }
    return { P, Hh, strokes };
  };

  // ---------- canvas weave (height, 0..1) ----------
  DW.canvasWeave = function (Wpx, Hpx) {
    const N = Wpx * Hpx;
    const out = new Float32Array(N);
    const per = 7.2 * (Wpx / 2160);
    const ip = 1 / per;
    for (let j = 0; j < Hpx; j++) {
      const v = j * ip + 0.37 * Math.sin(j * 0.0021);
      const iv = Math.floor(v), fv = v - iv;
      for (let i = 0; i < Wpx; i++) {
        const u = i * ip + 0.3 * Math.sin(i * 0.0017 + j * 0.0004);
        const iu = Math.floor(u), fu = u - iu;
        // thread thickness irregularity (slubs) per thread
        const tw = 0.8 + 0.4 * DW.noise1(j * ip * 0.07, iu * 13 + 1);
        const tf = 0.8 + 0.4 * DW.noise1(i * ip * 0.07, iv * 17 + 2);
        const pw = Math.pow(Math.sin(Math.PI * fu), 0.6) * tw; // warp profile across
        const pf = Math.pow(Math.sin(Math.PI * fv), 0.6) * tf; // weft profile across
        const over = (iu + iv) & 1;
        let h;
        if (over) h = Math.max(pw * (0.7 + 0.3 * Math.sin(Math.PI * fv)), pf * 0.55);
        else h = Math.max(pf * (0.7 + 0.3 * Math.sin(Math.PI * fu)), pw * 0.55);
        out[j * Wpx + i] = h;
      }
    }
    return out;
  };

  // shading factor from a height field under a raking light from the upper left (returns shade-1, ~[-0.3,0.3])
  DW.reliefShade = function (H, Wpx, Hpx, gain) {
    const out = new Float32Array(Wpx * Hpx);
    const Lx = -0.5, Ly = -0.62, Lz = 0.6;
    const Ln = Math.hypot(Lx, Ly, Lz);
    const lx = Lx / Ln, ly = Ly / Ln, lz = Lz / Ln;
    for (let j = 1; j < Hpx - 1; j++) {
      for (let i = 1; i < Wpx - 1; i++) {
        const p = j * Wpx + i;
        const gx = (H[p + 1] - H[p - 1]) * 0.5 * gain;
        const gy = (H[p + Wpx] - H[p - Wpx]) * 0.5 * gain;
        const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
        const nl = (-gx * lx - gy * ly + lz) * inv;
        out[p] = nl / lz - 1;
      }
    }
    return out;
  };
})();
