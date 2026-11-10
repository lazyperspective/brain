// 1000 Agents — first 3 seconds, clay / vinyl-toy style.
// Timeline (pure function of t) + raw WebGL2 plumbing. Shaders: js/shaders.js.
//   index.html          live loop
//   index.html?t=1.5    frozen frame
//   index.html?export   window.__piece = { renderAt(t), duration, isReady(), readPixels() }
//   &ss=2               supersampling factor (default 2 for export / frozen, auto for live)
(function () {
'use strict';

const DURATION = 3.0, FPS = 30;
const W = 1920, H = 1080;
const N_BEADS = 250;          // of the eventual 1000, out by 3.0 s
const params = new URLSearchParams(location.search);
const EXPORT = params.has('export');
const FROZEN = params.has('t') ? parseFloat(params.get('t')) : null;

// ------------------------------------------------------------------ math
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sat = x => clamp(x, 0, 1);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const pulse = (a, b, c, d, x) => smooth(a, b, x) * (1 - smooth(c, d, x));
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ------------------------------------------------------------------ timeline
const HERO_X = -0.98, FOLDER_X = 0.92, FOLDER_YAW = -0.24;
const HOPS = [
  { s: -0.16, e: 0.27, x0: -4.75, x1: -3.45, h: 0.50 },
  { s: 0.33, e: 0.72, x0: -3.45, x1: -2.15, h: 0.56 },
  { s: 0.78, e: 1.15, x0: -2.15, x1: HERO_X, h: 0.46 },
  { s: 1.95, e: 2.23, x0: HERO_X, x1: HERO_X, h: 0.24 },   // the signal
];
const T_OPEN = 2.1;

function stateAt(t) {
  const S = {};
  // ---- camera: gentle push-in, always moving
  const cu = t / DURATION, ce = 1 - Math.pow(1 - cu, 1.7);
  const dist = lerp(9.9, 8.25, ce);
  const tgt = [lerp(-0.25, 0.12, ce), lerp(0.95, 1.32, smooth(1.9, 3.0, t)), 0];
  const eye = [tgt[0] + lerp(-0.5, 0.25, ce), lerp(2.1, 1.75, ce), dist];
  S.eye = eye; S.tgt = tgt; S.fov = 29 * Math.PI / 180;

  // ---- hero
  let x = HOPS[0].x0, y = 0, sy = 1, lean = 0;
  for (const hp of HOPS) {
    if (t >= hp.e) {
      x = hp.x1;
      const tau = t - hp.e;                       // landing squash, damped
      sy += -0.30 * hp.h / 0.5 * Math.exp(-tau * 10) * Math.cos(tau * 27);
    } else if (t >= hp.s) {
      const u = (t - hp.s) / (hp.e - hp.s);
      x = lerp(hp.x0, hp.x1, u);
      y = hp.h * 4 * u * (1 - u);
      const env = smooth(0, 0.18, u) * (1 - smooth(0.86, 1, u));
      sy += 0.24 * env * (0.25 + 0.75 * Math.abs(1 - 2 * u)) * hp.h / 0.5;
      if (hp.x1 !== hp.x0) lean += 0.16 * Math.sin(2 * Math.PI * u) * env + 0.07 * env;
    }
  }
  // anticipation dip just before the signal hop
  sy -= 0.14 * pulse(1.84, 1.93, 1.94, 1.98, t);
  // breathing so nothing is ever perfectly still
  sy += 0.012 * Math.sin(t * 5.2 + 1.0) * smooth(1.2, 1.5, t);
  // awe: lean back a touch as the fountain rises
  lean -= 0.07 * smooth(2.2, 2.7, t);
  sy = clamp(sy, 0.6, 1.4);
  const sxz = 1 / Math.sqrt(sy);
  S.hPos = [x, y, 0.12];
  S.hScale = [sxz, sy, sxz];
  S.hLean = lean;
  S.hPitch = -0.07 * pulse(1.25, 1.4, 1.5, 1.62, t) - 0.05 * smooth(1.8, 1.92, t) * (1 - smooth(1.95, 2.05, t))
           + 0.10 * pulse(1.95, 2.05, 2.2, 2.3, t) + 0.17 * smooth(2.2, 2.6, t);

  // yaw (+ = facing the folder side) and eyes
  let yaw = 0.62;                                           // travelling: 3/4 view
  yaw = lerp(yaw, 0.30, smooth(1.0, 1.28, t));
  yaw = lerp(yaw, 0.58, smooth(1.25, 1.42, t));             // look at the folder
  yaw = lerp(yaw, -0.12, smooth(1.5, 1.66, t));             // glance around
  yaw = lerp(yaw, 0.40, smooth(1.78, 1.94, t));             // back to the folder
  yaw = lerp(yaw, 0.52, smooth(2.2, 2.6, t));
  S.hYaw = yaw;
  let lx = 0.45, ly = 0.0;
  lx = lerp(lx, 1.0, smooth(1.22, 1.36, t));
  lx = lerp(lx, -1.0, smooth(1.5, 1.62, t));
  lx = lerp(lx, 0.9, smooth(1.78, 1.9, t));
  ly = lerp(ly, -0.3, smooth(1.22, 1.36, t));
  ly = lerp(ly, 0.2, smooth(1.5, 1.62, t));
  ly = lerp(ly, 0.0, smooth(1.78, 1.9, t));
  ly = lerp(ly, 1.0, smooth(2.2, 2.55, t));                 // watch the fountain
  lx = lerp(lx, 0.75, smooth(2.2, 2.55, t));
  S.look = [lx, ly];
  S.blink = Math.max(pulse(1.66, 1.71, 1.74, 1.80, t), pulse(0.50, 0.54, 0.56, 0.61, t), pulse(2.62, 2.66, 2.69, 2.74, t));
  S.mouth = pulse(1.95, 2.03, 2.30, 2.48, t);
  S.arm = lerp(smooth(1.92, 2.04, t), 0.0, smooth(2.5, 2.85, t) * 0.75);

  // ---- folder: pops up squishy, then opens
  const tp = t + 0.075;                                     // already a small blob at frame 0
  const pop = 1 - Math.exp(-tp * 6.5) * Math.cos(tp * 11.5);
  let fs = clamp(pop, 0, 1.3) * 0.985 + 0.015;
  let fsy = 1 + 0.2 * Math.exp(-tp * 6) * Math.sin(tp * 16);
  const to = t - T_OPEN;
  fsy -= 0.10 * pulse(1.98, 2.08, 2.09, 2.13, t);           // gathers itself
  let open = -0.11;                                         // closed: flap rests against the back
  if (to > 0) {
    const k = 1 - Math.exp(-to * 8) * Math.cos(to * 15);
    open = lerp(-0.11, 0.56, k);
    fsy += 0.12 * Math.exp(-to * 8) * Math.sin(to * 20);
  }
  const fsx = 1 / Math.sqrt(fsy);
  S.fPos = [FOLDER_X, 0, 0];
  S.fScale = [fs * fsx, fs * fsy, fs * fsx];
  S.fOpen = open;
  S.fYaw = FOLDER_YAW;
  S.glow = smooth(2.06, 2.4, t);

  // ---- agents
  const nf = to > 0 ? N_BEADS * Math.pow(to / (DURATION - T_OPEN), 1.35) : 0;
  S.count = Math.min(N_BEADS, Math.floor(nf));
  S.fountI = smooth(0, 1, nf / N_BEADS) * 0.9 + 0.1 * smooth(2.1, 2.3, t) * (to > 0 ? 1 : 0);
  S.fount = [FOLDER_X + 0.05, lerp(1.0, 2.0, smooth(2.1, 3.0, t)), 0.35];
  return S;
}

// beads: fixed per-agent launch parameters, ballistic paths
const BEADS = (function () {
  const r = mulberry32(0xC1A7);
  const g = () => (r() + r() + r() + r() - 2) * 0.85;       // ~gaussian
  const cols = [[0.851, 0.467, 0.341], [0.949, 0.647, 0.522], [0.95, 0.56, 0.40], [0.80, 0.41, 0.29]];
  const c = Math.cos(FOLDER_YAW), s = Math.sin(FOLDER_YAW);
  const out = [];
  for (let i = 0; i < N_BEADS; i++) {
    const te = T_OPEN + (DURATION - T_OPEN) * Math.pow((i + 0.5) / N_BEADS, 1 / 1.35);
    const lx = (r() * 2 - 1) * 0.38, lz = 0.03 + (r() * 2 - 1) * 0.03;
    const vx = g() * 1.15 + lx * 1.2, vz = g() * 0.55 + 0.35, vy = 3.0 + r() * 2.0;
    const col = cols[(r() * cols.length) | 0];
    out.push({
      te,
      o: [FOLDER_X + c * lx + s * lz, 0.5, -s * lx + c * lz],
      v: [c * vx + s * vz, vy, -s * vx + c * vz],
      rad: 0.023 + r() * 0.014,
      col, seed: r(),
    });
  }
  return out;
})();
const GRAV = 5.4;

// ------------------------------------------------------------------ GL
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
let ready = false;
if (!gl) { document.body.innerHTML = '<p style="color:#cfc6ff;font:14px monospace;padding:2em">WebGL2 is required.</p>'; return; }
const SH = window.__clayShaders;

function compile(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(vs, fs, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  (attribs || []).forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const cache = {};
  p.u = n => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n)));
  return p;
}
const pScene = program(SH.VS_FULL, SH.FS_SCENE, ['aPos']);
const pBead = program(SH.VS_BEAD, SH.FS_BEAD, ['aCorner', 'aPosR', 'aCol']);
const pFinal = program(SH.VS_FULL, SH.FS_FINAL, ['aPos']);

