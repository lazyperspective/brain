import json
L = json.load(open('lines.json')); C = json.load(open('cue.json'))
out = [dict(id=l['id'], who=l['who'], text=l['text'], t0=C[l['id']], dur=l['dur'], env=l['env']) for l in L]
open('src/p7_dlg.js', 'w').write('  /* ================================================================ dialogue: timings and mouth envelopes (generated) */\n  const DLG = ' + json.dumps(out) + ';\n\n')
print('dlg', len(out))
