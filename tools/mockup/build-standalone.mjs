// Bundles docs/mockups/floating-coach.html with its images and scripts into one HTML file that opens anywhere
// (double-click, e-mail, USB) with no server: docs/mockups/dist/wellness-coach-mockup.html (git-ignored).
//   node tools/mockup/build-demo.mts && node tools/mockup/build-standalone.mjs
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../../docs/mockups/', import.meta.url));
const read = f => readFileSync(join(dir, f), 'utf8');
const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png' };
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

// Every web image as a data URI, keyed by the path the page uses ("img/web/icons/ic-coach.png").
const images = Object.fromEntries(walk(join(dir, 'img', 'web')).filter(f => MIME[extname(f)])
  .map(f => [relative(dir, f).split(sep).join('/'), `data:${MIME[extname(f)]};base64,${readFileSync(f).toString('base64')}`]));

let html = read('floating-coach.html');
// Static <img src> in the markup are swapped at build time; images the scripts build later are swapped as they appear.
html = html.replace(/(["'(])(img\/web\/[^"')]+)/g, (m, q, p) => images[p] ? q + images[p] : m);
const loader = /for \(const src of [^\n]+\n[^\n]+document\.body\.append[^\n]+\n/;
if (!loader.test(html)) throw new Error('script loader not found in floating-coach.html');
html = html.replace(loader, '');
const fixImages = `const IMG = ${JSON.stringify(images)};
const fix = el => { for (const img of el.querySelectorAll ? el.querySelectorAll('img[src^="img/web/"]') : []) img.src = IMG[img.getAttribute('src')] || img.src; };
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && (n.matches?.('img[src^="img/web/"]') ? fix(n.parentNode) : fix(n))))).observe(document.body, { childList: true, subtree: true });
fix(document);`;
const scripts = ['demo-data.js', 'demo.js', 'app.js'].map(f => `<script>/* ${f} */\n${read(f)}</script>`).join('\n');
const at = html.lastIndexOf('</script>');
html = html.slice(0, at + 9) + `\n<script>${fixImages}</script>\n${scripts}\n` + html.slice(at + 9);

const out = join(dir, 'dist', 'wellness-coach-mockup.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB, ${Object.keys(images).length} images)`);