// geometry
const vaoFull = gl.createVertexArray(); gl.bindVertexArray(vaoFull);
const bufFull = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufFull);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

const vaoBead = gl.createVertexArray(); gl.bindVertexArray(vaoBead);
const bufCorner = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufCorner);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const beadData = new Float32Array(N_BEADS * 8);
const bufInst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufInst);
gl.bufferData(gl.ARRAY_BUFFER, beadData.byteLength, gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
gl.bindVertexArray(null);

// label texture: "0 items", stamped on the folder flap
function makeLabel() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#fff'; x.font = 'bold 84px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('0 items', 256, 68);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
const texLabel = makeLabel();

// overlay (counter), redrawn only when the number changes
const ovCanvas = document.createElement('canvas');
const ovCtx = ovCanvas.getContext('2d');
const texOverlay = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texOverlay);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
let ovKey = '';
function drawOverlay(count, ow, oh) {
  const key = count + ':' + ow;
  if (key === ovKey) return;
  ovKey = key;
  ovCanvas.width = ow; ovCanvas.height = oh;
  const k = oh / 1080, x = ovCtx;
  x.clearRect(0, 0, ow, oh);
  x.font = '500 ' + (21 * k).toFixed(2) + 'px monospace';
  x.textBaseline = 'alphabetic';
  let px = 64 * k; const py = 76 * k, sp = 4.5 * k;
  const put = (str, color) => { x.fillStyle = color; for (const ch of str) { x.fillText(ch, px, py); px += x.measureText(ch).width + sp; } };
  put('AGENTS', '#8f86d9'); px += 9 * k;
  put(String(count).padStart(4, '0'), '#f2a585');
  gl.bindTexture(gl.TEXTURE_2D, texOverlay);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ovCanvas);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
}

