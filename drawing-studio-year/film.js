/* A YEAR, STILL WARM — one frame of the film.
 *
 * renderFrame(f) is a pure function of the frame number: ask the clock what the
 * world is like, re-colour the patient layers, then let the living things draw
 * themselves back to front. Nothing is carried from one frame to the next, so any
 * frame can be drawn on its own, in any order, on any core, and comes out the same.
 */
'use strict';
const { buildClock } = require('./clock.js');
const { createWorld } = require('./world.js');
const { createLook } = require('./look.js');
const { createPatient } = require('./patient.js');

function createFilm(fmtKey, scale, opt) {
  opt = opt || {};
  const log = opt.log || (() => {});
  const K = buildClock();
  const Wd = createWorld(fmtKey, scale, opt);
  const S = Wd.build(log);
  const Lk = createLook(K);
  const Pt = createPatient(Wd, K, Lk, S);
  const E = Wd.E;
  const ctx = { K, Wd, S, Lk, Pt, E, st: Lk.st, opt };
  const mods = {};
  for (const name of ['tree', 'sky', 'clouds', 'meadow', 'weather', 'life']) {
    if (opt.only && !opt.only.includes(name)) continue;
    let m = null; try { m = require('./' + name + '.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !/Cannot find module '\.\//.test(e.message)) throw e; }
    if (m) { mods[name] = m.create(ctx); ctx[name] = mods[name]; }
  }
  const ALL = 0xffff;
  function renderFrame(f, timing) {
    const t0 = Date.now();
    const st = Lk.frameState(f);
    if (mods.tree) mods.tree.prepare(st);
    Pt.update(mods.tree || null);
    E.composeStatic(Pt.cols);
    const t1 = Date.now();
    E.setClip(ALL & ~1);
    if (mods.sky) mods.sky.draw(st);
    if (mods.clouds) mods.clouds.draw(st);
    if (mods.weather && mods.weather.drawFar) mods.weather.drawFar(st);
    if (mods.life && mods.life.drawFar) mods.life.drawFar(st);
    const t2 = Date.now();
    if (mods.meadow) mods.meadow.drawBack(st);
    if (mods.tree) mods.tree.draw(st);
    const t3 = Date.now();
    if (mods.meadow) mods.meadow.drawFront(st);
    if (mods.life && mods.life.drawNear) mods.life.drawNear(st);
    if (mods.weather && mods.weather.drawNear) mods.weather.drawNear(st);
    E.setClip(ALL);
    if (timing) { timing.static = t1 - t0; timing.sky = t2 - t1; timing.tree = t3 - t2; timing.rest = Date.now() - t3; }
    return E;
  }
  return { K, Wd, S, Lk, Pt, E, mods, renderFrame, F: K.F, FPS: K.FPS, W: E.W, H: E.H };
}

module.exports = { createFilm };
