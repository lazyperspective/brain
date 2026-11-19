"""Easing: nothing in the film moves linearly."""
import math


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def in_out(x, k=3.0):
    x = clamp(x)
    return 0.5 * (2 * x) ** k if x < 0.5 else 1 - 0.5 * (2 - 2 * x) ** k


def out_cubic(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def out_quint(x):
    x = clamp(x)
    return 1 - (1 - x) ** 5


def in_cubic(x):
    x = clamp(x)
    return x ** 3


def out_back(x, s=1.9):
    """overshoot then settle"""
    x = clamp(x)
    x -= 1
    return 1 + x * x * ((s + 1) * x + s)


def anticipate_back(x, a=0.12, s=2.2):
    """dip below zero first (anticipation), overshoot past one, settle."""
    x = clamp(x)
    if x < a:
        return -0.10 * math.sin(math.pi * x / a)
    return out_back((x - a) / (1 - a), s)


def spring(x, freq=2.4, damp=5.5):
    """0 -> 1 with damped oscillation (overshoot + secondary settle)."""
    if x <= 0:
        return 0.0
    if x >= 1.6:
        return 1.0
    return 1 - math.exp(-damp * x) * math.cos(2 * math.pi * freq * x)


def bounce(x):
    x = clamp(x)
    n, d = 7.5625, 2.75
    if x < 1 / d:
        return n * x * x
    if x < 2 / d:
        x -= 1.5 / d
        return n * x * x + 0.75
    if x < 2.5 / d:
        x -= 2.25 / d
        return n * x * x + 0.9375
    x -= 2.625 / d
    return n * x * x + 0.984375
