// Compares diet-coach's 76 hand-entered FOODS with packages/core/data/foods.json (kcal per 100 g, since servings differ).
//   node tools/data/compare-foods.mjs > /tmp/compare.md
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { FOODS } = require('../../packages/core').diet;
const db = JSON.parse(readFileSync(fileURLToPath(new URL('../../packages/core/data/foods.json', import.meta.url)), 'utf8'));
const C = Object.fromEntries(db.columns.map((c, i) => [c, i]));
const norm = s => s.replace(/[\s_()·]/g, '');
const RANK = ['home', 'restaurant', 'restaurant-recipe', 'cafeteria', 'school-mid', 'school-elem', 'raw'];
// generic dishes only: a franchise menu item is not "김밥"
// shortcut: 100 ml rows are compared as if 100 g (drinks and soups are close to water's density)
const pool = db.rows.filter(r => !r[C.brand]).sort((a, b) => RANK.indexOf(a[C.origin]) - RANK.indexOf(b[C.origin]));

const rows = FOODS.map(f => {
  const n = norm(f.name);
  // 1. same name  2. the source's "<dish>_<variant>" written the other way (파전_해물 = 해물파전)
  // 3. "<name>_<variant>" (고등어구이_석쇠, 바나나_생것), raw "_생것" first. No prefix guessing: 떡 must not match 떡볶이.
  const parts = r => r[C.name].split('_').map(norm);
  const hit = pool.find(r => norm(r[C.name]) === n)
    ?? pool.find(r => { const [a, ...b] = parts(r); return b.length && b.join('') + a === n; })
    ?? pool.filter(r => parts(r)[0] === n).sort((a, b) => b[C.name].endsWith('_생것') - a[C.name].endsWith('_생것'))[0];
  const mine = Math.round(f.kcal / f.g * 100);
  if (!hit) return { name: f.name, mine, db: null };
  const v = hit[C.kcal];
  return { name: f.name, mine, db: v, dbName: hit[C.name], origin: hit[C.origin], diff: Math.round((mine - v) / v * 100) };
});

const found = rows.filter(r => r.db != null), far = found.filter(r => Math.abs(r.diff) > 30);
console.log(`- 76개 중 ${found.length}개를 찾음 (같은 이름, "음식_변형" 형태, 프랜차이즈 제외. 100ml 기준 값은 100g으로 봄)`);
console.log(`- 100g당 kcal 차이 중앙값: ${median(found.map(r => Math.abs(r.diff)))}%, 30% 넘게 다른 것 ${far.length}개, 못 찾은 것 ${rows.length - found.length}개\n`);
console.log('| diet-coach 음식 | diet-coach kcal/100g | DB kcal/100g | 차이 | DB에서 찾은 이름 (출처) |\n|---|---|---|---|---|');
for (const r of rows.sort((a, b) => Math.abs(b.diff ?? 999) - Math.abs(a.diff ?? 999)))
  console.log(`| ${r.name} | ${r.mine} | ${r.db ?? '-'} | ${r.db == null ? '없음' : `${r.diff > 0 ? '+' : ''}${r.diff}%`} | ${r.dbName ? `${r.dbName} (${r.origin})` : ''} |`);

function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; }
