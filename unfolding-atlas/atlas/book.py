"""The book: cover, page blocks, the thin turning leaf (paper curl) and the stiff pop-up board."""
import numpy as np
import skia
from .geom import v3, norm, clamp01

STACK_T = 0.05      # page-block thickness
COVER_T = 0.02
BOARD_T = 0.013     # thickness of the pop-up board
COVER_M = 0.065     # cover margin beyond the pages


def leaf_surface(p, W, H, ns=44, ny=12, lag=0.13, K=1.08, belly=-0.32, zoff=0.0):
    """Developable-ish curl of a thin leaf hinged at the spine.

    p: turn progress 0 (flat on the right) .. 1 (flat on the left).
    The tangent angle psi(s) along the leaf = hinge angle + curl that leads with the free edge
    early in the turn and trails behind late in the turn; the near corner leads slightly.
    Returns verts[ny+1, ns+1, 3], normals (recto side), s grid, y grid.
    """
    ss = np.linspace(0, W, ns + 1)
    ys = np.linspace(0, H, ny + 1)
    q = ss / W
    ds = W / ns
    V = np.zeros((ny + 1, ns + 1, 3))
    N = np.zeros((ny + 1, ns + 1, 3))
    for j, y in enumerate(ys):
        py = clamp01(p + lag * (0.5 - y / H) * np.sin(np.pi * p) ** 1.2)
        e = py * py * (3 - 2 * py)
        A = np.pi * (0.35 * py + 0.65 * e)
        C = K * np.sin(2 * np.pi * py) * (0.55 + 0.45 * np.sin(np.pi * py))
        psi = A + C * q ** 1.45 + belly * np.sin(np.pi * q) * np.sin(np.pi * py) ** 2
        psi = np.clip(psi, 0.0, np.pi)
        pm = 0.5 * (psi[1:] + psi[:-1])
        x = np.concatenate([[0], np.cumsum(np.cos(pm) * ds)])
        z = np.concatenate([[0], np.cumsum(np.sin(pm) * ds)])
        V[j, :, 0], V[j, :, 1], V[j, :, 2] = x, y, np.maximum(z, 0) + zoff
        N[j, :, 0], N[j, :, 2] = -np.sin(psi), np.cos(psi)
    return V, N, ss, ys
