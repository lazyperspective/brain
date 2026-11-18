'use strict';
const { Paper, hex } = require('./engine');
const S = +process.argv[2] || 1;
const only = (process.argv[3] || 'all').split(',');
const want = n => only.includes('all') || only.includes(n);
const t0 = Date.now();
const cv = new Paper(1920, 1080, S, hex('#dcae92'), 20251118);
const tick = n => console.log(n.padEnd(12), ((Date.now() - t0) / 1000).toFixed(1) + 's', cv.nstrokes);
tick('paper');
const sky = require('./sky');
if (want('sky')) { sky.drawSky(cv, 11); tick('sky'); sky.drawHighSky(cv, 12); tick('highsky'); }
if (want('cloud')) { sky.drawLowClouds(cv, 14); for (const [x, y, r, a] of [[1350, 130, 150, 0.1], [1440, 230, 190, 0.08], [1300, 80, 90, 0.1], [1560, 300, 150, 0.06]]) cv.dust(x, y, r, hex('#93a4ea'), a); sky.drawCloud(cv, 13); tick('cloud'); }
const town = require('./town');
if (want('far')) { town.drawFar(cv, 21); town.drawSea(cv, 22); tick('sea'); }
if (want('town')) { const n = town.drawTown(cv, 23); tick('town ' + n); }
const fg = require('./fg');
if (want('fg')) { fg.drawKnoll(cv, 31, c => { fg.drawMirror(c, 36); fg.drawBike(c, 33); fg.drawCat(c, 32); }); fg.drawFlora(cv, 34); fg.drawHedge(cv, 35); tick('fg'); }
const planes = require('./planes');
if (want('planes')) { planes.drawPlanes(cv, 41); tick('planes'); }
const out = process.argv[4] || (S === 2 ? 'out/final' : 'out/prev');
if (S === 2) { cv.save(out + '_4k.png'); cv.save(out + '_1080.png', null, 2); }
else cv.save(out + '.png');
if (process.env.CROP) { const c = process.env.CROP.split(',').map(Number); cv.save(out + '_crop.png', c.map(v => Math.round(v * S))); }
tick('saved');
