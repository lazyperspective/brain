// view.js -- draws the picture in the page, one step at a time, so you can watch it being made.
// ?w=1920 (default) | ?w=3840 for the full sheet (slower: several seconds a step on one thread).
// The canvas element is only used to show the finished pixels; every mark is made in plain JavaScript.
(function () {
  'use strict';
  var A = self.ART;
  var q = new URLSearchParams(location.search);
  var W = Math.max(480, Math.min(7680, parseInt(q.get('w') || '1920', 10))), H = Math.round(W * 9 / 16);
  var cv = document.getElementById('c'), note = document.getElementById('note');
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');
  var plan = A.steps(W, H), i = 0;
  function show() {
    var rgb = plan.C.finish(), img = ctx.createImageData(W, H), d = img.data;
    for (var p = 0, o = 0; p < rgb.length; p += 3, o += 4) { d[o] = rgb[p]; d[o + 1] = rgb[p + 1]; d[o + 2] = rgb[p + 2]; d[o + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }
  function next() {
    if (i >= plan.steps.length) { note.textContent = ''; window.__done = true; return; }
    note.textContent = plan.steps[i][0] + ' …';
    setTimeout(function () { plan.steps[i][1](); i++; show(); setTimeout(next, 30); }, 30);
  }
  show(); next();
})();
