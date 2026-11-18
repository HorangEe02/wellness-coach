import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COLUMNS, FOOD_CAT, buildFoods, serving } from './build-foods.mjs';

const base = { nutConSrtrQua: '100g', foodOriginCd: '1', foodLv3Nm: '밥류', restNm: '해당없음', foodSize: '210g', enerc: '150', chocdf: '33', prot: '3', fatce: '0.3', sugar: '', nat: '2', fasat: '', fibtg: '' };
const row = o => ({ foodCd: `D${Math.random()}`, foodNm: '쌀밥', ...base, ...o });

test('blank source values stay null, brands and categories carry over', () => {
  const { rows } = buildFoods([row({}), row({ foodNm: '커피_아메리카노', foodOriginCd: '2', restNm: '할리스', foodLv3Nm: '음료 및 차류', nutConSrtrQua: '100ml', foodSize: '354ml', enerc: '1' })],
    [{ foodCd: 'R1', foodNm: '바나나_생것', foodLv3Nm: '과일류', nutConSrtrQua: '100g', enerc: '77', chocdf: '', prot: '1', fatce: '', sugar: '', nat: '', fasat: '', fibtg: '' }]);
  const o = rows.map(r => Object.fromEntries(COLUMNS.map((c, i) => [c, r[i]])));
  assert.deepEqual([o[0].cat, o[0].origin, o[0].brand, o[0].sugar, o[0].size], ['rice', 'home', null, null, 210]);
  assert.deepEqual([o[1].brand, o[1].cat, o[1].origin, o[1].unit, o[1].size], ['할리스', 'drink', 'franchise', 'ml', 354]);
  assert.deepEqual([o[2].cat, o[2].origin, o[2].size, o[2].carb], ['fruit', 'raw', 100, null]); // raw: no serving, 100 g
});

test('impossible calories and exact duplicates are dropped', () => {
  const { rows, dropped } = buildFoods([row({ enerc: '1104' }), row({}), row({})], []);
  assert.equal(rows.length, 1);
  assert.deepEqual(dropped, { badKcal: 1, duplicate: 1 });
});

test('serving scales per-100 values and keeps nulls', () => {
  const { rows } = buildFoods([row({})], []);
  assert.deepEqual(serving(rows[0]), { name: '쌀밥', serving: '210g', g: 210, unit: 'g', cat: 'rice', kcal: 315, carb: 69.3, protein: 6.3, fat: 0.6, sugar: null, sodium: 4.2, satFat: null });
});

test('an unknown source group fails loudly instead of losing its category', () => {
  assert.throws(() => buildFoods([row({ foodLv3Nm: '새 분류' })], []), /no category/);
});

test('committed foods.json is sane', () => {
  const db = JSON.parse(readFileSync(fileURLToPath(new URL('../../packages/core/data/foods.json', import.meta.url)), 'utf8'));
  const C = Object.fromEntries(db.columns.map((c, i) => [c, i]));
  const cats = new Set(Object.values(FOOD_CAT));
  assert.equal(cats.size, 25);
  assert.ok(db.rows.length > 20000);
  for (const r of db.rows) {
    assert.ok(r[C.cat] === null || cats.has(r[C.cat]), r[C.id]);
    assert.ok(r[C.kcal] >= 0 && r[C.kcal] <= 930, r[C.id]);
    assert.ok(r[C.size] > 0, r[C.id]);
  }
  assert.ok(db.rows.some(r => r[C.brand] === '할리스'));
  assert.equal(new Set(db.rows.map(r => r[C.id])).size, db.rows.length, 'ids are unique');
});
