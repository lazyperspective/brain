// the engine's source files, in load order: core, sprites, every cast file (c_*), world, dialogue, frame, every shot file (f_*)
const fs = require('fs'), path = require('path');
module.exports = (dir) => {
  const ls = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  const order = ['a_core.js', 'b_sprite.js', 'c_cast.js', 'c_portrait.js', ...ls.filter((f) => /^c_/.test(f) && f !== 'c_cast.js' && f !== 'c_portrait.js'), 'd_world.js', 'e_dlg.js', 'e_frame.js', ...ls.filter((f) => /^f_/.test(f))];
  return order.map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
};
