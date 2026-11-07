// Merge region re-bakes into the full latent image: node merge.js <base.u16> <W> <H> <out.u16> <patch.u16>:x0,y0,x1,y1 ...
// (GL pixel coords, rows bottom-up). Inside each rectangle the patch replaces the base, with a 6 px feathered edge.
const fs = require('fs');
const [base, Ws, Hs, out, ...patches] = process.argv.slice(2);
const W = +Ws, H = +Hs;
const b = new Uint16Array(fs.readFileSync(base).buffer.slice(0));
const E = (v) => Math.pow(2, v / 65535 * 18 - 14), enc = (e) => Math.round(Math.min(1, Math.max(0, (Math.log2(Math.max(e, 1e-7)) + 14) / 18)) * 65535);
for (const spec of patches) {
  const [file, rect] = spec.split(':'); const [x0, y0, x1, y1] = rect.split(',').map(Number);
  const p = new Uint16Array(fs.readFileSync(file).buffer.slice(0));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * W + x) * 2, m = Math.min(1, Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y) / 6);
    b[i] = enc(E(b[i]) * (1 - m) + E(p[i]) * m);
    if (m > 0.5) b[i + 1] = p[i + 1];
  }
}
fs.writeFileSync(out, Buffer.from(b.buffer));
console.log('merged', patches.length, 'patches ->', out);
