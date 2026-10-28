  // a hand-pixelled head test: Sable, three-quarter view facing right
  const SABLE_HEAD = [
    '..........kkkkkkk.........',
    '.......kkkHHHHHHHkkk......',
    '.....kkHHHhhhhhhhHHHkk....',
    '....kHHhhhlllllhhhhhHHk...',
    '...kHhhhllllllllhhhhhHHk..',
    'rr.kHhhllhhhhhhhllhhhhHk..',
    'rrkHhhlhhhHHHHhhhhlhhhhHk.',
    'rrkHhhhhHHkHHHhHHhhhhhhHk.',
    '.kHhhhhHksssHHsssHHhhhhhHk',
    '.kHhhhHkssssHssssssHhhhhHk',
    '.kHhhHkssssssssssssHhhhHk.',
    '.kHhhHksssskkkssskkkHhhHk.',
    '.kHhhHsSssswwppsswwpkhhHk.',
    '.kHhhHsSSsswwepsswepsHhHk.',
    '.kHhhHsSSssssssssssssHhHk.',
    '.kHhHkSSsssssssSsssssHHk..',
    '.kHhHkSSssssssSSsssssHk...',
    '.kHhHkkSSsssssssssssk.....',
    '..kHHk.kSSsssskkksssk.....',
    '..kHHk..kSSSsssssssk......',
    '...kHk...kkSSSsssskk......',
    '...kHk.....kkSSSsk........',
    '....k......kSSSSSk........',
  ];
  const KEY = { k: () => C('ink', 0), H: () => C('hair', 1), h: () => C('hair', 2), l: () => C('hair', 4), s: () => C('tan', 5), S: () => C('tan', 3), w: () => C('snow', 7), e: () => C('ember', 4), p: () => C('ink', 0), r: () => C('crimson', 4) };
  function blit(rows, x0, y0, sc) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; rectF(x0 + i * sc, y0 + j * sc, sc, sc, KEY[ch]()); } }); }
  function draw(t) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 1.2 + (1 - y / H) * 1.8, x, y);
    blit(SABLE_HEAD, 40, 40, 1); blit(SABLE_HEAD, 100, 40, 2); blit(SABLE_HEAD, 200, 40, 5);
  }
