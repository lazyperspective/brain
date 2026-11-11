(function (root) {
  var FG = root.FG, W = FG.W;
  FG.cameraAt = function (t) {
    var s = W.pol(0, 10);
    if (FG.__camOverride) return FG.__camOverride(t);
    return { eye: [s[0] + 1.2, s[1] + 1.6, s[2] + 5.4], tgt: [s[0], s[1] + 0.9, s[2]], fov: 40 * Math.PI / 180 };
  };
})(window);
