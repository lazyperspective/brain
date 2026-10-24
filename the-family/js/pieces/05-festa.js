(function () {
  'use strict';
  (window.PIECES = window.PIECES || []).push({
    id: 'festa', title: 'festa (in progress)', medium: '', note: '', about: '', tone: 'dark', room: '#111',
    mount(el, api) { el.style.background = '#111'; api.ready(); return { destroy() {} }; },
  });
})();
