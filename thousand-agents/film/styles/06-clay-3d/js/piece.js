// 1000 Agents — the film, section 7 of 7: DESKTOP (32.0–40.0 s, rendered 31.6–40.0 s), clay / vinyl-toy style.
// Extended from the 3 s style preview. Timeline (pure function of film time T) + raw WebGL2 plumbing. Shaders: js/shaders.js.
// Chunky lilac clay windows pop up one by one with squishy overshoot while beads (the agents) press their edges into shape;
// a login panel rises; the hero hops up onto its plinth and stands inside the avatar ring; a cursor blinks; the beads settle
// into a soft ring round the scene and dim to a glow. The ray generation carries the anchor fit (a lens shift).
FILM.define('06-clay-3d', function (canvasArg, opts) {
'use strict';

const W = 1920, H = 1080, FPS = 30;
const AN = FILM.ANCHOR, FM = FILM.m;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sat = x => clamp(x, 0, 1);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ------------------------------------------------------------------ layout (world units; the hero's body is 1.0 wide)
const HX = -1.25, HZ = 0.12;
const PLIN = { x: HX + 1.12, z: HZ, h: 0.42 };
const LOGIN = { x: HX + 1.12, z: HZ - 0.62, hw: 1.0, hh: 1.04 };
const WINS = [
  { t: 33.0, p: [HX + 2.95, 1.62, -1.55], hw: 0.86, hh: 0.56, yaw: -0.22 },
  { t: 33.8, p: [HX + 3.55, 0.62, -0.75], hw: 0.62, hh: 0.42, yaw: -0.34 },
  { t: 34.6, p: [HX - 0.35, 2.15, -2.1], hw: 0.74, hh: 0.48, yaw: 0.16 },
  { t: 35.3, p: [HX + 1.62, 2.62, -2.6], hw: 0.7, hh: 0.44, yaw: -0.06 },
];
const T_LOGIN = 36.2;
// squishy pop: 0 -> overshoot -> 1, and a squash that wobbles out
function pop(T, t0) {
  const a = T - t0; if (a <= 0) return { s: 0, q: 0 };
  const s = 1 - Math.exp(-a * 7.5) * Math.cos(a * 13.5);
  const q = 0.22 * Math.exp(-a * 6.5) * Math.sin(a * 17);
  return { s: clamp(s, 0, 1.3), q };
}

function stateAt(T) {
  const S = {};
  // camera: a gentle push-in; the anchor fit holds the hero's spot (and size) from the lens
  const u = sat((T - 32) / 8), e = 1 - Math.pow(1 - u, 1.6);
  const tgt = [lerp(0.55, 0.62, e), lerp(1.22, 1.18, e), -0.45];
  const eye = [tgt[0] + lerp(-0.25, 0.05, e), lerp(2.05, 1.9, e), lerp(9.4, 8.7, e)];
  S.eye = eye; S.tgt = tgt; S.fov = 29 * Math.PI / 180;
  // hero
  const h = FILM.heroAt(T);
  const onP = smooth(36.62, 37.12, T);                        // the big hop carries it up onto the plinth
  const base = PLIN.h * (T >= 37.12 ? 1 : onP * onP);
  let sy = clamp(1 - h.sq * 0.95, 0.6, 1.4);
  S.hPos = [HX + h.dx, h.lift * 0.62 * 1.45 + base, HZ];
  const sxz = 1 / Math.sqrt(sy); S.hScale = [sxz, sy, sxz];
  S.hLean = -h.lean * 0.9; S.hPitch = -h.look[1] * 0.1;
  S.hYaw = 0.3 + 0.32 * h.turn;
  S.look = [h.look[0], h.look[1] * 0.8];
  S.blink = h.blink; S.mouth = h.mouth; S.arm = Math.max(h.arm, h.point * 0.7);
  // windows
  S.win = WINS.map((w) => { const p = pop(T, w.t); return { p: w.p, s: p.s, q: p.q, hw: w.hw, hh: w.hh, yaw: w.yaw }; });
  const lp = pop(T, T_LOGIN), pp = pop(T, T_LOGIN + 0.22);
  S.login = { s: lp.s, q: lp.q, glow: smooth(37.1, 37.8, T) };
  S.plin = { s: pp.s };
  // the field: a few dots get typed as the hero settles, then the cursor blinks
  S.type = Math.min(6, Math.floor(Math.max(0, (T - 37.35) / 0.13)));
  S.cursor = T < 36.6 ? 0 : (Math.floor((T - 36.6) * 1.9) % 2 === 0 ? 1 : 0);
  S.dim = 1 - 0.55 * smooth(38.0, 39.3, T);
  S.warmI = 0.55 * (0.4 + 0.6 * S.dim);
  S.warmP = [HX + 1.4, 1.6, 1.4];
  return S;
}

// ------------------------------------------------------------------ the beads: 1000 agents
// each circles the stage on a slow lane; at its window's pop it comes in to press that window's edge, then rejoins;
// from 37.6 s they all drift to their place in a soft ring around the scene, and dim.
const BEADC = [[0.851, 0.467, 0.341], [0.949, 0.647, 0.522], [0.95, 0.56, 0.40], [0.80, 0.41, 0.29]];
const BD = FILM.AG.map((g) => ({
  lane: g.i % 5, a0: g.r[0] * Math.PI * 2, w: 0.2 * ((g.i % 5) % 2 ? 1 : -1) * (1 + 0.1 * (g.i % 5)), yj: (g.r[2] - 0.5) * 0.06, rj: (g.r[3] - 0.5) * 0.05,
  win: Math.floor(g.r[4] * 5), edge: g.r[5], press: g.r[6] < 0.42, rad: 0.026 + 0.016 * g.r[7], col: BEADC[Math.floor(g.r[1] * 4)], seed: g.r[2],
  ring: g.r[0],
}));
const CEN = [HX + 1.5, 1.95, -1.0];
const SRC = [HX + 2.7, 1.75, -1.2];            // where the boot screen stood: the beads pour out of it
function beadPos(i, T) {
  const b = BD[i];
  const an = b.a0 + b.w * (T - 32), R = 2.2 + 0.22 * b.lane + b.rj;
  let p = [CEN[0] + Math.cos(an) * R * 1.25, CEN[1] + 0.1 * Math.sin(an * 3 + b.lane * 1.7) + b.yj + (0.5 + 0.06 * b.lane) * Math.sin(an) + 0.16 * (b.lane - 2), CEN[2] + Math.sin(an) * R * 0.45];
  // the pour: each bead leaves the screen toward the camera, then swings into its lane
  const tp = 31.55 + 0.9 * b.seed, u = smooth(tp, tp + 1.5, T);
  if (u < 1) {
    const k = sat((T - tp) / 0.7), out = [SRC[0] + (b.edge - 0.5) * 1.6 + Math.cos(b.a0) * 1.4 * k, SRC[1] + (b.ring - 0.5) * 0.9 + Math.sin(b.a0) * 0.8 * k, SRC[2] + 2.6 * k];
    p = [lerp(out[0], p[0], u), lerp(out[1], p[1], u), lerp(out[2], p[2], u)];
  }
  // pressing a window edge
  if (b.press && b.win < 5) {
    const t0 = b.win < 4 ? WINS[b.win].t : T_LOGIN;
    const k = smooth(t0 - 0.35, t0 + 0.05, T) * (1 - smooth(t0 + 0.75, t0 + 1.35, T));
    if (k > 0) {
      let c, hw, hh, yaw, zf;
      if (b.win < 4) { const w = WINS[b.win]; c = w.p; hw = w.hw; hh = w.hh; yaw = w.yaw; zf = 0.1; }
      else { c = [LOGIN.x, LOGIN.hh, LOGIN.z]; hw = LOGIN.hw; hh = LOGIN.hh; yaw = 0; zf = 0.12; }
      const per = 2 * (hw + hh), s = b.edge * per * 2, inward = 0.02 * Math.sin(T * 14 + b.seed * 20);
      let lx, ly;
      if (s < 2 * hw) { lx = -hw + s; ly = hh + 0.03 - inward; } else if (s < 2 * hw + 2 * hh) { lx = hw + 0.03 - inward; ly = hh - (s - 2 * hw); }
      else if (s < 4 * hw + 2 * hh) { lx = hw - (s - 2 * hw - 2 * hh); ly = -hh - 0.03 + inward; } else { lx = -hw - 0.03 + inward; ly = -hh + (s - 4 * hw - 2 * hh); }
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const q = [c[0] + cy * lx + sy * zf, c[1] + ly, c[2] - sy * lx + cy * zf];
      p = [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)];
    }
  }
  // the final ring
  const f = smooth(37.5 + 0.6 * b.seed, 38.6 + 0.4 * b.seed, T);
  if (f > 0) {
    const ra = b.ring * Math.PI * 2 + 0.06 * (T - 38);
    const q = [HX + 1.45 + Math.cos(ra) * 3.15, 1.05 + Math.sin(ra) * 1.55, -1.05 + Math.sin(ra) * 0.25 + (b.lane - 2) * 0.05];
    p = [lerp(p[0], q[0], f), lerp(p[1], q[1], f), lerp(p[2], q[2], f)];
  }
  return p;
}

// ------------------------------------------------------------------ GL
const canvas = canvasArg;
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
if (!gl) return { renderAt() {}, isReady: () => true };
const SH = window.__clayShaders;
function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function program(vs, fs, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  (attribs || []).forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const cache = {}; p.u = n => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n)));
  return p;
}
const pScene = program(SH.VS_FULL, SH.FS_SCENE, ['aPos']);
const pBead = program(SH.VS_BEAD, SH.FS_BEAD, ['aCorner', 'aPosR', 'aCol']);
const pFinal = program(SH.VS_FULL, SH.FS_FINAL, ['aPos']);
const vaoFull = gl.createVertexArray(); gl.bindVertexArray(vaoFull);
const bufFull = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufFull);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const vaoBead = gl.createVertexArray(); gl.bindVertexArray(vaoBead);
const bufCorner = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufCorner);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const beadData = new Float32Array(FILM.N * 8);
const bufInst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufInst);
gl.bufferData(gl.ARRAY_BUFFER, beadData.byteLength, gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
gl.bindVertexArray(null);

let fbo = null, fboTex = null, fboDepth = null, fbW = 0, fbH = 0;
function ensureTarget(w, h) {
  if (w === fbW && h === fbH) return;
  fbW = w; fbH = h;
  if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(fboTex); gl.deleteRenderbuffer(fboDepth); }
  fboTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fboTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  fboDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, fboDepth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
  fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, fboDepth);
}
const EXPORT = !!(opts && opts.export);
const SS = (opts && opts.ss) ? opts.ss : (EXPORT ? 2 : 1);
const NEAR = 0.5, FAR = 80;

