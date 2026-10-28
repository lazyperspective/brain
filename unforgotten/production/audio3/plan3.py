"""Acting plan for the audio3 dialogue pass.
Per line: an acting note, the delivery targets used by the automatic selection, and the take variants to generate.
  note   : emotion / energy / emphasis / pace
  mode   : what the selector rewards among takes that pass the hard checks
           'lively' -> more pitch range + movement (excited, comic, indignant)
           'shout'  -> high pitch level vs the speaker's norm + range (scream, shouted commands)
           'calm'   -> steady, low pitch movement, slow (VO, King, Vesper, grave lines)
           'warm'   -> moderate range, unhurried
  wps    : target speech rate (words per second over the voiced span) the selector prefers
  gaps   : {word_index: seconds} minimum pause after that word (0-based, scripted words), added in post when the take's
           own pause is shorter (a breath/beat), cut at the quietest point of the gap
  vars   : [ (engine, text_fed, params, n_takes) ]  engine 'cb' = full Chatterbox (exaggeration/cfg), 'turbo' (tags)
The spoken words of every text_fed equal script.json's text; only punctuation / case / tags differ."""

CB = 'cb'
TU = 'turbo'


def cb(text, ex, cfg, n, temp=0.8):
    return (CB, text, dict(exaggeration=ex, cfg_weight=cfg, temperature=temp), n)


def tu(text, n, temp=0.8):
    return (TU, text, dict(temperature=temp), n)


