// node tools/bundle.js [fragment-out]
// Packs the drawing code into one self-contained page: ../still-warm-output/still-warm.html
// (optionally also writes the same page without its <html> wrapper, for hosts that add their own).
const fs = require('fs'), path = require('path');
const js = ['engine', 'world', 'mound', 'sky', 'earth', 'last', 'main', 'view'].map(f => fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8')).join('\n');
if (/<\/script/i.test(js)) throw new Error('script end tag inside the code');
const head = `<title>Still Warm</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Karla:wght@400;500&display=swap">
<style>
  /* layout: one sheet hung on a dark wall, and a small label under it, the way a museum would */
  :root {
    --wall: #211c20; --label: #d2c4b0; --dim: #96877c; --rule: #4d4146; --gold: #d9a93a; --paper: #cdbba3;
    --display: 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
    --body: 'Karla', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    color-scheme: dark;
  }
  body { margin: 0; background: var(--wall); color: var(--label); font: 15px/1.55 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 44px; }
  main { max-width: 1560px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  #frame { width: 100%; max-width: 100%; aspect-ratio: 16 / 9; background: var(--paper); overflow: hidden; box-shadow: 0 18px 50px rgba(0, 0, 0, .45); }
  #frame.near { overflow: auto; }
  #sheet { display: block; width: 100%; height: auto; cursor: zoom-in; }
  #frame.near #sheet { cursor: zoom-out; }
  .label { display: flex; flex-wrap: wrap; gap: 14px 40px; align-items: flex-start; justify-content: space-between; }
  .label > div { min-width: 0; }
  h1 { margin: 0 0 4px; font: italic 500 2rem/1.1 var(--display); letter-spacing: .01em; text-wrap: balance; color: var(--label); }
  .medium { margin: 0; max-width: 62ch; color: var(--dim); }
  .medium b { font-weight: 500; color: var(--gold); }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: var(--dim); font-size: 13px; }
  .tools button { font: inherit; color: var(--label); background: none; border: 1px solid var(--rule); border-radius: 2px; padding: 3px 10px; cursor: pointer; }
  .tools button:hover { border-color: var(--dim); }
  .tools button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .tools button[aria-pressed="true"] { background: var(--label); color: var(--wall); border-color: var(--label); }
  #note { min-height: 1.5em; font-style: italic; color: var(--dim); font-size: 13px; }
</style>`;
const body = `<main>
  <div id="frame"><canvas id="sheet" aria-label="Still Warm: a large mound, almost entirely rubbed out, under a night sky made of its own outline; a small bright hill at daybreak; two gold threads under the ground"></canvas></div>
  <div class="label">
    <div>
      <h1>Still Warm</h1>
      <p class="medium">Soft pastel, vine charcoal, coloured pencil, kaolin chalk and <b>hearth-gold</b> on oat paper. Every mark is laid by JavaScript onto the grain of the sheet, then some of it is rubbed out again. Click the sheet to come close.</p>
    </div>
    <div>
      <div class="tools"><span>Draw it again at</span><button type="button" id="size-1k" data-size="1k">1920</button><button type="button" id="size-2k" data-size="2k">2560</button><button type="button" id="size-4k" data-size="4k">3840</button></div>
      <div id="note" role="status"></div>
    </div>
  </div>
</main>
<script>
${js}
</script>`;
const out = path.resolve(__dirname, '../../still-warm-output/still-warm.html');
fs.writeFileSync(out, `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log('wrote', out, fs.statSync(out).size, 'bytes');
if (process.argv[2]) { fs.writeFileSync(process.argv[2], head + '\n' + body + '\n'); console.log('wrote', process.argv[2]); }