// the anchor fit: where the hero's anchor lands with the raw camera, then the NDC scale + shift that pins it
function fitFor(S, cu, cv, cw, tanH, asp) {
  const pr = (p) => { const d = [p[0] - S.eye[0], p[1] - S.eye[1], p[2] - S.eye[2]], z = dot(d, cw); return [dot(d, cu) / (z * tanH * asp), dot(d, cv) / (z * tanH)]; };
  const pf = pr([HX, 0, HZ + 0.27]), pt = pr([HX, 0.83, HZ + 0.27]);
  const k = (AN.h / 1080 * 2) / (pt[1] - pf[1]);
  return [k, (AN.x / 1920 * 2 - 1) - pf[0] * k, (1 - AN.gy / 1080 * 2) - pf[1] * k];
}

function render(T) {
  const S = stateAt(T);
  const ow = canvas.width, oh = canvas.height;
  const sw = Math.round(ow * SS), sh = Math.round(oh * SS);
  ensureTarget(sw, sh);
  const frame = Math.round(T * FPS);
  const cw = norm3([S.tgt[0] - S.eye[0], S.tgt[1] - S.eye[1], S.tgt[2] - S.eye[2]]);
  const cu = norm3(cross(cw, [0, 1, 0])), cv = cross(cu, cw);
  const tanH = Math.tan(S.fov / 2), FIT = fitFor(S, cu, cv, cw, tanH, W / H);

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, sw, sh);
  gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true);
  let p = pScene; gl.useProgram(p);
  gl.uniform2f(p.u('uRes'), sw, sh);
  gl.uniform3fv(p.u('uRo'), S.eye); gl.uniform3fv(p.u('uCu'), cu); gl.uniform3fv(p.u('uCv'), cv); gl.uniform3fv(p.u('uCw'), cw);
  gl.uniform1f(p.u('uTanH'), tanH); gl.uniform1f(p.u('uNear'), NEAR); gl.uniform1f(p.u('uFar'), FAR);
  gl.uniform1f(p.u('uFrame'), frame); gl.uniform3fv(p.u('uFit'), FIT);
  gl.uniform3fv(p.u('uHPos'), S.hPos); gl.uniform1f(p.u('uHYaw'), S.hYaw); gl.uniform1f(p.u('uHLean'), S.hLean); gl.uniform1f(p.u('uHPitch'), S.hPitch);
  gl.uniform3fv(p.u('uHScale'), S.hScale); gl.uniform2fv(p.u('uLook'), S.look);
  gl.uniform1f(p.u('uBlink'), S.blink); gl.uniform1f(p.u('uMouth'), S.mouth); gl.uniform1f(p.u('uArm'), S.arm);
  const wp = [], ws = [];
  for (const w of S.win) { wp.push(w.p[0], w.p[1], w.p[2], w.s); ws.push(w.hw, w.hh, w.yaw, w.q); }
  gl.uniform4fv(p.u('uWinP'), wp); gl.uniform4fv(p.u('uWinS'), ws);
  gl.uniform4f(p.u('uLogP'), LOGIN.x, 0, LOGIN.z, S.login.s); gl.uniform4f(p.u('uLogS'), LOGIN.hw, LOGIN.hh, S.login.q, S.login.glow);
  gl.uniform4f(p.u('uPlin'), PLIN.x, PLIN.z, PLIN.h, S.plin.s);
  gl.uniform1f(p.u('uCursor'), S.cursor); gl.uniform1f(p.u('uType'), S.type);
  gl.uniform3fv(p.u('uWarmP'), S.warmP); gl.uniform1f(p.u('uWarmI'), S.warmI);
  gl.bindVertexArray(vaoFull);
  gl.enable(gl.SCISSOR_TEST);
  const TY = 8;
  for (let i = 0; i < TY; i++) { const y0 = Math.floor(sh * i / TY), y1 = Math.floor(sh * (i + 1) / TY); gl.scissor(0, y0, sw, y1 - y0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.flush(); }
  gl.disable(gl.SCISSOR_TEST);

  // beads
  for (let i = 0; i < FILM.N; i++) {
    const q = beadPos(i, T), b = BD[i], o = i * 8;
    beadData[o] = q[0]; beadData[o + 1] = q[1]; beadData[o + 2] = q[2]; beadData[o + 3] = b.rad * smooth(31.55 + 0.9 * b.seed, 31.75 + 0.9 * b.seed, T);
    beadData[o + 4] = b.col[0]; beadData[o + 5] = b.col[1]; beadData[o + 6] = b.col[2]; beadData[o + 7] = b.seed;
  }
  p = pBead; gl.useProgram(p);
  gl.bindVertexArray(vaoBead); gl.bindBuffer(gl.ARRAY_BUFFER, bufInst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, beadData);
  gl.uniform3fv(p.u('uRo'), S.eye); gl.uniform3fv(p.u('uCu'), cu); gl.uniform3fv(p.u('uCv'), cv); gl.uniform3fv(p.u('uCw'), cw);
  gl.uniform1f(p.u('uTanH'), tanH); gl.uniform1f(p.u('uAspect'), sw / sh); gl.uniform3fv(p.u('uFit'), FIT);
  gl.uniform1f(p.u('uNear'), NEAR); gl.uniform1f(p.u('uFar'), FAR); gl.uniform1f(p.u('uDim'), S.dim);
  gl.depthFunc(gl.LESS);
  gl.uniform1f(p.u('uGlowPass'), 0); gl.uniform1f(p.u('uGrow'), 1);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, FILM.N);
  gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.uniform1f(p.u('uGlowPass'), 1); gl.uniform1f(p.u('uGrow'), 5.5);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, FILM.N);
  gl.disable(gl.BLEND); gl.depthMask(true);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, ow, oh); gl.disable(gl.DEPTH_TEST);
  p = pFinal; gl.useProgram(p); gl.bindVertexArray(vaoFull);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.uniform1i(p.u('uScene'), 0);
  gl.uniform2f(p.u('uOut'), ow, oh); gl.uniform1f(p.u('uFrame'), frame);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
}
if (!canvas.width || canvas.width < 16) { canvas.width = W; canvas.height = H; }
return { renderAt: render, isReady: () => true };
});
