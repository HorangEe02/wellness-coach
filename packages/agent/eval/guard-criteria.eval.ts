// Which "criteria" wording for the safety choice works best on d1-2B? Rules are unioned in, as in the graph.
// Pick on the 46 internal sentences; the 48 external ones (written by Gemini/Codex) are reported, not tuned on.
// Run: node eval/guard-criteria.eval.ts   (needs the d1 server, infra/models.compose.yaml)
import { readFileSync } from 'node:fs';
import { assessSafety, QUESTION } from '../src/guard.ts';
import type { Question } from '../src/models/systemone.ts';
import { systemOne } from '../src/models/systemone.ts';
import { GUARD_CASES, GUARD_EXTERNAL, GUARD_HOLDOUT } from './guard-cases.ts';

const review = (who: string) => JSON.parse(readFileSync(new URL(`./reviews/${who}.json`, import.meta.url), 'utf8')).criteria;
const withCriteria = (criteria: Record<string, string>): Question => ({ type: 'choice', instructions: '이 메시지는 어떤 종류인가?', criteria });
const variants: Record<string, Question> = { current: QUESTION, gemini: withCriteria(review('gemini')), codex: withCriteria(review('codex')) };
const decide = systemOne({ baseUrl: process.env.D1_URL ?? 'http://localhost:8081', timeoutMs: 60000 });
const sets = { internal46: [...GUARD_CASES, ...GUARD_HOLDOUT], external48: GUARD_EXTERNAL };

for (const [vName, q] of Object.entries(variants)) for (const [sName, cases] of Object.entries(sets)) {
  let ok = 0, missed = 0, falseAlarm = 0, wrongKind = 0, modelOk = 0;
  const bad: string[] = [];
  for (const [text, want] of cases) {
    const s = await assessSafety(text, decide, q);
    const top = Object.entries(s.scores).sort((a, b) => b[1]! - a[1]!)[0]?.[0];
    if ((top === 'none' ? null : top) === want) modelOk++;
    if (s.flag === want) ok++;
    else if (want && !s.flag) missed++;
    else if (!want && s.flag) falseAlarm++;
    else wrongKind++;
    if (s.flag !== want) bad.push(`    ✗ want=${want ?? '-'} got=${s.flag ?? '-'}(${s.source}) | ${text}`);
  }
  console.log(`${vName.padEnd(8)} ${sName}: ${ok}/${cases.length}  (model alone ${modelOk}) missed ${missed}, false alarm ${falseAlarm}, wrong kind ${wrongKind}`);
  for (const b of bad) console.log(b);
}
