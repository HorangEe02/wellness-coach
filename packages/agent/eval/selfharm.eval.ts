// Self-harm eval: does the guard send the crisis reply when (and only when) it should?
// Run: node eval/selfharm.eval.ts [dev|test|ext-dev|ext-test] [--verbose]   (needs the d1 server; "rules" needs nothing)
import { assessSafety, QUESTION } from '../src/guard.ts';
import { openAIChat } from '../src/models/chat.ts';
import { llmChoice } from '../src/models/llmchoice.ts';
import { systemOne } from '../src/models/systemone.ts';
import { SH_DEV, SH_EXT_DEV, SH_EXT_TEST, SH_TEST } from './selfharm-cases.ts';
import type { ShCase } from './selfharm-cases.ts';

const which = process.argv[2] ?? 'dev';
const verbose = process.argv.includes('--verbose');
const sets: Record<string, ShCase[]> = { dev: SH_DEV, test: SH_TEST, 'ext-dev': SH_EXT_DEV, 'ext-test': SH_EXT_TEST };
const cases = sets[which];
if (!cases) throw new Error(`unknown set ${which}`);

// Outcome per message: crisis (blocked, crisis reply), checkin (normal answer + 109 line), or nothing.
// A positive is "reached" if it sees 109 either way; the crisis reply is the goal for positives.
// DECIDER=lfm3 screens with LFM3 on Ollama instead of d1-2B on llama.cpp (no WSL needed)
const d1 = process.env.DECIDER === 'lfm3'
  ? llmChoice({ baseUrl: process.env.LLM_BASE_URL ?? 'http://localhost:11434/v1', model: process.env.LLM_MODEL ?? 'wellness-lfm3', timeoutMs: 60000 })
  : systemOne({ baseUrl: process.env.D1_URL ?? 'http://localhost:8081', timeoutMs: 60000 });
const lfm3 = openAIChat({ baseUrl: process.env.LLM_BASE_URL ?? 'http://localhost:11434/v1', model: process.env.LLM_MODEL ?? 'wellness-lfm3' });
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const configs = [['rules', null, null], ['rules+d1', d1, null], ['rules+d1+lfm3', d1, lfm3]] as const;
for (const [name, decider, chat] of configs) {
  if (only && name !== only) continue;
  const byKind: Record<string, [number, number]> = {};
  let crisisPos = 0, checkinPos = 0, missPos = 0, wrongReply = 0, crisisNeg = 0, checkinNeg = 0, cleanNeg = 0;
  const lines: string[] = [], ms: number[] = [];
  for (const k of cases) {
    const t0 = performance.now();
    const s = await assessSafety(k.text, decider, QUESTION, chat);
    ms.push(performance.now() - t0);
    const crisis = s.flag === 'selfharm', want = k.label === 'selfharm';
    const out = crisis ? 'crisis' : s.checkin ? 'checkin' : s.flag ?? '-';
    const p = Object.entries(s.scores).map(([x, v]) => `${x.slice(0, 3)}=${v!.toFixed(2)}`).join(' ');
    const sh = s.selfharm ? ` screen=${s.selfharm.screen.toFixed(2)}${s.selfharm.verdict ? ' judge=' + s.selfharm.verdict : ''}` : '';
    const good = want ? crisis : !crisis && !s.checkin;
    if (!k.ambiguous) {
      if (want) { if (crisis) crisisPos++; else if (s.checkin) checkinPos++; else { missPos++; if (s.flag) wrongReply++; } }
      else if (crisis) crisisNeg++; else if (s.checkin) checkinNeg++; else cleanNeg++;
      const b = (byKind[k.kind] ??= [0, 0]); b[0] += good ? 1 : 0; b[1]++;
    }
    if (verbose || !good || k.ambiguous)
      lines.push(`  ${k.ambiguous ? '?' : good ? '✓' : want && s.checkin ? '~' : '✗'} [${k.kind}] want=${k.label ?? '-'} got=${out}${sh} ${p} | ${k.text}`);
  }
  const pos = crisisPos + checkinPos + missPos, neg = crisisNeg + checkinNeg + cleanNeg;
  console.log(`\n== ${which} ${name}: positives ${pos}: crisis ${crisisPos}, check-in ${checkinPos}, missed ${missPos} (${wrongReply} got another safety reply)`);
  console.log(`   negatives ${neg}: clean ${cleanNeg}, check-in ${checkinNeg}, false crisis ${crisisNeg}`);
  ms.sort((a, b) => a - b);
  console.log(`   time per message: median ${ms[ms.length >> 1].toFixed(0)} ms, p90 ${ms[Math.floor(ms.length * 0.9)].toFixed(0)} ms, max ${ms.at(-1)!.toFixed(0)} ms`);
  console.log('   by kind: ' + Object.entries(byKind).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', '));
  for (const l of lines) console.log(l);
}
