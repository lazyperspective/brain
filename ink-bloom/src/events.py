"""Shared timeline + deterministic bubble events (used by both picture and sound)."""
import numpy as np

FPS = 30
BEAT = 0.875
BAR = 3.5
CYC = 7.0
T = 28.0
NFRAMES = 840
LEAD = 4.0 / 30.0
ENTRY_X = [700.0, 742.0, 706.0, 722.0]
ENTRY2_X = [760.0, 560.0, 850.0, 690.0]
TAU = 0.16


def _mk(rng, t0, x0, n, big):
    out = []
    for i in range(n):
        r = rng.uniform(2.6, 8.5 if big else 6.0) * (1.0 if rng.random() < 0.8 else 1.5)
        v0 = rng.uniform(350, 1350 if big else 950)
        vr = 95.0 * np.sqrt(r) * rng.uniform(0.85, 1.15)
        b = dict(t0=t0 + rng.uniform(0.0, 0.10), x0=x0 + rng.uniform(-26, 26), y0=rng.uniform(2, 14), v0=v0, vr=vr,
                 vx=rng.uniform(-260, 260), amp=rng.uniform(3, 12), om=rng.uniform(9, 17), ph=rng.uniform(0, 6.28), r=r, chain=False)
        a = np.linspace(0.02, 6.0, 3000)
        y = bubble_y(b, a)
        k = np.argmax(y < -r)
        b["life"] = float(a[k]) if y[k] < -r else 6.0
        out.append(b)
    return out


def bubble_y(b, a):
    if b["chain"]:
        return b["y0"] - b["vr"] * a
    return b["y0"] + (b["v0"] + b["vr"]) * TAU * (1 - np.exp(-a / TAU)) - b["vr"] * a


def bubble_x(b, a):
    if b["chain"]:
        return b["x0"] + b["amp"] * np.sin(b["om"] * a + b["ph"])
    return b["x0"] + b["vx"] * TAU * (1 - np.exp(-a / TAU)) + b["amp"] * np.sin(b["om"] * a + b["ph"]) * (1 - np.exp(-a / 0.3))


def make_bubbles():
    rng = np.random.default_rng(2024)
    bubbles = []
    for k in range(4):
        t_imp = (k * CYC - LEAD) % T
        bubbles += _mk(rng, t_imp, ENTRY_X[k], 24, True)
        bubbles += _mk(rng, (k * CYC - LEAD + 2 * BEAT) % T, ENTRY2_X[k], 11, False)
        # a quiet chain of bubbles rising near the edge of frame during the hold
        xe = [232.0, 1206.0, 246.0, 1196.0][k]
        tc = k * CYC + 4.55
        for i in range(7):
            r = rng.uniform(2.8, 6.5)
            vr = rng.uniform(250, 330) * np.sqrt(r / 4.5)
            y0 = 1940 + rng.uniform(0, 30)
            b = dict(t0=(tc + i * rng.uniform(0.16, 0.34)) % T, x0=xe + rng.uniform(-10, 10), y0=y0, v0=0.0, vr=vr, vx=0.0,
                     amp=rng.uniform(6, 16), om=rng.uniform(5, 9), ph=rng.uniform(0, 6.28), r=r, chain=True)
            b["life"] = (y0 + r) / vr
            bubbles.append(b)
    return bubbles


BUBBLES = make_bubbles()

if __name__ == "__main__":
    print(len(BUBBLES), "bubbles; lifetimes", np.round([b["life"] for b in BUBBLES[:10]], 2))
