'use strict';
function bob(t, ph, a = 1.5) { return Math.sin((t / 4) * 2 * Math.PI + ph) * a; }
function pixelUp(F, low) { F.imageSmoothingEnabled = false; F.drawImage(low, 0, 0, FW, FH); F.imageSmoothingEnabled = true; }
function vignette(F, a, col = '0,0,0') { const g = F.createRadialGradient(FW / 2, FH * 0.48, FW * 0.35, FW / 2, FH * 0.5, FH * 0.75); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`); F.fillStyle = g; F.fillRect(0, 0, FW, FH); }
function grain(F, amt, seed) { const id = F.getImageData(0, 0, FW, FH), d = id.data; let s = seed | 0; for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 8) & 255) / 255 - 0.5; d[i] += n * amt; d[i + 1] += n * amt; d[i + 2] += n * amt; } F.putImageData(id, 0, 0); }

// far islands: crisp pixels softened by depth of field and tinted by atmospheric haze
function farLayer(F, hiF, lowF, t) {
  const c = hiF.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, FW, FH); c.imageSmoothingEnabled = false; c.drawImage(lowF, 0, 0, FW, FH);
  c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(34,26,62,0.42)'; c.fillRect(0, 0, FW, FH); c.globalCompositeOperation = 'source-over';
  F.save(); F.filter = 'blur(2.2px)'; F.drawImage(hiF, 0, 0); F.restore();
}
// a slow band of mist drifting beneath the island (between it and the far islands)
function midMist(F, T) {
  F.save(); F.globalCompositeOperation = 'lighter'; F.filter = 'blur(38px)';
  for (let q = 0; q < 6; q++) { const base = S([((q * 90 + T * (4 + q)) % 520) - 80, 330 + Math.sin(q * 2.1) * 26], 0.75); F.fillStyle = 'rgba(120,100,170,0.10)'; F.beginPath(); F.ellipse(base[0] * SC, base[1] * SC, 260 * (1 + (CAM.z - 1) * 0.75), 60 * (1 + (CAM.z - 1) * 0.75), 0, 0, 7); F.fill(); }
  F.restore();
}
// the waterfall dissolves into a soft cold mist
function waterMist(F, T) {
  if (!WF_MIST) return; const [x, y, k] = WF_MIST, r = 46 * k;
  F.save(); F.globalCompositeOperation = 'lighter'; F.filter = 'blur(22px)';
  for (let q = 0; q < 4; q++) { const ox = Math.sin(T * 0.8 + q * 1.7) * 14 * k, oy = Math.cos(T * 0.6 + q) * 6 * k; F.fillStyle = 'rgba(140,200,240,0.13)'; F.beginPath(); F.ellipse((x + ox / 3) * SC, (y + oy / 3) * SC, r * (0.8 + q * 0.2), r * 0.5, 0, 0, 7); F.fill(); }
  F.restore();
}
