import core from '@wellness/core';
import { strengthTopic } from '../router.ts';
import type { DomainResult, GraphState, UserData } from '../state.ts';

const St = core.strength;
const byId = Object.fromEntries(St.EXERCISES.map((e: any) => [e.id, e]));
const exName = (id: string) => byId[id]?.name ?? id;

// Tools: thin wrappers over egg-kim-coach's core. Every number comes from here.
export const strengthTools = {
  week(u: UserData, now: number) {
    const goal = u.strength.settings.weeklyGoal;
    return { lines: St.summary(u.strength.workouts, 'week', now, byId, { goal }) as string[], streak: St.streak(u.strength.workouts, goal, now) };
  },
  recovery(u: UserData, now: number): Record<string, number> {
    return St.recovery(u.strength.workouts, now, byId);
  },
  plan(u: UserData, days?: number) {
    return St.genPlan({ ...u.strength.planOpts, days: days ?? u.strength.planOpts.days }, St.EXERCISES);
  },
  // Today's plan day with a suggested load per exercise: egg-kim-coach's newItem() rule. Last session's sets all
  // reached the target reps → add a step (overload), otherwise repeat the top weight; never done → no suggestion.
  today(u: UserData) {
    const plan = strengthTools.plan(u);
    const dayIndex = (u.strength.planNext ?? 0) % plan.days.length;
    const day = plan.days[dayIndex];
    const items = day.items.map((it: any) => {
      const ex = byId[it.exId];
      const prev = St.prevSets(u.strength.workouts, it.exId)?.map((s: any) => ({ ...s, done: true })) ?? null;
      const sg = prev && St.overload(prev, ex, { target: it.reps });
      const top = prev ? Math.max(0, ...prev.filter((s: any) => s.type !== 'warmup').map((s: any) => s.kg || 0)) : 0;
      return {
        exId: it.exId, name: ex.name, kind: ex.kind, sets: it.sets,
        reps: sg?.reps ?? it.reps, kg: ex.kind === 'weight' ? (sg ? sg.kg : top) : 0,
        action: sg ? sg.action : 'first', // weight: +step, reps: +1 rep, keep: same, first: no history
      };
    });
    return { split: plan.split, dayIndex, days: plan.days.length, dayName: day.name, items };
  },
  // A finished workout from the app, in egg-kim-coach's stored shape, with its personal records.
  record(u: UserData, w: { start: number; end: number; dayIndex: number | null; name: string; items: { exId: string; sets: { kg: number; reps: number; done: boolean }[] }[] }) {
    const workout = {
      id: `w${w.start}`, start: w.start, end: w.end, name: w.name, prs: [] as any[],
      items: w.items.map(it => ({ exId: it.exId, group: null, target: null, sets: it.sets.map(s => ({ type: 'normal', kg: s.kg, reps: s.reps, done: s.done })) })),
    };
    workout.prs = St.detectPRs(u.strength.workouts, workout, byId);
    return workout;
  },
};
export const exerciseById = byId;

export function strengthNode(s: GraphState): { results: DomainResult[] } {
  const topic = strengthTopic(s.input);
  if (topic === 'plan') {
    const m = s.input.match(/주\s*(\d)\s*(일|회|번)/);
    const plan = strengthTools.plan(s.user, m ? Number(m[1]) : undefined);
    const facts = [`${plan.split} 계획이에요.`, ...plan.days.map((d: any) =>
      `${d.name}: ${d.items.map((it: any) => `${exName(it.exId)} ${it.sets}×${it.sec ? it.sec / 60 + '분' : it.reps}`).join(', ')}`)];
    if (plan.excluded.length) facts.push(`아프다고 한 부위 때문에 ${plan.excluded.length}개 종목은 뺐어요.`);
    return { results: [{ domain: 'strength', topic, facts, data: { plan } }] };
  }
  if (topic === 'recovery') {
    const rec = strengthTools.recovery(s.user, s.now);
    const tired = Object.entries(rec).filter(([, v]) => v < 100).sort((a, b) => a[1] - b[1]);
    const facts = tired.length
      ? [`아직 덜 회복된 근육: ${tired.slice(0, 5).map(([m, v]) => `${St.MUSCLES[m]} ${v}%`).join(', ')}.`, '회복도는 마지막 운동 후 지난 시간으로 어림한 값이에요.']
      : ['최근 7일 기록 기준으로 모든 근육이 회복된 상태예요.'];
    return { results: [{ domain: 'strength', topic, facts, data: { recovery: rec } }] };
  }
  const { lines, streak } = strengthTools.week(s.user, s.now);
  const facts = streak.weeks > 0 ? [...lines, `주간 목표를 ${streak.weeks}주 연속 채웠어요.`] : lines;
  return { results: [{ domain: 'strength', topic, facts, data: { streak } }] };
}
