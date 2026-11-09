// The palette: 49 hand-picked colours in named ramps (dark to light). Every pixel of the piece is one of these.
(function () {
  const NS = window.NS || (window.NS = {});
  const RAMPS = {
    night:   ['#05040f', '#0a0819', '#110e26', '#191636', '#221f48', '#2e2c5c', '#3d3f74', '#53598f', '#7682b2'], // blue-violet darks
    green:   ['#061208', '#0b2010', '#113216', '#1a4a18', '#286a14', '#4a920c', '#76b900', '#9cd820', '#c6f066', '#ecffc2'], // the sign
    amber:   ['#231108', '#431f0d', '#6e3512', '#a6561a', '#d9822a', '#f7b452', '#ffe3a6'],                         // sodium, rooms
    brick:   ['#110913', '#1c111f', '#2a1929', '#3c2333', '#56333f'],                                                  // hotel masonry
    steel:   ['#161828', '#272b40', '#454c69'],                                                                        // frame, girders
    teal:    ['#07111b', '#0f1f2e', '#1a3346'],                                                                        // curtain-wall glass
    magenta: ['#2b0a30', '#6c1867', '#c8329e', '#ff8ad8'],
    cyan:    ['#08293a', '#126679', '#2ec6d2', '#a8fff4'],
    red:     ['#480a14', '#c21e2c', '#ff6a5c'],
    glint:   ['#f2f4ff'],
  };
  const list = [], ramp = {}, of = [];
  for (const [name, cols] of Object.entries(RAMPS)) {
    ramp[name] = [];
    cols.forEach((hex, i) => { ramp[name].push(list.length); of.push([name, i]); list.push(hex); });
  }
  const rgb = list.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const lum = rgb.map(([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); });
  // step within the colour's own ramp
  const step = (i, d) => { const [n, k] = of[i]; const r = ramp[n]; return r[Math.max(0, Math.min(r.length - 1, k + d))]; };
  // the green-ramp position whose brightness is nearest this colour's
  const gpos = list.map((_, i) => { let best = 0, bd = 1e9; ramp.green.forEach((gi, k) => { const d = Math.abs(Math.log(lum[gi] + 1e-4) - Math.log(lum[i] + 1e-4)); if (d < bd) { bd = d; best = k; } }); return best; });
  const npos = list.map((_, i) => { let best = 0, bd = 1e9; ramp.night.forEach((gi, k) => { const d = Math.abs(Math.log(lum[gi] + 1e-4) - Math.log(lum[i] + 1e-4)); if (d < bd) { bd = d; best = k; } }); return best; });
  // Bayer 4x4, thresholds in (0,1)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  NS.PAL = { RAMPS, list, rgb, ramp, of, lum, step, gpos, npos, BAYER, bayer: (x, y) => BAYER[(y & 3) * 4 + (x & 3)] };
})();
