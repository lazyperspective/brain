'use strict';
function bob(t, ph, a = 1.5) { return Math.sin((t / 4) * 2 * Math.PI + ph) * a; }
function pixelUp(F, low) { F.imageSmoothingEnabled = false; F.drawImage(low, 0, 0, FW, FH); F.imageSmoothingEnabled = true; }
function vignette(F, a, col = '0,0,0') { const g = F.createRadialGradient(FW / 2, FH * 0.48, FW * 0.35, FW / 2, FH * 0.5, FH * 0.75); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`); F.fillStyle = g; F.fillRect(0, 0, FW, FH); }
function grain(F, amt, seed) { const id = F.getImageData(0, 0, FW, FH), d = id.data; let s = seed | 0; for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 8) & 255) / 255 - 0.5; d[i] += n * amt; d[i + 1] += n * amt; d[i + 2] += n * amt; } F.putImageData(id, 0, 0); }
