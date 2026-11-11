// node tools/probe.js t1,t2,... : renders each time and prints any error with its stack
const L = require('./lib');
(async () => {
  const b = await L.chromium.launch(); const pg = await L.openPage(b, { ss: 1, scale: 0.25 });
  for (const t of process.argv[2].split(',').map(Number)) {
    const r = await pg.page.evaluate((tt) => { try { window.__piece.renderAt(tt); return 'ok'; } catch (e) { return e.stack; } }, t);
    if (r !== 'ok') console.log(t, r.split('\n').slice(0, 5).join('\n'));
  }
  await b.close();
})();
