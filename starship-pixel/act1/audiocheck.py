#!/usr/bin/env python3
"""audiocheck.py - listen-free checks of score.wav: loudness (ffmpeg ebur128), clipping, and sync:
strongest onset (spectral flux) near each cut / key event."""
import sys, subprocess, re, numpy as np
from scipy.io import wavfile
from scipy import signal
f = sys.argv[1] if len(sys.argv) > 1 else '/home/user/brain/starship-pixel-video/score.wav'
sr, x = wavfile.read(f); x = x.astype(float) / (2 ** 31 if x.dtype == np.int32 else 32768)
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]; LRA = re.findall(r'LRA:\s+(-?[\d.]+) LU', r)[-1]; TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1]
print(f'file {f}: {sr} Hz, {x.shape[1]} ch, {len(x)/sr:.3f} s | integrated {I} LUFS, LRA {LRA} LU, true peak {TP} dBTP | samples at full scale: {(np.abs(x) >= 0.9999).sum()}')
m = x.mean(axis=1); hop = 240
F, T, Z = signal.stft(m, sr, nperseg=2048, noverlap=2048 - hop)
mag = np.abs(Z); flux = np.maximum(0, np.diff(np.log1p(mag * 50), axis=1)).sum(axis=0); tt = T[1:]
flux = (flux - np.median(flux)) / (np.std(flux) + 1e-9)
ev = [('cut shot2', 4.338), ('cut shot3', 12.146), ('cut shot4', 15.115), ('cut shot5', 18.919), ('cut act2 + boom', 30.1), ('2nd boom', 30.44),
      ('engine ignition', 53.45), ('cut shot7', 60.3), ('cut shot8', 65.8), ('catch clank', 68.0), ('cut shot9', 71.2), ('cut shot10', 78.6)]
for name, t in ev:
    w = (tt > t - 0.12) & (tt < t + 0.12); k = np.argmax(np.where(w, flux, -1e9))
    print(f'  {name:18s} {t:7.3f} s -> strongest onset {tt[k]:7.3f} s ({(tt[k]-t)*1000:+5.0f} ms), strength {flux[k]:5.1f} sd')
