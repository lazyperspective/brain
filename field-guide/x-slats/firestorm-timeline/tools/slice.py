#!/usr/bin/env python3
"""Slice the master into 20 X 'slat' strips and build review sheets.

usage: python3 tools/slice.py MASTER.png OUTDIR [--quick]
  OUTDIR/strips/strip-01.jpg ... strip-20.jpg   (200x4000, q92, sRGB)
  OUTDIR/feed-mock.png        initial feed view (first ~14 strips)
  OUTDIR/feed-mock-full.png   all 20 strips (after swiping)
  OUTDIR/strips-sheet.jpg     contact sheet of all strips at readable size
  OUTDIR/crops/strip-XX-*.jpg full-res detail crops
With --quick only the sheet + feed mocks are produced (for iteration).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageCms

N = 20


def rounded(im, rad):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), rad, fill=255)
    out = Image.new('RGB', im.size, (0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out, mask


def strips_of(master):
    W, H = master.size
    sw = W // N
    return [master.crop((i * sw, 0, (i + 1) * sw, H)) for i in range(N)]


def feed_mock(strips, count, sw=40, gap=10, rad=7, pad=24, bg=(0, 0, 0)):
    sh = sw * 20
    W = pad * 2 + count * sw + (count - 1) * gap
    H = pad * 2 + sh
    out = Image.new('RGB', (W, H), bg)
    for i in range(count):
        s = strips[i].resize((sw, sh), Image.LANCZOS)
        s, m = rounded(s, rad)
        out.paste(s, (pad + i * (sw + gap), pad), m)
    return out


def main():
    master_p, outdir = sys.argv[1], sys.argv[2]
    quick = '--quick' in sys.argv
    master = Image.open(master_p).convert('RGB')
    strips = strips_of(master)
    os.makedirs(outdir, exist_ok=True)
    # feed mocks: phone-ish proportions (strip 40x800, 10px gap)
    feed_mock(strips, 14).save(os.path.join(outdir, 'feed-mock.png'))
    feed_mock(strips, 20).save(os.path.join(outdir, 'feed-mock-full.png'))
    # contact sheet: strips at 1/2 of 4000-master height (100x2000) with labels
    scale = 2000 / strips[0].size[1]
    sw, sh = round(strips[0].size[0] * scale), 2000
    gap = 14
    sheet = Image.new('RGB', (N * sw + (N + 1) * gap, sh + 60), (12, 10, 10))
    d = ImageDraw.Draw(sheet)
    for i, s in enumerate(strips):
        x = gap + i * (sw + gap)
        sheet.paste(s.resize((sw, sh), Image.LANCZOS), (x, 40))
        d.text((x + sw // 2 - 6, 12), f'{i + 1:02d}', fill=(230, 200, 170))
    sheet.save(os.path.join(outdir, 'strips-sheet.jpg'), quality=90)
    if quick:
        return
    sd = os.path.join(outdir, 'strips')
    os.makedirs(sd, exist_ok=True)
    srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    for i, s in enumerate(strips):
        p = os.path.join(sd, f'strip-{i + 1:02d}.jpg')
        s.save(p, 'JPEG', quality=92, subsampling=0, optimize=True, icc_profile=srgb)
    # detail crops: each strip in three vertical thirds at full res, as triptych
    cd = os.path.join(outdir, 'crops')
    os.makedirs(cd, exist_ok=True)
    for i, s in enumerate(strips):
        w, h = s.size
        parts = [s.crop((0, k * h // 4, w, (k + 1) * h // 4)) for k in range(4)]
        trip = Image.new('RGB', (w * 4 + 30, h // 4), (12, 10, 10))
        for k, p in enumerate(parts):
            trip.paste(p, (k * (w + 10), 0))
        trip.save(os.path.join(cd, f'strip-{i + 1:02d}-quarters.jpg'), quality=90)


if __name__ == '__main__':
    main()
