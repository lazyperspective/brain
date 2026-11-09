// WebGL2 pipeline. build(): rasterise the scene at 2x in nine modes, box-filter each to the output size, paint the
// sign faces, prepare noise and the static bloom. renderAt(t): emission -> bloom chain -> composite -> final.
(function () {
  const NS = window.NS || (window.NS = {});

  NS.Renderer = function (canvas, W, H, SS) {
    SS = SS || 2;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
    gl.getExtension('OES_texture_float_linear');
    const R = { gl, W, H, ready: false };

    // ---------- helpers
    function shader(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        const lines = src.split('\n'), m = /0:(\d+)/.exec(log || ''), ln = m ? +m[1] : 0;
        throw new Error('shader: ' + log + '\n' + lines.slice(Math.max(0, ln - 3), ln + 2).join('\n'));
      }
      return s;
    }
    function program(vs, fs) {
      const p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    }
    function tex(w, h, internal, format, type, data, filter, mips) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data || null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : (filter || gl.LINEAR));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    const f16 = (w, h, mips) => tex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null, gl.LINEAR, mips);
    function fbo(t) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }

    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const quadVAO = gl.createVertexArray();
    function drawQuad(prog) {
      gl.bindVertexArray(quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      const loc = gl.getAttribLocation(prog.p, 'aPos');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function bindTex(prog, name, t, unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prog.u[name], unit); }

    const SH = NS.SH;
    const tlog = (m) => { if (NS.DEBUG) console.log('T:' + m); };
    R.tlog = tlog;
    const P = {
      geo: program(SH.GEO_VS, SH.GEO_FS), down2: program(SH.QUAD_VS, SH.DOWN2_FS), bdown: program(SH.QUAD_VS, SH.BDOWN_FS),
      bup: program(SH.QUAD_VS, SH.BUP_FS), emit: program(SH.QUAD_VS, SH.EMIT_FS), comp: program(SH.QUAD_VS, SH.COMP_FS), fin: program(SH.QUAD_VS, SH.FINAL_FS),
    };

    // ---------- parameters (look)
    R.look = { spill: 18.0, halo: 0.022, emit: 3.4, bloom: 0.42, staticBloom: 0.35, expo: 1.0, rain: 1.0,
      bloomW: [1.0, 0.75, 0.5, 0.32, 0.2, 0.12, 0.07, 0.04, 0.03] };

    R.build = function () {
      const t0 = performance.now();
      const cam = NS.camera(W, H), cam2 = NS.camera(SS * W, SS * H);
      R.cam = cam;
      const sc = NS.buildScene();
      R.scene = sc;
      // light sample points per source
      const pts = [], ranges = [];
      sc.layout.sources.forEach((src) => { const a = pts.length; NS.samplePoints(src, 16, NS.SIGN.Zs - 0.05).forEach((p) => pts.push(p)); ranges.push(a, pts.length); });
      R.lightPts = pts; R.ranges = ranges;
      // geometry buffer: sky triangle first (mat 0), then the scene
      const sky = new Float32Array([-1, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 3, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 3, 0, 0, 0, -1, 0, 0, 0, 0, 0]);
      const verts = new Float32Array(sky.length + sc.verts.length); verts.set(sky); verts.set(sc.verts, sky.length);
      const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const st = 11 * 4;
      const at = (name, n, off) => { const l = gl.getAttribLocation(P.geo.p, name); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, st, off * 4); };
      at('aPos', 3, 0); at('aNrm', 3, 3); at('aMat', 1, 6); at('aPrm', 4, 7);
      const nVert = verts.length / 11;
      R.nTri = nVert / 3;

      gl.useProgram(P.geo.p);
      const u = P.geo.u;
      const L = new Float32Array(128 * 4); pts.forEach((p, i) => L.set(p, i * 4));
      gl.uniform4fv(u.uL, L);
      gl.uniform2iv(u.uRange, new Int32Array(ranges));
      const wl = sc.wl, tgt = [sc.layout.x1 - 7.5, 24.0, NS.SIGN.Zs];
      const wd = [tgt[0] - wl[0], tgt[1] - wl[1], tgt[2] - wl[2]], wn = Math.hypot(...wd);
      gl.uniform3f(u.uWL, wl[0], wl[1], wl[2]); gl.uniform3f(u.uWLdir, wd[0] / wn, wd[1] / wn, wd[2] / wn);
      const dyn = new Float32Array(16); NS.dynWindows.forEach((d, i) => dyn.set([d.bay, d.floor, 0, 0], i * 4));
      gl.uniform4fv(u.uDyn, dyn);
      gl.uniform1f(u.uCloudY, 72.0);
      R.T = {};

      // Rasterise the scene at (W*ss) x (H*ss): a depth-only pre-pass, then each shading pass writes its attachments,
      // which are box-filtered down by ss into W x H textures (ss = 1: kept as they are at that size).
      function geoPasses(Wt, Ht, ss, passes) {
        const Wb = Wt * ss, Hb = Ht * ss, cm = NS.camera(Wb, Hb);
        const nOut = Math.max(...passes.map((p) => p[1].length));
        const bigs = Array.from({ length: nOut }, () => f16(Wb, Hb));
        const F = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, F);
        bigs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
        const dep = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, dep); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, Wb, Hb);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dep);
        const ATT = bigs.map((_, i) => gl.COLOR_ATTACHMENT0 + i);
        gl.useProgram(P.geo.p);
        const A = (cm.far + cm.near) / (cm.far - cm.near), B = -2 * cm.far * cm.near / (cm.far - cm.near);
        gl.uniform4f(u.uProj, 2 * cm.f / Wb, 2 * cm.cx / Wb - 1, 2 * cm.f / Hb, 1 - 2 * cm.cy / Hb);
        gl.uniform2f(u.uDepth, A, B);
        gl.uniform4f(u.uCam, cm.f, cm.cx, cm.cy, Hb);
        gl.viewport(0, 0, Wb, Hb);
        gl.bindVertexArray(vao);
        gl.enable(gl.DEPTH_TEST);
        gl.drawBuffers(ATT.map(() => gl.NONE));
        gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.depthFunc(gl.LESS); gl.depthMask(true);
        gl.uniform1i(u.uMode, 3);
        gl.drawArrays(gl.TRIANGLES, 0, nVert);
        gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
        for (const [mode, names] of passes) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, F);
          gl.viewport(0, 0, Wb, Hb);
          gl.drawBuffers(ATT.map((a, i) => (i < names.length ? a : gl.NONE)));
          for (let i = 0; i < names.length; i++) gl.clearBufferfv(gl.COLOR, i, [0, 0, 0, 0]);
          gl.enable(gl.DEPTH_TEST);
          gl.useProgram(P.geo.p);
          gl.uniform1i(u.uMode, mode);
          gl.bindVertexArray(vao);
          gl.drawArrays(gl.TRIANGLES, 0, nVert);
          gl.disable(gl.DEPTH_TEST);
          for (let i = 0; i < names.length; i++) {
            const out = f16(Wt, Ht); const of = fbo(out);
            gl.viewport(0, 0, Wt, Ht);
            gl.useProgram(P.down2.p);
            bindTex(P.down2, 'uSrc', bigs[i], 0); gl.uniform1i(P.down2.u.uSS, ss);
            drawQuad(P.down2);
            if (NS.DEBUG) { const px = new Float32Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px); tlog('pass ' + mode + ' ' + names[i]); }
            gl.deleteFramebuffer(of);
            R.T[names[i]] = out;
          }
        }
        gl.depthMask(true);
        bigs.forEach((t) => gl.deleteTexture(t)); gl.deleteFramebuffer(F); gl.deleteRenderbuffer(dep);
      }
      geoPasses(W, H, SS, [[0, ['base', 'pos', 'nrm', 'mask', 'dyn']], [1, ['S0', 'S1']]]);
      // the haze in-scatter is smooth: half resolution is plenty
      geoPasses(W >> 1, H >> 1, 1, [[2, ['I0', 'I1']]]);
      gl.deleteBuffer(vbo);

      tlog('modes done');
      // painted sign faces
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const em = NS.paintEmission(cam, sc.layout);
      R.T.em0 = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, em[0]);
      R.T.em1 = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, em[1]);
      tlog('emission painted');
      // noise
      const N = 256, nz = NS.noiseTexture(N, 4242);
      const nt = tex(N, N, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, nz, gl.LINEAR, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.generateMipmap(gl.TEXTURE_2D);
      R.T.noise = nt;

      // frame targets
      R.T.E = f16(W, H); R.F = { E: fbo(R.T.E) };
      R.T.L = f16(W, H, true); R.F.L = fbo(R.T.L);
      R.levels = [];
      let w = W, h = H;
      const nLev = Math.max(5, Math.round(Math.log2(H / 1080)) + 8);
      for (let i = 0; i < nLev; i++) {
        w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
        const d = f16(w, h), uu = f16(w, h);
        R.levels.push({ w, h, d, u: uu, df: fbo(d), uf: fbo(uu) });
      }
      R.lmax = Math.floor(Math.log2(Math.max(W, H)));
      R.T.black = tex(1, 1, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, new Uint16Array(4));
      // static bloom of the base (lit windows, lamps): run the chain once on the base
      R.T.bloomS = f16(W >> 1, H >> 1);
      bloomChain(R.T.base, 0.0);
      { // copy level-0 up result into bloomS
        const f = fbo(R.T.bloomS); gl.viewport(0, 0, W >> 1, H >> 1);
        gl.useProgram(P.bdown.p); bindTex(P.bdown, 'uSrc', R.levels[0].u, 0); gl.uniform2f(P.bdown.u.uTexel, 0.25 / (W >> 1), 0.25 / (H >> 1));
        drawQuad(P.bdown); gl.deleteFramebuffer(f);
      }
      gl.finish();
      R.buildMs = performance.now() - t0;
      R.ready = true;
    };

    // bloom chain on src (full res) -> levels[0].u holds the result at half res
    function bloomChain(src, thresh) {
      const lv = R.levels;
      gl.useProgram(P.bdown.p);
      for (let i = 0; i < lv.length; i++) {
        const s = i === 0 ? src : lv[i - 1].d, sw = i === 0 ? W : lv[i - 1].w, sh = i === 0 ? H : lv[i - 1].h;
        gl.bindFramebuffer(gl.FRAMEBUFFER, lv[i].df); gl.viewport(0, 0, lv[i].w, lv[i].h);
        bindTex(P.bdown, 'uSrc', s, 0); gl.uniform2f(P.bdown.u.uTexel, 1 / sw, 1 / sh);
        drawQuad(P.bdown);
      }
      gl.useProgram(P.bup.p);
      const bw = R.look.bloomW;
      for (let i = lv.length - 1; i >= 0; i--) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, lv[i].uf); gl.viewport(0, 0, lv[i].w, lv[i].h);
        const last = i === lv.length - 1;
        const s = last ? R.T.black : lv[i + 1].u, sw = last ? 1 : lv[i + 1].w, sh = last ? 1 : lv[i + 1].h;
        bindTex(P.bup, 'uSrc', s, 0); bindTex(P.bup, 'uCur', lv[i].d, 1);
        gl.uniform2f(P.bup.u.uTexel, 1 / sw, 1 / sh);
        const off = Math.round(Math.log2(H / 1080)), k = i - off;   // the same absolute radii at 1080p and 4K
        gl.uniform1f(P.bup.u.uW, k < 0 ? 0.0 : bw[Math.min(k, bw.length - 1)]);
        drawQuad(P.bup);
      }
    }

    R.renderAt = function (t) {
      const F = NS.FLICKER, D = F.D, look = R.look, cam = R.cam;
      t = ((t % D) + D) % D;
      const b = F.sources(t), rooms = F.rooms(t);
      // 1. emission
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.F.E); gl.viewport(0, 0, W, H);
      let p = P.emit; gl.useProgram(p.p);
      bindTex(p, 'uEm0', R.T.em0, 0); bindTex(p, 'uEm1', R.T.em1, 1); bindTex(p, 'uMask', R.T.mask, 2); bindTex(p, 'uPos', R.T.pos, 3);
      gl.uniform4f(p.u.uB0, b[0], b[1], b[2], b[3]); gl.uniform4f(p.u.uB1, b[4], b[5], b[6], b[7]);
      gl.uniform1f(p.u.uEmit, look.emit);
      const bc = new Float32Array(32), bi = new Float32Array(32);
      NS.beacons.forEach((bk, i) => { bc.set([bk.p[0], bk.p[1], bk.p[2], 0], i * 4); bi.set([F.beacon(bk, t), bk.size, bk.p[2] > 500 ? 5.0 : 9.0, 0], i * 4); });
      gl.uniform4fv(p.u.uBc, bc); gl.uniform4fv(p.u.uBcI, bi); gl.uniform1i(p.u.uNB, NS.beacons.length);
      gl.uniform4f(p.u.uCam, cam.f, cam.cx, cam.cy, H); gl.uniform2f(p.u.uRes, W, H);
      drawQuad(p);
      // 2. bloom
      bloomChain(R.T.E, 0.0);
      // 3. composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.F.L); gl.viewport(0, 0, W, H);
      p = P.comp; gl.useProgram(p.p);
      const tl = ['uBase', 'base', 'uS0', 'S0', 'uS1', 'S1', 'uI0', 'I0', 'uI1', 'I1', 'uMask', 'mask', 'uPos', 'pos', 'uDynT', 'dyn', 'uE', 'E', 'uNoise', 'noise', 'uBloomS', 'bloomS'];
      for (let i = 0; i < tl.length; i += 2) bindTex(p, tl[i], R.T[tl[i + 1]], i / 2);
      bindTex(p, 'uBloom', R.levels[0].u, 11);
      gl.uniform4f(p.u.uB0, b[0], b[1], b[2], b[3]); gl.uniform4f(p.u.uB1, b[4], b[5], b[6], b[7]);
      gl.uniform4f(p.u.uRooms, rooms[0], rooms[1], rooms[2], rooms[3]);
      const rc = [[1.0, 0.56, 0.24], [1.0, 0.56, 0.24], [0.95, 0.80, 0.62], [0.42, 0.55, 0.95]];
      const rcs = new Float32Array(12); NS.dynWindows.forEach((d, i) => { const c = rc[i]; rcs.set([c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], i * 3); });
      gl.uniform3fv(p.u.uRoomCol, rcs);
      gl.uniform1f(p.u.uSpill, look.spill); gl.uniform1f(p.u.uHalo, look.halo); gl.uniform1f(p.u.uBloomK, look.bloom);
      gl.uniform1f(p.u.uStaticBloom, look.staticBloom);
      gl.uniform1f(p.u.uTime, t); gl.uniform1f(p.u.uD, D);
      gl.uniform4f(p.u.uCam, cam.f, cam.cx, cam.cy, H); gl.uniform2f(p.u.uRes, W, H);
      drawQuad(p);
      gl.bindTexture(gl.TEXTURE_2D, R.T.L); gl.generateMipmap(gl.TEXTURE_2D);
      // 4. final
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      p = P.fin; gl.useProgram(p.p);
      bindTex(p, 'uL', R.T.L, 0); bindTex(p, 'uPos', R.T.pos, 1); bindTex(p, 'uNrm', R.T.nrm, 2); bindTex(p, 'uMask', R.T.mask, 3);
      bindTex(p, 'uBloom', R.levels[0].u, 4); bindTex(p, 'uNoise', R.T.noise, 5);
      gl.uniform4f(p.u.uCam, cam.f, cam.cx, cam.cy, H); gl.uniform2f(p.u.uRes, W, H);
      gl.uniform1f(p.u.uTime, t); gl.uniform1f(p.u.uD, D); gl.uniform1f(p.u.uExpo, look.expo);
      gl.uniform1f(p.u.uZr, 101.5); gl.uniform1f(p.u.uRain, look.rain); gl.uniform1f(p.u.uLmax, R.lmax - 2);
      gl.uniform1f(p.u.uFrame, Math.round(t * 30) % Math.round(D * 30));
      drawQuad(p);
    };

    // debug: read texels of a build texture at pixel coords (x, y top-down, in output pixels)
    R.probe = function (name, pts) {
      const t = R.T[name], f = fbo(t), out = [];
      const half = name[0] === 'I';
      for (const [x, y] of pts) {
        const px = new Float32Array(4), xx = half ? x >> 1 : x, yy = half ? ((H - 1 - y) >> 1) : H - 1 - y;
        gl.readPixels(xx, yy, 1, 1, gl.RGBA, gl.FLOAT, px); out.push(Array.from(px).map((v) => +v.toPrecision(3)));
      }
      gl.deleteFramebuffer(f);
      return out;
    };
    // RGB bytes of the drawn frame, top row first
    R.readRGB = function () {
      const px = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const rgb = new Uint8Array(W * H * 3);
      for (let y = 0; y < H; y++) {
        const src = (H - 1 - y) * W * 4, dst = y * W * 3;
        for (let x = 0; x < W; x++) { rgb[dst + x * 3] = px[src + x * 4]; rgb[dst + x * 3 + 1] = px[src + x * 4 + 1]; rgb[dst + x * 3 + 2] = px[src + x * 4 + 2]; }
      }
      return rgb;
    };
    return R;
  };
})();
