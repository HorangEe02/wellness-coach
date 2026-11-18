import core from '@wellness/core';
import { activityTopic } from '../router.ts';
import type { DomainResult, GraphState, UserData } from '../state.ts';

const { pace: P, shared: Sh } = core;
const km = (m: number) => (m / 1000).toFixed(1) + 'km';
const dur = (sec: number) => { const h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60); return h ? `${h}시간 ${m}분` : `${m}분`; };

// Tools: thin wrappers over Pace-Coach's core.
export const activityTools = {
  week(u: UserData, now: number) {
    const stats = P.weekStats(u.walks, now);
    const from = Sh.weekStart(now);
    const thisWeek = u.walks.filter(w => w.start >= from && w.start <= now);
    const kcal = thisWeek.reduce((a, w) => a + P.walkKcal(w.distM, w.activeSec, u.profile.weightKg), 0);
    const steps = thisWeek.reduce((a, w) => a + P.estSteps(w.distM, u.profile.heightCm), 0);
    return { ...stats, kcal, steps };
  },
};

export function activityNode(s: GraphState): { results: DomainResult[] } {
  const topic = activityTopic(s.input);
  if (topic === 'course') // recommendCourse is step 5 in docs/DESIGN.md
    return { results: [{ domain: 'activity', topic, facts: ['코스 추천은 아직 준비 중이에요.'], data: {} }] };
  const w = activityTools.week(s.user, s.now);
  const facts = w.thisWeek.n
    ? [`이번 주 ${w.thisWeek.n}번 걸었어요. ${km(w.thisWeek.distM)}, ${dur(w.thisWeek.sec)}.`, `어림하면 약 ${w.kcal}kcal, ${w.steps.toLocaleString('ko-KR')}걸음이에요.`]
    : ['이번 주에는 아직 걷기 기록이 없어요.'];
  if (w.lastWeek.n) {
    const diff = w.thisWeek.distM - w.lastWeek.distM;
    facts.push(`지난주는 ${w.lastWeek.n}번, ${km(w.lastWeek.distM)}였어요${Math.abs(diff) >= 100 ? ` (${km(Math.abs(diff))} ${diff > 0 ? '더' : '덜'} 걸었어요)` : ''}.`);
  }
  return { results: [{ domain: 'activity', topic, facts, data: w }] };
}
