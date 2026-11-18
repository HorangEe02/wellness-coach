// Run: node --test eval/eval-data.test.ts
// Keeps the safety eval data honest: valid labels, and no sentence shared between the set we tune on and the
// sets we only measure on (a shared sentence would inflate the measured score).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FLAGS } from '../src/guard.ts';
import { GUARD_CASES, GUARD_EXTERNAL, GUARD_HOLDOUT } from './guard-cases.ts';
import { SH_DEV, SH_EXT_DEV, SH_EXT_TEST, SH_TEST } from './selfharm-cases.ts';

const norm = (t: string) => t.replace(/\s+/g, '');
const review = (who: string) => JSON.parse(readFileSync(new URL(`./reviews/${who}.json`, import.meta.url), 'utf8'));

test('set sizes', () => {
  assert.equal(GUARD_CASES.length, 30);
  assert.equal(GUARD_HOLDOUT.length, 16);
  assert.equal(GUARD_EXTERNAL.length, 48);
});

test('every label is a flag or null (none)', () => {
  for (const [text, label] of [...GUARD_CASES, ...GUARD_HOLDOUT, ...GUARD_EXTERNAL])
    assert.ok(label === null || FLAGS.includes(label), `${label} | ${text}`);
});

test('no sentence appears twice, within or across sets', () => {
  const seen = new Map<string, string>();
  for (const [name, set] of Object.entries({ tuning: GUARD_CASES, holdout: GUARD_HOLDOUT, external: GUARD_EXTERNAL }))
    for (const [text] of set) {
      const k = norm(text);
      assert.ok(!seen.has(k), `"${text}" is in ${seen.get(k)} and ${name}`);
      seen.set(k, name);
    }
});

test('each review covers S01-S46 with valid labels and adds 24 cases', () => {
  for (const who of ['gemini', 'codex']) {
    const r = review(who);
    const ids = Object.keys(r.blind);
    assert.equal(ids.length, 46, who);
    for (let i = 1; i <= 46; i++) assert.ok(ids.includes('S' + String(i).padStart(2, '0')), `${who} S${i}`);
    for (const [label, conf] of Object.values(r.blind) as [string, number][]) {
      assert.ok(['none', ...FLAGS].includes(label), `${who} ${label}`);
      assert.ok(conf >= 0 && conf <= 1);
    }
    assert.equal(r.new_cases.length, 24, who);
  }
});

test('self-harm set: valid labels, every phenomenon in both halves, no sentence reused anywhere', () => {
  const all = [...SH_DEV, ...SH_TEST, ...SH_EXT_DEV, ...SH_EXT_TEST];
  for (const k of all) assert.ok(k.label === null || FLAGS.includes(k.label), k.text);
  const kinds = (s: typeof all) => new Set(s.filter(k => !k.ambiguous && k.label === 'selfharm').map(k => k.kind));
  for (const k of kinds(SH_DEV)) assert.ok(kinds(SH_TEST).has(k), `${k} only in dev`);
  for (const k of kinds(SH_EXT_DEV)) assert.ok(kinds(SH_EXT_TEST).has(k), `${k} only in ext-dev`);
  const seen = new Set([...GUARD_CASES, ...GUARD_HOLDOUT, ...GUARD_EXTERNAL].map(([t]) => norm(t)));
  for (const k of all) {
    assert.ok(!seen.has(norm(k.text)), `reused: ${k.text}`);
    seen.add(norm(k.text));
  }
});

test('self-harm reviews: 80 blind labels, 8 ambiguous calls, 54 + 26 new sentences', () => {
  for (const who of ['gemini', 'codex']) {
    const r = review(`selfharm-${who}`);
    assert.equal(Object.keys(r.blind).length, 80, who);
    for (const a of [...Object.values(r.blind), ...Object.values(r.ambiguous_policy)]) assert.ok(['crisis', 'checkin', 'normal'].includes(a as string), `${who} ${a}`);
    assert.equal(Object.keys(r.ambiguous_policy).length, 8, who);
    assert.equal(r.new_cases.filter(([, intent]: [string, boolean]) => intent).length, 54, who);
    assert.equal(r.new_cases.length, 80, who);
  }
});

test('review files carry no tracking query strings', () => {
  for (const who of ['gemini', 'codex']) assert.doesNotMatch(readFileSync(new URL(`./reviews/${who}.json`, import.meta.url), 'utf8'), /oai_link_source|utm_/);
});
