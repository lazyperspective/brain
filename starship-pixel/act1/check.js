// check.js — style-bible / safety checks over every frame of Act 1 (node only, no browser)
//  * every pixel colour belongs to the shared ramps
//  * <= 48 colours per shot
//  * flash hazard: large-area luminance flashes per second (WCAG-style: >10% rel. luminance change over >25% of screen)
//  * determinism: re-rendering a frame gives identical pixels
global.PX = require('./px.js'); const A = require('./act1.js');
A.init();
const FPS = 30, N = Math.round(30.1 * FPS);
const lumOf = new Map();
const lum = c => { if (lumOf.has(c)) return lumOf.get(c); const r = (c & 255) / 255, g = ((c >> 8) & 255) / 255, b = ((c >> 16) & 255) / 255;
  const f = v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; const L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); lumOf.set(c, L); return L; };
const shotCols = [new Set(), new Set(), new Set(), new Set(), new Set()];
let bad = 0, prev = null; const flashes = [];
const hexOf = c => '#' + [c & 255, (c >> 8) & 255, (c >> 16) & 255].map(v => v.toString(16).padStart(2, '0')).join('');
for (let i = 0; i < N; i++) {
  const t = i / FPS; A.render(t); const d = PX.screen.d; const sh = A.shotAt(t);
  const L = new Float32Array(d.length);
  for (let k = 0; k < d.length; k++) { const c = d[k]; shotCols[sh].add(c); if (!PX.ALL.has(c) && bad++ < 5) console.log('off-palette', hexOf(c), 't=', t.toFixed(2)); L[k] = lum(c); }
  if (prev) { // fraction of screen whose luminance jumped by > 0.1 (downsampled to 10x10 blocks like a viewer's eye)
    let changed = 0, dir = 0, blocks = 0;
    for (let by = 0; by < 27; by++) for (let bx = 0; bx < 48; bx++) {
      let a = 0, b = 0; for (let y = by * 10; y < by * 10 + 10; y++) for (let x = bx * 10; x < bx * 10 + 10; x++) { a += L[y * 480 + x]; b += prev[y * 480 + x]; }
      const dl = (a - b) / 100; blocks++; if (Math.abs(dl) > 0.1) { changed++; dir += Math.sign(dl); }
    }
    if (changed / blocks > 0.25) flashes.push({ t, frac: changed / blocks, dir: Math.sign(dir) });
  }
  prev = L;
}
// a flash = a pair of opposing transitions; count per 1 s window
let maxPerSec = 0;
for (const f of flashes) { const w = flashes.filter(g => g.t >= f.t && g.t < f.t + 1); let pairs = 0; for (let k = 1; k < w.length; k++) if (w[k].dir !== w[k - 1].dir) pairs++; maxPerSec = Math.max(maxPerSec, Math.ceil(w.length / 2)); }
// determinism
A.render(21.3); const a = PX.screen.d.slice(); A.render(5.2); A.render(21.3); let same = true; for (let k = 0; k < a.length; k++) if (a[k] !== PX.screen.d[k]) { same = false; break; }
console.log(JSON.stringify({ frames: N, offPalettePixels: bad, coloursPerShot: shotCols.map(s => s.size), largeTransitions: flashes.map(f => [+f.t.toFixed(2), +f.frac.toFixed(2)]), maxFlashesPerSecond: maxPerSec, deterministic: same }));
