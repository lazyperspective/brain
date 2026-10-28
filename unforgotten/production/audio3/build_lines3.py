"""Episode 1 dialogue, third pass (audio3): performance-directed takes (plan3.py) selected automatically.
Reuses the audio2 pipeline (ep1/audio2/build_lines.py: character FX, trims/fades, levelling, rooms, mouth envelope)
and adds: per-line beats/breaths (gaps from plan3, inserted at the quietest point between two words when the take's own
pause is shorter), and an acting-fit selection (hard checks first: ASR words, truncation, artefacts, slot/duration;
then a per-mode prosody score + pace target).
Writes ep1/audio3/lines/<id>.wav, lines.json, dialogue.wav (48 kHz stereo 16-bit, exactly 300 s), selection3.json.
Run from the scratch root with the tts venv (needs faster-whisper for the cut line). Optional ep1/audio3/picks3.json
{id: take} manual overrides; ep1/audio3/line_gain3.json {id: dB} trims written by mix3.py --fit."""
import json, os, re, sys, difflib, numpy as np, soundfile as sf
sys.path.insert(0, 'ep1/audio2'); sys.path.insert(0, 'ep1/audio3')
import build_lines as B
from plan3 import PLAN

OUT = 'ep1/audio3'
B.OUT = OUT                          # temp files of the ffmpeg FX step go here, not into audio2
# audio2's lines/dialogue.wav were rendered at -24 LUFS per line (build_lines.py was edited to -31 afterwards, but the
# approved audio2 mix uses the -24 render): keep the approved dialogue/score balance
B.SPEECH_LUFS = -24.0
B.GAIN = json.load(open(f'{OUT}/line_gain3.json')) if os.path.exists(f'{OUT}/line_gain3.json') else {}
SR, D = B.SR, B.D
S, C = B.S, B.C
INFO = json.load(open(f'{OUT}/take_info3.json'))
PICKS = json.load(open(f'{OUT}/picks3.json')) if os.path.exists(f'{OUT}/picks3.json') else {}
OLD = {l['id']: l for l in json.load(open('ep1/audio2/lines.json'))}
OLDSEL = {r['id']: r for r in json.load(open('ep1/audio2/selection.json'))}
os.makedirs(f'{OUT}/lines', exist_ok=True); os.makedirs(f'{OUT}/tmp', exist_ok=True)
# lines whose audio2 read was clearly rushed: allowed to grow past +25 % (still inside the slot)
EXTEND = {'L01', 'L02', 'L05', 'L06', 'L08', 'L09', 'L10', 'L16', 'L22', 'L24', 'L27', 'L29', 'L31', 'L33', 'L34', 'L03', 'L04'}
# ASR spellings of the invented names (base.en has never seen them): treated as the name, nothing else is forgiven
NAMEQ = {'mira': {'mirror', 'meera', 'mera', 'myra', 'mirra', 'miro', 'mirah', 'meara'},
         'sable': {'fable', 'sible', 'sabel', 'sabal', 'sabo', 'sabre', 'saber', 'sabl'},
         'kaira': {'kyra', 'keira', 'kira', 'cara', 'kara', 'kiera', 'kayra', 'keara', 'kyrah', 'kiara', 'ciara', 'kai'},
         'tamo': {'tomo', 'tammo', 'thamo', 'timo', 'tamu', 'tamma', 'tamar', 'tomah'}}
CANON = {v: k for k, vs in NAMEQ.items() for v in vs}
CANON['chaste'] = 'chased'          # homophone
# a performed [chuckle]/[gasp]/[sigh] is often transcribed as an interjection: not a word error on a tagged line
INTERJ = {'ah', 'ahh', 'huh', 'heh', 'hah', 'ha', 'oh', 'hmm', 'uh', 'um', 'mm', 'hm', 'whoa', 'phew', 'haha', 'hehe', 'ooh'}


