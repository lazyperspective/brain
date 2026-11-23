# Assemble the film. animatic: concatenates the 540x960 shot previews + the score.  final: full-quality character renders,
# full-res composites piped into ONE x264 encoder, then the mastered audio is muxed in.
import sys, os, subprocess, importlib, json, numpy as np, cv2
V2 = '/home/user/brain/everywhere-claude/v2'
sys.path[:0] = [V2, f'{V2}/tools', f'{V2}/shots']
import edit, shotlib

OUT = '/home/user/brain/everywhere-claude/out'


def master_audio(dst):
    raw = f'{V2}/audio/mix_raw.wav'; lim = f'{V2}/audio/mix_lim.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', 'alimiter=limit=0.6:attack=3:release=60:level=disabled', lim], check=True)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', lim, '-af', 'loudnorm=I=-14:TP=-2.5:LRA=20:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    m = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
    af = (f"afade=t=in:d=0.03,loudnorm=I=-14:TP=-2.5:LRA=20:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,alimiter=limit=0.70:attack=1:release=40:level=disabled")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', lim, '-af', af, '-ar', '48000', dst], check=True)
    return dst


def animatic():
    frames = []
    for mod, name, n in edit.SHOTS:
        for i in range(n):
            p = f'{V2}/preview/{name}/{i:04d}.jpg'
            frames.append(p if os.path.exists(p) else None)
    lst = f'{V2}/preview/animatic_frames'; os.makedirs(lst, exist_ok=True)
    black = np.zeros((960, 540, 3), np.uint8)
    for k, p in enumerate(frames + [None] * edit.BLACK_TAIL):
        im = cv2.imread(p) if p else black
        if im is None: im = black
        if im.shape[:2] != (960, 540): im = cv2.resize(im, (540, 960))
        cv2.imwrite(f'{lst}/{k:05d}.jpg', im, [cv2.IMWRITE_JPEG_QUALITY, 88])
    aud = master_audio(f'{V2}/audio/master.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', f'{lst}/%05d.jpg', '-i', aud, '-c:v', 'libx264', '-crf', '22', '-preset', 'veryfast',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', f'{V2}/animatic.mp4'], check=True)
    print('animatic', len(frames) + edit.BLACK_TAIL, 'frames')


def get_shot(mod, name):
    m = importlib.import_module(mod)
    if mod == 's_flurry':
        g = m.get(name); recs, ref = m.build(g); jobs, frames = m.jobs_and_frames(g, recs, 1.0)
        return jobs, frames, g['clip'], g['t0'], g['n']
    recs = m.build(); jobs, frames = m.jobs_and_frames(recs, 1.0)
    return jobs, frames, m.CLIP if hasattr(m, 'CLIP') else 'IMG_1661', m.T0, m.NSRC


def final(render=True, only=None):
    os.makedirs(OUT, exist_ok=True)
    vid = f'{V2}/video_full.mp4'
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1080x1920', '-r', '30', '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-threads', '2',
                            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', vid], stdin=subprocess.PIPE)
    stills = {}
    def sink(f): enc.stdin.write(f.tobytes())
    for mod, name, n in edit.SHOTS:
        jobs, frames, clip, t0, nsrc = get_shot(mod, name)
        jobs, frames = jobs[:n], frames[:n]
        if render:
            for j in jobs: j['out'] = j['out'].replace('/render/', '/render_final/'); os.makedirs(os.path.dirname(j['out']), exist_ok=True)
            for F in frames:
                F['layers'] = [((o.replace('/render/', '/render_final/') if isinstance(o, str) else o), g, m) for o, g, m in F['layers']]
            shotlib.render_jobs(name + '_final', jobs)
        print('comp', name, len(frames), flush=True)
        shotlib.comp_shot(name, clip, t0, nsrc, frames, size='final', sink=sink)
        if render:
            import shutil; shutil.rmtree(f'{V2}/render_final', ignore_errors=True); shutil.rmtree(f'{V2}/render/{name}_final', ignore_errors=True)
    black = np.zeros((1920, 1080, 3), np.uint8)
    for _ in range(edit.BLACK_TAIL): sink(black)
    enc.stdin.close(); enc.wait()
    aud = master_audio(f'{V2}/audio/master.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vid, '-i', aud, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', f'{OUT}/everywhere_claude.mp4'], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/everywhere_claude.mp4', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
                    f'{OUT}/everywhere_claude_share.mp4'], check=True)


if __name__ == '__main__':
    if sys.argv[1] == 'animatic': animatic()
    elif sys.argv[1] == 'final': final()
