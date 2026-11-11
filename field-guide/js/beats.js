(function (root) {
  var FG = root.FG, W = FG.W, M = FG.mat, V = FG.v, m = FG.m;
  FG.buildFrame = function (ctx) {
    var t = ctx.t, B = ctx.B;
    W.buildLabels(B, t); W.buildSkyLetters(B, t); W.buildClouds(B, t);
    var P = FG.defaultPose(); var s = W.pol(W.S.think.a, W.S.think.r); P.p = s; P.yaw = Math.PI * 0.0;
    P.eyes.open = FG.blinkAt(t, 3); P.mouth = { shape: 'smile', amt: 1 }; P.arms[1].el = 1.0;
    var h = FG.buildHero(B, P);
    ctx.anchors.hero = h.top;
    var q = FG.mat.trans(s[0] - 1.6, s[1], s[2] - 0.6);
    B.push(q); B.chamfer([0, 1.6, 0], [1.0, 0.6, 0.08], 0.05, FG.C.violet, 0, FG.C.lilac); B.cyl(6, 0.07, 0.07, 0, 1.0, FG.C.wood); B.pop();
    ctx.T.quadM('sign', FG.mat.mul(q, FG.mat.trans(0, 1.6, 0.09)), [0, 0, 0], 0.95, [1, 0.97, 0.92], 1.0);
    return { shadowC: s, shadowR: 9, focus: 5.5 };
  };
})(window);
