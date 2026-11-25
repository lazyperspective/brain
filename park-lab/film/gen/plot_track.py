import sys, importlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import coasters
importlib.reload(coasters)

name = sys.argv[1] if len(sys.argv) > 1 else 'hero'
out = sys.argv[2] if len(sys.argv) > 2 else '../scratch/track_%s.png' % name
t = coasters.BUILD[name]()
P = t.Parr
fig, ax = plt.subplots(1, 2, figsize=(18, 7))
tags = list(dict.fromkeys(t.tags))
cm = plt.get_cmap('tab20')
for i, tg in enumerate(tags):
    m = t.tags == tg
    ax[0].scatter(P[m, 0], P[m, 2], s=3, color=cm(i % 20), label=tg)
    ax[1].scatter(t.s[m], P[m, 1], s=3, color=cm(i % 20))
for k in range(0, len(P), 40):
    ax[0].annotate('%d' % P[k, 1], (P[k, 0], P[k, 2]), fontsize=6)
ax[0].set_aspect('equal'); ax[0].invert_yaxis(); ax[0].grid(True); ax[0].legend(fontsize=7)
ax[1].plot(t.s, t.v, 'k-', lw=0.5); ax[1].grid(True)
ax[1].set_title('height (dots) / speed (line)')
plt.tight_layout(); plt.savefig(out, dpi=80)
print(out)
