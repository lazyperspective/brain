const { chromium } = require('playwright'); const serve = require('./serve');
(async () => { const s = await serve(); const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] }); const pg = await br.newPage();
  await pg.goto(`http://localhost:${s.address().port}/index.html?export&w=1920&h=1080`); await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const t = +process.argv[2];
  console.log(await pg.evaluate(t => { const P = window.__piece, E = P.E; const c = document.getElementById('c'), x = c.getContext('2d'); const out = [];
    const T = (name, f) => { const a = performance.now(); f(); x.getImageData(0, 0, 1, 1); out.push(name + ' ' + ((performance.now() - a) | 0)); };
    P.renderAt(t); const od = P.os.draw; P.os.draw = () => {};
    T('base', () => P.renderAt(t));
    E.bloom.enabled = false; T('nobloom', () => P.renderAt(t)); E.bloom.enabled = true;
    const ph = P.phone.userData.parts; ph.reflect.visible = false; T('noreflect', () => P.renderAt(t)); ph.reflect.visible = true;
    P.phone.visible = false; const fr = P.FILM.shots[P.FILM.shotIndex(t)].frame; P.FILM.shots[P.FILM.shotIndex(t)].frame = (...a) => { const r = fr(...a); P.phone.visible = false; return r; }; T('nophone', () => P.renderAt(t)); P.FILM.shots[P.FILM.shotIndex(t)].frame = fr;
    E.rt.samples = 0; E.rt.dispose(); T('nomsaa', () => P.renderAt(t)); T('nomsaa2', () => P.renderAt(t));
    const fin = E.fin; fin.enabled = false; T('nofin', () => P.renderAt(t)); fin.enabled = true;
    // raw gl canvas → 2d copy cost
    T('copyonly', () => { x.drawImage(E.renderer.domElement, 0, 0); });
    return out.join(' | '); }, t));
  await br.close(); s.close(); })();
