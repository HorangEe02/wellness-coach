import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitRange } from './fetch.mjs';

test('splitRange keeps every row except the ones the server cannot return', async () => {
  const bad = new Set([57, 903]);
  // fake source: a range fails if it contains a bad row
  const src = { async range(s, e) {
    for (let i = s; i <= e; i++) if (bad.has(i)) throw new Error('ERROR-500');
    return { items: Array.from({ length: e - s + 1 }, (_, k) => s + k) };
  } };
  const skipped = [];
  const rows = await splitRange(src, 1, 1000, skipped);
  assert.deepEqual(skipped, [57, 903]);
  assert.equal(rows.length, 998);
  assert.deepEqual(rows.slice(55, 57), [56, 58]);
});