def tag_info(hyp, words, text, s0):
    """(hyp without interjections, tag performed?) for a line that starts with a [tag]"""
    if not re.match(r'\s*\[[a-z]+\]', text):
        return hyp, None
    toks = B.norm(hyp)
    interj = any(t in INTERJ for t in toks[:2])
    clean = ' '.join(t for i, t in enumerate(toks) if not (i < 2 and t in INTERJ))
    w0 = words[0] if words else None
    present = interj or bool(w0 and (w0[1] >= 0.35 or (w0[2] - w0[1] >= 0.6 and len(B.norm(w0[0])[0] if B.norm(w0[0]) else '') <= 5)))
    return clean, present


def norm(s):
    return [CANON.get(w, w) for w in B.norm(s)]


def match(hyp, text):
    return difflib.SequenceMatcher(None, norm(hyp), norm(text)).ratio()


# ---------------------------------------------------------------- beats: lengthen the pause after a scripted word
def word_times(words, text):
    """map scripted token index -> (start, end) of the recognised word that carries it"""
    toks = []
    for w in words:
        for t in norm(w[0]):
            toks.append((t, w[1], w[2]))
    ref = norm(text)
    sm = difflib.SequenceMatcher(None, [t[0] for t in toks], ref, autojunk=False)
    m = {}
    for a, b, n in sm.get_matching_blocks():
        for i in range(n):
            m[b + i] = (toks[a + i][1], toks[a + i][2])
    return m


