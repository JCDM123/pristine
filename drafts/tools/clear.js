// Empty The Source and Kitchen grids and featured slots (in the sandbox copy only) so every story is republished in order
const fs = require('fs');
function divEnd(h, s) { let d = 0; for (let i = s; i < h.length; i++) { if (h.startsWith('<div', i)) d++; else if (h.startsWith('</div>', i)) { d--; if (d === 0) return i + 6; } } return -1; }
function removeBlocks(h, open, within) {
  let from = h.indexOf(within); if (from < 0) throw new Error('no ' + within);
  let at = h.indexOf(open, from), n = 0;
  while (at !== -1) { const e = divEnd(h, at); h = h.slice(0, at) + h.slice(e); n++; at = h.indexOf(open, from); }
  return [h, n];
}
function clearFeatured(h) { const s = h.indexOf('<div class="featured"'); const e = divEnd(h, s); return h.slice(0, s) + '<!-- FEATURED_PLACEHOLDER -->' + h.slice(e); }
const dir = process.argv[2];
let src = fs.readFileSync(dir + '/the-source.html', 'utf8'); let n1;
src = clearFeatured(src); [src, n1] = removeBlocks(src, '<div class="article-card"', '<div class="article-grid">');
fs.writeFileSync(dir + '/the-source.html', src);
let k = fs.readFileSync(dir + '/ancestral-kitchen.html', 'utf8'); let n2;
k = clearFeatured(k); [k, n2] = removeBlocks(k, '<div class="card"', 'id="recipe-grid">');
fs.writeFileSync(dir + '/ancestral-kitchen.html', k);
console.log('cleared: source cards', n1, 'kitchen cards', n2);
