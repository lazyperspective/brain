/* Fable 5.2: A Field Guide. The film: one renderAt(t) that builds the frame's world, renders it and composites the
   captions. Deterministic: the same t gives the same pixels. */
(function (root) {
  'use strict';
  var FG = root.FG, V = FG.v, M = FG.mat, m = FG.m;

  FG.film = {
    init: function (glCanvas, outCanvas, opts) {
      opts = opts || {};
      var scale = opts.scale || 1, W = Math.round(1080 * scale), H = Math.round(1350 * scale);
      outCanvas.width = W; outCanvas.height = H;
      return FG.loadFonts().then(function () {
        var R = new FG.Renderer(glCanvas, W, H, opts.ss || 2);
        R.setAtlas(FG.buildAtlas(FG.ATLAS_ENTRIES));
        var SB = new FG.Builder(60000);
        FG.W.buildStatic(SB);
        R.setStatic(SB);
        var dyn = new FG.Builder(90000), text = new FG.TextBuf(3000), glow = new FG.GlowBuf(400);
        var out = outCanvas.getContext('2d', { willReadFrequently: true });
        var film = {
          info: { W: W, H: H, ss: R.SS, staticTris: SB.n / 3, fps: 30, frames: 1200 },
          renderAt: function (t, o) {
            o = o || {};
            dyn.reset(); text.reset(); glow.reset();
            var cam = FG.cameraAt(t);
            var Cm = R.camera(cam);
            var ctx = { t: t, B: dyn, T: text, G: glow, cam: cam, C: Cm, anchors: {} };
            var fr = FG.buildFrame(ctx);
            fr.cam = cam; fr.dyn = dyn; fr.text = text; fr.glow = glow;
            if (fr.dynCasters == null) fr.dynCasters = dyn.n;
            R.render(fr);
            // anchors in screen space for the compositor
            var A = {};
            Object.keys(ctx.anchors).forEach(function (k) { A[k] = R.project(Cm, ctx.anchors[k]); });
            FG.composite(out, glCanvas, t, A, { W: W, H: H, k: W / 1080, fr: fr });
            film.info.dynTris = dyn.n / 3;
            return film.info;
          },
          grab: function () {
            var d = out.getImageData(0, 0, W, H).data, s = '', CH = 0x8000;
            for (var i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
            return btoa(s);
          }
        };
        return film;
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
