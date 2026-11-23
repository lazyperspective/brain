import json, sys, numpy as np
for n in sys.argv[1:]:
    R = json.load(open(f'/home/user/brain/everywhere-claude/work/motion/{n}.json'))
    print(f'== {n}  {len(R)} frames {R[-1]["t"]:.1f}s   (dx,dy in full-res px per sec; zoom %/s; rot deg/s; sharp; inliers)')
    B = 0.5
    for b in np.arange(0, R[-1]['t'] + 1e-6, B):
        S = [r for r in R if b <= r['t'] < b + B]
        if not S: continue
        dx = sum(r['dx'] for r in S) * 2 / B; dy = sum(r['dy'] for r in S) * 2 / B
        z = (np.prod([r['s'] for r in S]) ** (1 / B) - 1) * 100; rot = sum(r['rot'] for r in S) / B
        sh = np.mean([r['sharp'] for r in S]); inl = min(r['inl'] for r in S[1:] or S)
        print(f'{b:5.1f} dx{dx:+7.0f} dy{dy:+7.0f} zoom{z:+6.1f}% rot{rot:+5.1f} sharp{sh:6.0f} inl{inl:4d} lum{np.mean([r["lum"] for r in S]):4.0f}')
