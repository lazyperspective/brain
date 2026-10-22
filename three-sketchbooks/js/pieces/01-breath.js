/* Three Sketchbooks — 01 · Breath
 *
 * A fingertip drawing on the fogged window of a night bus. The drawing is negative: where the finger
 * wiped, the condensation is gone and the out-of-focus city shows through. The fog creeps back into the
 * lines over a minute or so; then the finger draws it again, stroke by stroke, never quite the same.
 *
 * Structure
 *   - STROKES: the hand-authored drawing (nine strokes, in millimetres on the glass).
 *   - CPU "glass field" (one RGBA float per CSS pixel): R = how clear the finger left it, G = when,
 *     B = how much pushed water sits there, A = when that water was laid down. Finger stamps, drips
 *     and the viewer's own strokes all write into it; fog regrowth is computed from the timestamps.
 *   - The night outside: two horizontally periodic layers of bokeh painted once with Canvas2D, blurred
 *     on the GPU for the light the fog scatters. They drift as the bus moves.
 *   - One fragment shader composes fog, micro-droplets, rim beads, rain on the outside of the glass,
 *     drips, the rubber seal of the window.
 */
(function () {
  'use strict';

  // <strokes>
  function STROKES() {
    // the head, drawn upright (face to the left) in millimetres on the glass, then tipped back 26 degrees
    // against the seat. Six strokes; none of them closes a shape.
    const head = [
      // one long line: forehead, brow, the dip, down the nose, under it and onto the lip, where it stops
      { name: 'brow-nose', dur: 2.0, pause: 0.0, end: 'stop', press: 0.95, pk: [[0, 0.68], [0.3, 0.9], [0.55, 1.15], [0.75, 1.1], [0.9, 0.8], [1, 1.1]],
        pts: [[14,62],[4,86],[0,104],[14,121],[-6,140],[-28,158],[-14,171],[1,177],[-3,191],[4,199]] },
      // the closed eye: one soft arc
      { name: 'eye', dur: 0.55, pause: 0.7, end: 'stop', press: 0.82, jit: 0.6, pk: [[0, 0.8], [0.5, 1.0], [1, 0.75]],
        pts: [[36,127],[49,137],[64,138],[76,131]] },
      // the hair: one wide fast swipe over the crown that falls away against the seat
      { name: 'hair', dur: 1.25, pause: 0.8, end: 'flick', press: 0.92, w: 1.28, pk: [[0, 0.72], [0.25, 1.15], [0.6, 1.0], [0.85, 0.78], [1, 0.7]],
        pts: [[38,30],[76,6],[136,-4],[194,16],[234,62],[248,122],[244,172],[254,208],[282,230],[318,240]] },
      // the ear, small, where the jaw meets the skull
      { name: 'ear', dur: 0.55, pause: 0.6, end: 'stop', press: 0.86, jit: 0.7,
        pts: [[120,124],[138,121],[147,140],[140,163],[126,175]] },
    ];
    const th = 26 * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), px = 100, py = 240;
    const rot = (p) => [px + (p[0] - px) * c - (p[1] - py) * s, py + (p[0] - px) * s + (p[1] - py) * c];
    const H = head.map((r) => Object.assign({}, r, { pts: r.pts.map(rot) }));
    const chin = [[-3,222],[0,238],[15,252]].map(rot);
    const body = [
      // chin, under the jaw and down the long throat in one sweep
      { name: 'chin-throat', dur: 1.6, pause: 0.6, end: 'stop', press: 0.92, pk: [[0, 1.15], [0.15, 1.0], [0.45, 0.7], [0.75, 0.95], [1, 1.18]],
        pts: chin.concat([[40,226],[60,250],[76,284],[88,322],[102,356],[124,384]]) },
      // nape to shoulder
      { name: 'shoulder', dur: 1.25, pause: 0.6, end: 'flick', press: 0.88, pk: [[0, 1.12], [0.4, 1.0], [1, 0.68]],
        pts: [[198,268],[202,296],[216,324],[248,348],[302,366],[374,378]] },
    ];
    return H.concat(body);
  }
  // </strokes>

  /* ------------------------------------------------------------------ small utilities */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  // fog regrowth timing (seconds after the wipe)
  const FADE0 = 28, FADE1 = 108, CYCLE = 110, TW = 240;
  function rec(age, kind) {
    const a0 = FADE0 * (kind ? 1.5 : 1), a1 = FADE1 * (kind ? 1.7 : 1);
    const g = clamp((age - a0) / (a1 - a0), 0, 1);
    return g * g * (3 - 2 * g);
  }
  // how clear a pixel of glass still is: R = clearness left by the wipe, G = when, A = how deep the
  // finger pressed there (the shallow edges fog over first)
  function effClear(R, G, A, now) {
    const kind = R > 1.5;
    const p0 = kind ? R - 2 : R;
    if (p0 <= 0.001) return 0;
    const fresh = smooth(0, 0.25, p0) * Math.min(1, p0 * 1.04);
    const thr = rec(now - G, kind) * 1.12;
    return fresh * smooth(thr - 0.06, thr + 0.06, A * 0.86 + 0.07);
  }

  // centripetal Catmull-Rom through hand-placed points, sampled every ~step px
  function crSample(P, step) {
    const n = P.length, out = [];
    const L = (a, b, ta, tb, t) => { const u = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
    const kn = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-4, 0.5);
    for (let i = 0; i < n - 1; i++) {
      const p1 = P[i], p2 = P[i + 1];
      const p0 = i > 0 ? P[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
      const p3 = i < n - 2 ? P[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
      const t0 = 0, t1 = t0 + kn(p0, p1), t2 = t1 + kn(p1, p2), t3 = t2 + kn(p2, p3);
      const m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < m; k++) {
        const t = t1 + (t2 - t1) * k / m;
        const A1 = L(p0, p1, t0, t1, t), A2 = L(p1, p2, t1, t2, t), A3 = L(p2, p3, t2, t3, t);
        const B1 = L(A1, A2, t0, t2, t), B2 = L(A2, A3, t1, t3, t);
        out.push(L(B1, B2, t1, t2, t));
      }
    }
    out.push(P[n - 1].slice());
    return out;
  }

  /* ------------------------------------------------------------------ shaders */
  const VS = `#version 300 es
  in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

  const COMMON = `#version 300 es
  precision highp float;
  uniform float uSeed;
  float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031 + uSeed); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec2 h22(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973) + uSeed); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + 1.), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
  `;

  // separable blur of a periodic scene layer (for the light the fog scatters)
  const FS_BLUR = COMMON + `
  out vec4 o;
  uniform sampler2D uSrc; uniform vec2 uDir; uniform vec2 uOut; uniform float uSig; uniform float uLod; uniform float uGain;
  void main(){
    vec2 uv = gl_FragCoord.xy / uOut;
    vec4 acc = vec4(0.); float wsum = 0.;
    for (int i = -24; i <= 24; i++){
      float x = float(i) / 8.0;            // in sigmas
      float w = exp(-0.5 * x * x);
      acc += w * textureLod(uSrc, uv + uDir * x * uSig, uLod);
      wsum += w;
    }
    o = acc / wsum * uGain;
  }`;

  // static fog structure: R = density mottle, G = fine mottle, B = breath patch
  const FS_MOT = COMMON + `
  out vec4 o; uniform vec2 uOut; uniform vec2 uRes; uniform float uS;
  void main(){
    vec2 p = vec2(gl_FragCoord.x, uOut.y - gl_FragCoord.y) / uOut * uRes;
    float a = fbm(p / (46.0 * uS));
    float b = fbm(p / (11.0 * uS) + 7.3);
    // condensation wipes in long soft horizontal-ish bands where warm air crept up the glass
    float c = fbm(vec2(p.x / (90.0 * uS), p.y / (30.0 * uS)) + 3.1);
    o = vec4(a, b, c, 1.0);
  }`;

  const FS_MAIN = COMMON + `
  out vec4 o;
  uniform vec2 uRes; uniform float uDpr; uniform float uT; uniform float uS;
  uniform float uPer; uniform float uOffF; uniform float uOffN;
  uniform sampler2D uFar, uNear, uFarB, uNearB, uFarC, uNearC, uField, uMot;
  uniform vec4 uDrip[8];
  uniform float uGlassB;
  uniform vec4 uFrame;   // x of the right seal, y of the bottom seal, corner radius, seal width (css px)
  uniform vec2 uFade;
  uniform float uBG;      // 1 / gain the blurred layers were stored with

  vec3 sceneSharp(vec2 p){
    vec2 a = vec2((p.x + uOffF) / uPer, p.y / uRes.y);
    vec2 b = vec2((p.x + uOffN) / uPer, p.y / uRes.y);
    return (texture(uFar, a).rgb + texture(uNear, b).rgb) * 2.0;
  }
  vec3 sceneBlur(vec2 p){
    vec2 a = vec2((p.x + uOffF) / uPer, p.y / uRes.y);
    vec2 b = vec2((p.x + uOffN) / uPer, p.y / uRes.y);
    return (texture(uFarB, a).rgb + texture(uNearB, b).rgb) * 2.0 * uBG;
  }
  vec3 sceneCore(vec2 p){
    vec2 a = vec2((p.x + uOffF) / uPer, p.y / uRes.y);
    vec2 b = vec2((p.x + uOffN) / uPer, p.y / uRes.y);
    return (texture(uFarC, a).rgb + texture(uNearC, b).rgb) * 2.0 * uBG;
  }
  float rec(float age, float kind){
    float a0 = uFade.x * mix(1.0, 1.5, kind), a1 = uFade.y * mix(1.0, 1.7, kind);
    float g = clamp((age - a0) / (a1 - a0), 0., 1.);
    return g * g * (3. - 2. * g);
  }
  float waterAt(vec2 q){ vec4 f = texture(uField, q / uRes); return f.b * exp(-max(uT - f.g, 0.) / ${TW.toFixed(1)}); }

  // a field of droplets on a jittered grid. returns (nx, ny, height, radius px) of the droplet over p
  vec4 drops(vec2 p, float cs, float occ, float rmin, float rmax, float salt){
    vec2 g = p / cs, i = floor(g);
    vec4 best = vec4(0.);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
      vec2 c = i + vec2(x, y);
      if (h12(c + salt * 1.7) > occ) continue;
      vec2 r = h22(c + salt);
      vec2 ctr = (c + 0.1 + 0.8 * r) * cs;
      float rad = mix(rmin, rmax, pow(h12(c * 1.31 + salt + 5.5), 2.0));
      vec2 d = (p - ctr) / rad; float dd = dot(d, d);
      if (dd < 1.0){ float hh = sqrt(1. - dd); if (hh > best.z) best = vec4(d, hh, rad); }
    }
    return best;
  }
  vec4 rimDrops(vec2 p, float cs){
    vec2 g = p / cs, i = floor(g);
    vec4 best = vec4(0.);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
      vec2 c = i + vec2(x, y);
      vec2 r = h22(c + 3.7);
      vec2 ctr = (c + 0.1 + 0.8 * r) * cs;
      float w = waterAt(ctr);
      if (w < 0.03) continue;
      float rnd = h12(c + 9.1);
      if (rnd > 0.2 + 0.9 * w) continue;
      float rad = cs * (0.28 + 0.5 * h12(c * 1.7 + 2.3)) * clamp(0.5 + 0.7 * sqrt(w), 0., 1.25);
      vec2 d = (p - ctr) / rad; float dd = dot(d, d);
      if (dd < 1.0){ float hh = sqrt(1. - dd); if (hh > best.z) best = vec4(d, hh, rad); }
    }
    return best;
  }
  // a water droplet sitting on the inside of the glass, lit by the bus's ceiling lamps
  vec3 shadeBead(vec4 b, vec2 p, vec3 under, float fogLum){
    vec2 n = b.xy; float r = length(n);
    float big = smoothstep(1.2, 5.0, b.w * uDpr);
    vec3 refr = sceneSharp(p - n * b.w * 5.0) * 1.05;          // the night, inverted and minified
    vec3 c = refr * 0.9 + vec3(0.012, 0.014, 0.016);
    // the curved water mirrors the lit fog around it: a pale ring inside the edge
    float ring = smoothstep(0.5, 0.86, r) * (1.0 - smoothstep(0.86, 0.99, r));
    c = mix(c, under * 1.08, ring * 0.55);
    // a thin dark meniscus where the water meets the glass
    c *= 1.0 - 0.55 * smoothstep(0.86, 1.0, r);
    vec2 L = normalize(vec2(-0.42, -0.62));
    float spec = exp(-dot(n - L * 0.5, n - L * 0.5) * 30.0);
    float caus = exp(-dot(n + L * 0.55, n + L * 0.55) * 14.0);
    c += vec3(0.95, 0.97, 1.0) * spec * (0.45 + 0.55 * big) + under * caus * 0.35;
    c = mix(under * (0.95 + 0.05 * (1.0 - r)), c, 0.06 + 0.94 * big * big);
    float aa = 1.0 - smoothstep(1.0 - 1.4 / max(b.w * uDpr, 1.0), 1.0, r);
    return mix(under, c, aa);
  }

  void main(){
    vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
    vec2 uv = p / uRes;
    float y01 = uv.y;
    float mm = uS;                      // css px per millimetre on the glass

    /* ---- the glass field ---- */
    vec4 F = texture(uField, uv);
    float kind = step(1.5, F.r);
    float p0 = F.r - 2.0 * kind;
    float age = uT - F.g;
    float g = rec(age, kind);
    // fog nucleates as a speckle of new droplets, the shallow edges first, then the middle
    float nuc = 0.5 * h12(floor(p / max(1.0, 0.28 * mm))) + 0.3 * vnoise(p / (1.1 * mm)) + 0.2 * vnoise(p / (5.0 * mm) + 4.0);
    float fresh = smoothstep(0.0, 0.25, p0) * clamp(p0 * 1.04, 0., 1.);
    float thr = g * 1.12;
    float clr = fresh * smoothstep(thr - 0.06, thr + 0.06, F.a * 0.86 + 0.14 * nuc);
    float veil = (clamp(age / uFade.y, 0., 1.) * 0.12 + 0.45 * g) * step(0.002, p0);

    /* ---- fog ---- */
    vec4 M = texture(uMot, uv);
    float den = 0.80 + 0.24 * smoothstep(0.3, 1.0, y01) + (M.r - 0.5) * 0.28 + (M.g - 0.5) * 0.1 + (M.b - 0.5) * 0.12;
    float lamp = 0.86 + 0.26 * (1.0 - y01) + 0.08 * (1.0 - uv.x);
    vec3 interior = vec3(0.245, 0.272, 0.286);
    vec3 glow = sceneBlur(p) * 3.2 + sceneCore(p) * 0.4;
    vec3 fog = interior * lamp * den + glow * (1.25 - 0.45 * den);
    float grain = h12(floor(p * uDpr) + 0.5) - 0.5;
    float grain2 = vnoise(p * uDpr / 2.3 + 11.0) - 0.5;
    float grain3 = vnoise(p / (0.9 * mm) + 3.0) - 0.5;
    fog *= 1.0 + grain * 0.035 + grain2 * 0.06 + grain3 * 0.05;
    float fogLum = dot(fog, vec3(0.3, 0.5, 0.2));

    // the big droplets suspended in the fog: sparse up high, larger and crowded near the bottom
    float bott = smoothstep(0.45, 1.0, y01);
    vec4 fb = drops(p, max(2.2, 1.3 * mm), mix(0.03, 0.22, bott), max(0.5, 0.18 * mm), max(1.0, mix(0.45, 0.85, bott) * mm), 1.3);
    if (fb.z > 0.0) fog = mix(fog, shadeBead(fb, p, fog, fogLum), 0.85 * (0.35 + 0.65 * bott));
    vec4 fb2 = drops(p, max(4.0, 3.6 * mm), mix(0.03, 0.3, bott * bott), 0.6 * mm, max(1.5, mix(0.8, 1.6, bott) * mm), 7.9);
    if (fb2.z > 0.0) fog = shadeBead(fb2, p, fog, fogLum);

    /* ---- clear glass: the night, rain on the outside ---- */
    vec3 night = sceneSharp(p) * 1.5;
    night = max(mix(vec3(dot(night, vec3(0.3, 0.55, 0.15))), night, 1.25), 0.0);
    // raindrops on the outside, coming and going
    vec4 rd = drops(p, 3.4 * mm, 0.5, 0.5 * mm, 1.7 * mm, 21.0);
    if (rd.z > 0.0){
      vec2 c = floor(p / (3.4 * mm));
      vec3 refr = sceneSharp(p - rd.xy * rd.w * 3.5);
      float r = length(rd.xy);
      vec3 dc = refr * (0.9 - 0.75 * smoothstep(0.5, 1.0, r));
      dc += exp(-dot(rd.xy - vec2(-0.3, -0.45), rd.xy - vec2(-0.3, -0.45)) * 30.0) * 0.25;
      float aa = 1.0 - smoothstep(1.0 - 1.4 / max(rd.w * uDpr, 1.0), 1.0, r);
      night = mix(night, dc, aa * 0.9);
    }
    // a faint reflection of the bus interior in the clear glass
    night += vec3(0.022, 0.026, 0.03) * (0.6 + 0.4 * (1.0 - y01));
    night += vec3(0.11, 0.12, 0.12) * exp(-pow((y01 - 0.06 - 0.04 * uv.x) * 22.0, 2.0)) * 0.5;

    vec3 col = mix(fog, mix(night, fog, veil), clr);
    // the film of water the fingertip leaves for an instant, catching the ceiling lamps
    float wet = exp(-max(age, 0.0) * 3.5) * fresh * (1.0 - kind);
    col += vec3(0.16, 0.17, 0.18) * wet * (0.5 + 0.5 * vnoise(p / (0.6 * mm) + uT * 0.0));

    /* ---- pushed water: rims of beads along the strokes ---- */
    float wv = waterAt(p);
    if (wv > 0.004){
      vec4 rb = rimDrops(p, max(2.0, 0.72 * mm));
      if (rb.z > 0.0) col = mix(col, shadeBead(rb, p, col, fogLum), 0.8);
      col += vec3(0.05, 0.055, 0.06) * smoothstep(0.15, 0.7, wv) * (1.0 - clr);
    }

    /* ---- running drops ---- */
    for (int i = 0; i < 8; i++){
      vec4 D = uDrip[i];
      if (D.w <= 0.0) continue;
      // a teardrop: round and heavy below, drawn up into its own trail above
      vec2 d = (p - D.xy) / D.z;
      d.y = d.y < 0.0 ? d.y / (1.0 + 1.2 * clamp(-d.y, 0.0, 1.5)) * 0.62 : d.y;
      d.x *= 1.0 + 0.35 * clamp(-d.y, 0.0, 1.0);
      float dd = dot(d, d);
      if (dd < 1.0){
        vec4 b = vec4(d, sqrt(1. - dd), D.z);
        col = mix(col, shadeBead(b, p, col, fogLum), D.w * (0.75 + 0.25 * smoothstep(-0.6, 0.2, d.y)));
      }
    }

    /* ---- water lying along the seal, the rubber seal, the bus wall ---- */
    vec2 cc = vec2(uFrame.x - uFrame.z, uFrame.y - uFrame.z);
    vec2 q = vec2(p.x - cc.x, p.y - cc.y);
    float sd; vec2 nrm;
    if (q.x > 0.0 && q.y > 0.0){ sd = length(q) - uFrame.z; nrm = normalize(q); }
    else if (p.x - uFrame.x > p.y - uFrame.y){ sd = p.x - uFrame.x; nrm = vec2(1, 0); }
    else { sd = p.y - uFrame.y; nrm = vec2(0, 1); }
    if (sd < 0.0){
      float e = -sd / mm;                       // mm from the seal
      col *= 1.0 - 0.28 * exp(-e * 0.9) * (0.5 + 0.5 * max(nrm.y, 0.0));
      float pool = smoothstep(7.0, 1.5, e) * (0.3 + 0.7 * max(nrm.y, 0.0));
      if (pool > 0.01){
        vec4 pb = drops(p, 2.4 * mm, 0.55 + 0.4 * pool, 0.5 * mm, mix(0.7, 1.5, pool) * mm, 31.0);
        if (pb.z > 0.0) col = mix(col, shadeBead(pb, p, col, fogLum), pool);
      }
    } else {
      float t = sd / uFrame.w;
      vec3 rub = vec3(0.010, 0.011, 0.013);
            float lit = 0.35 + 0.65 * max(nrm.y, 0.0);
      float lip = exp(-pow((t - 0.16) * 8.0, 2.0)) * 0.16 * lit + exp(-pow((t - 0.55) * 3.5, 2.0)) * 0.03 * lit;
      vec3 seal = rub + vec3(0.85, 0.9, 1.0) * lip + glow * 0.04;
      float tp = (sd - uFrame.w) / mm;
      vec3 panel = vec3(0.085, 0.09, 0.10) * (0.75 + 0.25 * exp(-tp / 40.0)) + glow * 0.025;
      panel *= 1.0 - 0.45 * exp(-tp * 0.6);
      panel += vec3(0.07, 0.075, 0.08) * exp(-pow((tp - 2.0) * 0.9, 2.0)) * lit;
      col = t < 1.0 ? seal : panel;
      col *= 1.0 + (h12(floor(p * uDpr)) - 0.5) * 0.035 + (vnoise(p / (3.0 * mm)) - 0.5) * 0.06;
      
    }
    // the lamp falls off toward the corners
    vec2 vg = (uv - vec2(0.45, 0.35)) * vec2(1.0, 1.2);
    col *= 1.0 - 0.32 * smoothstep(0.25, 1.0, length(vg));

    col = 1.0 - exp(-col * 1.18);
    col += (h12(gl_FragCoord.xy + 0.37) - 0.5) / 255.0;
    o = vec4(col, 1.0);
  }`;

  /* ------------------------------------------------------------------ the night outside */
  function paintNight(rng, per, H, s, sc, anchors) {
    const cw = Math.ceil(per * sc), ch = Math.ceil(H * sc);
    const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };
    const far = mk(), near = mk();
    const fx = far.getContext('2d'), nx = near.getContext('2d');
    nx.fillStyle = '#000'; nx.fillRect(0, 0, cw, ch);   // opaque, so the upload never un-premultiplies
    const rgba = (c, a) => 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + clamp(a, 0, 1).toFixed(4) + ')';
    const yH = 0.6;                    // where the far kerb meets the road
    const R = 15 * s * sc;             // the defocus disc of a distant light

    const SODIUM = [1.0, 0.50, 0.15], SODIUM2 = [1.0, 0.64, 0.28], WARM = [1.0, 0.76, 0.48], COOL = [0.78, 0.9, 1.0];
    const FLUO = [0.74, 1.0, 0.84], RED = [1.0, 0.1, 0.05], GREEN = [0.1, 1.0, 0.6], AMBER = [1.0, 0.56, 0.04];
    const PINK = [1.0, 0.2, 0.48], CYAN = [0.2, 0.82, 1.0], WHITE = [0.96, 0.97, 1.0], LED = [0.86, 0.9, 1.0];
    const BLUE = [0.25, 0.4, 1.0];

    // sky: full resolution gradient so nothing bands
    {
      const gr = fx.createLinearGradient(0, 0, 0, ch);
      gr.addColorStop(0, '#05070d'); gr.addColorStop(0.28, '#0b0b13'); gr.addColorStop(0.46, '#211410');
      gr.addColorStop(yH - 0.02, '#341e11'); gr.addColorStop(yH + 0.015, '#09080a'); gr.addColorStop(0.8, '#0b0a0c'); gr.addColorStop(1, '#0d0c0e');
      fx.fillStyle = gr; fx.fillRect(0, 0, cw, ch);
      // roofs against the skyglow, defocused: painted at the size of a blur disc and enlarged
      const k = Math.max(2, R * 0.8);
      const lw = Math.ceil(cw / k) + 2, lh = Math.ceil(ch / k) + 2;
      const lo = document.createElement('canvas'); lo.width = lw; lo.height = lh;
      const lx = lo.getContext('2d');
      lx.fillStyle = 'rgba(3,3,5,0.88)';
      let x = 0;
      while (x < lw) {
        const bw = Math.max(2, lw * (0.03 + rng() * 0.08)), top = lh * (0.2 + rng() * 0.28);
        lx.fillRect(x, top, bw + 0.5, lh * yH - top);
        x += bw;
      }
      fx.imageSmoothingEnabled = true;
      fx.drawImage(lo, 0, 0, lw * k, lh * k);
    }

    const disc = (ctx, x, y, r, col, I, soft) => {
      I = Math.min(1, I);
      const e = soft || 0.1;
      for (const ox of [-cw, 0, cw]) {
        const X = x + ox;
        if (X + r < 0 || X - r > cw) continue;
        const g = ctx.createRadialGradient(X, y, 0, X, y, r);
        g.addColorStop(0, rgba(col, I * 0.8));
        g.addColorStop(Math.max(0.01, 1 - e * 3.5), rgba(col, I * 0.9));
        g.addColorStop(1 - e, rgba(col, I));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, y, r, 0, TAU); ctx.fill();
      }
    };
    const halo = (ctx, x, y, r, col, I) => {
      for (const ox of [-cw, 0, cw]) {
        const X = x + ox;
        if (X + r < 0 || X - r > cw) continue;
        const g = ctx.createRadialGradient(X, y, 0, X, y, r);
        g.addColorStop(0, rgba(col, I)); g.addColorStop(0.3, rgba(col, I * 0.4)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, y, r, 0, TAU); ctx.fill();
      }
    };
    // a light's reflection on the wet road: a long shivering column, not a string of beads
    const reflect = (ctx, x, y, r, col, I) => {
      const y0 = ch * (yH + 0.025) + (y > ch * yH ? (y - ch * yH) * 1.2 : 0);
      const len = (ch - y0) * (0.5 + 0.5 * rng());
      const n = Math.ceil(len / (r * 0.22));
      let xx = x, ph = rng() * 9;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        xx = x + Math.sin(t * 17 + ph) * r * 0.12 + Math.sin(t * 43 + ph * 2) * r * 0.06;
        const flick = 0.55 + 0.45 * Math.sin(t * 31 + ph * 3) * Math.sin(t * 7 + ph);
        const rr = r * (0.62 + 0.18 * Math.sin(t * 13 + ph) + 0.25 * t);
        disc(ctx, xx, y0 + len * t, rr, col, I * Math.pow(1 - t, 1.3) * flick * 0.22, 0.45);
      }
    };

    nx.globalCompositeOperation = 'lighter';
    fx.globalCompositeOperation = 'lighter';

    // far: windows of flats and offices
    for (let b = 0; b < 30; b++) {
      const bx = rng() * cw, by = ch * (0.08 + rng() * 0.34);
      const cols = 2 + Math.floor(rng() * 6), rows = 1 + Math.floor(rng() * 5);
      const dx = R * (0.7 + rng() * 0.6), dy = R * (0.8 + rng() * 0.6);
      const tint = [WARM, COOL, FLUO, WARM, SODIUM2, WARM, WHITE][Math.floor(rng() * 7)];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (rng() < 0.5) continue;
        disc(fx, bx + i * dx, by + j * dy, R * (0.6 + rng() * 0.15), rng() < 0.2 ? WARM : tint, 0.1 + rng() * 0.28, 0.12);
      }
    }
    // a red lamp high on a crane
    disc(fx, rng() * cw, ch * (0.05 + rng() * 0.08), R * 0.55, RED, 0.5, 0.1);
    // far kerb: lamps, signs, a dim crowd of lights
    for (let x = rng() * 60; x < cw; x += (50 + rng() * 90) * s * sc) {
      disc(fx, x, ch * (yH - 0.06 - rng() * 0.07), R * (0.55 + rng() * 0.2), rng() < 0.7 ? SODIUM : [LED, WARM, COOL][Math.floor(rng() * 3)], 0.14 + rng() * 0.25, 0.12);
    }

    // near: street lamps
    const lampY = ch * (0.25 + rng() * 0.05);
    let lx = rng() * 200 * sc;
    const lampGap = Math.max(cw / 6, 190 * s * sc);
    while (lx < cw) {
      const y = lampY + (rng() - 0.5) * ch * 0.07;
      const c = rng() < 0.8 ? SODIUM : LED;
      halo(nx, lx, y, R * 4, c, 0.025);
      disc(nx, lx, y, R * 1.05, c, 0.95, 0.06);
      reflect(nx, lx, y, R * 1.05, c, 1.0);
      lx += lampGap * (0.75 + rng() * 0.5);
    }
    // the street at eye level: shop windows, signs, a bus stop, a dense overlapping field of light
    const nShop = 7 + Math.floor(rng() * 3);
    for (let k = 0; k < nShop; k++) {
      const x0 = rng() * cw, y0 = ch * (0.45 + rng() * 0.11);
      const n = 3 + Math.floor(rng() * 6);
      const tint = [WHITE, WHITE, COOL, FLUO, WARM, WARM][Math.floor(rng() * 6)];
      for (let i = 0; i < n; i++) {
        const xx = x0 + i * R * (0.55 + rng() * 0.5), yy = y0 + (rng() - 0.5) * R * 1.1;
        disc(nx, xx, yy, R * (0.85 + rng() * 0.3), tint, 0.12 + rng() * 0.32, 0.09);
      }
      reflect(nx, x0 + n * R * 0.4, y0, R * 1.3, tint, 0.55);
      if (rng() < 0.65) {
        const nc = [PINK, CYAN, GREEN, RED, AMBER, BLUE][Math.floor(rng() * 6)];
        const sx = x0 - R * (0.5 + rng() * 1.5), sy = y0 - R * (1.0 + rng() * 1.5);
        disc(nx, sx, sy, R * 0.85, nc, 0.6, 0.08);
        if (rng() < 0.5) disc(nx, sx + R * 0.8, sy, R * 0.85, nc, 0.5, 0.08);
        reflect(nx, sx, sy, R * 0.8, nc, 0.6);
      }
    }
    for (let k = 0; k < 230; k++) {
      const c = [WARM, WHITE, SODIUM2, COOL, RED, WARM, PINK, FLUO, AMBER][Math.floor(rng() * 9)];
      disc(nx, rng() * cw, ch * (0.18 + rng() * 0.45), R * (0.45 + rng() * 0.5), c, 0.05 + rng() * 0.25, 0.12);
    }
    // signals at a junction
    const nSig = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < nSig; k++) {
      const x = (cw * (0.12 + 0.33 * k + 0.15 * rng())) % cw, y = ch * (0.41 + rng() * 0.05);
      const red = k === 0 ? true : rng() < 0.55;
      const c = red ? RED : GREEN;
      halo(nx, x, y, R * 3, c, 0.03);
      disc(nx, x, y, R * 0.9, c, 0.95, 0.06);
      disc(nx, x + R * 0.08, y + R * 1.9, R * 0.88, AMBER, 0.05, 0.1);
      reflect(nx, x, y, R * 0.9, c, 0.9);
      const x2 = x + R * (5 + rng() * 6);
      disc(nx, x2, y + ch * 0.035, R * 0.8, c, 0.55, 0.08);
      reflect(nx, x2, y + ch * 0.035, R * 0.75, c, 0.6);
    }
    // cars: tail lights, a headlight, a taxi's sign
    const nCar = 4 + Math.floor(rng() * 4);
    for (let k = 0; k < nCar; k++) {
      const x = rng() * cw, y = ch * (yH + 0.005 + rng() * 0.05);
      const tail = rng() < 0.72;
      const c = tail ? RED : [1.0, 0.93, 0.78];
      const gap = R * (2.0 + rng() * 0.6);
      disc(nx, x, y, R * 0.9, c, tail ? 0.75 : 0.9, 0.07);
      disc(nx, x + gap, y, R * 0.9, c, tail ? 0.75 : 0.9, 0.07);
      reflect(nx, x, y, R * 0.95, c, tail ? 0.7 : 0.8);
      reflect(nx, x + gap, y, R * 0.95, c, tail ? 0.7 : 0.8);
      if (!tail && rng() < 0.5) disc(nx, x + gap / 2, y - R * 1.4, R * 0.6, AMBER, 0.6, 0.08);
    }
    // a few lights placed behind the drawing as the viewer arrives, so the lines glow with them
    for (const a of anchors || []) {
      const x = a.x * sc, y = a.y * sc;
      const c = { SODIUM, RED, WHITE, GREEN, AMBER, COOL }[a.c];
      if (a.c === 'SODIUM') halo(nx, x, y, R * 4, c, 0.025);
      disc(nx, x, y, R * (a.r || 1), c, a.i, 0.06);
      if (a.pair) disc(nx, x + R * 2.1, y + R * 0.1, R * (a.r || 1), c, a.i * 0.9, 0.06);
    }
    return { far, near };
  }

  /* ------------------------------------------------------------------ the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'breath',
    title: 'Breath',
    medium: 'Fingertip on condensation, night bus window',
    note: 'Draw on the glass. It will fog over again.',
    about: 'Someone on the last bus home drew the stranger asleep across the aisle on the fogged window, in six strokes of one finger. The drawing is made of absence: where the finger wiped, the city shows through, and the breath of the passengers slowly takes it back.',
    tone: 'light',
    room: '#3a3f42',

    mount(el, api) {
      const seed = api.seed >>> 0;
      const rng = mulberry32(seed ^ 0xB4EA7);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair';
      el.appendChild(canvas);
      el.style.background = '#3a3f42';
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!gl) {
        el.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cfd3d4;font:italic 18px serif">This window needs WebGL2 to fog up.</div>';
        api.ready();
        return { destroy() {} };
      }

      /* ---------- GL helpers ---------- */
      const compile = (type, src) => {
        const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        return sh;
      };
      const program = (fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(pr, 0, 'a'); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const U = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(pr, i); const nm = info.name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(pr, info.name); }
        return { pr, U };
      };
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const tex = (w, h, ifmt, fmt, type, data, wrapS, filt) => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data || null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS || gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt || gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return t;
      };
      const fbo = (t) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; };

      let P_BLUR, P_MOT, P_MAIN;
      try { P_BLUR = program(FS_BLUR); P_MOT = program(FS_MOT); P_MAIN = program(FS_MAIN); }
      catch (e) { console.error(e); el.textContent = 'The window failed to fog: ' + e.message; api.ready(); return { destroy() {} }; }

      /* ---------- state ---------- */
      const DEFS = STROKES();
      const bb = (() => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const s of DEFS) for (const q of s.pts) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return { x0: a, y0: b, x1: c, y1: d, w: c - a, h: d - b, cx: (a + c) / 2, cy: (b + d) / 2 }; })();

      let blurGain = 1;
      let W = 0, H = 0, dpr = 1, S = 1, glassB = 0, per = 0, frameR = [0, 0, 1, 1];
      let fw = 0, fh = 0, fsc = 1;
      let Fd = null, sid = null, dmin = null, baseR = null, baseG = null, baseW = null, baseA = null;
      let texField = null, texMot = null, scene = null;
      let dirty = null;
      let cycles = [], cycleIdx = 0, nextCycleAt = 0, strokeId = 1;
      let drips = [], pools = [];
      let mapPt = null;
      let alive = true, raf = 0, started = false, readyCalled = false;
      let clockBase = performance.now() / 1000, rebased = 0;
      const now = () => performance.now() / 1000 - clockBase - rebased;
      const fingerRng = mulberry32(seed ^ 0x51F7);

      function markDirty(x0, y0, x1, y1) {
        if (!dirty) dirty = [x0, y0, x1, y1];
        else { dirty[0] = Math.min(dirty[0], x0); dirty[1] = Math.min(dirty[1], y0); dirty[2] = Math.max(dirty[2], x1); dirty[3] = Math.max(dirty[3], y1); }
      }

      /* ---------- the finger ---------- */
      // one press of the fingertip, centred on (x, y) field px, moving along (tx, ty)
      function stamp(id, x, y, tx, ty, hw, P, vn, arc, t, extraW, ridgeSeed) {
        const edge = 0.32 * hw + 1.2;
        const rimW = 0.16 * hw + 0.9;
        const rimC = hw + 0.1 * edge;
        const Rr = hw + edge + rimW * 3;
        const x0 = Math.max(0, Math.floor(x - Rr)), x1 = Math.min(fw - 1, Math.ceil(x + Rr));
        const y0 = Math.max(0, Math.floor(y - Rr)), y1 = Math.min(fh - 1, Math.ceil(y + Rr));
        if (x0 > x1 || y0 > y1) return;
        const nx = -ty, ny = tx;
        const core = clamp(0.99 - 0.2 * vn - 0.45 * Math.max(0, 0.7 - P), 0.42, 0.99);
        const ridgeAmp = clamp(0.05 + 0.18 * vn + 0.7 * Math.max(0, 0.85 - P), 0, 0.5);
        const lam0 = Math.max(1.8, 0.55 * S * fsc);
        const ph1 = ridgeSeed * 6.283, ph2 = ridgeSeed * 17.0;
        const rimAmt = (0.5 + 0.5 * P) * (1 - 0.45 * vn);
        for (let yy = y0; yy <= y1; yy++) {
          const dy = yy + 0.5 - y;
          for (let xx = x0; xx <= x1; xx++) {
            const dx = xx + 0.5 - x;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > Rr) continue;
            const i = yy * fw + xx, j = i * 4;
            if (sid[i] === id) { if (dist >= dmin[i]) continue; }
            else {
              sid[i] = id;
              baseR[i] = Fd[j]; baseG[i] = Fd[j + 1]; baseA[i] = Fd[j + 3];
              baseW[i] = Fd[j + 2] * Math.exp(-Math.max(0, t - Fd[j + 1]) / TW);
            }
            dmin[i] = dist;
            const across = dx * nx + dy * ny;
            const m = 1 - smooth(hw - edge, hw + 0.35 * edge, dist);
            let pN = 0, dep = 0;
            if (m > 0) {
              const aa = Math.abs(across);
              // the ridges of a fingerprint dragged along: faint, uneven, drifting arcs, broken up
              const lam = lam0 * (1 + 0.28 * Math.sin(across * 0.06 + ph1));
              const rp = across / lam + 0.9 * Math.sin(arc * 0.011 + ph2) + 0.45 * Math.sin(across * 0.11 + ph1) + 0.2 * Math.sin(arc * 0.037 + across * 0.05);
              const rv = 0.5 + 0.5 * Math.cos(TAU * rp);
              const broken = smooth(0.3, 0.8, 0.5 + 0.5 * Math.sin(arc * 0.085 + across * 0.19 + ph2 * 1.3) * Math.sin(arc * 0.029 + ph1));
              const contrast = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(across * 0.33 + ph2 * 2.1));
              const ridge = ridgeAmp * rv * broken * contrast * (0.5 + 0.5 * smooth(0, hw, aa));
              pN = m * core * (1 - ridge);
              const u = dist / hw;
              dep = m * clamp(1 - u * u * 0.8, 0, 1) * (1 - 0.3 * ridge) * (0.75 + 0.25 * Math.min(1, P));
            }
            const dr = (dist - rimC) / rimW;
            const wv = 0.55 + 0.45 * Math.sin(arc * 0.021 + ph1 + (across > 0 ? 1.7 : 0)) * Math.sin(arc * 0.0067 + ph2);
            let rw = Math.exp(-dr * dr) * rimAmt * wv;
            if (extraW > 0) { const de = (dist - rimC) / (rimW * 2.2); rw += extraW * Math.exp(-de * de); }
            const bc = effClear(baseR[i], baseG[i], baseA[i], t);
            if (pN > bc || bc <= 0.002) { Fd[j] = pN; Fd[j + 1] = t; Fd[j + 3] = dep; }
            else { Fd[j] = baseR[i]; Fd[j + 1] = baseG[i]; Fd[j + 3] = baseA[i]; }
            Fd[j + 2] = Math.min(1.25, baseW[i] * (1 - m) + rw);
          }
        }
        markDirty(x0, y0, x1 + 1, y1 + 1);
      }

      // a drip's trail: a narrow clean channel with a few beads left behind
      function stampDrip(id, x, y, r, t) {
        const Rr = r * 1.6;
        const x0 = Math.max(0, Math.floor(x - Rr)), x1 = Math.min(fw - 1, Math.ceil(x + Rr));
        const y0 = Math.max(0, Math.floor(y - Rr)), y1 = Math.min(fh - 1, Math.ceil(y + Rr));
        if (x0 > x1 || y0 > y1) return;
        for (let yy = y0; yy <= y1; yy++) {
          const dy = yy + 0.5 - y;
          for (let xx = x0; xx <= x1; xx++) {
            const dx = xx + 0.5 - x;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > Rr) continue;
            const i = yy * fw + xx, j = i * 4;
            if (sid[i] === id) { if (dist >= dmin[i]) continue; }
            else { sid[i] = id; baseR[i] = Fd[j]; baseG[i] = Fd[j + 1]; baseA[i] = Fd[j + 3]; baseW[i] = Fd[j + 2] * Math.exp(-Math.max(0, t - Fd[j + 1]) / TW); }
            dmin[i] = dist;
            const m = 1 - smooth(r * 0.55, r * 0.95, dist);
            const pN = m * 0.93;
            const u = dist / r;
            const bc = effClear(baseR[i], baseG[i], baseA[i], t);
            if (pN > bc || bc <= 0.002) { Fd[j] = pN > 0 ? 2 + pN : 0; Fd[j + 1] = t; Fd[j + 3] = m * clamp(1 - u * u * 0.7, 0, 1); }
            else { Fd[j] = baseR[i]; Fd[j + 1] = baseG[i]; Fd[j + 3] = baseA[i]; }
            const de = (dist - r) / (0.35 * r + 0.6);
            Fd[j + 2] = Math.min(1.25, baseW[i] * (1 - m) + 0.16 * m + 0.35 * Math.exp(-de * de));
          }
        }
        markDirty(x0, y0, x1 + 1, y1 + 1);
      }

      /* ---------- strokes: path, speed, pressure ---------- */
      function buildStroke(def, map, r) {
        const amp = def.jit != null ? def.jit : 1.8;
        const a1 = r() * 9, a2 = r() * 9;
        const ptsMm = def.pts.map((q, i) => [q[0] + amp * (0.7 * Math.sin(i * 0.9 + a1) + 0.6 * (r() - 0.5)), q[1] + amp * (0.7 * Math.sin(i * 1.13 + a2) + 0.6 * (r() - 0.5))]);
        const pts = crSample(ptsMm.map(map), 0.6);
        const n = pts.length;
        const arc = new Float32Array(n), tx = new Float32Array(n), ty = new Float32Array(n);
        for (let i = 1; i < n; i++) arc[i] = arc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        for (let i = 0; i < n; i++) {
          const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n - 1, i + 2)];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          tx[i] = (b[0] - a[0]) / l; ty[i] = (b[1] - a[1]) / l;
        }
        const L = arc[n - 1];
        const mmPx = S * fsc;
        // curvature -> speed (the two-thirds power law of the hand)
        const v = new Float32Array(n), K = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const i0 = Math.max(0, i - 6), i1 = Math.min(n - 1, i + 6);
          let da = Math.atan2(ty[i1], tx[i1]) - Math.atan2(ty[i0], tx[i0]);
          while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          const k = Math.abs(da) / Math.max(1e-3, (arc[i1] - arc[i0]) / mmPx); // 1/mm
          v[i] = Math.pow(k + 0.006, -1 / 3);
          K[i] = k;
        }
        { const Ks = new Float32Array(n); for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let k = -24; k <= 24; k++) { const q = i + k; if (q >= 0 && q < n) { a += K[q]; c++; } } Ks[i] = a / c; } K.set(Ks); }
        const vs = new Float32Array(n);
        for (let i = 0; i < n; i++) { let acc = 0, c = 0; for (let k = -8; k <= 8; k++) { const q = i + k; if (q >= 0 && q < n) { acc += v[q]; c++; } } vs[i] = acc / c; }
        const flick = def.end === 'flick';
        for (let i = 0; i < n; i++) {
          const sMm = arc[i] / mmPx, eMm = (L - arc[i]) / mmPx;
          let env = 0.22 + 0.78 * smooth(0, 14, sMm);
          env *= flick ? 1 + 0.5 * smooth(30, 0, eMm) : 0.25 + 0.75 * smooth(0, 18, eMm);
          vs[i] *= env;
        }
        const time = new Float32Array(n);
        for (let i = 1; i < n; i++) time[i] = time[i - 1] + (arc[i] - arc[i - 1]) / Math.max(1e-3, 0.5 * (vs[i] + vs[i - 1]));
        const dur = def.dur * (0.9 + 0.2 * r());
        const k = dur / time[n - 1];
        for (let i = 0; i < n; i++) time[i] *= k;
        // pressure and width
        const press = def.press * (0.94 + 0.12 * r());
        const tail = clamp(0.07 * L / mmPx, 7, 16);
        const wob = r() * 9;
        const P = new Float32Array(n), HW = new Float32Array(n), VN = new Float32Array(n);
        const hw0 = 8.0 * mmPx * (def.w || 1) * (0.96 + 0.08 * r());
        for (let i = 0; i < n; i++) {
          const sMm = arc[i] / mmPx, eMm = (L - arc[i]) / mmPx;
          let p = press * (1 + 0.07 * Math.sin(sMm * 0.06 + wob) + 0.04 * Math.sin(sMm * 0.21 + wob * 2));
          if (def.pk) {
            const u = arc[i] / L; let k = 0;
            while (k < def.pk.length - 2 && def.pk[k + 1][0] < u) k++;
            const A = def.pk[k], B = def.pk[k + 1];
            p *= A[1] + (B[1] - A[1]) * smooth(A[0], B[0], u);
          }
          p += 0.1 * Math.exp(-sMm / 5);                                  // the landing press
          // lift-off while moving: the pad peels away, pressure falls, but the swathe stays blunt
          const lift = flick ? smooth(tail, 0, eMm) : 0;
          if (flick) p *= 1 - 0.72 * lift;
          P[i] = p;
          const vmm = (i > 0 ? (arc[i] - arc[i - 1]) / Math.max(1e-4, time[i] - time[i - 1]) : 0) / mmPx;
          VN[i] = clamp((vmm - 70) / 520, 0, 1);
          // a slow curve lets the pad roll flatter and wider; the finger's angle drifts as the wrist turns
          const roll = 1 + 0.2 * (1 - VN[i]) * clamp(K[i] * 18, 0, 1);
          const angle = 1 + 0.1 * Math.sin(sMm * 0.035 + wob * 1.7) + 0.05 * Math.sin(sMm * 0.11 + wob);
          const smear = flick ? 1 + 0.12 * Math.sin(Math.PI * lift) + lift * (0.05 * Math.sin(sMm * 0.7 + wob) + 0.04 * Math.sin(sMm * 1.9 + wob * 3)) : 1 + 0.03 * smooth(4, 0, eMm);
          HW[i] = hw0 * (0.42 + 0.58 * Math.pow(clamp(p, 0, 1.35), 0.8)) * (1 - 0.3 * VN[i]) * roll * angle * smear + hw0 * 0.06 * Math.exp(-sMm / 4);
        }
        // where water gathers: the low points of the stroke and a finger that stops
        const pool = new Float32Array(n);
        for (let i = 6; i < n - 6 && L / mmPx > 70; i++) {
          if (Math.abs(ty[i]) < 0.12 && pts[i][1] >= pts[i - 6][1] && pts[i][1] >= pts[i + 6][1]) {
            for (let k = -14; k <= 14; k++) { const q = i + k; if (q > 0 && q < n) pool[q] = Math.max(pool[q], 0.45 * Math.exp(-k * k / 60)); }
          }
        }
        const long = L / mmPx > 70;
        if (!flick && long) for (let k = 0; k < 10; k++) pool[n - 1 - k] = Math.max(pool[n - 1 - k], 0.7 * (1 - k / 10));
        if (long) for (let k = 0; k < 8; k++) pool[k] = Math.max(pool[k], 0.35 * (1 - k / 8));
        return { def, pts, arc, tx, ty, time, P, HW, VN, pool, n, L, dur, k: 0, lastArc: -1e9, id: 0, t0: 0, done: false, ridge: r(), poolsOut: [] };
      }

      function advanceStroke(st, tNow) {
        if (st.done || tNow < st.t0) return;
        const tau = tNow - st.t0;
        while (st.k < st.n && st.time[st.k] <= tau) {
          const i = st.k;
          const sp = Math.max(0.6, st.HW[i] * 0.1);
          if (st.arc[i] - st.lastArc >= sp || i === st.n - 1) {
            stamp(st.id, st.pts[i][0], st.pts[i][1], st.tx[i], st.ty[i], st.HW[i], st.P[i], st.VN[i], st.arc[i], st.t0 + st.time[i], st.pool[i], st.ridge);
            st.lastArc = st.arc[i];
            if (st.pool[i] > 0.4 && st.ty[i] < 0.5) {
              const last = st.poolsOut[st.poolsOut.length - 1];
              if (!last || Math.hypot(last.x - st.pts[i][0], last.y - st.pts[i][1]) > 20)
                st.poolsOut.push({ x: st.pts[i][0], y: st.pts[i][1] + st.HW[i] + 1.5, t: st.t0 + st.time[i], w: st.pool[i] });
            }
          }
          st.k++;
        }
        if (st.k >= st.n) { st.done = true; for (const q of st.poolsOut) pools.push(q); }
      }

      function makeCycle(t0, ci) {
        const r = mulberry32((seed ^ Math.imul(ci + 1, 0x9E3779B1)) >>> 0);
        const tx = (r() - 0.5) * 6, ty = (r() - 0.5) * 6, rot = (r() - 0.5) * 0.03, sc = 1 + (r() - 0.5) * 0.03;
        const cr = Math.cos(rot) * sc, sr = Math.sin(rot) * sc;
        const map = ([x, y]) => { const X = x - bb.cx, Y = y - bb.cy; return mapPt([bb.cx + X * cr - Y * sr + tx, bb.cy + X * sr + Y * cr + ty]); };
        const strokes = DEFS.map((d) => buildStroke(d, map, r));
        let t = t0;
        strokes.forEach((st) => { t += st.def.pause * (0.75 + 0.5 * r()); st.t0 = t; st.id = strokeId++; t += st.time[st.n - 1]; });
        return { strokes, end: t, ci, dripsPlanned: false, r };
      }

      /* ---------- drips ---------- */
      function planDrips(cy, tNow, first) {
        const cand = pools.filter((q) => q.t >= tNow - 60).sort((a, b) => b.w - a.w || b.y - a.y);
        pools = [];
        if (!cand.length) return;
        const r = cy.r;
        const n = first ? 2 : (r() < 0.7 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
        for (let k = 0; k < n && cand.length; k++) {
          const q = cand.splice(Math.floor(r() * Math.min(cand.length, 4)), 1)[0];
          const delay = first ? (k === 0 ? 2.5 + r() * 2 : 16 + r() * 20) : 5 + r() * 28;
          drips.push({ x: q.x, y: q.y, r: Math.max(2.4, (2.0 + r() * 0.8) * S * fsc), start: Math.max(tNow, q.t) + delay, state: 'wait',
            vy0: (5 + r() * 7) * S * fsc, travel: 0, maxTravel: fh * (0.1 + r() * 0.22), pause: 0, ph: r() * 9, id: strokeId++, a: 0, endT: 0 });
        }
      }
      function updateDrips(tNow, dt) {
        for (const d of drips) {
          if (d.state === 'wait') { if (tNow >= d.start) { d.state = 'run'; d.a = 1; } else continue; }
          if (d.state === 'run') {
            if (d.pause > 0) { d.pause -= dt; continue; }
            const v = d.vy0 * (0.55 + 0.45 * Math.sin(tNow * 0.9 + d.ph) * Math.sin(tNow * 0.37 + d.ph * 2) + 0.4);
            const dy = v * dt;
            const steps = Math.max(1, Math.ceil(dy / 0.7));
            for (let k = 0; k < steps; k++) {
              d.y += dy / steps;
              d.x += Math.sin(d.y * 0.045 + d.ph) * 0.07 + Math.sin(d.y * 0.013 + d.ph * 3) * 0.08;
              stampDrip(d.id, d.x, d.y - d.r * 0.25, d.r, tNow);
            }
            d.travel += dy;
            d.r = Math.min(d.r * (1 + dt * 0.012), 3.6 * S * fsc);
            if (fingerRng() < dt * 0.22) {
              // it stalls on a clean patch, gathers, and sets off again a little to one side
              d.pause = 0.3 + fingerRng() * 2.2;
              d.kick = (fingerRng() - 0.5) * d.r * 1.4;
            }
            if (d.kick) { const kk = d.kick * Math.min(1, dt * 3); d.x += kk; d.kick -= kk; if (Math.abs(d.kick) < 0.02) d.kick = 0; }
            if (d.travel > d.maxTravel || d.y > glassB * fsc - d.r * 1.5) { d.state = 'rest'; d.endT = tNow; }
          } else if (d.state === 'rest') {
            d.a = clamp(1 - (tNow - d.endT) / 70, 0, 1);
            if (d.a <= 0) d.state = 'gone';
          }
        }
        drips = drips.filter((d) => d.state !== 'gone');
        while (drips.length > 8) { const k = drips.findIndex((d) => d.state === 'rest'); drips.splice(k >= 0 ? k : 0, 1); }
      }

      /* ---------- the viewer's finger ---------- */
      let user = null;
      function userPoint(e) {
        const r = canvas.getBoundingClientRect();
        return [(e.clientX - r.left) * fsc, (e.clientY - r.top) * fsc, performance.now() / 1000];
      }
      function userStamp(x, y, tx, ty, v, P) {
        const vn = clamp((v / (S * fsc) - 70) / 520, 0, 1);
        const hw = 8.0 * S * fsc * (0.22 + 0.78 * Math.pow(P, 0.7)) * (1 - 0.24 * vn);
        user.arc += 0;
        stamp(user.id, x, y, tx, ty, hw, P, vn, user.arc, now(), user.arc < 6 * S ? 0.3 : 0, user.ridge);
      }
      function userMove(x, y, tt, pr) {
        const dx = x - user.x, dy = y - user.y, l = Math.hypot(dx, dy);
        if (l < 0.5) return;
        const dtt = Math.max(1 / 240, tt - user.t);
        const v = l / dtt;
        user.v = user.v * 0.7 + v * 0.3;
        const tx = dx / l, ty = dy / l;
        const sp = 1.2;
        const n = Math.ceil(l / sp);
        for (let k = 1; k <= n; k++) {
          const f = k / n;
          user.arc += l / n;
          const P = clamp(pr * (1 + 0.12 * Math.exp(-user.arc / (5 * S))), 0.2, 1.2);
          userStamp(user.x + dx * f, user.y + dy * f, tx, ty, user.v, P);
        }
        user.x = x; user.y = y; user.t = tt; user.tx = tx; user.ty = ty;
      }
      const onDown = (e) => {
        if (!alive) return;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        const [x, y, tt] = userPoint(e);
        user = { id: strokeId++, x, y, t: tt, v: 0, arc: 0, tx: 1, ty: 0, ridge: fingerRng(), pid: e.pointerId };
        const pr = e.pointerType === 'mouse' ? 0.9 : clamp((e.pressure || 0.5) * 1.6, 0.5, 1.1);
        userStamp(x, y, 1, 0, 0, pr * 1.12);
      };
      const onMove = (e) => {
        if (!user || e.pointerId !== user.pid) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of (evs.length ? evs : [e])) {
          const [x, y, tt] = userPoint(ev);
          const pr = ev.pointerType === 'mouse' ? 0.9 : clamp((ev.pressure || 0.5) * 1.6, 0.5, 1.1);
          userMove(x, y, tt, pr);
        }
      };
      const onUp = (e) => {
        if (!user || e.pointerId !== user.pid) return;
        // the lift: a short comet tail in the direction of travel
        const len = clamp(user.v * 0.03, 2, 14 * S) ;
        const n = Math.ceil(len / 1.2);
        for (let k = 1; k <= n; k++) {
          const f = k / n;
          user.arc += len / n;
          userStamp(user.x + user.tx * len * f, user.y + user.ty * len * f, user.tx, user.ty, user.v, 0.9 * (1 - f) + 0.05);
        }
        user = null;
      };
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);

      /* ---------- build everything for a size ---------- */
      function layout() {
        const asp = W / H;
        let s, cx, cy;
        if (asp < 0.85) { s = Math.min(0.5 * H / bb.h, 1.04 * W / bb.w); cx = W * 0.55; cy = H * 0.41; }
        else { s = Math.min((asp > 2 ? 0.68 : 0.6) * H / bb.h, 0.5 * W / bb.w); cx = W * (asp > 2 ? 0.56 : 0.6); cy = H * 0.46; }
        S = s;
        mapPt = ([x, y]) => [(cx + (x - bb.cx) * s) * fsc, (cy + (y - bb.cy) * s) * fsc];
        const sw = clamp(11 * S, 9, 22);
        frameR = [W - clamp(0.012 * W, 6, 20) + sw * 0.4, H - clamp(0.018 * H, 10, 20), clamp(60 * S, 36, 120), sw];
        glassB = frameR[1];
      }

      function build() {
        const r = el.getBoundingClientRect();
        W = Math.max(64, Math.round(r.width)); H = Math.max(64, Math.round(r.height));
        dpr = Math.min(2, window.devicePixelRatio || 1);
        if (W * H * dpr * dpr > 6.5e6) dpr = Math.max(1, Math.sqrt(6.5e6 / (W * H)));
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        fsc = W * H > 2.4e6 ? Math.sqrt(2.4e6 / (W * H)) : 1;
        fw = Math.max(8, Math.round(W * fsc)); fh = Math.max(8, Math.round(H * fsc));
        layout();

        // field
        Fd = new Float32Array(fw * fh * 4);
        for (let i = 0; i < fw * fh; i++) Fd[i * 4 + 1] = -1000;
        sid = new Int32Array(fw * fh); dmin = new Float32Array(fw * fh);
        baseR = new Float32Array(fw * fh); baseG = new Float32Array(fw * fh); baseW = new Float32Array(fw * fh); baseA = new Float32Array(fw * fh);
        if (texField) gl.deleteTexture(texField);
        texField = tex(fw, fh, gl.RGBA16F, gl.RGBA, gl.FLOAT, Fd);

        // the night
        per = Math.ceil(Math.max(W * 1.6, H * 1.2, 900));
        const sc = Math.min(1, 4096 / per, Math.sqrt(3.2e6 / (per * H)));
        const rs = mulberry32(seed ^ 0xC17E);
        // where the strokes will be at this moment, in the near layer's own coordinates
        const offN = (((now() + rebased) * 7.5 * (W / 1600)) % per + per) % per;
        const at = (name, f) => {
          const d = DEFS.find((q) => q.name === name); if (!d) return null;
          const u = f * (d.pts.length - 1), i = Math.min(d.pts.length - 2, Math.floor(u)), t = u - i;
          const q = mapPt([d.pts[i][0] + (d.pts[i + 1][0] - d.pts[i][0]) * t, d.pts[i][1] + (d.pts[i + 1][1] - d.pts[i][1]) * t]);
          return [((q[0] / fsc + offN) % per + per) % per, q[1] / fsc];
        };
        const anchors = [];
        const A1 = at('hair', 0.36), A2 = at('chin-throat', 0.7), A3 = at('brow-nose', 0.3), A4 = at('shoulder', 0.6);
        if (A1) anchors.push({ x: A1[0], y: A1[1], c: 'SODIUM', i: 0.95, r: 1.05 });
        if (A2) anchors.push({ x: A2[0] - 15 * S, y: A2[1], c: 'RED', i: 0.85, r: 0.85, pair: true });
        if (A3) anchors.push({ x: A3[0], y: A3[1], c: 'WHITE', i: 0.5, r: 0.9 });
        if (A4) anchors.push({ x: A4[0], y: A4[1], c: 'GREEN', i: 0.8, r: 0.85 });
        const night = paintNight(rs, per, H, S, sc, anchors);
        if (scene) { for (const t of scene.tex) gl.deleteTexture(t); for (const f of scene.fb) gl.deleteFramebuffer(f); }
        const mkScene = (cv) => {
          const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.generateMipmap(gl.TEXTURE_2D);
          return t;
        };
        const tFar = mkScene(night.far), tNear = mkScene(night.near);
        // blurred copies: the light the fog scatters
        const bw = Math.max(16, Math.ceil(night.far.width / 4)), bh = Math.max(16, Math.ceil(night.far.height / 4));
        const hf = !!gl.getExtension('EXT_color_buffer_float');
        const bGain = hf ? 1 : 2.2;   // 8-bit targets: use the range, or the faint glows band
        blurGain = bGain * bGain;
        const mkB = () => hf ? tex(bw, bh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null, gl.REPEAT) : tex(bw, bh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.REPEAT);
        const tmp = mkB(), tFarB = mkB(), tNearB = mkB(), tFarC = mkB(), tNearC = mkB();
        const fTmp = fbo(tmp), fFarB = fbo(tFarB), fNearB = fbo(tNearB), fFarC = fbo(tFarC), fNearC = fbo(tNearC);
        gl.useProgram(P_BLUR.pr);
        gl.viewport(0, 0, bw, bh);
        gl.uniform2f(P_BLUR.U.uOut, bw, bh);
        gl.uniform1f(P_BLUR.U.uSeed, 0);
        gl.uniform1i(P_BLUR.U.uSrc, 0);
        gl.activeTexture(gl.TEXTURE0);
        const sigPx = 0.075 * H;  // css px
        const blur = (src, dst, sig) => {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fTmp); gl.bindTexture(gl.TEXTURE_2D, src);
          gl.uniform2f(P_BLUR.U.uDir, 1 / per, 0); gl.uniform1f(P_BLUR.U.uSig, sig); gl.uniform1f(P_BLUR.U.uLod, Math.max(0, Math.log2(sig * sc / 4))); gl.uniform1f(P_BLUR.U.uGain, bGain);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.bindTexture(gl.TEXTURE_2D, tmp);
          gl.uniform2f(P_BLUR.U.uDir, 0, 1 / H); gl.uniform1f(P_BLUR.U.uLod, 0.0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        blur(tFar, fFarB, sigPx); blur(tNear, fNearB, sigPx);
        blur(tFar, fFarC, 0.016 * H); blur(tNear, fNearC, 0.016 * H);

        // static fog structure
        if (texMot) gl.deleteTexture(texMot);
        const mw = Math.max(16, Math.ceil(W / 3)), mh = Math.max(16, Math.ceil(H / 3));
        texMot = tex(mw, mh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null);
        const fMot = fbo(texMot);
        gl.useProgram(P_MOT.pr);
        gl.viewport(0, 0, mw, mh);
        gl.uniform2f(P_MOT.U.uOut, mw, mh); gl.uniform2f(P_MOT.U.uRes, W, H); gl.uniform1f(P_MOT.U.uS, S);
        gl.uniform1f(P_MOT.U.uSeed, (seed % 1000) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fMot);
        scene = { tex: [tFar, tNear, tmp, tFarB, tNearB, tFarC, tNearC], fb: [fTmp, fFarB, fNearB, fFarC, fNearC], far: tFar, near: tNear, farB: tFarB, nearB: tNearB, farC: tFarC, nearC: tNearC };

        // the drawing, already made a few seconds ago
        drips = []; pools = [];
        const tN = now();
        const cy = makeCycle(0, cycleIdx);
        const shift = tN - 3 - cy.end;
        for (const st of cy.strokes) st.t0 += shift;
        cy.end += shift;
        for (const st of cy.strokes) advanceStroke(st, tN);
        cycles = [cy];
        planDrips(cy, tN, true);
        cy.dripsPlanned = true;
        nextCycleAt = cy.end + CYCLE;
        dirty = [0, 0, fw, fh];
        upload();
      }

      function upload() {
        if (!dirty) return;
        const x0 = clamp(Math.floor(dirty[0]), 0, fw), y0 = clamp(Math.floor(dirty[1]), 0, fh);
        const x1 = clamp(Math.ceil(dirty[2]), 0, fw), y1 = clamp(Math.ceil(dirty[3]), 0, fh);
        dirty = null;
        if (x1 <= x0 || y1 <= y0) return;
        gl.bindTexture(gl.TEXTURE_2D, texField);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, fw);
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x0);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0, y1 - y0, gl.RGBA, gl.FLOAT, Fd);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
      }

      // keep timestamps small enough for half floats
      function maybeRebase(tN) {
        if (tN < 200 || user) return;
        for (const cy of cycles) for (const st of cy.strokes) if (!st.done && st.t0 <= tN) return;
        const D = 200;
        for (let i = 0; i < fw * fh; i++) Fd[i * 4 + 1] -= D;
        rebased += D;
        for (const cy of cycles) { cy.end -= D; for (const st of cy.strokes) st.t0 -= D; }
        nextCycleAt -= D;
        for (const d of drips) { d.start -= D; d.endT -= D; }
        for (const q of pools) q.t -= D;
        dirty = [0, 0, fw, fh];
      }

      function draw(tN) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(P_MAIN.pr);
        const U = P_MAIN.U;
        const bind = (unit, t, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(U[name], unit); };
        bind(0, scene.far, 'uFar'); bind(1, scene.near, 'uNear'); bind(2, scene.farB, 'uFarB'); bind(3, scene.nearB, 'uNearB');
        bind(4, texField, 'uField'); bind(5, texMot, 'uMot'); bind(6, scene.farC, 'uFarC'); bind(7, scene.nearC, 'uNearC');
        gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uDpr, canvas.width / W); gl.uniform1f(U.uT, tN); gl.uniform1f(U.uS, S);
        gl.uniform1f(U.uPer, per);
        const tt = tN + rebased;
        const sp = W / 1600;
        gl.uniform1f(U.uOffF, ((tt * 2.2 * sp) % per + per) % per);
        gl.uniform1f(U.uOffN, ((tt * 7.5 * sp) % per + per) % per);
        gl.uniform1f(U.uGlassB, glassB); gl.uniform4f(U.uFrame, frameR[0], frameR[1], frameR[2], frameR[3]);
        gl.uniform2f(U.uFade, FADE0, FADE1); gl.uniform1f(U.uBG, 1 / blurGain);
        gl.uniform1f(U.uSeed, (seed % 997) / 997);
        const D = new Float32Array(32);
        drips.forEach((d, i) => { if (i < 8 && d.state !== 'wait') { D[i * 4] = d.x / fsc; D[i * 4 + 1] = d.y / fsc; D[i * 4 + 2] = d.r / fsc; D[i * 4 + 3] = d.a; } });
        gl.uniform4fv(U.uDrip, D);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      let lastT = 0;
      function frame() {
        if (!alive) return;
        if (!api.isCurrent()) { destroy(); return; }
        raf = requestAnimationFrame(frame);
        let tN = now();
        maybeRebase(tN); tN = now();
        const dt = clamp(tN - lastT, 0, 0.5); lastT = tN;
        if (tN >= nextCycleAt) {
          cycleIdx++;
          const cy = makeCycle(tN, cycleIdx);
          cycles.push(cy);
          nextCycleAt = cy.end + CYCLE;
        }
        for (const cy of cycles) {
          for (const st of cy.strokes) advanceStroke(st, tN);
          if (!cy.dripsPlanned && cy.strokes.every((s) => s.done)) { cy.dripsPlanned = true; planDrips(cy, tN, false); }
        }
        cycles = cycles.filter((cy) => !cy.dripsPlanned || cy === cycles[cycles.length - 1]);
        updateDrips(tN, dt);
        upload();
        draw(tN);
        if (!readyCalled) { readyCalled = true; requestAnimationFrame(() => api.ready()); }
      }

      let resizeTimer = 0, lastSize = '';
      const ro = new ResizeObserver(() => {
        const r = el.getBoundingClientRect();
        const key = Math.round(r.width) + 'x' + Math.round(r.height);
        if (key === lastSize) return;
        const firstTime = !lastSize;
        lastSize = key;
        clearTimeout(resizeTimer);
        if (firstTime) return;
        resizeTimer = setTimeout(() => { if (alive) build(); }, 250);
      });

      function destroy() {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(raf);
        clearTimeout(resizeTimer);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
        Fd = sid = dmin = baseR = baseG = baseW = baseA = null;
      }

      // start
      requestAnimationFrame(() => {
        if (!alive) return;
        try { build(); } catch (e) { console.error(e); el.textContent = 'The window failed to fog: ' + e.message; api.ready(); return; }
        lastSize = Math.round(W) + 'x' + Math.round(H);
        ro.observe(el);
        started = true;
        lastT = now();
        frame();
      });
      void started;

      return { destroy };
    },
  });
})();
