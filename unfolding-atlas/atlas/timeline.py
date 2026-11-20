"""Timeline: one function turns (time, style feel) into the full state of the book.

Beats:  rest -> thin leaf turns (curl) -> beat on the title plate -> the board opens and the
pop-up unfolds (geared to the opening angle) -> pieces lock -> life switches on -> hold.
"""
import numpy as np
from .geom import clamp01, smooth, smoother, ramp, ease_io, ease_out, spring

FPS = 30


def beats(anim):
    b = {}
    b['leaf0'] = anim['rest']
    b['leaf1'] = b['leaf0'] + anim['leaf']
    b['open0'] = b['leaf1'] + anim['beat']
    b['land'] = b['open0'] + anim['open']
    b['life'] = b['land'] + anim['life']
    b['total'] = anim['total']
    return b


def open_curve(q, pw):
    """Opening angle 0..1: slow lift, swing, air-cushioned landing."""
    q = clamp01(q)
    e = ease_io(q, pw)
    # linger a little as the board comes down so the unfold can be read
    return 0.82 * e + 0.18 * (1 - (1 - q) ** 2.6)


def state(t, anim, scene):
    b = beats(anim)
    tm = np.floor(t * FPS / 2 + 1e-6) * 2 / FPS if anim.get('twos') else t   # mechanism time (stop-motion on twos)
    st = dict(t=t, tm=tm, b=b)

    # --- thin leaf
    q = ramp(tm, b['leaf0'], b['leaf1'])
    st['leaf'] = ease_io(q, anim.get('leaf_pow', 1.9)) if q < 1 else 1.0

    # --- board / pop-up
    q = ramp(tm, b['open0'], b['land'])
    th = open_curve(q, anim['open_pow'])
    after = tm - b['land']
    if after > 0 and anim['bounce'] > 0:
        th = 1 - np.radians(anim['bounce']) / np.pi * np.exp(-9 * after) * abs(np.sin(2 * np.pi * 3.2 * after))
    st['theta'] = float(th * np.pi)
    st['open'] = q
    st['after'] = after

    # --- per-card lean (tabbed layers lag, then lock with a springy snap) and life wobble
    life_t = tm - b['life']
    st['life_t'] = life_t
    lf = smooth(ramp(tm, b['life'], b['life'] + 1.2))
    st['life'] = lf
    lean, lock_times = {}, {}
    lead = anim.get('lock_lead', 0.25)
    for i, cd in enumerate(scene.cards):
        t_lock = b['land'] - lead + cd.lock * anim['stagger']
        lock_times[cd.id] = t_lock
        sp = spring(tm - t_lock, anim['spring_f'], anim['spring_d'])
        base = anim['lean_v'] if cd.vfold else anim['lean']
        # the lag only builds while the piece is actually being pulled up
        pull = smooth(ramp(th, 0.15, 0.7))
        ln = np.radians(base) * pull * (1 - sp)
        wob = np.radians(anim['wobble'] * cd.sway) * lf * (np.sin(2 * np.pi * (0.33 + 0.07 * (i % 4)) * t + i * 1.7) * 0.7
                                                            + 0.3 * np.sin(2 * np.pi * 0.9 * t + i))
        lean[cd.id] = float(ln + wob)
    st['lean'] = lean
    st['lock_times'] = lock_times

    # --- life channels
    st['flow'] = max(life_t, 0.0) * 1.0                 # seconds of flowing water
    st['water'] = smooth(ramp(tm, b['life'] - 0.1, b['life'] + 0.9))
    st['birds_t'] = t - (b['life'] + anim.get('birds_delay', 0.35))
    st['mist'] = smooth(ramp(t, b['life'] + 0.2, b['life'] + 2.0))
    st['lights'] = tm - (b['life'] + anim.get('lights_delay', 0.0))
    cq = ramp(tm, b['life'] + 0.3, b['total'] + 1.5)
    st['canoe'] = ease_io(cq, 1.6)

    # --- camera: wide and high for the page turn, then a slow push-in / tilt-down for the reveal
    cq = smoother(ramp(t, b['open0'] + 0.5 * anim['open'], b['total'] - 0.2))
    c0 = smoother(ramp(t, 0.0, b['open0']))
    st['cam'] = dict(
        elev=anim['cam_e0'] + (anim['cam_e1'] - anim['cam_e0']) * cq,
        dist=anim['cam_d0'] + (anim['cam_d1'] - anim['cam_d0']) * cq - 0.06 * c0,
        az=anim['cam_az'] * np.sin(np.pi * 0.5 * smoother(ramp(t, b['land'], b['total'] + 0.5))),
        target=(0.0, 0.72 - 0.12 * cq, 0.0 + 0.3 * cq),
        fov=28.0)
    return st


def events(anim, scene):
    """Sound cues (seconds)."""
    b = beats(anim)
    ev = dict(b)
    ev['locks'] = sorted(b['land'] - anim.get('lock_lead', 0.25) + cd.lock * anim['stagger'] for cd in scene.cards)
    return ev
