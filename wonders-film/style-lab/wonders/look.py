"""Look layer (style-lab only): lets one world be rasterised in two passes for a style.

  MODE None    -> the film's own look, untouched (argb is the original function)
  MODE 'color' -> the COLOUR pass: every fill/coloured line goes through STYLE.cmap(); black ink
                  and blue construction pencil are left out (alpha 0) - they become masks instead
  MODE 'mask'  -> the ROLE pass, same geometry and painter's order:
                     R = ink line-art coverage, G = construction-pencil coverage,
                     B = wetness of the colour wash (1 = the wet front, 0 = settled / not a wash)
                  Because it is painted in the same order, every mask respects occlusion exactly.
A style's post() then composes the two passes in its own medium.
"""
import skia

MODE = None
WET = 0.0
STYLE = None
INKI = (40, 35, 33)
PENI = (64, 96, 146)
PAPERI = (241, 236, 224)
_cache = {}


def set_style(st):
    global STYLE
    STYLE = st
    _cache.clear()


def argb(c, a):
    A = int(max(0.0, min(1.0, a)) * 255)
    ci = (int(c[0]), int(c[1]), int(c[2]))
    if MODE == 'mask':
        if ci == INKI:
            return skia.ColorSetARGB(A, 255, 0, 0)
        if ci == PENI:
            return skia.ColorSetARGB(A, 0, 255, 0)
        return skia.ColorSetARGB(A, 0, 0, int(255 * WET))
    if ci == INKI or ci == PENI:
        return skia.ColorSetARGB(0, 0, 0, 0)
    k = _cache.get(ci)
    if k is None:
        r, g, b = STYLE.cmap(ci)
        k = (int(max(0, min(255, round(r)))), int(max(0, min(255, round(g)))), int(max(0, min(255, round(b)))))
        _cache[ci] = k
    return skia.ColorSetARGB(A, k[0], k[1], k[2])
