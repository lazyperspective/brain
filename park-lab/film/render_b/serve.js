// tiny static server: /film/* -> park-lab/film, /jsm/* -> three r160 examples/jsm (from the miniature-globe prototype), /rb/* -> render_b
const http = require('http'), fs = require('fs'), path = require('path');
const LAB = path.resolve(__dirname, '../..');
const MAP = [['/film/', path.join(LAB, 'film')], ['/jsm/', path.join(LAB, 'miniature-globe/node_modules/three/examples/jsm')], ['/rb/', __dirname]];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
function start() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      for (const [pre, dir] of MAP) if (u.startsWith(pre)) {
        const p = path.join(dir, u.slice(pre.length));
        if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) break;
        r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        return fs.createReadStream(p).pipe(r);
      }
      r.writeHead(404); r.end();
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}
module.exports = { start };
