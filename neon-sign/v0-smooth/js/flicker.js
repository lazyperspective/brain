// The flicker choreography: brightness of every light source as a pure function of t (seconds, 0..D, D = 16).
// The same numbers drive the letter faces, their glow, the spill on the structure, the halo in the haze, the cloud
// lighting, the reflections, the rain glints and the buzz in the sound track.
//
//   0.0 - 2.5   steady burn
//   2.50- 3.30  V stutters: two sags, the second nearly out, back with a small restrike overshoot
//   5.00- 5.36  the second I hiccups (drops to a glimmer for 140 ms, catches, wavers, holds)
//   6.90- 7.63  the inner turn of the eye flutters at the edge of the sign
//   9.15-12.10  brownout: the whole sign sags smoothly to ~30 % (1 s), hangs, then surges back past full and settles;
//               V gives out first and comes back last, with a stutter
//  13.10-13.90  V drops out for 340 ms and buzzes back
//  14.50-14.69  the eye's inner turn blinks once
//  14.7 -16.0   steady burn into the loop point
(function () {
  const NS = window.NS || (window.NS = {});
  const D = 16.0;

  // keyframed track: between keys an S-curve; before the first and after the last key: the end values
  function track(keys) {
    return function (t) {
      if (t <= keys[0][0]) return keys[0][1];
      const n = keys.length;
      if (t >= keys[n - 1][0]) return keys[n - 1][1];
      let i = 0;
      while (keys[i + 1][0] < t) i++;
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      const u = (t - t0) / (t1 - t0), s = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * s;
    };
  }

  const G = track([[0, 1], [9.15, 1], [9.55, 0.80], [9.72, 0.76], [9.95, 0.55], [10.2, 0.34], [10.45, 0.29], [10.7, 0.315],
    [10.95, 0.30], [11.15, 0.62], [11.36, 1.15], [11.6, 1.09], [12.1, 1.0], [D, 1]]);
  const tracks = [
    track([[0, 1], [D, 1]]), // N
    track([[0, 1], [2.50, 1], [2.53, 0.32], [2.66, 0.30], [2.69, 0.88], [2.79, 0.86], [2.82, 0.10], [2.97, 0.12], [3.00, 1.07], [3.30, 1.0],
      [9.60, 1], [9.66, 0.45], [9.78, 0.40], [9.82, 0.05], [11.42, 0.05], [11.46, 0.65], [11.56, 0.60], [11.60, 0.15], [11.72, 0.15],
      [11.76, 1.08], [12.0, 1.0], [13.10, 1], [13.13, 0.03], [13.47, 0.03], [13.50, 0.62], [13.57, 0.58], [13.60, 0.22], [13.66, 0.22],
      [13.69, 1.06], [13.9, 1.0], [D, 1]]), // V
    track([[0, 1], [D, 1]]), // I
    track([[0, 1], [D, 1]]), // D
    track([[0, 1], [5.00, 1], [5.03, 0.18], [5.17, 0.16], [5.20, 0.92], [5.25, 0.90], [5.28, 0.5], [5.33, 0.52], [5.36, 1.0], [D, 1]]), // I
    track([[0, 1], [D, 1]]), // A
    track([[0, 1], [11.1, 1], [11.2, 0.82], [11.45, 0.86], [11.7, 1.0], [D, 1]]), // eye, outer turn (lags the surge)
    track([[0, 1], [6.90, 1], [6.93, 0.38], [7.00, 0.40], [7.03, 0.85], [7.12, 0.83], [7.15, 0.28], [7.32, 0.30], [7.35, 0.95],
      [7.50, 0.93], [7.53, 0.62], [7.60, 0.64], [7.63, 1.0], [14.50, 1], [14.53, 0.45], [14.66, 0.45], [14.69, 1.0], [D, 1]]), // eye, inner
  ];
  // aging: the V and the eye's inner turn burn a little weaker
  const base = [1.0, 0.95, 1.0, 1.0, 0.99, 1.0, 1.0, 0.97];

  NS.FLICKER = {
    D,
    // brightness of the 8 sources at time t (wrapped into the loop)
    sources(t) {
      t = ((t % D) + D) % D;
      const g = G(t), out = new Float32Array(8);
      for (let k = 0; k < 8; k++) out[k] = g * tracks[k](t) * base[k];
      return out;
    },
    // switchable rooms: 0..1
    rooms(t) {
      t = ((t % D) + D) % D;
      const ramp = (a, b) => { const s = (x) => Math.min(1, Math.max(0, x / 0.09)); return s(t - a) * (1 - s(t - b)); };
      const tv = 0.62 + 0.16 * Math.sin(2 * Math.PI * (7 * t / D + 0.1)) + 0.12 * Math.sin(2 * Math.PI * (13 * t / D + 0.6)) + 0.07 * Math.sin(2 * Math.PI * (29 * t / D + 0.3));
      return [ramp(3.9, 12.3), 1 - ramp(6.2, 14.1), ramp(8.0, 15.2), tv];
    },
    // aircraft beacons: 0..1, LED fades of ~1/25 of a period
    beacon(b, t) {
      if (!b.n) return 1;
      const ph = (((t / D) * b.n + b.ph) % 1 + 1) % 1, e = 0.035;
      const up = Math.min(1, ph / e), down = Math.min(1, Math.max(0, (b.duty - ph) / e));
      return ph < b.duty ? Math.min(up, down) : 0;
    },
  };
})();
