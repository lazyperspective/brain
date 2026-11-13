// view.js -- draws the picture in the page, a ring and a layer at a time, so you can watch it being made.
// #1k  #2k (default on a wide screen)  #4k   -- or ?w=3840 when opened as a plain file.
// The canvas element is only used to show the finished pixels; every mark is made in plain JavaScript.
(function () {
  'use strict';
  var A = self.ART, cv = document.getElementById('sheet'), note = document.getElementById('note'), frame = document.getElementById('frame');
  var sizes = { '1k': 1920, '2k': 2560, '4k': 3840 }, run = 0;
  function wanted() {
    var h = (location.hash || '').replace('#', ''); if (sizes[h]) return sizes[h];
    var q = /[?&]w=(\d+)/.exec(location.search || ''); if (q) return Math.max(640, Math.min(7680, parseInt(q[1], 10)));
    return Math.min(window.innerWidth || 1280, (window.screen && screen.width) || 1280) < 720 ? 1920 : 2560;
  }
  function say(t) { if (note) note.textContent = t; }
  function start(W) {
    var my = ++run, H = Math.round(W * 9 / 16);
    cv.width = W; cv.height = H; cv.setAttribute('data-w', W);
    var ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
    Array.prototype.forEach.call(document.querySelectorAll('[data-size]'), function (b) { b.setAttribute('aria-pressed', sizes[b.getAttribute('data-size')] === W ? 'true' : 'false'); });
    say('making the paper');
    self.__done = false;
    setTimeout(function () {
      if (my !== run) return;
      var plan = A.steps(W, H), i = 0, n = plan.steps.length;
      function show() { plan.C.finish(img.data, 4); ctx.putImageData(img, 0, 0); }
      function next() {
        if (my !== run) return;
        if (i >= n) { show(); say(''); self.__done = true; return; }
        var t0 = Date.now();
        do { plan.steps[i][1](); i++; } while (i < n && Date.now() - t0 < 40);
        show(); say(i < n ? plan.steps[i][0] : '');
        setTimeout(next, 12);
      }
      show(); say(plan.steps[0][0]); setTimeout(next, 30);
    }, 40);
  }
  // click the sheet to come close; click again to step back
  if (frame) cv.addEventListener('click', function (e) {
    var r = cv.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    var near = frame.classList.toggle('near');
    if (near) { cv.style.width = Math.round(cv.width / (window.devicePixelRatio > 1.5 ? 1.5 : 1)) + 'px'; var r2 = cv.getBoundingClientRect(); frame.scrollLeft = fx * r2.width - frame.clientWidth / 2; frame.scrollTop = fy * r2.height - frame.clientHeight / 2; }
    else { cv.style.width = ''; frame.scrollLeft = 0; frame.scrollTop = 0; }
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-size]'), function (b) {
    b.addEventListener('click', function () { var k = b.getAttribute('data-size'); try { history.replaceState(null, '', '#' + k); } catch (err) { location.hash = k; } if (frame) { frame.classList.remove('near'); cv.style.width = ''; } start(sizes[k]); });
  });
  start(wanted());
})();