def add_gaps(a, sr, words, text, gaps):
    """returns (audio, added_seconds, log). Silence is inserted at the quietest 10 ms frame between word k and k+1,
    only if that point is a real gap (>= 28 dB under the peak), with 8 ms fades either side."""
    if not gaps:
        return a, 0.0, []
    wt = word_times(words, text)
    h = int(0.01 * sr)
    n = len(a) // h
    fr = 10 * np.log10(np.mean(a[:n * h].reshape(n, h) ** 2, axis=1) + 1e-12)
    pk = fr.max()
    ins, log = [], []
    for k, want in sorted(gaps.items()):
        k = int(k)
        if k not in wt or k + 1 not in wt:
            log.append(f'{k}: word not found'); continue
        # whisper word edges drift: search the whole span of the two words (start of k .. end of k+1) for the
        # quietest frame, which is the pause between them
        e, s = wt[k][0] + 0.6 * (wt[k][1] - wt[k][0]), wt[k + 1][0] + 0.4 * (wt[k + 1][1] - wt[k + 1][0])
        i0, i1 = max(0, int(e / 0.01)), min(n - 1, int(s / 0.01))
        if i1 <= i0:
            i1 = min(n - 1, i0 + 4)
        j = i0 + int(np.argmin(fr[i0:i1 + 1]))
        if fr[j] > pk - 28:
            log.append(f'{k}: no clean gap ({fr[j] - pk:.0f} dB)'); continue
        # the existing pause around j (frames under -40 dB re peak)
        lo = j
        while lo > 0 and fr[lo - 1] < pk - 40: lo -= 1
        hi = j
        while hi < n - 1 and fr[hi + 1] < pk - 40: hi += 1
        have = (hi - lo + 1) * 0.01 if fr[j] < pk - 40 else 0.0
        add = want - have
        if add < 0.04:
            log.append(f'{k}: has {have:.2f}s'); continue
        ins.append((j * h + h // 2, add)); log.append(f'{k}: +{add:.2f}s (had {have:.2f}, cut at {fr[j] - pk:.0f} dB)')
    if not ins:
        return a, 0.0, log
    out, prev, tot = [], 0, 0.0
    nf = int(0.008 * sr)
    for pos, add in sorted(ins):
        seg = a[prev:pos].copy()
        seg[-nf:] *= np.linspace(1, 0, nf)
        out += [seg, np.zeros(int(add * sr))]
        nxt = a[pos:pos + nf].copy()
        a = a.copy(); a[pos:pos + nf] = nxt * np.linspace(0, 1, nf)
        prev = pos; tot += add
    out.append(a[prev:])
    return np.concatenate(out), tot, log


# ---------------------------------------------------------------- candidates
def cands_for(l):
    lid = l['id']
    out = []
    for f, d in INFO.items():
        if d.get('id') != lid or 'hyp' not in d or 'rng' not in d:
            continue
        hyp, tag = tag_info(d['hyp'], d.get('words') or [], l['text'], d.get('s0', 0))
        m = match(hyp, l['text'])
        tr = B.truncation(f)
        out.append(dict(f=f, match=round(m, 3), tag=tag, new=f.startswith('ep1/takes3/'), gen=d.get('gen'), **tr,
                        **{k: d.get(k) for k in ('max_sil', 'mumble', 'clicks', 'hf_db', 'minp', 'rng', 'sd', 'mov', 'edyn',
                                                 'f0med', 'wps', 'speech', 'dur', 'hyp', 'words', 'tail_after_word')}))
    return out


def hard_ok(c, l):
    nw = len(norm(l['text']))
    why = []
    if c['match'] < (1.0 if nw <= 4 else 0.95): why.append('asr')
    if c['trunc']: why.append('trunc')
    if (c['max_sil'] or 0) > 1.0: why.append('longsil')
    if (c['mumble'] or 0) > 0.2: why.append('mumble')
    if (c['clicks'] or 0) > 40: why.append('clicks')
    return why


def z(vals):
    v = np.array(vals, float)
    s = v.std()
    return (v - v.mean()) / s if s > 1e-6 else np.zeros_like(v)


def score(cs, l):
    """acting fit among the takes that passed the hard checks (z-scores within the line's candidates).
    pyin range/sd are capped (octave errors inflate them); f0 height stands in for arousal."""
    p = PLAN.get(l['id'], {})
    mode, tw = p.get('mode', 'warm'), p.get('wps')
    zr = z([min(c['rng'] or 0, 16) for c in cs]); zs = z([min(c['sd'] or 0, 5) for c in cs])
    zm, ze, zf = (z([c[k] or 0 for c in cs]) for k in ('mov', 'edyn', 'f0med'))
    nw = len(norm(l['text']))
    for i, c in enumerate(cs):
        if mode == 'lively':
            pr = zr[i] + 0.5 * zs[i] + 0.4 * zm[i] + 0.4 * ze[i] + 0.5 * zf[i]
        elif mode == 'shout':
            pr = 1.0 * zf[i] + 0.4 * zr[i] + 0.3 * ze[i]
        elif mode == 'calm':
            pr = -0.4 * zf[i] - 0.3 * zm[i] - 0.3 * abs(zs[i]) + 0.2 * ze[i]
        else:
            pr = 0.5 * zr[i] + 0.3 * zs[i] + 0.2 * ze[i]
        wps = nw / max(0.3, (c['speech'] or 1) + c.get('added', 0.0))
        pace = -2.0 * abs(np.log(wps / tw)) if tw else 0.0
        tag = 0.0 if c.get('tag') is None else (1.0 if c['tag'] else -1.0)
        c['wps_final'] = round(wps, 2)
        c['score'] = round(float(pr + pace + tag + (0.5 if c['match'] >= 0.999 else 0) + (0.3 if c['new'] else 0)
                                 + 0.5 * min(0, (c['minp'] or 0) - 0.5)), 3)
    return cs


# ---------------------------------------------------------------- build
def asr_file(st):
    """ASR of the final stereo line exactly as verify3.py hears it: 16-bit wav -> ffmpeg 16 kHz mono -> whisper"""
    import subprocess, tempfile
    B.asr_text(np.zeros(4800))      # make sure the model is loaded
    with tempfile.NamedTemporaryFile(suffix='.wav', dir=f'{OUT}/tmp') as tf:
        sf.write(tf.name, st.T, SR, subtype='PCM_16')
        a16 = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', tf.name, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                             capture_output=True, check=True).stdout
    segs, _ = B._ASR[0].transcribe(np.frombuffer(a16, np.int16).astype(np.float32) / 32768, beam_size=5)
    return ' '.join(x.text for x in segs).strip()


def render(c, l, tempo=1.0):
    """raw take -> beats -> audio2 dry processing (FX, trims, fades)"""
    a, sr = sf.read(c['f'], dtype='float64')
    if a.ndim > 1: a = a.mean(1)
    gaps = PLAN.get(l['id'], {}).get('gaps', {}) if not l.get('cut') else {}
    a2, added, log = add_gaps(a, sr, c['words'], l['text'], gaps)
    f = c['f']
    tmp = f"{OUT}/tmp/{os.path.basename(f)}"
    sf.write(tmp, a2, sr, subtype='FLOAT')
    if l.get('cut'):
        B.INFO[tmp] = B.INFO[f]
    y, mk = B.process_dry(tmp, l, tempo)
    # audio2 kept 30 ms of pre-roll before the voice reaches -45 dB re peak; keep 4 ms so the onset sits on the cue
    fr = B.frames_db(y, SR)
    on = np.where(fr > fr.max() - 45)[0][0] * int(0.005 * SR)
    cut = max(0, on - int(0.004 * SR))
    if cut:
        y = y[cut:].copy()
        nf = int(0.003 * SR); y[:nf] *= np.linspace(0, 1, nf)
        mk = dict(mk, speech_end=mk['speech_end'] - cut / SR)
    return y, mk, added, log


def main():
    order = sorted(S['lines'], key=lambda l: C[l['id']])
    rep, out_lines = [], []
    track = np.zeros((2, int(D * SR)))
    only_report = '--report' in sys.argv
    for k, l in enumerate(order):
        lid = l['id']
        nxt = C[order[k + 1]['id']] if k + 1 < len(order) else 298.7
        room = B.location(l)
        slot = min(nxt - 0.2, B.LOC_END[room] + 0.3 if room != 'harbour' else 298.5) - C[lid]
        od_final = OLD[lid]['dur']
        # duration rule against the audio2 line's dry length (its final dur includes the room tail, which in the
        # temple is 1.8 s long and was cut by the slot)
        od = OLDSEL[lid]['dry']
        hi = min(slot, od * (1.8 if lid in EXTEND else 1.25))
        lo = od * (0.85 if lid in EXTEND else 0.75)
        # a tight slot may be met with a gentle rubberband tempo: up to 12 % on shouts, 8 % on other lively lines, 6 % calm
        MAXT = {'calm': 1.06, 'shout': 1.12}.get(PLAN.get(lid, {}).get('mode'), 1.08)
        base = PLAN.get(lid, {}).get('tempo', 1.0)     # a deliberate slow-down where the plan asks for one
        if l.get('cut'):   # the interrupted "Run from wh-": keep the audio2 rendering choice
            cs = [dict(f=OLDSEL[lid]['take'], match=1.0, new=False, words=B.INFO[OLDSEL[lid]['take']]['words'], score=0)]
            passing = cs
        else:
            cs = cands_for(l)
            passing = []
            for c in cs:
                c['why'] = hard_ok(c, l)
                if c['why']: continue
                y, mk, added, log = render(c, l, base)
                c.update(added=added, gaplog=log, dry=round(len(y) / SR, 3))
                est = len(y) / SR
                if est > slot - 0.05 and est / MAXT > slot - 0.05: c['why'] = ['slot']; continue
                if not lo <= len(y) / SR <= hi + 0.3: c['why'] = [f'dur {len(y) / SR:.2f} not in {lo:.2f}-{hi:.2f}']; continue
                passing.append(c)
            if not passing:
                raise SystemExit(f'{lid}: no take passes ({len(cs)} candidates)')
            score(passing, l)
            passing.sort(key=lambda c: -c['score'])
            if lid in PICKS:
                pk = [c for c in passing if c['f'] == PICKS[lid]] or [c for c in cs if c['f'] == PICKS[lid]]
                passing = pk + [c for c in passing if c not in pk]
        # the final render (character FX + room) must still be understood: walk down the ranking (top 6) and take the
        # first whose final line transcribes cleanly; otherwise the one that transcribes best
        tried = []
        for c in passing[:6]:
            tempo = base if not l.get('cut') else 1.0
            y, mk, added, log = render(c, l, tempo)
            if len(y) / SR > slot - 0.05:
                tempo = round(tempo * len(y) / SR / (slot - 0.05) * 1.01, 4)
                y, mk, added, log = render(c, l, tempo)
            if l.get('cut'):
                tried.append((1.0, c, y, mk, added, log, tempo)); break
            st, _ = B.finish(y, l, room, slot)
            # two decodes (float resample, and the 16-bit file through ffmpeg as verify3.py does): whisper is flaky on
            # FX'd voices, so a take must read cleanly both ways
            hs = [B.asr_text(st.mean(0)), asr_file(st)]
            fms = [match(tag_info(x.replace("' ", ' '), [], l['text'], 0)[0], l['text']) for x in hs]
            h, fm = ' / '.join(hs), min(fms)
            c['final_hyp'], c['final_match'] = h, round(fm, 3)
            tried.append((fm, c, y, mk, added, log, tempo))
            if fm >= 0.95: break
        fm, c, y, mk, added, log, tempo = tried[-1] if tried[-1][0] >= 0.95 else max(tried, key=lambda t: t[0])
        top = [(x['f'].replace('ep1/', ''), x.get('score'), x.get('wps_final'), x.get('rng'), x.get('f0med')) for x in passing[:4]]
        print(f"{lid} {l['who']:10s} pick {c['f'][4:]:22s} score {c.get('score', 0):6.2f} gaps {log} tempo {tempo} "
              f"dry {len(y) / SR:.2f} (old dry {od:.2f}, slot {slot:.2f}) pass {len(passing)}/{len(cs)} final-asr {c.get('final_match')}"
              f"{' (tried ' + str(len(tried)) + ')' if len(tried) > 1 else ''}", flush=True)
        if only_report:
            for x in top[1:]: print('      alt', x)
            rep.append(dict(id=lid, pick=c['f'], top=top)); continue
        st, trimmed = B.finish(y, l, room, slot)
        sf.write(f'{OUT}/lines/{lid}.wav', st.T, SR, subtype='PCM_16')
        st = sf.read(f'{OUT}/lines/{lid}.wav', dtype='float64')[0].T
        i = int(round(C[lid] * SR))
        track[:, i:i + st.shape[1]] += st
        dur = round(st.shape[1] / SR, 3)
        out_lines.append({'id': lid, 'who': l['who'], 'text': l['text'] if not l.get('cut') else 'Run from wh-', 'dur': dur,
                          'env': B.mouth_env(st.mean(0))})
        rep.append(dict(id=lid, who=l['who'], room=room, take=c['f'], gen=c.get('gen'), match=c['match'], score=c.get('score'),
                        rng=c.get('rng'), sd=c.get('sd'), mov=c.get('mov'), f0med=c.get('f0med'), wps_final=c.get('wps_final'),
                        gaps=log, added=added, tempo=tempo, dur=dur, old_dur=od_final, old_dry=od, old_take=OLDSEL[lid]['take'], slot=round(slot, 3),
                        reverb_trimmed_by_slot=trimmed, final_match=c.get('final_match'), final_hyp=c.get('final_hyp'),
                        tried=[(t[1]['f'], t[1].get('final_match'), t[1].get('final_hyp')) for t in tried], n_cands=len(cs), n_pass=len(passing), top=top,
                        rejected={x['f']: x.get('why') for x in cs if x.get('why')}))
    if only_report:
        json.dump(rep, open(f'{OUT}/report3.json', 'w'), indent=1); return
    ids = [l['id'] for l in S['lines']]
    out_lines.sort(key=lambda o: ids.index(o['id']))
    json.dump(out_lines, open(f'{OUT}/lines.json', 'w'))
    json.dump(rep, open(f'{OUT}/selection3.json', 'w'), indent=1)
    sf.write(f'{OUT}/dialogue.wav', track.T, SR, subtype='PCM_16')
    print('dialogue.wav', track.shape[1] / SR, 's, peak', round(20 * np.log10(np.abs(track).max()), 2), 'dBFS')


if __name__ == '__main__':
    main()
