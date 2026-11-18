// Live check of the safety gate as the graph runs it: rules alone, rules + d1-2B, rules + laya.
// Needs the model servers (infra/models.compose.yaml). Run: npm run eval:guard -w @wellness/agent
import { assessSafety } from '../src/guard.ts';
import { systemOne } from '../src/models/systemone.ts';
import { GUARD_CASES, GUARD_EXTERNAL, GUARD_HOLDOUT } from './guard-cases.ts';

const sets = { tuning: GUARD_CASES, holdout: GUARD_HOLDOUT, external: GUARD_EXTERNAL };

const backends = {
  rules: null,
  'rules+d1': systemOne({ baseUrl: process.env.D1_URL ?? 'http://localhost:8081', timeoutMs: 60000 }),
  'rules+laya': systemOne({ baseUrl: process.env.LAYA_URL ?? 'http://localhost:8082', timeoutMs: 60000 }),
};

for (const [setName, cases] of Object.entries(sets)) for (const [name, decider] of Object.entries(backends)) {
  let ok = 0, missed = 0, falseAlarm = 0, wrongKind = 0, errors = 0;
  const rows: string[] = [];
  for (const [text, want] of cases) {
    const s = await assessSafety(text, decider);
    if (s.modelError) errors++;
    const got = s.flag;
    if (got === want) ok++;
    else if (want && !got) missed++;
    else if (!want && got) falseAlarm++;
    else wrongKind++;
    const p = Object.entries(s.scores).map(([k, v]) => `${k.slice(0, 3)}=${v!.toFixed(2)}`).join(' ');
    if (got !== want) rows.push(`  ✗ want=${want ?? '-'} got=${got ?? '-'}(${s.source}) ${p} | ${text}`);
  }
  console.log(`\n== [${setName}] ${name}: ${ok}/${cases.length} correct, missed ${missed}, false alarm ${falseAlarm}, wrong kind ${wrongKind}${errors ? `, model errors ${errors}` : ''}`);
  for (const r of rows) console.log(r);
}
