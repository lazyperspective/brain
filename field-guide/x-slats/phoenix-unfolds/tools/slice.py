#!/usr/bin/env python3
"""Slice the 4000x4000 master into 20 X 'slat' strips and build previews.

usage: slice.py MASTER OUTDIR [--preview-only] [--crops 4,11,20]
  OUTDIR/strips/strip-01.jpg .. strip-20.jpg   200x(4000) JPEG q92 sRGB
  OUTDIR/feed-mock.png        first ~14 strips as seen in the X feed (phone scale)
  OUTDIR/feed-mock-full.png   all 20 strips side by side
  OUTDIR/strips-sheet.jpg     contact sheet of all 20 strips
  OUTDIR/crops/strip-NN-*.jpg full-res detail crops
"""
import sys, os
from PIL import Image, ImageDraw

N = 20
# y-centre (in the 4000px master) of each strip's micro-story, for the 1:1 detail collage
STORY_Y = [3200, 3600, 2560, 2760, 2400, 2960, 2150, 2200, 2880, 3280,
           1100, 3200, 3280, 2650, 2870, 2290, 2930, 3270, 2860, 2270]

def rounded(im, r, bg=(0, 0, 0)):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255)
    out = Image.new('RGB', im.size, bg)
    out.paste(im, (0, 0), mask)
    return out

def feed_mock(master, count, strip_w=56, gap=6, pad=14, radius=9):
    W, H = master.size
    sw = W // N
    strip_h = round(strip_w * H / sw)
    total_w = pad * 2 + count * strip_w + (count - 1) * gap
    canvas = Image.new('RGB', (total_w, strip_h + pad * 2), (0, 0, 0))
    for i in range(count):
        s = master.crop((i * sw, 0, (i + 1) * sw, H)).resize((strip_w, strip_h), Image.LANCZOS)
        canvas.paste(rounded(s, radius), (pad + i * (strip_w + gap), pad))
    return canvas

def main():
    src, outdir = sys.argv[1], sys.argv[2]
    preview_only = '--preview-only' in sys.argv
    crops = []
    if '--crops' in sys.argv:
        crops = [int(x) for x in sys.argv[sys.argv.index('--crops') + 1].split(',')]
    os.makedirs(outdir, exist_ok=True)
    m = Image.open(src).convert('RGB')
    W, H = m.size
    sw = W // N
    if not preview_only:
        os.makedirs(os.path.join(outdir, 'strips'), exist_ok=True)
        for i in range(N):
            s = m.crop((i * sw, 0, (i + 1) * sw, H))
            p = os.path.join(outdir, 'strips', f'strip-{i + 1:02d}.jpg')
            s.save(p, 'JPEG', quality=92, subsampling=0, optimize=True)
    feed_mock(m, 14).save(os.path.join(outdir, 'feed-mock.png'))
    feed_mock(m, 20).save(os.path.join(outdir, 'feed-mock-full.png'))
    # contact sheet: strips at 1/2.5 scale with labels
    scale = 0.4 if W >= 4000 else 1.6 * W / 4000 * 0.25 * 4
    tw = max(20, round(sw * scale)); th = round(H * tw / sw)
    gap = 10
    sheet = Image.new('RGB', (N * tw + (N + 1) * gap, th + 2 * gap + 24), (12, 10, 14))
    d = ImageDraw.Draw(sheet)
    for i in range(N):
        s = m.crop((i * sw, 0, (i + 1) * sw, H)).resize((tw, th), Image.LANCZOS)
        x = gap + i * (tw + gap)
        sheet.paste(s, (x, gap))
        d.text((x + 2, th + gap + 6), f'{i + 1:02d}', fill=(200, 180, 160))
    sheet.save(os.path.join(outdir, 'strips-sheet.jpg'), 'JPEG', quality=90)
    if W == 4000:
        # 1:1 collage: the micro-story of every strip (200x420 tiles, two rows of ten)
        tw, th, g = 200, 420, 8
        col = Image.new('RGB', (10 * tw + 11 * g, 2 * th + 3 * g + 40), (14, 12, 16))
        dd = ImageDraw.Draw(col)
        for i in range(N):
            y0 = max(0, min(H - th, STORY_Y[i] - th // 2))
            tile = m.crop((i * sw, y0, (i + 1) * sw, y0 + th))
            x = g + (i % 10) * (tw + g); y = g + (i // 10) * (th + g + 20)
            col.paste(tile, (x, y))
            dd.text((x + 2, y + th + 3), f'strip {i + 1:02d}', fill=(200, 180, 160))
        col.save(os.path.join(outdir, 'story-details.jpg'), 'JPEG', quality=92)
    if crops:
        cd = os.path.join(outdir, 'crops'); os.makedirs(cd, exist_ok=True)
        for c in crops:
            i = c - 1
            s = m.crop((i * sw, 0, (i + 1) * sw, H))
            # three vertical thirds side by side, so a tall strip fits one image
            third = H // 3
            tile = Image.new('RGB', (sw * 3 + 20, third), (30, 30, 30))
            for k in range(3):
                tile.paste(s.crop((0, k * third, sw, (k + 1) * third)), (k * (sw + 10), 0))
            tile.save(os.path.join(cd, f'strip-{c:02d}-thirds.jpg'), 'JPEG', quality=92)

if __name__ == '__main__':
    main()