// offscreen target (supersampled colour + depth)
let fbo = null, fboTex = null, fboDepth = null, fbW = 0, fbH = 0;
function ensureTarget(w, h) {
  if (w === fbW && h === fbH) return;
  fbW = w; fbH = h;
  if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(fboTex); gl.deleteRenderbuffer(fboDepth); }
  fboTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fboTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  fboDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, fboDepth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
  fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, fboDepth);
}

let SS = params.has('ss') ? parseFloat(params.get('ss')) : ((EXPORT || FROZEN !== null) ? 2 : 1);
const NEAR = 0.5, FAR = 80;

function render(t) {
  t = clamp(t, 0, DURATION);
  const S = stateAt(t);
  const ow = canvas.width, oh = canvas.height;
  const sw = Math.round(ow * SS), sh = Math.round(oh * SS);
  ensureTarget(sw, sh);
  const frame = Math.round(t * FPS);

  const cw = norm3([S.tgt[0] - S.eye[0], S.tgt[1] - S.eye[1], S.tgt[2] - S.eye[2]]);
  const cu = norm3(cross(cw, [0, 1, 0]));
  const cv = cross(cu, cw);
  const tanH = Math.tan(S.fov / 2);

  // ---- scene
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, sw, sh);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true);
  let p = pScene; gl.useProgram(p);
  gl.uniform2f(p.u('uRes'), sw, sh);
  gl.uniform3fv(p.u('uRo'), S.eye); gl.uniform3fv(p.u('uCu'), cu); gl.uniform3fv(p.u('uCv'), cv); gl.uniform3fv(p.u('uCw'), cw);
  gl.uniform1f(p.u('uTanH'), tanH); gl.uniform1f(p.u('uNear'), NEAR); gl.uniform1f(p.u('uFar'), FAR);
  gl.uniform1f(p.u('uFrame'), frame);
  gl.uniform3fv(p.u('uHPos'), S.hPos); gl.uniform1f(p.u('uHYaw'), S.hYaw); gl.uniform1f(p.u('uHLean'), S.hLean); gl.uniform1f(p.u('uHPitch'), S.hPitch);
  gl.uniform3fv(p.u('uHScale'), S.hScale); gl.uniform2fv(p.u('uLook'), S.look);
  gl.uniform1f(p.u('uBlink'), S.blink); gl.uniform1f(p.u('uMouth'), S.mouth); gl.uniform1f(p.u('uArm'), S.arm);
  gl.uniform3fv(p.u('uFPos'), S.fPos); gl.uniform1f(p.u('uFYaw'), S.fYaw); gl.uniform1f(p.u('uFOpen'), S.fOpen);
  gl.uniform3fv(p.u('uFScale'), S.fScale); gl.uniform1f(p.u('uGlow'), S.glow);
  gl.uniform3fv(p.u('uFount'), S.fount); gl.uniform1f(p.u('uFountI'), S.fountI);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texLabel); gl.uniform1i(p.u('uLabel'), 0);
  gl.bindVertexArray(vaoFull);
  if (EXPORT) {                       // tiles keep each software-rasterised draw short
    gl.enable(gl.SCISSOR_TEST);
    const TY = 6;
    for (let i = 0; i < TY; i++) {
      const y0 = Math.floor(sh * i / TY), y1 = Math.floor(sh * (i + 1) / TY);
      gl.scissor(0, y0, sw, y1 - y0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
    }
    gl.disable(gl.SCISSOR_TEST);
  } else {
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- beads
  let n = 0;
  for (let i = 0; i < N_BEADS; i++) {
    const b = BEADS[i], tau = t - b.te;
    if (tau <= 0) break;
    const o = n * 8;
    beadData[o] = b.o[0] + b.v[0] * tau;
    beadData[o + 1] = b.o[1] + b.v[1] * tau - 0.5 * GRAV * tau * tau;
    beadData[o + 2] = b.o[2] + b.v[2] * tau;
    beadData[o + 3] = b.rad * smooth(0, 0.07, tau);
    beadData[o + 4] = b.col[0]; beadData[o + 5] = b.col[1]; beadData[o + 6] = b.col[2]; beadData[o + 7] = b.seed;
    n++;
  }
  if (n > 0) {
    p = pBead; gl.useProgram(p);
    gl.bindVertexArray(vaoBead);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufInst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, beadData.subarray(0, n * 8));
    gl.uniform3fv(p.u('uRo'), S.eye); gl.uniform3fv(p.u('uCu'), cu); gl.uniform3fv(p.u('uCv'), cv); gl.uniform3fv(p.u('uCw'), cw);
    gl.uniform1f(p.u('uTanH'), tanH); gl.uniform1f(p.u('uAspect'), sw / sh);
    gl.uniform1f(p.u('uNear'), NEAR); gl.uniform1f(p.u('uFar'), FAR);
    gl.depthFunc(gl.LESS);
    gl.uniform1f(p.u('uGlowPass'), 0); gl.uniform1f(p.u('uGrow'), 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(p.u('uGlowPass'), 1); gl.uniform1f(p.u('uGrow'), 5.5);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.disable(gl.BLEND); gl.depthMask(true);
  }

  // ---- final
  drawOverlay(S.count, ow, oh);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, ow, oh);
  gl.disable(gl.DEPTH_TEST);
  p = pFinal; gl.useProgram(p);
  gl.bindVertexArray(vaoFull);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.uniform1i(p.u('uScene'), 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texOverlay); gl.uniform1i(p.u('uOverlay'), 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform2f(p.u('uOut'), ow, oh);
  gl.uniform1f(p.u('uFrame'), frame);
  gl.uniform1f(p.u('uOverlayA'), smooth(2.1, 2.3, t));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// ------------------------------------------------------------------ modes
function sizeCanvas(w, h, cssFit) {
  canvas.width = w; canvas.height = h;
  if (cssFit) {
    const k = Math.min(innerWidth / w, innerHeight / h);
    canvas.style.width = Math.floor(w * k) + 'px'; canvas.style.height = Math.floor(h * k) + 'px';
  }
}

if (EXPORT) {
  const ew = params.has('w') ? parseInt(params.get('w'), 10) : W;
  sizeCanvas(ew, Math.round(ew * H / W), true);
  window.__piece = {
    duration: DURATION,
    isReady: () => ready,
    renderAt(t) { render(t); gl.finish(); },
    readPixels() {                       // raw RGBA, bottom-up, base64
      const w = canvas.width, h = canvas.height, px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let s = ''; const CH = 0x8000;
      for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
      return btoa(s);
    },
  };
  ready = true;
  requestAnimationFrame(() => render(0));
} else if (FROZEN !== null) {
  const fit = () => { sizeCanvas(W, H, true); render(FROZEN); };
  addEventListener('resize', fit); fit();
  ready = true;
} else {
  // live loop; resolution adapts so the raymarcher stays fluid on modest GPUs
  let scale = 0.75, acc = 0, cnt = 0, last = 0, t0 = null;
  const fit = () => {
    const k = Math.min(innerWidth / W, innerHeight / H) * Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.round(W * Math.min(1, k) * scale));
    sizeCanvas(w, Math.round(w * H / W), false);
    const c = Math.min(innerWidth / W, innerHeight / H);
    canvas.style.width = Math.floor(W * c) + 'px'; canvas.style.height = Math.floor(H * c) + 'px';
  };
  addEventListener('resize', fit); fit();
  const tick = now => {
    if (t0 === null) t0 = now;
    const el = (now - t0) / 1000;
    const t = Math.floor((el % DURATION) * FPS) / FPS;      // snap to the 30 fps frame grid
    render(t);
    if (last) { acc += now - last; cnt++; }
    last = now;
    if (cnt >= 20) {
      const ms = acc / cnt; acc = 0; cnt = 0;
      if (ms > 40 && scale > 0.3) { scale *= 0.8; fit(); }
      else if (ms < 18 && scale < 1) { scale = Math.min(1, scale * 1.15); fit(); }
    }
    requestAnimationFrame(tick);
  };
  ready = true;
  requestAnimationFrame(tick);
}
})();
