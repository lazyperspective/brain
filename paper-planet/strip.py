"""python strip.py video t0 t1 out.jpg [cols] [crop=x:y:w:h] -> tiled frames from t0..t1 seconds at the video's fps"""
import sys, subprocess
v, t0, t1, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 5
crop = sys.argv[6] if len(sys.argv) > 6 else None
fps = float(subprocess.check_output(['ffprobe', '-v', '0', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', v]).decode().strip().split('/')[0])
n = int(round((t1 - t0) * fps))
rows = (n + cols - 1) // cols
rate = sys.argv[7] if len(sys.argv) > 7 else None
if rate:
    n = int(round((t1 - t0) * float(rate)))
    rows = (n + cols - 1) // cols
vf = (('fps=%s,' % rate) if rate else '') + (('crop=%s,' % crop) if crop else '') + 'scale=%d:-1,tile=%dx%d' % (1900 // cols, cols, rows)
subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(t0), '-i', v, '-frames:v', '1', '-vf', vf, '-q:v', '3', out])
