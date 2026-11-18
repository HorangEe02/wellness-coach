import { CHECKIN } from './guard.ts';
import type { GraphState } from './state.ts';

const ORDER = ['strength', 'activity'];
const HELP = '아직은 근력 운동과 걷기 기록만 답할 수 있어요. 예: "이번 주 운동 어땠어?", "회복 덜 된 근육 있어?", "주 4일 루틴 짜줘", "이번 주 산책 얼마나 했어?"';

// shortcut: template reply with no LLM (step 2). Step 3 swaps in an LLM that may only quote these facts.
export function coachNode(s: GraphState) {
  const sorted = [...s.results].sort((a, b) => ORDER.indexOf(a.domain) - ORDER.indexOf(b.domain));
  const body = s.results.length ? sorted.map(r => r.facts.join('\n')).join('\n\n') : HELP;
  return { reply: s.safety?.checkin ? `${body}\n\n${CHECKIN}` : body };
}
