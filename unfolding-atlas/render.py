#!/usr/bin/env python
"""Render one style option of The Unfolding Atlas: frames -> x264 mp4 (+ foley) + hero still.

    .venv/bin/python render.py lamplit            # full clip
    .venv/bin/python render.py lamplit --t 4.2 9.3  # single frames into scratch/
"""
import argparse, importlib, os, subprocess, sys, time
import multiprocessing as mp
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
OPTIONS = [('lamplit', 1, 'lamplit_paper_theatre'), ('riso', 2, 'riso_field_press'), ('field', 3, 'naturalist_watercolour'),
           ('night', 4, 'night_lantern_atlas'), ('gilded', 5, 'gilded_engraving')]
FPS = 30
_E = {}


def build(name, ow, ss):
    from atlas.scene import build_scene
    from atlas.engine import Engine
    mod = importlib.import_module('atlas.styles.' + name)
    sc = build_scene()
    bad = sc.mech.validate(sc.cards)
    assert not bad, f'paper sticks out of the closed book: {bad}'
    sty = mod.STYLE(sc)
    t0 = time.time()
    sty.bake(log=lambda *a: None)
    print(f'[{name}] baked in {time.time() - t0:.1f}s', flush=True)
    return sc, sty, Engine(sc, sty, ow, ow * 9 // 16, ss)


def _frame(args):
    i, out = args
    im = _E['en'].render(i / FPS)
    cv2.imwrite(os.path.join(out, f'f_{i:04d}.png'), im, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    return i


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('style')
    ap.add_argument('--t', nargs='*', type=float, help='render only these times (seconds) as jpgs')
    ap.add_argument('--ss', type=float, default=1.5)
    ap.add_argument('--width', type=int, default=1920)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--scratch', default=os.environ.get('ATLAS_SCRATCH', os.path.join(HERE, 'scratch')))
    ap.add_argument('--silent', action='store_true')
    a = ap.parse_args()
    sc, sty, en = build(a.style, a.width, a.ss)
    _E['en'] = en
    os.makedirs(a.scratch, exist_ok=True)
    if a.t:
        for t in a.t:
            t0 = time.time()
            im = en.render(t)
            p = os.path.join(a.scratch, f'{a.style}_{t:05.2f}.jpg')
            cv2.imwrite(p, im, [cv2.IMWRITE_JPEG_QUALITY, 93])
            print(p, f'{time.time() - t0:.2f}s')
        return
    num, slug = next((n, s) for (k, n, s) in OPTIONS if k == a.style)
    total = sty.anim['total']
    nfr = int(round(total * FPS))
    fdir = os.path.join(a.scratch, 'frames_' + a.style)
    os.makedirs(fdir, exist_ok=True)
    for f in os.listdir(fdir):
        os.remove(os.path.join(fdir, f))
    t0 = time.time()
    with mp.get_context('fork').Pool(a.workers) as pool:
        for k, i in enumerate(pool.imap_unordered(_frame, [(i, fdir) for i in range(nfr)], chunksize=2)):
            if k % 40 == 0:
                print(f'[{a.style}] {k}/{nfr} frames, {time.time() - t0:.0f}s', flush=True)
    print(f'[{a.style}] frames done in {time.time() - t0:.0f}s', flush=True)
    out_dir = os.path.join(HERE, 'options')
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.join(out_dir, f'option_{num}_{slug}')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(fdir, 'f_%04d.png')]
    if not a.silent:
        from atlas.audio import make_track
        from atlas.timeline import events
        wav = os.path.join(a.scratch, a.style + '.wav')
        make_track(events(sty.anim, sc), wav, kind=getattr(sty, 'ambience', 'day'), seed=num, snap_pitch=getattr(sty, 'snap_pitch', 1.0))
        cmd += ['-i', wav, '-c:a', 'aac', '-b:a', '192k', '-shortest']
    cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '4', base + '.mp4']
    subprocess.run(cmd, check=True)
    hero = int(round((total - 0.7) * FPS))
    im = cv2.imread(os.path.join(fdir, f'f_{hero:04d}.png'))
    cv2.imwrite(base + '.png', im, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    print('wrote', base + '.mp4', base + '.png', flush=True)


if __name__ == '__main__':
    main()
