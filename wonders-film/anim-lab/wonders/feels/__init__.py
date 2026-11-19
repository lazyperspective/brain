"""anim-lab feels: alternative animation directions for the same world.  get(name) -> Feel class."""
import importlib

FEELS = [
    # (n, name, module, class)
    (0, 'current', 'base', 'Feel'),
    (1, 'popup', 'popup', 'PopUp'),
    (2, 'stopmo', 'stopmo', 'StopMotion'),
    (3, 'toybox', 'toybox', 'ToyBox'),
    (4, 'tide', 'tide', 'Tide'),
    (5, 'plotter', 'plotter', 'Plotter'),
    (6, 'rubber', 'rubber', 'Rubber'),
    (7, 'growth', 'growth', 'Growth'),
    (8, 'sand', 'sand', 'Sand'),
]


def register(n, name, module, cls):
    FEELS.append((n, name, module, cls))


def get(name):
    for n, nm, mod, cls in FEELS:
        if nm == name or str(n) == str(name):
            m = importlib.import_module('.' + mod, __name__)
            return getattr(m, cls)
    raise SystemExit('unknown feel %r; have %s' % (name, ', '.join(nm for _, nm, _, _ in FEELS)))


def number(name):
    for n, nm, _, _ in FEELS:
        if nm == name:
            return n
    return 99
