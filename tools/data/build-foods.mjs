// Builds packages/core/data/foods.json from the public downloads in data-raw/api (see docs/DATA.md):
//   food      식약처 식품영양성분 표준데이터 15100070 (가정식·외식·프랜차이즈·급식 음식)
//   material  농촌진흥청 원재료성 식품 표준데이터 15100065 (raw ingredients)
// Run after tools/data/fetch.mjs:  node tools/data/build-foods.mjs
// Values are per 100 g (or 100 ml, see `unit`) as published. A blank in the source stays null ("not reported"),
// never 0: franchise rows often report kcal and protein but not carbs or fat.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// MFDS food groups (식품대분류) → the 25 category keys used for default images (docs/mockups/img/food-cat/cat-<key>.jpg)
export const FOOD_CAT = {
  '밥류': 'rice', '죽 및 스프류': 'porridge', '면 및 만두류': 'noodle', '국 및 탕류': 'soup', '찌개 및 전골류': 'jjigae',
  '찜류': 'steamed', '구이류': 'grill', '전·적 및 부침류': 'jeon', '볶음류': 'stirfry', '조림류': 'braised',
  '나물·숙채류': 'namul', '생채·무침류': 'saengchae', '김치류': 'kimchi', '장아찌·절임류': 'pickle', '젓갈류': 'jeotgal',
  '장류, 양념류': 'sauce', '튀김류': 'fried', '빵 및 과자류': 'bread', '음료 및 차류': 'drink', '유제품류 및 빙과류': 'dairy',
  '수·조·어·육류': 'meat', '곡류, 서류 제품': 'grain', '두류, 견과 및 종실류': 'legume', '채소, 해조류': 'vegetable', '과일류': 'fruit',
};
// RDA raw-ingredient groups → the same keys. '기타' (insects, extracts) fits none and stays null.
export const MATERIAL_CAT = {
  '곡류': 'grain', '감자 및 전분류': 'grain', '당류': 'sauce', '두류': 'legume', '견과 및 종실류': 'legume',
  '채소류': 'vegetable', '버섯류': 'vegetable', '해조류': 'vegetable', '과일류': 'fruit', '육류': 'meat', '난류': 'meat',
  '어패류 및 기타 수산물': 'meat', '우유류': 'dairy', '유지류': 'sauce', '차류': 'drink', '조미료류': 'sauce', '기타': null,
};
// foodOriginCd → where the numbers come from
const ORIGIN = { 1: 'home', 2: 'franchise', 3: 'restaurant', 4: 'restaurant-recipe', 5: 'school-elem', 6: 'school-mid', 7: 'cafeteria' };
export const COLUMNS = ['id', 'name', 'brand', 'cat', 'origin', 'unit', 'size', 'kcal', 'carb', 'protein', 'fat', 'sugar', 'sodium', 'satFat', 'fiber'];
const MAX_KCAL_100 = 930; // pure fat is ~900 kcal/100 g; above this the row is an entry error (seven macarons list 980-1,338)

const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

export function toRow(r, kind) {
  const unit = r.nutConSrtrQua === '100ml' ? 'ml' : 'g';
  const m = String(r.foodSize ?? '').match(/^([\d.]+)\s*(g|ml)$/i);
  const cat = kind === 'food' ? FOOD_CAT[r.foodLv3Nm] : MATERIAL_CAT[r.foodLv3Nm];
  if (cat === undefined) throw new Error(`no category for ${kind} group "${r.foodLv3Nm}" (${r.foodCd})`);
  const brand = kind === 'food' && r.restNm && r.restNm !== '해당없음' ? r.restNm : null;
  return [
    r.foodCd, r.foodNm.trim(), brand, cat, kind === 'food' ? ORIGIN[r.foodOriginCd] ?? 'other' : 'raw', unit,
    m ? Number(m[1]) : 100, // one serving as published; raw ingredients have none, so 100
    num(r.enerc), num(r.chocdf), num(r.prot), num(r.fatce), num(r.sugar), num(r.nat), num(r.fasat), num(r.fibtg),
  ];
}

export function buildFoods(food, material) {
  const rows = [], dropped = { badKcal: 0, duplicate: 0 }, seen = new Set(), ids = new Map();
  for (const [kind, list] of [['food', food], ['material', material]]) {
    for (const r of list) {
      const row = toRow(r, kind);
      if (row[7] == null || row[7] < 0 || row[7] > MAX_KCAL_100) { dropped.badKcal++; continue; }
      const key = JSON.stringify(row.slice(1)); // same food, brand, size and numbers under another code
      if (seen.has(key)) { dropped.duplicate++; continue; }
      seen.add(key);
      // the source reuses a code for different foods (참다랑어 등살 / 뱃살): later ones become <code>#2, #3
      const n = (ids.get(row[0]) ?? 0) + 1;
      ids.set(row[0], n);
      if (n > 1) row[0] += `#${n}`;
      rows.push(row);
    }
  }
  return { rows, dropped };
}

// Per-serving values in the shape diet-coach's FOODS uses ({ name, serving, g, kcal, carb, ... }); null stays null.
export function serving(row) {
  const o = Object.fromEntries(COLUMNS.map((c, i) => [c, row[i]]));
  const k = o.size / 100, s = v => (v == null ? null : Math.round(v * k * 10) / 10);
  return { name: o.brand ? `${o.brand} ${o.name}` : o.name, serving: `${o.size}${o.unit}`, g: o.size, unit: o.unit, cat: o.cat,
    kcal: s(o.kcal), carb: s(o.carb), protein: s(o.protein), fat: s(o.fat), sugar: s(o.sugar), sodium: s(o.sodium), satFat: s(o.satFat) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const latest = name => {
    const dir = join(root, 'data-raw', 'api', name);
    const file = readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort().pop();
    const text = readFileSync(join(dir, file), 'utf8');
    return { file: `data-raw/api/${name}/${file}`, sha256: createHash('sha256').update(text).digest('hex'), rows: text.trim().split('\n').map(l => JSON.parse(l)) };
  };
  const food = latest('food'), material = latest('material');
  const { rows, dropped } = buildFoods(food.rows, material.rows);
  const out = {
    about: 'Per 100 g or 100 ml (unit) as published; null = not reported. Built by tools/data/build-foods.mjs. 공공누리 제1유형: 식품의약품안전처, 농촌진흥청.',
    sources: [food, material].map(s => ({ file: s.file, sha256: s.sha256, rows: s.rows.length })),
    dropped, columns: COLUMNS, rows,
  };
  const path = join(root, 'packages', 'core', 'data', 'foods.json');
  writeFileSync(path, JSON.stringify(out).replace(/\],\[/g, '],\n['));
  console.log(`foods.json: ${rows.length} rows (dropped ${JSON.stringify(dropped)})`);
}
