// Orchestration: renders THE FIRESTORM TIMELINE deterministically from a seed.
(function () {
  'use strict';
  const FS = window.FS;

  FS.render = async function (canvas, opts = {}) {
    const seed = opts.seed === undefined ? 7 : opts.seed;
    const scale = opts.scale === undefined ? 0.25 : opts.scale;
    FS.seed = seed;
    FS.S = scale;
    FS.PX = Math.round(FS.W * scale);
    FS.hotWindows = [];
    canvas.width = canvas.height = FS.PX;
    const g = canvas.getContext('2d', { willReadFrequently: false });
    const log = opts.log || (() => {});
    const t0 = performance.now();
    let stopped = false;
    const step = async (name, fn) => {
      if (stopped) return;
      const t = performance.now();
      fn();
      log(`${name}: ${((performance.now() - t) / 1000).toFixed(2)}s`);
      if (opts.stopAfter === name) stopped = true;
      await new Promise((r) => setTimeout(r, 0));
    };
    g.fillStyle = '#000';
    g.fillRect(0, 0, FS.PX, FS.PX);

    await step('sky', () => FS.drawSky(g));
    await step('far0', () => FS.drawFarLayer(g, 0));
    await step('firewall', () => FS.drawFireWall(g));
    await step('far1', () => FS.drawFarLayer(g, 1));
    await step('cyclone', () => FS.drawCyclone(g));
    let towers;
    await step('mid', () => {
      towers = FS.buildMid();
      FS.drawMid(g, towers);
      FS.drawSkyBridges(g, towers);
    });
    await step('landmarks', () => FS.drawLandmarks(g));
    await step('citadel', () => FS.drawCitadel(g));
    await step('towerfires', () => {
      FS.drawTowerFires(g, towers);
      FS.drawWindowFlames(g);
    });
    await step('aqueduct', () => FS.drawAqueduct(g));
    await step('whirl', () => FS.drawFireWhirl(g));
    await step('frontsmoke', () => FS.drawFrontSmoke(g));
    await step('skystories', () => {
      FS.drawBanner(g);
      FS.drawWard(g);
      FS.drawFloatingIsland(g);
      FS.drawLanterns(g);
      FS.drawAirship(g);
      FS.drawBirds(g);
      FS.drawPhoenix(g);
      FS.drawStairClimber(g);
      FS.drawFloatingHouse(g);
      FS.drawCitadelKeeper(g);
      FS.drawFirstSparks(g);
    });
    await step('near', () => {
      FS.drawNear(g);
      FS.drawTowerFires(g, FS.nearHouses, 0.6);
      FS.drawDoorway(g);
    });
    await step('embers0', () => FS.drawEmbers(g, 0));
    await step('reflection', () => FS.drawReflection(g));
    await step('lake', () => {
      FS.drawPourSplash(g);
      FS.drawBoat(g);
    });
    await step('bridge', () => {
      FS.drawBridge(g);
      FS.drawBridgeStories(g);
    });
    await step('embers1', () => FS.drawEmbers(g, 1));
    if (!opts.noPost) await step('post', () => FS.post(g));
    log(`total: ${((performance.now() - t0) / 1000).toFixed(2)}s`);
    return canvas;
  };
})();