PLAN = {
    # ------------------------------------------------------------------ cold open
    'L01': dict(note='VO, quiet and intimate, a storyteller leaning in; weight on "name"; slow, falling end',
                mode='calm', wps=2.3, gaps={},
                vars=[cb('Everything has a name.', 0.35, 0.3, 3), cb('Everything... has a name.', 0.45, 0.25, 3),
                      tu('Everything has a name.', 2, 0.7)]),
    'L02': dict(note='VO, tender; lift on "promise", a held breath at the ellipsis, soft landing on "here"',
                mode='calm', wps=2.4, gaps={4: 0.55},
                vars=[cb('A name is a promise. That something was here.', 0.4, 0.3, 3),
                      cb('A name is a promise, that something was here.', 0.45, 0.25, 3),
                      tu('A name is a promise... that something was here.', 2, 0.7)]),
    'L03': dict(note='Mira, 8: bursting with pride, bright and breathless; peaks on "I wrote it!" and "my name"; quick',
                mode='lively', wps=3.9, gaps={0: 0.2},
                vars=[cb('Sable! I wrote it! I wrote my name on the wall, just like you showed me!', 0.8, 0.45, 3),
                      cb('Sable! I wrote it! I wrote my name on the wall, just like you showed me!', 1.05, 0.4, 3),
                      tu('Sable! I wrote it! I wrote my name on the wall, just like you showed me!', 2, 0.9)]),
    'L04': dict(note='Sable, 19: an amused chuckle, warm and affectionate; teasing lilt on "old and forgetful"; unhurried',
                mode='warm', wps=2.7, gaps={5: 0.35},
                vars=[tu('[chuckle] Then the wall will remember you. Even when I\'m old and forgetful.', 3, 0.75),
                      tu('[chuckle] Then the wall will remember you... Even when I\'m old, and forgetful.', 3, 0.9)]),
    'L05': dict(note='Hollow King: cold, close, nearly a whisper; slow; two separate weights "Hush... now."',
                mode='calm', wps=1.6, gaps={0: 0.25},
                vars=[cb('Hush. Now.', 0.3, 0.25, 3), cb('Hush now.', 0.35, 0.2, 3), tu('Hush... now.', 2, 0.7)]),
    'L06': dict(note='Mira: small, frightened, uncertain; trembling rise', mode='lively', wps=1.4, gaps={},
                vars=[cb('Sable?', 0.7, 0.3, 4), cb('Sable...?', 0.95, 0.3, 3), tu('Sable...?', 2, 0.9),
                      cb('Sable?', 0.5, 0.3, 4), tu('Sable?', 4, 0.8)]),   # round 2: ASR kept hearing Table/Fable
    'L07': dict(note='Sable: desperate, urgent; "take my hand!" a command; "Don\'t let go." pleading; last "Don\'t let go!" louder, breaking',
                mode='shout', wps=2.6, gaps={3: 0.2, 6: 0.2},
                vars=[cb('Mira, take my hand! Don\'t let go. Don\'t let go!', 1.0, 0.3, 3),
                      cb('Mira! Take my hand! Don\'t let go! Don\'t let go!', 1.25, 0.35, 3),
                      cb('Mira, take my hand! Don\'t let go. Don\'t let go!', 1.4, 0.4, 2)]),
    'L08': dict(note='Sable: a raw scream; "No!" sharp, "Mira!" long, cracked, sustained', mode='shout', wps=1.1, gaps={0: 0.2},
                vars=[cb('No! Mira!', 1.3, 0.3, 3), cb('No! Mira!', 1.6, 0.35, 3), cb('Noo! Mira!', 1.5, 0.3, 2),
                      cb('No!! Mira!!', 1.8, 0.5, 2), cb('No! Mira!', 1.8, 0.5, 3)]),
    'L09': dict(note='VO, grief: quiet, slow, a catch after "remember"; "anymore" falls away almost to nothing',
                mode='calm', wps=2.4, gaps={2: 0.3},
                vars=[cb('I don\'t remember her face anymore.', 0.35, 0.3, 3), cb('I don\'t remember... her face, anymore.', 0.45, 0.25, 3),
                      tu('I don\'t remember... her face anymore.', 2, 0.7)]),
    'L10': dict(note='VO, quiet resolve; beat after "remember"; weight on "swore"', mode='calm', wps=2.2, gaps={1: 0.35},
                vars=[cb('I remember that I swore.', 0.4, 0.3, 3), cb('I remember, that I swore.', 0.5, 0.25, 3),
                      tu('I remember... that I swore.', 2, 0.7)]),
    # ------------------------------------------------------------------ act one
    'L11': dict(note='Warden: alarmed, breathless discovery; "it\'s GONE!"', mode='shout', wps=3.2, gaps={},
                vars=[cb('The Storm Seed, it\'s gone!', 0.9, 0.5, 3), tu('The Storm Seed... it\'s gone!', 2, 0.9)]),
    'L12': dict(note='Oren: stern, clipped deduction, then a barked order "Find her!"', mode='lively', wps=2.8, gaps={1: 0.3},
                vars=[cb('The courier. Kaira was the last one in the vault. Find her!', 0.7, 0.5, 3),
                      cb('The courier. Kaira was the last one in the vault. Find her!', 0.9, 0.45, 2)]),
    'L13': dict(note='Kaira: out of breath on the run, sardonic self-talk; dry, wry "Great start to the week."',
                mode='lively', wps=2.6, gaps={},
                vars=[tu('[gasp] Okay. Okay. Framed, chased, and glowing. Great start to the week.', 3, 0.85),
                      tu('[gasp] Okay... okay. Framed, chased, and glowing. Great start to the week.', 3, 0.95)]),
    'L14': dict(note='Oren: shouting across the rooftops, a command', mode='shout', wps=2.0, gaps={},
                vars=[cb('Courier! Return the Seed!', 1.0, 0.5, 3), cb('Courier! Return the Seed!', 1.2, 0.4, 2)]),
    'L15': dict(note='Kaira: panicked, indignant shout; stress on HAVE', mode='shout', wps=4.0, gaps={},
                vars=[cb('I don\'t have it!', 1.0, 0.5, 3), cb('I don\'t HAVE it!', 1.2, 0.45, 2), tu('I don\'t HAVE it!', 3, 0.9)]),
    'L16': dict(note='Kaira: a sigh, sheepish and quieter; drawn-out "Okay." beat, then the admission', mode='warm', wps=2.0,
                gaps={0: 0.4},
                vars=[tu('[sigh] Okay. I might have it.', 3, 0.8), tu('[sigh] Okay... I might have it.', 3, 0.9)]),
    'L17': dict(note='Oren: grave, measured warning; "Come quietly." flat and final', mode='calm', wps=2.7, gaps={2: 0.25, 14: 0.35},
                vars=[cb('Five days, courier. That\'s how long the elders give you before it tears you apart. Come quietly.', 0.5, 0.35, 3),
                      cb('Five days, courier. That\'s how long the elders give you before it tears you apart. Come quietly.', 0.65, 0.3, 2)]),
    'L18': dict(note='Kaira: cocky, quick, a smirk in the voice', mode='lively', wps=3.3, gaps={},
                vars=[cb('Quiet\'s not really my thing.', 0.7, 0.45, 3), tu('Quiet\'s not really my thing.', 3, 0.9)]),
    'L19': dict(note='Tamo: indignant, wounded; stress on GOOD', mode='lively', wps=3.6, gaps={},
                vars=[cb('Hey! That was the good crate!', 1.0, 0.5, 3), tu('Hey! That was the GOOD crate!', 3, 0.9)]),
    'L20': dict(note='Kaira: breathless, tossed over her shoulder, quick', mode='lively', wps=3.4, gaps={},
                vars=[cb('Sorry! Not sorry! You should run.', 0.85, 0.5, 3), tu('Sorry! Not sorry! You should run.', 3, 0.9)]),
    'L22': dict(note='Tamo: incredulous, a slow realisation; beat before "against one girl?"', mode='lively', wps=2.2,
                gaps={2: 0.35},
                vars=[cb('Three grown-ups, against one girl?', 0.6, 0.3, 3), tu('Three grown-ups... against one girl?', 3, 0.85)]),
    'L23': dict(note='Dockhand: gruff, dismissive, patronising', mode='warm', wps=3.0, gaps={0: 0.2},
                vars=[cb('Kid, that anchor hasn\'t moved in a hundred years.', 0.55, 0.4, 3), tu('Kid, that anchor hasn\'t moved in a hundred years.', 2, 0.8)]),
    'L24': dict(note='Tamo: deadpan-cocky; a beat, then the punchline "for you." dry and confident', mode='warm', wps=2.4,
                gaps={3: 0.5},
                vars=[cb('That\'s not very fair. For you.', 0.5, 0.3, 3), cb('That\'s not very fair, for you.', 0.6, 0.3, 2),
                      tu('That\'s not very fair... for you.', 3, 0.8)]),
    'L25': dict(note='Kaira: astonished, impressed despite herself; stress on ARE', mode='lively', wps=3.3, gaps={},
                vars=[cb('Okay. Who are you?', 0.8, 0.5, 3), tu('Okay. Who ARE you?', 3, 0.9)]),
    'L26': dict(note='Tamo: cheerful, proud; "Well." a wry beat; good-natured complaint "until you landed on me"', mode='lively',
                wps=3.0, gaps={0: 0.15, 3: 0.2, 4: 0.3},
                vars=[cb('Tamo! I work here. Well. I did, until you landed on me.', 0.7, 0.4, 3),
                      tu('Tamo! I work here. Well... I did, until you landed on me.', 3, 0.9)]),
    'L27': dict(note='Kaira: hushed alarm, uneasy', mode='calm', wps=2.6, gaps={},
                vars=[cb('What is that?', 0.5, 0.3, 3), tu('What... is that?', 2, 0.8)]),
    'L28': dict(note='Tamo: grave, quiet, ominous; "Nobody even remembers his name." slow and haunted', mode='calm', wps=2.7,
                gaps={0: 0.35, 7: 0.3},
                vars=[cb('Hollow. They took the lighthouse keeper last week. Nobody even remembers his name.', 0.5, 0.3, 3),
                      tu('Hollow. They took the lighthouse keeper last week. Nobody even remembers his name.', 2, 0.75)]),
    'L29': dict(note='Oren: dread, low, disbelieving', mode='calm', wps=2.0, gaps={0: 0.3},
                vars=[cb('No, not here. Not the harbor.', 0.6, 0.3, 3), tu('No... not here. Not the harbor.', 2, 0.8)]),
    'L30': dict(note='Bellwether: huge, slow, amused, savouring each phrase', mode='calm', wps=2.6, gaps={1: 0.3, 5: 0.3},
                vars=[cb('The courier. And the anchor-bearer. Two of four.', 0.55, 0.35, 3),
                      cb('The courier. And the anchor-bearer. Two of four.', 0.7, 0.4, 2),
                      tu('The courier. And the anchor-bearer. Two of four.', 2, 0.75),
                      # round 2: clearer articulation (the Bellwether FX, pitch 0.8 + echoes, eats consonants)
                      cb('The courier. And the anchor bearer. Two of four.', 0.5, 0.5, 4),
                      tu('The courier. And the anchor bearer. Two, of four.', 3, 0.6)]),
    'L31': dict(note='Bellwether: a low chuckle, pleased, menacing', mode='warm', wps=2.4, gaps={},
                vars=[tu('[chuckle] The King will be so pleased.', 4, 0.8)]),
    'L32': dict(note='Tamo: urgent, panicked shout', mode='shout', wps=3.0, gaps={0: 0.15},
                vars=[cb('Kaira! Whatever you\'ve got, now would be a really good time!', 1.0, 0.5, 3),
                      cb('Kaira! Whatever you\'ve got, now would be a really good time!', 1.2, 0.45, 2)]),
    'L33': dict(note='Kaira: desperate, frustrated shout', mode='shout', wps=3.6, gaps={},
                vars=[cb('I don\'t know how to use it!', 1.0, 0.35, 3), cb('I don\'t know how to use it!', 1.25, 0.4, 3)]),
    'L34': dict(note='Vesper: calm, cold, commanding; every word deliberate', mode='calm', wps=2.6, gaps={1: 0.22}, tempo=0.9,
                vars=[cb('Step away from them.', 0.4, 0.3, 3), cb('Step away from them.', 0.5, 0.25, 2), tu('Step away from them.', 2, 0.7)]),
}
