// Download public food / supplement datasets into data-raw/api/<name>/<YYYY-MM-DD>.jsonl (git-ignored).
// Keys are read from git-ignored files and never printed. Run: node tools/data/fetch.mjs [name ...]
// See docs/DATA.md for sources and licences.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const key = f => readFileSync(join(root, f), 'utf8').trim();
const today = new Date().toISOString().slice(0, 10);

// data.go.kr standard-data APIs: ?serviceKey&pageNo&numOfRows&type=json → response.body.{totalCount,items}
const portal = (endpoint, rows = 1000) => ({
  async page(n) {
    // the key file holds the already URL-encoded key, so it goes into the URL as is
    const url = `https://api.data.go.kr/openapi/${endpoint}?serviceKey=${key('.data-go-kr-key')}&pageNo=${n}&numOfRows=${rows}&type=json`;
    const d = await getJson(url);
    // standard-data APIs answer {header, body} (some portal APIs wrap it in "response"); rows sit in body.items.item
    const r = d?.response ?? d;
    const body = r?.body;
    if (!body || r.header?.resultCode !== '00') throw new Error(`${endpoint} page ${n}: ${mask(JSON.stringify(d)).slice(0, 300)}`);
    const items = body.items?.item ?? body.items ?? [];
    return { total: Number(body.totalCount), items: Array.isArray(items) ? items : [items] };
  },
  rows,
});
// foodsafetykorea.go.kr: /api/<key>/<svc>/json/<start>/<end>, at most 1000 rows per call
const foodsafety = svc => {
  const range = async (start, end) => {
    const url = `http://openapi.foodsafetykorea.go.kr/api/${key('data-raw/keys/.foodsafety-key')}/${svc}/json/${start}/${end}`;
    const d = (await getJson(url))?.[svc];
    if (!d) throw new Error(`${svc} ${start}-${end}: unexpected response`);
    if (d.RESULT?.CODE && !['INFO-000', 'INFO-200'].includes(d.RESULT.CODE)) throw new Error(`${svc}: ${d.RESULT.CODE} ${d.RESULT.MSG}`);
    return { total: Number(d.total_count), items: d.row ?? [] };
  };
  return { page: n => range((n - 1) * 1000 + 1, n * 1000), range, rows: 1000 };
};

const SOURCES = {
  food: portal('tn_pubr_public_nutri_food_info_api'), // 15100070 음식
  material: portal('tn_pubr_public_nutri_material_info_api'), // 15100065 원재료성식품
  hff: portal('tn_pubr_public_health_functional_food_nutrition_info_api'), // 15155983 건강기능식품 영양성분
  C003: foodsafety('C003'), // 품목제조신고(원재료)
  I0310: foodsafety('I0310'), // 생산실적보고 품목
  'I-0050': foodsafety('I-0050'), // 개별인정형
  'I-0040': foodsafety('I-0040'), // 기능성 원료인정
  I2710: foodsafety('I2710'), // 품목분류(고시형 원료)
  I0760: foodsafety('I0760'), // 건강기능식품 영양DB
  I2715: foodsafety('I2715'), // 해외직구 위해식품 차단
};

const mask = s => String(s).replace(/serviceKey=[^&"\s]+|api\/[0-9a-f]{20}\//g, '***');

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return JSON.parse(text);
    } catch (e) {
      if (i >= tries) throw new Error(mask(e.message));
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
}

// A whole page can fail with a server-side error code (foodsafety ERROR-500); retry the page, not just the HTTP call.
async function pageWithRetry(src, n, tries = 5) {
  for (let i = 1; ; i++) {
    try { return await src.page(n); } catch (e) {
      if (i >= tries) throw e;
      await new Promise(r => setTimeout(r, 5000 * i));
    }
  }
}

// A foodsafety range that keeps failing usually hides a few rows the server cannot serialise (I0310 rows 40,001-60,000).
// Split it 1000 → 100 → 10 → 1 and skip only the single rows that still fail; their positions go into the meta file.
export async function splitRange(src, start, end, skipped) {
  try { return (await src.range(start, end)).items; } catch (e) {
    if (start === end) { skipped.push(start); return []; }
    const step = Math.max(1, Math.ceil((end - start + 1) / 10));
    const out = [];
    for (let s = start; s <= end; s += step) out.push(...(await splitRange(src, s, Math.min(end, s + step - 1), skipped)));
    return out;
  }
}

async function run(name) {
  const src = SOURCES[name];
  if (!src) throw new Error(`unknown source ${name} (have: ${Object.keys(SOURCES).join(', ')})`);
  const first = await pageWithRetry(src, 1);
  const pages = Math.ceil(first.total / src.rows);
  const items = [...first.items], skipped = [];
  for (let n = 2; n <= pages; n++) {
    try { items.push(...(await pageWithRetry(src, n, 3)).items); } catch (e) {
      if (!src.range) throw e;
      console.log(`  ${name} page ${n} keeps failing (${e.message}); splitting it`);
      items.push(...(await splitRange(src, (n - 1) * src.rows + 1, n * src.rows, skipped)));
    }
    if (n % 20 === 0) console.log(`  ${name} ${n}/${pages}`);
  }
  if (skipped.length) console.log(`  ${name}: skipped ${skipped.length} rows the server could not return (positions in meta)`);
  // the source can change while we page through it (C003 grew by 2 rows mid-run); allow 0.1 %, record both numbers
  const drift = items.length + skipped.length - first.total;
  if (Math.abs(drift) > Math.max(2, first.total * 0.001)) throw new Error(`${name}: got ${items.length} rows (+${skipped.length} skipped), source says ${first.total}`);
  if (drift) console.log(`  ${name}: ${drift > 0 ? '+' : ''}${drift} rows vs the total reported at start (source changed while paging)`);
  const out = join(root, 'data-raw', 'api', name, `${today}.jsonl`);
  mkdirSync(dirname(out), { recursive: true });
  const text = items.map(r => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(out, text);
  const sha256 = createHash('sha256').update(text).digest('hex');
  writeFileSync(out.replace(/\.jsonl$/, '.meta.json'), JSON.stringify({ name, fetched: new Date().toISOString(), rows: items.length, reportedTotal: first.total, skippedPositions: skipped, sha256 }, null, 1));
  console.log(`${name}: ${items.length} rows → data-raw/api/${name}/${today}.jsonl`);
}

// only download when run as a script, so tests can import splitRange
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOURCES);
  for (const n of names) {
    try { await run(n); } catch (e) { console.error(`${n}: FAILED ${e.message}`); process.exitCode = 1; }
  }
}
