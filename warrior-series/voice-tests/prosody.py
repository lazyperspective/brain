"""How much does the delivery move? Pitch range and movement (semitones) and loudness variation, per scene version."""
import sys, numpy as np, librosa
for f in sys.argv[1:]:
    y, sr = librosa.load(f, sr=16000)
    f0, vf, _ = librosa.pyin(y, fmin=60, fmax=600, sr=sr, frame_length=1024)
    st = 12 * np.log2(f0[vf] / np.nanmedian(f0[vf]))
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]; db = 20 * np.log10(rms[rms > 0.01] + 1e-9)
    print(f"{f.split('/')[-1]:28s} pitch range (5-95%) {np.percentile(st, 95) - np.percentile(st, 5):5.1f} st   pitch movement {np.mean(np.abs(np.diff(st))) * 100:5.1f}   loudness spread {np.std(db):4.1f} dB")
