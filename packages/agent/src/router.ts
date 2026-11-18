import type { Domain, GraphState } from './state.ts';

// shortcut: keyword rules only; an LLM classifier for unmatched input comes with step 3.
const STRENGTH = ['근력', '헬스', '웨이트', '루틴', '분할', '세트', '볼륨', '회복', '근육', '스쿼트', '벤치', '데드', '1RM', 'PR'];
const ACTIVITY = ['걷기', '걸었', '걸음', '산책', '러닝', '달리기', '뛰었', '등산', '코스', 'km', '킬로'];
const has = (text: string, words: string[]) => words.some(w => text.includes(w));

export function route(text: string): Domain[] {
  const activity = has(text, ACTIVITY);
  // "운동" alone is generic: "걷기 운동" is about walking, "운동 어땠어" is about the gym.
  const strength = has(text, STRENGTH) || (text.includes('운동') && (!activity || /운동\s*(이랑|하고|과|와|,)/.test(text)));
  const out: Domain[] = [];
  if (strength) out.push('strength');
  if (activity) out.push('activity');
  return out;
}

export type StrengthTopic = 'plan' | 'recovery' | 'week';
export function strengthTopic(text: string): StrengthTopic {
  if (/계획|루틴|분할|짜\s*줘|짜줘|프로그램/.test(text)) return 'plan';
  if (/회복|쉬어|쉴|피로|근육통/.test(text)) return 'recovery';
  return 'week';
}

export type ActivityTopic = 'course' | 'week';
export const activityTopic = (text: string): ActivityTopic => (/코스|어디|추천/.test(text) ? 'course' : 'week');

export const routerNode = (s: GraphState) => ({ intents: route(s.input) });
