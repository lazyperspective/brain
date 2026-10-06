#!/usr/bin/env python3
"""Cut the segments into one continuous shot.

Every segment ends with the camera rushing into something that fills the
frame (an eye, a sun, a muzzle) and the next begins inside the same thing,
so each join is a short matched transition rather than a cut. Segments are
speed-ramped to keep the whole run fast.

    python3 assemble_oneshot.py [tag]  ->  out/emberfall_oneshot_<tag>.mp4
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TAG = sys.argv[1] if len(sys.argv) > 1 else "final"
R = os.path.join(ROOT, "render", TAG)
FPS = 24
W, H = 1280, 720

# (segment folder, speed, first frame, last frame, transition into the NEXT segment, transition frames)
EDL = [
    ("seq_reveal", 1.0, 1, 64, "zoomin", 5),     # into the eye ...
    ("shot02b", 1.35, 1, 32, "fadewhite", 5),    # ... out of the tunnel's sun ...
    ("shot02c", 1.6, 1, 48, "smoothup", 6),      # ... whip-tilt up off the mirror sea ...
    ("shot02d", 1.4, 1, 40, "fadewhite", 5),     # ... into the white sky, back to the fall
    ("seq_fire", 1.0, 1, 30, "zoomin", 4),       # onto the gauntlet ...
    ("shot04", 1.3, 1, 24, "fadewhite", 3),      # ... the drum fires ...
    ("shot05", 1.0, 1, 16, "zoomin", 3),         # ... ride the round ...
    ("shot03", 1.0, 1, 26, "fade", 5),           # ... into the tower ...
    ("shot07", 1.25, 1, 36, "fadeblack", 6),     # ... the aftermath ...
    ("shot08", 1.0, 7, 32, None, 0),             # ... title (skip the black lead-in)
]


def main():
    inputs, filters = [], []
    durations = []
    for i, (seg, speed, a, b, _, _) in enumerate(EDL):
        d = os.path.join(R, seg)
        if not os.path.exists(os.path.join(d, f"{a:04d}.png")):
            sys.exit(f"missing {d}")
        inputs += ["-framerate", str(FPS), "-start_number", str(a), "-i", os.path.join(d, "%04d.png")]
        avail = len([f for f in os.listdir(d) if f.endswith(".png")])
        b = min(b, a + avail - 1)
        n = b - a + 1
        dur = n / FPS / speed
        durations.append(dur)
        filters.append(
            f"[{i}:v]trim=end_frame={n},setpts=(PTS-STARTPTS)/{speed},fps={FPS},"
            f"scale={W}:-2:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,settb=AVTB[s{i}]")
    # chain xfades
    prev, t = "s0", durations[0]
    for i in range(1, len(EDL)):
        trans, tf = EDL[i - 1][4], EDL[i - 1][5]
        td = tf / FPS
        off = t - td
        out = f"x{i}"
        filters.append(f"[{prev}][s{i}]xfade=transition={trans}:duration={td:.4f}:offset={off:.4f}[{out}]")
        prev, t = out, t + durations[i] - td
    filters.append(f"[{prev}]fade=t=in:st=0:d=0.15,noise=alls=6:allf=t,format=yuv420p[out]")
    os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
    dst = os.path.join(ROOT, "out", f"emberfall_oneshot_{TAG}.mp4")
    cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filters), "-map", "[out]",
           "-c:v", "libx264", "-preset", "slow", "-b:v", "9M", "-maxrate", "12M", "-bufsize", "18M",
           "-movflags", "+faststart", dst]
    subprocess.run(cmd, check=True)
    print(f"wrote {dst} ({t:.2f}s)")


if __name__ == "__main__":
    main()
