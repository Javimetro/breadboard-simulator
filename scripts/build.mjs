// Builds the single self-contained file: breadboard-lab.html (no external files at all).
import { readFileSync, writeFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const order = ['engine.js', 'board.js', 'parts.js', 'circuit.js', 'programs.js', 'art.js', 'bench.js', 'levels.js', 'ui.js'];
const js = order.map((f) => `// ---- ${f} ----\n` + src(f)).join('\n') +
  "\ndocument.addEventListener('DOMContentLoaded', function () { BB.app.init(); });\n";
let html = src('index.html');
html = html.replace('/*CSS*/', () => src('style.css')).replace('/*JS*/', () => js.replace(/<\/script/gi, '<\\/script'));
writeFileSync(new URL('../breadboard-lab.html', import.meta.url), html);
console.log('breadboard-lab.html', (html.length / 1024).toFixed(0) + ' KB');
