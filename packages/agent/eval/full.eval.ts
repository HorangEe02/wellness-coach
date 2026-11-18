// Full guard as the graph runs it (rules + d1-2B + LFM3 judge) on the general safety sets.
// Reports flag accuracy plus how often a normal message got the 109 check-in line or a wrong self-harm crisis.
// Run: node eval/full.eval.ts   (needs the d1 server and Ollama)
import { assessSafety, QUESTION } from '../src/guard.ts';
import { openAIChat } from '../src/models/chat.ts';
import { llmChoice } from '../src/models/llmchoice.ts';
import { systemOne } from '../src/models/systemone.ts';
import { GUARD_CASES, GUARD_EXTERNAL, GUARD_HOLDOUT } from './guard-cases.ts';

const d1 = process.env.DECIDER === 'lfm3'
  ? llmChoice({ baseUrl: process.env.LLM_BASE_URL ?? 'http://localhost:11434/v1', model: process.env.LLM_MODEL ?? 'wellness-lfm3', timeoutMs: 60000 })
  : systemOne({ baseUrl: process.env.D1_URL ?? 'http://localhost:8081', timeoutMs: 60000 });
const chat = openAIChat({ baseUrl: process.env.LLM_BASE_URL ?? 'http://localhost:11434/v1', model: process.env.LLM_MODEL ?? 'wellness-lfm3' });
for (const [name, set] of Object.entries({ tuning30: GUARD_CASES, holdout16: GUARD_HOLDOUT, external48: GUARD_EXTERNAL })) {
  let ok = 0, falseCrisis = 0, checkinNone = 0, none = 0;
  const bad: string[] = [], ms: number[] = [];
  for (const [t, w] of set) {
    const t0 = performance.now();
    const s = await assessSafety(t, d1, QUESTION, chat);
    ms.push(performance.now() - t0);
    if (s.flag === w) ok++;
    if (!w) { none++; if (s.flag === 'selfharm') falseCrisis++; if (!s.flag && s.checkin) checkinNone++; }
    if (s.flag !== w || (!w && s.checkin))
      bad.push(`  ${s.flag === w ? '~' : '✗'} want=${w ?? '-'} got=${s.flag ?? '-'}${s.checkin ? '+checkin' : ''}${s.selfharm?.verdict ? ' judge=' + s.selfharm.verdict : ''} | ${t}`);
  }
  console.log(`\n== ${name}: ${ok}/${set.length} flag-correct; of ${none} normal messages: check-in ${checkinNone}, false self-harm crisis ${falseCrisis}`);
  ms.sort((a, b) => a - b);
  console.log(`   time per message: median ${ms[ms.length >> 1].toFixed(0)} ms, p90 ${ms[Math.floor(ms.length * 0.9)].toFixed(0)} ms, max ${ms.at(-1)!.toFixed(0)} ms`);
  for (const b of bad) console.log(b);
}
