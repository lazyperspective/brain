(function () {
  'use strict';
  (window.PIECES = window.PIECES || []).push({
    id: 'lorien', title: 'lorien (in progress)', medium: '', note: '', about: '', tone: 'dark', room: '#111',
    mount(el, api) { el.style.background = '#111'; api.ready(); return { destroy() {} }; },
  });
})();
