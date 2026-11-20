#!/usr/bin/env python
"""Contact sheets: review strips (10 fps) per clip, the labelled hero grid and the 5-row option strips."""
import os, sys, glob
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'options')
NAMES = [(1, 'lamplit', 'lamplit_paper_theatre', 'Lamplit Paper Theatre', 'cut paper under one warm lamp - springy pop'),
         (2, 'riso', 'riso_field_press', 'Riso Field Press', '3 spot inks, printed while you watch - on twos'),
         (3, 'field', 'naturalist_watercolour', "Naturalist's Field Atlas", 'pen drawing that floods with watercolour - slow bloom'),
         (4, 'night', 'night_lantern_atlas', 'Night Lantern Atlas', 'luminous inks on indigo, light runs down the river - floaty'),
         (5, 'gilded', 'gilded_engraving', "Gilded Engraver's Atlas", 'hand-coloured copperplate with moving gold leaf - stately')]


def frames_of(mp4):
    cap = cv2.VideoCapture(mp4)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    cap.release()
    return out


def label(img, text, sub=None, scale=1.0):
    import skia
    h, w = img.shape[:2]
    s = skia.Surface(w, h)
    c = s.getCanvas()
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    c.drawImage(skia.Image.fromarray(rgba, colorType=skia.kBGRA_8888_ColorType), 0, 0)
    f1 = skia.Font(skia.Typeface('Inter', skia.FontStyle.Bold()), 30 * scale)
    f2 = skia.Font(skia.Typeface('Inter', skia.FontStyle.Normal()), 19 * scale)
    tw = max(f1.measureText(text), f2.measureText(sub or ''))
    c.drawRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(18 * scale, 16 * scale, tw + 32 * scale, (76 if sub else 50) * scale), 10 * scale, 10 * scale),
                skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.04, 0.04, 0.06, 0.78)))
    c.drawString(text, 34 * scale, 50 * scale, f1, skia.Paint(AntiAlias=True, Color=skia.ColorWHITE))
    if sub:
        c.drawString(sub, 34 * scale, 78 * scale, f2, skia.Paint(AntiAlias=True, Color4f=skia.Color4f(0.85, 0.87, 0.9, 1)))
    return np.ascontiguousarray(s.makeImageSnapshot().toarray()[..., :3])


def review(key, scratch, cols=6, tw=640):
    """10 fps review sheets written to scratch (not a deliverable)."""
    num, _, slug, title, _ = next(n for n in NAMES if n[1] == key)
    fr = frames_of(os.path.join(OUT, f'option_{num}_{slug}.mp4'))[::3]
    th = tw * 9 // 16
    tiles = []
    for i, f in enumerate(fr):
        t = cv2.resize(f, (tw, th), interpolation=cv2.INTER_AREA)
        cv2.putText(t, f'{i * 0.1:.1f}', (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 4)
        cv2.putText(t, f'{i * 0.1:.1f}', (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        tiles.append(t)
    per = cols * 4
    paths = []
    for k in range(0, len(tiles), per):
        chunk = tiles[k:k + per]
        while len(chunk) % cols:
            chunk.append(np.zeros_like(chunk[0]))
        rows = [np.hstack(chunk[r:r + cols]) for r in range(0, len(chunk), cols)]
        p = os.path.join(scratch, f'review_{key}_{k // per}.jpg')
        cv2.imwrite(p, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
        paths.append(p)
    return paths


def deliver():
    heroes = []
    for num, key, slug, title, sub in NAMES:
        im = cv2.imread(os.path.join(OUT, f'option_{num}_{slug}.png'))
        heroes.append(label(cv2.resize(im, (1280, 720), interpolation=cv2.INTER_AREA), f'{num}  {title}', sub, 0.9))
    # grid: 3 on top, 2 centred below
    pad = 24
    Wd = 3 * 1280 + 4 * pad
    Hd = 2 * 720 + 3 * pad
    grid = np.full((Hd, Wd, 3), 18, np.uint8)
    for i, h in enumerate(heroes[:3]):
        grid[pad:pad + 720, pad + i * (1280 + pad):pad + i * (1280 + pad) + 1280] = h
    x0 = (Wd - (2 * 1280 + pad)) // 2
    for i, h in enumerate(heroes[3:]):
        grid[2 * pad + 720:2 * pad + 1440, x0 + i * (1280 + pad):x0 + i * (1280 + pad) + 1280] = h
    cv2.imwrite(os.path.join(OUT, 'options_grid.jpg'), grid, [cv2.IMWRITE_JPEG_QUALITY, 92])
    # strips: 8 frames across each clip
    rows = []
    for num, key, slug, title, sub in NAMES:
        fr = frames_of(os.path.join(OUT, f'option_{num}_{slug}.mp4'))
        n = len(fr)
        picks = [int(round(f * (n - 1))) for f in (0.03, 0.135, 0.3, 0.4, 0.47, 0.545, 0.68, 0.93)]
        tiles = [cv2.resize(fr[i], (640, 360), interpolation=cv2.INTER_AREA) for i in picks]
        for i, t in zip(picks, tiles):
            cv2.putText(t, f'{i / 30:.1f}s', (540, 348), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 4)
            cv2.putText(t, f'{i / 30:.1f}s', (540, 348), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        tiles[0] = label(tiles[0], f'{num}  {title}', None, 0.62)
        rows.append(np.hstack(tiles))
    cv2.imwrite(os.path.join(OUT, 'options_strips.jpg'), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 90])
    print('wrote options_grid.jpg, options_strips.jpg')


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == 'review':
        for k in sys.argv[3:]:
            print(review(k, sys.argv[2]))
    else:
        deliver()
