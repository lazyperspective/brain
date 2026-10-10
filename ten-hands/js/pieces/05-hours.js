/* placeholder — replaced by the real artwork */
(function () {
  'use strict';
  (window.PIECES = window.PIECES || []).push({
    id: 'hours', title: 'hours (placeholder)', medium: 'placeholder', note: '', about: '', tone: 'dark',
    mount(el, api) {
      const c = document.createElement('canvas'); el.appendChild(c);
      const fit = () => { c.width = el.clientWidth; c.height = el.clientHeight; const g = c.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#888'; g.font = '30px serif'; g.fillText('hours', 40, 60); };
      fit(); api.ready();
      const ro = new ResizeObserver(fit); ro.observe(el);
      return { destroy() { ro.disconnect(); } };
    },
  });
})();
