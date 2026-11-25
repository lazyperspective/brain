#!/usr/bin/env python3
"""Assemble the park film from rendered shots + score.

  python3 film/assemble.py                 # needs every film/shots/<id>.mp4
  python3 film/assemble.py --placeholders  # fills missing shots with solid-colour placeholders (for testing)
  python3 film/assemble.py --only-share    # skip the master

Inputs : film/plan/shots.json, film/shots/<id>.mp4 (30 fps, frame 0 = t_start, i.e. 6 handle frames
         before the edit-in; stop-motion shots already hold frames on twos), film/audio/score.wav
Outputs: film/out/park_film.mp4 (x264 CRF 16, AAC 320k), film/out/park_film_share.mp4 (CRF 23, maxrate 12M)
Transitions: hard cuts on the beat; whip_* cuts get a 6-frame directional motion smear centred on the cut;
the drop (t=32.0) gets a 2-frame light flash. One ffmpeg process at a time.
"""
import json, os, subprocess, sys, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
SHOTS = json.load(open(os.path.join(ROOT, 'plan', 'shots.json')))
FPS = SHOTS['fps']
W, H = SHOTS['size']
OUT = os.path.join(ROOT, 'out')
SCORE = os.path.join(ROOT, 'audio', 'score.wav')
PLACEHOLDER_COLORS = {'paper': '0xE8D9B5', 'gouache': '0x8FB36B', 'felt': '0xD98E73', 'lowpoly': '0x48A0E0', 'pixel': '0x6BBE45',
                      'tin': '0xC8463A', 'tiltshift': '0x2E294E', 'snowglobe': '0xBFD9FF'}


def probe_frames(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets,r_frame_rate,width,height',
                        '-of', 'json', path], capture_output=True, text=True)
    s = json.loads(r.stdout)['streams'][0]
    return int(s['nb_read_packets']), s['r_frame_rate'], s['width'], s['height']


def make_placeholder(shot, path):
    n = shot['render']['frames']
    col = PLACEHOLDER_COLORS.get(shot['style'], '0x808080')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=%s:s=480x270:r=%d' % (col, FPS),
                    '-frames:v', str(n),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', path], check=True)


def main():
    placeholders = '--placeholders' in sys.argv
    only_share = '--only-share' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    inputs, filters, labels, report = [], [], [], []
    tmpdir = os.path.join(ROOT, 'scratch', 'placeholders')
    for i, s in enumerate(SHOTS['shots']):
        path = os.path.join(ROOT, 'shots', s['id'] + '.mp4')
        if not os.path.exists(path):
            if not placeholders:
                sys.exit('missing %s (use --placeholders to test)' % path)
            os.makedirs(tmpdir, exist_ok=True)
            path = os.path.join(tmpdir, s['id'] + '.mp4')
            if not os.path.exists(path):
                make_placeholder(s, path)
            report.append('%s: placeholder' % s['id'])
        n, rate, w, h = probe_frames(path)
        hnd, F = s['render']['handles'], s['film_frames']
        need = hnd + F
        if n < need:
            report.append('%s: only %d frames (need >= %d) -> last frame is held' % (s['id'], n, need))
        if rate not in ('30/1', '30000/1000'):
            report.append('%s: frame rate %s (expected 30) -> resampled' % (s['id'], rate))
        inputs += ['-i', path]
        filters.append('[%d:v]fps=%d,trim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop=%d,trim=end_frame=%d,'
                       'scale=%d:%d:flags=lanczos:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v%d]'
                       % (i, FPS, hnd, hnd + F, F, F, W, H, W, H, i))
        labels.append('[v%d]' % i)
    ns = len(SHOTS['shots'])
    filters.append('%sconcat=n=%d:v=1:a=0[vc]' % (''.join(labels), ns))
    # transitions
    post = []
    for a, b in zip(SHOTS['shots'], SHOTS['shots'][1:]):
        typ = (a.get('transition_out') or {}).get('type', 'cut')
        t = b['start']
        win = 'between(t,%.4f,%.4f)' % (t - 3.5 / FPS, t + 2.5 / FPS)
        if typ in ('whip_left', 'whip_right'):
            post.append("gblur=sigma=40:sigmaV=0.5:steps=2:enable='%s'" % win)
        elif typ in ('whip_up_right', 'tilt_up_sky'):
            post.append("gblur=sigma=6:sigmaV=36:steps=2:enable='%s'" % win)
    post.append("eq=brightness=0.18:saturation=1.1:enable='between(t,32.0,%.4f)'" % (32.0 + 1.5 / FPS))
    filters.append('[vc]%s[vout]' % ','.join(post))
    dur = SHOTS['duration']
    filters.append('[%d:a]atrim=0:%.4f,asetpts=PTS-STARTPTS[aout]' % (ns, dur))
    fc = ';'.join(filters)
    master = os.path.join(OUT, 'park_film.mp4')
    share = os.path.join(OUT, 'park_film_share.mp4')
    base = ['ffmpeg', '-y', '-loglevel', 'error', '-stats'] + inputs + ['-i', SCORE, '-filter_complex', fc, '-map', '[vout]', '-map', '[aout]',
                                                                       '-r', str(FPS), '-t', '%.4f' % dur, '-movflags', '+faststart', '-threads', '4']
    for r in report:
        print('  !', r)
    if not only_share:
        print('master ->', master)
        subprocess.run(base + ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
                               '-c:a', 'aac', '-b:a', '320k', master], check=True)
        # share version from the master (one ffmpeg at a time)
        print('share ->', share)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-stats', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
                        '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', share], check=True)
    else:
        subprocess.run(base + ['-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p',
                               '-c:a', 'aac', '-b:a', '192k', share], check=True)
    for p in (master, share):
        if os.path.exists(p):
            n, rate, w, h = probe_frames(p)
            print('%s: %d frames @ %s, %dx%d, %.1f MB' % (os.path.basename(p), n, rate, w, h, os.path.getsize(p) / 1e6))


if __name__ == '__main__':
    main()
