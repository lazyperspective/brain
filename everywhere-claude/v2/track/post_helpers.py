import numpy as np
def curve_pts(w, n=60):
    p0, u, nr, c = np.array(w['p0']), np.array(w['u']), np.array(w['n']), w['coef']
    s = np.linspace(w['smin'], w['smax'], n)
    off = c[0] + c[1] * s + c[2] * s * s
    return p0[None] + s[:, None] * u[None] + off[:, None] * nr[None]
def curve_at(w, s):
    p0, u, nr, c = np.array(w['p0']), np.array(w['u']), np.array(w['n']), w['coef']
    off = c[0] + c[1] * s + c[2] * s * s
    return p0 + s * u + off * nr
