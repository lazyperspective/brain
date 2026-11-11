// node tools/cues.js out.json : exports the timeline (cues, captions, beats, key events) for the score builder
const TL = require('../js/timeline.js');
require('fs').writeFileSync(process.argv[2] || 'audio/cues.json', JSON.stringify({ fps: TL.FPS, dur: TL.DUR, cues: TL.CUES, caps: TL.CAPS, beats: TL.BEATS, E: TL.E }, null, 1));
console.log(TL.CUES.length, 'cues');
