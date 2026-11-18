// Run: node src/cli.ts "이번 주 운동 어땠어?"   (uses the demo user pinned to 17 Nov 2026)
// DECISION_BACKEND=d1 adds the d1-2B safety check (docs/MODELS.md §5); default is rules only.
import { NOW, demoUser } from './fixtures/demo-user.ts';
import { ask, buildGraph } from './graph.ts';
import { modelsFromEnv } from './models/config.ts';

const input = process.argv.slice(2).join(' ').trim();
if (!input) {
  console.error('usage: node src/cli.ts "<질문>"');
  process.exit(1);
}
const out = await ask(input, demoUser, NOW, buildGraph(modelsFromEnv()));
const s = out.safety;
const tag = s.flag ? `안전:${s.flag}(${s.source})` : (out.intents ?? []).join(', ') || '없음';
console.log(`[${tag}]${s.modelError ? ` (결정 모델 실패, 규칙으로 판정: ${s.modelError})` : ''}\n${out.reply}`);
